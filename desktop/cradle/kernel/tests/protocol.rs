//! The `ProtocolRead` op: the disclosure a client versions against, derived
//! from the enforcing modules, beside the live event log's generation.

use oi_cradle_kernel::flow::CentralClient;
use oi_cradle_kernel::{Kernel, KernelOp, KernelOpResult, KERNEL_PROTOCOL_SCHEMA};

#[test]
fn protocol_read_discloses_the_live_generation_and_the_frozen_contracts() {
    let mut kernel = Kernel::new(CentralClient::discover());
    let outcome = kernel
        .apply(KernelOp::ProtocolRead)
        .expect("protocol_read never touches owners or the ground");
    assert!(
        outcome.receipts.is_empty(),
        "a disclosure is not a state change"
    );
    let KernelOpResult::Protocol { document } = outcome.result else {
        panic!("protocol_read must answer with the protocol document");
    };
    assert_eq!(document.schema, KERNEL_PROTOCOL_SCHEMA);
    assert_eq!(document.generation, kernel.event_log().generation());
    assert_eq!(
        document.event.schema,
        oi_cradle_kernel::events::KERNEL_EVENT_SCHEMA
    );
    assert_eq!(
        document.event.version,
        oi_cradle_kernel::events::KERNEL_EVENT_VERSION
    );
    assert_eq!(
        document.replay.schema,
        oi_cradle_kernel::events::KERNEL_EVENT_REPLAY_SCHEMA
    );
}

#[test]
fn the_live_generation_changes_when_the_log_is_replaced() {
    let mut kernel = Kernel::new(CentralClient::discover());
    let first = kernel.event_log().generation().to_owned();
    let outcome = kernel.apply(KernelOp::ProtocolRead).unwrap();
    let KernelOpResult::Protocol { document } = outcome.result else {
        panic!("protocol_read must answer with the protocol document");
    };
    assert_eq!(document.generation, first);
}
