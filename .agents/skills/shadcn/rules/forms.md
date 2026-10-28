# Forms & Inputs

## Contents

- Forms use FieldGroup + Field
- Settings groups: heading and description go OUTSIDE the card
- Settings rows: horizontal layout, capped control width
- Settings choices use Select — never ToggleGroup or Toggle
- InputGroup requires InputGroupInput/InputGroupTextarea
- Buttons inside inputs use InputGroup + InputGroupAddon
- Option sets outside settings (2–7 choices) use ToggleGroup
- FieldSet + FieldLegend for grouping related fields
- Field validation and disabled states
- A form inside a Dialog/Sheet also submits the page's form

---

## Forms use FieldGroup + Field

Always use `FieldGroup` + `Field` — never raw `div` with `space-y-*`:

```tsx
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" type="email" />
  </Field>
  <Field>
    <FieldLabel htmlFor="password">Password</FieldLabel>
    <Input id="password" type="password" />
  </Field>
</FieldGroup>
```

Use `Field orientation="horizontal"` for settings pages (see next section). Use `FieldLabel className="sr-only"` for visually hidden labels.

**Choosing form controls:**

- Simple text input → `Input`
- Dropdown with predefined options → `Select`
- Searchable dropdown → `Combobox`
- Native HTML select (no JS) → `native-select`
- Boolean toggle → `Switch` (for settings) or `Checkbox` (for forms)
- Single choice from few options → `RadioGroup`
- Choice in a settings section (any number of options) → `Select` — **never** `ToggleGroup`/`Toggle`
- Toggle between 2–5 options *outside settings* (toolbars, view switchers, filters) → `ToggleGroup` + `ToggleGroupItem`
- OTP/verification code → `InputOTP`
- Multi-line text → `Textarea`

---

## Settings groups: heading and description go OUTSIDE the card

On settings/preferences pages, group related settings into sections. **The section's title and
description belong *above* the card, not inside it** (no `CardHeader`/`CardTitle`/`CardDescription`).
The card then holds only the controls — a clean panel of rows. This is the Linear/Vercel settings
pattern: a plain heading + muted description label the group, and the card underneath is just the
control surface.

Use two different spacing scales:

- **Inside a group:** keep the heading close to its card (`section className="flex flex-col gap-3"`).
- **Between groups:** leave more breathing room (`gap-8` on the settings page column). Don't stack
  settings groups with the same tight `gap-3`/`gap-4` used inside a card; separate groups need to read
  as distinct sections.

**Incorrect:** title/description live in `CardHeader` inside the card, so every group's heading is
boxed and the page reads as a stack of titled boxes rather than labelled sections.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Profile</CardTitle>
    <CardDescription>This information is visible to your team.</CardDescription>
  </CardHeader>
  <CardContent>
    <FieldGroup className="gap-3"> … </FieldGroup>
  </CardContent>
</Card>
```

**Correct:** compose the project's `Settings*` primitives from `@/components/ui/settings` (a local
extension — see [structure.md](./structure.md#componentsui-is-the-registry-mirror--keep-it-pristine)).
They bake in everything below: the heading + description above the card, the `px-4` inset that lines
them up with the rows, `gap-3` inside a section, `gap-8` between sections, and the borderless
`bg-settings-section` surface. **Don't hand-roll a `section` + `h2` + `Card` or write a local
`SettingsSection` helper** — a copy drifts from the shared surface the moment either changes.

```tsx
import {
  SettingsPage,
  SettingsPageDescription,
  SettingsPageHeader,
  SettingsPageTitle,
  SettingsSection,
  SettingsSectionCard,
  SettingsSectionContent,
  SettingsSectionDescription,
  SettingsSectionFooter,
  SettingsSectionHeader,
  SettingsSectionTitle,
} from "@/components/ui/settings"

