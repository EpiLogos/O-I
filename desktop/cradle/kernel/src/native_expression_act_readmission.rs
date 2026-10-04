//! Actual closed Act → qualified existing channel → receiving continuation.
//! The live handle is neither deserializable nor constructible from JSON.
use super::act_channel::NativeActChannelReply;
use super::recording_channel::NativeCurrentRecordingRefusal;
use super::{Manager, Owner, cursor};
use crate::expression_performance::{
    CheckpointBinding, CheckpointReceipt, Counter, Performance, PerformanceOperation,
    QueuedEventReceipt,
};
use crate::expression_performance_reader::NativeActDeliveryReader;
use crate::expression_performance_readmission::RetainedReceivingReadmission;
use crate::expression_performance_recording::NativeRecordingPage;
use crate::expression_performance_reservation::{
    NativeReservationContinuation, NativeTransportAcknowledgement,
};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

use crate::expression_performance_source_readoption::exact_native_value as exact_request_value;

/// Borrowed only after the SAME qualified channel owns both complete original
/// files. The native owner has already regenerated source/N9/catalog; this
/// check retains their exact request/response/before-cut correspondence.
pub(super) fn qualify_original_source_request(
    request: &Value,
    before_source: &Value,
    readoption: &Value,
    original_wire: &str,
    checkpoint_ref: &str,
    transaction_ref: &str,
) -> Result<(), String> {
    let fields = [
        "schema",
        "session_ref",
        "transport_epoch",
        "expected_cursor",
        "expected_accepted_sequence",
        "transaction_ref",
        "checkpoint_ref",
        "original_before_checkpoint_wire",
        "original_checkpoint_wire",
        "before_source_packet",
        "before_native_basis",
        "packet",
        "actual_native_basis",
        "m1_pratibimba",
        "physical_pratibimba",
        "body_source",
        "current_source_packet",
        "receiving_admission",
        "current_receiving_admission",
        "current_receiving",
        "native_catalog",
    ];
    let object = request
        .as_object()
        .ok_or("original selected-source request absent")?;
    let has_acoustic = object.contains_key("original_saved_acoustic");
    let ack = &readoption["transport_ack"];
    let reading = &before_source["reading"];
    if object.len() != fields.len() + usize::from(has_acoustic)
        || fields.iter().any(|key| !object.contains_key(*key))
        || request["schema"] != "ql.native-selected-source-readoption-request/v1"
        || request["session_ref"] != reading["session_ref"]
        || request["transport_epoch"] != reading["transport_epoch"]
        || request["expected_cursor"] != reading["samples_elapsed"]
        || request["expected_accepted_sequence"] != reading["accepted_sequence"]
        || request["transaction_ref"] != transaction_ref
        || request["checkpoint_ref"] != checkpoint_ref
        || request["original_checkpoint_wire"].as_str() != Some(original_wire)
        || request["original_before_checkpoint_wire"] != readoption["before_checkpoint_wire"]
        || request["original_checkpoint_wire"] != readoption["original_checkpoint_wire"]
        || request["transport_epoch"] != ack["previous_epoch"]
        || request["expected_cursor"] != ack["previous_cursor"]
        || request["expected_accepted_sequence"] != ack["previous_sequence"]
        || request["m1_pratibimba"].as_bool().is_none()
        || request["physical_pratibimba"].as_bool().is_none()
        || !request["body_source"].is_object()
        || !request["native_catalog"].is_array()
    {
        return Err(
            "original same-worker request lost its full before/selected transaction".into(),
        );
    }
    for (actual, original) in [
        (
            &request["before_source_packet"],
            &before_source["native_preparation"],
        ),
        (
            &request["before_native_basis"],
            &before_source["native_basis"],
        ),
        (&request["packet"], &request["current_source_packet"]),
        (
            &request["current_source_packet"],
            &readoption["current_source_packet"],
        ),
        (
            &request["actual_native_basis"],
            &readoption["actual_native_basis"],
        ),
        (
            &request["current_receiving"],
            &readoption["current_receiving"],
        ),
        (
            &request["receiving_admission"],
            &request["current_receiving_admission"],
        ),
    ] {
        if !exact_request_value(actual, original) {
            return Err(
                "original selected-source request changed a complete native operand".into(),
            );
        }
    }
    if has_acoustic
        != readoption
            .as_object()
            .is_some_and(|o| o.contains_key("original_saved_acoustic"))
        || (has_acoustic
            && !exact_request_value(
                &request["original_saved_acoustic"],
                &readoption["original_saved_acoustic"],
            ))
    {
        return Err("original selected-source request lost its saved acoustic producer".into());
    }
    Ok(())
}

