# Trees and outlines

Nested, expandable lists: a folder tree, an outline, nested tasks, a file browser. A flat list is a
`listbox` or a table ([data-display.md](./data-display.md)), and navigation in the sidebar is
`SidebarMenu` with `SidebarMenuSub`, not a tree. Nothing in the kit draws a tree, so build it with
the pattern below; it was run against these keys in a real app.

## Contents

- Roles: a tree of treeitems
- One tab stop for the whole tree
- Keys
- The pattern
- Focus is not selection
- Editing an outline
- Drag and drop, and its keyboard twin
- Probe

---

## Roles: a tree of treeitems

- The container is `role="tree"` with an accessible name (`aria-label`, or `aria-labelledby` on a
  visible heading).
- Each row is `role="treeitem"` with `aria-level` (1 for the roots), `aria-posinset` and
  `aria-setsize` among its siblings, and `aria-selected`.
- **`aria-expanded` only on rows that have children**, `true` or `false`. A leaf has no
  `aria-expanded` at all; `false` on a leaf announces a parent that can't be opened.
- Render the **visible rows flat**, in order, each with its `aria-level`. That is valid ARIA, keeps
  keyboard handling to one list, and is easier to keep right than nested `role="group"` elements.

## One tab stop for the whole tree

Tab moves past the tree in one press, and Shift+Tab comes back to the row that was focused. Only
one row is in the tab order (`tabIndex={0}`), the others are `tabIndex={-1}`, and arrow keys move
focus between rows (a *roving tabindex*).

- The row in the tab order is the focused row, else the selected row, else the first row. When that
  row disappears (its parent closed, it was deleted), the next render falls back the same way, so
  the tree never drops out of the tab order.
- **No other tab stops inside the rows.** A button in each row adds a tab stop per row. Expand with
  the keyboard (below) and the chevron with the mouse only, and put row actions in a `ContextMenu`
  or the app's menu commands.

## Keys

| Key | Does |
| --- | --- |
| ↓ / ↑ | next / previous visible row |
| → | closed parent: open it; open parent: first child; leaf: nothing |
| ← | open parent: close it; otherwise: the parent row |
| Home / End | first / last visible row |
| Enter, Space | select (or open) the row |
| a letter | type-ahead: the next row whose label starts with the letters typed in the last 500 ms |

Leave ⌘/Ctrl and Alt combinations alone in the tree's handler: they are the app's shortcuts.

## The pattern

```tsx
import * as React from "react"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type TreeNode = { id: string; label: string; children?: TreeNode[] }
type Row = { node: TreeNode; level: number; parentId: string | null; posinset: number; setsize: number }

/** The rows a user can see: every root, and the children of each expanded node, in order. */
function visibleRows(nodes: TreeNode[], expanded: Set<string>, level = 1, parentId: string | null = null, out: Row[] = []) {
  nodes.forEach((node, index) => {
    out.push({ node, level, parentId, posinset: index + 1, setsize: nodes.length })
    if (node.children?.length && expanded.has(node.id)) visibleRows(node.children, expanded, level + 1, node.id, out)
  })
  return out
}

export function OutlineTree({
  nodes,
  label,
  selectedId,
  onSelect,
}: {
  nodes: TreeNode[]
  label: string
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  const [focusedId, setFocusedId] = React.useState<string | null>(null)
  const rows = React.useMemo(() => visibleRows(nodes, expanded), [nodes, expanded])
  const itemRefs = React.useRef(new Map<string, HTMLElement>())
  const typeahead = React.useRef({ text: "", at: 0 })

  // The one row in the tab order: the focused row, else the selected one, else the first.
  const isVisible = (id: string | null) => id !== null && rows.some((row) => row.node.id === id)
  const activeId = isVisible(focusedId) ? focusedId : isVisible(selectedId) ? selectedId : (rows[0]?.node.id ?? null)

  const focus = (id: string) => {
    setFocusedId(id)
    itemRefs.current.get(id)?.focus()
  }
  const setOpen = (id: string, open: boolean) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })

  function onKeyDown(event: React.KeyboardEvent) {
    const at = rows.findIndex((row) => row.node.id === activeId)
    if (at === -1 || event.metaKey || event.ctrlKey || event.altKey) return
    const row = rows[at]
    const hasChildren = !!row.node.children?.length
    const isOpen = expanded.has(row.node.id)
    switch (event.key) {
      case "ArrowDown":
        if (rows[at + 1]) focus(rows[at + 1].node.id)
        break
      case "ArrowUp":
        if (rows[at - 1]) focus(rows[at - 1].node.id)
        break
      case "ArrowRight": // closed: open it; open: into its first child
        if (hasChildren && !isOpen) setOpen(row.node.id, true)
        else if (hasChildren) focus(rows[at + 1].node.id)
        break
      case "ArrowLeft": // open: close it; otherwise: up to the parent
        if (hasChildren && isOpen) setOpen(row.node.id, false)
        else if (row.parentId) focus(row.parentId)
        break
      case "Home":
        focus(rows[0].node.id)
        break
      case "End":
        focus(rows[rows.length - 1].node.id)
        break
      case "Enter":
      case " ":
        onSelect(row.node.id)
        break
      default: {
        if (event.key.length !== 1) return
        // Type-ahead: the next row whose label starts with what was typed in the last 500 ms.
        const now = Date.now()
        const t = typeahead.current
        t.text = (now - t.at > 500 ? "" : t.text) + event.key.toLowerCase()
        t.at = now
        const order = [...rows.slice(at + 1), ...rows.slice(0, at + 1)]
        const match = order.find((candidate) => candidate.node.label.toLowerCase().startsWith(t.text))
        if (match) focus(match.node.id)
      }
    }
    event.preventDefault()
  }

  return (
    <div role="tree" aria-label={label} onKeyDown={onKeyDown} className="flex flex-col gap-px">
      {rows.map(({ node, level, posinset, setsize }) => {
        const hasChildren = !!node.children?.length
        const isOpen = expanded.has(node.id)
        return (
          <div
            key={node.id}
            ref={(element) => {
              if (element) itemRefs.current.set(node.id, element)
              else itemRefs.current.delete(node.id)
            }}
            role="treeitem"
            aria-level={level}
            aria-posinset={posinset}
            aria-setsize={setsize}
            aria-expanded={hasChildren ? isOpen : undefined}
            aria-selected={node.id === selectedId}
            tabIndex={node.id === activeId ? 0 : -1}
            onFocus={() => setFocusedId(node.id)}
            onClick={() => onSelect(node.id)}
            style={{ "--level": level - 1 } as React.CSSProperties}
            className="flex h-8 min-w-0 items-center gap-1 rounded-md ps-[calc(var(--level)*1rem+0.25rem)] pe-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-accent aria-selected:text-accent-foreground"
          >
            {hasChildren ? (
              <ChevronRightIcon
                aria-hidden="true"
                className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")}
                onClick={(event) => {
                  event.stopPropagation()
                  setOpen(node.id, !isOpen)
                }}
              />
            ) : (
              <span aria-hidden="true" className="size-4 shrink-0" />
            )}
            <span className="truncate">{node.label}</span>
          </div>
        )
      })}
    </div>
  )
}
```

