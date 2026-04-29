use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;

use crate::ai::agent::{self, SYSTEM_PROMPT};
use crate::ai::anthropic::AnthropicProvider;
use crate::ai::provider::{LlmProvider, Message, ProviderEvent, ToolSchema};
use crate::error::{AppError, AppResult};
use crate::secrets;
use crate::settings::{self, LlmProviderKind};
use crate::state::AppState;

const EVENT: &str = "chat:event";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatTurnRequest {
    pub session_id: String,
    pub turn_id: String,
    pub messages: Vec<Message>,
    #[serde(default)]
    pub system: Option<String>,
    #[serde(default)]
    pub tools: Vec<ToolSchema>,
}

#[derive(Debug, Serialize, Clone)]
struct ChatEvent {
    session_id: String,
    turn_id: String,
    #[serde(flatten)]
    event: ChatEventKind,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum ChatEventKind {
    Started,
    TextDelta { text: String },
    ToolUseStart { tool_id: String, name: String },
    ToolInputDelta { tool_id: String, json_delta: String },
    ToolUseEnd { tool_id: String, input: serde_json::Value },
    Assistant { message: Message },
    Done { stop_reason: String },
    Error { error: serde_json::Value },
    Cancelled,
}

fn provider_for(kind: &LlmProviderKind) -> AppResult<Arc<dyn LlmProvider>> {
    match kind {
        LlmProviderKind::Anthropic => {
            let key = secrets::get(&kind.keychain_key())?
                .ok_or_else(|| AppError::Llm("no Anthropic API key configured".into()))?;
            Ok(Arc::new(AnthropicProvider::new(key)))
        }
        LlmProviderKind::Openai => Ok(Arc::new(crate::ai::openai::OpenAiProvider)),
        LlmProviderKind::Ollama => {
            let s = settings::load()?;
            Ok(Arc::new(crate::ai::ollama::OllamaProvider {
                _base_url: s
                    .ollama_base_url
                    .unwrap_or_else(|| "http://localhost:11434".into()),
            }))
        }
    }
}

#[tauri::command]
pub async fn chat_send(
    request: ChatTurnRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let s = settings::load()?;
    let provider = provider_for(&s.provider)?;
    let model = s.model.clone();
    let system_prompt = request.system.unwrap_or_else(|| SYSTEM_PROMPT.to_string());

    let session_id = request.session_id.clone();
    let turn_id = request.turn_id.clone();

    let _ = app.emit(
        EVENT,
        ChatEvent {
            session_id: session_id.clone(),
            turn_id: turn_id.clone(),
            event: ChatEventKind::Started,
        },
    );

    let (tx, mut rx) = mpsc::unbounded_channel::<ProviderEvent>();

    // Forwarder: provider events → Tauri events
    let app_for_forward = app.clone();
    let session_for_forward = session_id.clone();
    let turn_for_forward = turn_id.clone();
    let forwarder = tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            let kind = match event {
                ProviderEvent::TextDelta { text } => ChatEventKind::TextDelta { text },
                ProviderEvent::ToolUseStart { tool_id, name } => {
                    ChatEventKind::ToolUseStart { tool_id, name }
                }
                ProviderEvent::ToolInputDelta { tool_id, json_delta } => {
                    ChatEventKind::ToolInputDelta { tool_id, json_delta }
                }
                ProviderEvent::ToolUseEnd { tool_id, input } => {
                    ChatEventKind::ToolUseEnd { tool_id, input }
                }
                ProviderEvent::Done { stop_reason } => ChatEventKind::Done {
                    stop_reason: format!("{:?}", stop_reason).to_lowercase(),
                },
            };
            let _ = app_for_forward.emit(
                EVENT,
                ChatEvent {
                    session_id: session_for_forward.clone(),
                    turn_id: turn_for_forward.clone(),
                    event: kind,
                },
            );
        }
    });

    // Run the turn in a spawned task so we can cancel it.
    let messages = request.messages.clone();
    let tools = request.tools.clone();
    let provider_for_task = provider.clone();
    let model_for_task = model.clone();
    let app_for_task = app.clone();
    let session_for_task = session_id.clone();
    let turn_for_task = turn_id.clone();
    let tx_for_task = tx.clone();

    let join = tokio::spawn(async move {
        let outcome = agent::run_turn(
            provider_for_task,
            &model_for_task,
            Some(&system_prompt),
            &messages,
            &tools,
            tx_for_task,
        )
        .await;
        match outcome {
            Ok(turn) => {
                let _ = app_for_task.emit(
                    EVENT,
                    ChatEvent {
                        session_id: session_for_task.clone(),
                        turn_id: turn_for_task.clone(),
                        event: ChatEventKind::Assistant { message: turn.assistant },
                    },
                );
            }
            Err(err) => {
                let payload = serde_json::to_value(&err).unwrap_or_default();
                let _ = app_for_task.emit(
                    EVENT,
                    ChatEvent {
                        session_id: session_for_task.clone(),
                        turn_id: turn_for_task.clone(),
                        event: ChatEventKind::Error { error: payload },
                    },
                );
            }
        }
    });

    {
        let mut aborts = state.chat_aborts.lock().await;
        aborts.insert(session_id.clone(), join.abort_handle());
    }

    drop(tx); // close channel once provider task finishes
    let result = join.await;
    let _ = forwarder.await;

    {
        let mut aborts = state.chat_aborts.lock().await;
        aborts.remove(&session_id);
    }

    if let Err(e) = result {
        if e.is_cancelled() {
            let _ = app.emit(
                EVENT,
                ChatEvent {
                    session_id: session_id.clone(),
                    turn_id: turn_id.clone(),
                    event: ChatEventKind::Cancelled,
                },
            );
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn chat_cancel(session_id: String, state: State<'_, AppState>) -> AppResult<()> {
    let mut aborts = state.chat_aborts.lock().await;
    if let Some(handle) = aborts.remove(&session_id) {
        handle.abort();
    }
    Ok(())
}
