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
mod native_shell;
mod walk_diagnostics;
mod midi;
mod downloads;
use std::sync::Mutex;

use oi_cradle_kernel::events::{KernelEventReplay, KERNEL_EVENT_TOPIC};
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpOutcome};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

pub(crate) struct KernelHost(pub(crate) Mutex<Kernel>);
#[cfg(unix)]
struct NativeOwnerServer {
    _server: Mutex<oi_cradle_kernel::expression_transport::Server>,
}

/// The one typed operation seam: apply a `KernelOp` and return its
/// outcome; every receipt the operation produced is forwarded on the
/// kernel event topic (one event per state change, exactly as the kernel
/// recorded it).
#[tauri::command]
async fn kernel_op(app: AppHandle, op: KernelOp) -> Result<KernelOpOutcome, String> {
    // Native owner reads may scan a large World. Keep them off the UI thread;
    // the kernel mutex still serialises mutations and event order. The one
    // dispatch the walk-bridge also calls (kernel dispatch.rs): owner work
    // runs outside the kernel lock wherever the op has a prepared form.
    tauri::async_runtime::spawn_blocking(move || {
        let host = app.state::<KernelHost>();
        // One timing line per op, in the dev bridge's format, to the file
        // OI_KERNEL_TRACE_FILE names (a Finder launch has no stderr).
        let name = oi_cradle_kernel::dispatch::op_name(&op);
        let started = std::time::Instant::now();
        let (result, timing) = oi_cradle_kernel::dispatch::dispatch(&host.0, op);
        oi_cradle_kernel::dispatch::trace_op("native", &name, result.is_ok(), started.elapsed(), &timing);
        let outcome = result?;
        for receipt in &outcome.receipts {
            if let oi_cradle_kernel::events::KernelEvent::PresentationChanged { theme, .. } = &receipt.envelope.event {
                apply_native_appearance(&app, &theme.appearance);
            }
            let _ = app.emit(KERNEL_EVENT_TOPIC, receipt);
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
async fn kernel_event_log(app: AppHandle, cursor: u64, generation: Option<String>, limit: usize) -> Result<KernelEventReplay, String> {
    // An owner read can hold this mutex for seconds. Waiting on the main
    // thread freezes WebKit and native window interaction, even though
    // kernel_op itself correctly runs on the blocking pool.
    tauri::async_runtime::spawn_blocking(move || {
        let host = app.state::<KernelHost>();
        let asked = std::time::Instant::now();
        let kernel = host.0.lock().map_err(|_| "kernel lock unavailable".to_owned())?;
        let waited = asked.elapsed();
        let replay = kernel.event_log().replay(generation.as_deref(), cursor, limit);
        drop(kernel);
        oi_cradle_kernel::dispatch::trace_replay("native", waited);
        Ok(replay)
    }).await.map_err(|error| error.to_string())?
}

fn apply_native_appearance(app: &AppHandle, appearance: &str) {
    app.set_theme(match appearance { "light" => Some(tauri::Theme::Light), "dark" => Some(tauri::Theme::Dark), _ => None });
}

fn main() {
    #[cfg(feature = "native_shell")]
    if let Err(error)=native_shell::prepare() {
        eprintln!("Native shell candidate bootstrap refused: {error}");
        std::process::exit(2);
    }
    // A Finder/Dock launch inherits launchd's minimal PATH, which never holds
    // the managed activation directory. Pin the suite executable once, before
    // any thread exists, so every kernel `oi` caller resolves the same one.
    if std::env::var_os("OI_BIN").is_none_or(|value| value.is_empty()) {
        let oi = oi_cradle_kernel::native_expression::oi_executable();
        if oi.is_absolute() {
            std::env::set_var("OI_BIN", oi);
        }
    }
    let mut context=tauri::generate_context!();
    // The pinned config token generator emits Vec for this array field.
    // Use the same native runtime hook as isolated WebKit acceptance, with
    // the candidate's stable identity inherited by its detached windows.
    #[cfg(feature = "native_shell")]
    for window in &mut context.config_mut().app.windows {
        window.data_store_identifier=Some([79,73,83,72,69,76,76,67,65,78,68,73,68,65,84,69]);
    }
    // Every window the config would create is built in setup instead, from
    // the same config through the same `from_config` Tauri's own auto-create
    // uses, so it carries the download receiver (wry cancels a download when
    // a webview has none: every export vanished). Its WebKit store is the one
    // auto-create gave it: the pinned `from_config` does not apply the
    // config's identifier, so only a store applied before (the isolated run
    // below) is applied here — the main window keeps the store its workspace
    // book lives in.
    #[cfg_attr(not(debug_assertions), allow(unused_mut))]
    let mut seated: Vec<(String, Option<[u8; 16]>)> = context
        .config_mut()
        .app
        .windows
        .iter_mut()
        .filter(|window| window.create)
        .map(|window| {
            window.create = false;
            (window.label.clone(), None)
        })
        .collect();
    // A development/native acceptance run can use an isolated persistent
    // WebKit store while exercising the real owner ground and kernel.
    #[cfg(debug_assertions)]
    if let Ok(raw)=std::env::var("OI_CRADLE_DATA_STORE_ID") {
        assert!(raw.len()==32 && raw.bytes().all(|b|b.is_ascii_hexdigit()),"OI_CRADLE_DATA_STORE_ID must be 32 hex digits");
        let mut id=[0u8;16];for (i,byte) in id.iter_mut().enumerate(){*byte=u8::from_str_radix(&raw[i*2..i*2+2],16).expect("validated hex");}
        for window in &mut context.config_mut().app.windows {window.data_store_identifier=Some(id);window.create=false;}
        seated = context
            .config()
            .app
            .windows
            .iter()
            .map(|window| (window.label.clone(), Some(id)))
            .collect();
    }
    let builder = material_protocol::register(tauri::Builder::default());
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            app.manage(windows::Windows::default());
            #[cfg(feature = "native_shell")]
            app.manage(native_shell::ApplicationClose::default());
            app.manage(browser::Browsers::default());
            app.manage(terminal::Terminals::default());
            // An installed desktop carries its own SharedField client (the
            // `shared-field/` resource); a development build without it falls
            // back to the checkout inside the kernel.
            if let Ok(resources) = app.path().resource_dir() {
                oi_cradle_kernel::shared_field::bind_bundled_client_home(resources.join("shared-field"));
            }
            let mut kernel = Kernel::discover();
            // Expressive acts survive restart ($OI_HOME/desktop/expression-acts).
            #[cfg(feature = "native_shell")]
            let act_store=native_shell::attach_act_store(&mut kernel);
            #[cfg(not(feature = "native_shell"))]
            let act_store=kernel.attach_default_act_store();
            if let Err(error) = act_store {
                eprintln!("Expressive act store unavailable; acts stay in memory: {error}");
            }
            match kernel.apply(KernelOp::PresentationRead) {
                Ok(outcome) => if let oi_cradle_kernel::KernelOpResult::PresentationReading { document } = outcome.result {
                    apply_native_appearance(app.handle(), document["theme"]["appearance"].as_str().unwrap_or("system"));
                },
                Err(error) => eprintln!("Desktop appearance could not be restored: {error}"),
            }
            app.manage(KernelHost(Mutex::new(kernel)));
            #[cfg(unix)]
            if let Some((socket, owner)) =
                oi_cradle_kernel::native_owner_transport::configured_offer()?
            {
                let handle = app.handle().clone();
                let server = oi_cradle_kernel::expression_transport::serve_native_owner(
                    &socket,
                    move |request| {
                        let host = handle.state::<KernelHost>();
                        let value = owner.apply(
                            &mut *host
                                .0
                                .lock()
                                .map_err(|_| "native kernel lock unavailable")?,
                            request,
                        )?;
                        if let Some(receipts) = value["outcome"]["receipts"].as_array() {
                            for receipt in receipts {
                                let _ = handle.emit(KERNEL_EVENT_TOPIC, receipt);
                            }
                        }
                        Ok(value)
                    },
                )?;
                app.manage(NativeOwnerServer {
                    _server: Mutex::new(server),
                });
            }
            #[cfg(unix)]
            {
                let path = oi_cradle_kernel::expression_transport::default_socket_path()?;
                if let Some(directory) = path.parent() { std::fs::create_dir_all(directory)?; }
                let handle = app.handle().clone();
                match oi_cradle_kernel::expression_transport::serve_routed(&path, move |request| {
                    let host = handle.state::<KernelHost>();
                    // A body whose schema is oi.expression-world/v1 reaches the
                    // world seam (acts, material, selection); others are
                    // ordinary Expression requests.
                    let op = match request {
                        oi_cradle_kernel::expression_transport::Request::Expression(request) => KernelOp::Expression { request },
                        oi_cradle_kernel::expression_transport::Request::World(request) => KernelOp::ExpressionWorld { request },
                    };
                    let outcome = host.0.lock().map_err(|_| "kernel lock unavailable")?.apply(op)?;
                    for receipt in &outcome.receipts { let _ = handle.emit(KERNEL_EVENT_TOPIC, receipt); }
                    serde_json::to_value(outcome).map_err(|e| e.to_string())
                }) {
                    Ok(server) => { app.manage(Mutex::new(server)); eprintln!("Expression application: {}", path.display()); }
                    Err(error) => eprintln!("Expression Agent transport unavailable: {error}"),
                }
            }

            // The windows main() took from auto-create: each built from its own config, with the download receiver.
            for (label, store) in &seated {
                let Some(config) = app.config().app.windows.iter().find(|window| &window.label == label).cloned() else {
                    continue;
                };
                let builder = tauri::WebviewWindowBuilder::from_config(app, &config)?;
                #[cfg(target_os = "macos")]
                let builder = match store {
                    Some(id) => builder.data_store_identifier(*id),
                    None => builder,
                };
                #[cfg(not(target_os = "macos"))]
                let _ = store;
                builder.on_download(downloads::receiver()).build()?;
            }
            midi::start(app.handle());
            menus::install(app.handle(), &[], "")?;
            Ok(())
        })
        .on_menu_event(|app, event| menus::dispatch(app, event.id().as_ref()))
        .invoke_handler(tauri::generate_handler![native_shell::live_shell_read,native_shell::live_shell_config,native_shell::live_shell_checkpoint_reply,native_shell::live_shell_request_close,native_shell::live_shell_continuity_pending,native_shell::live_shell_continuity_confirm,walk_diagnostics::expression_walk_observation,working_surface_lease::working_surface_takeover,working_surface_lease::working_surface_client_poll,working_surface_lease::working_surface_client_input,working_surface_lease::working_surface_client_resize,working_surface_lease::working_surface_release,terminal::terminal_attach,terminal::terminal_poll,terminal::terminal_input,terminal::terminal_resize,terminal::terminal_checkpoint,terminal::terminal_reconcile,browser::browser_attach, browser::browser_control, browser::browser_reconcile, ground_dialog::choose_central_folder, menus::arrangement_menu, decision_episode_authorise, kernel_op, kernel_event_log, windows::window_detach, windows::window_binding, windows::window_redock, windows::window_redock_surface, windows::window_focus_subject, windows::window_focus_main])
        .build(context)
        .expect("error while building the cradle")
        .run(|app,event| {
            #[cfg(feature = "native_shell")]
            match event {
                tauri::RunEvent::WindowEvent {label,event:tauri::WindowEvent::CloseRequested {api,..},..} if label=="main" => {
                    api.prevent_close();
                    if let Err(error)=native_shell::request_close(app,0,false){native_shell::report_close_failure(app,error);}
                }
                tauri::RunEvent::ExitRequested {code,api,..} if !native_shell::close_approved(app,code) => {
                    // Pinned Tauri cannot prevent its direct restart API;
                    // candidate Restart calls request_close before using it.
                    api.prevent_exit();
                    if code!=Some(tauri::RESTART_EXIT_CODE) {
                        if let Err(error)=native_shell::request_close(app,code.unwrap_or(0),false){native_shell::report_close_failure(app,error);}
                    }
                }
                _=>{}
            }
            #[cfg(not(feature = "native_shell"))]
            let _=(app,event);
        });
}
