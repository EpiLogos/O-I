//! ES1B declarative scene triggers (O:I #352). A trigger points only to an
//! `oi.expression/v1` operation, a SurfacePortal placement, a canonical native
//! ActionRef, or a focus/selection/navigation operation over exact refs.
//! Arbitrary executable script bodies are refused with a typed error — both
//! here and structurally, because every type in this module is
//! `deny_unknown_fields`, so a script body cannot even enter a document.
use crate::expression::{text, id, Document};
use serde::{Deserialize, Serialize};

/// When a trigger may fire. Authored sequence transitions are explicit edits,
/// never simulated time.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum TriggerOccasion {
    SceneEnter,
    SceneLeave,
    Activate,
    Select,
    SequenceTransition,
}

pub const TRIGGER_OCCASIONS: [TriggerOccasion; 5] = [
    TriggerOccasion::SceneEnter,
    TriggerOccasion::SceneLeave,
    TriggerOccasion::Activate,
    TriggerOccasion::Select,
    TriggerOccasion::SequenceTransition,
];

impl TriggerOccasion {
    pub fn name(&self) -> &'static str {
        match self {
            TriggerOccasion::SceneEnter => "scene_enter",
            TriggerOccasion::SceneLeave => "scene_leave",
            TriggerOccasion::Activate => "activate",
            TriggerOccasion::Select => "select",
            TriggerOccasion::SequenceTransition => "sequence_transition",
        }
    }
}

/// SurfacePortal placements through the existing O:I Surface/window host.
/// The portal open/close runtime is the expression world seam
/// (`expression_world::Request::PortalOpen`/`PortalClose`/`PortalRedock`
/// over the existing Surface host); this relation is the declarative
/// address of the requested placement.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PortalPlacement {
    Preview,
    Overlay,
    Beside,
    Full,
    Detached,
    ReDock,
}

