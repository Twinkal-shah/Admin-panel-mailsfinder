import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { TableSkeleton } from '../../skeletons'

/**
 * The one table in the app.
 *
 * Six pages previously each configured an Antd `<Table>`; this replaces all of
 * them. It owns the mechanics they share — sorting, selection, server-side
 * pagination, loading, empty state, horizontal scroll, a pinned action column —
 * and takes everything page-specific through slots (`toolbar`, `empty`, and a
 * `render` per column) so no page needs to reach past it.
 */

export type SortOrder = 'ascend' | 'descend'

export interface DataTableColumn<T> {
  key: string
  title: React.ReactNode
  /** Simple field accessor. Ignored when `render` is supplied. */
  dataIndex?: Extract<keyof T, string>
  render?: (row: T, index: number) => React.ReactNode
  width?: number | string
  align?: 'left' | 'center' | 'right'
  /** Presence turns the header into a sort control. Sorting is client-side. */
  sorter?: (a: T, b: T) => number
  defaultSortOrder?: SortOrder
  /** Pins the column to the right edge while the body scrolls sideways. */
  fixed?: 'right'
  className?: string
  headerClassName?: string
  /** Hidden below `md`. For columns that are nice-to-have, not identifying. */
  hideOnMobile?: boolean
}

export interface DataTablePagination {
  page: number
  pageSize: number
  total: number
  onChange: (page: number, pageSize: number) => void
  pageSizeOptions?: number[]
}

export interface DataTableSelection {
  selectedKeys: string[]
  onChange: (keys: string[]) => void
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: Extract<keyof T, string> | ((row: T) => string)
  loading?: boolean
  /** Rendered in place of the body when there are no rows and not loading. */
  empty?: React.ReactNode
  pagination?: DataTablePagination | false
  selection?: DataTableSelection
  rowStyle?: (row: T) => React.CSSProperties | undefined
  rowClassName?: (row: T) => string | undefined
  onRowClick?: (row: T) => void
  /** Rendered above the table, inside the scroll container's parent. */
  toolbar?: React.ReactNode
  /** Accessible name for the table. Always provide one. */
  caption: string
  size?: 'sm' | 'md'
  skeletonRows?: number
}

const ALIGN: Record<'left' | 'center' | 'right', string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right'
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  pagination,
  selection,
  rowStyle,
  rowClassName,
  onRowClick,
  toolbar,
  caption,
  size = 'md',
  skeletonRows = 6
}: DataTableProps<T>) {
  const initialSort = React.useMemo(() => {
    const c = columns.find((col) => col.defaultSortOrder)
    return c ? { key: c.key, order: c.defaultSortOrder! } : null
  }, [columns])

  const [sort, setSort] = React.useState<{ key: string; order: SortOrder } | null>(initialSort)

  const keyOf = React.useCallback(
    (row: T): string => (typeof rowKey === 'function' ? rowKey(row) : String(row[rowKey])),
    [rowKey]
  )

  const sorted = React.useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sorter) return rows
    const next = [...rows].sort(col.sorter)
    return sort.order === 'descend' ? next.reverse() : next
  }, [rows, sort, columns])

  function toggleSort(col: DataTableColumn<T>) {
    if (!col.sorter) return
    setSort((prev) => {
      if (prev?.key !== col.key) return { key: col.key, order: 'ascend' }
      if (prev.order === 'ascend') return { key: col.key, order: 'descend' }
      return null
    })
  }

  const allKeys = sorted.map(keyOf)
  const allSelected = selection ? allKeys.length > 0 && selection.selectedKeys.length === allKeys.length : false
  const someSelected = selection ? selection.selectedKeys.length > 0 && !allSelected : false

  const colCount = columns.length + (selection ? 1 : 0)
  const cellPad = size === 'sm' ? 'px-3 py-2' : 'px-3 py-2.5'

  return (
    <div className="flex flex-col gap-3">
      {toolbar}

      <Table containerClassName="rounded-lg" aria-busy={loading || undefined}>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selection && (
              <TableHead className="w-10 pl-3">
                <Checkbox
                  aria-label="Select all rows on this page"
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(checked) =>
                    selection.onChange(checked ? allKeys : [])
                  }
                />
              </TableHead>
            )}
            {columns.map((col) => {
              const active = sort?.key === col.key
              return (
                <TableHead
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    col.align && ALIGN[col.align],
                    col.hideOnMobile && 'hidden md:table-cell',
                    col.fixed === 'right' &&
                      'sticky right-0 z-10 bg-card shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)]',
                    col.headerClassName
                  )}
                  aria-sort={active ? (sort!.order === 'ascend' ? 'ascending' : 'descending') : undefined}
                >
                  {col.sorter ? (
                    /* A real button, so sorting is reachable by keyboard —
                       Antd's sortable headers were div-only click targets. */
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {col.title}
                      {!active && <ChevronsUpDown className="size-3 opacity-50" />}
                      {active && sort!.order === 'ascend' && <ArrowUp className="size-3" />}
                      {active && sort!.order === 'descend' && <ArrowDown className="size-3" />}
                    </button>
                  ) : (
                    col.title
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colCount} className="p-3">
                <TableSkeleton rows={skeletonRows} cols={Math.min(colCount, 6)} />
              </TableCell>
            </TableRow>
          ) : sorted.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colCount} className="p-0">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((row, index) => {
              const k = keyOf(row)
              const isSelected = selection?.selectedKeys.includes(k) ?? false
              return (
                <TableRow
                  key={k}
                  data-state={isSelected ? 'selected' : undefined}
                  style={rowStyle?.(row)}
                  className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row))}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selection && (
                    <TableCell className="w-10 pl-3">
                      <Checkbox
                        aria-label={`Select row ${k}`}
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={(checked) =>
                          selection.onChange(
                            checked
                              ? [...selection.selectedKeys, k]
                              : selection.selectedKeys.filter((x) => x !== k)
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        cellPad,
                        col.align && ALIGN[col.align],
                        col.hideOnMobile && 'hidden md:table-cell',
                        col.fixed === 'right' &&
                          'sticky right-0 z-10 bg-card shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)]',
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(row, index)
                        : col.dataIndex
                          ? ((row[col.dataIndex] ?? '—') as React.ReactNode)
                          : null}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {pagination && !loading && sorted.length > 0 && (
        <DataTablePaginationBar {...pagination} />
      )}
    </div>
  )
}

/**
 * Always rendered when pagination is configured and there are rows, so the
 * footer does not appear and disappear as the row count crosses a threshold —
 * which is what made the Dashboard tables shift layout.
 */
function DataTablePaginationBar({
  page,
  pageSize,
  total,
  onChange,
  pageSizeOptions = [25, 50, 100, 200]
}: DataTablePagination) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
      </p>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Rows
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onChange(1, Number(v))}
          >
            <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onChange(page - 1, pageSize)}
          >
            <ChevronLeft />
          </Button>
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onChange(page + 1, pageSize)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
