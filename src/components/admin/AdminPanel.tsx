import { useState, useCallback } from 'react'
import { User, RefreshCw, Shield, Crown, Lock, Check, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTeamMembers } from '@/hooks/useTeamMembers'
import { setUserRole, setUserAccounts } from '@/services/users'
import { useAuth } from '@/hooks/useAuth'
import { useAccount } from '@/contexts/AccountContext'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/user'

const ROLE_OPTIONS: { value: UserRole; label: string; icon: React.ReactNode }[] = [
  { value: 'user',  label: 'Usuário',  icon: <User className="w-3 h-3" /> },
  { value: 'admin', label: 'Admin',    icon: <Shield className="w-3 h-3" /> },
]

const ROLE_ACTIVE: Record<UserRole, string> = {
  user:       'bg-secondary text-foreground border-border',
  admin:      'bg-primary text-primary-foreground border-primary',
  superadmin: 'bg-yellow-500/90 text-black border-yellow-500',
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function UserCard({
  member,
  isSelf,
  canEdit,
  availableAccounts,
}: {
  member: ReturnType<typeof useTeamMembers>['members'][number]
  isSelf: boolean
  canEdit: boolean
  availableAccounts: ReturnType<typeof useAccount>['accounts']
}) {
  const [role, setRoleState] = useState<UserRole>(member.role)
  const [accounts, setAccountsState] = useState<string[]>(member.accounts)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const isSuperAdminMember = member.role === 'superadmin'
  const initials = member.displayName
    .split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  function flashSaved() {
    setSaveState('saved')
    if (saveTimer) clearTimeout(saveTimer)
    const t = setTimeout(() => setSaveState('idle'), 2000)
    setSaveTimer(t)
  }

  const autoSave = useCallback(async (newRole: UserRole, newAccounts: string[]) => {
    setSaveState('saving')
    try {
      await setUserRole(member.uid, newRole)
      await setUserAccounts(member.uid, newAccounts)
      flashSaved()
    } catch {
      setSaveState('error')
    }
  }, [member.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRoleChange(r: UserRole) {
    if (r === role) return
    setRoleState(r)
    void autoSave(r, accounts)
  }

  function handleAccountToggle(id: string) {
    const next = accounts.includes(id)
      ? accounts.filter(a => a !== id)
      : [...accounts, id]
    setAccountsState(next)
    void autoSave(role, next)
  }

  const isAdminOrAbove = role === 'admin' || role === 'superadmin'

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 space-y-4 transition-all',
      isSelf ? 'border-primary/20 bg-primary/5' : 'border-border/70',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="w-9 h-9 flex-shrink-0">
            <AvatarImage src={member.photoURL} alt={member.displayName} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials || <User className="w-3.5 h-3.5" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold text-foreground leading-tight truncate">
                {member.displayName}
              </p>
              {isSelf && (
                <span className="text-[9px] font-semibold text-muted-foreground/60 bg-muted rounded px-1.5 py-0.5 leading-none">
                  você
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
          </div>
        </div>

        {/* Save state indicator */}
        <div className="flex-shrink-0 h-5 flex items-center">
          {saveState === 'saving' && (
            <Loader2 className="w-3.5 h-3.5 text-muted-foreground/50 animate-spin" />
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium">
              <Check className="w-3 h-3" /> Salvo
            </span>
          )}
          {saveState === 'error' && (
            <span className="text-[10px] text-destructive font-medium">Erro ao salvar</span>
          )}
        </div>
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Papel</p>
        {isSuperAdminMember ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/10 text-yellow-600 border border-yellow-500/30">
            <Crown className="w-3 h-3" /> Super Admin
          </div>
        ) : canEdit && !isSelf ? (
          <div className="flex rounded-lg border border-border overflow-hidden w-fit">
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleRoleChange(opt.value)}
                disabled={saveState === 'saving'}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all border-r last:border-r-0 border-border disabled:opacity-50',
                  role === opt.value
                    ? ROLE_ACTIVE[opt.value]
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <div className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border',
            ROLE_ACTIVE[role],
          )}>
            {role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
            {role === 'admin' ? 'Admin' : 'Usuário'}
          </div>
        )}
      </div>

      {/* Account access */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
          Acesso às contas
        </p>
        {isAdminOrAbove ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <Lock className="w-3 h-3" />
            <span>Acesso total (admins veem tudo)</span>
          </div>
        ) : canEdit && !isSelf && availableAccounts.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {availableAccounts.map(acc => {
              const active = accounts.includes(acc.id)
              return (
                <button
                  key={acc.id}
                  onClick={() => handleAccountToggle(acc.id)}
                  disabled={saveState === 'saving'}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold border transition-all disabled:opacity-50',
                    active
                      ? 'text-white border-transparent'
                      : 'text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
                  )}
                  style={active ? { backgroundColor: acc.color, borderColor: acc.color } : undefined}
                >
                  {acc.shortName}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {availableAccounts.map(acc => {
              const active = accounts.includes(acc.id)
              return (
                <span
                  key={acc.id}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold border',
                    active ? 'text-white border-transparent opacity-70' : 'text-muted-foreground/40 border-border/40',
                  )}
                  style={active ? { backgroundColor: acc.color } : undefined}
                >
                  {acc.shortName}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminPanel() {
  const { user, role: currentRole } = useAuth()
  const { members, loading, retry } = useTeamMembers()
  const { accounts: availableAccounts } = useAccount()

  const isSuperAdmin = currentRole === 'superadmin'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Gerenciar Usuários e Acessos
        </p>
        <button
          onClick={retry}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {!isSuperAdmin && (
        <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Somente Super Admins podem editar papéis e acessos.
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-card border border-border/60 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          <button onClick={retry}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
            <RefreshCw className="w-3 h-3" /> Tentar novamente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {members.map(m => (
            <UserCard
              key={m.uid}
              member={m}
              isSelf={m.uid === user?.uid}
              canEdit={isSuperAdmin}
              availableAccounts={availableAccounts}
            />
          ))}
        </div>
      )}
    </div>
  )
}
