import * as React from "react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { PageTitle } from "@/components/ui/page"
import type { SortOrder, TaskList } from "@/gen/reminders"
import { listColor, smartColor } from "@/lib/list-colors"
import { isSmartView, type TaskIndex } from "@/lib/reminders"
import type { ViewModel } from "@/lib/views"
import { TaskInput } from "@/components/reminders/task-input"
import { TaskTree, type Draft } from "@/components/reminders/task-tree"
import { ViewActionsMenu } from "@/components/reminders/view-actions-menu"

/**
 * The main column: the view's title in its color with its count and actions, its tasks as a
 * tree, the "New Task" field, and an empty state when there is nothing to show.
 */
export function TaskView({
  view,
  index,
  lists,
  count,
  collapsed,
  selectedId,
  editingId,
  draft,
  focusRequest,
  now,
  addInputRef,
  addParents,
  onCreate,
  onToggleShowCompleted,
  onSort,
  onClearCompleted,
  onRenameList,
  onSetListColor,
  onDeleteList,
  onNewList,
  onClearSearch,
}: {
  view: ViewModel
  index: TaskIndex
  lists: TaskList[]
  /** The number beside the title: open tasks in the view. */
  count: number
  collapsed: ReadonlySet<string>
  selectedId: string | null
  editingId: string | null
  draft: Draft | null
  focusRequest: { id: string; seq: number } | null
  now: Date
  addInputRef: React.Ref<HTMLInputElement>
  /** Where Tab in the add field can indent to (regular lists only). */
  addParents: string[]
  onCreate: (title: string, parentId: string) => void
  onToggleShowCompleted: () => void
  onSort: (sort: SortOrder) => void
  onClearCompleted: () => void
  onRenameList: () => void
  onSetListColor: (color: string) => void
  onDeleteList: () => void
  onNewList: () => void
  onClearSearch: () => void
}) {
  const color = isSmartView(view.color) ? smartColor(view.color) : view.kind === "search" ? "var(--foreground)" : listColor(view.color)
  const addColor = view.addTarget ? listColor(index.listById.get(view.addTarget.listId)?.color) : color
  const empty = view.sections.length === 0 && !draft
  const addPlaceholder =
    view.kind === "list" || !view.addTarget
      ? "New Task"
      : `New Task in ${index.listById.get(view.addTarget.listId)?.name ?? "list"}`
  const focusAdd = () => (addInputRef as React.RefObject<HTMLInputElement | null>)?.current?.focus()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-1 pb-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <PageTitle className="text-[1.625rem] leading-9 font-bold" style={{ color }}>
            {view.title}
          </PageTitle>
          {view.kind === "list" && view.completedCount > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>
                {view.completedCount} completed
              </span>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={onToggleShowCompleted} className="rounded-sm font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 outline-none">
                {view.showCompleted ? "Hide" : "Show"}
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={onClearCompleted} className="rounded-sm font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 outline-none">
                Clear
              </button>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {view.kind !== "search" && (
            <span className="text-[1.625rem] leading-9 font-semibold tabular-nums" style={{ color }}>
              <span className="sr-only">{view.id === "completed" ? "Completed tasks: " : "Open tasks: "}</span>
              {count}
            </span>
          )}
          <span className="flex h-9 items-center">
            <ViewActionsMenu
              view={view}
              onToggleShowCompleted={onToggleShowCompleted}
              onSort={onSort}
              onClearCompleted={onClearCompleted}
              onRename={onRenameList}
              onSetColor={onSetListColor}
              onDeleteList={onDeleteList}
            />
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-10">
        {!empty && (
          <TaskTree
            view={view}
            index={index}
            lists={lists}
            collapsed={collapsed}
            selectedId={selectedId}
            editingId={editingId}
            draft={draft}
            focusRequest={focusRequest}
            now={now}
          />
        )}
        {view.addTarget && (
          <TaskInput
            ref={addInputRef}
            placeholder={addPlaceholder}
            color={addColor}
            parents={addParents}
            onCreate={onCreate}
          />
        )}
        {empty && (
          <Empty className="mt-10 border-none p-4">
            <EmptyHeader>
              <EmptyTitle>{view.empty.title}</EmptyTitle>
              <EmptyDescription>{view.empty.description}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {view.kind === "search" ? (
                <Button variant="outline" size="sm" onClick={onClearSearch}>
                  Clear Search
                </Button>
              ) : view.kind === "list" && view.completedCount > 0 && !view.showCompleted ? (
                <Button variant="outline" size="sm" onClick={onToggleShowCompleted}>
                  Show Completed
                </Button>
              ) : view.addTarget ? (
                <Button variant="outline" size="sm" onClick={focusAdd}>
                  Add Task
                </Button>
              ) : lists.length === 0 ? (
                <Button variant="outline" size="sm" onClick={onNewList}>
                  New List
                </Button>
              ) : null}
            </EmptyContent>
          </Empty>
        )}
      </div>
    </div>
  )
}
