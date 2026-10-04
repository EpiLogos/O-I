//! Qualified native Manager -> actual Scene recording compiler. Register as a
//! child of native_expression. Source/CAS and native timing are supplied only
//! by the existing native owners; this input carries authored controls.
use super::act_channel::{NativeActChannelRefusal, NativeActChannelReply};
use super::act_diagnostics::NativeDiagnosticReceipts;
use super::recording::{
    require_retained_recording_prefix, NativeSceneRecordingCommit, NativeSceneRecordingRefusal,
    RecordingIntent, RecordingOriginIntent,
};
use super::{cursor, Manager};
use crate::expression::procedural::scene_receiver::SceneOwner;
use crate::expression_procedural_scene_reader::NativeDocumentSceneReader;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::Write;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordingGesturePhase {
    Press,
    Release,
    Expression,
}
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordingParameterAction {
    Set,
    Undo,
    Clear,
    Learn,
}
/// Authored controller intent only. No samples, source, native targets, body,
/// sequence, touch token, clock epoch, checkpoint or receipt fields are legal.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum NativeRecordingCommand {
    #[serde(rename = "performance-inspect")]
    Inspect {},
    #[serde(rename = "calibrate-current")]
    CalibrateCurrent {},
    #[serde(rename = "performance-device-enumerate")]
    DeviceEnumerate {},
    #[serde(rename = "performance-device-open")]
    DeviceOpen {
        device_id: u32,
        sample_rate: u32,
        buffer_frames: u32,
    },
    #[serde(rename = "performance-device-start")]
    DeviceStart {},
    #[serde(rename = "performance-device-stop")]
    DeviceStop {},
    #[serde(rename = "performance-device-recover")]
    DeviceRecover {},
    #[serde(rename = "performance-device-close")]
    DeviceClose {},
    #[serde(rename = "performance-gesture")]
    Gesture {
        phase: RecordingGesturePhase,
        input_ref: String,
        #[serde(default)]
        row: Option<u8>,
        #[serde(default)]
        column: Option<u8>,
        #[serde(default)]
        velocity: Option<f64>,
        #[serde(default)]
        pressure: Option<f64>,
    },
    #[serde(rename = "performance-sustain")]
    Sustain { down: bool },
    #[serde(rename = "performance-panic")]
    Panic { reason: String },
    #[serde(rename = "performance-hold")]
    Hold { reason: String },
    #[serde(rename = "performance-parameter")]
    Parameter {
        target_ref: String,
        action: RecordingParameterAction,
        #[serde(default)]
        value: Option<f64>,
    },
}

