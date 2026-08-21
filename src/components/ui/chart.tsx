import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import type { LegendPayload, TooltipContentProps } from 'recharts'

import { cn } from '@/lib/utils'

/**
 * Recharts wrapper in the shadcn shape, retyped for recharts 3.
 *
 * Two things this buys us:
 * 1. Series colours come from `ChartConfig` and are injected as CSS custom
 *    properties, so charts read `--color-*` from the theme instead of the
 *    hardcoded hex + `antd theme.useToken()` the old charts used. That is what
 *    lets `useIsDark` and its MutationObserver be deleted.
 * 2. Tooltip/legend chrome uses popover tokens, so it is correct in both
 *    themes with no JS branching.
 *
 * recharts 3 deltas handled here (the upstream shadcn wrapper targets v2):
 * - custom tooltip content is typed `TooltipContentProps`, not `TooltipProps`
 * - the legend's internal `payload` prop is gone; we take `LegendPayload[]`
 * - `accessibilityLayer` now defaults to true, which we want
 */

export type ChartConfig = Record<
  string,
  { label?: React.ReactNode; icon?: React.ComponentType } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<'light' | 'dark', string> }
  )
>

type ChartContextProps = { config: ChartConfig }

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error('useChart must be used within a <ChartContainer />')
  return context
}

const THEMES = { light: '', dark: '.dark' } as const

/** Emits `--color-<key>` per series, once per chart id, for both themes. */
function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, v]) => v.theme || v.color)
  if (!colorConfig.length) return null

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, item]) => {
    const color = item.theme?.[theme as keyof typeof item.theme] || item.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .filter(Boolean)
  .join('\n')}
}
`
          )
          .join('\n')
      }}
    />
  )
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        data-slot="chart"
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-none [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function getPayloadConfig(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== 'object' || payload === null) return undefined
  const p = payload as Record<string, unknown>
  const inner = typeof p.payload === 'object' && p.payload !== null ? (p.payload as Record<string, unknown>) : undefined

  let configKey = key
  if (typeof p[key] === 'string') configKey = p[key] as string
  else if (inner && typeof inner[key] === 'string') configKey = inner[key] as string

  return configKey in config ? config[configKey] : config[key]
}

function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
  className,
  indicator = 'dot',
  hideLabel = false,
  hideIndicator = false,
  labelKey,
  nameKey,
  color
}: Partial<TooltipContentProps<number | string, string>> & {
  className?: string
  indicator?: 'line' | 'dot' | 'dashed'
  hideLabel?: boolean
  hideIndicator?: boolean
  labelKey?: string
  nameKey?: string
  color?: string
}) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) return null
    const [item] = payload
    const key = labelKey || (typeof item?.name === 'string' ? item.name : 'value')
    const itemConfig = getPayloadConfig(config, item, key)
    const value = !labelKey && typeof label === 'string' ? (config[label]?.label ?? label) : itemConfig?.label
    if (labelFormatter) {
      return <div className="font-medium">{labelFormatter(value as string, payload)}</div>
    }
    if (!value) return null
    return <div className="font-medium">{value}</div>
  }, [label, labelFormatter, payload, hideLabel, labelKey, config])

  if (!active || !payload?.length) return null

  const nestLabel = payload.length === 1 && indicator !== 'dot'

  return (
    <div
      className={cn(
        'grid min-w-[9rem] items-start gap-1.5 rounded-lg bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10',
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = nameKey || (typeof item.name === 'string' ? item.name : 'value')
          const itemConfig = getPayloadConfig(config, item, key)
          const indicatorColor = color || item.payload?.fill || item.color

          return (
            <div
              key={`${item.dataKey ?? index}`}
              className={cn(
                'flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-2.5 [&>svg]:text-muted-foreground',
                indicator === 'dot' && 'items-center'
              )}
            >
              {formatter && item?.value !== undefined && item.name ? (
                formatter(item.value, item.name, item, index, payload)
              ) : (
                <>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <div
                        className={cn('shrink-0 rounded-[2px]', {
                          'size-2.5': indicator === 'dot',
                          'w-1': indicator === 'line',
                          'w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed',
                          'my-0.5': nestLabel && indicator === 'dashed'
                        })}
                        style={
                          {
                            backgroundColor: indicator === 'dashed' ? 'transparent' : indicatorColor,
                            borderColor: indicatorColor
                          } as React.CSSProperties
                        }
                      />
                    )
                  )}
                  <div
                    className={cn(
                      'flex flex-1 justify-between leading-none',
                      nestLabel ? 'items-end' : 'items-center'
                    )}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
                    </div>
                    {item.value !== undefined && (
                      <span className="ml-2 font-mono font-medium tabular-nums text-foreground">
                        {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = 'bottom',
  nameKey
}: {
  className?: string
  hideIcon?: boolean
  /* recharts 3 passes this through the Legend `content` render prop. */
  payload?: ReadonlyArray<LegendPayload>
  verticalAlign?: 'top' | 'bottom' | 'middle'
  nameKey?: string
}) {
  const { config } = useChart()
  if (!payload?.length) return null

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-4',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className
      )}
    >
      {payload.map((item) => {
        const key = nameKey || (typeof item.dataKey === 'string' ? item.dataKey : 'value')
        const itemConfig = getPayloadConfig(config, item, key)

        return (
          <div
            key={item.value ?? key}
            className="flex items-center gap-1.5 text-xs text-muted-foreground [&>svg]:size-3 [&>svg]:text-muted-foreground"
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color }}
              />
            )}
            {itemConfig?.label ?? item.value}
          </div>
        )
      })}
    </div>
  )
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle
}
