//! Typed owner-Action dispatch adapter — U3.1's "every result row invokes
//! its Action" walked for real (cell C6, closing the C4-recorded gap: the
//! staged kernel knowledge `Request` had no ActionRef dispatch seam).
//!
//! Adapter law:
//!
//! - The Action ref, target ref and optional input are the owner-disclosed
//!   spellings, carried verbatim. The kernel holds no authority and invents
//!   no command translation: it maps each disclosed ref kind to the owner's
//!   OWN operation for it.
//! - Routing is by the owner grammar the disclosure itself carries:
//!   `central.*` / `projectcentral.*` ids (Central's registered Action id
//!   grammar, cell C1) run through the Central owner Action runner;
//!   AIKit resolution-row Action spellings (`aikit.knowledge-resolution/v1`,
//!   `aikit-core/src/knowledge_resolution.rs`) route to the AIKit owner's
//!   own operation for that spelling.
//! - Honest coverage: where the owner exposes no real operation for a
//!   disclosed spelling through the pinned surface, the adapter returns an
//!   explicit `unsupported_action` state naming the ref — never a
//!   fabricated invocation. Partial-but-honest beats universal-but-invented.
//! - Owner failures carry the owner's own words verbatim, classified:
//!   refusal (`owner_refused`), spawn absence (`owner_unavailable`).
//! - Receipt law: dispatch mutates no kernel state and emits nothing —
//!   the kernel records nothing of its own. Owner-side effects (e.g.
//!   `knowledge/open` recording exactly one successful-use familiarity
//!   observation) happen through the owner operation and are provable
//!   through the owner store (`aikit log export` replays the same
//!   `usage_events` stream the owner's familiarity replay reads).
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;

use crate::flow::{CentralClient, OwnerCallError};
use crate::flow_cognition;
use crate::knowledge;

pub const ACTION_DISPATCH_SCHEMA: &str = "oi.cradle.action-dispatch/v1";

/// The native owners this adapter routes disclosed spellings to.
pub const OWNER_CENTRAL: &str = "central";
pub const OWNER_AIKIT: &str = "ai-kit";

/// AIKit resolution-row Action spellings, verbatim from
/// `aikit-core/src/knowledge_resolution.rs`.
pub const AIKIT_ACTION_OPEN: &str = "knowledge/open";
pub const AIKIT_ACTION_READ: &str = "knowledge/read";
pub const AIKIT_ACTION_SOURCES: &str = "knowledge/sources";
pub const AIKIT_ACTION_RELATIONS: &str = "knowledge/relations";
pub const AIKIT_ACTION_EXPLAIN: &str = "knowledge/explain";
pub const AIKIT_ACTION_ROUTE: &str = "knowledge/route";
pub const AIKIT_ACTION_RUN: &str = "run";
pub const AIKIT_ACTION_OVERLAY_SET: &str = "skill/overlay/set";
pub const AIKIT_ACTION_CONTEMPLATE_FLOW: &str = "action:contemplate-flow";

/// One invocation of an owner-disclosed Action on one row/node ref. Every
/// field is the owner spelling, verbatim — the kernel adds nothing.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ActionInvocation {
    /// The owner-disclosed Action spelling, verbatim (e.g. `knowledge/open`,
    /// `projectcentral.wiki.read`).
    pub action: String,
    /// The row/node ref the Action applies to, in the owner's own spelling.
    pub target_ref: String,
    /// Optional owner-shaped input for Central Actions, merged verbatim into
    /// the owner call (Central's runner supplies `project` when absent).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input: Option<Value>,
}

/// The typed outcome of one dispatch. Every non-invoked state is explicit
/// and names the ref; owner answers are carried verbatim.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum ActionDispatch {
    /// The owner's own operation served the Action; `data` is the owner
    /// payload unchanged.
    Invoked {
        /// The owner operation that served the Action (`aikit knowledge open`
        /// / the Central Action id).
        owner_operation: String,
        data: Value,
    },
    /// The spelling names a real owner, but that owner exposes no operation
    /// for it through the pinned surface (or not from a bare row ref); the
    /// adapter fabricates nothing.
    UnsupportedAction { owner: String, detail: String },
    /// The action spelling or target ref is structurally unusable.
    MalformedRef { detail: String },
    /// The spelling matches no disclosed owner's Action grammar.
    UnknownOwner { action: String },
    /// The owner answered, and the answer was no — the owner's message,
    /// verbatim.
    OwnerRefused { owner_operation: String, message: String },
    /// The owner executable could not be launched — absence, not an error.
    OwnerUnavailable { owner_operation: String, detail: String },
}

/// The AIKit knowledge Actions that take a typed Knowledge address: the
/// owner's own parser (`parse_knowledge_address`, aikit-cli `main.rs`)
/// accepts only `wiki=REF | source=REF | project=REF` or the typed address
/// JSON. A bare resolution-row ref is not an address, and the adapter
/// invents no ref→address translation — so these disclosed spellings are
/// explicit unsupported states from a row dispatch in this wave.
const ADDRESS_ACTION_REASON: &str = "the owner operation takes a typed Knowledge address (wiki=REF | source=REF | project=REF or the typed JSON from knowledge search); a bare resolution-row ref is not an address and the kernel invents no ref-to-address translation";

