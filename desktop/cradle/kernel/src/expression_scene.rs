//! The existing Expressions authoring Scene, retained inside its native
//! oi.expression/v1 Scene. This is presentation, never membership or evidence.
//! The renderer still validates through its own oi.journey/1 importer. Kernel
//! validation makes identity, resource budgets and non-executable data binding
//! enforceable on the same native edit path used by humans and Agents.
use crate::expression::{Document, Scene, LIMIT};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;

pub const SCHEMA: &str = "oi.journey-scene/v1";
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Presentation {
    pub schema: String,
    pub scene: Value,
    /// The author's saved version is distinct from the current working draft.
    /// Absence means this material has not been saved as a presentation Scene.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub saved: Option<Value>,
}

fn object<'a>(value: &'a Value, name: &str) -> Result<&'a serde_json::Map<String, Value>, String> {
    value
        .as_object()
        .ok_or_else(|| format!("{name} must be an object"))
}
fn number(value: &Value, low: f64, high: f64, name: &str) -> Result<(), String> {
    if value
        .as_f64()
        .is_some_and(|n| n.is_finite() && n >= low && n <= high)
    {
        Ok(())
    } else {
        Err(format!("{name} is outside its presentation bounds"))
    }
}
pub fn data(value: &Value, depth: usize) -> Result<(), String> {
    if depth > 40 {
        return Err("Scene presentation nesting budget exceeded".into());
    }
    match value {
        Value::Number(number) if number.as_f64().is_none() => {
            return Err("Scene presentation number must be finite".into())
        }
        Value::Object(values) => {
            for (key, value) in values {
                if [
                    "__proto__",
                    "constructor",
                    "prototype",
                    "$serde_json::private::Number",
                    "$serde_json::private::RawValue",
                ]
                .contains(&key.as_str())
                {
                    return Err("Unsafe Scene presentation key".into());
                }
                if key == "dataUrl" {
                    let image = value
                        .as_str()
                        .ok_or("Image carrier must be embedded image data")?;
                    if ![
                        "data:image/png;base64,",
                        "data:image/jpeg;base64,",
                        "data:image/webp;base64,",
                    ]
                    .iter()
                    .any(|prefix| {
                        image.strip_prefix(prefix).is_some_and(|bytes| {
                            !bytes.is_empty()
                                && bytes.len() % 4 == 0
                                && bytes
                                    .bytes()
                                    .all(|b| b.is_ascii_alphanumeric() || b"+/=".contains(&b))
                        })
                    }) {
                        return Err("Scene images must use admitted embedded PNG/JPEG/WebP data; no ambient URL fetch".into());
                    }
                }
                data(value, depth + 1)?;
            }
        }
        Value::Array(values) => {
            if values.len() > 4096 {
                return Err("Scene presentation array budget exceeded".into());
            }
            for value in values {
                data(value, depth + 1)?;
            }
        }
        _ => {}
    }
    Ok(())
}

