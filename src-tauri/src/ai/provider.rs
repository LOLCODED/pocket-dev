use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::mpsc;

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text { text: String },
    ToolUse { id: String, name: String, input: Value },
    ToolResult { tool_use_id: String, content: String, is_error: bool },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: Vec<ContentBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSchema {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    EndTurn,
    ToolUse,
    MaxTokens,
    Stop,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ProviderEvent {
    TextDelta { text: String },
    ToolUseStart { tool_id: String, name: String },
    ToolInputDelta { tool_id: String, json_delta: String },
    ToolUseEnd { tool_id: String, input: Value },
    Done { stop_reason: StopReason },
}

pub struct TurnOutcome {
    pub assistant: Message,
    pub stop_reason: StopReason,
}

#[async_trait]
pub trait LlmProvider: Send + Sync {
    async fn stream_turn(
        &self,
        model: &str,
        system: Option<&str>,
        messages: &[Message],
        tools: &[ToolSchema],
        sink: mpsc::UnboundedSender<ProviderEvent>,
    ) -> AppResult<TurnOutcome>;
}
