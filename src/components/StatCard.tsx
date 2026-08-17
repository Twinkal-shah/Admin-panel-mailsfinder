import { ReactNode } from 'react'
import { Typography } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'

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

function DeltaPill({ delta }: { delta: number }) {
  const positive = delta >= 0
  return (
    <span className={`mf-delta ${positive ? 'mf-delta--up' : 'mf-delta--down'}`}>
      {positive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

export default function StatCard({ label, value, hint, icon, delta, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="mf-stat mf-stat--loading" aria-busy="true">
        <div className="mf-stat__top">
          <span className="mf-skel mf-skel--label" />
          <span className="mf-skel mf-skel--icon" />
        </div>
        <span className="mf-skel mf-skel--value" />
        <span className="mf-skel mf-skel--hint" />
      </div>
    )
  }

  return (
    <div className="mf-stat">
      <div className="mf-stat__top">
        <Typography.Text className="mf-stat__label">{label}</Typography.Text>
        {icon && <span className="mf-stat__icon">{icon}</span>}
      </div>
      <div className="mf-stat__value">{value}</div>
      <div className="mf-stat__foot">
        {delta !== undefined && Number.isFinite(delta) && <DeltaPill delta={delta} />}
        {hint && <Typography.Text className="mf-stat__hint">{hint}</Typography.Text>}
      </div>
    </div>
  )
}
