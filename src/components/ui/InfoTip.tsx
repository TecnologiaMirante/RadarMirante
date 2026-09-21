import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InfoTipProps {
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export function InfoTip({ children, side = 'bottom', className }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const positionClass = {
    bottom: 'top-full mt-1.5 left-1/2 -translate-x-1/2',
    top:    'bottom-full mb-1.5 left-1/2 -translate-x-1/2',
    left:   'right-full mr-1.5 top-1/2 -translate-y-1/2',
    right:  'left-full ml-1.5 top-1/2 -translate-y-1/2',
  }[side]

  return (
    <div ref={ref} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'rounded-full p-0.5 transition-colors',
          open
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="Mais informações"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 w-72 rounded-lg border border-border bg-popover text-popover-foreground',
            'shadow-lg p-3 text-xs leading-relaxed',
            positionClass,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
