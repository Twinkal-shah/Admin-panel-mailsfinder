import { useParams } from 'react-router-dom'
import { useDataStore } from '../store/data'
import { useMemo, useState } from 'react'
import { Card, Descriptions, Typography, Row, Col, Button, Modal, Form, Input, InputNumber, Progress, Table, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { ApiKey, PLAN_DISPLAY_NAME, Purchase } from '../types/types'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'
import { mapUser } from '../utils/mappers'

// Spec: monthly users have a 10k/day cap on the monthly bucket.
const MONTHLY_DAILY_CAP = 10000

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://api.mailsfinder.com')

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const { users, purchases, apiKeys, adjustCredits, revokeApiKey, createApiKey, updateUserNotes, replaceUser, updateUser } = useDataStore()
  const { admin, token } = useAuthStore()
  const user = useMemo(() => users.find(u => u.id === id), [users, id])
  const userPurchases = useMemo(() => purchases.filter(p => p.userId === id), [purchases, id])
  const userKeys = useMemo(() => apiKeys.filter(k => k.userId === id), [apiKeys, id])

  const [creditsModal, setCreditsModal] = useState<{ open: boolean; delta: number; reason: string }>({ open: false, delta: 0, reason: '' })
  const [planActionLoading, setPlanActionLoading] = useState<'monthly' | 'lifetime' | 'free' | null>(null)
  const [grantMonthly, setGrantMonthly] = useState<{ open: boolean; credits: number; cycleDays: number; reason: string }>(
    { open: false, credits: 300000, cycleDays: 30, reason: '' }
  )
  const [grantLifetime, setGrantLifetime] = useState<{ open: boolean; credits: number; reason: string }>(
    { open: false, credits: 2000000, reason: '' }
  )
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
          // Backend always adjusts payg_balance; bucket is audit-only.
          bucket: 'find',
          reason: creditsModal.reason
        })
      })
      const body = await res.json().catch(() => ({} as any))
      if (!res.ok || body?.success === false) {
        message.error(body?.message || `HTTP ${res.status}`)
        return
      }
      adjustCredits(user.id, creditsModal.delta, admin.id, creditsModal.reason)
      setCreditsModal({ open: false, delta: 0, reason: '' })
      message.success('Credits updated')
    } catch (e: any) {
      message.error(e?.message || 'Request failed')
    } finally {
      setCreditsLoading(false)
    }
  }

  async function submitGrantPlan(
    body: { plan: 'monthly' | 'lifetime'; credits: number; reason: string; cycleDays?: number }
  ): Promise<boolean> {
    if (!user) return false
    if (!Number.isFinite(body.credits) || body.credits <= 0) {
      message.error('Credits must be a positive number')
      return false
    }
    if (!body.reason.trim()) {
      message.error('Reason is required')
      return false
    }
    setPlanActionLoading(body.plan)
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/userManagement/users/${user.id}/grant-plan`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
      })
      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || json?.success === false) {
        message.error(json?.message || `HTTP ${res.status}`)
        return false
      }
      const fresh = json?.data ?? json
      if (fresh && (fresh._id || fresh.id)) {
        replaceUser(mapUser(fresh), admin.id, { action: 'plan.grant', reason: body.reason })
      } else {
        updateUser(user.id, { plan: body.plan })
      }
      message.success(body.plan === 'monthly' ? 'Promoted to Monthly' : 'Promoted to Lifetime')
      return true
    } catch (e: any) {
      message.error(e?.message || 'Request failed')
      return false
    } finally {
      setPlanActionLoading(null)
    }
  }

  async function confirmGrantMonthly() {
    const ok = await submitGrantPlan({
      plan: 'monthly',
      credits: Number(grantMonthly.credits),
      cycleDays: Number(grantMonthly.cycleDays) || 30,
      reason: grantMonthly.reason
    })
    if (ok) setGrantMonthly({ open: false, credits: 300000, cycleDays: 30, reason: '' })
  }

  async function confirmGrantLifetime() {
    const ok = await submitGrantPlan({
      plan: 'lifetime',
      credits: Number(grantLifetime.credits),
      reason: grantLifetime.reason
    })
    if (ok) setGrantLifetime({ open: false, credits: 2000000, reason: '' })
  }

  async function resetToFree() {
    if (!user) return
    setPlanActionLoading('free')
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/userManagement/users/${user.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ plan: 'free' })
      })
      const body = await res.json().catch(() => ({} as any))
      if (!res.ok || body?.success === false) {
        message.error(body?.message || `HTTP ${res.status}`)
        return
      }
      const fresh = body?.data ?? body
      if (fresh && (fresh._id || fresh.id)) {
        replaceUser(mapUser(fresh))
      } else {
        updateUser(user.id, { plan: 'free' })
      }
      message.success('Plan reset to Free')
    } catch (e: any) {
      message.error(e?.message || 'Request failed')
    } finally {
      setPlanActionLoading(null)
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <Typography.Text type="secondary">Available Credits</Typography.Text>
              <Typography.Title level={2} style={{ margin: 0 }}>
                {Number(user.available_credits ?? 0).toLocaleString()}
              </Typography.Title>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                disabled={!hasScope(admin.role, 'credits.adjust')}
                onClick={() => setCreditsModal({ open: true, delta: 100, reason: '' })}
              >
                Add credits
              </Button>
              <Button
                danger
                disabled={!hasScope(admin.role, 'credits.adjust')}
                onClick={() => setCreditsModal({ open: true, delta: -50, reason: '' })}
              >
                Subtract credits
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Plan & Subscription">
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="plan">{PLAN_DISPLAY_NAME[user.plan]}</Descriptions.Item>
          <Descriptions.Item label="subscription status">
            {user.subscription?.status ?? user.subscription_status ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="billing cycle">{user.billing_cycle ?? 'none'}</Descriptions.Item>
          {(user.billing_cycle === 'monthly' || user.billing_cycle === 'annual') && (
            <>
              <Descriptions.Item label="cycle start">
                {user.cycle_start_date ? dayjs(user.cycle_start_date).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="cycle end">
                {user.cycle_end_date ? dayjs(user.cycle_end_date).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
        {user.plan === 'monthly' && (
          <div style={{ marginTop: 12 }}>
            <Typography.Text type="secondary">
              Today's daily usage: {Number(user.monthly_daily_used ?? 0).toLocaleString()} / {MONTHLY_DAILY_CAP.toLocaleString()}
            </Typography.Text>
            <Progress
              percent={Math.min(100, (Number(user.monthly_daily_used ?? 0) / MONTHLY_DAILY_CAP) * 100)}
              showInfo={false}
              size="small"
              style={{ marginTop: 4 }}
            />
          </div>
        )}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            type="primary"
            disabled={!hasScope(admin.role, 'users.write')}
            loading={planActionLoading === 'monthly'}
            onClick={() => setGrantMonthly({ open: true, credits: 300000, cycleDays: 30, reason: '' })}
          >
            Promote to Monthly
          </Button>
          <Button
            disabled={!hasScope(admin.role, 'users.write')}
            loading={planActionLoading === 'lifetime'}
            onClick={() => setGrantLifetime({ open: true, credits: 2000000, reason: '' })}
          >
            Promote to Lifetime
          </Button>
          <Button
            danger
            disabled={!hasScope(admin.role, 'users.write')}
            loading={planActionLoading === 'free'}
            onClick={() => Modal.confirm({
              title: 'Reset to Free',
              content: 'Set this user back to the Free plan. Existing bucket balances are NOT cleared (intentional). File a backend ticket if you need a destructive reset.',
              okText: 'Reset',
              okButtonProps: { danger: true },
              className: 'modal-danger mf-modal',
              onOk: resetToFree
            })}
          >
            Reset to Free
          </Button>
        </div>
      </Card>

      <Card title="Credit balances">
        <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 12 }}>
          Total: {Number(user.available_credits ?? 0).toLocaleString()}{' '}
          <Typography.Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
            (Available Credits)
          </Typography.Text>
        </Typography.Title>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {([
            { label: 'free_daily', value: user.balances?.free ?? user.free_daily_balance, pool: undefined, color: '#94A3B8' },
            { label: 'monthly', value: user.balances?.monthly ?? user.monthly_balance, pool: user.monthly_pool, color: '#3B82F6' },
            { label: 'lifetime', value: user.balances?.lifetime ?? user.lifetime_balance, pool: user.lifetime_pool, color: '#F59E0B' },
            { label: 'payg', value: user.balances?.payg ?? user.payg_balance, pool: undefined, color: '#8B5CF6' }
          ] as const).map(b => {
            const balance = Number(b.value ?? 0)
            const pool = b.pool != null ? Number(b.pool) : undefined
            return (
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
                {b.label}: {balance.toLocaleString()}
                {pool != null && pool > 0 ? ` / ${pool.toLocaleString()}` : ''}
              </Tag>
            )
          })}
        </div>
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
        title="Promote to Monthly"
        open={grantMonthly.open}
        onOk={confirmGrantMonthly}
        onCancel={() => setGrantMonthly(s => ({ ...s, open: false }))}
        okText="Promote"
        okButtonProps={{ disabled: !grantMonthly.reason || !grantMonthly.credits }}
        className="mf-modal"
        confirmLoading={planActionLoading === 'monthly'}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Atomically sets plan, monthly_balance, monthly_pool, and cycle dates via the
          backend grant-plan endpoint. Does not touch payg or free buckets.
        </Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item label="Credits" required>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              value={grantMonthly.credits}
              onChange={(v) => setGrantMonthly(s => ({ ...s, credits: Number(v ?? 0) }))}
            />
          </Form.Item>
          <Form.Item label="Cycle days" required>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              value={grantMonthly.cycleDays}
              onChange={(v) => setGrantMonthly(s => ({ ...s, cycleDays: Number(v ?? 30) }))}
            />
          </Form.Item>
          <Form.Item label="Reason" required>
            <Input.TextArea
              value={grantMonthly.reason}
              onChange={(e) => setGrantMonthly(s => ({ ...s, reason: e.target.value }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Promote to Lifetime"
        open={grantLifetime.open}
        onOk={confirmGrantLifetime}
        onCancel={() => setGrantLifetime(s => ({ ...s, open: false }))}
        okText="Promote"
        okButtonProps={{ disabled: !grantLifetime.reason || !grantLifetime.credits }}
        className="mf-modal"
        confirmLoading={planActionLoading === 'lifetime'}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Atomically sets plan, lifetime_balance, and lifetime_pool. No cycle dates.
        </Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item label="Credits" required>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              value={grantLifetime.credits}
              onChange={(v) => setGrantLifetime(s => ({ ...s, credits: Number(v ?? 0) }))}
            />
          </Form.Item>
          <Form.Item label="Reason" required>
            <Input.TextArea
              value={grantLifetime.reason}
              onChange={(e) => setGrantLifetime(s => ({ ...s, reason: e.target.value }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Credit adjustment"
        open={creditsModal.open}
        onOk={confirmCredits}
        onCancel={() => setCreditsModal({ open: false, delta: 0, reason: '' })}
        okButtonProps={{ disabled: !creditsModal.reason }}
        className="mf-modal"
        confirmLoading={creditsLoading}
      >
        <Form layout="vertical">
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
