import * as React from "react"
import { useDefaultLayout } from "react-resizable-panels"
import { PanelLeftIcon, PanelRightIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { AppCommands } from "@/components/home/app-commands"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmDialog, undoToast } from "@/components/ui/confirm-dialog"
import { Kbd } from "@/components/ui/kbd"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { navigate, useRoute } from "@/components/ui/router"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ipc } from "@/gen/ipc"
import { Priority, SortOrder, type Change, type Task, type TaskList } from "@/gen/reminders"
import { applyChanges, loadLibrary, useLibrary } from "@/hooks/use-library"
import { cn } from "@/lib/utils"
import { readPref, writePref } from "@/lib/local-prefs"
import { nextListColor } from "@/lib/list-colors"
import { hasModKey, shortcutLabel } from "@/lib/platform"
import { buildIndex, childrenOf, dayKey, isInSubtree, isSmartView, type TaskIndex, type TreeNode } from "@/lib/reminders"
import { buildView, effectiveSort, SEARCH_VIEW, viewCounts, viewPrefs, type ViewModel } from "@/lib/views"
import { AppSidebar } from "@/components/reminders/app-sidebar"
import {
  TaskActionsContext,
  type AfterCommit,
  type DropPosition,
  type TaskActions,
} from "@/components/reminders/task-actions-context"
import { TaskDetailsPane, type TaskFields } from "@/components/reminders/task-details-pane"
import type { Draft } from "@/components/reminders/task-tree"
import { TaskView } from "@/components/reminders/task-view"
import type { ListActions } from "@/components/reminders/user-list-navigation"

function openSettings() {
  ipc.app.OpenSettings({ section: "general" }).catch((error: unknown) => {
    console.warn("Couldn't open Settings:", error)
  })
}

/** How long a just-completed task stays where it was before a view that hides it drops it. */
const LINGER_MS = 1500

const SIDEBAR_WIDTH = { default: 240, min: 200, max: 360 }
const DETAILS_WIDTH = { default: 300, min: 240, max: 440 }

type Confirm =
  | { kind: "task"; task: Task; subtasks: number }
  | { kind: "list"; list: TaskList; tasks: number }
  | { kind: "clear"; ids: string[]; count: number }
  | { kind: "sample" }

/** Where a task sits in a view: its shown siblings and its place among them. */
function locate(view: ViewModel, id: string): { siblings: TreeNode[]; at: number } | null {
  const search = (nodes: TreeNode[]): { siblings: TreeNode[]; at: number } | null => {
    const at = nodes.findIndex((node) => node.task.id === id)
    if (at !== -1) return { siblings: nodes, at }
    for (const node of nodes) {
      const found = search(node.children)
      if (found) return found
    }
    return null
  }
  for (const section of view.sections) {
    const found = search(section.nodes)
    if (found) return found
  }
  return null
}

/** Every task a view contains, collapsed ones included, in display order. */
function viewTaskIds(view: ViewModel | null): string[] {
  const out: string[] = []
  const walk = (nodes: TreeNode[]) =>
    nodes.forEach((node) => {
      out.push(node.task.id)
      walk(node.children)
    })
  view?.sections.forEach((section) => walk(section.nodes))
  return out
}

/** A task and all of its subtasks, as they are now (what Undo puts back). */
function subtreeOf(index: TaskIndex, task: Task): Task[] {
  const out = [task]
  for (const child of childrenOf(index, task)) out.push(...subtreeOf(index, child))
  return out
}

/** The task a sibling gets in this view: due today in Today, on the same day in Scheduled. */
function defaultDue(view: ViewModel | null, anchor?: Task): string {
  if (!view || view.kind !== "smart") return ""
  if (view.id === "today") return dayKey()
  if (view.id === "scheduled") return anchor?.dueDate || dayKey()
  return ""
}

/**
 * The main window (`#/today`, `#/lists/<id>`, …): a resizable sidebar (search, smart-list tiles,
 * My Lists), the selected view's tasks, and the details of the selected task. It owns the
 * screen's state (selection, editing, the draft row, what is collapsed) and implements every
 * task action; the data itself lives in the main process (hooks/use-library.ts).
 */
