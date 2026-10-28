# Interaction & Keyboard Affordances

The small behaviors that separate "works" from "feels great." These are invisible in a screenshot and
pass type-checks — you only find them by **exercising the UI** (type, press keys, click) and checking
the resulting state. Treat this as a bug hunt: assume an expected affordance is missing and look for it.

Prefer wiring these onto shadcn components; many already ship the behavior (see each rule). Several
are **fully built in the [app kit](./app-kit.md)** — `SearchField`, `ConfirmDialog` + `undoToast`,
`CopyButton`, `SaveBar`, `NoteComposer` — use those instead of re-implementing the behaviour.

## Contents

- Filter/search inputs: Esc clears, and offer a clear button
- Overlays: Esc + outside-click close, focus is trapped and returned
- Forms: Enter submits, Esc/Cancel dismisses, disable while pending
- Destructive actions confirm, and offer undo
- Inline editing: Enter commits, Esc reverts
- Async actions show pending state and can't double-fire
- Copy-to-clipboard must handle rejection
- Autofocus the primary control when a surface opens
- Debounce expensive filtering

---

## Filter/search inputs: Esc clears, and offer a clear button

A text filter should clear on **Escape** and expose a clear (✕) button when it has a value. Users
expect Esc to empty the field; doing nothing feels broken.

**Incorrect:** a bare `Input` with no keyboard affordance and no way to clear.

```tsx
<Input
  placeholder="Filter projects..."
  value={query}
  onChange={(e) => setQuery(e.target.value)}
/>
```

**Correct:** use the kit's `SearchField` — Esc clears (and blurs when already empty), a ✕ appears
when non-empty, it always has an accessible name, and `shortcut` makes `/` focus it. Don't rebuild
this with `InputGroup` + an `onKeyDown`; that's what it is.

```tsx
import { SearchField } from "@/components/ui/search-field"

<SearchField value={query} onValueChange={setQuery} placeholder="Filter projects" shortcut />
```

