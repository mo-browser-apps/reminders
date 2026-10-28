# The app kit: use it, don't hand-roll it

Every app built here needs the same dozen patterns: a page title row, a search box that clears on
Esc, a sortable/paginated table with loading/empty/error rows, status pills, KPI tiles, a confirm +
undo flow, a copy button, filter chips, a date-range filter, a money field, an unsaved-changes bar,
an activity feed, and routing. Hand-rolled, each one ships with the same bugs build after build
(Esc that doesn't clear, `colSpan` drift, `aria-sort` missing, clipboard rejections, a router
without a back button, a save bar that doesn't block navigation, money stored as floats).

These are now **local extensions in `src/renderer/components/ui/`**, built, verified (light/dark,
720×560, keyboard, a11y audit) and registry-shaped. **Import them. Don't write your own version,
don't copy their internals into a feature file, and don't "simplify" one into a local helper.**
If one doesn't fit, extend it with a prop (it's a design-system change — keep it app-agnostic), or
ask.

> **Before writing any of the patterns in the table below, open the file.** Each starts with a
> `LOCAL EXTENSION` header and a usage example; the props are the source of truth.

## Contents

- Need → component
- Page layout: `page.tsx`
- Routing: `router.tsx`
- Lists: `search-field`, `faceted-filter`, `date-range-picker`, `data-table`, `table-state`
- Status and numbers: `status-badge`, `metric`
- Actions: `confirm-dialog`, `copy-button`
- Editors: `save-bar`, `money-input`, `DatePicker`
- Records: `timeline`
- Incorrect / Correct

---

## Need → component

