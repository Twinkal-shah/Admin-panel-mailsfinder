import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import axios from 'axios'
import { ArrowLeft, Copy, KeyRound, Loader2, ReceiptText, TriangleAlert, UserX } from 'lucide-react'

import { useDataStore } from '../store/data'
import { ApiKey, PLAN_DISPLAY_NAME, Purchase, User } from '../types/types'
import { useAuthStore } from '../store/auth'
import { hasScope } from '../store/rbac'
import { mapApiKey, mapUser } from '../utils/mappers'
import { API_BASE_URL, api } from '../utils/api'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'
import EmptyState from '../components/EmptyState'
import { DataTable, type DataTableColumn } from '../components/global/data-table'
import { PLAN_VAR } from '../ui/planTheme'
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
import { Card } from '@/components/ui/card'
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
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

// Spec: monthly users have a 10k/day cap on the monthly bucket.
const MONTHLY_DAILY_CAP = 10000

/** Definition-list row. Replaces Antd `Descriptions`, with a human label. */
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground sm:w-40">{label}</dt>
      <dd className="min-w-0 text-sm break-words">{children ?? '—'}</dd>
    </div>
  )
}

function StatusBadge({ status }: { status?: string }) {
  const s = String(status ?? 'none')
  const cls =
    s === 'active'
      ? 'border-primary/25 bg-primary/12 text-primary'
      : s === 'past_due'
        ? 'border-destructive/25 bg-destructive/12 text-destructive'
        : s === 'cancelled'
          ? 'border-border bg-muted text-muted-foreground'
          : 'border-border bg-transparent text-muted-foreground'
  return <Badge className={`font-normal ${cls}`}>{s}</Badge>
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const {
    users,
    purchases,
    apiKeys,
    adjustCredits,
    updateUserNotes,
    replaceUser,
    updateUser
  } = useDataStore()
  const { admin, token } = useAuthStore()
  const navigate = useNavigate()

  const storeUser = useMemo(() => users.find((u) => u.id === id), [users, id])

  /* The page used to read only from the shared store, so a refresh or a
   * bookmarked link always rendered "user not found". It now fetches on a store
   * miss. Two request shapes are tried, both against existing endpoints:
   *   1. GET /userManagement/users/:id — the REST partner of the PATCH and
   *      DELETE this page already calls. If the backend does not expose it, the
   *      404 is harmless and we fall through.
   *   2. GET /userManagement/getAllUsers?search=<id> — the endpoint the Users
   *      list uses, whose response shape mapUser already handles.
   * Nothing is written, and no endpoint is assumed to exist. */
  const [fetchedUser, setFetchedUser] = useState<User | null>(null)
  const [userLoading, setUserLoading] = useState(false)
  const [userLoadFailed, setUserLoadFailed] = useState(false)

  useEffect(() => {
    if (!id || storeUser) return
    let cancelled = false
    setUserLoading(true)
    setUserLoadFailed(false)
    ;(async () => {
      try {
        const direct = await api.get(`/api/admin/userManagement/users/${id}`, {
          validateStatus: () => true
        })
        const raw = direct.status === 200 ? (direct.data?.data ?? direct.data) : null
        if (raw && (raw._id || raw.id)) {
          if (!cancelled) setFetchedUser(mapUser(raw))
          return
        }
        const list = await api.get('/api/admin/userManagement/getAllUsers', {
          params: { page: 1, pageSize: 25, search: id }
        })
        const arr = Array.isArray(list.data?.data) ? list.data.data : []
        const match = arr.map(mapUser).find((u: User) => u.id === id)
        if (!cancelled) {
          if (match) setFetchedUser(match)
          else setUserLoadFailed(true)
        }
      } catch {
        if (!cancelled) setUserLoadFailed(true)
      } finally {
        if (!cancelled) setUserLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, storeUser])

  const user = storeUser ?? fetchedUser

  const userPurchases = useMemo(() => purchases.filter((p) => p.userId === id), [purchases, id])

  /* API keys come from the server now, not the local store, because the create
   * and revoke actions below hit the real endpoints. */
  const [keys, setKeys] = useState<ApiKey[] | null>(null)
  const [keysLoading, setKeysLoading] = useState(false)
  const userEmail = user?.email

  const loadKeys = useCallback(async () => {
    if (!id) return
    setKeysLoading(true)
    try {
      const res = await api.get('/api/admin/apikeys', {
        params: { page: 1, pageSize: 100, search: userEmail ?? '' }
      })
      const arr = Array.isArray(res.data?.data) ? res.data.data : []
      setKeys(arr.map(mapApiKey).filter((k: ApiKey) => k.userId === id))
    } catch {
      // Fall back to whatever the shared store already holds.
      setKeys(apiKeys.filter((k) => k.userId === id))
    } finally {
      setKeysLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userEmail])

  useEffect(() => {
    if (user) loadKeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loadKeys])

  const userKeys = keys ?? []

  const [creditsModal, setCreditsModal] = useState<{
    open: boolean
    delta: number
    reason: string
  }>({ open: false, delta: 0, reason: '' })
  const [planActionLoading, setPlanActionLoading] = useState<
    'monthly' | 'lifetime' | 'free' | null
  >(null)
  const [grantMonthly, setGrantMonthly] = useState({
    open: false,
    credits: 300000,
    cycleDays: 30,
    reason: ''
  })
  const [grantLifetime, setGrantLifetime] = useState({ open: false, credits: 2000000, reason: '' })
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [createKeyName, setCreateKeyName] = useState('')
  const [showFullKey, setShowFullKey] = useState<string | null>(null)
  const [notes, setNotes] = useState<string>('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [creditsLoading, setCreditsLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [pendingRevoke, setPendingRevoke] = useState<ApiKey | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  // Seed the notes field once the user resolves (store hit or fetch).
  useEffect(() => {
    if (user) setNotes(user.admin_notes || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const canWrite = hasScope(admin.role, 'users.write')
  const canAdjustCredits = hasScope(admin.role, 'credits.adjust')
  const canManageKeys = hasScope(admin.role, 'apikeys.manage')

  function authHeaders(): Record<string, string> {
    const bearer = token || localStorage.getItem('ADMIN_TOKEN') || ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (bearer) headers.Authorization = `Bearer ${bearer}`
    return headers
  }

  async function confirmCredits() {
    if (!user) return
    if (!creditsModal.reason.trim()) {
      toast.error('Reason is required')
      return
    }
    setCreditsLoading(true)
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/userManagement/users/${user.id}/credits-adjust`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            delta: Number(creditsModal.delta),
            // Backend always adjusts payg_balance; bucket is audit-only.
            bucket: 'find',
            reason: creditsModal.reason
          })
        }
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.success === false) {
        toast.error(body?.message || `HTTP ${res.status}`)
        return
      }
      adjustCredits(user.id, creditsModal.delta, admin.id, creditsModal.reason)
      setCreditsModal({ open: false, delta: 0, reason: '' })
      toast.success('Credits updated')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setCreditsLoading(false)
    }
  }

  async function submitGrantPlan(body: {
    plan: 'monthly' | 'lifetime'
    credits: number
    reason: string
    cycleDays?: number
  }): Promise<boolean> {
    if (!user) return false
    if (!Number.isFinite(body.credits) || body.credits <= 0) {
      toast.error('Credits must be a positive number')
      return false
    }
    if (!body.reason.trim()) {
      toast.error('Reason is required')
      return false
    }
    setPlanActionLoading(body.plan)
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/userManagement/users/${user.id}/grant-plan`,
        { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        toast.error(json?.message || `HTTP ${res.status}`)
        return false
      }
      const fresh = json?.data ?? json
      if (fresh && (fresh._id || fresh.id)) {
        replaceUser(mapUser(fresh), admin.id, { action: 'plan.grant', reason: body.reason })
      } else {
        updateUser(user.id, { plan: body.plan })
      }
      toast.success(body.plan === 'monthly' ? 'Promoted to Monthly' : 'Promoted to Lifetime')
      return true
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Request failed')
      return false
    } finally {
      setPlanActionLoading(null)
    }
  }

  async function confirmGrantMonthly() {
    const ok = await submitGrantPlan({
      plan: 'monthly',
      credits: Number(grantMonthly.credits),
      cycleDays: Number(grantMonthly.cycleDays) || 30,
      reason: grantMonthly.reason
    })
    if (ok) setGrantMonthly({ open: false, credits: 300000, cycleDays: 30, reason: '' })
  }

  async function confirmGrantLifetime() {
    const ok = await submitGrantPlan({
      plan: 'lifetime',
      credits: Number(grantLifetime.credits),
      reason: grantLifetime.reason
    })
    if (ok) setGrantLifetime({ open: false, credits: 2000000, reason: '' })
  }

  async function resetToFree() {
    if (!user) return
    setResetOpen(false)
    setPlanActionLoading('free')
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/userManagement/users/${user.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ plan: 'free' })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.success === false) {
        toast.error(body?.message || `HTTP ${res.status}`)
        return
      }
      const fresh = body?.data ?? body
      if (fresh && (fresh._id || fresh.id)) {
        replaceUser(mapUser(fresh))
      } else {
        updateUser(user.id, { plan: 'free' })
      }
      toast.success('Plan reset to Free')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setPlanActionLoading(null)
    }
  }

  /* WIRED TO THE REAL BACKEND.
   *
   * This used to call the local zustand store only — setTimeout(300) then a
   * client-side uuid — and reported "API Key created" for something that never
   * left the browser. It now calls the same POST /api/admin/apikeys the API Keys
   * page uses, so the key actually exists. The old rateLimitPerMinute field is
   * gone because that endpoint does not accept it; it takes an optional name. */
  async function handleCreateKey() {
    if (!user) return
    setCreateLoading(true)
    try {
      const body: { userId: string; name?: string } = { userId: user.id }
      const trimmed = createKeyName.trim()
      if (trimmed) body.name = trimmed.slice(0, 64)
      const res = await api.post('/api/admin/apikeys', body)
      const apiKey = res.data?.data?.apiKey
      if (!apiKey) {
        toast.error('Backend did not return the created key')
        return
      }
      setShowFullKey(apiKey)
      setCreateKeyOpen(false)
      setCreateKeyName('')
      await loadKeys()
      toast.success('API key created')
    } catch (e) {
      const msg =
        (axios.isAxiosError(e) && (e.response?.data as { message?: string })?.message) ||
        (e instanceof Error ? e.message : 'Failed to create API key')
      toast.error(msg)
    } finally {
      setCreateLoading(false)
    }
  }

  /** Also wired to the real endpoint, for the same reason as create. */
  async function confirmRevoke() {
    const key = pendingRevoke
    if (!key) return
    setPendingRevoke(null)
    setRevokingId(key.id)
    try {
      await api.delete(`/api/admin/apikeys/${key.id}`)
      await loadKeys()
      toast.success('API key revoked')
    } catch (e) {
      const msg =
        (axios.isAxiosError(e) && (e.response?.data as { message?: string })?.message) ||
        (e instanceof Error ? e.message : 'Revoke failed')
      toast.error(msg)
    } finally {
      setRevokingId(null)
    }
  }

  async function saveNotes() {
    if (!user) return
    setNotesSaving(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/userManagement/users/${user.id}/notes`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ admin_notes: notes })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.success === false) {
        toast.error(body?.message || `HTTP ${res.status}`)
        return
      }
      updateUserNotes(user.id, notes)
      toast.success('Notes saved')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setNotesSaving(false)
    }
  }

  const purchaseColumns: DataTableColumn<Purchase>[] = [
    { key: 'planName', title: 'Plan', render: (p) => PLAN_DISPLAY_NAME[p.planName] ?? p.planName },
    {
      key: 'amount',
      title: 'Amount',
      align: 'right',
      render: (p) => <span className="tabular-nums">${Number(p.amount ?? 0).toLocaleString()}</span>
    },
    { key: 'status', title: 'Status', render: (p) => <Badge variant="outline">{p.status}</Badge> },
    {
      key: 'date',
      title: 'Date',
      render: (p) => (
        <span className="text-muted-foreground">
          {p.date ? dayjs(p.date).format('MMM D, YYYY') : '—'}
        </span>
      )
    }
  ]

  const keyColumns: DataTableColumn<ApiKey>[] = [
    {
      key: 'keyPrefix',
      title: 'Prefix',
      render: (k) => <code className="font-mono text-xs">{k.keyPrefix}</code>
    },
    {
      key: 'lastUsedAt',
      title: 'Last used',
      render: (k) => (
        <span className="text-muted-foreground">
          {k.lastUsedAt ? dayjs(k.lastUsedAt).format('MMM D, YYYY') : 'Never'}
        </span>
      )
    },
    {
      key: 'usageCount',
      title: 'Calls',
      align: 'right',
      render: (k) => <span className="tabular-nums">{(k.usageCount ?? 0).toLocaleString()}</span>
    },
    {
      key: 'status',
      title: 'Status',
      render: (k) =>
        k.status === 'active' ? (
          <Badge variant="secondary">active</Badge>
        ) : (
          <Badge variant="destructive">{k.status}</Badge>
        )
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 110,
      render: (k) => (
        <Button
          variant="destructive"
          size="sm"
          disabled={!canManageKeys || k.status !== 'active' || revokingId === k.id}
          onClick={() => setPendingRevoke(k)}
        >
          {revokingId === k.id && <Loader2 className="animate-spin" />}
          Revoke
        </Button>
      )
    }
  ]

  if (userLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="User detail" />
        <SectionCard>
          <EmptyState
            icon={<UserX />}
            title="User not found"
            hint={
              userLoadFailed
                ? "We couldn't load this user from the API. They may have been deleted."
                : 'This user could not be found.'
            }
            action={
              <Button onClick={() => navigate('/users')}>
                <ArrowLeft />
                Back to Users
              </Button>
            }
          />
        </SectionCard>
      </div>
    )
  }

  const monthlyUsed = Number(user.monthly_daily_used ?? 0)
  const balances = [
    {
      label: 'Free daily',
      value: user.balances?.free ?? user.free_daily_balance,
      pool: undefined,
      token: PLAN_VAR.free
    },
    {
      label: 'Monthly',
      value: user.balances?.monthly ?? user.monthly_balance,
      pool: user.monthly_pool,
      token: PLAN_VAR.monthly
    },
    {
      label: 'Lifetime',
      value: user.balances?.lifetime ?? user.lifetime_balance,
      pool: user.lifetime_pool,
      token: PLAN_VAR.lifetime
    },
    {
      label: 'Pay-as-you-go',
      value: user.balances?.payg ?? user.payg_balance,
      pool: undefined,
      token: PLAN_VAR.payg
    }
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={user.full_name || 'User detail'}
        subtitle={user.email}
        actions={
          <Button variant="outline" onClick={() => navigate('/users')}>
            <ArrowLeft />
            Back to Users
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Profile">
          <dl className="flex flex-col">
            <Detail label="Full name">{user.full_name || '—'}</Detail>
            <Detail label="Email">{user.email}</Detail>
            <Detail label="Phone">{user.phone || '—'}</Detail>
            <Detail label="Country">{user.country || '—'}</Detail>
            <Detail label="Onboarding complete">{user.onboarding_flag ? 'Yes' : 'No'}</Detail>
            <Detail label="Member since">{dayjs(user.createdAt).format('MMM D, YYYY')}</Detail>
          </dl>
        </SectionCard>

        <SectionCard title="Credits">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Available credits</span>
            <span className="text-3xl font-semibold tabular-nums">
              {Number(user.available_credits ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              disabled={!canAdjustCredits}
              onClick={() => setCreditsModal({ open: true, delta: 100, reason: '' })}
            >
              Add credits
            </Button>
            <Button
              variant="destructive"
              disabled={!canAdjustCredits}
              onClick={() => setCreditsModal({ open: true, delta: -50, reason: '' })}
            >
              Subtract credits
            </Button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Plan & subscription">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <dl className="flex flex-col">
            <Detail label="Plan">{PLAN_DISPLAY_NAME[user.plan]}</Detail>
            <Detail label="Subscription status">
              <StatusBadge status={user.subscription?.status ?? user.subscription_status} />
            </Detail>
          </dl>
          <dl className="flex flex-col">
            <Detail label="Billing cycle">{user.billing_cycle ?? 'none'}</Detail>
            {(user.billing_cycle === 'monthly' || user.billing_cycle === 'annual') && (
              <>
                <Detail label="Cycle start">
                  {user.cycle_start_date ? dayjs(user.cycle_start_date).format('MMM D, YYYY') : '—'}
                </Detail>
                <Detail label="Cycle end">
                  {user.cycle_end_date ? dayjs(user.cycle_end_date).format('MMM D, YYYY') : '—'}
                </Detail>
              </>
            )}
          </dl>
        </div>

        {user.plan === 'monthly' && (
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">Today’s daily usage</span>
              <span className="tabular-nums">
                {monthlyUsed.toLocaleString()} / {MONTHLY_DAILY_CAP.toLocaleString()}
              </span>
            </div>
            <Progress
              value={monthlyUsed}
              max={MONTHLY_DAILY_CAP}
              label="Daily credit usage against the monthly cap"
              indicatorClassName={monthlyUsed >= MONTHLY_DAILY_CAP ? 'bg-destructive' : undefined}
            />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            disabled={!canWrite || planActionLoading === 'monthly'}
            onClick={() =>
              setGrantMonthly({ open: true, credits: 300000, cycleDays: 30, reason: '' })
            }
          >
            {planActionLoading === 'monthly' && <Loader2 className="animate-spin" />}
            Promote to Monthly
          </Button>
          <Button
            variant="outline"
            disabled={!canWrite || planActionLoading === 'lifetime'}
            onClick={() => setGrantLifetime({ open: true, credits: 2000000, reason: '' })}
          >
            {planActionLoading === 'lifetime' && <Loader2 className="animate-spin" />}
            Promote to Lifetime
          </Button>
          <Button
            variant="destructive"
            disabled={!canWrite || planActionLoading === 'free'}
            onClick={() => setResetOpen(true)}
          >
            {planActionLoading === 'free' && <Loader2 className="animate-spin" />}
            Reset to Free
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Credit balances"
        description={`${Number(user.available_credits ?? 0).toLocaleString()} available in total`}
      >
        {/* Token-driven. These pills previously used a slate/blue/amber/violet
            palette that existed nowhere else in the product. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {balances.map((b) => {
            const balance = Number(b.value ?? 0)
            const pool = b.pool != null ? Number(b.pool) : undefined
            return (
              <Card key={b.label} size="sm" className="gap-1 px-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: b.token }}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-muted-foreground">{b.label}</span>
                </div>
                <span className="text-lg font-semibold tabular-nums">
                  {balance.toLocaleString()}
                  {pool != null && pool > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {' '}
                      / {pool.toLocaleString()}
                    </span>
                  )}
                </span>
              </Card>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="API keys"
          description="Created and revoked on the server."
          extra={
            <Button size="sm" disabled={!canManageKeys} onClick={() => setCreateKeyOpen(true)}>
              <KeyRound />
              Create key
            </Button>
          }
          noPadding
        >
          <DataTable<ApiKey>
            caption="API keys for this user"
            rowKey="id"
            rows={userKeys}
            columns={keyColumns}
            loading={keysLoading && keys === null}
            size="sm"
            skeletonRows={3}
            empty={
              <EmptyState
                compact
                icon={<KeyRound />}
                title="No API keys"
                hint="Create one to give this user programmatic access."
              />
            }
          />
          {showFullKey && (
            <div className="mx-4 mb-4">
              <Alert>
                <TriangleAlert />
                <AlertTitle>Save this key now</AlertTitle>
                <AlertDescription>It won’t be shown again.</AlertDescription>
              </Alert>
              <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-muted p-3">
                <code className="font-mono text-xs break-all">{showFullKey}</code>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    navigator.clipboard
                      ?.writeText(showFullKey)
                      .then(() => toast.success('Copied'))
                      .catch(() => toast.error('Copy failed'))
                  }
                >
                  <Copy />
                  Copy
                </Button>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Purchases" noPadding>
          <DataTable<Purchase>
            caption="Purchase history"
            rowKey="id"
            rows={userPurchases}
            columns={purchaseColumns}
            size="sm"
            skeletonRows={3}
            empty={
              <EmptyState
                compact
                icon={<ReceiptText />}
                title="No purchases"
                hint="Completed payments appear here."
              />
            }
          />
        </SectionCard>
      </div>

      <SectionCard title="Admin notes" description="Internal only. Never shown to the user.">
        <div className="flex flex-col gap-3">
          <Label htmlFor="admin-notes" className="sr-only">
            Admin notes
          </Label>
          <Textarea
            id="admin-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div>
            <Button onClick={saveNotes} disabled={!canWrite || notesSaving}>
              {notesSaving && <Loader2 className="animate-spin" />}
              Save notes
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Promote to Monthly */}
      <Dialog
        open={grantMonthly.open}
        onOpenChange={(o) => setGrantMonthly((s) => ({ ...s, open: o }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to Monthly</DialogTitle>
            <DialogDescription>
              Atomically sets plan, monthly balance, monthly pool and cycle dates via the backend
              grant-plan endpoint. Does not touch the PAYG or free buckets.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="gm-credits">Credits</Label>
              <Input
                id="gm-credits"
                type="number"
                min={1}
                value={grantMonthly.credits}
                onChange={(e) =>
                  setGrantMonthly((s) => ({ ...s, credits: Number(e.target.value) }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gm-cycle">Cycle days</Label>
              <Input
                id="gm-cycle"
                type="number"
                min={1}
                value={grantMonthly.cycleDays}
                onChange={(e) =>
                  setGrantMonthly((s) => ({ ...s, cycleDays: Number(e.target.value) }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gm-reason">Reason</Label>
              <Textarea
                id="gm-reason"
                rows={3}
                value={grantMonthly.reason}
                onChange={(e) => setGrantMonthly((s) => ({ ...s, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGrantMonthly((s) => ({ ...s, open: false }))}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmGrantMonthly}
              disabled={
                !grantMonthly.reason.trim() ||
                !grantMonthly.credits ||
                planActionLoading === 'monthly'
              }
            >
              {planActionLoading === 'monthly' && <Loader2 className="animate-spin" />}
              Promote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote to Lifetime */}
      <Dialog
        open={grantLifetime.open}
        onOpenChange={(o) => setGrantLifetime((s) => ({ ...s, open: o }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to Lifetime</DialogTitle>
            <DialogDescription>
              Atomically sets plan, lifetime balance and lifetime pool. No cycle dates.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="gl-credits">Credits</Label>
              <Input
                id="gl-credits"
                type="number"
                min={1}
                value={grantLifetime.credits}
                onChange={(e) =>
                  setGrantLifetime((s) => ({ ...s, credits: Number(e.target.value) }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gl-reason">Reason</Label>
              <Textarea
                id="gl-reason"
                rows={3}
                value={grantLifetime.reason}
                onChange={(e) => setGrantLifetime((s) => ({ ...s, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGrantLifetime((s) => ({ ...s, open: false }))}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmGrantLifetime}
              disabled={
                !grantLifetime.reason.trim() ||
                !grantLifetime.credits ||
                planActionLoading === 'lifetime'
              }
            >
              {planActionLoading === 'lifetime' && <Loader2 className="animate-spin" />}
              Promote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit adjustment */}
      <Dialog
        open={creditsModal.open}
        onOpenChange={(o) => setCreditsModal((m) => ({ ...m, open: o }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credit adjustment</DialogTitle>
            <DialogDescription>
              Creates an audit row recording admin, action, target, timestamp and reason.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ca-delta">Delta</Label>
              <Input
                id="ca-delta"
                type="number"
                value={creditsModal.delta}
                onChange={(e) => setCreditsModal((m) => ({ ...m, delta: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">Positive adds, negative subtracts.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ca-reason">Reason</Label>
              <Textarea
                id="ca-reason"
                rows={3}
                value={creditsModal.reason}
                onChange={(e) => setCreditsModal((m) => ({ ...m, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreditsModal({ open: false, delta: 0, reason: '' })}
            >
              Cancel
            </Button>
            <Button onClick={confirmCredits} disabled={!creditsModal.reason.trim() || creditsLoading}>
              {creditsLoading && <Loader2 className="animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create API key */}
      <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              The full key is shown once, immediately after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="ck-name">Name (optional)</Label>
            <Input
              id="ck-name"
              value={createKeyName}
              onChange={(e) => setCreateKeyName(e.target.value.slice(0, 64))}
              placeholder="e.g. Mobile app integration"
              maxLength={64}
            />
            <p className="text-xs text-muted-foreground">Internal label, max 64 characters.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateKeyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={createLoading}>
              {createLoading && <Loader2 className="animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset to Free */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Free</AlertDialogTitle>
            <AlertDialogDescription>
              Sets this user back to the Free plan. Existing bucket balances are NOT cleared, which
              is intentional — file a backend ticket if you need a destructive reset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={resetToFree}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke key */}
      <AlertDialog open={!!pendingRevoke} onOpenChange={(o) => !o && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevoke?.keyPrefix} will stop working immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmRevoke}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
