import { useEffect } from "react";
import { Toaster } from "sonner";
import { AppShell } from "./components/layout/AppShell";
import { ProjectPicker } from "./components/layout/ProjectPicker";
import { useProjectStore } from "./stores/projectStore";
import { useSettingsStore } from "./stores/settingsStore";

function App() {
  const current = useProjectStore((s) => s.current);
  const loading = useProjectStore((s) => s.loading);
  const hydrate = useProjectStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    hydrateSettings();
  }, [hydrate, hydrateSettings]);

  return (
    <>
      {loading ? (
        <div className="h-full w-full flex items-center justify-center text-(--color-fg-muted) text-sm">
          Loading...
        </div>
      ) : current ? (
        <AppShell />
      ) : (
        <ProjectPicker />
      )}
      <Toaster theme="dark" position="bottom-right" />
    </>
  );
}

export default App;
