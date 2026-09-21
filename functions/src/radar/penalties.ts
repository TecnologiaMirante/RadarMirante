import type { RadarComment } from '../types/radar'

// ─── Penalidades para reduzir falsos positivos ────────────────────────────────

export interface PenaltyResult {
  spamRatio: number            // 0–1
  duplicateRatio: number       // 0–1
  authorConcentration: number  // 0–1
}

const SPAM_INDICATORS = [
  /^(.)\1{4,}$/,          // caracteres repetidos (aaaaaaa)
  /https?:\/\//,          // links
  /whatsapp|telegram/i,   // chamadas para outros canais
]

const MIN_COMMENT_LENGTH = 3
const MAX_AUTHOR_CONCENTRATION_THRESHOLD = 0.4 // 40% de comentários de um único autor

export function calculatePenalties(comments: RadarComment[]): PenaltyResult {
  if (comments.length === 0) {
    return { spamRatio: 0, duplicateRatio: 0, authorConcentration: 0 }
  }

  const total = comments.length

  // Spam
  const spamCount = comments.filter(isLikelySpam).length
  const spamRatio = spamCount / total

  // Duplicatas (mesmo texto normalizado)
  const normalized = comments.map((c) => normalizeText(c.text))
  const unique = new Set(normalized)
  const duplicateRatio = 1 - unique.size / total

  // Concentração de autores
  const authorCounts = new Map<string, number>()
  for (const comment of comments) {
    authorCounts.set(comment.authorHash, (authorCounts.get(comment.authorHash) ?? 0) + 1)
  }
  const maxCount = Math.max(...authorCounts.values())
  const topAuthorRatio = maxCount / total
  const authorConcentration = Math.min(1, topAuthorRatio / MAX_AUTHOR_CONCENTRATION_THRESHOLD)

  return {
    spamRatio: Math.min(1, spamRatio),
    duplicateRatio: Math.min(1, duplicateRatio),
    authorConcentration: Math.min(1, authorConcentration),
  }
}

function isLikelySpam(comment: RadarComment): boolean {
  const text = comment.text.trim()
  if (text.length < MIN_COMMENT_LENGTH) return true
  return SPAM_INDICATORS.some((pattern) => pattern.test(text))
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}
