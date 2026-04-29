import { useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useDbStore } from "../../stores/dbStore";

export function ConnectionForm() {
  const connect = useDbStore((s) => s.connect);
  const loading = useDbStore((s) => s.loading);
  const [url, setUrl] = useState("postgres://postgres@localhost:5432/postgres");
  const [save, setSave] = useState(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await connect(url.trim(), save);
      toast.success("Connected");
    } catch (err) {
      toast.error(messageOf(err));
    }
  }

  return (
    <form onSubmit={submit} className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex size-12 items-center justify-center rounded-full bg-(--color-panel-2) text-(--color-accent)">
            <Database className="size-6" />
          </div>
          <h2 className="text-xl font-semibold">Connect to a database</h2>
          <p className="text-sm text-(--color-fg-muted)">
            Paste a PostgreSQL connection string to view and query tables.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-(--color-fg-muted)">Connection URL</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="postgres://user:password@host:5432/dbname"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-(--color-fg-muted)">
          <input
            type="checkbox"
            checked={save}
            onChange={(e) => setSave(e.target.checked)}
          />
          Remember (stored in OS keychain)
        </label>

        <Button type="submit" className="w-full" disabled={loading || !url.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Connect"}
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
