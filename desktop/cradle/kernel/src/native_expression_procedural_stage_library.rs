//! The normal Stage submits authored choices. This factory reads the actual
//! Document and borrows the SAME completed Source context before the existing
//! QL library/compiler executes outside the mutation lock. No wire issues a grant.
use crate::expression::procedural::{Envelope, Scope};
use crate::expression::{Document, ReadingRef};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

pub const SCHEMA: &str = "oi.native-procedural-stage-library/v1";
pub const CAPABILITY_SCHEMA: &str = "oi.native-procedural-stage-capability/v1";
const COMPILER_BYTES: usize = crate::expression::procedural::budget::SOURCE_BYTES;
const MAX_MEMOS: usize = 64;
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Basis {
    pub expression_ref: String,
    pub document_revision: u64,
    pub scene_ref: String,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CapabilityRequest {
    pub basis: Basis,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Prepare,
    Regenerate,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Intent {
    pub basis: Basis,
    pub operation_ref: String,
    pub source: Value,
    pub profile: ReadingRef,
    pub authored: Value,
    pub choice: Value,
    pub scope: Scope,
    pub action: Action,
}
impl Intent {
    pub(crate) fn validate(&self, document: &Document) -> Result<(), String> {
        for value in [
            &self.basis.expression_ref,
            &self.basis.scene_ref,
            &self.operation_ref,
        ] {
            crate::expression::text(value)?;
        }
        crate::expression::readings(std::slice::from_ref(&self.profile))?;
        if document.expression_ref != self.basis.expression_ref
            || document.revision != self.basis.document_revision
            || self.profile.availability != crate::expression::Availability::Available
            || !document
                .scenes
                .iter()
                .any(|scene| scene.scene_ref == self.basis.scene_ref)
            || !self.authored.is_object()
            || !self.choice.is_object()
            || ![
                "scene_material",
                "sequence_material",
                "force_parameters",
                "atlas_passage",
            ]
            .contains(&self.choice["recipe"].as_str().unwrap_or(""))
        {
            return Err(
                "Library requires exact actual native Document/Scene and available profile".into(),
            );
        }
        crate::expression::procedural::bootstrap::preflight_native_intake(document, self)
    }
    pub(crate) fn property_keys(&self) -> Result<Vec<String>, String> {
        let mut keys = BTreeSet::new();
        if self.choice["recipe"] == "force_parameters" {
            for write in self.choice["writes"]
                .as_array()
                .ok_or("Missing authored native force writes")?
            {
                let parameter = write["parameter"]
                    .as_str()
                    .ok_or("Missing authored native Parameter")?;
                if !["force_strength", "force_spin", "force_radius"].contains(&parameter) {
                    return Err("Unknown native force Parameter".into());
                }
                keys.insert(parameter.to_owned());
                if write["value"]["value_source"] == "native_property" {
                    keys.insert(
                        write["value"]["property"]
                            .as_str()
                            .ok_or("Missing native property operand")?
                            .to_owned(),
                    );
                }
            }
        }
        if self.choice["recipe"] == "atlas_passage" {
            keys.insert("native_atlas_state".into());
        }
        for condition in self.authored["conditions"]
            .as_array()
            .ok_or("Missing actual authored conditions")?
        {
            if let Some(property) = condition["property"].as_str() {
                keys.insert(property.into());
            }
        }
        if keys.len() > 64 {
            return Err("Native Library property request exceeds its bound".into());
        }
        Ok(keys.into_iter().collect())
    }
}

/// Existing native Owner's bounded original-operation retry custody. It dies
/// with that owner and cannot be imported by JSON or restored from a label.
#[derive(Debug, Serialize)]
pub(crate) struct Memo {
    intent: Intent,
    envelope: Option<Envelope>,
    preview: Value,
    admission: Value,
    /// Actual readonly compiler outcome; it issues no producer or journal.
    no_change: Option<Value>,
    document_fingerprint: String,
    context_fingerprint: String,
}
#[derive(Debug, Default)]
pub(crate) struct Memos {
    rows: BTreeMap<String, Memo>,
}
impl Memos {
    fn require_new(&self, intent: &Intent) -> Result<(), String> {
        if self.rows.contains_key(&intent.operation_ref) {
            return Err(
                "Original Library operation already issued; use its exact native retry".into(),
            );
        }
        if self.rows.len() >= MAX_MEMOS {
            return Err("Native Library original-operation retention is full; settle its owner before further production".into());
        }
        Ok(())
    }
    fn previous(
        &self,
        outputs: &Value,
        procedure: &Value,
        applied: &Value,
        prefix: &impl Serialize,
    ) -> Result<(Value, Value), String> {
        let rows = outputs
            .as_array()
            .ok_or("Actual retained output reading absent")?;
        let mut previous = Vec::new();
        let mut membership: Option<&Value> = None;
        for reading in rows {
            let mut found: Option<(u64, &Value, &Value)> = None;
            for memo in self.rows.values().filter(|memo| {
                memo.admission["prepared"]["procedure_ref"] == procedure["procedure_ref"]
            }) {
                let Some(witness) = applied
                    .as_array()
                    .ok_or("Actual native applied preparation list absent")?
                    .iter()
                    .find(|row| {
                        row["operation_ref"] == memo.intent.operation_ref
                            && row["producer_ref"] == memo.admission["producer_ref"]
                    })
                else {
                    continue;
                };
                let revision = witness["applied_revision"]
                    .as_u64()
                    .ok_or("Actual native preparation application revision absent")?;
                for contribution in memo.admission["prepared"]["contributions"]
                    .as_array()
                    .ok_or("Original native contributions absent")?
                {
                    if contribution["contribution_ref"] != reading["contribution_ref"] {
                        continue;
                    }
                    if !crate::expression::procedural::budget::generated_basis_matches(
                        &contribution["generated_basis"],
                        &reading["generated_basis"],
                    ) || contribution["owned_addresses"] != reading["owned_addresses"]
                    {
                        continue;
                    }
                    let actual = &memo.admission["prepared"]["membership"];
                    match &found {
                        Some((old_revision, old, _))
                            if *old_revision == revision && *old != contribution =>
                        {
                            return Err("Two original native preparations claim the same actual applied revision".into());
                        }
                        Some((old_revision, _, _)) if *old_revision >= revision => {}
                        _ => found = Some((revision, contribution, actual)),
                    }
                }
            }
            let (_, contribution, actual) = found.ok_or("Actual applied native constructor preparation is unavailable; restore its original native checkpoint before regenerating")?;
            if membership.as_ref().is_some_and(|old| *old != actual) {
                return Err("Native original membership requires the actual continuing conductor checkpoint".into());
            }
            membership = Some(actual);
            previous.push(contribution);
        }
        let mut budget = crate::expression::procedural::budget::Budget::new();
        budget.value(prefix)?;
        budget.value(&previous)?;
        budget.value(&membership)?;
        budget.reserve(4096)?;
        Ok((
            serde_json::to_value(previous).map_err(|e| e.to_string())?,
            membership.cloned().unwrap_or(Value::Null),
        ))
    }
    fn reserve(&self, memo: &Memo) -> Result<(), String> {
        let mut budget = crate::expression::procedural::budget::Budget::new();
        for row in self.rows.values() {
            budget.value(row)?;
        }
        budget.value(memo)?;
        budget.reserve(4096)
    }
    fn reserve_completion(&self, memo: &Memo, envelope: &Envelope) -> Result<(), String> {
        let mut budget = crate::expression::procedural::budget::Budget::new();
        for row in self.rows.values() {
            budget.value(row)?;
        }
        budget.value(memo)?;
        budget.value(envelope)?;
        budget.reserve(4096)
    }
}

pub struct Prepared {
    before: Document,
    intent: Intent,
    operands: Value,
    context: Value,
    context_fingerprint: String,
    required_consumers: Value,
    previous: Value,
    previous_membership: Value,
}
pub struct Completed {
    captured: Prepared,
    response: Value,
    prepared: Value,
}
fn validate_no_change(captured: &Prepared, response: &Value) -> Result<(), String> {
    let result = &response["native_result"]["result"];
    let basis = &result["no_change_basis"];
    let original = &response["source"]["original_request"];
    let procedure = &original["procedure"];
    let qualification = &result["source_qualification"];
    let currentness = &qualification["currentness"];
    if captured.intent.action != Action::Regenerate
        || result["outcome"] != "no_change"
        || !result["prepared"].is_null()
        || basis["schema"] != "ql.native-procedural-no-change/v1"
        || basis["expression_ref"] != captured.before.expression_ref
        || basis["document_revision"].as_u64() != Some(captured.before.revision)
        || basis["operation_ref"] != captured.intent.operation_ref
        || basis["original_procedure"] != *procedure
        || basis["required_consumers"] != captured.required_consumers
        || !basis["current_inputs_fingerprint"]
            .as_str()
            .is_some_and(|value| {
                value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
            })
        || original["expression_ref"] != captured.before.expression_ref
        || original["document_revision"].as_u64() != Some(captured.before.revision)
        || original["operation_ref"] != captured.intent.operation_ref
        || original["native_context"] != captured.context
        || original["required_consumers"] != captured.required_consumers
        || qualification["schema"] != "ql.procedural-cprime-preparation/v1"
        || qualification["procedure_ref"] != procedure["procedure_ref"]
        || qualification["procedure_revision"] != procedure["revision"]
        || qualification["definition"] != procedure["composition"]
        || qualification["thread_plan"] != captured.context["thread_plan"]
        || currentness["contract"] != "ql.operative-scope-currentness/v1"
        || currentness["currentWholeRef"] != captured.context["currentness"]["currentWholeRef"]
        || currentness["observation"]["state"] != "current"
        || currentness["observation"]["binding"] != captured.context["currentness"]["expected"]
        || result["membership"]["containing_expression_ref"] != captured.before.expression_ref
    {
        return Err("Native no-change lacks the original complete Procedure/CAS/roles and actual current Source qualification".into());
    }
    let addresses = result["membership"]["addresses"]
        .as_object()
        .ok_or("Native no-change membership absent")?;
    let inputs = captured.operands["current_readings"]
        .as_array()
        .ok_or("Native no-change current operands absent")?;
    if addresses
        .values()
        .any(|address| !inputs.iter().any(|input| input["address"] == *address))
    {
        return Err(
            "Native no-change membership differs from original selected current inputs".into(),
        );
    }
    crate::expression::procedural::bootstrap::preflight_source_message(&(
        response,
        &captured.intent,
    ))
}
fn no_change_reply(memo: &Memo, repeated: bool) -> Result<Value, String> {
    let response = memo
        .no_change
        .as_ref()
        .ok_or("Original readonly native outcome absent")?;
    crate::expression::procedural::bootstrap::preflight_source_message(&(
        &memo.intent,
        &memo.preview,
        &response["native_result"]["result"],
    ))?;
    Ok(
        json!({"schema":SCHEMA,"original_intent":memo.intent,"state":"no_change","outcome":"no_change",
        "envelope":null,"prepared":null,"preview":memo.preview,"outcome_basis":response["native_result"]["result"],
        "source_current":!repeated,"found":true,"repeated":repeated,
        "qualification":if repeated {"original_native_no_change_retry"} else {"live_native_source_unchanged"},
        "native_procedural_receipts":[]}),
    )
}
fn context_fingerprint(
    source: &Value,
    provenance: &Value,
    reply: &Value,
    contract: &Value,
) -> Result<String, String> {
    crate::expression::procedural::bootstrap::preflight_source_message(&(
        source, provenance, reply, contract,
    ))?;
    super::bootstrap::fingerprint(&(source, provenance, reply, contract))
}
impl Prepared {
    pub fn execute(self) -> Result<Completed, String> {
        let library = super::execute_stateless(
            "library",
            "library",
            json!({"schema":"ql.procedural-library/v1",
            "source":self.operands["scene_source"],"authored":self.intent.authored,"choice":self.intent.choice}),
            COMPILER_BYTES,
        )?;
        let result = &library["native_result"]["result"];
        let mut request = json!({"schema":"ql.scene-procedural-request/v1","procedure":result["procedure"],
            "expression_ref":self.before.expression_ref,"document_revision":self.before.revision,
            "operation_ref":self.intent.operation_ref,"current_readings":self.operands["current_readings"],
            "previous_membership":self.previous_membership,"contributions":[],"scene_outputs":[],
            "program":result["program"],"materialization":self.operands["materialization"],
            "native_context":self.context,"required_consumers":self.required_consumers});
        crate::expression::procedural::validate_source_payload(&self.before, &request)?;
        let response = if self.intent.action == Action::Regenerate {
            // SAME native typed-output owner generates next material and
            // projects the actual retained human interventions exactly once.
            request
                .as_object_mut()
                .ok_or("Native preparation missing")?
                .remove("scene_outputs");
            request
                .as_object_mut()
                .ok_or("Native preparation missing")?
                .remove("contributions");
            request["previous"] = self.previous.clone();
            request["current"] = self.operands["current"].clone();
            request["next"] = json!([]);
            request["intervention_contexts"] = self.operands["intervention_contexts"].clone();
            request["output_readings"] = self.operands["output_readings"].clone();
            super::execute_stateless("regenerate", "regenerate", request, COMPILER_BYTES)?
        } else {
            super::execute_stateless("prepare", "prepare", request, COMPILER_BYTES)?
        };
        let prepared = if self.intent.action == Action::Regenerate {
            response["native_result"]["result"]["prepared"].clone()
        } else {
            response["native_result"]["result"].clone()
        };
        if self.intent.action == Action::Regenerate
            && response["native_result"]["result"]["outcome"] == "no_change"
        {
            validate_no_change(&self, &response)?;
        } else if !prepared.is_object() {
            return Err("Native regeneration produced no material revision".into());
        }
        Ok(Completed {
            captured: self,
            response,
            prepared,
        })
    }
}

pub(crate) fn known_refusal(intent: &Intent, reason: String) -> Result<Value, String> {
    crate::expression::procedural::bootstrap::preflight_source_message(&(intent, &reason))?;
    Ok(
        json!({"schema":SCHEMA,"original_intent":intent,"state":"known_refusal", "reason":reason,
        "envelope":null,"source_current":false,"native_procedural_receipts":[]}),
    )
}

impl crate::Kernel {
    /// Pure Library failures consume no FIELD ordinal and edit no Document.
    /// Transport loss remains unknown in the original frontend Session.
    pub fn native_stage_library_refusal(
        op: &crate::KernelOp,
        reason: String,
    ) -> Result<crate::KernelOpOutcome, String> {
        let crate::KernelOp::NativeExpression {
            request: super::super::Request::ProceduralStageLibrary { request: intent },
        } = op
        else {
            return Err(reason);
        };
        Ok(crate::KernelOpOutcome {
            receipts: vec![],
            result: crate::KernelOpResult::NativeExpression {
                data: known_refusal(intent, reason)?,
            },
        })
    }
    pub fn prepare_native_stage_library(
        &mut self,
        op: &crate::KernelOp,
    ) -> Result<Option<Prepared>, String> {
        let crate::KernelOp::NativeExpression {
            request: super::super::Request::ProceduralStageLibrary { request: intent },
        } = op
        else {
            return Ok(None);
        };
        let before = self.expressions.procedural_source_snapshot(
            &intent.basis.expression_ref,
            intent.basis.document_revision,
        )?;
        let operands = self.expressions.stage_library_intake(&before, intent)?;
        let (context,context_fingerprint,required_consumers)=self.native_expression.with_registered_source_context(
            &self.expressions,&before,&intent.basis.scene_ref,|source,provenance,reply,contract| {
                if source["source_material_fingerprint"]!=operands["scene_source"]["material_fingerprint"]
                    || source["timing"]!=intent.authored["timing"] {
                    return Err("Authored Library timing/source differs from the exact completed native Source".into());
                }
                let mut budget = crate::expression::procedural::budget::Budget::new();
                budget.value(&(&before, intent, &operands))?;
                budget.value(&(&source["source_composition"], &source["currentness"],
                    &source["thread_plan"], &contract["required_consumers"]))?;
                budget.reserve(4096)?;
                let context=json!({"source_composition":source["source_composition"],"currentness":source["currentness"],"thread_plan":source["thread_plan"]});
                if context.as_object().is_none_or(|fields|fields.values().any(Value::is_null)) {
                    return Err("Actual native graph/currentness/ThreadPlan is unavailable".into());
                }
                Ok((context,context_fingerprint(source,provenance,reply,contract)?,contract["required_consumers"].clone()))
            })?;
        let applied = if intent.action == Action::Regenerate {
            self.expressions.stage_library_applied_preparations(
                &before,
                intent.authored["procedure_ref"]
                    .as_str()
                    .ok_or("Actual native procedure identity absent")?,
            )?
        } else {
            json!([])
        };
        let owner = self
            .native_expression
            .active
            .as_ref()
            .ok_or("Actual native Library owner closed")?;
        owner.stage_library_replays.require_new(intent)?;
        let (previous, previous_membership) = if intent.action == Action::Regenerate {
            owner.stage_library_replays.previous(
                &operands["output_readings"],
                &intent.authored,
                &applied,
                &(&before, intent, &operands, &context, &required_consumers),
            )?
        } else {
            (json!([]), Value::Null)
        };
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            &operands, &context, &previous,
        ))?;
        Ok(Some(Prepared {
            before,
            intent: intent.clone(),
            operands,
            context,
            context_fingerprint,
            required_consumers,
            previous,
            previous_membership,
        }))
    }
    pub fn finish_native_stage_library(
        &mut self,
        completed: Completed,
    ) -> Result<crate::KernelOpOutcome, String> {
        let Completed {
            captured,
            response,
            prepared,
        } = completed;
        let current = self.expressions.procedural_source_snapshot(
            &captured.before.expression_ref,
            captured.before.revision,
        )?;
        if current != captured.before {
            return Err("The complete native Document changed during Library compilation; original intent remains retained".into());
        }
        self.native_expression.with_registered_source_context(
            &self.expressions,
            &current,
            &captured.intent.basis.scene_ref,
            |source, provenance, reply, contract| {
                if context_fingerprint(source, provenance, reply, contract)?
                    != captured.context_fingerprint
                {
                    return Err(
                        "Actual completed native Source changed during Library compilation".into(),
                    );
                }
                Ok(())
            },
        )?;
        self.native_expression
            .active
            .as_ref()
            .ok_or("Actual native Library owner closed")?
            .stage_library_replays
            .require_new(&captured.intent)?;
        if prepared.is_null() {
            validate_no_change(&captured, &response)?;
            let original = &response["source"]["original_request"]["procedure"];
            let preview = json!({"procedure_ref":original["procedure_ref"],"recipe_revision":original["recipe"]["revision"],"changes":[]});
            let memo = Memo {
                intent: captured.intent,
                envelope: None,
                preview,
                admission: Value::Null,
                no_change: Some(response),
                document_fingerprint: super::bootstrap::fingerprint(&current)?,
                context_fingerprint: captured.context_fingerprint,
            };
            let owner = self
                .native_expression
                .active
                .as_mut()
                .ok_or("Actual native Library owner closed")?;
            owner.stage_library_replays.reserve(&memo)?;
            let data = no_change_reply(&memo, false)?;
            owner
                .stage_library_replays
                .rows
                .insert(memo.intent.operation_ref.clone(), memo);
            return Ok(crate::KernelOpOutcome {
                receipts: vec![],
                result: crate::KernelOpResult::NativeExpression { data },
            });
        }
        // Build the exact private admission without mutating the runtime.
        // Both native retention horizons must accept it before either owner writes.
        let admitted = self.expressions.prepare_procedural_source_admission(
            &current,
            prepared,
            response["source"].clone(),
        )?;
        crate::expression::procedural::bootstrap::preflight_source_message(&admitted)?;
        let admission = serde_json::to_value(&admitted).map_err(|e| e.to_string())?;
        let prepared = &admitted.prepared;
        admission["producer_ref"]
            .as_str()
            .ok_or("Actual native compiler issued no producer admission")?;
        let preview = json!({"procedure_ref":prepared["procedure_ref"],"recipe_revision":prepared["recipe_revision"],
            "changes":prepared["native_edit"]["changes"].as_array().ok_or("Native prepared changes absent")?.iter()
                .map(|wire|json!({"kind":wire["change"],"label":wire["change"]})).collect::<Vec<_>>()});
        let memo = Memo {
            intent: captured.intent.clone(),
            envelope: None,
            preview,
            admission,
            no_change: None,
            document_fingerprint: super::bootstrap::fingerprint(&current)?,
            context_fingerprint: captured.context_fingerprint,
        };
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Actual native Library owner closed")?;
        owner.stage_library_replays.reserve(&memo)?;
        self.expressions
            .commit_procedural_source_admission(&current, admitted)?;
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Actual native Library owner closed")?;
        owner
            .stage_library_replays
            .rows
            .insert(captured.intent.operation_ref.clone(), memo);
        // Original compiled producer is retained before a receiving refusal.
        // Recovery completes this same admission; it does not invoke QL again.
        let data = self.complete_native_stage_library(&captured.intent.operation_ref)?;
        Ok(crate::KernelOpOutcome {
            receipts: vec![],
            result: crate::KernelOpResult::NativeExpression { data },
        })
    }
    fn complete_native_stage_library(&mut self, operation_ref: &str) -> Result<Value, String> {
        let mut memo = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Original native Library owner absent")?
            .stage_library_replays
            .rows
            .remove(operation_ref)
            .ok_or("Original native Library preparation absent")?;
        let result: Result<Value, String> = (|| {
            let before = self.expressions.procedural_source_snapshot(
                &memo.intent.basis.expression_ref,
                memo.intent.basis.document_revision,
            )?;
            if super::bootstrap::fingerprint(&before)? != memo.document_fingerprint {
                return Err(
                    "The actual full Document differs from the original compiled Library input"
                        .into(),
                );
            }
            self.native_expression.with_registered_source_context(
                &self.expressions,
                &before,
                &memo.intent.basis.scene_ref,
                |source, provenance, reply, contract| {
                    if context_fingerprint(source, provenance, reply, contract)?
                        != memo.context_fingerprint
                    {
                        return Err(
                            "Original compiled Library Source context is no longer current".into(),
                        );
                    }
                    Ok(())
                },
            )?;
            let producer = memo.admission["producer_ref"]
                .as_str()
                .ok_or("Actual native compiler issued no producer admission")?;
            let receiving = self.native_registered_receiving_prepare(
                &before.expression_ref,
                before.revision,
                &memo.intent.basis.scene_ref,
                producer,
            )?;
            let mut envelope: Envelope = serde_json::from_value(receiving["envelope"].clone())
                .map_err(|error| error.to_string())?;
            envelope.scope = memo.intent.scope.clone();
            self.native_expression
                .active
                .as_ref()
                .ok_or("Original native Library owner absent")?
                .stage_library_replays
                .reserve_completion(&memo, &envelope)?;
            crate::expression::procedural::bootstrap::preflight_source_message(&(
                &memo.intent,
                &envelope,
                &memo.preview,
            ))?;
            self.expressions
                .stage_library_check_envelope(&before, envelope.clone())?;
            memo.envelope = Some(envelope);
            Ok(
                json!({"schema":SCHEMA,"original_intent":memo.intent,"envelope":memo.envelope,
                "preview":memo.preview,"state":"issued","source_current":true,
                "qualification":"live_native_owner","native_procedural_receipts":[]}),
            )
        })();
        let data = match result {
            Ok(data) => data,
            Err(reason) => json!({"schema":SCHEMA,"original_intent":memo.intent,
            "state":"pending_reception","reason":reason,"admission":memo.admission,"preview":memo.preview,
            "envelope":null,"source_current":false,"qualification":"original_native_compilation_retained",
            "native_procedural_receipts":[]}),
        };
        self.native_expression
            .active
            .as_mut()
            .ok_or("Original native Library owner ended during recovery")?
            .stage_library_replays
            .rows
            .insert(operation_ref.into(), memo);
        Ok(data)
    }
    pub(crate) fn native_stage_capability(
        &mut self,
        request: CapabilityRequest,
    ) -> Result<Value, String> {
        let result = (|| {
            let before = self.expressions.procedural_source_snapshot(
                &request.basis.expression_ref,
                request.basis.document_revision,
            )?;
            self.native_expression.with_registered_source_context(&self.expressions,&before,&request.basis.scene_ref,
                |source,_,_,_|Ok(json!({"state":"available","owner":"oi.native-expression",
                    "expression_ref":before.expression_ref,"document_revision":before.revision,
                    "source_ref":source["binding"]["locus"]["ref"],"source_revision":source["binding"]["locus"]["revision"]})))
        })();
        let capability = match result {
            Ok(value) => value,
            Err(reason) => json!({"state":"unavailable","reason":reason}),
        };
        Ok(
            json!({"schema":CAPABILITY_SCHEMA,"basis":request.basis,"capability":capability,"native_procedural_receipts":[]}),
        )
    }
    pub(crate) fn native_stage_library_retry(&mut self, intent: Intent) -> Result<Value, String> {
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Original native Library owner closed")?;
        if owner.stopped || owner.process_exited()? {
            return Err(
                "Original native Library owner ended; no original reply can be reissued".into(),
            );
        }
        let Some(memo) = owner.stage_library_replays.rows.get(&intent.operation_ref) else {
            return Ok(
                json!({"schema":SCHEMA,"original_intent":intent,"found":false,"native_procedural_receipts":[]}),
            );
        };
        if memo.intent != intent {
            return Err("Library retry changed its complete original accepted intent".into());
        }
        if memo.no_change.is_some() {
            return no_change_reply(memo, true);
        }
        if memo.envelope.is_none() {
            return self.complete_native_stage_library(&intent.operation_ref);
        }
        let operation = self
            .expressions
            .stage_library_operation(&intent.operation_ref)?;
        if operation
            .as_ref()
            .is_some_and(|operation| Some(&operation.envelope) != memo.envelope.as_ref())
        {
            return Err(
                "Original Library journal differs from its exact native issued preparation".into(),
            );
        }
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            &memo.intent,
            &memo.envelope,
            &memo.preview,
            &operation,
        ))?;
        Ok(
            json!({"schema":SCHEMA,"original_intent":memo.intent,"found":true,"envelope":memo.envelope,
            "preview":memo.preview,"operation":operation,"repeated":true,"source_current":false,
            "qualification":"original_native_preparation_retry","native_procedural_receipts":[]}),
        )
    }
}