pub fn validate(
    presentation: &Presentation,
    scene: &Scene,
    document: &Document,
) -> Result<(), String> {
    if presentation.schema != SCHEMA {
        return Err("Unsupported native Scene presentation".into());
    }
    // The existing document's byte budget remains the outer storage bound.
    data(&presentation.scene, 0)?;
    let material = object(&presentation.scene, "Authoring Scene")?;
    const KEYS: &[&str] = &[
        "id",
        "name",
        "character",
        "duration",
        "transition",
        "view",
        "field",
        "entities",
        "text",
        "composition",
        "morph",
        "automation",
        "engine",
        "semanticField",
        "resonanceDrive",
        "favourites",
        "native",
        "propertyTakeRange",
        "toolbelt",
        "propertyTracks",
        "parameterRacks",
        "pointerScope",
        "research",
        "epiWorld",
    ];
    if material.keys().any(|key| !KEYS.contains(&key.as_str())) {
        return Err("Unsupported authoring Scene field; original input was not rewritten".into());
    }
    if material.get("id").and_then(Value::as_str) != Some(scene.scene_ref.as_str()) {
        return Err("Scene presentation addresses a different native Scene".into());
    }
    if material.get("name").and_then(Value::as_str) != Some(scene.title.as_str()) {
        return Err(
            "Scene name and native title disagree; rename through the native Scene operation"
                .into(),
        );
    }
    number(
        &presentation.scene["duration"],
        1.0,
        3600.0,
        "Scene duration",
    )?;
    number(
        &presentation.scene["transition"],
        0.0,
        30.0,
        "Scene transition",
    )?;
    for key in ["view", "field", "composition", "morph", "engine"] {
        object(&presentation.scene[key], key)?;
    }
    let view = &presentation.scene["view"];
    if !matches!(view["mode"].as_str(), Some("2d" | "3d")) {
        return Err("Invalid Scene view mode".into());
    }
    for (key, low, high) in [
        ("yaw", -1000., 1000.),
        ("pitch", -1000., 1000.),
        ("zoom", 0.01, 100.),
        ("panX", -10., 10.),
        ("panY", -10., 10.),
    ] {
        number(&view[key], low, high, key)?;
    }
    for (key, budget) in [("entities", LIMIT), ("text", 16), ("automation", 64)] {
        let values = presentation.scene[key]
            .as_array()
            .ok_or_else(|| format!("Scene {key} must be an array"))?;
        if values.len() > budget {
            return Err(format!("Scene {key} budget exceeded"));
        }
    }
    let mut identities = BTreeSet::new();
    for entity in presentation.scene["entities"].as_array().unwrap() {
        object(entity, "Scene entity")?;
        let reference = entity["id"]
            .as_str()
            .ok_or("Scene entity requires an exact native occurrence ref")?;
        if !identities.insert(reference)
            || !scene.entity_refs.iter().any(|r| r == reference)
            || !document.entities.contains_key(reference)
        {
            return Err(
                "Scene material contains a duplicate or undisclosed native occurrence".into(),
            );
        }
        if !matches!(entity["kind"].as_str(), Some("formation" | "pin")) {
            return Err("Invalid Scene entity kind".into());
        }
        role_slot(entity)?;
    }
    for layer in presentation.scene["text"].as_array().unwrap() {
        role_slot(layer)?;
    }
    // Scope follows native membership across hide/reveal and member paging.
    // Presentation visibility never rebinds or retires an installed rack.
    let rack_members = scene.entity_refs.iter().map(String::as_str).collect();
    crate::expression_parameter_rack::validate(&presentation.scene, &rack_members)?;
    if let Some(world) = material.get("epiWorld") {
        // A retained native reading, never a replacement for the Scene or its
        // reset material. Exact source authority is re-read on reception.
        object(world, "Epi world reading")?;
        if world["schema"] != "oi.epi-world-material/v1"
            || world["world"]["schema"] != "oi.epi-portable-world/v1"
            || world["world"]["instance_ref"] != document.expression_ref
            || world["world"]["subject_ref"] != world["person_ref"]
            || world["world"]["event_ref"] != world["world"]["snapshot_ref"]
            || world["receiving"]["personal"]["canonical_locus"] != "ql:m-coordinate:bimba:M4.4.4.4"
        {
            return Err("Retained Epi world has a different native instance, person, occasion or personal locus".into());
        }
        validate_epi_portable_basis(world, document)?;
        if let Some(policy) = world.get("current_material_policy") {
            let policy = object(policy, "Retained Epi material policy")?;
            if policy.len() != 3 || policy.keys().any(|key| !["schema", "material", "standing"].contains(&key.as_str()))
                || policy["schema"] != "oi.epi-current-material-policy/v1"
                || policy["standing"] != "declared-material-policy: no source table fixes presentation scale, damping, strike amplitude or output gain (QL-MEF #135)"
            {
                return Err("Retained Epi material policy lost its exact declared standing".into());
            }
            crate::native_expression::validate_scene_material(&policy["material"])?;
        }
        let locus = world["receiving"]["personal"]["locus_entity_ref"]
            .as_str()
            .ok_or("Retained Epi world has no personal locus occurrence")?;
        if document
            .entities
            .get(locus)
            .and_then(|e| e.subject.as_ref())
            .map(|s| s.subject_ref.as_str())
            != Some("ql:m-coordinate:bimba:M4.4.4.4")
        {
            return Err(
                "Retained Epi world personal occurrence belongs to a different branch".into(),
            );
        }
    }
    if let Some(research) = material.get("research") {
        validate_research(research, &identities)?;
    }
    if let Some(saved) = &presentation.saved {
        let mut saved_scene = scene.clone();
        saved_scene.title = saved["name"]
            .as_str()
            .ok_or("Saved Scene requires its own title")?
            .to_owned();
        if saved_scene.title.is_empty() || saved_scene.title.len() > 640 {
            return Err("Saved Scene title is outside its authoring budget".into());
        }
        validate(
            &Presentation {
                schema: SCHEMA.into(),
                scene: saved.clone(),
                saved: None,
            },
            &saved_scene,
            document,
        )?;
    }
    Ok(())
}

