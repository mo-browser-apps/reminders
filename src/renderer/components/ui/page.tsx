/**
 * LOCAL EXTENSION — not in the shadcn registry. `npx shadcn@latest add` will never create or
 * overwrite this file; it is maintained here alongside the vendored components.
 *
 * Every screen's outer column and title row, so all screens share one width scale, one padding,
 * and one page-title style (the single `h1`). Settings screens nest `SettingsPage` inside
 * `<Page size="settings">`.
 *
 * ```tsx
 * <Page>
 *   <PageHeader>
 *     <PageHeaderContent>
 *       <PageHeading>
 *         <PageBack to="/orders" label="Orders" />      // detail screens only
 *         <PageTitle>Order #1042</PageTitle>
 *         <StatusBadge tone="success">Paid</StatusBadge>  // optional meta beside the title
 *       </PageHeading>
 *       <PageDescription>Placed today at 9:41 AM.</PageDescription>
 *     </PageHeaderContent>
 *     <PageActions>
 *       <Button>Fulfill</Button>
 *     </PageActions>
 *   </PageHeader>
 *   …
 * </Page>
 * ```
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowLeftIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Link } from "@/components/ui/router"

const pageVariants = cva(
  // pb-16 leaves room for a floating SaveBar / BulkActionBar at the bottom of the viewport.
  "mx-auto flex w-full min-w-0 flex-col gap-6 px-4 pt-5 pb-16 md:px-6 md:pt-6",
  {
    variants: {
      size: {
        /** Tables, dashboards, boards. */
        wide: "max-w-screen-2xl",
        /** A record with a side column (`PageSplit`). */
        detail: "max-w-6xl",
        /** Single-column forms and editors. */
        narrow: "max-w-4xl",
        /** Settings / preferences — the centered column from rules/visual-polish.md. */
        settings: "max-w-2xl",
      },
    },
    defaultVariants: { size: "wide" },
  }
)

function Page({
  className,
  size = "wide",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof pageVariants>) {
  return (
    <div
      data-slot="page"
      data-size={size}
      className={cn(pageVariants({ size }), className)}
      {...props}
    />
  )
}

/** The title row. Actions wrap under the title at narrow widths instead of overflowing. */
function PageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header"
      className={cn("flex flex-wrap items-start gap-x-4 gap-y-3", className)}
      {...props}
    />
  )
}

function PageHeaderContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}
      {...props}
    />
  )
}

/** Holds the title plus anything that sits on its line: a back button, status badges. */
function PageHeading({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-heading"
      className={cn("flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1", className)}
      {...props}
    />
  )
}

/**
 * The screen's one `h1`, in the app-wide page-title style. When a design gives a screen's title its
 * own color or size, pass it in `className` here rather than writing another `h1`.
 */
function PageTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="page-title"
      className={cn(
        "min-w-0 truncate font-heading text-xl font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function PageDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="page-description"
      className={cn("max-w-prose text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function PageActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-actions"
      className={cn("ml-auto flex shrink-0 flex-wrap items-center gap-2", className)}
      {...props}
    />
  )
}

/** Back to the parent list on detail screens. `label` names the destination for screen readers. */
function PageBack({ to, label, className }: { to: string; label: string; className?: string }) {
  return (
    <Button
      data-slot="page-back"
      variant="ghost"
      size="icon-sm"
      className={cn("-ml-1 shrink-0", className)}
      aria-label={`Back to ${label}`}
      nativeButton={false}
      render={<Link to={to} />}
    >
      <ArrowLeftIcon />
    </Button>
  )
}

/** Main content + a side column of summary cards; one column below `lg`. */
function PageSplit({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-split"
      className={cn(
        "grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]",
        className
      )}
      {...props}
    />
  )
}

function PageMain({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-main"
      className={cn("flex min-w-0 flex-col gap-6", className)}
      {...props}
    />
  )
}

function PageAside({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-aside"
      className={cn("flex min-w-0 flex-col gap-6", className)}
      {...props}
    />
  )
}

export {
  Page,
  PageActions,
  PageAside,
  PageBack,
  PageDescription,
  PageHeader,
  PageHeaderContent,
  PageHeading,
  PageMain,
  PageSplit,
  PageTitle,
  pageVariants,
}