| You need… | Import | Don't hand-roll… |
| --- | --- | --- |
| A screen's outer column, `h1`, description, actions, back link, main + side column | `Page`, `PageHeader`, `PageHeaderContent`, `PageHeading`, `PageTitle`, `PageDescription`, `PageActions`, `PageBack`, `PageSplit`, `PageMain`, `PageAside` from `@/components/ui/page` | `mx-auto max-w-* px-6` wrappers, a local `PageHeader`, `<h1 className="text-2xl …">` |
| Screens, URLs, links, back/forward, params, query state | `Routes`, `navigate`, `setQuery`, `useRoute`, `matchPath`, `Link`, `TextLink`, `NavigationGuard` from `@/components/ui/router` | a `useState<"orders" \| …>` view switch, a `hashchange` hook, `react-router` |
| Search / filter text box | `SearchField` from `@/components/ui/search-field` | `InputGroup` + `SearchIcon` + Esc handler + ✕ button |
| Multi-select filter chip ("Status · Paid, Pending") | `FacetedFilter` from `@/components/ui/faceted-filter` | `Popover` + checkboxes, a `DropdownMenuCheckboxItem` list |
| Date-range filter chip with presets | `DateRangePicker` from `@/components/ui/date-range-picker` | a `Select` of "Last N days", `Popover` + `Calendar mode="range"` |
| A framed table, toolbar, sortable headers, pagination, row selection, bulk actions | `TableCard`, `TableToolbar`, `SortableHead`, `compareBy`, `paginate`, `TablePagination`, `PAGE_SIZES`, `useSelection`, `SelectAllCheckbox`, `BulkActionBar` from `@/components/ui/data-table` | clickable `TableHead`s, `Pagination` wiring, a `Set` + header checkbox, a floating bar |
| Loading / empty / no-results / error rows | `TableSkeletonRows`, `TableEmptyRow`, `TableNoResultsRow`, `TableErrorRow` from `@/components/ui/table-state` | `<TableRow><TableCell colSpan={…}>` + `Skeleton`/`Empty`/`Alert` |
| Status pill (Paid, Failed, Draft…) | `StatusBadge tone="success\|warning\|danger\|info\|neutral"` from `@/components/ui/status-badge` | a `Record<Status, string>` of badge classes, a coloured dot span |
| Change vs previous period (+12.4% ↗) | `Delta value={0.124}` (`invert` when down is good) from `@/components/ui/status-badge` | `text-success` / `text-destructive` + arrow icon + `toFixed` |
| KPI / stat tile, a row of them, a tile that picks a chart series | `Metric`, `MetricGroup` from `@/components/ui/metric` | a `Card` per number, a chart for one number |
| Confirm a destructive (or any) action | `ConfirmDialog` from `@/components/ui/confirm-dialog` | an `AlertDialog` composition per call site |
| Undo after the action | `undoToast(message, onUndo)` from `@/components/ui/confirm-dialog` | `toast(…, { action: { label: "Undo" … } })` |
| Copy an ID / key / URL | `CopyButton value={…}` or `copyToClipboard(value)` from `@/components/ui/copy-button` | `navigator.clipboard.writeText` (it rejects when unfocused) |
| Unsaved changes: Save / Discard bar, ⌘S, "Leave without saving?" | `SaveBar` from `@/components/ui/save-bar` (+ `NavigationGuard` mounted once) | a sticky footer, a `beforeunload`/blocker hook, a ⌘S listener |
| A price / amount field | `MoneyInput` (minor units) from `@/components/ui/money-input` | `<Input type="number">` holding dollars as a float |
| A single date in a form | `DatePicker` from `@/components/ui/date-range-picker` | `<Input type="date">`, `Popover` + `Calendar` |
| Activity history, notes | `Timeline`, `NoteComposer` from `@/components/ui/timeline` | an `<ol>` with dots and lines, a `Textarea` + button |
| Settings screens | `SettingsPage`, `SettingsSection*` from `@/components/ui/settings` — inside `<Page size="settings">` | see [forms.md](./forms.md#settings-groups-heading-and-description-go-outside-the-card) |

App-specific pieces stay in your feature folders: *which* statuses map to which `tone`, the
columns, the copy. The kit owns the chrome and the behaviour.

---

## Page layout — `page.tsx`

One width scale, one padding, one title style for every screen. `size`: `wide` (default — tables,
dashboards), `detail` (a record with a side column), `narrow` (single-column editor), `settings`
(the centered `max-w-2xl` column). `Page` also leaves `pb-16` for the floating `SaveBar` /
`BulkActionBar`.

**`Page` is for document-like screens that scroll as one column.** A full-height app made of panes
(a mail client, an editor, an outliner, a chat: a list beside a detail, each pane scrolling on its
own) doesn't use it. Lay the panes out with `ResizablePanelGroup` or a `flex` row in the `h-svh`
shell, give each pane `min-h-0` and its own `overflow-y-auto`, and use `PageTitle` alone for the
screen's `h1`. A settings screen or a record's detail page inside such an app still uses `Page`.

```tsx
<Page size="detail">
  <PageHeader>
    <PageHeaderContent>
      <PageHeading>
        <PageBack to="/orders" label="Orders" />
        <PageTitle>Order #1042</PageTitle>
        <StatusBadge tone="success">Paid</StatusBadge>
      </PageHeading>
      <PageDescription>Placed today at 9:41 AM.</PageDescription>
    </PageHeaderContent>
    <PageActions>
      <Button>Fulfill</Button>
    </PageActions>
  </PageHeader>
  <PageSplit>
    <PageMain>…cards…</PageMain>
    <PageAside>…side cards…</PageAside>
  </PageSplit>
</Page>
```

- `PageTitle` is the screen's **only `h1`** and truncates. When the design gives one screen's title
  its own color or size (a list name in the list's color), pass it in `className` on `PageTitle`; don't
  write a second `h1`; section titles are `h2` (`CardTitle`
  renders a `div` with no `render` prop — add `role="heading" aria-level={2}` when it's a
  section heading).
- `PageSplit` stacks below `lg` and puts the aside in a 20rem (22rem at `xl`) column above it.
- Settings: `<Page size="settings"><SettingsPage>…</SettingsPage></Page>` — `SettingsPageTitle`
  uses the same title style.

## Routing — `router.tsx`

A dependency-free **hash router** over real browser history: back/forward (⌘[ / ⌘], mouse
buttons), path params, query params, links that are real `<a href="#/…">`, and a navigation
blocker. URLs look like `#/orders/ord_1042?tab=timeline`.

```tsx
// App.tsx — once, inside the providers
<Routes
  routes={[
    { path: "/", render: () => <OverviewPage /> },
    { path: "/orders", render: () => <OrdersPage /> },
    { path: "/orders/new", render: () => <NewOrderPage /> },          // static before :param
    { path: "/orders/:id", render: ({ id }) => <OrderPage id={id} /> },
  ]}
  notFound={<NotFoundPage />}
/>
<NavigationGuard />   // the "Leave without saving?" dialog for SaveBar / useNavigationBlocker
```

- **Navigate:** `navigate("/orders/ord_1")`, `navigate(to, { replace: true })`. In markup prefer
  `<Link to="/orders">` (renders an `<a>`; `render` it into a `Button` or `SidebarMenuButton`), or
  `<TextLink>` for an inline underlined link.
- **Read:** `const { path, segments, query } = useRoute()`. Highlight the sidebar item with
  `segments[0] === "orders"`.
- **State that belongs in the URL** (tab, filters, sort, page, selected range) goes through
  `setQuery({ tab: "timeline", page: null })` (`null` removes a key; arrays repeat it). Then a
  reload, back button, and "copy link" all keep it.
- `Routes` keys each screen by path, so moving between two records remounts and resets state.
- **A `Popover` that navigates must close itself** — see
  [composition.md](./composition.md#overlay-height-and-navigation).

## Lists

### `SearchField`

```tsx
<SearchField value={query} onValueChange={setQuery} placeholder="Search orders" shortcut />
```

Esc clears (and stops there — it won't also close a dialog it sits in); Esc on an empty field blurs
and passes through. A ✕ clear button (named "Clear {label}") appears when non-empty. `shortcut` makes `/` focus it
from anywhere and shows a `Kbd` hint. `label` sets the accessible name (defaults to the
placeholder). Your `onKeyDown` is composed, not replaced, and a `ref` you pass is merged with the
internal one, so `ref.current?.focus()` from your own shortcut (⌘F) keeps Esc and `/` working. It's
an `<input type="search">`, so its role is **`searchbox`**, not `textbox`: locate it in tests with
`getByRole("searchbox", { name: … })`.

### `FacetedFilter`

```tsx
<FacetedFilter
  title="Status"
  options={[{ value: "paid", label: "Paid", count: 812 }, { value: "refunded", label: "Refunded", count: 14 }]}
  selected={status}               // string[]
  onSelectedChange={setStatus}
/>
```

Dashed outline chip when empty; shows selected labels (or a count on narrow windows) when active;
searchable checklist with per-option counts and "Clear filter". `searchable={false}` for short
lists.

### `DateRangePicker`

```tsx
<DateRangePicker value={range} onValueChange={setRange} label="Date" />   // range: DateRangeValue
```

Presets apply immediately; a custom range applies on **Apply** (so the table doesn't refilter on
every click). Values are `{ from, to }` ISO strings covering whole days — safe to put in the URL.
`describeDateRange(range)` gives "Last 30 days" / "Sep 1 – Sep 24, 2026" for a subtitle or a
Metric's `compareLabel`. `disableFuture` defaults to true; pass your own `presets` if needed.

### `data-table.tsx` + `table-state.tsx`

There is still no table library — sort/filter/page are plain state + `useMemo`
([data-display.md](./data-display.md)). The kit supplies the parts:

```tsx
const COLUMNS = 5
const [sort, setSort] = React.useState<SortState<"date" | "total">>({ key: "date", dir: "desc" })
const sorted = React.useMemo(
  () => [...filtered].sort(compareBy((o) => o[sort.key], sort.dir)),
  [filtered, sort]
)
const visible = paginate(sorted, page, pageSize)
const selection = useSelection(visible.map((o) => o.id))

<TableToolbar>
  <SearchField … />
  <FacetedFilter … />
  <DateRangePicker … />
</TableToolbar>
<TableCard caption="Orders">
  <TableHeader>
    <TableRow>
      <TableHead className="w-0">
        <SelectAllCheckbox state={selection.headerState} onToggle={selection.toggleAllVisible} />
      </TableHead>
      <TableHead>Customer</TableHead>
      <TableHead>Status</TableHead>
      <SortableHead label="Date" sortKey="date" sort={sort} onSort={setSort} />
      <SortableHead label="Total" sortKey="total" sort={sort} onSort={setSort} align="right" />
    </TableRow>
  </TableHeader>
  <TableBody>
    {status === "error" ? (
      <TableErrorRow columns={COLUMNS} onRetry={reload} />
    ) : status === "loading" ? (
      <TableSkeletonRows columns={COLUMNS} />
    ) : visible.length === 0 ? (
      filtersActive ? (
        <TableNoResultsRow columns={COLUMNS} query={query} noun="orders" onClear={clearFilters} />
      ) : (
        <TableEmptyRow columns={COLUMNS}><Empty>…first-use copy + primary action…</Empty></TableEmptyRow>
      )
    ) : (
      visible.map((order) => <TableRow key={order.id}>…</TableRow>)
    )}
  </TableBody>
</TableCard>
<TablePagination page={page} pageSize={pageSize} total={sorted.length}
  onPageChange={setPage} onPageSizeChange={setPageSize} noun="orders" />
<BulkActionBar count={selection.count} noun="order" onClear={selection.clear}>
  <Button size="sm" variant="ghost">Export</Button>
</BulkActionBar>
```

- `SortableHead` renders a real button and `aria-sort`; first click sorts `defaultDir` (`"desc"`),
  then flips. `compareBy` handles strings (locale), numbers, dates, and sorts nulls last.
- `TableCard` aligns the first/last columns with the card padding and adds an sr-only caption.
  Don't wrap it in another scroller or `Card`.
- `TablePagination` shows "1–25 of 1,204 orders", a rows-per-page `Select` (hidden on narrow
  windows), and prev/next; reset `page` to 1 when a
  filter changes.
- `useSelection` persists across pages; the header checkbox acts on the visible page and shows the
  indeterminate state (the `Checkbox` local fix).
- One `COLUMNS` constant drives every `columns` prop, so `colSpan` can't drift.
- "No data yet" (`TableEmptyRow` + `Empty`) and "no results for this filter"
  (`TableNoResultsRow` with a Clear button) are **different** rows — never show first-use copy for
  a filter that matched nothing.

## Status and numbers

### `StatusBadge` and `Delta`

```tsx
<StatusBadge tone="success">Paid</StatusBadge>
<StatusBadge tone="warning">Pending</StatusBadge>
<Delta value={0.124} />             // ↗ +12.4%  (success)
<Delta value={0.031} invert />      // ↗ +3.1%   (destructive — refunds going up is bad)
<Delta value={null} />              // —  (no baseline)
```

`StatusBadge` is an outline `Badge` with a tone dot and text — colour is never the only signal.
Map your domain statuses to tones in **one** place in your app (e.g. `lib/status.ts`), not per call
site. `Delta` takes a **ratio** (0.124, not 12.4); the sign is text, so the direction never
depends on colour or the (hidden) arrow alone.

### `Metric` and `MetricGroup`

```tsx
<MetricGroup>
  <Metric label="Net sales" value={formatMoney(net)} delta={0.124} compareLabel="previous 30 days" />
  <Metric label="Refunds" value={formatMoney(refunds)} delta={0.031} invert />
  <Metric label="Orders" value="1,204" loading={isLoading} />
</MetricGroup>
```

`value` is pre-formatted (you own the formatting). With `selected` + `onSelect`, tiles become
`aria-pressed` toggle buttons that pick which series a chart below shows. `MetricGroup` is 1 → 2 →
4 columns; put it on the page or inside a `Card`.

## Actions

### `ConfirmDialog` and `undoToast`

```tsx
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title={`Delete ${product.title}?`}
  description="This removes it from your catalog. Orders that include it are kept."
  confirmLabel="Delete product"
  pendingLabel="Deleting…"
  destructive
  onConfirm={async () => {
    await deleteProduct(product.id)          // throw to keep the dialog open
    undoToast(`${product.title} deleted`, () => restoreProduct(product))
  }}
/>
```

- Controlled — open it from a menu item or button with `setOpen(true)` (a `DropdownMenuItem`
  can't host a trigger). While `onConfirm` is pending the buttons are disabled with a spinner and
  the dialog can't be dismissed; a thrown error keeps it open.
- `children` render between the description and footer — for a "type the name to confirm" `Field`
  with `confirmDisabled`.
- Label the confirm button with the **verb + object** ("Delete product"), never "OK"/"Yes".
- `undoToast(message, onUndo, { description, undoLabel })` is the Undo half: a toast with an Undo
  action (confirm the restore with your own `toast.success` if you want one).

### `CopyButton` and `copyToClipboard`

```tsx
<CopyButton value={order.id} label="Copy order ID" />
<CopyButton value={apiKey} label="Copy API key" variant="outline" size="sm" />
```

Icon button with tooltip; it turns into a ✓ labelled "Copied" for ~1.6s. On rejection (the window isn't focused
— [interaction.md](./interaction.md#copy-to-clipboard-must-handle-rejection)) an error toast, never
an unhandled rejection. Pass `tooltip={false}` when it's the first focusable element inside a
dialog/popover (a tooltip there eats the first Esc). `copyToClipboard(value)` resolves `true/false`
and never rejects — use it from a menu item.

## Editors

### `SaveBar`

```tsx
const dirty = !isEqual(draft, saved)

<form id="product-form" onSubmit={handleSave}>…fields…</form>
<SaveBar dirty={dirty} saving={saving} onDiscard={() => setDraft(saved)} form="product-form" />
```

While `dirty`: a floating bar with Discard / Save; ⌘S / Ctrl+S submits; **every navigation** (links,
sidebar, back button) opens `NavigationGuard`'s "Leave without saving?" dialog. Without a form,
pass `onSave`. Nested forms in a Dialog/Sheet bubble their submit to the page form — guard the page
handler ([forms.md](./forms.md)). For a non-editor screen that still must block leaving, call
`useNavigationBlocker(when)` yourself.

### `MoneyInput`

```tsx
<Field data-invalid={invalid || undefined}>
  <FieldLabel htmlFor="price">Price</FieldLabel>
  <MoneyInput id="price" value={priceCents} onValueChange={setPriceCents} invalid={invalid} />
</Field>
```

Money is an **integer in minor units** (cents) — `value`/`onValueChange` speak cents, `null` is
empty. The field keeps the user's text while typing ("12.") and normalizes to "12.00" on blur;
currency symbol prefix, ISO code suffix when the symbol is ambiguous. `parseMoney` /
`formatMoneyInput` for the same conversions elsewhere.

### `DatePicker`

```tsx
<Field>
  <FieldLabel htmlFor="starts">Starts</FieldLabel>
  <DatePicker id="starts" value={startsAt} onValueChange={setStartsAt} disabledBefore={new Date()} />
</Field>
```

- **A moment in time** (the default): an ISO timestamp or `null`; changing an existing value keeps
  its time of day.
- **A calendar day** (`dateOnly`): `"yyyy-MM-dd"` or `null`, the same day in every time zone. Use it
  for due dates, birthdays, and anything a user thinks of as a day; never convert a timestamp to a
  day at the edge yourself.
- **Quick picks:** `presets={DATE_PICKER_PRESETS}` (Today, Tomorrow, Next week) or your own
  `{ label, date: () => Date }[]`.
- **Open it from code:** pass `open` and `onOpenChange`, for example from a "Choose Date…" menu
  command, instead of clicking its trigger through the DOM.

```tsx
const [open, setOpen] = React.useState(false)
<DatePicker id="due" dateOnly presets={DATE_PICKER_PRESETS} open={open} onOpenChange={setOpen}
  value={task.due} onValueChange={(due) => update({ due })} />
```

## Records — `Timeline` and `NoteComposer`

```tsx
<NoteComposer onSubmit={(body) => addNote(order.id, body)} />
<Timeline
  items={events.map((e) => ({
    id: e.id,
    icon: EVENT_ICON[e.kind],          // a lucide component, not a string
    tone: e.kind === "refund" ? "warning" : "neutral",
    title: <><b>{e.actor}</b> {e.summary}</>,
    detail: e.note,
    at: e.at,
  }))}
/>
```

Newest first is your job (sort before passing). Timestamps read "Today at 9:41 AM" with the full date
in a keyboard-reachable tooltip. The composer posts on ⌘/Ctrl+Enter, clears on Esc, and shows a
spinner while an async `onSubmit` runs.

---

## Incorrect / Correct

**Incorrect:** a feature file re-implements kit behaviour.

```tsx
// components/orders/orders-page.tsx
const [view, setView] = React.useState<"list" | "detail">("list")   // not a URL; no back button
<div className="mx-auto max-w-7xl p-6">
  <h1 className="text-2xl font-bold">Orders</h1>
  <InputGroup>
    <InputGroupInput value={q} onChange={(e) => setQ(e.target.value)} />  {/* Esc does nothing */}
  </InputGroup>
  <TableHead onClick={() => setSort("total")}>Total</TableHead>          {/* no button, no aria-sort */}
  <Badge className={STATUS_CLASS[order.status]}>{order.status}</Badge>
  <Button onClick={() => navigator.clipboard.writeText(order.id)}>…</Button>  {/* unhandled rejection */}
</div>
```

**Correct:** compose the kit; the feature file holds only app decisions.

```tsx
<Page>
  <PageHeader>
    <PageHeaderContent>
      <PageHeading><PageTitle>Orders</PageTitle></PageHeading>
    </PageHeaderContent>
  </PageHeader>
  <TableToolbar>
    <SearchField value={q} onValueChange={setQ} placeholder="Search orders" shortcut />
  </TableToolbar>
  <TableCard caption="Orders">
    …<SortableHead label="Total" sortKey="total" sort={sort} onSort={setSort} align="right" />…
    …<StatusBadge tone={ORDER_TONE[order.status]}>{ORDER_LABEL[order.status]}</StatusBadge>…
    …<CopyButton value={order.id} label="Copy order ID" />…
  </TableCard>
</Page>
```

**Also incorrect:** wrapping a kit component in a near-identical local one
(`components/shared/search-input.tsx` that re-adds Esc handling), or copying its internals because
"it's only a few lines". The next fix lands in the kit and your copy keeps the bug.

---

## Probe: find hand-rolled kit patterns

Run this over the feature code before delivering (and when reviewing someone else's). Each hit is a
pattern the kit already owns — replace it, don't justify it:

```bash
cd src/renderer
grep -rnE --include='*.tsx' --include='*.ts' \
  -e 'navigator\.clipboard' \
  -e '<AlertDialog[ >]' \
  -e 'action: \{ label: "Undo"' \
  -e 'hashchange|popstate|react-router' \
  -e '<h1[ >]' \
  -e 'mx-auto[^"]*max-w-(2xl|3xl|4xl|5xl|6xl|7xl|screen)' \
  -e 'key === "Escape"' \
  -e 'aria-sort' \
  -e 'type="(number|date)"' \
  -e 'colSpan=' \
  components hooks lib | grep -v '^components/ui/' | grep -v 'probe-ok:'
```

Legitimate exceptions are few. The common one is the Esc handler of an inline editor, which
[interaction.md](./interaction.md#inline-editing-enter-commits-esc-reverts) requires, so expect one
hit per editor; another is `type="number"` for a quantity, not money. Keep one by putting a
`probe-ok: <reason>` comment **on the matched line**, which the probe filters out (see
[the testing skill](../../mobrowser-testing/SKILL.md#verify-in-the-real-app)):

```tsx
if (event.key === "Escape") revert() // probe-ok: inline title editor reverts on Esc
```
