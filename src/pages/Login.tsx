import { Card, Form, Input, Button, Select, Typography, Alert } from 'antd'
import { useState } from 'react'
import { useAuthStore } from '../store/auth'
import type { Role } from '../types/types'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const [role, setRole] = useState<Role>('superadmin')
  const [twoFARequired, setTwoFARequired] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  function onFinish(values: any) {
    if (role === 'superadmin' && twoFARequired) {
      if (values.code !== '000000') {
        setError('Invalid 2FA code')
        return
      }
    }
    setError(null)
    login(
      { id: 'admin-1', name: values.name || 'Admin', email: values.email, role },
      'demo-jwt-token'
    )
    navigate('/', { replace: true })
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <Card title="Admin Login" style={{ width: 420 }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Admin access required (JWT/session). 2FA is recommended for superadmin.
        </Typography.Paragraph>
        {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}
        <Form layout="vertical" onFinish={onFinish} initialValues={{ email: 'admin@mailsfinder.com' }}>
          <Form.Item label="Email" name="email" rules={[{ required: true }]}>
            <Input placeholder="admin@mailsfinder.com" />
          </Form.Item>
          <Form.Item label="Name" name="name">
            <Input placeholder="Your name" />
          </Form.Item>
          <Form.Item label="Role">
            <Select<Role> value={role} onChange={setRole} options={[
              { value: 'superadmin', label: 'Super Admin' },
              { value: 'product_manager', label: 'Product Manager' },
              { value: 'support', label: 'Support' }
            ]} />
          </Form.Item>
          {role === 'superadmin' && twoFARequired && (
            <Form.Item label="2FA Code" name="code" rules={[{ required: true }]}>
              <Input placeholder="000000" />
            </Form.Item>
          )}
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
