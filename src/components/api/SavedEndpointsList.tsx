import { Globe, Trash2 } from "lucide-react";
import { useApiStore } from "../../stores/apiStore";
import { Button } from "../ui/button";

export function SavedEndpointsList() {
  const saved = useApiStore((s) => s.saved);
  const load = useApiStore((s) => s.loadEndpoint);
  const remove = useApiStore((s) => s.remove);

  if (saved.length === 0) {
    return (
      <div className="p-3 text-xs text-(--color-fg-muted)">
        No saved requests yet.
      </div>
    );
  }
  return (
    <ul className="p-1">
      {saved.map((e) => (
        <li
          key={e.id}
          className="group flex items-center gap-2 px-2 py-1 rounded hover:bg-(--color-panel-2)"
        >
          <button onClick={() => load(e)} className="flex-1 text-left flex items-center gap-2">
            <Globe className="size-3.5 text-(--color-fg-muted)" />
            <span className="text-xs font-mono uppercase text-(--color-fg-muted) w-12 shrink-0">
              {e.method}
            </span>
            <span className="truncate text-sm">{e.name}</span>
          </button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 opacity-0 group-hover:opacity-100"
            onClick={() => remove(e.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
