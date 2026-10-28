import * as React from "react"

import {
  claimCommand,
  dialogOpen,
  useDialogOpen,
  useMenuCommands,
  useMenuState,
  type CommandSource,
} from "@/hooks/use-menu-commands"
import { Command } from "@/gen/menu"
import { Priority, SortOrder, type Task } from "@/gen/reminders"
import { hasModKey } from "@/lib/platform"
import { dayOffset, effectivePriority, type SmartViewId } from "@/lib/reminders"
import type { ViewModel } from "@/lib/views"

/** Whether keys typed now go into a text field (where Space, Delete and arrows edit text). */
function isTextField(element: Element | null): boolean {
  if (!element) return false
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true
  if (element instanceof HTMLInputElement) {
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(element.type)
  }
  return (element as HTMLElement).isContentEditable
}

/** Re-renders when the focus moves into or out of a text field (the DOM isn't React state). */
function useTextFieldFocused(): boolean {
  const [focused, setFocused] = React.useState(() => isTextField(document.activeElement))
  React.useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      // Let the focus settle: focusout fires before the next element is focused.
      frame = requestAnimationFrame(() => setFocused(isTextField(document.activeElement)))
    }
    document.addEventListener("focusin", update)
    document.addEventListener("focusout", update)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("focusin", update)
      document.removeEventListener("focusout", update)
    }
  }, [])
  return focused
}

const SORT_COMMANDS: [Command, SortOrder][] = [
  [Command.COMMAND_SORT_MANUAL, SortOrder.SORT_ORDER_MANUAL],
  [Command.COMMAND_SORT_DUE_DATE, SortOrder.SORT_ORDER_DUE_DATE],
  [Command.COMMAND_SORT_CREATED, SortOrder.SORT_ORDER_CREATED],
  [Command.COMMAND_SORT_TITLE, SortOrder.SORT_ORDER_TITLE],
  [Command.COMMAND_SORT_PRIORITY, SortOrder.SORT_ORDER_PRIORITY],
]

const PRIORITY_COMMANDS: [Command, Priority][] = [
  [Command.COMMAND_PRIORITY_HIGH, Priority.PRIORITY_HIGH],
  [Command.COMMAND_PRIORITY_NORMAL, Priority.PRIORITY_NORMAL],
  [Command.COMMAND_PRIORITY_LOW, Priority.PRIORITY_LOW],
]

const VIEW_COMMANDS: [Command, SmartViewId][] = [
  [Command.COMMAND_SHOW_TODAY, "today"],
  [Command.COMMAND_SHOW_SCHEDULED, "scheduled"],
  [Command.COMMAND_SHOW_ALL, "all"],
  [Command.COMMAND_SHOW_COMPLETED_LIST, "completed"],
]

/**
 * A ⌘/Ctrl shortcut the page handles too, matched by `event.code` (⌥ changes `event.key`), or
 * by `key` for punctuation, whose code differs between keyboard layouts.
 */
const SHORTCUTS: { code: string; key?: string; shift?: boolean; alt?: boolean; command: Command }[] = [
  { code: "KeyN", command: Command.COMMAND_NEW_TASK },
  { code: "KeyN", shift: true, command: Command.COMMAND_NEW_LIST },
  { code: "KeyN", alt: true, command: Command.COMMAND_ADD_SUBTASK },
  { code: "KeyF", command: Command.COMMAND_FIND },
  { code: "KeyB", command: Command.COMMAND_TOGGLE_SIDEBAR },
  { code: "KeyI", alt: true, command: Command.COMMAND_TOGGLE_DETAILS },
  { code: "Digit1", command: Command.COMMAND_SHOW_TODAY },
  { code: "Digit2", command: Command.COMMAND_SHOW_SCHEDULED },
  { code: "Digit3", command: Command.COMMAND_SHOW_ALL },
  { code: "Digit4", command: Command.COMMAND_SHOW_COMPLETED_LIST },
  { code: "KeyH", shift: true, command: Command.COMMAND_TOGGLE_SHOW_COMPLETED },
  { code: "KeyC", shift: true, command: Command.COMMAND_TOGGLE_COMPLETED },
  { code: "BracketRight", key: "]", command: Command.COMMAND_INDENT },
  { code: "BracketLeft", key: "[", command: Command.COMMAND_OUTDENT },
  { code: "ArrowUp", alt: true, command: Command.COMMAND_MOVE_UP },
  { code: "ArrowDown", alt: true, command: Command.COMMAND_MOVE_DOWN },
  { code: "KeyT", command: Command.COMMAND_DUE_TODAY },
  { code: "KeyT", alt: true, command: Command.COMMAND_DUE_TOMORROW },
]

