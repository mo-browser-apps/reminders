# Data Display: Tables & Charts

Rules for data-dense surfaces: tables and charts. Nested, expandable lists (folders, outlines)
are trees — see [tree.md](./tree.md). Two traps dominate here: the vendored data-table doc depends on a
package **this project doesn't have**, and the project's chart tokens are a **sequential ramp being
mistaken for a categorical palette**. Both produce code that looks right and is wrong.

## Contents

- TanStack Table is NOT installed
- Compose `Table` directly
- Numeric columns: right-align + tabular figures
- Every table needs loading, empty, and error states
- Row actions and sortable headers
- Charts: compose `ChartContainer` + `ChartConfig`
- Pick the form before the chart type
- This project's chart palette is a sequential ramp — measured limits
- Never a dual-axis chart
- Legend, labels, and text color
- Charts need loading and empty states too

---

## TanStack Table is NOT installed

`component-docs/components/data-table.md` is a 1600-line guide built entirely on
`@tanstack/react-table` — **which is not a dependency of this project**. Code written from that doc
will not compile.

```bash
# What's actually installed for data display:
recharts          # charts (via components/ui/chart.tsx)
# NOT installed: @tanstack/react-table, @tanstack/react-virtual, any grid library
```

- **Default: the `Table` primitives + the app kit's table parts** — `@/components/ui/data-table`
  (`TableCard`, `TableToolbar`, `SortableHead` + `compareBy`, `paginate` + `TablePagination`,
  `useSelection` + `SelectAllCheckbox` + `BulkActionBar`) and `@/components/ui/table-state` (the
  loading/empty/no-results/error rows). Sorting and filtering over a list you already hold in state
  is a `useMemo`, not a dependency. Full list-screen example: [app-kit.md](./app-kit.md#data-tabletsx--table-statetsx).
- **Adding `@tanstack/react-table` is a real decision** — a new runtime dependency and a headless API
  the rest of the codebase doesn't use. **Ask the user first**; don't install it to satisfy a doc.
- If it is ever added, the vendored `data-table.md` becomes valid — but its examples still need the
  usual fixes (`@/registry/...` → `@/components/ui/...`, strip `"use client"`).

---

## Compose `Table` directly

`Table` already renders its own `div[data-slot="table-container"]` with `relative w-full
overflow-x-auto`. **Don't wrap it in another scroll container** — you get two scrollbars and a broken
sticky header.

**Incorrect:**

```tsx
<div className="overflow-x-auto rounded-md border">   {/* duplicate scroller */}
  <Table>…</Table>
</div>
```

**Correct:** use the kit's `TableCard` (a `Card` whose first/last columns align with its padding,
with an sr-only caption) — or a plain `Card` — and let `Table` own its scrolling.

```tsx
<Card>
  <CardContent>
    <Table>
      <TableCaption className="sr-only">Projects</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead className="w-0" />{/* row actions */}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">
              <span className="block max-w-64 truncate">{row.name}</span>
            </TableCell>
            <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
            <TableCell className="text-right tabular-nums">{row.size}</TableCell>
            <TableCell className="w-0">{/* ⋯ menu */}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

- **Always give the table an accessible name** — a `TableCaption` (use `sr-only` if the surrounding
  card heading already says it visually).
- **Truncate the cell's *content*, not the cell.** `truncate` does nothing on a `<td>` that can
  grow, and **`max-w-0 truncate` on the cell starves the column to ~0px**: every sibling `TableCell`
  is `whitespace-nowrap` (the primitive's default), so under `table-layout: auto` they take their
  max-content width and the `max-w-0` column collapses to nothing — names rendered as "S…",
  "Da…", "Bil…" (measured). Cap an inner block instead:
  `<TableCell><span className="block max-w-64 truncate">…</span></TableCell>`, and put the same
  text in a `title` or tooltip if the full value matters. For a column that should take the
  leftover width, size its `TableHead` (`w-[30%]`) and cap the inner block.
- **Status is the kit's `StatusBadge tone`, not a colored span** — map domain statuses to tones in
  one place (see [app-kit.md](./app-kit.md#statusbadge-and-delta), [styling.md](./styling.md)).

---

## Numeric columns: right-align + tabular figures

Numbers that stack vertically must align on their digits, or the column reads as noise.

**Incorrect:** `<TableCell>{bytes}</TableCell>` — left-aligned, proportional digits that jitter.

**Correct:** `text-right tabular-nums` on both the `TableHead` and the `TableCell`. Apply the same to
any column of counts, sizes, currency, percentages, or durations — and to KPI/stat numbers outside
tables, where a changing value otherwise shifts width on every update.

---

## Every table needs loading, empty, and error states

A bare `rows.map(...)` ships only the happy path; a blank table body reads as broken. This is the
[visual-polish](./visual-polish.md) async rule applied to tables specifically. **The rows are in the
kit — `@/components/ui/table-state` — don't hand-build `TableRow` + `colSpan` + `Skeleton`/`Empty`/
`Alert`:**

```tsx
import {
  TableEmptyRow,
  TableErrorRow,
  TableNoResultsRow,
  TableSkeletonRows,
} from "@/components/ui/table-state"

