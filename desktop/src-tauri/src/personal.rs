use super::AppState;
use oi_desktop_core::{
    authorize_action, ActionExecutionRequest, BridgeCallClass, BridgeCaller, BridgePolicy,
    LocalCentralHost, LocalEpiHost, RefProvenance, SemanticRef, SurfaceActionEmission,
    EPI_ANUTTARA_GROUND_ACTION_REF, EPI_EPII_REVIEW_ACTION_REF, EPI_NATIVE_OWNER,
    EPI_NARA_SENDOFF_ACTION_REF, EPI_PERSONAL_450_CONTRIBUTION_REF,
    EPI_PERSONAL_PROPOSAL_ACTION_REF,
};
use serde_json::{json, Value};
use std::env;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub(crate) fn personal_450_snapshot(state: State<'_, AppState>) -> Result<Option<Value>, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveEpiPersonal)
        .map_err(|error| error.to_string())?;
    let Some(epi) = load_epi()? else { return Ok(None); };
    let observation = epi.observe_personal()?;
    super::replace_contribution(
        &state,
        EPI_PERSONAL_450_CONTRIBUTION_REF,
        observation.contribution,
    )?;
    Ok(Some(observation.application))
}

#[tauri::command]
pub(crate) fn nara_daily_snapshot() -> Result<Option<Value>, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveEpiPersonal)
        .map_err(|error| error.to_string())?;
    let Some(epi) = load_epi()? else { return Ok(None); };
    Ok(Some(epi.nara_daily()?))
}

#[tauri::command]
pub(crate) fn nara_save_daily(body: String) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::WriteEpiNara)
        .map_err(|error| error.to_string())?;
    load_epi_required()?.nara_write(&body)
}

#[tauri::command]
pub(crate) fn nara_send_selection(
    state: State<'_, AppState>,
    episode_ref: String,
    revision: u64,
    start_byte: usize,
    end_byte: usize,
    operation_id: String,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchEpiNaraAction)
        .map_err(|error| error.to_string())?;
    let epi = load_epi_required()?;
    let selection = epi.nara_selection(selection_request(
        &episode_ref,
        revision,
        start_byte,
        end_byte,
    ))?;
    let selection_ref = required_string(&selection, "/selectionRef")?;
    let returned_episode = required_string(&selection, "/episodeRef")?;
    let returned_revision = selection
        .pointer("/episodeRevision")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Epi selection requires episodeRevision".to_owned())?;
    if returned_episode != episode_ref || returned_revision != revision {
        return Err("Epi selection drifted from the exact saved episode/revision".into());
    }
    let grant_ref = authorize_epi_action(
        &state,
        &epi,
        EPI_NARA_SENDOFF_ACTION_REF,
        &selection_ref,
        &episode_ref,
        &operation_id,
    )?;
    let source_revision = required_string(&selection, "/provenance/sourceRevision")?;
    state
        .host
        .lock()
        .map_err(|_| "desktop host lock poisoned".to_owned())?
        .select(
            BridgeCaller::ShellUi,
            SemanticRef {
                ref_id: selection_ref.clone(),
                kind: "nara-selection".into(),
                native_owner: EPI_NATIVE_OWNER.into(),
                provenance: RefProvenance {
                    source: "Epi native governed selection".into(),
                    revision: Some(source_revision),
                },
            },
        )
        .map_err(|error| error.to_string())?;
    Ok(json!({
        "schema": "oi.epi-nara-action-receipt/v2",
        "actionRef": EPI_NARA_SENDOFF_ACTION_REF,
        "subjectRef": selection_ref,
        "authoritySubjectRef": episode_ref,
        "grantRef": grant_ref,
        "operationId": operation_id,
        "selection": selection,
        "agentContextDisclosed": false
    }))
}

#[tauri::command]
pub(crate) fn epi_personal_review(
    state: State<'_, AppState>,
    episode_ref: String,
    revision: u64,
    start_byte: usize,
    end_byte: usize,
    mode: String,
    operation_id: String,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchEpiPersonalAction)
        .map_err(|error| error.to_string())?;
    if !matches!(mode.as_str(), "explain" | "review") {
        return Err("Personal review mode must be `explain` or `review`".into());
    }
    let epi = load_epi_required()?;
    let selection_request = selection_request(&episode_ref, revision, start_byte, end_byte);
    let selection = epi.nara_selection(selection_request.clone())?;
    let selection_ref = required_string(&selection, "/selectionRef")?;
    let grant_ref = authorize_epi_action(
        &state,
        &epi,
        EPI_EPII_REVIEW_ACTION_REF,
        &selection_ref,
        &episode_ref,
        &operation_id,
    )?;
    let reading = epi.epii_review(json!({"selection": selection_request, "mode": mode}))?;
    ensure_exact_subject(&reading, &episode_ref, revision, start_byte, end_byte)?;
    Ok(action_receipt(
        mode,
        EPI_EPII_REVIEW_ACTION_REF,
        selection_ref,
        episode_ref,
        grant_ref,
        operation_id,
        reading,
        None,
    ))
}

