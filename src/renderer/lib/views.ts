import { SortOrder, type Library, type Task, type TaskList, type ViewPrefs } from "@/gen/reminders"
import {
  comparator,
  dayKey,
  filteredTree,
  formatDayHeading,
  isSmartView,
  listTree,
  matchesQuery,
  SMART_VIEWS,
  type SmartViewId,
  type TaskIndex,
  type TreeNode,
} from "@/lib/reminders"

/**
 * What the main column shows for a view: its title, its sections of task trees, where a new task
 * goes, and its empty-state copy. Smart lists and search are views over the same tasks; nothing
 * is copied, and every task appears at most once per view.
 */

export interface Section {
  id: string
  /** A heading above the section (a day, "Overdue", a list's name); none for a plain list. */
  title?: string
  /** A list section's palette key, for its heading. */
  listColor?: string
  overdue?: boolean
  nodes: TreeNode[]
}

export interface ViewModel {
  /** A smart view id, a list id, or "search". */
  id: string
  kind: "smart" | "list" | "search"
  title: string
  /** The list's palette key, or the smart view id. */
  color: string
  sections: Section[]
  /** Where the add field creates a task; null when this view can't take one. */
  addTarget: { listId: string; dueDate: string } | null
  /** Regular list in manual order: drag and drop, Move Up/Down. */
  reorderable: boolean
  /** Rows name their list (Today and Scheduled mix lists without grouping them by list). */
  showList: boolean
  sort: SortOrder
  /** Regular lists: whether completed tasks are shown, and how many there are. */
  showCompleted: boolean
  completedCount: number
  empty: { title: string; description: string }
}

export const SEARCH_VIEW = "search"

export function viewPrefs(library: Library, viewId: string): ViewPrefs {
  return library.views.find((view) => view.viewId === viewId) ?? { viewId, sort: SortOrder.SORT_ORDER_MANUAL, showCompleted: false }
}

export function effectiveSort(prefs: ViewPrefs): SortOrder {
  return prefs.sort === SortOrder.SORT_ORDER_UNSPECIFIED ? SortOrder.SORT_ORDER_MANUAL : prefs.sort
}

/** The badge counts: open tasks (subtasks included) per smart view and per list. */
export function viewCounts(library: Library, now: Date): Record<string, number> {
  const today = dayKey(now)
  const counts: Record<string, number> = { today: 0, scheduled: 0, all: 0, completed: 0 }
  for (const list of library.lists) counts[list.id] = 0
  for (const task of library.tasks) {
    if (task.completed) {
      counts.completed += 1
      continue
    }
    counts.all += 1
    counts[task.listId] = (counts[task.listId] ?? 0) + 1
    if (task.dueDate) counts.scheduled += 1
    if (task.dueDate && task.dueDate <= today) counts.today += 1
  }
  return counts
}

function byList(index: TaskIndex, tasks: Task[]): { list: TaskList; tasks: Task[] }[] {
  return index.lists
    .map((list) => ({ list, tasks: tasks.filter((task) => task.listId === list.id) }))
    .filter((group) => group.tasks.length > 0)
}

function listSections(index: TaskIndex, tasks: Task[]): Section[] {
  const manual = comparator(index, SortOrder.SORT_ORDER_MANUAL)
  return byList(index, tasks).map(({ list, tasks: inList }) => ({
    id: list.id,
    title: list.name,
    listColor: list.color,
    nodes: filteredTree(index, inList, manual),
  }))
}

