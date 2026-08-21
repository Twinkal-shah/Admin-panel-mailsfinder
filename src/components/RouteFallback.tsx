import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from './skeletons'

/**
 * Shown for the few hundred ms a lazily-loaded route chunk takes to arrive.
 * Renders inside the already-painted shell, so the sidebar and header stay put
 * and the page never blanks.
 */
export default function RouteFallback() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Card>
        <CardContent>
          <TableSkeleton rows={6} cols={5} />
        </CardContent>
      </Card>
    </div>
  )
}
