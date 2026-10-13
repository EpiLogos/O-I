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
/// A string's length as the app's JavaScript reads it (`string.length`, UTF-16 code units).
fn utf16_len(s: &str) -> usize {
    s.encode_utf16().count()
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

/// A Scene's painted transition (lane-3 E11): `cut`, `dip-to-colour` (optional `at` in [0.2, 0.8]) or `wipe`
/// (optional `direction`). Crossfade is the default and is carried by absence, so it is not admitted here.
fn transition_spec(value: &Value) -> Result<(), String> {
    let spec = object(value, "Scene transition kind")?;
    let kind = spec.get("kind").and_then(Value::as_str).unwrap_or("");
    let params: &[&str] = match kind {
        "cut" => &[],
        "dip-to-colour" => &["at"],
        "wipe" => &["direction"],
        _ => return Err("Unknown Scene transition kind".into()),
    };
    if spec
        .keys()
        .any(|key| key != "kind" && !params.contains(&key.as_str()))
    {
        return Err("Unknown Scene transition parameter".into());
    }
    if let Some(at) = spec.get("at") {
        number(at, 0.2, 0.8, "Dip to colour point")?;
    }
    if let Some(direction) = spec.get("direction") {
        if !matches!(direction.as_str(), Some("left" | "right" | "up" | "down")) {
            return Err("Invalid wipe direction".into());
        }
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
        "transitionSpec",
        "entryOffset",
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
    // E06 slip and E11 typed transitions: timeline facts the editor writes inside the Scene material.
    if let Some(offset) = material.get("entryOffset") {
        number(offset, 0.0, 3600.0, "Scene entry offset")?;
    }
    if let Some(spec) = material.get("transitionSpec") {
        transition_spec(spec)?;
    }
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
        || r.keys().any(|key| {
            ![
                "schema",
                "cards",
                "strokes",
                "views",
                "timeline",
                "frames",
                "namedViews",
                "connectors",
                "placeViews",
                "placeLayers",
                "timelineViews",
            ]
            .contains(&key.as_str())
        })
    {
        return Err("Invalid or unbounded research Scene material".into());
    }
    for key in ["cards", "views", "timeline"] {
        let rows = object(&value[key], key)?;
        if rows.len() > if key == "views" { 16 } else { 256 } {
            return Err("Research record budget exceeded".into());
        }
    }
    // Lengths are counted as the app counts them (JavaScript string length: UTF-16 code units), never bytes.
    let bounded = |v: &Value, max: usize| v.as_str().is_some_and(|s| utf16_len(s) <= max);
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
            .any(|k| !["x", "y", "zoom", "pitch", "bearing"].contains(&k.as_str()))
        {
            return Err("Unknown viewport field".into());
        }
        number(&v["x"], -1e8, 1e8, "Viewport x")?;
        number(&v["y"], -1e8, 1e8, "Viewport y")?;
        number(&v["zoom"], 0.001, 1e5, "Viewport zoom")?;
        // lane-4 T1: a Places view may be tilted and rotated; both optional,
        // absent = the untilted, north-up view every earlier record means.
        if map.contains_key("pitch") {
            number(&v["pitch"], 0.0, 85.0, "Viewport pitch")?;
        }
        if map.contains_key("bearing") {
            number(&v["bearing"], -180.0, 180.0, "Viewport bearing")?;
        }
        Ok(())
    };
    for (id, card) in value["cards"].as_object().unwrap() {
        let c = object(card, "Research card")?;
        let kind = card["type"].as_str();
        if !ids.contains(id.as_str())
            || !matches!(kind, Some("note" | "image" | "sticky" | "shape" | "text"))
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
                    "size",
                    "palette",
                    "shape",
                    "fill",
                ]
                .contains(&k.as_str())
            })
        {
            return Err(
                "Research card must address a disclosed occurrence with an admitted kind".into(),
            );
        }
        // lane-1 A2: a card's display size is bounded like the presentation
        // record it is (the same width/height law as the JS material); a
        // sticky's colour is a palette KEY, a shape carries its geometry and
        // a fill key, and each field is admitted only on its own kind.
        const PALETTE: &[&str] = &["amber", "sage", "sky", "rose", "stone"];
        if let Some(size) = c.get("size") {
            let m = object(size, "Research card display size")?;
            if m.keys().any(|k| k != "width" && k != "height") {
                return Err("Invalid card display size".into());
            }
            number(&size["width"], 40., 40000., "Card width")?;
            number(&size["height"], 40., 40000., "Card height")?;
        }
        if let Some(palette) = c.get("palette") {
            if kind != Some("sticky") || !palette.as_str().is_some_and(|s| PALETTE.contains(&s)) {
                return Err("Invalid sticky colour".into());
            }
        }
        if kind == Some("shape") {
            if !card["shape"]
                .as_str()
                .is_some_and(|s| ["rectangle", "ellipse", "diamond"].contains(&s))
            {
                return Err("Invalid shape".into());
            }
            if let Some(fill) = c.get("fill") {
                if !fill
                    .as_str()
                    .is_some_and(|s| s == "none" || PALETTE.contains(&s))
                {
                    return Err("Invalid shape".into());
                }
            }
        } else if c.contains_key("shape") || c.contains_key("fill") {
            return Err("Only shape cards carry a geometry or fill".into());
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
            .is_some_and(|s| !s.is_empty() && utf16_len(s) <= 160 && seen.insert(s))
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
            ![
                "offsetY",
                "width",
                "height",
                "lane",
                "layoutRevision",
                "style",
            ]
            .contains(&k.as_str())
        }) {
            return Err("Unknown timeline layout field".into());
        }
        // lane-2 T16: a card's colours, in the card-style colour grammar. Closed: dotColour, bgColour, textColour only.
        if let Some(style) = m.get("style") {
            let style = object(style, "Timeline style")?;
            if style.iter().any(|(k, c)| {
                !["dotColour", "bgColour", "textColour"].contains(&k.as_str()) || !colour(c)
            }) {
                return Err("Invalid timeline style".into());
            }
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
    // Frames and named views (lane-1, researchMaterial.ts): absent in material saved before they existed; present,
    // they are bounded and closed exactly as the app validates them.
    let refs = |v: &Value, min: usize, members: bool| {
        v.as_array().is_some_and(|rows| {
            rows.len() >= min
                && rows.len() <= 64
                && rows.iter().all(|row| {
                    row.as_str()
                        .is_some_and(|r| r.len() <= 1024 && (!members || ids.contains(r)))
                })
        })
    };
    if let Some(frames) = r.get("frames") {
        let frames = object(frames, "Research frames")?;
        if frames.len() > 64 {
            return Err("Research frame count exceeds its bound".into());
        }
        for (id, frame) in frames {
            let f = object(frame, "Research frame")?;
            if id.len() > 1024
                || f.keys()
                    .any(|k| !["label", "memberRefs", "z"].contains(&k.as_str()))
            {
                return Err("Invalid frame".into());
            }
            if !f["label"]
                .as_str()
                .is_some_and(|l| !l.trim().is_empty() && utf16_len(l) <= 160)
            {
                return Err("Invalid frame label".into());
            }
            if !refs(&f["memberRefs"], 1, true) {
                return Err("Invalid frame membership".into());
            }
            if !f["z"].is_i64() && !f["z"].is_u64() {
                return Err("Invalid frame order".into());
            }
        }
    }
    if let Some(named) = r.get("namedViews") {
        let named = object(named, "Research named views")?;
        if named.len() > 32 {
            return Err("Research named view count exceeds its bound".into());
        }
        for (name, view) in named {
            let v = object(view, "Research named view")?;
            if name.trim().is_empty()
                || utf16_len(name) > 160
                || v.keys()
                    .any(|k| !["viewport", "selectedRefs", "frameOrder"].contains(&k.as_str()))
            {
                return Err("Invalid named view".into());
            }
            viewport(&v["viewport"])?;
            if !refs(&v["selectedRefs"], 0, false) {
                return Err("Invalid view selection".into());
            }
            if !refs(&v["frameOrder"], 0, false) {
                return Err("Invalid view frame order".into());
            }
        }
    }
    // lane-1 A3–A4: presentation connectors keyed by the native edge id. The
    // kind, label and card sides are closed; the relation itself is native.
    if let Some(connectors) = r.get("connectors") {
        let connectors = object(connectors, "Research connectors")?;
        if connectors.len() > 256 {
            return Err("Research connector count exceeds its bound".into());
        }
        for (edge, connector) in connectors {
            if edge.is_empty() || edge.len() > 1024 {
                return Err("Invalid connector edge".into());
            }
            let c = object(connector, "Research connector")?;
            if c.keys()
                .any(|k| !["kind", "label", "fromSide", "toSide"].contains(&k.as_str()))
            {
                return Err("Unknown connector field".into());
            }
            if !c
                .get("kind")
                .and_then(Value::as_str)
                .is_some_and(|k| ["straight", "curved", "elbow"].contains(&k))
            {
                return Err("Invalid connector kind".into());
            }
            if let Some(label) = c.get("label") {
                if !label
                    .as_str()
                    .is_some_and(|l| !l.trim().is_empty() && l.chars().count() <= 160)
                {
                    return Err("Invalid connector label".into());
                }
            }
            for side in ["fromSide", "toSide"] {
                if let Some(value) = c.get(side) {
                    if !value
                        .as_str()
                        .is_some_and(|s| ["top", "right", "bottom", "left"].contains(&s))
                    {
                        return Err("Invalid connector side".into());
                    }
                }
            }
        }
    }
    // lane-4 T20: named Places views, kept beside the canvas views. Each is closed and refs-free (see place_view).
    if let Some(places) = r.get("placeViews") {
        let places = object(places, "Research place views")?;
        if places.len() > 32 {
            return Err("Research place view count exceeds its bound".into());
        }
        for (name, view) in places {
            if name.trim().is_empty() || utf16_len(name) > 160 {
                return Err("Invalid place view name".into());
            }
            place_view(view)?;
        }
    }
    // lane-4 T21: the Places layer toggles and basemap rows the Scene keeps, written whole. Absent = every layer on.
    if let Some(layers) = r.get("placeLayers") {
        place_layers(layers)?;
    }
    // lane-2 T15: named timeline views, kept beside the canvas and Places views. Each is closed and bounded (see timeline_view).
    if let Some(views) = r.get("timelineViews") {
        let views = object(views, "Research timeline views")?;
        if views.len() > 32 {
            return Err("Research timeline view count exceeds its bound".into());
        }
        for (name, view) in views {
            if name.trim().is_empty() || utf16_len(name) > 160 {
                return Err("Invalid timeline view name".into());
            }
            timeline_view(view)?;
        }
    }
    Ok(())
}
/// lane-2 T15: the timeline categories the lens filters by (categories.ts). The app and this kernel hold one list.
const TIMELINE_CATEGORY_IDS: &[&str] = &[
    "historical-event",
    "claim",
    "interpretation",
    "archetype",
    "myth-in-time",
    "myth",
    "speculation-contested",
    "source",
    "book-writing",
    "constellation",
    "institution-network-figure",
];
/// lane-2 T15: the camera's bounds (researchMaterial.ts): years either side of zero, and the zoom range (the lens floor up to a ceiling above its maximum).
const TIMELINE_CENTER_YEAR_LIMIT: f64 = 1e10;
const TIMELINE_PIXELS_PER_YEAR_LOW: f64 = 1e-9;
const TIMELINE_PIXELS_PER_YEAR_HIGH: f64 = 1e14;
/// lane-2 T15–T18: a ref a view names (a graph node or a cause-chain id): a non-empty string of at most 512 UTF-16 units.
fn timeline_ref(value: &Value) -> bool {
    value
        .as_str()
        .is_some_and(|s| !s.is_empty() && utf16_len(s) <= 512)
}
/// lane-2 T15–T18: one named timeline view, admitted closed and bounded. The camera, the projection and relation links, the
/// filters, the walk chain, the optional frame and the working set (at most 64, unique). Refs are bounded strings; the native
/// owner resolves them on restore, so no ref is checked against the Scene.
fn timeline_view(value: &Value) -> Result<(), String> {
    let view = object(value, "Timeline view")?;
    let allowed = [
        "camera",
        "projection",
        "relationLinks",
        "filters",
        "chainId",
        "frameNodeId",
        "workingSetRefs",
    ];
    if view.keys().any(|k| !allowed.contains(&k.as_str()))
        || ![
            "camera",
            "projection",
            "relationLinks",
            "filters",
            "chainId",
            "workingSetRefs",
        ]
        .iter()
        .all(|k| view.contains_key(*k))
    {
        return Err("Invalid timeline view".into());
    }
    let camera = object(&value["camera"], "Timeline view camera")?;
    if camera
        .keys()
        .any(|k| !["centerYear", "pixelsPerYear"].contains(&k.as_str()))
        || !camera.contains_key("centerYear")
        || !camera.contains_key("pixelsPerYear")
    {
        return Err("Timeline view camera exceeds its bound".into());
    }
    number(
        &value["camera"]["centerYear"],
        -TIMELINE_CENTER_YEAR_LIMIT,
        TIMELINE_CENTER_YEAR_LIMIT,
        "Timeline view centre",
    )?;
    number(
        &value["camera"]["pixelsPerYear"],
        TIMELINE_PIXELS_PER_YEAR_LOW,
        TIMELINE_PIXELS_PER_YEAR_HIGH,
        "Timeline view zoom",
    )?;
    if !matches!(
        value["projection"].as_str(),
        Some("chronology") | Some("relations")
    ) {
        return Err("Invalid timeline view projection".into());
    }
    if !value["relationLinks"].is_boolean() {
        return Err("Invalid timeline view relation links".into());
    }
    let filters = object(&value["filters"], "Timeline view filters")?;
    if filters
        .keys()
        .any(|k| !["hiddenCategories", "relationTypes", "tags"].contains(&k.as_str()))
        || !["hiddenCategories", "relationTypes", "tags"]
            .iter()
            .all(|k| filters.contains_key(*k))
    {
        return Err("Invalid timeline view filters".into());
    }
    let hidden = value["filters"]["hiddenCategories"]
        .as_array()
        .ok_or("Invalid timeline view category filter")?;
    if hidden.len() > TIMELINE_CATEGORY_IDS.len()
        || !hidden.iter().all(|c| {
            c.as_str()
                .is_some_and(|s| TIMELINE_CATEGORY_IDS.contains(&s))
        })
    {
        return Err("Invalid timeline view category filter".into());
    }
    let named = |v: &Value| {
        v.as_str()
            .is_some_and(|s| !s.is_empty() && utf16_len(s) <= 160)
    };
    match &value["filters"]["relationTypes"] {
        Value::Null => {}
        Value::Array(rows) => {
            if rows.len() > 256 || !rows.iter().all(named) {
                return Err("Invalid timeline view relation filter".into());
            }
        }
        _ => return Err("Invalid timeline view relation filter".into()),
    }
    let tags = value["filters"]["tags"]
        .as_array()
        .ok_or("Invalid timeline view tag filter")?;
    if tags.len() > 256 || !tags.iter().all(named) {
        return Err("Invalid timeline view tag filter".into());
    }
    if !(value["chainId"].is_null() || timeline_ref(&value["chainId"])) {
        return Err("Invalid timeline view walk".into());
    }
    if let Some(frame) = view.get("frameNodeId") {
        if !timeline_ref(frame) {
            return Err("Invalid timeline view frame".into());
        }
    }
    let refs = value["workingSetRefs"]
        .as_array()
        .ok_or("Invalid timeline view working set")?;
    let mut unique = BTreeSet::new();
    if refs.len() > 64
        || !refs
            .iter()
            .all(|r| timeline_ref(r) && unique.insert(r.as_str().unwrap_or_default()))
    {
        return Err("Invalid timeline view working set".into());
    }
    Ok(())
}
/// lane-4 T20: the basemap registry's own ids (basemapSources.ts). The app and this kernel hold one list; a JS test reads both.
const BASEMAP_LAYER_IDS: &[&str] = &[
    "offline-ground",
    "osm-street",
    "eox-sentinel2",
    "esri-imagery",
    "esri-place-names",
];
const PLACE_STANDINGS: &[&str] = &["factual", "mythic", "owner-vocabulary"];
/// lane-4 T20: one named Places view, admitted closed. The camera is longitude x, latitude y, zoom, and optional pitch
/// and bearing; the layer toggles, the basemap rows and the shared time window are each optional or nullable. No
/// allowance for live sources and no occurrence refs: a view is presentation only.
fn place_view(value: &Value) -> Result<(), String> {
    let view = object(value, "Place view")?;
    if view
        .keys()
        .any(|k| !["viewport", "relations", "standing", "basemap", "window"].contains(&k.as_str()))
        || !view.contains_key("viewport")
        || !view.contains_key("window")
    {
        return Err("Invalid place view".into());
    }
    let camera = object(&value["viewport"], "Place view camera")?;
    if camera
        .keys()
        .any(|k| !["x", "y", "zoom", "pitch", "bearing"].contains(&k.as_str()))
    {
        return Err("Unknown viewport field".into());
    }
    number(&value["viewport"]["x"], -180.0, 180.0, "Viewport longitude")?;
    number(&value["viewport"]["y"], -90.0, 90.0, "Viewport latitude")?;
    number(&value["viewport"]["zoom"], 0.001, 1e5, "Viewport zoom")?;
    if camera.contains_key("pitch") {
        number(&value["viewport"]["pitch"], 0.0, 85.0, "Viewport pitch")?;
    }
    if camera.contains_key("bearing") {
        number(
            &value["viewport"]["bearing"],
            -180.0,
            180.0,
            "Viewport bearing",
        )?;
    }
    if let Some(relations) = view.get("relations") {
        let rows = relations.as_array().ok_or("Invalid place view layers")?;
        if rows.len() > 256
            || rows
                .iter()
                .any(|row| !row.as_str().is_some_and(|s| utf16_len(s) <= 160))
        {
            return Err("Invalid place view layers".into());
        }
    }
    if let Some(standing) = view.get("standing") {
        let rows = standing.as_array().ok_or("Invalid place view standing")?;
        if rows.len() > PLACE_STANDINGS.len()
            || rows
                .iter()
                .any(|row| !row.as_str().is_some_and(|s| PLACE_STANDINGS.contains(&s)))
        {
            return Err("Invalid place view standing".into());
        }
    }
    if let Some(basemap) = view.get("basemap") {
        let basemap = object(basemap, "Place view basemap")?;
        if basemap
            .keys()
            .any(|k| !["terrainVisible", "layers"].contains(&k.as_str()))
            || !basemap.get("terrainVisible").is_some_and(Value::is_boolean)
        {
            return Err("Invalid place view basemap".into());
        }
        let Some(layers) = basemap.get("layers") else {
            return Err("Invalid place view basemap".into());
        };
        let layers = object(layers, "Place view basemap layers")?;
        if layers.len() > BASEMAP_LAYER_IDS.len() {
            return Err("Place view basemap exceeds its bound".into());
        }
        for (id, layer) in layers {
            if !BASEMAP_LAYER_IDS.contains(&id.as_str()) {
                return Err("Unknown basemap layer".into());
            }
            let row = object(layer, "Basemap layer")?;
            if row
                .keys()
                .any(|k| !["visible", "opacity"].contains(&k.as_str()))
                || !row.get("visible").is_some_and(Value::is_boolean)
            {
                return Err("Invalid basemap layer".into());
            }
            number(&layer["opacity"], 0.0, 1.0, "Basemap opacity")?;
        }
    }
    let window = &value["window"];
    if !window.is_null() {
        let span = object(window, "Place view window")?;
        if span.keys().any(|k| !["from", "to"].contains(&k.as_str()))
            || !["from", "to"].iter().all(|bound| {
                span.get(*bound)
                    .is_some_and(|v| v.is_null() || v.as_str().is_some_and(|s| utf16_len(s) <= 64))
            })
        {
            return Err("Invalid place view window".into());
        }
    }
    Ok(())
}
/// lane-4 T21: the Places layer toggles and basemap rows the Scene keeps, admitted closed and bounded the way a view's layers
/// are (see place_view). Every field is optional; the basemap ids are the same list the app holds; no live-source allowance.
fn place_layers(value: &Value) -> Result<(), String> {
    let layers = object(value, "Research place layers")?;
    if layers
        .keys()
        .any(|k| !["relations", "standing", "basemap"].contains(&k.as_str()))
    {
        return Err("Invalid place layers".into());
    }
    if let Some(relations) = layers.get("relations") {
        let rows = relations.as_array().ok_or("Invalid place layers")?;
        if rows.len() > 256
            || rows
                .iter()
                .any(|row| !row.as_str().is_some_and(|s| utf16_len(s) <= 160))
        {
            return Err("Invalid place layers".into());
        }
    }
    if let Some(standing) = layers.get("standing") {
        let rows = standing.as_array().ok_or("Invalid place layers standing")?;
        if rows.len() > PLACE_STANDINGS.len()
            || rows
                .iter()
                .any(|row| !row.as_str().is_some_and(|s| PLACE_STANDINGS.contains(&s)))
        {
            return Err("Invalid place layers standing".into());
        }
    }
    if let Some(basemap) = layers.get("basemap") {
        let basemap = object(basemap, "Place layers basemap")?;
        if basemap
            .keys()
            .any(|k| !["terrainVisible", "layers"].contains(&k.as_str()))
            || !basemap.get("terrainVisible").is_some_and(Value::is_boolean)
        {
            return Err("Invalid place layers basemap".into());
        }
        let rows_by_id = object(
            basemap.get("layers").unwrap_or(&Value::Null),
            "Place layers basemap rows",
        )?;
        if rows_by_id.len() > BASEMAP_LAYER_IDS.len() {
            return Err("Place layers basemap exceeds its bound".into());
        }
        for (id, row) in rows_by_id {
            if !BASEMAP_LAYER_IDS.contains(&id.as_str()) {
                return Err("Unknown basemap layer".into());
            }
            let row = object(row, "Basemap layer")?;
            if row
                .keys()
                .any(|k| !["visible", "opacity"].contains(&k.as_str()))
                || !row.get("visible").is_some_and(Value::is_boolean)
            {
                return Err("Invalid basemap layer".into());
            }
            number(
                row.get("opacity").unwrap_or(&Value::Null),
                0.0,
                1.0,
                "Basemap opacity",
            )?;
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
    /// E12 journey markers: named, coloured time points on the journey clock. Authoring furniture.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub markers: Option<Vec<Value>>,
    /// E13 loop region {from, to} on the journey clock; absent means no region.
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "loopRegion"
    )]
    pub loop_region: Option<Value>,
}

