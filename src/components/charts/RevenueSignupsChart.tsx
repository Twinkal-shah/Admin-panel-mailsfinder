import { theme } from 'antd'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts'
import dayjs from 'dayjs'
import { useIsDark } from '../../ui/useIsDark'

export interface RevenuePoint {
  date: string
  revenue: number
  signups: number
}

export default function RevenueSignupsChart({
  data,
  height = 280
}: {
  data: RevenuePoint[]
  height?: number
}) {
  const { token } = theme.useToken()
  const isDark = useIsDark()

  const grid = isDark ? 'rgba(226, 190, 191, 0.10)' : 'rgba(226, 190, 191, 0.55)'
  const axisText = isDark ? '#e2bebf' : '#5a4042'
  const surface = isDark ? '#1b1c1b' : '#ffffff'

  return (
    // Fills the card when the grid row is stretched by the taller sibling.
    <div className="mf-chart-fill" style={{ width: '100%', height: '100%', minHeight: height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barGap={2}>
          <CartesianGrid stroke={grid} vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: axisText, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: grid }}
            tickMargin={8}
            minTickGap={16}
            tickFormatter={(v: string) => {
              const d = dayjs(v)
              return d.isValid() ? d.format('MMM D') : v
            }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: axisText, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: axisText, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: isDark ? 'rgba(183, 29, 63, 0.10)' : 'rgba(183, 29, 63, 0.06)' }}
            contentStyle={{
              background: surface,
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 10,
              boxShadow: isDark
                ? '0 10px 32px rgba(0,0,0,0.45)'
                : '0 10px 28px rgba(91, 28, 47, 0.12)',
              fontSize: 12
            }}
            labelStyle={{ color: token.colorText, fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: token.colorText }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
            // Recharts colours legend text with the series fill; the pale
            // signups rose is unreadable on white. Swatch keeps the colour,
            // the label uses the axis text token.
            formatter={(value: string) => <span style={{ color: axisText }}>{value}</span>}
          />
          {/* Deep burgundy vs. the palette's pale rose. #b71d3f and #fc536d
              sit at nearly the same luminance, so side-by-side bars in those
              two read as one series. */}
          <Bar
            yAxisId="left"
            dataKey="revenue"
            name="Revenue ($)"
            fill="#b71d3f"
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
          />
          <Bar
            yAxisId="right"
            dataKey="signups"
            name="Signups"
            fill={isDark ? '#e2bebf' : '#ff8fa3'}
            radius={[3, 3, 0, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
