#[path = "../src/material.rs"]
mod material;
use std::{
    fs,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
#[test]
#[ignore = "requires actual OI_BIN and OI_WORKCELL_BIN frozen native candidates"]
fn receipt_bound_native_material_and_identity_refusal() {
    let root = std::env::temp_dir().join(format!(
        "oi-kernel-material-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&root).unwrap();
    let receipt = root.join("receipt.json");
    let state = root.join("state");
    let oi = std::env::var_os("OI_BIN").unwrap();
    let output = Command::new(&oi)
        .args(["workcell", "--json", "--state-root"])
        .arg(&state)
        .arg("--receipt")
        .arg(&receipt)
        .args(["prepare", "--require", "shell"])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let client = material::Client::discover();
    let mut target = material::Target {
        receipt: receipt.clone(),
        state_root: state,
        endpoint: None,
        expected_world_ref: None,
    };
    let reading = client.read(&target).unwrap();
    assert_eq!(reading.bodies.as_ref().unwrap().len(), 0);
    target.expected_world_ref = Some(reading.receipt_world["world_ref"].as_str().unwrap().into());
    assert!(client.read(&target).is_ok());
    target.expected_world_ref = Some("world:wrong-subject".into());
    assert_eq!(client.read(&target).unwrap_err().kind, "identity-mismatch");
    fs::remove_file(receipt).unwrap();
    assert!(client.read(&target).is_err());
    fs::remove_dir_all(root).unwrap();
}