/// The retained carrier is explicitly different from a raw QL constructor
/// result. Only the two compiled buffers are omitted; their qualification and
/// the original source owners survive, and reception recompiles them natively.
fn validate_epi_portable_basis(world: &Value, document: &Document) -> Result<(), String> {
    let retained = &world["world"];
    let receiving = &world["receiving"];
    let source = &world["native_source"];
    if receiving["expression_ref"] != document.expression_ref
        || receiving["personal"]["instance_ref"] != document.expression_ref
        || receiving["subject_ref"] != world["person_ref"]
        || receiving["personal"]["person"]["ref"] != world["person_ref"]
        || receiving["event_ref"] != retained["event_ref"]
        || receiving["snapshot_ref"] != retained["snapshot_ref"]
        || retained["sky"]["schema"] != "ql.sky-snapshot/v1"
        || retained["sky"]["snapshot_ref"] != retained["snapshot_ref"]
        || source["sky"] != retained["sky"]
        || !retained["basis"].is_object()
        || retained["basis"] != retained["binding"]["native_basis"]
        || retained["event"] != retained["basis"]["input"]
    {
        return Err(
            "Retained Epi portable basis lost its exact native person, instance, sky or event"
                .into(),
        );
    }
    let digest = |value: &Value| {
        value.as_str().is_some_and(|s| {
            s.len() == 64
                && s.bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        })
    };
    let owners = retained["native_owner_sources"]
        .as_array()
        .ok_or("Retained Epi portable basis requires original native owner-role readings")?;
    let source_owners = world["source_basis"]["native_owner_sources"]
        .as_array()
        .ok_or("Retained Epi portable basis lost its material source-owner readings")?;
    let mut roles = BTreeSet::new();
    for owner in owners {
        let expected_source = match owner["role"].as_str() {
            Some("constructor") => "crates/ql-mef/src/scene.rs",
            Some("coupled") => "crates/ql-mef/src/continuous/coupled.rs",
            Some("field") => "crates/ql-mef/src/continuous/scene_field.rs",
            _ => return Err("Retained Epi portable basis has an unknown native owner role".into()),
        };
        let revision = owner["reading"]["revision"].as_str().unwrap_or("");
        if !roles.insert(owner["role"].as_str().unwrap())
            || owner["reading"]["ref"] != expected_source
            || owner["reading"]["availability"] != "available"
            || !source_owners.contains(&owner["reading"])
            || !revision
                .strip_prefix("sha256:")
                .is_some_and(|s| digest(&Value::String(s.into())))
        {
            return Err(
                "Retained Epi portable basis lost an exact original native owner source".into(),
            );
        }
    }
    if owners.len() != 3 || source_owners.len() != 3 {
        return Err(
            "Retained Epi portable basis requires all three original native owner roles".into(),
        );
    }
    let reading = &source["world_ref"];
    if source["schema"] != "oi.native-expression-composed-source/v1"
        || source.get("world").is_some()
        || reading["ref"] != format!("ql:scene-world:{}", document.expression_ref)
        || reading["availability"] != "available"
        || !digest(&reading["revision"])
        || reading["revision"] != source["request_sha256"]
        || !digest(&source["ql_executable_sha256"])
    {
        return Err(
            "Retained Epi portable basis lost its exact native construction source receipt".into(),
        );
    }
    let runtime = &world["runtime_buffers"];
    if runtime["schema"] != "oi.epi-native-runtime-buffers/v1"
        || runtime["policy"] != "native-owner-recompose"
        || runtime["reading"] != *reading
        || retained["binding"]["presentation"].get("slots_a").is_some()
        || retained["binding"]["presentation"].get("slots_b").is_some()
    {
        return Err("Retained Epi portable basis requires native buffer recomposition from its exact reading".into());
    }
    let buffers = runtime["buffers"]
        .as_array()
        .ok_or("Retained Epi portable basis requires both native buffer qualifications")?;
    let mut keys = BTreeSet::new();
    for buffer in buffers {
        let key = buffer["key"].as_str().unwrap_or("");
        if !matches!(key, "slots_a" | "slots_b")
            || !keys.insert(key)
            || !buffer["values"].as_u64().is_some_and(|n| n > 0)
            || !digest(&buffer["json_sha256"])
        {
            return Err(
                "Retained Epi portable basis has a missing or damaged native buffer qualification"
                    .into(),
            );
        }
    }
    if buffers.len() != 2 {
        return Err(
            "Retained Epi portable basis requires both native buffer qualifications".into(),
        );
    }
    Ok(())
}

