import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '../store/data'
import { Button, Card, Form, Input, Modal, Select, Table, Tag, Typography, DatePicker, Grid } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { User } from '../types/types'
import dayjs from 'dayjs'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'
import { useNavigate } from 'react-router-dom'

export default function UsersList() {
  const { users, initDemoData, addCredits, updateUser, deleteUser } = useDataStore()
  const { admin } = useAuthStore()
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [filters, setFilters] = useState<{ plan?: string; email_verified?: boolean; subscription_status?: string; country?: string; createdFrom?: string; createdTo?: string }>({})
  const [addCreditsOpen, setAddCreditsOpen] = useState(false)
  const [addCreditsAmount, setAddCreditsAmount] = useState<number>(100)
  const [addCreditsReason, setAddCreditsReason] = useState<string>('')
  const [editOpen, setEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm] = Form.useForm()

  useEffect(() => {
    if (users.length === 0) initDemoData()
  }, [])

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filters.plan && u.plan !== filters.plan) return false
      if (filters.email_verified !== undefined && u.email_verified !== filters.email_verified) return false
      if (filters.subscription_status && u.subscription_status !== filters.subscription_status) return false
      if (filters.country && u.country !== filters.country) return false
      if (filters.createdFrom && !dayjs(u.createdAt).isAfter(dayjs(filters.createdFrom))) return false
      if (filters.createdTo && !dayjs(u.createdAt).isBefore(dayjs(filters.createdTo))) return false
      return true
    })
  }, [users, filters])

  const columns: ColumnsType<User> = [
    { title: 'Name', dataIndex: 'full_name', key: 'name',
      render: (text, record) => <Button type="link" onClick={() => navigate(`/users/${record.id}`)}>{text}</Button>
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Plan',
      dataIndex: 'plan',
      key: 'plan',
      render: (plan) => (
        <Tag
          style={{
            borderRadius: 999,
            borderColor: '#374151',
            background: '#050507',
            color: '#e5e7eb'
          }}
        >
          {plan}
        </Tag>
      )
    },
    { title: 'Credits (total)', dataIndex: 'credits_total', key: 'credits_total' },
    { title: 'Credits find', dataIndex: 'credits_find', key: 'credits_find' },
    { title: 'Credits verify', dataIndex: 'credits_verify', key: 'credits_verify' },
    {
      title: 'Subscription status',
      dataIndex: 'subscription_status',
      key: 'subscription_status',
      render: (s) => (
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
    { title: 'Last seen', dataIndex: 'lastSeen', key: 'lastSeen',
      render: (d) => d ? dayjs(d).format('YYYY-MM-DD') : '-' },
    { title: 'CreatedAt', dataIndex: 'createdAt', key: 'createdAt',
      render: (d) => dayjs(d).format('YYYY-MM-DD') },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            disabled={!hasScope(admin.role, 'users.write')}
            onClick={() => startEdit(record)}
          >
            Edit
          </Button>
          <Button
            size="small"
            danger
            disabled={!hasScope(admin.role, 'users.write')}
            onClick={() => confirmDelete(record)}
          >
            Delete
          </Button>
        </div>
      )
    }
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys)
  }

  function openAddCreditsModal() {
    setAddCreditsOpen(true)
  }

  function confirmAddCredits() {
    selectedRowKeys.forEach(id => addCredits(String(id), addCreditsAmount, admin.id, addCreditsReason))
    setAddCreditsOpen(false)
    setSelectedRowKeys([])
    setAddCreditsReason('')
  }

  function startEdit(user: User) {
    setEditingUser(user)
    editForm.setFieldsValue({
      plan: user.plan,
      credits_total: user.credits_total,
      credits_find: user.credits_find,
      credits_verify: user.credits_verify
    })
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editingUser) return
    const values = await editForm.validateFields()
    updateUser(editingUser.id, {
      plan: values.plan,
      credits_total: Number(values.credits_total),
      credits_find: Number(values.credits_find),
      credits_verify: Number(values.credits_verify)
    })
    setEditOpen(false)
    setEditingUser(null)
    editForm.resetFields()
  }

  function confirmDelete(user: User) {
    Modal.confirm({
      title: 'Delete user',
      content: `Are you sure you want to delete ${user.full_name}?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: () => deleteUser(user.id)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Users</Typography.Title>

      <Card>
        <Form layout={isMobile ? 'vertical' : 'inline'} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: '100%' }}>
          <Form.Item label="Plan">
            <Select
              allowClear
              style={{ width: isMobile ? '100%' : 160 }}
              options={['free', 'pro', 'agency', 'lifetime'].map(p => ({ value: p, label: p }))}
              value={filters.plan}
              onChange={(v) => setFilters(f => ({ ...f, plan: v }))}
            />
          </Form.Item>
          <Form.Item label="Email verified">
            <Select
              allowClear
              style={{ width: isMobile ? '100%' : 160 }}
              options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]}
              value={filters.email_verified as any}
              onChange={(v) => setFilters(f => ({ ...f, email_verified: v }))}
            />
          </Form.Item>
          <Form.Item label="Subscription">
            <Select
              allowClear
              style={{ width: isMobile ? '100%' : 180 }}
              options={['active', 'cancelled', 'past_due', 'none'].map(s => ({ value: s, label: s }))}
              value={filters.subscription_status}
              onChange={(v) => setFilters(f => ({ ...f, subscription_status: v }))}
            />
          </Form.Item>
          <Form.Item label="Country">
            <Input
              placeholder="Country code"
              value={filters.country}
              onChange={(e) => setFilters(f => ({ ...f, country: e.target.value.toUpperCase() }))}
              style={{ width: isMobile ? '100%' : 200 }}
            />
          </Form.Item>
          <Form.Item label="Created range">
            <DatePicker.RangePicker
              value={[
                filters.createdFrom ? dayjs(filters.createdFrom) : null,
                filters.createdTo ? dayjs(filters.createdTo) : null
              ] as any}
              onChange={(range) => {
                setFilters(f => ({
                  ...f,
                  createdFrom: range && range[0] ? range[0].startOf('day').toISOString() : undefined,
                  createdTo: range && range[1] ? range[1].endOf('day').toISOString() : undefined
                }))
              }}
              style={{ width: isMobile ? '100%' : 280 }}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <Button
            type="primary"
            disabled={!hasScope(admin.role, 'credits.adjust') || selectedRowKeys.length === 0}
            onClick={openAddCreditsModal}
          >
            Add credits (bulk)
          </Button>
        </div>
        <Table<User>
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 10 }}
          rowSelection={rowSelection}
          scroll={{ x: 'max-content' }}
          size="small"
        />
      </Card>

      <Modal
        title="Add credits (bulk)"
        open={addCreditsOpen}
        onOk={confirmAddCredits}
        onCancel={() => setAddCreditsOpen(false)}
        okButtonProps={{ disabled: !addCreditsReason }}
      >
        <Typography.Paragraph type="secondary">
          Credit adjustments always require a reason and generate an audit row.
        </Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item label="Credits to add" required>
            <Input type="number" value={addCreditsAmount} onChange={(e) => setAddCreditsAmount(Number(e.target.value))} />
          </Form.Item>
          <Form.Item label="Reason" required>
            <Input.TextArea value={addCreditsReason} onChange={(e) => setAddCreditsReason(e.target.value)} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Edit user"
        open={editOpen}
        onOk={saveEdit}
        onCancel={() => { setEditOpen(false); setEditingUser(null); editForm.resetFields() }}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="plan" label="Plan" rules={[{ required: true }]}> 
            <Select
              options={[
                { value: 'free', label: 'Free' },
                { value: 'pro', label: 'Pro' },
                { value: 'agency', label: 'Agency' },
                { value: 'lifetime', label: 'Lifetime' }
              ]}
            />
          </Form.Item>
          <Form.Item name="credits_total" label="Available Credits" rules={[{ required: true }]}> 
            <Input type="number" />
          </Form.Item>
          <Form.Item name="credits_verify" label="Verification Credits" rules={[{ required: true }]}> 
            <Input type="number" />
          </Form.Item>
          <Form.Item name="credits_find" label="Find Credits" rules={[{ required: true }]}> 
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
