# Tray, Dock & activation policy

Source of truth: `node_modules/@mobrowser/api/docs/guides/guides/tray.md`, `dock.md`, and `app.md`.
This is what makes an app a *foreground app*, a *menubar/background app*, or a *tray-resident* app —
decide it from the archetype, not by default.

## Activation policy

- **Foreground app (default).** Dock icon, menubar, a window on launch. Most apps.
- **Background / menubar app.** No Dock icon, lives in the tray. Call `dock.hide()` (macOS) — this
  also hides the app's menu bar. Show the window on demand (tray click), not at launch.

```ts
import { dock } from '@mobrowser/api'
dock.hide() // macOS: background/menubar app — no Dock icon
```

## Tray

Use a **template image** on macOS (`imageTemplate.png` + `@2x`) so it adapts to light/dark menu bars.
Put images in `resources/` and resolve with `app.getPath('appResources')`.

```ts
import { app, Tray, Menu, MenuItem } from '@mobrowser/api'

const tray = new Tray({ imagePath: app.getPath('appResources') + '/imageTemplate.png' })
tray.setTooltip(app.name)
tray.setMenu(new Menu({
  items: [
    new MenuItem({ id: 'open', label: `Open ${app.name}`, action: () => win.show() }),
    'separator',
    new MenuItem({ id: 'quit', label: 'Quit', shortcut: 'CommandOrControl+Q', action: () => app.quit() }),
  ],
}))
// Left click opens the app; right click opens the menu.
tray.on('mouseDown', (button) => {
  if (button === 'secondary') tray.openMenu()
  else win.show()
})
```

## Lifecycle

- **Single-instance** is on by default; a second launch focuses the running instance.
- **Quit behavior.** A tray-resident app should *not* quit when its window closes — hide the window
  and keep the tray alive; quit only from the tray/menu `app.quit()`. A normal app can quit on last
  window close. Decide this deliberately for the archetype.
- **Deep links.** If the app registers `schemes` in `mobrowser.conf.json`, handle both routes at
  startup, and treat every URL as untrusted. A URL that **launches** the app is in
  `app.launchInfo.url` (read it synchronously in the main script); one that arrives while the app
  is **already running** goes to `app.handle('openUrl', …)`. The routes are disjoint: handling only
  `openUrl` drops every link that starts the app.

## Probe

Tray, Dock, and activation are native: none of it is in `agent screenshot`, and `agent list-windows`
only lists windows. After a restart:

- `grep -n "dock.hide\|new Tray\|app.quit\|'closed'" src/main/*.ts` matches the archetype you chose:
  a background/menubar app hides the Dock, creates a tray, and does not quit when its window closes;
  a foreground app does none of that by default.
- Ask the user, or take an OS-level screenshot, to confirm: the tray icon is present (and readable in
  both light and dark menu bars), the Dock icon is present or absent as intended, a tray click shows
  the window (`agent list-windows` then lists it), and Quit from the tray or menu quits.
- Deep links: with `schemes` configured, open one while the app runs and read what `openUrl`
  received; `app.launchInfo.url` for a cold start can only be checked by launching the packaged app
  from a link, so hand that one to the user.
