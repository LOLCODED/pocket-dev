import { useEffect, useMemo } from "react";
import { ChevronRight, ChevronDown, File, Folder, Eye, EyeOff, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useFilesStore, isHidden } from "../../stores/filesStore";
import { useProjectStore } from "../../stores/projectStore";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export function FileTree() {
  const project = useProjectStore((s) => s.current);
  const showHidden = useFilesStore((s) => s.showHidden);
  const toggleHidden = useFilesStore((s) => s.toggleHidden);
  const loadDir = useFilesStore((s) => s.loadDir);
  const refreshDir = useFilesStore((s) => s.refreshDir);

  useEffect(() => {
    if (project) {
      loadDir("").catch((e) => toast.error(messageOf(e)));
    }
  }, [project?.path, loadDir]);

  return (
    <div className="flex flex-col h-full">
      <div className="h-9 px-2 flex items-center gap-1 border-b border-(--color-border) text-xs text-(--color-fg-muted)">
        <span className="flex-1 truncate">Project</span>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => refreshDir("").catch((e) => toast.error(messageOf(e)))}
          title="Refresh"
        >
          <RefreshCcw className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={toggleHidden}
          title={showHidden ? "Hide hidden files" : "Show hidden files"}
        >
          {showHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-1">
        <DirView relPath="" depth={0} />
      </div>
    </div>
  );
}

function DirView({ relPath, depth }: { relPath: string; depth: number }) {
  const entries = useFilesStore((s) => s.dirs[relPath]);
  const showHidden = useFilesStore((s) => s.showHidden);

  const visible = useMemo(
    () => entries?.filter((e) => showHidden || !isHidden(e.name)) ?? [],
    [entries, showHidden],
  );

  if (!entries) {
    return (
      <div className="text-xs text-(--color-fg-muted) px-2 py-1" style={{ paddingLeft: 8 + depth * 12 }}>
        Loading…
      </div>
    );
  }
  if (visible.length === 0) {
    return (
      <div className="text-xs text-(--color-fg-muted) px-2 py-1" style={{ paddingLeft: 8 + depth * 12 }}>
        Empty
      </div>
    );
  }

  return (
    <ul>
      {visible.map((entry) =>
        entry.is_dir ? (
          <DirNode key={entry.path} entry={entry} depth={depth} />
        ) : (
          <FileNode key={entry.path} entry={entry} depth={depth} />
        ),
      )}
    </ul>
  );
}

function DirNode({ entry, depth }: { entry: { name: string; path: string }; depth: number }) {
  const expanded = useFilesStore((s) => s.expanded.has(entry.path));
  const toggle = useFilesStore((s) => s.toggleExpanded);

  return (
    <li>
      <button
        onClick={() => toggle(entry.path).catch((e) => toast.error(messageOf(e)))}
        className="w-full flex items-center gap-1 px-1 py-0.5 rounded text-sm hover:bg-(--color-panel-2)"
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 text-(--color-fg-muted)" />
        ) : (
          <ChevronRight className="size-3.5 text-(--color-fg-muted)" />
        )}
        <Folder className="size-3.5 text-(--color-accent)" />
        <span className="truncate">{entry.name}</span>
      </button>
      {expanded && <DirView relPath={entry.path} depth={depth + 1} />}
    </li>
  );
}

function FileNode({ entry, depth }: { entry: { name: string; path: string }; depth: number }) {
  const openPath = useFilesStore((s) => s.openPath);
  const openFile = useFilesStore((s) => s.openFile);
  const isOpen = openPath === entry.path;

  return (
    <li>
      <button
        onClick={() => openFile(entry.path).catch((e) => toast.error(messageOf(e)))}
        className={cn(
          "w-full flex items-center gap-1 px-1 py-0.5 rounded text-sm hover:bg-(--color-panel-2)",
          isOpen && "bg-(--color-panel-2) text-(--color-fg)",
        )}
        style={{ paddingLeft: 18 + depth * 12 }}
      >
        <File className="size-3.5 text-(--color-fg-muted)" />
        <span className="truncate">{entry.name}</span>
      </button>
    </li>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
