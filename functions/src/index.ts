import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions/v1'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { monitorActivePosts } from './scheduled/monitorPosts'
import { syncInstagramInsights } from './scheduled/syncInstagramInsights'
import { analyzeTrendingPost } from './ai/analyzeTrendingPost'
import { createOrUpdateOpportunity } from './radar/opportunity'
import { getSnapshotHistory } from './radar/snapshots'
import { getBucket, getPostAgeMinutes, getBaseline } from './radar/baseline'
import { InstagramConnector } from './connectors/instagram'
import type { RadarPost, RadarComment, AnalysisRun, AnalysisTrigger } from './types/radar'
import type { AnalysisTask } from './tasks/queueAnalysis'

if (admin.apps.length === 0) {
  admin.initializeApp()
}

const db = admin.firestore()

const ALLOWED_DOMAIN = 'mirante.com.br'
const openaiApiKey = defineSecret('OPENAI_API_KEY')
const instagramToken = defineSecret('INSTAGRAM_ACCESS_TOKEN')
const instagramAccountId = defineSecret('INSTAGRAM_ACCOUNT_ID')

// ─── Auth: validação de domínio + criação do doc em /users ───────────────────

export const onUserCreated = functions
  .region('southamerica-east1')
  .auth.user()
  .onCreate(async (user) => {
    const email = user.email ?? ''
    if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      console.warn('[onUserCreated] Domínio não autorizado:', email)
      await admin.auth().deleteUser(user.uid)
      return
    }
    await db.collection('users').doc(user.uid).set({
      email: user.email,
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  })

// ─── Health check ─────────────────────────────────────────────────────────────

export const healthCheck = onRequest(
  { cors: false, region: 'southamerica-east1' },
  (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() })
  },
)

// ─── Monitoramento agendado ───────────────────────────────────────────────────

export const monitorPostsScheduled = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'America/Sao_Paulo', retryCount: 2, region: 'southamerica-east1' },
  async () => {
    console.log('[monitorPostsScheduled] Iniciando ciclo')
    try {
      await monitorActivePosts(db)
    } catch (err) {
      console.error('[monitorPostsScheduled] Erro:', err)
      throw err
    }
  },
)

// ─── Análise editorial via Cloud Tasks ───────────────────────────────────────

