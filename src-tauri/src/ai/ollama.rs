use async_trait::async_trait;
use tokio::sync::mpsc;

use crate::ai::provider::{LlmProvider, Message, ProviderEvent, ToolSchema, TurnOutcome};
use crate::error::{AppError, AppResult};

pub struct OllamaProvider {
    pub _base_url: String,
}

#[async_trait]
impl LlmProvider for OllamaProvider {
    async fn stream_turn(
        &self,
        _model: &str,
        _system: Option<&str>,
        _messages: &[Message],
        _tools: &[ToolSchema],
        _sink: mpsc::UnboundedSender<ProviderEvent>,
    ) -> AppResult<TurnOutcome> {
        Err(AppError::Llm(
            "Ollama provider not implemented yet — use Anthropic for now".into(),
        ))
    }
}
