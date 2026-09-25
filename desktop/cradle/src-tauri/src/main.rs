// O:I cradle — thin shell backend. Window setup, the typed kernel seam,
// and the event topic forwarding. No product logic lives here (map §4:
// src-tauri is REWRITE as "thin command/event surface over the new
// kernel"): every operation is a `KernelOp` the kernel owns, every event
// is a receipt the kernel recorded.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod windows;
mod browser;
mod terminal;
mod working_surface_lease;
mod menus;
mod ground_dialog;
mod material_protocol;
mod app_assets;
mod walk_diagnostics;
use std::sync::Mutex;

use oi_cradle_kernel::events::{KernelEventReceipt, KERNEL_EVENT_TOPIC};
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpOutcome};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

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
        if let KernelOp::ExpressionRecovery { request } = op {
            return oi_cradle_kernel::expression_recovery::execute(request);
        }
        let host = app.state::<KernelHost>();
        let prepared = host.0.lock().map_err(|_| "kernel lock unavailable")?.prepare_owner_read(&op);
        if let Some(read) = prepared { return read.execute(); }
        let working=match &op {
            KernelOp::WorkingSurfaceRead {project,agent_session,binding}=>Some(host.0.lock().map_err(|_|"kernel lock unavailable")?.prepare_working_surface_read(project,agent_session.clone(),binding.clone(),false)?),
            KernelOp::WorkingSurfaceAttachment {project,agent_session,binding}=>Some(host.0.lock().map_err(|_|"kernel lock unavailable")?.prepare_working_surface_read(project,agent_session.clone(),Some(binding.clone()),true)?),
            _=>None,
        };
        if let Some(read)=working{return Ok(KernelOpOutcome {receipts:vec![],result:oi_cradle_kernel::KernelOpResult::WorkingSurfaceReading{document:read.execute()?}});}
        let dictation=host.0.lock().map_err(|_|"kernel lock unavailable")?.prepare_dictation(&op)?;
        if let Some(prepared)=dictation{return prepared.execute();}
        let knowledge=host.0.lock().map_err(|_|"kernel lock unavailable")?.prepare_knowledge(&op)?;
        if let Some(prepared)=knowledge{let completed=prepared.execute()?;return host.0.lock().map_err(|_|"kernel lock unavailable")?.finish_knowledge(completed);}
        let decision = host.0.lock().map_err(|_| "kernel lock unavailable")?.prepare_decision(&op)?;
        let decision_receipt = match decision { Some(prepared) => Some(prepared.execute()?), None => None };
        let (outcome, receipts) = {
            let mut kernel = host.0.lock().map_err(|_| "kernel lock unavailable")?;
            let outcome = match decision_receipt {
                Some(receipt) => kernel.finish_decision(receipt, matches!(&op, KernelOp::InvokeAction { .. }))?,
                None => kernel.apply(op)?,
            };
            let receipts = outcome.receipts.clone();
            (outcome, receipts)
        };
        for receipt in receipts {
            if let oi_cradle_kernel::events::KernelEvent::PresentationChanged { theme, .. } = &receipt.envelope.event {
                apply_native_appearance(&app, &theme.appearance);
            }
            let _ = app.emit(KERNEL_EVENT_TOPIC, &receipt);
        }
        Ok(outcome)
    }).await.map_err(|e| e.to_string())?
}

