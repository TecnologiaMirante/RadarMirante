// ─── EM PRODUÇÃO ─────────────────────────────────────────────────────────────
// Para reativar: apague as 5 linhas abaixo e mude InstagramPageFull para export default function InstagramPage
import { EmProducao } from '@/components/ui/EmProducao'
export default function InstagramPage() {
  return <EmProducao titulo="Instagram · Métricas do perfil" descricao="O painel de métricas do Instagram está sendo configurado e estará disponível em breve." />
}
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, LineChart, BarChart,
  Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  Users, Eye, TrendingUp, Globe, Clock, RefreshCw,
  Heart, Instagram as InstagramIcon, ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { InfoTip } from '@/components/ui/InfoTip'
import {
  getInstagramProfile,
  getInstagramInsights,
  getOnlineFollowers,
  getInstagramAudience,
} from '@/services/instagram'
import { getPosts } from '@/services/radar'
import type { InstagramDailyInsight, InstagramAccountProfile, InstagramOnlineFollowers, InstagramAudience } from '@/types/instagram'
import type { RadarPost } from '@/types/radar'
import type { Timestamp } from 'firebase/firestore'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sum(arr: InstagramDailyInsight[], key: keyof InstagramDailyInsight): number {
  return arr.reduce((s, d) => s + (Number(d[key]) || 0), 0)
}

function pctDelta(curr: number, prev: number): number {
  if (prev === 0) return 0
  return Math.round(((curr - prev) / prev) * 100)
}

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('pt-BR')
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, delta, icon, accent, tip,
}: {
  label: string; value: string; delta?: number
  icon: React.ReactNode; accent?: string; tip?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 p-4 bg-card border border-border/60 rounded-xl">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="opacity-60">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {tip && <InfoTip side="bottom">{tip}</InfoTip>}
      </div>
      <p className={cn('text-2xl font-bold tabular-nums leading-none tracking-tight', accent ?? 'text-foreground')}>
        {value}
      </p>
      {delta !== undefined && delta !== 0 && (
        <span className={cn('text-[10px] font-bold', delta > 0 ? 'text-green-400' : 'text-red-400')}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}% vs período ant.
        </span>
      )}
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <p className="text-sm font-bold text-foreground">{title}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  formatter?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="font-bold text-muted-foreground">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-foreground/70">{p.name}:</span>
          <span className="font-bold text-foreground">{formatter ? formatter(p.value) : p.value.toLocaleString('pt-BR')}</span>
        </div>
      ))}
    </div>
  )
}

