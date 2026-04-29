import { useState } from "react";
import { Send, Plus, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApiStore } from "../../stores/apiStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function RequestForm() {
  const draft = useApiStore((s) => s.draft);
  const setDraft = useApiStore((s) => s.setDraft);
  const setHeaderAt = useApiStore((s) => s.setHeaderAt);
  const addHeader = useApiStore((s) => s.addHeader);
  const removeHeaderAt = useApiStore((s) => s.removeHeaderAt);
  const send = useApiStore((s) => s.send);
  const saveCurrent = useApiStore((s) => s.saveCurrent);
  const loading = useApiStore((s) => s.loading);
  const [saveName, setSaveName] = useState("");
  const [showHeaders, setShowHeaders] = useState(false);
  const [showBody, setShowBody] = useState(draft.method !== "GET");

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send();
    } catch (err) {
      toast.error(messageOf(err));
    }
  }

  async function onSave() {
    const name = saveName.trim() || draft.url;
    try {
      await saveCurrent(name);
      setSaveName("");
      toast.success("Saved");
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  const isMutation = draft.method !== "GET" && draft.method !== "HEAD";

  return (
    <form onSubmit={onSend} className="p-3 space-y-2">
      <div className="flex gap-2">
        <select
          value={draft.method}
          onChange={(e) => {
            setDraft({ method: e.target.value });
            if (e.target.value !== "GET") setShowBody(true);
          }}
          className="h-9 rounded-md border border-(--color-border) bg-(--color-panel-2) px-2 text-sm"
        >
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <Input
          value={draft.url}
          onChange={(e) => setDraft({ url: e.target.value })}
          placeholder="https://..."
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !draft.url.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send
        </Button>
      </div>

      <div className="flex gap-2 text-xs">
        <button
          type="button"
          className={
            "px-2 py-1 rounded " +
            (showHeaders ? "bg-(--color-panel-2)" : "text-(--color-fg-muted)")
          }
          onClick={() => setShowHeaders((v) => !v)}
        >
          Headers ({draft.headers.length})
        </button>
        <button
          type="button"
          className={
            "px-2 py-1 rounded " +
            (showBody ? "bg-(--color-panel-2)" : "text-(--color-fg-muted)")
          }
          onClick={() => setShowBody((v) => !v)}
        >
          Body
        </button>
      </div>

      {showHeaders && (
        <div className="space-y-1.5">
          {draft.headers.map((h, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={h.name}
                onChange={(e) => setHeaderAt(i, { name: e.target.value, value: h.value })}
                placeholder="Header"
                className="flex-1"
              />
              <Input
                value={h.value}
                onChange={(e) => setHeaderAt(i, { name: h.name, value: e.target.value })}
                placeholder="Value"
                className="flex-1"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => removeHeaderAt(i)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="secondary" onClick={addHeader}>
            <Plus className="size-3.5" /> Add header
          </Button>
        </div>
      )}

      {showBody && (
        <textarea
          value={draft.body ?? ""}
          onChange={(e) => setDraft({ body: e.target.value })}
          rows={6}
          placeholder={isMutation ? "JSON body..." : "Body (optional)"}
          className="w-full rounded-md border border-(--color-border) bg-(--color-panel-2) px-3 py-2 text-sm font-mono"
        />
      )}

      <div className="flex gap-2 items-center pt-1">
        <Input
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Save as…"
          className="flex-1"
        />
        <Button type="button" size="sm" variant="secondary" onClick={onSave}>
          <Save className="size-3.5" /> Save
        </Button>
      </div>
    </form>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
