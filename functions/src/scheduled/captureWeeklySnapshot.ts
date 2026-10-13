import * as admin from 'firebase-admin'
import type { Firestore } from 'firebase-admin/firestore'

const VIRAL_THRESHOLD = 65
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

interface AccountConfig {
  id: string
  displayName: string
  color: string
  collectingSince?: string
}

interface TopicCount {
  topic: string
  count: number
}

interface AccountSnap {
  accountId: string
  displayName: string
  color: string
  followersCount: number
  followsCount: number
  mediaCount: number
  impressions30d: number
  reach30d: number
  profileViews30d: number
  websiteClicks30d: number
  followerGain30d: number
  accountsEngaged30d: number
  totalInteractions30d: number
  engagementRate30d: number
  viewsByFollowType: Record<string, number>
  viewsByMediaType: Record<string, number>
  reachByFollowType: Record<string, number>
  interactionsByMediaType: Record<string, number>
  totalPostsMonitored: number
  viralPostsCount: number
  viralRate: number
  totalComments: number
  totalLikes: number
  totalShares: number
  totalSaves: number
  totalPlays: number
  avgCommentsPerPost: number
  avgLikesPerPost: number
  viralVelocityBuckets: Record<string, number>
  peakViralHour: number | null
  peakViralHourDistribution: Record<string, number>
  consistencyScore: number | null
  weeksMonitored: number
  topTopics: TopicCount[]
  totalOpportunities: number
  bestPostId: string | null
  bestPostScore: number | null
  bestPostUrl: string | null
}

async function captureAccountSnapshot(
  db: Firestore,
  account: AccountConfig,
  capturedAt: Date,
): Promise<AccountSnap> {
  const { id: accountId } = account

  // Insights desde 30 dias atrás
  const since = new Date(capturedAt)
  since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString().slice(0, 10)

  // Posts: imirante não tem filtro de conta (compat com dados históricos)
  const postsQuery = accountId === 'imirante'
    ? db.collection('posts').where('platform', '==', 'instagram')
    : db.collection('posts').where('platform', '==', 'instagram').where('account', '==', accountId)

  const oppsQuery = accountId === 'imirante'
    ? db.collection('opportunities')
    : db.collection('opportunities').where('account', '==', accountId)

  const [profileDoc, insightsSnap, aggDoc, postsSnap, oppsSnap] = await Promise.all([
    db.doc(`instagramAccount/${accountId}`).get(),
    db.collection(`instagramAccount/${accountId}/insights`)
      .where('date', '>=', sinceStr)
      .orderBy('date', 'asc')
      .get(),
    db.doc(`instagramAccount/${accountId}/aggregateInsights/last30d`).get(),
    postsQuery.get(),
    oppsQuery.get(),
  ])

  const profile = profileDoc.exists ? profileDoc.data()! : {}
  const followersCount: number = profile.followersCount ?? 0
  const followsCount: number = profile.followsCount ?? 0
  const mediaCount: number = profile.mediaCount ?? 0

  let impressions30d = 0, reach30d = 0, profileViews30d = 0, websiteClicks30d = 0
  let followerGain30d = 0, accountsEngaged30d = 0, totalInteractions30d = 0
  for (const d of insightsSnap.docs) {
    const data = d.data()
    impressions30d  += data.impressions     ?? 0
    reach30d        += data.reach           ?? 0
    profileViews30d += data.profileViews    ?? 0
    websiteClicks30d += data.websiteClicks  ?? 0
    followerGain30d += data.followerGain    ?? 0
    accountsEngaged30d  += data.accountsEngaged  ?? 0
    totalInteractions30d += data.totalInteractions ?? 0
  }
  const engagementRate30d = reach30d > 0 ? (accountsEngaged30d / reach30d) * 100 : 0

  const agg = aggDoc.exists ? aggDoc.data()! : {}
  const viewsByFollowType: Record<string, number>     = agg.viewsByFollowType     ?? {}
  const viewsByMediaType: Record<string, number>      = agg.viewsByMediaType      ?? {}
  const reachByFollowType: Record<string, number>     = agg.reachByFollowType     ?? {}
  const interactionsByMediaType: Record<string, number> = agg.interactionsByMediaType ?? {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instagramPosts: any[] = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const viralPosts = instagramPosts.filter(p => (p.trendScore ?? 0) >= VIRAL_THRESHOLD)

  let totalComments = 0, totalLikes = 0, totalShares = 0, totalSaves = 0, totalPlays = 0
  for (const post of instagramPosts) {
    totalComments += post.metrics?.comments ?? 0
    totalLikes    += post.metrics?.likes    ?? 0
    totalShares   += post.metrics?.shares   ?? 0
    totalSaves    += post.insights?.saved   ?? 0
    totalPlays    += post.insights?.plays   ?? 0
  }
  const totalPostsMonitored = instagramPosts.length
  const viralPostsCount = viralPosts.length
  const viralRate = totalPostsMonitored > 0 ? (viralPostsCount / totalPostsMonitored) * 100 : 0
  const avgCommentsPerPost = totalPostsMonitored > 0 ? totalComments / totalPostsMonitored : 0
  const avgLikesPerPost    = totalPostsMonitored > 0 ? totalLikes    / totalPostsMonitored : 0

  // Velocidade de viralização
  const viralVelocityBuckets: Record<string, number> = { '<6h': 0, '6-24h': 0, '1-3d': 0, '3-7d': 0, '7+d': 0 }
  for (const post of viralPosts) {
    const publishedMs = (post.publishedAt as admin.firestore.Timestamp)?.toMillis?.()
    if (!publishedMs) continue
    const hoursOld = (capturedAt.getTime() - publishedMs) / (1000 * 60 * 60)
    if (hoursOld < 6)        viralVelocityBuckets['<6h']++
    else if (hoursOld < 24)  viralVelocityBuckets['6-24h']++
    else if (hoursOld < 72)  viralVelocityBuckets['1-3d']++
    else if (hoursOld < 168) viralVelocityBuckets['3-7d']++
    else                     viralVelocityBuckets['7+d']++
  }

  // Horário de pico
  const peakViralHourDistribution: Record<string, number> = {}
  let peakViralHour: number | null = null
  let peakCount = 0
  for (const post of viralPosts) {
    const publishedMs = (post.publishedAt as admin.firestore.Timestamp)?.toMillis?.()
    if (!publishedMs) continue
    const hour = new Date(publishedMs).getHours()
    const k = String(hour)
    peakViralHourDistribution[k] = (peakViralHourDistribution[k] ?? 0) + 1
    if (peakViralHourDistribution[k] > peakCount) {
      peakViralHour = hour
      peakCount = peakViralHourDistribution[k]
    }
  }

  // Consistência (cap 100%)
  let consistencyScore: number | null = null
  let weeksMonitored = 0
  if (account.collectingSince) {
    const startMs = new Date(account.collectingSince).getTime()
    const totalMs = capturedAt.getTime() - startMs
    weeksMonitored = Math.floor(totalMs / WEEK_MS) + 1
    if (viralPosts.length > 0) {
      const weeksWithViral = new Set<number>()
      for (const post of viralPosts) {
        const ms = (post.publishedAt as admin.firestore.Timestamp)?.toMillis?.()
        if (ms && ms >= startMs) {
          weeksWithViral.add(Math.floor((ms - startMs) / WEEK_MS))
        }
      }
      consistencyScore = Math.min(100, Math.round((weeksWithViral.size / weeksMonitored) * 100))
    } else {
      consistencyScore = 0
    }
  }

  // Temas — usa clusters (categorias) em vez de mainTopic (título livre)
  const topicCounts: Record<string, number> = {}
  for (const oppDoc of oppsSnap.docs) {
    const opp = oppDoc.data()
    if (Array.isArray(opp.clusters) && opp.clusters.length > 0) {
      for (const cluster of opp.clusters) {
        if (cluster.topic) topicCounts[cluster.topic] = (topicCounts[cluster.topic] ?? 0) + 1
      }
    } else if (opp.mainTopic) {
      topicCounts[opp.mainTopic] = (topicCounts[opp.mainTopic] ?? 0) + 1
    }
  }
  const topTopics: TopicCount[] = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }))

  // Melhor post
  let bestPostId: string | null = null
  let bestPostScore: number | null = null
  let bestPostUrl: string | null = null
  for (const post of instagramPosts) {
    const score: number = post.trendScore ?? 0
    if (bestPostScore === null || score > bestPostScore) {
      bestPostScore = score
      bestPostId = post.id
      bestPostUrl = post.url ?? null
    }
  }

  return {
    accountId, displayName: account.displayName, color: account.color,
    followersCount, followsCount, mediaCount,
    impressions30d, reach30d, profileViews30d, websiteClicks30d,
    followerGain30d, accountsEngaged30d, totalInteractions30d, engagementRate30d,
    viewsByFollowType, viewsByMediaType, reachByFollowType, interactionsByMediaType,
    totalPostsMonitored, viralPostsCount, viralRate,
    totalComments, totalLikes, totalShares, totalSaves, totalPlays,
    avgCommentsPerPost, avgLikesPerPost,
    viralVelocityBuckets, peakViralHour, peakViralHourDistribution,
    consistencyScore, weeksMonitored,
    topTopics, totalOpportunities: oppsSnap.size,
    bestPostId, bestPostScore, bestPostUrl,
  }
}

