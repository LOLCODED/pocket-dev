import { create } from "zustand";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { chatService } from "../lib/services/chat";
import { snapshotService } from "../lib/services/snapshot";
import {
  conversationsService,
  type ConversationSummary,
} from "../lib/services/conversations";
import {
  TOOL_SCHEMAS,
  dispatchTool,
  requiresApproval,
  type ToolUseBlock,
} from "../lib/ai/tools";
import type { ChatEvent, ContentBlock, Message } from "../lib/ai/types";
import { useFilesStore } from "./filesStore";

type StreamingMessage = {
  role: "assistant";
  content: ContentBlock[];
  streaming: true;
};
type StoredMessage = Message | StreamingMessage;

interface PendingApprovals {
  tools: ToolUseBlock[];
  autoResults: Record<string, { content: string; is_error: boolean }>;
  history: Message[];
}

interface PerConvo {
  messages: StoredMessage[];
  streaming: boolean;
  pending: PendingApprovals | null;
  errorMessage: string | null;
  currentTurnId: string | null;
}

const EMPTY_CONVO: PerConvo = {
  messages: [],
  streaming: false,
  pending: null,
  errorMessage: null,
  currentTurnId: null,
};

const NEW_TITLE = "New conversation";

type ChatStore = {
  conversations: ConversationSummary[];
  currentId: string | null;
  byId: Record<string, PerConvo>;

  // Mirrored for components convenience:
  messages: StoredMessage[];
  streaming: boolean;
  pending: PendingApprovals | null;
  errorMessage: string | null;

  hydrate: () => Promise<void>;
  newConversation: () => Promise<void>;
  switchTo: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  resetForProjectChange: () => void;

  send: (text: string) => Promise<void>;
  cancel: () => Promise<void>;
  initListener: () => Promise<UnlistenFn>;
  applyPending: () => Promise<void>;
  rejectPending: () => Promise<void>;
};

const turnDoneEmitter = new Map<string, () => void>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function newId(): string {
  return crypto.randomUUID();
}

function isStreaming(m: StoredMessage): m is StreamingMessage {
  return (m as StreamingMessage).streaming === true;
}

function plainMessages(stored: StoredMessage[]): Message[] {
  return stored.filter((m): m is Message => !isStreaming(m));
}

function makeStreamingPlaceholder(): StreamingMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text: "" }],
    streaming: true,
  };
}

function buildToolResultMessage(
  toolUses: ToolUseBlock[],
  results: Record<string, { content: string; is_error: boolean }>,
): Message {
  return {
    role: "user",
    content: toolUses.map((t) => ({
      type: "tool_result",
      tool_use_id: t.id,
      content: results[t.id]?.content ?? "",
      is_error: results[t.id]?.is_error ?? false,
    })),
  };
}

function getConvo(state: ChatStore, id: string): PerConvo {
  return state.byId[id] ?? EMPTY_CONVO;
}

/** Patch a single conversation's per-convo state, mirroring to top-level if it's current. */
function patchConvo(
  state: ChatStore,
  id: string,
  patch: Partial<PerConvo>,
): Partial<ChatStore> {
  const cur = getConvo(state, id);
  const next = { ...cur, ...patch };
  const byId = { ...state.byId, [id]: next };
  const partial: Partial<ChatStore> = { byId };
  if (id === state.currentId) {
    Object.assign(partial, {
      messages: next.messages,
      streaming: next.streaming,
      pending: next.pending,
      errorMessage: next.errorMessage,
    });
  }
  return partial;
}

function activate(state: ChatStore, id: string | null): Partial<ChatStore> {
  if (!id) {
    return {
      currentId: null,
      messages: [],
      streaming: false,
      pending: null,
      errorMessage: null,
    };
  }
  const c = getConvo(state, id);
  return {
    currentId: id,
    messages: c.messages,
    streaming: c.streaming,
    pending: c.pending,
    errorMessage: c.errorMessage,
  };
}

function deriveTitle(text: string): string {
  const first = text.split("\n").find((l) => l.trim()) ?? text;
  const trimmed = first.trim();
  return trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed || NEW_TITLE;
}

