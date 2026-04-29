use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::{AppError, AppResult};

const SETTINGS_FILE: &str = "settings.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LlmProviderKind {
    Anthropic,
    Openai,
    Ollama,
}

impl Default for LlmProviderKind {
    fn default() -> Self {
        LlmProviderKind::Anthropic
    }
}

impl LlmProviderKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            LlmProviderKind::Anthropic => "anthropic",
            LlmProviderKind::Openai => "openai",
            LlmProviderKind::Ollama => "ollama",
        }
    }

    pub fn keychain_key(&self) -> String {
        format!("llm_api_key_{}", self.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub provider: LlmProviderKind,
    pub model: String,
    #[serde(default)]
    pub ollama_base_url: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            provider: LlmProviderKind::Anthropic,
            model: "claude-sonnet-4-6".into(),
            ollama_base_url: None,
        }
    }
}

fn config_dir() -> AppResult<PathBuf> {
    let base = dirs::config_dir().ok_or_else(|| AppError::Config("no config dir".into()))?;
    let dir = base.join("pocket-dev");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

pub fn load() -> AppResult<Settings> {
    let path = config_dir()?.join(SETTINGS_FILE);
    if !path.exists() {
        return Ok(Settings::default());
    }
    let raw = std::fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

pub fn save(s: &Settings) -> AppResult<()> {
    let path = config_dir()?.join(SETTINGS_FILE);
    let raw = serde_json::to_string_pretty(s)?;
    std::fs::write(path, raw)?;
    Ok(())
}
