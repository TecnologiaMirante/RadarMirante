import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, RefreshCw, ExternalLink, Radio, AlertCircle, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { subscribeTrends, type PlatformTrends, type TrendTopic } from '@/services/trends'
import { getPosts } from '@/services/radar'
import { useAccount } from '@/contexts/AccountContext'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'
import type { RadarFilters } from '@/types/radar'

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = 'google' | 'twitter'

interface RadarMatch {
  postId: string
  account: string
  text: string
  url: string
  comments: number
  score: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function topicMatchesPosts(topic: TrendTopic, posts: RadarMatch[]): RadarMatch[] {
  const words = normalizeForMatch(topic.title)
    .split(' ')
    .filter(w => w.length > 3)
  if (words.length === 0) return []

  return posts.filter(p => {
    const text = normalizeForMatch(p.text)
    return words.some(w => text.includes(w))
  })
}

function fmtUpdated(ts: Timestamp | null): string {
  if (!ts) return '—'
  try {
    return formatDistanceToNow(ts.toDate(), { addSuffix: true, locale: ptBR })
  } catch {
    return '—'
  }
}

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORMS: { id: Platform; label: string; emoji: string; color: string; url: string; desc: string }[] = [
  {
    id: 'google',
    label: 'Google Trends',
    emoji: '🔍',
    color: '#4285F4',
    url: 'https://trends.google.com/trending?geo=BR',
    desc: 'O que o Brasil está buscando agora',
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    emoji: '𝕏',
    color: '#000000',
    url: 'https://getdaytrends.com/pt/brazil/',
    desc: 'Assuntos em alta no X (Brasil)',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlatformTab({
  platform, active, onClick, hasData,
}: { platform: typeof PLATFORMS[0]; active: boolean; onClick: () => void; hasData: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 border',
        active
          ? 'text-foreground border-border/80 bg-card shadow-sm'
          : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/40',
      )}
    >
      <span className="text-base leading-none">{platform.emoji}</span>
      <span>{platform.label}</span>
      {hasData && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
      )}
    </button>
  )
}

