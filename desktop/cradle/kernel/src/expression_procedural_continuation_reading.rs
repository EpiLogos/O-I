//! Refresh the installed private conductor's original coordinates from the
//! actual Document. This is an observation, never a reconstructed conductor.
use super::*;

fn reading(
    document: &Document,
    runtime: &Runtime,
    scene_ref: &str,
    installed: &Value,
    admit:&mut dyn FnMut(usize)->Result<(),String>,
) -> Result<Value, String> {
    let procedure = &installed["procedure"];
    let procedure_ref = retained_text(procedure, "procedure_ref")?;
    if installed["expression_ref"].as_str() != Some(document.expression_ref.as_str()) {
        return Err(
            "Source continuation differs from the actual original installed Procedure".into(),
        );
    }
    let input = installed["current_readings"]
        .as_array()
        .ok_or("Installed native Procedure has no original reading coordinates")?;
    let old_scenes = installed["materialization"]["scenes"]
        .as_array()
        .ok_or("Installed native Procedure has no original materialization coordinates")?;
    if input.len() > MAX_TARGETS || old_scenes.len() > MAX_TARGETS {
        return Err("Source continuation coordinate bound exceeded before allocation".into());
    }
    let mut horizon = budget::Budget::new();
    horizon.reserve(4096)?;
    horizon.value(installed)?;
    let mut scenes = BTreeSet::from([scene_ref.to_owned()]);
    let mut targets = Vec::new();
    let mut unique = BTreeSet::new();
    for row in input {
        let target = retained_address(&row["address"])?;
        if target.expression_ref != document.expression_ref || !unique.insert(target.clone()) {
            return Err("Source continuation has foreign or duplicate original coordinates".into());
        }
        let keys = row["properties"]
            .as_object()
            .ok_or("Installed native property keys absent")?;
        if keys.len() > MAX_TARGETS {
            return Err("Source continuation property bound exceeded before allocation".into());
        }
        horizon.reserve(4096)?;
        if let Some(reference) = &target.scene_ref {
            scenes.insert(reference.clone());
            let presentation = document
                .scenes
                .iter()
                .find(|s| &s.scene_ref == reference)
                .and_then(|s| s.presentation.as_ref())
                .ok_or("Source continuation reading Scene absent")?;
            horizon.value(&presentation.scene["procedural"]["bindings"])?;
        }
        if let Some(reference) = &target.entity_ref {
            let entity = document
                .entities
                .get(reference)
                .ok_or("Source continuation Entity absent")?;
            horizon.value(&entity.subject)?;
            for key in keys.keys() {
                if matches!(
                    target.component,
                    Component::Entity | Component::Property | Component::Force
                ) && (target.component != Component::Force || key.starts_with("force_"))
                    && entity.parameters.contains_key(key)
                {
                    horizon.value(&entity.parameters[key])?;
                } else {
                    let mut body = target.clone();
                    if body.component == Component::Property {
                        body.component = Component::Entity;
                    }
                    horizon.value(manual::borrowed_material(document, &body)?)?;
                }
            }
        } else if target.component == Component::Expression {
            horizon.value(&document.selection)?;
            for scene in &document.scenes {
                horizon.value(&scene.scene_ref)?;
            }
        } else {
            let presentation = document
                .scenes
                .iter()
                .find(|s| target.scene_ref.as_deref() == Some(s.scene_ref.as_str()))
                .and_then(|s| s.presentation.as_ref())
                .ok_or("Source continuation reading material absent")?;
            for _ in keys {
                horizon.material(presentation)?;
            }
        }
        targets.push(target);
    }
    // Native Parameters are global Entity values. Reusing an original rule's
    // coordinates cannot hide a newly added Scene manifestation or silently
    // expand that rule's scope. The native structural event owns expansion.
    type GlobalCoordinate<'a> = (
        &'a str,
        &'a Component,
        Option<Option<&'a str>>,
        Option<&'a str>,
        Option<&'a str>,
        &'a str,
    );
    let mut locations: BTreeMap<GlobalCoordinate<'_>, BTreeSet<&str>> = BTreeMap::new();
    for (row, target) in input.iter().zip(&targets) {
        let Some(entity_ref) = target.entity_ref.as_deref() else {
            continue;
        };
        let entity = document
            .entities
            .get(entity_ref)
            .ok_or("Source continuation Entity absent")?;
        for key in row["properties"].as_object().unwrap().keys().filter(|key| {
            matches!(
                target.component,
                Component::Entity | Component::Property | Component::Force
            ) && (target.component != Component::Force || key.starts_with("force_"))
                && entity.parameters.contains_key(*key)
        }) {
            horizon.reserve(256)?;
            let scene = target
                .scene_ref
                .as_deref()
                .ok_or("Source continuation global Parameter has no original Scene coordinate")?;
            locations
                .entry((
                    entity_ref,
                    &target.component,
                    target.parent_ref.as_ref().map(|parent| parent.as_deref()),
                    target.constituent_ref.as_deref(),
                    target.property.as_deref(),
                    key.as_str(),
                ))
                .or_default()
                .insert(scene);
        }
    }
    let entities = locations
        .keys()
        .map(|coordinate| coordinate.0)
        .collect::<BTreeSet<_>>();
    let mut actual_locations: BTreeMap<&str, BTreeSet<&str>> = BTreeMap::new();
    for scene in &document.scenes {
        for entity in scene
            .entity_refs
            .iter()
            .filter(|entity| entities.contains(entity.as_str()))
        {
            horizon.reserve(128)?;
            actual_locations
                .entry(entity.as_str())
                .or_default()
                .insert(scene.scene_ref.as_str());
        }
    }
    for (coordinate, original_locations) in &locations {
        if actual_locations.get(coordinate.0) != Some(original_locations) {
            return Err(
                "Source continuation original coordinates omit an affected actual Scene location"
                    .into(),
            );
        }
    }
    let mut pending_scenes = Vec::new();
    for scene in old_scenes {
        let reference = retained_text(scene, "scene_ref")?;
        if document
            .scenes
            .iter()
            .any(|current| current.scene_ref == reference)
        {
            scenes.insert(reference.to_owned());
            continue;
        }
        // The real Library intake contains null contexts for configured new
        // outputs. Only its actual still-live producer's constructed output
        // and original SceneCreate may carry that planned descriptor while
        // material remains unapplied. A missing Scene is never a live target.
        let original_pending_output = runtime.producers.values().any(|producer| {
            producer.expression_ref == document.expression_ref
                && producer.prepared["original_procedure"] == *procedure
                && producer.outputs.iter().any(|target| {
                    target.component == Component::Scene
                        && target.scene_ref.as_deref() == Some(reference)
                })
                && producer.changes.iter().any(|change| {
                    matches!(change,
                    Change::SceneCreate {scene_ref, ..} if scene_ref == reference)
                })
                && producer.source["original_request"]["materialization"]["scenes"]
                    .as_array()
                    .is_some_and(|originals| {
                        originals.iter().any(|original| {
                            original["scene_ref"].as_str() == Some(reference)
                                && original.as_object().zip(scene.as_object()).is_some_and(
                                    |(a, b)| {
                                        a.len() == b.len()
                                            && a.iter().all(|(key, value)| {
                                                if key == "document_revision" {
                                                    b.get(key).and_then(Value::as_u64).is_some_and(
                                                        |revision| {
                                                            revision > 0
                                                                && revision <= document.revision
                                                        },
                                                    )
                                                } else {
                                                    b.get(key) == Some(value)
                                                }
                                            })
                                    },
                                )
                        })
                    })
        });
        if !scene["existing_retention"].is_null()
            || !scene["current_presentation"].is_null()
            || !original_pending_output
        {
            return Err(
                "Source continuation missing output has no original live constructed pending Scene"
                    .into(),
            );
        }
        horizon.value(scene)?;
        pending_scenes.push(scene);
    }
    // Contributions may introduce retained generated passages. Read their
    // actual owned locations without changing the original input coordinates.
    for scene in &document.scenes {
        for row in scene
            .presentation
            .as_ref()
            .and_then(|p| p.scene["procedural"]["contributions"].as_array())
            .into_iter()
            .flatten()
            .filter(|row| row["procedure_ref"] == procedure_ref && row["status"] == "active")
        {
            let owned = retained_rows(row, "owned_addresses")?;
            if owned.len() > MAX_TARGETS {
                return Err("Source continuation ownership bound exceeded".into());
            }
            for target in owned {
                if target["expression_ref"].as_str() != Some(document.expression_ref.as_str()) {
                    return Err("Source continuation contribution owns another Expression".into());
                }
                if let Some(reference) = target["scene_ref"].as_str() {
                    scenes.insert(reference.to_owned());
                }
            }
        }
    }
    if scenes.len() > MAX_TARGETS {
        return Err("Source continuation Scene bound exceeded before allocation".into());
    }
    for reference in &scenes {
        let presentation = document
            .scenes
            .iter()
            .find(|s| s.scene_ref == *reference)
            .and_then(|s| s.presentation.as_ref())
            .ok_or("Source continuation material Scene absent")?;
        horizon.reserve(4096)?;
        horizon.value(presentation)?;
        horizon.material(presentation)?;
        horizon.value(&presentation.scene["procedural"]["bindings"])?;
    }
    admit(horizon.charged_bytes())?;
    let current_readings = input
        .iter()
        .zip(&targets)
        .map(|(row, target)| {
            let keys = row["properties"]
                .as_object()
                .unwrap()
                .keys()
                .cloned()
                .collect::<Vec<_>>();
            let mut current = source_target_parts(document, target, &keys)?;
            current["occurrence_ref"] = json!(source_occurrence_ref(&canonical_address(
                document, target
            )?)?);
            Ok(current)
        })
        .collect::<Result<Vec<Value>, String>>()?;
    let mut material_scenes = Vec::new();
    for reference in scenes {
        let scene = document
            .scenes
            .iter()
            .find(|s| s.scene_ref == reference)
            .ok_or("Source continuation Scene absent")?;
        let target = address(document, Some(&reference), None, Component::Scene);
        let binding = source_exact_binding(document, &target)?
            .ok_or("Source continuation Scene has no native binding")?;
        let mut retention = scene
            .presentation
            .as_ref()
            .ok_or("Source continuation material absent")?
            .scene["procedural"]
            .clone();
        validate_retention(&retention)?;
        retention["operations"] = json!([]);
        material_scenes.push(json!({"scene_ref":reference,"document_revision":document.revision,
            "existing_retention":retention,"current_presentation":manual::scene_material(scene)?,
            "principal":source_native_subject(document,&target)?,"contributors":binding["contributors"],"locus":binding["locus"]}));
    }
    for original in pending_scenes {
        let mut planned = original.clone();
        planned["document_revision"] = json!(document.revision);
        material_scenes.push(planned);
    }
    let result = json!({"current_readings":current_readings,"materialization":{
        "schema":"ql.procedural-lifecycle-materialization-reading/v1",
        "document_revision":document.revision,"scenes":material_scenes}});
    let mut final_budget = budget::Budget::new();
    final_budget.value(installed)?;
    final_budget.value(&result)?;
    final_budget.reserve(4096)?;
    Ok(result)
}

