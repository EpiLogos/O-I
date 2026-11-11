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
    /// A popped-out device's identity (seam 8): the family, face and aperture its manifest declares. A device has no
    /// kernel surface; its binding id is `device:{family}/{face}` (native/detachedKinds.ts `deviceBindingId`).
    pub device: Option<serde_json::Value>,
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

/// The device binding id the TypeScript door mints (`deviceBindingId` in native/detachedKinds.ts): `device:{family}/{face}`.
fn device_binding_id(device: &serde_json::Value) -> Result<String, &'static str> {
    let part = |key: &str| {
        device
            .get(key)
            .and_then(serde_json::Value::as_str)
            .filter(|v| !v.is_empty())
    };
    let family = part("family").ok_or("Device identity has no family")?;
    let face = part("face").ok_or("Device identity has no face")?;
    Ok(format!("device:{family}/{face}"))
}

/// A device has no kernel surface to match: its identity admits it. The binding id and its reference must both name the
/// family and face the identity carries, so a mismatched id is refused before any window is built.
pub(crate) fn admit_device_binding(binding: &Binding) -> Result<(), String> {
    let identity = binding
        .device
        .as_ref()
        .ok_or("Device identity is missing")?;
    let expected = device_binding_id(identity)?;
    if binding.id != expected || binding.reference.as_deref() != Some(expected.as_str()) {
        return Err("Device binding differs from its device identity".into());
    }
    Ok(())
}

