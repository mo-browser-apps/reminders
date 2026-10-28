---
name: desktop-shell
description: >-
  Shapes the NATIVE side of this MōBrowser desktop app in the main process
  (src/main) — the window (size, min/max constraints, resizable, decorations,
  frameless/titlebar, macOS traffic lights, always-on-top, vibrancy), the
  application menu, the system tray, the Dock/activation policy (foreground vs
  background/menubar app), and lifecycle (single-instance, quit behavior, deep
  links). Use WHENEVER building a new app or feature, changing what an app IS,
  or when a reference/mockup implies a window shape (compact panel, menubar
  popover, HUD, full app) — not only when the user names "window" or "menu". An
  app is more than its renderer: decide its native shell from its purpose, not
  the scaffolding defaults. Complements the shadcn skill, which owns the
  renderer UI; this skill owns src/main.
user-invocable: false
---

# Desktop shell (MōBrowser main process)

The renderer (`src/renderer`, shadcn/ui) is only half of a desktop app. The other half is the
**native shell** configured in `src/main` — the window's shape and chrome, the app menu, the tray,
and how the app lives in the OS (Dock icon, foreground vs background, quit behavior). The scaffolding
ships a small "Hello, world!" window and a generic File/Edit/View menu; **that is a starting point,
not a decision.** A monitor, a menubar utility, a chat client, and a full IDE should
each have a *different* shell.

**Your job:** whenever you build or materially change an app, decide the shell from the app's purpose
(and any reference image), then configure it in `src/main`. Don't leave the defaults by omission.

## Don't rely on training data — read the local docs

MōBrowser APIs are renamed/reorganized often. Before writing main-process code, read the vendored
guides in `node_modules/@mobrowser/api/docs/guides/guides/` and the API reference in
`node_modules/@mobrowser/api/docs/api/` — they are the source of truth:

- `app-windows.md` — window size, min size, resizable, titlebar/title visibility, traffic-light
  position & visibility, fullscreen, always-on-top, vibrancy, opacity, transparency, drag regions.
- `app-menu.md` — the application menu: `Menu`, `MenuWithRole`, `MenuItem`, standard roles.
- `tray.md` — `Tray`: image (template + `@2x`), title, tooltip, menu, click events.
- `dock.md` — Dock badge, `dock.hide()` (→ background app), Dock menu.
- `app.md` — single-instance, lifecycle (`app.quit`/`restart`), `openUrl` deep links,
  `app.packaged`, theme.
- `dialogs.md` — `app.showMessageDialog` (About, confirmations, alerts), open/save file pickers.

Look up exact names and signatures — don't guess. The installed types
(`node_modules/@mobrowser/api/mobrowser.d.ts`) are authoritative when a doc disagrees.

## Step 1 — Pick the archetype

Most apps fit one of these. The archetype sets the defaults for every later decision.

| Archetype | Examples | Window | Chrome | Dock/activation |
| --- | --- | --- | --- | --- |
| **Standard app** | editor, mail, chat, dashboard | large, resizable, min size | native titlebar (win/linux); frameless + repositioned traffic lights (mac) | regular foreground, Dock icon |
| **Compact utility / HUD** | activity monitor, calculator, timer, color picker | small–medium, often resizable with a tight min | frameless, sometimes always-on-top | Dock icon (usually) |
| **Menubar / tray popover** | clipboard manager, quick notes, status widget | small, fixed, frameless, always-on-top | no titlebar, no traffic lights | **tray icon; `dock.hide()`**, no window on launch |
| **Frameless / transparent** | onboarding, media overlay, splash | content-sized | transparent bg, no shadow/titlebar | varies |

### A reference image is a spec, not a mood board

