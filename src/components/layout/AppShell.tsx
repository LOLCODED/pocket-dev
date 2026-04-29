import { useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { ToolRail } from "./ToolRail";
import { ToolDrawer } from "./ToolDrawer";
import { ConversationList } from "../chat/ConversationList";
import { ChatThread } from "../chat/ChatThread";
import { SettingsDialog } from "../chat/SettingsDialog";
import { useProjectStore } from "../../stores/projectStore";
import { useChatStore } from "../../stores/chatStore";

export function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const projectPath = useProjectStore((s) => s.current?.path ?? null);
  const hydrateChat = useChatStore((s) => s.hydrate);
  const resetChat = useChatStore((s) => s.resetForProjectChange);

  useEffect(() => {
    if (!projectPath) return;
    resetChat();
    hydrateChat();
    // Re-run when the project path changes.
  }, [projectPath, hydrateChat, resetChat]);

  return (
    <div className="h-full w-full flex flex-col">
      <TopBar onSettings={() => setSettingsOpen(true)} />
      <div className="flex-1 flex relative overflow-hidden">
        <ConversationList />
        <ChatThread onConfigure={() => setSettingsOpen(true)} />
        <ToolDrawer />
        <ToolRail />
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
