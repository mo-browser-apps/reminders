import * as React from "react"
import { toast } from "sonner"

import { ThemePicker, type AppTheme } from "@/components/settings/theme-picker"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSeparator, FieldTitle } from "@/components/ui/field"
import {
  SettingsPage,
  SettingsSection,
  SettingsSectionCard,
  SettingsSectionContent,
  SettingsSectionHeader,
  SettingsSectionTitle,
} from "@/components/ui/settings"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ipc } from "@/gen/ipc"
import type { Settings } from "@/gen/settings"
import { isLinux, isMac } from "@/lib/platform"

type Toggle = {
  id: string
  label: string
  description: string
  value: (settings: Settings) => boolean
  save: (enabled: boolean) => Promise<Settings>
  /** Hidden when it doesn't apply on this platform or configuration (`null`: still loading). */
  available: (settings: Settings | null) => boolean
}

const TOGGLES: Toggle[] = [
  {
    id: "launch-at-login",
    label: "Launch at login",
    description: "Open the app automatically when you sign in.",
    value: (settings) => settings.launchAtLogin,
    save: (enabled) => ipc.settings.SetLaunchAtLogin({ enabled }),
    // MōBrowser registers login items on macOS and Windows only.
    available: () => !isLinux,
  },
  {
    // macOS only: with the window hidden, the app is reopened from the Dock (src/main/settings.ts).
    id: "show-window-at-startup",
    label: "Show window at startup",
    description: "Open the main window when the app starts. When off, click the Dock icon to open it.",
    value: (settings) => settings.showWindowAtStartup,
    save: (enabled) => ipc.settings.SetShowWindowAtStartup({ enabled }),
    available: () => isMac,
  },
  {
    id: "check-for-updates",
    label: "Check for updates automatically",
    description: "Look for a newer version when the app starts.",
    value: (settings) => settings.checkForUpdatesAutomatically,
    save: (enabled) => ipc.settings.SetCheckForUpdatesAutomatically({ enabled }),
    available: (settings) => settings?.updatesEnabled ?? false,
  },
]

export function GeneralSettings() {
  const [settings, setSettings] = React.useState<Settings | null>(null)

  React.useEffect(() => {
    ipc.settings
      .GetSettings({})
      .then(setSettings)
      .catch((error: unknown) => {
        console.warn("Couldn't load the settings:", error)
        toast.error("Couldn't load the settings")
      })
  }, [])

  function save(toggle: Toggle, enabled: boolean) {
    toggle
      .save(enabled)
      .then(setSettings)
      .catch((error: unknown) => {
        console.warn(`Couldn't save "${toggle.label}":`, error)
        toast.error(`Couldn't change “${toggle.label}”`)
      })
  }

  function saveTheme(theme: AppTheme) {
    ipc.settings
      .SetTheme({ theme })
      .then(setSettings)
      .catch((error: unknown) => {
        console.warn("Couldn't save the theme:", error)
        toast.error("Couldn't change the theme")
      })
  }

  // Until the settings load, show this platform's toggles with a placeholder switch. The update
  // toggle depends on the configuration, so it waits for the settings.
  const toggles = TOGGLES.filter((toggle) => toggle.available(settings))

  return (
    <SettingsPage className="px-4 py-5">
      {/* On Linux without an update server, no toggle applies. */}
      {toggles.length > 0 && (
        <SettingsSection>
          <SettingsSectionCard>
            <SettingsSectionContent>
              <FieldGroup className="gap-3">
                {toggles.map((toggle, index) => (
                  <React.Fragment key={toggle.id}>
                    {index > 0 && <FieldSeparator />}
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldLabel htmlFor={toggle.id}>{toggle.label}</FieldLabel>
                        <FieldDescription>{toggle.description}</FieldDescription>
                      </FieldContent>
                      {settings ? (
                        <Switch
                          id={toggle.id}
                          checked={toggle.value(settings)}
                          onCheckedChange={(checked) => save(toggle, checked)}
                        />
                      ) : (
                        <Skeleton className="h-[18.4px] w-8 shrink-0 rounded-full" />
                      )}
                    </Field>
                  </React.Fragment>
                ))}
              </FieldGroup>
            </SettingsSectionContent>
          </SettingsSectionCard>
        </SettingsSection>
      )}

      <SettingsSection>
        <SettingsSectionHeader>
          <SettingsSectionTitle>Appearance</SettingsSectionTitle>
        </SettingsSectionHeader>
        <SettingsSectionCard>
          <SettingsSectionContent>
            {/* The label on the left, the cards against the right edge like the switches above.
                `*:data-[slot=field-label]:flex-none` stops Field from growing the label, so the
                `justify-between` space goes between the two (`gap-x-4` is the minimum).
                `flex-wrap`: the cards move below the label only once they no longer fit beside
                it, rather than at a fixed width. */}
            <Field
              orientation="horizontal"
              className="flex-wrap items-start justify-between gap-x-4 gap-y-3 *:data-[slot=field-label]:flex-none"
            >
              <FieldTitle id="theme-label" className="w-auto shrink-0">
                Theme
              </FieldTitle>
              <ThemePicker
                labelledBy="theme-label"
                theme={(settings?.theme as AppTheme | undefined) ?? null}
                onThemeChange={saveTheme}
              />
            </Field>
          </SettingsSectionContent>
        </SettingsSectionCard>
      </SettingsSection>
    </SettingsPage>
  )
}
