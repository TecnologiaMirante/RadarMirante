import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InfoTipProps {
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export function InfoTip({ children, side = 'bottom', className }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const TIP_W = 288 // w-72
      let top = 0
      let left = 0
      if (side === 'bottom') {
        top = r.bottom + 6
        left = r.left + r.width / 2 - TIP_W / 2
      } else if (side === 'top') {
        top = r.top - 6
        left = r.left + r.width / 2 - TIP_W / 2
      } else if (side === 'left') {
        top = r.top + r.height / 2
        left = r.left - TIP_W - 6
      } else {
        top = r.top + r.height / 2
        left = r.right + 6
      }
      // clamp to viewport
      left = Math.max(8, Math.min(left, window.innerWidth - TIP_W - 8))
      setCoords({ top, left })
    }
    setOpen(v => !v)
  }

  const transformClass = side === 'top' ? '-translate-y-full' : side === 'left' || side === 'right' ? '-translate-y-1/2' : ''

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          'rounded-full p-0.5 transition-colors',
          open ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="Mais informações"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && createPortal(
        <div
          className={cn(
            'fixed z-[9999] w-72 rounded-lg border border-border bg-popover text-popover-foreground',
            'shadow-lg p-3 text-xs leading-relaxed',
            transformClass,
          )}
          style={{ top: coords.top, left: coords.left }}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  )
}
