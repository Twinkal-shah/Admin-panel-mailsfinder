import { ConfigProvider, theme } from 'antd'
import { Route, Routes, Navigate } from 'react-router-dom'
import LayoutShell from './components/LayoutShell'
import Dashboard from './pages/Dashboard'
import UsersList from './pages/UsersList'
import UserDetail from './pages/UserDetail'
import CMSLite from './pages/CMSLite'
import ApiKeys from './pages/ApiKeys'
import AuditLogs from './pages/AuditLogs'
import Login from './pages/Login'
import { useAuthStore } from './store/auth'
import { setUnauthorizedHandler } from './utils/api'
import { useEffect, useMemo, useState } from 'react'

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
          <Route index element={<Dashboard />} />
          <Route path="users" element={<UsersList />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="content" element={<CMSLite />} />
          <Route path="apikeys" element={<ApiKeys />} />
          <Route path="audit" element={<AuditLogs />} />
        </Route>
      </Routes>
    </ConfigProvider>
  )
}
