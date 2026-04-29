use serde::Serialize;
use tauri::State;
use tokio::fs;

use crate::error::{AppError, AppResult};
use crate::fs_safety::resolve_safe_path;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String, // relative to project_root, forward slashes
    pub is_dir: bool,
}

async fn project_root(state: &AppState) -> AppResult<std::path::PathBuf> {
    state.current_root().await.ok_or(AppError::NoProjectOpen)
}

#[tauri::command]
pub async fn list_dir(
    rel_path: String,
    state: State<'_, AppState>,
) -> AppResult<Vec<DirEntry>> {
    let root = project_root(&state).await?;
    let path = if rel_path.is_empty() || rel_path == "." {
        root.clone()
    } else {
        resolve_safe_path(&root, &rel_path)?
    };

    let mut entries = fs::read_dir(&path).await?;
    let mut out: Vec<DirEntry> = Vec::new();

    while let Some(entry) = entries.next_entry().await? {
        let file_type = entry.file_type().await?;
        let name = entry.file_name().to_string_lossy().to_string();
        let abs = entry.path();
        let rel = abs
            .strip_prefix(&root)
            .unwrap_or(&abs)
            .to_string_lossy()
            .replace('\\', "/");
        out.push(DirEntry {
            name,
            path: rel,
            is_dir: file_type.is_dir(),
        });
    }

    out.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(out)
}

#[tauri::command]
pub async fn read_file(
    rel_path: String,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let root = project_root(&state).await?;
    let path = resolve_safe_path(&root, &rel_path)?;
    if !path.exists() {
        return Err(AppError::FileNotFound(rel_path));
    }
    let bytes = fs::read(&path).await?;
    // Reject binary-looking content for the editor; UI should surface this.
    if bytes.iter().take(8000).any(|b| *b == 0) {
        return Err(AppError::InvalidInput("file appears to be binary".into()));
    }
    String::from_utf8(bytes).map_err(|_| AppError::InvalidInput("file is not valid UTF-8".into()))
}

#[tauri::command]
pub async fn write_file(
    rel_path: String,
    contents: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let root = project_root(&state).await?;
    let path = resolve_safe_path(&root, &rel_path)?;
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).await?;
        }
    }
    fs::write(&path, contents).await?;
    Ok(())
}

#[tauri::command]
pub async fn create_file(
    rel_path: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let root = project_root(&state).await?;
    let path = resolve_safe_path(&root, &rel_path)?;
    if path.exists() {
        return Err(AppError::InvalidInput("path already exists".into()));
    }
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).await?;
        }
    }
    fs::write(&path, "").await?;
    Ok(())
}

#[tauri::command]
pub async fn create_dir(
    rel_path: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let root = project_root(&state).await?;
    let path = resolve_safe_path(&root, &rel_path)?;
    if path.exists() {
        return Err(AppError::InvalidInput("path already exists".into()));
    }
    fs::create_dir_all(&path).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_path(
    rel_path: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let root = project_root(&state).await?;
    let path = resolve_safe_path(&root, &rel_path)?;
    if !path.exists() {
        return Err(AppError::FileNotFound(rel_path));
    }
    if path.is_dir() {
        fs::remove_dir_all(&path).await?;
    } else {
        fs::remove_file(&path).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn rename_path(
    from: String,
    to: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let root = project_root(&state).await?;
    let src = resolve_safe_path(&root, &from)?;
    let dst = resolve_safe_path(&root, &to)?;
    if !src.exists() {
        return Err(AppError::FileNotFound(from));
    }
    if dst.exists() {
        return Err(AppError::InvalidInput("destination already exists".into()));
    }
    if let Some(parent) = dst.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).await?;
        }
    }
    fs::rename(&src, &dst).await?;
    Ok(())
}
