# macOS Window Chrome & Traffic Lights

This app runs **inside a MōBrowser window**, and on **macOS** the native titlebar is hidden
(`win.setWindowTitlebarVisible(false)` for `darwin` in `src/main/index.ts`). That means the web content
fills the **entire** window and renders **underneath the traffic-light buttons** (close/minimize/zoom)
in the top-left corner. MōBrowser does **not** give the renderer an automatic inset or a
`env(titlebar-area-*)` CSS variable — you must both **place the buttons** and **reserve space for them**
yourself, or top-left UI collides with them and the buttons land on a different baseline than the toolbar.

**Symptoms this prevents:**

- The sidebar header / app logo / first nav item / the collapsed rail's toggle sit **under** the buttons.
- With a default (near-top) button position and a tall toolbar, the buttons and the toolbar's controls
  (the sidebar toggle) sit on **different horizontal baselines**, so the top row looks misaligned —
  especially once the sidebar is hidden and the toggle is the left-most control.

Everything here is **macOS-only**. On Windows/Linux the titlebar is shown
(`setWindowTitlebarVisible(process.platform !== 'darwin')`), so **don't** hardcode insets/shifts for every
platform — gate them on macOS.

## The toolbar size: `h-12 px-2` (48px tall, 8px side padding)

The app's top toolbar is **`h-12`** with **`px-2`** — not the `h-16 px-4` that shadcn's dashboard/sidebar
blocks ship with. Every number below (button `y`, `--titlebar-inset`) is derived from this 48px height, so
don't reintroduce `h-16`/`px-4` on a top-of-window header. If you deliberately change the height, recompute
the whole matched set (main-process `y`, both CSS variables, and this file).

## The approach: move the buttons to the toolbar baseline, then adapt around them

There are two halves, and both matter:

1. **Main process — put the traffic lights on the toolbar's baseline.** Reposition the cluster so it is
   *vertically centered on the top toolbar* (which is why it depends on the toolbar height), so the
   buttons and the toolbar's own controls (sidebar toggle, search, etc.) sit on one shared baseline.
2. **Renderer — keep UI out of the buttons' box.** Reserve a *vertical* inset at the top of the
   full-height sidebar (so its logo clears the buttons) and shift the *toolbar's* content *horizontally*
   when the sidebar isn't covering the corner. Never push the whole app down.

### 1. Position the buttons in the main process (depends on toolbar height)

`AbstractWindow` exposes `setWindowButtonPosition({ x, y })` (and the `windowButtonPosition` option / getter).
`{ x, y }` is the **top-left of the ~14px-tall traffic-light cluster**, measured from the window's
top-left. To center the cluster on a toolbar of height `H`:

```
y = (H − 14) / 2          // vertical center on the toolbar's control baseline
x = a small left margin   // ~19; also sets how far the cluster extends right
```

The project keeps the result in one constant, `TRAFFIC_LIGHT_POSITION = { x: 19, y: 17 }` in
`src/main/window-chrome.ts`, which every window passes to `setWindowButtonPosition` on macOS
(other platforms show the native titlebar). Change it there, never per window.

**If you change the toolbar height, recompute `y`** and the CSS variables below — they are a matched set.

### 2. Reserve space in the renderer (two macOS-gated variables)

Gate everything on a platform flag on the root, so Windows/Linux (titlebar shown) stay at `0`. The values
must match the button position from step 1:

- `--titlebar-inset` = **vertical** space at the top of the sidebar, big enough to clear the buttons'
  **bottom** edge (`y + 14 + a few px margin`).
- `--titlebar-traffic-width` = **horizontal** width the cluster occupies from the left edge
  (`x + cluster width`, ≈ `x + 65`).

```css
/* index.css */
:root { --titlebar-inset: 0px; --titlebar-traffic-width: 0px; }
/* Buttons at { x: 19, y: 17 } on a 48px toolbar → bottom ≈ 31, right edge ≈ 84. */
:root[data-platform="mac"] { --titlebar-inset: 36px; --titlebar-traffic-width: 84px; }
```

```tsx
// App.tsx — set the platform flag once, alongside the existing isMac detection.
if (isMac) document.documentElement.dataset.platform = "mac";
```

