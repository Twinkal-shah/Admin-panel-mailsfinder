import { ConfigProvider, theme } from 'antd'
import { Route, Routes, Navigate } from 'react-router-dom'
import LayoutShell from './components/LayoutShell'
import Login from './pages/Login'
import RouteFallback from './components/RouteFallback'
import { useAuthStore } from './store/auth'
import { setUnauthorizedHandler } from './utils/api'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'

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

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

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

  const tokens = useMemo(() => {
    const fontFamily =
      '"Space Grotesk", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
    return isDark
      ? {
          colorPrimary: '#b71d3f',
          colorInfo: '#fc536d',
          colorText: '#fbf9f8',
          colorTextSecondary: '#e2bebf',
          colorBgBase: '#1b1c1b',
          colorBgLayout: '#1b1c1b',
          colorBgContainer: '#2a2a2a',
          colorBgElevated: '#2a2a2a',
          colorBorder: 'rgba(183, 29, 63, 0.25)',
          colorBorderSecondary: 'rgba(183, 29, 63, 0.18)',
          borderRadius: 12,
          fontFamily
        }
      : {
          colorPrimary: '#b71d3f',
          colorInfo: '#fc536d',
          colorText: '#1b1c1b',
          colorTextSecondary: '#5a4042',
          colorBgBase: '#fbf9f8',
          colorBgLayout: '#fbf9f8',
          colorBgContainer: '#fbf9f8',
          colorBgElevated: '#ffffff',
          colorBorder: 'rgba(226, 190, 191, 0.5)',
          colorBorderSecondary: 'rgba(226, 190, 191, 0.3)',
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(91, 28, 47, 0.06)',
          boxShadowSecondary: '0 6px 20px rgba(91, 28, 47, 0.08)',
          fontFamily
        }
  }, [isDark])

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: tokens
      }}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <LayoutShell isDark={isDark} onToggleTheme={setIsDark} />
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
    </ConfigProvider>
  )
}
