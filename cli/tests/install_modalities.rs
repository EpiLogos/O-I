//! Installation-modality integration proofs (O:I #192): every modality's
//! install/init path reports its frame, legacy state discloses `unknown`
//! honestly, install sources are exclusive-and-declared, and the
//! fresh-ground `machine.adopt-current` wiring (Central #87) is proven
//! against a scripted fake ctrl — never a real Central install.

use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use tempfile::TempDir;

fn oi(home: &Path, path: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
    // HOME is overridden too: the managed artifact root (doctor, suite
    // install) must resolve inside the sandbox, never the developer's
    // real application-data directory.
    command
        .env("OI_HOME", home)
        .env("HOME", home)
        .env("PATH", path);
    command
}

fn output(command: &mut Command) -> Output {
    command.output().expect("command runs")
}

fn text(bytes: &[u8]) -> String {
    String::from_utf8(bytes.to_vec()).unwrap()
}

/// How the scripted ctrl answers `machine.adopt-current`.
#[derive(Clone, Copy, PartialEq)]
enum AdoptMode {
    /// The Action exists and performs idempotent adoption.
    Supports,
    /// The ctrl predates the Action (not in action.list).
    Absent,
    /// The Action exists but refuses with a Workcell binding conflict.
    Conflict,
}

/// A scripted Central ctrl implementing exactly the bootstrap contract:
/// `--version`, `action.list`, `init`, `doctor`, and (optionally)
/// `machine.adopt-current`.
fn fake_ctrl(dir: &Path, name: &str, adopt: AdoptMode) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let adopt_id = match adopt {
        AdoptMode::Supports | AdoptMode::Conflict => r#",{"id":"machine.adopt-current"}"#,
        AdoptMode::Absent => "",
    };
    let adopt_body = match adopt {
        AdoptMode::Supports => {
            r#"
  if [ -f "$ROOT/Control/machines/current.json" ]; then
    printf '%s\n' '{"ok":true,"status":"success","action":"machine.adopt-current","data":{"schema":"central.machine-adoption/v1","outcome":"unchanged","role":"current","workcell_ref":"workcell:local"}}'
  else
    /bin/mkdir -p "$ROOT/Control/machines"
    printf '%s\n' '{"schema":"central.machine-declaration/v1","role":"current","bindings":[{"kind":"workcell","reference":"workcell:local"}]}' > "$ROOT/Control/machines/current.json"
    printf '%s\n' '{"ok":true,"status":"success","action":"machine.adopt-current","data":{"schema":"central.machine-adoption/v1","outcome":"created","role":"current","workcell_ref":"workcell:local"}}'
  fi
  exit 0
"#
        }
        AdoptMode::Conflict => {
            r#"
  printf '%s\n' '{"ok":false,"status":"invalid_input","action":"machine.adopt-current","error":{"code":"invalid_input","message":"Machine declaration for current already binds a different Workcell: workcell:remote.","details":{"code":"workcell_binding_conflict","role":"current","requested_workcell_ref":"workcell:local","existing_workcell_refs":["workcell:remote"],"path":"Control/machines/current.json"}}}'
  exit 2
"#
        }
        // No Action body: the id is absent from action.list so O:I never
        // reaches this arm; the colon keeps the if/valid shell syntax.
        AdoptMode::Absent => "\n  :\n",
    };
    let body = format!(
        r#"#!/bin/sh
if [ "$1" = "--version" ]; then echo 'ctrl 0.1.0'; exit 0; fi
ROOT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    --root=*) ROOT="${{1#--root=}}"; shift ;;
    --json) shift ;;
    *) break ;;
  esac
done
if [ "$1" = "action.list" ] || {{ [ "$1" = "action" ] && [ "$2" = "list" ]; }}; then
  printf '%s\n' '{{"ok":true,"status":"success","action":"action.list","data":{{"actions":[{{"id":"action.list"}},{{"id":"central.init"}},{{"id":"central.doctor"}},{{"id":"projectcentral.inspect"}},{{"id":"projectcentral.doctor"}},{{"id":"projectcentral.init"}}{adopt_id}]}}}}'
  exit 0
