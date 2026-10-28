import * as React from "react"
import { toast } from "sonner"

import { ipc } from "@/gen/ipc"
import type { Change, Library } from "@/gen/reminders"

/**
 * The main window's connection to the library the main process owns
 * (src/main/reminders/store.ts). Changes go out one batch at a time through a serial queue, each
 * carrying the revision the previous reply returned, and the screen renders the library each
 * reply sends back. See .agents/skills/desktop-shell/rules/app-data.md.
 *
 * The first subscriber starts the load (not the module's import), so a hot-reloaded module
 * starts over cleanly.
 */

export type LibrarySnapshot =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; library: Library }

let snapshot: LibrarySnapshot = { status: "loading" }
let revision = 0
let queue: Promise<unknown> = Promise.resolve()
let loading = false
const listeners = new Set<() => void>()

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[]
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

/**
 * Keeps the previous object for every list, task and view that didn't change, so a row that
 * renders one task only re-renders when that task changed.
 */
function share(previous: Library | null, next: Library): Library {
  if (!previous) return next
  const reuse = <T extends { id?: string; viewId?: string }>(before: T[], after: T[]): T[] => {
    const byKey = new Map(before.map((item) => [item.id ?? item.viewId, item]))
    let same = before.length === after.length
    const result = after.map((item, at) => {
      const old = byKey.get(item.id ?? item.viewId)
      const kept = old && shallowEqual(old, item) ? old : item
      if (kept !== before[at]) same = false
      return kept
    })
    return same ? before : result
  }
  return {
    ...next,
    lists: reuse(previous.lists, next.lists),
    tasks: reuse(previous.tasks, next.tasks),
    views: reuse(previous.views, next.views),
  }
}

function emit(next: LibrarySnapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

function receive(library: Library | undefined) {
  if (!library) return
  revision = library.revision
  emit({ status: "ready", library: share(snapshot.status === "ready" ? snapshot.library : null, library) })
}

/** Loads the library (again, after an error). */
export function loadLibrary(): void {
  if (loading) return
  loading = true
  if (snapshot.status === "error") emit({ status: "loading" })
  ipc.reminder
    .GetLibrary({})
    .then(({ library }) => {
      receive(library)
      if (library?.loadWarning) toast.warning(library.loadWarning, { duration: Infinity })
    })
    .catch((error: unknown) => emit({ status: "error", error: error instanceof Error ? error.message : String(error) }))
    .finally(() => {
      loading = false
    })
}

function subscribe(listener: () => void) {
  if (listeners.size === 0 && snapshot.status === "loading") loadLibrary()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Sends a batch of changes after the ones already queued. Resolves true when it was applied;
 * a conflict or an invalid change shows a toast and resolves false (the screen then shows the
 * library as it is).
 */
export function applyChanges(...changes: Change[]): Promise<boolean> {
  const result = queue.then(async () => {
    try {
      const reply = await ipc.reminder.Apply({ baseRevision: revision, changes })
      receive(reply.library)
      if (reply.conflict) {
        toast.error("Your reminders were changed elsewhere, so this change wasn't applied.")
        return false
      }
      if (reply.error) {
        toast.error(reply.error)
        return false
      }
      return true
    } catch (error) {
      toast.error(`Couldn't save the change: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  })
  queue = result
  return result
}

export function useLibrary(): LibrarySnapshot {
  return React.useSyncExternalStore(subscribe, () => snapshot)
}
