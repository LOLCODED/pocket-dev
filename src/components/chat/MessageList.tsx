import { useEffect, useRef } from "react";
import { useChatStore } from "../../stores/chatStore";
import { ToolCard } from "./ToolCard";
import type { ContentBlock } from "../../lib/ai/types";

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const errorMessage = useChatStore((s) => s.errorMessage);
  const pending = useChatStore((s) => s.pending);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages, errorMessage, pending]);

  if (messages.length === 0 && !errorMessage) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-sm text-(--color-fg-muted) text-center">
        Ask the assistant anything about your project.
      </div>
    );
  }

  return (
    <div ref={ref} className="flex-1 overflow-auto p-3 space-y-3">
      {messages.map((m, i) => {
        if (isToolResultMessage(m.content)) {
          // Hide internal tool-result messages from the user.
          return null;
        }
        const isUser = m.role === "user";
        return (
          <div
            key={i}
            className={
              "max-w-full text-sm space-y-2 " +
              (isUser ? "ml-6" : "mr-6")
            }
          >
            {m.content.map((b, j) => {
              if (b.type === "text") {
                if (!b.text) {
                  return isUser ? null : (
                    <div
                      key={j}
                      className="rounded-md px-3 py-2 bg-(--color-panel-2) text-(--color-fg-muted) italic"
                    >
                      …
                    </div>
                  );
                }
                return (
                  <div
                    key={j}
                    className={
                      "rounded-md px-3 py-2 whitespace-pre-wrap break-words " +
                      (isUser
                        ? "bg-(--color-accent) text-white"
                        : "bg-(--color-panel-2) text-(--color-fg)")
                    }
                  >
                    {b.text}
                  </div>
                );
              }
              if (b.type === "tool_use") {
                const status = pending?.tools.some((t) => t.id === b.id) ? "pending" : "auto";
                return <ToolCard key={j} name={b.name} input={b.input} status={status} />;
              }
              return null;
            })}
          </div>
        );
      })}
      {errorMessage && (
        <div className="rounded-md px-3 py-2 text-sm bg-(--color-danger)/20 border border-(--color-danger)/40 text-(--color-fg)">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

function isToolResultMessage(content: ContentBlock[]): boolean {
  return content.length > 0 && content.every((b) => b.type === "tool_result");
}