/// Every failure retains its genuine typed channel if an exchange began.
/// This carrier is not Deserialize; callers cannot manufacture a native reply.
pub struct NativeCurrentRecordingRefusal {
    reason: String,
    native_reply: Option<Value>,
    diagnostics: NativeDiagnosticReceipts,
    delivery_attempted: bool,
}
impl NativeCurrentRecordingRefusal {
    pub fn reason(&self) -> &str {
        &self.reason
    }
    pub fn native_reply(&self) -> Option<&Value> {
        self.native_reply.as_ref()
    }
    pub fn diagnostic_reading(&self) -> Value {
        self.diagnostics.reading()
    }
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
impl From<String> for NativeCurrentRecordingRefusal {
    fn from(reason: String) -> Self {
        Self {
            reason,
            native_reply: None,
            diagnostics: NativeDiagnosticReceipts::empty(),
            delivery_attempted: false,
        }
    }
}
impl From<&str> for NativeCurrentRecordingRefusal {
    fn from(reason: &str) -> Self {
        reason.to_owned().into()
    }
}
impl From<NativeActChannelRefusal> for NativeCurrentRecordingRefusal {
    fn from(refusal: NativeActChannelRefusal) -> Self {
        let (reason, native_reply, diagnostics, delivery_attempted) = refusal.into_custody();
        Self {
            reason,
            native_reply,
            diagnostics,
            delivery_attempted,
        }
    }
}
impl From<NativeSceneRecordingRefusal> for NativeCurrentRecordingRefusal {
    fn from(refusal: NativeSceneRecordingRefusal) -> Self {
        let reason = refusal.reason().to_owned();
        let (native_reply, diagnostics) = refusal.into_channel().into_custody();
        Self {
            reason,
            native_reply: Some(native_reply),
            diagnostics,
            delivery_attempted: true,
        }
    }
}
impl NativeRecordingCommand {
    fn validate(&self) -> Result<(), String> {
        let unit = |value: Option<f64>| {
            value
                .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
                .ok_or_else(|| {
                    "authored native velocity/pressure must be finite in [0,1]".to_owned()
                })
        };
        match self {
            Self::Inspect {}
            | Self::CalibrateCurrent {}
            | Self::Sustain { .. }
            | Self::DeviceEnumerate {}
            | Self::DeviceStart {}
            | Self::DeviceStop {}
            | Self::DeviceRecover {}
            | Self::DeviceClose {} => Ok(()),
            Self::DeviceOpen {
                sample_rate,
                buffer_frames,
                ..
            } if (8000..=192000).contains(sample_rate) && (16..=8192).contains(buffer_frames) => {
                Ok(())
            }
            Self::DeviceOpen { .. } => {
                Err("authored device configuration outside actual native bounds".into())
            }
            Self::Panic { reason } | Self::Hold { reason } => crate::expression::text(reason),
            Self::Gesture {
                phase,
                input_ref,
                row,
                column,
                velocity,
                pressure,
            } => {
                crate::expression::text(input_ref)?;
                match phase {
                    RecordingGesturePhase::Press
                        if row.is_some() && column.is_some() && pressure.is_none() =>
                    {
                        unit(*velocity)?;
                        Ok(())
                    }
                    RecordingGesturePhase::Release
                        if row.is_none()
                            && column.is_none()
                            && velocity.is_none()
                            && pressure.is_none() =>
                    {
                        Ok(())
                    }
                    RecordingGesturePhase::Expression
                        if row.is_none() && column.is_none() && velocity.is_none() =>
                    {
                        unit(*pressure)?;
                        Ok(())
                    }
                    _ => {
                        Err("authored native gesture fields differ from the selected phase".into())
                    }
                }
            }
            Self::Parameter {
                target_ref,
                action,
                value,
            } => {
                crate::expression::text(target_ref)?;
                match action {
                    RecordingParameterAction::Set if value.is_some_and(f64::is_finite) => Ok(()),
                    RecordingParameterAction::Clear
                    | RecordingParameterAction::Undo
                    | RecordingParameterAction::Learn
                        if value.is_none() =>
                    {
                        Ok(())
                    }
                    _ => Err("authored native parameter value differs from its action".into()),
                }
            }
        }
    }
}

impl Manager {
    fn capture_recording_exchange(
        &mut self,
        lease: &str,
        reader: &NativeDocumentSceneReader,
        owner: &SceneOwner,
        mode: &str,
        procedural_query: Value,
    ) -> Result<(u64, NativeActChannelReply), NativeCurrentRecordingRefusal> {
        #[cfg(not(any(target_os = "linux", target_os = "macos")))]
        {
            let _ = (lease, reader, owner, mode, procedural_query);
            Err("recording requires the native OS/image-qualified channel; no ordinary Exchange fallback".into())
        }
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        {
            if self.recording_failure.is_some() {
                return Err(
                    "original native recording failure remains held; no subsequent delivery".into(),
                );
            }
            let constructor =
                owner.closed_constructor_fact(reader.document(), &reader.scene().scene_ref)?;
            let mut procedural_query = procedural_query;
            if !matches!(mode, "recording-command" | "recording-origin") {
                return Err("foreign recording channel mode".into());
            }
            procedural_query["scene_constructor"] = constructor;
            let native = self
                .active
                .as_mut()
                .ok_or("recording has no active native Manager")?;
            if native.lease != lease || native.stopped || native.process_exited()? {
                return Err("recording has another/closed actual Manager lease".into());
            }
            let channel = native
                .act_channel
                .as_ref()
                .ok_or("recording has no OS/image-qualified native channel")?;
            let manifest = reader.native_manifest()?;
            let id = native
                .last_request_id
                .checked_add(1)
                .ok_or("native recording request exhausted")?;
            let registration = json!({"schema":"oi.native-field-timing-registration/v1",
                "owner_ref":native.lease,"instance_ref":native.identity["instance_ref"],
                "epoch_ref":native.native_field_epoch,"domain":"native_field_samples",
                "time_mapping_ref":null});
            let request = json!({"schema":"ql.native-act-owner-request/v1",
                "instance_ref":native.identity["instance_ref"],"event_ref":native.identity["event_ref"],
                "subject_ref":native.identity["subject_ref"],"request_id":id.to_string(),
                "manager_lease":lease,"mode":mode,"manifest":manifest,
                "field_registration":registration,
                "procedural_request":procedural_query});
            let mut query = 0_u64;
            let exchanged=channel.exchange_stream_custodied(&request,|value| {
                if value["schema"]!="ql.native-act-owner-query/v1" {return Ok(None);}
                query=query.checked_add(1).ok_or("native recording source ordinal exhausted")?;
                if query>128 || value["instance_ref"]!=native.identity["instance_ref"]
                    || cursor(&value["request_id"])?!=id || cursor(&value["query_ordinal"])?!=query
                    || value["kind"]!="field-part" {
                    return Err("recording lost complete closed Scene source-part custody".into());
                }
                let index=usize::try_from(value["index"].as_u64().ok_or("native source index absent")?)
                    .map_err(|e|e.to_string())?;
                if index!=query as usize-1 {
                    return Err("recording source parts missing/reordered".into());
                }
                let part=reader.field_source_part(index);
                Ok(Some(json!({"schema":"oi.native-act-owner-answer/v1",
                    "instance_ref":native.identity["instance_ref"],"request_id":id.to_string(),
                    "query_ordinal":query.to_string(),"kind":"field-part","index":index,
                    "available":part.is_ok(),"value":part.as_ref().ok(),"error":part.as_ref().err()})))
            });
            let reply = match exchanged {
                Ok(reply) => reply,
                Err(refusal) => {
                    // Match the existing ordinary Exchange unknown-delivery
                    // rule. Only this actually admitted owner is retired; a
                    // wrong lease or pre-write refusal never enters this arm.
                    if refusal.delivery_attempted() {
                        self.active.take();
                    }
                    return Err(refusal.into());
                }
            };
            // The compiler verifies every complete selection/qualification
            // field. Commit the actual acknowledged ordinal only, even if the
            // subsequent recording/CAS refuses; never repeat a played gesture.
            let value = reply.value();
            if value["schema"] == "ql.native-act-owner-result/v1"
                && value["instance_ref"] == native.identity["instance_ref"]
                && cursor(&value["request_id"]).ok() == Some(id)
                && cursor(&value["last_request_id"]).ok() == Some(id)
            {
                native.last_request_id = id;
            }
            Ok((id, reply))
        }
    }
}

/// Native caller's authored intent. No source/clock/receipt/checkpoint fields
/// and no constructor capability. The Kernel obtains the actual registered
/// owner and qualified channel internally from its current Application.
pub struct CurrentSceneRecordingIntent<'a> {
    pub lease: &'a str,
    pub expression_ref: &'a str,
    pub document_revision: u64,
    pub scene_ref: &'a str,
    pub scene_revision: u64,
    pub actor: &'a str,
    pub basis: u16,
    pub layer: u16,
    pub command: NativeRecordingCommand,
}

