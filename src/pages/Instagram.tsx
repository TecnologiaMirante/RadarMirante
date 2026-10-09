import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ComposedChart, LineChart,
  Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  Users, Eye, TrendingUp, Globe, RefreshCw,
  Heart, MessageCircle, Instagram as InstagramIcon, Zap, Play, Radio,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { InfoTip } from '@/components/ui/InfoTip'
import {
  getInstagramProfile,
  getInstagramInsights,
  getInstagramAudience,
  getInstagramWeeklyActivity,
  getInstagramAggregateInsights,
} from '@/services/instagram'
import { getPosts } from '@/services/radar'
import type {
  InstagramDailyInsight, InstagramAccountProfile, InstagramAudience,
  InstagramWeeklyActivity, InstagramAggregateInsights,
} from '@/types/instagram'
import type { RadarPost } from '@/types/radar'
import type { Timestamp } from 'firebase/firestore'
import { cn } from '@/lib/utils'
import { useAccount } from '@/contexts/AccountContext'
import { MonitoringSince, availableDays } from '@/components/ui/MonitoringSince'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Country names ────────────────────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  AF: 'Afeganistão', ZA: 'África do Sul', AL: 'Albânia', DE: 'Alemanha',
  DZ: 'Argélia', SA: 'Arábia Saudita', AR: 'Argentina', AU: 'Austrália',
  AT: 'Áustria', AZ: 'Azerbaijão', BE: 'Bélgica', BD: 'Bangladesh',
  BO: 'Bolívia', BR: 'Brasil', BG: 'Bulgária', CA: 'Canadá',
  CL: 'Chile', CN: 'China', CO: 'Colômbia', KR: 'Coreia do Sul',
  CR: 'Costa Rica', HR: 'Croácia', CU: 'Cuba', DK: 'Dinamarca',
  EC: 'Equador', EG: 'Egito', SV: 'El Salvador', AE: 'Emirados Árabes',
  SK: 'Eslováquia', ES: 'Espanha', US: 'Estados Unidos', ET: 'Etiópia',
  PH: 'Filipinas', FI: 'Finlândia', FR: 'França', GH: 'Gana',
  GR: 'Grécia', GT: 'Guatemala', HT: 'Haiti', HN: 'Honduras',
  HK: 'Hong Kong', HU: 'Hungria', IN: 'Índia', ID: 'Indonésia',
  IQ: 'Iraque', IR: 'Irã', IE: 'Irlanda', IL: 'Israel',
  IT: 'Itália', JP: 'Japão', JO: 'Jordânia', KE: 'Quênia',
  MX: 'México', MA: 'Marrocos', MY: 'Malásia', NG: 'Nigéria',
  NO: 'Noruega', NZ: 'Nova Zelândia', NL: 'Países Baixos', PK: 'Paquistão',
  PA: 'Panamá', PY: 'Paraguai', PE: 'Peru', PL: 'Polônia',
  PT: 'Portugal', PR: 'Porto Rico', CZ: 'República Tcheca',
  DO: 'República Dominicana', RO: 'Romênia', RU: 'Rússia',
  SN: 'Senegal', RS: 'Sérvia', SG: 'Singapura', SY: 'Síria',
  LK: 'Sri Lanka', SE: 'Suécia', CH: 'Suíça', TW: 'Taiwan',
  TZ: 'Tanzânia', TH: 'Tailândia', TR: 'Turquia', UA: 'Ucrânia',
  UY: 'Uruguai', UZ: 'Uzbequistão', VE: 'Venezuela', VN: 'Vietnã',
  ZW: 'Zimbábue', AO: 'Angola', CV: 'Cabo Verde', CM: 'Camarões',
  MZ: 'Moçambique', GW: 'Guiné-Bissau', ST: 'São Tomé e Príncipe',
  TL: 'Timor-Leste', GQ: 'Guiné Equatorial',
}

