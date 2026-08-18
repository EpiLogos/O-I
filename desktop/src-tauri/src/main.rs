use oi_desktop_core::{
    authorize_action, host_native_contribution, ActionAuthorityStore, ActionExecutionRequest,
    BoundedActionGrant, BridgeCallClass, BridgeCaller, BridgePolicy, DesktopHost,
    FactoryActionRoundTrip, FactoryBuildSnapshot, HostedContribution, LocalEpiHost,
    LocalFactoryHost, NativeContributionReading, SemanticRef, ShellDestination, ShellSnapshot,
    SurfaceActionEmission, EPI_NARA_SENDOFF_ACTION_REF, EPI_NATIVE_OWNER,
    EPI_PRIMITIVE_CONTRIBUTION_REF, FACTORY_BUILD_CONTRIBUTION_REF,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NaraActionReceipt {
    schema: &'static str,
    action_ref: String,
    subject_ref: String,
    authority_subject_ref: String,
    grant_ref: String,
    operation_id: String,
    selection: Value,
    agent_context_scope: Vec<String>,
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
fn factory_build_snapshot(state: State<'_, AppState>) -> Result<Option<FactoryBuildSnapshot>, String> {
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

#[tauri::command]
fn nara_daily_snapshot(state: State<'_, AppState>) -> Result<Option<Value>, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveEpiNara)
        .map_err(|error| error.to_string())?;
    let epi = state
        .epi
        .lock()
        .map_err(|_| "Epi Nara provider lock poisoned".to_owned())?;
    let Some(epi) = epi.as_ref() else {
        return Ok(None);
    };
    Ok(Some(epi.nara_daily()?))
}

#[tauri::command]
fn nara_save_daily(state: State<'_, AppState>, body: String) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::WriteEpiNara)
        .map_err(|error| error.to_string())?;
    let epi = state
        .epi
        .lock()
        .map_err(|_| "Epi Nara provider lock poisoned".to_owned())?;
    let epi = epi
        .as_ref()
        .ok_or_else(|| "no Epi-owned local Nara provider is configured".to_owned())?;
    epi.nara_write(&body)
}

/// Resolve an exact protected selection first, then disclose it only after a
/// pre-issued native Action + Capability grant scoped to its stable episode has
/// been consumed. O:I does not mint this authority and never broadens the packet.
#[tauri::command]
fn nara_send_selection(
    state: State<'_, AppState>,
    episode_ref: String,
    revision: u64,
    start_byte: usize,
    end_byte: usize,
    operation_id: String,
) -> Result<NaraActionReceipt, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchEpiNaraAction)
        .map_err(|error| error.to_string())?;

    let epi = state
        .epi
        .lock()
        .map_err(|_| "Epi Nara provider lock poisoned".to_owned())?;
    let epi = epi
        .as_ref()
        .ok_or_else(|| "no Epi-owned local Nara provider is configured".to_owned())?;

    // This remains inside the privileged native process. The webview sees the
    // selected text only if the governed Action below succeeds.
    let selection = epi.nara_selection(json!({
        "episodeRef": episode_ref,
        "revision": revision,
        "startByte": start_byte,
        "endByte": end_byte,
    }))?;
    let selection_ref = required_json_string(&selection, "/selectionRef")?;
    let authority_subject_ref = required_json_string(&selection, "/episodeRef")?;

    let observation = epi.observe()?;
    let action = observation
        .contribution
        .contribution
        .actions
        .iter()
        .find(|binding| binding.action_ref == EPI_NARA_SENDOFF_ACTION_REF)
        .ok_or_else(|| "Epi Nara provider did not advertise its governed sendoff Action".to_owned())?;
    let binding_revision = observation
        .contribution
        .contribution
        .provenance
        .revision
        .clone()
        .ok_or_else(|| "Epi Nara Action binding requires exact source revision".to_owned())?;
    replace_epi_contribution(&state, observation.contribution)?;

    let now = now_unix_ms()?;
    let mut authorities = state
        .action_authority
        .lock()
        .map_err(|_| "Action authority store lock poisoned".to_owned())?;
    let grant_ref = authorities
        .available_grant_ref(
            EPI_NARA_SENDOFF_ACTION_REF,
            EPI_NATIVE_OWNER,
            &authority_subject_ref,
            now,
        )
        .ok_or_else(|| {
            "no current Epi-issued Action authority covers selected-context disclosure from this Nara episode"
                .to_owned()
        })?;
    let request = ActionExecutionRequest {
        operation_id: operation_id.clone(),
        emission: SurfaceActionEmission {
            action_ref: EPI_NARA_SENDOFF_ACTION_REF.into(),
            subject_ref: selection_ref.clone(),
        },
        authority_subject_ref: Some(authority_subject_ref.clone()),
        native_owner: EPI_NATIVE_OWNER.into(),
        required_capability_ref: action.required_capability_ref.clone(),
        binding_revision: binding_revision.clone(),
        now_unix_ms: now,
    };
    let authorised = authorities.authorize_and_consume(&grant_ref, &request)?;
    authorize_action(action, authorised.action_grant())?;
    drop(authorities);

    let subject = SemanticRef {
        ref_id: selection_ref.clone(),
        kind: "nara-selection".into(),
        native_owner: EPI_NATIVE_OWNER.into(),
        provenance: oi_desktop_core::RefProvenance {
            source: "EpiLogos/Epi-Logos-C-Experiments::epi.nara-selection/v1".into(),
            revision: Some(binding_revision),
        },
    };
    state
        .host
        .lock()
        .map_err(|_| "desktop host lock poisoned".to_owned())?
        .select(BridgeCaller::ShellUi, subject)
        .map_err(|error| error.to_string())?;

    let agent_context_scope = selection
        .pointer("/disclosureScope")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default();

    Ok(NaraActionReceipt {
        schema: "oi.epi-nara-action-receipt/v1",
        action_ref: EPI_NARA_SENDOFF_ACTION_REF.into(),
        subject_ref: selection_ref,
        authority_subject_ref,
        grant_ref: authorised.grant_ref,
        operation_id,
        selection,
        agent_context_scope,
    })
}

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
        authority_subject_ref: None,
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
fn open_destination(state: State<'_, AppState>, destination: ShellDestination) -> Result<(), String> {
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
        return Err(format!("unsupported desktop host-reading fixture schema `{}`", fixtures.schema));
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
        (Some(state_path), Some(project_ref), Some(run_ref)) => {
            LocalFactoryHost::open_refs(state_path, &project_ref, &run_ref).map(Some)
        }
        _ => Err("local Factory provider requires OI_FACTORY_BUILD_STATE, OI_FACTORY_PROJECT_REF and OI_FACTORY_RUN_REF together".into()),
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
    if let Some(path) = env::var_os("OI_EPI_NARA_VAULT_ROOT") {
        host = host.with_nara_vault_root(path);
    }
    Ok(Some(host))
}

/// Optional one-shot native handoff from an authority-owning integration.
/// The file is consumed and deleted before the webview starts, so restart cannot
/// resurrect used grants. O:I never fabricates Action or Capability authority.
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

fn required_json_string(value: &Value, pointer: &str) -> Result<String, String> {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("Epi Nara response requires string `{pointer}`"))
}

