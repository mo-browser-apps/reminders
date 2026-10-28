import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { AppInfo } from "@/gen/app"
import { ipc } from "@/gen/ipc"

/**
 * Settings → About: the app icon, name and version, and Check for Updates when an update server
 * is configured. The icon is `public/app.png` (512px, drawn at 80px so it stays sharp on Retina);
 * the text comes from mobrowser.conf.json through AppService.GetAppInfo.
 */
export function AboutSettings() {
  const [info, setInfo] = React.useState<AppInfo | null>(null)
  const [updatesEnabled, setUpdatesEnabled] = React.useState(false)
  const [checking, setChecking] = React.useState(false)

  React.useEffect(() => {
    ipc.app
      .GetAppInfo({})
      .then(setInfo)
      .catch((error: unknown) => {
        console.warn("Couldn't read the app info:", error)
        toast.error("Couldn't read the app version")
      })
    ipc.settings
      .GetSettings({})
      .then((settings) => setUpdatesEnabled(settings.updatesEnabled))
      .catch((error: unknown) => console.warn("Couldn't load the settings:", error))
  }, [])

  function checkForUpdates() {
    setChecking(true)
    // The main process reports the outcome (up to date, update available, error) in dialogs.
    ipc.settings
      .CheckForUpdates({})
      .catch((error: unknown) => {
        console.warn("Couldn't check for updates:", error)
        toast.error("Couldn't check for updates")
      })
      .finally(() => setChecking(false))
  }

  return (
    <div className="flex min-h-full flex-col items-center px-4 py-5 text-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <img src="./app.png" alt="" className="size-20 select-none" draggable={false} />
        {info ? (
          // The name, then the version in smaller type.
          <div className="flex flex-col items-center gap-1">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">{info.name}</h2>
            <p className="text-xs text-muted-foreground">
              Version {info.version}
              {info.architecture && ` (${info.architecture})`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
        )}
        {updatesEnabled && (
          <Button variant="secondary" size="sm" disabled={checking} onClick={checkForUpdates}>
            {checking && <Spinner data-icon="inline-start" />}
            Check for Updates…
          </Button>
        )}
      </div>
      {info?.copyright && <p className="text-xs text-muted-foreground">{info.copyright}</p>}
    </div>
  )
}
