import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDataStore } from '../store/data'
import { Button, Form, Input, Modal, Select, Table, Tag, Typography, DatePicker, Grid, Alert, message } from 'antd'
import { ReloadOutlined, TeamOutlined } from '@ant-design/icons'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { PLAN_DISPLAY_NAME, User } from '../types/types'
import { PLAN_COLORS, PLAN_ORDER, badgeStyles, rowAccentStyle } from '../ui/planTheme'
import { mapUser } from '../utils/mappers'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'
import EmptyState from '../components/EmptyState'
import { TableSkeleton } from '../components/skeletons'
import { useIsDark } from '../ui/useIsDark'
import dayjs from 'dayjs'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { api } from '../utils/api'

export default function UsersList() {
  const { users, setAll } = useDataStore()
  const { admin, token, logout } = useAuthStore()
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const isDarkMode = useIsDark()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<User['plan'] | 'all'>('all')

  // Local-page client-side filters (narrow the current server page only)
  const [filters, setFilters] = useState<{
    email_verified?: boolean | 'all'
    subscription_status?: 'active' | 'cancelled' | 'past_due' | 'none' | 'all'
    country?: string
    createdFrom?: string
    createdTo?: string
  }>(() => ({ email_verified: 'all', subscription_status: 'all' }))

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)

  const [addCreditsOpen, setAddCreditsOpen] = useState(false)
  const [addCreditsAmount, setAddCreditsAmount] = useState<number>(100)
  const [addCreditsReason, setAddCreditsReason] = useState<string>('')
  const [editOpen, setEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm] = Form.useForm()
  const [loading, setLoading] = useState<boolean>(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined)
  const [addCreditsConfirming, setAddCreditsConfirming] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<Set<string>>(new Set())

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce the search input.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search])

  // Reset to page 1 when the server-side filters change.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, planFilter])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setBackendError(null)
    try {
      const params: Record<string, string | number> = { page, pageSize }
      if (debouncedSearch) params.search = debouncedSearch
      if (planFilter && planFilter !== 'all') params.plan = planFilter
      const res = await api.get('/api/admin/userManagement/getAllUsers', { params })
      const body: any = res.data
      const source = Array.isArray(body?.data) ? body.data : []
      setAll({ users: source.map(mapUser) })
      // Paginated mode returns total; legacy mode returns just data.
      if (typeof body?.total === 'number') {
        setTotal(body.total)
      } else {
        setTotal(source.length)
      }
    } catch (e: any) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      if (status === 401) {
        // Interceptor already attempted refresh and failed → log out.
        logout()
        navigate('/login', { replace: true })
        return
      }
      const msg = e?.response?.data?.message || e?.message || 'Failed to load users'
      setAll({ users: [] })
      setTotal(0)
      setBackendError(msg)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, planFilter, setAll, logout, navigate])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  async function reloadUsersFresh() {
    await fetchUsers()
  }

  // Client-side filters narrow the current server page only.
  const filtered = useMemo(() => {
    return users.filter(u => {
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
        {PLAN_DISPLAY_NAME[plan]}
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
      key: 'plan',
      render: (_, u) => {
        const status = u.subscription?.status ?? u.subscription_status
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <PlanBadge plan={u.plan} />
            {status && status !== 'none' && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {u.plan} · {status}
              </Typography.Text>
            )}
          </div>
        )
      }
    },
    {
      title: 'Credits',
      dataIndex: 'available_credits',
      key: 'available_credits',
      sorter: (a, b) => Number(a.available_credits ?? 0) - Number(b.available_credits ?? 0),
      render: (_, u) => Number(u.available_credits ?? 0)
    },
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
      // This table always scrolls horizontally (scroll.x = max-content), which
      // otherwise pushed Edit/Delete off the right edge.
      fixed: 'right',
      width: 150,
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
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://api.mailsfinder.com')
        const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
        if (!bearer) {
          logout()
          navigate('/login', { replace: true })
          return
        }
        const payload = {
          userIds: selectedRowKeys.map(id => String(id)),
          delta: Number(addCreditsAmount),
          // Backend translates any bucket value to payg_balance and keeps it
          // for audit only. Hardcode 'find' for compat with the existing API.
          bucket: 'find' as const,
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
      payg_balance: Number(user.balances?.payg ?? user.payg_balance ?? 0),
      email_verified: !!user.email_verified,
      country: user.country ?? '',
      admin_notes: user.admin_notes ?? ''
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
        if ((['free', 'monthly', 'lifetime', 'payg'] as const).includes(nextPlan as any)) {
          patch.plan = nextPlan
        }
      }
      const currentPayg = Number(
        editingUser.balances?.payg ?? editingUser.payg_balance ?? 0
      )
      const nextPayg = Number(values.payg_balance)
      if (!Number.isNaN(nextPayg) && nextPayg !== currentPayg) {
        // Backend translates `credits_find` input to "set payg_balance to N".
        patch.credits_find = Math.max(0, nextPayg)
      }
      if (typeof values.email_verified === 'boolean' && values.email_verified !== editingUser.email_verified) {
        patch.email_verified = values.email_verified
      }
      const nextCountry = String(values.country ?? '').trim()
      if (nextCountry !== (editingUser.country ?? '')) {
        patch.country = nextCountry
      }
      const nextNotes = String(values.admin_notes ?? '')
      if (nextNotes !== (editingUser.admin_notes ?? '')) {
        patch.admin_notes = nextNotes
      }
      if (Object.keys(patch).length === 0) {
        setEditOpen(false)
        setEditingUser(null)
        editForm.resetFields()
        return
      }
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://api.mailsfinder.com')
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
          const updated = mapUser(u)
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
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://api.mailsfinder.com')
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
    <div className="mf-page">
      <PageHeader
        title="Users"
        subtitle={total > 0 ? `${total.toLocaleString()} users on the platform` : 'Manage accounts, plans and credits'}
        actions={
          <Button icon={<ReloadOutlined />} onClick={reloadUsersFresh} loading={loading}>
            Refresh
          </Button>
        }
      />
      {backendError && <Alert type="error" message={backendError} showIcon />}

      <SectionCard title="Filters" description="Search hits the server; the rest narrow the current page.">
        <div style={{ marginBottom: 14 }}>
          <Input.Search
            placeholder="Search by email or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ maxWidth: 360, width: '100%' }}
          />
        </div>
        <Form layout={isMobile ? 'vertical' : 'inline'} className="mf-filters">
          <Form.Item label="Plan">
            <Select
              style={{ width: isMobile ? '100%' : 160 }}
              options={[
                { value: 'all', label: 'All' },
                ...PLAN_ORDER.map(p => ({
                  value: p,
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: PLAN_COLORS[p] }} />
                      <span style={{ color: PLAN_COLORS[p] }}>{PLAN_DISPLAY_NAME[p]}</span>
                    </span>
                  )
                }))
              ]}
              value={planFilter}
              onChange={(v) => setPlanFilter(v)}
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
      </SectionCard>

      <SectionCard
        title="All users"
        description={
          selectedRowKeys.length > 0
            ? `${selectedRowKeys.length} selected`
            : 'Select rows to adjust credits in bulk'
        }
        extra={
          <Button
            type="primary"
            disabled={!hasScope(admin.role, 'credits.adjust') || selectedRowKeys.length === 0}
            onClick={openAddCreditsModal}
          >
            Add credits (bulk)
          </Button>
        }
        noPadding
      >
        {loading && filtered.length === 0 ? (
          <div className="mf-card__body-pad">
            <TableSkeleton rows={8} cols={6} />
          </div>
        ) : (
          <Table<User>
            className="mf-table"
            rowKey="id"
            dataSource={filtered}
            columns={columns}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: ['25', '50', '100', '200'],
              showTotal: (t) => `Total ${t}`
            } as TablePaginationConfig}
            onChange={(p) => {
              const nextPage = p.current ?? 1
              const nextSize = p.pageSize ?? pageSize
              if (nextSize !== pageSize) {
                setPageSize(nextSize)
                setPage(1)
              } else {
                setPage(nextPage)
              }
            }}
            rowSelection={rowSelection}
            scroll={{ x: 'max-content' }}
            size="small"
            loading={loading}
            locale={{
              emptyText: (
                <EmptyState
                  compact
                  icon={<TeamOutlined />}
                  title="No users match these filters"
                  hint="Clear the search or widen the filters above."
                />
              )
            }}
            onRow={(record) => ({
              style: rowAccentStyle(record.plan as any, isDarkMode)
            })}
            rowClassName={(record) => {
              const isUpdated = recentlyUpdatedIds.has(record.id)
              return `${isUpdated ? 'row-refresh' : ''} interactive-row`
            }}
          />
        )}
      </SectionCard>

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
          <Form.Item label="Credits to add (negative subtracts)" required>
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
              options={PLAN_ORDER.map(p => ({
                value: p,
                label: <span style={{ color: PLAN_COLORS[p] }}>{PLAN_DISPLAY_NAME[p]}</span>
              }))}
            />
          </Form.Item>
          <Form.Item
            name="payg_balance"
            label="PAYG credits"
            tooltip="Sets the user's payg_balance bucket. Other buckets are managed by billing."
          >
            <Input type="number" min={0} />
          </Form.Item>
          <Form.Item name="email_verified" label="Email verified">
            <Select
              options={[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' }
              ]}
            />
          </Form.Item>
          <Form.Item name="country" label="Country">
            <Input maxLength={2} placeholder="ISO-2 country code" />
          </Form.Item>
          <Form.Item name="admin_notes" label="Admin notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