Filter *chips* are the kit's `FacetedFilter` (multi-select) and `DateRangePicker`
([app-kit.md](./app-kit.md#lists)).

> If the filter lives inside a `Command`/`CommandInput`, its clear/close keys are already handled —
> don't re-implement them.

---

## Overlays: Esc + outside-click close, focus trapped and returned

`Dialog`, `AlertDialog`, `Sheet`, `Drawer`, `Popover`, `DropdownMenu`, `Command` already close on
Escape and outside click, trap focus, and return focus to the trigger. **Don't disable this** (e.g.
by swallowing `onKeyDown`, or building a custom overlay out of a plain `div`). If you must build a
custom floating surface, replicate all of it: Esc to close, outside-click to dismiss, focus trap, and
focus restoration.

### Never open an overlay from a trigger's `onFocus` — it creates an un-closable reopen loop

This is a subtle, high-severity trap: **the overlay closes, then instantly reopens, so the app becomes
unusable.** When an overlay closes it **returns focus to the element that had it** (its trigger). If that
trigger opens the overlay on `onFocus`, the focus-return fires `onFocus` again → the overlay reopens →
Esc/outside-click can never win. Screenshots and "does it open?" checks pass; only pressing Esc reveals it.

**Incorrect:** a search field that opens the command palette on focus. Esc closes the dialog, focus
returns to the input, `onFocus` refires, the palette reopens — it can't be dismissed.

```tsx
<InputGroupInput placeholder="Search..." onFocus={openCommandPalette} />
```

**Correct:** a **button** trigger that opens on **click** (never receives focus-return as a re-trigger).
Style it like a search field if you want the look.

```tsx
<Button
  variant="outline"
  aria-label="Search"
  onClick={openCommandPalette}
  className="w-64 justify-between font-normal text-muted-foreground"
>
  <span className="flex items-center gap-2"><SearchIcon /> Search...</span>
  <Kbd>⌘K</Kbd>
</Button>
```

The same trap applies to opening overlays on `onMouseEnter`/hover of an element the overlay later returns
focus to. Open overlays from an explicit click/keyboard activation.

### A tooltip on an overlay's first focusable control eats the first Escape

Dialogs and sheets autofocus their first focusable element. If that element is a `Tooltip` trigger
(a `CopyButton`, an icon button with a hint), focusing it opens the tooltip, and the first **Escape**
closes the *tooltip* — the sheet needs a second press. Users read that as "Esc doesn't work".

- Don't make a tooltip-wrapped control the first focusable element of a `Dialog`/`Sheet` — put a real
  field or the primary action first, or move the copy button after the text it copies.
- Or point `initialFocus` at the element that should receive focus.
- Test it: open the overlay, press Escape **once**, and confirm it's gone.

### Popovers that navigate must close themselves

`Popover` content stays open when a button inside it calls `navigate()` — it doesn't close on item
click the way `DropdownMenu` does. Control `open` and close it before navigating (pattern in
[composition.md](./composition.md#overlay-height-and-navigation)).

### Open → Esc closes → open → outside-click closes → it STAYS closed

Every overlay you add or touch must pass this. Because a reopen loop looks fine until you try to leave,
**exercise the close paths, then confirm it stays closed** (don't just confirm it opens):

```bash
# open, then Escape
npm run -s agent -- eval "document.querySelector('header button[aria-label=Search]').click()"
npm run -s agent -- press-key --key Escape
npm run -s agent -- eval "!!document.querySelector('[role=dialog]:not([data-closed])')"   # expect false
# and a moment later it's still closed (no reopen loop)
npm run -s agent -- eval "!!document.querySelector('[role=dialog]:not([data-closed])')"   # expect false
```

> **Automation timing:** `.click()` schedules a React re-render — read the open/closed state in a
> **separate** `agent eval`, not in the same expression, or you'll see stale state. To wait for the
> render deterministically instead of guessing a delay, use
> `agent wait-for --selector '[role=dialog]'` (or `--text`, `--timeout <ms>`).

---

## Forms: Enter submits, Esc/Cancel dismisses, disable while pending

- Wrap fields in a `<form>` and use a `type="submit"` button so **Enter** submits.
- A form in a `Dialog` dismisses on **Esc**/Cancel (built in) — Cancel should also reset the draft.
- While submitting, disable the submit button and show a `Spinner` (no `isLoading` prop — compose it),
  and guard against double submission.

**Incorrect:** click-only handler, submit fires twice, no pending state.

```tsx
<Button onClick={save}>Save</Button>
```

**Correct:**

```tsx
<form onSubmit={handleSubmit}>
  {/* fields */}
  <Button type="submit" disabled={pending}>
    {pending && <Spinner data-icon="inline-start" />}
    Save
  </Button>
</form>
```

---

## Destructive actions confirm, and offer undo

Delete/remove/reset must confirm first (never a bare button). Where feasible, after the action
offer **Undo**. Both halves are in the kit, `ConfirmDialog` and `undoToast`, with the usage and the
pending-state behavior in [app-kit.md](./app-kit.md#confirmdialog-and-undotoast). Don't compose a
fresh `AlertDialog` per call site.

---

## Inline editing: Enter commits, Esc reverts

For edit-in-place fields, **Enter** (or blur) commits the change and **Escape** reverts to the previous
value and exits edit mode. Losing the draft silently, or having no way to cancel, is a bug.

A whole-page editor is different: it keeps a draft and shows the kit's `SaveBar` (Save/Discard, ⌘S,
and a "Leave without saving?" guard on every navigation) — see [app-kit.md](./app-kit.md#savebar).

---

## Async actions show pending state and can't double-fire

Any action that triggers async work (save, load, invite) must reflect a pending state (disabled +
`Spinner`) and must not be re-triggerable while in flight. Report success/failure with a toast.

---

## Copy-to-clipboard must handle rejection

`navigator.clipboard.writeText` **rejects** with `NotAllowedError: Document is not focused` whenever
the window isn't focused (a background window, automation, a click that moved focus elsewhere). An
un-awaited promise with no `.catch` becomes an *unhandled rejection*, which the error listener from
`AGENTS.md` records as a defect.

**Incorrect:**

```tsx
<Button onClick={() => navigator.clipboard.writeText(code)}>Copy</Button>
```

**Correct:** the kit's `CopyButton` (icon button + tooltip + ✓ "Copied" state + error toast), or
`copyToClipboard(value)` — which resolves `true`/`false` and never rejects — from a menu item.

```tsx
import { CopyButton, copyToClipboard } from "@/components/ui/copy-button"

<CopyButton value={code} label="Copy discount code" />
<DropdownMenuItem onClick={() => void copyToClipboard(link)}>Copy link</DropdownMenuItem>
```

Inside a dialog or popover where it'd be the first focusable element, pass `tooltip={false}` (see
the tooltip-eats-Escape rule).

---

## Autofocus the primary control when a surface opens

When a `Dialog`, `CommandDialog`, or `Sheet` opens, focus the first meaningful control (search input,
first field) so keyboard users can act immediately. Most shadcn overlays autofocus their first
focusable element — don't fight it with `autoFocus` on the wrong element.

---

## Debounce expensive filtering

If typing in a filter triggers expensive work (large list re-render, async fetch), debounce it
(~200–300ms). Keep the input itself controlled and responsive; debounce only the derived work.

## Probe

Exercise, don't look — none of this shows in a screenshot:

- **Every overlay you added or touched:** open → Escape → gone; open → outside click → gone; still
  gone a moment later ([the check above](#open--esc-closes--open--outside-click-closes--it-stays-closed)).
  One Escape must do it: a tooltip on the first focusable control eats the first press.
- **Every filter:** type, then Escape clears it and the ✕ appears while it has a value.
- **Every form:** Enter submits; a second Enter while pending does nothing; Cancel resets the draft.
- **Every destructive action:** the confirm dialog opens; after confirming, an Undo toast appears.
- **Every copy control:** click it with the window unfocused — no unhandled rejection in
  `window.__errors`.

Read each state back with `agent eval` in a separate call from the click.
