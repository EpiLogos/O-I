use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use tempfile::TempDir;

fn oi(home: &Path, path: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
    command.env("OI_HOME", home).env("PATH", path);
    command
}

#[cfg(unix)]
fn fake_executable(dir: &Path, name: &str, body: &str) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let path = dir.join(name);
    fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
    let mut permissions = fs::metadata(&path).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&path, permissions).unwrap();
    path
}

fn output(command: &mut Command) -> Output {
    command.output().expect("command runs")
}

fn text(bytes: &[u8]) -> String {
    String::from_utf8(bytes.to_vec()).unwrap()
}

#[test]
fn empty_status_reports_missing_surfaces() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let result = output(oi(home.path(), bin.path()).args(["status", "--json"]));
    assert!(result.status.success());
    let value: Value = serde_json::from_slice(&result.stdout).unwrap();
    let rows = value["surfaces"].as_array().unwrap();
    assert_eq!(rows.len(), 6);
    assert!(rows.iter().all(|row| row["state"] == "missing"));
    assert!(rows.iter().any(|row| row["name"] == "Quaternal Logic"));
}

#[cfg(unix)]
#[test]
fn status_distinguishes_detected_installation_from_registration() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    fake_executable(bin.path(), "aikit", "echo 'aikit 1.2.3'");
    let result = output(oi(home.path(), bin.path()).args(["status", "--json"]));
    assert!(result.status.success());
    let value: Value = serde_json::from_slice(&result.stdout).unwrap();
    let aikit = value["surfaces"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["id"] == "ai-kit")
        .unwrap();
    assert_eq!(aikit["state"], "installed");
}

#[cfg(unix)]
#[test]
fn register_creates_only_composition_metadata() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ctrl = fake_executable(bin.path(), "ctrl", "exit 0");
    let result = output(
        oi(home.path(), bin.path())
            .args(["register", "central", "--executable"])
            .arg(&ctrl),
    );
    assert!(result.status.success(), "{}", text(&result.stderr));
    let state: Value =
        serde_json::from_slice(&fs::read(home.path().join("composition.json")).unwrap()).unwrap();
    let central = &state["modules"]["central"];
    assert_eq!(central["id"], "central");
    assert_eq!(central["alias"], "ctrl");
    assert!(central.get("native_executable").is_some());
    assert!(central.get("docs").is_some());
    assert!(central.get("skill").is_some());
    assert!(central.get("product_config").is_none());
}

#[cfg(unix)]
#[test]
fn status_marks_deleted_registered_executable_broken() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ctrl = fake_executable(bin.path(), "ctrl", "exit 0");
    let registered = output(
        oi(home.path(), bin.path())
            .args(["register", "central", "--executable"])
            .arg(&ctrl),
    );
    assert!(registered.status.success());
    fs::remove_file(ctrl).unwrap();
    let result = output(oi(home.path(), bin.path()).args(["status", "--json"]));
    let value: Value = serde_json::from_slice(&result.stdout).unwrap();
    let central = value["surfaces"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["id"] == "central")
        .unwrap();
    assert_eq!(central["state"], "broken");
}

#[cfg(unix)]
#[test]
fn full_registered_composition_is_reported_without_invented_aliases() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ctrl = fake_executable(bin.path(), "ctrl", "exit 0");
    let aikit = fake_executable(
        bin.path(),
        "aikit",
        "if [ \"$1\" = '--version' ]; then echo 'aikit 1.0.0'; fi",
    );
    for (module, executable) in [("central", ctrl), ("ai-kit", aikit)] {
        let result = output(
            oi(home.path(), bin.path())
                .args(["register", module, "--executable"])
                .arg(executable),
        );
        assert!(result.status.success(), "{}", text(&result.stderr));
    }
    for module in [
        "agent-runtime",
        "software-factory",
        "workcell",
        "quaternal-logic",
    ] {
        let root = home.path().join(module);
        fs::create_dir_all(&root).unwrap();
        let result = output(
            oi(home.path(), bin.path())
                .args(["register", module, "--root"])
                .arg(root),
        );
        assert!(result.status.success(), "{}", text(&result.stderr));
    }
    let result = output(oi(home.path(), bin.path()).args(["status", "--json"]));
    let value: Value = serde_json::from_slice(&result.stdout).unwrap();
    let rows = value["surfaces"].as_array().unwrap();
    assert_eq!(rows.len(), 6);
    assert!(rows.iter().all(|row| row["state"] == "registered"));
    let aliases: Vec<&str> = rows
        .iter()
        .filter_map(|row| row["alias"].as_str())
        .collect();
    assert_eq!(aliases, vec!["ctrl", "kit"]);
}

