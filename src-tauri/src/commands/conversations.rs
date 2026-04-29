use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::path::PathBuf;
use tauri::State;

use crate::ai::provider::Message;
use crate::error::{AppError, AppResult};
use crate::paths;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub created_ms: i64,
    pub updated_ms: i64,
    #[serde(default)]
    pub messages: Vec<Message>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConversationSummary {
    pub id: String,
    pub title: String,
    pub created_ms: i64,
    pub updated_ms: i64,
}

fn project_hash(path: &std::path::Path) -> String {
    let mut hasher = Sha1::new();
    hasher.update(path.to_string_lossy().as_bytes());
    let bytes = hasher.finalize();
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

async fn project_file(state: &AppState) -> AppResult<PathBuf> {
    let root = state
        .current_root()
        .await
        .ok_or(AppError::NoProjectOpen)?;
    Ok(paths::conversations_dir()?.join(format!("{}.json", project_hash(&root))))
}

fn read_all(path: &std::path::Path) -> AppResult<Vec<Conversation>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(path)?;
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

fn write_all(path: &std::path::Path, items: &[Conversation]) -> AppResult<()> {
    std::fs::write(path, serde_json::to_string_pretty(items)?)?;
    Ok(())
}

#[tauri::command]
pub async fn list_conversations(state: State<'_, AppState>) -> AppResult<Vec<ConversationSummary>> {
    let path = project_file(&state).await?;
    let mut all = read_all(&path)?;
    all.sort_by(|a, b| b.updated_ms.cmp(&a.updated_ms));
    Ok(all
        .into_iter()
        .map(|c| ConversationSummary {
            id: c.id,
            title: c.title,
            created_ms: c.created_ms,
            updated_ms: c.updated_ms,
        })
        .collect())
}

#[tauri::command]
pub async fn get_conversation(
    id: String,
    state: State<'_, AppState>,
) -> AppResult<Option<Conversation>> {
    let path = project_file(&state).await?;
    let all = read_all(&path)?;
    Ok(all.into_iter().find(|c| c.id == id))
}

#[tauri::command]
pub async fn save_conversation(
    conversation: Conversation,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let path = project_file(&state).await?;
    let mut all = read_all(&path)?;
    all.retain(|c| c.id != conversation.id);
    all.push(conversation);
    write_all(&path, &all)
}

#[tauri::command]
pub async fn delete_conversation(id: String, state: State<'_, AppState>) -> AppResult<()> {
    let path = project_file(&state).await?;
    let mut all = read_all(&path)?;
    all.retain(|c| c.id != id);
    write_all(&path, &all)
}
