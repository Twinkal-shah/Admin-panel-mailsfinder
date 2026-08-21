import { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Card with a real header row (title, optional description, optional extra
 * slot). Props unchanged from the Antd version.
 *
 * `noPadding` maps to a flush CardContent, which is what table-in-a-card wants
 * so the table's own cell padding provides the rhythm.
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
    <Card>
      {(title || extra) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {extra && <CardAction>{extra}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={cn(noPadding && 'px-0', bodyClassName)}>{children}</CardContent>
    </Card>
  )
}
