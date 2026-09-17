//! Opt-in debug observation of presentation resources, never a product operation.
//! No paths, scripts, owner refs, user content or mutation requests are accepted.
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExpressionObservation {
    frames: u64,
    requests: u64,
    peak_emitters: usize,
    point_count: usize,
    ink: String,
    emitters: usize,
    forms: Vec<String>,
    scheduled: bool,
    paused: bool,
    reduced: bool,
    entries: usize,
}

#[tauri::command]
pub fn expression_walk_observation(
    webview: tauri::Webview,
    report: Option<ExpressionObservation>,
) -> Result<bool, String> {
    let enabled =
        cfg!(debug_assertions) && std::env::var("OI_CRADLE_NATIVE_WALK").as_deref() == Ok("1");
    if !enabled {
        return Ok(false);
    }
    if let Some(report) = report {
        let names = [
            "idle",
            "waiting",
            "listening",
            "searching",
            "presence",
            "arrival",
            "fire",
            "water",
            "air",
            "earth",
        ];
        if report.entries > 64
            || report.emitters > 64
            || report.forms.len() > 64
            || report.ink.len() > 128
            || report.point_count > 250_000
            || report
                .forms
                .iter()
                .any(|name| !names.contains(&name.as_str()))
        {
            return Err("Expression observation exceeds bounded presentation contract".into());
        }
        let time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_millis();
        eprintln!(
            "{}",
            serde_json::json!({
                "schema": "oi.native-expression-observation/v1",
                "unix_ms": time,
                "webview": webview.label(),
                "native_window": {
                    "scale_factor": webview.window().scale_factor().ok(),
                    "inner_size_physical": webview.window().inner_size().ok(),
                    "inner_position_physical": webview.window().inner_position().ok(),
                },
                "report": report,
            })
        );
    }
    Ok(true)
}
