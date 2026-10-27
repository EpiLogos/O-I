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

/// Central's registered Action id grammar, by namespace (`ctrl action list`, 21 Oct 2026: `central.*`, `projectcentral.*`,
/// `agent-profile.*`, `control.*`, `machine.*`, `work.*`): every id in one of them runs through Central's runner. Its agent
/// profiles (Make and Accept), Control's search and skills, the Machine device and a page's Open and Reveal are Central's as much
/// as its Day is (T-COVERAGE §1.2, §1.4).
pub const CENTRAL_NAMESPACES: [&str; 7] = [
    "central.",
    "projectcentral.",
    "agent-profile.",
    "control.",
    "machine.",
    "work.",
    // The person's notifications (Central#288): `personal.notify`, `personal.notifications.list`.
    "personal.",
];

/// Whether an Action id is Central's, by its namespace.
pub fn central_action(action: &str) -> bool {
    CENTRAL_NAMESPACES
        .iter()
        .any(|namespace| action.starts_with(namespace) && action.len() > namespace.len())
}

/// The person's own presses that reach Central as Actions (T-COVERAGE §1.1): closing a NOW; the Day's settings, its moves'
/// records, its rollover and its close-out carry; accepting a returned source; making, keeping and removing an agent and a
/// group; a world's relations; a document's own edit; a workspace's Accept (init, adopt, migrate) and its Docs' Ensure and Relate
/// (manual §18.1 Ground, "accept it there"; §18.5 Docs), its UX and EX relations — Central's `projectcentral.docs.*` ids (its
/// first `projectcentral.self.*` ids still answer there as deprecated aliases; the kernel presses the docs ids); the Machine's
/// Apply, Adopt and Recover; Ground hygiene's
/// tenders (init-root, reproject-scaffold, recognise-source). Central admits these on the person's native authority, so the kernel carries the host's token
/// for exactly these (flow.rs `for_person`: read in the native process, never supplied by the desk), as it does for Open today
/// and a page's Launch. Every other invocation goes without it, and Central refuses an act it does not grant in its own words.
pub const PERSON_ACTS: [&str; 28] = [
    "central.now.lifecycle",
    "central.day.settings.write",
    "central.day.move.record",
    "central.day.rollover",
    "central.day.close-carry",
    "projectcentral.source.return_accept",
    "agent-profile.express",
    "agent-profile.accept",
    "agent-profile.save",
    "agent-profile.remove",
    "central.agent-set.propose",
    "central.agent-set.save",
    "central.world-relations.save",
    "central.document.mutate",
    "projectcentral.init",
    "projectcentral.adopt",
    "projectcentral.migrate",
    "projectcentral.docs.ensure",
    "projectcentral.docs.tier.relate",
    "projectcentral.docs.retain-tier",
    "projectcentral.docs.ux.relate",
    "projectcentral.docs.ex.relate",
    "machine.apply",
    "machine.adopt-current",
    "central.recover",
    "central.init",
    "central.world.reproject.apply",
    "projectcentral.ground.apply",
];

/// Whether an invoked Action is one of the person's own presses (`PERSON_ACTS`).
pub fn person_act(action: &str) -> bool {
    PERSON_ACTS.contains(&action)
}

/// Whether an invocation only reads, so running it moves nothing (owner_write.rs `reads_only`): a Central action its own
/// catalogue classes `read-only` (`CentralClient::reads`), or a Contemplate Flow press without its `execute` preflight
/// record — the preflight, which `flow_cognition.rs` runs as `aikit flow preflight`; anything but a record refuses before
/// any owner call. Every other invocation may write.
pub fn reads_only(client: &CentralClient, invocation: &ActionInvocation) -> bool {
    if invocation.action == AIKIT_ACTION_CONTEMPLATE_FLOW {
        return !invocation
            .input
            .as_ref()
            .and_then(|input| input.get("execute"))
            .is_some_and(Value::is_object);
    }
    client.reads(&invocation.action)
}

/// Central's own word on what each Action does: the `mutation_class` of every id in its catalogue (`action.list`,
/// `read-only` | `locally-mutating` | `externally-mutating`), read once per Central owner (`CentralClient::owner_identity`)
/// and kept for the process. An id the kept catalogue does not hold (a newer Central) asks again, at most once a minute.
struct Catalogue {
    classes: std::collections::HashMap<String, String>,
    read_at: std::time::Instant,
}

