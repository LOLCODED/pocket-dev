use async_trait::async_trait;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::mpsc;

use crate::ai::provider::{
    ContentBlock, LlmProvider, Message, ProviderEvent, Role, StopReason, ToolSchema, TurnOutcome,
};
use crate::error::{AppError, AppResult};

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub struct AnthropicProvider {
    api_key: String,
    client: reqwest::Client,
}

impl AnthropicProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: reqwest::Client::new(),
        }
    }
}

#[derive(Serialize)]
struct ApiMessage<'a> {
    role: &'a str,
    content: Vec<Value>,
}

fn role_str(r: &Role) -> &'static str {
    match r {
        Role::User => "user",
        Role::Assistant => "assistant",
        Role::System => "user", // system handled out-of-band
    }
}

fn block_to_api(b: &ContentBlock) -> Value {
    match b {
        ContentBlock::Text { text } => json!({"type": "text", "text": text}),
        ContentBlock::ToolUse { id, name, input } => {
            json!({"type": "tool_use", "id": id, "name": name, "input": input})
        }
        ContentBlock::ToolResult {
            tool_use_id,
            content,
            is_error,
        } => json!({
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": content,
            "is_error": is_error,
        }),
    }
}

fn build_messages(messages: &[Message]) -> Vec<ApiMessage<'_>> {
    messages
        .iter()
        .filter(|m| !matches!(m.role, Role::System))
        .map(|m| ApiMessage {
            role: role_str(&m.role),
            content: m.content.iter().map(block_to_api).collect(),
        })
        .collect()
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum SseEvent {
    MessageStart {
        #[allow(dead_code)]
        #[serde(default)]
        message: Option<Value>,
    },
    ContentBlockStart {
        index: usize,
        content_block: Value,
    },
    ContentBlockDelta {
        index: usize,
        delta: Value,
    },
    ContentBlockStop {
        index: usize,
    },
    MessageDelta {
        delta: Value,
    },
    MessageStop,
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "error")]
    Error {
        error: Value,
    },
    #[serde(other)]
    Unknown,
}

#[async_trait]
impl LlmProvider for AnthropicProvider {
    async fn stream_turn(
        &self,
        model: &str,
        system: Option<&str>,
        messages: &[Message],
        tools: &[ToolSchema],
        sink: mpsc::UnboundedSender<ProviderEvent>,
    ) -> AppResult<TurnOutcome> {
        let api_messages = build_messages(messages);

        let mut body = json!({
            "model": model,
            "max_tokens": 4096,
            "stream": true,
            "messages": api_messages,
        });
        if let Some(sys) = system {
            body["system"] = json!(sys);
        }
        if !tools.is_empty() {
            body["tools"] = json!(tools
                .iter()
                .map(|t| json!({
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.input_schema,
                }))
                .collect::<Vec<_>>());
        }

        let resp = self
            .client
            .post(ANTHROPIC_API_URL)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Llm(format!("anthropic request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Llm(format!("anthropic {status}: {text}")));
        }

        // Per-block accumulators.
        let mut blocks: Vec<ContentBlock> = Vec::new();
        let mut tool_input_buffers: std::collections::HashMap<usize, String> =
            std::collections::HashMap::new();
        let mut stop_reason = StopReason::EndTurn;

        let mut stream = resp.bytes_stream();
        let mut buf = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| AppError::Llm(format!("stream error: {e}")))?;
            buf.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(idx) = buf.find("\n\n") {
                let event_block = buf[..idx].to_string();
                buf.drain(..idx + 2);

                let mut data_line: Option<String> = None;
                for line in event_block.lines() {
                    if let Some(rest) = line.strip_prefix("data:") {
                        data_line = Some(rest.trim().to_string());
                    }
                }
                let Some(data) = data_line else { continue };
                if data == "[DONE]" {
                    continue;
                }

                let Ok(event) = serde_json::from_str::<SseEvent>(&data) else {
                    continue;
                };

                match event {
                    SseEvent::MessageStart { .. } => {}
                    SseEvent::ContentBlockStart {
                        index,
                        content_block,
                    } => {
                        let block_type = content_block
                            .get("type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        match block_type {
                            "text" => {
                                if blocks.len() <= index {
                                    blocks.resize(
                                        index + 1,
                                        ContentBlock::Text { text: String::new() },
                                    );
                                }
                                blocks[index] = ContentBlock::Text { text: String::new() };
                            }
                            "tool_use" => {
                                let id = content_block
                                    .get("id")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or_default()
                                    .to_string();
                                let name = content_block
                                    .get("name")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or_default()
                                    .to_string();
                                let _ = sink.send(ProviderEvent::ToolUseStart {
                                    tool_id: id.clone(),
                                    name: name.clone(),
                                });
                                if blocks.len() <= index {
                                    blocks.resize(
                                        index + 1,
                                        ContentBlock::Text { text: String::new() },
                                    );
                                }
                                blocks[index] = ContentBlock::ToolUse {
                                    id,
                                    name,
                                    input: Value::Null,
                                };
                                tool_input_buffers.insert(index, String::new());
                            }
                            _ => {}
                        }
                    }
                    SseEvent::ContentBlockDelta { index, delta } => {
                        let dtype =
                            delta.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        match dtype {
                            "text_delta" => {
                                let text = delta
                                    .get("text")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                if let Some(ContentBlock::Text { text: t }) = blocks.get_mut(index)
                                {
                                    t.push_str(&text);
                                }
                                let _ = sink.send(ProviderEvent::TextDelta { text });
                            }
                            "input_json_delta" => {
                                let partial = delta
                                    .get("partial_json")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                if let Some(buf) = tool_input_buffers.get_mut(&index) {
                                    buf.push_str(&partial);
                                }
                                let tool_id = blocks
                                    .get(index)
                                    .and_then(|b| match b {
                                        ContentBlock::ToolUse { id, .. } => Some(id.clone()),
                                        _ => None,
                                    })
                                    .unwrap_or_default();
                                let _ = sink.send(ProviderEvent::ToolInputDelta {
                                    tool_id,
                                    json_delta: partial,
                                });
                            }
                            _ => {}
                        }
                    }
                    SseEvent::ContentBlockStop { index } => {
                        if let Some(buf) = tool_input_buffers.remove(&index) {
                            let parsed: Value = serde_json::from_str(&buf).unwrap_or(Value::Null);
                            let mut tool_id = String::new();
                            if let Some(ContentBlock::ToolUse { input, id, .. }) =
                                blocks.get_mut(index)
                            {
                                *input = parsed.clone();
                                tool_id = id.clone();
                            }
                            let _ = sink.send(ProviderEvent::ToolUseEnd {
                                tool_id,
                                input: parsed,
                            });
                        }
                    }
                    SseEvent::MessageDelta { delta } => {
                        if let Some(reason) =
                            delta.get("stop_reason").and_then(|v| v.as_str())
                        {
                            stop_reason = match reason {
                                "tool_use" => StopReason::ToolUse,
                                "max_tokens" => StopReason::MaxTokens,
                                "stop_sequence" => StopReason::Stop,
                                _ => StopReason::EndTurn,
                            };
                        }
                    }
                    SseEvent::MessageStop => {}
                    SseEvent::Error { error } => {
                        return Err(AppError::Llm(format!("anthropic error: {error}")));
                    }
                    SseEvent::Ping | SseEvent::Unknown => {}
                }
            }
        }

        let _ = sink.send(ProviderEvent::Done { stop_reason });

        Ok(TurnOutcome {
            assistant: Message {
                role: Role::Assistant,
                content: blocks,
            },
            stop_reason,
        })
    }
}