const COLUMNS = 5

{error ? (
  <TableErrorRow columns={COLUMNS} title="Couldn't load projects" message={error.message} onRetry={reload} />
) : loading ? (
  <TableSkeletonRows columns={COLUMNS} />
) : rows.length === 0 ? (
  query || filtersActive ? (
    <TableNoResultsRow columns={COLUMNS} query={query} noun="projects" onClear={clearFilters} />
  ) : (
    <TableEmptyRow columns={COLUMNS}>
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No projects yet</EmptyTitle>
          <EmptyDescription>Create one to get started.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent><Button>New project</Button></EmptyContent>
      </Empty>
    </TableEmptyRow>
  )
) : (
  rows.map(…)
)}
```

- **`colSpan` must match the real column count** — a mismatched span breaks the grid and is invisible
  until the empty state actually renders. Derive it from one constant, don't hardcode a number twice.
- **Skeleton rows match the real row count and height** so the table doesn't jump.
- **Distinguish "no data" from "no results".** A filter that matches nothing needs its own copy ("No
  projects match *foo*") plus a way to clear the filter — not the first-run empty state.

---

## Row actions and sortable headers

- **Row action menus are `DropdownMenu` with an `aria-label`.** The trigger is an icon-only button, so
  it has no accessible name unless you give it one — see [accessibility.md](./accessibility.md).
- **Sortable headers are the kit's `SortableHead`** — a real `<button>` inside the `TableHead`, with
  `aria-sort` and the direction icon. A `TableHead` with an `onClick` is not keyboard reachable; don't
  rebuild it. Sort with `compareBy(get, dir)` (nulls last, numeric-aware strings).
- **Paginate with `paginate` + `TablePagination`** ("1–25 of 1,204 orders", rows-per-page, prev/next);
  reset to page 1 when a filter changes.
- **Selection is `useSelection` + `SelectAllCheckbox` + `BulkActionBar`.** Row checkboxes still need
  per-row labels (`aria-label={`Select ${row.name}`}`); the header checkbox shows the indeterminate
  state for a partial page.
- **Don't nest interactive controls inside a clickable row.** Either the row navigates *or* it holds
  buttons — a button inside a clickable row swallows or double-fires the click. If the whole row must
  open a detail view *and* hold a checkbox/⋯ menu, keep a real link in the primary cell for keyboard
  users and `stopPropagation()` in the interactive cells.
- **Hover-revealed row actions need `group/row` on the row.** `TableRow` does not set a group, so
  `group-hover/row:opacity-100` silently never fires. Add it, and keep the action reachable by
  keyboard with `focus-visible:opacity-100`:

  ```tsx
  <TableRow className="group/row">
    …
    <TableCell className="w-0">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Duplicate ${row.name}`}
        className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
      >
        <CopyIcon />
      </Button>
    </TableCell>
  </TableRow>
  ```

- **A right-click `ContextMenu` goes on the row, never around `TableBody`.** `ContextMenuTrigger`
  adds `select-none`, so wrapping the body makes every cell's text unselectable — users can't copy an
  order number or an email. Wrap each row (`<ContextMenuTrigger render={<TableRow />}>`) and give the
  menu the same items as the row's ⋯ menu (define them once).

---

## Charts: compose `ChartContainer` + `ChartConfig`

`components/ui/chart.tsx` wraps Recharts v3. The config maps each series key to a label and a color,
and `ChartStyle` emits a `--color-<key>` variable per key — **that** is what marks reference.

```tsx
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

const chartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-2)" },
  mobile:  { label: "Mobile",  color: "var(--chart-5)" },
} satisfies ChartConfig

<ChartContainer config={chartConfig} className="aspect-video w-full">
  <BarChart data={data}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="date" tickLine={false} axisLine={false} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
    <Bar dataKey="mobile"  fill="var(--color-mobile)"  radius={4} />
  </BarChart>
</ChartContainer>
```

