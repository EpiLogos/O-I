//! Reusable expressive material (contract
//! docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md §1, §3).
//!
//! Material is an ordinary `oi.expression/v1` document carrying a `reuse`
//! block, saved through Central files. This module reads it through Central's
//! owner route (`central.files.resolve` / `read` / `list`), discovers it in
//! the material register, and implements the ONE role-grafting rule:
//!
//! - the bound character's state Scene `self` entity supplies the material
//!   (shape / source / layers / sequence / force / tint / size / scale /
//!   share / sound …);
//! - the placeholder keeps `id`, `position`, `rotation`, `role` and applies
//!   its own `overrides{}` last;
//! - text roles replace the text layer's text field;
//! - an unbound role keeps its authored placeholder material.
//!
//! Nothing here writes: performance lands through the ordinary Expression
//! edit path (`scene_material_set`) in `expression_world`.
use crate::expression::{Document, Reuse, ReuseAssociations, ReuseKind};
use crate::files;
use crate::flow::CentralClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;

/// The Central register reusable material is saved in and discovered from.
/// Central protects all of `Control/` (bar the owner's flows) and every
/// `ProjectCentral/` against ordinary file writes, so the contract's first
/// choice (`Control/agents/expressive-material/`) is refused by the owner;
/// the O:I repository's material tree is the writable register
/// (`<register>/<kind>/<slug>.expression.json`).
pub const MATERIAL_REGISTER: &str = "Work/O-I/desktop/cradle/material/expressive-material";
pub const LIST_SCHEMA: &str = "oi.expression-material-list/v1";
const MAX_LISTED: usize = 256;
/// Keys a placeholder keeps over grafted character material.
const PLACEMENT_KEYS: [&str; 5] = ["id", "position", "rotation", "role", "overrides"];

/// `material_list` association filter. Each present key must appear in the
/// material's corresponding association list.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct AssociationQuery {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workflow_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub skill_set_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub skill_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_family: Option<String>,
}

impl AssociationQuery {
    pub fn matches(&self, associations: &ReuseAssociations) -> bool {
        let has = |wanted: &Option<String>, list: &Vec<String>| {
            wanted.as_ref().is_none_or(|w| list.iter().any(|v| v == w))
        };
        has(&self.workflow_key, &associations.workflow_keys)
            && has(&self.task_type, &associations.task_types)
            && has(&self.skill_set_ref, &associations.skill_set_refs)
            && has(&self.skill_ref, &associations.skill_refs)
            && has(&self.event_family, &associations.event_families)
    }
}

/// One material document as read, with its exact identity and revision.
#[derive(Clone, Debug)]
pub struct Loaded {
    pub document: Document,
    /// Central file ref when read through Central; `None` for an open
    /// Expression addressed by `expression:` ref.
    pub file_ref: Option<String>,
    pub revision: String,
}

impl Loaded {
    pub fn reuse(&self) -> Option<&Reuse> {
        self.document.reuse.as_ref()
    }
}

/// Read a material document through Central's owner route.
pub fn read_file(client: &CentralClient, file_ref: &str) -> Result<Loaded, String> {
    let location = files::resolve(client, file_ref)?;
    let reading = files::read(client, &location)?;
    let document = crate::expression_file::decode(&reading.content)
        .map_err(|e| format!("Material {file_ref} is not an Expression document: {e}"))?;
    Ok(Loaded {
        document,
        file_ref: Some(location.ref_id),
        revision: reading.revision,
    })
}

fn row(document: &Document, reuse: &Reuse, reading: &files::Reading) -> Value {
    json!({
        "file_ref": reading.location.ref_id,
        "revision": reading.revision,
        "title": reuse.title,
        "kind": reuse.kind,
        "roles": reuse.roles,
        "states": reuse.states,
        "gestures": reuse.gestures,
        "associations": reuse.associations,
        "preview_state": reuse.preview_state,
        "entry_scene_ref": reuse.entry_scene_ref,
        "playback": reuse.playback,
        "expression_ref": document.expression_ref,
        "location": reading.location,
    })
}

