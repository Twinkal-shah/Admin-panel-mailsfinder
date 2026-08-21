import { Suspense, lazy, useMemo, useState } from 'react'
import {
  BarChart3,
  CreditCard,
  DollarSign,
  History,
  OctagonX,
  PieChart,
  RotateCw,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Users,
  Zap
} from 'lucide-react'
import dayjs from 'dayjs'

import DateFilter, { DateRange, DatePreset } from '../components/DateFilter'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import { ChartSkeleton, DonutSkeleton } from '../components/skeletons'
import { DataTable, type DataTableColumn } from '../components/global/data-table'
import { DashboardUserCreditUsage, useDashboardData } from '../store/dashboard'
import { PLAN_DISPLAY_NAME } from '../types/types'
import { PLAN_ORDER, planBadgeStyle } from '../ui/planTheme'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Recharts is ~350KB of the bundle and nothing above the fold needs it, so it
// streams in after the KPI row has already painted.
const RevenueSignupsChart = lazy(() => import('../components/charts/RevenueSignupsChart'))
const UsersByPlanChart = lazy(() => import('../components/charts/UsersByPlanChart'))

const PAGE_SIZE = 10

function formatRangeLabel(range: DateRange & { preset: DatePreset }) {
  if (range.preset !== 'Custom Range') return range.preset
  return `${dayjs.utc(range.from).format('MMM D, YYYY')} – ${dayjs.utc(range.to).format('MMM D, YYYY')}`
}

function compact(n: number): string {
  return Number(n ?? 0).toLocaleString()
}

