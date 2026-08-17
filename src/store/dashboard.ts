import { useCallback, useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { ApiKey, AuditRow, Plan, Purchase, User } from '../types/types'
import { mapApiKey, mapUser } from '../utils/mappers'
import { useDataStore } from './data'
import { apiFetch } from '../utils/api'

export interface DashboardUserCreditUsage {
  userId: string
  fullName: string
  email: string
  plan: Plan
  creditsUsedInRange: number
  totalCreditsUsed: number
  lastUsedAt: string | null
}

export interface DashboardMetrics {
  totalUsers: number
  activeSubscriptions: number
  totalRevenue: number
  totalCreditsUsed: number
  newUsersThisMonth: { count: number; deltaPct: number }
  churnPct: number
  activeUsersLast30: number
  timeSeries: { date: string; revenue: number; signups: number }[]
  usersByPlan: { name: string; value: number }[]
  latestActivity: { type: string; when: string; text: string }[]
}

interface BootstrapResult {
  metrics: DashboardMetrics | null
  userCreditUsage: DashboardUserCreditUsage[]
  store: {
    users: User[]
    purchases: Purchase[]
    apiKeys: ApiKey[]
    audits: AuditRow[]
  }
  fetchedAt: number
  durationMs: number
}

const PLANS: Plan[] = ['free', 'monthly', 'lifetime', 'payg']

function normalizePlan(raw: unknown): Plan {
  const value = String(raw ?? 'free').toLowerCase()
  return (PLANS as string[]).includes(value) ? (value as Plan) : 'free'
}

function parseBootstrap(body: any, durationMs: number): BootstrapResult {
  const purchases: Purchase[] = Array.isArray(body?.purchases)
    ? body.purchases.map((p: any): Purchase => {
        const statusRaw: string = p.paymentStatus ?? p.status ?? 'paid'
        return {
          id: String(p._id ?? p.id),
          userId: String(p.userId),
          planName: normalizePlan(p.planName ?? p.plan_name),
          status:
            statusRaw === 'refunded' ? 'refunded' : statusRaw === 'pending' ? 'pending' : 'paid',
          date: p.paymentDate ?? p.date ?? p.createdAt,
          amount: Number(p.amountPaid ?? p.amount ?? 0)
        }
      })
    : []

  const apiKeySource = Array.isArray(body?.apiKeys)
    ? body.apiKeys
    : Array.isArray(body?.apikeys)
    ? body.apikeys
    : []

  const userCreditUsage: DashboardUserCreditUsage[] = Array.isArray(body?.userCreditUsage)
    ? body.userCreditUsage.map((row: any) => ({
        userId: String(row.userId ?? ''),
        fullName: String(row.fullName ?? ''),
        email: String(row.email ?? ''),
        plan: normalizePlan(row.plan),
        creditsUsedInRange: Number(row.creditsUsedInRange ?? 0),
        totalCreditsUsed: Number(row.totalCreditsUsed ?? 0),
        lastUsedAt: row.lastUsedAt ? String(row.lastUsedAt) : null
      }))
    : []

  return {
    metrics: body?.metrics ?? null,
    userCreditUsage,
    store: {
      users: Array.isArray(body?.users) ? body.users.map(mapUser) : [],
      purchases,
      apiKeys: apiKeySource.map(mapApiKey),
      audits: Array.isArray(body?.audits) ? body.audits : []
    },
    fetchedAt: Date.now(),
    durationMs
  }
}

/**
 * Module-level stale-while-revalidate cache, keyed by the requested range.
 * Survives route changes (the page component unmounts on every navigation), so
 * coming back to the dashboard paints the last known data instantly instead of
 * blanking to zeros while a fresh request is in flight.
 */
const cache = new Map<string, BootstrapResult>()
const inFlight = new Map<string, Promise<BootstrapResult>>()

function cacheKey(from: string, to: string) {
  return `${from}|${to}`
}

async function fetchBootstrap(from: string, to: string): Promise<BootstrapResult> {
  const key = cacheKey(from, to)
  const existing = inFlight.get(key)
  // Dedupes StrictMode's double-invoked effect in dev and any rapid
  // remount/date-toggle that would otherwise fire overlapping requests.
  if (existing) return existing

  const params = new URLSearchParams({ from, to })
  const started = performance.now()
  const promise = (async () => {
    const res = await apiFetch(`/api/admin/dashboard/bootstrap?${params.toString()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    const parsed = parseBootstrap(body, Math.round(performance.now() - started))
    cache.set(key, parsed)
    return parsed
  })().finally(() => {
    inFlight.delete(key)
  })

  inFlight.set(key, promise)
  return promise
}

export interface UseDashboardData {
  metrics: DashboardMetrics | null
  userCreditUsage: DashboardUserCreditUsage[]
  /** True only when there is nothing at all to show yet. */
  initialLoading: boolean
  /** True while a background revalidation is running over existing data. */
  refreshing: boolean
  error: string | null
  fetchedAt: number | null
  /** Wall-clock ms the bootstrap request took, for perf verification. */
  durationMs: number | null
  refresh: () => void
}

export function useDashboardData(fromIso: string, toIso: string): UseDashboardData {
  const from = dayjs.utc(fromIso).format('YYYY-MM-DD')
  const to = dayjs.utc(toIso).format('YYYY-MM-DD')
  const key = cacheKey(from, to)

  // Selector form: subscribing to the whole store re-rendered the dashboard on
  // every unrelated store write, including its own multi-thousand-row setAll.
  const setAll = useDataStore(s => s.setAll)

  const [snapshot, setSnapshot] = useState<BootstrapResult | null>(() => cache.get(key) ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const cached = cache.get(key) ?? null
    if (cached) {
      // Paint the cached result for this range before awaiting anything.
      setSnapshot(cached)
      setAll(cached.store)
      setError(null)
    }
    // No cached result for this range: deliberately keep whatever is already
    // on screen. Blanking to skeletons on every date change / manual refresh
    // is the exact "existing data → blank → skeleton → new data" flicker we're
    // trying to avoid. `refreshing` drives the subtle in-place indicator, and
    // `initialLoading` only fires when there is genuinely nothing to show.

    let cancelled = false
    setRefreshing(true)

    fetchBootstrap(from, to)
      .then(result => {
        if (cancelled || !mounted.current) return
        setSnapshot(result)
        setAll(result.store)
        setError(null)
      })
      .catch(() => {
        if (cancelled || !mounted.current) return
        setError('Failed to load. Backend may be unreachable.')
        // Only wipe the shared store when nothing was ever loaded — otherwise
        // we'd blank the User Detail page, which reads purchases/apiKeys from
        // whatever the last successful bootstrap put there.
        if (cache.size === 0) {
          setAll({ users: [], purchases: [], apiKeys: [], audits: [] })
        }
      })
      .finally(() => {
        if (cancelled || !mounted.current) return
        setRefreshing(false)
      })

    return () => {
      cancelled = true
    }
  }, [key, from, to, setAll, nonce])

  const refresh = useCallback(() => {
    cache.delete(key)
    setNonce(n => n + 1)
  }, [key])

  return {
    metrics: snapshot?.metrics ?? null,
    userCreditUsage: snapshot?.userCreditUsage ?? [],
    initialLoading: !snapshot && refreshing,
    refreshing,
    error,
    fetchedAt: snapshot?.fetchedAt ?? null,
    durationMs: snapshot?.durationMs ?? null,
    refresh
  }
}
