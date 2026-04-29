import { invoke } from "@tauri-apps/api/core";

export type LlmProviderKind = "anthropic" | "openai" | "ollama";

export interface Settings {
  provider: LlmProviderKind;
  model: string;
  ollama_base_url?: string | null;
}

export const settingsService = {
  get: () => invoke<Settings>("get_settings"),
  set: (settings: Settings) => invoke<void>("set_settings", { settings }),
  setApiKey: (provider: LlmProviderKind, key: string) =>
    invoke<void>("set_api_key", { provider, key }),
  clearApiKey: (provider: LlmProviderKind) =>
    invoke<void>("clear_api_key", { provider }),
  hasApiKey: (provider: LlmProviderKind) =>
    invoke<boolean>("has_api_key", { provider }),
};
