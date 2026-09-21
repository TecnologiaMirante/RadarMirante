import { cn } from '@/lib/utils'
import { InfoTip } from '@/components/ui/InfoTip'

interface ScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showInfo?: boolean
  className?: string
}

function getScoreClass(score: number) {
  if (score >= 80) return 'score-critical'
  if (score >= 65) return 'score-high'
  if (score >= 40) return 'score-medium'
  return 'score-low'
}

function getScoreEmoji(score: number) {
  if (score >= 80) return '🔥'
  if (score >= 65) return '📈'
  if (score >= 40) return '👀'
  return '📊'
}

export function ScoreBadge({ score, size = 'md', showInfo = false, className }: ScoreBadgeProps) {
  const sizeClass = {
    sm: 'text-sm px-2 py-0.5',
    md: 'text-base px-3 py-1',
    lg: 'text-2xl px-4 py-2',
  }[size]

  const badge = (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-bold tabular-nums',
        getScoreClass(score),
        sizeClass,
        className,
      )}
    >
      <span className="text-base leading-none">{getScoreEmoji(score)}</span>
      <span>{score}</span>
    </div>
  )

  if (!showInfo) return badge

  return (
    <div className="inline-flex items-center gap-1">
      {badge}
      <InfoTip side="bottom">
        <p className="font-semibold text-foreground mb-1.5">Trend Score (0–100)</p>
        <p className="text-muted-foreground mb-2">
          Mede o quão relevante e em alta uma publicação está com base em dados estatísticos — sem IA.
        </p>
        <div className="space-y-1 mb-2">
          <p><strong className="text-foreground">🔥 80+</strong> — Viral. Alta prioridade editorial.</p>
          <p><strong className="text-foreground">📈 65–79</strong> — Em alta. Monitorar de perto.</p>
          <p><strong className="text-foreground">👀 40–64</strong> — Candidato. Crescimento acima do normal.</p>
          <p><strong className="text-foreground">📊 0–39</strong> — Monitorando. Volume baixo.</p>
        </div>
        <p className="text-muted-foreground border-t border-border pt-1.5 mt-1.5">
          Calculado a partir de: velocidade de comentários, aceleração, volume, diversidade de autores e comparação com histórico similar.
        </p>
      </InfoTip>
    </div>
  )
}
