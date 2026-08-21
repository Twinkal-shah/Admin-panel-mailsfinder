/**
 * Shape-matched skeletons: each mirrors the footprint of the real component so
 * the layout does not jump when data lands. Signatures unchanged.
 *
 * `Skeleton` carries `animate-pulse`, which browsers honouring
 * prefers-reduced-motion still animate — that is intentional and matches the
 * previous behaviour, which was the one place reduced motion was respected.
 */
import { Skeleton } from '@/components/ui/skeleton'

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="flex flex-col justify-end gap-2" style={{ height }} aria-busy="true">
      <div className="flex flex-1 items-end gap-2">
        {[52, 74, 38, 88, 61, 45, 79, 56, 92, 41, 68, 50].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
      <Skeleton className="h-2 w-full shrink-0" />
    </div>
  )
}

export function DonutSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }} aria-busy="true">
      <Skeleton className="size-40 rounded-full" />
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true">
      <div className="flex gap-3">
        {Array.from({ length: cols }, (_, c) => (
          <Skeleton key={c} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-1/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
