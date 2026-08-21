import { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export interface StatCardProps {
  label: string
  value: ReactNode
  /** Rendered small and muted under the value. */
  hint?: ReactNode
  icon?: ReactNode
  /** Percentage change. Positive renders as an up pill, negative as down. */
  delta?: number
  loading?: boolean
}

/* Up is chart-2 (the light end of the crimson ramp) and down is destructive.
 * The old implementation used a lone #4ade80 green, the only non-brand hue in
 * the system. */
function DeltaPill({ delta }: { delta: number }) {
  const positive = delta >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-4xl px-1.5 py-0.5 text-xs font-medium tabular-nums',
        positive ? 'bg-chart-2/15 text-chart-2' : 'bg-destructive/10 text-destructive'
      )}
    >
      {positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

export default function StatCard({ label, value, hint, icon, delta, loading }: StatCardProps) {
  if (loading) {
    return (
      <Card size="sm" className="gap-2 px-3" aria-busy="true">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="size-4 rounded-sm" />
        </div>
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-3 w-16" />
      </Card>
    )
  }

  return (
    <Card size="sm" className="gap-2 px-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>}
      </div>
      {/* aria-live so a stale -> fresh refresh is announced rather than silent. */}
      <div className="text-2xl font-semibold tabular-nums" aria-live="polite">
        {value}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {delta !== undefined && Number.isFinite(delta) && <DeltaPill delta={delta} />}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  )
}
