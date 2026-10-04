//! Authored contact -> the SAME current Scene/Manager/private native channel.
//! Definitions are ordinary Scene source. Native origins, reservations, force,
//! queue handles and application dates are never accepted from the caller.
use super::{Manager, NativeSceneOperationRefusal};
use crate::expression::procedural::scene_receiver::SceneOwner;
use crate::expression::{Change, Document, Request as ExpressionRequest};
use crate::expression_performance::{
    contact::AuthoredContactDefinition, Counter, Performance, PerformanceOperation,
    MAX_PERFORMANCE_BYTES,
};
use crate::expression_performance_source_asset::NativePerformanceSourceAsset;
use crate::expression_procedural_scene_reader::NativeSceneSourceReader;
use crate::native_expression::act_channel::NativeActChannelReply;
use crate::native_expression::act_diagnostics::NativeDiagnosticReceipts;
use crate::native_expression::recording::{
    compile_original_pulse, require_retained_recording_prefix, RecordingIntent,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::Write;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ContactSceneEdit {
    pub request_id: Counter,
    pub lease: String,
    pub expression_ref: String,
    pub document_revision: u64,
    pub scene_ref: String,
    pub scene_revision: u64,
    pub actor: String,
    pub basis: u16,
    pub layer: u16,
    pub declared_seed: Counter,
    pub definition: Box<AuthoredContactDefinition>,
}
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ContactSceneTrigger {
    pub request_id: Counter,
    pub lease: String,
    pub expression_ref: String,
    pub document_revision: u64,
    pub scene_ref: String,
    pub scene_revision: u64,
    pub actor: String,
    pub basis: u16,
    pub layer: u16,
    pub declared_seed: Counter,
    pub contact_ref: String,
}

/// No Clone/Deserialize/JSON constructor. The original qualified reply mints
/// the candidate only inside the same closed CurrentDocument operation.
struct PreparedCurrentSceneContact {
    original_request_id: u64,
    native_boundary: Value,
    source: Value,
    constructor: Value,
}
struct OriginalContactReply {
    mode: String,
    request_id: u64,
    value: Option<Value>,
    diagnostics: NativeDiagnosticReceipts,
    delivery_attempted: bool,
}
impl OriginalContactReply {
    fn received(mode: &str, request_id: u64, reply: NativeActChannelReply) -> Self {
        let (value, diagnostics) = reply.into_custody();
        Self {
            mode: mode.into(),
            request_id,
            value: Some(value),
            diagnostics,
            delivery_attempted: true,
        }
    }
    fn refused(
        mode: &str,
        request_id: u64,
        refusal: NativeSceneOperationRefusal,
    ) -> (String, Self) {
        let (reason, value, diagnostics, delivery_attempted) = refusal.into_recording_custody();
        (
            reason,
            Self {
                mode: mode.into(),
                request_id,
                value,
                diagnostics,
                delivery_attempted,
            },
        )
    }
    fn original_pulses(&self) -> Vec<&Value> {
        let mut pulses = Vec::new();
        if let Some(value) = self.value.as_ref() {
            if value["result"]["native_pulse"].is_object() {
                pulses.push(&value["result"]["native_pulse"]);
            }
            if let Some(receipts) = value["result"]["native_receipts"].as_array() {
                pulses.extend(receipts.iter());
            }
        }
        pulses
    }
}
/// Failed/uncertain effects and complete original PrivateFiles remain on the
/// SAME Manager. No later command may replace them or reissue the occurrence.
pub(crate) struct NativeSceneContactCustody {
    reason: String,
    originals: Vec<OriginalContactReply>,
}
impl std::fmt::Debug for NativeSceneContactCustody {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeSceneContactCustody")
            .field("reason", &self.reason)
            .field("original_count", &self.originals.len())
            .finish()
    }
}
impl Manager {
    pub fn write_native_scene_contact_original(
        &self,
        index: usize,
        out: &mut impl Write,
    ) -> Result<(), String> {
        let original = self
            .contact_custody
            .as_ref()
            .ok_or("original Contact custody absent")?
            .originals
            .get(index)
            .ok_or("original Contact receipt index absent")?;
        serde_json::to_writer(
            out,
            original
                .value
                .as_ref()
                .ok_or("Contact delivered without a returned receipt")?,
        )
        .map_err(|e| e.to_string())
    }
    pub fn write_native_scene_contact_diagnostic(
        &self,
        index: usize,
        ordinal: u64,
        out: &mut impl Write,
    ) -> Result<(), String> {
        self.contact_custody
            .as_ref()
            .ok_or("original Contact custody absent")?
            .originals
            .get(index)
            .ok_or("original Contact receipt index absent")?
            .diagnostics
            .write_receipt(ordinal, out)
    }
}

