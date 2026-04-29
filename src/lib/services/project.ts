import { invoke } from "@tauri-apps/api/core";

export interface RecentProject {
  path: string;
  name: string;
  last_opened_ms: number;
}

export const projectService = {
  setRoot: (path: string) => invoke<RecentProject>("set_project_root", { path }),
  current: () => invoke<RecentProject | null>("current_project"),
  listRecent: () => invoke<RecentProject[]>("list_recent_projects"),
  close: () => invoke<void>("close_project"),
};
