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

#[cfg(unix)]
fn fake_central(dir: &Path, init_status: i32) -> PathBuf {
    let body = r#"
if [ "${1:-}" = "--version" ] || [ "${1:-}" = "-V" ] || [ "${1:-}" = "version" ]; then
  echo 'ctrl 0.1.0'
  exit 0
fi
ROOT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    --root=*) ROOT="${1#--root=}"; shift ;;
    --json) shift ;;
    *) break ;;
  esac
done
if [ "${1:-}" = "action.list" ] || { [ "${1:-}" = "action" ] && [ "${2:-}" = "list" ]; }; then
  printf '%s\n' '{"ok":true,"status":"success","action":"action.list","data":{"actions":[{"id":"action.list"},{"id":"central.init"},{"id":"central.doctor"},{"id":"projectcentral.inspect"},{"id":"projectcentral.doctor"},{"id":"projectcentral.init"}]}}'
  exit 0
fi
if [ "${1:-}" = "init" ]; then
  if [ "__INIT_STATUS__" != "0" ]; then exit __INIT_STATUS__; fi
  /bin/mkdir -p "$ROOT/Control/user" "$ROOT/Control/agents/governance" "$ROOT/Control/agents/wiki" "$ROOT/Control/machines" "$ROOT/.central" "$ROOT/Work"
  printf '%s\n' '{"schema":"okf-wiki/v1","space_ref":"central:wiki:root","sources":[]}' > "$ROOT/Control/agents/wiki/wiki.json"
  printf '%s\n' '{"ok":true,"status":"success","action":"central.init","data":{}}'
  exit 0
fi
if [ "${1:-}" = "doctor" ]; then
  if [ -d "$ROOT/Control/user" ] && [ -d "$ROOT/Control/agents/governance" ] && [ -d "$ROOT/Control/agents/wiki" ] && [ -f "$ROOT/Control/agents/wiki/wiki.json" ] && [ -d "$ROOT/Control/machines" ] && [ -d "$ROOT/.central" ] && [ -d "$ROOT/Work" ]; then
    printf '%s\n' '{"ok":true,"status":"success","action":"central.doctor","data":{"valid":true}}'
    exit 0
  fi
  printf '%s\n' '{"ok":false,"status":"invalid_central_structure"}'
  exit 3
fi
exit 0
"#
    .replace("__INIT_STATUS__", &init_status.to_string());
    fake_executable(dir, "ctrl", &body)
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
    let ctrl = fake_central(bin.path(), 0);
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
    assert_eq!(central["version"], "ctrl 0.1.0");
    assert!(central.get("product_config").is_none());
}

#[cfg(unix)]
#[test]
fn status_marks_deleted_registered_executable_broken() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ctrl = fake_central(bin.path(), 0);
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
    let ctrl = fake_central(bin.path(), 0);
    let aikit = fake_executable(
        bin.path(),
        "aikit",
        "if [ \"$1\" = '--version' ]; then echo 'aikit 1.0.0'; fi",
    );
    let workcell = fake_executable(
        bin.path(),
        "workcell",
        "if [ \"$1\" = '--version' ]; then echo 'workcell 0.1.0'; fi",
    );
    for (module, executable) in [("central", ctrl), ("ai-kit", aikit), ("workcell", workcell)] {
        let result = output(
            oi(home.path(), bin.path())
                .args(["register", module, "--executable"])
                .arg(executable),
        );
        assert!(result.status.success(), "{}", text(&result.stderr));
    }
    for module in ["actuation", "software-factory", "quaternal-logic"] {
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
    assert_eq!(aliases, vec!["ctrl", "kit", "workcell"]);
}

#[cfg(unix)]
#[test]
fn alias_exec_preserves_arguments_stdio_and_exit_status() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ctrl = fake_executable(
        bin.path(),
        "ctrl",
        "printf 'args:%s|%s\\n' \"$1\" \"$2\"; /bin/cat; printf 'native-stderr\\n' >&2; exit 23",
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
fn init_without_central_refuses_to_synthesize_a_personal_ground() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ground = home.path().join("Central");
    let result = output(
        oi(home.path(), bin.path())
            .args(["init", "--personal-ground"])
            .arg(&ground),
    );
    assert_eq!(result.status.code(), Some(2));
    assert!(text(&result.stderr).contains("oi install central"));
    assert!(!ground.exists());
    assert!(!home.path().join("composition.json").exists());
}

#[cfg(unix)]
#[test]
fn init_delegates_to_real_central_shape_and_is_idempotent() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    fake_central(bin.path(), 0);
    let ground = home.path().join("Central");
    for _ in 0..2 {
        let result = output(
            oi(home.path(), bin.path())
                .args(["init", "--personal-ground"])
                .arg(&ground),
        );
        assert!(result.status.success(), "{}", text(&result.stderr));
    }
    for relative in [
        "Control/user",
        "Control/agents/governance",
        "Control/agents/wiki",
        "Control/machines",
        ".central",
        "Work",
    ] {
        assert!(ground.join(relative).is_dir(), "missing {relative}");
    }
    for relative in ["Control/user", "Control/agents/governance", "Control/machines"] {
        assert_eq!(fs::read_dir(ground.join(relative)).unwrap().count(), 0);
    }
    assert!(ground.join("Control/agents/wiki/wiki.json").is_file());
    let state: Value =
        serde_json::from_slice(&fs::read(home.path().join("composition.json")).unwrap()).unwrap();
    assert_eq!(state["personal_ground"], ground.display().to_string());
    assert!(state["modules"]["central"].is_object());
    assert!(state.get("central_config").is_none());
}

