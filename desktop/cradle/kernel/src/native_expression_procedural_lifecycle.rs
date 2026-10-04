//! Lifecycle uses the existing selected native owner and actual Source pipe.
//! Coordinate reading executes outside the Kernel mutation lock. Complete
//! native receipts survive a refused receiving admission or a revision race.
use crate::expression::procedural::{
    lifecycle::{Intent, RESPONSE_SCHEMA},
    Participant, Timing,
};
use crate::expression::{Document, Request as ExpressionRequest};
use serde_json::{json, Value};

/// Captured from the actual current Manager before its private C31 channel
/// consumes this original Host request. There is no wire constructor.
#[derive(Debug)]
pub(super) struct SourceIntake {
    lease: String,
    identity: Value,
    executable: std::path::PathBuf,
    binding: Value,
    ordinal: u64,
    original_request: Value,
    request_sha256: String,
}
impl SourceIntake {
    pub(super) fn capture(
        manager: &crate::native_expression::Manager,
        lease: &str,
        request: &Value,
    ) -> Result<Self, String> {
        let owner = manager
            .active
            .as_ref()
            .ok_or("Actual native Source owner absent")?;
        let ordinal = super::super::cursor(&request["request_id"])?;
        if owner.lease != lease
            || owner.stopped
            || Some(ordinal) != owner.last_request_id.checked_add(1)
            || request["schema"] != "ql.field-host-request/v1"
            || request["command"]["operation"] != "procedure"
            || ["instance_ref", "event_ref", "subject_ref"]
                .iter()
                .any(|key| request[*key] != owner.identity[*key])
        {
            return Err(
                "Original private procedural request has another native owner/ordinal".into(),
            );
        }
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            request,
            &owner.procedural_source,
        ))?;
        Ok(Self {
            lease: lease.into(),
            identity: owner.identity.clone(),
            executable: owner.procedural_executable.clone(),
            binding: owner.procedural_source.clone(),
            ordinal,
            original_request: request["command"]["request"].clone(),
            request_sha256: super::super::sha256_hex(
                &serde_json::to_vec(request).map_err(|e| e.to_string())?,
            ),
        })
    }
    pub(super) fn finish(
        self,
        manager: &mut crate::native_expression::Manager,
        reply: &Value,
    ) -> Result<Value, String> {
        self.finish_qualified(manager, reply)
            .map(CompletedSourceIntake::into_source)
    }
    /// Preserve the actual private intake after its original channel receipt.
    /// No wire constructor or caller-returned provenance can create this type.
    pub(super) fn finish_qualified(
        self,
        manager: &mut crate::native_expression::Manager,
        reply: &Value,
    ) -> Result<CompletedSourceIntake, String> {
        let owner = manager
            .active
            .as_mut()
            .ok_or("Actual private Source channel owner closed")?;
        if owner.lease != self.lease
            || owner.identity != self.identity
            || owner.procedural_executable != self.executable
            || owner.procedural_source != self.binding
            || owner.last_request_id != self.ordinal
            || reply["schema"] != "ql.field-host-receipt/v1"
            || reply["instance_ref"] != self.identity["instance_ref"]
            || super::super::cursor(&reply["request_id"])? != self.ordinal
            || super::super::cursor(&reply["last_request_id"])? != self.ordinal
            || reply["available"] != true
            || !["ok", "refused"].contains(&reply["status"].as_str().unwrap_or(""))
        {
            return Err(
                "Actual private Source reply changed its complete native owner/ordinal".into(),
            );
        }
        for key in ["generation", "samples_elapsed"] {
            super::super::cursor(&reply["field"][key])?;
        }
        // Keep actual FIELD cursor facts for the next serialized native
        // request. They never substitute for the admitted P timing position.
        owner.procedural_position = json!({"generation":reply["field"]["generation"],"samples_elapsed":reply["field"]["samples_elapsed"]});
        let source = json!({"schema":"oi.native-expression-composed-source/v1","ql_executable":self.executable,
            "native_binding":self.binding,"native_request_id":self.ordinal.to_string(),
            "original_request":self.original_request,"request_sha256":self.request_sha256,
            "result_sha256":super::super::sha256_hex(&serde_json::to_vec(reply).map_err(|e| e.to_string())?)});
        crate::expression::procedural::bootstrap::preflight_source_message(&(&source, reply))?;
        Ok(CompletedSourceIntake {
            intake: self,
            source,
            reply: reply.clone(),
        })
    }
}

