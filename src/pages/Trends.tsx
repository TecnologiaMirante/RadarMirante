import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, RefreshCw, ExternalLink, Radio, AlertCircle, Clock, History, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { subscribeTrends, type PlatformTrends, type TrendTopic, type TrendNewsItem } from '@/services/trends'
import { getPosts } from '@/services/radar'
import { useAccount } from '@/contexts/AccountContext'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'
import type { RadarFilters } from '@/types/radar'

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = 'google' | 'twitter'
type TrendView = 'now' | 'history'

interface RadarMatch {
  postId: string
  account: string
  text: string
  url: string
  comments: number
  score: number
  publishedAt?: import('firebase/firestore').Timestamp
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'para', 'como', 'mais', 'pelo', 'pela', 'pelos', 'pelas', 'depois',
  'onde', 'quando', 'muito', 'este', 'esta', 'esse', 'essa', 'aqui',
  'agora', 'todo', 'toda', 'todos', 'todas', 'entre', 'novo', 'nova',
  'sobre', 'pode', 'sera', 'deve', 'dias', 'anos', 'tempo', 'grande',
  'parte', 'ainda', 'tambem', 'mesmo', 'partido', 'clube', 'times',
  'jogo', 'jogos', 'copa', 'liga', 'show', 'party', 'down', 'open',
  'final', 'serie', 'super', 'live', 'free', 'brasil', 'brazil',
])

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
  const keywords = normalizeForMatch(topic.title)
    .split(' ')
    .filter(w => w.length >= 5 && !STOPWORDS.has(w))
  if (keywords.length === 0) return []
  const minMatches = keywords.length >= 2 ? 2 : 1
  return posts.filter(p => {
    const textWords = new Set(normalizeForMatch(p.text).split(/\s+/))
    const matched = keywords.filter(w => textWords.has(w))
    return matched.length >= minMatches
  })
}

function fmtRelative(ts: Timestamp | null | undefined): string {
  if (!ts) return '—'
  try {
    return formatDistanceToNow(ts.toDate(), { addSuffix: true, locale: ptBR })
  } catch { return '—' }
}

function fmtDateRelative(d: Date): string {
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  if (diffMs <= 0) return 'em breve'
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR })
}

function fmtShort(ts: Timestamp | null | undefined): string {
  if (!ts) return ''
  try {
    const d = ts.toDate()
    const now = new Date()
    const diffH = (now.getTime() - d.getTime()) / 3_600_000
    if (diffH < 1) return 'agora'
    if (diffH < 24) return `há ${Math.floor(diffH)}h`
    return format(d, "d 'de' MMM", { locale: ptBR })
  } catch { return '' }
}

function getDayLabel(ts: Timestamp): string {
  try {
    const d = ts.toDate()
    if (isToday(d)) return 'Hoje'
    if (isYesterday(d)) return 'Ontem'
    return format(d, "EEEE, d 'de' MMM", { locale: ptBR })
  } catch { return '' }
}

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORMS: { id: Platform; label: string; emoji: string; url: string; desc: string }[] = [
  {
    id: 'google',
    label: 'Google Trends',
    emoji: '🔍',
    url: 'https://trends.google.com/trending?geo=BR',
    desc: 'O que o Brasil está buscando agora',
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    emoji: '𝕏',
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
        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border',
        active
          ? 'text-foreground border-border/80 bg-card shadow-sm'
          : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/40',
      )}
    >
      <span className="text-base leading-none">{platform.emoji}</span>
      <span>{platform.label}</span>
      {hasData && <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
    </button>
  )
}

interface ModalState { topic: TrendTopic; matches: RadarMatch[] }

