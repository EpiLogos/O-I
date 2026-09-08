//! Native arrangement commands. The renderer owns saved view state; menus
//! disclose and dispatch the same actions without maintaining a second book.
use tauri::{menu::{MenuBuilder, SubmenuBuilder}, AppHandle, Emitter, Manager};

#[derive(serde::Deserialize)]
pub struct Arrangement { id: String, name: String }

#[tauri::command]
pub fn arrangement_menu(app: AppHandle, window: tauri::WebviewWindow, arrangements: Vec<Arrangement>, active: String) -> Result<(), String> {
    if window.label() != "main" { return Err("Only the main arrangement host can publish workspaces".into()); }
    install(&app, &arrangements, &active).map_err(|e| e.to_string())
}

pub fn install(app: &AppHandle, arrangements: &[Arrangement], active: &str) -> tauri::Result<()> {
    let application = SubmenuBuilder::new(app, "O-I").hide().hide_others().separator().quit().build()?;
    let edit = SubmenuBuilder::new(app, "Edit").undo().redo().separator().cut().copy().paste().select_all().build()?;
    let mut workspace = SubmenuBuilder::new(app, "Workspace")
        .text("workspace.create", "New Workspace…")
        .text("workspace.rename", "Rename Workspace…")
        .text("workspace.recover", "Recover Saved Arrangement…").separator();
    for arrangement in arrangements {
        let label = if arrangement.id == active { format!("✓ {}", arrangement.name) } else { arrangement.name.clone() };
        workspace = workspace.text(format!("workspace.activate:{}", arrangement.id), label);
    }
    let workspace = workspace.build()?;
    let window = SubmenuBuilder::new(app, "Window")
        .minimize().maximize().separator()
        .text("surface.split-right", "Split Active Surface Right")
        .text("surface.split-down", "Split Active Surface Down")
        .text("surface.tile", "Tile All Surfaces")
        .text("surface.maximize", "Maximize / Restore Pane")
        .text("surface.detach", "Detach Active Surface")
        .separator().text("region.left", "Show / Hide Central")
        .text("region.right", "Show / Hide Agent").build()?;
    app.set_menu(MenuBuilder::new(app).items(&[&application, &edit, &workspace, &window]).build()?)?;
    if let Some(current) = arrangements.iter().find(|w| w.id == active) {
        if let Some(window) = app.get_webview_window("main") { window.set_title(&format!("{} — O-I", current.name))?; }
    }
    Ok(())
}

pub fn dispatch(app: &AppHandle, id: &str) {
    if id.starts_with("workspace.") || id.starts_with("surface.") || id.starts_with("region.") {
        // Arrangement actions have one resident main-window dispatcher.
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit("oi:arrangement-action", id);
            let _ = window.set_focus();
        }
    }
}
