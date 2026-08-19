use oi_desktop_core::{
    authorize_action, host_epi_cosmic, host_native_contribution, ActionAuthorityStore,
    ActionExecutionRequest, BoundedActionGrant, BridgeCallClass, BridgeCaller, BridgePolicy,
    DesktopHost, FactoryActionRoundTrip, FactoryBuildSnapshot, HostedContribution,
    LocalCentralHost, LocalEpiHost, LocalFactoryHost, NativeContributionReading, SemanticRef,
    ShellDestination, ShellSnapshot, SurfaceActionEmission, EPI_ANUTTARA_GROUND_ACTION_REF,
    EPI_COSMIC_CONTRIBUTION_REF, EPI_EPII_REVIEW_ACTION_REF, EPI_NARA_SENDOFF_ACTION_REF,
    EPI_NATIVE_OWNER, EPI_PERSONAL_PROPOSAL_ACTION_REF, EPI_PRIMITIVE_CONTRIBUTION_REF,
    FACTORY_BUILD_CONTRIBUTION_REF,
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

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PersonalDepthReceipt {
    schema: &'static str,
    kind: String,
    action_ref: String,
    subject_ref: String,
    authority_subject_ref: String,
    grant_ref: String,
    operation_id: String,
    reading: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    central_return: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    central_now: Option<Value>,
}

struct AppState {
    host: Mutex<DesktopHost>,
    contributions: Mutex<Vec<HostedContribution>>,
    factory: Mutex<Option<LocalFactoryHost>>,
    epi: Mutex<Option<LocalEpiHost>>,
    central: Mutex<Option<LocalCentralHost>>,
    action_authority: Mutex<ActionAuthorityStore>,
}

#[tauri::command]
fn shell_snapshot(state: State<'_, AppState>) -> Result<ShellSnapshot, String> {
    state.host.lock().map_err(|_| "desktop host lock poisoned".to_owned())?.snapshot(BridgeCaller::ShellUi).map_err(|error| error.to_string())
}

#[tauri::command]
fn contribution_catalog(state: State<'_, AppState>) -> Result<Vec<HostedContribution>, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::DiscloseContributions).map_err(|error| error.to_string())?;
    Ok(state.contributions.lock().map_err(|_| "contribution catalog lock poisoned".to_owned())?.clone())
}

#[tauri::command]
fn factory_build_snapshot(state: State<'_, AppState>) -> Result<Option<FactoryBuildSnapshot>, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveFactoryBuild).map_err(|error| error.to_string())?;
    let mut factory = state.factory.lock().map_err(|_| "Factory provider lock poisoned".to_owned())?;
    let Some(factory) = factory.as_mut() else { return Ok(None); };
    let observation = factory.refresh()?;
    replace_factory_contribution(&state, observation.contribution)?;
    Ok(observation.snapshot)
}

#[tauri::command]
fn epi_primitive_snapshot(state: State<'_, AppState>) -> Result<Option<Value>, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveEpiPrimitives).map_err(|error| error.to_string())?;
    let epi = state.epi.lock().map_err(|_| "Epi primitive provider lock poisoned".to_owned())?;
    let Some(epi) = epi.as_ref() else { return Ok(None); };
    let observation = epi.observe()?;
    replace_epi_contribution(&state, observation.contribution)?;
    Ok(Some(observation.snapshot))
}

#[tauri::command]
fn epi_cosmic_snapshot(state: State<'_, AppState>) -> Result<Option<Value>, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveEpiPrimitives).map_err(|error| error.to_string())?;
    let epi = state.epi.lock().map_err(|_| "Epi Cosmic provider lock poisoned".to_owned())?;
    let Some(epi) = epi.as_ref() else { return Ok(None); };
    let observation = host_epi_cosmic(epi.cosmic_current()?)?;
    replace_epi_cosmic_contribution(&state, observation.contribution)?;
    Ok(Some(observation.reading))
}

#[tauri::command]
fn nara_daily_snapshot(state: State<'_, AppState>) -> Result<Option<Value>, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveEpiNara).map_err(|error| error.to_string())?;
    let epi = state.epi.lock().map_err(|_| "Epi Nara provider lock poisoned".to_owned())?;
    let Some(epi) = epi.as_ref() else { return Ok(None); };
    Ok(Some(epi.nara_daily()?))
}

#[tauri::command]
fn central_now_snapshot(state: State<'_, AppState>) -> Result<Option<Value>, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveCentralNow).map_err(|error| error.to_string())?;
    let central = state.central.lock().map_err(|_| "Central NOW provider lock poisoned".to_owned())?;
    let Some(central) = central.as_ref() else { return Ok(None); };
    Ok(Some(central.inspect_now()?))
}

#[tauri::command]
fn nara_save_daily(state: State<'_, AppState>, body: String) -> Result<Value, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::WriteEpiNara).map_err(|error| error.to_string())?;
    let epi = state.epi.lock().map_err(|_| "Epi Nara provider lock poisoned".to_owned())?;
    let epi = epi.as_ref().ok_or_else(|| "no Epi-owned local Nara provider is configured".to_owned())?;
    epi.nara_write(&body)
}

#[tauri::command]
fn nara_send_selection(
    state: State<'_, AppState>, episode_ref: String, revision: u64, start_byte: usize,
    end_byte: usize, operation_id: String,
) -> Result<NaraActionReceipt, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchEpiNaraAction).map_err(|error| error.to_string())?;
    let epi = state.epi.lock().map_err(|_| "Epi Nara provider lock poisoned".to_owned())?;
    let epi = epi.as_ref().ok_or_else(|| "no Epi-owned local Nara provider is configured".to_owned())?;
    let selection = epi.nara_selection(selection_request(&episode_ref, revision, start_byte, end_byte))?;
    let selection_ref = required_json_string(&selection, "/selectionRef")?;
    let authority_subject_ref = required_json_string(&selection, "/episodeRef")?;
    let grant_ref = authorize_epi_action(&state, epi, EPI_NARA_SENDOFF_ACTION_REF, &selection_ref, &authority_subject_ref, &operation_id)?;
    let subject = SemanticRef {
        ref_id: selection_ref.clone(), kind: "nara-selection".into(), native_owner: EPI_NATIVE_OWNER.into(),
        provenance: oi_desktop_core::RefProvenance {
            source: "EpiLogos/Epi-Logos-C-Experiments::epi.nara-selection/v1".into(),
            revision: required_epi_binding_revision(epi)?,
        },
    };
    state.host.lock().map_err(|_| "desktop host lock poisoned".to_owned())?.select(BridgeCaller::ShellUi, subject).map_err(|error| error.to_string())?;
    let agent_context_scope = selection.pointer("/disclosureScope").and_then(Value::as_array).map(|items| items.iter().filter_map(Value::as_str).map(ToOwned::to_owned).collect()).unwrap_or_default();
    Ok(NaraActionReceipt { schema: "oi.epi-nara-action-receipt/v1", action_ref: EPI_NARA_SENDOFF_ACTION_REF.into(), subject_ref: selection_ref, authority_subject_ref, grant_ref, operation_id, selection, agent_context_scope })
}

