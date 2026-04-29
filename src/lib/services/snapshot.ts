import { invoke } from "@tauri-apps/api/core";

export const snapshotService = {
  create: (label: string) => invoke<boolean>("create_snapshot", { label }),
};
