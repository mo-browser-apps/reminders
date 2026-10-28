/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * The filter/search input for every list screen, with the affordances rules/interaction.md
 * requires built in: Esc clears it (and blurs it when it's already empty), a ✕ appears as soon
 * as it has a value, it always has an accessible name, and `shortcut` makes `/` focus it from
 * anywhere on the screen.
 *
 * ```tsx
 * <SearchField value={query} onValueChange={setQuery} placeholder="Search orders" shortcut />
 * ```
 *
 * Pass a `ref` to focus it from your own shortcut (⌘F); it is merged with the internal one, so
 * Esc and `/` keep working.
 */
import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  )
}

function overlayOpen(): boolean {
  return !!document.querySelector(
    '[role="dialog"]:not([data-closed]), [role="alertdialog"]:not([data-closed]), [role="menu"], [role="listbox"], [data-slot="popover-content"]'
  )
}

function SearchField({
  value,
  onValueChange,
  placeholder = "Search",
  label,
  shortcut = false,
  className,
  onKeyDown,
  ref,
  ...props
}: Omit<React.ComponentProps<typeof InputGroupInput>, "value" | "onChange"> & {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  /** Accessible name. Defaults to the placeholder. */
  label?: string
  /** Focus this field with `/` (only one per screen). */
  shortcut?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  // A caller's ref arrives as a prop (React 19). Spreading it over the internal ref would break
  // the `/` shortcut and blur-on-Esc, so both refs get the node.
  const setInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  React.useEffect(() => {
    if (!shortcut) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target) || overlayOpen()) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [shortcut])

  return (
    <InputGroup data-slot="search-field" className={cn("w-full sm:max-w-xs", className)}>
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        ref={setInputRef}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented || event.key !== "Escape") return
          if (value) {
            // Clearing consumes the key, so an enclosing dialog/sheet doesn't also close.
            event.preventDefault()
            event.stopPropagation()
            onValueChange("")
          } else {
            // Already empty: let Esc through (it closes an enclosing overlay) and drop focus.
            inputRef.current?.blur()
          }
        }}
        className="[&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={`Clear ${(label ?? placeholder).toLowerCase()}`}
            onClick={() => {
              onValueChange("")
              inputRef.current?.focus()
            }}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      ) : (
        shortcut && (
          <InputGroupAddon align="inline-end" className="hidden sm:flex">
            <Kbd>/</Kbd>
          </InputGroupAddon>
        )
      )}
    </InputGroup>
  )
}

export { SearchField }