const RUN_ACTION_REASON: &str = "the owner exposes `aikit run` only as a bare execution surface (status reply, no structured owner payload, revision-confirmation gate); the adapter fabricates no invocation and carries no outcome the owner did not shape";

const OVERLAY_SET_REASON: &str = "the owner operation (`aikit skill overlay set`) requires an owner-shaped overlay patch and scope beyond a bare row ref; the kernel invents no input";

/// Dispatch one owner-disclosed Action to its native owner operation.
///
/// W4-D binds `action:contemplate-flow` for real: the W1.4 preflight-first,
/// record-gated Contemplate dispatch lives in `flow_cognition.rs`.
/// Pure routing + owner call: no kernel state is touched. `default_project`
/// is the disclosed scope for Central Actions whose input names no project;
/// the Central runner falls back to its configured query when both are
/// absent.
pub fn invoke(
    client: &CentralClient,
    cwd: &Path,
    default_project: Option<&str>,
    invocation: &ActionInvocation,
) -> ActionDispatch {
    let action = invocation.action.as_str();
    if action.is_empty() || action.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return ActionDispatch::MalformedRef {
            detail: format!("Action spelling `{}` is empty or contains whitespace/control characters", invocation.action),
        };
    }
    if invocation.target_ref.trim().is_empty() {
        return ActionDispatch::MalformedRef { detail: "target ref is empty".into() };
    }
    if action.starts_with("central.") || action.starts_with("projectcentral.") {
        return invoke_central(client, action, default_project, invocation);
    }
    if action == AIKIT_ACTION_OPEN {
        return invoke_aikit_open(cwd, &invocation.target_ref);
    }
    if [AIKIT_ACTION_READ, AIKIT_ACTION_SOURCES, AIKIT_ACTION_RELATIONS, AIKIT_ACTION_EXPLAIN, AIKIT_ACTION_ROUTE].contains(&action) {
        return unsupported(OWNER_AIKIT, ADDRESS_ACTION_REASON);
    }
    if action == AIKIT_ACTION_RUN {
        return unsupported(OWNER_AIKIT, RUN_ACTION_REASON);
    }
    if action == AIKIT_ACTION_OVERLAY_SET {
        return unsupported(OWNER_AIKIT, OVERLAY_SET_REASON);
    }
    if action == AIKIT_ACTION_CONTEMPLATE_FLOW {
        // W4-D binding: preflight-first, record-gated execution through the
        // AIKit Flow cognition owner operations (`flow_cognition.rs`).
        return flow_cognition::dispatch_contemplate(cwd, &invocation.target_ref, invocation.input.as_ref());
    }
    ActionDispatch::UnknownOwner { action: action.to_owned() }
}

fn unsupported(owner: &str, detail: &str) -> ActionDispatch {
    ActionDispatch::UnsupportedAction { owner: owner.into(), detail: detail.into() }
}

fn invoke_central(client: &CentralClient, action: &str, default_project: Option<&str>, invocation: &ActionInvocation) -> ActionDispatch {
    let mut input = match invocation.input.clone() {
        Some(Value::Object(_)) | None => invocation
            .input
            .clone()
            .unwrap_or_else(|| Value::Object(serde_json::Map::new())),
        Some(other) => {
            return ActionDispatch::MalformedRef {
                detail: format!("Central Action input must be a JSON object, got {}", other),
            };
        }
    };
    // The disclosed scope fills the owner input only when the caller named
    // no project; the Central runner's configured query remains the final
    // co-reference fallback (02 §7), never a renderer-supplied path.
    if let (Some(object), Some(project)) = (input.as_object_mut(), default_project) {
        object
            .entry("project".to_owned())
            .or_insert_with(|| Value::String(project.to_owned()));
    }
    match client.run(action, input) {
        Ok(data) => ActionDispatch::Invoked { owner_operation: action.to_owned(), data },
        Err(OwnerCallError::Refused { message }) => {
            ActionDispatch::OwnerRefused { owner_operation: action.to_owned(), message }
        }
        Err(OwnerCallError::Unavailable { detail }) => {
            ActionDispatch::OwnerUnavailable { owner_operation: action.to_owned(), detail }
        }
        // The owner answered something the contract cannot parse: the owner
        // error detail is carried verbatim rather than reclassified.
        Err(OwnerCallError::Malformed { detail }) => {
            ActionDispatch::OwnerRefused { owner_operation: action.to_owned(), message: detail }
        }
    }
}

fn invoke_aikit_open(cwd: &Path, target_ref: &str) -> ActionDispatch {
    let owner_operation = "aikit knowledge open".to_owned();
    match knowledge::run(cwd, &["knowledge", "open", "--", target_ref]) {
        Ok(data) => ActionDispatch::Invoked { owner_operation, data },
        Err(knowledge::CallError::Refused { message }) => {
            ActionDispatch::OwnerRefused { owner_operation, message }
        }
        Err(knowledge::CallError::Unavailable { detail }) => {
            ActionDispatch::OwnerUnavailable { owner_operation, detail }
        }
        Err(knowledge::CallError::Malformed { detail }) => {
            ActionDispatch::OwnerRefused { owner_operation, message: detail }
        }
    }
}
