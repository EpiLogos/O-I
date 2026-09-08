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
use tauri::webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Rect, Webview, WebviewUrl};

#[derive(Clone, Serialize)]
pub struct Reading {
    pub id: String,
    pub url: String,
    pub title: String,
    pub loading: bool,
    pub zoom: f64,
    pub notice: Option<String>,
    pub requested_window: Option<String>,
}
struct Session {
    label: String,
    creating: bool,
    focused: bool,
    host: String,
    reading: Reading,
}
#[derive(Default)]
pub struct Browsers(Mutex<BTreeMap<String, Session>>, Mutex<()>);
static NEXT: AtomicU64 = AtomicU64::new(1);
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
    bounds: Bounds,
) -> Result<Reading, String> {
    trusted(&webview)?;
    let state = app.state::<Browsers>();
    let _lifecycle = state
        .1
        .lock()
        .map_err(|_| "Browser lifecycle unavailable")?;
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
                        url: initial.to_string(),
                        title: "Browser".into(),
                        loading: true,
                        zoom: 1.0,
                        notice: None,
                        requested_window: None,
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
        let builder = WebviewBuilder::new(&label, WebviewUrl::External(initial))
            .incognito(true)
            .focused(false)
            .on_navigation(move |target| {
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
            .on_download(move |_, _| {
                update(&download_app, &download_id, &download_label, |r| {
                    r.notice = Some("Downloads are not enabled in this browser yet".into())
                });
                false
            });
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
    action: String,
    address: Option<String>,
    bounds: Option<Bounds>,
    zoom: Option<f64>,
) -> Result<(), String> {
    trusted(&webview)?;
    let label = {
        let state = app.state::<Browsers>();
        let rows = state.0.lock().map_err(|_| "Browser state unavailable")?;
        let Some(s) = rows.get(&id) else {
            return Ok(());
        };
        if s.host != webview.label() {
            return Ok(());
        }
        s.label.clone()
    };
    let child = app.get_webview(&label).ok_or("Browser is unavailable")?;
    match action.as_str() {
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
                                rows.get_mut(&surface).and_then(|s| {
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
    .map_err(|e| e.to_string())
}
/// Main-window layout owns actual closure. Inactive tabs keep their view alive.
#[tauri::command]
pub async fn browser_reconcile(
    app: AppHandle,
    webview: Webview,
    live: Vec<String>,
) -> Result<(), String> {
    trusted(&webview)?;
    if webview.label() != "main" {
        return Err("Browser lifecycle belongs to the workspace".into());
    }
    let state = app.state::<Browsers>();
    let _lifecycle = state
        .1
        .lock()
        .map_err(|_| "Browser lifecycle unavailable")?;
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
