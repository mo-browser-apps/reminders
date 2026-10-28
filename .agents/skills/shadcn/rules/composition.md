# Component Composition

## Contents

- Items always inside their Group component
- Menu item labels stay on one line
- Callouts use Alert
- Empty states use Empty component
- Toast notifications use sonner
- Choosing between overlay components
- Overlay height and navigation
- Dialog, Sheet, and Drawer always need a Title
- Card structure
- Button has no isPending or isLoading prop
- TabsTrigger must be inside TabsList
- Avatar always needs AvatarFallback
- Use Separator instead of raw hr or border divs
- Use Skeleton for loading placeholders
- Use Badge instead of custom styled spans

---

## Items always inside their Group component

Never render items directly inside the content container.

**Incorrect:**

```tsx
<SelectContent>
  <SelectItem value="apple">Apple</SelectItem>
  <SelectItem value="banana">Banana</SelectItem>
</SelectContent>
```

**Correct:**

```tsx
<SelectContent>
  <SelectGroup>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="banana">Banana</SelectItem>
  </SelectGroup>
</SelectContent>
```

This applies to all group-based components:

| Item | Group |
|------|-------|
| `SelectItem`, `SelectLabel` | `SelectGroup` |
| `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSub` | `DropdownMenuGroup` |
| `MenubarItem` | `MenubarGroup` |
| `ContextMenuItem` | `ContextMenuGroup` |
| `CommandItem` | `CommandGroup` |
| `MessageScrollerItem` | `MessageScrollerContent` |
| `Message` (consecutive, same sender) | `MessageGroup` |
| `Bubble` (stacked) | `BubbleGroup` |
| `Attachment` (in a row) | `AttachmentGroup` |

**For `DropdownMenuLabel` this is not style — it's a crash.** It renders Base UI's
`Menu.GroupLabel`, which *throws* ("Base UI error #31") unless it sits inside `DropdownMenuGroup` or
`DropdownMenuRadioGroup`. The menu opens, React unmounts the whole app, and the window goes blank.
Same for `ContextMenuLabel` / `MenubarLabel` outside their groups.

```tsx
// Incorrect — throws on open
<DropdownMenuContent>
  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
  <DropdownMenuItem>Newest</DropdownMenuItem>
</DropdownMenuContent>

// Correct
<DropdownMenuContent>
  <DropdownMenuGroup>
    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
    <DropdownMenuItem>Newest</DropdownMenuItem>
  </DropdownMenuGroup>
</DropdownMenuContent>
```

Chat components nest in a fixed order (`MessageScrollerProvider` → `MessageScroller` → `MessageScrollerViewport` → `MessageScrollerContent` → `MessageScrollerItem`). See [chat.md](./chat.md).

---

## Menu item labels stay on one line

Users must never see a line break in a menu item. A label like "Remove from workspace" wrapping onto two lines is a defect — it looks broken, not compact.

This applies to `DropdownMenu`, `ContextMenu`, and `Menubar` items (including `SubTrigger`, checkbox, and radio variants). Command palette rows that pair a title with a description are a different pattern.

The installed item primitives already include `whitespace-nowrap`. **Don't remove it**, and don't add a wrapping class on the item. If a new item variant is added to `src/renderer/components/ui`, give it `whitespace-nowrap` too.

The usual cause is a popup that's narrower than the label:

- **`w-(--anchor-width)` is for Select and Combobox**, so the list matches the field. Never put it on `DropdownMenuContent` / `ContextMenuContent`. A menu opened from a `⋯` icon button is ~24px wide; matching that width wraps every label. Menus size to their items (`min-w-32` is already on the primitive).
- **A copied `w-40` / `w-48` is often too tight** once the item has an icon. Prefer no width, or `min-w-*` so the menu can grow with the longest label. A fixed `w-*` is fine only when icon + gap + every label + padding still fit on **one line**. A wide trigger (workspace switcher, account menu) may pass `className="w-64"` on purpose — still confirm nothing wraps.

**Incorrect:** size the menu to the trigger, or pin a width that wraps the label.

```tsx
<DropdownMenuTrigger
  render={
    <Button variant="ghost" size="icon-xs" aria-label="Actions">
      <EllipsisIcon />
    </Button>
  }
/>
<DropdownMenuContent align="end" className="w-40">
  <DropdownMenuGroup>
    <DropdownMenuItem>
      <Trash2Icon />
      Remove from workspace
    </DropdownMenuItem>
  </DropdownMenuGroup>
</DropdownMenuContent>
```

**Correct:** omit a width, or use `min-w-*` so the unwrapped label can grow the menu.

```tsx
<DropdownMenuTrigger
  render={
    <Button variant="ghost" size="icon-xs" aria-label="Actions">
      <EllipsisIcon />
    </Button>
  }
/>
<DropdownMenuContent align="end" className="min-w-48">
  <DropdownMenuGroup>
    <DropdownMenuItem>
      <Trash2Icon />
      Remove from workspace
    </DropdownMenuItem>
  </DropdownMenuGroup>
</DropdownMenuContent>
```

**Radio and checkbox items don't close the menu when chosen** (Base UI's `closeOnClick` defaults to
`false` for them, unlike plain items). That's right for a multi-toggle menu, but a radio that changes
something app-wide — theme, "preview as", active store, sort order — leaves the menu floating over the
change the user wants to see. Pass `closeOnClick` on those items:

