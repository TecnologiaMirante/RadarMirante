import { useState, useEffect, useMemo } from 'react'
import {
  Activity, MessageCircle, Heart, TrendingUp, FileText,
  Zap, BarChart2, Award, Clock, ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { WordCloud } from '@/components/radar/WordCloud'
import { ActivityChart } from '@/components/radar/ActivityChart'
import { InstagramInsightsPanel } from '@/components/radar/InstagramInsightsPanel'
import { InfoTip } from '@/components/ui/InfoTip'
import { DateDropdown, getPresetLabel } from '@/components/ui/DateDropdown'
import { useTimeFilter } from '@/hooks/useTimeFilter'
import { getPosts, getRecentCommentTexts } from '@/services/radar'
import { useAccount } from '@/contexts/AccountContext'
import { cn } from '@/lib/utils'
import type { Timestamp } from 'firebase/firestore'
import type { RadarPost } from '@/types/radar'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Config ───────────────────────────────────────────────────────────────────

const TIME_MS: Record<string, number | null> = {
  now:  1  * 60 * 60 * 1000,
  '3h': 3  * 60 * 60 * 1000,
  '6h': 6  * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '2d':  2  * 24 * 60 * 60 * 1000,
  '3d':  3  * 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  '15d': 15 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  all:  null,
}

function StatCard({
  label, value, sub, icon, accent, delta, tooltip,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; accent?: string; delta?: number
  tooltip?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 p-4 bg-card border border-border/60 rounded-xl">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="opacity-60">{icon}</span>
        <span className="truncate flex-1">{label}</span>
        {tooltip && <InfoTip side="bottom">{tooltip}</InfoTip>}
      </div>
      <p className={cn('text-2xl font-bold tabular-nums leading-none tracking-tight', accent ?? 'text-foreground')}>{value}</p>
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

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p className="text-sm font-bold text-foreground">{title}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function PlatformBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-sm flex-shrink-0', color)} />
          <span className="text-foreground/80">{label}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground font-mono font-semibold tabular-nums">{count}</span>
          <span className="text-muted-foreground/50 w-7 text-right">{pct}%</span>
        </span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  instagram: { label: 'Instagram', color: 'bg-pink-400' },
  imirante:  { label: 'Site',      color: 'bg-blue-400' },
  facebook:  { label: 'Facebook',  color: 'bg-indigo-400' },
  youtube:   { label: 'YouTube',   color: 'bg-red-400' },
  x:         { label: 'X',         color: 'bg-zinc-400' },
}

function TopPostRow({ post, rank }: { post: RadarPost; rank: number }) {
  const preview = post.text.slice(0, 65).trimEnd() + (post.text.length > 65 ? '…' : '')
  return (
    <Link to={`/radar/post/${post.id}`}>
      <div className="flex items-start gap-2.5 py-2.5 border-b border-border/30 last:border-0 hover:bg-accent/20 -mx-2 px-2 rounded transition-colors cursor-pointer">
        <span className="text-xs font-mono font-bold text-muted-foreground/40 w-4 flex-shrink-0 mt-0.5">{rank}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs leading-snug text-foreground/90">
            {preview || <span className="italic text-muted-foreground">Sem legenda</span>}
          </p>
          <div className="flex items-center gap-2.5 mt-1">
            <span className="flex items-center gap-0.5 text-xs text-primary font-bold tabular-nums">
              <MessageCircle className="w-2.5 h-2.5" />
              {post.metrics.comments >= 1000 ? `${(post.metrics.comments/1000).toFixed(1)}k` : post.metrics.comments}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
              <Heart className="w-2 h-2" />
              {post.metrics.likes >= 1000 ? `${(post.metrics.likes/1000).toFixed(1)}k` : post.metrics.likes}
            </span>
            <span className={cn('text-[10px] font-bold',
              post.trendScore >= 65 ? 'text-red-400' : post.trendScore >= 40 ? 'text-primary' : 'text-muted-foreground'
            )}>
              ⚡{post.trendScore}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { account } = useAccount()
  const [allPosts, setAllPosts] = useState<RadarPost[]>([])
  const [loading, setLoading] = useState(true)
  const { time: displayTime, customFrom, customTo, set: setDisplayTime } = useTimeFilter()
  const [commentTexts, setCommentTexts] = useState<string[]>([])
  const [cloudLoading, setCloudLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getPosts({ platform: 'all', time: 'all', sort: 'recent' }, account)
      .then(data => setAllPosts(data))
      .catch(err => console.error('[Dashboard]', err))
      .finally(() => setLoading(false))
  }, [account])

  const posts = useMemo(() => {
    if (displayTime === 'custom') {
      const from = customFrom ?? 0
      const to = customTo ?? Date.now()
      return allPosts.filter(p => {
        const ms = (p.publishedAt as unknown as Timestamp).toMillis()
        return ms >= from && ms <= to
      })
    }
    const cutoff = TIME_MS[displayTime]
    if (cutoff === null) return allPosts
    const since = Date.now() - cutoff
    return allPosts.filter(p => {
      const ts = p.publishedAt as unknown as Timestamp
      return ts.toMillis() >= since
    })
  }, [allPosts, displayTime, customFrom, customTo])

  useEffect(() => {
    setCloudLoading(true)
    const cutoff = TIME_MS[displayTime] ?? null
    const sinceMs = cutoff !== null ? Date.now() - cutoff : Date.now() - 7 * 24 * 60 * 60 * 1000
    getRecentCommentTexts(sinceMs)
      .then(setCommentTexts)
      .catch(console.error)
      .finally(() => setCloudLoading(false))
  }, [displayTime])

  const trendingPosts  = useMemo(() => posts.filter(p => p.status === 'trending'),   [posts])
  const candidatePosts = useMemo(() => posts.filter(p => p.status === 'candidate'),  [posts])
  const analyzedPosts  = useMemo(() => posts.filter(p => p.status === 'analyzed'),   [posts])

  const totalComments  = useMemo(() => posts.reduce((s, p) => s + p.metrics.comments, 0), [posts])
  const totalLikes     = useMemo(() => posts.reduce((s, p) => s + p.metrics.likes, 0), [posts])
  const totalViews     = useMemo(() => posts.reduce((s, p) => s + (p.metrics.views ?? 0), 0), [posts])
  const scoredPosts    = useMemo(() => posts.filter(p => p.trendScore > 0), [posts])
  const avgScore       = scoredPosts.length ? Math.round(scoredPosts.reduce((s, p) => s + p.trendScore, 0) / scoredPosts.length) : 0
  const avgComments    = posts.length ? Math.round(totalComments / posts.length) : 0
  const aiCoverage     = posts.length > 0 ? Math.round((analyzedPosts.length / posts.length) * 100) : 0

  const topByComments  = useMemo(() => [...posts].sort((a, b) => b.metrics.comments - a.metrics.comments), [posts])
  const top8           = topByComments.slice(0, 8)

  const mostRecent = useMemo(() =>
    allPosts.length > 0
      ? [...allPosts].sort((a, b) =>
          (b.publishedAt as unknown as Timestamp).toMillis() -
          (a.publishedAt as unknown as Timestamp).toMillis()
        )[0]
      : null,
    [allPosts])

  const topWords = useMemo(() => {
    if (commentTexts.length === 0) return []
    const stopwords = new Set(['de','a','o','e','do','da','em','que','para','com','uma','um','no','na','os','as','se','por','mais','mas','foi','ele','ao','dos','das','já','sua','seu','tem','não','é','ou','quando','isso','esta','vai','só','porque','aqui','como','também','muito','sem','essa','esse','ser','ter','fazer','pode','sobre'])
    const freq: Record<string, number> = {}
    commentTexts.forEach(t => {
      t.toLowerCase().replace(/@[\w.]+/g, ' ').split(/\s+/).forEach(w => {
        const clean = w.replace(/[^a-záàâãéèêíóôõúüçñ]/gi, '')
        if (clean.length > 3 && clean.length <= 20 && !stopwords.has(clean)) freq[clean] = (freq[clean] ?? 0) + 1
      })
    })
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [commentTexts])

  const scoreDistribution = useMemo(() => [
    { label: '80+',   min: 80, max: 100, color: 'bg-red-500',              emoji: '🔥' },
    { label: '65–79', min: 65, max: 79,  color: 'bg-orange-400',           emoji: '📈' },
    { label: '40–64', min: 40, max: 64,  color: 'bg-yellow-400',           emoji: '👀' },
    { label: '0–39',  min: 0,  max: 39,  color: 'bg-muted-foreground/40',  emoji: '📊' },
  ].map(b => ({ ...b, count: posts.filter(p => p.trendScore >= b.min && p.trendScore <= b.max).length })), [posts])

  const bestHour = useMemo(() => {
    const today = new Date().toDateString()
    const hourMap: Record<number, number> = {}
    posts.forEach(p => {
      const d = (p.publishedAt as unknown as Timestamp).toDate()
      if (d.toDateString() !== today) return
      const h = d.getHours()
      hourMap[h] = (hourMap[h] ?? 0) + p.metrics.comments
    })
    const best = Object.entries(hourMap).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
    return best ? `${String(best[0]).padStart(2, '0')}h` : null
  }, [posts])

  const periodDeltas = useMemo(() => {
    if (posts.length < 4) return { posts: 0, comments: 0, score: 0 }
    const sorted = [...posts].sort((a, b) =>
      (a.publishedAt as unknown as Timestamp).toDate().getTime() - (b.publishedAt as unknown as Timestamp).toDate().getTime()
    )
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

  const earliestPostMs = useMemo(() => {
    if (allPosts.length === 0) return undefined
    return Math.min(...allPosts.map(p => (p.publishedAt as unknown as Timestamp).toMillis()))
  }, [allPosts])

  const overrideAllLabel = useMemo(() => {
    if (!earliestPostMs) return undefined
    const d = new Date(earliestPostMs)
    return `Desde ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [earliestPostMs])

  const timeLabel = getPresetLabel(displayTime, customFrom, customTo, overrideAllLabel)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <BarChart2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground leading-none">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading
                ? 'Carregando…'
                : `${posts.length} de ${allPosts.length} publicações · ${timeLabel.toLowerCase()}`}
            </p>
          </div>
        </div>
        <DateDropdown
          value={displayTime}
          customFrom={customFrom}
          customTo={customTo}
          onChange={(time, from, to) => setDisplayTime(time, from, to)}
          overrideAllLabel={overrideAllLabel}
        />
      </div>

      {/* KPI grid — 4 colunas × 2 linhas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={loading ? '—' : posts.length}
          sub={periodDeltas.posts !== 0 ? `${periodDeltas.posts > 0 ? '+' : ''}${periodDeltas.posts}% vs período ant.` : `${posts.length} publicações`}
          icon={<Activity className="w-3.5 h-3.5" />}
          delta={loading ? undefined : periodDeltas.posts} />
        <StatCard label="Repercutindo" value={loading ? '—' : trendingPosts.length}
          sub="trending agora" icon={<span className="text-xs">🔴</span>}
          accent={trendingPosts.length > 0 ? 'text-red-400' : undefined} />
        <StatCard label="Aquecendo" value={loading ? '—' : candidatePosts.length}
          sub="candidatos" icon={<TrendingUp className="w-3.5 h-3.5" />}
          accent={candidatePosts.length > 0 ? 'text-primary' : undefined} />
        <StatCard label="Hora de pico" value={loading ? '—' : bestHour ?? '—'}
          sub="hoje" icon={<Clock className="w-3.5 h-3.5" />}
          accent={bestHour ? 'text-yellow-400' : undefined} />
        <StatCard label="Comentários" value={loading ? '—' : totalComments >= 1000 ? `${(totalComments/1000).toFixed(1)}k` : totalComments}
          sub={`~${avgComments}/post`} icon={<MessageCircle className="w-3.5 h-3.5" />} accent="text-primary"
          delta={loading ? undefined : periodDeltas.comments}
          tooltip={<>
            <p className="font-semibold text-foreground mb-1">Total de comentários</p>
            <p className="text-muted-foreground">Soma de comentários de todas as publicações no período.</p>
            <p className="text-muted-foreground mt-1.5"><strong className="text-foreground">~{avgComments}/post</strong> é a média de comentários por publicação.</p>
          </>} />
        <StatCard label="Curtidas" value={loading ? '—' : totalLikes >= 1000 ? `${(totalLikes/1000).toFixed(1)}k` : totalLikes}
          sub={totalViews > 0 ? `${totalViews >= 1000 ? `${(totalViews/1000).toFixed(1)}k` : totalViews} views` : undefined}
          icon={<Heart className="w-3.5 h-3.5" />} />
        <StatCard label="Score médio" value={loading ? '—' : scoredPosts.length > 0 ? avgScore : '—'}
          sub={scoredPosts.length > 0 ? `${scoredPosts.length}/${posts.length} pontuados` : 'aguardando'}
          icon={<Zap className="w-3.5 h-3.5" />}
          accent={avgScore >= 65 ? 'text-red-400' : avgScore >= 40 ? 'text-primary' : undefined}
          delta={loading || scoredPosts.length === 0 ? undefined : periodDeltas.score}
          tooltip={<>
            <p className="font-semibold text-foreground mb-1.5">Trend Score médio (0–100)</p>
            <div className="space-y-1 text-muted-foreground">
              <p><strong className="text-red-400">🔥 80+</strong> — Viral, pautar agora</p>
              <p><strong className="text-orange-400">📈 65–79</strong> — Em alta, monitorar</p>
              <p><strong className="text-yellow-400">👀 40–64</strong> — Candidato</p>
              <p><strong className="text-muted-foreground">📊 0–39</strong> — Volume normal</p>
            </div>
          </>} />
        <StatCard label="Analisados IA" value={loading ? '—' : analyzedPosts.length}
          sub={`${aiCoverage}% cobertura`} icon={<FileText className="w-3.5 h-3.5" />}
          accent={analyzedPosts.length > 0 ? 'text-green-400' : undefined}
          tooltip={<>
            <p className="font-semibold text-foreground mb-1">Análises editoriais (IA)</p>
            <p className="text-muted-foreground mb-1">Publicações já processadas pela IA para identificar pautas jornalísticas.</p>
            <p className="text-muted-foreground"><strong className="text-foreground">{aiCoverage}% cobertura</strong> — proporção de posts analisados no período.</p>
          </>} />
      </div>

      {/* Engagement overview — acima do gráfico de atividade */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <SectionTitle title="Visão geral de engajamento" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total comentários', value: totalComments.toLocaleString('pt-BR'), icon: <MessageCircle className="w-4 h-4" />, accent: 'text-primary' },
              { label: 'Total curtidas',    value: totalLikes.toLocaleString('pt-BR'),    icon: <Heart className="w-4 h-4" />,          accent: 'text-pink-400' },
              { label: 'Eng. médio/post',   value: Math.round((totalComments + totalLikes) / Math.max(posts.length, 1)).toLocaleString('pt-BR'), icon: <Zap className="w-4 h-4" />, accent: 'text-yellow-400' },
              { label: 'Posts analisados',  value: `${analyzedPosts.length} / ${posts.length}`, icon: <Award className="w-4 h-4" />, accent: 'text-green-400' },
            ].map(item => (
              <div key={item.label} className="text-center space-y-1">
                <div className="flex items-center justify-center">
                  <span className="text-muted-foreground/50">{item.icon}</span>
                </div>
                <p className={cn('text-xl font-bold tabular-nums', item.accent)}>{loading ? '—' : item.value}</p>
                <p className="text-[10px] text-muted-foreground/60">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity chart */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <SectionTitle title="Publicações no período" sub={`· ${timeLabel.toLowerCase()}`} />
          <ActivityChart posts={posts} loading={loading} timeFilter={displayTime} />
        </CardContent>
      </Card>

      {/* Score distribution */}
      <Card className="border-border/60">
          <CardContent className="p-5">
            <SectionTitle title="Distribuição de score" />
            <div className="space-y-3">
              {scoreDistribution.map(b => (
                <PlatformBar
                  key={b.label}
                  label={`${b.emoji} Score ${b.label}`}
                  count={b.count}
                  total={posts.length}
                  color={b.color}
                />
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-2">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Prontos para analisar</p>
                <p className="text-xl font-bold text-primary">
                  {posts.filter(p => p.trendScore >= 65 && p.status !== 'analyzed').length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Cobertura IA</p>
                <p className="text-xl font-bold text-green-400">{aiCoverage}%</p>
              </div>
            </div>
      </CardContent>
      </Card>

      {/* WordCloud + sidebar direita */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 items-start">

        {/* Nuvem de palavras — ocupa toda a altura disponível */}
        <Card className="border-border/60">
          <CardContent className="p-5">
            <SectionTitle title="Palavras mais mencionadas" sub="· nos comentários coletados" />
            <WordCloud texts={commentTexts} loading={cloudLoading} height={380} />
          </CardContent>
        </Card>

        {/* Sidebar com itens do radar */}
        <div className="space-y-3">

          {/* Top posts */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2.5">Top engajamento</p>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 bg-secondary rounded animate-pulse" />
                  ))}
                </div>
              ) : top8.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sem dados</p>
              ) : (
                top8.slice(0, 6).map((p, i) => <TopPostRow key={p.id} post={p} rank={i + 1} />)
              )}
            </CardContent>
          </Card>

          {/* Mais recente */}
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
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground/50">
                    {formatDistanceToNow((mostRecent.publishedAt as unknown as Timestamp).toDate(), { addSuffix: true, locale: ptBR })}
                    {' · '}{PLATFORM_CONFIG[mostRecent.platform]?.label ?? mostRecent.platform}
                  </p>
                  <Link to={`/radar/post/${mostRecent.id}`}
                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                    ver <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Palavras em destaque */}
          {topWords.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2.5">Palavras em destaque</p>
                <div className="flex flex-wrap gap-1.5">
                  {topWords.map(([word, freq]) => (
                    <span key={word}
                      className="px-2 py-1 rounded-md bg-secondary border border-border/60 text-xs text-foreground/80 font-medium flex items-center gap-1.5">
                      {word}
                      <span className="text-[9px] text-muted-foreground/60 font-mono bg-background/50 rounded px-0.5">{freq}×</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instagram Insights */}
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