fn catalogues() -> &'static std::sync::Mutex<std::collections::HashMap<String, Catalogue>> {
    static CATALOGUES: std::sync::OnceLock<
        std::sync::Mutex<std::collections::HashMap<String, Catalogue>>,
    > = std::sync::OnceLock::new();
    CATALOGUES.get_or_init(Default::default)
}

/// How long a catalogue that lacks an id, or that could not be read, stands before Central is asked again.
const CATALOGUE_RETRY: std::time::Duration = std::time::Duration::from_secs(60);

impl CentralClient {
    /// Whether a Central action only reads, by Central's own `mutation_class` (`read-only`). Where Central's catalogue
    /// cannot be read, or does not name the id, the kernel's suffix classification stands in (read_cache.rs
    /// `central_reads`), and an action it does not recognise is a write.
    pub(crate) fn reads(&self, action: &str) -> bool {
        match self.mutation_class(action) {
            Some(class) => class == "read-only",
            None => crate::read_cache::central_reads(action),
        }
    }

    /// Central's `mutation_class` for an id, from the catalogue kept for this owner.
    pub(crate) fn mutation_class(&self, action: &str) -> Option<String> {
        let owner = self.owner_identity();
        {
            let kept = catalogues().lock().unwrap_or_else(|e| e.into_inner());
            if let Some(catalogue) = kept.get(&owner) {
                if let Some(class) = catalogue.classes.get(action) {
                    return Some(class.clone());
                }
                if catalogue.read_at.elapsed() < CATALOGUE_RETRY {
                    return None;
                }
            }
        }
        // Read outside the lock: two first asks may both read; the later answer stands.
        let classes = self
            .action_list()
            .ok()
            .filter(|envelope| envelope["ok"] == true)
            .and_then(|envelope| {
                envelope
                    .pointer("/data/actions")
                    .and_then(Value::as_array)
                    .map(|rows| {
                        rows.iter()
                            .filter_map(|row| {
                                Some((
                                    row.get("id")?.as_str()?.to_owned(),
                                    row.get("mutation_class")?.as_str()?.to_owned(),
                                ))
                            })
                            .collect::<std::collections::HashMap<_, _>>()
                    })
            })
            .unwrap_or_default();
        let class = classes.get(action).cloned();
        catalogues()
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(
                owner,
                Catalogue {
                    classes,
                    read_at: std::time::Instant::now(),
                },
            );
        class
    }
}

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
pub const AIKIT_ACTION_CONTEMPLATE_NOW: &str = "action:contemplate-now";

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
    OwnerRefused {
        owner_operation: String,
        message: String,
    },
    /// The owner executable could not be launched — absence, not an error.
    OwnerUnavailable {
        owner_operation: String,
        detail: String,
    },
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
            detail: format!(
                "Action spelling `{}` is empty or contains whitespace/control characters",
                invocation.action
            ),
        };
    }
    if invocation.target_ref.trim().is_empty() {
        return ActionDispatch::MalformedRef {
            detail: "target ref is empty".into(),
        };
    }
    if central_action(action) {
        return invoke_central(client, action, default_project, invocation);
    }
    if matches!(
        action,
        crate::construction::APPLY | crate::construction::APPLY_FACTS
    ) {
        return crate::construction::invoke(client, cwd, default_project, invocation);
    }
    if action == AIKIT_ACTION_OPEN {
        return invoke_aikit_open(cwd, &invocation.target_ref);
    }
    if [
        AIKIT_ACTION_READ,
        AIKIT_ACTION_SOURCES,
        AIKIT_ACTION_RELATIONS,
        AIKIT_ACTION_EXPLAIN,
        AIKIT_ACTION_ROUTE,
    ]
    .contains(&action)
    {
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
        return flow_cognition::dispatch_contemplate(
            cwd,
            &invocation.target_ref,
            invocation.input.as_ref(),
        );
    }
    if action == AIKIT_ACTION_CONTEMPLATE_NOW {
        // The re-aimed subject (Central #175 cell 2): contemplate a NOW
        // clearing's raw T stream. The kernel reads the stream from
        // Central's own Action and supplies it as the AIKit seam.
        return flow_cognition::dispatch_contemplate_now(
            client,
            cwd,
            &invocation.target_ref,
            invocation.input.as_ref(),
        );
    }
    ActionDispatch::UnknownOwner {
        action: action.to_owned(),
    }
}

