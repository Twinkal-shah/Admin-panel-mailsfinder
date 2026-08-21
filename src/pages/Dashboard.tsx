import { Suspense, lazy, useMemo, useState } from 'react'
import { Alert, Button, Table, Tag, Tooltip, Typography } from 'antd'
import {
  ReloadOutlined,
  TeamOutlined,
  CreditCardOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
  FallOutlined,
  RiseOutlined,
  HistoryOutlined,
  BarChartOutlined,
  PieChartOutlined
} from '@ant-design/icons'
import DateFilter, { DateRange, DatePreset } from '../components/DateFilter'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import { ChartSkeleton, DonutSkeleton, ListSkeleton, TableSkeleton } from '../components/skeletons'
import { DashboardUserCreditUsage, useDashboardData } from '../store/dashboard'
import { PLAN_DISPLAY_NAME, Plan } from '../types/types'
import { PLAN_COLORS, PLAN_ORDER } from '../ui/planTheme'
import { inReportTz, nowInReportTz } from '../utils/reportingTz'
import dayjs from 'dayjs'

// Recharts is ~400KB of the bundle and nothing above the fold needs it, so it
// streams in after the KPI row has already painted.
const RevenueSignupsChart = lazy(() => import('../components/charts/RevenueSignupsChart'))
const UsersByPlanChart = lazy(() => import('../components/charts/UsersByPlanChart'))

