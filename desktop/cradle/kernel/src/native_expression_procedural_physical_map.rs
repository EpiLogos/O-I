//! Same-current-Document physical constituents from the actual registered
//! bootstrap completion. The map cannot be imported or deserialized. Its
//! reading is data; application acknowledgements remain at their native owners.
use crate::expression::{Document, ReadingRef};
use serde::{ser::SerializeSeq, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;

#[derive(Debug)]
pub(super) struct QualifiedPhysicalSourceMap {
    document_fingerprint: String,
    scene_ref: String,
    source_reading: ReadingRef,
    original_correspondence_fingerprint: String,
    projection: Value,
}

fn decimal(value: &Value) -> Result<u64, String> {
    let text = value.as_str().ok_or("Canonical native decimal absent")?;
    let number = text.parse::<u64>().map_err(|error| error.to_string())?;
    if number.to_string() != text {
        return Err("Noncanonical native decimal".into());
    }
    Ok(number)
}

fn metric(left: &Value, right: &Value) -> bool {
    match (left.as_array(), right.as_array()) {
        (Some(left), Some(right)) if left.len() == 3 && right.len() == 3 => left
            .iter()
            .zip(right)
            .all(|(left, right)| match (left.as_f64(), right.as_f64()) {
                (Some(left), Some(right)) => {
                    left.is_finite() && right.is_finite() && left.to_bits() == right.to_bits()
                }
                _ => false,
            }),
        _ => false,
    }
}

#[derive(Serialize)]
struct BorrowedPhysicalAddress<'a> {
    expression_ref: &'a str,
    scene_ref: &'a str,
    entity_ref: Option<&'a str>,
    component: &'static str,
    constituent_ref: &'a Value,
    property: Option<&'a str>,
}

#[derive(Serialize)]
struct BorrowedNodeLocation<'a> {
    address: BorrowedPhysicalAddress<'a>,
    source_constituent_ref: &'a Value,
    rest_metres: &'a Value,
    visible_metres: &'a Value,
    fixed: &'a Value,
}

struct BorrowedLocations<'a> {
    expression_ref: &'a str,
    scene_ref: &'a str,
    nodes: &'a [Value],
}

impl Serialize for BorrowedLocations<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut sequence = serializer.serialize_seq(Some(self.nodes.len()))?;
        for node in self.nodes {
            sequence.serialize_element(&BorrowedNodeLocation {
                address: BorrowedPhysicalAddress {
                    expression_ref: self.expression_ref,
                    scene_ref: self.scene_ref,
                    entity_ref: None,
                    component: "physical_node",
                    constituent_ref: &node["native_node_id"],
                    property: None,
                },
                source_constituent_ref: &node["source_constituent_ref"],
                rest_metres: &node["rest_metres"],
                visible_metres: &node["visible_metres"],
                fixed: &node["fixed"],
            })?;
        }
        sequence.end()
    }
}

#[derive(Serialize)]
struct BorrowedProjection<'a> {
    schema: &'static str,
    expression_ref: &'a str,
    document_revision: u64,
    scene_ref: &'a str,
    scene_revision: u64,
    source_reading: &'a ReadingRef,
    basis_digest: &'a str,
    source: &'a Value,
    sample: &'a Value,
    transport_epoch: &'a Value,
    body_revision: &'a Value,
    m3_source_generation: &'a Value,
    native_timing_owner: &'a Value,
    required_consumers: &'a Value,
    nodes: BorrowedLocations<'a>,
    effective_state_qualification: &'static str,
    standing: &'static str,
}