function TrendItem({
  topic, radarMatches, rank,
}: {
  topic: TrendTopic
  radarMatches: RadarMatch[]
  rank: number
}) {
  const hasMatch = radarMatches.length > 0
  const topMatch = radarMatches[0]

  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3 rounded-xl border transition-all duration-150 group',
      hasMatch
        ? 'border-primary/30 bg-primary/5 hover:bg-primary/8'
        : 'border-border/50 bg-card hover:bg-accent/30',
    )}>
      {/* Rank */}
      <span className={cn(
        'text-xs font-bold tabular-nums w-5 text-right flex-shrink-0 mt-0.5',
        rank <= 3 ? 'text-foreground' : 'text-muted-foreground/50',
      )}>
        {rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-semibold leading-tight',
          hasMatch ? 'text-primary' : 'text-foreground',
        )}>
          {topic.title}
        </p>

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {topic.score && (
            <span className="text-[11px] text-muted-foreground/60 tabular-nums">
              {topic.score} buscas
            </span>
          )}
          {topic.duration && (
            <span className="text-[11px] text-muted-foreground/60">
              {topic.duration} em alta
            </span>
          )}

          {/* Phase 3: Radar match badge */}
          {hasMatch && (
            <a
              href={topMatch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 border border-primary/25 text-[10px] font-bold text-primary hover:bg-primary/25 transition-colors"
            >
              <Radio className="w-2.5 h-2.5" />
              No Radar
              {radarMatches.length > 1 && <span className="opacity-70">+{radarMatches.length - 1}</span>}
            </a>
          )}
        </div>

        {/* Radar match preview */}
        {hasMatch && (
          <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-1 italic">
            "{topMatch.text.slice(0, 120)}"
          </p>
        )}
      </div>

      {/* Score badge */}
      {hasMatch && topMatch.score > 0 && (
        <div className="flex-shrink-0 text-right">
          <span className={cn(
            'text-[11px] font-bold px-1.5 py-0.5 rounded-lg',
            topMatch.score >= 65 ? 'bg-red-500/15 text-red-400' :
            topMatch.score >= 40 ? 'bg-primary/15 text-primary' :
            'bg-muted text-muted-foreground',
          )}>
            {topMatch.score}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const { account } = useAccount()
  const [activePlatform, setActivePlatform] = useState<Platform>('google')
  const [trendsData, setTrendsData] = useState<Record<Platform, PlatformTrends>>({
    google:  { topics: [], updatedAt: null, loading: true },
    twitter: { topics: [], updatedAt: null, loading: true },
  })
  const [radarPosts, setRadarPosts] = useState<RadarMatch[]>([])
  const [postsLoading, setPostsLoading] = useState(true)

  // Subscribe to both platforms
  useEffect(() => {
    const unsubs = (['google', 'twitter'] as Platform[]).map(platform =>
      subscribeTrends(platform, (data) =>
        setTrendsData(prev => ({ ...prev, [platform]: data }))
      )
    )
    return () => unsubs.forEach(u => u())
  }, [])

  // Load Radar posts (last 7 days) for crossover
  useEffect(() => {
    setPostsLoading(true)
    const filters: RadarFilters = { platform: 'all', time: '7d', sort: 'recent' }
    getPosts(filters, account)
      .then(posts => {
        setRadarPosts(posts.map(p => ({
          postId: p.id,
          account: (p as unknown as { account?: string }).account ?? account,
          text: p.text ?? '',
          url: p.url ?? '',
          comments: p.metrics.comments,
          score: p.trendScore,
        })))
      })
      .catch(console.error)
      .finally(() => setPostsLoading(false))
  }, [account])

  const current = trendsData[activePlatform]
  const currentPlatform = PLATFORMS.find(p => p.id === activePlatform)!

  // Phase 3: compute crossover for current platform's topics
  const topicsWithMatches = useMemo(() =>
    current.topics.map(topic => ({
      topic,
      radarMatches: topicMatchesPosts(topic, radarPosts),
    })),
    [current.topics, radarPosts]
  )

  const matchCount = topicsWithMatches.filter(t => t.radarMatches.length > 0).length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Farejador de Tendências
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            O que está em alta agora — cruzado com as publicações do Radar
          </p>
        </div>

        {/* Last updated */}
        {current.updatedAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Clock className="w-3 h-3" />
            <span>Atualizado {fmtUpdated(current.updatedAt)}</span>
          </div>
        )}
      </div>

      {/* Platform tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {PLATFORMS.map(platform => (
          <PlatformTab
            key={platform.id}
            platform={platform}
            active={activePlatform === platform.id}
            onClick={() => setActivePlatform(platform.id)}
            hasData={trendsData[platform.id].topics.length > 0}
          />
        ))}
        <a
          href={currentPlatform.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Ver fonte
        </a>
      </div>

      {/* Phase 3: Radar crossover banner */}
      {!postsLoading && matchCount > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-primary/8 border border-primary/20 text-sm">
          <Radio className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-foreground font-medium">
            {matchCount} {matchCount === 1 ? 'assunto' : 'assuntos'} em alta{' '}
            {matchCount === 1 ? 'aparece' : 'aparecem'} em publicações recentes do Radar
          </span>
        </div>
      )}

      {/* Platform description */}
      <p className="text-xs text-muted-foreground/70 -mt-2">
        {currentPlatform.desc}
      </p>

      {/* Trends list */}
      <Card className="border-border/60">
        <CardContent className="p-3 space-y-1.5">
          {current.loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground/40" />
            </div>
          ) : current.error ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertCircle className="w-6 h-6 text-destructive/60" />
              <p className="text-sm text-muted-foreground">Não foi possível carregar as tendências.</p>
              <p className="text-xs text-muted-foreground/50">{current.error}</p>
            </div>
          ) : current.topics.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <TrendingUp className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Aguardando primeira coleta…</p>
              <p className="text-xs text-muted-foreground/50">
                A função coleta tendências a cada 30 minutos.
              </p>
            </div>
          ) : (
            topicsWithMatches.map(({ topic, radarMatches }) => (
              <TrendItem
                key={`${topic.rank}-${topic.title}`}
                topic={topic}
                radarMatches={radarMatches}
                rank={topic.rank}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Footer note */}
      <p className="text-[11px] text-muted-foreground/40 text-center">
        Google Trends via RSS oficial · Twitter via getdaytrends.com · Atualizado a cada 30 min
      </p>
    </div>
  )
}
