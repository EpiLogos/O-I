//! The Factory owner request family (11-FACTORY §2/§3) through the actual
//! kernel dispatcher. A fake owner executable records the argv and stdin it
//! received and answers with the owner's own contracts, so the test proves the
//! dispatcher builds the owner's command grammar, carries payloads verbatim,
//! refuses an unexpected contract, surfaces the workflow family's stdout
//! diagnostic in the owner's own words, and sends the person's Recognition as
//! the owner's `record-owner-recognition` developmental mutation document.
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use oi_cradle_kernel::factory::OwnerRequest;
use serde_json::{json, Value};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;

fn write_fake(dir: &std::path::Path) -> PathBuf {
    let args = dir.join("argv.txt");
    let stdin = dir.join("stdin.json");
    let script = format!(
        "#!/bin/sh\nfor a in \"$@\"; do printf '%s\\n' \"$a\" >> \"{args}\"; done\n\
         if [ \"$1\" = \"factory\" ]; then shift; fi\n\
         case \"$1 $2\" in\n\
         'workflow inspect') if [ \"${{FAKE_REFUSE:-0}}\" = \"1\" ]; then echo '{{\"contract\":\"factory.workflow-diagnostic/v1\",\"error\":{{\"code\":\"workflow.inspection\",\"message\":\"Run has no native attempt field\"}}}}'; exit 2; fi; echo '{{\"contract\":\"factory.workflow-inspection/v1\",\"units\":[],\"legs\":{{}}}}' ;;\n\
         'development mutate') cat > \"{stdin}\"; echo '{{\"contract\":\"factory.developmental-mutation-receipt/v1\",\"status\":\"applied\"}}' ;;\n\
         'telemetry status') echo '{{\"contract\":\"factory.wrong/v1\"}}' ;;\n\
         *) echo '{{}}'; exit 3 ;;\n\
         esac\n",
        args = args.display(),
        stdin = stdin.display()
    );
    let path = dir.join("fake-factory.sh");
    fs::write(&path, script).unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
    path
}

fn data_of(result: KernelOpResult) -> Value {
    match result {
        KernelOpResult::FactoryDevelopmentReading { data } => data,
        other => panic!("unexpected result: {other:?}"),
    }
}

#[test]
fn factory_owner_requests_follow_the_owner_grammar() {
    let dir = std::env::temp_dir().join(format!("oi-factory-owner-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let fake = write_fake(&dir);
    let argv = || fs::read_to_string(dir.join("argv.txt")).unwrap_or_default().lines().map(str::to_string).collect::<Vec<_>>();
    let reset = || { let _ = fs::remove_file(dir.join("argv.txt")); };
    let prior = std::env::var_os("OI_FACTORY_BIN");
    std::env::set_var("OI_FACTORY_BIN", &fake);
    let state = dir.join("state.json");
    let apply = |request: OwnerRequest| Kernel::new(CentralClient::discover()).apply(KernelOp::FactoryOwner { request });

    // Workflow inspection: the owner's grammar, unit filter carried.
    reset();
    let data = data_of(apply(OwnerRequest::WorkflowInspect { state_path: state.clone(), run_ref: "run:1".into(), unit: Some("unit-a".into()), attempt: None, limit: Some(20), cursor: None }).expect("inspect dispatches").result);
    assert_eq!(data["contract"], "factory.workflow-inspection/v1");
    let seen = argv();
    assert_eq!(&seen[..4], &["workflow".to_string(), "inspect".into(), state.to_string_lossy().into_owned(), "run:1".into()]);
    for expected in ["--unit", "unit-a", "--limit", "20", "--json"] {
        assert!(seen.contains(&expected.to_string()), "missing {expected}: {seen:?}");
    }

    // The workflow family's refusal is a stdout diagnostic: its own words
    // reach the caller, not an empty stderr.
    std::env::set_var("FAKE_REFUSE", "1");
    let refused = apply(OwnerRequest::WorkflowInspect { state_path: state.clone(), run_ref: "run:1".into(), unit: None, attempt: None, limit: None, cursor: None });
    std::env::remove_var("FAKE_REFUSE");
    let error = refused.expect_err("the owner refused");
    assert!(error.contains("Run has no native attempt field"), "{error}");

    // An unexpected contract is refused, never presented.
    let wrong = apply(OwnerRequest::TelemetryStatus { state_path: state.clone() });
    assert!(wrong.is_err() && wrong.unwrap_err().contains("unexpected contract"));

    // Recognition: the owner's developmental mutation document on stdin.
    reset();
    let receipt = data_of(apply(OwnerRequest::Recognise { state_path: state.clone(), journey_ref: "journey:1".into(), subject_ref: "return:1".into(), basis_refs: vec!["evidence:1".into()] }).expect("recognise dispatches").result);
    assert_eq!(receipt["contract"], "factory.developmental-mutation-receipt/v1");
    assert_eq!(&argv()[..2], &["development".to_string(), "mutate".into()]);
    let sent: Value = serde_json::from_str(&fs::read_to_string(dir.join("stdin.json")).unwrap()).unwrap();
    assert_eq!(sent["contract"], "factory.developmental-mutation-request/v1");
    assert_eq!(sent["mutation"]["kind"], "record-owner-recognition");
    assert_eq!(sent["mutation"]["journeyRef"], "journey:1");
    assert_eq!(sent["mutation"]["recognition"]["subject_ref"], "return:1");
    let recognition_ref = sent["mutation"]["recognition"]["recognition_ref"].as_str().unwrap().to_owned();
    assert!(recognition_ref.starts_with("recognition:desk-"));
    // The owner requires the source reference among the basis refs.
    assert_eq!(sent["source"]["reference"], json!(recognition_ref));
    assert_eq!(sent["mutation"]["recognition"]["basis_refs"], json!([recognition_ref, "evidence:1"]));
    assert_eq!(sent["source"]["standing"], "owner-native-observation");

    match prior { Some(value) => std::env::set_var("OI_FACTORY_BIN", value), None => std::env::remove_var("OI_FACTORY_BIN") }
    let _ = fs::remove_dir_all(&dir);
}