/// A role placeholder (contract EXPRESSION-ACT-MATERIAL-V1 §1/§3): `role` is a
/// bounded role name; `overrides` is the placeholder's own material applied
/// last over a grafted character and never re-addresses identity.
fn role_slot(value: &Value) -> Result<(), String> {
    if let Some(role) = value.get("role") {
        crate::expression::role_name(role.as_str().ok_or("Scene role must be text")?)?;
    }
    if let Some(overrides) = value.get("overrides") {
        let map = object(overrides, "Scene role overrides")?;
        if map.len() > 64
            || map
                .keys()
                .any(|k| matches!(k.as_str(), "id" | "role" | "overrides"))
        {
            return Err("Scene role overrides are bounded and never re-address identity".into());
        }
    }
    Ok(())
}

fn validate_research(value: &Value, ids: &BTreeSet<&str>) -> Result<(), String> {
    let r = object(value, "Research material")?;
    if value["schema"] != "oi.research-scene/v1"
        || serde_json::to_vec(value).map_err(|e| e.to_string())?.len() > 262144
        || r.keys()
            .any(|key| !["schema", "cards", "strokes", "views", "timeline"].contains(&key.as_str()))
    {
        return Err("Invalid or unbounded research Scene material".into());
    }
    for key in ["cards", "views", "timeline"] {
        let rows = object(&value[key], key)?;
        if rows.len() > if key == "views" { 16 } else { 256 } {
            return Err("Research record budget exceeded".into());
        }
    }
    let bounded = |v: &Value, max: usize| v.as_str().is_some_and(|s| s.len() <= max);
    let colour = |v: &Value| {
        v.as_str().is_some_and(|s| {
            (s.len() == 7 || s.len() == 9)
                && s.starts_with('#')
                && s[1..].bytes().all(|b| b.is_ascii_hexdigit())
        })
    };
    let viewport = |v: &Value| -> Result<(), String> {
        let map = object(v, "Research viewport")?;
        if map
            .keys()
            .any(|k| !["x", "y", "zoom"].contains(&k.as_str()))
        {
            return Err("Unknown viewport field".into());
        }
        number(&v["x"], -1e8, 1e8, "Viewport x")?;
        number(&v["y"], -1e8, 1e8, "Viewport y")?;
        number(&v["zoom"], 0.001, 1e5, "Viewport zoom")
    };
    for (id, card) in value["cards"].as_object().unwrap() {
        let c = object(card, "Research card")?;
        if !ids.contains(id.as_str())
            || !matches!(card["type"].as_str(), Some("note" | "image"))
            || c.keys().any(|k| {
                ![
                    "type",
                    "importedAt",
                    "content",
                    "caption",
                    "color",
                    "dotColour",
                    "bgColour",
                    "textColour",
                ]
                .contains(&k.as_str())
            })
        {
            return Err(
                "Research card must address a disclosed occurrence with an admitted kind".into(),
            );
        }
        if let Some(v) = c.get("importedAt") {
            if card["type"] != "image" || !bounded(v, 64) {
                return Err("Invalid image import time".into());
            }
        }
        if let Some(content) = c.get("content") {
            if card["type"] != "note" || !bounded(content, 65536) {
                return Err("Invalid rich note".into());
            }
            let blocks: Value = serde_json::from_str(content.as_str().unwrap())
                .map_err(|_| "Research note must be BlockNote JSON")?;
            if !blocks.as_array().is_some_and(|a| a.len() <= 256) {
                return Err("Rich note block budget exceeded".into());
            }
            validate_note(&blocks, 0)?;
        }
        if let Some(v) = c.get("caption") {
            if !bounded(v, 4096) {
                return Err("Research caption budget exceeded".into());
            }
        }
        for key in ["color", "dotColour", "bgColour", "textColour"] {
            if let Some(v) = c.get(key) {
                if !colour(v) {
                    return Err("Invalid research colour".into());
                }
            }
        }
    }
    let strokes = value["strokes"]
        .as_array()
        .ok_or("Research annotations must be an array")?;
    if strokes.len() > 128 {
        return Err("Annotation budget exceeded".into());
    }
    let mut seen = BTreeSet::new();
    for stroke in strokes {
        let m = object(stroke, "Annotation")?;
        if m.keys().any(|k| {
            !["id", "points", "color", "width", "opacity", "createdAt"].contains(&k.as_str())
        }) || !stroke["id"]
            .as_str()
            .is_some_and(|s| !s.is_empty() && s.len() <= 160 && seen.insert(s))
            || !colour(&stroke["color"])
            || !bounded(&stroke["createdAt"], 64)
        {
            return Err("Invalid annotation".into());
        }
        number(&stroke["width"], 0.1, 100., "Stroke width")?;
        number(&stroke["opacity"], 0., 1., "Stroke opacity")?;
        let points = stroke["points"]
            .as_array()
            .ok_or("Stroke points must be an array")?;
        if points.is_empty() || points.len() > 4096 {
            return Err("Stroke point budget exceeded".into());
        }
        for point in points {
            object(point, "Stroke point")?;
            number(&point["x"], -40000., 40000., "Stroke x")?;
            number(&point["y"], -40000., 40000., "Stroke y")?;
            if let Some(v) = point.get("pressure") {
                number(v, 0., 1., "Stroke pressure")?;
            }
        }
    }
    for v in value["views"].as_object().unwrap().values() {
        viewport(v)?;
    }
    for layout in value["timeline"].as_object().unwrap().values() {
        let m = object(layout, "Timeline layout")?;
        if m.keys().any(|k| {
            !["offsetY", "width", "height", "lane", "layoutRevision"].contains(&k.as_str())
        }) {
            return Err("Unknown timeline layout field".into());
        }
        if let Some(v) = m.get("lane") {
            if !bounded(v, 1024) {
                return Err("Invalid timeline lane".into());
            }
        }
        if let Some(v) = m.get("layoutRevision") {
            if !v
                .as_u64()
                .is_some_and(|n| (1..=9007199254740991).contains(&n))
            {
                return Err("Invalid timeline layout revision".into());
            }
        }
        number(&layout["offsetY"], -40000., 40000., "Timeline offset")?;
        for key in ["width", "height"] {
            if let Some(v) = m.get(key) {
                number(v, 40., 40000., "Timeline card size")?;
            }
        }
    }
    Ok(())
}
fn validate_note(value: &Value, depth: usize) -> Result<(), String> {
    if depth > 24 {
        return Err("Rich note nesting budget exceeded".into());
    }
    match value {
        Value::Array(values) => {
            if values.len() > 1024 {
                return Err("Rich note array budget exceeded".into());
            }
            for v in values {
                validate_note(v, depth + 1)?;
            }
        }
        Value::Object(values) => {
            for (key, v) in values {
                if ["__proto__", "prototype", "constructor"].contains(&key.as_str())
                    || (key == "type"
                        && matches!(v.as_str(), Some("image" | "video" | "audio" | "file")))
                {
                    return Err("Note media requires a native resource binding".into());
                }
                if key == "href"
                    && !v.as_str().is_some_and(|s| {
                        let s = s.to_ascii_lowercase();
                        ["https:", "http:", "mailto:"]
                            .iter()
                            .any(|p| s.starts_with(p))
                    })
                {
                    return Err("Unsupported note link".into());
                }
                if key == "url" && v.as_str() != Some("") && !v.is_null() {
                    return Err("Note media requires a native resource binding".into());
                }
                validate_note(v, depth + 1)?;
            }
        }
        _ => {}
    }
    Ok(())
}

