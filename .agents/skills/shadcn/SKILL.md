---
name: shadcn
description: Builds, fixes, and reviews UI in this project with shadcn/ui — composing, styling, debugging, and visually verifying components. Provides the project's shadcn configuration, an app kit of ready-made patterns (page layout, hash router, search/filter fields, data-table parts, status badges, metrics, confirm/undo, copy, save bar, money and date inputs, timeline) to use instead of hand-rolling them, correctness rules, usage patterns, and a visual-polish checklist. Applies when creating, changing, reviewing, testing, QA-ing, or verifying any renderer UI (screens, dialogs, forms, chat, command palette, etc.), when running the app to check how UI looks or behaves, or when working with files under src/renderer/components/ui.
user-invocable: false
allowed-tools: Bash(npx shadcn@latest search *)
---

# shadcn/ui (project-tailored)

Components live as source code in this repo, and everything you need is on the local file system —
**don't fetch docs from the web, and don't use the shadcn MCP server or registries.**

This file holds the project's **conventions** (always apply) and an **index of traps** (open the
linked rule when you touch that area). The rule files under `rules/` hold the Incorrect/Correct
detail.

## Project context

These values are fixed. Don't re-detect them or run `npx shadcn@latest info`.

- **Base UI, not Radix.** The wrappers in `src/renderer/components/ui` import `@base-ui/react`; use
  the `render` prop for custom triggers, never `asChild` → [base-vs-radix.md](./rules/base-vs-radix.md).
  (`components.json` has no `base` key, so the CLI may still say `radix` — the source is the truth.)
- **`style`** `base-nova`, **`baseColor`** `stone`, **`iconLibrary`** `lucide` (`lucide-react`).
- **`rsc: false`** — a Vite renderer, not Next.js. Never add `"use client"`.
- **Tailwind v4.** Tokens live in `src/renderer/index.css` — the only stylesheet; edit the OKLCH
  `:root` / `@media (prefers-color-scheme: dark)` blocks at the bottom. `--radius` is `0.625rem` (10px).
- **Aliases:** `@/components`, `@/components/ui`, `@/lib/utils`, `@/lib`, `@/hooks` → `src/renderer`.
- **Everything is installed:** the full shadcn registry **plus the app kit** below, in
  `src/renderer/components/ui`. Import; don't run the CLI to add them.

## Documentation: local only

- **Usage and examples:** `.agents/skills/shadcn/component-docs/components/<name>.md` (a vendored
  copy of ui.shadcn.com). **Exact props:** the installed `src/renderer/components/ui/<name>.tsx` —
  when docs and source disagree, trust the source.
- **Adapt every snippet** from those docs: they're upstream Next.js — rewrite `@/registry/…` imports
  to `@/components/ui/…`, drop `"use client"`, convert `asChild` to `render`. `data-table.md` needs
  `@tanstack/react-table`, which is **not installed** — use the kit's table parts, and **ask before
  adding any dependency** (table library, virtualizer, router).
- **This skill is a local fork — never re-run `npx skills add shadcn/ui`**; it would overwrite every
  rule here.

## Principles

1. **Kit first, then registry, then custom.** Check the app kit and `components/ui` before writing
   any UI of your own.
2. **Compose, don't reinvent** — a settings page is `Page` + `SettingsSection*` + fields; a list
   screen is `Page` + `TableToolbar` + `TableCard`.
3. **Built-in variants before custom styles** (`variant="outline"`, `size="sm"`).
4. **Semantic tokens only** — `bg-primary`, `text-muted-foreground`; state is `success` / `warning` /
   `destructive`. Never raw colors like `bg-blue-500`.
5. **Adapt boilerplate; don't paste it** — remove block scaffolding that doesn't fit, then verify
   what's left is aligned.

## Use the app kit — don't hand-roll it → [app-kit.md](./rules/app-kit.md)

`src/renderer/components/ui` holds **local extensions** (`LOCAL EXTENSION` header) for the patterns
every app needs — and every build used to re-implement with the same bugs. They're verified (light/
dark, 720×560, keyboard, a11y). **Import them. Never write your own version, a near-identical
wrapper, or a copy of their internals.** Missing a capability? Add an app-agnostic prop to the kit
file, or ask.

