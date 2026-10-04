//! Current native material operands for the normal Library factory. The
//! existing Document, address resolver and retained-output reader remain owners.
use super::*;
use crate::native_expression::procedural::stage_library::{Action, Intent};

/// Charge borrowed actual material, repeated output/intervention contexts and
/// retention BEFORE any scene/source/current basis is cloned for the compiler.
fn preflight_intake(
    document: &Document,
    runtime: &Runtime,
    intent: &Intent,
    targets: &[Address],
) -> Result<(), String> {
    let mut budget = budget::Budget::new();
    budget.value(document)?;
    budget.value(intent)?;
    budget.reserve(4096)?;
    let mut scenes = BTreeSet::from([intent.basis.scene_ref.as_str()]);
    for target in targets {
        budget.value(target)?;
        budget.reserve(4096)?;
        if let Some(reference) = target.scene_ref.as_deref() {
            scenes.insert(reference);
            let scene = document
                .scenes
                .iter()
                .find(|scene| scene.scene_ref == reference)
                .ok_or("Actual native target Scene absent")?;
            // Only scalar/property operands and qualified subject/tags enter a
            // TargetReading. Full glyph material is charged only when selected.
            if let Some(entity) = target
                .entity_ref
                .as_ref()
                .and_then(|id| document.entities.get(id))
            {
                budget.value(&entity.subject)?;
            }
            for binding in bindings(scene) {
                budget.value(&binding["principal"])?;
                budget.value(&binding["tags"])?;
            }
        }
        for key in keys_for_target(target, &intent.property_keys()?) {
            if key == "native_atlas_state" {
                budget.value(&document.selection)?;
                for scene in &document.scenes {
                    budget.value(&scene.scene_ref)?;
                }
                budget.reserve(4096)?;
            } else if let Some(parameter) = target
                .entity_ref
                .as_ref()
                .and_then(|id| document.entities.get(id))
                .and_then(|entity| entity.parameters.get(&key))
            {
                budget.value(&parameter.value)?;
            } else if target.component == Component::Scene && target.property.is_none() {
                let scene = document
                    .scenes
                    .iter()
                    .find(|scene| target.scene_ref.as_deref() == Some(scene.scene_ref.as_str()))
                    .and_then(|scene| scene.presentation.as_ref())
                    .ok_or("Actual native Scene property absent")?;
                budget.value(path(&scene.scene, &key)?)?;
            } else {
                budget.value(manual::borrowed_material(document, target)?)?;
            }
        }
    }
    if intent.choice["recipe"] == "atlas_passage" {
        scenes.extend(document.scenes.iter().map(|scene| scene.scene_ref.as_str()));
    }
    if intent.action == Action::Regenerate {
        let procedure_ref = retained_text(&intent.authored, "procedure_ref")?;
        budget::preflight_source_outputs_into(document, procedure_ref, runtime, &mut budget)?;
        let mut seen = BTreeSet::new();
        let mut context_count = 0usize;
        for scene in &document.scenes {
            let Some(presentation) = &scene.presentation else {
                continue;
            };
            let Some(contributions) = presentation.scene["procedural"]["contributions"].as_array()
            else {
                continue;
            };
            for contribution in contributions
                .iter()
                .filter(|row| row["procedure_ref"] == procedure_ref && row["status"] == "active")
            {
                if !seen.insert(retained_text(contribution, "contribution_ref")?) {
                    continue;
                }
                if seen.len() > MAX_TARGETS {
                    return Err(
                        "Native Library output count exceeds its bound before allocation".into(),
                    );
                }
                let references = budget::context_scenes(contribution)?;
                context_count = context_count
                    .checked_add(references.len().max(1))
                    .ok_or("Native Library context count overflow")?;
                if context_count > MAX_TARGETS {
                    return Err(
                        "Native Library context count exceeds its bound before allocation".into(),
                    );
                }
                let owned = retained_rows(contribution, "owned_addresses")?;
                let records = retained_rows(contribution, "authored_overrides")?;
                for address in owned {
                    if let Some(reference) = address["scene_ref"].as_str() {
                        scenes.insert(reference);
                    }
                }
                if references.is_empty() {
                    // Actual scalar/Atlas current basis and retained flow context
                    // contain no glyph copy. Charge the complete borrowed document
                    // for their combined source/selection/order/record operands.
                    let actual = source_current_output_basis(document, contribution)?;
                    budget.value(&actual)?;
                    budget.value(&actual)?;
                    budget.value(records)?;
                    budget.value(owned)?;
                    budget.reserve(4096)?;
                } else {
                    for reference in references {
                        let actual = document
                            .scenes
                            .iter()
                            .find(|scene| scene.scene_ref == reference)
                            .and_then(|scene| scene.presentation.as_ref())
                            .ok_or("Actual native context material absent")?;
                        // CurrentContribution, projected intervention context and
                        // actual current output reading own separate material copies.
                        budget.material(actual)?;
                        budget.material(actual)?;
                        budget.entity_refs(actual)?;
                        budget.value(owned)?;
                        for record in records
                            .iter()
                            .filter(|row| row["address"]["scene_ref"] == reference)
                        {
                            budget.value(record)?;
                        }
                        budget.reserve(4096)?;
                    }
                }
            }
        }
    }
    if let Some(outputs) = intent.choice["outputs"].as_array() {
        if outputs.len() > 256 {
            return Err(
                "Native Library output cardinality exceeds its bound before allocation".into(),
            );
        }
        let presentation = document
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == intent.basis.scene_ref)
            .and_then(|scene| scene.presentation.as_ref())
            .ok_or("Actual native output source absent")?;
        for output in outputs {
            // The Library embeds one complete source basis per constructor output.
            budget.material(presentation)?;
            budget.value(output)?;
            budget.reserve(4096)?;
        }
    }
    // One source-material copy plus retained/current materialization per scene.
    for reference in scenes {
        let presentation = document
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == reference)
            .and_then(|scene| scene.presentation.as_ref())
            .ok_or("Actual Library material Scene absent")?;
        budget.material(presentation)?;
        budget.value(&BorrowedRetention(&presentation.scene["procedural"]))?;
        let target = address(document, Some(reference), None, Component::Scene);
        let binding = source_exact_binding_borrowed(document, &target)?
            .ok_or("Actual native material binding absent")?;
        budget.value(&binding["principal"])?;
        budget.value(&binding["contributors"])?;
        budget.value(&binding["locus"])?;
        budget.reserve(4096)?;
        if reference == intent.basis.scene_ref {
            budget.material(presentation)?;
            budget.value(binding)?;
        }
    }
    Ok(())
}

