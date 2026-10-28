# Customization & Theming (this project)

Components reference semantic CSS variable tokens. Change a variable and every component that uses it
changes with it.

**Everything theme-related lives in one file: `src/renderer/index.css`.** Never create a new CSS file,
and ignore upstream docs that say `globals.css` — that's the Next.js convention, not this project's.

## Contents

- The shape of `src/renderer/index.css` (which block is live)
- Color tokens
- Dark mode
- Border radius and the radius scale
- Adding a custom color
- Customizing components (variants, className, wrappers)
- Updating an installed component

---

## The shape of `src/renderer/index.css`

Read this before editing — the file has four distinct sections, and editing the wrong one silently
does nothing:

| Section | What it holds | Edit it when |
| --- | --- | --- |
| `@import` + `@config` (top) | Tailwind v4, Inter, `tw-animate-css`, `./shadcn.css` (vendored `shadcn/tailwind.css`: the app has no `shadcn` dependency, so if a CLI command adds it back, remove it and the `shadcn/tailwind.css` import) | adding a global dependency |
| `@layer base` | element rules only (`html`, `*`, `body`) | changing global element defaults |
| `@layer utilities` | `show-animation`, `.app-drag-region` / `no-drag` | adding a project utility |
| `@theme inline` | maps tokens → Tailwind utilities (`--color-*`, `--radius-*`) | **registering** a new token |
| `:root` / `:root[data-platform="mac"]` / `@media (prefers-color-scheme: dark)` (bottom, **unlayered**) | the live OKLCH token values, `--radius`, `--titlebar-*` | **changing** a token's value |

> The token blocks at the bottom are **outside any `@layer`**, so they beat anything inside
> `@layer base`. A token redefined in `@layer base` will be overridden and appear to have no effect.
> Put value changes in the bottom blocks.

Tailwind here is **v4**: there is no `tailwind.config.js` and no `theme.extend.colors` to edit. Token
registration happens in `@theme inline`.

---

## Color tokens

Every color follows the `name` / `name-foreground` convention: the base variable is for backgrounds,
`-foreground` for text/icons on that background. These are the tokens this project actually defines:

| Variable | Purpose |
| --- | --- |
| `--background` / `--foreground` | Page background and default text |
| `--card` / `--card-foreground` | Card surfaces |
| `--popover` / `--popover-foreground` | Overlay surfaces |
| `--primary` / `--primary-foreground` | Primary buttons and actions |
| `--secondary` / `--secondary-foreground` | Secondary actions |
| `--muted` / `--muted-foreground` | Muted/disabled states, secondary text |
| `--accent` / `--accent-foreground` | Hover and accent states |
| `--destructive` | Error and destructive actions |
| `--success` / `--warning` | State: "good" and "needs attention" (run succeeded, stock low, payment pending) — text/icon colors, see below |
| `--border` / `--input` / `--ring` | Borders, input borders, focus ring |
| `--chart-1` … `--chart-5` | Charts / data visualization |
| `--sidebar`, `--sidebar-foreground`, `--sidebar-primary(-foreground)`, `--sidebar-accent(-foreground)`, `--sidebar-border`, `--sidebar-ring` | Sidebar surface |
| `--sidebar-selection` / `--sidebar-selection-foreground` | The selected sidebar item (`data-active` on `SidebarMenuButton`/`SidebarMenuSubButton`). A local token: upstream reuses `--sidebar-accent`, the hover tint, which barely differs from `--sidebar`. Hover stays `--sidebar-accent` for unselected items; a selected item keeps `--sidebar-selection` while hovered or pressed (`data-active:hover:` / `data-active:active:`). Selection must stay clearly stronger than hover (measured: 1.19:1 light, 1.43:1 dark against `--sidebar`; hover 1.04 / 1.15) |

> There is **no `--destructive-foreground` and no `--surface`** token here. Don't reference tokens
> that aren't in the file — `text-surface-foreground` compiles to nothing and the text renders with
> an inherited color.

**`--success` and `--warning` are text/icon colors, like `--destructive`** — there is no
`-foreground` pair. Use them three ways only: as text/icon on a surface (`text-success`), on their own
tint (`Badge variant="success"`/`"warning"`, which is `bg-success/10 text-success`, `/20` in dark), or
as a small dot/border. **Never a solid fill with text on it**: in dark mode they're lifted so far that
neither white (2.33:1) nor dark text (2.23:1) is readable on `bg-success`. Measured contrast (WCAG,
text needs 4.5:1):

