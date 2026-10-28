# Responsive: designing for a resizable window

This is a desktop app, not a website — but the window is **resizable**, and it launches far wider than
its minimum. A layout built only at the launch size breaks the moment someone drags the window in, and
nobody notices because the agent never resizes it.

The two sizes that govern everything here are the main window's, in `src/main/index.ts`:

```ts
win.setSize({ width, height })         // what you see on launch
win.setMinimumSize({ width, height })  // what the layout must still survive
```

**Both are the spec.** Read the current values before you design or check a screen: "it works" means
it works at the minimum *and* at the launch size, and at every size between. The scaffold starts
small (a "Hello, world!" window); once the app has real content, size it for the archetype
([window.md](../../desktop-shell/rules/window.md)). The examples below use a 720×560 minimum, a
common choice for an app with a sidebar.

## Contents

- Where the mobile breakpoint sits
- Use `useIsMobile()`, not `window.innerWidth`
- Don't hardcode widths the window can't afford
- Let content shrink: `min-w-0`, `truncate`, `flex-wrap`
- Height is a constraint too
- Changing the minimum is a decision, not a workaround
- Probe (resize with `agent resize`, never a temporary `setSize` edit)

---

## Where the mobile breakpoint sits

`useIsMobile()` (`src/renderer/hooks/use-mobile.ts`) flips at **768px**. Compare it with the window's
minimum and launch widths:

```
 minimum ──────────── 768px ──────────────────────── launch size
 │                     │  useIsMobile() flips          │
 └── "mobile" mode ────┘────────── "desktop" mode ─────┘
```

