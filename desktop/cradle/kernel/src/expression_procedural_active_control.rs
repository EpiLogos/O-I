//! Joined Source attribution for an actual ordinary Edit. The native Document
//! supplies both accepted material and Parameter values; Source alone derives
//! controlled leaves and retained intervention paths.
use super::*;

#[derive(Debug)]
pub(super) struct Target {
    entity_ref: String,
    parameter: String,
    procedure_ref: String,
    addresses: Vec<Address>,
    legacy: bool,
    legacy_candidates: Vec<String>,
}
#[derive(Debug)]
pub(super) struct Plan {
    targets: Vec<Target>,
    pub(super) contributions: BTreeSet<String>,
    controls: BTreeSet<Address>,
}
fn rows<'a>(document: &'a Document, scene_ref: &str, key: &str) -> Result<&'a [Value], String> {
    document
        .scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .and_then(|s| s.presentation.as_ref())
        .and_then(|p| p.scene["procedural"][key].as_array())
        .map(Vec::as_slice)
        .ok_or_else(|| format!("Actual retained {key} unavailable"))
}
fn parameter_for(
    document: &Document,
    control: &Value,
    address: &Address,
) -> Result<String, String> {
    let entity = address
        .entity_ref
        .as_deref()
        .ok_or("Active control has no native Entity")?;
    let scene = address
        .scene_ref
        .as_deref()
        .ok_or("Active control has no native Scene")?;
    let native = document
        .entities
        .get(entity)
        .ok_or("Active control Entity unavailable")?;
    let matches = native
        .parameters
        .keys()
        .filter(|key| {
            control
                .get("parameter")
                .is_none_or(|p| p.as_str() == Some(key.as_str()))
                && source_parameter_location(document, scene, entity, key)
                    .is_ok_and(|a| a == *address)
        })
        .collect::<Vec<_>>();
    if matches.len() != 1 {
        return Err("Active control lacks one exact native Parameter coordinate".into());
    }
    validate_native_control_target(control, entity, matches[0])?;
    Ok(matches[0].clone())
}
pub(super) fn plan(
    _application: &Application,
    before: &Document,
    candidate: &Document,
) -> Result<Option<Plan>, String> {
    let changed_scenes = before
        .scenes
        .iter()
        .filter(|s| {
            candidate
                .scenes
                .iter()
                .find(|n| n.scene_ref == s.scene_ref)
                .is_none_or(|n| n.presentation != s.presentation)
        })
        .map(|s| s.scene_ref.as_str())
        .collect::<BTreeSet<_>>();
    let mut retained = BTreeMap::<Address, &Value>::new();
    let mut keys = BTreeSet::new();
    for scene in &before.scenes {
        for row in scene
            .presentation
            .as_ref()
            .and_then(|p| p.scene["procedural"]["controls"].as_array())
            .into_iter()
            .flatten()
        {
            // Existing authored Field and other non-Parameter controls retain
            // their own owner. They are not native Parameter refresh targets.
            let base = row.get("native_base").is_some();
            let native_value = row["takeover"].get("native_value").is_some();
            if !base && !native_value {
                continue;
            }
            if base != native_value {
                return Err(
                    "Original native control lost its paired baseline/value identity".into(),
                );
            }
            if retained.len() >= MAX_TARGETS {
                return Err("Active control native address bound exceeded".into());
            }
            let address: Address =
                serde_json::from_value(row["address"].clone()).map_err(|e| e.to_string())?;
            if canonical_native_scalar_address(before, &address)? != address
                || address.scene_ref.as_deref() != Some(scene.scene_ref.as_str())
                || row["takeover"].is_null()
                || retained.insert(address.clone(), row).is_some()
            {
                return Err("Active control is not one original canonical manifestation".into());
            }
            let entity = address
                .entity_ref
                .as_deref()
                .ok_or("Active control Entity unavailable")?;
            let parameter = parameter_for(before, row, &address)?;
            let old = before
                .entities
                .get(entity)
                .and_then(|e| e.parameters.get(&parameter));
            let new = candidate
                .entities
                .get(entity)
                .and_then(|e| e.parameters.get(&parameter));
            if changed_scenes.contains(scene.scene_ref.as_str()) || old != new {
                keys.insert((entity.to_owned(), parameter));
            }
        }
    }
    if keys.is_empty() {
        return Ok(None);
    }
    // Close the cohort over every control in each actual global manifestation.
    // Source can reconcile a sibling's dormant rows; every such sibling must
    // have its own exact live qualification, never authority inferred from a
    // returned coverage array.
    loop {
        let scenes = before
            .scenes
            .iter()
            .filter(|s| {
                keys.iter()
                    .any(|(entity, _)| s.entity_refs.contains(entity))
            })
            .map(|s| s.scene_ref.as_str())
            .collect::<BTreeSet<_>>();
        let prior = keys.len();
        for (address, row) in &retained {
            if address
                .scene_ref
                .as_deref()
                .is_some_and(|s| scenes.contains(s))
            {
                keys.insert((
                    address.entity_ref.clone().ok_or("Active Entity missing")?,
                    parameter_for(before, row, address)?,
                ));
            }
        }
        if keys.len() > 64 {
            return Err("Joined active control count exceeded before Source allocation".into());
        }
        if keys.len() == prior {
            break;
        }
    }
    let mut targets = Vec::new();
    let mut controls = BTreeSet::new();
    let mut contributions = BTreeSet::new();
    for (entity_ref, parameter) in keys {
        let mut addresses = Vec::new();
        let mut explicit = None;
        let mut legacy = false;
        for scene in before
            .scenes
            .iter()
            .filter(|s| s.entity_refs.contains(&entity_ref))
        {
            let address =
                source_parameter_location(before, &scene.scene_ref, &entity_ref, &parameter)?;
            let row = retained
                .get(&address)
                .ok_or("Shared native Parameter lacks its original control at every Scene")?;
            if candidate
                .scenes
                .iter()
                .find(|s| s.scene_ref == scene.scene_ref)
                .is_none_or(|s| !s.entity_refs.contains(&entity_ref) || s.presentation.is_none())
            {
                return Err(
                    "Release the actual control before removing its native manifestation".into(),
                );
            }
            if let Some(reference) = row.get("procedure_ref") {
                let reference = reference
                    .as_str()
                    .ok_or("Original control procedure identity invalid")?;
                if explicit.as_deref().is_some_and(|old| old != reference) {
                    return Err(
                        "Shared control has conflicting original procedure identities".into(),
                    );
                }
                explicit = Some(reference.to_owned());
            } else {
                legacy = true;
            }
            controls.insert(address.clone());
            addresses.push(address);
        }
        addresses.sort();
        let legacy_candidates = if legacy {
            let mut eligible = BTreeSet::new();
            for scene in &before.scenes {
                for row in scene
                    .presentation
                    .as_ref()
                    .and_then(|p| p.scene["procedural"]["procedures"].as_array())
                    .into_iter()
                    .flatten()
                {
                    let reference = retained_text(row, "procedure_ref")?;
                    // Names only: no native Source read or qualification is
                    // attempted before the aggregate byte/count prepass.
                    definition_ref(before, reference)?;
                    eligible.insert(reference.to_owned());
                }
            }
            eligible.into_iter().collect()
        } else {
            Vec::new()
        };
        let procedure_ref = if legacy {
            explicit.unwrap_or_default()
        } else {
            explicit.ok_or("Original control Procedure missing")?
        };
        if !procedure_ref.is_empty() {
            definition_ref(before, &procedure_ref)?;
        }
        for address in &addresses {
            for row in rows(
                before,
                address.scene_ref.as_deref().unwrap(),
                "contributions",
            )? {
                if row["status"] != "active" {
                    continue;
                }
                if row["generated_basis"]["native_flow"].is_array() {
                    continue;
                }
                let owned: Vec<Address> = serde_json::from_value(row["owned_addresses"].clone())
                    .map_err(|e| e.to_string())?;
                if owned.iter().any(|a| covers(a, address)) {
                    let reference = retained_text(row, "contribution_ref")?;
                    contributions.insert(reference.to_owned());
                }
            }
        }
        targets.push(Target {
            entity_ref,
            parameter,
            procedure_ref,
            addresses,
            legacy,
            legacy_candidates,
        });
    }
    Ok(Some(Plan {
        targets,
        contributions,
        controls,
    }))
}
pub(super) fn charge(
    plan: &Plan,
    before: &Document,
    candidate: &Document,
    actor: &str,
    operation: &str,
    budget: &mut budget::Budget,
) -> Result<(), String> {
    for target in &plan.targets {
        budget.reserve(4096)?;
        if target.legacy {
            for reference in &target.legacy_candidates {
                let definition = definition_ref(before, reference)?;
                budget.value(definition)?;
                budget.value(definition)?;
            }
        } else {
            budget.value(definition_ref(before, &target.procedure_ref)?)?;
        }
        budget.value(&target.addresses)?;
        budget.value(&target.entity_ref)?;
        budget.value(&target.parameter)?;
        budget.value(actor)?;
        budget.value(operation)?;
        budget.value(&before.expression_ref)?;
        budget.value(&before.revision)?;
        for document in [before, candidate] {
            let native = document
                .entities
                .get(&target.entity_ref)
                .and_then(|e| e.parameters.get(&target.parameter))
                .ok_or("Current native active Parameter unavailable")?;
            budget.value(native)?;
        }
        for address in &target.addresses {
            let scene_ref = address
                .scene_ref
                .as_deref()
                .ok_or("Current active Scene unavailable")?;
            for document in [before, candidate] {
                let presentation = document
                    .scenes
                    .iter()
                    .find(|s| s.scene_ref == scene_ref)
                    .and_then(|s| s.presentation.as_ref())
                    .ok_or("Current active material unavailable")?;
                budget.value(presentation)?;
            }
            let presentation = before
                .scenes
                .iter()
                .find(|s| s.scene_ref == scene_ref)
                .and_then(|s| s.presentation.as_ref())
                .unwrap();
            budget.entity_refs(presentation)?;
        }
    }
    Ok(())
}
pub(super) fn qualify(
    application: &Application,
    plan: &mut Plan,
    before: &Document,
) -> Result<(), String> {
    for target in &mut plan.targets {
        if target.legacy {
            let qualified = target
                .legacy_candidates
                .iter()
                .filter(|reference| {
                    control::current_procedure_ref(
                        application,
                        before,
                        reference,
                        &target.addresses,
                    )
                    .is_ok()
                })
                .collect::<Vec<_>>();
            if qualified.len() != 1 {
                return Err(
                    "Legacy control requires exactly one current qualified full original Procedure"
                        .into(),
                );
            }
            let reference = qualified[0];
            if !target.procedure_ref.is_empty() && &target.procedure_ref != reference {
                return Err("Legacy and explicit shared control identities differ".into());
            }
            target.procedure_ref = reference.clone();
        } else {
            control::current_procedure_ref(
                application,
                before,
                &target.procedure_ref,
                &target.addresses,
            )?;
        }
    }
    reattest(application, plan, before)
}
pub(super) fn entry(
    application: &Application,
    plan: &Plan,
    before: &Document,
    candidate: &Document,
    actor: &str,
    operation: &str,
) -> Result<ManualEntry, String> {
    let mut inputs = Vec::new();
    for target in &plan.targets {
        let definition = control::current_procedure(
            application,
            before,
            &target.procedure_ref,
            &target.addresses,
        )?;
        let mut reading =
            source_parameter_driver(before, &target.entity_ref, &target.parameter, None)?;
        if reading["addresses"] != json!(target.addresses) {
            return Err("Actual native active Parameter locations changed".into());
        }
        reading["qualified_legacy_procedures"] = if target.legacy {
            json!([definition])
        } else {
            json!([])
        };
        for scene in reading["scenes"]
            .as_array_mut()
            .ok_or("Native driver Scenes unavailable")?
        {
            let reference = scene["scene_ref"]
                .as_str()
                .ok_or("Native driver Scene identity missing")?;
            let actual = candidate
                .scenes
                .iter()
                .find(|s| s.scene_ref == reference)
                .and_then(|s| s.presentation.as_ref())
                .ok_or("Actual accepted active-control Scene unavailable")?;
            let mut value = serde_json::to_value(actual).map_err(|e| e.to_string())?;
            if value["scene"]["procedural"].is_object() {
                value["scene"]["procedural"]["operations"] = json!([]);
            }
            scene["parameter_candidate"] = value;
        }
        inputs.push(json!({"procedure":definition,"reading":reading,
            "candidate_native_parameter":candidate.entities[&target.entity_ref].parameters[&target.parameter],"actor_ref":actor,"operation_ref":operation}));
    }
    Ok(ManualEntry {
        procedure_ref: String::new(),
        expression_ref: before.expression_ref.clone(),
        request: json!({"action":"active_controls_refresh","inputs":inputs}),
        contribution: Value::Null,
        anchor_ref: None,
    })
}
pub(super) fn reattest(
    application: &Application,
    plan: &Plan,
    before: &Document,
) -> Result<(), String> {
    for target in &plan.targets {
        control::current_procedure_ref(
            application,
            before,
            &target.procedure_ref,
            &target.addresses,
        )?;
    }
    for reference in &plan.contributions {
        let row = source_current_contribution(before, reference)?;
        if !application
            .procedural_runtime
            .output_readings(before, retained_text(row, "procedure_ref")?)?
            .iter()
            .any(|r| r["contribution_ref"] == *reference)
        {
            return Err(
                "Joined current native contribution qualification retired during Source work"
                    .into(),
            );
        }
    }
    Ok(())
}
fn strings(value: &Value) -> Result<BTreeSet<String>, String> {
    let rows = value
        .as_array()
        .ok_or("Source named contribution coverage missing")?;
    let mut set = BTreeSet::new();
    for row in rows {
        if !set.insert(
            row.as_str()
                .ok_or("Source named contribution identity invalid")?
                .to_owned(),
        ) {
            return Err("Duplicate Source named contribution coverage".into());
        }
    }
    Ok(set)
}
fn addresses(value: &Value) -> Result<BTreeSet<Address>, String> {
    let rows: Vec<Address> = serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
    let set: BTreeSet<_> = rows.iter().cloned().collect();
    if set.len() != rows.len() {
        return Err("Duplicate Source named control coverage".into());
    }
    Ok(set)
}
fn contribution_records(
    before: &Document,
    candidate: &Document,
    old: &Value,
    new: &Value,
    actor: &str,
    operation: &str,
    plan: &Plan,
) -> Result<(), String> {
    let mut expected = old.clone();
    expected["authored_overrides"] = new["authored_overrides"].clone();
    if &expected != new {
        return Err(
            "Joined Source changed stable contribution identity, scope or generated basis".into(),
        );
    }
    let native = new["authored_overrides"]
        .as_array()
        .ok_or("Joined Source native intervention rows missing")?;
    let prior = old["authored_overrides"]
        .as_array()
        .ok_or("Original native intervention rows missing")?;
    if native.len() > 2048 {
        return Err("Joined native intervention bound exceeded".into());
    }
    let owned: Vec<Address> =
        serde_json::from_value(old["owned_addresses"].clone()).map_err(|e| e.to_string())?;
    let mut paths = BTreeSet::new();
    for row in native {
        let address: Address =
            serde_json::from_value(row["address"].clone()).map_err(|e| e.to_string())?;
        let path = row["path"]
            .as_str()
            .filter(|p| p.starts_with('/') && p.len() <= 4096)
            .ok_or("Joined intervention stable path invalid")?;
        if !paths.insert(path) || !owned.iter().any(|a| covers(a, &address)) {
            return Err("Joined intervention path/ownership differs".into());
        }
        if prior.contains(row) {
            continue;
        }
        let gesture = plan.controls.iter().any(|target| {
            (covers(target, &address) || covers(&address, target))
                && target.scene_ref.as_deref().is_some_and(|scene| {
                    rows(before, scene, "controls").is_ok_and(|controls| {
                        controls.iter().any(|c| {
                            c["address"] == json!(target) && c["takeover"]["lifetime"] == "gesture"
                        })
                    })
                })
        });
        if row["actor"] != actor
            || row["operation_ref"] != operation
            || row["revision"].as_u64() != Some(candidate.revision)
            || row["persistent"] != json!(!gesture)
            || !matches!(
                row["kind"].as_str(),
                Some("set" | "create" | "delete" | "reorder")
            )
            || (canonical_address(before, &address).is_err()
                && canonical_address(candidate, &address).is_err())
        {
            return Err("Joined intervention differs from actual actor, operation, lifetime or accepted CAS".into());
        }
    }
    if prior
        .iter()
        .any(|old| !native.iter().any(|new| new["path"] == old["path"]))
    {
        return Err("Joined Source lost an earlier native intervention".into());
    }
    Ok(())
}
fn control_row(
    plan: &Plan,
    before: &Document,
    candidate: &Document,
    old: &Value,
    new: &Value,
    address: &Address,
    actor: &str,
    operation: &str,
) -> Result<(), String> {
    let target = plan
        .targets
        .iter()
        .find(|t| t.addresses.contains(address))
        .ok_or("Source named control lacks exact qualified native target")?;
    let mut identity = old.clone();
    for key in [
        "procedure_ref",
        "parameter",
        "takeover",
        "dormant_overrides",
    ] {
        identity[key] = new[key].clone();
    }
    if &identity != new
        || new["procedure_ref"] != target.procedure_ref
        || new["parameter"] != target.parameter
    {
        return Err(
            "Joined Source changed retained native control baseline, drivers or identity".into(),
        );
    }
    let lifetime = old["takeover"]
        .get("lifetime_operation_ref")
        .unwrap_or(&old["takeover"]["operation_ref"]);
    if new["takeover"]["native_value"]
        != candidate.entities[&target.entity_ref].parameters[&target.parameter].value
        || new["takeover"]["lifetime"] != old["takeover"]["lifetime"]
        || &new["takeover"]["lifetime_operation_ref"] != lifetime
        || new["takeover"]["actor"] != actor
        || new["takeover"]["operation_ref"] != operation
        || new["takeover"]["revision"].as_u64() != Some(candidate.revision)
    {
        return Err(
            "Joined control differs from original lifetime or actual native candidate".into(),
        );
    }
    let old_dormant = old["dormant_overrides"]
        .as_array()
        .ok_or("Original dormant control contributions missing")?;
    let new_dormant = new["dormant_overrides"]
        .as_array()
        .ok_or("Joined dormant control contributions missing")?;
    if old_dormant.len() != new_dormant.len() {
        return Err("Joined control lost original dormant contribution identities".into());
    }
    for (old, new) in old_dormant.iter().zip(new_dormant) {
        let mut identity = old.clone();
        for key in ["overrides", "takeover_overrides"] {
            identity[key] = new[key].clone();
        }
        if &identity != new
            || (old != new
                && !plan
                    .contributions
                    .contains(retained_text(new, "contribution_ref")?))
        {
            return Err(
                "Joined dormant control metadata exceeds original qualified contribution coverage"
                    .into(),
            );
        }
    }
    // Re-attested before Source and again at admission; saved control labels
    // never confer this original live Procedure qualification.
    let _ = before;
    Ok(())
}
pub(super) fn merge(
    plan: &Plan,
    before: &Document,
    candidate: &mut Document,
    result: &Value,
    actor: &str,
    operation: &str,
) -> Result<(), String> {
    let expected_definitions = plan
        .targets
        .iter()
        .map(|t| {
            Ok((
                t.procedure_ref.clone(),
                definition_ref(before, &t.procedure_ref)?.clone(),
            ))
        })
        .collect::<Result<BTreeMap<_, _>, String>>()?
        .into_values()
        .collect::<Vec<_>>();
    if result["schema"] != "ql.procedural-active-controls-refresh/v1"
        || result["original_procedures"] != json!(expected_definitions)
        || result["operation_ref"] != operation
        || result["accepted_revision"].as_u64() != Some(candidate.revision)
        || addresses(&result["resolved_scope"])? != plan.controls
        || addresses(&result["managed_control_addresses"])? != plan.controls
        || strings(&result["managed_contribution_refs"])? != plan.contributions
    {
        return Err(
            "Joined Source reply differs from complete original native control/contribution cohort"
                .into(),
        );
    }
    let source_edit: ExpressionRequest =
        serde_json::from_value(result["native_edit"].clone()).map_err(|e| e.to_string())?;
    let ExpressionRequest::Edit {
        expression_ref,
        expected_revision,
        actor: source_actor,
        changes,
    } = source_edit
    else {
        return Err("Joined Source metadata omitted actual native Edit".into());
    };
    if expression_ref != before.expression_ref
        || expected_revision != before.revision
        || source_actor != actor
    {
        return Err("Joined Source metadata changed original native actor/CAS".into());
    }
    let coverage = result["scene_coverage"]
        .as_array()
        .ok_or("Joined Source per-Scene coverage missing")?;
    if coverage.len() != changes.len() {
        return Err("Joined Source Scene metadata cardinality differs".into());
    }
    let expected_scenes = plan
        .controls
        .iter()
        .filter_map(|a| a.scene_ref.clone())
        .collect::<BTreeSet<_>>();
    let mut seen = BTreeSet::new();
    for change in changes {
        let Change::SceneMaterialSet {
            scene_ref,
            presentation,
        } = change
        else {
            return Err("Joined Source attempted a second authored native operation".into());
        };
        if !expected_scenes.contains(&scene_ref) || !seen.insert(scene_ref.clone()) {
            return Err("Joined Source changed another or duplicate Scene".into());
        }
        let current = candidate
            .scenes
            .iter()
            .find(|s| s.scene_ref == scene_ref)
            .ok_or("Actual accepted Scene disappeared")?;
        let mut proposed = serde_json::to_value(&presentation).map_err(|e| e.to_string())?;
        proposed["scene"]
            .as_object_mut()
            .ok_or("Joined Source Scene body missing")?
            .remove("procedural");
        if proposed != scene_material(current)? {
            return Err("Joined Source changed actual accepted authored material".into());
        }
        let expected_controls = plan
            .controls
            .iter()
            .filter(|a| a.scene_ref.as_deref() == Some(scene_ref.as_str()))
            .cloned()
            .collect::<BTreeSet<_>>();
        let mut expected_refs = BTreeSet::new();
        for row in rows(before, &scene_ref, "contributions")? {
            let owned: Vec<Address> = serde_json::from_value(row["owned_addresses"].clone())
                .map_err(|e| e.to_string())?;
            if row["status"] == "active"
                && !row["generated_basis"]["native_flow"].is_array()
                && owned
                    .iter()
                    .any(|a| expected_controls.iter().any(|t| covers(a, t)))
            {
                expected_refs.insert(retained_text(row, "contribution_ref")?.to_owned());
            }
        }
        let matching = coverage
            .iter()
            .filter(|c| c["scene_ref"] == scene_ref)
            .collect::<Vec<_>>();
        if matching.len() != 1
            || strings(&matching[0]["managed_contribution_refs"])? != expected_refs
            || addresses(&matching[0]["managed_control_addresses"])? != expected_controls
        {
            return Err("Joined Source per-Scene named metadata coverage differs".into());
        }
        let actual_retention = &current
            .presentation
            .as_ref()
            .ok_or("Actual native retention missing")?
            .scene["procedural"];
        let mut retention = actual_retention.clone();
        let source_retention = &presentation.scene["procedural"];
        for key in ["contributions", "controls"] {
            let original = rows(candidate, &scene_ref, key)?;
            let incoming = source_retention[key]
                .as_array()
                .ok_or("Joined Source named rows missing")?;
            if original.len() != incoming.len() {
                return Err("Joined Source changed native retained row cardinality".into());
            }
            let mut merged = original.to_vec();
            for (old, new) in original.iter().zip(incoming) {
                if key == "contributions" {
                    let reference = retained_text(old, "contribution_ref")?;
                    if expected_refs.contains(reference) {
                        contribution_records(before, candidate, old, new, actor, operation, plan)?;
                        let row = merged
                            .iter_mut()
                            .find(|r| r["contribution_ref"] == reference)
                            .unwrap();
                        *row = new.clone();
                    } else if old != new {
                        return Err("Joined Source changed an unrelated contribution".into());
                    }
                } else {
                    let address: Address = serde_json::from_value(old["address"].clone())
                        .map_err(|e| e.to_string())?;
                    if expected_controls.contains(&address) {
                        control_row(
                            plan, before, candidate, old, new, &address, actor, operation,
                        )?;
                        let row = merged
                            .iter_mut()
                            .find(|r| r["address"] == json!(address))
                            .unwrap();
                        *row = new.clone();
                    } else if old != new {
                        return Err("Joined Source changed an unrelated authored control".into());
                    }
                }
            }
            retention[key] = json!(merged);
        }
        // Source sees an intentionally emptied historical operation projection.
        // Keep the real journal in the native document, byte-for-byte.
        let mut normalized = retention.clone();
        normalized["operations"] = json!([]);
        if &normalized != source_retention {
            return Err(
                "Joined Source changed unrelated qualification, journal, flow or continuation"
                    .into(),
            );
        }
        candidate
            .scenes
            .iter_mut()
            .find(|s| s.scene_ref == scene_ref)
            .unwrap()
            .presentation
            .as_mut()
            .unwrap()
            .scene["procedural"] = retention;
    }
    if seen != expected_scenes {
        return Err("Joined Source omitted actual control Scene coverage".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn actual_document() -> Document {
        let expression = "expression:joined-native-control";
        let scene = format!("{expression}:scene:main");
        let entity = format!("{expression}:entity:target");
        let document: Document = serde_json::from_value(json!({
            "schema":"oi.expression/v1","expression_ref":expression,"revision":1,"title":"Joined controls",
            "scenes":[{"scene_ref":scene,"revision":1,"title":"Main","entity_refs":[entity],
                "presentation":{"schema":"oi.journey-scene/v1","scene":{"id":scene,"name":"Main","duration":30,"transition":2,
                    "view":{"mode":"3d","yaw":0,"pitch":0,"zoom":1,"panX":0,"panY":0},
                    "field":{"params":{"opacity":0.42}},"composition":{},"morph":{},"engine":{},"text":[],"automation":[],
                    "entities":[{"id":entity,"kind":"formation","scale":1,"position":{"x":0,"y":0,"z":0},"force":{"strength":0.2}}],
                    "procedural":empty_retention()}}}],
            "entities":{(entity.clone()):{"entity_ref":entity,"revision":1,"title":"Target","subject":null,"parameters":{
                "scale":{"value":1,"automation":null},"force_strength":{"value":0.2,"automation":null}}}},
            "relations":{},"selection":{"scene_ref":scene,"entity_ref":null},"provenance":[],"representations":[]
        })).unwrap();
        document.validate().unwrap();
        document
    }
    fn rename(document: &Document) -> ExpressionRequest {
        let mut presentation = document.scenes[0].presentation.clone().unwrap();
        presentation.scene["name"] = json!("Human revision");
        ExpressionRequest::Edit {
            expression_ref: document.expression_ref.clone(),
            expected_revision: document.revision,
            actor: "human:owner".into(),
            changes: vec![Change::SceneMaterialSet {
                scene_ref: document.scenes[0].scene_ref.clone(),
                presentation,
            }],
        }
    }
    #[test]
    fn existing_authored_field_control_survives_real_ordinary_edit_without_native_parameter_authority()
     {
        let mut document = actual_document();
        let scene = document.scenes[0].scene_ref.clone();
        let field = json!({"address":{"expression_ref":document.expression_ref,"scene_ref":scene,"entity_ref":null,"component":"field","constituent_ref":null,"property":"params.opacity"},
            "target":"field.opacity","authored_base":0,"dormant_lanes":[],"dormant_tracks":[],"suspended_lanes":[],
            "takeover":{"value":0.42,"lifetime":"persistent","actor":"human:existing-field-author","operation_ref":"operation:actual-field-opacity"},
            "source_basis":[],"dormant_overrides":[]});
        document.scenes[0].presentation.as_mut().unwrap().scene["procedural"]["controls"] =
            json!([field]);
        document.validate().unwrap();
        let client = CentralClient::with("/nonexistent/oi".into(), None, String::new());
        let mut application = Application::default();
        application
            .open(document.clone(), "human:owner".into())
            .unwrap();
        let original = rename(&document);
        assert!(
            application
                .prepare_procedural_manual_request(&client, &original)
                .unwrap()
                .is_none()
        );
        let (_, changed) = application.apply(&client, original).unwrap();
        assert!(changed.is_some());
        let actual = application.document(&document.expression_ref).unwrap();
        assert_eq!(actual.revision, document.revision + 1);
        assert_eq!(
            actual.scenes[0].presentation.as_ref().unwrap().scene["procedural"]["controls"],
            json!([field])
        );
        assert_eq!(actual.entities, document.entities);
    }
    #[test]
    fn lost_native_control_baseline_refuses_before_ordinary_document_mutation() {
        let mut document = actual_document();
        let target = source_parameter_location(
            &document,
            &document.scenes[0].scene_ref,
            &document.scenes[0].entity_refs[0],
            "scale",
        )
        .unwrap();
        document.scenes[0].presentation.as_mut().unwrap().scene["procedural"]["controls"] = json!([{
            "address":target,"parameter":"scale","procedure_ref":"procedure:lost-source","target":"scale",
            "takeover":{"value":1,"native_value":1,"lifetime":"gesture","operation_ref":"operation:retained"},"dormant_overrides":[]}]);
        document.validate().unwrap();
        let mut application = Application::default();
        application
            .open(document.clone(), "human:owner".into())
            .unwrap();
        let client = CentralClient::with("/nonexistent/oi".into(), None, String::new());
        let error = application
            .prepare_procedural_manual_request(&client, &rename(&document))
            .unwrap_err();
        assert!(error.contains("paired baseline/value identity"), "{error}");
        assert_eq!(
            application.document(&document.expression_ref).unwrap(),
            &document
        );
    }
    #[test]
    fn native_parameter_coordinates_use_exact_current_scene_and_refuse_foreign_scalar() {
        let document = actual_document();
        let scene = &document.scenes[0].scene_ref;
        let entity = &document.scenes[0].entity_refs[0];
        let driver = source_parameter_driver(&document, entity, "force_strength", None).unwrap();
        assert_eq!(
            driver["addresses"],
            json!([source_parameter_location(&document, scene, entity, "force_strength").unwrap()])
        );
        assert_eq!(driver["native_parameter"]["value"], json!(0.2));
        assert!(
            source_parameter_location(
                &document,
                "expression:foreign:scene:main",
                entity,
                "force_strength"
            )
            .is_err()
        );
        assert!(source_parameter_location(&document, scene, entity, "caption").is_err());
        assert_eq!(driver["scenes"][0]["entity_refs"][entity], json!(entity));
    }
}