/// Upper bound for any journey time: 64 scenes of at most 3600 seconds each.
const JOURNEY_TIME_MAX: f64 = 64.0 * 3600.0;
const MARKER_COLOURS: [&str; 5] = ["amber", "rose", "sage", "sky", "violet"];

fn markers(rows: &[Value]) -> Result<(), String> {
    if rows.len() > 64 {
        return Err("Journey markers are bounded to 64".into());
    }
    let mut ids = BTreeSet::new();
    for row in rows {
        let fields = object(row, "Journey marker")?;
        if fields
            .keys()
            .any(|key| !["id", "name", "time", "colour"].contains(&key.as_str()))
        {
            return Err("Unknown journey marker field".into());
        }
        let id = fields.get("id").and_then(Value::as_str).unwrap_or_default();
        if !(1..=160).contains(&id.len())
            || !id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"_.:-".contains(&b))
            || !ids.insert(id)
        {
            return Err("Journey marker identities must be unique and safe".into());
        }
        let name = fields
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if !(1..=80).contains(&utf16_len(name)) {
            return Err("Journey marker names are 1 to 80 characters".into());
        }
        number(
            fields.get("time").unwrap_or(&Value::Null),
            0.0,
            JOURNEY_TIME_MAX,
            "Journey marker time",
        )?;
        let colour = fields
            .get("colour")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if !MARKER_COLOURS.contains(&colour) {
            return Err("Journey marker colour must be a palette key".into());
        }
    }
    Ok(())
}

