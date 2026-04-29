import { useParams } from 'react-router-dom'
import { useDataStore } from '../store/data'
import { useMemo, useState } from 'react'
import { Card, Descriptions, Typography, Row, Col, Button, Modal, Form, Input, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { ApiKey, Purchase } from '../types/types'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://server.mailsfinder.com')

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const { users, purchases, apiKeys, addCredits, revokeApiKey, createApiKey, updateUserNotes } = useDataStore()
  const { admin, token } = useAuthStore()
  const user = useMemo(() => users.find(u => u.id === id), [users, id])
  const userPurchases = useMemo(() => purchases.filter(p => p.userId === id), [purchases, id])
  const userKeys = useMemo(() => apiKeys.filter(k => k.userId === id), [apiKeys, id])

  const [creditsModal, setCreditsModal] = useState<{ open: boolean; delta: number; reason: string; bucket: 'find' | 'verify' }>({ open: false, delta: 0, reason: '', bucket: 'find' })
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [showFullKey, setShowFullKey] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<number>(60)
  const [notes, setNotes] = useState<string>(user?.admin_notes || '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [creditsLoading, setCreditsLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<Set<string>>(new Set())

  if (!user) return <Typography.Text>User not found</Typography.Text>

  function authHeaders(): Record<string, string> {
    const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (bearer) headers.Authorization = `Bearer ${bearer}`
    return headers
  }

  async function confirmCredits() {
    if (!user) return
    if (!creditsModal.reason.trim()) {
      message.error('Reason is required')
      return
    }
    setCreditsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/userManagement/users/${user.id}/credits-adjust`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          delta: Number(creditsModal.delta),
          bucket: creditsModal.bucket,
          reason: creditsModal.reason
        })
      })
      const body = await res.json().catch(() => ({} as any))
      if (!res.ok || body?.success === false) {
        message.error(body?.message || `HTTP ${res.status}`)
        return
      }
      addCredits(user.id, creditsModal.delta, admin.id, creditsModal.reason)
      setCreditsModal({ open: false, delta: 0, reason: '', bucket: 'find' })
      message.success('Credits updated')
    } catch (e: any) {
      message.error(e?.message || 'Request failed')
    } finally {
      setCreditsLoading(false)
    }
  }

  function handleCreateKey() {
    if (!user) return
    setCreateLoading(true)
    setTimeout(() => {
      const created = createApiKey({ userId: user.id, rateLimitPerMinute: rateLimit }, admin.id)
      setShowFullKey(created.fullKey)
      setCreateLoading(false)
      setCreateKeyOpen(false)
      message.success('API Key created')
    }, 300)
  }

  async function saveNotes() {
    if (!user) return
    setNotesSaving(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/userManagement/users/${user.id}/notes`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ admin_notes: notes })
      })
      const body = await res.json().catch(() => ({} as any))
      if (!res.ok || body?.success === false) {
        message.error(body?.message || `HTTP ${res.status}`)
        return
      }
      updateUserNotes(user.id, notes)
      message.success('Notes saved')
    } catch (e: any) {
      message.error(e?.message || 'Request failed')
    } finally {
      setNotesSaving(false)
    }
  }

  const purchaseColumns = [
    { title: 'ID', dataIndex: 'id' },
    { title: 'planName', dataIndex: 'planName' },
    { title: 'status', dataIndex: 'status' },
    { title: 'date', dataIndex: 'date', render: (d: string) => dayjs(d).format('YYYY-MM-DD') }
  ]

  const keyColumns = [
    { title: 'Prefix', dataIndex: 'keyPrefix' },
    { title: 'rateLimitPerMinute', dataIndex: 'rateLimitPerMinute' },
    { title: 'lastUsedAt', dataIndex: 'lastUsedAt', render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD') : '-' },
    { title: 'usageCount', dataIndex: 'usageCount' },
    {
      title: 'status',
      dataIndex: 'status',
      render: (s: string) => {
        const stylesLight: Record<string, { bg: string; text: string; border: string }> = {
          active: { bg: '#ecfdf5', text: '#065f46', border: '#d1fae5' },
          revoked: { bg: '#fef2f2', text: '#7f1d1d', border: '#fee2e2' }
        }
        const stylesDark = { bg: '#0b0b0d', text: '#d1d5db', border: '#374151' }
        const sConf = isDarkMode ? stylesDark : stylesLight[s] || stylesLight.active
        return (
          <Tag style={{ borderRadius: 999, background: sConf.bg, color: sConf.text, borderColor: sConf.border }}>
            {s}
          </Tag>
        )
      }
    },
    {
      title: 'Actions',
      render: (_: any, record: ApiKey) => (
        <Button
          danger
          disabled={!hasScope(admin.role, 'apikeys.manage')}
          onClick={() => Modal.confirm({
            title: 'Revoke API Key',
            content: 'This is a destructive action. Confirm revoke?',
            okText: 'Revoke',
            okButtonProps: { danger: true },
            onOk: () => {
              revokeApiKey(record.id, admin.id, 'Revoked by admin')
              setRecentlyUpdatedIds(prev => new Set([...prev, record.id]))
              setTimeout(() => {
                setRecentlyUpdatedIds(prev => { const next = new Set([...prev]); next.delete(record.id); return next })
              }, 1200)
              message.success('API Key revoked')
            }
          })}
        >
          Revoke
        </Button>
      )
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>User Detail</Typography.Title>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Profile">
            <Descriptions column={1} bordered>
              <Descriptions.Item label="full_name">{user.full_name}</Descriptions.Item>
              <Descriptions.Item label="email">{user.email}</Descriptions.Item>
              <Descriptions.Item label="phone">{user.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="country">{user.country || '-'}</Descriptions.Item>
              <Descriptions.Item label="onboarding flag">{user.onboarding_flag ? 'true' : 'false'}</Descriptions.Item>
              <Descriptions.Item label="createdAt">{dayjs(user.createdAt).format('YYYY-MM-DD')}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Credits">
            <Descriptions column={1} bordered>
              <Descriptions.Item label="credits">{user.credits_total}</Descriptions.Item>
              <Descriptions.Item label="credits_find">{user.credits_find}</Descriptions.Item>
              <Descriptions.Item label="credits_verify">{user.credits_verify}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                disabled={!hasScope(admin.role, 'credits.adjust')}
                onClick={() => setCreditsModal({ open: true, delta: 100, reason: '', bucket: 'find' })}
              >
                Add credits
              </Button>
              <Button
                danger
                disabled={!hasScope(admin.role, 'credits.adjust')}
                onClick={() => setCreditsModal({ open: true, delta: -50, reason: '', bucket: 'find' })}
              >
                Subtract credits
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Credit balances">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {([
            { label: 'free_daily', value: user.free_daily_balance, color: '#94A3B8' },
            { label: 'monthly', value: user.monthly_balance, color: '#3B82F6' },
            { label: 'lifetime', value: user.lifetime_balance, color: '#F59E0B' },
            { label: 'payg', value: user.payg_balance, color: '#8B5CF6' }
          ] as const).map(b => (
            <Tag
              key={b.label}
              style={{
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 13,
                background: `${b.color}1F`,
                color: b.color,
                border: `1.5px solid ${b.color}`
              }}
            >
              {b.label}: {b.value ?? 0}
            </Tag>
          ))}
        </div>
        {user.subscription_status && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            Subscription: {user.subscription_status}
            {user.billing_cycle ? ` • ${user.billing_cycle}` : ''}
            {user.cycle_end_date ? ` • renews ${dayjs(user.cycle_end_date).format('YYYY-MM-DD')}` : ''}
          </Typography.Paragraph>
        )}
      </Card>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="API Keys">
            <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
              <Button type="primary" disabled={!hasScope(admin.role, 'apikeys.manage')} onClick={() => setCreateKeyOpen(true)}>
                Create API Key
              </Button>
            </div>
            <Table<ApiKey>
              rowKey="id"
              dataSource={userKeys}
              columns={keyColumns}
              pagination={false}
              scroll={{ x: 'max-content' }}
              size="small"
              rowClassName={(record) => recentlyUpdatedIds.has(record.id) ? 'row-refresh' : ''}
            />
            {showFullKey && (
              <Card style={{ marginTop: 12 }} title="New Key">
                <Typography.Text>
                  Full key (shown only once): {showFullKey}
                </Typography.Text>
              </Card>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Purchases">
            <Table<Purchase>
              rowKey="id"
              dataSource={userPurchases}
              columns={purchaseColumns}
              pagination={false}
              scroll={{ x: 'max-content' }}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Card title="Admin Notes">
        <Input.TextArea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div style={{ marginTop: 12 }}>
          <Button type="primary" onClick={saveNotes} disabled={!hasScope(admin.role, 'users.write')} loading={notesSaving}>
            Save Notes
          </Button>
        </div>
      </Card>

      <Modal
        title="Credit adjustment"
        open={creditsModal.open}
        onOk={confirmCredits}
        onCancel={() => setCreditsModal({ open: false, delta: 0, reason: '', bucket: 'find' })}
        okButtonProps={{ disabled: !creditsModal.reason }}
        className="mf-modal"
        confirmLoading={creditsLoading}
      >
        <Form layout="vertical">
          <Form.Item label="Bucket" required>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type={creditsModal.bucket === 'find' ? 'primary' : 'default'}
                onClick={() => setCreditsModal(m => ({ ...m, bucket: 'find' }))}
              >
                Find
              </Button>
              <Button
                type={creditsModal.bucket === 'verify' ? 'primary' : 'default'}
                onClick={() => setCreditsModal(m => ({ ...m, bucket: 'verify' }))}
              >
                Verify
              </Button>
            </div>
          </Form.Item>
          <Form.Item label="Delta (positive adds, negative subtracts)">
            <Input type="number" value={creditsModal.delta} onChange={(e) => setCreditsModal(m => ({ ...m, delta: Number(e.target.value) }))} />
          </Form.Item>
          <Form.Item label="Reason" required>
            <Input.TextArea value={creditsModal.reason} onChange={(e) => setCreditsModal(m => ({ ...m, reason: e.target.value }))} />
          </Form.Item>
        </Form>
        <Typography.Paragraph type="secondary">
          Will create an audit row recording admin, action, target, timestamp, and reason.
        </Typography.Paragraph>
      </Modal>

      <Modal
        title="Create API Key"
        open={createKeyOpen}
        onOk={handleCreateKey}
        onCancel={() => setCreateKeyOpen(false)}
        className="mf-modal"
        confirmLoading={createLoading}
      >
        <Form layout="vertical">
          <Form.Item label="rateLimitPerMinute" required>
            <Input type="number" value={rateLimit} onChange={(e) => setRateLimit(Number(e.target.value))} />
          </Form.Item>
        </Form>
        <Typography.Paragraph type="secondary">
          Full key will be shown only once and stored encrypted at rest. Use a confirmation modal for destructive actions.
        </Typography.Paragraph>
      </Modal>
    </div>
  )
}
