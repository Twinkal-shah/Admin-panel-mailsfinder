import { Card, Form, Input, Button, Typography, Alert } from 'antd'
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
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
    setLoading(true)
    try {
      const email = String(values.email || '').trim().toLowerCase()
      const res = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
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
      const adminData = body.data?.admin
      const admin = {
        id: String(adminData?._id ?? adminData?.id ?? 'admin-1'),
        name: adminData?.full_name ?? 'Admin',
        email: adminData?.email ?? email,
        role: (adminData?.role ?? 'superadmin') as Role
      }
      login(admin, token)
      navigate('/', { replace: true })
    } catch (e: any) {
      setError(e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <Card title="Admin Login" style={{ width: '100%', maxWidth: 420, margin: '0 16px' }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Admin access required (JWT/session).
        </Typography.Paragraph>
        {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}
        <Form layout="vertical" onFinish={onFinish} initialValues={{ email: 'admin@test.com' }}>
          <Form.Item label="Email" name="email" rules={[{ required: true }]}>
            <Input placeholder="admin@test.com" />
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true }]}>
            <Input.Password placeholder="Your password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block disabled={loading}>
              Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
