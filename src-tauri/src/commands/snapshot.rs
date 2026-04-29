use std::process::Command;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Take a silent auto-snapshot of the current project. Uses git with a
/// `.pocketdev/snapshots/.git` git-dir so we never collide with a real
/// repo the user may init in their project.
///
/// Errors are converted to `Ok(false)` to keep the apply path resilient
/// when git is not installed; the caller can show a one-time toast.
#[tauri::command]
pub async fn create_snapshot(label: String, state: State<'_, AppState>) -> AppResult<bool> {
    let root = state
        .current_root()
        .await
        .ok_or(AppError::NoProjectOpen)?;
    let git_dir = root.join(".pocketdev").join("snapshots").join(".git");
    if let Some(parent) = git_dir.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent).await?;
        }
    }

    let init_needed = !git_dir.exists();

    let git_dir_arg = format!("--git-dir={}", git_dir.display());
    let work_tree_arg = format!("--work-tree={}", root.display());

    if init_needed {
        if !run_git(&[&git_dir_arg, &work_tree_arg, "init", "-q"]).await {
            return Ok(false);
        }
        let _ = run_git(&[
            &git_dir_arg,
            &work_tree_arg,
            "config",
            "user.email",
            "snapshots@pocket-dev.local",
        ])
        .await;
        let _ = run_git(&[
            &git_dir_arg,
            &work_tree_arg,
            "config",
            "user.name",
            "pocket-dev snapshots",
        ])
        .await;
    }

    if !run_git(&[&git_dir_arg, &work_tree_arg, "add", "-A"]).await {
        return Ok(false);
    }
    let msg = format!("auto-snapshot: {label}");
    if !run_git(&[
        &git_dir_arg,
        &work_tree_arg,
        "commit",
        "-q",
        "--allow-empty",
        "-m",
        &msg,
    ])
    .await
    {
        return Ok(false);
    }

    Ok(true)
}

async fn run_git(args: &[&str]) -> bool {
    let owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    tokio::task::spawn_blocking(move || {
        Command::new("git")
            .args(owned.iter().map(|s| s.as_str()))
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    })
    .await
    .unwrap_or(false)
}
