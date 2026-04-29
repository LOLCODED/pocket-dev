import { create } from "zustand";
import {
  httpService,
  type HttpRequest,
  type HttpResponse,
  type SavedEndpoint,
} from "../lib/services/http";

type ApiStore = {
  draft: HttpRequest;
  response: HttpResponse | null;
  saved: SavedEndpoint[];
  loading: boolean;
  errorMessage: string | null;

  setDraft: (patch: Partial<HttpRequest>) => void;
  setHeaderAt: (i: number, h: { name: string; value: string }) => void;
  addHeader: () => void;
  removeHeaderAt: (i: number) => void;

  send: () => Promise<void>;
  hydrate: () => Promise<void>;
  saveCurrent: (name: string) => Promise<void>;
  loadEndpoint: (e: SavedEndpoint) => void;
  remove: (id: string) => Promise<void>;
};

const DEFAULT_DRAFT: HttpRequest = {
  method: "GET",
  url: "https://httpbin.org/get",
  headers: [],
  body: "",
};

export const useApiStore = create<ApiStore>((set, get) => ({
  draft: DEFAULT_DRAFT,
  response: null,
  saved: [],
  loading: false,
  errorMessage: null,

  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

  setHeaderAt: (i, h) =>
    set((s) => {
      const next = s.draft.headers.slice();
      next[i] = h;
      return { draft: { ...s.draft, headers: next } };
    }),

  addHeader: () =>
    set((s) => ({
      draft: { ...s.draft, headers: [...s.draft.headers, { name: "", value: "" }] },
    })),

  removeHeaderAt: (i) =>
    set((s) => ({
      draft: { ...s.draft, headers: s.draft.headers.filter((_, j) => j !== i) },
    })),

  send: async () => {
    set({ loading: true, errorMessage: null });
    try {
      const draft = get().draft;
      const cleaned: HttpRequest = {
        ...draft,
        headers: draft.headers.filter((h) => h.name.trim()),
        body: draft.body && draft.body.trim() ? draft.body : null,
      };
      const response = await httpService.send(cleaned);
      set({ response });
    } catch (e) {
      set({ errorMessage: messageOf(e), response: null });
    } finally {
      set({ loading: false });
    }
  },

  hydrate: async () => {
    const saved = await httpService.listSaved().catch(() => []);
    set({ saved });
  },

  saveCurrent: async (name) => {
    const draft = get().draft;
    const e = await httpService.save({
      id: "",
      name,
      method: draft.method,
      url: draft.url,
      headers: draft.headers,
      body: draft.body,
    });
    set({ saved: [e, ...get().saved.filter((s) => s.id !== e.id)] });
  },

  loadEndpoint: (e) =>
    set({
      draft: {
        method: e.method,
        url: e.url,
        headers: e.headers,
        body: e.body ?? "",
      },
    }),

  remove: async (id) => {
    await httpService.delete(id);
    set({ saved: get().saved.filter((s) => s.id !== id) });
  },
}));

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