function AudienceBar({ label, value, total, color }: {
  label: string; value: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/80 truncate max-w-[160px]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-mono">{fmtN(value)}</span>
          <span className="text-muted-foreground/50 w-8 text-right">{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Implementação completa (pronta para ativar) ──────────────────────────────

type Period = 7 | 14 | 30

const PERIODS: { value: Period; label: string }[] = [
  { value: 7,  label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
]

const AGE_BUCKETS = ['13-17','18-24','25-34','35-44','45-54','55-64','65+']

export function InstagramPageFull() {
  const [profile, setProfile]   = useState<InstagramAccountProfile | null>(null)
  const [allInsights, setAllInsights] = useState<InstagramDailyInsight[]>([])
  const [online, setOnline]     = useState<InstagramOnlineFollowers | null>(null)
  const [audience, setAudience] = useState<InstagramAudience | null>(null)
  const [posts, setPosts]       = useState<RadarPost[]>([])
  const [loading, setLoading]   = useState(true)
  const [period, setPeriod]     = useState<Period>(14)

  async function load() {
    setLoading(true)
    try {
      const [p, i, o, a, ps] = await Promise.all([
        getInstagramProfile(),
        getInstagramInsights(30),
        getOnlineFollowers(),
        getInstagramAudience().catch(() => null),
        getPosts({ platform: 'instagram', time: 'all', sort: 'comments' }),
      ])
      setProfile(p)
      setAllInsights(i)
      setOnline(o)
      setAudience(a)
      setPosts(ps)
    } catch (err) {
      console.error('[InstagramPage]', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const insights     = useMemo(() => allInsights.slice(-period),            [allInsights, period])
  const prevInsights = useMemo(() => allInsights.slice(-period * 2, -period), [allInsights, period])

  // KPIs
  const reach7       = sum(insights, 'reach')
  const prevReach    = sum(prevInsights, 'reach')
  const impr7        = sum(insights, 'impressions')
  const prevImpr     = sum(prevInsights, 'impressions')
  const pviews7      = sum(insights, 'profileViews')
  const prevPviews   = sum(prevInsights, 'profileViews')
  const wclicks7     = sum(insights, 'websiteClicks')
  const prevWclicks  = sum(prevInsights, 'websiteClicks')
  const gain7        = sum(insights, 'followerGain')
  const prevGain     = sum(prevInsights, 'followerGain')
  const latestFollow = allInsights.length > 0
    ? allInsights[allInsights.length - 1].followerCount
    : (profile?.followersCount ?? 0)

  // Charts data
  const followerChart = useMemo(() => insights.map(d => ({
    label: fmtDate(d.date),
    seguidores: d.followerCount,
    ganho: Math.max(0, d.followerGain),
    perda: Math.min(0, d.followerGain),
  })), [insights])

  const reachChart = useMemo(() => insights.map(d => ({
    label: fmtDate(d.date),
    alcance: d.reach,
    impressões: d.impressions,
  })), [insights])

  const profileChart = useMemo(() => insights.map(d => ({
    label: fmtDate(d.date),
    'visitas ao perfil': d.profileViews,
    'cliques no link': d.websiteClicks,
  })), [insights])

  // Audience processing
  const genderAgeSummary = useMemo(() => {
    if (!audience?.genderAge) return null
    const totals: Record<string, number> = {}
    const byAgeGender: Record<string, Record<string, number>> = {}
    let grand = 0
    for (const [key, val] of Object.entries(audience.genderAge)) {
      const [gender, age] = key.split('.')
      if (!gender || !age) continue
      totals[gender] = (totals[gender] ?? 0) + val
      if (!byAgeGender[age]) byAgeGender[age] = {}
      byAgeGender[age][gender] = (byAgeGender[age][gender] ?? 0) + val
      grand += val
    }
    return { totals, byAgeGender, grand }
  }, [audience])

  const topCountries = useMemo(() => {
    if (!audience?.countries) return []
    return Object.entries(audience.countries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [audience])

  const topCities = useMemo(() => {
    if (!audience?.cities) return []
    return Object.entries(audience.cities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [audience])

  const totalAudienceCountry = topCountries.reduce((s, [, v]) => s + v, 0)
  const totalAudienceCity    = topCities.reduce((s, [, v]) => s + v, 0)

  // Top posts with insights
  const topPostsWithInsights = useMemo(() =>
    posts
      .filter(p => (p as RadarPost & { insights?: { reach?: number } }).insights?.reach)
      .slice(0, 8),
    [posts]
  )
  const topPostsFallback = posts.slice(0, 8)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
            <InstagramIcon className="w-4 h-4 text-pink-400" />
          </div>
          <div className="space-y-1.5">
            <div className="h-5 w-32 bg-secondary rounded animate-pulse" />
            <div className="h-3 w-48 bg-secondary rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-card border border-border/60 rounded-xl animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 via-purple-500 to-orange-400 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">
              {profile?.username?.slice(0, 1).toUpperCase() ?? 'I'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground leading-none">
                @{profile?.username ?? 'imirante'}
              </h1>
              {profile?.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                  <Globe className="w-2.5 h-2.5" />site
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{profile?.name ?? 'Mirante'}</p>
            {profile?.biography && (
              <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-sm line-clamp-2">{profile.biography}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground/70">
              <span><strong className="text-foreground">{fmtN(latestFollow)}</strong> seguidores</span>
              {profile?.followsCount !== undefined && (
                <span><strong className="text-foreground">{fmtN(profile.followsCount)}</strong> seguindo</span>
              )}
              {profile?.mediaCount !== undefined && (
                <span><strong className="text-foreground">{profile.mediaCount}</strong> posts</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {PERIODS.map(({ value, label }) => (
            <button key={value} onClick={() => setPeriod(value)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                period === value
                  ? 'bg-pink-500/10 text-pink-400 border-pink-500/30'
                  : 'bg-card text-muted-foreground border-border hover:border-pink-500/30 hover:text-foreground')}>
              {label}
            </button>
          ))}
          <button onClick={() => void load()}
            className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── KPI grid ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Seguidores" value={fmtN(latestFollow)}
          delta={pctDelta(gain7, prevGain)}
          icon={<Users className="w-3.5 h-3.5" />} accent="text-pink-400"
          tip={<>
            <p className="font-semibold text-foreground mb-1">Total de seguidores</p>
            <p className="text-muted-foreground">Contagem atual da conta. O delta compara o ganho/perda de seguidores deste período vs o anterior.</p>
          </>} />
        <KpiCard label={`Alcance · ${period}d`} value={fmtN(reach7)}
          delta={pctDelta(reach7, prevReach)}
          icon={<Eye className="w-3.5 h-3.5" />} accent="text-green-400" />
        <KpiCard label={`Impressões · ${period}d`} value={fmtN(impr7)}
          delta={pctDelta(impr7, prevImpr)}
          icon={<TrendingUp className="w-3.5 h-3.5" />} accent="text-primary" />
        <KpiCard label={`Visitas ao perfil · ${period}d`} value={fmtN(pviews7)}
          delta={pctDelta(pviews7, prevPviews)}
          icon={<InstagramIcon className="w-3.5 h-3.5" />} />
        <KpiCard label={`Cliques no link · ${period}d`} value={fmtN(wclicks7)}
          delta={pctDelta(wclicks7, prevWclicks)}
          icon={<Globe className="w-3.5 h-3.5" />} accent="text-yellow-400" />
        <KpiCard label={`Novos seguidores · ${period}d`}
          value={gain7 >= 0 ? `+${fmtN(gain7)}` : fmtN(gain7)}
          delta={pctDelta(gain7, prevGain)}
          icon={<Heart className="w-3.5 h-3.5" />}
          accent={gain7 >= 0 ? 'text-green-400' : 'text-red-400'} />
      </div>

      {/* ── Follower growth chart ────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <SectionTitle title="Crescimento de seguidores" sub={`· últimos ${period} dias`} />
          {followerChart.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-8">Sem dados para o período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={followerChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50} tickFormatter={fmtN} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTooltip formatter={fmtN} />} />
                <Bar yAxisId="right" dataKey="ganho" name="ganho" fill="hsl(142 76% 36%)" fillOpacity={0.5} radius={[2, 2, 0, 0]} />
                <Line yAxisId="left" type="monotone" dataKey="seguidores" name="seguidores" stroke="#f472b6" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Reach + Impressions ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <SectionTitle title="Alcance e Impressões" sub={`· ${period}d`} />
            {reachChart.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-8">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={reachChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={45} tickFormatter={fmtN} />
                  <Tooltip content={<ChartTooltip formatter={fmtN} />} />
                  <Line type="monotone" dataKey="alcance" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="impressões" stroke="hsl(210 100% 56%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-0.5 bg-green-500 rounded-full inline-block" />alcance
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-0.5 bg-primary rounded-full inline-block" />impressões
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5">
            <SectionTitle title="Visitas ao perfil e cliques" sub={`· ${period}d`} />
            {profileChart.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-8">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={profileChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} tickFormatter={fmtN} />
                  <Tooltip content={<ChartTooltip formatter={fmtN} />} />
                  <Line type="monotone" dataKey="visitas ao perfil" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cliques no link" stroke="#fbbf24" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-0.5 bg-violet-400 rounded-full inline-block" />visitas
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-0.5 bg-yellow-400 rounded-full inline-block" />cliques no link
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Audience demographics ────────────────────────────────────────────── */}
      {audience && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Gender + Age */}
          <Card className="border-border/60 lg:col-span-1">
            <CardContent className="p-5">
              <SectionTitle title="Audiência · gênero e idade" />
              {genderAgeSummary ? (
                <div className="space-y-4">
                  {/* Gender totals */}
                  <div className="flex gap-3">
                    {Object.entries(genderAgeSummary.totals).map(([g, v]) => {
                      const pct = genderAgeSummary.grand > 0 ? Math.round((v / genderAgeSummary.grand) * 100) : 0
                      const label = g === 'M' ? 'Homens' : g === 'F' ? 'Mulheres' : 'Outro'
                      const color = g === 'M' ? 'text-blue-400' : g === 'F' ? 'text-pink-400' : 'text-muted-foreground'
                      return (
                        <div key={g} className="flex-1 text-center bg-secondary/40 rounded-lg p-2.5">
                          <p className={cn('text-xl font-bold', color)}>{pct}%</p>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      )
                    })}
                  </div>
                  {/* Age distribution */}
                  <div className="space-y-2">
                    {AGE_BUCKETS.map(age => {
                      const byGender = genderAgeSummary.byAgeGender[age] ?? {}
                      const total = Object.values(byGender).reduce((s, v) => s + v, 0)
                      const pct = genderAgeSummary.grand > 0 ? Math.round((total / genderAgeSummary.grand) * 100) : 0
                      return (
                        <div key={age} className="flex items-center gap-2 text-xs">
                          <span className="w-11 text-muted-foreground flex-shrink-0">{age}</span>
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-pink-400/60 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-muted-foreground/60 w-8 text-right">{pct}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">
                  Dados de audiência ainda não sincronizados.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Countries */}
          <Card className="border-border/60">
            <CardContent className="p-5">
              <SectionTitle title="Audiência · países" />
              {topCountries.length > 0 ? (
                <div className="space-y-2.5">
                  {topCountries.map(([country, val]) => (
                    <AudienceBar key={country} label={country} value={val} total={totalAudienceCountry} color="bg-primary/60" />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">Sem dados.</p>
              )}
            </CardContent>
          </Card>

          {/* Cities */}
          <Card className="border-border/60">
            <CardContent className="p-5">
              <SectionTitle title="Audiência · cidades" />
              {topCities.length > 0 ? (
                <div className="space-y-2.5">
                  {topCities.map(([city, val]) => (
                    <AudienceBar key={city} label={city} value={val} total={totalAudienceCity} color="bg-violet-400/60" />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">Sem dados.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Online followers by hour ─────────────────────────────────────────── */}
      {online && online.byHour.length === 24 && (
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-pink-400 opacity-70" />
                <p className="text-sm font-bold text-foreground">Seguidores online por hora</p>
              </div>
              <span className="text-xs text-muted-foreground/60">
                pico às <strong className="text-foreground">{String(online.byHour.indexOf(Math.max(...online.byHour))).padStart(2, '0')}h</strong>
              </span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart
                data={online.byHour.map((v, h) => ({ label: `${String(h).padStart(2, '0')}h`, online: v }))}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={3} />
                <YAxis hide />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-popover border border-border rounded px-2 py-1 text-xs shadow-lg">
                      <p className="font-bold text-foreground">{label}</p>
                      <p className="text-pink-400">{Number(payload[0].value).toFixed(1)}% online</p>
                    </div>
                  )
                }} />
                <Bar dataKey="online" name="% online" fill="#f472b6" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-muted-foreground/40 mt-2 text-center">
              % dos seguidores ativos em cada hora do dia · {online.date}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Top posts ────────────────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <SectionTitle
            title="Top posts · Instagram"
            sub={topPostsWithInsights.length > 0 ? '· por alcance' : '· por comentários'}
          />
          {(topPostsWithInsights.length > 0 ? topPostsWithInsights : topPostsFallback).length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">Nenhum post coletado ainda.</p>
          ) : (
            <div className="space-y-0 divide-y divide-border/40">
              {(topPostsWithInsights.length > 0 ? topPostsWithInsights : topPostsFallback).map((post, i) => {
                const pi = (post as RadarPost & { insights?: { reach?: number; impressions?: number; saved?: number } }).insights
                const publishedAt = (post.publishedAt as unknown as Timestamp).toDate()
                const preview = post.text.slice(0, 70).trimEnd() + (post.text.length > 70 ? '…' : '')
                return (
                  <div key={post.id} className="flex items-start gap-3 py-3">
                    <span className="text-xs font-mono text-muted-foreground/40 w-4 flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground/90 leading-snug">
                        {preview || <span className="italic text-muted-foreground">Sem legenda</span>}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {pi?.reach !== undefined && (
                          <span className="flex items-center gap-0.5 text-[10px] text-green-400 font-semibold">
                            <Eye className="w-2.5 h-2.5" /> {fmtN(pi.reach)} alcance
                          </span>
                        )}
                        {pi?.impressions !== undefined && (
                          <span className="flex items-center gap-0.5 text-[10px] text-primary font-semibold">
                            <TrendingUp className="w-2.5 h-2.5" /> {fmtN(pi.impressions)} impr.
                          </span>
                        )}
                        {pi?.saved !== undefined && (
                          <span className="flex items-center gap-0.5 text-[10px] text-yellow-400 font-semibold">
                            ★ {fmtN(pi.saved)} salvos
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                          💬 {fmtN(post.metrics.comments)}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                          ♥ {fmtN(post.metrics.likes)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40 ml-auto">
                          {formatDistanceToNow(publishedAt, { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <a href={post.url} target="_blank" rel="noopener noreferrer"
                      className="text-muted-foreground/30 hover:text-primary transition-colors flex-shrink-0">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!audience && !loading && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-xs text-muted-foreground">
          <strong className="text-yellow-500">Dados de audiência</strong> (gênero, idade, países, cidades) ainda não foram sincronizados.
          Force uma sincronização agora:
          <code className="block mt-2 bg-secondary rounded px-2 py-1 text-[11px] font-mono">
            gcloud functions call syncInsights --project radarimirante --region southamerica-east1
          </code>
        </div>
      )}
    </div>
  )
}
