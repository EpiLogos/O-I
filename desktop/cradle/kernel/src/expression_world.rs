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
/// In-memory (and live-register) act budget; ended acts are archived to
/// make room, running/held acts never are.
const MAX_ACTS: usize = crate::expression_act_store::MAX_RECORDS;
const MAX_PASSAGES: usize = 512;
const MAX_BINDINGS: usize = 64;
const MAX_CAST: usize = 64;
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
/// operation says so. Checkpoint/restore is the explicit return path. An act
/// ends `completed` (carrying its Return) or `cancelled`.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ActPhase {
    Running,
    Held,
    Completed,
    Cancelled,
}
/// The ES4 name of the running/held state, kept for callers.
pub type ActState = ActPhase;

impl ActPhase {
    fn ended(self) -> bool {
        matches!(self, ActPhase::Completed | ActPhase::Cancelled)
    }
}

/// The mode an act is currently carried in; one act crosses modes through
/// explicit continuations (contract EXPRESSION-ACT-MATERIAL-V1 §4).
#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ActMode {
    Factory,
    #[default]
    Expressions,
    Techne,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PassageKind {
    Scene,
    State,
    Gesture,
    Text,
    Operate,
    Continue,
    Return,
}

/// Who is present in an act, in which role.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CastMember {
    pub role: String,
    pub participant_ref: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub character_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum BindingKind {
    Agent,
    Object,
    Text,
    Value,
}

/// A role binding (contract §3). `character_ref` is a Central file ref of a
/// `kind:"character"` material document (or an open `expression:` ref);
/// `entity_ref` pins the live-target entity presenting the role.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Binding {
    pub kind: BindingKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub character_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub glyph: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entity_ref: Option<String>,
    /// The exact revision of `character_ref` a performance used (recorded by
    /// the kernel; a caller may pin it). Seek refuses drift from it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub character_revision: Option<String>,
}

impl Binding {
    fn validate(&self) -> Result<(), String> {
        for value in [
            &self.agent_ref,
            &self.profile_ref,
            &self.character_ref,
            &self.subject_ref,
            &self.label,
            &self.text,
            &self.entity_ref,
            &self.character_revision,
        ] {
            optional_text(value)?;
        }
        if let Some(state) = &self.state {
            expression::role_name(state)?;
        }
        if let Some(glyph) = &self.glyph {
            if glyph.chars().count() > 128 || glyph.chars().any(char::is_control) {
                return Err("Binding glyph must be bounded text".into());
            }
        }
        if self.value.is_some_and(|v| !v.is_finite()) {
            return Err("Binding value must be finite".into());
        }
        Ok(())
    }
}

fn bindings_valid(bindings: &BTreeMap<String, Binding>) -> Result<(), String> {
    if bindings.len() > MAX_BINDINGS {
        return Err("Binding budget exceeded".into());
    }
    for (role, binding) in bindings {
        expression::role_name(role)?;
        binding.validate()?;
    }
    Ok(())
}

/// The material an act selects: a Central material file (`file_ref`) or an
/// open Expression (`expression_ref`), at an exact Scene or a named state.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct MaterialSelect {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expression_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scene_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
}

/// The act's current material (exact file/revision/Scene).
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ActMaterial {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expression_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scene_ref: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Transition {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub easing: Option<String>,
}

/// The native event a passage answers (Factory attempt / AIKit encounter),
/// addressed by occurrence so repeated invocations stay distinct.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EventBasis {
    pub family: String,
    pub source: String,
    pub event_ref: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub occurrence: Option<Value>,
}

fn optional_transition(value: &Option<Transition>) -> Result<(), String> {
    if let Some(t) = value {
        if t.duration.is_some_and(|d| !d.is_finite() || !(0.0..=3600.0).contains(&d)) {
            return Err("Transition duration is outside [0, 3600] seconds".into());
        }
        optional_text(&t.easing)?;
    }
    Ok(())
}
fn optional_basis(value: &Option<EventBasis>) -> Result<(), String> {
    if let Some(b) = value {
        text(&b.family)?;
        text(&b.source)?;
        text(&b.event_ref)?;
        match &b.occurrence {
            None => {}
            Some(Value::String(s)) => text(s)?,
            Some(Value::Number(n)) if n.is_u64() => {}
            Some(_) => return Err("Event occurrence must be text or a non-negative integer".into()),
        }
    }
    Ok(())
}

/// One performed passage of an act — the timeline unit. Material identity
/// and revision are exact, so `act_seek` re-performs the same passage.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Passage {
    pub index: usize,
    pub kind: PassageKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_ref: Option<String>,
    /// Material addressed as an open Expression (instead of a file).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expression_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scene_ref: Option<String>,
    /// The live Expression and Scene the passage was performed into.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_scene_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gesture: Option<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub bindings: BTreeMap<String, Binding>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub captions: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transition: Option<Transition>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_basis: Option<EventBasis>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operation: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub mode: ActMode,
    pub at_unix_ms: u64,
    /// How many later fills of the same text role this passage absorbed
    /// (progress text updates in place instead of growing the timeline).
    #[serde(default, skip_serializing_if = "is_zero")]
    pub coalesced: u32,
}

fn is_zero(value: &u32) -> bool {
    *value == 0
}

