//! Native pulse -> one ordinary Scene performance edit. Register as a child
//! of native_expression, so only the actual qualified Manager channel can
//! supply NativeActChannelReply. Neither carrier has a JSON constructor.
//! The original reply is retained through every post-exchange refusal.
use super::act_channel::NativeActChannelReply;
use super::act_diagnostics::NativeDiagnosticReceipts;
use crate::expression::procedural::scene_receiver::SceneOwner;
use crate::expression::{Application, Change, Document, Request};
use crate::expression_performance::{
    CheckpointBinding, CheckpointReceipt, Counter, Performance, PerformanceOperation, Scope,
};
use crate::expression_performance_management::InputHistoryEntry;
use crate::expression_performance_recording::{
    prepare_recording, NativeRecordState, ParameterBinding, PreparedRecording, RecordAdmission,
};
use serde_json::Value;
use std::io::Write;

/// Authored destination and actor only. Native timing, targets, source identity
/// and stream heads are obtained from the actual owner and existing pages.
pub(crate) struct RecordingIntent {
    pub(crate) actor: String,
    pub(crate) basis: u16,
    pub(crate) layer: u16,
}

/// Prospective native material. A draft is not a played-event acknowledgement
/// or an applied Document edit. The original channel owns any diagnostic files.
pub(crate) struct PreparedNativeSceneRecording {
    before: Box<Document>,
    scene_ref: String,
    owner: SceneOwner,
    intent: RecordingIntent,
    recording: Option<Box<PreparedRecording>>,
    original_channel: Box<NativeActChannelReply>,
}

/// Post-exchange failures retain the original qualified carrier; no JSON
/// aggregate replaces its individual native receipt/diagnostic custody.
pub(crate) struct NativeSceneRecordingRefusal {
    reason: String,
    original_channel: Box<NativeActChannelReply>,
}
impl NativeSceneRecordingRefusal {
    pub(crate) fn reason(&self) -> &str {
        &self.reason
    }
    pub(super) fn into_channel(self) -> NativeActChannelReply {
        *self.original_channel
    }
}

fn counter(value: &Value) -> Result<Counter, String> {
    serde_json::from_value(value.clone()).map_err(|error| error.to_string())
}

/// Every initial epoch must start at its actual retained zero-application
/// checkpoint. Later checkpoints cannot justify dropping the original prefix.
/// Existing native page/termination codecs supply BOTH boundaries, including
/// the real transport acknowledgement which starts an after epoch.
fn require_original_recording_streams(performance: &Performance) -> Result<(), String> {
    let mut streams = std::collections::BTreeMap::new();
    let mut closed_epochs = std::collections::BTreeSet::new();
    for page in &performance.native_recordings {
        let (epoch, applied, input, cursor, digest) = page.recording_stream_before()?;
        if closed_epochs.contains(&epoch) {
            return Err("native recording page reused a terminated transport epoch".into());
        }
        let previous = if let Some(previous) = streams.get(&epoch) {
            *previous
        } else {
            let mut origin = None;
            for checkpoint in &performance.checkpoints {
                if checkpoint.basis_digest != digest || checkpoint.sample > cursor {
                    continue;
                }
                let Some(management) = checkpoint.management.as_ref() else {
                    continue;
                };
                if management.transport_epoch != epoch
                    || counter(&checkpoint.audio["applied_application_ordinal"])? != Counter(0)
                {
                    continue;
                }
                checkpoint.validate()?;
                let candidate = (
                    Counter(0),
                    management.input_history.last_ordinal,
                    checkpoint.sample,
                );
                if origin.is_none_or(|(_, _, sample)| checkpoint.sample < sample) {
                    origin = Some(candidate);
                }
            }
            origin.ok_or("native first recording page has no original retained origin")?
        };
        if applied != previous.0 || input != previous.1 || cursor < previous.2 {
            return Err(
                "native first/next recording page lost its original application/input prefix"
                    .into(),
            );
        }
        let (after_epoch, after_applied, after_input, after_cursor, _) =
            page.recording_stream_after()?;
        if after_epoch != epoch
            && (streams.contains_key(&after_epoch) || closed_epochs.contains(&after_epoch))
        {
            return Err("native termination reused an already-retained transport epoch".into());
        }
        if page.termination()?.is_some() {
            // Lost retains its literal same-epoch after checkpoint as historical
            // evidence. A cancellation may start the distinct ACK epoch; neither
            // permits another page to revive the original before epoch.
            closed_epochs.insert(epoch);
        }
        streams.insert(after_epoch, (after_applied, after_input, after_cursor));
    }
    Ok(())
}

