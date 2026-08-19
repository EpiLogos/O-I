use oi_desktop_core::{
    host_native_contribution, ActionAuthorityStore, ActionExecutionRequest, AgentSurfaceOpenRequest,
    AgentSurfaceReading, AikitAgentSurface, BoundedActionGrant, BridgeCallClass, BridgeCaller,
    BridgePolicy, DesktopHost, FactoryActionRoundTrip, FactoryBuildSnapshot, HostedContribution,
    LocalAikitSessionSpaceHost, LocalAikitWorkbench, LocalFactoryHost, LocalProjectKnowledge,
    NativeContributionReading, SemanticRef, SessionSpaceFocusRequest, ShellDestination,
    ShellSnapshot, SurfaceActionEmission, AIKIT_SESSION_SPACE_CONTRIBUTION_REF,
    FACTORY_BUILD_CONTRIBUTION_REF,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

const CONTRIBUTION_FIXTURES: &str = include_str!("../../fixtures/native-contributions.json");

#[derive(Deserialize)]
struct ContributionFixtures {
    schema: String,
    contributions: Vec<NativeContributionReading>,
}

#[derive(Debug, Clone)]
struct AgentProviderConfig {
    connection_ref: String,
    argv: Vec<String>,
    cwd: String,
    provenance: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct AgentSurfaceOpenInput {
    agent_session_ref: String,
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    native_session_id: Option<String>,
}

struct AppState {
    host: Mutex<DesktopHost>,
    contributions: Mutex<Vec<HostedContribution>>,
    factory: Mutex<Option<LocalFactoryHost>>,
    action_authority: Mutex<ActionAuthorityStore>,
    aikit: Mutex<Option<LocalAikitWorkbench>>,
    aikit_runtime: Mutex<Option<LocalAikitSessionSpaceHost>>,
    knowledge: Mutex<Option<LocalProjectKnowledge>>,
    agent_provider: Option<AgentProviderConfig>,
    agent_surface: Mutex<Option<AikitAgentSurface>>,
}

#[tauri::command]
fn shell_snapshot(state: State<'_, AppState>) -> Result<ShellSnapshot, String> {
    state
        .host
        .lock()
        .map_err(|_| "desktop host lock poisoned".to_owned())?
        .snapshot(BridgeCaller::ShellUi)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn contribution_catalog(state: State<'_, AppState>) -> Result<Vec<HostedContribution>, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::DiscloseContributions)
        .map_err(|error| error.to_string())?;
    Ok(state
        .contributions
        .lock()
        .map_err(|_| "contribution catalog lock poisoned".to_owned())?
        .clone())
}

#[tauri::command]
fn factory_build_snapshot(
    state: State<'_, AppState>,
) -> Result<Option<FactoryBuildSnapshot>, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveFactoryBuild)
        .map_err(|error| error.to_string())?;
    let mut factory = state
        .factory
        .lock()
        .map_err(|_| "Factory provider lock poisoned".to_owned())?;
    let Some(factory) = factory.as_mut() else {
        return Ok(None);
    };
    let observation = factory.refresh()?;
    replace_contribution(
        &state,
        FACTORY_BUILD_CONTRIBUTION_REF,
        observation.contribution,
    )?;
    Ok(observation.snapshot)
}

/// Privileged native Action boundary.
///
/// The frontend may name only an opaque authority handle + operation id. It may
/// not submit Action/Capability authority facts. Those are registered in the
/// process-local store from a trusted native handoff and consumed here before the
/// Factory-owned Action executor can be reached.
#[tauri::command]
fn dispatch_factory_action(
    state: State<'_, AppState>,
    emission: SurfaceActionEmission,
    authority_ref: String,
    operation_id: String,
) -> Result<FactoryActionRoundTrip, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchFactoryAction)
        .map_err(|error| error.to_string())?;

    let mut factory = state
        .factory
        .lock()
        .map_err(|_| "Factory provider lock poisoned".to_owned())?;
    let factory = factory
        .as_mut()
        .ok_or_else(|| "no Factory-owned local provider is configured".to_owned())?;

    let observation = factory.observe()?;
    let snapshot = observation
        .snapshot
        .as_ref()
        .ok_or_else(|| "Factory provider did not expose a current Build snapshot".to_owned())?;
    let action = observation
        .contribution
        .contribution
        .actions
        .iter()
        .find(|action| action.action_ref == emission.action_ref)
        .ok_or_else(|| format!("Factory did not advertise Action `{}`", emission.action_ref))?;
    let binding_revision = observation
        .contribution
        .contribution
        .provenance
        .revision
        .clone()
        .unwrap_or_else(|| snapshot.revision.to_string());

    let request = ActionExecutionRequest {
        operation_id,
        emission: emission.clone(),
        native_owner: action.native_owner.clone(),
        required_capability_ref: action.required_capability_ref.clone(),
        binding_revision,
        now_unix_ms: now_unix_ms()?,
    };
    let authorised = state
        .action_authority
        .lock()
        .map_err(|_| "Action authority store lock poisoned".to_owned())?
        .authorize_and_consume(&authority_ref, &request)?;

    let round_trip = factory.dispatch(&emission, authorised.action_grant())?;
    let observation = factory.observe()?;
    replace_contribution(
        &state,
        FACTORY_BUILD_CONTRIBUTION_REF,
        observation.contribution,
    )?;
    Ok(round_trip)
}

