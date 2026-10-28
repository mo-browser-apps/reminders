import { app, BrowserWindow, MessageDialogOptions } from '@mobrowser/api'

/**
 * App updates, when mobrowser.conf.json sets `app.updateServerUrl`. Without one, everything here
 * is off and Settings hides the update controls.
 *
 * The menu's 'checkForUpdates' role covers the built-in, user-initiated flow; this module adds
 * the background check at startup (Settings → General) and the About page's button.
 * See node_modules/@mobrowser/api/docs/guides/distribute/auto-updates.md.
 */
export const UPDATE_SERVER_URL = __UPDATE_SERVER_URL__
export const UPDATES_ENABLED = UPDATE_SERVER_URL !== ''

let checking = false

function show(parentWindow: BrowserWindow | undefined, options: Omit<MessageDialogOptions, 'parentWindow'>) {
  return app.showMessageDialog({ ...options, parentWindow })
}

/**
 * Checks the update server and offers to download and install a newer version.
 * `interactive` (the About button) also reports "up to date" and errors; the background check
 * stays silent unless there is an update.
 */
export async function checkForUpdates(parentWindow: BrowserWindow | undefined, interactive: boolean): Promise<void> {
  if (!UPDATES_ENABLED || checking) return
  checking = true
  try {
    const result = await app.checkForUpdate(UPDATE_SERVER_URL)
    if (!result) {
      if (interactive) {
        await show(parentWindow, {
          type: 'info',
          title: 'Check for Updates',
          message: `${app.name} is up to date`,
          informativeText: `Version ${app.version} is the latest version.`,
          buttons: [{ label: 'OK', type: 'primary' }],
        })
      }
      return
    }
    if (typeof result === 'string') {
      if (interactive) {
        await show(parentWindow, {
          type: 'error',
          title: 'Check for Updates',
          message: "Couldn't check for updates",
          informativeText: result,
          buttons: [{ label: 'OK', type: 'primary' }],
        })
      } else {
        console.warn('Background update check failed:', result)
      }
      return
    }

    const offer = await show(parentWindow, {
      type: 'info',
      title: 'Update Available',
      message: `${app.name} ${result.version} is available`,
      informativeText: `You have version ${app.version}. Download and install the update now?`,
      buttons: [
        { label: 'Later', type: 'secondary' },
        { label: 'Download', type: 'primary' },
      ],
    })
    if (offer.button.type !== 'primary') {
      result.dismiss()
      return
    }

    const download = await result.download()
    if (!download.success) {
      await show(parentWindow, {
        type: 'error',
        title: 'Update Available',
        message: "Couldn't download the update",
        informativeText: download.error ?? '',
        buttons: [{ label: 'OK', type: 'primary' }],
      })
      return
    }

    const restart = await show(parentWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `${app.name} ${result.version} is ready to install`,
      informativeText: `Restart ${app.name} to finish updating.`,
      buttons: [
        { label: 'Later', type: 'secondary' },
        { label: 'Restart Now', type: 'primary' },
      ],
    })
    if (restart.button.type === 'primary') app.restart()
  } finally {
    checking = false
  }
}
