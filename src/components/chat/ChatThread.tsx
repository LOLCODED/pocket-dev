import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { PendingDiffCard } from "./PendingDiffCard";
import { useSettingsStore } from "../../stores/settingsStore";
import { useChatStore } from "../../stores/chatStore";

export function ChatThread({ onConfigure }: { onConfigure: () => void }) {
  const settings = useSettingsStore((s) => s.settings);
  const hasKey = useSettingsStore((s) => s.hasKey);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    useChatStore.getState().initListener().then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const canSend = hasKey && !!settings;

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-(--color-bg)">
      {!canSend ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div className="space-y-3 max-w-sm">
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-(--color-panel-2) text-(--color-accent)">
              <Sparkles className="size-6" />
            </div>
            <div className="text-sm text-(--color-fg-muted)">
              Add an Anthropic API key to start chatting.
            </div>
            <Button onClick={onConfigure}>Configure assistant</Button>
          </div>
        </div>
      ) : (
        <MessageList />
      )}
      <PendingDiffCard />
      <ChatInput canSend={canSend} />
    </section>
  );
}