#[tauri::command]
fn epi_personal_depth(
    state: State<'_, AppState>, kind: String, episode_ref: String, revision: u64,
    start_byte: usize, end_byte: usize, operation_id: String, review_ref: Option<String>,
    ground_ref: Option<String>, proposed_content: Option<String>,
) -> Result<PersonalDepthReceipt, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchEpiPersonalAction).map_err(|error| error.to_string())?;
    let epi = state.epi.lock().map_err(|_| "Epi Personal provider lock poisoned".to_owned())?;
    let epi = epi.as_ref().ok_or_else(|| "no Epi-owned local Personal provider is configured".to_owned())?;
    let selection_request = selection_request(&episode_ref, revision, start_byte, end_byte);
    let selection = epi.nara_selection(selection_request.clone())?;
    let selection_ref = required_json_string(&selection, "/selectionRef")?;
    let authority_subject_ref = required_json_string(&selection, "/episodeRef")?;

    match kind.as_str() {
        "explain" | "review" => {
            let action_ref = EPI_EPII_REVIEW_ACTION_REF;
            let grant_ref = authorize_epi_action(&state, epi, action_ref, &selection_ref, &authority_subject_ref, &operation_id)?;
            let reading = epi.epii_review(json!({ "selection": selection_request, "mode": kind }))?;
            ensure_same_subject(&reading, &selection_ref, &authority_subject_ref)?;
            personal_depth_receipt(&state, kind, action_ref, selection_ref, authority_subject_ref, grant_ref, operation_id, reading, false)
        }
        "source" | "bimba" | "provenance" => {
            let action_ref = EPI_ANUTTARA_GROUND_ACTION_REF;
            let grant_ref = authorize_epi_action(&state, epi, action_ref, &selection_ref, &authority_subject_ref, &operation_id)?;
            let reading = epi.personal_ground(json!({ "selection": selection_request, "reviewRef": review_ref }))?;
            ensure_same_subject(&reading, &selection_ref, &authority_subject_ref)?;
            personal_depth_receipt(&state, kind, action_ref, selection_ref, authority_subject_ref, grant_ref, operation_id, reading, false)
        }
        "proposal" => {
            let action_ref = EPI_PERSONAL_PROPOSAL_ACTION_REF;
            let grant_ref = authorize_epi_action(&state, epi, action_ref, &selection_ref, &authority_subject_ref, &operation_id)?;
            let reading = epi.personal_proposal(json!({ "selection": selection_request, "reviewRef": review_ref, "groundRef": ground_ref, "proposedContent": proposed_content }))?;
            ensure_same_subject(&reading, &selection_ref, &authority_subject_ref)?;
            personal_depth_receipt(&state, kind, action_ref, selection_ref, authority_subject_ref, grant_ref, operation_id, reading, true)
        }
        other => Err(format!("unsupported Personal summon `{other}`")),
    }
}

