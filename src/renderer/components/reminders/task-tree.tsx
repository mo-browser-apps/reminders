import * as React from "react"

import type { TaskList } from "@/gen/reminders"
import { cn } from "@/lib/utils"
import { listColor } from "@/lib/list-colors"
import { dueStatus, progressOf, type TaskIndex, type TreeNode } from "@/lib/reminders"
import type { Section, ViewModel } from "@/lib/views"
import { TaskRow } from "@/components/reminders/task-row"
import { TitleEditor } from "@/components/reminders/title-editor"
import { useTaskActions, type DropPosition } from "@/components/reminders/task-actions-context"

/** A new task being typed into a row of its own, before it exists. */
export interface Draft {
  /** The id the task gets when it's created. */
  id: string
  listId: string
  parentId: string
  /** The sibling it goes after; empty: at the end of its siblings. */
  afterId: string
  dueDate: string
}

type FlatRow =
  | {
      kind: "task"
      node: TreeNode
      level: number
      parentRowId: string | null
      posinset: number
      setsize: number
      expanded: boolean
    }
  | { kind: "draft"; level: number }

interface FlatSection {
  section: Section
  rows: FlatRow[]
}

/** The drag data type of a task row (the sidebar's lists accept it too). */
export const TASK_DRAG_TYPE = "application/x-reminders-task"

/** The rows a user can see, section by section, with the draft row where it will be created. */
function flatten(sections: Section[], collapsed: ReadonlySet<string>, draft: Draft | null): FlatSection[] {
  let draftPlaced = false
  const out = sections.map((section) => {
    const rows: FlatRow[] = []
    const walk = (nodes: TreeNode[], level: number, parentRowId: string | null) => {
      nodes.forEach((node, index) => {
        const expanded = !collapsed.has(node.task.id)
        rows.push({ kind: "task", node, level, parentRowId, posinset: index + 1, setsize: nodes.length, expanded })
        if (expanded) walk(node.children, level + 1, node.task.id)
        if (draft && !draftPlaced && draft.afterId === node.task.id) {
          rows.push({ kind: "draft", level })
          draftPlaced = true
        }
      })
      // A draft with no sibling before it goes last under its parent.
      if (draft && !draftPlaced && parentRowId === (draft.parentId || null) && !draft.afterId && parentRowId !== null) {
        rows.push({ kind: "draft", level })
        draftPlaced = true
      }
    }
    walk(section.nodes, 1, null)
    return { section, rows }
  })
  if (draft && !draftPlaced) {
    // The row it follows isn't shown yet (it is being created) or it starts a new group: put it
    // under its parent if that is shown, else at the end.
    for (const flat of out) {
      const at = flat.rows.findIndex((row) => row.kind === "task" && row.node.task.id === draft.parentId)
      if (at !== -1) {
        const parent = flat.rows[at] as Extract<FlatRow, { kind: "task" }>
        let end = at + 1
        while (end < flat.rows.length && flat.rows[end].level > parent.level) end += 1
        flat.rows.splice(end, 0, { kind: "draft", level: parent.level + 1 })
        return out
      }
    }
    if (out.length === 0) out.push({ section: { id: "draft", nodes: [] }, rows: [] })
    out[out.length - 1].rows.push({ kind: "draft", level: 1 })
  }
  return out
}

/**
 * The task list as an ARIA tree (.agents/skills/shadcn/rules/tree.md): visible rows rendered
 * flat with their level, one tab stop (the selected row), and the keys of a tree plus the task
 * keys: Enter adds a task after the selected one, Space completes it, Delete removes it, F2
 * renames it. Selection follows focus. In a list in manual order, rows can be dragged before,
 * after, or into another row.
 */
