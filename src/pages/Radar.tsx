import { useState, useEffect, useMemo } from 'react'
import {
  Radio, RefreshCw, MessageCircle, LayoutGrid, List,
  TrendingUp, FileText, Activity, Search, X,
  Heart, Eye, Zap, Award, Clock, ArrowUpRight, Maximize2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { PostCard } from '@/components/radar/PostCard'
import { PostRow } from '@/components/radar/PostRow'
import { EmptyState } from '@/components/radar/EmptyState'
import { WordCloud } from '@/components/radar/WordCloud'
import { ActivityChart } from '@/components/radar/ActivityChart'
import { InstagramInsightsPanel } from '@/components/radar/InstagramInsightsPanel'
import { InfoTip } from '@/components/ui/InfoTip'
import { useRadar } from '@/hooks/useRadar'
import { useAccount, ACCOUNT_COLORS, ACCOUNT_PAGE_TITLES } from '@/contexts/AccountContext'
import { getRecentCommentTexts } from '@/services/radar'
import type { SortOption, RadarPost } from '@/types/radar'
import { DateDropdown, TIME_FILTER_PRESETS } from '@/components/ui/DateDropdown'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Config ───────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent',   label: 'Mais recentes' },
  { value: 'comments', label: 'Mais comentados' },
  { value: 'score',    label: 'Maior score' },
]

const CLOUD_PERIODS: { value: number; label: string }[] = [
  { value: 1  * 3600_000, label: '1h' },
  { value: 3  * 3600_000, label: '3h' },
  { value: 6  * 3600_000, label: '6h' },
  { value: 12 * 3600_000, label: '12h' },
  { value: 24 * 3600_000, label: '24h' },
]

type ContentTab = 'all' | 'trending' | 'candidate' | 'analyzed'
const CONTENT_TABS: { value: ContentTab; label: string }[] = [
  { value: 'all',       label: 'Tudo' },
  { value: 'trending',  label: 'Repercutindo' },
  { value: 'candidate', label: 'Aquecendo' },
  { value: 'analyzed',  label: 'Analisados' },
]

