use serde::Serialize;
use serde_json::Value;
use sqlx::postgres::{PgColumn, PgPoolOptions, PgRow};
use sqlx::{Column, Row, ValueRef};
use std::time::Instant;
use tauri::State;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::secrets;
use crate::state::AppState;

const KEY_PG_URL: &str = "pg_connection_url";

#[derive(Serialize)]
pub struct ColumnInfo {
    pub name: String,
    pub type_name: String,
}

#[derive(Serialize)]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<Value>>,
    pub rows_affected: u64,
    pub took_ms: u128,
}

#[derive(Serialize)]
pub struct TableInfo {
    pub schema: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct PageResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<Value>>,
    pub total: i64,
}

#[derive(Serialize)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub host_summary: Option<String>,
}

fn host_summary(url: &str) -> Option<String> {
    // Extract a short summary like "user@host:port/db" without exposing password.
    let u = url.parse::<url::Url>().ok()?;
    let user = u.username();
    let host = u.host_str().unwrap_or("");
    let port = u.port().map(|p| format!(":{p}")).unwrap_or_default();
    let db = u.path().trim_start_matches('/');
    Some(if user.is_empty() {
        format!("{host}{port}/{db}")
    } else {
        format!("{user}@{host}{port}/{db}")
    })
}

fn map_db_err<E: std::fmt::Display>(e: E) -> AppError {
    AppError::Db(e.to_string())
}

async fn pool<'a>(state: &'a AppState) -> AppResult<sqlx::PgPool> {
    let guard = state.db_pool.lock().await;
    guard.clone().ok_or(AppError::NotConnected)
}

fn sqlx_value_to_json(row: &PgRow, column: &PgColumn, index: usize) -> Value {
    let raw = row.try_get_raw(index);
    if let Ok(raw_value) = raw {
        if raw_value.is_null() {
            return Value::Null;
        }
    } else {
        return Value::Null;
    }

    let type_name = column.type_info().to_string().to_uppercase();

    match type_name.as_str() {
        "BOOL" => row
            .try_get::<bool, _>(index)
            .map(Value::Bool)
            .unwrap_or(Value::Null),

        "INT2" | "SMALLINT" | "SMALLSERIAL" => row
            .try_get::<i16, _>(index)
            .map(|v| Value::Number((v as i64).into()))
            .unwrap_or(Value::Null),

        "INT4" | "INT" | "INTEGER" | "SERIAL" | "OID" => row
            .try_get::<i32, _>(index)
            .map(|v| Value::Number((v as i64).into()))
            .unwrap_or(Value::Null),

        "INT8" | "BIGINT" | "BIGSERIAL" => row
            .try_get::<i64, _>(index)
            .map(|v| Value::Number(v.into()))
            .unwrap_or(Value::Null),

        "FLOAT4" | "REAL" => row
            .try_get::<f32, _>(index)
            .ok()
            .and_then(|f| serde_json::Number::from_f64(f as f64).map(Value::Number))
            .unwrap_or(Value::Null),

        "FLOAT8" | "DOUBLE PRECISION" => row
            .try_get::<f64, _>(index)
            .ok()
            .and_then(|f| serde_json::Number::from_f64(f).map(Value::Number))
            .unwrap_or(Value::Null),

        "NUMERIC" | "DECIMAL" => row
            .try_get::<rust_decimal::Decimal, _>(index)
            .map(|d| Value::String(d.to_string()))
            .unwrap_or(Value::Null),

        "TEXT" | "VARCHAR" | "CHAR" | "BPCHAR" | "NAME" => row
            .try_get::<String, _>(index)
            .map(Value::String)
            .unwrap_or(Value::Null),

        "TIMESTAMP" => row
            .try_get::<chrono::NaiveDateTime, _>(index)
            .map(|ts| Value::String(ts.to_string()))
            .unwrap_or(Value::Null),

        "TIMESTAMPTZ" => row
            .try_get::<chrono::DateTime<chrono::Utc>, _>(index)
            .map(|ts| Value::String(ts.to_rfc3339()))
            .unwrap_or(Value::Null),

        "JSON" | "JSONB" => row.try_get::<Value, _>(index).unwrap_or(Value::Null),

        "UUID" => row
            .try_get::<Uuid, _>(index)
            .map(|u| Value::String(u.to_string()))
            .unwrap_or(Value::Null),

        _ => row
            .try_get::<String, _>(index)
            .map(Value::String)
            .unwrap_or(Value::Null),
    }
}

fn rows_to_json(rows: &[PgRow]) -> (Vec<ColumnInfo>, Vec<Vec<Value>>) {
    let columns: Vec<ColumnInfo> = rows
        .first()
        .map(|r| {
            r.columns()
                .iter()
                .map(|c| ColumnInfo {
                    name: c.name().to_string(),
                    type_name: c.type_info().to_string(),
                })
                .collect()
        })
        .unwrap_or_default();

    let data: Vec<Vec<Value>> = rows
        .iter()
        .map(|r| {
            r.columns()
                .iter()
                .enumerate()
                .map(|(i, c)| sqlx_value_to_json(r, c, i))
                .collect()
        })
        .collect();
    (columns, data)
}

