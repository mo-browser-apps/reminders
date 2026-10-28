import type { SmartViewId } from "@/lib/reminders"

/** The colors a list can have; the keys are what the main process stores (model.ts LIST_COLORS). */
export const LIST_COLORS: { key: string; label: string }[] = [
  { key: "red", label: "Red" },
  { key: "orange", label: "Orange" },
  { key: "yellow", label: "Yellow" },
  { key: "green", label: "Green" },
  { key: "teal", label: "Teal" },
  { key: "blue", label: "Blue" },
  { key: "indigo", label: "Indigo" },
  { key: "purple", label: "Purple" },
  { key: "pink", label: "Pink" },
  { key: "brown", label: "Brown" },
  { key: "gray", label: "Gray" },
]

/** The CSS color of a list's palette key (the tokens are in index.css). */
export function listColor(key: string | undefined): string {
  return LIST_COLORS.some((color) => color.key === key) ? `var(--list-${key})` : "var(--list-blue)"
}

export function smartColor(id: SmartViewId): string {
  return `var(--smart-${id})`
}

/** A color for a new list: the first one no list uses yet, else the next in turn. */
export function nextListColor(used: string[]): string {
  return LIST_COLORS.find((color) => !used.includes(color.key))?.key ?? LIST_COLORS[used.length % LIST_COLORS.length].key
}
