// O:I cradle — thin shell backend. Window setup only; no product logic.
// Kernel seams, events, and owners arrive with U0.4+ and are never faked here.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the cradle");
}
