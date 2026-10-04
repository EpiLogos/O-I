//! Lossless native Contact evidence. These deserializers do not prepare a
//! collision, mint a Scene lifetime, admit a queue handle or restore a body.
//! The existing closed native source owner performs those operations.
use crate::expression_performance::{Counter, PerformanceBasis};
use crate::expression_performance_management::NativeIdentity;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde_json::Value;
use std::collections::BTreeSet;

/// Exactly the finite native IEEE operand, including the sign of zero.
/// Ordinary authored Performance Scalar canonicalization remains unchanged.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct NativeContactScalar(u64);
impl NativeContactScalar {
    pub fn value(self) -> f64 {
        f64::from_bits(self.0)
    }
}
impl Serialize for NativeContactScalar {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_f64(self.value())
    }
}
impl<'de> Deserialize<'de> for NativeContactScalar {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = f64::deserialize(deserializer)?;
        if !value.is_finite() {
            return Err(serde::de::Error::custom(
                "finite native contact operand required",
            ));
        }
        Ok(Self(value.to_bits()))
    }
}
fn reference(value: &str, bound: usize) -> Result<(), String> {
    if value.is_empty() || value.len() >= bound || value.chars().any(char::is_control) {
        return Err("original bounded native contact reference required".into());
    }
    Ok(())
}
fn range(value: NativeContactScalar, low: f64, high: f64) -> Result<(), String> {
    if value.value() < low || value.value() > high {
        return Err("native contact magnitude outside owner bounds".into());
    }
    Ok(())
}
fn unit(normal: &[NativeContactScalar; 3]) -> Result<(), String> {
    if normal.iter().any(|x| x.value().abs() > 1.0)
        || (normal.iter().map(|x| x.value().powi(2)).sum::<f64>() - 1.0).abs() > 1e-10
    {
        return Err("native contact normal differs".into());
    }
    Ok(())
}
fn counter(value: &Value) -> Result<Counter, String> {
    serde_json::from_value(value.clone()).map_err(|e| e.to_string())
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeContactHandle {
    pub generation: Counter,
    pub slot: Counter,
}
impl NativeContactHandle {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.generation.0 == 0 || self.slot.0 >= 16 {
            return Err("native contact slot/generation differs".into());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeContactOccurrence {
    pub constructor_lineage: String,
    pub original_request_id: Counter,
}
impl NativeContactOccurrence {
    fn validate(&self) -> Result<(), String> {
        reference(&self.constructor_lineage, 256)?;
        if self.original_request_id.0 == 0 {
            return Err("original native contact occurrence unavailable".into());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeContactOperands {
    pub contact_ref: String,
    pub particle_ref: String,
    pub collider_ref: String,
    pub route_ref: String,
    pub source_ref: String,
    pub policy_ref: String,
    pub policy_revision: String,
    pub standing: String,
    pub seed_standing: String,
    pub preparation_ref: String,
    pub state_ref: String,
    pub eigenbasis: String,
    pub source_coordinate: String,
    pub source_revision: String,
    pub plane_position_metres: [NativeContactScalar; 3],
    pub normal: [NativeContactScalar; 3],
    pub impact_velocity_metres_per_second: [NativeContactScalar; 3],
    pub height_metres: NativeContactScalar,
    pub initial_normal_velocity_metres_per_second: NativeContactScalar,
    pub gravity_metres_per_second_squared: NativeContactScalar,
    pub mass_kg: NativeContactScalar,
    pub restitution: NativeContactScalar,
    pub transfer_fraction: NativeContactScalar,
    pub minimum_impact_speed_metres_per_second: NativeContactScalar,
    pub impact_seconds: NativeContactScalar,
    pub impact_speed_metres_per_second: NativeContactScalar,
    pub planned_impulse_newton_seconds: NativeContactScalar,
    pub force_newtons: NativeContactScalar,
    pub trigger_sample: Counter,
    pub impact_sample: Counter,
    pub body_revision: Counter,
    pub source_generation: Counter,
    pub seed: Counter,
    pub sample_rate: Counter,
    pub duration_samples: Counter,
    pub pratibimba: bool,
}
impl NativeContactOperands {
    pub fn validate(&self) -> Result<(), String> {
        for value in [
            &self.contact_ref,
            &self.particle_ref,
            &self.collider_ref,
            &self.route_ref,
            &self.source_ref,
            &self.policy_ref,
            &self.policy_revision,
            &self.standing,
            &self.seed_standing,
            &self.preparation_ref,
            &self.state_ref,
            &self.eigenbasis,
            &self.source_coordinate,
            &self.source_revision,
        ] {
            reference(value, 192)?;
        }
        if !matches!(
            self.standing.as_str(),
            "architecture-model" | "reference" | "tunable-model"
        ) || self.duration_samples.0 == 0
            || self.duration_samples.0 > 512
            || self.sample_rate.0 < 8000
            || self.sample_rate.0 > 192000
            || !self.pratibimba
            || self.impact_sample < self.trigger_sample
        {
            return Err("native contact model/body/date differs".into());
        }
        unit(&self.normal)?;
        range(self.height_metres, 0.0, 100.0)?;
        range(self.initial_normal_velocity_metres_per_second, -1e4, 1e4)?;
        range(self.gravity_metres_per_second_squared, 1e-6, 1e4)?;
        range(self.mass_kg, 1e-12, 1e3)?;
        range(self.restitution, 0.0, 1.0)?;
        range(self.transfer_fraction, 0.0, 1.0)?;
        range(self.minimum_impact_speed_metres_per_second, 0.0, 1e4)?;
        range(self.impact_seconds, 0.0, f64::MAX)?;
        range(self.impact_speed_metres_per_second, 0.0, f64::MAX)?;
        Ok(())
    }
    pub fn validate_basis(&self, basis: &PerformanceBasis) -> Result<(), String> {
        self.validate()?;
        let body = &basis.prepared_body["request"];
        if self.body_revision != counter(&basis.audio_determination["body_revision"])?
            || self.source_generation != basis.identity.m3_generation
            || body["preparation_ref"] != self.preparation_ref
            || body["state_ref"] != self.state_ref
            || basis.prepared_body["source_coordinate"]["source_ref"] != self.source_coordinate
            || basis.prepared_body["source_revision"] != self.source_revision
            || body["sample_rate"].as_u64() != Some(self.sample_rate.0)
            || body["geometry"]["provenance"]["source_ref"] != self.source_ref
            || self.route_ref != self.preparation_ref
        {
            return Err("contact lost original prepared source/body/route".into());
        }
        let force = body["max_force_newtons"]
            .as_f64()
            .ok_or("contact native force bound absent")?;
        let impulse = body["max_impulse_newton_seconds"]
            .as_f64()
            .ok_or("contact native impulse bound absent")?;
        if !force.is_finite()
            || !impulse.is_finite()
            || force <= 0.0
            || impulse <= 0.0
            || self.force_newtons.value().abs() > force
            || self.planned_impulse_newton_seconds.value().abs() > impulse
        {
            return Err("contact exceeds original native force/impulse budget".into());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeContactApplication {
    pub handle: NativeContactHandle,
    pub occurrence: NativeContactOccurrence,
    pub operands: NativeContactOperands,
}
impl NativeContactApplication {
    pub fn validate(&self) -> Result<(), String> {
        self.handle.validate()?;
        self.occurrence.validate()?;
        self.operands.validate()
    }
    pub fn validate_basis(&self, basis: &PerformanceBasis) -> Result<(), String> {
        self.validate()?;
        self.operands.validate_basis(basis)
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OriginalGravityContact {
    pub contact_ref: String,
    pub particle_ref: String,
    pub collider_ref: String,
    pub route_ref: String,
    pub source_ref: String,
    pub policy_ref: String,
    pub policy_revision: String,
    pub standing: String,
    pub plane_position_metres: [NativeContactScalar; 3],
    pub normal: [NativeContactScalar; 3],
    pub height_metres: NativeContactScalar,
    pub initial_normal_velocity_metres_per_second: NativeContactScalar,
    pub gravity_metres_per_second_squared: NativeContactScalar,
    pub mass_kg: NativeContactScalar,
    pub restitution: NativeContactScalar,
    pub transfer_fraction: NativeContactScalar,
    pub minimum_impact_speed_metres_per_second: NativeContactScalar,
    pub start_sample: Counter,
    pub duration_samples: Counter,
}
impl OriginalGravityContact {
    fn require_operands(&self, o: &NativeContactOperands) -> Result<(), String> {
        if self.contact_ref != o.contact_ref
            || self.particle_ref != o.particle_ref
            || self.collider_ref != o.collider_ref
            || self.route_ref != o.route_ref
            || self.source_ref != o.source_ref
            || self.policy_ref != o.policy_ref
            || self.policy_revision != o.policy_revision
            || self.standing != o.standing
            || self.plane_position_metres != o.plane_position_metres
            || self.normal != o.normal
            || self.height_metres != o.height_metres
            || self.initial_normal_velocity_metres_per_second
                != o.initial_normal_velocity_metres_per_second
            || self.gravity_metres_per_second_squared != o.gravity_metres_per_second_squared
            || self.mass_kg != o.mass_kg
            || self.restitution != o.restitution
            || self.transfer_fraction != o.transfer_fraction
            || self.minimum_impact_speed_metres_per_second
                != o.minimum_impact_speed_metres_per_second
            || self.start_sample != o.trigger_sample
            || self.duration_samples != o.duration_samples
        {
            return Err("native contact original gravity input differs".into());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeContactMaterial {
    pub reference: String,
    pub revision: String,
    pub source_ref: String,
    pub standing: String,
    pub young_modulus_pa: NativeContactScalar,
    pub density_kg_per_m3: NativeContactScalar,
    pub damping_alpha_per_second: NativeContactScalar,
    pub damping_beta_seconds: NativeContactScalar,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeContactProjection {
    pub axis: [NativeContactScalar; 3],
    pub node_weights: Vec<NativeContactScalar>,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeContactNode {
    pub identity: Counter,
    pub constituent: String,
    pub rest_metres: [NativeContactScalar; 3],
    pub additional_mass_kg: NativeContactScalar,
    pub fixed: [bool; 3],
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeContactEdge {
    pub first: Counter,
    pub second: Counter,
    pub section_m2: NativeContactScalar,
    pub prestress_newtons: NativeContactScalar,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OriginalContactBody {
    pub event_ref: String,
    pub subject_ref: String,
    pub source_coordinate: String,
    pub source_revision: String,
    pub geometry_ref: String,
    pub geometry_revision: String,
    pub geometry_source_ref: String,
    pub geometry_standing: String,
    pub preparation_ref: String,
    pub state_ref: String,
    pub source_generation: Counter,
    pub body_revision: Counter,
    pub sample_rate: Counter,
    pub pickup_linear_per_metre: NativeContactScalar,
    pub max_force_newtons: NativeContactScalar,
    pub max_impulse_newton_seconds: NativeContactScalar,
    pub max_displacement_metres: NativeContactScalar,
    pub pratibimba: bool,
    pub family: Counter,
    pub material: NativeContactMaterial,
    pub exciter: NativeContactProjection,
    pub pickup: NativeContactProjection,
    pub nodes: Vec<NativeContactNode>,
    pub edges: Vec<NativeContactEdge>,
}
impl OriginalContactBody {
    fn require_operands(
        &self,
        o: &NativeContactOperands,
        source: &NativeIdentity,
    ) -> Result<(), String> {
        if self.event_ref != source.event
            || self.subject_ref != source.subject
            || self.source_coordinate != o.source_coordinate
            || self.source_revision != o.source_revision
            || self.geometry_source_ref != o.source_ref
            || self.preparation_ref != o.preparation_ref
            || self.state_ref != o.state_ref
            || self.source_generation != o.source_generation
            || self.body_revision != o.body_revision
            || self.sample_rate != o.sample_rate
            || self.pratibimba != o.pratibimba
            || self.family.0 > 1
            || self.nodes.len() < 2
            || self.nodes.len() > 32
            || self.edges.is_empty()
            || self.edges.len() > 96
            || self.exciter.node_weights.len() != self.nodes.len()
            || self.pickup.node_weights.len() != self.nodes.len()
            || self.max_force_newtons.value() <= 0.0
            || self.max_impulse_newton_seconds.value() <= 0.0
            || o.force_newtons.value().abs() > self.max_force_newtons.value()
            || o.planned_impulse_newton_seconds.value().abs()
                > self.max_impulse_newton_seconds.value()
        {
            return Err("native contact original body/program differs".into());
        }
        let mut ids = BTreeSet::new();
        for node in &self.nodes {
            if !ids.insert(node.identity) || node.additional_mass_kg.value() < 0.0 {
                return Err("native contact original node differs".into());
            }
            reference(&node.constituent, 4097)?;
        }
        for edge in &self.edges {
            if edge.first == edge.second
                || edge.first.0 >= self.nodes.len() as u64
                || edge.second.0 >= self.nodes.len() as u64
                || edge.section_m2.value() <= 0.0
            {
                return Err("native contact original edge differs".into());
            }
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeContactDelivery {
    pub handle: NativeContactHandle,
    pub status: Counter,
    pub refusal: Counter,
    pub admission_sequence: Counter,
    pub start_application_ordinal: Counter,
    pub committed_cursor: Counter,
    pub requested_impact_sample: Counter,
    pub admitted_impact_sample: Counter,
    pub actual_impact_sample: Counter,
    pub delivered_frames: Counter,
    pub planned_frames: Counter,
    pub delivered_impulse_newton_seconds: NativeContactScalar,
    pub planned_impulse_newton_seconds: NativeContactScalar,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeContactSlot {
    pub handle: NativeContactHandle,
    pub occurrence: NativeContactOccurrence,
    pub source: NativeIdentity,
    pub admission_sequence: Counter,
    pub original: OriginalGravityContact,
    pub original_body: OriginalContactBody,
    pub operands: NativeContactOperands,
    pub delivery: NativeContactDelivery,
    pub force_newtons: Vec<NativeContactScalar>,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeContactCheckpoint {
    pub schema: String,
    pub history_present: bool,
    pub constructor_lineage: String,
    pub original_request_high_water: Counter,
    pub slot_generations: [Counter; 16],
    pub slots: Vec<NativeContactSlot>,
}
impl NativeContactCheckpoint {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != "ql.performance-contact-state/v1"
            || !self.history_present
            || self.original_request_high_water.0 == 0
            || self.slots.len() > 16
        {
            return Err("native contact checkpoint lineage/history differs".into());
        }
        reference(&self.constructor_lineage, 256)?;
        let mut slots = BTreeSet::new();
        let mut occurrences = BTreeSet::new();
        for slot in &self.slots {
            slot.handle.validate()?;
            slot.occurrence.validate()?;
            slot.operands.validate()?;
            slot.original.require_operands(&slot.operands)?;
            slot.original_body
                .require_operands(&slot.operands, &slot.source)?;
            let d = &slot.delivery;
            if !slots.insert(slot.handle.slot)
                || !occurrences.insert(slot.occurrence.original_request_id)
                || slot.occurrence.constructor_lineage != self.constructor_lineage
                || slot.occurrence.original_request_id > self.original_request_high_water
                || self.slot_generations[slot.handle.slot.0 as usize] != slot.handle.generation
                || slot.admission_sequence.0 == 0
                || d.handle != slot.handle
                || d.admission_sequence != slot.admission_sequence
                || d.status.0 == 0
                || d.status.0 > 5
                || d.refusal.0 > 4
                || d.planned_frames != slot.operands.duration_samples
                || d.delivered_frames > d.planned_frames
                || d.requested_impact_sample != slot.operands.impact_sample
                || d.admitted_impact_sample < d.requested_impact_sample
                || d.planned_impulse_newton_seconds != slot.operands.planned_impulse_newton_seconds
                || slot.force_newtons.len() != 512
            {
                return Err(
                    "native contact checkpoint lost exact program/progress/occurrence".into(),
                );
            }
            for (index, force) in slot.force_newtons.iter().enumerate() {
                if (index < slot.operands.duration_samples.0 as usize
                    && *force != slot.operands.force_newtons)
                    || (index >= slot.operands.duration_samples.0 as usize
                        && force.value().to_bits() != 0.0f64.to_bits())
                {
                    return Err("native contact checkpoint force programme differs".into());
                }
            }
        }
        Ok(())
    }
    pub fn validate_queued_operation(&self, operation: &Value) -> Result<(), String> {
        let handle: NativeContactHandle =
            serde_json::from_value(operation["contact"].clone()).map_err(|e| e.to_string())?;
        let slot = self
            .slots
            .iter()
            .find(|slot| slot.handle == handle)
            .ok_or("native queued contact original slot absent")?;
        if counter(&operation["sequence"])? != slot.admission_sequence
            || counter(&operation["sample"])? != slot.delivery.admitted_impact_sample
            || counter(&operation["requested_sample"])? != slot.operands.impact_sample
            || operation["identity"]
                != serde_json::to_value(&slot.source).map_err(|e| e.to_string())?
        {
            return Err("native queued contact original admission differs".into());
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeSceneContactBoundary {
    pub schema: String,
    pub session_ref: String,
    pub transport_epoch: Counter,
    pub determination: Value,
    pub physical_body: Value,
    pub physical_eigenbasis: String,
    pub native_trigger_sample: Counter,
    pub queue_cursor: Counter,
    pub queue_horizon: Counter,
    pub accepted_sequence: Counter,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeSceneContactSource {
    pub schema: String,
    pub original_native_request_id: Counter,
    pub scene_constructor: Value,
    pub authored_definition: crate::expression_performance::contact::AuthoredContactDefinition,
    pub native_boundary: NativeSceneContactBoundary,
    pub occurrence: NativeContactOccurrence,
    pub original_gravity_input: OriginalGravityContact,
    pub native_operands: NativeContactOperands,
    pub original_body: OriginalContactBody,
    pub force_newtons: Vec<NativeContactScalar>,
    pub exciter_position_metres: [NativeContactScalar; 3],
}
impl NativeSceneContactSource {
    pub fn validate(&self) -> Result<(), String> {
        self.authored_definition.validate()?;
        self.occurrence.validate()?;
        self.native_operands.validate()?;
        self.original_gravity_input
            .require_operands(&self.native_operands)?;
        let boundary = &self.native_boundary;
        let identity: NativeIdentity =
            serde_json::from_value(boundary.determination["identity"].clone())
                .map_err(|e| e.to_string())?;
        self.original_body
            .require_operands(&self.native_operands, &identity)?;
        let constructor = self
            .scene_constructor
            .as_object()
            .ok_or("original Scene constructor fact absent")?;
        const CONSTRUCTOR_KEYS: [&str; 10] = [
            "schema",
            "expression_ref",
            "scene_ref",
            "instance_ref",
            "construction_generation",
            "generation_domain",
            "initial_document_revision",
            "initial_document_sha256",
            "document_revision",
            "document_sha256",
        ];
        if self.schema != "ql.native-scene-contact-source/v1"
            || self.original_native_request_id != self.occurrence.original_request_id
            || boundary.schema != "ql.native-scene-contact-boundary/v1"
            || boundary.transport_epoch.0 == 0
            || boundary.native_trigger_sample != self.native_operands.trigger_sample
            || boundary.queue_cursor > boundary.native_trigger_sample
            || boundary.queue_horizon != boundary.native_trigger_sample
            || boundary.determination["body_revision"]
                != serde_json::to_value(self.native_operands.body_revision)
                    .map_err(|e| e.to_string())?
            || boundary.determination["body_preparation_ref"]
                != self.native_operands.preparation_ref
            || boundary.determination["body_state_ref"] != self.native_operands.state_ref
            || !boundary.physical_body.is_object()
            || boundary.physical_eigenbasis != self.native_operands.eigenbasis
            || constructor.len() != CONSTRUCTOR_KEYS.len()
            || CONSTRUCTOR_KEYS
                .iter()
                .any(|key| !constructor.contains_key(*key))
            || constructor["schema"] != "oi.native-document-scene-constructor/v1"
            || constructor["generation_domain"] != "native-document-scene-construction"
            || constructor["instance_ref"] != self.occurrence.constructor_lineage
            || self.authored_definition.contact_ref != self.native_operands.contact_ref
            || self.authored_definition.particle_ref != self.native_operands.particle_ref
            || self.authored_definition.collider_ref != self.native_operands.collider_ref
            || self.authored_definition.policy_ref != self.native_operands.policy_ref
            || self.authored_definition.policy_revision != self.native_operands.policy_revision
            || self.authored_definition.standing != self.native_operands.standing
            || u64::from(self.authored_definition.duration_samples)
                != self.native_operands.duration_samples.0
            || self.force_newtons.len() != 512
        {
            return Err("original Contact source/Scene/clock/body record differs".into());
        }
        let original_body: OriginalContactBody =
            serde_json::from_value(boundary.physical_body.clone()).map_err(|e| e.to_string())?;
        if original_body != self.original_body {
            return Err("Contact boundary lost complete original body".into());
        }
        if counter(&boundary.determination["identity"]["m1_revision"])? != identity.m1_revision
            || counter(&boundary.determination["identity"]["m2_generation"])?
                != identity.m2_generation
        {
            return Err("Contact original determination differs".into());
        }
        reference(&boundary.session_ref, 256)?;
        for key in ["expression_ref", "scene_ref", "instance_ref"] {
            reference(
                constructor[key]
                    .as_str()
                    .ok_or("native Scene reference type differs")?,
                256,
            )?;
        }
        for key in [
            "construction_generation",
            "initial_document_revision",
            "document_revision",
        ] {
            if constructor[key].as_u64().is_none_or(|v| v == 0) {
                return Err("native Scene constructor integer differs".into());
            }
        }
        for key in ["initial_document_sha256", "document_sha256"] {
            let hash = constructor[key]
                .as_str()
                .ok_or("native Scene original digest absent")?;
            if hash.len() != 64
                || !hash
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
            {
                return Err("native Scene original digest spelling differs".into());
            }
        }
        for (index, force) in self.force_newtons.iter().enumerate() {
            if (index < self.native_operands.duration_samples.0 as usize
                && *force != self.native_operands.force_newtons)
                || (index >= self.native_operands.duration_samples.0 as usize
                    && force.value().to_bits() != 0.0f64.to_bits())
            {
                return Err("original Contact full force programme differs".into());
            }
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeSceneContactAdmission {
    pub schema: String,
    pub before_source_assets: Value,
    pub source: NativeSceneContactSource,
    pub native_admission: Value,
}
impl NativeSceneContactAdmission {
    pub fn validate(&self) -> Result<(), String> {
        self.source.validate()?;
        let reply = &self.native_admission;
        let payload = &reply["payload"];
        let queued = &payload["score_admission"];
        let event = &queued["event"];
        let handle: NativeContactHandle =
            serde_json::from_value(event["contact"].clone()).map_err(|e| e.to_string())?;
        handle.validate()?;
        let boundary = &self.source.native_boundary;
        if self.schema != "ql.native-scene-contact-admission/v1"
            || self.before_source_assets["schema"] != "ql.retained-performance-source-assets/v1"
            || reply["schema"] != "ql.performance-worker-reply/v1"
            || reply["accepted"] != true
            || payload["queue_committed"] != true
            || payload["application_committed"] != false
            || queued["schema"] != "ql.native-score-admission/v1"
            || queued["queued"] != true
            || queued["session_ref"] != boundary.session_ref
            || counter(&queued["transport_epoch"])? != boundary.transport_epoch
            || counter(&queued["queue_cursor"])? < boundary.queue_cursor
            || counter(&queued["queue_cursor"])? > self.source.native_operands.impact_sample
            || counter(&queued["queue_horizon"])? < boundary.queue_horizon
            || counter(&queued["queue_horizon"])? > self.source.native_operands.impact_sample
            || queued["input_ref"] != self.source.native_operands.contact_ref
            || event["kind"] != 7
            || counter(&event["requested_sample"])? != self.source.native_operands.impact_sample
            || counter(&event["sample"])? != self.source.native_operands.impact_sample
            || event["late_admitted"] != false
            || event["has_note"] != false
            || event["has_determination"] != false
            || counter(&event["touch"])? != Counter(0)
            || event["value"].as_f64() != Some(0.0)
            || event["pitch_hz"].as_f64() != Some(0.0)
            || counter(&event["sequence"])?
                != Counter(
                    boundary
                        .accepted_sequence
                        .0
                        .checked_add(1)
                        .ok_or("contact native sequence exhausted")?,
                )
            || event["identity"] != boundary.determination["identity"]
            || queued["source"] != boundary.determination
            || !reply["applications"].is_array()
            || !reply["input_history"].is_array()
            || !reply["recording"].is_object()
            || self.before_source_assets["current_receiving"]["native_admission"]
                ["native_preparation"]["physical_body"]["request"]["preparation_ref"]
                != self.source.native_operands.preparation_ref
            || counter(&reply["reading"]["accepted_sequence"])? != counter(&event["sequence"])?
            || reply["reading"]["transport_epoch"] != queued["transport_epoch"]
            || payload["native_result"] != "accepted"
            || !matches!(
                reply["operation"].as_str(),
                Some("contact-apply" | "contact-trigger")
            )
        {
            return Err(
                "Contact admission lost complete original queued native pulse/source".into(),
            );
        }
        // The record is parsed independently so native f64 operands use exact
        // bits while the complete original raw pulse remains retained.
        let echoed: NativeSceneContactSource =
            serde_json::from_value(payload["contact_source"].clone()).map_err(|e| e.to_string())?;
        if echoed != self.source {
            return Err("Contact queued pulse source differs".into());
        }
        Ok(())
    }
    pub fn require_application(
        &self,
        contact: &NativeContactApplication,
        sequence: Counter,
    ) -> Result<(), String> {
        self.validate()?;
        let queued = &self.native_admission["payload"]["score_admission"]["event"];
        let handle: NativeContactHandle =
            serde_json::from_value(queued["contact"].clone()).map_err(|e| e.to_string())?;
        if handle != contact.handle
            || self.source.occurrence != contact.occurrence
            || self.source.native_operands != contact.operands
            || counter(&queued["sequence"])? != sequence
        {
            return Err(
                "Contact callback differs from original queued occurrence/programme".into(),
            );
        }
        Ok(())
    }
}

/// Complete numerical records and original native admissions are separate.
/// This checks lossless retention, never the current private Scene/Act grant.
pub(crate) fn validate_history(
    bundle: &Value,
    admissions: Option<&[Value]>,
    require_admission: bool,
) -> Result<(), String> {
    let Some(value) = bundle.get("contact_occurrence_history") else {
        if admissions.is_some() {
            return Err("Contact admission sidecar lacks original source history".into());
        }
        return Ok(());
    };
    let history = value
        .as_array()
        .ok_or("Contact source history array required")?;
    if history.is_empty() {
        return Err("empty Contact source history must preserve absence".into());
    }
    if admissions.is_some_and(|a| a.len() != history.len())
        || (require_admission && admissions.is_none())
    {
        return Err("Contact source history lost original admission pulse".into());
    }
    let mut previous = Counter(0);
    let mut lineage = None;
    for (index, wire) in history.iter().enumerate() {
        let source: NativeSceneContactSource =
            serde_json::from_value(wire.clone()).map_err(|e| e.to_string())?;
        source.validate()?;
        if source.original_native_request_id <= previous
            || lineage
                .as_ref()
                .is_some_and(|l| l != &source.occurrence.constructor_lineage)
        {
            return Err("Contact source occurrence order/lineage differs".into());
        }
        previous = source.original_native_request_id;
        lineage = Some(source.occurrence.constructor_lineage.clone());
        if let Some(admissions) = admissions {
            let admission: NativeSceneContactAdmission =
                serde_json::from_value(admissions[index].clone()).map_err(|e| e.to_string())?;
            admission.validate()?;
            if admission.source != source {
                return Err("Contact source and original admission history differ".into());
            }
            let before = admission
                .before_source_assets
                .get("contact_occurrence_history");
            if (index == 0 && before.is_some())
                || (index > 0
                    && before.and_then(Value::as_array).map(Vec::as_slice)
                        != Some(&history[..index]))
            {
                return Err("Contact admission lost original complete history prefix".into());
            }
        }
    }
    Ok(())
}

/// Find the original queued occurrence/programme across complete retained
/// source epochs. Repeated unchanged historical prefixes are identical facts;
/// conflicting copies cannot select a different queue admission.
pub(crate) fn require_recorded_application(
    performance: &crate::expression_performance::Performance,
    basis_index: u16,
    contact: &NativeContactApplication,
    sequence: Option<Counter>,
) -> Result<(), String> {
    contact.validate_basis(
        performance
            .bases
            .get(usize::from(basis_index))
            .ok_or("Contact basis absent")?,
    )?;
    let digest = &performance.bases[usize::from(basis_index)].content_digest;
    let mut matched = None;
    for asset in &performance.native_sources {
        if asset.basis_digest() != digest {
            continue;
        }
        let Some(rows) = asset.native_contact_admission_history() else {
            continue;
        };
        for row in rows {
            let original: NativeSceneContactAdmission =
                serde_json::from_value(row.clone()).map_err(|e| e.to_string())?;
            if original.source.occurrence != contact.occurrence {
                continue;
            }
            let original_sequence = counter(
                &original.native_admission["payload"]["score_admission"]["event"]["sequence"],
            )?;
            original.require_application(contact, sequence.unwrap_or(original_sequence))?;
            if matched
                .as_ref()
                .is_some_and(|previous| previous != &original)
            {
                return Err(
                    "Contact original admission conflicts across retained source epochs".into(),
                );
            }
            matched = Some(original);
        }
    }
    matched
        .map(|_| ())
        .ok_or("Contact lacks its complete original native admission/source/occurrence")
}

/// Literal old no-contact schemas stay unchanged. A v3 discriminator requires
/// the complete strict original contact application; null is never absence.
pub(crate) fn validate_application_discriminator(wire: &Value) -> Result<(), String> {
    let app: crate::expression_performance_recording::NativeApplication =
        serde_json::from_value(wire.clone()).map_err(|e| e.to_string())?;
    if app.kind == 7 {
        if app.schema != "ql.performance-applied-event/v3" || app.operation != "contact" {
            return Err("Contact application schema/kind differs".into());
        }
        app.contact
            .as_ref()
            .ok_or("Contact application original operands absent")?
            .validate()?;
    } else if app.kind > 6
        || app.schema != "ql.performance-applied-event/v2"
        || app.contact.is_some()
    {
        return Err("ordinary native application changed its no-contact schema".into());
    }
    Ok(())
}
/// Structural original CP custody only. Numerical reconstruction and current
/// selected-Scene/Act/occurrence qualification remain in the actual owner.
pub(crate) fn checkpoint_contacts(
    audio: &Value,
) -> Result<Option<NativeContactCheckpoint>, String> {
    match (audio["schema"].as_str(), audio.get("contacts")) {
        (Some("ql.performance-checkpoint/v3"), Some(value)) if audio["version"] == 3 => {
            let contacts: NativeContactCheckpoint =
                serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
            contacts.validate()?;
            let cursor = counter(&audio["cursor"])?;
            let accepted = counter(&audio["accepted_sequence"])?;
            let applied = counter(&audio["applied_application_ordinal"])?;
            for slot in &contacts.slots {
                let d = &slot.delivery;
                if slot.admission_sequence > accepted
                    || d.start_application_ordinal > applied
                    || d.committed_cursor > cursor
                    || d.admitted_impact_sample != slot.operands.impact_sample
                    || (d.status.0 == 1
                        && (d.delivered_frames.0 != 0 || slot.operands.impact_sample < cursor))
                    || (d.status.0 == 2
                        && (d.delivered_frames.0 == 0
                            || d.delivered_frames >= d.planned_frames
                            || d.actual_impact_sample != slot.operands.impact_sample
                            || cursor.0
                                != slot
                                    .operands
                                    .impact_sample
                                    .0
                                    .checked_add(d.delivered_frames.0)
                                    .ok_or("Contact progress overflow")?))
                    || (d.status.0 == 3 && d.delivered_frames != d.planned_frames)
                    || (d.status.0 == 4 && d.delivered_frames.0 != 0)
                {
                    return Err(
                        "Contact checkpoint original progress/date/high-water differs".into(),
                    );
                }
                let delivered = (0..d.delivered_frames.0 as usize).fold(0.0f64, |sum, index| {
                    sum + slot.force_newtons[index].value() / slot.operands.sample_rate.0 as f64
                });
                if delivered.to_bits() != d.delivered_impulse_newton_seconds.value().to_bits() {
                    return Err("Contact checkpoint lost exact delivered native impulse".into());
                }
            }
            for (index, generation) in contacts.slot_generations.iter().enumerate() {
                if generation.0 != 0
                    && !contacts
                        .slots
                        .iter()
                        .any(|slot| slot.handle.slot.0 == index as u64)
                {
                    return Err("Contact checkpoint lost an original occupied slot".into());
                }
            }
            Ok(Some(contacts))
        }
        (Some("ql.performance-checkpoint/v1" | "ql.performance-checkpoint/v2"), None) => Ok(None),
        _ => Err("Contact checkpoint schema/history presence differs".into()),
    }
}
