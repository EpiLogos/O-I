//! Apply a privately qualified authored Source edit through the ordinary
//! Document owner. Source owns driver semantics; this owner fences the exact
//! original intent, full CAS, scalar scope, journal and lost-response replay.
use super::*;

#[derive(Clone, Debug)]
pub(super) struct Replay {
    intent: Request,
    pub(super) expression_ref: String,
    applied_revision: u64,
    document_sha256: String,
    response: Value,
    native_outcome: Option<
        std::sync::Arc<crate::native_expression::procedural::authored_driver::OriginalOutcome>,
    >,
    native_owner: crate::native_expression::procedural::authored_driver::ReplayOwner,
}

fn identity(request: &Request) -> Result<(&str, u64, &str), String> {
    let Request::AuthoredDriver {
        expression_ref,
        expected_revision,
        operation_ref,
        ..
    } = request
    else {
        return Err("Another authored mutation intent".into());
    };
    Ok((expression_ref, *expected_revision, operation_ref))
}

impl Application {
    pub(crate) fn has_authored_mutation_replay(&self, request: &Request) -> Result<bool, String> {
        let (_, _, operation_ref) = identity(request)?;
        if let Some(cached) = self.procedural_runtime.authored_controls.get(operation_ref) {
            if &cached.intent != request {
                return Err(
                    "Authored operation identity already has another original intent".into(),
                );
            }
            return Ok(true);
        }
        Ok(false)
    }

    pub(crate) fn replay_authored_mutation(&self, request: &Request) -> Result<Value, String> {
        let (expression_ref, expected_revision, operation_ref) = identity(request)?;
        let document = self.document(expression_ref)?;
        let Some(cached) = self.procedural_runtime.authored_controls.get(operation_ref) else {
            return Ok(
                json!({"schema":SCHEMA,"operation":"authored_driver","original_intent":request,
                "operation_ref":operation_ref,"state":if document.revision!=expected_revision{"revision_conflict"}else{"source_refused"},
                "reason":"Authored mutation requires the private native Source prepare/execute/finish route",
                "document":document,"native_procedural_receipts":[],"replayed":false,"source_current":false,
                "effective_state":"native_consumers_not_yet_observed","cache":{"provenance":"unqualified","restored":true,"replayed":false}}),
            );
        };
        if &cached.intent != request || cached.expression_ref != expression_ref {
            return Err("Authored retry differs from its complete original native intent".into());
        }
        if let Some(original) = &cached.native_outcome {
            if original.original() != request {
                return Err("Original authored custody has another complete intent".into());
            }
            let data = original.original_response()?;
            original.preflight_response(&(data, request))?;
            let mut response = data.clone();
            response["original_state"] = response["state"].clone();
            response["state"] = json!("original_outcome_retained");
            response["replayed"] = json!(true);
            response["source_current"] = json!(false);
            response["recovery_current"] = json!(false);
            response["qualification"] = json!("original_authored_outcome_only");
            response["effective_state"] = json!("native_consumers_not_yet_observed");
            return Ok(response);
        }
        let mut response = cached.response.clone();
        response["source_current"] = json!(false);
        response["replayed"] = json!(true);
        let current = cached.applied_revision == document.revision
            && cached.document_sha256
                == crate::native_expression::procedural::bootstrap::fingerprint(document)?;
        if !current {
            response["state"] = json!("reconciliation_required");
            response["reason"] = json!(
                "The original edit applied, but the current Document has changed; inspect and explicitly requalify"
            );
            response["source_current"] = json!(false);
        }
        // The original full native receipt/channel/Source are retained exactly.
        // A current Document accompanies them; it never restamps their old CAS.
        response["document"] = serde_json::to_value(document).map_err(|e| e.to_string())?;
        response["cache"]["replayed"] = json!(true);
        if current {
            response["native_edit_receipt"]["document"] = response["document"].clone();
        }
        Ok(response)
    }

    pub(crate) fn attach_authored_original_outcome(
        &mut self,
        original: std::sync::Arc<
            crate::native_expression::procedural::authored_driver::OriginalOutcome,
        >,
    ) -> Result<(), String> {
        let (_, _, operation_ref) = identity(original.original())?;
        let Some(cached) = self
            .procedural_runtime
            .authored_controls
            .get_mut(operation_ref)
        else {
            return Ok(());
        };
        if &cached.intent != original.original()
            || original.original_response()?["state"] != "document_applied"
        {
            return Err("Applied authored replay has another original native outcome".into());
        }
        cached.native_outcome = Some(original);
        cached.response = Value::Null;
        Ok(())
    }

