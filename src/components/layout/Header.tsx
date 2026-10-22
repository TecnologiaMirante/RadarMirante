import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  LogOut, Sun, Moon, Radio, LayoutDashboard, Sparkles, Instagram, Settings,
  ChevronDown, Check, Flame,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { LogoutDialog } from './LogoutDialog'
import { useAccount } from '@/contexts/AccountContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import imiranteLogo from '@/assets/imirante_logo.png'
import imiranteEsporteLogo from '@/assets/imiranteesporte_logo.png'
import tvmiranteLogo from '@/assets/tvmirante_logo.png'
import imirantepoliticaLogo from '@/assets/imirantepolitica_logo.png'
import mirantefmLogo from '@/assets/mirantefm96_logo.png'
import geglobomaranhaoLogo from '@/assets/geglobomaranhao_logo.png'
import g1maranhaoLogo from '@/assets/g1maranhao_logo.png'

const ACCOUNT_LOGOS: Record<string, string | undefined> = {
  imirante: imiranteLogo,
  imiranteesporte: imiranteEsporteLogo,
  tvmirante: tvmiranteLogo,
  imirantepolitica: imirantepoliticaLogo,
  mirantefm: mirantefmLogo,
  'ge.globomaranhao': geglobomaranhaoLogo,
  'g1maranhao': g1maranhaoLogo,
}

const PAGE_MAP: Record<string, { label: string; icon: React.FC<React.SVGProps<SVGSVGElement>>; desc: string }> = {
  '/radar':     { label: 'Radar',          icon: Radio,           desc: 'Feed de engajamento em tempo real' },
  '/dashboard': { label: 'Dashboard',       icon: LayoutDashboard, desc: 'Visão geral das métricas' },
  '/analises':  { label: 'Análises',       icon: Sparkles,        desc: 'Pautas e insights gerados pela IA' },
  '/insights':  { label: 'Insights',        icon: Instagram,       desc: 'Métricas de perfil e audiência' },
  '/tendencias': { label: 'Tendências',     icon: Flame,           desc: 'O que está em alta agora' },
  '/settings':  { label: 'Configurações',  icon: Settings,        desc: 'Conta e preferências do sistema' },
}

export function Header() {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  const { getAccount, account, setAccount, accounts } = useAccount()
  const location = useLocation()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const hasAccounts = accounts.length > 0
  const currentConfig = getAccount(account)
  const color = hasAccounts ? (currentConfig?.color ?? '#38B6FF') : '#6b7280'
  const logo = hasAccounts ? ACCOUNT_LOGOS[account] : undefined

  const page = PAGE_MAP[location.pathname] ?? PAGE_MAP['/radar']
  const PageIcon = page.icon

  const initials = user?.displayName
    ?.split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-border/60 bg-card flex-shrink-0">

      {/* ── Left: page context ───────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Page icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color + '18', border: `1px solid ${color}30` }}
        >
          <PageIcon className="w-4 h-4" style={{ color }} />
        </div>

        {/* Title + description */}
        <div>
          <h1 className="text-sm font-bold text-foreground leading-tight">{page.label}</h1>
          <p className="text-[11px] text-muted-foreground leading-tight hidden sm:block">{page.desc}</p>
        </div>
      </div>

      {/* ── Right: actions ───────────────────────────────────────── */}
      <div className="flex items-center gap-1">

        {/* Account switcher — hidden when no accounts */}
        {hasAccounts && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full mr-1 transition-all duration-150',
                  'hover:brightness-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  accounts.length > 1 && 'cursor-pointer',
                )}
                style={{
                  backgroundColor: color + '14',
                  border: `1px solid ${color}30`,
                }}
                disabled={accounts.length <= 1}
              >
                {logo ? (
                  <div className="w-4 h-4 rounded-sm bg-white overflow-hidden flex-shrink-0">
                    <img src={logo} alt={account} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                )}
                <span className="text-[11px] font-medium text-foreground/80 select-none leading-none">
                  {currentConfig?.displayName ?? account}
                </span>
                {accounts.length > 1 && (
                  <ChevronDown className="w-3 h-3 text-foreground/40 flex-shrink-0" />
                )}
              </button>
            </DropdownMenuTrigger>
            {accounts.length > 1 && (
              <DropdownMenuContent align="end" className="w-56 p-1.5">
                <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest pb-1.5 px-2">
                  Trocar conta
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="mb-1" />
                {accounts.map(acc => {
                  const isActive = acc.id === account
                  const accLogo = ACCOUNT_LOGOS[acc.id]
                  return (
                    <DropdownMenuItem
                      key={acc.id}
                      onClick={() => setAccount(acc.id)}
                      className={cn(
                        'flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-all',
                        isActive && 'bg-accent/40',
                      )}
                    >
                      {accLogo ? (
                        <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 bg-white shadow-sm">
                          <img src={accLogo} alt={acc.displayName} className="w-full h-full object-contain p-0.5" />
                        </div>
                      ) : (
                        <div
                          className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                          style={{ backgroundColor: acc.color }}
                        >
                          {acc.shortName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate leading-tight">
                          {acc.displayName}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                          @{acc.id}
                        </p>
                      </div>
                      {isActive && (
                        <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: acc.color }} />
                      )}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4" />
            : <Moon className="w-4 h-4" />
          }
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-accent transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.photoURL ?? undefined} alt={user?.displayName ?? 'User'} />
                <AvatarFallback className="text-[10px] font-bold bg-accent text-foreground">
                  {initials ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-foreground leading-tight max-w-[120px] truncate">
                  {user?.displayName?.split(' ')[0]}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight max-w-[120px] truncate">
                  {user?.email}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="pb-1">
              <p className="text-sm font-semibold">{user?.displayName}</p>
              <p className="text-[11px] text-muted-foreground font-normal mt-0.5">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setLogoutOpen(true)}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sair da conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </header>
  )
}
