import { ReactNode } from 'react'
import { Typography } from 'antd'

/**
 * One consistent page title block for every route. Replaces the ad-hoc
 * `<Typography.Title level={3}>` + flex row that each page reimplemented
 * slightly differently.
 */
export default function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mf-page-header">
      <div className="mf-page-header__text">
        <Typography.Title level={3} className="mf-page-header__title">
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text type="secondary" className="mf-page-header__subtitle">
            {subtitle}
          </Typography.Text>
        )}
      </div>
      {actions && <div className="mf-page-header__actions">{actions}</div>}
    </div>
  )
}
