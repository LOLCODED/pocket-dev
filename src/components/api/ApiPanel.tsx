import { useEffect } from "react";
import { useApiStore } from "../../stores/apiStore";
import { RequestForm } from "./RequestForm";
import { ResponseViewer } from "./ResponseViewer";
import { SavedEndpointsList } from "./SavedEndpointsList";

export function ApiPanel() {
  const hydrate = useApiStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="h-full flex">
      <div className="w-56 shrink-0 border-r border-(--color-border) overflow-auto">
        <div className="px-3 py-2 text-xs font-medium text-(--color-fg-muted) border-b border-(--color-border)">
          Saved
        </div>
        <SavedEndpointsList />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <RequestForm />
        <div className="flex-1 border-t border-(--color-border) min-h-0">
          <ResponseViewer />
        </div>
      </div>
    </div>
  );
}