- `visibleRows` flattens what is open; `useMemo` keeps it to one pass per change. At more than about
  200 visible rows, collapse by default or page the roots ([performance.md](./performance.md)).
- Ids, not indexes, identify rows: in `key`, in the refs, and in `focusedId`.
- Keep the data normalized in its owner (`id → { parentId, childIds }`), and build the nested
  `TreeNode[]` from it for rendering.

## Focus is not selection

Focus is where the keyboard is; selection is what the rest of the screen shows. In a folder tree
whose detail pane is cheap to show, selecting on Enter or click (as above) and letting arrows only
move focus keeps the pane from reloading on every key press. If the detail is instant, selection
may follow focus: call `onSelect` from `focus`. Pick one per tree and keep it.

## Editing an outline

- **Enter edits the focused row's label** in an inline input, Enter commits, Escape reverts and
  returns focus to the row ([interaction.md](./interaction.md#inline-editing-enter-commits-esc-reverts)).
- **Tab and Shift+Tab indent and outdent only while a row is being edited.** Outside editing, Tab
  leaves the tree; never trap it. Offer indent and outdent as menu commands too.
- After a structural change (indent, move, delete), focus stays on the moved row, or moves to its
  neighbor when it was deleted.

## Drag and drop, and its keyboard twin

- **Three drop positions per row:** the top quarter is *before*, the bottom quarter *after*, the
  middle *inside* (only for rows that can hold children). Draw an insertion line for before/after,
  and highlight the row for inside. Open a closed parent after hovering it for about 600 ms.
- **Never drop a row into itself or its own subtree:**

  ```ts
  /** Whether `id` is `ancestorId` or lies anywhere below it. */
  function isInSubtree(parents: Map<string, string | null>, id: string, ancestorId: string): boolean {
    for (let at: string | null | undefined = id; at; at = parents.get(at)) {
      if (at === ancestorId) return true
    }
    return false
  }
  const canDrop = (dragId: string, targetParentId: string | null) =>
    targetParentId === null || !isInSubtree(parents, targetParentId, dragId)
  ```

- **Every move is also a command.** Move Up, Move Down, Indent, and Outdent (⌥⌘↑, ⌥⌘↓, and the
  editing Tab keys) do what a drag does, from the keyboard and the menu, through the app's
  `AppCommands` ([menu.md](../../desktop-shell/rules/menu.md#renderer-commands-the-menuservice-pattern)).
  Drag and drop is never the only way to reorder.
- A move is **one mutation** sent to the data's owner (the main process), applied optimistically
  like any other ([app-data.md](../../desktop-shell/rules/app-data.md#optimistic-updates-send-one-at-a-time)).

## Probe

In the running app (driven as `AGENTS.md` describes), with the tree on screen:

```js
// agent eval — structure. Expect named: true, tabStops: 1, and 0 for the rest.
(() => {
  const tree = document.querySelector('[role="tree"]')
  const items = [...tree.querySelectorAll('[role="treeitem"]')]
  return {
    named: !!(tree.getAttribute("aria-label") || tree.getAttribute("aria-labelledby")),
    tabStops: items.filter((item) => item.tabIndex === 0).length,
    withoutLevel: items.filter((item) => !item.hasAttribute("aria-level")).length,
    // Controls inside rows (a checkbox, a menu button) are fine with tabIndex -1.
    extraTabStops: [...tree.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
      .filter((el) => el.getAttribute("role") !== "treeitem" && el.tabIndex >= 0 && !el.disabled).length,
  }
})()
```

Then the keys: focus a closed parent's row and press → twice, ↓, ↑, ←, ←, End, Home, a letter,
Enter, and Tab, reading `document.activeElement.textContent` and the row's `aria-expanded` after each
and comparing them with the table above. Tab must land outside the tree, and Shift+Tab on the same
row. With drag and drop, also drop a parent onto one of its own children and confirm nothing
moves. Save the key sequence as an e2e test: it is cheap, and a regression here is invisible in a
screenshot.
