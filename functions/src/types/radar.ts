import type { firestore } from 'firebase-admin'

type Timestamp = firestore.Timestamp

// ─── Plataformas e perfis de conta ───────────────────────────────────────────

export type SocialPlatform = 'imirante' | 'instagram' | 'facebook' | 'youtube' | 'x'

// Perfil determina qual prompt de IA e qual schema de análise usar
export type AccountProfile = 'editorial' | 'viral'

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
  account: string          // ID interno da conta (ex: 'imirante', 'tvmirante')
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
  comments: number
  likes: number
  shares: number
  views?: number
  comments15m: number
  comments60m: number
  uniqueAuthors15m: number
  uniqueAuthors60m: number
  commentVelocity: number
  acceleration: number
}

// ─── Baseline ─────────────────────────────────────────────────────────────────

export type BaselineBucket = '0-30m' | '30-120m' | '2-6h' | '6-24h' | '1-3d'

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

// ─── Score ────────────────────────────────────────────────────────────────────

export interface TrendScoreBreakdown {
  anomalyScore: number
  velocityScore: number
  volumeScore: number
  uniqueAuthorsScore: number
  accelerationScore: number
  additionalScore: number
  spamPenalty: number
  duplicatePenalty: number
  authorConcentrationPenalty: number
  finalScore: number
  confidence: number
}

// ─── Análises ─────────────────────────────────────────────────────────────────

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

// ─── Análise Viral (perfil: entretenimento/TV) ────────────────────────────────

export type ContentUrgency = 'now' | 'this_week' | 'monitor'

export interface ContentIdea {
  concept: string
  format: string       // ex: "Reel", "Stories", "Post estático"
  rationale: string
  urgency: ContentUrgency
}

export interface ViralAnalysis {
  mainTopic: string
  summary: string
  whyTrending: string
  clusters: TopicCluster[]
  emotionalTriggers: string[]       // emoções que movem o engajamento
  contentInsights: string[]         // o que está funcionando no conteúdo
  audienceSignals: string[]         // o que a audiência quer ver mais
  contentRecommendations: ContentIdea[]
  viralPotential: number            // 0–100
  confidence: number                // 0–1
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
  analysis?: EditorialAnalysis | ViralAnalysis
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
  account: string
  profile: AccountProfile
  platform: SocialPlatform
  postUrl: string
  postTitle?: string
  mainTopic: string
  summary: string
  whyTrending: string
  clusters: TopicCluster[]
  trendScore: number
  trendConfidence: number
  analysisConfidence: number
  commentsAtAnalysis: number
  metricsAtAnalysis: PostMetrics
  baselineComparison: number
  status: OpportunityStatus
  createdAt: Timestamp
  updatedAt: Timestamp
  lastAnalysisAt: Timestamp
  // Campos exclusivos do perfil editorial
  audienceQuestions?: string[]
  complaints?: string[]
  reports?: string[]
  claimsToVerify?: ClaimToVerify[]
  editorialSignals?: string[]
  storyIdeas?: StoryIdea[]
  editorialPotential?: number
  // Campos exclusivos do perfil viral
  emotionalTriggers?: string[]
  contentInsights?: string[]
  audienceSignals?: string[]
  contentRecommendations?: ContentIdea[]
  viralPotential?: number
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