// ---------------------------------------------------------------------------
// AIKit SessionSpace application projection
// ---------------------------------------------------------------------------

#[tauri::command]
fn aikit_session_spaces(state: State<'_, AppState>) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveSessionSpace)
        .map_err(|error| error.to_string())?;
    let aikit = state
        .aikit
        .lock()
        .map_err(|_| "AIKit workbench lock poisoned".to_owned())?;
    let aikit = aikit
        .as_ref()
        .ok_or_else(|| "native AIKit application is not available".to_owned())?;
    to_value(aikit.list_session_spaces().map_err(|error| error.to_string())?)
}

#[tauri::command]
fn aikit_session_space_read(
    state: State<'_, AppState>,
    session_space_ref: String,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveSessionSpace)
        .map_err(|error| error.to_string())?;

    // Runtime observation is read independently from canonical application state.
    // If configured, failure is returned rather than silently presenting stale
    // provider truth as current. Identity is checked again by LocalAikitWorkbench.
    let runtime_observation = {
        let runtime = state
            .aikit_runtime
            .lock()
            .map_err(|_| "AIKit runtime observation lock poisoned".to_owned())?;
        runtime
            .as_ref()
            .map(LocalAikitSessionSpaceHost::observe)
            .transpose()?
    };
    if let Some(observation) = runtime_observation.as_ref() {
        replace_contribution(
            &state,
            AIKIT_SESSION_SPACE_CONTRIBUTION_REF,
            observation.contribution.clone(),
        )?;
    }

    let aikit = state
        .aikit
        .lock()
        .map_err(|_| "AIKit workbench lock poisoned".to_owned())?;
    let aikit = aikit
        .as_ref()
        .ok_or_else(|| "native AIKit application is not available".to_owned())?;
    to_value(
        aikit
            .read_session_space_with_runtime(
                &session_space_ref,
                runtime_observation
                    .as_ref()
                    .map(|observation| &observation.read_model),
            )
            .map_err(|error| error.to_string())?,
    )
}

#[tauri::command]
fn aikit_session_space_focus(
    state: State<'_, AppState>,
    request: SessionSpaceFocusRequest,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(
            BridgeCaller::ShellUi,
            BridgeCallClass::MutateSessionSpaceFocus,
        )
        .map_err(|error| error.to_string())?;
    let aikit = state
        .aikit
        .lock()
        .map_err(|_| "AIKit workbench lock poisoned".to_owned())?;
    let aikit = aikit
        .as_ref()
        .ok_or_else(|| "native AIKit application is not available".to_owned())?;
    to_value(
        aikit
            .focus_session_space(&request)
            .map_err(|error| error.to_string())?,
    )
}

// ---------------------------------------------------------------------------
// Generic AIKit AgentSession conversation Surface
// ---------------------------------------------------------------------------

#[tauri::command]
fn agent_surface_open(
    state: State<'_, AppState>,
    request: AgentSurfaceOpenInput,
) -> Result<AgentSurfaceReading, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::InteractAgentSession)
        .map_err(|error| error.to_string())?;
    let provider = state
        .agent_provider
        .as_ref()
        .ok_or_else(|| "no native AgentSession provider is configured".to_owned())?;
    let mut current = state
        .agent_surface
        .lock()
        .map_err(|_| "AgentSession Surface lock poisoned".to_owned())?;
    if current.is_some() {
        return Err(
            "an AgentSession Surface is already open; close it explicitly before replacing it"
                .into(),
        );
    }
    let (surface, reading) = AikitAgentSurface::open(AgentSurfaceOpenRequest {
        connection_ref: provider.connection_ref.clone(),
        agent_session_ref: request.agent_session_ref,
        argv: provider.argv.clone(),
        cwd: provider.cwd.clone(),
        mode: request.mode,
        native_session_id: request.native_session_id,
        provenance: provider.provenance.clone(),
    })?;
    *current = Some(surface);
    Ok(reading)
}