function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code
}

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
  label, value, delta, icon, accent, tip, pending, dim,
}: {
  label: string; value: string; delta?: number
  icon: React.ReactNode; accent?: string; tip?: React.ReactNode; pending?: boolean
  dim?: boolean  // card pertence ao grupo "acumulando" — visual levemente apagado
}) {
  return (
    <div className={cn(
      'flex flex-col gap-1.5 p-4 bg-card border rounded-xl transition-opacity',
      dim ? 'border-amber-500/20 opacity-75' : 'border-border/60',
    )}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="opacity-60">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {tip && <InfoTip side="bottom">{tip}</InfoTip>}
      </div>
      {pending ? (
        <>
          <p className="text-xl leading-none">⛏️</p>
          <span className="text-[10px] text-muted-foreground/60 italic leading-tight">Garimpando…</span>
        </>
      ) : (
        <>
          <p className={cn('text-2xl font-bold tabular-nums leading-none tracking-tight', accent ?? 'text-foreground')}>
            {value}
          </p>
          {delta !== undefined && delta !== 0 && (
            <span className={cn('text-[10px] font-bold', delta > 0 ? 'text-green-400' : 'text-red-400')}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}% vs período ant.
            </span>
          )}
        </>
      )}
    </div>
  )
}

function SectionTitle({ title, sub, snapshot }: { title: string; sub?: string; snapshot?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <p className="text-sm font-bold text-foreground">{title}</p>
      {snapshot && (
        <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground/60 border border-border/60">
          retrato atual
        </span>
      )}
      {!snapshot && sub && <p className="text-xs text-muted-foreground">{sub}</p>}
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

function FollowerTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload.find(p => p.name === 'seguidores')?.value ?? 0
  const ganho = payload.find(p => p.name === 'ganho')?.value ?? 0
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2.5 text-xs shadow-xl space-y-1.5 min-w-44">
      <p className="font-bold text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between gap-4 pt-0.5 border-t border-border/40">
        <span className="flex items-center gap-1.5 text-foreground/70">
          <span className="w-2 h-0.5 rounded bg-pink-400 inline-block" />Total de seguidores
        </span>
        <span className="font-bold text-pink-400">{fmtN(total)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-foreground/70">
          <span className="w-2 h-2 rounded-sm bg-green-500/60 inline-block" />Ganho do dia
        </span>
        <span className={`font-bold ${ganho >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {ganho >= 0 ? '+' : ''}{ganho.toLocaleString('pt-BR')}
        </span>
      </div>
    </div>
  )
}

function MiningPlaceholder({ metric }: { metric: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 select-none">
      <style>{`@keyframes dig{0%{transform:rotate(-20deg) translateY(0)}50%{transform:rotate(20deg) translateY(3px)}100%{transform:rotate(-20deg) translateY(0)}}`}</style>
      <div className="text-4xl leading-none" style={{ animation: 'dig 0.9s ease-in-out infinite' }}>⛏️</div>
      <p className="text-sm font-semibold text-foreground/60">Garimpando <span className="italic">{metric}</span>…</p>
      <p className="text-[11px] text-muted-foreground/50 text-center max-w-56 leading-relaxed">
        Aguardando aprovação da Meta para liberar este dado. Em breve estará aqui!
      </p>
    </div>
  )
}

function BreakdownFollowType({ data, label }: { data: Record<string, number>; label: string }) {
  const tot = Object.values(data).reduce((s, v) => s + v, 0)
  const fol = data['FOLLOWER'] ?? 0
  const non = data['NON_FOLLOWER'] ?? 0
  const folPct = tot > 0 ? Math.round(fol / tot * 1000) / 10 : 0
  const nonPct = tot > 0 ? Math.round(non / tot * 1000) / 10 : 0
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${folPct}%` }} />
          </div>
          <span className="text-xs font-semibold text-foreground/80 w-10 text-right">{folPct}%</span>
          <span className="text-xs text-muted-foreground w-24">seguidores</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-sky-400 rounded-full" style={{ width: `${nonPct}%` }} />
          </div>
          <span className="text-xs font-semibold text-foreground/80 w-10 text-right">{nonPct}%</span>
          <span className="text-xs text-muted-foreground w-24">não seguidores</span>
        </div>
      </div>
    </div>
  )
}

