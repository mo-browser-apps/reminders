/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * A vertical activity history (newest first) and the note composer that usually sits above it.
 * Relative timestamps show the full date in a keyboard-reachable tooltip; the composer posts on
 * ⌘/Ctrl+Enter and clears on Esc.
 *
 * ```tsx
 * <NoteComposer onSubmit={(body) => addNote(body)} />
 * <Timeline
 *   items={[
 *     { id: "e1", icon: TruckIcon, tone: "success", title: <><b>Priya</b> fulfilled 2 items</>, at: "2026-09-24T10:12:00Z" },
 *   ]}
 * />
 * ```
 */
import * as React from "react"
import { format, isToday, isYesterday } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type TimelineTone = "neutral" | "success" | "warning" | "danger" | "info"

type TimelineItem = {
  id: string
  icon: React.ComponentType
  /** Rich text allowed: `<><b>Priya</b> fulfilled 2 items</>`. */
  title: React.ReactNode
  detail?: React.ReactNode
  /** ISO string or Date. */
  at: string | Date
  tone?: TimelineTone
}

const TONE: Record<TimelineTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success dark:bg-success/20",
  warning: "bg-warning/10 text-warning dark:bg-warning/20",
  danger: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  info: "bg-primary/10 text-primary dark:bg-primary/20",
}

function shortTime(date: Date): string {
  if (isToday(date)) return `Today at ${format(date, "h:mm a")}`
  if (isYesterday(date)) return `Yesterday at ${format(date, "h:mm a")}`
  if (date.getFullYear() === new Date().getFullYear()) return format(date, "MMM d 'at' h:mm a")
  return format(date, "MMM d, yyyy")
}

function Timeline({
  items,
  className,
  ...props
}: Omit<React.ComponentProps<"ol">, "children"> & { items: TimelineItem[] }) {
  return (
    <ol data-slot="timeline" className={cn("flex flex-col", className)} {...props}>
      {items.map((item, index) => {
        const Icon = item.icon
        const date = typeof item.at === "string" ? new Date(item.at) : item.at
        return (
          <li
            key={item.id}
            data-slot="timeline-item"
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {index < items.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-7 bottom-0 left-3 w-px -translate-x-1/2 bg-border"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative flex size-6 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5",
                TONE[item.tone ?? "neutral"]
              )}
            >
              <Icon />
            </span>
            {/* Title, then time, then detail — always stacked, so a narrow side column doesn't
                alternate between inline and wrapped timestamps. */}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 pt-0.5">
              <p className="min-w-0 text-sm">{item.title}</p>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <time
                      dateTime={date.toISOString()}
                      tabIndex={0}
                      className="rounded-sm text-xs text-muted-foreground tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    />
                  }
                >
                  {shortTime(date)}
                </TooltipTrigger>
                <TooltipContent>{format(date, "EEEE, MMMM d, yyyy 'at' h:mm a")}</TooltipContent>
              </Tooltip>
              {item.detail && (
                <div className="text-sm text-muted-foreground">{item.detail}</div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * "Leave a note" composer. `onSubmit` may be async (the button shows a spinner); ⌘/Ctrl+Enter
 * posts, Esc clears the draft.
 */
function NoteComposer({
  onSubmit,
  label = "Note",
  placeholder = "Leave a note for your team",
  submitLabel = "Post note",
  disabled = false,
  className,
}: {
  onSubmit: (body: string) => void | Promise<void>
  /** Accessible name for the textarea (visually hidden). */
  label?: string
  placeholder?: string
  submitLabel?: string
  disabled?: boolean
  className?: string
}) {
  const [body, setBody] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const id = React.useId()
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent)

  async function submit(event?: React.FormEvent) {
    event?.preventDefault()
    const text = body.trim()
    if (!text || pending) return
    setPending(true)
    try {
      await onSubmit(text)
      setBody("")
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      data-slot="note-composer"
      onSubmit={submit}
      className={cn("flex flex-col gap-2", className)}
    >
      <Field>
        <FieldLabel htmlFor={id} className="sr-only">
          {label}
        </FieldLabel>
        <Textarea
          id={id}
          value={body}
          disabled={disabled || pending}
          placeholder={placeholder}
          className="min-h-16"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              void submit()
            }
            if (event.key === "Escape" && body) {
              event.preventDefault()
              event.stopPropagation()
              setBody("")
            }
          }}
        />
      </Field>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {isMac ? "⌘" : "Ctrl"} Enter to post
        </span>
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={disabled || pending || !body.trim()}
        >
          {pending && <Spinner data-icon="inline-start" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export { NoteComposer, Timeline }
export type { TimelineItem, TimelineTone }
