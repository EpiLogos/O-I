// O:I cradle — thin shell backend. Window setup, the typed kernel seam,
// and the event topic forwarding. No product logic lives here (map §4:
// src-tauri is REWRITE as "thin command/event surface over the new
// kernel"): every operation is a `KernelOp` the kernel owns, every event
// is a receipt the kernel recorded.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_assets;
mod browser;
mod downloads;
mod ground_dialog;
mod live_engine_host;
mod material_protocol;
mod menus;
mod midi;
mod native_shell;
mod terminal;
#[cfg(feature = "k8")]
mod torus_native;
mod walk_diagnostics;
mod windows;
mod working_surface_lease;
#[cfg(feature = "native_shell")]
mod world_folder;
use std::sync::Mutex;

use oi_cradle_kernel::events::{KernelEventReplay, KERNEL_EVENT_TOPIC};
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpOutcome};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

/// The kernel behind its lock, and the live field's own handle beside it
/// (kernel dispatch.rs `dispatch_with`): a field op never waits on the
/// kernel lock.
pub(crate) struct KernelHost(
    pub(crate) Mutex<Kernel>,
    pub(crate) oi_cradle_kernel::native_expression::Field,
);
#[cfg(unix)]
struct NativeOwnerServer {
    _server: Mutex<oi_cradle_kernel::expression_transport::Server>,
}

/// The one typed operation seam: apply a `KernelOp` and return its
/// outcome; every receipt the operation produced is forwarded on the
/// kernel event topic (one event per state change, exactly as the kernel
/// recorded it).
#[tauri::command]
async fn kernel_op(
    app: AppHandle,
    webview: tauri::Webview,
    op: KernelOp,
) -> Result<KernelOpOutcome, String> {
    run_kernel_op(app, webview, op).await
}

/// The shell window's own press channel (O-I #747 round 895, DLW build ruling 2026-11-09, 0b.2 and its addition; named for what it is in
/// round 896, 0R-authority.3 and .4): what the shell's own code sends of the person's acts — a Delete, a trigger's press, an Action it
/// invokes, a document's write, a Day's ensure, make or close, a page's Launch, Stop or Delete. The kernel runs a person act on the
/// person's token by this way alone (`oi_cradle_kernel::person_press`): not by `kernel_op`, which the frame's relay and every ordinary
/// read and edit use, nor by the agents' socket, nor by the walk bridge. Only a shell window's webview is answered (`press_window`);
/// the frame inside it cannot be told apart by Tauri, and its own origin is its guard (COMMENTS, 0R-authority.2). Any other op is
/// refused. It shares `kernel_op`'s one body.
#[tauri::command]
async fn kernel_press(
    app: AppHandle,
    webview: tauri::Webview,
    op: KernelOp,
) -> Result<KernelOpOutcome, String> {
    press_window(webview.label())?;
    let op = oi_cradle_kernel::person_press(op)?;
    run_kernel_op(app, webview, op).await
}

/// The bundled shell's own origin (O-I #747 round 896, 1R-authority.1, F1): `tauri://localhost`, or its Windows and Android form
/// `http(s)://tauri.localhost`, and in a debug build the dev server it loads (tauri.conf.json `devUrl`). Never the material host
/// (`oi-material://…`, whose pages Tauri also counts as the app's own), never a remote page.
fn shell_origin(url: &tauri::Url, dev: Option<&tauri::Url>) -> bool {
    let bundled = url.port().is_none()
        && ((url.scheme() == "tauri" && url.host_str() == Some("localhost"))
            || (matches!(url.scheme(), "http" | "https")
                && url.host_str() == Some("tauri.localhost")));
    bundled
        || dev.is_some_and(|dev| {
            matches!(url.scheme(), "http" | "https") && url.origin() == dev.origin()
        })
}

/// What the kernel's two commands require of the page that asks (1R-authority.1, F1): the window shows the bundled shell. A document of
/// another origin standing as the window's page (the frame navigated the window to it, should its sandbox and the navigation guard both
/// fail) asks nothing, read or press: Tauri admits a page of a protocol this host registers as its own, so the address is read here.
fn shell_document(url: &tauri::Url, dev: Option<&tauri::Url>) -> Result<(), String> {
    if shell_origin(url, dev) {
        return Ok(());
    }
    let shown = match url.host_str() {
        Some(host) => format!("{}://{host}", url.scheme()),
        None => format!("{}:", url.scheme()),
    };
    Err(format!(
        "The kernel answers only the shell's own page, and this window shows another ({shown}): nothing was run."
    ))
}