function AccountBadge({ accountId }: { accountId: string }) {
  const { getAccount } = useAccount()
  const cfg = getAccount(accountId)
  const name = cfg?.displayName ?? accountId
  const color = cfg?.color ?? '#888'
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold"
      style={{ borderColor: `${color}40`, color, background: `${color}12` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {name}
    </span>
  )
}

function RadarMatchesModal({ state, onClose }: { state: ModalState; onClose: () => void }) {
  const navigate = useNavigate()
  function goToPost(postId: string) { onClose(); navigate(`/radar/post/${postId}`) }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-border/60">
          <div>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">
              Publicações no Radar
            </p>
            <h3 className="text-sm font-bold text-foreground leading-tight">{state.topic.title}</h3>
          </div>
          <button onClick={onClose} className="ml-3 p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="divide-y divide-border/40 max-h-[60vh] overflow-y-auto">
          {state.matches.map((match, i) => (
            <button key={match.postId} onClick={() => goToPost(match.postId)} className="w-full text-left px-4 py-3 hover:bg-accent/40 transition-colors group">
              <div className="flex items-start gap-3">
                <span className="text-[11px] text-muted-foreground/40 tabular-nums mt-0.5 w-4 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/90 leading-snug line-clamp-3">{match.text.slice(0, 200)}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <AccountBadge accountId={match.account} />
                    {match.publishedAt && (
                      <span className="text-[10px] text-muted-foreground/45">
                        {fmtRelative(match.publishedAt)}
                      </span>
                    )}
                    {match.score > 0 && (
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
                        match.score >= 65 ? 'bg-red-500/15 text-red-400' :
                        match.score >= 40 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                        Score {match.score}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function TrendItem({
  topic, radarMatches, rank, showContext, onOpenModal, onNavigate,
}: {
  topic: TrendTopic
  radarMatches: RadarMatch[]
  rank: number
  showContext: boolean
  onOpenModal: (topic: TrendTopic, matches: RadarMatch[]) => void
  onNavigate: (topic: TrendTopic) => void
}) {
  const hasMatch = radarMatches.length > 0
  const contextNews: TrendNewsItem | undefined = topic.newsItems?.[0]
  const hasNewsSource = !!contextNews?.source
  const hasRelated = contextNews && !contextNews.source && !!contextNews.snippet

  return (
    <div
      onClick={() => onNavigate(topic)}
      className={cn(
        'flex gap-3 px-4 py-3.5 rounded-xl border cursor-pointer group transition-all duration-100',
        hasMatch
          ? 'border-primary/25 bg-primary/5 hover:bg-primary/8'
          : 'border-border/50 bg-card hover:bg-muted/30',
      )}
    >
      {/* Rank */}
      <div className="w-6 flex-shrink-0 text-center pt-0.5">
        {rank <= 3 ? (
          <span className="text-sm leading-none">{['🥇', '🥈', '🥉'][rank - 1]}</span>
        ) : (
          <span className="text-xs font-bold tabular-nums text-muted-foreground/35">{rank}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title + score inline */}
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn(
            'text-sm font-semibold leading-snug group-hover:underline underline-offset-2 decoration-dashed',
            hasMatch ? 'text-primary' : 'text-foreground',
          )}>
            {topic.title}
          </p>
          {topic.score && (
            <span className="text-[10px] font-medium text-muted-foreground/40 tabular-nums flex-shrink-0">
              {topic.score}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {topic.firstSeen && (
            <span className="text-[10px] text-muted-foreground/40">
              {fmtShort(topic.firstSeen)}
            </span>
          )}
          {hasMatch && (
            <button
              onClick={e => { e.stopPropagation(); onOpenModal(topic, radarMatches) }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 border border-primary/20 text-[10px] font-semibold text-primary hover:bg-primary/25 transition-colors"
            >
              <Radio className="w-2.5 h-2.5" />
              {radarMatches.length > 1 ? `${radarMatches.length} posts` : 'Ver no Radar'}
            </button>
          )}
        </div>

        {/* Context: news as a discreet line */}
        {showContext && hasNewsSource && (
          <p className="mt-1.5 text-[11px] text-muted-foreground/50 leading-snug line-clamp-1">
            <span className="font-medium">{contextNews.source}</span>
            {' · '}
            {contextNews.title}
          </p>
        )}

        {/* Context: related searches */}
        {showContext && hasRelated && contextNews.snippet && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {contextNews.snippet.split(' · ').slice(0, 4).map((term, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-muted/50 text-[10px] text-muted-foreground/55">
                {term}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const { accounts } = useAccount()
  const navigate = useNavigate()
  const [activePlatform, setActivePlatform] = useState<Platform>('google')
  const [activeView, setActiveView] = useState<TrendView>('now')
  const [trendsData, setTrendsData] = useState<Record<Platform, PlatformTrends>>({
    google:  { topics: [], loading: true },
    twitter: { topics: [], loading: true },
  })
  const [radarPosts, setRadarPosts] = useState<RadarMatch[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)

  useEffect(() => {
    const unsubs = (['google', 'twitter'] as Platform[]).map(platform =>
      subscribeTrends(platform, data => setTrendsData(prev => ({ ...prev, [platform]: data })))
    )
    return () => unsubs.forEach(u => u())
  }, [])

  useEffect(() => {
    if (!accounts.length) return
    setPostsLoading(true)
    const filters: RadarFilters = { platform: 'all', time: '7d', sort: 'recent' }
    Promise.all(accounts.map(a => getPosts(filters, a.id)))
      .then(results => {
        const seen = new Set<string>()
        const merged: RadarMatch[] = []
        for (let i = 0; i < results.length; i++) {
          const accountId = accounts[i].id
          for (const p of results[i]) {
            if (seen.has(p.id)) continue
            seen.add(p.id)
            merged.push({
              postId: p.id,
              account: (p as unknown as { account?: string }).account ?? accountId,
              text: p.text ?? '',
              url: p.url ?? '',
              comments: p.metrics.comments,
              score: p.trendScore,
              publishedAt: p.publishedAt,
            })
          }
        }
        setRadarPosts(merged)
      })
      .catch(console.error)
      .finally(() => setPostsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.map(a => a.id).join(',')])

  const current = trendsData[activePlatform]
  const currentPlatform = PLATFORMS.find(p => p.id === activePlatform)!

  // Last collection = max lastSeen across all topics (all get updated together)
  const lastUpdated = useMemo(() => {
    if (!current.topics.length) return null
    return current.topics.reduce<Timestamp | null>((max, t) => {
      const ms = t.lastSeen?.toMillis() ?? 0
      return ms > (max?.toMillis() ?? 0) ? t.lastSeen! : max
    }, null)
  }, [current.topics])

  // Next collection = lastUpdated + 30min (schedule: every 30 minutes)
  const nextCollectionDate = lastUpdated
    ? new Date(lastUpdated.toMillis() + 30 * 60 * 1000)
    : null

  // "Agora": top 25 sorted by lastSeen then rank
  const sortedNow = useMemo(() =>
    [...current.topics]
      .sort((a, b) => {
        const diff = (b.lastSeen?.toMillis() ?? 0) - (a.lastSeen?.toMillis() ?? 0)
        if (Math.abs(diff) > 60 * 60 * 1000) return diff
        return a.rank - b.rank
      })
      .slice(0, 25),
    [current.topics]
  )

  // "Esta semana": group by day of lastSeen (most recently active first)
  const historyGroups = useMemo(() => {
    const sorted = [...current.topics].sort((a, b) => {
      const diff = (b.lastSeen?.toMillis() ?? 0) - (a.lastSeen?.toMillis() ?? 0)
      if (Math.abs(diff) > 3 * 60 * 60 * 1000) return diff
      return a.rank - b.rank
    })

    const groups: { label: string; topics: TrendTopic[] }[] = []
    const labelIndex = new Map<string, number>()

    for (const topic of sorted) {
      const label = topic.lastSeen ? getDayLabel(topic.lastSeen) : 'Outros'
      const idx = labelIndex.get(label)
      if (idx === undefined) {
        labelIndex.set(label, groups.length)
        groups.push({ label, topics: [topic] })
      } else {
        groups[idx].topics.push(topic)
      }
    }
    return groups
  }, [current.topics])

  const displayTopics = activeView === 'now' ? sortedNow : []

  const topicsWithMatches = useMemo(() =>
    displayTopics.map(topic => ({ topic, radarMatches: topicMatchesPosts(topic, radarPosts) })),
    [displayTopics, radarPosts]
  )

  const historyWithMatches = useMemo(() =>
    historyGroups.map(g => ({
      ...g,
      topics: g.topics.map(topic => ({ topic, radarMatches: topicMatchesPosts(topic, radarPosts) })),
    })),
    [historyGroups, radarPosts]
  )

  const matchCount = topicsWithMatches.filter(t => t.radarMatches.length > 0).length

  return (
    <>
      {modal && <RadarMatchesModal state={modal} onClose={() => setModal(null)} />}
      <div className="space-y-4">

        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-0.5">
            <TrendingUp className="w-5 h-5 text-primary" />
            Farejador de Tendências
          </h2>
          <p className="text-xs text-muted-foreground/70">
            O que está em alta agora — cruzado com as publicações do Radar
          </p>

          {/* Collection status */}
          {(lastUpdated || nextCollectionDate) && (
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {lastUpdated && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
                  <Clock className="w-3 h-3" />
                  Última coleta {fmtRelative(lastUpdated)}
                </span>
              )}
              {nextCollectionDate && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/40">
                  <RefreshCw className="w-3 h-3" />
                  Próxima {fmtDateRelative(nextCollectionDate)}
                </span>
              )}
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
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/45 hover:text-muted-foreground transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Ver fonte
          </a>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1.5">
          {([
            { id: 'now',     label: 'Agora',       icon: <TrendingUp className="w-3.5 h-3.5" /> },
            { id: 'history', label: 'Esta semana',  icon: <History className="w-3.5 h-3.5" /> },
          ] as const).map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                activeView === v.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/40',
              )}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
          {activeView === 'history' && current.topics.length > 0 && (
            <span className="ml-auto text-[11px] text-muted-foreground/40">
              {current.topics.length} tendências · expira em 7 dias
            </span>
          )}
        </div>

        {/* Radar crossover banner */}
        {activeView === 'now' && !postsLoading && matchCount > 0 && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-primary/8 border border-primary/20 text-sm">
            <Radio className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-foreground font-medium">
              {matchCount} {matchCount === 1 ? 'assunto' : 'assuntos'} em alta{' '}
              {matchCount === 1 ? 'aparece' : 'aparecem'} em publicações recentes do Radar
            </span>
          </div>
        )}

        {/* Platform description */}
        <p className="text-xs text-muted-foreground/60 -mt-1">{currentPlatform.desc}</p>

        {/* Loading / error / empty */}
        {current.loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground/40" />
          </div>
        ) : current.error ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <AlertCircle className="w-6 h-6 text-destructive/60" />
            <p className="text-sm text-muted-foreground">Não foi possível carregar as tendências.</p>
            <p className="text-xs text-muted-foreground/50">{current.error}</p>
          </div>
        ) : current.topics.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <TrendingUp className="w-8 h-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Aguardando primeira coleta…</p>
            <p className="text-xs text-muted-foreground/50">A coleta roda a cada 30 minutos.</p>
          </div>
        ) : activeView === 'now' ? (
          /* ── Agora ── */
          <div className="space-y-1.5">
            {topicsWithMatches.map(({ topic, radarMatches }, i) => (
              <TrendItem
                key={topic.id}
                topic={topic}
                radarMatches={radarMatches}
                rank={i + 1}
                showContext={i < 5}
                onOpenModal={(t, m) => setModal({ topic: t, matches: m })}
                onNavigate={t => navigate(`/tendencias/${t.id}`)}
              />
            ))}
          </div>
        ) : (
          /* ── Esta semana ── */
          <div className="space-y-5">
            {historyWithMatches.map(group => (
              <div key={group.label}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/40 mb-2 px-1">
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.topics.map(({ topic, radarMatches }, i) => (
                    <TrendItem
                      key={topic.id}
                      topic={topic}
                      radarMatches={radarMatches}
                      rank={i + 1}
                      showContext={false}
                      onOpenModal={(t, m) => setModal({ topic: t, matches: m })}
                      onNavigate={t => navigate(`/tendencias/${t.id}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <p className="text-[11px] text-muted-foreground/35 text-center">
          Google Trends · X via getdaytrends.com · Contexto via Google News · Coleta a cada 30 min
        </p>
      </div>
    </>
  )
}
