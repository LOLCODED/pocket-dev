import { useEffect } from "react";
import { Database, Files, Globe, TerminalSquare, X } from "lucide-react";
import { useWorkspaceStore, type ToolName } from "../../stores/workspaceStore";
import { FilesPanel } from "../files/FilesPanel";
import { DatabasePanel } from "../database/DatabasePanel";
import { ApiPanel } from "../api/ApiPanel";
import { TerminalPanel } from "../terminal/TerminalPanel";

const titles: Record<ToolName, { label: string; icon: typeof Files }> = {
  files: { label: "Files", icon: Files },
  database: { label: "Database", icon: Database },
  api: { label: "API", icon: Globe },
  terminal: { label: "Terminal", icon: TerminalSquare },
};

export function ToolDrawer() {
  const open = useWorkspaceStore((s) => s.openTool);
  const close = useWorkspaceStore((s) => s.close);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  const meta = titles[open];
  const Icon = meta.icon;

  return (
    <div className="absolute inset-y-0 right-11 w-[55%] min-w-[480px] max-w-[1000px] bg-(--color-bg) border-l border-(--color-border) flex flex-col z-30 shadow-xl">
      <div className="h-9 shrink-0 px-3 flex items-center gap-2 border-b border-(--color-border) text-sm">
        <Icon className="size-4 text-(--color-fg-muted)" />
        <span className="font-medium">{meta.label}</span>
        <div className="flex-1" />
        <button
          onClick={close}
          className="size-7 rounded flex items-center justify-center text-(--color-fg-muted) hover:bg-(--color-panel-2) hover:text-(--color-fg)"
          title="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {open === "files" && <FilesPanel />}
        {open === "database" && <DatabasePanel />}
        {open === "api" && <ApiPanel />}
        {open === "terminal" && <TerminalPanel />}
      </div>
    </div>
  );
}
