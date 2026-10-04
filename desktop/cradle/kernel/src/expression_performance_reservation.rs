//! Accepted author-score occurrences retain their original timing/identity.
//! Queue acceptance is not a performed event. Only actual callback receipts
//! reconcile executed/refused states. The existing Scene/Act CAS owns edits.
use crate::expression_performance::{
    CheckpointBinding, Counter, EventAction, ModulationRoute, ParameterTarget, Performance, Scalar,
    TimedEvent, UnscoredQueuedInput,
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
        let epochs = reservation_epochs(performance)?;
        let reservations = performance
            .native_reservations
            .iter()
            .filter(|r| {
                epochs
                    .get(&(r.transport_epoch, r.native_sequence))
                    .copied()
                    .unwrap_or(r.transport_epoch)
                    == previous
                    && !after_pending.contains(&r.native_sequence)
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
        let epochs = reservation_epochs(performance)?;
        let reservations = performance
            .native_reservations
            .iter()
            .filter(|r| {
                epochs
                    .get(&(r.transport_epoch, r.native_sequence))
                    .copied()
                    .unwrap_or(r.transport_epoch)
                    == epoch
                    && r.native_sequence == failed
            })
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
        let epochs = reservation_epochs(performance)?;
        for r in &self.reservations {
            r.validate(performance)?;
            if r.basis_digest != self.before.basis_digest
                || performance.bases[r.original_occurrence.basis()].identity != self.before.identity
                || epochs
                    .get(&(r.transport_epoch, r.native_sequence))
                    .copied()
                    .unwrap_or(r.transport_epoch)
                    != before_epoch
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

/// Complete native stopped restitution proof. Original reservations keep their
/// first admission epoch, requested time, operation ID and authored occurrence.
/// A new application epoch is derived only from these retained native facts.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeReservationContinuation {
    schema: String,
    pub reservations: Vec<NativeScoreReservation>,
    pub saved: CheckpointBinding,
    pub before: CheckpointBinding,
    pub after: CheckpointBinding,
    pub transport_ack: NativeTransportAcknowledgement,
    pub restored_applications: Vec<Value>,
    pub restored_input_history: Vec<crate::expression_performance_management::InputHistoryEntry>,
    /// Old continued-page bytes stay identical. New evidence does not mint a
    /// live restore grant; the private native Manager channel owns admission.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) receiving_readmission:
        Option<Box<crate::expression_performance_readmission::RetainedReceivingReadmission>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) source_readoption: Option<
        Box<crate::expression_performance_source_readoption::RetainedNativeSourceReadoption>,
    >,
}
impl NativeReservationContinuation {
    pub fn from_native(
        performance: &Performance,
        saved: CheckpointBinding,
        before: CheckpointBinding,
        after: CheckpointBinding,
        transport_ack: NativeTransportAcknowledgement,
        restored_applications: Vec<Value>,
        restored_input_history: Vec<crate::expression_performance_management::InputHistoryEntry>,
    ) -> Result<Self, String> {
        Self::from_native_with_source_readoption(
            performance,
            saved,
            before,
            after,
            transport_ack,
            restored_applications,
            restored_input_history,
            None,
        )
    }
    pub(crate) fn from_native_with_source_readoption(
        performance: &Performance,
        saved: CheckpointBinding,
        before: CheckpointBinding,
        after: CheckpointBinding,
        transport_ack: NativeTransportAcknowledgement,
        restored_applications: Vec<Value>,
        restored_input_history: Vec<crate::expression_performance_management::InputHistoryEntry>,
        source_readoption: Option<
            Box<crate::expression_performance_source_readoption::RetainedNativeSourceReadoption>,
        >,
    ) -> Result<Self, String> {
        let saved_epoch = saved
            .management
            .as_ref()
            .ok_or("saved native input custody absent")?
            .transport_epoch;
        let epochs = reservation_epochs(performance)?;
        let pending = pending_operations(&saved)?;
        let reservations = performance
            .native_reservations
            .iter()
            .filter(|r| {
                epochs
                    .get(&(r.transport_epoch, r.native_sequence))
                    .copied()
                    .unwrap_or(r.transport_epoch)
                    == saved_epoch
                    && pending.contains_key(&r.native_sequence)
            })
            .cloned()
            .collect();
        let out = Self {
            schema: "oi.expression-native-reservation-continuation/v1".into(),
            reservations,
            saved,
            before,
            after,
            transport_ack,
            restored_applications,
            restored_input_history,
            receiving_readmission: None,
            source_readoption,
        };
        out.validate(performance)?;
        if out.saved.event_prefix_digest != performance.prefix_digest(out.saved.sample.0)?
            || out.before.event_prefix_digest != performance.prefix_digest(out.before.sample.0)?
        {
            return Err(
                "new native continuation must bind the actual current author-score prefix".into(),
            );
        }
        Ok(out)
    }
    pub fn receiving_readmission(
        &self,
    ) -> Option<&crate::expression_performance_readmission::RetainedReceivingReadmission> {
        self.receiving_readmission.as_deref()
    }
    pub fn source_readoption(
        &self,
    ) -> Option<&crate::expression_performance_source_readoption::RetainedNativeSourceReadoption>
    {
        self.source_readoption.as_deref()
    }
    pub fn validate(&self, performance: &Performance) -> Result<(), String> {
        if let Some(receiving) = &self.receiving_readmission {
            receiving.validate(performance, self)?;
        }
        if self.receiving_readmission.is_some() && self.source_readoption.is_some() {
            return Err(
                "continuation cannot substitute two different native restore operations".into(),
            );
        }
        if let Some(readoption) = &self.source_readoption {
            readoption.validate(performance, self)?;
        }

        self.saved.validate()?;
        self.before.validate()?;
        self.after.validate()?;
        let saved = self.saved.native_management_wire()?;
        let before = self.before.native_management_wire()?;
        let after = self.after.native_management_wire()?;
        let ack = &self.transport_ack;
        if self.schema != "oi.expression-native-reservation-continuation/v1"
            || self.reservations.len() > 320
            || self.restored_applications.len() > 320
            || self.restored_input_history.len() > 320
            || (self.source_readoption.is_none() && self.saved.identity != self.before.identity)
            || self.saved.identity != self.after.identity
            || (self.source_readoption.is_none()
                && self.saved.basis_digest != self.before.basis_digest)
            || self.saved.basis_digest != self.after.basis_digest
            || (self.source_readoption.is_none()
                && self.saved.physical["basis"] != self.before.physical["basis"])
            || ack.previous_epoch != count(&before["transport_epoch"])?
            || ack.epoch != count(&after["transport_epoch"])?
            || ack.epoch.0
                != ack
                    .previous_epoch
                    .0
                    .checked_add(1)
                    .ok_or("native epoch exhausted")?
            || ack.previous_epoch < count(&saved["transport_epoch"])?
            || ack.previous_cursor != self.before.sample
            || ack.target_sample != self.after.sample
            || ack.target_sample != self.saved.sample
            || ack.previous_sequence != count(&self.before.audio["accepted_sequence"])?
            || ack.accepted_sequence != count(&self.after.audio["accepted_sequence"])?
            || ack.accepted_sequence != count(&self.saved.audio["accepted_sequence"])?
            || ack.checkpoint_ref != self.saved.checkpoint_ref
            || self.after.checkpoint_ref != self.saved.checkpoint_ref
            || ack.transaction_ref.is_empty()
        {
            return Err("reservation continuation lost original checkpoint/native transport acknowledgement".into());
        }
        // Once retained, this prefix is a historical fact. Later score edits
        // remain distinct and cannot rewrite its original saved/restored state.
        if self.saved.event_prefix_digest != self.after.event_prefix_digest
            || (self.source_readoption.is_none()
                && self.saved.audio["determination"] != self.before.audio["determination"])
        {
            return Err("native continuation source/original restored score prefix changed".into());
        }
        for path in ["/identity", "/basis", "/units"] {
            if self.source_readoption.is_none()
                && (self.saved.physical.pointer(path).is_none()
                    || self.saved.physical.pointer(path) != self.before.physical.pointer(path))
            {
                return Err(format!(
                    "native continuation before body/source reference changed: {path}"
                ));
            }
        }
        // The ordinary native pulse both drains original FIFO receipts and
        // applies their exact input feedback. No rendered/queued state changes.
        if self.source_readoption.is_none() {
            verify_restored_observer_feedback(
                &saved,
                &after,
                ack.epoch,
                &self.restored_applications,
                &self.restored_input_history,
            )?;
        }
        let mut ids = BTreeSet::new();
        let operations = pending_operations(&self.saved)?;
        for r in &self.reservations {
            r.validate(performance)?;
            if !ids.insert((r.transport_epoch, r.native_sequence))
                || r.basis_digest != self.saved.basis_digest
                || performance.bases[r.original_occurrence.basis()].identity != self.saved.identity
                || operations.get(&r.native_sequence) != Some(&r.native_operation)
            {
                return Err(
                    "continued reservation differs from exact original queued native operation"
                        .into(),
                );
            }
        }
        for queued in &self.saved.unscored_queued_inputs {
            if !ids.insert((self.saved_epoch()?, queued.native_sequence()))
                || operations.get(&queued.native_sequence()) != Some(queued.operation())
            {
                return Err(
                    "native continuation altered or repeated an original unscored input".into(),
                );
            }
        }
        if ids.len() != operations.len() {
            return Err(
                "native continuation omitted an original pending reservation or unscored input"
                    .into(),
            );
        }
        Ok(())
    }
    pub fn saved_epoch(&self) -> Result<Counter, String> {
        Ok(self
            .saved
            .management
            .as_ref()
            .ok_or("saved native input custody absent")?
            .transport_epoch)
    }
    pub fn restored_stream(&self) -> Result<(Counter, Counter), String> {
        let wire = self.saved.native_management_wire()?;
        native_observer_stream(&wire)
    }
    /// Continue after the exact native observer pulse retained by this proof.
    /// An unread application can append genuine Applied input feedback while
    /// leaving its original audio application high-water unchanged. The saved
    /// stream remains a separate historical fact; this accessor never retags it.
    pub fn post_observer_stream(&self) -> Result<(Counter, Counter), String> {
        let wire = self.after.native_management_wire()?;
        native_observer_stream(&wire)
    }
}
pub(crate) fn native_observer_stream(wire: &Value) -> Result<(Counter, Counter), String> {
    Ok((
        count(&wire["native_pair"]["audio"]["applied_application_ordinal"])?,
        count(&wire["input_history"]["last_ordinal"])?,
    ))
}
fn pending_operations(checkpoint: &CheckpointBinding) -> Result<BTreeMap<Counter, Value>, String> {
    let mut result = BTreeMap::new();
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
            if result
                .insert(count(&operation["sequence"])?, operation.clone())
                .is_some()
            {
                return Err("native pending operation duplicated".into());
            }
        }
    }
    Ok(result)
}
/// Replay proof pages, never mutate original acceptance epochs. A forged epoch
/// label without the complete saved/native restitution proof cannot qualify.
pub fn reservation_epochs(
    performance: &Performance,
) -> Result<BTreeMap<(Counter, Counter), Counter>, String> {
    let mut epochs = BTreeMap::new();
    for page in &performance.native_recordings {
        if let Some(proof) = page.continuation()? {
            proof.validate(performance)?;
            apply_continuation_epochs(&proof, &mut epochs)?;
        }
    }
    Ok(epochs)
}
pub(crate) fn apply_continuation_epochs(
    proof: &NativeReservationContinuation,
    epochs: &mut BTreeMap<(Counter, Counter), Counter>,
) -> Result<(), String> {
    for r in &proof.reservations {
        let key = (r.transport_epoch, r.native_sequence);
        if epochs.get(&key).copied().unwrap_or(r.transport_epoch) != proof.saved_epoch()? {
            return Err(
                "native reservation continuation proof skipped or reordered its original epoch"
                    .into(),
            );
        }
        epochs.insert(key, proof.transport_ack.epoch);
    }
    Ok(())
}

