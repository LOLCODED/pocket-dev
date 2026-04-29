use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

const RECENT_FILE: &str = "recent.json";
const MAX_RECENT: usize = 10;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentProject {
    pub path: String,
    pub name: String,
    pub last_opened_ms: i64,
}

fn config_dir() -> AppResult<PathBuf> {
    let base = dirs::config_dir().ok_or_else(|| AppError::Config("no config dir".into()))?;
    let dir = base.join("pocket-dev");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

fn read_recent() -> AppResult<Vec<RecentProject>> {
    let path = config_dir()?.join(RECENT_FILE);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

fn write_recent(items: &[RecentProject]) -> AppResult<()> {
    let path = config_dir()?.join(RECENT_FILE);
    let raw = serde_json::to_string_pretty(items)?;
    std::fs::write(path, raw)?;
    Ok(())
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub async fn set_project_root(
    path: String,
    state: State<'_, AppState>,
) -> AppResult<RecentProject> {
    let pb = PathBuf::from(&path);
    if !pb.exists() {
        return Err(AppError::FileNotFound(path));
    }
    if !pb.is_dir() {
        return Err(AppError::InvalidInput("path is not a directory".into()));
    }
    let canonical = pb.canonicalize()?;
    let name = canonical
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("project")
        .to_string();

    {
        let mut guard = state.project_root.lock().await;
        *guard = Some(canonical.clone());
    }

    let mut recents = read_recent().unwrap_or_default();
    let canon_str = canonical.to_string_lossy().to_string();
    recents.retain(|r| r.path != canon_str);
    let entry = RecentProject {
        path: canon_str,
        name,
        last_opened_ms: now_ms(),
    };
    recents.insert(0, entry.clone());
    recents.truncate(MAX_RECENT);
    write_recent(&recents)?;

    Ok(entry)
}

#[tauri::command]
pub async fn current_project(state: State<'_, AppState>) -> AppResult<Option<RecentProject>> {
    let root = state.current_root().await;
    Ok(root.map(|p| RecentProject {
        path: p.to_string_lossy().to_string(),
        name: p
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("project")
            .to_string(),
        last_opened_ms: now_ms(),
    }))
}

#[tauri::command]
pub async fn list_recent_projects() -> AppResult<Vec<RecentProject>> {
    read_recent()
}

#[tauri::command]
pub async fn close_project(state: State<'_, AppState>) -> AppResult<()> {
    let mut guard = state.project_root.lock().await;
    *guard = None;
    Ok(())
}
