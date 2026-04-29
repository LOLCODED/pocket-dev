import { invoke } from "@tauri-apps/api/core";
import type { Message, ToolSchema } from "../ai/types";

export interface ChatTurnRequest {
  session_id: string;
  turn_id: string;
  messages: Message[];
  system?: string;
  tools?: ToolSchema[];
}

export const chatService = {
  send: (request: ChatTurnRequest) => invoke<void>("chat_send", { request }),
  cancel: (sessionId: string) =>
    invoke<void>("chat_cancel", { sessionId }),
};