pub(super) fn is_contact_mode(mode: &str) -> bool {
    matches!(
        mode,
        "contact-prepare" | "contact-apply" | "contact-trigger"
    )
}
/// Only the private Manager child calls this validator. Structural equality
/// alone confers no Scene lifetime: Kernel supplies the live SceneOwner fact.
pub(super) fn validate_private_query(
    reader: &NativeSceneSourceReader<'_>,
    mode: &str,
    query: &Value,
) -> Result<(), String> {
    let names = [
        "schema",
        "scene_constructor",
        "contact_ref",
        "retention_reservation",
    ];
    let obj = query.as_object().ok_or("private Contact query absent")?;
    if obj.len() != names.len() + usize::from(mode == "contact-apply")
        || names.iter().any(|key| !obj.contains_key(*key))
        || query["schema"] != "ql.native-scene-contact-command/v1"
        || (mode == "contact-apply") != obj.contains_key("original_contact_origin")
    {
        return Err("private Contact query fields/phase differ".into());
    }
    let doc = reader.document();
    let scene = reader.scene();
    let fact = &query["scene_constructor"];
    if fact["schema"] != "oi.native-document-scene-constructor/v1"
        || fact["expression_ref"] != doc.expression_ref
        || fact["document_revision"] != doc.revision
        || fact["scene_ref"] != scene.scene_ref
        || fact["document_sha256"]
            != crate::native_expression::procedural::bootstrap::fingerprint(doc)?
    {
        return Err("private Contact source lost complete current Doc/Scene".into());
    }
    scene
        .performance
        .as_ref()
        .ok_or("Contact performance absent")?
        .contact_definition(
            query["contact_ref"]
                .as_str()
                .ok_or("authored Contact selection absent")?,
        )?;
    Ok(())
}

/// Reserve the actual next complete asset before any queue delivery. Current
/// source parts are raw bounded NativeSource parts; FIELD's dense input parts
/// have their own existing catalog and are never counted as a fake new clock.
fn reservation(performance: &Performance, basis: u16) -> Result<Value, String> {
    let selected = performance
        .bases
        .get(usize::from(basis))
        .ok_or("Contact basis absent")?;
    let total = crate::expression_act_storage::measure(performance, MAX_PERFORMANCE_BYTES)?;
    let mut largest_asset = 0usize;
    let mut largest_bundle = 0usize;
    let mut found = false;
    for asset in performance
        .native_sources
        .iter()
        .filter(|a| a.basis_digest() == selected.content_digest)
    {
        asset.require_source_context(selected)?;
        largest_asset = largest_asset.max(crate::expression_act_storage::measure(
            asset,
            MAX_PERFORMANCE_BYTES,
        )?);
        largest_bundle = largest_bundle.max(crate::expression_act_storage::measure(
            asset.native_bundle(),
            MAX_PERFORMANCE_BYTES,
        )?);
        found = true;
    }
    if !found {
        return Err("Contact has no full original native source epoch".into());
    }
    let fixed = largest_asset
        .checked_add(largest_bundle)
        .and_then(|n| n.checked_add(4096))
        .ok_or("Contact byte reservation exhausted")?;
    let part = crate::expression_performance_assets::MAX_ENCODED_BYTES
        .checked_sub(fixed)
        .ok_or("next complete Contact part cannot fit unchanged native bound")?;
    let whole = MAX_PERFORMANCE_BYTES
        .checked_sub(total)
        .and_then(|n| n.checked_sub(fixed))
        .ok_or("next complete Contact performance cannot fit unchanged native bound")?;
    let allowance = part.min(whole) / 3; // two complete source copies and one complete original pulse
    if allowance == 0 {
        return Err("Contact has no complete record/pulse retention reservation".into());
    }
    Ok(
        json!({"schema":"ql.native-contact-retention-reservation/v1",
        "source_record_bytes_limit":allowance.to_string(),"native_pulse_bytes_limit":allowance.to_string()}),
    )
}