impl crate::Kernel {
    /// One actual native command/pulse and one ordinary RecordNative CAS.
    /// No Act is fabricated for a live current Document; its eventual save,
    /// close, cold reopen and export keep the existing Scene/Act/file owner.
    pub fn record_current_native_scene(
        &mut self,
        input: CurrentSceneRecordingIntent<'_>,
    ) -> Result<NativeSceneRecordingCommit, NativeCurrentRecordingRefusal> {
        input.command.validate()?;
        crate::expression::text(input.actor)?;
        let before = self
            .expressions
            .procedural_source_snapshot(input.expression_ref, input.document_revision)?;
        let scene = before
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == input.scene_ref)
            .ok_or("recording selected Scene absent")?;
        let performance = scene
            .performance
            .as_ref()
            .ok_or("recording Scene has no actual performance")?;
        performance.validate()?;
        if performance.bases.get(usize::from(input.basis)).is_none()
            || performance.layers.get(usize::from(input.layer)).is_none()
        {
            return Err("recording authored destination absent".into());
        }
        require_retained_recording_prefix(
            performance,
            &RecordingIntent {
                actor: input.actor.to_owned(),
                basis: input.basis,
                layer: input.layer,
            },
        )?;
        if let NativeRecordingCommand::Parameter { target_ref, .. } = &input.command {
            if !performance.parameters.iter().any(|p| {
                p.target_ref == *target_ref
                    && p.native_owner == "ql.performance.Engine"
                    && p.action_ref == "ql:native-performance/parameter"
            }) {
                return Err("recording parameter has no declared native Scene target".into());
            }
        }
        let owner = self
            .expressions
            .procedural_scene_owner(&before, input.scene_ref)?;
        let reader = NativeDocumentSceneReader::from_native_scene_owner(
            &self.expressions,
            &owner,
            before,
            input.scene_ref,
            input.scene_revision,
        )?;
        self.expressions
            .require_procedural_scene_owner(&owner, reader.document())?;
        let (id, reply) = self.native_expression.capture_recording_exchange(
            input.lease,
            &reader,
            &owner,
            "recording-command",
            json!({"schema":"ql.native-scene-recording-command/v1","command":input.command}),
        )?;
        let prepared = self
            .expressions
            .prepare_native_scene_recording(
                reader.document(),
                input.scene_ref,
                owner,
                id,
                RecordingIntent {
                    actor: input.actor.to_owned(),
                    basis: input.basis,
                    layer: input.layer,
                },
                reply,
            )
            .map_err(NativeCurrentRecordingRefusal::from)?;
        Ok(self.finish_native_scene_recording(prepared))
    }
}

