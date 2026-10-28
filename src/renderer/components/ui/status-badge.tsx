/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * The status pill and the change indicator. The tone is a quick-scan cue; the text always
 * carries the meaning, so state survives grayscale and screen readers
 * (rules/accessibility.md). Keep the domain mapping (order status → tone + label) in your app:
 *
 * ```tsx
 * const ORDER_STATUS = { paid: { tone: "success", label: "Paid" }, … } satisfies
 *   Record<OrderStatus, { tone: StatusTone; label: string }>
 * <StatusBadge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</StatusBadge>
 * <Delta value={0.124} />          // ↗ +12.4%
 * <Delta value={0.03} invert />    // refunds up is bad → red
 * ```
 */
import * as React from "react"
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral"

const DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-primary",
  neutral: "bg-muted-foreground/50",
}

/** A neutral outline pill with a colored dot. One status per badge; the label is required. */
function StatusBadge({
  tone,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Badge>, "variant"> & { tone: StatusTone }) {
  return (
    <Badge
      data-slot="status-badge"
      data-tone={tone}
      variant="outline"
      className={cn("gap-1.5 font-normal", className)}
      {...props}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} />
      {children}
    </Badge>
  )
}

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
})

/**
 * Period-over-period change as a ratio (`0.124` = +12.4%): arrow + signed percent, green when
 * good, red when bad. `null` means there is no baseline and renders "—". Set `invert` when down
 * is good (refunds, costs, latency).
 */
function Delta({
  value,
  invert = false,
  className,
}: {
  value: number | null
  invert?: boolean
  className?: string
}) {
  if (value == null) {
    return (
      <span
        data-slot="delta"
        className={cn("text-xs text-muted-foreground tabular-nums", className)}
      >
        —
      </span>
    )
  }
  const flat = Math.abs(value) < 0.0005
  const good = invert ? value < 0 : value > 0
  const Icon = flat ? MinusIcon : value > 0 ? ArrowUpRightIcon : ArrowDownRightIcon
  const sign = flat ? "" : value > 0 ? "+" : "−"
  return (
    <span
      data-slot="delta"
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        flat ? "text-muted-foreground" : good ? "text-success" : "text-destructive",
        className
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {sign}
      {percent.format(Math.abs(value))}
    </span>
  )
}

export { Delta, StatusBadge }
export type { StatusTone }
