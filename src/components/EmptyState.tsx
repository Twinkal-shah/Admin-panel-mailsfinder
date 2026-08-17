import { ReactNode } from 'react'
import { Typography } from 'antd'
import { InboxOutlined } from '@ant-design/icons'

export default function EmptyState({
  title,
  hint,
  icon,
  action,
  compact
}: {
  title: string
  hint?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`mf-empty${compact ? ' mf-empty--compact' : ''}`}>
      <span className="mf-empty__icon">{icon ?? <InboxOutlined />}</span>
      <Typography.Text className="mf-empty__title">{title}</Typography.Text>
      {hint && (
        <Typography.Text type="secondary" className="mf-empty__hint">
          {hint}
        </Typography.Text>
      )}
      {action && <div className="mf-empty__action">{action}</div>}
    </div>
  )
}
