import { useState, useEffect, useCallback } from 'react'
import { Mail, Plus, Trash2, Check, Clock, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getInvites, createInvite, deleteInvite } from '@/services/admin'
import { useAccount } from '@/contexts/AccountContext'
import { toast } from 'sonner'
import type { Invite } from '@/types/admin'
import type { UserRole } from '@/types/user'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'
import { cn } from '@/lib/utils'

function fmtAgo(ts?: Timestamp): string {
  if (!ts) return '—'
  try { return formatDistanceToNow(ts.toDate(), { addSuffix: true, locale: ptBR }) } catch { return '—' }
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user',  label: 'Usuário' },
  { value: 'admin', label: 'Admin'   },
]

export function InvitePanel() {
  const { accounts } = useAccount()
  const [invites, setInvites]       = useState<Invite[]>([])
  const [loading, setLoading]       = useState(true)
  const [formOpen, setFormOpen]     = useState(false)
  const [email, setEmail]           = useState('')
  const [role, setRole]             = useState<UserRole>('user')
  const [selAccounts, setSelAcc]    = useState<string[]>(['imirante'])
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setInvites(await getInvites()) }
    catch (err) { console.error('[InvitePanel]', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleCreate() {
    if (!email.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      await createInvite({ email: email.trim(), role, accounts: selAccounts })
      toast.success('Convite enviado', { description: email.trim() })
      setFormOpen(false)
      setEmail('')
      setRole('user')
      setSelAcc(['imirante'])
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar convite'
      setSaveError(msg)
      toast.error('Erro ao criar convite')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteInvite(id)
      toast.success('Convite removido')
      await load()
    } catch (err) {
      console.error('[InvitePanel] delete', err)
      toast.error('Erro ao remover convite.')
    }
    finally { setDeletingId(null) }
  }

  function toggleAccount(id: string) {
    setSelAcc(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
  }

  const pending  = invites.filter(i => i.status === 'pending')
  const accepted = invites.filter(i => i.status === 'accepted')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-muted-foreground/70" />
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Convites</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </button>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setFormOpen(v => !v)}>
            <Plus className="w-3.5 h-3.5" />
            Convidar
          </Button>
        </div>
      </div>

      {/* Form */}
      {formOpen && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground">Novo convite</p>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Papel</label>
              <div className="flex rounded-lg border border-border overflow-hidden w-fit">
                {ROLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setRole(opt.value)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium transition-all border-r last:border-r-0 border-border',
                      role === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Contas</label>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map(acc => {
                  const active = selAccounts.includes(acc.id)
                  return (
                    <button
                      key={acc.id}
                      onClick={() => toggleAccount(acc.id)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                        active ? 'text-white border-transparent' : 'text-muted-foreground border-border hover:border-primary/40',
                      )}
                      style={active ? { backgroundColor: acc.color } : undefined}
                    >
                      {acc.shortName}
                    </button>
                  )
                })}
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{saveError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => { setFormOpen(false); setSaveError(null) }}>
                Cancelar
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => void handleCreate()} disabled={saving || !email.trim()}>
                {saving ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Enviando…</> : <><Send className="w-3.5 h-3.5" />Convidar</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-12 bg-card border border-border/60 rounded-xl animate-pulse" />)}
        </div>
      ) : invites.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground/50">Nenhum convite enviado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">Pendentes ({pending.length})</p>
              {pending.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{inv.email}</p>
                      <p className="text-[10px] text-muted-foreground/60">{inv.role} · {fmtAgo(inv.createdAt)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => void handleDelete(inv.id)}
                    disabled={deletingId === inv.id}
                    className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {accepted.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">Aceitos ({accepted.length})</p>
              {accepted.map(inv => (
                <div key={inv.id} className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2.5">
                  <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground/70 truncate">{inv.email}</p>
                    <p className="text-[10px] text-muted-foreground/50">Aceito {fmtAgo(inv.acceptedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
