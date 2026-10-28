# Styling & Customization

See [customization.md](../customization.md) for theming, CSS variables, and adding custom colors.

## Contents

- Semantic colors
- Built-in variants first
- className for layout only
- No space-x-* / space-y-*
- Prefer size-* over w-* h-* when equal
- Prefer truncate shorthand
- No manual dark: color overrides
- Use cn() for conditional classes
- No manual z-index on overlay components
- Use shimmer / scroll-fade utilities, not custom animations

---

## Semantic colors

**Incorrect:**

```tsx
<div className="bg-blue-500 text-white">
  <p className="text-gray-600">Secondary text</p>
</div>
```

**Correct:**

```tsx
<div className="bg-primary text-primary-foreground">
  <p className="text-muted-foreground">Secondary text</p>
</div>
```

---

## No raw color values for status/state indicators

For positive, negative, or status indicators, use the state tokens — `success`, `warning`,
`destructive` — as `Badge` variants or text/icon colors. Don't reach for raw Tailwind colors: they
ignore dark mode and nobody measured their contrast.

**Incorrect:**

```tsx
<span className="text-emerald-600">+20.1%</span>
<span className="text-green-500">Active</span>
<span className="text-red-600">-3.2%</span>
```

**Correct:**

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Low stock</Badge>
<Badge variant="destructive">Failed</Badge>
<span className="text-success">+20.1%</span>
<span className="text-destructive">-3.2%</span>
```

`success`/`warning` are text/icon colors with no `-foreground` pair — never `bg-success` with text on
it (unreadable in dark mode). A neutral state (draft, archived) is `variant="secondary"`, not a new
color. Adding any *other* semantic color is a design decision — ask first (see
[customization.md](../customization.md#adding-a-custom-color)).

**Colors the user picks for their own data are not semantic colors.** When the spec lets the user
color a list, a tag, or a calendar, the colors are already decided: don't ask. Add them as one
numbered set of tokens (`--swatch-1` … `--swatch-N`, 8–12 distinct hues) with a value for each
theme, register them the same way, and store the token's number with the record, never a hex value,
so the color follows the theme. Measure each in both themes before using it: at least 3:1 against
`--background` and `--card` for a dot, an icon, or a fill, and 4.5:1 for text. Use the set for
nothing but user data.

---

## Built-in variants first

**Incorrect:**

```tsx
<Button className="border border-input bg-transparent hover:bg-accent">
  Click me
</Button>
```

**Correct:**

```tsx
<Button variant="outline">Click me</Button>
```

---

## className for layout only

Use `className` for layout (e.g. `max-w-md`, `mx-auto`, `mt-4`), **not** for overriding component colors or typography. To change colors, use semantic tokens, built-in variants, or CSS variables.

**Incorrect:**

```tsx
<Card className="bg-blue-100 text-blue-900 font-bold">
  <CardContent>Dashboard</CardContent>
</Card>
```

**Correct:**

```tsx
<Card className="max-w-md mx-auto">
  <CardContent>Dashboard</CardContent>
</Card>
```

To customize a component's appearance, prefer these approaches in order:
1. **Built-in variants** — `variant="outline"`, `variant="destructive"`, etc.
2. **Semantic color tokens** — `bg-primary`, `text-muted-foreground`.
3. **CSS variables** — define custom colors in the global CSS file (see [customization.md](../customization.md)).

The one documented exception is a screen title the design colors or sizes on purpose: that goes in
`className` on `PageTitle` ([app-kit.md](./app-kit.md#page-layout--pagetsx)).

---

## No space-x-* / space-y-*

Use `gap-*` instead. `space-y-4` → `flex flex-col gap-4`. `space-x-2` → `flex gap-2`.

```tsx
<div className="flex flex-col gap-4">
  <Input />
  <Input />
  <Button>Submit</Button>
</div>
```

---

## Prefer size-* over w-* h-* when equal

`size-10` not `w-10 h-10`. Applies to icons, avatars, skeletons, etc.

---

## Prefer truncate shorthand

`truncate` not `overflow-hidden text-ellipsis whitespace-nowrap`.

Exception: **menu items** (`DropdownMenuItem`, `ContextMenuItem`, `MenubarItem`, and their
checkbox/radio/sub-trigger variants) use `whitespace-nowrap` **without** `truncate`. The menu grows
with the label; a wrapped or clipped action like "Remove from workspace" is a defect. See
[composition.md](./composition.md#menu-item-labels-stay-on-one-line).

---

## No manual dark: color overrides

Use semantic tokens — they handle light/dark via CSS variables. `bg-background text-foreground` not `bg-white dark:bg-gray-950`.

---

## Use cn() for conditional classes

Use the `cn()` utility from the project for conditional or merged class names. Don't write manual ternaries in className strings.

**Incorrect:**

```tsx
<div className={`flex items-center ${isActive ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
```

**Correct:**

```tsx
import { cn } from "@/lib/utils"

<div className={cn("flex items-center", isActive ? "bg-primary text-primary-foreground" : "bg-muted")}>
```

---

## No manual z-index on overlay components

`Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `DropdownMenu`, `Popover`, `Tooltip`, `HoverCard` handle their own stacking. Never add `z-50` or `z-[999]`.

---

## Use shimmer / scroll-fade utilities, not custom animations

For a live "thinking…" or loading-text shimmer, apply the `shimmer` utility. Don't author a custom `@keyframes` or a `bg-clip-text` gradient sweep.

For scroll-aware edge fading on a scroll container, use `scroll-fade` (and the axis variants `scroll-fade-x` / `scroll-fade-b`). Don't hand-roll mask gradients. The chat components already apply these internally: `Attachment` shimmers its title during upload, and `MessageScrollerViewport` fades its edges.

**Incorrect:**

```tsx
<span className="animate-pulse bg-gradient-to-r from-muted-foreground/40 via-foreground/70 to-muted-foreground/40 bg-clip-text text-transparent [animation:shimmer_1.6s_infinite]">
  Thinking…
</span>
```

**Correct:**

```tsx
<span className="shimmer">Thinking…</span>
```

## Probe

```bash
cd src/renderer
grep -rnE --include='*.tsx' --include='*.ts' \
  -e '(bg|text|border|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-[0-9]+' \
  -e 'dark:(bg|text|border)-' -e 'space-[xy]-' -e 'z-\[?[0-9]' -e 'bg-(success|warning)\b' \
  components hooks lib | grep -v '^components/ui/' | grep -v 'probe-ok:'
```

The command must print nothing: raw palette colors, manual `dark:` color overrides, `space-*`,
`z-index` on overlays, and filled `success`/`warning` surfaces are each a defect. Then screenshot the
surface in both themes — a token mistake usually shows in exactly one of them.