    pub(crate) fn authored_replay_owner(
        &self,
        request: &Request,
    ) -> Result<Option<&crate::native_expression::procedural::authored_driver::ReplayOwner>, String>
    {
        let (_, _, operation_ref) = identity(request)?;
        let Some(cached) = self.procedural_runtime.authored_controls.get(operation_ref) else {
            return Ok(None);
        };
        if &cached.intent != request {
            return Err("Authored replay has another original intent".into());
        }
        Ok(Some(&cached.native_owner))
    }

    pub(crate) fn finish_authored_mutation(
        &mut self,
        client: &CentralClient,
        sealed: crate::native_expression::procedural::authored_driver::SealedEdit,
    ) -> Result<(Value, Option<Changed>), String> {
        let before = sealed.before();
        let intent = sealed.intent();
        let Request::AuthoredDriver {
            expression_ref,
            scene_ref,
            procedure_ref,
            expected_procedure_revision,
            actor,
            operation_ref,
            scope,
            catalog_revision,
            ..
        } = intent
        else {
            return Err("Private authored completion has another original operation".into());
        };
        if self.document(expression_ref)? != before {
            return Err("The full authored Document changed during private Source work".into());
        }
        if self.has_authored_mutation_replay(intent)? {
            return Ok((self.replay_authored_mutation(intent)?, None));
        }
        // Account the entire current material, retained Source reply, cache and
        // candidate copies before response/Scene/Document clones allocate.
        let mut cache_budget = budget::Budget::new();
        for cached in self.procedural_runtime.authored_controls.values() {
            cache_budget.value(&cached.response)?;
            cache_budget.value(&cached.intent)?;
        }
        cache_budget.value(&sealed.retained_payload())?;
        cache_budget.value(sealed.preparation())?;
        cache_budget.value(sealed.input())?;
        cache_budget.value(before)?;
        cache_budget.value(before)?;
        cache_budget.reserve(65536)?;
        let reading = &sealed.input()["reading"];
        let prepared = sealed.preparation();
        let shared = reading["schema"] == "ql.authored-expression-driver-reading/v1";
        if shared {
            validate_shared_reading(before, reading)?;
        } else if reading["schema"] != "ql.authored-driver-reading/v1" {
            return Err("Private authored reading has another native schema".into());
        }
        let actual_scope = resolve(before, scope)?
            .into_iter()
            .filter(|address| {
                if shared {
                    return true;
                }
                address
                    .scene_ref
                    .as_deref()
                    .is_none_or(|scene| scene == scene_ref)
            })
            .collect::<Vec<_>>();
        if reading["scope"] != json!(actual_scope) {
            return Err("Private authored reading changed its complete original scope".into());
        }
        let targets: Vec<Address> = serde_json::from_value(prepared["resolved_scope"].clone())
            .map_err(|e| e.to_string())?;
        if targets.is_empty() || targets.len() > MAX_TARGETS {
            return Err("Authored Source scalar scope is absent or unbounded".into());
        }
        for target in &targets {
            canonical_address(before, target)?;
            if !actual_scope.iter().any(|allowed| covers(allowed, target)) {
                return Err("Authored Source widened the actual original scalar scope".into());
            }
        }
        let procedure = control::current_procedure_ref(self, before, procedure_ref, &targets)?;
        if procedure["revision"] != *expected_procedure_revision
            || *procedure != sealed.input()["procedure"]
            || prepared["schema"] != "ql.authored-driver-preparation/v1"
            || prepared["original_procedure"] != *procedure
            || prepared["driver_reading"] != *reading
            || prepared["catalog_revision"] != *catalog_revision
            || prepared["operation_ref"] != *operation_ref
            || prepared["consumer_state"] != "unconfirmed"
        {
            return Err("Authored preparation changed its original Procedure, reading, catalogue or operation".into());
        }
        let edit: ExpressionRequest =
            serde_json::from_value(prepared["native_edit"].clone()).map_err(|e| e.to_string())?;
        let ExpressionRequest::Edit {
            expression_ref: edit_ref,
            expected_revision,
            actor: edit_actor,
            changes,
        } = edit
        else {
            return Err("Authored Source must emit the ordinary native Edit".into());
        };
        if edit_ref != *expression_ref
            || expected_revision != before.revision
            || edit_actor != *actor
        {
            return Err("Authored Edit changed its original native owner, actor or CAS".into());
        }
        if shared {
            validate_shared_edit(
                before,
                scene_ref,
                &targets,
                sealed.catalog(),
                sealed.input(),
                prepared,
                &changes,
            )?;
        } else {
            validate_scene_edit(
                before,
                scene_ref,
                &targets,
                sealed.catalog(),
                reading,
                &sealed.input()["action"],
                prepared,
                &changes,
            )?;
        }
        let expanded = inherit_material_receipts(before, &changes)?;
        let preview = before.edited_with_journal(expanded.clone(), true)?;
        if preview.revision != before.revision.checked_add(1).ok_or("Revision exhausted")? {
            return Err("Authored Edit must advance exactly one native Document revision".into());
        }
        // Retain the complete actual reply for a lost-response retry. Charge it
        // before mutation, rather than discovering a cache failure after CAS.
        let mut response = sealed.response();
        cache_budget.value(&response)?;
        cache_budget.value(intent)?;
        cache_budget.reserve(65536)?;
        if self.procedural_runtime.authored_controls.len() >= MAX_OPERATIONS {
            return Err(
                "Authored continuation horizon full; settle its original native work".into(),
            );
        }
        let intent = intent.clone();
        let original_revision = before.revision;
        let expression_ref = expression_ref.clone();
        let operation_ref = operation_ref.clone();
        self.procedural_runtime.owner_write = true;
        let result = self.apply(
            client,
            ExpressionRequest::Edit {
                expression_ref: edit_ref,
                expected_revision,
                actor: edit_actor,
                changes: expanded,
            },
        );
        self.procedural_runtime.owner_write = false;
        let (receipt, changed) = result?;
        if receipt["state"] == "revision_conflict" {
            response["state"] = json!("revision_conflict");
            response["native_edit_receipt"] = receipt;
            return Ok((response, None));
        }
        let document = self.document(&expression_ref)?;
        if document != &preview || changed.is_none() {
            return Err(
                "Native authored owner did not apply its exact private Source candidate".into(),
            );
        }
        response["state"] = json!("document_applied");
        response["native_edit_receipt"] = receipt;
        let document_sha256 =
            crate::native_expression::procedural::bootstrap::fingerprint(document)?;
        response["document"] = serde_json::to_value(document).map_err(|e| e.to_string())?;
        response["cache"] = json!({"provenance":"live_native_owner","restored":false,"replayed":false,"document_sha256":document_sha256});
        response["document_revision"] = json!(document.revision);
        response["original_document_revision"] = json!(original_revision);
        response["source_current"] = json!(true);
        response["effective_state"] = json!("native_consumers_not_yet_observed");
        // Keep the exact consumed receipt already charged/retained by the
        // private response. SAME Session account-once qualifies historical
        // retries without another ordinal or current Source grant.
        // The response's ordinary receipt already carries the full Document;
        // the continuation retains its metadata and immutable native evidence.
        let mut retained_response = response.clone();
        retained_response
            .as_object_mut()
            .ok_or("Actual response absent")?
            .remove("document");
        retained_response["native_edit_receipt"]
            .as_object_mut()
            .ok_or("Actual authored Edit receipt missing")?
            .remove("document");
        let replay = Replay {
            intent,
            expression_ref,
            applied_revision: document.revision,
            document_sha256: crate::native_expression::procedural::bootstrap::fingerprint(
                document,
            )?,
            response: retained_response,
            native_outcome: None,
            native_owner: sealed.replay_owner().clone(),
        };
        self.procedural_runtime
            .authored_controls
            .insert(operation_ref, replay);
        Ok((response, changed))
    }
}