/// Actual one-request completion retained on the SAME private native owner.
/// Its fields cannot be deserialized, copied into a receipt, or reconstructed
/// by importing the separately returned source provenance.
#[derive(Debug)]
pub(super) struct CompletedSourceIntake {
    intake: SourceIntake,
    source: Value,
    reply: Value,
}
impl CompletedSourceIntake {
    pub(super) fn source(&self) -> &Value {
        &self.source
    }
    pub(super) fn reply(&self) -> &Value {
        &self.reply
    }
    fn into_source(self) -> Value {
        self.source
    }
    pub(super) fn require_current(
        &self,
        manager: &mut crate::native_expression::Manager,
    ) -> Result<(), String> {
        self.require_owner(manager, true)
    }
    pub(super) fn require_same_owner(
        &self,
        manager: &mut crate::native_expression::Manager,
    ) -> Result<(), String> {
        self.require_owner(manager, false)
    }
    fn require_owner(
        &self,
        manager: &mut crate::native_expression::Manager,
        exact_ordinal: bool,
    ) -> Result<(), String> {
        let owner = manager
            .active
            .as_mut()
            .ok_or("Actual Source completion owner closed")?;
        if owner.lease != self.intake.lease
            || owner.identity != self.intake.identity
            || owner.procedural_executable != self.intake.executable
            || owner.procedural_source != self.intake.binding
            || owner.stopped
            || owner.process_exited()?
            || owner.last_request_id < self.intake.ordinal
            || (exact_ordinal && owner.last_request_id != self.intake.ordinal)
        {
            return Err(
                "Actual Source completion changed its original private owner or request standing"
                    .into(),
            );
        }
        Ok(())
    }
}

pub(super) fn channel_refused(
    kernel: &mut crate::Kernel,
    expression_ref: &str,
    original_intent: Value,
    refusal: &crate::native_expression::native_scene_source::NativeSceneOperationRefusal,
    currentness: Option<&String>,
) -> crate::KernelOpOutcome {
    let inspected = kernel.expressions.apply(
        &kernel.client,
        ExpressionRequest::Inspect {
            expression_ref: expression_ref.into(),
        },
    );
    let (document, inspect_error) = match inspected {
        Ok((value, _)) => (value["document"].clone(), Value::Null),
        Err(error) => (Value::Null, json!(error)),
    };
    let native_receipt = refusal
        .native_reply()
        .and_then(|reply| reply.get("result"))
        .and_then(|result| result.get("native_receipt"));
    crate::KernelOpOutcome {
        receipts: vec![],
        result: crate::KernelOpResult::Expression {
            data: json!({"schema":RESPONSE_SCHEMA,"original_intent":original_intent,
                "state":if native_receipt.is_some() || !inspect_error.is_null() {"reconciliation_required"} else {"source_refused"},
                "channel_state":"source_channel_refused","reason":refusal.reason(),
                "native_receipt":native_receipt,"native_source_channel":refusal.native_reply(),
                "source_currentness":currentness,"inspect_error":inspect_error,
                "preparation":null,"document":document,"source_current":false,"replayed":false}),
        },
    }
}

/// Issued only inside the native owner from its registered counterparts. This
/// type has no public wire constructor and carries no claimed observation.
#[derive(Debug, PartialEq)]
pub struct ReceivingBoundary {
    expression_ref: String,
    document_revision: u64,
    timing: Timing,
    participants: Vec<Participant>,
}
impl ReceivingBoundary {
    pub(in crate::native_expression) fn from_registered(
        expression_ref: String,
        document_revision: u64,
        timing: Timing,
        participants: Vec<Participant>,
    ) -> Result<Self, String> {
        crate::expression::text(&expression_ref)?;
        if document_revision == 0
            || participants.is_empty()
            || participants.len() > 16
            || !matches!(timing, Timing::OwnerBoundary { .. })
        {
            return Err("The actual registered receiving boundary is absent or unbounded".into());
        }
        Ok(Self {
            expression_ref,
            document_revision,
            timing,
            participants,
        })
    }
    pub(crate) fn expression_ref(&self) -> &str {
        &self.expression_ref
    }
    pub(crate) fn document_revision(&self) -> u64 {
        self.document_revision
    }
    pub(crate) fn timing(&self) -> &Timing {
        &self.timing
    }
    pub(crate) fn participants(&self) -> &[Participant] {
        &self.participants
    }
}