/// Only known presentation-local identity fields are remapped on a native
/// fork. Source refs, evidence and arbitrary caption text are never rewritten.
pub fn fork(presentation: &mut Presentation, old: &str, new: &str) {
    let prefix = format!("{old}:");
    let map = |reference: &str| {
        reference
            .strip_prefix(&prefix)
            .map(|suffix| format!("{new}:{suffix}"))
    };
    for material in std::iter::once(&mut presentation.scene).chain(presentation.saved.iter_mut()) {
        remap_refs(material, &map);
    }
}

/// Remap every known presentation-local identity field of one authoring
/// Scene (`id`, entity ids, blueprint members, research cards, native config
/// entities, automation/track/toolbelt entity ids, semantic carriers). The
/// mapping returns `None` to keep a ref. Source refs, evidence and caption
/// text are never rewritten. Shared by native fork and act performance.
pub fn remap_refs(material: &mut Value, remap: &dyn Fn(&str) -> Option<String>) {
    crate::expression_parameter_rack::remap_refs(material, remap);
    let map = |value: &mut Value| {
        if let Some(next) = value.as_str().and_then(remap) {
            *value = Value::String(next);
        }
    };
    {
        map(&mut material["id"]);
        if let Some(members) = material
            .get_mut("composition")
            .and_then(|v| v.get_mut("blueprint"))
            .and_then(|v| v.get_mut("members"))
            .and_then(Value::as_array_mut)
        {
            for member in members {
                map(&mut member["entity_ref"]);
            }
        }
        if let Some(entities) = material["entities"].as_array_mut() {
            for entity in entities {
                map(&mut entity["id"]);
            }
        }
        if let Some(research) = material.get_mut("research") {
            if let Some(cards) = research.get_mut("cards").and_then(Value::as_object_mut) {
                let previous = std::mem::take(cards);
                for (id, card) in previous {
                    let mut key = Value::String(id);
                    map(&mut key);
                    cards.insert(key.as_str().unwrap().to_owned(), card);
                }
            }
        }
        if let Some(native) = material.get_mut("native") {
            for key in ["config", "projection"] {
                if let Some(entities) = native
                    .get_mut(key)
                    .and_then(|config| config.get_mut("entities"))
                    .and_then(Value::as_array_mut)
                {
                    for entity in entities {
                        map(&mut entity["id"]);
                    }
                }
            }
        }
        for key in ["automation", "propertyTracks", "toolbelt"] {
            if let Some(values) = material.get_mut(key).and_then(Value::as_array_mut) {
                for value in values {
                    if value.get("entityId").is_some() {
                        map(&mut value["entityId"]);
                    }
                }
            }
        }
        if let Some(bindings) = material
            .get_mut("semanticField")
            .and_then(|field| field.get_mut("bindings"))
            .and_then(Value::as_array_mut)
        {
            for binding in bindings {
                if let Some(carriers) = binding["carriers"].as_array_mut() {
                    for carrier in carriers {
                        if carrier["kind"] == "entity" {
                            map(&mut carrier["id"]);
                        }
                    }
                }
            }
        }
    }
}

