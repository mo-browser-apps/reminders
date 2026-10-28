import type * as React from "react"

export const isMac = typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
export const isLinux = typeof navigator !== "undefined" && navigator.userAgent.includes("Linux")

/** The shortcut modifier as shown in hints: ⌘ on macOS, Ctrl+ elsewhere. */
export const MOD = isMac ? "⌘" : "Ctrl+"

/** ⌘ on macOS, Ctrl on Windows/Linux — and not both, so Ctrl+key on a Mac stays an editing key. */
export function hasModKey(event: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
}

/** A shortcut hint in the platform's notation: ⌥⇧⌘L on macOS, Ctrl+Alt+Shift+L elsewhere. */
export function shortcutLabel(key: string, { alt = false, shift = false } = {}): string {
  if (isMac) return `${alt ? "⌥" : ""}${shift ? "⇧" : ""}⌘${key}`
  return `Ctrl+${alt ? "Alt+" : ""}${shift ? "Shift+" : ""}${key}`
}