/// Only the actual channel completion inside the borrowed reader constructs
/// this handle. A saved continuation can be validated, never reopened as one.
struct NativeReceivingReadmissionHandle {
    performance: Performance,
    continuation: NativeReservationContinuation,
}

/// Native prepared edit, to be committed through the existing Scene/Act CAS.
/// Full refused pulse survives as an observation even when no edit is admitted.
pub(crate) struct NativeActReceivingExecution {
    performance: Option<Box<Performance>>,
    error: Option<String>,
    original_channel: NativeActChannelReply,
}

fn checkpoint(
    performance: &Performance,
    original: &CheckpointBinding,
    wire: Value,
    reference: String,
) -> Result<CheckpointBinding, String> {
    let sample = cursor(&wire["native_pair"]["audio"]["cursor"])?;
    let mut pending = BTreeMap::new();
    let audio = &wire["native_pair"]["audio"];
    for (path, nested) in [
        ("/operations/entries", None),
        ("/releases/entries", None),
        ("/pending_operations", Some("operation")),
        ("/pending_releases", Some("release")),
    ] {
        let entries = audio
            .pointer(path)
            .and_then(Value::as_array)
            .ok_or("receiving checkpoint pending native queue absent")?;
        for entry in entries {
            let operation = nested.map_or(entry, |key| &entry[key]);
            let sequence = cursor(&operation["sequence"])?;
            let deadline = cursor(&operation["sample"])?;
            if pending.insert(sequence, deadline).is_some() {
                return Err(
                    "receiving checkpoint repeats pending native operation identity".into(),
                );
            }
        }
    }
    let epoch = Counter(cursor(&wire["transport_epoch"])?);
    let current_epochs =
        crate::expression_performance_reservation::reservation_epochs(performance)?;
    let mut mapped = Vec::with_capacity(pending.len());
    for (native_sequence, effective_sample) in pending {
        let matching: Vec<_> = performance
            .native_reservations
            .iter()
            .filter(|reserved| {
                reserved.native_sequence.0 == native_sequence
                    && reserved.effective_sample.0 == effective_sample
                    && current_epochs
                        .get(&(reserved.transport_epoch, reserved.native_sequence))
                        .copied()
                        .unwrap_or(reserved.transport_epoch)
                        == epoch
            })
            .collect();
        let recorded_sequence = if matching.len() == 1 {
            matching[0].recorded_sequence
        } else if let Some(exact) = original.queued_events.iter().find(|entry| {
            entry.native_sequence.0 == native_sequence
                && entry.effective_sample.0 == effective_sample
        }) {
            // Original saved native identity remains original across its
            // genuine ACK; it is not relabeled to the current epoch.
            exact.recorded_sequence
        } else {
            // C61's exact whole native queue stays explicitly unscored. It
            // becomes a performed event only on its actual future application.
            continue;
        };
        mapped.push(QueuedEventReceipt {
            native_sequence: Counter(native_sequence),
            recorded_sequence,
            effective_sample: Counter(effective_sample),
        });
    }
    CheckpointBinding::from_native_management_capturing_pending(
        CheckpointReceipt {
            checkpoint_ref: reference,
            identity: original.identity.clone(),
            sample: Counter(sample),
            basis_digest: original.basis_digest.clone(),
            event_prefix_digest: performance.prefix_digest(sample)?,
            queued_events: mapped,
            acknowledged_stopped: true,
        },
        wire,
    )
}

/// Pure echo qualification inside the SAME actual channel/closed-reader guard.
/// Returning () cannot mint a lease, source owner or restored body. The native
/// QL owner selects the full epoch from original checkpoint/source history;
/// this verifies its indices/reading against the original typed C selection.
pub(super) fn qualify_selected_source_projection(
    performance: &Performance,
    manifest: &Value,
    checkpoint: &CheckpointBinding,
    projection: &Value,
) -> Result<(), String> {
    crate::expression_performance_readmission::qualify_retained_source_projection(
        performance,
        checkpoint,
        projection,
        manifest["scene_ref"]
            .as_str()
            .ok_or("selected Scene ref absent")?,
    )?;
    let source_index = usize::try_from(
        projection["source_index"]
            .as_u64()
            .ok_or("restored source index absent")?,
    )
    .map_err(|e| e.to_string())?;
    let source = &performance.native_sources[source_index];
    if projection["expression_ref"] != manifest["expression_ref"]
        || manifest["native_source_parts"][source_index]["source_index"].as_u64()
            != Some(source_index as u64)
        || manifest["native_source_parts"][source_index]["reading"] != projection["source_reading"]
        || manifest["performance"]["native_sources"][source_index]
            != serde_json::to_value(source).map_err(|e| e.to_string())?
    {
        return Err("restored native epoch selection differs from the complete original source/part/checkpoint".into());
    }
    Ok(())
}

