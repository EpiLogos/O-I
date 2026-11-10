//! O-I #747 round 896 1T item 19 (DLW build ruling 2026-11-09; 1W item 4): the native host takes the launch token into the kernel's
//! keeping at start (main.rs, before any plugin, thread or child exists) and out of its own process environment, so no process it
//! starts inherits it: a plugin's child (the opener's `/usr/bin/open`, `xdg-open`), and on Windows and Linux the webview's own helper
//! processes (WebView2's browser processes, WebKitGTK's web and network processes), which are started with the host's environment. The
//! rule's door still hands it on: the person's press reaches Central with it.
//!
//! Its own process: the hold is the process's, once.
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::dispatch::dispatch;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp};
use serde_json::json;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::sync::Mutex;

const TOKEN: &str = "launch-token-0123456789abcdef0123456789abcdef";

#[test]
fn the_host_holds_the_launch_token_and_no_child_inherits_it() {
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
        "the host's own environment no longer holds it"
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
    let ctrl = dir.join("ctrl");
    let d = dir.display();
    // It answers the World (`central.world`: an owner write reads the World it is prepared in) and the catalogue, and the act itself.
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
    let asked: Vec<&str> = tokens
        .lines()
        .filter(|line| line.contains("central.day.field.record") && !line.contains("action.list"))
        .collect();
    assert!(
        !asked.is_empty(),
        "Central was asked for the person's act ({outcome:?}): {tokens}"
    );
    for line in asked {
        assert!(
            line.ends_with(&format!(" | {TOKEN}")),
            "the press hands on the held token: {line}"
        );
    }
    std::env::remove_var("CENTRAL_NATIVE_TOKEN");
    let _ = fs::remove_dir_all(&dir);
}
