import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import {
  Camera, ChevronDown, ChevronUp, ExternalLink,
  TrendingUp, Users, Zap, CheckCircle, ArrowUpRight, ArrowDownRight,
  Flag, Clock, Target, BarChart2, Flame, Star,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useAccount } from '@/contexts/AccountContext'
import { captureSnapshot, getSnapshots } from '@/services/snapshots'
import type { PerformanceSnapshot, AccountSnapshot } from '@/types/snapshot'
import type { Timestamp } from 'firebase/firestore'

// ─── Utils ────────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(Math.round(n))
}
function fmtPct(n: number, dec = 1): string { return n.toFixed(dec) + '%' }
function fmtDate(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtDateTime(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
function formatHour(h: number) { return `${String(h).padStart(2, '0')}h` }

function AbsDelta({ current, base, unit = '', invert = false }: {
  current: number; base: number; unit?: string; invert?: boolean
}) {
  const abs = current - base
  if (abs === 0) return <span className="text-[10px] text-muted-foreground/60">—</span>
  const positive = invert ? abs < 0 : abs > 0
  return (
    <span className={cn('text-[10px] font-semibold flex items-center gap-0.5 leading-none',
      positive ? 'text-emerald-500' : 'text-red-500')}>
      {positive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {abs > 0 ? '+' : ''}{unit === '%' ? fmtPct(abs) : fmtNum(Math.abs(abs))}{unit && unit !== '%' ? unit : ''}
    </span>
  )
}

// Regressão linear simples
function linearRegression(points: { x: number; y: number }[]): { m: number; b: number } {
  const n = points.length
  if (n < 2) return { m: 0, b: points[0]?.y ?? 0 }
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const b = (sumY - m * sumX) / n
  return { m, b }
}

const EVOLUTION_METRICS = [
  { id: 'viralRate', label: 'Taxa viral (%)', unit: '%', fmt: (v: number) => fmtPct(v) },
  { id: 'followersCount', label: 'Seguidores', unit: '', fmt: fmtNum },
  { id: 'viralPostsCount', label: 'Posts virais', unit: '', fmt: fmtNum },
  { id: 'totalOpportunities', label: 'Oportunidades', unit: '', fmt: fmtNum },
  { id: 'engagementRate30d', label: 'Engajamento 30d (%)', unit: '%', fmt: (v: number) => fmtPct(v) },
  { id: 'consistencyScore', label: 'Consistência (%)', unit: '%', fmt: (v: number) => fmtPct(v ?? 0) },
]

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border/60 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Seletor de contas ────────────────────────────────────────────────────────

function AccountPills({
  accounts, selected, onChange,
}: {
  accounts: { id: string; displayName: string; color: string; shortName: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id)
      ? selected.filter(x => x !== id)
      : [...selected, id]
    )
  }
  const all = selected.length === accounts.length

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => onChange(all ? [] : accounts.map(a => a.id))}
        className={cn(
          'text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
          all
            ? 'bg-foreground/10 border-foreground/30 text-foreground'
            : 'border-border text-muted-foreground hover:border-foreground/40',
        )}
      >
        {all ? 'Todas ✓' : 'Todas'}
      </button>
      {accounts.map(acc => {
        const on = selected.includes(acc.id)
        return (
          <button
            key={acc.id}
            onClick={() => toggle(acc.id)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
              on ? 'text-white' : 'text-muted-foreground hover:text-foreground',
            )}
            style={on
              ? { backgroundColor: acc.color, borderColor: acc.color }
              : { borderColor: acc.color + '60' }
            }
          >
            {acc.shortName}
          </button>
        )
      })}
    </div>
  )
}

// ─── Card de snapshot na lista ────────────────────────────────────────────────

