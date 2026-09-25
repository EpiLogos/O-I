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
    value.as_object().ok_or_else(|| format!("{name} must be an object"))
}
fn number(value: &Value, low: f64, high: f64, name: &str) -> Result<(), String> {
    if value.as_f64().is_some_and(|n| n.is_finite() && n >= low && n <= high) { Ok(()) }
    else { Err(format!("{name} is outside its presentation bounds")) }
}
fn data(value: &Value, depth: usize) -> Result<(), String> {
    if depth > 40 { return Err("Scene presentation nesting budget exceeded".into()); }
    match value {
        Value::Object(values) => for (key, value) in values {
            if ["__proto__", "constructor", "prototype"].contains(&key.as_str()) {
                return Err("Unsafe Scene presentation key".into());
            }
            if key == "dataUrl" {
                let image = value.as_str().ok_or("Image carrier must be embedded image data")?;
                if !["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"]
                    .iter().any(|prefix| image.strip_prefix(prefix).is_some_and(|bytes|
                        !bytes.is_empty() && bytes.len() % 4 == 0 && bytes.bytes().all(|b| b.is_ascii_alphanumeric() || b"+/=".contains(&b)))) {
                    return Err("Scene images must use admitted embedded PNG/JPEG/WebP data; no ambient URL fetch".into());
                }
            }
            data(value, depth + 1)?;
        },
        Value::Array(values) => {
            if values.len() > 4096 { return Err("Scene presentation array budget exceeded".into()); }
            for value in values { data(value, depth + 1)?; }
        }
        _ => {}
    }
    Ok(())
}

pub fn validate(presentation: &Presentation, scene: &Scene, document: &Document) -> Result<(), String> {
    if presentation.schema != SCHEMA { return Err("Unsupported native Scene presentation".into()); }
    // The existing document's 512 KiB budget remains the outer storage bound.
    data(&presentation.scene, 0)?;
    let material = object(&presentation.scene, "Authoring Scene")?;
    const KEYS: &[&str] = &["id", "name", "character", "duration", "transition", "view", "field", "entities", "text", "composition", "morph", "automation", "engine", "semanticField", "resonanceDrive", "favourites", "native", "propertyTakeRange", "toolbelt", "propertyTracks", "pointerScope", "research"];
    if material.keys().any(|key| !KEYS.contains(&key.as_str())) { return Err("Unsupported authoring Scene field; original input was not rewritten".into()); }
    if material.get("id").and_then(Value::as_str) != Some(scene.scene_ref.as_str()) {
        return Err("Scene presentation addresses a different native Scene".into());
    }
    if material.get("name").and_then(Value::as_str) != Some(scene.title.as_str()) {
        return Err("Scene name and native title disagree; rename through the native Scene operation".into());
    }
    number(&presentation.scene["duration"], 1.0, 3600.0, "Scene duration")?;
    number(&presentation.scene["transition"], 0.0, 30.0, "Scene transition")?;
    for key in ["view", "field", "composition", "morph", "engine"] { object(&presentation.scene[key], key)?; }
    let view = &presentation.scene["view"];
    if !matches!(view["mode"].as_str(), Some("2d" | "3d")) { return Err("Invalid Scene view mode".into()); }
    for (key, low, high) in [("yaw", -1000., 1000.), ("pitch", -1000., 1000.), ("zoom", 0.01, 100.), ("panX", -10., 10.), ("panY", -10., 10.)] {
        number(&view[key], low, high, key)?;
    }
    for (key, budget) in [("entities", LIMIT), ("text", 16), ("automation", 64)] {
        let values = presentation.scene[key].as_array().ok_or_else(|| format!("Scene {key} must be an array"))?;
        if values.len() > budget { return Err(format!("Scene {key} budget exceeded")); }
    }
    let mut identities = BTreeSet::new();
    for entity in presentation.scene["entities"].as_array().unwrap() {
        object(entity, "Scene entity")?;
        let reference = entity["id"].as_str().ok_or("Scene entity requires an exact native occurrence ref")?;
        if !identities.insert(reference) || !scene.entity_refs.iter().any(|r| r == reference) || !document.entities.contains_key(reference) {
            return Err("Scene material contains a duplicate or undisclosed native occurrence".into());
        }
        if !matches!(entity["kind"].as_str(), Some("formation" | "pin")) { return Err("Invalid Scene entity kind".into()); }
    }
    if let Some(research) = material.get("research") { validate_research(research, &identities)?; }
    if let Some(saved) = &presentation.saved {
        let mut saved_scene = scene.clone();
        saved_scene.title = saved["name"].as_str().ok_or("Saved Scene requires its own title")?.to_owned();
        if saved_scene.title.is_empty() || saved_scene.title.len() > 640 {
            return Err("Saved Scene title is outside its authoring budget".into());
        }
        validate(&Presentation {schema: SCHEMA.into(), scene: saved.clone(), saved: None}, &saved_scene, document)?;
    }
    Ok(())
}