## The layout rules

Adapt the layout to the buttons (like Linear/VS Code) — **don't** just push the whole app down.

1. **Hide the sidebar completely — use `collapsible="offcanvas"`, not `"icon"`.** A compacted icon rail
   sitting under repositioned traffic lights looks cramped and awkward. Fully hiding the sidebar
   (offcanvas) leaves a clean full-width surface with only the toolbar at the top.

2. **Give the full-height sidebar a *vertical* top inset.** The traffic lights sit over the sidebar's
   top-left, so pad the header down by `--titlebar-inset` (which clears the buttons' bottom edge) so the
   logo/first item clears them. With offcanvas there is no rail to inset — only the header when expanded.

3. **Keep a top-of-window toolbar at the very top; do NOT shift it down.** A toolbar/header beside the
   sidebar stays flush with the top of the window, so its controls line up with the repositioned buttons'
   baseline. Adding a top inset to it (or the whole app) leaves an **empty dead strip** that reads as a
   bug. The toolbar takes a *horizontal* adjustment instead — see #4.

4. **Shift the toolbar's content right only when the sidebar no longer covers the corner.** When the
   sidebar is hidden (offcanvas collapse) or off on mobile, the buttons now sit over the toolbar's left
   edge, so push the toolbar's content right by the full cluster width
   (`--titlebar-traffic-width`). When the sidebar is expanded, it covers the corner — **no shift.**
   (With offcanvas the collapsed sidebar is fully gone, so there's no icon-rail width to subtract — use
   the full width, same as mobile.)

5. **Keep the top-left corner clear of interactive controls in every state.** The keep-out box is the
   buttons' box: roughly `x < --titlebar-traffic-width` and `y < --titlebar-inset`.

6. **Make the *empty* chrome draggable — never a strip on top of controls.** With the titlebar hidden,
   the window can only be moved by an `-webkit-app-region: drag` region. Do **not** lay one full-width
   drag strip over the top of the page: an OS drag region **swallows the mouse**, so any control beneath
   it (the sidebar toggle, the search field) becomes unclickable. Instead mark the **container** of each
   chrome area (the toolbar `<header>`, the sidebar's top inset) as `drag`, and carve the interactive
   descendants back out as `no-drag`. The empty gaps stay draggable; the controls stay clickable.

## Pattern

**Sidebar — offcanvas + vertical inset on the header** (clears the buttons; fully hides when collapsed):

```tsx
<Sidebar collapsible="offcanvas">
  <SidebarHeader className="pt-[calc(var(--titlebar-inset)+0.5rem)]"> … </SidebarHeader>
  …
</Sidebar>
```

**Toolbar — flush to the top; shift content right only when the sidebar is hidden/mobile:**

```tsx
const { state, isMobile } = useSidebar();

<header
  className={cn(
    "sticky top-0 flex h-12 items-center gap-2 px-2", // NO top inset — flush to the top
    (isMobile || state === "collapsed") &&
      "pl-[max(0.5rem,calc(var(--titlebar-traffic-width)+0.5rem))]",
  )}
>
  <SidebarTrigger /> …
</header>
```

> Don't paste the dashboard block's `<Separator orientation="vertical">` between the `SidebarTrigger` and
> the breadcrumb/title — it renders as a stray line next to the toggle. Use `gap-*` spacing instead. See
> [visual-polish.md](./visual-polish.md#vertical-separators-dont-paste-the-toolbar-divider).

**Window dragging — drag the empty space, carve out the controls.** Add one small pair of utilities and
put the drag class on each chrome container; a single CSS rule carves interactive descendants back out so
you don't have to touch every control:

```css
/* index.css — macOS only (the only place the titlebar is hidden). */
:root[data-platform="mac"] .app-drag-region { -webkit-app-region: drag; }
:root[data-platform="mac"] .app-drag-region :where(
  button, a, input, select, textarea, label, summary,
  [role="button"], [role="link"], [role="menuitem"], [role="textbox"],
  [contenteditable], [data-slot="input-group"], [data-slot="sidebar-menu-button"]
) { -webkit-app-region: no-drag; }
```

```tsx
// Toolbar: the whole header is a drag handle; its buttons/inputs are auto-carved to no-drag.
<header className={cn("app-drag-region sticky top-0 flex h-12 items-center gap-2 px-2", …)}> … </header>

// Sidebar: the empty top inset above the header content is draggable; the logo button stays clickable.
<SidebarHeader className="app-drag-region pt-[calc(var(--titlebar-inset)+0.5rem)]"> … </SidebarHeader>
```

Only put `app-drag-region` on **chrome** (toolbar, sidebar top) — not on the main content area, and not on
anything scrollable or text-selectable. If a container has a custom interactive element the `:where(...)`
list doesn't cover, add `-webkit-app-region: no-drag` to it explicitly.

> **Anti-patterns:**
> - **One full-width drag strip over the top of the page** → it covers the toolbar controls and the OS
>   drag region eats their clicks. Drag the empty container space and carve controls out with `no-drag`.
> - Padding the toolbar (or whole app) down by the titlebar height → an empty draggable band that looks broken.
> - Leaving the buttons at their default near-top position under a tall toolbar → buttons and toolbar
>   controls on different baselines.
> - Collapsing to an icon rail (`collapsible="icon"`) under the traffic lights → cramped/awkward. Hide fully.

## Secondary windows (Settings)

The Settings window (see the desktop-shell rule
[settings-window.md](../../desktop-shell/rules/settings-window.md)) uses the **same** traffic-light
position and `--titlebar-*` values. Its shape differs in two ways:

- **`Sidebar collapsible="none"`.** It's a 560px window (resizable down to 520px), below the 768px mobile breakpoint,
  where `offcanvas` would turn into an overlay sheet. The sidebar is always shown, so the content
  header never needs the `--titlebar-traffic-width` shift.
- **An empty `SidebarHeader className="app-drag-region h-12"` on macOS** holds the traffic lights.
  The section list starts below it, and the content header (`h-12`, `app-drag-region`) carries the
  section title on the buttons' baseline.

## Probe

The traffic lights are **native OS chrome, not DOM** — `agent screenshot` captures only the web content,
so it will **not** show the buttons. Verify in two ways:

- **DOM keep-out (objective, scriptable).** In every state (expanded, hidden, mobile), confirm no
  interactive element enters the buttons' box. Toggle the sidebar and read the boxes:

```js
// Anything clickable whose top-left enters the reserved corner is overlapped by the traffic lights.
(() => {
  const w = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--titlebar-traffic-width"));
  const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--titlebar-inset"));
  return [...document.querySelectorAll('button, a, input, [role="button"]')]
    .map((el) => ({ el: el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 20), r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.top < h && r.left < w && r.width > 0);
})()
```

An empty result means the corner is clear. Also confirm the toolbar toggle's vertical center matches the
toolbar's control baseline (`H / 2`) so it lines up with the (repositioned) buttons.

- **Button baseline (visual).** Because the buttons aren't in `agent screenshot`, ask for / take an OS
  window screenshot to confirm the traffic lights are vertically centered on the toolbar and share the
  toggle's baseline. If the cluster looks a few px high/low, adjust `y` in `setWindowButtonPosition`
  (and, if you move it far, `--titlebar-inset`).

- **Drag regions (read the computed region, don't rely on `agent click`).** `agent click` dispatches a
  synthetic event that **bypasses** the OS drag region, so a control can look clickable to the agent while
  a real mouse-drag is being swallowed. Read `-webkit-app-region` directly instead: every toolbar/sidebar
  control must be `no-drag`, and the empty chrome must be `drag`.

```js
(() => {
  const region = (sel) => { const el = document.querySelector(sel); return el && getComputedStyle(el).getPropertyValue("-webkit-app-region"); };
  return {
    header: region("header"),                             // "drag"
    toggle: region('[data-sidebar="trigger"]'),           // "no-drag"
    search: region('header [data-slot="input-group"]'),   // "no-drag"
    sidebarTop: region('[data-slot="sidebar-header"]'),    // "drag"
  };
})()
```

Anything interactive reading `drag` (or `none` inside a drag container) is a click-swallowing bug — add it
to the `no-drag` carve-out.