struct ContactIntent<'a> {
    lease: &'a str,
    expression_ref: &'a str,
    document_revision: u64,
    scene_ref: &'a str,
    scene_revision: u64,
    actor: &'a str,
    basis: u16,
    layer: u16,
    seed: u64,
    request_id: u64,
    contact_ref: &'a str,
}
impl crate::Kernel {
    fn contact_snapshot(
        &self,
        input: &ContactIntent<'_>,
    ) -> Result<(Document, SceneOwner), String> {
        if self.native_expression.recording_failure.is_some()
            || self.native_expression.contact_custody.is_some()
            || self.native_expression.recording_cut.is_some()
        {
            return Err(
                "original native recording/Contact failure remains held; no contact resend".into(),
            );
        }
        let active = self
            .native_expression
            .active
            .as_ref()
            .ok_or("Contact native Manager absent")?;
        if active.lease != input.lease
            || active.last_request_id.checked_add(1) != Some(input.request_id)
        {
            return Err("Contact lease/outer ordinal stale; use the SAME InstrumentSession".into());
        }
        let before = self
            .expressions
            .procedural_source_snapshot(input.expression_ref, input.document_revision)?;
        let scene = before
            .scenes
            .iter()
            .find(|s| s.scene_ref == input.scene_ref)
            .ok_or("current Contact Scene absent")?;
        if scene.revision != input.scene_revision {
            return Err("current Contact Scene revision stale".into());
        }
        let performance = scene
            .performance
            .as_ref()
            .ok_or("Contact has no native performance")?;
        require_retained_recording_prefix(
            performance,
            &RecordingIntent {
                actor: input.actor.into(),
                basis: input.basis,
                layer: input.layer,
            },
        )?;
        let basis = performance
            .bases
            .get(usize::from(input.basis))
            .ok_or("Contact recording basis absent")?;
        if basis.seed != Counter(input.seed)
            || basis.identity.instance_ref != active.identity["instance_ref"]
        {
            return Err("Contact changed actual source owner/declared Return seed".into());
        }
        let owner = self
            .expressions
            .procedural_scene_owner(&before, input.scene_ref)?;
        self.expressions
            .require_procedural_scene_owner(&owner, &before)?;
        Ok((before, owner))
    }
    fn contact_exchange(
        &mut self,
        input: &ContactIntent<'_>,
        owner: &SceneOwner,
        before: &Document,
        mode: &str,
        origin: Option<&PreparedCurrentSceneContact>,
    ) -> Result<
        crate::expression_procedural_scene_reader::NativeSceneCustodyOutcome<
            Result<NativeActChannelReply, NativeSceneOperationRefusal>,
        >,
        String,
    > {
        self.expressions
            .require_procedural_scene_owner(owner, before)?;
        let scene = before
            .scenes
            .iter()
            .find(|s| s.scene_ref == input.scene_ref)
            .ok_or("Contact Scene absent")?;
        let performance = scene
            .performance
            .as_ref()
            .ok_or("Contact performance absent")?;
        require_retained_recording_prefix(
            performance,
            &RecordingIntent {
                actor: input.actor.into(),
                basis: input.basis,
                layer: input.layer,
            },
        )?;
        performance.contact_definition(input.contact_ref)?;
        let constructor = owner.closed_constructor_fact(before, input.scene_ref)?;
        if origin.is_some_and(|p| {
            p.constructor["instance_ref"] != constructor["instance_ref"]
                || p.constructor["construction_generation"]
                    != constructor["construction_generation"]
                || p.constructor["generation_domain"] != constructor["generation_domain"]
        }) {
            return Err("Contact prepare replaced its actual native Scene constructor".into());
        }
        let mut query = json!({"schema":"ql.native-scene-contact-command/v1","scene_constructor":constructor,
            "contact_ref":input.contact_ref,"retention_reservation":reservation(performance,input.basis)?});
        if let Some(original) = origin {
            query["original_contact_origin"] = json!({"original_native_request_id":original.original_request_id.to_string(),"native_boundary":original.native_boundary});
        }
        self.with_native_document_scene(
            input.expression_ref,
            before.revision,
            input.scene_ref,
            scene.revision,
            |manager, reader| {
                Ok(manager.closed_native_scene_operation_custodied(
                    input.lease,
                    &NativeSceneSourceReader::CurrentDocument(reader),
                    mode,
                    None,
                    Some(query),
                    Some(input.seed),
                ))
            },
        )
    }
    fn contact_adopt_pulse(
        &mut self,
        input: &ContactIntent<'_>,
        owner: &SceneOwner,
        before: &Document,
        original: &NativeActChannelReply,
        edits: &mut Vec<crate::KernelOpOutcome>,
    ) -> Result<Document, String> {
        self.expressions
            .require_procedural_scene_owner(owner, before)?;
        let envelope = original.value();
        let result = &envelope["result"];
        let selected = &result["selection"];
        let scene = before
            .scenes
            .iter()
            .find(|s| s.scene_ref == input.scene_ref)
            .ok_or("Contact current Scene absent")?;
        let performance = scene
            .performance
            .as_ref()
            .ok_or("Contact performance absent")?;
        let original_basis = performance
            .bases
            .get(usize::from(input.basis))
            .ok_or("Contact basis absent")?;
        if envelope["schema"] != "ql.native-act-owner-result/v1"
            || envelope["available"] != true
            || envelope["status"] != "ok"
            || result["accepted"] != true
            || selected["native_parent_qualification"] != *original.qualification()
            || selected["source_custody"] != "current-document"
            || selected["expression_ref"] != before.expression_ref
            || selected["expression_revision"] != before.revision
            || selected["scene_ref"] != scene.scene_ref
            || selected["scene_revision"] != scene.revision
            || selected["expanded_document_sha256"]
                != crate::expression_file::digest(
                    &serde_json::to_vec(before).map_err(|e| e.to_string())?,
                )
            || selected["selected_scene_sha256"]
                != crate::expression_file::digest(
                    &serde_json::to_vec(scene).map_err(|e| e.to_string())?,
                )
        {
            return Err("Contact lost original qualified current Scene/whole Doc reply".into());
        }
        let artifact = &result["source_artifact"];
        let basis: crate::expression_performance::PerformanceBasis =
            serde_json::from_value(artifact["basis"].clone()).map_err(|e| e.to_string())?;
        if basis.seal()? != *original_basis {
            return Err("Contact altered original complete musical/body basis".into());
        }
        let source = NativePerformanceSourceAsset::from_native_artifact(original_basis, artifact)?;
        source.require_source_context(original_basis)?;
        let source_performance =
            performance.edited(vec![PerformanceOperation::RetainNativeSource {
                source: Box::new(source),
            }])?;
        let recording = compile_original_pulse(
            &source_performance,
            &RecordingIntent {
                actor: input.actor.into(),
                basis: input.basis,
                layer: input.layer,
            },
            &result["native_pulse"],
        )?;
        let prospective = recording
            .as_ref()
            .map_or(&source_performance, |r| r.prospective());
        prospective.validate()?;
        // Existing native part/catalog validation happens before ordinary CAS.
        crate::expression_performance_assets::PerformancePartCatalog::default()
            .appended(prospective)?;
        if prospective == performance {
            return Ok(before.clone());
        }
        let outcome = self.apply(crate::KernelOp::Expression {
            request: ExpressionRequest::Edit {
                expression_ref: before.expression_ref.clone(),
                expected_revision: before.revision,
                actor: input.actor.into(),
                changes: vec![Change::ScenePerformanceSet {
                    scene_ref: input.scene_ref.into(),
                    performance: prospective.clone(),
                }],
            },
        })?;
        // Retain the ACTUAL ordinary edit before post-commit verification can
        // refuse. A committed Doc cannot be reported as an uncommitted contact.
        edits.push(outcome);
        let after = self.expressions.procedural_source_snapshot(
            input.expression_ref,
            before
                .revision
                .checked_add(1)
                .ok_or("Contact Doc revision exhausted")?,
        )?;
        let current = after
            .scenes
            .iter()
            .find(|s| s.scene_ref == input.scene_ref)
            .ok_or("Contact Scene lost after actual edit")?;
        if current.performance.as_ref() != Some(prospective) {
            return Err("ordinary Contact edit lost original source/pages".into());
        }
        let next = self
            .expressions
            .procedural_scene_owner(&after, input.scene_ref)?;
        self.expressions
            .require_procedural_scene_owner(&next, &after)?;
        if next.instance_ref() != owner.instance_ref()
            || next.construction_generation() != owner.construction_generation()
            || next.generation_domain() != owner.generation_domain()
        {
            return Err("Contact edit replaced actual Scene constructor".into());
        }
        Ok(after)
    }
}

