const OMARCHY_HOST_SCHEMA: &str = "oi.omarchy-host/v1";
const OMARCHY_PLUGIN_ID: &str = "oi.reference-world";
const OMARCHY_CONFORMANCE_REVISION: &str = "b71dcad96e9d0b2962b7d225828a5cb6000ad720";
const OMARCHY_MANIFEST: &str = include_str!("../../integrations/omarchy/oi.reference-world/manifest.json");
const OMARCHY_SERVICE: &str = include_str!("../../integrations/omarchy/oi.reference-world/Service.qml");
const OMARCHY_BAR_WIDGET: &str = include_str!("../../integrations/omarchy/oi.reference-world/BarWidget.qml");
const OMARCHY_PANEL: &str = include_str!("../../integrations/omarchy/oi.reference-world/Panel.qml");

#[derive(Debug, Clone, Serialize)]
struct OmarchyHostReceipt {
    schema: String,
    phase: String,
    conformance_source: String,
    conformance_revision: String,
    runtime_version: Option<String>,
    plugin_id: String,
    plugin_dir: String,
    plugin_state: String,
    plugin_discovered: bool,
    plugin_enabled: bool,
    shell_ping: Option<String>,
    current_world_available: bool,
    herdr_available: bool,
    hyprland_available: bool,
    changes: Vec<String>,
    warnings: Vec<String>,
    verified: bool,
}

fn omarchy_host_main() -> Option<ExitCode> {
    let args = env::args_os().skip(1).collect::<Vec<_>>();
    if args.first().and_then(|value| value.to_str()) != Some("host")
        || args.get(1).and_then(|value| value.to_str()) != Some("omarchy")
    {
        return None;
    }

    let operation = args.get(2).and_then(|value| value.to_str()).unwrap_or("inspect");
    let json_mode = match args.get(3..) {
        Some([]) | None => false,
        Some([flag]) if flag.to_str() == Some("--json") => true,
        _ => {
            eprintln!("oi: usage: oi host omarchy [inspect|plan|install|verify] [--json]");
            return Some(ExitCode::from(2));
        }
    };

    let result = match operation {
        "inspect" => inspect_omarchy_host("inspect"),
        "plan" => plan_omarchy_host(),
        "install" => install_omarchy_host(),
        "verify" => verify_omarchy_host(),
        _ => Err(format!(
            "unknown Omarchy host operation '{operation}'; expected inspect, plan, install, or verify"
        )),
    };

    Some(match result {
        Ok(receipt) => {
            if json_mode {
                match serde_json::to_string_pretty(&receipt) {
                    Ok(value) => println!("{value}"),
                    Err(error) => {
                        eprintln!("oi: cannot encode Omarchy host receipt: {error}");
                        return Some(ExitCode::from(2));
                    }
                }
            } else {
                print_omarchy_host_receipt(&receipt);
            }
            if operation == "verify" && !receipt.verified {
                ExitCode::from(1)
            } else {
                ExitCode::SUCCESS
            }
        }
        Err(message) => {
            eprintln!("oi: {message}");
            ExitCode::from(2)
        }
    })
}

fn embedded_omarchy_plugin_files() -> [(&'static str, &'static str); 4] {
    [
        ("manifest.json", OMARCHY_MANIFEST),
        ("Service.qml", OMARCHY_SERVICE),
        ("BarWidget.qml", OMARCHY_BAR_WIDGET),
        ("Panel.qml", OMARCHY_PANEL),
    ]
}

fn omarchy_plugin_dir() -> Result<PathBuf, String> {
    let home = env::var_os("HOME").ok_or_else(|| "HOME is not set".to_owned())?;
    Ok(PathBuf::from(home)
        .join(".config/omarchy/plugins")
        .join(OMARCHY_PLUGIN_ID))
}

fn executable_on_path(name: &str) -> bool {
    let Some(path) = env::var_os("PATH") else {
        return false;
    };
    env::split_paths(&path).any(|directory| {
        let candidate = directory.join(name);
        candidate.is_file()
    })
}

