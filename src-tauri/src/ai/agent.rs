use std::sync::Arc;

use crate::ai::provider::{LlmProvider, Message, ProviderEvent, StopReason, ToolSchema, TurnOutcome};
use crate::error::AppResult;

pub const SYSTEM_PROMPT: &str = "You are pocket-dev's coding assistant. \
The user is a non-technical person editing a small project on their own computer. \
Be concise, friendly, and concrete. Explain changes in plain English. \
Never assume the user knows Git, the terminal, or programming jargon. \
When you must reference files, use their relative path. \
Tool capabilities will be added soon; for now, answer questions and explain code.";

/// Run a single agent turn. Phase 2 has no tool execution, so this just
/// streams the assistant's text response. Phase 4 will wrap this in a loop
/// that resolves tool_use calls.
pub async fn run_turn(
    provider: Arc<dyn LlmProvider>,
    model: &str,
    system: Option<&str>,
    messages: &[Message],
    tools: &[ToolSchema],
    sink: tokio::sync::mpsc::UnboundedSender<ProviderEvent>,
) -> AppResult<TurnOutcome> {
    provider
        .stream_turn(model, system, messages, tools, sink)
        .await
}

pub fn is_terminal(reason: StopReason) -> bool {
    !matches!(reason, StopReason::ToolUse)
}
