import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
// ─── EM PRODUÇÃO: guard para imiranteesporte ──────────────────────────────────
// Para reativar: remova as 3 linhas abaixo e restaure <Outlet /> no lugar de {content}
import { useAccount } from '@/contexts/AccountContext'
import { EmProducao } from '@/components/ui/EmProducao'
// ─────────────────────────────────────────────────────────────────────────────

export default function AppLayout() {
  // ─── EM PRODUÇÃO: substitui conteúdo quando conta for imiranteesporte ────────
  const { account } = useAccount()
  const content = account === 'imiranteesporte'
    ? <EmProducao titulo="Mirante Radar Esporte" descricao="O Radar do Mirante Esporte está sendo configurado e estará disponível em breve." />
    : <Outlet />
  // ─── Para reativar: substitua {content} por <Outlet /> e remova as 3 linhas acima
  // ─────────────────────────────────────────────────────────────────────────────

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
