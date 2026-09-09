//! Wave-4 kernel cell W4-D — the Flow selection commission route
//! (wayfinder U4.1/U4.2, loop mode), kernel half.
//!
//! A selection made inside a Flow commissions work: the kernel op carries
//! the selection **verbatim**, the stable Central FlowRef and the
//! **expected revision** the selection was made against. The commission
//! lands as an owner revision through Central's `projectcentral.flow.write`
//! compare-and-swap — dirty-buffer conflict safety is the owner CAS itself:
//! a stale `expected_revision` refuses with both revisions observed, never
//! a silent overwrite (the same expected-revision semantics the source
//! buffer layer proves in `source_cas`).
//!
//! Law:
//!
//! - The kernel composes nothing: the selection text is the write content,
//!   carried verbatim; the FlowRef and revision travel in Central's own
//!   grammar; no refs are minted and no prose is wrapped around the
//!   selection.
//! - An AgentSession binds **without owning the Flow's identity**: when the
//!   caller names a session, the write declares that session as the actor
//!   (`actor_kind: "agent"` — Central's attribution law refuses a write
//!   that declares human authorship inside an agent session) and the
//!   session ref rides as attribution on the owner revision receipt only.
//!   The FlowRecord's identity — `flow_ref`, `source_ref`, `scope_ref`,
//!   lifecycle — is the owner's and is never touched by the binding.
//! - Without a session the commission is a human act at the desktop, the
//!   ported `save_human` attribution (`human:desktop` / `human`).
//! - Conflict detection is the ported heuristic: on a write refusal the
//!   kernel re-reads the owner record and **compares revisions, never
//!   conflict prose** — a moved revision is a structured `Conflict` with
//!   both sides; anything else is the owner's own refusal, verbatim.
//! - The kernel records nothing and emits nothing: the commission is an
//!   owner write; the receipts live in Central's Flow registry.
use serde::{Deserialize, Serialize};

use crate::flow::{CentralClient, FlowRecord, OwnerCallError, CRADLE_ACTOR, CRADLE_ACTOR_KIND};

/// Central's compare-and-swap write owner Action for one commission.
pub const FLOW_COMMISSION_OWNER_ACTION: &str = "projectcentral.flow.write";
/// The owner re-read used to settle a refusal (revisions compared, never
/// conflict prose).
pub const FLOW_COMMISSION_INSPECT_ACTION: &str = "projectcentral.flow.inspect";

/// Central's canonical FlowRef grammar (`central:flow:project:{id}:{tail}`),
/// verified before any owner call — the kernel invents no FlowRef.
pub const FLOW_REF_PREFIX: &str = "central:flow:project:";

/// The typed outcome of one selection commission. Every terminal state is
/// explicit; owner words ride verbatim.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum CommissionOutcome {
    /// The owner CAS accepted the commission: the selection is now an owner
    /// revision of the Flow. `previous_revision` is the expected base the
    /// commission was made against; `revision` is the canonical layer now.
    Commissioned {
        flow: FlowRecord,
        previous_revision: String,
        revision: String,
        /// The session attribution the revision receipt recorded, verbatim.
        agent_session_ref: Option<String>,
    },
    /// The owner's CAS refused: the revision moved underneath the
    /// commission. Both revisions observed; the selection is returned to
    /// the caller unapplied — never a silent overwrite.
    Conflict {
        flow_ref: String,
        expected: String,
        current: String,
    },
    /// The owner answered, and the answer was no — the owner's own message,
    /// carried verbatim.
    OwnerRefused { flow_ref: String, message: String },
    /// The owner executable could not be launched. Absence, not an error.
    OwnerUnavailable { flow_ref: String, detail: String },
}

/// Commission one verbatim selection in one retained Flow.
///
/// `flow_ref` must be Central's canonical grammar; `expected_revision` the
/// revision the selection was made against; `selection` non-empty. With a
/// session the write declares that session as actor (`agent`); without one
/// it is the human desktop act.
pub fn commission(
    client: &CentralClient,
    project: &str,
    flow_ref: &str,
    expected_revision: &str,
    selection: &str,
    agent_session_ref: Option<&str>,
) -> Result<CommissionOutcome, String> {
    if !flow_ref.starts_with(FLOW_REF_PREFIX) {
        return Err(format!(
            "FlowRef `{flow_ref}` is not Central's canonical Flow grammar ({FLOW_REF_PREFIX}…); the kernel mints no FlowRef"
        ));
    }
    if expected_revision.is_empty() {
        return Err(
            "a commission requires the expected revision the selection was made against".into(),
        );
    }
    if selection.is_empty() {
        return Err("a commission requires the selection text, carried verbatim".into());
    }
    let (actor, actor_kind) = match agent_session_ref {
        // Central's attribution law: a write declaring human authorship may
        // not also carry an agent session. A session-bound commission
        // declares the session as the actor — it binds to the Flow, it does
        // not own the Flow's identity.
        Some(session) => (session.to_owned(), "agent".to_owned()),
        None => (CRADLE_ACTOR.to_owned(), CRADLE_ACTOR_KIND.to_owned()),
    };
    match client.flow_write_reading(
        Some(project),
        flow_ref,
        expected_revision,
        selection,
        &actor,
        &actor_kind,
        agent_session_ref,
    ) {
        Ok(reading) => {
            let revision = reading.flow.current_revision.clone();
            Ok(CommissionOutcome::Commissioned {
                flow: reading.flow,
                previous_revision: expected_revision.to_owned(),
                revision,
                agent_session_ref: agent_session_ref.map(str::to_owned),
            })
        }
        Err(error) => match error {
            OwnerCallError::Unavailable { detail } => Ok(CommissionOutcome::OwnerUnavailable {
                flow_ref: flow_ref.to_owned(),
                detail,
            }),
            // The ported heuristic: re-read the owner record and compare
            // revisions, never conflict prose.
            refusal => {
                let message = refusal.detail();
                let moved = client
                    .flow_inspect(Some(project), flow_ref)
                    .map(|inspection| inspection.flow.current_revision)
                    .ok()
                    .filter(|current| current != expected_revision);
                match moved {
                    Some(current) => Ok(CommissionOutcome::Conflict {
                        flow_ref: flow_ref.to_owned(),
                        expected: expected_revision.to_owned(),
                        current,
                    }),
                    None => Ok(CommissionOutcome::OwnerRefused {
                        flow_ref: flow_ref.to_owned(),
                        message,
                    }),
                }
            }
        },
    }
}
