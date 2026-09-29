import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAccount } from '@/contexts/AccountContext'
import { EmProducao } from '@/components/ui/EmProducao'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

function NoAccessScreen() {
  const navigate = useNavigate()
  return (
    <>
      <style>{`
        @keyframes noaccess-float {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-14px) rotate(2deg); }
        }
        @keyframes noaccess-shake {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-12deg); }
          30% { transform: rotate(14deg); }
          45% { transform: rotate(-10deg); }
          60% { transform: rotate(12deg); }
          75% { transform: rotate(-6deg); }
        }
        @keyframes noaccess-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes noaccess-blink {
          0%, 85%, 100% { transform: scaleY(1); }
          90% { transform: scaleY(0.1); }
        }
        .noaccess-float { animation: noaccess-float 3s ease-in-out infinite; }
        .noaccess-shake { animation: noaccess-shake 2.5s ease-in-out infinite; animation-delay: 2s; }
        .noaccess-ring1 { animation: noaccess-ring 2.5s ease-out infinite; }
        .noaccess-ring2 { animation: noaccess-ring 2.5s ease-out infinite; animation-delay: 0.8s; }
        .noaccess-eye { animation: noaccess-blink 4s ease-in-out infinite; display: inline-block; transform-origin: center; }
      `}</style>

      <div className="flex flex-col items-center justify-center h-full py-16 text-center gap-8 select-none">

        {/* Animated character */}
        <div className="relative">
          {/* Pulse rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="noaccess-ring1 w-24 h-24 rounded-full border-2 border-muted-foreground/20" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="noaccess-ring2 w-24 h-24 rounded-full border-2 border-muted-foreground/10" />
          </div>

          {/* Main emoji float + shake — nested so animations don't override each other */}
          <div className="noaccess-float relative z-10 flex flex-col items-center gap-0">
          <div className="noaccess-shake flex flex-col items-center gap-0">
            {/* Head */}
            <div className="w-20 h-20 rounded-full bg-muted/80 border-2 border-border/60 flex items-center justify-center shadow-lg text-4xl">
              🤨
            </div>
            {/* Body / badge */}
            <div className="w-16 h-5 rounded-b-xl bg-muted/60 border border-t-0 border-border/60 flex items-center justify-center mt-0">
              <span className="text-[9px] font-black text-muted-foreground/60 tracking-widest uppercase">ACESSO</span>
            </div>
          </div>
          </div>
        </div>

        {/* Sign */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/8 border border-destructive/20">
            <span className="text-base">🚫</span>
            <span className="text-sm font-bold text-destructive/70">Você não está na lista</span>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2 max-w-[280px]">
          <p className="text-sm font-semibold text-foreground leading-snug">
            Sem permissão por aqui...
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Sua conta ainda não tem acesso ao Radar.<br />
            Fala com um admin para entrar na lista. 😅
          </p>
        </div>

        {/* CTA */}
        <Button
          size="sm"
          variant="outline"
          className="gap-2 text-xs"
          onClick={() => navigate('/settings')}
        >
          <Settings className="w-3.5 h-3.5" />
          Ir para Configurações
        </Button>
      </div>
    </>
  )
}

export default function AppLayout() {
  const { account, accounts, accountsLoading } = useAccount()
  const location = useLocation()

  const isSettingsPage = location.pathname === '/settings'

  let content: React.ReactNode
  if (!accountsLoading && accounts.length === 0 && !isSettingsPage) {
    content = <NoAccessScreen />
  } else if (account === 'imiranteesporte') {
    content = <EmProducao titulo="Mirante Radar Esporte" descricao="O Radar do Mirante Esporte está sendo configurado e estará disponível em breve." />
  } else {
    content = <Outlet />
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-7xl mx-auto px-4 py-6">
            {content}
          </div>
        </main>
      </div>
    </div>
  )
}