/// A native entity edit changes that entity's presentation in every Scene in
/// which it occurs. Scene-specific edits use SceneMaterialSet instead. These
/// conversions are the existing authoring model's documented stage units.
pub fn set_parameter(presentation: &mut Presentation, reference: &str, key: &str, value: &Value) {
    let Some(entities) = presentation
        .scene
        .get_mut("entities")
        .and_then(Value::as_array_mut)
    else {
        return;
    };
    for entity in entities
        .iter_mut()
        .filter(|entity| entity["id"] == reference)
    {
        match key {
            "x" | "y" | "z" => {
                if let Some(number) = value.as_f64() {
                    entity["position"][key] = Value::from(number / 400.0);
                }
            }
            "width" | "height" => {
                if let Some(number) = value.as_f64() {
                    entity["size"][if key == "width" { "x" } else { "y" }] =
                        Value::from(number / 400.0);
                }
            }
            "rotation" => {
                if let Some(number) = value.as_f64() {
                    entity["rotation"] = Value::from(number.to_degrees());
                }
            }
            "scale" | "share" | "kind" => entity[key] = value.clone(),
            "glyph" => entity["text"] = value.clone(),
            "shape" => {
                entity["shape"] = if value == "glyph" {
                    Value::from("text")
                } else {
                    value.clone()
                }
            }
            "yantra" => entity["yantraId"] = value.clone(),
            "frequency" => entity["templateFrequency"] = value.clone(),
            "force_mode" => entity["force"]["kind"] = value.clone(),
            "force_strength" => entity["force"]["strength"] = value.clone(),
            "force_spin" => entity["force"]["spin"] = value.clone(),
            "force_radius" => {
                if let Some(number) = value.as_f64() {
                    entity["force"]["radius"] = Value::from(number / 400.0);
                }
            }
            "ascii" => {
                if value.as_str() == Some("") {
                    entity.as_object_mut().unwrap().remove("source");
                } else {
                    entity["source"] = serde_json::json!({"kind":"ascii","ascii":{"text":value}});
                }
            }
            "image" => {
                if value.as_str() == Some("") {
                    entity.as_object_mut().unwrap().remove("source");
                } else {
                    entity["source"] = serde_json::json!({"kind":"image","image":{"dataUrl":value,"mode":"luminance","threshold":0.5,"invert":false,"scale":1.0}});
                }
            }
            _ => {}
        }
    }
}