#[cfg(test)]
mod authored_intent_tests {
    use super::*;

    #[test]
    fn authored_command_cannot_supply_native_clock_source_touch_or_receipt() {
        let original = json!({"operation":"performance-gesture","phase":"press",
            "input_ref":"native:authored/original-pointer","row":0,"column":0,"velocity":0.75});
        let accepted: NativeRecordingCommand = serde_json::from_value(original.clone()).unwrap();
        accepted.validate().unwrap();
        for key in [
            "sample",
            "sequence",
            "touch",
            "native_target",
            "source",
            "transport_epoch",
            "receipt",
        ] {
            let mut grant = original.clone();
            grant[key] = json!("1");
            assert!(
                serde_json::from_value::<NativeRecordingCommand>(grant).is_err(),
                "{key}"
            );
        }
        let mut invalid = original;
        invalid["phase"] = json!("release");
        let authored: NativeRecordingCommand = serde_json::from_value(invalid).unwrap();
        assert!(authored.validate().is_err());
    }

    #[test]
    fn captured_default_calibration_has_no_caller_force_target_or_ordinal() {
        let original = json!({"operation":"calibrate-current"});
        let command: NativeRecordingCommand = serde_json::from_value(original.clone()).unwrap();
        command.validate().unwrap();
        for key in [
            "value",
            "target_ref",
            "sample",
            "request_id",
            "source",
            "native_boundary",
        ] {
            let mut forged = original.clone();
            forged[key] = json!("1");
            assert!(
                serde_json::from_value::<NativeRecordingCommand>(forged).is_err(),
                "{key}"
            );
        }
    }