function scheduleSave(id: string, get: () => ChatStore) {
  const existing = saveTimers.get(id);
  if (existing) clearTimeout(existing);
  const t = setTimeout(async () => {
    saveTimers.delete(id);
    const state = get();
    const convo = state.byId[id];
    const summary = state.conversations.find((c) => c.id === id);
    if (!convo || !summary) return;
    try {
      await conversationsService.save({
        id,
        title: summary.title,
        created_ms: summary.created_ms,
        updated_ms: Date.now(),
        messages: plainMessages(convo.messages),
      });
    } catch (e) {
      console.error("save_conversation failed", e);
    }
  }, 500);
  saveTimers.set(id, t);
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  currentId: null,
  byId: {},

  messages: [],
  streaming: false,
  pending: null,
  errorMessage: null,

  hydrate: async () => {
    const list = await conversationsService.list().catch(() => []);
    set({ conversations: list, byId: {}, ...activate(get(), null) });
    if (list.length === 0) {
      await get().newConversation();
    } else {
      // Load the most-recently-updated conversation's full messages.
      const target = list[0];
      const full = await conversationsService.get(target.id).catch(() => null);
      const msgs: StoredMessage[] = full?.messages ?? [];
      set((s) => ({
        byId: { ...s.byId, [target.id]: { ...EMPTY_CONVO, messages: msgs } },
      }));
      set((s) => activate(s, target.id) as ChatStore);
    }
  },

  newConversation: async () => {
    const id = newId();
    const now = Date.now();
    const summary: ConversationSummary = {
      id,
      title: NEW_TITLE,
      created_ms: now,
      updated_ms: now,
    };
    try {
      await conversationsService.save({ ...summary, messages: [] });
    } catch (e) {
      toast.error(messageOf(e));
      return;
    }
    set((s) => ({
      conversations: [summary, ...s.conversations],
      byId: { ...s.byId, [id]: { ...EMPTY_CONVO } },
    }));
    set((s) => activate(s, id) as ChatStore);
  },

  switchTo: async (id) => {
    if (get().currentId === id) return;
    if (!get().byId[id]) {
      const full = await conversationsService.get(id).catch(() => null);
      const msgs: StoredMessage[] = full?.messages ?? [];
      set((s) => ({
        byId: { ...s.byId, [id]: { ...EMPTY_CONVO, messages: msgs } },
      }));
    }
    set((s) => activate(s, id) as ChatStore);
  },

  deleteConversation: async (id) => {
    try {
      await conversationsService.remove(id);
    } catch (e) {
      toast.error(messageOf(e));
      return;
    }
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id);
      const byId = { ...s.byId };
      delete byId[id];
      const wasCurrent = s.currentId === id;
      const partial: Partial<ChatStore> = { conversations, byId };
      if (wasCurrent) {
        const fallback = conversations[0]?.id ?? null;
        Object.assign(partial, activate({ ...s, ...partial } as ChatStore, fallback));
      }
      return partial as ChatStore;
    });
    if (get().conversations.length === 0) {
      await get().newConversation();
    }
  },

  renameConversation: async (id, title) => {
    const trimmed = title.trim() || NEW_TITLE;
    const state = get();
    const conv = state.conversations.find((c) => c.id === id);
    if (!conv) return;
    const updated: ConversationSummary = { ...conv, title: trimmed, updated_ms: Date.now() };
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? updated : c)),
    }));
    const messages = plainMessages(state.byId[id]?.messages ?? []);
    try {
      await conversationsService.save({
        id,
        title: trimmed,
        created_ms: conv.created_ms,
        updated_ms: updated.updated_ms,
        messages,
      });
    } catch (e) {
      toast.error(messageOf(e));
    }
  },

  resetForProjectChange: () => {
    // Clear in-memory state; persistence is per-project so files are untouched.
    saveTimers.forEach((t) => clearTimeout(t));
    saveTimers.clear();
    set({
      conversations: [],
      currentId: null,
      byId: {},
      messages: [],
      streaming: false,
      pending: null,
      errorMessage: null,
    });
  },

  send: async (text) => {
    let convoId = get().currentId;
    if (!convoId) {
      await get().newConversation();
      convoId = get().currentId;
      if (!convoId) return;
    }
    const userMessage: Message = {
      role: "user",
      content: [{ type: "text", text }],
    };
    const cur = getConvo(get(), convoId);
    const nextMessages: StoredMessage[] = [...cur.messages, userMessage];

    // Auto-derive title on first user message.
    const summary = get().conversations.find((c) => c.id === convoId);
    if (summary && summary.title === NEW_TITLE) {
      get().renameConversation(convoId, deriveTitle(text)).catch(() => undefined);
    }

    set((s) =>
      patchConvo(s, convoId!, {
        messages: nextMessages,
        errorMessage: null,
        pending: null,
      }) as ChatStore,
    );
    scheduleSave(convoId, get);
    await runAgentLoop(convoId, plainMessages(nextMessages), set, get);
  },

  cancel: async () => {
    const id = get().currentId;
    if (!id) return;
    await chatService.cancel(id);
  },

  initListener: async () =>
    listen<ChatEvent>("chat:event", (e) => {
      const ev = e.payload;
      const convoId = ev.session_id;
      const state = get();
      const convo = getConvo(state, convoId);
      if (convo.currentTurnId && ev.turn_id !== convo.currentTurnId) return;

      switch (ev.kind) {
        case "started":
          break;
        case "text_delta": {
          const msgs = convo.messages.slice();
          const last = msgs[msgs.length - 1];
          if (last && isStreaming(last)) {
            const block = last.content.find((b) => b.type === "text") as
              | { type: "text"; text: string }
              | undefined;
            if (block) {
              block.text += ev.text;
            } else {
              last.content.push({ type: "text", text: ev.text });
            }
            msgs[msgs.length - 1] = { ...last, content: last.content.slice() };
            set((s) => patchConvo(s, convoId, { messages: msgs }) as ChatStore);
          }
          break;
        }
        case "assistant": {
          const msgs = convo.messages.slice();
          if (msgs.length > 0 && isStreaming(msgs[msgs.length - 1])) {
            msgs[msgs.length - 1] = ev.message;
          } else {
            msgs.push(ev.message);
          }
          set((s) => patchConvo(s, convoId, { messages: msgs }) as ChatStore);
          scheduleSave(convoId, get);
          break;
        }
        case "done":
          turnDoneEmitter.get(ev.turn_id)?.();
          turnDoneEmitter.delete(ev.turn_id);
          break;
        case "error": {
          const msgs = convo.messages.slice();
          const last = msgs[msgs.length - 1];
          if (last && isStreaming(last)) msgs.pop();
          set((s) =>
            patchConvo(s, convoId, {
              messages: msgs,
              errorMessage: ev.error.message,
            }) as ChatStore,
          );
          turnDoneEmitter.get(ev.turn_id)?.();
          turnDoneEmitter.delete(ev.turn_id);
          break;
        }
        case "cancelled": {
          const msgs = convo.messages.slice();
          const last = msgs[msgs.length - 1];
          if (last && isStreaming(last)) msgs.pop();
          set((s) => patchConvo(s, convoId, { messages: msgs }) as ChatStore);
          turnDoneEmitter.get(ev.turn_id)?.();
          turnDoneEmitter.delete(ev.turn_id);
          break;
        }
        default:
          break;
      }
    }),

  applyPending: async () => {
    const id = get().currentId;
    if (!id) return;
    const convo = getConvo(get(), id);
    const pending = convo.pending;
    if (!pending) return;
    set((s) => patchConvo(s, id, { streaming: true }) as ChatStore);

    let snapshotted = false;
    try {
      snapshotted = await snapshotService.create("AI changes").catch(() => false);
    } catch {
      snapshotted = false;
    }
    if (!snapshotted) {
      toast("Snapshot skipped (git not available).", {
        description: "Install git to enable undo of AI changes.",
      });
    }

    const writeResults: Record<string, { content: string; is_error: boolean }> = {};
    for (const tool of pending.tools) {
      const res = await dispatchTool(tool);
      writeResults[tool.id] = { content: res.content, is_error: res.isError };
    }
    useFilesStore.getState().refreshDir("").catch(() => undefined);

    const lastAssistant = pending.history[pending.history.length - 1] as Message;
    const allToolUses = lastAssistant.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );
    const allResults = { ...pending.autoResults, ...writeResults };
    const resultMsg = buildToolResultMessage(allToolUses, allResults);

    const nextMessages = [...getConvo(get(), id).messages, resultMsg];
    set((s) =>
      patchConvo(s, id, { pending: null, messages: nextMessages }) as ChatStore,
    );
    scheduleSave(id, get);
    await runAgentLoop(id, [...pending.history, resultMsg], set, get);
  },

  rejectPending: async () => {
    const id = get().currentId;
    if (!id) return;
    const convo = getConvo(get(), id);
    const pending = convo.pending;
    if (!pending) return;
    set((s) => patchConvo(s, id, { streaming: true }) as ChatStore);

    const declined: Record<string, { content: string; is_error: boolean }> = {};
    for (const t of pending.tools) {
      declined[t.id] = { content: "User declined this change.", is_error: false };
    }
    const lastAssistant = pending.history[pending.history.length - 1] as Message;
    const allToolUses = lastAssistant.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );
    const allResults = { ...pending.autoResults, ...declined };
    const resultMsg = buildToolResultMessage(allToolUses, allResults);

    const nextMessages = [...getConvo(get(), id).messages, resultMsg];
    set((s) =>
      patchConvo(s, id, { pending: null, messages: nextMessages }) as ChatStore,
    );
    scheduleSave(id, get);
    await runAgentLoop(id, [...pending.history, resultMsg], set, get);
  },
}));