fn rows<'a>(value: &'a Value, key: &str) -> Result<&'a [Value], String> {
    match value.get(key) {
        None => Ok(&[]),
        Some(value) => value
            .as_array()
            .map(Vec::as_slice)
            .ok_or_else(|| format!("Actual authored {key} must be an array")),
    }
}

fn changed_rows<'a>(
    old: &'a [Value],
    new: &'a [Value],
    key: &str,
) -> Result<Vec<&'a Value>, String> {
    let index = |rows: &'a [Value]| -> Result<BTreeMap<String, &'a Value>, String> {
        let mut out = BTreeMap::new();
        for row in rows {
            let identity =
                serde_json::to_string(row.get(key).ok_or("Authored row identity absent")?)
                    .map_err(|e| e.to_string())?;
            if row[key].is_null() || out.insert(identity, row).is_some() {
                return Err("Authored rows have absent or duplicate identities".into());
            }
        }
        Ok(out)
    };
    let old_index = index(old)?;
    let new_index = index(new)?;
    Ok(old
        .iter()
        .chain(new)
        .filter(|row| {
            let id = serde_json::to_string(&row[key]).expect("bounded serde Value identity");
            old_index.get(&id) != new_index.get(&id)
        })
        .collect())
}

fn encode_component(value: &str) -> String {
    let mut result = String::new();
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            result.push(char::from(byte));
        } else {
            result.push_str(&format!("%{byte:02X}"));
        }
    }
    result
}