<SettingsPage render={<form onSubmit={save} />}>
  <SettingsPageHeader>
    <SettingsPageTitle>Profile</SettingsPageTitle>
    <SettingsPageDescription>How you appear to your team.</SettingsPageDescription>
  </SettingsPageHeader>

  <SettingsSection>
    <SettingsSectionHeader>
      <SettingsSectionTitle>Personal details</SettingsSectionTitle>
      <SettingsSectionDescription>This information is visible to your team.</SettingsSectionDescription>
    </SettingsSectionHeader>
    <SettingsSectionCard>
      <SettingsSectionContent>
        <FieldGroup className="gap-3"> … </FieldGroup>
      </SettingsSectionContent>
      {/* optional actions, right-aligned */}
      <SettingsSectionFooter>
        <Button type="submit" size="sm">Save changes</Button>
      </SettingsSectionFooter>
    </SettingsSectionCard>
  </SettingsSection>
</SettingsPage>
```

- **`SettingsPage` is a `div`; pass `render={<form onSubmit={…} />}`** when the page submits, rather
  than wrapping it in a `<form>` (Base UI `render`, never `asChild`).
- `SettingsSectionCard`/`Content`/`Footer` are thin wrappers over `Card`/`CardContent`/`CardFooter`
  and keep their `data-slot`s, so `Card`'s footer spacing still applies.
- Whatever goes inside `SettingsSectionContent` is up to the section — a `FieldGroup`, a `Table`, a
  list of rows. It's content, not a reason to skip the component.
- **A section-level action ("Create API key", "Add endpoint", a Monthly/Yearly toggle) goes in
  `SettingsSectionAction`** inside `SettingsSectionHeader` — it sits right of the title and
  description, bottom-aligned. Don't turn the header into a hand-rolled `flex-row justify-between`
  with a wrapper `div` around the title (the header is a grid; flex classes on it do nothing).

  ```tsx
  <SettingsSectionHeader>
    <SettingsSectionTitle>API keys</SettingsSectionTitle>
    <SettingsSectionDescription>Give each tool its own key.</SettingsSectionDescription>
    <SettingsSectionAction>
      <Button size="sm" variant="outline">
        <PlusIcon data-icon="inline-start" />
        Create API key
      </Button>
    </SettingsSectionAction>
  </SettingsSectionHeader>
  ```
- The page column (centring and `max-w-*`) belongs to the settings **layout**, not to `SettingsPage`
  — see [visual-polish.md](./visual-polish.md#constrain-and-center-settings--config-pages).

The rest of this section explains *why* the primitives look the way they do — read it before changing
`ui/settings.tsx`.

**Align the heading with the rows.** The card insets its content by `CardContent`'s `px-4` (16px), but
the heading block is a *sibling of the card*, flush with the card's outer edge — so without help the
heading sits ~16px to the **left** of the row labels and looks misaligned. Give the heading block the
**same `px-4`** so its left edge matches the first row's label. (Verify: the `h2` and the first
`FieldLabel` should report the same `getBoundingClientRect().left`.)

Apply the **same `px-4` to the page-level title/description** at the top of the settings column (the
`<h1>` + intro `<p>`), so the whole page shares one left edge — page title, section headings, and row
labels all line up.

Notes:

- **`Card` supplies its own `py-4`/`px-4`**, so a `Card` with only `CardContent` (no header) sits
  correctly padded — you don't need `CardHeader` for spacing.
- **Keep per-row labels/descriptions inside** the card (each `Field`'s `FieldLabel` +
  `FieldDescription`). Only the *group's* heading moves out.
- The group heading is a plain `h2` (`text-sm font-medium`) — don't reuse `CardTitle` outside a card.

---

## Settings rows: horizontal layout, capped control width

On settings/preferences/profile pages, lay out each setting as a **horizontal row** — label (and
optional description) on the left, control on the right — and **cap the control's width**. A text field
that stretches across the whole page (400–500px+) looks unfinished and is hard to scan. Keep single-line
controls to about `max-w-xs` (~300px) or a fixed width like `w-64`; **never let a control fill a wide
row**.

**Incorrect:** vertical field with a full-width input — the input balloons to the container width.

```tsx
<Field>
  <FieldLabel htmlFor="name">Full name</FieldLabel>
  <Input id="name" value={name} onChange={onChange} />
