import { theme, Typography } from 'antd'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { PLAN_COLORS } from '../../ui/planTheme'
import { PLAN_DISPLAY_NAME, Plan } from '../../types/types'
import { useIsDark } from '../../ui/useIsDark'

export interface PlanSlice {
  name: Plan
  value: number
  // Recharts' data prop requires an index signature.
  [key: string]: unknown
}

export default function UsersByPlanChart({
  data,
  total,
  height = 280
}: {
  data: PlanSlice[]
  total: number
  height?: number
}) {
  const { token } = theme.useToken()
  const isDark = useIsDark()
  const surface = isDark ? '#1b1c1b' : '#ffffff'

  return (
    <div className="mf-donut">
      <div className="mf-donut__chart" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Tooltip
              formatter={(value: number, name: string) => {
                const pct = total > 0 ? Math.round((value / total) * 100) : 0
                return [`${pct}% · ${value.toLocaleString()} users`, PLAN_DISPLAY_NAME[name as Plan] ?? name]
              }}
              contentStyle={{
                background: surface,
                border: `1px solid ${token.colorBorder}`,
                borderRadius: 10,
                boxShadow: isDark
                  ? '0 10px 32px rgba(0,0,0,0.45)'
                  : '0 10px 28px rgba(91, 28, 47, 0.12)',
                fontSize: 12
              }}
              labelStyle={{ color: token.colorText, fontWeight: 600 }}
              itemStyle={{ color: token.colorText }}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive
              animationDuration={500}
              label={false}
              labelLine={false}
            >
              {data.map(entry => (
                <Cell key={entry.name} fill={PLAN_COLORS[entry.name]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="mf-donut__center">
          <span className="mf-donut__total">{total.toLocaleString()}</span>
          <span className="mf-donut__caption">users</span>
        </div>
      </div>

      <ul className="mf-legend">
        {data.map(item => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
          return (
            <li key={item.name} className="mf-legend__row">
              <span className="mf-legend__dot" style={{ background: PLAN_COLORS[item.name] }} />
              <span className="mf-legend__name">{PLAN_DISPLAY_NAME[item.name] ?? item.name}</span>
              <Typography.Text type="secondary" className="mf-legend__value">
                {item.value.toLocaleString()} · {pct}%
              </Typography.Text>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