- **Never hardcode a hex or a raw Tailwind color** in a chart. Colors go through `chartConfig` →
  `var(--color-<key>)`, so light/dark and future theme edits follow automatically.
- **`ChartContainer` supplies the `ResponsiveContainer`** — don't add your own, and don't give the
  chart a fixed pixel width. Control size with `className` (it defaults to `aspect-video`).
- **Always include a tooltip.** `ChartTooltip` + `ChartTooltipContent` is the default hover layer; a
  chart with no hover read-out forces the user to estimate values off the axis.
- **Format tooltip values — the default prints the raw number.** `ChartTooltipContent` renders
  `item.value.toLocaleString()` unless you pass `formatter`, so money stored in cents shows as
  "12,345" and ratios as "0.0234". Pass the same formatter the axis uses:

  ```tsx
  <ChartTooltip
    content={
      <ChartTooltipContent
        formatter={(value, name) => (
          <span className="flex w-full justify-between gap-4">
            <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span>
            <span className="font-medium tabular-nums">{formatMoney(Number(value))}</span>
          </span>
        )}
      />
    }
  />
  ```

  A custom `formatter` replaces the whole row (swatch, label and value), so render the label too.
- **Grid and axes are recessive**: `vertical={false}`, `tickLine={false}`, `axisLine={false}`. The data
  is the foreground.

---

## Pick the form before the chart type

Decide what the data's *job* is first — and note that the answer is sometimes **not a chart**:

| The data's job | Form |
| --- | --- |
| One headline number ("1,284 sessions") | A stat tile — the kit's `Metric` (in a `MetricGroup`), with `Delta` for the change. **No chart.** |
| Compare magnitude across a few categories | Bar chart |
| Change over time | Line (or area for a cumulative total) |
| Part-to-whole, 2–3 parts | Stacked bar — not a pie |
| Distribution | Histogram |

A pie/donut beyond ~3 slices, a 3-D effect, or a chart drawn for three data points are all decoration.
If a sentence conveys it better, write the sentence.

---

## This project's chart palette is a sequential ramp — measured limits

`--chart-1 … --chart-5` are **five steps of one blue hue** (`src/renderer/index.css`). The light ramp
gets *darker* with each step; the dark ramp is **re-stepped to get *lighter***, because on a dark
surface "more intense" reads as lighter — and because the light ramp's dark end is illegible there.
Measured from the running app (WCAG contrast; ΔE is CIEDE2000):

| Token | Light hex | On white `#ffffff` | Dark hex | On dark card `#0c0a09` | On dark popover `#1c1917` |
| --- | --- | --- | --- | --- | --- |
| `--chart-1` | `#8ec5ff` | **1.81:1 ✗** | `#224bb2` | **2.56:1 ✗** | **2.26:1 ✗** |
| `--chart-2` | `#2b7fff` | 3.76:1 ✓ | `#2b7fff` | 5.25:1 ✓ | 4.65:1 ✓ |
| `--chart-3` | `#155dfc` | 5.26:1 ✓ | `#569fff` | 7.34:1 ✓ | 6.50:1 ✓ |
| `--chart-4` | `#1447e6` | 6.82:1 ✓ | `#80bbff` | 9.84:1 ✓ | 8.72:1 ✓ |
| `--chart-5` | `#193cb8` | 8.84:1 ✓ | `#abd5ff` | 12.89:1 ✓ | 11.42:1 ✓ |

(3:1 is the non-text contrast floor. `--chart-1` fails in both themes by design — it is the
"barely there" floor of the ramp, e.g. the lowest heatmap bucket.)

> **History — why the dark ramp differs.** Until 2026-09-24 the two blocks were identical and this
> rule still recommended `--chart-2` + `--chart-5`, while its own table measured `--chart-5` at
> 1.98:1 on dark. Three screens of the Mercury build followed the rule and shipped a second series
> ("Refunds", "Returning", "Clicks") that was invisible in dark mode. If you ever change the ramp,
> re-measure **both** themes and update this table — a rule that contradicts its own numbers gets
> followed, not questioned.

What follows from that:

- **They are a good *sequential* scale.** Lightness is monotone in each theme (light 0.81 → 0.42,
  dark 0.45 → 0.86), so for one measure encoded by magnitude — a heatmap, a choropleth, an intensity
  ramp — use them in order and they read correctly in both themes.
- **They are a poor *categorical* palette.** Adjacent steps are the same hue and only ΔE 7.7–10 apart
  in dark (5.9 between `--chart-3`/`--chart-4` in light) — far below the ΔE ≥ 15 needed to tell two
  series apart. Five same-hue series are effectively unlabelled.
