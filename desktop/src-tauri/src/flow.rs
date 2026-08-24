use std::env;
use std::path::PathBuf;

use oi_desktop_core::{
    project_agent_wiki_plan, AcpFlowContemplateExecutor, BridgeCallClass, BridgeCaller,
    BridgePolicy, CentralFlowClient, FlowAuthorityRef, FlowContextAuthority, FlowStandingContext,
    ResourceRef, FLOW_CONTEMPLATE_TRANSPORT_VERSION,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::State;

use super::living::{current_central_horizon, current_model_runtime};
use super::AppState;

pub const FLOW_CONTEMPLATE_PROJECTION_VERSION: &str = "oi.desktop-flow-contemplate/v1";

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct FlowAuthorityInput {
    kind: String,
    reference: String,
}

#[tauri::command]
pub(crate) fn flow_list() -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveFlow)
        .map_err(|error| error.to_string())?;
    serde_json::to_value(current_client()?.list()?)
        .map_err(|error| format!("serialize Flow list: {error}"))
}

#[tauri::command]
pub(crate) fn flow_create() -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::MutateFlow)
        .map_err(|error| error.to_string())?;
    serde_json::to_value(current_client()?.create_blank("human:oi-desktop")?)
        .map_err(|error| format!("serialize created Flow: {error}"))
}

#[tauri::command]
pub(crate) fn flow_open(flow_ref: String) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveFlow)
        .map_err(|error| error.to_string())?;
    serde_json::to_value(current_client()?.open(&flow_ref)?)
        .map_err(|error| format!("serialize Flow document: {error}"))
}

#[tauri::command]
pub(crate) fn flow_save(
    flow_ref: String,
    expected_revision: String,
    content: String,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::MutateFlow)
        .map_err(|error| error.to_string())?;
    serde_json::to_value(current_client()?.save_human(
        &flow_ref,
        &expected_revision,
        &content,
        "human:oi-desktop",
    )?)
    .map_err(|error| format!("serialize saved Flow: {error}"))
}

#[tauri::command]
pub(crate) fn flow_history(flow_ref: String) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveFlow)
        .map_err(|error| error.to_string())?;
    current_client()?.history(&flow_ref)
}

#[tauri::command]
pub(crate) fn flow_bind(
    state: State<'_, AppState>,
    flow_ref: String,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveFlow)
        .map_err(|error| error.to_string())?;
    serde_json::to_value(current_standing(&state, &flow_ref)?)
        .map_err(|error| format!("serialize Flow standing context: {error}"))
}

#[tauri::command]
pub(crate) fn flow_contemplate_preflight(
    state: State<'_, AppState>,
    flow_ref: String,
    #[serde(default)] authority_refs: Vec<FlowAuthorityInput>,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveFlow)
        .map_err(|error| error.to_string())?;
    let standing = current_standing(&state, &flow_ref)?;
    let context = current_context(&state)?;
    let runtime = current_model_runtime()?;
    let horizon = current_central_horizon()?;
    let authority_refs = authority_refs_for(&standing, authority_refs)?;
    let knowledge = state
        .knowledge
        .lock()
        .map_err(|_| "Knowledge workbench lock poisoned".to_owned())?;
    let knowledge = knowledge
        .as_ref()
        .ok_or_else(|| "no local ProjectCentral Knowledge world is configured".to_owned())?;
    let preflight = knowledge
        .flow_preflight(&horizon, &standing, &context, &runtime, &authority_refs)
        .map_err(|error| error.to_string())?;
    serde_json::to_value(preflight)
        .map_err(|error| format!("serialize Flow Contemplate preflight: {error}"))
}

