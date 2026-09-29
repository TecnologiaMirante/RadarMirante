import { useLocation } from 'react-router-dom'
import {
  LogOut, Sun, Moon, Radio, LayoutDashboard, Sparkles, Instagram, Settings,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/services/auth'
import { useTheme } from '@/hooks/useTheme'
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
import imiranteLogo from '@/assets/imirante_logo.png'
import imiranteEsporteLogo from '@/assets/imiranteesporte_logo.png'
import tvmiranteLogo from '@/assets/tvmirante_logo.png'

const ACCOUNT_LOGOS: Record<string, string | undefined> = {
  imirante: imiranteLogo,
  imiranteesporte: imiranteEsporteLogo,
  tvmirante: tvmiranteLogo,
}

const PAGE_MAP: Record<string, { label: string; icon: React.FC<React.SVGProps<SVGSVGElement>>; desc: string }> = {
  '/radar':     { label: 'Radar',          icon: Radio,           desc: 'Feed de engajamento em tempo real' },
  '/dashboard': { label: 'Dashboard',      icon: LayoutDashboard, desc: 'Visão geral das métricas' },
  '/analises':  { label: 'Análises',       icon: Sparkles,        desc: 'Pautas e insights gerados pela IA' },
  '/instagram': { label: 'Instagram',      icon: Instagram,       desc: 'Métricas de perfil e audiência' },
  '/settings':  { label: 'Configurações',  icon: Settings,        desc: 'Conta e preferências do sistema' },
}

export function Header() {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  const { getAccount, account } = useAccount()
  const location = useLocation()

  const currentConfig = getAccount(account)
  const color = currentConfig?.color ?? '#38B6FF'
  const logo = ACCOUNT_LOGOS[account]

  const page = PAGE_MAP[location.pathname] ?? PAGE_MAP['/radar']
  const PageIcon = page.icon

  const initials = user?.displayName
    ?.split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  async function handleSignOut() {
    await signOut()
  }

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

        {/* Account badge */}
        <div
          className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full mr-2"
          style={{
            backgroundColor: color + '12',
            border: `1px solid ${color}28`,
          }}
        >
          {logo ? (
            <div className="w-4 h-4 rounded-sm bg-white overflow-hidden flex-shrink-0">
              <img src={logo} alt={account} className="w-full h-full object-contain" />
            </div>
          ) : (
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          )}
          <span className="text-[11px] font-medium text-foreground/80 select-none">
            {currentConfig?.displayName ?? account}
          </span>
        </div>

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
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sair da conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