fn ident_ok(s: &str) -> bool {
    !s.is_empty()
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_')
}

#[tauri::command]
pub async fn pg_connect(
    url: String,
    save: bool,
    state: State<'_, AppState>,
) -> AppResult<ConnectionStatus> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(8))
        .connect(&url)
        .await
        .map_err(map_db_err)?;

    {
        let mut guard = state.db_pool.lock().await;
        if let Some(old) = guard.take() {
            old.close().await;
        }
        *guard = Some(pool);
    }

    if save {
        secrets::set(KEY_PG_URL, &url)?;
    }

    Ok(ConnectionStatus {
        connected: true,
        host_summary: host_summary(&url),
    })
}

#[tauri::command]
pub async fn pg_disconnect(state: State<'_, AppState>) -> AppResult<()> {
    let mut guard = state.db_pool.lock().await;
    if let Some(pool) = guard.take() {
        pool.close().await;
    }
    secrets::delete(KEY_PG_URL)?;
    Ok(())
}

#[tauri::command]
pub async fn pg_status(state: State<'_, AppState>) -> AppResult<ConnectionStatus> {
    let guard = state.db_pool.lock().await;
    let connected = guard.is_some();
    drop(guard);
    let summary = if connected {
        secrets::get(KEY_PG_URL)?.as_deref().and_then(host_summary)
    } else {
        None
    };
    Ok(ConnectionStatus {
        connected,
        host_summary: summary,
    })
}

#[tauri::command]
pub async fn pg_reconnect_saved(state: State<'_, AppState>) -> AppResult<bool> {
    let url = match secrets::get(KEY_PG_URL)? {
        Some(u) => u,
        None => return Ok(false),
    };
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(8))
        .connect(&url)
        .await
        .map_err(map_db_err)?;
    let mut guard = state.db_pool.lock().await;
    *guard = Some(pool);
    Ok(true)
}

#[tauri::command]
pub async fn pg_list_tables(state: State<'_, AppState>) -> AppResult<Vec<TableInfo>> {
    let pool = pool(&state).await?;
    let rows = sqlx::query(
        "SELECT table_schema, table_name FROM information_schema.tables \
         WHERE table_schema NOT IN ('pg_catalog', 'information_schema') \
         AND table_type = 'BASE TABLE' \
         ORDER BY table_schema, table_name",
    )
    .fetch_all(&pool)
    .await
    .map_err(map_db_err)?;

    Ok(rows
        .iter()
        .map(|r| TableInfo {
            schema: r.try_get("table_schema").unwrap_or_default(),
            name: r.try_get("table_name").unwrap_or_default(),
        })
        .collect())
}

#[tauri::command]
pub async fn pg_run_sql(
    query: String,
    state: State<'_, AppState>,
) -> AppResult<QueryResult> {
    let pool = pool(&state).await?;
    let started = Instant::now();
    let trimmed = query.trim_start().to_ascii_lowercase();
    let is_select = trimmed.starts_with("select")
        || trimmed.starts_with("with")
        || trimmed.starts_with("show")
        || trimmed.starts_with("table");

    if is_select {
        let rows = sqlx::query(&query).fetch_all(&pool).await.map_err(map_db_err)?;
        let took_ms = started.elapsed().as_millis();
        let (columns, data) = rows_to_json(&rows);
        Ok(QueryResult {
            columns,
            rows: data,
            rows_affected: rows.len() as u64,
            took_ms,
        })
    } else {
        let result = sqlx::query(&query).execute(&pool).await.map_err(map_db_err)?;
        let took_ms = started.elapsed().as_millis();
        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            rows_affected: result.rows_affected(),
            took_ms,
        })
    }
}

#[tauri::command]
pub async fn pg_fetch_table_rows(
    schema: String,
    table: String,
    limit: i64,
    offset: i64,
    state: State<'_, AppState>,
) -> AppResult<PageResult> {
    if !ident_ok(&schema) || !ident_ok(&table) {
        return Err(AppError::InvalidInput("invalid identifier".into()));
    }
    let pool = pool(&state).await?;

    let count_sql = format!(r#"SELECT count(*) AS c FROM "{schema}"."{table}""#);
    let total: i64 = sqlx::query_scalar(&count_sql)
        .fetch_one(&pool)
        .await
        .map_err(map_db_err)?;

    let limit = limit.clamp(1, 1000);
    let offset = offset.max(0);
    let select_sql = format!(
        r#"SELECT * FROM "{schema}"."{table}" ORDER BY 1 LIMIT {limit} OFFSET {offset}"#
    );
    let rows = sqlx::query(&select_sql)
        .fetch_all(&pool)
        .await
        .map_err(map_db_err)?;

    let (columns, data) = rows_to_json(&rows);
    Ok(PageResult {
        columns,
        rows: data,
        total,
    })
}
