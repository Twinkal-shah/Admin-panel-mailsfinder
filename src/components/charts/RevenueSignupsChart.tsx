import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import dayjs from 'dayjs'

import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'

export interface RevenuePoint {
  date: string
  revenue: number
  signups: number
}

/* Two series separated by LIGHTNESS, not hue. The original #b71d3f / #fc536d
 * pairing read as a single series because the two sit at nearly the same
 * luminance; chart-1 (mid crimson) against chart-2 (pale rose) keeps them
 * distinguishable in both themes. */
const chartConfig: ChartConfig = {
  revenue: { label: 'Revenue ($)', color: 'var(--chart-1)' },
  signups: { label: 'Signups', color: 'var(--chart-2)' }
}

export default function RevenueSignupsChart({
  data,
  height = 280
}: {
  data: RevenuePoint[]
  height?: number
}) {
  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto size-full"
      style={{ minHeight: height }}
    >
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barGap={2}>
        {/* recharts 3 requires the grid to name an axis it shares with a real
            YAxis, or it renders nothing. This chart has two Y axes
            ("left"/"right") and the previous version named neither — so the
            grid lines were silently missing. */}
        <CartesianGrid yAxisId="left" vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          tickMargin={8}
          minTickGap={16}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => {
            const d = dayjs(v)
            return d.isValid() ? d.format('MMM D') : v
          }}
        />
        <YAxis
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <ChartLegend verticalAlign="top" content={<ChartLegendContent verticalAlign="top" />} />
        <Bar
          yAxisId="left"
          dataKey="revenue"
          name="revenue"
          fill="var(--color-revenue)"
          radius={[3, 3, 0, 0]}
          maxBarSize={22}
        />
        <Bar
          yAxisId="right"
          dataKey="signups"
          name="signups"
          fill="var(--color-signups)"
          radius={[3, 3, 0, 0]}
          maxBarSize={22}
        />
      </BarChart>
    </ChartContainer>
  )
}
