// Enumerating commands makes application IPC opt-in through webview capabilities.
fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "choose_central_folder", "arrangement_menu", "kernel_op", "kernel_event_log",
            "window_detach", "window_binding", "window_redock", "window_focus_subject", "window_focus_main",
        ]),
    )).expect("build the scoped cradle command manifest");
}
