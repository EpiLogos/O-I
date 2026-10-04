//! These exercise the real private original-operation reservation owner.
//! They issue no Source, producer, consumer acknowledgement or Envelope.
use super::*;

fn intent(reference: &str) -> Intent {
    Intent {
        basis: Basis {
            expression_ref: "expression:compilation-custody".into(),
            document_revision: 1,
            scene_ref: "scene:compilation-custody".into(),
        },
        operation_ref: reference.into(),
        source: json!({"subject_ref":"subject:original"}),
        profile: ReadingRef {
            r#ref: "profile:original".into(),
            revision: "revision:1".into(),
            availability: crate::expression::Availability::Available,
        },
        authored: json!({"procedure_ref":"procedure:original"}),
        choice: json!({"recipe":"scene_material"}),
        scope: Scope::Scenes {
            scene_refs: vec!["scene:compilation-custody".into()],
        },
        action: Action::Prepare,
    }
}

#[test]
fn in_flight_lookup_retains_original_intent_without_a_material_grant() {
    let mut owner = Memos::default();
    let request = intent("operation:in-flight");
    assert!(owner.compilation_retry(&request).unwrap().is_none());
    owner
        .begin(
            &request,
            "document:fingerprint".into(),
            "context:fingerprint",
            &(),
        )
        .unwrap();
    let actual = owner.compilation_retry(&request).unwrap().unwrap();
    assert_eq!(actual["state"], "pending_compilation");
    assert_eq!(
        actual["original_intent"],
        serde_json::to_value(&request).unwrap()
    );
    assert_eq!(
        actual["qualification"],
        "original_native_compilation_in_flight"
    );
    assert_eq!(actual["envelope"], Value::Null);
    assert_eq!(actual["source_current"], false);
    assert_eq!(actual["native_procedural_receipts"], json!([]));
    for name in ["admission", "preview", "operation", "prepared"] {
        assert!(!actual.as_object().unwrap().contains_key(name));
    }
}

#[test]
fn duplicate_dispatch_and_changed_subject_cannot_replace_the_original_reservation() {
    let mut owner = Memos::default();
    let original = intent("operation:original");
    let serial = owner
        .begin(
            &original,
            "document:fingerprint".into(),
            "context:fingerprint",
            &(),
        )
        .unwrap();
    assert!(owner
        .begin(
            &original,
            "document:fingerprint".into(),
            "context:fingerprint",
            &(),
        )
        .is_err());
    let mut changed = original.clone();
    changed.source["subject_ref"] = json!("subject:other");
    assert!(owner.compilation_retry(&changed).is_err());
    assert_eq!(owner.compiling[&original.operation_ref].serial, serial);
    assert_eq!(owner.compiling[&original.operation_ref].intent, original);
    assert!(owner.compiling[&original.operation_ref].refusal.is_none());
}

#[test]
fn only_original_worker_serial_can_settle_and_retry_returns_its_exact_refusal() {
    let mut owner = Memos::default();
    let request = intent("operation:failed");
    let serial = owner
        .begin(
            &request,
            "document:fingerprint".into(),
            "context:fingerprint",
            &(),
        )
        .unwrap();
    let reason = "Actual stateless compiler rejected its selected native relation";
    assert!(owner
        .refuse(&request.operation_ref, serial + 1, reason.into())
        .is_err());
    assert_eq!(
        owner.compilation_retry(&request).unwrap().unwrap()["state"],
        "pending_compilation"
    );
    let initial = owner
        .refuse(&request.operation_ref, serial, reason.into())
        .unwrap();
    assert_eq!(initial["reason"], reason);
    assert_eq!(initial["state"], "known_refusal");
    assert!(owner
        .refuse(&request.operation_ref, serial, "replacement reason".into())
        .is_err());
    let repeated = owner.compilation_retry(&request).unwrap().unwrap();
    assert_eq!(repeated["reason"], initial["reason"]);
    assert_eq!(repeated["original_intent"], initial["original_intent"]);
    assert_eq!(repeated["found"], true);
    assert_eq!(repeated["repeated"], true);
    assert_eq!(repeated["source_current"], false);
    assert_eq!(
        repeated["qualification"],
        "original_native_compilation_refusal"
    );
    assert_eq!(repeated["native_procedural_receipts"], json!([]));
}

#[test]
fn byte_refusal_preserves_prior_reservation_and_does_not_consume_a_serial() {
    let mut owner = Memos::default();
    let original = intent("operation:retained");
    let serial = owner
        .begin(
            &original,
            "document:fingerprint".into(),
            "context:fingerprint",
            &(),
        )
        .unwrap();
    let mut oversized = intent("operation:oversized");
    oversized.authored =
        json!({"body":"x".repeat(crate::expression::procedural::budget::SOURCE_BYTES)});
    assert!(owner
        .begin(
            &oversized,
            "document:fingerprint".into(),
            "context:fingerprint",
            &(),
        )
        .is_err());
    assert_eq!(owner.next_serial, serial);
    assert_eq!(owner.compiling.len(), 1);
    assert_eq!(owner.compiling[&original.operation_ref].intent, original);
    assert!(owner.compilation_retry(&oversized).unwrap().is_none());
}