fn unsupported(owner: &str, detail: &str) -> ActionDispatch {
    ActionDispatch::UnsupportedAction {
        owner: owner.into(),
        detail: detail.into(),
    }
}

fn invoke_central(
    client: &CentralClient,
    action: &str,
    default_project: Option<&str>,
    invocation: &ActionInvocation,
) -> ActionDispatch {
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
        Ok(data) => ActionDispatch::Invoked {
            owner_operation: action.to_owned(),
            data,
        },
        Err(OwnerCallError::Refused { message }) => ActionDispatch::OwnerRefused {
            owner_operation: action.to_owned(),
            message,
        },
        Err(OwnerCallError::Unavailable { detail }) => ActionDispatch::OwnerUnavailable {
            owner_operation: action.to_owned(),
            detail,
        },
        // The owner answered something the contract cannot parse: the owner
        // error detail is carried verbatim rather than reclassified.
        Err(OwnerCallError::Malformed { detail }) => ActionDispatch::OwnerRefused {
            owner_operation: action.to_owned(),
            message: detail,
        },
    }
}

fn invoke_aikit_open(cwd: &Path, target_ref: &str) -> ActionDispatch {
    let owner_operation = "aikit knowledge open".to_owned();
    match knowledge::run(cwd, &["knowledge", "open", "--", target_ref]) {
        Ok(data) => ActionDispatch::Invoked {
            owner_operation,
            data,
        },
        Err(knowledge::CallError::Refused { message }) => ActionDispatch::OwnerRefused {
            owner_operation,
            message,
        },
        Err(knowledge::CallError::Unavailable { detail }) => ActionDispatch::OwnerUnavailable {
            owner_operation,
            detail,
        },
        Err(knowledge::CallError::Malformed { detail }) => ActionDispatch::OwnerRefused {
            owner_operation,
            message: detail,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn central_namespaces_route_to_central_and_no_other_spelling_does() {
        for id in [
            "central.day.read",
            "projectcentral.now.inspect",
            "agent-profile.express",
            "control.search",
            "machine.plan",
            "work.open",
            "personal.notifications.list",
            "personal.notify",
        ] {
            assert!(central_action(id), "{id} is Central's");
        }
        for id in [
            "acme.everything",
            "knowledge/open",
            "agent-profile.",
            "controls.search",
            "central",
            "workcell.status",
            "personal.",
            "personalnotify",
        ] {
            assert!(!central_action(id), "{id} is not Central's");
        }
    }

    #[test]
    fn only_the_persons_presses_carry_the_persons_authority() {
        for id in PERSON_ACTS {
            assert!(central_action(id), "{id} is Central's");
            assert!(person_act(id), "{id} is the person's press");
        }
        for id in [
            "central.now.list",
            "central.day.read",
            "central.day.settings.read",
            "agent-profile.read",
            "central.receiving.submit",
            "control.search",
            "knowledge/open",
        ] {
            assert!(!person_act(id), "{id} carries no person authority");
        }
        // The workspace's Accept, Ensure and Relate (manual §18.1).
        for id in [
            "projectcentral.init",
            "projectcentral.adopt",
            "projectcentral.migrate",
            "projectcentral.docs.ensure",
            "projectcentral.docs.tier.relate",
            "projectcentral.docs.retain-tier",
        ] {
            assert!(person_act(id), "{id} is the person's press");
        }
        // The Docs' UX and EX, the Machine's Apply, Adopt and Recover, and Ground hygiene's tenders.
        for id in [
            "projectcentral.docs.ux.relate",
            "projectcentral.docs.ex.relate",
            "machine.apply",
            "machine.adopt-current",
            "central.recover",
            "central.init",
            "central.world.reproject.apply",
            "projectcentral.ground.apply",
        ] {
            assert!(person_act(id), "{id} is the person's press");
        }
        // Their previews, plans and readings carry nothing.
        for id in [
            "projectcentral.adopt.preview",
            "projectcentral.docs.inspect",
            "machine.plan",
            "machine.verify",
            "central.recovery.plan",
            "central.world.reproject.plan",
            "projectcentral.ground.plan",
        ] {
            assert!(!person_act(id), "{id} carries no person authority");
        }
    }
}
