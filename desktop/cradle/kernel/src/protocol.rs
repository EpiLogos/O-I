//! The kernel's protocol disclosure: one document answering "which contracts
//! does this kernel speak, and which does it enforce".
//!
//! Law (the Hermes `gateway.capabilities` rule, ported to the kernel seam):
//! **advertised is exactly what is enforced.** Every schema string and limit
//! in this document is derived from the enforcing module's own constants —
//! the event parse boundary refuses precisely what this document does not
//! advertise — so a believed-but-absent capability cannot be disclosed. The
//! document is data for clients (renderer, walk bridge, future carriers) to
//! version against; it replaces no read model and grants no authority.

use crate::configuration::{CHANGEST_SCHEMA, CONTRIBUTION_SCHEMA, ERROR_SCHEMA, RESOLUTION_SCHEMA};
use crate::events::{
    DEFAULT_EVENT_REPLAY_BYTES, DEFAULT_EVENT_REPLAY_COUNT, KERNEL_EVENT_REPLAY_SCHEMA,
    KERNEL_EVENT_SCHEMA, KERNEL_EVENT_VERSION, MAX_EVENT_REPLAY_PAGE_BYTES,
    MAX_EVENT_REPLAY_PAGE_COUNT, MAX_EVENT_REPLAY_RECEIPT_BYTES,
};
use serde::{Deserialize, Serialize};

/// The frozen protocol-disclosure contract. Bump when a field's meaning
/// changes, never by adding a field.
pub const KERNEL_PROTOCOL_SCHEMA: &str = "oi.kernel-protocol/v1";

/// The kernel protocol document (`oi.kernel-protocol/v1`). Facts only —
/// the enforcing modules stay the single source of every value here.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct KernelProtocol {
    pub schema: String,
    /// The live kernel event log's generation: a freshly attached client
    /// bootstraps its replay cursor against exactly this value, and a
    /// different generation on a later replay means kernel restart.
    pub generation: String,
    /// The typed event seam this kernel emits and parses.
    pub event: EventContract,
    /// The bounded replay contract over that seam.
    pub replay: ReplayContract,
    /// The configuration-plane documents owners and the engine exchange.
    pub configuration: ConfigurationContracts,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct EventContract {
    pub schema: String,
    pub version: u32,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ReplayContract {
    pub schema: String,
    pub default_count: usize,
    pub default_bytes: usize,
    pub max_receipt_bytes: usize,
    pub max_page_count: usize,
    pub max_page_bytes: usize,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ConfigurationContracts {
    pub contribution: String,
    pub resolution: String,
    pub changeset: String,
    pub error: String,
}

impl KernelProtocol {
    /// Derive the disclosure from the enforcing constants beside the live
    /// event log's generation. No argument here is configurable on purpose:
    /// configuration cannot change what the kernel enforces.
    pub fn for_event_log(generation: &str) -> Self {
        Self {
            schema: KERNEL_PROTOCOL_SCHEMA.to_owned(),
            generation: generation.to_owned(),
            event: EventContract {
                schema: KERNEL_EVENT_SCHEMA.to_owned(),
                version: KERNEL_EVENT_VERSION,
            },
            replay: ReplayContract {
                schema: KERNEL_EVENT_REPLAY_SCHEMA.to_owned(),
                default_count: DEFAULT_EVENT_REPLAY_COUNT,
                default_bytes: DEFAULT_EVENT_REPLAY_BYTES,
                max_receipt_bytes: MAX_EVENT_REPLAY_RECEIPT_BYTES,
                max_page_count: MAX_EVENT_REPLAY_PAGE_COUNT,
                max_page_bytes: MAX_EVENT_REPLAY_PAGE_BYTES,
            },
            configuration: ConfigurationContracts {
                contribution: CONTRIBUTION_SCHEMA.to_owned(),
                resolution: RESOLUTION_SCHEMA.to_owned(),
                changeset: CHANGEST_SCHEMA.to_owned(),
                error: ERROR_SCHEMA.to_owned(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::KernelEventEnvelope;

    /// Advertised is enforced: an envelope the kernel actually produces
    /// parses; the same envelope one version ahead is refused by name. If
    /// this test fails, disclosure and enforcement have drifted.
    #[test]
    fn the_advertised_event_contract_is_exactly_what_the_parse_boundary_enforces() {
        let document = KernelProtocol::for_event_log("generation-zero");
        let mut focus = crate::focus::GlobalFocus::unfocused();
        focus
            .focus_subject(crate::refs::SemanticRef {
                ref_id: "central:source:project:project:o-i:x.md".to_owned(),
                kind: "source".to_owned(),
                native_owner: "central".to_owned(),
                provenance: crate::refs::RefProvenance {
                    source: "test".to_owned(),
                    revision: None,
                },
            })
            .expect("focus set");
        let produced = KernelEventEnvelope::new(crate::events::KernelEvent::FocusChanged { focus });
        let raw = serde_json::to_string(&produced).unwrap();
        let value: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(value["schema"], document.event.schema);
        assert_eq!(value["version"], document.event.version);
        assert!(KernelEventEnvelope::parse(&raw).is_ok());

        let ahead = {
            let mut tampered = value.clone();
            tampered["version"] = serde_json::json!(document.event.version + 1);
            serde_json::to_string(&tampered).unwrap()
        };
        let error = KernelEventEnvelope::parse(&ahead)
            .expect_err("an unadvertised version must be refused");
        assert!(error.contains("unsupported kernel event version"));
    }

    #[test]
    fn the_configuration_contracts_are_the_frozen_document_names() {
        let document = KernelProtocol::for_event_log("g");
        assert_eq!(
            document.configuration.contribution,
            "oi.configuration-contribution/v1"
        );
        assert_eq!(document.configuration.resolution, "oi.config-resolution/v1");
        assert_eq!(document.configuration.changeset, "oi.config-changeset/v1");
        assert_eq!(document.configuration.error, "oi.config-error/v1");
    }

    #[test]
    fn the_disclosure_contract_is_frozen_and_the_document_round_trips() {
        assert_eq!(KERNEL_PROTOCOL_SCHEMA, "oi.kernel-protocol/v1");
        let document = KernelProtocol::for_event_log("abc123");
        let encoded = serde_json::to_string(&document).unwrap();
        assert_eq!(
            serde_json::from_str::<KernelProtocol>(&encoded).unwrap(),
            document
        );
    }
}