/// Discover reusable material in the register through Central
/// (`central.files.list` + `read`). Unreadable entries are disclosed, never
/// silently dropped; a missing kind folder is disclosed the same way.
pub fn list(
    client: &CentralClient,
    register: &str,
    kind: Option<ReuseKind>,
    association: Option<&AssociationQuery>,
) -> Value {
    let kinds: Vec<ReuseKind> = kind
        .map(|k| vec![k])
        .unwrap_or_else(|| ReuseKind::ALL.to_vec());
    let mut materials = Vec::new();
    let mut unreadable = Vec::new();
    let mut truncated = false;
    // The owner-disclosed folder of each kind: the exact `parent` a
    // `save_as` of new material into the register names.
    let mut folders = serde_json::Map::new();
    'kinds: for folder in kinds {
        let path = format!("{register}/{}", folder.as_str());
        let directory = match files::list(client, &path) {
            Ok(directory) => directory,
            Err(error) => {
                unreadable.push(json!({"path": path, "error": error}));
                continue;
            }
        };
        folders.insert(folder.as_str().into(), json!(directory.location));
        for entry in directory.entries {
            if entry.kind != "file" || !entry.name.ends_with(".json") {
                continue;
            }
            if materials.len() >= MAX_LISTED {
                truncated = true;
                break 'kinds;
            }
            let reading = match files::read(client, &entry.location) {
                Ok(reading) => reading,
                Err(error) => {
                    unreadable.push(json!({"file_ref": entry.location.ref_id, "error": error}));
                    continue;
                }
            };
            let document = match crate::expression_file::decode(&reading.content) {
                Ok(document) => document,
                Err(error) => {
                    unreadable.push(json!({"file_ref": entry.location.ref_id, "error": error}));
                    continue;
                }
            };
            let Some(reuse) = document.reuse.as_ref() else {
                continue;
            };
            if kind.is_some_and(|k| k != reuse.kind) {
                continue;
            }
            if association.is_some_and(|a| !a.matches(&reuse.associations)) {
                continue;
            }
            materials.push(row(&document, reuse, &reading));
        }
    }
    json!({
        "state": "materials",
        "schema": LIST_SCHEMA,
        "register": register,
        "folders": folders,
        "materials": materials,
        "unreadable": unreadable,
        "truncated": truncated,
    })
}

/// Resolve the Scene a selection names: an exact `scene_ref` (full ref or the
/// suffix after `:scene:`), a named `state`, else the entry Scene, else the
/// document's selected Scene.
pub fn resolve_scene(
    document: &Document,
    scene_ref: Option<&str>,
    state: Option<&str>,
) -> Result<String, String> {
    let exists = |r: &str| document.scenes.iter().any(|s| s.scene_ref == r);
    if let Some(r) = scene_ref {
        if exists(r) {
            return Ok(r.to_owned());
        }
        let full = format!("{}:scene:{r}", document.expression_ref);
        if exists(&full) {
            return Ok(full);
        }
        return Err(format!("Material has no Scene {r}"));
    }
    let reuse = document.reuse.as_ref();
    if let Some(state) = state {
        return reuse
            .and_then(|r| r.states.get(state))
            .cloned()
            .ok_or_else(|| format!("Material has no state {state:?}"));
    }
    if let Some(entry) = reuse.and_then(|r| r.entry_scene_ref.clone()) {
        return Ok(entry);
    }
    Ok(document.selection.scene_ref.clone())
}

/// The authored Scene material (the retained authoring Scene) of one Scene.
pub fn scene_material(document: &Document, scene_ref: &str) -> Result<Value, String> {
    document
        .scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .ok_or_else(|| format!("Material has no Scene {scene_ref}"))?
        .presentation
        .as_ref()
        .map(|p| p.scene.clone())
        .ok_or_else(|| format!("Scene {scene_ref} carries no authored material"))
}

