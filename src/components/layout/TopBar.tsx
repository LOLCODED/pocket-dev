import { Settings, Sparkles } from "lucide-react";
import { ProjectMenu } from "./ProjectMenu";
import { Button } from "../ui/button";

export function TopBar({ onSettings }: { onSettings: () => void }) {
  return (
    <header className="h-11 shrink-0 bg-(--color-panel) border-b border-(--color-border) flex items-center px-2 gap-2">
      <ProjectMenu />
      <div className="flex-1 flex items-center justify-center gap-1.5 text-xs text-(--color-fg-muted)">
        <Sparkles className="size-3.5" />
        <span>pocket-dev</span>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="size-8"
        onClick={onSettings}
        title="Assistant settings"
      >
        <Settings className="size-4" />
      </Button>
    </header>
  );
}
