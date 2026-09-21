import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, ArrowUpRight, TrendingUp, MessageCircle,
  Clock, RefreshCw, Filter, Calendar, ChevronDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getOpportunities } from '@/services/radar'
import type { Opportunity, OpportunityStatus, TimeFilter } from '@/types/radar'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'

// ─── Config ───────────────────────────────────────────────────────────────────

const TIME_FILTERS: { value: TimeFilter; label: string; group: string }[] = [
  { value: 'now', label: 'Última hora',    group: 'Recente' },
  { value: '3h',  label: 'Últimas 3h',     group: 'Recente' },
  { value: '6h',  label: 'Últimas 6h',     group: 'Recente' },
  { value: '24h', label: 'Últimas 24h',    group: 'Hoje' },
  { value: '2d',  label: 'Últimos 2 dias', group: 'Período' },
  { value: '3d',  label: 'Últimos 3 dias', group: 'Período' },
  { value: '7d',  label: 'Últimos 7 dias', group: 'Período' },
  { value: '15d', label: '15 dias',        group: 'Período' },
  { value: '30d', label: '30 dias',        group: 'Período' },
  { value: 'all', label: 'Desde 15/09',    group: 'Histórico' },
]

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

const STATUS_CONFIG: Record<OpportunityStatus, { label: string; color: string }> = {
  new:         { label: 'Nova',        color: 'bg-primary/10 text-primary border-primary/20' },
  reviewing:   { label: 'Em análise',  color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  investigated:{ label: 'Investigada', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  published:   { label: 'Publicada',   color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  dismissed:   { label: 'Descartada',  color: 'bg-secondary text-muted-foreground border-border' },
}

const POTENTIAL_COLOR = (n: number) =>
  n >= 75 ? 'text-green-400' : n >= 50 ? 'text-primary' : 'text-yellow-400'

const STATUS_FILTERS: { value: OpportunityStatus | 'all'; label: string }[] = [
  { value: 'all',          label: 'Todas' },
  { value: 'new',          label: 'Novas' },
  { value: 'reviewing',    label: 'Em análise' },
  { value: 'investigated', label: 'Investigadas' },
  { value: 'published',    label: 'Publicadas' },
  { value: 'dismissed',    label: 'Descartadas' },
]

// ─── DateDropdown ─────────────────────────────────────────────────────────────

function DateDropdown({ value, onChange }: { value: TimeFilter; onChange: (v: TimeFilter) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = TIME_FILTERS.find(f => f.value === value) ?? TIME_FILTERS[3]

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const groups = Array.from(new Set(TIME_FILTERS.map(f => f.group)))

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-all',
          open
            ? 'bg-primary/10 border-primary/40 text-primary'
            : 'bg-card border-border text-muted-foreground hover:border-border/80 hover:text-foreground',
        )}
      >
        <Calendar className="w-3 h-3 opacity-70" />
        <span>{current.label}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden py-1.5">
          {groups.map(group => (
            <div key={group}>
              <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest px-3 pt-2 pb-1">
                {group}
              </p>
              {TIME_FILTERS.filter(f => f.group === group).map(f => (
                <button
                  key={f.value}
                  onClick={() => { onChange(f.value); setOpen(false) }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors',
                    f.value === value
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span>{f.label}</span>
                  {f.value === value && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── OpportunityCard ──────────────────────────────────────────────────────────

function OpportunityCard({ opp }: { opp: Opportunity }) {
  const createdAgo = formatDistanceToNow((opp.createdAt as unknown as Timestamp).toDate(), { addSuffix: true, locale: ptBR })
  const status = STATUS_CONFIG[opp.status]
  const highIdeas = opp.storyIdeas?.filter(i => i.priority === 'high').length ?? 0
  const totalIdeas = opp.storyIdeas?.length ?? 0

  return (
    <Link to={`/radar/${opp.id}`}>
      <Card className="border-border/60 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', status.color)}>
                  {status.label}
                </span>
                {opp.platform && (
                  <span className="text-[10px] text-muted-foreground/60 capitalize">{opp.platform}</span>
                )}
              </div>
              <p className="font-bold text-foreground leading-snug text-sm group-hover:text-primary transition-colors">
                {opp.mainTopic}
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 transition-colors mt-1" />
          </div>

          {opp.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{opp.summary}</p>
          )}

          <div className="flex items-center gap-4 pt-1">
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="w-3 h-3 text-muted-foreground/60" />
              <span className="font-bold text-foreground">{opp.trendScore}</span>
              <span className="text-muted-foreground/60">score</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Sparkles className="w-3 h-3 text-muted-foreground/60" />
              <span className={cn('font-bold', POTENTIAL_COLOR(opp.editorialPotential))}>
                {opp.editorialPotential}
              </span>
              <span className="text-muted-foreground/60">potencial</span>
            </div>
            {totalIdeas > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <MessageCircle className="w-3 h-3 text-muted-foreground/60" />
                <span className="font-bold text-foreground">{totalIdeas}</span>
                <span className="text-muted-foreground/60">pautas</span>
                {highIdeas > 0 && (
                  <span className="text-[9px] bg-orange-500/15 text-orange-400 px-1 rounded font-bold">
                    {highIdeas} urgente{highIdeas > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40 ml-auto">
              <Clock className="w-2.5 h-2.5" />{createdAgo}
            </span>
          </div>

          {/* Editorial potential bar */}
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all',
                opp.editorialPotential >= 75 ? 'bg-green-400' :
                opp.editorialPotential >= 50 ? 'bg-primary' : 'bg-yellow-400'
              )}
              style={{ width: `${opp.editorialPotential}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AnalysesPage() {
  const [allOpps, setAllOpps] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | 'all'>('all')
  const [displayTime, setDisplayTime] = useState<TimeFilter>('2d')

  async function load() {
    setLoading(true)
    try {
      const data = await getOpportunities({ platform: 'all', time: 'all', sort: 'recent' })
      setAllOpps(data)
    } catch (err) {
      console.error('[Analyses]', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const opps = useMemo(() => {
    const cutoff = TIME_MS[displayTime]
    if (cutoff === null) return allOpps
    const since = Date.now() - cutoff
    return allOpps.filter(o => {
      const ts = o.createdAt as unknown as Timestamp
      return ts.toMillis() >= since
    })
  }, [allOpps, displayTime])

  const filtered = useMemo(() =>
    statusFilter === 'all' ? opps : opps.filter(o => o.status === statusFilter),
    [opps, statusFilter]
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: opps.length }
    for (const s of Object.keys(STATUS_CONFIG)) {
      c[s] = opps.filter(o => o.status === s).length
    }
    return c
  }, [opps])

  const timeLabel = TIME_FILTERS.find(f => f.value === displayTime)?.label ?? displayTime

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground leading-none">Análises</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading
                ? 'Carregando…'
                : `${opps.length} de ${allOpps.length} análise${allOpps.length !== 1 ? 's' : ''} · ${timeLabel.toLowerCase()}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DateDropdown value={displayTime} onChange={setDisplayTime} />
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5 h-8 text-xs">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
              statusFilter === value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
            )}
          >
            {label}
            {counts[value] > 0 && (
              <span className="ml-1 opacity-60">({counts[value]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-card border border-border/60 rounded-xl animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <div className="space-y-1.5">
            <p className="font-bold text-foreground">Nenhuma análise</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {statusFilter === 'all'
                ? 'Nenhuma análise gerada ainda. Acesse o Radar e clique em "Analisar" em um post em tendência.'
                : 'Nenhuma análise com esse status.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(opp => (
            <OpportunityCard key={opp.id} opp={opp} />
          ))}
        </div>
      )}
    </div>
  )
}
