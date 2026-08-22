use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
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
fn fake_central(dir: &Path, projectcentral: bool) -> PathBuf {
    let actions = if projectcentral {
        r#"[{"id":"action.list"},{"id":"central.init"},{"id":"central.doctor"},{"id":"projectcentral.inspect"},{"id":"projectcentral.doctor"},{"id":"projectcentral.init"}]"#
    } else {
        r#"[{"id":"action.list"},{"id":"central.init"},{"id":"central.doctor"}]"#
    };
    let body = format!(r#"
if [ "${{1:-}}" = "--version" ]; then
  echo 'ctrl 0.1.0'
  exit 0
fi
ROOT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    --root=*) ROOT="${{1#--root=}}"; shift ;;
    --json) shift ;;
    *) break ;;
  esac
done
if [ "${{1:-}}" = "action.list" ]; then
  printf '%s\n' '{{"ok":true,"status":"success","action":"action.list","data":{{"actions":{actions}}}}}'
  exit 0
fi
if [ "${{1:-}}" = "init" ]; then
  /bin/mkdir -p "$ROOT/Control/user" "$ROOT/Control/agents/governance" "$ROOT/Control/agents/wiki" "$ROOT/Control/machines" "$ROOT/.central" "$ROOT/Work"
  printf '%s\n' '{{"schema":"okf-wiki/v1","space_ref":"central:wiki:root","sources":[]}}' > "$ROOT/Control/agents/wiki/wiki.json"
  printf '%s\n' '{{"ok":true,"status":"success","action":"central.init","data":{{}}}}'
  exit 0
fi
if [ "${{1:-}}" = "doctor" ]; then
  if [ -d "$ROOT/Control/agents/governance" ] && [ -f "$ROOT/Control/agents/wiki/wiki.json" ]; then
    printf '%s\n' '{{"ok":true,"status":"success","action":"central.doctor","data":{{"valid":true}}}}'
    exit 0
  fi
  exit 3
fi
exit 0
"#);
    fake_executable(dir, "ctrl", &body)
}

fn output(command: &mut Command) -> Output {
    command.output().expect("command runs")
}

fn text(bytes: &[u8]) -> String {
    String::from_utf8(bytes.to_vec()).unwrap()
}

#[cfg(unix)]
#[test]
fn stale_three_action_central_is_not_accepted_for_current_personal_ground() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    fake_central(bin.path(), false);
    let ground = home.path().join("Central");

    let result = output(
        oi(home.path(), bin.path())
            .args(["init", "--personal-ground"])
            .arg(&ground),
    );

    assert_eq!(result.status.code(), Some(2));
    assert!(text(&result.stderr).contains("current-main Central"));
    assert!(!ground.exists());
}

#[cfg(unix)]
#[test]
fn current_projectcentral_central_initializes_the_real_root_shape() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    fake_central(bin.path(), true);
    let ground = home.path().join("Central");

    let result = output(
        oi(home.path(), bin.path())
            .args(["init", "--personal-ground"])
            .arg(&ground),
    );

    assert!(result.status.success(), "{}", text(&result.stderr));
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
    assert!(ground.join("Control/agents/wiki/wiki.json").is_file());
}

#[cfg(unix)]
#[test]
fn dev_status_reports_current_main_pins_not_release_snapshot() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    fake_central(bin.path(), true);
    let ground = home.path().join("Central");
    let init = output(
        oi(home.path(), bin.path())
            .args(["init", "--personal-ground"])
            .arg(&ground),
    );
    assert!(init.status.success(), "{}", text(&init.stderr));

    let result = output(oi(home.path(), bin.path()).args(["dev", "status", "--json"]));
    assert!(result.status.success(), "{}", text(&result.stderr));
    let value: Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(value["schema"], "oi.current-main-dev-status/v1");
    let central = value["repos"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["id"] == "central")
        .unwrap();
    assert_eq!(
        central["accepted_current_main"],
        "564120f0da1777a70bda3a7ca3e3214efb3e5149"
    );
    assert_ne!(
        central["accepted_current_main"],
        "78a545214ad70e055fae38ccae2d78443112f283"
    );
}
