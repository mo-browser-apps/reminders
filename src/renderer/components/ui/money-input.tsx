/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * A currency field that holds money as an integer in minor units (cents), never a float. It keeps
 * the user's text while they type (so "12." isn't reformatted under the cursor), reports minor
 * units on every valid change, and normalizes to "12.00" on blur. `null` means empty.
 *
 * ```tsx
 * <Field data-invalid={invalid || undefined}>
 *   <FieldLabel htmlFor="price">Price</FieldLabel>
 *   <MoneyInput id="price" value={priceCents} onValueChange={setPriceCents} invalid={invalid} />
 * </Field>
 * ```
 */
import * as React from "react"

import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"

function currencyInfo(currency: string, locale: string) {
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency })
  const symbol =
    formatter.formatToParts(0).find((part) => part.type === "currency")?.value ?? currency
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return { symbol, digits }
}

/** "1,234.5" → 123450 (for 2 digits). Returns null for empty or invalid input. */
function parseMoney(input: string, digits = 2): number | null {
  const cleaned = input.replace(/[^\d.-]/g, "")
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 10 ** digits)
}

/** 123450 → "1234.50" (for 2 digits) — the editable form, without grouping. */
function formatMoneyInput(minor: number | null, digits = 2): string {
  return minor == null ? "" : (minor / 10 ** digits).toFixed(digits)
}

function MoneyInput({
  value,
  onValueChange,
  currency = "USD",
  locale = "en-US",
  allowNegative = false,
  invalid,
  placeholder,
  className,
  ...props
}: Omit<React.ComponentProps<typeof InputGroupInput>, "value" | "onChange" | "type"> & {
  /** Minor units (cents). */
  value: number | null
  onValueChange: (value: number | null) => void
  /** ISO 4217 code. */
  currency?: string
  locale?: string
  allowNegative?: boolean
  invalid?: boolean
}) {
  const { symbol, digits } = React.useMemo(
    () => currencyInfo(currency, locale),
    [currency, locale]
  )
  const [text, setText] = React.useState(() => formatMoneyInput(value, digits))
  const focused = React.useRef(false)

  // Follow outside changes (a reset, a loaded record) — but never while the user is typing.
  React.useEffect(() => {
    if (!focused.current) setText(formatMoneyInput(value, digits))
  }, [value, digits])

  return (
    <InputGroup data-slot="money-input" className={cn(className)}>
      <InputGroupAddon>
        <InputGroupText>{symbol}</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder ?? (0).toFixed(digits)}
        aria-invalid={invalid || undefined}
        value={text}
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
          setText(formatMoneyInput(parseMoney(text, digits), digits))
        }}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          const minor = parseMoney(next, digits)
          if (next.trim() === "") onValueChange(null)
          else if (minor !== null && (allowNegative || minor >= 0)) onValueChange(minor)
        }}
        className="tabular-nums"
        {...props}
      />
      {symbol !== currency && (
        <InputGroupAddon align="inline-end">
          <InputGroupText>{currency}</InputGroupText>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

export { MoneyInput, formatMoneyInput, parseMoney }
