import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '../store/data'
import { Card, Table, Tag, Typography, Button, Modal, Form, Input, Select, Skeleton, message, theme } from 'antd'
import dayjs from 'dayjs'
import { ApiKey, User } from '../types/types'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'

export default function ApiKeys() {
  const { apiKeys, users, initDemoData, revokeApiKey, createApiKey, updateApiKeyRateLimit, setAll } = useDataStore()
  const { admin, token } = useAuthStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [rateLimit, setRateLimit] = useState<number>(60)
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [fullKey, setFullKey] = useState<string | null>(null)
  const [revokeModal, setRevokeModal] = useState<{ open: boolean; keyId?: string; reason: string }>({ open: false, reason: '' })
  const [rateModal, setRateModal] = useState<{ open: boolean; keyId?: string; rate: number }>({ open: false, rate: 60 })
  const [loading, setLoading] = useState(false)
  const [revokeLoading, setRevokeLoading] = useState(false)
  const [rateLoading, setRateLoading] = useState(false)
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<Set<string>>(new Set())
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'

  useEffect(() => {
    if (users.length === 0) initDemoData()
  }, [])

  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://server.mailsfinder.com'
    let cancelled = false
    async function loadKeys() {
      if (apiKeys.length > 0) return
      try {
        setLoading(true)
        const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
        const res = await fetch(`${API_BASE_URL}/api/admin/dashboard/bootstrap`, {
          headers: { Authorization: bearer ? `Bearer ${bearer}` : '' },
          credentials: 'include'
        })
        if (!res.ok) return
        const body = await res.json()
        if (cancelled) return
        const source = Array.isArray(body.apiKeys)
          ? body.apiKeys
          : Array.isArray(body.apikeys)
          ? body.apikeys
          : []
        const mapped = source.map((k: any) => ({
          id: String(k._id ?? k.id),
          userId: k.userId ? String(k.userId) : undefined,
          keyPrefix: k.keyPrefix ?? (typeof k.apiKey === 'string' ? k.apiKey.slice(0, 8) : ''),
          encryptedKey: 'hidden',
          rateLimitPerMinute: k.rateLimitPerMinute ?? 60,
          lastUsedAt:
            (k.lastUsedAt && new Date(k.lastUsedAt).toISOString()) ||
            (k.updatedAt && new Date(k.updatedAt).toISOString()) ||
            undefined,
          usageCount: k.usageCount ?? 0,
          status: k.isActive === false ? 'revoked' : 'active',
          createdAt: (k.createdAt && new Date(k.createdAt).toISOString()) || new Date().toISOString()
        }))
        if (mapped.length > 0) setAll({ apiKeys: mapped })
      } catch {} finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadKeys()
    return () => {
      cancelled = true
    }
  }, [apiKeys.length, setAll, token])

  const columns = [
    { title: 'Prefix', dataIndex: 'keyPrefix' },
    { title: 'User', dataIndex: 'userId', render: (id: string) => users.find(u => u.id === id)?.email || '-' },
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
        <div style={{ display: 'flex', gap: 8 }}>
          <Button disabled={!hasScope(admin.role, 'apikeys.manage')} onClick={() => setRateModal({ open: true, keyId: record.id, rate: record.rateLimitPerMinute })}>
            Set rate limit
          </Button>
          <Button danger disabled={!hasScope(admin.role, 'apikeys.manage')} onClick={() => setRevokeModal({ open: true, keyId: record.id, reason: '' })}>
            Revoke
          </Button>
        </div>
      )
    }
  ]

  function handleCreate() {
    const created = createApiKey({ userId, rateLimitPerMinute: rateLimit }, admin.id)
    setFullKey(created.fullKey)
    setCreateOpen(false)
    setRecentlyUpdatedIds(prev => new Set([...prev, created.key.id]))
    setTimeout(() => {
      setRecentlyUpdatedIds(prev => {
        const next = new Set([...prev]); next.delete(created.key.id); return next
      })
    }, 1200)
    message.success('API Key created')
  }
  function confirmRevoke() {
    if (!revokeModal.keyId) return
    setRevokeLoading(true)
    setTimeout(() => {
      revokeApiKey(revokeModal.keyId!, admin.id, revokeModal.reason || 'Revoked')
      setRevokeLoading(false)
      setRevokeModal({ open: false, reason: '' })
      setRecentlyUpdatedIds(prev => new Set([...prev, revokeModal.keyId!]))
      setTimeout(() => {
        setRecentlyUpdatedIds(prev => { const next = new Set([...prev]); next.delete(revokeModal.keyId!); return next })
      }, 1200)
      message.success('API Key revoked')
    }, 300)
  }
  function confirmSetRate() {
    if (!rateModal.keyId) return
    setRateLoading(true)
    setTimeout(() => {
      updateApiKeyRateLimit(rateModal.keyId!, rateModal.rate)
      setRateLoading(false)
      setRateModal({ open: false, rate: 60 })
      setRecentlyUpdatedIds(prev => new Set([...prev, rateModal.keyId!]))
      setTimeout(() => {
        setRecentlyUpdatedIds(prev => { const next = new Set([...prev]); next.delete(rateModal.keyId!); return next })
      }, 1200)
      message.success('Rate limit updated')
    }, 300)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>API Keys</Typography.Title>
        <Button type="primary" disabled={!hasScope(admin.role, 'apikeys.manage')} onClick={() => setCreateOpen(true)}>
          Create
        </Button>
      </div>
      <Card>
        {loading && apiKeys.length === 0 ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <Table<ApiKey>
            rowKey="id"
            dataSource={apiKeys}
            columns={columns}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 'max-content' }}
            size="small"
            rowClassName={(record) => recentlyUpdatedIds.has(record.id) ? 'row-refresh' : ''}
          />
        )}
      </Card>

      {fullKey && (
        <Card title="New Key (shown once)">
          <Typography.Text>{fullKey}</Typography.Text>
        </Card>
      )}

      <Modal
        title="Create API Key"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        className="mf-modal"
      >
        <Form layout="vertical">
          <Form.Item label="User">
            <Select
              allowClear
              value={userId}
              onChange={setUserId}
              options={users.map(u => ({ value: u.id, label: `${u.full_name} (${u.email})` }))}
            />
          </Form.Item>
          <Form.Item label="rateLimitPerMinute">
            <Input type="number" value={rateLimit} onChange={(e) => setRateLimit(Number(e.target.value))} />
          </Form.Item>
        </Form>
        <Typography.Paragraph type="secondary">
          Only the key prefix is visible after creation. Full key is shown once and stored encrypted at rest.
        </Typography.Paragraph>
      </Modal>
      <Modal
        title="Revoke API Key"
        open={revokeModal.open}
        onOk={confirmRevoke}
        onCancel={() => setRevokeModal({ open: false, reason: '' })}
        okButtonProps={{ danger: true }}
        className="mf-modal"
        confirmLoading={revokeLoading}
      >
        <Typography.Paragraph type="secondary">
          This is a destructive action. Please confirm revocation.
        </Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item label="Reason">
            <Input.TextArea rows={3} value={revokeModal.reason} onChange={(e) => setRevokeModal(m => ({ ...m, reason: e.target.value }))} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="Set Rate Limit"
        open={rateModal.open}
        onOk={confirmSetRate}
        onCancel={() => setRateModal({ open: false, rate: 60 })}
        className="mf-modal"
        confirmLoading={rateLoading}
      >
        <Form layout="vertical">
          <Form.Item label="rateLimitPerMinute">
            <Input type="number" value={rateModal.rate} onChange={(e) => setRateModal(m => ({ ...m, rate: Number(e.target.value) }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