- **Exactly one pair works in both themes: `--chart-2` + `--chart-5`.** Both clear 3:1 on every
  surface above, and they are ΔE 23.7 apart in light and dark alike.

**So:**

1. **Two categorical series max** — `--chart-2` for the primary series, `--chart-5` for the
   secondary, and **direct-label them** (or keep the legend adjacent) so identity never rests on color
   alone. A comparison/previous-period series doesn't need a chart token at all: draw it dashed in
   `var(--muted-foreground)`.
2. **Three or more categorical series: stop and ask the user.** The honest fix is adding a real
   categorical palette (distinct hues, re-stepped for dark mode) to `index.css` — a design decision,
   not something to improvise. Interim options that don't need new tokens: small multiples (one chart
   per series), a single-color ranked bar list (channels, sources, countries), or fold the tail into
   "Other".
3. **Verify every chart in dark mode, not just light.** Flip the theme (Settings → General → Theme)
   and screenshot each chart: a series you can't see is a defect even when the token choice "follows
   the rule".
4. **If you do add or change chart tokens, re-measure.** Check every step for ≥3:1 contrast against
   *both* themes' card and popover surfaces and ≥15 ΔE between adjacent hues in normal vision and
   under deuteranopia/protanopia — with a CVD/contrast checker, not by eye. Probe the live values from
   the running app:

```js
// agent eval — resolves the tokens to hex through a canvas (getComputedStyle returns oklch() verbatim).
(() => {
  const c = document.createElement("canvas"); c.width = c.height = 1;
  const x = c.getContext("2d", { willReadFrequently: true });
  const probe = document.createElement("div"); document.body.appendChild(probe);
  const hex = (v) => { probe.style.color = v; x.fillStyle = getComputedStyle(probe).color; x.fillRect(0,0,1,1);
    const p = x.getImageData(0,0,1,1).data; return "#" + [p[0],p[1],p[2]].map(n => n.toString(16).padStart(2,"0")).join(""); };
  const colors = [1,2,3,4,5].map((i) => hex(`var(--chart-${i})`));
  probe.remove();
  return colors;
})()
```

---

## Never a dual-axis chart

Two y-scales on one plot let you imply any correlation you like by choosing the scales — it is the
single most common charting mistake.

**Incorrect:** revenue (thousands) and conversion rate (%) on one chart with left and right axes.

**Correct:** two charts stacked with a shared x-axis, or index both measures to a common base (100 at
t₀) so a single axis is meaningful.

---

## Legend, labels, and text color

- **Two or more series always have a legend** (`ChartLegend` + `ChartLegendContent`); a single series
  needs none — the card title names it.
- **Identity is never color-alone.** With ≤4 series, direct-label them too. This also covers the
  colorblind and print cases that the palette above already strains.
- **Text wears text tokens, never the series color.** Values, axis labels, and legend text stay
  `text-muted-foreground`/`text-foreground`; the colored swatch beside them carries identity. Colored
  text on a light surface is exactly where `--chart-1`'s 1.81:1 contrast fails.
- **Don't label every point.** Label the endpoints, the max, or the hovered value — a number on every
  data point is noise.
- **Status colors are reserved.** `--success`, `--warning` and `--destructive` mean *state*;
  never reuse them as "series 3", and always pair them with an icon or text, never color alone.

---

## Charts need loading and empty states too

A `ChartContainer` with no data renders an empty box with axes — indistinguishable from a bug.

- **Loading:** a `Skeleton` at the chart's exact aspect ratio (`aspect-video w-full`), so nothing shifts.
- **Empty:** an `Empty` component in place of the chart ("No data for this range"), not an empty plot.
- **Too few points:** 1–2 points is not a trend. Show the number instead.

## Probe

- **Every table:** force each of the four states once — `TableSkeletonRows`, `TableEmptyRow`,
  `TableNoResultsRow` (a filter with no hits), `TableErrorRow` — and screenshot them; sort a column
  and read `aria-sort` back; open one row's `⋯` menu and run the menu-item measurement in
  [visual-polish.md](./visual-polish.md#menu-items-never-wrap). Numbers read `text-right tabular-nums`.
- **Every chart:** screenshot it in dark mode too; a series you can't see is a defect. Hover a point
  and read the tooltip: formatted values, not raw cents. If you changed chart tokens, run the hex
  probe in [the palette section](#this-projects-chart-palette-is-a-sequential-ramp--measured-limits)
  and re-check contrast with a checker.
- `grep -rn 'react-table\|react-virtual' src/renderer package.json` prints nothing.