/// A Source-owned clock promotion is group-disposition metadata. Qualify the
/// exact paired snapshots; never infer a new scalar scope or evaluate a clock.
fn shared_disposition(previous: &Value, next: &Value, controls: &[&Value]) -> bool {
    let (Some(previous_object), Some(next_object)) = (previous.as_object(), next.as_object())
    else {
        return false;
    };
    let mut previous_fields = previous_object.clone();
    let mut next_fields = next_object.clone();
    for key in [
        "type", "wave", "rate", "phase", "duration", "delay", "loop", "easing", "firedAt",
        "enabled", "syncWith", "clockId",
    ] {
        previous_fields.remove(key);
        next_fields.remove(key);
    }
    if previous_fields != next_fields {
        return false;
    }
    controls.iter().any(|control| {
        let snapshots = |lane: &Value| {
            ["dormant_lanes", "suspended_lanes"].iter().any(|key| {
                control[*key]
                    .as_array()
                    .is_some_and(|rows| rows.contains(lane))
            })
        };
        snapshots(previous) && snapshots(next)
    })
}

fn preserve_unmanaged_order(
    old: &[Value],
    new: &[Value],
    selected: impl Fn(&Value) -> bool,
) -> Result<(), String> {
    let old_ids = old
        .iter()
        .map(|row| retained_text(row, "id"))
        .collect::<Result<BTreeSet<_>, _>>()?;
    let new_ids = new
        .iter()
        .map(|row| retained_text(row, "id"))
        .collect::<Result<BTreeSet<_>, _>>()?;
    let selected_ids = old
        .iter()
        .chain(new)
        .filter(|row| selected(row))
        .map(|row| retained_text(row, "id"))
        .collect::<Result<BTreeSet<_>, _>>()?;
    let unmanaged = old_ids
        .intersection(&new_ids)
        .copied()
        .filter(|id| !selected_ids.contains(id))
        .collect::<BTreeSet<_>>();
    let order = |rows: &[Value]| {
        rows.iter()
            .filter_map(|row| row["id"].as_str())
            .filter(|id| unmanaged.contains(id))
            .map(str::to_owned)
            .collect::<Vec<_>>()
    };
    if order(old) != order(new) {
        return Err("Authored Source reordered unrelated native driver/track declarations".into());
    }
    Ok(())
}

/// Resolve bindings from the installed Source catalogue and exact retained
/// native correspondence. No Registry factor or driver evaluator is copied.
fn binding_address(
    before: &Document,
    scene_ref: &str,
    catalog: &Value,
    reading: &Value,
    target: Option<&str>,
    bind: Option<&str>,
    entity_id: Option<&str>,
) -> Result<Address, String> {
    let mut matches = Vec::new();
    for kind in ["field", "entity"] {
        for descriptor in catalog[kind]
            .as_array()
            .ok_or("Actual authored catalogue rows absent")?
        {
            let key = retained_text(descriptor, "key")?;
            let descriptor_bind = retained_text(descriptor, "bind")?;
            if kind == "field" {
                if entity_id.is_some() {
                    continue;
                }
                if target.is_some_and(|target| target != format!("field.{key}"))
                    || bind.is_some_and(|bind| bind != descriptor_bind)
                {
                    continue;
                }
                let (component, property) = descriptor_bind
                    .strip_prefix("field.")
                    .map_or((Component::Property, descriptor_bind), |property| {
                        (Component::Field, property)
                    });
                let mut a = address(before, Some(scene_ref), None, component);
                a.property = Some(property.into());
                matches.push(a);
            } else {
                for (id, native_ref) in reading["entity_refs"]
                    .as_object()
                    .ok_or("Actual authored Entity correspondence absent")?
                {
                    if entity_id.is_some_and(|selected| selected != id) {
                        continue;
                    }
                    if target.is_some_and(|target| {
                        target != format!("entity:{}:{key}", encode_component(id))
                    }) || bind.is_some_and(|bind| bind != descriptor_bind)
                    {
                        continue;
                    }
                    let property = descriptor_bind
                        .strip_prefix("entity.")
                        .ok_or("Source Entity descriptor binding differs")?;
                    let (component, property) = property
                        .strip_prefix("sequence.")
                        .map_or((Component::Entity, property), |property| {
                            (Component::Sequence, property)
                        });
                    let mut a = address(
                        before,
                        Some(scene_ref),
                        Some(
                            native_ref
                                .as_str()
                                .ok_or("Native Entity reference absent")?,
                        ),
                        component,
                    );
                    a.property = Some(property.into());
                    matches.push(a);
                }
            }
        }
    }
    if matches.len() != 1 {
        return Err("Changed authored driver has no unique installed native binding".into());
    }
    Ok(matches.remove(0))
}

