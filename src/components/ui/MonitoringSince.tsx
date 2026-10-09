import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  since: string          // 'YYYY-MM-DD'
  className?: string
  variant?: 'inline' | 'badge'
}

function formatDate(iso: string): string {
  const [year, m, d] = iso.split('-')
  return `${d}/${m}/${year}`
}

export function MonitoringSince({ since, className, variant = 'badge' }: Props) {
  const label = `Monitorando desde ${formatDate(since)}`

  if (variant === 'inline') {
    return (
      <span className={cn('flex items-center gap-1 text-[11px] text-muted-foreground/60', className)}>
        <CalendarDays className="w-3 h-3 flex-shrink-0" />
        {label}
      </span>
    )
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium',
      'border border-border/50 bg-muted/40 text-muted-foreground',
      className,
    )}>
      <CalendarDays className="w-3 h-3 flex-shrink-0" />
      {label}
    </span>
  )
}

/** Returns available days since monitoring started (minimum 1). */
export function availableDays(since: string): number {
  const start = new Date(since).getTime()
  return Math.max(1, Math.floor((Date.now() - start) / 86_400_000) + 1)
}