fi
if [ "$1" = "action" ] && [ "$2" = "run" ] && [ "$3" = "machine.adopt-current" ]; then{adopt_body}
fi
if [ "$1" = "init" ]; then
  /bin/mkdir -p "$ROOT/Control/user" "$ROOT/Control/agents/governance" "$ROOT/Control/agents/wiki" "$ROOT/Control/machines" "$ROOT/.central" "$ROOT/Work"
  printf '%s\n' '{{"schema":"okf-wiki/v1","space_ref":"central:wiki:root","sources":[]}}' > "$ROOT/Control/agents/wiki/wiki.json"
  printf '%s\n' '{{"ok":true,"status":"success","action":"central.init","data":{{}}}}'
  exit 0
fi
if [ "$1" = "doctor" ]; then
  printf '%s\n' '{{"ok":true,"status":"success","action":"central.doctor","data":{{"valid":true}}}}'
  exit 0
fi
exit 0
"#
    );
    let path = dir.join(name);
    fs::write(&path, body).unwrap();
    let mut permissions = fs::metadata(&path).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&path, permissions).unwrap();
    path
}

fn composition(home: &Path) -> Value {
    serde_json::from_slice(&fs::read(home.join("composition.json")).unwrap()).unwrap()
}

/// The pinned Central revision from the compiled-in surface catalog.
fn pinned_central_revision() -> String {
    let surfaces: Value = serde_json::from_str(include_str!("../../surfaces.json")).unwrap();
    surfaces["surfaces"]
        .as_array()
        .unwrap()
        .iter()
        .find(|surface| surface["id"] == "central")
        .unwrap()["install"]["revision"]
        .as_str()
        .unwrap()
        .to_owned()
}

/// Place a fake managed pinned ctrl install at the exact location
/// `oi install central --source pinned` looks for it.
fn managed_pinned_ctrl(home: &Path, adopt: AdoptMode) -> PathBuf {
    let scratch = TempDir::new().unwrap();
    let ctrl = fake_ctrl(scratch.path(), "ctrl", adopt);
    let managed = home
        .join("installs/central-current")
        .join(pinned_central_revision())
        .join("bin/ctrl");
    fs::create_dir_all(managed.parent().unwrap()).unwrap();
    fs::copy(&ctrl, &managed).unwrap();
    use std::os::unix::fs::PermissionsExt;
    let mut permissions = fs::metadata(&managed).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&managed, permissions).unwrap();
    managed
}

#[cfg(unix)]
mod unix {
    use super::*;

    #[test]
    fn fresh_ground_flow_records_and_discloses_its_modality_and_adopts_the_machine() {
        let home = TempDir::new().unwrap();
        let bin = TempDir::new().unwrap();
        fake_ctrl(bin.path(), "ctrl", AdoptMode::Supports);
        let ground = home.path().join("Central");

        let install = output(oi(home.path(), bin.path()).args(["install", "central"]));
        assert!(install.status.success(), "{}", text(&install.stderr));
        assert!(text(&install.stdout).contains("Modality: fresh-ground"));
        assert!(text(&install.stdout).contains("Install source: existing-path-ctrl"));
        let state = composition(home.path());
        assert_eq!(state["modules"]["central"]["modality"], "fresh-ground");
        assert_eq!(
            state["modules"]["central"]["install_source"],
            "existing-path-ctrl"
        );

        let init = output(
            oi(home.path(), bin.path())
                .args(["init", "--personal-ground"])
                .arg(&ground),
        );
        assert!(init.status.success(), "{}", text(&init.stderr));
        let stdout = text(&init.stdout);
        assert!(
            stdout.contains("machine-adoption: created (current ↔ workcell:local)"),
            "adoption outcome must be disclosed: {stdout}"
        );
        assert!(stdout.contains("Modality: fresh-ground"));
        assert!(ground.join("Control/machines/current.json").is_file());
        let state = composition(home.path());
        assert_eq!(state["modules"]["central"]["modality"], "fresh-ground");

        // Idempotent: a second init adopts nothing new and still succeeds.
        let again = output(
            oi(home.path(), bin.path())
                .args(["init", "--personal-ground"])
                .arg(&ground),
        );
        assert!(again.status.success(), "{}", text(&again.stderr));
        assert!(
            text(&again.stdout).contains("machine-adoption: unchanged"),
            "second adoption must disclose unchanged: {}",
            text(&again.stdout)
        );

        // status and current-world disclose the frame of the composition.
        let status = output(oi(home.path(), bin.path()).args(["status", "--json"]));
        assert!(status.status.success());
        let status: Value = serde_json::from_slice(&status.stdout).unwrap();
        let central = status["surfaces"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["id"] == "central")
            .unwrap();
        assert_eq!(central["modality"], "fresh-ground");
        assert_eq!(central["install_source"], "existing-path-ctrl");

        let world = output(oi(home.path(), bin.path()).args(["current-world", "--json"]));
        assert!(world.status.success());
        let world: Value = serde_json::from_slice(&world.stdout).unwrap();
        assert_eq!(world["composition_modality"], "fresh-ground");
        assert_eq!(
            world["positions"][0]["modality"], "fresh-ground",
            "central position carries its recorded modality"
        );

        // doctor surfaces disclose the modality too.
        let doctor = output(oi(home.path(), bin.path()).args(["doctor", "--json"]));
        let doctor: Value = serde_json::from_slice(&doctor.stdout).unwrap();
        let central = doctor["surfaces"]
            .as_array()
            .unwrap()
            .iter()
            .find(|check| check["surface"] == "central")
            .unwrap();
        assert_eq!(central["modality"], "fresh-ground");
    }

