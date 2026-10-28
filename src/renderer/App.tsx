import { useEffect } from "react";

import { HomeApp } from "@/components/home/home-app";
import { SettingsApp } from "@/components/settings/settings-app";
import { useRoute } from "@/components/ui/router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isMac } from "@/lib/platform";

// The provider stack lives here, once: tooltips and the toast outlet for both windows.
// Mount the app's data providers (stores, databases) around <HomeApp /> only, so the Settings
// window doesn't open them a second time. See .agents/skills/shadcn/rules/structure.md before
// adding another provider.
//
// Two windows load this renderer: the main window at `#/`, and the Settings window
// (src/main/settings.ts) at `#/settings/<section>`.
function App() {
  const { segments } = useRoute();

  return (
    <TooltipProvider>
      <AppContent>
        {segments[0] === "settings" ? (
          <SettingsApp section={segments[1]} />
        ) : (
          <HomeApp />
        )}
      </AppContent>
      <Toaster />
    </TooltipProvider>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  // Gates the macOS-only titlebar insets and drag regions in index.css.
  useEffect(() => {
    if (isMac) {
      document.documentElement.dataset.platform = "mac";
    }
  }, []);

  return children;
}

export default App
