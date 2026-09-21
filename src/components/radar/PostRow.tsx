import { useNavigate } from 'react-router-dom'
import { ExternalLink, Clock, MessageCircle, Heart } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ScoreBadge } from './ScoreBadge'
import { PlatformBadge } from './PlatformBadge'
import { MiniSparkline } from './MiniSparkline'
import type { RadarPost } from '@/types/radar'
import { cn } from '@/lib/utils'

const STATUS_DOT: Record<RadarPost['status'], string> = {
  trending:   'bg-red-500 dot-blink',
  candidate:  'bg-primary animate-pulse',
  monitoring: 'bg-muted-foreground/30',
  analyzed:   'bg-green-500',
  archived:   'bg-muted-foreground/20',
}

const STATUS_LABEL: Record<RadarPost['status'], { text: string; cls: string }> = {
  trending:   { text: 'Repercutindo', cls: 'bg-red-500/15 trending-text' },
  candidate:  { text: 'Aquecendo',    cls: 'bg-primary/10 candidate-text' },
  monitoring: { text: 'Monitorando',  cls: 'bg-secondary text-muted-foreground/60' },
  analyzed:   { text: 'Analisado',    cls: 'bg-green-500/10 text-green-500 dark:text-green-400' },
  archived:   { text: 'Arquivado',    cls: 'bg-secondary text-muted-foreground/60' },
}

const SPARKLINE_COLOR: Record<RadarPost['status'], string> = {
  trending:   '#ef4444',
  candidate:  '#3b82f6',
  monitoring: '#6b7280',
  analyzed:   '#22c55e',
  archived:   '#374151',
}

export function PostRow({ post, rank }: { post: RadarPost; rank?: number }) {
  const navigate = useNavigate()
  const isTrending = post.status === 'trending'
  const statusInfo = STATUS_LABEL[post.status]

  const publishedAgo = formatDistanceToNow(post.publishedAt.toDate(), {
    addSuffix: true, locale: ptBR,
  })

  const textPreview = post.text.length > 85
    ? post.text.slice(0, 85).trimEnd() + '…'
    : post.text

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0 cursor-pointer transition-colors',
        isTrending ? 'trending-row hover:bg-[var(--trending-bg-hover)]' : 'hover:bg-secondary/30',
      )}
      onClick={() => navigate(`/radar/post/${post.id}`)}
    >
      {/* Rank / status dot */}
      <div className="flex-shrink-0 w-5 text-center">
        {rank != null ? (
          <span className="text-[11px] text-muted-foreground/40 font-mono">{rank}</span>
        ) : (
          <span className={cn('inline-block w-2 h-2 rounded-full', STATUS_DOT[post.status])} />
        )}
      </div>

      {/* Status dot when ranked */}
      {rank != null && (
        <span className={cn('flex-shrink-0 w-1.5 h-1.5 rounded-full', STATUS_DOT[post.status])} />
      )}

      {/* Text + meta */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm leading-snug truncate',
          isTrending ? 'font-semibold text-foreground' : 'font-medium text-foreground/85',
        )}>
          {textPreview || <span className="italic text-muted-foreground">Sem legenda</span>}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <PlatformBadge platform={post.platform} className="scale-90 origin-left" />
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
            statusInfo.cls,
          )}>
            {statusInfo.text}
          </span>
          <span className="text-[10px] text-muted-foreground/45 flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />{publishedAgo}
          </span>
        </div>
      </div>

      {/* Sparkline */}
      <div className="flex-shrink-0 hidden md:block">
        <MiniSparkline score={post.trendScore} color={SPARKLINE_COLOR[post.status]} />
      </div>

      {/* Score */}
      <div className="flex-shrink-0">
        <ScoreBadge score={post.trendScore} size="sm" />
      </div>

      {/* Comments */}
      <div className="flex-shrink-0 w-16 text-right">
        <p className={cn(
          'text-lg font-bold tabular-nums leading-none',
          isTrending ? 'trending-text' : post.status === 'candidate' ? 'candidate-text' : 'text-foreground',
        )}>
          {post.metrics.comments >= 1000
            ? `${(post.metrics.comments / 1000).toFixed(1)}k`
            : post.metrics.comments.toLocaleString('pt-BR')}
        </p>
        <p className="text-[9px] text-muted-foreground/50 mt-0.5 uppercase tracking-wide flex items-center justify-end gap-0.5">
          <MessageCircle className="w-2.5 h-2.5" />coment.
        </p>
      </div>

      {/* Likes */}
      <div className="flex-shrink-0 w-12 text-right hidden lg:block">
        <p className="text-sm font-semibold tabular-nums text-foreground/55">
          {post.metrics.likes >= 1000
            ? `${(post.metrics.likes / 1000).toFixed(1)}k`
            : post.metrics.likes.toLocaleString('pt-BR')}
        </p>
        <p className="text-[9px] text-muted-foreground/50 mt-0.5 uppercase tracking-wide flex items-center justify-end gap-0.5">
          <Heart className="w-2.5 h-2.5" />likes
        </p>
      </div>

      {/* External link */}
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 text-muted-foreground/25 hover:text-primary p-1 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  )
}