fn personal_depth_receipt(
    state: &State<'_, AppState>, kind: String, action_ref: &str, subject_ref: String,
    authority_subject_ref: String, grant_ref: String, operation_id: String, reading: Value,
    return_to_central: bool,
) -> Result<PersonalDepthReceipt, String> {
    let (central_return, central_now) = if return_to_central {
        let central = state.central.lock().map_err(|_| "Central NOW provider lock poisoned".to_owned())?;
        if let Some(central) = central.as_ref() { (Some(central.return_personal_proposal(&reading)?), Some(central.inspect_now()?)) } else { (None, None) }
    } else { (None, None) };
    Ok(PersonalDepthReceipt { schema: "oi.epi-personal-depth-receipt/v1", kind, action_ref: action_ref.into(), subject_ref, authority_subject_ref, grant_ref, operation_id, reading, central_return, central_now })
}

#[tauri::command]
fn reject_personal_proposal(state: State<'_, AppState>, handoff_id: String, proposal_ref: String) -> Result<Value, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchEpiPersonalAction).map_err(|error| error.to_string())?;
    let central = state.central.lock().map_err(|_| "Central NOW provider lock poisoned".to_owned())?;
    central.as_ref().ok_or_else(|| "no Central NOW provider is configured".to_owned())?.reject_return(&handoff_id, &proposal_ref)
}

#[tauri::command]
fn recognize_personal_human_source(state: State<'_, AppState>, source: String, destination: String) -> Result<Value, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchEpiPersonalAction).map_err(|error| error.to_string())?;
    let central = state.central.lock().map_err(|_| "Central NOW provider lock poisoned".to_owned())?;
    central.as_ref().ok_or_else(|| "no Central NOW provider is configured".to_owned())?.promote_human_source(&source, &destination)
}

