//! ES1 knowledge side + ES4 joint focus / deixis / portals — the one-state
//! relation between the graph / Wiki / constellation presentations and
//! Expressions (docs/EXPRESSION-WORLD-SUBSTRATE-WAYFINDER.md §3.5, §4,
//! §17 ES4; docs/contracts/EXPRESSION-APPLICATION-V1.md; issue #366 EX3A5).
//!
//! The governing law: ONE canonical bounded relation/selection state. LIST,
//! TREE, GRAPH, Wiki page and Expression are alternative PRESENTATIONS over
//! the same native refs. This module keeps the shared, kernel-owned deictic
//! context (the one shared selection), the structured Surface-portal
//! operations, the generic cancellable ExpressiveAct state and the bounded
//! local-whole bindings with explicit drift rebase. It creates no semantic
//! store: every record names exact native refs, revisions and disclosed
//! Actions carried verbatim from their owners.
//!
//! Laws kept here:
//!
//! - Selection is inspection, never Action invocation. Nothing in this
//!   module invokes an Action.
//! - Geometry never mints relations: layout/constellation geometry is a
//!   presentation input that lands only in presentation parameters; relation
//!   presentation bindings derive ONLY from declared native relation
//!   readings on the bound local whole ([`relation_bindings`],
//!   [`presentation_changes`]).
//! - Placements route through the existing kernel Surface host
//!   (`Kernel::surface_open` / `surface_close`); the canonical target ref is
//!   preserved through every placement, and a target with no available
//!   surface is an explicit degradation disclosure, never a fabricated
//!   binding.
//! - Drift is honest: a stale/changed owner basis revision is surfaced, and
//!   rebasing to a new revision is an explicit operation
//!   ([`Request::WholeRebase`]) that refuses both a stale expectation and a
//!   no-op rebase. Nothing rebases silently.
//! - `activity_ref` fields are caller-supplied correlation, never
//!   authentication. No paradigm names (Nara, Epii, Ta-Onta) appear in this
//!   generic contract.
//!
//! Disclosure: portal / act / whole / selection state changes return their
//! typed outcome from the operation and stay readable through the read
//! operations ([`Request::SelectionRead`], [`Request::PortalInspect`],
//! [`Request::WholeInspect`]); the ordered event vocabulary is unchanged.
//! Document-visible changes (an Expression focus or act edit) still emit the
//! existing `expression_changed` / `focus_changed` receipts exactly as the
//! Expression contract requires.

use crate::events::KernelEvent;
use crate::expression::{self, Availability, Change, ReadingRef};
use crate::refs::{RefProvenance, SemanticRef};
use crate::{Kernel, KernelOpOutcome, KernelOpResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

/// Wire schema of this module's structured outcomes.
pub const WORLD_SCHEMA: &str = "oi.expression-world/v1";

const MAX_TEXT: usize = 4096;
const MAX_PORTALS: usize = 64;
const MAX_ACTS: usize = 16;
const MAX_CHECKPOINTS: usize = 64;
const MAX_CHECKPOINTS_PER_ACT: usize = 8;
const MAX_WHOLES: usize = 64;
/// Bounded local neighbourhood — the same bound the owner relations read
/// uses (`aikit knowledge relations --max-nodes 96 --max-edges 192`). A
/// projection never loads the whole graph to show one local field.
const MAX_MEMBERS: usize = 96;
const MAX_RELATIONS: usize = 192;
const MAX_ACT_CHANGES: usize = 64;

fn text(value: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.len() > MAX_TEXT || value.chars().any(char::is_control) {
        Err("Expected bounded nonempty text without control characters".into())
    } else {
        Ok(())
    }
}
fn optional_text(value: &Option<String>) -> Result<(), String> {
    value.as_deref().map(text).unwrap_or(Ok(()))
}

/// Deterministic local suffix for kernel-derived presentation refs
/// (FNV-1a 64, the same digest family Central uses for content refs).
/// It never replaces a native identity — it names the presentation binding
/// whose payload carries the native ref verbatim.
fn fnv1a64(value: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
}

// ---------------------------------------------------------------------------
// Shared selection / deictic context
// ---------------------------------------------------------------------------

/// Which presentation last moved the shared selection. The origin is
/// disclosure, never identity: every origin addresses the same native ref.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Origin {
    Graph,
    Wiki,
    Constellation,
    Expression,
    Agent,
    Page,
}

impl Origin {
    fn as_str(self) -> &'static str {
        match self {
            Origin::Graph => "graph",
            Origin::Wiki => "wiki",
            Origin::Constellation => "constellation",
            Origin::Expression => "expression",
            Origin::Agent => "agent",
            Origin::Page => "page",
        }
    }
}

/// The one shared selection relation (the deictic context): the exact
/// native subject every presentation is currently talking about, which
/// presentation moved it last, and — when addressed — the Expression and
/// entity that present it. Kernel-owned; there is exactly one.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Selection {
    pub subject_ref: String,
    pub kind: String,
    pub native_owner: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
    pub origin: Origin,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expression_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entity_ref: Option<String>,
    /// Caller-supplied correlation. Never authentication, never authority.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub activity_ref: Option<String>,
}

// ---------------------------------------------------------------------------
// Surface portals (ES1): placements over the existing Surface host
// ---------------------------------------------------------------------------

/// Where a portal holds its target. `redock` is deliberately absent: a
/// re-dock is [`Request::PortalRedock`] on an existing portal — a return,
/// never an opening.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Placement {
    Preview,
    Overlay,
    Beside,
    Full,
    Detached,
}

/// One portal record. The surface binding itself lives in the existing
/// kernel Surface host (`Kernel::surfaces`); this record adds only the
/// placement and the caller's correlation. `target_ref` is the canonical
/// native ref, preserved through every placement.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Portal {
    pub portal_ref: String,
    pub target_ref: String,
    pub surface_id: String,
    pub surface_kind: String,
    pub placement: Placement,
    pub title: String,
    pub opened_by: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub activity_ref: Option<String>,
}