#[test]
fn in_flight_and_terminal_refusals_share_the_actual_existing_cardinality_bound() {
    let mut owner = Memos::default();
    for index in 0..MAX_MEMOS {
        let request = intent(&format!("operation:{index}"));
        let serial = owner
            .begin(
                &request,
                "document:fingerprint".into(),
                "context:fingerprint",
                &(),
            )
            .unwrap();
        if index % 2 == 0 {
            owner
                .refuse(
                    &request.operation_ref,
                    serial,
                    "Original native refusal".into(),
                )
                .unwrap();
        }
    }
    let last = owner.next_serial;
    assert!(owner
        .begin(
            &intent("operation:overflow"),
            "document:fingerprint".into(),
            "context:fingerprint",
            &(),
        )
        .is_err());
    assert_eq!(owner.next_serial, last);
    assert_eq!(owner.compiling.len(), MAX_MEMOS);
    assert!(owner.rows.is_empty());
}

#[test]
fn captured_compilation_and_retained_reservation_share_one_aggregate_budget() {
    let mut owner = Memos::default();
    let mut request = intent("operation:aggregate");
    request.authored = json!({"body":"r".repeat(3 * 1024 * 1024)});
    let captured = "c".repeat(6 * 1024 * 1024);
    assert!(owner
        .begin(
            &request,
            "document:fingerprint".into(),
            "context:fingerprint",
            &captured
        )
        .is_err());
    assert_eq!(owner.next_serial, 0);
    assert!(owner.compiling.is_empty());
    assert!(owner.rows.is_empty());
}

#[test]
fn two_live_individually_admissible_captures_cannot_exceed_the_joined_horizon() {
    let mut owner = Memos::default();
    let first = intent("operation:large-first");
    let capture = "x".repeat(5 * 1024 * 1024);
    let serial = owner
        .begin(
            &first,
            "document:fingerprint".into(),
            "context:fingerprint",
            &capture,
        )
        .unwrap();
    assert_eq!(
        owner.compiling[&first.operation_ref].captured_bytes,
        capture.len() + 2
    );
    let second = intent("operation:large-second");
    assert!(owner
        .begin(
            &second,
            "document:fingerprint".into(),
            "context:fingerprint",
            &capture
        )
        .is_err());
    assert_eq!(owner.next_serial, serial);
    assert_eq!(owner.compiling.len(), 1);
    assert_eq!(owner.compiling[&first.operation_ref].intent, first);
    assert_eq!(
        owner.compilation_retry(&first).unwrap().unwrap()["state"],
        "pending_compilation"
    );
}

#[test]
fn original_escaped_native_diagnostic_settles_with_the_reserved_terminal_room() {
    let mut owner = Memos::default();
    let request = intent("operation:escaped-failure");
    let capture = "x"
        .repeat(crate::expression::procedural::budget::SOURCE_BYTES - FAILURE_ROOM - 4096 - 2048);
    let serial = owner
        .begin(
            &request,
            "document:fingerprint".into(),
            "context:fingerprint",
            &capture,
        )
        .unwrap();
    let diagnostic = "\u{1}".repeat(2048);
    let reason = format!("native-expression.procedural_source_refused: ql scene procedural library exited exit status: 1: {diagnostic}");
    let serialized_twins = serde_json::to_vec(&(&reason, &reason)).unwrap();
    assert!(serialized_twins.len() > 16 * 1024 + 4096);
    assert!(serialized_twins.len() < FAILURE_ROOM);
    let actual = owner
        .refuse(&request.operation_ref, serial, reason.clone())
        .unwrap();
    assert_eq!(actual["state"], "known_refusal");
    assert_eq!(actual["reason"], reason);
    let repeated = owner.compilation_retry(&request).unwrap().unwrap();
    assert_eq!(repeated["reason"], actual["reason"]);
    assert_eq!(repeated["native_procedural_receipts"], json!([]));
}

#[test]
fn a_new_owner_never_reuses_an_old_opaque_worker_serial() {
    let request = intent("operation:owner-reopen");
    let mut old = Memos::default();
    let old_serial = old
        .begin(
            &request,
            "document:fingerprint".into(),
            "context:fingerprint",
            &(),
        )
        .unwrap();
    let mut new = Memos::default();
    let new_serial = new
        .begin(
            &request,
            "document:fingerprint".into(),
            "context:fingerprint",
            &(),
        )
        .unwrap();
    assert_ne!(old_serial, new_serial);
    assert!(new
        .refuse(
            &request.operation_ref,
            old_serial,
            "old worker failure".into()
        )
        .is_err());
    assert_eq!(
        new.compilation_retry(&request).unwrap().unwrap()["state"],
        "pending_compilation"
    );
}

#[path = "native_expression_procedural_stage_capture_tests.rs"]
mod departed_capture_tests;