/// Metadata comes from the existing codec owner after its complete page
/// validation, including C37's actual post-observer stream. No second codec.
fn previous_stream(
    performance: &Performance,
    basis: u16,
    epoch: Counter,
    committed_cursor: Counter,
) -> Result<(Counter, Counter), String> {
    require_original_recording_streams(performance)?;
    for page in &performance.native_recordings {
        if page.termination()?.is_some() && page.recording_stream_before()?.0 == epoch {
            return Err("recording command targets a terminated transport epoch".into());
        }
    }
    let selected = performance
        .bases
        .get(usize::from(basis))
        .ok_or("recording basis absent")?;
    let mut last = None;
    for page in &performance.native_recordings {
        let (page_epoch, applied, input, cursor, digest) = page.recording_stream_after()?;
        if digest == selected.content_digest {
            if cursor > committed_cursor {
                return Err("recording owner is behind its retained native page".into());
            }
            last = Some((page_epoch, applied, input));
        }
    }
    if let Some((previous_epoch, applied, input)) = last {
        if previous_epoch != epoch {
            return Err("recording epoch changed without a retained native continuation".into());
        }
        return Ok((applied, input));
    }
    // First record requires an actual retained native origin with NO committed
    // applications. Original queued input history may exist and stays in that
    // checkpoint. A caller cannot choose an arbitrary high water to hide loss.
    let mut origin = None;
    for checkpoint in &performance.checkpoints {
        if checkpoint.basis_digest != selected.content_digest
            || checkpoint.identity != selected.identity
            || checkpoint.sample > committed_cursor
        {
            continue;
        }
        checkpoint.validate()?;
        let Some(management) = &checkpoint.management else {
            continue;
        };
        if management.transport_epoch != epoch
            || counter(&checkpoint.audio["applied_application_ordinal"])? != Counter(0)
        {
            continue;
        }
        if origin
            .as_ref()
            .is_none_or(|(sample, _)| *sample < checkpoint.sample)
        {
            origin = Some((checkpoint.sample, management.input_history.last_ordinal));
        }
    }
    origin
        .map(|(_, input)| (Counter(0), input))
        .ok_or_else(|| "recording has no retained native origin/prefix; old applications cannot be silently skipped".into())
}

/// Before any native command can mutate or drain its owner, the current
/// complete retained material must already have its actual origin and valid
/// original page prefix. Native clock/current pulse facts remain native; this
/// check neither inspects the worker nor invents a checkpoint/high-water.
pub(super) fn require_retained_recording_prefix(
    performance: &Performance,
    intent: &RecordingIntent,
) -> Result<(), String> {
    performance.validate()?;
    crate::expression::text(&intent.actor)?;
    if performance.layers.get(usize::from(intent.layer)).is_none() {
        return Err("recording authored layer absent before native delivery".into());
    }
    let selected = performance
        .bases
        .get(usize::from(intent.basis))
        .ok_or("recording authored basis absent before native delivery")?;
    let mut stream = None;
    for page in &performance.native_recordings {
        let (epoch, _, _, cursor, digest) = page.recording_stream_after()?;
        if digest == selected.content_digest {
            stream = Some((epoch, cursor));
        }
    }
    let mut origin = None;
    for checkpoint in &performance.checkpoints {
        if checkpoint.basis_digest != selected.content_digest
            || checkpoint.identity != selected.identity
        {
            continue;
        }
        checkpoint.validate()?;
        let Some(management) = checkpoint.management.as_ref() else {
            continue;
        };
        if counter(&checkpoint.audio["applied_application_ordinal"])? != Counter(0) {
            continue;
        }
        if stream.is_some_and(|(epoch, cursor)| {
            epoch != management.transport_epoch || checkpoint.sample > cursor
        }) {
            continue;
        }
        if origin.is_none_or(|(_, sample)| checkpoint.sample > sample) {
            origin = Some((management.transport_epoch, checkpoint.sample));
        }
    }
    let (epoch, cursor) = stream
        .or(origin)
        .ok_or("recording has no retained native origin/prefix before command delivery")?;
    // A genuine cancellation's AFTER stream is retained inside its original
    // termination page, not as another standalone checkpoint. previous_stream
    // validates every original page back to the real origin before accepting
    // that actual ACK stream; a terminal Lost epoch still refuses there.
    previous_stream(performance, intent.basis, epoch, cursor)?;
    parameter_bindings(performance)?;
    Ok(())
}

