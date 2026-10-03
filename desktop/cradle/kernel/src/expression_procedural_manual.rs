//! Protected ordinary-edit attribution over the same native Document/CAS.
//! The held source owner computes stable interventions. This receiver validates
//! their exact native scope and atomically attaches them to the accepted edit.
use super::*;

#[path = "expression_procedural_active_control.rs"]
mod active;

#[derive(Debug)]
pub(crate) struct ManualCandidate {
    before: Document,
    candidate: Document,
    original: ExpressionRequest,
    actor: String,
    operation_ref: String,
    pub(crate) entries: Vec<ManualEntry>,
    accepted: Option<AcceptedCandidate>,
    active_controls: Option<active::Plan>,
}
/// Built by the original native Application, never accepted from caller JSON.
#[derive(Debug)]
struct AcceptedCandidate {
    events: Vec<Changed>,
    reviewed: Option<(String, String)>,
    checkpoint: bool,
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
    pub(crate) fn matches_reviewed(
        &self,
        proposal: &ExpressionRequest,
        reviewer: &str,
        reason: &str,
    ) -> bool {
        self.original() == proposal
            && self.accepted.as_ref().is_some_and(|accepted| {
                accepted
                    .reviewed
                    .as_ref()
                    .is_some_and(|(r, why)| r == reviewer && why == reason)
            })
    }
    pub(crate) fn is_checkpoint(&self) -> bool {
        self.accepted
            .as_ref()
            .is_some_and(|accepted| accepted.checkpoint)
    }
}
pub(crate) fn scene_material(scene: &super::super::Scene) -> Result<Value, String> {
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
pub(super) fn definition_ref<'a>(
    document: &'a Document,
    procedure: &str,
) -> Result<&'a Value, String> {
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
            if original.is_some_and(|prior| prior != value) {
                return Err("Conflicting native procedure projections".into());
            }
            original = Some(value);
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
    let procedure = definition_ref(document, retained_text(contribution, "procedure_ref")?)?;
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
// Borrow the actual material coordinates before creating repeated Source
// requests. Existing typed-native fallback preserves native-only properties.
pub(super) fn borrowed_material<'a>(
    document: &'a Document,
    address: &Address,
) -> Result<&'a Value, String> {
    if address.expression_ref != document.expression_ref {
        return Err("Wrong Expression subject".into());
    }
    let scene = document
        .scenes
        .iter()
        .find(|s| Some(&s.scene_ref) == address.scene_ref.as_ref())
        .ok_or("Unknown Scene address")?;
    let presentation = scene
        .presentation
        .as_ref()
        .ok_or("Scene has no authored material")?;
    let root = match address.component {
        Component::Field => &presentation.scene["field"],
        Component::Property if address.entity_ref.is_none() => &presentation.scene,
        Component::Driver => presentation.scene["procedural"]["controls"]
            .as_array()
            .and_then(|rows| {
                rows.iter().find(|c| {
                    c["target"].as_str() == address.constituent_ref.as_deref()
                        && c["address"]["entity_ref"].as_str() == address.entity_ref.as_deref()
                })
            })
            .ok_or("Unknown named driver")?,
        Component::Entity
        | Component::Force
        | Component::Sequence
        | Component::Layer
        | Component::SequenceLink => {
            let reference = address
                .entity_ref
                .as_deref()
                .ok_or("Constituent needs exact Entity")?;
            if !scene.entity_refs.iter().any(|r| r == reference)
                || !document.entities.contains_key(reference)
            {
                return Err("Occurrence is not in this Scene".into());
            }
            let entity = presentation.scene["entities"]
                .as_array()
                .and_then(|rows| rows.iter().find(|e| e["id"] == reference))
                .ok_or("Occurrence has no material")?;
            match address.component {
                Component::Entity => entity,
                Component::Force => entity
                    .get("force")
                    .or_else(|| entity.get("forces"))
                    .or_else(|| entity["native"].get("forces"))
                    .ok_or("Force unavailable")?,
                Component::Sequence => entity
                    .get("sequence")
                    .or_else(|| entity["native"].get("sequence"))
                    .ok_or("Sequence unavailable")?,
                Component::Layer => {
                    let matches = layer_locations(entity, address);
                    if address.parent_ref.is_none()
                        && matches
                            .iter()
                            .map(|(parent, _)| parent)
                            .collect::<BTreeSet<_>>()
                            .len()
                            > 1
                    {
                        return Err("Legacy Layer coordinate ambiguous".into());
                    }
                    let (_, found) = matches.first().ok_or("Layer unavailable")?;
                    if matches.iter().any(|(_, row)| *row != *found) {
                        return Err("Layer projection ambiguous".into());
                    }
                    *found
                }
                Component::SequenceLink => {
                    let mut found = None;
                    for list in [
                        &entity["sequence"]["steps"],
                        &entity["sequence"]["links"],
                        &entity["native"]["sequence"]["links"],
                    ] {
                        for row in list
                            .as_array()
                            .into_iter()
                            .flatten()
                            .filter(|r| r["id"].as_str() == address.constituent_ref.as_deref())
                        {
                            if found.is_some_and(|prior| prior != row) {
                                return Err("Sequence projection ambiguous".into());
                            }
                            found = Some(row);
                        }
                    }
                    found.ok_or("SequenceLink unavailable")?
                }
                _ => unreachable!(),
            }
        }
        _ => return Err("Coordinate is native typed material".into()),
    };
    if root.is_null() {
        return Err("Component unavailable".into());
    }
    match &address.property {
        Some(property) => path(root, property),
        None => Ok(root),
    }
}
pub(super) fn affected_without_scene_copy(
    before: &Document,
    candidate: &Document,
    address: &Address,
) -> bool {
    if address.component == Component::Scene && address.property.is_none() {
        return before
            .scenes
            .iter()
            .find(|s| Some(&s.scene_ref) == address.scene_ref.as_ref())
            != candidate
                .scenes
                .iter()
                .find(|s| Some(&s.scene_ref) == address.scene_ref.as_ref());
    }
    if matches!(
        address.component,
        Component::Field
            | Component::Entity
            | Component::Force
            | Component::Sequence
            | Component::Layer
            | Component::SequenceLink
            | Component::Driver
    ) || address.component == Component::Property && address.entity_ref.is_none()
    {
        let a = borrowed_material(before, address).ok();
        let b = borrowed_material(candidate, address).ok();
        // Native Entity without presentation keeps its existing typed branch.
        if address.component != Component::Entity || a.is_some() || b.is_some() {
            return a != b;
        }
    }
    // This fallback is explicit and retains original native-only semantics;
    // a complete borrowed native-Scene property accessor remains owner work.
    addressed(before, address).ok() != addressed(candidate, address).ok()
}

