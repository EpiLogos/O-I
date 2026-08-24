//! Typed Flow contemplation transport over the already-open canonical AIKit
//! AgentSession Surface.
//!
//! This is the same transport path as Living Knowledge Contemplate. AIKit owns
//! Flow/Living return validation; O:I supplies the already-open ACP Surface and
//! never opens a second AgentSession for Flow.

use aikit_core::{
    parse_flow_contemplate_generated, AikitError, FlowContemplateExecutor,
    FlowContemplateGenerated, FlowContemplatePreflight, Result as AikitResult,
    FLOW_CONTEMPLATE_RETURN_VERSION,
};

use crate::living_contemplate::send_structured_agent_turn;
use crate::AikitAgentSurface;

pub const FLOW_CONTEMPLATE_TRANSPORT_VERSION: &str = "oi.flow-contemplate-acp/v1";

pub struct AcpFlowContemplateExecutor<'a> {
    surface: &'a mut AikitAgentSurface,
}

impl<'a> AcpFlowContemplateExecutor<'a> {
    pub fn new(surface: &'a mut AikitAgentSurface) -> Self {
        Self { surface }
    }
}

impl FlowContemplateExecutor for AcpFlowContemplateExecutor<'_> {
    fn execute(
        &mut self,
        preflight: &FlowContemplatePreflight,
    ) -> AikitResult<FlowContemplateGenerated> {
        let prompt = flow_contemplate_prompt(preflight)?;
        let response = send_structured_agent_turn(self.surface, &prompt, "Flow Contemplate")?;
        parse_flow_contemplate_generated(&response)
    }
}

pub fn flow_contemplate_prompt(preflight: &FlowContemplatePreflight) -> AikitResult<String> {
    if preflight.automatic_agent_or_model_invocation
        || preflight.bounded.automatic_agent_or_model_invocation
        || preflight.bounded.field.automatic_agent_or_model_invocation
        || preflight.bounded.field.changed_source_payloads_retrieved
    {
        return Err(AikitError::new(
            "oi.flow_contemplate.preflight_invariant",
            "AIKit Flow preflight violated the zero-background/payload-disclosure contract",
        ));
    }
    let encoded = serde_json::to_string(preflight).map_err(|error| {
        AikitError::new(
            "oi.flow_contemplate.preflight_serialize",
            format!("serialize AIKit Flow Contemplate preflight: {error}"),
        )
    })?;
    Ok(format!(
        "Explicit AIKit Contemplate(FlowRef).\n\
Use the exact bounded Flow/Living Knowledge/praxis preflight below as the complete host-supplied field for this operation.\n\
Return exactly one JSON object with version `{FLOW_CONTEMPLATE_RETURN_VERSION}` and shape {{\"version\":...,\"living\":{{\"version\":\"aikit.contemplate-return/v1\",...}},\"flow_mutations\":[...]}}.\n\
Do not wrap it in Markdown or explanatory prose. Flow changes belong only in `flow_mutations` as expected-revision owner intents. Human Ground implications belong only in `living.human_source_proposals`. Wiki/reading changes remain in the nested Living Knowledge return. Claim/Run refs retain their external authority.\n\
Flow preflight:\n{encoded}"
    ))
}

#[cfg(test)]
mod tests {
    #[test]
    fn flow_transport_source_has_no_second_session_open_path() {
        let source = include_str!("flow_contemplate.rs")
            .split("\n#[cfg(test)]")
            .next()
            .unwrap();
        assert!(source.contains("send_structured_agent_turn"));
        assert!(source.contains("parse_flow_contemplate_generated"));
        assert!(!source.contains("AikitAgentSurface::open"));
        assert!(!source.contains("Command::new"));
    }
}