    #[test]
    fn authored_magnitudes_refuse_nonfinite_and_phase_incompatible_values_before_native_exchange() {
        for value in [f64::NAN, f64::INFINITY, -0.1, 1.1] {
            let command = NativeRecordingCommand::Gesture {
                phase: RecordingGesturePhase::Press,
                input_ref: "native:authored/original-pointer".into(),
                row: Some(0),
                column: Some(0),
                velocity: Some(value),
                pressure: None,
            };
            assert!(command.validate().is_err());
        }
        let nonfinite = NativeRecordingCommand::Parameter {
            target_ref: "ql:performance/parameter/force-newtons".into(),
            action: RecordingParameterAction::Set,
            value: Some(f64::NAN),
        };
        assert!(nonfinite.validate().is_err());
        let clear = NativeRecordingCommand::Parameter {
            target_ref: "ql:performance/parameter/force-newtons".into(),
            action: RecordingParameterAction::Clear,
            value: None,
        };
        clear.validate().unwrap();
    }
}

/// Authored start address; native source/clock/checkpoint bytes are forbidden.
pub struct CurrentSceneRecordingOriginIntent<'a> {
    pub lease: &'a str,
    pub expression_ref: &'a str,
    pub document_revision: u64,
    pub scene_ref: &'a str,
    pub scene_revision: u64,
    pub actor: &'a str,
    pub basis: u16,
    pub checkpoint_ref: &'a str,
}
impl crate::Kernel {
    pub fn begin_current_native_scene_recording(
        &mut self,
        input: CurrentSceneRecordingOriginIntent<'_>,
    ) -> Result<NativeSceneRecordingCommit, NativeCurrentRecordingRefusal> {
        crate::expression::text(input.actor)?;
        crate::expression::text(input.checkpoint_ref)?;
        let before = self
            .expressions
            .procedural_source_snapshot(input.expression_ref, input.document_revision)?;
        let scene = before
            .scenes
            .iter()
            .find(|s| s.scene_ref == input.scene_ref)
            .ok_or("recording origin Scene absent")?;
        if scene.revision != input.scene_revision {
            return Err("recording origin Scene revision stale".into());
        }
        let performance = scene
            .performance
            .as_ref()
            .ok_or("recording origin has no retained performance")?;
        performance.validate()?;
        let basis = performance
            .bases
            .get(usize::from(input.basis))
            .ok_or("recording origin basis absent")?;
        if performance
            .checkpoints
            .iter()
            .any(|c| c.basis_digest == basis.content_digest)
            || !performance.native_recordings.is_empty()
        {
            return Err(
                "recording origin/history already retained; use it and preserve original bytes"
                    .into(),
            );
        }
        let owner = self
            .expressions
            .procedural_scene_owner(&before, input.scene_ref)?;
        let reader = NativeDocumentSceneReader::from_native_scene_owner(
            &self.expressions,
            &owner,
            before,
            input.scene_ref,
            input.scene_revision,
        )?;
        self.expressions
            .require_procedural_scene_owner(&owner, reader.document())?;
        let (id, reply) = self.native_expression.capture_recording_exchange(
            input.lease,
            &reader,
            &owner,
            "recording-origin",
            json!({"schema":"ql.native-scene-recording-origin/v1"}),
        )?;
        let prepared = self
            .expressions
            .prepare_native_scene_recording_origin(
                reader.document(),
                input.scene_ref,
                owner,
                id,
                RecordingOriginIntent {
                    actor: input.actor.into(),
                    basis: input.basis,
                    checkpoint_ref: input.checkpoint_ref.into(),
                },
                reply,
            )
            .map_err(NativeCurrentRecordingRefusal::from)?;
        Ok(self.finish_native_scene_recording_origin(prepared))
    }
}

