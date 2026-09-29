import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/services/auth'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
}

export function LogoutDialog({ open, onClose }: Props) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const initials = user?.displayName
    ?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  async function handleSignOut() {
    setLoading(true)
    const firstName = user?.displayName?.split(' ')[0]
    try {
      await signOut()
      toast.success(firstName ? `Até logo, ${firstName}!` : 'Até logo!', {
        description: 'Você saiu com sucesso.',
      })
    } catch {
      // ERR_BLOCKED_BY_CLIENT é esperado — o Firebase fecha as conexões do Firestore ao sair
    } finally {
      setLoading(false)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !loading) onClose() }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">Sair da conta</DialogTitle>

        {/* Header */}
        <div className="px-6 pt-6 pb-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center flex-shrink-0">
              <LogOut className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Sair da conta</p>
              <p className="text-xs text-muted-foreground">Você precisará fazer login novamente.</p>
            </div>
          </div>

          {/* User card */}
          {user && (
            <div className="flex items-center gap-3 rounded-xl bg-muted/40 border border-border/60 px-3 py-2.5">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={user.photoURL ?? undefined} />
                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                  {initials ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground leading-tight truncate">{user.displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive" size="sm"
            onClick={() => void handleSignOut()}
            disabled={loading}
            className="min-w-20 gap-1.5"
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saindo…</>
              : <><LogOut className="w-3.5 h-3.5" /> Sair</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
