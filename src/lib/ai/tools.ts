import type { ToolSchema } from "./types";
import { fsService } from "../services/fs";
import { pgService } from "../services/postgres";
import { httpService } from "../services/http";

export type ToolName =
  | "list_dir"
  | "read_file"
  | "write_file"
  | "run_sql"
  | "http_request";

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
];

export function requiresApproval(tool: ToolUseBlock): boolean {
  if (tool.name === "write_file") return true;
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
