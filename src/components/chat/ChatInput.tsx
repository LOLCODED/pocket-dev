import { useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { useChatStore } from "../../stores/chatStore";

export function ChatInput({ canSend }: { canSend: boolean }) {
  const [text, setText] = useState("");
  const send = useChatStore((s) => s.send);
  const cancel = useChatStore((s) => s.cancel);
  const streaming = useChatStore((s) => s.streaming);

  async function submit() {
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      await send(t);
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-(--color-border) p-3 flex gap-2 items-end">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        rows={1}
        disabled={!canSend && !streaming}
        placeholder={canSend ? "Ask the assistant..." : "Configure the assistant first"}
        className="flex-1 resize-none rounded-md border border-(--color-border) bg-(--color-panel-2) px-3 py-2 text-sm text-(--color-fg) placeholder:text-(--color-fg-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) min-h-9 max-h-40"
      />
      {streaming ? (
        <Button size="icon" variant="destructive" onClick={() => cancel()}>
          <Square className="size-4" />
        </Button>
      ) : (
        <Button size="icon" onClick={submit} disabled={!canSend || !text.trim()}>
          <Send className="size-4" />
        </Button>
      )}
    </div>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
