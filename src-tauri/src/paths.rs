use std::path::PathBuf;

use crate::error::{AppError, AppResult};

pub fn config_dir() -> AppResult<PathBuf> {
    let base = dirs::config_dir().ok_or_else(|| AppError::Config("no config dir".into()))?;
    let dir = base.join("pocket-dev");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

pub fn conversations_dir() -> AppResult<PathBuf> {
    let dir = config_dir()?.join("conversations");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}
