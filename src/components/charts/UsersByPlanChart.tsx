import { Cell, Pie, PieChart } from 'recharts'

import { planColor, planDotStyle } from '../../ui/planTheme'
import { PLAN_DISPLAY_NAME, Plan } from '../../types/types'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'

export interface PlanSlice {
  name: Plan
  value: number
  // Recharts' data prop requires an index signature.
  [key: string]: unknown
}

const chartConfig: ChartConfig = {
  free: { label: PLAN_DISPLAY_NAME.free },
  monthly: { label: PLAN_DISPLAY_NAME.monthly },
  lifetime: { label: PLAN_DISPLAY_NAME.lifetime },
  payg: { label: PLAN_DISPLAY_NAME.payg }
}

/**
 * Users-by-plan donut with its own legend.
 *
 * Slice colours come from the themed `--plan-*` tokens, so this no longer needs
 * `useIsDark` or Antd's `theme.useToken()` to choose a palette per theme.
 */
export default function UsersByPlanChart({
  data,
  total,
  height = 280
}: {
  data: PlanSlice[]
  total: number
  height?: number
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="relative" style={{ minHeight: height }}>
        <ChartContainer config={chartConfig} className="aspect-auto size-full">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) => {
                    const v = Number(value)
                    const pct = total > 0 ? Math.round((v / total) * 100) : 0
                    return (
                      <div className="flex flex-1 items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {PLAN_DISPLAY_NAME[name as Plan] ?? name}
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {pct}% · {v.toLocaleString()}
                        </span>
                      </div>
                    )
                  }}
                />
              }
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
              {data.map((entry) => (
                <Cell key={entry.name} fill={planColor(entry.name)} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Centre label sits over the donut hole. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">users</span>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {data.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
          return (
            <li key={item.name} className="flex items-center gap-2 text-sm">
              <span
                className="size-2 shrink-0 rounded-full"
                style={planDotStyle(item.name)}
                aria-hidden="true"
              />
              <span className="truncate">{PLAN_DISPLAY_NAME[item.name] ?? item.name}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {item.value.toLocaleString()} · {pct}%
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
