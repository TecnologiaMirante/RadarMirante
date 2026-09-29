import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions/v1'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { monitorActivePosts } from './scheduled/monitorPosts'
import { syncInstagramInsights } from './scheduled/syncInstagramInsights'
import { analyzeTrendingPost } from './ai/analyzeTrendingPost'
import { createOrUpdateOpportunity } from './radar/opportunity'
import { getSnapshotHistory } from './radar/snapshots'
import { getBucket, getPostAgeMinutes, getBaseline } from './radar/baseline'
import { InstagramConnector } from './connectors/instagram'
import type { RadarPost, RadarComment, AnalysisRun, AnalysisTrigger, AccountProfile } from './types/radar'
import type { AnalysisTask } from './tasks/queueAnalysis'

if (admin.apps.length === 0) {
  admin.initializeApp()
}

const db = admin.firestore()

const ALLOWED_DOMAIN = 'mirante.com.br'
const openaiApiKey = defineSecret('OPENAI_API_KEY')

// ─── Secrets por conta Instagram ──────────────────────────────────────────────
// Cada conta tem seu próprio par de token + account ID no Secret Manager.
// Para adicionar uma nova conta: crie os secrets no Secret Manager, declare
// com defineSecret() aqui e adicione uma entrada em getActiveAccounts().
const instagramToken       = defineSecret('INSTAGRAM_ACCESS_TOKEN')
const instagramAccountId   = defineSecret('INSTAGRAM_ACCOUNT_ID')
const tvmiranteToken       = defineSecret('TVMIRANTE_INSTAGRAM_ACCESS_TOKEN')
const tvmiranteAccountId   = defineSecret('TVMIRANTE_INSTAGRAM_ACCOUNT_ID')

interface AccountEntry {
  radarId: string
  profile: AccountProfile
  getToken: () => string
  getAccountId: () => string
}

function getActiveAccounts(): AccountEntry[] {
  return [
    {
      radarId: 'imirante',
      profile: 'editorial' as AccountProfile,
      getToken: () => instagramToken.value(),
      getAccountId: () => instagramAccountId.value(),
    },
    {
      radarId: 'tvmirante',
      profile: 'viral' as AccountProfile,
      getToken: () => tvmiranteToken.value(),
      getAccountId: () => tvmiranteAccountId.value(),
    },
    // imiranteesporte: adicionar aqui quando secrets estiverem no Secret Manager
  ]
}

// ─── Helpers de audit log ─────────────────────────────────────────────────────

