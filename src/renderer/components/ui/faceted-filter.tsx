/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * A multi-select filter chip for table toolbars: "Status · Paid, Pending". Opens a searchable
 * checklist with per-option counts. Selected values show as a count on narrow windows and as
 * labels when there is room.
 *
 * ```tsx
 * <FacetedFilter
 *   title="Status"
 *   options={[{ value: "paid", label: "Paid", count: 812 }, …]}
 *   selected={status}
 *   onSelectedChange={setStatus}
 * />
 * ```
 */
import * as React from "react"
import { CheckIcon, ListFilterIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type FacetOption = {
  value: string
  label: string
  /** Matching rows, shown right-aligned so users see the shape of the data. */
  count?: number
  icon?: React.ComponentType
}

const count = new Intl.NumberFormat("en-US")

function FacetedFilter({
  title,
  options,
  selected,
  onSelectedChange,
  searchable = options.length > 6,
  className,
}: {
  title: string
  options: FacetOption[]
  selected: string[]
  onSelectedChange: (values: string[]) => void
  /** Show a search box in the list. Defaults to on for more than 6 options. */
  searchable?: boolean
  className?: string
}) {
  const toggle = (value: string) =>
    onSelectedChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
    )
  const selectedLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            data-slot="faceted-filter"
            variant="outline"
            size="sm"
            className={cn(selected.length === 0 && "border-dashed", className)}
          />
        }
      >
        <ListFilterIcon data-icon="inline-start" />
        {title}
        {selected.length > 0 && (
          <>
            <span aria-hidden="true" className="mx-0.5 h-3.5 w-px bg-border" />
            <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
              {selected.length}
            </Badge>
            <span className="hidden gap-1 lg:flex">
              {selected.length > 2 ? (
                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                  {selected.length} selected
                </Badge>
              ) : (
                selectedLabels.map((label) => (
                  <Badge key={label} variant="secondary" className="rounded-sm px-1 font-normal">
                    {label}
                  </Badge>
                ))
              )}
            </span>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 overflow-hidden p-0">
        <Command>
          {searchable && <CommandInput placeholder={`Filter ${title.toLowerCase()}…`} />}
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value)
                const Icon = option.icon
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => toggle(option.value)}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                        isSelected && "border-primary bg-primary text-primary-foreground"
                      )}
                    >
                      {isSelected && <CheckIcon className="size-3" />}
                    </span>
                    {Icon && <Icon />}
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                      {isSelected && <span className="sr-only"> (selected)</span>}
                    </span>
                    {/* A CommandShortcut hides the item's built-in trailing check, which would
                        duplicate the leading checkbox (rules/visual-polish.md). */}
                    <CommandShortcut className="tracking-normal tabular-nums">
                      {option.count != null ? count.format(option.count) : ""}
                    </CommandShortcut>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__clear"
                    onSelect={() => onSelectedChange([])}
                    className="justify-center"
                  >
                    <XIcon />
                    Clear filter
                    <CommandShortcut />
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { FacetedFilter }
export type { FacetOption }
