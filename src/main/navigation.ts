import { BrowserWindow, NavigationParams, OpenPopupParams, workspace } from '@mobrowser/api'

// Links are external: open them in the user's browser instead of a popup window, and never
// navigate an app window away from the app.
function isExternalUrl(url: string): boolean {
  return /^(https?|mailto):/i.test(url)
}

export function guardNavigation(win: BrowserWindow): void {
  win.browser.handle('openPopup', (params: OpenPopupParams) => {
    if (isExternalUrl(params.url)) {
      workspace.openUrl(params.url)
    }
    return 'block'
  })

  win.browser.handle('navigation', (params: NavigationParams) => {
    if (params.isTrusted || params.isAppControlled) {
      return 'proceed'
    }
    if (params.hasUserGesture && isExternalUrl(params.url)) {
      workspace.openUrl(params.url)
    }
    return 'cancel'
  })
}
