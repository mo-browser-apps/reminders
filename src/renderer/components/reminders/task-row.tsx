import * as React from "react"
import { ChevronRightIcon, InfoIcon } from "lucide-react"

import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Priority, type Task, type TaskList } from "@/gen/reminders"
import { cn } from "@/lib/utils"
import { formatDue, type DueStatus } from "@/lib/reminders"
import { TaskCheckbox } from "@/components/reminders/task-checkbox"
import { TaskContextMenuContent } from "@/components/reminders/task-context-menu"
import { TitleEditor } from "@/components/reminders/title-editor"
import { useTaskActions, type DropPosition } from "@/components/reminders/task-actions-context"

/** The width of one level of indentation, in rem: the checkbox lines up under the parent's title. */
export const INDENT_REM = 1.625

export interface TaskRowProps {
  task: Task
  level: number
  posinset: number
  setsize: number
  /** Whether this view shows subtasks under it (a disclosure arrow). */
  hasChildren: boolean
  expanded: boolean
  /** Its direct subtasks: how many there are, and how many are completed. */
  subtaskCount: number
  subtasksCompleted: number
  selected: boolean
  tabbable: boolean
  editing: boolean
  /** The CSS color of the task's list. */
  color: string
  /**
   * Where the task lives when the view doesn't show it: its list (in views that mix lists) and
   * the ancestors it was lifted out of, as "Work › Prepare release".
   */
  where: string
  dueStatus: DueStatus
  /** Changes once a minute, so relative dates ("Today", overdue) stay current. */
  now: Date
  lists: TaskList[]
  draggable: boolean
  dropPosition: DropPosition | null
  rowRef: (id: string, element: HTMLElement | null) => void
  onDragStart: (event: React.DragEvent, id: string) => void
  onDragOver: (event: React.DragEvent, id: string) => void
  onDrop: (event: React.DragEvent, id: string) => void
  onDragEnd: () => void
}

/**
 * One task in the tree: disclosure arrow, checkbox, title, and a quiet second line with its
 * list, parent, due date, subtask progress and notes. Secondary actions are in its right-click
 * menu and the details pane; the hover button opens the details.
 */
