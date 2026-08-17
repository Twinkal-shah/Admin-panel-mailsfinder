/**
 * Shape-matched skeletons. The old dashboard rendered one generic
 * `<Skeleton paragraph={{rows: 6}} />` per region *in addition to* the real
 * (zero-filled) content below it, which is why loading looked like a wall of
 * gray blocks. These mirror the real component's footprint so the layout does
 * not jump when data lands.
 */

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="mf-chart-skel" style={{ height }} aria-busy="true">
      <div className="mf-chart-skel__bars">
        {[52, 74, 38, 88, 61, 45, 79, 56, 92, 41, 68, 50].map((h, i) => (
          <span key={i} className="mf-skel mf-chart-skel__bar" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mf-chart-skel__axis" />
    </div>
  )
}

export function DonutSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="mf-donut-skel" style={{ height }} aria-busy="true">
      <span className="mf-donut-skel__ring" />
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="mf-table-skel" aria-busy="true">
      <div className="mf-table-skel__row mf-table-skel__row--head">
        {Array.from({ length: cols }, (_, c) => (
          <span key={c} className="mf-skel mf-table-skel__cell" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="mf-table-skel__row">
          {Array.from({ length: cols }, (_, c) => (
            <span key={c} className="mf-skel mf-table-skel__cell" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mf-list-skel" aria-busy="true">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="mf-list-skel__row">
          <span className="mf-skel mf-list-skel__dot" />
          <div className="mf-list-skel__lines">
            <span className="mf-skel mf-list-skel__line" />
            <span className="mf-skel mf-list-skel__line mf-list-skel__line--short" />
          </div>
        </div>
      ))}
    </div>
  )
}
