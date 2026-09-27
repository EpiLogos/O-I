//! `oi dev world up` — bring the Development World up through its native
//! owners, idempotently.
//!
//! O:I resolves the machine-local carrier and composes one ordinary entry;
//! every materialising step is delegated to the product that owns it: AIKit
//! owns the SessionSpace and the working-surface state machine, Herdr and
//! tmux own their own places. This module never talks to a provider's wire
//! protocol and never invents canonical identity — it runs the same verbs an
//! agent would run, in the order the SessionSpace application contract
//! requires (attach-surface → bind-native-reference → bind-working-surface →
//! open), and reports what was created versus reused.
//!
//! Re-running is the warm entry: existing state is reused, a dead provider
//! place is recovered through the same `open` that created it, and nothing
//! duplicates.

use serde::Serialize;
use std::process::{Command, Stdio};
use std::time::Duration;

use crate::dev_world::{resolve_dev_world_setup, DevWorldSetup};

pub const DEV_WORLD_UP_SCHEMA: &str = "oi.dev-world-up/v1";

/// The canonical binding set this launcher owns. One rich-provider surface
/// for the world's parent subject; the tmux floor carries the full window
/// layout through the delegated `aikit session up`.
pub const HERDR_BINDING: &str = "working-surface/herdr/world";
pub const HERDR_SURFACE: &str = "surface/terminal/world/parent-shell";
pub const HERDR_PLAN_ID: &str = "oi-development-herdr";
pub const PARENT_AGENT_SESSION: &str = "agent-session/epilogos/oi-parent-pi";

