# Performance: long lists and render cost

Performance work in this app is almost entirely about **render cost** — how much React does per
keystroke, per scroll, per update. It is *not* about bundle size: this is a desktop app loading from
disk, so the shipped bundle (currently ~229KB JS + ~235KB CSS for the whole shadcn set) never crosses
a network and is not worth optimizing.

The rule that matters most: **measure first.** Memoizing everything makes code harder to read and can
be slower than not memoizing at all.

## Contents

- No virtualization library is installed
- How many rows can you just render?
- There is no React Compiler — memoize deliberately
- Stable keys, not array indices
- Keep expensive work out of render
- Debounce derived work, not the input
- Charts: cap the data, not the container
- Import icons by name
- Measure it

---

## No virtualization library is installed

```bash
# Not installed: @tanstack/react-virtual, react-window, react-virtualized, any grid library.
```

`MessageScroller` (chat) handles its own scrolling, anchoring, and position restoration — but it is
**not** a virtualizer; it renders every item you give it.

**Adding a virtualization dependency is a real decision.** It changes how rows are measured, breaks
`Ctrl+F`, complicates accessibility (rows leave the DOM), and none of the rest of the app uses one.
**Ask the user before installing one** — and only after you've measured that a simpler fix isn't
enough.

---

## How many rows can you just render?

Rough guidance for this component set; verify against the real thing rather than trusting the numbers:

| Rows | Approach |
| --- | --- |
| **≤ 200** | Render them all. Don't optimize. |
| **200 – 2,000** | Paginate (the kit's `paginate` + `TablePagination`), or filter/search to a working set. This is almost always the right answer and needs no dependency. |
| **> 2,000** | Real virtualization territory — **stop and ask**, and bring a measurement to the conversation. |

Before reaching for virtualization, try the cheap fixes: server/main-process-side filtering, a default
filter that narrows the set, pagination, or collapsing groups.

---

## There is no React Compiler — memoize deliberately

`vite.config.ts` uses plain `@vitejs/plugin-react`; the React Compiler is **not** enabled, so nothing
is auto-memoized. That means the classic rules apply — but only where you've measured a problem:

**Worth memoizing:**

```tsx
// A derived list recomputed on every keystroke over a large array.
const visible = React.useMemo(
  () => rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())),
  [rows, query],
)
```

**Not worth memoizing:** a `useMemo` over ten items, a `useCallback` for a handler passed to a plain
DOM element, `React.memo` on a component that re-renders anyway because its parent passes a fresh
object every time.

**The trap — memoization defeated by a fresh reference:**

```tsx
// Incorrect: `style` and `onSelect` are new objects on every parent render,
// so React.memo on Row never prevents anything.
<Row style={{ padding: 8 }} onSelect={() => select(row.id)} />
```

```tsx
// Correct: stable identities, or don't bother memoizing Row at all.
const handleSelect = React.useCallback((id: string) => select(id), [select])
<Row className="p-2" onSelect={handleSelect} id={row.id} />
```

**Lift state down, not up.** A filter input whose state lives in the page component re-renders the
whole page per keystroke. Move the input and its state into a child, and the list only re-renders when
the *committed* query changes.

---

## Stable keys, not array indices

`key={index}` makes React reuse the wrong DOM node when the list reorders, filters, or gets an
insertion — showing up as wrong row highlighted, wrong input value, lost focus mid-typing, or a
checkbox that "jumps" to another row.

**Incorrect:** `{rows.map((row, i) => <TableRow key={i}>…)}`

**Correct:** `{rows.map((row) => <TableRow key={row.id}>…)}`

Only use the index when the list is static, never reordered, and has no per-row state.

---

## Keep expensive work out of render

- **No sorting/filtering/parsing inline in JSX** for a large list — hoist it into a `useMemo`.
- **No `new Date()`/`Intl.NumberFormat(...)` per row.** Create the formatter once at module scope and
  reuse it; constructing an `Intl` formatter is comparatively expensive.
- **Don't set state in an effect that depends on that state** — it's an infinite render loop, and it
  shows up as a frozen window rather than an error.
- **Effects that subscribe must unsubscribe.** `useIsMobile` is the model: add the listener, return the
  cleanup. A leaked `matchMedia`/`ResizeObserver`/interval keeps firing after unmount and degrades the
  app the longer it runs.

---

## Debounce derived work, not the input

Keep the input controlled and instantly responsive; debounce only what's expensive (a large re-filter,
an IPC call). ~200–300ms is the usual window — see
[interaction.md](./interaction.md#debounce-expensive-filtering).

Debouncing the input's own `value` makes typing feel laggy, which is worse than the problem you were
fixing.

---

## Charts: cap the data, not the container

Recharts renders an SVG node per point, so cost scales with point count:

- **Aggregate before plotting.** A year of per-minute samples is ~525,000 points — bucket it to daily
  or hourly first. No one can read more points than the chart has pixels.
- **Keep a line/area chart in the low hundreds of points**; a bar chart in the low dozens of bars.
- **`ChartContainer` already owns the `ResponsiveContainer`** — don't add another, and don't drive
  chart width from a resize handler you wrote (see [data-display.md](./data-display.md)).
- **Don't animate on every data update.** For a live/streaming chart set `isAnimationActive={false}`;
  re-running the entry animation per tick is both expensive and visually noisy.

---

## Import icons by name

```tsx
import { SearchIcon, TrashIcon } from "lucide-react"   // correct — tree-shaken
import * as Icons from "lucide-react"                   // wrong — pulls in the whole set
```

The namespace import also defeats the "pass icons as objects" rule in [icons.md](./icons.md).

---

## Probe

Don't optimize on a hunch — get a number from the running app first (launched and driven as
`AGENTS.md` describes).

**How heavy is the view?**

```js
// agent eval
({
  domNodes: document.getElementsByTagName("*").length,   // > ~5,000 in one view is worth a look
  rows: document.querySelectorAll("tbody tr").length,
  listItems: document.querySelectorAll('[role="option"], [role="listitem"]').length,
})
```

**How long does an interaction take?**

```js
// agent eval — time a filter keystroke end-to-end, including React's re-render.
performance.mark("a");
document.querySelector("input[type=search], input")?.dispatchEvent(new Event("input", { bubbles: true }));
requestAnimationFrame(() => requestAnimationFrame(() => {
  performance.mark("b");
  console.log("update ms:", performance.measure("m", "a", "b").duration);
}));
// then read it back with: agent console
```

A frame budget is ~16ms. If an interaction lands well under that, **leave the code alone** — the
simpler version is the better version.

**Check for leaks on a long-lived window.** This app isn't a page that gets reloaded; it stays open for
hours. After exercising a screen repeatedly (open/close a dialog 20 times, switch tabs back and forth),
re-read `domNodes` — a count that climbs and never returns means something isn't being cleaned up.
