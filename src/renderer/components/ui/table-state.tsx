/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * The non-happy rows every table needs (rules/data-display.md): loading, first-use empty,
 * "no results" for a filter (a different message from empty), and error with retry. Derive
 * `columns` from one constant so `colSpan` can't drift from the real column count.
 *
 * ```tsx
 * const COLUMNS = 6
 * <TableBody>
 *   {status === "error" ? (
 *     <TableErrorRow columns={COLUMNS} onRetry={reload} />
 *   ) : status === "loading" ? (
 *     <TableSkeletonRows columns={COLUMNS} />
 *   ) : rows.length === 0 ? (
 *     filtersActive ? (
 *       <TableNoResultsRow columns={COLUMNS} query={query} noun="orders" onClear={clearFilters} />
 *     ) : (
 *       <TableEmptyRow columns={COLUMNS}>
 *         <Empty>…first-use copy and a primary action…</Empty>
 *       </TableEmptyRow>
 *     )
 *   ) : (
 *     rows.map(…)
 *   )}
 * </TableBody>
 * ```
 */
import * as React from "react"
import { RefreshCwIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"

const SKELETON_WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-16"]

/**
 * Placeholder rows at the real row height. Pass the same responsive classes the real cells use
 * (`cellClassNames={[, , "hidden md:table-cell"]}`) so the skeleton hides the same columns.
 */
function TableSkeletonRows({
  columns,
  rows = 8,
  cellClassNames,
  rowClassName = "h-12",
}: {
  columns: number
  rows?: number
  cellClassNames?: (string | undefined)[]
  rowClassName?: string
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow
          key={`skeleton-${r}`}
          data-slot="table-skeleton-row"
          aria-hidden="true"
          className={cn("hover:bg-transparent", rowClassName)}
        >
          {Array.from({ length: columns }, (_, c) => (
            <TableCell key={c} className={cellClassNames?.[c]}>
              <Skeleton className={cn("h-4", SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length])} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

/** A full-width row for any non-row content — usually an `Empty` first-use state. */
function TableEmptyRow({
  columns,
  className,
  children,
}: {
  columns: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <TableRow data-slot="table-empty-row" className="hover:bg-transparent">
      <TableCell colSpan={columns} className={cn("p-0 whitespace-normal", className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}

/** "Filters matched nothing" — distinct from first-use empty, and always offers a way out. */
function TableNoResultsRow({
  columns,
  query,
  noun = "results",
  onClear,
  clearLabel = "Clear search and filters",
}: {
  columns: number
  query?: string
  noun?: string
  onClear: () => void
  clearLabel?: string
}) {
  return (
    <TableEmptyRow columns={columns}>
      <Empty className="py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>No {noun} found</EmptyTitle>
          <EmptyDescription>
            {query
              ? `Nothing matches “${query}” with the current filters. Try a different search or clear the filters.`
              : `No ${noun} match these filters.`}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onClear}>
            {clearLabel}
          </Button>
        </EmptyContent>
      </Empty>
    </TableEmptyRow>
  )
}

/** Load failure with a working retry. */
function TableErrorRow({
  columns,
  title = "Couldn’t load this list",
  message = "The request didn’t complete. This is usually temporary.",
  onRetry,
}: {
  columns: number
  title?: string
  message?: React.ReactNode
  onRetry: () => void
}) {
  return (
    <TableEmptyRow columns={columns} className="p-4">
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
        <div className="col-start-2 mt-2">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCwIcon data-icon="inline-start" />
            Try again
          </Button>
        </div>
      </Alert>
    </TableEmptyRow>
  )
}

export { TableEmptyRow, TableErrorRow, TableNoResultsRow, TableSkeletonRows }
