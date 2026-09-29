import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Radio, Settings, ChevronLeft, ChevronRight,
  LayoutDashboard, Sparkles, Instagram, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAccount } from '@/contexts/AccountContext'
import imiranteLogo from '@/assets/imirante_logo.png'
import imiranteEsporteLogo from '@/assets/imiranteesporte_logo.png'
import tvmiranteLogo from '@/assets/tvmirante_logo.png'

const ACCOUNT_LOGOS: Record<string, string | undefined> = {
  imirante: imiranteLogo,
  imiranteesporte: imiranteEsporteLogo,
  tvmirante: tvmiranteLogo,
}

const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { to: '/radar',     icon: Radio,           label: 'Radar',         desc: 'Feed em tempo real' },
      { to: '/dashboard', icon: LayoutDashboard,  label: 'Dashboard',     desc: 'Estatísticas gerais' },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { to: '/analises',  icon: Sparkles,   label: 'Análises',      desc: 'Pautas geradas pela IA' },
      { to: '/instagram', icon: Instagram,  label: 'Instagram',     desc: 'Métricas do perfil' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/settings', icon: Settings, label: 'Configurações', desc: 'Conta e preferências' },
    ],
  },
]

function getCollapsed(): boolean {
  try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
}

function AccountLogo({ id, size = 8 }: { id: string; size?: number }) {
  const logo = ACCOUNT_LOGOS[id]
  const cls = `w-${size} h-${size}`
  if (logo) {
    return (
      <div className={cn(cls, 'rounded-xl overflow-hidden flex-shrink-0 bg-white')}>
        <img src={logo} alt={id} className="w-full h-full object-contain p-1" />
      </div>
    )
  }
  return null
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(getCollapsed)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const { account, setAccount, accounts, getAccount } = useAccount()
  const hasAccounts = accounts.length > 0
  const currentConfig = getAccount(account)
  const color = hasAccounts ? (currentConfig?.color ?? '#38B6FF') : '#6b7280'

  function toggle() {
    setCollapsed(v => {
      const next = !v
      try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
      if (next) setSwitcherOpen(false)
      return next
    })
  }

  function selectAccount(acc: string) {
    setAccount(acc)
    setSwitcherOpen(false)
  }

  return (
    <aside
      className={cn(
        'flex-shrink-0 flex flex-col bg-card border-r border-border/60 transition-all duration-200 relative overflow-hidden',
        collapsed ? 'w-[60px]' : 'w-[230px]',
      )}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${color}cc, ${color}33, transparent)` }}
      />

      {/* ── Account Switcher ─────────────────────────────────────── */}
      <div className="border-b border-border/50">
        <button
          onClick={() => !collapsed && hasAccounts && setSwitcherOpen(v => !v)}
          disabled={!hasAccounts}
          className={cn(
            'w-full flex items-center transition-colors duration-150 disabled:cursor-default',
            collapsed ? 'h-[60px] justify-center' : 'gap-3 px-3 py-3',
            !collapsed && hasAccounts && 'hover:bg-accent/30',
            !collapsed && switcherOpen && 'bg-accent/20',
          )}
        >
          {/* Logo / Sem acesso */}
          <div className="relative flex-shrink-0">
            {hasAccounts ? (
              <>
                <AccountLogo id={account} size={9} />
                {!ACCOUNT_LOGOS[account] && (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {(currentConfig?.shortName ?? account)[0]?.toUpperCase()}
                  </div>
                )}
              </>
            ) : (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted/60 border border-border/60 flex-shrink-0">
                <Radio className="w-4 h-4 text-muted-foreground/40" />
              </div>
            )}
            {/* Status dot */}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card"
              style={{ backgroundColor: hasAccounts ? color : '#6b728040' }}
            />
          </div>

          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 text-left">
                {hasAccounts ? (
                  <>
                    <p className="text-sm font-semibold text-foreground truncate leading-tight">
                      {currentConfig?.displayName ?? account}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                      @{account}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-muted-foreground/50 truncate leading-tight">
                      Sem acesso
                    </p>
                    <p className="text-[11px] text-muted-foreground/30 truncate leading-tight mt-0.5">
                      nenhuma conta
                    </p>
                  </>
                )}
              </div>
              {hasAccounts && (
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-muted-foreground/50 flex-shrink-0 transition-transform duration-200',
                    switcherOpen && 'rotate-180',
                  )}
                />
              )}
            </>
          )}
        </button>

        {/* Account dropdown */}
        {!collapsed && hasAccounts && (
          <div className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-in-out',
            switcherOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}>
            <div className="overflow-hidden">
              <div className="px-2 py-2 space-y-0.5 border-t border-border/40">
                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-2 pb-1 select-none">
                  Trocar conta
                </p>
                {accounts.map(acc => {
                  const active = acc.id === account
                  return (
                    <button
                      key={acc.id}
                      onClick={() => selectAccount(acc.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-left',
                        active
                          ? 'bg-accent/60 text-foreground'
                          : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
                      )}
                    >
                      {ACCOUNT_LOGOS[acc.id] ? (
                        <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 bg-white">
                          <img src={ACCOUNT_LOGOS[acc.id]} alt={acc.displayName}
                            className="w-full h-full object-contain p-0.5"
                          />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ backgroundColor: acc.color }}>
                          {acc.shortName[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="flex-1 text-xs font-medium truncate">{acc.displayName}</span>
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em] px-2.5 pb-2 select-none">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, desc }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/radar'}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) => cn(
                    'flex items-center rounded-lg transition-all duration-150 group',
                    collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/40',
                  )}
                  style={({ isActive }) => isActive
                    ? { backgroundColor: color + '14', boxShadow: `inset 3px 0 0 ${color}` }
                    : undefined
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className="flex-shrink-0 w-4 h-4 transition-colors"
                        style={isActive ? { color } : undefined}
                      />
                      {!collapsed && (
                        <div className="min-w-0">
                          <p className={cn(
                            'text-sm leading-tight truncate',
                            isActive ? 'font-semibold text-foreground' : 'font-medium',
                          )}>
                            {label}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                            {desc}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="border-t border-border/50 px-2 py-2">
        <div className="flex items-center justify-end">
          <button
            onClick={toggle}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <ChevronLeft className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>
    </aside>
  )
}