</Field>
```

**Correct:** horizontal row; the label grows (`flex-auto`) and the capped-width control aligns right.

```tsx
<Field orientation="horizontal">
  <FieldLabel htmlFor="name">Full name</FieldLabel>
  <Input id="name" className="w-64 shrink-0" value={name} onChange={onChange} />
</Field>
```

With a helper description, wrap the label + description in `FieldContent` (it grows and pushes the
control to the right):

```tsx
<Field orientation="horizontal">
  <FieldContent>
    <FieldLabel htmlFor="title">Title</FieldLabel>
    <FieldDescription>Your job title or role</FieldDescription>
  </FieldContent>
  <Input id="title" className="w-64 shrink-0" placeholder="Software engineer" />
</Field>
```

> **Trap: the label's flex comes from the `Field`, not the label.** `orientation="horizontal"` sets
> `*:data-[slot=field-label]:flex-auto` on the `Field`, and that selector beats a class on the label
> itself, so `<FieldLabel className="flex-none">` changes nothing. The label then shares the shrink
> with the control: `Input` has `min-w-0`, so a long label squeezes a `w-64` input below its width.
> Give a fixed-width control `shrink-0` (the label wraps instead), and to change the label's flex,
> put the variant on the `Field`: `<Field orientation="horizontal"
> className="*:data-[slot=field-label]:flex-none">`. A screenshot is the only place this shows.

**Tighten the row spacing: use `gap-3` on `FieldGroup`.** `FieldGroup` defaults to `gap-7` (~28px),
which is built for tall, standalone form sections — between compact settings rows it looks sparse and
disconnected. For settings/preferences pages, override it to `gap-3` (~12px) so the rows read as one
grouped list (Card/section provides the outer separation).

```tsx
<FieldGroup className="gap-3">
  <Field orientation="horizontal"> … </Field>
  <FieldSeparator />
  <Field orientation="horizontal"> … </Field>
</FieldGroup>
```

Rules of thumb:

- **Use `gap-3` on `FieldGroup` in settings/preferences views** (its `gap-7` default is too loose for
  horizontal setting rows). Keep the default only for spacious standalone forms (sign-up, onboarding).
- **~300px is a good ceiling** for names, emails, usernames, and `Select` triggers — cap with
  `w-56`…`w-72` or `max-w-xs`, not full width.
- **`Textarea` and rich editors** may be wider, but still cap them (e.g. `max-w-xl`) rather than
  full-bleed.
- Combine with the centered settings column — `<Page size="settings">` — from
  [visual-polish.md](./visual-polish.md#constrain-and-center-settings--config-pages).
- **Money is `MoneyInput`** (integer minor units, never a float `type="number"`), **a date is
  `DatePicker`**, and an editor page's save/discard/⌘S/leave-guard is **`SaveBar`** — all in the
  [app kit](./app-kit.md#editors).

---

## Settings choices use Select — never ToggleGroup or Toggle

Inside a settings section (anything in a `SettingsSectionContent`), a setting that picks one value from
a set — theme, density, default view, digest frequency, role — is a **`Select` drop-down**, even with
only two or three options. **Don't use `ToggleGroup`/`ToggleGroupItem` or a standalone `Toggle` in a
settings row**:

- A segmented control is as wide as its labels, so it breaks the capped, right-aligned control
  column (`w-64`) every other row uses, and it grows with each new option or longer translation.
- Its height and chrome don't match the `Input`/`Select`/`Switch` controls in neighbouring rows.
- It reads as a view switch that acts immediately, not as a stored preference.

On/off settings are still a `Switch` (see "Choosing form controls" above) — not a `Toggle`.

**Incorrect:**

```tsx
<Field orientation="horizontal">
  <FieldContent>
    <FieldTitle id="pref-density">Interface density</FieldTitle>
    <FieldDescription>Compact fits more rows on screen.</FieldDescription>
  </FieldContent>
  <ToggleGroup aria-labelledby="pref-density" value={[density]} onValueChange={…}>
    <ToggleGroupItem value="comfortable" size="sm">Comfortable</ToggleGroupItem>
    <ToggleGroupItem value="compact" size="sm">Compact</ToggleGroupItem>
  </ToggleGroup>
