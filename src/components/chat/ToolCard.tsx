import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { cn } from "../../lib/utils";

const FRIENDLY_NAMES: Record<string, string> = {
  list_dir: "List folder",
  read_file: "Read file",
  write_file: "Write file",
  run_sql: "Run SQL",
};

function describeInput(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const i = input as Record<string, unknown>;
  if (name === "list_dir") return (i.path as string) || "/";
  if (name === "read_file" || name === "write_file") return (i.path as string) || "";
  if (name === "run_sql") return summarizeSql((i.query as string) || "");
  return "";
}

function summarizeSql(q: string) {
  const t = q.replace(/\s+/g, " ").trim();
  return t.length > 80 ? t.slice(0, 80) + "…" : t;
}

interface Props {
  name: string;
  input: unknown;
  status?: "auto" | "pending" | "applied" | "rejected";
}

export function ToolCard({ name, input, status = "auto" }: Props) {
  const [open, setOpen] = useState(false);
  const friendly = FRIENDLY_NAMES[name] ?? name;
  const summary = describeInput(name, input);

  const statusLabel =
    status === "pending"
      ? "needs approval"
      : status === "applied"
        ? "applied"
        : status === "rejected"
          ? "declined"
          : "";

  return (
    <div
      className={cn(
        "border border-(--color-border) rounded-md bg-(--color-panel)",
        status === "pending" && "border-(--color-accent)",
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <Wrench className="size-3.5 text-(--color-fg-muted)" />
        <span className="font-medium">{friendly}</span>
        {summary && (
          <span className="text-(--color-fg-muted) truncate flex-1 text-left font-mono">
            {summary}
          </span>
        )}
        {statusLabel && (
          <span className="text-[10px] uppercase tracking-wide text-(--color-accent)">
            {statusLabel}
          </span>
        )}
      </button>
      {open && (
        <pre className="border-t border-(--color-border) px-3 py-2 text-[11px] font-mono text-(--color-fg-muted) overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}