/// The entity presenting `role` in a Scene: the entity carrying that role,
/// else the entity the reuse index names for it.
pub fn role_entity<'a>(document: &Document, scene: &'a Value, role: &str) -> Option<&'a Value> {
    let entities = scene["entities"].as_array()?;
    entities
        .iter()
        .find(|e| e["role"].as_str() == Some(role))
        .or_else(|| {
            let entity_ref = document
                .reuse
                .as_ref()?
                .roles
                .iter()
                .find(|r| r.role == role)?
                .entity_ref
                .as_deref()?;
            entities
                .iter()
                .find(|e| e["id"].as_str() == Some(entity_ref))
        })
}

/// A character's body material in one state (or gesture) Scene: its `self`
/// entity (or `role`), else the Scene's only entity.
pub fn body_material(document: &Document, scene_ref: &str, role: &str) -> Result<Value, String> {
    let scene = scene_material(document, scene_ref)?;
    if let Some(entity) = role_entity(document, &scene, role) {
        return Ok(entity.clone());
    }
    match scene["entities"].as_array().map(Vec::as_slice) {
        Some([only]) => Ok(only.clone()),
        _ => Err(format!("Scene {scene_ref} has no {role:?} body entity")),
    }
}

/// What one role receives in a performance.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct RoleFill {
    /// Grafted body material (a character state's `self` entity).
    pub material: Option<Value>,
    pub label: Option<String>,
    pub glyph: Option<String>,
    pub text: Option<String>,
    /// Which text-layer field a text role fills (default `body`).
    pub field: Option<String>,
}

/// The grafting rule for one placeholder entity (contract §3).
pub fn graft_entity(placeholder: &Value, fill: &RoleFill) -> Value {
    let mut out = match &fill.material {
        Some(material) => {
            let mut body = material.clone();
            if let Some(map) = body.as_object_mut() {
                for key in PLACEMENT_KEYS {
                    map.remove(key);
                }
            }
            for key in PLACEMENT_KEYS {
                if let Some(value) = placeholder.get(key) {
                    body[key] = value.clone();
                }
            }
            body
        }
        None => placeholder.clone(),
    };
    if let Some(label) = &fill.label {
        out["name"] = json!(label);
    }
    if let Some(glyph) = &fill.glyph {
        out["text"] = json!(glyph);
        if fill.material.is_none() {
            out["shape"] = json!("text");
        }
    }
    if let Some(overrides) = placeholder.get("overrides").and_then(Value::as_object) {
        for (key, value) in overrides {
            out[key.as_str()] = value.clone();
        }
    }
    out
}

/// Apply role fills to every role placeholder (entities and text layers) of
/// an authoring Scene. Unbound roles keep their authored material.
pub fn graft(scene: &mut Value, fills: &BTreeMap<String, RoleFill>) {
    if let Some(entities) = scene.get_mut("entities").and_then(Value::as_array_mut) {
        for entity in entities.iter_mut() {
            let Some(fill) = entity["role"].as_str().and_then(|r| fills.get(r)) else {
                continue;
            };
            *entity = graft_entity(entity, fill);
        }
    }
    if let Some(layers) = scene.get_mut("text").and_then(Value::as_array_mut) {
        for layer in layers.iter_mut() {
            let Some(fill) = layer["role"].as_str().and_then(|r| fills.get(r)) else {
                continue;
            };
            if let Some(text) = &fill.text {
                let field = fill.field.as_deref().unwrap_or("body");
                layer[field] = json!(text);
            }
        }
    }
}

/// Fill one text role in place; returns whether a layer carried the role.
pub fn fill_text(scene: &mut Value, role: &str, field: &str, text: &str) -> bool {
    let mut found = false;
    if let Some(layers) = scene.get_mut("text").and_then(Value::as_array_mut) {
        for layer in layers
            .iter_mut()
            .filter(|l| l["role"].as_str() == Some(role))
        {
            layer[field] = json!(text);
            found = true;
        }
    }
    found
}

/// Text-layer fields a text role may fill.
pub fn text_field(field: &str) -> Result<(), String> {
    if matches!(field, "kicker" | "title" | "italic" | "body") {
        Ok(())
    } else {
        Err(format!("Unsupported text field {field:?}"))
    }
}