fn omarchy_capture(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|error| format!("cannot run {program}: {error}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(format!(
            "{} {} failed with {}{}",
            program,
            args.join(" "),
            output.status,
            if detail.is_empty() { String::new() } else { format!(": {detail}") }
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn omarchy_plugin_state(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Ok("absent".to_owned());
    }
    if !path.is_dir() {
        return Ok("drift".to_owned());
    }

    let expected = embedded_omarchy_plugin_files();
    for (relative, content) in expected {
        let file = path.join(relative);
        if !file.is_file() {
            return Ok("drift".to_owned());
        }
        let actual = fs::read_to_string(&file)
            .map_err(|error| format!("cannot read {}: {error}", file.display()))?;
        if actual != content {
            return Ok("drift".to_owned());
        }
    }

    let mut names = fs::read_dir(path)
        .map_err(|error| format!("cannot inspect {}: {error}", path.display()))?
        .map(|entry| {
            entry
                .map_err(|error| error.to_string())
                .and_then(|entry| entry.file_name().into_string().map_err(|_| "non-UTF-8 plugin filename".to_owned()))
        })
        .collect::<Result<Vec<_>, _>>()?;
    names.sort();
    let mut expected_names = embedded_omarchy_plugin_files()
        .iter()
        .map(|(name, _)| (*name).to_owned())
        .collect::<Vec<_>>();
    expected_names.sort();
    if names != expected_names {
        return Ok("drift".to_owned());
    }
    Ok("exact".to_owned())
}

fn omarchy_plugin_listing() -> Result<(bool, bool), String> {
    if !executable_on_path("omarchy") || !executable_on_path("omarchy-shell") {
        return Ok((false, false));
    }
    let raw = omarchy_capture("omarchy", &["plugin", "list", "--json"])?;
    let value: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|error| format!("Omarchy plugin list is not JSON: {error}"))?;
    let entries = value
        .as_array()
        .ok_or_else(|| "Omarchy plugin list must be a JSON array".to_owned())?;
    let entry = entries.iter().find(|entry| {
        entry.get("id").and_then(serde_json::Value::as_str) == Some(OMARCHY_PLUGIN_ID)
    });
    Ok(match entry {
        Some(entry) => (
            true,
            entry.get("enabled").and_then(serde_json::Value::as_bool) == Some(true),
        ),
        None => (false, false),
    })
}

fn inspect_omarchy_host(phase: &str) -> Result<OmarchyHostReceipt, String> {
    let plugin_dir = omarchy_plugin_dir()?;
    let plugin_state = omarchy_plugin_state(&plugin_dir)?;
    let runtime_version = if executable_on_path("omarchy-version") {
        omarchy_capture("omarchy-version", &[]).ok()
    } else {
        None
    };
    let shell_ping = if executable_on_path("omarchy-shell") {
        omarchy_capture("omarchy-shell", &["shell", "ping"]).ok()
    } else {
        None
    };
    let (plugin_discovered, plugin_enabled) = omarchy_plugin_listing().unwrap_or((false, false));
    let current_world_available = oi_cli::current_world::live_current_world().is_ok();
    let mut warnings = Vec::new();
    if !executable_on_path("omarchy") {
        warnings.push("Omarchy CLI is unavailable on this host.".to_owned());
    }
    if !executable_on_path("omarchy-shell") {
        warnings.push("Omarchy shell IPC wrapper is unavailable on this host.".to_owned());
    }
    if plugin_state == "drift" {
        warnings.push(
            "Existing oi.reference-world plugin differs from the embedded O:I contribution; installation will refuse to overwrite it."
                .to_owned(),
        );
    }
    Ok(OmarchyHostReceipt {
        schema: OMARCHY_HOST_SCHEMA.to_owned(),
        phase: phase.to_owned(),
        conformance_source: "omacom/omarchy@quattro".to_owned(),
        conformance_revision: OMARCHY_CONFORMANCE_REVISION.to_owned(),
        runtime_version,
        plugin_id: OMARCHY_PLUGIN_ID.to_owned(),
        plugin_dir: plugin_dir.display().to_string(),
        plugin_state: plugin_state.clone(),
        plugin_discovered,
        plugin_enabled,
        shell_ping: shell_ping.clone(),
        current_world_available,
        herdr_available: executable_on_path("herdr"),
        hyprland_available: executable_on_path("hyprctl"),
        changes: Vec::new(),
        warnings,
        verified: plugin_state == "exact"
            && plugin_discovered
            && plugin_enabled
            && shell_ping.as_deref() == Some("ok")
            && current_world_available,
    })
}

