import { useState, useEffect, useMemo } from 'react'
import { Eye, EyeOff, User, Search, RefreshCw } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  InstagramIcon, FacebookIcon, YouTubeIcon, XTwitterIcon,
  TikTokIcon, GoogleIcon, WordPressIcon, OtherIcon,
} from '@/components/ui/platform-icons'
import { createCredential, updateCredential } from '@/services/credentials'
import { useTeamMembers } from '@/hooks/useTeamMembers'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import {
  CREDENTIAL_LOGIN_LABELS,
  type Credential, type CredentialPlatform, type CredentialLoginType,
} from '@/types/credentials'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editing?: Credential | null
}

const PLATFORM_OPTIONS: { value: CredentialPlatform; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { value: 'instagram',  label: 'Instagram',  Icon: InstagramIcon },
  { value: 'facebook',   label: 'Facebook',   Icon: FacebookIcon },
  { value: 'youtube',    label: 'YouTube',    Icon: YouTubeIcon },
  { value: 'twitter',    label: 'X / Twitter', Icon: XTwitterIcon },
  { value: 'tiktok',     label: 'TikTok',     Icon: TikTokIcon },
  { value: 'google',     label: 'Google',     Icon: GoogleIcon },
  { value: 'wordpress',  label: 'WordPress',  Icon: WordPressIcon },
  { value: 'other',      label: 'Outro',      Icon: OtherIcon },
]

const LOGIN_TYPES = Object.entries(CREDENTIAL_LOGIN_LABELS) as [CredentialLoginType, string][]