pub struct Prepared {
    before: Document,
    lease: String,
    identity: Value,
    installed: Value,
    intent: Intent,
    source_intent: super::bootstrap::Intent,
}
pub struct Completed {
    prepared: Prepared,
    issued: super::bootstrap::IssuedSceneRead,
}
impl Prepared {
    pub fn execute(self) -> Result<Completed, String> {
        let issued = super::bootstrap::read_selected_scene(
            &self.before,
            &self.identity,
            &self.source_intent,
        )?;
        Ok(Completed {
            prepared: self,
            issued,
        })
    }
}
impl crate::Kernel {
    pub fn prepare_native_procedural_lifecycle(
        &mut self,
        op: &crate::KernelOp,
    ) -> Result<Option<Prepared>, String> {
        let crate::KernelOp::Expression {
            request: ExpressionRequest::Procedural { request },
        } = op
        else {
            return Ok(None);
        };
        if !matches!(
            request,
            crate::expression::procedural::Request::Lifecycle { .. }
        ) {
            return Ok(None);
        }
        let intent = Intent::from_request(request)?;
        let before = self
            .expressions
            .procedural_source_snapshot(&intent.expression_ref, intent.expected_revision)?;
        intent.validate(&before)?;
        crate::expression::procedural::bootstrap::preflight_native_intake(&before, &intent)?;
        let source_intent = self
            .expressions
            .lifecycle_source_intent(&before, &intent.scene_ref)?;
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Lifecycle has no actual current native Source owner")?;
        if owner.stopped || owner.process_exited()? {
            return Err("Lifecycle actual native Source owner has closed".into());
        }
        let lease = owner.lease.clone();
        let identity = owner.identity.clone();
        let installed = self.native_expression.procedural_definition(
            &lease,
            &intent.expression_ref,
            &intent.procedure_ref,
        )?;
        crate::expression::procedural::validate_retained_procedural_definition(
            &before, &installed,
        )?;
        Ok(Some(Prepared {
            before,
            lease,
            identity,
            installed,
            intent,
            source_intent,
        }))
    }

    pub fn finish_native_procedural_lifecycle(
        &mut self,
        completed: Completed,
    ) -> Result<crate::KernelOpOutcome, String> {
        self.finish_native_lifecycle(completed, None)
    }

    pub fn finish_native_procedural_lifecycle_with_receivers(
        &mut self,
        completed: Completed,
        boundary: ReceivingBoundary,
    ) -> Result<crate::KernelOpOutcome, String> {
        self.finish_native_lifecycle(completed, Some(boundary))
    }

