//! Native procedural conduct uses the existing scoped QL host and its request
//! sequence. Only this Kernel route substitutes owner facts and readback.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub lease: String,
    pub expression_ref: String,
    pub document_revision: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_producer_ref: Option<String>,
    pub request: Value,
}

impl crate::Kernel {
    /// The existing Expression dispatch calls this for human and agent edits.
    /// Attribution is a source preflight over the actual native candidate; the
    /// final Edit keeps the original CAS and ordinary native event emission.
    pub(crate) fn apply_native_expression_with_procedural_attribution(
        &mut self,
        request: crate::expression::Request,
    ) -> Result<(Value, Option<crate::expression::Changed>), String> {
        if let crate::expression::Request::Procedural {
            request: intent @ crate::expression::procedural::Request::AuthoredDriver { .. },
        } = &request
        {
            if let Some(sealed) = self.native_expression.procedural_authored_completion.take() {
                let original = sealed.original();
                let mut evidence = sealed.response();
                if original != request {
                    evidence["state"] = json!("reconciliation_required");
                    evidence["reason"] =
                        json!("Private authored completion has another original intent");
                    evidence["source_current"] = json!(false);
                    return Ok((evidence, None));
                }
                return match self
                    .expressions
                    .finish_authored_mutation(&self.client, sealed)
                {
                    Ok(result) => Ok(result),
                    Err(reason) => {
                        evidence["state"] = json!("reconciliation_required");
                        evidence["reason"] = json!(reason);
                        evidence["source_current"] = json!(false);
                        if let crate::expression::procedural::Request::AuthoredDriver {
                            expression_ref,
                            ..
                        } = intent
                        {
                            evidence["document"] = self
                                .expressions
                                .procedural_current_receiver_document(expression_ref)
                                .ok()
                                .and_then(|document| serde_json::to_value(document).ok())
                                .unwrap_or(Value::Null);
                        }
                        Ok((evidence, None))
                    }
                };
            }
            let mut response = self.expressions.replay_authored_mutation(intent)?;
            if response["state"] == "document_applied" {
                let current = self
                    .expressions
                    .authored_replay_owner(intent)?
                    .ok_or("Original authored private replay owner absent")?
                    .require_current(&mut self.native_expression);
                match current {
                    Ok(()) => response["source_current"] = json!(true),
                    Err(reason) => {
                        response["source_current"] = json!(false);
                        response["state"] = json!("reconciliation_required");
                        response["reason"] = json!(reason);
                    }
                }
            }
            return Ok((response, None));
        }
        if let crate::expression::Request::Procedural {
            request: control @ crate::expression::procedural::Request::Control { .. },
        } = &request
        {
            if let Some(completed) = self.native_expression.procedural_manual_completion.take() {
                if completed.original() != &request {
                    return self.native_procedural_control_refusal(
                        control,
                        "Private completion has another original control intent".into(),
                    );
                }
                let Some(completed) = completed.into_control() else {
                    return self.native_procedural_control_refusal(
                        control,
                        "Manual attribution cannot grant native control".into(),
                    );
                };
                return match completed.finish(&mut self.expressions, &self.client) {
                    Ok(result) => Ok(result),
                    Err(reason) => self.native_procedural_control_refusal(control, reason),
                };
            }
            return match self.expressions.prepare_procedural_control(&request) {
                Ok(None) => self.expressions.apply(&self.client, request.clone()),
                Ok(Some(_)) => self.native_procedural_control_refusal(
                    control,
                    "Native control requires Source prepare/execute/finish outside the Kernel lock"
                        .into(),
                ),
                Err(reason) => self.native_procedural_control_refusal(control, reason),
            };
        }
        let expression_ref = match &request {
            crate::expression::Request::Edit { expression_ref, .. }
            | crate::expression::Request::Restore { expression_ref, .. } => expression_ref,
            crate::expression::Request::Review {
                expression_ref,
                decision,
                ..
            } if *decision == crate::expression::RefinementState::Accepted => expression_ref,
            _ => return self.expressions.apply(&self.client, request),
        };
        if let Some(completed) = self.native_expression.procedural_manual_completion.take() {
            if completed.original() != &request {
                return self.native_procedural_unexchanged_edit_refusal(
                    expression_ref,
                    "Private intervention completion differs from the original native request"
                        .into(),
                );
            }
            let admitted = completed.into_records().and_then(|(candidate, records)| {
                self.expressions
                    .finish_procedural_manual_edit(&self.client, candidate, records)
            });
            return match admitted {
                Ok(result) => Ok(result),
                Err(reason) => {
                    self.native_procedural_unexchanged_edit_refusal(expression_ref, reason)
                }
            };
        }
        match self
            .expressions
            .prepare_procedural_manual_request(&self.client, &request)
        {
            Ok(None) => match self.expressions.apply(&self.client, request.clone()) {
                Ok((mut result, changed)) => {
                    result["native_procedural_receipts"] = json!([]);
                    Ok((result, changed))
                }
                Err(reason) => {
                    self.native_procedural_unexchanged_edit_refusal(expression_ref, reason)
                }
            },
            Ok(Some(_)) => self.native_procedural_unexchanged_edit_refusal(
                expression_ref,
                "Actual intervention Source requires the native prepare/execute/finish route"
                    .into(),
            ),
            Err(reason) => self.native_procedural_unexchanged_edit_refusal(expression_ref, reason),
        }
    }

