//! Native browser presentation. Instances, not URLs, survive pane changes.
//! Remote browser labels are deliberately absent from every IPC capability.
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};
use tauri::webview::{DownloadEvent, NewWindowResponse, PageLoadEvent, WebviewBuilder};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Rect, Webview, WebviewUrl};

#[derive(Clone, Serialize)]
pub struct Reading {
    pub id: String,
    /// Ephemeral native-view consumer generation, not an owner capability.
    pub attachment: u64,
    pub url: String,
    pub title: String,
    pub loading: bool,
    pub zoom: f64,
    pub notice: Option<String>,
    pub requested_window: Option<String>,
    pub profile: String,
    pub download: Option<DownloadReading>,
}
#[derive(Clone, Serialize)]
pub struct DownloadReading {
    pub url: String,
    pub path: String,
    pub state: String,
}
struct Session {
    label: String,
    creating: bool,
    focused: bool,
    host: String,
    reading: Reading,
}
#[derive(Default)]
pub struct Browsers(Mutex<BTreeMap<String, Session>>);
static NEXT: AtomicU64 = AtomicU64::new(1);
static NEXT_ATTACHMENT: AtomicU64 = AtomicU64::new(1);

fn trace(action: &str, id: &str, host: &str, attachment: u64) {
    if cfg!(debug_assertions) && std::env::var("OI_CRADLE_NATIVE_WALK").as_deref() == Ok("1") {
        eprintln!("{}", serde_json::json!({
            "schema": "oi.native-browser-lifecycle/v1", "action": action,
            "id": id, "host": host, "attachment": attachment,
            "unix_ms": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|v|v.as_millis()).unwrap_or(0),
        }));
    }
}

// Window close callbacks already execute on this thread. Queue the complete
// check-and-mutation operation here too: holding a background mutex while Wry
// waits for a UI-thread reparent can deadlock a concurrent window close.
async fn on_main<T: Send + 'static>(
    app: AppHandle,
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    let (send, mut receive) = tauri::async_runtime::channel(1);
    app.run_on_main_thread(move || { let _ = send.try_send(work()); })
        .map_err(|error| error.to_string())?;
    receive.recv().await.ok_or_else(|| "Browser operation was interrupted".to_string())?
}
#[derive(Deserialize)]
pub struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}
impl Bounds {
    fn valid(&self) -> bool {
        [self.x, self.y, self.width, self.height]
            .iter()
            .all(|v| v.is_finite())
            && self.x >= 0.0
            && self.y >= 0.0
            && self.width >= 1.0
            && self.height >= 1.0
            && self.width <= 20000.0
            && self.height <= 20000.0
    }
    fn rect(&self) -> Rect {
        Rect {
            position: LogicalPosition::new(self.x, self.y).into(),
            size: LogicalSize::new(self.width, self.height).into(),
        }
    }
}
fn url(value: &str) -> Result<tauri::Url, String> {
    let url = tauri::Url::parse(value).map_err(|_| "Enter a full http:// or https:// address")?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(
            "Only HTTP and HTTPS addresses without embedded credentials are supported".into(),
        );
    }
    Ok(url)
}
fn trusted(caller: &Webview) -> Result<(), String> {
    if caller.label() == "main" || caller.label().starts_with("surface-") {
        Ok(())
    } else {
        Err("Browser control belongs to the bundled shell".into())
    }
}
fn update(app: &AppHandle, id: &str, label: &str, change: impl FnOnce(&mut Reading)) {
    let payload = app.state::<Browsers>().0.lock().ok().and_then(|mut rows| {
        rows.get_mut(id).filter(|s| s.label == label).map(|s| {
            change(&mut s.reading);
            (s.host.clone(), s.reading.clone())
        })
    });
    if let Some((host, reading)) = payload {
        if let Some(shell) = app.get_webview(&host) {
            let _ = shell.emit("oi:browser-reading", reading);
        }
    }
}
#[tauri::command]
pub async fn browser_attach(
    app: AppHandle,
    webview: Webview,
    id: String,
    address: String,
    profile: Option<String>,
    bounds: Bounds,
) -> Result<Reading, String> {
    on_main(app.clone(), move || attach_on_main(app, webview, id, address, profile, bounds)).await
}