/// Existing kernel transport receives only authored intent and current CAS.
/// Deserialization does not construct a SceneOwner, native checkpoint or lease.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum NativeSceneRecordingRequest {
    PrepareScene {
        request_id: String,
        lease: String,
        expression_ref: String,
        document_revision: u64,
        scene_ref: String,
        scene_revision: u64,
        actor: String,
        definition: super::recording_definition::NativeSceneRecordingDefinition,
    },
    Begin {
        request_id: String,
        lease: String,
        expression_ref: String,
        document_revision: u64,
        scene_ref: String,
        scene_revision: u64,
        actor: String,
        basis: u16,
        checkpoint_ref: String,
    },
    Command {
        request_id: String,
        lease: String,
        expression_ref: String,
        document_revision: u64,
        scene_ref: String,
        scene_revision: u64,
        actor: String,
        basis: u16,
        layer: u16,
        command: NativeRecordingCommand,
    },
}
/// A failed native transaction's original custody stays on the SAME Manager.
/// It is never serialized into an authority token or hidden by a later pulse.
pub(super) struct NativeRecordingFailureCustody {
    reason: String,
    delivery_attempted: bool,
    reply: Value,
    diagnostics: NativeDiagnosticReceipts,
}
impl std::fmt::Debug for NativeRecordingFailureCustody {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeRecordingFailureCustody")
            .field("reason", &self.reason)
            .field("delivery_attempted", &self.delivery_attempted)
            .field("schema", &self.reply["schema"])
            .field("diagnostics", &self.diagnostics.reading())
            .finish()
    }
}
impl crate::Kernel {
    pub(crate) fn apply_native_scene_recording_request(
        &mut self,
        request: NativeSceneRecordingRequest,
    ) -> Result<crate::KernelOpOutcome, String> {
        if self.native_expression.recording_failure.is_some() {
            return Err("an original native recording failure remains in Manager custody; preserve/resolve it before another recording command".into());
        }
        let request_id = match &request {
            NativeSceneRecordingRequest::PrepareScene { request_id, .. }
            | NativeSceneRecordingRequest::Begin { request_id, .. }
            | NativeSceneRecordingRequest::Command { request_id, .. } => {
                cursor(&json!(request_id))?
            }
        };
        let active = self
            .native_expression
            .active
            .as_ref()
            .ok_or("recording outer native Manager absent")?;
        if active.last_request_id.checked_add(1) != Some(request_id) {
            return Err("recording outer ordinal stale/repeated/skipped; use the SAME actual InstrumentSession".into());
        }
        let result = match request {
            NativeSceneRecordingRequest::PrepareScene {
                request_id: _,
                lease,
                expression_ref,
                document_revision,
                scene_ref,
                scene_revision,
                actor,
                definition,
            } => self.prepare_current_native_scene_recording(
                super::recording_definition::CurrentSceneRecordingDefinitionIntent {
                    lease: &lease,
                    expression_ref: &expression_ref,
                    document_revision,
                    scene_ref: &scene_ref,
                    scene_revision,
                    actor: &actor,
                    definition,
                },
            ),
            NativeSceneRecordingRequest::Begin {
                request_id: _,
                lease,
                expression_ref,
                document_revision,
                scene_ref,
                scene_revision,
                actor,
                basis,
                checkpoint_ref,
            } => self.begin_current_native_scene_recording(CurrentSceneRecordingOriginIntent {
                lease: &lease,
                expression_ref: &expression_ref,
                document_revision,
                scene_ref: &scene_ref,
                scene_revision,
                actor: &actor,
                basis,
                checkpoint_ref: &checkpoint_ref,
            }),
            NativeSceneRecordingRequest::Command {
                request_id: _,
                lease,
                expression_ref,
                document_revision,
                scene_ref,
                scene_revision,
                actor,
                basis,
                layer,
                command,
            } => self.record_current_native_scene(CurrentSceneRecordingIntent {
                lease: &lease,
                expression_ref: &expression_ref,
                document_revision,
                scene_ref: &scene_ref,
                scene_revision,
                actor: &actor,
                basis,
                layer,
                command,
            }),
        };
        let (application, currentness, native_reply, diagnostics, delivery_attempted) = match result
        {
            Ok(commit) => {
                let (application, currentness, native_reply, diagnostics) =
                    commit.into_dispatch_parts();
                (application, currentness, native_reply, diagnostics, true)
            }
            Err(refusal) => (
                Err(refusal.reason.clone()),
                Err(refusal.reason),
                refusal.native_reply.unwrap_or(Value::Null),
                refusal.diagnostics,
                refusal.delivery_attempted,
            ),
        };
        let accepted = application.is_ok() && currentness.is_ok();
        let receipts = application
            .as_ref()
            .ok()
            .and_then(Option::as_ref)
            .map(|outcome| outcome.receipts.clone())
            .unwrap_or_default();
        let data = json!({"schema":"oi.native-scene-recording-result/v1","accepted":accepted,
            "application":application.as_ref().map(|op|op.as_ref().map(|op|&op.result)),
            "currentness":currentness,"native_reply":native_reply,"diagnostics":diagnostics.reading(),
            "delivery_attempted":delivery_attempted});
        if !accepted && (delivery_attempted || !native_reply.is_null() || !diagnostics.is_empty()) {
            self.native_expression.recording_failure = Some(NativeRecordingFailureCustody {
                reason: application
                    .as_ref()
                    .err()
                    .or_else(|| currentness.as_ref().err())
                    .cloned()
                    .unwrap_or_else(|| "native recording commit refused".into()),
                delivery_attempted,
                reply: native_reply,
                diagnostics,
            });
        }
        Ok(crate::KernelOpOutcome {
            receipts,
            result: crate::KernelOpResult::NativeExpression { data },
        })
    }
    pub fn native_recording_failure_reply(&self) -> Option<&Value> {
        self.native_expression
            .recording_failure
            .as_ref()
            .map(|c| &c.reply)
    }
    pub fn write_native_recording_failure_diagnostic(
        &self,
        ordinal: u64,
        output: &mut impl Write,
    ) -> Result<(), String> {
        self.native_expression
            .recording_failure
            .as_ref()
            .ok_or("original native recording failure absent")?
            .diagnostics
            .write_receipt(ordinal, output)
    }
}

