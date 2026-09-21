import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Users, Eye, TrendingUp, Globe, Clock, RefreshCw } from 'lucide-react'
import {
  getInstagramProfile,
  getInstagramInsights,
  getOnlineFollowers,
} from '@/services/instagram'
import type { InstagramDailyInsight, InstagramAccountProfile, InstagramOnlineFollowers } from '@/types/instagram'
import { cn } from '@/lib/utils'

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatLine({
  icon, label, value, delta, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  delta?: number
  accent?: string
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="opacity-60">{icon}</span>{label}
      </span>
      <div className="flex items-center gap-1.5">
        {delta !== undefined && delta !== 0 && (
          <span className={cn('text-[10px] font-semibold', delta > 0 ? 'text-green-400' : 'text-red-400')}>
            {delta > 0 ? '+' : ''}{delta > 100 ? delta.toLocaleString('pt-BR') : delta.toFixed(1)}%
          </span>
        )}
        <span className={cn('text-xs font-bold tabular-nums', accent ?? 'text-foreground')}>{value}</span>
      </div>
    </div>
  )
}

function MiniLineChart({ data, dataKey, color }: {
  data: Record<string, unknown>[]
  dataKey: string
  color: string
}) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const item = payload[0]
            return (
              <div className="bg-popover border border-border rounded px-2 py-1 text-xs shadow-lg">
                <p className="font-bold text-foreground">{String(item.payload.label)}</p>
                <p className="text-primary">{Number(item.value).toLocaleString('pt-BR')}</p>
              </div>
            )
          }}
        />
        <XAxis dataKey="label" hide />
      </LineChart>
    </ResponsiveContainer>
  )
}