export async function captureWeeklySnapshot(db: Firestore): Promise<void> {
  console.log('[captureWeeklySnapshot] Iniciando captura automática semanal')
  const start = Date.now()

  const accountsSnap = await db.collection('radarAccounts').where('active', '==', true).get()
  const accounts: AccountConfig[] = accountsSnap.docs.map(d => ({
    id: d.id, ...d.data() as Omit<AccountConfig, 'id'>,
  }))

  if (accounts.length === 0) {
    console.warn('[captureWeeklySnapshot] Nenhuma conta ativa em radarAccounts')
    return
  }

  const capturedAt = new Date()
  const results = await Promise.allSettled(
    accounts.map(acc => captureAccountSnapshot(db, acc, capturedAt)),
  )

  const accountsMap: Record<string, AccountSnap> = {}
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      accountsMap[r.value.accountId] = r.value
    } else {
      console.error(`[captureWeeklySnapshot] Erro em ${accounts[i].id}:`, r.reason)
    }
  }

  if (Object.keys(accountsMap).length === 0) {
    console.error('[captureWeeklySnapshot] Nenhuma conta capturada com sucesso — abortando')
    return
  }

  await db.collection('performanceSnapshots').add({
    capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    capturedBy: 'system',
    capturedByEmail: 'sistema@automatico',
    note: 'Captura automática semanal',
    type: 'auto',
    accounts: accountsMap,
  })

  console.log(
    `[captureWeeklySnapshot] Concluído em ${Date.now() - start}ms — ` +
    `${Object.keys(accountsMap).length}/${accounts.length} contas`,
  )
}