fn attach_on_main(
    app: AppHandle,
    webview: Webview,
    id: String,
    address: String,
    profile: Option<String>,
    bounds: Bounds,
) -> Result<Reading, String> {
    trusted(&webview)?;
    if !bounds.valid() {
        return Err("Browser bounds are invalid".into());
    }
    // A shell cannot create arbitrary owner resources through this seam.
    let present = app
        .state::<crate::KernelHost>()
        .0
        .lock()
        .map_err(|_| "Kernel unavailable")?
        .snapshot()
        .surfaces
        .get(&id)
        .is_some_and(|s| s.kind == "browser");
    if !present {
        return Err("Open the browser surface before attaching its view".into());
    }
    let initial = url(&address)?;
    let profile = profile.unwrap_or_else(|| "temporary".into());
    if !matches!(profile.as_str(), "temporary" | "personal") {
        return Err("Browser profile must be Temporary or Personal".into());
    }
    let (label, fresh) = {
        let state = app.state::<Browsers>();
        let mut rows = state.0.lock().map_err(|_| "Browser state unavailable")?;
        if rows
            .get(&id)
            .is_some_and(|s| !s.creating && app.get_webview(&s.label).is_none())
        {
            rows.remove(&id);
        }
        if let Some(s) = rows.get(&id) {
            (s.label.clone(), false)
        } else {
            let label = format!("browser-{}", NEXT.fetch_add(1, Ordering::Relaxed));
            rows.insert(
                id.clone(),
                Session {
                    label: label.clone(),
                    creating: true,
                    focused: false,
                    host: webview.label().into(),
                    reading: Reading {
                        id: id.clone(),
                        attachment: 0,
                        url: initial.to_string(),
                        title: "Browser".into(),
                        loading: true,
                        zoom: 1.0,
                        notice: None,
                        requested_window: None,
                        profile: profile.clone(),
                        download: None,
                    },
                },
            );
            (label, true)
        }
    };
    let child = if fresh {
        let nav_app = app.clone();
        let nav_id = id.clone();
        let nav_label = label.clone();
        let title_app = app.clone();
        let title_id = id.clone();
        let title_label = label.clone();
        let load_app = app.clone();
        let load_id = id.clone();
        let load_label = label.clone();
        let popup_app = app.clone();
        let popup_id = id.clone();
        let popup_label = label.clone();
        let download_app = app.clone();
        let download_id = id.clone();
        let download_label = label.clone();
        let mut builder = WebviewBuilder::new(&label, WebviewUrl::External(initial))
            .initialization_script(include_str!("../../src/context/page-context.js"))
            .incognito(profile == "temporary")
            .focused(false)
            .on_navigation(move |target| {
                if target.as_str() == "oi-context://selection" {
                    // A notification only: read the pending observation ourselves.
                    // This route grants no owner command or general page-to-shell IPC.
                    if let Some(view) = nav_app.get_webview(&nav_label) {
                        let origin = view.url().ok().map(|url|url.to_string());
                        let handle = nav_app.clone();let surface = nav_id.clone();let label = nav_label.clone();
                        let _ = view.eval_with_callback("window.__OI_PAGE_CONTEXT__?.take() ?? null",move |result| {
                            if result.len() > 100_000 { return; }
                            let current = handle.get_webview(&label).and_then(|view|view.url().ok()).map(|url|url.to_string());
                            if current != origin { return; }
                            let host = handle.state::<Browsers>().0.lock().ok().and_then(|rows|rows.get(&surface).map(|s|s.host.clone()));
                            if let Some(shell) = host.and_then(|host|handle.get_webview(&host)) {
                                let value = serde_json::from_str::<serde_json::Value>(&result).unwrap_or(serde_json::Value::Null);
                                let _ = shell.emit("oi:browser-picked",serde_json::json!({"id":surface,"result":value,"url":origin}));
                            }
                        });
                    }
                    return false;
                }
                if url(target.as_str()).is_err() {
                    update(&nav_app, &nav_id, &nav_label, |r| {
                        r.notice = Some("Navigation outside HTTP/HTTPS was blocked".into())
                    });
                    return false;
                }
                update(&nav_app, &nav_id, &nav_label, |r| {
                    r.loading = true;
                    r.notice = None;
                    r.requested_window = None;
                });
                true
            })
            .on_document_title_changed(move |_, title| {
                update(&title_app, &title_id, &title_label, |r| r.title = title)
            })
            .on_page_load(move |child, payload| {
                if child.url().ok().as_ref() != Some(payload.url()) {
                    return;
                }
                update(&load_app, &load_id, &load_label, |r| {
                    r.loading = matches!(payload.event(), PageLoadEvent::Started);
                    // Wry maps Started to WKNavigationDelegate didCommitNavigation.
                    // Both callbacks are checked against the actual native URL.
                    r.url = payload.url().to_string();
                })
            })
            .on_new_window(move |target, _| {
                update(&popup_app, &popup_id, &popup_label, |r| {
                    r.notice = Some("This page requested another window.".into());
                    r.requested_window = url(target.as_str()).ok().map(|u| u.to_string());
                });
                NewWindowResponse::Deny
            })
            .on_download(move |_, event| {
                match event {
                    DownloadEvent::Requested { url, destination } => {
                        let path = destination.display().to_string();
                        update(&download_app, &download_id, &download_label, |r| {
                            r.notice = Some(format!("Downloading to {path}"));
                            r.download = Some(DownloadReading {
                                url: url.to_string(),
                                path,
                                state: "downloading".into(),
                            });
                        });
                    }
                    DownloadEvent::Finished { url, path, success } => {
                        update(&download_app, &download_id, &download_label, |r| {
                            let known_path = path
                                .as_ref()
                                .map(|p| p.display().to_string())
                                .or_else(|| {
                                    r.download
                                        .as_ref()
                                        .filter(|d| d.url == url.as_str())
                                        .map(|d| d.path.clone())
                                })
                                .unwrap_or_default();
                            let state = if success { "saved" } else { "failed" };
                            r.notice = Some(if success {
                                format!("Saved to {known_path}")
                            } else {
                                "Download failed".into()
                            });
                            r.download = Some(DownloadReading {
                                url: url.to_string(),
                                path: known_path,
                                state: state.into(),
                            });
                        });
                    }
                    _ => {}
                }
                true
            });
        // A stable WebKit data-store identifier keeps Personal cookies and
        // site storage across panes and launches. Wry falls back to WebKit's
        // default persistent store before macOS 14; Temporary always uses the
        // non-persistent store.
        if profile == "personal" {
            builder = builder.data_store_identifier(*b"OI-browser-user1");
        }
        match webview.window().add_child(
            builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width, bounds.height),
        ) {
            Ok(child) => child,
            Err(e) => {
                app.state::<Browsers>()
                    .0
                    .lock()
                    .map_err(|_| "Browser state unavailable")?
                    .remove(&id);
                return Err(e.to_string());
            }
        }
    } else {
        app.get_webview(&label)
            .ok_or("Browser is still being attached; retry")?
    };
    let previous = child.window();
    let attached = (|| -> tauri::Result<()> {
        if previous.label() != webview.window().label() {
            child.reparent(&webview.window())?;
        }
        child.set_bounds(bounds.rect())?;
        child.show()?;
        Ok(())
    })();
    if let Err(error) = attached {
        let _ = child.hide();
        let _ = child.reparent(&previous);
        if fresh {
            let _ = child.close();
            app.state::<Browsers>()
                .0
                .lock()
                .map_err(|_| "Browser state unavailable")?
                .remove(&id);
        }
        return Err(error.to_string());
    }
    if let Some(s) = app
        .state::<Browsers>()
        .0
        .lock()
        .map_err(|_| "Browser state unavailable")?
        .get_mut(&id)
    {
        s.host = webview.label().into();
        s.creating = false;
        s.reading.attachment = NEXT_ATTACHMENT.fetch_add(1, Ordering::Relaxed);
        trace("attached", &id, &s.host, s.reading.attachment);
    }
    app.state::<Browsers>()
        .0
        .lock()
        .map_err(|_| "Browser state unavailable")?
        .get(&id)
        .map(|s| s.reading.clone())
        .ok_or("Browser was closed".into())
}
#[tauri::command]
pub async fn browser_control(
    app: AppHandle,
    webview: Webview,
    id: String,
    attachment: u64,
    action: String,
    address: Option<String>,
    bounds: Option<Bounds>,
    zoom: Option<f64>,
) -> Result<bool, String> {
    on_main(app.clone(), move || control_on_main(app, webview, id, attachment, action, address, bounds, zoom)).await
}