    #[test]
    fn legacy_composition_without_modality_discloses_unknown() {
        let home = TempDir::new().unwrap();
        let bin = TempDir::new().unwrap();
        let ctrl = fake_ctrl(bin.path(), "ctrl", AdoptMode::Supports);
        fs::write(
            home.path().join("composition.json"),
            format!(
                r#"{{"schema":1,"personal_ground":null,"modules":{{"central":{{"id":"central","public_name":"Central","native_executable":{},"alias":"ctrl","docs":"x"}}}}}}"#,
                serde_json::to_string(&ctrl.display().to_string()).unwrap()
            ),
        )
        .unwrap();

        let status = output(oi(home.path(), bin.path()).args(["status", "--json"]));
        assert!(status.status.success());
        let status: Value = serde_json::from_slice(&status.stdout).unwrap();
        let central = status["surfaces"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["id"] == "central")
            .unwrap()
            .clone();
        assert_eq!(
            central["modality"], "unknown",
            "legacy state must disclose unknown, not a guess"
        );
        assert_eq!(central["install_source"], Value::Null);

        let world = output(oi(home.path(), bin.path()).args(["current-world", "--json"]));
        let world: Value = serde_json::from_slice(&world.stdout).unwrap();
        assert_eq!(world["composition_modality"], "unknown");
    }

    #[test]
    fn a_compatible_ctrl_and_a_pinned_install_are_exclusive_and_declared() {
        let home = TempDir::new().unwrap();
        let bin = TempDir::new().unwrap();
        fake_ctrl(bin.path(), "ctrl", AdoptMode::Supports);
        let managed = managed_pinned_ctrl(home.path(), AdoptMode::Supports);

        // Both sources apply and no choice was declared: explicit,
        // prompt-free error naming both candidates.
        let refused = output(oi(home.path(), bin.path()).args(["install", "central"]));
        assert_eq!(refused.status.code(), Some(2));
        let stderr = text(&refused.stderr);
        assert!(
            stderr.contains("two install sources apply for Central"),
            "{stderr}"
        );
        assert!(
            stderr.contains(bin.path().join("ctrl").display().to_string().as_str()),
            "the existing ctrl candidate must be named: {stderr}"
        );
        assert!(
            stderr.contains(managed.display().to_string().as_str()),
            "the pinned install candidate must be named: {stderr}"
        );
        assert!(
            stderr.contains("--source existing") && stderr.contains("--source pinned"),
            "the resolution flag must be named: {stderr}"
        );
        assert!(
            !home.path().join("composition.json").exists(),
            "no registration was changed by the refusal"
        );

        // Explicit choice: existing.
        let existing = output(
            oi(home.path(), bin.path()).args(["install", "central", "--source", "existing"]),
        );
        assert!(existing.status.success(), "{}", text(&existing.stderr));
        assert_eq!(
            composition(home.path())["modules"]["central"]["install_source"],
            "existing-path-ctrl"
        );

        // Explicit choice: pinned (after clearing the registration).
        fs::remove_file(home.path().join("composition.json")).unwrap();
        let pinned =
            output(oi(home.path(), bin.path()).args(["install", "central", "--source", "pinned"]));
        assert!(pinned.status.success(), "{}", text(&pinned.stderr));
        let state = composition(home.path());
        assert_eq!(
            state["modules"]["central"]["install_source"],
            "oi-managed-pinned-source"
        );
        assert_eq!(
            state["modules"]["central"]["native_executable"],
            managed.display().to_string()
        );

        // An undeclared source value is a usage error.
        let bogus =
            output(oi(home.path(), bin.path()).args(["install", "central", "--source", "latest"]));
        assert_eq!(bogus.status.code(), Some(2));
        assert!(text(&bogus.stderr).contains("usage: oi install central"));
    }

