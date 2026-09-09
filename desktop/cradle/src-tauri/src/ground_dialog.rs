use tauri::{AppHandle, Window};
use tauri_plugin_dialog::DialogExt;

/// Native selection only. Recognition and binding cross the typed S seam.
#[tauri::command]
pub async fn choose_central_folder(app:AppHandle, window:Window) -> Result<Option<String>,String> {
    if window.label()!="main" {return Err("Choose Central from the main application window".into());}
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().set_title("Choose an existing Central").blocking_pick_folder()
            .map(|file|file.into_path().map_err(|e|e.to_string()).and_then(|path|path.into_os_string().into_string().map_err(|_|"Central path is not UTF-8".to_owned())))
            .transpose()
    }).await.map_err(|e|e.to_string())?
}
