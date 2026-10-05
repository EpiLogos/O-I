//! The normal Stage submits authored choices. This factory reads the actual
//! Document and borrows the SAME completed Source context before the existing
//! QL library/compiler executes outside the mutation lock. No wire issues a grant.
use crate::expression::procedural::{Envelope, Scope};
use crate::expression::{Document, ReadingRef};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::atomic::{AtomicU64, Ordering};
static COMPILATION_SEQUENCE: AtomicU64 = AtomicU64::new(0);
#[path = "native_expression_procedural_stage_capture.rs"]
mod capture;

pub const SCHEMA: &str = "oi.native-procedural-stage-library/v1";
pub const CAPABILITY_SCHEMA: &str = "oi.native-procedural-stage-capability/v1";
const COMPILER_BYTES: usize = crate::expression::procedural::budget::SOURCE_BYTES;
const MAX_MEMOS: usize = 64;
// Native worker diagnostic_text is bounded to 2048 characters. Retain room
// for its complete original error and the stateless wrapper before execution.
const FAILURE_ROOM: usize = 32 * 1024;
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
#[derive(Debug, Serialize)]
struct Compilation {
    intent: Intent,
    serial: u64,
    document_fingerprint: String,
    context_fingerprint: String,
    // The actual full off-lock Prepared remains live until opaque completion.
    captured_bytes: usize,
    #[serde(skip)]
    capture_id: Option<u64>,
    // Only the actual opaque worker completion can settle this reservation.
    refusal: Option<String>,
}
#[derive(Debug)]
pub(crate) struct Memos {
    rows: BTreeMap<String, Memo>,
    compiling: BTreeMap<String, Compilation>,
    #[cfg(test)]
    next_serial: u64,
    captures: std::sync::Arc<capture::Registry>,
}
impl Default for Memos {
    fn default() -> Self {
        Self {
            rows: BTreeMap::new(),
            compiling: BTreeMap::new(),
            #[cfg(test)]
            next_serial: 0,
            captures: capture::Registry::shared(),
        }
    }
}
impl Memos {
    fn require_new(&self, intent: &Intent) -> Result<(), String> {
        if self.rows.contains_key(&intent.operation_ref)
            || self.compiling.contains_key(&intent.operation_ref)
        {
            return Err(
                "Original Library operation already issued; use its exact native retry".into(),
            );
        }
        if self.rows.len() + self.compiling.len() >= MAX_MEMOS {
            return Err("Native Library original-operation retention is full; settle its owner before further production".into());
        }
        Ok(())
    }
    #[cfg(test)]
    fn begin(
        &mut self,
        intent: &Intent,
        document_fingerprint: String,
        context_fingerprint: &str,
        captured: &impl Serialize,
    ) -> Result<u64, String> {
        self.begin_reserved(
            intent,
            document_fingerprint,
            context_fingerprint,
            captured,
            None,
        )
    }
    fn begin_reserved(
        &mut self,
        intent: &Intent,
        document_fingerprint: String,
        context_fingerprint: &str,
        captured: &impl Serialize,
        resource: Option<&capture::Reservation>,
    ) -> Result<u64, String> {
        self.require_new(intent)?;
        let mut measure = crate::expression::procedural::budget::Budget::new();
        measure.value(captured)?;
        let captured_bytes = measure.charged_bytes();
        let mut budget = crate::expression::procedural::budget::Budget::new();
        if let Some(resource) = resource {
            resource.require(&self.captures, captured_bytes)?;
        }
        self.charge_excluding(&mut budget, None, resource)?;
        // Account the complete borrowed future Prepared owner and reservation
        // together before either copies the original accepted intent.
        budget.reserve(captured_bytes)?;
        budget.value(&(
            intent,
            u64::MAX,
            &document_fingerprint,
            context_fingerprint,
            captured_bytes,
        ))?;
        budget.reserve(FAILURE_ROOM + 4096)?;
        // Process-wide non-reuse also fences an old off-lock completion from
        // a subsequently opened owner whose local counter would restart.
        let mut observed = COMPILATION_SEQUENCE.load(Ordering::Relaxed);
        let serial = loop {
            let next = observed
                .checked_add(1)
                .ok_or("Original native compilation sequence exhausted")?;
            match COMPILATION_SEQUENCE.compare_exchange_weak(
                observed,
                next,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ) {
                Ok(_) => break next,
                Err(current) => observed = current,
            }
        };
        self.compiling.insert(
            intent.operation_ref.clone(),
            Compilation {
                intent: intent.clone(),
                serial,
                document_fingerprint,
                context_fingerprint: context_fingerprint.into(),
                captured_bytes,
                capture_id: resource.map(capture::Reservation::id),
                refusal: None,
            },
        );
        #[cfg(test)]
        {
            self.next_serial = serial;
        }
        Ok(serial)
    }
    fn require_compiling(&self, captured: &Prepared) -> Result<(), String> {
        let row = self
            .compiling
            .get(&captured.intent.operation_ref)
            .ok_or("Original native compilation reservation is unavailable")?;
        captured
            .resource
            .require(&self.captures, row.captured_bytes)?;
        if row.capture_id != Some(captured.resource.id())
            || row.serial != captured.reservation
            || row.intent != captured.intent
            || row.refusal.is_some()
            || row.document_fingerprint != super::bootstrap::fingerprint(&captured.before)?
            || row.context_fingerprint != captured.context_fingerprint
        {
            return Err(
                "Original native compilation reservation differs from its opaque completion".into(),
            );
        }
        Ok(())
    }
    fn charge(
        &self,
        budget: &mut crate::expression::procedural::budget::Budget,
        replacing: Option<&str>,
    ) -> Result<(), String> {
        self.charge_excluding(budget, replacing, None)
    }
    fn charge_excluding(
        &self,
        budget: &mut crate::expression::procedural::budget::Budget,
        replacing: Option<&str>,
        new_capture: Option<&capture::Reservation>,
    ) -> Result<(), String> {
        self.captures.charge(budget, new_capture)?;
        self.charge_retained(budget, replacing)
    }
    fn charge_retained(
        &self,
        budget: &mut crate::expression::procedural::budget::Budget,
        replacing: Option<&str>,
    ) -> Result<(), String> {
        for row in self.rows.values() {
            budget.value(row)?;
        }
        for (reference, row) in &self.compiling {
            if Some(reference.as_str()) == replacing {
                continue;
            }
            budget.value(row)?;
            if row.refusal.is_none() {
                // Current/global captures are already charged once. Tests and
                // a terminal settlement whose capture has just retired retain
                // conservative local accounting until the row settles.
                if !self.captures.live(row.capture_id)? {
                    budget.reserve(row.captured_bytes)?;
                }
                budget.reserve(FAILURE_ROOM)?;
            }
        }
        Ok(())
    }
    fn refuse(&mut self, reference: &str, serial: u64, reason: String) -> Result<Value, String> {
        let row = self
            .compiling
            .get(reference)
            .ok_or("Original native compilation reservation is unavailable")?;
        if row.serial != serial || row.refusal.is_some() {
            return Err("Only the actual original worker completion can settle compilation".into());
        }
        let mut budget = crate::expression::procedural::budget::Budget::new();
        self.charge(&mut budget, Some(reference))?;
        budget.value(&(row, &reason))?;
        budget.value(&(&row.intent, &reason))?;
        budget.reserve(4096)?;
        let reply = known_refusal(&row.intent, reason.clone())?;
        self.compiling
            .get_mut(reference)
            .ok_or("Original native compilation reservation disappeared")?
            .refusal = Some(reason);
        Ok(reply)
    }
    fn compilation_retry(&self, intent: &Intent) -> Result<Option<Value>, String> {
        let Some(row) = self.compiling.get(&intent.operation_ref) else {
            return Ok(None);
        };
        if row.intent != *intent {
            return Err("Compilation retry changed its complete original accepted intent".into());
        }
        if let Some(reason) = &row.refusal {
            let mut reply = known_refusal(&row.intent, reason.clone())?;
            reply["found"] = json!(true);
            reply["repeated"] = json!(true);
            reply["qualification"] = json!("original_native_compilation_refusal");
            return Ok(Some(reply));
        }
        crate::expression::procedural::bootstrap::preflight_source_message(&row.intent)?;
        Ok(Some(json!({"schema":SCHEMA,"original_intent":row.intent,
            "state":"pending_compilation","found":true,"repeated":true,
            "envelope":null,"source_current":false,
            "qualification":"original_native_compilation_in_flight",
            "native_procedural_receipts":[]})))
    }
    fn previous(
        &self,
        outputs: &Value,
        procedure: &Value,
        applied: &Value,
        prefix: &impl Serialize,
        horizon: &mut crate::expression::procedural::budget::Budget,
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
        horizon.value(&previous)?;
        horizon.value(&membership)?;
        horizon.reserve(4096)?;
        Ok((
            serde_json::to_value(previous).map_err(|e| e.to_string())?,
            membership.cloned().unwrap_or(Value::Null),
        ))
    }
    fn preflight_previous_capture(
        &self,
        procedure: &Value,
        budget: &mut crate::expression::procedural::budget::Budget,
    ) -> Result<(), String> {
        for memo in self.rows.values().filter(|memo| {
            memo.admission["prepared"]["procedure_ref"] == procedure["procedure_ref"]
        }) {
            budget.value(&memo.admission["prepared"]["contributions"])?;
            budget.value(&memo.admission["prepared"]["membership"])?;
        }
        budget.reserve(4096)
    }
    fn reserve(&self, memo: &Memo) -> Result<(), String> {
        let mut budget = crate::expression::procedural::budget::Budget::new();
        // The real captured input remains live until completion retires it.
        self.charge(&mut budget, None)?;
        budget.value(memo)?;
        budget.reserve(4096)
    }
    fn reserve_reception(
        &self,
        operation_ref: &str,
        document: Option<&Document>,
    ) -> Result<capture::Reservation, String> {
        let original = self
            .rows
            .get(operation_ref)
            .ok_or("Original native Library preparation absent")?;
        let mut retained = crate::expression::procedural::budget::Budget::new();
        self.charge_retained(&mut retained, None)?;
        let mut original_size = crate::expression::procedural::budget::Budget::new();
        original_size.value(original)?;
        let retained_without_original = retained
            .charged_bytes()
            .checked_sub(original_size.charged_bytes())
            .ok_or("Original native Library retained row accounting differs")?;
        let mut copies = crate::expression::procedural::budget::Budget::new();
        copies.value(original)?;
        copies.value(&original.intent)?;
        copies.value(&original.preview)?;
        for _ in 0..4 {
            copies.value(&original.admission)?;
        }
        copies.value(&original.intent.scope)?;
        // Accounting reads actual resident material without granting current
        // CAS. Missing/stale actual material is still refused normally below.
        if let Some(document) = document {
            copies.value(document)?;
            copies.value(document)?;
        }
        copies.reserve(FAILURE_ROOM + 4096)?;
        self.captures
            .reserve(copies.charged_bytes(), retained_without_original)
    }
    fn reserve_completion(&self, memo: &Memo, envelope: &Envelope) -> Result<(), String> {
        let mut budget = crate::expression::procedural::budget::Budget::new();
        self.charge(&mut budget, None)?;
        budget.value(memo)?;
        budget.value(envelope)?;
        budget.reserve(4096)
    }
}