export const analyzePost = onRequest(
  {
    cors: false,
    region: 'southamerica-east1',
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [openaiApiKey],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    // Cloud Tasks inclui este header — serve como verificação básica de origem
    const queueName = req.headers['x-cloudtasks-queuename']
    if (!queueName) {
      res.status(403).json({ error: 'Requisição não autorizada' })
      return
    }

    let task: AnalysisTask
    try {
      task = req.body as AnalysisTask
      if (!task.postId || !task.platform) throw new Error('Payload inválido')
    } catch {
      res.status(400).json({ error: 'Payload inválido' })
      return
    }

    // Registra o início da análise
    const runRef = db.collection('analysisRuns').doc()
    const run: Omit<AnalysisRun, 'id'> = {
      postId: task.postId,
      status: 'running',
      triggeredBy: task.triggeredBy as AnalysisTrigger,
      scoreAtTrigger: task.trendScore,
      commentsAtTrigger: 0,
      startedAt: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
    }
    await runRef.set(run)

    try {
      // Busca post
      const postDoc = await db.collection('posts').doc(task.postId).get()
      if (!postDoc.exists) throw new Error(`Post ${task.postId} não encontrado`)
      const post = { id: postDoc.id, ...postDoc.data() } as RadarPost & { id: string }

      // Busca comentários
      const commentsSnap = await db
        .collection('posts').doc(task.postId).collection('comments').get()
      const comments = commentsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as RadarComment & { id: string }),
      )

      // Busca snapshots
      const snapshots = await getSnapshotHistory(db, task.postId, 24)

      // Baseline comparison
      const ageMinutes = getPostAgeMinutes(post.publishedAt)
      const bucket = getBucket(ageMinutes)
      const baseline = await getBaseline(db, post.platform, bucket)
      const baselineComparison = baseline && baseline.p90 > 0
        ? ((post.metrics.comments - baseline.p90) / baseline.p90) * 100
        : 0

      // Análise via OpenAI
      const analysis = await analyzeTrendingPost(
        { post, snapshots, trendScore: task.trendScore, baselineComparison, comments },
        openaiApiKey.value(),
      )

      // Cria ou atualiza opportunity
      const opportunityId = await createOrUpdateOpportunity(
        db, post, analysis, task.trendScore, 0.8, baselineComparison,
      )

      // Marca run como concluído
      await runRef.update({
        status: 'completed',
        opportunityId,
        commentsAtTrigger: comments.length,
        analysis,
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      console.log(`[analyzePost] ${task.postId} → opportunity ${opportunityId}`)
      res.json({ success: true, opportunityId })
    } catch (err) {
      console.error('[analyzePost] Erro:', err)
      await runRef.update({
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      res.status(500).json({ error: 'Análise falhou' })
    }
  },
)

// ─── Análise manual via Firestore job queue ───────────────────────────────────
// Frontend escreve em analysisRequests/{id} com status='pending'.
// Esta função v2 (Firestore trigger) processa e atualiza o documento.
// Sem endpoint HTTP → sem CORS → sem conflito com org policy IAM.

export const processAnalysisRequest = onDocumentCreated(
  {
    document: 'analysisRequests/{requestId}',
    region: 'southamerica-east1',
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [openaiApiKey],
  },
  async (event) => {
    const snap = event.data
    if (!snap) return
    const requestId = event.params.requestId
    const data = snap.data()
    const postId = data.postId as string
    const requestedBy = data.requestedBy as string

    const requestRef = db.collection('analysisRequests').doc(requestId)

    // Verifica domínio do solicitante
    const userRecord = await admin.auth().getUser(requestedBy).catch(() => null)
    const email = userRecord?.email ?? ''
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      await requestRef.update({ status: 'failed', error: 'Domínio não autorizado', updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      return
    }

    await requestRef.update({ status: 'running', updatedAt: admin.firestore.FieldValue.serverTimestamp() })

    const postDoc = await db.collection('posts').doc(postId).get()
    if (!postDoc.exists) {
      await requestRef.update({ status: 'failed', error: 'Post não encontrado', updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      return
    }
    const post = postDoc.data()!

    const commentsSnap = await db.collection('posts').doc(postId).collection('comments').get()
    const comments = commentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as RadarComment & { id: string }))

    const snapshots = await getSnapshotHistory(db, postId, 24)
    const ageMinutes = getPostAgeMinutes(post.publishedAt)
    const bucket = getBucket(ageMinutes)
    const baseline = await getBaseline(db, post.platform, bucket)
    const baselineComparison = baseline && baseline.p90 > 0
      ? ((post.metrics.comments - baseline.p90) / baseline.p90) * 100 : 0

    const runRef = db.collection('analysisRuns').doc()
    await runRef.set({
      postId, status: 'running', triggeredBy: 'manual' as AnalysisTrigger,
      scoreAtTrigger: post.trendScore ?? 0, commentsAtTrigger: comments.length,
      startedAt: admin.firestore.Timestamp.now(), createdAt: admin.firestore.Timestamp.now(),
    })

    try {
      const analysis = await analyzeTrendingPost(
        { post: { id: postId, ...post } as RadarPost & { id: string }, snapshots, trendScore: post.trendScore ?? 0, baselineComparison, comments },
        openaiApiKey.value(),
      )
      const opportunityId = await createOrUpdateOpportunity(
        db, { id: postId, ...post } as RadarPost & { id: string }, analysis, post.trendScore ?? 0, 0.8, baselineComparison,
      )
      await runRef.update({ status: 'completed', opportunityId, analysis, finishedAt: admin.firestore.FieldValue.serverTimestamp() })
      await requestRef.update({ status: 'completed', opportunityId, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      console.log(`[processAnalysisRequest] ${postId} → ${opportunityId} (by ${requestedBy})`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await runRef.update({ status: 'failed', error: errMsg, finishedAt: admin.firestore.FieldValue.serverTimestamp() })
      await requestRef.update({ status: 'failed', error: errMsg, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      console.error('[processAnalysisRequest] Erro:', err)
    }
  },
)

// ─── Sync Instagram Insights (alcance, impressões, seguidores) ───────────────

export const syncInsights = onSchedule(
  {
    schedule: 'every 6 hours',
    timeZone: 'America/Sao_Paulo',
    retryCount: 1,
    region: 'southamerica-east1',
    secrets: [instagramToken, instagramAccountId],
  },
  async () => {
    console.log('[syncInsights] Iniciando')
    try {
      await syncInstagramInsights(db, instagramToken.value(), instagramAccountId.value())
    } catch (err) {
      console.error('[syncInsights] Erro:', err)
      throw err
    }
  },
)

// ─── Coleta Instagram agendada ────────────────────────────────────────────────

export const collectInstagram = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'America/Sao_Paulo',
    retryCount: 1,
    region: 'southamerica-east1',
    secrets: [instagramToken, instagramAccountId],
  },
  async () => {
    console.log('[collectInstagram] Iniciando coleta')
    const connector = new InstagramConnector(
      instagramToken.value(),
      instagramAccountId.value(),
      db,
    )
    try {
      await connector.syncPosts()
      const result = connector.getLastCollectionResult()
      console.log('[collectInstagram] Resultado:', result)
    } catch (err) {
      console.error('[collectInstagram] Erro:', err)
      throw err
    }
  },
)
