import { useParams } from 'react-router-dom'
import { useDataStore } from '../store/data'
import { useMemo, useState } from 'react'
import { Card, Descriptions, Typography, Row, Col, Button, Modal, Form, Input, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { ApiKey, Purchase, User } from '../types/types'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const { users, purchases, apiKeys, addCredits, revokeApiKey, createApiKey, updateUserNotes } = useDataStore()
  const { admin } = useAuthStore()
  const user = useMemo(() => users.find(u => u.id === id), [users, id])
  const userPurchases = useMemo(() => purchases.filter(p => p.userId === id), [purchases, id])
  const userKeys = useMemo(() => apiKeys.filter(k => k.userId === id), [apiKeys, id])

  const [creditsModal, setCreditsModal] = useState<{ open: boolean; delta: number; reason: string }>({ open: false, delta: 0, reason: '' })
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [showFullKey, setShowFullKey] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<number>(60)
  const [notes, setNotes] = useState<string>(user?.admin_notes || '')

  if (!user) return <Typography.Text>User not found</Typography.Text>

  function confirmCredits() {
    if (!user) return
    addCredits(user.id, creditsModal.delta, admin.id, creditsModal.reason)
    setCreditsModal({ open: false, delta: 0, reason: '' })
  }

  function handleCreateKey() {
    if (!user) return
    const created = createApiKey({ userId: user.id, rateLimitPerMinute: rateLimit }, admin.id)
    setShowFullKey(created.fullKey)
    setCreateKeyOpen(false)
  }

  function saveNotes() {
    if (!user) return
    updateUserNotes(user.id, notes)
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
        <Button
          danger
          disabled={!hasScope(admin.role, 'apikeys.manage')}
          onClick={() => Modal.confirm({
            title: 'Revoke API Key',
            content: 'This is a destructive action. Confirm revoke?',
            okText: 'Revoke',
            okButtonProps: { danger: true },
            onOk: () => revokeApiKey(record.id, admin.id, 'Revoked by admin')
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
        <Col span={12}>
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
        <Col span={12}>
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

      <Row gutter={16}>
        <Col span={12}>
          <Card title="API Keys">
            <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
              <Button type="primary" disabled={!hasScope(admin.role, 'apikeys.manage')} onClick={() => setCreateKeyOpen(true)}>
                Create API Key
              </Button>
            </div>
            <Table<ApiKey> rowKey="id" dataSource={userKeys} columns={keyColumns} pagination={false} />
            {showFullKey && (
              <Card style={{ marginTop: 12 }} title="New Key">
                <Typography.Text>
                  Full key (shown only once): {showFullKey}
                </Typography.Text>
              </Card>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Purchases">
            <Table<Purchase> rowKey="id" dataSource={userPurchases} columns={purchaseColumns} pagination={false} />
          </Card>
        </Col>
      </Row>

      <Card title="Admin Notes">
        <Input.TextArea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div style={{ marginTop: 12 }}>
          <Button type="primary" onClick={saveNotes} disabled={!hasScope(admin.role, 'users.write')}>
            Save Notes
          </Button>
        </div>
      </Card>

      <Modal
        title="Credit adjustment"
        open={creditsModal.open}
        onOk={confirmCredits}
        onCancel={() => setCreditsModal({ open: false, delta: 0, reason: '' })}
        okButtonProps={{ disabled: !creditsModal.reason }}
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
