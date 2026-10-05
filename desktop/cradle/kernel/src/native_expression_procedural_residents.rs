//! A private, same-channel physical reading for the stage material receiver.
//! This is neither an operation application receipt nor a Window registration.
use crate::expression::Document;
use serde_json::{Value, json};
use std::collections::BTreeSet;

/// Issued only after SourceIntake has verified the actual held native channel.
/// No Deserialize, Default, or public constructor can turn caller JSON into it.
pub(super) struct ResidentBoundary {
    lease: String,
    identity: Value,
    ordinal: u64,
    document_fingerprint: String,
    expression_ref: String,
    document_revision: u64,
    scene_ref: String,
    registry: Value,
    position: Value,
    timing: Value,
    field_owner: Value,
}

fn exact_cursor(value: &Value) -> Result<u64, String> {
    super::super::cursor(value)
}
fn reference(value: &Value) -> Result<&str, String> {
    let value = value
        .as_str()
        .ok_or("Actual resident reference is absent")?;
    crate::expression::text(value)?;
    Ok(value)
}

impl ResidentBoundary {
    /// The private SourceIntake calls this after checking its captured lease,
    /// identity, executable, binding and consumed native request ordinal.
    pub(super) fn from_current_channel(
        lease: &str,
        identity: &Value,
        ordinal: u64,
        before: &Document,
        scene_ref: &str,
        receipt: &Value,
    ) -> Result<Self, String> {
        if receipt["status"] != "ok"
            || receipt["available"] != true
            || receipt["instance_ref"] != identity["instance_ref"]
            || exact_cursor(&receipt["request_id"])? != ordinal
            || !before
                .scenes
                .iter()
                .any(|scene| scene.scene_ref == scene_ref)
        {
            return Err("Resident reading has another actual channel or Scene".into());
        }
        let source = &receipt["procedural"];
        let prepared = source
            .get("prepared")
            .filter(|v| v.is_object())
            .unwrap_or(source);
        let position = &source["native_position"];
        let timing = &prepared["timing"];
        let proof = json!({"native_position":position,"timing":timing,
            "native_field_receipt":receipt["native_field_timing_receipt"],
            "native_timing_pulse":receipt["native_timing_pulse"]});
        super::bootstrap::validate_timing_boundary(
            &proof,
            receipt,
            exact_cursor(&position["generation"])?,
            exact_cursor(&position["samples_elapsed"])?,
        )?;
        if timing["domain"] != "native_samples" {
            return Err(
                "This resident material reading requires its actual performance owner".into(),
            );
        }
        let pulse = &receipt["native_timing_pulse"];
        let registry = &pulse["resident_consumers"];
        let snapshot = &registry["physical_observation"]["snapshot"];
        let source_identity = &registry["source"];
        let sample = exact_cursor(&registry["sample"])?;
        if registry["schema"] != "ql.native-resident-consumer-registry/v1"
            || registry["origin"] != "actual-native-constructors-and-same-pulse"
            || source_identity["instance"] != position["instance_ref"]
            || source_identity["event"] != position["event_ref"]
            || source_identity["subject"] != position["subject_ref"]
            || *source_identity != pulse["payload"]["timing_fact"]["source"]["identity"]
            || exact_cursor(&snapshot["source_generation"])?
                != exact_cursor(&position["generation"])?
            || registry["transport_epoch"] != pulse["payload"]["timing_fact"]["transport_epoch"]
            || sample != exact_cursor(&position["samples_elapsed"])?
            || snapshot["schema"] != "ql.native-physical-snapshot/v1"
            || snapshot["version"].as_u64() != Some(1)
            || snapshot["event_ref"] != position["event_ref"]
            || snapshot["subject_ref"] != position["subject_ref"]
            || exact_cursor(&snapshot["samples_elapsed"])? != sample
            || snapshot["pratibimba"] != registry["physical_pratibimba"]
        {
            return Err(
                "Full physical observation differs from its original same-pulse Source".into(),
            );
        }
        exact_cursor(&source_identity["m1_revision"])?;
        exact_cursor(&source_identity["m2_generation"])?;
        exact_cursor(&registry["transport_epoch"])?;
        for key in ["m3_source_generation", "body_revision"] {
            let physical_key = if key == "m3_source_generation" {
                "source_generation"
            } else {
                key
            };
            if exact_cursor(&registry[key])? != exact_cursor(&snapshot[physical_key])? {
                return Err("Resident source/body revision changed across one pulse".into());
            }
        }
        for key in [
            "preparation_ref",
            "state_ref",
            "source_coordinate",
            "source_revision",
            "eigenbasis_identity",
        ] {
            if reference(&registry[key])? != reference(&snapshot[key])? {
                return Err("Resident full physical source provenance is inconsistent".into());
            }
        }
        for key in [
            "geometry_ref",
            "geometry_revision",
            "material_ref",
            "material_revision",
            "resident_instance_ref",
        ] {
            reference(&snapshot[key])?;
        }
        if snapshot["sample_rate"]
            .as_u64()
            .is_none_or(|rate| rate == 0)
            || snapshot["pickup_linear"] != registry["physical_observation"]["pickup_linear"]
            || snapshot["mechanical_energy_joules"]
                != registry["physical_observation"]["energy_joules"]
        {
            return Err(
                "Resident full physical output differs from the same copied boundary".into(),
            );
        }
        let count = snapshot["node_count"]
            .as_u64()
            .filter(|count| *count > 0 && *count <= 32)
            .ok_or("Actual bounded physical nodes are absent")? as usize;
        let ids = snapshot["node_identity"]
            .as_array()
            .ok_or("Actual physical node identities absent")?;
        let rest = snapshot["rest_positions_metres"]
            .as_array()
            .ok_or("Actual physical rest positions absent")?;
        let visible = snapshot["visible_positions_metres"]
            .as_array()
            .ok_or("Actual physical visible positions absent")?;
        let nodes = registry["native_nodes"]
            .as_array()
            .ok_or("Actual registry node correspondence absent")?;
        if [ids.len(), rest.len(), visible.len(), nodes.len()]
            .iter()
            .any(|len| *len != count)
        {
            return Err("Actual physical node count or correspondence differs".into());
        }
        let mut node_ids = BTreeSet::new();
        for i in 0..count {
            let id = exact_cursor(&ids[i])?;
            if id == 0
                || !node_ids.insert(id)
                || exact_cursor(&nodes[i]["native_node_id"])? != id
                || rest[i] != nodes[i]["rest_metres"]
                || visible[i] != nodes[i]["visible_metres"]
            {
                return Err("Physical source nodes were duplicated, reordered or changed".into());
            }
            for coordinates in [&rest[i], &visible[i]] {
                let coordinates = coordinates
                    .as_array()
                    .filter(|axes| axes.len() == 3)
                    .ok_or("Actual physical node is not a metric three-coordinate position")?;
                if coordinates
                    .iter()
                    .any(|axis| axis.as_f64().is_none_or(|value| !value.is_finite()))
                {
                    return Err("Actual physical node position is nonfinite".into());
                }
            }
        }
        let residents = registry["required_consumers"]
            .as_array()
            .filter(|rows| (2..=3).contains(&rows.len()))
            .ok_or("Actual complete numeric resident contract absent")?;
        let mut roles = BTreeSet::new();
        let mut instances = BTreeSet::new();
        for resident in residents {
            let role = reference(&resident["role"])?;
            let instance = reference(&resident["instance_ref"])?;
            if !["audio_engine", "physical_body", "acoustic_receiving"].contains(&role)
                || !roles.insert(role)
                || !instances.insert(instance)
                || resident["generation_domain"] != "native-resident-construction"
                || exact_cursor(&resident["generation"])? == 0
                || exact_cursor(&resident["sample"])? != sample
            {
                return Err("Numeric resident lifetime or same-pulse contract differs".into());
            }
            let observed = &registry[match role {
                "audio_engine" => "audio_observation",
                "physical_body" => "physical_observation",
                _ => "receiving_observation",
            }];
            if observed["instance_ref"] != resident["instance_ref"]
                || exact_cursor(&observed["sample"])? != sample
            {
                return Err(
                    "Actual numeric resident observation belongs to another instance".into(),
                );
            }
            if role == "physical_body"
                && observed["instance_ref"] != snapshot["resident_instance_ref"]
            {
                return Err("The full physical snapshot belongs to another body lifetime".into());
            }
        }
        if !roles.contains("audio_engine")
            || !roles.contains("physical_body")
            || roles.contains("acoustic_receiving") != !registry["receiving_observation"].is_null()
        {
            return Err("Required numeric residents were omitted or invented".into());
        }
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            registry, position, timing,
        ))?;
        // The FIELD owner remains independent of the copied P position. Its
        // exact receipt facts qualify the existing sampler frame only.
        let field = &receipt["field"];
        for key in ["event_ref", "subject_ref"] {
            reference(&field[key])?;
            if field[key] != identity[key] {
                return Err(
                    "The sampler FIELD receipt belongs to another captured native subject/event"
                        .into(),
                );
            }
        }
        exact_cursor(&field["generation"])?;
        exact_cursor(&field["samples_elapsed"])?;
        let field_owner = json!({"instance_ref":receipt["instance_ref"],
            "event_ref":field["event_ref"],"subject_ref":field["subject_ref"],
            "generation":field["generation"],"samples_elapsed":field["samples_elapsed"],
            "native_request_id":receipt["request_id"],"domain":"native_field_samples"});
        Ok(Self {
            lease: lease.into(),
            identity: identity.clone(),
            ordinal,
            document_fingerprint: super::bootstrap::fingerprint(before)?,
            expression_ref: before.expression_ref.clone(),
            document_revision: before.revision,
            scene_ref: scene_ref.into(),
            registry: registry.clone(),
            position: position.clone(),
            timing: timing.clone(),
            field_owner,
        })
    }

    /// Re-attest the actual channel and full Document before exposing the
    /// sampler counterpart. The result contains readings, never an applied ACK.
    pub(super) fn reading(
        &self,
        manager: &mut crate::native_expression::Manager,
        current: &Document,
    ) -> Result<Value, String> {
        let owner = manager
            .active
            .as_mut()
            .ok_or("Actual resident channel closed")?;
        if owner.lease != self.lease
            || owner.identity != self.identity
            || owner.last_request_id != self.ordinal
            || owner.stopped
            || owner
                .child
                .try_wait()
                .map_err(|error| error.to_string())?
                .is_some()
            || self.document_fingerprint != super::bootstrap::fingerprint(current)?
        {
            return Err(
                "Resident material boundary no longer meets its original channel or full Document"
                    .into(),
            );
        }
        let physical = self.registry["required_consumers"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["role"] == "physical_body")
            .ok_or("Actual body resident disappeared")?;
        Ok(json!({"schema":"oi.native-resident-material-boundary/v1",
            "expression_ref":self.expression_ref,"scene_ref":self.scene_ref,"document_revision":self.document_revision,
            "document_fingerprint":self.document_fingerprint,"native_request_id":self.ordinal.to_string(),
            "source":self.registry["source"],"transport_epoch":self.registry["transport_epoch"],
            "physical_instance_ref":physical["instance_ref"],"physical_generation":physical["generation"],
            "physical_generation_domain":physical["generation_domain"],"native_position":self.position,"timing":self.timing,
            "eigenbasis_identity":self.registry["eigenbasis_identity"],"registry":self.registry,"field_owner":self.field_owner,
            "qualification":"private_same_channel_same_pulse_reading","consumer_state":"unconfirmed"}))
    }
}