#[cfg(test)]
mod outer_recording_intent_tests {
    use super::*;
    #[test]
    fn begin_outer_ordinal_does_not_grant_native_audio_time_or_checkpoint() {
        let base = json!({"operation":"begin","request_id":"1","lease":"native:lease",
            "expression_ref":"expression:original","document_revision":1,"scene_ref":"scene:original",
            "scene_revision":1,"actor":"user:record","basis":0,"checkpoint_ref":"native:record/origin"});
        serde_json::from_value::<NativeSceneRecordingRequest>(base.clone()).unwrap();
        for key in [
            "sample",
            "native_checkpoint",
            "source",
            "native_target",
            "clock",
            "receipt",
        ] {
            let mut foreign = base.clone();
            foreign[key] = json!("1");
            assert!(
                serde_json::from_value::<NativeSceneRecordingRequest>(foreign).is_err(),
                "{key}"
            );
        }
        for command in [
            json!({"operation":"performance-device-start"}),
            json!({"operation":"performance-device-stop"}),
            json!({"operation":"performance-device-enumerate"}),
        ] {
            serde_json::from_value::<NativeRecordingCommand>(command)
                .unwrap()
                .validate()
                .unwrap();
        }
        assert!(serde_json::from_value::<NativeRecordingCommand>(
            json!({"operation":"performance-transpose","semitones":1})
        )
        .is_err());
    }
}

impl NativeCurrentRecordingRefusal {
    pub(super) fn from_acknowledged_native_source_refusal(
        reason: String,
        native_reply: Value,
    ) -> Self {
        // This constructor is used only after the actual source operation
        // returned its full acknowledged reply. Unknown delivery uses the
        // typed refusal below, never reply presence as a delivery proxy.
        Self {
            reason,
            native_reply: Some(native_reply),
            diagnostics: NativeDiagnosticReceipts::empty(),
            delivery_attempted: true,
        }
    }
    pub(super) fn from_native_scene_source_refusal(
        refusal: super::native_scene_source::NativeSceneOperationRefusal,
    ) -> Self {
        let (reason, native_reply, diagnostics, delivery_attempted) =
            refusal.into_recording_custody();
        Self {
            reason,
            native_reply,
            diagnostics,
            delivery_attempted,
        }
    }
}
