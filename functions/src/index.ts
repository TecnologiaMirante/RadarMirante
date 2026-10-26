import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions/v1'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { monitorActivePosts } from './scheduled/monitorPosts'
import { syncInstagramInsights } from './scheduled/syncInstagramInsights'
import { captureWeeklySnapshot } from './scheduled/captureWeeklySnapshot'
import { fetchAndStoreTrends } from './scheduled/fetchTrends'
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
const instagramToken            = defineSecret('INSTAGRAM_ACCESS_TOKEN')
const instagramAccountId        = defineSecret('INSTAGRAM_ACCOUNT_ID')
const tvmiranteToken            = defineSecret('TVMIRANTE_INSTAGRAM_ACCESS_TOKEN')
const tvmiranteAccountId        = defineSecret('TVMIRANTE_INSTAGRAM_ACCOUNT_ID')
const imirantepoliticaToken     = defineSecret('instagram-token-imirantepolitica')
const imirantepoliticaAccountId = defineSecret('instagram-account-id-imirantepolitica')
const mirantefmToken              = defineSecret('instagram-token-mirantefm')
const mirantefmAccountId          = defineSecret('instagram-account-id-mirantefm')
const imiranteesporteToken        = defineSecret('instagram-token-imiranteesporte')
const imiranteesporteAccountId    = defineSecret('instagram-account-id-imiranteesporte')
const geglobomaranhaoToken        = defineSecret('instagram-token-geglobomaranhao')
const geglobomaranhaoAccountId    = defineSecret('instagram-account-id-geglobomaranhao')
const g1maranhaoToken             = defineSecret('instagram-token-g1maranhao')
const g1maranhaoAccountId         = defineSecret('instagram-account-id-g1maranhao')

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
    {
      radarId: 'imirantepolitica',
      profile: 'editorial' as AccountProfile,
      getToken: () => imirantepoliticaToken.value(),
      getAccountId: () => imirantepoliticaAccountId.value(),
    },
    {
      radarId: 'mirantefm',
      profile: 'radio' as AccountProfile,
      getToken: () => mirantefmToken.value(),
      getAccountId: () => mirantefmAccountId.value(),
    },
    {
      radarId: 'imiranteesporte',
      profile: 'esporte' as AccountProfile,
      getToken: () => imiranteesporteToken.value(),
      getAccountId: () => imiranteesporteAccountId.value(),
    },
    {
      radarId: 'ge.globomaranhao',
      profile: 'esporte' as AccountProfile,
      getToken: () => geglobomaranhaoToken.value(),
      getAccountId: () => geglobomaranhaoAccountId.value(),
    },
    {
      radarId: 'g1maranhao',
      profile: 'editorial' as AccountProfile,
      getToken: () => g1maranhaoToken.value(),
      getAccountId: () => g1maranhaoAccountId.value(),
    },
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

type CheckStatus = 'healthy' | 'degraded' | 'unhealthy'
interface CheckResult { status: CheckStatus; responseTimeMs: number; message?: string }

async function checkFirestore(): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    await db.collection('systemHealth').doc('healthProbe').set(
      { lastCheck: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    )
    const ms = Date.now() - t0
    return { status: ms < 2000 ? 'healthy' : 'degraded', responseTimeMs: ms }
  } catch (e) {
    return { status: 'unhealthy', responseTimeMs: Date.now() - t0, message: String(e) }
  }
}

async function checkStorage(): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    const bucket = admin.storage().bucket()
    await bucket.exists()
    const ms = Date.now() - t0
    return { status: ms < 3000 ? 'healthy' : 'degraded', responseTimeMs: ms }
  } catch (e) {
    return { status: 'unhealthy', responseTimeMs: Date.now() - t0, message: String(e) }
  }
}

