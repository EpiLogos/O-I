use oi_desktop_core::{BridgeCaller, DesktopHost, SemanticRef, ShellDestination, ShellSnapshot};
use std::sync::Mutex;
use tauri::State;

struct AppState {
    host: Mutex<DesktopHost>,
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

fn main() {
    let disclosure = oi_cli::status::live_disclosure().unwrap_or_else(|error| {
        oi_cli::status::SuiteCompositionDisclosure::unavailable(error)
    });

    tauri::Builder::default()
        .manage(AppState {
            host: Mutex::new(DesktopHost::new(disclosure)),
        })
        .invoke_handler(tauri::generate_handler![
            shell_snapshot,
            select_semantic_ref,
            open_destination
        ])
        .run(tauri::generate_context!())
        .expect("failed to run O:I desktop");
}
