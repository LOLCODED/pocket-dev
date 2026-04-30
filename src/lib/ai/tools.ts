import type { ToolSchema } from "./types";
import { fsService } from "../services/fs";
import { pgService } from "../services/postgres";
import { httpService } from "../services/http";
import { terminalService } from "../services/terminal";
import { useWorkspaceStore } from "../../stores/workspaceStore";

export type ToolName =
  | "list_dir"
  | "read_file"
  | "write_file"
  | "run_sql"
  | "http_request"
  | "run_command";

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

const READ_SQL_RE = /^\s*(select|with|explain|show|table)\b/i;

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "list_dir",
    description:
      "List the entries (files and directories) of a directory in the open project. Use the empty string for the project root.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path inside the project. Use \"\" for the root." },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Read the text contents of a file in the open project.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path inside the project." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Propose writing or replacing the contents of a file. The user must approve the change before it is applied.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path inside the project." },
        content: { type: "string", description: "Full new file contents." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_sql",
    description:
      "Run a SQL query against the connected PostgreSQL database. Read-only queries (SELECT/EXPLAIN/SHOW) auto-execute. Mutations (INSERT/UPDATE/DELETE/DDL) require user approval.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The SQL query to run." },
      },
      required: ["query"],
    },
  },
  {
    name: "http_request",
    description:
      "Send an HTTP request and return the response. GET requests auto-execute. Other methods require user approval.",
    input_schema: {
      type: "object",
      properties: {
        method: { type: "string", description: "HTTP method (GET/POST/PUT/PATCH/DELETE)." },
        url: { type: "string", description: "Full URL." },
        headers: {
          type: "object",
          description: "Optional headers as a name/value map.",
          additionalProperties: { type: "string" },
        },
        body: { type: "string", description: "Optional request body." },
      },
      required: ["method", "url"],
    },
  },
  {
    name: "run_command",
    description:
      "Run a shell command in the open project's root directory and return the combined stdout/stderr. The command is executed via the system shell (sh -c on Unix, cmd /C on Windows) with a 60-second timeout and a 64 KiB output cap. If the user has the Terminal panel open, output is also mirrored there so they can see what's happening. The user must approve every command before it runs.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description:
            "The shell command to run. Use this to install dependencies, run scripts, check versions, etc.",
        },
      },
      required: ["command"],
    },
  },
];

export function requiresApproval(tool: ToolUseBlock): boolean {
  if (tool.name === "write_file") return true;
  if (tool.name === "run_command") return true;
  if (tool.name === "run_sql") {
    const q = (tool.input as { query?: string } | null)?.query ?? "";
    return !READ_SQL_RE.test(q);
  }
  if (tool.name === "http_request") {
    const m = ((tool.input as { method?: string } | null)?.method ?? "GET").toUpperCase();
    return m !== "GET" && m !== "HEAD";
  }
  return false;
}

export async function dispatchTool(tool: ToolUseBlock): Promise<{ content: string; isError: boolean }> {
  try {
    const input = (tool.input ?? {}) as Record<string, unknown>;
    switch (tool.name) {
      case "list_dir": {
        const path = (input.path as string) ?? "";
        const entries = await fsService.listDir(path);
        return { content: JSON.stringify(entries), isError: false };
      }
      case "read_file": {
        const path = input.path as string;
        const text = await fsService.readFile(path);
        return { content: text, isError: false };
      }
      case "write_file": {
        const path = input.path as string;
        const content = input.content as string;
        await fsService.writeFile(path, content);
        return { content: `wrote ${path}`, isError: false };
      }
      case "run_sql": {
        const query = input.query as string;
        const result = await pgService.runSql(query);
        return { content: JSON.stringify(result), isError: false };
      }
      case "http_request": {
        const method = (input.method as string) ?? "GET";
        const url = input.url as string;
        const headersObj = (input.headers as Record<string, string> | undefined) ?? {};
        const headers = Object.entries(headersObj).map(([name, value]) => ({ name, value }));
        const body = (input.body as string | undefined) ?? null;
        const response = await httpService.send({ method, url, headers, body });
        return {
          content: JSON.stringify({
            status: response.status,
            took_ms: response.took_ms,
            body: response.body.length > 100_000 ? response.body.slice(0, 100_000) + "…" : response.body,
          }),
          isError: false,
        };
      }
      case "run_command": {
        const command = (input.command as string) ?? "";
        if (!command.trim()) {
          return { content: "no command provided", isError: true };
        }
        const sessionId = useWorkspaceStore.getState().activeTerminalSessionId;
        const result = await terminalService.runCommand(sessionId, command);
        const exitLabel = result.timed_out
          ? "[timed out after 60s]"
          : `[exit ${result.exit_code ?? "?"}]`;
        const truncLabel = result.truncated ? " [output truncated at 64 KiB]" : "";
        const body = result.output.length === 0 ? "(no output)" : result.output;
        return {
          content: `${body}\n${exitLabel}${truncLabel}`,
          isError: result.timed_out || (result.exit_code !== null && result.exit_code !== 0),
        };
      }
      default:
        return { content: `unknown tool: ${tool.name}`, isError: true };
    }
  } catch (e) {
    return { content: `tool failed: ${messageOf(e)}`, isError: true };
  }
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
