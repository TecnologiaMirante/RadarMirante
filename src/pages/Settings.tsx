import { Settings as SettingsIcon, LogOut, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { auth } from '@/services/firebase'
import { signOut } from 'firebase/auth'
import { useAuth } from '@/hooks/useAuth'
import { CredentialVault } from '@/components/credentials/CredentialVault'
import { AdminPanel } from '@/components/admin/AdminPanel'

export default function Settings() {
  const { user, isAdmin } = useAuth()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <SettingsIcon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground leading-none">Configurações</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* Conta */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Conta</p>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground leading-none">{user?.displayName || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
                  {isAdmin && (
                    <span className="inline-block mt-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 leading-none">
                      Admin
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => void signOut(auth)}
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gerenciar admins — só visível para admins */}
      {isAdmin && <AdminPanel />}

      {/* Cofre de acessos */}
      <CredentialVault isAdmin={isAdmin} />
    </div>
  )
}
