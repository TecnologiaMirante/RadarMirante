import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { AccountProvider } from '@/contexts/AccountContext'
import { useAuth } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'

const Radar = lazy(() => import('@/pages/Radar'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const AnalysesPage = lazy(() => import('@/pages/Analyses'))
const InstagramPage = lazy(() => import('@/pages/Instagram'))
const PostDetails = lazy(() => import('@/pages/PostDetails'))
const OpportunityDetails = lazy(() => import('@/pages/OpportunityDetails'))
const Settings = lazy(() => import('@/pages/Settings'))

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
        <Route path="radar" element={<Suspense fallback={<LoadingScreen />}><Radar /></Suspense>} />
        <Route path="radar/post/:postId" element={<Suspense fallback={<LoadingScreen />}><PostDetails /></Suspense>} />
        <Route path="radar/:opportunityId" element={<Suspense fallback={<LoadingScreen />}><OpportunityDetails /></Suspense>} />
        <Route path="dashboard" element={<Suspense fallback={<LoadingScreen />}><Dashboard /></Suspense>} />
        <Route path="analises" element={<Suspense fallback={<LoadingScreen />}><AnalysesPage /></Suspense>} />
        <Route path="instagram" element={<Suspense fallback={<LoadingScreen />}><InstagramPage /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<LoadingScreen />}><Settings /></Suspense>} />
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