fn plan_omarchy_host() -> Result<OmarchyHostReceipt, String> {
    let mut receipt = inspect_omarchy_host("plan")?;
    receipt.changes = match receipt.plugin_state.as_str() {
        "absent" => vec![
            "stage the embedded oi.reference-world plugin outside the live plugin directory".to_owned(),
            "validate staged plugin through `omarchy plugin validate`".to_owned(),
            "atomically place it under ~/.config/omarchy/plugins/oi.reference-world".to_owned(),
            "ask omarchy-shell to rescan plugins".to_owned(),
            "enable oi.reference-world through `omarchy plugin enable ... --section left`".to_owned(),
            "verify discovery, enabled state, shell IPC and canonical O:I current-world reading".to_owned(),
        ],
        "exact" if !receipt.plugin_enabled => vec![
            "validate the existing exact O:I plugin".to_owned(),
            "ask omarchy-shell to rescan plugins".to_owned(),
            "enable oi.reference-world through the public Omarchy plugin command".to_owned(),
            "verify returned host state".to_owned(),
        ],
        "exact" => vec!["verify returned host state; no plugin bytes need to change".to_owned()],
        _ => vec![
            "stop before mutation: existing oi.reference-world bytes require human/owner reconciliation"
                .to_owned(),
        ],
    };
    Ok(receipt)
}

fn install_omarchy_host() -> Result<OmarchyHostReceipt, String> {
    if !executable_on_path("omarchy") {
        return Err("Omarchy CLI is required for native host installation".to_owned());
    }
    if !executable_on_path("omarchy-shell") {
        return Err("running Omarchy shell IPC is required for native host installation".to_owned());
    }
    let target = omarchy_plugin_dir()?;
    let state = omarchy_plugin_state(&target)?;
    if state == "drift" {
        return Err(format!(
            "refusing to overwrite existing user-owned plugin bytes at {}; inspect/reconcile them first",
            target.display()
        ));
    }

    let mut changes = Vec::new();
    if state == "absent" {
        let parent = target
            .parent()
            .ok_or_else(|| "Omarchy plugin directory has no parent".to_owned())?;
        fs::create_dir_all(parent)
            .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();
        let stage = parent.join(format!(".{OMARCHY_PLUGIN_ID}.stage-{nonce}"));
        fs::create_dir(&stage)
            .map_err(|error| format!("cannot create staged plugin {}: {error}", stage.display()))?;
        for (relative, content) in embedded_omarchy_plugin_files() {
            fs::write(stage.join(relative), content)
                .map_err(|error| format!("cannot stage {relative}: {error}"))?;
        }
        let stage_text = stage
            .to_str()
            .ok_or_else(|| "Omarchy stage path is not UTF-8".to_owned())?;
        if let Err(error) = omarchy_capture("omarchy", &["plugin", "validate", stage_text]) {
            let _ = fs::remove_dir_all(&stage);
            return Err(error);
        }
        fs::rename(&stage, &target).map_err(|error| {
            format!(
                "cannot atomically install O:I plugin {} -> {}: {error}",
                stage.display(),
                target.display()
            )
        })?;
        changes.push(format!("installed exact embedded plugin at {}", target.display()));
    }

    let target_text = target
        .to_str()
        .ok_or_else(|| "Omarchy plugin path is not UTF-8".to_owned())?;
    omarchy_capture("omarchy", &["plugin", "validate", target_text])?;
    omarchy_capture("omarchy-shell", &["shell", "rescanPlugins"])?;
    omarchy_capture(
        "omarchy",
        &["plugin", "enable", OMARCHY_PLUGIN_ID, "--section", "left"],
    )?;
    changes.push("validated, rescanned and enabled through public Omarchy operations".to_owned());

    let mut receipt = inspect_omarchy_host("install")?;
    receipt.changes = changes;
    if !receipt.verified {
        receipt.warnings.push(
            "Installation returned without a complete host verification; run `oi host omarchy verify --json` and inspect the returned facts."
                .to_owned(),
        );
    }
    Ok(receipt)
}

