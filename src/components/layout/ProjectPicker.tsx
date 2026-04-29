import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Folder, Sparkles } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { Button } from "../ui/button";
import { toast } from "sonner";

export function ProjectPicker() {
  const recents = useProjectStore((s) => s.recents);
  const open = useProjectStore((s) => s.open);

  async function pickFolder() {
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
      toast.error(toMessage(e));
    }
  }

  async function openRecent(path: string) {
    try {
      await open(path);
    } catch (e) {
      toast.error(toMessage(e));
    }
  }

  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex size-12 items-center justify-center rounded-full bg-(--color-panel-2) text-(--color-accent)">
            <Sparkles className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold">Welcome to pocket-dev</h1>
          <p className="text-sm text-(--color-fg-muted)">
            Open a folder to start. The assistant will help you create or edit files inside it.
          </p>
        </div>

        <div className="flex justify-center">
          <Button size="lg" onClick={pickFolder}>
            <FolderOpen className="size-4" />
            Open folder
          </Button>
        </div>

        {recents.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-(--color-fg-muted)">
              Recent
            </div>
            <ul className="space-y-1">
              {recents.map((r) => (
                <li key={r.path}>
                  <button
                    onClick={() => openRecent(r.path)}
                    className="w-full flex items-center gap-3 px-3 h-11 rounded-md border border-(--color-border) bg-(--color-panel) hover:bg-(--color-panel-2) text-left transition-colors"
                  >
                    <Folder className="size-4 text-(--color-fg-muted) shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm truncate">{r.name}</div>
                      <div className="text-xs text-(--color-fg-muted) truncate">
                        {r.path}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function toMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