#[tauri::command]
pub(crate) fn epi_personal_ground(
    state: State<'_, AppState>,
    episode_ref: String,
    revision: u64,
    start_byte: usize,
    end_byte: usize,
    review_ref: Option<String>,
    operation_id: String,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchEpiPersonalAction)
        .map_err(|error| error.to_string())?;
    let epi = load_epi_required()?;
    let selection_request = selection_request(&episode_ref, revision, start_byte, end_byte);
    let selection = epi.nara_selection(selection_request.clone())?;
    let selection_ref = required_string(&selection, "/selectionRef")?;
    let grant_ref = authorize_epi_action(
        &state,
        &epi,
        EPI_ANUTTARA_GROUND_ACTION_REF,
        &selection_ref,
        &episode_ref,
        &operation_id,
    )?;
    let reading = epi.personal_ground(json!({
        "selection": selection_request,
        "reviewRef": review_ref
    }))?;
    ensure_exact_subject(&reading, &episode_ref, revision, start_byte, end_byte)?;
    Ok(action_receipt(
        "bimba-source",
        EPI_ANUTTARA_GROUND_ACTION_REF,
        selection_ref,
        episode_ref,
        grant_ref,
        operation_id,
        reading,
        None,
    ))
}

#[tauri::command]
pub(crate) fn epi_personal_proposal(
    state: State<'_, AppState>,
    episode_ref: String,
    revision: u64,
    start_byte: usize,
    end_byte: usize,
    review_ref: Option<String>,
    ground_ref: Option<String>,
    proposed_content: Option<String>,
    operation_id: String,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchEpiPersonalAction)
        .map_err(|error| error.to_string())?;
    let epi = load_epi_required()?;
    let selection_request = selection_request(&episode_ref, revision, start_byte, end_byte);
    let selection = epi.nara_selection(selection_request.clone())?;
    let selection_ref = required_string(&selection, "/selectionRef")?;
    let grant_ref = authorize_epi_action(
        &state,
        &epi,
        EPI_PERSONAL_PROPOSAL_ACTION_REF,
        &selection_ref,
        &episode_ref,
        &operation_id,
    )?;
    let reading = epi.personal_proposal(json!({
        "selection": selection_request,
        "reviewRef": review_ref,
        "groundRef": ground_ref,
        "proposedContent": proposed_content
    }))?;
    ensure_exact_subject(&reading, &episode_ref, revision, start_byte, end_byte)?;
    if reading.pointer("/sourceMutationPerformed").and_then(Value::as_bool) != Some(false)
        || reading.pointer("/sourceClass").and_then(Value::as_str) != Some("proposal")
    {
        return Err("Epi proposal violated proposal != adopted source authority".into());
    }
    let central_return = match load_central()? {
        Some(central) => match central.return_personal_proposal(&reading) {
            Ok(value) => Some(json!({"status": "returned", "data": value})),
            Err(error) => Some(json!({"status": "degraded", "error": error})),
        },
        None => None,
    };
    Ok(action_receipt(
        "proposal",
        EPI_PERSONAL_PROPOSAL_ACTION_REF,
        selection_ref,
        episode_ref,
        grant_ref,
        operation_id,
        reading,
        central_return,
    ))
}

#[tauri::command]
pub(crate) fn central_now_snapshot() -> Result<Option<Value>, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveCentralNow)
        .map_err(|error| error.to_string())?;
    let Some(central) = load_central()? else { return Ok(None); };
    Ok(Some(central.inspect_now()?))
}

#[tauri::command]
pub(crate) fn reject_personal_proposal(
    handoff_id: String,
    proposal_ref: String,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchEpiPersonalAction)
        .map_err(|error| error.to_string())?;
    load_central_required()?.reject_return(&handoff_id, &proposal_ref)
}

#[tauri::command]
pub(crate) fn recognize_personal_human_source(
    source: String,
    destination: String,
) -> Result<Value, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchEpiPersonalAction)
        .map_err(|error| error.to_string())?;
    load_central_required()?.promote_human_source(&source, &destination)
}

