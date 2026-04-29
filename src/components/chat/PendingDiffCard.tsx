import { useState } from "react";
import { AlertTriangle, Check, FileEdit, X } from "lucide-react";
import { Button } from "../ui/button";
import { useChatStore } from "../../stores/chatStore";
import { toast } from "sonner";

const PREVIEW_LIMIT = 30;

export function PendingDiffCard() {
  const pending = useChatStore((s) => s.pending);
  const apply = useChatStore((s) => s.applyPending);
  const reject = useChatStore((s) => s.rejectPending);
  const [busy, setBusy] = useState(false);

  if (!pending) return null;

  async function onApply() {
    setBusy(true);
    try {
      await apply();
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    setBusy(true);
    try {
      await reject();
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-(--color-accent)/40 bg-(--color-accent)/5 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <AlertTriangle className="size-3.5 text-(--color-accent)" />
        <span className="font-medium">
          The assistant proposed {pending.tools.length} change
          {pending.tools.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-2 max-h-72 overflow-auto">
        {pending.tools.map((t) => (
          <PendingTool key={t.id} tool={t} />
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onApply} disabled={busy} className="flex-1">
          <Check className="size-3.5" /> Apply all
        </Button>
        <Button size="sm" variant="secondary" onClick={onReject} disabled={busy} className="flex-1">
          <X className="size-3.5" /> Reject
        </Button>
      </div>
    </div>
  );
}

function PendingTool({ tool }: { tool: { name: string; input: unknown } }) {
  const [showFull, setShowFull] = useState(false);
  if (tool.name === "write_file") {
    const input = (tool.input as { path?: string; content?: string }) ?? {};
    const content = input.content ?? "";
    const lines = content.split("\n");
    const visible = showFull ? lines : lines.slice(0, PREVIEW_LIMIT);
    return (
      <div className="rounded-md border border-(--color-border) bg-(--color-panel)">
        <div className="px-2 py-1.5 flex items-center gap-2 text-xs border-b border-(--color-border)">
          <FileEdit className="size-3.5 text-(--color-fg-muted)" />
          <span className="font-mono truncate">{input.path}</span>
          <span className="text-[10px] text-(--color-fg-muted)">
            {lines.length} line{lines.length === 1 ? "" : "s"}
          </span>
        </div>
        <pre className="px-3 py-2 text-[11px] font-mono whitespace-pre-wrap break-words max-h-48 overflow-auto">
          {visible.join("\n")}
          {!showFull && lines.length > PREVIEW_LIMIT && (
            <button
              className="block text-(--color-accent) mt-1"
              onClick={() => setShowFull(true)}
            >
              Show all {lines.length} lines
            </button>
          )}
        </pre>
      </div>
    );
  }
  if (tool.name === "run_sql") {
    const input = (tool.input as { query?: string }) ?? {};
    return (
      <div className="rounded-md border border-(--color-border) bg-(--color-panel)">
        <div className="px-2 py-1.5 flex items-center gap-2 text-xs border-b border-(--color-border)">
          <FileEdit className="size-3.5 text-(--color-fg-muted)" />
          <span className="font-medium">SQL mutation</span>
        </div>
        <pre className="px-3 py-2 text-[11px] font-mono whitespace-pre-wrap break-words max-h-48 overflow-auto">
          {input.query}
        </pre>
      </div>
    );
  }
  return null;
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