impl crate::Kernel {
    fn contact_phase(
        &mut self,
        input: &ContactIntent<'_>,
        before: &Document,
        owner: &SceneOwner,
        mode: &str,
        candidate: Option<&PreparedCurrentSceneContact>,
        originals: &mut Vec<OriginalContactReply>,
        edits: &mut Vec<crate::KernelOpOutcome>,
    ) -> Result<(Document, Option<PreparedCurrentSceneContact>), String> {
        let closed = self.contact_exchange(input, owner, before, mode, candidate)?;
        let received = closed.result?;
        let channel = match received {
            Ok(reply) => reply,
            Err(refusal) => {
                let (reason, original) =
                    OriginalContactReply::refused(mode, input.request_id, refusal);
                originals.push(original);
                return Err(reason);
            }
        };
        let prepared = (|| -> Result<(Document, Option<PreparedCurrentSceneContact>), String> {
            closed.currentness?;
            let envelope = channel.value();
            let result = &envelope["result"];
            if serde_json::from_value::<Counter>(envelope["request_id"].clone())
                .map_err(|e| e.to_string())?
                != Counter(input.request_id)
                || result["host_receipt"]["schema"] != "ql.field-host-receipt/v1"
                || result["host_receipt"]["request_id"] != input.request_id.to_string()
                || result["host_receipt"]["last_request_id"] != input.request_id.to_string()
            {
                return Err(
                    "Contact lost its original SAME InstrumentSession acknowledgement".into(),
                );
            }
            if result["accepted"] != true {
                return Err(result["reason"]
                    .as_str()
                    .unwrap_or("actual native Contact refused")
                    .into());
            }
            let prepared = if mode == "contact-prepare" {
                let source = &result["native_pulse"]["payload"]["prepared_contact"];
                if result["queue_committed"] != false
                    || source["schema"] != "ql.native-scene-contact-source/v1"
                    || source["original_native_request_id"] != input.request_id.to_string()
                    || source["authored_definition"]["contact_ref"] != input.contact_ref
                    || source["scene_constructor"]
                        != owner.closed_constructor_fact(before, input.scene_ref)?
                {
                    return Err(
                        "Contact preparation lost its complete original source/ordinal/constructor"
                            .into(),
                    );
                }
                Some(PreparedCurrentSceneContact {
                    original_request_id: input.request_id,
                    native_boundary: source["native_boundary"].clone(),
                    source: source.clone(),
                    constructor: source["scene_constructor"].clone(),
                })
            } else {
                if result["queue_committed"] != true || result["application_committed"] != false {
                    return Err(
                        "Contact apply lost actual queued standing; no callback has committed yet"
                            .into(),
                    );
                }
                if let Some(candidate) = candidate {
                    if result["native_pulse"]["payload"]["contact_source"] != candidate.source {
                        return Err(
                            "Contact apply replaced the original prepared occurrence".into()
                        );
                    }
                }
                None
            };
            let after = self.contact_adopt_pulse(input, owner, before, &channel, edits)?;
            Ok((after, prepared))
        })();
        originals.push(OriginalContactReply::received(
            mode,
            input.request_id,
            channel,
        ));
        let (after, prepared) = prepared?;
        Ok((after, prepared))
    }
    fn contact_current_source_selection(
        &self,
        document: &Document,
        scene_ref: &str,
        originals: &[OriginalContactReply],
    ) -> Result<Value, String> {
        // The actual completed operation supplies this Document and artifact.
        // A musical digest alone never selects a Contact/M4 source epoch.
        let current = self
            .expressions
            .procedural_source_snapshot(&document.expression_ref, document.revision)?;
        if current != *document {
            return Err("Contact final Document differs from registered current source".into());
        }
        let owner = self
            .expressions
            .procedural_scene_owner(&current, scene_ref)?;
        self.expressions
            .require_procedural_scene_owner(&owner, &current)?;
        let scene = current
            .scenes
            .iter()
            .find(|s| s.scene_ref == scene_ref)
            .ok_or("Contact final Scene absent")?;
        let performance = scene
            .performance
            .as_ref()
            .ok_or("Contact final performance absent")?;
        let artifact = &originals
            .last()
            .and_then(|r| r.value.as_ref())
            .ok_or("Contact final original reply absent")?["result"]["source_artifact"];
        let history_matches = |name: &str, retained: Option<&[Value]>| -> bool {
            match artifact.get(name) {
                None => retained.is_none(),
                Some(value) => value
                    .as_array()
                    .is_some_and(|rows| retained == Some(rows.as_slice())),
            }
        };
        let matches = performance
            .native_sources
            .iter()
            .enumerate()
            .filter(|(_, source)| {
                source.native_bundle() == &artifact["source_assets"]
                    && history_matches(
                        "native_physical_source_history",
                        source.native_physical_source_history(),
                    )
                    && history_matches(
                        "native_acoustic_source_history",
                        source.native_acoustic_source_history(),
                    )
                    && history_matches(
                        "native_contact_admission_history",
                        source.native_contact_admission_history(),
                    )
            })
            .collect::<Vec<_>>();
        if matches.len() != 1 {
            return Err(
                "Contact complete source epoch missing/ambiguous in actual final Scene".into(),
            );
        }
        let (source_index, source) = matches[0];
        let bases = performance
            .bases
            .iter()
            .enumerate()
            .filter(|(_, basis)| basis.content_digest == source.basis_digest())
            .collect::<Vec<_>>();
        if bases.len() != 1 {
            return Err("Contact complete musical basis missing/ambiguous".into());
        }
        let (basis_index, basis) = bases[0];
        source.require_source_context(basis)?;
        let actual_basis: crate::expression_performance::PerformanceBasis =
            serde_json::from_value(artifact["basis"].clone()).map_err(|e| e.to_string())?;
        if actual_basis.seal()? != *basis {
            return Err("Contact final artifact differs from complete C-sealed basis".into());
        }
        let source_sample = &source.native_bundle()["current_receiving"]["native_admission"]
            ["operation"]["native_sample"];
        serde_json::from_value::<Counter>(source_sample.clone()).map_err(|e| e.to_string())?;
        Ok(
            json!({"schema":"oi.native-current-performance-source-selection/v1",
            "expression_ref":current.expression_ref,"document_revision":current.revision,
            "scene_ref":scene.scene_ref,"scene_revision":scene.revision,
            "source_index":source_index,"basis_index":basis_index,
            "basis_digest":source.basis_digest(),"source_reading":source.reading()?,
            "source_sample":source_sample}),
        )
    }
    fn finish_contact_request(
        &mut self,
        result: Result<Document, String>,
        scene_ref: &str,
        originals: Vec<OriginalContactReply>,
        edits: Vec<crate::KernelOpOutcome>,
    ) -> Result<crate::KernelOpOutcome, String> {
        let attempted = originals.iter().any(|r| r.delivery_attempted);
        if result.is_err() && !attempted && edits.is_empty() {
            return Err(result.unwrap_err());
        }
        // Original files must not fall out of successful result serialization.
        // Contact normally returns complete bounded inline pulses; if a producer
        // streams originals, hold them until native disclosure exports them.
        let selection = result
            .as_ref()
            .ok()
            .map(|document| self.contact_current_source_selection(document, scene_ref, &originals))
            .transpose();
        let mut reason = result.err();
        let current_source_selection = match selection {
            Ok(value) => value,
            Err(error) => {
                reason = Some(error);
                None
            }
        };
        if originals.iter().any(|r| !r.diagnostics.is_empty()) && reason.is_none() {
            reason=Some("actual Contact original diagnostic files require native return/export; retained without resend".into());
        }
        let bounded = crate::expression_act_storage::measure(
            &(
                &originals.iter().map(|r| &r.value).collect::<Vec<_>>(),
                &edits,
            ),
            crate::native_expression::MAX_REPLY - 65536,
        );
        if let Err(error) = &bounded {
            reason = Some(error.clone());
        }
        let accepted = reason.is_none();
        let receipts = edits
            .iter()
            .flat_map(|e| e.receipts.iter().cloned())
            .collect();
        let original_readings = originals
            .iter()
            .map(|r| {
                json!({"mode":r.mode,
            "request_id":r.request_id.to_string(),"delivery_attempted":r.delivery_attempted,
            "native_reply":if bounded.is_ok(){r.value.as_ref()}else{None},
            "diagnostics":r.diagnostics.reading()})
            })
            .collect::<Vec<_>>();
        let queue_committed = if originals.iter().any(|r| {
            r.value
                .as_ref()
                .is_some_and(|v| v["result"]["queue_committed"] == true)
        }) {
            json!(true)
        } else if originals.iter().any(|r| {
            r.delivery_attempted
                && r.value.as_ref().is_none_or(|v| {
                    // No returned queue flag means unknown, except a received
                    // stopped renderer pulse which never performs queue admission.
                    !v["result"]["queue_committed"].is_boolean()
                        && !(r.mode == "recording-render"
                            && v["result"]["native_pulse"]["operation"] == "offline-render")
                })
        }) {
            Value::Null
        } else {
            json!(false)
        };
        let has_application = |pulse: &Value| {
            pulse["applications"]
                .as_array()
                .is_some_and(|apps| apps.iter().any(|app| app["applied"] == true))
        };
        let has_committed_state =
            |pulse: &Value| pulse["payload"]["chunk"]["state_committed"] == true;
        let applied = originals
            .iter()
            .any(|r| r.original_pulses().into_iter().any(has_application));
        let state_committed = originals
            .iter()
            .any(|r| r.original_pulses().into_iter().any(has_committed_state));
        let unknown = originals
            .iter()
            .any(|r| r.delivery_attempted && r.original_pulses().is_empty());
        let application_committed = if applied {
            json!(true)
        } else if unknown {
            Value::Null
        } else {
            json!(false)
        };
        let state_committed = if state_committed {
            json!(true)
        } else if unknown {
            Value::Null
        } else {
            json!(false)
        };
        let data = json!({"schema":"oi.native-scene-contact-result/v1","accepted":accepted,"reason":reason,
            "delivery_attempted":attempted,"queue_committed":queue_committed,"application_committed":application_committed,"native_state_committed":state_committed,
            "document_committed":!edits.is_empty(),
            "current_source_selection":current_source_selection,
            "applications":if bounded.is_ok(){Some(edits.iter().map(|e|&e.result).collect::<Vec<_>>())}else{None},
            "currentness":if accepted {json!({"Ok":null})}else{json!({"Err":reason})},
            "original_operations":original_readings});
        if !accepted && (attempted || !originals.is_empty()) {
            self.native_expression.contact_custody = Some(NativeSceneContactCustody {
                reason: reason.unwrap_or_else(|| "Contact original return refused".into()),
                originals,
            });
        }
        Ok(crate::KernelOpOutcome {
            receipts,
            result: crate::KernelOpResult::NativeExpression { data },
        })
    }
    pub(crate) fn native_contact_scene_edit(
        &mut self,
        request: ContactSceneEdit,
    ) -> Result<crate::KernelOpOutcome, String> {
        request.definition.validate()?;
        crate::expression::text(&request.actor)?;
        let contact_ref = request.definition.contact_ref.clone();
        let mut input = ContactIntent {
            lease: &request.lease,
            expression_ref: &request.expression_ref,
            document_revision: request.document_revision,
            scene_ref: &request.scene_ref,
            scene_revision: request.scene_revision,
            actor: &request.actor,
            basis: request.basis,
            layer: request.layer,
            seed: request.declared_seed.0,
            request_id: request.request_id.0,
            contact_ref: &contact_ref,
        };
        let (before, _) = self.contact_snapshot(&input)?;
        let mut originals = Vec::new();
        let mut edits = Vec::new();
        let result = (|| -> Result<Document, String> {
            // Author first through existing Document law. This neither admits a
            // native programme nor consumes the actual Host request ordinal.
            let authored = self.apply(crate::KernelOp::Expression {
                request: ExpressionRequest::Edit {
                    expression_ref: before.expression_ref.clone(),
                    expected_revision: before.revision,
                    actor: request.actor.clone(),
                    changes: vec![Change::ScenePerformanceEdit {
                        scene_ref: request.scene_ref.clone(),
                        operations: vec![PerformanceOperation::ContactDefinitionSet {
                            definition: request.definition,
                        }],
                    }],
                },
            })?;
            // Store the original edit receipt before its returned revision is
            // parsed, so even a malformed post-commit receipt remains custody.
            edits.push(authored);
            let actual_revision = match &edits
                .last()
                .ok_or("actual authored edit custody lost")?
                .result
            {
                crate::KernelOpResult::Expression { data } => data["document"]["revision"]
                    .as_u64()
                    .ok_or("authored Contact edit has no actual Doc revision")?,
                _ => return Err("authored Contact returned another operation".into()),
            };
            let after = self
                .expressions
                .procedural_source_snapshot(&request.expression_ref, actual_revision)?;
            input.document_revision = after.revision;
            input.scene_revision = after
                .scenes
                .iter()
                .find(|s| s.scene_ref == request.scene_ref)
                .ok_or("authored Contact Scene absent")?
                .revision;
            let (selected, owner) = self.contact_snapshot(&input)?;
            let (prepared_doc, candidate) = self.contact_phase(
                &input,
                &selected,
                &owner,
                "contact-prepare",
                None,
                &mut originals,
                &mut edits,
            )?;
            let candidate = candidate.ok_or("actual Contact candidate absent")?;
            input.document_revision = prepared_doc.revision;
            input.scene_revision = prepared_doc
                .scenes
                .iter()
                .find(|s| s.scene_ref == request.scene_ref)
                .ok_or("prepared Contact Scene absent")?
                .revision;
            input.request_id = self
                .native_expression
                .active
                .as_ref()
                .ok_or("Contact actual Manager lost after prepare")?
                .last_request_id
                .checked_add(1)
                .ok_or("Contact apply ordinal exhausted")?;
            let (selected, owner) = self.contact_snapshot(&input)?;
            let (after, _) = self.contact_phase(
                &input,
                &selected,
                &owner,
                "contact-apply",
                Some(&candidate),
                &mut originals,
                &mut edits,
            )?;
            Ok(after)
        })();
        self.finish_contact_request(result, &request.scene_ref, originals, edits)
    }
    pub(crate) fn native_contact_scene_trigger(
        &mut self,
        request: ContactSceneTrigger,
    ) -> Result<crate::KernelOpOutcome, String> {
        crate::expression::text(&request.contact_ref)?;
        let input = ContactIntent {
            lease: &request.lease,
            expression_ref: &request.expression_ref,
            document_revision: request.document_revision,
            scene_ref: &request.scene_ref,
            scene_revision: request.scene_revision,
            actor: &request.actor,
            basis: request.basis,
            layer: request.layer,
            seed: request.declared_seed.0,
            request_id: request.request_id.0,
            contact_ref: &request.contact_ref,
        };
        let (before, owner) = self.contact_snapshot(&input)?;
        before
            .scenes
            .iter()
            .find(|s| s.scene_ref == request.scene_ref)
            .ok_or("current Contact Scene absent")?
            .performance
            .as_ref()
            .ok_or("current Contact performance absent")?
            .contact_definition(&request.contact_ref)?;
        let mut originals = Vec::new();
        let mut edits = Vec::new();
        let result = self
            .contact_phase(
                &input,
                &before,
                &owner,
                "contact-trigger",
                None,
                &mut originals,
                &mut edits,
            )
            .map(|(after, _)| after);
        self.finish_contact_request(result, &request.scene_ref, originals, edits)
    }
}

