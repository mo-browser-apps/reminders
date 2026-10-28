import * as React from "react"
import { PlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The quiet "New Task" field at the end of a list. Enter creates the task and keeps the field
 * ready for the next one; Escape clears it and leaves. Where the view allows it (`parents`),
 * Tab indents the next task under the one above and Shift+Tab outdents it; with nothing to
 * indent under, Tab moves the focus on as usual.
 */
export function TaskInput({
  placeholder,
  color,
  parents,
  onCreate,
  ref,
}: {
  placeholder: string
  /** The CSS color of the list it adds to. */
  color: string
  /**
   * The tasks a new task can go under, by depth: the last top-level task, its last subtask, and
   * so on. Empty: no indenting.
   */
  parents: string[]
  onCreate: (title: string, parentId: string) => void
  ref?: React.Ref<HTMLInputElement>
}) {
  const [value, setValue] = React.useState("")
  const [depth, setDepth] = React.useState(0)
  const level = Math.min(depth, parents.length)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  const submit = () => {
    if (!value.trim()) return
    onCreate(value, level === 0 ? "" : parents[level - 1])
    setValue("")
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      style={{ "--level": level } as React.CSSProperties}
      className="group/add flex min-h-9 items-center gap-2 rounded-md ps-[calc(var(--level)*1.625rem+0.25rem)] pe-2 transition-[padding] duration-150"
    >
      <span className="w-4 shrink-0" />
      <span
        aria-hidden="true"
        style={{ "--add-color": color } as React.CSSProperties}
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-muted-foreground/40 text-muted-foreground/70",
          "group-focus-within/add:border-solid group-focus-within/add:border-(--add-color) group-focus-within/add:text-(--add-color)",
        )}
      >
        <PlusIcon className="size-3" strokeWidth={2.5} />
      </span>
      <input
        ref={setRefs}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={placeholder}
        placeholder={placeholder}
        autoComplete="off"
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if (event.key === "Tab" && parents.length > 0) {
            const next = event.shiftKey ? level - 1 : level + 1
            if (next < 0 || next > parents.length) return
            event.preventDefault()
            setDepth(next)
          } else if (event.key === "Escape") { // probe-ok: the add field clears and leaves on Esc
            event.preventDefault()
            setValue("")
            setDepth(0)
            event.currentTarget.blur()
          }
        }}
        className="min-w-0 flex-1 self-stretch border-b border-transparent bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/80 focus:border-border/70"
      />
    </form>
  )
}