#[derive(Debug)]
pub struct Prepared {
    reservation: u64,
    before: Document,
    intent: Intent,
    operands: Value,
    context: Value,
    context_fingerprint: String,
    required_consumers: Value,
    previous: Value,
    previous_membership: Value,
    // Rust retires fields in declaration order. This last private guard stays
    // live until all original captured material has actually been dropped.
    resource: capture::Reservation,
}
pub struct Completed {
    response: Value,
    prepared: Value,
    // Compiled result material retires before its original captured guard.
    captured: Prepared,
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
/// Private actual stateless worker failure. Public JSON cannot construct or
/// replay this custody, and a duplicate incoming request cannot settle it.
#[derive(Debug)]
pub struct FailedCompilation {
    reason: String,
    captured: Box<Prepared>,
}
impl Prepared {
    pub fn execute(self) -> Result<Completed, FailedCompilation> {
        match self.compile() {
            Ok((response, prepared)) => Ok(Completed {
                captured: self,
                response,
                prepared,
            }),
            Err(reason) => Err(FailedCompilation {
                captured: Box::new(self),
                reason,
            }),
        }
    }
    fn compile(&self) -> Result<(Value, Value), String> {
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
            validate_no_change(self, &response)?;
        } else if !prepared.is_object() {
            return Err("Native regeneration produced no material revision".into());
        }
        Ok((response, prepared))
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
        let borrowed = self.expressions.procedural_source_borrow(
            &intent.basis.expression_ref,
            intent.basis.document_revision,
        )?;
        let owner = self
            .native_expression
            .active
            .as_ref()
            .ok_or("Actual native Library owner closed")?;
        owner.stage_library_replays.require_new(intent)?;
        let mut horizon = crate::expression::procedural::budget::Budget::new();
        owner.stage_library_replays.charge(&mut horizon, None)?;
        let retained_and_live = horizon.charged_bytes();
        horizon.value(intent)?;
        horizon.reserve(FAILURE_ROOM + 4096)?;
        self.expressions
            .preflight_stage_library_intake_into(borrowed, intent, &mut horizon)?;
        // Qualify and charge the exact borrowed native Source tuple before any
        // corresponding context copy or full current Document snapshot.
        self.native_expression.with_registered_source_context(
            &self.expressions,
            borrowed,
            &intent.basis.scene_ref,
            |source, _, _, contract| {
                horizon.value(&(
                    &source["source_composition"],
                    &source["currentness"],
                    &source["thread_plan"],
                    &contract["required_consumers"],
                ))?;
                horizon.reserve(4096)
            },
        )?;
        let owner = self
            .native_expression
            .active
            .as_ref()
            .ok_or("Original native Library owner closed before resource reservation")?;
        owner.stage_library_replays.require_new(intent)?;
        if intent.action == Action::Regenerate {
            owner
                .stage_library_replays
                .preflight_previous_capture(&intent.authored, &mut horizon)?;
        }
        let captured_capacity = horizon
            .charged_bytes()
            .checked_sub(retained_and_live)
            .ok_or("Native capture precharge accounting inconsistent")?;
        let mut retained = crate::expression::procedural::budget::Budget::new();
        owner
            .stage_library_replays
            .charge_retained(&mut retained, None)?;
        // Private process reservation is acquired BEFORE every full capture
        // copy. It survives retirement of this owner through the actual
        // off-lock Prepared/Completed/Failed lifetime, without old authority.
        let resource = owner
            .stage_library_replays
            .captures
            .reserve(captured_capacity, retained.charged_bytes())?;
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
                &mut horizon,
            )?
        } else {
            (json!([]), Value::Null)
        };
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            &operands, &context, &previous,
        ))?;
        let reservation = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Original native Library owner ended before compilation")?
            .stage_library_replays
            .begin_reserved(
                intent,
                super::bootstrap::fingerprint(&before)?,
                &context_fingerprint,
                &(
                    &before,
                    intent,
                    &operands,
                    &context,
                    &context_fingerprint,
                    &required_consumers,
                    &previous,
                    &previous_membership,
                ),
                Some(&resource),
            )?;
        Ok(Some(Prepared {
            reservation,
            before,
            intent: intent.clone(),
            operands,
            context,
            context_fingerprint,
            required_consumers,
            previous,
            previous_membership,
            resource,
        }))
    }
    pub fn fail_native_stage_library(
        &mut self,
        failed: FailedCompilation,
    ) -> Result<crate::KernelOpOutcome, String> {
        self.native_expression
            .active
            .as_ref()
            .ok_or("Original native Library owner closed during compilation")?
            .stage_library_replays
            .require_compiling(&failed.captured)?;
        let FailedCompilation { captured, reason } = failed;
        let reference = captured.intent.operation_ref.clone();
        let serial = captured.reservation;
        // The worker has actually completed: retire its owned capture before
        // charging the retained terminal reason and outward original reply.
        drop(captured);
        self.settle_native_stage_compilation(&reference, serial, reason)
    }
    fn settle_native_stage_compilation(
        &mut self,
        reference: &str,
        serial: u64,
        reason: String,
    ) -> Result<crate::KernelOpOutcome, String> {
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Original native Library owner closed during compilation")?;
        if owner.stopped || owner.process_exited()? {
            return Err(
                "Original native Library owner ended; no completion can be reissued".into(),
            );
        }
        let data = owner
            .stage_library_replays
            .refuse(reference, serial, reason)?;
        Ok(crate::KernelOpOutcome {
            receipts: vec![],
            result: crate::KernelOpResult::NativeExpression { data },
        })
    }
    pub fn finish_native_stage_library(
        &mut self,
        completed: Completed,
    ) -> Result<crate::KernelOpOutcome, String> {
        self.native_expression
            .active
            .as_ref()
            .ok_or("Original native Library owner closed during compilation")?
            .stage_library_replays
            .require_compiling(&completed.captured)?;
        let reference = completed.captured.intent.operation_ref.clone();
        let serial = completed.captured.reservation;
        match self.finish_native_stage_library_admitted(completed) {
            Ok(outcome) => Ok(outcome),
            Err(reason) => self.settle_native_stage_compilation(&reference, serial, reason),
        }
    }
    fn finish_native_stage_library_admitted(
        &mut self,
        completed: Completed,
    ) -> Result<crate::KernelOpOutcome, String> {
        let Completed {
            mut captured,
            response,
            prepared,
        } = completed;
        // Check the actual current Document by reference. The captured full
        // snapshot already owns these bytes; completion must not copy it again.
        let current = self
            .expressions
            .procedural_source_borrow(&captured.before.expression_ref, captured.before.revision)?;
        if current != &captured.before {
            return Err("The complete native Document changed during Library compilation; original intent remains retained".into());
        }
        let current = &captured.before;
        self.native_expression.with_registered_source_context(
            &self.expressions,
            current,
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
            .require_compiling(&captured)?;
        // Precharge completion's actual copies against the same private
        // process lease. This adds no second job slot or Source authority.
        let owner = self
            .native_expression
            .active
            .as_ref()
            .ok_or("Actual native Library owner closed before admission precharge")?;
        let mut retained = crate::expression::procedural::budget::Budget::new();
        owner
            .stage_library_replays
            .charge_retained(&mut retained, None)?;
        let mut copies = crate::expression::procedural::budget::Budget::new();
        if prepared.is_null() {
            copies.value(&response)?;
            copies.value(&captured.intent)?;
        } else {
            copies.value(current)?; // Document.edited's genuine candidate.
                                    // Receipt inheritance copies matching protected Scene journals,
                                    // clipped from Source/prepared input. A second borrowed full-Doc
                                    // charge conservatively bounds those original journal copies.
            copies.value(current)?;
            for _ in 0..4 {
                copies.value(&prepared)?;
                copies.value(&response["source"])?;
            }
        }
        copies.value(&captured.intent)?;
        copies.reserve(4096)?;
        captured
            .resource
            .extend(copies.charged_bytes(), retained.charged_bytes())?;
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
                document_fingerprint: super::bootstrap::fingerprint(current)?,
                context_fingerprint: captured.context_fingerprint.clone(),
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
                .compiling
                .remove(&memo.intent.operation_ref);
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
            current,
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
            document_fingerprint: super::bootstrap::fingerprint(current)?,
            context_fingerprint: captured.context_fingerprint.clone(),
        };
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Actual native Library owner closed")?;
        owner.stage_library_replays.reserve(&memo)?;
        self.expressions
            .commit_procedural_source_admission(current, admitted)?;
        let owner = self
            .native_expression
            .active
            .as_mut()
            .ok_or("Actual native Library owner closed")?;
        owner
            .stage_library_replays
            .compiling
            .remove(&captured.intent.operation_ref);
        owner
            .stage_library_replays
            .rows
            .insert(captured.intent.operation_ref.clone(), memo);
        // Original compiled producer is retained before a receiving refusal.
        // Recovery completes this same admission; it does not invoke QL again.
        let reference = captured.intent.operation_ref.clone();
        drop(response);
        drop(captured);
        let data = self.complete_native_stage_library(&reference)?;
        Ok(crate::KernelOpOutcome {
            receipts: vec![],
            result: crate::KernelOpResult::NativeExpression { data },
        })
    }
    fn complete_native_stage_library(&mut self, operation_ref: &str) -> Result<Value, String> {
        // Charge the actual borrowed original row and either outward failure
        // or receiving copies BEFORE removal and every CAS/Source check. A
        // budget refusal leaves that original row intact; no full reply copies.
        let owner = self
            .native_expression
            .active
            .as_ref()
            .ok_or("Original native Library owner absent")?;
        let original = owner
            .stage_library_replays
            .rows
            .get(operation_ref)
            .ok_or("Original native Library preparation absent")?;
        let document = self
            .expressions
            .procedural_current_receiver_document(&original.intent.basis.expression_ref)
            .ok();
        let receiving_resource = owner
            .stage_library_replays
            .reserve_reception(operation_ref, document)?;
        // Declaring the removed material after its guard also guarantees its
        // destruction precedes resource retirement on an early error unwind.
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
            let before = self.expressions.procedural_source_borrow(
                &memo.intent.basis.expression_ref,
                memo.intent.basis.document_revision,
            )?;
            if super::bootstrap::fingerprint(before)? != memo.document_fingerprint {
                return Err(
                    "The actual full Document differs from the original compiled Library input"
                        .into(),
                );
            }
            self.native_expression.with_registered_source_context(
                &self.expressions,
                before,
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
            // End this immutable borrow before the original native receiver
            // updates its private registration. Re-borrow its same CAS below.
            let expression_ref = before.expression_ref.clone();
            let revision = before.revision;
            let receiving = self.native_registered_receiving_prepare(
                &expression_ref,
                revision,
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
            let before = self
                .expressions
                .procedural_source_borrow(&expression_ref, revision)?;
            self.expressions
                .stage_library_check_envelope(before, envelope.clone())?;
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
        // The original Memo is back under the owner's normal retention before
        // transient receiving copies release their resource guard.
        drop(receiving_resource);
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
        if let Some(reply) = owner.stage_library_replays.compilation_retry(&intent)? {
            return Ok(reply);
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

#[cfg(test)]
#[path = "native_expression_procedural_stage_compilation_tests.rs"]
mod compilation_tests;

/// A resource-only private work container. Rust drops data before resource,
/// including on early return/unwind. It carries no native constructor or grant.
pub(in crate::native_expression) struct SourceDeliveryContext<T,R> {
    pub(in crate::native_expression) data:T,
    pub(in crate::native_expression) resource:R,
}

/// Sibling definition delivery uses the same process count/byte registry. It is
/// resource custody only, never a native Source or receiver constructor.
#[derive(Debug)]
pub(in crate::native_expression) struct SourceDeliveryCapture {
    resource: capture::Reservation,
    reply_limit: usize,
    context_bytes: usize,
    capacity: usize,
}
impl SourceDeliveryCapture {
    pub(in crate::native_expression) fn reply_limit(&self) -> usize {
        self.reply_limit
    }
    /// Add a complete borrowed prospective copy cohort to this ORIGINAL
    /// reservation before allocating it. No second count slot or cap increase.
    /// Every byte is taken from the finite reply allowance prior to dispatch.
    pub(in crate::native_expression) fn preflight_copy_bytes(
        &mut self, bytes:usize,
    ) -> Result<(),String> {
        let context_bytes=self.context_bytes.checked_add(bytes)
            .ok_or("Native Source prospective copy budget overflow")?;
        let reply_limit=self.capacity.checked_sub(context_bytes)
            .ok_or("Native Source prospective copies exceed original shared custody")?/8;
        if reply_limit==0 {
            return Err("Native Source prospective copies leave no bounded reply capacity".into());
        }
        self.context_bytes=context_bytes;self.reply_limit=reply_limit;
        Ok(())
    }
    pub(in crate::native_expression) fn preflight_copies<T:Serialize+?Sized>(
        &mut self, copies:&T,
    ) -> Result<(),String> {
        let mut budget=crate::expression::procedural::budget::Budget::new();
        budget.value(copies)?;
        self.preflight_copy_bytes(budget.charged_bytes())
    }
    /// The complete response is already moved into original custody. Charge
    /// the full outward wrapper before allocating its copy, including the
    /// retained response/context which remain alive during delivery.
    pub(in crate::native_expression) fn preflight_outward<T: Serialize + ?Sized>(
        &self,
        outcome: &T,
        wrapper: &impl Serialize,
    ) -> Result<(), String> {
        let mut measured = crate::expression::procedural::budget::Budget::new();
        measured.reserve(self.context_bytes)?;
        measured.value(outcome)?;
        measured.value(wrapper)?;
        if measured.charged_bytes() > self.capacity {
            return Err("Native Source outward result exceeds original reserved custody; original outcome remains retained".into());
        }
        Ok(())
    }
    pub(in crate::native_expression) fn settle_outcome<T: Serialize + ?Sized>(
        &mut self,
        outcome: &T,
        original_intent: &impl Serialize,
    ) -> Result<(), String> {
        let mut measured = crate::expression::procedural::budget::Budget::new();
        measured.reserve(self.context_bytes)?;
        // The full original channel/receipt have already been MOVED into this
        // outcome. Only retained outcome and one outward outcome coexist; a
        // caller must retain any additional original locals before this call.
        measured.value(outcome)?;
        measured.value(outcome)?;
        measured.value(original_intent)?;
        // The readonly wrapper has its original intent plus fixed disclosure.
        // Original request copies and this overhead were reserved at dispatch.
        measured.reserve(1024)?;
        self.resource.settle_capacity(measured.charged_bytes())?;
        self.capacity = measured.charged_bytes();
        Ok(())
    }
}
impl Memos {
    pub(in crate::native_expression) fn reserve_source_delivery<T: Serialize + ?Sized>(
        &self,
        context: &T,
    ) -> Result<SourceDeliveryCapture, String> {
        let mut retained = crate::expression::procedural::budget::Budget::new();
        retained.value(&self.rows)?;
        retained.value(&self.compiling)?;
        let retained_bytes = retained.charged_bytes();
        self.captures.charge(&mut retained, None)?;
        let mut context_budget = crate::expression::procedural::budget::Budget::new();
        context_budget.value(context)?;
        context_budget.reserve(1024)?;
        let context_bytes = context_budget.charged_bytes();
        retained.reserve(context_bytes)?;
        // Raw line, parsed result, original outcome and outward result share
        // this finite allowance. A limit overflow has no imported receipt.
        let reply_limit = COMPILER_BYTES
            .checked_sub(retained.charged_bytes())
            .ok_or("Native definition capture budget exceeded before dispatch")?
            / 8;
        if reply_limit == 0 {
            return Err("Native definition capture has no reply capacity".into());
        }
        let capacity = context_bytes
            .checked_add(
                reply_limit
                    .checked_mul(8)
                    .ok_or("Native definition capture overflow")?,
            )
            .ok_or("Native definition capture overflow")?;
        let resource = self.captures.reserve(capacity, retained_bytes)?;
        Ok(SourceDeliveryCapture {
            resource,
            reply_limit,
            context_bytes,
            capacity,
        })
    }
}

#[cfg(test)]
#[path = "native_expression_source_capture_tests.rs"]
mod source_capture_tests;

#[cfg(test)]
impl SourceDeliveryCapture {
    pub(in crate::native_expression) fn isolated_resource_for_test(
        context:&impl Serialize,
    )->Result<Self,String> {
        Memos { captures: std::sync::Arc::new(capture::Registry::default()),
            ..Memos::default() }.reserve_source_delivery(context)
    }
}