fn control_on_main(
    app: AppHandle,
    webview: Webview,
    id: String,
    attachment: u64,
    action: String,
    address: Option<String>,
    bounds: Option<Bounds>,
    zoom: Option<f64>,
) -> Result<bool, String> {
    trusted(&webview)?;
    let label = {
        let state = app.state::<Browsers>();
        let rows = state.0.lock().map_err(|_| "Browser state unavailable")?;
        let Some(s) = rows.get(&id) else {
            return Ok(false);
        };
        if s.host != webview.label() || attachment == 0 || s.reading.attachment != attachment {
            trace("stale-control-rejected", &id, webview.label(), attachment);
            return Ok(false);
        }
        s.label.clone()
    };
    let child = app.get_webview(&label).ok_or("Browser is unavailable")?;
    if matches!(action.as_str(), "hide" | "bounds" | "close") {
        trace(&action, &id, webview.label(), attachment);
    }
    match action.as_str() {
        "close" => {
            child.close().map_err(|e| e.to_string())?;
            let state = app.state::<Browsers>();
            let mut rows = state.0.lock().map_err(|_| "Browser state unavailable")?;
            if rows.get(&id).is_some_and(|s| s.label == label) {
                rows.remove(&id);
            }
            Ok(())
        }
        "context" => {
            let request: serde_json::Value = serde_json::from_str(address.as_deref().ok_or("Context request is missing")?).map_err(|e|e.to_string())?;
            let key = serde_json::to_string(request.get("value").unwrap_or(&serde_json::Value::Null)).map_err(|e|e.to_string())?;
            let expression = match request["op"].as_str() {
                Some("mode") => format!("(() => {{ const api=window.__OI_PAGE_CONTEXT__; if(!api)return false; api.setSignal(()=>{{location.href='oi-context://selection'}}); return api.mode({key}); }})()"),
                Some("take") => "window.__OI_PAGE_CONTEXT__?.take() ?? null".into(),
                Some("selection") => "window.__OI_PAGE_CONTEXT__?.selection() ?? null".into(),
                Some("validate") => format!("window.__OI_PAGE_CONTEXT__?.validate({key}) ?? false"),
                _ => return Err("Unknown context reading".into()),
            };
            let request_id = request["request"].as_str().ok_or("Context request id is missing")?.to_owned();
            let origin = child.url().map_err(|e|e.to_string())?.to_string();
            let handle = app.clone(); let host = webview.label().to_owned(); let child_label = label.clone();
            child.eval_with_callback(expression,move |result| {
                // Result is untrusted page data. Only this originating shell receives it;
                // no page obtains shell IPC and navigation invalidates the reading.
                let current_consumer = handle.state::<Browsers>().0.lock().ok().is_some_and(|rows| rows.get(&id).is_some_and(|s|s.host==host && s.reading.attachment==attachment));
                if !current_consumer { return; }
                let same_page = handle.get_webview(&child_label).and_then(|view|view.url().ok()).is_some_and(|url|url.as_str()==origin);
                let result = if same_page && result.len() <= 100_000 { serde_json::from_str::<serde_json::Value>(&result).unwrap_or(serde_json::Value::Null) } else { serde_json::Value::Null };
                if let Some(shell) = handle.get_webview(&host) { let _ = shell.emit("oi:browser-context", serde_json::json!({"id":id,"request":request_id,"result":result,"url":origin})); }
            })
        }
        "navigate" => child.navigate(url(address.as_deref().ok_or("Address is missing")?)?),
        "back" => child.eval("history.back()"),
        "forward" => child.eval("history.forward()"),
        "reload" => child.reload(),
        "stop" => {
            update(&app, &id, &label, |r| r.loading = false);
            child.eval("window.stop()")
        }
        "focus" => child.set_focus(),
        "poll-focus" => {
            #[cfg(target_os = "macos")]
            {
                let handle = app.clone();
                let surface = id.clone();
                child
                    .with_webview(move |platform| {
                        use objc2::{msg_send, runtime::AnyObject};
                        // WKWebView and its NSWindow are read only on the UI thread
                        // supplied by with_webview. No page script reports focus.
                        let focused = unsafe {
                            let view = platform.inner() as *mut AnyObject;
                            let window: *mut AnyObject = msg_send![view, window];
                            if window.is_null() {
                                false
                            } else {
                                let responder: *mut AnyObject = msg_send![window, firstResponder];
                                let key: bool = msg_send![window, isKeyWindow];
                                if responder.is_null() || !key {
                                    false
                                } else {
                                    let is_view: bool =
                                        msg_send![responder,isKindOfClass:objc2::class!(NSView)];
                                    is_view
                                        && (responder == view
                                            || msg_send![responder,isDescendantOf:view])
                                }
                            }
                        };
                        let host = handle
                            .state::<Browsers>()
                            .0
                            .lock()
                            .ok()
                            .and_then(|mut rows| {
                                rows.get_mut(&surface).filter(|s|s.reading.attachment==attachment).and_then(|s| {
                                    let changed = focused && !s.focused;
                                    s.focused = focused;
                                    changed.then(|| s.host.clone())
                                })
                            });
                        if let Some(shell) = host.and_then(|host| handle.get_webview(&host)) {
                            let _ = shell.emit("oi:browser-focus", &surface);
                        }
                    })
                    .map_err(|e| e.to_string())?;
            }
            Ok(())
        }
        "hide" => child.hide(),
        "bounds" => {
            let b = bounds.ok_or("Bounds are missing")?;
            if !b.valid() {
                return Err("Browser bounds are invalid".into());
            }
            child.set_bounds(b.rect()).map_err(|e| e.to_string())?;
            child.show()
        }
        "zoom" => {
            let z = zoom
                .filter(|z| z.is_finite() && *z >= 0.5 && *z <= 2.0)
                .ok_or("Zoom must be between 50% and 200%")?;
            child.set_zoom(z).map_err(|e| e.to_string())?;
            update(&app, &id, &label, |r| r.zoom = z);
            Ok(())
        }
        _ => return Err("Unknown browser operation".into()),
    }
    .map(|_| true)
    .map_err(|e| e.to_string())
}
/// Main-window layout owns actual closure. Inactive tabs keep their view alive.
#[tauri::command]
pub async fn browser_reconcile(
    app: AppHandle,
    webview: Webview,
    live: Vec<String>,
) -> Result<(), String> {
    on_main(app.clone(), move || reconcile_on_main(app, webview, live)).await
}