fn same_checkpoint_procedural_basis(before: &Value, after: &Value) -> bool {
    if before == after {
        return true;
    }
    let (Some(before), Some(after)) = (before.as_object(), after.as_object()) else {
        return false;
    };
    if before.len() != after.len() {
        return false;
    }
    before.iter().all(|(key, value)| {
        if key != "contributions" {
            return after.get(key) == Some(value);
        }
        let (Some(old), Some(new)) = (value.as_array(), after.get(key).and_then(Value::as_array))
        else {
            return false;
        };
        old.len() == new.len()
            && old.iter().zip(new).all(|(old, new)| {
                let (Some(old), Some(new)) = (old.as_object(), new.as_object()) else {
                    return false;
                };
                old.len() == new.len()
                    && old.iter().all(|(key, value)| {
                        if key == "authored_overrides" {
                            value.is_array() && new.get(key).is_some_and(Value::is_array)
                        } else {
                            new.get(key) == Some(value)
                        }
                    })
            })
    })
}
impl Application {
    /// Review and Restore are evaluated by their original native owner in an
    /// isolated candidate Application. Preparation changes no live history.
    fn accepted_request_candidate(
        &self,
        client: &CentralClient,
        request: &ExpressionRequest,
    ) -> Result<Option<(Document, Document, AcceptedCandidate)>, String> {
        let (expression_ref, expected_revision) = match request {
            ExpressionRequest::Review {
                expression_ref,
                expected_revision,
                decision,
                ..
            } if *decision == super::super::RefinementState::Accepted => {
                (expression_ref, expected_revision)
            }
            ExpressionRequest::Restore {
                expression_ref,
                expected_revision,
                ..
            } => (expression_ref, expected_revision),
            _ => return Ok(None),
        };
        let before = self.document(expression_ref)?.clone();
        if before.revision != *expected_revision || self.procedural_runtime.owner_write {
            return Ok(None);
        }
        let mut isolated = Self::default();
        isolated
            .documents
            .insert(expression_ref.clone(), before.clone());
        let (_, changed) = isolated.apply(client, request.clone())?;
        let Some(changed) = changed else {
            return Ok(None);
        };
        let candidate = isolated
            .documents
            .remove(expression_ref)
            .ok_or("Original accepted native candidate disappeared")?;
        Ok(Some((
            before,
            candidate,
            AcceptedCandidate {
                events: vec![changed],
                reviewed: None,
                checkpoint: false,
            },
        )))
    }
    pub(crate) fn prepare_procedural_manual_request(
        &self,
        client: &CentralClient,
        request: &ExpressionRequest,
    ) -> Result<Option<ManualCandidate>, String> {
        if matches!(request, ExpressionRequest::Edit { .. }) {
            return self.prepare_procedural_manual_edit(request);
        }
        let Some((before, candidate, accepted)) =
            self.accepted_request_candidate(client, request)?
        else {
            return Ok(None);
        };
        let actor = accepted
            .events
            .last()
            .ok_or("Native acceptance event missing")?
            .actor
            .clone();
        self.prepare_manual_candidate(request, before, candidate, actor, Some(accepted))
    }
    pub(crate) fn prepare_procedural_checkpoint_restore(
        &self,
        client: &CentralClient,
        request: &ExpressionRequest,
    ) -> Result<Option<ManualCandidate>, String> {
        if !matches!(request, ExpressionRequest::Restore { .. }) {
            return Err("Native checkpoint attribution requires its original Restore".into());
        }
        let Some((before, candidate, mut accepted)) =
            self.accepted_request_candidate(client, request)?
        else {
            return Ok(None);
        };
        accepted.checkpoint = true;
        let actor = accepted
            .events
            .last()
            .ok_or("Native Restore event missing")?
            .actor
            .clone();
        self.prepare_manual_candidate(request, before, candidate, actor, Some(accepted))
    }
    fn accepted_reviewed_candidate(
        &self,
        client: &CentralClient,
        proposal: &ExpressionRequest,
        reviewer: &str,
        reason: &str,
    ) -> Result<(Document, Document, AcceptedCandidate), String> {
        let ExpressionRequest::Propose { expression_ref, .. } = proposal else {
            return Err("Reviewed attribution requires its original native proposal".into());
        };
        let before = self.document(expression_ref)?.clone();
        let mut isolated = Self::default();
        isolated
            .documents
            .insert(expression_ref.clone(), before.clone());
        let (_, events) = isolated.apply_reviewed_focus(
            client,
            proposal.clone(),
            reviewer.into(),
            reason.into(),
        )?;
        let candidate = isolated
            .documents
            .remove(expression_ref)
            .ok_or("Original reviewed focus candidate disappeared")?;
        Ok((
            before,
            candidate,
            AcceptedCandidate {
                events,
                reviewed: Some((reviewer.into(), reason.into())),
                checkpoint: false,
            },
        ))
    }
    pub(crate) fn prepare_procedural_reviewed_focus(
        &self,
        client: &CentralClient,
        proposal: &ExpressionRequest,
        reviewer: &str,
        reason: &str,
    ) -> Result<Option<ManualCandidate>, String> {
        let (before, candidate, accepted) =
            self.accepted_reviewed_candidate(client, proposal, reviewer, reason)?;
        let actor = accepted
            .events
            .last()
            .ok_or("Original accepted Review event missing")?
            .actor
            .clone();
        self.prepare_manual_candidate(proposal, before, candidate, actor, Some(accepted))
    }
    /// Commit only a candidate already produced by the exact native owner and
    /// admitted by the Source receiver. No synthetic Edit or extra event occurs.
    fn commit_accepted_candidate(
        &mut self,
        before: &Document,
        candidate: Document,
        accepted: AcceptedCandidate,
    ) -> Result<(Value, Vec<Changed>), String> {
        if self.document(&before.expression_ref)? != before {
            return Err("The full native candidate basis changed before accepted admission".into());
        }
        candidate.validate()?;
        let reference = before.expression_ref.clone();
        self.documents.insert(reference.clone(), candidate);
        self.touched
            .insert(reference.clone(), super::super::unix_now());
        Ok((self.inspect(&reference)?, accepted.events))
    }
    pub(crate) fn finish_procedural_manual_edit(
        &mut self,
        client: &CentralClient,
        prepared: ManualCandidate,
        actual: ManualBatchRecords,
    ) -> Result<(Value, Option<Changed>), String> {
        if prepared
            .accepted
            .as_ref()
            .is_some_and(|accepted| accepted.events.len() != 1 || accepted.reviewed.is_some())
        {
            return Err("Reviewed focus requires its original paired native event receiver".into());
        }
        let (data, events) = self.finish_procedural_manual_candidate(client, prepared, actual)?;
        Ok((data, events.into_iter().next()))
    }
    pub(crate) fn finish_procedural_reviewed_focus(
        &mut self,
        client: &CentralClient,
        proposal: ExpressionRequest,
        reviewer: String,
        reason: String,
        attribution: Option<(ManualCandidate, ManualBatchRecords)>,
    ) -> Result<(Value, Vec<Changed>), String> {
        if let Some((candidate, records)) = attribution {
            if !candidate.matches_reviewed(&proposal, &reviewer, &reason) {
                return Err(
                    "Private attribution differs from the original reviewed focus and reviewer"
                        .into(),
                );
            }
            return self.finish_procedural_manual_candidate(client, candidate, records);
        }
        if self
            .prepare_procedural_reviewed_focus(client, &proposal, &reviewer, &reason)?
            .is_some()
        {
            return Err(
                "Reviewed focus requires native intervention Source outside the Kernel lock".into(),
            );
        }
        self.apply_reviewed_focus(client, proposal, reviewer, reason)
    }
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
        self.prepare_manual_candidate(request, before, candidate, actor.clone(), None)
    }
    fn prepare_manual_candidate(
        &self,
        request: &ExpressionRequest,
        before: Document,
        candidate: Document,
        actor: String,
        accepted: Option<AcceptedCandidate>,
    ) -> Result<Option<ManualCandidate>, String> {
        let expression_ref = &before.expression_ref;
        let checkpoint = accepted
            .as_ref()
            .is_some_and(|accepted| accepted.checkpoint);
        let mut checkpoint_metadata_changed = false;
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
                if checkpoint
                    && old
                        .zip(new)
                        .is_some_and(|(old, new)| same_checkpoint_procedural_basis(old, new))
                {
                    checkpoint_metadata_changed = true;
                } else {
                    return Err("Authored acceptance cannot change native procedural qualification or attribution".into());
                }
            }
        }
        let basis = if let Some((reviewer, reason)) = accepted
            .as_ref()
            .and_then(|accepted| accepted.reviewed.as_ref())
        {
            serde_json::to_vec(&json!({"proposal":request,"reviewer":reviewer,"reason":reason}))
        } else {
            serde_json::to_vec(request)
        }
        .map_err(|e| e.to_string())?;
        let operation_ref = format!("native-manual:{:x}", Sha256::digest(basis));
        let mut active_controls = active::plan(self, &before, &candidate)?;
        // Complete affected-entry count before any repeated Source request or
        // retained output-reading allocation. Retained rows stay borrowed.
        let mut counted = BTreeMap::<&str, &Value>::new();
        let mut affected_entries = Vec::new();
        for scene in &before.scenes {
            for contribution in scene
                .presentation
                .as_ref()
                .and_then(|p| p.scene["procedural"]["contributions"].as_array())
                .into_iter()
                .flatten()
                .filter(|r| r["status"] == "active")
            {
                let reference = retained_text(contribution, "contribution_ref")?;
                if let Some(prior) = counted.insert(reference, contribution) {
                    if prior != contribution {
                        return Err("Conflicting original contribution projections".into());
                    }
                    continue;
                }
                if active_controls
                    .as_ref()
                    .is_some_and(|plan| plan.contributions.contains(reference))
                {
                    continue;
                }
                let owned: Vec<Address> =
                    serde_json::from_value(contribution["owned_addresses"].clone())
                        .map_err(|e| e.to_string())?;
                if owned.is_empty() || owned.len() > MAX_TARGETS {
                    return Err("Original contribution exceeds native ownership bounds".into());
                }
                let whole = owned
                    .iter()
                    .all(|a| a.component == Component::Expression && a.property.is_none());
                let affected = if whole {
                    before.selection != candidate.selection
                        || before
                            .scenes
                            .iter()
                            .map(|s| &s.scene_ref)
                            .ne(candidate.scenes.iter().map(|s| &s.scene_ref))
                } else {
                    owned
                        .iter()
                        .any(|a| affected_without_scene_copy(&before, &candidate, a))
                };
                if affected {
                    if affected_entries.len() + usize::from(active_controls.is_some()) == 64 {
                        return Err(
                            "Native source intervention batch budget exceeded before allocation"
                                .into(),
                        );
                    }
                    affected_entries.push((
                        contribution,
                        owned,
                        whole,
                        Option::<Vec<Address>>::None,
                    ));
                }
            }
        }
        // Complete aggregate bytes over every affected entry BEFORE any
        // retained contribution, Source request or output-reading allocation.
        // Only bounded native address vectors and borrowed rows are retained.
        let mut source_budget = budget::Budget::new();
        source_budget.reserve(512)?;
        if let Some(plan) = &active_controls {
            active::charge(
                plan,
                &before,
                &candidate,
                &actor,
                &operation_ref,
                &mut source_budget,
            )?;
        }
        for (contribution, owned, whole, parameter_locations) in &mut affected_entries {
            let contribution = *contribution;
            let whole = *whole;
            let owned = &*owned;
            if !whole && contribution["generated_basis"]["parameter"].is_string() {
                *parameter_locations = Some(source_parameter_addresses(&before, contribution)?);
            }
            // Bound actual borrowed repeated material before any Source
            // request, retained contribution or output-reading clone.
            source_budget.reserve(4096)?;
            source_budget.value(contribution)?;
            source_budget.value(owned)?;
            source_budget.value(&contribution["authored_overrides"])?;
            source_budget.value(expression_ref)?;
            source_budget.value(&actor)?;
            source_budget.value(&operation_ref)?;
            source_budget.value(&candidate.revision)?;
            source_budget.value(&contribution["contribution_ref"])?;
            source_budget.value(&contribution["procedure_ref"])?;
            if whole {
                source_budget.value(&before.selection)?;
                source_budget.value(&candidate.selection)?;
                source_budget.value(
                    &before
                        .scenes
                        .iter()
                        .map(|s| &s.scene_ref)
                        .collect::<Vec<_>>(),
                )?;
                source_budget.value(
                    &candidate
                        .scenes
                        .iter()
                        .map(|s| &s.scene_ref)
                        .collect::<Vec<_>>(),
                )?;
            } else {
                let location = parameter_locations.as_ref().unwrap_or(owned)[0]
                    .scene_ref
                    .as_deref()
                    .ok_or("Native material location unavailable")?;
                let original = before
                    .scenes
                    .iter()
                    .find(|s| s.scene_ref == location)
                    .and_then(|s| s.presentation.as_ref())
                    .ok_or("Original actual Scene material unavailable")?;
                source_budget.material(original)?;
                source_budget.entity_refs(original)?;
                if let Some(next) = candidate
                    .scenes
                    .iter()
                    .find(|s| s.scene_ref == location)
                    .and_then(|s| s.presentation.as_ref())
                {
                    source_budget.material(next)?;
                    source_budget.entity_refs(next)?;
                } else {
                    let definition =
                        definition_ref(&before, retained_text(contribution, "procedure_ref")?)?;
                    source_budget.value(definition)?;
                    // Deletion also embeds the full original contribution in its
                    // Source input, separately from the protected retained copy.
                    source_budget.value(contribution)?;
                    // A deletion additionally carries its exact authored
                    // canonical source and retention before true removal.
                    let outputs = definition["recipe_parameters"]["native_program"]["outputs"]
                        .as_array()
                        .ok_or("Original deletion constructor missing")?;
                    for output in outputs.iter().filter(|o| {
                        o["output_slot"] == contribution["output_slot"]
                            && o["scene_ref"] == contribution["occurrence_ref"]
                    }) {
                        let source = &output["source"];
                        let anchor = source["scene_ref"]
                            .as_str()
                            .ok_or("Original deletion anchor missing")?;
                        let actual = before
                            .scenes
                            .iter()
                            .find(|s| s.scene_ref == anchor)
                            .and_then(|s| s.presentation.as_ref())
                            .ok_or("Actual deletion anchor missing")?;
                        source_budget.material(actual)?;
                        source_budget.value(&actual.scene["procedural"])?;
                        // The original definition already includes its source
                        // recipe. Charge only the extra ACTUAL anchor fields
                        // emitted beside the material/retention above.
                        let target = address(&before, Some(anchor), None, Component::Scene);
                        let exact = before
                            .scenes
                            .iter()
                            .flat_map(bindings)
                            .find(|binding| {
                                serde_json::from_value::<Address>(binding["address"].clone())
                                    .is_ok_and(|address| address == target)
                            })
                            .ok_or("Exact deletion anchor manifestation unavailable")?;
                        source_budget.value(&exact["principal"])?;
                        source_budget.value(&exact["contributors"])?;
                        source_budget.value(&exact["locus"])?;
                        source_budget.value(&anchor)?;
                        source_budget.value(&before.revision)?;
                    }
                }
            }
        }
        // Only the fully admitted byte/count cohort reaches live Source
        // qualification and materialization. Flow comparison above borrowed
        // actual Selection/order; flow JSON is created only here.
        let mut entries =
            Vec::with_capacity(affected_entries.len() + usize::from(active_controls.is_some()));
        if let Some(plan) = &mut active_controls {
            active::qualify(self, plan, &before)?;
            entries.push(active::entry(
                self,
                plan,
                &before,
                &candidate,
                &actor,
                &operation_ref,
            )?);
        }
        for (contribution, owned, whole, parameter_locations) in affected_entries {
            let reference = retained_text(contribution, "contribution_ref")?;
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
                    let Some(current) = document.scenes.iter().find(|s| &s.scene_ref == location)
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
        if entries.is_empty() {
            if checkpoint_metadata_changed {
                return Err(
                    "Checkpoint override history requires its affected native Source owner".into(),
                );
            }
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
            accepted,
            active_controls,
        }))
    }

    pub(crate) fn finish_procedural_manual_candidate(
        &mut self,
        client: &CentralClient,
        prepared: ManualCandidate,
        actual: ManualBatchRecords,
    ) -> Result<(Value, Vec<Changed>), String> {
        if self.document(&prepared.before.expression_ref)? != &prepared.before {
            return Err(
                "Original edit basis changed during source preflight; retain the exact intent"
                    .into(),
            );
        }
        for entry in &prepared.entries {
            if entry.request["action"] == "active_controls_refresh" {
                active::reattest(
                    self,
                    prepared
                        .active_controls
                        .as_ref()
                        .ok_or("Joined native control plan missing")?,
                    &prepared.before,
                )?;
                continue;
            }
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
            if entry.request["action"] == "active_controls_refresh" {
                active::merge(
                    prepared
                        .active_controls
                        .as_ref()
                        .ok_or("Joined native control plan missing")?,
                    &prepared.before,
                    &mut candidate,
                    &result,
                    &prepared.actor,
                    &prepared.operation_ref,
                )?;
                continue;
            }
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
        if let Some(accepted) = prepared.accepted {
            // Source metadata belongs to this accepted revision, while every
            // native proposal/decision event retains its original actor/ref.
            for scene in &mut candidate.scenes {
                if prepared
                    .before
                    .scenes
                    .iter()
                    .find(|old| old.scene_ref == scene.scene_ref)
                    .is_some_and(|old| old.presentation != scene.presentation)
                {
                    scene.revision = candidate.revision;
                }
            }
            let (mut data, events) =
                self.commit_accepted_candidate(&prepared.before, candidate, accepted)?;
            data["native_procedural_receipts"] = json!([]);
            data["native_procedural_source"] = actual.native_reply;
            return Ok((data, events));
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
        Ok((data, changed.into_iter().collect()))
    }
}

#[cfg(test)]
mod accepted_tests {
    use super::*;
    fn request(value: Value) -> ExpressionRequest {
        serde_json::from_value(value).unwrap()
    }
    fn live() -> (CentralClient, Application) {
        // These native in-memory operations have no I/O. An unusable executable
        // proves the tests do not substitute a classifier or Source server.
        let client = CentralClient::with("/nonexistent/oi".into(), None, String::new());
        let mut app = Application::default();
        app.apply(&client, request(json!({"operation":"create","expression_ref":"expression:acceptance","title":"Acceptance","actor":"human:owner"}))).unwrap();
        app.apply(&client, request(json!({"operation":"edit","expression_ref":"expression:acceptance","expected_revision":1,"actor":"human:owner","changes":[{"change":"entity_add","scene_ref":"expression:acceptance:scene:main","entity_ref":"expression:acceptance:entity:target","title":"Target"}]}))).unwrap();
        (client, app)
    }
    fn proposal(revision: u64) -> ExpressionRequest {
        request(
            json!({"operation":"propose","expression_ref":"expression:acceptance","expected_revision":revision,
            "proposal_ref":"expression:acceptance:proposal:focus","actor":"agent-session:epii",
            "activity_ref":"agent-session:epii#original-answer","summary":"Focus the cited target",
            "changes":[{"change":"focus","scene_ref":"expression:acceptance:scene:main","entity_ref":"expression:acceptance:entity:target"}],
            "method_refs":[],"evidence_refs":[]}),
        )
    }
    fn review(revision: u64) -> ExpressionRequest {
        request(
            json!({"operation":"review","expression_ref":"expression:acceptance","expected_revision":revision,
            "proposal_ref":"expression:acceptance:proposal:focus","actor":"human:reviewer","decision":"accepted",
            "reason":"Accepted the original source concern","corrections":[]}),
        )
    }
    #[test]
    fn reviewed_candidate_keeps_original_history_and_both_native_events() {
        let (client, mut app) = live();
        let original = proposal(2);
        let original_bytes = serde_json::to_vec(&original).unwrap();
        let before = app.document("expression:acceptance").unwrap().clone();
        let (basis, candidate, accepted) = app
            .accepted_reviewed_candidate(
                &client,
                &original,
                "human:reviewer",
                "Reviewed the cited source",
            )
            .unwrap();
        assert_eq!(app.document("expression:acceptance").unwrap(), &before);
        assert_eq!(basis, before);
        assert_eq!(
            accepted
                .events
                .iter()
                .map(|event| event.revision)
                .collect::<Vec<_>>(),
            [3, 4]
        );
        assert_eq!(accepted.events[0].actor, "agent-session:epii");
        assert_eq!(
            accepted.events[0].activity_ref.as_deref(),
            Some("agent-session:epii#original-answer")
        );
        assert_eq!(accepted.events[1].actor, "human:reviewer");
        assert!(accepted.events[1].activity_ref.is_none());
        assert_eq!(
            candidate.refinements[0].proposal_ref,
            "expression:acceptance:proposal:focus"
        );
        assert_eq!(
            candidate.refinements[0].decision.as_ref().unwrap().reason,
            "Reviewed the cited source"
        );
        let (expected, events) = app
            .apply_reviewed_focus(
                &client,
                original.clone(),
                "human:reviewer".into(),
                "Reviewed the cited source".into(),
            )
            .unwrap();
        assert_eq!(
            serde_json::to_value(&candidate).unwrap(),
            expected["document"]
        );
        assert_eq!(
            serde_json::to_value(accepted.events).unwrap(),
            serde_json::to_value(events).unwrap()
        );
        assert_eq!(serde_json::to_vec(&original).unwrap(), original_bytes);
    }
    #[test]
    fn accepted_review_candidate_uses_original_review_and_exact_live_cas() {
        let (client, mut app) = live();
        app.apply(&client, proposal(2)).unwrap();
        let original = review(3);
        let before = app.document("expression:acceptance").unwrap().clone();
        let (basis, candidate, accepted) = app
            .accepted_request_candidate(&client, &original)
            .unwrap()
            .unwrap();
        assert_eq!(app.document("expression:acceptance").unwrap(), &before);
        assert_eq!(basis, before);
        assert_eq!(accepted.events.len(), 1);
        assert_eq!(accepted.events[0].actor, "human:reviewer");
        assert_eq!(accepted.events[0].revision, 4);
        assert!(accepted.events[0].activity_ref.is_none());
        let (actual, changed) = app.apply(&client, original).unwrap();
        assert_eq!(actual["document"], serde_json::to_value(candidate).unwrap());
        assert_eq!(
            serde_json::to_value(changed.unwrap()).unwrap(),
            serde_json::to_value(&accepted.events[0]).unwrap()
        );
        assert!(
            app.accepted_request_candidate(&client, &review(3))
                .unwrap()
                .is_none()
        );
        assert_eq!(app.document("expression:acceptance").unwrap().revision, 4);
    }
    #[test]
    fn restore_candidate_preserves_native_history_actor_and_admitted_noop() {
        let (client, mut app) = live();
        let checkpoint = app.document("expression:acceptance").unwrap().clone();
        let noop = ExpressionRequest::Restore {
            expression_ref: checkpoint.expression_ref.clone(),
            expected_revision: checkpoint.revision,
            document: Box::new(checkpoint.clone()),
            actor: "nara:original:checkpoint-return".into(),
        };
        assert!(
            app.accepted_request_candidate(&client, &noop)
                .unwrap()
                .is_none()
        );
        let (read, changed) = app.apply(&client, noop).unwrap();
        assert_eq!(read["state"], "ready");
        assert!(changed.is_none());
        app.apply_reviewed_focus(
            &client,
            proposal(2),
            "human:reviewer".into(),
            "Reviewed the source".into(),
        )
        .unwrap();
        let restore = ExpressionRequest::Restore {
            expression_ref: checkpoint.expression_ref.clone(),
            expected_revision: 4,
            document: Box::new(checkpoint),
            actor: "nara:original:checkpoint-return".into(),
        };
        let (basis, candidate, accepted) = app
            .accepted_request_candidate(&client, &restore)
            .unwrap()
            .unwrap();
        assert_eq!(app.document("expression:acceptance").unwrap(), &basis);
        assert_eq!(candidate.revision, 5);
        assert!(
            candidate.refinements.is_empty(),
            "Restore keeps the original checkpoint history, without synthetic Edit history"
        );
        assert_eq!(accepted.events[0].actor, "nara:original:checkpoint-return");
        let (actual, changed) = app.apply(&client, restore).unwrap();
        assert_eq!(actual["document"], serde_json::to_value(candidate).unwrap());
        assert_eq!(
            serde_json::to_value(changed.unwrap()).unwrap(),
            serde_json::to_value(&accepted.events[0]).unwrap()
        );
    }
    #[test]
    fn accepted_candidate_cannot_overwrite_an_intervening_native_edit() {
        let (client, mut app) = live();
        let (basis, candidate, accepted) = app
            .accepted_reviewed_candidate(
                &client,
                &proposal(2),
                "human:reviewer",
                "Reviewed the source",
            )
            .unwrap();
        app.apply(&client, request(json!({"operation":"edit","expression_ref":"expression:acceptance","expected_revision":2,
            "actor":"human:owner","changes":[{"change":"rename","title":"Intervening work"}]}))).unwrap();
        let current = app.document("expression:acceptance").unwrap().clone();
        assert!(
            app.commit_accepted_candidate(&basis, candidate, accepted)
                .is_err()
        );
        assert_eq!(app.document("expression:acceptance").unwrap(), &current);
        assert!(current.refinements.is_empty());
    }
    #[test]
    fn ordinary_reviewed_focus_without_procedures_needs_no_source_service() {
        let (client, mut app) = live();
        let before = app.document("expression:acceptance").unwrap().clone();
        assert!(
            app.prepare_procedural_reviewed_focus(
                &client,
                &proposal(2),
                "human:reviewer",
                "Reviewed the source"
            )
            .unwrap()
            .is_none()
        );
        assert_eq!(app.document("expression:acceptance").unwrap(), &before);
        let (data, events) = app
            .finish_procedural_reviewed_focus(
                &client,
                proposal(2),
                "human:reviewer".into(),
                "Reviewed the source".into(),
                None,
            )
            .unwrap();
        assert_eq!(data["document"]["revision"], 4);
        assert_eq!(events.len(), 2);
        assert!(
            data.get("native_procedural_source").is_none(),
            "No Source receipt can be fabricated for a bypass"
        );
    }
}