#[tauri::command]
fn agent_surface_send(state: State<'_, AppState>, text: String) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::InteractAgentSession)
        .map_err(|error| error.to_string())?;
    let mut current = state
        .agent_surface
        .lock()
        .map_err(|_| "AgentSession Surface lock poisoned".to_owned())?;
    let surface = current
        .as_mut()
        .ok_or_else(|| "no AgentSession Surface is open".to_owned())?;
    to_value(surface.send(&text)?)
}

#[tauri::command]
fn agent_surface_cancel(state: State<'_, AppState>) -> Result<(), String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::InteractAgentSession)
        .map_err(|error| error.to_string())?;
    let mut current = state
        .agent_surface
        .lock()
        .map_err(|_| "AgentSession Surface lock poisoned".to_owned())?;
    current
        .as_mut()
        .ok_or_else(|| "no AgentSession Surface is open".to_owned())?
        .cancel()
}

#[tauri::command]
fn agent_surface_close(state: State<'_, AppState>) -> Result<(), String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::InteractAgentSession)
        .map_err(|error| error.to_string())?;
    let mut current = state
        .agent_surface
        .lock()
        .map_err(|_| "AgentSession Surface lock poisoned".to_owned())?;
    let mut surface = current
        .take()
        .ok_or_else(|| "no AgentSession Surface is open".to_owned())?;
    surface.close()
}

// ---------------------------------------------------------------------------
// ProjectCentral -> SemanticWiki -> AIKit Knowledge application projection
// ---------------------------------------------------------------------------

#[tauri::command]
fn knowledge_status(state: State<'_, AppState>) -> Result<Value, String> {
    with_knowledge(&state, |knowledge| to_value(knowledge.status()))
}

#[tauri::command]
fn knowledge_search(
    state: State<'_, AppState>,
    query: String,
    limit: usize,
) -> Result<Value, String> {
    with_knowledge(&state, |knowledge| {
        to_value(
            knowledge
                .search(&query, limit)
                .map_err(|error| error.to_string())?,
        )
    })
}

#[tauri::command]
fn knowledge_read(state: State<'_, AppState>, resource_ref: String) -> Result<Value, String> {
    with_knowledge(&state, |knowledge| {
        to_value(
            knowledge
                .read(&resource_ref)
                .map_err(|error| error.to_string())?,
        )
    })
}

#[tauri::command]
fn knowledge_relations(
    state: State<'_, AppState>,
    resource_ref: String,
    depth: u8,
    max_nodes: usize,
    max_edges: usize,
) -> Result<Value, String> {
    with_knowledge(&state, |knowledge| {
        to_value(
            knowledge
                .relations(&resource_ref, depth, max_nodes, max_edges)
                .map_err(|error| error.to_string())?,
        )
    })
}

#[tauri::command]
fn knowledge_explain(
    state: State<'_, AppState>,
    resource_ref: String,
) -> Result<Value, String> {
    with_knowledge(&state, |knowledge| {
        to_value(
            knowledge
                .explain(&resource_ref)
                .map_err(|error| error.to_string())?,
        )
    })
}

#[tauri::command]
fn knowledge_history(
    state: State<'_, AppState>,
    resource_ref: Option<String>,
) -> Result<Value, String> {
    with_knowledge(&state, |knowledge| {
        to_value(
            knowledge
                .history(resource_ref.as_deref())
                .map_err(|error| error.to_string())?,
        )
    })
}

#[tauri::command]
fn select_semantic_ref(state: State<'_, AppState>, subject: SemanticRef) -> Result<(), String> {
    state
        .host
        .lock()
        .map_err(|_| "desktop host lock poisoned".to_owned())?
        .select(BridgeCaller::ShellUi, subject)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn open_destination(
    state: State<'_, AppState>,
    destination: ShellDestination,
) -> Result<(), String> {
    state
        .host
        .lock()
        .map_err(|_| "desktop host lock poisoned".to_owned())?
        .open_destination(BridgeCaller::ShellUi, destination)
        .map_err(|error| error.to_string())
}

fn with_knowledge<T>(
    state: &State<'_, AppState>,
    operation: impl FnOnce(&LocalProjectKnowledge) -> Result<T, String>,
) -> Result<T, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveKnowledge)
        .map_err(|error| error.to_string())?;
    let knowledge = state
        .knowledge
        .lock()
        .map_err(|_| "Knowledge workbench lock poisoned".to_owned())?;
    operation(
        knowledge
            .as_ref()
            .ok_or_else(|| "no local ProjectCentral Knowledge world is configured".to_owned())?,
    )
}

