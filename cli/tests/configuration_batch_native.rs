//! Read-only native acceptance: this uses the installed owner programs and
//! current world. No fixture transport or substituted owner can pass it.
use serde_json::{json, Value};
use std::io::Write;
use std::process::{Command, Stdio};

#[test]
#[ignore = "requires the installed suite and real current world; read-only acceptance"]
fn native_resolution_batch_preserves_order_names_and_per_address_failure() {
    let request = json!([
        {"setting_ref":"ai-kit:skills:skills.capabilities","scope":{"scope_kind":"machine","scope_ref":null}},
        {"setting_ref":"ai-kit:skills:skills.capabilities","scope":{"scope_kind":"machine","scope_ref":null}},
        {"setting_ref":"ai-kit:skills:does-not-exist","scope":{"scope_kind":"machine","scope_ref":null}}
    ]);
    let mut child = Command::new(env!("CARGO_BIN_EXE_oi"))
        .args(["config", "resolve", "--request-file", "-", "--json"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(serde_json::to_vec(&request).unwrap().as_slice())
        .unwrap();
    let output = child.wait_with_output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let reading: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(reading["schema"], "oi.config-resolutions/v1");
    let rows = reading["resolutions"].as_array().unwrap();
    assert_eq!(rows.len(), 3);
    assert_eq!(rows[0]["schema"], "oi.config-resolution/v1");
    assert_eq!(rows[0]["setting_ref"], request[0]["setting_ref"]);
    assert_eq!(rows[0]["native"], rows[1]["native"]);
    assert_eq!(
        rows[0]["native_reading"]["reading_digest"],
        rows[1]["native_reading"]["reading_digest"]
    );
    assert!(
        !rows[0]["native"].is_null(),
        "AIKit must actually disclose native skill state: {}",
        rows[0]
    );
    assert_eq!(rows[2]["schema"], "oi.config-error/v1");
    println!("native batch: two ordered skill resolutions share owner state; unsupported address retains its error");
}