fn parameter_bindings(performance: &Performance) -> Result<Vec<ParameterBinding>, String> {
    let mut result = Vec::new();
    for native_parameter in 0..7 {
        let (field, unit) =
            crate::expression_performance_recording::parameter_field(native_parameter)?;
        let target = format!("ql:performance/parameter/{}", field.replace('_', "-"));
        let matches: Vec<_> = performance
            .parameters
            .iter()
            .enumerate()
            .filter(|(_, parameter)| {
                parameter.native_owner == "ql.performance.Engine"
                    && parameter.action_ref == "ql:native-performance/parameter"
                    && parameter.target_ref == target
                    && parameter.unit == unit
                    && parameter.scope == Scope::Instrument
            })
            .collect();
        match matches.as_slice() {
            [] => {}
            [(index, _)] => result.push(ParameterBinding {
                native_parameter,
                performance_parameter: u16::try_from(*index).map_err(|error| error.to_string())?,
            }),
            _ => return Err("recording parameter has multiple declared native targets".into()),
        }
    }
    Ok(result)
}

/// Strict existing native journal fields plus an independent total copied by
/// Management. This is a data validator, not a Scene/lease/source constructor.
fn complete_input_journal(
    original: &Value,
    native_high_water: &Value,
    previous: Counter,
) -> Result<Vec<InputHistoryEntry>, String> {
    let journal: Vec<InputHistoryEntry> =
        serde_json::from_value(original.clone()).map_err(|error| error.to_string())?;
    if journal.len() > 256 {
        return Err("recording input journal exceeds native bounded batch".into());
    }
    let mut ordinal = previous.0;
    for row in &journal {
        ordinal = ordinal
            .checked_add(1)
            .ok_or("native input ordinal exhausted")?;
        if row.ordinal != Counter(ordinal) {
            return Err("recording lost/reordered original native input journal prefix".into());
        }
    }
    if counter(native_high_water)? != Counter(ordinal) {
        return Err("recording lost a trailing original native input journal entry".into());
    }
    Ok(journal)
}

struct OriginalNativeBatch<'a> {
    state: &'a NativeRecordState,
    epoch: Counter,
    cursor: Counter,
    applied_high_water: Counter,
    input_high_water: &'a Value,
    applications: &'a [Value],
    input_journal: &'a Value,
}
fn compile_original_batch(
    performance: &Performance,
    intent: &RecordingIntent,
    batch: OriginalNativeBatch<'_>,
) -> Result<Option<Box<PreparedRecording>>, String> {
    let OriginalNativeBatch {
        state,
        epoch,
        cursor,
        applied_high_water,
        input_high_water: native_input_high_water,
        applications,
        input_journal: original_journal,
    } = batch;
    performance.validate()?;
    crate::expression::text(&intent.actor)?;
    if performance.layers.get(usize::from(intent.layer)).is_none() {
        return Err("recording layer absent".into());
    }
    let (previous_applied_application_ordinal, previous_input_ordinal) =
        previous_stream(performance, intent.basis, epoch, cursor)?;
    let journal = complete_input_journal(
        original_journal,
        native_input_high_water,
        previous_input_ordinal,
    )?;
    if applications.is_empty() && journal.is_empty() {
        if applied_high_water != previous_applied_application_ordinal {
            return Err("empty native pulse lost committed applications".into());
        }
        return Ok(None);
    }
    let parameters = parameter_bindings(performance)?;
    prepare_recording(
        performance,
        RecordAdmission {
            state,
            basis: intent.basis,
            layer: intent.layer,
            previous_applied_application_ordinal,
            expected_transport_epoch: epoch,
            previous_input_ordinal,
            parameter_bindings: &parameters,
        },
        applications,
        &journal,
    )
    .map(|prepared| Some(Box::new(prepared)))
}

