//! Real private reservation/retirement functions, using distinct registries
//! under normal parallel tests. No global reset, Source or native ACK fixture.
use super::*;
use std::sync::Arc;

fn owner(registry: &Arc<capture::Registry>) -> Memos {
    Memos {
        captures: Arc::clone(registry),
        ..Memos::default()
    }
}

#[test]
fn native_default_owners_share_actual_process_capture_registry() {
    let first = Memos::default();
    let second = Memos::default();
    assert!(Arc::ptr_eq(&first.captures, &second.captures));
}

#[test]
fn actual_retired_owner_capture_stays_charged_in_reopened_owner_until_owned_material_retires() {
    let registry = Arc::new(capture::Registry::default());
    let mut original = owner(&registry);
    let capacity = 5 * 1024 * 1024 + 16384;
    let lease = registry.reserve(capacity, 0).unwrap();
    // The actual large input is allocated after its real resource reservation.
    let material = "x".repeat(5 * 1024 * 1024);
    let request = intent("operation:retired-large-capture");
    original
        .begin_reserved(
            &request,
            "actual-doc".into(),
            "actual-context",
            &material,
            Some(&lease),
        )
        .unwrap();
    assert!(original.compiling[&request.operation_ref]
        .capture_id
        .is_some());
    drop(original);
    let reopened = owner(&registry);
    let mut budget = crate::expression::procedural::budget::Budget::new();
    reopened.charge(&mut budget, None).unwrap();
    assert_eq!(budget.charged_bytes(), capacity);
    assert!(registry.reserve(4 * 1024 * 1024, 0).is_err());
    assert_eq!(material.len(), 5 * 1024 * 1024);
    // This is resource release, not recovery of the original owner's authority.
    assert!(reopened.compiling.is_empty() && reopened.rows.is_empty());
    drop(material);
    let mut still_reserved = crate::expression::procedural::budget::Budget::new();
    reopened.charge(&mut still_reserved, None).unwrap();
    assert_eq!(still_reserved.charged_bytes(), capacity);
    drop(lease);
    let next = registry.reserve(4 * 1024 * 1024, 0).unwrap();
    drop(next);
    let mut released = crate::expression::procedural::budget::Budget::new();
    reopened.charge(&mut released, None).unwrap();
    assert_eq!(released.charged_bytes(), 0);
}

#[test]
fn actual_process_capture_count_survives_owner_retirement_without_per_owner_reset() {
    let registry = Arc::new(capture::Registry::default());
    let original = owner(&registry);
    let leases = (0..MAX_MEMOS)
        .map(|_| registry.reserve(1, 0).unwrap())
        .collect::<Vec<_>>();
    drop(original);
    let reopened = owner(&registry);
    assert!(registry.reserve(1, 0).is_err());
    assert!(reopened.rows.is_empty() && reopened.compiling.is_empty());
    drop(leases);
    assert!(registry.reserve(1, 0).is_ok());
}

#[test]
fn private_capture_reservation_rejects_wrong_registry_and_unreserved_larger_input() {
    let first = Arc::new(capture::Registry::default());
    let second = Arc::new(capture::Registry::default());
    let lease = first.reserve(16, 0).unwrap();
    assert!(lease.require(&first, 16).is_ok());
    assert!(lease.require(&first, 17).is_err());
    assert!(lease.require(&second, 16).is_err());
    let mut wrong_owner = owner(&second);
    let request = intent("operation:foreign-resource");
    assert!(wrong_owner
        .begin_reserved(&request, "doc".into(), "context", &(), Some(&lease))
        .is_err());
    assert!(wrong_owner.compiling.is_empty());
}

#[test]
fn real_capture_precharge_includes_live_departed_bytes_and_new_owner_retained_bytes() {
    let registry = Arc::new(capture::Registry::default());
    let original = registry.reserve(3 * 1024 * 1024, 0).unwrap();
    assert!(registry.reserve(3 * 1024 * 1024, 3 * 1024 * 1024).is_err());
    let second = registry.reserve(3 * 1024 * 1024, 1024).unwrap();
    drop(original);
    assert!(registry.reserve(5 * 1024 * 1024, 1).is_err());
    drop(second);
    assert!(registry.reserve(5 * 1024 * 1024, 1).is_ok());
}

#[test]
fn completion_candidate_copy_is_refused_before_large_background_document_allocation() {
    let registry = Arc::new(capture::Registry::default());
    let mut lease = registry.reserve(5 * 1024 * 1024, 0).unwrap();
    let original = owner(&registry);
    // A real retained 5 MiB basis fits, but its edited candidate copy cannot
    // overlap under this capture horizon. Refusal preserves the original charge.
    assert!(lease.extend(5 * 1024 * 1024, 0).is_err());
    lease.require(&registry, 5 * 1024 * 1024).unwrap();
    let mut unchanged = crate::expression::procedural::budget::Budget::new();
    original.charge(&mut unchanged, None).unwrap();
    assert_eq!(unchanged.charged_bytes(), 5 * 1024 * 1024);
    assert!(lease.extend(1024, 3 * 1024 * 1024).is_err());
    let mut after_retained_refusal = crate::expression::procedural::budget::Budget::new();
    original.charge(&mut after_retained_refusal, None).unwrap();
    assert_eq!(after_retained_refusal.charged_bytes(), unchanged.charged_bytes());
}