export function TaskTree({
  view,
  index,
  lists,
  collapsed,
  selectedId,
  editingId,
  draft,
  focusRequest,
  now,
}: {
  view: ViewModel
  index: TaskIndex
  lists: TaskList[]
  collapsed: ReadonlySet<string>
  selectedId: string | null
  editingId: string | null
  draft: Draft | null
  /** Moves the keyboard focus to a row after it renders; `seq` repeats a request. */
  focusRequest: { id: string; seq: number } | null
  now: Date
}) {
  const actions = useTaskActions()
  const sections = React.useMemo(() => flatten(view.sections, collapsed, draft), [view.sections, collapsed, draft])
  const rows = React.useMemo(() => sections.flatMap((flat) => flat.rows), [sections])
  const taskRows = React.useMemo(
    () => rows.filter((row): row is Extract<FlatRow, { kind: "task" }> => row.kind === "task"),
    [rows],
  )
  const itemRefs = React.useRef(new Map<string, HTMLElement>())
  const rowRef = React.useCallback((id: string, element: HTMLElement | null) => {
    if (element) itemRefs.current.set(id, element)
    else itemRefs.current.delete(id)
  }, [])

  const activeId = taskRows.some((row) => row.node.task.id === selectedId) ? selectedId : (taskRows[0]?.node.task.id ?? null)

  React.useLayoutEffect(() => {
    if (!focusRequest) return
    const element = itemRefs.current.get(focusRequest.id)
    if (element && document.activeElement !== element) element.focus({ preventScroll: true })
    element?.scrollIntoView({ block: "nearest" })
  }, [focusRequest])

  // Keep the selected row in view when it changes from the keyboard or a command.
  React.useEffect(() => {
    if (selectedId) itemRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest" })
  }, [selectedId])

  const focus = (id: string) => actions.select(id, { focus: true })

  function onKeyDown(event: React.KeyboardEvent) {
    // Keys typed into a field inside a row (the title editor) are the field's.
    if ((event.target as HTMLElement).getAttribute("role") !== "treeitem") return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const at = taskRows.findIndex((row) => row.node.task.id === activeId)
    if (at === -1) return
    const row = taskRows[at]
    const id = row.node.task.id
    const hasChildren = row.node.children.length > 0
    switch (event.key) {
      case "ArrowDown":
        if (taskRows[at + 1]) focus(taskRows[at + 1].node.task.id)
        break
      case "ArrowUp":
        if (taskRows[at - 1]) focus(taskRows[at - 1].node.task.id)
        break
      case "ArrowRight": // closed: open it; open: into its first subtask
        if (hasChildren && !row.expanded) actions.toggleExpanded(id)
        else if (hasChildren && taskRows[at + 1]) focus(taskRows[at + 1].node.task.id)
        break
      case "ArrowLeft": // open: close it; otherwise: up to the parent
        if (hasChildren && row.expanded) actions.toggleExpanded(id)
        else if (row.parentRowId) focus(row.parentRowId)
        break
      case "Home":
        if (taskRows[0]) focus(taskRows[0].node.task.id)
        break
      case "End":
        if (taskRows.length) focus(taskRows[taskRows.length - 1].node.task.id)
        break
      case "Enter":
        if (event.shiftKey) return
        actions.addSibling(id)
        break
      case " ":
        actions.toggleCompleted(id)
        break
      case "Delete":
      case "Backspace":
        actions.delete(id)
        break
      case "F2":
        actions.startEditing(id)
        break
      case "Escape": // probe-ok: Esc clears the task selection
        if (!selectedId) return
        actions.select(null)
        break
      default:
        return
    }
    event.preventDefault()
  }

  // Drag and drop, in a list in manual order only (the order a drop sets is the manual one).
  const dragId = React.useRef<string | null>(null)
  const [drop, setDrop] = React.useState<{ id: string; position: DropPosition } | null>(null)

  const onDragStart = React.useCallback(
    (event: React.DragEvent, id: string) => {
      dragId.current = id
      event.dataTransfer.setData(TASK_DRAG_TYPE, id)
      event.dataTransfer.setData("text/plain", index.byId.get(id)?.title ?? "")
      event.dataTransfer.effectAllowed = "move"
    },
    [index],
  )
  const onDragOver = React.useCallback(
    (event: React.DragEvent, targetId: string) => {
      const from = dragId.current
      if (!from || !view.reorderable) return
      const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const y = (event.clientY - box.top) / box.height
      const position: DropPosition = y < 0.25 ? "before" : y > 0.75 ? "after" : "inside"
      if (!actions.canDrop(from, targetId, position)) {
        setDrop(null)
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = "move"
      setDrop((current) => (current?.id === targetId && current.position === position ? current : { id: targetId, position }))
    },
    [actions, view.reorderable],
  )
  const onDrop = React.useCallback(
    (event: React.DragEvent, targetId: string) => {
      const from = dragId.current
      event.preventDefault()
      setDrop((current) => {
        if (from && current && current.id === targetId) actions.drop(from, targetId, current.position)
        return null
      })
      dragId.current = null
    },
    [actions],
  )
  const onDragEnd = React.useCallback(() => {
    dragId.current = null
    setDrop(null)
  }, [])

  const colorOf = (listId: string) => listColor(index.listById.get(listId)?.color)

  return (
    <div role="tree" aria-label={view.title} onKeyDown={onKeyDown} className="flex flex-col gap-4">
      {sections.map(({ section, rows: sectionRows }) => {
        const headingId = `section-${section.id}`
        return (
          <div key={section.id} role="group" aria-labelledby={section.title ? headingId : undefined} className="flex flex-col">
            {section.title && (
              <div
                id={headingId}
                className={cn(
                  "px-2 pb-1 text-sm font-semibold",
                  section.overdue && "text-destructive",
                )}
                style={section.listColor ? { color: listColor(section.listColor) } : undefined}
              >
                {section.title}
              </div>
            )}
            {sectionRows.map((row) => {
              if (row.kind === "draft") {
                return draft ? <DraftRow key="draft" draft={draft} level={row.level} color={colorOf(draft.listId)} /> : null
              }
              const { node } = row
              const task = node.task
              const progress = progressOf(index, task)
              const where = [view.showList ? index.listById.get(task.listId)?.name : "", ...node.context]
                .filter(Boolean)
                .join(" › ")
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  level={row.level}
                  posinset={row.posinset}
                  setsize={row.setsize}
                  hasChildren={node.children.length > 0}
                  expanded={row.expanded}
                  subtaskCount={progress.total}
                  subtasksCompleted={progress.completed}
                  selected={task.id === selectedId}
                  tabbable={task.id === activeId}
                  editing={task.id === editingId}
                  color={colorOf(task.listId)}
                  where={where}
                  dueStatus={dueStatus(task, now)}
                  now={now}
                  lists={lists}
                  draggable={view.reorderable}
                  dropPosition={drop?.id === task.id ? drop.position : null}
                  rowRef={rowRef}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** The row a new task is typed into: Enter creates it and opens the next, Esc drops it. */
function DraftRow({ draft, level, color }: { draft: Draft; level: number; color: string }) {
  const actions = useTaskActions()
  return (
    <div
      style={{ "--level": level - 1 } as React.CSSProperties}
      className="flex min-h-9 items-center gap-2 rounded-md bg-row-selection ps-[calc(var(--level)*1.625rem+0.25rem)] pe-2"
    >
      <span className="w-4 shrink-0" />
      <span aria-hidden="true" style={{ borderColor: color }} className="size-[18px] shrink-0 rounded-full border-[1.5px] opacity-50" />
      <div className="flex min-w-0 flex-1 items-center self-stretch border-b border-border/70 py-2">
        <TitleEditor
          key={draft.id}
          initial=""
          label="Title of the new task"
          placeholder="New task"
          onCommit={(title, after) => actions.commitDraft(title, after)}
          onCancel={() => actions.cancelDraft()}
        />
      </div>
    </div>
  )
}
