import { create } from "zustand";

export type ToolName = "files" | "database" | "api";

type WorkspaceStore = {
  openTool: ToolName | null;
  toggle: (t: ToolName) => void;
  open: (t: ToolName) => void;
  close: () => void;
};

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  openTool: null,
  toggle: (t) => set({ openTool: get().openTool === t ? null : t }),
  open: (t) => set({ openTool: t }),
  close: () => set({ openTool: null }),
}));