/// Pending operations admitted before a score occurrence exists retain their
/// original epoch/ID and full input. A later native ACK changes only the current
/// transport association. Saved pages remain evidence, never live admission.
#[derive(Clone)]
pub(crate) struct ContinuedUnscoredInput {
    pub(crate) original_epoch: Counter,
    pub(crate) current_epoch: Counter,
    pub(crate) input: UnscoredQueuedInput,
}
pub(crate) fn apply_unscored_continuation(
    proof: &NativeReservationContinuation,
    current: &mut BTreeMap<(Counter, Counter), ContinuedUnscoredInput>,
) -> Result<(), String> {
    let saved_epoch = proof.saved_epoch()?;
    for input in &proof.saved.unscored_queued_inputs {
        let sequence = input.native_sequence();
        let mut original_epoch = saved_epoch;
        let mut prior = None;
        for value in current.values() {
            if value.input.native_sequence() == sequence && value.current_epoch == saved_epoch {
                if prior.replace(value).is_some() || value.input != *input {
                    return Err(
                        "unscored native continuation changed original queued input custody".into(),
                    );
                }
                original_epoch = value.original_epoch;
            }
        }
        // A historical checkpoint may be restored again through another real
        // ACK. Preserve its original admission, but keep each acknowledged
        // application epoch separately. Replaying the same ACK is forbidden.
        let application = (proof.transport_ack.epoch, sequence);
        if current.contains_key(&application) {
            return Err(
                "unscored native continuation repeated its acknowledged application epoch".into(),
            );
        }
        current.insert(
            application,
            ContinuedUnscoredInput {
                original_epoch,
                current_epoch: proof.transport_ack.epoch,
                input: input.clone(),
            },
        );
    }
    Ok(())
}
pub(crate) fn unscored_continuations(
    performance: &Performance,
) -> Result<BTreeMap<(Counter, Counter), ContinuedUnscoredInput>, String> {
    let mut result = BTreeMap::new();
    for page in &performance.native_recordings {
        if let Some(proof) = page.continuation()? {
            proof.validate(performance)?;
            apply_unscored_continuation(&proof, &mut result)?;
        }
    }
    Ok(result)
}
/// Compare only the actual operation projection carried by the callback.
/// Original raw queued JSON stays in the checkpoint. Native note fields use
/// the existing strict typed target with finite IEEE bits preserved; no global
/// JSON numeric tolerance or rewritten source packet is introduced.
pub(crate) fn qualify_unscored_application(
    queued: &ContinuedUnscoredInput,
    epoch: Counter,
    app: &NativeApplication,
    original_input: Option<&crate::expression_performance_management::InputHistoryEntry>,
) -> Result<(), String> {
    let operation = queued.input.operation();
    if queued.original_epoch > queued.current_epoch
        || queued.current_epoch != epoch
        || queued.input.native_sequence() != app.sequence
        || queued.input.effective_sample() != app.admitted_sample
        || app.applied_sample < app.admitted_sample
        || app.committed_cursor <= app.applied_sample
        || operation["identity"]
            != serde_json::to_value(&app.identity).map_err(|e| e.to_string())?
        || operation["kind"] != json!(app.kind)
        || operation["touch"] != json!(app.touch)
        || operation["late_admitted"] != json!(app.late_admitted)
        || operation.get("requested_sample").map(count).transpose()? != app.requested_sample
    {
        return Err(
            "restored unscored application changed original identity/request/deadline".into(),
        );
    }
    if let Some(clock) = operation.get("native_clock") {
        let native: crate::expression_performance_recording::NativeClockReceipt =
            serde_json::from_value(clock.clone()).map_err(|e| e.to_string())?;
        if native != app.native_clock {
            return Err(
                "restored unscored application changed original native clock provenance".into(),
            );
        }
    }
    for (field, value) in [
        ("value", json!(app.value)),
        ("pitch_hz", json!(app.pitch_hz)),
        ("parameter", json!(app.parameter)),
        ("has_note", json!(app.has_note)),
        ("has_determination", json!(app.has_determination)),
    ] {
        if operation
            .get(field)
            .is_some_and(|original| *original != value)
        {
            return Err(format!(
                "restored unscored application changed original operand: {field}"
            ));
        }
    }
    if let Some(note) = operation.get("note") {
        let note: crate::expression_performance_management::NativeNoteTarget =
            serde_json::from_value(note.clone()).map_err(|e| e.to_string())?;
        if app.note.as_ref() != Some(&note) {
            return Err(
                "restored unscored application changed its full original note target".into(),
            );
        }
    }
    if operation["kind"] == 7 {
        let handle: crate::expression_performance_native_contact::NativeContactHandle =
            serde_json::from_value(operation["contact"].clone()).map_err(|e| e.to_string())?;
        if app
            .contact
            .as_ref()
            .is_none_or(|contact| contact.handle != handle)
        {
            return Err(
                "restored Contact application changed original queued slot/generation".into(),
            );
        }
    } else if app.contact.is_some() || operation.get("contact").is_some() {
        return Err("ordinary restored input acquired Contact operands".into());
    }
    if operation
        .get("determination")
        .is_some_and(|original| app.determination.as_ref() != Some(original))
    {
        return Err("restored unscored application changed its original source transition".into());
    }
    match (queued.input.input(), original_input) {
        (Some(binding), Some(row))
            if binding.input_ref == row.input_ref && binding.target == row.target => {}
        (None, None) => {}
        _ => {
            return Err(
                "restored unscored application lost its original native input lifetime".into(),
            );
        }
    }
    Ok(())
}