fn to_value(value: impl Serialize) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|error| format!("serialize desktop projection: {error}"))
}

fn load_contribution_fixtures() -> Result<Vec<HostedContribution>, String> {
    let fixtures: ContributionFixtures = serde_json::from_str(CONTRIBUTION_FIXTURES)
        .map_err(|error| format!("invalid desktop host-reading fixtures: {error}"))?;
    if fixtures.schema != "oi.desktop-host-reading-fixtures/v1" {
        return Err(format!(
            "unsupported desktop host-reading fixture schema `{}`",
            fixtures.schema
        ));
    }
    fixtures
        .contributions
        .into_iter()
        .map(|contribution| host_native_contribution(None, contribution))
        .collect()
}

fn load_local_factory() -> Result<Option<LocalFactoryHost>, String> {
    let state_path = env::var("OI_FACTORY_BUILD_STATE").ok();
    let project_ref = env::var("OI_FACTORY_PROJECT_REF").ok();
    let run_ref = env::var("OI_FACTORY_RUN_REF").ok();
    match (state_path, project_ref, run_ref) {
        (None, None, None) => Ok(None),
        (Some(state_path), Some(project_ref), Some(run_ref)) => LocalFactoryHost::open_refs(
            state_path,
            &project_ref,
            &run_ref,
        )
        .map(Some),
        _ => Err(
            "local Factory provider requires OI_FACTORY_BUILD_STATE, OI_FACTORY_PROJECT_REF and OI_FACTORY_RUN_REF together"
                .into(),
        ),
    }
}

fn load_local_aikit() -> Result<Option<LocalAikitWorkbench>, String> {
    LocalAikitWorkbench::discover()
        .map(Some)
        .map_err(|error| error.to_string())
}

fn load_local_aikit_runtime() -> Result<Option<LocalAikitSessionSpaceHost>, String> {
    let Some(path) = env::var_os("OI_AIKIT_SESSION_SPACE_OBSERVATION") else {
        return Ok(None);
    };
    LocalAikitSessionSpaceHost::open(PathBuf::from(path)).map(Some)
}

fn load_local_knowledge() -> Result<Option<LocalProjectKnowledge>, String> {
    let Some(project_root) = env::var_os("OI_PROJECT_ROOT") else {
        return Ok(None);
    };
    let central_root = env::var_os("OI_CENTRAL_ROOT").map(PathBuf::from);
    let actor = env::var("OI_KNOWLEDGE_ACTOR_REF").ok();
    let agency = env::var("OI_KNOWLEDGE_AGENCY_REF").ok();
    let focus = env::var("OI_KNOWLEDGE_FOCUS").ok();
    LocalProjectKnowledge::discover(
        PathBuf::from(project_root),
        central_root.as_deref(),
        actor.as_deref(),
        agency.as_deref(),
        focus,
    )
    .map(Some)
    .map_err(|error| error.to_string())
}

fn load_agent_provider() -> Result<Option<AgentProviderConfig>, String> {
    let Some(raw_argv) = env::var("OI_AGENT_PROVIDER_ARGV").ok() else {
        return Ok(None);
    };
    let argv: Vec<String> = serde_json::from_str(&raw_argv)
        .map_err(|error| format!("OI_AGENT_PROVIDER_ARGV must be a JSON string array: {error}"))?;
    if argv.is_empty() {
        return Err("OI_AGENT_PROVIDER_ARGV cannot be empty".into());
    }
    let cwd = env::var("OI_AGENT_PROVIDER_CWD")
        .unwrap_or_else(|_| env::current_dir().unwrap_or_default().display().to_string());
    let connection_ref = env::var("OI_AGENT_CONNECTION_REF")
        .unwrap_or_else(|_| "connection/oi-desktop/acp".into());
    let provenance = env::var("OI_AGENT_PROVIDER_PROVENANCE")
        .ok()
        .map(|value| vec![value])
        .unwrap_or_else(|| vec!["native O:I desktop provider configuration".into()]);
    Ok(Some(AgentProviderConfig {
        connection_ref,
        argv,
        cwd,
        provenance,
    }))
}

