import { useEffect, useState } from 'react'
import { Card, Typography, Row, Col, List, Tag, Skeleton, Result, theme } from 'antd'
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
import { PLAN_DISPLAY_NAME, Plan } from '../types/types'
import { mapApiKey, mapUser } from '../utils/mappers'
import { PLAN_COLORS, PLAN_ORDER } from '../ui/planTheme'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

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
  const { setAll } = useDataStore()
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const { token: antdToken } = theme.useToken()
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  dayjs.extend(utc)
  const [range, setRange] = useState<DateRange & { preset: DatePreset }>(() => {
    const now = dayjs()
    return { from: now.startOf('month').toISOString(), to: now.endOf('month').toISOString(), preset: 'This month' }
  })
  const [metrics, setMetrics] = useState<{
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
  } | null>(null)

  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : 'https://server.mailsfinder.com')
    let cancelled = false

    async function load() {
      setLoading(true)
      setBackendError(null)
      try {
        const params = new URLSearchParams({
          from: dayjs.utc(range.from).format('YYYY-MM-DD'),
          to: dayjs.utc(range.to).format('YYYY-MM-DD')
        })
        const res = await fetch(`${API_BASE_URL}/api/admin/dashboard/bootstrap?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = await res.json()
        if (cancelled) return

        const usersMapped = Array.isArray(body.users) ? body.users.map(mapUser) : []

        const purchasesMapped =
          Array.isArray(body.purchases)
            ? body.purchases.map((p: any) => {
                const planRaw = String(p.planName ?? p.plan_name ?? 'free').toLowerCase()
                const planName: Plan =
                  planRaw === 'monthly' || planRaw === 'lifetime' || planRaw === 'payg'
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

        const apiKeysMapped = apiKeysMappedSource.map(mapApiKey)

        const auditsMapped = Array.isArray(body.audits) ? body.audits : []

        setAll({
          users: usersMapped,
          purchases: purchasesMapped,
          apiKeys: apiKeysMapped,
          audits: auditsMapped
        })
        if (body.metrics) setMetrics(body.metrics)
      } catch (e) {
        if (cancelled) return
        setAll({ users: [], purchases: [], apiKeys: [], audits: [] })
        setMetrics(null)
        setBackendError('Failed to load. Backend may be unreachable.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [setAll, token, range.from, range.to])

  const usersByPlanDisplay: { name: Plan; value: number }[] = (() => {
    const map = new Map<string, number>((metrics?.usersByPlan ?? []).map(i => [String(i.name).toLowerCase(), Number(i.value) || 0]))
    return PLAN_ORDER.map(name => ({ name, value: map.get(name) ?? 0 })) as any
  })()
  const usersByPlanTotal = usersByPlanDisplay.reduce((acc, i) => acc + (i.value || 0), 0)

  const recentItems = metrics?.latestActivity ?? []

  if (backendError && !loading && !metrics) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>Dashboard</Typography.Title>
          <DateFilter value={range} onChange={setRange} />
        </div>
        <Card>
          <Result status="error" title="Failed to load" subTitle="Backend may be unreachable." />
        </Card>
      </div>
    )
  }

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
        <>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={12} lg={6}><Skeleton active paragraph={{ rows: 2 }} /></Col>
            <Col xs={24} sm={12} md={12} lg={6}><Skeleton active paragraph={{ rows: 2 }} /></Col>
            <Col xs={24} sm={12} md={12} lg={6}><Skeleton active paragraph={{ rows: 2 }} /></Col>
            <Col xs={24} sm={12} md={12} lg={6}><Skeleton active paragraph={{ rows: 2 }} /></Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} lg={16}><Skeleton active paragraph={{ rows: 6 }} /></Col>
            <Col xs={24} lg={8}><Skeleton active paragraph={{ rows: 6 }} /></Col>
          </Row>
          <Card title="Recent Activity (latest 50)" style={{ marginTop: 16 }}>
            <Skeleton active paragraph={{ rows: 5 }} />
          </Card>
        </>
      )}

      <Row gutter={16}>
        <Col xs={24} sm={12} md={12} lg={6}><KPI title="Total users" value={metrics?.totalUsers ?? 0} /></Col>
        <Col xs={24} sm={12} md={12} lg={6}><KPI title="Active subscriptions" value={metrics?.activeSubscriptions ?? 0} /></Col>
        <Col xs={24} sm={12} md={12} lg={6}><KPI title="Total revenue" value={metrics?.totalRevenue ?? 0} suffix="$" /></Col>
        <Col xs={24} sm={12} md={12} lg={6}><KPI title="Total Credits Used" value={metrics?.totalCreditsUsed ?? 0} /></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12} md={8}><KPI title="New users (MoM)" value={metrics?.newUsersThisMonth?.count ?? 0} delta={metrics?.newUsersThisMonth?.deltaPct ?? 0} /></Col>
        <Col xs={24} sm={12} md={8}><KPI title="Churn %" value={Number.isFinite(metrics?.churnPct ?? 0) ? (metrics?.churnPct ?? 0).toFixed(1) : 0} suffix="%" /></Col>
        <Col xs={24} sm={12} md={8}><KPI title="Active users (30d)" value={metrics?.activeUsersLast30 ?? 0} /></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24}>
          <Card title="Revenue and signups">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={metrics?.timeSeries ?? []}>
                  <CartesianGrid stroke={isDarkMode ? '#262626' : antdToken.colorBorder} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: isDarkMode ? '#a3a3a3' : antdToken.colorTextSecondary, fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: isDarkMode ? '#a3a3a3' : antdToken.colorTextSecondary, fontSize: 11 }}
                    stroke={isDarkMode ? '#737373' : antdToken.colorTextSecondary}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: isDarkMode ? '#a3a3a3' : antdToken.colorTextSecondary, fontSize: 11 }}
                    stroke={isDarkMode ? '#737373' : antdToken.colorTextSecondary}
                  />
                  <Tooltip
                    contentStyle={{
                      background: isDarkMode ? '#050505' : antdToken.colorBgContainer,
                      border: `1px solid ${isDarkMode ? '#262626' : antdToken.colorBorder}`
                    }}
                    labelStyle={{ color: isDarkMode ? '#f5f5f5' : antdToken.colorText }}
                  />
                  <Legend wrapperStyle={{ color: isDarkMode ? '#a3a3a3' : antdToken.colorTextSecondary }} />
                  <Bar
                    yAxisId="left"
                    dataKey="revenue"
                    name="Revenue ($)"
                    fill={isDarkMode ? '#737373' : '#93c5fd'}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="signups"
                    name="Signups"
                    fill={isDarkMode ? '#b3b3b3' : '#bfdbfe'}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
      
      <Row gutter={16}>
        <Col xs={24}>
          <Card title="Users by plan">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, boxSizing: 'border-box' }}>
              <div style={{ width: '100%', height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        const pct = usersByPlanTotal > 0 ? Math.round((value / usersByPlanTotal) * 100) : 0
                        return [`${pct}% (${value} users)`, name]
                      }}
                      contentStyle={{
                        background: isDarkMode ? '#050505' : antdToken.colorBgContainer,
                        border: `1px solid ${isDarkMode ? '#262626' : antdToken.colorBorder}`,
                        color: isDarkMode ? '#f5f5f5' : antdToken.colorText
                      }}
                      labelStyle={{ color: isDarkMode ? '#f5f5f5' : antdToken.colorText }}
                      itemStyle={{ color: isDarkMode ? '#f5f5f5' : antdToken.colorText }}
                    />
                    <Pie
                      data={usersByPlanDisplay}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={2}
                      isAnimationActive
                      animationDuration={600}
                      label={false}
                      labelLine={false}
                    >
                      {usersByPlanDisplay.map(entry => (
                        <Cell key={entry.name} fill={PLAN_COLORS[entry.name as keyof typeof PLAN_COLORS]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
                {usersByPlanDisplay.map(item => {
                  const pct = usersByPlanTotal > 0 ? Math.round((item.value / usersByPlanTotal) * 100) : 0
                  const color = PLAN_COLORS[item.name as keyof typeof PLAN_COLORS]
                  return (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
                      <span style={{ color }}>{PLAN_DISPLAY_NAME[item.name as Plan] ?? item.name} – {pct}% ({item.value} users)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Recent Activity">
        <List
          dataSource={recentItems}
          pagination={{ pageSize: 10 }}
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
