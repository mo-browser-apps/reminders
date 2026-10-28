import {
  CalendarIcon,
  CircleCheckIcon,
  CircleIcon,
  CornerDownRightIcon,
  FlagIcon,
  FolderInputIcon,
  InfoIcon,
  Trash2Icon,
} from "lucide-react"

import {
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import { Priority, type Task, type TaskList } from "@/gen/reminders"
import { dayOffset, effectivePriority } from "@/lib/reminders"
import { useTaskActions } from "@/components/reminders/task-actions-context"
import { ListBadge } from "@/components/reminders/list-badge"
import { listColor } from "@/lib/list-colors"

export const PRIORITY_LABELS: { value: Priority; label: string }[] = [
  { value: Priority.PRIORITY_HIGH, label: "High" },
  { value: Priority.PRIORITY_NORMAL, label: "Normal" },
  { value: Priority.PRIORITY_LOW, label: "Low" },
]

/** A task's right-click menu: the actions a row doesn't show. */
export function TaskContextMenuContent({ task, lists }: { task: Task; lists: TaskList[] }) {
  const actions = useTaskActions()
  const others = lists.filter((list) => list.id !== task.listId)
  const nextWeek = () => {
    const now = new Date()
    // The coming Monday (a week from today when today is Monday).
    return dayOffset(((8 - now.getDay()) % 7) || 7, now)
  }

  return (
    <ContextMenuContent className="min-w-48">
      <ContextMenuGroup>
        <ContextMenuItem onClick={() => actions.addSubtask(task.id)}>
          <CornerDownRightIcon />
          Add Subtask
        </ContextMenuItem>
        <ContextMenuItem onClick={() => actions.openDetails(task.id)}>
          <InfoIcon />
          Show Details
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <CalendarIcon />
            Due Date
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuGroup>
              <ContextMenuItem onClick={() => actions.setDue(task.id, dayOffset(0))}>Today</ContextMenuItem>
              <ContextMenuItem onClick={() => actions.setDue(task.id, dayOffset(1))}>Tomorrow</ContextMenuItem>
              <ContextMenuItem onClick={() => actions.setDue(task.id, nextWeek())}>Next Week</ContextMenuItem>
              <ContextMenuItem onClick={() => actions.openDetails(task.id, { pickDate: true })}>Choose Date…</ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuItem disabled={!task.dueDate} onClick={() => actions.setDue(task.id, "")}>
                No Due Date
              </ContextMenuItem>
            </ContextMenuGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FlagIcon />
            Priority
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuRadioGroup
              value={effectivePriority(task)}
              onValueChange={(value) => actions.setPriority(task.id, value as Priority)}
            >
              {PRIORITY_LABELS.map((priority) => (
                <ContextMenuRadioItem key={priority.value} value={priority.value} closeOnClick>
                  {priority.label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
        {others.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FolderInputIcon />
              Move to List
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuGroup>
                {others.map((list) => (
                  <ContextMenuItem key={list.id} onClick={() => actions.moveToList(task.id, list.id)}>
                    <ListBadge color={listColor(list.color)} className="size-4 [&_svg]:size-2.5!" />
                    {list.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem onClick={() => actions.toggleCompleted(task.id)}>
          {task.completed ? <CircleIcon /> : <CircleCheckIcon />}
          {task.completed ? "Mark as Not Completed" : "Mark as Completed"}
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem variant="destructive" onClick={() => actions.delete(task.id)}>
          <Trash2Icon />
          Delete
        </ContextMenuItem>
      </ContextMenuGroup>
    </ContextMenuContent>
  )
}
