import { z } from 'zod'
import type { EditorialAnalysis, ViralAnalysis } from '../types/radar'

// ─── Schema Zod para validação do output da IA ────────────────────────────────
// Implementação completa na ETAPA 7.

const TopicClusterSchema = z.object({
  topic: z.string().min(1),
  summary: z.string().min(1),
  estimatedCommentCount: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
})

const ClaimToVerifySchema = z.object({
  claim: z.string().min(1),
  approximateMentions: z.number().int().min(1),
  context: z.string().min(1),
})

const StoryIdeaSchema = z.object({
  headline: z.string().min(1),
  angle: z.string().min(1),
  whyNow: z.string().min(1),
  suggestedSources: z.array(z.string()).min(1),
  questionsToAnswer: z.array(z.string()).min(1),
  priority: z.enum(['low', 'medium', 'high']),
})

export const EditorialAnalysisSchema = z.object({
  mainTopic: z.string().min(1),
  summary: z.string().min(1),
  whyTrending: z.string().min(1),
  clusters: z.array(TopicClusterSchema).min(1),
  audienceQuestions: z.array(z.string()),
  complaints: z.array(z.string()),
  reports: z.array(z.string()),
  claimsToVerify: z.array(ClaimToVerifySchema),
  editorialSignals: z.array(z.string()),
  storyIdeas: z.array(StoryIdeaSchema),
  editorialPotential: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
})

export type ValidatedEditorialAnalysis = z.infer<typeof EditorialAnalysisSchema>

// ─── Schema Viral ─────────────────────────────────────────────────────────────

const ContentIdeaSchema = z.object({
  concept: z.string().min(1),
  format: z.string().min(1),
  rationale: z.string().min(1),
  urgency: z.enum(['now', 'this_week', 'monitor']),
})

export const ViralAnalysisSchema = z.object({
  mainTopic: z.string().min(1),
  summary: z.string().min(1),
  whyTrending: z.string().min(1),
  clusters: z.array(TopicClusterSchema).min(1),
  emotionalTriggers: z.array(z.string()),
  contentInsights: z.array(z.string()),
  audienceSignals: z.array(z.string()),
  contentRecommendations: z.array(ContentIdeaSchema),
  viralPotential: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
})

export type ValidatedViralAnalysis = z.infer<typeof ViralAnalysisSchema>

export const VIRAL_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    mainTopic: { type: 'string' },
    summary: { type: 'string' },
    whyTrending: { type: 'string' },
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          summary: { type: 'string' },
          estimatedCommentCount: { type: 'integer' },
          percentage: { type: 'number' },
        },
        required: ['topic', 'summary', 'estimatedCommentCount', 'percentage'],
        additionalProperties: false,
      },
    },
    emotionalTriggers: { type: 'array', items: { type: 'string' } },
    contentInsights: { type: 'array', items: { type: 'string' } },
    audienceSignals: { type: 'array', items: { type: 'string' } },
    contentRecommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          concept: { type: 'string' },
          format: { type: 'string' },
          rationale: { type: 'string' },
          urgency: { type: 'string', enum: ['now', 'this_week', 'monitor'] },
        },
        required: ['concept', 'format', 'rationale', 'urgency'],
        additionalProperties: false,
      },
    },
    viralPotential: { type: 'number' },
    confidence: { type: 'number' },
  },
  required: [
    'mainTopic', 'summary', 'whyTrending', 'clusters',
    'emotionalTriggers', 'contentInsights', 'audienceSignals',
    'contentRecommendations', 'viralPotential', 'confidence',
  ],
  additionalProperties: false,
} as const

export function validateViralAnalysis(data: unknown): ViralAnalysis {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.confidence === 'number' && d.confidence > 1) d.confidence = d.confidence / 100
    if (typeof d.viralPotential === 'number' && d.viralPotential > 100) d.viralPotential = 100
  }
  return ViralAnalysisSchema.parse(data) as ViralAnalysis
}

// ─── validateAnalysis (editorial) ────────────────────────────────────────────

export function validateAnalysis(data: unknown): EditorialAnalysis {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.confidence === 'number' && d.confidence > 1) d.confidence = d.confidence / 100
    if (typeof d.editorialPotential === 'number' && d.editorialPotential > 100) d.editorialPotential = 100
  }
  return EditorialAnalysisSchema.parse(data) as EditorialAnalysis
}

// JSON Schema para OpenAI Structured Outputs
export const EDITORIAL_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    mainTopic: { type: 'string' },
    summary: { type: 'string' },
    whyTrending: { type: 'string' },
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          summary: { type: 'string' },
          estimatedCommentCount: { type: 'integer' },
          percentage: { type: 'number' },
        },
        required: ['topic', 'summary', 'estimatedCommentCount', 'percentage'],
        additionalProperties: false,
      },
    },
    audienceQuestions: { type: 'array', items: { type: 'string' } },
    complaints: { type: 'array', items: { type: 'string' } },
    reports: { type: 'array', items: { type: 'string' } },
    claimsToVerify: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          approximateMentions: { type: 'integer' },
          context: { type: 'string' },
        },
        required: ['claim', 'approximateMentions', 'context'],
        additionalProperties: false,
      },
    },
    editorialSignals: { type: 'array', items: { type: 'string' } },
    storyIdeas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          angle: { type: 'string' },
          whyNow: { type: 'string' },
          suggestedSources: { type: 'array', items: { type: 'string' } },
          questionsToAnswer: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['headline', 'angle', 'whyNow', 'suggestedSources', 'questionsToAnswer', 'priority'],
        additionalProperties: false,
      },
    },
    editorialPotential: { type: 'number' },
    confidence: { type: 'number' },
  },
  required: [
    'mainTopic', 'summary', 'whyTrending', 'clusters',
    'audienceQuestions', 'complaints', 'reports', 'claimsToVerify',
    'editorialSignals', 'storyIdeas', 'editorialPotential', 'confidence',
  ],
  additionalProperties: false,
} as const