export function buildView({
  library,
  index,
  viewId,
  query,
  now,
  lingering,
  defaultListId,
}: {
  library: Library
  index: TaskIndex
  viewId: string
  query: string
  now: Date
  /** Tasks completed a moment ago, kept in place briefly so the check mark can be seen. */
  lingering: ReadonlySet<string>
  /** The list a smart view adds tasks to. */
  defaultListId: string | null
}): ViewModel | null {
  const today = dayKey(now)
  const open = (task: Task) => !task.completed || lingering.has(task.id)
  const base = {
    reorderable: false,
    showList: true,
    sort: SortOrder.SORT_ORDER_MANUAL,
    showCompleted: false,
    completedCount: 0,
  }

  if (query.trim()) {
    const matches = library.tasks.filter((task) => matchesQuery(task, query))
    return {
      ...base,
      id: SEARCH_VIEW,
      kind: "search",
      title: "Search",
      showList: false,
      color: "all",
      sections: listSections(index, matches),
      addTarget: null,
      empty: { title: "No tasks found.", description: `Nothing matches “${query.trim()}”.` },
    }
  }

  if (isSmartView(viewId)) {
    const title = SMART_VIEWS.find((view) => view.id === viewId)!.label
    const due = comparator(index, SortOrder.SORT_ORDER_DUE_DATE)
    const addTo = (dueDate: string) => (defaultListId ? { listId: defaultListId, dueDate } : null)
    const smart = (id: SmartViewId, sections: Section[], addTarget: ViewModel["addTarget"], empty: ViewModel["empty"]): ViewModel => ({
      ...base,
      // All Tasks and Completed group by list, so their rows don't repeat it.
      showList: id === "today" || id === "scheduled",
      id,
      kind: "smart",
      title,
      color: id,
      sections: sections.filter((section) => section.nodes.length > 0),
      addTarget,
      empty,
    })
    switch (viewId) {
      case "today": {
        const tasks = library.tasks.filter((task) => open(task) && task.dueDate && task.dueDate <= today)
        return smart(
          "today",
          [
            { id: "overdue", title: "Overdue", overdue: true, nodes: filteredTree(index, tasks.filter((task) => task.dueDate < today), due) },
            { id: "today", title: "Today", nodes: filteredTree(index, tasks.filter((task) => task.dueDate === today), due) },
          ],
          addTo(today),
          { title: "No tasks due today.", description: "Enjoy your free time." },
        )
      }
      case "scheduled": {
        const tasks = library.tasks.filter((task) => open(task) && task.dueDate)
        const days = [...new Set(tasks.map((task) => task.dueDate).filter((day) => day >= today))].sort()
        return smart(
          "scheduled",
          [
            { id: "overdue", title: "Overdue", overdue: true, nodes: filteredTree(index, tasks.filter((task) => task.dueDate < today), due) },
            ...days.map((day) => ({
              id: day,
              title: formatDayHeading(day, now),
              nodes: filteredTree(index, tasks.filter((task) => task.dueDate === day), due),
            })),
          ],
          addTo(today),
          { title: "No scheduled tasks.", description: "Tasks with a due date appear here." },
        )
      }
      case "all":
        return smart("all", listSections(index, library.tasks.filter(open)), addTo(""), {
          title: "No tasks.",
          description: index.lists.length ? "Add a task to get started." : "Create a list to get started.",
        })
      case "completed":
        return smart("completed", listSections(index, library.tasks.filter((task) => task.completed)), null, {
          title: "No completed tasks yet.",
          description: "Tasks you complete appear here.",
        })
    }
  }

  const list = index.listById.get(viewId)
  if (!list) return null
  const prefs = viewPrefs(library, list.id)
  const sort = effectiveSort(prefs)
  const keep = (task: Task) => prefs.showCompleted || open(task)
  const completedCount = library.tasks.filter((task) => task.listId === list.id && task.completed).length
  const nodes = listTree(index, list.id, keep, comparator(index, sort))
  const allDone = nodes.length === 0 && completedCount > 0
  return {
    ...base,
    id: list.id,
    kind: "list",
    title: list.name,
    color: list.color,
    sections: nodes.length > 0 ? [{ id: list.id, nodes }] : [],
    addTarget: { listId: list.id, dueDate: "" },
    reorderable: sort === SortOrder.SORT_ORDER_MANUAL,
    showList: false,
    sort,
    showCompleted: prefs.showCompleted,
    completedCount,
    empty: allDone
      ? { title: "All tasks completed.", description: `${completedCount} completed ${completedCount === 1 ? "task is" : "tasks are"} hidden.` }
      : { title: "No tasks yet.", description: "Add a task to get started." },
  }
}
