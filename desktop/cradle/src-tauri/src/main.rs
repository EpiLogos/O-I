// O:I cradle — thin shell backend. Window setup, the typed kernel seam,
// and the event topic forwarding. No product logic lives here (map §4:
// src-tauri is REWRITE as "thin command/event surface over the new
// kernel"): every operation is a `KernelOp` the kernel owns, every event
// is a receipt the kernel recorded.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod windows;
mod browser;
mod terminal;
mod menus;
mod ground_dialog;
mod material_protocol;
mod walk_diagnostics;
use std::sync::Mutex;

use oi_cradle_kernel::events::{KernelEventReceipt, KERNEL_EVENT_TOPIC};
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpOutcome};
use tauri::{AppHandle, Emitter, Manager, State};

pub(crate) struct KernelHost(pub(crate) Mutex<Kernel>);

/// The one typed operation seam: apply a `KernelOp` and return its
/// outcome; every receipt the operation produced is forwarded on the
/// kernel event topic (one event per state change, exactly as the kernel
/// recorded it).
#[tauri::command]
async fn kernel_op(app: AppHandle, op: KernelOp) -> Result<KernelOpOutcome, String> {
    // Native owner reads may scan a large World. Keep them off the UI thread;
    // the kernel mutex still serialises mutations and event order.
    tauri::async_runtime::spawn_blocking(move || {
        let host = app.state::<KernelHost>();
        let (outcome, receipts) = {
            let mut kernel = host.0.lock().map_err(|_| "kernel lock unavailable")?;
            let outcome = kernel.apply(op)?;
            let receipts = outcome.receipts.clone();
            (outcome, receipts)
        };
        for receipt in receipts {
            let _ = app.emit(KERNEL_EVENT_TOPIC, &receipt);
        }
        Ok(outcome)
    }).await.map_err(|e| e.to_string())?
}

/// The ordered, observable event log, read by cursor. This is the typed
/// command the renderer bootstraps from and re-syncs through; the topic
/// event is the push that says "look again".
#[tauri::command]
fn kernel_event_log(host: State<KernelHost>, since_seq: u64) -> Vec<KernelEventReceipt> {
    let kernel = host.0.lock().expect("kernel mutex");
    kernel.event_log().since(since_seq.max(1)).to_vec()
}

fn main() {
    let mut context=tauri::generate_context!();
    // A development/native acceptance run can use an isolated persistent
    // WebKit store while exercising the real owner ground and kernel.
    #[cfg(debug_assertions)]
    if let Ok(raw)=std::env::var("OI_CRADLE_DATA_STORE_ID") {
        assert!(raw.len()==32 && raw.bytes().all(|b|b.is_ascii_hexdigit()),"OI_CRADLE_DATA_STORE_ID must be 32 hex digits");
        let mut id=[0u8;16];for (i,byte) in id.iter_mut().enumerate(){*byte=u8::from_str_radix(&raw[i*2..i*2+2],16).expect("validated hex");}
        for window in &mut context.config_mut().app.windows {window.data_store_identifier=Some(id);window.create=false;}
    }
    let builder = material_protocol::register(tauri::Builder::default());
    builder
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(windows::Windows::default());
            app.manage(browser::Browsers::default());
            app.manage(terminal::Terminals::default());
            app.manage(KernelHost(Mutex::new(Kernel::discover())));
            #[cfg(target_os="macos")]
            for config in &app.config().app.windows {
                if !config.create {
                    if let Some(id)=config.data_store_identifier {
                        tauri::WebviewWindowBuilder::from_config(app,config)?.data_store_identifier(id).build()?;
                    }
                }
            }
            menus::install(app.handle(), &[], "")?;
            Ok(())
        })
        .on_menu_event(|app, event| menus::dispatch(app, event.id().as_ref()))
        .invoke_handler(tauri::generate_handler![walk_diagnostics::expression_walk_observation,terminal::terminal_attach,terminal::terminal_poll,terminal::terminal_input,terminal::terminal_resize,terminal::terminal_checkpoint,terminal::terminal_reconcile,browser::browser_attach, browser::browser_control, browser::browser_reconcile, ground_dialog::choose_central_folder, menus::arrangement_menu, kernel_op, kernel_event_log, windows::window_detach, windows::window_binding, windows::window_redock, windows::window_focus_subject, windows::window_focus_main])
        .run(context)
        .expect("error while running the cradle");
}
