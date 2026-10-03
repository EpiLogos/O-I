//! Intent-only lifecycle operations over the actual native Document. Source
//! derives rule events, clocks and continuation; this reader supplies material.
use super::*;

pub const RESPONSE_SCHEMA: &str = "oi.expression-procedural-lifecycle/v1";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ScenePolicy {
    Continue,
    Hold,
    CheckpointRelease,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Action {
    Retire,
    ContributionDetach {
        contribution_ref: String,
    },
    ScenePolicy {
        from_scene_ref: String,
        to_scene_ref: String,
        policy: ScenePolicy,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Intent {
    pub expression_ref: String,
    pub expected_revision: u64,
    pub scene_ref: String,
    pub operation_ref: String,
    pub actor: String,
    pub procedure_ref: String,
    pub expected_procedure_revision: String,
    pub action: Action,
}

impl Intent {
    pub(crate) fn wire(&self) -> Result<Value, String> {
        let mut wire = serde_json::to_value(self).map_err(|e| e.to_string())?;
        wire["operation"] = json!("lifecycle");
        Ok(wire)
    }
    pub(crate) fn from_request(request: &Request) -> Result<Self, String> {
        let Request::Lifecycle {
            expression_ref,
            expected_revision,
            scene_ref,
            operation_ref,
            actor,
            procedure_ref,
            expected_procedure_revision,
            action,
        } = request
        else {
            return Err("Expected the original native lifecycle intent".into());
        };
        Ok(Self {
            expression_ref: expression_ref.clone(),
            expected_revision: *expected_revision,
            scene_ref: scene_ref.clone(),
            operation_ref: operation_ref.clone(),
            actor: actor.clone(),
            procedure_ref: procedure_ref.clone(),
            expected_procedure_revision: expected_procedure_revision.clone(),
            action: action.clone(),
        })
    }

    pub(crate) fn validate(&self, document: &Document) -> Result<(), String> {
        for value in [
            &self.expression_ref,
            &self.scene_ref,
            &self.operation_ref,
            &self.actor,
            &self.procedure_ref,
            &self.expected_procedure_revision,
        ] {
            super::super::text(value)?;
        }
        if document.expression_ref != self.expression_ref
            || document.revision != self.expected_revision
        {
            return Err("revision_conflict".into());
        }
        let scene = document
            .scenes
            .iter()
            .find(|s| s.scene_ref == self.scene_ref)
            .ok_or("Lifecycle intent has no actual native Scene")?;
        let procedure = manual::definition_ref(document, &self.procedure_ref)?;
        if procedure["procedure_ref"] != self.procedure_ref
            || procedure["revision"] != self.expected_procedure_revision
            || !scene
                .presentation
                .as_ref()
                .and_then(|p| p.scene["procedural"]["procedures"].as_array())
                .is_some_and(|rows| {
                    rows.iter()
                        .any(|r| r["procedure_ref"] == self.procedure_ref)
                })
        {
            return Err(
                "Lifecycle intent differs from its actual retained Procedure revision/Scene".into(),
            );
        }
        match &self.action {
            Action::Retire => {}
            Action::ContributionDetach { contribution_ref } => {
                super::super::text(contribution_ref)?;
                let contribution = source_current_contribution(document, contribution_ref)?;
                if contribution["procedure_ref"] != self.procedure_ref {
                    return Err("Lifecycle detachment belongs to another actual Procedure".into());
                }
            }
            Action::ScenePolicy {
                from_scene_ref,
                to_scene_ref,
                ..
            } => {
                super::super::text(from_scene_ref)?;
                super::super::text(to_scene_ref)?;
                if from_scene_ref != &self.scene_ref
                    || !document.scenes.iter().any(|s| &s.scene_ref == to_scene_ref)
                {
                    return Err(
                        "Lifecycle Scene policy differs from actual native source/destination"
                            .into(),
                    );
                }
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct CancelIntent {
    pub expression_ref: String,
    pub expected_revision: u64,
    pub scene_ref: String,
    pub operation_ref: String,
    pub actor: String,
    pub procedure_ref: String,
    pub expected_procedure_revision: String,
}
impl CancelIntent {
    pub(crate) fn from_request(request: &Request) -> Result<Self, String> {
        let Request::LifecycleCancel {
            expression_ref,
            expected_revision,
            scene_ref,
            operation_ref,
            actor,
            procedure_ref,
            expected_procedure_revision,
        } = request
        else {
            return Err("Expected the original lifecycle cancellation identities".into());
        };
        Ok(Self {
            expression_ref: expression_ref.clone(),
            expected_revision: *expected_revision,
            scene_ref: scene_ref.clone(),
            operation_ref: operation_ref.clone(),
            actor: actor.clone(),
            procedure_ref: procedure_ref.clone(),
            expected_procedure_revision: expected_procedure_revision.clone(),
        })
    }
    pub(crate) fn wire(&self) -> Result<Value, String> {
        let mut wire = serde_json::to_value(self).map_err(|e| e.to_string())?;
        wire["operation"] = json!("lifecycle_cancel");
        Ok(wire)
    }
}

impl Application {
    /// The native finish path calls this AFTER validating the actual Source
    /// position against its original native timing pulse. No public request
    /// can set this private provenance, and cold journals do not restore it.
    pub(crate) fn retain_lifecycle_position(
        &mut self,
        before: &Document,
        producer_ref: &str,
        position: &Value,
    ) -> Result<(), String> {
        if self.document(&before.expression_ref)? != before {
            return Err("revision_conflict".into());
        }
        let producer = self
            .procedural_runtime
            .producers
            .get_mut(producer_ref)
            .ok_or("Actual lifecycle Source producer absent")?;
        if producer.expression_ref != before.expression_ref
            || producer.document_revision != before.revision
            || !producer.prepared["lifecycle_intent"].is_object()
            || !position.is_object()
            || producer
                .lifecycle_position
                .as_ref()
                .is_some_and(|old| old != position)
        {
            return Err("Original qualified lifecycle admission position changed".into());
        }
        let mut bounded = budget::Budget::new();
        bounded.value(position)?;
        producer.lifecycle_position = Some(position.clone());
        Ok(())
    }

    pub(crate) fn procedural_cancelled_position(
        &self,
        before: &Document,
        intent: &CancelIntent,
    ) -> Result<Value, String> {
        self.procedural_cancelled_readback(before, intent)?;
        let operation = self.procedural_runtime.inspect(&intent.operation_ref)?;
        let position = self
            .procedural_runtime
            .producers
            .get(
                operation
                    .envelope
                    .producer_ref
                    .as_deref()
                    .ok_or("Cancelled lifecycle producer absent")?,
            )
            .and_then(|producer| producer.lifecycle_position.as_ref())
            .ok_or("Cancellation lost its original qualified Source position")?;
        let mut bounded = budget::Budget::new();
        bounded.value(position)?;
        Ok(position.clone())
    }

    /// Full original Source preparation from the ALREADY qualified actual
    /// cancelled Runtime producer. This is private readback, never caller data.
    pub(crate) fn procedural_cancelled_preparation(
        &self,
        before: &Document,
        intent: &CancelIntent,
    ) -> Result<Value, String> {
        // Keep the exact current Runtime/journal/actor/original-intent checks.
        self.procedural_cancelled_readback(before, intent)?;
        let operation = self.procedural_runtime.inspect(&intent.operation_ref)?;
        let producer = self
            .procedural_runtime
            .producers
            .get(
                operation
                    .envelope
                    .producer_ref
                    .as_deref()
                    .ok_or("Cancelled lifecycle lost actual Source producer")?,
            )
            .ok_or("Cancelled lifecycle original Source producer absent")?;
        let mut bounded = budget::Budget::new();
        bounded.value(&producer.prepared)?;
        Ok(producer.prepared.clone())
    }

    /// Read the complete actual live S cancellation, including its retained
    /// journal. Saved or reconstructed operation labels cannot grant this.
    pub(crate) fn procedural_cancelled_readback(
        &self,
        before: &Document,
        intent: &CancelIntent,
    ) -> Result<Value, String> {
        if self.document(&intent.expression_ref)? != before
            || before.revision != intent.expected_revision
        {
            return Err("revision_conflict".into());
        }
        for text in [
            &intent.expression_ref,
            &intent.scene_ref,
            &intent.operation_ref,
            &intent.actor,
            &intent.procedure_ref,
            &intent.expected_procedure_revision,
        ] {
            super::super::text(text)?;
        }
        if !before
            .scenes
            .iter()
            .any(|scene| scene.scene_ref == intent.scene_ref)
            || manual::definition_ref(before, &intent.procedure_ref)?["revision"]
                != intent.expected_procedure_revision
        {
            return Err("Cancellation differs from the actual current Procedure/Scene".into());
        }
        let operation = self.procedural_runtime.inspect(&intent.operation_ref)?;
        if self
            .procedural_runtime
            .qualified_operations
            .get(&intent.operation_ref)
            != Some(&intent.procedure_ref)
            || self
                .procedural_runtime
                .restored
                .contains(&intent.operation_ref)
            || operation.status != Status::Cancelled
            || operation.applied_revision.is_some()
            || operation.failure.is_some()
            || !operation.observations.is_empty()
            || operation.envelope.expression_ref != intent.expression_ref
            || operation.envelope.actor != intent.actor
            || operation
                .accepted_revision
                .is_none_or(|revision| revision > before.revision)
        {
            return Err(
                "Lifecycle abandonment requires actual original native S cancellation/withdrawal"
                    .into(),
            );
        }
        let producer = self
            .procedural_runtime
            .producers
            .get(
                operation
                    .envelope
                    .producer_ref
                    .as_deref()
                    .ok_or("Cancelled lifecycle lost its actual native producer")?,
            )
            .ok_or("Cancelled lifecycle has no actual retained native producer")?;
        let original = &producer.prepared["lifecycle_intent"];
        if original["scene_ref"] != intent.scene_ref
            || original["actor_ref"] != intent.actor
            || original["procedure_ref"] != intent.procedure_ref
            || original["operation_ref"] != intent.operation_ref
            || original["expected_procedure_revision"] != intent.expected_procedure_revision
            || original["document_revision"].as_u64() != Some(operation.envelope.expected_revision)
        {
            return Err("Cancellation changed the original sealed lifecycle intent".into());
        }
        let retained = journal(before)?;
        let retained: Operation = serde_json::from_value(
            retained
                .get(&intent.operation_ref)
                .ok_or("Actual cancellation journal absent")?
                .clone(),
        )
        .map_err(|e| e.to_string())?;
        if &retained != operation {
            return Err(
                "Actual cancelled native Operation differs from full retained journal".into(),
            );
        }
        let mut bounded = budget::Budget::new();
        bounded.value(operation)?;
        serde_json::to_value(operation).map_err(|e| e.to_string())
    }
}

/// Native callback owns the installed definition and privately issued Scene
/// read. These transported facts cannot reconstruct either native capability.
pub(crate) fn reading(
    application: &mut Application,
    client: &CentralClient,
    document: &Document,
    intent: &Intent,
    installed: &Value,
    issued_scene: &Value,
) -> Result<Value, String> {
    if application.document(&intent.expression_ref)? != document {
        return Err("revision_conflict".into());
    }
    intent.validate(document)?;
    let original = manual::definition_ref(document, &intent.procedure_ref)?;
    if installed["expression_ref"] != document.expression_ref
        || installed["procedure"] != *original
        || issued_scene["expression_ref"] != document.expression_ref
        || issued_scene["scene_ref"] != intent.scene_ref
        || issued_scene["document_revision"].as_u64() != Some(document.revision)
    {
        return Err(
            "Lifecycle reading differs from its actual installed Procedure/current Scene".into(),
        );
    }
    let input_readings = installed["current_readings"]
        .as_array()
        .ok_or("Installed native Procedure has no original reading coordinates")?;
    if input_readings.len() > MAX_TARGETS {
        return Err("Lifecycle native reading count exceeded before allocation".into());
    }
    let mut contributions = BTreeMap::new();
    let mut scenes = BTreeSet::from([intent.scene_ref.as_str()]);
    for scene in &document.scenes {
        for row in scene
            .presentation
            .as_ref()
            .and_then(|p| p.scene["procedural"]["contributions"].as_array())
            .into_iter()
            .flatten()
            .filter(|c| c["procedure_ref"] == intent.procedure_ref && c["status"] == "active")
        {
            if !selected_contribution(original, row, &intent.action)? {
                continue;
            }
            let reference = retained_text(row, "contribution_ref")?;
            if contributions
                .insert(reference, row)
                .is_some_and(|old| old != row)
            {
                return Err("Lifecycle native contribution mirrors disagree".into());
            }
            if contributions.len() > MAX_TARGETS {
                return Err("Lifecycle contribution count exceeded before allocation".into());
            }
            for address in retained_rows(row, "owned_addresses")? {
                if let Some(scene) = address["scene_ref"].as_str() {
                    scenes.insert(scene);
                }
            }
        }
    }
    if let Action::ScenePolicy { to_scene_ref, .. } = &intent.action {
        scenes.insert(to_scene_ref);
    }
    for scene in installed["materialization"]["scenes"]
        .as_array()
        .into_iter()
        .flatten()
    {
        let reference = retained_text(scene, "scene_ref")?;
        scenes.insert(reference);
    }
    let mut context_count = 0usize;
    for row in contributions.values() {
        let context_scenes = budget::context_scenes(row)?;
        context_count = context_count
            .checked_add(context_scenes.len().max(1))
            .ok_or("Lifecycle native context count overflow")?;
        if context_count > MAX_TARGETS {
            return Err("Lifecycle native context count exceeded before allocation".into());
        }
    }
    for row in input_readings {
        let target = retained_address(&row["address"])?;
        if row["properties"]
            .as_object()
            .is_none_or(|keys| keys.len() > MAX_TARGETS)
        {
            return Err("Lifecycle native property count exceeded before allocation".into());
        }
        if let Some(scene) = row["address"]["scene_ref"].as_str() {
            scenes.insert(scene);
        }
        if target.expression_ref != document.expression_ref {
            return Err("Lifecycle reading target has another native Expression".into());
        }
    }
    if scenes.len() > MAX_TARGETS {
        return Err("Lifecycle Scene count exceeded before allocation".into());
    }
    // Account the complete actual payload before cloning Scene/output material
    // or asking Source for current qualification. The accepted Document has
    // its own separate ordinary native byte limit.
    let mut budget = budget::Budget::new();
    budget.reserve(4096)?;
    budget.value(intent)?;
    budget.value(issued_scene)?;
    budget::preflight_source_outputs_into(
        document,
        &intent.procedure_ref,
        &application.procedural_runtime,
        &mut budget,
    )?;
    for reference in &scenes {
        let presentation = document
            .scenes
            .iter()
            .find(|s| s.scene_ref == **reference)
            .and_then(|s| s.presentation.as_ref())
            .ok_or("Lifecycle material Scene is absent")?;
        budget.reserve(4096)?;
        budget.value(presentation)?;
        budget.material(presentation)?;
    }
    // TargetReading material and source properties are bounded by their exact
    // original native addresses; the same owner rechecks them at admission.
    for row in input_readings {
        let target = retained_address(&row["address"])?;
        budget.reserve(4096)?;
        budget.value(row)?;
        if let Some(scene_ref) = &target.scene_ref {
            let scene = document
                .scenes
                .iter()
                .find(|s| &s.scene_ref == scene_ref)
                .ok_or("Lifecycle native reading Scene absent")?;
            if let Some(presentation) = &scene.presentation {
                budget.value(&presentation.scene["procedural"]["bindings"])?;
            }
        }
        // Charge actual current property storage, not the old installed value:
        // a genuine native edit may have enlarged its glyph or Scene material.
        if let Some(reference) = &target.entity_ref {
            let entity = document
                .entities
                .get(reference)
                .ok_or("Lifecycle native Entity absent")?;
            budget.value(&entity.subject)?;
            let canonical = canonical_address(document, &target)?;
            for key in row["properties"].as_object().unwrap().keys() {
                if matches!(
                    canonical.component,
                    Component::Entity | Component::Property | Component::Force
                ) && (canonical.component != Component::Force || key.starts_with("force_"))
                    && entity.parameters.contains_key(key)
                {
                    budget.value(&entity.parameters[key])?;
                } else {
                    let mut body_target = canonical.clone();
                    if body_target.component == Component::Property {
                        body_target.component = Component::Entity;
                    }
                    budget.value(manual::borrowed_material(document, &body_target)?)?;
                }
            }
        } else if target.component == Component::Expression {
            budget.value(&document.selection)?;
            for scene in &document.scenes {
                budget.value(&scene.scene_ref)?;
            }
        } else {
            let scene = document
                .scenes
                .iter()
                .find(|s| target.scene_ref.as_deref() == Some(s.scene_ref.as_str()))
                .and_then(|s| s.presentation.as_ref())
                .ok_or("Lifecycle native reading Scene absent")?;
            for _ in row["properties"].as_object().unwrap().keys() {
                budget.material(scene)?;
            }
        }
    }
    for contribution in contributions.values() {
        budget.reserve(4096)?;
        budget.value(&contribution["owned_addresses"])?;
        budget.value(&contribution["authored_overrides"])?;
        let contexts = budget::context_scenes(contribution)?;
        if contribution["generated_basis"]["schema"] == "oi.journey-scene/v1" {
            let occurrence = retained_text(contribution, "occurrence_ref")?;
            let presentation = document
                .scenes
                .iter()
                .find(|s| s.scene_ref == occurrence)
                .and_then(|s| s.presentation.as_ref())
                .ok_or("Lifecycle actual generated Scene absent")?;
            budget.material(presentation)?;
        } else if let Some(parameter) = contribution["generated_basis"]["parameter"].as_str() {
            let entity = document
                .entities
                .get(retained_text(contribution, "occurrence_ref")?)
                .ok_or("Lifecycle actual native Parameter Entity absent")?;
            budget.value(
                entity
                    .parameters
                    .get(parameter)
                    .ok_or("Lifecycle actual native Parameter absent")?,
            )?;
        } else if contribution["generated_basis"]["native_flow"].is_array() {
            budget.value(&document.selection)?;
            for scene in &document.scenes {
                budget.value(&scene.scene_ref)?;
            }
        } else {
            return Err("Lifecycle contribution has no actual native output owner".into());
        }
        for reference in contexts {
            let presentation = document
                .scenes
                .iter()
                .find(|s| s.scene_ref == reference)
                .and_then(|s| s.presentation.as_ref())
                .ok_or("Lifecycle actual intervention Scene absent")?;
            budget.reserve(4096)?;
            budget.value(&contribution["owned_addresses"])?;
            budget.value(&contribution["authored_overrides"])?;
            budget.material(presentation)?;
            budget.entity_refs(presentation)?;
        }
    }
    let mut current_readings = Vec::new();
    for row in input_readings {
        let target = retained_address(&row["address"])?;
        let keys = row["properties"]
            .as_object()
            .ok_or("Installed native property keys absent")?
            .keys()
            .cloned()
            .collect::<Vec<_>>();
        let mut actual = source_target_parts(document, &target, &keys)?;
        actual["occurrence_ref"] = json!(source_occurrence_ref(&target)?);
        current_readings.push(actual);
    }
    let mut output_readings = application
        .procedural(
            client,
            Request::ReadOutputs {
                expression_ref: intent.expression_ref.clone(),
                expected_revision: document.revision,
                procedure_ref: intent.procedure_ref.clone(),
            },
        )?
        .0["output_readings"]
        .clone();
    output_readings
        .as_array_mut()
        .ok_or("Actual native output reader returned another result")?
        .retain(|row| {
            row["contribution_ref"]
                .as_str()
                .is_some_and(|r| contributions.contains_key(r))
        });
    let current = contributions.iter().map(|(reference,row)| {
        Ok(json!({"contribution_ref":reference,"material":source_current_output_basis(document,row)?,"overlays":[]}))
    }).collect::<Result<Vec<_>,String>>()?;
    let contexts = source_event_intervention_contexts(document, &current)?;
    let mut material_scenes = Vec::new();
    for reference in scenes {
        let scene = document
            .scenes
            .iter()
            .find(|s| s.scene_ref == reference)
            .ok_or("Lifecycle material Scene absent")?;
        let target = address(document, Some(reference), None, Component::Scene);
        let binding = source_exact_binding(document, &target)?
            .ok_or("Lifecycle Scene has no actual native source binding")?;
        let mut retention = scene
            .presentation
            .as_ref()
            .ok_or("Lifecycle Scene material absent")?
            .scene["procedural"]
            .clone();
        validate_retention(&retention)?;
        retention["operations"] = json!([]);
        material_scenes.push(json!({"scene_ref":reference,"document_revision":document.revision,
            "existing_retention":retention,"current_presentation":manual::scene_material(scene)?,
            "principal":source_native_subject(document,&target)?,"contributors":binding["contributors"],"locus":binding["locus"]}));
    }
    let current_flow = if matches!(intent.action, Action::ScenePolicy { .. }) {
        source_native_property(
            document,
            &address(document, None, None, Component::Expression),
            "native_atlas_state",
        )?
    } else {
        Value::Null
    };
    let reading = json!({"schema":"ql.native-procedural-lifecycle-reading/v1","scene_read":issued_scene,
        "current_readings":current_readings,"output_readings":output_readings,"current_contributions":current,
        "intervention_contexts":contexts,"materialization":{"schema":"ql.procedural-lifecycle-materialization-reading/v1",
        "document_revision":document.revision,"scenes":material_scenes},"current_flow":current_flow});
    let mut final_budget = budget::Budget::new();
    final_budget.value(intent)?;
    final_budget.value(&reading)?;
    final_budget.reserve(4096)?;
    Ok(reading)
}

fn selected_contribution(
    procedure: &Value,
    contribution: &Value,
    action: &Action,
) -> Result<bool, String> {
    Ok(match action {
        Action::Retire => true,
        Action::ContributionDetach { contribution_ref } => {
            contribution["contribution_ref"] == *contribution_ref
        }
        Action::ScenePolicy { from_scene_ref, .. } => {
            retained_rows(contribution, "owned_addresses")?
                .iter()
                .any(|address| address["scene_ref"] == *from_scene_ref)
                || procedure["recipe_parameters"]["native_program"]["outputs"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .any(|output| {
                        output["source"]["scene_ref"] == *from_scene_ref
                            && output["output_slot"] == contribution["output_slot"]
                            && output["scene_ref"] == contribution["occurrence_ref"]
                    })
        }
    })
}

/// The sealed lifecycle exception is checked only on the actual installed
/// producer's original request. Ordinary composition keeps its original actor
/// and complete constructor-output checks.
pub(crate) fn validate_admission(
    document: &Document,
    prepared: &Value,
    source: &Value,
) -> Result<bool, String> {
    let original = &source["original_request"];
    if original["action"] != "lifecycle" {
        if !prepared["lifecycle_intent"].is_null() {
            return Err("Lifecycle preparation has another actual native producer action".into());
        }
        return Ok(false);
    }
    let input = &original["input"];
    if input["schema"] != "ql.procedural-lifecycle-intent/v1" {
        return Err("Actual native lifecycle producer has another original schema".into());
    }
    let intent = Intent {
        expression_ref: retained_text(input, "expression_ref")?.to_owned(),
        expected_revision: input["document_revision"]
            .as_u64()
            .ok_or("Lifecycle native CAS absent")?,
        scene_ref: retained_text(input, "scene_ref")?.to_owned(),
        operation_ref: retained_text(input, "operation_ref")?.to_owned(),
        actor: retained_text(input, "actor_ref")?.to_owned(),
        procedure_ref: retained_text(input, "procedure_ref")?.to_owned(),
        expected_procedure_revision: retained_text(input, "expected_procedure_revision")?
            .to_owned(),
        action: serde_json::from_value(input["action"].clone()).map_err(|e| e.to_string())?,
    };
    intent.validate(document)?;
    let reading = &input["reading"];
    if reading["schema"] != "ql.native-procedural-lifecycle-reading/v1"
        || reading["scene_read"]["expression_ref"] != document.expression_ref
        || reading["scene_read"]["scene_ref"] != intent.scene_ref
        || reading["scene_read"]["document_revision"].as_u64() != Some(document.revision)
        || prepared["original_procedure"]
            != *manual::definition_ref(document, &intent.procedure_ref)?
        || prepared["procedure_ref"] != intent.procedure_ref
        || prepared["operation_ref"] != intent.operation_ref
        || prepared["native_edit"]["actor"] != intent.actor
        || prepared["native_edit"]["expected_revision"].as_u64() != Some(document.revision)
        || prepared["native_edit"]["expression_ref"] != document.expression_ref
    {
        return Err(
            "Lifecycle preparation relabels the exact current original intent/Procedure/CAS/actor"
                .into(),
        );
    }
    let receipt = retained_text(&reading["scene_read"], "source_read_receipt_ref")?;
    let expected = json!({"schema":"ql.procedural-lifecycle-intent/v1","expression_ref":intent.expression_ref,
        "document_revision":intent.expected_revision,"scene_ref":intent.scene_ref,"operation_ref":intent.operation_ref,
        "actor_ref":intent.actor,"procedure_ref":intent.procedure_ref,"expected_procedure_revision":intent.expected_procedure_revision,
        "action":intent.action,"source_read_receipt_ref":receipt});
    if prepared["lifecycle_intent"] != expected {
        return Err("Lifecycle preparation lost its complete original sealed intent".into());
    }
    validate_source_payload(document, reading)?;
    Ok(true)
}
