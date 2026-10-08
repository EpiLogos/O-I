//! Parameter relationships retained in the existing Scene material. This
//! admits bounded data and native occurrence identity; the existing renderer
//! registry validates executable paths, exact units and hard parameter bounds
//! before a macro's batch is applied through the ordinary native edit owner.
//! There is no serial processor graph or secondary document owner here.
use serde::Deserialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct State { schema: String, racks: Vec<Rack> }
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Rack { schema: String, id: String, title: String, scope: Scope, macros: Vec<Macro>, excluded: Vec<String>, variations: Vec<Variation> }
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum Scope { Field, Entity { entity_ref: String } }
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
enum Target { Field { path: String }, Entity { entity_ref: String, path: String } }
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Macro { id: String, name: String, value: f64, mappings: Vec<Mapping> }
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Mapping { id: String, target: Target, min: f64, max: f64, unit: String, law: String }
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Variation { id: String, name: String, values: BTreeMap<String, f64>, excluded: Vec<String> }

// Native registry projection; the boundary parity test compares every entry
// to paramRegistry.ts, including bounds and units. Update from that owner only.
const NATIVE_PARAMETERS: &[(&str, &str, f64, f64, &str)] = &[
    ("field", "material.sizeBias", 0.1, 12.0, "scalar"),
    ("field", "material.opacity", 0.0, 1.0, "scalar"),
    ("field", "material.roundness", 0.0, 1.0, "scalar"),
    ("field", "material.softness", 0.0, 1.0, "scalar"),
    ("field", "material.irregularity", 0.0, 1.0, "scalar"),
    ("field", "material.elongation", 0.0, 12.0, "scalar"),
    ("field", "material.orientation", -36000.0, 36000.0, "°"),
    ("field", "material.contrast", 0.0, 1.0, "scalar"),
    ("field", "material.densityScale", 0.01, 100.0, "scalar"),
    ("field", "material.densityPhase", -1000.0, 1000.0, "rad"),
    ("field", "material.edgeWeight", 0.0, 5.0, "scalar"),
    ("field", "material.halo", 0.0, 1.0, "scalar"),
    ("field", "paperGrain", 0.0, 1.0, "scalar"),
    ("field", "color.fieldCenterOffset.0", -20.0, 20.0, "scalar"),
    ("field", "color.fieldCenterOffset.1", -20.0, 20.0, "scalar"),
    ("field", "relational.attractorCount", 1.0, 10.0, "scalar"),
    ("field", "cymatics.driveScale", 0.0, 100.0, "scalar"),
    ("field", "fluid.returnSpeed", -100.0, 500.0, "scalar"),
    ("field", "fluid.viscosity", 0.0, 1.2, "scalar"),
    ("field", "fluid.vortexStrength", -500.0, 500.0, "scalar"),
    ("field", "fluid.curlScale", 0.0, 200.0, "scalar"),
    ("field", "fluid.curlSpeed", -200.0, 200.0, "scalar"),
    ("field", "fluid.turbulence", -100.0, 500.0, "scalar"),
    ("field", "fluid.dispersion", -100.0, 500.0, "scalar"),
    ("field", "fluid.snapRigidity", -20.0, 100.0, "scalar"),
    ("field", "fluid.densityTether", 0.0, 10.0, "scalar"),
    ("field", "fluid.curlDepth", 0.0, 50.0, "scalar"),
    ("field", "fluid.vortexRadius", 5.0, 20000.0, "px"),
    ("field", "fluid.gravityX", -1000.0, 1000.0, "scalar"),
    ("field", "fluid.gravityY", -1000.0, 1000.0, "scalar"),
    ("field", "fluid.gravityZ", -1000.0, 1000.0, "scalar"),
    ("field", "fluid.quadraticDrag", 0.0, 1000.0, "scalar"),
    ("field", "fluid.thermalJitter", 0.0, 1000.0, "scalar"),
    ("field", "fluid.maxSpeed", 10.0, 10000000.0, "scalar"),
    ("field", "fluid.zConfinement", 0.0, 10.0, "scalar"),
    ("field", "fluid.timeScale", -10.0, 100.0, "scalar"),
    ("field", "particleCount", 64.0, 4000000.0, "scalar"),
    ("field", "particleSize.min", 0.001, 500.0, "px"),
    ("field", "particleSize.max", 0.001, 1000.0, "px"),
    ("field", "morphProgress", 0.0, 1.0, "scalar"),
    ("field", "toroidalMorph.oscillationSpeed", -100.0, 100.0, "Hz"),
    ("field", "toroidalMorph.poloidalRate", -100.0, 100.0, "Hz"),
    ("field", "toroidalMorph.toroidalPhase", -1000.0, 1000.0, "rad"),
    ("field", "toroidalMorph.poloidalPhase", -1000.0, 1000.0, "rad"),
    ("field", "toroidalMorph.oscillationAmplitude", -50.0, 100.0, "scalar"),
    ("field", "toroidalMorph.breathRate", -100.0, 100.0, "Hz"),
    ("field", "toroidalMorph.breathDepth", 0.0, 10.0, "scalar"),
    ("field", "toroidalMorph.driveDepth", -10.0, 10.0, "scalar"),
    ("field", "toroidalMorph.holdRatio", 0.0, 0.99, "scalar"),
    ("field", "toroidalMorph.fiberPhaseOffset", -1000.0, 1000.0, "scalar"),
    ("field", "toroidalMorph.chiralCoupling", -100.0, 100.0, "scalar"),
    ("field", "toroidalMorph.toroidalWinding", 0.0, 512.0, "scalar"),
    ("field", "toroidalMorph.poloidalWinding", 0.0, 512.0, "scalar"),
    ("field", "toroidalMorph.manifoldRadius", 1.0, 20000.0, "px"),
    ("field", "toroidalMorph.volumetricDepthScale", 0.0, 100.0, "scalar"),
    ("field", "interaction.clickStrength", 0.01, 20.0, "scalar"),
    ("field", "interaction.clickRadius", 4.0, 4000.0, "px"),
    ("field", "interaction.radius", 0.0, 50000.0, "px"),
    ("field", "interaction.strength", -1000.0, 1000.0, "scalar"),
    ("field", "interaction.velocityInfluence", -100.0, 100.0, "scalar"),
    ("field", "interaction.falloffPower", 0.0, 50.0, "scalar"),
    ("field", "relational.attractorGravity", -10000.0, 10000.0, "scalar"),
    ("field", "relational.orbitSpeed", -1000.0, 1000.0, "scalar"),
    ("field", "relational.orbitRadius", 0.0, 100000.0, "px"),
    ("field", "relational.relationalSpin", -1000.0, 1000.0, "scalar"),
    ("field", "relational.chaosFactor", -1000.0, 1000.0, "scalar"),
    ("field", "relational.wanderSpeed", -100.0, 100.0, "scalar"),
    ("field", "relational.gravitySoftening", 1.0, 100000.0, "px"),
    ("field", "relational.gravityFalloff", 0.1, 10.0, "scalar"),
    ("field", "relational.swirlRadius", 5.0, 100000.0, "px"),
    ("field", "pairwise.radius", 0.5, 500.0, "px"),
    ("field", "pairwise.stiffness", 0.0, 100.0, "scalar"),
    ("field", "pairwise.restitution", 0.0, 1.0, "scalar"),
    ("field", "pairwise.viscosity", 0.0, 1.0, "scalar"),
    ("field", "pairwise.extent", 50.0, 20000.0, "px"),
    ("field", "color.cycleSpeed", -1000.0, 1000.0, "scalar"),
    ("field", "color.hueShiftSpeed", -1000.0, 1000.0, "scalar"),
    ("field", "color.waveFrequency", 0.0, 1000.0, "scalar"),
    ("field", "color.angle", -36000.0, 36000.0, "°"),
    ("field", "color.speedReactiveIntensity", -100.0, 100.0, "scalar"),
    ("field", "color.turbulenceModulation", -100.0, 100.0, "scalar"),
    ("field", "color.densityWeight", -10.0, 10.0, "scalar"),
    ("field", "color.contrast", 0.0, 100.0, "scalar"),
    ("field", "backgroundGlowIntensity", 0.0, 100.0, "scalar"),
    ("field", "cymatics.frequencyHz", 1.0, 100000.0, "Hz"),
    ("field", "cymatics.dominance", 0.0, 1.0, "scalar"),
    ("field", "cymatics.dampingQFactor", 0.01, 10000.0, "scalar"),
    ("field", "cymatics.driveStrength", 0.0, 100.0, "scalar"),
    ("field", "cymatics.transportGain", 0.0, 1000.0, "scalar"),
    ("field", "cymatics.agitation", 0.0, 200.0, "scalar"),
    ("field", "cymatics.plateSize", 10.0, 20000.0, "px"),
    ("field", "cymatics.modeCount", 1.0, 64.0, "scalar"),
    ("field", "cymatics.boundaryStrength", 0.0, 1000.0, "scalar"),
    ("field", "cymatics.baseFrequency", 0.5, 2000.0, "Hz"),
    ("field", "cymatics.sweepSpeed", 0.01, 100000.0, "s"),
    ("field", "cymatics.sweep.glideS", 0.01, 3600.0, "s"),
    ("field", "cymatics.sweep.dwellS", 0.0, 3600.0, "s"),
    ("field", "medium.pressure", 0.0, 200.0, "scalar"),
    ("field", "medium.coupling", 0.0, 20.0, "scalar"),
    ("field", "medium.persistence", 0.0, 1.0, "scalar"),
    ("field", "medium.iterations", 1.0, 64.0, "scalar"),
    ("field", "medium.gridRes", 16.0, 1024.0, "scalar"),
    ("field", "medium.splatGain", 0.0, 20.0, "scalar"),
    ("field", "medium.extent", 50.0, 20000.0, "px"),
    ("field", "collision.restitution", 0.0, 1.0, "scalar"),
    ("field", "collision.friction", 0.0, 1.0, "scalar"),
    ("field", "collision.band", 1.0, 2000.0, "px"),
    ("field", "collision.strength", 0.0, 200.0, "scalar"),
    ("field", "collision.integrity", 0.0, 20.0, "scalar"),
    ("field", "glyphVolume.depth", 0.0, 4000.0, "px"),
    ("field", "glyphVolume.wallShare", 0.0, 1.0, "scalar"),
    ("field", "glyphVolume.faceBias", 0.0, 1.0, "scalar"),
    ("field", "glyphVolume.interiorFill", 0.0, 1.0, "scalar"),
    ("field", "glyphVolume.surfaceThickness", 0.0, 2000.0, "px"),
    ("field", "glyphVolume.wallBand", 0.5, 1000.0, "px"),
    ("field", "glyphVolume.outsideTaper", 0.0, 100.0, "scalar"),
    ("field", "glyphVolume.referenceFalloff", 0.05, 100.0, "scalar"),
    ("field", "glyphVolume.densityDepth", -1.0, 1.0, "scalar"),
    ("field", "glyphVolume.jitter", 0.0, 2000.0, "px"),
    ("field", "depth.fov", 4.0, 120.0, "°"),
    ("field", "depth.distance", 10.0, 100000.0, "px"),
    ("field", "depth.sizeAttenuation", 0.0, 10.0, "scalar"),
    ("field", "depth.sizeAttenuationCurve", 0.01, 20.0, "scalar"),
    ("field", "depth.sizeDepthBias", -1.0, 1.0, "scalar"),
    ("field", "depth.aerialFade", 0.0, 1.0, "scalar"),
    ("field", "depth.aerialRange", 0.1, 100.0, "scalar"),
    ("field", "depth.depthTintWeight", 0.0, 1.0, "scalar"),
    ("field", "composition.orchestration.dwell", 0.0, 3600.0, "s"),
    ("field", "composition.orchestration.glide", 0.01, 3600.0, "s"),
    ("field", "composition.entityTintWeight", 0.0, 1.0, "scalar"),
    ("field", "composition.orchestration.focusTintWeight", 0.0, 1.0, "scalar"),
    ("entity", "x", -20000.0, 20000.0, "px"),
    ("entity", "y", -20000.0, 20000.0, "px"),
    ("entity", "z", -20000.0, 20000.0, "px"),
    ("entity", "scale", 0.001, 100.0, "scalar"),
    ("entity", "forces.strength", -1000.0, 1000.0, "scalar"),
    ("entity", "forces.radius", 5.0, 20000.0, "px"),
    ("entity", "forces.spin", -1000.0, 1000.0, "scalar"),
    ("entity", "tintWeight", 0.0, 1.0, "scalar"),
    ("entity", "sequence.hold", 0.0, 3600.0, "s"),
    ("entity", "sequence.transition", 0.02, 3600.0, "s"),
    ("entity", "sequence.rateMul", -100.0, 100.0, "scalar"),
    ("entity", "sequence.phaseOffset", -1000.0, 1000.0, "scalar"),
];