export const healthCheck = onRequest(
  { cors: false, region: 'southamerica-east1', timeoutSeconds: 10 },
  async (_req, res) => {
    const [database, storage] = await Promise.all([checkFirestore(), checkStorage()])

    const statuses: CheckStatus[] = [database.status, storage.status]
    const overall: CheckStatus =
      statuses.every(s => s === 'healthy') ? 'healthy' :
      statuses.some(s => s === 'unhealthy') ? 'unhealthy' :
      'degraded'

    res.status(overall === 'unhealthy' ? 503 : 200).json({
      status: overall,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checks: { database, storage },
    })
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

// ─── Captura semanal automática de performance ───────────────────────────────

// Roda todo domingo às 03:00 (horário de Brasília).
// Primeiras 4 semanas: comparar semana x semana.
// A partir de 28 dias de histórico: comparar mês x mês.
// A lógica de comparação fica na UI — aqui só capturamos o snapshot.
export const weeklyPerformanceSnapshot = onSchedule(
  {
    schedule: '0 3 * * 0',
    timeZone: 'America/Sao_Paulo',
    retryCount: 1,
    region: 'southamerica-east1',
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async () => {
    console.log('[weeklyPerformanceSnapshot] Iniciando')
    const start = Date.now()
    try {
      await captureWeeklySnapshot(db)
      await db.collection('systemHealth').doc('weeklySnapshot').set({
        lastRun: admin.firestore.FieldValue.serverTimestamp(),
        lastStatus: 'success',
        lastDurationMs: Date.now() - start,
        consecutiveErrors: 0,
        lastError: null,
        runCount: admin.firestore.FieldValue.increment(1),
      }, { merge: true })
    } catch (err) {
      await db.collection('systemHealth').doc('weeklySnapshot').set({
        lastRun: admin.firestore.FieldValue.serverTimestamp(),
        lastStatus: 'error',
        lastDurationMs: Date.now() - start,
        lastError: err instanceof Error ? err.message : String(err),
        consecutiveErrors: admin.firestore.FieldValue.increment(1),
        runCount: admin.firestore.FieldValue.increment(1),
      }, { merge: true })
      console.error('[weeklyPerformanceSnapshot] Erro:', err)
      throw err
    }
  },
)

// ─── Farejador de Tendências ─────────────────────────────────────────────────
// Busca Google Trends BR (RSS oficial) + Twitter trends via getdaytrends.com
// Salva em Firestore: trends/google e trends/twitter

export const fetchTrends = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'America/Sao_Paulo',
    retryCount: 1,
    region: 'southamerica-east1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    const start = Date.now()
    try {
      await fetchAndStoreTrends(db)
      await db.collection('systemHealth').doc('fetchTrends').set({
        lastRun: admin.firestore.FieldValue.serverTimestamp(),
        lastStatus: 'success',
        lastDurationMs: Date.now() - start,
        consecutiveErrors: 0,
        lastError: null,
        runCount: admin.firestore.FieldValue.increment(1),
      }, { merge: true })
    } catch (err) {
      await db.collection('systemHealth').doc('fetchTrends').set({
        lastRun: admin.firestore.FieldValue.serverTimestamp(),
        lastStatus: 'error',
        lastDurationMs: Date.now() - start,
        lastError: err instanceof Error ? err.message : String(err),
        consecutiveErrors: admin.firestore.FieldValue.increment(1),
        runCount: admin.firestore.FieldValue.increment(1),
      }, { merge: true })
      console.error('[fetchTrends] Erro:', err)
      throw err
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
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [instagramToken, instagramAccountId, tvmiranteToken, tvmiranteAccountId, imirantepoliticaToken, imirantepoliticaAccountId, mirantefmToken, mirantefmAccountId, imiranteesporteToken, imiranteesporteAccountId, geglobomaranhaoToken, geglobomaranhaoAccountId, g1maranhaoToken, g1maranhaoAccountId],
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

// ─── Gerador de roteiro para tendências ──────────────────────────────────────

// Padrão editorial obrigatório em todos os roteiros
const EDITORIAL_SYSTEM = `Você é roteirista sênior da Mirante Comunicações, maior grupo de comunicação do Maranhão, afiliada da Rede Globo.

REGRAS INEGOCIÁVEIS — aplicam-se a TODOS os cenários:
1. Imparcialidade absoluta: nunca tome partido, não elogie nem critique políticos, partidos, empresas, times ou pessoas públicas.
2. Linguagem factual: use apenas fatos verificáveis. Atribua afirmações a fontes ("segundo o ministério", "de acordo com a CBF"). Nunca afirme algo como verdade se não for consenso público.
3. Zero adjetivos valorativos sobre pessoas ou instituições: proibido usar "excelente", "terrível", "corrupto", "herói", "símbolo de esperança", "ameaça" e similares.
4. Em temas polêmicos (política, religião, torcidas), apresente ângulos opostos com o mesmo peso e o mesmo número de linhas.
5. Nunca suponha intenções, sentimentos ou motivações de pessoas públicas.
6. O roteiro deve informar o público, nunca mobilizá-lo politicamente.

Formato de saída: apenas o roteiro pronto, sem títulos introdutórios, sem explicações, sem "aqui está o roteiro:".`

const SCRIPT_SCENARIOS: Record<string, { label: string; account: string; instruction: string }> = {
  entretenimento: {
    label: 'Entretenimento',
    account: 'iMirante',
    instruction: `Crie um roteiro de Reels para o Instagram do iMirante (30–45 seg de fala).
Estrutura obrigatória (use os marcadores em colchetes):
[ABERTURA] — gancho que prende a atenção em até 3 segundos, baseado no fato, sem sensacionalismo.
[DESENVOLVIMENTO] — explique o que aconteceu, por que importa, qual o impacto para o público do Maranhão.
[ENCERRAMENTO] — convide o público a comentar ou acompanhar o iMirante. Não direcione a opinião.
Tom: dinâmico e acessível, mas jornalisticamente rigoroso. Pode usar perguntas retóricas para engajamento, desde que neutras. Sem emojis excessivos.`,
  },
  jornalismo: {
    label: 'Jornalismo',
    account: 'iMirante',
    instruction: `Crie um roteiro de Reels jornalístico para o Instagram do iMirante (30–45 seg de fala).
Estrutura obrigatória:
[CABEÇA] — o fato principal em uma frase direta, como uma cabeça de telejornal.
[DESENVOLVIMENTO] — contexto, quem está envolvido, o que aconteceu e quais são os impactos. Se houver lados opostos, cite ambos com equilíbrio.
[ENCERRAMENTO] — próximos passos ou o que o público pode esperar. Finalize informando onde acompanhar mais.
Tom: sóbrio, objetivo, padrão Globo News. Sem adjetivos, sem carga emocional, sem opinião implícita.`,
  },
  esportes: {
    label: 'Esportes',
    account: 'iMirante Esporte',
    instruction: `Crie um roteiro de Reels esportivo para o Instagram do iMirante Esporte (30–40 seg de fala).
Estrutura obrigatória:
[CHAMADA] — o resultado ou o fato esportivo de forma direta e impactante.
[DESENVOLVIMENTO] — dados do jogo ou do atleta, contexto da competição, impacto na tabela/ranking.
[ENCERRAMENTO] — próximos jogos, desafios ou o que vem aí. Sem torcer por time algum.
Tom: direto e apaixonado pelo esporte, mas imparcial entre times e atletas. Se houver polêmica (doping, VAR, arbitragem), apresente a versão dos dois lados. Conecte ao esporte maranhense quando houver relação real.`,
  },
}

export const generateTrendScript = onDocumentCreated(
  {
    document: 'scriptRequests/{requestId}',
    region: 'southamerica-east1',
    timeoutSeconds: 120,
    memory: '256MiB',
    secrets: [openaiApiKey],
  },
  async (event) => {
    const snap = event.data
    if (!snap) return
    const requestId = event.params.requestId
    const data = snap.data()
    const requestRef = db.collection('scriptRequests').doc(requestId)

    const userRecord = await admin.auth().getUser(data.requestedBy as string).catch(() => null)
    const email = userRecord?.email ?? ''
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      await requestRef.update({ status: 'failed', error: 'Domínio não autorizado' })
      return
    }

    const scenarioKey = data.scenario as string
    const scenario = SCRIPT_SCENARIOS[scenarioKey]
    if (!scenario) {
      await requestRef.update({ status: 'failed', error: 'Cenário inválido' })
      return
    }

    await requestRef.update({ status: 'running' })

    try {
      const apiKey = openaiApiKey.value()
      const trendTitle = data.trendTitle as string
      const newsContext = data.newsContext as string | null

      // Passo 1: por que está em alta (análise neutra e factual)
      const contextPrompt = `Explique de forma objetiva e imparcial por que "${trendTitle}" está em destaque no Brasil neste momento.${newsContext ? `\n\nContexto disponível: ${newsContext}` : ''}

Responda em 4-6 frases em português do Brasil seguindo estas regras:
- Descreva apenas fatos concretos e verificáveis que explicam o aumento de interesse
- Inclua o contexto mais amplo (histórico, político, social, esportivo ou cultural) de forma neutra
- Não opine, não celebre e não condene — nem implicitamente
- Não use frases como "símbolo de", "esperança", "ameaça", "polêmica" como adjetivo
- Se houver lados opostos, mencione ambos brevemente e com o mesmo peso
- Use atribuição quando necessário: "segundo X", "de acordo com Y"`

      const ctxRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: EDITORIAL_SYSTEM },
            { role: 'user', content: contextPrompt },
          ],
          max_tokens: 400,
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!ctxRes.ok) throw new Error(`OpenAI context: HTTP ${ctxRes.status}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctxJson = await ctxRes.json() as any
      const whyTrending = ((ctxJson.choices?.[0]?.message?.content as string) ?? '').trim()

      // Passo 2: roteiro para o cenário escolhido
      const scriptPrompt = `Assunto em destaque: "${trendTitle}"
Contexto factual: ${whyTrending}
Perfil de publicação: ${scenario.account}

${scenario.instruction}`

      const scriptRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: EDITORIAL_SYSTEM },
            { role: 'user', content: scriptPrompt },
          ],
          max_tokens: 900,
          temperature: 0.6,
        }),
        signal: AbortSignal.timeout(45_000),
      })
      if (!scriptRes.ok) throw new Error(`OpenAI script: HTTP ${scriptRes.status}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scriptJson = await scriptRes.json() as any
      const script = ((scriptJson.choices?.[0]?.message?.content as string) ?? '').trim()

      await requestRef.update({
        status: 'completed',
        whyTrending,
        script,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      console.log(`[generateTrendScript] "${trendTitle}" → ${scenarioKey} (by ${email})`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await requestRef.update({ status: 'failed', error: errMsg })
      console.error('[generateTrendScript] Erro:', err)
    }
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
    secrets: [instagramToken, instagramAccountId, tvmiranteToken, tvmiranteAccountId, imirantepoliticaToken, imirantepoliticaAccountId, mirantefmToken, mirantefmAccountId, imiranteesporteToken, imiranteesporteAccountId, geglobomaranhaoToken, geglobomaranhaoAccountId, g1maranhaoToken, g1maranhaoAccountId],
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
