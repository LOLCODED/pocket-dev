import { useApiStore } from "../../stores/apiStore";

export function ResponseViewer() {
  const response = useApiStore((s) => s.response);
  const errorMessage = useApiStore((s) => s.errorMessage);

  if (errorMessage) {
    return (
      <div className="p-3">
        <div className="rounded-md p-3 text-sm bg-(--color-danger)/20 border border-(--color-danger)/40">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="p-6 text-sm text-(--color-fg-muted) text-center">
        Send a request to see the response here.
      </div>
    );
  }

  const isJson = looksLikeJson(response.body);
  const formatted = isJson ? prettyJson(response.body) : response.body;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-(--color-border) flex items-center gap-3 text-xs">
        <span
          className={
            "px-2 py-0.5 rounded font-medium " +
            (response.status >= 400
              ? "bg-(--color-danger)/30 text-(--color-fg)"
              : "bg-(--color-accent)/30 text-(--color-fg)")
          }
        >
          {response.status}
        </span>
        <span className="text-(--color-fg-muted)">{response.took_ms} ms</span>
        <span className="text-(--color-fg-muted)">
          {formatBytes(response.size_bytes)}
        </span>
      </div>
      <details className="border-b border-(--color-border) text-xs">
        <summary className="px-3 py-2 cursor-pointer text-(--color-fg-muted)">
          Response headers ({response.headers.length})
        </summary>
        <div className="px-3 pb-2 space-y-0.5 font-mono">
          {response.headers.map((h, i) => (
            <div key={i} className="break-all">
              <span className="text-(--color-fg-muted)">{h.name}:</span> {h.value}
            </div>
          ))}
        </div>
      </details>
      <pre className="flex-1 overflow-auto p-3 text-xs font-mono whitespace-pre-wrap break-words">
        {formatted}
      </pre>
    </div>
  );
}

function looksLikeJson(s: string): boolean {
  const t = s.trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