function formatRangeLabel(range: DateRange & { preset: DatePreset }) {
  if (range.preset !== 'Custom Range') return range.preset
  // Labelled in the reporting timezone so it names the same days the range
  // actually covers.
  return `${inReportTz(range.from).format('MMM D, YYYY')} – ${inReportTz(range.to).format('MMM D, YYYY')}`
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

const ACTIVITY_COLORS: Record<string, string> = {
  signup: 'blue',
  purchase: 'green',
  refund: 'red'
}

function activityColor(type: string): string | undefined {
  return ACTIVITY_COLORS[String(type).toLowerCase()]
}

export default function Dashboard() {
  const [range, setRange] = useState<DateRange & { preset: DatePreset }>(() => {
    // Matches DateFilter's presets: IST day bounds, not UTC.
    const now = nowInReportTz()
    return {
      from: now.subtract(29, 'day').startOf('day').toISOString(),
      to: now.endOf('day').toISOString(),
      preset: 'Last 30 Days'
    }
  })

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
      (metrics?.usersByPlan ?? []).map(i => [String(i.name).toLowerCase(), Number(i.value) || 0])
    )
    return PLAN_ORDER.map(name => ({ name, value: map.get(name) ?? 0 }))
  }, [metrics?.usersByPlan])

  const usersByPlanTotal = useMemo(
    () => usersByPlan.reduce((acc, i) => acc + (i.value || 0), 0),
    [usersByPlan]
  )

  const timeSeries = metrics?.timeSeries ?? []
  const recentItems = metrics?.latestActivity ?? []

  const creditColumns = useMemo(
    () => [
      {
        title: 'User',
        dataIndex: 'fullName',
        key: 'fullName',
        render: (_: string, row: DashboardUserCreditUsage) => (
          <div className="mf-cell-stack">
            <span className="mf-cell-stack__primary">{row.fullName || '—'}</span>
            <span className="mf-cell-stack__secondary">{row.email}</span>
          </div>
        )
      },
      {
        title: 'Plan',
        dataIndex: 'plan',
        key: 'plan',
        width: 140,
        render: (plan: Plan) => (
          <Tag
            className="mf-plan-tag"
            style={{ color: PLAN_COLORS[plan], borderColor: PLAN_COLORS[plan] }}
          >
            {PLAN_DISPLAY_NAME[plan] ?? plan}
          </Tag>
        )
      },
      {
        title: 'Used in period',
        dataIndex: 'creditsUsedInRange',
        key: 'creditsUsedInRange',
        align: 'right' as const,
        width: 180,
        defaultSortOrder: 'descend' as const,
        sorter: (a: DashboardUserCreditUsage, b: DashboardUserCreditUsage) =>
          a.creditsUsedInRange - b.creditsUsedInRange,
        render: (value: number) => <span className="mf-num">{compact(value)}</span>
      },
      {
        title: 'Total used',
        dataIndex: 'totalCreditsUsed',
        key: 'totalCreditsUsed',
        align: 'right' as const,
        width: 140,
        sorter: (a: DashboardUserCreditUsage, b: DashboardUserCreditUsage) =>
          a.totalCreditsUsed - b.totalCreditsUsed,
        render: (value: number) => <span className="mf-num mf-num--muted">{compact(value)}</span>
      },
      {
        title: 'Last used',
        dataIndex: 'lastUsedAt',
        key: 'lastUsedAt',
        width: 170,
        render: (value: string | null) =>
          value ? (
            <Tooltip title={dayjs(value).format('YYYY-MM-DD HH:mm')}>
              <span className="mf-cell-muted">{dayjs(value).fromNow()}</span>
            </Tooltip>
          ) : (
            <span className="mf-cell-muted">—</span>
          )
      }
    ],
    []
  )

  const activityColumns = useMemo(
    () => [
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        width: 130,
        render: (type: string) => <Tag color={activityColor(type)}>{type}</Tag>
      },
      {
        title: 'Activity',
        dataIndex: 'text',
        key: 'text',
        render: (text: string) => <span className="mf-cell-strong">{text}</span>
      },
      {
        title: 'When',
        dataIndex: 'when',
        key: 'when',
        width: 200,
        align: 'right' as const,
        render: (when: string) => (
          <Tooltip title={dayjs(when).format('YYYY-MM-DD HH:mm')}>
            <span className="mf-cell-muted">{dayjs(when).fromNow()}</span>
          </Tooltip>
        )
      }
    ],
    []
  )

  // Hard failure with nothing cached to fall back on.
  const fatal = !!error && !metrics
  // Data on screen belongs to a previous range/fetch while a new one is in
  // flight. Dim it slightly so the numbers are never silently misattributed.
  const showingStale = refreshing && !initialLoading

  return (
    <div className={`mf-page${showingStale ? ' mf-page--stale' : ''}`}>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your MailsFinder platform"
        actions={
          <div className="mf-page-header__toolbar">
            {fetchedAt && (
              <Tooltip
                title={
                  durationMs != null
                    ? `Loaded in ${durationMs}ms · ${dayjs(fetchedAt).format('HH:mm:ss')}`
                    : dayjs(fetchedAt).format('HH:mm:ss')
                }
              >
                <Typography.Text type="secondary" className="mf-updated">
                  {refreshing ? 'Refreshing…' : `Updated ${dayjs(fetchedAt).fromNow()}`}
                </Typography.Text>
              </Tooltip>
            )}
            <Button icon={<ReloadOutlined />} onClick={refresh} loading={refreshing}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="mf-toolbar">
        <DateFilter value={range} onChange={setRange} />
      </div>

      {error && (
        <Alert
          type={metrics ? 'warning' : 'error'}
          showIcon
          message={
            metrics
              ? 'Showing the last successfully loaded data — the latest refresh failed.'
              : 'Failed to load. Backend may be unreachable.'
          }
          action={
            <Button size="small" onClick={refresh}>
              Retry
            </Button>
          }
        />
      )}

      {fatal ? (
        <SectionCard>
          <EmptyState
            title="Dashboard data unavailable"
            hint="We couldn't reach the admin API. Check your connection and try again."
            action={
              <Button type="primary" icon={<ReloadOutlined />} onClick={refresh}>
                Retry
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <>
          <section className="mf-kpi-grid" aria-label="Key metrics">
            <StatCard
              label="Total users"
              value={compact(metrics?.totalUsers ?? 0)}
              icon={<TeamOutlined />}
              loading={initialLoading}
            />
            <StatCard
              label="Active subscriptions"
              value={compact(metrics?.activeSubscriptions ?? 0)}
              icon={<CreditCardOutlined />}
              loading={initialLoading}
            />
            <StatCard
              label="Total revenue"
              value={money(metrics?.totalRevenue ?? 0)}
              icon={<DollarOutlined />}
              loading={initialLoading}
            />
            <StatCard
              label="Total credits used"
              value={compact(metrics?.totalCreditsUsed ?? 0)}
              icon={<ThunderboltOutlined />}
              loading={initialLoading}
            />
          </section>

          <section className="mf-kpi-grid mf-kpi-grid--three" aria-label="Secondary metrics">
            <StatCard
              label="New users (MoM)"
              value={compact(metrics?.newUsersThisMonth?.count ?? 0)}
              delta={metrics?.newUsersThisMonth?.deltaPct}
              icon={<UserAddOutlined />}
              loading={initialLoading}
            />
            <StatCard
              label="Churn"
              value={`${Number(metrics?.churnPct ?? 0).toFixed(1)}%`}
              hint="Cancelled vs. users created in period"
              icon={<FallOutlined />}
              loading={initialLoading}
            />
            <StatCard
              label="Active users (30d)"
              value={compact(metrics?.activeUsersLast30 ?? 0)}
              hint="Seen in the last 30 days"
              icon={<RiseOutlined />}
              loading={initialLoading}
            />
          </section>

          <div className="mf-split">
            <SectionCard
              title="Revenue and signups"
              description={selectedRangeLabel}
              extra={<BarChartOutlined className="mf-card__glyph" />}
            >
              {initialLoading ? (
                <ChartSkeleton height={280} />
              ) : timeSeries.length === 0 ? (
                <EmptyState
                  compact
                  icon={<BarChartOutlined />}
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
              extra={<PieChartOutlined className="mf-card__glyph" />}
            >
              {initialLoading ? (
                <DonutSkeleton height={280} />
              ) : usersByPlanTotal === 0 ? (
                <EmptyState
                  compact
                  icon={<PieChartOutlined />}
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
            extra={<Tag className="mf-range-tag">{selectedRangeLabel}</Tag>}
            noPadding
          >
            {initialLoading ? (
              <div className="mf-card__body-pad">
                <TableSkeleton rows={6} cols={5} />
              </div>
            ) : (
              <Table<DashboardUserCreditUsage>
                className="mf-table"
                rowKey="userId"
                dataSource={userCreditUsage}
                columns={creditColumns}
                size="middle"
                scroll={{ x: 'max-content' }}
                pagination={
                  userCreditUsage.length > 10
                    ? { pageSize: 10, showSizeChanger: false, size: 'small' }
                    : false
                }
                locale={{
                  emptyText: (
                    <EmptyState
                      compact
                      icon={<ThunderboltOutlined />}
                      title="No credit usage in this period"
                      hint="Pick a wider range to see consumption."
                    />
                  )
                }}
              />
            )}
          </SectionCard>

          <SectionCard
            title="Recent activity"
            description="Latest platform events"
            extra={<HistoryOutlined className="mf-card__glyph" />}
            noPadding
          >
            {initialLoading ? (
              <div className="mf-card__body-pad">
                <ListSkeleton rows={5} />
              </div>
            ) : (
              <Table
                className="mf-table"
                rowKey={(row: { type: string; when: string; text: string }) =>
                  `${row.when}|${row.type}|${row.text}`
                }
                dataSource={recentItems}
                columns={activityColumns}
                size="middle"
                scroll={{ x: 'max-content' }}
                pagination={
                  recentItems.length > 10
                    ? { pageSize: 10, showSizeChanger: false, size: 'small' }
                    : false
                }
                locale={{
                  emptyText: (
                    <EmptyState
                      compact
                      icon={<HistoryOutlined />}
                      title="No activity yet"
                      hint="Signups, purchases and refunds will show up here."
                    />
                  )
                }}
              />
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
