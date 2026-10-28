import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The round completion checkbox in front of a task: an outlined circle that fills with the
 * list's color and shows a check when completed. It is a mouse target only (tabIndex -1): in
 * the task tree Space completes the focused row, so the tree keeps one tab stop.
 */
export function TaskCheckbox({
  checked,
  color,
  label,
  onToggle,
  className,
}: {
  checked: boolean
  /** The CSS color it fills with. */
  color: string
  /** The task's title, for the accessible name. */
  label: string
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Completed: ${label || "Untitled task"}`}
      tabIndex={-1}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      // Keep the press from moving focus or starting a drag of the row.
      onMouseDown={(event) => event.preventDefault()}
      style={{ "--check-color": color } as React.CSSProperties}
      className={cn(
        "group/check relative flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-muted-foreground/45 transition-colors duration-150",
        "hover:border-(--check-color)",
        checked && "border-(--check-color) bg-(--check-color)",
        className,
      )}
    >
      <CheckIcon
        aria-hidden="true"
        strokeWidth={3}
        className={cn(
          "size-2.5 text-white transition-[opacity,scale] duration-150",
          checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      />
    </button>
  )
}
