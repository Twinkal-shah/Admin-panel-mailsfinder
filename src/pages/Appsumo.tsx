import { useMemo, useState } from 'react'
import { Alert, Button, Table, Tag, Tooltip, Typography } from 'antd'
import {
  DollarOutlined,
  GiftOutlined,
  ReloadOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WalletOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import { TableSkeleton } from '../components/skeletons'
import { useDashboardData } from '../store/dashboard'
import { AppsumoTierRow, AppsumoUserRow } from '../utils/appsumo'

function compact(n: number): string {
  return Number(n ?? 0).toLocaleString()
}

function money(n: number): string {
  const v = Number(n ?? 0)
  const digits = Number.isInteger(v) ? 0 : 2
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}`
}

function pct(part: number, whole: number): number {
  if (!whole) return 0
  return Math.max(0, Math.min(100, (part / whole) * 100))
}

/**
 * Remaining-of-allocated bar. Clamped at 100%: an upgraded buyer keeps their
 * old tier's leftovers on top of the new grant, so remaining can exceed the
 * tier's allocation.
 */
function Meter({ value, max }: { value: number; max: number }) {
  return (
    <div className="mf-meter" role="presentation">
      <span className="mf-meter__fill" style={{ width: `${pct(value, max)}%` }} />
    </div>
  )
}

function TierCard({ row }: { row: AppsumoTierRow }) {
  const empty = row.userCount === 0
  return (
    <article className={`mf-tier${empty ? ' mf-tier--empty' : ''}`}>
      <header className="mf-tier__head">
        <span className="mf-tier__name">{row.label}</span>
        <span className="mf-tier__count">
          {compact(row.userCount)} {row.userCount === 1 ? 'user' : 'users'}
        </span>
      </header>

      <div className="mf-tier__spec">
        <div>
          <span className="mf-tier__spec-value">{compact(row.credits)}</span>
          <span className="mf-tier__spec-label">credits / user</span>
        </div>
        <div>
          <span className="mf-tier__spec-value">{compact(row.dailyCap)}</span>
          <span className="mf-tier__spec-label">daily cap / user</span>
        </div>
      </div>

      <div className="mf-tier__usage">
        <div className="mf-tier__usage-row">
          <span>Remaining</span>
          <span className="mf-num">
            {compact(row.creditsRemaining)}
            <span className="mf-num--muted"> / {compact(row.creditsAllocated)}</span>
          </span>
        </div>
        <Meter value={row.creditsRemaining} max={row.creditsAllocated} />
      </div>

      <dl className="mf-tier__facts">
        <div>
          <dt>Credits allocated</dt>
          <dd className="mf-num">{compact(row.creditsAllocated)}</dd>
        </div>
        <div>
          <dt>Combined daily cap</dt>
          <dd className="mf-num">{compact(row.dailyCapTotal)}</dd>
        </div>
        <div>
          <dt>Amount paid</dt>
          <dd>
            {row.usersWithPurchase === 0 ? (
              <Tooltip title={empty ? undefined : 'No AppSumo purchase record matched these users'}>
                <span className="mf-cell-muted">—</span>
              </Tooltip>
            ) : (
              <span className="mf-num">{money(row.amountPaid)}</span>
            )}
          </dd>
        </div>
      </dl>
    </article>
  )
}

export default function Appsumo() {
  const navigate = useNavigate()

  // Same default window as the Dashboard, so arriving from there reuses its
  // cached bootstrap response. AppSumo figures are all-time either way: the
  // bootstrap's user and purchase lists are not narrowed by the range.
  const [range] = useState(() => {
    const now = dayjs.utc()
    return {
      from: now.subtract(29, 'day').startOf('day').toISOString(),
      to: now.endOf('day').toISOString()
    }
  })
  const { appsumo, initialLoading, refreshing, error, fetchedAt, refresh } = useDashboardData(
    range.from,
    range.to
  )

  const totals = appsumo?.totals
  const tiers = appsumo?.tiers ?? []
  const users = appsumo?.users ?? []

  const columns = useMemo(
    () => [
      {
        title: 'User',
        dataIndex: 'fullName',
        key: 'user',
        render: (_: string, row: AppsumoUserRow) => (
          <div className="mf-cell-stack">
            <span className="mf-cell-stack__primary">{row.fullName || '—'}</span>
            <span className="mf-cell-stack__secondary">{row.email}</span>
          </div>
        )
      },
      {
        title: 'Tier',
        dataIndex: 'tier',
        key: 'tier',
        width: 110,
        sorter: (a: AppsumoUserRow, b: AppsumoUserRow) => a.tier - b.tier,
        render: (tier: number) => <Tag className="mf-range-tag">Tier {tier}</Tag>
      },
      {
        title: 'Credits remaining',
        dataIndex: 'creditsRemaining',
        key: 'creditsRemaining',
        width: 220,
        sorter: (a: AppsumoUserRow, b: AppsumoUserRow) => a.creditsRemaining - b.creditsRemaining,
        render: (value: number, row: AppsumoUserRow) => (
          <div className="mf-usage-cell">
            <span className="mf-num">
              {compact(value)}
              <span className="mf-num--muted"> / {compact(row.creditsAllocated)}</span>
            </span>
            <Meter value={value} max={row.creditsAllocated} />
          </div>
        )
      },
      {
        title: 'Amount paid',
        dataIndex: 'amountPaid',
        key: 'amountPaid',
        align: 'right' as const,
        width: 130,
        render: (value: number | null) =>
          value == null ? (
            <Tooltip title="No AppSumo purchase record matched this user">
              <span className="mf-cell-muted">—</span>
            </Tooltip>
          ) : (
            <span className="mf-num">{money(value)}</span>
          )
      },
      {
        title: 'Joined',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 150,
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

  const fatal = !!error && !appsumo
  const showingStale = refreshing && !initialLoading

  return (
    <div className={`mf-page${showingStale ? ' mf-page--stale' : ''}`}>
      <PageHeader
        title="AppSumo"
        subtitle="Lifetime licences sold through AppSumo · all time"
        actions={
          <div className="mf-page-header__toolbar">
            {fetchedAt && (
              <Typography.Text type="secondary" className="mf-updated">
                {refreshing ? 'Refreshing…' : `Updated ${dayjs(fetchedAt).fromNow()}`}
              </Typography.Text>
            )}
            <Button icon={<ReloadOutlined />} onClick={refresh} loading={refreshing}>
              Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <Alert
          type={appsumo ? 'warning' : 'error'}
          showIcon
          message={
            appsumo
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
            title="AppSumo data unavailable"
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
          <section className="mf-kpi-grid" aria-label="AppSumo totals">
            <StatCard
              label="Licence holders"
              value={compact(totals?.userCount ?? 0)}
              hint="Users on an active AppSumo tier"
              icon={<TeamOutlined />}
              loading={initialLoading}
            />
            <StatCard
              label="Credits allocated"
              value={compact(totals?.creditsAllocated ?? 0)}
              hint="One-time grants, by current tier"
              icon={<GiftOutlined />}
              loading={initialLoading}
            />
            <StatCard
              label="Credits remaining"
              value={compact(totals?.creditsRemaining ?? 0)}
              hint="Unspent AppSumo balance"
              icon={<WalletOutlined />}
              loading={initialLoading}
            />
            <StatCard
              label="Amount paid"
              value={totals && totals.usersWithPurchase > 0 ? money(totals.amountPaid) : '—'}
              hint={
                totals && totals.userCount > 0
                  ? `${compact(totals.usersWithPurchase)} of ${compact(totals.userCount)} users matched a purchase`
                  : 'From AppSumo purchase records'
              }
              icon={<DollarOutlined />}
              loading={initialLoading}
            />
          </section>

          <SectionCard title="Tiers" description="Allocation per licence and what each tier holds today.">
            {initialLoading ? (
              <TableSkeleton rows={3} cols={4} />
            ) : (
              <div className="mf-tier-grid">
                {tiers.map(row => (
                  <TierCard key={row.tier} row={row} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Licence holders"
            description="Click a row to open the user."
            extra={<ThunderboltOutlined className="mf-card__glyph" />}
            noPadding
          >
            {initialLoading ? (
              <div className="mf-card__body-pad">
                <TableSkeleton rows={4} cols={5} />
              </div>
            ) : (
              <Table<AppsumoUserRow>
                className="mf-table"
                rowKey="userId"
                dataSource={users}
                columns={columns}
                size="middle"
                scroll={{ x: 'max-content' }}
                rowClassName={() => 'mf-row-link'}
                onRow={row => ({ onClick: () => navigate(`/users/${row.userId}`) })}
                pagination={
                  users.length > 20 ? { pageSize: 20, showSizeChanger: false, size: 'small' } : false
                }
                locale={{
                  emptyText: (
                    <EmptyState
                      compact
                      icon={<GiftOutlined />}
                      title="No AppSumo users yet"
                      hint="Buyers appear here once their licence is activated."
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