#[cfg(unix)]
#[test]
fn alias_exec_preserves_arguments_stdio_and_exit_status() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ctrl = fake_executable(
        bin.path(),
        "ctrl",
        "printf 'args:%s|%s\\n' \"$1\" \"$2\"; cat; printf 'native-stderr\\n' >&2; exit 23",
    );
    let registered = output(
        oi(home.path(), bin.path())
            .args(["register", "central", "--executable"])
            .arg(&ctrl),
    );
    assert!(registered.status.success());

    let mut child = oi(home.path(), bin.path())
        .args(["ctrl", "alpha", "two words"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .as_mut()
        .unwrap()
        .write_all(b"native-stdin\n")
        .unwrap();
    drop(child.stdin.take());
    let result = child.wait_with_output().unwrap();
    assert_eq!(result.status.code(), Some(23));
    assert!(text(&result.stdout).contains("args:alpha|two words"));
    assert!(text(&result.stdout).contains("native-stdin"));
    assert!(text(&result.stderr).contains("native-stderr"));
}

#[test]
fn init_creates_minimal_personal_ground_and_state_without_central() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ground = home.path().join("Central");
    let result = output(
        oi(home.path(), bin.path())
            .args(["init", "--personal-ground"])
            .arg(&ground),
    );
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert!(ground.join("Control").is_dir());
    assert!(ground.join("Work").is_dir());
    let state: Value =
        serde_json::from_slice(&fs::read(home.path().join("composition.json")).unwrap()).unwrap();
    assert_eq!(state["personal_ground"], ground.display().to_string());
}

#[cfg(unix)]
#[test]
fn install_registers_existing_aikit_without_reinstalling() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    fake_executable(
        bin.path(),
        "aikit",
        "if [ \"$1\" = '--version' ]; then echo 'aikit 9.9.9'; else exit 0; fi",
    );
    let result = output(oi(home.path(), bin.path()).args(["install", "ai-kit"]));
    assert!(result.status.success(), "{}", text(&result.stderr));
    let stdout = text(&result.stdout);
    assert!(stdout.contains("registering it instead of reinstalling"));
    let state: Value =
        serde_json::from_slice(&fs::read(home.path().join("composition.json")).unwrap()).unwrap();
    assert_eq!(state["modules"]["ai-kit"]["version"], "aikit 9.9.9");
}

#[cfg(unix)]
#[test]
fn alias_collision_is_explicit() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ctrl = fake_executable(bin.path(), "ctrl", "exit 0");
    let aikit = fake_executable(bin.path(), "aikit", "echo 'aikit 1.0.0'");
    fs::create_dir_all(home.path()).unwrap();
    fs::write(
        home.path().join("composition.json"),
        format!(
            "{{\"schema\":1,\"modules\":{{\"central\":{{\"id\":\"central\",\"public_name\":\"Central\",\"native_executable\":{},\"alias\":\"kit\",\"docs\":\"x\"}}}}}}",
            serde_json::to_string(&ctrl.display().to_string()).unwrap()
        ),
    )
    .unwrap();
    let result = output(
        oi(home.path(), bin.path())
            .args(["register", "ai-kit", "--executable"])
            .arg(aikit),
    );
    assert_eq!(result.status.code(), Some(2));
    assert!(text(&result.stderr).contains("alias 'oi kit' is already registered"));
}

#[cfg(unix)]
#[test]
fn migrate_discloses_missing_native_handoff_without_mutating_source() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ctrl = fake_executable(bin.path(), "ctrl", "exit 0");
    let ground = home.path().join("Central");
    fs::create_dir_all(&ground).unwrap();
    let source = home.path().join("project");
    fs::create_dir_all(&source).unwrap();
    fs::write(source.join("keep.txt"), "same").unwrap();

    let registered = output(
        oi(home.path(), bin.path())
            .args(["register", "central", "--executable"])
            .arg(ctrl),
    );
    assert!(registered.status.success());
    let initialized = output(
        oi(home.path(), bin.path())
            .args(["init", "--personal-ground"])
            .arg(&ground),
    );
    assert!(initialized.status.success());

    let result = output(oi(home.path(), bin.path()).arg("migrate").arg(&source));
    assert_eq!(result.status.code(), Some(4));
    assert!(text(&result.stdout).contains("Handoff unavailable"));
    assert_eq!(fs::read_to_string(source.join("keep.txt")).unwrap(), "same");
    assert!(!ground.join("Work/project").exists());
}

#[test]
fn docs_resolves_quaternal_logic_to_the_live_ql_mef_repository() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let result = output(oi(home.path(), bin.path()).args(["docs", "quaternal-logic"]));
    assert!(result.status.success());
    assert!(text(&result.stdout).contains("EpiLogos/QL-MEF"));
}
