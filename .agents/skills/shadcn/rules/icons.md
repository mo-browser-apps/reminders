# Icons

**This project's `iconLibrary` is `lucide` — always import icons from `lucide-react`.** It's fixed in
`components.json`; don't re-detect it, and don't import from `@tabler/icons-react` or any other set.

---

## Icons in Button use data-icon attribute

Add `data-icon="inline-start"` (prefix) or `data-icon="inline-end"` (suffix) to the icon. No sizing classes on the icon.

**Incorrect:**

```tsx
<Button>
  <SearchIcon className="mr-2 size-4" />
  Search
</Button>
```

**Correct:**

```tsx
<Button>
  <SearchIcon data-icon="inline-start"/>
  Search
</Button>

<Button>
  Next
  <ArrowRightIcon data-icon="inline-end"/>
</Button>
```

---

## No sizing classes on icons inside components

Components handle icon sizing via CSS. Don't add `size-4`, `w-4 h-4`, or other sizing classes to icons inside `Button`, `DropdownMenuItem`, `Alert`, `Sidebar*`, or other shadcn components. Unless the user explicitly asks for custom icon sizes.

**Incorrect:**

```tsx
<Button>
  <SearchIcon className="size-4" data-icon="inline-start" />
  Search
</Button>

<DropdownMenuItem>
  <SettingsIcon className="mr-2 size-4" />
  Settings
</DropdownMenuItem>
```

**Correct:**

```tsx
<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>

<DropdownMenuItem>
  <SettingsIcon />
  Settings
</DropdownMenuItem>
```

---

## Pass icons as component objects, not string keys

Use `icon={CheckIcon}`, not a string key to a lookup map.

**Incorrect:**

```tsx
const iconMap = {
  check: CheckIcon,
  alert: AlertIcon,
}

function StatusBadge({ icon }: { icon: string }) {
  const Icon = iconMap[icon]
  return <Icon />
}

<StatusBadge icon="check" />
```

**Correct:**

```tsx
import { CheckIcon } from "lucide-react"

function StatusBadge({ icon: Icon }: { icon: React.ComponentType }) {
  return <Icon />
}

<StatusBadge icon={CheckIcon} />
```

## Probe

```bash
cd src/renderer
grep -rnE --include='*.tsx' -e '<[A-Z][A-Za-z]*Icon[^>]*className="[^"]*\b(size-|h-[0-9]|w-[0-9]|m[rl]-)' \
  -e 'from "@radix-ui/react-icons"|from "react-icons' components | grep -v '^components/ui/' | grep -v 'probe-ok:'
```

An icon inside a component carries `data-icon`, not sizing or margin classes, and every icon comes
from `lucide-react`. grep can't see what an icon sits in, so it also prints sized icons that stand
alone, outside any component (a large glyph in a custom empty state, an icon in a plain `<span>`).
Those are allowed: mark each with `probe-ok: standalone`. Fix every other hit.