fn validate_research(value: &Value, ids: &BTreeSet<&str>) -> Result<(), String> {
    let r = object(value, "Research material")?;
    if value["schema"] != "oi.research-scene/v1" || serde_json::to_vec(value).map_err(|e| e.to_string())?.len() > 262144
        || r.keys().any(|key| !["schema","cards","strokes","views","timeline"].contains(&key.as_str())) {
        return Err("Invalid or unbounded research Scene material".into());
    }
    for key in ["cards","views","timeline"] {
        let rows = object(&value[key], key)?;
        if rows.len() > if key == "views" {16} else {256} { return Err("Research record budget exceeded".into()); }
    }
    let bounded = |v: &Value, max: usize| v.as_str().is_some_and(|s| s.len() <= max);
    let colour = |v: &Value| v.as_str().is_some_and(|s| (s.len()==7 || s.len()==9) && s.starts_with('#') && s[1..].bytes().all(|b| b.is_ascii_hexdigit()));
    let viewport = |v: &Value| -> Result<(),String> {
        let map=object(v,"Research viewport")?;
        if map.keys().any(|k| !["x","y","zoom"].contains(&k.as_str())) {return Err("Unknown viewport field".into());}
        number(&v["x"],-1e8,1e8,"Viewport x")?;number(&v["y"],-1e8,1e8,"Viewport y")?;number(&v["zoom"],0.001,1e5,"Viewport zoom")
    };
    for (id, card) in value["cards"].as_object().unwrap() {
        let c=object(card,"Research card")?;
        if !ids.contains(id.as_str()) || !matches!(card["type"].as_str(),Some("note"|"image"))
            || c.keys().any(|k| !["type","importedAt","content","caption","color","dotColour","bgColour","textColour"].contains(&k.as_str())) {
            return Err("Research card must address a disclosed occurrence with an admitted kind".into());
        }
        if let Some(v)=c.get("importedAt") {if card["type"]!="image" || !bounded(v,64) {return Err("Invalid image import time".into());}}
        if let Some(content)=c.get("content") {
            if card["type"]!="note" || !bounded(content,65536) {return Err("Invalid rich note".into());}
            let blocks:Value=serde_json::from_str(content.as_str().unwrap()).map_err(|_|"Research note must be BlockNote JSON")?;
            if !blocks.as_array().is_some_and(|a|a.len()<=256) {return Err("Rich note block budget exceeded".into());}
            validate_note(&blocks,0)?;
        }
        for key in ["caption"] {if let Some(v)=c.get(key) {if !bounded(v,4096) {return Err("Research caption budget exceeded".into());}}}
        for key in ["color","dotColour","bgColour","textColour"] {if let Some(v)=c.get(key) {if !colour(v) {return Err("Invalid research colour".into());}}}

    }
    let strokes=value["strokes"].as_array().ok_or("Research annotations must be an array")?;
    if strokes.len()>128 {return Err("Annotation budget exceeded".into());}
    let mut seen=BTreeSet::new();
    for stroke in strokes {
        let m=object(stroke,"Annotation")?;
        if m.keys().any(|k| !["id","points","color","width","opacity","createdAt"].contains(&k.as_str()))
            || !stroke["id"].as_str().is_some_and(|s|!s.is_empty()&&s.len()<=160&&seen.insert(s)) || !colour(&stroke["color"]) || !bounded(&stroke["createdAt"],64) {return Err("Invalid annotation".into());}
        number(&stroke["width"],0.1,100.,"Stroke width")?;number(&stroke["opacity"],0.,1.,"Stroke opacity")?;
        let points=stroke["points"].as_array().ok_or("Stroke points must be an array")?;
        if points.is_empty()||points.len()>4096 {return Err("Stroke point budget exceeded".into());}
        for point in points {object(point,"Stroke point")?;number(&point["x"],-40000.,40000.,"Stroke x")?;number(&point["y"],-40000.,40000.,"Stroke y")?;if let Some(v)=point.get("pressure"){number(v,0.,1.,"Stroke pressure")?;}}
    }
    for v in value["views"].as_object().unwrap().values(){viewport(v)?;}
    for layout in value["timeline"].as_object().unwrap().values(){
        let m=object(layout,"Timeline layout")?;
        if m.keys().any(|k| !["offsetY","width","height","lane","layoutRevision"].contains(&k.as_str())){return Err("Unknown timeline layout field".into());}
        if let Some(v)=m.get("lane"){if !bounded(v,1024){return Err("Invalid timeline lane".into());}}
        if let Some(v)=m.get("layoutRevision"){if !v.as_u64().is_some_and(|n|(1..=9007199254740991).contains(&n)){return Err("Invalid timeline layout revision".into());}}
        number(&layout["offsetY"],-40000.,40000.,"Timeline offset")?;
        for key in ["width","height"]{if let Some(v)=m.get(key){number(v,40.,40000.,"Timeline card size")?;}}
    }
    Ok(())
}
fn validate_note(value:&Value,depth:usize)->Result<(),String>{
    if depth>24{return Err("Rich note nesting budget exceeded".into());}
    match value {
        Value::Array(values)=>{if values.len()>1024{return Err("Rich note array budget exceeded".into());}for v in values{validate_note(v,depth+1)?;}},
        Value::Object(values)=>for (key,v) in values{
            if ["__proto__","prototype","constructor"].contains(&key.as_str()) || (key=="type" && matches!(v.as_str(),Some("image"|"video"|"audio"|"file"))) {return Err("Note media requires a native resource binding".into());}
            if key=="href" && !v.as_str().is_some_and(|s| {let s=s.to_ascii_lowercase();["https:","http:","mailto:"].iter().any(|p|s.starts_with(p))}) {return Err("Unsupported note link".into());}
            if key=="url" && v.as_str()!=Some("") && !v.is_null(){return Err("Note media requires a native resource binding".into());}
            validate_note(v,depth+1)?;
        }, _=>{}
    } Ok(())
}

