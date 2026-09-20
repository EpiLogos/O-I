// The O:I owner position of the configuration registry (09 §4).
//
// The cradle kernel's registry read addresses this suite itself as owner
// `oi` through `<OI_BIN> config-contribution --json`. Before this verb the
// mount could only answer as a named degradation, so O:I's own world facts
// never reached the settings page live — the plane fell back to the
// fixture world or a wall of "unavailable" rows for settings that are in
// fact produced and disclosed here.
//
// Read-only by law: these facts are produced by the install and update
// flows, not chosen through a settings form. The contribution therefore
// refuses the plan/apply operations explicitly instead of faking
// changeability, and every setting carries `writable: false`.

fn config_contribution_setting(
    setting_ref: &str,
    section_ref: &str,
    title: &str,
    description: &str,
    native_ref: &str,
) -> serde_json::Value {
    serde_json::json!({
        "setting_ref": setting_ref,
        "section_ref": section_ref,
        "title": title,
        "description": description,
        "value_schema": { "type": "scalar" },
        "allowed_scopes": [{ "scope_kind": "world", "scope_ref": null }],
        "writable": false,
        "profileable": false,
        "sensitive": false,
        "default_semantics": "none",
        "effect": {
            "kind": "none",
            "summary": "Read-only disclosure of a fact this suite produces; nothing to re-apply.",
            "ref": null
        },
        "operations": { "validate": false, "plan": false, "apply": false, "reset": false },
        "native_ref": native_ref
    })
}

fn config_contribution_section(id: &str, title: &str, settings: Vec<serde_json::Value>) -> serde_json::Value {
    serde_json::json!({ "id": id, "title": title, "settings": settings })
}

fn config_contribution_document() -> Result<serde_json::Value, String> {

    let refused = |reason: &str| {
        serde_json::json!({ "availability": "unavailable", "reason": reason })
    };
    let read_only_reason = "read-only disclosure: these facts are produced by the install and update flows, not set through a settings form";

    Ok(serde_json::json!({
        "schema": "oi.configuration-contribution/v1",
        "contract_revision": "configuration-plane/contribution.1",
        "owner": {
            "owner_ref": "oi",
            "owner_kind": "oi",
            "owner_version": env!("CARGO_PKG_VERSION"),
            "contribution_command": ["oi", "config-contribution", "--json"],
            "disclosed_at_unix_ms": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|since| since.as_millis() as u64)
                .unwrap_or(0),
            "reading_digest": null,
            "reading_digest_covers": "07 §4.5 convention"
        },
        "about": "The suite itself: which executable runs, where the managed root lives, what build stands behind it, how the world is framed, and what the managed-update flow last applied.",
        "operations": {
            "transport": "cli/v1",
            "validate": refused(read_only_reason),
            "plan": refused(read_only_reason),
            "apply": refused(read_only_reason),
            "reset": refused(read_only_reason)
        },
        "availability": { "state": "available", "reason": null },
        "degradations": [],
        "obligations": [
            "These rows disclose produced facts; the flows that produce them (oi install, oi update, oi mode set) are the only writers."
        ],
        "sections": [
            config_contribution_section(
                "identity",
                "Suite identity",
                vec![
                    config_contribution_setting(
                        "oi:identity:suite-executable",
                        "identity",
                        "Suite executable",
                        "The oi executable this machine resolves for the suite's own commands.",
                        "current_exe",
                    ),
                    config_contribution_setting(
                        "oi:identity:managed-root",
                        "identity",
                        "Managed root",
                        "Where binaries, receipts and build caches live for this installation.",
                        "OI_DATA_HOME",
                    ),
                    config_contribution_setting(
                        "oi:identity:build-record",
                        "identity",
                        "Build record",
                        "The recorded suite build this installation stands on, with its standing.",
                        "suite manifest",
                    ),
                ],
            ),
            config_contribution_section(
                "composition",
                "World composition",
                vec![
                    config_contribution_setting(
                        "oi:composition:containing-frame",
                        "composition",
                        "Containing frame",
                        "The Context Frame that organises this world (oi mode set, #268).",
                        "current-world:context_frame.containing_frame",
                    ),
                    config_contribution_setting(
                        "oi:composition:install-mode",
                        "composition",
                        "Install mode",
                        "The effective install mode, when the frame discloses one; an explicit selection otherwise.",
                        "current-world:context_frame.install_mode",
                    ),
                    config_contribution_setting(
                        "oi:composition:present-positions",
                        "composition",
                        "Present positions",
                        "Which of the six product positions are present in the effective composition.",
                        "current-world:context_frame.present_positions",
                    ),
                ],
            ),
            config_contribution_section(
                "update",
                "Managed update",
                vec![
                    config_contribution_setting(
                        "oi:update:state",
                        "update",
                        "Update state",
                        "What the managed-update flow (oi update) last applied to this machine.",
                        "receipts/updates/active.json",
                    )
                ],
            )
        ]
    }))
}