fn loop_region(value: &Value) -> Result<(), String> {
    let fields = object(value, "Loop region")?;
    if fields.len() != 2 || !fields.contains_key("from") || !fields.contains_key("to") {
        return Err("Loop region carries exactly from and to".into());
    }
    number(&fields["from"], 0.0, JOURNEY_TIME_MAX, "Loop region in")?;
    number(&fields["to"], 0.0, JOURNEY_TIME_MAX, "Loop region out")?;
    let from = fields["from"].as_f64().unwrap_or_default();
    let to = fields["to"].as_f64().unwrap_or_default();
    if to - from < 0.05 {
        return Err("Loop region out must follow its in by at least 0.05 seconds".into());
    }
    Ok(())
}

impl Composition {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != "oi.journey-properties/v1" || self.description.len() > 20_000 {
            return Err("Unsupported or unbounded Expression presentation".into());
        }
        if let Some(rows) = &self.markers {
            markers(rows)?;
        }
        if let Some(region) = &self.loop_region {
            loop_region(region)?;
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
    #[test]
    fn lengths_are_counted_as_the_app_counts_them() {
        use super::{utf16_len, validate_research};
        use serde_json::json;
        use std::collections::BTreeSet;
        // 3,000 CJK characters: 9,000 bytes but 3,000 UTF-16 units — within the 4,096 caption budget the app enforces.
        let ids: BTreeSet<&str> = ["n"].into_iter().collect();
        let long_caption = "漢".repeat(3_000);
        let material = json!({"schema": "oi.research-scene/v1", "cards": {"n": {"type": "note", "caption": long_caption}},
            "strokes": [], "views": {}, "timeline": {}});
        assert!(validate_research(&material, &ids).is_ok());
        // an emoji is two UTF-16 units: 81 of them exceed a 160-unit frame label, as they do in the app
        assert_eq!(utf16_len("😀"), 2);
        let label = "😀".repeat(81);
        let framed = json!({"schema": "oi.research-scene/v1", "cards": {}, "strokes": [], "views": {}, "timeline": {},
            "frames": {"f": {"label": label, "memberRefs": ["n"], "z": 0}}});
        assert!(validate_research(&framed, &ids).is_err());
    }

    #[test]
    fn research_frames_and_named_views_are_admitted_bounded_and_closed() {
        use super::validate_research;
        use serde_json::{json, Value};
        use std::collections::BTreeSet;
        let ids: BTreeSet<&str> = ["a", "b"].into_iter().collect();
        let with = |extra: Value| {
            let mut m = json!({"schema": "oi.research-scene/v1", "cards": {}, "strokes": [],
                "views": {}, "timeline": {}});
            for (k, v) in extra.as_object().unwrap() {
                m[k] = v.clone();
            }
            m
        };
        // material saved before frames existed, and material that carries them
        assert!(validate_research(&with(json!({})), &ids).is_ok());
        assert!(validate_research(&with(json!({
            "frames": {"f1": {"label": "Évora — the walls", "memberRefs": ["a", "b"], "z": 0}},
            "namedViews": {"Overview": {"viewport": {"x": 0, "y": 0, "zoom": 1}, "selectedRefs": ["a"], "frameOrder": ["f1"]}}
        })), &ids).is_ok());
        for refused in [
            json!({"frames": {"f1": {"label": "", "memberRefs": ["a"], "z": 0}}}),
            json!({"frames": {"f1": {"label": "x", "memberRefs": [], "z": 0}}}),
            json!({"frames": {"f1": {"label": "x", "memberRefs": ["missing"], "z": 0}}}),
            json!({"frames": {"f1": {"label": "x", "memberRefs": ["a"], "z": 0.5}}}),
            json!({"frames": {"f1": {"label": "x", "memberRefs": ["a"], "z": 0, "colour": "red"}}}),
            json!({"namedViews": {"v": {"viewport": {"x": 0, "y": 0, "zoom": 1, "roll": 1}, "selectedRefs": [], "frameOrder": []}}}),
            json!({"namedViews": {"v": {"viewport": {"x": 0, "y": 0, "zoom": 1}, "selectedRefs": [], "frameOrder": [], "extra": 1}}}),
            json!({"layers": {}}),
        ] {
            assert!(
                validate_research(&with(refused.clone()), &ids).is_err(),
                "{refused}"
            );
        }
    }

    #[test]
    fn research_connectors_are_admitted_bounded_and_closed() {
        use super::validate_research;
        use serde_json::{json, Value};
        use std::collections::BTreeSet;
        let ids: BTreeSet<&str> = ["a", "b"].into_iter().collect();
        let with = |extra: Value| {
            let mut m = json!({"schema": "oi.research-scene/v1", "cards": {}, "strokes": [],
                "views": {}, "timeline": {}});
            for (k, v) in extra.as_object().unwrap() {
                m[k] = v.clone();
            }
            m
        };
        // material saved before connectors existed, and each closed connector shape
        assert!(validate_research(&with(json!({})), &ids).is_ok());
        assert!(validate_research(&with(json!({
            "connectors": {
                "expr:relation:connection-1": {"kind": "straight"},
                "expr:relation:connection-2": {"kind": "curved", "label": "later", "fromSide": "bottom", "toSide": "top"},
                "expr:relation:connection-3": {"kind": "elbow", "toSide": "left"}
            }
        })), &ids).is_ok());
        for refused in [
            json!({"connectors": {"e": {"kind": "arc"}}}),
            json!({"connectors": {"e": {}}}),
            json!({"connectors": {"e": {"kind": "elbow", "colour": "red"}}}),
            json!({"connectors": {"e": {"kind": "elbow", "label": ""}}}),
            json!({"connectors": {"e": {"kind": "elbow", "label": "   "}}}),
            json!({"connectors": {"e": {"kind": "elbow", "label": "x".repeat(161)}}}),
            json!({"connectors": {"e": {"kind": "elbow", "fromSide": "middle"}}}),
            json!({"connectors": {"e": {"kind": "elbow", "toSide": 3}}}),
            json!({"connectors": {"": {"kind": "elbow"}}}),
            json!({"connectors": ["e"]}),
        ] {
            assert!(
                validate_research(&with(refused.clone()), &ids).is_err(),
                "{refused}"
            );
        }
    }

    #[test]
    fn timeline_views_and_card_style_are_admitted_bounded_and_closed() {
        use super::validate_research;
        use serde_json::{json, Value};
        use std::collections::BTreeSet;
        let ids: BTreeSet<&str> = BTreeSet::new();
        // one material with the given named timeline views and timeline layout records
        let material = |views: Value, timeline: Value| {
            json!({"schema": "oi.research-scene/v1", "cards": {}, "strokes": [],
                "views": {}, "timeline": timeline, "timelineViews": views})
        };
        let full = json!({
            "camera": {"centerYear": 1850.5, "pixelsPerYear": 4.0},
            "projection": "chronology",
            "relationLinks": false,
            "filters": {"hiddenCategories": ["claim", "myth"], "relationTypes": ["caused by"], "tags": ["war"]},
            "chainId": "hop-1",
            "frameNodeId": "node-a",
            "workingSetRefs": ["node-a", "node-b", "node-c"]
        });
        let bare = json!({
            "camera": {"centerYear": 0, "pixelsPerYear": 1e-9},
            "projection": "relations",
            "relationLinks": true,
            "filters": {"hiddenCategories": [], "relationTypes": null, "tags": []},
            "chainId": null,
            "workingSetRefs": []
        });
        // admitted: the full view, the bare view, the 160-unit name, a 64-node stack and 32 views
        assert!(
            validate_research(&material(json!({"Paris": full.clone()}), json!({})), &ids).is_ok()
        );
        assert!(
            validate_research(&material(json!({"bare": bare.clone()}), json!({})), &ids).is_ok()
        );
        assert!(validate_research(
            &material(json!({"\u{1F600}".repeat(80): bare.clone()}), json!({})),
            &ids
        )
        .is_ok());
        let mut wide = full.clone();
        wide["workingSetRefs"] =
            Value::Array((0..64).map(|i| json!(format!("node-{i}"))).collect());
        assert!(validate_research(&material(json!({"wide": wide}), json!({})), &ids).is_ok());
        let thirty_two: serde_json::Map<String, Value> =
            (0..32).map(|i| (format!("v{i}"), bare.clone())).collect();
        assert!(validate_research(
            &material(Value::Object(thirty_two.clone()), json!({})),
            &ids
        )
        .is_ok());
        let mut thirty_three = thirty_two;
        thirty_three.insert("v32".into(), bare.clone());
        assert!(
            validate_research(&material(Value::Object(thirty_three), json!({})), &ids).is_err()
        );
        // a card's colours: the card-style grammar, closed to the three colour keys
        let styled = |style: Value| {
            material(
                json!({}),
                json!({"event-1": {"offsetY": 0, "style": style}}),
            )
        };
        assert!(validate_research(
            &styled(json!({"dotColour": "#79c0d4", "bgColour": "#102633aa"})),
            &ids
        )
        .is_ok());
        assert!(validate_research(&styled(json!({})), &ids).is_ok());
        for style in [
            json!({"dotColour": "red"}),
            json!({"textColour": "#fff"}),
            json!({"borderColour": "#79c0d4"}),
            json!({"dotColour": 7}),
        ] {
            assert!(
                validate_research(&styled(style.clone()), &ids).is_err(),
                "accepted style {style}"
            );
        }
        // refused: the name, the closed keys, the camera and projection bounds, the filters, the walk, the frame and the stack
        let edited = |edit: &dyn Fn(&mut Value)| {
            let mut view = bare.clone();
            edit(&mut view);
            view
        };
        let refused: Vec<(String, Value)> = vec![
            ("".into(), bare.clone()),
            ("   ".into(), bare.clone()),
            ("\u{1F600}".repeat(81), bare.clone()),
            ("extra key".into(), edited(&|v| v["extra"] = json!(1))),
            (
                "no camera".into(),
                edited(&|v| {
                    v.as_object_mut().unwrap().remove("camera");
                }),
            ),
            (
                "camera key".into(),
                edited(&|v| v["camera"]["roll"] = json!(1)),
            ),
            (
                "centre".into(),
                edited(&|v| v["camera"]["centerYear"] = json!(2e10)),
            ),
            (
                "zoom".into(),
                edited(&|v| v["camera"]["pixelsPerYear"] = json!(0)),
            ),
            (
                "projection".into(),
                edited(&|v| v["projection"] = json!("field")),
            ),
            (
                "relation links".into(),
                edited(&|v| v["relationLinks"] = json!("yes")),
            ),
            (
                "filter key".into(),
                edited(&|v| v["filters"]["source"] = json!(true)),
            ),
            (
                "category".into(),
                edited(&|v| v["filters"]["hiddenCategories"] = json!(["not-a-category"])),
            ),
            (
                "relation type".into(),
                edited(&|v| v["filters"]["relationTypes"] = json!("born in")),
            ),
            (
                "relation name".into(),
                edited(&|v| v["filters"]["relationTypes"] = json!(["x".repeat(161)])),
            ),
            (
                "tags".into(),
                edited(&|v| v["filters"]["tags"] = Value::Array(vec![json!("t"); 257])),
            ),
            ("walk".into(), edited(&|v| v["chainId"] = json!(""))),
            ("frame".into(), edited(&|v| v["frameNodeId"] = json!(""))),
            (
                "stack size".into(),
                edited(&|v| {
                    v["workingSetRefs"] =
                        Value::Array((0..65).map(|i| json!(format!("n{i}"))).collect())
                }),
            ),
            (
                "stack duplicate".into(),
                edited(&|v| v["workingSetRefs"] = json!(["a", "a"])),
            ),
            (
                "ref length".into(),
                edited(&|v| v["workingSetRefs"] = json!(["x".repeat(513)])),
            ),
        ];
        for (name, view) in refused {
            assert!(
                validate_research(&material(json!({ name.clone(): view }), json!({})), &ids)
                    .is_err(),
                "accepted timeline view {name}"
            );
        }
    }

    #[test]
    fn place_views_are_admitted_bounded_and_closed() {
        use super::validate_research;
        use serde_json::{json, Value};
        use std::collections::BTreeSet;
        let ids: BTreeSet<&str> = BTreeSet::new();
        let with = |extra: Value| {
            let mut m = json!({"schema": "oi.research-scene/v1", "cards": {}, "strokes": [],
                "views": {}, "timeline": {}});
            for (k, v) in extra.as_object().unwrap() {
                m[k] = v.clone();
            }
            m
        };
        // one named view under `name`, as the material holds it
        let one = |name: &str, view: Value| {
            let mut m = with(json!({}));
            m["placeViews"] = json!({});
            m["placeViews"][name] = view;
            m
        };
        let full = json!({
            "viewport": {"x": 2.35, "y": 48.85, "zoom": 11.0, "pitch": 40.0, "bearing": -20.0},
            "relations": ["born in", "(relation not disclosed)"],
            "standing": ["factual", "mythic"],
            "basemap": {"terrainVisible": false, "layers": {
                "offline-ground": {"visible": true, "opacity": 1.0},
                "osm-street": {"visible": true, "opacity": 0.5},
                "esri-imagery": {"visible": false, "opacity": 1.0}}},
            "window": {"from": "1900-01-01", "to": null}
        });
        // material saved before place views existed, a view with every field, and the bare view (open layers, no window)
        assert!(validate_research(&with(json!({})), &ids).is_ok());
        assert!(validate_research(&one("Paris at dusk", full.clone()), &ids).is_ok());
        assert!(validate_research(
            &one(
                "open",
                json!({"viewport": {"x": 0, "y": 20, "zoom": 1}, "window": null})
            ),
            &ids
        )
        .is_ok());
        // the name is 1 to 160 UTF-16 units: 80 emoji are 160 units and admitted, 81 are refused
        assert!(validate_research(
            &one(
                &"\u{1F600}".repeat(80),
                json!({"viewport": {"x": 0, "y": 0, "zoom": 1}, "window": null})
            ),
            &ids
        )
        .is_ok());
        let camera = |extra: Value| {
            let mut v = json!({"viewport": {"x": 0, "y": 0, "zoom": 1}, "window": null});
            for (k, value) in extra.as_object().unwrap() {
                v[k] = value.clone();
            }
            v
        };
        for (name, view) in [
            ("", camera(json!({}))),
            ("   ", camera(json!({}))),
            ("\u{1F600}".repeat(81).as_str(), camera(json!({}))),
            ("v", camera(json!({"extra": 1}))),
            ("v", json!({"viewport": {"x": 0, "y": 0, "zoom": 1}})),
            (
                "v",
                json!({"window": null, "viewport": {"x": 0, "y": 0, "zoom": 1, "roll": 1}}),
            ),
            (
                "v",
                json!({"viewport": {"x": 200, "y": 0, "zoom": 1}, "window": null}),
            ),
            (
                "v",
                json!({"viewport": {"x": 0, "y": 91, "zoom": 1}, "window": null}),
            ),
            (
                "v",
                json!({"viewport": {"x": 0, "y": 0, "zoom": 1, "pitch": 86}, "window": null}),
            ),
            (
                "v",
                json!({"viewport": {"x": 0, "y": 0, "zoom": 1, "bearing": 181}, "window": null}),
            ),
            ("v", camera(json!({"relations": "born in"}))),
            ("v", camera(json!({"relations": ["x".repeat(161)]}))),
            ("v", camera(json!({"standing": ["canonical"]}))),
            ("v", camera(json!({"basemap": {"layers": {}}}))),
            (
                "v",
                camera(
                    json!({"basemap": {"terrainVisible": false, "layers": {"bing-aerial": {"visible": true, "opacity": 1}}}}),
                ),
            ),
            (
                "v",
                camera(
                    json!({"basemap": {"terrainVisible": false, "layers": {"osm-street": {"visible": true, "opacity": 1.5}}}}),
                ),
            ),
            (
                "v",
                camera(
                    json!({"basemap": {"terrainVisible": false, "layers": {"osm-street": {"visible": true, "opacity": 1, "live": true}}}}),
                ),
            ),
            (
                "v",
                camera(json!({"window": {"from": "x".repeat(65), "to": null}})),
            ),
            (
                "v",
                camera(json!({"window": {"from": null, "to": null, "axis": 1}})),
            ),
        ] {
            assert!(
                validate_research(&one(name, view.clone()), &ids).is_err(),
                "{name}: {view}"
            );
        }
        // at most 32 named views
        let mut many = with(json!({}));
        many["placeViews"] = json!({});
        for i in 0..33 {
            many["placeViews"][format!("v{i}")] = camera(json!({}));
        }
        assert!(validate_research(&many, &ids).is_err());
    }

    #[test]
    fn place_layers_are_admitted_bounded_and_closed() {
        use super::validate_research;
        use serde_json::{json, Value};
        use std::collections::BTreeSet;
        let ids: BTreeSet<&str> = BTreeSet::new();
        let with = |layers: Value| {
            json!({"schema": "oi.research-scene/v1", "cards": {}, "strokes": [],
                "views": {}, "timeline": {}, "placeLayers": layers})
        };
        let full = json!({
            "relations": ["born in", "(relation not disclosed)"],
            "standing": ["factual", "mythic"],
            "basemap": {"terrainVisible": true, "layers": {
                "offline-ground": {"visible": true, "opacity": 1.0},
                "osm-street": {"visible": true, "opacity": 0.5}}}
        });
        // material saved before the layers existed; a whole record; open layers; every layer off
        assert!(validate_research(
            &json!({"schema": "oi.research-scene/v1", "cards": {}, "strokes": [], "views": {}, "timeline": {}}),
            &ids
        )
        .is_ok());
        assert!(validate_research(&with(full), &ids).is_ok());
        assert!(validate_research(&with(json!({})), &ids).is_ok());
        assert!(validate_research(&with(json!({"relations": []})), &ids).is_ok());
        for layers in [
            json!("born in"),
            json!({"viewport": {"x": 0, "y": 0, "zoom": 1}}),
            json!({"window": null}),
            json!({"relations": "born in"}),
            json!({"relations": ["x".repeat(161)]}),
            json!({"standing": ["canonical"]}),
            json!({"standing": ["factual", "factual", "mythic", "mythic"]}),
            json!({"basemap": {"terrainVisible": false, "layers": {"bing-aerial": {"visible": true, "opacity": 1}}}}),
            json!({"basemap": {"terrainVisible": false, "layers": {"osm-street": {"visible": true, "opacity": 1.5}}}}),
            json!({"basemap": {"terrainVisible": false, "layers": {"osm-street": {"visible": true, "opacity": 1, "extra": 1}}}}),
            json!({"basemap": {"layers": {}}}),
            json!({"basemap": {"terrainVisible": "no", "layers": {}}}),
            json!({"extra": 1}),
        ] {
            assert!(
                validate_research(&with(layers.clone()), &ids).is_err(),
                "{layers}"
            );
        }
    }

    #[test]
    fn a_scene_transition_kind_is_admitted_only_in_its_own_shape() {
        use super::transition_spec;
        use serde_json::json;
        for ok in [
            json!({"kind": "cut"}),
            json!({"kind": "dip-to-colour"}),
            json!({"kind": "dip-to-colour", "at": 0.5}),
            json!({"kind": "wipe", "direction": "up"}),
        ] {
            assert!(transition_spec(&ok).is_ok(), "{ok}");
        }
        for refused in [
            json!({"kind": "crossfade"}),
            json!({"kind": "spin"}),
            json!({"kind": "cut", "at": 0.5}),
            json!({"kind": "dip-to-colour", "at": 0.9}),
            json!({"kind": "wipe", "direction": "diagonal"}),
            json!("cut"),
        ] {
            assert!(transition_spec(&refused).is_err(), "{refused}");
        }
    }

    #[test]
    fn a_places_view_may_carry_pitch_and_bearing_within_bounds() {
        use super::validate_research;
        use serde_json::Value;
        use std::collections::BTreeSet;
        let ids: BTreeSet<&str> = BTreeSet::new();
        let material = |view: Value| {
            serde_json::json!({"schema": "oi.research-scene/v1", "cards": {}, "strokes": [],
                "views": {"place": view}, "timeline": {}})
        };
        // every earlier record (x, y, zoom only) stays valid
        assert!(validate_research(
            &material(serde_json::json!({"x": 1.0, "y": 2.0, "zoom": 3.0})),
            &ids
        )
        .is_ok());
        // lane-4 T1: tilted, rotated
        assert!(validate_research(&material(serde_json::json!({"x": 1.0, "y": 2.0, "zoom": 3.0, "pitch": 60.0, "bearing": -45.0})), &ids).is_ok());
        // bounds
        assert!(validate_research(
            &material(serde_json::json!({"x": 1.0, "y": 2.0, "zoom": 3.0, "pitch": 86.0})),
            &ids
        )
        .is_err());
        assert!(validate_research(
            &material(serde_json::json!({"x": 1.0, "y": 2.0, "zoom": 3.0, "bearing": 181.0})),
            &ids
        )
        .is_err());
        // still no unknown fields
        assert!(validate_research(
            &material(serde_json::json!({"x": 1.0, "y": 2.0, "zoom": 3.0, "roll": 1.0})),
            &ids
        )
        .is_err());
    }

    #[test]
    fn canvas_objects_admit_only_their_closed_fields() {
        use super::validate_research;
        use serde_json::{json, Value};
        use std::collections::BTreeSet;
        let ids: BTreeSet<&str> = ["s", "r", "t", "n"].into_iter().collect();
        let with = |cards: Value| {
            json!({"schema": "oi.research-scene/v1", "cards": cards, "strokes": [],
                "views": {}, "timeline": {}})
        };
        // every admitted object kind with its own fields, and a bounded display size
        assert!(validate_research(
            &with(json!({
                "s": {"type": "sticky", "palette": "sage", "size": {"width": 220, "height": 180}},
                "r": {"type": "shape", "shape": "rectangle", "fill": "none"},
                "t": {"type": "shape", "shape": "diamond", "fill": "amber"},
                "n": {"type": "text", "size": {"width": 220, "height": 48}}
            })),
            &ids
        )
        .is_ok());
        let refused = [
            json!({"s": {"type": "frame"}}),
            json!({"s": {"type": "sticky", "palette": "#ffaa00"}}),
            json!({"s": {"type": "image", "palette": "sage"}}),
            json!({"r": {"type": "shape"}}),
            json!({"r": {"type": "shape", "shape": "hexagon"}}),
            json!({"r": {"type": "shape", "shape": "rectangle", "fill": "#ffaa00"}}),
            json!({"n": {"type": "text", "shape": "rectangle"}}),
            json!({"s": {"type": "sticky", "roll": 1}}),
            json!({"s": {"type": "sticky", "size": {"width": 10, "height": 180}}}),
            json!({"s": {"type": "sticky", "size": {"width": 220, "height": 180, "depth": 1}}}),
        ];
        for cards in refused {
            assert!(
                validate_research(&with(cards.clone()), &ids).is_err(),
                "accepted {cards}"
            );
        }
    }

    use super::Composition;
    use serde_json::{json, Value};

    fn composition(shared: Value) -> Composition {
        Composition {
            schema: "oi.journey-properties/v1".into(),
            description: String::new(),
            loop_playback: true,
            shared: Some(shared),
            markers: None,
            loop_region: None,
        }
    }

    #[test]
    fn journey_markers_and_loop_region_admit_only_their_bounded_shapes() {
        let with = |markers: Option<Vec<Value>>, region: Option<Value>| Composition {
            schema: "oi.journey-properties/v1".into(),
            description: String::new(),
            loop_playback: true,
            shared: None,
            markers,
            loop_region: region,
        };
        let marker = |id: &str, name: &str, time: f64, colour: &str| json!({"id": id, "name": name, "time": time, "colour": colour});
        // absent and well-formed both admit; an empty list is a real state (all markers deleted)
        assert!(with(None, None).validate().is_ok());
        assert!(with(Some(vec![]), None).validate().is_ok());
        assert!(with(
            Some(vec![
                marker("m-1", "Intro", 0.0, "amber"),
                marker("m_2", "Drop", 42.5, "sky")
            ]),
            Some(json!({"from": 4.0, "to": 12.5}))
        )
        .validate()
        .is_ok());
        // refusals: raw colour, unsafe identity, empty or long name, negative or non-finite time
        let refused = [
            vec![marker("m1", "A", 1.0, "#ff0000")],
            vec![marker("bad id", "A", 1.0, "amber")],
            vec![marker("m1", "", 1.0, "amber")],
            vec![marker("m1", &"x".repeat(81), 1.0, "amber")],
            vec![marker("m1", "A", -1.0, "amber")],
            vec![
                marker("m1", "A", 1.0, "amber"),
                marker("m1", "B", 2.0, "rose"),
            ],
            vec![json!({"id": "m1", "name": "A", "time": 1.0, "colour": "amber", "extra": true})],
        ];
        for rows in refused {
            assert!(with(Some(rows), None).validate().is_err());
        }
        assert!(with(
            Some(
                (0..65)
                    .map(|i| marker(&format!("m{i}"), "A", 1.0, "amber"))
                    .collect()
            ),
            None
        )
        .validate()
        .is_err());
        // region: exactly from and to, ordered, at least 0.05 s, non-negative
        assert!(with(None, Some(json!({"from": 5.0}))).validate().is_err());
        assert!(with(None, Some(json!({"from": 5.0, "to": 5.0})))
            .validate()
            .is_err());
        assert!(with(None, Some(json!({"from": -1.0, "to": 5.0})))
            .validate()
            .is_err());
        assert!(
            with(None, Some(json!({"from": 5.0, "to": 5.0, "extra": 1})))
                .validate()
                .is_err()
        );
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
