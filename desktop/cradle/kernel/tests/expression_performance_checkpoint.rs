//! Actual Rust producer -> real C++ A/P play/sustain/tails/queued automation ->
//! native stopped paired checkpoint -> existing Expression retention consumer.
//! Both fixtures are mandatory products of the ordinary native producer gate.
use oi_cradle_kernel::expression_performance::{
    CheckpointBinding, CheckpointReceipt, Counter, PerformanceBasis,
};
use serde_json::Value;
fn read(name: &str) -> Value {
    let path = std::env::var(name).expect(
        "actual native producer fixture must be generated before tests; no synthetic fallback",
    );
    let bytes = std::fs::read(path).unwrap();
    assert!(bytes.len() <= 32 * 1024 * 1024);
    serde_json::from_slice(&bytes).unwrap()
}
fn actual() -> (CheckpointReceipt, Value) {
    let source = read("QL_RETAINED_PERFORMANCE_FIXTURE");
    assert_eq!(source["schema"], "ql.retained-performance-fixture/v1");
    let b = serde_json::from_value::<PerformanceBasis>(source["basis"].clone())
        .unwrap()
        .seal()
        .unwrap();
    let played = read("QL_RETAINED_PERFORMANCE_CHECKPOINT_FIXTURE");
    assert_eq!(
        played["schema"],
        "ql.retained-performance-checkpoint-fixture/v1"
    );
    let pair = played["native_pair"].clone();
    assert_eq!(pair["schema"], "ql.performance-physical-checkpoint/v1");
    let sample: Counter = serde_json::from_value(pair["audio"]["cursor"].clone()).unwrap();
    assert_eq!(
        sample.0, 1024,
        "checkpoint fixture must retain actual played state"
    );
    assert_eq!(pair["audio"]["sustain"], true);
    assert_eq!(
        pair["physical"]["state"]["samples_elapsed"],
        pair["audio"]["cursor"]
    );
    // The producer emitted this exact pending-event map after real enqueue/play;
    // it is not reconstructed from a UI timeline or a guessed sample ordinal.
    let queued_events = serde_json::from_value(played["queued_events"].clone()).unwrap();
    let prefix = format!(
        "sha256:{:x}",
        sha2::Sha256::digest(serde_json::to_vec(&pair["audio"]["source_schedule"]).unwrap())
    );
    (
        CheckpointReceipt {
            checkpoint_ref: "native:actual-paired-fixture/1024".into(),
            identity: b.identity,
            basis_digest: b.content_digest,
            event_prefix_digest: prefix,
            sample,
            queued_events,
            acknowledged_stopped: true,
        },
        pair,
    )
}
use sha2::Digest;
#[test]
fn actual_played_paired_state_roundtrips_losslessly_through_native_expression_checkpoint() {
    let (receipt, pair) = actual();
    let retained = CheckpointBinding::from_native_pair(receipt, pair.clone()).unwrap();
    assert_eq!(retained.native_pair_wire().unwrap(), pair);
    let saved = serde_json::to_vec(&retained).unwrap();
    let reopened: CheckpointBinding = serde_json::from_slice(&saved).unwrap();
    reopened.validate().unwrap();
    assert_eq!(reopened.native_pair_wire().unwrap(), pair);
    assert_eq!(reopened.sample, Counter(1024));
    assert_eq!(reopened.queued_events.len(), 2);
    assert!(reopened.physical["state"]["displacement_modal_metres"]
        .as_array()
        .unwrap()
        .iter()
        .any(|n| n.as_f64().unwrap() != 0.0));
    assert!(
        reopened.physical["state"]["velocity_modal_metres_per_second"]
            .as_array()
            .unwrap()
            .iter()
            .any(|n| n.as_f64().unwrap() != 0.0)
    );
    // Actual oscillator envelopes/touches/tails and source schedule remain the
    // exact bytes supplied by the native owner, not a seed-only re-creation.
    for key in [
        "voices",
        "touches",
        "tails",
        "source_schedule",
        "source_parameters",
        "effective_parameters",
    ] {
        assert_eq!(reopened.audio[key], pair["audio"][key]);
    }
}
#[test]
fn lost_actual_voice_body_velocity_source_or_queue_mapping_refuses_retention() {
    let (receipt, pair) = actual();
    for (owner, key) in [
        ("audio", "voices"),
        ("audio", "touches"),
        ("audio", "source_schedule"),
        ("audio", "source_parameters"),
        ("physical", "units"),
    ] {
        let mut broken = pair.clone();
        assert!(broken[owner].as_object_mut().unwrap().remove(key).is_some());
        assert!(
            CheckpointBinding::from_native_pair(receipt.clone(), broken).is_err(),
            "lost{owner}/{key}"
        );
    }
    let mut broken = pair.clone();
    assert!(broken["physical"]["state"]
        .as_object_mut()
        .unwrap()
        .remove("velocity_modal_metres_per_second")
        .is_some());
    assert!(CheckpointBinding::from_native_pair(receipt.clone(), broken).is_err());
    let mut missing = receipt.clone();
    missing.queued_events.remove(0);
    assert!(CheckpointBinding::from_native_pair(missing, pair.clone()).is_err());
    let mut wrong = pair.clone();
    wrong["physical"]["state"]["samples_elapsed"] = serde_json::json!("1025");
    assert!(CheckpointBinding::from_native_pair(receipt.clone(), wrong).is_err());
    let mut wrong = pair.clone();
    wrong["physical"]["identity"]["subject_ref"] = serde_json::json!("foreign-person");
    assert!(CheckpointBinding::from_native_pair(receipt, wrong).is_err());
    let (receipt, pair) = actual();
    let mut altered = CheckpointBinding::from_native_pair(receipt, pair).unwrap();
    altered.audio["voices"][0]["voice"]["envelope"] = serde_json::json!(0.0);
    assert!(
        altered.validate().is_err(),
        "sealed played state cannot be altered after source retention"
    );
}
