import * as React from "react"

import { SearchField } from "@/components/ui/search-field"
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import type { TaskList } from "@/gen/reminders"
import { isMac } from "@/lib/platform"
import { SmartListTiles } from "@/components/reminders/smart-list-tiles"
import { UserListNavigation, type ListActions } from "@/components/reminders/user-list-navigation"

/**
 * The sidebar: search under the traffic lights, the smart-list tiles, and "My Lists". Nothing
 * else: no notices or helper text (sample data is removed from the File menu).
 */
export function AppSidebar({
  lists,
  counts,
  current,
  query,
  onQueryChange,
  searchRef,
  renamingId,
  listActions,
}: {
  lists: TaskList[]
  counts: Record<string, number>
  /** The shown view's id (a smart view or a list), or null while searching. */
  current: string | null
  query: string
  onQueryChange: (query: string) => void
  searchRef: React.Ref<HTMLInputElement>
  renamingId: string | null
  listActions: ListActions
}) {
  return (
    <Sidebar collapsible="none" className="w-full">
      {/* On macOS the traffic lights sit in this empty row, which drags the window. */}
      <SidebarHeader className={isMac ? "app-drag-region gap-0 px-3 pt-12 pb-3" : "gap-0 px-3 pt-3 pb-3"}>
        <SearchField value={query} onValueChange={onQueryChange} placeholder="Search" label="Search tasks" ref={searchRef} />
      </SidebarHeader>
      <SidebarContent className="gap-2 pb-3">
        <SmartListTiles current={current} counts={counts} />
        <UserListNavigation
          lists={lists}
          counts={counts}
          current={current}
          renamingId={renamingId}
          actions={listActions}
        />
      </SidebarContent>
    </Sidebar>
  )
}
