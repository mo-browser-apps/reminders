# Application menu

Source of truth: `node_modules/@mobrowser/api/docs/guides/guides/app-menu.md`. On macOS the default
menu is **browser-flavored** (File → Close Window, View → Back/Forward/Reload, a Developer menu); on
Windows and Linux a window starts with no menu bar at all. Replace or add a menu that fits the app;
keep only what the app actually needs.

**This project's implementation is `src/main/menu.ts`** (`installAppMenu(win)`, called from
`src/main/index.ts`). Extend that rather than building a menu inline.

## Rules of thumb

- **Keep an `editMenu` wherever there are text inputs** (search fields, forms) — it wires up
  Undo/Cut/Copy/Paste/Select-All and their ⌘ shortcuts for free. Dropping it silently breaks
  copy/paste in your inputs.
- **Drop browser chrome that doesn't apply** — Back/Forward/Stop, Save Page As, View Source for an
  app that isn't a browser.
- **Gate reload / DevTools to development** with `!app.packaged`, so end users don't get them but you
  keep them while building.
- **Custom items need a real `action`** — no dead menu items. Every `new MenuItem({...})` must do
  something visible when clicked: `About` opens Settings → About (see below), `Settings…` opens the
  Settings window, and so on. If a command isn't implemented yet, leave the item out. Don't ship it
  with an empty `action`.
