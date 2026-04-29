import { create } from "zustand";
import {
  settingsService,
  type LlmProviderKind,
  type Settings,
} from "../lib/services/settings";

type SettingsStore = {
  settings: Settings | null;
  hasKey: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  save: (s: Settings) => Promise<void>;
  setApiKey: (provider: LlmProviderKind, key: string) => Promise<void>;
  clearApiKey: (provider: LlmProviderKind) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  hasKey: false,
  loading: true,
  hydrate: async () => {
    set({ loading: true });
    const settings = await settingsService.get();
    const hasKey = await settingsService.hasApiKey(settings.provider);
    set({ settings, hasKey, loading: false });
  },
  save: async (s) => {
    await settingsService.set(s);
    const hasKey = await settingsService.hasApiKey(s.provider);
    set({ settings: s, hasKey });
  },
  setApiKey: async (provider, key) => {
    await settingsService.setApiKey(provider, key);
    if (get().settings?.provider === provider) {
      set({ hasKey: true });
    }
  },
  clearApiKey: async (provider) => {
    await settingsService.clearApiKey(provider);
    if (get().settings?.provider === provider) {
      set({ hasKey: false });
    }
  },
}));