function BreakdownMediaType({ data, label }: { data: Record<string, number>; label: string }) {
  const tot = Object.values(data).reduce((s, v) => s + v, 0)
  const items = [
    { key: 'POST',  label: 'Posts',   color: 'bg-primary' },
    { key: 'REEL',  label: 'Reels',   color: 'bg-pink-400' },
    { key: 'STORY', label: 'Stories', color: 'bg-amber-400' },
  ].filter(x => (data[x.key] ?? 0) > 0)
  if (!items.length) return null
  return (
    <div className="mt-4 space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-2">{label}</p>
      {items.map(({ key, label: lbl, color }) => {
        const pct = tot > 0 ? Math.round((data[key] ?? 0) / tot * 1000) / 10 : 0
        return (
          <div key={key} className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-foreground/80 w-10 text-right">{pct}%</span>
            <span className="text-xs text-muted-foreground w-16">{lbl}</span>
          </div>
        )
      })}
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
type PostSort = 'engagement' | 'comments' | 'likes' | 'plays'

// Formata milissegundos como "Xs" ou "Xm Ys"
function fmtMs(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
]

const POST_SORTS: { value: PostSort; label: string }[] = [
  { value: 'engagement', label: 'Engajamento' },
  { value: 'comments',   label: 'Comentários' },
  { value: 'likes',      label: 'Curtidas' },
  { value: 'plays',      label: 'Reels' },
]

const AGE_BUCKETS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']

export default function InstagramPage() {
  const { account, getAccount } = useAccount()
  const accountConfig = getAccount(account)
  const since = accountConfig?.collectingSince
  const maxDays = since ? availableDays(since) : 30
  const [profile, setProfile] = useState<InstagramAccountProfile | null>(null)
  const [allInsights, setAllInsights] = useState<InstagramDailyInsight[]>([])
  const [audience, setAudience] = useState<InstagramAudience | null>(null)
  const [weeklyActivity, setWeeklyActivity] = useState<InstagramWeeklyActivity | null>(null)
  const [aggregateInsights, setAggregateInsights] = useState<InstagramAggregateInsights | null>(null)
  const [posts, setPosts] = useState<RadarPost[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>(14)
  // Clamp period to available data whenever account changes
  useEffect(() => {
    if (maxDays < period) setPeriod(maxDays <= 7 ? 7 : 14)
  }, [account]) // eslint-disable-line react-hooks/exhaustive-deps
  const [postSort, setPostSort] = useState<PostSort>('engagement')

  async function load() {
    setLoading(true)
    try {
      const [p, i, a, wa] = await Promise.all([
        getInstagramProfile(account),
        getInstagramInsights(30, account),
        getInstagramAudience(account).catch(() => null),
        getInstagramWeeklyActivity(account).catch(() => null),
      ])
      const ps = await getPosts({ platform: 'instagram', time: 'all', sort: 'comments' }, account)
      setProfile(p)
      setAllInsights(i)
      setAudience(a)
      setWeeklyActivity(wa)
      setPosts(ps)
    } catch (err) {
      console.error('[InstagramPage]', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadAgg() {
    const agg = await getInstagramAggregateInsights(account, period as 7 | 14 | 30).catch(() => null)
    setAggregateInsights(agg)
  }

  useEffect(() => { void load() }, [account])
  useEffect(() => { void loadAgg() }, [account, period])

  const insights = useMemo(() => allInsights.slice(-period), [allInsights, period])
  const prevInsights = useMemo(() => allInsights.slice(-period * 2, -period), [allInsights, period])

  // KPIs
  const reach7 = sum(insights, 'reach')
  const prevReach = sum(prevInsights, 'reach')
  const impr7 = sum(insights, 'impressions')
  const prevImpr = sum(prevInsights, 'impressions')
  const pviews7 = sum(insights, 'profileViews')
  const prevPviews = sum(prevInsights, 'profileViews')
  const wclicks7 = sum(insights, 'websiteClicks')
  const prevWclicks = sum(prevInsights, 'websiteClicks')
  const gain7 = sum(insights, 'followerGain')
  const prevGain = sum(prevInsights, 'followerGain')

  // Detecta métricas que ainda não têm dados
  const hasReach           = sum(allInsights, 'reach') > 0
  const hasImpressions     = sum(allInsights, 'impressions') > 0
  const hasProfileViews    = sum(allInsights, 'profileViews') > 0
  const hasWebsiteClicks   = sum(allInsights, 'websiteClicks') > 0
  const hasEngaged         = sum(allInsights, 'accountsEngaged') > 0
  const hasInteractions    = sum(allInsights, 'totalInteractions') > 0

  // KPIs de engajamento
  const engaged7    = sum(insights, 'accountsEngaged')
  const prevEngaged = sum(prevInsights, 'accountsEngaged')
  const interact7   = sum(insights, 'totalInteractions')
  const prevInter   = sum(prevInsights, 'totalInteractions')

  // Taxa de engajamento = contas engajadas / alcance
  const engRate     = reach7 > 0 && engaged7 > 0 ? Math.round((engaged7 / reach7) * 1000) / 10 : 0

  // Detecta métricas cujo histórico ainda está acumulando (7d ≥ 90% do total de 30d → dados antigos zerados)
  const impr30  = sum(allInsights, 'impressions')
  const reach30 = sum(allInsights, 'reach')
  const pv30    = sum(allInsights, 'profileViews')
  const wc30    = sum(allInsights, 'websiteClicks')
  const eng30   = sum(allInsights, 'accountsEngaged')
  const int30   = sum(allInsights, 'totalInteractions')
  const imprAccumulating    = hasImpressions  && impr7  >= impr30  * 0.9
  const pviewsAccumulating  = hasProfileViews && pviews7 >= pv30   * 0.9
  const wcAccumulating      = hasWebsiteClicks && wclicks7 >= wc30  * 0.9
  const engagedAccumulating = hasEngaged      && engaged7 >= eng30  * 0.9
  const interAccumulating   = hasInteractions && interact7 >= int30 * 0.9

  const latestFollow = allInsights.length > 0
    ? (allInsights[allInsights.length - 1].followerCount || profile?.followersCount || 0)
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
  const totalAudienceCity = topCities.reduce((s, [, v]) => s + v, 0)

  const sortedPosts = useMemo(() => {
    // "Plays (Reels)": filtra apenas Reels antes de ordenar
    const base = postSort === 'plays'
      ? posts.filter(p => p.url.includes('/reel/') || (p.insights?.plays ?? 0) > 0)
      : [...posts]

    return base.sort((a, b) => {
      switch (postSort) {
        case 'engagement': return (b.metrics.comments + b.metrics.likes) - (a.metrics.comments + a.metrics.likes)
        case 'likes':      return (b.metrics.likes    ?? 0) - (a.metrics.likes    ?? 0)
        case 'plays': {
          const diff = (b.insights?.plays ?? 0) - (a.insights?.plays ?? 0)
          return diff !== 0 ? diff : (b.metrics.comments + b.metrics.likes) - (a.metrics.comments + a.metrics.likes)
        }
        case 'comments':
        default: return (b.metrics.comments ?? 0) - (a.metrics.comments ?? 0)
      }
    }).slice(0, 10)
  }, [posts, postSort])

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
          {profile?.profilePictureUrl ? (
            <img
              src={profile.profilePictureUrl}
              alt={profile.username}
              className="w-12 h-12 rounded-full object-cover border border-border/60 flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 via-purple-500 to-orange-400 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">
                {account.slice(0, 1).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground leading-none">
                @{profile?.username ?? account}
              </h1>
              {profile?.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                  <Globe className="w-2.5 h-2.5" />site
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{profile?.name ?? account}</p>
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

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {since && <MonitoringSince since={since} />}
          {PERIODS.map(({ value, label }) => {
            const unavailable = value > maxDays
            return (
              <button key={value} onClick={() => !unavailable && setPeriod(value)}
                disabled={unavailable}
                title={unavailable ? `Dados disponíveis apenas desde ${since}` : undefined}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  unavailable
                    ? 'opacity-30 cursor-not-allowed bg-card text-muted-foreground border-border'
                    : period === value
                      ? 'bg-pink-500/10 text-pink-400 border-pink-500/30'
                      : 'bg-card text-muted-foreground border-border hover:border-pink-500/30 hover:text-foreground')}>
                {label}
              </button>
            )
          })}
          <button onClick={() => void load()}
            className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── KPI — Grupo 1: Alcance (reage ao filtro) ────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Seguidores" value={fmtN(latestFollow)}
          delta={pctDelta(gain7, prevGain)}
          icon={<Users className="w-3.5 h-3.5" />} accent="text-pink-400"
          tip={<>
            <p className="font-semibold text-foreground mb-1">Total de seguidores</p>
            <p className="text-muted-foreground">Contagem atual da conta. O ▲▼ % compara o ganho de seguidores neste período com o período anterior de igual duração.</p>
          </>} />
        <KpiCard label={`Novos seguidores · ${period}d`}
          value={gain7 >= 0 ? `+${fmtN(gain7)}` : fmtN(gain7)}
          delta={pctDelta(gain7, prevGain)}
          icon={<Heart className="w-3.5 h-3.5" />}
          accent={gain7 >= 0 ? 'text-green-400' : 'text-red-400'}
          tip={<>
            <p className="font-semibold text-foreground mb-1">Novos seguidores líquidos</p>
            <p className="text-muted-foreground">Ganho ou perda total de seguidores no período (novos seguindo menos quem deixou de seguir).</p>
          </>} />
        <KpiCard label={`Alcance · ${period}d`} value={fmtN(reach7)}
          delta={pctDelta(reach7, prevReach)} pending={!hasReach}
          icon={<Eye className="w-3.5 h-3.5" />} accent="text-green-400"
          tip={<>
            <p className="font-semibold text-foreground mb-1">Alcance</p>
            <p className="text-muted-foreground">Quantas contas únicas viram algum conteúdo desta conta no período.</p>
          </>} />
        {hasEngaged && reach7 > 0 ? (
          <KpiCard label={`Taxa de eng. · ${period}d`} value={`${engRate}%`}
            icon={<TrendingUp className="w-3.5 h-3.5" />} accent="text-violet-400"
            tip={<>
              <p className="font-semibold text-foreground mb-1">Taxa de engajamento</p>
              <p className="text-muted-foreground">Contas engajadas ÷ alcance × 100. Acima de 3% é considerado bom no Instagram.</p>
            </>} />
        ) : (
          <div className="hidden sm:block" /> /* placeholder para manter 4 colunas */
        )}
      </div>

      {/* ── KPI — Grupo 2: Engajamento (acumulando histórico) ───────────────── */}
      <div className="space-y-2">
        {(imprAccumulating || engagedAccumulating || interAccumulating || pviewsAccumulating || wcAccumulating) && (
          <div className="flex items-center gap-2 px-0.5">
            <span className="text-[10px] text-amber-500/70 font-medium">⟳ Acumulando histórico diário</span>
            <div className="flex-1 h-px bg-amber-500/15" />
            <span className="text-[10px] text-muted-foreground/40">dados crescem a cada sync</span>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label={`Impressões · ${period}d`} value={fmtN(impr7)}
            delta={pctDelta(impr7, prevImpr)} pending={!hasImpressions}
            dim={imprAccumulating}
            icon={<TrendingUp className="w-3.5 h-3.5" />} accent="text-primary"
            tip={<>
              <p className="font-semibold text-foreground mb-1">Impressões</p>
              <p className="text-muted-foreground">Total de vezes que os conteúdos foram exibidos. A mesma pessoa abrindo duas vezes conta como 2 impressões.</p>
            </>} />
          <KpiCard label={`Contas engajadas · ${period}d`} value={fmtN(engaged7)}
            delta={pctDelta(engaged7, prevEngaged)} pending={!hasEngaged}
            dim={engagedAccumulating}
            icon={<Zap className="w-3.5 h-3.5" />} accent="text-orange-400"
            tip={<>
              <p className="font-semibold text-foreground mb-1">Contas que engajaram</p>
              <p className="text-muted-foreground">Contas únicas que curtiram, comentaram, salvaram ou compartilharam no período.</p>
            </>} />
          <KpiCard label={`Interações · ${period}d`} value={fmtN(interact7)}
            delta={pctDelta(interact7, prevInter)} pending={!hasInteractions}
            dim={interAccumulating}
            icon={<Heart className="w-3.5 h-3.5" />} accent="text-rose-400"
            tip={<>
              <p className="font-semibold text-foreground mb-1">Total de interações</p>
              <p className="text-muted-foreground">Soma de curtidas + comentários + salvamentos + compartilhamentos no período.</p>
            </>} />
          <KpiCard label={`Visitas ao perfil · ${period}d`} value={fmtN(pviews7)}
            delta={pctDelta(pviews7, prevPviews)} pending={!hasProfileViews}
            dim={pviewsAccumulating}
            icon={<InstagramIcon className="w-3.5 h-3.5" />}
            tip={<>
              <p className="font-semibold text-foreground mb-1">Visitas ao perfil</p>
              <p className="text-muted-foreground">Quantas vezes a página do perfil foi acessada no período.</p>
            </>} />
          {profile?.website && (
            <KpiCard label={`Cliques no link · ${period}d`} value={fmtN(wclicks7)}
              delta={pctDelta(wclicks7, prevWclicks)} pending={!hasWebsiteClicks}
              dim={wcAccumulating}
              icon={<Globe className="w-3.5 h-3.5" />} accent="text-yellow-400"
              tip={<>
                <p className="font-semibold text-foreground mb-1">Cliques no link da bio</p>
                <p className="text-muted-foreground">Quantas vezes o link no perfil do Instagram foi clicado no período.</p>
              </>} />
          )}
        </div>
      </div>

      {/* ── Follower growth chart ────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <SectionTitle title="Crescimento de seguidores" sub={`· últimos ${period} dias`} />
          {followerChart.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-8">Sem dados para o período.</p>
          ) : (
            <>
              <div className="flex items-center gap-5 mb-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-pink-400 rounded-full inline-block" />
                  Total de seguidores (eixo esq.)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 bg-green-500/50 rounded-sm inline-block" />
                  Ganho do dia (eixo dir.)
                </span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={followerChart} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis yAxisId="left" orientation="left"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false} tickLine={false} width={52} tickFormatter={fmtN}
                  />
                  <YAxis yAxisId="right" orientation="right"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false} tickLine={false} width={36}
                  />
                  <Tooltip content={<FollowerTooltip />} />
                  <Bar yAxisId="right" dataKey="ganho" name="ganho" fill="hsl(142 76% 36%)" fillOpacity={0.5} radius={[2, 2, 0, 0]} />
                  <Line yAxisId="left" type="monotone" dataKey="seguidores" name="seguidores" stroke="#f472b6" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Alcance ─────────────────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <SectionTitle title="Alcance" sub={`· últimos ${period} dias`} />
          {!hasReach ? (
            <MiningPlaceholder metric="alcance" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={reachChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={50} tickFormatter={fmtN} />
                <Tooltip content={<ChartTooltip formatter={fmtN} />} />
                <Line type="monotone" dataKey="alcance" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Insights agregados 30 dias ──────────────────────────────────────── */}
      {!loading && (() => {
        const agg = aggregateInsights
        const views30 = agg?.viewsByFollowType
          ? Object.values(agg.viewsByFollowType).reduce((s, v) => s + v, 0)
          : impr30
        const viewers30 = agg?.reachByFollowType
          ? Object.values(agg.reachByFollowType).reduce((s, v) => s + v, 0)
          : reach30
        const inter30 = agg?.interactionsByMediaType
          ? Object.values(agg.interactionsByMediaType).reduce((s, v) => s + v, 0)
          : 0
        if (views30 === 0 && viewers30 === 0) return null
        const cols = inter30 > 0 ? 3 : 2
        return (
          <Card className="border-border/60">
            <CardContent className="p-5">
              <SectionTitle title={`Insights da conta · ${period} dias`} snapshot />
              <div className={cn('grid grid-cols-1 gap-6', cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>

                {views30 > 0 && (
                  <div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <p className="text-2xl font-bold tabular-nums text-foreground">{fmtN(views30)}</p>
                      <p className="text-xs text-muted-foreground">visualizações</p>
                    </div>
                    {agg?.viewsByFollowType && <BreakdownFollowType data={agg.viewsByFollowType} label="Por tipo de seguidor" />}
                    {agg?.viewsByMediaType && <BreakdownMediaType data={agg.viewsByMediaType} label="Por tipo de conteúdo" />}
                  </div>
                )}

                {viewers30 > 0 && (
                  <div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <p className="text-2xl font-bold tabular-nums text-foreground">{fmtN(viewers30)}</p>
                      <p className="text-xs text-muted-foreground">visualizadores únicos</p>
                    </div>
                    {agg?.reachByFollowType && <BreakdownFollowType data={agg.reachByFollowType} label="Por tipo de seguidor" />}
                    {agg?.reachByMediaType && <BreakdownMediaType data={agg.reachByMediaType} label="Por tipo de conteúdo" />}
                  </div>
                )}

                {inter30 > 0 && (
                  <div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <p className="text-2xl font-bold tabular-nums text-foreground">{fmtN(inter30)}</p>
                      <p className="text-xs text-muted-foreground">interações</p>
                    </div>
                    {agg?.interactionsByFollowType && <BreakdownFollowType data={agg.interactionsByFollowType} label="Por tipo de seguidor" />}
                    {agg?.interactionsByMediaType && <BreakdownMediaType data={agg.interactionsByMediaType} label="Por tipo de conteúdo" />}
                  </div>
                )}

              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* ── Heatmap horários mais ativos ─────────────────────────────────────── */}
      {!loading && (weeklyActivity ? (() => {
        const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        // Agrupa horas em blocos de 3h → 8 colunas (0h-2h, 3h-5h, ..., 21h-23h)
        const SLOTS = [0, 3, 6, 9, 12, 15, 18, 21]
        // matrix[dow][hour]
        const agg: number[][] = Array.from({ length: 7 }, (_, d) =>
          SLOTS.map((h) => weeklyActivity.matrix[d]?.slice(h, h + 3).reduce((s, v) => s + v, 0) ?? 0)
        )
        const maxVal = Math.max(...agg.flat(), 1)
        return (
          <Card className="border-border/60">
            <CardContent className="p-5">
              <SectionTitle title="Horários mais ativos" snapshot />
              <div className="overflow-x-auto">
                <div className="min-w-[360px]">
                  {/* Header de horas */}
                  <div className="flex gap-1 mb-1.5 ml-10">
                    {SLOTS.map(h => (
                      <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground/50 font-mono">{h}h</div>
                    ))}
                  </div>
                  {/* Linhas por dia */}
                  <div className="space-y-1">
                    {DAYS.map((day, d) => (
                      <div key={day} className="flex items-center gap-1">
                        <span className="w-9 text-[10px] text-muted-foreground/60 font-medium flex-shrink-0">{day}</span>
                        {agg[d].map((val, s) => {
                          const intensity = val / maxVal
                          const opacity = 0.08 + intensity * 0.92
                          return (
                            <div
                              key={s}
                              title={`${day} ${SLOTS[s]}h–${SLOTS[s] + 2}h: ${fmtN(val)} seg.`}
                              className="flex-1 h-7 rounded-md flex items-center justify-center cursor-default transition-transform hover:scale-105"
                              style={{
                                backgroundColor: `hsl(var(--primary) / ${opacity})`,
                              }}
                            >
                              {intensity > 0.5 && (
                                <span className="text-[8px] font-bold text-primary-foreground/80 select-none leading-none">
                                  {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val > 0 ? val : ''}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  {/* Legenda */}
                  <div className="flex items-center gap-1.5 mt-3 justify-end">
                    <span className="text-[9px] text-muted-foreground/50">menos</span>
                    {[0.08, 0.3, 0.55, 0.8, 1].map((op, i) => (
                      <div key={i} className="w-4 h-3 rounded-sm" style={{ backgroundColor: `hsl(var(--primary) / ${op})` }} />
                    ))}
                    <span className="text-[9px] text-muted-foreground/50">mais ativo</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })() : null)}

      {/* ── Audience demographics ────────────────────────────────────────────── */}
      {audience && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Gender + Age */}
          <Card className="border-border/60 lg:col-span-1">
            <CardContent className="p-5">
              <SectionTitle title="Audiência · gênero e idade" snapshot />
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
              <SectionTitle title="Audiência · países" snapshot />
              {topCountries.length > 0 ? (
                <div className="space-y-2.5">
                  {topCountries.map(([country, val]) => (
                    <AudienceBar key={country} label={countryName(country)} value={val} total={totalAudienceCountry} color="bg-primary/60" />
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
              <SectionTitle title="Audiência · cidades" snapshot />
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

      {/* ── Top posts ────────────────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div>
              <p className="text-sm font-bold text-foreground">Top 10 posts · Instagram</p>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {POST_SORTS.map(({ value, label }) => (
                <button key={value} onClick={() => setPostSort(value)}
                  className={cn('px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all',
                    postSort === value
                      ? 'bg-pink-500/10 text-pink-400 border-pink-500/30'
                      : 'bg-card text-muted-foreground border-border hover:border-pink-500/30 hover:text-foreground')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {sortedPosts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">Nenhum post coletado ainda.</p>
          ) : (
            <div className="space-y-2">
              {sortedPosts.map((post, i) => {
                const pi = post.insights
                const isReel = (post.url.includes('/reel/') || (pi?.plays ?? 0) > 0)
                const publishedAt = (post.publishedAt as unknown as Timestamp).toDate()
                const preview = post.text.slice(0, 100).trimEnd() + (post.text.length > 100 ? '…' : '')
                const rankColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600']
                const rankBg    = ['bg-yellow-500/8 border-yellow-500/15', 'bg-slate-500/8 border-slate-400/15', 'bg-amber-600/8 border-amber-600/15']
                const isTop3 = i < 3
                return (
                  <div key={post.id} className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border transition-colors group',
                    isTop3 ? rankBg[i] : 'border-border/40 hover:border-border/70 hover:bg-secondary/20',
                  )}>
                    {/* Rank */}
                    <div className={cn(
                      'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5',
                      isTop3 ? rankColors[i] + ' bg-current/10' : 'text-muted-foreground/35',
                    )}>
                      {i + 1}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      {/* Badges */}
                      <div className="flex items-center gap-1.5 mb-1">
                        {isReel && (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide bg-pink-500/15 text-pink-400 border border-pink-500/20 px-1.5 py-0.5 rounded-full">
                            <Play className="w-2 h-2 fill-current" /> Reel
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground/40 ml-auto">
                          {formatDistanceToNow(publishedAt, { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>

                      {/* Texto */}
                      <p className="text-xs text-foreground/85 leading-snug mb-2">
                        {preview || <span className="italic text-muted-foreground">Sem legenda</span>}
                      </p>

                      {/* Métricas */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          <MessageCircle className="w-2.5 h-2.5" /> {fmtN(post.metrics.comments)}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <Heart className="w-2.5 h-2.5 fill-current" /> {fmtN(post.metrics.likes)}
                        </span>
                        {pi?.plays !== undefined && pi.plays > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                            <Play className="w-2.5 h-2.5 fill-current" /> {fmtN(pi.plays)}
                          </span>
                        )}
                        {pi?.avgWatchTime !== undefined && pi.avgWatchTime > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">
                            ⏱ {fmtMs(pi.avgWatchTime)}
                          </span>
                        )}
                        {pi?.reach !== undefined && pi.reach > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Eye className="w-2.5 h-2.5" /> {fmtN(pi.reach)}
                          </span>
                        )}
                        {pi?.saved !== undefined && pi.saved > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            ★ {fmtN(pi.saved)}
                          </span>
                        )}
                        {pi?.shares !== undefined && pi.shares > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            ↗ {fmtN(pi.shares)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Links — sempre visíveis */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <Link to={`/radar/post/${post.id}`}
                        title="Ver no Radar"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 hover:border-primary/50 transition-all">
                        <Radio className="w-3 h-3" />
                        <span>Radar</span>
                      </Link>
                      <a href={post.url} target="_blank" rel="noopener noreferrer"
                        title="Abrir no Instagram"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-gradient-to-r from-pink-500/10 to-purple-500/10 text-pink-400 border border-pink-500/25 hover:from-pink-500/20 hover:to-purple-500/20 hover:border-pink-500/50 transition-all">
                        <InstagramIcon className="w-3 h-3" />
                        <span>Insta</span>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