| Token | Light: on card / on own tint | Dark: on card / on own tint |
| --- | --- | --- |
| `--success` | 5.32 / 4.63 | 8.47 / 6.23 |
| `--warning` | 5.49 / 4.78 | 9.64 / 6.80 |
| `--destructive` | 4.77 / 4.01 ✗ | 6.84 / 5.26 |

(`Badge variant="destructive"` text on its own tint is below 4.5:1 in light mode — it's the registry
default; keep its label short and bold-weight, or use it as a dot + plain text.) If you retune any of
these, re-measure with the canvas probe in [data-display.md](./rules/data-display.md) — a token tuned
for 3:1 (icons, borders) fails as text.

Values are OKLCH: `oklch(0.147 0.004 49.25)` is lightness (0–1), chroma (0 = gray), hue (0–360).

Non-color tokens defined alongside them: `--radius` (below) and `--titlebar-inset` /
`--titlebar-traffic-width` (see [rules/app-window.md](./rules/app-window.md) — keep those in sync
with `setWindowButtonPosition` in `src/main/index.ts`).

---

## Typography

Three font stacks are the source of truth, defined in the unlayered `:root` block:

| Token | Stack starts with | Used for |
| --- | --- | --- |
| `--font-regular` | `"SF Pro Display"`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, … | all UI text |
| `--font-monospace` | `"Berkeley Mono"`, `"SFMono Regular"`, `Consolas`, `Menlo`, … | code, numbers, `Kbd` |
| `--font-emoji` | `"Apple Color Emoji"`, `"Segoe UI Emoji"`, … | **fallback only** |

`@theme inline` maps them onto the Tailwind utilities, which is what makes every component pick them
up:

```css
--font-sans: var(--font-regular), var(--font-emoji);
--font-mono: var(--font-monospace), var(--font-emoji);
--font-heading: var(--font-sans);
```

- **Change a stack in `:root`, never in `@theme inline`.** The mapping above is stable; the stacks are
  the thing you edit.
- **`font-heading` is a real utility here** — `CardTitle`, `DialogTitle`, `SheetTitle`, `DrawerTitle`,
  `AlertDialogTitle`, and `EmptyTitle` all use it. It currently resolves to the same stack as
  `font-sans`; point it at a different family and every title in the app changes at once.
- **Never apply `--font-emoji` on its own.** It's appended to the text stacks so emoji render in colour
  everywhere; used alone it has no latin coverage and text drops to a serif fallback.
- **A family in a stack only renders if it's installed.** No font ships with the app, so text uses
  the platform's system font. On a stock macOS machine `--font-monospace` currently resolves to
  **Menlo**, because Berkeley Mono is a commercial font that isn't bundled and isn't installed.

### Bundling a font: import it from `main.tsx`, not `index.css`

Bundling a font adds a dependency, so ask the user first; the template ships none.

**Do not add `@import "@fontsource-.../..."` to `index.css`.** Tailwind's postcss plugin resolves that
import and inlines the CSS **without rebasing its `url()`s**, so the `.woff2` files are never emitted —
the `@font-face` rules point at paths that 404 and the font silently never loads. Nothing errors; the
app just quietly renders the next family in the stack.

**Correct** — import it from the JS entry so Vite's asset pipeline emits and hashes the files:

```tsx
// src/renderer/main.tsx — <family> is the package the user agreed to
import "@fontsource-variable/<family>";
```

Then put its family name first in `--font-regular`.

**Verify a font actually loads** (with `agent eval` in the running app) — a
computed `font-family` string proves nothing, because it lists families whether or not they exist:

```js
// agent eval — measure a known-bogus family as the "not found" control.
(() => {
  const w = (ff) => { const s = document.createElement("span");
    s.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:40px;font-family:" + ff;
    s.textContent = "Handgloves 0123 il1"; document.body.appendChild(s);
    const x = s.getBoundingClientRect().width; s.remove(); return Math.round(x * 100) / 100; };
  return document.fonts.ready.then(() => ({
    stack: w("var(--font-regular)"),
    wanted: w('"<Family> Variable"'),   // the family name the package declares
    control: w('"NotAFontXYZ"'),   // stack === control  →  the font is NOT loading
  }));
})()
```

`document.fonts.check()` is **not** a usable availability test here — it returned `true` for families
that aren't installed at all. Compare rendered widths against the bogus control instead.

Also confirm the build actually emitted the files: `find out/renderer -name "*.woff2"`.

---

## Dark mode

The dark tokens are the `@media (prefers-color-scheme: dark)` block at the bottom of `index.css`;
Tailwind's `dark:` variant is the same media query. The app sets the theme (Settings → General), so
pages need no theme code. **Don't add a theme provider, a `.dark` class, or `next-themes`**; read
the theme with `matchMedia("(prefers-color-scheme: dark)")`.

