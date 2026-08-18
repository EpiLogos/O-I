use oi_desktop_core::{
    host_native_contribution, ActionAuthorityStore, ActionExecutionRequest, BoundedActionGrant,
    BridgeCallClass, BridgeCaller, BridgePolicy, DesktopHost, FactoryActionRoundTrip,
    FactoryBuildSnapshot, HostedContribution, LocalEpiHost, LocalFactoryHost,
    NativeContributionReading, SemanticRef, ShellDestination, ShellSnapshot, SurfaceActionEmission,
    EPI_PRIMITIVE_CONTRIBUTION_REF, FACTORY_BUILD_CONTRIBUTION_REF,
};
use serde::Deserialize;
use serde_json::Value;
use std::env;
use std::fs;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

const CONTRIBUTION_FIXTURES: &str = include_str!("../../fixtures/native-contributions.json");

#[derive(Deserialize)]
struct ContributionFixtures {
    schema: String,
    contributions: Vec<NativeContributionReading>,
}

struct AppState {
    host: Mutex<DesktopHost>,
    contributions: Mutex<Vec<HostedContribution>>,
    factory: Mutex<Option<LocalFactoryHost>>,
    epi: Mutex<Option<LocalEpiHost>>,
    action_authority: Mutex<ActionAuthorityStore>,
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
    replace_factory_contribution(&state, observation.contribution)?;
    Ok(observation.snapshot)
}

#[tauri::command]
fn epi_primitive_snapshot(state: State<'_, AppState>) -> Result<Option<Value>, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveEpiPrimitives)
        .map_err(|error| error.to_string())?;
    let epi = state
        .epi
        .lock()
        .map_err(|_| "Epi primitive provider lock poisoned".to_owned())?;
    let Some(epi) = epi.as_ref() else {
        return Ok(None);
    };
    let observation = epi.observe()?;
    replace_epi_contribution(&state, observation.contribution)?;
    Ok(Some(observation.snapshot))
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
    replace_factory_contribution(&state, observation.contribution)?;
    Ok(round_trip)
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

fn load_local_epi() -> Result<Option<LocalEpiHost>, String> {
    let Some(executable) = env::var_os("OI_EPI_BRIDGE") else {
        return Ok(None);
    };
    let mut host = LocalEpiHost::open(executable);
    if let Some(path) = env::var_os("OI_EPI_VAK_FILE") {
        host = host.with_vak_file(path);
    }
    if let Some(path) = env::var_os("OI_EPI_NARA_CONTEXT_FILE") {
        host = host.with_nara_context_file(path);
    }
    Ok(Some(host))
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

fn replace_factory_contribution(
    state: &State<'_, AppState>,
    contribution: HostedContribution,
) -> Result<(), String> {
    let mut contributions = state
        .contributions
        .lock()
        .map_err(|_| "contribution catalog lock poisoned".to_owned())?;
    replace_contribution_in(
        &mut contributions,
        contribution,
        FACTORY_BUILD_CONTRIBUTION_REF,
    );
    Ok(())
}

fn replace_epi_contribution(
    state: &State<'_, AppState>,
    contribution: HostedContribution,
) -> Result<(), String> {
    let mut contributions = state
        .contributions
        .lock()
        .map_err(|_| "contribution catalog lock poisoned".to_owned())?;
    replace_contribution_in(
        &mut contributions,
        contribution,
        EPI_PRIMITIVE_CONTRIBUTION_REF,
    );
    Ok(())
}

fn replace_contribution_in(
    contributions: &mut Vec<HostedContribution>,
    contribution: HostedContribution,
    contribution_ref: &str,
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
    let epi = load_local_epi()
        .map_err(|error| eprintln!("O:I local Epi primitive provider unavailable: {error}"))
        .ok()
        .flatten();
    let action_authority = load_action_authority().unwrap_or_else(|error| {
        eprintln!("O:I Action authority handoff unavailable: {error}");
        ActionAuthorityStore::default()
    });
    if let Some(factory) = factory.as_ref() {
        match factory.observe() {
            Ok(observation) => replace_contribution_in(
                &mut contributions,
                observation.contribution,
                FACTORY_BUILD_CONTRIBUTION_REF,
            ),
            Err(error) => eprintln!("O:I Factory observation degraded: {error}"),
        }
    }
    if let Some(epi) = epi.as_ref() {
        match epi.observe() {
            Ok(observation) => replace_contribution_in(
                &mut contributions,
                observation.contribution,
                EPI_PRIMITIVE_CONTRIBUTION_REF,
            ),
            Err(error) => eprintln!("O:I Epi observation degraded: {error}"),
        }
    }

    tauri::Builder::default()
        .manage(AppState {
            host: Mutex::new(DesktopHost::new(disclosure)),
            contributions: Mutex::new(contributions),
            factory: Mutex::new(factory),
            epi: Mutex::new(epi),
            action_authority: Mutex::new(action_authority),
        })
        .invoke_handler(tauri::generate_handler![
            shell_snapshot,
            contribution_catalog,
            factory_build_snapshot,
            epi_primitive_snapshot,
            dispatch_factory_action,
            select_semantic_ref,
            open_destination
        ])
        .run(tauri::generate_context!())
        .expect("failed to run O:I desktop");
}
