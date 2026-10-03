//! Scoped procedural operations over the existing Expression document. This
//! module is a child of `expression`: preparation uses Document::edited and
//! application uses Application::apply(Edit), including its CAS and events.
//! Runtime acknowledgements are supplied by the receiving native owners;
//! callers cannot turn an authored edit into physical/audio evidence.
use super::{Application, Change, Changed, Document, ReadingRef, Request as ExpressionRequest};
use crate::flow::CentralClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

#[path = "expression_procedural_bootstrap.rs"]
pub(crate) mod bootstrap;
#[path = "expression_procedural_budget.rs"]
pub(crate) mod budget;
#[path = "expression_procedural_control.rs"]
pub(crate) mod control;
#[path = "expression_procedural_lifecycle.rs"]
pub(crate) mod lifecycle;
#[path = "expression_procedural_manual.rs"]
pub(crate) mod manual;
#[path = "expression_procedural_observation.rs"]
mod observation;
#[path = "expression_procedural_receiver.rs"]
mod receiver;
#[path = "expression_procedural_scene_receiver.rs"]
pub(crate) mod scene_receiver;

pub const SCHEMA: &str = "oi.expression-procedural/v1";
pub const MAX_OPERATIONS: usize = 256;
pub const MAX_TARGETS: usize = super::DOCUMENT_MEMBERS;
const MAX_DELTA_HISTORY: usize = 256;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum Component {
    Expression,
    Scene,
    Field,
    Entity,
    Layer,
    Force,
    Sequence,
    SequenceLink,
    Property,
    Driver,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(deny_unknown_fields)]
pub struct Address {
    pub expression_ref: String,
    pub scene_ref: Option<String>,
    pub entity_ref: Option<String>,
    pub component: Component,
    pub constituent_ref: Option<String>,
    /// Missing is a legacy unqualified layer address. Explicit null names the
    /// base layer container; a string names its exact sequence-state container.
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "layer_parent"
    )]
    pub parent_ref: Option<Option<String>>,
    pub property: Option<String>,
}

