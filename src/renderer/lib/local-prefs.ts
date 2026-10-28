/**
 * UI conveniences kept in the renderer's local storage: whether the sidebar and the details pane
 * are shown, which subtasks are collapsed, the last view. Never app data (that is the main
 * process's library). Every access is guarded: storage can be unavailable.
 */

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key) // probe-ok: UI convenience, not app data
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value)) // probe-ok: UI convenience, not app data
  } catch {
    // Not remembered this time; nothing else depends on it.
  }
}
