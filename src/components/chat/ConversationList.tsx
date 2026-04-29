import { useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

export function ConversationList() {
  const conversations = useChatStore((s) => s.conversations);
  const currentId = useChatStore((s) => s.currentId);
  const newConversation = useChatStore((s) => s.newConversation);
  const switchTo = useChatStore((s) => s.switchTo);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);

  return (
    <aside className="w-56 shrink-0 bg-(--color-panel) border-r border-(--color-border) flex flex-col">
      <div className="h-9 shrink-0 px-2 flex items-center border-b border-(--color-border)">
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-start h-7"
          onClick={() => newConversation().catch((e) => toast.error(messageOf(e)))}
        >
          <Plus className="size-3.5" /> New conversation
        </Button>
      </div>
      <nav className="flex-1 overflow-auto py-1">
        {conversations.length === 0 ? (
          <div className="px-3 py-2 text-xs text-(--color-fg-muted)">
            No conversations yet.
          </div>
        ) : (
          <ul>
            {conversations.map((c) => (
              <ConvoRow
                key={c.id}
                id={c.id}
                title={c.title}
                isActive={c.id === currentId}
                onSelect={() => switchTo(c.id)}
                onDelete={() => deleteConversation(c.id)}
                onRename={(t) => renameConversation(c.id, t)}
              />
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}

function ConvoRow({
  id,
  title,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  id: string;
  title: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  function commitRename() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== title) {
      onRename(draft);
    } else {
      setDraft(title);
    }
  }

  return (
    <li
      key={id}
      className={cn(
        "group flex items-center gap-1 px-1.5 mx-1 rounded text-sm",
        isActive
          ? "bg-(--color-panel-2) text-(--color-fg)"
          : "text-(--color-fg-muted) hover:bg-(--color-panel-2) hover:text-(--color-fg)",
      )}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(title);
            }
          }}
          className="flex-1 h-7 bg-transparent text-sm outline-none"
        />
      ) : (
        <button
          onDoubleClick={() => setEditing(true)}
          onClick={onSelect}
          className="flex-1 flex items-center gap-2 h-7 text-left min-w-0"
          title={title}
        >
          <MessageSquare className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">{title}</span>
        </button>
      )}
      {!editing && (
        <button
          onClick={onDelete}
          className="size-6 rounded items-center justify-center text-(--color-fg-muted) hover:text-(--color-danger) opacity-0 group-hover:flex"
          title="Delete"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
