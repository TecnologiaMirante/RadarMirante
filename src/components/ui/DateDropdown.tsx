import { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimeFilter } from '@/types/radar'

export const TIME_FILTER_PRESETS: {
  value: TimeFilter; label: string; short: string; group: string
}[] = [
  { value: 'now',  label: 'Última hora',    short: '1h',    group: 'Recente' },
  { value: '3h',   label: 'Últimas 3h',     short: '3h',    group: 'Recente' },
  { value: '6h',   label: 'Últimas 6h',     short: '6h',    group: 'Recente' },
  { value: '24h',  label: 'Últimas 24h',    short: '24h',   group: 'Hoje' },
  { value: '2d',   label: 'Últimos 2 dias', short: '2d',    group: 'Período' },
  { value: '3d',   label: 'Últimos 3 dias', short: '3d',    group: 'Período' },
  { value: '7d',   label: 'Últimos 7 dias', short: '7d',    group: 'Período' },
  { value: '15d',  label: '15 dias',        short: '15d',   group: 'Período' },
  { value: '30d',  label: '30 dias',        short: '30d',   group: 'Período' },
  { value: 'all',  label: 'Desde 15/09',    short: '15/09', group: 'Histórico' },
]

export function getPresetLabel(value: TimeFilter, customFrom?: number, customTo?: number): string {
  if (value === 'custom') return customLabel(customFrom, customTo)
  return TIME_FILTER_PRESETS.find(p => p.value === value)?.label ?? value
}

function msToInput(ms?: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function inputToMs(s: string, endOfDay = false): number | undefined {
  if (!s) return undefined
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (endOfDay) dt.setHours(23, 59, 59, 999)
  return dt.getTime()
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function customLabel(from?: number, to?: number): string {
  if (from && to) return `${fmtDate(from)} – ${fmtDate(to)}`
  if (from) return `a partir de ${fmtDate(from)}`
  if (to) return `até ${fmtDate(to)}`
  return 'Personalizado'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateDropdown({
  value,
  customFrom,
  customTo,
  onChange,
  align = 'right',
}: {
  value: TimeFilter
  customFrom?: number
  customTo?: number
  onChange: (time: TimeFilter, customFrom?: number, customTo?: number) => void
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [fromVal, setFromVal] = useState(msToInput(customFrom))
  const [toVal, setToVal] = useState(msToInput(customTo))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setFromVal(msToInput(customFrom)) }, [customFrom])
  useEffect(() => { setToVal(msToInput(customTo)) }, [customTo])

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const buttonLabel = value === 'custom'
    ? customLabel(customFrom, customTo)
    : getPresetLabel(value)

  const groups = Array.from(new Set(TIME_FILTER_PRESETS.map(p => p.group)))

  function applyCustom() {
    const from = inputToMs(fromVal)
    const to = inputToMs(toVal, true)
    if (!from && !to) return
    onChange('custom', from, to)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-all',
          open || value === 'custom'
            ? 'bg-primary/10 border-primary/40 text-primary'
            : 'bg-card border-border text-muted-foreground hover:border-border/80 hover:text-foreground',
        )}
      >
        <Calendar className="w-3 h-3 opacity-70" />
        <span className="max-w-[120px] truncate">{buttonLabel}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className={cn(
          'absolute top-full mt-1.5 w-64 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden py-1.5',
          align === 'right' ? 'right-0' : 'left-0',
        )}>
          {groups.map(group => (
            <div key={group}>
              <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest px-3 pt-2 pb-1">
                {group}
              </p>
              {TIME_FILTER_PRESETS.filter(p => p.group === group).map(p => (
                <button
                  key={p.value}
                  onClick={() => { onChange(p.value); setOpen(false) }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors',
                    p.value === value
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span>{p.label}</span>
                  {p.value === value && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                </button>
              ))}
            </div>
          ))}

          {/* Custom date range */}
          <div className="border-t border-border/40 mt-1.5 px-3 pt-2.5 pb-2.5 space-y-2">
            <p className={cn(
              'text-[9px] font-bold uppercase tracking-widest',
              value === 'custom' ? 'text-primary' : 'text-muted-foreground/50',
            )}>
              Período personalizado {value === 'custom' && '✓'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground/70">De</label>
                <input
                  type="date"
                  value={fromVal}
                  onChange={e => setFromVal(e.target.value)}
                  className="w-full h-7 px-1.5 rounded border border-border bg-card text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] text-muted-foreground/70">Até</label>
                <input
                  type="date"
                  value={toVal}
                  onChange={e => setToVal(e.target.value)}
                  className="w-full h-7 px-1.5 rounded border border-border bg-card text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                />
              </div>
            </div>
            <button
              onClick={applyCustom}
              disabled={!fromVal && !toVal}
              className="w-full h-7 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Aplicar período
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
