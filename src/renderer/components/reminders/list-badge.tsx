import { ListIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** A list's icon: a white glyph in a circle of the list's color, as in the sidebar. */
export function ListBadge({
  color,
  icon: Icon = ListIcon,
  className,
}: {
  /** A CSS color. */
  color: string
  icon?: LucideIcon
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: color }}
      className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-white", className)}
    >
      {/* The sidebar's menu buttons size every svg to 16px; this glyph is smaller on purpose. */}
      <Icon strokeWidth={2.5} className="size-3.5!" />
    </span>
  )
}
