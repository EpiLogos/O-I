//! Accepted author-score occurrences retain their original timing/identity.
//! Queue acceptance is not a performed event. Only actual callback receipts
//! reconcile executed/refused states. The existing Scene/Act CAS owns edits.
use crate::expression_performance::{
    CheckpointBinding, Counter, EventAction, ModulationRoute, ParameterTarget, Performance, Scalar,
    TimedEvent,
};
use crate::expression_performance_recording::{NativeApplication, ParameterBinding};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
pub const SCHEMA: &str = "oi.expression-native-score-reservation/v1";
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeScoreReservation {
    schema: String,
    pub transport_epoch: Counter,
    pub native_sequence: Counter,
    pub recorded_sequence: Counter,
    pub queue_receipt_cursor: Counter,
    pub effective_sample: Counter,
    pub basis_digest: String,
    pub body_revision: Counter,
    pub checkpoint_ref: String,
    pub original_occurrence: TimedEvent,
    pub source_parameter: Option<ParameterTarget>,
    pub source_route: Option<ModulationRoute>,
    pub native_operation: Value,
}
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReservationStanding {
    Queued,
    Executed,
    Refused,
    Cancelled,
    Lost,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ReservationApplication {
    pub reservation: NativeScoreReservation,
    pub standing: ReservationStanding,
    pub application_ordinal: Counter,
    pub applied_sample: Counter,
    pub committed_cursor: Counter,
}
fn count(value: &Value) -> Result<Counter, String> {
    serde_json::from_value(value.clone()).map_err(|e| e.to_string())
}
// A declared native Scalar is a finite binary64 operand, not a JSON-token
// identity. Original native operation/receipt bytes remain stored unchanged.
fn same_native_scalar(actual: &Value, expected: Scalar) -> bool {
    actual.is_number()
        && serde_json::from_value::<Scalar>(actual.clone()).is_ok_and(|value| value == expected)
}
fn same_native_note(
    actual: &Value,
    expected: &crate::expression_performance_management::NativeNoteTarget,
) -> bool {
    same_native_scalar(&actual["fundamental_hz"], expected.fundamental_hz)
        && same_native_scalar(&actual["hertz"], expected.hertz)
        && same_native_scalar(&actual["phase_sin"], expected.phase_sin)
        && same_native_scalar(&actual["phase_cos"], expected.phase_cos)
        && serde_json::from_value::<crate::expression_performance_management::NativeNoteTarget>(
            actual.clone(),
        )
        .is_ok_and(|value| value == *expected)
}
impl NativeScoreReservation {
    /// Original requested time belongs to native admission, independently of
    /// the resolved deadline. Historical absence stays explicitly unavailable.
    pub fn require_requested_sample(&self) -> Result<Counter, String> {
        count(
            self.native_operation
                .get("requested_sample")
                .ok_or("original reserved native requested time unavailable")?,
        )
    }

    /// The native resolved occurrence is the operative score operand while
    /// pending. Original authored timing remains in original_occurrence and
    /// requested_sample; a late release must not precede its original attack
    /// in the current replay score. This does not manufacture an application.
    pub fn queued_occurrence(&self) -> Result<TimedEvent, String> {
        let delay = self.source_route.as_ref().map_or(0, |r| r.delay_samples.0);
        let mut queued = self.original_occurrence.clone();
        queued.1 = Counter(
            self.effective_sample
                .0
                .checked_sub(delay)
                .ok_or("resolved reservation precedes original route delay")?,
        );
        Ok(queued)
    }

    pub fn validate(&self, performance: &Performance) -> Result<(), String> {
        let operation = &self.native_operation;
        let event = &self.original_occurrence;
        if operation["kind"] == json!(5) {
            let native_parameter: u8 = serde_json::from_value(operation["parameter"].clone())
                .map_err(|e| e.to_string())?;
            let (field, unit) =
                crate::expression_performance_recording::parameter_field(native_parameter)?;
            let target = match &event.4 {
                EventAction::Parameter(_, value, _) => {
                    let target = self
                        .source_parameter
                        .as_ref()
                        .ok_or("original reservation parameter absent")?;
                    if self.source_route.is_some()
                        || !same_native_scalar(&operation["value"], *value)
                    {
                        return Err("original reserved parameter operand differs".into());
                    }
                    target
                }
                EventAction::Automation(_, value, _) => {
                    let route = self
                        .source_route
                        .as_ref()
                        .ok_or("original reservation route absent")?;
                    if self.source_parameter.is_some()
                        || !route.enabled
                        || !same_native_scalar(&operation["value"], route.effective(*value)?)
                    {
                        return Err("original reserved automation operand differs".into());
                    }
                    &route.destination
                }
                _ => return Err("reserved parameter has no native target".into()),
            };
            if target.native_owner != "ql.performance.Engine"
                || target.action_ref != "ql:native-performance/parameter"
                || target.target_ref
                    != format!("ql:performance/parameter/{}", field.replace('_', "-"))
                || target.unit != unit
                || target.scope != crate::expression_performance::Scope::Instrument
            {
                return Err("reserved parameter lost native owner/field/unit".into());
            }
        }
        let basis = performance
            .bases
            .get(self.original_occurrence.basis())
            .ok_or("reservation basis absent")?;
        let identity =
            serde_json::to_value(crate::expression_performance_management::NativeIdentity {
                instance: basis.identity.instance_ref.clone(),
                event: basis.identity.event_ref.clone(),
                subject: basis.identity.subject_ref.clone(),
                m1_revision: basis.identity.m1_revision,
                m2_generation: basis.identity.m2_generation,
            })
            .map_err(|e| e.to_string())?;
        if self.schema != SCHEMA
            || self.transport_epoch.0 == 0
            || self.native_sequence.0 == 0
            || self.recorded_sequence != self.original_occurrence.0
            || self.recorded_sequence.0 == 0
            || self.basis_digest != basis.content_digest
            || self.native_operation["identity"] != identity
            || count(&self.native_operation["sequence"])? != self.native_sequence
            || count(&self.native_operation["sample"])? != self.effective_sample
            || (self.queue_receipt_cursor > self.effective_sample
                && !(self.native_operation["late_admitted"] == true
                    && self.native_operation["kind"]
                        .as_u64()
                        .is_some_and(|k| k == 1 || k == 4)))
            || self.checkpoint_ref.is_empty()
            || count(&basis.audio_determination["body_revision"])? != self.body_revision
        {
            return Err(
                "accepted score reservation lost original occurrence/native source/body/cursor"
                    .into(),
            );
        }
        let delay = match &self.original_occurrence.4 {
            EventAction::Automation(_, _, _) => {
                self.source_route
                    .as_ref()
                    .ok_or("original reservation route absent")?
                    .delay_samples
                    .0
            }
            _ => 0,
        };
        if operation["kind"] != json!(5)
            && (self.source_parameter.is_some() || self.source_route.is_some())
        {
            return Err("nonparameter reservation carries unrelated route authority".into());
        }
        let original_request = self
            .original_occurrence
            .sample()
            .checked_add(delay)
            .ok_or("original reservation route timing overflow")?;
        match operation.get("requested_sample") {
            Some(value) => {
                let requested = count(value)?;
                if requested.0 != original_request
                    || requested > self.effective_sample
                    || (requested < self.effective_sample
                        && (operation["late_admitted"] != true
                            || !matches!(operation["kind"].as_u64(), Some(1 | 4))))
                {
                    return Err(
                        "reservation lost original requested time or resolved native deadline"
                            .into(),
                    );
                }
            }
            None if original_request == self.effective_sample.0 => {}
            None => return Err("late reserved original native requested time unavailable".into()),
        }
        Ok(())
    }
    pub fn reconcile(
        &self,
        application: &NativeApplication,
    ) -> Result<ReservationApplication, String> {
        let requested = self
            .native_operation
            .get("requested_sample")
            .map(count)
            .transpose()?;
        if requested != application.requested_sample
            || requested.is_some_and(|sample| {
                sample > self.effective_sample
                    || (sample < self.effective_sample && !application.late_admitted)
            })
            || self.native_operation["late_admitted"] != json!(application.late_admitted)
            || application.sequence != self.native_sequence
            || application.admitted_sample != self.effective_sample
            || application.body_revision != self.body_revision
            || application.identity
                != serde_json::from_value(self.native_operation["identity"].clone())
                    .map_err(|e| e.to_string())?
            || self.native_operation["kind"] != json!(application.kind)
            || application.applied_sample < self.effective_sample
            || application.committed_cursor <= application.applied_sample
        {
            return Err(
                "reserved score application differs from actual accepted operation/source/cursor"
                    .into(),
            );
        }
        for (key, value) in [
            ("touch", json!(application.touch)),
            ("parameter", json!(application.parameter)),
        ] {
            if self.native_operation.get(key).is_some_and(|v| v != &value) {
                return Err(format!("reserved native operation operand differs: {key}"));
            }
        }
        for (key, value) in [
            ("value", application.value),
            ("pitch_hz", application.pitch_hz),
        ] {
            if self
                .native_operation
                .get(key)
                .is_some_and(|actual| !same_native_scalar(actual, value))
            {
                return Err(format!("reserved native operation operand differs: {key}"));
            }
        }
        if self.native_operation.get("note").is_some_and(|note| {
            application
                .note
                .as_ref()
                .is_none_or(|a| !same_native_note(note, a))
        }) {
            return Err("reserved actual native note target differs".into());
        }
        Ok(ReservationApplication {
            reservation: self.clone(),
            standing: if application.applied {
                ReservationStanding::Executed
            } else {
                ReservationStanding::Refused
            },
            application_ordinal: application.applied_application_ordinal,
            applied_sample: application.applied_sample,
            committed_cursor: application.committed_cursor,
        })
    }
}
/// Full actual stopped checkpoint supplies the accepted queued native operation.
/// Every mapping must already name an existing authored occurrence. No sample,
/// operation ID, source identity or acceptance is created by this function.
pub fn reserve_checkpoint(
    performance: &Performance,
    checkpoint: &CheckpointBinding,
    parameters: &[ParameterBinding],
) -> Result<Vec<NativeScoreReservation>, String> {
    reserve_checkpoint_occurrences(performance, checkpoint, parameters, &[])
}

/// Native acceptance resolves timing; the author retains the original request.
/// Late occurrences therefore require an explicit original mapping, qualified
/// by the complete actual stopped queue. Every supplied mapping must be used
/// exactly once and differ from the operative occurrence only in its sample.
pub fn reserve_checkpoint_occurrences(
    performance: &Performance,
    checkpoint: &CheckpointBinding,
    parameters: &[ParameterBinding],
    original_occurrences: &[TimedEvent],
) -> Result<Vec<NativeScoreReservation>, String> {
    performance.validate()?;
    checkpoint.validate()?;
    if original_occurrences.len() > 320 {
        return Err("original reservation mappings exceed native queue bound".into());
    }
    let mut originals = BTreeMap::new();
    for original in original_occurrences {
        if originals.insert(original.0, original).is_some() {
            return Err("duplicate original authored reservation mapping".into());
        }
    }
    let epoch = checkpoint
        .management
        .as_ref()
        .ok_or("native management custody required for reservation")?
        .transport_epoch;
    let mut operations = BTreeMap::new();
    for (path, key) in [
        ("/operations/entries", None),
        ("/releases/entries", None),
        ("/pending_operations", Some("operation")),
        ("/pending_releases", Some("release")),
    ] {
        for entry in checkpoint
            .audio
            .pointer(path)
            .and_then(Value::as_array)
            .ok_or("native pending queue absent")?
        {
            let operation = key.map_or(entry, |key| &entry[key]);
            if operations
                .insert(count(&operation["sequence"])?, operation)
                .is_some()
            {
                return Err("duplicate native pending operation".into());
            }
        }
    }
    let mut result = Vec::new();
    for mapping in &checkpoint.queued_events {
        let event = performance
            .events()
            .find(|e| e.0 == mapping.recorded_sequence)
            .ok_or("accepted future authored occurrence missing")?;
        let operation = *operations
            .get(&mapping.native_sequence)
            .ok_or("accepted native operation missing")?;
        // Actual prepared automation must use its exact native parameter/result;
        // no route label is promoted into an accepted callback operation.
        match (&event.4, operation["kind"].as_u64()) {
            (EventAction::Parameter(index, value, _), Some(5)) => {
                let matching: Vec<_> = parameters
                    .iter()
                    .filter(|p| p.performance_parameter == *index)
                    .collect();
                if matching.len() != 1
                    || operation["parameter"] != json!(matching[0].native_parameter)
                    || !same_native_scalar(&operation["value"], *value)
                {
                    return Err("reserved native parameter target/value differs".into());
                }
            }
            (EventAction::Automation(index, value, _), Some(5)) => {
                let route = performance
                    .routes
                    .get(usize::from(*index))
                    .ok_or("reserved native route absent")?;
                let matching: Vec<_> = parameters
                    .iter()
                    .filter(|p| {
                        performance
                            .parameters
                            .get(usize::from(p.performance_parameter))
                            == Some(&route.destination)
                    })
                    .collect();
                if !route.enabled
                    || matching.len() != 1
                    || operation["parameter"] != json!(matching[0].native_parameter)
                    || !same_native_scalar(&operation["value"], route.effective(*value)?)
                {
                    return Err(
                        "reserved native automation source/transfer/destination differs".into(),
                    );
                }
            }
            (EventAction::NoteOn(touch, member, index, velocity, sine, cosine), Some(0)) => {
                let pitch = performance
                    .pitches
                    .get(usize::from(*index))
                    .ok_or("reserved pitch unavailable")?;
                let note = &operation["note"];
                if note["touch"] != json!(touch)
                    || note["member"] != json!(member)
                    || !same_native_scalar(&note["hertz"], pitch.hertz)
                    || !same_native_scalar(&note["phase_sin"], *sine)
                    || !same_native_scalar(&note["phase_cos"], *cosine)
                    || !same_native_scalar(&operation["value"], *velocity)
                {
                    return Err("reserved source-qualified note/touch/phase differs".into());
                }
            }
            (EventAction::NoteOff(touch), Some(1)) if operation["touch"] == json!(touch) => {}
            (EventAction::Expression(touch, pressure, hertz), Some(3))
                if operation["touch"] == json!(touch)
                    && same_native_scalar(&operation["value"], *pressure)
                    && (same_native_scalar(&operation["pitch_hz"], *hertz)
                        || same_native_scalar(&operation["pitch_hz"], Scalar::new(0.0)?)) => {}
            (EventAction::Sustain(down), Some(2))
                if same_native_scalar(
                    &operation["value"],
                    Scalar::new(if *down { 1.0 } else { 0.0 })?,
                ) => {}
            (EventAction::Panic, Some(4)) => {}
            _ => {
                return Err(
                    "accepted future operation has no exact authored native operand".into(),
                );
            }
        }
        let basis = performance
            .bases
            .get(event.basis())
            .ok_or("reservation basis absent")?;
        let reservation = NativeScoreReservation {
            schema: SCHEMA.into(),
            transport_epoch: epoch,
            native_sequence: mapping.native_sequence,
            recorded_sequence: event.0,
            queue_receipt_cursor: checkpoint.sample,
            effective_sample: mapping.effective_sample,
            basis_digest: basis.content_digest.clone(),
            body_revision: count(&checkpoint.audio["determination"]["body_revision"])?,
            checkpoint_ref: checkpoint.checkpoint_ref.clone(),
            original_occurrence: originals.remove(&event.0).unwrap_or(event).clone(),
            source_parameter: match &event.4 {
                EventAction::Parameter(index, _, _) => {
                    performance.parameters.get(usize::from(*index)).cloned()
                }
                _ => None,
            },
            source_route: match &event.4 {
                EventAction::Automation(index, _, _) => {
                    performance.routes.get(usize::from(*index)).cloned()
                }
                _ => None,
            },
            native_operation: operation.clone(),
        };
        reservation.validate(performance)?;
        if reservation.queued_occurrence()? != *event {
            return Err("original authored reservation differs from resolved occurrence".into());
        }
        result.push(reservation);
    }
    if !originals.is_empty() {
        return Err("original authored reservation has no actual queued operation".into());
    }
    Ok(result)
}
pub fn validate_pending(performance: &Performance) -> Result<(), String> {
    if performance.native_reservations.len() > 320 {
        return Err("native accepted reservation queue exceeds actual owner bound".into());
    }
    let mut operations = BTreeSet::new();
    let mut occurrences = BTreeSet::new();
    for r in &performance.native_reservations {
        r.validate(performance)?;
        let current_operand_matches = match &r.original_occurrence.4 {
            EventAction::Parameter(index, _, _) => {
                performance.parameters.get(usize::from(*index)) == r.source_parameter.as_ref()
            }
            EventAction::Automation(index, _, _) => {
                performance.routes.get(usize::from(*index)) == r.source_route.as_ref()
            }
            _ => true,
        };
        if !current_operand_matches {
            return Err(
                "native queued reservation route/parameter changed before reconciliation".into(),
            );
        }
        let queued = r.queued_occurrence()?;
        if !operations.insert((r.transport_epoch, r.native_sequence))
            || !occurrences.insert(r.recorded_sequence)
            || !performance.events().any(|e| e == &queued)
        {
            return Err(
                "native reservation duplicated or authored occurrence altered while pending".into(),
            );
        }
    }
    Ok(())
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeTransportAcknowledgement {
    pub previous_epoch: Counter,
    pub epoch: Counter,
    pub previous_cursor: Counter,
    pub previous_sequence: Counter,
    pub target_sample: Counter,
    pub accepted_sequence: Counter,
    pub transaction_ref: String,
    pub checkpoint_ref: String,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeReservationTermination {
    pub standing: ReservationStanding,
    pub reservations: Vec<NativeScoreReservation>,
    pub before: CheckpointBinding,
    pub after: CheckpointBinding,
    pub transport_ack: Option<NativeTransportAcknowledgement>,
}
fn pending(checkpoint: &CheckpointBinding) -> Result<BTreeSet<Counter>, String> {
    let mut result = BTreeSet::new();
    for (path, key) in [
        ("/operations/entries", None),
        ("/releases/entries", None),
        ("/pending_operations", Some("operation")),
        ("/pending_releases", Some("release")),
    ] {
        for entry in checkpoint
            .audio
            .pointer(path)
            .and_then(Value::as_array)
            .ok_or("native pending queue absent")?
        {
            let op = key.map_or(entry, |key| &entry[key]);
            result.insert(count(&op["sequence"])?);
        }
    }
    Ok(result)
}
impl NativeReservationTermination {
    /// Existing stopped native restore owner supplies its REAL acknowledgement
    /// and full before/after paired state. No enqueue/panic ACK is cancellation.
    pub fn cancelled(
        performance: &Performance,
        before: CheckpointBinding,
        after: CheckpointBinding,
        ack: NativeTransportAcknowledgement,
    ) -> Result<Self, String> {
        let previous = before
            .management
            .as_ref()
            .ok_or("native input custody absent")?
            .transport_epoch;
        let after_pending = pending(&after)?;
        let reservations = performance
            .native_reservations
            .iter()
            .filter(|r| {
                r.transport_epoch == previous && !after_pending.contains(&r.native_sequence)
            })
            .cloned()
            .collect();
        let value = Self {
            standing: ReservationStanding::Cancelled,
            reservations,
            before,
            after,
            transport_ack: Some(ack),
        };
        value.validate(performance)?;
        Ok(value)
    }
    /// Explicit native queue loss preserves evidence, and refuses performed
    /// replay. Only the exact first_failed_sequence can be identified as lost;
    /// unknown missing identities are not relabelled cancelled or executed.
    pub fn lost(
        performance: &Performance,
        before: CheckpointBinding,
        after: CheckpointBinding,
    ) -> Result<Self, String> {
        let failed = count(&after.audio["recording"]["first_failed_sequence"])?;
        let epoch = before
            .management
            .as_ref()
            .ok_or("native input custody absent")?
            .transport_epoch;
        let reservations = performance
            .native_reservations
            .iter()
            .filter(|r| r.transport_epoch == epoch && r.native_sequence == failed)
            .cloned()
            .collect();
        let value = Self {
            standing: ReservationStanding::Lost,
            reservations,
            before,
            after,
            transport_ack: None,
        };
        value.validate(performance)?;
        Ok(value)
    }
    pub fn validate(&self, performance: &Performance) -> Result<(), String> {
        self.before.validate()?;
        self.after.validate()?;
        let before_epoch = self
            .before
            .management
            .as_ref()
            .ok_or("before native input custody absent")?
            .transport_epoch;
        let after_epoch = self
            .after
            .management
            .as_ref()
            .ok_or("after native input custody absent")?
            .transport_epoch;
        let before_pending = pending(&self.before)?;
        let after_pending = pending(&self.after)?;
        if self.reservations.is_empty()
            || self.reservations.len() > 320
            || self.before.identity != self.after.identity
            || self.before.basis_digest != self.after.basis_digest
            || self.before.physical["basis"] != self.after.physical["basis"]
        {
            return Err("reservation termination lost exact common source/body identity".into());
        }
        match self.standing {
            ReservationStanding::Cancelled => {
                let ack = self
                    .transport_ack
                    .as_ref()
                    .ok_or("actual native transport acknowledgement absent")?;
                if ack.previous_epoch != before_epoch
                    || ack.epoch != after_epoch
                    || ack.epoch.0
                        != ack
                            .previous_epoch
                            .0
                            .checked_add(1)
                            .ok_or("transport epoch exhausted")?
                    || ack.previous_cursor != self.before.sample
                    || ack.target_sample != self.after.sample
                    || ack.previous_sequence != count(&self.before.audio["accepted_sequence"])?
                    || ack.accepted_sequence != count(&self.after.audio["accepted_sequence"])?
                    || ack.checkpoint_ref != self.after.checkpoint_ref
                    || ack.transaction_ref.is_empty()
                {
                    return Err(
                        "reservation cancellation lacks exact native restore acknowledgement"
                            .into(),
                    );
                }
            }
            ReservationStanding::Lost => {
                if self.transport_ack.is_some()
                    || before_epoch != after_epoch
                    || self.after.sample <= self.before.sample
                    || self.after.audio["recording"]["failure"]
                        .as_u64()
                        .is_none_or(|v| v == 0)
                    || count(&self.after.audio["recording"]["dropped_applications"])?.0 == 0
                {
                    return Err("reservation loss lacks actual native recording failure".into());
                }
            }
            _ => return Err("terminal reservation has no native cancellation/loss proof".into()),
        }
        let mut ids = BTreeSet::new();
        for r in &self.reservations {
            r.validate(performance)?;
            if r.basis_digest != self.before.basis_digest
                || performance.bases[r.original_occurrence.basis()].identity != self.before.identity
                || r.transport_epoch != before_epoch
                || !before_pending.contains(&r.native_sequence)
                || after_pending.contains(&r.native_sequence)
                || !ids.insert(r.native_sequence)
            {
                return Err("terminal reservation differs from actual before/after queues".into());
            }
            if self.standing == ReservationStanding::Lost
                && count(&self.after.audio["recording"]["first_failed_sequence"])?
                    != r.native_sequence
            {
                return Err("lost native operation identity is not known".into());
            }
            if self.after.audio["applications"]["entries"]
                .as_array()
                .is_some_and(|apps| {
                    apps.iter()
                        .any(|a| a["sequence"] == json!(r.native_sequence))
                })
            {
                return Err("an actual retained application cannot become cancelled/lost".into());
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod scalar_operand_tests {
    use super::*;

    #[test]
    fn declared_native_scalar_uses_exact_finite_bits_not_number_spelling() {
        for (token, expected) in [
            ("0.80000000000000004", 0.8),
            ("0.86602540378443915", 0.8660254037844392),
            ("0.20000000000000001", 0.2),
        ] {
            let actual: Value = serde_json::from_str(token).unwrap();
            let expected = Scalar::new(expected).unwrap();
            assert!(same_native_scalar(&actual, expected));
            let next = Scalar::new(f64::from_bits(expected.value().to_bits() + 1)).unwrap();
            assert!(!same_native_scalar(&actual, next));
        }
        let expected = Scalar::new(0.8).unwrap();
        for token in ["null", "true", "\"0.8\"", "[]", "{}", "1e400"] {
            let actual: Value = serde_json::from_str(token).unwrap();
            assert!(!same_native_scalar(&actual, expected));
        }
        for actual in [
            json!({"$serde_json::private::Number": "0.8"}),
            json!({"$serde_json::private::RawValue": "0.8"}),
        ] {
            assert!(!same_native_scalar(&actual, expected));
        }
        // Preserve Scalar::new's original explicit signed-zero canonicalization;
        // no global Value equality or stored native number token is changed.
        assert!(same_native_scalar(&json!(-0.0), Scalar::new(0.0).unwrap()));
    }
}
