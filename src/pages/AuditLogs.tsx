import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Grid,
  Input,
  Popover,
  Result,
  Row,
  Col,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import axios from 'axios'
import { api } from '../utils/api'

interface AuditRow {
  id: string
  adminId: string
  action: string
  targetId: string
  targetType?: 'user' | 'apikey' | 'content'
  reason?: string
  metadata?: Record<string, unknown>
  timestamp: string
}

interface AuditsResponse {
  success: boolean
  data: AuditRow[]
  total: number
  page: number
  pageSize: number
}

interface AppliedFilters {
  from?: string
  to?: string
  action?: string
  targetType?: 'user' | 'apikey' | 'content'
  adminId?: string
  targetId?: string
}

const ACTION_OPTIONS = [
  'credits.adjust',
  'notes.update',
  'users.delete',
  'content.create',
  'content.update',
  'content.publish',
  'content.unpublish',
  'content.delete',
  'apikey.create',
  'apikey.revoke'
]

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

function actionTagColor(action: string): string {
  if (action.startsWith('credits.')) return 'blue'
  if (action.startsWith('content.')) return 'green'
  if (action === 'users.delete' || action === 'apikey.revoke') return 'red'
  if (action === 'apikey.create') return 'purple'
  if (action === 'notes.update') return 'cyan'
  return 'default'
}

function copyToClipboard(value: string) {
  if (!value) return
  navigator.clipboard
    ?.writeText(value)
    .then(() => message.success('Copied'))
    .catch(() => message.error('Copy failed'))
}