fn authorize_epi_action(
    state: &State<'_, AppState>,
    epi: &LocalEpiHost,
    action_ref: &str,
    selection_ref: &str,
    authority_subject_ref: &str,
    operation_id: &str,
) -> Result<String, String> {
    if operation_id.trim().is_empty() {
        return Err("Personal Action requires an opaque operation id".into());
    }
    let observation = epi.observe_personal()?;
    let action = observation
        .contribution
        .contribution
        .actions
        .iter()
        .find(|binding| binding.action_ref == action_ref)
        .cloned()
        .ok_or_else(|| format!("Epi provider did not advertise governed Action `{action_ref}`"))?;
    let binding_revision = observation
        .contribution
        .contribution
        .provenance
        .revision
        .clone()
        .ok_or_else(|| "Epi Personal Action binding requires exact source revision".to_owned())?;
    super::replace_contribution(
        state,
        EPI_PERSONAL_450_CONTRIBUTION_REF,
        observation.contribution,
    )?;
    let now = super::now_unix_ms()?;
    let mut authorities = state
        .action_authority
        .lock()
        .map_err(|_| "Action authority store lock poisoned".to_owned())?;
    let grant_ref = authorities
        .available_grant_ref(action_ref, EPI_NATIVE_OWNER, authority_subject_ref, now)
        .ok_or_else(|| {
            format!(
                "no current Epi-issued Action authority covers `{action_ref}` for Personal episode `{authority_subject_ref}`"
            )
        })?;
    let request = ActionExecutionRequest {
        operation_id: operation_id.to_owned(),
        emission: SurfaceActionEmission {
            action_ref: action_ref.into(),
            subject_ref: selection_ref.into(),
        },
        native_owner: EPI_NATIVE_OWNER.into(),
        required_capability_ref: action.required_capability_ref.clone(),
        binding_revision,
        now_unix_ms: now,
    };
    let authorised = authorities.authorize_parent_and_consume(
        &grant_ref,
        &request,
        authority_subject_ref,
    )?;
    authorize_action(&action, authorised.action_grant())?;
    Ok(authorised.grant_ref)
}

fn action_receipt(
    kind: impl Into<String>,
    action_ref: &str,
    selection_ref: String,
    episode_ref: String,
    grant_ref: String,
    operation_id: String,
    reading: Value,
    central_return: Option<Value>,
) -> Value {
    json!({
        "schema": "oi.epi-personal-action-receipt/v2",
        "kind": kind.into(),
        "actionRef": action_ref,
        "subjectRef": selection_ref,
        "authoritySubjectRef": episode_ref,
        "grantRef": grant_ref,
        "operationId": operation_id,
        "reading": reading,
        "centralReturn": central_return,
        "durableHumanSourceMutated": false
    })
}

fn load_epi_required() -> Result<LocalEpiHost, String> {
    load_epi()?.ok_or_else(|| "no Epi-owned local Personal provider is configured".into())
}

fn load_epi() -> Result<Option<LocalEpiHost>, String> {
    let Some(executable) = env::var_os("OI_EPI_BRIDGE_BIN") else { return Ok(None); };
    let mut host = LocalEpiHost::open(PathBuf::from(executable));
    if let Some(path) = env::var_os("OI_EPI_VAK_FILE") {
        host = host.with_vak_file(PathBuf::from(path));
    }
    let context = env::var_os("OI_EPI_NARA_CONTEXT_FILE");
    let vault = env::var_os("OI_EPI_NARA_VAULT_ROOT");
    match (context, vault) {
        (Some(context), Some(vault)) => {
            host = host
                .with_nara_context_file(PathBuf::from(context))
                .with_nara_vault_root(PathBuf::from(vault));
        }
        (None, None) => {}
        _ => {
            return Err(
                "Epi Personal provider requires OI_EPI_NARA_CONTEXT_FILE and OI_EPI_NARA_VAULT_ROOT together"
                    .into(),
            )
        }
    }
    Ok(Some(host))
}

fn load_central_required() -> Result<LocalCentralHost, String> {
    load_central()?.ok_or_else(|| "no Central NOW/DAY provider is configured".into())
}

fn load_central() -> Result<Option<LocalCentralHost>, String> {
    let Some(executable) = env::var_os("OI_CENTRAL_CTRL_BIN") else { return Ok(None); };
    let project = env::var("OI_CENTRAL_PROJECT")
        .map_err(|_| "OI_CENTRAL_CTRL_BIN requires OI_CENTRAL_PROJECT".to_owned())?;
    let mut host = LocalCentralHost::open(PathBuf::from(executable), project);
    if let Some(root) = env::var_os("OI_CENTRAL_ROOT") {
        host = host.with_root(PathBuf::from(root));
    }
    Ok(Some(host))
}

fn selection_request(episode_ref: &str, revision: u64, start_byte: usize, end_byte: usize) -> Value {
    json!({
        "episodeRef": episode_ref,
        "revision": revision,
        "startByte": start_byte,
        "endByte": end_byte
    })
}

fn ensure_exact_subject(
    reading: &Value,
    episode_ref: &str,
    revision: u64,
    start_byte: usize,
    end_byte: usize,
) -> Result<(), String> {
    if reading.pointer("/subject/episodeRef").and_then(Value::as_str) != Some(episode_ref)
        || reading.pointer("/subject/episodeRevision").and_then(Value::as_u64) != Some(revision)
        || reading.pointer("/subject/startByte").and_then(Value::as_u64) != Some(start_byte as u64)
        || reading.pointer("/subject/endByte").and_then(Value::as_u64) != Some(end_byte as u64)
    {
        return Err("Personal operation returned identity drift from exact episode/revision/range".into());
    }
    Ok(())
}

fn required_string(value: &Value, pointer: &str) -> Result<String, String> {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("native Personal result requires string `{pointer}`"))
}