/// Explicit `Contemplate(FlowRef)` over the already-open canonical AgentSession.
/// The model boundary is crossed exactly once by AIKit. Returned Flow mutation
/// intents are then delegated to the native Flow owner with the exact disclosed
/// revision; a concurrent human/source revision becomes a conflict, never an
/// overwrite or automatic append.
#[tauri::command]
pub(crate) fn flow_contemplate(
    state: State<'_, AppState>,
    flow_ref: String,
    #[serde(default)] authority_refs: Vec<FlowAuthorityInput>,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ContemplateFlow)
        .map_err(|error| error.to_string())?;

    let standing = current_standing(&state, &flow_ref)?;
    let context = current_context(&state)?;
    let runtime = current_model_runtime()?;
    let canonical_session = runtime
        .agent_session
        .as_deref()
        .ok_or_else(|| "AIKit ModelRuntimeReadModel has no canonical AgentSession".to_owned())?;
    if standing.binding.agent_session.as_str() != canonical_session {
        return Err("Flow standing context does not retain the current canonical AgentSession".into());
    }
    let authority_refs = authority_refs_for(&standing, authority_refs)?;
    let horizon = current_central_horizon()?;

    let mut surface = state
        .agent_surface
        .lock()
        .map_err(|_| "AgentSession Surface lock poisoned".to_owned())?;
    let surface = surface
        .as_mut()
        .ok_or_else(|| "no AgentSession Surface is open for explicit Flow Contemplate".to_owned())?;
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
    let mut executor = AcpFlowContemplateExecutor::new(surface);
    let outcome = knowledge
        .flow_contemplate(
            &horizon,
            &standing,
            &context,
            &runtime,
            &authority_refs,
            &mut executor,
        )
        .map_err(|error| error.to_string())?;

    let mut client = current_client()?;
    let mut owner_results = Vec::new();
    for intent in &outcome.flow_mutations {
        owner_results.push(client.apply_agent_intent(&outcome.preflight.standing, intent)?);
    }

    let result = outcome.living;
    let agent_wiki = project_agent_wiki_plan(&result.agent_wiki);
    Ok(json!({
        "version": FLOW_CONTEMPLATE_PROJECTION_VERSION,
        "transport": FLOW_CONTEMPLATE_TRANSPORT_VERSION,
        "agent_session": canonical_session,
        "flow_ref": flow_ref,
        "preflight": outcome.preflight,
        "flow_mutations": outcome.flow_mutations,
        "flow_owner_results": owner_results,
        "agent_wiki": agent_wiki,
        "integrative_readings": result.integrative_readings,
        "candidates": result.candidates,
        "tensions": result.tensions,
        "human_source_mutation_performed": false,
        "automatic_agent_or_model_invocation": false
    }))
}

fn current_client() -> Result<CentralFlowClient, String> {
    let project_root = env::var_os("OI_PROJECT_ROOT")
        .map(PathBuf::from)
        .ok_or_else(|| "OI_PROJECT_ROOT is required for Flow".to_owned())?;
    let central_root = env::var_os("OI_CENTRAL_ROOT").map(PathBuf::from);
    CentralFlowClient::discover(&project_root, central_root.as_deref())
}

fn current_context(state: &State<'_, AppState>) -> Result<oi_desktop_core::NativeContextResolution, String> {
    state
        .aikit_context
        .lock()
        .map_err(|_| "AIKit ContextResolution lock poisoned".to_owned())?
        .clone()
        .ok_or_else(|| "no canonical AIKit ContextResolution is configured".to_owned())
}

fn current_standing(
    state: &State<'_, AppState>,
    flow_ref: &str,
) -> Result<FlowStandingContext, String> {
    let context = current_context(state)?;
    let runtime = current_model_runtime()?;
    let session = runtime
        .agent_session
        .as_deref()
        .ok_or_else(|| "AIKit ModelRuntimeReadModel has no canonical AgentSession".to_owned())?;
    current_client()?.bind_for_act(
        &context,
        flow_ref,
        ResourceRef::parse(session).map_err(|error| error.to_string())?,
        runtime.agent.clone(),
        runtime.agency.clone(),
    )
}

fn authority_refs_for(
    standing: &FlowStandingContext,
    supplied: Vec<FlowAuthorityInput>,
) -> Result<Vec<FlowAuthorityRef>, String> {
    let mut refs = vec![
        FlowAuthorityRef {
            authority: FlowContextAuthority::Flow,
            reference: standing.binding.flow_ref.clone(),
        },
        FlowAuthorityRef {
            authority: FlowContextAuthority::AgentSession,
            reference: standing.binding.agent_session.clone(),
        },
    ];
    for input in supplied {
        let authority = match input.kind.as_str() {
            "wiki-reading" => FlowContextAuthority::WikiReading,
            "claim" => FlowContextAuthority::Claim,
            "ground" => FlowContextAuthority::Ground,
            "run" => FlowContextAuthority::Run,
            "flow" => FlowContextAuthority::Flow,
            "agent-session" => FlowContextAuthority::AgentSession,
            other => return Err(format!("unknown Flow authority category `{other}`")),
        };
        refs.push(FlowAuthorityRef {
            authority,
            reference: ResourceRef::parse(&input.reference).map_err(|error| error.to_string())?,
        });
    }
    refs.sort_by(|left, right| {
        format!("{:?}:{}", left.authority, left.reference)
            .cmp(&format!("{:?}:{}", right.authority, right.reference))
    });
    refs.dedup_by(|left, right| left.authority == right.authority && left.reference == right.reference);
    Ok(refs)
}