// ---------------------------------------------------------------------------
// ExpressiveAct (ES4): generic cancellable-act state
// ---------------------------------------------------------------------------

/// A performed act runs until a human interruption holds it. Holding is
/// holding: nothing is reverted and nothing advances until a further
/// operation says so. Checkpoint/restore is the explicit return path.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ActState {
    Running,
    Held,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Act {
    pub act_ref: String,
    pub expression_ref: String,
    pub summary: String,
    pub actor: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub activity_ref: Option<String>,
    pub state: ActState,
    /// The Expression revision the act was (last) performed against.
    pub basis_revision: u64,
}

/// One exact snapshot of an Expression draft, taken under an act. Restore
/// returns the draft to precisely these refs and revisions — never a
/// paraphrase.
#[derive(Clone, Debug)]
pub struct Checkpoint {
    pub checkpoint_ref: String,
    pub act_ref: String,
    pub revision: u64,
    pub document: expression::Document,
}

// ---------------------------------------------------------------------------
// Bounded local whole (ES1 knowledge side / #366 EX3A2, EX3A4)
// ---------------------------------------------------------------------------

/// One subject of a local whole: the exact reading (ref + revision +
/// availability) beside its native owner. No copied source body.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct WholeMember {
    pub subject: ReadingRef,
    pub native_owner: String,
}

/// One declared relation of a local whole: the owner's relation reading
/// (ref + revision) and its endpoint subject refs, verbatim.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct WholeRelation {
    pub relation: ReadingRef,
    pub from_ref: String,
    pub to_ref: String,
}

/// The bounded local-whole binding (#366 EX3A2): the owner basis reading
/// the whole was resolved from, the exact member readings, the declared
/// relations, and the Expression that presents it. This is the smallest
/// record that can truthfully carry the live Wiki→Expression relation; it
/// copies no source body and owns no semantic edge.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LocalWhole {
    pub whole_ref: String,
    pub basis: ReadingRef,
    pub locus_ref: String,
    pub members: Vec<WholeMember>,
    pub relations: Vec<WholeRelation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expression_ref: Option<String>,
    pub actor: String,
}

impl LocalWhole {
    /// Validate shape and budgets. Members are unique by exact subject ref;
    /// every relation endpoint must be a member; bounds mirror the owner
    /// relations read (`--max-nodes 96 --max-edges 192`).
    fn validate(&self) -> Result<(), String> {
        text(&self.whole_ref)?;
        text(&self.locus_ref)?;
        text(&self.actor)?;
        reading_available(&self.basis).map_err(|e| format!("Whole basis: {e}"))?;
        if self.members.is_empty() || self.members.len() > MAX_MEMBERS {
            return Err("Local whole must bind between 1 and 96 member readings".into());
        }
        let mut refs = BTreeSet::new();
        for member in &self.members {
            reading(&member.subject)?;
            text(&member.native_owner)?;
            if !refs.insert(member.subject.r#ref.clone()) {
                return Err("Local whole members must be unique by exact subject ref".into());
            }
        }
        if !refs.contains(&self.locus_ref) {
            return Err("The locus must be one of the whole's members".into());
        }
        if self.relations.len() > MAX_RELATIONS {
            return Err("Local whole relation budget exceeded (192)".into());
        }
        for relation in &self.relations {
            reading(&relation.relation)?;
            if !refs.contains(&relation.from_ref) || !refs.contains(&relation.to_ref) {
                return Err("Relation endpoints must be members of the whole".into());
            }
        }
        if let Some(expression_ref) = &self.expression_ref {
            text(expression_ref)?;
        }
        Ok(())
    }

    /// Honest staleness rollup from the recorded readings: what this record
    /// itself already knows is stale or unavailable. Freshness against the
    /// live owner is only ever established by an explicit
    /// [`Request::WholeRebase`] carrying a new owner reading.
    fn staleness(&self) -> Value {
        let mut stale_members = 0usize;
        let mut unavailable_members = 0usize;
        for member in &self.members {
            match member.subject.availability {
                Availability::Stale => stale_members += 1,
                Availability::Unavailable | Availability::Withheld => unavailable_members += 1,
                Availability::Available => {}
            }
        }
        let stale_relations = self
            .relations
            .iter()
            .filter(|r| r.relation.availability == Availability::Stale)
            .count();
        json!({
            "stale_members": stale_members,
            "unavailable_members": unavailable_members,
            "stale_relations": stale_relations,
            "fresh_against_owner": "unknown_until_rebase",
        })
    }
}

