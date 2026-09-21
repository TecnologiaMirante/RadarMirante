import { useNavigate } from 'react-router-dom'
import { ExternalLink, MessageCircle, Heart, Eye, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { ScoreBadge } from './ScoreBadge'
import { PlatformBadge } from './PlatformBadge'
import type { RadarPost } from '@/types/radar'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<
  RadarPost['status'],
  { label: string; pill: string; border: string; glow: string; dot?: string }
> = {
  trending: {
    label: 'Repercutindo',
    pill: 'bg-red-500/15 trending-text border border-red-500/40 font-bold',
    border: 'border-l-red-500',
    glow: 'bg-gradient-to-br from-red-500/8 via-transparent to-transparent',
    dot: 'bg-red-500 dot-blink',
  },
  candidate: {
    label: 'Aquecendo',
    pill: 'bg-primary/10 candidate-text border border-primary/30 font-semibold',
    border: 'border-l-primary',
    glow: 'bg-gradient-to-br from-primary/5 via-transparent to-transparent',
    dot: 'bg-primary animate-pulse',
  },
  monitoring: {
    label: 'Monitorando',
    pill: 'bg-secondary/80 text-muted-foreground border border-border/60',
    border: 'border-l-border',
    glow: '',
  },
  analyzed: {
    label: 'Analisado',
    pill: 'bg-green-500/10 text-green-400 border border-green-500/25',
    border: 'border-l-green-500',
    glow: 'bg-gradient-to-br from-green-500/5 via-transparent to-transparent',
  },
  archived: {
    label: 'Arquivado',
    pill: 'bg-secondary text-muted-foreground border border-border',
    border: 'border-l-border',
    glow: '',
  },
}

export function PostCard({ post }: { post: RadarPost }) {
  const navigate = useNavigate()
  const s = STATUS_CONFIG[post.status]
  const isTrending = post.status === 'trending'
  const isCandidate = post.status === 'candidate'

  const publishedAgo = formatDistanceToNow(post.publishedAt.toDate(), {
    addSuffix: true, locale: ptBR,
  })

  const textPreview = post.text.length > 110
    ? post.text.slice(0, 110).trimEnd() + '…'
    : post.text

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 border-l-[3px] relative overflow-hidden group',
        s.border,
        isTrending
          ? 'card-trending-alert hover:shadow-[0_0_24px_-4px_rgba(239,68,68,0.25)]'
          : isCandidate
            ? 'hover:border-primary/70 hover:shadow-[0_0_14px_-4px_rgba(59,130,246,0.18)]'
            : 'hover:border-border/70',
      )}
      onClick={() => navigate(`/radar/post/${post.id}`)}
    >
      {s.glow && <div className={cn('absolute inset-0 pointer-events-none', s.glow)} />}

      <CardContent className="p-4 relative space-y-3">

        {/* Header: platform + external link */}
        <div className="flex items-center justify-between gap-2">
          <PlatformBadge platform={post.platform} />
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground/40 hover:text-primary p-1 -mr-1 -mt-1 rounded transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Text preview */}
        {textPreview ? (
          <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">
            {textPreview}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Sem legenda</p>
        )}

        {/* Footer: score + status + metrics */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ScoreBadge score={post.trendScore} size="sm" />
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border',
              s.pill,
            )}>
              {s.dot && <span className={cn('w-1 h-1 rounded-full flex-shrink-0', s.dot)} />}
              {s.label}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-muted-foreground flex-shrink-0">
            <span className="flex items-center gap-0.5">
              <MessageCircle className="w-3 h-3" />
              <strong className={cn('tabular-nums', isTrending ? 'trending-text' : 'text-foreground')}>
                {post.metrics.comments >= 1000
                  ? `${(post.metrics.comments / 1000).toFixed(1)}k`
                  : post.metrics.comments.toLocaleString('pt-BR')}
              </strong>
            </span>
            <span className="flex items-center gap-0.5">
              <Heart className="w-3 h-3" />
              <strong className="text-foreground/70 tabular-nums">
                {post.metrics.likes >= 1000
                  ? `${(post.metrics.likes / 1000).toFixed(1)}k`
                  : post.metrics.likes.toLocaleString('pt-BR')}
              </strong>
            </span>
            {post.metrics.views != null && post.metrics.views > 0 && (
              <span className="flex items-center gap-0.5">
                <Eye className="w-3 h-3" />
                <strong className="text-foreground/70 tabular-nums">
                  {post.metrics.views >= 1000
                    ? `${(post.metrics.views / 1000).toFixed(1)}k`
                    : post.metrics.views.toLocaleString('pt-BR')}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Time */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
          <Clock className="w-3 h-3" />
          {publishedAgo}
        </div>

      </CardContent>
    </Card>
  )
}
