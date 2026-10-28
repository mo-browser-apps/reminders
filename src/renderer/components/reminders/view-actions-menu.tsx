import { EllipsisIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SortOrder } from "@/gen/reminders"
import { LIST_COLORS, listColor } from "@/lib/list-colors"
import { shortcutLabel } from "@/lib/platform"
import type { ViewModel } from "@/lib/views"

export const SORT_LABELS: { value: SortOrder; label: string }[] = [
  { value: SortOrder.SORT_ORDER_MANUAL, label: "Manual" },
  { value: SortOrder.SORT_ORDER_DUE_DATE, label: "Due Date" },
  { value: SortOrder.SORT_ORDER_CREATED, label: "Creation Date" },
  { value: SortOrder.SORT_ORDER_TITLE, label: "Title" },
  { value: SortOrder.SORT_ORDER_PRIORITY, label: "Priority" },
]

/**
 * The "…" menu beside a list's title: Show Completed, Sort By, Delete Completed, and the
 * list's name, color and deletion. The Completed view offers clearing its tasks. Views with no
 * actions of their own (Today, Scheduled, All Tasks, search) show no menu.
 */
export function ViewActionsMenu({
  view,
  onToggleShowCompleted,
  onSort,
  onClearCompleted,
  onRename,
  onSetColor,
  onDeleteList,
}: {
  view: ViewModel
  onToggleShowCompleted: () => void
  onSort: (sort: SortOrder) => void
  onClearCompleted: () => void
  onRename: () => void
  onSetColor: (color: string) => void
  onDeleteList: () => void
}) {
  if (view.kind === "smart" && view.id !== "completed") return null
  if (view.kind === "search") return null
  const hasCompleted = view.kind === "list" ? view.completedCount > 0 : view.sections.length > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`${view.title} actions`} />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {view.kind === "list" ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuCheckboxItem checked={view.showCompleted} onCheckedChange={onToggleShowCompleted}>
                Show Completed
                <DropdownMenuShortcut>{shortcutLabel("H", { shift: true })}</DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Sort By</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={view.sort} onValueChange={(value) => onSort(value as SortOrder)}>
                    {SORT_LABELS.map((sort) => (
                      <DropdownMenuRadioItem key={sort.value} value={sort.value} closeOnClick>
                        {sort.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem disabled={!hasCompleted} onClick={onClearCompleted}>
                Delete Completed Tasks…
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onRename}>Rename List</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Color</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={view.color} onValueChange={(value) => onSetColor(value as string)}>
                    {LIST_COLORS.map((color) => (
                      <DropdownMenuRadioItem key={color.key} value={color.key} closeOnClick>
                        <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: listColor(color.key) }} />
                        {color.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={onDeleteList}>
                Delete List…
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" disabled={!hasCompleted} onClick={onClearCompleted}>
              Delete All Completed Tasks…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
