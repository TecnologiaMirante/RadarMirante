import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Radio, Settings, ChevronLeft, ChevronRight,
  LayoutDashboard, Sparkles, Instagram, BarChart2, ChevronDown, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAccount, ACCOUNT_LABELS, ACCOUNT_COLORS, RADAR_ACCOUNTS, type RadarAccount } from '@/contexts/AccountContext'
import imiranteLogo from '@/assets/imirante_logo.png'
import imiranteEsporteLogo from '@/assets/imiranteesporte_logo.png'

const ACCOUNT_LOGOS: Record<RadarAccount, string> = {
  imirante: imiranteLogo,
  imiranteesporte: imiranteEsporteLogo,
}

const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { to: '/radar',     icon: Radio,          label: 'Radar',         desc: 'Feed em tempo real' },
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',     desc: 'Estatísticas gerais' },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { to: '/analises',  icon: Sparkles,        label: 'Análises',      desc: 'Pautas geradas pela IA' },
      { to: '/instagram', icon: Instagram,        label: 'Instagram',     desc: 'Métricas do perfil' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/settings',  icon: Settings,        label: 'Configurações', desc: 'Conta e preferências' },
    ],
  },
]

function getCollapsed(): boolean {
  try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(getCollapsed)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const { account, setAccount } = useAccount()
  const color = ACCOUNT_COLORS[account]

  function toggle() {
    setCollapsed(v => {
      const next = !v
      try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
      if (next) setSwitcherOpen(false)
      return next
    })
  }

  function selectAccount(acc: typeof account) {
    setAccount(acc)
    setSwitcherOpen(false)
  }

  return (
    <aside
      className={cn(
        'flex-shrink-0 flex flex-col border-r border-border bg-card transition-all duration-200',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      {/* Header: account switcher collapsible */}
      <div className="border-b border-border">
        <button
          onClick={() => !collapsed && setSwitcherOpen(v => !v)}
          className={cn(
            'w-full flex items-center transition-colors',
            collapsed ? 'h-14 justify-center px-0' : 'gap-3 px-3 py-3 hover:bg-accent/40',
          )}
        >
          <img
            src={ACCOUNT_LOGOS[account]}
            alt={ACCOUNT_LABELS[account]}
            className="w-8 h-8 rounded-xl object-cover flex-shrink-0 shadow-sm ring-2"
            style={{ outline: `2px solid ${color}55`, outlineOffset: '1px' }}
          />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider leading-none mb-0.5">
                  Radar
                </p>
                <p className="text-sm font-bold text-foreground leading-tight truncate">
                  {ACCOUNT_LABELS[account]}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform duration-200',
                  switcherOpen && 'rotate-180',
                )}
              />
            </>
          )}
        </button>

        {!collapsed && (
          <div className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            switcherOpen ? 'max-h-32' : 'max-h-0',
          )}>
            <div className="px-2 pb-2.5 pt-1 space-y-0.5">
              {RADAR_ACCOUNTS.map(acc => {
                const active = acc === account
                return (
                  <button
                    key={acc}
                    onClick={() => selectAccount(acc)}
                    className={cn(
                      'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all duration-150',
                      active
                        ? 'bg-accent text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    <img
                      src={ACCOUNT_LOGOS[acc]}
                      alt={ACCOUNT_LABELS[acc]}
                      className="w-7 h-7 rounded-lg object-cover flex-shrink-0 ring-1 ring-border/30"
                    />
                    <span className="flex-1 text-left text-xs font-semibold truncate">
                      {ACCOUNT_LABELS[acc]}
                    </span>
                    {active && <Check className="w-3.5 h-3.5 flex-shrink-0 text-primary" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest px-1 pb-1.5">
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
                  className={({ isActive }) =>
                    cn(
                      'flex items-center rounded-md transition-all duration-150 group relative',
                      collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                      isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )
                  }
                  style={({ isActive }) => isActive ? { backgroundColor: color + '18' } : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <Icon
                        className="flex-shrink-0 w-4 h-4"
                        style={isActive ? { color } : undefined}
                      />
                      {!collapsed && (
                        <div className="min-w-0">
                          <p
                            className="text-sm font-medium leading-tight truncate"
                            style={isActive ? { color } : undefined}
                          >{label}</p>
                          <p className="text-[10px] text-muted-foreground/60 truncate leading-tight">{desc}</p>
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

      {/* Info box */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div
            className="rounded-md p-2.5 space-y-1"
            style={{ backgroundColor: color + '12', borderWidth: 1, borderStyle: 'solid', borderColor: color + '30' }}
          >
            <div className="flex items-center gap-1.5">
              <BarChart2 className="w-3 h-3" style={{ color: color + 'cc' }} />
              <p className="text-[10px] font-semibold" style={{ color: color + 'cc' }}>
                {account === 'imirante' ? 'Radar Mirante' : 'Radar Mirante Esporte'}
              </p>
            </div>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Inteligência editorial em tempo real para a redação.
            </p>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className={cn('border-t border-border flex items-center p-2', collapsed ? 'justify-center' : 'justify-between px-3')}>
        {!collapsed && (
          <p className="text-[10px] text-muted-foreground/40">v0.2.0</p>
        )}
        <button
          onClick={toggle}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>
    </aside>
  )
}
