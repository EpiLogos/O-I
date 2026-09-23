//! The two task-scoped Factory attempt reads through the actual kernel
//! dispatcher (F03). A fake owner executable stands in for the installed
//! `factory`/`oi`: it records the exact argv it received and emits the owner's
//! own contract, so the test proves the dispatcher builds the right command
//! (state path, run, task, limit, cursor), prefixes the product namespace once
//! on the suite route and not at all on the direct route, carries the payload
//! verbatim, and refuses an incompatible contract — no comment is trusted for
//! the routing.
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::json;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;

fn write_fake(dir: &std::path::Path, args_file: &std::path::Path) -> PathBuf {
    let script = format!(
        "#!/bin/sh\nfor a in \"$@\"; do printf '%s\\n' \"$a\" >> \"{args}\"; done\n\
         if [ \"$1\" = \"factory\" ]; then shift; fi\nsub=\"$2\"\n\
         if [ \"${{FAKE_FACTORY_BAD:-0}}\" = \"1\" ]; then echo '{{\"contract\":\"factory.wrong/v1\"}}'\n\
         elif [ \"$sub\" = \"list\" ]; then echo '{{\"contract\":\"factory.attempt-task-list-reading/v1\",\"projectRef\":\"proj\",\"runRef\":\"run:1\",\"runRevision\":3,\"taskRefs\":[\"task:a\",\"task:b\"],\"totalTasks\":2}}'\n\
         elif [ \"$sub\" = \"task\" ]; then echo '{{\"contract\":\"factory.attempt-task-reading/v1\",\"projectRef\":\"proj\",\"runRef\":\"run:1\",\"taskRef\":\"task:a\",\"revision\":5,\"runRevision\":3,\"topologyRevision\":1,\"sourceCurrent\":true,\"workflowSourceRef\":\"wf\",\"workflowSourceRevision\":\"r1\",\"workflowSourceDigest\":\"d1\",\"totalAttempts\":0,\"attempts\":[]}}'\n\
         fi\n",
        args = args_file.display()
    );
    let path = dir.join("fake-factory.sh");
    fs::write(&path, script).unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
    stub::settle_stub(&path);
    path
}

#[test]
fn task_scoped_attempt_reads_dispatch_to_the_owner_cli_and_verify_the_contract() {
    let dir = std::env::temp_dir().join(format!("oi-factory-attempt-{}", std::process::id()));
    fs::create_dir_all(&dir).unwrap();
    let args_file = dir.join("argv.txt");
    let fake = write_fake(&dir, &args_file);
    let state = dir.join("state");
    let read_args = || fs::read_to_string(&args_file).unwrap_or_default().lines().map(str::to_string).collect::<Vec<_>>();
    let reset = || { let _ = fs::remove_file(&args_file); };

    // Preserve and own the process-global owner-executable environment.
    let prior_factory = std::env::var_os("OI_FACTORY_BIN");
    let prior_oi = std::env::var_os("OI_BIN");
    std::env::set_var("OI_FACTORY_BIN", &fake);
    std::env::remove_var("FAKE_FACTORY_BAD");

    // Direct route: the task list command carries state and run, prefixes no
    // product namespace, and the payload comes back verbatim.
    reset();
    let list = Kernel::new(CentralClient::discover())
        .apply(KernelOp::FactoryAttemptTaskListRead { state_path: state.clone(), run_ref: "run:1".into() })
        .expect("attempt list dispatches");
    match list.result {
        KernelOpResult::FactoryAttemptTaskListReading { data } => {
            assert_eq!(data["contract"], "factory.attempt-task-list-reading/v1");
            assert_eq!(data["taskRefs"], json!(["task:a", "task:b"]));
        }
        other => panic!("unexpected result: {other:?}"),
    }
    let argv = read_args();
    assert_eq!(argv.first().map(String::as_str), Some("attempt"), "direct route adds no 'factory' prefix");
    assert!(argv.contains(&"list".to_string()) && argv.contains(&"run:1".to_string()) && argv.contains(&"--json".to_string()));

    // The task read carries the owner's pagination grammar verbatim.
    reset();
    let task = Kernel::new(CentralClient::discover())
        .apply(KernelOp::FactoryAttemptTaskRead {
            state_path: state.clone(),
            run_ref: "run:1".into(),
            task_ref: "task:a".into(),
            limit: Some(5),
            cursor: Some(json!({ "after": "attempt:x" })),
        })
        .expect("attempt task dispatches");
    assert!(matches!(task.result, KernelOpResult::FactoryAttemptTaskReading { .. }));
    let argv = read_args();
    for expected in ["attempt", "task", "task:a", "--json", "--limit", "5", "--cursor"] {
        assert!(argv.contains(&expected.to_string()), "task argv missing {expected}: {argv:?}");
    }
    assert!(argv.iter().any(|a| a.contains("attempt:x")), "cursor JSON carried: {argv:?}");

    // An incompatible contract is refused, not presented.
    reset();
    std::env::set_var("FAKE_FACTORY_BAD", "1");
    let refused = Kernel::new(CentralClient::discover())
        .apply(KernelOp::FactoryAttemptTaskListRead { state_path: state.clone(), run_ref: "run:1".into() });
    assert!(refused.is_err() && refused.unwrap_err().contains("incompatible"), "a wrong contract must refuse");
    std::env::remove_var("FAKE_FACTORY_BAD");

    // Suite route: through `oi` the product namespace names the route once.
    reset();
    std::env::remove_var("OI_FACTORY_BIN");
    std::env::set_var("OI_BIN", &fake);
    Kernel::new(CentralClient::discover())
        .apply(KernelOp::FactoryAttemptTaskListRead { state_path: state.clone(), run_ref: "run:1".into() })
        .expect("suite-route attempt list dispatches");
    let argv = read_args();
    assert_eq!(argv.first().map(String::as_str), Some("factory"), "suite route names the product namespace once");
    assert_eq!(argv.iter().filter(|a| a.as_str() == "factory").count(), 1, "never twice");

    // Restore the owner-executable environment.
    match prior_factory { Some(v) => std::env::set_var("OI_FACTORY_BIN", v), None => std::env::remove_var("OI_FACTORY_BIN") }
    match prior_oi { Some(v) => std::env::set_var("OI_BIN", v), None => std::env::remove_var("OI_BIN") }
    let _ = fs::remove_dir_all(&dir);
}
