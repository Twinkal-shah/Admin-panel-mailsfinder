import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '../store/data'
import { Button, Card, Form, Input, Modal, Select, Table, Tag, Typography, DatePicker, Grid, Alert, Skeleton, message, theme } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { User } from '../types/types'
import { PLAN_COLORS, badgeStyles, rowAccentStyle } from '../ui/planTheme'
import dayjs from 'dayjs'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function UsersList() {
  const { users, addCredits, updateUser, setAll } = useDataStore()
  const { admin, token, logout } = useAuthStore()
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [filters, setFilters] = useState<{
    plan?: 'free' | 'pro' | 'agency' | 'lifetime' | 'all'
    email_verified?: boolean | 'all'
    subscription_status?: 'active' | 'cancelled' | 'past_due' | 'none' | 'all'
    country?: string
    createdFrom?: string
    createdTo?: string
  }>(() => ({ plan: 'all', email_verified: 'all', subscription_status: 'all' }))
  const [addCreditsOpen, setAddCreditsOpen] = useState(false)
  const [addCreditsAmount, setAddCreditsAmount] = useState<number>(100)
  const [addCreditsReason, setAddCreditsReason] = useState<string>('')
  const [addCreditsBucket, setAddCreditsBucket] = useState<'find' | 'verify'>('find')
  const [editOpen, setEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm] = Form.useForm()
  const [loading, setLoading] = useState<boolean>(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined)
  const [addCreditsConfirming, setAddCreditsConfirming] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setBackendError(null)
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://server.mailsfinder.com')
        const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
        if (!bearer) {
          setLoading(false)
          logout()
          navigate('/login', { replace: true })
          return
        }
        const res = await axios.get(`${API_BASE_URL}/api/admin/userManagement/getAllUsers`, {
          headers: {
            Authorization: `Bearer ${bearer}`
          },
          params: { ts: Date.now() }
        })
        if (cancelled) return
        const source = Array.isArray(res.data?.data) ? res.data.data : []
        const mapped: User[] = source.map((u: any) => {
          const planRaw = String(u.plan ?? 'free').toLowerCase()
          const plan: User['plan'] =
            planRaw === 'pro' || planRaw === 'agency' || planRaw === 'lifetime' ? (planRaw as User['plan']) : 'free'
          const subscription_status: User['subscription_status'] = plan === 'free' ? 'none' : 'active'
          const credits_find = Number(u.credits_find ?? 0)
          const credits_verify = Number(u.credits_verify ?? 0)
          const credits_total = Number(u.credits ?? credits_find + credits_verify)
          return {
            id: String(u._id ?? u.id),
            full_name: String(u.full_name ?? u.name ?? ''),
            email: String(u.email ?? ''),
            phone: u.phone ?? undefined,
            country: u.country ?? undefined,
            onboarding_flag: typeof u.onboarding_flag === 'boolean' ? u.onboarding_flag : undefined,
            createdAt: (u.createdAt && new Date(u.createdAt).toISOString()) || new Date().toISOString(),
            lastSeen: (u.lastSeen && new Date(u.lastSeen).toISOString()) || undefined,
            plan,
            credits_total,
            credits_find,
            credits_verify,
            subscription_status,
            email_verified: !!u.email_verified,
            admin_notes: u.admin_notes ?? undefined
          }
        })
        setAll({ users: mapped })
      } catch (e: any) {
        const status = e?.response?.status
        if (status === 401) {
          setLoading(false)
          logout()
          navigate('/login', { replace: true })
          return
        }
        const msg = e?.response?.data?.message || e?.message || 'Failed to load users'
        setAll({ users: [] })
        setBackendError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [setAll])

  async function reloadUsersFresh() {
    setLoading(true)
    setBackendError(null)
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://server.mailsfinder.com')
      const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
      if (!bearer) {
        setLoading(false)
        logout()
        navigate('/login', { replace: true })
        return
      }
      const res = await axios.get(`${API_BASE_URL}/api/admin/userManagement/getAllUsers`, {
        headers: {
          Authorization: `Bearer ${bearer}`
        },
        params: { ts: Date.now() }
      })
      const source = Array.isArray(res.data?.data) ? res.data.data : []
      const mapped: User[] = source.map((u: any) => {
        const planRaw = String(u.plan ?? 'free').toLowerCase()
        const plan: User['plan'] =
          planRaw === 'pro' || planRaw === 'agency' || planRaw === 'lifetime' ? (planRaw as User['plan']) : 'free'
        const subscription_status: User['subscription_status'] = plan === 'free' ? 'none' : 'active'
        const credits_find = Number(u.credits_find ?? 0)
        const credits_verify = Number(u.credits_verify ?? 0)
        const credits_total = Number(u.credits ?? credits_find + credits_verify)
        return {
          id: String(u._id ?? u.id),
          full_name: String(u.full_name ?? u.name ?? ''),
          email: String(u.email ?? ''),
          phone: u.phone ?? undefined,
          country: u.country ?? undefined,
          onboarding_flag: typeof u.onboarding_flag === 'boolean' ? u.onboarding_flag : undefined,
          createdAt: (u.createdAt && new Date(u.createdAt).toISOString()) || new Date().toISOString(),
          lastSeen: (u.lastSeen && new Date(u.lastSeen).toISOString()) || undefined,
          plan,
          credits_total,
          credits_find,
          credits_verify,
          subscription_status,
          email_verified: !!u.email_verified,
          admin_notes: u.admin_notes ?? undefined
        }
      })
      setAll({ users: mapped })
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 401) {
        setLoading(false)
        logout()
        navigate('/login', { replace: true })
        return
      }
      const msg = e?.response?.data?.message || e?.message || 'Failed to load users'
      setBackendError(msg)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filters.plan && filters.plan !== 'all' && u.plan !== filters.plan) return false
      if (filters.email_verified !== undefined && filters.email_verified !== 'all' && u.email_verified !== filters.email_verified) return false
      if (filters.subscription_status && filters.subscription_status !== 'all' && u.subscription_status !== filters.subscription_status) return false
      if (filters.country && u.country !== filters.country) return false
      if (filters.createdFrom && !dayjs(u.createdAt).isAfter(dayjs(filters.createdFrom))) return false
      if (filters.createdTo && !dayjs(u.createdAt).isBefore(dayjs(filters.createdTo))) return false
      return true
    })
  }, [users, filters])

  function PlanBadge({ plan }: { plan: User['plan'] }) {
    const s = badgeStyles(plan as any, isDarkMode)
    const [hover, setHover] = useState(false)
    return (
      <Tag
        style={{
          borderRadius: 999,
          background: s.bg,
          color: s.text,
          border: `1.5px solid ${s.border}`,
          boxShadow: hover ? s.hoverShadow : 'none'
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {plan}
      </Tag>
    )
  }

  const columns: ColumnsType<User> = [
    { title: 'Name', dataIndex: 'full_name', key: 'name',
      render: (text, record) => <Button type="link" onClick={() => navigate(`/users/${record.id}`)}>{text}</Button>
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Plan',
      dataIndex: 'plan',
      key: 'plan',
      render: (plan) => <PlanBadge plan={plan} />
    },
    { title: 'Credits (total)', dataIndex: 'credits_total', key: 'credits_total' },
    { title: 'Credits find', dataIndex: 'credits_find', key: 'credits_find' },
    { title: 'Credits verify', dataIndex: 'credits_verify', key: 'credits_verify' },
    {
      title: 'Subscription status',
      dataIndex: 'subscription_status',
      key: 'subscription_status',
      render: (s) => (
        (() => {
          const stylesLight: Record<User['subscription_status'], { bg: string; text: string; border: string }> = {
            active: { bg: '#ecfdf5', text: '#065f46', border: '#d1fae5' },
            cancelled: { bg: '#fef2f2', text: '#7f1d1d', border: '#fee2e2' },
            past_due: { bg: '#fff7ed', text: '#9a3412', border: '#ffedd5' },
            none: { bg: '#f5f5f5', text: '#444444', border: '#e5e5e5' }
          }
          const stylesDark = { bg: '#0b0b0d', text: '#d1d5db', border: '#374151' }
          const sConf = isDarkMode ? stylesDark : stylesLight[s as User['subscription_status']]
          return (
            <Tag style={{ borderRadius: 999, background: sConf.bg, color: sConf.text, borderColor: sConf.border }}>
              {s}
            </Tag>
          )
        })()
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
            disabled={!hasScope(admin.role, 'users.write') || deletingId === record.id}
            loading={deletingId === record.id}
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
    ;(async () => {
      try {
        setAddCreditsConfirming(true)
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://server.mailsfinder.com')
        const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
        if (!bearer) {
          logout()
          navigate('/login', { replace: true })
          return
        }
        const payload = {
          userIds: selectedRowKeys.map(id => String(id)),
          delta: Number(addCreditsAmount),
          bucket: addCreditsBucket,
          reason: addCreditsReason
        }
        const res = await axios.post(`${API_BASE_URL}/api/admin/userManagement/credits-adjust-bulk`, payload, {
          headers: {
            Authorization: `Bearer ${bearer}`,
            'Content-Type': 'application/json'
          },
          validateStatus: () => true
        })
        if (res.status === 200 && res.data?.success) {
          await reloadUsersFresh()
          setAddCreditsOpen(false)
          setSelectedRowKeys([])
          setAddCreditsReason('')
          message.success('Credits adjusted')
          return
        }
        if (res.status === 401) {
          logout()
          navigate('/login', { replace: true })
          return
        }
        const msg = res.data?.message || `HTTP ${res.status}`
        message.error(msg)
      } catch (e: any) {
        message.error(e?.message || 'Request failed')
      } finally {
        setAddCreditsConfirming(false)
      }
    })()
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
    try {
      setEditSaving(true)
      const values = await editForm.validateFields()
      const patch: any = {}
      const nextPlan = String(values.plan ?? '').toLowerCase()
      if (nextPlan && nextPlan !== editingUser.plan) {
        if (['free', 'pro', 'agency', 'lifetime'].includes(nextPlan)) {
          patch.plan = nextPlan
        }
      }
      const nextFind = Number(values.credits_find ?? editingUser.credits_find)
      const nextVerify = Number(values.credits_verify ?? editingUser.credits_verify)
      if (!Number.isNaN(nextFind) && nextFind !== editingUser.credits_find) {
        patch.credits_find = Math.max(0, nextFind)
      }
      if (!Number.isNaN(nextVerify) && nextVerify !== editingUser.credits_verify) {
        patch.credits_verify = Math.max(0, nextVerify)
      }
      if (Object.keys(patch).length === 0) {
        setEditOpen(false)
        setEditingUser(null)
        editForm.resetFields()
        return
      }
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://server.mailsfinder.com')
      const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
      const url = `${API_BASE_URL}/api/admin/userManagement/users/${editingUser.id}`
      const res = await axios.patch(url, patch, {
        headers: {
          Authorization: bearer ? `Bearer ${bearer}` : '',
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        validateStatus: () => true
      })
      if (res.status === 200) {
        const u = res.data?.data || res.data
        if (u && (u._id || u.id)) {
          const planRaw = String(u.plan ?? 'free').toLowerCase()
          const plan: User['plan'] =
            planRaw === 'pro' || planRaw === 'agency' || planRaw === 'lifetime' ? (planRaw as User['plan']) : 'free'
          const credits_find = Number(u.credits_find ?? 0)
          const credits_verify = Number(u.credits_verify ?? 0)
          const credits_total = Number(u.credits ?? credits_find + credits_verify)
          const updated: User = {
            id: String(u._id ?? u.id),
            full_name: String(u.full_name ?? u.name ?? ''),
            email: String(u.email ?? ''),
            phone: u.phone ?? undefined,
            country: u.country ?? undefined,
            onboarding_flag: typeof u.onboarding_flag === 'boolean' ? u.onboarding_flag : undefined,
            createdAt: (u.createdAt && new Date(u.createdAt).toISOString()) || new Date().toISOString(),
            lastSeen: (u.lastSeen && new Date(u.lastSeen).toISOString()) || undefined,
            plan,
            credits_total,
            credits_find,
            credits_verify,
            subscription_status: plan === 'free' ? 'none' : 'active',
            email_verified: !!u.email_verified,
            admin_notes: u.admin_notes ?? undefined
          }
          setAll({
            users: users.map(orig => (orig.id === updated.id ? updated : orig))
          })
          setRecentlyUpdatedIds(prev => new Set([...prev, updated.id]))
          setTimeout(() => {
            setRecentlyUpdatedIds(prev => {
              const next = new Set([...prev])
              next.delete(updated.id)
              return next
            })
          }, 1200)
        }
        await reloadUsersFresh()
        setEditOpen(false)
        setEditingUser(null)
        editForm.resetFields()
        message.success('User updated')
        return
      }
      if (res.status === 401) {
        logout()
        navigate('/login', { replace: true })
        return
      }
      if (res.status === 404) {
        message.error('User not found')
        return
      }
      if (res.status === 400) {
        const errBody = res.data
        const fieldErrors: any = errBody?.errors || errBody?.data?.errors || {}
        const msgs: string[] = []
        try {
          const toSet = Object.keys(fieldErrors).map(name => ({
            name,
            errors: [String(fieldErrors[name])]
          }))
          if (toSet.length) editForm.setFields(toSet as any)
        } catch {}
        try {
          const msg = errBody?.message || errBody?.error || ''
          if (msg) msgs.push(String(msg))
        } catch {}
        if (msgs.length) {
          message.error(msgs.join('\n'))
        }
        return
      }
      message.error(`HTTP ${res.status}`)
    } catch (e: any) {
      message.error(e?.message || 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  function confirmDelete(user: User) {
    Modal.confirm({
      title: 'Delete user',
      content: `Are you sure you want to delete ${user.full_name}?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      className: 'modal-danger mf-modal',
      cancelButtonProps: { className: 'modal-cancel' },
      onOk: async () => {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://server.mailsfinder.com')
        const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
        if (!bearer) {
          logout()
          navigate('/login', { replace: true })
          return
        }
        setDeletingId(user.id)
        try {
          const res = await axios.delete(`${API_BASE_URL}/api/admin/userManagement/users/${user.id}`, {
            headers: { Authorization: `Bearer ${bearer}` },
            validateStatus: () => true
          })
          if (res.status === 204) {
            await reloadUsersFresh()
            message.success('User deleted')
            return
          }
          if (res.status === 404) {
            setAll({ users: users.filter(u => u.id !== user.id) })
            message.success('User already deleted')
            return
          }
          if (res.status === 401) {
            logout()
            navigate('/login', { replace: true })
            return
          }
          const msg = res.data?.message || `HTTP ${res.status}`
          message.error(msg)
        } catch (e: any) {
          message.error(e?.message || 'Request failed')
        } finally {
          setDeletingId(undefined)
        }
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={3} style={{ margin: 0 }}>Users</Typography.Title>
      {backendError && <Alert type="error" message={backendError} showIcon />}

      <Card>
        <Form layout={isMobile ? 'vertical' : 'inline'} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: '100%' }}>
          <Form.Item label="Plan">
            <Select
              style={{ width: isMobile ? '100%' : 160 }}
              options={[
                { value: 'all', label: 'All' },
                ...['free', 'pro', 'agency', 'lifetime'].map(p => ({
                  value: p,
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: PLAN_COLORS[p as keyof typeof PLAN_COLORS] }} />
                      <span style={{ color: PLAN_COLORS[p as keyof typeof PLAN_COLORS] }}>{p}</span>
                    </span>
                  )
                }))
              ]}
              value={filters.plan}
              onChange={(v) => setFilters(f => ({ ...f, plan: v }))}
            />
          </Form.Item>
          <Form.Item label="Email verified">
            <Select
              style={{ width: isMobile ? '100%' : 160 }}
              options={[{ value: 'all', label: 'All' }, { value: true, label: 'Yes' }, { value: false, label: 'No' }]}
              value={filters.email_verified}
              onChange={(v) => setFilters(f => ({ ...f, email_verified: v }))}
            />
          </Form.Item>
          <Form.Item label="Subscription">
            <Select
              style={{ width: isMobile ? '100%' : 180 }}
              options={[{ value: 'all', label: 'All' }, ...['active', 'cancelled', 'past_due', 'none'].map(s => ({ value: s, label: s }))]}
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
        {loading && filtered.length === 0 ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <Table<User>
            rowKey="id"
            dataSource={filtered}
            columns={columns}
            pagination={{ pageSize: 10 }}
            rowSelection={rowSelection}
            scroll={{ x: 'max-content' }}
            size="small"
            loading={loading}
            onRow={(record) => ({
              style: rowAccentStyle(record.plan as any, isDarkMode)
            })}
            rowClassName={(record) => {
              const isUpdated = recentlyUpdatedIds.has(record.id)
              return `${isUpdated ? 'row-refresh' : ''} interactive-row`
            }}
          />
        )}
      </Card>

      <Modal
        title="Add credits (bulk)"
        open={addCreditsOpen}
        onOk={confirmAddCredits}
        onCancel={() => setAddCreditsOpen(false)}
        okButtonProps={{ disabled: !addCreditsReason }}
        className="mf-modal"
        confirmLoading={addCreditsConfirming}
      >
        <Typography.Paragraph type="secondary">
          Credit adjustments always require a reason and generate an audit row.
        </Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item label="Bucket" required>
            <Select
              value={addCreditsBucket}
              onChange={(v) => setAddCreditsBucket(v)}
              options={[
                { value: 'find', label: 'Find' },
                { value: 'verify', label: 'Verify' }
              ]}
            />
          </Form.Item>
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
        className="mf-modal"
        confirmLoading={editSaving}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="plan" label="Plan" rules={[{ required: true }]}> 
            <Select
              options={[
                { value: 'free', label: <span style={{ color: PLAN_COLORS.free }}>Free</span> },
                { value: 'pro', label: <span style={{ color: PLAN_COLORS.pro }}>Pro</span> },
                { value: 'agency', label: <span style={{ color: PLAN_COLORS.agency }}>Agency</span> },
                { value: 'lifetime', label: <span style={{ color: PLAN_COLORS.lifetime }}>Lifetime</span> }
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
