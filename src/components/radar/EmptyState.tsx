import { Radio } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
}

export function EmptyState({
  title = 'Nenhuma publicação encontrada',
  description = 'Tente ampliar o filtro de período ou aguarde a próxima coleta (a cada 30 minutos).',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
          <Radio className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="absolute inset-0 rounded-2xl border border-border animate-ping opacity-20" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>
    </div>
  )
}
