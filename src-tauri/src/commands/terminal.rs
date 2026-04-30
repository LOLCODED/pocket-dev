use std::io::{Read, Write};
use std::sync::Arc;
use std::time::Duration;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub struct PtySession {
    pub master: Mutex<Box<dyn MasterPty + Send>>,
    pub writer: Mutex<Box<dyn Write + Send>>,
    pub child: Mutex<Box<dyn Child + Send + Sync>>,
}

const DATA_EVENT: &str = "term:data";
const EXIT_EVENT: &str = "term:exit";

const RUN_OUTPUT_CAP: usize = 64 * 1024;
const RUN_TIMEOUT_SECS: u64 = 60;

#[derive(Serialize, Clone)]
struct TermDataEvent {
    session_id: String,
    data: String,
}

#[derive(Serialize, Clone)]
struct TermExitEvent {
    session_id: String,
    exit_code: Option<i32>,
}

#[derive(Serialize, Clone)]
pub struct RunCommandResult {
    pub output: String,
    pub exit_code: Option<i32>,
    pub timed_out: bool,
    pub truncated: bool,
}

#[tauri::command]
pub async fn term_open(
    cols: u16,
    rows: u16,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let root = state
        .current_root()
        .await
        .ok_or(AppError::NoProjectOpen)?;

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| AppError::Internal(format!("openpty failed: {e}")))?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| {
        if cfg!(windows) {
            "powershell.exe".to_string()
        } else {
            "/bin/bash".to_string()
        }
    });
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&root);
    cmd.env(
        "TERM",
        std::env::var("TERM").unwrap_or_else(|_| "xterm-256color".into()),
    );

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| AppError::Internal(format!("spawn shell failed: {e}")))?;
    drop(pair.slave);

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| AppError::Internal(format!("clone reader: {e}")))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| AppError::Internal(format!("take writer: {e}")))?;

    let session_id = Uuid::new_v4().to_string();
    let session = Arc::new(PtySession {
        master: Mutex::new(pair.master),
        writer: Mutex::new(writer),
        child: Mutex::new(child),
    });

    {
        let mut terms = state.terminals.lock().await;
        terms.insert(session_id.clone(), session.clone());
    }

    spawn_reader(app, session_id.clone(), reader);

    Ok(session_id)
}

fn spawn_reader(app: AppHandle, session_id: String, mut reader: Box<dyn Read + Send>) {
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let encoded = BASE64.encode(&buf[..n]);
                    let _ = app.emit(
                        DATA_EVENT,
                        TermDataEvent {
                            session_id: session_id.clone(),
                            data: encoded,
                        },
                    );
                }
                Err(_) => break,
            }
        }
        let _ = app.emit(
            EXIT_EVENT,
            TermExitEvent {
                session_id: session_id.clone(),
                exit_code: None,
            },
        );
    });
}

#[tauri::command]
pub async fn term_write(
    session_id: String,
    data: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let session = {
        let terms = state.terminals.lock().await;
        terms.get(&session_id).cloned()
    }
    .ok_or_else(|| AppError::InvalidInput(format!("no terminal session {session_id}")))?;

    let bytes = BASE64
        .decode(data.as_bytes())
        .map_err(|e| AppError::InvalidInput(format!("bad base64: {e}")))?;

    let mut writer = session.writer.lock().await;
    writer.write_all(&bytes)?;
    writer.flush()?;
    Ok(())
}

#[tauri::command]
pub async fn term_resize(
    session_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let session = {
        let terms = state.terminals.lock().await;
        terms.get(&session_id).cloned()
    }
    .ok_or_else(|| AppError::InvalidInput(format!("no terminal session {session_id}")))?;

    let master = session.master.lock().await;
    master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| AppError::Internal(format!("resize failed: {e}")))?;
    Ok(())
}