fn compile_original_pulse(
    performance: &Performance,
    intent: &RecordingIntent,
    pulse: &Value,
) -> Result<Option<Box<PreparedRecording>>, String> {
    let basis = performance
        .bases
        .get(usize::from(intent.basis))
        .ok_or("recording basis absent")?;
    let state = NativeRecordState::from_worker_reply(basis, pulse)?;
    let epoch = counter(&pulse["reading"]["transport_epoch"])?;
    let cursor = counter(&pulse["reading"]["samples_elapsed"])?;
    let applications = pulse["applications"]
        .as_array()
        .ok_or("original native applications absent")?;
    // Both are stamped from the same post-feedback ManagementPulse. No row
    // tail, historical checkpoint or earlier Engine readback supplies this total.
    if counter(&pulse["last_input_ordinal"])? != counter(&pulse["reading"]["last_input_ordinal"])? {
        return Err("native pulse/readback input high-water differ".into());
    }
    compile_original_batch(
        performance,
        intent,
        OriginalNativeBatch {
            state: &state,
            epoch,
            cursor,
            applied_high_water: counter(&pulse["reading"]["last_applied_application_ordinal"])?,
            input_high_water: &pulse["last_input_ordinal"],
            applications,
            input_journal: &pulse["input_history"],
        },
    )
}

impl Application {
    /// Manager alone owns this typed reply. The Arc/Map/live/current Doc checks
    /// happen before and after compilation, before any ordinary native edit.
    pub(super) fn prepare_native_scene_recording(
        &self,
        before: &Document,
        scene_ref: &str,
        owner: SceneOwner,
        expected_request_id: u64,
        intent: RecordingIntent,
        reply: NativeActChannelReply,
    ) -> Result<PreparedNativeSceneRecording, NativeSceneRecordingRefusal> {
        let prepared = (|| {
            self.require_procedural_scene_owner(&owner, before)?;
            let fact = owner.closed_constructor_fact(before, scene_ref)?;
            crate::expression_act_storage::measure(before, crate::expression::DOCUMENT_BYTES)?;
            let scene = before
                .scenes
                .iter()
                .find(|scene| scene.scene_ref == scene_ref)
                .ok_or("recording selected current Scene absent")?;
            let original = scene
                .performance
                .as_ref()
                .ok_or("recording Scene has no retained native performance")?;
            let envelope = reply.value();
            let selection = &envelope["result"]["selection"];
            let document_bytes = serde_json::to_vec(before).map_err(|error| error.to_string())?;
            let scene_bytes = serde_json::to_vec(scene).map_err(|error| error.to_string())?;
            // Both native owners serialize THIS typed Document with the same
            // compact Serde JSON serializer. Compare their actual algorithms,
            // not two caller-selected digest strings or sorted Value bytes.
            let constructor_hash =
                crate::native_expression::procedural::bootstrap::fingerprint(before)?;
            if fact["document_sha256"] != constructor_hash
                || crate::expression_file::digest(&document_bytes)
                    != format!("sha256:{constructor_hash}")
            {
                return Err(
                    "native Scene constructor and C Document canonical bytes differ".into(),
                );
            }
            if expected_request_id == 0
                || envelope["schema"] != "ql.native-act-owner-result/v1"
                || counter(&envelope["request_id"])? != Counter(expected_request_id)
                || counter(&envelope["last_request_id"])? != Counter(expected_request_id)
                || envelope["available"] != true
                || envelope["status"] != "ok"
                || envelope["result"]["schema"] != "ql.native-scene-recording-capture/v1"
                || envelope["result"]["accepted"] != true
                || envelope["instance_ref"]
                    != original
                        .bases
                        .get(usize::from(intent.basis))
                        .ok_or("recording basis absent")?
                        .identity
                        .instance_ref
                || selection["native_parent_qualification"] != *reply.qualification()
                || selection["source_custody"] != "current-document"
                || selection["scene_constructor"] != fact
                || selection["expression_ref"] != before.expression_ref
                || selection["expression_revision"].as_u64() != Some(before.revision)
                || selection["scene_ref"] != scene_ref
                || selection["scene_revision"].as_u64() != Some(scene.revision)
                || selection["expanded_document_sha256"]
                    != crate::expression_file::digest(&document_bytes)
                || selection["selected_scene_sha256"]
                    != crate::expression_file::digest(&scene_bytes)
                || ["act_ref", "act_revision", "act_digest", "edition_position"]
                    .iter()
                    .any(|key| selection.get(*key).is_some())
            {
                return Err(
                    "recording lost original qualified channel/current Scene constructor/CAS"
                        .into(),
                );
            }
            let recording =
                compile_original_pulse(original, &intent, &envelope["result"]["native_pulse"])?;
            self.require_procedural_scene_owner(&owner, before)?;
            Ok(recording)
        })();
        match prepared {
            Ok(recording) => Ok(PreparedNativeSceneRecording {
                before: Box::new(before.clone()),
                scene_ref: scene_ref.into(),
                owner,
                intent,
                recording,
                original_channel: Box::new(reply),
            }),
            Err(reason) => Err(NativeSceneRecordingRefusal {
                reason,
                original_channel: Box::new(reply),
            }),
        }
    }
}