/// A native entity removal retires its presentation-local automation/control
/// bindings as well. It is not a retraction of that entity's source or native
/// knowledge relations; those remain owned by the source system.
pub fn remove_entity(presentation: &mut Presentation, reference: &str) {
    for material in std::iter::once(&mut presentation.scene).chain(presentation.saved.iter_mut()) {
        crate::expression_parameter_rack::remove_entity(material, reference);
        if let Some(entities) = material.get_mut("entities").and_then(Value::as_array_mut) {
            entities.retain(|entity| entity["id"] != reference);
        }
        if let Some(cards) = material
            .get_mut("research")
            .and_then(|r| r.get_mut("cards"))
            .and_then(Value::as_object_mut)
        {
            cards.remove(reference);
        }
        for key in ["automation", "propertyTracks", "toolbelt"] {
            if let Some(values) = material.get_mut(key).and_then(Value::as_array_mut) {
                values.retain(|value| value["entityId"] != reference);
            }
        }
        if let Some(bindings) = material
            .get_mut("semanticField")
            .and_then(|field| field.get_mut("bindings"))
            .and_then(Value::as_array_mut)
        {
            for binding in bindings.iter_mut() {
                if let Some(carriers) = binding.get_mut("carriers").and_then(Value::as_array_mut) {
                    carriers.retain(|carrier| {
                        !(carrier["kind"] == "entity" && carrier["id"] == reference)
                    });
                }
            }
            bindings.retain(|binding| {
                binding["carriers"]
                    .as_array()
                    .is_some_and(|carriers| !carriers.is_empty())
            });
        }
    }
}

/// Device widgets are an ordered list of identities in the shared Expression
/// properties. The kernel admits only that bounded identity shape; the shell
/// owns the closed family vocabulary and its instance rules.
fn device_widgets(value: &Value) -> Result<(), String> {
    let entries = value
        .as_array()
        .filter(|entries| entries.len() <= 64)
        .ok_or_else(|| "Shared device widgets require a bounded list of 64 entries".to_string())?;
    let mut ids = BTreeSet::new();
    for entry in entries {
        let fields = object(entry, "Shared device widget")?;
        let (Some(id), Some(family)) = (
            fields.get("id").and_then(Value::as_str),
            fields.get("family").and_then(Value::as_str),
        ) else {
            return Err("Shared device widget requires string id and family".into());
        };
        if fields.len() != 2
            || !(1..=128).contains(&id.chars().count())
            || !(1..=64).contains(&family.len())
            || !family
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        {
            return Err("Shared device widget is outside its identity bounds".into());
        }
        if !ids.insert(id) {
            return Err("Shared device widget identities must be unique".into());
        }
    }
    Ok(())
}

