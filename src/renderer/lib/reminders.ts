import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"

import { Priority, SortOrder, type Library, type Task, type TaskList } from "@/gen/reminders"

/**
 * Read-only views over the library for display: indexes, trees, filters, sorting and dates.
 * The rules that change data live in the main process (src/main/reminders/model.ts); nothing
 * here decides what is saved.
 *
 * Dates: a due date is a local calendar day ("yyyy-MM-dd") and an optional local time ("HH:mm"),
 * compared with the user's own clock and time zone.
 */

export type SmartViewId = "today" | "scheduled" | "all" | "completed"

export const SMART_VIEWS: { id: SmartViewId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "scheduled", label: "Scheduled" },
  { id: "all", label: "All Tasks" },
  { id: "completed", label: "Completed" },
]

export function isSmartView(id: string): id is SmartViewId {
  return SMART_VIEWS.some((view) => view.id === id)
}

// ---------------------------------------------------------------------------------------------
// Dates

/** Today's local day, "yyyy-MM-dd". */
export function dayKey(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd")
}

export function dayOffset(days: number, from: Date = new Date()): string {
  return dayKey(addDays(from, days))
}

export type DueStatus = "none" | "overdue" | "today" | "future"

/** Overdue once its day has passed, or on the day once its time has passed. */
export function dueStatus(task: Task, now: Date): DueStatus {
  if (!task.dueDate) return "none"
  const today = dayKey(now)
  if (task.dueDate < today) return "overdue"
  if (task.dueDate > today) return "future"
  if (task.dueTime && task.dueTime <= format(now, "HH:mm")) return "overdue"
  return "today"
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return format(date, "p")
}

/** "Today", "Tomorrow", "Yesterday", "Friday", "Oct 25", "Oct 25, 2027". */
export function formatDay(day: string, now: Date): string {
  const date = parseISO(day)
  const diff = differenceInCalendarDays(date, now)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  if (diff > 1 && diff < 7) return format(date, "EEEE")
  return date.getFullYear() === now.getFullYear() ? format(date, "MMM d") : format(date, "MMM d, yyyy")
}

/** The due date as shown beside a title: "Today, 4:00 PM". */
export function formatDue(task: Task, now: Date): string {
  if (!task.dueDate) return ""
  const day = formatDay(task.dueDate, now)
  return task.dueTime ? `${day}, ${formatTime(task.dueTime)}` : day
}

/** A Scheduled section heading: "Today", "Tomorrow", "Saturday, Oct 25". */
export function formatDayHeading(day: string, now: Date): string {
  const date = parseISO(day)
  const diff = differenceInCalendarDays(date, now)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  return date.getFullYear() === now.getFullYear() ? format(date, "EEEE, MMM d") : format(date, "EEEE, MMM d, yyyy")
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : format(date, "PPp")
}

// ---------------------------------------------------------------------------------------------
// Index

export interface TaskIndex {
  byId: Map<string, Task>
  lists: TaskList[]
  listById: Map<string, TaskList>
  /** Children of each parent in order; the key is `parentKey(listId, parentId)`. */
  children: Map<string, Task[]>
  /** Each task's place in a walk of every list's tree, lists in sidebar order. */
  order: Map<string, number>
}

export function parentKey(listId: string, parentId: string): string {
  return `${listId}/${parentId}`
}

export function buildIndex(library: Library): TaskIndex {
  const byId = new Map(library.tasks.map((task) => [task.id, task]))
  const lists = [...library.lists].sort((a, b) => a.position - b.position)
  const children = new Map<string, Task[]>()
  for (const task of library.tasks) {
    const key = parentKey(task.listId, task.parentId)
    const siblings = children.get(key)
    if (siblings) siblings.push(task)
    else children.set(key, [task])
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.position - b.position)
  const order = new Map<string, number>()
  const walk = (listId: string, parentId: string) => {
    for (const task of children.get(parentKey(listId, parentId)) ?? []) {
      order.set(task.id, order.size)
      walk(listId, task.id)
    }
  }
  for (const list of lists) walk(list.id, "")
  return { byId, lists, listById: new Map(lists.map((list) => [list.id, list])), children, order }
}

export function childrenOf(index: TaskIndex, task: Task): Task[] {
  return index.children.get(parentKey(task.listId, task.id)) ?? []
}

export function siblingsOf(index: TaskIndex, task: Task): Task[] {
  return index.children.get(parentKey(task.listId, task.parentId)) ?? []
}

/** The task's ancestors, nearest first. */
export function ancestorsOf(index: TaskIndex, task: Task): Task[] {
  const out: Task[] = []
  const seen = new Set([task.id])
  for (let at = index.byId.get(task.parentId); at && !seen.has(at.id); at = index.byId.get(at.parentId)) {
    seen.add(at.id)
    out.push(at)
  }
  return out
}

