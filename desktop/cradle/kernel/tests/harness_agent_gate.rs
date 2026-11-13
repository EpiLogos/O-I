//! The harness-agent session surface: `KernelOp::HarnessAgentRead` reads the
//! AIKit gateway's sessions through the owner's own CLI, and a control is the
//! registry's `aikit.gateway.agent` through the kernel's `act` (O-I #1002).
//! The kernel owns no session state: the gateway's answer passes through
//! verbatim, and its refusal is named data — proven here against the exact
//! candidate executable with an isolated AIKIT_HOME where no gateway runs
//! (CI-safe: offline honesty is the contract under test).

use oi_cradle_kernel::agency::Client;
use oi_cradle_kernel::flow::CentralClient;
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult};

fn candidate() -> std::path::PathBuf {
    let path = std::path::PathBuf::from(
        std::env::var_os("OI_AIKIT_BIN")
            .unwrap_or_else(|| panic!("OI_AIKIT_BIN must name the frozen candidate executable")),
    );
    assert!(
        path.is_absolute(),
        "OI_AIKIT_BIN must be an absolute executable path: {}",
        path.display()
    );
    path
}

fn unique_dir(tag: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "oi-harness-agent-gate-{tag}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// A fake `aikit` that answers one canned envelope and (optionally) records
/// its argv, so the kernel's own contract is provable without a gateway.
fn fake_aikit(dir: &std::path::Path, canned: &str, record_argv: bool) -> std::path::PathBuf {
    let path = dir.join("aikit-fake");
    let record = if record_argv {
        format!("printf '%s' \"$*\" > {}\n", dir.join("argv.txt").display())
    } else {
        String::new()
    };
    std::fs::write(
        &path,
        format!("#!/bin/sh\n{record}printf '%s' '{canned}'\n"),
    )
    .unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    path
}

#[test]
fn the_read_surfaces_the_gateway_sessions_document_verbatim() {
    let dir = unique_dir("read");
    let fake = fake_aikit(
        &dir,
        r#"{"ok":true,"data":{"type":"sessions","binding":"gateway-binding/t","sessions":[{"session_id":"s-1"}]},"schema":1}"#,
        false,
    );
    let mut kernel = Kernel::with_agency(
        CentralClient::discover(),
        Client::with(fake, Some(dir.clone())),
    );
    let outcome = kernel
        .apply(KernelOp::HarnessAgentRead {
            binding: "gateway-binding/t".to_owned(),
        })
        .expect("the read never fails the kernel: refusals are answers");
    assert!(
        outcome.receipts.is_empty(),
        "a session read is not a state change"
    );
    let KernelOpResult::HarnessAgentReading { binding, document } = outcome.result else {
        panic!("the read answers with the reading");
    };
    assert_eq!(binding, "gateway-binding/t");
    assert_eq!(document["type"], "sessions");
    assert_eq!(document["sessions"][0]["session_id"], "s-1");
}

/// A fake `oi` (`OI_BIN`): `act describe` names the Action a write; `act invoke` records its argv and the JSON on stdin and
/// answers one canned envelope, as AIKit's route answers through the registry.
fn fake_oi(dir: &std::path::Path, canned: &str) -> std::path::PathBuf {
    let path = dir.join("oi-fake");
    let d = dir.display();
    std::fs::write(
        &path,
        format!(
            "#!/bin/sh\nif [ \"$1 $2\" = 'act describe' ]; then printf '%s' '{{\"id\":\"aikit.gateway.agent\",\"mutation_class\":\"externally-mutating\"}}'; exit 0; fi\nprintf '%s' \"$*\" > {d}/argv.txt\ncat > {d}/stdin.txt\nprintf '%s' '{canned}'\n"
        ),
    )
    .unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    path
}

/// A control is the registry's `aikit.gateway.agent` (O-I #1002): the kernel's `act` hands `oi act invoke` the binding and
/// the operation — and the model, for `model` — on stdin, and AIKit's answer comes back verbatim. AIKit's own argv for it, and
/// its refusal of a value on an operation that takes none, are AIKit's own (aikit-cli act.rs `route_argv`, gateway_ops.rs
/// `conversation_operation`), so they hold by every door.
#[test]
fn a_control_is_the_registrys_gateway_agent_action() {
    let dir = unique_dir("control");
    let canned = r#"{"ok":true,"data":{"type":"conversation","binding_ref":"gateway-binding/t","operation":{"op":"model","model":"gpt-5"}},"schema":1}"#;
    std::env::set_var("OI_BIN", fake_oi(&dir, canned));
    // No Central here: a root-register Action runs where the kernel is.
    let mut kernel = Kernel::new(CentralClient::with(
        dir.join("absent-central"),
        None,
        "O-I".into(),
    ));
    for (input, expected) in [
        (
            serde_json::json!({"binding": "gateway-binding/t", "operation": "new"}),
            serde_json::json!({"binding": "gateway-binding/t", "operation": "new"}),
        ),
        (
            serde_json::json!({"binding": "gateway-binding/t", "operation": "model", "model": "gpt-5"}),
            serde_json::json!({"binding": "gateway-binding/t", "operation": "model", "model": "gpt-5"}),
        ),
    ] {
        let op: KernelOp = serde_json::from_value(serde_json::json!({
            "op": "act", "action": "aikit.gateway.agent", "input": input
        }))
        .expect("the shell's control is a kernel act");
        let outcome = kernel
            .apply(op)
            .expect("the control routes through the registry");
        let KernelOpResult::ActionDispatched {
            dispatch,
            reads_only,
        } = outcome.result
        else {
            panic!("the control answers with the Action's dispatch");
        };
        assert!(!reads_only);
        let dispatch = serde_json::to_value(dispatch).unwrap();
        assert_eq!(dispatch["state"], "invoked", "{dispatch}");
        assert_eq!(
            dispatch["data"],
            serde_json::from_str::<serde_json::Value>(canned).unwrap(),
            "AIKit's answer, verbatim"
        );
        let argv = std::fs::read_to_string(dir.join("argv.txt")).unwrap();
        assert_eq!(argv, "act invoke aikit.gateway.agent --input - --json");
        let stdin: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(dir.join("stdin.txt")).unwrap()).unwrap();
        assert_eq!(stdin, expected);
    }
    std::env::remove_var("OI_BIN");
}

