//! Private Source control receiving over the existing native Document.
//! One genuine Edit advances r to r+1. Saved labels never recreate this seal.
use super::*;
#[path = "expression_procedural_control_peer.rs"]
mod peers;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Action {
    Takeover { value: Value, lifetime: Lifetime },
    SetBase { value: Value },
    Release,
    ReleaseGesture { takeover_operation_ref: String },
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Lifetime {
    Gesture,
    Persistent,
}

#[derive(Debug)]
pub(crate) struct Candidate {
    pub(crate) before: Document,
    pub(crate) original: ExpressionRequest,
    pub(crate) source_input: Value,
    intent: Value,
    operation_ref: String,
    procedure_ref: String,
    entity_ref: String,
    parameter: String,
}
#[derive(Clone, Debug, Serialize)]
pub(super) struct Replay {
    pub(super) expression_ref: String,
    intent: Value,
    applied_revision: u64,
    document_sha256: String,
    source: Value,
    receipt_metadata: Value,
}
fn document_hash(document: &Document) -> Result<String, String> {
    let mut hash = Sha256::new();
    struct Writer<'a>(&'a mut Sha256);
    impl std::io::Write for Writer<'_> {
        fn write(&mut self, b: &[u8]) -> std::io::Result<usize> {
            self.0.update(b);
            Ok(b.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    serde_json::to_writer(Writer(&mut hash), document).map_err(|e| e.to_string())?;
    Ok(format!("{:x}", hash.finalize()))
}
pub(super) fn current_procedure(
    application: &Application,
    document: &Document,
    procedure_ref: &str,
    targets: &[Address],
) -> Result<Value, String> {
    let procedure = current_procedure_ref(application, document, procedure_ref, targets)?;
    let mut budget = budget::Budget::new();
    budget.value(procedure)?;
    Ok(procedure.clone())
}
pub(super) fn current_procedure_ref<'a>(
    application: &Application,
    document: &'a Document,
    procedure_ref: &str,
    targets: &[Address],
) -> Result<&'a Value, String> {
    let procedure = current_procedure_metadata(application, document, procedure_ref, targets)?;
    validate_retained_procedural_definition(document, procedure)?;
    Ok(procedure)
}
/// Borrow only the actual retained definition and private runtime identities.
/// This is planning information, not a renewed native Source qualification.
/// Callers must charge the complete cohort before current_procedure_ref re-reads
/// the full Scene/source and permits any receiving admission.
pub(super) fn current_procedure_metadata<'a>(
    application: &Application,
    document: &'a Document,
    procedure_ref: &str,
    targets: &[Address],
) -> Result<&'a Value, String> {
    let procedure = manual::definition_ref(document, procedure_ref)?;
    let definition_seal = crate::native_expression::procedural::bootstrap::fingerprint(procedure)?;
    let qualified = application
        .procedural_runtime
        .operations
        .iter()
        .any(|(id, op)| {
            application
                .procedural_runtime
                .qualified_operations
                .get(id)
                .map(String::as_str)
                == Some(procedure_ref)
                && !application.procedural_runtime.restored.contains(id)
                && op.envelope.expression_ref == document.expression_ref
                && op.status == Status::Applied
                && op.applied_revision.is_some_and(|r| r <= document.revision)
                && application.procedural_runtime.qualified_definitions.get(id)
                    == Some(&definition_seal)
                && targets
                    .iter()
                    .all(|target| op.targets.iter().any(|owned| covers(owned, target)))
        })
        || application.procedural_runtime.producers.values().any(|p| {
            p.expression_ref == document.expression_ref
                && p.document_revision == document.revision
                && p.prepared["original_procedure"] == *procedure
                && targets.iter().all(|target| {
                    p.targets
                        .iter()
                        .chain(&p.outputs)
                        .any(|owned| covers(owned, target))
                })
        });
    if !qualified {
        return Err("Native control needs this owner's original live Source qualification for every affected scalar location".into());
    }
    Ok(procedure)
}
/// Charge the whole actual driver and every possible older owner definition
/// before native Source reconstruction or Parameter preview copies any Scene.
fn driver_intake_plan<'a>(
    document: &'a Document,
    entity_ref: &str,
    parameter: &str,
    procedure_ref: &str,
    action: &Action,
    actor: &str,
    operation_ref: &str,
) -> Result<(Vec<Address>, Vec<&'a str>, Vec<peers::Peer<'a>>), String> {
    let native = document
        .entities
        .get(entity_ref)
        .and_then(|entity| entity.parameters.get(parameter))
        .ok_or("Actual native driver Parameter unavailable")?;
    super::super::parameter(parameter, native)?;
    let locations = document
        .scenes
        .iter()
        .filter(|scene| {
            scene
                .entity_refs
                .iter()
                .any(|reference| reference == entity_ref)
        })
        .count();
    if locations == 0 || locations > MAX_TARGETS {
        return Err("Native driver has no bounded actual Scene manifestations".into());
    }
    let peers = peers::plan(document, entity_ref)?;
    // Document::edited owns the actual Parameter preview and clones the whole
    // Document. Bound that genuine native allocation even when other Scenes
    // do not participate in this driver's Source input.
    let mut snapshot_budget = budget::Budget::new();
    snapshot_budget.value(document)?;
    let mut budget = budget::Budget::new();
    budget.reserve(4096)?;
    budget.value(native)?;
    budget.value(action)?;
    budget.value(actor)?;
    budget.value(operation_ref)?;
    budget.value(&document.expression_ref)?;
    budget.value(&document.revision)?;
    budget.value(&entity_ref)?;
    budget.value(&parameter)?;
    budget.value(manual::definition_ref(document, procedure_ref)?)?;
    peers::charge(&peers, &mut budget)?;
    let mut addresses = Vec::with_capacity(locations);
    let mut legacy = false;
    for scene in document.scenes.iter().filter(|scene| {
        scene
            .entity_refs
            .iter()
            .any(|reference| reference == entity_ref)
    }) {
        let address = source_parameter_location(document, &scene.scene_ref, entity_ref, parameter)?;
        let presentation = scene
            .presentation
            .as_ref()
            .ok_or("Actual driver Scene material unavailable")?;
        budget.reserve(4096)?;
        budget.value(&address)?;
        budget.value(presentation)?;
        budget.entity_refs(presentation)?;
        if matches!(action, Action::Takeover { .. } | Action::SetBase { .. }) {
            budget.value(presentation)?;
        }
        for row in presentation.scene["procedural"]["controls"]
            .as_array()
            .into_iter()
            .flatten()
        {
            let retained: Address =
                serde_json::from_value(row["address"].clone()).map_err(|e| e.to_string())?;
            if retained == address && row.get("procedure_ref").is_none() {
                legacy = true;
            }
        }
        addresses.push(address);
    }
    addresses.sort();
    let mut candidates = BTreeSet::new();
    if legacy {
        for scene in &document.scenes {
            for row in scene
                .presentation
                .as_ref()
                .and_then(|p| p.scene["procedural"]["procedures"].as_array())
                .into_iter()
                .flatten()
            {
                candidates.insert(retained_text(row, "procedure_ref")?);
                if candidates.len() > MAX_OPERATIONS {
                    return Err("Legacy control definition count exceeded before allocation".into());
                }
            }
        }
        for reference in &candidates {
            // The selected full definition occurs both as procedure and in the
            // qualified older-owner reading. Charge all possible candidates.
            let definition = manual::definition_ref(document, reference)?;
            budget.value(definition)?;
            budget.value(definition)?;
        }
    }
    Ok((addresses, candidates.into_iter().collect(), peers))
}
fn qualified_legacy_definitions(
    application: &Application,
    document: &Document,
    candidates: &[&str],
    addresses: &[Address],
    procedure_ref: &str,
) -> Result<Vec<Value>, String> {
    if candidates.is_empty() {
        return Ok(Vec::new());
    }
    let qualified = candidates
        .iter()
        .filter_map(|reference| {
            current_procedure_ref(application, document, reference, addresses).ok()
        })
        .collect::<Vec<_>>();
    if qualified.len() != 1 || qualified[0]["procedure_ref"] != procedure_ref {
        return Err(
            "Legacy native control requires exactly one qualified full original Procedure".into(),
        );
    }
    Ok(vec![qualified[0].clone()])
}
impl Application {
    pub(crate) fn prepare_procedural_control(
        &self,
        request: &ExpressionRequest,
    ) -> Result<Option<Candidate>, String> {
        let ExpressionRequest::Procedural {
            request:
                Request::Control {
                    expression_ref,
                    expected_revision,
                    procedure_ref,
                    address,
                    parameter,
                    actor,
                    operation_ref,
                    action,
                },
        } = request
        else {
            return Ok(None);
        };
        let intent = serde_json::to_value(request).map_err(|e| e.to_string())?["request"].clone();
        if let Some(cached) = self.procedural_runtime.controls.get(operation_ref) {
            if cached.intent != intent {
                return Err(
                    "Native control operation identity already has another original intent".into(),
                );
            }
            return Ok(None);
        }
        let document = self.document(expression_ref)?;
        if document.revision != *expected_revision {
            return Ok(None);
        }
        if self.procedural_runtime.controls.len() >= MAX_OPERATIONS {
            return Err(
                "Native control continuation horizon full; retain and explicitly close its owner"
                    .into(),
            );
        }
        super::super::text(actor)?;
        super::super::text(operation_ref)?;
        super::super::text(procedure_ref)?;
        let target = canonical_native_scalar_address(document, address)?;
        if target.expression_ref != *expression_ref || target.property.is_none() {
            return Err("Native control requires its exact scalar address".into());
        }
        let entity_ref = target
            .entity_ref
            .as_ref()
            .ok_or("Native scalar has no actual occurrence")?;
        if source_parameter_location(
            document,
            target
                .scene_ref
                .as_deref()
                .ok_or("Native scalar has no actual Scene")?,
            entity_ref,
            parameter,
        )? != target
        {
            return Err("Source property outside exact selected native scalar".into());
        }
        let value = match action {
            Action::Takeover { value, .. } | Action::SetBase { value } => Some(value),
            _ => None,
        };
        let (addresses, legacy_candidates, peer_plan) = driver_intake_plan(
            document,
            entity_ref,
            parameter,
            procedure_ref,
            action,
            actor,
            operation_ref,
        )?;
        if !addresses.contains(&target) {
            return Err("Native scalar control key differs from its selected coordinate".into());
        }
        let procedure = current_procedure(self, document, procedure_ref, &addresses)?;
        let qualified_legacy = qualified_legacy_definitions(
            self,
            document,
            &legacy_candidates,
            &addresses,
            procedure_ref,
        )?;
        let mut reading = source_parameter_driver(document, entity_ref, parameter, value)?;
        if reading["addresses"] != json!(addresses) {
            return Err(
                "Actual native driver locations differ from its borrowed intake plan".into(),
            );
        }
        reading["qualified_legacy_procedures"] = json!(qualified_legacy);
        reading["qualified_control_peers"] = peers::reading(self, document, &peer_plan)?;
        let source_input = json!({"procedure":procedure,"reading":reading,"actor_ref":actor,"operation_ref":operation_ref,"action":action});
        let mut budget = budget::Budget::new();
        budget.value(&source_input)?;
        Ok(Some(Candidate {
            before: document.clone(),
            original: request.clone(),
            source_input,
            intent,
            operation_ref: operation_ref.clone(),
            procedure_ref: procedure_ref.clone(),
            entity_ref: entity_ref.clone(),
            parameter: parameter.clone(),
        }))
    }
    pub(crate) fn finish_procedural_control(
        &mut self,
        client: &CentralClient,
        candidate: Candidate,
        reply: Value,
    ) -> Result<(Value, Option<Changed>), String> {
        if self.document(&candidate.before.expression_ref)? != &candidate.before {
            return Err("Native control original Document changed during Source work; retain and requalify its intent".into());
        }
        let prepared = &reply["native_result"]["result"];
        if reply["schema"] != "oi.expression-procedure-source-response/v1"
            || reply["native_result"]["schema"] != "ql.scene-procedural-response/v1"
            || reply["native_result"]["operation"] != "control"
            || reply["source"]["original_request"] != candidate.source_input
            || prepared["schema"] != "ql.procedural-control-prepared/v1"
            || prepared["original_procedure"] != candidate.source_input["procedure"]
            || prepared["driver_reading"] != candidate.source_input["reading"]
            || prepared["operation_ref"] != candidate.operation_ref
        {
            return Err("Native Source control differs from its private original procedure, driver or intake".into());
        }
        let action: Action = serde_json::from_value(candidate.source_input["action"].clone())
            .map_err(|e| e.to_string())?;
        let (addresses, legacy_candidates, peer_plan) = driver_intake_plan(
            &candidate.before,
            &candidate.entity_ref,
            &candidate.parameter,
            &candidate.procedure_ref,
            &action,
            retained_text(&candidate.source_input, "actor_ref")?,
            &candidate.operation_ref,
        )?;
        let mut actual = source_parameter_driver(
            &candidate.before,
            &candidate.entity_ref,
            &candidate.parameter,
            candidate.source_input["action"].get("value"),
        )?;
        actual["qualified_legacy_procedures"] = json!(qualified_legacy_definitions(
            self,
            &candidate.before,
            &legacy_candidates,
            &addresses,
            &candidate.procedure_ref,
        )?);
        actual["qualified_control_peers"] = peers::reading(self, &candidate.before, &peer_plan)?;
        if actual != candidate.source_input["reading"] {
            return Err(
                "Native control driver preview differs from actual original material".into(),
            );
        }
        let targets: Vec<Address> =
            serde_json::from_value(actual["addresses"].clone()).map_err(|e| e.to_string())?;
        if prepared["resolved_scope"] != json!(targets)
            || current_procedure(self, &candidate.before, &candidate.procedure_ref, &targets)?
                != prepared["original_procedure"]
        {
            return Err(
                "Native Source control widened or retired its qualified scalar locations".into(),
            );
        }
        let edit: ExpressionRequest =
            serde_json::from_value(prepared["native_edit"].clone()).map_err(|e| e.to_string())?;
        let ExpressionRequest::Edit {
            expression_ref,
            expected_revision,
            actor,
            changes,
        } = &edit
        else {
            return Err("Native control did not produce the ordinary Edit".into());
        };
        if expression_ref != &candidate.before.expression_ref
            || *expected_revision != candidate.before.revision
            || actor
                != candidate.source_input["actor_ref"]
                    .as_str()
                    .ok_or("Native actor missing")?
        {
            return Err("Native control Edit has another owner, actor or CAS".into());
        }
        validate_control_changes(&candidate, changes)?;
        peers::validate_result(&candidate, prepared, changes)?;
        let expanded = inherit_material_receipts(&candidate.before, changes)?;
        let preview = candidate
            .before
            .edited_with_journal(expanded.clone(), true)?;
        // Exactly one native value/configuration edit; no staged two-revision
        // receipt, device clock or effective consumer acknowledgement is made.
        if preview.revision
            != candidate
                .before
                .revision
                .checked_add(1)
                .ok_or("Revision exhausted")?
        {
            return Err("Native control did not advance one exact Document revision".into());
        }
        let mut compact_source = reply["source"].clone();
        compact_source
            .as_object_mut()
            .ok_or("Native Source provenance missing")?
            .remove("original_request");
        let mut cache_budget = budget::Budget::new();
        cache_budget.value(&self.procedural_runtime.controls)?;
        cache_budget.value(&compact_source)?;
        cache_budget.value(&candidate.intent)?;
        cache_budget.reserve(65536)?;
        self.procedural_runtime.owner_write = true;
        let result = self.apply(
            client,
            ExpressionRequest::Edit {
                expression_ref: expression_ref.clone(),
                expected_revision: *expected_revision,
                actor: actor.clone(),
                changes: expanded,
            },
        );
        self.procedural_runtime.owner_write = false;
        let (mut receipt, changed) = result?;
        if receipt["state"] == "revision_conflict" {
            receipt["native_procedural_receipts"] = json!([]);
            return Ok((receipt, None));
        }
        let document = self.document(&candidate.before.expression_ref)?;
        if document != &preview || changed.is_none() {
            return Err("Native control did not apply its exact privately sealed candidate".into());
        }
        receipt["native_procedural_receipts"] = json!([]);
        let driver =
            source_parameter_driver(document, &candidate.entity_ref, &candidate.parameter, None)?;
        let hash = document_hash(document)?;
        let mut receipt_metadata = receipt.clone();
        receipt_metadata
            .as_object_mut()
            .ok_or("Actual native Edit receipt missing")?
            .remove("document");
        let cached = Replay {
            expression_ref: document.expression_ref.clone(),
            intent: candidate.intent.clone(),
            applied_revision: document.revision,
            document_sha256: hash.clone(),
            source: compact_source,
            receipt_metadata,
        };
        let response = json!({"schema":SCHEMA,"operation":"control","operation_ref":candidate.operation_ref,"original_intent":candidate.intent,
            "state":"document_applied","native_edit_receipt":receipt,"source":reply["source"],"native_parameter_driver":driver,
            "native_procedural_receipts":[],"cache":{"provenance":"live_native_owner","restored":false,"replayed":false,"document_sha256":hash},
            "effective_state":"native_consumers_not_yet_observed"});
        self.procedural_runtime
            .controls
            .insert(candidate.operation_ref, cached);
        Ok((response, changed))
    }
    pub(crate) fn replay_procedural_control(&self, request: &Request) -> Result<Value, String> {
        let Request::Control {
            expression_ref,
            expected_revision,
            operation_ref,
            address,
            parameter,
            ..
        } = request
        else {
            return Err("Another native control request".into());
        };
        let intent = serde_json::to_value(request).map_err(|e| e.to_string())?;
        let document = self.document(expression_ref)?;
        if let Some(cached) = self.procedural_runtime.controls.get(operation_ref) {
            if cached.intent != intent || cached.expression_ref != *expression_ref {
                return Err("Native control identity has another original intent".into());
            }
            if cached.applied_revision != document.revision
                || cached.document_sha256 != document_hash(document)?
            {
                return Err("Native control retry no longer has its exact applied Document; inspect and explicitly requalify".into());
            }
            let entity = address
                .entity_ref
                .as_deref()
                .ok_or("Native scalar occurrence missing")?;
            let driver = source_parameter_driver(document, entity, parameter, None)?;
            let mut receipt = cached.receipt_metadata.clone();
            receipt["document"] = serde_json::to_value(document).map_err(|e| e.to_string())?;
            return Ok(
                json!({"schema":SCHEMA,"operation":"control","operation_ref":operation_ref,"original_intent":intent,
                "state":"document_applied","native_edit_receipt":receipt,
                "native_parameter_driver":driver,"source":cached.source,"native_procedural_receipts":[],
                "cache":{"provenance":"live_native_owner","restored":false,"replayed":true,"document_sha256":cached.document_sha256},
                "effective_state":"native_consumers_not_yet_observed"}),
            );
        }
        Ok(
            json!({"schema":SCHEMA,"operation":"control","operation_ref":operation_ref,"original_intent":intent,
            "state":if document.revision!=*expected_revision{"revision_conflict"}else{"source_refused"},
            "reason":"Native control requires private Source prepare/execute/finish; saved or absent cache cannot authorize replay",
            "document":document,"native_procedural_receipts":[],"cache":{"provenance":"unqualified","restored":true,"replayed":false}}),
        )
    }
}
fn validate_control_changes(candidate: &Candidate, changes: &[Change]) -> Result<(), String> {
    let scene_refs = candidate.source_input["reading"]["scenes"]
        .as_array()
        .ok_or("Native driver Scenes missing")?;
    let mut expected: BTreeSet<&str> = scene_refs
        .iter()
        .map(|s| {
            s["scene_ref"]
                .as_str()
                .ok_or("Native driver Scene ID missing")
        })
        .collect::<Result<_, _>>()?;
    let mut manual = false;
    let mut value = false;
    let mut automation = false;
    for change in changes {
        match change {
            Change::SceneMaterialSet {
                scene_ref,
                presentation,
            } if !manual && expected.remove(scene_ref.as_str()) => {
                let original = candidate
                    .before
                    .scenes
                    .iter()
                    .find(|s| s.scene_ref == *scene_ref)
                    .and_then(|s| s.presentation.as_ref())
                    .ok_or("Original control Scene missing")?;
                if presentation.saved != original.saved {
                    return Err("Control cannot change saved authored material".into());
                }
                let mut old = original
                    .scene
                    .as_object()
                    .ok_or("Original Scene object missing")?
                    .clone();
                let mut new = presentation
                    .scene
                    .as_object()
                    .ok_or("Source Scene object missing")?
                    .clone();
                for key in ["procedural", "automation", "propertyTracks"] {
                    old.remove(key);
                    new.remove(key);
                }
                if old != new {
                    return Err("Scalar control Source changed unrelated authored material".into());
                }
                let retained = &presentation.scene["procedural"];
                validate_retention(retained)?;
                for key in [
                    "procedures",
                    "bindings",
                    "source_basis",
                    "operations",
                    "scene_flow",
                    "time_mappings",
                    "physical_checkpoints",
                ] {
                    let original = &original.scene["procedural"];
                    if original.is_object() && retained[key] != original[key] && key != "operations"
                    {
                        return Err("Scalar control Source changed original procedure/source/native continuation".into());
                    }
                    if key == "operations" && !retained[key].as_array().is_some_and(Vec::is_empty) {
                        return Err("Source control cannot issue a procedural journal".into());
                    }
                }
            }
            Change::ParameterManual {
                entity_ref,
                parameter,
            } if expected.is_empty()
                && !manual
                && entity_ref == &candidate.entity_ref
                && parameter == &candidate.parameter =>
            {
                manual = true
            }
            Change::ParameterSet {
                entity_ref,
                parameter,
                value: actual_value,
            } if manual
                && !value
                && entity_ref == &candidate.entity_ref
                && parameter == &candidate.parameter =>
            {
                if candidate.source_input["action"]
                    .get("value")
                    .is_some_and(|expected| expected != actual_value)
                {
                    return Err(
                        "Source control changed another value than its exact native intent".into(),
                    );
                }
                value = true
            }
            Change::ParameterAutomate {
                entity_ref,
                parameter,
                ..
            } if value
                && !automation
                && entity_ref == &candidate.entity_ref
                && parameter == &candidate.parameter =>
            {
                automation = true
            }
            _ => return Err("Source control changes another native target or driver order".into()),
        }
    }
    if !expected.is_empty() || !manual || !value {
        return Err(
            "Native Source control omits an affected Scene or actual Parameter edit".into(),
        );
    }
    Ok(())
}
