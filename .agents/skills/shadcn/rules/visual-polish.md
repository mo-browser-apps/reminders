# Visual Polish & Spacing

Rules for making UI look intentional and finished. These defects compile and pass type-checks — they
are only visible when rendered, so screenshot and **measure** (see the Probe at the end) after
building non-trivial UI, and whenever asked to check/verify/QA existing UI. Enumerate suspected
issues, then measure to confirm or dismiss each; "looks clean/flush" is not a finding.

See [styling.md](./styling.md) for color/token rules and [customization.md](../customization.md) for
the radius/spacing token scale.

## Contents

- Concentric (nested) border radius
- Rounded overlays need inset padding + overflow-hidden
- Command palette: use CommandDialog, not a hand-rolled popup
- Consistent spacing rhythm
- Prevent flex overflow with min-w-0
- Skeletons must match final layout (no layout shift)
- Constrain text line length for readability
- Constrain and center settings & config pages
- Optical alignment of icons and labels
- Menu items never wrap
- Vertical separators: don't paste the toolbar divider
- Every async surface has loading, empty, and error states
- Silent clipping and overlap traps in the installed components
- Probe

---

## Concentric (nested) border radius

When a rounded element is nested inside a rounded container, the inner radius must shrink by the gap
between them, or the corners look mismatched (the inner corner appears too sharp or the element
collides with the outer corner).

**Rule:** `inner_radius = outer_radius − padding`. If `padding ≥ outer_radius`, the inner element is
square (`rounded-none`).

> **A "flush" look is a DEFECT, not "clean."** An input or panel that sits with (near-)zero gap
> against a rounded container's edge is the exact bug this rule prevents — do not describe it as clean,
> tight, or flush and move on. There must be a visible, consistent inset.

**This project's scale.** `--radius` is `0.625rem` = **10px** (`src/renderer/index.css`), and the
multipliers are declared in the `@theme inline` block of that same file:

| Token | Multiplier | Value |
| --- | --- | --- |
| `rounded-sm` | 0.6× | **6px** |
| `rounded-md` | 0.8× | **8px** |
| `rounded-lg` | 1× | **10px** |
| `rounded-xl` | 1.4× | **14px** |
| `rounded-2xl` | 1.8× | **18px** |
| `rounded-3xl` | 2.2× | **22px** |
| `rounded-4xl` | 2.6× | **26px** |

Step **down** the scale as you nest. Common exact pairs (`p-1` = 4px, `p-2` = 8px, `p-3` = 12px):

| Outer + padding | Inner |
| --- | --- |
| `rounded-2xl` + `p-2` (18 − 8) | `rounded-lg` |
| `rounded-xl` + `p-1` (14 − 4) | `rounded-lg` |
| `rounded-xl` + `p-2` (14 − 8) | `rounded-sm` |
| `rounded-lg` + `p-1` (10 − 4) | `rounded-sm` |
| `rounded-md` + `p-2` (8 − 8) | `rounded-none` |

> If `--radius` ever changes, every number above changes with it — recompute from the multipliers
> rather than trusting a remembered px value.

**Incorrect:** same radius inside and out — inner box fights the outer corners.

```tsx
<div className="rounded-2xl p-2">
  <div className="rounded-2xl bg-muted">...</div>
</div>
```

**Correct:** inner radius reduced by the padding (outer `rounded-2xl` = 18px, `p-2` = 8px → 10px =
`rounded-lg`).

```tsx
<div className="rounded-2xl p-2">
  <div className="rounded-lg bg-muted">...</div>
</div>
```

When the exact value matters, compute it: `rounded-[calc(var(--radius-2xl)-0.5rem)]` for a `p-2` inset.

---

## Measure overlays — don't eyeball them

Subtle radius/padding defects are hard to see in a screenshot and easy to rationalize away
("looks clean/flush"). When reviewing a rounded overlay (Dialog, Popover, Command palette, Sheet),
**read the live computed styles and check the numbers** instead of judging by eye. Use the renderer
automation flow (`npm run -s agent -- eval "…"`) to inspect the rendered DOM:

