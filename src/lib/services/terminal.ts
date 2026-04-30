import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface RunCommandResult {
  output: string;
  exit_code: number | null;
  timed_out: boolean;
  truncated: boolean;
}

interface TermDataPayload {
  session_id: string;
  data: string;
}

interface TermExitPayload {
  session_id: string;
  exit_code: number | null;
}

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const terminalService = {
  open: (cols: number, rows: number) =>
    invoke<string>("term_open", { cols, rows }),

  write: (sessionId: string, data: string | Uint8Array) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    return invoke<void>("term_write", {
      sessionId,
      data: toBase64(bytes),
    });
  },

  resize: (sessionId: string, cols: number, rows: number) =>
    invoke<void>("term_resize", { sessionId, cols, rows }),

  close: (sessionId: string) => invoke<void>("term_close", { sessionId }),

  runCommand: (sessionId: string | null, command: string) =>
    invoke<RunCommandResult>("term_run_command", { sessionId, command }),

  onData: async (
    sessionId: string,
    onBytes: (bytes: Uint8Array) => void,
    onExit?: (code: number | null) => void,
  ): Promise<UnlistenFn> => {
    const unlistenData = await listen<TermDataPayload>("term:data", (e) => {
      if (e.payload.session_id !== sessionId) return;
      onBytes(fromBase64(e.payload.data));
    });
    const unlistenExit = await listen<TermExitPayload>("term:exit", (e) => {
      if (e.payload.session_id !== sessionId) return;
      onExit?.(e.payload.exit_code);
    });
    return () => {
      unlistenData();
      unlistenExit();
    };
  },
};
