import * as React from "react"

import { ipc } from "@/gen/ipc"
import type { Command, MenuState } from "@/gen/menu"

/**
 * The renderer half of the application menu: commands chosen from the native menu arrive here, and
 * the state the menu enables its items from goes back. See
 * .agents/skills/desktop-shell/rules/menu.md ("Renderer commands") and the example in
 * src/renderer/components/home/app-commands.tsx.
 */

/** Where a command came from: the native menu (or its shortcut), or the page's own key handler. */
export type CommandSource = "menu" | "page"

// One keystroke can reach both the native menu and the page's key handler, so the same command
// arrives once from each. Two quick presses on the same path are two real commands.
const DUPLICATE_WINDOW_MS = 150
const lastRun = new Map<Command, { at: number; source: CommandSource }>()

/**
 * Records a command run; false when it is the second delivery of one keystroke, which is the same
 * command arriving from the other source within a moment.
 */
export function claimCommand(command: Command, source: CommandSource): boolean {
  const now = performance.now()
  const previous = lastRun.get(command)
  lastRun.set(command, { at: now, source })
  return !previous || previous.source === source || now - previous.at > DUPLICATE_WINDOW_MS
}

/** Whether a dialog is open right now. No command runs behind one. */
export function dialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"]:not([data-closed]), [role="alertdialog"]:not([data-closed])')
}

/** `dialogOpen()` as state: dialogs are DOM, not React state, so this watches them open and close. */
export function useDialogOpen(): boolean {
  const [open, setOpen] = React.useState(dialogOpen)
  React.useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      // A closing dialog leaves the DOM after its exit animation, so read on the next frame.
      frame = requestAnimationFrame(() => setOpen(dialogOpen()))
    }
    // Dialogs are portalled into <body> and mark themselves open/closed with data attributes.
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true, attributeFilter: ["data-open", "data-closed"] })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])
  return open
}

/** Runs `execute` for every command chosen from the native menu (MenuService.OnCommand). */
export function useMenuCommands(execute: (command: Command) => void): void {
  const executeRef = React.useRef(execute)
  React.useLayoutEffect(() => {
    executeRef.current = execute
  })
  React.useEffect(() => {
    const subscription = ipc.menu.OnCommand({}).subscribe({
      next: (message) => executeRef.current(message.command),
      error: (error: unknown) => console.warn("Menu commands unavailable:", error),
    })
    return () => subscription.unsubscribe()
  }, [])
}

/**
 * Reports what the menu needs to enable, label, and check its items, whenever it changes. Compute
 * each flag with the same check the command handler runs, so an enabled item always acts. In
 * development the last report is also on `window.__menuState`, for `agent eval`.
 */
export function useMenuState(state: MenuState): void {
  const key = JSON.stringify(state)
  React.useEffect(() => {
    const next = JSON.parse(key) as MenuState
    if (import.meta.env.DEV) (window as { __menuState?: MenuState }).__menuState = next
    ipc.menu.SetState(next).catch((error: unknown) => console.warn("Couldn't update the menu:", error))
  }, [key])
}