impl PreparedNativeSceneRecording {
    fn request(&self) -> Option<Request> {
        self.recording.as_ref().map(|recording| Request::Edit {
            expression_ref: self.before.expression_ref.clone(),
            expected_revision: self.before.revision,
            actor: self.intent.actor.clone(),
            changes: vec![Change::ScenePerformanceEdit {
                scene_ref: self.scene_ref.clone(),
                operations: recording.record_operations(),
            }],
        })
    }
}

/// An actual edit receipt and its post-adoption verification are separate.
/// Even a failed/stale commit returns the full native carrier already consumed.
pub struct NativeSceneRecordingCommit {
    application: Result<Option<crate::KernelOpOutcome>, String>,
    currentness: Result<(), String>,
    native_reply: Value,
    diagnostics: NativeDiagnosticReceipts,
}
impl NativeSceneRecordingCommit {
    pub fn application(&self) -> Result<Option<&crate::KernelOpOutcome>, &str> {
        self.application
            .as_ref()
            .map(|result| result.as_ref())
            .map_err(String::as_str)
    }
    pub fn currentness(&self) -> Result<(), &str> {
        self.currentness
            .as_ref()
            .map(|()| ())
            .map_err(String::as_str)
    }
    pub fn native_reply(&self) -> &Value {
        &self.native_reply
    }
    pub fn diagnostic_reading(&self) -> Value {
        self.diagnostics.reading()
    }
    /// Copies one original into the existing native file/disclosure operation.
    /// No aggregate is reconstructed and no imported path grants custody.
    pub fn write_diagnostic_receipt(
        &self,
        ordinal: u64,
        output: &mut impl Write,
    ) -> Result<(), String> {
        self.diagnostics.write_receipt(ordinal, output)
    }
    pub fn with_diagnostic_receipt<T>(
        &self,
        kind: &str,
        index: usize,
        consumer: impl FnOnce(&Value) -> Result<T, String>,
    ) -> Result<T, String> {
        self.diagnostics.with_receipt(kind, index, consumer)
    }
}
impl crate::Kernel {
    pub(crate) fn finish_native_scene_recording(
        &mut self,
        prepared: PreparedNativeSceneRecording,
    ) -> NativeSceneRecordingCommit {
        let before_current = self
            .expressions
            .require_procedural_scene_owner(&prepared.owner, &prepared.before);
        let application = match before_current {
            Ok(()) => match prepared.request() {
                Some(request) => self
                    .apply(crate::KernelOp::Expression { request })
                    .map(Some),
                None => Ok(None),
            },
            Err(reason) => Err(reason),
        };
        let currentness = (|| {
            application.as_ref().map_err(Clone::clone)?;
            let Some(recording) = &prepared.recording else {
                return self
                    .expressions
                    .require_procedural_scene_owner(&prepared.owner, &prepared.before);
            };
            let revision = prepared
                .before
                .revision
                .checked_add(1)
                .ok_or("recording Document revision exhausted")?;
            let after = self
                .expressions
                .procedural_source_snapshot(&prepared.before.expression_ref, revision)?;
            let scene = after
                .scenes
                .iter()
                .find(|scene| scene.scene_ref == prepared.scene_ref)
                .ok_or("recorded Scene disappeared after ordinary native edit")?;
            if scene.performance.as_ref() != Some(recording.prospective()) {
                return Err("ordinary native edit did not adopt the complete original recording page/events".into());
            }
            let after_owner = self
                .expressions
                .procedural_scene_owner(&after, &prepared.scene_ref)?;
            self.expressions
                .require_procedural_scene_owner(&after_owner, &after)?;
            if after_owner.instance_ref() != prepared.owner.instance_ref()
                || after_owner.construction_generation() != prepared.owner.construction_generation()
                || after_owner.generation_domain() != prepared.owner.generation_domain()
            {
                return Err("recording edit replaced the original native Scene constructor".into());
            }
            Ok(())
        })();
        let (native_reply, diagnostics) = (*prepared.original_channel).into_custody();
        NativeSceneRecordingCommit {
            application,
            currentness,
            native_reply,
            diagnostics,
        }
    }
}