| Need | Use (`@/components/ui/…`) |
| --- | --- |
| Screen column, `h1`, description, actions, back link, side column | `page`: `Page size`, `PageHeader`, `PageHeaderContent`, `PageHeading`, `PageTitle`, `PageDescription`, `PageActions`, `PageBack`, `PageSplit`/`PageMain`/`PageAside` |
| Screens, URLs, links, back/forward, query state | `router`: `Routes`, `navigate`, `setQuery`, `useRoute`, `Link`, `TextLink`, `NavigationGuard` |
| Search/filter box (Esc clears, ✕, `/` shortcut) | `search-field`: `SearchField` |
| Multi-select filter chip | `faceted-filter`: `FacetedFilter` |
| Date-range filter / single date field | `date-range-picker`: `DateRangePicker`, `DatePicker` |
| Table frame, toolbar, sortable headers, pagination, selection, bulk bar | `data-table`: `TableCard`, `TableToolbar`, `SortableHead`, `compareBy`, `paginate`, `TablePagination`, `useSelection`, `SelectAllCheckbox`, `BulkActionBar` |
| Loading / empty / no-results / error rows | `table-state`: `TableSkeletonRows`, `TableEmptyRow`, `TableNoResultsRow`, `TableErrorRow` |
| Status pill; +12.4% change | `status-badge`: `StatusBadge tone`, `Delta` |
| KPI / stat tiles | `metric`: `Metric`, `MetricGroup` |
| Confirm an action; Undo toast | `confirm-dialog`: `ConfirmDialog`, `undoToast` |
| Copy ID / key / URL | `copy-button`: `CopyButton`, `copyToClipboard` — **never call `navigator.clipboard` directly** (it rejects when the window is unfocused) |
| Unsaved changes: Save/Discard, ⌘S, leave guard | `save-bar`: `SaveBar` |
| Price / amount (integer cents) | `money-input`: `MoneyInput` |
| Activity feed, notes | `timeline`: `Timeline`, `NoteComposer` |
| Settings screens | `settings`: `SettingsPage`, `SettingsSection*` inside `<Page size="settings">` |

Feature code keeps only app decisions: columns, copy, which status maps to which `tone`, what a
route renders.

## Conventions (always apply)

**Where code goes** → [structure.md](./rules/structure.md)
- `components/ui` is the registry mirror + kit — **no app code there**. Features go in
  `components/<feature>/`, hooks in `hooks/`, helpers in `lib/`. Import via `@/` aliases only.
- Routing is `@/components/ui/router`: `<Routes>` + `<NavigationGuard />` once in the shell. No
  `useState` view switch, no `react-router`.
- Providers live once in `App.tsx` (`Toaster` and `TooltipProvider` are mounted). Never edit `gen/`.

**Styling** → [styling.md](./rules/styling.md)
- `className` is for layout, not for overriding component colors or typography.
- `flex`/`grid` + `gap-*`, never `space-x/y-*`; `size-*` when width = height; `truncate` shorthand;
  `cn()` for conditional classes.
- No manual `dark:` color overrides and no `z-index` on overlays.
- `--success` / `--warning` are **text/icon colors only** (`text-success`) — a filled state is
  `Badge variant="success"` / `StatusBadge`, never `bg-success` + text.

**Forms** → [forms.md](./rules/forms.md)
- Layout is `FieldGroup` + `Field` + `FieldLabel htmlFor`; related checkboxes/radios are `FieldSet` +
  `FieldLegend`.
- Validation: `data-invalid` on `Field`, `aria-invalid` on the control, plus a message.
- `InputGroup` takes `InputGroupInput`/`InputGroupTextarea`, and buttons in inputs go in
  `InputGroupAddon`.
- Picking one value: `Select` inside settings (even for 2–3 options; on/off is a `Switch`),
  `ToggleGroup` in toolbars/filters. Never looped `Button`s with manual active state.
- Settings rows are `Field orientation="horizontal"`, controls capped at ~`w-64`, `FieldGroup
  className="gap-3"`.
- Editors use `SaveBar`, money is `MoneyInput`, dates are `DatePicker`.

**Composition** → [composition.md](./rules/composition.md)
- **Items inside their Group** (`SelectItem` → `SelectGroup`, `DropdownMenuItem` →
  `DropdownMenuGroup`, `CommandItem` → `CommandGroup`). A `DropdownMenuLabel` outside a group
  **throws and blanks the app**.
- **`CommandDialog` needs a `<Command>` inside**; a bare `CommandInput` crashes the app.
- Custom triggers use `render`. Dialog/Sheet/Drawer always have a Title (`sr-only` if hidden).
- Full `Card` composition; `TabsTrigger` inside `TabsList`; `Avatar` with `AvatarFallback`.
- Button has no `isLoading` — compose `Spinner data-icon` + `disabled`.
- Use the component, not a styled `div`: `Alert`, `Empty`, `Separator`, `Skeleton`, `Badge`,
  `toast()` from `sonner`.

