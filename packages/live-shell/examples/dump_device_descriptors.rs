//! Dump every live-dynamics parameter table as the /api/device-descriptors
//! JSON shape — the fixture-data source for the UI walk.
//!
//! Usage: cargo run -p live-shell --example dump_device_descriptors > \
//!          packages/live-shell/ui/tests/support/deviceDescriptors.json
//!
//! The UI walk's fixture serves this file so every device face resolves its
//! rows exactly as the real server would (the fixture's hand-written subset
//! stays as the fallback for the three seam-proving devices).

use live_dynamics::params::{table, table_keys, ParamKind};

fn main() {
    let mut out = serde_json::Map::new();
    for key in table_keys() {
        let Some(rows) = table(key) else { continue };
        let json_rows: Vec<serde_json::Value> = rows
            .iter()
            .map(|d| {
                let (kind, labels) = match &d.kind {
                    ParamKind::Continuous => ("continuous", None),
                    ParamKind::Discrete { labels } => (
                        "discrete",
                        Some(labels.iter().map(|l| l.to_string()).collect::<Vec<_>>()),
                    ),
                    ParamKind::Toggle => ("toggle", None),
                };
                let mut obj = serde_json::json!({
                    "id": d.id,
                    "ui_name": d.ui_name,
                    "stored_min": d.stored_min,
                    "stored_max": d.stored_max,
                    "unit": d.unit,
                    "kind": kind,
                    "notes": d.notes,
                });
                if let Some(labels) = labels {
                    obj["labels"] = serde_json::json!(labels);
                }
                obj
            })
            .collect();
        out.insert(key.to_string(), serde_json::Value::Array(json_rows));
    }
    println!(
        "{}",
        serde_json::to_string_pretty(&serde_json::Value::Object(out)).unwrap()
    );
}
