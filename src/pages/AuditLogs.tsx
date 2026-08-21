import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import axios from 'axios'
import { toast } from 'sonner'
import { Copy, OctagonX, RotateCw, ScrollText } from 'lucide-react'
import type { DateRange as RdpRange } from 'react-day-picker'

import { api } from '../utils/api'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'
import EmptyState from '../components/EmptyState'
import { DataTable, type DataTableColumn } from '../components/global/data-table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

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

const ANY = '__any__'

/**
 * Action badge variant. The previous version mapped actions onto Antd's named
 * colours (blue/green/purple/cyan), which sat outside the palette entirely.
 * Destructive actions are the only ones that earn colour here; the action
 * string itself carries the meaning.
 */
function actionVariant(action: string): 'secondary' | 'destructive' | 'outline' {
  if (action === 'users.delete' || action === 'apikey.revoke' || action.endsWith('.delete')) {
    return 'destructive'
  }
  if (action.startsWith('credits.') || action.startsWith('apikey.')) return 'secondary'
  return 'outline'
}

function copyToClipboard(value: string) {
  if (!value) return
  navigator.clipboard
    ?.writeText(value)
    .then(() => toast.success('Copied'))
    .catch(() => toast.error('Copy failed'))
}

/** Real button, so the copy affordance is keyboard reachable and announced. */
function MonoIdCell({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const short = `${value.slice(0, 6)}…${value.slice(-4)}`
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(value)}
      title={`${value} (click to copy)`}
      aria-label={`Copy ID ${value}`}
      className="group/copy -mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 font-mono text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {short}
      <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover/copy:opacity-60 group-focus-visible/copy:opacity-60" />
    </button>
  )
}

function MetadataCell({ metadata }: { metadata?: Record<string, unknown> }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  const full = JSON.stringify(metadata)
  const truncated = full.length > 60 ? `${full.slice(0, 60)}…` : full
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Show metadata"
            className="-mx-1 max-w-[22rem] truncate rounded-md px-1 py-0.5 text-left font-mono text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        {truncated}
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-[32rem] p-0">
        <div className="border-b px-3 py-2 text-xs font-medium">Metadata</div>
        <pre className="mf-scroll-thin max-h-80 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </PopoverContent>
    </Popover>
  )
}