To theme something for dark mode, **give the token a value in the dark block** — never write `dark:`
color overrides in components (see [rules/styling.md](./rules/styling.md)). The shadcn CLI writes
dark variables into a `.dark {}` block; move them into the media block.

**Verify both themes.** A contrast or surface bug usually shows in exactly one of them, so screenshot
light *and* dark when you change tokens or build a new surface.

---

## Border radius and the radius scale

`--radius` is **`0.625rem` (10px)**. Unlike upstream shadcn (where `rounded-md` is
`calc(var(--radius) - 2px)`), this project derives the whole scale by **multiplier** in
`@theme inline`:

```css
--radius-sm: calc(var(--radius) * 0.6);   /*  6px */
--radius-md: calc(var(--radius) * 0.8);   /*  8px */
--radius-lg: var(--radius);               /* 10px */
--radius-xl: calc(var(--radius) * 1.4);   /* 14px */
--radius-2xl: calc(var(--radius) * 1.8);  /* 18px */
--radius-3xl: calc(var(--radius) * 2.2);  /* 22px */
--radius-4xl: calc(var(--radius) * 2.6);  /* 26px */
```

Changing `--radius` rescales every component at once. The nesting rule that depends on these numbers
(`inner_radius = outer_radius − padding`) is in
[rules/visual-polish.md](./rules/visual-polish.md#concentric-nested-border-radius).

---

## Adding a custom color

Two steps, both in `src/renderer/index.css`. There is no Tailwind v3 `tailwind.config.js` step.

```css
/* 1. Define the value in the unlayered :root and dark blocks at the bottom.
      (Illustrative: this project has no --info token.) */
:root {
  --info: oklch(0.5 0.13 240);
}
@media (prefers-color-scheme: dark) {
  :root {
    --info: oklch(0.72 0.12 240);
  }
}
```

```css
/* 2. Register it with Tailwind in @theme inline, so text-info / bg-info/10 exist. */
@theme inline {
  --color-info: var(--info);
}
```

```tsx
// 3. Use it — and measure its contrast in both themes before shipping (see Color tokens above).
<span className="text-info">Syncing</span>
```

Ask the user before adding a token — a new semantic color is a design decision. For one-off status
text, prefer an existing token or a `Badge` variant (see [rules/styling.md](./rules/styling.md)).

---

## Customizing components

Prefer these approaches in order:

### 1. Built-in variants

```tsx
<Button variant="outline" size="sm">Click</Button>
```

### 2. Tailwind classes via `className` (layout only)

```tsx
<Card className="mx-auto max-w-md">...</Card>
```

### 3. Add a new variant to the component source

Edit the `cva` config in `src/renderer/components/ui/<name>.tsx`:

```tsx
// components/ui/badge.tsx — the success/warning variants follow this exact pattern
info: "bg-info/10 text-info dark:bg-info/20",
```

### 4. Wrapper components

Compose primitives into a higher-level component. Check [rules/app-kit.md](./rules/app-kit.md)
first: the kit already ships the common compositions (`ConfirmDialog`, `CopyButton`, `SearchField`, …),
and a second component with the same job, or the same name, is a bug. Note the **Base UI `render`
prop** — `asChild` is a Radix idiom and does nothing here (see
[rules/base-vs-radix.md](./rules/base-vs-radix.md)):

```tsx
// An icon-only toolbar button whose tooltip repeats its accessible name.
export function ToolbarButton({ label, shortcut, children, ...props }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label} {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
}
```

Put wrappers like this in `src/renderer/components/` — **not** in `components/ui/`, which mirrors the
registry (see [rules/structure.md](./rules/structure.md)).

---

## Updating an installed component

The full set is already installed, so you rarely need the CLI. If you do update one from upstream,
**preview first and never blind-overwrite** — these files carry local edits (the list of `Local fix:`
patches is in [rules/structure.md](./rules/structure.md#componentsui-is-the-registry-mirror--keep-it-pristine)):

```bash
npx shadcn@latest add button --dry-run          # what would change
npx shadcn@latest add button --diff button.tsx  # the actual diff
```

Ask before overwriting, and afterwards re-check the file for Radix idioms (`asChild`), hardcoded
relative imports, and non-lucide icons — upstream ships the Radix flavor by default.

> **Don't run preset commands** (`npx shadcn@latest apply --preset …`, `init --preset …`). They
> rewrite `components.json`, the theme, and potentially every file in `components/ui`, discarding the
> project's local changes. Changing the theme means editing the tokens in `src/renderer/index.css`.
