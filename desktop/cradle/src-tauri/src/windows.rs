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
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent};

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
    pub browser: Option<serde_json::Value>,
    pub terminal: Option<serde_json::Value>,
    pub flow: Option<serde_json::Value>,
    /// Presentation metadata travels with the binding rather than relying
    /// on another renderer's potentially stale localStorage snapshot.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub view: Option<serde_json::Value>,
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

fn encounter_space(binding: &Binding) -> Option<&str> {
    binding.encounter.as_ref()?.get("space")?.as_str()
}

/// A detached encounter is the owner identity (project, AgentSession,
/// SessionSpace), not its session ref alone. Other detachable subjects retain
/// their legacy ref identity; Factory material and handoffs stay binding-id based so
/// distinct revisions can stay open together.
fn same_detached_subject(request: &Binding, stored: &Binding) -> bool {
    if stored.id == request.id {
        return true;
    }
    if matches!(
        request.kind.as_str(),
        "factory-material" | "factory-handoff"
    ) || request.reference.is_none()
    {
        return false;
    }
    if request.kind == "encounter" {
        return stored.kind == "encounter"
            && stored.reference == request.reference
            && stored.project == request.project
            && encounter_space(stored) == encounter_space(request);
    }
    stored.reference == request.reference
}

/// Existing unscoped callers retain reference-only focus. An encounter caller
/// that supplies project or SessionSpace may focus only that exact identity.
fn focus_subject_matches(
    binding: &Binding,
    reference: &str,
    project: Option<&str>,
    space: Option<&str>,
) -> bool {
    if binding.reference.as_deref() != Some(reference) {
        return false;
    }
    if project.is_none() && space.is_none() {
        return true;
    }
    binding.kind == "encounter"
        && project.map_or(true, |value| binding.project.as_deref() == Some(value))
        && space.map_or(true, |value| encounter_space(binding) == Some(value))
}