fn now_unix_ms() -> Result<u64, String> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("system clock is before UNIX epoch: {error}"))?;
    u64::try_from(duration.as_millis()).map_err(|_| "system time exceeds u64 milliseconds".into())
}

fn replace_factory_contribution(state: &State<'_, AppState>, contribution: HostedContribution) -> Result<(), String> {
    let mut contributions = state
        .contributions
        .lock()
        .map_err(|_| "contribution catalog lock poisoned".to_owned())?;
    replace_contribution_in(&mut contributions, contribution, FACTORY_BUILD_CONTRIBUTION_REF);
    Ok(())
}

fn replace_epi_contribution(state: &State<'_, AppState>, contribution: HostedContribution) -> Result<(), String> {
    let mut contributions = state
        .contributions
        .lock()
        .map_err(|_| "contribution catalog lock poisoned".to_owned())?;
    replace_contribution_in(&mut contributions, contribution, EPI_PRIMITIVE_CONTRIBUTION_REF);
    Ok(())
}

fn replace_contribution_in(contributions: &mut Vec<HostedContribution>, contribution: HostedContribution, contribution_ref: &str) {
    contributions.retain(|entry| entry.contribution.contribution_ref != contribution_ref);
    contributions.push(contribution);
}

fn main() {
    let disclosure = oi_cli::status::live_disclosure()
        .unwrap_or_else(|error| oi_cli::status::SuiteCompositionDisclosure::unavailable(error));
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
            Ok(observation) => replace_contribution_in(&mut contributions, observation.contribution, FACTORY_BUILD_CONTRIBUTION_REF),
            Err(error) => eprintln!("O:I Factory observation degraded: {error}"),
        }
    }
    if let Some(epi) = epi.as_ref() {
        match epi.observe() {
            Ok(observation) => replace_contribution_in(&mut contributions, observation.contribution, EPI_PRIMITIVE_CONTRIBUTION_REF),
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
            nara_daily_snapshot,
            nara_save_daily,
            nara_send_selection,
            dispatch_factory_action,
            select_semantic_ref,
            open_destination
        ])
        .run(tauri::generate_context!())
        .expect("failed to run O:I desktop");
}
