use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Instant;
use tauri::State;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

const ENDPOINTS_FILE: &str = "endpoints.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HttpHeader {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<HttpHeader>,
    #[serde(default)]
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: Vec<HttpHeader>,
    pub body: String,
    pub took_ms: u128,
    pub size_bytes: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedEndpoint {
    pub id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: Vec<HttpHeader>,
    #[serde(default)]
    pub body: Option<String>,
}

fn config_dir() -> AppResult<PathBuf> {
    let base = dirs::config_dir().ok_or_else(|| AppError::Config("no config dir".into()))?;
    let dir = base.join("pocket-dev");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

fn read_endpoints() -> AppResult<Vec<SavedEndpoint>> {
    let path = config_dir()?.join(ENDPOINTS_FILE);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

fn write_endpoints(items: &[SavedEndpoint]) -> AppResult<()> {
    let path = config_dir()?.join(ENDPOINTS_FILE);
    std::fs::write(path, serde_json::to_string_pretty(items)?)?;
    Ok(())
}

#[tauri::command]
pub async fn send_request(
    request: HttpRequest,
    state: State<'_, AppState>,
) -> AppResult<HttpResponse> {
    let method = reqwest::Method::from_bytes(request.method.to_uppercase().as_bytes())
        .map_err(|_| AppError::InvalidInput(format!("invalid HTTP method: {}", request.method)))?;

    let mut header_map = reqwest::header::HeaderMap::new();
    for h in &request.headers {
        if h.name.is_empty() {
            continue;
        }
        let name = reqwest::header::HeaderName::from_bytes(h.name.as_bytes())
            .map_err(|_| AppError::InvalidInput(format!("invalid header name: {}", h.name)))?;
        let value = reqwest::header::HeaderValue::from_str(&h.value)
            .map_err(|_| AppError::InvalidInput(format!("invalid header value: {}", h.value)))?;
        header_map.insert(name, value);
    }

    let mut builder = state
        .http
        .request(method, &request.url)
        .headers(header_map);
    if let Some(body) = &request.body {
        if !body.is_empty() {
            builder = builder.body(body.clone());
        }
    }

    let started = Instant::now();
    let resp = builder
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("request failed: {e}")))?;
    let status = resp.status().as_u16();
    let mut out_headers: Vec<HttpHeader> = Vec::new();
    let mut seen: HashMap<String, ()> = HashMap::new();
    for (k, v) in resp.headers().iter() {
        let name = k.as_str().to_string();
        if seen.insert(name.clone(), ()).is_none() {
            out_headers.push(HttpHeader {
                name,
                value: v.to_str().unwrap_or("<binary>").to_string(),
            });
        }
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| AppError::Internal(format!("read body failed: {e}")))?;
    let size_bytes = bytes.len();
    let body = match String::from_utf8(bytes.to_vec()) {
        Ok(s) => s,
        Err(_) => format!("<binary {size_bytes} bytes>"),
    };

    Ok(HttpResponse {
        status,
        headers: out_headers,
        body,
        took_ms: started.elapsed().as_millis(),
        size_bytes,
    })
}

#[tauri::command]
pub async fn list_saved_endpoints() -> AppResult<Vec<SavedEndpoint>> {
    read_endpoints()
}

#[tauri::command]
pub async fn save_endpoint(endpoint: SavedEndpoint) -> AppResult<SavedEndpoint> {
    let mut endpoints = read_endpoints()?;
    let mut e = endpoint;
    if e.id.is_empty() {
        e.id = Uuid::new_v4().to_string();
    }
    endpoints.retain(|x| x.id != e.id);
    endpoints.insert(0, e.clone());
    write_endpoints(&endpoints)?;
    Ok(e)
}

#[tauri::command]
pub async fn delete_endpoint(id: String) -> AppResult<()> {
    let mut endpoints = read_endpoints()?;
    endpoints.retain(|x| x.id != id);
    write_endpoints(&endpoints)
}