**Icons** → [icons.md](./rules/icons.md)
- `lucide-react` icons, passed as objects (`icon={CheckIcon}`).
- Inside components use `data-icon="inline-start|inline-end"`, never sizing classes.

**Accessibility** → [accessibility.md](./rules/accessibility.md)
- Icon-only controls get a specific `aria-label` (`Delete ${name}`) that includes the state the
  icon shows (`Notifications, 3 unread`). This is the most common defect.
- A placeholder is not a label. Never a `div` with `onClick`. Never `outline-none` without a visible
  focus indicator.
- Color is never the only signal. One `h1` per screen (`PageTitle`), then `h2`/`h3`.
- A tooltip needs a focusable trigger: `tabIndex={0}` on a `<time>`/`<span>`, and a focusable
  wrapper `span` around a *disabled* button.
- Keyboard shortcut hints are `Kbd` (`<Kbd>⌘K</Kbd>`), not styled text.

**Interaction** → [interaction.md](./rules/interaction.md)
- `Enter` submits (a real `<form>`), Esc/Cancel dismisses, and pending shows a spinner with no
  double-submit.
- Destructive actions confirm (`ConfirmDialog`) and offer Undo (`undoToast`).
- Inline edits: `Enter` commits, `Esc` reverts.
- **Never open an overlay from a trigger's `onFocus`**: focus-return reopens it, and the user is
  trapped.
- Every overlay opens, closes on Esc and outside-click, **and stays closed**.

**Layout & responsive** → [responsive.md](./rules/responsive.md), [visual-polish.md](./rules/visual-polish.md)
- The layout must survive the window's **minimum size** (`setMinimumSize` in `src/main/index.ts`),
  not just its launch size.
- `useIsMobile()` flips at **768px**. Below it the sidebar is a `Sheet` and `md:` is off, so check
  every width from the minimum up to 767px. Never read `window.innerWidth`.
- `max-w-*`, not fixed `w-[Npx]`; grids start at `grid-cols-1`; `min-w-0` on shrinking flex
  children. The shell is `h-svh`.
- Concentric radii (inner = outer − padding). Rounded overlays get inset padding +
  `overflow-hidden`. Use one spacing scale.
- Every async surface has loading, empty, and error states.

**macOS window** → [app-window.md](./rules/app-window.md) — content runs **under the traffic
lights**; the toolbar is `h-12 px-2`, the sidebar is `collapsible="offcanvas"`, and the top-left
corner stays clear. **Read app-window.md before touching the toolbar, sidebar header, or
`src/main` window setup.**

## Trap index — open the rule when you touch this

Each of these compiles and looks almost right. They were all hit in real builds here.

