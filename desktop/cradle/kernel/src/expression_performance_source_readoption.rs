//! Full same-worker selected-source evidence, retained by the existing page.
//! File data never constructs the private live Manager/Act channel carrier.
use crate::expression_performance::{CheckpointBinding, Performance};
use crate::expression_performance_readmission::{
    same_management_wire, verify_receiving_derivative,
};
use crate::expression_performance_reservation::NativeReservationContinuation;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RetainedNativeSourceReadoption {
    schema: String,
    original_checkpoint: CheckpointBinding,
    original_checkpoint_wire: String,
    before_source: Value,
    before_restoration_receipt: Value,
    source_readoption: Value,
    selected_source_projection: Value,
    selection: Value,
    native_parent_qualification: Value,
    native_pulse: Value,
}
/// Equality of complete copied native evidence: field/type/array order and
/// finite IEEE bits, including zero sign. Integer and floating JSON kinds
/// remain distinct. This comparator grants neither a source nor a clock.
pub(crate) fn exact_native_value(left: &Value, right: &Value) -> bool {
    match (left, right) {
        (Value::Number(a), Value::Number(b)) => {
            if a.is_f64() != b.is_f64() {
                return false;
            }
            if a.is_f64() {
                a.as_f64().zip(b.as_f64()).is_some_and(|(a, b)| {
                    a.is_finite() && b.is_finite() && a.to_bits() == b.to_bits()
                })
            } else {
                a == b
            }
        }
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| exact_native_value(a, b))
        }
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter().all(|(key, value)| {
                    b.get(key)
                        .is_some_and(|other| exact_native_value(value, other))
                })
        }
        _ => left == right,
    }
}
fn wire(value: &Value, key: &str) -> Result<Value, String> {
    let text = value[key]
        .as_str()
        .ok_or_else(|| format!("original source readoption {key} text absent"))?;
    if text.is_empty() || text.len() > crate::expression_performance_delivery::MAX_DELIVERY_BYTES {
        return Err("original source readoption checkpoint bound differs".into());
    }
    serde_json::from_str(text).map_err(|e| e.to_string())
}
fn count(v: &Value) -> Result<crate::expression_performance::Counter, String> {
    serde_json::from_value(v.clone()).map_err(|e| e.to_string())
}
impl RetainedNativeSourceReadoption {
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn from_native_channel(
        original_checkpoint: CheckpointBinding,
        original_checkpoint_wire: &str,
        before_source: &Value,
        before_receipt: &Value,
        source_readoption: &Value,
        projection: &Value,
        selection: &Value,
        parent: &Value,
        pulse: &Value,
    ) -> Result<Self, String> {
        // Charge all borrowed originals before creating the persisted copies.
        crate::expression_act_storage::measure(
            &(
                &original_checkpoint,
                original_checkpoint_wire,
                before_source,
                before_receipt,
                source_readoption,
                projection,
                selection,
                parent,
                pulse,
            ),
            crate::expression_performance::MAX_PERFORMANCE_BYTES,
        )?;
        if source_readoption["original_checkpoint_wire"].as_str() != Some(original_checkpoint_wire)
        {
            return Err("selected source readoption lost exact original selected wire".into());
        }
        Ok(Self {
            schema: "oi.expression-native-source-readoption/v1".into(),
            original_checkpoint,
            original_checkpoint_wire: original_checkpoint_wire.into(),
            before_source: before_source.clone(),
            before_restoration_receipt: before_receipt.clone(),
            source_readoption: source_readoption.clone(),
            selected_source_projection: projection.clone(),
            selection: selection.clone(),
            native_parent_qualification: parent.clone(),
            native_pulse: pulse.clone(),
        })
    }
    pub fn original_checkpoint(&self) -> &CheckpointBinding {
        &self.original_checkpoint
    }
    pub fn before_source(&self) -> &Value {
        &self.before_source
    }
    pub fn native_pulse(&self) -> &Value {
        &self.native_pulse
    }
    pub fn original_before_restoration_receipt(&self) -> &Value {
        &self.before_restoration_receipt
    }
    pub(crate) fn before_wire(&self) -> Result<Value, String> {
        wire(&self.source_readoption, "before_checkpoint_wire")
    }
    pub(crate) fn pre_pulse_wire(&self) -> Result<Value, String> {
        wire(&self.source_readoption, "pre_pulse_checkpoint_wire")
    }
    pub(crate) fn after_wire(&self) -> Result<Value, String> {
        wire(&self.source_readoption, "after_checkpoint_wire")
    }
    pub(crate) fn before_source_index(&self, performance: &Performance) -> Result<usize, String> {
        let object = self
            .before_source
            .as_object()
            .ok_or("actual before source absent")?;
        if object.len() != 4
            || [
                "native_bundle",
                "native_preparation",
                "native_basis",
                "reading",
            ]
            .iter()
            .any(|k| !object.contains_key(*k))
        {
            return Err("actual before-source complete field set differs".into());
        }
        let mut matches = performance
            .native_sources
            .iter()
            .enumerate()
            .filter(|(_, asset)| {
                exact_native_value(asset.native_bundle(), &self.before_source["native_bundle"])
            });
        let (index, asset) = matches
            .next()
            .ok_or("actual resident before source absent from original held Act corpus")?;
        if matches.next().is_some() {
            return Err(
                "actual resident before source is ambiguous in original held corpus".into(),
            );
        }
        if !exact_native_value(
            &self.before_source["native_basis"],
            &asset.native_bundle()["native_basis"],
        ) || !exact_native_value(
            &self.before_source["native_preparation"],
            &asset.native_bundle()["current_receiving"]["native_admission"]["native_preparation"],
        ) {
            return Err(
                "actual resident before native packet/basis differ from whole retained source"
                    .into(),
            );
        }
        Ok(index)
    }
    pub fn validate(
        &self,
        performance: &Performance,
        proof: &NativeReservationContinuation,
    ) -> Result<(), String> {
        if self.schema != "oi.expression-native-source-readoption/v1"
            || self.selection["schema"] != "ql.native-act-source-lease-evidence/v1"
            || self.native_parent_qualification["schema"]
                != "oi.native-parent-channel-qualification/v1"
            || self.native_parent_qualification["qualified"] != true
        {
            return Err("original source readoption channel provenance lost".into());
        }
        let object = self
            .source_readoption
            .as_object()
            .ok_or("source readoption object absent")?;
        let fields = [
            "schema",
            "before_checkpoint_wire",
            "original_checkpoint_wire",
            "pre_pulse_checkpoint_wire",
            "operative_checkpoint_wire",
            "after_checkpoint_wire",
            "current_source_packet",
            "actual_native_basis",
            "current_receiving",
            "transport_ack",
        ];
        let saved_acoustic = object.contains_key("original_saved_acoustic");
        if self.source_readoption["schema"] != "ql.native-selected-source-readoption/v1"
            || object.len() != fields.len() + usize::from(saved_acoustic)
            || fields.iter().any(|k| !object.contains_key(*k))
        {
            return Err("original source readoption full shape differs".into());
        }
        let original: Value =
            serde_json::from_str(&self.original_checkpoint_wire).map_err(|e| e.to_string())?;
        let before = self.before_wire()?;
        let pre = self.pre_pulse_wire()?;
        let operative = wire(&self.source_readoption, "operative_checkpoint_wire")?;
        let after = self.after_wire()?;
        if self.source_readoption["original_checkpoint_wire"].as_str()
            != Some(&self.original_checkpoint_wire)
            || self.original_checkpoint != proof.saved
            || !same_management_wire(&original, &proof.saved.native_management_wire()?)?
            || !same_management_wire(&before, &proof.before.native_management_wire()?)?
            || !same_management_wire(&after, &proof.after.native_management_wire()?)?
            || !same_management_wire(&operative, &after)?
        {
            return Err(
                "same-worker source readoption changed a complete original checkpoint".into(),
            );
        }
        // Only the genuine ACK epoch and declared N9 admission seals differ
        // before feedback. Neither the historical saved text nor a CP is edited.
        let mut comparison = original.clone();
        comparison["transport_epoch"] = json!(proof.transport_ack.epoch);
        if comparison["native_pair"]["audio"]["has_route_programs"] == true {
            verify_receiving_derivative(&comparison, &pre)?;
        } else if !same_management_wire(&comparison, &pre)? {
            return Err("selected source re-adoption changed nonderivative saved state".into());
        }
        let index = self.before_source_index(performance)?;
        let asset = &performance.native_sources[index];
        let basis = performance
            .bases
            .iter()
            .find(|b| b.content_digest == asset.basis_digest())
            .ok_or("resident before musical basis absent")?;
        asset.validate_basis(basis)?;
        if proof.before.identity != basis.identity
            || proof.before.basis_digest != basis.content_digest
            || self.before_source["reading"]["samples_elapsed"]
                != before["native_pair"]["audio"]["cursor"]
            || self.before_source["reading"]["accepted_sequence"]
                != before["native_pair"]["audio"]["accepted_sequence"]
            || self.before_source["reading"]["transport_epoch"] != before["transport_epoch"]
        {
            return Err(
                "original resident before body/cursor/epoch was relabeled to selected cut".into(),
            );
        }
        let pulse = &self.before_restoration_receipt;
        if pulse["schema"] != "ql.performance-worker-reply/v1"
            || pulse["accepted"] != true
            || pulse["payload"]["checkpoint_after_pulse_wire"]
                != self.source_readoption["before_checkpoint_wire"]
            || !exact_native_value(&pulse["reading"], &self.before_source["reading"])
        {
            return Err("actual before-restoration pulse/checkpoint/source reading lost".into());
        }
        crate::expression_performance_readmission::qualify_retained_source_projection(
            performance,
            &self.original_checkpoint,
            &self.selected_source_projection,
            self.selection["scene_ref"]
                .as_str()
                .ok_or("selected original Scene ref absent")?,
        )?;
        let index = self.selected_source_projection["source_index"]
            .as_u64()
            .ok_or("selected source epoch index absent")? as usize;
        let asset = performance
            .native_sources
            .get(index)
            .ok_or("selected original source epoch absent")?;
        let bundle = asset.native_bundle();
        if asset.basis_digest() != proof.saved.basis_digest
            || !exact_native_value(
                &self.source_readoption["actual_native_basis"],
                &bundle["native_basis"],
            )
            || !exact_native_value(
                &self.source_readoption["current_source_packet"],
                &bundle["current_receiving"]["native_admission"]["native_preparation"],
            )
            || !exact_native_value(
                &self.source_readoption["current_receiving"]["source_inputs"],
                &bundle["receiving_source_inputs"],
            )
            || !exact_native_value(
                &self.source_readoption["current_receiving"]["source_context"],
                &bundle["source_context"],
            )
            || !exact_native_value(
                &self.source_readoption["current_receiving"]["receiving_definition"],
                &bundle["receiving_definition"],
            )
        {
            return Err(
                "selected source readoption lost whole original native source/context/occasion"
                    .into(),
            );
        }
        if saved_acoustic
            && !exact_native_value(
                &self.source_readoption["original_saved_acoustic"],
                &bundle["acoustic_receiving"]["packet"],
            )
        {
            return Err("source readoption changed original acoustic history packet".into());
        }
        let native = &self.native_pulse;
        let history: Vec<crate::expression_performance_management::InputHistoryEntry> =
            serde_json::from_value(native["input_history"].clone()).map_err(|e| e.to_string())?;
        if native["schema"] != "ql.performance-worker-reply/v1"
            || native["operation"] != "selected-source-readoption"
            || native["accepted"] != true
            || !exact_native_value(
                &native["payload"]["source_readoption"],
                &self.source_readoption,
            )
            || !exact_native_value(
                &native["payload"]["transport_ack"],
                &serde_json::to_value(&proof.transport_ack).map_err(|e| e.to_string())?,
            )
            || !exact_native_value(&native["applications"], &json!(proof.restored_applications))
            || history != proof.restored_input_history
            || count(&native["reading"]["samples_elapsed"])? != proof.after.sample
            || count(&native["reading"]["transport_epoch"])? != proof.transport_ack.epoch
            || count(&native["last_input_ordinal"])?
                != proof
                    .after
                    .management
                    .as_ref()
                    .ok_or("source after native journal absent")?
                    .input_history
                    .last_ordinal
        {
            return Err("source re-adoption lost actual sole native observer pulse/ACK".into());
        }
        crate::expression_performance_reservation::verify_restored_observer_feedback_same_epoch(
            &pre,
            &after,
            proof.transport_ack.epoch,
            &proof.restored_applications,
            &proof.restored_input_history,
        )
    }
}