function money(n: number): string {
  const v = Number(n ?? 0)
  // Whole amounts stay clean; fractional ones get both cents rather than
  // rendering as "$184,920.5".
  const digits = Number.isInteger(v) ? 0 : 2
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}`
}

/* On-palette and semantic: a purchase is revenue so it takes the brand accent,
 * a refund is destructive, everything else stays neutral. The previous version
 * used Antd's named blue/green/red, which were not theme tokens at all. */
function activityVariant(type: string): 'default' | 'secondary' | 'destructive' {
  const t = String(type).toLowerCase()
  if (t === 'purchase') return 'default'
  if (t === 'refund') return 'destructive'
  return 'secondary'
}

/** Relative time, with the absolute timestamp on hover and in the title. */
function RelativeTime({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const abs = dayjs(value).format('YYYY-MM-DD HH:mm')
  return (
    <Tooltip>
      <TooltipTrigger
        render={<time dateTime={value} title={abs} className="text-muted-foreground" />}
      >
        {dayjs(value).fromNow()}
      </TooltipTrigger>
      <TooltipContent>{abs}</TooltipContent>
    </Tooltip>
  )
}

interface ActivityRow {
  type: string
  when: string
  text: string
}

export default function Dashboard() {
  const [range, setRange] = useState<DateRange & { preset: DatePreset }>(() => {
    const now = dayjs.utc()
    return {
      from: now.subtract(29, 'day').startOf('day').toISOString(),
      to: now.endOf('day').toISOString(),
      preset: 'Last 30 Days'
    }
  })

  const [creditPage, setCreditPage] = useState(1)
  const [activityPage, setActivityPage] = useState(1)

  const {
    metrics,
    userCreditUsage,
    initialLoading,
    refreshing,
    error,
    fetchedAt,
    durationMs,
    refresh
  } = useDashboardData(range.from, range.to)

  const selectedRangeLabel = formatRangeLabel(range)

  const usersByPlan = useMemo(() => {
    const map = new Map<string, number>(
      (metrics?.usersByPlan ?? []).map((i) => [String(i.name).toLowerCase(), Number(i.value) || 0])
    )
    return PLAN_ORDER.map((name) => ({ name, value: map.get(name) ?? 0 }))
  }, [metrics?.usersByPlan])

  const usersByPlanTotal = useMemo(
    () => usersByPlan.reduce((acc, i) => acc + (i.value || 0), 0),
    [usersByPlan]
  )

  const timeSeries = metrics?.timeSeries ?? []
  const recentItems: ActivityRow[] = metrics?.latestActivity ?? []

  const creditColumns: DataTableColumn<DashboardUserCreditUsage>[] = useMemo(
    () => [
      {
        key: 'fullName',
        title: 'User',
        render: (row) => (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{row.fullName || '—'}</span>
            <span className="text-xs text-muted-foreground">{row.email}</span>
          </div>
        )
      },
      {
        key: 'plan',
        title: 'Plan',
        width: 150,
        render: (row) => (
          <Badge className="border-transparent" style={planBadgeStyle(row.plan)}>
            {PLAN_DISPLAY_NAME[row.plan] ?? row.plan}
          </Badge>
        )
      },
      {
        key: 'creditsUsedInRange',
        title: 'Used in period',
        align: 'right',
        width: 170,
        defaultSortOrder: 'descend',
        sorter: (a, b) => a.creditsUsedInRange - b.creditsUsedInRange,
        render: (row) => (
          <span className="font-medium tabular-nums">{compact(row.creditsUsedInRange)}</span>
        )
      },
      {
        key: 'totalCreditsUsed',
        title: 'Total used',
        align: 'right',
        width: 140,
        hideOnMobile: true,
        sorter: (a, b) => a.totalCreditsUsed - b.totalCreditsUsed,
        render: (row) => (
          <span className="tabular-nums text-muted-foreground">
            {compact(row.totalCreditsUsed)}
          </span>
        )
      },
      {
        key: 'lastUsedAt',
        title: 'Last used',
        width: 160,
        hideOnMobile: true,
        render: (row) => <RelativeTime value={row.lastUsedAt} />
      }
    ],
    []
  )

  const activityColumns: DataTableColumn<ActivityRow>[] = useMemo(
    () => [
      {
        key: 'type',
        title: 'Type',
        width: 130,
        render: (row) => <Badge variant={activityVariant(row.type)}>{row.type}</Badge>
      },
      { key: 'text', title: 'Activity', render: (row) => <span>{row.text}</span> },
      {
        key: 'when',
        title: 'When',
        width: 180,
        align: 'right',
        render: (row) => <RelativeTime value={row.when} />
      }
    ],
    []
  )

  // Hard failure with nothing cached to fall back on.
  const fatal = !!error && !metrics
  // Data on screen belongs to a previous range/fetch while a new one is in
  // flight. Dim it so the numbers are never silently misattributed.
  const showingStale = refreshing && !initialLoading

  const creditRows = userCreditUsage.slice((creditPage - 1) * PAGE_SIZE, creditPage * PAGE_SIZE)
  const activityRows = recentItems.slice((activityPage - 1) * PAGE_SIZE, activityPage * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your MailsFinder platform"
        actions={
          <div className="flex items-center gap-3">
            {fetchedAt && (
              <Tooltip>
                <TooltipTrigger
                  render={<span className="hidden text-xs text-muted-foreground sm:inline" />}
                >
                  {refreshing ? 'Refreshing…' : `Updated ${dayjs(fetchedAt).fromNow()}`}
                </TooltipTrigger>
                <TooltipContent>
                  {durationMs != null
                    ? `Loaded in ${durationMs}ms · ${dayjs(fetchedAt).format('HH:mm:ss')}`
                    : dayjs(fetchedAt).format('HH:mm:ss')}
                </TooltipContent>
              </Tooltip>
            )}
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RotateCw className={refreshing ? 'animate-spin' : undefined} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <DateFilter value={range} onChange={setRange} />
      </div>

      {error && (
        <Alert variant={metrics ? 'default' : 'destructive'}>
          {metrics ? <TriangleAlert /> : <OctagonX />}
          <AlertTitle>
            {metrics
              ? 'Showing the last successfully loaded data'
              : 'Failed to load. Backend may be unreachable.'}
          </AlertTitle>
          <AlertDescription>
            {metrics ? 'The latest refresh failed.' : 'Check your connection and try again.'}
          </AlertDescription>
          <Button variant="outline" size="sm" className="ml-auto self-start" onClick={refresh}>
            Retry
          </Button>
        </Alert>
      )}

      {fatal ? (
        <SectionCard>
          <EmptyState
            title="Dashboard data unavailable"
            hint="We couldn't reach the admin API. Check your connection and try again."
            action={
              <Button onClick={refresh}>
                <RotateCw />
                Retry
              </Button>
            }
          />
        </SectionCard>
      ) : (
        /* The whole stale region goes inert, not just the KPI grid and charts —
           previously the tables underneath stayed clickable while dimmed. */
        <div
          className={
            showingStale
              ? 'pointer-events-none flex flex-col gap-5 opacity-60 transition-opacity'
              : 'flex flex-col gap-5 transition-opacity'
          }
          aria-busy={showingStale || undefined}
        >
          {/* Both KPI rows step 1 -> 2 -> N at the SAME breakpoints. The old CSS
              dropped the 4-up row to 2 columns at 1200px but held the 3-up row
              at 3 columns until 900px, so between those widths the two rows
              showed mismatched card widths. */}
          <section
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Key metrics"
          >
            <StatCard
              label="Total users"
              value={compact(metrics?.totalUsers ?? 0)}
              icon={<Users />}
              loading={initialLoading}
            />
            <StatCard
              label="Active subscriptions"
              value={compact(metrics?.activeSubscriptions ?? 0)}
              icon={<CreditCard />}
              loading={initialLoading}
            />
            <StatCard
              label="Total revenue"
              value={money(metrics?.totalRevenue ?? 0)}
              icon={<DollarSign />}
              loading={initialLoading}
            />
            <StatCard
              label="Total credits used"
              value={compact(metrics?.totalCreditsUsed ?? 0)}
              icon={<Zap />}
              loading={initialLoading}
            />
          </section>

          <section
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="Secondary metrics"
          >
            <StatCard
              label="New users (MoM)"
              value={compact(metrics?.newUsersThisMonth?.count ?? 0)}
              delta={metrics?.newUsersThisMonth?.deltaPct}
              icon={<UserPlus />}
              loading={initialLoading}
            />
            <StatCard
              label="Churn"
              value={`${Number(metrics?.churnPct ?? 0).toFixed(1)}%`}
              hint="Cancelled vs. users created in period"
              icon={<TrendingDown />}
              loading={initialLoading}
            />
            <StatCard
              label="Active users (30d)"
              value={compact(metrics?.activeUsersLast30 ?? 0)}
              hint="Seen in the last 30 days"
              icon={<TrendingUp />}
              loading={initialLoading}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
            <SectionCard
              title="Revenue and signups"
              description={selectedRangeLabel}
              extra={<BarChart3 className="size-4 text-muted-foreground" />}
            >
              {initialLoading ? (
                <ChartSkeleton height={280} />
              ) : timeSeries.length === 0 ? (
                <EmptyState
                  compact
                  icon={<BarChart3 />}
                  title="No activity in this period"
                  hint="Try widening the date range."
                />
              ) : (
                <Suspense fallback={<ChartSkeleton height={280} />}>
                  <RevenueSignupsChart data={timeSeries} height={280} />
                </Suspense>
              )}
            </SectionCard>

            <SectionCard
              title="Users by plan"
              description={initialLoading ? 'Loading…' : `${compact(usersByPlanTotal)} users total`}
              extra={<PieChart className="size-4 text-muted-foreground" />}
            >
              {initialLoading ? (
                <DonutSkeleton height={280} />
              ) : usersByPlanTotal === 0 ? (
                <EmptyState
                  compact
                  icon={<PieChart />}
                  title="No users to break down"
                  hint="Plan distribution appears once users exist."
                />
              ) : (
                <Suspense fallback={<DonutSkeleton height={280} />}>
                  <UsersByPlanChart data={usersByPlan} total={usersByPlanTotal} height={280} />
                </Suspense>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Credits used by user"
            description="“Used in period” is consumption inside the selected range. “Total used” is lifetime."
            extra={<Badge variant="outline">{selectedRangeLabel}</Badge>}
            noPadding
          >
            <DataTable<DashboardUserCreditUsage>
              caption="Credit usage by user"
              rowKey="userId"
              rows={creditRows}
              columns={creditColumns}
              loading={initialLoading}
              pagination={{
                page: creditPage,
                pageSize: PAGE_SIZE,
                total: userCreditUsage.length,
                pageSizeOptions: [PAGE_SIZE],
                onChange: (p) => setCreditPage(p)
              }}
              empty={
                <EmptyState
                  compact
                  icon={<Zap />}
                  title="No credit usage in this period"
                  hint="Pick a wider range to see consumption."
                />
              }
            />
          </SectionCard>

          <SectionCard
            title="Recent activity"
            description="Latest platform events"
            extra={<History className="size-4 text-muted-foreground" />}
            noPadding
          >
            <DataTable<ActivityRow>
              caption="Recent platform activity"
              rowKey={(row) => `${row.when}|${row.type}|${row.text}`}
              rows={activityRows}
              columns={activityColumns}
              loading={initialLoading}
              skeletonRows={5}
              pagination={{
                page: activityPage,
                pageSize: PAGE_SIZE,
                total: recentItems.length,
                pageSizeOptions: [PAGE_SIZE],
                onChange: (p) => setActivityPage(p)
              }}
              empty={
                <EmptyState
                  compact
                  icon={<History />}
                  title="No activity yet"
                  hint="Signups, purchases and refunds will show up here."
                />
              }
            />
          </SectionCard>
        </div>
      )}
    </div>
  )
}
