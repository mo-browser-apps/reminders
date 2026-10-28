/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * A KPI tile: label, big tabular number, change vs the comparison period. "One number is a stat
 * tile, not a chart" (rules/data-display.md). Put several in a `MetricGroup`, inside a `Card` or
 * on the page. With `onSelect` a tile becomes a toggle button that picks which series a chart
 * shows.
 *
 * ```tsx
 * <MetricGroup>
 *   <Metric label="Net sales" value="$48,210" delta={0.124} compareLabel="previous 30 days" />
 *   <Metric label="Refunds" value="$1,302" delta={0.03} invert />
 *   <Metric label="Orders" value="1,204" loading={isLoading} />
 * </MetricGroup>
 * ```
 */
import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Delta } from "@/components/ui/status-badge"

/** A responsive grid of metrics: 1 → 2 → up to 4 columns. */
function MetricGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="metric-group"
      className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4", className)}
      {...props}
    />
  )
}

function Metric({
  label,
  value,
  delta,
  invert,
  compareLabel,
  hint,
  loading = false,
  selected,
  onSelect,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  /** Change as a ratio (`0.12` = +12%); `null` = no baseline. Omit to hide the row. */
  delta?: number | null
  /** Down is good (refunds, costs, latency). */
  invert?: boolean
  /** "previous 30 days" → "vs previous 30 days". */
  compareLabel?: string
  /** Extra muted text on the change row. */
  hint?: React.ReactNode
  /** Renders a skeleton sized like the real content (no layout shift). */
  loading?: boolean
  selected?: boolean
  /** Makes the tile a toggle button (`aria-pressed`). */
  onSelect?: () => void
  className?: string
}) {
  const body = (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      {loading ? (
        <>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-32" />
        </>
      ) : (
        <>
          <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          <span className="flex min-h-4 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {delta !== undefined && <Delta value={delta} invert={invert} />}
            {compareLabel && delta !== undefined && <span>vs {compareLabel}</span>}
            {hint}
          </span>
        </>
      )}
    </>
  )

  const base = "flex min-w-0 flex-col items-start gap-1 rounded-lg p-3 text-left"

  if (onSelect) {
    return (
      <button
        type="button"
        data-slot="metric"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          base,
          "outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
          selected && "bg-muted hover:bg-muted",
          className
        )}
      >
        {body}
      </button>
    )
  }

  return (
    <div data-slot="metric" className={cn(base, className)}>
      {body}
    </div>
  )
}

export { Metric, MetricGroup }
