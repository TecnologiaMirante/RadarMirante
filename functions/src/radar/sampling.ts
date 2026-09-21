import type { RadarComment } from '../types/radar'
import { RADAR_CONFIG } from '../config/radar'

// ─── Sampling de comentários para IA ─────────────────────────────────────────
// Seleciona os comentários mais representativos para enviar à análise.
// Respeita o limite de RADAR_CONFIG.analysis.maxCommentsPerAnalysis.

const MAX = RADAR_CONFIG.analysis.maxCommentsPerAnalysis

export function sampleComments(comments: RadarComment[]): RadarComment[] {
  if (comments.length <= MAX) return comments

  // Estratégia: combina recentes + engajados + diversidade de autores
  const sorted = [...comments].sort(
    (a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0),
  )

  // 40% mais curtidos
  const topEngaged = sorted.slice(0, Math.floor(MAX * 0.4))

  // 30% mais recentes (excluindo já selecionados)
  const topEngagedIds = new Set(topEngaged.map((c) => c.id))
  const recent = comments
    .filter((c) => !topEngagedIds.has(c.id))
    .sort((a, b) => b.publishedAt.toMillis() - a.publishedAt.toMillis())
    .slice(0, Math.floor(MAX * 0.3))

  // 30% aleatório com diversidade de autores (excluindo já selecionados)
  const selectedIds = new Set([...topEngaged.map((c) => c.id), ...recent.map((c) => c.id)])
  const selectedAuthors = new Set([
    ...topEngaged.map((c) => c.authorHash),
    ...recent.map((c) => c.authorHash),
  ])

  const remaining = comments
    .filter((c) => !selectedIds.has(c.id) && !selectedAuthors.has(c.authorHash))
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(MAX * 0.3))

  return [...topEngaged, ...recent, ...remaining]
}

export function formatCommentsForAI(comments: RadarComment[]): string {
  return comments
    .map((c, i) => {
      const date = c.publishedAt.toDate().toISOString().slice(0, 16)
      const likes = c.likeCount ? ` [${c.likeCount} curtidas]` : ''
      return `[${i + 1}] ${date}${likes}\n${c.text}`
    })
    .join('\n\n')
}