#[tauri::command]
pub async fn term_close(session_id: String, state: State<'_, AppState>) -> AppResult<()> {
    let session = {
        let mut terms = state.terminals.lock().await;
        terms.remove(&session_id)
    };
    if let Some(s) = session {
        let mut child = s.child.lock().await;
        let _ = child.kill();
    }
    Ok(())
}

#[tauri::command]
pub async fn term_run_command(
    session_id: Option<String>,
    command: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<RunCommandResult> {
    let root = state
        .current_root()
        .await
        .ok_or(AppError::NoProjectOpen)?;

    let mirror_id = match session_id {
        Some(id) => {
            let terms = state.terminals.lock().await;
            if terms.contains_key(&id) {
                Some(id)
            } else {
                None
            }
        }
        None => None,
    };

    if let Some(id) = mirror_id.as_ref() {
        let banner = format!("\r\n\x1b[2m$ {command}\x1b[0m\r\n");
        let _ = app.emit(
            DATA_EVENT,
            TermDataEvent {
                session_id: id.clone(),
                data: BASE64.encode(banner.as_bytes()),
            },
        );
    }

    let mut cmd = if cfg!(windows) {
        let mut c = TokioCommand::new("cmd");
        c.arg("/C").arg(&command);
        c
    } else {
        let mut c = TokioCommand::new("sh");
        c.arg("-c").arg(&command);
        c
    };
    cmd.current_dir(&root)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdin(std::process::Stdio::null())
        .kill_on_drop(true);

    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::Internal(format!("spawn failed: {e}")))?;

    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");

    let stdout_task = tokio::spawn(read_stream(stdout, app.clone(), mirror_id.clone()));
    let stderr_task = tokio::spawn(read_stream(stderr, app.clone(), mirror_id.clone()));

    let wait_result =
        tokio::time::timeout(Duration::from_secs(RUN_TIMEOUT_SECS), child.wait()).await;

    let (timed_out, exit_code) = match wait_result {
        Ok(Ok(status)) => (false, status.code()),
        Ok(Err(_)) => (false, None),
        Err(_) => {
            let _ = child.kill().await;
            (true, None)
        }
    };

    let (out_bytes, out_trunc) = stdout_task.await.unwrap_or_default();
    let (err_bytes, err_trunc) = stderr_task.await.unwrap_or_default();

    let mut combined = Vec::with_capacity(out_bytes.len() + err_bytes.len());
    combined.extend_from_slice(&out_bytes);
    combined.extend_from_slice(&err_bytes);
    let output = String::from_utf8_lossy(&combined).into_owned();

    Ok(RunCommandResult {
        output,
        exit_code,
        timed_out,
        truncated: out_trunc || err_trunc,
    })
}

async fn read_stream<R>(
    mut reader: R,
    app: AppHandle,
    mirror_id: Option<String>,
) -> (Vec<u8>, bool)
where
    R: AsyncRead + Unpin,
{
    let mut buf = [0u8; 4096];
    let mut collected: Vec<u8> = Vec::new();
    let mut truncated = false;
    loop {
        match reader.read(&mut buf).await {
            Ok(0) => break,
            Ok(n) => {
                let chunk = &buf[..n];
                if collected.len() < RUN_OUTPUT_CAP {
                    let take = (RUN_OUTPUT_CAP - collected.len()).min(n);
                    collected.extend_from_slice(&chunk[..take]);
                    if take < n {
                        truncated = true;
                    }
                } else {
                    truncated = true;
                }
                if let Some(id) = mirror_id.as_ref() {
                    let mut crlf: Vec<u8> = Vec::with_capacity(n);
                    for &b in chunk {
                        if b == b'\n' {
                            crlf.push(b'\r');
                        }
                        crlf.push(b);
                    }
                    let encoded = BASE64.encode(&crlf);
                    let _ = app.emit(
                        DATA_EVENT,
                        TermDataEvent {
                            session_id: id.clone(),
                            data: encoded,
                        },
                    );
                }
            }
            Err(_) => break,
        }
    }
    (collected, truncated)
}
