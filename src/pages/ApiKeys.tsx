import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '../store/data'
import { Card, Table, Tag, Typography, Button, Modal, Form, Input, Select } from 'antd'
import dayjs from 'dayjs'
import { ApiKey, User } from '../types/types'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'

export default function ApiKeys() {
  const { apiKeys, users, initDemoData, revokeApiKey, createApiKey, updateApiKeyRateLimit } = useDataStore()
  const { admin } = useAuthStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [rateLimit, setRateLimit] = useState<number>(60)
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [fullKey, setFullKey] = useState<string | null>(null)
  const [revokeModal, setRevokeModal] = useState<{ open: boolean; keyId?: string; reason: string }>({ open: false, reason: '' })
  const [rateModal, setRateModal] = useState<{ open: boolean; keyId?: string; rate: number }>({ open: false, rate: 60 })

  useEffect(() => {
    if (users.length === 0) initDemoData()
  }, [])

  const columns = [
    { title: 'Prefix', dataIndex: 'keyPrefix' },
    { title: 'User', dataIndex: 'userId', render: (id: string) => users.find(u => u.id === id)?.email || '-' },
    { title: 'rateLimitPerMinute', dataIndex: 'rateLimitPerMinute' },
    { title: 'lastUsedAt', dataIndex: 'lastUsedAt', render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD') : '-' },
    { title: 'usageCount', dataIndex: 'usageCount' },
    {
      title: 'status',
      dataIndex: 'status',
      render: (s: string) => (
        <Tag
          style={{
            borderRadius: 999,
            borderColor: '#374151',
            background: '#050507',
            color: '#d1d5db'
          }}
        >
          {s}
        </Tag>
      )
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
  }
  function confirmRevoke() {
    if (!revokeModal.keyId) return
    revokeApiKey(revokeModal.keyId, admin.id, revokeModal.reason || 'Revoked')
    setRevokeModal({ open: false, reason: '' })
  }
  function confirmSetRate() {
    if (!rateModal.keyId) return
    updateApiKeyRateLimit(rateModal.keyId, rateModal.rate)
    setRateModal({ open: false, rate: 60 })
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
        <Table<ApiKey>
          rowKey="id"
          dataSource={apiKeys}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
          size="small"
        />
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