/// Normal stopped audition under the current native Scene. Frames are an
/// authored bounded workload, not native time or a clock/mapping grant. The
/// existing checkpoint selector resolves only a complete captured C49 cut.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ContactSceneActivity {
    pub request_id: Counter,
    pub lease: String,
    pub expression_ref: String,
    pub document_revision: u64,
    pub scene_ref: String,
    pub scene_revision: u64,
    pub actor: String,
    pub basis: u16,
    pub layer: u16,
    pub frames: u32,
    pub checkpoint_ref: String,
}
pub(super) fn validate_private_render_query(
    reader: &NativeSceneSourceReader<'_>,
    query: &Value,
) -> Result<(), String> {
    let keys = ["schema", "scene_constructor", "frames"];
    let object = query
        .as_object()
        .ok_or("actual recording render query absent")?;
    if object.len() != keys.len()
        || keys.iter().any(|k| !object.contains_key(*k))
        || query["schema"] != "ql.native-scene-recording-render/v1"
        || query["frames"]
            .as_u64()
            .is_none_or(|n| !(1..=512).contains(&n))
    {
        return Err("native recording render authored workload/fields invalid".into());
    }
    let doc = reader.document();
    let scene = reader.scene();
    let fact = &query["scene_constructor"];
    if fact["schema"] != "oi.native-document-scene-constructor/v1"
        || fact["expression_ref"] != doc.expression_ref
        || fact["scene_ref"] != scene.scene_ref
        || fact["document_revision"] != doc.revision
        || fact["document_sha256"]
            != crate::native_expression::procedural::bootstrap::fingerprint(doc)?
        || reader.native_manifest()?["native_render_selection"]["schema"]
            != "oi.native-scene-recording-render-selection/v1"
    {
        return Err("native render lost the actual current closed Scene/captured cut".into());
    }
    Ok(())
}
impl crate::Kernel {
    pub(crate) fn native_contact_scene_activity(
        &mut self,
        request: ContactSceneActivity,
    ) -> Result<crate::KernelOpOutcome, String> {
        if !(1..=512).contains(&request.frames) {
            return Err("native stopped audition requires1..512 frames".into());
        }
        crate::expression::text(&request.checkpoint_ref)?;
        let before = self
            .expressions
            .procedural_source_snapshot(&request.expression_ref, request.document_revision)?;
        let scene = before
            .scenes
            .iter()
            .find(|s| s.scene_ref == request.scene_ref)
            .ok_or("native audition Scene absent")?;
        let performance = scene
            .performance
            .as_ref()
            .ok_or("native audition performance absent")?;
        let seed = performance
            .bases
            .get(usize::from(request.basis))
            .ok_or("native audition basis absent")?
            .seed
            .0;
        let input = ContactIntent {
            lease: &request.lease,
            expression_ref: &request.expression_ref,
            document_revision: request.document_revision,
            scene_ref: &request.scene_ref,
            scene_revision: request.scene_revision,
            actor: &request.actor,
            basis: request.basis,
            layer: request.layer,
            seed,
            request_id: request.request_id.0,
            contact_ref: "",
        };
        let (before, owner) = self.contact_snapshot(&input)?;
        let scene = before
            .scenes
            .iter()
            .find(|s| s.scene_ref == request.scene_ref)
            .ok_or("native audition Scene absent")?;
        let performance = scene
            .performance
            .as_ref()
            .ok_or("native audition performance absent")?;
        let mut cuts = performance
            .checkpoints
            .iter()
            .filter(|c| c.checkpoint_ref == request.checkpoint_ref);
        let cut = cuts
            .next()
            .ok_or("native audition existing captured checkpoint absent")?;
        if cuts.next().is_some() {
            return Err("native audition checkpoint selector ambiguous".into());
        }
        let query = json!({"schema":"ql.native-scene-recording-render/v1","scene_constructor":owner.closed_constructor_fact(&before,&request.scene_ref)?,"frames":request.frames});
        let closed = self.with_native_document_scene(
            &request.expression_ref,
            request.document_revision,
            &request.scene_ref,
            request.scene_revision,
            |manager, reader| {
                let render = reader.recording_render_view(request.basis, cut)?;
                Ok(manager.closed_native_scene_operation_custodied(
                    &request.lease,
                    &NativeSceneSourceReader::CurrentDocument(&render),
                    "recording-render",
                    None,
                    Some(query),
                    None,
                ))
            },
        )?;
        let mut originals = Vec::new();
        let mut edits = Vec::new();
        let result = (|| -> Result<Document, String> {
            let reply = match closed.result? {
                Ok(reply) => reply,
                Err(refusal) => {
                    let (reason, original) = OriginalContactReply::refused(
                        "recording-render",
                        input.request_id,
                        refusal,
                    );
                    originals.push(original);
                    return Err(reason);
                }
            };
            let validation = (|| -> Result<Document, String> {
                closed.currentness?;
                let envelope = reply.value();
                let result = &envelope["result"];
                if result["host_receipt"]["schema"] != "ql.field-host-receipt/v1"
                    || result["host_receipt"]["request_id"] != input.request_id.to_string()
                    || result["host_receipt"]["last_request_id"] != input.request_id.to_string()
                    || result["native_pulse"]["operation"] != "offline-render"
                {
                    return Err("native stopped audition lost original SAME callback/pulse/outer acknowledgement".into());
                }
                if result["accepted"] != true {
                    return Err(result["reason"]
                        .as_str()
                        .unwrap_or("native stopped audition refused")
                        .into());
                }
                self.contact_adopt_pulse(&input, &owner, &before, &reply, &mut edits)
            })();
            originals.push(OriginalContactReply::received(
                "recording-render",
                input.request_id,
                reply,
            ));
            validation
        })();
        self.finish_contact_request(result, &request.scene_ref, originals, edits)
    }
}

#[cfg(test)]
#[path = "native_expression_scene_contact_tests.rs"]
pub(crate) mod tests;
