import { FileTree } from "./FileTree";
import { FileEditor } from "./FileEditor";

export function FilesPanel() {
  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0 border-r border-(--color-border)">
        <FileTree />
      </div>
      <FileEditor />
    </div>
  );
}
