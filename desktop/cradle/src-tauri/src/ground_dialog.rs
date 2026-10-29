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

/// The title the system's folder chooser carries for each purpose the shell asks one for: where a new ground goes (Setup's Ground
/// step) and a folder of work to bring in (the browser's Work place, Add folder…). Any other purpose has no chooser.
fn chooser_title(purpose: &str) -> Result<&'static str, String> {
    match purpose {
        "ground" => Ok("Choose the folder your ground goes in"),
        "work" => Ok("Choose a folder of your work"),
        _ => Err(format!(
            "No folder chooser for \"{purpose}\": ground or work"
        )),
    }
}

/// Native selection only, titled by its purpose (`chooser_title`). What the folder is, and what is made of it, are its owners'
/// readings and Accepts; the selection authorizes nothing.
#[tauri::command]
pub async fn choose_folder(
    app: AppHandle,
    window: Window,
    purpose: String,
) -> Result<Option<String>, String> {
    let title = chooser_title(&purpose)?;
    if window.label() != "main" {
        return Err("Choose a folder from the main application window".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title(title)
            .blocking_pick_folder()
            .map(|file| {
                file.into_path()
                    .map_err(|e| e.to_string())
                    .and_then(|path| {
                        path.into_os_string()
                            .into_string()
                            .map_err(|_| "The folder's path is not UTF-8".to_owned())
                    })
            })
            .transpose()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::chooser_title;

    #[test]
    fn each_purpose_has_its_own_title_and_no_other_purpose_has_a_chooser() {
        assert_eq!(
            chooser_title("ground").unwrap(),
            "Choose the folder your ground goes in"
        );
        assert_eq!(
            chooser_title("work").unwrap(),
            "Choose a folder of your work"
        );
        assert!(chooser_title("anything")
            .unwrap_err()
            .contains("ground or work"));
    }
}
