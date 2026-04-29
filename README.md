# pocket-dev

An AI-first, simplified development environment for non-technical users. The chat assistant
is the primary interface; a file tree, a Postgres viewer, and a small HTTP request tool are
secondary panels for the user to peek at and lightly interact with.

## Features

- **Chat panel** — streaming assistant with tool-use support
  - Read-only tools (`list_dir`, `read_file`, SELECT `run_sql`, GET `http_request`) auto-execute
  - Mutating tools (`write_file`, non-SELECT SQL, non-GET HTTP) require user approval
  - Auto-snapshot before applying changes (silent git, separate `.git` dir)
- **Files panel** — sandboxed file tree + CodeMirror editor (Cmd/Ctrl-S to save)
- **Database panel** — Postgres connection, table list, paginated row viewer
- **API panel** — HTTP request form with saved endpoints
- **Secrets** — LLM API key and DB connection URL stored in OS keychain
- **Pluggable LLM** — Anthropic implemented; OpenAI / Ollama scaffolded as stubs

## Run

```bash
bun install
bun run tauri:dev    # Linux: presets WEBKIT_DISABLE_DMABUF_RENDERER=1 for Wayland
# or:
bun run tauri dev    # Mac/Windows, or Linux/X11
```

If you see `Gdk-Message: Error 71 (Protocol error) dispatching to Wayland display.`
on startup, use `tauri:dev` (it sets the Wayland workaround env var) or fall back to
X11 with `GDK_BACKEND=x11 bun run tauri dev`.

Then click **Open folder** to pick a project, click the gear in the chat panel to add
your Anthropic API key, and start asking the assistant for help.

### Build

```bash
bun run tauri build
```

## Architecture (high-level)

```
src/                      React + TS frontend
  components/
    chat/                 ChatThread, ConversationList, MessageList, ToolCard,
                          PendingDiffCard, SettingsDialog, ChatInput
    files/                FilesPanel + FileTree + FileEditor (CodeMirror)
    database/             DatabasePanel + ConnectionForm + TableList + TableViewer
    api/                  ApiPanel + RequestForm + ResponseViewer + SavedEndpointsList
    layout/               AppShell, TopBar, ProjectMenu, ToolRail, ToolDrawer,
                          ProjectPicker
    ui/                   Button, Input, Dialog, Panel
  stores/                 Zustand stores per domain
  lib/services/           Tauri invoke wrappers
  lib/ai/                 Tool schemas + dispatcher
src-tauri/src/
  state.rs                AppState (project_root, db_pool, http, chat_aborts)
  error.rs                Typed AppError serialised as {kind, message, retriable}
  fs_safety.rs            resolve_safe_path — single source of path-safety truth
  paths.rs                config_dir / conversations_dir helpers
  secrets.rs              keyring crate wrapper
  ai/{provider,anthropic,openai,ollama,agent}.rs
  commands/{project,fs,chat,settings,postgres,http,snapshot,conversations}.rs
```

## Layout

```
┌── top bar ────────────────────────────────────────────────┐
│ [⌂ project ▾]  pocket-dev                  [⚙]            │
├──────────────┬──────────────────────────────────┬────────┤
│ conv list    │  chat thread                     │ rail   │
│ [+ New]      │  user…                           │   ▤    │  ← Files
│ • title      │  assistant…                      │   ▣    │  ← Database
│ • title      │  [pending diff card]             │   ☰    │  ← API
│              │  [input ▶]                       │        │
└──────────────┴──────────────────────────────────┴────────┘
```

Click a tool icon to slide the corresponding panel in over the right ~55% of the
viewport. Click again (or ESC) to close.

Conversations are per-project, stored in `~/.config/pocket-dev/conversations/<sha1-of-project-path>.json`.
Switching projects via the top-bar dropdown reloads the conversation list automatically.

The agent loop lives in the frontend (`stores/chatStore.ts::runAgentLoop`). It posts a
turn to `chat_send`, awaits the streamed assistant message, classifies tool calls into
auto vs approval, dispatches autos via `lib/ai/tools.ts::dispatchTool`, and either
recurses or pauses for user approval.