#[derive(Debug, Clone, Serialize)]
pub struct DevWorldUpReport {
    pub schema: String,
    pub world: String,
    pub session_space: String,
    pub session_space_created: bool,
    pub session_space_revision: Option<u64>,
    pub herdr: ProviderUpReport,
    pub floor: FloorUpReport,
    pub canonical: CanonicalDisclosure,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderUpReport {
    pub provider: String,
    pub daemon: String,
    pub binding_created: bool,
    pub open_outcome: String,
    pub live_native_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FloorUpReport {
    pub provider: String,
    pub up_outcome: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CanonicalDisclosure {
    pub session_space: String,
    pub herdr_surface: String,
    pub herdr_binding: String,
    pub parent_agent_session: String,
}

/// Bring the world up. `provider_override` selects the rich provider
/// (defaulting to the machine config's `providers.default`); the portable
/// floor always comes up unless `skip_floor`.
pub fn dev_world_up(
    ground: &std::path::Path,
    provider_override: Option<&str>,
    skip_floor: bool,
) -> Result<DevWorldUpReport, String> {
    let setup = resolve_dev_world_setup(ground)?;
    let mut warnings = Vec::new();

    let provider = provider_override
        .map(str::to_owned)
        .unwrap_or_else(|| setup.providers.default.clone());
    if provider != "herdr" {
        return Err(format!(
            "provider `{provider}` has no dev-world materialisation in this build; the rich provider is `herdr` and the portable floor is `{}`",
            setup.providers.floor
        ));
    }

    let herdr_bin = setup
        .providers
        .binaries
        .get("herdr")
        .cloned()
        .unwrap_or_else(|| "herdr".to_owned());

    // 1. The provider daemon. A dead socket is the ordinary cold machine:
    // start the server detached and wait for its snapshot to answer.
    let daemon = ensure_herdr_daemon(&herdr_bin, &mut warnings)?;

    // 2. The SessionSpace: create when absent, restore the authored carrier
    // seed into it, reuse everything that already exists.
    let (space_created, space_revision) = ensure_session_space(&setup, &mut warnings)?;

    // 3. The rich-provider working surface: bind when unbound, then open.
    // Open is create-or-attach for the provider: a recorded live place is
    // reused, a gone place is recreated — the recovery path and the cold
    // path are the same act.
    let (binding_created, open_outcome, live_native_id) =
        ensure_herdr_surface(&setup, &mut warnings)?;

    // 4. The portable floor: the token-resolved SessionSpec through
    // `aikit session up`, whose CreateOrAttach mode never re-runs a live
    // pane and never removes hand splits.
    let mut floor_outcome = "skipped".to_owned();
    if !skip_floor {
        let mut floor_argv = setup.delegate_session_up.clone();
        if !floor_argv.iter().any(|arg| arg == "--json") {
            floor_argv.push("--json".to_owned());
        }
        floor_outcome = run_delegated_visible(&floor_argv)?;
    }

    Ok(DevWorldUpReport {
        schema: DEV_WORLD_UP_SCHEMA.to_owned(),
        world: setup.world.clone(),
        session_space: setup.session_space.clone(),
        session_space_created: space_created,
        session_space_revision: space_revision,
        herdr: ProviderUpReport {
            provider,
            daemon,
            binding_created,
            open_outcome,
            live_native_id,
        },
        floor: FloorUpReport {
            provider: setup.providers.floor.clone(),
            up_outcome: floor_outcome,
        },
        canonical: CanonicalDisclosure {
            session_space: setup.session_space.clone(),
            herdr_surface: HERDR_SURFACE.to_owned(),
            herdr_binding: HERDR_BINDING.to_owned(),
            parent_agent_session: PARENT_AGENT_SESSION.to_owned(),
        },
        warnings,
    })
}

/// Probe the provider snapshot; when the socket is dead, start the server
/// detached and poll until it answers. Returns the daemon disclosure.
fn ensure_herdr_daemon(herdr_bin: &str, warnings: &mut Vec<String>) -> Result<String, String> {
    if herdr_answers(herdr_bin) {
        return Ok("already-running".to_owned());
    }
    // Detached daemon start: the server outlives this command either way.
    Command::new(herdr_bin)
        .arg("server")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            format!("cannot start {herdr_bin} server: {error}; start it by hand and re-run")
        })?;
    for _ in 0..20 {
        std::thread::sleep(Duration::from_millis(250));
        if herdr_answers(herdr_bin) {
            return Ok("started".to_owned());
        }
    }
    warnings.push(format!(
        "{herdr_bin} server was started but its snapshot has not answered yet; the surface open below will name it if it is still absent"
    ));
    Ok("started-unverified".to_owned())
}

fn herdr_answers(herdr_bin: &str) -> bool {
    Command::new(herdr_bin)
        .args(["api", "snapshot"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .map(|out| {
            out.status.success()
                && String::from_utf8_lossy(&out.stdout).contains("\"session_snapshot\"")
        })
        .unwrap_or(false)
}

/// Create the SessionSpace when absent and restore the authored carrier seed.
/// Returns (created, revision-after-ensure).
fn ensure_session_space(
    setup: &DevWorldSetup,
    warnings: &mut Vec<String>,
) -> Result<(bool, Option<u64>), String> {
    if run_capture(&format!(
        "aikit session-space show {}",
        setup.session_space
    ))
    .is_ok()
    {
        return Ok((false, read_space_revision(setup, warnings)));
    }
    // Create stages and applies one reviewed preview each; these are the
    // same verbs an agent runs, composed by the launcher.
    let staged_create = run_capture(&format!(
        "aikit session-space create {}",
        setup.session_space
    ))?;
    let create_preview_path = temp_preview("oi-dev-world-create", &staged_create)?;
    run_capture_quiet(&format!(
        "aikit session-space apply --preview-json @{}",
        create_preview_path.display()
    ))?;

    let seed_text = std::fs::read_to_string(&setup.carrier_session_space).map_err(|error| {
        format!(
            "cannot read carrier SessionSpace seed {}: {error}",
            setup.carrier_session_space
        )
    })?;
    let seed: serde_json::Value = serde_json::from_str(&seed_text)
        .map_err(|error| format!("carrier SessionSpace seed is not valid JSON: {error}"))?;
    let restore_intent = serde_json::json!({
        "operation": "restore",
        "target": seed,
        "evidence": "O:I Development World carrier seed applied by `oi dev world up`",
    });
    let intent_path = temp_preview("oi-dev-world-restore-intent", &restore_intent.to_string())?;
    let staged_restore = run_capture(&format!(
        "aikit session-space stage --space {} --operation restore --intent-json @{}",
        setup.session_space,
        intent_path.display()
    ))?;
    let restore_preview_path = temp_preview("oi-dev-world-restore", &staged_restore)?;
    run_capture_quiet(&format!(
        "aikit session-space apply --preview-json @{}",
        restore_preview_path.display()
    ))?;
    Ok((true, read_space_revision(setup, warnings)))
}

/// Bind the rich-provider working surface when unbound, then open it.
/// Returns (binding-created, open-outcome, live native id).
fn ensure_herdr_surface(
    setup: &DevWorldSetup,
    warnings: &mut Vec<String>,
) -> Result<(bool, String, Option<String>), String> {
    let show_text = run_capture(&format!(
        "aikit session-space show {}",
        setup.session_space
    ))?;
    let show: serde_json::Value = serde_json::from_str(&show_text)
        .map_err(|error| format!("SessionSpace show returned invalid JSON: {error}"))?;
    let bound = show
        .pointer("/working_surfaces")
        .and_then(|value| value.get(HERDR_BINDING))
        .is_some();

    if !bound {
        let oi_root = setup
            .projects
            .get("o-i")
            .ok_or_else(|| "machine config has no `o-i` project checkout root".to_owned())?
            .clone();
        for (name, operation, provider_flag, intent) in herdr_bind_intents(&oi_root)? {
            let intent_path = temp_preview(&format!("oi-dev-world-{name}-intent"), &intent)?;
            let staged = run_capture(&format!(
                "aikit session-space stage --space {} --operation {operation} --intent-json @{}{provider_flag}",
                setup.session_space,
                intent_path.display()
            ))?;
            let preview_path = temp_preview(&format!("oi-dev-world-{name}"), &staged)?;
            run_capture_quiet(&format!(
                "aikit session-space apply --preview-json @{}",
                preview_path.display()
            ))?;
        }
    }

    let open_text = run_capture(&format!(
        "aikit session-space working-surface open {} {HERDR_BINDING}",
        setup.session_space
    ))?;
    let open: serde_json::Value = serde_json::from_str(&open_text)
        .map_err(|error| format!("working-surface open returned invalid JSON: {error}"))?;
    let outcome = open
        .pointer("/outcome/outcome")
        .and_then(|value| value.as_str())
        .unwrap_or("unknown")
        .to_owned();
    let live_native_id = open
        .pointer("/outcome/native_id")
        .and_then(|value| value.as_str())
        .map(str::to_owned);
    if outcome == "not-exposed" {
        let reason = open
            .pointer("/outcome/reason")
            .and_then(|value| value.as_str())
            .unwrap_or("no reason given");
        warnings.push(format!("surface open did not expose a live pane: {reason}"));
    }
    Ok((!bound, outcome, live_native_id))
}

/// The three staged intents the SessionSpace application contract requires,
/// in order, built from machine-local facts only.
fn herdr_bind_intents(
    oi_root: &str,
) -> Result<Vec<(&'static str, &'static str, &'static str, String)>, String> {
    let shell = world_shell();
    let attach = serde_json::json!({
        "operation": "attach-surface",
        "attachment": {
            "surface": HERDR_SURFACE,
            "purpose": "Herdr working surface of the O:I development world's parent subject",
            "provenance": ["oi dev world up"],
        },
    });
    let native = serde_json::json!({
        "operation": "bind-native-reference",
        "binding": {
            "reference": "provider/herdr/current",
            "kind": "provider",
            "purpose": "the current Herdr working-environment provider on this Workcell",
            "provenance": ["oi dev world up"],
        },
    });
    let bind = serde_json::json!({
        "operation": "bind-working-surface",
        "binding": {
            "binding": HERDR_BINDING,
            "surface": HERDR_SURFACE,
            "agent_session": PARENT_AGENT_SESSION,
            "provider": "provider/herdr/current",
            "plan": {
                "id": HERDR_PLAN_ID,
                "name": "oi-development (Herdr)",
                "root": oi_root,
                "mux": "herdr",
                "attach": "always",
                "lifecycle": "persist",
                "capabilities": {},
                "views": [{
                    "id": "world",
                    "steps": [{
                        "pane": "parent-shell",
                        "view": "world",
                        "capabilities": {},
                        "command": [shell, "-c",
                            format!("echo 'oi-development · world — O:I parent shell'; exec {shell}")],
                        "focus": true,
                        "restart": "never",
                    }],
                }],
                "backend_extensions": {},
                "warnings": [],
            },
            "plan_key": "world/parent-shell",
            "provenance": ["oi dev world up"],
        },
    });
    Ok(vec![
        ("attach", "attach-surface", "", json_string(&attach)?),
        ("native", "bind-native-reference", "", json_string(&native)?),
        ("bind", "bind-working-surface", " --provider herdr", json_string(&bind)?),
    ])
}

fn world_shell() -> &'static str {
    if cfg!(target_os = "macos") {
        "/bin/zsh"
    } else {
        "/bin/bash"
    }
}

fn json_string(value: &serde_json::Value) -> Result<String, String> {
    serde_json::to_string(value).map_err(|error| format!("cannot encode intent: {error}"))
}

fn read_space_revision(setup: &DevWorldSetup, warnings: &mut Vec<String>) -> Option<u64> {
    let text = match run_capture(&format!(
        "aikit session-space show {}",
        setup.session_space
    )) {
        Ok(text) => text,
        Err(error) => {
            warnings.push(format!("cannot re-read the SessionSpace after ensure: {error}"));
            return None;
        }
    };
    let value: serde_json::Value = match serde_json::from_str(&text) {
        Ok(value) => value,
        Err(_) => return None,
    };
    value.get("revision").and_then(|value| value.as_u64())
}

/// Run a delegated argv list so the human sees the native owner's own words
/// in their terminal; returns its outcome fact.
fn run_delegated_visible(argv: &[String]) -> Result<String, String> {
    let output = Command::new(&argv[0])
        .args(&argv[1..])
        .stdin(Stdio::inherit())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .output()
        .map_err(|error| format!("cannot run delegated `{:?}`: {error}", argv[0]))?;
    if !output.status.success() {
        return Err(format!(
            "delegated `{} {:?}` failed: {}",
            argv[0],
            &argv[1..],
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(delegated_outcome(&stdout))
}

/// The outcome fact of a delegated AIKit reply: its `/data/summary` when the
/// reply is an envelope (the `session up` shape), else the last non-empty
/// output line.
fn delegated_outcome(stdout: &str) -> String {
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(stdout) {
        if let Some(summary) = value
            .pointer("/data/summary")
            .and_then(|value| value.as_str())
        {
            return summary.to_owned();
        }
    }
    stdout
        .lines()
        .rev()
        .map(str::trim)
        .find(|line| !line.is_empty() && *line != "}" && *line != "{")
        .unwrap_or("ok")
        .to_owned()
}

/// Run a delegated shell command and return its full stdout (JSON verbs).
fn run_capture(command: &str) -> Result<String, String> {
    let output = Command::new("sh")
        .arg("-c")
        .arg(command)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("cannot run `{command}`: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "`{command}` failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Apply a preview: run and fail on status, discard stdout (the receipt is
/// re-readable through the SessionSpace itself).
fn run_capture_quiet(command: &str) -> Result<(), String> {
    run_capture(command).map(|_| ())
}

fn temp_preview(stem: &str, contents: &str) -> Result<std::path::PathBuf, String> {
    let path = std::env::temp_dir().join(format!("{stem}-{}.json", std::process::id()));
    std::fs::write(&path, contents)
        .map_err(|error| format!("cannot write {}: {error}", path.display()))?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bind_intents_carry_the_application_contract_in_order() {
        let intents = herdr_bind_intents("/Central/Work/O-I").expect("intents");
        let names: Vec<&str> = intents.iter().map(|(name, _, _, _)| *name).collect();
        assert_eq!(names, vec!["attach", "native", "bind"]);
        let bind = &intents[2].3;
        let value: serde_json::Value = serde_json::from_str(bind).expect("bind json");
        assert_eq!(
            value.pointer("/binding/surface").and_then(|v| v.as_str()),
            Some(HERDR_SURFACE)
        );
        assert_eq!(
            value
                .pointer("/binding/plan/mux")
                .and_then(|v| v.as_str()),
            Some("herdr")
        );
        assert_eq!(
            value.pointer("/binding/plan/root").and_then(|v| v.as_str()),
            Some("/Central/Work/O-I")
        );
        // The step command names the world shell, never a provider protocol.
        let command = value
            .pointer("/binding/plan/views/0/steps/0/command")
            .and_then(|v| v.as_array())
            .expect("command array");
        assert_eq!(command[0].as_str(), Some(world_shell()));
    }

    #[test]
    fn delegated_outcome_reads_the_envelope_summary_not_braces() {
        let envelope = r#"{"context":{},"data":{"summary":"created tmux session `oi-development` with 11 view(s)","session":"oi-development"},"ok":true}"#;
        assert!(delegated_outcome(envelope).starts_with("created tmux session"));
        assert_eq!(delegated_outcome("plain line output\n"), "plain line output");
    }

    #[test]
    fn herdr_answer_probe_requires_a_session_snapshot() {
        // The probe keys on the snapshot envelope, so a server error page or
        // an unrelated JSON line never reads as a live provider.
        assert!(!herdr_answers("/nonexistent/herdr-binary"));
    }
}
