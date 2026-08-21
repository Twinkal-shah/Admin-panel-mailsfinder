import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import {
  Check,
  ChevronsUpDown,
  Copy,
  KeyRound,
  Loader2,
  OctagonX,
  RotateCw,
  Search,
  TriangleAlert
} from 'lucide-react'

import { api } from '../utils/api'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'
import EmptyState from '../components/EmptyState'
import { DataTable, type DataTableColumn } from '../components/global/data-table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
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
    .then(() => toast.success('Copied'))
    .catch(() => toast.error('Copy failed'))
}

/**
 * Click-to-copy monospace cell. A real <button>, so it is keyboard reachable
 * and announced — previously this was an onClick on a text span with no role,
 * tabindex or accessible name.
 */
function MonoCell({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(value)}
      title={`${value} (click to copy)`}
      aria-label={`Copy ${value}`}
      className="group/copy -mx-1 inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 font-mono text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="truncate">{value}</span>
      <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover/copy:opacity-60 group-focus-visible/copy:opacity-60" />
    </button>
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
  const [createUserLabel, setCreateUserLabel] = useState<string>('')
  const [createName, setCreateName] = useState<string>('')
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [userPickerOpen, setUserPickerOpen] = useState(false)

  const [revealKey, setRevealKey] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [pendingRevoke, setPendingRevoke] = useState<AdminApiKeyRow | null>(null)

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
        (axios.isAxiosError(e) && (e.response?.data as { message?: string })?.message) ||
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
        const raw = (res.data as { data?: unknown })?.data
        const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
        setUserOptions(
          list.map((u) => ({
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

  function resetCreateForm() {
    setCreateUserId(undefined)
    setCreateUserLabel('')
    setCreateName('')
    setUserOptions([])
  }

  const onCreateSubmit = async () => {
    if (!createUserId) {
      toast.warning('Pick a user')
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
        toast.error('Backend did not return the created key')
        return
      }
      setCreateOpen(false)
      resetCreateForm()
      setRevealKey(apiKey)
      await fetchKeys()
    } catch (e) {
      const msg =
        (axios.isAxiosError(e) && (e.response?.data as { message?: string })?.message) ||
        (e instanceof Error ? e.message : 'Failed to create API key')
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  const onRevoke = async (row: AdminApiKeyRow) => {
    setRevokingId(row._id)
    try {
      await api.delete(`/api/admin/apikeys/${row._id}`)
      toast.success('API key revoked')
      await fetchKeys()
    } catch (e) {
      const msg =
        (axios.isAxiosError(e) && (e.response?.data as { message?: string })?.message) ||
        (e instanceof Error ? e.message : 'Revoke failed')
      toast.error(msg)
    } finally {
      setRevokingId(null)
    }
  }

  const columns: DataTableColumn<AdminApiKeyRow>[] = useMemo(
    () => [
      {
        key: 'keyPrefix',
        title: 'Key prefix',
        width: 180,
        render: (row) => <MonoCell value={row.keyPrefix} />
      },
      {
        key: 'owner',
        title: 'Owner',
        render: (row) => (
          <div className="flex flex-col leading-tight">
            <span>{row.userEmail || '—'}</span>
            {row.userFullName && (
              <span className="text-xs text-muted-foreground">{row.userFullName}</span>
            )}
          </div>
        )
      },
      {
        key: 'isActive',
        title: 'Status',
        width: 120,
        render: (row) =>
          row.isActive ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge variant="destructive">Revoked</Badge>
          )
      },
      {
        key: 'createdAt',
        title: 'Created',
        width: 140,
        hideOnMobile: true,
        render: (row) => (
          <span className="text-muted-foreground">
            {row.createdAt ? dayjs(row.createdAt).format('MMM D, YYYY') : '—'}
          </span>
        )
      },
      {
        key: 'lastUsedAt',
        title: 'Last used',
        width: 170,
        hideOnMobile: true,
        render: (row) => (
          <span className="text-muted-foreground">
            {row.lastUsedAt ? dayjs(row.lastUsedAt).format('MMM D, YYYY h:mm A') : 'Never'}
          </span>
        )
      },
      {
        key: 'usageCount',
        title: 'Calls',
        width: 90,
        align: 'right',
        hideOnMobile: true,
        render: (row) => (
          <span className="tabular-nums">{(row.usageCount ?? 0).toLocaleString()}</span>
        )
      },
      {
        key: 'actions',
        title: 'Actions',
        width: 120,
        fixed: 'right',
        render: (row) => (
          <Button
            variant="destructive"
            size="sm"
            disabled={!canManage || !row.isActive || revokingId === row._id}
            onClick={() => setPendingRevoke(row)}
          >
            {revokingId === row._id && <Loader2 className="animate-spin" />}
            Revoke
          </Button>
        )
      }
    ],
    [canManage, revokingId]
  )

  const pageActions = (
    <>
      <Button variant="outline" onClick={fetchKeys} disabled={loading}>
        <RotateCw className={loading ? 'animate-spin' : undefined} />
        Refresh
      </Button>
      <Button disabled={!canManage} onClick={() => setCreateOpen(true)}>
        <KeyRound />
        Create key
      </Button>
    </>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="API Keys"
        subtitle={
          total > 0 ? `${total.toLocaleString()} keys issued` : 'Issue and revoke programmatic access'
        }
        actions={pageActions}
      />

      {/* Error is scoped to the results region: the search and filter stay
          mounted and usable, so a failed query can be recovered by narrowing
          it rather than only by retrying the same one. */}
      {error && (
        <Alert variant="destructive">
          <OctagonX />
          <AlertTitle>Couldn’t load API keys</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <SectionCard title="All keys" noPadding>
        <DataTable<AdminApiKeyRow>
          caption="API keys"
          rowKey="_id"
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
          toolbar={
            <div className="flex flex-wrap items-center gap-2 px-4">
              <div className="relative min-w-56 flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search by email, name, or key prefix"
                  aria-label="Search API keys"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-40" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          empty={
            <EmptyState
              compact
              icon={<KeyRound />}
              title={
                debouncedSearch || statusFilter !== 'all'
                  ? 'No keys match these filters'
                  : 'No API keys yet'
              }
              hint={
                debouncedSearch || statusFilter !== 'all'
                  ? 'Clear the search or widen the status filter.'
                  : 'Create a key to give a user programmatic access.'
              }
            />
          }
        />
      </SectionCard>

      {/* Create key */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (creating) return
          setCreateOpen(o)
          if (!o) resetCreateForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              The key is shown once, immediately after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="apikey-user">User</Label>
              {/* Searchable combobox: shadcn Select has no async search, so this
                  is Popover + Command, the upstream pattern for the job. */}
              <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      id="apikey-user"
                      variant="outline"
                      aria-expanded={userPickerOpen}
                      className="w-full justify-between font-normal"
                    />
                  }
                >
                  <span className={createUserLabel ? 'truncate' : 'truncate text-muted-foreground'}>
                    {createUserLabel || 'Type a name or email…'}
                  </span>
                  <ChevronsUpDown className="opacity-50" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-(--anchor-width) p-0">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Search users…" onValueChange={onUserSearch} />
                    <CommandList>
                      {userSearchLoading ? (
                        <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" />
                          Searching…
                        </div>
                      ) : (
                        <CommandEmpty>No matches.</CommandEmpty>
                      )}
                      {userOptions.map((opt) => (
                        <CommandItem
                          key={opt.value}
                          value={opt.value}
                          onSelect={() => {
                            setCreateUserId(opt.value)
                            setCreateUserLabel(opt.label)
                            setUserPickerOpen(false)
                          }}
                        >
                          <Check
                            className={createUserId === opt.value ? 'opacity-100' : 'opacity-0'}
                          />
                          <span className="truncate">{opt.label}</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="apikey-name">Name (optional)</Label>
              <Input
                id="apikey-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value.slice(0, 64))}
                placeholder="e.g. Mobile app integration"
                maxLength={64}
              />
              <p className="text-xs text-muted-foreground">Internal label, max 64 characters.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false)
                resetCreateForm()
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={onCreateSubmit} disabled={creating || !createUserId}>
              {creating && <Loader2 className="animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time key reveal */}
      <Dialog open={!!revealKey} onOpenChange={(o) => !o && setRevealKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
          </DialogHeader>

          <Alert>
            <TriangleAlert />
            <AlertTitle>Save this key now</AlertTitle>
            <AlertDescription>For security, it won’t be shown again here.</AlertDescription>
          </Alert>

          {/* bg-muted, not the old rgba(0,0,0,0.04) which was invisible on a
              dark dialog surface. */}
          <div className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
            <code className="font-mono text-xs break-all">{revealKey}</code>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => revealKey && copyToClipboard(revealKey)}
            >
              <Copy />
              Copy
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setRevealKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <AlertDialog open={!!pendingRevoke} onOpenChange={(o) => !o && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevoke?.keyPrefix} will stop working immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const row = pendingRevoke
                setPendingRevoke(null)
                if (row) onRevoke(row)
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