#[tauri::command]
fn dispatch_factory_action(state: State<'_, AppState>, emission: SurfaceActionEmission, authority_ref: String, operation_id: String) -> Result<FactoryActionRoundTrip, String> {
    BridgePolicy.authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchFactoryAction).map_err(|error| error.to_string())?;
    let mut factory = state.factory.lock().map_err(|_| "Factory provider lock poisoned".to_owned())?;
    let factory = factory.as_mut().ok_or_else(|| "no Factory-owned local provider is configured".to_owned())?;
    let observation = factory.observe()?;
    let snapshot = observation.snapshot.as_ref().ok_or_else(|| "Factory provider did not expose a current Build snapshot".to_owned())?;
    let action = observation.contribution.contribution.actions.iter().find(|action| action.action_ref == emission.action_ref).ok_or_else(|| format!("Factory did not advertise Action `{}`", emission.action_ref))?;
    let binding_revision = observation.contribution.contribution.provenance.revision.clone().unwrap_or_else(|| snapshot.revision.to_string());
    let request = ActionExecutionRequest { operation_id, emission: emission.clone(), authority_subject_ref: None, native_owner: action.native_owner.clone(), required_capability_ref: action.required_capability_ref.clone(), binding_revision, now_unix_ms: now_unix_ms()? };
    let authorised = state.action_authority.lock().map_err(|_| "Action authority store lock poisoned".to_owned())?.authorize_and_consume(&authority_ref, &request)?;
    let round_trip = factory.dispatch(&emission, authorised.action_grant())?;
    let observation = factory.observe()?;
    replace_factory_contribution(&state, observation.contribution)?;
    Ok(round_trip)
}

#[tauri::command]
fn select_semantic_ref(state: State<'_, AppState>, subject: SemanticRef) -> Result<(), String> {
    state.host.lock().map_err(|_| "desktop host lock poisoned".to_owned())?.select(BridgeCaller::ShellUi, subject).map_err(|error| error.to_string())
}

#[tauri::command]
fn open_destination(state: State<'_, AppState>, destination: ShellDestination) -> Result<(), String> {
    state.host.lock().map_err(|_| "desktop host lock poisoned".to_owned())?.open_destination(BridgeCaller::ShellUi, destination).map_err(|error| error.to_string())
}

fn selection_request(episode_ref: &str, revision: u64, start_byte: usize, end_byte: usize) -> Value {
    json!({ "episodeRef": episode_ref, "revision": revision, "startByte": start_byte, "endByte": end_byte })
}

fn authorize_epi_action(state: &State<'_, AppState>, epi: &LocalEpiHost, action_ref: &str, selection_ref: &str, authority_subject_ref: &str, operation_id: &str) -> Result<String, String> {
    let observation = epi.observe()?;
    let action = observation.contribution.contribution.actions.iter().find(|binding| binding.action_ref == action_ref).cloned().ok_or_else(|| format!("Epi provider did not advertise governed Action `{action_ref}`"))?;
    let binding_revision = observation.contribution.contribution.provenance.revision.clone().ok_or_else(|| "Epi Personal Action binding requires exact source revision".to_owned())?;
    replace_epi_contribution(state, observation.contribution)?;
    let now = now_unix_ms()?;
    let mut authorities = state.action_authority.lock().map_err(|_| "Action authority store lock poisoned".to_owned())?;
    let grant_ref = authorities.available_grant_ref(action_ref, EPI_NATIVE_OWNER, authority_subject_ref, now).ok_or_else(|| format!("no current Epi-issued Action authority covers `{action_ref}` for Nara episode `{authority_subject_ref}`"))?;
    let request = ActionExecutionRequest {
        operation_id: operation_id.to_owned(),
        emission: SurfaceActionEmission { action_ref: action_ref.into(), subject_ref: selection_ref.into() },
        authority_subject_ref: Some(authority_subject_ref.into()), native_owner: EPI_NATIVE_OWNER.into(),
        required_capability_ref: action.required_capability_ref.clone(), binding_revision, now_unix_ms: now,
    };
    let authorised = authorities.authorize_and_consume(&grant_ref, &request)?;
    authorize_action(&action, authorised.action_grant())?;
    Ok(authorised.grant_ref)
}

fn required_epi_binding_revision(epi: &LocalEpiHost) -> Result<Option<String>, String> {
    Ok(epi.observe()?.contribution.contribution.provenance.revision)
}