/// Only known presentation-local identity fields are remapped on a native
/// fork. Source refs, evidence and arbitrary caption text are never rewritten.
pub fn fork(presentation: &mut Presentation, old: &str, new: &str) {
    let map = |value: &mut Value| {
        if let Some(reference) = value.as_str() {
            if let Some(suffix) = reference.strip_prefix(&format!("{old}:")) { *value = Value::String(format!("{new}:{suffix}")); }
        }
    };
    for material in std::iter::once(&mut presentation.scene).chain(presentation.saved.iter_mut()) {
    map(&mut material["id"]);
    if let Some(members) = material.get_mut("composition").and_then(|v|v.get_mut("blueprint")).and_then(|v|v.get_mut("members")).and_then(Value::as_array_mut) {
        for member in members { map(&mut member["entity_ref"]); }
    }
    if let Some(entities) = material["entities"].as_array_mut() {
        for entity in entities { map(&mut entity["id"]); }
    }
    if let Some(research)=material.get_mut("research") {
        if let Some(cards)=research.get_mut("cards").and_then(Value::as_object_mut) {
            let previous=std::mem::take(cards);
            for (id,card) in previous {
                let mut key=Value::String(id);map(&mut key);
                cards.insert(key.as_str().unwrap().to_owned(),card);
            }
        }
    }
    if let Some(native) = material.get_mut("native") {
        for key in ["config", "projection"] {
            if let Some(entities) = native.get_mut(key).and_then(|config| config.get_mut("entities")).and_then(Value::as_array_mut) {
                for entity in entities { map(&mut entity["id"]); }
            }
        }
    }
    for key in ["automation", "propertyTracks", "toolbelt"] {
        if let Some(values) = material.get_mut(key).and_then(Value::as_array_mut) {
            for value in values {
                if value.get("entityId").is_some() { map(&mut value["entityId"]); }
            }
        }
    }
    if let Some(bindings) = material.get_mut("semanticField").and_then(|field| field.get_mut("bindings")).and_then(Value::as_array_mut) {
        for binding in bindings {
            if let Some(carriers) = binding["carriers"].as_array_mut() {
                for carrier in carriers { if carrier["kind"] == "entity" { map(&mut carrier["id"]); } }
            }
        }
    }
    }
}

