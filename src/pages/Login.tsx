import { Form, Input, Button, Typography, Alert } from 'antd'
import { useState } from 'react'
import { useAuthStore } from '../store/auth'
import type { Role } from '../types/types'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  async function onFinish(values: any) {
    setError(null)
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://api.mailsfinder.com')
    setLoading(true)
    try {
      const email = String(values.email || '').trim().toLowerCase()
      const res = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password: String(values.password || '') })
      })
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try {
          const errBody = await res.json()
          msg = errBody?.message || msg
        } catch {}
        throw new Error(msg)
      }
      const body = await res.json()
      const token: string | undefined =
        body.ADMIN_TOKEN ||
        body.admin_token ||
        body.token ||
        body.jwt ||
        body.session?.token ||
        body.data?.accessToken
      if (!token) throw new Error('Missing ADMIN_TOKEN in response')
      const refreshToken: string | undefined =
        body.data?.refreshToken ||
        body.refreshToken ||
        body.refresh_token
      const adminData = body.data?.admin
      const admin = {
        id: String(adminData?._id ?? adminData?.id ?? 'admin-1'),
        name: adminData?.name ?? adminData?.full_name ?? 'Admin',
        email: adminData?.email ?? email,
        role: (adminData?.role ?? 'superadmin') as Role
      }
      login(admin, token, refreshToken)
      navigate('/', { replace: true })
    } catch (e: any) {
      setError(e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mf-login">
      <div className="mf-login__panel">
        <div className="mf-login__brand">
          <span className="mf-brand__mark bg-brand-gradient" style={{ width: 40, height: 40 }}>
            MF
          </span>
          <div className="mf-brand__text">
            <span className="mf-brand__name" style={{ fontSize: 17 }}>MailsFinder</span>
            <span className="mf-brand__sub">Admin Panel</span>
          </div>
        </div>

        <div className="mf-login__head">
          <Typography.Title level={3} style={{ margin: 0, fontSize: 22 }}>
            Sign in
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13.5 }}>
            Admin access required (JWT/session).
          </Typography.Text>
        </div>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={onFinish} initialValues={{}} requiredMark={false}>
          <Form.Item label="Email" name="email" rules={[{ required: true }]}>
            <Input size="large" placeholder="admin@test.com" autoComplete="username" />
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true }]}>
            <Input.Password size="large" placeholder="Your password" autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button type="primary" size="large" htmlType="submit" block loading={loading}>
              Sign in
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}
