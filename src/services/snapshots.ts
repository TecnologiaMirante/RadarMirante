import {
  collection, addDoc, getDocs, query,
  where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import type { Timestamp as FireTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { getInstagramProfile, getInstagramInsights, getInstagramAggregateInsights } from '@/services/instagram'
import type { PerformanceSnapshot, AccountSnapshot, TopicCount } from '@/types/snapshot'
import type { RadarAccountConfig } from '@/contexts/AccountContext'
import type { RadarPost, Opportunity } from '@/types/radar'
import { RADAR_CONFIG } from '@/config/radar'

const VIRAL_THRESHOLD = RADAR_CONFIG.trend.aiThreshold

async function getPostsForAccount(accountId: string): Promise<RadarPost[]> {
  const constraints = [where('platform', '==', 'instagram')]
  if (accountId !== 'imirante') {
    constraints.push(where('account', '==', accountId))
  }
  const snap = await getDocs(query(collection(db, 'posts'), ...constraints))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as RadarPost))
}

async function getOpportunitiesForAccount(accountId: string): Promise<Opportunity[]> {
  const constraints: ReturnType<typeof where>[] = []
  if (accountId !== 'imirante') {
    constraints.push(where('account', '==', accountId))
  }
  const snap = await getDocs(query(collection(db, 'opportunities'), ...constraints))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Opportunity))
}