```js
// Command palette example. Adapt the selectors to the overlay under review.
(() => {
  const input =
    document.querySelector("[cmdk-input]") ||
    document.querySelector('[data-slot="command-input-wrapper"] input') ||
    document.querySelector('[role="dialog"]:not([data-closed]) input');
  const box = input && input.closest('[cmdk-root],[role="dialog"],[data-slot="command"]');
  const g = (el) => getComputedStyle(el);
  const num = (v) => parseFloat(v) || 0;
  const r = box && input && {
    containerRadius: num(g(box).borderTopLeftRadius),
    containerPaddingTop: num(g(box).paddingTop),
    containerPaddingLeft: num(g(box).paddingLeft),
    inputRadius: num(g(input).borderTopLeftRadius),
    gapTop: input.getBoundingClientRect().top - box.getBoundingClientRect().top,
    gapLeft: input.getBoundingClientRect().left - box.getBoundingClientRect().left,
  };
  return JSON.stringify(r, null, 2);
})()
```

Then assert:

- **`gapTop` / `gapLeft` are a real inset** (roughly `8px`+, not `0–2px`). A near-zero gap is the
  flush-edge defect — fix it, don't accept it.
- **Concentric radius holds:** `inputRadius ≈ containerRadius − gap` (within ~2px). If the inner
  element has a large radius but sits ~0px from the container edge, the corners are wrong.

Report the measured numbers as the evidence that the overlay is correct — not "it looks fine."

---

## Rounded overlays need inset padding + overflow-hidden

Content inside a rounded surface (Dialog, Popover, Command, Sheet, Card) must have inset padding and
the container should `overflow-hidden`, so children never touch or poke past the rounded corners.

**Incorrect:** input runs edge-to-edge and collides with the popup's rounded corners.

```tsx
<PopoverContent className="rounded-2xl p-0">
  <Input className="rounded-2xl" placeholder="Search..." />
</PopoverContent>
```

**Correct:** give the surface padding; inner control radius = surface radius − padding
(18 − 8 = 10 → `rounded-lg`).

```tsx
<PopoverContent className="overflow-hidden rounded-2xl p-2">
  <Input className="rounded-lg" placeholder="Search..." />
</PopoverContent>
```

---

## Command palette: use CommandDialog, not a hand-rolled popup

The command palette's padding, scroll, and rounding are handled for you. Compose `CommandDialog` (or
`Command` inside `Dialog`); never place `CommandInput` flush against a custom rounded container.

**Incorrect:**

```tsx
<Dialog>
  <DialogContent className="rounded-xl p-0">
    <CommandInput placeholder="Type a command..." />
    <CommandList>...</CommandList>
  </DialogContent>
</Dialog>
```

**Correct:** `CommandDialog` supplies the dialog chrome but **not** the cmdk root — wrap the
contents in `<Command>`.

```tsx
<CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a page or run a command.">
  <Command>
    <CommandInput placeholder="Type a command or search..." />
    <CommandList>
      <CommandEmpty>No results.</CommandEmpty>
      <CommandGroup heading="Navigation">
        <CommandItem>Go to Overview</CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
</CommandDialog>
```

> **This example used to omit `<Command>` — and that crashes the app.** Without the cmdk root,
> `CommandInput` throws `Cannot read properties of undefined (reading 'subscribe')` and React unmounts
> the whole tree (blank window). The vendored `component-docs/components/command.md` shows the
> wrapper; trust it. The same applies anywhere you use `CommandInput`/`CommandList` — e.g. a
> searchable list inside a `Popover` needs its own `<Command>`.
>
> Pass a meaningful `title`/`description` to `CommandDialog` — they label the dialog for screen
> readers. For record search, pass `shouldFilter={false}` to `Command` and filter/limit results
> yourself — cmdk's built-in filter renders every item it scores, which is slow over thousands of
> orders.

---

## Consistent spacing rhythm

Use a small, consistent set of spacing steps rather than arbitrary one-off values. Related items get
a smaller gap than unrelated groups. Don't mix `gap-3`, `gap-[13px]`, and `gap-5` at the same level.

**Incorrect:**

```tsx
<div className="flex flex-col gap-[13px]">
  <Field className="mb-5" />
  <Field className="mb-2" />
</div>
```