impl QualifiedPhysicalSourceMap {
    /// Called by RegisteredConsumers only after the actual opaque Source
    /// completion, original constructor, roster and SAME Document are checked.
    /// Full current bundle selects the asset; musical basis alone cannot select
    /// a current M4 epoch. Nothing here issues or replays a native operation.
    pub(super) fn from_registered_bootstrap(
        before: &Document,
        scene_ref: &str,
        source: &Value,
        provenance: &Value,
        reply: &Value,
    ) -> Result<Self, String> {
        let observation = &source["performance_source_observation"];
        let correspondence = &source["native_resident_source_correspondence"];
        let pulse = &reply["native_timing_pulse"];
        let bundle = &observation["performance_sources"];
        // Count the complete borrowed payload before any retained copies.
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            observation,
            correspondence,
        ))?;
        if observation["schema"] != "ql.native-held-performance-source/v1"
            || !bundle.is_object()
            || correspondence["schema"] != "ql.native-resident-source-correspondence/v1"
            || correspondence["document_address_correspondence"]
                != "requires-private-current-document-source-recipe-CAS"
            || observation["native_reading"] != pulse["reading"]
            || correspondence["physical_preparation"] != observation["physical_preparation"]
            || correspondence["source_form_recipe"] != bundle["source_form_recipe"]
            || correspondence["sample"] != pulse["resident_consumers"]["sample"]
            || correspondence["transport_epoch"] != pulse["resident_consumers"]["transport_epoch"]
            || correspondence["native_timing_owner"] != pulse["native_timing_owner"]
        {
            return Err(
                "Physical map lacks the complete same-operation Source77/body epoch".into(),
            );
        }
        let scene = before
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == scene_ref)
            .ok_or("Current physical Scene absent")?;
        let performance = scene
            .performance
            .as_ref()
            .ok_or("Current Scene has no retained native performance")?;
        performance.validate()?;
        let mut matching = performance
            .native_sources
            .iter()
            .filter(|asset| asset.native_bundle() == bundle);
        let asset = matching
            .next()
            .ok_or("Actual current complete native source is not saved in this Scene")?;
        if matching.next().is_some() {
            return Err("Current full source epoch is ambiguous in the saved Scene".into());
        }
        let mut bases = performance
            .bases
            .iter()
            .filter(|basis| basis.content_digest == asset.basis_digest());
        let basis = bases
            .next()
            .ok_or("Exact saved native source basis absent")?;
        if bases.next().is_some() {
            return Err("Exact saved native source basis is ambiguous".into());
        }
        asset.validate_basis(basis)?;
        asset.require_source_context(basis)?;
        // Original applications are separate from a same-basis musical page.
        // The original getter always returns both complete arrays, including
        // genuinely empty histories. Absence of an original row is not filled.
        for (name, saved) in [
            (
                "native_physical_source_history",
                asset.native_physical_source_history(),
            ),
            (
                "native_acoustic_source_history",
                asset.native_acoustic_source_history(),
            ),
        ] {
            let actual = observation[name]
                .as_array()
                .ok_or("Same-operation complete original source applications absent")?;
            if actual.as_slice() != saved.unwrap_or(&[]) {
                return Err(
                    "Physical map lost or replaced an original native source application".into(),
                );
            }
        }
        let body = &basis.prepared_body;
        if correspondence["source"] != basis.audio_determination["identity"]
            || correspondence["physical_preparation"] != *body
            || decimal(&correspondence["body_revision"])?
                != body["request"]["body_revision"]
                    .as_u64()
                    .ok_or("Saved body revision absent")?
            || decimal(&correspondence["m3_source_generation"])? != basis.identity.m3_generation.0
            || body["event_ref"] != basis.identity.event_ref
            || body["subject_ref"] != basis.identity.subject_ref
            || body["source_generation"].as_u64() != Some(basis.identity.m3_generation.0)
        {
            return Err(
                "Physical map differs from the full saved identity/context/prepared body".into(),
            );
        }
        let nodes = correspondence["nodes"]
            .as_array()
            .ok_or("Actual physical nodes absent")?;
        let prepared = body["request"]["geometry"]["nodes"]
            .as_array()
            .ok_or("Full saved prepared geometry absent")?;
        if !(2..=32).contains(&nodes.len()) || prepared.len() != nodes.len() {
            return Err("Actual physical descendant count is absent or excessive".into());
        }
        let mut ids = BTreeSet::new();
        // Validate every borrowed descendant before allocating its addresses.
        for (node, original) in nodes.iter().zip(prepared) {
            let id = decimal(&node["native_node_id"])?;
            let constituent = node["source_constituent_ref"]
                .as_str()
                .ok_or("Original native source constituent absent")?;
            crate::expression::text(constituent)?;
            if id == 0
                || !ids.insert(id)
                || original["identity"].as_u64() != Some(id)
                || original["constituent"] != constituent
                || !metric(&node["rest_metres"], &original["rest_metres"])
                || !metric(&node["visible_metres"], &node["visible_metres"])
                || node["fixed"] != original["fixed"]
                || node["fixed"].as_array().is_none_or(|axes| {
                    axes.len() != 3 || axes.iter().any(|axis| !axis.is_boolean())
                })
            {
                return Err(
                    "Physical map replaced, reordered or aliased a native descendant".into(),
                );
            }
        }
        let source_reading = asset.reading()?;
        let borrowed = BorrowedProjection {
            schema: "oi.native-current-physical-source-map/v1",
            expression_ref: &before.expression_ref,
            document_revision: before.revision,
            scene_ref,
            scene_revision: scene.revision,
            source_reading: &source_reading,
            basis_digest: asset.basis_digest(),
            source: &correspondence["source"],
            sample: &correspondence["sample"],
            transport_epoch: &correspondence["transport_epoch"],
            body_revision: &correspondence["body_revision"],
            m3_source_generation: &correspondence["m3_source_generation"],
            native_timing_owner: &correspondence["native_timing_owner"],
            required_consumers: &correspondence["required_consumers"],
            nodes: BorrowedLocations { expression_ref: &before.expression_ref, scene_ref, nodes },
            effective_state_qualification: "observed_at_original_native_source_pulse",
            standing: "same private current Scene/Source reading; no Entity alias, native admission or application ACK",
        };
        // Charge the exact retained four-part context AND the complete map
        // together before serializing/copying any locations or address strings.
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            &source["consumer_contract"],
            source,
            provenance,
            reply,
            &borrowed,
        ))?;
        let projection = serde_json::to_value(&borrowed).map_err(|error| error.to_string())?;
        Ok(Self {
            document_fingerprint: super::super::bootstrap::fingerprint(before)?,
            scene_ref: scene_ref.to_owned(),
            source_reading,
            original_correspondence_fingerprint: super::super::bootstrap::fingerprint(
                correspondence,
            )?,
            projection,
        })
    }

    pub(super) fn read(
        &self,
        before: &Document,
        scene_ref: &str,
        reply: &Value,
    ) -> Result<Value, String> {
        if self.scene_ref != scene_ref
            || self.document_fingerprint != super::super::bootstrap::fingerprint(before)?
            || self.original_correspondence_fingerprint
                != super::super::bootstrap::fingerprint(
                    &reply["procedural"]["native_resident_source_correspondence"],
                )?
        {
            return Err(
                "Physical source map has another actual Document/Scene/source boundary".into(),
            );
        }
        let scene = before
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == scene_ref)
            .ok_or("Current physical Scene absent")?;
        let performance = scene
            .performance
            .as_ref()
            .ok_or("Current physical performance absent")?;
        let observation = &reply["procedural"]["performance_source_observation"];
        let mut matched = performance
            .native_sources
            .iter()
            .filter(|asset| asset.native_bundle() == &observation["performance_sources"]);
        let asset = matched
            .next()
            .ok_or("Current full source epoch no longer retained")?;
        if matched.next().is_some() || asset.reading()? != self.source_reading {
            return Err("Current full source epoch or complete original sidecars changed".into());
        }
        crate::expression::procedural::bootstrap::preflight_source_message(&self.projection)?;
        Ok(self.projection.clone())
    }
}

impl crate::Kernel {
    /// Human and Agent inspection use this existing native Kernel route.
    /// This pure read issues no FIELD request, native ordinal or consumer ACK.
    pub(crate) fn native_procedural_physical_source_read(
        &mut self,
        request: crate::native_expression::procedural::stage_library::CapabilityRequest,
    ) -> Result<Value, String> {
        let result = (|| {
            let before = self.expressions.procedural_source_snapshot(
                &request.basis.expression_ref,
                request.basis.document_revision,
            )?;
            self.native_expression.registered_physical_source_read(
                &self.expressions,
                &before,
                &request.basis.scene_ref,
            )
        })();
        let reading = match result {
            Ok(value) => json!({"state":"available","value":value}),
            Err(reason) => json!({"state":"unavailable","reason":reason}),
        };
        Ok(json!({"schema":"oi.native-physical-source-inspection/v1",
            "basis":request.basis,"reading":reading,"native_procedural_receipts":[]}))
    }
}
