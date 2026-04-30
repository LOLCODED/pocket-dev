import { Database, Files, Globe, TerminalSquare } from "lucide-react";
import { useWorkspaceStore, type ToolName } from "../../stores/workspaceStore";
import { cn } from "../../lib/utils";

const items: { id: ToolName; icon: typeof Files; label: string }[] = [
  { id: "files", icon: Files, label: "Files" },
  { id: "database", icon: Database, label: "Database" },
  { id: "api", icon: Globe, label: "API" },
  { id: "terminal", icon: TerminalSquare, label: "Terminal" },
];

export function ToolRail() {
  const open = useWorkspaceStore((s) => s.openTool);
  const toggle = useWorkspaceStore((s) => s.toggle);

  return (
    <aside className="w-11 shrink-0 bg-(--color-panel) border-l border-(--color-border) flex flex-col items-center py-2 gap-1">
      {items.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => toggle(id)}
          title={label}
          className={cn(
            "size-9 rounded-md flex items-center justify-center transition-colors",
            open === id
              ? "bg-(--color-accent) text-white"
              : "text-(--color-fg-muted) hover:bg-(--color-panel-2) hover:text-(--color-fg)",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </aside>
  );
}
