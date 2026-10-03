//! Protected ordinary-edit attribution over the same native Document/CAS.
//! The held source owner computes stable interventions. This receiver validates
//! their exact native scope and atomically attaches them to the accepted edit.
use super::*;

#[derive(Debug)]
pub(crate) struct ManualCandidate {
    before: Document,
    candidate: Document,
    original: ExpressionRequest,
    actor: String,
    operation_ref: String,
    pub(crate) entries: Vec<ManualEntry>,
}
#[derive(Debug)]
pub(crate) struct ManualEntry {
    pub(crate) procedure_ref: String,
    pub(crate) expression_ref: String,
    pub(crate) request: Value,
    contribution: Value,
    anchor_ref: Option<String>,
}
/// Produced only by the protected native Source worker over this candidate,
/// never deserialized from an Edit or caller-supplied attribution.
pub(crate) struct ManualBatchRecords {
    pub(crate) native_reply: Value,
    pub(crate) results: Vec<Value>,
}
impl ManualCandidate {
    pub(crate) fn before(&self) -> &Document {
        &self.before
    }
    pub(crate) fn original(&self) -> &ExpressionRequest {
        &self.original
    }
}
pub(super) fn scene_material(scene: &super::super::Scene) -> Result<Value, String> {
    let mut material = serde_json::to_value(
        scene
            .presentation
            .as_ref()
            .ok_or("Procedural intervention requires actual native Scene material")?,
    )
    .map_err(|error| error.to_string())?;
    material["scene"]
        .as_object_mut()
        .ok_or("Missing native Scene material")?
        .remove("procedural");
    Ok(material)
}
fn material(scene: &super::super::Scene) -> Result<Value, String> {
    scene_material(scene)
}
pub(super) fn scene_entity_refs(
    document: &Document,
    scene: &super::super::Scene,
) -> Result<BTreeMap<String, String>, String> {
    let mut entities = BTreeMap::new();
    let presentation = scene
        .presentation
        .as_ref()
        .ok_or("Actual Scene material unavailable")?;
    for entity in presentation.scene["entities"]
        .as_array()
        .into_iter()
        .flatten()
    {
        let id = entity["id"]
            .as_str()
            .ok_or("Actual material identity missing")?;
        if !scene.entity_refs.iter().any(|reference| reference == id)
            || !document.entities.contains_key(id)
            || entities.insert(id.to_owned(), id.to_owned()).is_some()
        {
            return Err(
                "Material identity differs from its unique actual native occurrence".into(),
            );
        }
    }
    Ok(entities)
}
fn flow(document: &Document) -> Value {
    json!({"schema":"ql.native-atlas-state/v1","expression_ref":document.expression_ref,
        "focus":document.selection,"scene_order":document.scenes.iter().map(|scene|scene.scene_ref.clone()).collect::<Vec<_>>()})
}
fn definition(document: &Document, procedure: &str) -> Result<Value, String> {
    let mut original = None;
    for scene in &document.scenes {
        let Some(rows) = scene
            .presentation
            .as_ref()
            .and_then(|p| p.scene["procedural"]["procedures"].as_array())
        else {
            continue;
        };
        for row in rows.iter().filter(|row| row["procedure_ref"] == procedure) {
            let value = row
                .get("definition")
                .filter(|value| value.is_object())
                .ok_or("Original procedure definition unavailable")?;
            if original.as_ref().is_some_and(|prior| prior != value) {
                return Err("Conflicting native procedure projections".into());
            }
            original = Some(value.clone());
        }
    }
    original.ok_or_else(|| "Original native procedure definition unavailable".into())
}
fn deletion_request(
    document: &Document,
    candidate: &Document,
    contribution: &Value,
    edit: Value,
) -> Result<(String, Value), String> {
    let procedure = definition(document, retained_text(contribution, "procedure_ref")?)?;
    let program = &procedure["recipe_parameters"]["native_program"];
    if program["recipe"] != "scene_material" {
        return Err("Scene deletion has no original native SceneMaterial constructor".into());
    }
    let outputs = program["outputs"]
        .as_array()
        .ok_or("Original constructor outputs unavailable")?;
    let rows = outputs
        .iter()
        .filter(|output| {
            output["output_slot"] == contribution["output_slot"]
                && output["scene_ref"] == contribution["occurrence_ref"]
        })
        .collect::<Vec<_>>();
    if rows.len() != 1 {
        return Err("Scene deletion has no unique original source anchor".into());
    }
    let anchor = rows[0]["source"]["scene_ref"]
        .as_str()
        .ok_or("Original native source Scene unavailable")?
        .to_owned();
    if !candidate
        .scenes
        .iter()
        .any(|scene| scene.scene_ref == anchor)
    {
        return Err("Deleting the original canonical source anchor requires explicit native continuation disposition".into());
    }
    let source = &rows[0]["source"];
    let profile:ReadingRef=serde_json::from_value(json!({"ref":source["source_basis"]["source_ref"],"revision":source["source_basis"]["revision"],"availability":"available"})).map_err(|e|e.to_string())?;
    let actual = source_native_scene_source(document, &anchor, &profile)?;
    let current = document
        .scenes
        .iter()
        .find(|scene| scene.scene_ref == anchor)
        .ok_or("Native source anchor unavailable")?;
    let mut retained = current
        .presentation
        .as_ref()
        .ok_or("Native anchor material unavailable")?
        .scene["procedural"]
        .clone();
    let matching = retained["contributions"]
        .as_array()
        .ok_or("Original anchor contribution missing")?
        .iter()
        .filter(|row| row["contribution_ref"] == contribution["contribution_ref"])
        .collect::<Vec<_>>();
    if matching.len() != 1 || matching[0] != contribution {
        return Err(
            "Canonical source anchor does not retain the same original contribution".into(),
        );
    }
    retained["operations"] = json!([]);
    Ok((
        anchor.clone(),
        json!({"action":"scene_delete_anchor","input":{"procedure":procedure,"contribution":contribution,
        "anchor":{"scene_ref":anchor,"document_revision":document.revision,"existing_retention":retained,"current_presentation":actual["presentation"],
            "principal":actual["principal"],"contributors":actual["contributors"],"locus":{"ref":actual["locus_ref"],"revision":actual["locus_revision"],"availability":"available"}},"edit":edit}}),
    ))
}
impl Application {
    pub(crate) fn prepare_procedural_manual_edit(
        &self,
        request: &ExpressionRequest,
    ) -> Result<Option<ManualCandidate>, String> {
        let ExpressionRequest::Edit {
            expression_ref,
            expected_revision,
            actor,
            changes,
        } = request
        else {
            return Ok(None);
        };
        let before = self.document(expression_ref)?.clone();
        if before.revision != *expected_revision || self.procedural_runtime.owner_write {
            return Ok(None);
        }
        let candidate = before.edited(changes.clone())?;
        if candidate == before {
            return Ok(None);
        }
        for scene in &candidate.scenes {
            let old = before
                .scenes
                .iter()
                .find(|old| old.scene_ref == scene.scene_ref)
                .and_then(|old| old.presentation.as_ref())
                .map(|old| &old.scene["procedural"]);
            let new = scene.presentation.as_ref().map(|p| &p.scene["procedural"]);
            if old != new
                && (old.is_some_and(|v| !v.is_null()) || new.is_some_and(|v| !v.is_null()))
            {
                return Err("Ordinary edits cannot author procedural attribution or native source qualifications".into());
            }
        }
        let operation_ref = format!(
            "native-manual:{:x}",
            Sha256::digest(serde_json::to_vec(request).map_err(|e| e.to_string())?)
        );
        let mut entries = Vec::new();
        let mut seen = BTreeMap::<String, Value>::new();
        for scene in &before.scenes {
            let Some(rows) = scene
                .presentation
                .as_ref()
                .and_then(|p| p.scene["procedural"]["contributions"].as_array())
            else {
                continue;
            };
            for contribution in rows.iter().filter(|row| row["status"] == "active") {
                let reference = retained_text(contribution, "contribution_ref")?.to_owned();
                if let Some(prior) = seen.insert(reference.clone(), contribution.clone()) {
                    if prior != *contribution {
                        return Err("Conflicting original contribution projections".into());
                    }
                    continue;
                }
                let owned: Vec<Address> =
                    serde_json::from_value(contribution["owned_addresses"].clone())
                        .map_err(|e| e.to_string())?;
                if owned.is_empty() {
                    return Err("Original contribution lacks native ownership".into());
                }
                let whole = owned
                    .iter()
                    .all(|a| a.component == Component::Expression && a.property.is_none());
                let affected = if whole {
                    flow(&before) != flow(&candidate)
                } else {
                    owned
                        .iter()
                        .any(|a| addressed(&before, a).ok() != addressed(&candidate, a).ok())
                };
                if !affected {
                    continue;
                }
                let procedure = retained_text(contribution, "procedure_ref")?.to_owned();
                if !self
                    .procedural_runtime
                    .output_readings(&before, &procedure)?
                    .iter()
                    .any(|row| row["contribution_ref"] == reference)
                {
                    return Err("Human intervention lacks this current owner's original native source qualification".into());
                }
                let (anchor_ref, source_request) = if whole {
                    if !contribution["generated_basis"]["native_flow"].is_array() {
                        return Err("Whole contribution is not a native flow owner".into());
                    }
                    (
                        None,
                        json!({"action":"flow_interventions","edit":{"expression_ref":expression_ref,"contribution_ref":reference,"owned_addresses":owned,
                        "before":flow(&before),"after":flow(&candidate),"actor_ref":actor,"operation_ref":operation_ref,"document_revision":candidate.revision,
                        "retained_native_records":contribution["authored_overrides"]}}),
                    )
                } else {
                    let parameter_locations =
                        if contribution["generated_basis"]["parameter"].is_string() {
                            Some(source_parameter_addresses(&before, contribution)?)
                        } else {
                            None
                        };
                    let location = parameter_locations.as_ref().unwrap_or(&owned)[0]
                        .scene_ref
                        .as_ref()
                        .ok_or("Material ownership has no native Scene")?;
                    if parameter_locations.is_none()
                        && owned.iter().any(|a| a.scene_ref.as_ref() != Some(location))
                    {
                        return Err("One native material intervention spans foreign Scenes".into());
                    }
                    let original = before
                        .scenes
                        .iter()
                        .find(|s| &s.scene_ref == location)
                        .ok_or("Original owned Scene unavailable")?;
                    let next = candidate.scenes.iter().find(|s| &s.scene_ref == location);
                    let mut entity_refs = BTreeMap::<String, String>::new();
                    for document in [&before, &candidate] {
                        let Some(current) =
                            document.scenes.iter().find(|s| &s.scene_ref == location)
                        else {
                            continue;
                        };
                        entity_refs.extend(scene_entity_refs(document, current)?);
                    }
                    let edit = json!({"expression_ref":expression_ref,"scene_ref":location,"contribution_ref":reference,"owned_addresses":owned,"entity_refs":entity_refs,
                        "before":material(original)?,"after":next.map(material).transpose()?.unwrap_or(Value::Null),"actor_ref":actor,"operation_ref":operation_ref,
                        "document_revision":candidate.revision,"retained_overlays":[],"retained_native_records":contribution["authored_overrides"]});
                    if next.is_none() {
                        let (anchor, request) =
                            deletion_request(&before, &candidate, contribution, edit)?;
                        (Some(anchor), request)
                    } else {
                        (None, json!({"action":"interventions_owned","edit":edit}))
                    }
                };
                entries.push(ManualEntry {
                    procedure_ref: procedure,
                    expression_ref: expression_ref.clone(),
                    request: source_request,
                    contribution: contribution.clone(),
                    anchor_ref,
                });
            }
        }
        if entries.is_empty() {
            return Ok(None);
        }
        if entries.len() > 64 {
            return Err("Native source intervention batch budget exceeded".into());
        }
        Ok(Some(ManualCandidate {
            before,
            candidate,
            original: request.clone(),
            actor: actor.clone(),
            operation_ref,
            entries,
        }))
    }

