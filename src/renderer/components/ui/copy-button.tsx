/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * Copy-to-clipboard with the two traps handled (rules/interaction.md):
 * - `navigator.clipboard.writeText` rejects when the window isn't focused; an unhandled
 *   rejection is a console error, so failures are caught and reported with a toast.
 * - A tooltip-wrapped control that is the first focusable element in a Dialog/Sheet eats the
 *   first Escape — pass `tooltip={false}` there.
 *
 * ```tsx
 * <CopyButton value={apiKey} label="Copy API key" />
 * ```
 */
import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Resolves `true` on success. Never rejects. */
async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

function CopyButton({
  value,
  label = "Copy",
  size = "icon-sm",
  variant = "ghost",
  tooltip = true,
  className,
}: {
  value: string
  /** Accessible name and tooltip, e.g. "Copy order number". */
  label?: string
  size?: "icon-xs" | "icon-sm" | "icon"
  variant?: "ghost" | "outline"
  /** `false` when this is the first focusable element inside an overlay. */
  tooltip?: boolean
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  function copy() {
    void copyToClipboard(value).then((ok) => {
      if (ok) setCopied(true)
      else
        toast.error("Couldn't copy to the clipboard", {
          description: "Select the text and copy it manually.",
        })
    })
  }

  const icon = copied ? <CheckIcon /> : <CopyIcon />
  const name = copied ? "Copied" : label

  if (!tooltip) {
    return (
      <Button
        data-slot="copy-button"
        variant={variant}
        size={size}
        aria-label={name}
        className={className}
        onClick={copy}
      >
        {icon}
      </Button>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            data-slot="copy-button"
            variant={variant}
            size={size}
            aria-label={name}
            className={className}
            onClick={copy}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  )
}

export { CopyButton, copyToClipboard }