fn ensure_same_subject(reading: &Value, selection_ref: &str, episode_ref: &str) -> Result<(), String> {
    let returned_selection = required_json_string(reading, "/subject/selectionRef")?;
    let returned_episode = required_json_string(reading, "/subject/episodeRef")?;
    if returned_selection != selection_ref || returned_episode != episode_ref { return Err("Epi Personal depth returned identity drift from the governed Nara subject".into()); }
    Ok(())
}

fn load_contribution_fixtures() -> Result<Vec<HostedContribution>, String> {
    let fixtures: ContributionFixtures = serde_json::from_str(CONTRIBUTION_FIXTURES).map_err(|error| format!("invalid desktop host-reading fixtures: {error}"))?;
    if fixtures.schema != "oi.desktop-host-reading-fixtures/v1" { return Err(format!("unsupported desktop host-reading fixture schema `{}`", fixtures.schema)); }
    fixtures.contributions.into_iter().map(|contribution| host_native_contribution(None, contribution)).collect()
}

fn load_local_factory() -> Result<Option<LocalFactoryHost>, String> {
    let state_path = env::var("OI_FACTORY_BUILD_STATE").ok();
    let project_ref = env::var("OI_FACTORY_PROJECT_REF").ok();
    let run_ref = env::var("OI_FACTORY_RUN_REF").ok();
    match (state_path, project_ref, run_ref) {
        (None, None, None) => Ok(None),
        (Some(state_path), Some(project_ref), Some(run_ref)) => LocalFactoryHost::open_refs(state_path, &project_ref, &run_ref).map(Some),
        _ => Err("local Factory provider requires OI_FACTORY_BUILD_STATE, OI_FACTORY_PROJECT_REF and OI_FACTORY_RUN_REF together".into()),
    }
}

fn load_local_epi() -> Result<Option<LocalEpiHost>, String> {
    let Some(executable) = env::var_os("OI_EPI_BRIDGE") else { return Ok(None); };
    let mut host = LocalEpiHost::open(executable);
    if let Some(path) = env::var_os("OI_EPI_VAK_FILE") { host = host.with_vak_file(path); }
    if let Some(path) = env::var_os("OI_EPI_NARA_CONTEXT_FILE") { host = host.with_nara_context_file(path); }
    if let Some(path) = env::var_os("OI_EPI_NARA_VAULT_ROOT") { host = host.with_nara_vault_root(path); }
    Ok(Some(host))
}

fn load_local_central() -> Result<Option<LocalCentralHost>, String> {
    match (env::var_os("OI_CENTRAL_CTRL"), env::var("OI_CENTRAL_PROJECT").ok()) {
        (None, None) => Ok(None),
        (Some(executable), Some(project)) => {
            let mut host = LocalCentralHost::open(executable, project);
            if let Some(root) = env::var_os("OI_CENTRAL_ROOT") { host = host.with_root(root); }
            Ok(Some(host))
        }
        _ => Err("Central NOW provider requires OI_CENTRAL_CTRL and OI_CENTRAL_PROJECT together; OI_CENTRAL_ROOT is optional".into()),
    }
}

fn load_action_authority() -> Result<ActionAuthorityStore, String> {
    let Some(path) = env::var_os("OI_ACTION_AUTHORITY_FILE") else { return Ok(ActionAuthorityStore::default()); };
    let content = fs::read_to_string(&path).map_err(|error| format!("read OI_ACTION_AUTHORITY_FILE: {error}"))?;
    fs::remove_file(&path).map_err(|error| format!("consume OI_ACTION_AUTHORITY_FILE: {error}"))?;
    let grants: Vec<BoundedActionGrant> = serde_json::from_str(&content).map_err(|error| format!("invalid bounded Action authority handoff: {error}"))?;
    let mut store = ActionAuthorityStore::default();
    for grant in grants { store.register_trusted(grant)?; }
    Ok(store)
}

fn required_json_string(value: &Value, pointer: &str) -> Result<String, String> {
    value.pointer(pointer).and_then(Value::as_str).filter(|value| !value.trim().is_empty()).map(ToOwned::to_owned).ok_or_else(|| format!("Epi Personal response requires string `{pointer}`"))
}

fn now_unix_ms() -> Result<u64, String> {
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| format!("system clock is before UNIX epoch: {error}"))?;
    u64::try_from(duration.as_millis()).map_err(|_| "system time exceeds u64 milliseconds".into())
}