function OnlineChart({ byHour }: { byHour: number[] }) {
  const peak = byHour.indexOf(Math.max(...byHour))
  const data = byHour.map((v, h) => ({
    label: `${String(h).padStart(2, '0')}h`,
    value: v,
  }))

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
        <span>Seguidores online por hora</span>
        <span className="text-foreground font-semibold">
          pico às {String(peak).padStart(2, '0')}h
        </span>
      </div>
      <div className="flex items-end gap-0.5 h-10">
        {byHour.map((v, h) => {
          const max = Math.max(...byHour, 1)
          const height = Math.max(2, Math.round((v / max) * 100))
          return (
            <div
              key={h}
              title={`${String(h).padStart(2, '0')}h: ${v.toFixed(1)}%`}
              className={cn(
                'flex-1 rounded-t transition-all',
                h === peak ? 'bg-pink-400/80' : 'bg-primary/30',
              )}
              style={{ height: `${height}%` }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground/40">
        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
      <MiniLineChart data={data} dataKey="value" color="#f472b6" />
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function InstagramInsightsPanel() {
  const [profile, setProfile] = useState<InstagramAccountProfile | null>(null)
  const [insights, setInsights] = useState<InstagramDailyInsight[]>([])
  const [online, setOnline] = useState<InstagramOnlineFollowers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [p, i, o] = await Promise.all([
        getInstagramProfile(),
        getInstagramInsights(14),
        getOnlineFollowers(),
      ])
      setProfile(p)
      setInsights(i)
      setOnline(o)
    } catch (err) {
      setError('Sem dados do Instagram ainda.')
      console.warn('[InstagramInsightsPanel]', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 w-32 bg-secondary rounded" />
        <div className="h-3 w-48 bg-secondary rounded" />
        <div className="h-10 bg-secondary rounded" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 bg-secondary rounded" />
        ))}
      </div>
    )
  }

  if (error || (insights.length === 0 && !profile)) {
    return (
      <div className="space-y-2 text-center py-3">
        <p className="text-xs text-muted-foreground/60 italic">
          Dados do Instagram ainda não sincronizados.
        </p>
        <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
          Configure o token no Secret Manager e aguarde o próximo ciclo de sincronização.
        </p>
        <button
          onClick={() => void load()}
          className="text-[10px] text-primary hover:underline flex items-center gap-1 mx-auto"
        >
          <RefreshCw className="w-2.5 h-2.5" /> Tentar novamente
        </button>
      </div>
    )
  }

  // Aggregate dos últimos 7 dias
  const last7 = insights.slice(-7)
  const prev7 = insights.slice(-14, -7)

  function sum(arr: InstagramDailyInsight[], key: keyof InstagramDailyInsight): number {
    return arr.reduce((s, d) => s + (Number(d[key]) || 0), 0)
  }
  function delta(curr: number, prev: number): number {
    if (prev === 0) return 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  const totalReach7        = sum(last7, 'reach')
  const totalReachPrev     = sum(prev7, 'reach')
  const totalImpressions7  = sum(last7, 'impressions')
  const totalImprPrev      = sum(prev7, 'impressions')
  const totalProfileViews7 = sum(last7, 'profileViews')
  const totalPVPrev        = sum(prev7, 'profileViews')
  const totalWebClicks7    = sum(last7, 'websiteClicks')
  const totalWCPrev        = sum(prev7, 'websiteClicks')
  const followerGain7      = sum(last7, 'followerGain')
  const followerGainPrev   = sum(prev7, 'followerGain')

  const latestFollowers = insights.length > 0 ? insights[insights.length - 1].followerCount : profile?.followersCount ?? 0

  const reachChartData = last7.map(d => ({
    label: d.date.slice(5),
    reach: d.reach,
    impressions: d.impressions,
  }))

  return (
    <div className="space-y-4">
      {/* Perfil */}
      {profile && (
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 via-purple-400 to-orange-400 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">
              {profile.username.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">@{profile.username}</p>
            <p className="text-[10px] text-muted-foreground/60 truncate">{profile.name}</p>
          </div>
        </div>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            label: 'Seguidores',
            value: latestFollowers >= 1000
              ? `${(latestFollowers / 1000).toFixed(1)}k`
              : latestFollowers.toLocaleString('pt-BR'),
            gain: followerGain7,
            gainPrev: followerGainPrev,
            icon: <Users className="w-3 h-3" />,
            accent: 'text-primary',
          },
          {
            label: 'Alcance 7d',
            value: totalReach7 >= 1000
              ? `${(totalReach7 / 1000).toFixed(1)}k`
              : totalReach7.toLocaleString('pt-BR'),
            gain: delta(totalReach7, totalReachPrev),
            gainPrev: 0,
            icon: <Eye className="w-3 h-3" />,
            accent: 'text-green-400',
          },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg bg-secondary/40 border border-border/50 p-2.5 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              {kpi.icon}<span>{kpi.label}</span>
            </div>
            <p className={cn('text-xl font-bold tabular-nums leading-none', kpi.accent)}>{kpi.value}</p>
            {kpi.gain !== 0 && (
              <p className={cn('text-[10px] font-semibold', kpi.gain > 0 ? 'text-green-400' : 'text-red-400')}>
                {kpi.gain > 0 ? '+' : ''}{kpi.gain > 100 ? kpi.gain.toLocaleString('pt-BR') : kpi.gain.toFixed(1)}%
                {' '}<span className="text-muted-foreground/40 font-normal">vs ant.</span>
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Gráfico de alcance */}
      {reachChartData.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
            Alcance · últimos 7 dias
          </p>
          <MiniLineChart data={reachChartData} dataKey="reach" color="hsl(210 100% 56%)" />
        </div>
      )}

      {/* Stats */}
      <div className="space-y-0 divide-y divide-border/40">
        <StatLine
          icon={<TrendingUp className="w-3 h-3" />}
          label="Impressões 7d"
          value={totalImpressions7 >= 1000 ? `${(totalImpressions7/1000).toFixed(1)}k` : totalImpressions7.toLocaleString('pt-BR')}
          delta={delta(totalImpressions7, totalImprPrev)}
        />
        <StatLine
          icon={<Eye className="w-3 h-3" />}
          label="Visitas ao perfil 7d"
          value={totalProfileViews7.toLocaleString('pt-BR')}
          delta={delta(totalProfileViews7, totalPVPrev)}
        />
        <StatLine
          icon={<Globe className="w-3 h-3" />}
          label="Cliques no link 7d"
          value={totalWebClicks7.toLocaleString('pt-BR')}
          delta={delta(totalWebClicks7, totalWCPrev)}
        />
        <StatLine
          icon={<Users className="w-3 h-3" />}
          label="Novos seguidores 7d"
          value={followerGain7 >= 0 ? `+${followerGain7.toLocaleString('pt-BR')}` : followerGain7.toLocaleString('pt-BR')}
          accent={followerGain7 > 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {/* Online followers por hora */}
      {online && online.byHour.length === 24 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Clock className="w-3 h-3 text-muted-foreground/60" />
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Horários de pico</p>
          </div>
          <OnlineChart byHour={online.byHour} />
        </div>
      )}
    </div>
  )
}