**Correct:** one owner of spacing, consistent scale.

```tsx
<FieldGroup className="gap-6">
  <Field />
  <Field />
</FieldGroup>
```

---

## Prevent flex overflow with min-w-0

A flex child with long text won't `truncate` unless it can shrink below its content width. Add
`min-w-0` to the shrinking child (and `truncate` on the text).

**Incorrect:** long text forces the row to overflow.

```tsx
<div className="flex items-center gap-2">
  <Avatar />
  <div className="flex flex-col">
    <span className="truncate">a-very-long-name-that-overflows@example.com</span>
  </div>
</div>
```

**Correct:**

```tsx
<div className="flex items-center gap-2">
  <Avatar />
  <div className="flex min-w-0 flex-col">
    <span className="truncate">a-very-long-name-that-overflows@example.com</span>
  </div>
</div>
```

---

## Skeletons must match final layout (no layout shift)

Loading `Skeleton`s should occupy the same dimensions as the content they replace, so the layout
doesn't jump when data arrives. Don't swap a tiny placeholder for a tall block.

**Incorrect:**

```tsx
{loading ? <Skeleton className="h-4 w-24" /> : <Card className="h-40">...</Card>}
```

**Correct:**

```tsx
{loading ? <Skeleton className="h-40 w-full rounded-xl" /> : <Card className="h-40">...</Card>}
```

---

## Constrain text line length for readability

Long-form text (descriptions, paragraphs, empty-state copy) reads poorly at full width. Cap the
measure with `max-w-*` or `max-w-prose` and don't let paragraphs span an entire wide view.

```tsx
<p className="max-w-prose text-muted-foreground">Longer descriptive text...</p>
```

---

## Constrain and center settings & config pages

Settings, preferences, profile, account, and other form-heavy config pages should be a **centered,
readable column** — not full-bleed. At full width, form rows stretch so a label and its control sit at
opposite ends of a very long line and cards look empty. Well-known apps (Linear, GitHub, Stripe) cap the
content width and center it in wide viewports.