```tsx
<DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
  <DropdownMenuRadioItem value="light" closeOnClick>Light</DropdownMenuRadioItem>
  <DropdownMenuRadioItem value="dark" closeOnClick>Dark</DropdownMenuRadioItem>
</DropdownMenuRadioGroup>
```

Open every menu and measure the items with the snippet in [visual-polish.md](./visual-polish.md#menu-items-never-wrap): `white-space` is `nowrap`, `scrollHeight === clientHeight`, and height is one line.

---

## Callouts use Alert

```tsx
<Alert>
  <AlertTitle>Warning</AlertTitle>
  <AlertDescription>Something needs attention.</AlertDescription>
</Alert>
```

---

## Empty states use Empty component

```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon"><FolderIcon /></EmptyMedia>
    <EmptyTitle>No projects yet</EmptyTitle>
    <EmptyDescription>Get started by creating a new project.</EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button>Create Project</Button>
  </EmptyContent>
</Empty>
```

---

## Toast notifications use sonner

```tsx
import { toast } from "sonner"

toast.success("Changes saved.")
toast.error("Something went wrong.")
```

Undo after a destructive action and copy feedback are kit components, not hand-made toasts — see
[app-kit.md](./app-kit.md#actions).

---

## Choosing between overlay components

| Use case | Component |
|----------|-----------|
| Focused task that requires input | `Dialog` |
| Destructive action confirmation | `ConfirmDialog` (kit — wraps `AlertDialog` with pending state and verb labels) |
| Side panel with details or filters | `Sheet` |
| Mobile-first bottom panel | `Drawer` |
| Quick info on hover | `HoverCard` |
| Small contextual content on click | `Popover` |

---

## Overlay height and navigation

- **`DialogContent` is capped to the window** (`max-h-[calc(100svh-2rem)] overflow-y-auto`), so a long
  form never pushes its header and footer off-screen — the whole dialog scrolls. When the footer
  should stay pinned while only the fields scroll, give the content
  `grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden` and the body `min-h-0 overflow-y-auto`. See
  [responsive.md](./responsive.md#height-is-a-constraint-too).
- **A `Popover` doesn't close when something inside it navigates** — unlike `DropdownMenu`, whose
  items close the menu. A "View all" link or a notification row that calls `navigate()` leaves the
  popover floating over the next screen. Make `open` controlled and close it in the handler:

  ```tsx
  const [open, setOpen] = React.useState(false)
  <Popover open={open} onOpenChange={setOpen}>
    …
    <Button onClick={() => { setOpen(false); navigate("/notifications") }}>View all</Button>
  </Popover>
  ```

---

## Dialog, Sheet, and Drawer always need a Title

`DialogTitle`, `SheetTitle`, `DrawerTitle` are required for accessibility. Use `className="sr-only"` if visually hidden.

```tsx
<DialogContent>
  <DialogHeader>
    <DialogTitle>Edit Profile</DialogTitle>
    <DialogDescription>Update your profile.</DialogDescription>
  </DialogHeader>
  ...
</DialogContent>
```

---

## Card structure

Use full composition — don't dump everything into `CardContent`:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Team Members</CardTitle>
    <CardDescription>Manage your team.</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>
    <Button>Invite</Button>
  </CardFooter>
</Card>
```

---

## Button has no isPending or isLoading prop

Compose with `Spinner` + `data-icon` + `disabled`:

```tsx
<Button disabled>
  <Spinner data-icon="inline-start" />
  Saving...
</Button>
```

---

## TabsTrigger must be inside TabsList

Never render `TabsTrigger` directly inside `Tabs` — always wrap in `TabsList`:

```tsx
<Tabs defaultValue="account">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">...</TabsContent>
</Tabs>
```

---

## Avatar always needs AvatarFallback

Always include `AvatarFallback` for when the image fails to load:

```tsx
<Avatar>
  <AvatarImage src="/avatar.png" alt="User" />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>
```

---

## Use existing components instead of custom markup

| Instead of | Use |
|---|---|
| `<hr>` or `<div className="border-t">` | `<Separator />` |
| `<div className="animate-pulse">` with styled divs | `<Skeleton className="h-4 w-3/4" />` |
| `<span className="rounded-full bg-green-100 ...">` | `<Badge variant="secondary">` |

## Probe

Most composition mistakes crash on open or render nothing, so the [crash crawl](./crawl.md) finds
them. Before that, grep the feature code for the ones that compile:

```bash
cd src/renderer
grep -rnE --include='*.tsx' -e '\basChild\b' -e '<CommandInput' -e '<DropdownMenuLabel' \
  -e '<(Dialog|Sheet|Drawer)Content' -e 'isLoading|isPending' components | grep -v '^components/ui/' | grep -v 'probe-ok:'
```

For each hit: `asChild` → `render`; a `CommandInput` has a `<Command>` ancestor; a
`DropdownMenuLabel` sits inside a `DropdownMenuGroup`; every `DialogContent`/`SheetContent`/
`DrawerContent` has a Title (`sr-only` if hidden); `isLoading`/`isPending` on a `Button` is not a
prop — compose `Spinner` + `disabled`. Then open every menu you touched and run the item
measurement in [visual-polish.md](./visual-polish.md#menu-items-never-wrap).
