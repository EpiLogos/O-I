/// O:I's narrow desktop route into AIKit's Bimba projection.
///
/// O:I does not persist a parallel map-selection record. AIKit owns selection
/// and native harness projection; this command only exposes that owner through
/// the Omarchy menu and keeps its JSON compact for the QML process seam.
fn bimba_map_main() -> Option<ExitCode> {
    let args = env::args_os().skip(1).collect::<Vec<_>>();
    if args.first().and_then(|value| value.to_str()) != Some("bimba-map") {
        return None;
    }
    let (operation, json_mode) = match args.as_slice() {
        [_, operation] => (operation.to_str(), false),
        [_, operation, flag] if flag == "--json" => (operation.to_str(), true),
        _ => {
            eprintln!("oi: usage: oi bimba-map status|select|deselect [--json]");
            return Some(ExitCode::from(2));
        }
    };
    let Some(operation) = operation else {
        eprintln!("oi: Bimba map operation must be UTF-8");
        return Some(ExitCode::from(2));
    };
    if !matches!(operation, "status" | "select" | "deselect") {
        eprintln!("oi: usage: oi bimba-map status|select|deselect [--json]");
        return Some(ExitCode::from(2));
    }

    match bimba_map_read(operation) {
        Ok(reading) => {
            if json_mode {
                match serde_json::to_string(&reading) {
                    Ok(encoded) => println!("{encoded}"),
                    Err(error) => {
                        eprintln!("oi: cannot encode Bimba map reading: {error}");
                        return Some(ExitCode::from(2));
                    }
                }
            } else {
                println!(
                    "Bimba map: {}",
                    if reading["active"] == serde_json::json!(true) {
                        "active"
                    } else {
                        "inactive"
                    }
                );
                println!(
                    "Selected: {}",
                    reading["selected"] == serde_json::json!(true)
                );
                println!(
                    "Map healthy: {}",
                    reading["map"]["healthy"] == serde_json::json!(true)
                );
                let projected = reading["native_clients"]["projected"]
                    .as_array()
                    .map(|clients| {
                        clients
                            .iter()
                            .filter_map(serde_json::Value::as_str)
                            .collect::<Vec<_>>()
                            .join(", ")
                    })
                    .unwrap_or_default();
                println!(
                    "Native clients: {}",
                    if projected.is_empty() {
                        "none"
                    } else {
                        &projected
                    }
                );
            }
            Some(ExitCode::SUCCESS)
        }
        Err(message) => {
            eprintln!("oi: {message}");
            Some(ExitCode::from(2))
        }
    }
}

fn bimba_map_read(operation: &str) -> Result<serde_json::Value, String> {
    let output = Command::new("aikit")
        .args(["--json", "mcp", "bimba-map", operation])
        .output()
        .map_err(|error| format!("cannot invoke AIKit Bimba projection: {error}"))?;
    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("AIKit Bimba projection returned invalid JSON: {error}"))?;
    if !output.status.success() || value["ok"] != serde_json::json!(true) {
        let detail = value["error"]["message"]
            .as_str()
            .or_else(|| value["error"].as_str())
            .unwrap_or("AIKit rejected the Bimba projection operation");
        return Err(detail.to_owned());
    }
    value
        .get("data")
        .cloned()
        .ok_or_else(|| "AIKit Bimba projection returned no data".to_owned())
}