/** Whether `id` is `ancestorId` or one of its subtasks at any depth. */
export function isInSubtree(index: TaskIndex, id: string, ancestorId: string): boolean {
  const task = index.byId.get(id)
  if (!task) return false
  return id === ancestorId || ancestorsOf(index, task).some((ancestor) => ancestor.id === ancestorId)
}

export function progressOf(index: TaskIndex, task: Task): { completed: number; total: number } {
  const children = childrenOf(index, task)
  return { completed: children.filter((child) => child.completed).length, total: children.length }
}

// ---------------------------------------------------------------------------------------------
// Sorting

export function effectivePriority(task: Task): Priority {
  return task.priority === Priority.PRIORITY_UNSPECIFIED ? Priority.PRIORITY_NORMAL : task.priority
}

const PRIORITY_RANK: Record<number, number> = {
  [Priority.PRIORITY_HIGH]: 0,
  [Priority.PRIORITY_NORMAL]: 1,
  [Priority.PRIORITY_LOW]: 2,
}

function dueKey(task: Task): string {
  // No due date sorts last; an all-day task before the timed ones of its day.
  return task.dueDate ? `${task.dueDate} ${task.dueTime || "00:00"}` : "~"
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export type TaskCompare = (a: Task, b: Task) => number

/** The order a sort puts tasks in; ties keep the manual order. */
export function comparator(index: TaskIndex, sort: SortOrder): TaskCompare {
  const manual: TaskCompare = (a, b) => (index.order.get(a.id) ?? 0) - (index.order.get(b.id) ?? 0)
  switch (sort) {
    case SortOrder.SORT_ORDER_DUE_DATE:
      return (a, b) => dueKey(a).localeCompare(dueKey(b)) || manual(a, b)
    case SortOrder.SORT_ORDER_CREATED:
      return (a, b) => a.createdAt.localeCompare(b.createdAt) || manual(a, b)
    case SortOrder.SORT_ORDER_TITLE:
      return (a, b) => collator.compare(a.title, b.title) || manual(a, b)
    case SortOrder.SORT_ORDER_PRIORITY:
      return (a, b) => PRIORITY_RANK[effectivePriority(a)] - PRIORITY_RANK[effectivePriority(b)] || manual(a, b)
    default:
      return manual
  }
}

// ---------------------------------------------------------------------------------------------
// Trees

export interface TreeNode {
  task: Task
  children: TreeNode[]
  /**
   * The titles of the ancestors that this view doesn't show above the task, outermost first
   * (a subtask found by a filter keeps its parent's name beside it).
   */
  context: string[]
}

/**
 * A list's whole tree under `parentId`, siblings sorted by `compare`. A task `keep` rejects is
 * still shown when one of its subtasks is, so a subtask never loses its parent.
 */
export function listTree(
  index: TaskIndex,
  listId: string,
  keep: (task: Task) => boolean,
  compare: TaskCompare,
  parentId = "",
): TreeNode[] {
  const nodes: TreeNode[] = []
  for (const task of [...(index.children.get(parentKey(listId, parentId)) ?? [])].sort(compare)) {
    const children = listTree(index, listId, keep, compare, task.id)
    if (keep(task) || children.length > 0) nodes.push({ task, children, context: [] })
  }
  return nodes
}

/**
 * The tasks `matches` accepts, each shown once: under its nearest ancestor that also matches, or
 * at the top with the names of the ancestors it was lifted out of. Roots are sorted by `compare`,
 * subtasks keep the manual order.
 */
export function filteredTree(index: TaskIndex, tasks: Task[], compare: TaskCompare): TreeNode[] {
  const matching = new Set(tasks.map((task) => task.id))
  const nodes = new Map(tasks.map((task) => [task.id, { task, children: [], context: [] } as TreeNode]))
  const roots: TreeNode[] = []
  for (const task of tasks) {
    const node = nodes.get(task.id)!
    const ancestors = ancestorsOf(index, task)
    const holder = ancestors.find((ancestor) => matching.has(ancestor.id))
    if (holder) {
      nodes.get(holder.id)!.children.push(node)
    } else {
      node.context = ancestors.map((ancestor) => ancestor.title).reverse()
      roots.push(node)
    }
  }
  const manual = comparator(index, SortOrder.SORT_ORDER_MANUAL)
  for (const node of nodes.values()) node.children.sort((a, b) => manual(a.task, b.task))
  return roots.sort((a, b) => compare(a.task, b.task))
}

/** Whether a task's title or notes contain every word of `query`. */
export function matchesQuery(task: Task, query: string): boolean {
  const haystack = `${task.title}\n${task.notes}`.toLocaleLowerCase()
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}
