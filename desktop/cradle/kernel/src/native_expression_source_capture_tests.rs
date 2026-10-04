//! Real resource/streaming functionality only. None of these inputs creates a
//! native Source, clock, Scene owner, completed delivery or receiver grant.
use super::*;
use std::sync::Arc;

fn isolated_memos() -> Memos {
    Memos {
        captures: Arc::new(capture::Registry::default()),
        ..Memos::default()
    }
}

#[test]
fn source_reply_allowance_accounts_existing_process_capture_before_dispatch() {
    let memos = isolated_memos();
    let existing = memos.captures.reserve(2 * 1024 * 1024, 0).unwrap();
    let context = ("original actual source delivery", [1_u64, 2, 3]);
    let delivery = memos.reserve_source_delivery(&context).unwrap();
    let mut budget = crate::expression::procedural::budget::Budget::new();
    budget.value(&context).unwrap();
    budget.reserve(1024).unwrap();
    let retained = 4; // Serialized empty rows and compiling maps.
    let available = COMPILER_BYTES - 2 * 1024 * 1024 - retained - budget.charged_bytes();
    assert_eq!(delivery.reply_limit(), available / 8);
    assert!(memos.captures.live(Some(existing.id())).unwrap());
    assert!(memos.captures.live(Some(delivery.resource.id())).unwrap());
}

#[test]
fn oversized_borrowed_context_does_not_allocate_an_original_capture_slot() {
    let memos = isolated_memos();
    let existing = memos.captures.reserve(4096, 0).unwrap();
    let huge = "x".repeat(COMPILER_BYTES);
    assert!(memos.reserve_source_delivery(&huge).is_err());
    let mut before = crate::expression::procedural::budget::Budget::new();
    memos.captures.charge(&mut before, None).unwrap();
    assert_eq!(before.charged_bytes(), 4096);
    assert!(memos.captures.live(Some(existing.id())).unwrap());
}

#[test]
fn actual_terminal_capacity_returns_unused_bytes_but_keeps_original_count_slot() {
    let memos = isolated_memos();
    let mut delivery = memos.reserve_source_delivery(&"original context").unwrap();
    let id = delivery.resource.id();
    let result = ("actual terminal payload", [7_u64, 8]);
    delivery
        .settle_outcome(&result, &"original intent")
        .unwrap();
    assert!(memos.captures.live(Some(id)).unwrap());
    delivery.preflight_outward(&result, &result).unwrap();
    let next = memos
        .reserve_source_delivery(&"next original context")
        .unwrap();
    assert_ne!(next.resource.id(), id);
    drop(delivery);
    assert!(!memos.captures.live(Some(id)).unwrap());
    assert!(memos.captures.live(Some(next.resource.id())).unwrap());
}

#[test]
fn excessive_outward_copy_keeps_original_reservation_and_refuses_before_clone() {
    let memos = isolated_memos();
    let mut delivery = memos.reserve_source_delivery(&"original context").unwrap();
    let id = delivery.resource.id();
    let original = "received actual payload";
    delivery
        .settle_outcome(&original, &"original intent")
        .unwrap();
    let outward = "x".repeat(8192);
    assert!(delivery.preflight_outward(&original, &outward).is_err());
    assert!(memos.captures.live(Some(id)).unwrap());
    delivery.preflight_outward(&original, &original).unwrap();
}

#[test]
fn source_delivery_custody_preserves_original_process_global_count_bound() {
    let memos = isolated_memos();
    let mut originals = Vec::new();
    for _ in 0..MAX_MEMOS {
        let mut delivery = memos.reserve_source_delivery(&"original").unwrap();
        delivery.settle_outcome(&"terminal", &"original").unwrap();
        originals.push(delivery);
    }
    assert!(memos
        .reserve_source_delivery(&"sixty-fifth original")
        .is_err());
    let removed = originals.pop().unwrap().resource.id();
    assert!(!memos.captures.live(Some(removed)).unwrap());
    assert!(memos.reserve_source_delivery(&"next original").is_ok());
}


