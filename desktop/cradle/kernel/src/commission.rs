//! The selection commission route over the ratified flow-instance carrier
//! (O-I #271; Central #177 retires the registry era).
//!
//! A selection made inside a flow instance commissions work: the desktop
//! composes the next instance through the template's own append-entry
//! contract (`src/flow/instance.ts`) and hands it verbatim; the kernel
//! commits it through Central's `central.files.write` compare-and-swap —
//! the same expected-revision safety the instance writing already proves.
//! A stale expected revision is the owner's own structured conflict with
//! both revisions observed, never a silent overwrite.
//!
//! Law:
//!
//! - The kernel composes nothing: the composed instance content travels
//!   verbatim; the location is the owner's own path-ref grammar. No refs
//!   are minted and no prose is wrapped around the selection.
//! - An AgentSession binds as the write's actor (`actor_kind: "agent"` —
//!   Central's attribution law refuses an agent-session write declaring
//!   human authorship); without a session the commission is the human
//!   desktop act, the ported `save_human` attribution
//!   (`human:desktop` / `human`).
//! - Conflict detection is the owner CAS itself: `central.files.write`
//!   answers with its own structured conflict carrying the current
//!   reading — no re-read heuristic is ported any more.
//! - The kernel records nothing and emits nothing: the commission is an
//!   owner write; the receipts live in Central's file history.
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::files::Location;
use crate::flow::{CentralClient, OwnerCallError, CRADLE_ACTOR, CRADLE_ACTOR_KIND};

/// Central's compare-and-swap write owner Action for one commission.
pub const COMMISSION_WRITE_ACTION: &str = "central.files.write";

/// The typed outcome of one selection commission. Every terminal state is
/// explicit; owner words ride verbatim.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum CommissionOutcome {
    /// The owner CAS accepted the commission: the composed instance is now
    /// the owner revision. `previous_revision` is the expected base the
    /// commission was made against; `revision` is the canonical layer now.
    Commissioned {
        path: String,
        previous_revision: String,
        revision: String,
        /// The session attribution the revision receipt recorded, verbatim.
        agent_session_ref: Option<String>,
    },
    /// The owner's CAS refused: the revision moved underneath the
    /// commission. Both revisions observed; the composed content is returned
    /// to the caller unapplied — never a silent overwrite.
    Conflict {
        path: String,
        expected: String,
        current: String,
    },
    /// The owner answered, and the answer was no — the owner's own message,
    /// carried verbatim.
    OwnerRefused { path: String, message: String },
    /// The owner executable could not be launched. Absence, not an error.
    OwnerUnavailable { path: String, detail: String },
}

/// Commission one composed flow instance through the owner CAS.
///
/// `location` is the instance's native path-ref, verbatim;
/// `expected_revision` the revision the composition was made against;
/// `content` the composed next instance, verbatim. With a session the write
/// declares that session as the actor; without one it is the human desktop
/// act.
pub fn commission(
    client: &CentralClient,
    location: &Location,
    expected_revision: &str,
    content: &str,
    agent_session_ref: Option<&str>,
) -> Result<CommissionOutcome, String> {
    let path = location.path.clone();
    if expected_revision.is_empty() {
        return Err(
            "a commission requires the expected revision the composition was made against".into(),
        );
    }
    if content.is_empty() {
        return Err("a commission requires the composed instance content, carried verbatim".into());
    }
    let (actor, actor_kind) = match agent_session_ref {
        Some(session) => (session.to_owned(), "agent".to_owned()),
        None => (CRADLE_ACTOR.to_owned(), CRADLE_ACTOR_KIND.to_owned()),
    };
    let mut input = json!({
        "location": location,
        "expected_revision": expected_revision,
        "content": content,
        "actor": actor,
        "actor_kind": actor_kind,
    });
    if let Some(session) = agent_session_ref {
        input["agent_session_ref"] = json!(session);
    }
    match client.run(COMMISSION_WRITE_ACTION, input) {
        Ok(data) => match data["outcome"].as_str() {
            Some("written") | Some("created") | Some("unchanged") => {
                Ok(CommissionOutcome::Commissioned {
                path,
                    previous_revision: data["previous_revision"]
                        .as_str()
                        .unwrap_or(expected_revision)
                        .to_owned(),
                    revision: data["revision"].as_str().unwrap_or_default().to_owned(),
                    agent_session_ref: agent_session_ref.map(str::to_owned),
                })
            }
            Some("conflict") => Ok(CommissionOutcome::Conflict {
                path,
                expected: data["expected_revision"]
                    .as_str()
                    .unwrap_or(expected_revision)
                    .to_owned(),
                current: data["current"]["revision"]
                    .as_str()
                    .unwrap_or_default()
                    .to_owned(),
            }),
            other => Ok(CommissionOutcome::OwnerRefused {
                path,
                message: format!("Central returned an unsupported commission outcome {other:?}"),
            }),
        },
        Err(OwnerCallError::Unavailable { detail }) => Ok(CommissionOutcome::OwnerUnavailable {
            path,
            detail,
        }),
        Err(refusal) => Ok(CommissionOutcome::OwnerRefused {
            path,
            message: refusal.detail().to_owned(),
        }),
    }
}