export default function AuditLogs() {
  const [pendingRange, setPendingRange] = useState<RdpRange | undefined>(undefined)
  const [pendingAction, setPendingAction] = useState<string | undefined>(undefined)
  const [pendingTargetType, setPendingTargetType] = useState<
    'user' | 'apikey' | 'content' | undefined
  >(undefined)
  const [pendingAdminId, setPendingAdminId] = useState<string>('')
  const [pendingTargetId, setPendingTargetId] = useState<string>('')

  const [applied, setApplied] = useState<AppliedFilters>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [rows, setRows] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* Param whitelist and the ObjectId guards are unchanged. */
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
        (axios.isAxiosError(e) && (e.response?.data as { message?: string })?.message) ||
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
    if (pendingRange?.from) next.from = dayjs(pendingRange.from).startOf('day').toISOString()
    if (pendingRange?.to) next.to = dayjs(pendingRange.to).endOf('day').toISOString()
    if (pendingAction) next.action = pendingAction
    if (pendingTargetType) next.targetType = pendingTargetType
    if (pendingAdminId.trim()) {
      if (!OBJECT_ID_RE.test(pendingAdminId.trim())) {
        toast.warning('Admin ID must be a 24-character hex string — ignoring')
      } else {
        next.adminId = pendingAdminId.trim()
      }
    }
    if (pendingTargetId.trim()) {
      if (!OBJECT_ID_RE.test(pendingTargetId.trim())) {
        toast.warning('Target ID must be a 24-character hex string — ignoring')
      } else {
        next.targetId = pendingTargetId.trim()
      }
    }
    setPage(1)
    setApplied(next)
  }

  const onReset = () => {
    setPendingRange(undefined)
    setPendingAction(undefined)
    setPendingTargetType(undefined)
    setPendingAdminId('')
    setPendingTargetId('')
    setPage(1)
    setApplied({})
  }

  const columns: DataTableColumn<AuditRow>[] = useMemo(
    () => [
      {
        key: 'timestamp',
        title: 'Time',
        width: 190,
        render: (row) =>
          row.timestamp ? (
            <span className="whitespace-nowrap">
              {dayjs(row.timestamp).format('MMM D, YYYY h:mm A')}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
      },
      {
        key: 'action',
        title: 'Action',
        width: 180,
        render: (row) => (
          <Badge variant={actionVariant(row.action)} className="font-mono">
            {row.action}
          </Badge>
        )
      },
      {
        key: 'targetType',
        title: 'Target type',
        width: 120,
        hideOnMobile: true,
        render: (row) => row.targetType ?? <span className="text-muted-foreground">—</span>
      },
      {
        key: 'targetId',
        title: 'Target ID',
        width: 150,
        hideOnMobile: true,
        render: (row) => <MonoIdCell value={row.targetId} />
      },
      {
        key: 'adminId',
        title: 'Admin ID',
        width: 150,
        hideOnMobile: true,
        render: (row) => <MonoIdCell value={row.adminId} />
      },
      {
        key: 'reason',
        title: 'Reason',
        render: (row) => row.reason ?? <span className="text-muted-foreground">—</span>
      },
      {
        key: 'metadata',
        title: 'Metadata',
        hideOnMobile: true,
        render: (row) => <MetadataCell metadata={row.metadata} />
      }
    ],
    []
  )

  const hasFilters = Object.keys(applied).length > 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Audit & Basic Logs"
        subtitle={
          total > 0
            ? `${total.toLocaleString()} recorded actions`
            : 'Every privileged admin action, recorded'
        }
        actions={
          <Button variant="outline" onClick={fetchAudits} disabled={loading}>
            <RotateCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        }
      />

      <SectionCard title="Filters" description="Server-side. IDs must be 24-character hex strings.">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="grid gap-1.5">
              <Label htmlFor="audit-range">Date range</Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button id="audit-range" variant="outline" className="justify-start font-normal" />
                  }
                >
                  {pendingRange?.from ? (
                    <span className="truncate">
                      {dayjs(pendingRange.from).format('MMM D')}
                      {pendingRange.to ? ` – ${dayjs(pendingRange.to).format('MMM D, YYYY')}` : ''}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Any time</span>
                  )}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={pendingRange}
                    onSelect={setPendingRange}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="audit-action">Action</Label>
              <Select
                value={pendingAction ?? ANY}
                onValueChange={(v) => setPendingAction(!v || v === ANY ? undefined : v)}
              >
                <SelectTrigger id="audit-action" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any action</SelectItem>
                  {ACTION_OPTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="audit-target-type">Target type</Label>
              <Select
                value={pendingTargetType ?? ANY}
                onValueChange={(v) =>
                  setPendingTargetType(
                    !v || v === ANY ? undefined : (v as 'user' | 'apikey' | 'content')
                  )
                }
              >
                <SelectTrigger id="audit-target-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any type</SelectItem>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="apikey">apikey</SelectItem>
                  <SelectItem value="content">content</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="audit-admin-id">Admin ID</Label>
              <Input
                id="audit-admin-id"
                className="font-mono text-xs"
                placeholder="24-char hex"
                value={pendingAdminId}
                onChange={(e) => setPendingAdminId(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="audit-target-id">Target ID</Label>
              <Input
                id="audit-target-id"
                className="font-mono text-xs"
                placeholder="24-char hex"
                value={pendingTargetId}
                onChange={(e) => setPendingTargetId(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={onApply}>Apply filters</Button>
            <Button variant="outline" onClick={onReset}>
              Reset
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Scoped to the results, NOT the whole page. The previous version
          replaced the filter form with the error state, so a query that failed
          because of a bad filter could only be retried, never corrected. */}
      {error && (
        <Alert variant="destructive">
          <OctagonX />
          <AlertTitle>Couldn’t load audit logs</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <SectionCard title="Log entries" noPadding>
        <DataTable<AuditRow>
          caption="Audit log entries"
          rowKey="id"
          rows={rows}
          columns={columns}
          loading={loading}
          size="sm"
          pagination={{
            page,
            pageSize,
            total,
            onChange: (nextPage, nextSize) => {
              if (nextSize !== pageSize) {
                setPageSize(nextSize)
                setPage(1)
              } else {
                setPage(nextPage)
              }
            }
          }}
          empty={
            <EmptyState
              compact
              icon={<ScrollText />}
              title={hasFilters ? 'No audit entries match these filters' : 'No audit entries yet'}
              hint={
                hasFilters
                  ? 'Widen the time range or reset the filters above.'
                  : 'Privileged admin actions will appear here as they happen.'
              }
              action={
                hasFilters ? (
                  <Button variant="outline" size="sm" onClick={onReset}>
                    Reset filters
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </SectionCard>
    </div>
  )
}