/// The dev server a debug build loads; none in a release build, which loads only the bundled shell.
fn dev_server<R: tauri::Runtime>(app: &AppHandle<R>) -> Option<tauri::Url> {
    if cfg!(debug_assertions) {
        app.config().build.dev_url.clone()
    } else {
        None
    }
}

/// The navigation guard of a shell window (1R-authority.1, F1). On macOS wry asks it for every navigation in the window, a frame's as
/// well as the page's, and names no frame, so it cannot tell the shell's own navigation from a frame's: it refuses what no document of
/// the shell's loads (`file:`, `javascript:`, and every scheme this host does not serve), and the shell's frames keep theirs
/// (`oi-material:`, http(s), `about:`, `blob:`, `data:`). A frame's navigation of the window itself is stopped by the frame's sandbox
/// (no `allow-top-navigation`), and a page that stood there anyway is answered nothing (`shell_document`).
pub(crate) fn shell_navigation(url: &tauri::Url) -> bool {
    matches!(
        url.scheme(),
        "tauri" | "oi-material" | "http" | "https" | "about" | "blob" | "data"
    )
}

/// The webviews whose press the host takes (0R-authority.3): the shell's own windows, `main` and its detached `surface-N` windows,
/// which load the bundled shell (windows.rs). The capability grants `kernel_press` to these alone (capabilities/main-window.json, pinned
/// by tests/conformance/renderer-authority.test.mjs); this refuses any other label in words, should a capability ever widen.
fn press_window(label: &str) -> Result<(), String> {
    let surface = label
        .strip_prefix("surface-")
        .is_some_and(|rest| !rest.is_empty());
    if label == "main" || surface {
        Ok(())
    } else {
        Err(format!(
            "The person's press is taken only from a shell window, and this request came from another ({label}): nothing was run."
        ))
    }
}

