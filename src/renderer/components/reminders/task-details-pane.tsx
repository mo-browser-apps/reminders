import * as React from "react"
import { CornerLeftUpIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DATE_PICKER_PRESETS, DatePicker } from "@/components/ui/date-range-picker"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Priority, type Task, type TaskList } from "@/gen/reminders"
import { cn } from "@/lib/utils"
import { listColor } from "@/lib/list-colors"
import { shortcutLabel } from "@/lib/platform"
import { ancestorsOf, childrenOf, effectivePriority, formatTimestamp, type TaskIndex } from "@/lib/reminders"
import { ListBadge } from "@/components/reminders/list-badge"
import { TaskCheckbox } from "@/components/reminders/task-checkbox"
import { PRIORITY_LABELS } from "@/components/reminders/task-context-menu"
import { useTaskActions } from "@/components/reminders/task-actions-context"

export interface TaskFields {
  title?: string
  notes?: string
  dueDate?: string
  dueTime?: string
}

/**
 * The details of the selected task, beside the list: title, notes, due date and time,
 * priority, list, its parent, its subtasks with their progress, and when it was created.
 * Every field saves on its own (on blur, Enter, or pick); the list keeps its selection and
 * scroll position.
 */
export function TaskDetailsPane({
  task,
  index,
  lists,
  pickDate,
  onPickDateChange,
  onUpdate,
  onAddSubtask,
  onClose,
}: {
  task: Task | null
  index: TaskIndex
  lists: TaskList[]
  /** Whether the due-date picker is open (the "Choose Date…" command opens it). */
  pickDate: boolean
  onPickDateChange: (open: boolean) => void
  onUpdate: (id: string, fields: TaskFields) => void
  onAddSubtask: (parentId: string, title: string) => void
  onClose: () => void
}) {
  return (
    <aside aria-label="Task details" className="flex h-full min-w-0 flex-col bg-background">
      <header className="app-drag-region flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
        <h2 className="truncate text-sm font-semibold">Details</h2>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Hide Details" onClick={onClose} />}>
            <XIcon />
          </TooltipTrigger>
          <TooltipContent>Hide Details ({shortcutLabel("I", { alt: true })})</TooltipContent>
        </Tooltip>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {task ? (
          <TaskDetails
            key={task.id}
            task={task}
            index={index}
            lists={lists}
            pickDate={pickDate}
            onPickDateChange={onPickDateChange}
            onUpdate={onUpdate}
            onAddSubtask={onAddSubtask}
          />
        ) : (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyTitle>No task selected</EmptyTitle>
              <EmptyDescription>Select a task to see and edit its details.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </aside>
  )
}

function TaskDetails({
  task,
  index,
  lists,
  pickDate,
  onPickDateChange,
  onUpdate,
  onAddSubtask,
}: {
  task: Task
  index: TaskIndex
  lists: TaskList[]
  pickDate: boolean
  onPickDateChange: (open: boolean) => void
  onUpdate: (id: string, fields: TaskFields) => void
  onAddSubtask: (parentId: string, title: string) => void
}) {
  const actions = useTaskActions()
  const id = React.useId()
  const list = index.listById.get(task.listId)
  const color = listColor(list?.color)
  const parent = index.byId.get(task.parentId)
  const path = ancestorsOf(index, task).reverse()
  const subtasks = childrenOf(index, task)
  const done = subtasks.filter((subtask) => subtask.completed).length
  const priorityItems = PRIORITY_LABELS.map((priority) => ({ value: priority.value, label: priority.label }))
  const listItems = lists.map((candidate) => ({ value: candidate.id, label: candidate.name }))

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 items-center">
          <TaskCheckbox checked={task.completed} color={color} label={task.title} onToggle={() => actions.toggleCompleted(task.id)} />
        </span>
        <TextField
          key={`title-${task.title}`}
          initial={task.title}
          label="Title"
          className={cn("h-8 text-base font-semibold", task.completed && "text-muted-foreground line-through")}
          onCommit={(title) => onUpdate(task.id, { title })}
        />
      </div>

      <NotesField key={`notes-${task.notes}`} initial={task.notes} onCommit={(notes) => onUpdate(task.id, { notes })} />

      <Separator />

      <FieldGroup className="gap-3">
        <Field orientation="horizontal" className="justify-between">
          <FieldLabel htmlFor={`${id}-due`} className="w-20 shrink-0">
            Due date
          </FieldLabel>
          <DatePicker
            id={`${id}-due`}
            dateOnly
            value={task.dueDate || null}
            onValueChange={(day) => onUpdate(task.id, { dueDate: day ?? "" })}
            presets={DATE_PICKER_PRESETS}
            clearLabel="No Date"
            placeholder="None"
            open={pickDate}
            onOpenChange={onPickDateChange}
            className="max-w-48 flex-1"
          />
        </Field>
        <Field orientation="horizontal" className="justify-between">
          <FieldLabel htmlFor={`${id}-time`} className="w-20 shrink-0">
            Time
          </FieldLabel>
          <Input
            key={`time-${task.dueTime}`}
            id={`${id}-time`}
            type="time"
            defaultValue={task.dueTime}
            disabled={!task.dueDate}
            aria-describedby={task.dueDate ? undefined : `${id}-time-hint`}
            onBlur={(event) => {
              const time = event.currentTarget.value
              if (time !== task.dueTime) onUpdate(task.id, { dueTime: time })
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
            }}
            className="max-w-48 flex-1"
          />
        </Field>
        {!task.dueDate && (
          <p id={`${id}-time-hint`} className="-mt-1 text-end text-xs text-muted-foreground">
            Set a due date to add a time.
          </p>
        )}
        <Field orientation="horizontal" className="justify-between">
          <FieldLabel htmlFor={`${id}-priority`} className="w-20 shrink-0">
            Priority
          </FieldLabel>
          <Select
            items={priorityItems}
            value={effectivePriority(task)}
            onValueChange={(value) => actions.setPriority(task.id, value as Priority)}
          >
            <SelectTrigger id={`${id}-priority`} className="max-w-48 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {priorityItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="horizontal" className="justify-between">
          <FieldLabel htmlFor={`${id}-list`} className="w-20 shrink-0">
            List
          </FieldLabel>
          <Select
            items={listItems}
            value={task.listId}
            onValueChange={(value) => {
              if (value && value !== task.listId) actions.moveToList(task.id, value as string)
            }}
          >
            <SelectTrigger id={`${id}-list`} className="max-w-48 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {lists.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    <ListBadge color={listColor(candidate.color)} className="size-4 [&_svg]:size-2.5!" />
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      {parent && (
        <>
          <Separator />
          <section aria-labelledby={`${id}-parent`} className="flex flex-col gap-1.5">
            <h3 id={`${id}-parent`} className="text-xs font-medium text-muted-foreground">
              Subtask of
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="-mx-2 justify-start font-normal"
              onClick={() => actions.select(parent.id, { focus: true })}
            >
              <CornerLeftUpIcon data-icon="inline-start" />
              <span className="truncate">{path.map((ancestor) => ancestor.title).join(" › ")}</span>
            </Button>
          </section>
        </>
      )}

      <Separator />
      <section aria-labelledby={`${id}-subtasks`} className="flex flex-col gap-2">
        <h3 id={`${id}-subtasks`} className="text-xs font-medium text-muted-foreground">
          Subtasks
        </h3>
        {subtasks.length > 0 && (
          <Progress value={(done / subtasks.length) * 100} className="gap-1.5">
            <ProgressLabel className="text-xs font-normal">
              {done} of {subtasks.length} completed
            </ProgressLabel>
            <ProgressValue className="sr-only" />
          </Progress>
        )}
        {task.completed && done < subtasks.length && (
          <p className="text-xs text-muted-foreground">
            This task is completed; {subtasks.length - done} of its subtasks {subtasks.length - done === 1 ? "is" : "are"} still
            open and keep their own state.
          </p>
        )}
        {subtasks.length > 0 && (
          <ul className="flex flex-col">
            {subtasks.map((subtask) => (
              <li key={subtask.id} className="flex min-h-8 items-center gap-2.5">
                <TaskCheckbox
                  checked={subtask.completed}
                  color={color}
                  label={subtask.title}
                  onToggle={() => actions.toggleCompleted(subtask.id)}
                />
                <button
                  type="button"
                  onClick={() => actions.select(subtask.id, { focus: true })}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-sm text-start text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50",
                    subtask.completed && "text-muted-foreground line-through",
                  )}
                >
                  {subtask.title}
                </button>
                {childrenOf(index, subtask).length > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {childrenOf(index, subtask).filter((child) => child.completed).length}/{childrenOf(index, subtask).length}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <AddSubtaskField onAdd={(title) => onAddSubtask(task.id, title)} />
      </section>

      <Separator />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <dt>Created</dt>
        <dd className="text-end">{formatTimestamp(task.createdAt)}</dd>
        {task.updatedAt && task.updatedAt !== task.createdAt && (
          <>
            <dt>Modified</dt>
            <dd className="text-end">{formatTimestamp(task.updatedAt)}</dd>
          </>
        )}
        {task.completed && task.completedAt && (
          <>
            <dt>Completed</dt>
            <dd className="text-end">{formatTimestamp(task.completedAt)}</dd>
          </>
        )}
      </dl>

      <Button variant="destructive" size="sm" className="self-start" onClick={() => actions.delete(task.id)}>
        <Trash2Icon data-icon="inline-start" />
        Delete Task
      </Button>
    </div>
  )
}

/**
 * Saves a field's draft when it differs from what was last saved: on blur, and also when the
 * field unmounts (selecting another task can remove the field before it sees a blur).
 */
function useCommit(value: string, initial: string, onCommit: (value: string) => void, accept: (value: string) => boolean) {
  const saved = React.useRef(initial)
  const latest = React.useRef({ value, onCommit, accept })
  latest.current = { value, onCommit, accept }
  const commit = React.useCallback(() => {
    const { value: current, onCommit: save, accept: ok } = latest.current
    if (current === saved.current || !ok(current)) return
    saved.current = current
    save(current)
  }, [])
  React.useEffect(() => commit, [commit])
  return commit
}

/** A one-line field that saves on Enter or blur and reverts on Escape. */
function TextField({
  initial,
  label,
  className,
  onCommit,
}: {
  initial: string
  label: string
  className?: string
  onCommit: (value: string) => void
}) {
  const [value, setValue] = React.useState(initial)
  const commit = useCommit(value, initial, onCommit, (title) => !!title.trim())
  return (
    <input
      value={value}
      aria-label={label}
      autoComplete="off"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        if (value.trim()) commit()
        else setValue(initial)
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === "Enter") event.currentTarget.blur()
        else if (event.key === "Escape") { // probe-ok: the title field reverts on Esc
          event.preventDefault()
          event.stopPropagation()
          setValue(initial)
          const input = event.currentTarget
          requestAnimationFrame(() => input.blur())
        }
      }}
      className={cn(
        "min-w-0 flex-1 rounded-md bg-transparent px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
    />
  )
}

function NotesField({ initial, onCommit }: { initial: string; onCommit: (notes: string) => void }) {
  const [value, setValue] = React.useState(initial)
  const commit = useCommit(value, initial, onCommit, () => true)
  return (
    <Textarea
      value={value}
      aria-label="Notes"
      placeholder="Notes"
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Escape") { // probe-ok: the notes field reverts on Esc
          event.preventDefault()
          event.stopPropagation()
          setValue(initial)
        }
      }}
      className="min-h-20 resize-none text-sm"
    />
  )
}

/** "Add Subtask": Enter adds one and keeps the field ready for the next. */
function AddSubtaskField({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = React.useState("")
  return (
    <form
      className="flex min-h-8 items-center gap-2.5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!value.trim()) return
        onAdd(value)
        setValue("")
      }}
    >
      <span aria-hidden="true" className="flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-muted-foreground/40 text-muted-foreground/70">
        <PlusIcon className="size-3" strokeWidth={2.5} />
      </span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Add subtask"
        placeholder="Add subtask"
        autoComplete="off"
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) { // probe-ok: the add-subtask field clears on Esc
            event.preventDefault()
            event.stopPropagation()
            setValue("")
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </form>
  )
}