    pub(crate) fn finish_procedural_manual_edit(
        &mut self,
        client: &CentralClient,
        prepared: ManualCandidate,
        actual: ManualBatchRecords,
    ) -> Result<(Value, Option<Changed>), String> {
        if self.document(&prepared.before.expression_ref)? != &prepared.before {
            return Err(
                "Original edit basis changed during source preflight; retain the exact intent"
                    .into(),
            );
        }
        for entry in &prepared.entries {
            if !self
                .procedural_runtime
                .output_readings(&prepared.before, &entry.procedure_ref)?
                .iter()
                .any(|row| row["contribution_ref"] == entry.contribution["contribution_ref"])
            {
                return Err("The actual native output qualification retired during intervention Source work".into());
            }
        }
        if actual.results.len() != prepared.entries.len()
            || actual.native_reply["schema"] != "oi.expression-procedure-source-response/v1"
            || actual.native_reply["native_result"]["schema"] != "ql.scene-procedural-response/v1"
            || actual.native_reply["native_result"]["operation"] != "intervention_batch"
            || actual.native_reply["native_result"]["result"]["schema"]
                != "ql.procedural-intervention-batch/v1"
            || actual.native_reply["native_result"]["result"]["results"] != json!(actual.results)
        {
            return Err(
                "Native source did not acknowledge the exact original intervention batch".into(),
            );
        }
        let mut candidate = prepared.candidate;
        let accepted = candidate.clone();
        for (entry, result) in prepared.entries.iter().zip(actual.results) {
            let attribution = if entry.anchor_ref.is_some() {
                &result["attribution"]
            } else {
                &result
            };
            if attribution["schema"] != "ql.procedural-manual-interventions/v1" {
                return Err("Native intervention result has another schema".into());
            }
            let records = attribution["native_records"]
                .as_array()
                .ok_or("Native intervention records missing")?;
            if records.len() > 2048 {
                return Err("Native intervention record bound exceeded".into());
            }
            let owned: Vec<Address> =
                serde_json::from_value(entry.contribution["owned_addresses"].clone())
                    .map_err(|e| e.to_string())?;
            let prior = entry.contribution["authored_overrides"]
                .as_array()
                .ok_or("Original protected authored interventions unavailable")?;
            let mut paths = BTreeSet::new();
            for record in records {
                let address: Address =
                    serde_json::from_value(record["address"].clone()).map_err(|e| e.to_string())?;
                let unchanged = prior.contains(record);
                let path = record["path"]
                    .as_str()
                    .filter(|path| path.starts_with('/') && path.len() <= 4096)
                    .ok_or("Native intervention stable path missing")?;
                if !paths.insert(path.to_owned()) {
                    return Err("Native intervention duplicated an original stable path".into());
                }
                if (!unchanged
                    && (record["actor"] != prepared.actor
                        || record["operation_ref"] != prepared.operation_ref
                        || record["revision"].as_u64() != Some(accepted.revision)
                        || record["persistent"] != true))
                    || !matches!(
                        record["kind"].as_str(),
                        Some("set" | "create" | "delete" | "reorder")
                    )
                    || !record["path"]
                        .as_str()
                        .is_some_and(|p| p.starts_with('/') && p.len() <= 4096)
                    || !owned.iter().any(|a| covers(a, &address))
                    || (!unchanged
                        && (canonical_address(&prepared.before, &address).is_err()
                            && canonical_address(&accepted, &address).is_err()))
                {
                    return Err("Native intervention differs from actual actor, operation, ownership or candidate CAS".into());
                }
            }
            if prior
                .iter()
                .any(|old| !records.iter().any(|record| record["path"] == old["path"]))
            {
                return Err("Native preflight lost an earlier retained human intervention".into());
            }
            if let Some(anchor) = &entry.anchor_ref {
                let scope: Vec<Address> = serde_json::from_value(result["metadata_scope"].clone())
                    .map_err(|e| e.to_string())?;
                if result["schema"] != "ql.procedural-scene-deletion/v1"
                    || scope
                        != vec![address(
                            &prepared.before,
                            Some(anchor),
                            None,
                            Component::Scene,
                        )]
                {
                    return Err(
                        "Deletion metadata scope differs from original canonical source anchor"
                            .into(),
                    );
                }
                let changes: Vec<Change> =
                    serde_json::from_value(result["changes"].clone()).map_err(|e| e.to_string())?;
                if changes.len() != 2
                    || !matches!(&changes[1],Change::SceneRemove{scene_ref} if Some(scene_ref.as_str())==entry.contribution["occurrence_ref"].as_str())
                {
                    return Err("Native deletion changes another original occurrence".into());
                }
                let Change::SceneMaterialSet {
                    scene_ref,
                    presentation,
                } = &changes[0]
                else {
                    return Err("Native deletion omitted source anchor metadata".into());
                };
                if scene_ref != anchor {
                    return Err("Deletion chose another canonical anchor".into());
                }
                let scene = candidate
                    .scenes
                    .iter_mut()
                    .find(|s| &s.scene_ref == anchor)
                    .ok_or("Actual source anchor disappeared")?;
                let mut proposed = serde_json::to_value(presentation).map_err(|e| e.to_string())?;
                proposed["scene"]
                    .as_object_mut()
                    .ok_or("Invalid source anchor material")?
                    .remove("procedural");
                if proposed != material(scene)? {
                    return Err(
                        "Deletion preflight changed actual authored source anchor material".into(),
                    );
                }
                let row = presentation.scene["procedural"]["contributions"]
                    .as_array()
                    .and_then(|rows| {
                        rows.iter().find(|r| {
                            r["contribution_ref"] == entry.contribution["contribution_ref"]
                        })
                    })
                    .ok_or("Deletion anchor omitted original contribution")?;
                let mut expected = entry.contribution.clone();
                expected["status"] = json!("detached");
                expected["authored_overrides"] = json!(records);
                if *row != expected {
                    return Err(
                        "Deletion anchor changed stable contribution identity or generated basis"
                            .into(),
                    );
                }
                // Merge only this source-owned row. Other simultaneous native
                // preflight entries retain their own original projection.
                let stored = scene
                    .presentation
                    .as_mut()
                    .ok_or("Source anchor material unavailable")?
                    .scene["procedural"]["contributions"]
                    .as_array_mut()
                    .ok_or("Source anchor contributions unavailable")?;
                let current = stored
                    .iter_mut()
                    .find(|r| r["contribution_ref"] == expected["contribution_ref"])
                    .ok_or("Source anchor contribution unavailable")?;
                *current = expected;
            } else {
                for scene in &mut candidate.scenes {
                    let Some(rows) = scene
                        .presentation
                        .as_mut()
                        .and_then(|p| p.scene["procedural"]["contributions"].as_array_mut())
                    else {
                        continue;
                    };
                    if let Some(row) = rows
                        .iter_mut()
                        .find(|r| r["contribution_ref"] == entry.contribution["contribution_ref"])
                    {
                        let stored = row["authored_overrides"]
                            .as_array_mut()
                            .ok_or("Native authored interventions unavailable")?;
                        for record in records {
                            stored.retain(|old| old["path"] != record["path"]);
                            stored.push(record.clone());
                        }
                    }
                }
            }
        }
        candidate.validate()?;
        let ExpressionRequest::Edit {
            expression_ref,
            expected_revision,
            actor,
            changes,
        } = prepared.original
        else {
            return Err("Original native edit missing".into());
        };
        let mut combined = Vec::new();
        // Anchor metadata precedes true removal/flow/native parameter effects.
        // Use the ORIGINAL presentation here so the later actual edit remains
        // the owner of every authored value and unit conversion.
        for scene in &candidate.scenes {
            let Some(original) = prepared
                .before
                .scenes
                .iter()
                .find(|s| s.scene_ref == scene.scene_ref)
            else {
                continue;
            };
            let Some(before) = &original.presentation else {
                continue;
            };
            let Some(after) = &scene.presentation else {
                continue;
            };
            if before.scene["procedural"] != after.scene["procedural"] {
                let mut presentation = before.clone();
                presentation.scene["procedural"] = after.scene["procedural"].clone();
                combined.push(Change::SceneMaterialSet {
                    scene_ref: scene.scene_ref.clone(),
                    presentation,
                });
            }
        }
        // A full user SceneMaterialSet also carries its old procedural value;
        // insert this same accepted attribution without changing user material.
        for mut change in changes {
            if let Change::SceneMaterialSet {
                scene_ref,
                presentation,
            } = &mut change
            {
                if let Some(scene) = candidate.scenes.iter().find(|s| &s.scene_ref == scene_ref) {
                    if let Some(actual) = &scene.presentation {
                        presentation.scene["procedural"] = actual.scene["procedural"].clone();
                    }
                }
            }
            combined.push(change);
        }
        if combined.len() > super::super::LIMIT {
            return Err("Attributed edit exceeds the existing native change budget".into());
        }
        self.procedural_runtime.owner_write = true;
        let result = self.apply(
            client,
            ExpressionRequest::Edit {
                expression_ref,
                expected_revision,
                actor,
                changes: combined,
            },
        );
        self.procedural_runtime.owner_write = false;
        let (mut data, changed) = result?;
        data["native_procedural_receipts"] = json!([]);
        data["native_procedural_source"] = actual.native_reply;
        Ok((data, changed))
    }
}
