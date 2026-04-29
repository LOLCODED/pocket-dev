import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  path: string; // relative to project root, forward slashes
  is_dir: boolean;
}

export const fsService = {
  listDir: (relPath: string) => invoke<DirEntry[]>("list_dir", { relPath }),
  readFile: (relPath: string) => invoke<string>("read_file", { relPath }),
  writeFile: (relPath: string, contents: string) =>
    invoke<void>("write_file", { relPath, contents }),
  createFile: (relPath: string) => invoke<void>("create_file", { relPath }),
  createDir: (relPath: string) => invoke<void>("create_dir", { relPath }),
  deletePath: (relPath: string) => invoke<void>("delete_path", { relPath }),
  renamePath: (from: string, to: string) =>
    invoke<void>("rename_path", { from, to }),
};
