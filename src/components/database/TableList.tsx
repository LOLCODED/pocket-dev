import { Table } from "lucide-react";
import { useDbStore } from "../../stores/dbStore";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

export function TableList() {
  const tables = useDbStore((s) => s.tables);
  const selected = useDbStore((s) => s.selectedTable);
  const select = useDbStore((s) => s.selectTable);

  if (tables.length === 0) {
    return (
      <div className="p-3 text-xs text-(--color-fg-muted)">No tables found.</div>
    );
  }

  return (
    <ul className="p-1">
      {tables.map((t) => {
        const id = `${t.schema}.${t.name}`;
        const isOpen = selected && selected.schema === t.schema && selected.name === t.name;
        return (
          <li key={id}>
            <button
              onClick={() => select(t).catch((e) => toast.error(messageOf(e)))}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1 rounded text-sm hover:bg-(--color-panel-2)",
                isOpen && "bg-(--color-panel-2) text-(--color-fg)",
              )}
            >
              <Table className="size-3.5 text-(--color-fg-muted)" />
              <span className="truncate">{t.schema === "public" ? t.name : id}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