- **Enabled means "choosing this acts now".** Every item's enabled state comes from the app's
  current state (selection, focus, open dialogs, loaded data). It is never left at the default
  `true`. **Adding an item? Follow [Adding a menu item](#adding-a-menu-item).** See
  [Enablement](#enablement--enabled-only-when-it-would-act) for why.
- **Every app has a working About item and a Settings… item.** See
  [About](#about--required-never-a-dead-item) and [settings-window.md](./settings-window.md).
- **Two different APIs per platform.** On **macOS** the menu belongs to the *application*:
  `app.setMenu(menu)`. On **Windows and Linux** each window owns its own menu bar:
  `win.setMenu(menu)` (and `win.setMenu(null)` removes it). So gate on the platform, but don't
  simply drop the others: a `darwin`-only guard leaves Windows and Linux windows with no menu bar,
  so no Edit menu, About or Settings….
- **`macAppMenu` is macOS-only.** The `'macAppMenu'` role and the `'macHideApp'`/`'macHideOthers'`/
  `'macShowAll'`/`'quit'` item roles belong in the macOS menu only — don't put them in a Windows or
  Linux window menu.

## Adding a menu item

A new item isn't finished when it shows up in the menu and runs from a click. Its enabled state is
part of the feature. Do every step:

1. **Write down when the command can act.** List every state where choosing it would do nothing: no
   note selected, empty list, focus in the wrong place (list, title, search field), nothing
   selected, a dialog open, data still loading, wrong mode (Preview vs Edit). If that list is empty,
   say so in a comment: the item is always enabled on purpose, like About and Settings….
2. **Put that condition in one function** in the renderer, next to the command handler (the
   `AppCommands` component, see [Renderer commands](#renderer-commands-the-menuservice-pattern)),
   for example `formatTarget()` or `dialogOpen()`. The handler calls it and returns early when it
   says no.
3. **Report it to the menu.** If no existing `MenuState` field matches, add one to
   `src/renderer/proto/menu.proto` and run `npm run gen`. Fill it in `AppCommands` by calling the
   same function from step 2, never a second, looser condition. State that isn't React state
   (focus, the DOM) needs a re-render trigger: the shipped `useDialogOpen()` for dialogs, or a hook
   that listens for `focusin`/`focusout` for focus.
4. **Create the item with `command(...)`** in `src/main/menu.ts`, which builds it disabled and
   dispatching, add its value to the `Command` enum in `menu.proto` (then `npm run gen`), and
   enable it in `update()` from the reported field. Combine it with `live` (`ready && !modal`) unless the command works behind
   dialogs. [A worked example](#a-worked-example) shows every step in code.
5. **If the label or check mark depends on state** (Show/Hide Sidebar, Sort ▸ choices), set it in
   `update()` too.
6. **Verify each state from step 1** with the [Probe](#probe) below. Drive the app into the state,
   check the reported flag, then check that the item acts when enabled.

> **Trap: the default is `enabled: true`.** `new MenuItem({...})` and `new CheckboxMenuItem({...})`
> are enabled unless told otherwise. An item added without steps 1–4 compiles, appears, responds
> to clicks, and passes every test that only clicks it in the happy state. It's still wrong in
> every other state.

## Enablement — enabled only when it would act

An enabled menu item promises that choosing it now, given what's selected and where the focus is,
does something. An item that is enabled but gets ignored is a dead item for that moment. Users can't
tell it apart from a broken app. An example of the bug: a note is selected in the list, Format ▸
Bold is enabled, and choosing it does nothing because no text has focus.

Custom items hand their command to the renderer (`dispatch`). The renderer's handler then decides
whether to act, and it often bails out: no selection, focus in the wrong place, a dialog open. **The
menu has to report those same conditions**, or it promises actions the handler throws away:

- **One predicate per guard, shared by the handler and the reported state.** Put each bail-out
  condition in a function, such as `formatTarget()` and `dialogOpen()` next to the handler in
  `AppCommands`. The command handler calls it to decide whether
  to act. The `MenuState` the renderer sends calls the same function to decide what to enable. Never
  write a second, looser condition for the menu: that drift is how this bug happens. A
  `ready && hasNote && editing` check enabled Format while the handler also required focus in the
  note body.
- **Focus-dependent commands follow focus.** Commands that act at the caret (formatting, Insert
  Link) are enabled only while the editor that receives them has focus. They are disabled when focus
  is in a list, the title field, the search field, a toolbar button, or nothing, because there's no
  caret to show where the change would land. Focus is DOM state, not React state, so recompute the
  report on `focusin`/`focusout` (deferred one frame, so focus can settle).
- **A dialog disables every command it blocks.** If the handler ignores commands while a dialog is
  open, report `modal` and disable those items. Watch dialogs opening and closing with a
  `MutationObserver` on `data-open`/`data-closed`: focus events alone miss a dialog whose return
  focus target was removed.
- **Checkbox and radio items too.** A Sort ▸ choice that a dialog would block gets disabled like any
  other command (`CheckboxMenuItem` takes `enabled`).
- **A click doesn't toggle the check mark.** Clicking a `CheckboxMenuItem` runs its `action` and
  leaves `checked` as it was, on every platform; only `setChecked` changes it. Set it in `update()`
  from the reported state, like the label, and not in the `action`: the renderer may ignore the
  command (a dialog is open), and then the mark would show a state the app doesn't have.
- **Start disabled.** Create renderer-driven items with `enabled: false` and let the first state
  report enable them, so nothing is live before the renderer has loaded.
- **The exceptions are items the main process handles itself.** About and Settings… call
  `openSettings` directly and work in every renderer state, so they're always enabled. Native role
  items (`'copy'`, `'undo'`, …) get their enablement from the OS and Chromium.

A caret with an empty selection still counts as "would act" for inline formatting. Bold with a
caret inserts `****` and puts the caret between the markers, ready for typing, as TextEdit and
Notes do. Disable on focus, not on selection.

## About — required, never a dead item

Users click **About** to check which version they're running. If it does nothing, they assume the
app is broken. This bug keeps coming back, for a predictable reason:

> **Trap: don't copy the About item from `app-menu.md`.** The vendored guide's sample has
> `action: (item: MenuItem) => {}`. That is an **empty placeholder**, not a working item. Copying it
> ships an About item that compiles, shows up in the menu, and does nothing when clicked. Replace the
> empty body with a real dialog every time.

> **Trap: `app.showMessageDialog` can't show the app icon.** MōBrowser draws message dialogs as
> its own window-modal panel. With any `type`, or with none, that panel has **no icon**, and
> `MessageDialogOptions` has no icon field. An About built on it shows text only, which users read
> as unfinished. So About is drawn in the **renderer**, where you control the icon.

**About is a page of the Settings window.** `About <App>` opens Settings on its About section
(`openSettings('about')`), and **Settings…** (⌘,) opens it on General. One window holds all the
app-level information. See [settings-window.md](./settings-window.md) for the window, its sections
and the About page's layout.

What the About page must show (the content rules don't change with where it's drawn):

- **The app icon, name and version**, plus the copyright when it's non-empty. (This app leaves
  the description out of About.)
- **Show the app's own icon image. Never redraw it or swap in a lucide icon.** About shows
  `src/renderer/public/app.png` (512px, `src="./app.png"`). The bundle icons the Dock and taskbar
  use are separate files (`assets/app.png`, `app.icns`, `app.ico`): when the app icon changes,
  update `public/app.png` and the bundle icons together, so About matches the Dock.
- **Read the text from `app.*` in the main process. Never hardcode it.** Return `app.name`,
  `app.version`, `app.description` and `app.copyright` (all from `mobrowser.conf.json`) through an
  IPC call such as `AppService.GetAppInfo`. Never write a literal `'1.0.0'`.
- **Keep About and Settings… always enabled.** They must work before data loads and on error
  screens, so they call `openSettings` in the main process directly rather than going through a
  renderer command.
- **Reachable on every platform.** On macOS, About and Settings… go in `macAppMenu`. On Windows and
  Linux, `macAppMenu` doesn't exist, so put Settings… in **File** and About in a **Help** menu. A
  mac-only About leaves Windows and Linux users without one.

## Pattern

The full, working version is `src/main/menu.ts` — **read it and extend it** instead of writing a new
one. Its shape:

```ts
import { app, BrowserWindow, Menu, MenuItem, MenuOptions, MenuWithRole } from '@mobrowser/api'

export function installAppMenu(win: BrowserWindow, dispatch: MenuDispatch): void {
  // Always enabled, handled in the main process: see settings-window.md.
  const about = new MenuItem({ id: 'about', label: `About ${app.name}`, action: () => openSettings('about') })
  const settings = new MenuItem({
    id: 'settings', label: 'Settings…', shortcut: 'CommandOrControl+,', action: () => openSettings('general'),
  })
  if (process.platform === 'darwin') {
    // macOS: the menu belongs to the application.
    app.setMenu(new Menu({ items: [macAppMenu(about, settings), fileMenu(), editMenu(), viewMenu(), windowMenu()] }))
  } else {
    // Windows and Linux: each window owns its menu bar — no macAppMenu/windowMenu: Settings… in File, About in Help.
    win.setMenu(new Menu({ items: [fileMenu(settings), editMenu(), viewMenu(), helpMenu(about)] }))
  }
}

function macAppMenu(about: MenuItem, settings: MenuItem): MenuWithRole {
  return new MenuWithRole({
    role: 'macAppMenu',
    items: [about, 'separator', settings, 'separator', 'macHideApp', 'macHideOthers', 'macShowAll', 'separator', 'quit'],
  })
}

function helpMenu(about: MenuItem): Menu {
  // A plain labelled menu, as in the guide's Windows example.
  return new Menu({ label: 'Help', items: [about] })
}

function viewMenu(): Menu {
  // Zoom and full screen ship to users; only reload/DevTools are development-gated.
  const items: MenuOptions['items'] = ['zoomReset', 'zoomIn', 'zoomOut', 'separator', 'fullScreen']
  if (!app.packaged) items.push('separator', 'reload', 'reloadBypassCache', 'devTools')
  return new Menu({ label: 'View', items })
}
```

The sketch leaves out the app's own commands. The template has none yet; add them with the
pattern below.

## Renderer commands: the MenuService pattern

Most app commands (New, Delete, Toggle Sidebar, Format ▸ Bold) act on renderer state, so the main
process only forwards them. **The template ships this channel with no commands yet.** Add the
app's commands to it; don't build a second one.

| Piece | File | What it does |
| --- | --- | --- |
| Contract | `src/renderer/proto/menu.proto` | the `Command` enum (one value per command, the one list both processes use), `MenuCommand`, `MenuState` (one field per guard), and `MenuService` with `OnCommand`, `SetState`, and `Dispatch` |
| Menu | `src/main/menu.ts` | `command(Command.…, label, shortcut)` builds an item disabled and dispatching; `installAppMenu` returns `{ update(state) }`, which enables and labels the items |
| Wiring | `src/main/index.ts` | `ipc.registerService(MenuServiceDescriptor)` with no implementation returns the publisher of the runtime-owned `OnCommand` stream; a second `registerService` implements `SetState` (calls `update`) and `Dispatch` (shows the main window and publishes) |
| Renderer plumbing | `src/renderer/hooks/use-menu-commands.ts` | `useMenuCommands` subscribes to the stream, `useMenuState` reports state (and keeps it on `window.__menuState` in development), `claimCommand` de-duplicates, `useDialogOpen` tracks dialogs |
| Commands | `src/renderer/components/home/app-commands.tsx` | `AppCommands` (renders `null`, mounted by the main screen) runs each command, handles the same shortcuts on the page, and reports the state |

To add a command, follow [Adding a menu item](#adding-a-menu-item); every step has its place in
the files above.

### A worked example

View ▸ Hide Sidebar / Show Sidebar (⌥⌘S), toggling a sidebar the main screen owns. It is
always available except behind a dialog, and its label follows the sidebar.

`src/renderer/proto/menu.proto` (then `npm run gen`):

```proto
enum Command {
  COMMAND_UNSPECIFIED = 0;
  // View ▸ Hide Sidebar / Show Sidebar.
  COMMAND_TOGGLE_SIDEBAR = 1;
}

message MenuState {
  bool ready = 1;
  bool modal = 2;
  // Toggle Sidebar's label: "Hide Sidebar" while it's open.
  bool sidebar_open = 3;
}
```

`src/main/menu.ts`: the first command uses `dispatch` and `state`, so drop their underscores, and
import `Command` and `commandToJSON` as values (`import { Command, commandToJSON, type MenuState }`)
and `type Shortcut` from `@mobrowser/api`.

```ts
export function installAppMenu(win: BrowserWindow, dispatch: MenuDispatch): AppMenu {
  // A renderer command: disabled until the renderer reports it can act.
  const command = (id: Command, label: string, shortcut?: Shortcut) =>
    new MenuItem({ id: commandToJSON(id), label, shortcut, enabled: false, action: () => dispatch(id) })
  const toggleSidebar = command(Command.COMMAND_TOGGLE_SIDEBAR, 'Hide Sidebar', 'CommandOrControl+Alt+S')
  // … About, Settings…, File and Edit as shipped …
  const viewMenu = new Menu({ label: 'View', items: [toggleSidebar, 'separator', ...appViewItems()] })
  // … setMenu as shipped …
  return {
    update(state: MenuState) {
      // Nothing runs behind a dialog, and nothing before the main screen is ready.
      const live = state.ready && !state.modal
      toggleSidebar.setEnabled(live)
      toggleSidebar.setLabel(state.sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar')
    },
  }
}
```

`src/renderer/components/home/app-commands.tsx` (import `Command` as a value, `React`, and
`hasModKey` from `@/lib/platform`); the main screen owns `sidebarOpen` and renders
`<AppCommands sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((open) => !open)} />`:

```tsx
export function AppCommands({ sidebarOpen, onToggleSidebar }: { sidebarOpen: boolean; onToggleSidebar: () => void }) {
  const modal = useDialogOpen()

  const execute = (command: Command, source: CommandSource) => {
    if (!claimCommand(command, source)) return
    if (dialogOpen()) return
    switch (command) {
      case Command.COMMAND_TOGGLE_SIDEBAR:
        onToggleSidebar()
        break
    }
  }
  useMenuCommands((command) => execute(command, "menu"))

  // The menu binds the same keys, but a key press sent to the page (an e2e test, `agent press-key`)
  // never reaches a native menu, so the page handles them too.
  const executeRef = React.useRef(execute)
  React.useLayoutEffect(() => {
    executeRef.current = execute
  })
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || !hasModKey(event)) return
      if (event.altKey && !event.shiftKey && event.code === "KeyS") {
        event.preventDefault()
        executeRef.current(Command.COMMAND_TOGGLE_SIDEBAR, "page")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useMenuState({ ready: true, modal, sidebarOpen })

  return null
}
```

Match `event.code`, not `event.key`: with ⌥ held, macOS turns `key` into another character. An
e2e test presses the same shortcut (`page.keyboard.press("ControlOrMeta+Alt+KeyS")`) and checks
the sidebar, since it can't click the menu item.

- **A bound shortcut can arrive twice.** The native menu consumes a shortcut it binds, but a key
  press sent to the page (an e2e test, `agent press-key`) never reaches the menu, so `AppCommands`
  handles the same keys on the page. `claimCommand(command, source)` drops a second delivery of one
  keystroke, the same command from the *other* source within 150 ms, and lets two quick presses on
  the same path both run.
- **Nothing runs behind a dialog.** `execute` returns early while `dialogOpen()`, and `modal` in the
  reported state disables the items, both from the same check.
- **A window without the app's data** (Settings) runs a command through `ipc.menu.Dispatch(...)`
  ([settings-window.md](./settings-window.md#actions-that-need-the-main-windows-data)).
- **Report state from React state or a DOM observer**, never from a value read once: focus and
  dialogs are DOM facts, so give them a re-render trigger like `useDialogOpen()`.

> **Don't dev-gate the whole View menu.** Zoom and Enter Full Screen are ordinary app features users
> expect in a release build; only reload, reload-bypassing-cache, DevTools and View Source belong
> behind `!app.packaged`.

Standard role strings (`'undo'`, `'reload'`, `'fullScreen'`, `'macHideApp'`, …) are enumerated in
`app-menu.md` and typed as `MenuRole` / `MenuItemRole` in
`node_modules/@mobrowser/api/mobrowser.d.ts`. Use the exact strings from that table — don't guess.
Note there is **no `'closeWindow'` equivalent in the Window menu** (only `'minimizeWindow'` and
`'maximizeWindow'`), so keep a File menu with `'closeWindow'` if you want ⌘W.

## Probe

The agent can't click native menus, so check them statically and through what the renderer reports.

- **No dead items.** The command must print nothing:

  ```bash
  grep -rnE "action: *\([^)]*\) *=> *\{ *\}" src/main
  ```

- **About and Settings… are wired.** `About <App>` calls `openSettings('about')` and `Settings…`
  calls `openSettings('general')` on every platform (`macAppMenu` on macOS; File and Help on
  Windows and Linux). Then open About for real — with desktop control, or by asking the user to
  click it on each configured platform — and read the page back from the Settings window
  (`agent select-window --url "#/settings"`): the `main` text shows the right name and version, and
  the icon's `naturalWidth` is not `0` (a broken image), in light and dark mode.
- **Edit menu.** With the caret in a renderer text field, ⌘C/⌘V work (a missing `editMenu` breaks
  them silently). Reload/DevTools items exist in a dev run and are absent from a packaged build
  (`npm run build`).
- **Enablement follows focus and dialogs.** Read what the renderer last reported with
  `agent eval "JSON.stringify(window.__menuState)"` (the dev hook in
  [Renderer commands](#renderer-commands-the-menuservice-pattern)); `undefined` means the hook is
  missing, so add it rather than logging temporarily. Drive each state from
  [Adding a menu item](#adding-a-menu-item) step 1 and read the reported flags after each: an item selected in a list (Format disabled), the caret in the editor
  (enabled), a search field (disabled), focus on a toolbar button (disabled), a dialog open
  (`modal`, every command disabled) and closed again. The menu reads the flags directly, so checking
  them covers the native items.
- **Native dialogs** opened from menu commands are recorded in `agent dialogs` (see `AGENTS.md`);
  queue an answer with `agent answer-dialog` before triggering them. A visible window shows an
  unqueued dialog to the user, so a dialog check can be handed to them in the running app.
- A verification click that edits content (a Format command with the caret in a document) edits the
  user's data: exercise editing commands in the e2e suite, or on a record you created for the check.
