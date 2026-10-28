# Renderer structure: where code goes

Everything the user sees lives under `src/renderer`. It has a fixed layout — put new files in the
right place rather than inventing a structure, and **never** add app code to `components/ui`.

```
src/renderer/
  main.tsx                 entry — mounts <App/> in StrictMode, and imports font packages.
  App.tsx                  provider composition + the app shell. Add providers here.
  index.css                the ONE stylesheet (tokens, base layer, utilities).
  index.html               Vite HTML entry.
  components/
    ui/                    shadcn registry mirror + marked local extensions — no app code.
    <feature>/…            your screens, panels, forms, feature components
  hooks/                   shared hooks: use-<thing>.ts
  lib/                     framework-free helpers: utils.ts (cn), platform.ts (isMac, ⌘/Ctrl shortcuts)
  proto/                   .proto IPC contracts (source; see below)
  gen/                     GENERATED — gitignored, never edit by hand
  public/                  static assets served as-is
```

---

## `components/ui/` is the registry mirror — keep it pristine

Files in `src/renderer/components/ui` are shadcn component source, copied in by the CLI. Treat them
as a vendored library:

- **Never add a new app component there.** A `dashboard-card.tsx` or `project-list.tsx` is *your*
  component — it belongs in `components/` (or a feature folder), not in `ui/`.
