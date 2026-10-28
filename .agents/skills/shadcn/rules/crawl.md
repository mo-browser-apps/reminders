# Crash crawl: every control on a new screen

The single most damaging defect is a control that **crashes the app** (white screen, error overlay,
thrown exception) when clicked. It always passes `tsc`, and it slips through because only the happy
path was exercised — the sidebar profile button was never actually clicked.

**When:** a new screen, several new controls, or a new overlay — step 3 of the ladder in
[`mobrowser-testing/SKILL.md`](../../mobrowser-testing/SKILL.md). A single changed control gets
clicked on its own; a cosmetic change gets a screenshot. Launch and drive the app only as
`AGENTS.md` describes, and read "What the tooling cannot see" there first: the error listener,
`#root`, `:not([data-closed])`, and the open-menu trap all come from it.

## Contents

- What counts as a control
- What counts as a crash
- Common crash sources
- Probe

---

## What counts as a control

Everything a user can activate: buttons, icon buttons, menu triggers and every item inside, tabs,
links, row actions, switches/checkboxes/radios, sliders, avatars, sidebar items, the profile/account
button, `⋯` menus, pagination, close/dismiss buttons, popovers, drag handles. Opened surfaces count
too: open each menu, dialog, and popover, then exercise the controls *inside* it.

- **Clicking isn't the only activation.** A `NativeSelect` needs `agent select-option`; hover-only
  surfaces (`Tooltip`, `HoverCard`, row hover actions) need `agent hover` — a control you can only
  reach by hovering can crash just the same.
- **Every overlay must close and stay closed.** Open it, close it with Escape, open it again, close
  it with an outside click, and confirm it did not reopen. An overlay that can't be closed (one
  opened from a trigger's `onFocus`, which reopens on focus-return) is as severe as a crash
  ([interaction.md](./interaction.md#overlays-esc--outside-click-close-focus-trapped-and-returned)).
- **Toggles flip and flip back.** Destructive actions open their confirm dialog; you don't have to
  complete the deletion.

## What counts as a crash

An error overlay, a blank or white window, the view unmounting, an uncaught exception, or an
unhandled promise rejection. After each activation, check in this order:

1. `#root` child count — `0` means React unmounted; this is the check that catches render crashes.
2. The `window.__errors` listener from `AGENTS.md` — `Cannot read properties of undefined`,
   `X is not a function`, missing-provider errors, a `navigator.clipboard` rejection.
3. `agent console` — any error-level entry is a defect, even when the UI still looks fine; an empty
   console is **not** evidence of no crash.
4. `agent snapshot` — the app is still rendered and interactive.

A launch-time error counts: a 404, a failed import, or a React warning at mount is a defect before
anyone clicks.

## Common crash sources

Click the controls that touch these first:

- **Undefined or missing data** — a row or menu built from data that can be `undefined`, empty, or
  missing a field (a user with no avatar).
- **Missing provider/context** — a component whose provider isn't mounted (Tooltip, Sidebar, a
  store) throws on open. The profile/account button is the usual offender.
- **Null refs / not-yet-loaded state** — acting before data resolves.
- **Bad handler wiring** — `onClick={doThing()}` instead of `onClick={doThing}`, or an undefined
  handler.
- **Navigation to a route that isn't implemented** — renders nothing or throws.

## Probe

Arm the error listener, then crawl from inside the page in **one** `agent eval` that starts an async
crawl and stores its report on `window` (a long `eval` times out, so poll the report): iterate
visible `button`, `[role=tab]`, `[role=switch]`, `[role=checkbox]`, `[role=combobox]` and in-app
links; click each; after every click record `window.__errors`, the `#root` child count, and any
opened overlay (menu items that wrap, dialogs taller than the window); dispatch Escape; return to the
route. Then open each `⋯`, account, and row menu by hand and confirm every item is a single line
([visual-polish.md](./visual-polish.md#menu-items-never-wrap)).

Two traps:

- **The crawler edits data.** It toggles switches and clicks Save, so later screenshots show mutated
  state — reload the app before visual review, and never crawl a screen holding the user's real data
  (the launch uses the persistent profile; use a record you created for the check).
- **The unsaved-changes guard traps it.** Once a crawl dirties an editor, "Leave without saving?"
  blocks every later navigation and the crawl keeps clicking the same screen under a new route name.
  Detect the guard and choose **Discard**, and assert `location.hash` matches the route you meant to
  test before each click.

**Pass:** `root > 0`, `errors: []`, no error entries in `agent console`, every overlay closed and
stayed closed. **Report** coverage explicitly: "Exercised all N controls (sidebar items, profile
button, ⋯ row menus, tab switches, filter clear, dialog open/close); `#root` mounted, no uncaught
exceptions or rejections, no console errors." Nothing ships with a known crash: fix it, or flag it to
the user explicitly.
