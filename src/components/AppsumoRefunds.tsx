import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Table, Tag, Tooltip, Typography, message } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { ReloadOutlined, RollbackOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import { api } from '../utils/api'
import SectionCard from './SectionCard'
import EmptyState from './EmptyState'

interface RefundRow {
  licenseKey: string
  tier: number | null
  refundedAt: string | null
  status: 'refunded'
  userId: string | null
  userFullName: string
  userEmail: string
  /** "deleted": the account is gone. "not_activated": refunded before redemption. */
  userState: 'ok' | 'deleted' | 'not_activated'
  /**
   * Paid for this licence, including earlier keys in its upgrade chain. Null
   * when no purchase record matched; absent from older backends.
   */
  amountPaid?: number | null
  currency?: string | null
}

interface ListResponse {
  success: boolean
  data: RefundRow[]
  total: number
  page: number
  pageSize: number
}

function copyToClipboard(text: string) {
  if (!text) return
  navigator.clipboard
    ?.writeText(text)
    .then(() => message.success('Copied'))
    .catch(() => message.error('Copy failed'))
}

function formatMoney(amount: number, currency?: string | null): string {
  const code = (currency || 'USD').toUpperCase()
  const digits = Number.isInteger(amount) ? 0 : 2
  const value = amount.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
  // "$49" like the rest of the panel; spell out anything that isn't USD.
  return code === 'USD' ? `$${value}` : `${code} ${value}`
}

/**
 * AppSumo licences that were refunded (deactivated by AppSumo, not replaced
 * by an upgrade). Server-paginated and searchable, the same way the API Keys
 * list is; the backend derives every row from its existing licence and event
 * records.
 */
export default function AppsumoRefunds() {
  const [rows, setRows] = useState<RefundRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The endpoint ships with a backend release; until that is live the panel
  // must say so rather than show a scary error.
  const [unavailable, setUnavailable] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Typing fires several requests; only the newest may write to the table, or
  // a slow earlier response lands last and shows results for an old query.
  const requestSeq = useRef(0)

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      // The API ignores 1-character searches (minLength 2), so don't send them.
      const next = search.trim()
      setDebouncedSearch(next.length >= 2 ? next : '')
      setPage(1)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search])

  const fetchRefunds = useCallback(async () => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError(null)
    const params: Record<string, string | number> = { page, pageSize }
    if (debouncedSearch) params.search = debouncedSearch
    try {
      const res = await api.get<ListResponse>('/api/admin/appsumo/refunds', { params })
      if (seq !== requestSeq.current) return
      const body = res.data
      setRows(Array.isArray(body?.data) ? body.data : [])
      setTotal(Number.isFinite(body?.total) ? body.total : 0)
      setUnavailable(false)
    } catch (e) {
      if (seq !== requestSeq.current) return
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      if (status === 401) {
        setRows([])
        setTotal(0)
        return
      }
      if (status === 404) {
        setUnavailable(true)
        setRows([])
        setTotal(0)
        return
      }
      const msg =
        (axios.isAxiosError(e) && (e.response?.data as any)?.message) ||
        (e instanceof Error ? e.message : 'Failed to load refunds')
      setError(msg)
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [debouncedSearch, page, pageSize])

  useEffect(() => {
    fetchRefunds()
  }, [fetchRefunds])

  const columns: ColumnsType<RefundRow> = useMemo(
    () => [
      {
        title: 'User name',
        dataIndex: 'userFullName',
        key: 'userFullName',
        render: (name: string, row) => {
          if (row.userState === 'deleted') {
            return <span className="mf-cell-muted">Deleted account</span>
          }
          if (row.userState === 'not_activated') {
            return (
              <Tooltip title="Refunded before the buyer connected a MailsFinder account">
                <span className="mf-cell-muted">Not activated</span>
              </Tooltip>
            )
          }
          return row.userId ? (
            <Link to={`/users/${row.userId}`} className="mf-cell-stack__primary">
              {name || '—'}
            </Link>
          ) : (
            <span className="mf-cell-stack__primary">{name || '—'}</span>
          )
        }
      },
      {
        title: 'Email',
        dataIndex: 'userEmail',
        key: 'userEmail',
        render: (email: string) =>
          email ? <span className="mf-cell-strong">{email}</span> : <span className="mf-cell-muted">—</span>
      },
      {
        title: 'AppSumo tier',
        dataIndex: 'tier',
        key: 'tier',
        width: 130,
        render: (tier: number | null) =>
          tier ? <Tag className="mf-range-tag">Tier {tier}</Tag> : <span className="mf-cell-muted">Unknown</span>
      },
      {
        title: 'License key',
        dataIndex: 'licenseKey',
        key: 'licenseKey',
        render: (key: string) =>
          key ? (
            <Typography.Text
              code
              onClick={() => copyToClipboard(key)}
              style={{ cursor: 'pointer', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
              title={`${key} (click to copy)`}
            >
              {key}
            </Typography.Text>
          ) : (
            <span className="mf-cell-muted">—</span>
          )
      },
      {
        title: 'Amount paid',
        dataIndex: 'amountPaid',
        key: 'amountPaid',
        align: 'right' as const,
        width: 130,
        render: (amount: number | null | undefined, row) =>
          amount == null ? (
            <Tooltip title="No AppSumo purchase record matched this licence">
              <span className="mf-cell-muted">—</span>
            </Tooltip>
          ) : (
            <Tooltip title="What the buyer paid, including earlier upgrade steps. The amount AppSumo refunded may differ.">
              <span className="mf-num">{formatMoney(amount, row.currency)}</span>
            </Tooltip>
          )
      },
      {
        title: 'Refund date',
        dataIndex: 'refundedAt',
        key: 'refundedAt',
        width: 130,
        render: (value: string | null) =>
          value ? (
            <Tooltip title={`${dayjs(value).format('MMM D, YYYY HH:mm')} · ${dayjs(value).fromNow()}`}>
              <span className="mf-cell-strong">{dayjs(value).format('MMM D, YYYY')}</span>
            </Tooltip>
          ) : (
            <span className="mf-cell-muted">—</span>
          )
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: () => <Tag color="red">Refunded</Tag>
      }
    ],
    []
  )

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    pageSizeOptions: ['25', '50', '100'],
    showTotal: t => `Total ${t}`,
    size: 'small'
  }

  return (
    <SectionCard
      title="Refunded users"
      description="AppSumo licences that were refunded. Licences retired by an upgrade are not refunds and are not listed."
      noPadding
    >
      <div className="mf-refunds__toolbar">
        <Input.Search
          placeholder="Search name, email or licence key"
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          className="mf-refunds__search"
        />
        <Button icon={<ReloadOutlined />} onClick={fetchRefunds} loading={loading} aria-label="Refresh refunds" />
      </div>
      {unavailable ? (
        <EmptyState
          compact
          icon={<RollbackOutlined />}
          title="Refund data isn't available yet"
          hint="The server doesn't have the refunds endpoint yet. It appears here once the backend update is deployed."
        />
      ) : error && rows.length === 0 ? (
        <EmptyState
          compact
          icon={<RollbackOutlined />}
          title="Failed to load refunds"
          hint={error}
          action={
            <Button type="primary" icon={<ReloadOutlined />} onClick={fetchRefunds}>
              Retry
            </Button>
          }
        />
      ) : (
        <Table<RefundRow>
          className="mf-table"
          rowKey="licenseKey"
          dataSource={rows}
          columns={columns}
          loading={loading}
          pagination={total > pageSize || page > 1 ? pagination : false}
          scroll={{ x: 'max-content' }}
          size="middle"
          locale={{
            emptyText: (
              <EmptyState
                compact
                icon={<RollbackOutlined />}
                title={debouncedSearch ? 'No refunds match your search' : 'No refunded licences'}
                hint={debouncedSearch ? 'Try a different name, email or licence key.' : 'Refunds from AppSumo will appear here.'}
              />
            )
          }}
          onChange={p => {
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
      )}
    </SectionCard>
  )
}
