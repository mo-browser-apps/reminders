import * as fs from "node:fs"
import * as path from "node:path"
import { expect, test } from "@mobrowser/cli/e2e"
import type { BrowserContext, Page } from "@playwright/test"

const conf = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../mobrowser.conf.json"), "utf8"))
const { major, minor, patch } = conf.app.version

// Opens the real Settings window the way a user does: ⌘, (Ctrl+, on Windows and Linux) in the main
// window. Its native menu item can't be clicked from a test, but the main window handles the same
// shortcut (src/renderer/components/home/home-app.tsx) and asks the main process for the window.
async function openSettings(page: Page, context: BrowserContext): Promise<Page> {
  // A shortcut pressed before the main window has rendered reaches no handler.
  await expect(page.getByRole("main")).toBeVisible()
  const opened = context.waitForEvent("page")
  await page.keyboard.press("ControlOrMeta+,")
  const settings = await opened
  await expect(settings).toHaveURL(/#\/settings\/general$/)
  await expect(settings.getByRole("heading", { level: 1, name: "General" })).toBeVisible()
  return settings
}

// The main process applies the theme natively; pages get it as `prefers-color-scheme`.
function prefersDark(win: Page): Promise<boolean> {
  return win.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)
}

test("a theme picked in Settings applies at once to both windows and is kept after a reload", async ({
  page,
  context,
}) => {
  const settings = await openSettings(page, context)
  await expect(settings.getByRole("radio", { name: "System" })).toBeChecked()

  // The cards are labels around visually hidden radios: clicking the card's caption selects it.
  await settings.getByText("Dark", { exact: true }).click()
  await expect(settings.getByRole("radio", { name: "Dark" })).toBeChecked()
  // Both windows follow without a reload.
  for (const win of [settings, page]) {
    await expect.poll(() => prefersDark(win)).toBe(true)
  }

  await settings.reload()
  await expect(settings.getByRole("radio", { name: "Dark" })).toBeChecked()
  await expect.poll(() => prefersDark(settings)).toBe(true)
  await page.reload()
  await expect.poll(() => prefersDark(page)).toBe(true)

  // The keyboard moves the choice too, and Light really turns both windows light.
  await settings.getByRole("radio", { name: "Dark" }).focus()
  await settings.keyboard.press("ArrowLeft")
  await expect(settings.getByRole("radio", { name: "Light" })).toBeChecked()
  for (const win of [settings, page]) {
    await expect.poll(() => prefersDark(win)).toBe(false)
  }
})

test("the Settings sidebar switches sections and About shows the app's version", async ({ page, context }) => {
  const settings = await openSettings(page, context)

  await settings.getByRole("link", { name: "About" }).click()
  await expect(settings.getByRole("heading", { level: 1, name: "About" })).toBeVisible()
  // Name and version come from mobrowser.conf.json, not from the page.
  await expect(settings.getByRole("heading", { level: 2, name: conf.app.name })).toBeVisible()
  await expect(settings.getByText(`Version ${major}.${minor}.${patch}`)).toBeVisible()
  // The copyright line at the bottom is mobrowser.conf.json's app.copyright, shown when set.
  if (conf.app.copyright) {
    await expect(settings.getByText(conf.app.copyright, { exact: true })).toBeVisible()
  }
  // The app icon (decorative: the name is right below it) actually loads.
  const icon = settings.locator("main img")
  await expect(icon).toHaveJSProperty("complete", true)
  expect(await icon.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  await settings.getByRole("link", { name: "General" }).click()
  await expect(settings.getByRole("heading", { level: 1, name: "General" })).toBeVisible()
  // MōBrowser registers login items on macOS and Windows only, so Linux has no switch.
  const launchAtLogin = settings.getByRole("switch", { name: "Launch at login" })
  if (process.platform === "linux") {
    await expect(launchAtLogin).toHaveCount(0)
  } else {
    await expect(launchAtLogin).toBeVisible()
  }
})