    /// Pure native Source attribution never issues a field-host ordinal. A stale/invalid Edit therefore preserves ongoing
    /// playback, while the actual refusal still reaches native Working.
    pub(crate) fn native_procedural_unexchanged_edit_refusal(
        &mut self,
        expression_ref: &str,
        reason: String,
    ) -> Result<(Value, Option<crate::expression::Changed>), String> {
        let inspected = self.expressions.apply(
            &self.client,
            crate::expression::Request::Inspect {
                expression_ref: expression_ref.into(),
            },
        );
        let mut state = inspected
            .map(|(state, _)| state)
            .unwrap_or_else(|_| json!({"expression_ref":expression_ref}));
        state["state"] = json!("procedural_attribution_refused");
        state["reason"] = json!(reason);
        state["native_procedural_receipts"] = json!([]);
        Ok((state, None))
    }

    fn native_procedural_control_refusal(
        &mut self,
        request: &crate::expression::procedural::Request,
        reason: String,
    ) -> Result<(Value, Option<crate::expression::Changed>), String> {
        let crate::expression::procedural::Request::Control {
            expression_ref,
            expected_revision,
            operation_ref,
            ..
        } = request
        else {
            return Err(reason);
        };
        let inspected = self
            .expressions
            .apply(
                &self.client,
                crate::expression::Request::Inspect {
                    expression_ref: expression_ref.clone(),
                },
            )?
            .0;
        Ok((
            json!({"schema":crate::expression::procedural::SCHEMA,"operation":"control","operation_ref":operation_ref,"original_intent":request,
            "state":if inspected["document"]["revision"].as_u64()!=Some(*expected_revision){"revision_conflict"}else{"source_refused"},
            "reason":reason,"document":inspected["document"],"native_procedural_receipts":[],
            "cache":{"provenance":"unqualified","restored":true,"replayed":false}}),
            None,
        ))
    }

