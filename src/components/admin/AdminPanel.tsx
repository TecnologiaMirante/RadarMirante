import { useState } from 'react'
import { ShieldCheck, ShieldOff, User, RefreshCw } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTeamMembers } from '@/hooks/useTeamMembers'
import { setUserAdmin } from '@/services/users'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

export function AdminPanel() {
  const { user } = useAuth()
  const { members, loading, retry } = useTeamMembers()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function toggle(uid: string, currentlyAdmin: boolean) {
    setPending(uid)
    setError('')
    try {
      await setUserAdmin(uid, !currentlyAdmin)
      retry()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Gerenciar Admins</p>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground/50">
            <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-xs text-muted-foreground">Nenhum usuário encontrado.</p>
            <button onClick={retry}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <RefreshCw className="w-3 h-3" /> Tentar novamente
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {members.map((m) => {
              const isSelf = m.uid === user?.uid
              const isAdmin = m.isAdmin === true
              const isBusy = pending === m.uid

              const initials = m.displayName
                .split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

              return (
                <div key={m.uid} className="flex items-center gap-3 px-4 py-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={m.photoURL} alt={m.displayName} />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {initials || <User className="w-3 h-3" />}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-foreground leading-tight truncate">
                        {m.displayName}
                      </p>
                      {isSelf && (
                        <span className="text-[9px] font-semibold text-muted-foreground/50 bg-muted rounded px-1 py-0.5 leading-none">
                          você
                        </span>
                      )}
                      {isAdmin && (
                        <span className="text-[9px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 leading-none">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                  </div>

                  <button
                    onClick={() => toggle(m.uid, isAdmin)}
                    disabled={isSelf || isBusy}
                    title={
                      isSelf
                        ? 'Você não pode alterar seu próprio acesso'
                        : isAdmin
                          ? 'Remover admin'
                          : 'Tornar admin'
                    }
                    className={cn(
                      'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border',
                      isSelf || isBusy
                        ? 'opacity-40 cursor-not-allowed border-border text-muted-foreground'
                        : isAdmin
                          ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                          : 'border-primary/30 text-primary hover:bg-primary/10',
                    )}
                  >
                    {isBusy ? (
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    ) : isAdmin ? (
                      <ShieldOff className="w-3 h-3" />
                    ) : (
                      <ShieldCheck className="w-3 h-3" />
                    )}
                    {isBusy ? '…' : isAdmin ? 'Remover' : 'Tornar admin'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
