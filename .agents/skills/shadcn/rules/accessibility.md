# Accessibility

Base UI gives you most of this for free — roles, focus traps, `aria-expanded`, keyboard navigation,
focus return. What it **can't** supply is anything that depends on your content: names for icon-only
controls, labels on inputs, alt text, heading order, and not encoding meaning in color alone. Those
are the defects that ship.

Like the rest of the skill, this is verifiable — the snippets at the bottom find most violations in
one `agent eval`.

## Contents

- Icon-only controls need an accessible name
- Every input needs a real label
- Errors must be announced, not just colored
- Never build a control out of a `div`
- Don't remove focus indication
- Images and decorative icons
- Heading order and landmarks
- Color is never the only signal
- Tooltips must be reachable by keyboard
- List semantics and mixed checkbox state
- Overlays: don't break what Base UI gives you
- Verify it

---

## Icon-only controls need an accessible name

A `Button` whose only child is an icon has **no accessible name** — a screen reader announces
"button". This is the single most common a11y defect in this codebase's component set, because icon
buttons are everywhere (toolbars, row actions, dialog close, sidebar triggers).

**Incorrect:**

```tsx
<Button size="icon" onClick={remove}>
  <TrashIcon />
</Button>
```

**Correct:** name the control; the icon stays decorative.

```tsx
<Button size="icon" aria-label="Delete project" onClick={remove}>
  <TrashIcon />
</Button>
```

- Prefer a **`Tooltip` plus `aria-label`** for toolbar icons — the tooltip helps sighted users, the
  label helps everyone else. A tooltip alone is not a name.
- Make the name **specific in a list**: `aria-label={`Delete ${project.name}`}`, not five identical
  "Delete" buttons.
- **Put the state the icon shows into the name.** A bell with an unread dot is
  `aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}` — the dot and count
  badge are invisible to a screen reader otherwise. Same for a filter button with an active-filter
  count, or a mute toggle (`aria-pressed`).
- Same rule for `InputGroupButton`, `AttachmentAction`, `SidebarTrigger`-style toggles, and any
  `DropdownMenuTrigger` rendered as an icon button.

---

## Every input needs a real label

**A placeholder is not a label** — it disappears on the first keystroke and is skipped by some screen
readers.

**Incorrect:**

```tsx
<Input placeholder="Email" />
```

**Correct:** `FieldLabel` with `htmlFor` matching the control's `id`.

```tsx
<Field>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" type="email" placeholder="you@example.com" />
</Field>
```

When the design has no room for a visible label (a search field, a filter), keep the label and hide it:
`<FieldLabel htmlFor="q" className="sr-only">Search</FieldLabel>`. For a bare `Input` outside a
`Field`, `aria-label` is the fallback.

`FieldLabel`/`Field` also wire up `FieldDescription` as the control's description — see
[forms.md](./forms.md).

---

## Errors must be announced, not just colored

`data-invalid` styles the field; `aria-invalid` tells assistive tech. **Both are required** (this is
the same pair as [forms.md](./forms.md) — here's why it matters): a red border alone is invisible to a
screen reader and to a red-green colorblind user.

```tsx
<Field data-invalid>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" aria-invalid aria-describedby="email-error" />
  <FieldDescription id="email-error">Enter a valid email address.</FieldDescription>
</Field>
```

- The error text must say **what's wrong and how to fix it** — "Invalid" is not a message.
- For an async result that appears without a focus change (a save failing), use a `sonner` toast — it
  renders in a live region — or `role="status"` on the message.

---

## Never build a control out of a `div`

A `div` with `onClick` is invisible to the keyboard and to assistive tech, and no amount of
`role`/`tabIndex` patching makes it as good as the real thing.

**Incorrect:**

```tsx
<div className="cursor-pointer rounded-md p-2 hover:bg-accent" onClick={open}>
  Open settings
</div>
```

**Correct:** use `Button` (with a variant that looks the way you want), or Base UI's `render` prop to
change the element while keeping the behavior.

```tsx
<Button variant="ghost" onClick={open}>Open settings</Button>

// Rendering as a different element — add nativeButton={false} for non-buttons:
<Button render={<a href="/docs" />} nativeButton={false}>Read the docs</Button>
```

See [base-vs-radix.md](./base-vs-radix.md) — `asChild` does nothing in this project.

---

## Don't remove focus indication

The project sets a global focus ring (`* { @apply border-border outline-ring/50 }` in `index.css`) and
every shadcn control ships focus-visible styling. **Never** add `outline-none`/`focus:outline-none`
without replacing it with an equally visible indicator — keyboard users lose their place entirely.

If a custom surface needs its own ring, use the `ring`/`ring-offset` utilities with the `--ring` token,
not a hand-picked color.

---

## Images and decorative icons

- **Meaningful image → `alt` describing it.** `AvatarImage` takes `alt` — use the person's name.
- **Decorative image → `alt=""`** so it's skipped, not announced as a filename.
- **Icons inside a labelled control are decorative** — they need nothing; the button's text or
  `aria-label` is the name. Don't add `aria-label` to the icon *and* the button (it gets announced
  twice).
- **`AvatarFallback` is required** (see [composition.md](./composition.md)) — it's also the a11y
  fallback when the image 404s.