impl Application {
    #[cfg(test)]
    pub(crate) fn procedural_continuation_reading(
        &self,
        before: &Document,
        scene_ref: &str,
        installed: &Value,
    ) -> Result<Value, String> {
        if self.document(&before.expression_ref)? != before {
            return Err("revision_conflict".into());
        }
        let mut borrowed = budget::Budget::new();
        borrowed.value(installed)?;
        borrowed.reserve(4096)?;
        self.require_original_continuation_definition(before, installed)?;
        reading(before, &self.procedural_runtime, scene_ref, installed, &mut |_|Ok(()))
    }
}

impl Application {
    // An original installed seed precedes its first generated material. Before
    // that material exists, only this live Runtime's sealed producer and exact
    // native journal may carry the definition across Prepare. Saved JSON never
    // populates either private map. Observing this pending branch is no ACK.
    fn require_original_continuation_definition(
        &self,
        before: &Document,
        installed: &Value,
    ) -> Result<(), String> {
        let procedure = &installed["procedure"];
        let reference = retained_text(procedure, "procedure_ref")?;
        let retained = before.scenes.iter().any(|scene| {
            scene
                .presentation
                .as_ref()
                .and_then(|p| p.scene["procedural"]["procedures"].as_array())
                .is_some_and(|rows| rows.iter().any(|row| row["procedure_ref"] == reference))
        });
        if retained {
            if manual::definition_ref(before, reference)? != procedure {
                return Err(
                    "Source continuation differs from the actual original installed Procedure"
                        .into(),
                );
            }
            return Ok(());
        }
        let seal = crate::native_expression::procedural::bootstrap::fingerprint(procedure)?;
        let journal = budget::borrowed_journal(before)?;
        for (producer_ref, producer) in &self.procedural_runtime.producers {
            if producer.expression_ref != before.expression_ref
                || producer.prepared["original_procedure"] != *procedure
            {
                continue;
            }
            if producer.document_revision == before.revision
                && self
                    .qualify_procedural_definition(before, producer_ref, installed)
                    .is_ok()
            {
                return Ok(());
            }
            let Some(operation_ref) = producer.prepared["operation_ref"].as_str() else {
                continue;
            };
            let Ok(operation) = self.procedural_runtime.inspect(operation_ref) else {
                continue;
            };
            if self.procedural_runtime.restored.contains(operation_ref)
                || !matches!(operation.status, Status::Prepared | Status::Scheduled)
                || operation.envelope.expression_ref != before.expression_ref
                || operation.envelope.producer_ref.as_deref() != Some(producer_ref.as_str())
                || operation.envelope.expected_revision != producer.document_revision
                || operation.envelope.changes != producer.changes
                || !operation
                    .accepted_revision
                    .is_some_and(|revision| revision <= before.revision)
                || self
                    .procedural_runtime
                    .qualified_operations
                    .get(operation_ref)
                    .map(String::as_str)
                    != Some(reference)
                || self
                    .procedural_runtime
                    .qualified_definitions
                    .get(operation_ref)
                    != Some(&seal)
            {
                continue;
            }
            let Some(raw) = journal.get(operation_ref) else {
                continue;
            };
            if budget::matches_borrowed(operation, *raw) {
                return Ok(());
            }
        }
        Err("Source continuation has no actual retained definition or original live pending producer/journal".into())
    }
}

impl Application {
    /// SAME actual original-coordinate native reader. This callback accounts
    /// prospective copies only; it cannot admit Source, Rule, timing or material.
    pub(crate) fn procedural_continuation_reading_with_capture(
        &self,before:&Document,scene_ref:&str,installed:&Value,
        admit:&mut dyn FnMut(usize)->Result<(),String>,
    )->Result<Value,String> {
        if self.document(&before.expression_ref)?!=before {return Err("revision_conflict".into());}
        let mut borrowed=budget::Budget::new();
        borrowed.value(installed)?;
        borrowed.reserve(4096)?;
        self.require_original_continuation_definition(before,installed)?;
        reading(before,&self.procedural_runtime,scene_ref,installed,admit)
    }
}
