//! Expression application state. Only presentation drafts live here; all native
//! subjects and Actions are references. Both native input faces use this service.
use crate::{action, files, flow::CentralClient, world};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

pub const SCHEMA: &str = "oi.expression/v1";
pub(crate) const LIMIT: usize = 256;
pub(crate) const MAX_REVISION: u64 = 9_007_199_254_740_991;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Availability {
    Available,
    Unavailable,
    Withheld,
    Stale,
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
    pub min: f64,
    pub max: f64,
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
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Entity {
    pub entity_ref: String,
    pub revision: u64,
    pub title: String,
    pub subject: Option<SubjectBinding>,
    pub parameters: BTreeMap<String, Parameter>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Scene {
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
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "change", rename_all = "snake_case", deny_unknown_fields)]
pub enum Change {
    SceneCreate {
        scene_ref: String,
        title: String,
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
        document: Document,
        actor: String,
    },
    OpenFile {
        location: files::Location,
        actor: String,
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
    file_bindings: BTreeMap<String, Value>,
    /// ES3 reusable presentation profiles, keyed by profile_ref.
    profiles: BTreeMap<String, crate::expression_profile::ExpressionProfile>,
    /// ES3 portable editions, keyed by edition_ref.
    editions: BTreeMap<String, crate::expression_profile::ExpressionEdition>,
    /// ES3A admission + occurrence index over real asset use.
    assets: crate::expression_asset::AssetIndex,
}

pub fn capabilities() -> Value {
    json!({"schema":"oi.expression-capabilities/v1", "document_schema":SCHEMA,
        "operations":["capabilities","list","inspect","create","open","open_file","fork","edit","propose","review","export","save","invoke",
            "profile_define","profile_inspect","profile_resolve","edition_create","edition_inspect","index","asset_admit","asset_traverse","asset_subject"],
        "changes":["scene_create","scene_reorder","scene_compose","entity_add","entity_remove","subject_bind","subject_unbind","relation_bind","relation_remove","focus","parameter_set","parameter_automate","parameter_manual","representation_bind",
            "scene_body_set","scene_body_clear","scene_trigger_attach","scene_trigger_detach","profile_adopt","profile_release","collections_set"],
        "parameters":{"glyph":{"type":"string","max_length":128},"x":{"min":-1600,"max":1600},"y":{"min":-1600,"max":1600},"z":{"min":-1600,"max":1600},"scale":{"min":0.05,"max":4},"share":{"min":0,"max":1}},
        "automation":{"type":"lfo","waveforms":["sine","triangle","square","saw"],"rate_hz":{"min":0.001,"max":10},"clock_owner":"accepted Expressions engine"},
        "scene_body":{"carriers":["engine_composition","text_source","glyph_form","image_media","file_thing","knowledge_whole","html_surface","agent_surface","expression_ref"],
            "presentations":["live","inline","preview","degraded"],
            "law":"scene bodies reference native subjects through existing refs/adapters, never copied semantic objects; unsupported types degrade honestly to a bound Thing/preview carrying the real native open Action; no bespoke renderer per format",
            "live_render_admitted":["engine_composition"]},
        "triggers":{"occasions":["scene_enter","scene_leave","activate","select","sequence_transition"],
            "targets":["expression_operation","portal","native_action","navigate"],
            "expression_operations":["inspect","list","export"],
            "portal_placements":["preview","overlay","beside","full","detached","re-dock"],
            "script_bodies":"refused"},
        "profiles":{"ref_prefix":"profile:","lineage":"parents must be defined first; defaults resolve parents-first and overrides stay legible","budget":64},
        "editions":{"ref_prefix":"edition:","law":"an edition re-opens as a reading; it never opens or rewrites the Expression","budget":64},
        "assets":{"ref_prefix":"asset:","law":"admission + occurrence index over real use, not an advance procurement catalogue or a second semantic store","traversals":["asset_ref→uses","subject_ref→assets"],"budget":256},
        "collections":{"law":"Library-as-view: Expressions stay addressable by ref; the Library is one collection/index reading over the same refs"},
        "refinement":{"review_required":true,"decisions":["accepted","rejected"],"activity_ref_authenticates":false,"retained_on_export":true},
        "pedagogy":{"material":["scenes","source-bearing entities","movement","optional text","methods","evidence"],"chat_only":false},
        "save_owner":"central.files.write", "source_mutation":false, "attribution_is_authentication":false,
        "export_audience":"local_private", "dynamic_checkpoint":false,
        "unsupported":["capture","page_embed","projection_publish","domain_state_write","knowledge_query",
            "portal_runtime_open_close","scene_body_live_render_beyond_engine_composition","asset_binary_storage"],
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
        "share" => Some((0., 1.)),
        _ => None,
    }
}
pub(crate) fn parameter(key: &str, p: &Parameter) -> Result<(), String> {
    if key == "glyph" {
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
    pub fn validate(&self) -> Result<(), String> {
        if serde_json::to_vec(self).map_err(|e| e.to_string())?.len() > 512 * 1024 {
            return Err("Expression document exceeds 512 KiB".into());
        }
        if self.schema != SCHEMA || self.revision == 0 || self.revision > MAX_REVISION {
            return Err("Unsupported document schema/revision".into());
        }
        id(&self.expression_ref, "expression:")?;
        text(&self.title)?;
        readings(&self.provenance)?;
        if self.scenes.is_empty()
            || self.scenes.len() > 64
            || self.entities.len() > LIMIT
            || self.relations.len() > LIMIT
            || self.representations.len() > LIMIT
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
                || s.entity_refs.len() > 10
                || s.entity_refs.iter().any(|r| !self.entities.contains_key(r))
            {
                return Err("Scene contains duplicate, missing or too many entities".into());
            }
            if let Some(body) = &s.body {
                crate::expression_carrier::validate_body(body, &self.expression_ref)?;
            }
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
            Change::SceneCreate { scene_ref, title } => {
                if self.scenes.iter().any(|s| s.scene_ref == scene_ref) {
                    return Err("Scene already exists".into());
                }
                self.scenes.push(Scene {
                    scene_ref,
                    revision: self.revision,
                    title,
                    entity_refs: vec![],
                    body: None,
                    triggers: vec![],
                });
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
            } => self.scene(&scene_ref)?.entity_refs = entity_refs,
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
                    },
                );
            }
            Change::EntityRemove { entity_ref } => {
                if self.entities.remove(&entity_ref).is_none() {
                    return Err("Entity is absent".into());
                }
                for s in &mut self.scenes {
                    s.entity_refs.retain(|r| r != &entity_ref);
                }
                self.relations.retain(|_, r| {
                    r.from_entity_ref != entity_ref && r.to_entity_ref != entity_ref
                });
                if self.selection.entity_ref.as_ref() == Some(&entity_ref) {
                    self.selection.entity_ref = None;
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
            }
            Change::Focus {
                scene_ref,
                entity_ref,
            } => {
                self.selection = Selection {
                    scene_ref,
                    entity_ref,
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
                    key,
                    Parameter {
                        value,
                        automation: None,
                    },
                );
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
                    if scene.triggers.iter().any(|t| t.trigger_ref == trigger.trigger_ref) {
                        return Err("Scene trigger already exists".into());
                    }
                    if scene.triggers.len()
                        >= crate::expression_trigger::MAX_TRIGGERS_PER_SCENE
                    {
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
                self.profiles.retain(|p| p.profile_ref != adoption.profile_ref);
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
        }
        Ok(())
    }
}
impl Application {
    fn document(&self, r: &str) -> Result<&Document, String> {
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
                json!({"schema":"oi.expression-list/v1","expressions":self.documents.values().map(|d|json!({"expression_ref":d.expression_ref,"revision":d.revision,"title":d.title,"dirty":self.saved.get(&d.expression_ref)!=Some(&d.revision)})).collect::<Vec<_>>()})
            }
            Request::Inspect { expression_ref } => self.inspect(&expression_ref)?,
            Request::Create {
                expression_ref,
                title,
                actor,
            } => {
                let d = Document {
                    schema: SCHEMA.into(),
                    expression_ref: expression_ref.clone(),
                    revision: 1,
                    title,
                    scenes: vec![Scene {
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
                    },
                    provenance: vec![],
                    representations: vec![],
                    refinements: vec![],
                    collections: vec![],
                    profiles: vec![],
                };
                return self.open(d, actor);
            }
            Request::Open { document, actor } => return self.open(document, actor),
            Request::OpenFile { location, actor } => {
                let file = files::read(client, &location)?;
                let d: Document = serde_json::from_str(&file.content)
                    .map_err(|e| format!("Invalid Expression file: {e}"))?;
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
                            crate::expression_trigger::TriggerTarget::ExpressionOperation { expression_ref: referenced, .. } => {
                                if let Some(remapped) = local(referenced) {
                                    *referenced = remapped;
                                }
                            }
                            crate::expression_trigger::TriggerTarget::Portal { subject_ref, scene_ref, .. } => {
                                if let Some(remapped) = local(subject_ref) {
                                    *subject_ref = remapped;
                                }
                                if let Some(scene) = scene_ref {
                                    if let Some(remapped) = local(scene) {
                                        *scene = remapped;
                                    }
                                }
                            }
                            crate::expression_trigger::TriggerTarget::Navigate { scene_ref, entity_ref } => {
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
                d.selection.scene_ref = map(&d.selection.scene_ref);
                d.selection.entity_ref = d.selection.entity_ref.map(|r| map(&r));
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
                let mut d = before.clone();
                for c in changes {
                    d.change(c)?;
                }
                d.validate()?;
                if &d != before {
                    d.revision = d.revision.checked_add(1).ok_or("Revision exhausted")?;
                    for e in d.entities.values_mut() {
                        if before.entities.get(&e.entity_ref) != Some(e) {
                            e.revision = d.revision;
                        }
                    }
                    for s in &mut d.scenes {
                        if before
                            .scenes
                            .iter()
                            .find(|old| old.scene_ref == s.scene_ref)
                            != Some(s)
                        {
                            s.revision = d.revision;
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
                let original: Document = serde_json::from_str(&current.content)
                    .map_err(|_| "Save destination is not an Expression file")?;
                original.validate()?;
                if original.expression_ref != expression_ref {
                    return Err("Save destination belongs to another Expression".into());
                }
                let result=client.run("central.files.write",json!({"location":location,"expected_revision":expected_file_revision,"content":serde_json::to_string_pretty(self.document(&expression_ref)?).map_err(|e|e.to_string())?,"actor":actor,"actor_kind":actor_kind}));
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
                            self.saved.insert(expression_ref.clone(), expected_revision);
                            let file = json!({"location":location,"revision":data["revision"]});
                            self.file_bindings.insert(expression_ref, file.clone());
                            json!({"state":"saved","owner_operation":"central.files.write","data":data,"expression_revision":expected_revision,"file":file})
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
                } else if self.profiles.len() >= 64 {
                    return Err("Profile budget exceeded".into());
                }
                self.profiles.insert(profile.profile_ref.clone(), profile.clone());
                let resolved = crate::expression_profile::resolve_lineage(
                    &self.profiles,
                    &profile.profile_ref,
                )?;
                json!({"state":"profile","profile":profile,"resolved_defaults":resolved})
            }
            Request::ProfileInspect { profile_ref } => {
                let profile = self
                    .profiles
                    .get(&profile_ref)
                    .ok_or("Profile is not defined")?;
                let resolved = crate::expression_profile::resolve_lineage(
                    &self.profiles,
                    &profile_ref,
                )?;
                json!({"state":"profile","profile":profile,"resolved_defaults":resolved})
            }
            Request::ProfileResolve { native_owner, carrier } => {
                text(&native_owner)?;
                let admitted = self
                    .profiles
                    .values()
                    .find(|p| p.admits(&native_owner, carrier));
                match admitted {
                    Some(profile) => json!({"state":"resolved","profile_ref":profile.profile_ref,"revision":profile.revision}),
                    None => json!({"state":"unresolved","detail":"No defined profile admits this subject kind"}),
                }
            }
            Request::EditionCreate { edition, actor } => {
                text(&actor)?;
                edition.validate()?;
                // The edition names an open Expression's current revision, so
                // the portable relation is truthful at creation.
                let current = self.document(&edition.expression_ref)?.revision;
                if current != edition.expression_revision {
                    return Err("An edition must name the current revision of an open Expression".into());
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
                self.editions.insert(edition.edition_ref.clone(), edition.clone());
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
        };
        Ok((result, changed))
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
        self.documents.insert(d.expression_ref.clone(), d);
        Ok((self.inspect(&event.expression_ref)?, Some(event)))
    }
}
