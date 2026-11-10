//! O-I #747 round 896 1T item 19 (DLW build ruling 2026-11-09; 1W item 4): the native host takes the launch token into the kernel's
//! keeping at start (main.rs, before any plugin, thread or child exists) and out of the environment its children inherit, so no
//! process it starts inherits it: a plugin's child (the opener's `/usr/bin/open`, `xdg-open`), and on Windows and Linux the webview's
//! own helper processes (WebView2's browser processes, WebKitGTK's web and network processes), which are started with the host's
//! environment. The rule's door still hands it on: the person's press reaches Central with it.
//!
//! And 1T.2 (1T.0 item 11, review 956a finding 3): before the hold, the host starts again by exec, the same process, without the token
//! in its initial environment, which `ps eww` reads, and hands it to itself by a pipe; its start after a change of World hands it the
//! same way.
//!
//! Its own process: the hold is the process's, once. The 1T.2 test starts this binary again as the host, and the host starts it again
//! after a change of World: each runs as the role its variable names.
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::dispatch::dispatch;
use oi_cradle_kernel::flow::LAUNCH_TOKEN_DESCRIPTOR;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp};
use serde_json::json;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const TOKEN: &str = "launch-token-0123456789abcdef0123456789abcdef";
/// This binary started as the host by the 1T.2 test (its scratch folder).
const HOST: &str = "OI_LAUNCH_TOKEN_TEST_HOST";
/// This binary started by the host after a change of World (its scratch folder).
const AGAIN: &str = "OI_LAUNCH_TOKEN_TEST_AGAIN";
const NAME: &str = "the_host_starts_again_without_the_token_in_its_initial_environment";

