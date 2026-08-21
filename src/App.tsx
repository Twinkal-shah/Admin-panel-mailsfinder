import { Route, Routes, Navigate } from 'react-router-dom'
import LayoutShell from './components/LayoutShell'
import Login from './pages/Login'
import RouteFallback from './components/RouteFallback'
import { useAuthStore } from './store/auth'
import { setUnauthorizedHandler } from './utils/api'
import { ThemeProvider } from './components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Suspense, lazy, useEffect } from 'react'

// Route-level splitting. Previously every page (plus recharts and
// react-markdown) shipped in one ~1.9MB chunk that had to parse before
// anything painted.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const UsersList = lazy(() => import('./pages/UsersList'))
const UserDetail = lazy(() => import('./pages/UserDetail'))
const CMSLite = lazy(() => import('./pages/CMSLite'))
const ApiKeys = lazy(() => import('./pages/ApiKeys'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function AuthBootstrap({ children }: { children: JSX.Element }) {
  const { restoreFromToken, logout } = useAuthStore()
  useEffect(() => {
    restoreFromToken()
    setUnauthorizedHandler(() => {
      logout()
      if (typeof window !== 'undefined') {
        window.location.assign('/login')
      }
    })
  }, [restoreFromToken, logout])

  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <AuthBootstrap>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <LayoutShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
              <Route path="users" element={<Suspense fallback={<RouteFallback />}><UsersList /></Suspense>} />
              <Route path="users/:id" element={<Suspense fallback={<RouteFallback />}><UserDetail /></Suspense>} />
              <Route path="content" element={<Suspense fallback={<RouteFallback />}><CMSLite /></Suspense>} />
              <Route path="apikeys" element={<Suspense fallback={<RouteFallback />}><ApiKeys /></Suspense>} />
              <Route path="audit" element={<Suspense fallback={<RouteFallback />}><AuditLogs /></Suspense>} />
            </Route>
          </Routes>
        </AuthBootstrap>
        {/* The kit never mounts TooltipProvider or a Toaster; both belong at the
            root. Toaster replaces Antd's static `message.*` in stage 2. */}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
