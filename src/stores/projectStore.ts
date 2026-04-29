import { create } from "zustand";
import { projectService, type RecentProject } from "../lib/services/project";

type ProjectStore = {
  current: RecentProject | null;
  recents: RecentProject[];
  loading: boolean;
  hydrate: () => Promise<void>;
  open: (path: string) => Promise<void>;
  close: () => Promise<void>;
};

export const useProjectStore = create<ProjectStore>((set) => ({
  current: null,
  recents: [],
  loading: true,
  hydrate: async () => {
    set({ loading: true });
    const [current, recents] = await Promise.all([
      projectService.current(),
      projectService.listRecent(),
    ]);
    set({ current, recents, loading: false });
  },
  open: async (path) => {
    const current = await projectService.setRoot(path);
    const recents = await projectService.listRecent();
    set({ current, recents });
  },
  close: async () => {
    await projectService.close();
    set({ current: null });
  },
}));
