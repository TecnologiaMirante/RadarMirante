import OpenAI from 'openai'
import type { EditorialAnalysis, RadarPost, RadarSnapshot } from '../types/radar'
import { EDITORIAL_RADAR_SYSTEM_PROMPT } from './prompts/editorialRadar'
import { EDITORIAL_ANALYSIS_JSON_SCHEMA, validateAnalysis } from './schemas'
import { sampleComments, formatCommentsForAI } from '../radar/sampling'

export interface AnalysisInput {
  post: RadarPost & { id: string }
  snapshots: RadarSnapshot[]
  trendScore: number
  baselineComparison: number
  comments: import('../types/radar').RadarComment[]
}

function getOpenAI(apiKey: string): OpenAI {
  return new OpenAI({ apiKey: apiKey.trim() })
}

function buildUserPrompt(input: AnalysisInput, formattedComments: string): string {
  const post = input.post
  const lastSnap = input.snapshots.at(-1)
  const velocity = lastSnap?.commentVelocity.toFixed(2) ?? '?'
  const acceleration = lastSnap?.acceleration.toFixed(2) ?? '?'

  return `
PUBLICAÇÃO ANALISADA
Plataforma: ${post.platform}
URL: ${post.url}
${post.title ? `Título: ${post.title}` : ''}
Publicado em: ${post.publishedAt.toDate().toISOString()}
Texto: ${post.text.slice(0, 500)}${post.text.length > 500 ? '...' : ''}

MÉTRICAS ATUAIS
- Comentários totais: ${post.metrics.comments}
- Curtidas: ${post.metrics.likes}
- Compartilhamentos: ${post.metrics.shares}
${post.metrics.views ? `- Visualizações: ${post.metrics.views}` : ''}

SINAIS DE ENGAJAMENTO
- Trend Score: ${input.trendScore}/100
- Crescimento acima do baseline: +${Math.round(input.baselineComparison)}%
- Velocidade: ${velocity} comentários/minuto
- Aceleração: ${acceleration}

COMENTÁRIOS (amostra representativa de ${input.comments.length} total):

${formattedComments}
`.trim()
}

export async function analyzeTrendingPost(
  input: AnalysisInput,
  apiKey: string,
): Promise<EditorialAnalysis> {
  const sampled = sampleComments(input.comments)
  const formattedComments = formatCommentsForAI(sampled)
  const userPrompt = buildUserPrompt(input, formattedComments)

  const openai = getOpenAI(apiKey)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'editorial_analysis',
        strict: true,
        schema: EDITORIAL_ANALYSIS_JSON_SCHEMA as Record<string, unknown>,
      },
    },
    messages: [
      { role: 'system', content: EDITORIAL_RADAR_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error('OpenAI retornou resposta vazia')

  return validateAnalysis(JSON.parse(raw))
}