fn validate_scene_edit(
    before: &Document,
    scene_ref: &str,
    targets: &[Address],
    catalog: &Value,
    reading: &Value,
    action: &Value,
    prepared: &Value,
    changes: &[Change],
) -> Result<(), String> {
    let [Change::SceneMaterialSet {
        scene_ref: actual_scene,
        presentation,
    }] = changes
    else {
        return Err("Authored Scene Source must emit one exact SceneMaterialSet".into());
    };
    if actual_scene != scene_ref {
        return Err("Authored Source edited another actual Scene".into());
    }
    let original = before
        .scenes
        .iter()
        .find(|scene| scene.scene_ref == scene_ref)
        .and_then(|scene| scene.presentation.as_ref())
        .ok_or("Actual authored Scene material absent")?;
    if presentation.saved != original.saved {
        return Err("Authored mutation changed saved material".into());
    }
    let old = &original.scene["procedural"];
    let new = &presentation.scene["procedural"];
    validate_retention(new)?;
    let retained_keys = old
        .as_object()
        .ok_or("Actual procedural object absent")?
        .keys()
        .chain(
            new.as_object()
                .ok_or("Source procedural object absent")?
                .keys(),
        )
        .collect::<BTreeSet<_>>();
    for key in retained_keys {
        if ["controls", "contributions", "operations"].contains(&key.as_str()) {
            continue;
        }
        if old[key] != new[key] {
            return Err(format!(
                "Authored mutation changed protected procedural {key}"
            ));
        }
    }
    if !new["operations"].as_array().is_some_and(Vec::is_empty) {
        return Err("Authored Source cannot issue native operation receipts".into());
    }
    let require = |a: &Address| -> Result<(), String> {
        if a.expression_ref != before.expression_ref
            || a.scene_ref.as_deref() != Some(scene_ref)
            || !targets.iter().any(|target| covers(target, a))
        {
            return Err(
                "Authored material driver changed outside its original scalar scope".into(),
            );
        }
        Ok(())
    };
    let changed_controls = changed_rows(rows(old, "controls")?, rows(new, "controls")?, "address")?;
    let source_dispositions = changed_controls
        .iter()
        .copied()
        .filter(|row| {
            serde_json::from_value::<Address>(row["address"].clone()).is_ok_and(|a| {
                require(&a).is_ok()
                    || (a.component == Component::Driver
                        && a.scene_ref.as_deref() == Some(scene_ref))
            })
        })
        .collect::<Vec<_>>();
    let old_lanes = rows(&original.scene, "automation")?;
    let new_lanes = rows(&presentation.scene, "automation")?;
    for lane in changed_rows(old_lanes, new_lanes, "id")? {
        let scalar = binding_address(
            before,
            scene_ref,
            catalog,
            reading,
            Some(retained_text(lane, "target")?),
            None,
            None,
        )
        .and_then(|address| require(&address));
        if scalar.is_err() {
            let previous = old_lanes.iter().find(|row| row["id"] == lane["id"]);
            let next = new_lanes.iter().find(|row| row["id"] == lane["id"]);
            if !matches!((previous,next),(Some(previous),Some(next)) if shared_disposition(previous,next,&source_dispositions))
            {
                return scalar;
            }
        }
    }
    for track in changed_rows(
        rows(&original.scene, "propertyTracks")?,
        rows(&presentation.scene, "propertyTracks")?,
        "id",
    )? {
        require(&binding_address(
            before,
            scene_ref,
            catalog,
            reading,
            None,
            Some(retained_text(track, "bind")?),
            track.get("entityId").and_then(Value::as_str),
        )?)?;
    }
    preserve_unmanaged_order(old_lanes, new_lanes, |lane| {
        binding_address(
            before,
            scene_ref,
            catalog,
            reading,
            lane["target"].as_str(),
            None,
            None,
        )
        .is_ok_and(|address| require(&address).is_ok())
    })?;
    preserve_unmanaged_order(
        rows(&original.scene, "propertyTracks")?,
        rows(&presentation.scene, "propertyTracks")?,
        |track| {
            binding_address(
                before,
                scene_ref,
                catalog,
                reading,
                None,
                track["bind"].as_str(),
                track["entityId"].as_str(),
            )
            .is_ok_and(|address| require(&address).is_ok())
        },
    )?;
    let mut actual_controls = BTreeSet::new();
    let metadata: Vec<Address> = serde_json::from_value(
        prepared
            .get("metadata_scope")
            .cloned()
            .unwrap_or_else(|| json!([])),
    )
    .map_err(|e| e.to_string())?;
    if metadata.len() > MAX_TARGETS {
        return Err("Authored metadata scope exceeded".into());
    }
    let driver_ref = match action["kind"].as_str() {
        Some("group") => action["definition"]["group_ref"]
            .as_str()
            .map(|value| format!("driver:{value}")),
        Some("group_remove") => action["group_ref"]
            .as_str()
            .map(|value| format!("driver:{value}")),
        Some("record") => action["track_ref"]
            .as_str()
            .map(|value| format!("driver:record:{value}")),
        _ => None,
    };
    if metadata
        .iter()
        .any(|a| a.component != Component::Driver || a.constituent_ref != driver_ref)
    {
        return Err("Source metadata scope belongs to another original authored Driver".into());
    }
    for row in changed_controls {
        let a = retained_address(&row["address"])?;
        if a.component == Component::Driver {
            if a.expression_ref != before.expression_ref
                || a.scene_ref.as_deref() != Some(scene_ref)
                || a.entity_ref.is_some()
                || a.parent_ref.is_some()
                || a.property.is_some()
                || a.constituent_ref.as_deref() != row["target"].as_str()
                || !metadata.contains(&a)
            {
                return Err("Authored Driver metadata has another actual coordinate".into());
            }
        } else {
            require(&a)?;
        }
        actual_controls.insert(a);
    }
    let declared: Vec<Address> =
        serde_json::from_value(prepared["managed_control_addresses"].clone())
            .map_err(|e| e.to_string())?;
    if declared.len() > MAX_TARGETS
        || declared.len() != declared.iter().collect::<BTreeSet<_>>().len()
        || actual_controls != declared.into_iter().collect()
    {
        return Err(
            "Source managed-control coverage differs from actual changed native rows".into(),
        );
    }
    let managed = prepared["managed_contribution_refs"]
        .as_array()
        .ok_or("Source contribution coverage absent")?;
    let mut actual_managed = BTreeSet::new();
    for row in changed_rows(
        rows(old, "contributions")?,
        rows(new, "contributions")?,
        "contribution_ref",
    )? {
        let reference = retained_text(row, "contribution_ref")?;
        if !managed.contains(&json!(reference))
            || row["status"] != "active"
            || row["generated_basis"].get("native_flow").is_some()
        {
            return Err("Authored Source changed another native contribution or flow".into());
        }
        actual_managed.insert(reference.to_owned());
        // Attribution may update the record of a contribution owning several
        // leaves; its owned-address set itself must remain byte-identical.
        let previous = rows(old, "contributions")?
            .iter()
            .find(|r| r["contribution_ref"] == reference)
            .ok_or("Authored control cannot mint a generated contribution")?;
        let mut immutable_before = previous
            .as_object()
            .ok_or("Actual contribution object absent")?
            .clone();
        let mut immutable_after = row
            .as_object()
            .ok_or("Source contribution object absent")?
            .clone();
        immutable_before.remove("authored_overrides");
        immutable_after.remove("authored_overrides");
        if immutable_before != immutable_after {
            return Err(
                "Authored mutation changed original generated contribution identity or basis"
                    .into(),
            );
        }
    }
    let declared_managed = managed
        .iter()
        .map(|value| {
            value
                .as_str()
                .ok_or("Invalid managed contribution identity")
                .map(str::to_owned)
        })
        .collect::<Result<BTreeSet<_>, _>>()?;
    if declared_managed.len() != managed.len() || actual_managed != declared_managed {
        return Err("Source contribution coverage differs from actual changed rows".into());
    }
    // Native scalar/material validation receives the genuine before/after
    // leaves. Driver/retention rows were checked above at their own coordinates.
    let mut scalar_before = before.clone();
    let old_scene = scalar_before
        .scenes
        .iter_mut()
        .find(|scene| scene.scene_ref == scene_ref)
        .and_then(|scene| scene.presentation.as_mut())
        .ok_or("Actual scalar Scene absent")?;
    let mut scalar_after = presentation.clone();
    for key in ["procedural", "automation", "propertyTracks"] {
        old_scene
            .scene
            .as_object_mut()
            .ok_or("Actual Scene object absent")?
            .remove(key);
        scalar_after
            .scene
            .as_object_mut()
            .ok_or("Source Scene object absent")?
            .remove(key);
    }
    validate_write_set(
        &scalar_before,
        targets,
        &[Change::SceneMaterialSet {
            scene_ref: scene_ref.into(),
            presentation: scalar_after,
        }],
        None,
    )
}