struct BorrowedRetention<'a>(&'a Value);
impl Serialize for BorrowedRetention<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        // The first actual native procedure starts from an existing Scene
        // without retention. Preserve that absence for the native materializer.
        if self.0.is_null() {
            return serializer.serialize_none();
        }
        let object = self
            .0
            .as_object()
            .ok_or_else(|| serde::ser::Error::custom("Actual native retention absent"))?;
        let mut map = serializer.serialize_map(Some(object.len()))?;
        for (key, value) in object {
            if key == "operations" {
                map.serialize_entry(key, &[] as &[Value])?;
            } else {
                map.serialize_entry(key, value)?;
            }
        }
        map.end()
    }
}
fn keys_for_target(target: &Address, properties: &[String]) -> Vec<String> {
    properties
        .iter()
        .filter(|key| {
            match (
                target.component.clone(),
                target.property.as_deref(),
                key.as_str(),
            ) {
                (Component::Force, Some(property), "force_strength") => property == "strength",
                (Component::Force, Some(property), "force_spin") => property == "spin",
                (Component::Force, Some(property), "force_radius") => property == "radius",
                _ => true,
            }
        })
        .cloned()
        .collect()
}

pub(crate) fn intake(
    document: &Document,
    runtime: &Runtime,
    intent: &Intent,
) -> Result<Value, String> {
    intent.validate(document)?;
    // The shared native resolver validates borrowed roots and typed serde paths;
    // it allocates only resolved Address identities before the aggregate charge.
    let targets = match &intent.scope {
        Scope::Addresses { addresses }
            if addresses.is_empty()
                && ["scene_material", "sequence_material"]
                    .contains(&intent.choice["recipe"].as_str().unwrap_or("")) =>
        {
            Vec::new()
        }
        _ => resolve(document, &intent.scope)?,
    };
    preflight_intake(document, runtime, intent, &targets)?;
    let source = source_native_scene_source(document, &intent.basis.scene_ref, &intent.profile)?;
    if source != intent.source {
        return Err(
            "Library intent differs from the exact current native Scene/source/profile".into(),
        );
    }
    let properties = intent.property_keys()?;
    let mut readings = Vec::new();
    for target in &targets {
        let keys = keys_for_target(target, &properties);
        let mut row = source_target_parts(document, target, &keys)?;
        row["occurrence_ref"] = json!(source_occurrence_ref(target)?);
        readings.push(row);
    }
    let procedure_ref = retained_text(&intent.authored, "procedure_ref")?;
    let outputs = if intent.action == Action::Regenerate {
        runtime.output_readings(document, procedure_ref)?
    } else {
        Vec::new()
    };
    if intent.action == Action::Regenerate && outputs.is_empty() {
        return Err("Regeneration requires actual applied original native outputs".into());
    }
    let current: Vec<Value> = outputs.iter().map(|row| json!({
        "contribution_ref":row["contribution_ref"],"material":row["current_basis"],"overlays":[]
    })).collect();
    let contexts = source_event_intervention_contexts(document, &current)?;
    let mut scene_refs = BTreeSet::from([intent.basis.scene_ref.clone()]);
    for target in &targets {
        if let Some(scene) = &target.scene_ref {
            scene_refs.insert(scene.clone());
        }
    }
    if intent.choice["recipe"] == "atlas_passage" {
        scene_refs.extend(document.scenes.iter().map(|scene| scene.scene_ref.clone()));
    }
    for row in &outputs {
        for target in retained_rows(row, "owned_addresses")? {
            if let Some(scene) = target["scene_ref"].as_str() {
                scene_refs.insert(scene.into());
            }
        }
    }
    let mut material = Vec::new();
    let mut continuation: Option<(u64, String)> = None;
    for reference in scene_refs {
        let scene = document
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == reference)
            .ok_or("Library material Scene disappeared")?;
        let target = address(document, Some(&reference), None, Component::Scene);
        let binding = source_exact_binding(document, &target)?
            .ok_or("Library material requires its actual native Scene binding")?;
        let presentation = scene
            .presentation
            .as_ref()
            .ok_or("Native Scene material absent")?;
        let mut retention = presentation.scene["procedural"].clone();
        if !retention.is_null() {
            validate_retention(&retention)?;
            retention["operations"] = json!([]);
        }
        if intent.action == Action::Regenerate {
            if let Some(procedure) = retention["procedures"].as_array().and_then(|rows| {
                rows.iter()
                    .find(|row| row["procedure_ref"] == procedure_ref)
            }) {
                let cursor = procedure["cursor"]
                    .as_u64()
                    .ok_or("Actual retained rule cursor absent")?;
                let state = retained_text(procedure, "state")?.to_owned();
                if continuation
                    .as_ref()
                    .is_some_and(|actual| actual != &(cursor, state.clone()))
                {
                    return Err("Actual rule continuation differs across its native Scenes".into());
                }
                continuation = Some((cursor, state));
            }
        }
        material.push(json!({"scene_ref":reference,"document_revision":document.revision,
            "existing_retention":retention,"current_presentation":manual::scene_material(scene)?,
            "principal":source_native_subject(document,&target)?,"contributors":binding["contributors"],"locus":binding["locus"]}));
    }
    if let Some(outputs) = intent.choice["outputs"].as_array() {
        for output in outputs {
            let reference = retained_text(output, "scene_ref")?;
            if material.iter().any(|row| row["scene_ref"] == reference) {
                continue;
            }
            if document
                .scenes
                .iter()
                .any(|scene| scene.scene_ref == reference)
            {
                return Err(
                    "Existing output Scene is not owned by this original native procedure".into(),
                );
            }
            material.push(json!({"scene_ref":reference,"document_revision":document.revision,
                "existing_retention":null,"current_presentation":null,"principal":source["principal"],
                "contributors":source["contributors"],"locus":{"ref":source["locus_ref"],
                "revision":source["locus_revision"],"availability":"available"}}));
        }
    }
    let mut budget = budget::Budget::new();
    budget.value(document)?;
    budget.value(intent)?;
    budget.value(&readings)?;
    budget.value(&outputs)?;
    budget.value(&material)?;
    budget.value(&contexts)?;
    let (rule_cursor, state) = continuation.unwrap_or((0, "held".into()));
    Ok(
        json!({"current_readings":readings,"scene_source":source,"output_readings":outputs,
        "current":current,"intervention_contexts":contexts,"materialization":{
        "schema":"ql.procedural-materialization/v1","document_revision":document.revision,
        "rule_cursor":rule_cursor,"state":state,"scenes":material}}),
    )
}