fn replace_factory_contribution(state: &State<'_, AppState>, contribution: HostedContribution) -> Result<(), String> {
    let mut contributions = state.contributions.lock().map_err(|_| "contribution catalog lock poisoned".to_owned())?;
    replace_contribution_in(&mut contributions, contribution, FACTORY_BUILD_CONTRIBUTION_REF);
    Ok(())
}

fn replace_epi_contribution(state: &State<'_, AppState>, contribution: HostedContribution) -> Result<(), String> {
    let mut contributions = state.contributions.lock().map_err(|_| "contribution catalog lock poisoned".to_owned())?;
    replace_contribution_in(&mut contributions, contribution, EPI_PRIMITIVE_CONTRIBUTION_REF);
    Ok(())
}

fn replace_epi_cosmic_contribution(state: &State<'_, AppState>, contribution: HostedContribution) -> Result<(), String> {
    let mut contributions = state.contributions.lock().map_err(|_| "contribution catalog lock poisoned".to_owned())?;
    replace_contribution_in(&mut contributions, contribution, EPI_COSMIC_CONTRIBUTION_REF);
    Ok(())
}

fn replace_contribution_in(contributions: &mut Vec<HostedContribution>, contribution: HostedContribution, contribution_ref: &str) {
    contributions.retain(|entry| entry.contribution.contribution_ref != contribution_ref);
    contributions.push(contribution);
}

fn main() {
    let disclosure = oi_cli::status::live_disclosure().unwrap_or_else(|error| oi_cli::status::SuiteCompositionDisclosure::unavailable(error));
    let mut contributions = load_contribution_fixtures().unwrap_or_else(|error| { eprintln!("O:I desktop host-reading fixtures unavailable: {error}"); Vec::new() });
    let factory = load_local_factory().map_err(|error| eprintln!("O:I local Factory provider unavailable: {error}")).ok().flatten();
    let epi = load_local_epi().map_err(|error| eprintln!("O:I local Epi primitive provider unavailable: {error}")).ok().flatten();
    let central = load_local_central().map_err(|error| eprintln!("O:I local Central NOW provider unavailable: {error}")).ok().flatten();
    let action_authority = load_action_authority().unwrap_or_else(|error| { eprintln!("O:I Action authority handoff unavailable: {error}"); ActionAuthorityStore::default() });
    if let Some(factory) = factory.as_ref() { match factory.observe() { Ok(observation) => replace_contribution_in(&mut contributions, observation.contribution, FACTORY_BUILD_CONTRIBUTION_REF), Err(error) => eprintln!("O:I Factory observation degraded: {error}") } }
    if let Some(epi) = epi.as_ref() {
        match epi.observe() { Ok(observation) => replace_contribution_in(&mut contributions, observation.contribution, EPI_PRIMITIVE_CONTRIBUTION_REF), Err(error) => eprintln!("O:I Epi observation degraded: {error}") }
        match epi.cosmic_current().and_then(|reading| host_epi_cosmic(reading)) {
            Ok(observation) => replace_contribution_in(&mut contributions, observation.contribution, EPI_COSMIC_CONTRIBUTION_REF),
            Err(error) => eprintln!("O:I Epi Cosmic observation degraded: {error}"),
        }
    }

    tauri::Builder::default()
        .manage(AppState { host: Mutex::new(DesktopHost::new(disclosure)), contributions: Mutex::new(contributions), factory: Mutex::new(factory), epi: Mutex::new(epi), central: Mutex::new(central), action_authority: Mutex::new(action_authority) })
        .invoke_handler(tauri::generate_handler![shell_snapshot, contribution_catalog, factory_build_snapshot, epi_primitive_snapshot, epi_cosmic_snapshot, nara_daily_snapshot, central_now_snapshot, nara_save_daily, nara_send_selection, epi_personal_depth, reject_personal_proposal, recognize_personal_human_source, dispatch_factory_action, select_semantic_ref, open_destination])
        .run(tauri::generate_context!())
        .expect("failed to run O:I desktop");
}