/// What a trigger points to. Exactly one target, always an existing
/// operation/relation over exact refs — never a procedure.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum TriggerTarget {
    /// A bounded `oi.expression/v1` read operation (see
    /// [`TRIGGER_OPERATIONS`]). Triggers present information; they never
    /// mutate documents silently.
    ExpressionOperation { operation: String, expression_ref: String },
    /// A SurfacePortal placement for an exactly-named disclosed subject.
    Portal { placement: PortalPlacement, subject_ref: String, #[serde(default)] scene_ref: Option<String> },
    /// A canonical native ActionRef that must already be disclosed on a bound
    /// subject or scene body in this document.
    NativeAction { action_ref: String, target_ref: String, authority_requirement: String },
    /// Focus/selection/navigation over exact refs (never invokes an Action).
    Navigate { #[serde(default)] scene_ref: Option<String>, #[serde(default)] entity_ref: Option<String> },
}

/// Read-only `oi.expression/v1` operations a trigger may name.
pub const TRIGGER_OPERATIONS: [&str; 3] = ["inspect", "list", "export"];

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SceneTrigger {
    /// Expression-local ref, `expression:<id>:trigger:<suffix>`.
    pub trigger_ref: String,
    pub occasion: TriggerOccasion,
    pub target: TriggerTarget,
}

pub const MAX_TRIGGERS_PER_SCENE: usize = 8;
/// Typed marker carried in the refusal message for executable trigger bodies.
pub const SCRIPT_BODY_REFUSED: &str = "script_body_refused";

/// Keys that would smuggle executable behaviour into a trigger. Presence of
/// any of them is refused with the typed [`SCRIPT_BODY_REFUSED`] error.
const SCRIPT_KEYS: [&str; 9] = [
    "script",
    "code",
    "eval",
    "function",
    "handler",
    "javascript",
    "on_enter",
    "on_leave",
    "body_source",
];

/// Typed refusal of arbitrary executable script bodies. Document parsing
/// already refuses unknown fields structurally; this check gives callers a
/// distinct, matchable refusal when auditing raw trigger JSON.
pub fn refuse_script_body(value: &serde_json::Value) -> Result<(), String> {
    let object = match value.as_object() {
        Some(object) => object,
        None => return Ok(()),
    };
    for key in SCRIPT_KEYS {
        if object.contains_key(key) {
            return Err(format!(
                "{SCRIPT_BODY_REFUSED}: Expression triggers are declarative relations over existing operations; executable script bodies are refused"
            ));
        }
    }
    if let Some(target) = object.get("target") {
        return refuse_script_body(target);
    }
    Ok(())
}

/// Cross-check every scene trigger against the whole document: trigger refs,
/// disclosed subjects, disclosed native Actions and exact navigation targets.
/// Runs as part of `Document::validate`, so atomic edits cannot leave a
/// document whose triggers point at nothing.
pub fn validate_document_triggers(document: &Document) -> Result<(), String> {
    let mut all_refs = std::collections::BTreeSet::new();
    for scene in &document.scenes {
        if scene.triggers.len() > MAX_TRIGGERS_PER_SCENE {
            return Err("Scene trigger budget exceeded".into());
        }
        for trigger in &scene.triggers {
            id(
                &trigger.trigger_ref,
                &format!("{}:trigger:", document.expression_ref),
            )?;
            if !all_refs.insert(&trigger.trigger_ref) {
                return Err("Duplicate scene trigger ref".into());
            }
            validate_target(document, scene, &trigger.target)?;
        }
    }
    Ok(())
}

fn validate_target(
    document: &Document,
    scene: &crate::expression::Scene,
    target: &TriggerTarget,
) -> Result<(), String> {
    match target {
        TriggerTarget::ExpressionOperation { operation, expression_ref } => {
            if !TRIGGER_OPERATIONS.contains(&operation.as_str()) {
                return Err(format!(
                    "Trigger operations are limited to {TRIGGER_OPERATIONS:?}; triggers never mutate documents silently"
                ));
            }
            if !expression_ref.starts_with("expression:") || text(expression_ref).is_err() {
                return Err("Trigger must name a valid Expression ref".into());
            }
        }
        TriggerTarget::Portal { placement: _, subject_ref, scene_ref } => {
            text(subject_ref)?;
            // The portal subject must be disclosed in this scene: the scene
            // body's subject or a bound entity of this exact scene.
            let disclosed = scene
                .body
                .as_ref()
                .map(|b| b.subject_ref == *subject_ref)
                .unwrap_or(false)
                || scene.entity_refs.iter().any(|r| {
                    document
                        .entities
                        .get(r)
                        .and_then(|e| e.subject.as_ref())
                        .is_some_and(|b| b.subject_ref == *subject_ref)
                });
            if !disclosed {
                return Err("Portal trigger subject must be disclosed on this scene's body or entities".into());
            }
            if let Some(target_scene) = scene_ref {
                if !document.scenes.iter().any(|s| &s.scene_ref == target_scene) {
                    return Err("Portal trigger names an absent scene".into());
                }
            }
        }
        TriggerTarget::NativeAction { action_ref, target_ref, authority_requirement } => {
            text(action_ref)?;
            text(target_ref)?;
            text(authority_requirement)?;
            let disclosed = document.entities.values().any(|e| {
                e.subject.as_ref().is_some_and(|b| {
                    b.actions
                        .iter()
                        .any(|a| a.action_ref == *action_ref && a.target_ref == *target_ref)
                })
            }) || document.scenes.iter().any(|s| {
                s.body.as_ref().is_some_and(|b| {
                    b.actions
                        .iter()
                        .any(|a| a.action_ref == *action_ref && a.target_ref == *target_ref)
                })
            });
            if !disclosed {
                return Err("Trigger native Action must be disclosed on a bound subject or scene body".into());
            }
        }
        TriggerTarget::Navigate { scene_ref, entity_ref } => {
            if scene_ref.is_none() && entity_ref.is_none() {
                return Err("Navigate trigger must name a scene or entity".into());
            }
            if let Some(scene_ref) = scene_ref {
                if !document.scenes.iter().any(|s| &s.scene_ref == scene_ref) {
                    return Err("Navigate trigger names an absent scene".into());
                }
            }
            if let Some(entity_ref) = entity_ref {
                let entity = document.entities.get(entity_ref).ok_or("Navigate trigger names an absent entity")?;
                if let Some(scene_ref) = scene_ref {
                    let scene = document
                        .scenes
                        .iter()
                        .find(|s| &s.scene_ref == scene_ref)
                        .ok_or("Navigate trigger names an absent scene")?;
                    if !scene.entity_refs.contains(&entity.entity_ref) {
                        return Err("Navigate trigger entity is outside the named scene".into());
                    }
                }
            }
        }
    }
    Ok(())
}