/// Expression-wide properties of the existing Journey authoring model. Scenes
/// stay in Document.scenes; this contains no duplicate Scene or subject store.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Composition {
    pub schema: String,
    pub description: String,
    #[serde(rename = "loop")]
    pub loop_playback: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shared: Option<Value>,
}

impl Composition {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != "oi.journey-properties/v1" || self.description.len() > 20_000 {
            return Err("Unsupported or unbounded Expression presentation".into());
        }
        if let Some(shared) = &self.shared {
            data(shared, 0)?;
            let fields = object(shared, "Shared authoring properties")?;
            if fields
                .keys()
                .any(|key| !["toolbelt", "values", "pointer", "devices"].contains(&key.as_str()))
            {
                return Err("Unknown shared authoring property".into());
            }
            for key in ["values", "pointer"] {
                let values = object(&shared[key], key)?;
                if values.len() > 1024
                    || values.values().any(|value| {
                        !value.is_string() && !value.is_boolean() && !value.is_number()
                    })
                {
                    return Err("Shared values must be bounded scalar authoring properties".into());
                }
            }
            if !shared["toolbelt"]
                .as_array()
                .is_some_and(|values| values.len() <= 2048)
            {
                return Err("Shared toolbelt requires a bounded entry list".into());
            }
            if let Some(devices) = fields.get("devices") {
                device_widgets(devices)?;
            }
        }
        Ok(())
    }

    pub fn fork(&mut self, old: &str, new: &str) {
        if let Some(entries) = self
            .shared
            .as_mut()
            .and_then(|value| value.get_mut("toolbelt"))
            .and_then(Value::as_array_mut)
        {
            for entry in entries {
                if let Some(reference) = entry["entityId"].as_str() {
                    if let Some(suffix) = reference.strip_prefix(&format!("{old}:")) {
                        entry["entityId"] = Value::String(format!("{new}:{suffix}"));
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Composition;
    use serde_json::{json, Value};

    fn composition(shared: Value) -> Composition {
        Composition {
            schema: "oi.journey-properties/v1".into(),
            description: String::new(),
            loop_playback: true,
            shared: Some(shared),
        }
    }

    #[test]
    fn shared_device_widgets_admit_only_the_bounded_ordered_identity_list() {
        let with_devices = |devices: Value| json!({"toolbelt": [], "values": {}, "pointer": {}, "devices": devices});
        assert!(
            composition(json!({"toolbelt": [], "values": {}, "pointer": {}}))
                .validate()
                .is_ok()
        );
        assert!(composition(with_devices(json!([]))).validate().is_ok());
        assert!(composition(with_devices(json!([
            {"id": "physics-1", "family": "physics"},
            {"id": "force-2", "family": "force"}
        ])))
        .validate()
        .is_ok());

        let oversized: Vec<Value> = (0..65)
            .map(|index| json!({"id": format!("force-{index}"), "family": "force"}))
            .collect();
        let refused = [
            json!({"id": "physics-1", "family": "physics"}),
            json!([{"id": "a", "family": "physics"}, {"id": "a", "family": "force"}]),
            json!([{"id": "a", "family": "physics", "extra": true}]),
            json!([{"id": "a"}]),
            json!([{"id": 1, "family": "physics"}]),
            json!([{"id": "", "family": "physics"}]),
            json!([{"id": "x".repeat(129), "family": "physics"}]),
            json!([{"id": "a", "family": "Physics"}]),
            json!([{"id": "a", "family": "phys ics"}]),
            json!([{"id": "a", "family": ""}]),
            json!([{"id": "a", "family": "x".repeat(65)}]),
            Value::Array(oversized),
        ];
        for devices in refused {
            assert!(
                composition(with_devices(devices.clone()))
                    .validate()
                    .is_err(),
                "accepted {devices}"
            );
        }

        let mut unknown = with_devices(json!([]));
        unknown["authority"] = json!("write-anywhere");
        assert!(composition(unknown).validate().is_err());
    }
}
