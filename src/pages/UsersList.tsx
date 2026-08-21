import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { DateRange as RdpRange } from 'react-day-picker'
import { Loader2, OctagonX, RotateCw, Search, Users as UsersIcon } from 'lucide-react'

import { useDataStore } from '../store/data'
import { PLAN_DISPLAY_NAME, User } from '../types/types'
import { PLAN_ORDER, planBadgeStyle, planDotStyle, planRowAccent } from '../ui/planTheme'
import { mapUser } from '../utils/mappers'
import { API_BASE_URL, api } from '../utils/api'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'
import EmptyState from '../components/EmptyState'
import { DataTable, type DataTableColumn } from '../components/global/data-table'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'
import { cn } from '@/lib/utils'
import { Alert, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
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
import { Textarea } from '@/components/ui/textarea'

const ALL = 'all'
type SubStatus = 'active' | 'cancelled' | 'past_due' | 'none'
const SUB_STATUSES: SubStatus[] = ['active', 'cancelled', 'past_due', 'none']

/**
 * Subscription status badge.
 *
 * The previous implementation had a per-status palette for light mode and then
 * a SINGLE grey for every status in dark mode, so `active` and `cancelled` were
 * indistinguishable on the default theme. These differ by fill and hue in both
 * themes, and the status word is always printed alongside.
 */
const STATUS_CLASS: Record<SubStatus, string> = {
  active: 'border-primary/25 bg-primary/12 text-primary',
  past_due: 'border-destructive/25 bg-destructive/12 text-destructive',
  cancelled: 'border-border bg-muted text-muted-foreground',
  none: 'border-border bg-transparent text-muted-foreground'
}

function StatusBadge({ status }: { status?: string }) {
  const key = (SUB_STATUSES as string[]).includes(String(status)) ? (status as SubStatus) : 'none'
  return <Badge className={cn('font-normal', STATUS_CLASS[key])}>{status ?? 'none'}</Badge>
}

/* Hoisted to module scope. It used to be declared inside the render body with
 * its own useState, giving it a new component identity on every parent render —
 * so every plan badge unmounted and remounted on any state change. */
function PlanBadge({ plan }: { plan: User['plan'] }) {
  return (
    <Badge className="border-transparent" style={planBadgeStyle(plan)}>
      {PLAN_DISPLAY_NAME[plan] ?? plan}
    </Badge>
  )
}

const editSchema = z.object({
  plan: z.enum(['free', 'monthly', 'lifetime', 'payg']),
  payg_balance: z.coerce.number().min(0, 'Must be zero or more'),
  email_verified: z.boolean(),
  country: z.string().max(2, 'Use an ISO-2 code'),
  admin_notes: z.string()
})
/* z.coerce gives a schema whose INPUT type differs from its OUTPUT type (the
 * form field holds a string, the parsed value is a number). RHF models that
 * with a third generic, so both are named explicitly rather than collapsed. */
type EditInput = z.input<typeof editSchema>
type EditValues = z.output<typeof editSchema>

const creditsSchema = z.object({
  amount: z.coerce.number().int('Whole credits only'),
  reason: z.string().min(1, 'A reason is required')
})
type CreditsInput = z.input<typeof creditsSchema>
type CreditsValues = z.output<typeof creditsSchema>

export default function UsersList() {
  const { users, setAll } = useDataStore()
  const { admin, token, logout } = useAuthStore()
  const navigate = useNavigate()
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<User['plan'] | 'all'>('all')

  // Local-page client-side filters (narrow the current server page only)
  const [filters, setFilters] = useState<{
    email_verified?: boolean | 'all'
    subscription_status?: SubStatus | 'all'
    country?: string
    createdFrom?: string
    createdTo?: string
  }>(() => ({ email_verified: 'all', subscription_status: 'all' }))
  const [createdRange, setCreatedRange] = useState<RdpRange | undefined>(undefined)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)

  const [addCreditsOpen, setAddCreditsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<User | null>(null)
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<Set<string>>(new Set())

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editFormApi = useForm<EditInput, unknown, EditValues>({
    resolver: zodResolver(editSchema)
  })
  const creditsFormApi = useForm<CreditsInput, unknown, CreditsValues>({
    resolver: zodResolver(creditsSchema),
    defaultValues: { amount: 100, reason: '' }
  })

  const canWrite = hasScope(admin.role, 'users.write')
  const canAdjustCredits = hasScope(admin.role, 'credits.adjust')

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
      const body = res.data as { data?: unknown[]; total?: number }
      const source = Array.isArray(body?.data) ? body.data : []
      setAll({ users: source.map(mapUser) })
      // Paginated mode returns total; legacy mode returns just data.
      if (typeof body?.total === 'number') {
        setTotal(body.total)
      } else {
        setTotal(source.length)
      }
    } catch (e: unknown) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      if (status === 401) {
        // Interceptor already attempted refresh and failed → log out.
        logout()
        navigate('/login', { replace: true })
        return
      }
      const msg =
        (axios.isAxiosError(e) && (e.response?.data as { message?: string })?.message) ||
        (e instanceof Error ? e.message : 'Failed to load users')
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

  const reloadUsersFresh = useCallback(async () => {
    await fetchUsers()
  }, [fetchUsers])

  // Client-side filters narrow the current server page only.
  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (
        filters.email_verified !== undefined &&
        filters.email_verified !== 'all' &&
        u.email_verified !== filters.email_verified
      )
        return false
      if (
        filters.subscription_status &&
        filters.subscription_status !== 'all' &&
        u.subscription_status !== filters.subscription_status
      )
        return false
      if (filters.country && u.country !== filters.country) return false
      if (filters.createdFrom && !dayjs(u.createdAt).isAfter(dayjs(filters.createdFrom)))
        return false
      if (filters.createdTo && !dayjs(u.createdAt).isBefore(dayjs(filters.createdTo))) return false
      return true
    })
  }, [users, filters])

  /* Payload shape, endpoint, headers and status branches are unchanged from the
   * Antd version. */
  async function confirmAddCredits(values: CreditsValues) {
    const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
    if (!bearer) {
      logout()
      navigate('/login', { replace: true })
      return
    }
    const payload = {
      userIds: selectedRowKeys.map((id) => String(id)),
      delta: Number(values.amount),
      // Backend translates any bucket value to payg_balance and keeps it
      // for audit only. Hardcode 'find' for compat with the existing API.
      bucket: 'find' as const,
      reason: values.reason
    }
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/userManagement/credits-adjust-bulk`,
        payload,
        {
          headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
          validateStatus: () => true
        }
      )
      if (res.status === 200 && res.data?.success) {
        await reloadUsersFresh()
        setAddCreditsOpen(false)
        setSelectedRowKeys([])
        creditsFormApi.reset({ amount: 100, reason: '' })
        toast.success('Credits adjusted')
        return
      }
      if (res.status === 401) {
        logout()
        navigate('/login', { replace: true })
        return
      }
      toast.error(res.data?.message || `HTTP ${res.status}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Request failed')
    }
  }

  function startEdit(user: User) {
    setEditingUser(user)
    editFormApi.reset({
      plan: user.plan,
      payg_balance: Number(user.balances?.payg ?? user.payg_balance ?? 0),
      email_verified: !!user.email_verified,
      country: user.country ?? '',
      admin_notes: user.admin_notes ?? ''
    })
    setEditOpen(true)
  }

  /* The diff-patch builder below is carried over verbatim: only fields that
   * actually changed go into the PATCH body, and `credits_find` is still the
   * key the backend expects for "set payg_balance to N". */
  async function saveEdit(values: EditValues) {
    if (!editingUser) return
    const patch: Record<string, unknown> = {}
    const nextPlan = String(values.plan ?? '').toLowerCase()
    if (nextPlan && nextPlan !== editingUser.plan) {
      if ((['free', 'monthly', 'lifetime', 'payg'] as string[]).includes(nextPlan)) {
        patch.plan = nextPlan
      }
    }
    const currentPayg = Number(editingUser.balances?.payg ?? editingUser.payg_balance ?? 0)
    const nextPayg = Number(values.payg_balance)
    if (!Number.isNaN(nextPayg) && nextPayg !== currentPayg) {
      patch.credits_find = Math.max(0, nextPayg)
    }
    if (
      typeof values.email_verified === 'boolean' &&
      values.email_verified !== editingUser.email_verified
    ) {
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
      return
    }

    const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
    const url = `${API_BASE_URL}/api/admin/userManagement/users/${editingUser.id}`
    try {
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
          setAll({ users: users.map((orig) => (orig.id === updated.id ? updated : orig)) })
          setRecentlyUpdatedIds((prev) => new Set([...prev, updated.id]))
          setTimeout(() => {
            setRecentlyUpdatedIds((prev) => {
              const next = new Set([...prev])
              next.delete(updated.id)
              return next
            })
          }, 1200)
        }
        await reloadUsersFresh()
        setEditOpen(false)
        setEditingUser(null)
        toast.success('User updated')
        return
      }
      if (res.status === 401) {
        logout()
        navigate('/login', { replace: true })
        return
      }
      if (res.status === 404) {
        toast.error('User not found')
        return
      }
      if (res.status === 400) {
        /* Server field errors are pushed back onto the form. RHF's setError
         * does natively what the Antd version hand-rolled with setFields.
         * `credits_find` is the wire name for the payg_balance field. */
        const errBody = res.data
        const fieldErrors: Record<string, unknown> = errBody?.errors || errBody?.data?.errors || {}
        const FIELD_MAP: Record<string, keyof EditInput> = {
          credits_find: 'payg_balance',
          plan: 'plan',
          email_verified: 'email_verified',
          country: 'country',
          admin_notes: 'admin_notes'
        }
        let mapped = 0
        Object.keys(fieldErrors).forEach((name) => {
          const field = FIELD_MAP[name]
          if (field) {
            editFormApi.setError(field, { message: String(fieldErrors[name]) })
            mapped += 1
          }
        })
        const msg = errBody?.message || errBody?.error || ''
        if (msg) toast.error(String(msg))
        else if (!mapped) toast.error('The server rejected those values')
        return
      }
      toast.error(`HTTP ${res.status}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  async function confirmDelete() {
    const user = pendingDelete
    if (!user) return
    setPendingDelete(null)
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
        toast.success('User deleted')
        return
      }
      if (res.status === 404) {
        setAll({ users: users.filter((u) => u.id !== user.id) })
        toast.success('User already deleted')
        return
      }
      if (res.status === 401) {
        logout()
        navigate('/login', { replace: true })
        return
      }
      toast.error(res.data?.message || `HTTP ${res.status}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setDeletingId(undefined)
    }
  }

  const columns: DataTableColumn<User>[] = useMemo(
    () => [
      {
        key: 'name',
        title: 'Name',
        render: (u) => (
          <button
            type="button"
            onClick={() => navigate(`/users/${u.id}`)}
            className="-mx-1 truncate rounded-md px-1 py-0.5 text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {u.full_name || '—'}
          </button>
        )
      },
      { key: 'email', title: 'Email', dataIndex: 'email' },
      { key: 'plan', title: 'Plan', width: 150, render: (u) => <PlanBadge plan={u.plan} /> },
      {
        key: 'available_credits',
        title: 'Credits',
        align: 'right',
        width: 120,
        sorter: (a, b) => Number(a.available_credits ?? 0) - Number(b.available_credits ?? 0),
        render: (u) => (
          <span className="tabular-nums">{Number(u.available_credits ?? 0).toLocaleString()}</span>
        )
      },
      {
        key: 'subscription_status',
        title: 'Subscription',
        width: 140,
        render: (u) => <StatusBadge status={u.subscription?.status ?? u.subscription_status} />
      },
      {
        key: 'lastSeen',
        title: 'Last seen',
        width: 130,
        hideOnMobile: true,
        render: (u) => (
          <span className="text-muted-foreground">
            {u.lastSeen ? dayjs(u.lastSeen).format('YYYY-MM-DD') : '—'}
          </span>
        )
      },
      {
        key: 'createdAt',
        title: 'Created',
        width: 130,
        hideOnMobile: true,
        render: (u) => (
          <span className="text-muted-foreground">{dayjs(u.createdAt).format('YYYY-MM-DD')}</span>
        )
      },
      {
        key: 'actions',
        title: 'Actions',
        // This table always scrolls horizontally, which otherwise pushed
        // Edit/Delete off the right edge.
        fixed: 'right',
        width: 150,
        render: (u) => (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" disabled={!canWrite} onClick={() => startEdit(u)}>
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!canWrite || deletingId === u.id}
              onClick={() => setPendingDelete(u)}
            >
              {deletingId === u.id && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </div>
        )
      }
    ],
    // startEdit is stable enough for this table's lifetime; it only reads refs
    // and setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canWrite, deletingId, navigate]
  )

  const activeFilterCount =
    (filters.email_verified !== 'all' ? 1 : 0) +
    (filters.subscription_status !== 'all' ? 1 : 0) +
    (filters.country ? 1 : 0) +
    (filters.createdFrom || filters.createdTo ? 1 : 0) +
    (planFilter !== 'all' ? 1 : 0) +
    (debouncedSearch ? 1 : 0)

  function resetFilters() {
    setSearch('')
    setPlanFilter('all')
    setFilters({ email_verified: 'all', subscription_status: 'all' })
    setCreatedRange(undefined)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Users"
        subtitle={
          total > 0
            ? `${total.toLocaleString()} users on the platform`
            : 'Manage accounts, plans and credits'
        }
        actions={
          <Button variant="outline" onClick={reloadUsersFresh} disabled={loading}>
            <RotateCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Button>
        }
      />

      {backendError && (
        <Alert variant="destructive">
          <OctagonX />
          <AlertTitle>{backendError}</AlertTitle>
        </Alert>
      )}

      <SectionCard
        title="Filters"
        description="Search and plan hit the server; the rest narrow the current page."
        extra={
          activeFilterCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear {activeFilterCount}
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="grid gap-1.5 sm:col-span-2 xl:col-span-1">
            <Label htmlFor="users-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="users-search"
                className="pl-8"
                placeholder="Email or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="users-plan">Plan</Label>
            <Select
              value={planFilter}
              onValueChange={(v) => setPlanFilter((v || ALL) as User['plan'] | 'all')}
            >
              <SelectTrigger id="users-plan" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All plans</SelectItem>
                {PLAN_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={planDotStyle(p)}
                        aria-hidden="true"
                      />
                      {PLAN_DISPLAY_NAME[p]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="users-verified">Email verified</Label>
            <Select
              value={
                filters.email_verified === 'all' || filters.email_verified === undefined
                  ? ALL
                  : String(filters.email_verified)
              }
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  email_verified: !v || v === ALL ? 'all' : v === 'true'
                }))
              }
            >
              <SelectTrigger id="users-verified" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                <SelectItem value="true">Verified</SelectItem>
                <SelectItem value="false">Not verified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="users-sub">Subscription</Label>
            <Select
              value={filters.subscription_status ?? ALL}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  subscription_status: !v || v === ALL ? 'all' : (v as SubStatus)
                }))
              }
            >
              <SelectTrigger id="users-sub" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {SUB_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="users-country">Country</Label>
            <Input
              id="users-country"
              placeholder="ISO-2 code"
              maxLength={2}
              value={filters.country ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value.toUpperCase() }))}
            />
          </div>

          <div className="grid gap-1.5 sm:col-span-2 xl:col-span-1">
            <Label htmlFor="users-created">Created range</Label>
            <Popover>
              <PopoverTrigger
                render={
                  <Button id="users-created" variant="outline" className="justify-start font-normal" />
                }
              >
                {createdRange?.from ? (
                  <span className="truncate">
                    {dayjs(createdRange.from).format('MMM D, YYYY')}
                    {createdRange.to ? ` – ${dayjs(createdRange.to).format('MMM D, YYYY')}` : ''}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Any time</span>
                )}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={createdRange}
                  onSelect={(range) => {
                    setCreatedRange(range)
                    setFilters((f) => ({
                      ...f,
                      createdFrom: range?.from
                        ? dayjs(range.from).startOf('day').toISOString()
                        : undefined,
                      createdTo: range?.to ? dayjs(range.to).endOf('day').toISOString() : undefined
                    }))
                  }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
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
            disabled={!canAdjustCredits || selectedRowKeys.length === 0}
            onClick={() => setAddCreditsOpen(true)}
          >
            Add credits (bulk)
          </Button>
        }
        noPadding
      >
        <DataTable<User>
          caption="All users"
          rowKey="id"
          rows={filtered}
          columns={columns}
          loading={loading}
          size="sm"
          skeletonRows={8}
          selection={{ selectedKeys: selectedRowKeys, onChange: setSelectedRowKeys }}
          rowStyle={(u) => planRowAccent(u.plan)}
          rowClassName={(u) => (recentlyUpdatedIds.has(u.id) ? 'mf-row-flash' : undefined)}
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
              icon={<UsersIcon />}
              title="No users match these filters"
              hint="Clear the search or widen the filters above."
              action={
                activeFilterCount > 0 ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </SectionCard>

      {/* Bulk credits */}
      <Dialog open={addCreditsOpen} onOpenChange={setAddCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add credits (bulk)</DialogTitle>
            <DialogDescription>
              Applies to {selectedRowKeys.length} selected{' '}
              {selectedRowKeys.length === 1 ? 'user' : 'users'}. Adjustments always require a reason
              and generate an audit row.
            </DialogDescription>
          </DialogHeader>

          <form
            id="bulk-credits-form"
            onSubmit={creditsFormApi.handleSubmit(confirmAddCredits)}
            className="grid gap-4"
            noValidate
          >
            <div className="grid gap-1.5">
              <Label htmlFor="credits-amount">Credits to add</Label>
              <Input
                id="credits-amount"
                type="number"
                aria-invalid={!!creditsFormApi.formState.errors.amount}
                {...creditsFormApi.register('amount')}
              />
              <p className="text-xs text-muted-foreground">A negative value subtracts.</p>
              {creditsFormApi.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {creditsFormApi.formState.errors.amount.message}
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="credits-reason">Reason</Label>
              <Textarea
                id="credits-reason"
                rows={3}
                aria-invalid={!!creditsFormApi.formState.errors.reason}
                {...creditsFormApi.register('reason')}
              />
              {creditsFormApi.formState.errors.reason && (
                <p className="text-xs text-destructive">
                  {creditsFormApi.formState.errors.reason.message}
                </p>
              )}
            </div>
          </form>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCreditsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="bulk-credits-form"
              disabled={creditsFormApi.formState.isSubmitting}
            >
              {creditsFormApi.formState.isSubmitting && <Loader2 className="animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o)
          if (!o) setEditingUser(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>{editingUser?.email}</DialogDescription>
          </DialogHeader>

          <form
            id="edit-user-form"
            onSubmit={editFormApi.handleSubmit(saveEdit)}
            className="grid gap-4"
            noValidate
          >
            <div className="grid gap-1.5">
              <Label htmlFor="edit-plan">Plan</Label>
              <Select
                value={editFormApi.watch('plan')}
                onValueChange={(v) =>
                  v && editFormApi.setValue('plan', v as EditInput['plan'], { shouldDirty: true })
                }
              >
                <SelectTrigger id="edit-plan" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_ORDER.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={planDotStyle(p)}
                          aria-hidden="true"
                        />
                        {PLAN_DISPLAY_NAME[p]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editFormApi.formState.errors.plan && (
                <p className="text-xs text-destructive">
                  {editFormApi.formState.errors.plan.message}
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-payg">PAYG credits</Label>
              <Input
                id="edit-payg"
                type="number"
                min={0}
                aria-invalid={!!editFormApi.formState.errors.payg_balance}
                {...editFormApi.register('payg_balance')}
              />
              <p className="text-xs text-muted-foreground">
                Sets the user’s PAYG balance. Other buckets are managed by billing.
              </p>
              {editFormApi.formState.errors.payg_balance && (
                <p className="text-xs text-destructive">
                  {editFormApi.formState.errors.payg_balance.message}
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-verified">Email verified</Label>
              <Select
                value={String(editFormApi.watch('email_verified'))}
                onValueChange={(v) =>
                  editFormApi.setValue('email_verified', v === 'true', { shouldDirty: true })
                }
              >
                <SelectTrigger id="edit-verified" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-country">Country</Label>
              <Input
                id="edit-country"
                maxLength={2}
                placeholder="ISO-2 country code"
                aria-invalid={!!editFormApi.formState.errors.country}
                {...editFormApi.register('country')}
              />
              {editFormApi.formState.errors.country && (
                <p className="text-xs text-destructive">
                  {editFormApi.formState.errors.country.message}
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-notes">Admin notes</Label>
              <Textarea id="edit-notes" rows={3} {...editFormApi.register('admin_notes')} />
            </div>
          </form>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-user-form" disabled={editFormApi.formState.isSubmitting}>
              {editFormApi.formState.isSubmitting && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {pendingDelete?.full_name || pendingDelete?.email}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