#[test]
fn the_host_holds_the_launch_token_and_no_child_inherits_it() {
    if std::env::var_os(AGAIN).is_some() {
        return;
    }
    let dir = std::env::temp_dir().join(format!("oi-launch-token-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(dir.join("home")).unwrap();
    // No token file to fall back on: what reaches Central is the held token or nothing.
    std::env::set_var("HOME", dir.join("home"));
    std::env::set_var("CENTRAL_NATIVE_TOKEN", TOKEN);

    oi_cradle_kernel::flow::hold_launch_token();

    assert_eq!(
        std::env::var_os("CENTRAL_NATIVE_TOKEN"),
        None,
        "the environment the host's children inherit no longer holds it (nor, once the host has started again, its initial environment, which `ps eww` reads: the next test)"
    );
    // A process started after the hold, as the opener's `/usr/bin/open` or a webview helper is, by the host's own environment.
    let shown = std::process::Command::new("/usr/bin/env")
        .output()
        .expect("env runs");
    let shown = String::from_utf8_lossy(&shown.stdout);
    assert!(
        !shown.contains("CENTRAL_NATIVE_TOKEN") && !shown.contains(TOKEN),
        "a child of the host is started without it"
    );

    // The rule's door hands on the token it holds (`for_person`, by the person's press), whatever the environment says since: a token
    // set in the environment after the hold is not the one that goes.
    std::env::set_var(
        "CENTRAL_NATIVE_TOKEN",
        "a-later-token-0123456789abcdef0123456789abc",
    );
    for line in pressed(&dir) {
        assert!(
            line.ends_with(&format!(" | {TOKEN}")),
            "the press hands on the held token: {line}"
        );
    }
    std::env::remove_var("CENTRAL_NATIVE_TOKEN");
    let _ = fs::remove_dir_all(&dir);
}

/// The person's press of a Central act, through a ctrl that records what it was asked with the token it was given: each line of the
/// act asked for (`<args> | <token, or UNSET>`). It answers the World (`central.world`: an owner write reads the World it is prepared
/// in) and the catalogue, and the act itself.
fn pressed(dir: &Path) -> Vec<String> {
    let ctrl = dir.join("ctrl");
    let d = dir.display();
    fs::write(
        &ctrl,
        format!(
            "#!/bin/sh\n\
             printf '%s | %s\\n' \"$*\" \"${{CENTRAL_NATIVE_TOKEN-UNSET}}\" >> \"{d}/tokens.txt\"\n\
             case \"$*\" in\n\
             *'action run central.world '*) echo '{{\"ok\":true,\"data\":{{\"schema\":\"central.world-map/v1\",\"root\":\"{d}\",\"work\":{{\"projects\":[{{\"name\":\"O-I\",\"path\":\"Work/O-I\"}}]}}}}}}' ;;\n\
             *) echo '{{\"ok\":true,\"status\":\"success\",\"data\":{{\"actions\":[{{\"id\":\"central.day.field.record\",\"mutation_class\":\"locally-mutating\"}}]}}}}' ;;\n\
             esac\n"
        ),
    )
    .unwrap();
    fs::set_permissions(&ctrl, fs::Permissions::from_mode(0o755)).unwrap();
    stub::settle_stub(&ctrl);
    let kernel = Mutex::new(Kernel::new(CentralClient::with(
        ctrl.clone(),
        None,
        "O-I".into(),
    )));
    let press: KernelOp = serde_json::from_value(json!({"op": "invoke_action",
        "invocation": {"action": "central.day.field.record", "target_ref": "central:day:today", "input": {}}}))
    .unwrap();
    let (outcome, _) = dispatch(&kernel, oi_cradle_kernel::person_press(press).unwrap());
    let tokens = fs::read_to_string(dir.join("tokens.txt")).unwrap_or_default();
    let asked: Vec<String> = tokens
        .lines()
        .filter(|line| line.contains("central.day.field.record") && !line.contains("action.list"))
        .map(str::to_owned)
        .collect();
    assert!(
        !asked.is_empty(),
        "Central was asked for the person's act ({outcome:?}): {tokens}"
    );
    asked
}

/// A process's initial environment as `ps eww` reads it for the same user (1T.0 item 11).
fn initial_environment(pid: u32) -> String {
    let shown = std::process::Command::new("/bin/ps")
        .args(["eww", "-p", &pid.to_string()])
        .output()
        .expect("ps runs");
    String::from_utf8_lossy(&shown.stdout).into_owned()
}

/// O-I #747 round 896 1T.2 (DLW build ruling 2026-11-09; 1T.0 item 11, review 956a finding 3): launched with the token, the host starts
/// again by exec, the same process, without it in its initial environment, and holds it all the same. `ps eww` shows no token; the
/// person's press hands it on; and the host's start after a change of World hands it to the new host by a pipe, never by its
/// environment, though the environment it is given holds a token. This binary is each host: started here with the token in its
/// environment, it runs only this test, as the host does its `main` (`as_the_host`).
#[test]
fn the_host_starts_again_without_the_token_in_its_initial_environment() {
    if let Some(dir) = std::env::var_os(AGAIN) {
        return as_started_after_a_change_of_world(&PathBuf::from(dir));
    }
    if let Some(dir) = std::env::var_os(HOST) {
        return as_the_host(&PathBuf::from(dir));
    }
    let dir = std::env::temp_dir().join(format!("oi-launch-token-again-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(dir.join("home")).unwrap();
    let launched = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", NAME, "--nocapture", "--test-threads=1"])
        .env(HOST, &dir)
        .env("HOME", dir.join("home"))
        .env("CENTRAL_NATIVE_TOKEN", TOKEN)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    let pid = launched.id();
    let ran = launched.wait_with_output().unwrap();
    let said = String::from_utf8_lossy(&ran.stdout);
    assert!(
        ran.status.success(),
        "the host's run: {said}\n{}",
        String::from_utf8_lossy(&ran.stderr)
    );
    assert!(
        said.contains(&format!("the host, process {pid}, holds the launch token")),
        "the same process, started again: {said}"
    );
    let _ = fs::remove_dir_all(&dir);
}

/// The host's start (main.rs): it starts again first, then holds. Launched with the token, the first call execs and does not return.
fn as_the_host(dir: &Path) {
    assert_eq!(
        oi_cradle_kernel::flow::start_again_without_its_token(),
        Ok(()),
        "started again: no token left in its environment to start again for"
    );
    let handed = std::env::var_os(LAUNCH_TOKEN_DESCRIPTOR);
    oi_cradle_kernel::flow::hold_launch_token();
    assert!(handed.is_some(), "its start again named the pipe");
    assert_eq!(std::env::var_os("CENTRAL_NATIVE_TOKEN"), None);
    assert_eq!(
        std::env::var_os(LAUNCH_TOKEN_DESCRIPTOR),
        None,
        "the descriptor's variable is gone once read"
    );
    let pid = std::process::id();
    let shown = initial_environment(pid);
    assert!(
        shown.contains(HOST),
        "ps shows the host's initial environment: {shown}"
    );
    assert!(
        !shown.contains(TOKEN) && !shown.contains("CENTRAL_NATIVE_TOKEN"),
        "the host's initial environment holds no token: {shown}"
    );
    for line in pressed(dir) {
        assert!(
            line.ends_with(&format!(" | {TOKEN}")),
            "the press hands on the held token: {line}"
        );
    }
    // After a change of World: the launch's own environment, here with a token in it and an old descriptor's number.
    let again = dir.join("again");
    fs::create_dir_all(again.join("home")).unwrap();
    let environment = [
        (AGAIN, again.as_os_str()),
        ("HOME", again.join("home").as_os_str()),
        ("PATH", std::ffi::OsStr::new("/usr/bin:/bin")),
        (
            "CENTRAL_NATIVE_TOKEN",
            std::ffi::OsStr::new("a-token-in-the-environment-given-0123456789"),
        ),
        (LAUNCH_TOKEN_DESCRIPTOR, std::ffi::OsStr::new("7")),
    ]
    .map(|(name, value)| (std::ffi::OsString::from(name), value.to_owned()));
    let started = oi_cradle_kernel::flow::start_host_again(environment).unwrap();
    let ran = started.wait_with_output().unwrap();
    assert!(
        ran.status.success(),
        "the host started after a change of World"
    );
    let said = fs::read_to_string(again.join("said.txt")).unwrap_or_default();
    assert_eq!(
        said, "held by a pipe; no token in its environment",
        "{said}"
    );
    println!("the host, process {pid}, holds the launch token, and its initial environment none");
}

/// The host started again after a change of World: its environment holds no token, a descriptor is named, and what it holds is the
/// launching host's token (its press hands it on), not the one the environment it was given held. Said in a file: this binary's other
/// tests run here too, and return at once.
fn as_started_after_a_change_of_world(dir: &Path) {
    assert_eq!(
        std::env::var_os("CENTRAL_NATIVE_TOKEN"),
        None,
        "no token in its environment"
    );
    let named = std::env::var_os(LAUNCH_TOKEN_DESCRIPTOR);
    assert!(
        named.is_some_and(|fd| fd.to_str() != Some("7")),
        "a pipe of its own is named"
    );
    oi_cradle_kernel::flow::hold_launch_token();
    let shown = initial_environment(std::process::id());
    assert!(
        !shown.contains(TOKEN) && !shown.contains("CENTRAL_NATIVE_TOKEN"),
        "{shown}"
    );
    for line in pressed(dir) {
        assert!(
            line.ends_with(&format!(" | {TOKEN}")),
            "the press hands on the launching host's token: {line}"
        );
    }
    fs::write(
        dir.join("said.txt"),
        "held by a pipe; no token in its environment",
    )
    .unwrap();
}