/// A native entity edit changes that entity's presentation in every Scene in
/// which it occurs. Scene-specific edits use SceneMaterialSet instead. These
/// conversions are the existing authoring model's documented stage units.
pub fn set_parameter(presentation: &mut Presentation, reference: &str, key: &str, value: &Value) {
    let Some(entities) = presentation.scene.get_mut("entities").and_then(Value::as_array_mut) else { return; };
    for entity in entities.iter_mut().filter(|entity| entity["id"] == reference) {
        match key {
            "x" | "y" | "z" => if let Some(number) = value.as_f64() { entity["position"][key] = Value::from(number / 400.0); },
            "width" | "height" => if let Some(number) = value.as_f64() { entity["size"][if key == "width" {"x"} else {"y"}] = Value::from(number / 400.0); },
            "rotation" => if let Some(number) = value.as_f64() { entity["rotation"] = Value::from(number.to_degrees()); },
            "scale" | "share" | "kind" => entity[key] = value.clone(),
            "glyph" => entity["text"] = value.clone(),
            "shape" => entity["shape"] = if value == "glyph" {Value::from("text")} else {value.clone()},
            "yantra" => entity["yantraId"] = value.clone(),
            "frequency" => entity["templateFrequency"] = value.clone(),
            "force_mode" => entity["force"]["kind"] = value.clone(),
            "force_strength" => entity["force"]["strength"] = value.clone(),
            "force_spin" => entity["force"]["spin"] = value.clone(),
            "force_radius" => if let Some(number) = value.as_f64() { entity["force"]["radius"] = Value::from(number / 400.0); },
            "ascii" => {
                if value.as_str() == Some("") { entity.as_object_mut().unwrap().remove("source"); }
                else { entity["source"] = serde_json::json!({"kind":"ascii","ascii":{"text":value}}); }
            },
            "image" => {
                if value.as_str() == Some("") { entity.as_object_mut().unwrap().remove("source"); }
                else { entity["source"] = serde_json::json!({"kind":"image","image":{"dataUrl":value,"mode":"luminance","threshold":0.5,"invert":false,"scale":1.0}}); }
            },
            _ => {}
        }
    }
}

/// A native entity removal retires its presentation-local automation/control
/// bindings as well. It is not a retraction of that entity's source or native
/// knowledge relations; those remain owned by the source system.
pub fn remove_entity(presentation: &mut Presentation, reference: &str) {
    for material in std::iter::once(&mut presentation.scene).chain(presentation.saved.iter_mut()) {
    if let Some(entities) = material.get_mut("entities").and_then(Value::as_array_mut) {
        entities.retain(|entity| entity["id"] != reference);
    }
    if let Some(cards)=material.get_mut("research").and_then(|r|r.get_mut("cards")).and_then(Value::as_object_mut){cards.remove(reference);}
    for key in ["automation", "propertyTracks", "toolbelt"] {
        if let Some(values) = material.get_mut(key).and_then(Value::as_array_mut) {
            values.retain(|value| value["entityId"] != reference);
        }
    }
    if let Some(bindings) = material.get_mut("semanticField").and_then(|field| field.get_mut("bindings")).and_then(Value::as_array_mut) {
        for binding in bindings.iter_mut() {
            if let Some(carriers) = binding.get_mut("carriers").and_then(Value::as_array_mut) {
                carriers.retain(|carrier| !(carrier["kind"] == "entity" && carrier["id"] == reference));
            }
        }
        bindings.retain(|binding| binding["carriers"].as_array().is_some_and(|carriers| !carriers.is_empty()));
    }
    }
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
            if fields.keys().any(|key| !["toolbelt", "values", "pointer"].contains(&key.as_str())) {
                return Err("Unknown shared authoring property".into());
            }
            for key in ["values", "pointer"] {
                let values = object(&shared[key], key)?;
                if values.len() > 1024 || values.values().any(|value| !value.is_string() && !value.is_boolean() && !value.is_number()) {
                    return Err("Shared values must be bounded scalar authoring properties".into());
                }
            }
            if !shared["toolbelt"].as_array().is_some_and(|values| values.len() <= 2048) {
                return Err("Shared toolbelt requires a bounded entry list".into());
            }
        }
        Ok(())
    }

    pub fn fork(&mut self, old: &str, new: &str) {
        if let Some(entries) = self.shared.as_mut().and_then(|value| value.get_mut("toolbelt")).and_then(Value::as_array_mut) {
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
