//! Abandon only an actual original native S cancellation. This nonsounding
//! Source settlement does not create a clock, queue withdrawal or release ACK.
use crate::expression::procedural::lifecycle::{CancelIntent, RESPONSE_SCHEMA};
use crate::expression::{Document, Request as ExpressionRequest};
use serde_json::{json, Value};

pub struct Prepared {
    before: Document,
    lease: String,
    identity: Value,
    installed: Value,
    intent: CancelIntent,
    source_intent: super::bootstrap::Intent,
    record: Value,
    original_preparation: Value,
    original_position: Value,
    capture: std::sync::Arc<std::sync::Mutex<super::stage_library::SourceDeliveryCapture>>,
}
pub struct Completed {
    issued: super::bootstrap::IssuedSceneRead,
    prepared: Prepared,
}
impl Prepared {
    pub fn execute(self) -> Result<Completed, String> {
        let issued = super::bootstrap::read_selected_scene_with_capture(
            &self.before, &self.identity, &self.source_intent,
            &self.capture, 1,
        )?;
        Ok(Completed {
            prepared: self,
            issued,
        })
    }
}
impl crate::Kernel {
    pub fn prepare_native_procedural_lifecycle_cancel(
        &mut self,
        op: &crate::KernelOp,
    ) -> Result<Option<Prepared>, String> {
        let crate::KernelOp::Expression {
            request: ExpressionRequest::Procedural { request },
        } = op
        else {
            return Ok(None);
        };
        let crate::expression::procedural::Request::LifecycleCancel {
            expression_ref, expected_revision, ..
        } = request else { return Ok(None); };
        let before = self.expressions.procedural_source_borrow(
            expression_ref,*expected_revision,
        )?;
        let owner = self.native_expression.active.as_ref()
            .ok_or("Lifecycle has no actual current native Source owner")?;
        if owner.stopped || owner.process_exited()? {
            return Err("Lifecycle actual native Source owner has closed".into());
        }
        let capture = std::sync::Arc::new(std::sync::Mutex::new(
            owner.stage_library_replays.reserve_source_delivery(&(
                before,before,before,before,request,request,request,
                &owner.identity,&owner.procedural_source,&owner.procedural_definitions,
            ))?,
        ));
        let intent = CancelIntent::from_request(request)?;
        crate::expression::procedural::bootstrap::preflight_native_intake(before, &intent)?;
        let record = self
            .expressions
            .procedural_cancelled_readback(before, &intent)?;
        let original_preparation = self
            .expressions
            .procedural_cancelled_preparation(before, &intent)?;
        let original_position = self
            .expressions
            .procedural_cancelled_position(before, &intent)?;
        let source_intent = self
            .expressions
            .lifecycle_source_intent(before, &intent.scene_ref)?;
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Cancellation has no actual native Source owner")?;
        if owner.stopped || owner.process_exited()? {
            return Err("Cancellation actual native Source owner is closed".into());
        }
        let lease = owner.lease.clone();
        let identity = owner.identity.clone();
        let installed = self.native_expression.procedural_definition(
            &lease,
            &intent.expression_ref,
            &intent.procedure_ref,
        )?;
        crate::expression::procedural::validate_retained_procedural_definition(
            before, &installed,
        )?;
        Ok(Some(Prepared {
            before: before.clone(),
            lease,
            identity,
            installed,
            intent,
            source_intent,
            record,
            original_preparation,
            original_position,
            capture,
        }))
    }

