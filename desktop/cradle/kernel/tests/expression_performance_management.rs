//! Consumes actual source-qualified Rust -> C++ native management fixtures.
//! The ordinary verification gate must generate them before the kernel suite.
use oi_cradle_kernel::expression_performance::{
    CheckpointBinding, CheckpointReceipt, Counter, PerformanceBasis,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

fn actual() -> (CheckpointReceipt, Value) {
    let source_path = std::env::var("QL_RETAINED_PERFORMANCE_FIXTURE")
        .expect("actual Rust source producer fixture is required");
    let source: Value = serde_json::from_slice(&std::fs::read(source_path).unwrap()).unwrap();
    let basis = serde_json::from_value::<PerformanceBasis>(source["basis"].clone())
        .unwrap()
        .seal()
        .unwrap();
    let path = std::env::var("QL_RETAINED_PERFORMANCE_MANAGEMENT_FIXTURE").expect(
        "actual source-qualified native managed checkpoint fixture is required; no fallback",
    );
    let bytes = std::fs::read(path).unwrap();
    assert!(bytes.len() <= 32 * 1024 * 1024);
    let produced: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(
        produced["schema"],
        "ql.retained-performance-management-fixture/v1"
    );
    let wire = produced["management_checkpoint"].clone();
    let physical = &wire["native_pair"]["physical"];
    // A numerical material-regression fixture has different explicit standing.
    // It cannot impersonate a new source-produced M3 form/body qualification.
    assert_eq!(
        physical["identity"]["source_generation"],
        json!(basis.identity.m3_generation.0.to_string())
    );
    assert_eq!(
        physical["identity"]["body_revision"],
        basis.audio_determination["body_revision"]
    );
    let sample: Counter =
        serde_json::from_value(wire["native_pair"]["audio"]["cursor"].clone()).unwrap();
    assert!(sample.0 > 0);
    assert!(!wire["inputs"].as_array().unwrap().is_empty());
    assert!(!wire["input_history"]["entries"]
        .as_array()
        .unwrap()
        .is_empty());
    let prefix = format!(
        "sha256:{:x}",
        Sha256::digest(
            serde_json::to_vec(&wire["native_pair"]["audio"]["source_schedule"]).unwrap()
        )
    );
    let receipt = CheckpointReceipt {
        checkpoint_ref: "native:actual-source-qualified-management-checkpoint".into(),
        identity: basis.identity,
        sample,
        basis_digest: basis.content_digest,
        event_prefix_digest: prefix,
        queued_events: serde_json::from_value(produced["queued_events"].clone()).unwrap(),
        acknowledged_stopped: true,
    };
    (receipt, wire)
}
#[test]
fn actual_original_input_target_pending_release_and_journal_reopen_without_loss() {
    let (receipt, wire) = actual();
    let retained = CheckpointBinding::from_native_management(receipt, wire.clone()).unwrap();
    assert_eq!(retained.native_management_wire().unwrap(), wire);
    let bytes = serde_json::to_vec(&retained).unwrap();
    let reopened: CheckpointBinding = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(reopened.native_management_wire().unwrap(), wire);
    // The pair is owned once, rather than duplicated inside the addition.
    let saved = serde_json::to_value(&reopened).unwrap();
    assert!(saved["management"].get("native_pair").is_none());
    assert_eq!(saved["management"]["inputs"], wire["inputs"]);
    assert_eq!(saved["management"]["input_history"], wire["input_history"]);
    assert_ne!(
        wire["inputs"][0]["input_ref"],
        wire["inputs"][0]["target"]["touch_ref"]
    );
}
#[test]
fn actual_missing_original_input_journal_target_or_pending_release_is_refused() {
    let (receipt, wire) = actual();
    for key in [
        "inputs",
        "input_history",
        "transport_epoch",
        "release_request",
        "native_pair",
    ] {
        let mut lost = wire.clone();
        assert!(lost.as_object_mut().unwrap().remove(key).is_some());
        assert!(
            CheckpointBinding::from_native_management(receipt.clone(), lost).is_err(),
            "lost {key}"
        );
    }
    for key in ["touch_ref", "identity", "ratio_numerator", "hertz"] {
        let mut lost = wire.clone();
        assert!(lost["inputs"][0]["target"]
            .as_object_mut()
            .unwrap()
            .remove(key)
            .is_some());
        assert!(
            CheckpointBinding::from_native_management(receipt.clone(), lost).is_err(),
            "lost target {key}"
        );
    }
    let mut wrong = wire.clone();
    wrong["inputs"][0]["target"]["hertz"] =
        json!(wire["inputs"][0]["target"]["hertz"].as_f64().unwrap() + 1.0);
    assert!(CheckpointBinding::from_native_management(receipt.clone(), wrong).is_err());
    let mut gap = wire.clone();
    gap["input_history"]["entries"]
        .as_array_mut()
        .unwrap()
        .remove(0);
    assert!(CheckpointBinding::from_native_management(receipt.clone(), gap).is_err());
    let mut leak = wire.clone();
    leak["inputs"][0]["target"]["identity"]["subject"] = json!("foreign:subject");
    assert!(CheckpointBinding::from_native_management(receipt.clone(), leak).is_err());
    let retained = CheckpointBinding::from_native_management(receipt, wire).unwrap();
    let mut altered = serde_json::to_value(retained).unwrap();
    altered["management"]["inputs"][0]["input_ref"] = json!("invented:replacement-pointer");
    assert!(serde_json::from_value::<CheckpointBinding>(altered)
        .unwrap()
        .validate()
        .is_err());
}
#[test]
fn paired_only_original_edition_keeps_its_exact_bytes_and_cannot_claim_input_custody() {
    let (receipt, wire) = actual();
    let original =
        CheckpointBinding::from_native_pair(receipt, wire["native_pair"].clone()).unwrap();
    let bytes = serde_json::to_vec(&original).unwrap();
    let decoded: CheckpointBinding = serde_json::from_slice(&bytes).unwrap();
    decoded.validate().unwrap();
    assert_eq!(serde_json::to_vec(&decoded).unwrap(), bytes);
    assert!(serde_json::to_value(&decoded)
        .unwrap()
        .get("management")
        .is_none());
    assert!(decoded.native_management_wire().is_err());
}
