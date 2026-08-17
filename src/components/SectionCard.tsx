import { ReactNode } from 'react'
import { Typography } from 'antd'

/**
 * Card with a real header row (title, optional description, optional extra
 * slot) and consistent padding. Antd's `<Card title=...>` gives a cramped
 * single-line header with no room for a description.
 */
export default function SectionCard({
  title,
  description,
  extra,
  children,
  bodyClassName,
  noPadding
}: {
  title?: ReactNode
  description?: ReactNode
  extra?: ReactNode
  children: ReactNode
  bodyClassName?: string
  noPadding?: boolean
}) {
  return (
    <section className="mf-card">
      {(title || extra) && (
        <header className="mf-card__head">
          <div className="mf-card__head-text">
            {title && <Typography.Text className="mf-card__title">{title}</Typography.Text>}
            {description && (
              <Typography.Text type="secondary" className="mf-card__desc">
                {description}
              </Typography.Text>
            )}
          </div>
          {extra && <div className="mf-card__extra">{extra}</div>}
        </header>
      )}
      <div className={`mf-card__body${noPadding ? ' mf-card__body--flush' : ''} ${bodyClassName ?? ''}`}>
        {children}
      </div>
    </section>
  )
}