impl NativeReceivingReadmissionHandle {
    fn from_channel(
        reply: &NativeActChannelReply,
        manifest: &Value,
        selected_checkpoint: &Value,
        performance: &Performance,
        owner: &Owner,
        id: u64,
        transaction_ref: &str,
        actor: &str,
    ) -> Result<Self, String> {
        let received = reply.value();
        if received["schema"] != "ql.native-act-owner-result/v1"
            || received["instance_ref"] != owner.identity["instance_ref"]
            || cursor(&received["request_id"])? != id
            || cursor(&received["last_request_id"])? != id
            || received["available"] != true
            || received["status"] != "ok"
            || received["result"]["readmitted"] != true
        {
            return Err("actual selected Act receiving operation was not admitted".into());
        }
        let result = &received["result"];
        crate::expression_act_storage::measure(
            &(performance, received, selected_checkpoint),
            super::MAX_REPLY - 65536,
        )?;
        let selected = &result["selection"];
        if selected["manager_lease"] != owner.lease || cursor(&selected["native_request_id"])? != id
        {
            return Err("actual receiving reply lost its native lease/request custody".into());
        }
        for key in [
            "act_ref",
            "act_revision",
            "act_digest",
            "edition_position",
            "expanded_document_sha256",
            "scene_ref",
            "scene_revision",
            "performance_digest",
            "selected_performance_sha256",
        ] {
            if selected[key] != manifest[key] {
                return Err("actual receiving reply changed the complete selected Act".into());
            }
        }
        if selected["native_parent_qualification"] != *reply.qualification() {
            return Err(
                "actual receiving reply changed the independently qualified channel origin".into(),
            );
        }
        let original: CheckpointBinding =
            serde_json::from_value(selected_checkpoint["checkpoint"].clone())
                .map_err(|e| e.to_string())?;
        qualify_selected_source_projection(
            performance,
            manifest,
            &original,
            &result["retained_source_selection"],
        )?;
        let original_text = selected_checkpoint["canonical_native_wire_bytes"]
            .as_str()
            .ok_or("selected original checkpoint text absent")?;
        if result["native_source_readoption"].is_object() {
            let source = &result["native_source_readoption_before_source"];
            let readoption = &result["native_source_readoption"];
            let pulse = &result["native_pulse"];
            if !result["receiving_readmission"].is_null()
                || pulse["payload"]["source_readoption"] != *readoption
            {
                return Err(
                    "native source re-adoption is disconnected from the original pulse".into(),
                );
            }
            // Both exact originals were file-ACKed before the worker exchange.
            // The request is checked while borrowed; it is never a persisted
            // grant or a second aggregate copy inside the continued page.
            reply.with_original_receipt("source_readoption_original_request", 1, |request| {
                qualify_original_source_request(
                    request,
                    source,
                    readoption,
                    original_text,
                    &original.checkpoint_ref,
                    transaction_ref,
                )
            })?;
            let retained=reply.with_original_receipt("before_restoration_receipt",0,|before_receipt| {
                crate::expression_performance_source_readoption::RetainedNativeSourceReadoption::from_native_channel(original.clone(),original_text,source,before_receipt,readoption,&result["retained_source_selection"],selected,reply.qualification(),pulse)
            })?;
            let before_source_index = retained.before_source_index(performance)?;
            let before_asset = &performance.native_sources[before_source_index];
            let (before_basis_index, before_basis) = performance
                .bases
                .iter()
                .enumerate()
                .find(|(_, basis)| basis.content_digest == before_asset.basis_digest())
                .ok_or("actual resident BEFORE basis absent")?;
            let before_wire = retained.before_wire()?;
            // Bind the BEFORE cut to the resident's actual body, never selected.
            let before_identity = CheckpointReceipt {
                checkpoint_ref: format!("{transaction_ref}/before"),
                identity: before_basis.identity.clone(),
                sample: Counter(cursor(&before_wire["native_pair"]["audio"]["cursor"])?),
                basis_digest: before_basis.content_digest.clone(),
                event_prefix_digest: performance
                    .prefix_digest(cursor(&before_wire["native_pair"]["audio"]["cursor"])?)?,
                queued_events: Vec::new(),
                acknowledged_stopped: true,
            };
            let before = CheckpointBinding::from_native_management_capturing_pending(
                before_identity,
                before_wire,
            )?;
            let mut prospective = performance.clone();
            let layer = performance
                .native_recordings
                .iter()
                .rev()
                .filter_map(|page| page.batch().ok())
                .find(|batch| usize::from(batch.basis) == before_basis_index)
                .map_or(0, |batch| batch.layer);
            let intent = super::recording::RecordingIntent {
                actor: actor.into(),
                basis: u16::try_from(before_basis_index).map_err(|e| e.to_string())?,
                layer,
            };
            if let Some(recording) = super::recording::compile_original_pulse(
                performance,
                &intent,
                retained.original_before_restoration_receipt(),
            )? {
                prospective = prospective.edited(recording.record_operations())?;
            }
            let after = checkpoint(
                &prospective,
                &original,
                retained.after_wire()?,
                original.checkpoint_ref.clone(),
            )?;
            let ack: NativeTransportAcknowledgement =
                serde_json::from_value(readoption["transport_ack"].clone())
                    .map_err(|e| e.to_string())?;
            if ack.transaction_ref != transaction_ref
                || ack.checkpoint_ref != original.checkpoint_ref
            {
                return Err("source re-adoption changed original transaction/checkpoint".into());
            }
            let apps =
                serde_json::from_value(pulse["applications"].clone()).map_err(|e| e.to_string())?;
            let history = serde_json::from_value(pulse["input_history"].clone())
                .map_err(|e| e.to_string())?;
            let continuation = NativeReservationContinuation::from_native_with_source_readoption(
                &prospective,
                original,
                before,
                after,
                ack,
                apps,
                history,
                Some(Box::new(retained)),
            )?;
            return Ok(Self {
                performance: prospective,
                continuation,
            });
        }
        let readmission = &result["receiving_readmission"];
        let pulse = &result["native_pulse"];
        if pulse["payload"]["receiving_readmission"] != *readmission {
            return Err(
                "native readmission is disconnected from the full original worker pulse".into(),
            );
        }
        let retained = RetainedReceivingReadmission::from_native_channel(
            original.clone(),
            original_text,
            readmission,
            selected.clone(),
            reply.qualification().clone(),
            pulse.clone(),
            Some(result["retained_source_selection"].clone()),
        )?;
        let ack: NativeTransportAcknowledgement =
            serde_json::from_value(readmission["transport_ack"].clone())
                .map_err(|e| e.to_string())?;
        if ack.transaction_ref != transaction_ref || ack.checkpoint_ref != original.checkpoint_ref {
            return Err("actual receiving ACK changed its selected checkpoint/transaction".into());
        }
        let operative = checkpoint(
            performance,
            &original,
            retained.operative_wire()?,
            original.checkpoint_ref.clone(),
        )?;
        let before = checkpoint(
            performance,
            &original,
            retained.before_wire()?,
            format!("{transaction_ref}/before"),
        )?;
        let after = checkpoint(
            performance,
            &original,
            retained.after_wire()?,
            original.checkpoint_ref.clone(),
        )?;
        let applications =
            serde_json::from_value(pulse["applications"].clone()).map_err(|e| e.to_string())?;
        let history =
            serde_json::from_value(pulse["input_history"].clone()).map_err(|e| e.to_string())?;
        let mut continuation = NativeReservationContinuation::from_native(
            performance,
            operative,
            before,
            after,
            ack,
            applications,
            history,
        )?;
        continuation.receiving_readmission = Some(Box::new(retained));
        continuation.validate(performance)?;
        Ok(Self {
            performance: performance.clone(),
            continuation,
        })
    }
    fn retain(self) -> Result<Performance, String> {
        let page = NativeRecordingPage::from_continuation(&self.performance, self.continuation)?;
        self.performance
            .edited(vec![PerformanceOperation::RecordNative {
                events: Vec::new(),
                page,
            }])
    }
}
impl NativeActReceivingExecution {
    pub(super) fn into_parts(self) -> (Option<Performance>, Option<String>, NativeActChannelReply) {
        (
            self.performance.map(|p| *p),
            self.error,
            self.original_channel,
        )
    }
}