    pub fn native_procedural_conduct(&mut self, input: Request) -> Result<Value, String> {
        if matches!(input.request["command"]["request"]["action"].as_str(), Some("install_prepared"|"source_continue")) {
            if input.request["schema"]!="ql.field-host-request/v1" || input.request["command"]["operation"]!="procedure" {
                return Err("Native definition uses the original scoped Host request".into());
            }
            let before=self.expressions.procedural_current_receiver_document(&input.expression_ref)?;
            if before.revision!=input.document_revision {return Err("revision_conflict".into());}
            let scene_ref=self.native_expression.native_definition_scene_ref(&self.expressions,before)?;
            let outcome=if input.request["command"]["request"]["action"]=="install_prepared" {
                self.native_install_prepared_definition(input,&scene_ref)?
            } else {
                self.native_continue_original_definition(input,&scene_ref)?
            };
            return match outcome.result {
                crate::KernelOpResult::NativeExpression {data}=>Ok(data),
                _=>Err("Native definition returned another original Kernel result".into()),
            };
        }
        let before = self
            .expressions
            .procedural_source_snapshot(&input.expression_ref, input.document_revision)?;
        let mut request = input.request;
        if request["schema"] != "ql.field-host-request/v1"
            || request["command"]["operation"] != "procedure"
        {
            return Err("Procedural conduct uses the existing scoped native host request".into());
        }
        let command = request["command"]["request"]
            .as_object_mut()
            .ok_or("Missing typed native procedural action")?;
        let action = command
            .get("action")
            .and_then(Value::as_str)
            .ok_or("Missing native procedural action")?
            .to_owned();
        let definition = match action.as_str() {
            "install" | "replace" => Some(
                command
                    .get("definition")
                    .cloned()
                    .ok_or("Missing original native procedure definition")?,
            ),
            "restore" => Some(
                command
                    .get("checkpoint")
                    .and_then(|value| value.get("definition"))
                    .cloned()
                    .ok_or("Missing original native checkpoint definition")?,
            ),
            _ => None,
        };
        if let Some(definition) = &definition {
            let source_ref = input
                .source_producer_ref
                .as_deref()
                .ok_or("Installation and restore require the actual native compiler admission")?;
            let mut current = definition.clone();
            if action == "restore" {
                current["document_revision"] = json!(before.revision);
            }
            if matches!(action.as_str(), "install" | "replace") {
                self.native_expression
                    .check_registered_definition_consumers(&self.expressions, &before, &current)?;
            }
            self.expressions
                .qualify_procedural_definition(&before, source_ref, &current)?;
            self.native_expression
                .check_procedural_definition_budget(&input.lease, definition)?;
        } else if input.source_producer_ref.is_some() {
            return Err(
                "A source admission cannot be relabeled as another native conduct action".into(),
            );
        }
        let procedure = match action.as_str() {
            "event" | "retire" | "material_readback" => command
                .get("input")
                .and_then(|value| value.get("procedure_ref")),
            "read" | "pause" | "resume" | "seek" | "cancel" | "checkpoint" | "begin_interval" => {
                command.get("procedure_ref")
            }
            _ => None,
        }
        .and_then(Value::as_str)
        .map(str::to_owned);
        if let Some(procedure) = &procedure {
            let installed = self.native_expression.procedural_definition(
                &input.lease,
                &before.expression_ref,
                procedure,
            )?;
            crate::expression::procedural::validate_retained_procedural_definition(
                &before, &installed,
            )?;
        }
        match action.as_str() {
            "material_readback" => {
                let input = command
                    .get("input")
                    .and_then(Value::as_object)
                    .ok_or("Missing original procedural readback identities")?;
                if input.len() != 2
                    || !input.contains_key("procedure_ref")
                    || !input.contains_key("operation_ref")
                {
                    return Err("Native material readback accepts original identities only; receipts come from the existing owner".into());
                }
                let procedure = input["procedure_ref"]
                    .as_str()
                    .ok_or("Missing original procedure identity")?;
                let operation = input["operation_ref"]
                    .as_str()
                    .ok_or("Missing original native operation identity")?;
                let actual = self.expressions.procedural_material_readback(
                    &before.expression_ref,
                    procedure,
                    operation,
                )?;
                command.insert("input".into(), actual);
            }
            "install" | "replace" => {
                crate::expression::procedural::validate_source_payload(
                    &before,
                    command
                        .get("definition")
                        .ok_or("Missing original native procedure definition")?,
                )?;
            }
            "event" | "retire" => {
                let input = command
                    .get_mut("input")
                    .ok_or("Missing native procedure event")?;
                let procedure = input["procedure_ref"]
                    .as_str()
                    .ok_or("Missing original procedure identity")?
                    .to_owned();
                let (reading, _) = self.expressions.procedural(
                    &self.client,
                    crate::expression::procedural::Request::ReadOutputs {
                        expression_ref: before.expression_ref.clone(),
                        expected_revision: before.revision,
                        procedure_ref: procedure,
                    },
                )?;
                if input["output_readings"] != reading["output_readings"] {
                    return Err("Rule event output capability differs from the actual current original native owner".into());
                }
                input["output_readings"] = reading["output_readings"].clone();
                let current = input["current_contributions"]
                    .as_array()
                    .ok_or("Missing actual current native contribution array")?;
                let contexts = crate::expression::procedural::source_event_intervention_contexts(
                    &before, current,
                )?;
                if let Some(supplied) = input.get("intervention_contexts") {
                    if !supplied.as_array().is_some_and(Vec::is_empty)
                        && supplied != &json!(contexts)
                    {
                        return Err("Caller event context differs from actual native retained intervention basis".into());
                    }
                }
                input["intervention_contexts"] = json!(contexts);
                crate::expression::procedural::validate_source_payload(&before, input)?;
            }
            "library_build" => crate::expression::procedural::validate_source_payload(
                &before,
                command
                    .get("input")
                    .ok_or("Missing original native library source")?,
            )?,
            "restore" => self.native_expression.validate_procedural_checkpoint(
                &input.lease,
                command
                    .get("checkpoint")
                    .ok_or("Missing native checkpoint")?,
            )?,
            "library_discover" | "read" | "pause" | "seek" | "cancel" | "checkpoint" | "resume"
            | "begin_interval" => {}
            // Ordinary editing supplies this as a protected preflight with its
            // exact before/candidate and CAS. Public conduct cannot author it.
            "interventions" => return Err(
                "Attributable interventions enter through the existing accepted native Edit owner"
                    .into(),
            ),
            _ => return Err("Unsupported source-owned native procedural action".into()),
        }
        let (mut reply, source) = self
            .native_expression
            .exchange_procedure(&input.lease, request)?;
        if reply["status"] == "ok" {
            if let Some(definition) = definition {
                self.native_expression.retain_procedural_definition(
                    &input.lease,
                    definition,
                    &reply,
                )?;
            }
            self.native_expression.retain_procedural_checkpoint(
                &input.lease,
                &before.expression_ref,
                &reply,
            )?;
            if let Some(prepared) = reply["procedural"]
                .get("prepared")
                .filter(|value| !value.is_null())
                .cloned()
            {
                let admission = self
                    .expressions
                    .admit_procedural_source(&before, prepared, source)?;
                reply["procedural"]["admission"] = admission;
            }
        }
        Ok(
            json!({"schema":"oi.expression-procedural-conduct/v1","expression_ref":before.expression_ref,"document_revision":before.revision,"native_receipt":reply}),
        )
    }
}

