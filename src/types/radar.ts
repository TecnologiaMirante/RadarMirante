import type { Timestamp } from 'firebase/firestore'

// ─── Plataformas ──────────────────────────────────────────────────────────────

export type SocialPlatform = 'imirante' | 'instagram' | 'facebook' | 'youtube' | 'x'

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  imirante: 'Mirante',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  x: 'X (Twitter)',
}

// ─── Post ─────────────────────────────────────────────────────────────────────

export type PostStatus = 'monitoring' | 'candidate' | 'trending' | 'analyzed' | 'archived'

export interface PostMetrics {
  comments: number
  likes: number
  shares: number
  views?: number
  replies?: number
}

export interface RadarPost {
  id: string
  externalId: string
  platform: SocialPlatform
  url: string
  title?: string
  text: string
  contentType?: string
  publishedAt: Timestamp
  collectedAt: Timestamp
  metrics: PostMetrics
  status: PostStatus
  trendScore: number
  trendConfidence: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Comment ──────────────────────────────────────────────────────────────────

export interface RadarComment {
  id: string
  externalId: string
  postId: string
  platform: SocialPlatform
  text: string
  authorHash: string
  likeCount?: number
  replyCount?: number
  publishedAt: Timestamp
  collectedAt: Timestamp
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export interface RadarSnapshot {
  id: string
  postId: string
  timestamp: Timestamp

  // Métricas totais no momento
  comments: number
  likes: number
  shares: number
  views?: number

  // Janelas de tempo
  comments15m: number
  comments60m: number

  uniqueAuthors15m: number
  uniqueAuthors60m: number

  // Velocidade (comentários por minuto)
  commentVelocity: number

  // Aceleração (variação da velocidade)
  acceleration: number
}

// ─── Baseline ─────────────────────────────────────────────────────────────────

export type BaselineBucket =
  | '0-30m'
  | '30-120m'
  | '2-6h'
  | '6-24h'
  | '1-3d'

export interface BaselineStats {
  bucket: BaselineBucket
  platform: SocialPlatform
  contentType?: string
  sampleSize: number
  mean: number
  median: number
  p75: number
  p90: number
  p95: number
  p99: number
  updatedAt: Timestamp
}

// ─── Score (estatístico, sem IA) ──────────────────────────────────────────────

export interface TrendScoreBreakdown {
  anomalyScore: number       // 30%
  velocityScore: number      // 25%
  volumeScore: number        // 15%
  uniqueAuthorsScore: number // 15%
  accelerationScore: number  // 10%
  additionalScore: number    // 5%

  // Penalidades (0 a 1 — multiplicadores redutores)
  spamPenalty: number
  duplicatePenalty: number
  authorConcentrationPenalty: number

  finalScore: number
  confidence: number
}

// ─── Análise Editorial (IA) ───────────────────────────────────────────────────

export type StoryPriority = 'low' | 'medium' | 'high'

export interface TopicCluster {
  topic: string
  summary: string
  estimatedCommentCount: number
  percentage: number
}

export interface ClaimToVerify {
  claim: string
  approximateMentions: number
  context: string
}

export interface StoryIdea {
  headline: string
  angle: string
  whyNow: string
  suggestedSources: string[]
  questionsToAnswer: string[]
  priority: StoryPriority
}

export interface EditorialAnalysis {
  mainTopic: string
  summary: string
  whyTrending: string
  clusters: TopicCluster[]
  audienceQuestions: string[]
  complaints: string[]
  reports: string[]
  claimsToVerify: ClaimToVerify[]
  editorialSignals: string[]
  storyIdeas: StoryIdea[]
  editorialPotential: number
  confidence: number
}

// ─── Analysis Run ─────────────────────────────────────────────────────────────

export type AnalysisRunStatus = 'pending' | 'running' | 'completed' | 'failed'
export type AnalysisTrigger = 'score' | 'growth' | 'cluster' | 'interval' | 'manual'

export interface AnalysisRun {
  id: string
  postId: string
  opportunityId?: string
  status: AnalysisRunStatus
  triggeredBy: AnalysisTrigger
  scoreAtTrigger: number
  commentsAtTrigger: number
  analysis?: EditorialAnalysis
  error?: string
  startedAt?: Timestamp
  finishedAt?: Timestamp
  createdAt: Timestamp
}

// ─── Opportunity ──────────────────────────────────────────────────────────────

export type OpportunityStatus = 'new' | 'reviewing' | 'investigated' | 'published' | 'dismissed'

export interface Opportunity {
  id: string
  postId: string
  platform: SocialPlatform
  postUrl: string
  postTitle?: string

  // Dados da análise
  mainTopic: string
  summary: string
  whyTrending: string
  clusters: TopicCluster[]
  audienceQuestions: string[]
  complaints: string[]
  reports: string[]
  claimsToVerify: ClaimToVerify[]
  editorialSignals: string[]
  storyIdeas: StoryIdea[]

  // Scores
  trendScore: number
  trendConfidence: number
  editorialPotential: number
  analysisConfidence: number

  // Métricas no momento da análise
  commentsAtAnalysis: number
  metricsAtAnalysis: PostMetrics
  baselineComparison: number // percentual acima do baseline

  status: OpportunityStatus
  createdAt: Timestamp
  updatedAt: Timestamp
  lastAnalysisAt: Timestamp
}

// ─── Analysis Request (fila via Firestore) ────────────────────────────────────

export type AnalysisRequestStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AnalysisRequest {
  id: string
  postId: string
  requestedBy: string
  status: AnalysisRequestStatus
  opportunityId?: string
  error?: string
  createdAt: Timestamp
  updatedAt?: Timestamp
}

// ─── Editorial Feedback ───────────────────────────────────────────────────────

export interface EditorialFeedback {
  id: string
  opportunityId: string
  userId: string
  useful: boolean
  reason?: string
  createdAt: Timestamp
}

// ─── Platform Config ──────────────────────────────────────────────────────────

export interface PlatformConfig {
  id: SocialPlatform
  enabled: boolean
  collectionIntervalMinutes: number
  maxPostsPerCollection: number
  requiresAuth: boolean
  lastCollectedAt?: Timestamp
  updatedAt: Timestamp
}

// ─── Filtros e UI ─────────────────────────────────────────────────────────────

export type PlatformFilter = 'all' | SocialPlatform

export type TimeFilter = 'now' | '3h' | '6h' | '24h' | '2d' | '3d' | '7d' | '15d' | '30d' | 'all'

export type SortOption = 'score' | 'recent' | 'growth' | 'comments'

export interface RadarFilters {
  platform: PlatformFilter
  time: TimeFilter
  sort: SortOption
}