When the user provides a reference image or mockup, the finished app is expected to **look like it**,
and that **includes the window's shape**: its orientation and aspect ratio are a requirement, and the
renderer adapts to that window, not the other way around. The steps are in
[window.md](./rules/window.md#match-a-reference-images-proportions). Other archetype signals from a
reference: a thing that lives in the menu bar ⇒ tray popover (`Tray` + `dock.hide()`), not a normal
window; a floating always-visible widget ⇒ `setAlwaysOnTop(true)`.

## Step 2 — Run the shell checklist

Decide each explicitly; don't inherit the default silently. Details + exact APIs in the rule files.

- **Window size & constraints** — initial `setSize`; `setMinimumSize` so the renderer layout never
  breaks; `setResizable`; fullscreen. → [rules/window.md](./rules/window.md)
- **Decorations** — native titlebar vs frameless; on macOS, traffic-light **position + visibility**.
  The main-process half lives here; the **renderer CSS half** (insets, drag regions) is owned by the
  shadcn rule [app-window.md](../shadcn/rules/app-window.md) — keep them in sync, don't duplicate.
  → [rules/window.md](./rules/window.md)
- **Always-on-top / vibrancy / transparency** — for HUDs, popovers, overlays.
  → [rules/window.md](./rules/window.md)
- **Application menu** — replace the generic starter menu with an app-appropriate one; keep an
  Edit menu wherever there are text inputs; gate reload/DevTools to `!app.packaged`. **No custom
  item may have an empty `action`.** The About sample in the vendored `app-menu.md` is an empty
  placeholder, so never copy it as-is. An item is **enabled only when choosing it would act**: its
  state uses the same guard as the command handler (focus, selection, open dialog).
  → [rules/menu.md](./rules/menu.md#about--required-never-a-dead-item),
  [enablement](./rules/menu.md#enablement--enabled-only-when-it-would-act)
- **Settings window, with About inside it.** Every app gets **Settings…** (⌘,): a 560×600,
  resizable (with a minimum size) second window with a sidebar (General, About, and Import & Export
  once the app can import or export).
  - General holds the theme (preview cards), Launch at login, Show window at startup (macOS) and
    Check for updates automatically (only when an update server is configured).
  - `About <App>` opens its About page: **app icon**, name, version from `app.*`.
    `app.showMessageDialog` can't show an icon, so About is never a message dialog.
  - Settings… and About go in `macAppMenu` on macOS; on Windows, Settings… goes in File and About
    in Help.
  → [rules/settings-window.md](./rules/settings-window.md)
- **App data** — where the app's own documents and records live (`app.getPath('userData')`), who
  writes them (the main process, atomically, with a backup), JSON or the built-in `node:sqlite`,
  and the revision check against stale saves. → [rules/app-data.md](./rules/app-data.md)
- **Tray & activation** — tray icon + menu; `dock.hide()` for background/menubar apps; re-open on
  tray/Dock click; single-instance & quit behavior. → [rules/tray-and-activation.md](./rules/tray-and-activation.md)
- **System integration** — deep-link `schemes` + `openUrl`, global shortcuts, notifications,
  `screenCaptureProtection` for sensitive content. See the vendored guides.

## Step 3 — Verify the native shell

Verify as [`mobrowser-testing/SKILL.md`](../mobrowser-testing/SKILL.md) describes (step 4 of its
ladder). The agent tooling drives the **renderer only** — it can't see native chrome or click
menus/tray — so `tsc` and `agent screenshot` are **not** enough:

1. **Restart the app** as `AGENTS.md` describes — main-process changes don't hot-reload. If you edit
   `src/main` and only see the renderer update, you're looking at stale native config.
2. **Run the probes** of the rules you touched: [window.md](./rules/window.md#probe) (size, aspect
   ratio, minimum), [menu.md](./rules/menu.md#probe) (no dead items, enablement, About),
   [settings-window.md](./rules/settings-window.md#probe), [tray-and-activation.md](./rules/tray-and-activation.md#probe),
   [app-data.md](./rules/app-data.md#probe).
   The traffic-light keep-out and drag regions are the shadcn
   [app-window.md](../shadcn/rules/app-window.md#probe) probe.
3. **State the shell and ask the user to confirm it.** Report the archetype, window size and
   resizability, decorations, menu, and tray/Dock choice, and ask the user to check what the tooling
   can't observe (native menus, the tray, the Dock, the traffic lights' baseline), especially when
   a reference image implied a shape. Take or request an OS-level screenshot when you can.

## Reference: this project

This app is scaffolded as a **standard app**: one large resizable window, native titlebar on
Windows/Linux and frameless with repositioned traffic lights on macOS, a Dock icon, and an
application menu, plus a resizable Settings window (`src/main/settings.ts`). Read the files
below before adding a main-process feature. They are the worked example for every rule above:

- **`src/main/index.ts`** — window size + minimum size + resizable, titlebar visibility,
  `setWindowButtonPosition(TRAFFIC_LIGHT_POSITION)` (the shared constant in
  `src/main/window-chrome.ts`, kept in sync with the renderer's `--titlebar-*` variables), and the
  `ipc.registerService(...)` pattern.
- **`src/main/menu.ts`** — `installAppMenu(win, dispatch)`: the macOS app menu via `app.setMenu`, the
  Windows and Linux window menu via `win.setMenu`, an Edit menu for the renderer's text inputs,
  reload/DevTools gated behind `!app.packaged`, and the MenuService channel to `AppCommands` in the
  renderer for the app's own commands; it ships with none
  ([menu.md](./rules/menu.md#renderer-commands-the-menuservice-pattern)).
- **`src/main/settings.ts`** (+ `updates.ts`) — the Settings window (single instance, 560×600 and resizable to a minimum,
  same traffic-light position, no menu bar on Windows and Linux), main-owned `prefs`, launch at login,
  and the build-time update-server flag.

If the app's purpose changes (it becomes a menubar utility, a HUD, a monitor), re-run Step 1 and
change the archetype deliberately — don't extend the standard-app shell by default.