async function captureAccountSnapshot(
  account: RadarAccountConfig,
  capturedAt: Date,
): Promise<AccountSnapshot> {
  const { id: accountId } = account

  const [profile, insights30, agg30, posts, opportunities] = await Promise.all([
    getInstagramProfile(accountId).catch(() => null),
    getInstagramInsights(30, accountId).catch(() => []),
    getInstagramAggregateInsights(accountId, 30).catch(() => null),
    getPostsForAccount(accountId).catch(() => []),
    getOpportunitiesForAccount(accountId).catch(() => []),
  ])

  const followersCount = profile?.followersCount ?? 0
  const followsCount = profile?.followsCount ?? 0
  const mediaCount = profile?.mediaCount ?? 0

  let impressions30d = 0, reach30d = 0, profileViews30d = 0, websiteClicks30d = 0
  let followerGain30d = 0, accountsEngaged30d = 0, totalInteractions30d = 0
  for (const day of insights30) {
    impressions30d += day.impressions ?? 0
    reach30d += day.reach ?? 0
    profileViews30d += day.profileViews ?? 0
    websiteClicks30d += day.websiteClicks ?? 0
    followerGain30d += day.followerGain ?? 0
    accountsEngaged30d += day.accountsEngaged ?? 0
    totalInteractions30d += day.totalInteractions ?? 0
  }
  const engagementRate30d = reach30d > 0 ? (accountsEngaged30d / reach30d) * 100 : 0

  const viewsByFollowType = agg30?.viewsByFollowType ?? {}
  const viewsByMediaType = agg30?.viewsByMediaType ?? {}
  const reachByFollowType = agg30?.reachByFollowType ?? {}
  const interactionsByMediaType = agg30?.interactionsByMediaType ?? {}

  const instagramPosts = posts.filter(p => p.platform === 'instagram')
  const viralPosts = instagramPosts.filter(p => p.trendScore >= VIRAL_THRESHOLD)

  let totalComments = 0, totalLikes = 0, totalShares = 0, totalSaves = 0, totalPlays = 0
  for (const post of instagramPosts) {
    totalComments += post.metrics.comments ?? 0
    totalLikes += post.metrics.likes ?? 0
    totalShares += post.metrics.shares ?? 0
    totalSaves += post.insights?.saved ?? 0
    totalPlays += post.insights?.plays ?? 0
  }

  const totalPostsMonitored = instagramPosts.length
  const viralPostsCount = viralPosts.length
  const viralRate = totalPostsMonitored > 0 ? (viralPostsCount / totalPostsMonitored) * 100 : 0
  const avgCommentsPerPost = totalPostsMonitored > 0 ? totalComments / totalPostsMonitored : 0
  const avgLikesPerPost = totalPostsMonitored > 0 ? totalLikes / totalPostsMonitored : 0

  // Velocidade: distribui posts virais por bucket de idade na captura
  const velocityBuckets: Record<string, number> = {
    '<6h': 0, '6-24h': 0, '1-3d': 0, '3-7d': 0, '7+d': 0,
  }
  for (const post of viralPosts) {
    const publishedMs = (post.publishedAt as unknown as FireTimestamp)?.toMillis?.()
    if (!publishedMs) continue
    const hoursOld = (capturedAt.getTime() - publishedMs) / (1000 * 60 * 60)
    if (hoursOld < 6) velocityBuckets['<6h']++
    else if (hoursOld < 24) velocityBuckets['6-24h']++
    else if (hoursOld < 72) velocityBuckets['1-3d']++
    else if (hoursOld < 168) velocityBuckets['3-7d']++
    else velocityBuckets['7+d']++
  }

  // Horário de pico
  const hourDist: Record<string, number> = {}
  let peakViralHour: number | null = null
  let peakCount = 0
  for (const post of viralPosts) {
    const publishedMs = (post.publishedAt as unknown as FireTimestamp)?.toMillis?.()
    if (!publishedMs) continue
    const hour = new Date(publishedMs).getHours()
    const k = String(hour)
    hourDist[k] = (hourDist[k] ?? 0) + 1
    if (hourDist[k] > peakCount) { peakViralHour = hour; peakCount = hourDist[k] }
  }

  // Consistência
  let consistencyScore: number | null = null
  let weeksMonitored = 0
  if (account.collectingSince) {
    const startMs = new Date(account.collectingSince).getTime()
    const totalMs = capturedAt.getTime() - startMs
    // +1 porque o bucket da semana atual também conta
    weeksMonitored = Math.floor(totalMs / (7 * 24 * 60 * 60 * 1000)) + 1
    if (viralPosts.length > 0) {
      const weeksWithViral = new Set<number>()
      for (const post of viralPosts) {
        const ms = (post.publishedAt as unknown as FireTimestamp)?.toMillis?.()
        if (ms && ms >= startMs) {
          weeksWithViral.add(Math.floor((ms - startMs) / (7 * 24 * 60 * 60 * 1000)))
        }
      }
      consistencyScore = Math.min(100, Math.round((weeksWithViral.size / weeksMonitored) * 100))
    } else {
      consistencyScore = 0
    }
  }

  // Temas — usa clusters (categorias) em vez de mainTopic (título livre)
  const topicCounts: Record<string, number> = {}
  for (const opp of opportunities) {
    if (opp.clusters && opp.clusters.length > 0) {
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
    if (bestPostScore === null || post.trendScore > bestPostScore) {
      bestPostScore = post.trendScore
      bestPostId = post.id
      bestPostUrl = post.url
    }
  }

  return {
    accountId,
    displayName: account.displayName,
    color: account.color,
    followersCount,
    followsCount,
    mediaCount,
    impressions30d,
    reach30d,
    profileViews30d,
    websiteClicks30d,
    followerGain30d,
    accountsEngaged30d,
    totalInteractions30d,
    engagementRate30d,
    viewsByFollowType,
    viewsByMediaType,
    reachByFollowType,
    interactionsByMediaType,
    totalPostsMonitored,
    viralPostsCount,
    viralRate,
    totalComments,
    totalLikes,
    totalShares,
    totalSaves,
    totalPlays,
    avgCommentsPerPost,
    avgLikesPerPost,
    viralVelocityBuckets: velocityBuckets,
    peakViralHour,
    peakViralHourDistribution: hourDist,
    consistencyScore,
    weeksMonitored,
    topTopics,
    totalOpportunities: opportunities.length,
    bestPostId,
    bestPostScore,
    bestPostUrl,
  }
}

export async function captureSnapshot(
  allAccounts: RadarAccountConfig[],
  user: { uid: string; email: string | null },
  note: string,
): Promise<string> {
  const capturedAt = new Date()

  const accountSnapshots = await Promise.all(
    allAccounts.map(acc => captureAccountSnapshot(acc, capturedAt))
  )

  const accountsMap: Record<string, AccountSnapshot> = {}
  for (const snap of accountSnapshots) {
    accountsMap[snap.accountId] = snap
  }

  const docRef = await addDoc(collection(db, 'performanceSnapshots'), {
    capturedAt: serverTimestamp(),
    capturedBy: user.uid,
    capturedByEmail: user.email ?? '',
    note,
    type: 'manual' as const,
    accounts: accountsMap,
  })

  return docRef.id
}

export async function getSnapshots(): Promise<PerformanceSnapshot[]> {
  const snap = await getDocs(
    query(collection(db, 'performanceSnapshots'), orderBy('capturedAt', 'desc'))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PerformanceSnapshot))
}