/// A shared scalar reads the actual whole composition and every ordered Scene
/// at the same CAS. This comparison lends no Source or native clock authority.
fn validate_shared_reading(before: &Document, reading: &Value) -> Result<(), String> {
    let composition = before
        .presentation
        .as_ref()
        .ok_or("Actual whole Expression composition absent")?;
    let scenes = reading["scenes"]
        .as_array()
        .ok_or("Whole authored reading lacks actual Scenes")?;
    let order = reading["scene_order"]
        .as_array()
        .ok_or("Whole authored reading lacks actual Scene order")?;
    if reading["schema"] != "ql.authored-expression-driver-reading/v1"
        || reading["expression_ref"] != before.expression_ref
        || reading["document_revision"].as_u64() != Some(before.revision)
        || reading["presentation"]
            != serde_json::to_value(composition).map_err(|e| e.to_string())?
        || scenes.len() != before.scenes.len()
        || order.len() != before.scenes.len()
        || scenes.is_empty()
        || scenes.len() > MAX_TARGETS
    {
        return Err(
            "Whole authored reading differs from its actual composition/CAS/Scene cohort".into(),
        );
    }
    for ((scene, actual), ordered) in before.scenes.iter().zip(scenes).zip(order) {
        let presentation = scene
            .presentation
            .as_ref()
            .ok_or("Whole authored Scene has no actual material")?;
        let source = &actual["source"];
        if ordered != &json!(scene.scene_ref)
            || source["expression_ref"] != before.expression_ref
            || source["scene_ref"] != scene.scene_ref
            || source["document_revision"].as_u64() != Some(before.revision)
            || source["presentation"] != budget::material_value(presentation)?
            || actual["current_presentation"] != budget::driver_material_value(presentation)?
            || source["material_fingerprint"]
                != crate::native_expression::procedural::bootstrap::fingerprint(
                    &source["presentation"],
                )?
        {
            return Err(
                "Whole authored reading omitted/reordered/changed an actual same-CAS Scene".into(),
            );
        }
        let scene_address = address(before, Some(&scene.scene_ref), None, Component::Scene);
        let binding = source_exact_binding_borrowed(before, &scene_address)?
            .ok_or("Whole authored Scene source binding absent")?;
        if source["contributors"] != binding["contributors"]
            || source["principal"] != source_native_subject(before, &scene_address)?
        {
            return Err(
                "Whole authored reading changed an actual Scene subject/source binding".into(),
            );
        }
    }
    Ok(())
}