fn reading(value: &ReadingRef) -> Result<(), String> {
    text(&value.r#ref)?;
    text(&value.revision)
}
fn reading_available(value: &ReadingRef) -> Result<(), String> {
    reading(value)?;
    if value.availability != Availability::Available {
        return Err("Expected an available reading".into());
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Presentation over the whole: geometry is never semantics
// ---------------------------------------------------------------------------

/// A layout/constellation assignment: presentation geometry and glyph roles
/// per member. This is ALL a layout is — there is deliberately no way to
/// feed one into relation identity.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct ConstellationLayout {
    /// Presentation position per member subject ref.
    pub positions: BTreeMap<String, [f64; 3]>,
    /// Presentation glyph per member subject ref (bounded text).
    pub glyphs: BTreeMap<String, String>,
}

/// Relation presentation bindings for an Expression over this whole,
/// derived ONLY from the whole's declared native relations. A relation is
/// eligible because the owner disclosed it (available reading) and its
/// endpoints are bound entities — never because a layout placed two things
/// near each other. Binding refs are deterministic local names; the native
/// relation reading rides verbatim in `relation`.
pub fn relation_bindings(
    whole: &LocalWhole,
    expression_ref: &str,
    entity_of: &BTreeMap<String, String>,
) -> Result<Vec<expression::Relation>, String> {
    whole.validate()?;
    let mut bindings = Vec::new();
    for relation in &whole.relations {
        if relation.relation.availability != Availability::Available {
            continue;
        }
        let (Some(from), Some(to)) = (
            entity_of.get(&relation.from_ref),
            entity_of.get(&relation.to_ref),
        ) else {
            continue;
        };
        bindings.push(expression::Relation {
            binding_ref: format!(
                "{expression_ref}:relation:w-{}",
                fnv1a64(&relation.relation.r#ref)
            ),
            relation: relation.relation.clone(),
            from_entity_ref: from.clone(),
            to_entity_ref: to.clone(),
            provenance: vec![],
        });
    }
    Ok(bindings)
}

/// The kernel-side presentation seam: turn a whole + a layout into bounded
/// Expression changes over `scene_ref`. Geometry lands ONLY in presentation
/// parameters (glyph/x/y/z/scale); subject bindings carry the exact member
/// readings; relation identity is not an input here at all — apply
/// [`relation_bindings`] separately if the owner declared relations. The
/// locus is focused. Presentation never removes or re-binds anything it
/// does not own (changes are additive for `w-`-prefixed members only; the
/// caller's existing manual entities are untouched).
pub fn presentation_changes(
    document: &expression::Document,
    whole: &LocalWhole,
    layout: &ConstellationLayout,
    scene_ref: &str,
) -> Result<Vec<Change>, String> {
    whole.validate()?;
    text(scene_ref)?;
    let expression_ref = &document.expression_ref;
    if !scene_ref.starts_with(&format!("{expression_ref}:scene:")) {
        return Err("Presentation scene must belong to the Expression".into());
    }
    let mut changes = Vec::new();
    if !document.scenes.iter().any(|s| s.scene_ref == scene_ref) {
        changes.push(Change::SceneCreate {
            scene_ref: scene_ref.into(),
            title: "Constellation".into(),
        });
    }
    let mut entity_of = BTreeMap::new();
    for member in &whole.members {
        let subject_ref = &member.subject.r#ref;
        let entity_ref = format!("{expression_ref}:entity:w-{}", fnv1a64(subject_ref));
        entity_of.insert(subject_ref.clone(), entity_ref.clone());
        let existing = document.entities.get(&entity_ref);
        if existing.is_none() {
            changes.push(Change::EntityAdd {
                scene_ref: scene_ref.into(),
                entity_ref: entity_ref.clone(),
                title: subject_ref.clone(),
            });
        }
        let binding = expression::SubjectBinding {
            subject_ref: subject_ref.clone(),
            native_owner: member.native_owner.clone(),
            presentation_role: expression::Role::Thing,
            sources: vec![],
            readings: vec![member.subject.clone()],
            actions: vec![],
        };
        let changed_binding = existing
            .map(|e| e.subject.as_ref() != Some(&binding))
            .unwrap_or(true);
        if changed_binding {
            changes.push(Change::SubjectBind {
                entity_ref: entity_ref.clone(),
                binding,
            });
        }
        // Geometry: presentation parameters only. Nothing here can mint a
        // relation, an identity or an Action.
        let position = layout
            .positions
            .get(subject_ref)
            .copied()
            .unwrap_or([0., 0., 0.]);
        let glyph = layout
            .glyphs
            .get(subject_ref)
            .cloned()
            .unwrap_or_else(|| "·".into());
        let values: [(&str, Value); 4] = [
            ("glyph", json!(glyph)),
            ("x", json!(position[0])),
            ("y", json!(position[1])),
            ("z", json!(position[2])),
        ];
        for (parameter, value) in values {
            let differs = existing
                .and_then(|e| e.parameters.get(parameter))
                .map(|p| p.value != value)
                .unwrap_or(true);
            if differs {
                changes.push(Change::ParameterSet {
                    entity_ref: entity_ref.clone(),
                    parameter: parameter.into(),
                    value,
                });
            }
        }
    }
    // Compose the scene in the whole's order, keeping foreign members that
    // were already in the scene behind the managed ones.
    let managed: Vec<String> = whole
        .members
        .iter()
        .map(|m| entity_of[&m.subject.r#ref].clone())
        .collect();
    let foreign = document
        .scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .map(|s| {
            s.entity_refs
                .iter()
                .filter(|r| !managed.contains(r))
                .cloned()
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let mut ordered = managed;
    ordered.extend(foreign);
    let composed = document
        .scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .map(|s| s.entity_refs != ordered)
        .unwrap_or(true);
    if composed {
        changes.push(Change::SceneCompose {
            scene_ref: scene_ref.into(),
            entity_refs: ordered,
        });
    }
    // Focus the locus — re-centre, never identity mutation.
    let locus_entity = entity_of.get(&whole.locus_ref).cloned();
    let selection_differs =
        document.selection.scene_ref != scene_ref || document.selection.entity_ref != locus_entity;
    if selection_differs {
        changes.push(Change::Focus {
            scene_ref: scene_ref.into(),
            entity_ref: locus_entity,
        });
    }
    Ok(changes)
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/// ES4 generic world operations over `oi.expression/v1`'s kernel. Serde tag
/// `operation`, snake_case, unknown fields refused.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Capabilities,
    /// Move the shared selection/deictic context from any presentation.
    /// Selection is inspection: it never invokes an Action. When
    /// `expression_ref` is named and open, the Expression's selection
    /// follows through the exact refs (the entity bound to this exact
    /// subject ref is focused); an Expression with no such binding is an
    /// explicit `unbound` disclosure, never a minted binding.
    SelectionSet {
        origin: Origin,
        subject_ref: String,
        kind: String,
        native_owner: String,
        #[serde(default)]
        revision: Option<String>,
        #[serde(default)]
        activity_ref: Option<String>,
        #[serde(default)]
        expression_ref: Option<String>,
    },
    SelectionRead,
    PortalInspect {
        #[serde(default)]
        target_ref: Option<String>,
    },
    /// Open (or re-place) a portal onto a target through the EXISTING
    /// kernel Surface host: `surface_open` makes the binding, this record
    /// adds the placement. A target the host refuses (for example a
    /// knowledge surface with no current owner reading) is an explicit
    /// `unavailable_surface` degradation disclosure.
    PortalOpen {
        portal_ref: String,
        target_ref: String,
        surface_kind: String,
        surface_id: String,
        placement: Placement,
        title: String,
        actor: String,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    PortalClose {
        portal_ref: String,
        actor: String,
    },
    /// Return a detached portal to the docked (`preview`) placement. The
    /// canonical target ref is unchanged — a re-dock never re-opens or
    /// re-derives identity.
    PortalRedock {
        portal_ref: String,
        actor: String,
    },
    /// Perform a bounded cancellable act: one atomic Expression edit
    /// (exact subjects, exact revisions) recorded as a running act that a
    /// human interruption can hold. `activity_ref` is correlation.
    ActPerform {
        act_ref: String,
        expression_ref: String,
        expected_revision: u64,
        summary: String,
        actor: String,
        #[serde(default)]
        activity_ref: Option<String>,
        changes: Vec<Change>,
    },
    /// Human interruption: hold the act. Nothing reverts and nothing
    /// advances; the presentation stays exactly as the act left it.
    ActInterrupt {
        act_ref: String,
        actor: String,
        #[serde(default)]
        reason: Option<String>,
    },
    /// Take an exact snapshot of the act's Expression draft.
    ActCheckpoint {
        act_ref: String,
        checkpoint_ref: String,
        actor: String,
    },
    /// Return the Expression draft to an exact checkpoint (refs and
    /// revisions preserved; the revision advances because a restore is a
    /// change, never a silent rewind).
    ActRestore {
        act_ref: String,
        checkpoint_ref: String,
        expected_revision: u64,
        actor: String,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    /// Record the live Wiki→Expression binding basis (#366 EX3A2): the
    /// owner basis reading, exact member readings, declared relations and
    /// the presenting Expression. Copies nothing.
    WholeBind {
        whole_ref: String,
        basis: ReadingRef,
        locus_ref: String,
        members: Vec<WholeMember>,
        relations: Vec<WholeRelation>,
        #[serde(default)]
        expression_ref: Option<String>,
        actor: String,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    WholeInspect {
        whole_ref: String,
    },
    /// Explicit drift rebase (#366 EX3A4): move the whole to a NEW owner
    /// basis. Refuses a stale `expected_basis_revision` (`whole_basis_conflict`)
    /// and a no-op rebase (`whole_unchanged`) — never silent, never partial.
    WholeRebase {
        whole_ref: String,
        expected_basis_revision: String,
        basis: ReadingRef,
        members: Vec<WholeMember>,
        relations: Vec<WholeRelation>,
        actor: String,
        #[serde(default)]
        activity_ref: Option<String>,
    },
}

/// The ES4 world state the kernel owns: one shared selection, the portal
/// records, the acts and their checkpoints, and the local-whole bindings.
#[derive(Debug, Default)]
pub struct WorldState {
    selection: Option<Selection>,
    portals: BTreeMap<String, Portal>,
    acts: BTreeMap<String, Act>,
    checkpoints: BTreeMap<String, Checkpoint>,
    wholes: BTreeMap<String, LocalWhole>,
}

impl WorldState {
    /// Record the selection as moved from an Expression focus edit (the
    /// reciprocal direction of [`Request::SelectionSet`]). Returns whether
    /// the shared relation actually changed.
    pub fn record_expression_selection(
        &mut self,
        expression_ref: &str,
        subject: &SemanticRef,
    ) -> bool {
        let next = Selection {
            subject_ref: subject.ref_id.clone(),
            kind: subject.kind.clone(),
            native_owner: subject.native_owner.clone(),
            revision: subject.provenance.revision.clone(),
            origin: Origin::Expression,
            expression_ref: Some(expression_ref.to_owned()),
            entity_ref: None,
            activity_ref: None,
        };
        let changed = self.selection.as_ref() != Some(&next);
        if changed {
            self.selection = Some(next);
        }
        changed
    }
}

/// Capability/degradation disclosure for the world operations. Names the
/// placements, act states, origins, budgets, the degradation states and the
/// ownership laws. No paradigm names: this is the generic contract.
pub fn capabilities() -> Value {
    json!({
        "schema": "oi.expression-world-capabilities/v1",
        "operations": [
            "capabilities", "selection_set", "selection_read",
            "portal_inspect", "portal_open", "portal_close", "portal_redock",
            "act_perform", "act_interrupt", "act_checkpoint", "act_restore",
            "whole_bind", "whole_inspect", "whole_rebase"
        ],
        "selection": {
            "origins": ["graph", "wiki", "constellation", "expression", "agent", "page"],
            "law": "selection is inspection, never Action invocation; one shared kernel relation; expression focus follows through exact bound subject refs only",
        },
        "portals": {
            "placements": ["preview", "overlay", "beside", "full", "detached"],
            "redock": "portal_redock (existing portals only)",
            "host": "the existing kernel Surface host; the canonical target ref is preserved through every placement",
            "degradation": "unavailable_surface names the host's own refusal; no surface is fabricated",
        },
        "acts": {
            "states": ["running", "held"],
            "interrupt": "human interruption holds the act; nothing reverts or advances",
            "checkpoint": "exact document snapshot; restore preserves exact refs and revisions and advances the revision as an explicit change",
        },
        "wholes": {
            "law": "bounded local neighbourhood only; relation identity comes only from declared owner readings; drift is disclosed and rebasing is explicit",
            "members_max": MAX_MEMBERS,
            "relations_max": MAX_RELATIONS,
            "rebase": "whole_rebase requires the recorded basis revision; refuses stale expectations and no-op rebases",
        },
        "budgets": {
            "portals": MAX_PORTALS, "acts": MAX_ACTS,
            "checkpoints": MAX_CHECKPOINTS, "checkpoints_per_act": MAX_CHECKPOINTS_PER_ACT,
            "wholes": MAX_WHOLES, "act_changes": MAX_ACT_CHANGES,
        },
        "activity_ref": "caller-supplied correlation, never authentication",
        "source_mutation": false,
        "unsupported": ["action_invocation", "semantic_edge_minting", "whole_graph_load", "silent_rebase"],
        "contract": "docs/contracts/EXPRESSION-APPLICATION-V1.md"
    })
}

impl Kernel {
    /// The ES4 world operation handler. Wired from `KernelOp::ExpressionWorld`
    /// (see lib.rs); kept in this module so the shared kernel file carries
    /// only the wiring.
    pub fn expression_world(&mut self, request: Request) -> Result<KernelOpOutcome, String> {
        let mut receipts = Vec::new();
        let data = match request {
            Request::Capabilities => capabilities(),
            Request::SelectionSet {
                origin,
                subject_ref,
                kind,
                native_owner,
                revision,
                activity_ref,
                expression_ref,
            } => {
                text(&subject_ref)?;
                text(&kind)?;
                text(&native_owner)?;
                optional_text(&revision)?;
                optional_text(&activity_ref)?;
                optional_text(&expression_ref)?;
                // 1. The one global focus relation moves with the selection.
                let semantic = SemanticRef {
                    ref_id: subject_ref.clone(),
                    kind: kind.clone(),
                    native_owner: native_owner.clone(),
                    provenance: RefProvenance {
                        source: format!("expression-world.selection.{}", origin.as_str()),
                        revision: revision.clone(),
                    },
                };
                let before = self.focus.clone();
                self.focus
                    .focus_subject(semantic)
                    .map_err(|e| e.to_string())?;
                if before != self.focus {
                    receipts.push(self.log.record(KernelEvent::FocusChanged {
                        focus: self.focus.clone(),
                    }));
                }
                // 2. The addressed Expression follows through exact refs —
                // inspection moving the presentation, never minting bindings.
                let expression = match &expression_ref {
                    Some(r) => {
                        self.world_follow_expression(r, &subject_ref, origin, &mut receipts)?
                    }
                    None => json!({"state":"not_addressed"}),
                };
                // 3. Store the shared deictic context with what the follow disclosed.
                let selection = Selection {
                    subject_ref,
                    kind,
                    native_owner,
                    revision,
                    origin,
                    expression_ref,
                    entity_ref: expression["entity_ref"].as_str().map(str::to_owned),
                    activity_ref,
                };
                self.world.selection = Some(selection.clone());
                json!({"state":"selected","selection":selection,"expression":expression})
            }
            Request::SelectionRead => match &self.world.selection {
                Some(selection) => json!({"state":"selected","selection":selection}),
                None => json!({"state":"unselected"}),
            },
            Request::PortalInspect { target_ref } => {
                optional_text(&target_ref)?;
                let portals: Vec<&Portal> = self
                    .world
                    .portals
                    .values()
                    .filter(|p| match &target_ref {
                        Some(t) => p.target_ref == *t,
                        None => true,
                    })
                    .collect();
                json!({
                    "state":"portals",
                    "portals":portals,
                    "placements":["preview","overlay","beside","full","detached"],
                    "redock":"portal_redock",
                })
            }
            Request::PortalOpen {
                portal_ref,
                target_ref,
                surface_kind,
                surface_id,
                placement,
                title,
                actor,
                activity_ref,
            } => {
                text(&portal_ref)?;
                text(&target_ref)?;
                text(&surface_kind)?;
                text(&surface_id)?;
                text(&title)?;
                text(&actor)?;
                optional_text(&activity_ref)?;
                if let Some(existing) = self.world.portals.get(&portal_ref) {
                    // Re-placement of the same portal onto the same target is
                    // explicit; a different target under one portal ref is not.
                    if existing.target_ref != target_ref || existing.surface_id != surface_id {
                        return Err("Portal ref already names another target or surface".into());
                    }
                } else if self.world.portals.len() >= MAX_PORTALS {
                    return Err("Portal budget exceeded".into());
                }
                // Route through the EXISTING Surface host. Its refusal is the
                // degradation disclosure — no substitute binding is fabricated.
                match self.surface_open(
                    surface_id.clone(),
                    surface_kind.clone(),
                    Some(target_ref.clone()),
                    title.clone(),
                ) {
                    Ok(mut opened) => {
                        let portal = Portal {
                            portal_ref: portal_ref.clone(),
                            target_ref: target_ref.clone(),
                            surface_id,
                            surface_kind,
                            placement,
                            title,
                            opened_by: actor,
                            activity_ref,
                        };
                        let state = json!({
                            "state":"portal_open",
                            "portal":portal,
                            "placement":{"current":portal.placement,"redock":"portal_redock"},
                        });
                        self.world.portals.insert(portal_ref, portal);
                        receipts.append(&mut opened.receipts);
                        state
                    }
                    Err(detail) => json!({
                        "state":"unavailable_surface",
                        "target_ref":target_ref,
                        "surface_kind":surface_kind,
                        "placement":placement,
                        "detail":detail,
                    }),
                }
            }
            Request::PortalClose { portal_ref, actor } => {
                text(&actor)?;
                let portal = self
                    .world
                    .portals
                    .remove(&portal_ref)
                    .ok_or("no portal with this ref is open")?;
                let mut closed = self.surface_close(portal.surface_id.clone())?;
                receipts.append(&mut closed.receipts);
                json!({"state":"portal_closed","portal_ref":portal_ref,"target_ref":portal.target_ref})
            }
            Request::PortalRedock { portal_ref, actor } => {
                text(&actor)?;
                let portal = self
                    .world
                    .portals
                    .get_mut(&portal_ref)
                    .ok_or("no portal with this ref is open")?;
                if portal.placement != Placement::Detached {
                    return Err("Only a detached portal can re-dock".into());
                }
                portal.placement = Placement::Preview;
                json!({"state":"portal_redocked","portal":portal.clone()})
            }
            Request::ActPerform {
                act_ref,
                expression_ref,
                expected_revision,
                summary,
                actor,
                activity_ref,
                changes,
            } => {
                text(&act_ref)?;
                text(&expression_ref)?;
                text(&summary)?;
                text(&actor)?;
                optional_text(&activity_ref)?;
                if changes.is_empty() || changes.len() > MAX_ACT_CHANGES {
                    return Err("An act performs a bounded, non-empty change set".into());
                }
                if let Some(existing) = self.world.acts.get(&act_ref) {
                    // A held act resumes with its next bounded change set; a
                    // running act refuses a second performance.
                    if existing.expression_ref != expression_ref {
                        return Err("Act ref already names another Expression".into());
                    }
                    if existing.state == ActState::Running {
                        return Err("Act is already running; interrupt it first".into());
                    }
                } else if self.world.acts.len() >= MAX_ACTS {
                    return Err("Act budget exceeded".into());
                }
                // The act's edit is an ordinary atomic Expression edit: exact
                // subjects, exact expected revision, stale input refuses.
                let (data, changed) = self.expressions.apply(
                    &self.client,
                    expression::Request::Edit {
                        expression_ref: expression_ref.clone(),
                        expected_revision,
                        actor: actor.clone(),
                        changes,
                    },
                )?;
                if data["state"] == "revision_conflict" {
                    return Ok(KernelOpOutcome {
                        receipts,
                        result: KernelOpResult::ExpressionWorld { data },
                    });
                }
                let act = Act {
                    act_ref: act_ref.clone(),
                    expression_ref: expression_ref.clone(),
                    summary,
                    actor,
                    activity_ref,
                    state: ActState::Running,
                    basis_revision: expected_revision,
                };
                self.world.acts.insert(act_ref.clone(), act);
                if let Some(change) = changed {
                    receipts.push(self.log.record(KernelEvent::ExpressionChanged {
                        expression_ref: change.expression_ref,
                        revision: change.revision,
                        actor: change.actor,
                        activity_ref: change.activity_ref,
                    }));
                }
                json!({"state":"act_running","act":self.world.acts.get(&act_ref)})
            }
            Request::ActInterrupt {
                act_ref,
                actor,
                reason,
            } => {
                text(&actor)?;
                optional_text(&reason)?;
                let act = self
                    .world
                    .acts
                    .get_mut(&act_ref)
                    .ok_or("no act with this ref exists")?;
                let previous = act.state;
                act.state = ActState::Held;
                if previous == ActState::Running {
                    json!({"state":"act_held","act":act.clone(),"detail":"The act is held; nothing reverted and nothing advanced"})
                } else {
                    json!({"state":"act_held","act":act.clone(),"detail":"The act was already held"})
                }
            }
            Request::ActCheckpoint {
                act_ref,
                checkpoint_ref,
                actor,
            } => {
                text(&actor)?;
                text(&checkpoint_ref)?;
                let act = self
                    .world
                    .acts
                    .get(&act_ref)
                    .ok_or("no act with this ref exists")?;
                if self
                    .world
                    .checkpoints
                    .values()
                    .filter(|c| c.act_ref == act_ref)
                    .count()
                    >= MAX_CHECKPOINTS_PER_ACT
                    || self.world.checkpoints.len() >= MAX_CHECKPOINTS
                {
                    return Err("Checkpoint budget exceeded".into());
                }
                let (inspected, _) = self.expressions.apply(
                    &self.client,
                    expression::Request::Inspect {
                        expression_ref: act.expression_ref.clone(),
                    },
                )?;
                let document: expression::Document =
                    serde_json::from_value(inspected["document"].clone())
                        .map_err(|e| format!("Expression document unreadable: {e}"))?;
                let checkpoint = Checkpoint {
                    checkpoint_ref: checkpoint_ref.clone(),
                    act_ref: act_ref.clone(),
                    revision: document.revision,
                    document,
                };
                let state = json!({
                    "state":"checkpointed",
                    "checkpoint":{
                        "checkpoint_ref":checkpoint_ref,
                        "act_ref":act_ref,
                        "revision":checkpoint.revision,
                    },
                });
                self.world.checkpoints.insert(checkpoint_ref, checkpoint);
                state
            }
            Request::ActRestore {
                act_ref,
                checkpoint_ref,
                expected_revision,
                actor,
                activity_ref: _,
            } => {
                text(&actor)?;
                let checkpoint = self
                    .world
                    .checkpoints
                    .get(&checkpoint_ref)
                    .ok_or("no checkpoint with this ref exists")?;
                if checkpoint.act_ref != act_ref {
                    return Err("Checkpoint belongs to another act".into());
                }
                let expression_ref = self
                    .world
                    .acts
                    .get(&act_ref)
                    .map(|a| a.expression_ref.clone())
                    .ok_or("no act with this ref exists")?;
                // Explicit restore of the draft to the exact checkpointed
                // document. The Restore request refuses a stale expected
                // revision and advances the revision — a change, not a rewind.
                let (data, changed) = self.expressions.apply(
                    &self.client,
                    expression::Request::Restore {
                        expression_ref,
                        expected_revision,
                        document: checkpoint.document.clone(),
                        actor,
                    },
                )?;
                if data["state"] == "revision_conflict" {
                    return Ok(KernelOpOutcome {
                        receipts,
                        result: KernelOpResult::ExpressionWorld { data },
                    });
                }
                if let Some(change) = changed {
                    receipts.push(self.log.record(KernelEvent::ExpressionChanged {
                        expression_ref: change.expression_ref,
                        revision: change.revision,
                        actor: change.actor,
                        activity_ref: change.activity_ref,
                    }));
                }
                json!({"state":"act_restored","act_ref":act_ref,"checkpoint_ref":checkpoint_ref,"expression":data})
            }
            Request::WholeBind {
                whole_ref,
                basis,
                locus_ref,
                members,
                relations,
                expression_ref,
                actor,
                activity_ref: _,
            } => {
                text(&actor)?;
                optional_text(&expression_ref)?;
                if self.world.wholes.contains_key(&whole_ref) {
                    return Err("Whole ref already exists; rebase it explicitly instead".into());
                }
                if self.world.wholes.len() >= MAX_WHOLES {
                    return Err("Local whole budget exceeded".into());
                }
                if let Some(r) = &expression_ref {
                    // The presenting Expression must be open: a whole binds to
                    // a live projection, never a hypothetical one.
                    self.expressions.apply(
                        &self.client,
                        expression::Request::Inspect {
                            expression_ref: r.clone(),
                        },
                    )?;
                }
                let whole = LocalWhole {
                    whole_ref: whole_ref.clone(),
                    basis,
                    locus_ref,
                    members,
                    relations,
                    expression_ref,
                    actor,
                };
                whole.validate()?;
                let state =
                    json!({"state":"whole_bound","whole":whole,"staleness":whole.staleness()});
                self.world.wholes.insert(whole_ref, whole);
                state
            }
            Request::WholeInspect { whole_ref } => match self.world.wholes.get(&whole_ref) {
                Some(whole) => json!({
                    "state":"whole",
                    "whole":whole,
                    "staleness":whole.staleness(),
                    "rebase":{"operation":"whole_rebase","requires":["expected_basis_revision","basis","members","relations"]},
                }),
                None => json!({"state":"unknown_whole","whole_ref":whole_ref}),
            },
            Request::WholeRebase {
                whole_ref,
                expected_basis_revision,
                basis,
                members,
                relations,
                actor,
                activity_ref: _,
            } => {
                text(&actor)?;
                let Some(whole) = self.world.wholes.get_mut(&whole_ref) else {
                    return Ok(KernelOpOutcome {
                        receipts,
                        result: KernelOpResult::ExpressionWorld {
                            data: json!({"state":"unknown_whole","whole_ref":whole_ref}),
                        },
                    });
                };
                // Explicit, never silent: a stale expectation of the basis is
                // a structured conflict, and a same-revision rebase is refused.
                if expected_basis_revision != whole.basis.revision {
                    return Ok(KernelOpOutcome {
                        receipts,
                        result: KernelOpResult::ExpressionWorld {
                            data: json!({
                                "state":"whole_basis_conflict",
                                "whole_ref":whole_ref,
                                "expected_basis_revision":expected_basis_revision,
                                "current_basis_revision":whole.basis.revision,
                                "detail":"The caller's view of the owner basis is itself stale; re-read the owner basis before rebasing",
                            }),
                        },
                    });
                }
                if basis.revision == whole.basis.revision {
                    return Ok(KernelOpOutcome {
                        receipts,
                        result: KernelOpResult::ExpressionWorld {
                            data: json!({
                                "state":"whole_unchanged",
                                "whole_ref":whole_ref,
                                "basis_revision":whole.basis.revision,
                                "detail":"The owner basis revision is unchanged; a rebase would be silent",
                            }),
                        },
                    });
                }
                reading_available(&basis).map_err(|e| format!("Whole basis: {e}"))?;
                let previous_basis_revision = whole.basis.revision.clone();
                let candidate = LocalWhole {
                    whole_ref: whole.whole_ref.clone(),
                    basis,
                    locus_ref: whole.locus_ref.clone(),
                    members,
                    relations,
                    expression_ref: whole.expression_ref.clone(),
                    actor,
                };
                candidate.validate()?;
                *whole = candidate;
                let whole = self.world.wholes.get(&whole_ref).unwrap();
                json!({
                    "state":"whole_rebased",
                    "whole":whole,
                    "previous_basis_revision":previous_basis_revision,
                    "staleness":whole.staleness(),
                })
            }
        };
        Ok(KernelOpOutcome {
            receipts,
            result: KernelOpResult::ExpressionWorld { data },
        })
    }

    /// Move the addressed Expression's selection to the entity bound to the
    /// EXACT subject ref. No binding is minted: an Expression without such
    /// an entity discloses `unbound`. Uses the kernel's own current revision
    /// (one kernel mutex — no concurrent editor to conflict with), and
    /// emits the ordinary `expression_changed` receipt when the document
    /// actually changed.
    fn world_follow_expression(
        &mut self,
        expression_ref: &str,
        subject_ref: &str,
        origin: Origin,
        receipts: &mut Vec<crate::events::KernelEventReceipt>,
    ) -> Result<Value, String> {
        let inspected = match self.expressions.apply(
            &self.client,
            expression::Request::Inspect {
                expression_ref: expression_ref.to_owned(),
            },
        ) {
            Ok((value, _)) => value,
            Err(_) => {
                return Ok(json!({
                    "state":"expression_not_open",
                    "expression_ref":expression_ref,
                    "detail":"The addressed Expression is not open; the shared selection still moved",
                }))
            }
        };
        let document: expression::Document = serde_json::from_value(inspected["document"].clone())
            .map_err(|e| format!("Expression document unreadable: {e}"))?;
        let mut target: Option<(String, String)> = None;
        for (entity_ref, entity) in &document.entities {
            if entity
                .subject
                .as_ref()
                .is_some_and(|b| b.subject_ref == subject_ref)
            {
                let scene_ref = document
                    .scenes
                    .iter()
                    .find(|s| {
                        s.scene_ref == document.selection.scene_ref
                            && s.entity_refs.contains(entity_ref)
                    })
                    .or_else(|| {
                        document
                            .scenes
                            .iter()
                            .find(|s| s.entity_refs.contains(entity_ref))
                    })
                    .map(|s| s.scene_ref.clone());
                if let Some(scene_ref) = scene_ref {
                    target = Some((entity_ref.clone(), scene_ref));
                    break;
                }
            }
        }
        let Some((entity_ref, scene_ref)) = target else {
            return Ok(json!({
                "state":"unbound",
                "expression_ref":expression_ref,
                "subject_ref":subject_ref,
                "detail":"No entity in this Expression is bound to the exact subject ref; selection never mints bindings",
            }));
        };
        let (data, changed) = self.expressions.apply(
            &self.client,
            expression::Request::Edit {
                expression_ref: expression_ref.to_owned(),
                expected_revision: document.revision,
                actor: format!("presentation:{}", origin.as_str()),
                changes: vec![Change::Focus {
                    scene_ref,
                    entity_ref: Some(entity_ref.clone()),
                }],
            },
        )?;
        if let Some(change) = changed {
            receipts.push(self.log.record(KernelEvent::ExpressionChanged {
                expression_ref: change.expression_ref,
                revision: change.revision,
                actor: change.actor,
                activity_ref: change.activity_ref,
            }));
        }
        Ok(json!({
            "state":"focused",
            "expression_ref":expression_ref,
            "entity_ref":entity_ref,
            "revision":data["document"]["revision"],
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reading(r: &str, revision: &str) -> ReadingRef {
        ReadingRef {
            r#ref: r.into(),
            revision: revision.into(),
            availability: Availability::Available,
        }
    }

    fn whole() -> LocalWhole {
        LocalWhole {
            whole_ref: "whole:test".into(),
            basis: reading("wiki:a", "r1"),
            locus_ref: "wiki:a".into(),
            members: vec![
                WholeMember {
                    subject: reading("wiki:a", "r1"),
                    native_owner: "ai-kit".into(),
                },
                WholeMember {
                    subject: reading("wiki:b", "r1"),
                    native_owner: "ai-kit".into(),
                },
            ],
            relations: vec![WholeRelation {
                relation: reading("wiki:relation:a-b", "4"),
                from_ref: "wiki:a".into(),
                to_ref: "wiki:b".into(),
            }],
            expression_ref: None,
            actor: "human:test".into(),
        }
    }

    fn entities_of(whole: &LocalWhole, expression_ref: &str) -> BTreeMap<String, String> {
        whole
            .members
            .iter()
            .map(|m| {
                (
                    m.subject.r#ref.clone(),
                    format!("{expression_ref}:entity:w-{}", fnv1a64(&m.subject.r#ref)),
                )
            })
            .collect()
    }

    #[test]
    fn layout_permutations_yield_identical_relation_bindings() {
        let expression_ref = "expression:test";
        let w = whole();
        let entities = entities_of(&w, expression_ref);
        let bindings = relation_bindings(&w, expression_ref, &entities).unwrap();
        assert_eq!(bindings.len(), 1, "exactly the declared owner relation");
        assert_eq!(bindings[0].relation.r#ref, "wiki:relation:a-b");
        assert_eq!(bindings[0].relation.revision, "4");
        // Two different geometries over the same whole: the relation output
        // is byte-identical, because geometry is not an input to relation
        // identity — and presentation_changes carries no relation at all.
        let mut layout_a = ConstellationLayout::default();
        layout_a.positions.insert("wiki:a".into(), [0., 0., 0.]);
        layout_a.positions.insert("wiki:b".into(), [100., 0., 0.]);
        let mut layout_b = ConstellationLayout::default();
        layout_b
            .positions
            .insert("wiki:a".into(), [-500., 400., 30.]);
        layout_b
            .positions
            .insert("wiki:b".into(), [-499., 400., 30.]);
        layout_b.glyphs.insert("wiki:a".into(), "◐".into());
        let doc = crate::expression::Document {
            schema: expression::SCHEMA.into(),
            expression_ref: expression_ref.into(),
            revision: 1,
            title: "T".into(),
            scenes: vec![],
            entities: BTreeMap::new(),
            relations: BTreeMap::new(),
            selection: expression::Selection {
                scene_ref: String::new(),
                entity_ref: None,
            },
            provenance: vec![],
            representations: vec![],
            refinements: vec![],
        };
        let changes_a =
            presentation_changes(&doc, &w, &layout_a, "expression:test:scene:constellation")
                .unwrap();
        let changes_b =
            presentation_changes(&doc, &w, &layout_b, "expression:test:scene:constellation")
                .unwrap();
        let relations_of = |changes: &[Change]| -> Vec<String> {
            changes
                .iter()
                .filter_map(|c| match c {
                    Change::RelationBind { binding } => Some(binding.relation.r#ref.clone()),
                    _ => None,
                })
                .collect()
        };
        assert!(
            relations_of(&changes_a).is_empty(),
            "geometry never emits relations"
        );
        assert_eq!(relations_of(&changes_a), relations_of(&changes_b));
        // The declared-relation binding set is unchanged by layout.
        assert_eq!(
            relation_bindings(&w, expression_ref, &entities).unwrap(),
            bindings
        );
        // Adjacent placement of two members with NO declared relation mints nothing.
        let mut unrelated = whole();
        unrelated.relations.clear();
        let changes = presentation_changes(
            &doc,
            &unrelated,
            &layout_a,
            "expression:test:scene:constellation",
        )
        .unwrap();
        assert!(relations_of(&changes).is_empty());
    }

    #[test]
    fn presentation_changes_carry_exact_subject_refs_and_focus_the_locus() {
        let doc = crate::expression::Document {
            schema: expression::SCHEMA.into(),
            expression_ref: "expression:test".into(),
            revision: 1,
            title: "T".into(),
            scenes: vec![],
            entities: BTreeMap::new(),
            relations: BTreeMap::new(),
            selection: expression::Selection {
                scene_ref: String::new(),
                entity_ref: None,
            },
            provenance: vec![],
            representations: vec![],
            refinements: vec![],
        };
        let w = whole();
        let changes = presentation_changes(
            &doc,
            &w,
            &ConstellationLayout::default(),
            "expression:test:scene:constellation",
        )
        .unwrap();
        let bound = changes
            .iter()
            .filter_map(|c| match c {
                Change::SubjectBind {
                    entity_ref,
                    binding,
                } => Some((entity_ref.clone(), binding)),
                _ => None,
            })
            .collect::<Vec<_>>();
        assert_eq!(bound.len(), 2);
        assert!(bound.iter().all(|(_, b)| b.readings.len() == 1
            && b.readings[0].revision == "r1"
            && b.readings[0].availability == Availability::Available));
        assert!(changes.iter().any(|c| matches!(c, Change::Focus { entity_ref: Some(e), .. } if e.ends_with(&fnv1a64("wiki:a")))), "the locus is focused");
    }

    #[test]
    fn fnv1a64_is_deterministic_and_bounded() {
        let a = fnv1a64("wiki:relation:a-b");
        assert_eq!(a, fnv1a64("wiki:relation:a-b"));
        assert_eq!(a.len(), 16);
        assert_ne!(a, fnv1a64("wiki:relation:b-a"));
    }
}
