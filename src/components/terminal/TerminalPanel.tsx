import { useEffect, useRef, useState } from "react";
import { RotateCcw, TerminalSquare } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Button } from "../ui/button";
import { terminalService } from "../../lib/services/terminal";
import { useProjectStore } from "../../stores/projectStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { toast } from "sonner";

export function TerminalPanel() {
  const project = useProjectStore((s) => s.current);
  const setActive = useWorkspaceStore((s) => s.setActiveTerminalSessionId);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [restartTick, setRestartTick] = useState(0);
  const [exited, setExited] = useState(false);

  useEffect(() => {
    if (!project) return;
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      theme: { background: "#0b0d10" },
      convertEol: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    let unlisten: (() => void) | null = null;
    let cancelled = false;
    let dataDisposable: { dispose: () => void } | null = null;
    let resizeDisposable: { dispose: () => void } | null = null;
    let observer: ResizeObserver | null = null;

    const cols = term.cols;
    const rows = term.rows;

    setExited(false);

    (async () => {
      try {
        const sessionId = await terminalService.open(cols, rows);
        if (cancelled) {
          await terminalService.close(sessionId).catch(() => undefined);
          return;
        }
        sessionIdRef.current = sessionId;
        setActive(sessionId);

        unlisten = await terminalService.onData(
          sessionId,
          (bytes) => term.write(bytes),
          () => setExited(true),
        );

        dataDisposable = term.onData((data) => {
          if (!sessionIdRef.current) return;
          terminalService
            .write(sessionIdRef.current, data)
            .catch((e) => console.error("term_write failed", e));
        });

        resizeDisposable = term.onResize(({ cols, rows }) => {
          if (!sessionIdRef.current) return;
          terminalService
            .resize(sessionIdRef.current, cols, rows)
            .catch(() => undefined);
        });

        observer = new ResizeObserver(() => {
          try {
            fit.fit();
          } catch {
            /* ignore: fit fails when hidden */
          }
        });
        observer.observe(container);
      } catch (e) {
        toast.error(messageOf(e));
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      dataDisposable?.dispose();
      resizeDisposable?.dispose();
      unlisten?.();
      const id = sessionIdRef.current;
      sessionIdRef.current = null;
      setActive(null);
      if (id) terminalService.close(id).catch(() => undefined);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [project, restartTick, setActive]);

  if (!project) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-(--color-fg-muted) text-sm gap-2 p-6 text-center">
        <TerminalSquare className="size-6" />
        Open a project to start a terminal.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 shrink-0 px-3 flex items-center gap-2 border-b border-(--color-border) text-xs">
        <span className="font-mono text-(--color-fg-muted) truncate" title={project.path}>
          {project.path}
        </span>
        {exited && (
          <span className="text-(--color-fg-muted) italic">(shell exited)</span>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setRestartTick((t) => t + 1)}
          title="Restart shell"
        >
          <RotateCcw className="size-3.5" />
          Restart
        </Button>
      </div>
      <div className="flex-1 min-h-0 bg-[#0b0d10] p-2">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