**Rule:** use the kit's `<Page size="settings">` (`max-w-2xl`, ~672px). It stays full width on
narrow windows and centers with auto margins when the view area is wide. The same `Page` gives every
other screen its width too — `narrow` (`max-w-4xl`, single-column editors), `detail` (`max-w-6xl`,
a record + side column), `wide` (`max-w-screen-2xl`, dashboards/tables/boards) — so don't write
`mx-auto max-w-*` wrappers by hand ([app-kit.md](./app-kit.md#page-layout--pagetsx)).

**Incorrect:** settings sections span the entire content area.

```tsx
<div className="flex flex-col gap-4">
  <Card>{/* Profile */}</Card>
  <Card>{/* Preferences */}</Card>
</div>
```

**Correct:** a centered, width-capped column with generous spacing between settings groups.

```tsx
<Page size="settings">
  <SettingsPage>
    <SettingsSection>{/* Profile */}</SettingsSection>
    <SettingsSection>{/* Preferences */}</SettingsSection>
  </SettingsPage>
</Page>
```

Give each section its **heading + description above the card, not inside a `CardHeader`** — the card
holds only the controls (Linear/Vercel style) — see
[forms.md](./forms.md#settings-groups-heading-and-description-go-outside-the-card). Keep the heading
close to its card (`gap-3` inside the section), but use **more space between groups** (`gap-8` on the
page column) so Profile, Appearance, Notifications, etc. read as separate sections. Within each section
keep the Linear-style row: label + description on the left, control on the right
(`Field orientation="horizontal"` with the control at the end), and **cap the control width** (~`max-w-xs`,
don't stretch inputs full width) — see
[forms.md](./forms.md#settings-rows-horizontal-layout-capped-control-width).

---

## Optical alignment of icons and labels

Let components size and align icons (see [icons.md](./icons.md)). Use `data-icon` in buttons; don't
add margins to nudge icons — use the component's `gap`. Icons paired with text should be vertically
centered via the container's `items-center`, not manual `mt-*`.

**Incorrect:**

```tsx
<Button>
  <SearchIcon className="mr-2 size-4" />
  Search
</Button>
```

**Correct:**

```tsx
<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>
```

---

## Menu items never wrap

Action-menu labels (`DropdownMenu`, `ContextMenu`, `Menubar`) are a **single line**. A wrapped item
("Remove from" / "workspace") is a defect — users must not see line breaks in menu items. See
[composition.md](./composition.md#menu-item-labels-stay-on-one-line) for the width rule
(`w-(--anchor-width)` is Select/Combobox only; prefer `min-w-*` or no width on menus).

This is invisible until you **open the menu**. During visual verification, open every `⋯` / account /
row-action menu and measure each item — don't screenshot the closed trigger and move on.

```js
(() => {
  const items = [...document.querySelectorAll('[role="menuitem"]')];
  return items.map((el) => {
    const g = getComputedStyle(el);
    return {
      text: (el.textContent || "").replace(/\s+/g, " ").trim(),
      whiteSpace: g.whiteSpace,
      height: el.getBoundingClientRect().height,
      lineHeight: parseFloat(g.lineHeight) || 0,
      wraps: el.scrollHeight > el.clientHeight + 1 || g.whiteSpace !== "nowrap",
    };
  });
})()
```

`wraps: true` or `whiteSpace` other than `nowrap` is a defect. Height should be one line (line-height +
vertical padding), not two.

---

## Vertical separators: don't paste the toolbar divider

**Do NOT put a vertical `Separator` between the `SidebarTrigger` and the breadcrumb/title in a toolbar
header.** The shadcn **dashboard block** (`dashboard-01` / `site-header`) ships this exact snippet, so
agents reproduce it from memory even though the vendored docs don't include it — and it renders as a
stray little vertical line next to the sidebar toggle. **Delete it.** A single toggle button next to a
breadcrumb is not two groups that need a rule between them; `gap-*` spacing is enough.

**Incorrect:** the pasted dashboard-block header — a lone vertical rule after the toggle.

```tsx
<header className="flex h-12 items-center gap-2 px-2">
  <SidebarTrigger />
  <Separator orientation="vertical" className="mr-2 h-4" /> {/* stray line — remove it */}
  <Breadcrumb> … </Breadcrumb>
</header>
```

**Correct:** drop the separator; let `gap-*` do the spacing.

```tsx
<header className="flex h-12 items-center gap-2 px-2">
  <SidebarTrigger />
  <Breadcrumb> … </Breadcrumb>
</header>
```

Rules for vertical separators in general:

- **Default to *not* adding one.** Only add a divider that separates **two real groups** of controls
  (e.g. a cluster of icon buttons vs. another cluster). A rule between one button and a title/breadcrumb
  is decorative noise — leave it out.
- **If you genuinely need one, center it:** a vertical `Separator` defaults to `self-stretch`, so a
  **fixed height** (`h-4`/`h-6`) inside an `items-center` row pins it to the **top** edge as a short
  hanging line. Add `self-center` (`<Separator orientation="vertical" className="h-6 self-center" />`) or
  let it stretch to the full row height.
- **Adapt boilerplate; don't paste it.** Block/example scaffolding is a starting point — delete
  decorative bits (like this separator) that don't fit, and check that what remains is aligned.
- **During verification, hunt for stray/misaligned 1px lines.** A divider next to the sidebar toggle, or
  one that doesn't span the content it divides / floats off center, is a defect — measure it.

---

## Every async surface has loading, empty, and error states

A table, list, or panel that loads data must handle all three: a `Skeleton` while loading, an `Empty`
component when there's no data (or a filter returns nothing), and a clear error path. Don't ship only
the happy path — a blank region reads as broken. For tables the four rows are built:
`TableSkeletonRows` / `TableEmptyRow` / `TableNoResultsRow` / `TableErrorRow`
([data-display.md](./data-display.md#every-table-needs-loading-empty-and-error-states)); a `Metric`
takes `loading`.

---

## Silent clipping and overlap traps in the installed components

Each of these compiles, renders *something*, and looks almost right — the defect only shows when you
measure or scroll. All were hit in real builds in this repo.

**`Card` in a scrolling flex column needs `shrink-0`.** `Card` carries `overflow-hidden`, so in a
`flex flex-col overflow-y-auto` column the cards shrink to fit and their bottom (or title) is clipped
with no scrollbar and no visual cue. Add `shrink-0` to each card (or don't make the column a flex
container).

**`ScrollArea` ignores `max-h-*` on its root.** The viewport inside is `size-full`, and a percentage
height against a parent that only has a *max*-height resolves to `auto` — so the content overflows
straight out of the popover/panel. Cap the viewport, or give the root a real height:

```tsx
// Incorrect — the list spills past the popover
<ScrollArea className="max-h-96">…</ScrollArea>

// Correct
<ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-96">…</ScrollArea>
<ScrollArea className="h-80">…</ScrollArea>          {/* fixed height is fine too */}
```

A plain `div className="max-h-96 overflow-y-auto"` is also fine for short lists.

**`Tabs variant="line"` draws its underline 5px *below* the list** (`after:bottom-[-5px]`). Put the
`TabsList` in an `overflow-x-auto` scroller (for many tabs at narrow widths) and the underline is
clipped — the active tab loses its only indicator. The trigger sits inside the list's `p-[3px]`, so
the line pokes ~2px below the list box: give the scroller `pb-1` (measured: `pb-[3px]` is the minimum
that shows it), or don't clip it.

**`Alert` reserves only 72px (`pr-18`) for an `AlertAction`.** A labelled action ("Retry", "View
payout →") is wider and overlaps the title text. Put labelled actions in the `AlertDescription` (as a
button row below the text) and keep `AlertAction` for a single icon button.

**`CommandItem` always reserves room for a trailing check icon** (invisible until
`data-checked=true`) — *unless* the item contains a `CommandShortcut`, which hides it. So a
right-aligned count or price in a plain `span` with `ml-auto` shares the free space with the hidden
icon and floats mid-row. Render trailing metadata in `CommandShortcut` (override `tracking-normal
tabular-nums` for numbers), and give the label `min-w-0 flex-1 truncate`.

**`SidebarMenuBadge` and a `showOnHover` `SidebarMenuAction` share the same spot.** The usual swap
hides the count on hover/focus, but the action stays visible while its menu is open
(`aria-expanded:opacity-100`), and by then the pointer and focus are inside the menu — so the count
comes back on top of the ⋯. Hide the badge for an open menu too:

```tsx
<SidebarMenuBadge className="group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0 group-has-aria-expanded/menu-item:opacity-0">
```

Verify with the menu open and the pointer moved onto a menu item, not still over the row.

**`SidebarMenuButton` sizes every `svg` inside it to 16px**, not only its leading icon: the class
is `[&_svg]:size-4`, a descendant selector that outranks a plain `size-*` on the icon itself. A
colored list dot, an avatar glyph, or a status ring drawn as an `svg` comes out 16px whatever you
set. Don't patch it with inline styles, and don't edit the registry file. Draw a dot as a `span`
(`<span className="size-2.5 shrink-0 rounded-full bg-(--list-color)" />`), or, for an icon that
must be another size, use Tailwind's important modifier on it (`size-3!`).

**Measure, don't eyeball:** for each suspect, compare `el.scrollHeight` vs `el.clientHeight` (clipped
content) and `getBoundingClientRect()` of neighbours (overlap).

## Probe

Screenshot the changed surface in light **and** dark, bring the window to the front first, then
measure what a screenshot can't settle:

- **Rounded overlays** (Dialog, Popover, Command, Sheet): [the overlay measurement](#measure-overlays--dont-eyeball-them)
  — `gapTop`/`gapLeft` ≥ ~8px and `inputRadius ≈ containerRadius − gap`.
- **Every menu**, opened: [the item measurement](#menu-items-never-wrap) — `wraps: false`,
  `white-space: nowrap`, one line tall.
- **Clipping and overlap:** for each suspect, `el.scrollHeight > el.clientHeight` (clipped) and
  `getBoundingClientRect()` of neighbours (overlap); a stray 1px line next to the sidebar toggle.
- **Async surfaces:** force each of loading, empty, and error once and screenshot them.

Report the numbers, not "it looks fine".
