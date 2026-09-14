//! Native arrangement commands. The renderer owns saved view state; menus
//! disclose and dispatch the same actions without maintaining a second book.
use tauri::{menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder}, AppHandle, Emitter, Manager};

#[derive(serde::Deserialize)]
pub struct Arrangement { id: String, name: String }

#[tauri::command]
pub fn arrangement_menu(app: AppHandle, window: tauri::Window, arrangements: Vec<Arrangement>, active: String) -> Result<(), String> {
    if window.label() != "main" { return Err("Only the main arrangement host can publish workspaces".into()); }
    install(&app, &arrangements, &active).map_err(|e| e.to_string())
}

pub fn install(app: &AppHandle, arrangements: &[Arrangement], active: &str) -> tauri::Result<()> {
    #[cfg(not(target_os = "linux"))]
    let application = SubmenuBuilder::new(app, "O-I").hide().hide_others().separator().quit().build()?;
    #[cfg(target_os = "linux")]
    let application = SubmenuBuilder::new(app, "O-I")
        .text("application.show", "Show O:I").separator()
        .text("application.quit", "Quit O:I").build()?;
    let edit = SubmenuBuilder::new(app, "Edit").undo().redo().separator().cut().copy().paste().select_all().build()?;
    let browser = MenuItemBuilder::with_id("workspace.browser", "New Browser Pane").accelerator("CmdOrCtrl+Shift+L").build(app)?;
    let address = MenuItemBuilder::with_id("workspace.browser-address", "Go to Web Address…").accelerator("CmdOrCtrl+L").build(app)?;
    let fresh=MenuItemBuilder::with_id("workspace.new-tab", "New Tab").accelerator("CmdOrCtrl+T").build(app)?;
    let terminal=MenuItemBuilder::with_id("workspace.terminal", "New Terminal").accelerator("CmdOrCtrl+Shift+J").build(app)?;
    let mut workspace = SubmenuBuilder::new(app, "Workspace")
        .item(&fresh).item(&terminal).item(&browser).item(&address)
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
    let menu = MenuBuilder::new(app).items(&[&application, &edit, &workspace, &window]).build()?;
    app.set_menu(menu.clone())?;
    // Linux panel hosts consume the standard StatusNotifier/DBusMenu export.
    // Reuse the same native menu and dispatch; no second menu action model.
    // Keep the window menu as fallback if the native panel export fails.
    #[cfg(target_os = "linux")]
    if install_panel_menu(app, menu).is_ok() {
        for window in app.windows().values() { window.hide_menu()?; }
    }
    if let Some(current) = arrangements.iter().find(|w| w.id == active) {
        if let Some(window) = app.get_window("main") { window.set_title(&format!("{} — O-I", current.name))?; }
    }
    Ok(())
}

pub fn dispatch(app: &AppHandle, id: &str) {
    if id == "application.quit" { app.exit(0); return; }
    if id == "application.show" {
        if let Some(window) = app.get_window("main") {
            let _ = window.show(); let _ = window.unminimize(); let _ = window.set_focus();
        }
        return;
    }
    if id.starts_with("workspace.") || id.starts_with("surface.") || id.starts_with("region.") {
        // Arrangement actions have one resident main-window dispatcher.
        if let Some(window) = app.get_window("main") {
            let _ = window.emit("oi:arrangement-action", id);
            let _ = window.set_focus();
            if let Some(shell)=app.get_webview("main") {let _=shell.set_focus();}
        }
    }
}

#[cfg(target_os = "linux")]
fn install_panel_menu(app: &AppHandle, menu: tauri::menu::Menu<tauri::Wry>) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id("oi-workbench-menu") {
        return tray.set_menu(Some(menu));
    }
    let mut builder = tauri::tray::TrayIconBuilder::with_id("oi-workbench-menu")
        .tooltip("O:I — Workspace and Window")
        .menu(&menu);
    if let Some(icon) = app.default_window_icon() { builder = builder.icon(icon.clone()); }
    builder.build(app)?;
    Ok(())
}
