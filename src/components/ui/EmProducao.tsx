import { Construction } from 'lucide-react'

interface EmProducaoProps {
  titulo?: string
  descricao?: string
}

export function EmProducao({
  titulo = 'Em produção',
  descricao = 'Esta funcionalidade está sendo desenvolvida e estará disponível em breve.',
}: EmProducaoProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
        <Construction className="w-8 h-8 text-yellow-500/70" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-bold text-foreground">{titulo}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{descricao}</p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/60 animate-pulse" />
        Em desenvolvimento
      </div>
    </div>
  )
}