/// Admit exactly the paired native shared constructor's two ordinary changes.
/// The anchor carries only control metadata; the composition carries one
/// registered shared scalar. The existing Source remains its numerical owner.
fn validate_shared_edit(
    before: &Document,
    scene_ref: &str,
    targets: &[Address],
    catalog: &Value,
    input: &Value,
    prepared: &Value,
    changes: &[Change],
) -> Result<(), String> {
    validate_shared_reading(before, &input["reading"])?;
    let target = &input["target"];
    if target["kind"] != "expression_shared"
        || !target["entity_ref"].is_null()
        || !["set_base", "takeover", "release", "release_gesture"].contains(
            &input["action"]["kind"]
                .as_str()
                .ok_or("Shared authored action absent")?,
        )
    {
        return Err("Shared authored target/action requires its actual native interface".into());
    }
    let descriptors = catalog["field"]
        .as_array()
        .ok_or("Actual field catalogue absent")?
        .iter()
        .filter(|row| row["key"] == target["key"])
        .collect::<Vec<_>>();
    let [descriptor] = descriptors.as_slice() else {
        return Err("Shared authored scalar has no unique installed descriptor".into());
    };
    let bucket = retained_text(descriptor, "shared_bucket")?;
    let bind = retained_text(descriptor, "bind")?;
    if descriptor["type"] != "scalar"
        || descriptor["rate_class"] != "frame"
        || !["values", "pointer"].contains(&bucket)
    {
        return Err(
            "Shared authored descriptor requires a distinct native type/rate contract".into(),
        );
    }
    let mut selected = address(before, None, None, Component::Expression);
    selected.property = Some(format!("shared.{bucket}.{bind}"));
    if targets != [selected.clone()] {
        return Err("Shared Source changed its exact original registered scalar scope".into());
    }
    let [Change::SceneMaterialSet {
        scene_ref: anchor_ref,
        presentation: anchor,
    }, Change::CompositionSet {
        presentation: composition,
    }] = changes
    else {
        return Err("Shared Source must emit the exact anchor metadata/composition pair".into());
    };
    if anchor_ref != scene_ref || input["source_scene_ref"] != scene_ref {
        return Err("Shared Source changed its original actual anchor Scene".into());
    }
    let original = before
        .scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .and_then(|s| s.presentation.as_ref())
        .ok_or("Actual shared anchor absent")?;
    if anchor.schema != original.schema || anchor.saved != original.saved {
        return Err("Shared Source changed the anchor schema/saved human material".into());
    }
    let old = &original.scene["procedural"];
    let new = &anchor.scene["procedural"];
    validate_retention(new)?;
    if !new["operations"].as_array().is_some_and(Vec::is_empty)
        || !prepared["managed_contribution_refs"]
            .as_array()
            .is_some_and(Vec::is_empty)
    {
        return Err(
            "Shared Source cannot issue owner receipts or manage generated contributions".into(),
        );
    }
    let metadata: Vec<Address> =
        serde_json::from_value(prepared["metadata_scope"].clone()).map_err(|e| e.to_string())?;
    if metadata != [address(before, Some(scene_ref), None, Component::Scene)] {
        return Err("Shared metadata scope differs from its original actual anchor".into());
    }
    for key in old
        .as_object()
        .ok_or("Actual shared retention absent")?
        .keys()
        .chain(
            new.as_object()
                .ok_or("Shared Source retention absent")?
                .keys(),
        )
        .collect::<BTreeSet<_>>()
    {
        if key != "controls" && key != "operations" && old[key] != new[key] {
            return Err(format!("Shared Source rewrote protected procedural {key}"));
        }
    }
    let old_controls = rows(old, "controls")?;
    let new_controls = rows(new, "controls")?;
    let mut actual_controls = BTreeSet::new();
    for row in changed_rows(old_controls, new_controls, "address")? {
        let actual = retained_address(&row["address"])?;
        if actual != selected {
            return Err("Shared Source rewrote another human/native control".into());
        }
        actual_controls.insert(actual);
    }
    let unmanaged = |controls: &[Value]| {
        controls
            .iter()
            .filter(|row| row["address"] != json!(selected))
            .cloned()
            .collect::<Vec<_>>()
    };
    if unmanaged(old_controls) != unmanaged(new_controls) {
        return Err("Shared Source reordered unrelated human/native controls".into());
    }
    for control in new_controls
        .iter()
        .filter(|row| row["address"] == json!(selected))
    {
        let restores_original = ["release", "release_gesture"]
            .contains(&input["action"]["kind"].as_str().unwrap_or(""))
            && old_controls
                .iter()
                .find(|row| row["address"] == json!(selected))
                .and_then(|row| row.get("dormant_control"))
                == Some(control);
        if restores_original {
            continue;
        }
        if control["authored_shared"]["definition"] != input["procedure"]
            || control["authored_shared"]["catalog_revision"] != prepared["catalog_revision"]
            || control["authored_shared"]["bucket"] != bucket
            || control["authored_shared"]["bind"] != bind
        {
            return Err("Shared control changed its original actual Source/descriptor".into());
        }
    }
    let declared: Vec<Address> =
        serde_json::from_value(prepared["managed_control_addresses"].clone())
            .map_err(|e| e.to_string())?;
    if declared.len() != declared.iter().collect::<BTreeSet<_>>().len()
        || actual_controls != declared.into_iter().collect()
    {
        return Err("Shared control coverage differs from its actual changed rows".into());
    }
    // No field, entity, driver, force, sequence, view, flow or saved material
    // change may hide inside the full anchor material replacement.
    let mut material_before = original
        .scene
        .as_object()
        .ok_or("Actual anchor object absent")?
        .clone();
    let mut material_after = anchor
        .scene
        .as_object()
        .ok_or("Shared anchor object absent")?
        .clone();
    material_before.remove("procedural");
    material_after.remove("procedural");
    if material_before != material_after {
        return Err(
            "Shared Source changed local Scene material instead of the shared composition".into(),
        );
    }
    validate_shared_composition(before, targets, composition)
}

fn validate_shared_composition(
    before: &Document,
    targets: &[Address],
    composition: &crate::expression_scene::Composition,
) -> Result<(), String> {
    let [selected] = targets else {
        return Err("Shared composition must have exactly one original scalar target".into());
    };
    composition.validate()?;
    let current = before
        .presentation
        .as_ref()
        .ok_or("Actual composition absent")?;
    let old_composition = serde_json::to_value(current).map_err(|e| e.to_string())?;
    let next_composition = serde_json::to_value(composition).map_err(|e| e.to_string())?;
    if leaf_changes(&old_composition, &next_composition, "")
        .iter()
        .any(|path| selected.property.as_deref() != Some(path.as_str()))
    {
        return Err("Shared Source changed an unrelated actual composition property".into());
    }
    validate_write_set(
        before,
        targets,
        &[Change::CompositionSet {
            presentation: composition.clone(),
        }],
        None,
    )
}

#[cfg(test)]
#[path = "expression_authored_receiver_independent.rs"]
mod independent_receiving_tests;