/// Native human confirmation is the only issuance door. The caller supplies
/// an opaque preflight reference, never a grant, approval flag or dialog text.
#[tauri::command]
async fn decision_episode_authorise(app: AppHandle, window: tauri::WebviewWindow, preflight_ref: String) -> Result<KernelOpOutcome, String> {
    if window.label() != "main" { return Err("Authorise a decision episode from the main desktop window".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        let host=app.state::<KernelHost>();
        let preview=host.0.lock().map_err(|_| "kernel lock unavailable")?.decision_authorisation_preview(&preflight_ref)?;
        let approved=app.dialog().message(preview.message).title("Allow this decision episode?")
            .buttons(MessageDialogButtons::OkCancelCustom("Allow this episode".into(), "Cancel".into())).blocking_show();
        if !approved {return Err("Decision episode was not authorised".into());}
        let outcome=host.0.lock().map_err(|_| "kernel lock unavailable")?.authorise_decision(&preflight_ref)?;
        for receipt in &outcome.receipts {let _=app.emit(KERNEL_EVENT_TOPIC,receipt);}
        Ok(outcome)
    }).await.map_err(|error|error.to_string())?
}

/// The ordered, observable event log, read by cursor. This is the typed
/// command the renderer bootstraps from and re-syncs through; the topic
/// event is the push that says "look again".
#[tauri::command]
async fn kernel_event_log(app: AppHandle, since_seq: u64) -> Result<Vec<KernelEventReceipt>, String> {
    // An owner read can hold this mutex for seconds. Waiting on the main
    // thread freezes WebKit and native window interaction, even though
    // kernel_op itself correctly runs on the blocking pool.
    tauri::async_runtime::spawn_blocking(move || {
        let host = app.state::<KernelHost>();
        let kernel = host.0.lock().map_err(|_| "kernel lock unavailable".to_owned())?;
        Ok(kernel.event_log().since(since_seq.max(1)).to_vec())
    }).await.map_err(|error| error.to_string())?
}

fn apply_native_appearance(app: &AppHandle, appearance: &str) {
    app.set_theme(match appearance { "light" => Some(tauri::Theme::Light), "dark" => Some(tauri::Theme::Dark), _ => None });
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
            let mut kernel = Kernel::discover();
            match kernel.apply(KernelOp::PresentationRead) {
                Ok(outcome) => if let oi_cradle_kernel::KernelOpResult::PresentationReading { document } = outcome.result {
                    apply_native_appearance(app.handle(), document["theme"]["appearance"].as_str().unwrap_or("system"));
                },
                Err(error) => eprintln!("Desktop appearance could not be restored: {error}"),
            }
            app.manage(KernelHost(Mutex::new(kernel)));
            #[cfg(unix)]
            {
                let path = oi_cradle_kernel::expression_transport::default_socket_path()?;
                if let Some(directory) = path.parent() { std::fs::create_dir_all(directory)?; }
                let handle = app.handle().clone();
                match oi_cradle_kernel::expression_transport::serve(&path, move |request| {
                    let host = handle.state::<KernelHost>();
                    let outcome = host.0.lock().map_err(|_| "kernel lock unavailable")?
                        .apply(KernelOp::Expression { request })?;
                    for receipt in &outcome.receipts { let _ = handle.emit(KERNEL_EVENT_TOPIC, receipt); }
                    serde_json::to_value(outcome).map_err(|e| e.to_string())
                }) {
                    Ok(server) => { app.manage(Mutex::new(server)); eprintln!("Expression application: {}", path.display()); }
                    Err(error) => eprintln!("Expression Agent transport unavailable: {error}"),
                }
            }

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
        .invoke_handler(tauri::generate_handler![walk_diagnostics::expression_walk_observation,working_surface_lease::working_surface_takeover,working_surface_lease::working_surface_client_poll,working_surface_lease::working_surface_client_input,working_surface_lease::working_surface_client_resize,working_surface_lease::working_surface_release,terminal::terminal_attach,terminal::terminal_poll,terminal::terminal_input,terminal::terminal_resize,terminal::terminal_checkpoint,terminal::terminal_reconcile,browser::browser_attach, browser::browser_control, browser::browser_reconcile, ground_dialog::choose_central_folder, menus::arrangement_menu, decision_episode_authorise, kernel_op, kernel_event_log, windows::window_detach, windows::window_binding, windows::window_redock, windows::window_focus_subject, windows::window_focus_main])
        .run(context)
        .expect("error while running the cradle");
}