#[tauri::command]
pub fn window_detach(
    app: AppHandle,
    window: Window,
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
        if !matches!(
            binding.kind.as_str(),
            "source"
                | "knowledge"
                | "file"
                | "encounter"
                | "browser"
                | "terminal"
                | "flow"
                | "factory-handoff"
                | "factory-material"
                | "development-field"
        ) {
            return Err("This surface has no native detached body".into());
        }
        if binding.kind == "file" {
            let location = binding.location.clone().ok_or("File location is missing")?;
            if binding.reference.as_deref() != Some(&location.ref_id) {
                return Err("File location differs from the bound subject".into());
            }
            kernel.apply(oi_cradle_kernel::KernelOp::FileBytes { location })?;
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
        .find(|(_, r)| same_detached_subject(&binding, &r.binding))
        .map(|(label, _)| label.clone());
    if let Some(label) = existing {
        if let Some(existing) = app.get_window(&label) {
            return existing.set_focus().map_err(|e| e.to_string());
        }
        // An externally destroyed webview must not permanently prevent this
        // subject from being detached again.
        windows
            .0
            .lock()
            .map_err(|_| "Window state unavailable")?
            .remove(&label);
    }
    let label = format!("surface-{}", NEXT.fetch_add(1, Ordering::Relaxed));
    let record = Detached {
        workspace_id,
        binding,
    };
    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title(format!("{} — O-I", record.binding.title))
        .inner_size(800.0, 650.0)
        .min_inner_size(400.0, 300.0)
        .initialization_script("window.__OI_DETACHED__ = true;");
    #[cfg(target_os = "linux")]
    let builder = builder.decorations(false);
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
    // Publish only after fallible preparation (including monitor discovery)
    // succeeds, otherwise a failed attempt leaves a phantom detached record.
    windows
        .0
        .lock()
        .map_err(|_| "Window state unavailable")?
        .insert(label.clone(), record.clone());
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
            if let Some(w) = handle.get_window(&label) {
                if !w.is_maximized().unwrap_or(true) && !w.is_fullscreen().unwrap_or(true) {
                    if let (Ok(position), Ok(size), Ok(scale)) =
                        (w.outer_position(), w.inner_size(), w.scale_factor())
                    {
                        let p = position.to_logical::<f64>(scale);
                        let size = size.to_logical::<f64>(scale);
                        if let Some(main) = handle.get_window("main") {
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
        if let WindowEvent::CloseRequested { api, .. } = event {
            if record.binding.kind == "browser"
                && crate::browser::return_to_main(&handle, &record.binding.id).is_err()
            {
                api.prevent_close();
            }
        }
        if matches!(event, WindowEvent::Destroyed) {
            if let Ok(mut rows) = handle.state::<Windows>().0.lock() {
                rows.remove(&label);
            }
            if let Some(main) = handle.get_window("main") {
                let _ = main.emit("oi:window-redock", &record);
            }
        }
    });
    Ok(())
}
#[tauri::command]
pub fn window_binding(app: AppHandle, window: Window) -> Result<Detached, String> {
    app.state::<Windows>()
        .0
        .lock()
        .map_err(|_| "Window state unavailable")?
        .get(window.label())
        .cloned()
        .ok_or_else(|| "This window has no detached binding".into())
}
#[tauri::command]
pub fn window_redock(window: Window) -> Result<(), String> {
    if window.label() == "main" {
        return Err("The workspace window cannot re-dock itself".into());
    }
    window.close().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn window_focus_subject(
    app: AppHandle,
    reference: String,
    project: Option<String>,
    space: Option<String>,
) -> Result<bool, String> {
    let label = app
        .state::<Windows>()
        .0
        .lock()
        .map_err(|_| "Window state unavailable")?
        .iter()
        .find(|(_, r)| {
            focus_subject_matches(&r.binding, &reference, project.as_deref(), space.as_deref())
        })
        .map(|(k, _)| k.clone());
    if let Some(window) = label.and_then(|l| app.get_window(&l)) {
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn window_focus_main(app: AppHandle, window: Window) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Workspace navigation focus belongs to the main window".into());
    }
    app.get_window("main")
        .ok_or("Workspace window is unavailable")?
        .set_focus()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encounter(id: &str, project: &str, space: &str) -> Binding {
        Binding {
            id: id.into(),
            kind: "encounter".into(),
            title: "Conversation".into(),
            reference: Some("agent-session/shared".into()),
            project: Some(project.into()),
            address: None,
            encounter: Some(serde_json::json!({"space": space})),
            browser: None,
            terminal: None,
            flow: None,
            view: None,
            location: None,
        }
    }

    #[test]
    fn encounter_detach_identity_requires_project_and_space() {
        let first = encounter("first", "Factory", "session-space/factory");
        let other_project = encounter("second", "Central", "session-space/central");
        let other_space = encounter("third", "Factory", "session-space/other");
        assert!(same_detached_subject(&first, &first));
        assert!(!same_detached_subject(&first, &other_project));
        assert!(!same_detached_subject(&first, &other_space));
    }

    #[test]
    fn scoped_focus_rejects_same_ref_from_another_project() {
        let first = encounter("first", "Factory", "session-space/factory");
        let other_project = encounter("second", "Central", "session-space/central");
        assert!(focus_subject_matches(
            &first,
            "agent-session/shared",
            Some("Factory"),
            Some("session-space/factory")
        ));
        assert!(!focus_subject_matches(
            &other_project,
            "agent-session/shared",
            Some("Factory"),
            Some("session-space/factory")
        ));
        assert!(focus_subject_matches(
            &other_project,
            "agent-session/shared",
            None,
            None
        ));
    }

    #[test]
    fn factory_reviews_keep_independently_selected_revisions_in_distinct_windows() {
        for kind in ["factory-material", "factory-handoff"] {
            let mut first = encounter("review-one", "Factory", "session-space/factory");
            first.kind = kind.into();
            let mut revision_two = first.clone();
            revision_two.id = "review-two".into();
            assert!(same_detached_subject(&first, &first));
            assert!(!same_detached_subject(&first, &revision_two));
        }
    }
}
