//! Retain a source-issued Scene binding through the original atomic Edit owner.
//! This private admission is never constructed by the public procedural API.
use super::*;
use crate::native_expression::procedural::bootstrap::{fingerprint, Intent, RESPONSE_SCHEMA};

pub(crate) fn preflight_native_intake(
    before: &Document,
    input: &impl Serialize,
) -> Result<(), String> {
    let mut intake = budget::Budget::new();
    intake.value(before)?;
    intake.value(input)
}

pub(crate) fn preflight_source_message(input: &impl Serialize) -> Result<(), String> {
    let mut intake = budget::Budget::new();
    intake.reserve(4096)?;
    intake.value(input)
}

pub(crate) fn preflight_scene_read(
    before: &Document,
    scene_ref: &str,
    source: &ReadingRef,
    locus: &ReadingRef,
    issuer_receipt: &Value,
) -> Result<(), String> {
    let scene = before
        .scenes
        .iter()
        .find(|scene| scene.scene_ref == scene_ref)
        .ok_or("The selected native source Scene is absent")?;
    let presentation = scene
        .presentation
        .as_ref()
        .ok_or("Source Scene material absent")?;
    let mut budget = budget::Budget::new();
    budget.material(presentation)?;
    budget.value(source)?;
    budget.value(locus)?;
    budget.value(issuer_receipt)?;
    budget.reserve(4096)
}

pub(crate) fn preflight_scene_request(reading: &Value, intent: &Intent) -> Result<(), String> {
    let mut budget = budget::Budget::new();
    budget.value(reading)?;
    budget.value(&intent.authorship)?;
    budget.reserve(1024)
}

pub(crate) struct Admission {
    before_fingerprint: String,
    intent: Intent,
    reading: Value,
    issuer_receipt: Value,
    native_receipt: Value,
}
impl Admission {
    pub(crate) fn from_native_owner(
        before: &Document,
        intent: Intent,
        reading: Value,
        issuer_receipt: Value,
        native_receipt: &Value,
    ) -> Result<Self, String> {
        let mut budget = budget::Budget::new();
        budget.value(&intent)?;
        budget.value(&reading)?;
        budget.value(&issuer_receipt)?;
        budget.value(&native_receipt)?;
        Ok(Self {
            before_fingerprint: fingerprint(before)?,
            intent,
            reading,
            issuer_receipt,
            native_receipt: native_receipt.clone(),
        })
    }
}

#[derive(Clone, Debug)]
pub(crate) struct Replay {
    pub(crate) expression_ref: String,
    intent: Intent,
    before_revision: u64,
    current_document_fingerprint: String,
    response: Value,
}
impl Application {
    /// Recover accepted source authorship, then reread its real owner. A
    /// retained face/locus is a selection basis, never a current Scene grant.
    pub(crate) fn lifecycle_source_intent(
        &self,
        before: &Document,
        scene_ref: &str,
    ) -> Result<Intent, String> {
        if self.document(&before.expression_ref)? != before {
            return Err("revision_conflict".into());
        }
        let target = address(before, Some(scene_ref), None, Component::Scene);
        let actual = source_exact_binding(before, &target)?
            .ok_or("Lifecycle selected Scene has no actual native source binding")?;
        let mut intent: Option<&Intent> = None;
        for previous in self
            .procedural_runtime
            .bootstrap_replays
            .values()
            .filter(|previous| {
                previous.expression_ref == before.expression_ref
                    && previous.intent.scene_ref == scene_ref
                    && previous.response["source"]["binding"] == actual
            })
        {
            if intent.is_some_and(|old| old.authorship != previous.intent.authorship) {
                return Err("Lifecycle retained source authorship is ambiguous; requalify its original source".into());
            }
            intent = Some(&previous.intent);
        }
        intent.cloned().ok_or_else(||
            "Lifecycle requires the actual live accepted source authorship; saved labels cannot recreate it".into())
    }

    /// The native owner checks SAME live lease/current selected source before
    /// calling this historical retry. A cache hit never emits a new native ACK
    /// or grants the historical source as current compiler input.
    pub(crate) fn replay_source_bootstrap(
        &self,
        expression_ref: &str,
        original_revision: u64,
        intent: &Intent,
    ) -> Result<Option<Value>, String> {
        let Some(previous) = self
            .procedural_runtime
            .bootstrap_replays
            .get(&intent.operation_ref)
        else {
            return Ok(None);
        };
        if previous.expression_ref != expression_ref
            || previous.intent != *intent
            || previous.before_revision != original_revision
        {
            return Err("The source bootstrap retry has another original intent".into());
        }
        if previous.current_document_fingerprint != fingerprint(self.document(expression_ref)?)? {
            return Err("The source bootstrap retry no longer meets its exact native Document; requalify the retained authorship".into());
        }
        let mut response = previous.response.clone();
        response["source_current"] = json!(false);
        response["replayed"] = json!(true);
        response["qualification"] = json!("historical_unqualified");
        response["state"] = json!("historical_retry");
        response["historical_native_receipt"] = response["native_receipt"].take();
        response["native_receipt"] = Value::Null;
        response["native_procedural_receipts"] = json!([]);
        Ok(Some(response))
    }