    pub fn finish_native_procedural_lifecycle_cancel(
        &mut self,
        completed: Completed,
    ) -> Result<crate::KernelOpOutcome, String> {
        let _capture_guard = completed.prepared.capture.clone();
        let Completed { prepared, issued } = completed;
        let Prepared {
            before,
            lease,
            identity,
            installed,
            intent,
            source_intent,
            record,
            original_preparation,
            original_position,
            capture,
        } = prepared;
        drop(capture);
        if self
            .expressions
            .procedural_source_snapshot(&intent.expression_ref, intent.expected_revision)?
            != before
            || self
                .expressions
                .procedural_cancelled_readback(&before, &intent)?
                != record
            || self
                .expressions
                .procedural_cancelled_preparation(&before, &intent)?
                != original_preparation
            || self
                .expressions
                .procedural_cancelled_position(&before, &intent)?
                != original_position
            || self.native_expression.procedural_definition(
                &lease,
                &intent.expression_ref,
                &intent.procedure_ref,
            )? != installed
        {
            return Err("The actual cancelled Operation/Document/installed owner changed during Scene reading".into());
        }
        let scene_read = issued.lifecycle_reading(&before, &intent.scene_ref)?;
        let original_intent = intent.wire()?;
        let input = json!({"schema":"ql.procedural-lifecycle-cancel/v1","expression_ref":intent.expression_ref,
            "document_revision":before.revision,"scene_ref":intent.scene_ref,"operation_ref":intent.operation_ref,
            "actor_ref":intent.actor,"procedure_ref":intent.procedure_ref,
            "expected_procedure_revision":intent.expected_procedure_revision,"scene_read":scene_read,
            "contributors":source_intent.authorship["contributors"],"native_record":record});
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Cancellation native owner closed during reading")?;
        if owner.lease != lease
            || owner.identity != identity
            || owner.stopped
            || owner.process_exited()?
        {
            return Err("Actual native cancellation owner changed during reading".into());
        }
        let request_id = owner
            .last_request_id
            .checked_add(1)
            .ok_or("Native cancellation ordinal exhausted")?;
        let request = json!({"schema":"ql.field-host-request/v1","request_id":request_id.to_string(),
            "instance_ref":identity["instance_ref"],"event_ref":identity["event_ref"],"subject_ref":identity["subject_ref"],
            "command":{"operation":"procedure","request":{"action":"lifecycle_cancel","input":input}}});
        let intake = super::lifecycle::SourceIntake::capture_with_resource(
            &self.native_expression,&lease,&request,
            &mut *(_capture_guard.lock().map_err(|_|"Source capture lock poisoned")?))?;
        let scene_revision = before
            .scenes
            .iter()
            .find(|s| s.scene_ref == intent.scene_ref)
            .ok_or("Actual cancellation Scene disappeared")?
            .revision;
        let outcome = self.with_native_document_scene(
            &before.expression_ref, before.revision, &intent.scene_ref, scene_revision,
            |manager, reader| {
                let resource=_capture_guard.lock().map_err(|_|"Source capture lock poisoned")?;
                manager.with_source_delivery_reply_capture(&lease,&resource,|manager|manager.procedural_lifecycle_scene_read(
                &lease,
                &crate::expression_procedural_scene_reader::NativeSceneSourceReader::CurrentDocument(reader),
                &issued, &source_intent, request,
                ))
            },
        )?;
        let (native_receipt, channel_receipt) = match outcome.result? {
            Ok(receipts) => receipts,
            Err(refusal) => {
                return Ok(super::lifecycle::channel_refused(
                    self,
                    &before.expression_ref,
                    original_intent,
                    &refusal,
                    outcome.currentness.as_ref().err(),
                ));
            }
        };
        let source_currentness = outcome.currentness;
        let source_result = intake.finish(&mut self.native_expression, &native_receipt);
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
            let accepted = (|| -> Result<(), String> {
                source_currentness?;
                source_result?;
                let source = &native_receipt["procedural"];
                let lifecycle = &source["lifecycle"];
                if source["schema"] != "ql.procedural-conduct-receipt/v1"
                    || source["status"] != "material_abandoned"
                    || source["procedure_ref"] != intent.procedure_ref
                    || !source["prepared"].is_null()
                    || source["native_cancelled_record"] != record
                    || source.get("prepared") != Some(&Value::Null)
                    || source["original_preparation"] != original_preparation
                    || source["retained_native_position"] != original_position
                    || lifecycle["schema"] != "ql.procedural-lifecycle-receipt/v1"
                    || lifecycle["state"] != "material_abandoned"
                    || lifecycle["consumer_release"] != "unconfirmed"
                    || lifecycle["document_revision"].as_u64() != Some(before.revision)
                    || lifecycle["operation_ref"] != intent.operation_ref
                    || lifecycle["actor_ref"] != intent.actor
                    || lifecycle["source_read_receipt_ref"] != scene_read["source_read_receipt_ref"]
                    || source["original_preparation"]["operation_ref"] != intent.operation_ref
                    || source["original_preparation"]["native_edit"]["changes"]
                        != record["envelope"]["changes"]
                    || source["original_preparation"]["native_edit"]["actor"] != intent.actor
                    || source["original_preparation"]["native_edit"]["expected_revision"]
                        != record["envelope"]["expected_revision"]
                {
                    return Err("Actual Source abandonment changed the full original native cancellation/preparation/actor/Scene".into());
                }
                self.native_expression.retain_procedural_checkpoint(
                    &lease,
                    &before.expression_ref,
                    &native_receipt,
                )
            })();
            match accepted {
                Ok(()) => state = "material_abandoned",
                Err(error) => {
                    state = "reconciliation_required";
                    reason = json!(error);
                }
            }
        }
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
            "native_receipt":native_receipt,"native_source_channel":channel_receipt,"preparation":null,"document":inspected["document"],"source_current":false,"replayed":false});
        Ok(crate::KernelOpOutcome {
            receipts: vec![],
            result: crate::KernelOpResult::Expression { data },
        })
    }
}
