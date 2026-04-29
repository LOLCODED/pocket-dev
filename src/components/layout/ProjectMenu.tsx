import { useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ChevronDown, Folder, FolderOpen, FolderX, Home } from "lucide-react";
import { toast } from "sonner";
import { useProjectStore } from "../../stores/projectStore";
import { cn } from "../../lib/utils";

export function ProjectMenu() {
  const project = useProjectStore((s) => s.current);
  const recents = useProjectStore((s) => s.recents);
  const open = useProjectStore((s) => s.open);
  const close = useProjectStore((s) => s.close);

  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function pickFolder() {
    setMenuOpen(false);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Open project folder",
      });
      if (typeof selected === "string") {
        await open(selected);
      }
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  async function switchTo(path: string) {
    setMenuOpen(false);
    try {
      await open(path);
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  async function closeProject() {
    setMenuOpen(false);
    try {
      await close();
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  const otherRecents = recents.filter((r) => r.path !== project?.path);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="h-8 px-2 flex items-center gap-2 rounded-md hover:bg-(--color-panel-2) text-sm"
        title={project?.path}
      >
        <Home className="size-3.5 text-(--color-fg-muted)" />
        <span className="font-medium truncate max-w-48">
          {project?.name ?? "No project"}
        </span>
        <ChevronDown className="size-3.5 text-(--color-fg-muted)" />
      </button>
      {menuOpen && (
        <div className="absolute left-0 top-full mt-1 w-80 z-50 bg-(--color-panel) border border-(--color-border) rounded-md shadow-lg overflow-hidden">
          {project && (
            <div className="px-3 py-2 border-b border-(--color-border) text-xs">
              <div className="text-(--color-fg-muted)">Current</div>
              <div className="font-medium truncate">{project.name}</div>
              <div className="text-(--color-fg-muted) truncate">{project.path}</div>
            </div>
          )}
          {otherRecents.length > 0 && (
            <div className="max-h-72 overflow-auto py-1">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-(--color-fg-muted)">
                Recent
              </div>
              {otherRecents.map((r) => (
                <button
                  key={r.path}
                  onClick={() => switchTo(r.path)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-(--color-panel-2)",
                  )}
                >
                  <Folder className="size-3.5 text-(--color-fg-muted) shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{r.name}</div>
                    <div className="text-xs text-(--color-fg-muted) truncate">
                      {r.path}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-(--color-border) py-1">
            <button
              onClick={pickFolder}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-(--color-panel-2) text-sm"
            >
              <FolderOpen className="size-3.5 text-(--color-fg-muted)" />
              Open folder…
            </button>
            {project && (
              <button
                onClick={closeProject}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-(--color-panel-2) text-sm"
              >
                <FolderX className="size-3.5 text-(--color-fg-muted)" />
                Close project
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
