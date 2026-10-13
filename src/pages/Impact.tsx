import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import {
  Camera, ChevronDown, ChevronUp, ExternalLink, TrendingUp,
  Users, Zap, CheckCircle, ArrowUpRight, ArrowDownRight,
  Flag, Clock, Target, BarChart2, Flame, Star, RefreshCw,
  CalendarDays, Bot, Hand, Download, GitCompare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useAccount } from '@/contexts/AccountContext'
import { captureSnapshot, getSnapshots } from '@/services/snapshots'
import type { PerformanceSnapshot, AccountSnapshot } from '@/types/snapshot'
import type { Timestamp } from 'firebase/firestore'
import { exportCsv, exportXlsx } from '@/utils/exportData'

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
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
function formatHour(h: number) { return `${String(h).padStart(2, '0')}h` }

function findClosestSnapshot(
  snaps: PerformanceSnapshot[],
  targetMs: number,
): PerformanceSnapshot | null {
  if (snaps.length === 0) return null
  return snaps.reduce((best, s) => {
    const d = Math.abs(s.capturedAt.toMillis() - targetMs)
    const bd = Math.abs(best.capturedAt.toMillis() - targetMs)
    return d < bd ? s : best
  })
}

function autoSuggestBaselineId(snaps: PerformanceSnapshot[]): string | null {
  if (snaps.length < 2) return null
  const latestMs = snaps[0].capturedAt.toMillis()
  const oldestMs = snaps[snaps.length - 1].capturedAt.toMillis()
  const historyDays = (latestMs - oldestMs) / (1000 * 60 * 60 * 24)
  const targetDays = historyDays < 28 ? 7 : 30
  const targetMs = latestMs - targetDays * 24 * 60 * 60 * 1000
  const candidate = findClosestSnapshot(snaps.slice(1), targetMs)
  return candidate?.id ?? snaps[snaps.length - 1].id
}

// ─── Delta badge ──────────────────────────────────────────────────────────────

function AbsDelta({ current, base, unit = '', invert = false }: {
  current: number; base: number; unit?: string; invert?: boolean
}) {
  const abs = current - base
  if (abs === 0) return <span className="text-[10px] text-muted-foreground/40">—</span>
  const positive = invert ? abs < 0 : abs > 0
  return (
    <span className={cn('text-[10px] font-semibold flex items-center gap-0.5 leading-none',
      positive ? 'text-emerald-500' : 'text-red-400')}>
      {positive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {unit === '%'
        ? `${abs > 0 ? '+' : ''}${fmtPct(abs)}`
        : `${abs > 0 ? '+' : '-'}${fmtNum(Math.abs(abs))}`}
      {unit && unit !== '%' ? unit : ''}
    </span>
  )
}

// ─── Regressão linear ─────────────────────────────────────────────────────────

function linearRegression(pts: { x: number; y: number }[]): { m: number; b: number } {
  const n = pts.length
  if (n < 2) return { m: 0, b: pts[0]?.y ?? 0 }
  const sx = pts.reduce((s, p) => s + p.x, 0), sy = pts.reduce((s, p) => s + p.y, 0)
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0), sx2 = pts.reduce((s, p) => s + p.x * p.x, 0)
  const m = (n * sxy - sx * sy) / (n * sx2 - sx * sx)
  return { m, b: (sy - m * sx) / n }
}

// ─── Métricas de evolução disponíveis ─────────────────────────────────────────

const EVOLUTION_METRICS = [
  { id: 'viralRate',        label: 'Taxa viral (%)',      unit: '%' },
  { id: 'followersCount',   label: 'Seguidores',          unit: ''  },
  { id: 'viralPostsCount',  label: 'Posts virais',        unit: ''  },
  { id: 'totalOpportunities', label: 'Oportunidades',     unit: ''  },
  { id: 'engagementRate30d', label: 'Engajamento 30d (%)' , unit: '%' },
  { id: 'consistencyScore', label: 'Consistência (%)',    unit: '%' },
]

