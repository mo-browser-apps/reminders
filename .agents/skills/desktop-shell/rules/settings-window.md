# Settings window (General, About, Import & Export)

A desktop app's preferences live in a **Settings window**, opened with **Settings…** (⌘, on macOS).
**About** is a section of that window, not a separate dialog. Every app built here gets one, even
with only a few settings: theme and About apply everywhere, and launch at login on macOS and
Windows.

**This project's implementation:**

- `src/main/settings.ts`: the window, the prefs and `SettingsService`.
- `src/main/updates.ts`: update checks.
- `src/renderer/components/settings/*`: the UI.
- `test/e2e/settings.test.ts`: the regression tests.

**Read them and extend them.**

## Shape: a second, resizable window

- **One instance.** `openSettings(section)` creates the window or, if it's open, navigates it and
  brings it forward (`restore()` if minimized, `show()`, `focus()`). Clear the reference on
  `'closed'`.
- **Compact, slightly portrait default size:** `setSize({ width: 560, height: 600 })`. Hide the
  titlebar **before** `setSize`
  (see [window.md](./window.md#decorations--macos-traffic-lights-two-halves--keep-in-sync)), or
  the window comes out ~32px shorter than asked on macOS.
- **Resizable, with a minimum:** `setResizable(true)` plus `setMinimumSize({ width: 520, height: 400 })`.
  The minimum is the smallest size where every section still lays out; the minimum *size* is the
  outer window. Below the content height the section body scrolls (`overflow-y-auto`). When the
  window is narrow, rows that put a label beside wide content must wrap instead of clipping (see
  the theme row below).
- **Same chrome as the main window.** On macOS the titlebar is hidden and the traffic lights are at
  `TRAFFIC_LIGHT_POSITION` (`src/main/window-chrome.ts`) over the sidebar's empty 48px top row. On Windows and Linux, don't give it the
  main window's menu: a new window starts with no menu bar, which is right for Settings.
- **Same renderer, its own route.** Load `${app.url}#/settings/<section>`. `App.tsx` picks the
  screen by `useRoute().segments[0]`. Mount data providers (stores, databases) **only** for the main
  screen, so the Settings window doesn't open the app's data a second time.
- **Use the same navigation guard** (`openPopup`/`navigation` handlers) as the main window.
- If the app quits when its main window closes, close Settings too.

## Renderer layout

- `SidebarProvider` with `Sidebar collapsible="none"`. The window is below the 768px mobile
  breakpoint, so an `offcanvas` sidebar would turn into an overlay sheet.
- **The sidebar is resizable.** It sits in the kit's `ResizablePanelGroup`: a `ResizablePanel`
  (160px default, 140–240px, `groupResizeBehavior="preserve-pixel-size"`), a `ResizableHandle` as
  the 1px divider (no `border-r` on the sidebar), and a content panel with `minSize="280px"`, so
  the 520px window minimum fits the widest sidebar. `useDefaultLayout` saves the dragged width to
  `localStorage` (`onlySaveAfterUserInteractions`). The agent can't drag: check the limits with the
  handle focused (`Home`/`End`), and a pointer drag over CDP.
- **Respond to the window, not the viewport breakpoints.** A row with a label beside wide content
  wraps exactly when the content stops fitting: `flex-wrap justify-between gap-x-4 gap-y-3` with
  `*:data-[slot=field-label]:flex-none` on the `Field`, not on the label (the theme row;
  [forms.md](../../shadcn/rules/forms.md) has the trap). Don't stack at a fixed
  width (`@max-[22rem]:flex-col`): the user sees the cards jump below the label while there's still
  room beside it. `md:`/`lg:` don't help either: the whole window is below them.
- On macOS, an empty `SidebarHeader className="app-drag-region h-12"` holds the traffic lights.
- Section links are `SidebarMenuButton isActive render={<Link to="/settings/<id>" />}`.
- On the right: a `h-12` `app-drag-region` header with `SettingsPageTitle`, then a scrolling body
  with the kit's `SettingsPage` / `SettingsSection*`. Section headings sit outside the cards, and
  rows are `Field orientation="horizontal"`.
- **Sections:**
  - **General:** Launch at login (macOS and Windows), Show window at startup (macOS), Check for
    updates automatically (with an update server), each a `Switch`, then Appearance → Theme. Hide a
    row that doesn't apply, and the whole card when none does.
  - **Import & Export:** whatever the app can import or export. The template has no data, so it
    ships without this section; add it (between General and About) once the app has something to
    import or export.
  - **About:** a centered app icon (80px), the name, then `Version x.y.z (Apple Silicon)` in
    smaller type (`text-xs`), Check for Updates…, and the copyright at the bottom. No description.

## Where each setting lives

| Setting | Stored by | API |
| --- | --- | --- |
| Theme | MōBrowser (kept between launches) | `app.theme` / `app.setTheme()`; every window follows it. |
| Launch at login | the OS | `app.loginItemSettings.openAtLogin` / `app.setLoginItemSettings({ openAtLogin })`. Read it back from the OS; don't mirror it in prefs. **macOS and Windows only:** on Linux the setter does nothing, so hide the row there (`isLinux` from `@/lib/platform`). |
| Show window at startup | main `prefs` (`getBoolean(key, true)`, then `persist()`) | Read before the first `win.show()`. **macOS only:** with the window hidden, the app reopens through `app.on('activated')` (Dock click), and Windows/Linux have no such event. Hide the row there and ignore the pref. |
| Check for updates automatically | main `prefs` | Only when an update server is configured (below). Check a few seconds after launch, not during it. |

The main process owns everything it needs **before a window loads**: use `prefs`, not
`localStorage`. Each setter RPC returns the full `Settings` message so the UI re-renders from the
source of truth.

> **Trap: `app.updateServerUrl` isn't readable at runtime.** The API has no such property. Bake it in
> at build time: in `vite.config.ts`'s main config, add
> `define: { __UPDATE_SERVER_URL__: JSON.stringify(<conf.app.updateServerUrl>) }`, and declare it
> in `src/main/env.d.ts`. When it's empty, **hide** the update switch and the Check for Updates
> button. Don't show controls that can't work. When it's set, add the `'checkForUpdates'` menu role
> (app menu on macOS, Help on Windows and Linux). The background check and the About button use
> `app.checkForUpdate(url)` → `download()` → `app.restart()`, with native dialogs.

## Actions that need the main window's data

The Settings window has no data store, so Import/Export (and similar) **run in the main window**.
Add a `MenuService.Dispatch(MenuCommand)` RPC that shows and focuses the main window and emits the
command on the menu-command stream ([menu.md](./menu.md#renderer-commands-the-menuservice-pattern)). The main window's command handler then runs it, the
file dialog opens there, and the result toast appears where the data changed.

## Menu wiring

- macOS app menu: `About <App>` → `openSettings('about')`, the `'checkForUpdates'` role (if
  configured), separator, `Settings…` with `shortcut: 'CommandOrControl+,'` →
  `openSettings('general')`.
- Windows and Linux: `Settings…` in **File**, and `About <App>` in **Help**.
- Also handle ⌘/Ctrl+, in the main window's keyboard handler: a key press sent to the page (an e2e
  test, `agent press-key`) never reaches the native menu.
- Remove any appearance/theme items from the View menu and other menus. The theme lives in Settings
  only.

## Probe

- Open Settings from the real menu, using desktop control or by asking the user, and with ⌘, in
  the main window. Then **`agent select-window --url "#/settings"`** (by URL, never by index).
- Click every section and every control. Pick Dark and check that
  `matchMedia('(prefers-color-scheme: dark)').matches` is true in both windows. Use the arrow keys in
  the theme group and check the focus ring. Read the switches back after toggling them.
- **Don't toggle Launch at login while testing.** It registers a real login item on the user's
  machine. Restore every setting you change.
- Resize: drag the window's corner far past the minimum, using desktop control, and confirm the
  window stops there: `agent eval "[outerWidth, outerHeight]"` in the Settings window reports the
  `setMinimumSize` values. Then, in every section at that size, check that nothing scrolls
  horizontally (`document.documentElement.scrollWidth <= innerWidth`), rows wrap rather than clip,
  and the theme row has wrapped (and stays inline while it still fits). Screenshot it. Desktop
  control's accessibility "press" on a page link may not reach the page, so navigate with
  `agent click` or by setting `location.hash`.
- Show window at startup: turn it off, restart the app as `AGENTS.md` describes, and confirm no
  window is on screen (ask the user, or take an OS-level screenshot); then activate the app (Dock
  click) and confirm it appears. With several displays, a window centered at a negative x is on
  another display, not off-screen. Check `screen.availLeft` before you "fix" it. Restore the
  setting.
- e2e: test the real Settings window, not the route in the main window. A window the app opens
  arrives as a `page` event on `context`: start `context.waitForEvent("page")`, press
  `ControlOrMeta+,` in the main window, and assert on the page it resolves to, including the theme
  reaching the main window (see `test/e2e/settings.test.ts`). A test can't click native menu
  items, so a window that opens only from the menu needs a trigger the page can reach: a shortcut
  the renderer handles, a button, or an IPC call.
