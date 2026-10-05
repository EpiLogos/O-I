//! Protected native hydration and SAME existing C/Host delivery. No ordinary
//! public Exchange admits these commands; only this private factory substitutes
//! the sealed pending batch/current original definition before the one exchange.
use super::*;
use crate::native_expression::procedural::conduct::Request;
use crate::native_expression::procedural::lifecycle::SourceIntake;

const RESPONSE: &str = "oi.native-procedural-definition/v1";
enum Work {
    Initial(NativePendingDefinition),
    Continue(Value),
}
impl Work {
    fn command(&self) -> &Value {
        match self {
            Self::Initial(p) => p.command(),
            Self::Continue(command) => command,
        }
    }
}
impl crate::Kernel {
    /// Root's normal Library reply gives a native producer ref. The UI submits
    /// only that identity in the existing outer Request and action-only Host
    /// command; this protected function hydrates the complete private definition.
    pub(crate) fn native_install_prepared_definition(
        &mut self,
        input: Request,
        scene_ref: &str,
    ) -> Result<crate::KernelOpOutcome, String> {
        if input.request["command"]["request"] != json!({"action":"install_prepared"}) {
            return Err(
                "Initial definition accepts the exact native producer identity only".into(),
            );
        }
        input.source_producer_ref.as_deref()
            .ok_or("Actual first native compiler admission absent")?;
        let anchor=self.capture_current_native_definition_delivery(&input,scene_ref)?;
        let mut delivery=crate::native_expression::procedural::stage_library::SourceDeliveryContext {
            data:input,resource:anchor};
        let input=&delivery.data;
        let producer_ref=input.source_producer_ref.as_deref()
            .ok_or("Actual first native compiler admission absent")?;
        let before=self.expressions.procedural_source_borrow(&input.expression_ref,input.document_revision)?;
        let pending = self.native_expression.native_prepared_definition(
            &self.expressions,
            before,
            scene_ref,
            producer_ref,
            delivery.resource.copies(),
        )?;
        pending.require_current(
            &mut self.native_expression,
            &self.expressions,
            before,
            scene_ref,
        )?;
        // Entire actual pending/read/command expansion is reserved; only now
        // copy the full accepted Document for the protected delivery lifetime.
        let before=self.expressions.procedural_source_snapshot(&input.expression_ref,input.document_revision)?;
        self.deliver_native_definition(delivery.data,scene_ref,before,
            Work::Initial(pending),delivery.resource)
    }
    /// `current_readings` and `materialization` are hydrated by Root's protected
    /// actual Document reader. They are not fields on the public identities-only
    /// Request. Fresh no-write bootstrap already owns the current opaque issuer.
    pub(crate) fn native_continue_original_definition(
        &mut self,
        input: Request,
        scene_ref: &str,
    ) -> Result<crate::KernelOpOutcome, String> {
        let request = &input.request["command"]["request"];
        request["procedure_ref"].as_str()
            .ok_or("Original installed Procedure identity absent")?;
        if request.as_object().is_none_or(|object| object.len() != 2)
            || request["action"] != "source_continue"
            || input.source_producer_ref.is_some()
        {
            return Err("Continuation accepts original installed identity only".into());
        }
        let anchor=self.capture_current_native_definition_delivery(&input,scene_ref)?;
        let mut delivery=crate::native_expression::procedural::stage_library::SourceDeliveryContext {
            data:input,resource:anchor};
        let input=&delivery.data;
        let procedure_ref=input.request["command"]["request"]["procedure_ref"].as_str()
            .ok_or("Original installed Procedure identity absent")?;
        let before=self.expressions.procedural_source_borrow(&input.expression_ref,input.document_revision)?;
        let installed=self.native_expression.procedural_definition_borrowed(
            &input.lease,&input.expression_ref,procedure_ref)?;
        let reading=self.expressions.procedural_continuation_reading_with_capture(
            before,scene_ref,installed,&mut |bytes|delivery.resource.copies().preflight_copy_bytes(
                bytes.checked_mul(4).ok_or("Continuation reader/command copy expansion overflow")?))?;
        let command = self.native_expression.native_source_continuation_input(
            &self.expressions,
            before,
            scene_ref,
            &input.lease,
            procedure_ref,
            &reading["current_readings"],
            &reading["materialization"],
            delivery.resource.copies(),
        )?;
        // This owned reader cohort is already represented in the command.
        // Destroy it while the original reservation is still in this scope.
        drop(reading);
        let before=self.expressions.procedural_source_snapshot(&input.expression_ref,input.document_revision)?;
        self.deliver_native_definition(delivery.data,scene_ref,before,
            Work::Continue(command),delivery.resource)
    }
    /// Deliver the original private initial/continuation factory under its
    /// existing capture. Heavy work is held in a resource-last container.
    fn deliver_native_definition(
        &mut self,
        input: Request,
        scene_ref: &str,
        before: Document,
        work: Work,
        anchor:crate::native_expression::definition_outcome::DeliveryAnchor,
    ) -> Result<crate::KernelOpOutcome, String> {
        let mut delivery=crate::native_expression::procedural::stage_library::SourceDeliveryContext {
            data:(input,before,Some(work)),resource:Some(anchor)};
        let (input,before,work)=&mut delivery.data;
        let anchor=delivery.resource.as_mut().ok_or("Original delivery resource absent")?;
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            &*input,
            &*input,
            work.as_ref().ok_or("Original private work absent")?.command(),
            &*before,
        ))?;
        let scene_owner = self
            .expressions
            .procedural_scene_owner(before, scene_ref)?;
        let scene_revision = before
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == scene_ref)
            .ok_or("Actual definition Scene absent")?
            .revision;
        anchor.copies().preflight_copies(&(
            work.as_ref().ok_or("Original private work absent")?.command(),
            work.as_ref().ok_or("Original private work absent")?.command(),
            work.as_ref().ok_or("Original private work absent")?.command()))?;
        let original_intent = input.clone();
        let captured_producer_ref = input.source_producer_ref.clone();
        let original_request = input.request.clone();
        let mut request = std::mem::take(&mut input.request);
        request["command"]["request"] = work.as_ref().ok_or("Original private work absent")?.command().clone();
        let intake = SourceIntake::capture(&self.native_expression, &input.lease, &request)?;
        self.native_expression
            .active
            .as_mut()
            .ok_or("Actual definition owner closed")?
            .definition_reply_limit = Some(anchor.reply_limit());
        let outcome=self.with_native_document_scene(&before.expression_ref,before.revision,scene_ref,scene_revision,
            |manager,reader|manager.procedural_registered_definition_scene_read(&input.lease,
                &crate::expression_procedural_scene_reader::NativeSceneSourceReader::CurrentDocument(reader),request));
        if let Some(owner) = self.native_expression.active.as_mut() {
            owner.definition_reply_limit = None;
        }
        let outcome = outcome?;
        let (reply, channel) = match outcome.result? {
            Ok(actual) => actual,
            Err(refusal) => {
                // Missing native receipt remains uncertain for the existing
                // Session; never normalize a possibly consumed request to [].
                let (reason, channel, diagnostics, _) = refusal.into_recording_custody();
                // Selected receipt disclosure is copied under the original
                // ingress reservation; the complete terminal body is MOVED.
                let native_receipt = channel
                    .as_ref()
                    .and_then(|value| value.get("result"))
                    .and_then(|value| value.get("native_receipt"))
                    .cloned()
                    .unwrap_or(Value::Null);
                let fields = json!({"schema":RESPONSE,"original_request":original_request,
                    "original_intent":original_intent,"captured_producer_ref":captured_producer_ref,
                    "state":"definition_channel_refused","reason":reason,
                    "source_current":false,"material_status":"pending_reception","consumer_release":"unconfirmed"});
                let Value::Object(mut fields) = fields else {
                    return Err("Definition wrapper unavailable".into());
                };
                fields.insert(
                    "native_source_channel".into(),
                    channel.unwrap_or(Value::Null),
                );
                fields.insert("native_receipt".into(), native_receipt);
                drop(diagnostics);
                drop(work.take());
                return self.retain_native_definition_outcome(
                    delivery.resource.take().ok_or("Original delivery resource absent")?,
                    Value::Object(fields));
            }
        };
        // The actual native ordinal is consumed regardless of later refusal.
        // Retain its original full pulse/receipt in every returned result.
        let completion = intake.finish_qualified(&mut self.native_expression, &reply);
        let admitted = outcome
            .currentness
            .and(completion)
            .and_then(|completion| match work.take().ok_or("Original private work absent")? {
                Work::Initial(pending) => self.native_expression.retain_prepared_definition(
                    &self.expressions,
                    &*before,
                    pending,
                    scene_owner,
                    completion,
                ),
                Work::Continue(_) => self
                    .native_expression
                    .retain_registered_source_continuation(
                        &self.expressions,
                        &*before,
                        scene_owner,
                        completion,
                    ),
            });
        let (state, reason) = match admitted {
            Ok(()) => ("definition_received", None),
            Err(reason) => ("definition_qualification_refused", Some(reason)),
        };
        // Build only the selected disclosure under the existing reservation.
        // Do not serialize-borrow the full channel/receipt: MOVE each original
        // into the terminal wrapper before reducing its reserved capacity.
        let definition_receipt = reply["procedural"]["definition_receipt"].clone();
        let material_status = definition_receipt["material_status"].clone();
        let fields = json!({"schema":RESPONSE,"original_request":original_request,
            "original_intent":original_intent,"captured_producer_ref":captured_producer_ref,
            "state":state,"reason":reason,"source_current":reason.is_none(),"consumer_release":"unconfirmed"});
        let Value::Object(mut fields) = fields else {
            return Err("Definition wrapper unavailable".into());
        };
        fields.insert("definition_receipt".into(), definition_receipt);
        fields.insert("material_status".into(), material_status);
        fields.insert("native_receipt".into(), reply);
        fields.insert("native_source_channel".into(), channel);
        self.retain_native_definition_outcome(
                    delivery.resource.take().ok_or("Original delivery resource absent")?,
                    Value::Object(fields))
    }
}
