//! Lossless native input custody beside the existing A/P checkpoint.
//! The native pair is stored once by CheckpointBinding. This typed addition
//! retains the complete management wrapper and reconstructs its exact wire.
//! The resident native owner still validates and atomically restores A/P and
//! bindings; this parser never authorizes audio from a browser JSON object.
use crate::expression_performance::{CheckpointBinding, Counter, Scalar};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;

fn native_scalar<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Scalar, D::Error> {
    Scalar::from_native_wire(f64::deserialize(d)?).map_err(serde::de::Error::custom)
}
pub const SCHEMA: &str = "ql.performance-management-checkpoint/v1";
const MAX_INPUTS: usize = 96;
const MAX_HISTORY: usize = 256;

fn printable(s: &str) -> Result<(), String> {
    if s.trim().is_empty() || s.len() >= 256 || s.chars().any(char::is_control) {
        return Err("bounded original native input reference required".into());
    }
    Ok(())
}
fn count(value: &Value, path: &str) -> Result<Counter, String> {
    serde_json::from_value(
        value
            .pointer(path)
            .ok_or("native input counter absent")?
            .clone(),
    )
    .map_err(|e| e.to_string())
}
fn array<'a>(value: &'a Value, path: &str) -> Result<&'a Vec<Value>, String> {
    value
        .pointer(path)
        .and_then(Value::as_array)
        .ok_or_else(|| format!("native input array absent: {path}"))
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeIdentity {
    pub instance: String,
    pub event: String,
    pub subject: String,
    pub m1_revision: Counter,
    pub m2_generation: Counter,
}
impl NativeIdentity {
    fn validate_lineage(&self, checkpoint: &CheckpointBinding) -> Result<(), String> {
        for s in [&self.instance, &self.event, &self.subject] {
            printable(s)?;
        }
        if self.instance != checkpoint.identity.instance_ref
            || self.event != checkpoint.identity.event_ref
            || self.subject != checkpoint.identity.subject_ref
            || self.m1_revision > count(&checkpoint.audio, "/producer_identity/m1_revision")?
            || self.m2_generation > count(&checkpoint.audio, "/producer_identity/m2_generation")?
        {
            return Err("original input lost its native source lineage".into());
        }
        Ok(())
    }
}
/// Exact original KeyTouch, independent of a later expression pitch or current
/// determination. Source face is independent of the canonical key face.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeNoteTarget {
    pub identity: NativeIdentity,
    pub source_coordinate: String,
    pub tuning_ref: String,
    pub touch_ref: String,
    pub member: Counter,
    pub touch: Counter,
    pub ratio_numerator: Counter,
    pub ratio_denominator: Counter,
    pub key: u8,
    pub position: u8,
    pub coordinate_face: u8,
    pub source_face: u8,
    pub pitch_class: u8,
    pub register_octave: i8,
    #[serde(deserialize_with = "native_scalar")]
    pub fundamental_hz: Scalar,
    #[serde(deserialize_with = "native_scalar")]
    pub hertz: Scalar,
    #[serde(deserialize_with = "native_scalar")]
    pub phase_sin: Scalar,
    #[serde(deserialize_with = "native_scalar")]
    pub phase_cos: Scalar,
    pub exact_ratio: bool,
}
impl NativeNoteTarget {
    fn validate(
        &self,
        state: &ManagementState,
        checkpoint: &CheckpointBinding,
    ) -> Result<(), String> {
        self.identity.validate_lineage(checkpoint)?;
        for s in [&self.source_coordinate, &self.tuning_ref, &self.touch_ref] {
            printable(s)?;
        }
        let rate = checkpoint.audio["sample_rate"]
            .as_f64()
            .ok_or("native sample rate absent")?;
        let quadrature = self.phase_sin.value().powi(2) + self.phase_cos.value().powi(2);
        if self.member.0 == 0
            || self.touch.0 == 0
            || self.member > state.input_history.last_member_token
            || self.touch > state.input_history.last_touch_token
            || self.key >= 12
            || self.position != self.key / 2
            || self.coordinate_face != self.key % 2
            || self.source_face > 1
            || self.pitch_class >= 12
            || self.fundamental_hz.value() < 0.001
            || self.hertz.value() < 0.001
            || self.hertz.value() > rate * 0.45
            || (quadrature - 1.0).abs() > 1e-10
        {
            return Err("original native input target is invalid".into());
        }
        if self.exact_ratio {
            if self.ratio_numerator.0 == 0 || self.ratio_denominator.0 == 0 {
                return Err("original exact tuning ratio was lost".into());
            }
            let hz = self.fundamental_hz.value() * self.ratio_numerator.0 as f64
                / self.ratio_denominator.0 as f64;
            if (hz - self.hertz.value()).abs() > self.hertz.value() * 1e-11 {
                return Err("original native ratio and pitch differ".into());
            }
        } else if self.ratio_numerator.0 != 0 || self.ratio_denominator.0 != 0 {
            return Err("approximate pitch cannot acquire an invented exact ratio".into());
        }
        Ok(())
    }
    fn is_same(&self, value: &Value) -> bool {
        serde_json::from_value::<Self>(value.clone()).is_ok_and(|v| v == *self)
    }
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct InputBinding {
    pub slot: u8,
    pub input_ref: String,
    pub target: NativeNoteTarget,
    pub release_pending: bool,
    pub press_applied: bool,
    pub press_sequence: Counter,
    pub release_sequence: Counter,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct InputHistoryEntry {
    pub ordinal: Counter,
    pub native_sequence: Counter,
    /// 0 press-admitted, 1 release-admitted, 2 applied, 3 refused, 4 retired.
    /// Retirement records native lifetime end; it does not synthesize NoteOff.
    pub change: u8,
    pub operation: u8,
    pub input_ref: String,
    pub target: NativeNoteTarget,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct InputHistory {
    pub read: Counter,
    pub write: Counter,
    pub last_ordinal: Counter,
    pub last_touch_token: Counter,
    pub last_member_token: Counter,
    pub entries: Vec<InputHistoryEntry>,
}
/// The exact management wire except native_pair, already retained once by the
/// existing checkpoint owner. Old paired-only editions use None unchanged.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ManagementState {
    schema: String,
    pub session_ref: String,
    pub transport_epoch: Counter,
    pub recording_failed: bool,
    pub release_pending: bool,
    pub panic_applied: bool,
    pub release_request: Counter,
    pub release_sequence: Counter,
    pub release_proof_cursor: Counter,
    pub inputs: Vec<InputBinding>,
    pub input_history: InputHistory,
}
impl ManagementState {
    pub fn from_wire(wire: Value, checkpoint: &CheckpointBinding) -> Result<Self, String> {
        let mut object = wire
            .as_object()
            .ok_or("complete native management checkpoint required")?
            .clone();
        if object
            .remove("native_pair")
            .ok_or("native management pair was lost")?
            != checkpoint.native_pair_wire()?
        {
            return Err("native management and retained pair differ".into());
        }
        let state: Self =
            serde_json::from_value(Value::Object(object)).map_err(|e| e.to_string())?;
        state.validate_against(checkpoint)?;
        Ok(state)
    }
    pub fn wire(&self, checkpoint: &CheckpointBinding) -> Result<Value, String> {
        self.validate_against(checkpoint)?;
        let mut value = serde_json::to_value(self).map_err(|e| e.to_string())?;
        value
            .as_object_mut()
            .ok_or("management state object absent")?
            .insert("native_pair".into(), checkpoint.native_pair_wire()?);
        Ok(value)
    }
    pub fn validate_against(&self, checkpoint: &CheckpointBinding) -> Result<(), String> {
        if self.schema != SCHEMA || self.transport_epoch.0 == 0 || self.inputs.len() > MAX_INPUTS {
            return Err("native management schema/epoch/input bound differs".into());
        }
        printable(&self.session_ref)?;
        let accepted = count(&checkpoint.audio, "/accepted_sequence")?;
        let emergency = count(&checkpoint.audio, "/release_proof/emergency_requested")?;
        if self.release_request > emergency
            || self.release_sequence > accepted
            || self.release_proof_cursor > checkpoint.sample
            || (self.panic_applied && self.release_sequence.0 == 0)
            || (self.release_pending && self.release_proof_cursor.0 != 0)
            || (self.release_request.0 != 0 && self.release_sequence.0 != 0)
        {
            return Err("native release acknowledgement was lost or invented".into());
        }
        let history = &self.input_history;
        let outstanding = history
            .write
            .0
            .checked_sub(history.read.0)
            .ok_or("native input journal regressed")?;
        if outstanding > MAX_HISTORY as u64
            || outstanding as usize != history.entries.len()
            || history.last_ordinal != history.write
        {
            return Err("native input journal has a gap or overflow".into());
        }
        let mut slots = BTreeSet::new();
        let mut refs = BTreeSet::new();
        let mut touches = BTreeSet::new();
        for input in &self.inputs {
            printable(&input.input_ref)?;
            input.target.validate(self, checkpoint)?;
            if usize::from(input.slot) >= MAX_INPUTS
                || !slots.insert(input.slot)
                || !refs.insert(&input.input_ref)
                || !touches.insert(input.target.touch)
                || input.press_sequence.0 == 0
                || input.press_sequence > accepted
                || (input.release_pending
                    && (input.release_sequence <= input.press_sequence
                        || input.release_sequence > accepted))
                || (!input.release_pending && input.release_sequence.0 != 0)
                || !known_input(input, &checkpoint.audio)?
            {
                return Err("input binding detached from its original native lifetime".into());
            }
        }
        for (index, entry) in history.entries.iter().enumerate() {
            printable(&entry.input_ref)?;
            entry.target.validate(self, checkpoint)?;
            if entry.ordinal.0
                != history
                    .read
                    .0
                    .checked_add(index as u64 + 1)
                    .ok_or("input journal ordinal overflow")?
                || entry.native_sequence.0 == 0
                || entry.native_sequence > accepted
                || entry.change > 4
                || entry.operation > 6
            {
                return Err("original native input journal is incomplete".into());
            }
        }
        Ok(())
    }
}
fn known_input(input: &InputBinding, audio: &Value) -> Result<bool, String> {
    for touch in array(audio, "/touches")? {
        if input.target.is_same(&touch["original_note"]) {
            return Ok(true);
        }
    }
    for (path, key) in [
        ("/operations/entries", None),
        ("/pending_operations", Some("operation")),
    ] {
        for entry in array(audio, path)? {
            let op = key.map_or(entry, |key| &entry[key]);
            if op["kind"] == 0
                && count(op, "/sequence")? == input.press_sequence
                && input.target.is_same(&op["note"])
            {
                return Ok(true);
            }
        }
    }
    for applied in array(audio, "/applications/entries")? {
        if applied["kind"] == 4
            && applied["applied"] == true
            && count(applied, "/sequence")? >= input.press_sequence
        {
            return Ok(true);
        }
        if count(applied, "/touch")? == input.target.touch && applied["has_note"] == true {
            if applied["kind"] == 0 {
                if input.target.is_same(&applied["note"]) {
                    return Ok(true);
                }
            } else if applied["note"]["member"]
                == serde_json::to_value(input.target.member).map_err(|e| e.to_string())?
                && applied["note"]["touch_ref"] == input.target.touch_ref
            {
                return Ok(true);
            }
        }
    }
    Ok(false)
}
