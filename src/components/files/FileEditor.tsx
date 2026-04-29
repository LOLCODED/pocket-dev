import { useEffect, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { oneDark } from "@codemirror/theme-one-dark";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import { useFilesStore } from "../../stores/filesStore";
import { Button } from "../ui/button";

export function FileEditor() {
  const openPath = useFilesStore((s) => s.openPath);
  const openContents = useFilesStore((s) => s.openContents);
  const savedContents = useFilesStore((s) => s.savedContents);
  const loading = useFilesStore((s) => s.loadingFile);
  const setEditor = useFilesStore((s) => s.setEditor);
  const saveOpen = useFilesStore((s) => s.saveOpen);
  const closeFile = useFilesStore((s) => s.closeFile);

  const dirty = openContents !== savedContents;
  const ext = useMemo(() => openPath?.split(".").pop()?.toLowerCase() ?? "", [openPath]);
  const lang = useMemo(() => languageFor(ext), [ext]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (openPath && dirty) {
          saveOpen()
            .then(() => toast.success("Saved"))
            .catch((err) => toast.error(messageOf(err)));
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPath, dirty, saveOpen]);

  if (!openPath) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-(--color-fg-muted)">
        Pick a file from the tree to view or edit it.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="h-9 px-2 flex items-center gap-2 border-b border-(--color-border) text-sm">
        <span className="truncate text-(--color-fg-muted)">{openPath}</span>
        {dirty && <span className="text-xs text-(--color-accent)">● unsaved</span>}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="secondary"
          disabled={!dirty || loading}
          onClick={() =>
            saveOpen()
              .then(() => toast.success("Saved"))
              .catch((err) => toast.error(messageOf(err)))
          }
        >
          <Save className="size-3.5" /> Save
        </Button>
        <Button size="icon" variant="ghost" className="size-7" onClick={closeFile} title="Close">
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 text-sm text-(--color-fg-muted)">Loading…</div>
        ) : (
          <CodeMirror
            value={openContents}
            theme={oneDark}
            extensions={lang ? [lang] : []}
            onChange={(v) => setEditor(v)}
            height="100%"
            style={{ height: "100%", fontSize: 13 }}
            basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false }}
          />
        )}
      </div>
    </div>
  );
}

function languageFor(ext: string) {
  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return javascript({ jsx: true, typescript: true });
    case "py":
      return python();
    case "json":
      return json();
    case "md":
    case "markdown":
      return markdown();
    case "html":
    case "htm":
      return html();
    case "css":
      return css();
    default:
      return null;
  }
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
