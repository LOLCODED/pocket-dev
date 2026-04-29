import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { useDbStore, PAGE_SIZE_CONST } from "../../stores/dbStore";
import { toast } from "sonner";

export function TableViewer() {
  const selected = useDbStore((s) => s.selectedTable);
  const page = useDbStore((s) => s.page);
  const loading = useDbStore((s) => s.loading);
  const setPageOffset = useDbStore((s) => s.setPageOffset);

  if (!selected) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-(--color-fg-muted)">
        Pick a table to view its rows.
      </div>
    );
  }

  const start = page.offset;
  const end = Math.min(page.offset + PAGE_SIZE_CONST, page.total);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="h-9 px-3 flex items-center gap-2 border-b border-(--color-border) text-sm">
        <span className="font-medium">
          {selected.schema}.{selected.name}
        </span>
        <span className="text-(--color-fg-muted) text-xs">
          {page.total.toLocaleString()} rows
        </span>
        <div className="flex-1" />
        <span className="text-xs text-(--color-fg-muted)">
          {start + 1}–{end}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={page.offset === 0 || loading}
          onClick={() =>
            setPageOffset(Math.max(0, page.offset - PAGE_SIZE_CONST)).catch((e) =>
              toast.error(messageOf(e)),
            )
          }
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={end >= page.total || loading}
          onClick={() =>
            setPageOffset(page.offset + PAGE_SIZE_CONST).catch((e) =>
              toast.error(messageOf(e)),
            )
          }
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 text-sm text-(--color-fg-muted)">Loading…</div>
        ) : (
          <table className="text-xs w-full border-collapse">
            <thead className="sticky top-0 bg-(--color-panel)">
              <tr>
                {page.columns.map((c) => (
                  <th
                    key={c.name}
                    className="text-left px-3 py-1.5 border-b border-(--color-border) font-medium whitespace-nowrap"
                  >
                    <span>{c.name}</span>
                    <span className="ml-1 text-(--color-fg-muted) font-normal">
                      {c.type_name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-(--color-panel-2)">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-3 py-1 border-b border-(--color-border)/60 align-top max-w-xs truncate"
                      title={renderCell(cell)}
                    >
                      {cell === null ? (
                        <span className="text-(--color-fg-muted) italic">null</span>
                      ) : (
                        renderCell(cell)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {page.rows.length === 0 && (
                <tr>
                  <td className="p-3 text-(--color-fg-muted)">No rows.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function renderCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