fn verify_omarchy_host() -> Result<OmarchyHostReceipt, String> {
    let mut receipt = inspect_omarchy_host("verify")?;
    if receipt.plugin_state == "exact" && executable_on_path("omarchy") {
        let plugin_dir = omarchy_plugin_dir()?;
        if let Some(path) = plugin_dir.to_str() {
            if let Err(error) = omarchy_capture("omarchy", &["plugin", "validate", path]) {
                receipt.warnings.push(error);
                receipt.verified = false;
            }
        }
    }
    if !receipt.plugin_discovered {
        receipt.warnings.push("Omarchy does not currently disclose oi.reference-world in its plugin catalog.".to_owned());
    }
    if !receipt.plugin_enabled {
        receipt.warnings.push("Omarchy reports oi.reference-world disabled.".to_owned());
    }
    if receipt.shell_ping.as_deref() != Some("ok") {
        receipt.warnings.push("omarchy-shell did not return the expected `ok` health result.".to_owned());
    }
    if !receipt.current_world_available {
        receipt.warnings.push("O:I current-world reading is unavailable to the native shell contribution.".to_owned());
    }
    Ok(receipt)
}

fn print_omarchy_host_receipt(receipt: &OmarchyHostReceipt) {
    println!("{{O:I}} Omarchy host · {}", receipt.phase);
    println!("Conformance source: {}@{}", receipt.conformance_source, receipt.conformance_revision);
    println!("Plugin: {} [{}]", receipt.plugin_id, receipt.plugin_state);
    println!("Location: {}", receipt.plugin_dir);
    println!("Discovered: {}", if receipt.plugin_discovered { "yes" } else { "no" });
    println!("Enabled: {}", if receipt.plugin_enabled { "yes" } else { "no" });
    println!("Shell IPC: {}", receipt.shell_ping.as_deref().unwrap_or("unavailable"));
    println!("Current World: {}", if receipt.current_world_available { "available" } else { "unavailable" });
    println!("Herdr: {}", if receipt.herdr_available { "available" } else { "unavailable" });
    println!("Hyprland: {}", if receipt.hyprland_available { "available" } else { "unavailable" });
    if !receipt.changes.is_empty() {
        println!("Changes:");
        for change in &receipt.changes {
            println!("  - {change}");
        }
    }
    for warning in &receipt.warnings {
        println!("warning: {warning}");
    }
    println!("Verified: {}", if receipt.verified { "yes" } else { "no" });
}

#[cfg(test)]
mod omarchy_host_tests {
    use super::*;

    fn fixture(name: &str) -> PathBuf {
        let root = env::temp_dir().join(format!(
            "oi-omarchy-{name}-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn embedded_manifest_is_current_omarchy_schema_and_non_reserved() {
        let manifest: serde_json::Value = serde_json::from_str(OMARCHY_MANIFEST).unwrap();
        assert_eq!(manifest["schemaVersion"], 1);
        assert_eq!(manifest["id"], OMARCHY_PLUGIN_ID);
        assert!(!OMARCHY_PLUGIN_ID.starts_with("omarchy."));
        let kinds = manifest["kinds"].as_array().unwrap();
        for expected in ["service", "bar-widget", "panel"] {
            assert!(kinds.iter().any(|kind| kind.as_str() == Some(expected)));
        }
        assert_eq!(manifest["entryPoints"]["service"], "Service.qml");
        assert_eq!(manifest["entryPoints"]["barWidget"], "BarWidget.qml");
        assert_eq!(manifest["entryPoints"]["panel"], "Panel.qml");
    }

    #[test]
    fn plugin_state_distinguishes_absent_exact_and_user_drift() {
        let root = fixture("state");
        let target = root.join(OMARCHY_PLUGIN_ID);
        assert_eq!(omarchy_plugin_state(&target).unwrap(), "absent");
        fs::create_dir(&target).unwrap();
        for (relative, content) in embedded_omarchy_plugin_files() {
            fs::write(target.join(relative), content).unwrap();
        }
        assert_eq!(omarchy_plugin_state(&target).unwrap(), "exact");
        fs::write(target.join("Panel.qml"), "// human edit\n").unwrap();
        assert_eq!(omarchy_plugin_state(&target).unwrap(), "drift");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn plugin_state_treats_extra_user_material_as_drift() {
        let root = fixture("extra");
        let target = root.join(OMARCHY_PLUGIN_ID);
        fs::create_dir(&target).unwrap();
        for (relative, content) in embedded_omarchy_plugin_files() {
            fs::write(target.join(relative), content).unwrap();
        }
        fs::write(target.join("local-note.txt"), "keep me\n").unwrap();
        assert_eq!(omarchy_plugin_state(&target).unwrap(), "drift");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn conformance_revision_is_source_pinned() {
        assert_eq!(
            OMARCHY_CONFORMANCE_REVISION,
            "b71dcad96e9d0b2962b7d225828a5cb6000ad720"
        );
    }
}
