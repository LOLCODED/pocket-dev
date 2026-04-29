export type Role = "user" | "assistant" | "system";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error: boolean;
    };

export interface Message {
  role: Role;
  content: ContentBlock[];
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ChatEvent =
  | { kind: "started"; session_id: string; turn_id: string }
  | { kind: "text_delta"; session_id: string; turn_id: string; text: string }
  | {
      kind: "tool_use_start";
      session_id: string;
      turn_id: string;
      tool_id: string;
      name: string;
    }
  | {
      kind: "tool_input_delta";
      session_id: string;
      turn_id: string;
      tool_id: string;
      json_delta: string;
    }
  | {
      kind: "tool_use_end";
      session_id: string;
      turn_id: string;
      tool_id: string;
      input: unknown;
    }
  | {
      kind: "assistant";
      session_id: string;
      turn_id: string;
      message: Message;
    }
  | {
      kind: "done";
      session_id: string;
      turn_id: string;
      stop_reason: string;
    }
  | {
      kind: "error";
      session_id: string;
      turn_id: string;
      error: { kind: string; message: string; retriable: boolean };
    }
  | { kind: "cancelled"; session_id: string; turn_id: string };