#[cfg(unix)]
#[test]
fn central_init_failure_does_not_record_false_personal_ground() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ctrl = fake_central(bin.path(), 7);
    let registered = output(
        oi(home.path(), bin.path())
            .args(["register", "central", "--executable"])
            .arg(ctrl),
    );
    assert!(registered.status.success());
    let before = fs::read(home.path().join("composition.json")).unwrap();
    let ground = home.path().join("Central");
    let result = output(
        oi(home.path(), bin.path())
            .args(["init", "--personal-ground"])
            .arg(&ground),
    );
    assert_eq!(result.status.code(), Some(2));
    assert_eq!(
        fs::read(home.path().join("composition.json")).unwrap(),
        before
    );
}

#[cfg(unix)]
#[test]
fn register_central_discovers_an_existing_compatible_ctrl() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    fake_central(bin.path(), 0);
    let result = output(oi(home.path(), bin.path()).args(["register", "central"]));
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert!(text(&result.stdout).contains("Registered: Central"));
    let state: Value =
        serde_json::from_slice(&fs::read(home.path().join("composition.json")).unwrap()).unwrap();
    assert_eq!(state["modules"]["central"]["version"], "ctrl 0.1.0");
}

#[cfg(unix)]
#[test]
fn central_install_failure_leaves_prior_composition_recoverable() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let aikit = fake_executable(bin.path(), "aikit", "echo 'aikit 1.0.0'");
    let registered = output(
        oi(home.path(), bin.path())
            .args(["register", "ai-kit", "--executable"])
            .arg(aikit),
    );
    assert!(registered.status.success());
    let before = fs::read(home.path().join("composition.json")).unwrap();
    fake_executable(bin.path(), "git", "exit 9");
    fake_executable(bin.path(), "cargo", "exit 9");
    let result = output(oi(home.path(), bin.path()).args(["install", "central"]));
    assert_eq!(result.status.code(), Some(2));
    assert_eq!(
        fs::read(home.path().join("composition.json")).unwrap(),
        before
    );
}

#[cfg(unix)]
#[test]
fn migration_places_existing_work_tree_without_changing_its_contents() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    fake_central(bin.path(), 0);
    let ground = home.path().join("Central");
    let init = output(
        oi(home.path(), bin.path())
            .args(["init", "--personal-ground"])
            .arg(&ground),
    );
    assert!(init.status.success());

    let source = home.path().join("code/project");
    fs::create_dir_all(source.join(".git")).unwrap();
    fs::write(source.join(".git/HEAD"), "ref: refs/heads/main\n").unwrap();
    fs::write(source.join("dirty.txt"), "uncommitted work stays").unwrap();
    let result = output(oi(home.path(), bin.path()).arg("migrate").arg(&source));
    assert!(result.status.success(), "{}", text(&result.stderr));
    let target = ground.join("Work/project");
    assert!(!source.exists());
    assert_eq!(
        fs::read_to_string(target.join(".git/HEAD")).unwrap(),
        "ref: refs/heads/main\n"
    );
    assert_eq!(
        fs::read_to_string(target.join("dirty.txt")).unwrap(),
        "uncommitted work stays"
    );
    assert!(
        text(&result.stdout).contains("No Project, Factory, AIKit, or Workcell object was created")
    );
}

#[cfg(unix)]
#[test]
fn migration_refuses_target_collision_without_changing_source() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    fake_central(bin.path(), 0);
    let ground = home.path().join("Central");
    assert!(output(
        oi(home.path(), bin.path())
            .args(["init", "--personal-ground"])
            .arg(&ground),
    )
    .status
    .success());

    let source = home.path().join("outside/project");
    fs::create_dir_all(&source).unwrap();
    fs::write(source.join("keep.txt"), "same").unwrap();
    let collision = ground.join("Work/project");
    fs::create_dir_all(&collision).unwrap();
    let result = output(oi(home.path(), bin.path()).arg("migrate").arg(&source));
    assert_eq!(result.status.code(), Some(2));
    assert_eq!(fs::read_to_string(source.join("keep.txt")).unwrap(), "same");
    assert!(collision.is_dir());
}

#[cfg(unix)]
#[test]
fn alias_collision_is_explicit() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let ctrl = fake_central(bin.path(), 0);
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

#[test]
fn docs_resolves_quaternal_logic_to_the_live_ql_mef_repository() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let result = output(oi(home.path(), bin.path()).args(["docs", "quaternal-logic"]));
    assert!(result.status.success());
    assert!(text(&result.stdout).contains("EpiLogos/QL-MEF"));
}