const PERIOD_PRESETS = [
  { id: '1w',     label: 'vs 1 semana',  days: 7   },
  { id: '1m',     label: 'vs 1 mês',     days: 30  },
  { id: '3m',     label: 'vs 3 meses',   days: 90  },
  { id: 'inicio', label: 'vs início',    days: Infinity },
]

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: {
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
          <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Pills de conta ───────────────────────────────────────────────────────────

function AccountPills({
  accounts, selected, onChange,
}: {
  accounts: { id: string; displayName: string; color: string; shortName: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const all = selected.length === accounts.length
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => onChange(all ? [] : accounts.map(a => a.id))}
        className={cn(
          'text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
          all ? 'bg-foreground/10 border-foreground/30 text-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
        )}
      >
        {all ? 'Todas ✓' : 'Todas'}
      </button>
      {accounts.map(acc => {
        const on = selected.includes(acc.id)
        return (
          <button key={acc.id} onClick={() => toggle(acc.id)}
            className={cn('text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
              on ? 'text-white' : 'text-muted-foreground hover:text-foreground')}
            style={on ? { backgroundColor: acc.color, borderColor: acc.color } : { borderColor: acc.color + '55' }}
          >
            {acc.shortName}
          </button>
        )
      })}
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

  const [viewId, setViewId] = useState<string | null>(null)
  const [baselineId, setBaselineId] = useState<string | null>(() => {
    try { return localStorage.getItem('radar-impact-baseline') } catch { return null }
  })
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'evolucao' | 'velocidade' | 'pico' | 'temas' | 'consistencia'>('evolucao')
  const [evolutionMetric, setEvolutionMetric] = useState('viralRate')
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())

  // Comparação de períodos
  const [exportOpen, setExportOpen] = useState(false)
  const [periodMode, setPeriodMode] = useState(false)
  const [periodAStartId, setPeriodAStartId] = useState<string | null>(null)
  const [periodAEndId,   setPeriodAEndId]   = useState<string | null>(null)
  const [periodBStartId, setPeriodBStartId] = useState<string | null>(null)
  const [periodBEndId,   setPeriodBEndId]   = useState<string | null>(null)

  useEffect(() => {
    getSnapshots()
      .then(snaps => {
        setSnapshots(snaps)
        if (snaps.length > 0) {
          setViewId(snaps[0].id)
          setBaselineId(prev => {
            try {
              const stored = prev ?? localStorage.getItem('radar-impact-baseline')
              if (stored && snaps.find(s => s.id === stored)) return stored
            } catch { /* ignore */ }
            const suggested = autoSuggestBaselineId(snaps)
            try { if (suggested) localStorage.setItem('radar-impact-baseline', suggested) } catch { /* ignore */ }
            return suggested
          })
        }
      })
      .catch(() => toast.error('Erro ao carregar capturas'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (accounts.length > 0 && selectedAccounts.length === 0) {
      setSelectedAccounts(accounts.map(a => a.id))
    }
  }, [accounts])

  if (!isAdmin) return <Navigate to="/radar" replace />

  // ── Derived ────────────────────────────────────────────────────────────────

  const viewSnap = snapshots.find(s => s.id === viewId) ?? snapshots[0] ?? null
  const baselineSnap = snapshots.find(s => s.id === baselineId) ?? snapshots[snapshots.length - 1] ?? null
  const isComparing = !!(viewSnap && baselineSnap && viewSnap.id !== baselineSnap.id)

  const filteredAccounts = useMemo(
    () => accounts.filter(a => selectedAccounts.includes(a.id)),
    [accounts, selectedAccounts],
  )

  function saveBaseline(id: string) {
    setBaselineId(id)
    try { localStorage.setItem('radar-impact-baseline', id) } catch { /* ignore */ }
    toast.success('Baseline definido')
  }

  function applyPeriodPreset(days: number) {
    if (!viewSnap || snapshots.length < 2) return
    if (days === Infinity) {
      saveBaseline(snapshots[snapshots.length - 1].id)
      return
    }
    const targetMs = viewSnap.capturedAt.toMillis() - days * 24 * 60 * 60 * 1000
    const candidate = findClosestSnapshot(
      snapshots.filter(s => s.id !== viewSnap.id),
      targetMs,
    )
    if (candidate) saveBaseline(candidate.id)
  }

  function getActivePeriodPreset(): string | null {
    if (!isComparing || !viewSnap || !baselineSnap) return null
    const diffDays = (viewSnap.capturedAt.toMillis() - baselineSnap.capturedAt.toMillis()) / (1000 * 60 * 60 * 24)
    if (baselineSnap.id === snapshots[snapshots.length - 1]?.id) return 'inicio'
    if (diffDays <= 10) return '1w'
    if (diffDays <= 45) return '1m'
    if (diffDays <= 120) return '3m'
    return null
  }

  const activePeriodPreset = getActivePeriodPreset()

  // ── Period comparison ─────────────────────────────────────────────────────
  const periodAStart = snapshots.find(s => s.id === periodAStartId) ?? null
  const periodAEnd   = snapshots.find(s => s.id === periodAEndId)   ?? null
  const periodBStart = snapshots.find(s => s.id === periodBStartId) ?? null
  const periodBEnd   = snapshots.find(s => s.id === periodBEndId)   ?? null

  function togglePeriodMode() {
    if (!periodMode && snapshots.length >= 2) {
      // Auto-fill sensible defaults
      const latest = snapshots[0]
      const oldest = snapshots[snapshots.length - 1]
      const mid = snapshots[Math.floor(snapshots.length / 2)] ?? snapshots[1]
      setPeriodAStartId(oldest.id)
      setPeriodAEndId(mid.id)
      setPeriodBStartId(mid.id)
      setPeriodBEndId(latest.id)
    }
    setPeriodMode(v => !v)
  }

  interface PeriodMetrics {
    followers: number; viralPosts: number; opportunities: number; avgViralRate: number
    engagementRate: number; consistencyScore: number
  }

  function computePeriodDelta(
    startSnap: PerformanceSnapshot | null,
    endSnap: PerformanceSnapshot | null,
  ): PeriodMetrics | null {
    if (!startSnap || !endSnap) return null
    const startAccs = filteredAccounts.map(a => startSnap.accounts[a.id]).filter(Boolean)
    const endAccs   = filteredAccounts.map(a => endSnap.accounts[a.id]).filter(Boolean)
    if (!startAccs.length || !endAccs.length) return null
    const sumField = (accs: AccountSnapshot[], key: keyof AccountSnapshot) =>
      accs.reduce((s, a) => s + (typeof a[key] === 'number' ? (a[key] as number) : 0), 0)
    const avg = (accs: AccountSnapshot[], key: keyof AccountSnapshot) =>
      accs.length ? sumField(accs, key) / accs.length : 0
    return {
      followers:      sumField(endAccs, 'followersCount')    - sumField(startAccs, 'followersCount'),
      viralPosts:     sumField(endAccs, 'viralPostsCount')   - sumField(startAccs, 'viralPostsCount'),
      opportunities:  sumField(endAccs, 'totalOpportunities')- sumField(startAccs, 'totalOpportunities'),
      avgViralRate:   avg(endAccs, 'viralRate')               - avg(startAccs, 'viralRate'),
      engagementRate: avg(endAccs, 'engagementRate30d')       - avg(startAccs, 'engagementRate30d'),
      consistencyScore: avg(endAccs, 'consistencyScore')      - avg(startAccs, 'consistencyScore'),
    }
  }

  const deltaA = useMemo(() => computePeriodDelta(periodAStart, periodAEnd), [periodAStart, periodAEnd, filteredAccounts])
  const deltaB = useMemo(() => computePeriodDelta(periodBStart, periodBEnd), [periodBStart, periodBEnd, filteredAccounts])

  // ── Export ────────────────────────────────────────────────────────────────
  function buildComparisonRows() {
    if (!viewSnap) return []
    const sameSnap = viewSnap.id === baselineSnap?.id
    return filteredAccounts.flatMap(acc => {
      const a = viewSnap.accounts[acc.id]
      const b = sameSnap ? undefined : baselineSnap?.accounts[acc.id]
      if (!a) return []
      const diff = (v: number, bv?: number) => bv != null ? +(v - bv).toFixed(2) : 'N/A (mesmo snapshot)'
      const diffPct = (v: number, bv?: number) => bv != null ? +(v - bv).toFixed(2) : 'N/A (mesmo snapshot)'
      return [{
        'Conta': acc.displayName,
        'Data (atual)': fmtDateTime(viewSnap.capturedAt),
        'Data (baseline)': baselineSnap && !sameSnap ? fmtDateTime(baselineSnap.capturedAt) : '— mesmo snapshot',
        'Seguidores': a.followersCount,
        'Seguidores (variação)': diff(a.followersCount, b?.followersCount),
        'Taxa viral (%)': +a.viralRate.toFixed(2),
        'Taxa viral (variação pp)': diffPct(a.viralRate, b?.viralRate),
        'Posts virais': a.viralPostsCount,
        'Posts virais (variação)': diff(a.viralPostsCount, b?.viralPostsCount),
        'Engajamento 30d (%)': +a.engagementRate30d.toFixed(2),
        'Engajamento (variação pp)': diffPct(a.engagementRate30d, b?.engagementRate30d),
        'Oportunidades IA': a.totalOpportunities,
        'Oportunidades (variação)': diff(a.totalOpportunities, b?.totalOpportunities),
        'Consistência (%)': a.consistencyScore ?? '',
        'Consistência (variação pp)': a.consistencyScore != null
          ? diffPct(a.consistencyScore, b?.consistencyScore ?? undefined) : 'N/A',
        'Posts monitorados': a.totalPostsMonitored,
        'Curtidas': a.totalLikes,
        'Comentários': a.totalComments,
        'Alcance 30d': a.reach30d,
      }]
    })
  }

  function buildHistoryRows() {
    return snapshots.flatMap(snap =>
      filteredAccounts.flatMap(acc => {
        const a = snap.accounts[acc.id]
        if (!a) return []
        return [{
          'Data captura': fmtDateTime(snap.capturedAt),
          'Tipo captura': snap.type === 'auto' ? 'Automática' : 'Manual',
          'Nota': snap.note || '',
          'Conta': acc.displayName,
          'Seguidores': a.followersCount,
          'Taxa viral (%)': +a.viralRate.toFixed(2),
          'Posts virais': a.viralPostsCount,
          'Engajamento 30d (%)': +a.engagementRate30d.toFixed(2),
          'Oportunidades IA': a.totalOpportunities,
          'Consistência (%)': a.consistencyScore ?? '',
          'Posts monitorados': a.totalPostsMonitored,
          'Alcance 30d': a.reach30d,
          'Curtidas': a.totalLikes,
          'Comentários': a.totalComments,
        }]
      })
    )
  }

  const COMP_HEADERS = ['Conta','Data (atual)','Data (baseline)','Seguidores','Seguidores (variação)','Taxa viral (%)','Taxa viral (variação pp)','Posts virais','Posts virais (variação)','Engajamento 30d (%)','Engajamento (variação pp)','Oportunidades IA','Oportunidades (variação)','Consistência (%)','Consistência (variação pp)','Posts monitorados','Curtidas','Comentários','Alcance 30d']
  const HIST_HEADERS = ['Data captura','Tipo captura','Nota','Conta','Seguidores','Taxa viral (%)','Posts virais','Engajamento 30d (%)','Oportunidades IA','Consistência (%)','Posts monitorados','Alcance 30d','Curtidas','Comentários']

  function handleExportComparativoCsv()  { exportCsv(buildComparisonRows(),  COMP_HEADERS, `impacto-comparativo-${new Date().toISOString().slice(0,10)}.csv`) }
  function handleExportComparativoXlsx() { exportXlsx(buildComparisonRows(), COMP_HEADERS, `impacto-comparativo-${new Date().toISOString().slice(0,10)}.xlsx`, 'Comparativo') }
  function handleExportHistoricoCsv()    { exportCsv(buildHistoryRows(),     HIST_HEADERS, `impacto-historico-${new Date().toISOString().slice(0,10)}.csv`) }
  function handleExportHistoricoXlsx()   { exportXlsx(buildHistoryRows(),    HIST_HEADERS, `impacto-historico-${new Date().toISOString().slice(0,10)}.xlsx`, 'Histórico') }


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
      toast.success('Captura realizada')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao capturar')
    } finally {
      setCapturing(false)
    }
  }

  // ── Aggregated totals ──────────────────────────────────────────────────────

  function getAccounts(snap: PerformanceSnapshot | null): AccountSnapshot[] {
    if (!snap) return []
    return filteredAccounts.map(a => snap.accounts[a.id]).filter((a): a is AccountSnapshot => !!a)
  }

  const viewAccounts = getAccounts(viewSnap)
  const baseAccounts = getAccounts(baselineSnap)

  const totals = useMemo(() => ({
    followers: viewAccounts.reduce((s, a) => s + a.followersCount, 0),
    viralPosts: viewAccounts.reduce((s, a) => s + a.viralPostsCount, 0),
    opportunities: viewAccounts.reduce((s, a) => s + a.totalOpportunities, 0),
    avgViralRate: viewAccounts.length > 0
      ? viewAccounts.reduce((s, a) => s + a.viralRate, 0) / viewAccounts.length : 0,
  }), [viewAccounts])

  const baseTotals = useMemo(() => ({
    followers: baseAccounts.reduce((s, a) => s + a.followersCount, 0),
    viralPosts: baseAccounts.reduce((s, a) => s + a.viralPostsCount, 0),
    opportunities: baseAccounts.reduce((s, a) => s + a.totalOpportunities, 0),
    avgViralRate: baseAccounts.length > 0
      ? baseAccounts.reduce((s, a) => s + a.viralRate, 0) / baseAccounts.length : 0,
  }), [baseAccounts])

  // ── Chart data ─────────────────────────────────────────────────────────────

  const evolutionData = useMemo(() => {
    const ordered = [...snapshots].reverse()
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

  const projectionData = useMemo(() => {
    if (snapshots.length < 2) return evolutionData
    const extra: typeof evolutionData = []
    for (const acc of filteredAccounts) {
      const key = acc.displayName
      const pts = evolutionData
        .map((d, i) => ({ x: i, y: typeof d[key] === 'number' ? d[key] as number : null }))
        .filter((p): p is { x: number; y: number } => p.y !== null)
      if (pts.length < 2) continue
      const { m, b } = linearRegression(pts)
      const n = evolutionData.length
      for (let j = 1; j <= 2; j++) {
        const label = `Proj. +${j}`
        const existing = extra.find(r => r.label === label)
        const val = parseFloat(Math.max(0, m * (n - 1 + j) + b).toFixed(2))
        if (existing) existing[key] = val
        else extra.push({ label, [key]: val })
      }
    }
    return [...evolutionData, ...extra]
  }, [evolutionData, filteredAccounts, snapshots.length])

  const velocityData = useMemo(() => {
    if (!viewSnap) return []
    return ['<6h', '6-24h', '1-3d', '3-7d', '7+d'].map(bucket => {
      const row: Record<string, unknown> = { bucket }
      for (const acc of filteredAccounts) {
        const a = viewSnap.accounts[acc.id]
        if (a) row[acc.displayName] = a.viralVelocityBuckets?.[bucket] ?? 0
      }
      return row
    })
  }, [viewSnap, filteredAccounts])

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

  const topicData = useMemo(() => {
    if (!viewSnap) return []
    const counts: Record<string, number> = {}
    for (const acc of filteredAccounts) {
      const a = viewSnap.accounts[acc.id]
      if (!a) continue
      for (const t of a.topTopics) counts[t.topic] = (counts[t.topic] ?? 0) + t.count
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [viewSnap, filteredAccounts])

  const consistencyData = useMemo(() => {
    if (!viewSnap) return []
    return filteredAccounts
      .map(acc => ({ name: acc.displayName, color: acc.color, id: acc.id, score: viewSnap.accounts[acc.id]?.consistencyScore ?? 0 }))
      .sort((a, b) => b.score - a.score)
  }, [viewSnap, filteredAccounts])

  const radarData = useMemo(() => {
    if (!viewSnap || filteredAccounts.length < 2) return []
    const metrics = [
      { label: 'Taxa viral',    key: 'viralRate',           max: 50  },
      { label: 'Engajamento',   key: 'engagementRate30d',   max: 10  },
      { label: 'Consistência',  key: 'consistencyScore',    max: 100 },
      { label: 'Oportunidades', key: 'totalOpportunities',  max: 100 },
      { label: 'Posts virais',  key: 'viralPostsCount',     max: 50  },
    ]
    return metrics.map(m => {
      const row: Record<string, unknown> = { metric: m.label }
      for (const acc of filteredAccounts) {
        const a = viewSnap.accounts[acc.id]
        if (!a) continue
        const raw = (a as unknown as Record<string, unknown>)[m.key]
        row[acc.displayName] = Math.min(100, Math.round(((typeof raw === 'number' ? raw : 0) / m.max) * 100))
      }
      return row
    })
  }, [viewSnap, filteredAccounts])

  const headline = useMemo(() => {
    if (!isComparing || !viewSnap || !baselineSnap || filteredAccounts.length === 0) return null
    const bA = getAccounts(baselineSnap), vA = getAccounts(viewSnap)
    const bViral = bA.length > 0 ? bA.reduce((s, a) => s + a.viralRate, 0) / bA.length : 0
    const vViral = vA.length > 0 ? vA.reduce((s, a) => s + a.viralRate, 0) / vA.length : 0
    const diff = vViral - bViral
    if (Math.abs(diff) >= 0.5) {
      return `Taxa de viralização ${diff > 0 ? 'cresceu' : 'caiu'} ${Math.abs(diff).toFixed(1)}pp desde ${fmtDate(baselineSnap.capturedAt)}`
    }
    const bFoll = bA.reduce((s, a) => s + a.followersCount, 0)
    const vFoll = vA.reduce((s, a) => s + a.followersCount, 0)
    const follDiff = vFoll - bFoll
    if (Math.abs(follDiff) >= 500) {
      return `Seguidores ${follDiff > 0 ? 'cresceram' : 'caíram'} ${fmtNum(Math.abs(follDiff))} desde ${fmtDate(baselineSnap.capturedAt)}`
    }
    return null
  }, [isComparing, viewSnap, baselineSnap, filteredAccounts])

  const currentMetric = EVOLUTION_METRICS.find(m => m.id === evolutionMetric)!

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Impacto do Radar</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Capturas manuais e automáticas — compare contas entre si ou ao longo do tempo
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {snapshots.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setExportOpen(v => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors',
                    exportOpen
                      ? 'border-primary/60 text-foreground bg-accent/30'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/50',
                  )}
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs">Export</span>
                </button>
                {exportOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setExportOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-30 flex flex-col bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[175px]">
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Comparativo atual</p>
                      <button onClick={() => { handleExportComparativoCsv();  setExportOpen(false) }} className="px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors">↓ CSV</button>
                      <button onClick={() => { handleExportComparativoXlsx(); setExportOpen(false) }} className="px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors border-b border-border/40">↓ Excel (.xlsx)</button>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Histórico completo</p>
                      <button onClick={() => { handleExportHistoricoCsv();    setExportOpen(false) }} className="px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors">↓ CSV</button>
                      <button onClick={() => { handleExportHistoricoXlsx();   setExportOpen(false) }} className="px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors">↓ Excel (.xlsx)</button>
                    </div>
                  </>
                )}
              </div>
            )}
            {snapshots.length >= 3 && (
              <button
                onClick={togglePeriodMode}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors',
                  periodMode
                    ? 'bg-purple-500/10 border-purple-500/50 text-purple-500'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/50',
                )}
              >
                <GitCompare className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Comparar períodos</span>
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Camera className="w-4 h-4" />
              Nova captura
            </button>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={e => { if (e.target === e.currentTarget && !capturing) { setShowModal(false); setCaptureNote('') } }}
          >
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
              <h2 className="text-base font-bold mb-1">Nova captura</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Registra o estado atual das {accounts.length} contas. Pode demorar até 30s.
              </p>
              <textarea
                className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                rows={3}
                placeholder="Nota (ex.: Início, Semana 3, Pós-campanha...)"
                value={captureNote}
                onChange={e => setCaptureNote(e.target.value)}
                disabled={capturing}
                autoFocus
              />
              <div className="flex gap-2 mt-3 justify-end">
                <button
                  onClick={() => { if (!capturing) { setShowModal(false); setCaptureNote('') } }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                  disabled={capturing}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCapture}
                  disabled={capturing}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2"
                >
                  {capturing
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Capturando...</>
                    : <><Camera className="w-3.5 h-3.5" />Capturar</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && snapshots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <Camera className="w-14 h-14 text-muted-foreground/20" />
            <h2 className="text-base font-semibold">Nenhuma captura ainda</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Clique em "Nova captura" para registrar o estado atual. Essa primeira captura
              vira o <strong>baseline</strong> — a referência de todas as comparações futuras.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold"
            >
              Fazer primeira captura
            </button>
          </div>
        )}

        {/* ══ Conteúdo principal ════════════════════════════════════ */}
        {!loading && snapshots.length > 0 && viewSnap && (
          <>
            {/* Seletor de contas */}
            <div className="bg-card border border-border/60 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2.5">Contas</p>
              <AccountPills accounts={accounts} selected={selectedAccounts} onChange={setSelectedAccounts} />
            </div>

            {/* Controles de snapshot + período */}
            <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3">
              {/* Selects */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1.5">
                    Visualizando
                  </p>
                  <select
                    value={viewId ?? ''}
                    onChange={e => setViewId(e.target.value)}
                    className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {snapshots.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.type === 'auto' ? '🤖 ' : '✋ '}{fmtDate(s.capturedAt)} — {s.note || 'Sem nota'}
                        {s.id === snapshots[0]?.id ? ' (mais recente)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Flag className="w-2.5 h-2.5" />Baseline
                  </p>
                  <select
                    value={baselineId ?? ''}
                    onChange={e => saveBaseline(e.target.value)}
                    className="w-full bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    {snapshots.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.type === 'auto' ? '🤖 ' : '✋ '}{fmtDate(s.capturedAt)} — {s.note || 'Sem nota'}
                        {s.id === snapshots[snapshots.length - 1]?.id ? ' (mais antigo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Presets de período */}
              {snapshots.length >= 2 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mr-1">
                    Comparar:
                  </p>
                  {PERIOD_PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => applyPeriodPreset(p.days)}
                      className={cn(
                        'text-xs px-3 py-1 rounded-full border font-medium transition-all',
                        activePeriodPreset === p.id
                          ? 'bg-amber-500/15 border-amber-500/60 text-amber-500'
                          : 'border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-500',
                      )}
                    >
                      <CalendarDays className="w-3 h-3 inline mr-1 -mt-0.5" />
                      {p.label}
                    </button>
                  ))}
                  {isComparing && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Δ {fmtDate(baselineSnap?.capturedAt)} → {fmtDate(viewSnap.capturedAt)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── Comparação de períodos ─────────────────────────── */}
            {periodMode && snapshots.length >= 3 && (
              <div className="bg-card border border-purple-500/30 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-purple-500" />
                  <p className="text-sm font-semibold text-purple-400">Comparação de períodos</p>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Compara o crescimento de dois intervalos de tempo diferentes
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Período A */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-widest">Período A</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Início</p>
                        <select value={periodAStartId ?? ''} onChange={e => setPeriodAStartId(e.target.value)}
                          className="w-full bg-background border border-blue-500/30 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                          {snapshots.map(s => <option key={s.id} value={s.id}>{fmtDate(s.capturedAt)} — {s.note?.slice(0,20) || 'Sem nota'}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Fim</p>
                        <select value={periodAEndId ?? ''} onChange={e => setPeriodAEndId(e.target.value)}
                          className="w-full bg-background border border-blue-500/30 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                          {snapshots.map(s => <option key={s.id} value={s.id}>{fmtDate(s.capturedAt)} — {s.note?.slice(0,20) || 'Sem nota'}</option>)}
                        </select>
                      </div>
                    </div>
                    {periodAStart && periodAEnd && (
                      <p className="text-[10px] text-muted-foreground">
                        {Math.abs(Math.round((periodAEnd.capturedAt.toMillis() - periodAStart.capturedAt.toMillis()) / (1000*60*60*24)))} dias
                        · {fmtDate(periodAStart.capturedAt)} → {fmtDate(periodAEnd.capturedAt)}
                      </p>
                    )}
                  </div>

                  {/* Período B */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-purple-400/80 uppercase tracking-widest">Período B</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Início</p>
                        <select value={periodBStartId ?? ''} onChange={e => setPeriodBStartId(e.target.value)}
                          className="w-full bg-background border border-purple-500/30 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30">
                          {snapshots.map(s => <option key={s.id} value={s.id}>{fmtDate(s.capturedAt)} — {s.note?.slice(0,20) || 'Sem nota'}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Fim</p>
                        <select value={periodBEndId ?? ''} onChange={e => setPeriodBEndId(e.target.value)}
                          className="w-full bg-background border border-purple-500/30 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30">
                          {snapshots.map(s => <option key={s.id} value={s.id}>{fmtDate(s.capturedAt)} — {s.note?.slice(0,20) || 'Sem nota'}</option>)}
                        </select>
                      </div>
                    </div>
                    {periodBStart && periodBEnd && (
                      <p className="text-[10px] text-muted-foreground">
                        {Math.abs(Math.round((periodBEnd.capturedAt.toMillis() - periodBStart.capturedAt.toMillis()) / (1000*60*60*24)))} dias
                        · {fmtDate(periodBStart.capturedAt)} → {fmtDate(periodBEnd.capturedAt)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Resultado da comparação */}
                {deltaA && deltaB && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Crescimento por período</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border/30">
                            <th className="text-left py-1.5 pr-4 font-medium">Métrica</th>
                            <th className="text-right py-1.5 px-3 font-medium text-blue-400">Período A Δ</th>
                            <th className="text-right py-1.5 px-3 font-medium text-purple-400">Período B Δ</th>
                            <th className="text-right py-1.5 pl-3 font-medium text-muted-foreground">B melhor que A?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {([
                            { l: 'Seguidores',        a: deltaA.followers,        b: deltaB.followers,        fmt: fmtNum },
                            { l: 'Taxa viral',        a: deltaA.avgViralRate,     b: deltaB.avgViralRate,     fmt: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}pp` },
                            { l: 'Posts virais',      a: deltaA.viralPosts,       b: deltaB.viralPosts,       fmt: fmtNum },
                            { l: 'Oportunidades',     a: deltaA.opportunities,    b: deltaB.opportunities,    fmt: fmtNum },
                            { l: 'Engajamento 30d',   a: deltaA.engagementRate,   b: deltaB.engagementRate,   fmt: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}pp` },
                            { l: 'Consistência',      a: deltaA.consistencyScore, b: deltaB.consistencyScore, fmt: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}pp` },
                          ] as { l: string; a: number; b: number; fmt: (v: number) => string }[]).map(row => {
                            const bBetter = row.b > row.a
                            const equal = Math.abs(row.b - row.a) < 0.01
                            return (
                              <tr key={row.l} className="border-b border-border/20">
                                <td className="py-2 pr-4 font-medium">{row.l}</td>
                                <td className={cn('text-right px-3 tabular-nums', row.a > 0 ? 'text-blue-400' : row.a < 0 ? 'text-red-400' : 'text-muted-foreground')}>
                                  {row.a > 0 ? '+' : ''}{row.fmt(row.a)}
                                </td>
                                <td className={cn('text-right px-3 tabular-nums', row.b > 0 ? 'text-purple-400' : row.b < 0 ? 'text-red-400' : 'text-muted-foreground')}>
                                  {row.b > 0 ? '+' : ''}{row.fmt(row.b)}
                                </td>
                                <td className="text-right pl-3">
                                  {equal ? <span className="text-muted-foreground/50">—</span>
                                    : bBetter
                                      ? <span className="text-emerald-500 font-bold">B ▲</span>
                                      : <span className="text-amber-500 font-bold">A ▲</span>
                                  }
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(!deltaA || !deltaB) && periodAStartId && periodAEndId && periodBStartId && periodBEndId && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Selecione snapshots válidos para ver a comparação
                  </p>
                )}
              </div>
            )}

            {/* Headline */}
            {headline && (
              <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium">{headline}</p>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Users,    label: 'Seguidores',       color: '#38B6FF', v: totals.followers,    bv: baseTotals.followers    },
                { icon: Flame,    label: 'Taxa viral média',  color: '#f97316', v: totals.avgViralRate, bv: baseTotals.avgViralRate, pct: true },
                { icon: BarChart2, label: 'Posts virais',     color: '#84cc16', v: totals.viralPosts,   bv: baseTotals.viralPosts   },
                { icon: Zap,      label: 'Oportunidades',     color: '#a855f7', v: totals.opportunities, bv: baseTotals.opportunities },
              ].map(c => (
                <div key={c.label} className="bg-card border border-border/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <c.icon className="w-3.5 h-3.5" style={{ color: c.color }} />
                    <span className="text-[11px] text-muted-foreground">{c.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{c.pct ? fmtPct(c.v) : fmtNum(c.v)}</p>
                  {isComparing && <AbsDelta current={c.v} base={c.bv} unit={c.pct ? '%' : ''} />}
                </div>
              ))}
            </div>

            {/* Radar — comparativo entre contas (só quando 2–5 contas selecionadas) */}
            {filteredAccounts.length >= 2 && filteredAccounts.length <= 5 && radarData.length > 0 && (
              <div className="bg-card border border-border/60 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Radar — comparativo entre contas (normalizado)
                </p>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                      {filteredAccounts.map(acc => (
                        <Radar key={acc.id} name={acc.displayName} dataKey={acc.displayName}
                          stroke={acc.color} fill={acc.color} fillOpacity={0.15} strokeWidth={2} />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tabela comparativa */}
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Comparativo entre contas
                </p>
                {isComparing && (
                  <span className="text-[10px] text-amber-500 font-semibold">
                    Δ vs {fmtDate(baselineSnap?.capturedAt)}
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
                        <tr key={acc.id} className="border-b border-border/20 hover:bg-accent/10">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                              <span className="font-medium">{acc.displayName}</span>
                            </div>
                          </td>
                          {[
                            { v: a.followersCount, bv: b?.followersCount },
                            { v: a.totalPostsMonitored, bv: b?.totalPostsMonitored },
                            { v: a.viralPostsCount, bv: b?.viralPostsCount },
                          ].map((m, i) => (
                            <td key={i} className="text-right px-3 py-2.5">
                              <span className="font-semibold">{fmtNum(m.v)}</span>
                              {isComparing && m.bv !== undefined && <div><AbsDelta current={m.v} base={m.bv} /></div>}
                            </td>
                          ))}
                          <td className="text-right px-3 py-2.5">
                            <span className="font-semibold" style={{ color: acc.color }}>{fmtPct(a.viralRate)}</span>
                            {isComparing && b && <div><AbsDelta current={a.viralRate} base={b.viralRate} unit="%" /></div>}
                          </td>
                          <td className="text-right px-3 py-2.5">
                            <span className="font-semibold">{fmtPct(a.engagementRate30d)}</span>
                            {isComparing && b && <div><AbsDelta current={a.engagementRate30d} base={b.engagementRate30d} unit="%" /></div>}
                          </td>
                          <td className="text-right px-3 py-2.5">
                            <span className="font-semibold">{a.totalOpportunities}</span>
                            {isComparing && b && <div><AbsDelta current={a.totalOpportunities} base={b.totalOpportunities} /></div>}
                          </td>
                          <td className="text-right px-3 py-2.5">
                            <span className="font-semibold">{a.consistencyScore !== null ? fmtPct(a.consistencyScore) : '—'}</span>
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

            {/* Tabs analytics */}
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
              <div className="flex overflow-x-auto border-b border-border/40">
                {([
                  { id: 'evolucao'    as const, label: 'Evolução',       icon: TrendingUp  },
                  { id: 'velocidade'  as const, label: 'Velocidade',     icon: Zap         },
                  { id: 'pico'        as const, label: 'Horário de pico',icon: Clock       },
                  { id: 'temas'       as const, label: 'Temas',          icon: Target      },
                  { id: 'consistencia' as const, label: 'Consistência',  icon: CheckCircle },
                ]).map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />{tab.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {activeTab === 'evolucao' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        {snapshots.length < 2
                          ? 'Faça mais capturas para visualizar a evolução ao longo do tempo.'
                          : `${currentMetric.label} — ${snapshots.length} capturas + projeção linear.`
                        }
                      </p>
                      <select value={evolutionMetric} onChange={e => setEvolutionMetric(e.target.value)}
                        className="bg-background border border-border/60 rounded-lg px-2 py-1 text-xs focus:outline-none"
                      >
                        {EVOLUTION_METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </div>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={projectionData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} unit={currentMetric.unit} />
                          <Tooltip content={<ChartTip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {filteredAccounts.map(acc => (
                            <Line key={acc.id} type="monotone" dataKey={acc.displayName}
                              stroke={acc.color} strokeWidth={2} dot={{ r: 4, fill: acc.color }} connectNulls={false} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {snapshots.length >= 2 && (
                      <p className="text-[10px] text-muted-foreground/50 text-center">
                        "Proj. +1" e "Proj. +2" são projeções lineares baseadas no histórico
                      </p>
                    )}
                  </div>
                )}

                {activeTab === 'velocidade' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Tempo de vida dos posts virais ao capturar. "&lt;6h" = viralizou muito rápido.</p>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={velocityData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<ChartTip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {filteredAccounts.map(acc => (
                            <Bar key={acc.id} dataKey={acc.displayName} fill={acc.color} stackId="a" />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {activeTab === 'pico' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Horário de publicação dos posts virais — ajuda a decidir o melhor horário.</p>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={peakData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={1} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<ChartTip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {filteredAccounts.map(acc => (
                            <Bar key={acc.id} dataKey={acc.displayName} fill={acc.color} stackId="a" />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-3">
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

                {activeTab === 'temas' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Categorias temáticas mais frequentes nas oportunidades das contas selecionadas.</p>
                    {topicData.length === 0
                      ? <p className="text-sm text-muted-foreground text-center py-6">Nenhum tema ainda</p>
                      : (
                        <div className="space-y-1.5">
                          {topicData.map(([topic, count], i) => (
                            <div key={topic} className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground w-4 text-right tabular-nums">{i + 1}</span>
                              <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden">
                                <div className="h-full bg-primary/70 rounded transition-all duration-500"
                                  style={{ width: `${(count / topicData[0][1]) * 100}%` }} />
                              </div>
                              <span className="text-xs font-medium min-w-[160px] truncate">{topic}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">{count}×</span>
                            </div>
                          ))}
                        </div>
                      )
                    }
                  </div>
                )}

                {activeTab === 'consistencia' && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">% de semanas com pelo menos 1 post viral desde o início do monitoramento.</p>
                    {consistencyData.map(item => {
                      const acc = accounts.find(a => a.id === item.id)
                      const baseAcc = baselineSnap && acc ? baselineSnap.accounts[acc.id] : null
                      return (
                        <div key={item.id} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="font-medium">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isComparing && baseAcc?.consistencyScore != null && (
                                <AbsDelta current={item.score} base={baseAcc.consistencyScore} unit="%" />
                              )}
                              <span className="font-bold">{item.score}%</span>
                            </div>
                          </div>
                          <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${item.score}%`, backgroundColor: item.color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Histórico de capturas */}
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Histórico de capturas ({snapshots.length})
                </p>
              </div>
              <div>
                {snapshots.map(snap => {
                  const isView = snap.id === viewSnap.id
                  const isBase = snap.id === (baselineSnap?.id ?? null)
                  const isLatest = snap.id === snapshots[0]?.id
                  return (
                    <div
                      key={snap.id}
                      onClick={() => setViewId(snap.id)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-border/20 last:border-b-0',
                        isView ? 'bg-accent/30' : 'hover:bg-accent/10',
                      )}
                    >
                      <CheckCircle className={cn('w-4 h-4 flex-shrink-0',
                        isView ? 'text-primary' : 'text-muted-foreground/20')} />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{snap.note || 'Sem nota'}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtDateTime(snap.capturedAt)}</p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Auto / Manual badge */}
                        {snap.type === 'auto'
                          ? <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 border border-sky-500/30">
                              <Bot className="w-2.5 h-2.5" />Auto
                            </span>
                          : <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border/50">
                              <Hand className="w-2.5 h-2.5" />Manual
                            </span>
                        }
                        {isBase && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/40 font-semibold">
                            ⚑ Baseline
                          </span>
                        )}
                        {isLatest && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Última</span>
                        )}
                        {!isBase && (
                          <button
                            onClick={e => { e.stopPropagation(); saveBaseline(snap.id) }}
                            className="text-[10px] px-2 py-0.5 rounded border border-border hover:border-amber-500/60 hover:text-amber-500 text-muted-foreground/50 transition-colors"
                          >
                            <Flag className="w-2.5 h-2.5 inline mr-0.5" />Baseline
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Cards detalhados por conta */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Detalhes por conta</p>
              <div className="space-y-2">
                {filteredAccounts.map(acc => {
                  const a = viewSnap.accounts[acc.id]
                  const b = baselineSnap?.accounts[acc.id]
                  if (!a) return null
                  const open = expandedAccounts.has(acc.id)
                  const totalReach = Object.values(a.reachByFollowType ?? {}).reduce((s, v) => s + v, 0) || a.reach30d
                  const totalViews = Object.values(a.viewsByFollowType ?? {}).reduce((s, v) => s + v, 0) || a.impressions30d
                  const hasEngagement = a.totalShares > 0 || a.totalSaves > 0 || a.totalPlays > 0

                  return (
                    <div key={acc.id} className="bg-card border border-border/60 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedAccounts(prev => {
                          const n = new Set(prev); n.has(acc.id) ? n.delete(acc.id) : n.add(acc.id); return n
                        })}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors text-left"
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                        <span className="font-semibold text-sm flex-1">{acc.displayName}</span>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{fmtNum(a.followersCount)} seg.</span>
                          <span style={{ color: acc.color }} className="font-bold">{fmtPct(a.viralRate)} viral</span>
                          {isComparing && b && <AbsDelta current={a.viralRate} base={b.viralRate} unit="%" />}
                        </div>
                        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                               : <ChevronDown className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />}
                      </button>

                      {open && (
                        <div className="px-4 pb-4 pt-2 border-t border-border/30 space-y-4">
                          {/* Grid de métricas principais */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {([
                              { l: 'Seguidores',       v: a.followersCount,        bv: b?.followersCount        },
                              { l: 'Posts monitados',  v: a.totalPostsMonitored,   bv: b?.totalPostsMonitored   },
                              { l: 'Posts virais',     v: a.viralPostsCount,       bv: b?.viralPostsCount       },
                              { l: 'Taxa viral',       v: a.viralRate,             bv: b?.viralRate,             pct: true },
                              { l: 'Oportunidades',    v: a.totalOpportunities,    bv: b?.totalOpportunities    },
                              { l: 'Engajamento 30d',  v: a.engagementRate30d,     bv: b?.engagementRate30d,     pct: true },
                              { l: 'Alcance 30d',      v: totalReach,              bv: undefined                },
                              { l: 'Consistência',     v: a.consistencyScore ?? 0, bv: b?.consistencyScore ?? undefined, pct: true },
                            ] as { l: string; v: number; bv?: number; pct?: boolean }[]).map(m => (
                              <div key={m.l} className="bg-background/50 rounded-lg p-2">
                                <p className="text-[10px] text-muted-foreground">{m.l}</p>
                                <p className="text-sm font-bold">{m.pct ? fmtPct(m.v) : fmtNum(m.v)}</p>
                                {isComparing && m.bv !== undefined && <AbsDelta current={m.v} base={m.bv} unit={m.pct ? '%' : ''} />}
                              </div>
                            ))}
                          </div>

                          {/* Engajamento total — só mostra campos com valor > 0 */}
                          {(a.totalComments > 0 || a.totalLikes > 0 || hasEngagement) && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Engajamento — todos os posts</p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  { e: '💬', l: 'Comentários', v: a.totalComments, bv: b?.totalComments },
                                  { e: '❤️', l: 'Curtidas',    v: a.totalLikes,    bv: b?.totalLikes    },
                                  ...(a.totalShares > 0 ? [{ e: '🔁', l: 'Shares', v: a.totalShares, bv: b?.totalShares }] : []),
                                  ...(a.totalSaves  > 0 ? [{ e: '🔖', l: 'Salvos', v: a.totalSaves,  bv: b?.totalSaves  }] : []),
                                  ...(a.totalPlays  > 0 ? [{ e: '▶️', l: 'Plays',  v: a.totalPlays,  bv: b?.totalPlays  }] : []),
                                ] as { e: string; l: string; v: number; bv?: number }[]).map(m => (
                                  <div key={m.l} className="bg-background/50 rounded-lg p-2 text-center min-w-[80px]">
                                    <p className="text-[10px] text-muted-foreground">{m.e} {m.l}</p>
                                    <p className="text-sm font-bold">{fmtNum(m.v)}</p>
                                    {isComparing && m.bv !== undefined && (
                                      <div className="flex justify-center"><AbsDelta current={m.v} base={m.bv} /></div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Instagram 30d */}
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Instagram (30d)</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {([
                                { l: 'Views',          v: totalViews           },
                                { l: 'Alcance único',  v: totalReach           },
                                { l: 'Visitas perfil', v: a.profileViews30d   },
                                { l: 'Cliques link',   v: a.websiteClicks30d  },
                              ]).map(m => (
                                <div key={m.l} className="bg-background/50 rounded-lg p-2">
                                  <p className="text-[10px] text-muted-foreground">{m.l}</p>
                                  <p className="text-sm font-bold">{fmtNum(m.v)}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Velocidade */}
                          {Object.values(a.viralVelocityBuckets ?? {}).some(v => v > 0) && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Velocidade de viralização</p>
                              <div className="flex flex-wrap gap-2">
                                {(['<6h', '6-24h', '1-3d', '3-7d', '7+d']).map(label => {
                                  const count = a.viralVelocityBuckets?.[label] ?? 0
                                  if (!count) return null
                                  const colors: Record<string, string> = {
                                    '<6h': '#22c55e', '6-24h': '#84cc16', '1-3d': '#eab308', '3-7d': '#f97316', '7+d': '#ef4444',
                                  }
                                  return (
                                    <div key={label} className="flex items-center gap-1.5 bg-background/50 rounded-lg px-2 py-1 text-xs">
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[label] }} />
                                      <span className="font-medium">{label}</span>
                                      <span className="text-muted-foreground">{count}p</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Pico */}
                          {a.peakViralHour !== null && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground mb-1">
                                Pico de viralização às {formatHour(a.peakViralHour)}
                              </p>
                              <div className="h-[60px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={Array.from({ length: 24 }, (_, h) => ({
                                    hour: formatHour(h), posts: a.peakViralHourDistribution?.[String(h)] ?? 0,
                                  })).filter(d => d.posts > 0)} barSize={8}>
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
                              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Temas recorrentes</p>
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