/// Optional one-shot native handoff from an authority-owning integration.
///
/// The file is consumed and deleted before the webview is started. Restarting the
/// desktop therefore cannot resurrect already materialised grants from this
/// handoff. Failure to parse after consumption fails closed and loses the grants.
fn load_action_authority() -> Result<ActionAuthorityStore, String> {
    let Some(path) = env::var_os("OI_ACTION_AUTHORITY_FILE") else {
        return Ok(ActionAuthorityStore::default());
    };
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("read OI_ACTION_AUTHORITY_FILE: {error}"))?;
    fs::remove_file(&path)
        .map_err(|error| format!("consume OI_ACTION_AUTHORITY_FILE: {error}"))?;
    let grants: Vec<BoundedActionGrant> = serde_json::from_str(&content)
        .map_err(|error| format!("invalid bounded Action authority handoff: {error}"))?;
    let mut store = ActionAuthorityStore::default();
    for grant in grants {
        store.register_trusted(grant)?;
    }
    Ok(store)
}

fn now_unix_ms() -> Result<u64, String> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("system clock is before UNIX epoch: {error}"))?;
    u64::try_from(duration.as_millis()).map_err(|_| "system time exceeds u64 milliseconds".into())
}

fn replace_contribution(
    state: &State<'_, AppState>,
    contribution_ref: &str,
    contribution: HostedContribution,
) -> Result<(), String> {
    let mut contributions = state
        .contributions
        .lock()
        .map_err(|_| "contribution catalog lock poisoned".to_owned())?;
    replace_contribution_in(&mut contributions, contribution_ref, contribution);
    Ok(())
}

fn replace_contribution_in(
    contributions: &mut Vec<HostedContribution>,
    contribution_ref: &str,
    contribution: HostedContribution,
) {
    contributions.retain(|entry| entry.contribution.contribution_ref != contribution_ref);
    contributions.push(contribution);
}

fn main() {
    let disclosure = oi_cli::status::live_disclosure().unwrap_or_else(|error| {
        oi_cli::status::SuiteCompositionDisclosure::unavailable(error)
    });
    let mut contributions = load_contribution_fixtures().unwrap_or_else(|error| {
        eprintln!("O:I desktop host-reading fixtures unavailable: {error}");
        Vec::new()
    });
    let factory = load_local_factory()
        .map_err(|error| eprintln!("O:I local Factory provider unavailable: {error}"))
        .ok()
        .flatten();
    let action_authority = load_action_authority().unwrap_or_else(|error| {
        eprintln!("O:I Action authority handoff unavailable: {error}");
        ActionAuthorityStore::default()
    });
    let aikit = load_local_aikit()
        .map_err(|error| eprintln!("O:I native AIKit application unavailable: {error}"))
        .ok()
        .flatten();
    let aikit_runtime = load_local_aikit_runtime()
        .map_err(|error| eprintln!("O:I AIKit runtime observation unavailable: {error}"))
        .ok()
        .flatten();
    let knowledge = load_local_knowledge()
        .map_err(|error| eprintln!("O:I local Knowledge world unavailable: {error}"))
        .ok()
        .flatten();
    let agent_provider = load_agent_provider()
        .map_err(|error| eprintln!("O:I AgentSession provider unavailable: {error}"))
        .ok()
        .flatten();
    if let Some(factory) = factory.as_ref() {
        match factory.observe() {
            Ok(observation) => replace_contribution_in(
                &mut contributions,
                FACTORY_BUILD_CONTRIBUTION_REF,
                observation.contribution,
            ),
            Err(error) => eprintln!("O:I Factory observation degraded: {error}"),
        }
    }
    if let Some(runtime) = aikit_runtime.as_ref() {
        match runtime.observe() {
            Ok(observation) => replace_contribution_in(
                &mut contributions,
                AIKIT_SESSION_SPACE_CONTRIBUTION_REF,
                observation.contribution,
            ),
            Err(error) => eprintln!("O:I AIKit SessionSpace observation degraded: {error}"),
        }
    }

    tauri::Builder::default()
        .manage(AppState {
            host: Mutex::new(DesktopHost::new(disclosure)),
            contributions: Mutex::new(contributions),
            factory: Mutex::new(factory),
            action_authority: Mutex::new(action_authority),
            aikit: Mutex::new(aikit),
            aikit_runtime: Mutex::new(aikit_runtime),
            knowledge: Mutex::new(knowledge),
            agent_provider,
            agent_surface: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            shell_snapshot,
            contribution_catalog,
            factory_build_snapshot,
            dispatch_factory_action,
            aikit_session_spaces,
            aikit_session_space_read,
            aikit_session_space_focus,
            agent_surface_open,
            agent_surface_send,
            agent_surface_cancel,
            agent_surface_close,
            knowledge_status,
            knowledge_search,
            knowledge_read,
            knowledge_relations,
            knowledge_explain,
            knowledge_history,
            select_semantic_ref,
            open_destination
        ])
        .run(tauri::generate_context!())
        .expect("failed to run O:I desktop");
}
