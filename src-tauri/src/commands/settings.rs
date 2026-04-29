use crate::error::AppResult;
use crate::secrets;
use crate::settings::{self, LlmProviderKind, Settings};

#[tauri::command]
pub async fn get_settings() -> AppResult<Settings> {
    settings::load()
}

#[tauri::command]
pub async fn set_settings(settings: Settings) -> AppResult<()> {
    settings::save(&settings)
}

#[tauri::command]
pub async fn set_api_key(provider: LlmProviderKind, key: String) -> AppResult<()> {
    secrets::set(&provider.keychain_key(), &key)
}

#[tauri::command]
pub async fn clear_api_key(provider: LlmProviderKind) -> AppResult<()> {
    secrets::delete(&provider.keychain_key())
}

#[tauri::command]
pub async fn has_api_key(provider: LlmProviderKind) -> AppResult<bool> {
    Ok(secrets::get(&provider.keychain_key())?.is_some())
}