async function runAgentLoop(
  convoId: string,
  history: Message[],
  set: (
    partial:
      | Partial<ChatStore>
      | ChatStore
      | ((s: ChatStore) => Partial<ChatStore> | ChatStore),
  ) => void,
  get: () => ChatStore,
) {
  let messages = history;
  for (let i = 0; i < 16; i++) {
    const turnId = newId();
    const placeholder = makeStreamingPlaceholder();
    set((s) =>
      patchConvo(s, convoId, {
        messages: [...getConvo(s, convoId).messages, placeholder],
        streaming: true,
        currentTurnId: turnId,
      }) as ChatStore,
    );

    const done = new Promise<void>((resolve) =>
      turnDoneEmitter.set(turnId, resolve),
    );

    try {
      await chatService.send({
        session_id: convoId,
        turn_id: turnId,
        messages,
        tools: TOOL_SCHEMAS,
      });
    } catch (e) {
      const msgs = getConvo(get(), convoId).messages.slice();
      if (msgs.length > 0 && isStreaming(msgs[msgs.length - 1])) msgs.pop();
      set((s) =>
        patchConvo(s, convoId, {
          messages: msgs,
          streaming: false,
          currentTurnId: null,
          errorMessage: messageOf(e),
        }) as ChatStore,
      );
      turnDoneEmitter.delete(turnId);
      return;
    }

    await done;

    const convo = getConvo(get(), convoId);
    if (convo.errorMessage) {
      set((s) =>
        patchConvo(s, convoId, { streaming: false, currentTurnId: null }) as ChatStore,
      );
      return;
    }
    const last = convo.messages[convo.messages.length - 1];
    if (!last || isStreaming(last) || last.role !== "assistant") {
      set((s) =>
        patchConvo(s, convoId, { streaming: false, currentTurnId: null }) as ChatStore,
      );
      return;
    }
    const assistant = last;
    const toolUses = assistant.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );
    if (toolUses.length === 0) {
      set((s) =>
        patchConvo(s, convoId, { streaming: false, currentTurnId: null }) as ChatStore,
      );
      scheduleSave(convoId, get);
      return;
    }

    const autos = toolUses.filter((t) => !requiresApproval(t));
    const approvals = toolUses.filter((t) => requiresApproval(t));

    const autoResults: Record<string, { content: string; is_error: boolean }> = {};
    for (const t of autos) {
      const res = await dispatchTool(t);
      autoResults[t.id] = { content: res.content, is_error: res.isError };
    }

    const newHistory: Message[] = [...messages, assistant];

    if (approvals.length > 0) {
      set((s) =>
        patchConvo(s, convoId, {
          pending: { tools: approvals, autoResults, history: newHistory },
          streaming: false,
          currentTurnId: null,
        }) as ChatStore,
      );
      scheduleSave(convoId, get);
      return;
    }

    const resultMsg = buildToolResultMessage(toolUses, autoResults);
    set((s) =>
      patchConvo(s, convoId, {
        messages: [...getConvo(s, convoId).messages, resultMsg],
      }) as ChatStore,
    );
    scheduleSave(convoId, get);
    messages = [...newHistory, resultMsg];
  }
  set((s) =>
    patchConvo(s, convoId, { streaming: false, currentTurnId: null }) as ChatStore,
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