- **Both below 768px** (the scaffold's starter window): the app is *always* in "mobile" mode.
- **Minimum below 768px, launch size above:** a perfectly normal desktop window can be in "mobile"
  mode once someone narrows it.
- **Minimum at or above 768px:** never.

In "mobile" mode the `Sidebar` stops being a docked panel and renders as a `Sheet` overlay
(`SIDEBAR_WIDTH_MOBILE`, opened by `setOpenMobile`), and every `md:` Tailwind utility switches off. A
window that's always narrow, like the Settings window, uses `Sidebar collapsible="none"` instead.

This is not a bug, but it *is* a state you must design for and check:

- **Exercise the band from the minimum width to 767px explicitly.** It is the most-likely-broken
  width in the app, and it's the one nobody looks at.
- **Don't assume `isMobile` means "phone".** Copy like "tap" or "on your phone" is wrong here; it's a
  narrow desktop window.
- **A sidebar toggle must exist in both modes** — in mobile mode the sidebar is an overlay, so the
  toolbar trigger is the only way back to navigation.
- If you'd rather the two never overlap, that's a deliberate change: either raise
  `setMinimumSize` above 768 (see below) or change `MOBILE_BREAKPOINT`. Ask before doing either — both
  affect the whole app.

---

## Use `useIsMobile()`, not `window.innerWidth`

**Incorrect:** read once at render, never updates on resize, and disagrees with the sidebar.

```tsx
const isNarrow = window.innerWidth < 768
```

**Correct:** the shared hook — it subscribes to a `matchMedia` listener and is the same source the
`Sidebar` uses, so your layout and the sidebar can't disagree.

```tsx
import { useIsMobile } from "@/hooks/use-mobile"

const isMobile = useIsMobile()
```

Inside a `Sidebar` subtree, `useSidebar()` already exposes `isMobile` alongside `state` — use that
rather than calling the hook again (the toolbar shift in
[app-window.md](./app-window.md) depends on both).

**Prefer CSS to JS.** A Tailwind breakpoint (`md:grid-cols-2`) costs no re-render and can't get out of
sync. Reach for `useIsMobile()` only when the *structure* changes (a panel becoming a sheet), not for
styling.

> `useIsMobile()` returns `false` on the very first render (its state starts `undefined`), so don't
> use it to decide something that must be right before paint — that flashes.

---

## Don't hardcode widths the window can't afford

At a 720px window, minus a 256px sidebar and page padding, the content column can be **under 420px**.
Anything with a fixed width larger than that causes a horizontal scrollbar or clipped content.

**Incorrect:**

```tsx
<div className="w-[900px]">…</div>          {/* wider than the whole window can be */}
<Card className="min-w-[600px]">…</Card>    {/* min-width is the trap: it cannot shrink */}
<div className="grid grid-cols-4 gap-4">    {/* four columns at 420px = 90px each */}
```

**Correct:**

```tsx
<div className="w-full max-w-4xl">…</div>              {/* cap, don't fix */}
<Card className="w-full">…</Card>
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
```

- **`max-w-*` yes, `w-[Npx]`/`min-w-[Npx]` no** for anything that spans the content area.
- **Grids collapse**: start at `grid-cols-1` and add columns at `md:`/`lg:`/`xl:`. Never ship a
  multi-column grid with no single-column fallback.
- **Capped form controls are fine** — `w-64` on a settings input (see [forms.md](./forms.md)) is
  deliberate and small enough to survive; the rule is about layout containers.
- **Tables are the exception**: `Table` brings its own `overflow-x-auto`, so a wide table scrolls
  horizontally instead of breaking the page. Don't fight it — see [data-display.md](./data-display.md).

---

## Let content shrink: `min-w-0`, `truncate`, `flex-wrap`

A flex child won't shrink below its content width unless you let it — the cause of most "it overflows
at narrow widths" bugs (see [visual-polish.md](./visual-polish.md)).

```tsx
<div className="flex items-center gap-2">
  <Avatar className="size-8" />                {/* fixed, fine — it's small */}
  <div className="flex min-w-0 flex-col">      {/* min-w-0 lets it shrink */}
    <span className="truncate">{user.email}</span>
  </div>
  <Button size="sm" className="shrink-0">Invite</Button>
</div>
```

- `min-w-0` on the shrinking child, `truncate` on the text.
- `shrink-0` on things that must keep their size (icons, avatars, a primary action).
- **Toolbars wrap or collapse.** A row of five buttons plus a search field does not fit at 720px —
  either `flex-wrap`, or move the overflow into a `⋯` `DropdownMenu` at narrow widths.

---

## Height is a constraint too

The minimum height is part of the spec, and it's easier to break than width:

- A dialog taller than the window can't be dismissed if its buttons are pushed off-screen.
  `DialogContent` is capped at `100svh − 2rem` and scrolls; a custom overlay you build yourself needs
  the same cap. For a pinned footer, see [composition.md](./composition.md#overlay-height-and-navigation).
- **The app shell is `h-svh`, not `min-h-svh`.** `SidebarProvider`/`SidebarInset` with `min-h-svh`
  let the content grow the page, so the sticky toolbar scrolls away with it. Give the provider
  `h-svh`, the inset `min-h-0 overflow-hidden`, and scroll a `min-h-0 flex-1 overflow-y-auto` main
  region inside it.
- **Fill-height layouts collapse at narrow widths.** A two-column screen built with `h-full` +
  `flex-1 min-h-0` panes renders its cards *on top of each other* once the columns stack (measured at
  720px): the stacked rows are still told to share one viewport of height. Gate the fill-height
  behaviour on the breakpoint where the columns sit side by side — `xl:h-full`, `xl:min-h-0
  xl:flex-1` — and let the stacked layout grow and scroll normally.
- `h-screen`/`h-[900px]` on a page section assumes the launch size. Use `min-h-0` + `flex-1` inside a
  flex column so panes share the available height.
- A sticky toolbar plus a sticky footer at a 560px minimum leaves very little middle — check that the
  content region is still usable.

---

## Changing the minimum is a decision, not a workaround

If a layout genuinely can't work at the minimum width, **don't quietly widen `setMinimumSize` to make
your screen fit**. Either simplify the layout for narrow widths, or raise the minimum *deliberately* and say so —
it's a native-shell change owned by the
[desktop-shell skill](../../desktop-shell/rules/window.md), and it affects every other screen.

Pick the minimum the way that rule says: shrink the running window until the renderer breaks, then set
it just above that.

---

## Probe

**`window.resizeTo()` is a no-op in this app** (verified). Resize the window from the main process
with `agent resize` instead — no source edit, no restart:

```bash
npm run -s agent -- resize --width 1 --height 1   # stops at the setMinimumSize values
npm run -s agent -- screenshot --out build/narrow.png
```

It prints the outer `width`/`height` the window stopped at and the page's `viewport` (CSS pixels),
read after the page has laid out at the new size. Asking for less than the minimum lands exactly on
it; if that's wider than the 768px breakpoint you meant to cross, the minimum isn't what you think.
To check both modes, resize to a width on each side of the breakpoint and probe each.

At the narrow size, check for the specific failures:

```js
// agent eval — horizontal overflow: anything wider than the viewport is a defect.
({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,   // scrollW > clientW  →  something overflows
  offenders: [...document.querySelectorAll("*")]
    .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
    .slice(0, 10)
    .map((el) => el.tagName + "." + (el.className?.toString?.().slice(0, 60) ?? "")),
})
```

Then screenshot and look: no clipped text, no overlapping controls, no element pinned off-screen, and
the sidebar still openable. If the user is watching, `agent resize` the window back to its launch size
when you're done.