/// Against the real registry (`OI_BIN`, routing to `OI_AIKIT_BIN`) and a
/// gateway this test does not start: `AIKIT_HOME` names an isolated home
/// whose gateway serves `OI_AIKIT_GATEWAY_BINDING`. The model and
/// pause/resume controls reach it as `aikit.gateway.agent` and its answer
/// comes back verbatim, inside AIKit's envelope.
#[ignore = "requires OI_BIN, OI_AIKIT_BIN and an isolated running gateway (AIKIT_HOME, OI_AIKIT_GATEWAY_BINDING)"]
#[test]
fn the_rack_controls_reach_a_real_gateway() {
    let binding = std::env::var("OI_AIKIT_GATEWAY_BINDING").unwrap();
    let dir = unique_dir("rack");
    let mut kernel = Kernel::new(CentralClient::with(
        dir.join("absent-central"),
        None,
        "O-I".into(),
    ));
    let mut answer = |operation: &str, model: Option<&str>| {
        let mut input = serde_json::json!({"binding": binding, "operation": operation});
        if let Some(model) = model {
            input["model"] = serde_json::json!(model);
        }
        let op: KernelOp = serde_json::from_value(
            serde_json::json!({"op": "act", "action": "aikit.gateway.agent", "input": input}),
        )
        .unwrap();
        let outcome = kernel.apply(op).expect("the control reaches the gateway");
        let KernelOpResult::ActionDispatched { dispatch, .. } = outcome.result else {
            panic!("the control answers with the Action's dispatch");
        };
        let dispatch = serde_json::to_value(dispatch).unwrap();
        eprintln!("{dispatch}");
        assert_eq!(dispatch["state"], "invoked", "{dispatch}");
        dispatch["data"]["data"].clone()
    };
    let model = answer("model", Some("gpt-5"));
    assert_eq!(model["operation"]["op"], "model", "{model}");
    assert_eq!(model["operation"]["model"], "gpt-5", "{model}");
    let paused = answer("pause", None);
    assert_eq!(paused["result"]["paused"], true, "{paused}");
    let resumed = answer("resume", None);
    assert_eq!(resumed["result"]["paused"], false, "{resumed}");
}

#[ignore = "requires the OI_AIKIT_BIN frozen native candidate; the fake-executable tests above carry the contract in every other tier"]
#[test]
fn an_offline_gateway_refuses_as_named_data_never_a_kernel_error() {
    let home = unique_dir("offline");
    let mut kernel = Kernel::with_agency(
        CentralClient::discover(),
        Client::with(candidate(), Some(home.clone())),
    );
    let outcome = kernel
        .apply(KernelOp::HarnessAgentRead {
            binding: "gateway-binding/telegram".to_owned(),
        })
        .expect("an unreachable gateway is a refused answer, not a failure");
    let KernelOpResult::HarnessAgentReading { document, .. } = outcome.result else {
        panic!("the read answers with the reading");
    };
    assert_eq!(document["refused"], true, "named data: {document}");
    let message = document["message"].as_str().unwrap_or_default();
    assert!(
        message.contains("gateway"),
        "the owner's own words name the gateway: {message}"
    );
}
