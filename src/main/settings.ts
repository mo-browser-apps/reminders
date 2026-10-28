import { app, BrowserWindow, ipc, prefs } from '@mobrowser/api'
import { SettingsServiceDescriptor } from './gen/ipc_service'
import { Settings } from './gen/settings'
import { guardNavigation } from './navigation'
import { checkForUpdates, UPDATES_ENABLED } from './updates'
import { TRAFFIC_LIGHT_POSITION } from './window-chrome'

/**
 * The Settings window and the app-level settings it edits.
 *
 * Archetype: a standard macOS-style preferences window — resizable down to a minimum
 * size, one instance, a sidebar of sections (General, About), frameless with the traffic lights
 * over the sidebar on macOS. The renderer draws it at `#/settings/<section>` (src/renderer/components/settings).
 *
 * The theme is `app.theme`, which MōBrowser keeps between launches.
 */

const SHOW_WINDOW_AT_STARTUP = 'app.showWindowAtStartup'
const CHECK_FOR_UPDATES_AUTOMATICALLY = 'updates.checkAutomatically'

const isMac = process.platform === 'darwin'

export type SettingsSection = 'general' | 'about'

/**
 * Whether the main window opens at launch. macOS only: with the window hidden, the app is reopened
 * from the Dock (`activated`), which Windows and Linux don't have.
 */
export function showWindowAtStartup(): boolean {
  return !isMac || prefs.getBoolean(SHOW_WINDOW_AT_STARTUP, true)
}

export function checkForUpdatesAutomatically(): boolean {
  return UPDATES_ENABLED && prefs.getBoolean(CHECK_FOR_UPDATES_AUTOMATICALLY, true)
}

function currentSettings(): Settings {
  return {
    launchAtLogin: app.loginItemSettings.openAtLogin,
    showWindowAtStartup: showWindowAtStartup(),
    checkForUpdatesAutomatically: checkForUpdatesAutomatically(),
    updatesEnabled: UPDATES_ENABLED,
    theme: app.theme,
  }
}

function setPref(key: string, value: boolean): void {
  prefs.setBoolean(key, value)
  if (!prefs.persist()) console.error(`Couldn't save the ${key} preference`)
}

let settingsWindow: BrowserWindow | null = null

function settingsUrl(section: SettingsSection): string {
  return `${app.url}#/settings/${section}`
}

/** Opens the Settings window on `section`, or brings the open one forward and switches to it. */
export function openSettings(section: SettingsSection = 'general'): void {
  if (settingsWindow && !settingsWindow.isClosed) {
    settingsWindow.browser.loadUrl(settingsUrl(section))
    if (settingsWindow.isMinimized) settingsWindow.restore()
    settingsWindow.show()
    settingsWindow.focus()
    return
  }

  const win = new BrowserWindow()
  settingsWindow = win
  guardNavigation(win)
  win.setTitle('Settings')
  // Hide the titlebar BEFORE sizing: hiding it afterwards removes its ~32px from the height
  // (a 600px window came out 568px tall on macOS).
  win.setWindowTitleVisible(!isMac)
  win.setWindowTitlebarVisible(!isMac)
  // Shape: a compact, slightly portrait preferences window (560×600),
  // resizable down to a minimum where every section still lays out: when the card gets narrow the
  // theme row wraps its cards below the label, and below the content height the section body
  // scrolls.
  win.setSize({ width: 560, height: 600 })
  win.setMinimumSize({ width: 520, height: 400 })
  win.setResizable(true)
  if (isMac) {
    // Same position as the main window, on the sidebar's empty 48px top row.
    win.setWindowButtonPosition(TRAFFIC_LIGHT_POSITION)
  }
  win.browser.loadUrl(settingsUrl(section))
  win.on('closed', () => {
    if (settingsWindow === win) settingsWindow = null
  })
  win.centerWindow()
  win.show()
}

export function closeSettings(): void {
  if (settingsWindow && !settingsWindow.isClosed) settingsWindow.close()
}

export function registerSettingsService(): void {
  ipc.registerService(SettingsServiceDescriptor, {
    async GetSettings() {
      return currentSettings()
    },
    async SetLaunchAtLogin({ enabled }) {
      app.setLoginItemSettings({ openAtLogin: enabled })
      return currentSettings()
    },
    async SetShowWindowAtStartup({ enabled }) {
      setPref(SHOW_WINDOW_AT_STARTUP, enabled)
      return currentSettings()
    },
    async SetCheckForUpdatesAutomatically({ enabled }) {
      setPref(CHECK_FOR_UPDATES_AUTOMATICALLY, enabled)
      return currentSettings()
    },
    async SetTheme({ theme }) {
      app.setTheme(theme === 'light' || theme === 'dark' ? theme : 'system')
      return currentSettings()
    },
    async CheckForUpdates() {
      await checkForUpdates(settingsWindow ?? undefined, true)
      return {}
    },
  })
}
