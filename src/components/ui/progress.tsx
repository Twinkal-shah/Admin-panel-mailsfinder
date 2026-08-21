import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Progress meter. Not in the starter kit; used by UserDetail's credit meters.
 *
 * Built on the native ARIA progressbar contract rather than a primitive
 * package — it has no interaction, so a dependency would buy nothing.
 * `indicatorClassName` exists so a caller can tint the bar (e.g. a credit
 * meter that turns destructive near its cap) without hardcoding a colour here.
 */
function Progress({
  className,
  indicatorClassName,
  value = 0,
  max = 100,
  label,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  value?: number | null
  max?: number
  indicatorClassName?: string
  label?: string
}) {
  const safeMax = max > 0 ? max : 100
  const clamped = Math.min(Math.max(value ?? 0, 0), safeMax)
  const pct = (clamped / safeMax) * 100

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      aria-valuetext={`${Math.round(pct)}%`}
      aria-label={label}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn('h-full rounded-full bg-primary transition-[width] duration-300', indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export { Progress }