- **Edit an existing one only to add a variant** (see
  [customization.md](../customization.md#customizing-components)), and expect that a future
  `npx shadcn@latest add <name>` will offer to overwrite your change.
- **The one exception is a local extension** — a new, app-agnostic primitive that deliberately
  extends the design system. It must be registry-shaped (compound parts, `data-slot`, `cn`,
  `className` passthrough, no app data or state) and **start with a `LOCAL EXTENSION` header
  comment** so the next person can tell it isn't upstream. Current extensions:

  | File | Exports | Use it for |
  | --- | --- | --- |
  | `ui/settings.tsx` | `SettingsPage*`, `SettingsSection*` | every settings screen — see [forms.md](./forms.md#settings-groups-heading-and-description-go-outside-the-card) |
  | `ui/page.tsx` | `Page`, `PageHeader`, `PageHeaderContent`, `PageHeading`, `PageTitle`, `PageDescription`, `PageActions`, `PageBack`, `PageSplit`, `PageMain`, `PageAside`, `pageVariants` | every screen's column, title row, and side column |
  | `ui/router.tsx` | `Routes`, `navigate`, `setQuery`, `useRoute`, `matchPath`, `Link`, `TextLink`, `useNavigationBlocker`, `usePendingNavigation`, `NavigationGuard` | all navigation (hash router, no dependency) |
  | `ui/search-field.tsx` | `SearchField` | every search/filter text box |
  | `ui/faceted-filter.tsx` | `FacetedFilter` | multi-select filter chips |
  | `ui/date-range-picker.tsx` | `DateRangePicker`, `DatePicker`, `describeDateRange`, `DATE_RANGE_PRESETS` | date-range filters, date fields |
  | `ui/data-table.tsx` | `TableCard`, `TableToolbar`, `SortableHead`, `compareBy`, `paginate`, `PAGE_SIZES`, `TablePagination`, `useSelection`, `SelectAllCheckbox`, `BulkActionBar` | list screens |
  | `ui/table-state.tsx` | `TableSkeletonRows`, `TableEmptyRow`, `TableNoResultsRow`, `TableErrorRow` | a table's non-happy rows |
  | `ui/status-badge.tsx` | `StatusBadge`, `Delta` | statuses, period-over-period change |
  | `ui/metric.tsx` | `Metric`, `MetricGroup` | KPI tiles |
  | `ui/confirm-dialog.tsx` | `ConfirmDialog`, `undoToast` | confirmations, undo |
  | `ui/copy-button.tsx` | `CopyButton`, `copyToClipboard` | copy to clipboard |
  | `ui/save-bar.tsx` | `SaveBar` | every editor's unsaved-changes contract |
  | `ui/money-input.tsx` | `MoneyInput`, `parseMoney`, `formatMoneyInput` | amounts in integer minor units |
  | `ui/timeline.tsx` | `Timeline`, `NoteComposer` | activity history, notes |

  Usage for all of them: [app-kit.md](./app-kit.md). **Use them instead of writing the pattern in a
  feature folder** — a `components/shared/search-input.tsx` or a local `PageHeader` duplicates the
  kit and forks its fixes.

  Before adding another, check the registry and the kit don't already have it, and ask — a new
  extension is a design-system decision, not a place to park a feature component. Kit files may
  import each other (`save-bar` → `router`, `page` → `router`, `metric` → `status-badge`) but never
  app code (`@/lib/store`, feature components).

- **Some registry files carry local fixes** for bugs in the upstream source. Each fix is marked with a
  `Local fix:` comment at the change. **Re-apply them after any `npx shadcn@latest add` /
  `--overwrite`** — the CLI will silently restore the bug:

  | File | Local change | Upstream bug it fixes |
  | --- | --- | --- |
  | `ui/badge.tsx` | `success`, `warning` variants | no variants for the state tokens |
  | `ui/checkbox.tsx` | `MinusIcon` + filled box for `indeterminate` | showed ✓ for "some selected" |
  | `ui/command.tsx` | `CommandDialog` header inside `DialogContent` | sr-only heading on every screen |
  | `ui/dialog.tsx` | `max-h-[calc(100svh-2rem)] overflow-y-auto` | long dialogs ran off-screen |
  | `ui/item.tsx` | `ItemGroup` wraps children in `display: contents` listitems | `role="list"` with no listitems |
  | `ui/sidebar.tsx` | ⌘B/Ctrl+B toggle skips text fields and handled events | the sidebar shortcut stole Bold from editors |
  | `ui/sidebar.tsx` | selected items (`data-active`) use `--sidebar-selection` (in `index.css`), also on hover and press | the selection used the hover tint, almost invisible against `--sidebar`, and hovering it hid it entirely |
  | `ui/sidebar.tsx` | `cursor-default` on `SidebarMenuButton` and `SidebarMenuSubButton` | items rendered as links (`render={<Link />}`) showed the web hand cursor |
| `ui/slider.tsx` | root width is `w-full`, not `data-horizontal:w-full` | a caller's `w-64` was ignored |

  `grep -rn "Local fix:" src/renderer/components/ui` lists them.

**Incorrect:**

```
src/renderer/components/ui/project-list.tsx       ← app code hiding among the primitives
src/renderer/components/ui/use-projects.ts        ← not even a component
```

**Correct:**

```
src/renderer/components/projects/project-list.tsx
src/renderer/hooks/use-projects.ts
```

---

## Naming

Match what's already there — kebab-case files, PascalCase components, `use-` prefixed hooks:

| Kind | File | Export |
| --- | --- | --- |
| Component | `project-list.tsx` | `export function ProjectList()` |
| Hook | `hooks/use-projects.ts` | `export function useProjects()` |
| Helper | `lib/format-bytes.ts` | `export function formatBytes()` |

Prefer named exports (`export function Foo`) — `App.tsx` is the only default export in the codebase.

---

## Imports: always the `@/` aliases

`@/` resolves to `src/renderer` (`components.json` + `tsconfig.json`). Never write relative paths that
climb directories.

**Incorrect:**

```tsx
import { Button } from "../../components/ui/button"
import { cn } from "../lib/utils"
```

**Correct:**

```tsx
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
```

Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`.

> `vite.config.ts` defines `@` **per build**: it points at `src/renderer` in the renderer build and at
> `src/main` in the main build. `tsconfig.json` maps `@/*` to both, so an `@/` import that only
> resolves in the other process type-checks fine and then fails at build time. Inside `src/renderer`,
> `@/` always means `src/renderer`.

The two processes share **types**, never modules: the generated code in `src/main/gen/` and
`src/renderer/gen/` comes from the same `.proto` files ([IPC](#ipc-proto-is-the-source-gen-is-not)).
Never import `src/main` from the renderer or the other way round, and never reach across with `../`.

---

## Providers go in `App.tsx`, once

`App.tsx` owns the provider stack (`TooltipProvider` → content + `Toaster`). Add a
new provider there rather than wrapping a subtree in a screen — a provider mounted twice, or mounted
below a consumer, is a classic on-click crash (see [crawl.md](./crawl.md)).

- **Toasts:** `<Toaster />` is already mounted; just call `toast()` from `sonner`.
- **Tooltips:** `TooltipProvider` is already mounted; don't nest another one.

**A context lives in its own module, apart from its provider.** Put `createContext` and its
`useX()` hook in `x-context.ts`, which imports **only React** (and types). Put the
`<XProvider>` component, with its `ipc` calls, stores and dialogs, in `x.tsx`, and have
consumers import the hook from `x-context.ts`.

If one module creates the context *and* exports a non-component (the hook), React Fast Refresh
can't hot-swap it. Vite re-runs it, the re-run creates a new context object, and components
still on the old module read the old, empty one. The result is "useX must be used within
XProvider" and a blank window. Any upstream change triggers this, including `npm run gen` or
`npm run test:e2e` rewriting `gen/` with identical bytes while `npm run dev` is open.

**A module-level store has the same problem.** A store created when its module loads
(`export const store = createStore()`, with its `ipc` subscription and its first load) is created
again when Vite re-runs the module, while mounted components keep the old instance; the window then
waits on a load that never finishes. Start the work on the **first subscription** instead of at
import: the store loads when a component subscribes, and a re-run module starts over cleanly.

```ts
// Incorrect: loads at import; a hot re-run leaves components on a store nobody updates.
export const tasks = createTaskStore()
void tasks.load()

// Correct: the first subscriber starts the load; the subscribe function is what components use.
export function subscribeToTasks(listener: () => void) {
  if (listeners.size === 0) void load()
  listeners.add(listener)
  return () => listeners.delete(listener)
}
```

To check either, with the app open, arm the `window.__errors` listener from `AGENTS.md`, run
`npm run gen`, and confirm `#root` still has children, the screen still shows data, and nothing was
recorded.

**Font packages are imported in `main.tsx`, not `index.css`** — a `@fontsource` `@import` inside
`index.css` gets inlined by Tailwind's postcss plugin without rebasing its `url()`s, so the `.woff2`
files are never emitted and the font silently doesn't load. See
[customization.md](../customization.md#bundling-a-font-import-it-from-maintsx-not-indexcss).

---

## This is a Vite renderer, not Next.js

- **No `"use client"` directives, ever** (`rsc: false`). Upstream shadcn examples include them —
  strip them when you adapt an example.
  > 17 of the installed `components/ui/*.tsx` files (`table`, `chart`, `select`, `field`, …) still
  > carry `"use client"` from the registry. In Vite it's an inert string literal, not an error — leave
  > them alone rather than churning vendored files, but **don't copy the pattern** into your own code.
- No `next/link`, `next/image`, `next/navigation`, or server components. **Routing is
  `@/components/ui/router`** — a hash router with params, query state, real history, and an
  unsaved-changes blocker ([app-kit.md](./app-kit.md#routing--routertsx)). Don't add `react-router`
  or write a `hashchange` hook.
- `process.env` is not available the way it is in Next — use `import.meta.env` (Vite).

---

## IPC: `.proto` is the source, `gen/` is not

Talking to the main process goes through generated bindings:

1. Edit or add a contract in `src/renderer/proto/*.proto`.
2. Run `npm run gen` — it writes `src/renderer/gen/` **and** `src/main/gen/`.
3. Call it from the renderer via the generated client, and implement it in `src/main/index.ts` with
   `ipc.registerService(...)`:

```tsx
import { ipc } from "@/gen/ipc"

const { name, version } = await ipc.app.GetAppInfo({})
```

`gen/` is gitignored and regenerated from scratch. **Never hand-edit a file in `gen/`** — the change
disappears on the next `npm run gen`, and the folders may simply be missing on a fresh checkout until
you run it.

### The `.proto` files are the domain model

Everything that crosses between the processes is a protobuf message, and the `.proto` files are the
one description of the app's domain: its entities, their fields, the commands that change them, and
the events that report changes. The generated types are the app's types, in both processes.

- **Model the domain in proto.** An entity is a message (`Task`), a closed set is an enum
  (`Priority`, with `PRIORITY_UNSPECIFIED = 0` first), a list is `repeated`, a reference is the
  other entity's id, and a value that is one of several kinds is a `oneof`. Group a domain area in
  one file: `task.proto` holds `Task`, its enums, and `TaskService`.
- **Use the generated types; don't write parallel ones.** Import `Task` from `@/gen/task` in the
  renderer and from `./gen/task` in the main process. Never hand-write a TypeScript interface that
  mirrors a message, never pass a JSON string or another encoding inside a `string` or `bytes`
  field, and never route data around IPC through `localStorage` or the URL.
- **Every RPC has its own request and response messages** (`CreateTaskRequest`,
  `CreateTaskResponse`), even when they start small, so either can grow without touching other
  calls. A response carries what the caller needs next: the changed entity or the new state, and
  the store's revision.
- **A change of several kinds is a `oneof`, a batch is `repeated`:**

  ```proto
  message TaskChange {
    oneof change {
      Task created = 1;
      Task updated = 2;
      string deleted_id = 3;
      MoveTask moved = 4;
    }
  }
  message ApplyRequest {
    int64 base_revision = 1;
    repeated TaskChange changes = 2;
  }
  message ApplyResponse {
    int64 revision = 1;
    repeated Task tasks = 2;
    bool conflict = 3;   // base_revision was stale; nothing was applied
  }
  ```

- **Changes the renderer didn't ask for arrive on a stream.** A service method like
  `rpc OnTasksChanged(google.protobuf.Empty) returns (stream TasksChanged)` is runtime-owned
  pub/sub: `ipc.registerService(TaskServiceDescriptor)` with no implementation returns its
  publisher, and every window that subscribes receives what the main process publishes.
  MenuService's `OnCommand` is the worked example
  ([menu.md](../../desktop-shell/rules/menu.md#renderer-commands-the-menuservice-pattern)).

**The main process owns the logic, and the renderer sends intents.** Rules that decide the data
(validation, ordering, derived fields) run in the main process, once. The renderer sends what
the user did as a request and renders what comes back; it may filter, sort, and group for display.
With nothing to run in both places, nothing needs sharing beyond the generated types.

**The renderer names a new record.** An id is a name, not a rule, so the renderer creates it with
`crypto.randomUUID()` and sends it in the create change. The UI can then refer to the record
before the reply arrives: Enter creates a task and Tab indents it under the one above, as two
changes queued back to back
([app-data.md](../../desktop-shell/rules/app-data.md#optimistic-updates-send-one-at-a-time)). The
main process checks the id like any other field.

**Validate every request in the main process.** The renderer isn't trusted to send a well-formed
message: check required fields, ids that must exist, ids a create must not reuse (a well-formed
UUID that isn't in the store yet), and enum values (a value the main process doesn't know arrives
as `UNRECOGNIZED`, `-1`).

**Evolve the schema without breaking saved data or an older window.** Add fields with new
numbers. Never change a field's number or type, and never reuse one: when you remove a field, list
its number and name under `reserved`. A new enum value goes at the end, and code handles values it
doesn't know.

**What the generated code looks like.** ts-proto generates a TypeScript interface per message,
plus a value with `encode`, `decode`, `toJSON`, `fromJSON`, and `fromPartial`. Field names become
camelCase (`base_revision` → `baseRevision`). `int64` arrives as a `number`. A `oneof` becomes
optional properties of which exactly one is set (`change.created`, `change.deletedId`). An enum is a
numeric TypeScript enum with `UNRECOGNIZED = -1`, and the enum's name functions (`commandToJSON`)
turn a value into its proto name for logs and menu item ids. Read the generated file once before
using a message you haven't used.

---

## One more file that is not yours

`src/main/` is the native shell — window, menu, tray. It has its own skill:
[desktop-shell](../../desktop-shell/SKILL.md). Don't configure window behavior from the renderer.

## Probe

```bash
cd src/renderer
grep -rnE --include='*.tsx' --include='*.ts' \
  -e '"use client"' -e 'next-themes|next/(link|image|navigation)' -e 'react-router|hashchange' \
  -e 'from "\.\./' \
  components hooks lib | grep -v '^components/ui/' | grep -v 'probe-ok:'
cd ../..
grep -nE '^\s*(string|bytes) +\w*(json|payload|blob)\w* *=' src/*/proto/*.proto
git rev-parse --show-toplevel
git status --short src/renderer/components/ui
```

The greps must print nothing: relative `../` imports go through `@/`, and no proto field carries
JSON or another encoding of data the `.proto` files should describe. `components/ui` must show no
app code — a changed registry file carries a `Local fix:` comment or is reverted. `git status` only
checks that when `git rev-parse` prints this project's own folder; in another repository that
ignores the project, it prints nothing whatever changed, so say the check didn't run. Then, with the
app open, the `npm run gen` check above: `#root` still mounted, nothing in `window.__errors`.
