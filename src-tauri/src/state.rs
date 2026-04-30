use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task::AbortHandle;

use crate::commands::terminal::PtySession;

#[derive(Default)]
pub struct AppState {
    pub project_root: Mutex<Option<PathBuf>>,
    pub chat_aborts: Mutex<HashMap<String, AbortHandle>>,
    pub http: Arc<reqwest::Client>,
    pub db_pool: Mutex<Option<sqlx::PgPool>>,
    pub terminals: Mutex<HashMap<String, Arc<PtySession>>>,
}

impl AppState {
    pub async fn current_root(&self) -> Option<PathBuf> {
        self.project_root.lock().await.clone()
    }
}
