import { type LucideIcon, Radio } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({
  icon: Icon = Radio,
  title = 'Nenhuma publicação encontrada',
  description = 'Tente ampliar o filtro de período ou aguarde a próxima coleta (a cada 30 minutos).',
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
          <Icon className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="absolute inset-0 rounded-2xl border border-border animate-ping opacity-20" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