/// Deterministic target-local suffix for a material entity (bounded to the
/// Expression-local ref grammar).
pub fn local_suffix(material_expression_ref: &str, material_entity_ref: &str) -> String {
    let material = material_expression_ref
        .strip_prefix("expression:")
        .unwrap_or(material_expression_ref);
    let entity = material_entity_ref
        .rsplit_once(":entity:")
        .map(|(_, s)| s)
        .unwrap_or(material_entity_ref);
    let candidate = format!("m.{material}.{entity}");
    if candidate.len() <= 120
        && candidate
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
    {
        candidate
    } else {
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        for byte in format!("{material_expression_ref}|{material_entity_ref}").as_bytes() {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
        }
        format!("m.{hash:016x}")
    }
}

/// Strip identity-bearing keys a graft never copies (used for gestures,
/// where only the body material moves onto an existing occupant).
pub fn body_only(material: &Value) -> Map<String, Value> {
    let mut map = material.as_object().cloned().unwrap_or_default();
    for key in PLACEMENT_KEYS {
        map.remove(key);
    }
    map
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn graft_keeps_placement_and_applies_overrides_last() {
        let placeholder = json!({"id":"e:1","role":"sender","position":{"x":1,"y":2,"z":0},"rotation":15,
            "text":"?","shape":"text","overrides":{"tint":"#ff0000"}});
        let character = json!({"id":"c:self","role":"self","position":{"x":9,"y":9,"z":9},"rotation":90,
            "text":"◐","shape":"ring","tint":"#00ff00","sequence":{"enabled":true}});
        let out = graft_entity(
            &placeholder,
            &RoleFill {
                material: Some(character),
                label: Some("Nous".into()),
                ..Default::default()
            },
        );
        assert_eq!(out["id"], "e:1");
        assert_eq!(out["role"], "sender");
        assert_eq!(out["position"]["x"], 1);
        assert_eq!(out["rotation"], 15);
        assert_eq!(out["shape"], "ring");
        assert_eq!(out["text"], "◐");
        assert_eq!(out["sequence"]["enabled"], true);
        assert_eq!(out["tint"], "#ff0000", "overrides apply last");
        assert_eq!(out["name"], "Nous");
    }

    #[test]
    fn unbound_roles_keep_authored_material() {
        let mut scene = json!({"entities":[{"id":"a","role":"goal","text":"◇"}],"text":[{"id":"t","role":"caption","body":"…"}]});
        let before = scene.clone();
        graft(&mut scene, &BTreeMap::new());
        assert_eq!(scene, before);
        let fills = BTreeMap::from([(
            "caption".to_string(),
            RoleFill {
                text: Some("Handing over".into()),
                ..Default::default()
            },
        )]);
        graft(&mut scene, &fills);
        assert_eq!(scene["text"][0]["body"], "Handing over");
        assert_eq!(scene["entities"][0]["text"], "◇");
    }

    #[test]
    fn association_query_matches_each_named_list() {
        let a = ReuseAssociations {
            workflow_keys: vec!["handoff".into()],
            event_families: vec!["skill-invocation".into()],
            ..Default::default()
        };
        assert!(AssociationQuery::default().matches(&a));
        assert!(AssociationQuery {
            workflow_key: Some("handoff".into()),
            ..Default::default()
        }
        .matches(&a));
        assert!(!AssociationQuery {
            workflow_key: Some("handoff".into()),
            task_type: Some("review".into()),
            ..Default::default()
        }
        .matches(&a));
    }

    #[test]
    fn local_suffix_is_bounded_and_deterministic() {
        let s = local_suffix("expression:handoff", "expression:handoff:entity:artifact");
        assert_eq!(s, "m.handoff.artifact");
        let long = "x".repeat(200);
        let h = local_suffix(&format!("expression:{long}"), "expression:y:entity:z");
        assert!(
            h.len() <= 120
                && h == local_suffix(&format!("expression:{long}"), "expression:y:entity:z")
        );
    }
}
