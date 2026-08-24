//! Explicit Living Knowledge Contemplate transport over the already-open AIKit
//! AgentSession surface.
//!
//! O:I owns transport composition only. AIKit owns the bounded preflight and the
//! structured `aikit.contemplate-return/v1` knowledge return. This adapter never
//! starts an Agent/model, accepts no renderer-supplied runtime identity, and never
//! promotes free chat prose into Wiki state.

use aikit_adapters::ConnectionSignalKind;
use aikit_core::{
    parse_contemplate_generated, AikitError, BoundedContemplateExecutor,
    BoundedContemplatePreflight, ContemplateGenerated, Result as AikitResult,
    CONTEMPLATE_RETURN_VERSION,
};

use crate::AikitAgentSurface;

pub const LIVING_CONTEMPLATE_TRANSPORT_VERSION: &str = "oi.living-contemplate-acp/v1";

pub struct AcpLivingContemplateExecutor<'a> {
    surface: &'a mut AikitAgentSurface,
}

impl<'a> AcpLivingContemplateExecutor<'a> {
    pub fn new(surface: &'a mut AikitAgentSurface) -> Self {
        Self { surface }
    }
}

impl BoundedContemplateExecutor for AcpLivingContemplateExecutor<'_> {
    fn execute(
        &mut self,
        preflight: &BoundedContemplatePreflight,
    ) -> AikitResult<ContemplateGenerated> {
        let prompt = contemplate_prompt(preflight)?;
        let response = send_structured_agent_turn(self.surface, &prompt, "Living Knowledge Contemplate")?;

        // Knowledge shape, Wiki validation, integrative basis/Return validation and
        // human-source proposal authority all remain AIKit-owned here.
        parse_contemplate_generated(&response)
    }
}

pub(crate) fn send_structured_agent_turn(
    surface: &mut AikitAgentSurface,
    prompt: &str,
    operation: &str,
) -> AikitResult<String> {
    let signals = surface
        .send(prompt)
        .map_err(|error| AikitError::new("oi.living_contemplate.transport", error))?;
    let mut response = String::new();
    let mut completed = false;
    for signal in signals {
        match signal.kind {
            ConnectionSignalKind::AgentMessageChunk { text } => response.push_str(&text),
            ConnectionSignalKind::Status { .. } => {}
            ConnectionSignalKind::Completed { .. } => completed = true,
            ConnectionSignalKind::Cancelled => {
                return Err(AikitError::new(
                    "oi.living_contemplate.cancelled",
                    format!("ACP {operation} turn was cancelled before a structured AIKit return"),
                ))
            }
            ConnectionSignalKind::Degraded { degradation } => {
                return Err(AikitError::new(
                    "oi.living_contemplate.degraded",
                    format!("ACP {operation} provider degraded: {}", degradation.reason),
                ))
            }
            ConnectionSignalKind::PermissionRequested { .. } => {
                return Err(AikitError::new(
                    "oi.living_contemplate.permission_required",
                    format!("ACP {operation} requested native permission; O:I will not silently grant transport-native authority"),
                ))
            }
            ConnectionSignalKind::ToolCall { .. } | ConnectionSignalKind::ToolResult { .. } => {
                return Err(AikitError::new(
                    "oi.living_contemplate.unhandled_tool",
                    format!("ACP {operation} emitted a tool interaction without an explicit host-owned tool execution relation"),
                ))
            }
            ConnectionSignalKind::SessionOpened { .. } => {
                return Err(AikitError::new(
                    "oi.living_contemplate.protocol_drift",
                    format!("ACP {operation} turn unexpectedly opened a second AgentSession"),
                ))
            }
        }
    }
    if !completed {
        return Err(AikitError::new(
            "oi.living_contemplate.incomplete",
            format!("ACP {operation} turn ended without a Completed signal"),
        ));
    }
    if response.trim().is_empty() {
        return Err(AikitError::new(
            "oi.living_contemplate.empty_return",
            format!("ACP {operation} completed without an Agent message to validate"),
        ));
    }
    Ok(response)
}

pub fn contemplate_prompt(preflight: &BoundedContemplatePreflight) -> AikitResult<String> {
    if preflight.automatic_agent_or_model_invocation
        || preflight.field.automatic_agent_or_model_invocation
        || preflight.field.changed_source_payloads_retrieved
    {
        return Err(AikitError::new(
            "oi.living_contemplate.preflight_invariant",
            "AIKit bounded preflight violated the zero-background/payload-disclosure contract",
        ));
    }
    let encoded = serde_json::to_string(preflight).map_err(|error| {
        AikitError::new(
            "oi.living_contemplate.preflight_serialize",
            format!("serialize AIKit bounded Contemplate preflight: {error}"),
        )
    })?;
    Ok(format!(
        "Explicit AIKit Living Knowledge Contemplate.\n\
Use the bounded preflight below as the complete host-supplied field for this operation.\n\
Return exactly one JSON object with version `{CONTEMPLATE_RETURN_VERSION}`.\n\
Do not wrap it in Markdown or explanatory prose. Human-authored source effects must appear only in `human_source_proposals`; do not claim direct human-source writes.\n\
Bounded preflight:\n{encoded}"
    ))
}