| When you're… | Trap | Read |
| --- | --- | --- |
| Building a table | `max-w-0 truncate` on a cell starves the column; hover actions need `group/row` on `TableRow`; a `ContextMenu` goes per row, not around `TableBody`; numbers are `text-right tabular-nums`; no second scroller around `Table` | [data-display.md](./rules/data-display.md#row-actions-and-sortable-headers) |
| Adding a chart | compose `ChartContainer` + `ChartConfig`, colors as `var(--color-<key>)` (never hex); skeleton at the chart's aspect ratio + `Empty`; `--chart-1…5` is one blue ramp: **max 2 series (`--chart-2` + `--chart-5`)**, screenshot dark mode; `ChartTooltipContent` prints raw cents without a `formatter`; never dual-axis; one number is a `Metric`, not a chart | [data-display.md](./rules/data-display.md#charts-compose-chartcontainer--chartconfig) (read from there to the end) |
| Using a menu | radio/checkbox items don't close it (`closeOnClick`); labels never wrap (no `--anchor-width` on `DropdownMenuContent`) | [composition.md](./rules/composition.md#menu-item-labels-stay-on-one-line) |
| Putting a link or button in a `Popover`, or a long `Dialog` | a `Popover` doesn't close when its content navigates; long dialogs scroll — pin a footer deliberately | [composition.md](./rules/composition.md#overlay-height-and-navigation) |
| Putting a tooltip-wrapped control first in an overlay | it eats the first Escape | [interaction.md](./rules/interaction.md#a-tooltip-on-an-overlays-first-focusable-control-eats-the-first-escape) |
| Nesting a `<form>` in a Dialog/Sheet on a form page | its submit bubbles through the portal and submits the page | [forms.md](./rules/forms.md#a-form-inside-a-dialogsheet-also-submits-the-pages-form) |
| Building a settings screen | heading + description go **outside** the card, aligned with row labels | [forms.md](./rules/forms.md#settings-groups-heading-and-description-go-outside-the-card) |
| Adding an app setting, the theme choice, or About | they live in the **Settings window** (`components/settings/*`), not a menu or dialog. The theme is the existing `ThemePicker` preview cards, the only non-`Select` choice | [settings-window.md](../desktop-shell/rules/settings-window.md), [forms.md](./rules/forms.md#settings-choices-use-select--never-togglegroup-or-toggle), [customization.md](./customization.md#dark-mode) |
| Putting a colored dot or a non-16px icon in a `SidebarMenuButton` | it forces every descendant `svg` to 16px — draw dots as a `span`, or `size-3!` | [visual-polish.md](./rules/visual-polish.md#silent-clipping-and-overlap-traps-in-the-installed-components) |
| Copying a dashboard block's header | delete the vertical `Separator` next to `SidebarTrigger` | [visual-polish.md](./rules/visual-polish.md#vertical-separators-dont-paste-the-toolbar-divider) |
| Using `Card` in a scrolling column, `ScrollArea` with `max-h`, line `Tabs` in a scroller, `AlertAction` | silent clipping/overlap | [visual-polish.md](./rules/visual-polish.md#silent-clipping-and-overlap-traps-in-the-installed-components) |
| Building a fill-height layout | `h-full` / `flex-1 min-h-0` panes overlap when stacked — gate them to the side-by-side breakpoint | [responsive.md](./rules/responsive.md#height-is-a-constraint-too) |
| Building a tree, an outline, or a nested list | one tab stop for the whole tree (roving tabindex), arrow keys, `aria-level`/`aria-expanded` only on parents; every drag has a keyboard command | [tree.md](./rules/tree.md) |
| Building a chat / conversation | `MessageScroller`, `Message`, `Bubble`, `Attachment`, `Marker` — no hand-rolled scroll hooks | [chat.md](./rules/chat.md) |
| Rendering a long list or a heavy chart | ≤200 rows render, 200–2,000 paginate, >2,000 ask; no virtualizer or React Compiler; stable keys | [performance.md](./rules/performance.md) |
| Using `Select`, `ToggleGroup`, `Slider`, `Accordion` from memory | Base UI APIs differ from Radix | [base-vs-radix.md](./rules/base-vs-radix.md) |
| Changing a token or adding a variant | where tokens live, state colors, fonts | [customization.md](./customization.md) |
| Re-adding or overwriting a registry file | re-apply the `Local fix:` changes | [structure.md](./rules/structure.md#componentsui-is-the-registry-mirror--keep-it-pristine) |

## Workflow

1. **Map the screen to the kit**, then to registry components. Read `component-docs/` and the
   installed `.tsx` for props.
2. **Compose** following the conventions; open the trap-index rule for each area you touch.
3. **Verify**, sized to the change as [`mobrowser-testing/SKILL.md`](../mobrowser-testing/SKILL.md)
   describes; launch and drive the app only as `AGENTS.md` says. Run the `## Probe` section of every
   rule you touched, check light **and** dark, and the window's minimum size
   ([responsive.md](./rules/responsive.md#probe)). A new screen also gets the crash crawl in
   [crawl.md](./rules/crawl.md). Report the measured evidence, not "looks fine".

This is also the whole job when asked to check, verify, review, test, or QA existing UI.
"Works/renders properly" includes visual correctness.

**Community-registry components (rare):** `npx shadcn@latest add owner/repo/item`. Never overwrite
an existing file without asking, and fix its imports and icons afterwards.

## Rule files

[app-kit](./rules/app-kit.md) ·
[structure](./rules/structure.md) ·
[styling](./rules/styling.md) ·
[forms](./rules/forms.md) ·
[composition](./rules/composition.md) ·
[icons](./rules/icons.md) ·
[data-display](./rules/data-display.md) ·
[tree](./rules/tree.md) ·
[accessibility](./rules/accessibility.md) ·
[interaction](./rules/interaction.md) ·
[responsive](./rules/responsive.md) ·
[performance](./rules/performance.md) ·
[visual-polish](./rules/visual-polish.md) ·
[app-window](./rules/app-window.md) ·
[chat](./rules/chat.md) ·
[crawl](./rules/crawl.md) ·
[base-vs-radix](./rules/base-vs-radix.md) ·
[customization](./customization.md) ·
[component-docs/](./component-docs/)