function MonoIdCell({ value }: { value?: string }) {
  if (!value) return <Typography.Text type="secondary">-</Typography.Text>
  const short = `${value.slice(0, 6)}…${value.slice(-4)}`
  return (
    <Typography.Text
      code
      copyable={false}
      onClick={() => copyToClipboard(value)}
      style={{ cursor: 'pointer', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
      title={`${value} (click to copy)`}
    >
      {short}
    </Typography.Text>
  )
}

function MetadataCell({ metadata }: { metadata?: Record<string, unknown> }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return <Typography.Text type="secondary">-</Typography.Text>
  }
  const full = JSON.stringify(metadata)
  const truncated = full.length > 80 ? `${full.slice(0, 80)}…` : full
  return (
    <Popover
      title="Metadata"
      content={
        <pre
          style={{
            maxWidth: 480,
            maxHeight: 320,
            overflow: 'auto',
            margin: 0,
            fontSize: 12,
            whiteSpace: 'pre-wrap'
          }}
        >
          {JSON.stringify(metadata, null, 2)}
        </pre>
      }
      trigger="hover"
    >
      <Typography.Text style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
        {truncated}
      </Typography.Text>
    </Popover>
  )
}

export default function AuditLogs() {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const [pendingRange, setPendingRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [pendingAction, setPendingAction] = useState<string | undefined>(undefined)
  const [pendingTargetType, setPendingTargetType] = useState<'user' | 'apikey' | 'content' | undefined>(undefined)
  const [pendingAdminId, setPendingAdminId] = useState<string>('')
  const [pendingTargetId, setPendingTargetId] = useState<string>('')

  const [applied, setApplied] = useState<AppliedFilters>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [rows, setRows] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAudits = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params: Record<string, string | number> = { page, pageSize }
    if (applied.from) params.from = applied.from
    if (applied.to) params.to = applied.to
    if (applied.action) params.action = applied.action
    if (applied.targetType) params.targetType = applied.targetType
    if (applied.adminId && OBJECT_ID_RE.test(applied.adminId)) params.adminId = applied.adminId
    if (applied.targetId && OBJECT_ID_RE.test(applied.targetId)) params.targetId = applied.targetId

    try {
      const res = await api.get<AuditsResponse>('/api/admin/userManagement/audits', { params })
      const body = res.data
      setRows(Array.isArray(body?.data) ? body.data : [])
      setTotal(Number.isFinite(body?.total) ? body.total : 0)
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      if (status === 401) {
        // axios interceptor handles refresh + logout; just blank the table.
        setRows([])
        setTotal(0)
        return
      }
      const msg =
        (axios.isAxiosError(e) && (e.response?.data as any)?.message) ||
        (e instanceof Error ? e.message : 'Failed to load audit logs')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [applied, page, pageSize])

  useEffect(() => {
    fetchAudits()
  }, [fetchAudits])

  const onApply = () => {
    const next: AppliedFilters = {}
    if (pendingRange?.[0]) next.from = pendingRange[0].startOf('day').toISOString()
    if (pendingRange?.[1]) next.to = pendingRange[1].endOf('day').toISOString()
    if (pendingAction) next.action = pendingAction
    if (pendingTargetType) next.targetType = pendingTargetType
    if (pendingAdminId.trim()) {
      if (!OBJECT_ID_RE.test(pendingAdminId.trim())) {
        message.warning('Admin ID must be a 24-character hex string — ignoring')
      } else {
        next.adminId = pendingAdminId.trim()
      }
    }
    if (pendingTargetId.trim()) {
      if (!OBJECT_ID_RE.test(pendingTargetId.trim())) {
        message.warning('Target ID must be a 24-character hex string — ignoring')
      } else {
        next.targetId = pendingTargetId.trim()
      }
    }
    setPage(1)
    setApplied(next)
  }

  const onReset = () => {
    setPendingRange(null)
    setPendingAction(undefined)
    setPendingTargetType(undefined)
    setPendingAdminId('')
    setPendingTargetId('')
    setPage(1)
    setApplied({})
  }

  const columns: ColumnsType<AuditRow> = useMemo(
    () => [
      {
        title: 'Time',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 200,
        render: (t: string) => (t ? dayjs(t).format('MMM D, YYYY h:mm A') : '-')
      },
      {
        title: 'Action',
        dataIndex: 'action',
        key: 'action',
        width: 180,
        render: (a: string) => <Tag color={actionTagColor(a)}>{a}</Tag>
      },
      {
        title: 'Target Type',
        dataIndex: 'targetType',
        key: 'targetType',
        width: 120,
        render: (t?: string) => t ?? <Typography.Text type="secondary">-</Typography.Text>
      },
      {
        title: 'Target ID',
        dataIndex: 'targetId',
        key: 'targetId',
        width: 160,
        render: (v: string) => <MonoIdCell value={v} />
      },
      {
        title: 'Admin ID',
        dataIndex: 'adminId',
        key: 'adminId',
        width: 160,
        render: (v: string) => <MonoIdCell value={v} />
      },
      {
        title: 'Reason',
        dataIndex: 'reason',
        key: 'reason',
        render: (r?: string) => r ?? <Typography.Text type="secondary">-</Typography.Text>
      },
      {
        title: 'Metadata',
        dataIndex: 'metadata',
        key: 'metadata',
        render: (m?: Record<string, unknown>) => <MetadataCell metadata={m} />
      }
    ],
    []
  )

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    pageSizeOptions: ['25', '50', '100', '200'],
    showTotal: (t) => `Total ${t}`
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>Audit & Basic Logs</Typography.Title>
        </div>
        <Card>
          <Result
            status="error"
            title="Failed to load audit logs"
            subTitle={error}
            extra={
              <Button type="primary" onClick={fetchAudits}>
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Audit & Basic Logs</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={fetchAudits} loading={loading}>
          Refresh
        </Button>
      </div>

      <Card>
        <Form layout="vertical">
          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              <Form.Item label="Time range" style={{ marginBottom: 0 }}>
                <DatePicker.RangePicker
                  value={pendingRange as any}
                  onChange={(v) => setPendingRange(v as any)}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item label="Action" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  value={pendingAction}
                  onChange={(v) => setPendingAction(v)}
                  placeholder="All"
                  options={ACTION_OPTIONS.map((a) => ({ value: a, label: a }))}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Target type" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  value={pendingTargetType}
                  onChange={(v) => setPendingTargetType(v)}
                  placeholder="All"
                  options={[
                    { value: 'user', label: 'user' },
                    { value: 'apikey', label: 'apikey' },
                    { value: 'content', label: 'content' }
                  ]}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={7}>
              <Form.Item label="Admin ID" style={{ marginBottom: 0 }}>
                <Input
                  placeholder="24-char ObjectId"
                  value={pendingAdminId}
                  onChange={(e) => setPendingAdminId(e.target.value)}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={7}>
              <Form.Item label="Target ID" style={{ marginBottom: 0 }}>
                <Input
                  placeholder="24-char ObjectId"
                  value={pendingTargetId}
                  onChange={(e) => setPendingTargetId(e.target.value)}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={17} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
              <Space>
                <Button onClick={onReset}>Reset</Button>
                <Button type="primary" onClick={onApply}>Apply</Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card>
        <Table<AuditRow>
          rowKey="id"
          dataSource={rows}
          columns={columns}
          loading={loading}
          pagination={pagination}
          scroll={{ x: 'max-content' }}
          size="small"
          locale={{
            emptyText: <Empty description="No audit entries match these filters" />
          }}
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
    </div>
  )
}
