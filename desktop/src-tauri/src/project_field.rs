use std::env;
use std::path::PathBuf;
use std::sync::Mutex;

use oi_desktop_core::{
    BridgeCallClass, BridgeCaller, BridgePolicy, LocalProjectField, ProjectFieldSnapshot,
};
use serde_json::Value;
use tauri::State;

pub struct ProjectFieldState {
    field: Mutex<Option<LocalProjectField>>,
}

impl ProjectFieldState {
    pub fn load() -> Self {
        let field = load_project_field()
            .map_err(|error| eprintln!("O:I Project field unavailable: {error}"))
            .ok()
            .flatten();
        Self {
            field: Mutex::new(field),
        }
    }
}

fn load_project_field() -> Result<Option<LocalProjectField>, String> {
    let Some(project_root) = env::var_os("OI_PROJECT_ROOT") else {
        return Ok(None);
    };
    let central_root = env::var_os("OI_CENTRAL_ROOT").map(PathBuf::from);
    let project_map = env::var_os("OI_AIKIT_PROJECT_MAP").map(PathBuf::from);
    LocalProjectField::discover(
        PathBuf::from(project_root),
        central_root.as_deref(),
        project_map.as_deref(),
    )
    .map(Some)
}

fn authorize(call: BridgeCallClass) -> Result<(), String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, call)
        .map_err(|error| error.to_string())
}

fn with_field<T>(
    state: &State<'_, ProjectFieldState>,
    operation: impl FnOnce(&LocalProjectField) -> Result<T, String>,
) -> Result<T, String> {
    let field = state
        .field
        .lock()
        .map_err(|_| "Project field lock poisoned".to_owned())?;
    operation(
        field
            .as_ref()
            .ok_or_else(|| "no native Project field is configured".to_owned())?,
    )
}

fn with_field_mut<T>(
    state: &State<'_, ProjectFieldState>,
    operation: impl FnOnce(&mut LocalProjectField) -> Result<T, String>,
) -> Result<T, String> {
    let mut field = state
        .field
        .lock()
        .map_err(|_| "Project field lock poisoned".to_owned())?;
    operation(
        field
            .as_mut()
            .ok_or_else(|| "no native Project field is configured".to_owned())?,
    )
}

#[tauri::command]
pub fn project_field_snapshot(
    state: State<'_, ProjectFieldState>,
) -> Result<ProjectFieldSnapshot, String> {
    authorize(BridgeCallClass::ObserveProjectField)?;
    with_field(&state, LocalProjectField::snapshot)
}

#[tauri::command]
pub fn project_source_search(
    state: State<'_, ProjectFieldState>,
    query: String,
) -> Result<Value, String> {
    authorize(BridgeCallClass::ObserveProjectField)?;
    with_field(&state, |field| {
        serde_json::to_value(field.search_sources(&query)).map_err(|error| error.to_string())
    })
}

#[tauri::command]
pub fn project_source_read(
    state: State<'_, ProjectFieldState>,
    resource_ref: String,
) -> Result<Value, String> {
    authorize(BridgeCallClass::RetrieveProjectSource)?;
    with_field_mut(&state, |field| {
        serde_json::to_value(field.read_source(&resource_ref)?)
            .map_err(|error| error.to_string())
    })
}

#[tauri::command]
pub fn project_source_explain(
    state: State<'_, ProjectFieldState>,
    resource_ref: String,
) -> Result<Value, String> {
    authorize(BridgeCallClass::ObserveProjectField)?;
    with_field(&state, |field| field.explain_source(&resource_ref))
}

#[tauri::command]
pub fn project_reflection(
    state: State<'_, ProjectFieldState>,
    resource_ref: String,
) -> Result<Value, String> {
    authorize(BridgeCallClass::ObserveProjectReflection)?;
    with_field(&state, |field| {
        serde_json::to_value(field.reflection(&resource_ref)?)
            .map_err(|error| error.to_string())
    })
}

#[tauri::command]
pub fn project_owner_action(
    state: State<'_, ProjectFieldState>,
    action: String,
    input: Value,
) -> Result<Value, String> {
    authorize(BridgeCallClass::InvokeProjectOwnerAction)?;
    with_field(&state, |field| field.invoke_central_action(&action, input))
}