export const TaskRow = React.memo(function TaskRow({
  task,
  level,
  posinset,
  setsize,
  hasChildren,
  expanded,
  subtaskCount,
  subtasksCompleted,
  selected,
  tabbable,
  editing,
  color,
  where,
  dueStatus,
  now,
  lists,
  draggable,
  dropPosition,
  rowRef,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TaskRowProps) {
  const actions = useTaskActions()
  // Whether the row was already selected when the click began: a click on the title of the
  // selected task edits it (a first click only selects, as in Finder).
  const wasSelected = React.useRef(false)
  const due = formatDue(task, now)
  const firstNoteLine = task.notes.split("\n").find((line) => line.trim()) ?? ""
  const high = task.priority === Priority.PRIORITY_HIGH
  const low = task.priority === Priority.PRIORITY_LOW
  const meta: React.ReactNode[] = []
  if (where) {
    meta.push(
      <span key="where" className="max-w-1/2 shrink-0 truncate">
        {where}
      </span>,
    )
  }
  if (due) {
    meta.push(
      <span key="due" className={cn("shrink-0", dueStatus === "overdue" && !task.completed && "text-destructive")}>
        {dueStatus === "overdue" && !task.completed && <span className="sr-only">Overdue: </span>}
        {due}
      </span>,
    )
  }
  if (subtaskCount > 0) {
    meta.push(
      <span key="progress" className="shrink-0 tabular-nums">
        {subtasksCompleted} of {subtaskCount} completed
      </span>,
    )
  }
  if (firstNoteLine && !editing) {
    meta.push(
      <span key="notes" className="min-w-0 truncate">
        {firstNoteLine}
      </span>,
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={(element) => rowRef(task.id, element)}
            role="treeitem"
            id={`task-${task.id}`}
            aria-level={level}
            aria-posinset={posinset}
            aria-setsize={setsize}
            aria-expanded={hasChildren ? expanded : undefined}
            aria-selected={selected}
            aria-label={`${task.title}${task.completed ? ", completed" : ""}${high ? ", high priority" : low ? ", low priority" : ""}${due ? `, due ${due}` : ""}`}
            tabIndex={tabbable ? 0 : -1}
            draggable={draggable && !editing}
            data-selected={selected || undefined}
            data-completed={task.completed || undefined}
            data-drop={dropPosition ?? undefined}
            onFocus={(event) => {
              if (event.target === event.currentTarget) actions.select(task.id)
            }}
            onMouseDown={(event) => {
              // A click selects without scrolling or flashing a focus ring; the row still takes focus.
              wasSelected.current = selected
              if (event.button === 0 && !editing) actions.select(task.id)
            }}
            onDoubleClick={(event) => {
              if ((event.target as HTMLElement).closest("button, input")) return
              actions.openDetails(task.id)
            }}
            onDragStart={(event) => onDragStart(event, task.id)}
            onDragOver={(event) => onDragOver(event, task.id)}
            onDrop={(event) => onDrop(event, task.id)}
            onDragEnd={onDragEnd}
          />
        }
        style={{ "--level": level - 1 } as React.CSSProperties}
        className={cn(
          "group/row relative flex min-h-9 cursor-default items-start gap-2 rounded-md ps-[calc(var(--level)*1.625rem+0.25rem)] pe-2 outline-none select-none",
          "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
          "data-selected:bg-row-selection",
          // Drop feedback: a line above or below, or the row itself for "inside".
          "data-[drop=inside]:bg-row-selection data-[drop=inside]:ring-2 data-[drop=inside]:ring-ring/50 data-[drop=inside]:ring-inset",
          "before:pointer-events-none before:absolute before:inset-x-2 before:h-0.5 before:rounded-full before:bg-ring before:opacity-0",
          "data-[drop=before]:before:top-0 data-[drop=before]:before:opacity-100 data-[drop=after]:before:bottom-0 data-[drop=after]:before:opacity-100",
        )}
      >
        <span className="flex h-9 w-4 shrink-0 items-center justify-center">
          {hasChildren && (
            <ChevronRightIcon
              aria-hidden="true"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation()
                actions.toggleExpanded(task.id)
              }}
              className={cn(
                "size-3.5 text-muted-foreground transition-transform duration-150 hover:text-foreground",
                expanded && "rotate-90",
              )}
            />
          )}
        </span>
        <span className="flex h-9 shrink-0 items-center">
          <TaskCheckbox
            checked={task.completed}
            color={color}
            label={task.title}
            onToggle={() => actions.toggleCompleted(task.id)}
          />
        </span>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 self-stretch border-b border-border/70 py-2 pe-6">
          <div className="flex min-w-0 items-baseline gap-1.5">
            {high && (
              <span aria-hidden="true" className="shrink-0 font-semibold" style={{ color }}>
                !!
              </span>
            )}
            {low && (
              <span aria-hidden="true" className="shrink-0 text-muted-foreground">
                ↓
              </span>
            )}
            {editing ? (
              <TitleEditor
                initial={task.title}
                label={`Title of ${task.title}`}
                onCommit={(title, after) => actions.commitTitle(task.id, title, after)}
                onCancel={() => actions.stopEditing()}
              />
            ) : (
              <span
                onClick={(event) => {
                  // Clicking the title of the selected task edits it, as in Reminders.
                  if (wasSelected.current && event.detail === 1) actions.startEditing(task.id)
                }}
                className={cn(
                  "min-w-0 truncate text-sm leading-5",
                  task.completed && "text-muted-foreground line-through decoration-muted-foreground/60",
                )}
              >
                {task.title}
              </span>
            )}
          </div>
          {meta.length > 0 && (
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground [&>*+*]:before:me-1.5 [&>*+*]:before:content-['·']">
              {meta}
            </div>
          )}
        </div>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Show details of ${task.title}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation()
            actions.openDetails(task.id)
          }}
          className={cn(
            "absolute end-2 top-2.5 flex size-5 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-foreground",
            "group-hover/row:opacity-100 group-data-selected/row:opacity-100",
          )}
        >
          <InfoIcon className="size-4" />
        </button>
      </ContextMenuTrigger>
      <TaskContextMenuContent task={task} lists={lists} />
    </ContextMenu>
  )
})
