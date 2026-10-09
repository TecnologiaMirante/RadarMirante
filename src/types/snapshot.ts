import type { Timestamp } from 'firebase/firestore'

export interface TopicCount {
  topic: string
  count: number
}

export interface AccountSnapshot {
  accountId: string
  displayName: string
  color: string

  // Perfil
  followersCount: number
  followsCount: number
  mediaCount: number

  // Insights 30 dias (soma dos valores diários)
  impressions30d: number
  reach30d: number
  profileViews30d: number
  websiteClicks30d: number
  followerGain30d: number
  accountsEngaged30d: number
  totalInteractions30d: number
  engagementRate30d: number // accountsEngaged / reach * 100

  // Breakdowns do aggregateInsights/last30d
  viewsByFollowType: Record<string, number>
  viewsByMediaType: Record<string, number>
  reachByFollowType: Record<string, number>
  interactionsByMediaType: Record<string, number>

  // Posts monitorados (todos os tempos)
  totalPostsMonitored: number
  viralPostsCount: number      // trendScore >= 65
  viralRate: number            // viralPosts / totalPosts * 100
  totalComments: number
  totalLikes: number
  totalShares: number
  totalSaves: number
  totalPlays: number
  avgCommentsPerPost: number
  avgLikesPerPost: number

  // Velocidade de viralização: distribuição de posts virais por bucket de idade
  viralVelocityBuckets: Record<string, number> // '<6h' | '6-24h' | '1-3d' | '3-7d' | '7+d' -> count

  // Horário de pico de publicação de posts virais
  peakViralHour: number | null
  peakViralHourDistribution: Record<string, number> // '0'-'23' -> count

  // Consistência: % de semanas monitoradas com pelo menos 1 post viral
  consistencyScore: number | null // 0-100
  weeksMonitored: number

  // Temas principais das oportunidades
  topTopics: TopicCount[]

  // IA
  totalOpportunities: number

  // Melhor post
  bestPostId: string | null
  bestPostScore: number | null
  bestPostUrl: string | null
}

export interface PerformanceSnapshot {
  id: string
  capturedAt: Timestamp
  capturedBy: string
  capturedByEmail: string
  note: string
  accounts: Record<string, AccountSnapshot>
}