/// Readback proof of the EXISTING NativeInputBindings::application/retire_absent
/// and PerformanceManagement::pulse at the restored stopped sample. This does
/// not schedule an event, integrate a body, or issue native admission. Every
/// source application is an exact prefix of the saved native observer FIFO.
pub(crate) fn verify_restored_observer_feedback(
    saved: &Value,
    after: &Value,
    acknowledged_epoch: Counter,
    applications: &[Value],
    history: &[crate::expression_performance_management::InputHistoryEntry],
) -> Result<(), String> {
    verify_restored_observer_feedback_inner(
        saved,
        after,
        acknowledged_epoch,
        applications,
        history,
        false,
    )
}
pub(crate) fn verify_restored_observer_feedback_same_epoch(
    saved: &Value,
    after: &Value,
    acknowledged_epoch: Counter,
    applications: &[Value],
    history: &[crate::expression_performance_management::InputHistoryEntry],
) -> Result<(), String> {
    verify_restored_observer_feedback_inner(
        saved,
        after,
        acknowledged_epoch,
        applications,
        history,
        true,
    )
}
fn verify_restored_observer_feedback_inner(
    saved: &Value,
    after: &Value,
    acknowledged_epoch: Counter,
    applications: &[Value],
    history: &[crate::expression_performance_management::InputHistoryEntry],
    same_epoch: bool,
) -> Result<(), String> {
    use crate::expression_performance_management::{
        InputBinding, InputHistoryEntry, ManagementState,
    };
    let shell = |wire: &Value| -> Result<ManagementState, String> {
        let mut object = wire
            .as_object()
            .ok_or("complete native management required")?
            .clone();
        object.remove("native_pair").ok_or("native pair absent")?;
        serde_json::from_value(Value::Object(object)).map_err(|e| e.to_string())
    };
    let mut state = shell(saved)?;
    let actual_state = shell(after)?;
    if applications.len() > 256
        || history.len() > 256
        || state.inputs.len() > 96
        || acknowledged_epoch != actual_state.transport_epoch
        || if same_epoch {
            acknowledged_epoch != state.transport_epoch
        } else {
            acknowledged_epoch <= state.transport_epoch
        }
    {
        return Err("native stopped observer bounds/acknowledged epoch differ".into());
    }
    // Historical pre-pulse restitution is a separate exact cut. It creates no
    // feedback or journal and must retain the whole original checkpoint.
    let mut pre_pulse = saved.clone();
    pre_pulse["transport_epoch"] = json!(acknowledged_epoch);
    if applications.is_empty()
        && history.is_empty()
        && crate::expression_performance_readmission::same_management_wire(&pre_pulse, after)?
    {
        return Ok(());
    }
    let saved_queue = &saved["native_pair"]["audio"]["applications"];
    let after_queue = &after["native_pair"]["audio"]["applications"];
    let saved_entries = saved_queue["entries"]
        .as_array()
        .ok_or("saved native applications absent")?;
    let after_entries = after_queue["entries"]
        .as_array()
        .ok_or("after native applications absent")?;
    let read = count(&saved_queue["read"])?;
    let write = count(&saved_queue["write"])?;
    if write.0.checked_sub(read.0) != Some(saved_entries.len() as u64)
        || write != count(&after_queue["write"])?
        || read.0.checked_add(applications.len() as u64) != Some(count(&after_queue["read"])?.0)
        || applications != saved_entries.as_slice()
        || !after_entries.is_empty()
    {
        return Err("native restored applications were lost/reordered/changed".into());
    }
    let journal = &state.input_history;
    if journal.write.0.checked_sub(journal.read.0) != Some(journal.entries.len() as u64)
        || journal.last_ordinal != journal.write
        || journal.entries.len() > 256
        || journal
            .entries
            .iter()
            .enumerate()
            .any(|(i, e)| journal.read.0.checked_add(i as u64 + 1) != Some(e.ordinal.0))
    {
        return Err("saved native journal order/cut differs".into());
    }
    // Native slots are walked in their original fixed array order. Targets and
    // input refs remain complete typed values; no pitch/ref/phase is inferred.
    let mut inputs = BTreeMap::new();
    for input in std::mem::take(&mut state.inputs) {
        if input.slot >= 96 || inputs.insert(input.slot, input).is_some() {
            return Err("saved native input slots differ".into());
        }
    }
    fn record(
        state: &mut ManagementState,
        input: &InputBinding,
        change: u8,
        operation: u8,
        sequence: Counter,
    ) -> Result<(), String> {
        if sequence.0 == 0 || state.input_history.entries.len() >= 256 {
            return Err("native feedback journal exhausted/lost".into());
        }
        let ordinal = Counter(
            state
                .input_history
                .last_ordinal
                .0
                .checked_add(1)
                .ok_or("native feedback ordinal exhausted")?,
        );
        state.input_history.write = Counter(
            state
                .input_history
                .write
                .0
                .checked_add(1)
                .ok_or("native feedback write exhausted")?,
        );
        state.input_history.last_ordinal = ordinal;
        state.input_history.entries.push(InputHistoryEntry {
            ordinal,
            native_sequence: sequence,
            change,
            operation,
            input_ref: input.input_ref.clone(),
            target: input.target.clone(),
        });
        Ok(())
    }
    let audio = &saved["native_pair"]["audio"];
    for (index, wire) in applications.iter().enumerate() {
        let app: NativeApplication =
            serde_json::from_value(wire.clone()).map_err(|e| e.to_string())?;
        crate::expression_performance_native_contact::validate_application_discriminator(wire)?;
        if app.kind > 7
            || app.status != if app.applied { "applied" } else { "refused" }
            || read.0.checked_add(index as u64 + 1) != Some(app.applied_application_ordinal.0)
            || app.applied_application_ordinal > count(&audio["applied_application_ordinal"])?
            || app.sequence.0 == 0
            || app.sequence > count(&audio["accepted_sequence"])?
            || app.committed_cursor > count(&audio["cursor"])?
        {
            return Err("saved native application source/order/cursor differs".into());
        }
        let mut remove = Vec::new();
        for input in inputs.values_mut() {
            if app.kind != 4 && input.target.touch != app.touch {
                continue;
            }
            record(
                &mut state,
                input,
                if app.applied { 2 } else { 3 },
                app.kind,
                app.sequence,
            )?;
            if app.applied && app.kind == 0 && app.sequence == input.press_sequence {
                if app.note.as_ref() != Some(&input.target) {
                    return Err("native attack feedback lost its entire original target".into());
                }
                input.press_applied = true;
            }
            if (app.applied && (app.kind == 1 || app.kind == 4)) || (!app.applied && app.kind == 0)
            {
                remove.push(input.slot);
            }
        }
        for slot in remove {
            inputs.remove(&slot);
        }
        if app.kind == 4 && app.applied && app.sequence == state.release_sequence {
            state.panic_applied = true;
        }
    }
    // A stopped restore captures its actual copied readback from THIS audio CP.
    // Retire_absent uses exactly its applied sequence and held touch tokens.
    let held = audio["touches"]
        .as_array()
        .ok_or("native held touch snapshot absent")?
        .iter()
        .map(|t| count(&t["token"]))
        .collect::<Result<BTreeSet<_>, _>>()?;
    let last_sequence = count(&audio["applied_sequence"])?;
    let mut retired = Vec::new();
    for input in inputs.values() {
        if input.press_applied
            && input.press_sequence <= last_sequence
            && !held.contains(&input.target.touch)
        {
            record(&mut state, input, 4, 1, last_sequence)?;
            retired.push(input.slot);
        }
    }
    for slot in retired {
        inputs.remove(&slot);
    }
    state.inputs = inputs.into_values().collect();
    // Original admitted rows precede the exact derived native feedback rows.
    // Stopped capture supplies the complete current application high-water.
    // Both native queues are bounded256, and this native pulse drains them in
    // full. Neither write nor ordinal is borrowed from the reply.
    if history != state.input_history.entries.as_slice() {
        return Err("native restored input feedback was lost/forged/reordered".into());
    }
    state.input_history.read = Counter(
        state
            .input_history
            .read
            .0
            .checked_add(history.len() as u64)
            .ok_or("native history read exhausted")?,
    );
    state.input_history.entries.clear();
    if state.release_pending && (state.release_request.0 != 0 || state.panic_applied) {
        let proof = &audio["release_proof"];
        let cursor = count(&audio["cursor"])?;
        let available = !audio["fault"]
            .as_bool()
            .ok_or("native fault standing absent")?;
        let no_voices = audio["voices"]
            .as_array()
            .ok_or("native voices absent")?
            .is_empty();
        let no_tails = audio["tails"]
            .as_array()
            .ok_or("native tails absent")?
            .is_empty();
        let no_sustain = !audio["sustain"].as_bool().ok_or("native sustain absent")?;
        let applied = count(&proof["emergency_applied_sample"])?;
        let fence = if state.release_request.0 != 0 {
            count(&proof["emergency_observed"])? >= state.release_request
                && cursor.0.checked_sub(applied.0).is_some_and(|n| n >= 512)
        } else {
            state.release_sequence.0 != 0 && last_sequence >= state.release_sequence
        };
        if available
            && held.is_empty()
            && no_voices
            && no_tails
            && no_sustain
            && count(&proof["force_zero_samples"])?.0 >= 512
            && fence
        {
            state.release_pending = false;
            state.release_proof_cursor = cursor;
        }
    }
    if audio["recording"]["failure"]
        .as_u64()
        .ok_or("native recording standing absent")?
        != 0
    {
        state.recording_failed = true;
    }
    state.transport_epoch = acknowledged_epoch;
    if state != actual_state {
        return Err("native restored binding/complete journal/management feedback differs".into());
    }
    let mut expected = serde_json::to_value(state).map_err(|e| e.to_string())?;
    let mut native_pair = saved["native_pair"].clone();
    let mut observed_queue = saved_queue.clone();
    observed_queue["read"] = after_queue["read"].clone();
    observed_queue["entries"] = json!([]);
    native_pair["audio"]["applications"] = observed_queue;
    expected["native_pair"] = native_pair;
    if !crate::expression_performance_readmission::same_management_wire(&expected, after)? {
        return Err("native continuation did not restore exact body/qv/voices/tails/source/queues/input state".into());
    }
    Ok(())
}
