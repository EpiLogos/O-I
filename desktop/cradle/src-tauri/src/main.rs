// O:I cradle — thin shell backend. Window setup, the typed kernel seam,
// and the event topic forwarding. No product logic lives here (map §4:
// src-tauri is REWRITE as "thin command/event surface over the new
// kernel"): every operation is a `KernelOp` the kernel owns, every event
// is a receipt the kernel recorded.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use oi_cradle_kernel::events::{KernelEventReceipt, KERNEL_EVENT_TOPIC};
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpOutcome};
use tauri::{AppHandle, Emitter, Manager, State};

struct KernelHost(Mutex<Kernel>);

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
    tauri::Builder::default()
        .setup(|app| {
            app.manage(KernelHost(Mutex::new(Kernel::discover())));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![kernel_op, kernel_event_log])
        .run(tauri::generate_context!())
        .expect("error while running the cradle");
}