export function CredentialForm({ open, onClose, onSaved, editing }: Props) {
  const { user } = useAuth()
  const currentUid = user?.uid ?? ''
  const { members, loading: loadingMembers, retry } = useTeamMembers()

  const [name, setName]                         = useState('')
  const [platform, setPlatform]                 = useState<CredentialPlatform>('instagram')
  const [platformCustomName, setPlatformCustomName] = useState('')
  const [loginType, setLoginType]               = useState<CredentialLoginType>('email_password')
  const [username, setUsername]                 = useState('')
  const [email, setEmail]                       = useState('')
  const [password, setPassword]                 = useState('')
  const [notes, setNotes]                       = useState('')
  const [visibleToAll, setVisibleToAll]         = useState(true)
  const [selectedUids, setSelectedUids]         = useState<Set<string>>(new Set())
  const [memberSearch, setMemberSearch]         = useState('')
  const [showPass, setShowPass]                 = useState(false)
  const [saving, setSaving]                     = useState(false)
  const [error, setError]                       = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setPlatform(editing.platform)
      setPlatformCustomName(editing.platformCustomName ?? '')
      setLoginType(editing.loginType)
      setUsername(editing.username ?? '')
      setEmail(editing.email ?? '')
      setPassword(editing.password ?? '')
      setNotes(editing.notes ?? '')
      const isAll = editing.visibleTo === 'all'
      setVisibleToAll(isAll)
      if (isAll) {
        setSelectedUids(new Set(currentUid ? [currentUid] : []))
      } else {
        const uids = new Set(editing.visibleTo as string[])
        if (currentUid) uids.add(currentUid)
        setSelectedUids(uids)
      }
    } else {
      setName(''); setPlatform('instagram'); setPlatformCustomName('')
      setLoginType('email_password')
      setUsername(''); setEmail(''); setPassword(''); setNotes('')
      setVisibleToAll(true)
      setSelectedUids(new Set(currentUid ? [currentUid] : []))
    }
    setMemberSearch(''); setError(''); setShowPass(false)
  }, [open, editing, currentUid])

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members
    const q = memberSearch.toLowerCase()
    return members.filter(m =>
      m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    )
  }, [members, memberSearch])

  function toggleUid(uid: string) {
    if (uid === currentUid) return // não pode se desmarcar
    setSelectedUids(prev => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })
  }

  async function handleSave() {
    if (!name.trim()) { setError('Nome é obrigatório.'); return }
    if (platform === 'other' && !platformCustomName.trim()) {
      setError('Informe o nome da plataforma.'); return
    }
    if (loginType !== 'other' && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('E-mail inválido.'); return
    }
    if (!visibleToAll && selectedUids.size === 0) {
      setError('Selecione pelo menos uma pessoa.'); return
    }
    setError('')

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        platform,
        platformCustomName: platform === 'other' ? platformCustomName.trim() : undefined,
        loginType,
        username: username.trim() || undefined,
        email: email.trim() || undefined,
        password: password || undefined,
        notes: notes.trim() || undefined,
        visibleTo: (visibleToAll ? 'all' : [...selectedUids]) as 'all' | string[],
      }
      if (editing) {
        await updateCredential(editing.id, payload)
      } else {
        await createCredential(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col p-0 gap-0">

        <DialogHeader className="px-6 pt-5 pb-4 flex-shrink-0">
          <DialogTitle>{editing ? 'Editar acesso' : 'Novo acesso'}</DialogTitle>
          <p className="text-xs text-muted-foreground">Preencha as informações de acesso da conta.</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-4">

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="cred-name">Nome do acesso *</Label>
            <Input id="cred-name" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Instagram @imirante" autoFocus />
          </div>

          {/* Plataforma */}
          <div className="space-y-2">
            <Label>Plataforma *</Label>
            <div className="grid grid-cols-5 gap-2">
              {PLATFORM_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPlatform(value)}
                  title={label}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 text-center transition-all duration-150 group',
                    platform === value
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent bg-muted/60 hover:bg-muted hover:border-border',
                  )}
                >
                  <Icon size={28} />
                  <span className={cn(
                    'text-[9px] font-semibold leading-tight truncate w-full',
                    platform === value ? 'text-primary' : 'text-muted-foreground',
                  )}>
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {/* Campo nome customizado para "Outro" */}
            {platform === 'other' && (
              <Input
                value={platformCustomName}
                onChange={e => setPlatformCustomName(e.target.value)}
                placeholder="Nome da plataforma (ex: Kwai, Pinterest…)"
                className="mt-2"
              />
            )}
          </div>

          {/* Tipo de acesso */}
          <div className="space-y-2">
            <Label>Tipo de acesso *</Label>
            <div className="grid grid-cols-3 gap-2">
              {LOGIN_TYPES.map(([v, l]) => (
                <button key={v} type="button" onClick={() => setLoginType(v)}
                  className={cn(
                    'py-2.5 rounded-lg border text-xs font-medium transition-all duration-150',
                    loginType === v
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'border-border text-muted-foreground hover:bg-accent hover:border-border',
                  )}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Credenciais */}
          <div className="space-y-4">
            <p className="text-xs font-bold text-foreground/80 uppercase tracking-wider">Credenciais</p>

            <div className="space-y-1.5">
              <Label htmlFor="cred-username">
                Usuário
                {loginType === 'email_password' && (
                  <span className="ml-1.5 normal-case font-normal text-muted-foreground/60 tracking-normal">(opcional)</span>
                )}
              </Label>
              <Input id="cred-username" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="@usuario ou nome de usuário" />
            </div>

            {loginType !== 'other' && (
              <div className="space-y-1.5">
                <Label htmlFor="cred-email">E-mail</Label>
                <Input id="cred-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="email@exemplo.com" />
              </div>
            )}

            {loginType === 'email_password' && (
              <div className="space-y-1.5">
                <Label htmlFor="cred-pass">Senha</Label>
                <div className="relative">
                  <Input id="cred-pass" type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pr-9 font-mono" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cred-notes">Notas</Label>
              <textarea id="cred-notes" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="2FA, observações, link de recuperação, etc." rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
            </div>
          </div>

          <Separator />

          {/* Visibilidade */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-foreground/80 uppercase tracking-wider">Visibilidade</p>

            <div className="grid grid-cols-2 gap-2">
              {[
                { value: true,  label: '🌐  Toda a equipe' },
                { value: false, label: '👥  Específicos' },
              ].map(({ value, label }) => (
                <button key={String(value)} type="button" onClick={() => setVisibleToAll(value)}
                  className={cn(
                    'py-2.5 rounded-lg border text-xs font-medium transition-all duration-150',
                    visibleToAll === value
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'border-border text-muted-foreground hover:bg-accent',
                  )}>
                  {label}
                </button>
              ))}
            </div>

            {!visibleToAll && (
              <div className="rounded-xl border border-border overflow-hidden bg-background">
                {/* Search */}
                <div className="px-3 py-2 border-b border-border bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                    <input
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Buscar por nome ou email…"
                      className="w-full bg-transparent pl-8 pr-3 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none"
                    />
                  </div>
                </div>

                {/* List */}
                <div className="max-h-52 overflow-y-auto divide-y divide-border/60">
                  {loadingMembers ? (
                    <div className="flex items-center justify-center gap-2 p-5 text-xs text-muted-foreground">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Carregando usuários…
                    </div>
                  ) : filteredMembers.length === 0 && memberSearch ? (
                    <div className="p-5 text-center text-xs text-muted-foreground">
                      Nenhum resultado para "{memberSearch}"
                    </div>
                  ) : members.length === 0 ? (
                    <div className="p-5 text-center space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Usuários não carregados.
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        Faça o deploy das regras do Firestore para habilitar este recurso.
                      </p>
                      {retry && (
                        <button onClick={retry}
                          className="inline-flex items-center gap-1.5 text-[10px] text-primary hover:underline mt-1">
                          <RefreshCw className="w-3 h-3" /> Tentar novamente
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredMembers.map(m => {
                      const checked = selectedUids.has(m.uid)
                      const isLocked = m.uid === currentUid
                      const initials = m.displayName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
                      return (
                        <label key={m.uid}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 transition-colors',
                            isLocked ? 'cursor-default' : 'cursor-pointer',
                            checked ? 'bg-primary/5' : (!isLocked ? 'hover:bg-muted/60' : ''),
                          )}>
                          <Checkbox
                            checked={checked}
                            disabled={isLocked}
                            onCheckedChange={() => toggleUid(m.uid)}
                          />
                          <Avatar className="w-7 h-7 flex-shrink-0">
                            <AvatarImage src={m.photoURL} alt={m.displayName} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {initials || <User className="w-3 h-3" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-medium text-foreground leading-tight truncate">{m.displayName}</p>
                              {isLocked && (
                                <span className="text-[9px] font-semibold text-muted-foreground/50 bg-muted rounded px-1 py-0.5 leading-none flex-shrink-0">
                                  você
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
                          </div>
                          {checked && !isLocked && (
                            <span className="flex-shrink-0 text-[9px] font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5">
                              Selecionado
                            </span>
                          )}
                        </label>
                      )
                    })
                  )}
                </div>

                {/* Footer counter */}
                {!loadingMembers && selectedUids.size > 0 && (
                  <div className="px-3 py-2 border-t border-border/60 bg-primary/5">
                    <p className="text-[10px] font-semibold text-primary">
                      {selectedUids.size} {selectedUids.size === 1 ? 'pessoa selecionada' : 'pessoas selecionadas'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="min-w-24">
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Adicionar acesso'}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  )
}
