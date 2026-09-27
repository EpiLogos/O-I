//! Native Scene presentation constraint over pinned QL addresses. This binds
//! existing occurrences; it creates no subjects, membership or relations.
use crate::expression::{Availability, Document, Parameter, ReadingRef, Scene};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::sync::OnceLock;

const OWNER: &str = include_str!("expression_blueprint_sixfold.json");
pub const SCHEMA: &str = "oi.scene-blueprint/v1";
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Transform {
    pub translation: [f64; 3],
    pub rotation: [f64; 3],
    pub scale: f64,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Member {
    pub entity_ref: String,
    pub subject_ref: String,
    pub role_ref: String,
    pub position: u8,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Binding {
    pub schema: String,
    pub shape_ref: String,
    pub reading_digest: String,
    pub frame: ReadingRef,
    pub members: Vec<Member>,
    pub transform: Transform,
    /// QL-MEF #214 geometry-closeout: the wider warranted constellation this
    /// pinned sixfold basis retains — the QL ShapeBinding's own
    /// `basis_refs`, carried verbatim, never invented here. Optional: absent
    /// on every existing bound Scene and on a caller that discloses no
    /// wider basis; the pinned sixfold geometry (`owner()`) is unaffected
    /// either way.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub basis_refs: Vec<String>,
    /// QL ShapeBinding's own `derivation_ref`, carried verbatim when the
    /// caller discloses one. Optional; no behaviour changes when absent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub derivation_ref: Option<String>,
    /// QL ShapeBinding's own `operator_ref`, carried verbatim when the
    /// caller discloses one. Optional; no behaviour changes when absent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operator_ref: Option<String>,
}
fn owner() -> &'static Value {
    static READING: OnceLock<Value> = OnceLock::new();
    READING.get_or_init(|| serde_json::from_str(OWNER).expect("pinned QL owner output"))
}
pub fn read(scene: &Scene) -> Result<Option<Binding>, String> {
    scene
        .presentation
        .as_ref()
        .and_then(|p| p.scene["composition"].get("blueprint"))
        .map(|v| {
            serde_json::from_value(v.clone()).map_err(|e| format!("Invalid Scene blueprint: {e}"))
        })
        .transpose()
}
pub fn position(binding: &Binding, member: &Member) -> Result<[f64; 3], String> {
    let site = owner()["sites"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["address"]["coordinate"]["position"] == member.position)
        .ok_or("Blueprint role has no native QL address")?;
    let [mut x, mut y, mut z] = [
        site["xyz"][0].as_f64().unwrap(),
        site["xyz"][1].as_f64().unwrap(),
        site["xyz"][2].as_f64().unwrap(),
    ];
    let [rx, ry, rz] = binding.transform.rotation;
    (y, z) = (y * rx.cos() - z * rx.sin(), y * rx.sin() + z * rx.cos());
    (x, z) = (x * ry.cos() + z * ry.sin(), -x * ry.sin() + z * ry.cos());
    (x, y) = (x * rz.cos() - y * rz.sin(), x * rz.sin() + y * rz.cos());
    let p = [x, y, z].map(|v| v * binding.transform.scale);
    Ok(std::array::from_fn(|i| {
        p[i] + binding.transform.translation[i]
    }))
}
fn validate_basis(binding: &Binding, scene: &Scene, doc: &Document) -> Result<(), String> {
    if binding.schema != SCHEMA
        || binding.shape_ref != owner()["shape_ref"]
        || binding.reading_digest != format!("sha256:{:x}", Sha256::digest(OWNER.as_bytes()))
    {
        return Err("Blueprint must bind the exact pinned native sixfold reading".into());
    }
    if binding.frame.availability != Availability::Available
        || binding.frame.r#ref.is_empty()
        || binding.frame.revision.is_empty()
        || binding.members.len() > 6
    {
        return Err("Blueprint needs a bounded available native constellation basis".into());
    }
    let t = &binding.transform;
    if !t
        .translation
        .iter()
        .all(|v| v.is_finite() && v.abs() <= 1600.)
        || !t.rotation.iter().all(|v| v.is_finite() && v.abs() <= 1000.)
        || !t.scale.is_finite()
        || !(0.01..=1600.).contains(&t.scale)
    {
        return Err("Blueprint whole transform is outside native bounds".into());
    }
    if binding.basis_refs.len() > 64
        || binding
            .basis_refs
            .iter()
            .any(|r| r.is_empty() || r.len() > 4096)
    {
        return Err("Blueprint basis refs must be bounded, non-empty native refs".into());
    }
    if let Some(r) = &binding.derivation_ref {
        if r.is_empty() || r.len() > 4096 {
            return Err("Blueprint derivation ref must be a bounded, non-empty native ref".into());
        }
    }
    if let Some(r) = &binding.operator_ref {
        if r.is_empty() || r.len() > 4096 {
            return Err("Blueprint operator ref must be a bounded, non-empty native ref".into());
        }
    }
    let mut refs = BTreeSet::new();
    let mut positions = BTreeSet::new();
    let mut roles = BTreeSet::new();
    for m in &binding.members {
        if !refs.insert(&m.entity_ref)
            || !positions.insert(m.position)
            || !roles.insert(&m.role_ref)
            || m.role_ref.is_empty()
            || m.role_ref.len() > 4096
            || m.position > 5
            || !scene.entity_refs.contains(&m.entity_ref)
        {
            return Err(
                "Blueprint needs unique actual occurrences and native role positions".into(),
            );
        }
        let subject = doc
            .entities
            .get(&m.entity_ref)
            .and_then(|e| e.subject.as_ref())
            .ok_or("Blueprint occurrence has no native source binding")?;
        if subject.subject_ref != m.subject_ref || !subject.readings.contains(&binding.frame) {
            return Err(
                "Blueprint occurrence no longer has its exact native source/frame basis".into(),
            );
        }
        if !position(binding, m)?
            .iter()
            .all(|v| v.is_finite() && v.abs() <= 1600.)
        {
            return Err(
                "Blueprint whole transform puts an occurrence outside native bounds".into(),
            );
        }
    }
    Ok(())
}
fn decode_path(path: &str) -> String {
    let mut out = Vec::new();
    let bytes = path.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(a), Some(b)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            ) {
                out.push((a * 16 + b) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}
fn moving_member(row: &Value, reference: &str, index: usize) -> bool {
    ["target", "bind", "nativePath"].iter().any(|field| {
        let Some(path) = row[field].as_str() else {
            return false;
        };
        let path = decode_path(path);
        let axis = path.rsplit(['.', ':']).next().unwrap_or("");
        if !["x", "y", "z"].contains(&axis) {
            return false;
        }
        row["entityId"] == reference
            || (row.get("entityId").is_none()
                && (path.starts_with(&format!("entity:{reference}:"))
                    || path.starts_with(&format!("link:{reference}:"))
                    || path.starts_with(&format!("entities.{index}."))
                    || path.starts_with(&format!("native:entities.{index}."))))
    })
}
pub fn validate(scene: &Scene, doc: &Document) -> Result<(), String> {
    let Some(binding) = read(scene)? else {
        return Ok(());
    };
    validate_basis(&binding, scene, doc)?;
    let material = &scene
        .presentation
        .as_ref()
        .ok_or("Blueprint has no Scene material")?
        .scene;
    for m in &binding.members {
        let expected = position(&binding, m)?;
        let entity = &doc.entities[&m.entity_ref];
        let body = material["entities"]
            .as_array()
            .and_then(|rows| rows.iter().find(|row| row["id"] == m.entity_ref))
            .ok_or("Blueprint occurrence cannot be hidden without explicit release")?;
        for (i, key) in ["x", "y", "z"].iter().enumerate() {
            let p = entity
                .parameters
                .get(*key)
                .ok_or("Blueprint occurrence lacks its coordinate")?;
            if p.automation.is_some()
                || !p
                    .value
                    .as_f64()
                    .is_some_and(|v| (v - expected[i]).abs() <= 1e-7)
                || !body["position"][key]
                    .as_f64()
                    .is_some_and(|v| (v * 400. - expected[i]).abs() <= 1e-7)
            {
                return Err("Blueprint holds internal geometry; transform the whole or explicitly release it before moving a member".into());
            }
        }
        if body["sequence"]["steps"].as_array().is_some_and(|rows| {
            rows.iter()
                .any(|row| row.get("position").is_some_and(|p| !p.is_null()))
        }) {
            return Err("Release the blueprint before adding a positional sequence".into());
        }
        for key in ["automation", "propertyTracks"] {
            if material[key].as_array().is_some_and(|rows| {
                let index = material["entities"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .position(|body| body["id"] == m.entity_ref)
                    .unwrap();
                rows.iter()
                    .any(|row| moving_member(row, &m.entity_ref, index))
            }) {
                return Err(
                    "Release the blueprint before recording or automating individual positions"
                        .into(),
                );
            }
        }
    }
    Ok(())
}
fn store(doc: &mut Document, scene_ref: &str, binding: Binding) -> Result<(), String> {
    let scene = doc
        .scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .ok_or("Blueprint Scene is absent")?;
    validate_basis(&binding, scene, doc)?;
    if scene.presentation.is_none() {
        return Err("Retain native Scene material before binding a blueprint".into());
    }
    for m in &binding.members {
        let point = position(&binding, m)?;
        for (axis, value) in ["x", "y", "z"].into_iter().zip(point) {
            if doc.entities[&m.entity_ref]
                .parameters
                .get(axis)
                .is_some_and(|p| p.automation.is_some())
            {
                return Err("Take manual control of position before binding a blueprint".into());
            }
            // JSON integer/floating representation is not a positional edit.
            // Preserve a numerically identical manual coordinate so entity
            // revisions reflect actual changes across the JSON boundary.
            if !doc.entities[&m.entity_ref]
                .parameters
                .get(axis)
                .is_some_and(|p| p.value.as_f64() == Some(value))
            {
                doc.entities
                    .get_mut(&m.entity_ref)
                    .unwrap()
                    .parameters
                    .insert(
                        axis.into(),
                        Parameter {
                            value: json!(value),
                            automation: None,
                        },
                    );
            }
            for scene in &mut doc.scenes {
                if let Some(p) = &mut scene.presentation {
                    crate::expression_scene::set_parameter(p, &m.entity_ref, axis, &json!(value));
                }
            }
        }
    }
    doc.scenes
        .iter_mut()
        .find(|s| s.scene_ref == scene_ref)
        .unwrap()
        .presentation
        .as_mut()
        .unwrap()
        .scene["composition"]["blueprint"] =
        serde_json::to_value(binding).map_err(|e| e.to_string())?;
    Ok(())
}
pub fn bind(doc: &mut Document, scene_ref: &str, binding: Binding) -> Result<(), String> {
    let scene = doc
        .scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .ok_or("Blueprint Scene is absent")?;
    if read(scene)?.is_some() {
        return Err("Release the existing blueprint before binding a different one".into());
    }
    store(doc, scene_ref, binding)
}
pub fn transform(doc: &mut Document, scene_ref: &str, transform: Transform) -> Result<(), String> {
    let scene = doc
        .scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .ok_or("Blueprint Scene is absent")?;
    let mut binding = read(scene)?.ok_or("Scene has no blueprint")?;
    // Reapplying the displayed transform is no change, including after an
    // ordinary JSON material round trip changed only number spelling.
    if binding.transform == transform {
        return Ok(());
    }
    binding.transform = transform;
    store(doc, scene_ref, binding)
}
pub fn release(doc: &mut Document, scene_ref: &str) -> Result<(), String> {
    let scene = doc
        .scenes
        .iter_mut()
        .find(|s| s.scene_ref == scene_ref)
        .ok_or("Blueprint Scene is absent")?;
    if read(scene)?.is_none() {
        return Err("Scene has no blueprint to release".into());
    }
    scene.presentation.as_mut().unwrap().scene["composition"]
        .as_object_mut()
        .unwrap()
        .remove("blueprint");
    Ok(())
}
/// Generic material writes may preserve this exact binding, but cannot quietly
/// add, replace or release it. Dedicated native changes retain explicit intent.
pub fn preserve(
    before: Option<&crate::expression_scene::Presentation>,
    after: Option<&crate::expression_scene::Presentation>,
) -> Result<(), String> {
    // Binding is the typed authority. A JSON round trip can spell a floating
    // whole coordinate as an integer without changing the binding's meaning.
    // Strict decoding still refuses every unknown or malformed field.
    let decode = |p: &crate::expression_scene::Presentation| {
        p.scene["composition"]
            .get("blueprint")
            .map(|value| {
                serde_json::from_value::<Binding>(value.clone())
                    .map_err(|error| format!("Invalid Scene blueprint: {error}"))
            })
            .transpose()
    };
    let old = before.map(decode).transpose()?.flatten();
    let new = after.map(decode).transpose()?.flatten();
    if old != new {
        return Err(
            "Use the explicit native blueprint bind, transform or release operation".into(),
        );
    }
    Ok(())
}