/**
 * The main window's commands: run from the application menu (streamed from the main process)
 * and from their keyboard shortcuts on the page. Each guard below is one function, used both
 * to decide whether a command runs and to report the menu state that enables its item
 * (.agents/skills/desktop-shell/rules/menu.md). Renders nothing.
 */
export function AppCommands(props: {
  ready: boolean
  view: ViewModel | null
  selectedTask: Task | null
  sidebarOpen: boolean
  detailsOpen: boolean
  hasSampleData: boolean
  canIndent: boolean
  canOutdent: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onNewTask: () => void
  onNewList: () => void
  onRemoveSampleData: () => void
  onFind: () => void
  onToggleSidebar: () => void
  onToggleDetails: () => void
  onShowView: (id: SmartViewId) => void
  onToggleShowCompleted: () => void
  onSort: (sort: SortOrder) => void
  onToggleCompleted: (id: string) => void
  onAddSubtask: (id: string) => void
  onIndent: (id: string) => void
  onOutdent: (id: string) => void
  onMove: (id: string, delta: -1 | 1) => void
  onSetDue: (id: string, day: string) => void
  onSetPriority: (id: string, priority: Priority) => void
  onDelete: (id: string) => void
  /** Moves the selection one row down (1) or up (-1) and focuses it. */
  onSelectNext: (delta: -1 | 1) => void
}) {
  const modal = useDialogOpen()
  const textFocused = useTextFieldFocused()
  const { view, selectedTask } = props

  // The guards: the same functions decide whether a command acts and whether its item is enabled.
  const canNewTask = () => !!view?.addTarget
  const isListView = () => view?.kind === "list"
  /** The task the Task menu acts on: the selected one, unless the keys go into a text field. */
  const taskTarget = (focusInText: boolean) => (focusInText ? null : selectedTask)

  const execute = (command: Command, source: CommandSource) => {
    // The same command delivered twice for one keystroke (menu and page) runs once.
    if (!claimCommand(command, source)) return
    // Nothing runs behind a dialog: it would act on what the dialog is about.
    if (dialogOpen() || !props.ready) return
    const task = taskTarget(isTextField(document.activeElement))
    const sort = SORT_COMMANDS.find(([id]) => id === command)
    const priority = PRIORITY_COMMANDS.find(([id]) => id === command)
    const smart = VIEW_COMMANDS.find(([id]) => id === command)
    if (sort) {
      if (isListView()) props.onSort(sort[1])
      return
    }
    if (priority) {
      if (task) props.onSetPriority(task.id, priority[1])
      return
    }
    if (smart) {
      props.onShowView(smart[1])
      return
    }
    switch (command) {
      case Command.COMMAND_NEW_TASK:
        if (canNewTask()) props.onNewTask()
        break
      case Command.COMMAND_NEW_LIST:
        props.onNewList()
        break
      case Command.COMMAND_REMOVE_SAMPLE_DATA:
        if (props.hasSampleData) props.onRemoveSampleData()
        break
      case Command.COMMAND_FIND:
        props.onFind()
        break
      case Command.COMMAND_TOGGLE_SIDEBAR:
        props.onToggleSidebar()
        break
      case Command.COMMAND_TOGGLE_DETAILS:
        props.onToggleDetails()
        break
      case Command.COMMAND_TOGGLE_SHOW_COMPLETED:
        if (isListView()) props.onToggleShowCompleted()
        break
      case Command.COMMAND_TOGGLE_COMPLETED:
        if (task) props.onToggleCompleted(task.id)
        break
      case Command.COMMAND_ADD_SUBTASK:
        if (task) props.onAddSubtask(task.id)
        break
      case Command.COMMAND_INDENT:
        if (task && props.canIndent) props.onIndent(task.id)
        break
      case Command.COMMAND_OUTDENT:
        if (task && props.canOutdent) props.onOutdent(task.id)
        break
      case Command.COMMAND_MOVE_UP:
        if (task && props.canMoveUp) props.onMove(task.id, -1)
        break
      case Command.COMMAND_MOVE_DOWN:
        if (task && props.canMoveDown) props.onMove(task.id, 1)
        break
      case Command.COMMAND_DUE_TODAY:
        if (task) props.onSetDue(task.id, dayOffset(0))
        break
      case Command.COMMAND_DUE_TOMORROW:
        if (task) props.onSetDue(task.id, dayOffset(1))
        break
      case Command.COMMAND_DUE_NONE:
        if (task?.dueDate) props.onSetDue(task.id, "")
        break
      case Command.COMMAND_DELETE_TASK:
        if (task) props.onDelete(task.id)
        break
      default:
        break
    }
  }
  useMenuCommands((command) => execute(command, "menu"))

  // The menu binds the same keys, but a key press sent to the page (an e2e test, `agent
  // press-key`) never reaches a native menu, so the page handles them too. Capture phase: the
  // sidebar component's own ⌘B handler sees the event as handled and leaves it alone.
  const executeRef = React.useRef(execute)
  const propsRef = React.useRef(props)
  React.useLayoutEffect(() => {
    executeRef.current = execute
    propsRef.current = props
  })
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return
      if (hasModKey(event)) {
        const shortcut = SHORTCUTS.find(
          (candidate) =>
            (candidate.code === event.code || (!!candidate.key && candidate.key === event.key)) &&
            !!candidate.shift === event.shiftKey && !!candidate.alt === event.altKey,
        )
        if (!shortcut) return
        event.preventDefault()
        executeRef.current(shortcut.command, "page")
        return
      }
      // Plain keys act on the selected task only when nothing else takes them: the focus is on
      // the page itself (the task tree handles its own keys).
      if (event.altKey || event.ctrlKey || event.metaKey || dialogOpen()) return
      const active = document.activeElement
      if (active && active !== document.body) return
      const current = propsRef.current
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        current.onSelectNext(event.key === "ArrowDown" ? 1 : -1)
      } else if (event.key === " " && current.selectedTask) {
        event.preventDefault()
        current.onToggleCompleted(current.selectedTask.id)
      } else if ((event.key === "Delete" || event.key === "Backspace") && current.selectedTask) {
        event.preventDefault()
        current.onDelete(current.selectedTask.id)
      }
    }
    window.addEventListener("keydown", onKeyDown, { capture: true })
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true })
  }, [])

  const target = taskTarget(textFocused)
  useMenuState({
    ready: props.ready,
    modal,
    sidebarOpen: props.sidebarOpen,
    detailsOpen: props.detailsOpen,
    canNewTask: canNewTask(),
    hasSampleData: props.hasSampleData,
    canToggleShowCompleted: isListView(),
    showCompleted: !!view?.showCompleted,
    canSort: isListView(),
    sort: view?.sort ?? SortOrder.SORT_ORDER_MANUAL,
    taskTarget: !!target,
    taskCompleted: !!target?.completed,
    taskPriority: target ? effectivePriority(target) : Priority.PRIORITY_UNSPECIFIED,
    taskHasDue: !!target?.dueDate,
    canIndent: !!target && props.canIndent,
    canOutdent: !!target && props.canOutdent,
    canMoveUp: !!target && props.canMoveUp,
    canMoveDown: !!target && props.canMoveDown,
  })

  return null
}
