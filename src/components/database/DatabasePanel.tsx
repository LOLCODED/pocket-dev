import { useEffect } from "react";
import { LogOut, RefreshCcw, Database } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { useDbStore } from "../../stores/dbStore";
import { ConnectionForm } from "./ConnectionForm";
import { TableList } from "./TableList";
import { TableViewer } from "./TableViewer";

export function DatabasePanel() {
  const status = useDbStore((s) => s.status);
  const hydrate = useDbStore((s) => s.hydrate);
  const refresh = useDbStore((s) => s.refreshTables);
  const disconnect = useDbStore((s) => s.disconnect);

  useEffect(() => {
    hydrate().catch(() => {
      // Silent: stored connection may be unreachable; user picks again.
    });
  }, [hydrate]);

  if (!status.connected) {
    return <ConnectionForm />;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 px-3 flex items-center gap-2 border-b border-(--color-border) text-xs">
        <Database className="size-3.5 text-(--color-fg-muted)" />
        <span className="text-(--color-fg-muted) truncate flex-1">
          {status.host_summary ?? "connected"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => refresh().catch((e) => toast.error(messageOf(e)))}
          title="Refresh tables"
        >
          <RefreshCcw className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => disconnect().catch((e) => toast.error(messageOf(e)))}
          title="Disconnect"
        >
          <LogOut className="size-3.5" />
        </Button>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="w-56 shrink-0 border-r border-(--color-border) overflow-auto">
          <TableList />
        </div>
        <TableViewer />
      </div>
    </div>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
