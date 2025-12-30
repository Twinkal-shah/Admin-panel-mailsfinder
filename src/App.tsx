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

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#737373',
          colorText: '#f5f5f5',
          colorBgBase: '#050505',
          colorBgContainer: '#111111',
          colorBorder: '#262626',
          colorBorderSecondary: '#404040',
          borderRadius: 10,
          fontFamily:
            '"Bricolage Grotesque", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
        }
      }}
    >
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
