import * as React from "react"
import { useDefaultLayout } from "react-resizable-panels"
import { InfoIcon, SettingsIcon, type LucideIcon } from "lucide-react"

import { AboutSettings } from "@/components/settings/about-settings"
import { GeneralSettings } from "@/components/settings/general-settings"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Link } from "@/components/ui/router"
import { SettingsPageTitle } from "@/components/ui/settings"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { isMac } from "@/lib/platform"

const SECTIONS: { id: string; label: string; icon: LucideIcon; render: () => React.ReactNode }[] = [
  { id: "general", label: "General", icon: SettingsIcon, render: () => <GeneralSettings /> },
  { id: "about", label: "About", icon: InfoIcon, render: () => <AboutSettings /> },
]

/** Sidebar width in px: narrow by default, resizable between `min` and `max` by dragging its edge. */
const SIDEBAR_WIDTH = { default: 160, min: 140, max: 240 }

/**
 * The Settings window (opened by src/main/settings.ts at `#/settings/<section>`): a resizable
 * window with a section sidebar on the left and the section on the right.
 *
 * The sidebar is `collapsible="none"`: the window opens at 560px, below the 768px mobile
 * breakpoint, where an offcanvas sidebar would turn into an overlay sheet. Its width is a
 * resizable panel (`SIDEBAR_WIDTH`); the content panel keeps at least 280px, so the 520px window
 * minimum still fits the widest sidebar. On macOS the traffic lights sit over the sidebar's empty
 * 48px top row (a drag handle), level with the section title.
 */
export function SettingsApp({ section }: { section?: string }) {
  // The width the user dragged the sidebar to, kept across launches (only drags are saved).
  const layout = useDefaultLayout({ id: "settings-sidebar", storage: localStorage, onlySaveAfterUserInteractions: true }) // probe-ok: pane width is a UI convenience
  const current = SECTIONS.find((candidate) => candidate.id === section) ?? SECTIONS[0]

  React.useEffect(() => {
    document.title = `${current.label} – Settings`
  }, [current.label])

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <ResizablePanelGroup orientation="horizontal" {...layout}>
        <ResizablePanel
          id="sidebar"
          defaultSize={`${SIDEBAR_WIDTH.default}px`}
          minSize={`${SIDEBAR_WIDTH.min}px`}
          maxSize={`${SIDEBAR_WIDTH.max}px`}
          // Widening the window grows the content, not the sidebar.
          groupResizeBehavior="preserve-pixel-size"
        >
          <Sidebar collapsible="none" className="w-full">
            {isMac && <SidebarHeader className="app-drag-region h-12 shrink-0" />}
            <SidebarContent>
              <SidebarGroup className={isMac ? "pt-0" : undefined}>
                <SidebarMenu className="gap-0.5">
                  {SECTIONS.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={item.id === current.id}
                        aria-current={item.id === current.id ? "page" : undefined}
                        render={<Link to={`/settings/${item.id}`} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </ResizablePanel>
        {/* The 1px line between the panes is the drag handle (it replaces the sidebar's border). */}
        <ResizableHandle aria-label="Resize sidebar" />
        <ResizablePanel id="content" minSize="280px">
          <main className="flex h-full min-w-0 flex-col bg-background">
            {/* Flush to the top, on the traffic lights' baseline; the empty space drags the window.
                `px-4` lines the title up with the cards' outer edge (the page's own `px-4`). */}
            <header className="app-drag-region flex h-12 shrink-0 items-center border-b px-4">
              <SettingsPageTitle className="truncate">{current.label}</SettingsPageTitle>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">{current.render()}</div>
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  )
}