fn reconcile_on_main(app: AppHandle, webview: Webview, live: Vec<String>) -> Result<(), String> {
    trusted(&webview)?;
    if webview.label() != "main" {
        return Err("Browser lifecycle belongs to the workspace".into());
    }
    let dead = {
        let state = app.state::<Browsers>();
        let rows = state.0.lock().map_err(|_| "Browser state unavailable")?;
        rows.iter()
            .filter(|(id, _)| !live.contains(id))
            .map(|(id, s)| (id.clone(), s.label.clone()))
            .collect::<Vec<_>>()
    };
    let mut errors = Vec::new();
    for (id, label) in dead {
        if let Some(child) = app.get_webview(&label) {
            if let Err(error) = child.close() {
                errors.push(error.to_string());
                continue;
            }
        }
        let state = app.state::<Browsers>();
        let mut rows = state.0.lock().map_err(|_| "Browser state unavailable")?;
        if rows.get(&id).is_some_and(|s| s.label == label) {
            rows.remove(&id);
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}
/// Keep the actual child alive before its detached host is destroyed.
pub fn return_to_main(app: &AppHandle, id: &str) -> Result<(), String> {
    let label = app
        .state::<Browsers>()
        .0
        .lock()
        .map_err(|_| "Browser state unavailable")?
        .get(id)
        .map(|s| s.label.clone());
    if let Some(child) = label.and_then(|label| app.get_webview(&label)) {
        child.hide().map_err(|e| e.to_string())?;
        child
            .reparent(&app.get_window("main").ok_or("Workspace is unavailable")?)
            .map_err(|e| e.to_string())?;
        if let Some(s) = app
            .state::<Browsers>()
            .0
            .lock()
            .map_err(|_| "Browser state unavailable")?
            .get_mut(id)
        {
            s.host = "main".into();
            s.reading.attachment = 0;
            trace("returned-awaiting-attachment", id, &s.host, 0);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn navigation_rejects_native_and_credential_bearing_addresses() {
        for address in [
            "file:///etc/passwd",
            "tauri://localhost",
            "oi-material://localhost/anything",
            "javascript:alert(1)",
            "data:text/html,test",
            "https://trusted.example@hostile.example",
            "https://user:secret@example.org",
        ] {
            assert!(url(address).is_err(), "{address}");
        }
        for address in [
            "http://127.0.0.1:4290/b",
            "https://example.org/path?query=1#part",
        ] {
            assert!(url(address).is_ok(), "{address}");
        }
    }
    #[test]
    fn native_geometry_rejects_nonfinite_and_offscreen_bounds() {
        let mut bounds = Bounds {
            x: 0.0,
            y: 60.0,
            width: 800.0,
            height: 600.0,
        };
        assert!(bounds.valid());
        bounds.width = f64::NAN;
        assert!(!bounds.valid());
        bounds.width = 800.0;
        bounds.x = -1.0;
        assert!(!bounds.valid());
    }
}