---

## Heading order and landmarks

- **One `h1` per screen** — the kit's `PageTitle` — then `h2` for sections, `h3` beneath them —
  don't skip levels to get a smaller size. `CardTitle` is a `div`; it has no `render` prop, so
  give a section card's title `role="heading" aria-level={2}` when it is the section heading. Size is a `className` (`text-sm font-medium`), level is semantics. The settings-group
  heading pattern in [forms.md](./forms.md) is an `h2` for exactly this reason.
- **Use real landmarks**: `<header>` for the toolbar, `<main>` for the content region, `<nav>` inside
  the sidebar. The `Sidebar` component already renders appropriate elements — don't wrap it in a
  second `nav`.
- **`DialogTitle`/`SheetTitle`/`DrawerTitle` are mandatory** (see [composition.md](./composition.md));
  `sr-only` is fine when the design has no visible title.

---

## Color is never the only signal

Status, validity, and series identity must survive being printed in grayscale:

- **Status** → `Badge` with text, or an icon + label. Not a colored dot alone.
- **Validity** → `aria-invalid` + a message, not just a red border.
- **Chart series** → legend and direct labels, not hue alone — and this project's chart ramp makes
  that acute; see [data-display.md](./data-display.md#this-projects-chart-palette-is-a-sequential-ramp--measured-limits).

---

## Tooltips must be reachable by keyboard

A `Tooltip` opens on hover **and focus** — but only if its trigger can take focus.

- **Non-focusable triggers are mouse-only.** A tooltip on a `<time>`, `<span>` or `<Badge>` (full
  timestamp on hover, "why is this low?") never appears for keyboard users. Add `tabIndex={0}` and a
  visible focus style: `render={<time tabIndex={0} className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />}`.
- **Disabled controls get no pointer events**, so a tooltip explaining *why* a button or menu item is
  disabled ("Your role can't issue refunds") never shows. Put the trigger on a focusable wrapper:

  ```tsx
  <Tooltip>
    <TooltipTrigger render={<span tabIndex={0} className="inline-flex cursor-not-allowed" />}>
      <Button disabled>Refund</Button>
    </TooltipTrigger>
    <TooltipContent>Your role can’t issue refunds.</TooltipContent>
  </Tooltip>
  ```

  Same for a disabled `DropdownMenuItem`: wrap it (or render the reason as the item's description
  text, which needs no hover at all).

## List semantics and mixed checkbox state

- **`ItemGroup` is a real list.** It wraps each direct child in a `display: contents`
  `role="listitem"` (layout unchanged; an `Item` rendered as a link or button keeps its role), so
  don't add your own `role="listitem"` to `Item`s — just put them in the group. A child that already
  is `role="listitem"` is left alone, and so is an `ItemSeparator`. Put a separator *inside* the
  child it precedes (`<Fragment><ItemSeparator /><Item /></Fragment>`) rather than between them, or
  the list gets a direct child that isn't a listitem. Pass `role` to render a group that isn't a
  list.
- **`Checkbox` shows a filled minus for `indeterminate`** (`aria-checked="mixed"`). Still don't rely
  on the glyph alone for partial selection — show "3 selected".

## Overlays: don't break what Base UI gives you

`Dialog`, `AlertDialog`, `Sheet`, `Drawer`, `Popover`, `DropdownMenu`, and `Command` already trap
focus, close on Esc and outside click, and **return focus to the trigger**. Don't disable any of it,
and don't hand-roll a floating `div`. The reopen-loop trap (opening an overlay from a trigger's
`onFocus`) is both a usability bug and a keyboard trap — see
[interaction.md](./interaction.md#never-open-an-overlay-from-a-triggers-onfocus--it-creates-an-un-closable-reopen-loop).

Autofocus the first meaningful control when a surface opens, and make sure the tab order through a
dialog reaches the submit button.

---

## Probe

Run these against the live app (launched and driven as `AGENTS.md` describes) — they catch the
majority of real defects in seconds.

**Unnamed interactive controls** (the icon-button defect):

```js
// agent eval — anything listed here is announced as a bare "button"/"link".
[...document.querySelectorAll('button, a, [role="button"], [role="link"]')]
  .filter((el) => {
    const name = (el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || "").trim();
    return !name && !el.getAttribute("aria-labelledby");
  })
  .map((el) => el.outerHTML.slice(0, 80));
```

**Unlabelled form controls:**

```js
[...document.querySelectorAll("input, select, textarea")]
  .filter((el) => !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") &&
                  !(el.id && document.querySelector(`label[for="${el.id}"]`)))
  .map((el) => el.outerHTML.slice(0, 80));
```

**Images without alt, and heading order:**

```js
// `img.alt` is "" both for alt="" (decorative, fine) and for a missing attribute (a defect),
// so test the attribute itself.
({
  imagesMissingAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).map((i) => i.src),
  headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => h.tagName + ": " + h.innerText.slice(0, 40)),
})
```

**Keyboard reachability:** `agent press-key --key Tab` repeatedly and read
`document.activeElement.outerHTML` between presses — confirm every control is reachable, the order is
sensible, and focus never disappears into `body`.

An empty result from each snippet is the pass condition. Report the results as evidence, not as
"looks accessible".