#[tauri::command]
pub fn window_detach(
    app: AppHandle,
    window: Window,
    webview: tauri::Webview,
    workspace_id: String,
    binding: Binding,
    bounds: Option<Bounds>,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Detach belongs to the workspace window".into());
    }
    crate::native_shell::admit_candidate_view(&webview)?;
    {
        let host = app.state::<KernelHost>();
        let mut kernel = host.0.lock().map_err(|_| "Kernel unavailable")?;
        let snapshot = kernel.snapshot();
        if binding.kind == "device" {
            admit_device_binding(&binding)?;
        } else {
            let surface = snapshot
                .surfaces
                .get(&binding.id)
                .ok_or("Resolve the surface before detaching")?;
            if surface.kind != binding.kind || surface.source_ref != binding.reference {
                return Err("Detached binding differs from the kernel subject".into());
            }
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
                | "device"
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
        .find(|(_, r)| {
            r.binding.id == binding.id
                || (binding.reference.is_some() && r.binding.reference == binding.reference)
        })
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
    #[cfg(feature = "native_shell")]
    let asset = "app/index.html";
    #[cfg(not(feature = "native_shell"))]
    let asset = "index.html";
    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(asset.into()))
        .title(format!("{} — O-I", window_title(&record.binding.title)))
        .inner_size(800.0, 650.0)
        .min_inner_size(400.0, 300.0)
        .initialization_script("window.__OI_DETACHED__ = true;")
        // The page's own drags (a world onto a track, a device into a chain) are HTML5 drops: with the native file-drop handler on,
        // Tauri answers every drag itself (tauri-runtime-wry returns true for each), so on macOS WebKit never sees one. Nothing
        // here takes a file dropped from outside, so the handler is off, as on the main window (tauri.candidate.conf.json).
        .disable_drag_drop_handler()
        // A detached pane exports as the main window does (downloads.rs): without a receiver wry cancels the file.
        .on_download(crate::downloads::receiver())
        // The shell window's navigation guard (O-I #747 round 896, 1R-authority.1, F1).
        .on_navigation(crate::shell_navigation);
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
        // A device has no kernel surface to focus; its window is focused without a kernel receipt.
        if matches!(event, WindowEvent::Focused(true)) && record.binding.kind != "device" {
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
pub fn window_binding(
    app: AppHandle,
    window: tauri::WebviewWindow,
    label: Option<String>,
) -> Result<Detached, String> {
    crate::native_shell::admit_candidate_webview(&window)?;
    let label = detached_binding_label(window.label(), label.as_deref())?;
    app.state::<Windows>()
        .0
        .lock()
        .map_err(|_| "Window state unavailable")?
        .get(label)
        .cloned()
        .ok_or_else(|| "This window has no detached binding".into())
}

fn detached_binding_label<'a>(
    caller: &'a str,
    target: Option<&'a str>,
) -> Result<&'a str, &'static str> {
    match target {
        Some(label) if caller == "main" => Ok(label),
        Some(_) => Err("Only the main workspace can inspect another detached window binding"),
        None => Ok(caller),
    }
}

/// The characters that draw nothing, as inclusive ranges: the shell's one set
/// (packages/live-shell/ui/tests/fixtures/invisible-code-points.txt) less the controls and the two
/// separators, which stand as a space. A test holds this table to that list, scalar by scalar.
const UNSEEN: [(u32, u32); 19] = [
    (0x00ad, 0x00ad),
    (0x034f, 0x034f),
    (0x061c, 0x061c),
    (0x070f, 0x070f),
    (0x115f, 0x1160),
    (0x180e, 0x180e),
    (0x200b, 0x200f),
    (0x202a, 0x202e),
    (0x2060, 0x2064),
    (0x2066, 0x206f),
    (0x2800, 0x2800),
    (0x3164, 0x3164),
    (0xfeff, 0xfeff),
    (0xffa0, 0xffa0),
    (0xfff9, 0xfffb),
    (0x13430, 0x1343f),
    (0x1bca0, 0x1bca3),
    (0x1d173, 0x1d17a),
    (0xe0000, 0xe007f),
];
fn unseen(c: char) -> bool {
    let scalar = c as u32;
    UNSEEN
        .iter()
        .any(|(from, to)| (*from..=*to).contains(&scalar))
}
/// What stands as a space in a title: a control character, or a line or paragraph separator.
fn spaced(c: char) -> bool {
    c.is_control() || c == '\u{2028}' || c == '\u{2029}'
}
/// A window's title as the system draws it (be2l ruling 2; DLW build ruling 2026-11-10): on one
/// line and plain, as the frame reads it (src/shared/plainText.ts oneLineText), so no caller of
/// `window_detach` can put a bidi control or an invisible character in a title bar. A title with
/// nothing visible reads "Window". The record keeps the binding as it was given. The main
/// window's title and the Workspace menu read a workspace's name through it too (menus.rs; be2n
/// ruling 4, DLW build ruling 2026-11-11).
pub(crate) fn window_title(title: &str) -> String {
    let plain: String = title
        .chars()
        .filter_map(|c| {
            if spaced(c) {
                Some(' ')
            } else if unseen(c) {
                None
            } else {
                Some(c)
            }
        })
        .collect();
    let line = plain.split_whitespace().collect::<Vec<_>>().join(" ");
    if line.is_empty() {
        "Window".to_owned()
    } else {
        line
    }
}
/// Words in a native dialog a person answers (be2n ruling 4; DLW build ruling 2026-11-11): the
/// text keeps its line breaks and tabs, and every other control character, separator or
/// invisible character is written as its escape (`\u{202e}`), so nothing reorders or hides what
/// is read and nothing that was given is left out unsaid.
pub(crate) fn dialog_text(text: &str) -> String {
    let mut shown = String::with_capacity(text.len());
    for c in text.chars() {
        if c == '\n' || c == '\t' || !(spaced(c) || unseen(c)) {
            shown.push(c);
        } else {
            shown.extend(c.escape_unicode());
        }
    }
    shown
}

#[cfg(test)]
mod window_title_tests {
    use super::{dialog_text, spaced, unseen, window_title};
    use std::collections::BTreeSet;
    #[test]
    fn the_unseen_table_is_the_shells_list_less_what_stands_as_a_space() {
        let list: BTreeSet<u32> = include_str!(
            "../../../../packages/live-shell/ui/tests/fixtures/invisible-code-points.txt"
        )
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|line| u32::from_str_radix(line, 16).unwrap())
        .collect();
        assert_eq!(list.len(), 262);
        for scalar in 0..=0x0010_ffff_u32 {
            let Some(c) = char::from_u32(scalar) else {
                continue;
            };
            assert_eq!(
                spaced(c) || unseen(c),
                list.contains(&scalar),
                "U+{scalar:04X}"
            );
            assert!(!(spaced(c) && unseen(c)), "U+{scalar:04X} is read twice");
        }
    }
    #[test]
    fn a_dialog_keeps_its_lines_and_writes_what_draws_nothing_as_escapes() {
        assert_eq!(
            dialog_text("Scope: a\u{202e}b\n\tc\u{2028}d\u{feff}\u{1b}\u{85} e"),
            "Scope: a\\u{202e}b\n\tc\\u{2028}d\\u{feff}\\u{1b}\\u{85} e"
        );
        assert_eq!(
            dialog_text("Plain words,\nas given."),
            "Plain words,\nas given."
        );
    }
    #[test]
    fn a_title_reads_as_the_shared_list_of_cases_says() {
        // the frame's test reads the same file (tests/shell-recovery.test.mjs)
        let cases: Vec<serde_json::Value> =
            serde_json::from_str(include_str!("../../tests/fixtures/window-title-cases.json"))
                .unwrap();
        assert!(cases.len() >= 20);
        for case in &cases {
            let title = case["title"].as_str().unwrap();
            assert_eq!(
                window_title(title),
                case["shown"].as_str().unwrap(),
                "{title:?}"
            );
        }
    }
}
#[cfg(test)]
mod detached_binding_lookup_tests {
    use super::detached_binding_label;
    #[test]
    fn original_self_lookup_and_main_owner_lookup_are_preserved() {
        assert_eq!(detached_binding_label("surface-1", None), Ok("surface-1"));
        assert_eq!(
            detached_binding_label("main", Some("surface-1")),
            Ok("surface-1")
        );
    }
    #[test]
    fn detached_callers_cannot_override_their_registered_label() {
        assert!(detached_binding_label("surface-1", Some("surface-2")).is_err());
        assert!(detached_binding_label("surface-1", Some("surface-1")).is_err());
    }
}
#[cfg(test)]
mod device_binding_admission_tests {
    use super::{admit_device_binding, Binding};
    use serde_json::json;
    const FACE: &str = "device:probe/face";
    const OTHER: &str = "device:probe/other";
    fn device(id: &str, reference: Option<&str>, family: &str, face: &str) -> Binding {
        serde_json::from_value(json!({
            "id": id,
            "kind": "device",
            "title": "Probe",
            "ref": reference,
            "device": {"family": family, "face": face, "aperture": {"day": null, "flow": null, "conversation": null, "instrument": null}},
        }))
        .unwrap()
    }
    #[test]
    fn a_device_is_admitted_with_its_matching_binding_id() {
        assert_eq!(
            admit_device_binding(&device(FACE, Some(FACE), "probe", "face")),
            Ok(())
        );
    }
    #[test]
    fn a_mismatched_device_binding_id_is_refused() {
        assert!(admit_device_binding(&device(OTHER, Some(OTHER), "probe", "face")).is_err());
        assert!(admit_device_binding(&device(FACE, None, "probe", "face")).is_err());
        assert!(admit_device_binding(&device(FACE, Some(OTHER), "probe", "face")).is_err());
        assert!(admit_device_binding(&device(FACE, Some(FACE), "", "face")).is_err());
        let mut without_identity = device(FACE, Some(FACE), "probe", "face");
        without_identity.device = None;
        assert!(admit_device_binding(&without_identity).is_err());
    }
}
#[tauri::command]
pub fn window_redock(app: AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "main" {
        return Err("The workspace window cannot re-dock itself".into());
    }
    crate::native_shell::admit_candidate_webview(&window)?;
    #[cfg(feature = "native_shell")]
    {
        let detached = app
            .state::<Windows>()
            .0
            .lock()
            .map_err(|_| "Window state unavailable")?
            .get(window.label())
            .cloned()
            .ok_or("This window has no detached binding")?;
        if detached.binding.kind == "browser" {
            crate::browser::return_to_main(&app, &detached.binding.id)?;
        }
        // The candidate receiver acknowledged its own document checkpoint
        // before this native owner release; preserve transfer failures above.
        window.destroy().map_err(|e| e.to_string())
    }
    #[cfg(not(feature = "native_shell"))]
    {
        let _ = app;
        window.close().map_err(|e| e.to_string())
    }
}
/// A Scene portal may return only its exact admitted detached Surface.
/// Closing follows the existing Destroyed -> window-redock lifecycle.
#[tauri::command]
pub fn window_redock_surface(
    app: AppHandle,
    window: Window,
    webview: tauri::Webview,
    workspace_id: String,
    surface_id: String,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Portal re-dock belongs to the workspace window".into());
    }
    crate::native_shell::admit_candidate_view(&webview)?;
    let label = app
        .state::<Windows>()
        .0
        .lock()
        .map_err(|_| "Window state unavailable")?
        .iter()
        .find(|(_, detached)| {
            detached.workspace_id == workspace_id && detached.binding.id == surface_id
        })
        .map(|(label, _)| label.clone())
        .ok_or("This workspace has no matching detached Surface")?;
    let target = app
        .get_webview_window(&label)
        .ok_or("The detached Surface window is no longer available")?;
    target.close().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn window_focus_subject(
    app: AppHandle,
    webview: tauri::Webview,
    reference: String,
) -> Result<bool, String> {
    crate::native_shell::admit_candidate_view(&webview)?;
    let label = app
        .state::<Windows>()
        .0
        .lock()
        .map_err(|_| "Window state unavailable")?
        .iter()
        .find(|(_, r)| r.binding.reference.as_deref() == Some(&reference))
        .map(|(k, _)| k.clone());
    if let Some(window) = label.and_then(|l| app.get_window(&l)) {
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn window_focus_main(
    app: AppHandle,
    window: Window,
    webview: tauri::Webview,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Workspace navigation focus belongs to the main window".into());
    }
    crate::native_shell::admit_candidate_view(&webview)?;
    app.get_window("main")
        .ok_or("Workspace window is unavailable")?
        .set_focus()
        .map_err(|error| error.to_string())
}