fn layer_parent<'de, D: serde::Deserializer<'de>>(
    d: D,
) -> Result<Option<Option<String>>, D::Error> {
    Ok(Some(Option::<String>::deserialize(d)?))
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Scope {
    Expression,
    Scenes {
        scene_refs: Vec<String>,
    },
    Addresses {
        addresses: Vec<Address>,
    },
    Subject {
        subject_ref: String,
    },
    Locus {
        source_ref: String,
        source_revision: String,
    },
    Tag {
        scene_refs: Vec<String>,
        tag: String,
        origin: String,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Participant {
    pub owner: String,
    pub instance_ref: String,
    pub required_generation: u64,
    pub targets: Vec<Address>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Envelope {
    pub operation_ref: String,
    pub expression_ref: String,
    pub expected_revision: u64,
    pub actor: String,
    pub scope: Scope,
    pub sources: Vec<ReadingRef>,
    pub changes: Vec<Change>,
    pub participants: Vec<Participant>,
    /// A named owner boundary, never a scene-side replacement clock.
    pub timing: Timing,
    pub cause_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub output_readings: Vec<Value>,
    /// Issued by the native host from its actual installed compiler response.
    /// The receiving runtime rechecks that response, original intent and CAS.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub producer_ref: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Timing {
    Immediate,
    OwnerBoundary {
        owner: String,
        instance_ref: String,
        cursor: u64,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Prepared,
    Scheduled,
    Applying,
    Applied,
    Cancelled,
    Interrupted,
    Failed,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ConsumerObservation {
    pub owner: String,
    pub instance_ref: String,
    pub generation: u64,
    pub document_revision: u64,
    pub operation_ref: String,
    pub cursor: u64,
    pub targets: Vec<Address>,
    pub effective: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Operation {
    pub fingerprint: String,
    pub envelope: Envelope,
    pub targets: Vec<Address>,
    pub status: Status,
    /// Revision containing the durably retained preparation. The original
    /// requested revision remains in the immutable fingerprinted envelope.
    pub accepted_revision: Option<u64>,
    pub applied_revision: Option<u64>,
    pub observations: Vec<ConsumerObservation>,
    pub failure: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Read {
        expression_ref: String,
        scope: Scope,
        after_cursor: Option<u64>,
    },
    ReadOutputs {
        expression_ref: String,
        expected_revision: u64,
        procedure_ref: String,
    },
    ReadSource {
        expression_ref: String,
        expected_revision: u64,
        scope: Scope,
        property_keys: Vec<String>,
        scene_profile: Option<ReadingRef>,
    },
    ReadDriver {
        expression_ref: String,
        expected_revision: u64,
        address: Address,
        parameter: String,
    },
    Control {
        expression_ref: String,
        expected_revision: u64,
        procedure_ref: String,
        address: Address,
        parameter: String,
        actor: String,
        operation_ref: String,
        action: control::Action,
    },
    Lifecycle {
        expression_ref: String,
        expected_revision: u64,
        scene_ref: String,
        operation_ref: String,
        actor: String,
        procedure_ref: String,
        expected_procedure_revision: String,
        action: lifecycle::Action,
    },
    LifecycleCancel {
        expression_ref: String,
        expected_revision: u64,
        scene_ref: String,
        operation_ref: String,
        actor: String,
        procedure_ref: String,
        expected_procedure_revision: String,
    },
    Prepare {
        envelope: Box<Envelope>,
    },
    Commit {
        operation_ref: String,
    },
    InspectOperation {
        operation_ref: String,
    },
    Cancel {
        operation_ref: String,
    },
}

#[derive(Clone, Debug, Default)]
pub struct Runtime {
    operations: BTreeMap<String, Operation>,
    cursor: u64,
    deltas: Vec<Value>,
    retired_through: Option<u64>,
    restored: BTreeSet<String>,
    producers: BTreeMap<String, ProducerAdmission>,
    /// Live native qualification is not reconstructed from a saved label.
    qualified_operations: BTreeMap<String, String>,
    /// Small seal of the genuinely admitted definition survives release of
    /// its large producer preparation. Saved labels never populate it.
    qualified_definitions: BTreeMap<String, String>,
    controls: BTreeMap<String, control::Replay>,
    scene_receivers: scene_receiver::Registry,
    bootstrap_replays: BTreeMap<String, bootstrap::Replay>,
    /// Live native material/current-journal pairing, never restored from JSON.
    material_fences: BTreeMap<String, observation::MaterialFence>,
    pub(super) owner_write: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct ProducerAdmission {
    pub producer_ref: String,
    pub expression_ref: String,
    pub document_revision: u64,
    pub prepared: Value,
    pub source: Value,
    /// Original already-qualified native Source position. This small private
    /// provenance is not a new clock grant or a restored JSON capability.
    #[serde(skip)]
    lifecycle_position: Option<Value>,
    #[serde(skip)]
    changes: Vec<Change>,
    #[serde(skip)]
    targets: Vec<Address>,
    /// Created occurrences are separate from original selector membership.
    #[serde(skip)]
    outputs: Vec<Address>,
    /// Exact original source Scene anchors carry retention metadata only.
    /// These never become selector membership, output ownership or targets.
    #[serde(skip)]
    metadata: Vec<Address>,
}

fn path<'a>(mut value: &'a Value, property: &str) -> Result<&'a Value, String> {
    if property.is_empty() || property.len() > 256 {
        return Err("Invalid property path".into());
    }
    for part in property.split('.') {
        if part.is_empty()
            || !part.as_bytes()[0].is_ascii_alphabetic() && part.as_bytes()[0] != b'_'
            || ["__proto__", "prototype", "constructor"].contains(&part)
            || part
                .bytes()
                .any(|b| !b.is_ascii_alphanumeric() && b != b'_')
        {
            return Err("Property paths cannot address identity or list indices".into());
        }
        value = value
            .get(part)
            .ok_or_else(|| format!("Property {property} is unavailable"))?;
    }
    Ok(value)
}

fn layer_locations<'a>(root: &'a Value, address: &Address) -> Vec<(Option<String>, &'a Value)> {
    let mut matches = Vec::new();
    if address
        .parent_ref
        .as_ref()
        .is_none_or(|parent| parent.is_none())
    {
        for list in [&root["layers"], &root["native"]["layers"]] {
            if let Some(rows) = list.as_array() {
                for row in rows {
                    if row["id"].as_str() == address.constituent_ref.as_deref() {
                        matches.push((None, row));
                    }
                }
            }
        }
    }
    for list in [
        &root["sequence"]["steps"],
        &root["sequence"]["links"],
        &root["native"]["sequence"]["links"],
    ] {
        if let Some(states) = list.as_array() {
            for state in states {
                if address.parent_ref.is_none()
                    || address.parent_ref.as_ref().and_then(Option::as_deref)
                        == state["id"].as_str()
                {
                    if let Some(rows) = state["layers"].as_array() {
                        for row in rows {
                            if row["id"].as_str() == address.constituent_ref.as_deref() {
                                matches.push((state["id"].as_str().map(str::to_owned), row));
                            }
                        }
                    }
                }
            }
        }
    }
    matches
}

fn canonical_address(document: &Document, address: &Address) -> Result<Address, String> {
    addressed(document, address)?;
    let mut resolved = address.clone();
    if address.component == Component::Layer && address.parent_ref.is_none() {
        let root = document
            .scenes
            .iter()
            .find(|scene| Some(&scene.scene_ref) == address.scene_ref.as_ref())
            .and_then(|scene| scene.presentation.as_ref())
            .and_then(|p| p.scene["entities"].as_array())
            .and_then(|rows| {
                rows.iter()
                    .find(|row| row["id"].as_str() == address.entity_ref.as_deref())
            })
            .ok_or("Layer material is absent")?;
        let matches = layer_locations(root, address);
        let (parent, _) = matches
            .first()
            .ok_or("Layer containing coordinate is absent")?;
        resolved.parent_ref = Some(parent.clone());
    }
    Ok(resolved)
}

pub fn addressed(document: &Document, address: &Address) -> Result<Value, String> {
    retained_address(&serde_json::to_value(address).map_err(|e| e.to_string())?)?;
    if address.expression_ref != document.expression_ref {
        return Err("Wrong Expression subject".into());
    }
    if address.component == Component::Expression {
        if let Some(property) = &address.property {
            for bucket in ["values", "pointer"] {
                if let Some(key) = property.strip_prefix(&format!("shared.{bucket}.")) {
                    retained_address(&serde_json::to_value(address).map_err(|e| e.to_string())?)?;
                    let p = document
                        .presentation
                        .as_ref()
                        .ok_or("Expression has no authored composition")?;
                    return p
                        .shared
                        .as_ref()
                        .ok_or("Expression has no shared properties")?[bucket]
                        .get(key)
                        .cloned()
                        .ok_or("Shared registry property has no authored override".into());
                }
            }
        }
    }
    let mut value = if address.component == Component::Expression {
        if address.scene_ref.is_some()
            || address.entity_ref.is_some()
            || address.constituent_ref.is_some()
        {
            return Err("Expression scope has constituent refs".into());
        }
        serde_json::to_value(document).map_err(|e| e.to_string())?
    } else {
        let scene = document
            .scenes
            .iter()
            .find(|s| Some(&s.scene_ref) == address.scene_ref.as_ref())
            .ok_or("Unknown Scene address")?;
        if matches!(address.component, Component::Scene | Component::Field)
            && (address.entity_ref.is_some() || address.constituent_ref.is_some())
        {
            return Err("Scene/field address has unrelated constituent refs".into());
        }
        if !matches!(
            address.component,
            Component::Layer | Component::SequenceLink | Component::Driver
        ) && address.constituent_ref.is_some()
        {
            return Err("Component does not have a constituent ref".into());
        }
        match address.component {
            Component::Scene => serde_json::to_value(scene).map_err(|e| e.to_string())?,
            Component::Field => scene
                .presentation
                .as_ref()
                .ok_or("Scene has no authored material")?
                .scene["field"]
                .clone(),
            Component::Property if address.entity_ref.is_none() => scene
                .presentation
                .as_ref()
                .ok_or("Scene has no authored material")?
                .scene
                .clone(),
            Component::Driver => {
                let controls = scene
                    .presentation
                    .as_ref()
                    .and_then(|p| p.scene["procedural"]["controls"].as_array())
                    .ok_or("Scene has no retained drivers")?;
                let reference = address
                    .constituent_ref
                    .as_deref()
                    .ok_or("Driver needs its stable control target ref")?;
                controls
                    .iter()
                    .find(|c| {
                        c["target"].as_str() == Some(reference)
                            && c["address"]["entity_ref"].as_str() == address.entity_ref.as_deref()
                    })
                    .cloned()
                    .ok_or("Unknown named driver")?
            }
            _ => {
                let reference = address
                    .entity_ref
                    .as_ref()
                    .ok_or("Constituent needs a stable entity ref")?;
                if !scene.entity_refs.contains(reference) {
                    return Err("Occurrence is not in this Scene".into());
                }
                let native = document
                    .entities
                    .get(reference)
                    .ok_or("Unknown entity occurrence")?;
                let material = scene
                    .presentation
                    .as_ref()
                    .and_then(|p| p.scene["entities"].as_array())
                    .and_then(|entities| {
                        entities
                            .iter()
                            .find(|e| e["id"].as_str() == Some(reference))
                    });
                match address.component {
                    Component::Entity => material
                        .cloned()
                        .unwrap_or(serde_json::to_value(native).map_err(|e| e.to_string())?),
                    Component::Force => {
                        let root = material.ok_or("Occurrence has no material")?;
                        root.get("force")
                            .or_else(|| root.get("forces"))
                            .or_else(|| root["native"].get("forces"))
                            .cloned()
                            .ok_or("Force is unavailable")?
                    }
                    Component::Sequence => {
                        let root = material.ok_or("Occurrence has no material")?;
                        root.get("sequence")
                            .or_else(|| root["native"].get("sequence"))
                            .cloned()
                            .ok_or("Sequence is unavailable")?
                    }
                    Component::Layer => {
                        let root = material.ok_or("Occurrence has no material")?;
                        let matches = layer_locations(root, address);
                        if address.parent_ref.is_none()
                            && matches
                                .iter()
                                .map(|(parent, _)| parent)
                                .collect::<BTreeSet<_>>()
                                .len()
                                > 1
                        {
                            return Err("Legacy Layer address has multiple containing coordinates; select its base or exact state".into());
                        }
                        let (_, found) = matches
                            .first()
                            .ok_or("Unknown stable layer or containing state")?;
                        if matches.iter().any(|(_, row)| *row != *found) {
                            return Err("Ambiguous native/authoring layer projection".into());
                        }
                        (*found).clone()
                    }
                    Component::SequenceLink => {
                        let root = material.ok_or("Occurrence has no material")?;
                        let matches: Vec<_> = [
                            &root["sequence"]["steps"],
                            &root["sequence"]["links"],
                            &root["native"]["sequence"]["links"],
                        ]
                        .into_iter()
                        .filter_map(Value::as_array)
                        .flatten()
                        .filter(|row| row["id"].as_str() == address.constituent_ref.as_deref())
                        .collect();
                        let found = matches.first().ok_or("Unknown stable sequence-link ref")?;
                        if matches.iter().any(|row| *row != *found) {
                            return Err("Ambiguous native/authoring sequence projection".into());
                        }
                        (*found).clone()
                    }
                    Component::Property => {
                        serde_json::to_value(&native.parameters).map_err(|e| e.to_string())?
                    }
                    Component::Driver => scene
                        .presentation
                        .as_ref()
                        .and_then(|p| p.scene.get("procedural"))
                        .and_then(|p| p.get("controls"))
                        .cloned()
                        .unwrap_or(json!([])),
                    _ => return Err("Unsupported component address".into()),
                }
            }
        }
    };
    if value.is_null() {
        return Err("This component is unavailable".into());
    }
    if let Some(property) = &address.property {
        value = path(&value, property)?.clone();
    }
    Ok(value)
}

fn address(
    document: &Document,
    scene: Option<&str>,
    entity: Option<&str>,
    component: Component,
) -> Address {
    Address {
        expression_ref: document.expression_ref.clone(),
        scene_ref: scene.map(str::to_owned),
        entity_ref: entity.map(str::to_owned),
        component,
        constituent_ref: None,
        parent_ref: None,
        property: None,
    }
}

fn covers(allowed: &Address, target: &Address) -> bool {
    let property_covers = || {
        allowed.property.as_ref().is_none_or(|p| {
            target
                .property
                .as_ref()
                .is_some_and(|t| t == p || t.starts_with(&format!("{p}.")))
        })
    };
    allowed.expression_ref == target.expression_ref
        && (allowed.component == Component::Expression && allowed.property.is_none()
            || allowed.scene_ref == target.scene_ref
                && (allowed.component == Component::Scene && allowed.property.is_none()
                    || allowed.entity_ref == target.entity_ref
                        && (allowed.component == Component::Entity && allowed.property.is_none()
                            || allowed.component == Component::Sequence
                                && allowed.property.is_none()
                                && (target.component == Component::SequenceLink
                                    || target.component == Component::Layer
                                        && target
                                            .parent_ref
                                            .as_ref()
                                            .and_then(Option::as_ref)
                                            .is_some())
                            || allowed.component == Component::SequenceLink
                                && allowed.property.is_none()
                                && target.component == Component::Layer
                                && target.parent_ref.as_ref().and_then(Option::as_ref)
                                    == allowed.constituent_ref.as_ref()
                            || allowed.component == target.component
                                && allowed.constituent_ref == target.constituent_ref
                                && allowed.parent_ref == target.parent_ref
                                && property_covers())))
}

/// These sources feed the actual existing sampler pool. A shared layer ID
/// has one source across base/state containers even when its geometry differs.
pub fn validate_scene_sources(material: &Value) -> Result<(), String> {
    fn source(value: Option<&Value>) -> Result<(), String> {
        let Some(value) = value.filter(|value| !value.is_null()) else {
            return Ok(());
        };
        let text = |value: &Value, max: usize| {
            value
                .as_str()
                .is_some_and(|s| s.encode_utf16().count() <= max)
        };
        let finite = |value: &Value, min: f64, max: f64| {
            value
                .as_f64()
                .is_some_and(|v| v.is_finite() && v >= min && v <= max)
        };
        let boolean = |value: Option<&Value>| value.is_none_or(|v| v.is_boolean());
        match value["kind"].as_str() {
            Some("ascii") => {
                let a = &value["ascii"];
                if !a.is_object()
                    || !text(&a["text"], 50_000)
                    || a.get("fontFamily").is_some_and(|v| !text(v, 200))
                    || a.get("fontSize").is_some_and(|v| !finite(v, 1.0, 1024.0))
                    || !boolean(a.get("invert"))
                {
                    return Err("Invalid actual ASCII sampler source".into());
                }
            }
            Some("image") => {
                let a = &value["image"];
                if !a.is_object()
                    || !matches!(
                        a["mode"].as_str(),
                        Some("luminance" | "edgeSobel" | "silhouette")
                    )
                    || !finite(&a["threshold"], 0.0, 1.0)
                    || !finite(&a["scale"], 0.01, 100.0)
                    || !boolean(a.get("invert"))
                    || a.get("name").is_some_and(|v| !text(v, 500))
                {
                    return Err("Invalid actual image sampler source".into());
                }
                if let Some(data) = a.get("dataUrl") {
                    let data = data.as_str().ok_or("Image source has no actual data URL")?;
                    let encoded = [
                        "data:image/png;base64,",
                        "data:image/jpeg;base64,",
                        "data:image/webp;base64,",
                    ]
                    .into_iter()
                    .find_map(|prefix| data.strip_prefix(prefix))
                    .ok_or("Unsupported actual image source MIME")?;
                    if data.len() > 12_000_000
                        || encoded.is_empty()
                        || encoded
                            .bytes()
                            .any(|b| !b.is_ascii_alphanumeric() && !matches!(b, b'+' | b'/' | b'='))
                    {
                        return Err("Invalid actual encoded image sampler source".into());
                    }
                }
            }
            _ => return Err("Unknown actual sampler source kind".into()),
        }
        Ok(())
    }
    if let Some(entities) = material.get("entities").and_then(Value::as_array) {
        for entity in entities {
            source(entity.get("source"))?;
            if entity
                .get("layers")
                .is_some_and(|layers| !layers.is_null() && !layers.is_array())
            {
                return Err("Base layer container is not an actual layer list".into());
            }
            let mut bases = BTreeMap::new();
            if let Some(layers) = entity.get("layers").and_then(Value::as_array) {
                for layer in layers {
                    source(layer.get("source"))?;
                    let id = layer["id"]
                        .as_str()
                        .filter(|id| !id.is_empty())
                        .ok_or("Base layer has no stable ID")?;
                    if bases.insert(id, layer.get("source")).is_some() {
                        return Err("Duplicate base-layer sampler identity".into());
                    }
                }
            }
            let mut state_ids = BTreeSet::new();
            if let Some(states) = entity["sequence"]["steps"].as_array() {
                for state in states {
                    source(state.get("source"))?;
                    if state.get("layers").is_some_and(|layers| !layers.is_array()) {
                        return Err(
                            "Sequence-state layer container is not an actual layer list".into()
                        );
                    }
                    if let Some(layers) = state.get("layers").and_then(Value::as_array) {
                        if layers.len() > 6 {
                            return Err("State exceeds the actual layer sampler budget".into());
                        }
                        for layer in layers {
                            source(layer.get("source"))?;
                            let id = layer["id"]
                                .as_str()
                                .filter(|id| {
                                    !id.is_empty()
                                        && id.len() <= 160
                                        && id.bytes().all(|b| {
                                            b.is_ascii_alphanumeric()
                                                || matches!(b, b'_' | b'.' | b':' | b'-')
                                        })
                                })
                                .ok_or("State layer has no safe stable ID")?;
                            if !state_ids.insert(id) {
                                return Err("Duplicate sequence-state sampler identity".into());
                            }
                            if bases
                                .get(id)
                                .is_some_and(|source| *source != layer.get("source"))
                            {
                                return Err(
                                    "Shared base/state layer ID has different sampler sources"
                                        .into(),
                                );
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

fn source_exact_binding(document: &Document, target: &Address) -> Result<Option<Value>, String> {
    let target = canonical_address(document, target)?;
    let mut whole = target.clone();
    whole.property = None;
    let rows = document
        .scenes
        .iter()
        .flat_map(bindings)
        .filter_map(|binding| {
            let address: Address = serde_json::from_value(binding["address"].clone()).ok()?;
            (canonical_address(document, &address).ok()? == whole).then_some(binding)
        })
        .collect::<Vec<_>>();
    let Some(first) = rows.first() else {
        return Ok(None);
    };
    if rows.iter().any(|row| *row != *first) {
        return Err("Conflicting current native manifestation bindings".into());
    }
    Ok(Some((*first).clone()))
}

fn source_native_subject(document: &Document, target: &Address) -> Result<Value, String> {
    let target = canonical_address(document, target)?;
    let principal = if let Some(reference) = &target.entity_ref {
        let subject = document
            .entities
            .get(reference)
            .and_then(|entity| entity.subject.as_ref())
            .ok_or("Native constituent has no current full subject reading")?;
        let principal = serde_json::to_value(subject).map_err(|e| e.to_string())?;
        if let Some(binding) = source_exact_binding(document, &target)? {
            if binding["principal"] != principal {
                return Err("Native constituent and exact manifestation principal differ".into());
            }
        }
        principal
    } else {
        source_exact_binding(document, &target)?
            .ok_or("Exact full native manifestation principal unavailable")?["principal"]
            .clone()
    };
    let native: crate::expression::SubjectBinding =
        serde_json::from_value(principal.clone()).map_err(|e| e.to_string())?;
    crate::expression::readings(&native.sources)?;
    crate::expression::readings(&native.readings)?;
    if native
        .sources
        .iter()
        .chain(&native.readings)
        .any(|r| r.availability != crate::expression::Availability::Available)
    {
        return Err("Current native subject source/readings unavailable".into());
    }
    Ok(principal)
}

fn source_native_property(
    document: &Document,
    target: &Address,
    key: &str,
) -> Result<Value, String> {
    let target = canonical_address(document, target)?;
    // A selected scalar cannot disclose sibling properties. Ordinary names
    // are native Parameter keys; dotted authored paths retain authored units.
    if key == "native_atlas_state" {
        if target.component != Component::Expression || target.property.is_some() {
            return Err("Native Atlas state requires the exact whole Expression target".into());
        }
        return Ok(json!({"schema":"ql.native-atlas-state/v1",
            "expression_ref":document.expression_ref,"focus":document.selection,
            "scene_order":document.scenes.iter().map(|scene|scene.scene_ref.clone()).collect::<Vec<_>>() }));
    }
    if let Some(property) = &target.property {
        let native_key = match (target.component.clone(), property.as_str()) {
            (Component::Force, "strength") => Some("force_strength"),
            (Component::Force, "spin") => Some("force_spin"),
            (Component::Force, "radius") => Some("force_radius"),
            (Component::Force, "kind") => Some("force_mode"),
            (Component::Entity, "position.x") => Some("x"),
            (Component::Entity, "position.y") => Some("y"),
            (Component::Entity, "position.z") => Some("z"),
            (Component::Entity, "size.x") => Some("width"),
            (Component::Entity, "size.y") => Some("height"),
            (Component::Entity, "text") => Some("glyph"),
            (Component::Entity, "yantraId") => Some("yantra"),
            (Component::Entity, "templateFrequency") => Some("frequency"),
            (Component::Entity, "scale" | "share" | "kind" | "shape" | "rotation")
            | (Component::Property, _) => Some(property.as_str()),
            _ => None,
        };
        if native_key == Some(key) {
            let entity = target
                .entity_ref
                .as_ref()
                .and_then(|reference| document.entities.get(reference))
                .ok_or("Scalar has no native parameter occurrence")?;
            let parameter = entity
                .parameters
                .get(key)
                .ok_or("Scalar has no actual native parameter value")?;
            super::parameter(key, parameter)?;
            return Ok(parameter.value.clone());
        }
        if key != property {
            return Err("Source property outside exact selected scalar".into());
        }
        return addressed(document, &target);
    }
    if matches!(
        target.component,
        Component::Entity | Component::Force | Component::Property
    ) {
        if let Some(reference) = &target.entity_ref {
            let entity = document
                .entities
                .get(reference)
                .ok_or("Unknown native property occurrence")?;
            if (target.component != Component::Force || key.starts_with("force_"))
                && entity.parameters.contains_key(key)
            {
                let parameter = &entity.parameters[key];
                crate::expression::parameter(key, parameter)?;
                return Ok(parameter.value.clone());
            }
        }
    }
    let body = if target.component == Component::Scene {
        document
            .scenes
            .iter()
            .find(|s| target.scene_ref.as_deref() == Some(s.scene_ref.as_str()))
            .and_then(|s| s.presentation.as_ref())
            .ok_or("Scene has no native authored material")?
            .scene
            .clone()
    } else {
        addressed(document, &target)?
    };
    Ok(path(&body, key)?.clone())
}

/// `occurrence_ref` is deliberately not invented here. The existing owner
/// supplies its stable occurrence/address key, then pairs it to this exact
/// canonical address. A caller occurrence label grants no membership scope.
fn source_target_parts(
    document: &Document,
    target: &Address,
    keys: &[String],
) -> Result<Value, String> {
    if keys.len() > MAX_TARGETS {
        return Err("Source property cardinality exceeded".into());
    }
    let target = canonical_address(document, target)?;
    let subject = source_native_subject(document, &target)?;
    let revision = target
        .entity_ref
        .as_ref()
        .and_then(|r| document.entities.get(r))
        .map(|e| e.revision)
        .or_else(|| {
            target
                .scene_ref
                .as_ref()
                .and_then(|r| document.scenes.iter().find(|s| &s.scene_ref == r))
                .map(|s| s.revision)
        })
        .unwrap_or(document.revision);
    let mut properties = BTreeMap::new();
    for key in keys {
        if properties
            .insert(key.clone(), source_native_property(document, &target, key)?)
            .is_some()
        {
            return Err("Duplicate source property request".into());
        }
    }
    let mut tags = Vec::new();
    if let Some(scene_ref) = &target.scene_ref {
        let scene = document
            .scenes
            .iter()
            .find(|s| &s.scene_ref == scene_ref)
            .ok_or("Tag Scene absent")?;
        for binding in bindings(scene) {
            let raw: Address =
                serde_json::from_value(binding["address"].clone()).map_err(|e| e.to_string())?;
            let allowed = canonical_address(document, &raw)?;
            if !covers(&allowed, &target) {
                continue;
            }
            for tag in binding["tags"]
                .as_array()
                .ok_or("Native tag list missing")?
            {
                let origin = match tag["origin"].as_str() {
                    Some("native") => "native_source",
                    Some("authored") => "authored",
                    Some("generated") => "generated",
                    _ => return Err("Unknown actual native tag origin".into()),
                };
                let value = tag["tag"].as_str().ok_or("Actual native tag missing")?;
                crate::expression::text(value)?;
                // Native retained tags disclose their actual Scene basis.
                // Do not invent a QL source-file revision from an origin label.
                let qualified = json!({"value":value,"origin":origin,"scope_ref":scene_ref,
                    "basis":{"source_ref":scene_ref,"revision":scene.revision.to_string()}});
                if !tags.contains(&qualified) {
                    tags.push(qualified);
                }
            }
        }
    }
    Ok(
        json!({"address":target,"subject":subject,"revision":revision,"tags":tags,"properties":properties}),
    )
}

fn source_occurrence_ref(address: &Address) -> Result<String, String> {
    if address.property.is_none() {
        match address.component {
            Component::Expression => return Ok(address.expression_ref.clone()),
            Component::Scene => {
                return address
                    .scene_ref
                    .clone()
                    .ok_or("Source Scene has no native occurrence".into());
            }
            Component::Entity => {
                return address
                    .entity_ref
                    .clone()
                    .ok_or("Source Entity has no native occurrence".into());
            }
            _ => {}
        }
    }
    Ok(format!(
        "{}:target:{:x}",
        address.expression_ref,
        Sha256::digest(serde_json::to_vec(address).map_err(|e| e.to_string())?)
    ))
}

fn source_native_scene_source(
    document: &Document,
    scene_ref: &str,
    profile: &ReadingRef,
) -> Result<Value, String> {
    let target = address(document, Some(scene_ref), None, Component::Scene);
    let binding = source_exact_binding(document, &target)?
        .ok_or("Exact full native Scene manifestation binding unavailable")?;
    let principal = source_native_subject(document, &target)?;
    let scene = document
        .scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .ok_or("Source Scene absent")?;
    let mut presentation = serde_json::to_value(
        scene
            .presentation
            .as_ref()
            .ok_or("Source Scene material unavailable")?,
    )
    .map_err(|e| e.to_string())?;
    let retained = presentation["scene"]
        .as_object_mut()
        .ok_or("Source material is not a Scene")?
        .remove("procedural")
        .unwrap_or_else(empty_retention);
    let locus: ReadingRef =
        serde_json::from_value(binding["locus"].clone()).map_err(|e| e.to_string())?;
    crate::expression::readings(&[profile.clone(), locus.clone()])?;
    let disclosed = retained["source_basis"]
        .as_array()
        .into_iter()
        .flatten()
        .chain(principal["sources"].as_array().into_iter().flatten())
        .any(|raw| serde_json::from_value::<ReadingRef>(raw.clone()).is_ok_and(|r| &r == profile));
    if !disclosed
        || profile.availability != crate::expression::Availability::Available
        || locus.availability != crate::expression::Availability::Available
    {
        return Err("Actual native source profile/locus unavailable; obtain the source owner's full current reading".into());
    }
    let contributors: Vec<crate::expression::SubjectBinding> =
        serde_json::from_value(binding["contributors"].clone()).map_err(|e| e.to_string())?;
    for contributor in &contributors {
        crate::expression::readings(&contributor.sources)?;
        crate::expression::readings(&contributor.readings)?;
        if contributor
            .sources
            .iter()
            .chain(&contributor.readings)
            .any(|r| r.availability != crate::expression::Availability::Available)
        {
            return Err("Actual native contributor source unavailable".into());
        }
    }
    let fingerprint = format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&presentation).map_err(|e| e.to_string())?)
    );
    Ok(
        json!({"native_owner":"oi.expression","expression_ref":document.expression_ref,"scene_ref":scene_ref,
        "document_revision":document.revision,"source_basis":{"source_ref":profile.r#ref,"revision":profile.revision},
        "material_fingerprint":fingerprint,"presentation":presentation,"principal":principal,"contributors":contributors,
        "locus_ref":locus.r#ref,"locus_revision":locus.revision}),
    )
}

fn source_recheck_target_parts(document: &Document, reading: &Value) -> Result<(), String> {
    let target: Address =
        serde_json::from_value(reading["address"].clone()).map_err(|e| e.to_string())?;
    let keys = reading["properties"]
        .as_object()
        .ok_or("Missing owner property map")?
        .keys()
        .cloned()
        .collect::<Vec<_>>();
    let actual = source_target_parts(document, &target, &keys)?;
    for key in ["address", "subject", "revision", "tags", "properties"] {
        if reading[key] != actual[key] {
            return Err(format!("Source intake differs from actual native {key}"));
        }
    }
    Ok(())
}

fn source_recheck_scene_source(
    document: &Document,
    source: &Value,
    retained_program: bool,
) -> Result<(), String> {
    let profile:ReadingRef=serde_json::from_value(json!({"ref":source["source_basis"]["source_ref"],"revision":source["source_basis"]["revision"],"availability":"available"})).map_err(|e|e.to_string())?;
    let scene = source["scene_ref"]
        .as_str()
        .ok_or("Native source has no actual Scene")?;
    let actual = source_native_scene_source(document, scene, &profile)?;
    let mut observed = source.clone();
    if retained_program {
        if !source["document_revision"]
            .as_u64()
            .is_some_and(|revision| revision > 0 && revision <= document.revision)
        {
            return Err(
                "Retained source ordinal is not an actual prior native Document reading".into(),
            );
        }
        // The immutable recipe retains its original ordinal. Unrelated native
        // edits may advance the Document without changing this actual Source.
        // All material, subjects, contributors, profile and locus remain exact.
        observed["document_revision"] = json!(document.revision);
    }
    if observed != actual {
        return Err("Compiler source differs from actual native Scene, material, subjects, contributors, profile or locus".into());
    }
    Ok(())
}

fn source_parameter_addresses(
    document: &Document,
    contribution: &Value,
) -> Result<Vec<Address>, String> {
    let owned: Vec<Address> = serde_json::from_value(contribution["owned_addresses"].clone())
        .map_err(|error| error.to_string())?;
    let first = owned
        .first()
        .ok_or("Native parameter has no exact owner target")?;
    let entity = first
        .entity_ref
        .as_deref()
        .ok_or("Native parameter has no actual Entity")?;
    if contribution["occurrence_ref"].as_str() != Some(entity)
        || owned.iter().any(|target| {
            target.expression_ref != document.expression_ref
                || target.entity_ref.as_deref() != Some(entity)
                || target.component != first.component
                || target.property != first.property
                || target.parent_ref != first.parent_ref
                || target.constituent_ref != first.constituent_ref
        })
    {
        return Err(
            "Native parameter ownership mixes different global occurrences or coordinates".into(),
        );
    }
    let mut expected = BTreeSet::new();
    for scene in &document.scenes {
        if scene
            .entity_refs
            .iter()
            .any(|reference| reference == entity)
        {
            let mut target = first.clone();
            target.scene_ref = Some(scene.scene_ref.clone());
            expected.insert(canonical_address(document, &target)?);
        }
    }
    let actual = owned.iter().cloned().collect::<BTreeSet<_>>();
    if expected.is_empty() || actual.len() != owned.len() || actual != expected {
        return Err(
            "Native parameter ownership omits or duplicates an affected actual Scene location"
                .into(),
        );
    }
    Ok(expected.into_iter().collect())
}

/// Driver disclosure uses the actual global native Parameter and every real
/// Scene manifestation. A requested value is previewed by Document::edited;
/// this owner does not reproduce the authored/native unit conversion.
fn source_parameter_location(
    document: &Document,
    scene_ref: &str,
    entity_ref: &str,
    parameter: &str,
) -> Result<Address, String> {
    let (component, property) = match parameter {
        "force_strength" => (Component::Force, "strength"),
        "force_spin" => (Component::Force, "spin"),
        "force_radius" => (Component::Force, "radius"),
        "x" => (Component::Entity, "position.x"),
        "y" => (Component::Entity, "position.y"),
        "z" => (Component::Entity, "position.z"),
        "scale" => (Component::Entity, "scale"),
        "rotation" => (Component::Entity, "rotation"),
        _ => return Err("This Parameter has no current native authored driver mapping".into()),
    };
    canonical_native_scalar_address(
        document,
        &Address {
            expression_ref: document.expression_ref.clone(),
            scene_ref: Some(scene_ref.into()),
            entity_ref: Some(entity_ref.into()),
            component,
            parent_ref: None,
            constituent_ref: None,
            property: Some(property.into()),
        },
    )
}
/// Validate the existing native scalar coordinate by borrowing authored
/// material. General inspection may return a cloned constituent; a driver
/// intake must never copy that Entity's glyph/layers/sequence before budgeting.
fn canonical_native_scalar_address(
    document: &Document,
    address: &Address,
) -> Result<Address, String> {
    retained_address(&serde_json::to_value(address).map_err(|e| e.to_string())?)?;
    if !matches!(
        (&address.component, address.property.as_deref()),
        (Component::Force, Some("strength" | "spin" | "radius"))
            | (
                Component::Entity,
                Some("position.x" | "position.y" | "position.z" | "scale" | "rotation")
            )
    ) {
        return Err("This coordinate has no current native scalar driver mapping".into());
    }
    let value = manual::borrowed_material(document, address)?;
    if !value.as_f64().is_some_and(f64::is_finite) {
        return Err("Actual authored native driver scalar unavailable".into());
    }
    Ok(address.clone())
}
/// Match the existing Source/Registry automation target spelling. This is an
/// identity check only; Document::edited continues to own scalar conversion.
fn validate_native_control_target(
    control: &Value,
    entity_ref: &str,
    parameter: &str,
) -> Result<(), String> {
    let suffix = match parameter {
        "force_strength" => "forces.strength",
        "force_spin" => "forces.spin",
        "force_radius" => "forces.radius",
        "x" | "y" | "z" | "scale" | "rotation" => parameter,
        _ => return Err("Native control target has no current Registry scalar binding".into()),
    };
    // Source uses encodeURIComponent on the actual material Entity.id.
    let mut encoded = String::new();
    for byte in entity_ref.bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
            encoded.push(byte as char);
        } else {
            use std::fmt::Write;
            write!(&mut encoded, "%{byte:02X}").map_err(|e| e.to_string())?;
        }
    }
    if control["target"].as_str() != Some(format!("entity:{encoded}:{suffix}").as_str()) {
        return Err(
            "Native control encoded target differs from its actual Entity/Parameter".into(),
        );
    }
    Ok(())
}
pub(crate) fn source_parameter_driver(
    document: &Document,
    entity_ref: &str,
    parameter: &str,
    preview_value: Option<&Value>,
) -> Result<Value, String> {
    let entity = document
        .entities
        .get(entity_ref)
        .ok_or("Unknown native driver occurrence")?;
    let native = entity
        .parameters
        .get(parameter)
        .ok_or("Actual native driver Parameter unavailable")?;
    super::parameter(parameter, native)?;
    let mut intake_budget = budget::Budget::new();
    let mut locations = 0usize;
    for scene in document
        .scenes
        .iter()
        .filter(|s| s.entity_refs.iter().any(|r| r == entity_ref))
    {
        locations = locations
            .checked_add(1)
            .ok_or("Native driver location overflow")?;
        if locations > MAX_TARGETS {
            return Err("Native driver manifestation bound exceeded before allocation".into());
        }
        let presentation = scene
            .presentation
            .as_ref()
            .ok_or("Actual driver material unavailable")?;
        intake_budget.reserve(4096)?;
        intake_budget.value(presentation)?;
        intake_budget.entity_refs(presentation)?;
        if preview_value.is_some() {
            intake_budget.value(presentation)?;
        }
    }
    let candidate = preview_value
        .map(|value| {
            document.edited(vec![
                Change::ParameterManual {
                    entity_ref: entity_ref.into(),
                    parameter: parameter.into(),
                },
                Change::ParameterSet {
                    entity_ref: entity_ref.into(),
                    parameter: parameter.into(),
                    value: value.clone(),
                },
            ])
        })
        .transpose()?;
    let mut addresses = Vec::new();
    let mut scenes = Vec::new();
    for scene in document
        .scenes
        .iter()
        .filter(|scene| scene.entity_refs.iter().any(|r| r == entity_ref))
    {
        let address = source_parameter_location(document, &scene.scene_ref, entity_ref, parameter)?;
        let entity_refs = manual::scene_entity_refs(document, scene)?;
        if !entity_refs
            .values()
            .any(|reference| reference == entity_ref)
        {
            return Err("Native driver occurrence has no actual authored material identity".into());
        }
        let mut presentation = serde_json::to_value(
            scene
                .presentation
                .as_ref()
                .ok_or("Actual driver Scene material unavailable")?,
        )
        .map_err(|e| e.to_string())?;
        if presentation["scene"]["procedural"].is_object() {
            presentation["scene"]["procedural"]["operations"] = json!([]);
        }
        let parameter_candidate = candidate
            .as_ref()
            .map(|candidate| {
                let scene = candidate
                    .scenes
                    .iter()
                    .find(|next| next.scene_ref == scene.scene_ref)
                    .ok_or("Native Parameter preview lost its Scene")?;
                let mut value = serde_json::to_value(
                    scene
                        .presentation
                        .as_ref()
                        .ok_or("Native Parameter preview lost its material")?,
                )
                .map_err(|e| e.to_string())?;
                if value["scene"]["procedural"].is_object() {
                    value["scene"]["procedural"]["operations"] = json!([]);
                }
                Ok::<Value, String>(value)
            })
            .transpose()?;
        addresses.push(address);
        scenes.push(json!({"scene_ref":scene.scene_ref,"entity_refs":entity_refs,"presentation":presentation,"parameter_candidate":parameter_candidate}));
    }
    if addresses.is_empty() || addresses.len() > MAX_TARGETS {
        return Err("Native driver has no bounded actual Scene manifestations".into());
    }
    addresses.sort();
    scenes.sort_by(|a, b| a["scene_ref"].as_str().cmp(&b["scene_ref"].as_str()));
    Ok(
        json!({"schema":"ql.native-parameter-driver/v1","expression_ref":document.expression_ref,
        "document_revision":document.revision,"entity_ref":entity_ref,"parameter":parameter,
        "native_parameter":native,"addresses":addresses,"scenes":scenes}),
    )
}

fn source_current_output_basis(document: &Document, contribution: &Value) -> Result<Value, String> {
    let generated = &contribution["generated_basis"];
    let owned: Vec<Address> = serde_json::from_value(contribution["owned_addresses"].clone())
        .map_err(|e| e.to_string())?;
    if owned.is_empty() {
        return Err("Current contribution has no exact native owner target".into());
    }
    for address in &owned {
        canonical_address(document, address)?;
    }
    if generated["schema"] == "oi.journey-scene/v1" {
        let occurrence = retained_text(contribution, "occurrence_ref")?;
        if owned.iter().any(|address| {
            address.scene_ref.as_deref() != Some(occurrence)
                || address.component != Component::Scene
                || address.property.is_some()
        }) {
            return Err("Current generated Scene has a different contribution owner".into());
        }
        let scene = document
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == occurrence)
            .ok_or("Current generated Scene is unavailable")?;
        let mut current = serde_json::to_value(
            scene
                .presentation
                .as_ref()
                .ok_or("Current generated Scene has no actual material")?,
        )
        .map_err(|e| e.to_string())?;
        current["scene"]
            .as_object_mut()
            .ok_or("Invalid current Scene material")?
            .remove("procedural");
        return Ok(current);
    }
    if let Some(parameter) = generated["parameter"].as_str() {
        let owned = source_parameter_addresses(document, contribution)?;
        let target = &owned[0];
        let entity = target
            .entity_ref
            .as_ref()
            .and_then(|reference| document.entities.get(reference))
            .ok_or("Current native parameter occurrence is unavailable")?;
        if contribution["occurrence_ref"].as_str() != target.entity_ref.as_deref() {
            return Err("Current native parameter has a different contribution occurrence".into());
        }
        let value = source_native_property(document, target, parameter)?;
        for location in &owned {
            if source_native_property(document, location, parameter)? != value {
                return Err(
                    "Shared native parameter locations disagree on their actual native value"
                        .into(),
                );
            }
        }
        let mut basis = json!({"schema":"ql.native-parameter-state/v1","address":target,"parameter":parameter,"value":value,"target_revision":entity.revision});
        if owned.len() > 1 {
            basis["addresses"] = json!(owned);
        }
        return Ok(basis);
    }
    if generated["native_flow"].is_array() {
        if contribution["occurrence_ref"] != document.expression_ref {
            return Err("Atlas contribution has a different whole occurrence".into());
        }
        if owned.is_empty()
            || owned.iter().any(|address| {
                address.component != Component::Expression
                    || address.property.is_some()
                    || address.expression_ref != document.expression_ref
            })
        {
            return Err("Atlas contribution has no exact native whole owner".into());
        }
        return Ok(
            json!({"schema":"ql.native-atlas-state/v1","expression_ref":document.expression_ref,"focus":document.selection,"scene_order":document.scenes.iter().map(|scene|scene.scene_ref.clone()).collect::<Vec<_>>()}),
        );
    }
    Err("Unsupported native contribution output basis".into())
}

fn source_current_contribution<'a>(
    document: &'a Document,
    reference: &str,
) -> Result<&'a Value, String> {
    let mut retained = None;
    for scene in &document.scenes {
        for row in scene
            .presentation
            .as_ref()
            .and_then(|presentation| presentation.scene["procedural"]["contributions"].as_array())
            .into_iter()
            .flatten()
            .filter(|row| row["contribution_ref"] == reference)
        {
            if retained.is_some_and(|prior| prior != row) {
                return Err("Conflicting retained native contribution projections".into());
            }
            retained = Some(row);
        }
    }
    let retained = retained.ok_or("Current contribution is unavailable from its native owner")?;
    if retained["status"] != "active" {
        return Err("Current contribution is detached from its native output".into());
    }
    Ok(retained)
}

/// Construct coordinates from the actual current native Document. The held
/// source projects these stored rows in the same event, before its causal seal.
/// This function neither interprets authored paths nor grants a producer.
pub(crate) fn source_event_intervention_contexts(
    document: &Document,
    current: &[Value],
) -> Result<Vec<Value>, String> {
    budget::preflight_event_contexts(document, current)?;
    let mut contexts = Vec::new();
    let mut seen = BTreeSet::new();
    for row in current {
        let reference = retained_text(row, "contribution_ref")?;
        if !seen.insert(reference) || !row["overlays"].as_array().is_some_and(Vec::is_empty) {
            return Err(
                "Current native event duplicates an output or supplies caller overlays".into(),
            );
        }
        let contribution = source_current_contribution(document, reference)?;
        let actual = source_current_output_basis(document, contribution)?;
        if row["material"] != actual {
            return Err("Current contribution differs from its actual native output".into());
        }
        let records = contribution["authored_overrides"]
            .as_array()
            .ok_or("Actual native contribution intervention rows unavailable")?;
        if records.len() > 2048 {
            return Err("Native stored intervention bound exceeded".into());
        }
        let owned: Vec<Address> = serde_json::from_value(contribution["owned_addresses"].clone())
            .map_err(|error| error.to_string())?;
        if contribution["generated_basis"]["native_flow"].is_array() {
            contexts.push(json!({"material_kind":"native_flow","basis":{
                "expression_ref":document.expression_ref,"contribution_ref":reference,
                "owned_addresses":owned,"current_state":actual,"document_revision":document.revision,
                "retained_native_records":records}}));
            continue;
        }
        let scenes = owned
            .iter()
            .map(|address| {
                address
                    .scene_ref
                    .as_deref()
                    .ok_or("Actual material intervention location unavailable")
            })
            .collect::<Result<BTreeSet<_>, _>>()?;
        if records.iter().any(|record| {
            !record["address"]["scene_ref"]
                .as_str()
                .is_some_and(|scene| scenes.contains(scene))
        }) {
            return Err(
                "Stored intervention escapes the contribution's actual Scene locations".into(),
            );
        }
        for reference_scene in scenes {
            let scene = document
                .scenes
                .iter()
                .find(|scene| scene.scene_ref == reference_scene)
                .ok_or("Current native intervention Scene unavailable")?;
            let presentation = manual::scene_material(scene)?;
            let entities = manual::scene_entity_refs(document, scene)?;
            let records = records
                .iter()
                .filter(|record| record["address"]["scene_ref"] == reference_scene)
                .cloned()
                .collect::<Vec<_>>();
            contexts.push(json!({"material_kind":"scene","basis":{
                "expression_ref":document.expression_ref,"scene_ref":reference_scene,
                "contribution_ref":reference,"owned_addresses":owned,"entity_refs":entities,
                "current_presentation":presentation,"document_revision":document.revision,
                "retained_native_records":records}}));
        }
    }
    if contexts.len() > 2048 {
        return Err("Native event intervention context bound exceeded".into());
    }
    Ok(contexts)
}

/// Re-admit the facts used by a source compiler against its actual intake
/// Document. Availability labels and copied subject rows do not replace it.
pub(crate) fn validate_retained_procedural_definition(
    document: &Document,
    definition: &Value,
) -> Result<(), String> {
    if definition["expression_ref"] != document.expression_ref {
        return Err("Installed procedure belongs to another native Expression".into());
    }
    fn recheck(document: &Document, value: &Value) -> Result<(), String> {
        match value {
            Value::Object(object) => {
                if value["native_owner"] == "oi.expression"
                    && object.contains_key("material_fingerprint")
                    && object.contains_key("presentation")
                    && object.contains_key("source_basis")
                {
                    source_recheck_scene_source(document, value, true)?;
                }
                for child in object.values() {
                    recheck(document, child)?;
                }
            }
            Value::Array(rows) => {
                for child in rows {
                    recheck(document, child)?;
                }
            }
            _ => {}
        }
        Ok(())
    }
    recheck(document, &definition["program"])
}

pub(crate) fn validate_source_payload(document: &Document, payload: &Value) -> Result<(), String> {
    for key in [
        "current_readings",
        "current_contributions",
        "output_readings",
        "intervention_contexts",
    ] {
        if payload.get(key).is_some_and(|value| !value.is_array()) {
            return Err(format!(
                "Native source {key} must retain its actual typed array"
            ));
        }
    }
    if payload
        .get("expression_ref")
        .is_some_and(|value| value.as_str() != Some(document.expression_ref.as_str()))
        || payload
            .get("document_revision")
            .is_some_and(|value| value.as_u64() != Some(document.revision))
    {
        return Err("Wrong original procedural compiler Document".into());
    }
    if let Some(rows) = payload.get("current_readings").and_then(Value::as_array) {
        for row in rows {
            source_recheck_target_parts(document, row)?;
            let address: Address =
                serde_json::from_value(row["address"].clone()).map_err(|e| e.to_string())?;
            if row["occurrence_ref"].as_str()
                != Some(source_occurrence_ref(&canonical_address(document, &address)?)?.as_str())
            {
                return Err("Compiler occurrence key differs from its actual native target".into());
            }
        }
    }
    fn scene_sources(
        document: &Document,
        value: &Value,
        retained_program: bool,
    ) -> Result<(), String> {
        match value {
            Value::Object(object) => {
                if object.contains_key("material_fingerprint")
                    && object.contains_key("presentation")
                    && object.contains_key("source_basis")
                    && object.contains_key("scene_ref")
                {
                    source_recheck_scene_source(document, value, retained_program)?;
                }
                for (key, child) in object {
                    scene_sources(
                        document,
                        child,
                        retained_program || key == "native_program" || key == "program",
                    )?;
                }
            }
            Value::Array(rows) => {
                for child in rows {
                    scene_sources(document, child, retained_program)?;
                }
            }
            _ => {}
        }
        Ok(())
    }
    scene_sources(document, payload, false)?;
    if let Some(current) = payload
        .get("current_contributions")
        .and_then(Value::as_array)
    {
        let actual_contexts = source_event_intervention_contexts(document, current)?;
        let supplied = payload
            .get("intervention_contexts")
            .and_then(Value::as_array);
        if supplied.is_some_and(|contexts| contexts != &actual_contexts) {
            return Err("Event intervention context differs from actual native Scene, flow or retained attribution".into());
        }
        if supplied.is_none()
            && current.iter().any(|row| {
                source_current_contribution(
                    document,
                    row["contribution_ref"].as_str().unwrap_or(""),
                )
                .ok()
                .is_some_and(|contribution| {
                    !contribution["authored_overrides"]
                        .as_array()
                        .is_some_and(Vec::is_empty)
                })
            })
        {
            return Err("Current interventions require the same event's protected native contexts before source compilation".into());
        }
    }
    if let Some(context) = payload.get("materialization") {
        if ![
            "ql.procedural-materialization/v1",
            "ql.procedural-lifecycle-materialization-reading/v1",
        ]
        .contains(&context["schema"].as_str().unwrap_or(""))
            || context["document_revision"].as_u64() != Some(document.revision)
        {
            return Err("Wrong native procedural materialization basis".into());
        }
        let mut seen_scenes = BTreeSet::new();
        for row in context["scenes"]
            .as_array()
            .ok_or("Materialization has no actual scene contexts")?
        {
            let reference = row["scene_ref"]
                .as_str()
                .ok_or("Materialization has no exact Scene reference")?;
            if !seen_scenes.insert(reference)
                || !reference.starts_with(&format!("{}:scene:", document.expression_ref))
            {
                return Err("Duplicate or foreign native materialization Scene".into());
            }
            if row["document_revision"].as_u64() != Some(document.revision) {
                return Err("Stale native Scene materialization context".into());
            }
            let scene = document
                .scenes
                .iter()
                .find(|scene| scene.scene_ref == reference);
            let Some(scene) = scene else {
                let program = payload
                    .get("program")
                    .unwrap_or(&payload["procedure"]["recipe_parameters"]["native_program"]);
                let output = program["outputs"]
                    .as_array()
                    .and_then(|outputs| {
                        let matches: Vec<_> = outputs
                            .iter()
                            .filter(|output| output["scene_ref"] == reference)
                            .collect();
                        (matches.len() == 1).then(|| matches[0])
                    })
                    .ok_or(
                        "New materialization Scene has no exact current native program source",
                    )?;
                let source = &output["source"];
                if !row["existing_retention"].is_null()
                    || !row["current_presentation"].is_null()
                    || row["principal"] != source["principal"]
                    || row["contributors"] != source["contributors"]
                    || row["locus"]
                        != json!({"ref":source["locus_ref"],"revision":source["locus_revision"],"availability":"available"})
                {
                    return Err("New materialization Scene relabels its actual source principal, contributors, place or empty owner state".into());
                }
                continue;
            };
            let target = address(document, Some(reference), None, Component::Scene);
            let binding = source_exact_binding(document, &target)?
                .ok_or("Materialization requires its exact full native Scene source binding")?;
            if row["principal"] != source_native_subject(document, &target)?
                || row["contributors"] != binding["contributors"]
                || row["locus"] != binding["locus"]
            {
                return Err("Materialization relabels the native Scene principal, contributors or canonical place".into());
            }
            let actual = scene
                .presentation
                .as_ref()
                .ok_or("Keep actual authored Scene material for procedure retention")?;
            let mut projected = serde_json::to_value(actual).map_err(|e| e.to_string())?;
            let mut retained = projected["scene"]
                .as_object_mut()
                .ok_or("Invalid actual material")?
                .remove("procedural")
                .unwrap_or_else(empty_retention);
            retained["operations"] = json!([]);
            if row["existing_retention"] != retained
                || row
                    .get("current_presentation")
                    .filter(|v| !v.is_null())
                    .is_some_and(|value| *value != projected)
            {
                return Err("Native materializer source differs from actual retained controls, interventions or material".into());
            }
        }
    }
    Ok(())
}

// Whole authoring material uses the actual Journey domains. Explicit
// native scalar-control addresses additionally use the narrower Parameter
// lane. These are different native interfaces, not interchangeable domains.
fn validate_material_parameters(
    document: &Document,
    scene_ref: &str,
    material: &Value,
    targets: &[Address],
) -> Result<(), String> {
    validate_scene_sources(material)?;
    fn number(value: &Value, min: f64, max: f64, name: &str) -> Result<f64, String> {
        value
            .as_f64()
            .filter(|v| v.is_finite() && *v >= min && *v <= max)
            .ok_or_else(|| {
                format!("Material {name} is outside its actual authored domain [{min}, {max}]")
            })
    }
    fn record(
        before: Option<&Value>,
        after: &Value,
        scalar_lane: bool,
        document: &Document,
        scene: &str,
        entity: &str,
        targets: &[Address],
    ) -> Result<(), String> {
        for (pointer, key, component, property, factor, min, max) in [
            (
                "/position/x",
                "x",
                Component::Entity,
                "position.x",
                400.0,
                -100.0,
                100.0,
            ),
            (
                "/position/y",
                "y",
                Component::Entity,
                "position.y",
                400.0,
                -100.0,
                100.0,
            ),
            (
                "/position/z",
                "z",
                Component::Entity,
                "position.z",
                400.0,
                -100.0,
                100.0,
            ),
            (
                "/size/x",
                "width",
                Component::Entity,
                "size.x",
                400.0,
                0.001,
                100.0,
            ),
            (
                "/size/y",
                "height",
                Component::Entity,
                "size.y",
                400.0,
                0.001,
                100.0,
            ),
            (
                "/rotation",
                "rotation",
                Component::Entity,
                "rotation",
                std::f64::consts::PI / 180.0,
                -36000.0,
                36000.0,
            ),
            (
                "/share",
                "share",
                Component::Entity,
                "share",
                1.0,
                0.0,
                1000.0,
            ),
            (
                "/force/strength",
                "force_strength",
                Component::Force,
                "strength",
                1.0,
                -1000.0,
                1000.0,
            ),
            (
                "/force/spin",
                "force_spin",
                Component::Force,
                "spin",
                1.0,
                -1000.0,
                1000.0,
            ),
            (
                "/force/radius",
                "force_radius",
                Component::Force,
                "radius",
                400.0,
                0.001,
                125.0,
            ),
        ] {
            if let Some(value) = after.pointer(pointer) {
                if before.and_then(|v| v.pointer(pointer)) == Some(value) {
                    continue;
                }
                let value = number(value, min, max, pointer)?;
                let mut a = address(document, Some(scene), Some(entity), component);
                a.property = Some(property.into());
                if scalar_lane
                    && targets
                        .iter()
                        .any(|t| t.property.is_some() && covers(t, &a))
                {
                    let value = serde_json::Number::from_f64(value * factor)
                        .ok_or("Non-finite native scalar")?;
                    super::parameter(
                        key,
                        &super::Parameter {
                            value: Value::Number(value),
                            automation: None,
                        },
                    )?;
                }
            } else if before.and_then(|v| v.pointer(pointer)).is_some() {
                return Err(format!(
                    "Required consumed material field {pointer} was removed"
                ));
            }
        }
        if let Some(value) = after.get("scale") {
            if before.and_then(|v| v.get("scale")) != Some(value) {
                // The native entity receiver accepts finite material scale;
                // state.objectState has its explicit .001..1000 source range.
                let value = if scalar_lane {
                    value
                        .as_f64()
                        .filter(|v| v.is_finite())
                        .ok_or("Non-finite material scale")?
                } else {
                    number(value, 0.001, 1000.0, "objectState.scale")?
                };
                let mut a = address(document, Some(scene), Some(entity), Component::Entity);
                a.property = Some("scale".into());
                if scalar_lane
                    && targets
                        .iter()
                        .any(|t| t.property.is_some() && covers(t, &a))
                {
                    super::parameter(
                        "scale",
                        &super::Parameter {
                            value: json!(value),
                            automation: None,
                        },
                    )?;
                }
            }
        }
        if let Some(state) = after.get("objectState") {
            record(
                before.and_then(|v| v.get("objectState")),
                state,
                false,
                document,
                scene,
                entity,
                targets,
            )?;
        }
        for states_path in ["/sequence/steps", "/sequence/links"] {
            if let Some(rows) = after.pointer(states_path).and_then(Value::as_array) {
                for row in rows {
                    let old = before
                        .and_then(|v| v.pointer(states_path))
                        .and_then(Value::as_array)
                        .and_then(|rows| rows.iter().find(|old| old["id"] == row["id"]));
                    record(old, row, false, document, scene, entity, targets)?;
                }
            }
        }
        if let Some(rows) = after.get("layers").and_then(Value::as_array) {
            for layer in rows {
                let old = before
                    .and_then(|v| v.get("layers"))
                    .and_then(Value::as_array)
                    .and_then(|rows| rows.iter().find(|old| old["id"] == layer["id"]));
                for (key, min, max) in [("scale", 0.01, 10.0), ("z", -100.0, 100.0)] {
                    if let Some(value) = layer.get(key) {
                        if old.and_then(|v| v.get(key)) != Some(value) {
                            number(value, min, max, key)?;
                        }
                    } else if key == "z" {
                        return Err("Layer has no required consumed depth".into());
                    }
                }
                if !layer.get("text").is_some_and(|v| {
                    v.as_str()
                        .is_some_and(|s| scalar_lane || s.encode_utf16().count() <= 120)
                }) {
                    return Err("Layer has no valid required consumed text".into());
                }
            }
        }
        Ok(())
    }
    let old = document
        .scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .and_then(|s| s.presentation.as_ref())
        .map(|p| &p.scene);
    if let Some(entities) = material.get("entities").and_then(Value::as_array) {
        for entity in entities {
            let before = old
                .and_then(|s| s.get("entities"))
                .and_then(Value::as_array)
                .and_then(|entities| entities.iter().find(|old| old["id"] == entity["id"]));
            record(
                before,
                entity,
                true,
                document,
                scene_ref,
                entity["id"]
                    .as_str()
                    .ok_or("Material entity lacks stable identity")?,
                targets,
            )?;
        }
    }
    Ok(())
}

/// Validate the *actual* native write set, including changes hidden in a full
/// Scene material replacement. A resolved selection is never merely a preview.
fn validate_write_set(
    document: &Document,
    targets: &[Address],
    changes: &[Change],
    producer: Option<&ProducerAdmission>,
) -> Result<(), String> {
    // Native change order and all real domain laws are checked by the same
    // pure edit calculation. Constructed targets may occur later in this
    // batch, while pre-existing shared occurrences retain their own fences.
    let candidate = document.edited(changes.to_vec())?;
    let require = |target: Address| -> Result<(), String> {
        if targets.iter().any(|allowed| covers(allowed, &target)) {
            Ok(())
        } else {
            Err(format!(
                "Change writes outside resolved scope: {:?}",
                target
            ))
        }
    };
    for change in changes {
        let raw = serde_json::to_value(change).map_err(|e| e.to_string())?;
        match change {
            Change::CompositionSet { presentation } => {
                let before =
                    serde_json::to_value(&document.presentation).map_err(|e| e.to_string())?;
                let after = serde_json::to_value(presentation).map_err(|e| e.to_string())?;
                for property in leaf_changes(&before, &after, "") {
                    let mut a = address(document, None, None, Component::Expression);
                    a.property = Some(
                        if property.starts_with("shared.values.")
                            || property.starts_with("shared.pointer.")
                        {
                            property
                        } else {
                            format!("presentation.{property}")
                        },
                    );
                    require(a)?;
                }
            }

            Change::ParameterSet {
                entity_ref,
                parameter,
                ..
            }
            | Change::ParameterAutomate {
                entity_ref,
                parameter,
                ..
            }
            | Change::ParameterManual {
                entity_ref,
                parameter,
            } => {
                let (component, property) = match parameter.as_str() {
                    "force_strength" => (Component::Force, "strength"),
                    "force_spin" => (Component::Force, "spin"),
                    "force_radius" => (Component::Force, "radius"),
                    "force_mode" => (Component::Force, "kind"),
                    "x" => (Component::Entity, "position.x"),
                    "y" => (Component::Entity, "position.y"),
                    "z" => (Component::Entity, "position.z"),
                    "width" => (Component::Entity, "size.x"),
                    "height" => (Component::Entity, "size.y"),
                    "glyph" => (Component::Entity, "text"),
                    "yantra" => (Component::Entity, "yantraId"),
                    "frequency" => (Component::Entity, "templateFrequency"),
                    "ascii" | "image" => (Component::Entity, "source"),
                    "scale" | "share" | "kind" | "shape" | "rotation" => {
                        (Component::Entity, parameter.as_str())
                    }
                    other => (Component::Property, other),
                };
                let property = property.to_owned();
                let mut admitted = false;
                for scene in document
                    .scenes
                    .iter()
                    .chain(candidate.scenes.iter())
                    .filter(|s| s.entity_refs.contains(entity_ref))
                {
                    let mut a = address(
                        document,
                        Some(&scene.scene_ref),
                        Some(entity_ref),
                        component.clone(),
                    );
                    a.property = Some(property.clone());
                    if !targets.iter().any(|t| covers(t, &a)) {
                        return Err("Shared native entity parameter writes outside another occurrence's scope".into());
                    }
                    admitted = true;
                }
                if !admitted {
                    return Err("Parameter writes outside resolved scope".into());
                }
            }
            Change::SceneMaterialSet {
                scene_ref,
                presentation,
            } => {
                if let Some(admitted) = producer.filter(|p| {
                    p.metadata
                        .iter()
                        .any(|a| a.scene_ref.as_ref() == Some(scene_ref))
                }) {
                    let original = document
                        .scenes
                        .iter()
                        .find(|s| &s.scene_ref == scene_ref)
                        .and_then(|s| s.presentation.as_ref())
                        .ok_or("Original source anchor material unavailable")?;
                    let mut old = serde_json::to_value(original).map_err(|e| e.to_string())?;
                    let mut new = serde_json::to_value(presentation).map_err(|e| e.to_string())?;
                    old["scene"]
                        .as_object_mut()
                        .ok_or("Invalid original source anchor material")?
                        .remove("procedural");
                    new["scene"]
                        .as_object_mut()
                        .ok_or("Invalid proposed source anchor material")?
                        .remove("procedural");
                    if old != new {
                        return Err(
                            "Source metadata scope cannot change authored anchor material".into(),
                        );
                    }
                    let sealed = admitted
                        .changes
                        .iter()
                        .filter_map(|change| match change {
                            Change::SceneMaterialSet {
                                scene_ref: reference,
                                presentation,
                            } if reference == scene_ref => Some(presentation),
                            _ => None,
                        })
                        .collect::<Vec<_>>();
                    if sealed.len() != 1 {
                        return Err(
                            "Source anchor has no unique sealed native metadata change".into()
                        );
                    }
                    let mut actual = presentation.scene["procedural"].clone();
                    let mut expected = sealed[0].scene["procedural"].clone();
                    actual["operations"] = json!([]);
                    expected["operations"] = json!([]);
                    if actual != expected {
                        return Err("Source anchor retention differs from the original sealed native intent".into());
                    }
                    continue;
                }
                validate_material_parameters(document, scene_ref, &presentation.scene, targets)?;
                let broad = address(document, Some(scene_ref), None, Component::Scene);
                if targets.iter().any(|t| covers(t, &broad)) {
                    continue;
                }
                let old = document
                    .scenes
                    .iter()
                    .find(|s| &s.scene_ref == scene_ref)
                    .and_then(|s| s.presentation.as_ref())
                    .ok_or("Granular material edit needs existing Scene material")?;
                if old.saved != presentation.saved {
                    return Err("Granular edit cannot replace the saved Scene".into());
                }
                let before = old.scene.as_object().ok_or("Invalid Scene material")?;
                let after = presentation
                    .scene
                    .as_object()
                    .ok_or("Invalid Scene material")?;
                for key in before.keys().chain(after.keys()).collect::<BTreeSet<_>>() {
                    if before.get(key) == after.get(key) {
                        continue;
                    }
                    if key == "procedural" {
                        validate_retention_metadata_write(
                            document,
                            scene_ref,
                            before.get(key),
                            after.get(key),
                            targets,
                            producer,
                        )?;
                        continue;
                    }
                    if key == "field" {
                        let mut a = address(document, Some(scene_ref), None, Component::Field);
                        let old = before.get(key).unwrap_or(&Value::Null);
                        let new = after.get(key).unwrap_or(&Value::Null);
                        for property in leaf_changes(old, new, "") {
                            a.property = Some(property);
                            require(a.clone())?;
                        }
                    } else if key == "entities" {
                        let old = before[key]
                            .as_array()
                            .ok_or("Invalid old entity material")?;
                        let new = after[key].as_array().ok_or("Invalid new entity material")?;
                        let old_ids: Vec<_> = old.iter().map(|v| v["id"].as_str()).collect();
                        let new_ids: Vec<_> = new.iter().map(|v| v["id"].as_str()).collect();
                        if old_ids != new_ids {
                            return Err(
                                "Granular material edit cannot reorder/add/drop occurrences".into(),
                            );
                        }
                        for (old, new) in old.iter().zip(new) {
                            let r = old["id"].as_str().ok_or("Entity material lacks identity")?;
                            if old == new {
                                continue;
                            }
                            let broad =
                                address(document, Some(scene_ref), Some(r), Component::Entity);
                            if targets.iter().any(|a| covers(a, &broad)) {
                                continue;
                            }
                            for a in material_entity_changes(document, scene_ref, r, old, new)? {
                                require(a)?;
                            }
                        }
                    } else {
                        for property in leaf_changes(
                            before.get(key).unwrap_or(&Value::Null),
                            after.get(key).unwrap_or(&Value::Null),
                            key,
                        ) {
                            let mut a =
                                address(document, Some(scene_ref), None, Component::Property);
                            a.property = Some(property);
                            require(a)?;
                        }
                    }
                }
            }
            Change::SceneCreate { .. } | Change::EntityAdd { .. } => {
                let scene = raw["scene_ref"].as_str();
                let a = address(
                    document,
                    scene,
                    if matches!(change, Change::EntityAdd { .. }) {
                        raw["entity_ref"].as_str()
                    } else {
                        None
                    },
                    if matches!(change, Change::SceneCreate { .. }) {
                        Component::Scene
                    } else {
                        Component::Entity
                    },
                );
                require(a)?;
            }
            _ => {
                let scene = raw["scene_ref"].as_str();
                let entity = raw["entity_ref"].as_str();
                if let Some(entity) = entity {
                    let scenes: Vec<_> = document
                        .scenes
                        .iter()
                        .chain(candidate.scenes.iter())
                        .filter(|s| s.entity_refs.iter().any(|r| r == entity))
                        .collect();
                    if scenes.is_empty()
                        || !scenes.iter().all(|s| {
                            targets.iter().any(|t| {
                                covers(
                                    t,
                                    &address(
                                        document,
                                        Some(&s.scene_ref),
                                        Some(entity),
                                        Component::Entity,
                                    ),
                                )
                            })
                        })
                    {
                        return Err("Shared entity change writes outside scope".into());
                    }
                } else {
                    require(address(
                        document,
                        scene,
                        None,
                        if scene.is_some() {
                            Component::Scene
                        } else {
                            Component::Expression
                        },
                    ))?;
                }
            }
        }
    }
    Ok(())
}

fn leaf_changes(before: &Value, after: &Value, prefix: &str) -> Vec<String> {
    if before == after {
        return vec![];
    }
    if let (Some(a), Some(b)) = (before.as_object(), after.as_object()) {
        a.keys()
            .chain(b.keys())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .flat_map(|key| {
                let path = if prefix.is_empty() {
                    key.clone()
                } else {
                    format!("{prefix}.{key}")
                };
                leaf_changes(
                    a.get(key).unwrap_or(&Value::Null),
                    b.get(key).unwrap_or(&Value::Null),
                    &path,
                )
            })
            .collect()
    } else {
        vec![prefix.into()]
    }
}

fn stable_list_changes(
    document: &Document,
    scene: &str,
    entity: &str,
    component: Component,
    parent: Option<&str>,
    before: &Value,
    after: &Value,
) -> Result<Vec<Address>, String> {
    let read = |value: &Value| -> Result<BTreeMap<String, Value>, String> {
        let mut rows = BTreeMap::new();
        for row in value
            .as_array()
            .ok_or("Constituents must be a stable-id list")?
        {
            let id = row["id"]
                .as_str()
                .ok_or("Constituent lacks its stable ref")?;
            super::text(id)?;
            if rows.insert(id.into(), row.clone()).is_some() {
                return Err("Duplicate constituent identity".into());
            }
        }
        Ok(rows)
    };
    let old = read(before)?;
    let new = read(after)?;
    let mut out = Vec::new();
    if before
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["id"].clone())
        .collect::<Vec<_>>()
        != after
            .as_array()
            .unwrap()
            .iter()
            .map(|r| r["id"].clone())
            .collect::<Vec<_>>()
    {
        // Membership/order is a sequence/layer collection operation. Stable
        // refs prevent accidental retargeting; they do not grant a list edit.
        out.push(address(
            document,
            Some(scene),
            Some(entity),
            if component == Component::SequenceLink {
                Component::Sequence
            } else {
                Component::Entity
            },
        ));
    }
    for id in old.keys().chain(new.keys()).collect::<BTreeSet<_>>() {
        for property in leaf_changes(
            old.get(id).unwrap_or(&Value::Null),
            new.get(id).unwrap_or(&Value::Null),
            "",
        ) {
            if component == Component::SequenceLink && property == "layers" {
                let empty = json!([]);
                for mut a in stable_list_changes(
                    document,
                    scene,
                    entity,
                    Component::Layer,
                    Some(id),
                    old.get(id)
                        .and_then(|row| row.get("layers"))
                        .unwrap_or(&empty),
                    new.get(id)
                        .and_then(|row| row.get("layers"))
                        .unwrap_or(&empty),
                )? {
                    if a.component == Component::Entity {
                        a.component = Component::SequenceLink;
                        a.constituent_ref = Some(id.clone());
                    }
                    out.push(a);
                }
                continue;
            }
            let mut a = address(document, Some(scene), Some(entity), component.clone());
            a.constituent_ref = Some(id.clone());
            if component == Component::Layer {
                a.parent_ref = Some(parent.map(str::to_owned));
            }
            a.property = (!property.is_empty()).then_some(property);
            out.push(a);
        }
    }
    Ok(out)
}

fn material_entity_changes(
    document: &Document,
    scene: &str,
    entity: &str,
    before: &Value,
    after: &Value,
) -> Result<Vec<Address>, String> {
    let mut out = Vec::new();
    let empty = json!([]);
    for property in leaf_changes(before, after, "") {
        if property == "layers" || property == "native.layers" {
            out.extend(stable_list_changes(
                document,
                scene,
                entity,
                Component::Layer,
                None,
                path(before, &property).unwrap_or(&empty),
                path(after, &property).unwrap_or(&empty),
            )?);
            continue;
        }
        if ["sequence.steps", "sequence.links", "native.sequence.links"]
            .contains(&property.as_str())
        {
            out.extend(stable_list_changes(
                document,
                scene,
                entity,
                Component::SequenceLink,
                None,
                path(before, &property).unwrap_or(&empty),
                path(after, &property).unwrap_or(&empty),
            )?);
            continue;
        }
        let mut a = address(document, Some(scene), Some(entity), Component::Entity);
        if let Some(p) = property
            .strip_prefix("force.")
            .or_else(|| property.strip_prefix("forces."))
            .or_else(|| property.strip_prefix("native.forces."))
        {
            a.component = Component::Force;
            a.property = Some(p.into());
        } else if let Some(p) = property
            .strip_prefix("sequence.")
            .or_else(|| property.strip_prefix("native.sequence."))
        {
            a.component = Component::Sequence;
            a.property = Some(p.into());
        } else {
            a.property = Some(property);
        }
        out.push(a);
    }
    Ok(out)
}

fn validate_retention_metadata_write(
    document: &Document,
    scene: &str,
    before: Option<&Value>,
    after: Option<&Value>,
    targets: &[Address],
    producer: Option<&ProducerAdmission>,
) -> Result<(), String> {
    let empty = json!({});
    let before = before.unwrap_or(&empty);
    let after = after.unwrap_or(&empty);
    let keys = before
        .as_object()
        .ok_or("Invalid old retention")?
        .keys()
        .chain(after.as_object().ok_or("Invalid new retention")?.keys())
        .collect::<BTreeSet<_>>();
    for key in keys {
        if before[key] == after[key] {
            continue;
        }
        if key == "schema" && before[key].is_null() && after[key] == SCHEMA {
            continue;
        }
        if key == "procedures" {
            let admitted = producer.ok_or(
                "A granular procedure definition requires its actual sealed native producer",
            )?;
            let definition = &admitted.prepared["original_procedure"];
            let reference = definition["procedure_ref"]
                .as_str()
                .ok_or("Native procedure definition lacks identity")?;
            let old = before[key].as_array().map(Vec::as_slice).unwrap_or(&[]);
            let new = after[key]
                .as_array()
                .ok_or("Native procedures must remain an actual list")?;
            for row in old.iter().chain(new) {
                if old.contains(row) && new.contains(row) {
                    continue;
                }
                if row["procedure_ref"].as_str() != Some(reference) {
                    return Err("Source-sealed granular metadata changed another procedure".into());
                }
            }
            let row = new
                .iter()
                .find(|row| row["procedure_ref"].as_str() == Some(reference))
                .ok_or("Source-sealed definition cannot drop its continuing procedure")?;
            if row["definition"] != *definition || row["revision"] != definition["revision"] {
                return Err(
                    "Retained procedure differs from the actual original source definition".into(),
                );
            }
            continue;
        }
        if let Some(admitted) = producer.filter(|_| key == "source_basis") {
            let definition = &admitted.prepared["original_procedure"];
            let old = before[key].as_array().map(Vec::as_slice).unwrap_or(&[]);
            let new = after[key]
                .as_array()
                .ok_or("Invalid source-qualified retention basis")?;
            if old.iter().any(|row|!new.contains(row)) || new.iter().filter(|row|!old.contains(row)).any(|row|*row!=json!({"ref":definition["recipe"]["source_ref"],"revision":definition["recipe"]["revision"],"availability":"available"})&&*row!=json!({"ref":definition["profile"]["source_ref"],"revision":definition["profile"]["revision"],"availability":"available"})) {
                return Err("Granular native source metadata replaced another continuing source basis".into());
            }
            continue;
        }
        let identity = match key.as_str() {
            "bindings" => "address",
            "controls" => "target",
            "contributions" => "contribution_ref",
            _ => {
                return Err(format!(
                    "Granular edit cannot replace global procedural {key}"
                ));
            }
        };
        let old = before[key].as_array().map(Vec::as_slice).unwrap_or(&[]);
        let new = after[key].as_array().map(Vec::as_slice).unwrap_or(&[]);
        for row in old.iter().chain(new) {
            if old.iter().any(|r| r == row) && new.iter().any(|r| r == row) {
                continue;
            }
            let addresses = if key == "contributions" {
                row["owned_addresses"]
                    .as_array()
                    .cloned()
                    .ok_or("Contribution lacks owned targets")?
            } else {
                vec![row["address"].clone()]
            };
            if row[identity].is_null() || addresses.is_empty() {
                return Err("Retained contribution/control lacks identity or targets".into());
            }
            for raw in addresses {
                let a: Address = serde_json::from_value(raw).map_err(|e| e.to_string())?;
                if a.scene_ref.as_deref() != Some(scene) || !targets.iter().any(|t| covers(t, &a)) {
                    return Err("Retained metadata writes outside selected scope".into());
                }
                addressed(document, &a)?;
            }
        }
    }
    Ok(())
}

pub fn resolve(document: &Document, scope: &Scope) -> Result<Vec<Address>, String> {
    let mut targets = BTreeSet::new();
    match scope {
        Scope::Expression => {
            targets.insert(address(document, None, None, Component::Expression));
        }
        Scope::Addresses { addresses } => {
            if addresses.is_empty() {
                return Err("An explicit address scope cannot be empty".into());
            }
            for a in addresses {
                targets.insert(canonical_address(document, a)?);
            }
        }
        Scope::Scenes { scene_refs } => {
            for r in scene_refs {
                let a = address(document, Some(r), None, Component::Scene);
                addressed(document, &a)?;
                targets.insert(a);
            }
        }
        Scope::Subject { subject_ref } => {
            super::text(subject_ref)?;
            for scene in &document.scenes {
                if scene
                    .body
                    .as_ref()
                    .is_some_and(|body| body.subject_ref == *subject_ref)
                {
                    targets.insert(address(
                        document,
                        Some(&scene.scene_ref),
                        None,
                        Component::Scene,
                    ));
                }
                for r in &scene.entity_refs {
                    if document
                        .entities
                        .get(r)
                        .and_then(|e| e.subject.as_ref())
                        .is_some_and(|s| s.subject_ref == *subject_ref)
                    {
                        targets.insert(address(
                            document,
                            Some(&scene.scene_ref),
                            Some(r),
                            Component::Entity,
                        ));
                    }
                }
                for binding in bindings(scene) {
                    if binding["principal"]["subject_ref"] == *subject_ref
                        || binding["contributors"]
                            .as_array()
                            .is_some_and(|v| v.iter().any(|c| c["subject_ref"] == *subject_ref))
                    {
                        let a: Address = serde_json::from_value(binding["address"].clone())
                            .map_err(|e| e.to_string())?;
                        addressed(document, &a)?;
                        targets.insert(a);
                    }
                }
            }
        }
        Scope::Locus {
            source_ref,
            source_revision,
        } => {
            super::text(source_ref)?;
            super::text(source_revision)?;
            for scene in &document.scenes {
                for binding in bindings(scene) {
                    if binding["locus"]["ref"] == *source_ref
                        && binding["locus"]["revision"] == *source_revision
                    {
                        let a: Address = serde_json::from_value(binding["address"].clone())
                            .map_err(|e| e.to_string())?;
                        addressed(document, &a)?;
                        targets.insert(a);
                    }
                }
            }
        }
        Scope::Tag {
            scene_refs,
            tag,
            origin,
        } => {
            if !matches!(origin.as_str(), "native" | "authored" | "generated") {
                return Err("Tag origin is required".into());
            }
            super::text(tag)?;
            for r in scene_refs {
                let scene = document
                    .scenes
                    .iter()
                    .find(|s| s.scene_ref == *r)
                    .ok_or("Unknown tag containing scope")?;
                for binding in bindings(scene) {
                    if binding["tags"].as_array().is_some_and(|v| {
                        v.iter().any(|t| t["tag"] == *tag && t["origin"] == *origin)
                    }) {
                        let a: Address = serde_json::from_value(binding["address"].clone())
                            .map_err(|e| e.to_string())?;
                        addressed(document, &a)?;
                        targets.insert(a);
                    }
                }
            }
        }
    }
    if targets.len() > MAX_TARGETS {
        return Err("Resolved scope exceeds native cardinality".into());
    }
    Ok(targets.into_iter().collect())
}

fn bindings(scene: &super::Scene) -> impl Iterator<Item = &Value> {
    scene
        .presentation
        .as_ref()
        .and_then(|p| p.scene["procedural"]["bindings"].as_array())
        .into_iter()
        .flatten()
}

pub fn validate_retention(value: &Value) -> Result<(), String> {
    crate::expression_scene::data(value, 0)?;
    let object = value
        .as_object()
        .ok_or("Procedural retention must be an object")?;
    if value["schema"] != SCHEMA
        || serde_json::to_vec(value).map_err(|e| e.to_string())?.len() > 1024 * 1024
    {
        return Err("Unsupported or unbounded procedural retention".into());
    }
    for key in object.keys() {
        if ![
            "schema",
            "bindings",
            "procedures",
            "contributions",
            "controls",
            "operations",
            "scene_flow",
            "time_mappings",
            "checkpoint",
            "source_basis",
        ]
        .contains(&key.as_str())
        {
            return Err(format!("Unsupported procedural retention field {key}"));
        }
    }
    for (key, bound) in [
        ("bindings", 2048),
        ("procedures", 64),
        ("contributions", 2048),
        ("controls", 2048),
        ("operations", 256),
        ("scene_flow", 64),
        ("time_mappings", 64),
        ("source_basis", 256),
    ] {
        if !object
            .get(key)
            .and_then(Value::as_array)
            .is_some_and(|v| v.len() <= bound)
        {
            return Err(format!("Invalid procedural {key} budget"));
        }
    }
    validate_retained_rows(value)?;
    Ok(())
}

pub fn empty_retention() -> Value {
    json!({"schema":SCHEMA,"bindings":[],"procedures":[],"contributions":[],"controls":[],"operations":[],"scene_flow":[],"time_mappings":[],"source_basis":[]})
}

fn end_fork_gestures(
    material: &mut Value,
) -> Result<Vec<(Address, super::Parameter, Value)>, String> {
    let controls = material["procedural"]["controls"]
        .as_array()
        .ok_or("Missing fork controls")?
        .clone();
    let mut retained = Vec::new();
    let mut bases = Vec::new();
    for control in controls {
        if control["takeover"]["lifetime"] != "gesture" {
            retained.push(control);
            continue;
        }
        let address = retained_address(&control["address"])?;
        let native_base: super::Parameter = serde_json::from_value(control.get("native_base").ok_or("Legacy gesture has no exact native driver base; release it through its source owner before Fork")?.clone()).map_err(|e| e.to_string())?;
        let native_value = control["takeover"]
            .get("native_value")
            .ok_or("Gesture lost its exact native takeover value")?
            .clone();
        super::parameter(fork_parameter_key(&address)?, &native_base)?;

        if address.constituent_ref.is_some() || address.parent_ref.is_some() {
            return Err("Gesture has no scalar owning parameter operation".into());
        }
        let property = address
            .property
            .as_deref()
            .ok_or("Gesture has no scalar property")?;
        let base = control["authored_base"]
            .as_f64()
            .filter(|v| v.is_finite())
            .ok_or("Gesture lost its scalar authored base")?;
        let target = control["target"]
            .as_str()
            .ok_or("Gesture lost its parameter target")?;
        let dormant = control["dormant_lanes"]
            .as_array()
            .ok_or("Gesture lost its dormant lanes")?;
        let tracks = control["dormant_tracks"]
            .as_array()
            .ok_or("Gesture lost its dormant tracks")?;
        let current_lanes = material["automation"]
            .as_array()
            .ok_or("Gesture has no actual automation container")?;
        if let Some(suspended) = control.get("suspended_lanes").and_then(Value::as_array) {
            for expected in suspended {
                if current_lanes
                    .iter()
                    .find(|lane| lane["id"] == expected["id"])
                    != Some(expected)
                {
                    return Err(
                        "Gesture retained automation group changed; reconcile before Fork".into(),
                    );
                }
            }
        }
        if current_lanes.iter().any(|lane| lane["target"] == target) {
            return Err("A new driver owns the gesture target; reconcile before Fork".into());
        }
        let bind = match address.component.clone() {
            Component::Force => format!("entity.force.{property}"),
            Component::Entity => format!("entity.{property}"),
            Component::Sequence => format!("entity.sequence.{property}"),
            Component::Field => format!("field.{property}"),
            Component::Property if address.entity_ref.is_none() => property.to_owned(),
            _ => return Err("Gesture has no actual scalar release operation".into()),
        };
        let current_tracks = material
            .get("propertyTracks")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        if current_tracks.iter().any(|track| {
            track["bind"] == bind && track["entityId"].as_str() == address.entity_ref.as_deref()
        }) {
            return Err(
                "A new property track owns the gesture target; reconcile before Fork".into(),
            );
        }
        let prior = control
            .get("dormant_overrides")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let contributions = material["procedural"]["contributions"]
            .as_array_mut()
            .ok_or("Gesture lost its retained contributions")?;
        for contribution in contributions {
            let saved = prior
                .iter()
                .find(|saved| saved["contribution_ref"] == contribution["contribution_ref"]);
            let owns = contribution["owned_addresses"]
                .as_array()
                .ok_or("Contribution lost its addresses")?
                .iter()
                .map(|value| {
                    serde_json::from_value::<Address>(value.clone()).map_err(|e| e.to_string())
                })
                .collect::<Result<Vec<_>, _>>()?
                .iter()
                .any(|owned| covers(owned, &address));
            if !owns && saved.is_none() {
                continue;
            }
            let saved = saved.ok_or("Gesture ownership changed; reconcile before Fork")?;
            let overrides = contribution["authored_overrides"]
                .as_array_mut()
                .ok_or("Contribution lost its overrides")?;
            let actual: Vec<Value> = overrides
                .iter()
                .filter(|row| row["address"] == control["address"])
                .cloned()
                .collect();
            if actual
                != *saved["takeover_overrides"]
                    .as_array()
                    .ok_or("Gesture lost its override release basis")?
            {
                return Err("Gesture intervention changed; reconcile before Fork".into());
            }
            overrides.retain(|row| row["address"] != control["address"]);
            overrides.extend(
                saved["overrides"]
                    .as_array()
                    .ok_or("Gesture lost its prior intervention")?
                    .iter()
                    .cloned(),
            );
        }
        // The property path is the admitted native Address, never Source text.
        let mut root = if let Some(entity) = address.entity_ref.as_deref() {
            material["entities"]
                .as_array_mut()
                .ok_or("Gesture target has no entity container")?
                .iter_mut()
                .find(|item| item["id"] == entity)
                .ok_or("Gesture target disappeared")?
        } else {
            &mut *material
        };
        root = match address.component.clone() {
            Component::Force => root.get_mut("force").ok_or("Gesture lost its Force")?,
            Component::Sequence => root
                .get_mut("sequence")
                .ok_or("Gesture lost its Sequence")?,
            Component::Field => root.get_mut("field").ok_or("Gesture lost its Field")?,
            _ => root,
        };
        for segment in property.split('.') {
            root = root
                .get_mut(segment)
                .ok_or("Gesture scalar path disappeared")?;
        }
        if *root != control["takeover"]["value"] {
            return Err("Gesture effective authored value changed; reconcile before Fork".into());
        }
        *root = json!(base);
        let ids: BTreeSet<&str> = dormant
            .iter()
            .filter_map(|lane| lane["id"].as_str())
            .collect();
        let lanes = material["automation"].as_array_mut().unwrap();
        lanes.retain(|lane| !lane["id"].as_str().is_some_and(|id| ids.contains(id)));
        lanes.extend(dormant.iter().cloned());
        material["propertyTracks"] = json!(current_tracks
            .into_iter()
            .chain(tracks.iter().cloned())
            .collect::<Vec<_>>());
        bases.push((address, native_base, native_value));
    }
    material["procedural"]["controls"] = json!(retained);
    Ok(bases)
}

fn fork_parameter_key(address: &Address) -> Result<&'static str, String> {
    // Exact declared native key aliases only; no numeric reconstruction.
    match (address.component.clone(), address.property.as_deref()) {
        (Component::Force, Some("strength")) => Ok("force_strength"),
        (Component::Force, Some("spin")) => Ok("force_spin"),
        (Component::Force, Some("radius")) => Ok("force_radius"),
        (Component::Entity, Some("position.x")) => Ok("x"),
        (Component::Entity, Some("position.y")) => Ok("y"),
        (Component::Entity, Some("position.z")) => Ok("z"),
        (Component::Entity, Some("rotation")) => Ok("rotation"),
        (Component::Entity, Some("scale")) => Ok("scale"),
        _ => Err("Gesture has no exact native Parameter release mapping".into()),
    }
}

/// A fork copies authored material, not another Expression's operation owner.
/// Original receipts remain unchanged in the original document and runtime.
pub(super) fn fork_document_retention(
    document: &mut Document,
    old: &str,
    new: &str,
) -> Result<(), String> {
    let prefix = format!("{old}:");
    let remap = |reference: &str| {
        if reference == old {
            Some(new.to_owned())
        } else {
            reference
                .strip_prefix(&prefix)
                .map(|suffix| format!("{new}:{suffix}"))
        }
    };
    let map_ref = |value: &mut Value| {
        if let Some(next) = value.as_str().and_then(&remap) {
            *value = json!(next);
        }
    };
    let map_address = |value: &mut Value| {
        // Layer, SequenceLink and Driver coordinates are stable opaque IDs.
        // Native Scene remapping changes only Expression/Scene/entity refs.
        for key in ["expression_ref", "scene_ref", "entity_ref"] {
            if let Some(reference) = value.get_mut(key) {
                map_ref(reference);
            }
        }
    };
    let mut parameter_bases: BTreeMap<(String, String), (super::Parameter, Value)> =
        BTreeMap::new();
    for scene in &mut document.scenes {
        let Some(presentation) = &mut scene.presentation else {
            continue;
        };
        for (material_index, material) in std::iter::once(&mut presentation.scene)
            .chain(presentation.saved.iter_mut())
            .enumerate()
        {
            let Some(retained) = material
                .get_mut("procedural")
                .filter(|value| value.is_object())
            else {
                continue;
            };
            retained["operations"] = json!([]);
            // These observations belong to the original receiving instances.
            retained.as_object_mut().unwrap().remove("checkpoint");
            retained["time_mappings"] = json!([]);
            for key in ["bindings", "controls"] {
                if let Some(rows) = retained[key].as_array_mut() {
                    for row in rows {
                        map_address(&mut row["address"]);
                        if key == "controls" {
                            if let Some(target) = row.get_mut("target") {
                                crate::expression_scene::remap_automation_target(target, &remap);
                            }
                            for lanes in ["dormant_lanes", "suspended_lanes"] {
                                if let Some(values) =
                                    row.get_mut(lanes).and_then(Value::as_array_mut)
                                {
                                    for value in values {
                                        crate::expression_scene::remap_automation_lane(
                                            value, &remap,
                                        );
                                    }
                                }
                            }
                            if let Some(tracks) = row["dormant_tracks"].as_array_mut() {
                                for track in tracks {
                                    if let Some(entity) = track.get_mut("entityId") {
                                        map_ref(entity);
                                    }
                                }
                            }
                            if let Some(groups) = row
                                .get_mut("dormant_overrides")
                                .and_then(Value::as_array_mut)
                            {
                                for group in groups {
                                    map_ref(&mut group["contribution_ref"]);
                                    for key in ["overrides", "takeover_overrides"] {
                                        if let Some(overrides) = group[key].as_array_mut() {
                                            for overlay in overrides {
                                                map_address(&mut overlay["address"]);
                                            }
                                        }
                                    }
                                }
                            }
                            // Persistent takeover is authored configuration,
                            // retaining its original actor/op/source lineage.
                            // Ephemeral gestures end below with their actual
                            // retained drivers/base/overrides, never a timer.
                        }
                    }
                }
            }
            if let Some(rows) = retained["procedures"].as_array_mut() {
                for row in rows {
                    map_ref(&mut row["procedure_ref"]);
                    for address in row["resolved_targets"].as_array_mut().unwrap() {
                        map_address(address);
                    }
                    row["cursor"] = json!(0);
                    row["state"] = json!("held");
                    row["membership_events"] = json!([]);
                }
            }
            if let Some(rows) = retained["contributions"].as_array_mut() {
                for row in rows {
                    for key in ["contribution_ref", "procedure_ref", "occurrence_ref"] {
                        map_ref(&mut row[key]);
                    }
                    for address in row["owned_addresses"].as_array_mut().unwrap() {
                        map_address(address);
                    }
                    for overlay in row["authored_overrides"].as_array_mut().unwrap() {
                        map_address(&mut overlay["address"]);
                    }
                    // The basis is material with the same known native Scene
                    // identity fields. Literal source definitions stay exact.
                    if row["generated_basis"]["schema"] == "ql.native-parameter-state/v1" {
                        map_address(&mut row["generated_basis"]["address"]);
                        if let Some(addresses) = row["generated_basis"]["addresses"].as_array_mut()
                        {
                            for address in addresses {
                                map_address(address);
                            }
                        }
                    } else if row["generated_basis"]["schema"] == "ql.native-atlas-state/v1" {
                        let basis = &mut row["generated_basis"];
                        map_ref(&mut basis["expression_ref"]);
                        for key in ["scene_ref", "entity_ref", "relation_ref"] {
                            if let Some(reference) = basis["focus"].get_mut(key) {
                                map_ref(reference);
                            }
                        }
                        if let Some(order) = basis["scene_order"].as_array_mut() {
                            for reference in order {
                                map_ref(reference);
                            }
                        }
                    }
                    if let Some(basis) = row["generated_basis"].as_object_mut() {
                        if let Some(scene) = basis.get_mut("scene") {
                            crate::expression_scene::remap_refs(scene, &remap);
                        }
                        if let Some(saved) = basis.get_mut("saved").filter(|v| !v.is_null()) {
                            crate::expression_scene::remap_refs(saved, &remap);
                        }
                    }
                }
            }
            if let Some(rows) = retained["scene_flow"].as_array_mut() {
                for row in rows {
                    map_ref(&mut row["from_scene_ref"]);
                    map_ref(&mut row["to_scene_ref"]);
                    row["cursor"] = json!(0);
                }
            }
            // Release changes only this cold configuration. No original
            // operation owner, cursor, body or Source admission is copied.
            let released = end_fork_gestures(material)?;
            if material_index == 0 {
                for (address, base, native_value) in released {
                    let key = fork_parameter_key(&address)?;
                    let entity = address
                        .entity_ref
                        .ok_or("Gesture parameter has no Entity")?;
                    let tuple = (entity, key.to_owned());
                    let basis = (base, native_value);
                    if parameter_bases.get(&tuple).is_some_and(|old| old != &basis) {
                        return Err(
                            "Shared gesture native driver bases disagree; reconcile before Fork"
                                .into(),
                        );
                    }
                    parameter_bases.insert(tuple, basis);
                }
            }
        }
    }
    for ((entity, key), (base, native_value)) in parameter_bases {
        let parameter = document
            .entities
            .get_mut(&entity)
            .and_then(|entity| entity.parameters.get_mut(&key))
            .ok_or("Gesture actual native Parameter disappeared")?;
        if parameter.value != native_value || parameter.automation.is_some() {
            return Err("Actual native gesture driver changed; reconcile before Fork".into());
        }
        super::parameter(&key, &base)?;
        *parameter = base;
    }
    Ok(())
}

/// Only the actual native request owner changes durable operation receipts.
/// Ordinary material edits may retain them but cannot forge/drop an ACK.
fn journal(document: &Document) -> Result<BTreeMap<String, Value>, String> {
    let mut rows = BTreeMap::new();
    for scene in &document.scenes {
        if let Some(operations) = scene
            .presentation
            .as_ref()
            .and_then(|p| p.scene["procedural"]["operations"].as_array())
        {
            for operation in operations {
                let id = operation["envelope"]["operation_ref"]
                    .as_str()
                    .ok_or("Missing operation identity")?;
                if rows.insert(id.to_owned(), operation.clone()).is_some() {
                    return Err("An operation journal identity occurs in multiple Scenes".into());
                }
            }
        }
    }
    Ok(rows)
}

pub fn guard_document_journal(before: &Document, after: &Document) -> Result<(), String> {
    if journal(before)? != journal(after)? {
        return Err("Operation journal is written by the procedural request owner; retain its exact receipts".into());
    }
    Ok(())
}

pub fn guard_journal_edit(before: &Document, changes: &[Change]) -> Result<(), String> {
    let mut candidate = before.clone();
    for change in changes {
        candidate.change(change.clone())?;
    }
    guard_document_journal(before, &candidate)
}

/// Undo restores authored material while retaining later original receipts.
/// This is called by the native Restore owner, never a caller-supplied flag.
pub fn retain_journal_on_restore(before: &Document, after: &mut Document) -> Result<(), String> {
    let authoritative = journal(before)?;
    if authoritative.is_empty() {
        return guard_document_journal(before, after);
    }
    for scene in &mut after.scenes {
        if let Some(rows) = scene.presentation.as_mut().and_then(|p| {
            p.scene
                .get_mut("procedural")
                .and_then(|retained| retained.get_mut("operations"))
                .and_then(Value::as_array_mut)
        }) {
            rows.clear();
        }
    }
    let scene = after
        .scenes
        .iter_mut()
        .find(|s| s.presentation.is_some())
        .ok_or("Restore needs an authored Scene to retain original operation receipts")?;
    let material = scene
        .presentation
        .as_mut()
        .unwrap()
        .scene
        .as_object_mut()
        .ok_or("Invalid restored Scene")?;
    let retention = material.entry("procedural").or_insert_with(empty_retention);
    retention["operations"] = Value::Array(authoritative.into_values().collect());
    validate_retention(retention)
}

fn inherit_material_receipts(
    document: &Document,
    changes: &[Change],
) -> Result<Vec<Change>, String> {
    let mut expanded = changes.to_vec();
    for change in &mut expanded {
        if let Change::SceneMaterialSet {
            scene_ref,
            presentation,
        } = change
        {
            let old = document
                .scenes
                .iter()
                .find(|s| &s.scene_ref == scene_ref)
                .and_then(|s| s.presentation.as_ref())
                .and_then(|p| p.scene.get("procedural"));
            if let Some(retained) = presentation.scene.get_mut("procedural") {
                let rows = retained["operations"]
                    .as_array()
                    .ok_or("Invalid native journal projection")?;
                if !rows.is_empty() {
                    return Err("Procedural material intent must project operations to []; the owner inherits original receipts".into());
                }
                retained["operations"] = old
                    .map(|v| v["operations"].clone())
                    .unwrap_or_else(|| json!([]));
            } else if let Some(retained) = old {
                presentation
                    .scene
                    .as_object_mut()
                    .ok_or("Invalid Scene material")?
                    .insert("procedural".into(), retained.clone());
            }
        }
    }
    Ok(expanded)
}

fn retain_operation_changes(
    document: &Document,
    mut changes: Vec<Change>,
    operation: &Operation,
) -> Result<Vec<Change>, String> {
    let retained = journal(document)?;
    let mut candidate = document.clone();
    for change in &changes {
        candidate.change(change.clone())?;
    }
    let existing = candidate.scenes.iter().find(|scene| {
        scene.presentation.as_ref().is_some_and(|p| {
            p.scene["procedural"]["operations"]
                .as_array()
                .is_some_and(|rows| {
                    rows.iter().any(|row| {
                        row["envelope"]["operation_ref"] == operation.envelope.operation_ref
                    })
                })
        })
    });
    let scene = existing
        .or_else(|| {
            candidate
                .scenes
                .iter()
                .find(|s| s.scene_ref == candidate.selection.scene_ref && s.presentation.is_some())
        })
        .or_else(|| candidate.scenes.iter().find(|s| s.presentation.is_some()))
        .ok_or("Keep an authored native Scene to retain original procedural receipts")?;
    let index = changes.iter().rposition(
        |c| matches!(c,Change::SceneMaterialSet{scene_ref,..}if scene_ref==&scene.scene_ref),
    );
    let mut presentation = match index {
        Some(i) => match &changes[i] {
            Change::SceneMaterialSet { presentation, .. } => presentation.clone(),
            _ => unreachable!(),
        },
        None => scene
            .presentation
            .clone()
            .ok_or("Journal Scene material disappeared")?,
    };
    let material = presentation
        .scene
        .as_object_mut()
        .ok_or("Invalid journal Scene material")?;
    let retention = material.entry("procedural").or_insert_with(empty_retention);
    validate_retention(retention)?;
    let rows = retention["operations"]
        .as_array_mut()
        .ok_or("Invalid operation journal")?;
    let present = journal(&candidate)?;
    for (id, value) in retained {
        if !present.contains_key(&id) && id != operation.envelope.operation_ref {
            if rows.len() >= MAX_OPERATIONS {
                return Err("Operation retention horizon full".into());
            }
            rows.push(value);
        }
    }
    let value = serde_json::to_value(operation).map_err(|e| e.to_string())?;
    if let Some(row) = rows
        .iter_mut()
        .find(|row| row["envelope"]["operation_ref"] == operation.envelope.operation_ref)
    {
        *row = value;
    } else {
        if rows.len() >= MAX_OPERATIONS {
            return Err("Operation retention horizon full".into());
        }
        rows.push(value);
    }
    validate_retention(retention)?;
    let change = Change::SceneMaterialSet {
        scene_ref: scene.scene_ref.clone(),
        presentation,
    };
    if let Some(index) = index {
        changes[index] = change;
    } else {
        changes.push(change);
    }
    Ok(changes)
}

fn retained_text<'a>(row: &'a Value, key: &str) -> Result<&'a str, String> {
    let text = row[key]
        .as_str()
        .ok_or_else(|| format!("Missing retained {key}"))?;
    super::text(text)?;
    Ok(text)
}
fn retained_rows<'a>(row: &'a Value, key: &str) -> Result<&'a [Value], String> {
    row[key]
        .as_array()
        .map(Vec::as_slice)
        .ok_or_else(|| format!("Missing retained {key} list"))
}
fn retained_address(raw: &Value) -> Result<Address, String> {
    let a: Address = serde_json::from_value(raw.clone()).map_err(|e| e.to_string())?;
    super::id(&a.expression_ref, "expression:")?;
    if let Some(r) = &a.scene_ref {
        super::id(r, &format!("{}:scene:", a.expression_ref))?;
    }
    if let Some(r) = &a.entity_ref {
        super::id(r, &format!("{}:entity:", a.expression_ref))?;
    }
    if a.component != Component::Layer && a.parent_ref.is_some() {
        return Err("Only a layer has a containing state coordinate".into());
    }
    if let Some(Some(parent)) = &a.parent_ref {
        super::text(parent)?;
    }
    if a.component == Component::Expression
        && (a.scene_ref.is_some() || a.entity_ref.is_some() || a.constituent_ref.is_some())
        || a.component != Component::Expression && a.scene_ref.is_none()
        || matches!(a.component, Component::Scene | Component::Field)
            && (a.entity_ref.is_some() || a.constituent_ref.is_some())
        || matches!(
            a.component,
            Component::Entity
                | Component::Force
                | Component::Sequence
                | Component::Layer
                | Component::SequenceLink
        ) && a.entity_ref.is_none()
        || matches!(
            a.component,
            Component::Layer | Component::SequenceLink | Component::Driver
        ) != a.constituent_ref.is_some()
    {
        return Err("Invalid retained address containment".into());
    }
    if let Some(property) = &a.property {
        for token in property.split('.') {
            if token.is_empty()
                || !token.as_bytes()[0].is_ascii_alphabetic() && token.as_bytes()[0] != b'_'
                || token
                    .bytes()
                    .any(|b| !b.is_ascii_alphanumeric() && b != b'_')
                || ["prototype", "__proto__", "constructor"].contains(&token)
            {
                return Err("Unstable/unsafe retained property path".into());
            }
        }
    }
    Ok(a)
}
fn validate_retained_rows(value: &Value) -> Result<(), String> {
    let sources = |raw: &Value| -> Result<(), String> {
        let refs: Vec<ReadingRef> =
            serde_json::from_value(raw.clone()).map_err(|e| e.to_string())?;
        super::readings(&refs)
    };
    let source = |raw: &Value| -> Result<(), String> {
        let r: ReadingRef = serde_json::from_value(raw.clone()).map_err(|e| e.to_string())?;
        super::readings(&[r])
    };
    sources(&value["source_basis"])?;
    for (key, id) in [
        ("procedures", "procedure_ref"),
        ("contributions", "contribution_ref"),
    ] {
        let mut seen = BTreeSet::new();
        for row in retained_rows(value, key)? {
            if !seen.insert(retained_text(row, id)?) {
                return Err(format!("Duplicate retained {id}"));
            }
        }
    }
    for binding in retained_rows(value, "bindings")? {
        retained_address(&binding["address"])?;
        source(&binding["locus"])?;
        for subject in
            std::iter::once(&binding["principal"]).chain(retained_rows(binding, "contributors")?)
        {
            retained_text(subject, "subject_ref")?;
            retained_text(subject, "native_owner")?;
            sources(&subject["sources"])?;
        }
        for tag in retained_rows(binding, "tags")? {
            retained_text(tag, "tag")?;
            if !matches!(
                tag["origin"].as_str(),
                Some("native" | "authored" | "generated")
            ) {
                return Err("Unqualified retained tag origin".into());
            }
        }
    }
    let mut controls = BTreeSet::new();
    for control in retained_rows(value, "controls")? {
        let a = retained_address(&control["address"])?;
        if !controls.insert(a) {
            return Err("Conflicting retained control".into());
        }
        retained_text(control, "target")?;
        retained_rows(control, "dormant_lanes")?;
        retained_rows(control, "dormant_tracks")?;
        sources(&control["source_basis"])?;
        if !control["takeover"].is_null() {
            let takeover = &control["takeover"];
            retained_text(takeover, "actor")?;
            retained_text(takeover, "operation_ref")?;
            if !matches!(
                takeover["lifetime"].as_str(),
                Some("gesture" | "persistent")
            ) {
                return Err("Invalid takeover lifetime".into());
            }
        }
    }
    for procedure in retained_rows(value, "procedures")? {
        if procedure.get("definition").is_none_or(Value::is_null) {
            return Err("Missing procedural definition".into());
        }
        retained_text(procedure, "revision")?;
        sources(&procedure["source_basis"])?;
        for key in ["algorithm", "version", "value"] {
            retained_text(&procedure["seed"], key)?;
        }
        if procedure["cursor"].as_u64().is_none()
            || !matches!(
                procedure["state"].as_str(),
                Some("running" | "held" | "interrupted" | "retired")
            )
        {
            return Err("Unreplayable procedure position".into());
        }
        for a in retained_rows(procedure, "resolved_targets")? {
            retained_address(a)?;
        }
        retained_rows(procedure, "membership_events")?;
    }
    for contribution in retained_rows(value, "contributions")? {
        if contribution
            .get("generated_basis")
            .is_none_or(Value::is_null)
        {
            return Err("Missing contribution generated basis".into());
        }
        for key in [
            "procedure_ref",
            "output_slot",
            "occurrence_ref",
            "recipe_revision",
        ] {
            retained_text(contribution, key)?;
        }
        if !matches!(
            contribution["status"].as_str(),
            Some("active" | "retired" | "detached")
        ) {
            return Err("Invalid generated contribution status".into());
        }
        retained_rows(contribution, "subject_refs")?;
        for a in retained_rows(contribution, "owned_addresses")? {
            retained_address(a)?;
        }
        for overlay in retained_rows(contribution, "authored_overrides")? {
            retained_address(&overlay["address"])?;
            retained_text(overlay, "actor")?;
        }
    }
    let mut operations = BTreeSet::new();
    for raw in retained_rows(value, "operations")? {
        let op: Operation = serde_json::from_value(raw.clone()).map_err(|e| e.to_string())?;
        super::text(&op.envelope.operation_ref)?;
        super::text(&op.envelope.actor)?;
        super::readings(&op.envelope.sources)?;
        if !operations.insert(op.envelope.operation_ref.clone())
            || op.fingerprint
                != format!(
                    "{:x}",
                    Sha256::digest(serde_json::to_vec(&op.envelope).map_err(|e| e.to_string())?)
                )
            || op.envelope.changes.is_empty()
            || op.envelope.changes.len() > super::LIMIT
            || op.targets.is_empty()
            || op.targets.len() > MAX_TARGETS
            || op
                .accepted_revision
                .is_none_or(|r| r <= op.envelope.expected_revision)
            || op.applied_revision.is_some_and(|r| {
                r <= op
                    .accepted_revision
                    .unwrap_or(op.envelope.expected_revision)
            })
        {
            return Err("Corrupt/duplicate/unreplayable operation journal".into());
        }
        for a in &op.targets {
            retained_address(&serde_json::to_value(a).map_err(|e| e.to_string())?)?;
        }
    }
    let mut mappings = BTreeSet::new();
    for mapping in retained_rows(value, "time_mappings")? {
        let owner = retained_text(mapping, "owner")?;
        let instance = retained_text(mapping, "instance_ref")?;
        let domain = retained_text(mapping, "domain")?;
        if !mappings.insert((owner, instance, domain))
            || mapping["cursor"]
                .as_f64()
                .is_none_or(|v| !v.is_finite() || v < 0.)
            || mapping["rate"]
                .as_f64()
                .is_none_or(|v| !v.is_finite() || v <= 0.)
            || mapping["origin"].as_f64().is_none_or(|v| !v.is_finite())
        {
            return Err("Invalid/duplicate native time mapping".into());
        }
    }
    for flow in retained_rows(value, "scene_flow")? {
        let from = retained_text(flow, "from_scene_ref")?;
        let to = retained_text(flow, "to_scene_ref")?;
        if from.split_once(":scene:").is_none()
            || from.split_once(":scene:").map(|(e, _)| e)
                != to.split_once(":scene:").map(|(e, _)| e)
            || !matches!(
                flow["policy"].as_str(),
                Some("continue" | "hold" | "checkpoint_release")
            )
            || flow["cursor"].as_u64().is_none()
        {
            return Err("Invalid same-world scene continuity policy/cursor".into());
        }
    }
    if !value["checkpoint"].is_null() {
        let c = &value["checkpoint"];
        for key in ["owner", "instance_ref", "revision", "state_ref"] {
            retained_text(c, key)?;
        }
        sources(&c["source_basis"])?;
        if c["cursor"].as_u64().is_none() {
            return Err("Invalid checkpoint cursor".into());
        }
    }
    Ok(())
}

impl Runtime {
    pub(super) fn release_expression(&mut self, expression_ref: &str) {
        self.scene_receivers.retire(expression_ref);
        let released: BTreeSet<_> = self
            .operations
            .iter()
            .filter(|(_, o)| o.envelope.expression_ref == expression_ref)
            .map(|(id, _)| id.clone())
            .collect();
        self.operations.retain(|id, _| !released.contains(id));
        self.restored.retain(|id| !released.contains(id));
        self.qualified_operations
            .retain(|id, _| !released.contains(id));
        self.qualified_definitions
            .retain(|id, _| !released.contains(id));
        self.material_fences.retain(|id, _| !released.contains(id));
        self.producers
            .retain(|_, p| p.expression_ref != expression_ref);
        self.deltas
            .retain(|row| row["delta"]["expression_ref"] != expression_ref);
        self.controls
            .retain(|_, control| control.expression_ref != expression_ref);
        self.bootstrap_replays
            .retain(|_, source| source.expression_ref != expression_ref);
        self.retired_through = Some(self.cursor);
    }

    pub fn output_readings(
        &self,
        document: &Document,
        procedure_ref: &str,
    ) -> Result<Vec<Value>, String> {
        super::text(procedure_ref)?;
        budget::preflight_source_outputs(document, procedure_ref, self)?;
        let retained_journal = budget::borrowed_journal(document)?;
        let mut out: Vec<Value> = Vec::new();
        for scene in &document.scenes {
            let Some(presentation) = &scene.presentation else {
                continue;
            };
            let retained = &presentation.scene["procedural"];
            let Some(procedures) = retained["procedures"].as_array() else {
                continue;
            };
            let Some(procedure) = procedures
                .iter()
                .find(|p| p["procedure_ref"] == procedure_ref)
            else {
                continue;
            };
            for contribution in retained_rows(retained, "contributions")? {
                if contribution["procedure_ref"] != procedure_ref
                    || contribution["status"] != "active"
                {
                    continue;
                }
                retained_text(contribution, "occurrence_ref")?;
                let current_basis = source_current_output_basis(document, contribution)?;
                let mut generated_basis = contribution["generated_basis"].clone();
                if let Some(scene) = generated_basis["scene"].as_object_mut() {
                    scene.remove("procedural");
                }
                let owned: Vec<Address> =
                    serde_json::from_value(contribution["owned_addresses"].clone())
                        .map_err(|e| e.to_string())?;
                for address in &owned {
                    addressed(document, address)?;
                }
                let creation = budget::first_valid_creation(
                    document,
                    procedure_ref,
                    contribution,
                    self,
                    &retained_journal,
                )?
                .ok_or("Retained output lacks its applied original native creation receipt")?;
                // Separate immutable creation provenance from the current
                // procedure's source basis. Only first_valid_creation above
                // qualifies this original typed journal operation.
                let origin_source_basis =
                    serde_json::to_value(budget::OriginSourceBasis(&creation.envelope.sources))
                        .map_err(|e| e.to_string())?;
                let creation = serde_json::to_value(creation).map_err(|e| e.to_string())?;
                let mut reading = contribution
                    .as_object()
                    .ok_or("Invalid contribution")?
                    .clone();
                reading.remove("authored_overrides");
                reading.insert(
                    "schema".into(),
                    json!("oi.expression-procedural-output-reading/v1"),
                );
                reading.insert("native_owner".into(), json!("oi.expression"));
                reading.insert("expression_ref".into(), json!(document.expression_ref));
                reading.insert("document_revision".into(), json!(document.revision));
                let sources: Vec<ReadingRef> =
                    serde_json::from_value(procedure["source_basis"].clone())
                        .map_err(|e| e.to_string())?;
                if sources
                    .iter()
                    .any(|source| source.availability != super::Availability::Available)
                {
                    return Err("Retained output source is not currently available".into());
                }
                reading.insert("source_basis".into(), Value::Array(sources.into_iter().map(|source|json!({"source_ref":source.r#ref,"revision":source.revision})).collect()));
                reading.insert("origin_source_basis".into(), origin_source_basis);
                reading.insert("generated_basis".into(), generated_basis);
                reading.insert("current_basis".into(), current_basis);
                reading.insert("applied_operation".into(), creation);
                let reading = Value::Object(reading);
                if let Some(previous) = out
                    .iter()
                    .find(|previous| previous["contribution_ref"] == reading["contribution_ref"])
                {
                    if *previous != reading {
                        return Err(
                            "Conflicting whole contribution projections across native Scenes"
                                .into(),
                        );
                    }
                } else {
                    out.push(reading);
                }
            }
        }
        if out.len() > MAX_TARGETS {
            return Err("Retained output reading cardinality exceeded".into());
        }
        Ok(out)
    }

    /// Save through the existing file owner serializes actual operation
    /// observations without turning high-rate runtime readings into edits.
    pub fn checkpoint_document(&self, document: &Document) -> Result<Document, String> {
        let mut out = document.clone();
        for scene in &mut out.scenes {
            if let Some(p) = &mut scene.presentation {
                if let Some(rows) = p
                    .scene
                    .get_mut("procedural")
                    .and_then(|retained| retained.get_mut("operations"))
                    .and_then(Value::as_array_mut)
                {
                    for row in rows {
                        if let Some(op) = row["envelope"]["operation_ref"]
                            .as_str()
                            .and_then(|id| self.operations.get(id))
                        {
                            if op.envelope.expression_ref != document.expression_ref {
                                return Err("Journal belongs to another Expression".into());
                            }
                            *row = serde_json::to_value(op).map_err(|e| e.to_string())?;
                        }
                    }
                }
            }
        }
        out.validate()?;
        Ok(out)
    }

    pub fn restore_document(&mut self, document: &Document) -> Result<(), String> {
        let _ = journal(document)?;
        let mut candidate = self.clone();
        for scene in &document.scenes {
            if let Some(rows) = scene
                .presentation
                .as_ref()
                .and_then(|p| p.scene["procedural"]["operations"].as_array())
            {
                for row in rows {
                    let mut op: Operation =
                        serde_json::from_value(row.clone()).map_err(|e| e.to_string())?;
                    let fingerprint = format!(
                        "{:x}",
                        Sha256::digest(
                            serde_json::to_vec(&op.envelope).map_err(|e| e.to_string())?
                        )
                    );
                    if fingerprint != op.fingerprint
                        || op.envelope.expression_ref != document.expression_ref
                    {
                        return Err("Corrupt/foreign retained operation payload".into());
                    }
                    if let Some(old) = candidate.operations.get(&op.envelope.operation_ref) {
                        if old.fingerprint != op.fingerprint {
                            return Err("Retained operation ID conflict".into());
                        }
                        continue;
                    }
                    if candidate.operations.len() >= MAX_OPERATIONS {
                        return Err("Restored operation horizon exceeded".into());
                    }
                    if matches!(
                        op.status,
                        Status::Prepared | Status::Scheduled | Status::Applying
                    ) {
                        op.status = Status::Interrupted;
                        op.failure=Some("Inspect native owners and current sources before admitting continuation".into());
                    }
                    candidate.restored.insert(op.envelope.operation_ref.clone());
                    candidate
                        .operations
                        .insert(op.envelope.operation_ref.clone(), op);
                }
            }
        }
        *self = candidate;
        Ok(())
    }
}

impl Runtime {
    fn emit(&mut self, delta: Value) -> Result<(), String> {
        self.cursor = self
            .cursor
            .checked_add(1)
            .ok_or("Observation cursor exhausted")?;
        self.deltas
            .push(json!({"cursor":self.cursor,"delta":delta}));
        if self.deltas.len() > MAX_DELTA_HISTORY {
            self.deltas.remove(0);
        }
        Ok(())
    }

    pub fn prepare(
        &mut self,
        document: &Document,
        envelope: Envelope,
    ) -> Result<Operation, String> {
        let op = self.check_preparation(document, envelope)?;
        if self.operations.contains_key(&op.envelope.operation_ref) {
            return Ok(op);
        }
        self.operations
            .insert(op.envelope.operation_ref.clone(), op.clone());
        if let Some(source) = op
            .envelope
            .producer_ref
            .as_ref()
            .and_then(|reference| self.producers.get(reference))
        {
            let procedure = retained_text(&source.prepared["original_procedure"], "procedure_ref")?;
            self.qualified_operations
                .insert(op.envelope.operation_ref.clone(), procedure.to_owned());
            self.qualified_definitions.insert(
                op.envelope.operation_ref.clone(),
                crate::native_expression::procedural::bootstrap::fingerprint(
                    &source.prepared["original_procedure"],
                )?,
            );
        }
        self.emit(json!({"expression_ref":op.envelope.expression_ref,"targets":op.targets,"operation_ref":op.envelope.operation_ref,"status":"prepared"}))?;
        Ok(op)
    }

    fn check_preparation(
        &self,
        document: &Document,
        envelope: Envelope,
    ) -> Result<Operation, String> {
        let fingerprint = format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&envelope).map_err(|e| e.to_string())?)
        );
        if let Some(existing) = self.operations.get(&envelope.operation_ref) {
            if existing.fingerprint != fingerprint {
                return Err("Operation ID payload conflict".into());
            }
            return Ok(existing.clone());
        }
        super::text(&envelope.operation_ref)?;
        super::text(&envelope.actor)?;
        super::readings(&envelope.sources)?;
        if envelope
            .sources
            .iter()
            .any(|r| r.availability != super::Availability::Available)
        {
            return Err("Prepared source is unavailable or stale".into());
        }
        if document.expression_ref != envelope.expression_ref
            || document.revision != envelope.expected_revision
        {
            return Err("revision_conflict".into());
        }
        if let Some(reference) = &envelope.producer_ref {
            let admitted = self
                .producers
                .get(reference)
                .ok_or("Procedure has no actual native producer admission")?;
            let prepared = &admitted.prepared;
            if !matches!(&envelope.timing, Timing::OwnerBoundary {owner,cursor,..} if prepared["timing"]["owner_ref"].as_str()==Some(owner.as_str()) && prepared["timing"]["requested_cursor"].as_u64()==Some(*cursor))
            {
                return Err("Source operation needs its original native timing owner and cursor; actual domain, epoch and mapping admission belongs to that owner".into());
            }
            if admitted.expression_ref != document.expression_ref
                || admitted.document_revision != document.revision
                || prepared["operation_ref"].as_str() != Some(envelope.operation_ref.as_str())
                || prepared["native_edit"]["actor"].as_str() != Some(envelope.actor.as_str())
                || admitted.changes != envelope.changes
                || prepared["output_readings"] != json!(envelope.output_readings)
                || admitted.targets
                    != if matches!(&envelope.scope, Scope::Addresses { addresses } if addresses.is_empty())
                        && admitted.targets.is_empty()
                    {
                        Vec::new()
                    } else {
                        resolve(document, &envelope.scope)?
                    }
            {
                return Err("Native producer admission differs from the original operation, current scope, source or material".into());
            }
            for source in [
                &prepared["original_procedure"]["recipe"],
                &prepared["original_procedure"]["profile"],
            ] {
                let source:ReadingRef=serde_json::from_value(json!({"ref":source["source_ref"],"revision":source["revision"],"availability":"available"})).map_err(|e|e.to_string())?;
                if !envelope.sources.contains(&source) {
                    return Err("Prepared native source basis was dropped or relabeled".into());
                }
            }
            let expected: BTreeSet<_> = prepared["required_consumers"]
                .as_array()
                .ok_or("Native preparation has no consumer contract")?
                .iter()
                .map(|v| v.as_str().ok_or("Invalid native consumer owner"))
                .collect::<Result<_, _>>()?;
            let actual: BTreeSet<_> = envelope
                .participants
                .iter()
                .map(|p| p.owner.as_str())
                .collect();
            if expected != actual {
                return Err("Required native producer consumers were dropped or replaced".into());
            }
        }
        if envelope.changes.is_empty() || envelope.changes.len() > super::LIMIT {
            return Err("Prepared batch is empty or exceeds the native edit budget".into());
        }
        if self.operations.len() >= MAX_OPERATIONS {
            return Err(
                "Operation retention full; archive through the native performance owner".into(),
            );
        }
        let producer = envelope
            .producer_ref
            .as_ref()
            .and_then(|reference| self.producers.get(reference));
        let mut targets = if matches!(&envelope.scope, Scope::Addresses { addresses } if addresses.is_empty())
            && producer.is_some_and(|p| p.targets.is_empty())
        {
            Vec::new()
        } else {
            resolve(document, &envelope.scope)?
        };
        if let Some(producer) = producer {
            targets.extend(producer.outputs.iter().cloned());
        }
        if envelope.output_readings.len() > MAX_TARGETS {
            return Err("Output reading budget exceeded".into());
        }
        let mut capability_ids = BTreeSet::new();
        for reading in &envelope.output_readings {
            let procedure_ref = retained_text(reading, "procedure_ref")?;
            let contribution_ref = retained_text(reading, "contribution_ref")?;
            if !capability_ids.insert(contribution_ref.to_owned()) {
                return Err("Duplicate owned output capability".into());
            }
            let actual = self.output_readings(document, procedure_ref)?;
            if !actual.iter().any(|r| r == reading) {
                return Err("Owned output capability is stale, foreign or differs from the actual native journal/material/source".into());
            }
            let owned: Vec<Address> = serde_json::from_value(reading["owned_addresses"].clone())
                .map_err(|e| e.to_string())?;
            for target in owned {
                targets.push(canonical_address(document, &target)?);
            }
        }
        targets.sort();
        targets.dedup();
        if targets.len() > MAX_TARGETS {
            return Err("Resolved owned scope exceeds native cardinality".into());
        }
        if targets.is_empty() {
            return Err("Scope deliberately resolves to no targets".into());
        }
        let expanded_changes = inherit_material_receipts(document, &envelope.changes)?;
        let producer = envelope
            .producer_ref
            .as_ref()
            .and_then(|reference| self.producers.get(reference));
        validate_write_set(document, &targets, &expanded_changes, producer)?;
        guard_journal_edit(document, &expanded_changes)?;
        let prepared_document = document.edited(expanded_changes)?;
        if envelope.participants.len() > 16 {
            return Err("Participant budget exceeded".into());
        }
        let mut owners = BTreeSet::new();
        for p in &envelope.participants {
            super::text(&p.owner)?;
            super::text(&p.instance_ref)?;
            if p.required_generation == 0
                || p.targets.is_empty()
                || p.targets.len() > MAX_TARGETS
                || !owners.insert((&p.owner, &p.instance_ref))
            {
                return Err("Invalid or duplicate required consumer".into());
            }
            for a in &p.targets {
                addressed(&prepared_document, a)?;
                if !targets
                    .iter()
                    .any(|target| covers(target, a) || covers(a, target))
                {
                    return Err("Consumer target is outside the resolved operation".into());
                }
            }
            if p.targets.iter().collect::<BTreeSet<_>>().len() != p.targets.len() {
                return Err("Duplicate required consumer targets".into());
            }
        }
        if let Timing::OwnerBoundary {
            owner,
            instance_ref,
            ..
        } = &envelope.timing
        {
            if !envelope
                .participants
                .iter()
                .any(|p| &p.owner == owner && &p.instance_ref == instance_ref)
            {
                return Err("Scheduled boundary has no required native timing owner".into());
            }
        }
        let op = Operation {
            fingerprint,
            envelope,
            targets,
            status: Status::Prepared,
            accepted_revision: None,
            applied_revision: None,
            observations: vec![],
            failure: None,
        };
        Ok(op)
    }

    pub fn inspect(&self, operation_ref: &str) -> Result<&Operation, String> {
        self.operations
            .get(operation_ref)
            .ok_or("Unknown operation ID".into())
    }

    pub fn cancel(&mut self, operation_ref: &str) -> Result<Operation, String> {
        let op = self
            .operations
            .get_mut(operation_ref)
            .ok_or("Unknown operation ID")?;
        if !matches!(op.status, Status::Prepared | Status::Cancelled) {
            return Err(
                "Applied interruption/reversal requires a new attributable operation".into(),
            );
        }
        op.status = Status::Cancelled;
        let out = op.clone();
        self.emit(json!({"expression_ref":out.envelope.expression_ref,"targets":out.targets,"operation_ref":operation_ref,"status":"cancelled"}))?;
        Ok(out)
    }

    /// Internal receiving seam. There is deliberately no caller-supplied ACK
    /// request: the native host/body/audio owners call this with their actual
    /// instance, target set, observed generation and owner cursor.
    pub fn observe_from_owner(
        &mut self,
        observation: ConsumerObservation,
    ) -> Result<Operation, String> {
        if self.restored.contains(&observation.operation_ref) {
            return Err("Restored receipt is historical; admit an explicit owner continuation before new observations".into());
        }
        crate::expression_scene::data(&observation.effective, 0)?;
        let op = self
            .operations
            .get_mut(&observation.operation_ref)
            .ok_or("Unknown observed operation")?;
        if !matches!(op.status, Status::Applying | Status::Applied) {
            return Err("Operation has not reached application".into());
        }
        let p = op
            .envelope
            .participants
            .iter()
            .find(|p| p.owner == observation.owner && p.instance_ref == observation.instance_ref)
            .ok_or("Wrong consumer owner/instance")?;
        if Some(observation.document_revision) != op.applied_revision
            || observation.generation < p.required_generation
            || p.targets.iter().cloned().collect::<BTreeSet<_>>()
                != observation.targets.iter().cloned().collect()
        {
            return Err("Consumer source/target/generation basis mismatch".into());
        }
        if let Timing::OwnerBoundary {
            owner,
            instance_ref,
            cursor,
        } = &op.envelope.timing
        {
            if *owner == observation.owner
                && *instance_ref == observation.instance_ref
                && observation.cursor < *cursor
            {
                return Err("Consumer applied before admitted boundary".into());
            }
        }
        if let Some(old) = op
            .observations
            .iter()
            .find(|o| o.owner == observation.owner && o.instance_ref == observation.instance_ref)
        {
            if observation.generation < old.generation || observation.cursor < old.cursor {
                return Err("Consumer observation regressed".into());
            }
        }
        op.observations
            .retain(|o| o.owner != observation.owner || o.instance_ref != observation.instance_ref);
        op.observations.push(observation);
        if op.envelope.participants.iter().all(|p| {
            op.observations
                .iter()
                .any(|o| o.owner == p.owner && o.instance_ref == p.instance_ref)
        }) {
            op.status = Status::Applied;
        }
        let out = op.clone();
        self.emit(json!({"expression_ref":out.envelope.expression_ref,"targets":out.targets,"operation_ref":out.envelope.operation_ref,"status":out.status,"observations":out.observations}))?;
        Ok(out)
    }
}

impl Application {
    /// A held conductor may install only the exact original definition and
    /// graph inputs from this owner's actual compiler completion. Public
    /// source tokens and reconstructed currentness labels do not grant it.
    pub(crate) fn qualify_procedural_definition(
        &self,
        before: &Document,
        producer_ref: &str,
        definition: &Value,
    ) -> Result<(), String> {
        let admitted = self
            .procedural_runtime
            .producers
            .get(producer_ref)
            .ok_or("The conductor needs its actual current native producer admission")?;
        if admitted.expression_ref != before.expression_ref
            || admitted.document_revision != before.revision
            || definition["expression_ref"] != before.expression_ref
            || definition["document_revision"].as_u64() != Some(before.revision)
            || definition["procedure"] != admitted.prepared["original_procedure"]
            || definition["program"]
                != admitted.prepared["original_procedure"]["recipe_parameters"]["native_program"]
        {
            return Err(
                "Conductor definition differs from the original current native compilation".into(),
            );
        }
        let original = &admitted.source["original_request"];
        let context = &original["native_context"];
        if !context.is_object()
            || ["source_composition", "currentness", "thread_plan"]
                .iter()
                .any(|key| definition[*key] != context[*key])
        {
            return Err(
                "Conductor graph/currentness/ThreadPlan differs from its actual native intake"
                    .into(),
            );
        }
        validate_source_payload(before, definition)?;
        Ok(())
    }

    /// The compiler intake carries an actual owner snapshot through its
    /// bounded outside-lock work. Completion must meet this exact snapshot.
    pub(crate) fn procedural_source_snapshot(
        &self,
        expression_ref: &str,
        revision: u64,
    ) -> Result<Document, String> {
        let document = self.document(expression_ref)?;
        if document.revision != revision {
            return Err("revision_conflict".into());
        }
        let mut snapshot_budget = budget::Budget::new();
        snapshot_budget.value(document)?;
        Ok(document.clone())
    }

    pub(crate) fn admit_procedural_source(
        &mut self,
        before: &Document,
        prepared: Value,
        source: Value,
    ) -> Result<Value, String> {
        if self.document(&before.expression_ref)? != before {
            return Err("The original native compiler basis changed; retain and requalify the source intent".into());
        }
        let mut snapshot_budget = budget::Budget::new();
        snapshot_budget.value(before)?;
        let current = self.document(&before.expression_ref)?.clone();
        let document = &current;
        let edit = &prepared["native_edit"];
        if prepared["schema"] != "ql.procedural-composition/v1"
            || !prepared["native_cprime"].is_object()
            || !prepared["original_procedure"].is_object()
            || edit["operation"] != "edit"
            || edit["expression_ref"].as_str() != Some(document.expression_ref.as_str())
            || edit["expected_revision"].as_u64() != Some(document.revision)
            || prepared["expected_document_revision"].as_u64() != Some(document.revision)
            || prepared["membership"]["containing_expression_ref"].as_str()
                != Some(document.expression_ref.as_str())
            || source["schema"] != "oi.native-expression-composed-source/v1"
            || !source["ql_executable"]
                .as_str()
                .is_some_and(|s| s.starts_with('/'))
            || !source["result_sha256"]
                .as_str()
                .is_some_and(|s| s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit()))
        {
            return Err("Actual source compilation has no fully qualified native preparation and current owner basis".into());
        }
        let lifecycle = lifecycle::validate_admission(document, &prepared, &source)?;
        let changes: Vec<Change> =
            serde_json::from_value(edit["changes"].clone()).map_err(|e| e.to_string())?;
        let mut targets = Vec::new();
        for raw in prepared["membership"]["addresses"]
            .as_object()
            .ok_or("Native membership has no address map")?
            .values()
        {
            let a: Address = serde_json::from_value(raw.clone()).map_err(|e| e.to_string())?;
            targets.push(canonical_address(document, &a)?);
        }
        targets.sort();
        targets.dedup();
        if targets.len() > MAX_TARGETS || changes.is_empty() || changes.len() > super::LIMIT {
            return Err("Native preparation exceeds its receiving budget".into());
        }
        let candidate = document.edited(inherit_material_receipts(document, &changes)?)?;
        let mut outputs = Vec::new();
        for contribution in prepared["contributions"]
            .as_array()
            .ok_or("Native preparation has no contribution list")?
        {
            for raw in contribution["owned_addresses"]
                .as_array()
                .ok_or("Native contribution has no exact owned addresses")?
            {
                let address: Address =
                    serde_json::from_value(raw.clone()).map_err(|e| e.to_string())?;
                let new_scene = address.scene_ref.as_ref().is_some_and(|reference| !document.scenes.iter().any(|s| &s.scene_ref == reference) && changes.iter().any(|change| matches!(change, Change::SceneCreate { scene_ref,.. } if scene_ref == reference)));
                let new_entity = address.entity_ref.as_ref().is_some_and(|reference| !document.entities.contains_key(reference) && changes.iter().any(|change| matches!(change, Change::EntityAdd { entity_ref,.. } if entity_ref == reference)));
                if new_scene || new_entity {
                    outputs.push(canonical_address(&candidate, &address)?);
                }
            }
        }
        outputs.sort();
        outputs.dedup();
        if outputs.len() > MAX_TARGETS {
            return Err("Native constructed output scope exceeds receiving cardinality".into());
        }
        let mut metadata = Vec::new();
        if let Some(raw) = prepared.get("metadata_scope") {
            let rows = raw
                .as_array()
                .ok_or("Native metadata scope must remain a typed address array")?;
            if rows.len() > MAX_TARGETS {
                return Err("Native metadata scope exceeds receiving cardinality".into());
            }
            let program = &prepared["original_procedure"]["recipe_parameters"]["native_program"];
            for raw in rows {
                let target: Address =
                    serde_json::from_value(raw.clone()).map_err(|e| e.to_string())?;
                if program["recipe"] != "scene_material"
                    || target.component != Component::Scene
                    || target.property.is_some()
                    || target.entity_ref.is_some()
                    || target.constituent_ref.is_some()
                    || target.parent_ref.is_some()
                    || target.expression_ref != document.expression_ref
                {
                    return Err(
                        "Metadata scope is not an exact original source Scene anchor".into(),
                    );
                }
                let scene = target
                    .scene_ref
                    .as_deref()
                    .ok_or("Source metadata anchor Scene missing")?;
                let sources = program["outputs"]
                    .as_array()
                    .ok_or("Original native constructor outputs missing")?
                    .iter()
                    .filter(|output| output["source"]["scene_ref"] == scene)
                    .filter(|output| {
                        !lifecycle
                            || prepared["contributions"].as_array().is_some_and(|rows| {
                                rows.iter().any(|row| {
                                    row["output_slot"] == output["output_slot"]
                                        && row["occurrence_ref"] == output["scene_ref"]
                                })
                            })
                    })
                    .collect::<Vec<_>>();
                if sources.is_empty() {
                    return Err("Metadata scope chose an unsealed source Scene".into());
                }
                for output in sources {
                    let source = &output["source"];
                    source_recheck_scene_source(document, source, true)?;
                    if !prepared["contributions"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .any(|contribution| {
                            contribution["output_slot"] == output["output_slot"]
                                && contribution["occurrence_ref"] == output["scene_ref"]
                        })
                    {
                        return Err(
                            "Source metadata anchor lacks its exact generated contribution".into(),
                        );
                    }
                }
                let canonical = canonical_address(document, &target)?;
                let sealed = changes
                    .iter()
                    .filter_map(|change| match change {
                        Change::SceneMaterialSet {
                            scene_ref,
                            presentation,
                        } if scene_ref == scene => Some(presentation),
                        _ => None,
                    })
                    .collect::<Vec<_>>();
                if sealed.len() != 1 {
                    return Err(
                        "Source metadata anchor has no unique sealed actual material change".into(),
                    );
                }
                let mut proposed = serde_json::to_value(sealed[0]).map_err(|e| e.to_string())?;
                proposed["scene"]
                    .as_object_mut()
                    .ok_or("Invalid source anchor material")?
                    .remove("procedural");
                let current = document
                    .scenes
                    .iter()
                    .find(|s| s.scene_ref == scene)
                    .and_then(|s| s.presentation.as_ref())
                    .ok_or("Actual source anchor material unavailable")?;
                let mut original = serde_json::to_value(current).map_err(|e| e.to_string())?;
                original["scene"]
                    .as_object_mut()
                    .ok_or("Invalid actual source anchor material")?
                    .remove("procedural");
                if proposed != original {
                    return Err("Source metadata scope altered authored source material".into());
                }
                metadata.push(canonical);
            }
            metadata.sort();
            metadata.dedup();
            if metadata.len() != rows.len() {
                return Err("Duplicate native metadata anchors".into());
            }
        }
        let bytes=serde_json::to_vec(&json!({"prepared":prepared,"source":source,"expression_ref":document.expression_ref,"document_revision":document.revision})).map_err(|e|e.to_string())?;
        let producer_ref = format!("procedure-source:{:x}", Sha256::digest(&bytes));
        if self
            .procedural_runtime
            .producers
            .contains_key(&producer_ref)
        {
            return serde_json::to_value(&self.procedural_runtime.producers[&producer_ref])
                .map_err(|e| e.to_string());
        }
        // An unused compilation from an older CAS cannot subsequently be
        // admitted. Active prepared/scheduled work keeps its original source.
        let held: BTreeSet<_> = self
            .procedural_runtime
            .operations
            .values()
            .filter(|operation| {
                matches!(
                    operation.status,
                    Status::Prepared | Status::Scheduled | Status::Applying
                )
            })
            .filter_map(|operation| operation.envelope.producer_ref.clone())
            .collect();
        self.procedural_runtime
            .producers
            .retain(|reference, admission| {
                admission.expression_ref != before.expression_ref
                    || admission.document_revision == before.revision
                    || held.contains(reference)
            });
        let retained = self
            .procedural_runtime
            .producers
            .values()
            .try_fold(0usize, |sum, p| {
                serde_json::to_vec(p)
                    .map(|bytes| sum.saturating_add(bytes.len()))
                    .map_err(|e| e.to_string())
            })?;
        if self.procedural_runtime.producers.len() >= 64
            || retained.saturating_add(bytes.len()) > 8 * 1024 * 1024
        {
            return Err("Native producer preparation horizon is full; settle and release its owned work before producing more".into());
        }
        let admitted = ProducerAdmission {
            producer_ref: producer_ref.clone(),
            expression_ref: document.expression_ref.clone(),
            document_revision: document.revision,
            prepared,
            source,
            lifecycle_position: None,
            changes,
            targets,
            outputs,
            metadata,
        };
        let receipt = serde_json::to_value(&admitted).map_err(|e| e.to_string())?;
        self.procedural_runtime
            .producers
            .insert(producer_ref, admitted);
        Ok(receipt)
    }

    /// Only the existing native Manager calls this before forwarding a
    /// conduct readback. Public JSON contributes identities, never receipts.
    pub fn procedural_material_readback(
        &mut self,
        expression_ref: &str,
        procedure_ref: &str,
        operation_ref: &str,
    ) -> Result<Value, String> {
        let document = self.document(expression_ref)?;
        let operation = self.procedural_runtime.inspect(operation_ref)?.clone();
        if self
            .procedural_runtime
            .qualified_operations
            .get(operation_ref)
            .map(String::as_str)
            != Some(procedure_ref)
            || self.procedural_runtime.restored.contains(operation_ref)
            || operation.status != Status::Applied
            || operation.envelope.expression_ref != expression_ref
            || !self
                .procedural_runtime
                .current_material(document, &operation)
            || operation.failure.is_some()
        {
            return Err(
                "Conduct material requires the current applied original native producer operation"
                    .into(),
            );
        }
        let retained = journal(document)?;
        let retained: Operation = serde_json::from_value(
            retained
                .get(operation_ref)
                .ok_or("Current Scene lost its original operation journal")?
                .clone(),
        )
        .map_err(|e| e.to_string())?;
        if retained != operation {
            return Err("Conduct material journal differs from the native original intent".into());
        }
        let receipt = json!({"procedure_ref":procedure_ref,"operation_ref":operation_ref,"document_revision":document.revision,"native_record":operation});
        if let Some(reference) = &operation.envelope.producer_ref {
            self.procedural_runtime.producers.remove(reference);
        }
        Ok(receipt)
    }
    /// Join the existing atomic edit owner with a protected journal write.
    /// The guard is reset on success *and* refusal; it is never an API flag.
    fn procedural_edit(
        &mut self,
        client: &CentralClient,
        expression_ref: String,
        expected_revision: u64,
        actor: String,
        changes: Vec<Change>,
    ) -> Result<(Value, Option<Changed>), String> {
        let journal_only = observation::journal_only(self.document(&expression_ref)?, &changes);
        self.procedural_runtime.owner_write = true;
        let result = self.apply(
            client,
            ExpressionRequest::Edit {
                expression_ref: expression_ref.clone(),
                expected_revision,
                actor,
                changes,
            },
        );
        self.procedural_runtime.owner_write = false;
        if journal_only {
            if let Ok((_, Some(changed))) = &result {
                self.procedural_runtime.advance_journal_fences(
                    &expression_ref,
                    expected_revision,
                    changed.revision,
                );
            }
        }
        result
    }

    /// Called only by the native timing receiver after its actual queue
    /// admission. Public commit cannot manufacture a scheduled receipt.
    pub fn procedural_schedule_from_owner(
        &mut self,
        client: &CentralClient,
        operation_ref: &str,
        owner: &str,
        instance_ref: &str,
        boundary: u64,
    ) -> Result<(Value, Option<Changed>), String> {
        let op = self.procedural_runtime.inspect(operation_ref)?.clone();
        match &op.envelope.timing {
            Timing::OwnerBoundary {
                owner: expected,
                instance_ref: instance,
                cursor,
            } if expected == owner && instance == instance_ref && *cursor == boundary => {}
            _ => {
                return Err(
                    "Timing admission belongs to another owner, instance or boundary".into(),
                );
            }
        }
        if op.status != Status::Prepared {
            return Err("Only an unchanged prepared operation may enter its timing owner".into());
        }
        let document = self.document(&op.envelope.expression_ref)?.clone();
        let expected = op
            .accepted_revision
            .unwrap_or(op.envelope.expected_revision);
        if let Some(conflict) = self.conflict(&op.envelope.expression_ref, expected)? {
            return Ok((conflict, None));
        }
        let mut scheduled = op.clone();
        scheduled.status = Status::Scheduled;
        scheduled.accepted_revision = Some(expected.checked_add(1).ok_or("Revision exhausted")?);
        let changes = retain_operation_changes(&document, vec![], &scheduled)?;
        let (receipt, changed) = self.procedural_edit(
            client,
            op.envelope.expression_ref.clone(),
            expected,
            op.envelope.actor.clone(),
            changes,
        )?;
        if receipt["state"] == "revision_conflict" {
            return Ok((receipt, None));
        }
        self.procedural_runtime
            .operations
            .insert(operation_ref.to_owned(), scheduled.clone());
        self.procedural_runtime.emit(json!({"expression_ref":scheduled.envelope.expression_ref,"targets":scheduled.targets,"operation_ref":operation_ref,"status":"scheduled"}))?;
        Ok((
            json!({"schema":SCHEMA,"operation":scheduled,"document_receipt":receipt}),
            changed,
        ))
    }

    /// The timing owner calls this after confirming actual queue withdrawal;
    /// caller cancellation alone cannot cancel already admitted native work.
    pub fn procedural_cancel_from_owner(
        &mut self,
        client: &CentralClient,
        operation_ref: &str,
        owner: &str,
        instance_ref: &str,
    ) -> Result<(Value, Option<Changed>), String> {
        let prior = self.procedural_runtime.clone();
        let op = self
            .procedural_runtime
            .operations
            .get_mut(operation_ref)
            .ok_or("Unknown scheduled operation")?;
        if op.status != Status::Scheduled
            || !matches!(&op.envelope.timing, Timing::OwnerBoundary {owner: expected,instance_ref: instance,..} if expected==owner && instance==instance_ref)
        {
            return Err("Withdrawal belongs to another operation or timing owner".into());
        }
        op.status = Status::Prepared;
        let result = self.procedural(
            client,
            Request::Cancel {
                operation_ref: operation_ref.into(),
            },
        );
        if result.is_err() {
            self.procedural_runtime = prior;
        }
        result
    }

    /// The native timing owner's non-real-time receiving queue calls this
    /// after its admitted boundary. This is never called from an audio/render
    /// callback, and an app caller cannot supply an arbitrary owner ACK.
    pub fn procedural_apply_from_owner(
        &mut self,
        client: &CentralClient,
        operation_ref: &str,
        owner: &str,
        instance_ref: &str,
        cursor: u64,
    ) -> Result<(Value, Option<Changed>), String> {
        let op = self.procedural_runtime.inspect(operation_ref)?.clone();
        match &op.envelope.timing {
            Timing::OwnerBoundary {
                owner: expected,
                instance_ref: instance,
                cursor: boundary,
            } if expected == owner && instance == instance_ref && cursor >= *boundary => {}
            _ => return Err("Wrong timing owner, instance or admitted boundary".into()),
        }
        if op.status != Status::Scheduled {
            return Err("Operation is not scheduled at this owner".into());
        }
        self.procedural_commit_document(client, op, Some((owner, instance_ref, cursor)))
    }

    fn procedural_commit_document(
        &mut self,
        client: &CentralClient,
        mut op: Operation,
        actual_boundary: Option<(&str, &str, u64)>,
    ) -> Result<(Value, Option<Changed>), String> {
        let current = self.document(&op.envelope.expression_ref)?.clone();
        let expected = op
            .accepted_revision
            .unwrap_or(op.envelope.expected_revision);
        if current.revision != expected {
            return Ok((
                self.conflict(&op.envelope.expression_ref, expected)?
                    .ok_or("Missing conflict receipt")?,
                None,
            ));
        }
        op.applied_revision = Some(expected.checked_add(1).ok_or("Revision exhausted")?);
        op.status = if op.envelope.participants.is_empty() {
            Status::Applied
        } else {
            Status::Applying
        };
        let expanded = inherit_material_receipts(&current, &op.envelope.changes)?;
        let changes = retain_operation_changes(&current, expanded, &op)?;
        let scene_ticket = if op.envelope.producer_ref.is_some() {
            let mut bounded = budget::Budget::new();
            for _ in 0..3 {
                bounded.value(&current)?;
            }
            for _ in 0..3 {
                bounded.value(&changes)?;
            }
            bounded.value(&op)?;
            let preview = current.edited_with_journal(changes.clone(), true)?;
            self.prepare_scene_edit_receipt(&current, &preview, &op, &changes, actual_boundary)?
        } else {
            None
        };
        let (document, changed) = self.procedural_edit(
            client,
            op.envelope.expression_ref.clone(),
            expected,
            op.envelope.actor.clone(),
            changes,
        )?;
        if document["state"] == "revision_conflict" {
            return Ok((document, None));
        }
        if document["document"]["revision"].as_u64() != op.applied_revision {
            return Err("Native document did not apply the exact retained batch".into());
        }
        self.procedural_runtime
            .operations
            .insert(op.envelope.operation_ref.clone(), op.clone());
        self.procedural_runtime.material_fences.insert(
            op.envelope.operation_ref.clone(),
            observation::MaterialFence {
                material_revision: op
                    .applied_revision
                    .ok_or("Actual material revision absent")?,
                journal_revision: op
                    .applied_revision
                    .ok_or("Actual material revision absent")?,
            },
        );
        let publication_error = self.procedural_runtime.emit(json!({"expression_ref":op.envelope.expression_ref,"targets":op.targets,"operation_ref":op.envelope.operation_ref,"status":op.status,"document_revision":op.applied_revision})).err();
        let Some(ticket) = scene_ticket else {
            return Ok((
                json!({"schema":SCHEMA,"state":if publication_error.is_some(){"reconciliation_required"}else{"document_applied"},"operation":op,"document_receipt":document,"publication_error":publication_error,"durability":"native_document_until_file_save"}),
                changed,
            ));
        };
        let observed = changed
            .as_ref()
            .ok_or_else(|| "Actual Source edit returned no native change".to_string())
            .and_then(|actual| self.finish_scene_edit_receipt(ticket, &document, actual));
        let observation = match observed {
            Ok(observation) => observation,
            Err(reason) => {
                return Ok((
                    json!({"schema":SCHEMA,"state":"reconciliation_required","operation":op,
                "document_receipt":document,"reason":reason,"native_scene_observation":null,"publication_error":publication_error}),
                    changed,
                ));
            }
        };
        match self.procedural_observe_from_owner(client, observation.clone()) {
            Ok((scene_receipt, journal_changed)) => Ok((
                json!({"schema":SCHEMA,"state":if publication_error.is_some(){"reconciliation_required"}else{"document_applied"},
                "operation":self.procedural_runtime.inspect(&op.envelope.operation_ref)?,
                "document_receipt":document,"native_scene_observation":observation,"scene_receiving_receipt":scene_receipt,
                "publication_error":publication_error,"durability":"native_document_until_file_save"}),
                journal_changed.or(changed),
            )),
            Err(reason) => Ok((
                json!({"schema":SCHEMA,"state":"reconciliation_required",
                "operation":self.procedural_runtime.inspect(&op.envelope.operation_ref)?,
                "document_receipt":document,"native_scene_observation":observation,"reason":reason,"publication_error":publication_error}),
                changed,
            )),
        }
    }

    pub fn procedural(
        &mut self,
        client: &CentralClient,
        request: Request,
    ) -> Result<(Value, Option<Changed>), String> {
        match request {
            Request::Lifecycle { .. } | Request::LifecycleCancel { .. } => Err("Lifecycle requires the existing native owner's private current Source/timing factory".into()),
            request @ Request::Control { .. } => {
                Ok((self.replay_procedural_control(&request)?, None))
            }
            Request::ReadDriver {
                expression_ref,
                expected_revision,
                address,
                parameter,
            } => {
                if let Some(conflict) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((conflict, None));
                }
                let document = self.document(&expression_ref)?;
                let target = canonical_address(document, &address)?;
                if target.expression_ref != expression_ref || target.property.is_none() {
                    return Err("Read the exact current native scalar driver address".into());
                }
                source_native_property(document, &target, &parameter)?;
                let driver = source_parameter_driver(
                    document,
                    target
                        .entity_ref
                        .as_deref()
                        .ok_or("Scalar driver has no actual occurrence")?,
                    &parameter,
                    None,
                )?;
                if !driver["addresses"]
                    .as_array()
                    .is_some_and(|rows| rows.contains(&json!(target)))
                {
                    return Err("Selected address does not denote this native scalar driver".into());
                }
                Ok((
                    json!({"schema":SCHEMA,"expression_ref":expression_ref,"document_revision":document.revision,"native_parameter_driver":driver}),
                    None,
                ))
            }
            Request::ReadSource {
                expression_ref,
                expected_revision,
                scope,
                property_keys,
                scene_profile,
            } => {
                if let Some(conflict) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((conflict, None));
                }
                let document = self.document(&expression_ref)?;
                let targets = resolve(document, &scope)?;
                let mut readings = Vec::new();
                let mut scenes = Vec::new();
                for target in targets {
                    let mut row = source_target_parts(document, &target, &property_keys)?;
                    row["occurrence_ref"] = json!(source_occurrence_ref(&target)?);
                    readings.push(row);
                    if target.component == Component::Scene {
                        if let Some(profile) = &scene_profile {
                            scenes.push(source_native_scene_source(
                                document,
                                target
                                    .scene_ref
                                    .as_deref()
                                    .ok_or("Source Scene has no native occurrence")?,
                                profile,
                            )?);
                        }
                    }
                }
                Ok((
                    json!({"schema":SCHEMA,"expression_ref":expression_ref,"document_revision":document.revision,"current_readings":readings,"scene_sources":scenes}),
                    None,
                ))
            }
            Request::ReadOutputs {
                expression_ref,
                expected_revision,
                procedure_ref,
            } => {
                if let Some(conflict) = self.conflict(&expression_ref, expected_revision)? {
                    return Ok((conflict, None));
                }
                let document = self.document(&expression_ref)?.clone();
                self.procedural_runtime.restore_document(&document)?;
                let readings = self
                    .procedural_runtime
                    .output_readings(&document, &procedure_ref)?;
                Ok((
                    json!({"schema":SCHEMA,"expression_ref":expression_ref,"document_revision":document.revision,"output_readings":readings}),
                    None,
                ))
            }

            Request::Read {
                expression_ref,
                scope,
                after_cursor,
            } => {
                let document = self.document(&expression_ref)?;
                let targets = resolve(document, &scope)?;
                let readings=targets.iter().map(|a| Ok(json!({"address":a,"authored":addressed(document,a)?,"document_revision":document.revision})))
                    .collect::<Result<Vec<_>,String>>()?;
                let runtime = &self.procedural_runtime;
                let resync = after_cursor.is_some_and(|c| {
                    c > runtime.cursor
                        || c < runtime.cursor.saturating_sub(MAX_DELTA_HISTORY as u64)
                        || runtime.retired_through.is_some_and(|retired| c <= retired)
                });
                let deltas = if resync {
                    vec![]
                } else {
                    runtime
                        .deltas
                        .iter()
                        .filter(|v| {
                            v["cursor"].as_u64().unwrap_or(0)
                                > after_cursor.unwrap_or(runtime.cursor)
                                && v["delta"]["expression_ref"] == expression_ref
                                && v["delta"]["targets"].as_array().is_some_and(|rows| {
                                    rows.iter().any(|row| {
                                        serde_json::from_value::<Address>(row.clone()).is_ok_and(
                                            |a| {
                                                targets
                                                    .iter()
                                                    .any(|t| covers(t, &a) || covers(&a, t))
                                            },
                                        )
                                    })
                                })
                        })
                        .cloned()
                        .collect()
                };
                let observations: Vec<_> = runtime
                    .operations
                    .values()
                    .filter(|op| {
                        op.envelope.expression_ref == expression_ref
                            && runtime.current_material(document, op)
                    })
                    .flat_map(|op| op.observations.iter())
                    .filter(|o| {
                        o.targets
                                .iter()
                                .any(|a| targets.iter().any(|t| covers(t, a) || covers(a, t)))
                    })
                    .collect();
                Ok((
                    json!({"schema":SCHEMA,"expression_ref":expression_ref,"document_revision":document.revision,"cursor":runtime.cursor,
                    "resynchronised":resync,"snapshot":readings,"deltas":deltas,"effective_observations":observations,
                    "operation_history":runtime.operations.values().filter(|op|op.envelope.expression_ref==expression_ref&&op.targets.iter().any(|a|targets.iter().any(|t|covers(t,a)||covers(a,t)))).map(|op|json!({"operation":op,"restored":runtime.restored.contains(&op.envelope.operation_ref)})).collect::<Vec<_>>(),
                    "effective_availability":if observations.is_empty(){"unobserved"}else{"observed_at_current_document_basis"}}),
                    None,
                ))
            }
            Request::Prepare { envelope } => {
                let document = self.document(&envelope.expression_ref)?.clone();
                self.procedural_runtime.restore_document(&document)?;
                let prior = self.procedural_runtime.clone();
                let mut op = self.procedural_runtime.prepare(&document, *envelope)?;
                if op.accepted_revision.is_some() {
                    return Ok((
                        json!({"schema":SCHEMA,"operation":op,"repeated":true,"restored":self.procedural_runtime.restored.contains(&op.envelope.operation_ref)}),
                        None,
                    ));
                }
                op.accepted_revision = Some(
                    document
                        .revision
                        .checked_add(1)
                        .ok_or("Revision exhausted")?,
                );
                let result: Result<(Value, Option<Changed>), String> = (|| {
                    let changes = retain_operation_changes(&document, vec![], &op)?;
                    let (receipt, changed) = self.procedural_edit(
                        client,
                        op.envelope.expression_ref.clone(),
                        document.revision,
                        op.envelope.actor.clone(),
                        changes,
                    )?;
                    if receipt["state"] == "revision_conflict" {
                        return Ok((receipt, None));
                    }
                    self.procedural_runtime
                        .operations
                        .insert(op.envelope.operation_ref.clone(), op.clone());
                    Ok((
                        json!({"schema":SCHEMA,"operation":op,"document_receipt":receipt,"durability":"native_document_until_file_save"}),
                        changed,
                    ))
                })();
                if result.as_ref().is_err()
                    || result
                        .as_ref()
                        .is_ok_and(|(r, _)| r["state"] == "revision_conflict")
                {
                    self.procedural_runtime = prior;
                }
                result
            }
            Request::InspectOperation { operation_ref } => Ok((
                if let Some(operation) = self.procedural_runtime.operations.get(&operation_ref) {
                    json!({"schema":SCHEMA,"operation":operation})
                } else {
                    json!({"schema":SCHEMA,"state":"absent","operation_ref":operation_ref})
                },
                None,
            )),
            Request::Cancel { operation_ref } => {
                let prior = self.procedural_runtime.clone();
                let op = self.procedural_runtime.cancel(&operation_ref)?;
                let document = self.document(&op.envelope.expression_ref)?.clone();
                let result: Result<(Value, Option<Changed>), String> = (|| {
                    let changes = retain_operation_changes(&document, vec![], &op)?;
                    let (receipt, changed) = self.procedural_edit(
                        client,
                        op.envelope.expression_ref.clone(),
                        document.revision,
                        op.envelope.actor.clone(),
                        changes,
                    )?;
                    Ok((
                        json!({"schema":SCHEMA,"operation":op,"document_receipt":receipt}),
                        changed,
                    ))
                })();
                if result.is_err() {
                    self.procedural_runtime = prior;
                }
                result
            }
            Request::Commit { operation_ref } => {
                let op = self.procedural_runtime.inspect(&operation_ref)?.clone();
                if matches!(
                    op.status,
                    Status::Scheduled
                        | Status::Applying
                        | Status::Applied
                        | Status::Cancelled
                        | Status::Interrupted
                        | Status::Failed
                ) {
                    return Ok((
                        json!({"schema":SCHEMA,"operation":op,"repeated":true}),
                        None,
                    ));
                }
                if matches!(op.envelope.timing, Timing::OwnerBoundary { .. }) {
                    return Err(
                        "Native timing admission is required before an operation can be scheduled"
                            .into(),
                    );
                }
                self.procedural_commit_document(client, op, None)
            }
        }
    }
}

#[cfg(test)]
#[path = "expression_procedural_tests.rs"]
mod independent_tests;
