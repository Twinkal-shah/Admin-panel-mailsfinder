import { useEffect, useMemo, useState } from 'react'
import { Card, Typography, Row, Col, List, Tag, Spin } from 'antd'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import DateFilter, { DateRange, DatePreset } from '../components/DateFilter'
import { useDataStore } from '../store/data'
import { useAuthStore } from '../store/auth'
import { Plan, SubscriptionStatus } from '../types/types'
import { activeSubscriptions, activeUsersLast30, churnRate, newUsersMoM, totalRevenue, totalUsers } from '../utils/metrics'
import dayjs from 'dayjs'

function KPI({ title, value, suffix, delta }: { title: string; value: number | string; suffix?: string; delta?: number }) {
  const sign = delta === undefined ? '' : delta >= 0 ? '+' : ''
  return (
    <Card>
      <Typography.Text type="secondary">{title}</Typography.Text>
      <Typography.Title level={3} style={{ marginTop: 8 }}>
        {value}{suffix ? ` ${suffix}` : ''}
      </Typography.Title>
      {delta !== undefined && (
        <Tag
          style={{
            marginTop: 8,
            borderRadius: 999
          }}
        >
          {sign}{delta.toFixed(1)}%
        </Tag>
      )}
    </Card>
  )
}

export default function Dashboard() {
  const { users, purchases, audits, apiKeys, initDemoData, setAll } = useDataStore()
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [range, setRange] = useState<DateRange & { preset: DatePreset }>(() => {
    const now = dayjs()
    return { from: now.startOf('month').toISOString(), to: now.endOf('month').toISOString(), preset: 'This month' }
  })
  const [totalCreditsUsedAll, setTotalCreditsUsedAll] = useState<number>(125430)

  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://server.mailsfinder.com'
    let cancelled = false

    async function load() {
      setLoading(true)
      setBackendError(null)
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/dashboard/bootstrap`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include'
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = await res.json()
        if (cancelled) return

        const usersMapped =
          Array.isArray(body.users)
            ? body.users.map((u: any) => {
                const planRaw = String(u.plan ?? 'free').toLowerCase()
                const plan: Plan =
                  planRaw === 'pro' || planRaw === 'agency' || planRaw === 'lifetime'
                    ? (planRaw as Plan)
                    : 'free'

                const subsRaw: string =
                  u.subscription?.status ??
                  u.subscription_status ??
                  'none'
                const subscription_status: SubscriptionStatus =
                  subsRaw === 'active' || subsRaw === 'cancelled' || subsRaw === 'past_due'
                    ? (subsRaw as SubscriptionStatus)
                    : 'none'

                const credits_find = u.credits_find ?? 0
                const credits_verify = u.credits_verify ?? 0
                const credits_total = u.credits ?? credits_find + credits_verify

                return {
                  id: String(u._id ?? u.id),
                  full_name: u.full_name ?? u.name ?? '',
                  email: u.email,
                  phone: u.phone ?? undefined,
                  country: u.country ?? undefined,
                  onboarding_flag:
                    typeof u.onboarding_flag === 'boolean'
                      ? u.onboarding_flag
                      : u.onboarding_completed === undefined
                      ? undefined
                      : !u.onboarding_completed,
                  createdAt: (u.createdAt && new Date(u.createdAt).toISOString()) || new Date().toISOString(),
                  lastSeen:
                    (u.lastSeen && new Date(u.lastSeen).toISOString()) ||
                    (u.updatedAt && new Date(u.updatedAt).toISOString()) ||
                    undefined,
                  plan,
                  credits_total,
                  credits_find,
                  credits_verify,
                  subscription_status,
                  email_verified: !!u.email_verified,
                  admin_notes: u.admin_notes ?? undefined
                }
              })
            : []

        const purchasesMapped =
          Array.isArray(body.purchases)
            ? body.purchases.map((p: any) => {
                const planRaw = String(p.planName ?? p.plan_name ?? 'free').toLowerCase()
                const planName: Plan =
                  planRaw === 'pro' || planRaw === 'agency' || planRaw === 'lifetime'
                    ? (planRaw as Plan)
                    : 'free'

                const statusRaw: string = p.paymentStatus ?? p.status ?? 'paid'
                const status: 'paid' | 'refunded' | 'pending' =
                  statusRaw === 'refunded'
                    ? 'refunded'
                    : statusRaw === 'pending'
                    ? 'pending'
                    : 'paid'

                return {
                  id: String(p._id ?? p.id),
                  userId: String(p.userId),
                  planName,
                  status,
                  date: p.paymentDate ?? p.date ?? p.createdAt,
                  amount: Number(p.amountPaid ?? p.amount ?? 0)
                }
              })
            : []

        const apiKeysMappedSource = Array.isArray(body.apiKeys)
          ? body.apiKeys
          : Array.isArray(body.apikeys)
          ? body.apikeys
          : []

        const apiKeysMapped = apiKeysMappedSource.map((k: any) => ({
          id: String(k._id ?? k.id),
          userId: k.userId ? String(k.userId) : undefined,
          keyPrefix: k.keyPrefix ?? (typeof k.apiKey === 'string' ? k.apiKey.slice(0, 8) : ''),
          encryptedKey: 'hidden',
          rateLimitPerMinute: k.rateLimitPerMinute ?? 60,
          lastUsedAt:
            (k.lastUsedAt && new Date(k.lastUsedAt).toISOString()) ||
            (k.updatedAt && new Date(k.updatedAt).toISOString()) ||
            undefined,
          usageCount: k.usageCount ?? 0,
          status: k.isActive === false ? 'revoked' : 'active',
          createdAt: (k.createdAt && new Date(k.createdAt).toISOString()) || new Date().toISOString()
        }))

        const auditsMapped = Array.isArray(body.audits) ? body.audits : []

        setAll({
          users: usersMapped,
          purchases: purchasesMapped,
          apiKeys: apiKeysMapped,
          audits: auditsMapped
        })
      } catch (e) {
        if (cancelled) return
        if (users.length === 0) initDemoData()
        setBackendError('Using demo data because backend is not reachable.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (users.length === 0) {
      load()
    }

    return () => {
      cancelled = true
    }
  }, [setAll, initDemoData, token])

  const prevRange = useMemo(() => {
    const from = dayjs(range.from).subtract(1, 'month').startOf('month').toISOString()
    const to = dayjs(range.from).subtract(1, 'month').endOf('month').toISOString()
    return { from, to }
  }, [range])

  const kpiTotalUsers = totalUsers(users, range)
  const kpiActiveSubs = activeSubscriptions(users, range)
  const kpiRevenue = totalRevenue(purchases, range)

  const newUsers = newUsersMoM(users, range, prevRange)
  const churn = churnRate(users, range)
  const active30 = activeUsersLast30(users)

  const rangeFrom = useMemo(() => dayjs(range.from), [range.from])
  const rangeTo = useMemo(() => dayjs(range.to), [range.to])

  const timeSeriesData = useMemo(() => {
    const byDate: Record<string, { date: string; revenue: number; signups: number }> = {}

    purchases.forEach(p => {
      const d = dayjs(p.date)
      if (d.isBefore(rangeFrom) || d.isAfter(rangeTo)) return
      const key = d.format('YYYY-MM-DD')
      if (!byDate[key]) byDate[key] = { date: key, revenue: 0, signups: 0 }
      if (p.status === 'paid') byDate[key].revenue += p.amount
    })

    users.forEach(u => {
      const d = dayjs(u.createdAt)
      if (d.isBefore(rangeFrom) || d.isAfter(rangeTo)) return
      const key = d.format('YYYY-MM-DD')
      if (!byDate[key]) byDate[key] = { date: key, revenue: 0, signups: 0 }
      byDate[key].signups += 1
    })

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [purchases, users, rangeFrom, rangeTo])

  const planDistribution = useMemo(() => {
    const counts: Record<string, number> = { free: 0, pro: 0, agency: 0, lifetime: 0 }
    users.forEach(u => {
      if (counts[u.plan] !== undefined) counts[u.plan] += 1
    })
    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
  }, [users])

  const planColors = ['#d4d4d4', '#a3a3a3', '#737373', '#525252']

  const recentItems = useMemo(() => {
    const signups = users
      .slice()
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
      .slice(0, 50)
      .map(u => ({ type: 'signup', when: u.createdAt, text: `${u.full_name} signed up (${u.email})` }))
    const purchaseItems = purchases
      .slice()
      .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
      .slice(0, 50)
      .map(p => ({ type: 'purchase', when: p.date, text: `Purchase ${p.planName} - ${p.status}` }))
    const creditAdj = audits
      .filter(a => a.action === 'credits.adjust')
      .slice(-50)
      .map(a => ({ type: 'credits', when: a.timestamp, text: `Credits adjusted for ${a.targetId}` }))
    const apiCreate = audits
      .filter(a => a.action === 'apikey.create')
      .slice(-50)
      .map(a => ({ type: 'apikey', when: a.timestamp, text: `API key created ${a.targetId}` }))
    const merged = [...signups, ...purchaseItems, ...creditAdj, ...apiCreate]
      .sort((a, b) => dayjs(b.when).valueOf() - dayjs(a.when).valueOf())
      .slice(0, 50)
    return merged
  }, [users, purchases, audits, apiKeys])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>Dashboard</Typography.Title>
          {backendError && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {backendError}
            </Typography.Text>
          )}
        </div>
        <DateFilter value={range} onChange={setRange} />
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
          <Spin />
        </div>
      )}

      <Row gutter={16}>
        <Col xs={24} sm={12} md={12} lg={6}><KPI title="Total users" value={kpiTotalUsers} /></Col>
        <Col xs={24} sm={12} md={12} lg={6}><KPI title="Active subscriptions" value={kpiActiveSubs} /></Col>
        <Col xs={24} sm={12} md={12} lg={6}><KPI title="Total revenue" value={kpiRevenue} suffix="$" /></Col>
        <Col xs={24} sm={12} md={12} lg={6}><KPI title="Total Credits Used" value={totalCreditsUsedAll} /></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12} md={8}><KPI title="New users (MoM)" value={newUsers.current} delta={newUsers.deltaPct} /></Col>
        <Col xs={24} sm={12} md={8}><KPI title="Churn %" value={Number.isFinite(churn) ? churn.toFixed(1) : 0} suffix="%" /></Col>
        <Col xs={24} sm={12} md={8}><KPI title="Active users (30d)" value={active30} /></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Revenue and signups">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={timeSeriesData}>
                  <CartesianGrid stroke="#262626" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: '#a3a3a3', fontSize: 11 }}
                    stroke="#737373"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: '#a3a3a3', fontSize: 11 }}
                    stroke="#737373"
                  />
                  <Tooltip
                    contentStyle={{ background: '#050505', border: '1px solid #262626' }}
                    labelStyle={{ color: '#f5f5f5' }}
                  />
                  <Legend wrapperStyle={{ color: '#a3a3a3' }} />
                  <Bar
                    yAxisId="left"
                    dataKey="revenue"
                    name="Revenue ($)"
                    fill="#737373"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="signups"
                    name="Signups"
                    fill="#b3b3b3"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Users by plan">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={planDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                  >
                    {planDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={planColors[index % planColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Recent Activity (latest 50)">
        <List
          dataSource={recentItems}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={item.text}
                description={dayjs(item.when).format('YYYY-MM-DD HH:mm')}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
