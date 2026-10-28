/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * Settings screens, Linear/Vercel style: a page column of labelled sections, each with its heading
 * and description ABOVE a borderless card. Every heading block is inset by the card's own
 * `px-(--card-spacing)`, so page title, section headings and the row labels inside the cards all
 * share one left edge. Cards use the compact `size="sm"` spacing (12px), so the heading blocks
 * are inset by `px-3` to match.
 */
import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

function SettingsPage({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">({ className: cn("flex flex-col gap-8", className) }, props),
    render,
    state: {
      slot: "settings-page",
    },
  })
}

function SettingsPageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-page-header"
      className={cn("flex flex-col gap-1 px-3", className)}
      {...props}
    />
  )
}

function SettingsPageTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="settings-page-title"
      // Same style as PageTitle (ui/page.tsx): one page-title style across the app.
      className={cn("font-heading text-xl font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

function SettingsPageDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="settings-page-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function SettingsSection({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="settings-section"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  )
}

function SettingsSectionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-section-header"
      className={cn(
        // A grid (like CardHeader) so an optional SettingsSectionAction sits to the right of the
        // title + description without the caller hand-rolling a flex row.
        "grid auto-rows-min items-start gap-1 px-3 has-data-[slot=settings-section-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  )
}

/** A section-level action ("Create API key", "Add endpoint") aligned right of the heading. */
function SettingsSectionAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-section-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-end justify-self-end", className)}
      {...props}
    />
  )
}

function SettingsSectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="settings-section-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

function SettingsSectionDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="settings-section-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SettingsSectionCard({ className, size = "sm", ...props }: React.ComponentProps<typeof Card>) {
  return <Card size={size} className={cn("border-none bg-settings-section", className)} {...props} />
}

function SettingsSectionContent(props: React.ComponentProps<typeof CardContent>) {
  return <CardContent className={cn("select-none", props.className)} {...props} />
}

function SettingsSectionFooter({ className, ...props }: React.ComponentProps<typeof CardFooter>) {
  return <CardFooter className={cn("justify-end", className)} {...props} />
}

export {
  SettingsPage,
  SettingsPageHeader,
  SettingsPageTitle,
  SettingsPageDescription,
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionAction,
  SettingsSectionTitle,
  SettingsSectionDescription,
  SettingsSectionCard,
  SettingsSectionContent,
  SettingsSectionFooter,
}
