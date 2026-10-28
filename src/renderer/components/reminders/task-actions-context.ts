import * as React from "react"

import type { Priority } from "@/gen/reminders"

/**
 * What a task row, the details pane and the commands can do to tasks. The main screen
 * (components/home/home-app.tsx) implements it; the object it provides never changes identity,
 * so memoized rows don't re-render when an unrelated task changes.
 */

/** What happens after an inline title edit is committed. */
export type AfterCommit = "none" | "next" | "indent" | "outdent"

export type DropPosition = "before" | "after" | "inside"

export interface TaskActions {
  /** Selects a task (null clears) and, with `focus`, moves the keyboard focus to its row. */
  select(id: string | null, options?: { focus?: boolean }): void
  toggleCompleted(id: string): void
  toggleExpanded(id: string): void
  startEditing(id: string): void
  commitTitle(id: string, title: string, after: AfterCommit): void
  stopEditing(): void
  /** A new, empty row right after the task, as its sibling. */
  addSibling(id: string): void
  /** A new, empty row as the task's last subtask. */
  addSubtask(id: string): void
  commitDraft(title: string, after: AfterCommit): void
  cancelDraft(): void
  indent(id: string): void
  outdent(id: string): void
  openDetails(id: string, options?: { pickDate?: boolean }): void
  setDue(id: string, day: string): void
  setPriority(id: string, priority: Priority): void
  moveToList(id: string, listId: string): void
  delete(id: string): void
  drop(dragId: string, targetId: string, position: DropPosition): void
  canDrop(dragId: string, targetId: string, position: DropPosition): boolean
}

export const TaskActionsContext = React.createContext<TaskActions | null>(null)

export function useTaskActions(): TaskActions {
  const actions = React.useContext(TaskActionsContext)
  if (!actions) throw new Error("useTaskActions must be used within TaskActionsContext")
  return actions
}
