import { useState } from 'react'
import { Eye, EyeOff, Copy, Check, Pencil, Trash2, Users, Globe } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  CREDENTIAL_PLATFORM_LABELS, CREDENTIAL_LOGIN_LABELS,
  type Credential,
} from '@/types/credentials'
import {
  InstagramIcon, FacebookIcon, YouTubeIcon, XTwitterIcon,
  TikTokIcon, GoogleIcon, WordPressIcon, OtherIcon,
} from '@/components/ui/platform-icons'

const PLATFORM_ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  instagram: InstagramIcon, facebook: FacebookIcon, youtube: YouTubeIcon,
  twitter: XTwitterIcon, tiktok: TikTokIcon,
  google: GoogleIcon, wordpress: WordPressIcon, other: OtherIcon,
}

interface Props {
  credential: Credential
  isAdmin: boolean
  onEdit: (c: Credential) => void
  onDelete: (c: Credential) => void
}

export function CredentialCard({ credential, isAdmin, onEdit, onDelete }: Props) {
  const [showPass, setShowPass] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedPass, setCopiedPass] = useState(false)

  async function copyText(text: string, setCopied: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const visibilityLabel = credential.visibleTo === 'all'
    ? 'Toda a equipe'
    : Array.isArray(credential.visibleTo)
      ? `${credential.visibleTo.length} pessoa${credential.visibleTo.length !== 1 ? 's' : ''}`
      : 'Restrito'

  return (
    <Card className="border-border/60 hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: icon + info */}
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center">
              {(() => { const Icon = PLATFORM_ICON_MAP[credential.platform] ?? OtherIcon; return <Icon size={36} /> })()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight truncate">{credential.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground/70">
                  {credential.platform === 'other' && credential.platformCustomName
                    ? credential.platformCustomName
                    : CREDENTIAL_PLATFORM_LABELS[credential.platform]}
                </span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[10px] text-muted-foreground/70">
                  {CREDENTIAL_LOGIN_LABELS[credential.loginType]}
                </span>
                <span className="text-muted-foreground/30">·</span>
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                  {credential.visibleTo === 'all'
                    ? <Globe className="w-2.5 h-2.5" />
                    : <Users className="w-2.5 h-2.5" />
                  }
                  {visibilityLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Admin actions */}
          {isAdmin && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onEdit(credential)}
                title="Editar"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(credential)}
                title="Remover"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Credentials detail */}
        {(credential.username || credential.email || credential.password || credential.notes) && (
          <div className="mt-3 space-y-2 pt-3 border-t border-border/50">
            {credential.username && (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Usuário</p>
                  <p className="text-xs text-foreground truncate font-mono">{credential.username}</p>
                </div>
                <button
                  onClick={() => copyText(credential.username!, setCopiedEmail)}
                  title="Copiar"
                  className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
            {credential.email && (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Login</p>
                  <p className="text-xs text-foreground truncate font-mono">{credential.email}</p>
                </div>
                <button
                  onClick={() => copyText(credential.email!, setCopiedEmail)}
                  title="Copiar"
                  className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {credential.password && (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Senha</p>
                  <p className="text-xs text-foreground truncate font-mono">
                    {showPass ? credential.password : '••••••••••••'}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setShowPass(v => !v)}
                    title={showPass ? 'Ocultar' : 'Revelar'}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {showPass && (
                    <button
                      onClick={() => copyText(credential.password!, setCopiedPass)}
                      title="Copiar"
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                    >
                      {copiedPass ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            )}

            {credential.notes && (
              <div>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-semibold">Notas</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{credential.notes}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
