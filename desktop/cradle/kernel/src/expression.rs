//! Expression application state. Only presentation drafts live here; all native
//! subjects and Actions are references. Both native input faces use this service.
use crate::{action, files, flow::CentralClient, world};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

pub const SCHEMA: &str = "oi.expression/v1";
pub(crate) const LIMIT: usize = 256;
/// A document's own semantic cardinality (entities, relations,
/// representations, one Scene's members). Separate from list guards (LIMIT)
/// and from the renderer's resident window (`render_formations`, paged per
/// Scene): a constellation is never truncated to fit a draw budget (Technē
/// map §36).
pub(crate) const DOCUMENT_MEMBERS: usize = 2048;
/// Outer storage bound for one native Expression document.
pub(crate) const DOCUMENT_BYTES: usize = 8 * 1024 * 1024;
pub(crate) const MAX_REVISION: u64 = 9_007_199_254_740_991;
/// Reusable ES3 catalog, distinct from four adoptions per Document and the
/// lineage bound. The count admits 64 open worlds with up to 64 definitions
/// each; the aggregate byte bound prevents large grammars filling that count.
/// Profiles are not evicted: exact ref/revision and dependency semantics stay
/// available across authored versions, people and coordinate traversals.
const PROFILE_CATALOG_COUNT: usize = 64 * 64;
const PROFILE_CATALOG_BYTES: usize = 16 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Availability {
    Available,
    Unavailable,
    Withheld,
    Stale,
}
/// The unix second of now (0 if the clock reads before the epoch) — the
/// recency stamp helper for the expression store.
fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_secs())
        .unwrap_or(0)
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ReadingRef {
    pub r#ref: String,
    pub revision: String,
    pub availability: Availability,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Being,
    Thing,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct DisclosedAction {
    pub action_ref: String,
    pub target_ref: String,
    pub authority_requirement: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SubjectBinding {
    pub subject_ref: String,
    pub native_owner: String,
    pub presentation_role: Role,
    pub sources: Vec<ReadingRef>,
    pub readings: Vec<ReadingRef>,
    pub actions: Vec<DisclosedAction>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Automation {
    #[serde(deserialize_with = "crate::expression_file::finite_number")]
    pub min: f64,
    #[serde(deserialize_with = "crate::expression_file::finite_number")]
    pub max: f64,
    #[serde(deserialize_with = "crate::expression_file::finite_number")]
    pub rate_hz: f64,
    pub waveform: Waveform,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Waveform {
    Sine,
    Triangle,
    Square,
    Saw,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Parameter {
    pub value: Value,
    pub automation: Option<Automation>,
}
/// serde `skip_serializing_if` helper: omit `pinned` from the wire when
/// false, so every existing bound Entity (none of which ever set it) stays
/// byte-identical after this field's addition.
fn is_false(value: &bool) -> bool {
    !*value
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Entity {
    pub entity_ref: String,
    pub revision: u64,
    pub title: String,
    pub subject: Option<SubjectBinding>,
    pub parameters: BTreeMap<String, Parameter>,
    /// World-position pin (owner commission, QL-MEF #214 geometry-closeout):
    /// an explicit native hold on this entity's own world position, distinct
    /// from blueprint membership (a whole's shared transform) and from
    /// release (leaving a blueprint). Optional; defaults to unpinned and
    /// changes only through `Change::EntityPin`.
    #[serde(default, skip_serializing_if = "is_false")]
    pub pinned: bool,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Scene {
    /// Full existing authoring Scene; no source or knowledge objects are copied.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub presentation: Option<crate::expression_scene::Presentation>,
    pub scene_ref: String,
    pub revision: u64,
    pub title: String,
    pub entity_refs: Vec<String>,
    /// ES1A scene-body native carrier: the scene's primary body may come from
    /// an admitted native carrier instead of only the engine composition.
    /// Absent means the live engine composition (current default).
    #[serde(default)]
    pub body: Option<crate::expression_carrier::SceneBody>,
    /// ES1B declarative triggers (no executable script bodies, ever).
    #[serde(default)]
    pub triggers: Vec<crate::expression_trigger::SceneTrigger>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Relation {
    /// Owner supplied by the native relation reading, never inferred from geometry.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_owner: Option<String>,
    pub binding_ref: String,
    pub relation: ReadingRef,
    pub from_entity_ref: String,
    pub to_entity_ref: String,
    pub provenance: Vec<ReadingRef>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RepresentationKind {
    Live,
    Image,
    Video,
    Html,
    Embed,
    Projection,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Representation {
    pub kind: RepresentationKind,
    pub representation: ReadingRef,
    pub provenance: Vec<ReadingRef>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Selection {
    pub scene_ref: String,
    pub entity_ref: Option<String>,
    /// Exact presentation occurrence of a native relation; exclusive with entity_ref.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub relation_ref: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RefinementState {
    Proposed,
    Accepted,
    Rejected,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct RefinementDecision {
    pub state: RefinementState,
    pub actor: String,
    pub reason: String,
    pub decided_at_revision: u64,
    #[serde(default)]
    pub corrections: Vec<Change>,
}
/// An attributable, reviewable Agent proposal. It lives in the Expression
/// document so export/reopen retains the person's accept/reject/correction
/// decision. `activity_ref` is correlation evidence only, never authority.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Refinement {
    pub proposal_ref: String,
    pub basis_revision: u64,
    pub proposed_by: String,
    pub activity_ref: Option<String>,
    pub continues_proposal_ref: Option<String>,
    pub summary: String,
    pub changes: Vec<Change>,
    #[serde(default)]
    pub method_refs: Vec<ReadingRef>,
    #[serde(default)]
    pub evidence_refs: Vec<ReadingRef>,
    pub decision: Option<RefinementDecision>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Document {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub presentation: Option<crate::expression_scene::Composition>,
    pub schema: String,
    pub expression_ref: String,
    pub revision: u64,
    pub title: String,
    pub scenes: Vec<Scene>,
    pub entities: BTreeMap<String, Entity>,
    pub relations: BTreeMap<String, Relation>,
    pub selection: Selection,
    pub provenance: Vec<ReadingRef>,
    pub representations: Vec<Representation>,
    #[serde(default)]
    pub refinements: Vec<Refinement>,
    /// ES3 Library-as-view: collection/index memberships over this Expression
    /// ref. The current Library is one such collection, not the identity
    /// boundary; Expressions stay addressable through their refs.
    #[serde(default)]
    pub collections: Vec<String>,
    /// ES3 recorded profile instantiations with explicit, legible overrides.
    #[serde(default)]
    pub profiles: Vec<crate::expression_profile::ProfileAdoption>,
    /// Reusable-material index (contract EXPRESSION-ACT-MATERIAL-V1 §1): a
    /// character, Scene, Expression or gesture saved as an ordinary Expression
    /// document. Absent on ordinary Expressions; changed only through
    /// `reuse_set` / `reuse_clear`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reuse: Option<Reuse>,
}

pub const REUSE_SCHEMA: &str = "oi.expression-reuse/v1";
const REUSE_ROLES: usize = 64;
const REUSE_NAMES: usize = 64;
const REUSE_PLAYBACK: usize = 256;
const REUSE_ASSOCIATIONS: usize = 64;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum ReuseKind {
    Character,
    Scene,
    Expression,
    Gesture,
}
impl ReuseKind {
    pub const ALL: [ReuseKind; 4] = [
        Self::Character,
        Self::Scene,
        Self::Expression,
        Self::Gesture,
    ];
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Character => "character",
            Self::Scene => "scene",
            Self::Expression => "expression",
            Self::Gesture => "gesture",
        }
    }
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RoleAccepts {
    Agent,
    Object,
    Text,
    Value,
}
/// One discoverable role slot: an entity or text layer in saved Scene
/// material carrying `"role": "<name>"`.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ReuseRole {
    pub role: String,
    pub accepts: RoleAccepts,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entity_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_id: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ReuseGesture {
    pub scene_ref: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ReuseAssociations {
    #[serde(default)]
    pub workflow_keys: Vec<String>,
    #[serde(default)]
    pub task_types: Vec<String>,
    #[serde(default)]
    pub skill_set_refs: Vec<String>,
    #[serde(default)]
    pub skill_refs: Vec<String>,
    #[serde(default)]
    pub event_families: Vec<String>,
}
impl ReuseAssociations {
    pub fn is_empty(&self) -> bool {
        self.lists().iter().all(|(_, l)| l.is_empty())
    }
    pub fn lists(&self) -> [(&'static str, &Vec<String>); 5] {
        [
            ("workflow_keys", &self.workflow_keys),
            ("task_types", &self.task_types),
            ("skill_set_refs", &self.skill_set_refs),
            ("skill_refs", &self.skill_refs),
            ("event_families", &self.event_families),
        ]
    }
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ReuseVariation {
    pub file_ref: String,
    pub revision: String,
}
/// `oi.expression-reuse/v1` — the smallest metadata that makes an ordinary
/// Expression reusable: role slots, entry state, named states and gestures,
/// playback order and discovery associations. Everything performative
/// (transitions, sequences, sound, camera) stays in the Scene material.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Reuse {
    pub schema: String,
    pub kind: ReuseKind,
    pub title: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub roles: Vec<ReuseRole>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entry_scene_ref: Option<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub states: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub gestures: BTreeMap<String, ReuseGesture>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub playback: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_state: Option<String>,
    #[serde(default, skip_serializing_if = "ReuseAssociations::is_empty")]
    pub associations: ReuseAssociations,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variation_of: Option<ReuseVariation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub authored_by: Option<String>,
}

/// A role / state / gesture name: bounded ASCII words joined by `.`, `-` or
/// `_` (`sender`, `participants.0`, `invoke-skill`).
pub fn role_name(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 64
        || !value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
    {
        return Err(format!("Invalid role/state/gesture name {value:?}"));
    }
    Ok(())
}

impl Reuse {
    pub fn validate(&self, document: &Document) -> Result<(), String> {
        if self.schema != REUSE_SCHEMA {
            return Err("Unsupported reuse schema".into());
        }
        text(&self.title)?;
        if self.title.len() > 256 {
            return Err("Reuse title exceeds 256 bytes".into());
        }
        let scene = |r: &str| -> Result<(), String> {
            if document.scenes.iter().any(|s| s.scene_ref == r) {
                Ok(())
            } else {
                Err(format!("Reuse names absent Scene {r}"))
            }
        };
        if self.roles.len() > REUSE_ROLES
            || self.states.len() > REUSE_NAMES
            || self.gestures.len() > REUSE_NAMES
            || self.playback.len() > REUSE_PLAYBACK
        {
            return Err("Reuse budget exceeded".into());
        }
        let text_ids: BTreeSet<&str> = document
            .scenes
            .iter()
            .filter_map(|s| s.presentation.as_ref())
            .filter_map(|p| p.scene["text"].as_array())
            .flatten()
            .filter_map(|t| t["id"].as_str())
            .collect();
        let mut names = BTreeSet::new();
        for role in &self.roles {
            role_name(&role.role)?;
            if !names.insert(role.role.as_str()) {
                return Err(format!("Duplicate reuse role {}", role.role));
            }
            match (&role.entity_ref, &role.text_id) {
                (Some(entity), None) => {
                    if role.accepts == RoleAccepts::Text {
                        return Err("A text role addresses a text layer (text_id)".into());
                    }
                    if !document.entities.contains_key(entity) {
                        return Err(format!("Reuse role {} names absent entity", role.role));
                    }
                }
                (None, Some(text_id)) => {
                    if !matches!(role.accepts, RoleAccepts::Text | RoleAccepts::Value) {
                        return Err("Only text/value roles address a text layer".into());
                    }
                    if !text_ids.contains(text_id.as_str()) {
                        return Err(format!("Reuse role {} names absent text layer", role.role));
                    }
                }
                _ => return Err("A reuse role names exactly one entity_ref or text_id".into()),
            }
        }
        if let Some(entry) = &self.entry_scene_ref {
            scene(entry)?;
        }
        for (name, scene_ref) in &self.states {
            role_name(name)?;
            scene(scene_ref)?;
        }
        for (name, gesture) in &self.gestures {
            role_name(name)?;
            scene(&gesture.scene_ref)?;
            if let Some(role) = &gesture.role {
                role_name(role)?;
            }
        }
        for scene_ref in &self.playback {
            scene(scene_ref)?;
        }
        if let Some(preview) = &self.preview_state {
            if !self.states.contains_key(preview) {
                return Err("preview_state must name one of the states".into());
            }
        }
        for (_, list) in self.associations.lists() {
            if list.len() > REUSE_ASSOCIATIONS {
                return Err("Reuse association budget exceeded".into());
            }
            for value in list {
                text(value)?;
                if value.len() > 256 {
                    return Err("Reuse association exceeds 256 bytes".into());
                }
            }
        }
        if let Some(variation) = &self.variation_of {
            text(&variation.file_ref)?;
            text(&variation.revision)?;
        }
        if let Some(author) = &self.authored_by {
            text(author)?;
        }
        Ok(())
    }

    /// A removed Scene leaves the reuse index with it: its state, gesture and
    /// playback entries (and an entry/preview pointing at it) are dropped, as
    /// are text roles whose layer no remaining Scene carries.
    pub fn forget_scene(&mut self, scene_ref: &str, remaining: &[Scene]) {
        let dropped: Vec<String> = self
            .states
            .iter()
            .filter(|(_, r)| r.as_str() == scene_ref)
            .map(|(n, _)| n.clone())
            .collect();
        self.states.retain(|_, r| r != scene_ref);
        if self
            .preview_state
            .as_ref()
            .is_some_and(|p| dropped.contains(p))
        {
            self.preview_state = None;
        }
        self.gestures.retain(|_, g| g.scene_ref != scene_ref);
        self.playback.retain(|r| r != scene_ref);
        if self.entry_scene_ref.as_deref() == Some(scene_ref) {
            self.entry_scene_ref = None;
        }
        let text_ids: BTreeSet<String> = remaining
            .iter()
            .filter_map(|s| s.presentation.as_ref())
            .filter_map(|p| p.scene["text"].as_array())
            .flatten()
            .filter_map(|t| t["id"].as_str().map(str::to_owned))
            .collect();
        self.roles
            .retain(|r| r.text_id.as_ref().is_none_or(|t| text_ids.contains(t)));
    }

    /// Remap Expression-local refs on a native fork (the same rule the fork
    /// applies to Scenes and entities); foreign refs keep their identity.
    pub fn fork(&mut self, old: &str, new: &str) {
        let map = |r: &mut String| {
            if let Some(suffix) = r.strip_prefix(&format!("{old}:")) {
                *r = format!("{new}:{suffix}");
            }
        };
        for role in &mut self.roles {
            if let Some(entity) = &mut role.entity_ref {
                map(entity);
            }
        }
        if let Some(entry) = &mut self.entry_scene_ref {
            map(entry);
        }
        for scene_ref in self.states.values_mut() {
            map(scene_ref);
        }
        for gesture in self.gestures.values_mut() {
            map(&mut gesture.scene_ref);
        }
        for scene_ref in &mut self.playback {
            map(scene_ref);
        }
    }
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "change", rename_all = "snake_case", deny_unknown_fields)]
pub enum Change {
    Rename {
        title: String,
    },
    CompositionSet {
        presentation: crate::expression_scene::Composition,
    },
    SceneCreate {
        scene_ref: String,
        title: String,
    },
    SceneRename {
        scene_ref: String,
        title: String,
    },
    SceneRemove {
        scene_ref: String,
    },
    SceneMaterialSet {
        scene_ref: String,
        presentation: crate::expression_scene::Presentation,
    },
    SceneMaterialClear {
        scene_ref: String,
    },
    SceneBlueprintBind {
        scene_ref: String,
        binding: crate::expression_blueprint::Binding,
    },
    SceneBlueprintTransform {
        scene_ref: String,
        transform: crate::expression_blueprint::Transform,
    },
    SceneBlueprintRelease {
        scene_ref: String,
    },
    SceneReorder {
        scene_refs: Vec<String>,
    },
    SceneCompose {
        scene_ref: String,
        entity_refs: Vec<String>,
    },
    EntityAdd {
        scene_ref: String,
        entity_ref: String,
        title: String,
    },
    EntityRemove {
        entity_ref: String,
    },
    /// World-position pin: distinct from `SceneBlueprintBind`/`Transform`
    /// (whole membership and shared transform) and from
    /// `SceneBlueprintRelease` (leaving a blueprint) — this holds one
    /// entity's own world position independent of either.
    EntityPin {
        entity_ref: String,
        pinned: bool,
    },
    SubjectBind {
        entity_ref: String,
        binding: SubjectBinding,
    },
    SubjectUnbind {
        entity_ref: String,
    },
    RelationBind {
        binding: Relation,
    },
    RelationRemove {
        binding_ref: String,
    },
    Focus {
        scene_ref: String,
        entity_ref: Option<String>,
    },
    RelationFocus {
        scene_ref: String,
        binding_ref: String,
    },
    ParameterSet {
        entity_ref: String,
        parameter: String,
        value: Value,
    },
    ParameterAutomate {
        entity_ref: String,
        parameter: String,
        automation: Automation,
    },
    ParameterManual {
        entity_ref: String,
        parameter: String,
    },
    RepresentationBind {
        binding: Representation,
    },
    // ——— Substrate changes (O:I #352): ES1A scene-body carriers, ES1B
    // declarative triggers, ES3 profile adoption and collection indexing.
    // Kept as one contiguous block so the ES4 world-operations lane can merge
    // its variants immediately after this comment. ———
    SceneBodySet {
        scene_ref: String,
        body: crate::expression_carrier::SceneBody,
    },
    SceneBodyClear {
        scene_ref: String,
    },
    SceneTriggerAttach {
        scene_ref: String,
        trigger: crate::expression_trigger::SceneTrigger,
    },
    SceneTriggerDetach {
        trigger_ref: String,
    },
    ProfileAdopt {
        adoption: crate::expression_profile::ProfileAdoption,
    },
    ProfileRelease {
        profile_ref: String,
    },
    CollectionsSet {
        collections: Vec<String>,
    },
    /// Reusable material (contract EXPRESSION-ACT-MATERIAL-V1 §1).
    ReuseSet {
        reuse: Reuse,
    },
    ReuseClear,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Capabilities,
    List,
    Inspect {
        expression_ref: String,
    },
    Create {
        expression_ref: String,
        title: String,
        actor: String,
    },
    Open {
        // Boxed: an inline Document makes this the largest `Request` variant
        // (and so the largest `KernelOp::Expression` payload). Indirection
        // keeps the command enum compact without changing the wire shape.
        document: Box<Document>,
        actor: String,
    },
    OpenFile {
        location: files::Location,
        actor: String,
        #[serde(default)]
        expected_file_revision: Option<String>,
    },
    /// Validate the exact ordinary file without opening, touching or saving
    /// any working Expression. The prior revision makes a second read's race
    /// explicit; file provenance stays distinct from its expanded Document.
    InspectFile {
        location: files::Location,
        expected_file_revision: String,
    },
    Fork {
        expression_ref: String,
        expected_revision: u64,
        new_expression_ref: String,
        actor: String,
    },
    Edit {
        expression_ref: String,
        expected_revision: u64,
        actor: String,
        changes: Vec<Change>,
    },
    Propose {
        expression_ref: String,
        expected_revision: u64,
        proposal_ref: String,
        actor: String,
        activity_ref: Option<String>,
        continues_proposal_ref: Option<String>,
        summary: String,
        changes: Vec<Change>,
        #[serde(default)]
        method_refs: Vec<ReadingRef>,
        #[serde(default)]
        evidence_refs: Vec<ReadingRef>,
    },
    Review {
        expression_ref: String,
        expected_revision: u64,
        proposal_ref: String,
        actor: String,
        decision: RefinementState,
        reason: String,
        #[serde(default)]
        corrections: Vec<Change>,
    },
    Export {
        expression_ref: String,
        expected_revision: u64,
    },
    SaveAs {
        expression_ref: String,
        expected_revision: u64,
        parent: files::Location,
        name: String,
        operation_ref: String,
        actor: String,
        actor_kind: String,
    },
    Save {
        expression_ref: String,
        expected_revision: u64,
        location: files::Location,
        expected_file_revision: String,
        actor: String,
        actor_kind: String,
    },
    Invoke {
        expression_ref: String,
        expected_revision: u64,
        entity_ref: String,
        action_ref: String,
        input: Option<Value>,
        project: Option<String>,
    },
    // ——— Substrate requests (O:I #352): ES3 profiles/editions/collection
    // index and ES3A asset admission/occurrence traversal. Contiguous block;
    // the ES4 world-operations lane adds its portal/selection/ExpressiveAct
    // variants immediately after this comment. ———
    ProfileDefine {
        profile: crate::expression_profile::ExpressionProfile,
        actor: String,
    },
    /// Ordered registry definitions, with the same per-definition authority
    /// and failure prefix as separate native calls. Never a Document edit.
    ProfileDefineMany {
        definitions: Vec<ProfileDefinition>,
    },
    ProfileInspect {
        profile_ref: String,
    },
    ProfileResolve {
        native_owner: String,
        carrier: crate::expression_carrier::CarrierKind,
    },
    EditionCreate {
        edition: crate::expression_profile::ExpressionEdition,
        actor: String,
    },
    EditionInspect {
        edition_ref: String,
    },
    /// Library-as-view: one index reading over the same Expression refs the
    /// Library UI reads — refs, revisions, collections and profile adoptions.
    Index,
    AssetAdmit {
        asset: crate::expression_asset::AdmittedAsset,
        actor: String,
    },
    AssetTraverse {
        asset_ref: String,
    },
    AssetSubject {
        subject_ref: String,
    },
    // --- expression_world (ES4) addition, lane aikit/es-one-state-relation ---
    // Explicit restore of an open draft to an exact prior document (an act
    // checkpoint): the draft is replaced only when `expected_revision` still
    // matches, and the restored document advances the revision by one — a
    // change, never a silent rewind. Identity and subject refs are those of
    // the checkpointed document, byte for byte.
    /// Close an open Expression and free its slot. A document with unsaved
    /// work (never saved, or edited since its last save) is refused as
    /// `dirty` — close never discards work.
    Close {
        expression_ref: String,
        actor: String,
    },
    Restore {
        expression_ref: String,
        expected_revision: u64,
        // Boxed for the same reason as `Open` above: keep the inline Document
        // out of the command enum's stack footprint.
        document: Box<Document>,
        actor: String,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ProfileDefinition {
    pub profile: crate::expression_profile::ExpressionProfile,
    pub actor: String,
}

pub(crate) fn profile_definition_requests(
    definitions: &[ProfileDefinition],
) -> Result<Vec<Request>, String> {
    if definitions.is_empty() || definitions.len() > 64 {
        return Err("A native profile batch requires 1–64 definitions".into());
    }
    crate::native_wire::measure(definitions, DOCUMENT_BYTES)
        .map_err(|_| "Native profile batch input byte budget exceeded".to_owned())?;
    Ok(definitions
        .iter()
        .map(|definition| Request::ProfileDefine {
            profile: definition.profile.clone(),
            actor: definition.actor.clone(),
        })
        .collect())
}
#[derive(Clone, Debug, Serialize)]
pub struct Changed {
    pub expression_ref: String,
    pub revision: u64,
    pub actor: String,
    pub activity_ref: Option<String>,
}
#[derive(Debug, Default)]
pub struct Application {
    documents: BTreeMap<String, Document>,
    saved: BTreeMap<String, u64>,
    /// Recency disclosure (owner direction 2026-09-19): the unix second of
    /// this instance's last touch per Expression — stamped at every document
    /// write, disclosed by `list`, and the listing's own ordering. Absence
    /// (a pre-field document first listed) reads as 0, never guessed.
    touched: BTreeMap<String, u64>,
    file_bindings: BTreeMap<String, Value>,
    /// ES3 reusable presentation profiles, keyed by profile_ref.
    profiles: BTreeMap<String, crate::expression_profile::ExpressionProfile>,
    /// Sum of compact serialized typed profile values. Account only the
    /// incoming/replaced profile; never serialize the whole catalog per op.
    profile_bytes: usize,
    /// ES3 portable editions, keyed by edition_ref.
    editions: BTreeMap<String, crate::expression_profile::ExpressionEdition>,
    /// ES3A admission + occurrence index over real asset use.
    assets: crate::expression_asset::AssetIndex,
}

pub fn capabilities() -> Value {
    json!({"schema":"oi.expression-capabilities/v1", "document_schema":SCHEMA,
        "operations":["capabilities","list","inspect","inspect_file","create","open","open_file","fork","edit","propose","review","export","save","save_as","invoke",
            "profile_define","profile_define_many","profile_inspect","profile_resolve","edition_create","edition_inspect","index","asset_admit","asset_traverse","asset_subject","restore","close"],
        "changes":["rename","composition_set","scene_material_set","scene_material_clear","scene_blueprint_bind","scene_blueprint_transform","scene_blueprint_release","scene_rename","scene_remove","scene_create","scene_reorder","scene_compose","entity_add","entity_remove","entity_pin","subject_bind","subject_unbind","relation_bind","relation_remove","focus","relation_focus","parameter_set","parameter_automate","parameter_manual","representation_bind",
            "scene_body_set","scene_body_clear","scene_trigger_attach","scene_trigger_detach","profile_adopt","profile_release","collections_set","reuse_set","reuse_clear"],
        "reuse":{"schema":REUSE_SCHEMA,"kinds":["character","scene","expression","gesture"],"accepts":["agent","object","text","value"],
            "law":"reusable material is an ordinary Expression document; roles are placeholders in Scene material (entities/text layers carrying role); refs must name this Expression's Scenes, entities and text layers",
            "budgets":{"roles":REUSE_ROLES,"states":REUSE_NAMES,"gestures":REUSE_NAMES,"playback":REUSE_PLAYBACK,"associations_per_list":REUSE_ASSOCIATIONS},
            "register":crate::expression_material::MATERIAL_REGISTER,"discovery":"expression_world material_list"},
        "composition_presentation":{"schema":"oi.journey-properties/v1","data_only":true,"scene_store":"Document.scenes"},
        "scene_presentation":{"schema":"oi.journey-scene/v1","owner":"existing Expressions authoring Scene","data_only":true,"full_native_membership_retained":true},
        "composition_budget":{"scenes":64,"entities":DOCUMENT_MEMBERS,"scene_members":DOCUMENT_MEMBERS,"render_formations":64,"render_pins":64},
        "parameters":{"glyph":{"type":"string","max_length":128},"shape":{"values":["glyph","ring","disc","square","triangle","yantra","cymatic"]},"kind":{"values":["formation","pin"]},"ascii":{"max_bytes":32768},"image":{"formats":["embedded_png","embedded_jpeg","embedded_webp"]},"x":{"min":-1600,"max":1600},"y":{"min":-1600,"max":1600},"z":{"min":-1600,"max":1600},"scale":{"min":0.05,"max":4},"share":{"min":0,"max":1000}},
        "automation":{"type":"lfo","waveforms":["sine","triangle","square","saw"],"rate_hz":{"min":0.001,"max":10},"clock_owner":"accepted Expressions engine"},
        "scene_body":{"carriers":["engine_composition","text_source","glyph_form","image_media","file_thing","knowledge_whole","html_surface","agent_surface","expression_ref"],
            "presentations":["live","inline","preview","degraded"],
            "law":"scene bodies reference native subjects through existing refs/adapters, never copied semantic objects; unsupported types degrade honestly to a bound Thing/preview carrying the real native open Action; no bespoke renderer per format",
            "live_render_admitted":["engine_composition"]},
        "triggers":{"occasions":["scene_enter","scene_leave","activate","select","sequence_transition"],
            "targets":["expression_operation","portal","native_action","navigate"],
            "expression_operations":["inspect","list","export"],
            "portal_placements":["preview","overlay","beside","full","detached","re-dock"],
            "portal_runtime":"portal_open/portal_close/portal_redock through the expression world seam over the existing Surface host, canonical target ref preserved — oi.expression-world-capabilities/v1",
            "script_bodies":"refused"},
        "profiles":{"ref_prefix":"profile:","lineage":"parents must be defined first; defaults resolve parents-first and overrides stay legible","budget":PROFILE_CATALOG_COUNT,"byte_budget":PROFILE_CATALOG_BYTES,"byte_basis":"sum of compact serialized typed profile values","lifecycle":"catalog; no automatic eviction; exact revision and lineage guards retained"},
        "editions":{"ref_prefix":"edition:","law":"an edition re-opens as a reading; it never opens or rewrites the Expression","budget":64},
        "assets":{"ref_prefix":"asset:","law":"admission + occurrence index over real use, not an advance procurement catalogue or a second semantic store","traversals":["asset_ref→uses","subject_ref→assets"],"budget":256},
        "collections":{"law":"Library-as-view: Expressions stay addressable by ref; the Library is one collection/index reading over the same refs"},
        "refinement":{"review_required":true,"decisions":["accepted","rejected"],"activity_ref_authenticates":false,"retained_on_export":true},
        "pedagogy":{"material":["scenes","source-bearing entities","movement","optional text","methods","evidence"],"chat_only":false},
        "save_owner":"central.files.write", "source_mutation":false, "attribution_is_authentication":false,
        "export_audience":"local_private", "dynamic_checkpoint":false,
        "unsupported":["capture","page_embed","projection_publish","domain_state_write","knowledge_query",
            "scene_body_live_render_beyond_engine_composition","asset_binary_storage"],
        "contract":"docs/contracts/EXPRESSION-APPLICATION-V1.md"})
}
pub(crate) fn text(value: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
        Err("Expected bounded nonempty text without control characters".into())
    } else {
        Ok(())
    }
}
pub(crate) fn id(value: &str, prefix: &str) -> Result<(), String> {
    let suffix = value
        .strip_prefix(prefix)
        .ok_or("Ref is outside this Expression")?;
    if suffix.is_empty()
        || suffix.len() > 128
        || !suffix
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
    {
        return Err("Invalid Expression-local ref".into());
    }
    Ok(())
}
fn reading(r: &ReadingRef) -> Result<(), String> {
    text(&r.r#ref)?;
    text(&r.revision)
}
pub(crate) fn readings(rs: &[ReadingRef]) -> Result<(), String> {
    if rs.len() > LIMIT {
        return Err("Reading budget exceeded".into());
    }
    for r in rs {
        reading(r)?;
    }
    Ok(())
}
pub(crate) fn bounds(key: &str) -> Option<(f64, f64)> {
    match key {
        "x" | "y" | "z" => Some((-1600., 1600.)),
        "scale" => Some((0.05, 4.)),
        "share" => Some((0., 1000.)),
        "width" | "height" => Some((1., 1600.)),
        "rotation" => Some((-std::f64::consts::TAU, std::f64::consts::TAU)),
        "frequency" => Some((1., 20_000.)),
        "force_strength" | "force_spin" => Some((-20., 20.)),
        "force_radius" => Some((1., 1600.)),
        _ => None,
    }
}
pub(crate) fn parameter(key: &str, p: &Parameter) -> Result<(), String> {
    if matches!(
        key,
        "shape" | "kind" | "yantra" | "force_mode" | "ascii" | "image"
    ) {
        if p.automation.is_some() {
            return Err("Text/material carrier automation is unsupported".into());
        }
        let value = p.value.as_str().ok_or("Material carrier must be text")?;
        let valid = match key {
            "shape" => matches!(
                value,
                "glyph" | "ring" | "disc" | "square" | "triangle" | "yantra" | "cymatic"
            ),
            "kind" => matches!(value, "formation" | "pin"),
            "yantra" => matches!(
                value,
                "muladhara"
                    | "svadhisthana"
                    | "manipura"
                    | "anahata"
                    | "vishuddha"
                    | "ajna"
                    | "sahasrara"
            ),
            "force_mode" => matches!(value, "none" | "attract" | "repel" | "vortex"),
            "ascii" => {
                value.len() <= 32_768
                    && !value
                        .chars()
                        .any(|c| c.is_control() && c != '\n' && c != '\r' && c != '\t')
            }
            "image" => {
                value.is_empty()
                    || (value.len() <= 384 * 1024
                        && [
                            "data:image/png;base64,",
                            "data:image/jpeg;base64,",
                            "data:image/webp;base64,",
                        ]
                        .iter()
                        .any(|prefix| {
                            value.strip_prefix(prefix).is_some_and(|bytes| {
                                !bytes.is_empty()
                                    && bytes.len() % 4 == 0
                                    && bytes
                                        .bytes()
                                        .all(|b| b.is_ascii_alphanumeric() || b"+/=".contains(&b))
                            })
                        }))
            }
            _ => false,
        };
        if !valid {
            return Err(format!("Invalid or unsupported {key} material"));
        }
    } else if key == "glyph" {
        if !p
            .value
            .as_str()
            .is_some_and(|v| v.chars().count() <= 128 && !v.chars().any(char::is_control))
            || p.automation.is_some()
        {
            return Err(
                "glyph must be text (128 characters); glyph automation is unsupported".into(),
            );
        }
    } else {
        let (min, max) = bounds(key).ok_or("Unsupported Expression parameter")?;
        if !p
            .value
            .as_f64()
            .is_some_and(|v| v.is_finite() && v >= min && v <= max)
        {
            return Err(format!("{key} is outside [{min}, {max}]"));
        }
        if let Some(a) = &p.automation {
            if !a.min.is_finite()
                || !a.max.is_finite()
                || a.min < min
                || a.max > max
                || a.min > a.max
                || !a.rate_hz.is_finite()
                || !(0.001..=10.).contains(&a.rate_hz)
            {
                return Err("Invalid automation bounds/rate".into());
            }
        }
    }
    Ok(())
}
impl Document {
    /// The same pure edit calculation used by commit and Act admission. This
    /// lets the Act owner check retained-history capacity before mutating the
    /// live document, without a second edit interpretation.
    pub(crate) fn edited(&self, changes: Vec<Change>) -> Result<Self, String> {
        let mut next = self.clone();
        for change in changes {
            next.change(change)?;
        }
        next.validate()?;
        if &next != self {
            next.revision = next.revision.checked_add(1).ok_or("Revision exhausted")?;
            for entity in next.entities.values_mut() {
                if self.entities.get(&entity.entity_ref) != Some(entity) {
                    entity.revision = next.revision;
                }
            }
            for scene in &mut next.scenes {
                if self
                    .scenes
                    .iter()
                    .find(|old| old.scene_ref == scene.scene_ref)
                    != Some(scene)
                {
                    scene.revision = next.revision;
                }
            }
            next.validate()?;
        }
        Ok(next)
    }

    pub fn validate(&self) -> Result<(), String> {
        if serde_json::to_vec(self).map_err(|e| e.to_string())?.len() > DOCUMENT_BYTES {
            return Err("Expression document exceeds 8 MiB".into());
        }
        if self.schema != SCHEMA || self.revision == 0 || self.revision > MAX_REVISION {
            return Err("Unsupported document schema/revision".into());
        }
        id(&self.expression_ref, "expression:")?;
        text(&self.title)?;
        readings(&self.provenance)?;
        if let Some(presentation) = &self.presentation {
            presentation.validate()?;
        }
        if self.scenes.is_empty()
            || self.scenes.len() > 64
            || self.entities.len() > DOCUMENT_MEMBERS
            || self.relations.len() > DOCUMENT_MEMBERS
            || self.representations.len() > DOCUMENT_MEMBERS
        {
            return Err("Expression composition budget exceeded".into());
        }
        let mut scene_ids = BTreeSet::new();
        for s in &self.scenes {
            id(&s.scene_ref, &format!("{}:scene:", self.expression_ref))?;
            text(&s.title)?;
            if s.revision == 0 || s.revision > self.revision || !scene_ids.insert(&s.scene_ref) {
                return Err("Invalid or duplicate scene revision/ref".into());
            }
            let unique: BTreeSet<_> = s.entity_refs.iter().collect();
            if unique.len() != s.entity_refs.len()
                || s.entity_refs.len() > DOCUMENT_MEMBERS
                || s.entity_refs.iter().any(|r| !self.entities.contains_key(r))
            {
                return Err("Scene contains duplicate, missing or too many entities".into());
            }
            if let Some(presentation) = &s.presentation {
                crate::expression_scene::validate(presentation, s, self)?;
            }
            if let Some(body) = &s.body {
                crate::expression_carrier::validate_body(body, &self.expression_ref)?;
            }
            crate::expression_blueprint::validate(s, self)?;
        }
        crate::expression_trigger::validate_document_triggers(self)?;
        if self.collections.len() > 16 {
            return Err("Collection budget exceeded".into());
        }
        for collection in &self.collections {
            let trimmed = collection.trim();
            if trimmed.is_empty()
                || trimmed != collection
                || collection.len() > 64
                || collection.chars().any(char::is_control)
            {
                return Err("Collection names are bounded, trimmed text".into());
            }
        }
        if self.collections.iter().collect::<BTreeSet<_>>().len() != self.collections.len() {
            return Err("Duplicate collection membership".into());
        }
        if self.profiles.len() > 4 {
            return Err("Profile adoption budget exceeded".into());
        }
        for adoption in &self.profiles {
            adoption.validate()?;
        }
        if let Some(reuse) = &self.reuse {
            reuse.validate(self)?;
        }
        for (key, e) in &self.entities {
            id(&e.entity_ref, &format!("{}:entity:", self.expression_ref))?;
            text(&e.title)?;
            if key != &e.entity_ref || e.revision == 0 || e.revision > self.revision {
                return Err("Invalid entity ref/revision".into());
            }
            for (k, p) in &e.parameters {
                parameter(k, p)?;
            }
            if let Some(b) = &e.subject {
                text(&b.subject_ref)?;
                text(&b.native_owner)?;
                readings(&b.sources)?;
                readings(&b.readings)?;
                if b.subject_ref.starts_with("expression:") || b.actions.len() > LIMIT {
                    return Err("Subject must remain native; Action budget exceeded".into());
                }
                let mut refs = BTreeSet::new();
                for a in &b.actions {
                    text(&a.action_ref)?;
                    text(&a.authority_requirement)?;
                    if a.target_ref != b.subject_ref || !refs.insert(&a.action_ref) {
                        return Err(
                            "Action target must match bound subject; duplicate Action".into()
                        );
                    }
                }
            }
        }
        for (key, r) in &self.relations {
            id(
                &r.binding_ref,
                &format!("{}:relation:", self.expression_ref),
            )?;
            reading(&r.relation)?;
            if let Some(owner) = &r.native_owner {
                text(owner)?;
            }
            readings(&r.provenance)?;
            if key != &r.binding_ref
                || !self.entities.contains_key(&r.from_entity_ref)
                || !self.entities.contains_key(&r.to_entity_ref)
            {
                return Err("Relation has missing endpoints or invalid binding ref".into());
            }
        }
        let scene = self
            .scenes
            .iter()
            .find(|s| s.scene_ref == self.selection.scene_ref)
            .ok_or("Selected scene is absent")?;
        if self
            .selection
            .entity_ref
            .as_ref()
            .is_some_and(|r| !scene.entity_refs.contains(r))
        {
            return Err("Selected entity is outside selected scene".into());
        }
        if let Some(binding_ref) = &self.selection.relation_ref {
            if self.selection.entity_ref.is_some() {
                return Err("Select one entity or relation occurrence, not both".into());
            }
            let relation = self
                .relations
                .get(binding_ref)
                .ok_or("Selected relation is absent")?;
            if !scene.entity_refs.contains(&relation.from_entity_ref)
                || !scene.entity_refs.contains(&relation.to_entity_ref)
            {
                return Err("Selected relation endpoints are outside selected scene".into());
            }
        }
        let mut representation_refs = BTreeSet::new();
        for r in &self.representations {
            reading(&r.representation)?;
            readings(&r.provenance)?;
            if !representation_refs.insert(&r.representation.r#ref) {
                return Err("Duplicate representation".into());
            }
        }
        if self.refinements.len() > LIMIT {
            return Err("Refinement budget exceeded".into());
        }
        let mut proposal_refs = BTreeSet::new();
        let mut reviewed_proposal_refs = BTreeSet::new();
        for proposal in &self.refinements {
            id(
                &proposal.proposal_ref,
                &format!("{}:proposal:", self.expression_ref),
            )?;
            text(&proposal.proposed_by)?;
            text(&proposal.summary)?;
            if proposal.basis_revision == 0
                || proposal.basis_revision > self.revision
                || proposal.changes.is_empty()
                || proposal.changes.len() > LIMIT
                || proposal_refs.contains(&proposal.proposal_ref)
            {
                return Err("Invalid or duplicate refinement proposal".into());
            }
            if let Some(activity_ref) = &proposal.activity_ref {
                text(activity_ref)?;
            }
            readings(&proposal.method_refs)?;
            readings(&proposal.evidence_refs)?;
            if let Some(previous) = &proposal.continues_proposal_ref {
                if !reviewed_proposal_refs.contains(previous) {
                    return Err("Continuation must name an earlier reviewed proposal".into());
                }
            }
            if let Some(decision) = &proposal.decision {
                text(&decision.actor)?;
                text(&decision.reason)?;
                if decision.state == RefinementState::Proposed
                    || decision.decided_at_revision == 0
                    || decision.decided_at_revision > self.revision
                    || decision.corrections.len() > LIMIT
                {
                    return Err("Invalid refinement decision".into());
                }
                reviewed_proposal_refs.insert(proposal.proposal_ref.clone());
            }
            proposal_refs.insert(proposal.proposal_ref.clone());
        }
        Ok(())
    }
    fn entity(&mut self, r: &str) -> Result<&mut Entity, String> {
        self.entities
            .get_mut(r)
            .ok_or_else(|| "Entity is absent".into())
    }
    fn scene(&mut self, r: &str) -> Result<&mut Scene, String> {
        self.scenes
            .iter_mut()
            .find(|s| s.scene_ref == r)
            .ok_or_else(|| "Scene is absent".into())
    }
    fn change(&mut self, c: Change) -> Result<(), String> {
        match c {
            Change::Rename { title } => {
                text(&title)?;
                self.title = title;
            }
            Change::CompositionSet { presentation } => {
                presentation.validate()?;
                self.presentation = Some(presentation);
            }
            Change::SceneCreate { scene_ref, title } => {
                if self.scenes.iter().any(|s| s.scene_ref == scene_ref) {
                    return Err("Scene already exists".into());
                }
                self.scenes.push(Scene {
                    presentation: None,
                    scene_ref,
                    revision: self.revision,
                    title,
                    entity_refs: vec![],
                    body: None,
                    triggers: vec![],
                });
            }
            Change::SceneRename { scene_ref, title } => {
                text(&title)?;
                let scene = self.scene(&scene_ref)?;
                if let Some(presentation) = &mut scene.presentation {
                    presentation.scene["name"] = json!(title);
                }
                scene.title = title;
            }
            Change::SceneRemove { scene_ref } => {
                self.scene(&scene_ref)?;
                if self.scenes.len() == 1 {
                    return Err("An Expression retains at least one Scene".into());
                }
                self.scenes.retain(|scene| scene.scene_ref != scene_ref);
                if let Some(reuse) = &mut self.reuse {
                    reuse.forget_scene(&scene_ref, &self.scenes);
                }
                if self.selection.scene_ref == scene_ref {
                    self.selection = Selection {
                        scene_ref: self.scenes[0].scene_ref.clone(),
                        entity_ref: None,
                        relation_ref: None,
                    };
                }
                // Referencing triggers remain subject to document validation:
                // remove/reconnect them explicitly in the same atomic edit.
            }
            Change::SceneMaterialSet {
                scene_ref,
                presentation,
            } => {
                crate::expression_blueprint::preserve(
                    self.scene(&scene_ref)?.presentation.as_ref(),
                    Some(&presentation),
                )?;
                self.scene(&scene_ref)?.presentation = Some(presentation);
            }
            Change::SceneMaterialClear { scene_ref } => {
                crate::expression_blueprint::preserve(
                    self.scene(&scene_ref)?.presentation.as_ref(),
                    None,
                )?;
                self.scene(&scene_ref)?.presentation = None;
            }
            Change::SceneBlueprintBind { scene_ref, binding } => {
                crate::expression_blueprint::bind(self, &scene_ref, binding)?
            }
            Change::SceneBlueprintTransform {
                scene_ref,
                transform,
            } => crate::expression_blueprint::transform(self, &scene_ref, transform)?,
            Change::SceneBlueprintRelease { scene_ref } => {
                crate::expression_blueprint::release(self, &scene_ref)?
            }
            Change::SceneReorder { scene_refs } => {
                if scene_refs.len() != self.scenes.len()
                    || scene_refs.iter().collect::<BTreeSet<_>>().len() != scene_refs.len()
                {
                    return Err("Reorder must contain every scene exactly once".into());
                }
                self.scenes = scene_refs
                    .iter()
                    .map(|r| {
                        self.scenes
                            .iter()
                            .find(|s| &s.scene_ref == r)
                            .cloned()
                            .ok_or_else(|| "Scene is absent".to_string())
                    })
                    .collect::<Result<_, _>>()?;
            }
            Change::SceneCompose {
                scene_ref,
                entity_refs,
            } => {
                let scene = self.scene(&scene_ref)?;
                if let Some(presentation) = &mut scene.presentation {
                    for reference in scene
                        .entity_refs
                        .iter()
                        .filter(|reference| !entity_refs.contains(reference))
                    {
                        crate::expression_scene::remove_entity(presentation, reference);
                    }
                }
                scene.entity_refs = entity_refs;
            }
            Change::EntityAdd {
                scene_ref,
                entity_ref,
                title,
            } => {
                if self.entities.contains_key(&entity_ref) {
                    return Err("Entity already exists".into());
                }
                self.scene(&scene_ref)?.entity_refs.push(entity_ref.clone());
                self.entities.insert(
                    entity_ref.clone(),
                    Entity {
                        entity_ref,
                        revision: self.revision,
                        title,
                        subject: None,
                        parameters: BTreeMap::from([(
                            "glyph".into(),
                            Parameter {
                                value: json!("O"),
                                automation: None,
                            },
                        )]),
                        pinned: false,
                    },
                );
            }
            Change::EntityPin { entity_ref, pinned } => {
                self.entity(&entity_ref)?.pinned = pinned;
            }
            Change::EntityRemove { entity_ref } => {
                if self.entities.remove(&entity_ref).is_none() {
                    return Err("Entity is absent".into());
                }
                for s in &mut self.scenes {
                    s.entity_refs.retain(|r| r != &entity_ref);
                    if let Some(presentation) = &mut s.presentation {
                        crate::expression_scene::remove_entity(presentation, &entity_ref);
                    }
                }
                self.relations.retain(|_, r| {
                    r.from_entity_ref != entity_ref && r.to_entity_ref != entity_ref
                });
                if self.selection.entity_ref.as_ref() == Some(&entity_ref) {
                    self.selection.entity_ref = None;
                }
                if self
                    .selection
                    .relation_ref
                    .as_ref()
                    .is_some_and(|r| !self.relations.contains_key(r))
                {
                    self.selection.relation_ref = None;
                }
            }
            Change::SubjectBind {
                entity_ref,
                binding,
            } => self.entity(&entity_ref)?.subject = Some(binding),
            Change::SubjectUnbind { entity_ref } => self.entity(&entity_ref)?.subject = None,
            Change::RelationBind { binding } => {
                self.relations.insert(binding.binding_ref.clone(), binding);
            }
            Change::RelationRemove { binding_ref } => {
                if self.relations.remove(&binding_ref).is_none() {
                    return Err("Relation is absent".into());
                }
                if self.selection.relation_ref.as_ref() == Some(&binding_ref) {
                    self.selection.relation_ref = None;
                }
            }
            Change::RelationFocus {
                scene_ref,
                binding_ref,
            } => {
                self.selection = Selection {
                    scene_ref,
                    entity_ref: None,
                    relation_ref: Some(binding_ref),
                };
            }
            Change::Focus {
                scene_ref,
                entity_ref,
            } => {
                self.selection = Selection {
                    scene_ref,
                    entity_ref,
                    relation_ref: None,
                }
            }
            Change::ParameterSet {
                entity_ref,
                parameter: key,
                value,
            } => {
                let e = self.entity(&entity_ref)?;
                if e.parameters
                    .get(&key)
                    .is_some_and(|p| p.automation.is_some())
                {
                    return Err("Take manual control before changing an automated parameter".into());
                }
                e.parameters.insert(
                    key.clone(),
                    Parameter {
                        value: value.clone(),
                        automation: None,
                    },
                );
                for scene in &mut self.scenes {
                    if let Some(presentation) = &mut scene.presentation {
                        crate::expression_scene::set_parameter(
                            presentation,
                            &entity_ref,
                            &key,
                            &value,
                        );
                    }
                }
            }
            Change::ParameterAutomate {
                entity_ref,
                parameter: key,
                automation,
            } => {
                self.entity(&entity_ref)?
                    .parameters
                    .get_mut(&key)
                    .ok_or("Set the base parameter before automating")?
                    .automation = Some(automation);
            }
            Change::ParameterManual {
                entity_ref,
                parameter: key,
            } => {
                self.entity(&entity_ref)?
                    .parameters
                    .get_mut(&key)
                    .ok_or("Parameter is absent")?
                    .automation = None
            }
            Change::RepresentationBind { binding } => {
                self.representations
                    .retain(|r| r.representation.r#ref != binding.representation.r#ref);
                self.representations.push(binding);
            }
            // ——— Substrate changes (O:I #352) ———
            Change::SceneBodySet { scene_ref, body } => {
                crate::expression_carrier::validate_body(&body, &self.expression_ref)?;
                self.scene(&scene_ref)?.body = Some(body);
            }
            Change::SceneBodyClear { scene_ref } => self.scene(&scene_ref)?.body = None,
            Change::SceneTriggerAttach { scene_ref, trigger } => {
                {
                    let scene = self.scene(&scene_ref)?;
                    if scene
                        .triggers
                        .iter()
                        .any(|t| t.trigger_ref == trigger.trigger_ref)
                    {
                        return Err("Scene trigger already exists".into());
                    }
                    if scene.triggers.len() >= crate::expression_trigger::MAX_TRIGGERS_PER_SCENE {
                        return Err("Scene trigger budget exceeded".into());
                    }
                    scene.triggers.push(trigger);
                }
                // Triggers must point at disclosed subjects/Actions and exact
                // refs; validate the whole relation now for a precise refusal.
                crate::expression_trigger::validate_document_triggers(self)?;
            }
            Change::SceneTriggerDetach { trigger_ref } => {
                let mut removed = false;
                for scene in &mut self.scenes {
                    let before = scene.triggers.len();
                    scene.triggers.retain(|t| t.trigger_ref != trigger_ref);
                    removed |= scene.triggers.len() != before;
                }
                if !removed {
                    return Err("Scene trigger is absent".into());
                }
            }
            Change::ProfileAdopt { adoption } => {
                adoption.validate()?;
                self.profiles
                    .retain(|p| p.profile_ref != adoption.profile_ref);
                self.profiles.push(adoption);
            }
            Change::ProfileRelease { profile_ref } => {
                if !self.profiles.iter().any(|p| p.profile_ref == profile_ref) {
                    return Err("Profile adoption is absent".into());
                }
                self.profiles.retain(|p| p.profile_ref != profile_ref);
            }
            Change::CollectionsSet { collections } => {
                self.collections = collections;
            }
            // Validated with the whole document: its refs must name this
            // Expression's real Scenes, entities and text layers.
            Change::ReuseSet { reuse } => self.reuse = Some(reuse),
            Change::ReuseClear => self.reuse = None,
        }
        Ok(())
    }
}
impl Application {
    /// An explicitly reviewed focus return enters proposal and decision history
    /// together. Reuse the normal validators on a private document candidate;
    /// a refusal cannot leave a proposal behind in the live Expression.
    pub(crate) fn apply_reviewed_focus(
        &mut self,
        client: &CentralClient,
        proposal: Request,
        reviewer: String,
        reason: String,
    ) -> Result<(Value, Vec<Changed>), String> {
        let (reference, revision, proposal_ref) = match &proposal {
            Request::Propose {
                expression_ref,
                expected_revision,
                proposal_ref,
                changes,
                ..
            } if changes.len() == 1
                && matches!(
                    changes[0],
                    Change::Focus { .. } | Change::RelationFocus { .. }
                ) =>
            {
                (
                    expression_ref.clone(),
                    *expected_revision,
                    proposal_ref.clone(),
                )
            }
            _ => return Err("Reviewed focus requires one exact native focus proposal".into()),
        };
        if self.document(&reference)?.revision != revision {
            return Err("The Expression changed before the reviewed return could apply".into());
        }
        let mut candidate = Self::default();
        candidate
            .documents
            .insert(reference.clone(), self.document(&reference)?.clone());
        let (_, proposed) = candidate.apply(client, proposal)?;
        let proposed = proposed.ok_or("The reviewed proposal did not advance its exact basis")?;
        let (_, accepted) = candidate.apply(
            client,
            Request::Review {
                expression_ref: reference.clone(),
                expected_revision: proposed.revision,
                proposal_ref,
                actor: reviewer,
                decision: RefinementState::Accepted,
                reason,
                corrections: vec![],
            },
        )?;
        let accepted =
            accepted.ok_or("The reviewed proposal could not be accepted at its exact basis")?;
        let document = candidate
            .documents
            .remove(&reference)
            .ok_or("Reviewed Expression disappeared")?;
        self.documents.insert(reference.clone(), document);
        self.touched.insert(reference.clone(), unix_now());
        Ok((self.inspect(&reference)?, vec![proposed, accepted]))
    }

    pub(crate) fn profile_lineage_snapshot(
        &self,
        profile_ref: &str,
    ) -> Result<Vec<crate::expression_profile::ExpressionProfile>, String> {
        crate::expression_profile::resolve_lineage(&self.profiles, profile_ref)?;
        let mut pending = vec![profile_ref.to_owned()];
        let mut visited = std::collections::BTreeSet::new();
        let mut result = Vec::new();
        while let Some(reference) = pending.pop() {
            if !visited.insert(reference.clone()) {
                continue;
            }
            let profile = self
                .profiles
                .get(&reference)
                .ok_or("Profile is not defined")?;
            pending.extend(profile.parent_profile_refs.iter().cloned());
            result.push(profile.clone());
        }
        Ok(result)
    }

    /// A parent change also changes the basis of every adopting descendant.
    /// Exact retries leave in-flight encounters alone; refused writes never
    /// reach the invalidation performed by the kernel after a successful apply.
    pub(crate) fn profile_definition_dependents(
        &self,
        profile: &crate::expression_profile::ExpressionProfile,
    ) -> Vec<String> {
        if self.profiles.get(&profile.profile_ref) == Some(profile) {
            return Vec::new();
        }
        self.documents
            .values()
            .filter(|document| {
                document.profiles.iter().any(|adoption| {
                    self.profile_lineage_snapshot(&adoption.profile_ref)
                        .is_ok_and(|lineage| {
                            lineage
                                .iter()
                                .any(|ancestor| ancestor.profile_ref == profile.profile_ref)
                        })
                })
            })
            .map(|document| document.expression_ref.clone())
            .collect()
    }

    /// Qualify reply weight before any real registry or encounter effect.
    /// A semantic refusal is left to the real ordered path, which retains its
    /// successful prefix. The shadow owns only a bounded profile catalog.
    pub(crate) fn profile_definition_batch_reply_budget(
        &self,
        client: &CentralClient,
        definitions: &[ProfileDefinition],
    ) -> Result<(), String> {
        let requests = profile_definition_requests(definitions)?;
        let mut catalog = Self {
            profiles: self.profiles.clone(),
            profile_bytes: self.profile_bytes,
            ..Self::default()
        };
        let mut bytes = b"{\"state\":\"profiles\",\"profiles\":[]}".len();
        for (index, request) in requests.into_iter().enumerate() {
            let Ok((profile, _)) = catalog.apply(client, request) else {
                return Ok(());
            };
            let weight = crate::native_wire::measure(&profile, DOCUMENT_BYTES)
                .map_err(|_| "Native profile batch reply byte budget exceeded".to_owned())?;
            bytes = bytes
                .checked_add(weight + usize::from(index > 0))
                .ok_or("Native profile batch reply byte accounting overflow")?;
            if bytes > DOCUMENT_BYTES {
                return Err("Native profile batch reply byte budget exceeded".into());
            }
        }
        Ok(())
    }

    pub(crate) fn document(&self, r: &str) -> Result<&Document, String> {
        self.documents
            .get(r)
            .ok_or_else(|| "Expression is not open".into())
    }
    fn inspect(&self, r: &str) -> Result<Value, String> {
        let d = self.document(r)?;
        Ok(
            json!({"state":"ready","document":d,"dirty":self.saved.get(r)!=Some(&d.revision),"saved_revision":self.saved.get(r),"file":self.file_bindings.get(r),"dynamic_state":"not_restored"}),
        )
    }
    fn conflict(&self, r: &str, expected: u64) -> Result<Option<Value>, String> {
        let d = self.document(r)?;
        Ok((d.revision!=expected).then(||json!({"state":"revision_conflict","expression_ref":r,"expected_revision":expected,"current_revision":d.revision})))
    }
    pub fn selected_subject(&self, expression_ref: &str) -> Option<crate::refs::SemanticRef> {
        let d = self.documents.get(expression_ref)?;
        if let Some(relation) = d
            .selection
            .relation_ref
            .as_ref()
            .and_then(|r| d.relations.get(r))
        {
            return Some(crate::refs::SemanticRef {
                ref_id: relation.relation.r#ref.clone(),
                kind: "relation".into(),
                native_owner: relation
                    .native_owner
                    .clone()
                    .unwrap_or_else(|| "unknown".into()),
                provenance: crate::refs::RefProvenance {
                    source: relation.binding_ref.clone(),
                    revision: Some(relation.relation.revision.clone()),
                },
            });
        }
        let entity = d
            .selection
            .entity_ref
            .as_ref()
            .and_then(|r| d.entities.get(r));
        let binding = entity.and_then(|e| e.subject.as_ref());
        Some(crate::refs::SemanticRef {
            ref_id: binding
                .map(|b| b.subject_ref.clone())
                .unwrap_or_else(|| d.expression_ref.clone()),
            kind: if binding.is_some() {
                "subject"
            } else {
                "expression"
            }
            .into(),
            native_owner: binding
                .map(|b| b.native_owner.clone())
                .unwrap_or_else(|| "oi".into()),
            provenance: crate::refs::RefProvenance {
                source: d.expression_ref.clone(),
                revision: Some(d.revision.to_string()),
            },
        })
    }

    pub fn apply(
        &mut self,
        client: &CentralClient,
        request: Request,
    ) -> Result<(Value, Option<Changed>), String> {
        let mut changed = None;
        let result = match request {
            Request::Capabilities => capabilities(),
            Request::List => {
                // Most recently touched first — the recency the Library and
                // the Expressions panel present, now disclosed rather than
                // invented from ref order.
                let mut entries: Vec<&Document> = self.documents.values().collect();
                entries.sort_by_key(|d| {
                    std::cmp::Reverse(self.touched.get(&d.expression_ref).copied().unwrap_or(0))
                });
                json!({"schema":"oi.expression-list/v1","expressions":entries.iter().map(|d|json!({"expression_ref":d.expression_ref,"revision":d.revision,"title":d.title,"dirty":self.saved.get(&d.expression_ref)!=Some(&d.revision),"last_touched_unix":self.touched.get(&d.expression_ref).copied().unwrap_or(0)})).collect::<Vec<_>>()})
            }
            Request::Inspect { expression_ref } => self.inspect(&expression_ref)?,
            Request::Create {
                expression_ref,
                title,
                actor,
            } => {
                let d = Document {
                    presentation: None,
                    schema: SCHEMA.into(),
                    expression_ref: expression_ref.clone(),
                    revision: 1,
                    title,
                    scenes: vec![Scene {
                        presentation: None,
                        scene_ref: format!("{expression_ref}:scene:main"),
                        revision: 1,
                        title: "Main".into(),
                        entity_refs: vec![],
                        body: None,
                        triggers: vec![],
                    }],
                    entities: BTreeMap::new(),
                    relations: BTreeMap::new(),
                    selection: Selection {
                        scene_ref: format!("{expression_ref}:scene:main"),
                        entity_ref: None,
                        relation_ref: None,
                    },
                    provenance: vec![],
                    representations: vec![],
                    refinements: vec![],
                    collections: vec![],
                    profiles: vec![],
                    reuse: None,
                };
                return self.open(d, actor);
            }
            Request::Open { document, actor } => return self.open(*document, actor),
            Request::InspectFile {
                location,
                expected_file_revision,
            } => {
                text(&expected_file_revision)?;
                let file = files::read(client, &location)?;
                if file.revision != expected_file_revision {
                    return Ok((
                        json!({"state":"file_revision_conflict","expected_revision":expected_file_revision,"current_revision":file.revision}),
                        None,
                    ));
                }
                let document = crate::expression_file::decode(&file.content)?;
                return Ok((
                    json!({"state":"ready","document":document,"file":{"location":file.location,"revision":file.revision}}),
                    None,
                ));
            }
            Request::OpenFile {
                location,
                actor,
                expected_file_revision,
            } => {
                let file = files::read(client, &location)?;
                if let Some(expected) = expected_file_revision {
                    text(&expected)?;
                    if expected != file.revision {
                        return Ok((
                            json!({"state":"file_revision_conflict","expected_revision":expected,"current_revision":file.revision}),
                            None,
                        ));
                    }
                }
                let d = crate::expression_file::decode(&file.content)?;
                let r = d.expression_ref.clone();
                let revision = d.revision;
                let (mut value, event) = self.open(d, actor)?;
                if value["state"] != "ready" {
                    return Ok((value, event));
                }
                self.saved.insert(r.clone(), revision);
                value["dirty"] = json!(false);
                value["saved_revision"] = json!(revision);
                value["file"] = json!({"location":file.location,"revision":file.revision});
                self.file_bindings.insert(r, value["file"].clone());
                return Ok((value, event));
            }
            Request::Fork {
                expression_ref,
                expected_revision,
                new_expression_ref,
                actor,
            } => {
                if let Some(c) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((c, None));
                }
                id(&new_expression_ref, "expression:")?;
                let mut d = self.document(&expression_ref)?.clone();
                let map = |r: &str| format!("{}{}", new_expression_ref, &r[expression_ref.len()..]);
                // Remap only Expression-local refs; native subjects/Actions and
                // refs to *other* Expressions keep their exact identity.
                let local = |r: &str| -> Option<String> {
                    (r == expression_ref || r.starts_with(&format!("{expression_ref}:")))
                        .then(|| map(r))
                };
                d.provenance.push(ReadingRef {
                    r#ref: expression_ref.clone(),
                    revision: d.revision.to_string(),
                    availability: Availability::Available,
                });
                d.expression_ref = new_expression_ref.clone();
                d.revision = 1;
                for s in &mut d.scenes {
                    s.scene_ref = map(&s.scene_ref);
                    s.revision = 1;
                    s.entity_refs = s.entity_refs.iter().map(|r| map(r)).collect();
                    if let Some(body) = &mut s.body {
                        if let Some(recursion) = &mut body.recursion {
                            recursion.host_expression_ref = map(&recursion.host_expression_ref);
                        }
                        if body.carrier == crate::expression_carrier::CarrierKind::ExpressionRef {
                            if let Some(remapped) = local(&body.subject_ref) {
                                body.subject_ref = remapped;
                            }
                        }
                    }
                    for t in &mut s.triggers {
                        t.trigger_ref = map(&t.trigger_ref);
                        match &mut t.target {
                            crate::expression_trigger::TriggerTarget::ExpressionOperation {
                                expression_ref: referenced,
                                ..
                            } => {
                                if let Some(remapped) = local(referenced) {
                                    *referenced = remapped;
                                }
                            }
                            crate::expression_trigger::TriggerTarget::Portal {
                                subject_ref,
                                scene_ref,
                                ..
                            } => {
                                if let Some(remapped) = local(subject_ref) {
                                    *subject_ref = remapped;
                                }
                                if let Some(scene) = scene_ref {
                                    if let Some(remapped) = local(scene) {
                                        *scene = remapped;
                                    }
                                }
                            }
                            crate::expression_trigger::TriggerTarget::Navigate {
                                scene_ref,
                                entity_ref,
                            } => {
                                if let Some(scene) = scene_ref {
                                    if let Some(remapped) = local(scene) {
                                        *scene = remapped;
                                    }
                                }
                                if let Some(entity) = entity_ref {
                                    if let Some(remapped) = local(entity) {
                                        *entity = remapped;
                                    }
                                }
                            }
                            // Canonical native ActionRefs are never remapped.
                            crate::expression_trigger::TriggerTarget::NativeAction { .. } => {}
                        }
                    }
                }
                d.entities = d
                    .entities
                    .into_values()
                    .map(|mut e| {
                        e.entity_ref = map(&e.entity_ref);
                        e.revision = 1;
                        (e.entity_ref.clone(), e)
                    })
                    .collect();
                d.relations = d
                    .relations
                    .into_values()
                    .map(|mut r| {
                        r.binding_ref = map(&r.binding_ref);
                        r.from_entity_ref = map(&r.from_entity_ref);
                        r.to_entity_ref = map(&r.to_entity_ref);
                        (r.binding_ref.clone(), r)
                    })
                    .collect();
                for scene in &mut d.scenes {
                    if let Some(presentation) = &mut scene.presentation {
                        crate::expression_scene::fork(
                            presentation,
                            &expression_ref,
                            &new_expression_ref,
                        );
                    }
                }
                if let Some(presentation) = &mut d.presentation {
                    presentation.fork(&expression_ref, &new_expression_ref);
                }
                if let Some(reuse) = &mut d.reuse {
                    reuse.fork(&expression_ref, &new_expression_ref);
                }
                d.selection.scene_ref = map(&d.selection.scene_ref);
                d.selection.entity_ref = d.selection.entity_ref.map(|r| map(&r));
                d.selection.relation_ref = d.selection.relation_ref.map(|r| map(&r));
                d.representations.clear();
                d.refinements.clear();
                return self.open(d, actor);
            }
            Request::Edit {
                expression_ref,
                expected_revision,
                actor,
                changes,
            } => {
                text(&actor)?;
                if let Some(c) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((c, None));
                }
                if changes.len() > LIMIT {
                    return Err("Edit budget exceeded".into());
                }
                let before = self.document(&expression_ref)?;
                let d = before.edited(changes)?;
                if &d != before {
                    changed = Some(Changed {
                        expression_ref: expression_ref.clone(),
                        revision: d.revision,
                        actor,
                        activity_ref: None,
                    });
                    self.documents.insert(expression_ref.clone(), d);
                    self.touched.insert(expression_ref.clone(), unix_now());
                }
                self.inspect(&expression_ref)?
            }
            Request::Propose {
                expression_ref,
                expected_revision,
                proposal_ref,
                actor,
                activity_ref,
                continues_proposal_ref,
                summary,
                changes,
                method_refs,
                evidence_refs,
            } => {
                text(&actor)?;
                text(&summary)?;
                if let Some(value) = &activity_ref {
                    text(value)?;
                }
                if let Some(c) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((c, None));
                }
                if changes.is_empty() || changes.len() > LIMIT {
                    return Err("Proposal must contain a bounded change set".into());
                }
                readings(&method_refs)?;
                readings(&evidence_refs)?;
                id(&proposal_ref, &format!("{expression_ref}:proposal:"))?;
                let before = self.document(&expression_ref)?;
                if before
                    .refinements
                    .iter()
                    .any(|p| p.proposal_ref == proposal_ref)
                {
                    return Err("Proposal already exists".into());
                }
                if let Some(previous) = &continues_proposal_ref {
                    let previous = before
                        .refinements
                        .iter()
                        .find(|p| &p.proposal_ref == previous)
                        .ok_or("Continuation proposal is absent")?;
                    if previous.decision.is_none() {
                        return Err("Continue only after the prior proposal was reviewed".into());
                    }
                }
                // Validate the complete proposed edit against a clone. A proposal
                // that could not be applied to its stated basis never enters history.
                let mut candidate = before.clone();
                for change in changes.clone() {
                    candidate.change(change)?;
                }
                candidate.validate()?;
                let mut d = before.clone();
                d.revision = d.revision.checked_add(1).ok_or("Revision exhausted")?;
                d.refinements.push(Refinement {
                    proposal_ref: proposal_ref.clone(),
                    basis_revision: expected_revision,
                    proposed_by: actor.clone(),
                    activity_ref: activity_ref.clone(),
                    continues_proposal_ref,
                    summary,
                    changes,
                    method_refs,
                    evidence_refs,
                    decision: None,
                });
                d.validate()?;
                self.documents.insert(expression_ref.clone(), d);
                self.touched.insert(expression_ref.clone(), unix_now());
                changed = Some(Changed {
                    expression_ref: expression_ref.clone(),
                    revision: expected_revision + 1,
                    actor,
                    activity_ref,
                });
                self.inspect(&expression_ref)?
            }
            Request::Review {
                expression_ref,
                expected_revision,
                proposal_ref,
                actor,
                decision,
                reason,
                corrections,
            } => {
                text(&actor)?;
                text(&reason)?;
                if !matches!(
                    decision,
                    RefinementState::Accepted | RefinementState::Rejected
                ) {
                    return Err("Review decision must be accepted or rejected".into());
                }
                if corrections.len() > LIMIT {
                    return Err("Correction budget exceeded".into());
                }
                if decision == RefinementState::Rejected && !corrections.is_empty() {
                    return Err("Rejected proposals cannot apply corrections".into());
                }
                if let Some(c) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((c, None));
                }
                let before = self.document(&expression_ref)?;
                let index = before
                    .refinements
                    .iter()
                    .position(|p| p.proposal_ref == proposal_ref)
                    .ok_or("Proposal is absent")?;
                if before.refinements[index].decision.is_some() {
                    return Err("Proposal was already reviewed".into());
                }
                let proposal = before.refinements[index].clone();
                if decision == RefinementState::Accepted
                    && expected_revision != proposal.basis_revision + 1
                {
                    return Ok((
                        json!({"state":"proposal_basis_conflict","expression_ref":expression_ref,"proposal_ref":proposal_ref,"proposal_basis_revision":proposal.basis_revision,"current_revision":expected_revision,"detail":"The Expression changed after this proposal; reject it or submit a continuation against the current revision"}),
                        None,
                    ));
                }
                let mut d = before.clone();
                if decision == RefinementState::Accepted {
                    for change in proposal
                        .changes
                        .iter()
                        .cloned()
                        .chain(corrections.iter().cloned())
                    {
                        d.change(change)?;
                    }
                }
                d.revision = d.revision.checked_add(1).ok_or("Revision exhausted")?;
                if decision == RefinementState::Accepted {
                    for entity in d.entities.values_mut() {
                        if before.entities.get(&entity.entity_ref) != Some(entity) {
                            entity.revision = d.revision;
                        }
                    }
                    for scene in &mut d.scenes {
                        if before
                            .scenes
                            .iter()
                            .find(|old| old.scene_ref == scene.scene_ref)
                            != Some(scene)
                        {
                            scene.revision = d.revision;
                        }
                    }
                }
                d.refinements[index].decision = Some(RefinementDecision {
                    state: decision,
                    actor: actor.clone(),
                    reason,
                    decided_at_revision: d.revision,
                    corrections,
                });
                d.validate()?;
                self.documents.insert(expression_ref.clone(), d);
                self.touched.insert(expression_ref.clone(), unix_now());
                changed = Some(Changed {
                    expression_ref: expression_ref.clone(),
                    revision: expected_revision + 1,
                    actor,
                    activity_ref: None,
                });
                self.inspect(&expression_ref)?
            }
            Request::Export {
                expression_ref,
                expected_revision,
            } => {
                if let Some(c) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((c, None));
                }
                json!({"state":"exported","audience":"local_private","document":self.document(&expression_ref)?,"dynamic_checkpoint":false})
            }
            Request::SaveAs {
                expression_ref,
                expected_revision,
                parent,
                name,
                operation_ref,
                actor,
                actor_kind,
            } => {
                text(&actor)?;
                text(&operation_ref)?;
                if !["human", "agent"].contains(&actor_kind.as_str()) {
                    return Err("actor_kind must be human or agent".into());
                }
                if let Some(conflict) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((conflict, None));
                }
                let document = self.document(&expression_ref)?.clone();
                let content = crate::expression_file::encode(&document)?;
                // The explicit directory already supplies root identity. Suppress the
                // generic project fallback before the strict file-owner call.
                match client.run("central.files.create", json!({"project":null,"parent":parent,"name":name,"content":content,
                    "expected_absent":true,"operation_ref":operation_ref,"actor":actor,"actor_kind":actor_kind})) {
                    Ok(data) if data["schema"]=="central.file-mutation/v1" && matches!(data["outcome"].as_str(), Some("created"|"unchanged")) => {
                        match serde_json::from_value::<files::Location>(data["location"].clone()) {
                            Ok(location) => self.accept_saved(client, &document, location, "central.files.create", data),
                            Err(error) => json!({"state":"saved_readback_failed","persisted":true,"owner_operation":"central.files.create","data":data,"error":error.to_string()}),
                        }
                    },
                    Ok(data) => json!({"state":"save_refused","owner_operation":"central.files.create","data":data}),
                    Err(error) => json!({"state":"save_refused","owner_operation":"central.files.create","failure":error}),
                }
            }
            Request::Save {
                expression_ref,
                expected_revision,
                location,
                expected_file_revision,
                actor,
                actor_kind,
            } => {
                if !["human", "agent"].contains(&actor_kind.as_str()) {
                    return Err("actor_kind must be human or agent".into());
                }
                text(&actor)?;
                if let Some(c) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((c, None));
                }
                let current = files::read(client, &location)?;
                if current.revision != expected_file_revision {
                    return Ok((
                        json!({"state":"file_revision_conflict","expected_revision":expected_file_revision,"current_revision":current.revision}),
                        None,
                    ));
                }
                // Protect other ordinary material from an accidental Expression save target.
                let original =
                    crate::expression_file::decode(&current.content).map_err(|error| {
                        format!("Save destination is not an Expression file: {error}")
                    })?;
                if original.expression_ref != expression_ref {
                    return Err("Save destination belongs to another Expression".into());
                }
                let result=client.run("central.files.write",json!({"location":location,"expected_revision":expected_file_revision,"content":crate::expression_file::encode(self.document(&expression_ref)?)?,"actor":actor,"actor_kind":actor_kind}));
                match result {
                    Ok(data) => {
                        // Central can refuse CAS in a successful protocol response.
                        // Never equate transport success with a committed write.
                        if data["outcome"] == "conflict" {
                            json!({"state":"file_revision_conflict","owner_operation":"central.files.write","data":data})
                        } else if data["schema"] == "central.file-mutation/v1"
                            && matches!(data["outcome"].as_str(), Some("written" | "unchanged"))
                            && data["revision"].as_str().is_some_and(|r| !r.is_empty())
                        {
                            let document = self.document(&expression_ref)?.clone();
                            self.accept_saved(
                                client,
                                &document,
                                location,
                                "central.files.write",
                                data,
                            )
                        } else {
                            json!({"state":"save_refused","owner_operation":"central.files.write","data":data})
                        }
                    }
                    Err(error) => {
                        json!({"state":"save_refused","owner_operation":"central.files.write","failure":error})
                    }
                }
            }
            Request::Invoke {
                expression_ref,
                expected_revision,
                entity_ref,
                action_ref,
                input,
                project,
            } => {
                if let Some(c) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((c, None));
                }
                let d = self.document(&expression_ref)?;
                let binding = d
                    .entities
                    .get(&entity_ref)
                    .and_then(|e| e.subject.as_ref())
                    .ok_or("Entity has no native subject")?;
                if binding
                    .readings
                    .iter()
                    .chain(&binding.sources)
                    .any(|r| r.availability != Availability::Available)
                {
                    return Ok((
                        json!({"state":"binding_unavailable","detail":"Refresh stale/unavailable/withheld owner readings before invoking"}),
                        None,
                    ));
                }
                let disclosed = binding
                    .actions
                    .iter()
                    .find(|a| a.action_ref == action_ref)
                    .ok_or("Action is not disclosed on this subject")?;
                let root = world::read_world(client).map_err(|e| e.to_string())?;
                let base = root["root"].as_str().ok_or("Central root unavailable")?;
                let cwd = if let Some(p) = &project {
                    let row = root["work"]["projects"]
                        .as_array()
                        .and_then(|rows| rows.iter().find(|r| r["name"].as_str() == Some(p)))
                        .ok_or("Project is outside Central's disclosed ground")?;
                    std::path::Path::new(base)
                        .join(row["path"].as_str().ok_or("Project location unavailable")?)
                } else {
                    std::path::PathBuf::from(base)
                };
                let dispatch = action::invoke(
                    client,
                    &cwd,
                    project.as_deref(),
                    &action::ActionInvocation {
                        action: disclosed.action_ref.clone(),
                        target_ref: disclosed.target_ref.clone(),
                        input,
                    },
                );
                json!({"state":"action_result","action_ref":action_ref,"target_ref":binding.subject_ref,"dispatch":dispatch})
            }
            // ——— Substrate requests (O:I #352). Registry operations over
            // profiles/editions/assets: they return their full resulting
            // state and emit no expression_changed receipt, because they
            // never change an Expression document. ———
            Request::ProfileDefineMany { definitions } => {
                self.profile_definition_batch_reply_budget(client, &definitions)?;
                let mut profiles = Vec::new();
                for (index, request) in profile_definition_requests(&definitions)?
                    .into_iter()
                    .enumerate()
                {
                    let (value, _) = self.apply(client, request).map_err(|error|
                        format!("Profile definition {} refused after {index} admitted definitions: {error}", index + 1))?;
                    profiles.push(value);
                }
                json!({"state":"profiles","profiles":profiles})
            }
            Request::ProfileDefine { profile, actor } => {
                text(&actor)?;
                profile.validate()?;
                for parent in &profile.parent_profile_refs {
                    if !self.profiles.contains_key(parent) {
                        return Err(format!("Parent profile {parent} is not defined"));
                    }
                }
                if let Some(existing) = self.profiles.get(&profile.profile_ref) {
                    if profile.revision < existing.revision {
                        return Err("Profile revisions are monotonic per ref".into());
                    }
                    if profile.revision == existing.revision && &profile != existing {
                        return Err("A profile revision cannot name different content".into());
                    }
                } else if self.profiles.len() >= PROFILE_CATALOG_COUNT {
                    return Err(format!(
                        "Profile catalog count budget exceeded ({}/{PROFILE_CATALOG_COUNT})",
                        self.profiles.len()
                    ));
                }
                // Admit before cloning the candidate catalog. Replacement
                // subtracts its old value; exact replay consumes no new bytes.
                // Commit accounting only after every lineage validates.
                let old_bytes = self
                    .profiles
                    .get(&profile.profile_ref)
                    .map(|old| {
                        serde_json::to_vec(old)
                            .map(|bytes| bytes.len())
                            .map_err(|e| e.to_string())
                    })
                    .transpose()?
                    .unwrap_or(0);
                let new_bytes = serde_json::to_vec(&profile)
                    .map_err(|e| e.to_string())?
                    .len();
                let candidate_bytes = self
                    .profile_bytes
                    .checked_sub(old_bytes)
                    .and_then(|bytes| bytes.checked_add(new_bytes))
                    .ok_or("Profile catalog byte accounting overflow")?;
                if candidate_bytes > PROFILE_CATALOG_BYTES {
                    return Err(format!(
                        "Profile catalog byte budget exceeded ({candidate_bytes}/{PROFILE_CATALOG_BYTES})"
                    ));
                }
                // Refused lineage changes must not leave an invalid profile
                // behind in the owner's live registry.
                let mut candidate = self.profiles.clone();
                candidate.insert(profile.profile_ref.clone(), profile.clone());
                let resolved =
                    crate::expression_profile::resolve_lineage(&candidate, &profile.profile_ref)?;
                for reference in candidate.keys() {
                    crate::expression_profile::resolve_lineage(&candidate, reference)?;
                }
                self.profiles = candidate;
                self.profile_bytes = candidate_bytes;
                json!({"state":"profile","profile":profile,"resolved_defaults":resolved})
            }
            Request::ProfileInspect { profile_ref } => {
                let profile = self
                    .profiles
                    .get(&profile_ref)
                    .ok_or("Profile is not defined")?;
                let resolved =
                    crate::expression_profile::resolve_lineage(&self.profiles, &profile_ref)?;
                json!({"state":"profile","profile":profile,"resolved_defaults":resolved})
            }
            Request::ProfileResolve {
                native_owner,
                carrier,
            } => {
                text(&native_owner)?;
                let admitted = self
                    .profiles
                    .values()
                    .find(|p| p.admits(&native_owner, carrier));
                match admitted {
                    Some(profile) => {
                        json!({"state":"resolved","profile_ref":profile.profile_ref,"revision":profile.revision})
                    }
                    None => {
                        json!({"state":"unresolved","detail":"No defined profile admits this subject kind"})
                    }
                }
            }
            Request::EditionCreate { edition, actor } => {
                text(&actor)?;
                edition.validate()?;
                // The edition names an open Expression's current revision, so
                // the portable relation is truthful at creation.
                let current = self.document(&edition.expression_ref)?.revision;
                if current != edition.expression_revision {
                    return Err(
                        "An edition must name the current revision of an open Expression".into(),
                    );
                }
                if let Some(profile_ref) = &edition.profile_ref {
                    let profile = self
                        .profiles
                        .get(profile_ref)
                        .ok_or("Edition names an undefined profile")?;
                    if Some(profile.revision) != edition.profile_revision {
                        return Err("Edition must record the profile's current revision".into());
                    }
                }
                if let Some(existing) = self.editions.get(&edition.edition_ref) {
                    if edition.revision < existing.revision {
                        return Err("Edition revisions are monotonic per ref".into());
                    }
                } else if self.editions.len() >= 64 {
                    return Err("Edition budget exceeded".into());
                }
                self.editions
                    .insert(edition.edition_ref.clone(), edition.clone());
                json!({"state":"edition","edition":edition,"expression_opened":false})
            }
            Request::EditionInspect { edition_ref } => {
                let edition = self
                    .editions
                    .get(&edition_ref)
                    .ok_or("Edition is not defined")?;
                // Re-opening an edition never opens or rewrites the Expression.
                json!({"state":"edition","edition":edition,"expression_opened":false})
            }
            Request::Index => {
                let mut collections: BTreeMap<String, Vec<String>> = BTreeMap::new();
                for d in self.documents.values() {
                    for collection in &d.collections {
                        collections
                            .entry(collection.clone())
                            .or_default()
                            .push(d.expression_ref.clone());
                    }
                }
                json!({
                    "schema":"oi.expression-index/v1",
                    "expressions":self.documents.values().map(|d|json!({
                        "expression_ref":d.expression_ref,
                        "revision":d.revision,
                        "title":d.title,
                        "collections":d.collections,
                        "profiles":d.profiles.iter().map(|p|json!({"profile_ref":p.profile_ref,"revision":p.revision})).collect::<Vec<_>>(),
                    })).collect::<Vec<_>>(),
                    "collections":collections,
                    "profiles":self.profiles.values().map(|p|json!({"profile_ref":p.profile_ref,"revision":p.revision,"title":p.title})).collect::<Vec<_>>(),
                    "editions":self.editions.values().map(|e|json!({"edition_ref":e.edition_ref,"revision":e.revision,"expression_ref":e.expression_ref,"expression_revision":e.expression_revision})).collect::<Vec<_>>(),
                })
            }
            Request::AssetAdmit { asset, actor } => {
                let open_revisions: BTreeMap<String, u64> = self
                    .documents
                    .iter()
                    .map(|(r, d)| (r.clone(), d.revision))
                    .collect();
                self.assets.admit(asset, &open_revisions, &actor)?
            }
            Request::AssetTraverse { asset_ref } => self.assets.traverse(&asset_ref)?,
            Request::AssetSubject { subject_ref } => self.assets.for_subject(&subject_ref),
            Request::Close {
                expression_ref,
                actor,
            } => {
                text(&actor)?;
                let revision = self.document(&expression_ref)?.revision;
                let saved = self.saved.get(&expression_ref).copied();
                if saved != Some(revision) {
                    return Ok((
                        json!({"state":"dirty","expression_ref":expression_ref,"revision":revision,"saved_revision":saved,
                        "detail":"The Expression has unsaved work; save it before closing (close never discards work)"}),
                        None,
                    ));
                }
                self.documents.remove(&expression_ref);
                self.saved.remove(&expression_ref);
                self.touched.remove(&expression_ref);
                let file = self.file_bindings.remove(&expression_ref);
                json!({"state":"closed","expression_ref":expression_ref,"revision":revision,"file":file})
            }
            // --- expression_world (ES4) addition, lane aikit/es-one-state-relation ---
            Request::Restore {
                expression_ref,
                expected_revision,
                document,
                actor,
            } => {
                text(&actor)?;
                if let Some(c) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((c, None));
                }
                if document.expression_ref != expression_ref {
                    return Err("Restore document belongs to another Expression".into());
                }
                if document.revision > expected_revision {
                    return Err("Restore document is not behind the current draft".into());
                }
                let mut d = *document;
                d.revision = d.revision.checked_add(1).ok_or("Revision exhausted")?;
                while d.revision <= expected_revision {
                    // Stay strictly ahead of the draft the checkpoint returns over.
                    d.revision = d.revision.checked_add(1).ok_or("Revision exhausted")?;
                }
                // A checkpoint whose content already matches the current draft
                // restores nothing — content equality, revisions normalised.
                {
                    let mut restored = d.clone();
                    restored.revision = expected_revision;
                    let mut current = self.document(&expression_ref)?.clone();
                    current.revision = expected_revision;
                    if restored == current {
                        return Ok((self.inspect(&expression_ref)?, None));
                    }
                }
                d.validate()?;
                changed = Some(Changed {
                    expression_ref: expression_ref.clone(),
                    revision: d.revision,
                    actor,
                    activity_ref: None,
                });
                self.documents.insert(expression_ref.clone(), d);
                self.touched.insert(expression_ref.clone(), unix_now());
                self.inspect(&expression_ref)?
            }
        };
        Ok((result, changed))
    }
    /// A native save receipt is not readback. Keep acknowledged effects legible
    /// on a lost read; never replay the write or mark a different revision saved.
    fn accept_saved(
        &mut self,
        client: &CentralClient,
        document: &Document,
        location: files::Location,
        operation: &str,
        data: Value,
    ) -> Value {
        let file = json!({"location":location,"revision":data["revision"]});
        let proof = (|| -> Result<(), String> {
            let current = files::read(client, &location)?;
            if data["revision"] != current.revision {
                return Err("Native source changed before readback".into());
            }
            let read = crate::expression_file::decode(&current.content)?;
            if &read != document {
                return Err("Native readback differs from the saved Expression".into());
            }
            Ok(())
        })();
        match proof {
            Ok(()) => {
                self.saved
                    .insert(document.expression_ref.clone(), document.revision);
                self.file_bindings
                    .insert(document.expression_ref.clone(), file.clone());
                json!({"state":"saved","persisted":true,"readback_verified":true,"owner_operation":operation,"data":data,"expression_revision":document.revision,"file":file})
            }
            Err(error) => {
                json!({"state":"saved_readback_failed","persisted":true,"readback_verified":false,"owner_operation":operation,"data":data,"expression_revision":document.revision,"file":file,"error":error})
            }
        }
    }
    fn open(&mut self, d: Document, actor: String) -> Result<(Value, Option<Changed>), String> {
        text(&actor)?;
        d.validate()?;
        if let Some(existing) = self.documents.get(&d.expression_ref) {
            if existing == &d {
                return Ok((self.inspect(&d.expression_ref)?, None));
            }
            return Ok((
                json!({"state":"revision_conflict","expression_ref":d.expression_ref,"current_revision":existing.revision,"detail":"An open draft is never replaced implicitly"}),
                None,
            ));
        }
        if self.documents.len() >= 64 {
            return Err("Open Expression budget exceeded".into());
        }
        let event = Changed {
            expression_ref: d.expression_ref.clone(),
            revision: d.revision,
            actor,
            activity_ref: None,
        };
        let touched_ref = d.expression_ref.clone();
        self.documents.insert(touched_ref.clone(), d);
        self.touched.insert(touched_ref, unix_now());
        Ok((self.inspect(&event.expression_ref)?, Some(event)))
    }
}

#[cfg(test)]
mod close_tests {
    use super::*;

    #[test]
    fn reviewed_focus_commits_both_revisions_or_preserves_the_document() {
        let client = CentralClient::discover();
        let mut app = Application::default();
        let decode = |v: Value| serde_json::from_value::<Request>(v).unwrap();
        app.apply(&client, decode(json!({"operation":"create","expression_ref":"expression:review","title":"Review","actor":"human:test"}))).unwrap();
        app.apply(&client, decode(json!({"operation":"edit","expression_ref":"expression:review","expected_revision":1,"actor":"human:test","changes":[{"change":"entity_add","scene_ref":"expression:review:scene:main","entity_ref":"expression:review:entity:a","title":"Selected subject"}]}))).unwrap();
        let before = app.document("expression:review").unwrap().clone();
        let proposal = |target: &str| {
            decode(
                json!({"operation":"propose","expression_ref":"expression:review","expected_revision":2,"proposal_ref":"expression:review:proposal:inquiry","actor":"agent-session:epii","activity_ref":"agent-session:epii#answer","summary":"Focus the cited subject","changes":[{"change":"focus","scene_ref":"expression:review:scene:main","entity_ref":target}],"method_refs":[],"evidence_refs":[]}),
            )
        };
        for (target, reason) in [
            ("expression:review:entity:absent", "Reviewed"),
            ("expression:review:entity:a", ""),
        ] {
            assert!(app
                .apply_reviewed_focus(
                    &client,
                    proposal(target),
                    "human:test".into(),
                    reason.into()
                )
                .is_err());
            assert_eq!(
                serde_json::to_value(app.document("expression:review").unwrap()).unwrap(),
                serde_json::to_value(&before).unwrap(),
                "a failed acceptance must not leave an unreviewed proposal"
            );
        }
        let (accepted, changes) = app
            .apply_reviewed_focus(
                &client,
                proposal("expression:review:entity:a"),
                "human:test".into(),
                "Reviewed the source and selected this subject".into(),
            )
            .unwrap();
        assert_eq!(
            changes.iter().map(|c| c.revision).collect::<Vec<_>>(),
            vec![3, 4]
        );
        assert_eq!(accepted["document"]["revision"], 4);
        assert_eq!(
            accepted["document"]["selection"]["entity_ref"],
            "expression:review:entity:a"
        );
        assert_eq!(
            accepted["document"]["entities"],
            serde_json::to_value(&before).unwrap()["entities"]
        );
        assert!(app
            .apply_reviewed_focus(
                &client,
                proposal("expression:review:entity:a"),
                "human:test".into(),
                "Repeated".into()
            )
            .is_err());
        assert_eq!(app.document("expression:review").unwrap().revision, 4);
    }

    #[test]
    fn close_refuses_unsaved_work_and_frees_a_saved_slot() {
        let client = CentralClient::with("/nonexistent/oi".into(), None, String::new());
        let mut app = Application::default();
        let create = |r: &str| Request::Create {
            expression_ref: r.into(),
            title: "T".into(),
            actor: "a".into(),
        };
        let close = |r: &str| Request::Close {
            expression_ref: r.into(),
            actor: "a".into(),
        };
        app.apply(&client, create("expression:c")).unwrap();
        let (dirty, _) = app.apply(&client, close("expression:c")).unwrap();
        assert_eq!(dirty["state"], "dirty", "never-saved work is kept");
        assert!(app.document("expression:c").is_ok());
        // Saved at its current revision (as save/save_as/open_file record it).
        app.saved.insert("expression:c".into(), 1);
        let (closed, changed) = app.apply(&client, close("expression:c")).unwrap();
        assert_eq!(closed["state"], "closed");
        assert!(changed.is_none());
        assert!(app.document("expression:c").is_err(), "the slot is free");
        assert!(
            app.apply(&client, close("expression:c")).is_err(),
            "closing an unknown Expression is an error"
        );
        // Edited after its save: dirty again.
        app.apply(&client, create("expression:d")).unwrap();
        app.saved.insert("expression:d".into(), 1);
        app.apply(
            &client,
            Request::Edit {
                expression_ref: "expression:d".into(),
                expected_revision: 1,
                actor: "a".into(),
                changes: vec![Change::Rename { title: "U".into() }],
            },
        )
        .unwrap();
        assert_eq!(
            app.apply(&client, close("expression:d")).unwrap().0["state"],
            "dirty"
        );
        assert!(capabilities()["operations"]
            .as_array()
            .unwrap()
            .contains(&json!("close")));
    }
}