// Real process resource implementation; no Source, timing or receipt minted.
#[test]
fn prospective_copies_reduce_original_reply_allowance_without_second_capture() {
    let memos=isolated_memos();
    let mut delivery=memos.reserve_source_delivery(&"original borrowed document/source").unwrap();
    let id=delivery.resource.id();
    let capacity=delivery.capacity;
    let original_context=delivery.context_bytes;
    let prospective=(["actual current coordinate"; 32], [1_u64,2,3]);
    let mut measured=crate::expression::procedural::budget::Budget::new();
    measured.value(&prospective).unwrap();
    delivery.preflight_copies(&prospective).unwrap();
    assert_eq!(delivery.capacity,capacity);
    assert_eq!(delivery.resource.id(),id);
    assert_eq!(delivery.context_bytes,original_context+measured.charged_bytes());
    assert_eq!(delivery.reply_limit(),(capacity-delivery.context_bytes)/8);
    assert!(memos.captures.live(Some(id)).unwrap());
}

#[test]
fn prospective_copy_overflow_refuses_before_copy_and_preserves_original_allowance() {
    let memos=isolated_memos();
    let mut delivery=memos.reserve_source_delivery(&"original context").unwrap();
    let id=delivery.resource.id();
    let context=delivery.context_bytes;
    let reply=delivery.reply_limit();
    let capacity=delivery.capacity;
    for bytes in [usize::MAX,capacity-context,capacity-context+1] {
        assert!(delivery.preflight_copy_bytes(bytes).is_err());
        assert_eq!(delivery.context_bytes,context);
        assert_eq!(delivery.reply_limit(),reply);
        assert_eq!(delivery.capacity,capacity);
        assert_eq!(delivery.resource.id(),id);
    }
    assert!(memos.captures.live(Some(id)).unwrap());
}

#[test]
fn departed_owner_prospective_capture_keeps_shared_bytes_until_original_drop() {
    let registry=Arc::new(capture::Registry::default());
    let memos=Memos{captures:registry.clone(),..Memos::default()};
    let mut original=memos.reserve_source_delivery(&"departing original").unwrap();
    original.preflight_copy_bytes(4096).unwrap();
    let id=original.resource.id();
    drop(memos);
    let successor=Memos{captures:registry.clone(),..Memos::default()};
    assert!(successor.reserve_source_delivery(&"new actual owner").is_err());
    assert!(registry.live(Some(id)).unwrap());
    drop(original);
    assert!(!registry.live(Some(id)).unwrap());
    assert!(successor.reserve_source_delivery(&"new actual owner").is_ok());
}

struct DeliveryDropProbe {
    registry:Arc<capture::Registry>,
    id:u64,
    destroyed:Arc<std::sync::atomic::AtomicUsize>,
    body:Vec<u8>,
}
impl Drop for DeliveryDropProbe {
    fn drop(&mut self) {
        assert!(self.registry.live(Some(self.id)).unwrap(),
            "full delivery resource released before its heavy data");
        self.destroyed.fetch_add(1,std::sync::atomic::Ordering::SeqCst);
        self.body.clear();
    }
}
#[test]
fn delivery_context_early_error_destroys_full_data_before_original_resource() {
    let memos=isolated_memos();
    let delivery=memos.reserve_source_delivery(&"actual borrowed delivery").unwrap();
    let id=delivery.resource.id();
    let destroyed=Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let probe=DeliveryDropProbe {registry:memos.captures.clone(),id,
        destroyed:destroyed.clone(),body:vec![7;1024]};
    let execute=|data:DeliveryDropProbe,resource:SourceDeliveryCapture|->Result<(),String> {
        let _work=SourceDeliveryContext {data,resource};
        Err("real pre-dispatch validation refusal".into())
    };
    assert!(execute(probe,delivery).is_err());
    assert_eq!(destroyed.load(std::sync::atomic::Ordering::SeqCst),1);
    assert!(!memos.captures.live(Some(id)).unwrap());
}
#[test]
fn delivery_context_unwind_retains_charge_through_all_heavy_data() {
    let memos=isolated_memos();
    let delivery=memos.reserve_source_delivery(&"actual borrowed delivery").unwrap();
    let id=delivery.resource.id();
    let destroyed=Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let body=DeliveryDropProbe {registry:memos.captures.clone(),id,
        destroyed:destroyed.clone(),body:vec![9;1024]};
    let result=std::panic::catch_unwind(std::panic::AssertUnwindSafe(move|| {
        let _work=SourceDeliveryContext {data:body,resource:delivery};
        panic!("actual work unwind");
    }));
    assert!(result.is_err());
    assert_eq!(destroyed.load(std::sync::atomic::Ordering::SeqCst),1);
    assert!(!memos.captures.live(Some(id)).unwrap());
}