</Field>
```

**Correct:** a `Select` with the same `w-64` cap as the other controls. Pass `items` so the trigger
shows the label, not the raw value (see [base-vs-radix.md](./base-vs-radix.md#select)).

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const DENSITIES = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
]

<Field orientation="horizontal">
  <FieldContent>
    <FieldLabel htmlFor="pref-density">Interface density</FieldLabel>
    <FieldDescription>Compact fits more rows on screen.</FieldDescription>
  </FieldContent>
  <Select items={DENSITIES} value={density} onValueChange={(value) => value && setDensity(value)}>
    <SelectTrigger id="pref-density" className="w-64">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        {DENSITIES.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  </Select>
</Field>
```

A long, flat list (languages, time zones) may use `NativeSelect` instead — it's still a drop-down.

**The one exception is the theme.** Appearance is a visual choice, so Settings → General shows it
as **preview cards** (System / Light / Dark), the way macOS does. Use the existing
`ThemePicker` (`components/settings/theme-picker.tsx`); don't build a `Select` for the theme or a
second picker. It's a `RadioGroup`: each card is a `Label` wrapping a hidden `RadioGroupItem`,
so clicks, arrow keys and the focus ring all work.

> **Trap: `sr-only` alone doesn't hide a `RadioGroupItem`.** The component's own `relative` class
> wins over `sr-only`'s `position: absolute`. The 16px radio stays in the layout and pushes
> whatever follows it down, here 22px. Use `className="sr-only absolute"`, and check with
> `getComputedStyle(radio).position` that it's `absolute`. The same applies to any component whose
> base classes set `position`. Its row is a `Field orientation="horizontal"`
with a `FieldTitle` the group is `aria-labelledby`. Every other single-choice setting is still a
`Select`.

---

## InputGroup requires InputGroupInput/InputGroupTextarea

Never use raw `Input` or `Textarea` inside an `InputGroup`.

**Incorrect:**

```tsx
<InputGroup>
  <Input placeholder="Search..." />
</InputGroup>
```

**Correct:**

```tsx
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"

<InputGroup>
  <InputGroupInput placeholder="Search..." />
</InputGroup>
```

---

## Buttons inside inputs use InputGroup + InputGroupAddon

Never place a `Button` directly inside or adjacent to an `Input` with custom positioning.

**Incorrect:**

```tsx
<div className="relative">
  <Input placeholder="Search..." className="pr-10" />
  <Button className="absolute right-0 top-0" size="icon">
    <SearchIcon />
  </Button>
</div>
```

**Correct:**

```tsx
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"

<InputGroup>
  <InputGroupInput placeholder="Search..." />
  <InputGroupAddon>
    <Button size="icon">
      <SearchIcon data-icon="inline-start" />
    </Button>
  </InputGroupAddon>
</InputGroup>
```

---

## Option sets outside settings (2–7 choices) use ToggleGroup

