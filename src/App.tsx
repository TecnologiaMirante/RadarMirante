import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { AccountProvider } from '@/contexts/AccountContext'
import { useAuth } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Radar from '@/pages/Radar'
import Dashboard from '@/pages/Dashboard'
import AnalysesPage from '@/pages/Analyses'
import InstagramPage from '@/pages/Instagram'
import PostDetails from '@/pages/PostDetails'
import OpportunityDetails from '@/pages/OpportunityDetails'
import Settings from '@/pages/Settings'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/radar" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/radar" replace />} />
        <Route path="radar" element={<Radar />} />
        <Route path="radar/post/:postId" element={<PostDetails />} />
        <Route path="radar/:opportunityId" element={<OpportunityDetails />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="analises" element={<AnalysesPage />} />
        <Route path="instagram" element={<InstagramPage />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/radar" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AccountProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AccountProvider>
    </AuthProvider>
  )
}