#[cfg(test)]
#[path = "expression_native_performance_recording_tests.rs"]
mod tests;

/// Authored origin address only. The native checkpoint and all clocks come
/// from the same stopped owner through the qualified current-Scene channel.
pub(crate) struct RecordingOriginIntent {
    pub(crate) actor: String,
    pub(crate) basis: u16,
    pub(crate) checkpoint_ref: String,
}
pub(crate) struct PreparedNativeSceneOrigin {
    before: Box<Document>,
    scene_ref: String,
    owner: SceneOwner,
    intent: RecordingOriginIntent,
    prospective: Box<Performance>,
    checkpoint: Box<CheckpointBinding>,
    original_channel: Box<NativeActChannelReply>,
}
/// Pure data validation is not authority. This compiler is called only after
/// the actual Application Arc/Map/lease/channel selection is independently
/// qualified; tests also exercise genuine native producer bytes here.
fn compile_origin_wire(
    performance: &Performance,
    basis: u16,
    checkpoint_ref: &str,
    wire: &Value,
) -> Result<CheckpointBinding, String> {
    performance.validate()?;
    crate::expression::text(checkpoint_ref)?;
    let selected = performance
        .bases
        .get(usize::from(basis))
        .ok_or("recording origin basis absent")?;
    if performance
        .checkpoints
        .iter()
        .any(|c| c.basis_digest == selected.content_digest)
        || performance.native_recordings.iter().any(|p| {
            p.recording_stream_after()
                .is_ok_and(|(_, _, _, _, digest)| digest == selected.content_digest)
        })
    {
        return Err("recording already has a retained native origin/history; preserve it instead of overwriting".into());
    }
    let audio = &wire["native_pair"]["audio"];
    let sample = counter(&audio["cursor"])?;
    let checkpoint = CheckpointBinding::from_native_management(
        CheckpointReceipt {
            checkpoint_ref: checkpoint_ref.into(),
            identity: selected.identity.clone(),
            sample,
            basis_digest: selected.content_digest.clone(),
            event_prefix_digest: performance.prefix_digest(sample.0)?,
            queued_events: vec![],
            acknowledged_stopped: true,
        },
        wire.clone(),
    )?;
    let management = checkpoint
        .management
        .as_ref()
        .ok_or("recording origin lacks actual native management custody")?;
    if sample > performance.duration_samples
        || counter(&audio["accepted_sequence"])? != Counter(0)
        || counter(&audio["applied_application_ordinal"])? != Counter(0)
        || !audio["applications"]["entries"]
            .as_array()
            .is_some_and(Vec::is_empty)
        || management.input_history.last_ordinal != Counter(0)
        || !management.inputs.is_empty()
        || !management.input_history.entries.is_empty()
        || audio["recording"]["failure"] != 0
        || counter(&audio["recording"]["dropped_applications"])? != Counter(0)
    {
        return Err(
            "recording origin is not the actual pre-input/pre-application native checkpoint".into(),
        );
    }
    // Existing native checkpoint/source/body compiler binds all identity,
    // preparation, source generations and same physical/audio cursor.
    NativeRecordState::from_checkpoint(selected, &checkpoint)?;
    Ok(checkpoint)
}
impl Application {
    pub(super) fn prepare_native_scene_recording_origin(
        &self,
        before: &Document,
        scene_ref: &str,
        owner: SceneOwner,
        expected_request_id: u64,
        intent: RecordingOriginIntent,
        reply: NativeActChannelReply,
    ) -> Result<PreparedNativeSceneOrigin, NativeSceneRecordingRefusal> {
        let basis = intent.basis;
        let prepared = (|| -> Result<(CheckpointBinding, Performance), String> {
            self.require_procedural_scene_owner(&owner, before)?;
            let fact = owner.closed_constructor_fact(before, scene_ref)?;
            crate::expression_act_storage::measure(before, crate::expression::DOCUMENT_BYTES)?;
            let scene = before
                .scenes
                .iter()
                .find(|scene| scene.scene_ref == scene_ref)
                .ok_or("recording selected current Scene absent")?;
            let original = scene
                .performance
                .as_ref()
                .ok_or("recording Scene has no retained native performance")?;
            let envelope = reply.value();
            let selection = &envelope["result"]["selection"];
            let document_bytes = serde_json::to_vec(before).map_err(|error| error.to_string())?;
            let scene_bytes = serde_json::to_vec(scene).map_err(|error| error.to_string())?;
            // Both native owners serialize THIS typed Document with the same
            // compact Serde JSON serializer. Compare their actual algorithms,
            // not two caller-selected digest strings or sorted Value bytes.
            let constructor_hash =
                crate::native_expression::procedural::bootstrap::fingerprint(before)?;
            if fact["document_sha256"] != constructor_hash
                || crate::expression_file::digest(&document_bytes)
                    != format!("sha256:{constructor_hash}")
            {
                return Err(
                    "native Scene constructor and C Document canonical bytes differ".into(),
                );
            }
            if expected_request_id == 0
                || envelope["schema"] != "ql.native-act-owner-result/v1"
                || counter(&envelope["request_id"])? != Counter(expected_request_id)
                || counter(&envelope["last_request_id"])? != Counter(expected_request_id)
                || envelope["available"] != true
                || envelope["status"] != "ok"
                || envelope["result"]["schema"] != "ql.native-scene-recording-origin/v1"
                || envelope["result"]["accepted"] != true
                || envelope["instance_ref"]
                    != original
                        .bases
                        .get(usize::from(basis))
                        .ok_or("recording basis absent")?
                        .identity
                        .instance_ref
                || selection["native_parent_qualification"] != *reply.qualification()
                || selection["source_custody"] != "current-document"
                || selection["scene_constructor"] != fact
                || selection["expression_ref"] != before.expression_ref
                || selection["expression_revision"].as_u64() != Some(before.revision)
                || selection["scene_ref"] != scene_ref
                || selection["scene_revision"].as_u64() != Some(scene.revision)
                || selection["expanded_document_sha256"]
                    != crate::expression_file::digest(&document_bytes)
                || selection["selected_scene_sha256"]
                    != crate::expression_file::digest(&scene_bytes)
                || ["act_ref", "act_revision", "act_digest", "edition_position"]
                    .iter()
                    .any(|key| selection.get(*key).is_some())
            {
                return Err(
                    "recording lost original qualified channel/current Scene constructor/CAS"
                        .into(),
                );
            }

            crate::expression::text(&intent.actor)?;
            let pulse = &envelope["result"]["native_pulse"];
            let selected = original
                .bases
                .get(usize::from(basis))
                .ok_or("recording origin basis absent")?;
            NativeRecordState::from_worker_reply(selected, pulse)?;
            if pulse["accepted"] != true
                || !matches!(
                    pulse["reading"]["device"]["state"].as_str(),
                    Some("closed" | "prepared")
                )
                || counter(&pulse["last_input_ordinal"])? != Counter(0)
                || counter(&pulse["reading"]["last_input_ordinal"])? != Counter(0)
                || counter(&pulse["reading"]["accepted_sequence"])? != Counter(0)
                || counter(&pulse["reading"]["last_applied_application_ordinal"])? != Counter(0)
                || !pulse["applications"].as_array().is_some_and(Vec::is_empty)
                || !pulse["input_history"].as_array().is_some_and(Vec::is_empty)
            {
                return Err("recording origin pulse contains input/application or lacks actual stopped acknowledgement".into());
            }
            let checkpoint = compile_origin_wire(
                original,
                basis,
                &intent.checkpoint_ref,
                &pulse["payload"]["checkpoint"],
            )?;
            if checkpoint.sample != counter(&pulse["reading"]["samples_elapsed"])?
                || checkpoint
                    .management
                    .as_ref()
                    .ok_or("native origin management absent")?
                    .transport_epoch
                    != counter(&pulse["reading"]["transport_epoch"])?
            {
                return Err("actual stopped origin checkpoint and pulse boundary differ".into());
            }
            let prospective = original
                .clone()
                .edited(vec![PerformanceOperation::Checkpoint {
                    checkpoint: Box::new(checkpoint.clone()),
                }])?;
            self.require_procedural_scene_owner(&owner, before)?;
            Ok((checkpoint, prospective))
        })();
        match prepared {
            Ok((checkpoint, prospective)) => Ok(PreparedNativeSceneOrigin {
                before: Box::new(before.clone()),
                scene_ref: scene_ref.into(),
                owner,
                intent,
                prospective: Box::new(prospective),
                checkpoint: Box::new(checkpoint),
                original_channel: Box::new(reply),
            }),
            Err(reason) => Err(NativeSceneRecordingRefusal {
                reason,
                original_channel: Box::new(reply),
            }),
        }
    }
}
impl crate::Kernel {
    pub(crate) fn finish_native_scene_recording_origin(
        &mut self,
        prepared: PreparedNativeSceneOrigin,
    ) -> NativeSceneRecordingCommit {
        let application = self
            .expressions
            .require_procedural_scene_owner(&prepared.owner, &prepared.before)
            .and_then(|()| {
                self.apply(crate::KernelOp::Expression {
                    request: Request::Edit {
                        expression_ref: prepared.before.expression_ref.clone(),
                        expected_revision: prepared.before.revision,
                        actor: prepared.intent.actor.clone(),
                        changes: vec![Change::ScenePerformanceEdit {
                            scene_ref: prepared.scene_ref.clone(),
                            operations: vec![PerformanceOperation::Checkpoint {
                                checkpoint: prepared.checkpoint,
                            }],
                        }],
                    },
                })
            })
            .map(Some);
        let currentness = (|| -> Result<(), String> {
            application.as_ref().map_err(Clone::clone)?;
            let after = self.expressions.procedural_source_snapshot(
                &prepared.before.expression_ref,
                prepared
                    .before
                    .revision
                    .checked_add(1)
                    .ok_or("origin Document revision exhausted")?,
            )?;
            let scene = after
                .scenes
                .iter()
                .find(|s| s.scene_ref == prepared.scene_ref)
                .ok_or("origin Scene absent after native edit")?;
            if scene.performance.as_ref() != Some(prepared.prospective.as_ref()) {
                return Err("ordinary Scene edit lost actual original native checkpoint".into());
            }
            let owner = self
                .expressions
                .procedural_scene_owner(&after, &prepared.scene_ref)?;
            self.expressions
                .require_procedural_scene_owner(&owner, &after)?;
            if owner.instance_ref() != prepared.owner.instance_ref()
                || owner.construction_generation() != prepared.owner.construction_generation()
            {
                return Err("origin edit replaced actual Scene lifetime".into());
            }
            Ok(())
        })();
        let (native_reply, diagnostics) = (*prepared.original_channel).into_custody();
        NativeSceneRecordingCommit {
            application,
            currentness,
            native_reply,
            diagnostics,
        }
    }
}

impl NativeSceneRecordingCommit {
    pub(super) fn into_dispatch_parts(
        self,
    ) -> (
        Result<Option<crate::KernelOpOutcome>, String>,
        Result<(), String>,
        Value,
        NativeDiagnosticReceipts,
    ) {
        (
            self.application,
            self.currentness,
            self.native_reply,
            self.diagnostics,
        )
    }
}

impl NativeSceneRecordingCommit {
    pub(super) fn from_native_definition(
        application: Result<Option<crate::KernelOpOutcome>, String>,
        currentness: Result<(), String>,
        native_reply: Value,
    ) -> Self {
        Self {
            application,
            currentness,
            native_reply,
            diagnostics: NativeDiagnosticReceipts::empty(),
        }
    }
}
