import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import {
  Camera, ChevronDown, ChevronUp, ExternalLink,
  TrendingUp, Users, Zap, Target, Clock, Star,
  BarChart2, Flame, CheckCircle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useAccount } from '@/contexts/AccountContext'
import { captureSnapshot, getSnapshots } from '@/services/snapshots'
import type { PerformanceSnapshot, AccountSnapshot } from '@/types/snapshot'
import type { Timestamp } from 'firebase/firestore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(Math.round(n))
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%'
}

function fmtDate(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  const d = ts.toDate()
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  const d = ts.toDate()
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}h`
}

function delta(current: number, base: number): { val: number; pct: number } {
  const val = current - base
  const pct = base !== 0 ? (val / base) * 100 : 0
  return { val, pct }
}

function DeltaBadge({ current, base, invert = false }: { current: number; base: number; invert?: boolean }) {
  const { val, pct } = delta(current, base)
  if (val === 0) return <span className="text-muted-foreground text-xs">—</span>
  const positive = invert ? val < 0 : val > 0
  return (
    <span className={cn('text-xs font-semibold flex items-center gap-0.5', positive ? 'text-green-500' : 'text-red-500')}>
      {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ─── Headline automático ───────────────────────────────────────────────────────

function generateHeadline(first: PerformanceSnapshot, latest: PerformanceSnapshot): string {
  const firstAccounts = Object.values(first.accounts)
  const latestAccounts = Object.values(latest.accounts)

  const firstTotalFollowers = firstAccounts.reduce((s, a) => s + a.followersCount, 0)
  const latestTotalFollowers = latestAccounts.reduce((s, a) => s + a.followersCount, 0)

  const firstAvgViralRate = firstAccounts.length > 0
    ? firstAccounts.reduce((s, a) => s + a.viralRate, 0) / firstAccounts.length : 0
  const latestAvgViralRate = latestAccounts.length > 0
    ? latestAccounts.reduce((s, a) => s + a.viralRate, 0) / latestAccounts.length : 0

  const followerDiff = latestTotalFollowers - firstTotalFollowers
  const viralDiff = latestAvgViralRate - firstAvgViralRate

  const firstDate = fmtDate(first.capturedAt)
  const latestDate = fmtDate(latest.capturedAt)

  if (Math.abs(viralDiff) >= 0.5) {
    const dir = viralDiff > 0 ? 'cresceu' : 'caiu'
    return `Desde ${firstDate}, a taxa de viralização ${dir} ${Math.abs(viralDiff).toFixed(1)} pontos percentuais (${firstDate} → ${latestDate})`
  }
  if (Math.abs(followerDiff) > 100) {
    const dir = followerDiff > 0 ? 'cresceu' : 'diminuiu'
    return `Desde ${firstDate}, o total de seguidores ${dir} ${fmtNum(Math.abs(followerDiff))} (${firstDate} → ${latestDate})`
  }
  return `Comparando capturas de ${firstDate} e ${latestDate}`
}

// ─── Projeção linear simples ───────────────────────────────────────────────────

function computeProjection(snapshots: PerformanceSnapshot[], accountIds: string[]) {
  if (snapshots.length < 2) return []

  // Ordena da mais antiga para a mais recente
  const ordered = [...snapshots].sort(
    (a, b) => (a.capturedAt as Timestamp).toMillis() - (b.capturedAt as Timestamp).toMillis()
  )

  const points = ordered.map((snap, i) => {
    const accs = Object.values(snap.accounts).filter(a => accountIds.includes(a.accountId))
    const avgViral = accs.length > 0 ? accs.reduce((s, a) => s + a.viralRate, 0) / accs.length : 0
    return { i, viralRate: avgViral, label: fmtDate(snap.capturedAt) }
  })

  // Linear regression
  const n = points.length
  const sumX = points.reduce((s, p) => s + p.i, 0)
  const sumY = points.reduce((s, p) => s + p.viralRate, 0)
  const sumXY = points.reduce((s, p) => s + p.i * p.viralRate, 0)
  const sumX2 = points.reduce((s, p) => s + p.i * p.i, 0)
  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const b = (sumY - m * sumX) / n

  // Projeta 2 próximos pontos
  const projected = [
    ...points.map(p => ({ ...p, tipo: 'real' as const })),
    { i: n, viralRate: Math.max(0, m * n + b), label: 'Projeção 1', tipo: 'proj' as const },
    { i: n + 1, viralRate: Math.max(0, m * (n + 1) + b), label: 'Projeção 2', tipo: 'proj' as const },
  ]

  return projected.map(p => ({
    label: p.label,
    'Taxa Real': p.tipo === 'real' ? parseFloat(p.viralRate.toFixed(2)) : null,
    'Projeção': p.tipo === 'proj' ? parseFloat(p.viralRate.toFixed(2)) : null,
  }))
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, base, iconColor, invertDelta = false,
}: {
  icon: React.ElementType
  label: string
  value: number
  base?: number
  iconColor: string
  invertDelta?: boolean
}) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{fmtNum(value)}</p>
      {base !== undefined && (
        <div className="mt-1">
          <DeltaBadge current={value} base={base} invert={invertDelta} />
        </div>
      )}
    </div>
  )
}

function AccountCard({
  account, base, defaultOpen = false,
}: {
  account: AccountSnapshot
  base?: AccountSnapshot
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const totalViews = account.viewsByFollowType
    ? Object.values(account.viewsByFollowType).reduce((s, v) => s + v, 0)
    : account.impressions30d

  const totalReach = account.reachByFollowType
    ? Object.values(account.reachByFollowType).reduce((s, v) => s + v, 0)
    : account.reach30d

  const velocityData = Object.entries(account.viralVelocityBuckets ?? {})
    .filter(([, v]) => v > 0)
    .map(([label, count]) => ({ label, count }))

  const hourData = Array.from({ length: 24 }, (_, h) => ({
    hour: formatHour(h),
    posts: account.peakViralHourDistribution?.[String(h)] ?? 0,
  })).filter(d => d.posts > 0)

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors"
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: account.color }}
        />
        <span className="font-semibold text-sm text-foreground flex-1 text-left">
          {account.displayName}
        </span>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{fmtNum(account.followersCount)} seguidores</span>
          <span className="font-semibold" style={{ color: account.color }}>
            {fmtPct(account.viralRate)} viral
          </span>
          {base && <DeltaBadge current={account.viralRate} base={base.viralRate} />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground/60" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/60" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-4">
          {/* Métricas principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Seguidores', value: account.followersCount, base: base?.followersCount },
              { label: 'Posts monitorados', value: account.totalPostsMonitored, base: base?.totalPostsMonitored },
              { label: 'Posts virais', value: account.viralPostsCount, base: base?.viralPostsCount },
              { label: 'Taxa viral', value: account.viralRate, base: base?.viralRate, pct: true },
              { label: 'Oportunidades', value: account.totalOpportunities, base: base?.totalOpportunities },
              { label: 'Interações 30d', value: account.totalInteractions30d, base: base?.totalInteractions30d },
              { label: 'Alcance 30d', value: totalReach, base: base ? Object.values(base.reachByFollowType ?? {}).reduce((s, v) => s + v, 0) || base.reach30d : undefined },
              { label: 'Engajamento 30d', value: account.engagementRate30d, base: base?.engagementRate30d, pct: true },
            ].map(m => (
              <div key={m.label} className="bg-background/60 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground mb-0.5">{m.label}</p>
                <p className="text-sm font-bold text-foreground">
                  {m.pct ? fmtPct(m.value) : fmtNum(m.value)}
                </p>
                {m.base !== undefined && (
                  <DeltaBadge current={m.value} base={m.base} />
                )}
              </div>
            ))}
          </div>

          {/* Posts totais */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Engajamento total (todos os posts)</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { label: '💬 Comentários', value: account.totalComments },
                { label: '❤️ Curtidas', value: account.totalLikes },
                { label: '🔁 Shares', value: account.totalShares },
                { label: '🔖 Salvos', value: account.totalSaves },
                { label: '▶️ Plays', value: account.totalPlays },
              ].map(m => (
                <div key={m.label} className="bg-background/60 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  <p className="text-sm font-bold">{fmtNum(m.value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Velocidade */}
          {velocityData.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Velocidade de viralização (idade dos posts virais na captura)
              </p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(account.viralVelocityBuckets ?? {}).map(([label, count]) => (
                  count > 0 && (
                    <div key={label} className="flex items-center gap-1 bg-background/60 rounded-lg px-2 py-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: label === '<6h' ? '#22c55e' : label === '6-24h' ? '#84cc16' : label === '1-3d' ? '#eab308' : label === '3-7d' ? '#f97316' : '#ef4444' }}
                      />
                      <span className="text-xs font-medium text-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground">{count}p</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Pico de publicação */}
          {account.peakViralHour !== null && hourData.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Horário de pico — posts virais publicados às {formatHour(account.peakViralHour)}
              </p>
              <div className="h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourData} barSize={8}>
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                    <Tooltip
                      formatter={(v: number) => [`${v} post(s)`, 'Virais']}
                      contentStyle={{ fontSize: 11 }}
                    />
                    <Bar dataKey="posts" fill={account.color} radius={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Consistência */}
          {account.consistencyScore !== null && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${account.consistencyScore}%`, backgroundColor: account.color }}
                />
              </div>
              <span className="text-xs font-semibold text-foreground">
                {account.consistencyScore}% consistência
              </span>
              <span className="text-xs text-muted-foreground">
                ({account.weeksMonitored} sem.)
              </span>
            </div>
          )}

          {/* Temas */}
          {account.topTopics.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Temas que funcionaram</p>
              <div className="flex flex-wrap gap-1.5">
                {account.topTopics.slice(0, 8).map(t => (
                  <span
                    key={t.topic}
                    className="text-[10px] px-2 py-0.5 rounded-full border"
                    style={{ borderColor: account.color + '60', color: account.color }}
                  >
                    {t.topic} ({t.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Melhor post */}
          {account.bestPostUrl && (
            <div className="flex items-center gap-2 p-2 bg-background/60 rounded-lg">
              <Star className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Melhor post:</span>
              <span className="text-xs font-semibold">score {account.bestPostScore}</span>
              <a
                href={account.bestPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto"
              >
                <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </a>
            </div>
          )}

          {/* Insights 30d */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Alcance Instagram (30d)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Views', value: totalViews },
                { label: 'Alcance único', value: totalReach },
                { label: 'Visitas perfil', value: account.profileViews30d },
                { label: 'Cliques link', value: account.websiteClicks30d },
              ].map(m => (
                <div key={m.label} className="bg-background/60 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  <p className="text-sm font-bold">{fmtNum(m.value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function ImpactPage() {
  const { isAdmin, user } = useAuth()
  const { accounts } = useAccount()

  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [capturing, setCapturing] = useState(false)
  const [captureNote, setCaptureNote] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'velocidade' | 'pico' | 'temas' | 'consistencia' | 'projecao'>('velocidade')

  useEffect(() => {
    getSnapshots()
      .then(snaps => {
        setSnapshots(snaps)
        if (snaps.length > 0 && !selectedId) setSelectedId(snaps[0].id)
      })
      .catch(() => toast.error('Erro ao carregar capturas'))
      .finally(() => setLoading(false))
  }, [])

  if (!isAdmin) return <Navigate to="/radar" replace />

  const selected = snapshots.find(s => s.id === selectedId)
  const oldest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const base = compareMode && oldest && oldest.id !== selectedId ? oldest : undefined

  const accountIds = accounts.map(a => a.id)

  async function handleCapture() {
    if (!user) return
    setCapturing(true)
    try {
      const id = await captureSnapshot(
        accounts,
        { uid: user.uid, email: user.email },
        captureNote.trim() || 'Captura manual',
      )
      const updated = await getSnapshots()
      setSnapshots(updated)
      setSelectedId(id)
      setShowModal(false)
      setCaptureNote('')
      toast.success('Captura realizada com sucesso')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao realizar captura')
    } finally {
      setCapturing(false)
    }
  }

  // Dados para comparativo entre contas
  const comparisonRows = useMemo(() => {
    if (!selected) return []
    return accountIds
      .map(id => ({ snap: selected.accounts[id], base: base?.accounts[id] }))
      .filter(r => r.snap)
  }, [selected, base, accountIds])

  // Dados para seção de velocidade (gráfico cross-account)
  const velocityChartData = useMemo(() => {
    if (!selected) return []
    const buckets = ['<6h', '6-24h', '1-3d', '3-7d', '7+d']
    return buckets.map(bucket => {
      const row: Record<string, unknown> = { bucket }
      for (const id of accountIds) {
        const acc = selected.accounts[id]
        if (acc) row[acc.displayName] = acc.viralVelocityBuckets?.[bucket] ?? 0
      }
      return row
    })
  }, [selected, accountIds])

  // Dados para horário de pico cross-account
  const peakHourData = useMemo(() => {
    if (!selected) return []
    return Array.from({ length: 24 }, (_, h) => {
      const row: Record<string, unknown> = { hour: formatHour(h) }
      for (const id of accountIds) {
        const acc = selected.accounts[id]
        if (acc) row[acc.displayName] = acc.peakViralHourDistribution?.[String(h)] ?? 0
      }
      return row
    })
  }, [selected, accountIds])

  // Temas cross-account
  const crossTopics = useMemo(() => {
    if (!selected) return []
    const counts: Record<string, number> = {}
    for (const id of accountIds) {
      const acc = selected.accounts[id]
      if (!acc) continue
      for (const t of acc.topTopics) {
        counts[t.topic] = (counts[t.topic] ?? 0) + t.count
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15)
  }, [selected, accountIds])

  // Consistência por conta
  const consistencyData = useMemo(() => {
    if (!selected) return []
    return accountIds
      .map(id => selected.accounts[id])
      .filter(Boolean)
      .map(acc => ({
        name: acc.displayName,
        score: acc.consistencyScore ?? 0,
        color: acc.color,
      }))
      .sort((a, b) => b.score - a.score)
  }, [selected, accountIds])

  // Projeção
  const projectionData = useMemo(
    () => computeProjection([...snapshots].reverse(), accountIds),
    [snapshots, accountIds],
  )

  const headline = useMemo(() => {
    if (!base || !selected) return null
    return generateHeadline(base, selected)
  }, [base, selected])

  // Totais globais
  const totals = useMemo(() => {
    if (!selected) return null
    const accs = accountIds.map(id => selected.accounts[id]).filter(Boolean)
    return {
      followers: accs.reduce((s, a) => s + a.followersCount, 0),
      posts: accs.reduce((s, a) => s + a.totalPostsMonitored, 0),
      viralPosts: accs.reduce((s, a) => s + a.viralPostsCount, 0),
      opportunities: accs.reduce((s, a) => s + a.totalOpportunities, 0),
    }
  }, [selected, accountIds])

  const baseTotals = useMemo(() => {
    if (!base) return null
    const accs = accountIds.map(id => base.accounts[id]).filter(Boolean)
    return {
      followers: accs.reduce((s, a) => s + a.followersCount, 0),
      posts: accs.reduce((s, a) => s + a.totalPostsMonitored, 0),
      viralPosts: accs.reduce((s, a) => s + a.viralPostsCount, 0),
      opportunities: accs.reduce((s, a) => s + a.totalOpportunities, 0),
    }
  }, [base, accountIds])

  const COLORS = ['#38B6FF', '#91BD32', '#0049AF', '#9333EA', '#D85587']
  const accountNames = accountIds.map(id => selected?.accounts[id]?.displayName ?? id)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Impacto do Radar</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Capturas manuais — compare antes e depois do Radar
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Nova captura
          </button>
        </div>

        {/* ── Modal Nova Captura ─────────────────────────────────────── */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={e => { if (e.target === e.currentTarget && !capturing) setShowModal(false) }}
          >
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
              <h2 className="text-base font-bold mb-1">Nova captura de impacto</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Captura os dados atuais de todas as {accounts.length} contas. Pode demorar alguns segundos.
              </p>
              <textarea
                className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                rows={3}
                placeholder="Nota (ex.: Início do acompanhamento, Após campanha de junho...)"
                value={captureNote}
                onChange={e => setCaptureNote(e.target.value)}
                disabled={capturing}
              />
              <div className="flex gap-2 mt-3 justify-end">
                <button
                  onClick={() => { if (!capturing) { setShowModal(false); setCaptureNote('') } }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  disabled={capturing}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCapture}
                  disabled={capturing}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center gap-2"
                >
                  {capturing ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Capturando...
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" />
                      Capturar agora
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────── */}
        {!loading && snapshots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Camera className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-base font-semibold text-foreground mb-1">Nenhuma captura ainda</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Clique em "Nova captura" para registrar o estado atual de todas as contas.
              Faça capturas periódicas para ver a evolução.
            </p>
          </div>
        )}

        {/* ── Conteúdo principal ─────────────────────────────────────── */}
        {!loading && snapshots.length > 0 && selected && (
          <>
            {/* ── Histórico de capturas ─────────────────────────────── */}
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Capturas ({snapshots.length})
                </p>
                {snapshots.length >= 2 && (
                  <button
                    onClick={() => setCompareMode(v => !v)}
                    className={cn(
                      'text-xs px-3 py-1 rounded-full border transition-colors font-medium',
                      compareMode
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-border text-muted-foreground hover:border-primary/60',
                    )}
                  >
                    {compareMode ? '✓ Comparando com 1ª captura' : 'Comparar com 1ª captura'}
                  </button>
                )}
              </div>
              <div className="divide-y divide-border/30">
                {snapshots.map(snap => (
                  <button
                    key={snap.id}
                    onClick={() => setSelectedId(snap.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/20 transition-colors',
                      selectedId === snap.id && 'bg-accent/30',
                    )}
                  >
                    <CheckCircle
                      className={cn('w-4 h-4 flex-shrink-0', selectedId === snap.id ? 'text-primary' : 'text-muted-foreground/30')}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{snap.note || 'Sem nota'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtDateTime(snap.capturedAt)} · {snap.capturedByEmail}
                      </p>
                    </div>
                    {snap.id === oldest?.id && snapshots.length > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Primeira
                      </span>
                    )}
                    {snap.id === snapshots[0]?.id && snapshots.length > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        Última
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Headline ──────────────────────────────────────────── */}
            {headline && (
              <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/30 rounded-xl px-4 py-3 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">{headline}</p>
              </div>
            )}

            {/* ── Summary cards ─────────────────────────────────────── */}
            {totals && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard
                  icon={Users}
                  label="Seguidores totais"
                  value={totals.followers}
                  base={baseTotals?.followers}
                  iconColor="#38B6FF"
                />
                <SummaryCard
                  icon={Flame}
                  label="Posts virais"
                  value={totals.viralPosts}
                  base={baseTotals?.viralPosts}
                  iconColor="#f97316"
                />
                <SummaryCard
                  icon={BarChart2}
                  label="Posts monitorados"
                  value={totals.posts}
                  base={baseTotals?.posts}
                  iconColor="#84cc16"
                />
                <SummaryCard
                  icon={Zap}
                  label="Oportunidades"
                  value={totals.opportunities}
                  base={baseTotals?.opportunities}
                  iconColor="#a855f7"
                />
              </div>
            )}

            {/* ── Comparativo entre contas ──────────────────────────── */}
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Comparativo entre contas
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium">Conta</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Seguidores</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Posts</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Virais</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Taxa viral</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Engajamento 30d</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Oportunidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map(({ snap: acc, base: b }) => (
                      <tr key={acc.accountId} className="border-b border-border/20 hover:bg-accent/10">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                            <span className="font-medium text-foreground">{acc.displayName}</span>
                          </div>
                        </td>
                        <td className="text-right px-3 py-2.5">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-foreground">{fmtNum(acc.followersCount)}</span>
                            {b && <DeltaBadge current={acc.followersCount} base={b.followersCount} />}
                          </div>
                        </td>
                        <td className="text-right px-3 py-2.5 text-foreground font-medium">{acc.totalPostsMonitored}</td>
                        <td className="text-right px-3 py-2.5">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-foreground">{acc.viralPostsCount}</span>
                            {b && <DeltaBadge current={acc.viralPostsCount} base={b.viralPostsCount} />}
                          </div>
                        </td>
                        <td className="text-right px-3 py-2.5">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold" style={{ color: acc.color }}>{fmtPct(acc.viralRate)}</span>
                            {b && <DeltaBadge current={acc.viralRate} base={b.viralRate} />}
                          </div>
                        </td>
                        <td className="text-right px-3 py-2.5">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-foreground">{fmtPct(acc.engagementRate30d)}</span>
                            {b && <DeltaBadge current={acc.engagementRate30d} base={b.engagementRate30d} />}
                          </div>
                        </td>
                        <td className="text-right px-3 py-2.5">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-foreground">{acc.totalOpportunities}</span>
                            {b && <DeltaBadge current={acc.totalOpportunities} base={b.totalOpportunities} />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Analytics tabs ────────────────────────────────────── */}
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
              <div className="flex border-b border-border/40 overflow-x-auto">
                {([
                  { id: 'velocidade', label: 'Velocidade', icon: Zap },
                  { id: 'pico', label: 'Horário de pico', icon: Clock },
                  { id: 'temas', label: 'Temas', icon: Target },
                  { id: 'consistencia', label: 'Consistência', icon: CheckCircle },
                  { id: 'projecao', label: 'Projeção', icon: TrendingUp },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {/* Velocidade */}
                {activeTab === 'velocidade' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Distribuição dos posts virais por tempo de vida na data da captura.
                      Posts no bucket "&lt;6h" viralizaram muito rapidamente.
                    </p>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={velocityChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {accountNames.map((name, i) => (
                            <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === accountNames.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Pico */}
                {activeTab === 'pico' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Horário de publicação dos posts virais. Publicar no horário de pico aumenta a chance de viralização.
                    </p>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={peakHourData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {accountNames.map((name, i) => (
                            <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {accountIds.map(id => {
                        const acc = selected.accounts[id]
                        if (!acc || acc.peakViralHour === null) return null
                        return (
                          <div key={id} className="flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                            <span className="text-muted-foreground">{acc.displayName}:</span>
                            <span className="font-semibold">{formatHour(acc.peakViralHour)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Temas */}
                {activeTab === 'temas' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Temas mais recorrentes nas oportunidades geradas pela IA, agrupados por todas as contas.
                    </p>
                    {crossTopics.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nenhum tema registrado ainda</p>
                    ) : (
                      <div className="space-y-1.5">
                        {crossTopics.map(([topic, count], i) => (
                          <div key={topic} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                            <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                              <div
                                className="h-full bg-primary/70 rounded transition-all"
                                style={{ width: `${(count / crossTopics[0][1]) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-foreground min-w-[160px] truncate">{topic}</span>
                            <span className="text-xs text-muted-foreground">{count}×</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Consistência */}
                {activeTab === 'consistencia' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      % de semanas monitoradas com pelo menos 1 post viral. 100% = viraliza toda semana.
                    </p>
                    <div className="space-y-2">
                      {consistencyData.map(item => (
                        <div key={item.name} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-28 truncate">{item.name}</span>
                          <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                            <div
                              className="h-full rounded transition-all"
                              style={{ width: `${item.score}%`, backgroundColor: item.color }}
                            />
                          </div>
                          <span className="text-xs font-bold text-foreground w-10 text-right">{item.score}%</span>
                        </div>
                      ))}
                    </div>
                    {consistencyData.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">Dados insuficientes</p>
                    )}
                  </div>
                )}

                {/* Projeção */}
                {activeTab === 'projecao' && (
                  <div className="space-y-3">
                    {snapshots.length < 2 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Faça pelo menos 2 capturas para ver a projeção.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Projeção da taxa de viralização média com base nas capturas anteriores (regressão linear).
                        </p>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={projectionData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 11 }} unit="%" />
                              <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [`${v?.toFixed(2)}%`, '']} />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Line
                                type="monotone"
                                dataKey="Taxa Real"
                                stroke="#38B6FF"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                connectNulls={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="Projeção"
                                stroke="#9333EA"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={{ r: 4 }}
                                connectNulls={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Cards por conta ───────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Detalhes por conta
              </p>
              <div className="space-y-2">
                {accountIds.map((id, i) => {
                  const acc = selected.accounts[id]
                  if (!acc) return null
                  return (
                    <AccountCard
                      key={id}
                      account={acc}
                      base={base?.accounts[id]}
                      defaultOpen={i === 0}
                    />
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
