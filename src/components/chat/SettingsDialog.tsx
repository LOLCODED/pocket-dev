import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useSettingsStore } from "../../stores/settingsStore";
import type { LlmProviderKind } from "../../lib/services/settings";

const MODEL_DEFAULTS: Record<LlmProviderKind, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  ollama: "llama3.1",
};

const OLLAMA_DEFAULT_URL = "http://localhost:11434";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const hasKey = useSettingsStore((s) => s.hasKey);

  const [provider, setProvider] = useState<LlmProviderKind>("anthropic");
  const [model, setModel] = useState("");
  const [apiKey, setKey] = useState("");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && settings) {
      setProvider(settings.provider);
      setModel(settings.model);
      setKey("");
      setOllamaBaseUrl(settings.ollama_base_url ?? "");
    }
  }, [open, settings]);

  function changeProvider(p: LlmProviderKind) {
    setProvider(p);
    if (!model || model === MODEL_DEFAULTS[provider]) {
      setModel(MODEL_DEFAULTS[p]);
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      const baseUrl = ollamaBaseUrl.trim();
      await save({
        provider,
        model,
        ollama_base_url: provider === "ollama" ? (baseUrl || null) : settings?.ollama_base_url,
      });
      if (provider !== "ollama" && apiKey.trim()) {
        await setApiKey(provider, apiKey.trim());
      }
      toast.success("Settings saved");
      onClose();
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Assistant settings">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs text-(--color-fg-muted)">Provider</label>
          <div className="flex gap-2">
            {(["anthropic", "openai", "ollama"] as LlmProviderKind[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => changeProvider(p)}
                className={
                  "flex-1 h-9 rounded-md border text-sm capitalize transition-colors " +
                  (provider === p
                    ? "bg-(--color-accent) text-white border-(--color-accent)"
                    : "bg-(--color-panel-2) border-(--color-border) text-(--color-fg) hover:bg-(--color-border)")
                }
              >
                {p}
              </button>
            ))}
          </div>
          {provider !== "anthropic" && (
            <div className="text-xs text-(--color-fg-muted)">
              Only Anthropic is implemented in this build. Other providers are stubs.
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-(--color-fg-muted)">Model</label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-sonnet-4-6" />
        </div>

        {provider === "ollama" ? (
          <div className="space-y-1.5">
            <label className="text-xs text-(--color-fg-muted)">Base URL</label>
            <Input
              type="url"
              value={ollamaBaseUrl}
              onChange={(e) => setOllamaBaseUrl(e.target.value)}
              placeholder={OLLAMA_DEFAULT_URL}
            />
            <div className="text-xs text-(--color-fg-muted)">
              URL of your local Ollama server. Leave blank to use {OLLAMA_DEFAULT_URL}.
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs text-(--color-fg-muted)">
              API key {hasKey && provider === settings?.provider && (
                <span className="text-(--color-accent) ml-1">(stored)</span>
              )}
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setKey(e.target.value)}
              placeholder={hasKey ? "•••••••••••• (leave blank to keep)" : "Paste your key"}
            />
            <div className="text-xs text-(--color-fg-muted)">
              Stored securely in your operating system keychain.
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
