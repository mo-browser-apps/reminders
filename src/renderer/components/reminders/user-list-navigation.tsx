import * as React from "react"
import { PaletteIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Link } from "@/components/ui/router"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { TaskList } from "@/gen/reminders"
import { cn } from "@/lib/utils"
import { LIST_COLORS, listColor } from "@/lib/list-colors"
import { shortcutLabel } from "@/lib/platform"
import { ListBadge } from "@/components/reminders/list-badge"
import { TASK_DRAG_TYPE } from "@/components/reminders/task-tree"

export interface ListActions {
  onNewList: () => void
  onStartRename: (id: string) => void
  onRename: (id: string, name: string) => void
  onCancelRename: () => void
  onSetColor: (id: string, color: string) => void
  onDelete: (list: TaskList) => void
  /** A task dragged from the task list and dropped on a list. */
  onDropTask: (taskId: string, listId: string) => void
}

/** "My Lists": the user's lists as sidebar rows with their color, name and open-task count. */
export function UserListNavigation({
  lists,
  counts,
  current,
  renamingId,
  actions,
}: {
  lists: TaskList[]
  counts: Record<string, number>
  /** The shown list's id, or null. */
  current: string | null
  renamingId: string | null
  actions: ListActions
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel id="my-lists-label">My Lists</SidebarGroupLabel>
      <Tooltip>
        <TooltipTrigger
          render={<SidebarGroupAction aria-label="New List" onClick={actions.onNewList} />}
        >
          <PlusIcon />
        </TooltipTrigger>
        <TooltipContent side="right">New List ({shortcutLabel("N", { shift: true })})</TooltipContent>
      </Tooltip>
      <SidebarGroupContent>
        <SidebarMenu aria-labelledby="my-lists-label" className="gap-0.5">
          {lists.map((list) => (
            <ListRow
              key={list.id}
              list={list}
              count={counts[list.id] ?? 0}
              active={list.id === current}
              renaming={list.id === renamingId}
              actions={actions}
            />
          ))}
        </SidebarMenu>
        {lists.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">No lists yet.</p>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function ListRow({
  list,
  count,
  active,
  renaming,
  actions,
}: {
  list: TaskList
  count: number
  active: boolean
  renaming: boolean
  actions: ListActions
}) {
  const [dropping, setDropping] = React.useState(false)
  const color = listColor(list.color)

  if (renaming) {
    return (
      <SidebarMenuItem>
        <div className="flex h-9 items-center gap-2 rounded-md bg-sidebar-selection px-2">
          <ListBadge color={color} />
          <RenameField
            initial={list.name}
            onCommit={(name) => (name.trim() ? actions.onRename(list.id, name) : actions.onCancelRename())}
            onCancel={actions.onCancelRename}
          />
        </div>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(TASK_DRAG_TYPE) || active) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
        setDropping(true)
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(event) => {
        setDropping(false)
        const taskId = event.dataTransfer.getData(TASK_DRAG_TYPE)
        if (!taskId || active) return
        event.preventDefault()
        actions.onDropTask(taskId, list.id)
      }}
    >
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <SidebarMenuButton
              isActive={active}
              aria-current={active ? "page" : undefined}
              aria-label={`${list.name}, ${count} ${count === 1 ? "task" : "tasks"}`}
              render={<Link to={`/lists/${list.id}`} />}
              onDoubleClick={() => actions.onStartRename(list.id)}
              className={cn("h-9 pe-9", dropping && "ring-2 ring-ring/60")}
            />
          }
        >
          <ListBadge color={color} />
          <span>{list.name}</span>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ContextMenuGroup>
            <ContextMenuItem onClick={() => actions.onStartRename(list.id)}>
              <PencilIcon />
              Rename
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <PaletteIcon />
                Color
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ListColorItems list={list} onSetColor={actions.onSetColor} />
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem variant="destructive" onClick={() => actions.onDelete(list)}>
              <Trash2Icon />
              Delete List…
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
      <SidebarMenuBadge aria-hidden="true" className="top-2! text-muted-foreground">
        {count}
      </SidebarMenuBadge>
    </SidebarMenuItem>
  )
}

/** The color choices for a list, as radio items of a context menu. */
function ListColorItems({ list, onSetColor }: { list: TaskList; onSetColor: (id: string, color: string) => void }) {
  return (
    <ContextMenuRadioGroup value={list.color} onValueChange={(value) => onSetColor(list.id, value as string)}>
      {LIST_COLORS.map((color) => (
        <ContextMenuRadioItem key={color.key} value={color.key} closeOnClick>
          <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: listColor(color.key) }} />
          {color.label}
        </ContextMenuRadioItem>
      ))}
    </ContextMenuRadioGroup>
  )
}

/** The list's name as an input: Enter or leaving saves, Escape cancels. */
function RenameField({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  const done = React.useRef(false)
  React.useLayoutEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    if (save) onCommit(ref.current?.value ?? "")
    else onCancel()
  }
  return (
    <input
      ref={ref}
      defaultValue={initial}
      aria-label="List name"
      autoComplete="off"
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === "Enter") {
          event.preventDefault()
          finish(true)
        } else if (event.key === "Escape") { // probe-ok: inline list rename reverts on Esc
          event.preventDefault()
          finish(false)
        }
      }}
      onBlur={() => finish(true)}
      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
    />
  )
}