impl Manager {
    /// One held qualified transaction, borrowing only the actual closed Act
    /// reader. The original channel and partial diagnostic files survive every
    /// post-exchange validation, currentness or later ordinary Act CAS refusal.
    pub(crate) fn readmit_native_act_checkpoint(
        &mut self,
        lease: &str,
        reader: &mut NativeActDeliveryReader,
        generation: u64,
        index: usize,
        transaction_ref: &str,
        actor: &str,
    ) -> Result<NativeActReceivingExecution, NativeCurrentRecordingRefusal> {
        crate::expression::text(transaction_ref)?;
        crate::expression::text(actor)?;
        let owner = self
            .active
            .as_mut()
            .ok_or("native receiving continuation has no active owner")?;
        if owner.lease != lease || owner.stopped || owner.process_exited()? {
            return Err("native receiving continuation has another/closed actual owner".into());
        }
        let channel = owner
            .act_channel
            .as_ref()
            .ok_or("native receiving continuation has no qualified private Act channel")?;
        let id = owner
            .last_request_id
            .checked_add(1)
            .ok_or("native Act ordinal exhausted")?;
        let mut original_channel = None;
        let mut channel_refusal = None;
        let mut prepared = None;
        let checked = reader.compile_with(|manifest, reader| {
            // This checkpoint is restituted by the SAME complete selected Act.
            // A request names its index; it supplies no imported checkpoint.
            let original = reader.checkpoint(index)?;
            reader.performance().validate()?;
            super::recording::require_original_recording_streams(reader.performance())?;
            let request = json!({"schema":"ql.native-act-owner-request/v1",
                "instance_ref":owner.identity["instance_ref"],"event_ref":owner.identity["event_ref"],
                "subject_ref":owner.identity["subject_ref"],"request_id":id.to_string(),
                "manager_lease":lease,"edition_generation":generation.to_string(),"mode":"readmit",
                "from_sample":"0","to_sample":manifest["performance"]["duration_samples"],
                "manifest":manifest,"checkpoint_index":index,"transaction_ref":transaction_ref});
            let mut query = 0_u64;
            let mut visited = BTreeSet::new();
            let reply = match channel.exchange_stream_custodied(&request, |pull| {
                if pull["schema"] != "ql.native-act-owner-query/v1" { return Ok(None); }
                query = query.checked_add(1).ok_or("native receiving pull ordinal exhausted")?;
                if query > 16384 || pull["instance_ref"] != owner.identity["instance_ref"]
                    || cursor(&pull["request_id"])? != id || cursor(&pull["query_ordinal"])? != query
                { return Err("native receiving pull changed owner/order/bound".into()); }
                let kind = pull["kind"].as_str().ok_or("native receiving resource kind absent")?;
                let resource = usize::try_from(pull["index"].as_u64().ok_or("native resource index absent")?)
                    .map_err(|e|e.to_string())?;
                if !visited.insert((kind.to_owned(),resource)) {
                    return Err("native receiving repeated a selected resource pull".into());
                }
                let part = match kind {
                    "page" => reader.page(resource),
                    "checkpoint" => reader.checkpoint(resource),
                    _ => Err("native receiving asked for an unowned resource".into()),
                };
                Ok(Some(json!({"schema":"oi.native-act-owner-answer/v1",
                    "instance_ref":owner.identity["instance_ref"],"request_id":id.to_string(),
                    "query_ordinal":query.to_string(),"kind":kind,"index":resource,
                    "available":part.is_ok(),"value":part.as_ref().ok(),"error":part.as_ref().err()})))
            }) {
                Ok(reply) => reply,
                Err(refusal) => {
                    let reason = refusal.reason().to_owned();
                    channel_refusal = Some(refusal);
                    return Err(reason);
                }
            };
            // Put received custody in the outer holder BEFORE validating it.
            // A received but refused/stale result is never dropped or replayed.
            original_channel = Some(reply);
            let reply = original_channel.as_ref().ok_or("native channel custody lost")?;
            let received = reply.value();
            if received["schema"] == "ql.native-act-owner-result/v1"
                && received["instance_ref"] == owner.identity["instance_ref"]
                && cursor(&received["request_id"]).ok() == Some(id)
                && cursor(&received["last_request_id"]).ok() == Some(id)
            { owner.last_request_id = id; }
            prepared = Some(NativeReceivingReadmissionHandle::from_channel(
                reply, manifest, &original, reader.performance(), owner, id, transaction_ref, actor,
            ).and_then(NativeReceivingReadmissionHandle::retain));
            Ok(())
        });
        if let Some(original_channel) = original_channel {
            let result =
                checked.and_then(|()| prepared.ok_or("native readmission result absent")?);
            let (performance, error) = match result {
                Ok(performance) => (Some(Box::new(performance)), None),
                Err(error) => (None, Some(error)),
            };
            return Ok(NativeActReceivingExecution {
                performance,
                error,
                original_channel,
            });
        }
        if let Some(refusal) = channel_refusal {
            return Err(refusal.into());
        }
        Err(checked
            .err()
            .unwrap_or_else(|| "native readmission produced no actual channel".into())
            .into())
    }
}
