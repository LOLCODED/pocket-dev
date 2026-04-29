import { create } from "zustand";
import { fsService, type DirEntry } from "../lib/services/fs";

type DirCache = Record<string, DirEntry[] | undefined>;

type FilesStore = {
  dirs: DirCache;
  expanded: Set<string>;
  showHidden: boolean;

  openPath: string | null;
  openContents: string;
  savedContents: string;
  loadingFile: boolean;

  loadDir: (relPath: string) => Promise<void>;
  toggleExpanded: (relPath: string) => Promise<void>;
  toggleHidden: () => void;

  openFile: (relPath: string) => Promise<void>;
  setEditor: (contents: string) => void;
  saveOpen: () => Promise<void>;
  closeFile: () => void;

  refreshDir: (relPath: string) => Promise<void>;
  reset: () => void;
};

const HIDDEN_PREFIXES = [".", "node_modules", "dist", "target"];

export const useFilesStore = create<FilesStore>((set, get) => ({
  dirs: {},
  expanded: new Set([""]),
  showHidden: false,
  openPath: null,
  openContents: "",
  savedContents: "",
  loadingFile: false,

  loadDir: async (relPath) => {
    const entries = await fsService.listDir(relPath);
    set((s) => ({ dirs: { ...s.dirs, [relPath]: entries } }));
  },

  toggleExpanded: async (relPath) => {
    const next = new Set(get().expanded);
    if (next.has(relPath)) {
      next.delete(relPath);
    } else {
      next.add(relPath);
      if (!get().dirs[relPath]) {
        await get().loadDir(relPath);
      }
    }
    set({ expanded: next });
  },

  toggleHidden: () => set((s) => ({ showHidden: !s.showHidden })),

  openFile: async (relPath) => {
    set({ loadingFile: true, openPath: relPath });
    try {
      const contents = await fsService.readFile(relPath);
      set({ openContents: contents, savedContents: contents, loadingFile: false });
    } catch (e) {
      set({ loadingFile: false });
      throw e;
    }
  },

  setEditor: (contents) => set({ openContents: contents }),

  saveOpen: async () => {
    const { openPath, openContents } = get();
    if (!openPath) return;
    await fsService.writeFile(openPath, openContents);
    set({ savedContents: openContents });
  },

  closeFile: () =>
    set({ openPath: null, openContents: "", savedContents: "" }),

  refreshDir: async (relPath) => {
    await get().loadDir(relPath);
  },

  reset: () =>
    set({
      dirs: {},
      expanded: new Set([""]),
      openPath: null,
      openContents: "",
      savedContents: "",
    }),
}));

export function isHidden(name: string): boolean {
  return HIDDEN_PREFIXES.some((p) =>
    p.startsWith(".") ? name.startsWith(p) : name === p,
  );
}
