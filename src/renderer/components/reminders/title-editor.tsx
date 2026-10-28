import * as React from "react"

import type { AfterCommit } from "@/components/reminders/task-actions-context"

/**
 * The inline editor of a task's title, drawn as the title itself. Enter commits and starts the
 * next task, Tab / Shift+Tab commit and indent / outdent, Escape reverts, and leaving the field
 * commits. Tab does nothing else in a one-line field, so indenting never takes away an editing
 * key.
 */
export function TitleEditor({
  initial,
  label,
  placeholder,
  onCommit,
  onCancel,
}: {
  initial: string
  label: string
  placeholder?: string
  onCommit: (title: string, after: AfterCommit) => void
  onCancel: () => void
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  // Set once a key has committed or cancelled, so the blur that follows doesn't commit again.
  const done = React.useRef(false)
  // Set while an indent or outdent moves the row: the move can take the focus away for a moment,
  // and that isn't the user leaving the field.
  const moving = React.useRef(false)

  React.useLayoutEffect(() => {
    const input = ref.current
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }, [])

  // After the moved row renders, put the caret back.
  React.useLayoutEffect(() => {
    if (moving.current && document.activeElement !== ref.current) ref.current?.focus()
  })

  const finish = (after: AfterCommit | "cancel") => {
    if (done.current) return
    done.current = true
    if (after === "cancel") onCancel()
    else onCommit(ref.current?.value ?? "", after)
  }

  return (
    <input
      ref={ref}
      defaultValue={initial}
      aria-label={label}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        event.stopPropagation()
        if (event.key === "Enter") {
          event.preventDefault()
          finish("next")
        } else if (event.key === "Tab") {
          event.preventDefault()
          // Indenting saves the title and keeps editing.
          moving.current = true
          onCommit(event.currentTarget.value, event.shiftKey ? "outdent" : "indent")
          window.setTimeout(() => {
            moving.current = false
          }, 250)
        } else if (event.key === "Escape") { // probe-ok: inline title editor reverts on Esc
          event.preventDefault()
          finish("cancel")
        }
      }}
      onBlur={() => {
        if (moving.current) requestAnimationFrame(() => ref.current?.focus())
        else finish("none")
      }}
      className="min-w-0 flex-1 bg-transparent p-0 text-sm leading-5 outline-none placeholder:text-muted-foreground"
    />
  )
}