export function HomeApp() {
  const snapshot = useLibrary()
  const library = snapshot.status === "ready" ? snapshot.library : null
  const index = React.useMemo(() => (library ? buildIndex(library) : null), [library])
  const { segments } = useRoute()

  // The clock relative dates and "overdue" follow: once a minute, and when the window returns.
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const tick = () => setNow(new Date())
    const timer = window.setInterval(tick, 60_000)
    window.addEventListener("focus", tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", tick)
    }
  }, [])

  // --- Which view ---------------------------------------------------------------------------
  const routeView = segments[0] === "lists" ? (segments[1] ?? "") : (segments[0] ?? "")
  const [query, setQuery] = React.useState("")
  React.useEffect(() => {
    // A new view starts without a search.
    setQuery("")
  }, [routeView])
  React.useEffect(() => {
    if (!index) return
    const known = isSmartView(routeView) || index.listById.has(routeView)
    if (known) {
      writePref("reminders.lastView", routeView)
      if (index.listById.has(routeView)) writePref("reminders.lastList", routeView)
      return
    }
    // The start (`#/`), or a list that no longer exists: the last view, else Today.
    const last = readPref<string>("reminders.lastView", "today")
    const target = isSmartView(last) ? `/${last}` : index.listById.has(last) ? `/lists/${last}` : "/today"
    navigate(target, { replace: true })
  }, [index, routeView])

  const lastList = readPref<string>("reminders.lastList", "")
  const defaultListId = index ? (index.listById.has(lastList) ? lastList : (index.lists[0]?.id ?? null)) : null

  // Tasks completed a moment ago stay in views that hide completed tasks, so the check shows.
  const [lingering, setLingering] = React.useState<ReadonlySet<string>>(() => new Set())
  const linger = (id: string) => {
    setLingering((current) => new Set(current).add(id))
    window.setTimeout(() => {
      setLingering((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }, LINGER_MS)
  }

  const view = React.useMemo(
    () =>
      library && index
        ? buildView({ library, index, viewId: routeView, query, now, lingering, defaultListId })
        : null,
    [library, index, routeView, query, now, lingering, defaultListId],
  )
  const counts = React.useMemo(() => (library ? viewCounts(library, now) : {}), [library, now])
  const lists = index?.lists ?? []

  // --- Screen state -------------------------------------------------------------------------
  const [sidebarOpen, setSidebarOpenState] = React.useState(() => readPref("reminders.sidebarOpen", true))
  const setSidebarOpen = React.useCallback((open: boolean) => {
    setSidebarOpenState(open)
    writePref("reminders.sidebarOpen", open)
  }, [])
  const [detailsOpen, setDetailsOpenState] = React.useState(() => readPref("reminders.detailsOpen", true))
  const setDetailsOpen = React.useCallback((open: boolean) => {
    setDetailsOpenState(open)
    writePref("reminders.detailsOpen", open)
  }, [])
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(
    () => new Set(readPref<string[]>("reminders.collapsed", [])),
  )
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [focusRequest, setFocusRequest] = React.useState<{ id: string; seq: number } | null>(null)
  const [renamingListId, setRenamingListId] = React.useState<string | null>(null)
  const [confirm, setConfirm] = React.useState<Confirm | null>(null)
  const [pickDate, setPickDate] = React.useState(false)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const addInputRef = React.useRef<HTMLInputElement>(null)
  const [focusSearchSoon, setFocusSearchSoon] = React.useState(0)

  // A new view starts with nothing selected or being edited.
  const viewKey = query.trim() ? `${SEARCH_VIEW}:${query}` : routeView
  React.useEffect(() => {
    setSelectedId(null)
    setEditingId(null)
    setDraft(null)
  }, [viewKey])

  // A selection that left the view (deleted, moved to another list) is dropped when the view
  // changes. A task created here a moment ago may not have arrived yet, so it is kept.
  const inView = React.useMemo(() => new Set(viewTaskIds(view)), [view])
  const selectionRef = React.useRef({ selectedId, editingId })
  selectionRef.current = { selectedId, editingId }
  React.useEffect(() => {
    const { selectedId: selected, editingId: editing } = selectionRef.current
    if (selected && !inView.has(selected) && index?.byId.has(selected)) setSelectedId(null)
    if (editing && !inView.has(editing)) setEditingId(null)
  }, [inView, index])

  React.useEffect(() => {
    if (focusSearchSoon) searchRef.current?.focus()
  }, [focusSearchSoon])

  // --- Actions ------------------------------------------------------------------------------
  // The latest state for the stable action object below.
  const live = { index, view, library, selectedId, draft, collapsed }
  const liveRef = React.useRef(live)
  React.useLayoutEffect(() => {
    liveRef.current = live
  })

  const requestFocus = React.useCallback((id: string) => {
    setFocusRequest((current) => ({ id, seq: (current?.seq ?? 0) + 1 }))
  }, [])

  const setExpanded = React.useCallback((id: string, expanded: boolean) => {
    setCollapsed((current) => {
      if (current.has(id) === !expanded) return current
      const next = new Set(current)
      if (expanded) next.delete(id)
      else next.add(id)
      writePref("reminders.collapsed", [...next])
      return next
    })
  }, [])

  const actions = React.useMemo<TaskActions & {
    deleteNow: (ids: string[]) => void
    moveBy: (id: string, delta: -1 | 1) => void
  }>(() => {
    const get = () => liveRef.current
    const task = (id: string) => get().index?.byId.get(id)

    const apply = (...changes: Change[]) => applyChanges(...changes)

    const indent = (id: string) => {
      const { view } = get()
      const current = task(id)
      if (!current || !view) return
      const found = locate(view, id)
      const previous = found && found.at > 0 ? found.siblings[found.at - 1].task : undefined
      if (!previous || previous.listId !== current.listId || previous.parentId !== current.parentId) return
      setExpanded(previous.id, true)
      void apply({ moveTask: { id, listId: current.listId, parentId: previous.id, placement: {} } })
    }
    const outdent = (id: string) => {
      const current = task(id)
      const parent = current && task(current.parentId)
      if (!current || !parent) return
      void apply({ moveTask: { id, listId: current.listId, parentId: parent.parentId, placement: { afterId: parent.id } } })
    }

    const deleteNow = (ids: string[]) => {
      const { index, view } = get()
      if (!index) return
      const doomed = ids.map((id) => index.byId.get(id)).filter((candidate): candidate is Task => !!candidate)
      if (doomed.length === 0) return
      const removed = new Set(doomed.flatMap((one) => subtreeOf(index, one)).map((one) => one.id))
      // Restore parents before the subtasks they hold, each with its position.
      const snapshot = doomed.flatMap((one) => subtreeOf(index, one))
      // The selection moves to the next row left in the view, else the one before.
      const order = viewTaskIds(view)
      const from = order.findIndex((id) => removed.has(id))
      const next = order.slice(from + 1).find((id) => !removed.has(id)) ?? order.slice(0, Math.max(from, 0)).reverse().find((id) => !removed.has(id))
      void apply({ deleteTasks: { ids: doomed.map((one) => one.id) } }).then((ok) => {
        if (!ok) return
        if (next) {
          setSelectedId(next)
          requestFocus(next)
        } else setSelectedId(null)
        const label = doomed.length === 1 ? `“${doomed[0].title}” deleted` : `${doomed.length} tasks deleted`
        undoToast(label, () => {
          void apply({ restoreTasks: { tasks: snapshot } }).then((restored) => {
            if (restored && doomed.length === 1) {
              setSelectedId(doomed[0].id)
              requestFocus(doomed[0].id)
            }
          })
        })
      })
    }

    const moveBy = (id: string, delta: -1 | 1) => {
      const { view } = get()
      const current = task(id)
      if (!current || !view?.reorderable) return
      const found = locate(view, id)
      const neighbor = found?.siblings[found.at + delta]?.task
      if (!neighbor) return
      void apply({
        moveTask: {
          id,
          listId: current.listId,
          parentId: current.parentId,
          placement: delta < 0 ? { beforeId: neighbor.id } : { afterId: neighbor.id },
        },
      })
      requestFocus(id)
    }

    const canDrop = (dragId: string, targetId: string, position: DropPosition) => {
      const { index } = get()
      const target = task(targetId)
      if (!index || !target || dragId === targetId) return false
      const parentId = position === "inside" ? targetId : target.parentId
      return !parentId || !isInSubtree(index, parentId, dragId)
    }

    const startDraft = (next: Draft) => {
      setEditingId(null)
      setDraft(next)
    }

    return {
      select(id, options) {
        setSelectedId(id)
        setEditingId((current) => (current && current !== id ? null : current))
        if (id && options?.focus) requestFocus(id)
      },
      toggleCompleted(id) {
        const current = task(id)
        if (!current) return
        if (!current.completed) linger(id)
        void apply({ setCompleted: { id, completed: !current.completed } })
      },
      toggleExpanded(id) {
        setExpanded(id, get().collapsed.has(id))
      },
      startEditing(id) {
        setDraft(null)
        setSelectedId(id)
        setEditingId(id)
      },
      commitTitle(id, title, after: AfterCommit) {
        const current = task(id)
        if (!current) return
        const clean = title.trim()
        if (clean && clean !== current.title) void apply({ updateTask: { id, title: clean } })
        if (after === "indent") indent(id)
        else if (after === "outdent") outdent(id)
        else if (after === "next") {
          startDraft({ id: crypto.randomUUID(), listId: current.listId, parentId: current.parentId, afterId: id, dueDate: defaultDue(get().view, current) })
        } else setEditingId(null)
      },
      stopEditing() {
        const id = get().selectedId
        setEditingId(null)
        if (id) requestFocus(id)
      },
      addSibling(id) {
        const current = task(id)
        if (!current) return
        setSelectedId(id)
        startDraft({ id: crypto.randomUUID(), listId: current.listId, parentId: current.parentId, afterId: id, dueDate: defaultDue(get().view, current) })
      },
      addSubtask(id) {
        const current = task(id)
        if (!current) return
        setExpanded(id, true)
        setSelectedId(id)
        startDraft({ id: crypto.randomUUID(), listId: current.listId, parentId: id, afterId: "", dueDate: defaultDue(get().view, current) })
      },
      commitDraft(title, after) {
        const current = get().draft
        if (!current) return
        const clean = title.trim()
        if (after === "indent") {
          if (current.afterId && task(current.afterId)) {
            setExpanded(current.afterId, true)
            setDraft({ ...current, parentId: current.afterId, afterId: "" })
          }
          return
        }
        if (after === "outdent") {
          const parent = task(current.parentId)
          if (parent) setDraft({ ...current, parentId: parent.parentId, afterId: parent.id })
          return
        }
        if (!clean) {
          setDraft(null)
          const id = get().selectedId
          if (id && after === "next") requestFocus(id)
          return
        }
        void apply({
          createTask: {
            id: current.id,
            listId: current.listId,
            parentId: current.parentId,
            title: clean,
            placement: current.afterId ? { afterId: current.afterId } : {},
            dueDate: current.dueDate,
            priority: Priority.PRIORITY_NORMAL,
          },
        })
        setSelectedId(current.id)
        if (after === "next") setDraft({ ...current, id: crypto.randomUUID(), afterId: current.id })
        else setDraft(null)
      },
      cancelDraft() {
        setDraft(null)
        const id = get().selectedId
        if (id) requestFocus(id)
      },
      indent,
      outdent,
      openDetails(id, options) {
        setSelectedId(id)
        setDetailsOpen(true)
        if (options?.pickDate) window.setTimeout(() => setPickDate(true), 50)
      },
      setDue(id, day) {
        void apply({ updateTask: { id, dueDate: day } })
      },
      setPriority(id, priority) {
        void apply({ updateTask: { id, priority } })
      },
      moveToList(id, listId) {
        const current = task(id)
        const list = get().index?.listById.get(listId)
        if (!current || !list || (current.listId === listId && !current.parentId)) return
        void apply({ moveTask: { id, listId, parentId: "", placement: {} } }).then((ok) => {
          if (ok) toast.success(`Moved “${current.title}” to ${list.name}`)
        })
      },
      delete(id) {
        const { index } = get()
        const current = task(id)
        if (!current || !index) return
        const subtasks = subtreeOf(index, current).length - 1
        if (subtasks > 0) setConfirm({ kind: "task", task: current, subtasks })
        else deleteNow([id])
      },
      deleteNow,
      moveBy,
      canDrop,
      drop(dragId, targetId, position: DropPosition) {
        const target = task(targetId)
        if (!target || !canDrop(dragId, targetId, position)) return
        if (position === "inside") {
          setExpanded(targetId, true)
          void apply({ moveTask: { id: dragId, listId: target.listId, parentId: targetId, placement: {} } })
        } else {
          void apply({
            moveTask: {
              id: dragId,
              listId: target.listId,
              parentId: target.parentId,
              placement: position === "before" ? { beforeId: targetId } : { afterId: targetId },
            },
          })
        }
        setSelectedId(dragId)
      },
    }
  }, [requestFocus, setExpanded, setDetailsOpen])

  // --- Lists --------------------------------------------------------------------------------
  const deleteListNow = React.useCallback(
    (list: TaskList) => {
      const { index } = liveRef.current
      if (!index) return
      const tasks = (library?.tasks ?? []).filter((one) => one.listId === list.id)
      // Parents first, so Undo can put each subtask back under its parent.
      const ordered = [...tasks].sort((a, b) => (index.order.get(a.id) ?? 0) - (index.order.get(b.id) ?? 0))
      void applyChanges({ deleteList: { id: list.id } }).then((ok) => {
        if (!ok) return
        if (routeView === list.id) navigate("/today", { replace: true })
        undoToast(`“${list.name}” deleted`, () => {
          void applyChanges({ restoreList: { list, tasks: ordered } })
        })
      })
    },
    [library, routeView],
  )

  const newList = React.useCallback(() => {
    const id = crypto.randomUUID()
    setSidebarOpen(true)
    void applyChanges({
      createList: { id, name: "New List", color: nextListColor(lists.map((list) => list.color)) },
    }).then((ok) => {
      if (!ok) return
      navigate(`/lists/${id}`)
      setRenamingListId(id)
    })
  }, [lists, setSidebarOpen])

  const listActions = React.useMemo<ListActions>(
    () => ({
      onNewList: newList,
      onStartRename: (id) => {
        setSidebarOpen(true)
        setRenamingListId(id)
      },
      onRename: (id, name) => {
        setRenamingListId(null)
        void applyChanges({ updateList: { id, name } })
      },
      onCancelRename: () => setRenamingListId(null),
      onSetColor: (id, color) => void applyChanges({ updateList: { id, color } }),
      onDelete: (list) => {
        const tasks = library?.tasks.filter((one) => one.listId === list.id).length ?? 0
        if (tasks > 0) setConfirm({ kind: "list", list, tasks })
        else deleteListNow(list)
      },
      onDropTask: (taskId, listId) => actions.moveToList(taskId, listId),
    }),
    [newList, setSidebarOpen, library, deleteListNow, actions],
  )

  // --- View preferences and clearing --------------------------------------------------------
  const setViewPrefs = (update: { sort?: SortOrder; showCompleted?: boolean }) => {
    if (!library || !view || view.kind !== "list") return
    const prefs = viewPrefs(library, view.id)
    void applyChanges({
      setViewPrefs: {
        prefs: {
          viewId: view.id,
          sort: update.sort ?? effectiveSort(prefs),
          showCompleted: update.showCompleted ?? prefs.showCompleted,
        },
      },
    })
  }
  const toggleShowCompleted = () => view && setViewPrefs({ showCompleted: !view.showCompleted })

  /** The completed tasks the view's "Clear" removes: only ones with no open task below them. */
  const clearable = (): string[] => {
    if (!library || !index || !view) return []
    const scope = view.kind === "list" ? library.tasks.filter((one) => one.listId === view.id) : library.tasks
    const allDone = (one: Task): boolean => one.completed && childrenOf(index, one).every(allDone)
    const ids = new Set(scope.filter(allDone).map((one) => one.id))
    // Deleting a task deletes its subtasks: name only the topmost ones.
    return [...ids].filter((id) => !ids.has(index.byId.get(id)?.parentId ?? ""))
  }
  const requestClearCompleted = () => {
    const ids = clearable()
    if (ids.length === 0) {
      toast("There are no completed tasks to delete.")
      return
    }
    const count = ids.reduce((sum, id) => sum + (index ? subtreeOf(index, index.byId.get(id)!).length : 1), 0)
    setConfirm({ kind: "clear", ids, count })
  }

  // --- Commands -----------------------------------------------------------------------------
  const selectedTask = selectedId ? (index?.byId.get(selectedId) ?? null) : null
  const found = selectedId && view ? locate(view, selectedId) : null
  const previous = found && found.at > 0 ? found.siblings[found.at - 1].task : null
  const canIndent =
    !!selectedTask && !!previous && previous.listId === selectedTask.listId && previous.parentId === selectedTask.parentId
  const canOutdent = !!selectedTask?.parentId
  const canMoveUp = !!view?.reorderable && !!found && found.at > 0
  const canMoveDown = !!view?.reorderable && !!found && found.at < found.siblings.length - 1

  const addParents = React.useMemo(() => {
    // Tab in the add field: under the last top-level task, its last subtask, and so on.
    if (!index || !view || view.kind !== "list") return []
    const out: string[] = []
    let siblings = index.children.get(`${view.id}/`) ?? []
    while (siblings.length > 0) {
      const last = siblings[siblings.length - 1]
      out.push(last.id)
      siblings = childrenOf(index, last)
    }
    return out
  }, [index, view])

  const createFromInput = (title: string, parentId: string) => {
    if (!view?.addTarget) return
    const clean = title.trim()
    if (!clean) return
    if (parentId) setExpanded(parentId, true)
    void applyChanges({
      createTask: {
        id: crypto.randomUUID(),
        listId: view.addTarget.listId,
        parentId,
        title: clean,
        placement: {},
        dueDate: view.addTarget.dueDate,
        priority: Priority.PRIORITY_NORMAL,
      },
    })
  }

  const focusSearch = () => {
    setSidebarOpen(true)
    setFocusSearchSoon((count) => count + 1)
  }

  // Settings: the menu binds ⌘, too, but a key press sent to the page (an e2e test, `agent
  // press-key`) never reaches a native menu. Opening Settings twice only focuses it.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "," && hasModKey(event) && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        openSettings()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // --- Render -------------------------------------------------------------------------------
  const layout = useDefaultLayout({
    id: "main-layout",
    storage: localStorage, // probe-ok: pane widths are a UI convenience
    onlySaveAfterUserInteractions: true,
    panelIds: ["sidebar", "content", "details"].filter(
      (id) => (id !== "sidebar" || sidebarOpen) && (id !== "details" || detailsOpen),
    ),
  })
  const current = query.trim() ? null : routeView
  const sidebarLabel = sidebarOpen ? "Hide Sidebar" : "Show Sidebar"
  const detailsLabel = detailsOpen ? "Hide Details" : "Show Details"

  return (
    <TaskActionsContext.Provider value={actions}>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} className="h-svh min-h-0 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" {...layout}>
          {sidebarOpen && (
            <>
              <ResizablePanel
                id="sidebar"
                defaultSize={`${SIDEBAR_WIDTH.default}px`}
                minSize={`${SIDEBAR_WIDTH.min}px`}
                maxSize={`${SIDEBAR_WIDTH.max}px`}
                groupResizeBehavior="preserve-pixel-size"
              >
                <AppSidebar
                  lists={lists}
                  counts={counts}
                  current={current}
                  query={query}
                  onQueryChange={setQuery}
                  searchRef={searchRef}
                  renamingId={renamingListId}
                  listActions={listActions}
                />
              </ResizablePanel>
              <ResizableHandle aria-label="Resize sidebar" />
            </>
          )}
          <ResizablePanel id="content" minSize="320px">
            <main className="flex h-full min-w-0 flex-col bg-background">
              {/* Flush to the top, on the traffic lights' baseline; with the sidebar hidden the
                  controls move right of the traffic lights. The empty space drags the window. */}
              <header
                className={cn(
                  "app-drag-region flex h-12 shrink-0 items-center gap-1 px-2",
                  !sidebarOpen && "pl-[max(0.5rem,calc(var(--titlebar-traffic-width)+0.5rem))]",
                )}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        data-sidebar="trigger"
                        aria-label={sidebarLabel}
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                      />
                    }
                  >
                    <PanelLeftIcon />
                  </TooltipTrigger>
                  <TooltipContent>
                    {sidebarLabel} <Kbd>{shortcutLabel("B")}</Kbd>
                  </TooltipContent>
                </Tooltip>
                <div className="flex-1" />
                {view?.addTarget && (
                  <Tooltip>
                    <TooltipTrigger
                      render={<Button variant="ghost" size="icon-sm" aria-label="New Task" onClick={() => addInputRef.current?.focus()} />}
                    >
                      <PlusIcon />
                    </TooltipTrigger>
                    <TooltipContent>
                      New Task <Kbd>{shortcutLabel("N")}</Kbd>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={detailsLabel}
                        onClick={() => setDetailsOpen(!detailsOpen)}
                      />
                    }
                  >
                    <PanelRightIcon />
                  </TooltipTrigger>
                  <TooltipContent>
                    {detailsLabel} <Kbd>{shortcutLabel("I", { alt: true })}</Kbd>
                  </TooltipContent>
                </Tooltip>
              </header>
              {snapshot.status === "error" ? (
                <div className="p-6">
                  <Alert variant="destructive">
                    <AlertTitle>Your reminders couldn't be loaded.</AlertTitle>
                    <AlertDescription className="flex flex-col items-start gap-2">
                      <span>{snapshot.error}</span>
                      <Button variant="outline" size="sm" onClick={loadLibrary}>
                        Try Again
                      </Button>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : !view || !index ? (
                <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Loading…
                </div>
              ) : (
                <TaskView
                  key={view.id}
                  view={view}
                  index={index}
                  lists={lists}
                  count={counts[view.id] ?? 0}
                  collapsed={collapsed}
                  selectedId={selectedId}
                  editingId={editingId}
                  draft={draft}
                  focusRequest={focusRequest}
                  now={now}
                  addInputRef={addInputRef}
                  addParents={addParents}
                  onCreate={createFromInput}
                  onToggleShowCompleted={toggleShowCompleted}
                  onSort={(sort) => setViewPrefs({ sort })}
                  onClearCompleted={requestClearCompleted}
                  onRenameList={() => listActions.onStartRename(view.id)}
                  onSetListColor={(color) => listActions.onSetColor(view.id, color)}
                  onDeleteList={() => {
                    const list = index.listById.get(view.id)
                    if (list) listActions.onDelete(list)
                  }}
                  onNewList={newList}
                  onClearSearch={() => setQuery("")}
                />
              )}
            </main>
          </ResizablePanel>
          {detailsOpen && (
            <>
              <ResizableHandle aria-label="Resize details" />
              <ResizablePanel
                id="details"
                defaultSize={`${DETAILS_WIDTH.default}px`}
                minSize={`${DETAILS_WIDTH.min}px`}
                maxSize={`${DETAILS_WIDTH.max}px`}
                groupResizeBehavior="preserve-pixel-size"
              >
                {index && (
                  <TaskDetailsPane
                    task={selectedTask}
                    index={index}
                    lists={lists}
                    pickDate={pickDate}
                    onPickDateChange={setPickDate}
                    onUpdate={(id, fields: TaskFields) => void applyChanges({ updateTask: { id, ...fields } })}
                    onAddSubtask={(parentId, title) => {
                      const parent = index.byId.get(parentId)
                      if (!parent || !title.trim()) return
                      setExpanded(parentId, true)
                      void applyChanges({
                        createTask: {
                          id: crypto.randomUUID(),
                          listId: parent.listId,
                          parentId,
                          title: title.trim(),
                          placement: {},
                          dueDate: "",
                          priority: Priority.PRIORITY_NORMAL,
                        },
                      })
                    }}
                    onClose={() => setDetailsOpen(false)}
                  />
                )}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        <ConfirmDialogs
          confirm={confirm}
          onClose={() => setConfirm(null)}
          onDeleteTask={(task) => actions.deleteNow([task.id])}
          onDeleteList={deleteListNow}
          onClear={(ids) => actions.deleteNow(ids)}
          onRemoveSample={() => {
            void applyChanges({ removeSampleData: {} }).then((ok) => ok && toast.success("Sample data removed"))
          }}
        />

        <AppCommands
          ready={!!view}
          view={view}
          selectedTask={selectedTask}
          sidebarOpen={sidebarOpen}
          detailsOpen={detailsOpen}
          hasSampleData={!!library && (library.lists.some((list) => list.sample) || library.tasks.some((one) => one.sample))}
          canIndent={canIndent}
          canOutdent={canOutdent}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onNewTask={() => addInputRef.current?.focus()}
          onNewList={newList}
          onRemoveSampleData={() => setConfirm({ kind: "sample" })}
          onFind={focusSearch}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleDetails={() => setDetailsOpen(!detailsOpen)}
          onShowView={(id) => navigate(`/${id}`)}
          onToggleShowCompleted={toggleShowCompleted}
          onSort={(sort) => setViewPrefs({ sort })}
          onToggleCompleted={(id) => actions.toggleCompleted(id)}
          onAddSubtask={(id) => actions.addSubtask(id)}
          onIndent={(id) => actions.indent(id)}
          onOutdent={(id) => actions.outdent(id)}
          onMove={(id, delta) => actions.moveBy(id, delta)}
          onSetDue={(id, day) => actions.setDue(id, day)}
          onSetPriority={(id, priority) => actions.setPriority(id, priority)}
          onDelete={(id) => actions.delete(id)}
          onSelectNext={(delta) => {
            const order = viewTaskIds(view).filter((id) => document.getElementById(`task-${id}`))
            if (order.length === 0) return
            const at = selectedId ? order.indexOf(selectedId) : -1
            const next = order[Math.min(Math.max(at + delta, 0), order.length - 1)] ?? order[0]
            actions.select(next, { focus: true })
          }}
        />
      </SidebarProvider>
    </TaskActionsContext.Provider>
  )
}

function ConfirmDialogs({
  confirm,
  onClose,
  onDeleteTask,
  onDeleteList,
  onClear,
  onRemoveSample,
}: {
  confirm: Confirm | null
  onClose: () => void
  onDeleteTask: (task: Task) => void
  onDeleteList: (list: TaskList) => void
  onClear: (ids: string[]) => void
  onRemoveSample: () => void
}) {
  // Keep the last request while the dialog animates out.
  const last = React.useRef<Confirm | null>(confirm)
  if (confirm) last.current = confirm
  const shown = confirm ?? last.current
  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`

  let title = ""
  let description = ""
  let confirmLabel = ""
  let run = () => {}
  switch (shown?.kind) {
    case "task":
      title = `Delete “${shown.task.title}”?`
      description = `Its ${plural(shown.subtasks, "subtask")} will be deleted too. You can undo this right after.`
      confirmLabel = "Delete Task"
      run = () => onDeleteTask(shown.task)
      break
    case "list":
      title = `Delete “${shown.list.name}”?`
      description = `This deletes the list and its ${plural(shown.tasks, "task")}. You can undo this right after.`
      confirmLabel = "Delete List"
      run = () => onDeleteList(shown.list)
      break
    case "clear":
      title = `Delete ${plural(shown.count, "completed task")}?`
      description = "Completed tasks that still have open subtasks are kept. You can undo this right after."
      confirmLabel = "Delete Completed"
      run = () => onClear(shown.ids)
      break
    case "sample":
      title = "Remove the sample data?"
      description =
        "This deletes the sample lists and tasks the app started with. Tasks and lists you created are kept."
      confirmLabel = "Remove Sample Data"
      run = onRemoveSample
      break
  }

  return (
    <ConfirmDialog
      open={!!confirm}
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive
      onConfirm={() => {
        run()
      }}
    />
  )
}