impl Application {
    pub(crate) fn stage_library_intake(
        &self,
        before: &Document,
        intent: &Intent,
    ) -> Result<Value, String> {
        if self.document(&before.expression_ref)? != before {
            return Err("revision_conflict".into());
        }
        intake(before, &self.procedural_runtime, intent)
    }
    pub(crate) fn stage_library_check_envelope(
        &self,
        before: &Document,
        envelope: Envelope,
    ) -> Result<(), String> {
        self.procedural_runtime
            .check_preparation(before, envelope)
            .map(|_| ())
    }
    pub(crate) fn stage_library_operation(
        &self,
        operation_ref: &str,
    ) -> Result<Option<Operation>, String> {
        let operation = self.procedural_runtime.operations.get(operation_ref);
        bootstrap::preflight_source_message(&operation)?;
        Ok(operation.cloned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_authored_native_scene_preserves_absent_retention_in_library_intake() {
        let mut application = Application::default();
        let client = CentralClient::discover();
        let reference = "expression:first-procedural-library";
        application
            .apply(
                &client,
                ExpressionRequest::Create {
                    expression_ref: reference.into(),
                    title: "First procedure".into(),
                    actor: "human:scene-author".into(),
                },
            )
            .unwrap();
        let before = application.document(reference).unwrap().clone();
        let scene_ref = before.scenes[0].scene_ref.clone();
        let presentation = crate::expression_scene::Presentation {
            schema: crate::expression_scene::SCHEMA.into(),
            saved: None,
            scene: json!({"id":scene_ref,"name":before.scenes[0].title,"duration":30,"transition":2,
                "view":{"mode":"3d","yaw":0,"pitch":0,"zoom":1,"panX":0,"panY":0},
                "field":{},"composition":{},"morph":{},"engine":{},"entities":[],"text":[],"automation":[]}),
        };
        let (receipt, changed) = application
            .apply(
                &client,
                ExpressionRequest::Edit {
                    expression_ref: reference.into(),
                    expected_revision: before.revision,
                    actor: "human:scene-author".into(),
                    changes: vec![Change::SceneMaterialSet {
                        scene_ref: scene_ref.clone(),
                        presentation,
                    }],
                },
            )
            .unwrap();
        assert_eq!(receipt["state"], "ready");
        assert!(changed.is_some());
        let actual = application.document(reference).unwrap();
        actual.validate().unwrap();
        let original = actual.clone();
        let material = &actual
            .scenes
            .iter()
            .find(|scene| scene.scene_ref == scene_ref)
            .unwrap()
            .presentation
            .as_ref()
            .unwrap()
            .scene;
        assert!(material.get("procedural").is_none());
        let borrowed = BorrowedRetention(&material["procedural"]);
        let mut budget = budget::Budget::new();
        budget.value(actual).unwrap();
        budget.value(&borrowed).unwrap();
        // The actual compiler sees absent existing retention, rather than a
        // fabricated prior procedure, producer or native acknowledgement.
        assert_eq!(serde_json::to_value(borrowed).unwrap(), Value::Null);
        assert_eq!(application.document(reference).unwrap(), &original);
    }
}
