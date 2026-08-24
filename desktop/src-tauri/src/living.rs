use std::env;
use std::path::PathBuf;

use oi_desktop_core::{
    load_model_runtime, project_agent_wiki_plan, read_central_change_horizon,
    AcpLivingContemplateExecutor, BridgeCallClass, BridgeCaller, BridgePolicy,
    NativeModelRuntimeReadModel, LIVING_CONTEMPLATE_TRANSPORT_VERSION,
};
use serde_json::{json, Value};
use tauri::State;

use super::AppState;

pub const LIVING_CONTEMPLATE_PROJECTION_VERSION: &str = "oi.desktop-living-contemplate/v1";

#[tauri::command]
pub(crate) fn living_knowledge_status(state: State<'_, AppState>) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveKnowledge)
        .map_err(|error| error.to_string())?;
    let horizon = current_central_horizon()?;
    let knowledge = state
        .knowledge
        .lock()
        .map_err(|_| "Knowledge workbench lock poisoned".to_owned())?;
    let knowledge = knowledge
        .as_ref()
        .ok_or_else(|| "no local ProjectCentral Knowledge world is configured".to_owned())?;
    serde_json::to_value(knowledge.living_status(&horizon)?)
        .map_err(|error| format!("serialize Living Knowledge status: {error}"))
}

/// Deterministic owner preflight. This command deliberately does not require an
/// open AgentSession and cannot cross an Agent/model boundary.
#[tauri::command]
pub(crate) fn living_contemplate_preflight(
    state: State<'_, AppState>,
    focus: Vec<String>,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveKnowledge)
        .map_err(|error| error.to_string())?;
    let horizon = current_central_horizon()?;
    let runtime = current_model_runtime()?;
    let knowledge = state
        .knowledge
        .lock()
        .map_err(|_| "Knowledge workbench lock poisoned".to_owned())?;
    let knowledge = knowledge
        .as_ref()
        .ok_or_else(|| "no local ProjectCentral Knowledge world is configured".to_owned())?;
    let preflight = knowledge.living_preflight_refs(&horizon, focus, &runtime)?;
    serde_json::to_value(preflight)
        .map_err(|error| format!("serialize Living Contemplate preflight: {error}"))
}

/// Explicit human/authorised-Agent operation over the already-open canonical
/// AgentSession Surface. O:I owns only this host join: Central owns source truth,
/// AIKit owns the bounded field + return validation, and the ACP provider owns the
/// native process/session. No renderer-supplied model, Agent, Agency or provider
/// identity is accepted here.
#[tauri::command]
pub(crate) fn living_contemplate(
    state: State<'_, AppState>,
    focus: Vec<String>,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ContemplateKnowledge)
        .map_err(|error| error.to_string())?;

    let horizon = current_central_horizon()?;
    let runtime = current_model_runtime()?;
    let canonical_session = runtime
        .agent_session
        .as_deref()
        .ok_or_else(|| "AIKit ModelRuntimeReadModel has no canonical AgentSession".to_owned())?;

    let mut surface = state
        .agent_surface
        .lock()
        .map_err(|_| "AgentSession Surface lock poisoned".to_owned())?;
    let surface = surface
        .as_mut()
        .ok_or_else(|| "no AgentSession Surface is open for explicit Contemplate".to_owned())?;
    let bound_session = surface
        .binding()
        .agent_session
        .as_ref()
        .ok_or_else(|| "open ACP Surface has no canonical AgentSession binding".to_owned())?;
    if bound_session.as_str() != canonical_session {
        return Err(format!(
            "AIKit runtime AgentSession `{canonical_session}` does not match open ACP Surface `{bound_session}`"
        ));
    }

    let knowledge = state
        .knowledge
        .lock()
        .map_err(|_| "Knowledge workbench lock poisoned".to_owned())?;
    let knowledge = knowledge
        .as_ref()
        .ok_or_else(|| "no local ProjectCentral Knowledge world is configured".to_owned())?;
    let mut executor = AcpLivingContemplateExecutor::new(surface);
    let outcome = knowledge
        .contemplate_refs(&horizon, focus, &runtime, &mut executor)
        .map_err(|error| error.to_string())?;

    let result = outcome.outcome;
    let agent_wiki = project_agent_wiki_plan(&result.agent_wiki);
    Ok(json!({
        "version": LIVING_CONTEMPLATE_PROJECTION_VERSION,
        "transport": LIVING_CONTEMPLATE_TRANSPORT_VERSION,
        "agent_session": canonical_session,
        "preflight": outcome.preflight,
        "agent_wiki": agent_wiki,
        "integrative_readings": result.integrative_readings,
        "candidates": result.candidates,
        "tensions": result.tensions,
        "human_source_mutation_performed": false,
    }))
}

fn current_central_horizon() -> Result<oi_desktop_core::CentralSourceHorizon, String> {
    let project_root = env::var_os("OI_PROJECT_ROOT")
        .map(PathBuf::from)
        .ok_or_else(|| "OI_PROJECT_ROOT is required for Living Knowledge".to_owned())?;
    let central_root = env::var_os("OI_CENTRAL_ROOT").map(PathBuf::from);
    read_central_change_horizon(&project_root, central_root.as_deref())
}

fn current_model_runtime() -> Result<NativeModelRuntimeReadModel, String> {
    let path = env::var_os("OI_AIKIT_MODEL_RUNTIME")
        .map(PathBuf::from)
        .ok_or_else(|| "OI_AIKIT_MODEL_RUNTIME is required for Contemplate preflight/execution".to_owned())?;
    load_model_runtime(path)
}