For toolbars, view switchers and filters — **not settings sections**, which use `Select` (see
[above](#settings-choices-use-select--never-togglegroup-or-toggle)). Don't manually loop `Button`
components with active state.

**Incorrect:**

```tsx
const [selected, setSelected] = useState("daily")

<div className="flex gap-2">
  {["daily", "weekly", "monthly"].map((option) => (
    <Button
      key={option}
      variant={selected === option ? "default" : "outline"}
      onClick={() => setSelected(option)}
    >
      {option}
    </Button>
  ))}
</div>
```

**Correct:**

```tsx
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

<ToggleGroup spacing={2}>
  <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
  <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
  <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
</ToggleGroup>
```

Label a toggle group outside a form row with `aria-label` or `aria-labelledby`:

```tsx
<ToggleGroup aria-label="Issue layout" spacing={2}>
  <ToggleGroupItem value="list">List</ToggleGroupItem>
  <ToggleGroupItem value="board">Board</ToggleGroupItem>
</ToggleGroup>
```

> **Note:** `defaultValue` and `type`/`multiple` props differ between base and radix. See [base-vs-radix.md](./base-vs-radix.md#togglegroup).

---

## FieldSet + FieldLegend for grouping related fields

Use `FieldSet` + `FieldLegend` for related checkboxes, radios, or switches — not `div` with a heading:

```tsx
<FieldSet>
  <FieldLegend variant="label">Preferences</FieldLegend>
  <FieldDescription>Select all that apply.</FieldDescription>
  <FieldGroup className="gap-3">
    <Field orientation="horizontal">
      <Checkbox id="dark" />
      <FieldLabel htmlFor="dark" className="font-normal">Dark mode</FieldLabel>
    </Field>
  </FieldGroup>
</FieldSet>
```

---

## Field validation and disabled states

Both attributes are needed — `data-invalid`/`data-disabled` styles the field (label, description), while `aria-invalid`/`disabled` styles the control.

```tsx
// Invalid.
<Field data-invalid>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" aria-invalid />
  <FieldDescription>Invalid email address.</FieldDescription>
</Field>

// Disabled.
<Field data-disabled>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" disabled />
</Field>
```

Works for all controls: `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroupItem`, `Switch`, `Slider`, `NativeSelect`, `InputOTP`.

---

## A form inside a Dialog/Sheet also submits the page's form

React's synthetic events bubble through the **component tree, not the DOM**. A `Dialog` or `Sheet`
is portalled to `<body>`, but if it's *rendered from inside* a page-level `<form>` — an editor with a
`SaveBar`, a settings page (`SettingsPage render={<form … />}`) — then submitting the dialog's own
`<form>` fires the dialog's `onSubmit` **and then the page's**. It passes type-checks and looks
fine; it silently saves the whole page. (Measured: saving a variant in the product editor's variant
sheet saved the entire product; adding a tax region in Settings → Taxes saved the Taxes page. Two
different agents hit it independently.)

**Incorrect:** the page form handles every submit that reaches it.

```tsx
<form onSubmit={saveProduct}>
  {/* … product fields … */}
  <VariantSheet>            {/* renders <form onSubmit={saveVariant}> inside a Sheet */}
</form>
```

**Correct:** each submit handler only reacts to its *own* form, and dialog handlers stop the event.

```tsx
const saveProduct = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  if (e.target !== e.currentTarget) return   // a nested (portalled) form bubbled up — not ours
  // …save
}

// in the dialog/sheet
<form
  onSubmit={(e) => {
    e.preventDefault()
    e.stopPropagation()                      // don't let it reach an enclosing form
    saveVariant()
  }}
>
```

Alternatively render the dialog *outside* the page `<form>` (as a sibling). Verify by submitting the
dialog with **Enter** and checking the page's SaveBar is still showing its unsaved state.

## Probe

- **Labels:** the unlabelled-control snippet in [accessibility.md](./accessibility.md#probe) prints
  nothing — every `Input`/`Select`/`Textarea` has a `FieldLabel htmlFor` or an `aria-label`.
- **Validation:** submit an invalid form; the control reads `aria-invalid="true"`, its `Field` has
  `data-invalid`, and a message is visible.
- **A form inside a Dialog/Sheet on a form page:** submit the dialog with **Enter** and read the
  page's `SaveBar` back — it must still show the page's own unsaved state, not "saved".
- **Settings screens:** `grep -rnE '<ToggleGroup|<Toggle ' src/renderer/components/settings | grep -v 'probe-ok:'` prints
  nothing (choices are `Select`, on/off is `Switch`, the theme picker is the one exception).

Enter submits and pending disables are exercised in [interaction.md](./interaction.md#probe).
