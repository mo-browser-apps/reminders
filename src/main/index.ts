import { app, BrowserWindow, ipc } from '@mobrowser/api';
import { OpenSettingsRequest } from './gen/app';
import { AppServiceDescriptor, MenuServiceDescriptor, ReminderServiceDescriptor } from './gen/ipc_service';
import type { MenuCommand } from './gen/menu';
import { installAppMenu } from './menu';
import { guardNavigation } from './navigation';
import * as store from './reminders/store';
import {
  checkForUpdatesAutomatically,
  closeSettings,
  openSettings,
  registerSettingsService,
  showWindowAtStartup,
  type SettingsSection,
} from './settings';
import { checkForUpdates } from './updates';
import { TRAFFIC_LIGHT_POSITION } from './window-chrome';
import * as process from "node:process";

// The native shell. Archetype: standard app — one resizable main window with a Dock icon and an
// application menu, plus the Settings window (src/main/settings.ts). See
// `.agents/skills/desktop-shell/SKILL.md`.

// The library is read before the window loads, so the first GetLibrary answers at once.
store.load()

const win = new BrowserWindow()
win.browser.loadUrl(app.url)

// Hide the titlebar BEFORE sizing: hiding it afterwards removes its ~32px from the height
// (a 640px window came out 608px tall on macOS). Windows and Linux keep the native titlebar and
// its title; on macOS the title would be drawn over the content.
win.setWindowTitleVisible(process.platform !== 'darwin')
win.setWindowTitlebarVisible(process.platform !== 'darwin')

// Size: a three-pane productivity window (sidebar, task list, details), landscape like Reminders.
// The minimum still fits the narrowest sidebar, a usable task list and the details pane side by
// side (200 + 320 + 240); the panes' own minimums in home-app.tsx add up to it.
win.setSize({ width: 1080, height: 720 })
win.setMinimumSize({ width: 760, height: 480 })
win.setResizable(true)

if (process.platform === 'darwin') {
  // On the toolbar's baseline; see src/main/window-chrome.ts.
  win.setWindowButtonPosition(TRAFFIC_LIGHT_POSITION)
}

// Links open in the user's browser; the window never navigates away from the app.
guardNavigation(win)

// Menu commands the renderer performs travel over MenuService. OnCommand is a runtime-owned stream:
// registerService with no implementation returns its publisher, and every subscriber (the main
// window's AppCommands) receives what it publishes.
const menuService = ipc.registerService(MenuServiceDescriptor)
function publishCommand(command: MenuCommand) {
  menuService.OnCommand(command)
}
const appMenu = installAppMenu(win, (command) => publishCommand({ command }))

/** Brings the main window back (Dock click, a command dispatched from the Settings window). */
function showMainWindow() {
  if (win.isClosed) return
  if (win.isMinimized) win.restore()
  win.show()
  win.focus()
}

win.centerWindow()
// Settings → General → "Show window at startup" (macOS): when off, the app starts in the Dock
// and the window opens on the first Dock click.
if (showWindowAtStartup()) {
  win.show()
}
app.on('activated', () => {
  if (!win.isClosed && !win.isVisible) showMainWindow()
})
// This is a single-window app: closing the main window quits, Settings included.
win.on('closed', () => {
  closeSettings()
  app.quit()
})

if (checkForUpdatesAutomatically()) {
  // Not during launch: give the window time to load first.
  setTimeout(() => void checkForUpdates(win.isClosed ? undefined : win, false), 10_000)
}

// Handle the IPC calls from the renderer process.
registerSettingsService()

// MenuService's unary methods; OnCommand is owned by `menuService` above.
ipc.registerService(MenuServiceDescriptor, {
  async SetState(state) {
    appMenu.update(state)
    return {}
  },
  async Dispatch(command) {
    showMainWindow()
    publishCommand(command)
    return {}
  },
})

// The app's data: every read and change goes through the store (src/main/reminders/store.ts).
ipc.registerService(ReminderServiceDescriptor, {
  async GetLibrary() {
    return { library: store.library() }
  },
  async Apply(request) {
    return store.apply(request.baseRevision, request.changes)
  },
})

ipc.registerService(AppServiceDescriptor, {
  // Settings → About is drawn by the renderer (the native message dialog can't show the app
  // icon); it reads the app's identity from mobrowser.conf.json through here.
  async GetAppInfo() {
    return {
      name: app.name,
      version: app.version,
      description: app.description,
      copyright: app.copyright,
      architecture: architectureLabel(),
    };
  },
  async OpenSettings(request: OpenSettingsRequest) {
    openSettings(toSection(request.section));
    return {};
  },
})

function toSection(section: string): SettingsSection {
  return section === 'about' ? section : 'general';
}

/** "Version 1.0.0 (Apple Silicon)" on the About page. */
function architectureLabel(): string {
  if (process.platform === 'darwin') return process.arch === 'arm64' ? 'Apple Silicon' : 'Intel';
  if (process.arch === 'arm64') return 'ARM64';
  return process.arch === 'x64' ? '64-bit' : '';
}