    fn finish_native_lifecycle(
        &mut self,
        completed: Completed,
        boundary: Option<ReceivingBoundary>,
    ) -> Result<crate::KernelOpOutcome, String> {
        let Completed { prepared, issued } = completed;
        let Prepared {
            before,
            lease,
            identity,
            installed,
            intent,
            source_intent,
        } = prepared;
        let current = self
            .expressions
            .procedural_source_snapshot(&intent.expression_ref, intent.expected_revision)?;
        if current != before {
            return Err("The full native lifecycle Document changed during source reading; retain the original intent".into());
        }
        let current_install = self.native_expression.procedural_definition(
            &lease,
            &intent.expression_ref,
            &intent.procedure_ref,
        )?;
        if current_install != installed {
            return Err(
                "Actual installed native Procedure changed during lifecycle reading".into(),
            );
        }
        let scene_read = issued.lifecycle_reading(&before, &intent.scene_ref)?;
        let reading = crate::expression::procedural::lifecycle::reading(
            &mut self.expressions,
            &self.client,
            &before,
            &intent,
            &installed,
            &scene_read,
        )?;
        let source_input = json!({"schema":"ql.procedural-lifecycle-intent/v1",
            "expression_ref":intent.expression_ref,"document_revision":intent.expected_revision,
            "scene_ref":intent.scene_ref,"operation_ref":intent.operation_ref,"actor_ref":intent.actor,
            "procedure_ref":intent.procedure_ref,"expected_procedure_revision":intent.expected_procedure_revision,
            "action":intent.action,"reading":reading});
        let original_intent = intent.wire()?;
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Actual lifecycle native owner closed during reading")?;
        if owner.lease != lease
            || owner.identity != identity
            || owner.stopped
            || owner.process_exited()?
        {
            return Err("Actual lifecycle native owner changed during reading".into());
        }
        let request_id = owner
            .last_request_id
            .checked_add(1)
            .ok_or("Native lifecycle request sequence exhausted")?;
        let request = json!({"schema":"ql.field-host-request/v1","request_id":request_id.to_string(),
            "instance_ref":identity["instance_ref"],"event_ref":identity["event_ref"],"subject_ref":identity["subject_ref"],
            "command":{"operation":"procedure","request":{"action":"lifecycle","input":source_input}}});
        let intake = SourceIntake::capture(&self.native_expression, &lease, &request)?;
        let scene_revision = before
            .scenes
            .iter()
            .find(|s| s.scene_ref == intent.scene_ref)
            .ok_or("Actual lifecycle Scene disappeared")?
            .revision;
        let outcome = self.with_native_document_scene(
            &before.expression_ref, before.revision, &intent.scene_ref, scene_revision,
            |manager, reader| Ok(manager.procedural_lifecycle_scene_read(
                &lease,
                &crate::expression_procedural_scene_reader::NativeSceneSourceReader::CurrentDocument(reader),
                &issued, &source_intent, request,
            )),
        )?;
        let (mut native_receipt, channel_receipt) = match outcome.result? {
            Ok(receipts) => receipts,
            Err(refusal) => {
                return Ok(channel_refused(
                    self,
                    &before.expression_ref,
                    original_intent,
                    &refusal,
                    outcome.currentness.as_ref().err(),
                ));
            }
        };
        let source_currentness = outcome.currentness;
        // The native ordinal/pulse is consumed on an ordinary refusal too.
        // Retain its actual cursor before Source or Document qualification.
        let source_result = intake.finish_qualified(&mut self.native_expression, &native_receipt);
        let mut preparation = Value::Null;
        let mut prepare_request = Value::Null;
        let mut reason = source_currentness
            .as_ref()
            .err()
            .or(source_result.as_ref().err())
            .map_or(Value::Null, |error| json!(error));
        let mut state = if reason.is_null() {
            "source_refused"
        } else {
            "reconciliation_required"
        };
        if native_receipt["status"] == "ok" {
            let qualified = (|| -> Result<(Value, CompletedSourceIntake), String> {
                source_currentness?;
                let completion = source_result?;
                let source = completion.source().clone();
                let procedural = &native_receipt["procedural"];
                if procedural["schema"] != "ql.procedural-conduct-receipt/v1"
                    || procedural["status"] != "prepared"
                    || procedural["procedure_ref"] != intent.procedure_ref
                    || procedural["lifecycle"]["schema"] != "ql.procedural-lifecycle-receipt/v1"
                    || procedural["lifecycle"]["operation_ref"] != intent.operation_ref
                    || procedural["lifecycle"]["actor_ref"] != intent.actor
                    || procedural["lifecycle"]["document_revision"].as_u64()
                        != Some(before.revision)
                    || procedural["lifecycle"]["source_read_receipt_ref"]
                        != scene_read["source_read_receipt_ref"]
                    || procedural["lifecycle"]["action"] != json!(intent.action)
                    || procedural["lifecycle"]["consumer_release"] != "unconfirmed"
                    || procedural["lifecycle"]["state"] != "pending_material"
                {
                    return Err("Actual Source lifecycle receipt differs from original private Scene/intent/actor/CAS".into());
                }
                self.native_expression.retain_procedural_checkpoint(
                    &lease,
                    &before.expression_ref,
                    &native_receipt,
                )?;
                let prepared = procedural
                    .get("prepared")
                    .filter(|v| v.is_object())
                    .ok_or("Actual Source lifecycle has no prepared native material")?
                    .clone();
                let position = &procedural["native_position"];
                let proof = json!({"native_position":position,"timing":prepared["timing"],
                    "native_field_receipt":native_receipt["native_field_timing_receipt"],
                    "native_timing_pulse":native_receipt["native_timing_pulse"]});
                super::bootstrap::validate_timing_boundary(
                    &proof,
                    &native_receipt,
                    super::super::cursor(&position["generation"])?,
                    super::super::cursor(&position["samples_elapsed"])?,
                )?;
                let admission = self
                    .expressions
                    .admit_procedural_source(&before, prepared, source)?;
                self.expressions.retain_lifecycle_position(
                    &before,
                    admission["producer_ref"]
                        .as_str()
                        .ok_or("Actual native producer identity absent")?,
                    position,
                )?;
                Ok((admission, completion))
            })();
            match qualified {
                Ok((admission, completion)) => {
                    preparation = admission;
                    native_receipt["procedural"]["admission"] = preparation.clone();
                    let registered = self.native_expression.procedural_receiving_boundary(
                        &self.expressions,
                        &before,
                        &intent.scene_ref,
                        preparation["producer_ref"]
                            .as_str()
                            .ok_or("Actual native producer identity absent")?,
                        Some(&completion),
                    );
                    // Existing internal callers may supply a separately issued
                    // boundary, but it must equal the SAME actual factory result.
                    let registered = registered.and_then(|registered| {
                        if boundary.as_ref().is_some_and(|provided| provided != &registered) {
                            return Err("Supplied native boundary differs from actual registered counterparts".into());
                        }
                        Ok(registered)
                    });
                    if let Ok(boundary) = registered.as_ref() {
                        let receiving = (|| -> Result<Value, String> {
                            let envelope = self.expressions.procedural_receiving_envelope(
                                &before,
                                preparation["producer_ref"]
                                    .as_str()
                                    .ok_or("Actual native producer identity absent")?,
                                boundary,
                            )?;
                            serde_json::to_value(crate::expression::procedural::Request::Prepare {
                                envelope: Box::new(envelope),
                            })
                            .map_err(|e| e.to_string())
                        })();
                        match receiving {
                            Ok(request) => {
                                prepare_request = request;
                                state = "prepared";
                            }
                            Err(error) => {
                                reason = json!(error);
                                state = "reconciliation_required";
                            }
                        }
                    } else {
                        state = "pending_reception";
                        if let Err(refusal) = registered {
                            reason = json!(refusal);
                        }
                    }
                }
                Err(error) => {
                    reason = json!(error);
                    state = "reconciliation_required";
                }
            }
        }
        // The complete consumed ordinal/pulse remains the native receipt even
        // when receiving qualification fails. Inspect supplies actual material.
        let inspected = match self.expressions.apply(
            &self.client,
            ExpressionRequest::Inspect {
                expression_ref: before.expression_ref.clone(),
            },
        ) {
            Ok((value, _)) => value,
            Err(error) => {
                state = "reconciliation_required";
                reason = json!(error);
                json!({"state":"unavailable","document":null})
            }
        };
        let data = json!({"schema":RESPONSE_SCHEMA,"original_intent":original_intent,"state":state,"reason":reason,
            "native_receipt":native_receipt,"native_source_channel":channel_receipt,"preparation":preparation,"document":inspected["document"],
            "source_current":(["prepared","pending_reception"].contains(&state)),"replayed":false});
        let mut data = data;
        if !prepare_request.is_null() {
            data["prepare_request"] = prepare_request;
        }
        Ok(crate::KernelOpOutcome {
            receipts: vec![],
            result: crate::KernelOpResult::Expression { data },
        })
    }
}
