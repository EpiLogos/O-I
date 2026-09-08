//! Native view lifecycle only. A window carries an existing kernel surface;
//! closing it re-docks the view and never terminates an owner operation.
use crate::KernelHost;
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};
use tauri::{
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
#[derive(Clone, Serialize)]
struct BoundsChange {
    workspace_id: String,
    surface_id: String,
    bounds: Bounds,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Binding {
    pub id: String,
    pub kind: String,
    pub title: String,
    #[serde(rename = "ref")]
    pub reference: Option<String>,
    pub project: Option<String>,
    pub address: Option<serde_json::Value>,
    pub encounter: Option<serde_json::Value>,
    pub location: Option<oi_cradle_kernel::files::Location>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Detached {
    pub workspace_id: String,
    pub binding: Binding,
}
#[derive(Default)]
pub struct Windows(pub Mutex<BTreeMap<String, Detached>>);
static NEXT: AtomicU64 = AtomicU64::new(1);

#[tauri::command]
pub fn window_detach(
    app: AppHandle,
    window: WebviewWindow,
    workspace_id: String,
    binding: Binding,
    bounds: Option<Bounds>,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Detach belongs to the workspace window".into());
    }
    {
        let host = app.state::<KernelHost>();
        let mut kernel = host.0.lock().map_err(|_| "Kernel unavailable")?;
        let snapshot = kernel.snapshot();
        let surface = snapshot
            .surfaces
            .get(&binding.id)
            .ok_or("Resolve the surface before detaching")?;
        if surface.kind != binding.kind || surface.source_ref != binding.reference {
            return Err("Detached binding differs from the kernel subject".into());
        }
        if !matches!(binding.kind.as_str(), "source" | "knowledge" | "file" | "encounter") {
            return Err("This surface has no native detached body".into());
        }
        if binding.kind == "file" {
            let location = binding.location.clone().ok_or("File location is missing")?;
            if binding.reference.as_deref() != Some(&location.ref_id) {return Err("File location differs from the bound subject".into());}
            kernel.apply(oi_cradle_kernel::KernelOp::FileRead {location})?;
        }
        if binding.kind == "source"
            && !binding
                .reference
                .as_ref()
                .is_some_and(|r| snapshot.buffers.contains_key(r))
        {
            return Err("Read the source before detaching".into());
        }
    }
    let windows = app.state::<Windows>();
    let existing = windows
        .0
        .lock()
        .map_err(|_| "Window state unavailable")?
        .iter()
        .find(|(_, r)| r.binding.reference == binding.reference)
        .map(|(label, _)| label.clone());
    if let Some(label) = existing {
        return app
            .get_webview_window(&label)
            .ok_or("Detached window unavailable")?
            .set_focus()
            .map_err(|e| e.to_string());
    }
    let label = format!("surface-{}", NEXT.fetch_add(1, Ordering::Relaxed));
    let record = Detached {
        workspace_id,
        binding,
    };
    windows
        .0
        .lock()
        .map_err(|_| "Window state unavailable")?
        .insert(label.clone(), record.clone());
    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title(format!("{} — O-I", record.binding.title))
        .inner_size(800.0, 650.0)
        .min_inner_size(400.0, 300.0)
        .initialization_script("window.__OI_DETACHED__ = true;");
    #[cfg(target_os = "macos")]
    let builder = if let Some(id) = app
        .config()
        .app
        .windows
        .first()
        .and_then(|w| w.data_store_identifier)
    {
        builder.data_store_identifier(id)
    } else {
        builder
    };
    let builder = if let Some(b) = bounds.filter(|b| {
        [b.x, b.y, b.width, b.height].iter().all(|v| v.is_finite())
            && b.width >= 400.0
            && b.height >= 300.0
    }) {
        // A disconnected monitor cannot strand a restored native view. Apply
        // its position only while its title area intersects an actual monitor.
        let visible = app
            .available_monitors()
            .map_err(|e| e.to_string())?
            .iter()
            .any(|m| {
                let scale = m.scale_factor();
                let p = m.position().to_logical::<f64>(scale);
                let size = m.size().to_logical::<f64>(scale);
                b.x + 100.0 > p.x
                    && b.x < p.x + size.width - 100.0
                    && b.y >= p.y
                    && b.y < p.y + size.height - 60.0
            });
        let builder = builder.inner_size(b.width.min(4096.0), b.height.min(4096.0));
        if visible {
            builder.position(b.x, b.y)
        } else {
            builder
        }
    } else {
        builder
    };
    let built = builder.build();
    let detached = match built {
        Ok(w) => w,
        Err(e) => {
            windows
                .0
                .lock()
                .map_err(|_| "Window state unavailable")?
                .remove(&label);
            return Err(e.to_string());
        }
    };
    let handle = app.clone();
    detached.on_window_event(move |event| {
        if matches!(event, WindowEvent::Focused(true)) {
            let receipts = handle
                .state::<KernelHost>()
                .0
                .lock()
                .ok()
                .and_then(|mut kernel| {
                    kernel
                        .apply(oi_cradle_kernel::KernelOp::SurfaceFocus {
                            surface_id: record.binding.id.clone(),
                        })
                        .ok()
                })
                .map(|o| o.receipts)
                .unwrap_or_default();
            for receipt in receipts {
                let _ = handle.emit(oi_cradle_kernel::events::KERNEL_EVENT_TOPIC, &receipt);
            }
        }
        if matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_)) {
            if let Some(w) = handle.get_webview_window(&label) {
                if !w.is_maximized().unwrap_or(true) && !w.is_fullscreen().unwrap_or(true) {
                    if let (Ok(position), Ok(size), Ok(scale)) =
                        (w.outer_position(), w.inner_size(), w.scale_factor())
                    {
                        let p = position.to_logical::<f64>(scale);
                        let size = size.to_logical::<f64>(scale);
                        if let Some(main) = handle.get_webview_window("main") {
                            let _ = main.emit(
                                "oi:window-bounds",
                                BoundsChange {
                                    workspace_id: record.workspace_id.clone(),
                                    surface_id: record.binding.id.clone(),
                                    bounds: Bounds {
                                        x: p.x,
                                        y: p.y,
                                        width: size.width,
                                        height: size.height,
                                    },
                                },
                            );
                        }
                    }
                }
            }
        }
        if matches!(event, WindowEvent::Destroyed) {
            if let Ok(mut rows) = handle.state::<Windows>().0.lock() {
                rows.remove(&label);
            }
            if let Some(main) = handle.get_webview_window("main") {
                let _ = main.emit("oi:window-redock", &record);
            }
        }
    });
    Ok(())
}
#[tauri::command]
pub fn window_binding(app: AppHandle, window: WebviewWindow) -> Result<Detached, String> {
    app.state::<Windows>()
        .0
        .lock()
        .map_err(|_| "Window state unavailable")?
        .get(window.label())
        .cloned()
        .ok_or_else(|| "This window has no detached binding".into())
}
#[tauri::command]
pub fn window_redock(window: WebviewWindow) -> Result<(), String> {
    if window.label() == "main" {
        return Err("The workspace window cannot re-dock itself".into());
    }
    window.close().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn window_focus_subject(app: AppHandle, reference: String) -> Result<bool, String> {
    let label = app
        .state::<Windows>()
        .0
        .lock()
        .map_err(|_| "Window state unavailable")?
        .iter()
        .find(|(_, r)| r.binding.reference.as_deref() == Some(&reference))
        .map(|(k, _)| k.clone());
    if let Some(window) = label.and_then(|l| app.get_webview_window(&l)) {
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn window_focus_main(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    if window.label() != "main" { return Err("Workspace navigation focus belongs to the main window".into()); }
    app.get_webview_window("main").ok_or("Workspace window is unavailable")?
        .set_focus().map_err(|error|error.to_string())
}
