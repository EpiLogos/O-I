//! Native arrangement commands. The renderer owns saved view state; menus
//! disclose and dispatch the same actions without maintaining a second book.
//! Every command has one home here (manual §10.9): Edit acts on the selection,
//! Create inserts, View shows and hides the window's parts on Live's keys, and
//! Settings… stands in the application menu on ⌘, as Live's Preferences do.
//! File's Export and View's Present are the field's in Expressions (manual
//! §20.1 "Where everything is", O-I #747): the frame hands each to the mode
//! that stands (App.tsx MENU_ACT), and Expressions runs the field's own act.
//! Their ids reach the renderer as `oi:command` (live-shell App.tsx routes them).
use tauri::{menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder}, AppHandle, Emitter, Manager};

#[derive(serde::Deserialize)]
pub struct Arrangement { id: String, name: String }

#[tauri::command]
pub fn arrangement_menu(app: AppHandle, window: tauri::Window, arrangements: Vec<Arrangement>, active: String) -> Result<(), String> {
    if window.label() != "main" { return Err("Only the main arrangement host can publish workspaces".into()); }
    install(&app, &arrangements, &active).map_err(|e| e.to_string())
}

pub fn install(app: &AppHandle, arrangements: &[Arrangement], active: &str) -> tauri::Result<()> {
    let item = |id: &str, label: &str, keys: Option<&str>| {
        let built = MenuItemBuilder::with_id(id, label);
        match keys { Some(keys) => built.accelerator(keys).build(app), None => built.build(app) }
    };
    let settings = item("app.settings", "Settings…", Some("CmdOrCtrl+,"))?;
    let application = SubmenuBuilder::new(app, "O-I").item(&settings).separator();
    // The world the DLW stands on is a folder you choose (O-I #738): Yours, a world opened before, or another folder.
    #[cfg(feature = "native_shell")]
    let application = {
        let mut worlds = SubmenuBuilder::new(app, "Worlds");
        for world in crate::native_shell::worlds() {
            let (Some(name), Some(folder)) = (world["name"].as_str(), world["folder"].as_str())
            else {
                continue;
            };
            let label = if world["open"] == true {
                format!("✓ {name}")
            } else {
                name.to_owned()
            };
            worlds = worlds.text(format!("world.open:{folder}"), label);
        }
        application
            .item(
                &worlds
                    .separator()
                    .text("world.choose", "Open World…")
                    .build()?,
            )
            .separator()
    };
    let application = application
        .hide()
        .hide_others()
        .separator()
        .quit()
        .build()?;
    // Undo and Redo are the shell's: its undo list, or the text field's own while one holds the focus. Cut, Copy, Paste and Select
    // All stay the text system's.
    let undo = item("edit.undo", "Undo", Some("CmdOrCtrl+Z"))?;
    let redo = item("edit.redo", "Redo", Some("CmdOrCtrl+Shift+Z"))?;
    let duplicate = item("edit.duplicate", "Duplicate", Some("CmdOrCtrl+D"))?;
    let rename = item("edit.rename", "Rename", Some("CmdOrCtrl+R"))?;
    let delete = item("edit.delete", "Delete", None)?;
    let edit = SubmenuBuilder::new(app, "Edit").item(&undo).item(&redo).separator().cut().copy().paste()
        .item(&duplicate).item(&delete).separator().item(&rename).separator().select_all().build()?;
    let insert_clip = item("create.clip", "Insert Clip", Some("CmdOrCtrl+Shift+M"))?;
    let insert_row = item("create.row", "Insert Row", Some("CmdOrCtrl+I"))?;
    let create = SubmenuBuilder::new(app, "Create").item(&insert_clip).item(&insert_row).build()?;
    // Export, in the File menu (manual §20.1 Export): a picture (with its choices), a film, or the Expression itself.
    let export = SubmenuBuilder::new(app, "Export")
        .item(&item("file.export.picture", "Picture…", None)?)
        .item(&item("file.export.film", "Film", None)?)
        .separator()
        .item(&item("file.export.json", "Expression JSON", None)?)
        .item(&item("file.export.html", "Living HTML", None)?)
        .item(&item("file.export.native", "Native Configuration", None)?)
        .build()?;
    let file = SubmenuBuilder::new(app, "File").item(&export).build()?;
    let view = SubmenuBuilder::new(app, "View")
        .item(&item("view.session", "Session View", None)?)
        .item(&item("view.arrangement", "Arrangement View", None)?)
        .item(&item("view.pane", "Pane View", Some("Alt+CmdOrCtrl+9"))?)
        .separator()
        .item(&item("view.browser", "Browser", Some("Alt+CmdOrCtrl+B"))?)
        .item(&item("view.pool", "Pool", Some("Alt+CmdOrCtrl+6"))?)
        .item(&item("view.rail", "Widget Rail", Some("Alt+CmdOrCtrl+8"))?)
        .separator()
        .item(&item("view.clip", "Clip View", Some("Alt+CmdOrCtrl+3"))?)
        .item(&item("view.device", "Device View", Some("Alt+CmdOrCtrl+4"))?)
        .item(&item("view.detail", "Hide or Restore Clip and Device Views", Some("Alt+CmdOrCtrl+L"))?)
        .item(&item("view.expand-clip", "Expand Clip View", Some("Alt+CmdOrCtrl+E"))?)
        .separator()
        .item(&item("view.mixer", "Mixer", Some("Alt+CmdOrCtrl+M"))?)
        .item(&item("view.io", "In/Out", Some("Alt+CmdOrCtrl+I"))?)
        .separator()
        // Present gives the field the whole screen; Esc brings the window back (manual §20.1 Pane view).
        .item(&item("view.present", "Present", None)?)
        // The field's grid, snapping and guides (O-I #747, lead's ruling of 29 Oct: the Stage plate's last view controls).
        .item(&item("view.grid", "Grid", None)?)
        .item(&item("view.snap", "Snap", None)?)
        .item(&item("view.guides", "Guides", None)?)
        // The field's camera (manual §20.1: "Turn the field to 2D or 3D, or face its plane — The View menu, beside Grid, Snap and Guides").
        .item(&item("view.flat", "2D", None)?)
        .item(&item("view.depth", "3D", None)?)
        .item(&item("view.face-plane", "Face Plane", None)?)
        .separator()
        .fullscreen()
        .build()?;
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
        .text("region.right", "Show / Hide Agent");
    let window=window.build()?;
    app.set_menu(MenuBuilder::new(app).items(&[&application, &file, &edit, &create, &view, &workspace, &window]).build()?)?;
    if let Some(current) = arrangements.iter().find(|w| w.id == active) {
        if let Some(window) = app.get_window("main") { window.set_title(&format!("{} — O-I", current.name))?; }
    }
    Ok(())
}

/// Whether a menu item is one of the shell's commands (File, Edit, Create, View, Settings), routed as `oi:command`.
pub fn is_command(id: &str) -> bool {
    ["edit.", "create.", "view.", "file.", "app."]
        .iter()
        .any(|prefix| id.starts_with(prefix))
}

pub fn dispatch(app: &AppHandle, id: &str) {
    #[cfg(feature = "native_shell")]
    if id.starts_with("world.") {
        crate::native_shell::world_menu(app, id);
        return;
    }
    if is_command(id) {
        // The shell's commands go to the main window's frame, which routes each to the view that stands.
        if let Some(window) = app.get_window("main") { let _ = window.emit("oi:command", id); }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn present_grid_snap_guides_and_export_reach_the_renderer_as_commands() {
        for id in [
            "view.present",
            "view.grid",
            "view.snap",
            "view.guides",
            "view.flat",
            "view.depth",
            "view.face-plane",
            "file.export.picture",
            "file.export.film",
            "file.export.json",
            "file.export.html",
            "file.export.native",
        ] {
            assert!(is_command(id), "{id} is routed as oi:command");
        }
        assert!(!is_command("workspace.browser"));
        assert!(!is_command("world.choose"));
    }
}
