/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * The unsaved-changes contract for every editor page. While `dirty`, a bar floats at the bottom
 * of the viewport with Discard / Save; ⌘S / Ctrl+S saves; and leaving the screen asks first
 * (via the router's `useNavigationBlocker` + the `NavigationGuard` mounted next to `<Routes>`).
 *
 * Link it to the editor's `<form id>` with `form` so Enter-to-submit and the bar share one submit
 * path. A `<form>` in a Dialog/Sheet inside that page also submits it (React events bubble
 * through portals) — guard the page's `onSubmit` with `if (e.target !== e.currentTarget) return`
 * (rules/forms.md).
 *
 * ```tsx
 * <form id="product-form" onSubmit={save}>…</form>
 * <SaveBar dirty={dirty} saving={saving} onDiscard={reset} form="product-form" />
 * ```
 */
import * as React from "react"
import { CircleAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useNavigationBlocker } from "@/components/ui/router"
import { Spinner } from "@/components/ui/spinner"

function SaveBar({
  dirty,
  saving = false,
  onDiscard,
  onSave,
  form,
  saveLabel = "Save",
  message = "Unsaved changes",
  hotkey = true,
  className,
}: {
  dirty: boolean
  saving?: boolean
  onDiscard: () => void
  /** Called on Save when there's no `form`. */
  onSave?: () => void
  /** Id of the `<form>` to submit. */
  form?: string
  saveLabel?: string
  message?: string
  /** ⌘S / Ctrl+S saves while dirty. */
  hotkey?: boolean
  className?: string
}) {
  useNavigationBlocker(dirty)

  const save = React.useCallback(() => {
    if (form) {
      const element = document.getElementById(form)
      if (element instanceof HTMLFormElement) element.requestSubmit()
    } else {
      onSave?.()
    }
  }, [form, onSave])

  React.useEffect(() => {
    if (!hotkey || !dirty || saving) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        save()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dirty, hotkey, save, saving])

  if (!dirty && !saving) return null

  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      data-slot="save-bar"
      className={cn(
        "sticky bottom-4 z-10 mx-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-xl border bg-popover py-2 pr-2 pl-3 text-sm text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom-2",
        className
      )}
    >
      <span className="flex min-w-0 items-center gap-2 font-medium">
        <CircleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />
        <span className="truncate">{message}</span>
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onDiscard}>
          Discard
        </Button>
        <Button
          type={form ? "submit" : "button"}
          form={form}
          size="sm"
          disabled={saving}
          onClick={form ? undefined : onSave}
        >
          {saving && <Spinner data-icon="inline-start" />}
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  )
}

export { SaveBar }
