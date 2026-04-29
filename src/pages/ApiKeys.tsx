import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import axios from 'axios'
import { api } from '../utils/api'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'

interface AdminApiKeyRow {
  _id: string
  userId: string
  userEmail?: string
  userFullName?: string
  apiKey?: string
  keyPrefix: string
  isActive: boolean
  lastUsedAt?: string
  usageCount?: number
  createdAt: string
  updatedAt?: string
}

interface ListResponse {
  success: boolean
  data: AdminApiKeyRow[]
  total: number
  page: number
  pageSize: number
}

interface CreateResponse {
  success: boolean
  data: {
    _id: string
    userId: string
    apiKey: string
    keyPrefix: string
    isActive: boolean
    createdAt: string
  }
}

interface UserOption {
  value: string
  label: string
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active only' },
  { value: 'revoked', label: 'Revoked only' }
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

function copyToClipboard(text: string) {
  if (!text) return
  navigator.clipboard
    ?.writeText(text)
    .then(() => message.success('Copied'))
    .catch(() => message.error('Copy failed'))
}

function MonoCell({ value, fullOnCopy = true }: { value?: string; fullOnCopy?: boolean }) {
  if (!value) return <Typography.Text type="secondary">-</Typography.Text>
  return (
    <Typography.Text
      code
      onClick={() => copyToClipboard(fullOnCopy ? value : value)}
      style={{ cursor: 'pointer', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
      title={`${value} (click to copy)`}
    >
      {value}
    </Typography.Text>
  )
}

export default function ApiKeys() {
  const { admin } = useAuthStore()
  const canManage = hasScope(admin.role, 'apikeys.manage')

  const [rows, setRows] = useState<AdminApiKeyRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createUserId, setCreateUserId] = useState<string | undefined>(undefined)
  const [createName, setCreateName] = useState<string>('')
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)

  const [revealKey, setRevealKey] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const userSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search])

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params: Record<string, string | number> = { page, pageSize }
    if (debouncedSearch) params.search = debouncedSearch
    if (statusFilter === 'active') params.isActive = 'true'
    if (statusFilter === 'revoked') params.isActive = 'false'
    try {
      const res = await api.get<ListResponse>('/api/admin/apikeys', { params })
      const body = res.data
      setRows(Array.isArray(body?.data) ? body.data : [])
      setTotal(Number.isFinite(body?.total) ? body.total : 0)
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      if (status === 401) {
        setRows([])
        setTotal(0)
        return
      }
      const msg =
        (axios.isAxiosError(e) && (e.response?.data as any)?.message) ||
        (e instanceof Error ? e.message : 'Failed to load API keys')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, page, pageSize])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  const onUserSearch = (value: string) => {
    if (userSearchTimer.current) clearTimeout(userSearchTimer.current)
    if (!value || value.length < 1) {
      setUserOptions([])
      return
    }
    userSearchTimer.current = setTimeout(async () => {
      setUserSearchLoading(true)
      try {
        const res = await api.get('/api/admin/userManagement/getAllUsers', {
          params: { page: 1, pageSize: 10, search: value }
        })
        const list = Array.isArray((res.data as any)?.data) ? (res.data as any).data : []
        setUserOptions(
          list.map((u: any) => ({
            value: String(u._id ?? u.id),
            label: `${u.full_name ?? u.name ?? '(no name)'} <${u.email ?? '?'}>`
          }))
        )
      } catch {
        setUserOptions([])
      } finally {
        setUserSearchLoading(false)
      }
    }, 300)
  }

  const onCreateSubmit = async () => {
    if (!createUserId) {
      message.warning('Pick a user')
      return
    }
    setCreating(true)
    try {
      const body: { userId: string; name?: string } = { userId: createUserId }
      const trimmedName = createName.trim()
      if (trimmedName) body.name = trimmedName.slice(0, 64)
      const res = await api.post<CreateResponse>('/api/admin/apikeys', body)
      const apiKey = res.data?.data?.apiKey
      if (!apiKey) {
        message.error('Backend did not return the created key')
        return
      }
      setCreateOpen(false)
      setCreateUserId(undefined)
      setCreateName('')
      setUserOptions([])
      setRevealKey(apiKey)
      await fetchKeys()
    } catch (e) {
      const msg =
        (axios.isAxiosError(e) && (e.response?.data as any)?.message) ||
        (e instanceof Error ? e.message : 'Failed to create API key')
      message.error(msg)
    } finally {
      setCreating(false)
    }
  }

  const onRevoke = async (row: AdminApiKeyRow) => {
    setRevokingId(row._id)
    try {
      await api.delete(`/api/admin/apikeys/${row._id}`)
      message.success('API key revoked')
      await fetchKeys()
    } catch (e) {
      const msg =
        (axios.isAxiosError(e) && (e.response?.data as any)?.message) ||
        (e instanceof Error ? e.message : 'Revoke failed')
      message.error(msg)
    } finally {
      setRevokingId(null)
    }
  }

  const columns: ColumnsType<AdminApiKeyRow> = useMemo(
    () => [
      {
        title: 'Key Prefix',
        dataIndex: 'keyPrefix',
        key: 'keyPrefix',
        width: 180,
        render: (v: string) => <MonoCell value={v} />
      },
      {
        title: 'Owner',
        key: 'owner',
        render: (_, row) => (
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <Typography.Text>{row.userEmail || '-'}</Typography.Text>
            {row.userFullName && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.userFullName}
              </Typography.Text>
            )}
          </div>
        )
      },
      {
        title: 'Status',
        dataIndex: 'isActive',
        key: 'isActive',
        width: 120,
        render: (active: boolean) =>
          active ? <Tag color="green">Active</Tag> : <Tag color="red">Revoked</Tag>
      },
      {
        title: 'Created',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 140,
        render: (d: string) => (d ? dayjs(d).format('MMM D, YYYY') : '-')
      },
      {
        title: 'Last Used',
        dataIndex: 'lastUsedAt',
        key: 'lastUsedAt',
        width: 160,
        render: (d?: string) => (d ? dayjs(d).format('MMM D, YYYY h:mm A') : '-')
      },
      {
        title: 'Usage',
        dataIndex: 'usageCount',
        key: 'usageCount',
        width: 90,
        render: (n?: number) => (typeof n === 'number' ? n : 0)
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 140,
        render: (_, row) => (
          <Popconfirm
            title="Revoke this API key?"
            description="This cannot be undone."
            okText="Revoke"
            okButtonProps={{ danger: true }}
            onConfirm={() => onRevoke(row)}
            disabled={!canManage || !row.isActive}
          >
            <Button
              danger
              size="small"
              disabled={!canManage || !row.isActive}
              loading={revokingId === row._id}
            >
              Revoke
            </Button>
          </Popconfirm>
        )
      }
    ],
    [canManage, revokingId]
  )

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    pageSizeOptions: ['25', '50', '100', '200'],
    showTotal: (t) => `Total ${t}`
  }

  if (error && rows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>API Keys</Typography.Title>
        <Card>
          <Result
            status="error"
            title="Failed to load API keys"
            subTitle={error}
            extra={<Button type="primary" onClick={fetchKeys}>Retry</Button>}
          />
        </Card>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>API Keys</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchKeys} loading={loading}>
            Refresh
          </Button>
          <Button
            type="primary"
            disabled={!canManage}
            onClick={() => setCreateOpen(true)}
          >
            Create
          </Button>
        </Space>
      </div>

      <Card>
        <Space wrap>
          <Input.Search
            placeholder="Search by email, name, or key prefix"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 320 }}
          />
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            options={STATUS_FILTERS as unknown as { value: StatusFilter; label: string }[]}
            style={{ width: 160 }}
          />
        </Space>
      </Card>

      <Card>
        <Table<AdminApiKeyRow>
          rowKey="_id"
          dataSource={rows}
          columns={columns}
          loading={loading}
          pagination={pagination}
          scroll={{ x: 'max-content' }}
          size="small"
          locale={{ emptyText: <Empty description="No API keys" /> }}
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
        />
      </Card>

      <Modal
        title="Create API Key"
        open={createOpen}
        onCancel={() => {
          if (creating) return
          setCreateOpen(false)
          setCreateUserId(undefined)
          setCreateName('')
          setUserOptions([])
        }}
        onOk={onCreateSubmit}
        confirmLoading={creating}
        okText="Create"
        className="mf-modal"
      >
        <Form layout="vertical">
          <Form.Item label="User" required>
            <Select
              showSearch
              placeholder="Type a name or email..."
              value={createUserId}
              onChange={(v) => setCreateUserId(v)}
              onSearch={onUserSearch}
              filterOption={false}
              loading={userSearchLoading}
              options={userOptions}
              notFoundContent={userSearchLoading ? 'Searching…' : 'No matches'}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="Name (optional)"
            help="Internal label, max 64 chars"
          >
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value.slice(0, 64))}
              placeholder="e.g. Mobile app integration"
              maxLength={64}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="API Key created"
        open={!!revealKey}
        onCancel={() => setRevealKey(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setRevealKey(null)}>
            Done
          </Button>
        ]}
        className="mf-modal"
      >
        <Alert
          type="warning"
          showIcon
          message="Save this key now"
          description="For security, it won't be shown again here."
          style={{ marginBottom: 12 }}
        />
        <div
          style={{
            background: 'rgba(0,0,0,0.04)',
            padding: 12,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <Typography.Text
            code
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              wordBreak: 'break-all'
            }}
          >
            {revealKey}
          </Typography.Text>
          <Button
            icon={<CopyOutlined />}
            onClick={() => revealKey && copyToClipboard(revealKey)}
          >
            Copy
          </Button>
        </div>
      </Modal>
    </div>
  )
}
