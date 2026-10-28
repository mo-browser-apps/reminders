import { CalendarDaysIcon, CalendarIcon, CheckIcon, InboxIcon, type LucideIcon } from "lucide-react"

import { Link } from "@/components/ui/router"
import { cn } from "@/lib/utils"
import { smartColor } from "@/lib/list-colors"
import { SMART_VIEWS, type SmartViewId } from "@/lib/reminders"

const ICONS: Record<SmartViewId, LucideIcon> = {
  today: CalendarDaysIcon,
  scheduled: CalendarIcon,
  all: InboxIcon,
  completed: CheckIcon,
}

/**
 * Today, Scheduled, All Tasks and Completed as a 2×2 grid of tiles, as in Reminders: a colored
 * circle icon and the count on top, the name below; the selected tile fills with its color.
 * Each tile is a link named with its count ("Today, 4 tasks").
 */
export function SmartListTiles({
  current,
  counts,
}: {
  /** The selected smart view, or null when a list or search is shown. */
  current: string | null
  counts: Record<string, number>
}) {
  return (
    <nav aria-label="Smart lists" className="grid grid-cols-2 gap-2 px-3">
      {SMART_VIEWS.map((view) => {
        const Icon = ICONS[view.id]
        const selected = current === view.id
        const count = counts[view.id] ?? 0
        return (
          <Link
            key={view.id}
            to={`/${view.id}`}
            aria-current={selected ? "page" : undefined}
            aria-label={`${view.label}, ${count} ${count === 1 ? "task" : "tasks"}`}
            style={{ "--tile-color": smartColor(view.id) } as React.CSSProperties}
            className={cn(
              "flex min-w-0 cursor-default flex-col gap-1.5 rounded-[0.625rem] bg-sidebar-tile px-2 pt-2 pb-1.5 text-sidebar-foreground outline-none transition-colors select-none",
              "hover:bg-sidebar-tile-hover focus-visible:ring-2 focus-visible:ring-ring/70",
              selected && "bg-(--tile-color) text-white hover:bg-(--tile-color)",
            )}
          >
            <span className="flex items-start justify-between gap-1">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full bg-(--tile-color) text-white",
                  selected && "bg-white text-(--tile-color)",
                )}
              >
                <Icon className="size-4" strokeWidth={2.25} />
              </span>
              <span aria-hidden="true" className="text-xl leading-7 font-bold tabular-nums">
                {count}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={cn("truncate text-[0.8125rem] font-medium text-muted-foreground", selected && "text-white")}
            >
              {view.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