    #[test]
    fn a_registered_ctrl_is_not_silently_swapped_for_a_different_path_ctrl() {
        let home = TempDir::new().unwrap();
        let bin_a = TempDir::new().unwrap();
        let bin_b = TempDir::new().unwrap();
        let ctrl_a = fake_ctrl(bin_a.path(), "ctrl", AdoptMode::Supports);
        let ctrl_b = fake_ctrl(bin_b.path(), "ctrl", AdoptMode::Supports);

        let registered = output(
            oi(home.path(), bin_a.path())
                .args(["register", "central", "--executable"])
                .arg(&ctrl_a),
        );
        assert!(registered.status.success(), "{}", text(&registered.stderr));

        let refused = output(oi(home.path(), bin_b.path()).args(["install", "central"]));
        assert_eq!(refused.status.code(), Some(2));
        let stderr = text(&refused.stderr);
        assert!(
            stderr.contains("two different compatible ctrl executables"),
            "{stderr}"
        );
        assert!(
            stderr.contains(ctrl_a.display().to_string().as_str())
                && stderr.contains(ctrl_b.display().to_string().as_str()),
            "both executables must be named: {stderr}"
        );
        // The registration was not swapped.
        assert_eq!(
            composition(home.path())["modules"]["central"]["native_executable"],
            ctrl_a.display().to_string()
        );
    }

    #[test]
    fn an_older_ctrl_lacking_adopt_current_never_blocks_ground_establishment() {
        let home = TempDir::new().unwrap();
        let bin = TempDir::new().unwrap();
        fake_ctrl(bin.path(), "ctrl", AdoptMode::Absent);
        let ground = home.path().join("Central");

        let install = output(oi(home.path(), bin.path()).args(["install", "central"]));
        assert!(install.status.success(), "{}", text(&install.stderr));

        let init = output(
            oi(home.path(), bin.path())
                .args(["init", "--personal-ground"])
                .arg(&ground),
        );
        assert!(
            init.status.success(),
            "ground establishment must not be blocked by an older ctrl: {}",
            text(&init.stderr)
        );
        assert!(
            text(&init.stdout).contains(
                "machine-adoption: unavailable (ctrl ctrl 0.1.0 lacks machine.adopt-current)"
            ),
            "unavailability must be disclosed with the ctrl version: {}",
            text(&init.stdout)
        );
        assert!(!ground.join("Control/machines/current.json").exists());
    }

    #[test]
    fn a_workcell_binding_conflict_surfaces_loudly() {
        let home = TempDir::new().unwrap();
        let bin = TempDir::new().unwrap();
        fake_ctrl(bin.path(), "ctrl", AdoptMode::Conflict);
        let ground = home.path().join("Central");

        let install = output(oi(home.path(), bin.path()).args(["install", "central"]));
        assert!(install.status.success(), "{}", text(&install.stderr));

        let init = output(
            oi(home.path(), bin.path())
                .args(["init", "--personal-ground"])
                .arg(&ground),
        );
        assert_eq!(
            init.status.code(),
            Some(2),
            "a binding conflict must fail the command loudly"
        );
        let stderr = text(&init.stderr);
        assert!(stderr.contains("machine-adoption conflict"), "{stderr}");
        assert!(stderr.contains("workcell:remote"), "{stderr}");
        assert!(
            stderr.contains("resolve it through Central"),
            "the conflict must point at its owner: {stderr}"
        );
    }
}
