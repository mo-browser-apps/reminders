/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * Building blocks for list screens on top of the `Table` primitives — no table library
 * (`@tanstack/react-table` is not installed; rules/data-display.md). Sorting, filtering and
 * paging are plain state + `useMemo`; these parts keep the chrome consistent and accessible.
 * Row states (loading/empty/no results/error) are in `@/components/ui/table-state`.
 *
 * ```tsx
 * const [sort, setSort] = React.useState<SortState<"date" | "total">>({ key: "date", dir: "desc" })
 * const sorted = React.useMemo(() => [...rows].sort(compareBy((r) => r[sort.key], sort.dir)), [rows, sort])
 * const visible = paginate(sorted, page, pageSize)
 * const selection = useSelection(visible.map((r) => r.id))
 *
 * <TableToolbar><SearchField … /><FacetedFilter … /></TableToolbar>
 * <TableCard caption="Orders">
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead className="w-0"><SelectAllCheckbox state={selection.headerState} onToggle={selection.toggleAllVisible} /></TableHead>
 *       <SortableHead label="Date" sortKey="date" sort={sort} onSort={setSort} />
 *       <SortableHead label="Total" sortKey="total" sort={sort} onSort={setSort} align="right" />
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>…</TableBody>
 * </TableCard>
 * <TablePagination page={page} pageSize={pageSize} total={sorted.length} onPageChange={setPage} noun="orders" />
 * <BulkActionBar count={selection.count} noun="order" onClear={selection.clear}>…</BulkActionBar>
 * ```
 */
import * as React from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableCaption, TableHead } from "@/components/ui/table"

const count = new Intl.NumberFormat("en-US")

/**
 * The standard framed table: a `Card` whose first/last columns line up with the card's 16px
 * padding, with an accessible (sr-only) caption. `Table` keeps its own horizontal scroller —
 * never wrap it in another.
 */
function TableCard({
  caption,
  className,
  tableClassName,
  children,
}: {
  /** Accessible name for the table. */
  caption: string
  className?: string
  tableClassName?: string
  children: React.ReactNode
}) {
  return (
    <Card data-slot="table-card" className={cn("shrink-0 gap-0 py-0", className)}>
      <Table
        className={cn(
          "[&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4 [&_thead_th]:h-10 [&_thead_th]:text-muted-foreground [&_tbody_td]:h-12",
          tableClassName
        )}
      >
        <TableCaption className="sr-only">{caption}</TableCaption>
        {children}
      </Table>
    </Card>
  )
}

/** The row above a table: search, filters, trailing controls. Wraps at narrow widths. */
function TableToolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-toolbar"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  )
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc"
type SortState<K extends string> = { key: K; dir: SortDir }

/**
 * A header cell with a real button and `aria-sort`. The first click on an inactive column sorts
 * `defaultDir` (desc suits numbers and dates); the next click flips it.
 */
function SortableHead<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  defaultDir = "desc",
  align = "left",
  className,
}: {
  label: string
  sortKey: K
  sort: SortState<K>
  onSort: (next: SortState<K>) => void
  defaultDir?: SortDir
  align?: "left" | "right"
  className?: string
}) {
  const active = sort.key === sortKey
  const Icon = !active ? ChevronsUpDownIcon : sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon
  return (
    <TableHead
      data-slot="sortable-head"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(align === "right" && "text-right", className)}
    >
      <Button
        variant="ghost"
        size="xs"
        className={cn(
          "-mx-2 font-medium text-muted-foreground hover:text-foreground",
          active && "text-foreground",
          align === "right" && "flex-row-reverse"
        )}
        onClick={() =>
          onSort({
            key: sortKey,
            dir: active ? (sort.dir === "asc" ? "desc" : "asc") : defaultDir,
          })
        }
      >
        {label}
        <Icon
          data-icon={align === "right" ? "inline-start" : "inline-end"}
          className={cn(!active && "opacity-50")}
        />
      </Button>
    </TableHead>
  )
}