fn command_config_contribution(args: &[OsString]) -> Result<i32, String> {
    for argument in args {
        let argument = argument.to_str().unwrap_or_default();
        if argument == "--json" {
            continue;
        }
        if argument == "--help" || argument == "-h" {
            println!("oi config-contribution --json");
            println!("    the O:I owner position of the configuration registry:");
            println!("    this suite's own world facts as a read-only contribution document.");
            return Ok(0);
        }
        return Err(format!(
            "unknown argument '{argument}'; oi config-contribution takes only --json"
        ));
    }
    let document = config_contribution_document()?;
    println!(
        "{}",
        serde_json::to_string_pretty(&document).map_err(|error| error.to_string())?
    );
    Ok(0)
}

// ---------------------------------------------------------------------------
// `oi system --json` — the O:I owner's v2 settings disclosure (07 §4.5).
//
// The configuration engine's resolution path reads each owner's `system`
// disclosure for the declared/effective/active axes of the settings its
// contribution names; the cradle's system census mounts the same document.
// Without this verb the O:I position answered nothing, so O:I's own settings
// could never reconcile live.

fn oi_world_facts() -> Result<serde_json::Value, String> {
    let suite_executable = std::env::current_exe()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| "unknown (the running executable could not be resolved)".to_owned());
    let managed_root = oi_data_root()?.display().to_string();
    let build_record = match suite_manifest() {
        Ok(manifest) => format!(
            "{} (recorded {}; {})",
            manifest.suite_version, manifest.recorded_at, manifest.standing
        ),
        Err(_) => "no recorded suite manifest found".to_owned(),
    };
    let world = oi_cli::current_world::live_current_world().ok();
    let frame = world.as_ref().map(|reading| &reading.context_frame);
    let containing_frame = frame
        .map(|frame| frame.containing_frame.clone())
        .unwrap_or_else(|| "not disclosed (the current-world reading was unavailable)".to_owned());
    let install_mode = frame
        .and_then(|frame| frame.install_mode.clone())
        .unwrap_or_else(|| "explicit selection — no characteristic composition matches".to_owned());
    let present_positions = frame
        .map(|frame| {
            frame
                .present_positions
                .iter()
                .map(|position| position.to_string())
                .collect::<Vec<_>>()
                .join(",")
        })
        .unwrap_or_else(|| "not disclosed".to_owned());
    let update_state = match oi_data_root()
        .ok()
        .and_then(|root| std::fs::read_to_string(root.join("receipts/updates/active.json")).ok())
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
    {
        Some(receipt) => {
            let channel = receipt
                .get("channel")
                .and_then(|value| value.as_str())
                .unwrap_or("unknown");
            let applied = receipt
                .get("applied_at_unix_seconds")
                .and_then(|value| value.as_i64())
                .map(|seconds| format!("applied at unix {seconds}"))
                .unwrap_or_else(|| "applied".to_owned());
            format!("managed updates active · channel {channel} · {applied}")
        }
        None => "no managed update applied yet; the recorded suite install stands".to_owned(),
    };
    Ok(serde_json::json!({
        "suite-executable": suite_executable,
        "managed-root": managed_root,
        "build-record": build_record,
        "containing-frame": containing_frame,
        "install-mode": install_mode,
        "present-positions": present_positions,
        "update-state": update_state,
    }))
}

fn oi_system_axis(declared: serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "declared": { "value": declared },
        "effective": { "value": declared },
        "active": { "value": declared },
        "staged": { "stage_state": "none" }
    })
}

fn oi_system_disclosure() -> Result<serde_json::Value, String> {
    let facts = oi_world_facts()?;
    let setting = |key: &str| {
        serde_json::json!({
            "key": key,
            "axes": oi_system_axis(facts.get(key).cloned().unwrap_or(serde_json::Value::Null))
        })
    };
    Ok(serde_json::json!({
        "schema": "oi.product-settings-disclosure/v2",
        "product_id": "oi",
        "availability": { "state": "available", "reason": null },
        "degradations": [],
        "sections": [
            {
                "id": "identity",
                "title": "Suite identity",
                "settings": [
                    setting("suite-executable"),
                    setting("managed-root"),
                    setting("build-record")
                ]
            },
            {
                "id": "composition",
                "title": "World composition",
                "settings": [
                    setting("containing-frame"),
                    setting("install-mode"),
                    setting("present-positions")
                ]
            },
            {
                "id": "update",
                "title": "Managed update",
                "settings": [setting("update-state")]
            }
        ],
        "observed_at_unix_ms": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|since| since.as_millis() as u64)
            .unwrap_or(0)
    }))
}

fn command_system(args: &[OsString]) -> Result<i32, String> {
    for argument in args {
        let argument = argument.to_str().unwrap_or_default();
        if argument == "--json" {
            continue;
        }
        return Err(format!(
            "unknown argument '{argument}'; oi system takes only --json"
        ));
    }
    println!(
        "{}",
        serde_json::to_string_pretty(&oi_system_disclosure()?)
            .map_err(|error| error.to_string())?
    );
    Ok(0)
}