#[path = "native_expression_procedural_definition_budget.rs"]
mod definition_budget;
impl super::super::Manager {
    pub(crate) fn procedural_definition(
        &self, lease: &str, expression: &str, procedure: &str,
    ) -> Result<Value, String> {
        let definition = self.procedural_definition_borrowed(lease, expression, procedure)?;
        crate::expression::procedural::bootstrap::preflight_source_message(definition)?;
        Ok(definition.clone())
    }
    pub(crate) fn procedural_definition_borrowed(
        &self,
        lease: &str,
        expression: &str,
        procedure: &str,
    ) -> Result<&Value, String> {
        let owner = self
            .active
            .as_ref()
            .ok_or("No active native procedural owner")?;
        if owner.lease != lease {
            return Err("native-expression.foreign_lease".into());
        }
        let definition = owner
            .procedural_definitions
            .get(procedure)
            .ok_or("The procedure has no installed qualification in this actual native owner")?;
        if definition["expression_ref"] != expression {
            return Err("Native procedure belongs to another Expression".into());
        }
        Ok(definition)
    }
    pub(crate) fn check_procedural_definition_budget(
        &self,
        lease: &str,
        definition: &Value,
    ) -> Result<(), String> {
        let owner = self
            .active
            .as_ref()
            .ok_or("No active native procedural owner")?;
        if owner.lease != lease {
            return Err("native-expression.foreign_lease".into());
        }
        let reference = definition["procedure"]["procedure_ref"]
            .as_str()
            .ok_or("Missing original procedure identity")?;
        definition_budget::prospective(&owner.procedural_definitions, reference, definition)
    }
    pub(crate) fn retain_procedural_definition(
        &mut self,
        lease: &str,
        definition: Value,
        reply: &Value,
    ) -> Result<(), String> {
        self.check_procedural_definition_budget(lease, &definition)?;
        let reference = definition["procedure"]["procedure_ref"]
            .as_str()
            .ok_or("Missing procedure identity")?
            .to_owned();
        if reply["procedural"]["procedure_ref"].as_str() != Some(reference.as_str()) {
            self.active.take();
            return Err(
                "Actual conductor acknowledged another procedure; owner closed without replay"
                    .into(),
            );
        }
        self.active
            .as_mut()
            .ok_or("Native owner closed")?
            .procedural_definitions
            .insert(reference, definition);
        Ok(())
    }
    pub(crate) fn validate_procedural_checkpoint(
        &self,
        lease: &str,
        checkpoint: &Value,
    ) -> Result<(), String> {
        let owner = self
            .active
            .as_ref()
            .ok_or("No active native procedural owner")?;
        if owner.lease != lease {
            return Err("native-expression.foreign_lease".into());
        }
        let reference = checkpoint["definition"]["procedure"]["procedure_ref"]
            .as_str()
            .ok_or("Missing checkpoint identity")?;
        let hash =
            super::super::sha256_hex(&serde_json::to_vec(checkpoint).map_err(|e| e.to_string())?);
        if !owner
            .procedural_checkpoints
            .get(reference)
            .is_some_and(|proofs| proofs.contains(&hash))
        {
            return Err("Checkpoint is not the original checkpoint captured by this actual native owner; explicit current source continuation is required".into());
        }
        Ok(())
    }
    pub(crate) fn retain_procedural_checkpoint(
        &mut self,
        lease: &str,
        expression: &str,
        reply: &Value,
    ) -> Result<(), String> {
        let Some(checkpoint) = reply["procedural"]
            .get("checkpoint")
            .filter(|value| !value.is_null())
        else {
            return Ok(());
        };
        let reference = checkpoint["definition"]["procedure"]["procedure_ref"]
            .as_str()
            .ok_or("Actual checkpoint omitted original procedure")?;
        self.procedural_definition(lease, expression, reference)?;
        let hash =
            super::super::sha256_hex(&serde_json::to_vec(checkpoint).map_err(|e| e.to_string())?);
        let owner = self.active.as_mut().ok_or("Native owner closed")?;
        let proofs = owner
            .procedural_checkpoints
            .entry(reference.into())
            .or_default();
        if proofs.len() >= 256 && !proofs.contains(&hash) {
            return Err("Native checkpoint qualification budget exceeded".into());
        }
        proofs.insert(hash);
        Ok(())
    }
    /// Only protected Kernel intake invokes this. Generic public Exchange
    /// continues to refuse procedure commands; no caller record grants it.
    pub(crate) fn exchange_procedure(
        &mut self,
        lease: &str,
        request: Value,
    ) -> Result<(Value, Value), String> {
        let owner = self
            .active
            .as_mut()
            .ok_or("native-expression.unavailable: no active owner")?;
        if lease != owner.lease {
            return Err("native-expression.foreign_lease".into());
        }
        if request["schema"] != "ql.field-host-request/v1"
            || request["command"]["operation"] != "procedure"
        {
            return Err(
                "Protected conduct requires the original native host procedure envelope".into(),
            );
        }
        for key in ["instance_ref", "event_ref", "subject_ref"] {
            if request[key] != owner.identity[key] {
                return Err(format!("native-expression.foreign_{key}"));
            }
        }
        let id = super::super::cursor(&request["request_id"])?;
        if Some(id) != owner.last_request_id.checked_add(1) {
            return Err("native-expression.stale_request".into());
        }
        let bytes = serde_json::to_vec(&request).map_err(|e| e.to_string())?;
        if bytes.len() > super::super::MAX_REQUEST {
            return Err("Native request exceeds32 MiB".into());
        }
        let original_request = request["command"]["request"].clone();
        let source = owner.procedural_source.clone();
        let executable = owner.procedural_executable.clone();
        let reply = owner
            .tx
            .as_ref()
            .ok_or("native transport closed")?
            .send(request)
            .map_err(|_| "native pipe closed".to_owned())
            .and_then(|_| owner.receive());
        match reply {
            Ok(reply)
                if reply["schema"] == "ql.field-host-receipt/v1"
                    && reply["instance_ref"] == owner.identity["instance_ref"]
                    && super::super::cursor(&reply["request_id"]).ok() == Some(id)
                    && super::super::cursor(&reply["last_request_id"]).ok() == Some(id)
                    && reply["available"] == true
                    && ["ok", "refused"].contains(&reply["status"].as_str().unwrap_or(""))
                    && ["generation", "samples_elapsed"]
                        .iter()
                        .all(|key| super::super::cursor(&reply["field"][key]).is_ok()) =>
            {
                owner.last_request_id = id;
                // A full field/PCM copy is not a continuation store. Keep only
                // exact native cursors needed for the next serialized preflight.
                owner.procedural_position = json!({"generation":reply["field"]["generation"],"samples_elapsed":reply["field"]["samples_elapsed"]});
                let result_sha = super::super::sha256_hex(
                    &serde_json::to_vec(&reply).map_err(|e| e.to_string())?,
                );
                Ok((
                    reply,
                    json!({"schema":"oi.native-expression-composed-source/v1",
                    "ql_executable":executable,"native_binding":source,"native_request_id":id.to_string(),
                    "original_request":original_request,"request_sha256":super::super::sha256_hex(&bytes),"result_sha256":result_sha}),
                ))
            }
            result => {
                let reason = result
                    .err()
                    .unwrap_or_else(|| "native acknowledgement standing unknown".into());
                let diagnostics = owner.diagnostic();
                self.active.take();
                Err(format!(
                    "native-expression.unknown: {reason}; {diagnostics}; no automatic replay"
                ))
            }
        }
    }
}
