/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * The confirmation step every destructive or important action goes through
 * (rules/interaction.md), plus the Undo toast that should follow a destructive action.
 */
import * as React from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/**
 * Controlled confirmation. `onConfirm` may be async: the confirm button shows a spinner, both
 * buttons and Esc are disabled until it settles, then the dialog closes. Throw from `onConfirm`
 * (after showing your own error toast) to keep it open for a retry.
 *
 * ```tsx
 * <ConfirmDialog
 *   open={!!pending}
 *   onOpenChange={(open) => !open && setPending(null)}
 *   title={`Delete ${pending?.name}?`}
 *   description="It stops responding immediately."
 *   confirmLabel="Delete"
 *   destructive
 *   onConfirm={() => { remove(pending); undoToast(`${pending.name} deleted`, () => restore(pending)) }}
 * />
 * ```
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  pendingLabel,
  cancelLabel = "Cancel",
  destructive = false,
  confirmDisabled = false,
  icon: Icon,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description: React.ReactNode
  confirmLabel?: string
  /** Label while `onConfirm` runs. Defaults to `${confirmLabel}…`. */
  pendingLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** e.g. until a typed-name confirmation matches. */
  confirmDisabled?: boolean
  icon?: React.ComponentType
  onConfirm: () => void | Promise<void>
  /** Extra content (a reason field, a typed confirmation) between description and footer. */
  children?: React.ReactNode
}) {
  const [pending, setPending] = React.useState(false)

  async function confirm() {
    if (pending) return
    setPending(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // The caller reported the error; stay open so they can retry.
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <AlertDialogContent data-slot="confirm-dialog">
        <AlertDialogHeader>
          {Icon && (
            <AlertDialogMedia>
              <Icon />
            </AlertDialogMedia>
          )}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending || confirmDisabled}
            onClick={confirm}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? (pendingLabel ?? `${confirmLabel}…`) : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * The toast after a destructive action, with an Undo action (rules/interaction.md).
 * `undoToast("Order archived", () => restore(order))`.
 */
function undoToast(
  message: string,
  onUndo: () => void,
  options: { description?: string; undoLabel?: string } = {}
) {
  return toast(message, {
    description: options.description,
    action: { label: options.undoLabel ?? "Undo", onClick: onUndo },
  })
}

export { ConfirmDialog, undoToast }