/// The one body of `kernel_op` and `kernel_press`, so a fix to one reaches both (0R-authority.3).
async fn run_kernel_op(
    app: AppHandle,
    webview: tauri::Webview,
    mut op: KernelOp,
) -> Result<KernelOpOutcome, String> {
    // Only the shell's own page is answered (1R-authority.1, F1).
    let address = webview.url().map_err(|error| {
        format!("The window's page could not be read ({error}): nothing was run.")
    })?;
    shell_document(&address, dev_server(&app).as_ref())?;
    // A field op's holder is the window it came from and that page's load, as this host counts them (DLW build ruling
    // 2026-11-07, G2): the driver's lease follows that page's life. A page's own claim is replaced.
    app.state::<SurfaceLoads>().stamp(&mut op, webview.label());
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
        let (result, timing) = oi_cradle_kernel::dispatch::dispatch_with(&host.0, &host.1, op);
        oi_cradle_kernel::dispatch::trace_op(
            "native",
            &name,
            result.is_ok(),
            started.elapsed(),
            &timing,
        );
        let outcome = result?;
        for receipt in &outcome.receipts {
            if let oi_cradle_kernel::events::KernelEvent::PresentationChanged { theme, .. } =
                &receipt.envelope.event
            {
                apply_native_appearance(&app, &theme.appearance);
            }
            let _ = app.emit(KERNEL_EVENT_TOPIC, receipt);
        }
        Ok(outcome)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Each window's page loads (G2): the holder of a field op, and when the driver a page held is freed.
type SurfaceLoads = oi_cradle_kernel::native_expression::SurfaceLoads;

/// The window or page `label` is gone or loads again: the native driver its page held is freed (DLW build ruling
/// 2026-11-07, G2). Off the UI thread: the field's lock may be held by an exchange in flight.
fn release_surface(app: &AppHandle, label: &str) {
    let (app, label) = (app.clone(), label.to_owned());
    tauri::async_runtime::spawn_blocking(move || {
        let Some(host) = app.try_state::<KernelHost>() else {
            return;
        };
        match host.1.release_surface(&label) {
            Ok(true) => eprintln!("Native driver freed: the page in {label} is gone"),
            Ok(false) => {}
            Err(error) => eprintln!("Native driver held by {label} could not be freed: {error}"),
        }
    });
}

/// Native human confirmation is the only issuance door. The caller supplies
/// an opaque preflight reference, never a grant, approval flag or dialog text.
#[tauri::command]
async fn decision_episode_authorise(
    app: AppHandle,
    window: tauri::WebviewWindow,
    preflight_ref: String,
) -> Result<KernelOpOutcome, String> {
    if window.label() != "main" {
        return Err("Authorise a decision episode from the main desktop window".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let host = app.state::<KernelHost>();
        let preview = host
            .0
            .lock()
            .map_err(|_| "kernel lock unavailable")?
            .decision_authorisation_preview(&preflight_ref)?;
        let approved = app
            .dialog()
            .message(preview.message)
            .title("Allow this decision episode?")
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Allow this episode".into(),
                "Cancel".into(),
            ))
            .blocking_show();
        if !approved {
            return Err("Decision episode was not authorised".into());
        }
        let outcome = host
            .0
            .lock()
            .map_err(|_| "kernel lock unavailable")?
            .authorise_decision(&preflight_ref)?;
        for receipt in &outcome.receipts {
            let _ = app.emit(KERNEL_EVENT_TOPIC, receipt);
        }
        Ok(outcome)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// The ordered, observable event log, read by cursor. This is the typed
/// command the renderer bootstraps from and re-syncs through; the topic
/// event is the push that says "look again".
#[tauri::command]
async fn kernel_event_log(
    app: AppHandle,
    cursor: u64,
    generation: Option<String>,
    limit: usize,
) -> Result<KernelEventReplay, String> {
    // An owner read can hold this mutex for seconds. Waiting on the main
    // thread freezes WebKit and native window interaction, even though
    // kernel_op itself correctly runs on the blocking pool.
    tauri::async_runtime::spawn_blocking(move || {
        let host = app.state::<KernelHost>();
        let asked = std::time::Instant::now();
        let kernel = host
            .0
            .lock()
            .map_err(|_| "kernel lock unavailable".to_owned())?;
        let waited = asked.elapsed();
        let replay = kernel
            .event_log()
            .replay(generation.as_deref(), cursor, limit);
        drop(kernel);
        oi_cradle_kernel::dispatch::trace_replay("native", waited);
        Ok(replay)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn apply_native_appearance(app: &AppHandle, appearance: &str) {
    app.set_theme(match appearance {
        "light" => Some(tauri::Theme::Light),
        "dark" => Some(tauri::Theme::Dark),
        _ => None,
    });
}

fn main() {
    #[cfg(feature = "native_shell")]
    if let Err(error) = native_shell::prepare() {
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
    let mut context = tauri::generate_context!();
    // The pinned config token generator emits Vec for this array field.
    // Use the same native runtime hook as isolated WebKit acceptance, with
    // the candidate's stable identity inherited by its detached windows.
    #[cfg(feature = "native_shell")]
    for window in &mut context.config_mut().app.windows {
        window.data_store_identifier = Some([
            79, 73, 83, 72, 69, 76, 76, 67, 65, 78, 68, 73, 68, 65, 84, 69,
        ]);
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
    if let Ok(raw) = std::env::var("OI_CRADLE_DATA_STORE_ID") {
        assert!(
            raw.len() == 32 && raw.bytes().all(|b| b.is_ascii_hexdigit()),
            "OI_CRADLE_DATA_STORE_ID must be 32 hex digits"
        );
        let mut id = [0u8; 16];
        for (i, byte) in id.iter_mut().enumerate() {
            *byte = u8::from_str_radix(&raw[i * 2..i * 2 + 2], 16).expect("validated hex");
        }
        for window in &mut context.config_mut().app.windows {
            window.data_store_identifier = Some(id);
            window.create = false;
        }
        seated = context
            .config()
            .app
            .windows
            .iter()
            .map(|window| (window.label.clone(), Some(id)))
            .collect();
    }
    // Any world but Yours keeps what its pages store apart (O-I #738): its main and
    // detached windows share a WebKit store named by its folder. Yours keeps its own.
    #[cfg(feature = "native_shell")]
    if let Some(id) = native_shell::world_store() {
        for window in &mut context.config_mut().app.windows {
            window.data_store_identifier = Some(id);
        }
        for (_, store) in &mut seated {
            *store = Some(id);
        }
    }
    let builder = material_protocol::register(tauri::Builder::default());
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SurfaceLoads::default())
        // A page that loads again (a reload, a navigation) frees the driver its last load held (G2).
        .on_page_load(|webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Started {
                webview.state::<SurfaceLoads>().loading(webview.label());
                release_surface(webview.app_handle(), webview.label());
            }
        })
        .setup(move |app| {
            app.manage(windows::Windows::default());
            #[cfg(feature = "native_shell")]
            app.manage(native_shell::ApplicationClose::default());
            live_engine_host::manage(app.handle());
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
            let field = kernel.native_field();
            live_engine_host::follow_torus(app.handle(), &field);
            app.manage(KernelHost(Mutex::new(kernel), field));
            // The window's one SharedField client for its identity (O-I #858),
            // held for the window's life: every transaction it takes — the
            // rows it moved, by view and ref — is recorded in the event log
            // and told to the shell on the event topic.
            {
                let handle = app.handle().clone();
                oi_cradle_kernel::shared_field::on_change(move |change| {
                    let host = handle.state::<KernelHost>();
                    let receipt = match host.0.lock() {
                        Ok(mut kernel) => kernel.record_shared_field_changed(change),
                        Err(_) => return,
                    };
                    let _ = handle.emit(KERNEL_EVENT_TOPIC, &receipt);
                });
                oi_cradle_kernel::shared_field::hold();
            }
            // The shell's configuration keeps the World it read while the
            // watch sees no change.
            #[cfg(feature = "native_shell")]
            native_shell::runtime::bind_change_epoch(|| oi_cradle_kernel::watch::Watch::global().change_epoch());
            // The change watch: when files the kernel's readings are made from
            // change, record it in the event log and tell the shell on the
            // event topic, so it asks again (the kernel answers from what it
            // holds unless a scope the answer depends on moved).
            {
                let handle = app.handle().clone();
                if let Err(error) = oi_cradle_kernel::watch::start_global(None, move |scopes, epoch| {
                    let host = handle.state::<KernelHost>();
                    let receipt = match host.0.lock() {
                        Ok(mut kernel) => kernel.record_readings_changed(scopes, epoch),
                        Err(_) => return,
                    };
                    let _ = handle.emit(KERNEL_EVENT_TOPIC, &receipt);
                }) {
                    eprintln!("Change watch degraded ({error}); readings are kept for a short time and the shell is told to ask again every 30 s");
                } else {
                    eprintln!("Change watch live");
                }
            }
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

            // The windows main() took from auto-create: each built from its own config, with the download receiver and the
            // navigation guard (`shell_navigation`, round 896 1R-authority.1).
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
                builder
                    .on_download(downloads::receiver())
                    .on_navigation(shell_navigation)
                    .build()?;
            }
            midi::start(app.handle());
            menus::install(app.handle(), &[], "")?;
            Ok(())
        })
        .on_menu_event(|app, event| menus::dispatch(app, event.id().as_ref()))
        .invoke_handler(tauri::generate_handler![native_shell::live_shell_read,native_shell::live_shell_config,native_shell::live_shell_checkpoint_reply,native_shell::live_shell_request_close,native_shell::live_shell_continuity_pending,native_shell::live_shell_continuity_confirm,native_shell::live_shell_book_read,native_shell::live_shell_book_write,live_engine_host::live_engine_open,live_engine_host::live_engine_play,live_engine_host::live_engine_stop,live_engine_host::live_engine_send,live_engine_host::live_engine_torus,live_engine_host::live_engine_torus_effects,live_engine_host::live_engine_mixer,live_engine_host::live_engine_export,live_engine_host::live_engine_render_take,live_engine_host::live_engine_consolidate,live_engine_host::live_engine_crop,live_engine_host::live_engine_freeze,live_engine_host::live_engine_unfreeze,live_engine_host::live_engine_take_play,midi::midi_out,walk_diagnostics::expression_walk_observation,working_surface_lease::working_surface_takeover,working_surface_lease::working_surface_client_poll,working_surface_lease::working_surface_client_input,working_surface_lease::working_surface_client_resize,working_surface_lease::working_surface_release,terminal::terminal_attach,terminal::terminal_poll,terminal::terminal_input,terminal::terminal_resize,terminal::terminal_checkpoint,terminal::terminal_reconcile,browser::browser_attach, browser::browser_control, browser::browser_reconcile, ground_dialog::choose_central_folder, ground_dialog::choose_folder, menus::arrangement_menu, decision_episode_authorise, kernel_op, kernel_press, kernel_event_log, windows::window_detach, windows::window_binding, windows::window_redock, windows::window_redock_surface, windows::window_focus_subject, windows::window_focus_main])
        .build(context)
        .expect("error while building the cradle")
        .run(|app,event| {
            // A window destroyed frees the driver its page held (G2).
            if let tauri::RunEvent::WindowEvent {label,event:tauri::WindowEvent::Destroyed,..} = &event {
                app.state::<SurfaceLoads>().gone(label);
                release_surface(app, label);
            }
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
                // A switch of worlds closed the application; it opens again in the chosen world.
                tauri::RunEvent::Exit => native_shell::relaunch(),
                _=>{}
            }
            #[cfg(not(feature = "native_shell"))]
            let _=(app,event);
        });
}

#[cfg(test)]
mod press_window_tests {
    use super::{press_window, shell_document, shell_navigation};
    use tauri::Url;

    /// O-I #747 round 896, 1R-authority.1 (F1): the kernel answers only the bundled shell's page; the material host's pages (which Tauri
    /// counts as the app's own), a remote page and a dev server other than the build's are refused in words; the dev server only when
    /// the build names it.
    #[test]
    fn the_kernel_answers_only_the_shell_s_own_page() {
        let url = |text: &str| Url::parse(text).unwrap();
        let dev = url("http://localhost:1421");
        for shell in [
            "tauri://localhost/app/index.html",
            "tauri://localhost/index.html",
            "http://tauri.localhost/app/index.html",
            "https://tauri.localhost/app/",
        ] {
            assert!(shell_document(&url(shell), None).is_ok(), "{shell}");
        }
        assert!(shell_document(&url("http://localhost:1421/app/index.html"), Some(&dev)).is_ok());
        for (other, shown) in [
            (
                "oi-material://localhost/__application/expressions/index.html",
                "oi-material://localhost",
            ),
            (
                "oi-material://application/__application/expressions/index.html",
                "oi-material://application",
            ),
            (
                "http://oi-material.localhost/__application/expressions/index.html",
                "http://oi-material.localhost",
            ),
            (
                "http://oi-material.application/__application/expressions/index.html",
                "http://oi-material.application",
            ),
            ("https://example.org/app/index.html", "https://example.org"),
            ("http://localhost:1421/app/index.html", "http://localhost"),
            ("tauri://localhost:8080/app/index.html", "tauri://localhost"),
            (
                "http://tauri.localhost.example.org/app/",
                "http://tauri.localhost.example.org",
            ),
            ("about:blank", "about:"),
        ] {
            let refused = shell_document(&url(other), None).unwrap_err();
            assert_eq!(
                refused,
                format!("The kernel answers only the shell's own page, and this window shows another ({shown}): nothing was run."),
                "{other}"
            );
        }
        assert!(
            shell_document(&url("http://localhost:5190/app/"), Some(&dev)).is_err(),
            "another dev server"
        );
        // The navigation guard keeps the shell's frames and refuses what none loads.
        for kept in [
            "tauri://localhost/app/index.html",
            "oi-material://application/__application/expressions/index.html",
            "https://example.org/essay/renderer/expression.html",
            "about:blank",
            "blob:tauri://localhost/1",
            "data:text/html,x",
        ] {
            assert!(shell_navigation(&url(kept)), "{kept}");
        }
        for refused in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "oi-context://selection",
            "asset://localhost/x",
            "ipc://localhost/kernel_op",
        ] {
            assert!(!shell_navigation(&url(refused)), "{refused}");
        }
    }

    /// O-I #747 round 896, 0R-authority.3: `kernel_press` takes only a shell window's press, `main` or a detached `surface-N`; a
    /// browser page's webview, or any other label, is refused in words.
    #[test]
    fn the_press_is_taken_only_from_a_shell_window() {
        assert!(press_window("main").is_ok());
        assert!(press_window("surface-1").is_ok());
        assert!(press_window("surface-12").is_ok());
        for other in [
            "browser-1",
            "surface-",
            "mainframe",
            "Main",
            "terminal-2",
            "",
        ] {
            let refused = press_window(other).unwrap_err();
            assert!(
                refused.starts_with("The person's press is taken only from a shell window")
                    && refused.ends_with("nothing was run."),
                "{other}: {refused}"
            );
        }
    }
}