const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  instagram: { label: 'Instagram', color: 'bg-pink-400' },
  imirante:  { label: 'Site',      color: 'bg-blue-400' },
  facebook:  { label: 'Facebook',  color: 'bg-indigo-400' },
  youtube:   { label: 'YouTube',   color: 'bg-red-400' },
  x:         { label: 'X',         color: 'bg-zinc-400' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────


function KpiCard({ label, value, sub, icon, accent, live, delta, tooltip, tooltipSide = 'bottom' }: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; accent?: 'red' | 'blue' | 'green' | 'yellow' | 'default'; live?: boolean
  delta?: number; tooltip?: React.ReactNode; tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
}) {
  const cls = { red: 'text-red-400', blue: 'text-primary', green: 'text-green-400', yellow: 'text-yellow-400', default: 'text-foreground' }[accent ?? 'default']
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4 border-r border-border/50 last:border-r-0 min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {live && <span className="dot-blink w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
        <span className="opacity-60">{icon}</span>
        <span className="truncate flex-1">{label}</span>
        {tooltip && <InfoTip side={tooltipSide}>{tooltip}</InfoTip>}
      </div>
      <p className={cn('text-3xl font-bold tabular-nums leading-none tracking-tight', cls)}>{value}</p>
      <div className="flex items-center gap-1.5">
        {sub && <p className="text-[10px] text-muted-foreground/60 truncate">{sub}</p>}
        {delta !== undefined && delta !== 0 && (
          <span className={cn('text-[10px] font-bold flex-shrink-0', delta > 0 ? 'text-green-400' : 'text-red-400')}>
            {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  )
}

function SideSection({ title, children, tip }: { title: string; children: React.ReactNode; tip?: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">{title}</p>
        {tip}
      </div>
      {children}
    </div>
  )
}

function BreakdownRow({ label, count, total, color, extra }: {
  label: string; count: number; total: number; color: string; extra?: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-sm flex-shrink-0', color)} />
          <span className="text-foreground/80 truncate max-w-[100px]">{label}</span>
        </span>
        <span className="flex items-center gap-1.5">
          {extra && <span className="text-muted-foreground/60 text-[10px]">{extra}</span>}
          <span className="text-muted-foreground font-mono font-semibold tabular-nums w-8 text-right">{count}</span>
          <span className="text-muted-foreground/50 w-7 text-right">{pct}%</span>
        </span>
      </div>
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function TopPostItem({ post, rank }: { post: RadarPost; rank: number }) {
  const isTrending = post.status === 'trending'
  const preview = post.text.slice(0, 55).trimEnd() + (post.text.length > 55 ? '…' : '')
  return (
    <Link
      to={`/radar/post/${post.id}`}
      className="flex items-start gap-2 py-2 border-b border-border/30 last:border-0 -mx-2 px-2 rounded hover:bg-accent/30 transition-colors cursor-pointer"
    >
      <span className="text-xs font-mono font-bold text-muted-foreground/40 w-4 flex-shrink-0 mt-0.5">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs leading-snug truncate', isTrending ? 'text-foreground font-medium' : 'text-foreground/80')}>
          {preview || <span className="italic text-muted-foreground">Sem legenda</span>}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('flex items-center gap-0.5 text-xs font-bold tabular-nums', isTrending ? 'trending-text' : 'candidate-text')}>
            <MessageCircle className="w-2.5 h-2.5" />
            {post.metrics.comments >= 1000 ? `${(post.metrics.comments/1000).toFixed(1)}k` : post.metrics.comments}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
            <Heart className="w-2 h-2" />
            {post.metrics.likes >= 1000 ? `${(post.metrics.likes/1000).toFixed(1)}k` : post.metrics.likes}
          </span>
        </div>
      </div>
      {isTrending && <span className="dot-blink w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1" />}
    </Link>
  )
}

function StatRow({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string | number; accent?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="opacity-60">{icon}</span>{label}
      </span>
      <span className={cn('text-xs font-bold tabular-nums', accent ?? 'text-foreground')}>{value}</span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Radar() {
  const { posts, filters, setFilters, loading, error, refresh } = useRadar()
  const { account } = useAccount()
  const accountColor = ACCOUNT_COLORS[account]
  const pageTitle = ACCOUNT_PAGE_TITLES[account]
  const [cloudPeriod, setCloudPeriod] = useState(CLOUD_PERIODS[4].value)
  const [cloudTexts, setCloudTexts] = useState<string[]>([])
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudExpanded, setCloudExpanded] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [contentTab, setContentTab] = useState<ContentTab>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setCloudLoading(true)
    getRecentCommentTexts(Date.now() - cloudPeriod)
      .then(setCloudTexts)
      .catch(console.error)
      .finally(() => setCloudLoading(false))
  }, [cloudPeriod])

  // Derivados
  const trendingPosts   = useMemo(() => posts.filter(p => p.status === 'trending'),   [posts])
  const candidatePosts  = useMemo(() => posts.filter(p => p.status === 'candidate'),  [posts])
  const monitoringPosts = useMemo(() => posts.filter(p => p.status === 'monitoring'), [posts])
  const analyzedPosts   = useMemo(() => posts.filter(p => p.status === 'analyzed' || p.status === 'trending'), [posts])

  const totalComments = useMemo(() => posts.reduce((s, p) => s + p.metrics.comments, 0), [posts])
  const totalLikes    = useMemo(() => posts.reduce((s, p) => s + p.metrics.likes, 0), [posts])
  const totalViews    = useMemo(() => posts.reduce((s, p) => s + (p.metrics.views ?? 0), 0), [posts])
  const scoredPosts   = useMemo(() => posts.filter(p => p.trendScore > 0), [posts])
  const avgScore      = scoredPosts.length ? Math.round(scoredPosts.reduce((s, p) => s + p.trendScore, 0) / scoredPosts.length) : 0
  const avgComments   = posts.length ? Math.round(totalComments / posts.length) : 0
  const engagementRate = posts.length ? Math.round((totalComments + totalLikes) / posts.length) : 0

  const topByComments = useMemo(() => [...posts].sort((a, b) => b.metrics.comments - a.metrics.comments), [posts])
  const top5    = topByComments.slice(0, 5)
  const topPost = topByComments[0]

  const platformCounts = useMemo(() => posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.platform] = (acc[p.platform] ?? 0) + 1; return acc
  }, {}), [posts])

  const platformEngagement = useMemo(() => posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.platform] = (acc[p.platform] ?? 0) + p.metrics.comments; return acc
  }, {}), [posts])

  const statusBreakdown = [
    { label: 'Repercutindo', count: trendingPosts.length,   color: 'bg-red-500' },
    { label: 'Aquecendo',    count: candidatePosts.length,  color: 'bg-primary' },
    { label: 'Monitorando',  count: monitoringPosts.length, color: 'bg-muted-foreground/40' },
    { label: 'Analisado',    count: analyzedPosts.length,   color: 'bg-green-500' },
  ]

  const bestHour = useMemo(() => {
    const today = new Date().toDateString()
    const hourMap: Record<number, number> = {}
    posts.forEach(p => {
      const d = p.publishedAt.toDate()
      if (d.toDateString() !== today) return
      const h = d.getHours()
      hourMap[h] = (hourMap[h] ?? 0) + p.metrics.comments
    })
    const best = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]
    return best ? `${String(best[0]).padStart(2, '0')}h` : null
  }, [posts])

  const mostRecent = useMemo(() =>
    [...posts].sort((a, b) => b.publishedAt.toDate().getTime() - a.publishedAt.toDate().getTime())[0],
    [posts])

  const topWords = useMemo(() => {
    if (cloudTexts.length === 0) return []
    const stopwords = new Set(['de','a','o','e','do','da','em','que','para','com','uma','um','no','na','os','as','se','por','mais','mas','foi','ele','ao','dos','das','já','sua','seu','tem','não','é','ou','quando','isso','esta','vai','só','porque','aqui','como','também','muito','isso','sem','essa','esse','ser','ter','fazer','pode','sobre'])
    const freq: Record<string, number> = {}
    cloudTexts.forEach(t => {
      t.toLowerCase().split(/\s+/).forEach(w => {
        const clean = w.replace(/[^a-záàâãéèêíóôõúüçñ]/gi, '')
        if (clean.length > 3 && !stopwords.has(clean)) freq[clean] = (freq[clean] ?? 0) + 1
      })
    })
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [cloudTexts])

  // Distribuição de score: 0-39 / 40-64 / 65-79 / 80+
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { label: '80+ 🔥', min: 80, max: 100, color: 'bg-red-500' },
      { label: '65–79 📈', min: 65, max: 79, color: 'bg-orange-400' },
      { label: '40–64 👀', min: 40, max: 64, color: 'bg-yellow-400' },
      { label: '0–39 📊',  min: 0,  max: 39, color: 'bg-muted-foreground/40' },
    ]
    return buckets.map(b => ({
      ...b,
      count: posts.filter(p => p.trendScore >= b.min && p.trendScore <= b.max).length,
    }))
  }, [posts])

  // Comentários na última hora (proxy de velocidade)
  const commentsLastHour = useMemo(() => {
    const cutoff = Date.now() - 3600_000
    return posts
      .filter(p => p.publishedAt.toDate().getTime() >= cutoff)
      .reduce((s, p) => s + p.metrics.comments, 0)
  }, [posts])

  // Taxa de cobertura IA
  const aiCoverage = posts.length > 0
    ? Math.round((analyzedPosts.length / posts.length) * 100)
    : 0

  // Candidatos prontos para análise manual (score alto, ainda não trending/analyzed/archived)
  const readyToAnalyze = useMemo(() =>
    posts.filter(p => p.trendScore >= 40 && p.status !== 'analyzed' && p.status !== 'trending' && p.status !== 'archived'),
    [posts])

  // Comparação de período: divide os posts em primeira e segunda metade
  const periodDeltas = useMemo(() => {
    if (posts.length < 4) return { posts: 0, comments: 0, score: 0 }
    const sorted = [...posts].sort((a, b) => a.publishedAt.toDate().getTime() - b.publishedAt.toDate().getTime())
    const mid = Math.floor(sorted.length / 2)
    const older = sorted.slice(0, mid)
    const newer = sorted.slice(mid)
    const pct = (a: number, b: number) => b === 0 ? 0 : Math.round(((a - b) / b) * 100)
    const sumComments = (arr: typeof posts) => arr.reduce((s, p) => s + p.metrics.comments, 0)
    const avgScoreFn  = (arr: typeof posts) => arr.length ? Math.round(arr.reduce((s, p) => s + p.trendScore, 0) / arr.length) : 0
    return {
      posts:    pct(newer.length, older.length),
      comments: pct(sumComments(newer), sumComments(older)),
      score:    pct(avgScoreFn(newer), avgScoreFn(older)),
    }
  }, [posts])

  const filteredPosts = useMemo(() => {
    let base: RadarPost[] = posts
    if (contentTab === 'trending')  base = trendingPosts
    if (contentTab === 'candidate') base = candidatePosts
    if (contentTab === 'analyzed')  base = analyzedPosts
    if (search.trim()) {
      const q = search.toLowerCase()
      base = base.filter(p => p.text.toLowerCase().includes(q))
    }
    return base
  }, [posts, contentTab, search, trendingPosts, candidatePosts, analyzedPosts])

  const renderPostList = (postList: RadarPost[]) => {
    if (postList.length === 0)
      return <EmptyState title="Nenhuma publicação" description="Tente mudar os filtros ou aguarde a próxima coleta." />
    if (view === 'list') {
      return (
        <div className="rounded-lg border border-border/60 bg-card">
          <div className="flex items-center gap-3 px-4 py-2 bg-secondary/30 border-b border-border/60 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <div className="w-5" /><div className="w-1.5" />
            <span className="flex-1">Publicação</span>
            <span className="w-14 hidden md:flex items-center justify-end gap-1">
              Tendência
              <InfoTip side="top">
                <p className="font-semibold text-foreground mb-1.5">Curva de tendência</p>
                <p className="text-muted-foreground mb-2">Miniatura visual da evolução do trendScore ao longo do tempo.</p>
                <div className="space-y-1 text-muted-foreground text-[11px]">
                  <p><strong className="trending-text">Repercutindo</strong> — score ≥ 80, pautar agora</p>
                  <p><strong className="candidate-text">Aquecendo</strong> — score 65–79, monitorar</p>
                  <p><strong className="text-muted-foreground">Monitorando</strong> — score 0–39, acompanhamento normal. A publicação é coletada mas ainda não mostra crescimento acima do esperado.</p>
                  <p><strong className="text-green-400">Analisado</strong> — processado pela IA editorial</p>
                </div>
              </InfoTip>
            </span>
            <span className="w-12 flex items-center gap-1">
              Score
              <InfoTip side="top">
                <p className="font-semibold text-foreground mb-1">Trend Score (0–100)</p>
                <p className="text-muted-foreground">Relevância estatística da publicação. Calculado com base em velocidade de comentários, aceleração e volume.</p>
              </InfoTip>
            </span>
            <span className="w-16 text-right">Coment.</span>
            <span className="w-12 text-right hidden lg:block">Likes</span>
            <div className="w-6" />
          </div>
          {postList.map((post, i) => <PostRow key={post.id} post={post} rank={i + 1} />)}
        </div>
      )
    }
    const trending = postList.filter(p => p.status === 'trending')
    const rest     = postList.filter(p => p.status !== 'trending')
    return (
      <div className="space-y-4">
        {trending.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="dot-blink w-2 h-2 rounded-full bg-red-500" />
              <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Repercutindo agora · {trending.length}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trending.map(p => <PostCard key={p.id} post={p} />)}
            </div>
          </div>
        )}
        {rest.length > 0 && (
          <div className="space-y-2">
            {trending.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Demais publicações</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {rest.map(p => <PostCard key={p.id} post={p} />)}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: accountColor + '18', border: `1px solid ${accountColor}33` }}
          >
            <Radio className="w-4 h-4" style={{ color: accountColor }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground leading-none">{pageTitle}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? 'Carregando…' : (() => {
                const label = filters.time === 'custom'
                  ? 'período personalizado'
                  : (TIME_FILTER_PRESETS.find(f => f.value === filters.time)?.label ?? filters.time).toLowerCase()
                return `${posts.length} publicações · ${label}`
              })()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DateDropdown
            value={filters.time}
            customFrom={filters.customFrom}
            customTo={filters.customTo}
            onChange={(time, from, to) => setFilters(f => ({ ...f, time, customFrom: from, customTo: to }))}
          />
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading} className="gap-1.5 h-8 text-xs">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* KPI Strip + Gráfico */}
      <Card className="border-border/60">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Total" value={loading ? '—' : posts.length}
            sub={`${candidatePosts.length} aquecendo`}
            icon={<Activity className="w-3.5 h-3.5" />}
            delta={loading ? undefined : periodDeltas.posts} />
          <KpiCard label="Repercutindo" value={loading ? '—' : trendingPosts.length}
            sub="agora" icon={<span className="text-xs">🔴</span>}
            accent={trendingPosts.length > 0 ? 'red' : 'default'} live={trendingPosts.length > 0} />
          <KpiCard label="Comentários" value={loading ? '—' : totalComments >= 1000 ? `${(totalComments/1000).toFixed(1)}k` : totalComments}
            sub={`~${avgComments} por post`} icon={<MessageCircle className="w-3.5 h-3.5" />} accent="blue"
            delta={loading ? undefined : periodDeltas.comments}
            tooltip={<>
              <p className="font-semibold text-foreground mb-1">Total de comentários</p>
              <p className="text-muted-foreground">Soma de todos os comentários nas publicações do período selecionado.</p>
              <p className="text-muted-foreground mt-1.5"><strong className="text-foreground">~{avgComments}/post</strong> é a média de comentários por publicação.</p>
              {periodDeltas.comments !== 0 && <p className="text-muted-foreground mt-1.5 border-t border-border pt-1.5">Variação % compara primeira e segunda metade do período.</p>}
            </>} />
          <KpiCard label="Score médio" value={loading ? '—' : scoredPosts.length > 0 ? avgScore : '—'}
            sub={scoredPosts.length > 0 ? `${scoredPosts.length} pontuados de ${posts.length}` : 'aguardando pontuação'}
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            accent={avgScore >= 65 ? 'red' : avgScore >= 40 ? 'blue' : 'default'}
            delta={loading || scoredPosts.length === 0 ? undefined : periodDeltas.score}
            tooltip={<>
              <p className="font-semibold text-foreground mb-1.5">Trend Score médio (0–100)</p>
              <p className="text-muted-foreground mb-1.5">Média entre os <strong className="text-foreground">{scoredPosts.length} posts ativamente pontuados</strong> pelo monitor. Posts recém-coletados (score = 0) não entram no cálculo.</p>
              <div className="space-y-1 text-muted-foreground mb-2 border-t border-border pt-1.5">
                <p><strong className="text-red-400">🔥 80+</strong> — Viral, pautar agora</p>
                <p><strong className="text-orange-400">📈 65–79</strong> — Em alta, monitorar</p>
                <p><strong className="text-yellow-400">👀 40–64</strong> — Candidato</p>
                <p><strong className="text-muted-foreground">📊 0–39</strong> — Volume normal</p>
              </div>
              {periodDeltas.score !== 0 && <p className="text-muted-foreground border-t border-border pt-1.5">Variação % compara a média de score da primeira e segunda metade do período.</p>}
            </>} />
          <KpiCard label="Analisados IA" value={loading ? '—' : analyzedPosts.length}
            sub={topPost ? `top: ${topPost.metrics.comments.toLocaleString('pt-BR')} coment.` : 'aguardando'}
            icon={<FileText className="w-3.5 h-3.5" />} accent={analyzedPosts.length > 0 ? 'green' : 'default'}
            tooltipSide="left"
            tooltip={<>
              <p className="font-semibold text-foreground mb-1">Cobertura de IA</p>
              <p className="text-muted-foreground mb-1.5">Posts <strong className="text-foreground">repercutindo</strong> (score ≥ 65, análise automática) + posts <strong className="text-foreground">analisados manualmente</strong> pelo editor.</p>
              {topPost && <p className="text-muted-foreground"><strong className="text-foreground">top: {topPost.metrics.comments.toLocaleString('pt-BR')} coment.</strong> — maior engajamento individual no período.</p>}
              <p className="text-muted-foreground mt-1.5 border-t border-border pt-1.5">Acione análise manual em qualquer post via botão na página de detalhes.</p>
            </>} />
        </div>
        <div className="border-t border-border/40 px-5 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> Publicações no período
            </p>
            {bestHour && (
              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                pico às <span className="text-foreground font-semibold">{bestHour}</span>
                <InfoTip side="left">
                  <p className="font-semibold text-foreground mb-1">Hora de pico</p>
                  <p className="text-muted-foreground">Hora do dia com mais comentários acumulados nas publicações de hoje.</p>
                </InfoTip>
              </span>
            )}
          </div>
        </div>
        <div className="px-5 pb-3 overflow-hidden">
          <ActivityChart posts={posts} loading={loading} timeFilter={filters.time} />
        </div>
      </Card>

      {/* Layout principal */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_256px] gap-4">

        {/* Conteúdo */}
        <div className="space-y-3 min-w-0">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  O que está sendo comentado
                  <InfoTip side="bottom">
                    <p className="font-semibold text-foreground mb-1.5">Nuvem de palavras</p>
                    <p className="text-muted-foreground">Termos mais citados nos comentários do período selecionado.</p>
                  </InfoTip>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {CLOUD_PERIODS.map(({ value, label }) => (
                      <button key={value} onClick={() => setCloudPeriod(value)}
                        className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors',
                          cloudPeriod === value ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground')}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCloudExpanded(true)}
                    title="Expandir nuvem"
                    className="p-1.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <WordCloud texts={cloudTexts} loading={cloudLoading} />
            </CardContent>
          </Card>

          {/* Modal expandido da nuvem */}
          <Dialog open={cloudExpanded} onOpenChange={setCloudExpanded}>
            <DialogContent className="max-w-3xl w-full">
              <DialogTitle className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  O que está sendo comentado
                </div>
                <div className="flex items-center gap-1 mr-6">
                  {CLOUD_PERIODS.map(({ value, label }) => (
                    <button key={value} onClick={() => setCloudPeriod(value)}
                      className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors',
                        cloudPeriod === value ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
              </DialogTitle>
              <WordCloud texts={cloudTexts} loading={cloudLoading} height={460} />
            </DialogContent>
          </Dialog>

          {/* Tabs + ordenação + visualização */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center border-b border-border/60 flex-1 overflow-x-auto">
                {CONTENT_TABS.map(({ value, label }) => {
                  const count = value === 'all' ? posts.length
                    : value === 'trending'  ? trendingPosts.length
                    : value === 'candidate' ? candidatePosts.length
                    : analyzedPosts.length
                  return (
                    <button key={value} onClick={() => setContentTab(value)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap -mb-px',
                        contentTab === value
                          ? value === 'trending' ? 'border-red-500 text-red-400' : 'border-primary text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground',
                      )}>
                      {label}
                      {count > 0 && (
                        <span className={cn('text-[10px] px-1 py-0.5 rounded font-bold',
                          value === 'trending' && count > 0 ? 'bg-red-500/15 text-red-400' : 'bg-secondary text-muted-foreground')}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 pb-px">
                {/* Ordenação */}
                <select
                  value={filters.sort}
                  onChange={e => setFilters(f => ({ ...f, sort: e.target.value as typeof filters.sort }))}
                  className="h-7 px-2 rounded-md border border-border bg-card text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                >
                  {SORT_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {/* Visualização */}
                <div className="flex items-center border border-border rounded-md overflow-hidden">
                  <button onClick={() => setView('list')} title="Lista"
                    className={cn('p-1.5 transition-colors', view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setView('grid')} title="Grade"
                    className={cn('p-1.5 border-l border-border transition-colors', view === 'grid' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por texto da publicação…"
              className="w-full bg-card border border-border rounded-lg pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
          ) : loading ? (
            <div className="rounded-lg border border-border/60 overflow-hidden space-y-px">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-card animate-pulse border-b border-border/40" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          ) : (
            renderPostList(filteredPosts)
          )}
        </div>

        {/* ══ SIDEBAR ══ */}
        <div className="space-y-3">

          {/* 1. Top 5 por comentários */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <SideSection title="Top engajamento"
                tip={<InfoTip side="left">
                  <p className="font-semibold mb-1">Ranking por comentários</p>
                  <p className="text-xs text-muted-foreground">As 5 publicações com mais comentários no período.</p>
                </InfoTip>}>
                {loading ? (
                  <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-secondary rounded animate-pulse" />)}</div>
                ) : top5.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sem dados</p>
                ) : (
                  top5.map((p, i) => <TopPostItem key={p.id} post={p} rank={i + 1} />)
                )}
              </SideSection>
            </CardContent>
          </Card>

          {/* 2. Resumo de engajamento */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <SideSection title="Engajamento total">
                <div className="space-y-2">
                  <StatRow icon={<MessageCircle className="w-3 h-3" />} label="Comentários"
                    value={totalComments >= 1000 ? `${(totalComments/1000).toFixed(1)}k` : totalComments}
                    accent="text-primary" />
                  <StatRow icon={<Heart className="w-3 h-3" />} label="Reações/likes"
                    value={totalLikes >= 1000 ? `${(totalLikes/1000).toFixed(1)}k` : totalLikes} />
                  {totalViews > 0 && (
                    <StatRow icon={<Eye className="w-3 h-3" />} label="Visualizações"
                      value={totalViews >= 1000 ? `${(totalViews/1000).toFixed(1)}k` : totalViews} />
                  )}
                  <div className="border-t border-border/40 pt-2 mt-1 space-y-2">
                    <StatRow icon={<TrendingUp className="w-3 h-3" />} label="Méd. coment./post" value={avgComments} />
                    <StatRow icon={<Zap className="w-3 h-3" />} label="Eng. médio/post" value={engagementRate} />
                    <StatRow icon={<Activity className="w-3 h-3" />} label="Coment. (última 1h)"
                      value={commentsLastHour} accent={commentsLastHour > 50 ? 'text-primary' : 'text-foreground'} />
                    {bestHour && (
                      <StatRow icon={<Clock className="w-3 h-3" />} label="Hora de pico"
                        value={bestHour} accent="text-yellow-400" />
                    )}
                  </div>
                </div>
              </SideSection>
            </CardContent>
          </Card>

          {/* 3. Cobertura IA */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <SideSection title="Inteligência IA"
                tip={<InfoTip side="left">
                  <p className="font-semibold mb-1">O que é a análise por IA?</p>
                  <p className="text-xs text-muted-foreground mb-1.5">A IA editorial lê os comentários de uma publicação e identifica possíveis pautas jornalísticas, gerando um relatório com tópico principal, resumo e ideias de reportagem.</p>
                  <p className="text-xs text-muted-foreground"><strong className="text-foreground">Automático:</strong> posts que atingem score ≥ 65 (repercutindo) são analisados automaticamente. <strong className="text-foreground">Manual:</strong> clique em uma publicação e pressione "Analisar" para análise imediata.</p>
                </InfoTip>}>
                <div className="space-y-3">
                  {/* Barra de cobertura */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Repercutindo + Analisados</span>
                      <span className="font-bold text-foreground">{analyzedPosts.length}/{posts.length}</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all duration-700"
                        style={{ width: `${aiCoverage}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {aiCoverage > 0 ? `${aiCoverage}% cobertos` : 'Nenhuma análise iniciada ainda — clique em um post para analisar'}
                    </p>
                  </div>
                  {readyToAnalyze.length > 0 && (
                    <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
                      <p className="text-xs font-semibold text-yellow-500/90">
                        {readyToAnalyze.length} pronto{readyToAnalyze.length > 1 ? 's' : ''} para análise
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">score ≥ 40 — clique para analisar</p>
                    </div>
                  )}
                  {aiCoverage === 0 && readyToAnalyze.length === 0 && (
                    <p className="text-[10px] text-muted-foreground/60 italic">
                      Posts com score ≥ 40 aparecerão aqui prontos para análise.
                    </p>
                  )}
                </div>
              </SideSection>
            </CardContent>
          </Card>

          {/* 4. Distribuição de score */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <SideSection title="Distribuição · trendScore"
                tip={<InfoTip side="left">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p><strong className="trending-text">65+</strong> — Repercutindo, pautar agora</p>
                    <p><strong className="text-yellow-400">40–64</strong> — Aquecendo, monitore</p>
                    <p><strong className="text-muted-foreground">0–39</strong> — Monitoramento normal</p>
                  </div>
                </InfoTip>}>
                <div className="space-y-2">
                  {scoreDistribution.map(b => (
                    <BreakdownRow key={b.label} label={b.label} count={b.count} total={posts.length} color={b.color} />
                  ))}
                </div>
              </SideSection>
            </CardContent>
          </Card>

          {/* 5. Por plataforma */}
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-4">
              <SideSection title="Por plataforma · posts">
                {Object.keys(platformCounts).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sem dados</p>
                ) : (
                  Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).map(([p, count]) => (
                    <BreakdownRow key={p} label={PLATFORM_CONFIG[p]?.label ?? p}
                      count={count} total={posts.length} color={PLATFORM_CONFIG[p]?.color ?? 'bg-muted-foreground'} />
                  ))
                )}
              </SideSection>
              <div className="border-t border-border/40 pt-3">
                <SideSection title="Por plataforma · comentários">
                  {Object.keys(platformEngagement).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sem dados</p>
                  ) : (
                    Object.entries(platformEngagement).sort((a, b) => b[1] - a[1]).map(([p, count]) => (
                      <BreakdownRow key={p} label={PLATFORM_CONFIG[p]?.label ?? p}
                        count={count} total={totalComments} color={PLATFORM_CONFIG[p]?.color ?? 'bg-muted-foreground'}
                        extra={count >= 1000 ? `${(count/1000).toFixed(1)}k` : undefined} />
                    ))
                  )}
                </SideSection>
              </div>
            </CardContent>
          </Card>

          {/* 6. Status editorial */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <SideSection title="Status editorial"
                tip={<InfoTip side="left">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p><span className="trending-text font-semibold">Repercutindo</span> — pautar agora</p>
                    <p><span className="candidate-text font-semibold">Aquecendo</span> — observe</p>
                    <p><span className="text-muted-foreground font-semibold">Monitorando</span> — score baixo</p>
                    <p><span className="text-green-600 dark:text-green-400 font-semibold">Analisado</span> — IA processou</p>
                  </div>
                </InfoTip>}>
                <div className="space-y-2">
                  {statusBreakdown.filter(s => s.count > 0).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sem dados</p>
                  ) : statusBreakdown.map(s => (
                    <BreakdownRow key={s.label} label={s.label} count={s.count} total={posts.length} color={s.color} />
                  ))}
                </div>
              </SideSection>
            </CardContent>
          </Card>

          {/* 7. Post mais comentado — destaque */}
          {topPost && !loading && (
            <Card className="border-primary/30 bg-primary/[0.02]">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-yellow-400" />
                  <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Mais comentado</p>
                </div>
                <p className="text-sm text-foreground leading-snug line-clamp-3">
                  {topPost.text || <span className="italic text-muted-foreground">Sem legenda</span>}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <p className="text-2xl font-bold text-primary tabular-nums leading-none">
                      {topPost.metrics.comments >= 1000 ? `${(topPost.metrics.comments/1000).toFixed(1)}k` : topPost.metrics.comments.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">comentários</p>
                  </div>
                  <a href={topPost.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline font-medium">
                    Ver post <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[10px] text-muted-foreground/50">
                  {formatDistanceToNow(topPost.publishedAt.toDate(), { addSuffix: true, locale: ptBR })}
                </p>
              </CardContent>
            </Card>
          )}

          {/* 8. Post mais recente */}
          {mostRecent && !loading && (
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Mais recente</p>
                </div>
                <p className="text-xs text-foreground/80 leading-snug line-clamp-2">
                  {mostRecent.text || <span className="italic text-muted-foreground">Sem legenda</span>}
                </p>
                <p className="text-[10px] text-muted-foreground/50">
                  {formatDistanceToNow(mostRecent.publishedAt.toDate(), { addSuffix: true, locale: ptBR })}
                  {' · '}{PLATFORM_CONFIG[mostRecent.platform]?.label ?? mostRecent.platform}
                </p>
              </CardContent>
            </Card>
          )}

          {/* 9. Top palavras (chips com freq) */}
          {topWords.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <SideSection title={`Palavras em destaque · ${CLOUD_PERIODS.find(c => c.value === cloudPeriod)?.label}`}>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {topWords.map(([word, freq]) => (
                      <span key={word}
                        className="px-2 py-1 rounded-md bg-secondary border border-border/60 text-xs text-foreground/80 font-medium flex items-center gap-1.5">
                        {word}
                        <span className="text-[9px] text-muted-foreground/60 font-mono bg-background/50 rounded px-0.5">{freq}×</span>
                      </span>
                    ))}
                  </div>
                </SideSection>
              </CardContent>
            </Card>
          )}

          {/* 10. Nuvem compacta */}
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Nuvem · comentários</p>
                <div className="flex gap-1">
                  {CLOUD_PERIODS.map(({ value, label }) => (
                    <button key={value} onClick={() => setCloudPeriod(value)}
                      className={cn('text-[10px] px-1.5 py-0.5 rounded transition-colors',
                        cloudPeriod === value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <WordCloud texts={cloudTexts} loading={cloudLoading} />
            </CardContent>
          </Card>

          {/* 11. Instagram Insights */}
          <Card className="border-pink-500/20 bg-gradient-to-b from-pink-500/3 to-transparent">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-4 h-4 rounded-sm bg-gradient-to-br from-pink-400 via-purple-400 to-orange-400 flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] text-white font-bold">IG</span>
                </div>
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Instagram Insights</p>
              </div>
              <InstagramInsightsPanel />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