fn id(value: &str) -> Result<(), String> {
    if value.is_empty() || ["__proto__", "constructor", "prototype"].contains(&value) || value.len() > 160 || !value.bytes().all(|c| c.is_ascii_alphanumeric() || b"_.:-".contains(&c)) {return Err("Invalid parameter rack identity".into());}
    Ok(())
}
fn name(value: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.chars().count() > 160 {return Err("Invalid parameter rack name".into());}
    Ok(())
}
fn fraction(value: f64) -> Result<(), String> {
    if !value.is_finite() || !(0.0..=1.0).contains(&value) {return Err("Parameter rack macro value is outside 0..1".into());}
    Ok(())
}
fn path(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 256 || value.split('.').any(|part| part.is_empty() || ["__proto__", "constructor", "prototype"].contains(&part) || !part.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_')) {return Err("Invalid parameter rack target path".into());}
    Ok(())
}
fn exclusions(values: &[String], macros: &BTreeSet<&str>) -> Result<(), String> {
    let mut seen = BTreeSet::new();
    if values.len() > 16 || values.iter().any(|value| !macros.contains(value.as_str()) || !seen.insert(value.as_str())) {return Err("Parameter rack exclusions require unique existing macros".into());}
    Ok(())
}

/// Called after the Scene's exact material occurrence refs were validated.
/// Unknown root structure and executable-looking paths are refused rather
/// than rewritten. Old Scenes with no rack data remain byte-identical.
pub fn validate(material: &Value, identities: &BTreeSet<&str>) -> Result<(), String> {
    let Some(value) = material.get("parameterRacks") else {return Ok(());};
    let state: State = serde_json::from_value(value.clone()).map_err(|error| format!("Invalid parameter rack structure: {error}"))?;
    if state.schema != "oi.parameter-racks/v1" || state.racks.len() > 32 {return Err("Invalid parameter rack collection".into());}
    let mut rack_ids = BTreeSet::new();
    for rack in &state.racks {
        id(&rack.id)?; name(&rack.title)?;
        if rack.schema != "oi.parameter-rack/v1" || !rack_ids.insert(rack.id.as_str()) || rack.macros.is_empty() || rack.macros.len() > 16 || rack.variations.len() > 128 {return Err("Invalid or duplicate parameter rack".into());}
        if let Scope::Entity {entity_ref} = &rack.scope {
            if !identities.contains(entity_ref.as_str()) {return Err("Parameter rack scope is not a Scene occurrence".into());}
        }
        let mut macro_ids = BTreeSet::new();
        let mut mapping_ids = BTreeSet::new();
        let mut targets = BTreeSet::new();
        for control in &rack.macros {
            id(&control.id)?; name(&control.name)?; fraction(control.value)?;
            if !macro_ids.insert(control.id.as_str()) || control.mappings.len() > 64 {return Err("Invalid or duplicate parameter rack macro".into());}
            for mapping in &control.mappings {
                id(&mapping.id)?;
                if !mapping_ids.insert(mapping.id.as_str()) || mapping_ids.len() > 256 {return Err("Invalid or duplicate parameter rack mapping".into());}
                let key = match (&rack.scope, &mapping.target) {
                    (Scope::Field, Target::Field {path: target_path}) => {path(target_path)?; format!("field:{target_path}")},
                    (Scope::Entity {entity_ref: scope}, Target::Entity {entity_ref, path: target_path}) if scope == entity_ref && identities.contains(entity_ref.as_str()) => {path(target_path)?; format!("entity:{entity_ref}:{target_path}")},
                    _ => return Err("Parameter rack mappings cross their native Field/entity scope".into()),
                };
                if !targets.insert(key) {return Err("A parameter rack target cannot be driven by two macros".into());}
                let (kind, target_path) = match &mapping.target {Target::Field {path} => ("field", path), Target::Entity {path, ..} => ("entity", path)};
                let Some((_, _, lower, upper, unit)) = NATIVE_PARAMETERS.iter().find(|(scope, path, ..)| *scope == kind && *path == target_path) else {return Err("Parameter rack path has no admitted native registry definition".into());};
                let discrete = ["medium.iterations", "medium.gridRes", "particleCount", "cymatics.modeCount", "relational.attractorCount", "toroidalMorph.toroidalWinding", "toroidalMorph.poloidalWinding"].contains(&target_path.as_str());
                if mapping.unit != *unit || [mapping.min, mapping.max].iter().any(|value| *value < *lower || *value > *upper || (discrete && value.fract() != 0.0)) || !["linear", "log"].contains(&mapping.law.as_str()) || [mapping.min, mapping.max].iter().any(|value| !value.is_finite() || value.abs() > 100_000_000.0) || (mapping.law == "log" && (mapping.min <= 0.0 || mapping.max <= 0.0)) {return Err("Invalid parameter rack range, unit or mapping law".into());}
            }
        }
        exclusions(&rack.excluded, &macro_ids)?;
        let mut variation_ids = BTreeSet::new();
        for variation in &rack.variations {
            id(&variation.id)?; name(&variation.name)?;
            if !variation_ids.insert(variation.id.as_str()) || variation.values.len() != macro_ids.len() || variation.values.keys().any(|key| !macro_ids.contains(key.as_str())) {return Err("Parameter rack variation must capture each existing macro once".into());}
            for value in variation.values.values() {fraction(*value)?;}
            exclusions(&variation.excluded, &macro_ids)?;
        }
    }
    Ok(())
}

/// Called from expression_scene::remap_refs, hence for fork and native act
/// graft/recall. Only native occurrence refs change; macro/mapping identities,
/// parameter paths, captions, source refs and captured values remain exact.
pub fn remap_refs(material: &mut Value, remap: &dyn Fn(&str) -> Option<String>) {
    let Some(racks) = material.get_mut("parameterRacks").and_then(|state| state.get_mut("racks")).and_then(Value::as_array_mut) else {return;};
    let map = |value: &mut Value| {if let Some(next) = value.as_str().and_then(remap) {*value = Value::String(next);}};
    for rack in racks {
        if rack["scope"]["kind"] == "entity" {map(&mut rack["scope"]["entity_ref"]);}
        if let Some(macros) = rack.get_mut("macros").and_then(Value::as_array_mut) {
            for control in macros {
                if let Some(mappings) = control.get_mut("mappings").and_then(Value::as_array_mut) {
                    for mapping in mappings {
                        if mapping["target"]["kind"] == "entity" {map(&mut mapping["target"]["entity_ref"]);}
                    }
                }
            }
        }
    }
}

pub fn remove_entity(material: &mut Value, reference: &str) {
    if let Some(racks) = material.get_mut("parameterRacks").and_then(|state| state.get_mut("racks")).and_then(Value::as_array_mut) {
        racks.retain(|rack| !(rack["scope"]["kind"] == "entity" && rack["scope"]["entity_ref"] == reference));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn material() -> Value {json!({"parameterRacks":{"schema":"oi.parameter-racks/v1","racks":[{"schema":"oi.parameter-rack/v1","id":"rack:a","title":"Force","scope":{"kind":"entity","entity_ref":"expression:a:entity:e"},"macros":[{"id":"macro:a","name":"Influence","value":0.25,"mappings":[{"id":"mapping:a","target":{"kind":"entity","entity_ref":"expression:a:entity:e","path":"forces.strength"},"min":-2.0,"max":4.0,"unit":"scalar","law":"linear"}]}],"excluded":[],"variations":[{"id":"variation:a","name":"Soft","values":{"macro:a":0.25},"excluded":[]}]}]}})}
    fn refs() -> BTreeSet<&'static str> {BTreeSet::from(["expression:a:entity:e"])}
    #[test] fn validates_actual_native_membership_and_reversed_ranges() {
        let mut value = material();
        assert!(validate(&value, &refs()).is_ok());
        value["parameterRacks"]["racks"][0]["macros"][0]["mappings"][0]["min"] = json!(8.0);
        assert!(validate(&value, &refs()).is_ok());
        assert!(validate(&json!({}), &BTreeSet::new()).is_ok());
        assert!(validate(&value, &BTreeSet::new()).is_err());
    }
    #[test] fn refuses_unknown_scope_duplicate_identity_and_unsafe_paths() {
        for mutation in ["scope", "duplicate", "path", "curve", "value", "exclusion", "variation", "unknown", "native-path", "native-bounds", "native-unit"] {
            let mut value = material();
            let rack = &mut value["parameterRacks"]["racks"][0];
            match mutation {
                "native-path" => rack["macros"][0]["mappings"][0]["target"]["path"] = json!("forces.unregistered"),
                "native-bounds" => rack["macros"][0]["mappings"][0]["max"] = json!(1001.0),
                "native-unit" => rack["macros"][0]["mappings"][0]["unit"] = json!("px"),
                "scope" => rack["scope"]["entity_ref"] = json!("expression:b:entity:foreign"),
                "duplicate" => {let duplicate = rack["macros"][0].clone(); rack["macros"].as_array_mut().unwrap().push(duplicate);},
                "path" => rack["macros"][0]["mappings"][0]["target"]["path"] = json!("__proto__.evil"),
                "curve" => rack["macros"][0]["mappings"][0]["law"] = json!("script"),
                "value" => rack["macros"][0]["value"] = json!(1.01),
                "exclusion" => rack["excluded"] = json!(["macro:missing"]),
                "variation" => rack["variations"][0]["values"] = json!({}),
                _ => rack["execute"] = json!("unadmitted"),
            }
            assert!(validate(&value, &refs()).is_err(), "{mutation}");
        }
    }
    #[test] fn remap_and_remove_preserve_control_material_and_variation_values() {
        let mut value = material();
        let captured = value["parameterRacks"]["racks"][0]["variations"].clone();
        remap_refs(&mut value, &|reference| reference.strip_prefix("expression:a:").map(|tail| format!("expression:b:{tail}")));
        assert!(validate(&value, &BTreeSet::from(["expression:b:entity:e"])).is_ok());
        let rack = &value["parameterRacks"]["racks"][0];
        assert_eq!(rack["scope"]["entity_ref"], "expression:b:entity:e");
        assert_eq!(rack["macros"][0]["mappings"][0]["target"]["entity_ref"], "expression:b:entity:e");
        assert_eq!(rack["variations"], captured);
        assert_eq!(rack["macros"][0]["mappings"][0]["target"]["path"], "forces.strength");
        remove_entity(&mut value, "expression:b:entity:e");
        assert!(value["parameterRacks"]["racks"].as_array().unwrap().is_empty());
    }
}
