import { invoke } from "@tauri-apps/api/core";
import type { Message } from "../ai/types";

export interface Conversation {
  id: string;
  title: string;
  created_ms: number;
  updated_ms: number;
  messages: Message[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_ms: number;
  updated_ms: number;
}

export const conversationsService = {
  list: () => invoke<ConversationSummary[]>("list_conversations"),
  get: (id: string) => invoke<Conversation | null>("get_conversation", { id }),
  save: (conversation: Conversation) =>
    invoke<void>("save_conversation", { conversation }),
  remove: (id: string) => invoke<void>("delete_conversation", { id }),
};
