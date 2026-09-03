use oi_desktop_core::{
    BridgeCallClass, BridgeCaller, BridgePolicy, CentralAgentProfileClient,
};
use serde_json::Value;
use std::env;
use std::path::Path;

fn authorize(call: BridgeCallClass) -> Result<(), String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, call)
        .map_err(|error| error.to_string())
}

/// Resolve only the local adapter's already-configured Project query. This is not
/// semantic Project/World resolution: Central still validates the selected Work
/// member and ProjectCentral source when its canonical Action runs.
fn configured_project(scope: &str, project: Option<String>) -> Option<String> {
    if scope != "project" {
        return project;
    }
    project
        .filter(|value| !value.trim().is_empty())
        .or_else(|| env::var("OI_CENTRAL_PROJECT_QUERY").ok())
        .or_else(|| {
            env::var_os("OI_PROJECT_ROOT").and_then(|value| {
                Path::new(&value)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .map(str::to_owned)
            })
        })
}

/// Read Central-authored AgentProfile source relations through the canonical owner
/// Action surface. O:I does not inspect Central profile files or resolve effective
/// AIKit state here.
#[tauri::command]
pub fn agent_profile_list(scope: String, project: Option<String>) -> Result<Value, String> {
    authorize(BridgeCallClass::ObserveAgentProfile)?;
    let project = configured_project(&scope, project);
    CentralAgentProfileClient::discover().list(&scope, project.as_deref())
}

#[tauri::command]
pub fn agent_profile_read(
    scope: String,
    project: Option<String>,
    profile_ref: String,
) -> Result<Value, String> {
    authorize(BridgeCallClass::ObserveAgentProfile)?;
    let project = configured_project(&scope, project);
    CentralAgentProfileClient::discover().read(&scope, project.as_deref(), &profile_ref)
}

/// Save only the Central-owned authored source relation. The renderer supplies the
/// canonical source document and optional CAS revision; Central remains the
/// validator/persistence owner.
#[tauri::command]
pub fn agent_profile_save(
    scope: String,
    project: Option<String>,
    profile: Value,
    expected_revision: Option<String>,
) -> Result<Value, String> {
    authorize(BridgeCallClass::MutateAgentProfile)?;
    let project = configured_project(&scope, project);
    CentralAgentProfileClient::discover().save(
        &scope,
        project.as_deref(),
        profile,
        expected_revision.as_deref(),
    )
}

/// Remove only the Central AgentProfile source relation under Central's CAS
/// discipline. Agent identity, AIKit runtime state and material embodiment remain
/// outside this command by owner contract.
#[tauri::command]
pub fn agent_profile_remove(
    scope: String,
    project: Option<String>,
    profile_ref: String,
    expected_revision: String,
) -> Result<Value, String> {
    authorize(BridgeCallClass::MutateAgentProfile)?;
    let project = configured_project(&scope, project);
    CentralAgentProfileClient::discover().remove(
        &scope,
        project.as_deref(),
        &profile_ref,
        &expected_revision,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn personal_scope_does_not_acquire_project_context() {
        assert_eq!(configured_project("personal", None), None);
    }

    #[test]
    fn explicit_project_wins_over_adapter_environment() {
        assert_eq!(
            configured_project("project", Some("explicit-project".into())),
            Some("explicit-project".into())
        );
    }
}