async function writeAuditLog(params: {
  action: string
  performedBy: string
  performedByEmail: string
  targetUid?: string
  targetEmail?: string
  details?: Record<string, unknown>
}) {
  try {
    await db.collection('activityLog').add({
      ...params,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  } catch (err) {
    console.warn('[audit]', err)
  }
}

// ─── Auth: validação de domínio + criação do doc em /users ───────────────────

export const onUserCreated = functions
  .region('southamerica-east1')
  .auth.user()
  .onCreate(async (user) => {
    const email = (user.email ?? '').toLowerCase()
    const isAllowedDomain = email.endsWith(`@${ALLOWED_DOMAIN}`)

    if (!isAllowedDomain) {
      // Verifica se há convite pendente para este e-mail
      const inviteSnap = await db.collection('invites')
        .where('email', '==', email)
        .where('status', '==', 'pending')
        .limit(1)
        .get()

      if (inviteSnap.empty) {
        console.warn('[onUserCreated] Domínio não autorizado e sem convite:', email)
        await admin.auth().deleteUser(user.uid)
        return
      }

      // Convite encontrado — usa as configs do convite
      const invite = inviteSnap.docs[0]
      const inviteData = invite.data()
      await db.collection('users').doc(user.uid).set({
        email: user.email,
        displayName: user.displayName ?? '',
        photoURL: user.photoURL ?? '',
        role: inviteData.role ?? 'user',
        isAdmin: inviteData.role === 'admin' || inviteData.role === 'superadmin',
        accounts: inviteData.accounts ?? [],
        invitedBy: inviteData.createdBy,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      await invite.ref.update({
        status: 'accepted',
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        acceptedBy: user.uid,
      })
      await writeAuditLog({
        action: 'user_created',
        performedBy: user.uid,
        performedByEmail: email,
        details: { via: 'invite', inviteId: invite.id },
      })
      return
    }

    await db.collection('users').doc(user.uid).set({
      email: user.email,
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? '',
      role: 'user',
      isAdmin: false,
      accounts: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    await writeAuditLog({
      action: 'user_created',
      performedBy: user.uid,
      performedByEmail: email,
    })
  })

// ─── Sync disabled + audit log ao atualizar doc de usuário ───────────────────

export const onUserDocUpdated = onDocumentUpdated(
  { document: 'users/{userId}', region: 'southamerica-east1' },
  async (event) => {
    const before = event.data?.before.data()
    const after  = event.data?.after.data()
    if (!before || !after) return

    const uid = event.params.userId
    const changedByUid   = after.updatedBy ?? 'system'
    const changedByEmail = after.updatedByEmail ?? 'system'
    const targetEmail    = after.email ?? ''

    // Sync disabled → Firebase Auth
    if (before.disabled !== after.disabled) {
      const isDisabled = after.disabled === true
      await admin.auth().updateUser(uid, { disabled: isDisabled })
      if (isDisabled) await admin.auth().revokeRefreshTokens(uid)
      await writeAuditLog({
        action: isDisabled ? 'user_disabled' : 'user_enabled',
        performedBy: changedByUid,
        performedByEmail: changedByEmail,
        targetUid: uid,
        targetEmail,
      })
    }

    // Audit: role changed
    if (before.role !== after.role) {
      await writeAuditLog({
        action: 'role_changed',
        performedBy: changedByUid,
        performedByEmail: changedByEmail,
        targetUid: uid,
        targetEmail,
        details: { from: before.role, to: after.role },
      })
    }

    // Audit: accounts changed
    const beforeAccounts = JSON.stringify([...(before.accounts ?? [])].sort())
    const afterAccounts  = JSON.stringify([...(after.accounts  ?? [])].sort())
    if (beforeAccounts !== afterAccounts) {
      await writeAuditLog({
        action: 'accounts_changed',
        performedBy: changedByUid,
        performedByEmail: changedByEmail,
        targetUid: uid,
        targetEmail,
        details: { from: before.accounts, to: after.accounts },
      })
    }
  },
)

// ─── Health check ─────────────────────────────────────────────────────────────

export const healthCheck = onRequest(
  { cors: false, region: 'southamerica-east1' },
  (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() })
  },
)

// ─── Monitoramento agendado ───────────────────────────────────────────────────

// Roda a cada 15 min entre 6h e 20h45 (horário de Brasília).
// Fora desse horário (21h–6h) o monitoramento fica pausado.
export const monitorPostsScheduled = onSchedule(
  { schedule: '0 6-20 * * *', timeZone: 'America/Sao_Paulo', retryCount: 2, region: 'southamerica-east1' },
  async () => {
    console.log('[monitorPostsScheduled] Iniciando ciclo')
    const start = Date.now()
    try {
      await monitorActivePosts(db)
      await db.collection('systemHealth').doc('monitorPosts').set({
        lastRun: admin.firestore.FieldValue.serverTimestamp(),
        lastStatus: 'success',
        lastDurationMs: Date.now() - start,
        consecutiveErrors: 0,
        lastError: null,
        runCount: admin.firestore.FieldValue.increment(1),
      }, { merge: true })
    } catch (err) {
      await db.collection('systemHealth').doc('monitorPosts').set({
        lastRun: admin.firestore.FieldValue.serverTimestamp(),
        lastStatus: 'error',
        lastDurationMs: Date.now() - start,
        lastError: err instanceof Error ? err.message : String(err),
        consecutiveErrors: admin.firestore.FieldValue.increment(1),
        runCount: admin.firestore.FieldValue.increment(1),
      }, { merge: true })
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

      // Resolve perfil da conta para selecionar prompt correto
      const accountEntry = getActiveAccounts().find(a => a.radarId === post.account)
      const profile: AccountProfile = accountEntry?.profile ?? 'editorial'

      // Análise via OpenAI
      const analysis = await analyzeTrendingPost(
        { post, snapshots, trendScore: task.trendScore, baselineComparison, comments, profile },
        openaiApiKey.value(),
      )

      // Cria ou atualiza opportunity
      const opportunityId = await createOrUpdateOpportunity(
        db, post, analysis, task.trendScore, 0.8, baselineComparison, profile,
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
      const fullPost = { id: postId, ...post } as RadarPost & { id: string }
      const accountEntry = getActiveAccounts().find(a => a.radarId === fullPost.account)
      const profile: AccountProfile = accountEntry?.profile ?? 'editorial'

      const analysis = await analyzeTrendingPost(
        { post: fullPost, snapshots, trendScore: post.trendScore ?? 0, baselineComparison, comments, profile },
        openaiApiKey.value(),
      )
      const opportunityId = await createOrUpdateOpportunity(
        db, fullPost, analysis, post.trendScore ?? 0, 0.8, baselineComparison, profile,
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
    secrets: [instagramToken, instagramAccountId, tvmiranteToken, tvmiranteAccountId],
  },
  async () => {
    console.log('[syncInsights] Iniciando')
    const start = Date.now()
    let hasError = false
    let lastError: string | null = null
    for (const acc of getActiveAccounts()) {
      try {
        await syncInstagramInsights(db, acc.getToken(), acc.getAccountId(), acc.radarId)
        console.log(`[syncInsights] ${acc.radarId} OK`)
      } catch (err) {
        hasError = true
        lastError = err instanceof Error ? err.message : String(err)
        console.error(`[syncInsights] ${acc.radarId} erro:`, err)
      }
    }
    await db.collection('systemHealth').doc('syncInsights').set({
      lastRun: admin.firestore.FieldValue.serverTimestamp(),
      lastStatus: hasError ? 'error' : 'success',
      lastDurationMs: Date.now() - start,
      lastError: lastError ?? null,
      consecutiveErrors: hasError ? admin.firestore.FieldValue.increment(1) : 0,
      runCount: admin.firestore.FieldValue.increment(1),
    }, { merge: true })
  },
)

// ─── Coleta Instagram agendada ────────────────────────────────────────────────

// Coleta a cada hora entre 6h e 20h (horário de Brasília).
export const collectInstagram = onSchedule(
  {
    schedule: '0 6-20 * * *',
    timeZone: 'America/Sao_Paulo',
    retryCount: 1,
    region: 'southamerica-east1',
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [instagramToken, instagramAccountId, tvmiranteToken, tvmiranteAccountId],
  },
  async () => {
    console.log('[collectInstagram] Iniciando coleta')
    const start = Date.now()
    let hasError = false
    let lastError: string | null = null
    for (const acc of getActiveAccounts()) {
      const connector = new InstagramConnector(acc.getToken(), acc.getAccountId(), db, acc.radarId)
      try {
        await connector.syncPosts()
        console.log(`[collectInstagram] ${acc.radarId}:`, connector.getLastCollectionResult())
      } catch (err) {
        hasError = true
        lastError = err instanceof Error ? err.message : String(err)
        console.error(`[collectInstagram] ${acc.radarId} erro:`, err)
      }
    }
    await db.collection('systemHealth').doc('collectInstagram').set({
      lastRun: admin.firestore.FieldValue.serverTimestamp(),
      lastStatus: hasError ? 'error' : 'success',
      lastDurationMs: Date.now() - start,
      lastError: lastError ?? null,
      consecutiveErrors: hasError ? admin.firestore.FieldValue.increment(1) : 0,
      runCount: admin.firestore.FieldValue.increment(1),
    }, { merge: true })
  },
)
