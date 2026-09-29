import type { TrendScoreBreakdown } from '../types/radar'
import { RADAR_CONFIG } from '../config/radar'

// ─── Trend Score Estatístico ──────────────────────────────────────────────────
// Calculado ANTES da IA. A IA só é acionada se o score atingir o threshold.
// Escala: 0–100

const W = RADAR_CONFIG.score.weights

export interface ScoreInput {
  // Dados do snapshot atual
  commentVelocity: number     // comentários/minuto
  acceleration: number        // variação da velocidade
  commentCount: number        // total de comentários
  uniqueAuthors15m: number    // autores únicos nos últimos 15min
  likesCount?: number         // total de curtidas/reações

  // Baseline (percentil do bucket correspondente)
  baselineP90: number         // P90 de comentários para posts similares
  baselineP75: number

  // Penalidades
  spamRatio: number           // 0–1 (fração de possível spam)
  duplicateRatio: number      // 0–1 (fração de comentários duplicados)
  authorConcentration: number // 0–1 (concentração em poucos autores)

  // Tetos por perfil de conta (omitir = usar defaults do perfil editorial)
  commentCeiling?: number     // comentários para atingir score máximo (default 300)
  velocityMax?: number        // comentários/min para score máximo (default 2)
  uniqueAuthorMax?: number    // autores únicos em 15min para score máximo (default 20)
}

export function calculateAnomalyScore(input: ScoreInput): number {
  const ceiling = input.commentCeiling ?? 300
  if (input.baselineP90 === 0) {
    const volScore = Math.min(100, (Math.log10(input.commentCount + 1) / Math.log10(ceiling + 1)) * 100)
    const velScore = calculateVelocityScore(input.commentVelocity, input.velocityMax)
    return Math.min(100, volScore * 0.6 + velScore * 0.4)
  }
  const ratio = input.commentCount / input.baselineP90
  return Math.min(100, (ratio - 1) * 50)
}

export function calculateVelocityScore(commentVelocity: number, velocityMax = 2): number {
  if (commentVelocity <= 0) return 0
  return Math.min(100, Math.sqrt(commentVelocity / velocityMax) * 100)
}

export function calculateLikesScore(likesCount: number): number {
  // 500 likes→65, 1k→75, 3k→87, 10k→100
  if (likesCount <= 0) return 0
  return Math.min(100, (Math.log10(likesCount + 1) / Math.log10(10001)) * 100)
}

export function calculateVolumeScore(commentCount: number, baselineP75: number): number {
  if (baselineP75 === 0) return Math.min(100, commentCount * 2)
  const ratio = commentCount / baselineP75
  return Math.min(100, ratio * 25)
}

export function calculateUniqueAuthorsScore(uniqueAuthors15m: number, uniqueAuthorMax = 20): number {
  return Math.min(100, (uniqueAuthors15m / uniqueAuthorMax) * 100)
}

export function calculateAccelerationScore(acceleration: number): number {
  // Aceleração positiva = crescimento acelerando
  if (acceleration <= 0) return 0
  return Math.min(100, acceleration * 20)
}

export function applyPenalties(
  rawScore: number,
  spamPenalty: number,
  duplicatePenalty: number,
  authorConcentrationPenalty: number,
): number {
  const totalPenalty = Math.min(
    0.7,
    spamPenalty + duplicatePenalty + authorConcentrationPenalty,
  )
  return rawScore * (1 - totalPenalty)
}

// Quando não há baseline nem atividade recente (post histórico), o score
// baseado em velocidade/anomalia é sempre ~0. Nesse caso usamos escala
// logarítmica do volume total: 10 coment→30, 100→67, 500→90, 1000→100.
function calculateEngagementFallback(commentCount: number, likesCount = 0, ceiling = 300): number {
  if (commentCount <= 0 && likesCount <= 0) return 0
  // Likes só potencializam posts que já têm comentários — sem comentários, score é baixo
  const likesBonus = commentCount > 0 ? Math.floor(likesCount / 15) : 0
  const combined = commentCount + likesBonus
  return Math.min(100, (Math.log10(combined + 1) / Math.log10(ceiling + 1)) * 100)
}

export function calculateStatisticalTrendScore(input: ScoreInput): TrendScoreBreakdown {
  const anomalyScore = Math.max(0, calculateAnomalyScore(input))
  const velocityScore = calculateVelocityScore(input.commentVelocity, input.velocityMax)
  const volumeScore = calculateVolumeScore(input.commentCount, input.baselineP75)
  const uniqueAuthorsScore = calculateUniqueAuthorsScore(input.uniqueAuthors15m, input.uniqueAuthorMax)
  const accelerationScore = calculateAccelerationScore(input.acceleration)
  const additionalScore = calculateLikesScore(input.likesCount ?? 0)

  const hasRealtime = input.commentVelocity > 0.05 || input.uniqueAuthors15m > 0
  const hasBaseline = input.baselineP90 > 0

  // Sem baseline e sem atividade recente: score de engajamento histórico puro.
  // Evita que todos os posts históricos travem em ~15.
  if (!hasBaseline && !hasRealtime) {
    const engagementScore = calculateEngagementFallback(input.commentCount, input.likesCount ?? 0, input.commentCeiling)
    const spamPenalty = Math.min(RADAR_CONFIG.score.maxSpamPenalty, input.spamRatio * RADAR_CONFIG.score.maxSpamPenalty)
    const duplicatePenalty = Math.min(RADAR_CONFIG.score.maxDuplicatePenalty, input.duplicateRatio * RADAR_CONFIG.score.maxDuplicatePenalty)
    const authorConcentrationPenalty = Math.min(RADAR_CONFIG.score.maxAuthorConcentrationPenalty, input.authorConcentration * RADAR_CONFIG.score.maxAuthorConcentrationPenalty)
    const finalScore = Math.round(Math.max(0, applyPenalties(engagementScore, spamPenalty, duplicatePenalty, authorConcentrationPenalty)))
    return {
      anomalyScore: 0, velocityScore: 0, volumeScore: engagementScore,
      uniqueAuthorsScore: 0, accelerationScore: 0, additionalScore: 0,
      spamPenalty, duplicatePenalty, authorConcentrationPenalty,
      finalScore, confidence: 0.3,
    }
  }

  const rawScore =
    anomalyScore * W.anomaly +
    velocityScore * W.velocity +
    volumeScore * W.volume +
    uniqueAuthorsScore * W.uniqueAuthors +
    accelerationScore * W.acceleration +
    additionalScore * W.additional

  const spamPenalty = Math.min(
    RADAR_CONFIG.score.maxSpamPenalty,
    input.spamRatio * RADAR_CONFIG.score.maxSpamPenalty,
  )
  const duplicatePenalty = Math.min(
    RADAR_CONFIG.score.maxDuplicatePenalty,
    input.duplicateRatio * RADAR_CONFIG.score.maxDuplicatePenalty,
  )
  const authorConcentrationPenalty = Math.min(
    RADAR_CONFIG.score.maxAuthorConcentrationPenalty,
    input.authorConcentration * RADAR_CONFIG.score.maxAuthorConcentrationPenalty,
  )

  const finalScore = Math.round(
    Math.max(0, applyPenalties(rawScore, spamPenalty, duplicatePenalty, authorConcentrationPenalty)),
  )

  const confidence = hasBaseline ? 0.8 : 0.4

  return {
    anomalyScore,
    velocityScore,
    volumeScore,
    uniqueAuthorsScore,
    accelerationScore,
    additionalScore,
    spamPenalty,
    duplicatePenalty,
    authorConcentrationPenalty,
    finalScore,
    confidence,
  }
}
