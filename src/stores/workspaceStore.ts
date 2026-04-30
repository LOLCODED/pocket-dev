import { create } from "zustand";

export type ToolName = "files" | "database" | "api" | "terminal";

type WorkspaceStore = {
  openTool: ToolName | null;
  toggle: (t: ToolName) => void;
  open: (t: ToolName) => void;
  close: () => void;
  activeTerminalSessionId: string | null;
  setActiveTerminalSessionId: (id: string | null) => void;
};

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  openTool: null,
  toggle: (t) => set({ openTool: get().openTool === t ? null : t }),
  open: (t) => set({ openTool: t }),
  close: () => set({ openTool: null }),
  activeTerminalSessionId: null,
  setActiveTerminalSessionId: (id) => set({ activeTerminalSessionId: id }),
}));
