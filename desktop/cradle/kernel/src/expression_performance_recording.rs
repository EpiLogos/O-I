//! Actual native applications become prospective edits of the existing Scene.
//! The serial worker supplies its source-qualified checkpoint and original input
//! journal. A JSON receipt alone is never a native lease or admission authority.
//! Native clock receipts are retained; musical tempo never redates their samples.
use crate::expression_performance::{
    CheckpointBinding, Counter, EventAction, Performance, PerformanceBasis, PerformanceOperation,
    Scalar, Scope, TimedEvent,
};
use crate::expression_performance_management::{
    InputHistoryEntry, NativeIdentity, NativeNoteTarget,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;

pub const SCHEMA: &str = "oi.expression-native-recording/v2";
const MAX_BATCH: usize = 256;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeClockReceipt {
    pub epoch: Counter,
    pub anchor_ordinal: Counter,
    pub trigger_host_ticks: Counter,
    pub admitted_host_ticks: Counter,
    pub mapping_uncertainty_samples: Scalar,
    pub input_transit_unknown: bool,
}
impl NativeClockReceipt {
    fn validate(&self) -> Result<(), String> {
        if self.mapping_uncertainty_samples.value() < 0.0
            || self.admitted_host_ticks < self.trigger_host_ticks
            || (self.epoch.0 == 0
                && (self.anchor_ordinal.0 != 0
                    || self.trigger_host_ticks.0 != 0
                    || self.admitted_host_ticks.0 != 0
                    || self.mapping_uncertainty_samples.value() != 0.0))
        {
            return Err("native clock admission receipt differs".into());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PhysicalManifest {
    pub event_ref: String,
    pub subject_ref: String,
    pub source_coordinate: String,
    pub source_revision: String,
    pub eigenbasis_identity: String,
    pub source_generation: Counter,
    pub sample_rate: u32,
    pub pratibimba: bool,
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeApplication {
    pub schema: String,
    pub operation: String,
    pub kind: u8,
    pub status: String,
    pub applied: bool,
    pub identity: NativeIdentity,
    pub native_clock: NativeClockReceipt,
    pub sequence: Counter,
    /// Native commit delivery order, distinct from admission operation ID.
    pub applied_application_ordinal: Counter,
    /// Native original request, retained independently of the resolved queue time.
    /// Absent historical provenance stays absent; zero is an available request.
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "requested_sample"
    )]
    pub requested_sample: Option<Counter>,
    pub admitted_sample: Counter,
    pub applied_sample: Counter,
    pub committed_cursor: Counter,
    pub body_revision: Counter,
    pub touch: Counter,
    pub preparation_ref: String,
    pub state_ref: String,
    pub parameter: u8,
    pub value: Scalar,
    pub pitch_hz: Scalar,
    pub has_note: bool,
    pub note: Option<NativeNoteTarget>,
    pub has_determination: bool,
    pub determination: Option<Value>,
    pub late_admitted: bool,
    pub physical_manifest: PhysicalManifest,
}
fn requested_sample<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<Counter>, D::Error> {
    // Missing fields use the default; an explicitly present null cannot erase
    // original timing provenance or acquire canonical native wire standing.
    Counter::deserialize(deserializer).map(Some)
}
fn decimal(v: &Value) -> Result<Counter, String> {
    serde_json::from_value(v.clone()).map_err(|e| e.to_string())
}
fn exact_ref(s: &str) -> Result<(), String> {
    if s.is_empty() || s.len() >= 256 || s.chars().any(char::is_control) {
        return Err("actual bounded native reference required".into());
    }
    Ok(())
}
fn operation(kind: u8) -> Result<&'static str, String> {
    [
        "note_on",
        "note_off",
        "sustain",
        "expression",
        "panic",
        "parameter",
        "determination",
    ]
    .get(usize::from(kind))
    .copied()
    .ok_or_else(|| "unknown native application kind".into())
}
impl NativeApplication {
    pub fn require_requested_sample(&self) -> Result<Counter, String> {
        self.requested_sample
            .ok_or_else(|| "original native requested time unavailable".into())
    }
    fn validate(&self, basis: &PerformanceBasis, state: &NativeRecordState) -> Result<(), String> {
        self.native_clock.validate()?;
        let identity = &basis.identity;
        if self.schema != "ql.performance-applied-event/v2"
            || self.operation != operation(self.kind)?
            || self.status != if self.applied { "applied" } else { "refused" }
            || self.sequence.0 == 0
            || self.sequence > state.accepted_sequence
            || self.applied_application_ordinal.0 == 0
            || self.requested_sample.is_some_and(|requested| {
                requested > self.admitted_sample
                    || (requested < self.admitted_sample && !self.late_admitted)
            })
            || self.applied_sample < self.admitted_sample
            || (self.applied_sample > self.admitted_sample && !self.late_admitted)
            || self.applied_sample >= self.committed_cursor
            || self.committed_cursor > state.committed_cursor
            || self.has_note != self.note.is_some()
            || self.has_determination != self.determination.is_some()
            || self.has_determination != (self.kind == 6)
            || self.identity.instance != identity.instance_ref
            || self.identity.event != identity.event_ref
            || self.identity.subject != identity.subject_ref
            || self.identity.m1_revision != identity.m1_revision
            || self.identity.m2_generation != identity.m2_generation
            || self.body_revision != decimal(&basis.audio_determination["body_revision"])?
            || basis.prepared_body["request"]["preparation_ref"] != self.preparation_ref
            || basis.prepared_body["request"]["state_ref"] != self.state_ref
        {
            return Err("recording lost actual applied event/source/body/cursor".into());
        }
        let manifest = &self.physical_manifest;
        let physical = &state.physical;
        if manifest.event_ref != identity.event_ref
            || manifest.subject_ref != identity.subject_ref
            || manifest.source_coordinate != basis.prepared_body["source_coordinate"]["source_ref"]
            || manifest.source_revision != basis.prepared_body["source_revision"]
            || manifest.source_generation != identity.m3_generation
            || basis.prepared_body["request"]["sample_rate"] != json!(manifest.sample_rate)
            || !manifest.pratibimba
            || physical["source_coordinate"] != manifest.source_coordinate
            || physical["source_revision"] != manifest.source_revision
            || physical["source_generation"] != json!(manifest.source_generation)
            || physical["eigenbasis_identity"] != manifest.eigenbasis_identity
        {
            return Err("recording lost original physical manifest/eigenbasis".into());
        }
        for s in [
            &self.preparation_ref,
            &self.state_ref,
            &manifest.eigenbasis_identity,
        ] {
            exact_ref(s)?;
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeRecordingStatus {
    pub failure: u8,
    pub dropped_applications: Counter,
    pub first_failed_sequence: Counter,
    pub first_failed_sample: Counter,
}
/// Qualified control copy under the existing native worker/Scene lease, not a
/// browser-issued capability. No callback stop or full checkpoint is required
/// to record a live pulse. Stopped snapshots are reserved for save/seek/restore.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeRecordState {
    identity: crate::expression_performance::Identity,
    basis_digest: String,
    committed_cursor: Counter,
    accepted_sequence: Counter,
    applied_high_water: Counter,
    transport_epoch: Counter,
    physical: Value,
    recording: NativeRecordingStatus,
    last_input_ordinal: Option<Counter>,
    #[serde(skip)]
    pulse: Option<(Vec<Value>, Vec<InputHistoryEntry>)>,
}
impl NativeRecordState {
    /// Test/reopen source: actual stopped source-qualified native checkpoint.
    pub fn from_checkpoint(
        basis: &PerformanceBasis,
        checkpoint: &CheckpointBinding,
    ) -> Result<Self, String> {
        basis.validate()?;
        checkpoint.validate()?;
        let management = checkpoint
            .management
            .as_ref()
            .ok_or("complete native input checkpoint required")?;
        if checkpoint.identity != basis.identity
            || checkpoint.basis_digest != basis.content_digest
            || management.recording_failed
            || checkpoint.audio["schema"] != "ql.performance-checkpoint/v2"
        {
            return Err("native checkpoint is not this exact record source".into());
        }
        let p = &checkpoint.physical;
        let physical = json!({"event_ref":p["identity"]["event_ref"],"subject_ref":p["identity"]["subject_ref"],
            "source_coordinate":p["identity"]["source_coordinate"],"source_revision":p["identity"]["source_revision"],
            "source_generation":p["identity"]["source_generation"],"eigenbasis_identity":p["basis"]["eigenbasis_identity"],
            "sample_rate":p["basis"]["sample_rate"],"pratibimba":p["identity"]["face"]=="pratibimba"});
        let recording = serde_json::from_value(checkpoint.audio["recording"].clone())
            .map_err(|e| e.to_string())?;
        Ok(Self {
            identity: basis.identity.clone(),
            basis_digest: basis.content_digest.clone(),
            committed_cursor: checkpoint.sample,
            accepted_sequence: decimal(&checkpoint.audio["accepted_sequence"])?,
            applied_high_water: decimal(&checkpoint.audio["applied_application_ordinal"])?,
            transport_epoch: management.transport_epoch,
            physical,
            recording,
            last_input_ordinal: Some(management.input_history.last_ordinal),
            pulse: None,
        })
    }
    /// Called only by the existing native worker lease receiver after its full
    /// source/body admission. Exact pulse receipts are retained as the batch
    /// basis so a later caller cannot silently mix replies or input journals.
    pub fn from_worker_reply(basis: &PerformanceBasis, reply: &Value) -> Result<Self, String> {
        basis.validate()?;
        let reading = &reply["reading"];
        let scope = &reading["scope"];
        let physical = &reading["physical"];
        if reply["schema"] != "ql.performance-worker-reply/v1"
            || reading["schema"] != "ql.performance-management/v1"
            || reply["recording_available"] != true
            || scope["instance_ref"] != basis.identity.instance_ref
            || scope["event_ref"] != basis.identity.event_ref
            || scope["subject_ref"] != basis.identity.subject_ref
            || decimal(&scope["m1_revision"])? != basis.identity.m1_revision
            || decimal(&scope["m2_generation"])? != basis.identity.m2_generation
            || scope["body_revision"] != basis.audio_determination["body_revision"]
            || scope["preparation_ref"] != basis.prepared_body["request"]["preparation_ref"]
            || scope["state_ref"] != basis.prepared_body["request"]["state_ref"]
            || physical["event_ref"] != basis.identity.event_ref
            || physical["subject_ref"] != basis.identity.subject_ref
            || physical["source_coordinate"]
                != basis.prepared_body["source_coordinate"]["source_ref"]
            || physical["source_revision"] != basis.prepared_body["source_revision"]
            || decimal(&physical["source_generation"])? != basis.identity.m3_generation
            || physical["pratibimba"] != true
            || physical["samples_elapsed"] != reading["samples_elapsed"]
            || physical["body_revision"] != scope["body_revision"]
            || physical["preparation_ref"] != scope["preparation_ref"]
            || physical["state_ref"] != scope["state_ref"]
        {
            return Err("recording pulse lost exact native source/body/shared cursor".into());
        }
        exact_ref(
            physical["eigenbasis_identity"]
                .as_str()
                .ok_or("native eigenbasis receipt absent")?,
        )?;
        let applications = reply["applications"]
            .as_array()
            .ok_or("native applied pulse absent")?
            .clone();
        let journal: Vec<InputHistoryEntry> =
            serde_json::from_value(reply["input_history"].clone()).map_err(|e| e.to_string())?;
        if applications.len() > MAX_BATCH || journal.len() > MAX_BATCH {
            return Err("native pulse batch bounds differ".into());
        }
        let last_input_ordinal = journal.last().map(|entry| entry.ordinal);
        let recording: NativeRecordingStatus =
            serde_json::from_value(reply["recording"].clone()).map_err(|e| e.to_string())?;
        if recording.failure != 0 || recording.dropped_applications.0 != 0 {
            return Err("native recording loss is explicit".into());
        }
        Ok(Self {
            identity: basis.identity.clone(),
            basis_digest: basis.content_digest.clone(),
            committed_cursor: decimal(&reading["samples_elapsed"])?,
            accepted_sequence: decimal(&reading["accepted_sequence"])?,
            applied_high_water: decimal(&reading["last_applied_application_ordinal"])?,
            transport_epoch: decimal(&reading["transport_epoch"])?,
            physical: physical.clone(),
            recording,
            last_input_ordinal,
            pulse: Some((applications, journal)),
        })
    }
}

/// Mapping is to actual already-declared native parameter targets, not an
/// independent correspondence registry. The named native field/unit is checked.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ParameterBinding {
    pub native_parameter: u8,
    pub performance_parameter: u16,
}
pub(crate) fn parameter_field(id: u8) -> Result<(&'static str, &'static str), String> {
    [
        ("force_newtons", "N"),
        ("attack_seconds", "s"),
        ("release_seconds", "s"),
        ("cutoff_hertz", "Hz"),
        ("master_linear", "linear"),
        ("body_linear", "linear"),
        ("monitor_linear", "linear"),
    ]
    .get(usize::from(id))
    .copied()
    .ok_or_else(|| "unknown native parameter".into())
}
pub struct RecordAdmission<'a> {
    pub state: &'a NativeRecordState,
    pub basis: u16,
    pub layer: u16,
    /// Last COMMITTED native application retained under this transport epoch.
    pub previous_applied_application_ordinal: Counter,
    /// Management transport epoch, distinct from device clock receipt epoch.
    /// A seek/restore resets continuation only through its native acknowledgement.
    pub expected_transport_epoch: Counter,
    pub previous_input_ordinal: Counter,
    pub parameter_bindings: &'a [ParameterBinding],
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RecordedApplication {
    /// Refused committed native applications retain receipt history, without
    /// manufacturing a played musical event or stealing another occurrence ID.
    pub recorded_sequence: Option<Counter>,
    pub basis: u16,
    pub application: NativeApplication,
    pub original_input: Option<InputHistoryEntry>,
    /// Exact actual operand before later authored editing/removal.
    pub performed_event: Option<TimedEvent>,
    pub reservation: Option<crate::expression_performance_reservation::ReservationApplication>,
}
/// Prospective material only; the current native Application/Act CAS commits
/// events plus exact receipt custody together, or neither. No private save.
pub struct PreparedRecording {
    performance: Performance,
    events: Vec<TimedEvent>,
    receipts: Vec<RecordedApplication>,
    input_journal: Vec<InputHistoryEntry>,
    applied_application_ordinal: Counter,
    transport_epoch: Counter,
    page: NativeRecordingPage,
}
impl PreparedRecording {
    pub fn prospective(&self) -> &Performance {
        &self.performance
    }
    pub fn receipts(&self) -> &[RecordedApplication] {
        &self.receipts
    }
    pub fn input_journal(&self) -> &[InputHistoryEntry] {
        &self.input_journal
    }
    pub fn applied_application_ordinal(&self) -> Counter {
        self.applied_application_ordinal
    }
    pub fn transport_epoch(&self) -> Counter {
        self.transport_epoch
    }
    pub fn record_operations(&self) -> Vec<PerformanceOperation> {
        vec![PerformanceOperation::RecordNative {
            events: self.events.clone(),
            page: self.page.clone(),
        }]
    }
    pub fn page(&self) -> &NativeRecordingPage {
        &self.page
    }
    pub fn verify_replay(
        &self,
        original: &Performance,
        admission: RecordAdmission<'_>,
        applications: &[Value],
        journal: &[InputHistoryEntry],
    ) -> Result<(), String> {
        let actual = prepare_recording(original, admission, applications, journal)?;
        if self.performance != actual.performance
            || self.receipts != actual.receipts
            || self.input_journal != actual.input_journal
            || self.applied_application_ordinal != actual.applied_application_ordinal
            || self.transport_epoch != actual.transport_epoch
        {
            return Err("native recorded event/clock/input receipt replay differs".into());
        }
        Ok(())
    }
}
fn input<'a>(
    app: &NativeApplication,
    journal: &'a [InputHistoryEntry],
) -> Result<Option<&'a InputHistoryEntry>, String> {
    if ![0, 1, 3].contains(&app.kind) {
        return Ok(None);
    }
    let matches: Vec<_> = journal
        .iter()
        .filter(|e| {
            e.native_sequence == app.sequence
                && e.change == if app.applied { 2 } else { 3 }
                && e.operation == app.kind
        })
        .collect();
    if matches.is_empty() && !app.applied {
        return Ok(None);
    }
    if matches.len() != 1 {
        return Err("recording lost unique actual applied original input journal".into());
    }
    let entry = matches[0];
    exact_ref(&entry.input_ref)?;
    if entry.target.touch.0 == 0
        || (app.kind != 0 && entry.target.touch != app.touch)
        || (app.has_note && app.note.as_ref() != Some(&entry.target))
    {
        return Err("recording input detached from its original native target/touch".into());
    }
    Ok(Some(entry))
}
fn pitch(performance: &Performance, basis: u16, target: &NativeNoteTarget) -> Result<u16, String> {
    let matches: Vec<_> = performance
        .pitches
        .iter()
        .enumerate()
        .filter(|(_, p)| {
            p.basis == basis
                && p.key == target.key
                && p.source_coordinate == target.source_coordinate
                && p.source_prime == (target.source_face == 1)
                && p.pitch_class == target.pitch_class
                && p.register == target.register_octave
                && p.hertz == target.hertz
                && p.fundamental_hz == target.fundamental_hz
                && p.tuning_ref == target.tuning_ref
                && match &p.exact_ratio {
                    Some(r) => {
                        target.exact_ratio
                            && r.numerator == target.ratio_numerator
                            && r.denominator == target.ratio_denominator
                    }
                    None => {
                        !target.exact_ratio
                            && target.ratio_numerator.0 == 0
                            && target.ratio_denominator.0 == 0
                    }
                }
        })
        .collect();
    if matches.len() != 1 {
        return Err("recording lost exact source-qualified pitch dictionary target".into());
    }
    u16::try_from(matches[0].0).map_err(|e| e.to_string())
}
fn performed_action(
    original: &Performance,
    basis_index: u16,
    app: &NativeApplication,
    original_input: Option<&InputHistoryEntry>,
    parameter_bindings: &[ParameterBinding],
) -> Result<EventAction, String> {
    Ok(match app.kind {
        0 => {
            let target = &original_input
                .ok_or("actual original attack target absent")?
                .target;
            if !app.has_note {
                return Err("applied attack lost native resolved NoteTarget".into());
            }
            EventAction::NoteOn(
                target.touch,
                target.member,
                pitch(original, basis_index, target)?,
                app.value,
                target.phase_sin,
                target.phase_cos,
            )
        }
        1 => EventAction::NoteOff(
            original_input
                .ok_or("original release absent")?
                .target
                .touch,
        ),
        2 => {
            if app.value.value() != 0.0 && app.value.value() != 1.0 {
                return Err("native sustain state differs".into());
            }
            EventAction::Sustain(app.value.value() == 1.0)
        }
        3 => {
            let target = &original_input
                .ok_or("original expression target absent")?
                .target;
            pitch(original, basis_index, target)?;
            // Zero is the actual native 'retain pitch' operation. Preserve
            // it in the receipt; the musical replay operand uses original
            // prepared Hz without inventing a new tuning determination.
            let hz = if app.pitch_hz.value() == 0.0 {
                target.hertz
            } else {
                app.pitch_hz
            };
            EventAction::Expression(target.touch, app.value, hz)
        }
        4 => EventAction::Panic,
        5 => {
            let bindings: Vec<_> = parameter_bindings
                .iter()
                .filter(|m| m.native_parameter == app.parameter)
                .collect();
            if bindings.len() != 1 {
                return Err("applied parameter has no unique existing native target".into());
            }
            let binding = bindings[0];
            let p = original
                .parameters
                .get(usize::from(binding.performance_parameter))
                .ok_or("declared native parameter absent")?;
            let (field, unit) = parameter_field(app.parameter)?;
            if p.native_owner != "ql.performance.Engine"
                || p.action_ref != "ql:native-performance/parameter"
                || p.target_ref != format!("ql:performance/parameter/{}", field.replace('_', "-"))
                || p.unit != unit
                || p.scope != Scope::Instrument
            {
                return Err("native parameter receipt lost actual owner/field/unit".into());
            }
            EventAction::Parameter(binding.performance_parameter, app.value, None)
        }
        6 => {
            return Err(
                "applied determination requires the typed native held-state transition owner"
                    .into(),
            );
        }
        _ => return Err("unknown performed native operation".into()),
    })
}
pub fn prepare_recording(
    original: &Performance,
    admission: RecordAdmission<'_>,
    applications: &[Value],
    journal: &[InputHistoryEntry],
) -> Result<PreparedRecording, String> {
    original.validate()?;
    let basis = original
        .bases
        .get(usize::from(admission.basis))
        .ok_or("record basis absent")?;
    if admission.state.basis_digest != basis.content_digest
        || admission.state.identity != basis.identity
        || admission.expected_transport_epoch.0 == 0
        || admission.expected_transport_epoch != admission.state.transport_epoch
        || usize::from(admission.layer) >= original.layers.len()
        || (applications.is_empty() && journal.is_empty())
        || applications.len() > MAX_BATCH
        || journal.len() > MAX_BATCH
        || admission.state.recording.failure != 0
        || admission.state.recording.dropped_applications.0 != 0
    {
        return Err("native record admission/source/input loss refusal".into());
    }
    let mut previous_ordinal = admission.previous_input_ordinal.0;
    let mut journal_keys = BTreeSet::new();
    for entry in journal {
        if entry.ordinal.0
            != previous_ordinal
                .checked_add(1)
                .ok_or("native input ordinal exhausted")?
            || entry.change > 4
            || entry.operation > 6
            || !journal_keys.insert((entry.native_sequence, entry.change, entry.operation))
        {
            return Err("original native input journal order/identity differs".into());
        }
        previous_ordinal = entry.ordinal.0;
    }
    if admission
        .state
        .last_input_ordinal
        .is_some_and(|last| last.0 != previous_ordinal)
    {
        return Err("recording lost a native input journal entry".into());
    }
    if let Some((actual_apps, actual_journal)) = &admission.state.pulse {
        if actual_apps != applications || actual_journal != journal {
            return Err("recording batch differs from the admitted native owner pulse".into());
        }
    }
    let mut applied_ordinal = admission.previous_applied_application_ordinal.0;
    let mut operation_ids = BTreeSet::new();
    let mut recorded_sequence = original
        .events()
        .map(TimedEvent::sequence)
        .max()
        .unwrap_or(0);
    let mut events = Vec::with_capacity(applications.len());
    let mut receipts = Vec::with_capacity(applications.len());
    let mut previous_sample = None;
    for wire in applications {
        let app: NativeApplication =
            serde_json::from_value(wire.clone()).map_err(|e| e.to_string())?;
        app.validate(basis, admission.state)?;
        applied_ordinal = applied_ordinal
            .checked_add(1)
            .ok_or("native committed application ordinal exhausted")?;
        if app.applied_application_ordinal.0 != applied_ordinal
            || !operation_ids.insert(app.sequence)
            || previous_sample.is_some_and(|s| app.applied_sample.0 < s)
        {
            return Err("native recording has a missing/reordered applied event".into());
        }
        previous_sample = Some(app.applied_sample.0);
        let original_input = input(&app, journal)?;
        if let Some(entry) = original_input {
            let target = &entry.target;
            if target.identity != app.identity
                || target.member.0 == 0
                || target.key >= 12
                || target.position != target.key / 2
                || target.coordinate_face != target.key % 2
                || target.source_face > 1
            {
                return Err(
                    "recording original input lost its qualified native lineage/face".into(),
                );
            }
            exact_ref(&target.touch_ref)?;
        }
        let reservation = original
            .native_reservations
            .iter()
            .find(|r| {
                r.transport_epoch == admission.state.transport_epoch
                    && r.native_sequence == app.sequence
            })
            .map(|r| r.reconcile(&app))
            .transpose()?;
        if !app.applied {
            receipts.push(RecordedApplication {
                recorded_sequence: reservation
                    .as_ref()
                    .map(|r| r.reservation.recorded_sequence),
                basis: admission.basis,
                application: app,
                original_input: original_input.cloned(),
                performed_event: None,
                reservation,
            });
            continue;
        }
        let action = performed_action(
            original,
            admission.basis,
            &app,
            original_input,
            admission.parameter_bindings,
        )?;
        let sequence = if let Some(reservation) = &reservation {
            reservation.reservation.recorded_sequence
        } else {
            recorded_sequence = recorded_sequence
                .checked_add(1)
                .ok_or("recorded occurrence identity exhausted")?;
            Counter(recorded_sequence)
        };
        let performed_event = TimedEvent(
            sequence,
            app.applied_sample,
            admission.layer,
            admission.basis,
            action,
        );
        if reservation.is_none() {
            events.push(performed_event.clone());
        }
        receipts.push(RecordedApplication {
            recorded_sequence: Some(sequence),
            basis: admission.basis,
            application: app,
            original_input: original_input.cloned(),
            performed_event: Some(performed_event),
            reservation,
        });
    }
    if applied_ordinal != admission.state.applied_high_water.0 {
        return Err("recording lost a trailing committed native application".into());
    }
    let page = NativeRecordingPage::from_native(NativeRecordingBatch {
        schema: NATIVE_BATCH_SCHEMA.into(),
        basis: admission.basis,
        layer: admission.layer,
        state: admission.state.clone(),
        previous_applied_application_ordinal: admission.previous_applied_application_ordinal,
        previous_input_ordinal: admission.previous_input_ordinal,
        parameter_bindings: admission.parameter_bindings.to_vec(),
        receipts: receipts.clone(),
        input_journal: journal.to_vec(),
    })?;
    // One native edit retains performed operands AND their exact native facts.
    let performance = original.edited(vec![PerformanceOperation::RecordNative {
        events: events.clone(),
        page: page.clone(),
    }])?;
    Ok(PreparedRecording {
        performance,
        events,
        receipts,
        input_journal: journal.to_vec(),
        applied_application_ordinal: Counter(applied_ordinal),
        transport_epoch: admission.state.transport_epoch,
        page,
    })
}

pub const NATIVE_PAGE_SCHEMA: &str = "oi.expression-native-recording-page/v1";
const NATIVE_BATCH_SCHEMA: &str = "oi.expression-native-recording-batch/v1";
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeRecordingBatch {
    schema: String,
    basis: u16,
    layer: u16,
    state: NativeRecordState,
    previous_applied_application_ordinal: Counter,
    previous_input_ordinal: Counter,
    parameter_bindings: Vec<ParameterBinding>,
    receipts: Vec<RecordedApplication>,
    input_journal: Vec<InputHistoryEntry>,
}
impl NativeRecordingBatch {
    pub fn entries(&self) -> &[RecordedApplication] {
        &self.receipts
    }
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(
    tag = "kind",
    content = "value",
    rename_all = "snake_case",
    deny_unknown_fields
)]
enum NativeRecordingContent {
    Applied(Box<NativeRecordingBatch>),
    Terminated(Box<crate::expression_performance_reservation::NativeReservationTermination>),
}
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeRecordingPage {
    schema: String,
    encoded: crate::expression_performance_codec::EncodedPage,
}
impl NativeRecordingPage {
    /// Original typed page counters before this page. The native owner exposes
    /// these alongside the validated after boundary so a consumer can prove
    /// the FIRST page follows its retained native origin, not just a suffix.
    pub fn recording_stream_before(
        &self,
    ) -> Result<(Counter, Counter, Counter, Counter, String), String> {
        self.validate()?;
        if let Some(termination) = self.termination()? {
            let before = &termination.before;
            let management = before
                .management
                .as_ref()
                .ok_or("native termination management absent")?;
            return Ok((
                management.transport_epoch,
                decimal(&before.audio["applied_application_ordinal"])?,
                management.input_history.last_ordinal,
                before.sample,
                before.basis_digest.clone(),
            ));
        }
        let batch = self.batch()?;
        Ok((
            batch.state.transport_epoch,
            batch.previous_applied_application_ordinal,
            batch.previous_input_ordinal,
            batch.state.committed_cursor,
            batch.state.basis_digest,
        ))
    }
    /// Same existing typed codec owner exposes its complete validated stream
    /// boundary. No caller watermark or second decoder is introduced.
    pub fn recording_stream_after(
        &self,
    ) -> Result<(Counter, Counter, Counter, Counter, String), String> {
        self.validate()?;
        if let Some(termination) = self.termination()? {
            let after = &termination.after;
            let management = after
                .management
                .as_ref()
                .ok_or("native termination management absent")?;
            return Ok((
                management.transport_epoch,
                decimal(&after.audio["applied_application_ordinal"])?,
                management.input_history.last_ordinal,
                after.sample,
                after.basis_digest.clone(),
            ));
        }
        let batch = self.batch()?;
        Ok((
            batch.state.transport_epoch,
            batch.state.applied_high_water,
            batch
                .input_journal
                .last()
                .map_or(batch.previous_input_ordinal, |row| row.ordinal),
            batch.state.committed_cursor,
            batch.state.basis_digest,
        ))
    }
    /// Exact original canonical bytes from the existing codec, for another
    /// native consumer. The codec and private typed content validate before
    /// delivery; rebuilding a Value cannot replace this byte-order custody.
    pub fn canonical_decoded_bytes(&self) -> Result<Vec<u8>, String> {
        self.validate()?;
        self.encoded.read::<NativeRecordingContent>()?;
        self.encoded.bytes()
    }

    fn from_native(batch: NativeRecordingBatch) -> Result<Self, String> {
        Ok(Self {
            schema: NATIVE_PAGE_SCHEMA.into(),
            encoded: crate::expression_performance_codec::EncodedPage::from_value(
                &NativeRecordingContent::Applied(Box::new(batch)),
            )?,
        })
    }
    pub fn batch(&self) -> Result<NativeRecordingBatch, String> {
        if self.schema != NATIVE_PAGE_SCHEMA {
            return Err("unsupported native recording page".into());
        }
        match self.encoded.read::<NativeRecordingContent>()? {
            NativeRecordingContent::Applied(batch) => Ok(*batch),
            NativeRecordingContent::Terminated(_) => {
                Err("native page is a reservation termination".into())
            }
        }
    }
    /// Coalesce bounded adjacent native pulses in the current edition. Earlier
    /// editions still own their immutable original pages in the Act catalog.
    /// Each application retains its original committed cursor/manifest/clock;
    /// periodic paired checkpoints retain full q/v/voices for bounded seeking.
    pub fn combined(&self, next: &Self) -> Result<Option<Self>, String> {
        if self.termination()?.is_some() || next.termination()?.is_some() {
            return Ok(None);
        }
        let mut before = self.batch()?;
        let after = next.batch()?;
        let previous_input = before
            .input_journal
            .last()
            .map_or(before.previous_input_ordinal, |e| e.ordinal);
        if before.basis != after.basis
            || before.layer != after.layer
            || before.parameter_bindings != after.parameter_bindings
            || before.state.identity != after.state.identity
            || before.state.basis_digest != after.state.basis_digest
            || before.state.transport_epoch != after.state.transport_epoch
            || before.state.applied_high_water != after.previous_applied_application_ordinal
            || previous_input != after.previous_input_ordinal
            || before.state.committed_cursor > after.state.committed_cursor
            || before.receipts.len() + after.receipts.len() > MAX_BATCH
            || before.input_journal.len() + after.input_journal.len() > MAX_BATCH
        {
            return Ok(None);
        }
        for key in [
            "event_ref",
            "subject_ref",
            "source_coordinate",
            "source_revision",
            "source_generation",
            "eigenbasis_identity",
            "sample_rate",
            "pratibimba",
        ] {
            if before.state.physical[key] != after.state.physical[key] {
                return Ok(None);
            }
        }
        before.state = after.state;
        before.receipts.extend(after.receipts);
        before.input_journal.extend(after.input_journal);
        let combined = Self::from_native(before)?;
        combined.validate()?;
        Ok(Some(combined))
    }
    pub fn from_termination(
        performance: &Performance,
        termination: crate::expression_performance_reservation::NativeReservationTermination,
    ) -> Result<Self, String> {
        termination.validate(performance)?;
        Ok(Self {
            schema: NATIVE_PAGE_SCHEMA.into(),
            encoded: crate::expression_performance_codec::EncodedPage::from_value(
                &NativeRecordingContent::Terminated(Box::new(termination)),
            )?,
        })
    }
    pub fn termination(
        &self,
    ) -> Result<
        Option<crate::expression_performance_reservation::NativeReservationTermination>,
        String,
    > {
        if self.schema != NATIVE_PAGE_SCHEMA {
            return Err("unsupported native recording page".into());
        }
        match self.encoded.read::<NativeRecordingContent>()? {
            NativeRecordingContent::Applied(_) => Ok(None),
            NativeRecordingContent::Terminated(t) => Ok(Some(*t)),
        }
    }
    pub fn reservation_updates(
        &self,
    ) -> Result<
        Vec<(
            crate::expression_performance_reservation::NativeScoreReservation,
            Option<TimedEvent>,
        )>,
        String,
    > {
        if let Some(termination) = self.termination()? {
            return Ok(termination
                .reservations
                .into_iter()
                .map(|r| (r, None))
                .collect());
        }
        Ok(self
            .batch()?
            .receipts
            .into_iter()
            .filter_map(|r| {
                r.reservation
                    .map(|reserved| (reserved.reservation, r.performed_event))
            })
            .collect())
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.termination()?.is_some() {
            return Ok(());
        } // full source validated with containing Performance
        let b = self.batch()?;
        if b.schema != NATIVE_BATCH_SCHEMA
            || b.receipts.len() > MAX_BATCH
            || b.input_journal.len() > MAX_BATCH
            || b.parameter_bindings.len() > 7
            || (b.receipts.is_empty() && b.input_journal.is_empty())
            || b.state.transport_epoch.0 == 0
            || b.state.recording.failure != 0
            || b.state.recording.dropped_applications.0 != 0
        {
            return Err("native receipt page bounds/loss differ".into());
        }
        let mut ordinal = b.previous_applied_application_ordinal.0;
        let mut ids = BTreeSet::new();
        for r in &b.receipts {
            ordinal = ordinal
                .checked_add(1)
                .ok_or("application ordinal exhausted")?;
            if r.basis != b.basis
                || r.application.applied_application_ordinal.0 != ordinal
                || !ids.insert(r.application.sequence)
                || r.recorded_sequence
                    != r.performed_event.as_ref().map(|e| e.0).or_else(|| {
                        r.reservation
                            .as_ref()
                            .map(|r| r.reservation.recorded_sequence)
                    })
                || r.application.applied != r.performed_event.is_some()
            {
                return Err("native receipt page lost application/occurrence identity".into());
            }
        }
        if ordinal != b.state.applied_high_water.0 {
            return Err("native page lost trailing application".into());
        }
        let mut input = b.previous_input_ordinal.0;
        for entry in &b.input_journal {
            input = input.checked_add(1).ok_or("input ordinal exhausted")?;
            if entry.ordinal.0 != input || entry.change > 4 || entry.operation > 6 {
                return Err("native page lost original input journal".into());
            }
        }
        if b.state
            .last_input_ordinal
            .is_some_and(|last| last.0 != input)
        {
            return Err("native page input high-water differs".into());
        }
        Ok(())
    }
}
/// Saved receipts remain historical facts even when an authored event is edited
/// or removed later. Their ORIGINAL operand is compared with the native receipt;
/// the current score is a distinct mutable projection of that exact history.
pub fn validate_recording_pages(performance: &Performance) -> Result<(), String> {
    let mut epochs = std::collections::BTreeMap::new();
    let mut ids = BTreeSet::new();
    let mut occurrences = BTreeSet::new();
    for page in &performance.native_recordings {
        page.validate()?;
        if let Some(termination) = page.termination()? {
            termination.validate(performance)?;
            continue;
        }
        let b = page.batch()?;
        let basis = performance
            .bases
            .get(usize::from(b.basis))
            .ok_or("receipt basis absent")?;
        if b.state.basis_digest != basis.content_digest
            || b.state.identity != basis.identity
            || usize::from(b.layer) >= performance.layers.len()
        {
            return Err("native recording page detached from saved basis/layer/context".into());
        }
        if let Some((applied, input)) = epochs.get(&b.state.transport_epoch) {
            if *applied != b.previous_applied_application_ordinal
                || *input != b.previous_input_ordinal
            {
                return Err("native recording page stream has gap/reorder".into());
            }
        }
        for receipt in &b.receipts {
            let app = &receipt.application;
            app.validate(basis, &b.state)?;
            if !ids.insert((b.state.transport_epoch, app.sequence)) {
                return Err("native accepted operation recorded twice".into());
            }
            if let Some(reserved) = &receipt.reservation {
                reserved.reservation.validate(performance)?;
                if reserved.reservation.transport_epoch != b.state.transport_epoch
                    || reserved.reservation.reconcile(app)? != *reserved
                {
                    return Err("retained reservation resolution differs".into());
                }
            }
            let original_input = input(app, &b.input_journal)?;
            if receipt.original_input.as_ref() != original_input {
                return Err("native saved original input differs".into());
            }
            if let Some(event) = &receipt.performed_event {
                if event.1 != app.applied_sample
                    || event.2 != b.layer
                    || event.3 != b.basis
                    || event.4
                        != performed_action(
                            performance,
                            b.basis,
                            app,
                            original_input,
                            &b.parameter_bindings,
                        )?
                    || !occurrences.insert(event.0)
                {
                    return Err("native saved performed operand differs".into());
                }
            }
        }
        epochs.insert(
            b.state.transport_epoch,
            (
                b.state.applied_high_water,
                b.input_journal
                    .last()
                    .map_or(b.previous_input_ordinal, |e| e.ordinal),
            ),
        );
    }
    Ok(())
}
