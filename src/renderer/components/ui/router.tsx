/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * A tiny hash router, so apps don't each hand-roll one. No dependency: it is real browser
 * history (⌘[ / ⌘] and the mouse back button work), with path params, query params, links that
 * behave like links (middle-click, copy link address), and a navigation blocker for unsaved
 * changes. URLs look like `#/orders/ord_1042?tab=timeline`.
 *
 * ```tsx
 * // App.tsx — once, inside the providers
 * <Routes
 *   routes={[
 *     { path: "/", render: () => <DashboardPage /> },
 *     { path: "/orders", render: () => <OrdersPage /> },
 *     { path: "/orders/new", render: () => <NewOrderPage /> },   // static before :param
 *     { path: "/orders/:id", render: ({ id }) => <OrderPage id={id} /> },
 *   ]}
 *   notFound={<NotFoundPage />}
 * />
 * <NavigationGuard />
 * ```
 */
import * as React from "react"

import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

type Route = {
  /** "/orders/ord_1042" */
  path: string
  /** ["orders", "ord_1042"] */
  segments: string[]
  query: URLSearchParams
}

function read(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/"
  const [pathPart, queryPart = ""] = raw.split("?")
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`
  return {
    path,
    segments: path.split("/").filter(Boolean),
    query: new URLSearchParams(queryPart),
  }
}

let current = read()
const listeners = new Set<() => void>()

let blocker: { message: string } | null = null
/** A navigation held back by the blocker, waiting for the user's decision. */
let pending: { to: string; replace: boolean } | null = null
const pendingListeners = new Set<() => void>()

function emit() {
  current = read()
  listeners.forEach((listener) => listener())
}

function emitPending() {
  pendingListeners.forEach((listener) => listener())
}

let lastHash = window.location.hash
/** Set when `commit` changed the hash itself and has already emitted. */
let selfInitiated = false

window.addEventListener("hashchange", () => {
  if (selfInitiated) {
    selfInitiated = false
    lastHash = window.location.hash
    return
  }
  // Back/forward (or a raw <a href="#…">) while a screen has unsaved changes: put the old URL
  // back and ask first. replaceState doesn't fire hashchange, so this can't loop.
  if (blocker) {
    const attempted = window.location.hash
    window.history.replaceState(null, "", lastHash || "#/")
    pending = { to: attempted.replace(/^#/, ""), replace: false }
    emitPending()
    return
  }
  lastHash = window.location.hash
  emit()
})

function commit(to: string, replace: boolean) {
  const hash = `#${to.startsWith("/") ? to : `/${to}`}`
  if (hash === window.location.hash) return
  if (replace) {
    window.history.replaceState(null, "", hash)
    lastHash = hash
    emit()
    return
  }
  lastHash = hash
  selfInitiated = true
  window.location.hash = hash
  // `hashchange` fires asynchronously; emit now so the UI responds in the same tick.
  emit()
}

/** Go to an in-app path: `navigate("/orders/ord_1042")`. Respects the unsaved-changes blocker. */
function navigate(to: string, options: { replace?: boolean; force?: boolean } = {}): void {
  if (blocker && !options.force) {
    pending = { to, replace: options.replace ?? false }
    emitPending()
    return
  }
  commit(to, options.replace ?? false)
}

/**
 * Update query params on the current path without adding a history entry — keep filters, tabs
 * and sort in the URL so they survive back/forward. `null`/`""`/`[]` removes a key.
 */
function setQuery(update: Record<string, string | string[] | null | undefined>): void {
  const params = new URLSearchParams(current.query)
  for (const [key, value] of Object.entries(update)) {
    params.delete(key)
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) continue
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
    else params.set(key, value)
  }
  const qs = params.toString()
  commit(`${current.path}${qs ? `?${qs}` : ""}`, true)
}

function useRoute(): Route {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
}

/** Match `/orders/:id`-style patterns. Returns the params, or null. */
function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean)
  const s = path.split("/").filter(Boolean)
  if (p.length !== s.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(s[i])
    else if (p[i] !== s[i]) return null
  }
  return params
}

type RouteDefinition = {
  path: string
  render: (params: Record<string, string>) => React.ReactNode
}

/**
 * Renders the first route whose `path` matches (list static segments like `/orders/new` before
 * `/orders/:id`). Each URL is keyed, so per-record state (drafts, tabs, scroll) never leaks from
 * one record into the next.
 */
function Routes({
  routes,
  notFound = null,
}: {
  routes: RouteDefinition[]
  notFound?: React.ReactNode
}) {
  const { path } = useRoute()
  for (const route of routes) {
    const params = matchPath(route.path, path)
    if (params) {
      return <React.Fragment key={path}>{route.render(params)}</React.Fragment>
    }
  }
  return <>{notFound}</>
}

/**
 * In-app link: a real `<a href="#/…">` (middle-click and "copy link" work) that navigates
 * through the router, so it respects the unsaved-changes blocker. As a button:
 * `<Button nativeButton={false} render={<Link to="/orders" />}>Orders</Button>`.
 */
function Link({
  to,
  onClick,
  ...props
}: Omit<React.ComponentProps<"a">, "href"> & { to: string }) {
  return (
    <a
      data-slot="link"
      href={`#${to}`}
      onClick={(event) => {
        onClick?.(event)
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        ) {
          return
        }
        event.preventDefault()
        navigate(to)
      }}
      {...props}
    />
  )
}

/** A link styled for table cells and body copy. */
function TextLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    />
  )
}

/**
 * Block in-app navigation while `when` is true (unsaved changes). `NavigationGuard` asks the
 * user; closing the window also triggers the browser's own prompt. `SaveBar` calls this for you.
 */
function useNavigationBlocker(when: boolean, message = "You have unsaved changes."): void {
  React.useEffect(() => {
    if (!when) return
    const mine = { message }
    blocker = mine
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      if (blocker === mine) blocker = null
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [when, message])
}

/** The navigation currently waiting on a discard/keep decision (for a custom guard UI). */
function usePendingNavigation(): {
  pending: { to: string } | null
  message: string
  proceed: () => void
  cancel: () => void
} {
  const snapshot = React.useSyncExternalStore(
    (listener) => {
      pendingListeners.add(listener)
      return () => pendingListeners.delete(listener)
    },
    () => pending
  )
  return {
    pending: snapshot,
    message: blocker?.message ?? "You have unsaved changes.",
    proceed: () => {
      const next = pending
      pending = null
      blocker = null
      emitPending()
      if (next) commit(next.to, next.replace)
    },
    cancel: () => {
      pending = null
      emitPending()
    },
  }
}

/** Mount once next to `<Routes>`: the "Leave without saving?" confirmation. */
function NavigationGuard() {
  const { pending: waiting, message, proceed, cancel } = usePendingNavigation()
  return (
    <ConfirmDialog
      open={waiting !== null}
      onOpenChange={(open) => {
        if (!open) cancel()
      }}
      title="Leave without saving?"
      description={`${message} If you leave now, your changes will be lost.`}
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      destructive
      onConfirm={proceed}
    />
  )
}

export {
  Link,
  NavigationGuard,
  Routes,
  TextLink,
  matchPath,
  navigate,
  setQuery,
  useNavigationBlocker,
  usePendingNavigation,
  useRoute,
}
export type { Route, RouteDefinition }