    pub(crate) fn finish_source_bootstrap(
        &mut self,
        client: &CentralClient,
        admission: Admission,
    ) -> Result<(Value, Option<Changed>), String> {
        let Admission {
            before_fingerprint,
            intent,
            reading,
            issuer_receipt,
            native_receipt,
        } = admission;
        let expression_ref = reading["expression_ref"]
            .as_str()
            .ok_or("Private native read lacks Expression")?
            .to_owned();
        let document = self.document(&expression_ref)?;
        if fingerprint(document)? != before_fingerprint {
            return Err(
                "The original source bootstrap Document changed before binding adoption".into(),
            );
        }
        if self
            .procedural_runtime
            .bootstrap_replays
            .contains_key(&intent.operation_ref)
        {
            return Err("Source bootstrap operation identity is already retained; use its exact native retry".into());
        }
        let before_revision = document.revision;
        let source = &native_receipt["procedural"];
        let binding = &source["binding"];
        let target: Address =
            serde_json::from_value(binding["address"].clone()).map_err(|e| e.to_string())?;
        let expected = address(document, Some(&intent.scene_ref), None, Component::Scene);
        if target != expected || canonical_address(document, &target)? != expected {
            return Err("Source binding does not address the exact current native Scene".into());
        }
        let scene = document
            .scenes
            .iter()
            .find(|s| s.scene_ref == intent.scene_ref)
            .ok_or("The selected native Scene disappeared")?;
        if manual::scene_material(scene)? != reading["presentation"] {
            return Err(
                "The original canonical Scene material changed before binding adoption".into(),
            );
        }
        let mut retained = scene
            .presentation
            .as_ref()
            .and_then(|p| p.scene.get("procedural"))
            .cloned()
            .unwrap_or_else(empty_retention);
        validate_retention(&retained)?;
        let rows = retained["bindings"]
            .as_array_mut()
            .ok_or("Native binding list absent")?;
        let exact = rows
            .iter()
            .filter(|row| row["address"] == json!(target))
            .collect::<Vec<_>>();
        if exact.iter().any(|row| *row != binding) {
            return Err("An authored binding already occupies this exact Scene; review an explicit source change".into());
        }
        if exact.len() > 1 {
            return Err("Duplicate exact native Scene bindings require reconciliation".into());
        }
        let mut changed_binding = exact.is_empty();
        if changed_binding {
            rows.push(binding.clone());
        }
        let source_rows = source["source_basis"]
            .as_array()
            .ok_or("Actual source bootstrap has no native source basis")?;
        let retained_sources = retained["source_basis"]
            .as_array_mut()
            .ok_or("Native source basis list absent")?;
        for basis in source_rows {
            let reading: ReadingRef = serde_json::from_value(json!({"ref":basis["source_ref"],
                "revision":basis["revision"],"availability":"available"}))
            .map_err(|e| e.to_string())?;
            super::super::readings(std::slice::from_ref(&reading))?;
            let row = json!(reading);
            if !retained_sources.contains(&row) {
                retained_sources.push(row);
                changed_binding = true;
            }
        }
        validate_retention(&retained)?;
        let mut response_budget = budget::Budget::new();
        for previous in self.procedural_runtime.bootstrap_replays.values() {
            response_budget.value(&previous.response)?;
        }
        response_budget.value(&native_receipt)?;
        response_budget.value(source)?;
        response_budget.value(&issuer_receipt)?;
        response_budget.value(&intent)?;
        // The returned native Document and source are both part of the saved
        // retry response. Count them before the original Edit can commit. The
        // prospective journal is conservatively counted beside the old one.
        response_budget.value(document)?;
        response_budget.value(&retained)?;
        response_budget.reserve(16 * 1024)?;
        if self.procedural_runtime.bootstrap_replays.len() >= 64 {
            return Err(
                "Native source bootstrap retry bound exceeded before binding adoption".into(),
            );
        }
        let expected_revision = before_revision
            .checked_add(u64::from(changed_binding))
            .ok_or("Native Document revision exhausted")?;
        let (document_receipt, changed) = if changed_binding {
            let mut presentation = scene
                .presentation
                .clone()
                .ok_or("Native Scene material absent")?;
            presentation.scene["procedural"] = retained;
            self.procedural_edit(
                client,
                expression_ref.clone(),
                before_revision,
                intent.authorship["actor_ref"]
                    .as_str()
                    .ok_or("Source actor absent")?
                    .to_owned(),
                vec![Change::SceneMaterialSet {
                    scene_ref: intent.scene_ref.clone(),
                    presentation,
                }],
            )?
        } else {
            self.apply(
                client,
                ExpressionRequest::Inspect {
                    expression_ref: expression_ref.clone(),
                },
            )?
        };
        if document_receipt["state"] != "ready"
            || document_receipt["document"]["revision"].as_u64() != Some(expected_revision)
        {
            return Err("Native source binding adoption did not meet its original CAS".into());
        }
        let current_document = self.document(&expression_ref)?;
        let response = json!({"schema":RESPONSE_SCHEMA,"original_intent":intent,
            "source":source,"native_receipt":native_receipt,"source_read_receipt":issuer_receipt,
            "binding_adoption":{"state":if changed_binding {"adopted"} else {"unchanged"},
                "document_revision_before":before_revision,"document_revision_after":current_document.revision,
                "document_receipt":document_receipt},
            "source_current":!changed_binding,"replayed":false,"qualification":"live_native_owner"});
        let current_document_fingerprint = fingerprint(current_document)?;
        self.procedural_runtime.bootstrap_replays.insert(
            intent.operation_ref.clone(),
            Replay {
                expression_ref,
                intent,
                before_revision,
                current_document_fingerprint,
                response: response.clone(),
            },
        );
        Ok((response, changed))
    }
}