/** Comparator for `useMemo` sorts; `null`/`undefined` always sort last. */
function compareBy<T>(get: (row: T) => string | number | Date | null | undefined, dir: SortDir) {
  return (a: T, b: T) => {
    const x = get(a)
    const y = get(b)
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    const left = x instanceof Date ? x.getTime() : x
    const right = y instanceof Date ? y.getTime() : y
    const result =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true })
    return dir === "asc" ? result : -result
  }
}

// ─── Pagination ──────────────────────────────────────────────────────────────

const PAGE_SIZES = [25, 50, 100]

function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  return rows.slice((page - 1) * pageSize, page * pageSize)
}

/** "1–25 of 1,204 orders", rows-per-page (hidden on narrow windows) and previous/next. */
function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = PAGE_SIZES,
  noun = "results",
  className,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizes?: number[]
  noun?: string
  className?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const sizes = pageSizes.map((size) => ({ value: String(size), label: `${size} per page` }))
  return (
    <nav
      data-slot="table-pagination"
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground",
        className
      )}
    >
      <span className="tabular-nums">
        {total === 0
          ? `No ${noun}`
          : `${count.format(from)}–${count.format(to)} of ${count.format(total)} ${noun}`}
      </span>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <Select
            items={sizes}
            value={String(pageSize)}
            onValueChange={(value) => value && onPageSizeChange(Number(value))}
          >
            <SelectTrigger size="sm" className="hidden w-32 sm:flex" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {sizes.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <span className="hidden tabular-nums md:inline">
          Page {count.format(page)} of {count.format(pages)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  )
}

// ─── Selection ───────────────────────────────────────────────────────────────

/** Row selection across pages; the header checkbox acts on the rows currently visible. */
function useSelection(visibleIds: string[]) {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const visibleSelected = visibleIds.filter((id) => selected.has(id)).length
  const allVisible = visibleIds.length > 0 && visibleSelected === visibleIds.length
  return {
    selected,
    count: selected.size,
    isSelected: (id: string) => selected.has(id),
    toggle: (id: string) =>
      setSelected((previous) => {
        const next = new Set(previous)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    /** State for `SelectAllCheckbox`. */
    headerState: allVisible
      ? (true as const)
      : visibleSelected > 0
        ? ("indeterminate" as const)
        : (false as const),
    toggleAllVisible: () =>
      setSelected((previous) => {
        const next = new Set(previous)
        if (allVisible) visibleIds.forEach((id) => next.delete(id))
        else visibleIds.forEach((id) => next.add(id))
        return next
      }),
    selectMany: (ids: string[]) => setSelected(new Set(ids)),
    clear: () => setSelected(new Set()),
  }
}

function SelectAllCheckbox({
  state,
  onToggle,
  label = "Select all rows on this page",
}: {
  state: boolean | "indeterminate"
  onToggle: () => void
  label?: string
}) {
  return (
    <Checkbox
      aria-label={label}
      checked={state === true}
      indeterminate={state === "indeterminate"}
      onCheckedChange={onToggle}
    />
  )
}

/**
 * Floating bar while rows are selected: count, actions, clear. Sticky at the bottom of the
 * scroll container, so it never pushes the table around.
 */
function BulkActionBar({
  count: selectedCount,
  noun,
  onClear,
  className,
  children,
}: {
  count: number
  /** Singular: "order" → "3 orders selected". */
  noun: string
  onClear: () => void
  className?: string
  children: React.ReactNode
}) {
  if (selectedCount === 0) return null
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      data-slot="bulk-action-bar"
      className={cn(
        "sticky bottom-4 z-10 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border bg-popover p-1.5 pl-3 text-sm text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom-2",
        className
      )}
    >
      <span className="font-medium tabular-nums">
        {count.format(selectedCount)} {selectedCount === 1 ? noun : `${noun}s`} selected
      </span>
      <span aria-hidden="true" className="h-4 w-px bg-border" />
      <div className="flex flex-wrap items-center gap-1">{children}</div>
      <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onClear}>
        <XIcon />
      </Button>
    </div>
  )
}

export {
  BulkActionBar,
  PAGE_SIZES,
  SelectAllCheckbox,
  SortableHead,
  TableCard,
  TablePagination,
  TableToolbar,
  compareBy,
  paginate,
  useSelection,
}
export type { SortDir, SortState }