function SnapshotListItem({
  snap, isBaseline, isViewing, isOldest, isLatest,
  onSelect, onSetBaseline,
}: {
  snap: PerformanceSnapshot
  isBaseline: boolean
  isViewing: boolean
  isOldest: boolean
  isLatest: boolean
  onSelect: () => void
  onSetBaseline: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/20 last:border-b-0',
        isViewing ? 'bg-accent/30' : 'hover:bg-accent/10',
      )}
      onClick={onSelect}
    >
      <CheckCircle className={cn('w-4 h-4 flex-shrink-0', isViewing ? 'text-primary' : 'text-muted-foreground/20')} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{snap.note || 'Sem nota'}</p>
        <p className="text-[11px] text-muted-foreground">{fmtDateTime(snap.capturedAt)}</p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isBaseline && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-semibold border border-amber-500/40">
            ⚑ Baseline
          </span>
        )}
        {isLatest && !isOldest && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Última</span>
        )}

        {!isBaseline && (
          <button
            onClick={e => { e.stopPropagation(); onSetBaseline() }}
            className="text-[10px] px-2 py-0.5 rounded border border-border hover:border-amber-500/60 hover:text-amber-500 text-muted-foreground/60 transition-colors"
          >
            <Flag className="w-2.5 h-2.5 inline mr-0.5" />
            Baseline
          </button>
        )}
      </div>
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

  // Snapshot sendo visualizado (default: mais recente = snapshots[0])
  const [viewId, setViewId] = useState<string | null>(null)
  // Baseline (default: mais antigo, persistido em localStorage)
  const [baselineId, setBaselineId] = useState<string | null>(() => {
    try { return localStorage.getItem('radar-impact-baseline') } catch { return null }
  })
  // Contas selecionadas
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  // Aba de analytics
  const [activeTab, setActiveTab] = useState<'velocidade' | 'pico' | 'temas' | 'consistencia' | 'evolucao'>('evolucao')
  // Métrica para gráfico de evolução
  const [evolutionMetric, setEvolutionMetric] = useState('viralRate')
  // Expandir/colapsar cards de conta
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())

  // Carrega snapshots
  useEffect(() => {
    getSnapshots()
      .then(snaps => {
        setSnapshots(snaps)
        // Default: visualiza o mais recente
        if (snaps.length > 0) {
          setViewId(snaps[0].id)
          // Baseline: usa localStorage ou o mais antigo
          setBaselineId(prev => {
            const stored = prev
            if (stored && snaps.find(s => s.id === stored)) return stored
            const oldest = snaps[snaps.length - 1]?.id ?? null
            try { if (oldest) localStorage.setItem('radar-impact-baseline', oldest) } catch {}
            return oldest
          })
        }
      })
      .catch(() => toast.error('Erro ao carregar capturas'))
      .finally(() => setLoading(false))
  }, [])

  // Inicializa contas selecionadas quando accounts carrega
  useEffect(() => {
    if (accounts.length > 0 && selectedAccounts.length === 0) {
      setSelectedAccounts(accounts.map(a => a.id))
    }
  }, [accounts])

  if (!isAdmin) return <Navigate to="/radar" replace />

  // ── Derived state ──────────────────────────────────────────────────────────

  const viewSnap = snapshots.find(s => s.id === viewId) ?? snapshots[0] ?? null
  const baselineSnap = snapshots.find(s => s.id === baselineId)
    ?? snapshots[snapshots.length - 1]
    ?? null
  const isComparing = !!(viewSnap && baselineSnap && viewSnap.id !== baselineSnap.id)

  const filteredAccounts = useMemo(
    () => accounts.filter(a => selectedAccounts.includes(a.id)),
    [accounts, selectedAccounts],
  )

  function saveBaseline(id: string) {
    setBaselineId(id)
    try { localStorage.setItem('radar-impact-baseline', id) } catch {}
    toast.success('Baseline definido')
  }

  function toggleAccountCard(id: string) {
    setExpandedAccounts(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Capture ────────────────────────────────────────────────────────────────

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
      setViewId(id)
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

  // ── Totais aggregados ──────────────────────────────────────────────────────

  function getAccountsFromSnap(snap: PerformanceSnapshot | null): AccountSnapshot[] {
    if (!snap) return []
    return filteredAccounts
      .map(a => snap.accounts[a.id])
      .filter((a): a is AccountSnapshot => !!a)
  }

  const viewAccounts = getAccountsFromSnap(viewSnap)
  const baseAccounts = getAccountsFromSnap(baselineSnap)

  const totals = useMemo(() => ({
    followers: viewAccounts.reduce((s, a) => s + a.followersCount, 0),
    viralPosts: viewAccounts.reduce((s, a) => s + a.viralPostsCount, 0),
    posts: viewAccounts.reduce((s, a) => s + a.totalPostsMonitored, 0),
    opportunities: viewAccounts.reduce((s, a) => s + a.totalOpportunities, 0),
    avgViralRate: viewAccounts.length > 0
      ? viewAccounts.reduce((s, a) => s + a.viralRate, 0) / viewAccounts.length : 0,
  }), [viewAccounts])

  const baseTotals = useMemo(() => ({
    followers: baseAccounts.reduce((s, a) => s + a.followersCount, 0),
    viralPosts: baseAccounts.reduce((s, a) => s + a.viralPostsCount, 0),
    posts: baseAccounts.reduce((s, a) => s + a.totalPostsMonitored, 0),
    opportunities: baseAccounts.reduce((s, a) => s + a.totalOpportunities, 0),
    avgViralRate: baseAccounts.length > 0
      ? baseAccounts.reduce((s, a) => s + a.viralRate, 0) / baseAccounts.length : 0,
  }), [baseAccounts])

  // ── Chart data ─────────────────────────────────────────────────────────────

  // Evolução temporal: todas as snapshots × contas selecionadas
  const evolutionData = useMemo(() => {
    const ordered = [...snapshots].reverse() // oldest first
    return ordered.map(snap => {
      const row: Record<string, unknown> = { label: fmtDate(snap.capturedAt) }
      for (const acc of filteredAccounts) {
        const a = snap.accounts[acc.id]
        if (!a) continue
        const val = (a as unknown as Record<string, unknown>)[evolutionMetric]
        row[acc.displayName] = typeof val === 'number' ? parseFloat(val.toFixed(2)) : null
      }
      return row
    })
  }, [snapshots, filteredAccounts, evolutionMetric])

  // Projeção linear para cada conta
  const projectionData = useMemo(() => {
    if (snapshots.length < 2 || evolutionData.length < 2) return evolutionData
    const projRows: typeof evolutionData = JSON.parse(JSON.stringify(evolutionData))

    for (const acc of filteredAccounts) {
      const key = acc.displayName
      const pts = evolutionData
        .map((d, i) => ({ x: i, y: typeof d[key] === 'number' ? d[key] as number : null }))
        .filter((p): p is { x: number; y: number } => p.y !== null)
      if (pts.length < 2) continue
      const { m, b } = linearRegression(pts)
      const n = evolutionData.length
      const proj1 = Math.max(0, m * n + b)
      const proj2 = Math.max(0, m * (n + 1) + b)
      projRows.push(
        { label: 'Proj. +1', [key]: parseFloat(proj1.toFixed(2)) },
        { label: 'Proj. +2', [key]: parseFloat(proj2.toFixed(2)) },
      )
    }
    // Remove duplicatas de proj
    const seen = new Set<string>()
    return projRows.filter(r => {
      const k = String(r.label)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [evolutionData, filteredAccounts, snapshots.length])

  // Velocidade cross-account
  const velocityData = useMemo(() => {
    if (!viewSnap) return []
    const buckets = ['<6h', '6-24h', '1-3d', '3-7d', '7+d']
    return buckets.map(bucket => {
      const row: Record<string, unknown> = { bucket }
      for (const acc of filteredAccounts) {
        const a = viewSnap.accounts[acc.id]
        if (a) row[acc.displayName] = a.viralVelocityBuckets?.[bucket] ?? 0
      }
      return row
    })
  }, [viewSnap, filteredAccounts])

  // Pico cross-account
  const peakData = useMemo(() => {
    if (!viewSnap) return []
    return Array.from({ length: 24 }, (_, h) => {
      const row: Record<string, unknown> = { hour: formatHour(h) }
      for (const acc of filteredAccounts) {
        const a = viewSnap.accounts[acc.id]
        if (a) row[acc.displayName] = a.peakViralHourDistribution?.[String(h)] ?? 0
      }
      return row
    })
  }, [viewSnap, filteredAccounts])

  // Temas cross-account (mergeado)
  const topicData = useMemo(() => {
    if (!viewSnap) return []
    const counts: Record<string, number> = {}
    for (const acc of filteredAccounts) {
      const a = viewSnap.accounts[acc.id]
      if (!a) continue
      for (const t of a.topTopics) {
        counts[t.topic] = (counts[t.topic] ?? 0) + t.count
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [viewSnap, filteredAccounts])

  // Consistência
  const consistencyData = useMemo(() => {
    if (!viewSnap) return []
    return filteredAccounts
      .map(acc => ({ name: acc.displayName, color: acc.color, score: viewSnap.accounts[acc.id]?.consistencyScore ?? 0 }))
      .sort((a, b) => b.score - a.score)
  }, [viewSnap, filteredAccounts])

  // Radar chart — comparação entre contas selecionadas (normalizado 0-100)
  const radarChartData = useMemo(() => {
    if (!viewSnap || filteredAccounts.length === 0) return []
    const metrics = [
      { label: 'Taxa viral', key: 'viralRate', max: 50 },
      { label: 'Engajamento', key: 'engagementRate30d', max: 10 },
      { label: 'Consistência', key: 'consistencyScore', max: 100 },
      { label: 'Oportunidades', key: 'totalOpportunities', max: 100 },
      { label: 'Posts virais', key: 'viralPostsCount', max: 50 },
    ]
    return metrics.map(m => {
      const row: Record<string, unknown> = { metric: m.label }
      for (const acc of filteredAccounts) {
        const a = viewSnap.accounts[acc.id]
        if (!a) continue
        const raw = (a as unknown as Record<string, unknown>)[m.key]
        const val = typeof raw === 'number' ? raw : 0
        row[acc.displayName] = Math.min(100, Math.round((val / m.max) * 100))
      }
      return row
    })
  }, [viewSnap, filteredAccounts])

  const showRadar = filteredAccounts.length >= 2 && filteredAccounts.length <= 5

  // ── Headline ────────────────────────────────────────────────────────────────

  const headline = useMemo(() => {
    if (!isComparing || !viewSnap || !baselineSnap || filteredAccounts.length === 0) return null
    const bAccs = getAccountsFromSnap(baselineSnap)
    const vAccs = getAccountsFromSnap(viewSnap)
    const bViral = bAccs.length > 0 ? bAccs.reduce((s, a) => s + a.viralRate, 0) / bAccs.length : 0
    const vViral = vAccs.length > 0 ? vAccs.reduce((s, a) => s + a.viralRate, 0) / vAccs.length : 0
    const bFoll = bAccs.reduce((s, a) => s + a.followersCount, 0)
    const vFoll = vAccs.reduce((s, a) => s + a.followersCount, 0)
    const viralDiff = vViral - bViral
    const follDiff = vFoll - bFoll
    if (Math.abs(viralDiff) >= 0.3) {
      const dir = viralDiff > 0 ? 'cresceu' : 'caiu'
      return `A taxa de viralização ${dir} ${Math.abs(viralDiff).toFixed(1)}pp desde o baseline (${fmtDate(baselineSnap.capturedAt)})`
    }
    if (Math.abs(follDiff) >= 100) {
      const dir = follDiff > 0 ? 'cresceram' : 'caíram'
      return `Os seguidores ${dir} ${fmtNum(Math.abs(follDiff))} desde o baseline (${fmtDate(baselineSnap.capturedAt)})`
    }
    return null
  }, [isComparing, viewSnap, baselineSnap, filteredAccounts])

  const currentMetric = EVOLUTION_METRICS.find(m => m.id === evolutionMetric)!

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-5">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Impacto do Radar</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Capturas manuais com baseline — compare qualquer conta consigo mesma ou entre si
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Nova captura
          </button>
        </div>

        {/* ── Modal captura ─────────────────────────────────────── */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={e => { if (e.target === e.currentTarget && !capturing) { setShowModal(false); setCaptureNote('') } }}
          >
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
              <h2 className="text-base font-bold mb-1">Nova captura</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Captura o estado atual das {accounts.length} contas. Pode demorar até 30 segundos.
              </p>
              <textarea
                className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                rows={3}
                placeholder="Nota (ex.: Início do acompanhamento, Semana 3, Pós-campanha...)"
                value={captureNote}
                onChange={e => setCaptureNote(e.target.value)}
                disabled={capturing}
                autoFocus
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
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Capturando...</>
                  ) : (
                    <><Camera className="w-3.5 h-3.5" />Capturar</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ──────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {/* ── Empty ────────────────────────────────────────────────── */}
        {!loading && snapshots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <Camera className="w-14 h-14 text-muted-foreground/20" />
            <h2 className="text-base font-semibold">Nenhuma captura ainda</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Clique em "Nova captura" para registrar o estado atual. Essa primeira captura
              se tornará o <strong>baseline</strong> de todas as comparações futuras.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Fazer primeira captura
            </button>
          </div>
        )}

        {/* ══ Conteúdo principal ════════════════════════════════════ */}
        {!loading && snapshots.length > 0 && viewSnap && (
          <>
            {/* ── Seletor de contas ─────────────────────────────── */}
            <div className="bg-card border border-border/60 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                Contas analisadas
              </p>
              <AccountPills
                accounts={accounts}
                selected={selectedAccounts}
                onChange={setSelectedAccounts}
              />
            </div>

            {/* ── Controle de snapshots ────────────────────────── */}
            <div className="bg-card border border-border/60 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Snapshot visualizado */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1.5">
                    Visualizando
                  </p>
                  <select
                    value={viewId ?? ''}
                    onChange={e => setViewId(e.target.value)}
                    className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {snapshots.map(s => (
                      <option key={s.id} value={s.id}>
                        {fmtDate(s.capturedAt)} — {s.note || 'Sem nota'}
                        {s.id === snapshots[0]?.id ? ' (mais recente)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Baseline */}
                <div>
                  <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Flag className="w-2.5 h-2.5" /> Baseline (referência)
                  </p>
                  <select
                    value={baselineId ?? ''}
                    onChange={e => saveBaseline(e.target.value)}
                    className="w-full bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    {snapshots.map(s => (
                      <option key={s.id} value={s.id}>
                        {fmtDate(s.capturedAt)} — {s.note || 'Sem nota'}
                        {s.id === snapshots[snapshots.length - 1]?.id ? ' (mais antigo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status da comparação */}
              <div className="sm:text-right">
                {isComparing ? (
                  <div className="text-xs">
                    <span className="text-amber-500 font-semibold">Δ ativo</span>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      {fmtDate(baselineSnap?.capturedAt)} → {fmtDate(viewSnap.capturedAt)}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Selecione snapshots<br className="hidden sm:block" /> diferentes para ver Δ
                  </p>
                )}
              </div>
            </div>

            {/* ── Headline ─────────────────────────────────────── */}
            {headline && (
              <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium">{headline}</p>
              </div>
            )}

            {/* ── Summary cards ─────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  icon: Users, label: 'Seguidores', color: '#38B6FF',
                  value: totals.followers, base: baseTotals.followers,
                },
                {
                  icon: Flame, label: 'Taxa viral média', color: '#f97316',
                  value: totals.avgViralRate, base: baseTotals.avgViralRate, pct: true,
                },
                {
                  icon: BarChart2, label: 'Posts virais', color: '#84cc16',
                  value: totals.viralPosts, base: baseTotals.viralPosts,
                },
                {
                  icon: Zap, label: 'Oportunidades', color: '#a855f7',
                  value: totals.opportunities, base: baseTotals.opportunities,
                },
              ].map(card => (
                <div key={card.label} className="bg-card border border-border/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <card.icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                    <span className="text-[11px] text-muted-foreground">{card.label}</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {card.pct ? fmtPct(card.value) : fmtNum(card.value)}
                  </p>
                  {isComparing && card.value !== card.base && (
                    <AbsDelta current={card.value} base={card.base} unit={card.pct ? '%' : ''} />
                  )}
                </div>
              ))}
            </div>

            {/* ── Radar chart (comparação entre contas) ─────────── */}
            {showRadar && radarChartData.length > 0 && (
              <div className="bg-card border border-border/60 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Radar — comparativo entre contas (normalizado)
                </p>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarChartData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                      {filteredAccounts.map(acc => (
                        <Radar
                          key={acc.id}
                          name={acc.displayName}
                          dataKey={acc.displayName}
                          stroke={acc.color}
                          fill={acc.color}
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1 text-center">
                  Cada eixo normalizado pelo valor máximo esperado (taxa viral max 50%, etc.)
                </p>
              </div>
            )}

            {/* ── Tabela comparativa ───────────────────────────── */}
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Comparativo entre contas
                </p>
                {isComparing && (
                  <span className="text-[10px] text-amber-500 font-semibold">
                    Δ vs baseline {fmtDate(baselineSnap?.capturedAt)}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium">Conta</th>
                      <th className="text-right px-3 py-2 font-medium">Seguidores</th>
                      <th className="text-right px-3 py-2 font-medium">Posts</th>
                      <th className="text-right px-3 py-2 font-medium">Virais</th>
                      <th className="text-right px-3 py-2 font-medium">Taxa viral</th>
                      <th className="text-right px-3 py-2 font-medium">Engajamento</th>
                      <th className="text-right px-3 py-2 font-medium">Oport.</th>
                      <th className="text-right px-3 py-2 font-medium">Consistência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map(acc => {
                      const a = viewSnap.accounts[acc.id]
                      const b = baselineSnap?.accounts[acc.id]
                      if (!a) return null
                      return (
                        <tr key={acc.id} className="border-b border-border/20 hover:bg-accent/10 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                              <span className="font-medium text-foreground">{acc.displayName}</span>
                            </div>
                          </td>
                          {[
                            { v: a.followersCount, bv: b?.followersCount },
                            { v: a.totalPostsMonitored, bv: b?.totalPostsMonitored },
                            { v: a.viralPostsCount, bv: b?.viralPostsCount },
                          ].map((m, i) => (
                            <td key={i} className="text-right px-3 py-2.5">
                              <span className="font-semibold text-foreground">{fmtNum(m.v)}</span>
                              {isComparing && m.bv !== undefined && (
                                <div><AbsDelta current={m.v} base={m.bv} /></div>
                              )}
                            </td>
                          ))}
                          <td className="text-right px-3 py-2.5">
                            <span className="font-semibold" style={{ color: acc.color }}>{fmtPct(a.viralRate)}</span>
                            {isComparing && b && <div><AbsDelta current={a.viralRate} base={b.viralRate} unit="%" /></div>}
                          </td>
                          <td className="text-right px-3 py-2.5">
                            <span className="font-semibold text-foreground">{fmtPct(a.engagementRate30d)}</span>
                            {isComparing && b && <div><AbsDelta current={a.engagementRate30d} base={b.engagementRate30d} unit="%" /></div>}
                          </td>
                          <td className="text-right px-3 py-2.5">
                            <span className="font-semibold text-foreground">{a.totalOpportunities}</span>
                            {isComparing && b && <div><AbsDelta current={a.totalOpportunities} base={b.totalOpportunities} /></div>}
                          </td>
                          <td className="text-right px-3 py-2.5">
                            <span className="font-semibold text-foreground">
                              {a.consistencyScore !== null ? fmtPct(a.consistencyScore) : '—'}
                            </span>
                            {isComparing && b && b.consistencyScore !== null && a.consistencyScore !== null && (
                              <div><AbsDelta current={a.consistencyScore} base={b.consistencyScore} unit="%" /></div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Tabs analytics ───────────────────────────────── */}
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
              <div className="flex overflow-x-auto border-b border-border/40">
                {([
                  { id: 'evolucao' as const, label: 'Evolução', icon: TrendingUp },
                  { id: 'velocidade' as const, label: 'Velocidade', icon: Zap },
                  { id: 'pico' as const, label: 'Horário de pico', icon: Clock },
                  { id: 'temas' as const, label: 'Temas', icon: Target },
                  { id: 'consistencia' as const, label: 'Consistência', icon: CheckCircle },
                ]).map(tab => (
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
                {/* Evolução temporal */}
                {activeTab === 'evolucao' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        {snapshots.length < 2
                          ? 'Faça mais capturas para visualizar a evolução ao longo do tempo.'
                          : `Evolução de ${currentMetric.label} ao longo de ${snapshots.length} capturas — com projeção linear.`}
                      </p>
                      <select
                        value={evolutionMetric}
                        onChange={e => setEvolutionMetric(e.target.value)}
                        className="bg-background border border-border/60 rounded-lg px-2 py-1 text-xs focus:outline-none"
                      >
                        {EVOLUTION_METRICS.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    {snapshots.length >= 1 && (
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={projectionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} unit={currentMetric.unit} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {filteredAccounts.map(acc => (
                              <Line
                                key={acc.id}
                                type="monotone"
                                dataKey={acc.displayName}
                                stroke={acc.color}
                                strokeWidth={2}
                                dot={{ r: 4, fill: acc.color }}
                                connectNulls={false}
                                strokeDasharray={(projectionData.some(d => d.label?.toString().startsWith('Proj'))) ? undefined : undefined}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {snapshots.length >= 2 && (
                      <p className="text-[10px] text-muted-foreground/60 text-center">
                        Pontos "Proj. +1" e "Proj. +2" são projeções lineares baseadas no histórico
                      </p>
                    )}
                  </div>
                )}

                {/* Velocidade */}
                {activeTab === 'velocidade' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Distribuição dos posts virais por tempo de vida na captura selecionada.
                      "&lt;6h" = viralizou muito rápido.
                    </p>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={velocityData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {filteredAccounts.map(acc => (
                            <Bar key={acc.id} dataKey={acc.displayName} fill={acc.color} stackId="a" radius={[0, 0, 0, 0]} />
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
                      Horário de publicação dos posts virais. Ajuda a decidir o melhor momento para publicar.
                    </p>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={peakData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={1} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {filteredAccounts.map(acc => (
                            <Bar key={acc.id} dataKey={acc.displayName} fill={acc.color} stackId="a" />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {filteredAccounts.map(acc => {
                        const a = viewSnap.accounts[acc.id]
                        if (!a || a.peakViralHour === null) return null
                        return (
                          <div key={acc.id} className="flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                            <span className="text-muted-foreground">{acc.displayName}:</span>
                            <span className="font-semibold">{formatHour(a.peakViralHour)}</span>
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
                      Temas mais frequentes nas oportunidades das contas selecionadas.
                    </p>
                    {topicData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Nenhum tema ainda</p>
                    ) : (
                      <div className="space-y-1.5">
                        {topicData.map(([topic, count], i) => (
                          <div key={topic} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-4 text-right tabular-nums">{i + 1}</span>
                            <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden">
                              <div
                                className="h-full bg-primary/70 rounded transition-all duration-500"
                                style={{ width: `${(count / topicData[0][1]) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-foreground min-w-[150px] truncate">{topic}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{count}×</span>
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
                    {consistencyData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
                    ) : (
                      <div className="space-y-2.5">
                        {consistencyData.map(item => {
                          const acc = accounts.find(a => a.displayName === item.name)
                          const baseAcc = baselineSnap && acc ? baselineSnap.accounts[acc.id] : null
                          return (
                            <div key={item.name} className="space-y-0.5">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                  <span className="text-foreground font-medium">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isComparing && baseAcc?.consistencyScore !== undefined && baseAcc.consistencyScore !== null && (
                                    <AbsDelta current={item.score} base={baseAcc.consistencyScore} unit="%" />
                                  )}
                                  <span className="font-bold text-foreground">{item.score}%</span>
                                </div>
                              </div>
                              <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${item.score}%`, backgroundColor: item.color }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Capturas (lista com baseline) ────────────────── */}
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Histórico de capturas ({snapshots.length})
                </p>
              </div>
              <div>
                {snapshots.map(snap => (
                  <SnapshotListItem
                    key={snap.id}
                    snap={snap}
                    isBaseline={snap.id === (baselineSnap?.id ?? null)}
                    isViewing={snap.id === viewSnap.id}
                    isOldest={snap.id === snapshots[snapshots.length - 1]?.id}
                    isLatest={snap.id === snapshots[0]?.id}
                    onSelect={() => setViewId(snap.id)}
                    onSetBaseline={() => saveBaseline(snap.id)}
                  />
                ))}
              </div>
            </div>

            {/* ── Cards detalhados por conta ───────────────────── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Detalhes por conta
              </p>
              <div className="space-y-2">
                {filteredAccounts.map(acc => {
                  const a = viewSnap.accounts[acc.id]
                  const b = baselineSnap?.accounts[acc.id]
                  if (!a) return null
                  const open = expandedAccounts.has(acc.id)
                  const totalViews = Object.values(a.viewsByFollowType ?? {}).reduce((s, v) => s + v, 0) || a.impressions30d
                  const totalReach = Object.values(a.reachByFollowType ?? {}).reduce((s, v) => s + v, 0) || a.reach30d
                  const hourData = Array.from({ length: 24 }, (_, h) => ({
                    hour: formatHour(h),
                    posts: a.peakViralHourDistribution?.[String(h)] ?? 0,
                  })).filter(d => d.posts > 0)

                  return (
                    <div key={acc.id} className="bg-card border border-border/60 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleAccountCard(acc.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors text-left"
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                        <span className="font-semibold text-sm flex-1">{acc.displayName}</span>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{fmtNum(a.followersCount)} seg.</span>
                          <span style={{ color: acc.color }} className="font-bold">{fmtPct(a.viralRate)} viral</span>
                          {isComparing && b && (
                            <AbsDelta current={a.viralRate} base={b.viralRate} unit="%" />
                          )}
                        </div>
                        {open
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                        }
                      </button>

                      {open && (
                        <div className="px-4 pb-4 pt-2 border-t border-border/30 space-y-4">
                          {/* Metrics grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { label: 'Seguidores', v: a.followersCount, bv: b?.followersCount },
                              { label: 'Posts monitados', v: a.totalPostsMonitored, bv: b?.totalPostsMonitored },
                              { label: 'Posts virais', v: a.viralPostsCount, bv: b?.viralPostsCount },
                              { label: 'Taxa viral', v: a.viralRate, bv: b?.viralRate, pct: true },
                              { label: 'Oportunidades', v: a.totalOpportunities, bv: b?.totalOpportunities },
                              { label: 'Engajamento 30d', v: a.engagementRate30d, bv: b?.engagementRate30d, pct: true },
                              { label: 'Alcance 30d', v: totalReach, bv: b ? Object.values(b.reachByFollowType ?? {}).reduce((s, v) => s + v, 0) || b.reach30d : undefined },
                              { label: 'Consistência', v: a.consistencyScore ?? 0, bv: b?.consistencyScore ?? undefined, pct: true },
                            ].map(m => (
                              <div key={m.label} className="bg-background/50 rounded-lg p-2">
                                <p className="text-[10px] text-muted-foreground">{m.label}</p>
                                <p className="text-sm font-bold">{m.pct ? fmtPct(m.v) : fmtNum(m.v)}</p>
                                {isComparing && m.bv !== undefined && (
                                  <AbsDelta current={m.v} base={m.bv} unit={m.pct ? '%' : ''} />
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Totais posts */}
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Engajamento total — todos os posts</p>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                              {[
                                { e: '💬', l: 'Comentários', v: a.totalComments, bv: b?.totalComments },
                                { e: '❤️', l: 'Curtidas', v: a.totalLikes, bv: b?.totalLikes },
                                { e: '🔁', l: 'Shares', v: a.totalShares, bv: b?.totalShares },
                                { e: '🔖', l: 'Salvos', v: a.totalSaves, bv: b?.totalSaves },
                                { e: '▶️', l: 'Plays', v: a.totalPlays, bv: b?.totalPlays },
                              ].map(m => (
                                <div key={m.l} className="bg-background/50 rounded-lg p-2 text-center">
                                  <p className="text-[10px] text-muted-foreground">{m.e} {m.l}</p>
                                  <p className="text-sm font-bold">{fmtNum(m.v)}</p>
                                  {isComparing && m.bv !== undefined && (
                                    <div className="flex justify-center">
                                      <AbsDelta current={m.v} base={m.bv} />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Instagram 30d */}
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Alcance Instagram (30d)</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { l: 'Views', v: totalViews },
                                { l: 'Alcance único', v: totalReach },
                                { l: 'Visitas perfil', v: a.profileViews30d },
                                { l: 'Cliques link', v: a.websiteClicks30d },
                              ].map(m => (
                                <div key={m.l} className="bg-background/50 rounded-lg p-2">
                                  <p className="text-[10px] text-muted-foreground">{m.l}</p>
                                  <p className="text-sm font-bold">{fmtNum(m.v)}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Pico */}
                          {a.peakViralHour !== null && hourData.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground mb-1">
                                Horário de pico — posts virais às {formatHour(a.peakViralHour)}
                              </p>
                              <div className="h-[70px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={hourData} barSize={8}>
                                    <XAxis dataKey="hour" tick={{ fontSize: 8 }} />
                                    <Bar dataKey="posts" fill={acc.color} radius={2} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}

                          {/* Temas */}
                          {a.topTopics.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Temas que funcionaram</p>
                              <div className="flex flex-wrap gap-1.5">
                                {a.topTopics.slice(0, 8).map(t => (
                                  <span key={t.topic} className="text-[10px] px-2 py-0.5 rounded-full border"
                                    style={{ borderColor: acc.color + '50', color: acc.color }}>
                                    {t.topic} ({t.count})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Velocidade */}
                          {Object.values(a.viralVelocityBuckets ?? {}).some(v => v > 0) && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Velocidade de viralização</p>
                              <div className="flex gap-2 flex-wrap">
                                {Object.entries(a.viralVelocityBuckets ?? {}).map(([label, count]) => count > 0 && (
                                  <div key={label} className="flex items-center gap-1.5 bg-background/50 rounded-lg px-2 py-1 text-xs">
                                    <span className="w-2 h-2 rounded-full" style={{
                                      backgroundColor: label === '<6h' ? '#22c55e' : label === '6-24h' ? '#84cc16' : label === '1-3d' ? '#eab308' : label === '3-7d' ? '#f97316' : '#ef4444'
                                    }} />
                                    <span className="font-medium">{label}</span>
                                    <span className="text-muted-foreground">{count}p</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Melhor post */}
                          {a.bestPostUrl && (
                            <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
                              <Star className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                              <span className="text-xs text-muted-foreground">Melhor post:</span>
                              <span className="text-xs font-semibold">score {a.bestPostScore}</span>
                              {isComparing && b?.bestPostScore !== undefined && (
                                <AbsDelta current={a.bestPostScore ?? 0} base={b.bestPostScore ?? 0} />
                              )}
                              <a href={a.bestPostUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">
                                <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
