//! The harness-agent session surface: `KernelOp::HarnessAgentRead/Control`
//! route the AIKit gateway's canonical conversation control through the
//! owner's own CLI. The kernel owns no session state: the gateway's answer
//! passes through verbatim, and its refusal is named data — proven here
//! against the exact candidate executable with an isolated AIKIT_HOME where
//! no gateway runs (CI-safe: offline honesty is the contract under test).

use oi_cradle_kernel::agency::Client;
use oi_cradle_kernel::flow::CentralClient;
use oi_cradle_kernel::{HarnessAgentControl, Kernel, KernelOp, KernelOpResult};

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

#[test]
fn lifecycle_controls_reach_the_gateway_as_the_canonical_verbs() {
    let dir = unique_dir("control");
    let fake = fake_aikit(
        &dir,
        r#"{"ok":true,"data":{"type":"new","started":true},"schema":1}"#,
        true,
    );
    let mut kernel = Kernel::with_agency(
        CentralClient::discover(),
        Client::with(fake, Some(dir.clone())),
    );
    let outcome = kernel
        .apply(KernelOp::HarnessAgentControl {
            binding: "gateway-binding/t".to_owned(),
            control: HarnessAgentControl::New,
            model: None,
        })
        .expect("the control routes through the owner CLI");
    let KernelOpResult::HarnessAgentOutcome {
        control, document, ..
    } = outcome.result
    else {
        panic!("the control answers with the outcome");
    };
    assert_eq!(control, HarnessAgentControl::New);
    assert_eq!(document["type"], "new");
    let argv = std::fs::read_to_string(dir.join("argv.txt")).unwrap();
    assert!(argv.contains(" new"), "the canonical verb travels: {argv}");
}

/// The rack's Model is AIKit's `gateway agent <B> model --model <ID>` (aikit-cli
/// cli.rs GatewayAgentArgs `model`, gateway_ops.rs conversation_operation):
/// the one value-carrying conversation operation AIKit has. The id travels as
/// AIKit's own flag, never as an invented `configure` carrier.
#[test]
fn the_model_control_carries_the_model_id_as_aikits_own_flag() {
    let dir = unique_dir("model");
    let fake = fake_aikit(
        &dir,
        r#"{"ok":true,"data":{"type":"conversation","binding_ref":"gateway-binding/t","operation":{"op":"model","model":"gpt-5"},"result":{"available":false,"reason":"this conversation has no agent backing"}},"schema":1}"#,
        true,
    );
    let mut kernel = Kernel::with_agency(
        CentralClient::discover(),
        Client::with(fake, Some(dir.clone())),
    );
    let op: KernelOp = serde_json::from_value(serde_json::json!({
        "op": "harness_agent_control", "binding": "gateway-binding/t", "control": "model", "model": "gpt-5"
    }))
    .expect("the shell's model call is a kernel op");
    let outcome = kernel
        .apply(op)
        .expect("the model control routes through the owner CLI");
    let KernelOpResult::HarnessAgentOutcome {
        control, document, ..
    } = outcome.result
    else {
        panic!("the control answers with the outcome");
    };
    assert_eq!(control, HarnessAgentControl::Model);
    assert_eq!(document["operation"]["model"], "gpt-5");
    let argv = std::fs::read_to_string(dir.join("argv.txt")).unwrap();
    assert!(
        argv.ends_with("--json gateway agent --binding gateway-binding/t model --model gpt-5"),
        "AIKit's own argv travels: {argv}"
    );
}

/// A value rides only the control AIKit gives a value to: a model on `stop`
/// is refused before anything is asked, and `configure` is no control at all.
#[test]
fn a_value_on_a_control_aikit_gives_none_is_refused() {
    let dir = unique_dir("misplaced");
    let fake = fake_aikit(&dir, r#"{"ok":true,"data":{},"schema":1}"#, true);
    let mut kernel = Kernel::with_agency(
        CentralClient::discover(),
        Client::with(fake, Some(dir.clone())),
    );
    let error = kernel
        .apply(KernelOp::HarnessAgentControl {
            binding: "gateway-binding/t".to_owned(),
            control: HarnessAgentControl::Stop,
            model: Some("gpt-5".to_owned()),
        })
        .expect_err("a model on stop is refused");
    assert!(error.contains("model"), "named: {error}");
    assert!(!dir.join("argv.txt").exists(), "nothing reached AIKit");
    let configure = serde_json::from_value::<KernelOp>(serde_json::json!({
        "op": "harness_agent_control", "binding": "b", "control": "configure", "value": {"effort": "high"}
    }));
    assert!(configure.is_err(), "configure is no AIKit operation");
}

/// Against the real AIKit (OI_AIKIT_BIN) and a gateway this test does not
/// start: `OI_AIKIT_GATEWAY_HOME` names an isolated AIKIT_HOME whose gateway
/// serves `OI_AIKIT_GATEWAY_BINDING`. The model and pause/resume controls
/// reach it with AIKit's own argv and its answer comes back verbatim.
#[ignore = "requires OI_AIKIT_BIN and an isolated running gateway (OI_AIKIT_GATEWAY_HOME, OI_AIKIT_GATEWAY_BINDING)"]
#[test]
fn the_rack_controls_reach_a_real_gateway() {
    let home = std::path::PathBuf::from(std::env::var_os("OI_AIKIT_GATEWAY_HOME").unwrap());
    let binding = std::env::var("OI_AIKIT_GATEWAY_BINDING").unwrap();
    let mut kernel = Kernel::with_agency(
        CentralClient::discover(),
        Client::with(candidate(), Some(home)),
    );
    let mut answer = |control, model: Option<&str>| {
        let outcome = kernel
            .apply(KernelOp::HarnessAgentControl {
                binding: binding.clone(),
                control,
                model: model.map(str::to_owned),
            })
            .expect("the control reaches the gateway");
        let KernelOpResult::HarnessAgentOutcome { document, .. } = outcome.result else {
            panic!("the control answers with the outcome");
        };
        eprintln!("{document}");
        document
    };
    let model = answer(HarnessAgentControl::Model, Some("gpt-5"));
    assert_eq!(model["operation"]["op"], "model", "{model}");
    assert_eq!(model["operation"]["model"], "gpt-5", "{model}");
    let paused = answer(HarnessAgentControl::Pause, None);
    assert_eq!(paused["result"]["paused"], true, "{paused}");
    let resumed = answer(HarnessAgentControl::Resume, None);
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
