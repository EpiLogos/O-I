// Enumerating commands makes application IPC opt-in through webview capabilities.
fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "live_shell_read", "live_shell_config", "live_shell_checkpoint_reply", "live_shell_request_close", "live_shell_continuity_pending", "live_shell_continuity_confirm", "live_shell_book_read", "live_shell_book_write",
            "expression_walk_observation", "terminal_attach","terminal_poll","terminal_input","terminal_resize","terminal_checkpoint","terminal_reconcile", "browser_attach", "browser_control", "browser_reconcile", "choose_central_folder", "choose_folder", "arrangement_menu", "kernel_op", "kernel_event_log",
            "window_detach", "window_binding", "window_redock", "window_redock_surface", "window_focus_subject", "window_focus_main",
            "working_surface_takeover", "working_surface_client_poll", "working_surface_client_input", "working_surface_client_resize", "working_surface_release", "decision_episode_authorise",
        ]),
    )).expect("build the scoped cradle command manifest");
}