#[test]
fn completion_extension_keeps_same_job_slot_when_all_capture_slots_are_live() {
    let registry = Arc::new(capture::Registry::default());
    let mut leases = (0..MAX_MEMOS)
        .map(|_| registry.reserve(1, 0).unwrap()).collect::<Vec<_>>();
    let identity = leases[0].id();
    leases[0].extend(4096, 0).unwrap();
    assert_eq!(leases[0].id(), identity);
    leases[0].require(&registry, 4097).unwrap();
    assert!(registry.reserve(1, 0).is_err());
    let current = owner(&registry);
    let mut budget = crate::expression::procedural::budget::Budget::new();
    current.charge(&mut budget, None).unwrap();
    assert_eq!(budget.charged_bytes(), MAX_MEMOS + 4096);
}

#[test]
fn completion_copy_charge_survives_owner_retirement_and_blocks_new_capture() {
    let registry = Arc::new(capture::Registry::default());
    let mut lease = registry.reserve(2 * 1024 * 1024, 0).unwrap();
    let original = owner(&registry);
    lease.extend(3 * 1024 * 1024, 0).unwrap();
    // Allocate the actual admitted-copy payload only after the private reserve.
    let material = "x".repeat(3 * 1024 * 1024);
    drop(original);
    let reopened = owner(&registry);
    assert!(registry.reserve(4 * 1024 * 1024, 0).is_err());
    let mut budget = crate::expression::procedural::budget::Budget::new();
    reopened.charge(&mut budget, None).unwrap();
    assert_eq!(budget.charged_bytes(), 5 * 1024 * 1024);
    assert_eq!(material.len(), 3 * 1024 * 1024);
    drop(material);
    drop(lease);
    assert!(registry.reserve(4 * 1024 * 1024, 0).is_ok());
}

// These exercise only the actual private retention/copy-budget functions.
// Their row material is ordinary Value data, never a qualified Source or ACK.
fn retention_row(reference: &str, admission: Value) -> Memo {
    Memo {
        intent: intent(reference), envelope: None, preview: json!({}),
        admission, no_change: None, document_fingerprint: "retained-basis".into(),
        context_fingerprint: "retained-context".into(),
    }
}

#[test]
fn actual_reception_budget_refusal_preserves_original_stored_row_before_removal() {
    let registry = Arc::new(capture::Registry::default());
    let mut current = owner(&registry);
    let reference = "operation:large-retained-reception";
    current.rows.insert(reference.into(), retention_row(reference,
        json!({"retained_material":"x".repeat(2 * 1024 * 1024)})));
    let original = serde_json::to_vec(&current.rows[reference]).unwrap();
    assert!(current.reserve_reception(reference, None).is_err());
    assert_eq!(serde_json::to_vec(&current.rows[reference]).unwrap(), original);
    assert!(current.compiling.is_empty());
    let mut budget = crate::expression::procedural::budget::Budget::new();
    registry.charge(&mut budget, None).unwrap();
    assert_eq!(budget.charged_bytes(), 0);
}

#[test]
fn actual_reception_guard_covers_removed_row_and_failure_copies_until_material_retires() {
    let registry = Arc::new(capture::Registry::default());
    let mut current = owner(&registry);
    let reference = "operation:retained-error-path";
    current.rows.insert(reference.into(), retention_row(reference,
        json!({"retained_material":"x".repeat(256 * 1024)})));
    let guard = current.reserve_reception(reference, None).unwrap();
    let removed = current.rows.remove(reference).unwrap();
    let original = serde_json::to_vec(&removed).unwrap();
    let failure = json!({"original_intent":removed.intent,
        "admission":removed.admission,"preview":removed.preview});
    drop(current);
    let reopened = owner(&registry);
    let mut charged = crate::expression::procedural::budget::Budget::new();
    reopened.charge(&mut charged, None).unwrap();
    assert!(charged.charged_bytes() > original.len());
    assert!(failure["admission"]["retained_material"].is_string());
    assert!(reopened.rows.is_empty());
    drop(failure);
    drop(removed);
    drop(guard);
    let mut released = crate::expression::procedural::budget::Budget::new();
    reopened.charge(&mut released, None).unwrap();
    assert_eq!(released.charged_bytes(), 0);
}

#[test]
fn actual_reception_without_original_row_cannot_reserve_or_create_retry_custody() {
    let registry = Arc::new(capture::Registry::default());
    let current = owner(&registry);
    assert!(current.reserve_reception("operation:absent", None).is_err());
    assert!(current.rows.is_empty() && current.compiling.is_empty());
    let mut budget = crate::expression::procedural::budget::Budget::new();
    registry.charge(&mut budget, None).unwrap();
    assert_eq!(budget.charged_bytes(), 0);
}