impl Passage {
    fn new(index: usize, kind: PassageKind, mode: ActMode) -> Self {
        Passage {
            index,
            kind,
            file_ref: None,
            expression_ref: None,
            revision: None,
            scene_ref: None,
            target_ref: None,
            target_scene_ref: None,
            state: None,
            role: None,
            gesture: None,
            bindings: BTreeMap::new(),
            captions: BTreeMap::new(),
            transition: None,
            event_basis: None,
            operation: None,
            native_ref: None,
            text: None,
            value: None,
            field: None,
            summary: None,
            mode,
            at_unix_ms: unix_ms(),
            coalesced: 0,
        }
    }
    /// A passage that sets the whole Scene (not object-local).
    fn sets_scene(&self) -> bool {
        self.scene_ref.is_some()
            && self.role.is_none()
            && matches!(self.kind, PassageKind::Scene | PassageKind::State | PassageKind::Return)
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Continuation {
    pub from: ActMode,
    pub to: ActMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instrument_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expression_ref: Option<String>,
    pub at: usize,
}

fn first_revision() -> u64 {
    1
}

/// The mode-spanning expressive act (ES4 act extended per contract §4).
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Act {
    pub act_ref: String,
    /// The live target Expression.
    pub expression_ref: String,
    pub summary: String,
    pub actor: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub activity_ref: Option<String>,
    pub phase: ActPhase,
    /// The Expression revision the act was (last) performed against.
    pub basis_revision: u64,
    /// The act record's own compare-and-set revision.
    #[serde(default = "first_revision")]
    pub revision: u64,
    #[serde(default)]
    pub mode: ActMode,
    #[serde(default)]
    pub cast: Vec<CastMember>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instrument_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub material: Option<ActMaterial>,
    #[serde(default)]
    pub bindings: BTreeMap<String, Binding>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selection: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<usize>,
    #[serde(default)]
    pub sequence: Vec<Passage>,
    #[serde(default)]
    pub continuations: Vec<Continuation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub return_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
    /// Role → the live-target entity presenting it (kernel-derived, stable
    /// across passages so a character keeps its occupant from Scene to Scene).
    #[serde(default)]
    pub role_entities: BTreeMap<String, String>,
    /// Unix ms of the act's last committed change (archive/load ordering).
    #[serde(default)]
    pub updated_at_unix_ms: u64,
    /// An archived act lives in the store's `archive/`, outside the live
    /// budget; it stays readable and replayable by ref.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub archived: bool,
}

fn unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

impl Act {
    fn new(act_ref: String, expression_ref: String, summary: String, actor: String, mode: ActMode) -> Self {
        Act {
            act_ref,
            expression_ref,
            summary,
            actor,
            activity_ref: None,
            phase: ActPhase::Running,
            basis_revision: 0,
            revision: 1,
            mode,
            cast: vec![],
            subject_ref: None,
            instrument_ref: None,
            material: None,
            bindings: BTreeMap::new(),
            selection: None,
            position: None,
            sequence: vec![],
            continuations: vec![],
            return_ref: None,
            result: None,
            role_entities: BTreeMap::new(),
            updated_at_unix_ms: 0,
            archived: false,
        }
    }
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
            native_owner: None,
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
    // ——— Mode-spanning act + reusable material (contract
    // EXPRESSION-ACT-MATERIAL-V1 §1, §4). ———
    /// Discover reusable material in the Central material register.
    MaterialList {
        #[serde(default)]
        kind: Option<expression::ReuseKind>,
        #[serde(default)]
        association: Option<crate::expression_material::AssociationQuery>,
        /// Another Central-relative register (default the material register).
        #[serde(default)]
        register: Option<String>,
    },
    /// Open or idempotently resume an act: mode, live target, cast, subject,
    /// instrument. A resume adds new cast members without duplicating.
    ActOpen {
        act_ref: String,
        expression_ref: String,
        mode: ActMode,
        actor: String,
        #[serde(default)]
        summary: Option<String>,
        #[serde(default)]
        cast: Vec<CastMember>,
        #[serde(default)]
        subject_ref: Option<String>,
        #[serde(default)]
        instrument_ref: Option<String>,
        #[serde(default)]
        selection: Option<String>,
        #[serde(default)]
        bindings: BTreeMap<String, Binding>,
        #[serde(default)]
        expected_act_revision: Option<u64>,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    /// Select saved material and perform it. With `material` naming a Scene
    /// (or an Expression-level state) it is a Scene change performed through
    /// `scene_material_set`; with `role` + `state` and no Scene it is an
    /// object-local state change of that role's entity. Appends a passage.
    ActSelect {
        act_ref: String,
        actor: String,
        #[serde(default)]
        material: Option<MaterialSelect>,
        #[serde(default)]
        role: Option<String>,
        #[serde(default)]
        state: Option<String>,
        #[serde(default)]
        kind: Option<PassageKind>,
        #[serde(default)]
        bindings: BTreeMap<String, Binding>,
        #[serde(default)]
        captions: BTreeMap<String, String>,
        #[serde(default)]
        transition: Option<Transition>,
        #[serde(default)]
        event_basis: Option<EventBasis>,
        #[serde(default)]
        summary: Option<String>,
        #[serde(default)]
        expected_revision: Option<u64>,
        #[serde(default)]
        expected_act_revision: Option<u64>,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    /// Object-local gesture on a role/entity while the Scene continues.
    ActGesture {
        act_ref: String,
        actor: String,
        gesture: String,
        #[serde(default)]
        role: Option<String>,
        #[serde(default)]
        entity_ref: Option<String>,
        #[serde(default)]
        material: Option<MaterialSelect>,
        #[serde(default)]
        transition: Option<Transition>,
        #[serde(default)]
        event_basis: Option<EventBasis>,
        #[serde(default)]
        expected_revision: Option<u64>,
        #[serde(default)]
        expected_act_revision: Option<u64>,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    /// Fill a text/value role (progress/result text) in the current Scene.
    ActText {
        act_ref: String,
        actor: String,
        role: String,
        #[serde(default)]
        text: Option<String>,
        #[serde(default)]
        value: Option<f64>,
        #[serde(default)]
        field: Option<String>,
        #[serde(default)]
        event_basis: Option<EventBasis>,
        #[serde(default)]
        expected_revision: Option<u64>,
        #[serde(default)]
        expected_act_revision: Option<u64>,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    /// Record a mode-specific operation with its native ref.
    ActOperate {
        act_ref: String,
        actor: String,
        operation_kind: String,
        native_ref: String,
        #[serde(default)]
        mode: Option<ActMode>,
        #[serde(default)]
        summary: Option<String>,
        #[serde(default)]
        event_basis: Option<EventBasis>,
        #[serde(default)]
        expected_act_revision: Option<u64>,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    /// Carry the act into another mode, keeping cast/subject/selection.
    ActContinue {
        act_ref: String,
        actor: String,
        to: ActMode,
        #[serde(default)]
        instrument_ref: Option<String>,
        #[serde(default)]
        expression_ref: Option<String>,
        #[serde(default)]
        summary: Option<String>,
        #[serde(default)]
        expected_act_revision: Option<u64>,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    /// Complete (or cancel) with the Return and result text.
    ActComplete {
        act_ref: String,
        actor: String,
        #[serde(default)]
        return_ref: Option<String>,
        #[serde(default)]
        result: Option<String>,
        #[serde(default)]
        result_role: Option<String>,
        #[serde(default)]
        cancelled: bool,
        #[serde(default)]
        expected_revision: Option<u64>,
        #[serde(default)]
        expected_act_revision: Option<u64>,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    /// Perform a saved Expression's playback (its `reuse.playback` order,
    /// else its Scene order) as successive Scene passages of the act, each
    /// with its authored transition, from Scene index `from`.
    ActPlay {
        act_ref: String,
        actor: String,
        material: MaterialSelect,
        #[serde(default)]
        bindings: BTreeMap<String, Binding>,
        #[serde(default)]
        captions: BTreeMap<String, String>,
        #[serde(default)]
        from: Option<usize>,
        #[serde(default)]
        expected_revision: Option<u64>,
        #[serde(default)]
        expected_act_revision: Option<u64>,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    /// Move an ended (completed/cancelled) act out of the live budget into
    /// the store's archive. Never deletes.
    ActArchive {
        act_ref: String,
        actor: String,
    },
    /// Re-perform the act's state at passage `position` (timeline position).
    /// Forward from the current position performs only the passages between;
    /// backward replays from the last Scene-setting passage. Drifted material
    /// (Scene or bound character) is refused unless `accept_drift`.
    ActSeek {
        act_ref: String,
        actor: String,
        position: usize,
        #[serde(default)]
        accept_drift: bool,
        #[serde(default)]
        expected_revision: Option<u64>,
        #[serde(default)]
        expected_act_revision: Option<u64>,
        #[serde(default)]
        activity_ref: Option<String>,
    },
    ActInspect {
        act_ref: String,
    },
    ActList {
        #[serde(default)]
        mode: Option<ActMode>,
        #[serde(default)]
        expression_ref: Option<String>,
        #[serde(default)]
        phase: Option<ActPhase>,
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
    /// Durable act store (`$OI_HOME/desktop/expression-acts`). Absent means
    /// acts live only in this kernel instance.
    store: Option<crate::expression_act_store::ActStore>,
    store_errors: Vec<String>,
}

impl WorldState {
    /// Attach the durable act store and load its acts. Unreadable records
    /// are disclosed (`act_list.store_errors`), never dropped silently.
    ///
    /// Deterministic: live (running/held) acts first, newest update first,
    /// then ended acts, up to the budget. Ended acts beyond it are archived
    /// (loaded lazily by ref later); live acts beyond it stay stored and are
    /// disclosed.
    pub fn attach_store(&mut self, store: crate::expression_act_store::ActStore) -> Result<(), String> {
        let (mut acts, mut errors) = store.load_all()?;
        acts.sort_by(|a, b| {
            a.phase
                .ended()
                .cmp(&b.phase.ended())
                .then(b.updated_at_unix_ms.cmp(&a.updated_at_unix_ms))
                .then(a.act_ref.cmp(&b.act_ref))
        });
        for mut act in acts {
            if self.acts.len() < MAX_ACTS && !act.archived {
                self.acts.insert(act.act_ref.clone(), act);
            } else if act.phase.ended() || act.archived {
                let previous = act.revision;
                act.archived = true;
                act.revision += 1;
                act.updated_at_unix_ms = unix_ms();
                let archived = store
                    .write(&act, Some(previous))
                    .and_then(|_| store.archive(&act.act_ref));
                if let Err(error) = archived {
                    errors.push(format!("Act {} could not be archived: {error}", act.act_ref));
                }
            } else {
                errors.push(format!(
                    "Live act {} exceeds the {MAX_ACTS}-act budget; it stays stored but unloaded",
                    act.act_ref
                ));
            }
        }
        self.store_errors = errors;
        self.store = Some(store);
        Ok(())
    }

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
            "whole_bind", "whole_inspect", "whole_rebase",
            "material_list", "act_open", "act_select", "act_gesture", "act_text",
            "act_operate", "act_continue", "act_complete", "act_seek", "act_play", "act_archive",
            "act_inspect", "act_list"
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
            "phases": ["running", "held", "completed", "cancelled"],
            "modes": ["factory", "expressions", "techne"],
            "passages": ["scene", "state", "gesture", "text", "operate", "continue", "return"],
            "families": {"select_bind": ["act_open", "material_list"], "perform_transition": ["act_select", "act_gesture", "act_text"],
                "operate": ["act_operate"], "compose_save": ["expression edit reuse_set", "expression save_as/save"],
                "continue_replay": ["act_continue", "act_complete", "act_seek", "act_play", "act_inspect", "act_list", "act_archive"]},
            "grafting": "the bound character's state Scene self entity supplies the material; the placeholder keeps id/position/rotation/role and applies its overrides last; text roles replace the text layer's text; unbound roles keep their authored material",
            "persistence": "acts persist in the kernel act store ($OI_HOME/desktop/expression-acts) with compare-and-set revisions",
            "seek": "forward from the current position performs only the passages between; backward replays from the Scene-setting passage at or before the position; drifted Scene or character material is refused unless accept_drift",
            "play": "act_play performs a saved Expression's playback order as Scene passages with their authored transitions",
            "archive": "running/held acts count against the live budget; ended acts are archived (never deleted) to make room, and stay readable by ref",
            "commit_order": "budgets, act revision and store writability are checked before the Expression is edited; a failed act save restores the pre-edit document",
            "material_register": crate::expression_material::MATERIAL_REGISTER,
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
            "passages": MAX_PASSAGES, "bindings": MAX_BINDINGS, "cast": MAX_CAST,
        },
        "activity_ref": "caller-supplied correlation, never authentication",
        "source_mutation": false,
        "unsupported": ["action_invocation", "semantic_edge_minting", "whole_graph_load", "silent_rebase"],
        "contract": "docs/contracts/EXPRESSION-APPLICATION-V1.md",
        "act_contract": "docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md"
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
                    if existing.phase == ActPhase::Running {
                        return Err("Act is already running; interrupt it first".into());
                    }
                    if existing.phase.ended() {
                        return Err("Act has ended; open a new act".into());
                    }
                } else {
                    self.act_make_room()?;
                }
                let precheck = {
                    let probe = self.world.acts.get(&act_ref).cloned().unwrap_or_else(|| {
                        Act::new(act_ref.clone(), expression_ref.clone(), summary.clone(), actor.clone(), ActMode::Expressions)
                    });
                    let existing = self.world.acts.contains_key(&act_ref);
                    self.act_precheck(&probe, 0, false, existing)?
                };
                if let Some(refusal) = precheck {
                    return Ok(KernelOpOutcome { receipts, result: KernelOpResult::ExpressionWorld { data: refusal } });
                }
                let snapshot = self.act_snapshot(&expression_ref).ok();
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
                if let Some(change) = changed {
                    receipts.push(self.log.record(KernelEvent::ExpressionChanged {
                        expression_ref: change.expression_ref,
                        revision: change.revision,
                        actor: change.actor,
                        activity_ref: change.activity_ref,
                    }));
                }
                let previous = self.world.acts.get(&act_ref).cloned();
                let previous_revision = previous.as_ref().map(|a| a.revision);
                let mut act = previous.unwrap_or_else(|| {
                    Act::new(act_ref.clone(), expression_ref.clone(), summary.clone(), actor.clone(), ActMode::Expressions)
                });
                act.summary = summary;
                act.actor = actor;
                act.activity_ref = activity_ref;
                act.phase = ActPhase::Running;
                act.basis_revision = expected_revision;
                let committed = self.act_commit(act, previous_revision);
                if !matches!(committed, Ok(Ok(_))) {
                    if let Some(snapshot) = snapshot {
                        self.act_rollback(snapshot, &mut receipts)?;
                    }
                }
                if let Err(conflict) = committed? {
                    return Ok(KernelOpOutcome { receipts, result: KernelOpResult::ExpressionWorld { data: conflict } });
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
                    .get(&act_ref)
                    .cloned()
                    .ok_or("no act with this ref exists")?;
                if act.phase.ended() {
                    return Err("Act has ended; nothing to hold".into());
                }
                if act.phase == ActPhase::Running {
                    let previous = act.revision;
                    let mut held = act;
                    held.phase = ActPhase::Held;
                    match self.act_commit(held, Some(previous))? {
                        Ok(act) => json!({"state":"act_held","act":act,"detail":"The act is held; nothing reverted and nothing advanced"}),
                        Err(conflict) => conflict,
                    }
                } else {
                    json!({"state":"act_held","act":act,"detail":"The act was already held"})
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
                        document: Box::new(checkpoint.document.clone()),
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
            Request::MaterialList { kind, association, register } => {
                let register = register.unwrap_or_else(|| crate::expression_material::MATERIAL_REGISTER.into());
                text(&register)?;
                if register.starts_with('/') || register.split('/').any(|p| p.is_empty() || p == "..") {
                    return Err("The material register is a Central-relative path without traversal".into());
                }
                crate::expression_material::list(&self.client, &register, kind, association.as_ref())
            }
            request @ (Request::ActOpen { .. }
            | Request::ActSelect { .. }
            | Request::ActGesture { .. }
            | Request::ActText { .. }
            | Request::ActOperate { .. }
            | Request::ActContinue { .. }
            | Request::ActComplete { .. }
            | Request::ActSeek { .. }
            | Request::ActPlay { .. }
            | Request::ActArchive { .. }
            | Request::ActInspect { .. }
            | Request::ActList { .. }) => {
                // Any failure after an act edited its live target restores
                // the target's pre-edit document: act and Expression agree.
                let target = act_ref_of(&request)
                    .and_then(|r| self.world.acts.get(r).map(|a| a.expression_ref.clone()));
                let snapshot = target.and_then(|t| self.act_snapshot(&t).ok());
                match self.world_act(request, &mut receipts) {
                    Ok(data) => data,
                    Err(error) => {
                        if let Some(snapshot) = snapshot {
                            self.act_rollback(snapshot, &mut receipts)?;
                        }
                        return Err(error);
                    }
                }
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
        // Preserve an exact current occurrence. A subject-only handoff must
        // not silently select the first glyph or first scene with that subject.
        let mut occurrences = Vec::new();
        for scene in &document.scenes {
            for entity_ref in &scene.entity_refs {
                if document.entities.get(entity_ref).and_then(|e| e.subject.as_ref())
                    .is_some_and(|b| b.subject_ref == subject_ref) {
                    occurrences.push((entity_ref.clone(), scene.scene_ref.clone()));
                }
            }
        }
        let selected = document.selection.entity_ref.as_ref().and_then(|r| {
            occurrences.iter().find(|(entity, scene)| entity == r && scene == &document.selection.scene_ref).cloned()
        });
        let in_scene: Vec<_> = occurrences.iter().filter(|(_, scene)| scene == &document.selection.scene_ref).cloned().collect();
        let target = selected.or_else(|| {
            if in_scene.len() == 1 { in_scene.first().cloned() }
            else if occurrences.len() == 1 { occurrences.first().cloned() }
            else { None }
        });
        if target.is_none() && occurrences.len() > 1 {
            return Ok(json!({"state":"ambiguous_occurrence", "expression_ref":expression_ref,
                "subject_ref":subject_ref, "occurrences":occurrences.iter().map(|(entity,scene)|
                    json!({"entity_ref":entity,"scene_ref":scene})).collect::<Vec<_>>(),
                "detail":"Select an exact scene occurrence; native subject identity is not occurrence identity"}));
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

// ---------------------------------------------------------------------------
// Mode-spanning acts (contract EXPRESSION-ACT-MATERIAL-V1 §3–§4)
// ---------------------------------------------------------------------------

type Receipts = Vec<crate::events::KernelEventReceipt>;
type Fills = BTreeMap<String, crate::expression_material::RoleFill>;

/// Outcome of one performance edit: the new Expression revision, or the
/// owner's structured refusal (returned to the caller as data).
enum Performed {
    Done { revision: u64, scene_ref: String },
    Refused(Value),
}

/// The live target's document before an act edits it: restored when the
/// act's own save fails after the edit, so the two never disagree.
struct Snapshot {
    target: String,
    document: expression::Document,
}

fn act_conflict(act: &Act, expected: u64) -> Value {
    json!({
        "state":"act_revision_conflict",
        "act_ref":act.act_ref,
        "expected_act_revision":expected,
        "current_act_revision":act.revision,
        "detail":"Another writer advanced this act; re-read it with act_inspect",
    })
}

fn drift(what: &str, reference: &Option<String>, expected: &str, current: &str) -> Value {
    json!({
        "state":"material_revision_changed",
        "material":what, "ref":reference,
        "expected_revision":expected, "current_revision":current,
        "detail":"The material changed since it was performed; pass accept_drift to perform its current revision",
    })
}

fn act_ref_of(request: &Request) -> Option<&str> {
    match request {
        Request::ActSelect { act_ref, .. }
        | Request::ActPlay { act_ref, .. }
        | Request::ActGesture { act_ref, .. }
        | Request::ActText { act_ref, .. }
        | Request::ActComplete { act_ref, .. }
        | Request::ActSeek { act_ref, .. } => Some(act_ref),
        _ => None,
    }
}

fn act_summary(act: &Act) -> Value {
    json!({
        "act_ref":act.act_ref, "expression_ref":act.expression_ref, "summary":act.summary,
        "actor":act.actor, "phase":act.phase, "mode":act.mode, "revision":act.revision,
        "basis_revision":act.basis_revision, "cast":act.cast, "subject_ref":act.subject_ref,
        "instrument_ref":act.instrument_ref, "material":act.material, "position":act.position,
        "passages":act.sequence.len(), "return_ref":act.return_ref,
        "updated_at_unix_ms":act.updated_at_unix_ms, "archived":act.archived,
    })
}

/// The duration a Scene's authored material gives its entry transition.
fn scene_transition(scene: &Value) -> Option<Transition> {
    scene["transition"].as_f64().map(|duration| Transition { duration: Some(duration), easing: None })
}

impl Kernel {
    /// Attach the durable act store under an explicit O:I home. The desktop
    /// host attaches `$OI_HOME` with [`Kernel::attach_default_act_store`];
    /// tests attach a temp home; otherwise acts stay in memory.
    pub fn attach_act_store(&mut self, home: &std::path::Path) -> Result<(), String> {
        self.world
            .attach_store(crate::expression_act_store::ActStore::at_home(home))
    }

    /// Attach the durable act store at the process's O:I home
    /// (`$OI_HOME`, else `~/.oi`). The desktop host calls this once at
    /// startup so acts survive restart; embedded/test kernels stay in memory
    /// unless they attach a store explicitly.
    pub fn attach_default_act_store(&mut self) -> Result<(), String> {
        let store = crate::expression_act_store::ActStore::discover()
            .ok_or("No O:I home (OI_HOME or HOME) for the act store")?;
        self.world.attach_store(store)
    }

    /// Everything a commit needs, checked BEFORE the Expression is edited:
    /// passage budget (a Return may exceed it by one), the act's stored
    /// revision and the store's writability.
    fn act_precheck(&mut self, act: &Act, add: usize, returning: bool, stored: bool) -> Result<Option<Value>, String> {
        let limit = MAX_PASSAGES + usize::from(returning);
        if act.sequence.len() + add > limit {
            return Ok(Some(json!({
                "state":"act_passage_limit","act_ref":act.act_ref,
                "passages":act.sequence.len(),"limit":MAX_PASSAGES,
                "detail":"This act holds its maximum passages; continue in a successor act: act_open a new act_ref (summary naming this act) with the same cast, then perform there. act_complete may still add the Return.",
            })));
        }
        if let Some(store) = &self.world.store {
            use crate::expression_act_store::Written;
            let expected = stored.then_some(act.revision);
            if let Written::Conflict { current } = store.check(&act.act_ref, expected)? {
                // Adopt the stored act so a re-read sees the other writer's work.
                if let Ok(Some(stored)) = store.read(&act.act_ref) {
                    if !stored.archived {
                        self.world.acts.insert(stored.act_ref.clone(), stored);
                    }
                }
                return Ok(Some(json!({
                    "state":"act_revision_conflict","act_ref":act.act_ref,
                    "expected_act_revision":expected,"current_act_revision":current,
                    "detail":"The stored act moved under this kernel; re-read it with act_inspect",
                })));
            }
        }
        Ok(None)
    }

    fn act_snapshot(&mut self, target: &str) -> Result<Snapshot, String> {
        Ok(Snapshot { target: target.to_owned(), document: self.world_document(target)? })
    }

    /// Return the live target to its pre-edit document (an explicit restore:
    /// the revision advances).
    fn act_rollback(&mut self, snapshot: Snapshot, receipts: &mut Receipts) -> Result<(), String> {
        let current = self.world_document(&snapshot.target)?;
        let mut unchanged = snapshot.document.clone();
        unchanged.revision = current.revision;
        if unchanged == current {
            return Ok(());
        }
        let (_, changed) = self.expressions.apply(
            &self.client,
            expression::Request::Restore {
                expression_ref: snapshot.target,
                expected_revision: current.revision,
                document: Box::new(snapshot.document),
                actor: "kernel:act-rollback".into(),
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
        Ok(())
    }

    /// Commit an act mutation: bump its CAS revision and persist it. A store
    /// conflict reloads the stored act and returns the structured refusal.
    /// An archived act is written back to the archive, not held in memory.
    fn act_commit(&mut self, mut act: Act, previous: Option<u64>) -> Result<Result<Act, Value>, String> {
        act.revision = previous.map_or(1, |r| r + 1);
        act.updated_at_unix_ms = unix_ms().max(act.updated_at_unix_ms);
        if act.sequence.len() > MAX_PASSAGES + 1 {
            return Err("Act passage budget exceeded".into());
        }
        if let Some(store) = &self.world.store {
            use crate::expression_act_store::Written;
            if let Written::Conflict { current } = store.write(&act, previous)? {
                if let Ok(Some(stored)) = store.read(&act.act_ref) {
                    if !stored.archived {
                        self.world.acts.insert(stored.act_ref.clone(), stored);
                    }
                }
                return Ok(Err(json!({
                    "state":"act_revision_conflict","act_ref":act.act_ref,
                    "expected_act_revision":previous,"current_act_revision":current,
                    "detail":"The stored act moved under this kernel; re-read it with act_inspect",
                })));
            }
        }
        if act.archived {
            self.world.acts.remove(&act.act_ref);
        } else {
            self.world.acts.insert(act.act_ref.clone(), act.clone());
        }
        Ok(Ok(act))
    }

    /// Commit after edits; on any failure restore the pre-edit document.
    fn act_finish(&mut self, act: Act, previous: u64, extra: Value, snapshot: Option<Snapshot>, receipts: &mut Receipts) -> Result<Value, String> {
        let committed = self.act_commit(act, Some(previous));
        if !matches!(committed, Ok(Ok(_))) {
            if let Some(snapshot) = snapshot {
                self.act_rollback(snapshot, receipts)?;
            }
        }
        Ok(match committed? {
            Ok(act) => {
                let mut value = json!({"act": act});
                if let (Some(map), Some(extra)) = (value.as_object_mut(), extra.as_object()) {
                    for (k, v) in extra {
                        map.insert(k.clone(), v.clone());
                    }
                }
                value
            }
            Err(conflict) => conflict,
        })
    }

    /// Archive an ended act: its record moves to the store's archive and it
    /// leaves memory. Without a store it only leaves memory.
    fn act_archive_one(&mut self, act: Act) -> Result<Result<Act, Value>, String> {
        if !act.phase.ended() {
            return Err("Only a completed or cancelled act can be archived".into());
        }
        let previous = act.revision;
        let mut archived = act;
        archived.archived = true;
        let committed = self.act_commit(archived, Some(previous))?;
        if let (Ok(act), Some(store)) = (&committed, &self.world.store) {
            store.archive(&act.act_ref)?;
        }
        Ok(committed)
    }

    /// Room for one more act in memory: archive the oldest ended act when
    /// the budget is full; running/held acts are never evicted.
    fn act_make_room(&mut self) -> Result<(), String> {
        if self.world.acts.len() < MAX_ACTS {
            return Ok(());
        }
        let oldest = self
            .world
            .acts
            .values()
            .filter(|a| a.phase.ended())
            .min_by(|a, b| a.updated_at_unix_ms.cmp(&b.updated_at_unix_ms).then(a.act_ref.cmp(&b.act_ref)))
            .cloned()
            .ok_or(format!("Live act budget exceeded ({MAX_ACTS} running/held acts)"))?;
        match self.act_archive_one(oldest)? {
            Ok(_) => Ok(()),
            Err(conflict) => Err(format!("Could not archive an ended act to make room: {conflict}")),
        }
    }

    /// An act by ref: memory, else lazily from the store (live register or
    /// archive). Archived acts are returned without entering memory.
    fn act_lookup(&mut self, act_ref: &str) -> Result<Option<Act>, String> {
        if let Some(act) = self.world.acts.get(act_ref) {
            return Ok(Some(act.clone()));
        }
        let Some(stored) = self.world.store.as_ref().map(|s| s.read(act_ref)).transpose()?.flatten() else {
            return Ok(None);
        };
        if !stored.archived {
            self.act_make_room()?;
            self.world.acts.insert(stored.act_ref.clone(), stored.clone());
        }
        Ok(Some(stored))
    }

    fn world_document(&mut self, expression_ref: &str) -> Result<expression::Document, String> {
        let (inspected, _) = self.expressions.apply(
            &self.client,
            expression::Request::Inspect { expression_ref: expression_ref.to_owned() },
        )?;
        serde_json::from_value(inspected["document"].clone())
            .map_err(|e| format!("Expression document unreadable: {e}"))
    }

    /// Load material: an open Expression (`expression:` ref) or a Central
    /// material file.
    fn world_material(&mut self, file_ref: Option<&str>, expression_ref: Option<&str>) -> Result<crate::expression_material::Loaded, String> {
        let open = expression_ref.or(file_ref.filter(|r| r.starts_with("expression:")));
        if let Some(r) = open {
            let document = self.world_document(r)?;
            return Ok(crate::expression_material::Loaded {
                revision: document.revision.to_string(),
                document,
                file_ref: None,
            });
        }
        let file_ref = file_ref.ok_or("Material requires file_ref or expression_ref")?;
        crate::expression_material::read_file(&self.client, file_ref)
    }

    /// A bound character's body in a state (its `self` entity material) and
    /// the exact revision it was read at.
    fn world_character_body(&mut self, character_ref: &str, state: Option<&str>) -> Result<(Value, String), String> {
        let loaded = self.world_material(Some(character_ref), None)?;
        let state = state.or(loaded.reuse().and_then(|r| r.preview_state.as_deref()));
        let scene = crate::expression_material::resolve_scene(&loaded.document, None, state)?;
        let body = crate::expression_material::body_material(&loaded.document, &scene, "self")?;
        Ok((body, loaded.revision))
    }

    /// Role fills for a performance: bound characters (in their state),
    /// labels, glyphs and texts; captions fill text roles. Each bound
    /// character's revision is recorded into `bindings`; a pinned revision
    /// that drifted is refused (unless `accept_drift`).
    fn world_fills(&mut self, bindings: &mut BTreeMap<String, Binding>, captions: &BTreeMap<String, String>, accept_drift: bool) -> Result<Result<Fills, Value>, String> {
        use crate::expression_material::RoleFill;
        let mut fills = BTreeMap::new();
        for (role, binding) in bindings.iter_mut() {
            let material = match binding.character_ref.clone() {
                Some(character) => {
                    let (body, revision) = self.world_character_body(&character, binding.state.as_deref())?;
                    if let Some(pinned) = &binding.character_revision {
                        if pinned != &revision && !accept_drift {
                            return Ok(Err(drift("character", &binding.character_ref, pinned, &revision)));
                        }
                    }
                    binding.character_revision = Some(revision);
                    Some(body)
                }
                None => None,
            };
            let text = binding.text.clone().or_else(|| binding.value.map(|v| v.to_string()));
            fills.insert(role.clone(), RoleFill { material, label: binding.label.clone(), glyph: binding.glyph.clone(), text, field: None });
        }
        for (role, caption) in captions {
            expression::role_name(role)?;
            text(caption)?;
            fills.entry(role.clone()).or_insert_with(RoleFill::default).text = Some(caption.clone());
        }
        Ok(Ok(fills))
    }

    /// One ordinary Expression edit on behalf of an act (exact expected
    /// revision when the caller names one; else the kernel's current one —
    /// one kernel mutex, no concurrent editor).
    fn world_edit(&mut self, expression_ref: &str, expected: Option<u64>, actor: &str, changes: Vec<Change>, receipts: &mut Receipts) -> Result<Result<u64, Value>, String> {
        let expected = match expected {
            Some(r) => r,
            None => self.world_document(expression_ref)?.revision,
        };
        let (data, changed) = self.expressions.apply(
            &self.client,
            expression::Request::Edit { expression_ref: expression_ref.to_owned(), expected_revision: expected, actor: actor.to_owned(), changes },
        )?;
        if data["state"] == "revision_conflict" {
            return Ok(Err(data));
        }
        if let Some(change) = changed {
            receipts.push(self.log.record(KernelEvent::ExpressionChanged {
                expression_ref: change.expression_ref,
                revision: change.revision,
                actor: change.actor,
                activity_ref: change.activity_ref,
            }));
        }
        Ok(Ok(data["document"]["revision"].as_u64().unwrap_or(expected)))
    }

    /// Perform one material Scene into a live target Scene: graft role fills,
    /// map material entities onto target entities (role occupants are stable
    /// per act; unroled material entities replace the previous performance's
    /// ones), add missing entities, compose and `scene_material_set`.
    #[allow(clippy::too_many_arguments)]
    fn world_perform_scene(
        &mut self,
        act: &mut Act,
        material: &crate::expression_material::Loaded,
        material_scene: &str,
        target_ref: &str,
        target_scene: Option<&str>,
        fills: &Fills,
        bindings: &BTreeMap<String, Binding>,
        expected_revision: Option<u64>,
        actor: &str,
        receipts: &mut Receipts,
    ) -> Result<Performed, String> {
        use crate::expression_material as m;
        let target = self.world_document(target_ref)?;
        if let Some(expected) = expected_revision {
            if expected != target.revision {
                return Ok(Performed::Refused(json!({"state":"revision_conflict","expression_ref":target_ref,"expected_revision":expected,"current_revision":target.revision})));
            }
        }
        let scene_ref = target_scene.map(str::to_owned).unwrap_or_else(|| target.selection.scene_ref.clone());
        let scene = target.scenes.iter().find(|s| s.scene_ref == scene_ref).ok_or("The target Scene is absent")?;
        let mut authored = m::scene_material(&material.document, material_scene)?;
        m::graft(&mut authored, fills);
        let mut map: BTreeMap<String, String> = BTreeMap::new();
        let mut adds: Vec<(String, String)> = Vec::new();
        for entity in authored["entities"].as_array().cloned().unwrap_or_default() {
            let Some(id) = entity["id"].as_str() else { continue };
            let target_entity = match entity["role"].as_str() {
                Some(role) => bindings
                    .get(role)
                    .and_then(|b| b.entity_ref.clone())
                    .or_else(|| act.role_entities.get(role).cloned())
                    .unwrap_or_else(|| format!("{target_ref}:entity:role.{role}")),
                None => format!("{target_ref}:entity:{}", m::local_suffix(&material.document.expression_ref, id)),
            };
            expression::id(&target_entity, &format!("{target_ref}:entity:"))?;
            if let Some(role) = entity["role"].as_str() {
                act.role_entities.insert(role.to_owned(), target_entity.clone());
            }
            if !target.entities.contains_key(&target_entity) && !adds.iter().any(|(r, _)| r == &target_entity) {
                let title = entity["name"].as_str().or(entity["role"].as_str()).unwrap_or("Material").to_owned();
                adds.push((target_entity.clone(), title));
            }
            map.insert(id.to_owned(), target_entity);
        }
        let material_scene_owned = material_scene.to_owned();
        let scene_ref_owned = scene_ref.clone();
        crate::expression_scene::remap_refs(&mut authored, &|r: &str| {
            if r == material_scene_owned { Some(scene_ref_owned.clone()) } else { map.get(r).cloned() }
        });
        authored["id"] = json!(scene_ref);
        authored["name"] = json!(scene.title);
        // The target's blueprint binding changes only through its own ops.
        let blueprint = scene.presentation.as_ref().and_then(|p| p.scene["composition"].get("blueprint").cloned());
        if let Some(composition) = authored.get_mut("composition").and_then(Value::as_object_mut) {
            match blueprint {
                Some(b) => { composition.insert("blueprint".into(), b); }
                None => { composition.remove("blueprint"); }
            }
        }
        // A state change replaces the previous performance's unroled material
        // (`m.*` occupants) rather than accumulating it.
        let material_prefix = format!("{target_ref}:entity:m.");
        let performed: BTreeSet<&String> = map.values().collect();
        let stale: Vec<String> = scene
            .entity_refs
            .iter()
            .filter(|r| r.starts_with(&material_prefix) && !performed.contains(r))
            .cloned()
            .collect();
        let mut changes: Vec<Change> = Vec::new();
        for entity_ref in &stale {
            let elsewhere = target.scenes.iter().any(|s| s.scene_ref != scene_ref && s.entity_refs.contains(entity_ref));
            if !elsewhere {
                changes.push(Change::EntityRemove { entity_ref: entity_ref.clone() });
            }
        }
        let mut members: Vec<String> = scene.entity_refs.iter().filter(|r| !stale.contains(r)).cloned().collect();
        for r in map.values() {
            if !members.contains(r) {
                members.push(r.clone());
            }
        }
        changes.extend(adds.into_iter().map(|(entity_ref, title)| Change::EntityAdd { scene_ref: scene_ref.clone(), entity_ref, title }));
        changes.push(Change::SceneCompose { scene_ref: scene_ref.clone(), entity_refs: members });
        changes.push(Change::SceneMaterialSet {
            scene_ref: scene_ref.clone(),
            presentation: crate::expression_scene::Presentation { schema: crate::expression_scene::SCHEMA.into(), scene: authored, saved: None },
        });
        if target.selection.scene_ref != scene_ref {
            changes.push(Change::Focus { scene_ref: scene_ref.clone(), entity_ref: None });
        }
        match self.world_edit(target_ref, Some(target.revision), actor, changes, receipts)? {
            Ok(revision) => Ok(Performed::Done { revision, scene_ref }),
            Err(conflict) => Ok(Performed::Refused(conflict)),
        }
    }

    /// Object-local change of one occupant in the current Scene: graft a body
    /// (a character state's `self`, or a gesture Scene's role entity) onto the
    /// entity presenting `role` while the Scene continues.
    #[allow(clippy::too_many_arguments)]
    fn world_perform_local(
        &mut self,
        target_ref: &str,
        target_scene: Option<&str>,
        entity_ref: &str,
        body: Value,
        expected_revision: Option<u64>,
        actor: &str,
        receipts: &mut Receipts,
    ) -> Result<Performed, String> {
        let target = self.world_document(target_ref)?;
        if let Some(expected) = expected_revision {
            if expected != target.revision {
                return Ok(Performed::Refused(json!({"state":"revision_conflict","expression_ref":target_ref,"expected_revision":expected,"current_revision":target.revision})));
            }
        }
        let scene_ref = target_scene.map(str::to_owned).unwrap_or_else(|| target.selection.scene_ref.clone());
        let scene = target.scenes.iter().find(|s| s.scene_ref == scene_ref).ok_or("The target Scene is absent")?;
        let mut presentation = scene.presentation.clone().ok_or("The current Scene carries no authored material to perform on")?;
        let entities = presentation.scene["entities"].as_array_mut().ok_or("Scene entities are absent")?;
        let occupant = entities
            .iter_mut()
            .find(|e| e["id"].as_str() == Some(entity_ref))
            .ok_or("The role's entity is not presented in the current Scene")?;
        let name = occupant.get("name").cloned();
        let mut grafted = crate::expression_material::graft_entity(occupant, &crate::expression_material::RoleFill { material: Some(body), ..Default::default() });
        if let Some(name) = name {
            grafted["name"] = name;
        }
        *occupant = grafted;
        let changes = vec![Change::SceneMaterialSet { scene_ref: scene_ref.clone(), presentation }];
        match self.world_edit(target_ref, Some(target.revision), actor, changes, receipts)? {
            Ok(revision) => Ok(Performed::Done { revision, scene_ref }),
            Err(conflict) => Ok(Performed::Refused(conflict)),
        }
    }

    /// Fill one text role in the current Scene. `None` when no layer carries it.
    #[allow(clippy::too_many_arguments)]
    fn world_perform_text(&mut self, target_ref: &str, target_scene: Option<&str>, role: &str, field: &str, value: &str, expected_revision: Option<u64>, actor: &str, receipts: &mut Receipts) -> Result<Option<Performed>, String> {
        let target = self.world_document(target_ref)?;
        if let Some(expected) = expected_revision {
            if expected != target.revision {
                return Ok(Some(Performed::Refused(json!({"state":"revision_conflict","expression_ref":target_ref,"expected_revision":expected,"current_revision":target.revision}))));
            }
        }
        let scene_ref = target_scene.map(str::to_owned).unwrap_or_else(|| target.selection.scene_ref.clone());
        let Some(mut presentation) = target.scenes.iter().find(|s| s.scene_ref == scene_ref).and_then(|s| s.presentation.clone()) else {
            return Ok(None);
        };
        if !crate::expression_material::fill_text(&mut presentation.scene, role, field, value) {
            return Ok(None);
        }
        let changes = vec![Change::SceneMaterialSet { scene_ref: scene_ref.clone(), presentation }];
        match self.world_edit(target_ref, Some(target.revision), actor, changes, receipts)? {
            Ok(revision) => Ok(Some(Performed::Done { revision, scene_ref })),
            Err(conflict) => Ok(Some(Performed::Refused(conflict))),
        }
    }

    /// The material a gesture performs: explicit material, or the role's
    /// bound character.
    fn world_gesture_material(&mut self, act: &Act, role: Option<&str>, material: Option<&MaterialSelect>) -> Result<crate::expression_material::Loaded, String> {
        match material {
            Some(select) => self.world_material(select.file_ref.as_deref(), select.expression_ref.as_deref()),
            None => {
                let role = role.ok_or("A gesture names material or a bound role")?;
                let character = act
                    .bindings
                    .get(role)
                    .and_then(|b| b.character_ref.clone())
                    .or_else(|| act.cast.iter().find(|c| c.role == role).and_then(|c| c.character_ref.clone()))
                    .ok_or("The role has no bound character to gesture with")?;
                self.world_material(Some(&character), None)
            }
        }
    }

    /// The gesture Scene and the role whose body it moves.
    fn gesture_scene(loaded: &crate::expression_material::Loaded, gesture: &str, scene_ref: Option<&str>) -> Result<(String, String), String> {
        let reuse = loaded.reuse().ok_or("Gesture material carries no reuse index")?;
        match reuse.gestures.get(gesture) {
            Some(g) => Ok((g.scene_ref.clone(), g.role.clone().unwrap_or_else(|| "self".into()))),
            None if reuse.kind == expression::ReuseKind::Gesture => Ok((
                crate::expression_material::resolve_scene(&loaded.document, scene_ref, None)?,
                "self".into(),
            )),
            None => Err(format!("Material has no gesture {gesture:?}")),
        }
    }

    /// Drift of one recorded passage's material (Scene/state/gesture file
    /// and every bound character) against its current revisions.
    fn passage_drift(&mut self, passage: &Passage) -> Result<Option<Value>, String> {
        if passage.file_ref.is_some() || passage.expression_ref.is_some() {
            let current = self.world_material(passage.file_ref.as_deref(), passage.expression_ref.as_deref())?;
            if let Some(expected) = &passage.revision {
                if expected != &current.revision {
                    let reference = passage.file_ref.clone().or(passage.expression_ref.clone());
                    let mut value = drift("scene", &reference, expected, &current.revision);
                    value["position"] = json!(passage.index);
                    return Ok(Some(value));
                }
            }
        }
        for binding in passage.bindings.values() {
            if let (Some(character), Some(expected)) = (&binding.character_ref, &binding.character_revision) {
                let current = self.world_material(Some(character), None)?;
                if expected != &current.revision {
                    let mut value = drift("character", &binding.character_ref, expected, &current.revision);
                    value["position"] = json!(passage.index);
                    return Ok(Some(value));
                }
            }
        }
        Ok(None)
    }

    /// Re-perform one recorded passage into its recorded target.
    fn replay_passage(&mut self, act: &mut Act, passage: &Passage, expected: Option<u64>, actor: &str, receipts: &mut Receipts) -> Result<Option<Performed>, String> {
        let target_ref = passage.target_ref.clone().unwrap_or_else(|| act.expression_ref.clone());
        let target_scene = passage.target_scene_ref.as_deref();
        if passage.sets_scene() {
            let material = self.world_material(passage.file_ref.as_deref(), passage.expression_ref.as_deref())?;
            let scene = passage.scene_ref.clone().ok_or("Scene passage names no Scene")?;
            let mut bindings = passage.bindings.clone();
            let fills = match self.world_fills(&mut bindings, &passage.captions, true)? {
                Ok(fills) => fills,
                Err(refusal) => return Ok(Some(Performed::Refused(refusal))),
            };
            return Ok(Some(self.world_perform_scene(act, &material, &scene, &target_ref, target_scene, &fills, &bindings, expected, actor, receipts)?));
        }
        let local = passage.kind == PassageKind::Gesture || (passage.kind == PassageKind::State && passage.role.is_some());
        if local {
            let material = self.world_material(passage.file_ref.as_deref(), passage.expression_ref.as_deref())?;
            let scene = passage.scene_ref.clone().ok_or("Passage names no Scene")?;
            let body_role = match (&passage.gesture, material.reuse()) {
                (Some(g), Some(r)) => r.gestures.get(g).and_then(|g| g.role.clone()).unwrap_or_else(|| "self".into()),
                _ => "self".into(),
            };
            let body = crate::expression_material::body_material(&material.document, &scene, &body_role)?;
            let occupant = passage
                .native_ref
                .clone()
                .filter(|_| passage.kind == PassageKind::Gesture)
                .or_else(|| passage.role.as_ref().and_then(|r| act.role_entities.get(r).cloned()))
                .ok_or("The passage's occupant is unknown")?;
            return Ok(Some(self.world_perform_local(&target_ref, target_scene, &occupant, body, expected, actor, receipts)?));
        }
        if let (Some(role), Some(field)) = (&passage.role, &passage.field) {
            let shown = passage.text.clone().or_else(|| passage.value.map(|v| v.to_string())).unwrap_or_default();
            return self.world_perform_text(&target_ref, target_scene, role, field, &shown, expected, actor, receipts);
        }
        Ok(None)
    }

    fn world_act(&mut self, request: Request, receipts: &mut Receipts) -> Result<Value, String> {
        macro_rules! guard {
            ($act_ref:expr, $expected:expr) => {{
                text(&$act_ref)?;
                let act = self.act_lookup(&$act_ref)?.ok_or("no act with this ref exists")?;
                if let Some(expected) = $expected {
                    if expected != act.revision {
                        return Ok(act_conflict(&act, expected));
                    }
                }
                act
            }};
        }
        macro_rules! live {
            ($act:expr) => {
                if $act.phase.ended() {
                    return Err("Act has ended; open a new act".into());
                }
            };
        }
        macro_rules! precheck {
            ($act:expr, $add:expr, $returning:expr) => {
                if let Some(refusal) = self.act_precheck(&$act, $add, $returning, true)? {
                    return Ok(refusal);
                }
            };
        }
        macro_rules! performed {
            ($outcome:expr, $snapshot:expr) => {
                match $outcome {
                    Performed::Done { revision, scene_ref } => (revision, scene_ref),
                    Performed::Refused(v) => {
                        self.act_rollback($snapshot, receipts)?;
                        return Ok(v);
                    }
                }
            };
        }
        match request {
            Request::ActOpen { act_ref, expression_ref, mode, actor, summary, cast, subject_ref, instrument_ref, selection, bindings, expected_act_revision, activity_ref } => {
                text(&act_ref)?;
                text(&expression_ref)?;
                text(&actor)?;
                optional_text(&summary)?;
                optional_text(&subject_ref)?;
                optional_text(&instrument_ref)?;
                optional_text(&selection)?;
                optional_text(&activity_ref)?;
                bindings_valid(&bindings)?;
                for member in &cast {
                    expression::role_name(&member.role)?;
                    text(&member.participant_ref)?;
                    optional_text(&member.profile_ref)?;
                    optional_text(&member.character_ref)?;
                    optional_text(&member.label)?;
                }
                if self.act_lookup(&act_ref)?.is_none() {
                    // An act addresses a live target: the Expression is open.
                    let document = self.world_document(&expression_ref)?;
                    let mut act = Act::new(act_ref, expression_ref, summary.unwrap_or_else(|| "Expressive act".into()), actor, mode);
                    act.activity_ref = activity_ref;
                    act.basis_revision = document.revision;
                    act.subject_ref = subject_ref;
                    act.instrument_ref = instrument_ref;
                    act.selection = selection;
                    act.bindings = bindings;
                    for member in cast {
                        if !act.cast.contains(&member) { act.cast.push(member); }
                    }
                    if act.cast.len() > MAX_CAST { return Err("Cast budget exceeded".into()); }
                    self.act_make_room()?;
                    if let Some(refusal) = self.act_precheck(&act, 0, false, false)? {
                        return Ok(refusal);
                    }
                    return Ok(match self.act_commit(act, None)? {
                        Ok(act) => json!({"state":"act_opened","act":act,"resumed":false}),
                        Err(conflict) => conflict,
                    });
                }
                let act = guard!(act_ref, expected_act_revision);
                live!(act);
                if act.expression_ref != expression_ref {
                    return Err("Act ref already names another Expression; carry it with act_continue".into());
                }
                let previous = act.revision;
                let mut next = act.clone();
                for member in cast {
                    if !next.cast.iter().any(|c| c.role == member.role && c.participant_ref == member.participant_ref) {
                        next.cast.push(member);
                    }
                }
                if next.cast.len() > MAX_CAST { return Err("Cast budget exceeded".into()); }
                if subject_ref.is_some() { next.subject_ref = subject_ref; }
                if instrument_ref.is_some() { next.instrument_ref = instrument_ref; }
                if selection.is_some() { next.selection = selection; }
                if let Some(summary) = summary { next.summary = summary; }
                for (role, binding) in bindings { next.bindings.insert(role, binding); }
                if next.bindings.len() > MAX_BINDINGS { return Err("Binding budget exceeded".into()); }
                if next.phase == ActPhase::Held { next.phase = ActPhase::Running; }
                let mode_differs = next.mode != mode;
                if next == act {
                    return Ok(json!({"state":"act_opened","act":act,"resumed":true,"changed":false,"mode_differs":mode_differs}));
                }
                self.act_finish(next, previous, json!({"state":"act_opened","resumed":true,"changed":true,"mode_differs":mode_differs}), None, receipts)
            }
            Request::ActSelect { act_ref, actor, material, role, state, kind, bindings, captions, transition, event_basis, summary, expected_revision, expected_act_revision, activity_ref: _ } => {
                text(&actor)?;
                bindings_valid(&bindings)?;
                optional_transition(&transition)?;
                optional_basis(&event_basis)?;
                optional_text(&summary)?;
                if let Some(r) = &role { expression::role_name(r)?; }
                if let Some(s) = &state { expression::role_name(s)?; }
                if captions.len() > MAX_BINDINGS { return Err("Caption budget exceeded".into()); }
                let state = state.or_else(|| material.as_ref().and_then(|m| m.state.clone()));
                let scene_named = material.as_ref().is_some_and(|m| m.scene_ref.is_some());
                let object_local = role.is_some() && state.is_some() && !scene_named;
                // The passage kind follows the request's shape; a contradicting
                // caller-supplied kind is refused, never recorded.
                let shaped = if state.is_some() && !scene_named { PassageKind::State } else { PassageKind::Scene };
                let kind = match kind {
                    None => shaped,
                    Some(k) if k == shaped => k,
                    Some(PassageKind::Return) if !object_local => PassageKind::Return,
                    Some(k) => return Err(format!("act_select kind {k:?} contradicts the request (it performs a {shaped:?} passage)")),
                };
                let act = guard!(act_ref, expected_act_revision);
                live!(act);
                precheck!(act, 1, kind == PassageKind::Return);
                let previous = act.revision;
                let mut next = act.clone();
                // A new performance reads each bound character at its current
                // revision; only a revision this request pins is enforced.
                for binding in next.bindings.values_mut() { binding.character_revision = None; }
                for (r, b) in &bindings { next.bindings.insert(r.clone(), b.clone()); }
                if next.bindings.len() > MAX_BINDINGS { return Err("Binding budget exceeded".into()); }
                let target_ref = next.expression_ref.clone();
                let snapshot = self.act_snapshot(&target_ref)?;
                let mut passage = Passage::new(next.sequence.len(), kind, next.mode);
                passage.target_ref = Some(target_ref.clone());
                passage.transition = transition;
                passage.event_basis = event_basis;
                passage.summary = summary;
                if object_local {
                    let (role, state) = (role.unwrap(), state.unwrap());
                    let character = material
                        .as_ref()
                        .and_then(|m| m.file_ref.clone().or_else(|| m.expression_ref.clone()))
                        .or_else(|| next.bindings.get(&role).and_then(|b| b.character_ref.clone()))
                        .or_else(|| next.cast.iter().find(|c| c.role == role).and_then(|c| c.character_ref.clone()))
                        .ok_or("The role has no bound character for this state")?;
                    let loaded = self.world_material(Some(&character), None)?;
                    if let Some(pin) = material.as_ref().and_then(|m| m.revision.as_ref()) {
                        if pin != &loaded.revision {
                            return Ok(drift("character", &Some(character), pin, &loaded.revision));
                        }
                    }
                    let scene_ref = crate::expression_material::resolve_scene(&loaded.document, None, Some(&state))?;
                    let body = crate::expression_material::body_material(&loaded.document, &scene_ref, "self")?;
                    let entity_ref = next
                        .bindings
                        .get(&role)
                        .and_then(|b| b.entity_ref.clone())
                        .or_else(|| next.role_entities.get(&role).cloned())
                        .ok_or("The role has no occupant in the live Expression yet; perform a Scene first")?;
                    let outcome = self.world_perform_local(&target_ref, None, &entity_ref, body, expected_revision, &actor, receipts)?;
                    let (revision, target_scene) = performed!(outcome, snapshot);
                    if let Some(b) = next.bindings.get_mut(&role) {
                        b.state = Some(state.clone());
                        if b.character_ref.as_deref() == Some(character.as_str()) {
                            b.character_revision = Some(loaded.revision.clone());
                        }
                    }
                    passage.role = Some(role);
                    passage.state = Some(state);
                    passage.file_ref = loaded.file_ref.clone();
                    passage.expression_ref = loaded.file_ref.is_none().then(|| loaded.document.expression_ref.clone());
                    passage.revision = Some(loaded.revision.clone());
                    passage.scene_ref = Some(scene_ref);
                    passage.target_scene_ref = Some(target_scene);
                    next.basis_revision = revision;
                } else {
                    let select = material.ok_or("act_select names material (a Scene or state), or a role and state")?;
                    let loaded = self.world_material(select.file_ref.as_deref(), select.expression_ref.as_deref())?;
                    if let Some(pin) = &select.revision {
                        if pin != &loaded.revision {
                            let reference = select.file_ref.clone().or(select.expression_ref.clone());
                            return Ok(drift("scene", &reference, pin, &loaded.revision));
                        }
                    }
                    let scene_ref = crate::expression_material::resolve_scene(&loaded.document, select.scene_ref.as_deref(), state.as_deref())?;
                    let mut all_bindings = next.bindings.clone();
                    let fills = match self.world_fills(&mut all_bindings, &captions, false)? {
                        Ok(fills) => fills,
                        Err(refusal) => return Ok(refusal),
                    };
                    let outcome = self.world_perform_scene(&mut next, &loaded, &scene_ref, &target_ref, None, &fills, &all_bindings, expected_revision, &actor, receipts)?;
                    let (revision, target_scene) = performed!(outcome, snapshot);
                    passage.state = state;
                    passage.file_ref = loaded.file_ref.clone();
                    passage.expression_ref = loaded.file_ref.is_none().then(|| loaded.document.expression_ref.clone());
                    passage.revision = Some(loaded.revision.clone());
                    passage.scene_ref = Some(scene_ref.clone());
                    passage.target_scene_ref = Some(target_scene);
                    next.bindings = all_bindings.clone();
                    passage.bindings = all_bindings;
                    passage.captions = captions;
                    next.material = Some(ActMaterial { file_ref: loaded.file_ref.clone(), expression_ref: passage.expression_ref.clone(), revision: Some(loaded.revision), scene_ref: Some(scene_ref) });
                    next.basis_revision = revision;
                }
                next.position = Some(passage.index);
                next.sequence.push(passage.clone());
                if next.phase == ActPhase::Held { next.phase = ActPhase::Running; }
                self.act_finish(next, previous, json!({"state":"act_performed","passage":passage}), Some(snapshot), receipts)
            }
            Request::ActPlay { act_ref, actor, material, bindings, captions, from, expected_revision, expected_act_revision, activity_ref: _ } => {
                text(&actor)?;
                bindings_valid(&bindings)?;
                if captions.len() > MAX_BINDINGS { return Err("Caption budget exceeded".into()); }
                let act = guard!(act_ref, expected_act_revision);
                live!(act);
                let loaded = self.world_material(material.file_ref.as_deref(), material.expression_ref.as_deref())?;
                if let Some(pin) = &material.revision {
                    if pin != &loaded.revision {
                        let reference = material.file_ref.clone().or(material.expression_ref.clone());
                        return Ok(drift("scene", &reference, pin, &loaded.revision));
                    }
                }
                let order: Vec<String> = match loaded.reuse().map(|r| r.playback.clone()).filter(|p| !p.is_empty()) {
                    Some(playback) => playback,
                    None => loaded.document.scenes.iter().map(|s| s.scene_ref.clone()).collect(),
                };
                let from = from.unwrap_or(0);
                let scenes: Vec<String> = order.into_iter().skip(from).collect();
                if scenes.is_empty() {
                    return Err("Nothing to play from this Scene index".into());
                }
                precheck!(act, scenes.len(), false);
                let previous = act.revision;
                let mut next = act.clone();
                // A new performance reads each bound character at its current
                // revision; only a revision this request pins is enforced.
                for binding in next.bindings.values_mut() { binding.character_revision = None; }
                for (r, b) in &bindings { next.bindings.insert(r.clone(), b.clone()); }
                if next.bindings.len() > MAX_BINDINGS { return Err("Binding budget exceeded".into()); }
                let mut all_bindings = next.bindings.clone();
                let fills = match self.world_fills(&mut all_bindings, &captions, false)? {
                    Ok(fills) => fills,
                    Err(refusal) => return Ok(refusal),
                };
                next.bindings = all_bindings.clone();
                let target_ref = next.expression_ref.clone();
                let snapshot = self.act_snapshot(&target_ref)?;
                let mut expected = expected_revision;
                let mut played = Vec::new();
                for scene_ref in scenes {
                    let authored = crate::expression_material::scene_material(&loaded.document, &scene_ref)?;
                    let outcome = self.world_perform_scene(&mut next, &loaded, &scene_ref, &target_ref, None, &fills, &all_bindings, expected, &actor, receipts)?;
                    let (revision, target_scene) = match outcome {
                        Performed::Done { revision, scene_ref } => (revision, scene_ref),
                        Performed::Refused(v) => {
                            self.act_rollback(snapshot, receipts)?;
                            return Ok(v);
                        }
                    };
                    expected = None;
                    let mut passage = Passage::new(next.sequence.len(), PassageKind::Scene, next.mode);
                    passage.file_ref = loaded.file_ref.clone();
                    passage.expression_ref = loaded.file_ref.is_none().then(|| loaded.document.expression_ref.clone());
                    passage.revision = Some(loaded.revision.clone());
                    passage.scene_ref = Some(scene_ref.clone());
                    passage.target_ref = Some(target_ref.clone());
                    passage.target_scene_ref = Some(target_scene);
                    passage.bindings = all_bindings.clone();
                    passage.captions = captions.clone();
                    passage.transition = scene_transition(&authored);
                    next.basis_revision = revision;
                    next.position = Some(passage.index);
                    next.material = Some(ActMaterial { file_ref: loaded.file_ref.clone(), expression_ref: passage.expression_ref.clone(), revision: Some(loaded.revision.clone()), scene_ref: Some(scene_ref) });
                    next.sequence.push(passage.clone());
                    played.push(passage);
                }
                if next.phase == ActPhase::Held { next.phase = ActPhase::Running; }
                self.act_finish(next, previous, json!({"state":"act_played","passages":played}), Some(snapshot), receipts)
            }
            Request::ActGesture { act_ref, actor, gesture, role, entity_ref, material, transition, event_basis, expected_revision, expected_act_revision, activity_ref: _ } => {
                text(&actor)?;
                expression::role_name(&gesture)?;
                if let Some(r) = &role { expression::role_name(r)?; }
                optional_text(&entity_ref)?;
                optional_transition(&transition)?;
                optional_basis(&event_basis)?;
                let act = guard!(act_ref, expected_act_revision);
                live!(act);
                precheck!(act, 1, false);
                let previous = act.revision;
                let mut next = act.clone();
                let loaded = self.world_gesture_material(&next, role.as_deref(), material.as_ref())?;
                let (scene_ref, body_role) = Self::gesture_scene(&loaded, &gesture, material.as_ref().and_then(|m| m.scene_ref.as_deref()))?;
                let body = crate::expression_material::body_material(&loaded.document, &scene_ref, &body_role)?;
                let occupant = entity_ref
                    .clone()
                    .or_else(|| role.as_ref().and_then(|r| next.bindings.get(r).and_then(|b| b.entity_ref.clone())))
                    .or_else(|| role.as_ref().and_then(|r| next.role_entities.get(r).cloned()))
                    .ok_or("A gesture names an entity or a role with an occupant in the live Expression")?;
                let target_ref = next.expression_ref.clone();
                let snapshot = self.act_snapshot(&target_ref)?;
                let outcome = self.world_perform_local(&target_ref, None, &occupant, body, expected_revision, &actor, receipts)?;
                let (revision, target_scene) = performed!(outcome, snapshot);
                let mut passage = Passage::new(next.sequence.len(), PassageKind::Gesture, next.mode);
                passage.gesture = Some(gesture);
                passage.role = role;
                passage.file_ref = loaded.file_ref.clone();
                passage.expression_ref = loaded.file_ref.is_none().then(|| loaded.document.expression_ref.clone());
                passage.revision = Some(loaded.revision.clone());
                passage.scene_ref = Some(scene_ref);
                passage.target_ref = Some(target_ref);
                passage.target_scene_ref = Some(target_scene);
                passage.native_ref = Some(occupant);
                passage.transition = transition;
                passage.event_basis = event_basis;
                next.basis_revision = revision;
                next.position = Some(passage.index);
                next.sequence.push(passage.clone());
                self.act_finish(next, previous, json!({"state":"act_performed","passage":passage}), Some(snapshot), receipts)
            }
            Request::ActText { act_ref, actor, role, text: value_text, value, field, event_basis, expected_revision, expected_act_revision, activity_ref: _ } => {
                text(&actor)?;
                expression::role_name(&role)?;
                optional_text(&value_text)?;
                optional_basis(&event_basis)?;
                let field = field.unwrap_or_else(|| "body".into());
                crate::expression_material::text_field(&field)?;
                if value.is_some_and(|v| !v.is_finite()) { return Err("Value must be finite".into()); }
                if value_text.is_none() && value.is_none() { return Err("act_text fills text or a value".into()); }
                let act = guard!(act_ref, expected_act_revision);
                live!(act);
                // A fill of the same text role/field as the immediately
                // preceding passage updates that passage in place.
                let coalesce = act.sequence.last().is_some_and(|p| {
                    p.kind == PassageKind::Text && p.role.as_deref() == Some(role.as_str()) && p.field.as_deref() == Some(field.as_str())
                        && act.position == Some(p.index)
                });
                precheck!(act, usize::from(!coalesce), false);
                let previous = act.revision;
                let mut next = act.clone();
                let shown = value_text.clone().or_else(|| value.map(|v| v.to_string())).unwrap_or_default();
                let target_ref = next.expression_ref.clone();
                let snapshot = self.act_snapshot(&target_ref)?;
                let outcome = self.world_perform_text(&target_ref, None, &role, &field, &shown, expected_revision, &actor, receipts)?;
                let mut passage = Passage::new(next.sequence.len(), PassageKind::Text, next.mode);
                let presented = match outcome {
                    Some(outcome) => {
                        let (revision, scene_ref) = performed!(outcome, snapshot);
                        next.basis_revision = revision;
                        passage.target_scene_ref = Some(scene_ref);
                        true
                    }
                    None => false,
                };
                let binding = next.bindings.entry(role.clone()).or_insert(Binding {
                    kind: if value.is_some() { BindingKind::Value } else { BindingKind::Text },
                    agent_ref: None, profile_ref: None, character_ref: None, subject_ref: None, state: None,
                    label: None, glyph: None, text: None, value: None, entity_ref: None, character_revision: None,
                });
                if value_text.is_some() { binding.text = value_text.clone(); }
                if value.is_some() { binding.value = value; }
                passage.role = Some(role);
                passage.text = value_text;
                passage.value = value;
                passage.field = Some(field);
                passage.target_ref = Some(target_ref);
                passage.event_basis = event_basis;
                if coalesce {
                    let last = next.sequence.last_mut().expect("coalesced passage");
                    passage.index = last.index;
                    passage.coalesced = last.coalesced.saturating_add(1);
                    passage.transition = last.transition.clone();
                    if passage.target_scene_ref.is_none() { passage.target_scene_ref = last.target_scene_ref.clone(); }
                    *last = passage.clone();
                } else {
                    next.sequence.push(passage.clone());
                }
                next.position = Some(passage.index);
                self.act_finish(next, previous, json!({"state":"act_performed","passage":passage,"presented":presented,"coalesced":coalesce}), Some(snapshot), receipts)
            }
            Request::ActOperate { act_ref, actor, operation_kind, native_ref, mode, summary, event_basis, expected_act_revision, activity_ref: _ } => {
                text(&actor)?;
                text(&operation_kind)?;
                text(&native_ref)?;
                optional_text(&summary)?;
                optional_basis(&event_basis)?;
                let act = guard!(act_ref, expected_act_revision);
                live!(act);
                precheck!(act, 1, false);
                let previous = act.revision;
                let mut next = act.clone();
                let mut passage = Passage::new(next.sequence.len(), PassageKind::Operate, mode.unwrap_or(next.mode));
                passage.operation = Some(operation_kind);
                passage.native_ref = Some(native_ref);
                passage.summary = summary;
                passage.event_basis = event_basis;
                passage.target_ref = Some(next.expression_ref.clone());
                next.position = Some(passage.index);
                next.sequence.push(passage.clone());
                self.act_finish(next, previous, json!({"state":"act_operated","passage":passage}), None, receipts)
            }
            Request::ActContinue { act_ref, actor, to, instrument_ref, expression_ref, summary, expected_act_revision, activity_ref: _ } => {
                text(&actor)?;
                optional_text(&instrument_ref)?;
                optional_text(&summary)?;
                let act = guard!(act_ref, expected_act_revision);
                live!(act);
                precheck!(act, 1, false);
                if let Some(target) = &expression_ref {
                    // The continued act addresses a live (open) target.
                    self.world_document(target)?;
                }
                let previous = act.revision;
                let mut next = act.clone();
                let continuation = Continuation { from: next.mode, to, instrument_ref: instrument_ref.clone(), expression_ref: expression_ref.clone(), at: next.sequence.len() };
                next.continuations.push(continuation.clone());
                next.mode = to;
                if instrument_ref.is_some() { next.instrument_ref = instrument_ref.clone(); }
                if let Some(target) = expression_ref { next.expression_ref = target; }
                let mut passage = Passage::new(next.sequence.len(), PassageKind::Continue, to);
                passage.native_ref = instrument_ref;
                passage.summary = summary;
                passage.target_ref = Some(next.expression_ref.clone());
                next.position = Some(passage.index);
                next.sequence.push(passage.clone());
                if next.phase == ActPhase::Held { next.phase = ActPhase::Running; }
                self.act_finish(next, previous, json!({"state":"act_continued","continuation":continuation,"passage":passage}), None, receipts)
            }
            Request::ActComplete { act_ref, actor, return_ref, result, result_role, cancelled, expected_revision, expected_act_revision, activity_ref: _ } => {
                text(&actor)?;
                optional_text(&return_ref)?;
                optional_text(&result)?;
                let role = result_role.unwrap_or_else(|| "resultText".into());
                expression::role_name(&role)?;
                let act = guard!(act_ref, expected_act_revision);
                live!(act);
                precheck!(act, 1, true);
                let previous = act.revision;
                let mut next = act.clone();
                let target_ref = next.expression_ref.clone();
                let snapshot = self.act_snapshot(&target_ref)?;
                let mut passage = Passage::new(next.sequence.len(), PassageKind::Return, next.mode);
                let mut presented = false;
                if let Some(result) = &result {
                    if let Some(outcome) = self.world_perform_text(&target_ref, None, &role, "body", result, expected_revision, &actor, receipts)? {
                        let (revision, scene_ref) = performed!(outcome, snapshot);
                        next.basis_revision = revision;
                        passage.target_scene_ref = Some(scene_ref);
                        passage.role = Some(role.clone());
                        presented = true;
                    }
                }
                passage.native_ref = return_ref.clone();
                passage.text = result.clone();
                passage.field = presented.then(|| "body".to_owned());
                passage.target_ref = Some(target_ref);
                next.phase = if cancelled { ActPhase::Cancelled } else { ActPhase::Completed };
                next.return_ref = return_ref;
                next.result = result;
                next.position = Some(passage.index);
                next.sequence.push(passage.clone());
                self.act_finish(next, previous, json!({"state": if cancelled {"act_cancelled"} else {"act_completed"}, "passage":passage, "presented":presented}), Some(snapshot), receipts)
            }
            Request::ActSeek { act_ref, actor, position, accept_drift, expected_revision, expected_act_revision, activity_ref: _ } => {
                text(&actor)?;
                let act = guard!(act_ref, expected_act_revision);
                if position >= act.sequence.len() {
                    return Err("Seek position is outside the act's sequence".into());
                }
                precheck!(act, 0, true);
                let previous = act.revision;
                let mut next = act.clone();
                // Forward from the current position: only the passages between
                // (from the last Scene-setting one among them). Backward (or
                // unpositioned): from the Scene-setting passage at/before it.
                let (start, incremental) = match act.position {
                    Some(current) if position > current => {
                        let from = current + 1;
                        (act.sequence[from..=position].iter().rposition(Passage::sets_scene).map_or(from, |i| from + i), true)
                    }
                    _ => (act.sequence[..=position].iter().rposition(Passage::sets_scene).unwrap_or(0), false),
                };
                let replay: Vec<Passage> = act.sequence[start..=position].to_vec();
                // Refuse drift before any edit (unless the caller accepts it).
                let mut replay = replay;
                for passage in &mut replay {
                    if accept_drift {
                        for binding in passage.bindings.values_mut() {
                            binding.character_revision = None;
                        }
                    } else if let Some(mut refusal) = self.passage_drift(passage)? {
                        refusal["act_ref"] = json!(act.act_ref);
                        return Ok(refusal);
                    }
                }
                let target_ref = act.expression_ref.clone();
                let snapshot = self.act_snapshot(&target_ref)?;
                let mut expected = expected_revision;
                let mut performed_any = false;
                for passage in &replay {
                    match self.replay_passage(&mut next, passage, expected, &actor, receipts)? {
                        Some(Performed::Refused(v)) => {
                            self.act_rollback(snapshot, receipts)?;
                            return Ok(v);
                        }
                        Some(Performed::Done { revision, .. }) => { next.basis_revision = revision; expected = None; performed_any = true; }
                        None => {}
                    }
                }
                next.position = Some(position);
                self.act_finish(next, previous, json!({"state":"act_sought","position":position,"performed":performed_any,
                    "replayed":{"from":start,"to":position,"incremental":incremental},
                    "passage":act.sequence[position]}), Some(snapshot), receipts)
            }
            Request::ActArchive { act_ref, actor } => {
                text(&actor)?;
                let act = guard!(act_ref, None::<u64>);
                if act.archived {
                    return Ok(json!({"state":"act_archived","act":act,"changed":false}));
                }
                Ok(match self.act_archive_one(act)? {
                    Ok(act) => json!({"state":"act_archived","act":act,"changed":true}),
                    Err(conflict) => conflict,
                })
            }
            Request::ActInspect { act_ref } => match self.act_lookup(&act_ref)? {
                Some(act) => Ok(json!({"state":"act","act":act})),
                None => Ok(json!({"state":"unknown_act","act_ref":act_ref})),
            },
            Request::ActList { mode, expression_ref, phase } => {
                let acts: Vec<Value> = self
                    .world
                    .acts
                    .values()
                    .filter(|a| mode.is_none_or(|m| a.mode == m))
                    .filter(|a| expression_ref.as_ref().is_none_or(|r| &a.expression_ref == r))
                    .filter(|a| phase.is_none_or(|p| a.phase == p))
                    .map(act_summary)
                    .collect();
                Ok(json!({"state":"acts","acts":acts,"persistent":self.world.store.is_some(),"store_errors":self.world.store_errors,
                    "archive":"archived acts are not listed; act_inspect reads one by ref"}))
            }
            _ => Err("not an act operation".into()),
        }
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
            presentation: None,
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
                relation_ref: None,
            },
            provenance: vec![],
            representations: vec![],
            refinements: vec![],
            collections: Vec::new(),
            profiles: Vec::new(),
            reuse: None,
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
            presentation: None,
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
                relation_ref: None,
            },
            provenance: vec![],
            representations: vec![],
            refinements: vec![],
            collections: Vec::new(),
            profiles: Vec::new(),
            reuse: None,
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
