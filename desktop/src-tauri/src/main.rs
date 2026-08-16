use oi_desktop_core::{
    host_native_contribution, BridgeCallClass, BridgeCaller, BridgePolicy, DesktopHost,
    HostedContribution, NativeContributionReading, SemanticRef, ShellDestination, ShellSnapshot,
};
use serde::Deserialize;
use std::sync::Mutex;
use tauri::State;

const CONTRIBUTION_FIXTURES: &str = include_str!("../../fixtures/native-contributions.json");

#[derive(Deserialize)]
struct ContributionFixtures {
    schema: String,
    contributions: Vec<NativeContributionReading>,
}

struct AppState {
    host: Mutex<DesktopHost>,
    contributions: Vec<HostedContribution>,
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
    Ok(state.contributions.clone())
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

fn main() {
    let disclosure = oi_cli::status::live_disclosure().unwrap_or_else(|error| {
        oi_cli::status::SuiteCompositionDisclosure::unavailable(error)
    });
    let contributions = load_contribution_fixtures().unwrap_or_else(|error| {
        eprintln!("O:I desktop host-reading fixtures unavailable: {error}");
        Vec::new()
    });

    tauri::Builder::default()
        .manage(AppState {
            host: Mutex::new(DesktopHost::new(disclosure)),
            contributions,
        })
        .invoke_handler(tauri::generate_handler![
            shell_snapshot,
            contribution_catalog,
            select_semantic_ref,
            open_destination
        ])
        .run(tauri::generate_context!())
        .expect("failed to run O:I desktop");
}
