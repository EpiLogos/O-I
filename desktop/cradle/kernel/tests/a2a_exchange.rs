//! The A2A exchange through the actual kernel dispatcher. A fake node stands
//! in for the runtime: it records the exact argv and stdin it received, so
//! the test proves the dispatcher spawns the owner runner with the composed
//! operator-send authority, carries the difference verbatim, and refuses a
//! non-contract reply — routing proven, not commented.
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::json;
use std::fs;
use std::os::unix::fs::PermissionsExt;

#[test]
fn a2a_exchange_dispatches_the_runner_with_operator_send_authority() {
    let dir = std::env::temp_dir().join(format!("oi-a2a-exchange-{}", std::process::id()));
    fs::create_dir_all(&dir).unwrap();
    let args_file = dir.join("argv.txt");
    let stdin_file = dir.join("stdin.txt");
    let fake = dir.join("fake-node.sh");
    let script = format!(
        "#!/bin/sh\nfor a in \"$@\"; do printf '%s\\n' \"$a\" >> \"{args}\"; done\ncat > \"{stdin}\"\necho '{{\"schema\":\"oi.a2a-difference/v1\",\"exchange_ref\":\"a2a-exchange:m1\",\"transport_result\":{{\"kind\":\"message\",\"ref\":\"t1\"}}}}'\n",
        args = args_file.display(),
        stdin = stdin_file.display()
    );
    fs::write(&fake, script).unwrap();
    fs::set_permissions(&fake, fs::Permissions::from_mode(0o755)).unwrap();
    let runner = dir.join("shared-field/a2a-runner.mjs");
    fs::create_dir_all(runner.parent().unwrap()).unwrap();
    fs::write(&runner, "export {}").unwrap();

    let prior_node = std::env::var_os("OI_NODE");
    let prior_runner = std::env::var_os("OI_A2A_RUNNER");
    std::env::set_var("OI_NODE", &fake);
    std::env::set_var("OI_A2A_RUNNER", &runner);

    let outcome = Kernel::new(CentralClient::discover())
        .apply(KernelOp::A2aExchange {
            request: json!({
                "binding": {"binding_ref": "a2a-binding:desktop:peer"},
                "presence": {"availability": "online"},
                "initiator_participant_ref": "participant:desktop-operator",
                "message": {"message_id": "a2a-m1", "text": "hello"},
            }),
        })
        .expect("the exchange dispatches");
    match outcome.result {
        KernelOpResult::A2aExchangeDifference { data } => {
            assert_eq!(data["schema"], "oi.a2a-difference/v1");
            assert_eq!(data["transport_result"]["ref"], "t1");
        }
        other => panic!("unexpected result: {other:?}"),
    }
    let argv = fs::read_to_string(&args_file).unwrap();
    assert_eq!(argv.trim(), runner.to_string_lossy().to_string(), "the runner path is the sole argument");
    let sent: serde_json::Value = serde_json::from_str(&fs::read_to_string(&stdin_file).unwrap()).unwrap();
    let authority = &sent["authority"];
    assert_eq!(authority["allowed"], json!(true));
    assert_eq!(authority["grant_ref"], json!("exchange-grant:operator-send:a2a-m1"));
    assert_eq!(authority["basis"], json!("operator send — the desktop's own exchange-authority decision"));
    assert_eq!(sent["message"]["message_id"], json!("a2a-m1"), "the message travels verbatim");

    // A reply that is not a difference document is refused, never carried.
    fs::write(&fake, "#!/bin/sh\ncat > /dev/null\necho '{\"unexpected\":true}'\n").unwrap();
    fs::set_permissions(&fake, fs::Permissions::from_mode(0o755)).unwrap();
    let bad = Kernel::new(CentralClient::discover())
        .apply(KernelOp::A2aExchange { request: json!({"message": {"message_id": "m2"}}) });
    assert!(bad.is_err(), "a non-contract reply is refused");

    match prior_node {
        Some(value) => std::env::set_var("OI_NODE", value),
        None => std::env::remove_var("OI_NODE"),
    }
    match prior_runner {
        Some(value) => std::env::set_var("OI_A2A_RUNNER", value),
        None => std::env::remove_var("OI_A2A_RUNNER"),
    }
}
