#[allow(dead_code)]
#[path = "../src/factory.rs"]
mod factory;
// The test needs part of the material module, not all of it; the unused rest
// is the library's, not dead code of this test's making.
#[allow(dead_code)]
#[path = "../src/material.rs"]
mod material;
use std::{
    fs,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
#[test]
#[ignore = "requires actual OI_BIN/OI_FACTORY_BIN/OI_ACTUATION_BIN and FACTORY_FIXTURE_BIN native constructor"]
fn actual_factory_binding_snapshot_intent_and_no_fabricated_authority() {
    let root = std::env::temp_dir().join(format!(
        "oi-kernel-factory-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&root).unwrap();
    std::env::set_var("FACTORY_HOME", root.join("factory"));
    std::env::set_var("ACTUATION_HOME", root.join("actuation"));
    let client = factory::Client::discover();
    assert!(client.bindings(None).unwrap().is_empty());
    let output = Command::new(std::env::var_os("FACTORY_FIXTURE_BIN").unwrap())
        .arg(&root)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let rows = client.bindings(None).unwrap();
    assert_eq!(rows.len(), 1);
    let binding = &rows[0];
    assert_eq!(
        client.bindings(Some(&binding.project_ref)).unwrap().len(),
        1
    );
    let snapshot = client.snapshot(&binding.binding_ref).unwrap();
    let subject = snapshot.view["candidates"][0]["candidateRef"]
        .as_str()
        .unwrap();
    let action = snapshot.view["actions"][0]["actionRef"].as_str().unwrap();
    let intent = factory::Intent {
        action_ref: action.into(),
        subject_ref: subject.into(),
        caller_ref: "local:kernel-native-test".into(),
        expected_revision: snapshot.revision,
    };
    let requested = client.intent(&binding.binding_ref, &intent).unwrap();
    assert_eq!(requested.operation["run_ref"], binding.run_ref);
    let output = Command::new(std::env::var_os("OI_BIN").unwrap())
        .args([
            "actuation",
            "authority",
            "approve",
            &requested.ref_id,
            "--json",
        ])
        .stdin(std::process::Stdio::null())
        .output()
        .unwrap();
    assert!(!output.status.success());
    let denied = client
        .invoke(
            &binding.binding_ref,
            &factory::Invocation {
                action_ref: intent.action_ref.clone(),
                subject_ref: intent.subject_ref.clone(),
                caller_ref: intent.caller_ref.clone(),
                expected_revision: intent.expected_revision,
                grant_ref: "actuation:grant:00000000-0000-0000-0000-000000000000".into(),
            },
        )
        .unwrap();
    assert!(!denied.ok);
    assert!(denied.authority_consumption.is_none());
    assert_eq!(
        client.snapshot(&binding.binding_ref).unwrap().revision,
        snapshot.revision
    );
    // A controlling PTY proves the native local-confirmation channel, not human authentication.
    let approved = Command::new("python3")
        .arg(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/factory_confirm.py"
        ))
        .args([&requested.ref_id, &requested.digest])
        .output()
        .unwrap();
    assert!(
        approved.status.success(),
        "{}",
        String::from_utf8_lossy(&approved.stderr)
    );
    let grant: serde_json::Value = serde_json::from_slice(&approved.stdout).unwrap();
    assert_eq!(grant["confirmation"]["authenticated_human"], false);
    let completed = client
        .invoke(
            &binding.binding_ref,
            &factory::Invocation {
                action_ref: intent.action_ref,
                subject_ref: intent.subject_ref,
                caller_ref: intent.caller_ref,
                expected_revision: intent.expected_revision,
                grant_ref: grant["ref"].as_str().unwrap().into(),
            },
        )
        .unwrap();
    assert!(completed.ok, "{:?}", completed.error);
    assert_eq!(
        completed.authority_consumption.as_ref().unwrap()["state"],
        "consumed"
    );
    assert_eq!(
        client.snapshot(&binding.binding_ref).unwrap().revision,
        snapshot.revision + 1
    );
    fs::remove_dir_all(root).unwrap();
}
