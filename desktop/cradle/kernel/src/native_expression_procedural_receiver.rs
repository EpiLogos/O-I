//! Registered counterparts from the SAME private Source completion and real
//! Application Scene constructor. Transported contracts alone grant nothing.
use crate::expression::procedural::{scene_receiver::SceneOwner, Participant, Timing};
use crate::expression::{Application, Document};
use serde::ser::SerializeSeq;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;

use super::lifecycle::{CompletedSourceIntake, ReceivingBoundary};

/// Wire configuration only. Its private custody below has no serde constructor.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Requirement {
    owner: String,
    instance_ref: String,
    required_generation: u64,
    generation_domain: String,
}

#[derive(Serialize)]
struct BorrowedParticipant<'a> {
    owner: &'a str,
    instance_ref: &'a str,
    required_generation: u64,
    targets: &'a [crate::expression::procedural::Address],
}
struct BorrowedParticipants<'a> {
    requirements: &'a [Requirement],
    targets: &'a [crate::expression::procedural::Address],
}
impl Serialize for BorrowedParticipants<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut rows = serializer.serialize_seq(Some(self.requirements.len()))?;
        for requirement in self.requirements {
            rows.serialize_element(&BorrowedParticipant {
                owner: &requirement.owner,
                instance_ref: &requirement.instance_ref,
                required_generation: requirement.required_generation,
                targets: self.targets,
            })?;
        }
        rows.end()
    }
}
#[derive(Serialize)]
struct BorrowedBoundary<'a> {
    kind: &'static str,
    owner: &'a str,
    instance_ref: &'a str,
    cursor: u64,
}

/// One current Source qualification on the existing native Owner. This is not
/// a new registry or clock. A Document write makes definition assembly stale;
/// fresh no-write native bootstrap must issue another qualification.
#[derive(Debug)]
pub(in crate::native_expression) struct RegisteredConsumers {
    completion: CompletedSourceIntake,
    scene_owner: SceneOwner,
    document_fingerprint: String,
    contract: Value,
    requirements: Vec<Requirement>,
    source: Value,
}

fn text(value: &Value) -> Result<&str, String> {
    let value = value.as_str().ok_or("Native receiving reference absent")?;
    crate::expression::text(value)?;
    Ok(value)
}
fn cursor(value: &Value) -> Result<u64, String> {
    super::super::cursor(value)
}
fn owners(requirements: &[Requirement]) -> Result<BTreeSet<String>, String> {
    if !(2..=16).contains(&requirements.len()) {
        return Err("Actual native receiving roster is absent or exceeds its bound".into());
    }
    let mut owners = BTreeSet::new();
    let mut instances = BTreeSet::new();
    for r in requirements {
        crate::expression::text(&r.owner)?;
        crate::expression::text(&r.instance_ref)?;
        if r.required_generation == 0
            || !owners.insert(r.owner.clone())
            || !instances.insert(&r.instance_ref)
            || ![
                "native-document-scene-construction",
                "native-field-clock-construction",
                "native-management-construction",
                "native-resident-construction",
            ]
            .contains(&r.generation_domain.as_str())
        {
            return Err(
                "Native receiving constructor identity/domain is invalid or aliased".into(),
            );
        }
    }
    if !owners.contains("scene") {
        return Err("Actual native Scene consumer absent".into());
    }
    Ok(owners)
}
fn same_anchor(original: &Value, current: &Value) -> bool {
    ["owner_ref", "domain", "epoch_ref", "time_mapping_ref"]
        .iter()
        .all(|key| original.get(*key).is_some() && original[*key] == current[*key])
}

impl RegisteredConsumers {
    /// Only the actual successful C31 bootstrap completion invokes this. The
    /// Scene fact must come from Application's actual current private owner.
    fn from_bootstrap(
        application: &Application,
        before: &Document,
        scene_owner: SceneOwner,
        completion: CompletedSourceIntake,
    ) -> Result<Self, String> {
        application.require_procedural_scene_owner(&scene_owner, before)?;
        let reply = completion.reply();
        let source = &reply["procedural"];
        let contract = &source["consumer_contract"];
        let scene_ref = text(&source["scene_ref"])?;
        let actual_scene = scene_owner.closed_constructor_fact(before, scene_ref)?;
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            reply,
            &actual_scene,
        ))?;
        let rows = contract["requirements"]
            .as_array()
            .ok_or("Actual receiving requirement rows absent")?;
        if !(2..=16).contains(&rows.len()) {
            return Err("Actual receiving requirement bound exceeded before allocation".into());
        }
        let requirements: Vec<Requirement> =
            serde_json::from_value(contract["requirements"].clone())
                .map_err(|error| error.to_string())?;
        let owner_set = owners(&requirements)?;
        let declared: BTreeSet<String> =
            serde_json::from_value(contract["required_consumers"].clone())
                .map_err(|error| error.to_string())?;
        if reply["status"] != "ok"
            || source["schema"] != "ql.native-procedural-source-bootstrap/v1"
            || contract["schema"] != "ql.native-procedural-consumer-contract/v1"
            || source["expression_ref"] != before.expression_ref
            || source["document_revision"].as_u64() != Some(before.revision)
            || contract["expression_ref"] != before.expression_ref
            || contract["scene_ref"] != source["scene_ref"]
            || contract["document_revision"].as_u64() != Some(before.revision)
            || contract["material_fingerprint"] != source["source_material_fingerprint"]
            || contract["source_read_receipt_ref"] != source["source_read_receipt_ref"]
            || contract["original_native_position"] != source["native_position"]
            || contract["original_timing"] != source["timing"]
            || owner_set != declared
            || contract["required_consumers"] != json!(owner_set)
            || source["native_scene_constructor_fact"] != actual_scene
        {
            return Err(
                "Private Source roster differs from its actual current Scene/read/constructor"
                    .into(),
            );
        }
        let scene = requirements
            .iter()
            .find(|row| row.owner == "scene")
            .ok_or("Actual Source Scene role absent")?;
        if scene.instance_ref != scene_owner.instance_ref()
            || scene.required_generation != scene_owner.construction_generation()
            || scene.generation_domain != scene_owner.generation_domain()
        {
            return Err(
                "Native Source Scene role differs from the real Application constructor".into(),
            );
        }
        let timing_owner = text(&source["timing"]["owner_ref"])?;
        let timing = requirements
            .iter()
            .find(|row| row.owner == timing_owner)
            .ok_or("Actual Source timing role absent")?;
        validate_timing_requirement(
            timing,
            &source["timing"],
            &source["native_position"],
            &source["native_timing_consumer_fact"],
            field_receipt(reply),
            reply,
        )?;
        if source["timing"]["domain"] == "native_samples" {
            validate_performance_roster(&requirements, &source["timing"], reply)?;
        }
        let basis = json!({"scene":actual_scene,"management":source["native_timing_consumer_fact"],
            "residents":if source["timing"]["domain"] == "native_samples" {
                reply["native_timing_pulse"]["resident_consumers"].clone()
            } else { Value::Null }});
        if contract["constructor_basis_fingerprint"] != super::bootstrap::fingerprint(&basis)? {
            return Err("Native Source constructor basis fingerprint changed".into());
        }
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            contract,
            source,
            completion.source(),
            completion.reply(),
        ))?;
        Ok(Self {
            document_fingerprint: super::bootstrap::fingerprint(before)?,
            contract: contract.clone(),
            requirements,
            source: source.clone(),
            scene_owner,
            completion,
        })
    }

    fn require_definition(
        &self,
        application: &Application,
        before: &Document,
        definition: &Value,
    ) -> Result<(), String> {
        application.require_procedural_scene_owner(&self.scene_owner, before)?;
        if super::bootstrap::fingerprint(before)? != self.document_fingerprint
            || self.contract["document_revision"].as_u64() != Some(before.revision)
            || definition["expression_ref"] != before.expression_ref
            || definition["document_revision"].as_u64() != Some(before.revision)
            || definition["procedure"]["timing"] != self.contract["original_timing"]
            || ["source_composition", "currentness", "thread_plan"]
                .iter()
                .any(|key| definition[*key] != self.source[*key])
        {
            return Err(
                "Definition needs fresh actual no-write Source at the exact current Document CAS"
                    .into(),
            );
        }
        Ok(())
    }

    fn boundary(
        &self,
        application: &Application,
        before: &Document,
        scene_ref: &str,
        work: &crate::expression::procedural::receiver::ReceivingWork<'_>,
        completion: Option<&CompletedSourceIntake>,
        installed: Option<&Value>,
    ) -> Result<ReceivingBoundary, String> {
        let current_scene = application.procedural_scene_owner(before, scene_ref)?;
        application.require_procedural_scene_owner(&current_scene, before)?;
        if self.contract["expression_ref"] != before.expression_ref
            || self.contract["scene_ref"] != scene_ref
            || current_scene.instance_ref() != self.scene_owner.instance_ref()
            || current_scene.construction_generation() != self.scene_owner.construction_generation()
        {
            return Err(
                "Actual receiving Scene lifetime changed from its original Source qualification"
                    .into(),
            );
        }
        current_scene.closed_constructor_fact(before, scene_ref)?;
        let prepared = work.original_preparation();
        let required = prepared["required_consumers"]
            .as_array()
            .ok_or("Actual preparation consumer rows absent")?;
        if !(2..=16).contains(&required.len()) {
            return Err("Prepared receiver count exceeded before allocation".into());
        }
        let expected: BTreeSet<String> =
            serde_json::from_value(prepared["required_consumers"].clone())
                .map_err(|error| error.to_string())?;
        if expected != owners(&self.requirements)?
            || prepared["native_edit"]["expression_ref"] != before.expression_ref
            || prepared["native_edit"]["expected_revision"].as_u64() != Some(before.revision)
            || !same_anchor(&self.contract["original_timing"], &prepared["timing"])
            || !same_anchor(
                &prepared["original_procedure"]["timing"],
                &self.contract["original_timing"],
            )
        {
            return Err(
                "Prepared native material changed original receiving roles/timing or current CAS"
                    .into(),
            );
        }
        let (reply, position) = if let Some(completion) = completion {
            let installed = installed.ok_or("Actual native installed definition absent")?;
            if installed["procedure"] != prepared["original_procedure"]
                || installed["required_consumers"] != prepared["required_consumers"]
            {
                return Err("Lifecycle receiving changed its exact actual installed original Procedure/roles".into());
            }
            if completion.source() != work.source()
                || completion.reply()["procedural"]["prepared"] != *prepared
            {
                return Err(
                    "Receiving work differs from the actual completed private Source preparation"
                        .into(),
                );
            }
            let position = work
                .original_native_position()
                .ok_or("Native lifecycle Source position absent")?;
            if *position != completion.reply()["procedural"]["native_position"] {
                return Err(
                    "Native receiving position differs from its original qualified preparation"
                        .into(),
                );
            }
            (completion.reply(), position)
        } else {
            // First normal preparation is a real stateless native compiler
            // operation over the unchanged current bootstrap. Its Source graph
            // must be the actual owner's graph, never supplied alternatives.
            application.require_procedural_scene_owner(&self.scene_owner, before)?;
            if super::bootstrap::fingerprint(before)? != self.document_fingerprint
                || prepared["original_procedure"]["timing"] != self.contract["original_timing"]
            {
                return Err("First preparation has stale current bootstrap Document".into());
            }
            let context = &work.source()["original_request"]["native_context"];
            if !context.is_object()
                || ["source_composition", "currentness", "thread_plan"]
                    .iter()
                    .any(|key| context[*key] != self.source[*key])
            {
                return Err("Native compiler preparation has another actual Source context".into());
            }
            (self.completion.reply(), &self.source["native_position"])
        };
        // These getters deliberately distinguish original membership, newly
        // constructed outputs and the exact sealed native operation.
        crate::expression::procedural::bootstrap::preflight_source_message(&(
            work.existing_targets(),
            work.produced_targets(),
            work.changes(),
            position,
        ))?;
        // Refuse unsupported resident correspondence before target expansion
        // or participant allocation; no Scene-to-body alias is admitted.
        for requirement in &self.requirements {
            if requirement.owner != "scene"
                && requirement.owner != text(&prepared["timing"]["owner_ref"])?
            {
                return Err(format!("Actual {} resident target receiving factory is unavailable; retain Source pending reception", requirement.owner));
            }
        }
        let targets = work.resolved_targets(application, before)?;
        let timing_owner = text(&prepared["timing"]["owner_ref"])?;
        let timing = self
            .requirements
            .iter()
            .find(|row| row.owner == timing_owner)
            .ok_or("Exact actual timing requirement absent")?;
        let timing_fact = if let Some(completion) = completion {
            current_timing_fact(timing, completion.reply())?
        } else {
            self.source["native_timing_consumer_fact"].clone()
        };
        validate_timing_requirement(
            timing,
            &prepared["timing"],
            position,
            &timing_fact,
            field_receipt(reply),
            reply,
        )?;
        let requested = prepared["timing"]["requested_cursor"]
            .as_u64()
            .ok_or("Native receiving cursor absent")?;
        work.preflight_counterparts(
            before,
            &BorrowedParticipants {
                requirements: &self.requirements,
                targets: &targets,
            },
            &BorrowedBoundary {
                kind: "owner_boundary",
                owner: timing_owner,
                instance_ref: &timing.instance_ref,
                cursor: requested,
            },
        )?;
        let mut participants = Vec::with_capacity(self.requirements.len());
        for requirement in &self.requirements {
            participants.push(Participant {
                owner: requirement.owner.clone(),
                instance_ref: requirement.instance_ref.clone(),
                required_generation: requirement.required_generation,
                targets: targets.clone(),
            });
        }
        ReceivingBoundary::from_registered(
            before.expression_ref.clone(),
            before.revision,
            Timing::OwnerBoundary {
                owner: timing_owner.to_owned(),
                instance_ref: timing.instance_ref.clone(),
                cursor: requested,
            },
            participants,
        )
    }
}

fn field_receipt(reply: &Value) -> &Value {
    let source = &reply["procedural"]["native_field_receipt"];
    if !source.is_null() {
        source
    } else {
        &reply["native_field_timing_receipt"]
    }
}
fn current_timing_fact(requirement: &Requirement, reply: &Value) -> Result<Value, String> {
    if requirement.generation_domain == "native-field-clock-construction" {
        let row = &field_receipt(reply)["timing_owner"];
        Ok(json!({"role":"field_clock","owner_ref":requirement.owner,
            "instance_ref":row["instance_ref"],"construction_ordinal":row["construction_ordinal"],
            "generation":row["generation"],"generation_domain":row["generation_domain"],
            "sample":row["samples_elapsed"],"source_instance_ref":reply["procedural"]["native_position"]["instance_ref"],
            "native_clock_constructor":row}))
    } else {
        let row = &reply["native_timing_pulse"]["native_timing_owner"];
        if row["schema"] != "ql.native-management-timing-owner/v1" {
            return Err("Actual same-pulse Management constructor fact absent".into());
        }
        Ok(row.clone())
    }
}
// Identity correspondence only: native timing owner and Source owner may use
// the same reference. The genuine clock constructor token must differ from both.
fn field_clock_instance_distinct(requirement: &Requirement, source_instance: &Value) -> bool {
    source_instance.as_str().is_some_and(|source| {
        requirement.instance_ref != source && requirement.instance_ref != requirement.owner
    })
}

fn validate_timing_requirement(
    requirement: &Requirement,
    timing: &Value,
    position: &Value,
    fact: &Value,
    field: &Value,
    reply: &Value,
) -> Result<(), String> {
    if requirement.owner != text(&timing["owner_ref"])?
        || fact["owner_ref"] != requirement.owner
        || fact["instance_ref"] != requirement.instance_ref
        || cursor(&fact["generation"])? != requirement.required_generation
        || fact["generation_domain"] != requirement.generation_domain
    {
        return Err(
            "Actual native timing constructor differs from original required counterpart".into(),
        );
    }
    match timing["domain"].as_str() {
        Some("native_field_samples") => {
            let row = &fact["native_clock_constructor"];
            let fields = [
                "schema",
                "instance_ref",
                "construction_ordinal",
                "generation",
                "generation_domain",
                "clock_generation",
                "initial_clock_generation",
                "samples_elapsed",
                "event_ref",
                "subject_ref",
                "sample_rate",
            ];
            let row_fields = row
                .as_object()
                .ok_or("Actual complete FIELD clock row absent")?;
            if row_fields.len() != fields.len()
                || fields.iter().any(|key| !row_fields.contains_key(*key))
            {
                return Err("Actual FIELD clock constructor wire is incomplete or changed".into());
            }
            cursor(&row["initial_clock_generation"])?;
            if requirement.generation_domain != "native-field-clock-construction"
                || fact["role"] != "field_clock"
                || *row != field["timing_owner"]
                || field["schema"] != "ql.continuous-field/v1"
                || row["schema"] != "ql.native-field-clock-constructor/v1"
                || row["instance_ref"] != requirement.instance_ref
                || cursor(&row["construction_ordinal"])? != requirement.required_generation
                || cursor(&fact["construction_ordinal"])? != requirement.required_generation
                || row["generation"] != fact["generation"]
                || row["generation_domain"] != requirement.generation_domain
                || fact["source_instance_ref"] != position["instance_ref"]
                || !field_clock_instance_distinct(requirement, &position["instance_ref"])
                || row["samples_elapsed"] != position["samples_elapsed"]
                || fact["sample"] != position["samples_elapsed"]
                || field["samples_elapsed"] != position["samples_elapsed"]
                || field["generation"] != position["generation"]
                || row["event_ref"] != position["event_ref"]
                || row["subject_ref"] != position["subject_ref"]
                || field["event_ref"] != position["event_ref"]
                || field["subject_ref"] != position["subject_ref"]
                || row["clock_generation"] != field["clock"]["generation"]
                || row["sample_rate"] != field["sample_rate"]
                || row["sample_rate"].as_u64().is_none_or(|rate| rate == 0)
                || timing["requested_cursor"].as_u64()
                    != Some(cursor(&position["samples_elapsed"])?)
            {
                return Err(
                    "Native FIELD timing/clock/source are not the same original observation".into(),
                );
            }
        }
        Some("native_samples") => {
            validate_performance_timing_requirement(requirement, timing, position, fact, reply)?;
        }
        _ => return Err("Native receiving timing domain unavailable".into()),
    }
    Ok(())
}

// Current actual Source70 wire. Source FIELD/M3 position dates remain separate
// from Management construction and transport epoch; this comparison is not a
// private constructor/receipt ingress.
fn validate_performance_timing_requirement(
    requirement: &Requirement,
    timing: &Value,
    position: &Value,
    fact: &Value,
    reply: &Value,
) -> Result<(), String> {
    let pulse = &reply["native_timing_pulse"];
    let native = &pulse["payload"]["timing_fact"];
    let registry = &pulse["resident_consumers"];
    let physical = &registry["physical_observation"]["snapshot"];
    let source = &registry["source"];
    let keys = [
        "schema",
        "role",
        "owner_ref",
        "instance_ref",
        "construction_ordinal",
        "generation",
        "generation_domain",
        "transport_epoch",
        "sample",
        "source",
        "m3_source_generation",
        "body_revision",
        "callback_output_committed",
        "time_mapping_ref",
    ];
    let fields = fact
        .as_object()
        .ok_or("Actual Management constructor absent")?;
    if fields.len() != keys.len() || keys.iter().any(|key| !fields.contains_key(*key)) {
        return Err("Actual complete Source70 Management constructor required".into());
    }
    let (nonce, ordinal) = requirement
        .instance_ref
        .strip_prefix("native-resident:v1:")
        .and_then(|value| value.split_once(':'))
        .ok_or("Actual Management constructor token malformed")?;
    let valid_nonce = nonce.len() == 32
        && nonce.bytes().any(|b| b != b'0')
        && nonce
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b));
    cursor(&source["m2_generation"])?;
    if pulse["schema"] != "ql.performance-worker-reply/v1"
        || pulse["accepted"] != true
        || native["schema"] != "ql.native-performance-timing-fact/v1"
        || registry["schema"] != "ql.native-resident-consumer-registry/v1"
        || registry["origin"] != "actual-native-constructors-and-same-pulse"
        || fact != &pulse["native_timing_owner"]
        || fact["schema"] != "ql.native-management-timing-owner/v1"
        || fact["role"] != "timing_owner"
        || requirement.generation_domain != "native-management-construction"
        || !valid_nonce
        || ordinal != requirement.required_generation.to_string()
        || cursor(&fact["construction_ordinal"])? != requirement.required_generation
        || requirement.instance_ref == text(&position["instance_ref"])?
        || requirement.instance_ref == requirement.owner
        || native["native_position"] != *position
        || !same_anchor(timing, &native["binding"])
        || fact["owner_ref"] != pulse["reading"]["session_ref"]
        || timing["epoch_ref"]
            != format!(
                "ql:performance/transport-epoch/{}",
                cursor(&native["transport_epoch"])?
            )
        || fact.get("time_mapping_ref").is_none_or(|v| !v.is_null())
        || !timing["time_mapping_ref"].is_null()
        || fact["sample"] != native["committed_cursor"]
        || fact["sample"] != registry["sample"]
        || fact["sample"] != position["samples_elapsed"]
        || fact["sample"] != pulse["reading"]["samples_elapsed"]
        || native["committed_cursor"] != pulse["reading"]["physical"]["samples_elapsed"]
        || fact["transport_epoch"] != registry["transport_epoch"]
        || fact["transport_epoch"] != native["transport_epoch"]
        || fact["transport_epoch"] != pulse["reading"]["transport_epoch"]
        || source != &native["source"]["identity"]
        || fact["source"] != *source
        || source["instance"] != position["instance_ref"]
        || source["event"] != position["event_ref"]
        || source["subject"] != position["subject_ref"]
        || physical["schema"] != "ql.native-physical-snapshot/v1"
        || fact["m3_source_generation"] != registry["m3_source_generation"]
        || fact["m3_source_generation"] != position["generation"]
        || fact["m3_source_generation"] != physical["source_generation"]
        || fact["m3_source_generation"] != pulse["reading"]["physical"]["source_generation"]
        || physical["event_ref"] != position["event_ref"]
        || physical["subject_ref"] != position["subject_ref"]
        || physical["samples_elapsed"] != position["samples_elapsed"]
        || fact["body_revision"] != registry["body_revision"]
        || fact["body_revision"] != physical["body_revision"]
        || fact["body_revision"] != pulse["reading"]["physical"]["body_revision"]
        || fact["callback_output_committed"]
            != registry["audio_observation"]["callback_output_committed"]
        || fact["callback_output_committed"].as_bool().is_none()
        || timing["requested_cursor"].as_u64() != Some(cursor(&native["admission_horizon"])?)
    {
        return Err("Native Source70 Management/source/epoch/cursor correspondence differs".into());
    }
    Ok(())
}

fn validate_performance_roster(
    requirements: &[Requirement],
    timing: &Value,
    reply: &Value,
) -> Result<(), String> {
    let pulse = &reply["native_timing_pulse"];
    let registry = &pulse["resident_consumers"];
    let rows = registry["required_consumers"]
        .as_array()
        .filter(|rows| (2..=3).contains(&rows.len()))
        .ok_or("Actual A/P/(M4) resident roster absent")?;
    if requirements.len() != rows.len() + 2 {
        return Err(
            "Source receiving roles differ from actual Scene/Management/numeric roster".into(),
        );
    }
    let mut names = BTreeSet::new();
    let mut instances = BTreeSet::new();
    for row in rows {
        let role = text(&row["role"])?;
        let observation = &registry[match role {
            "audio_engine" => "audio_observation",
            "physical_body" => "physical_observation",
            "acoustic_receiving" => "receiving_observation",
            _ => return Err("Source70 numeric registry contains an invented role".into()),
        }];
        let required = requirements
            .iter()
            .find(|r| r.owner == role)
            .ok_or("Source requirement omitted actual numeric role")?;
        if !names.insert(role)
            || !instances.insert(text(&row["instance_ref"])?)
            || required.owner == text(&timing["owner_ref"])?
            || row["instance_ref"] != required.instance_ref
            || cursor(&row["generation"])? != required.required_generation
            || row["generation_domain"] != "native-resident-construction"
            || required.generation_domain != "native-resident-construction"
            || row["sample"] != registry["sample"]
            || observation["instance_ref"] != row["instance_ref"]
            || observation["sample"] != registry["sample"]
            || (role == "physical_body"
                && registry["physical_observation"]["snapshot"]["resident_instance_ref"]
                    != row["instance_ref"])
        {
            return Err("Source actual numeric lifetime/role/sample correspondence differs".into());
        }
    }
    if !names.contains("audio_engine")
        || !names.contains("physical_body")
        || names.contains("acoustic_receiving") != !registry["receiving_observation"].is_null()
    {
        return Err("Actual resident Source role omitted or fabricated".into());
    }
    let correspondence = &reply["procedural"]["native_resident_source_correspondence"];
    if correspondence["schema"] != "ql.native-resident-source-correspondence/v1"
        || correspondence["source"] != registry["source"]
        || correspondence["sample"] != registry["sample"]
        || correspondence["transport_epoch"] != registry["transport_epoch"]
        || correspondence["body_revision"] != registry["body_revision"]
        || correspondence["m3_source_generation"] != registry["m3_source_generation"]
        || correspondence["native_timing_owner"] != pulse["native_timing_owner"]
        || correspondence["required_consumers"] != registry["required_consumers"]
        || reply["procedural"]["native_timing_owner"] != pulse["native_timing_owner"]
    {
        return Err(
            "Source resident correspondence differs from its exact original native pulse".into(),
        );
    }
    Ok(())
}

impl crate::native_expression::Manager {
    /// Borrow exactly the no-write current Source context for the normal
    /// Library factory. The opaque completion remains on this same owner.
    /// Returned graph/timing/contract projections never become private grants.
    pub(crate) fn with_registered_source_context<T>(
        &mut self,
        application: &Application,
        before: &Document,
        scene_ref: &str,
        read: impl FnOnce(&Value, &Value, &Value, &Value) -> Result<T, String>,
    ) -> Result<T, String> {
        let registered = self
            .active
            .as_mut()
            .ok_or("Actual native Source owner absent")?
            .registered_consumers
            .take()
            .ok_or("Fresh actual registered Source context absent")?;
        let result = (|| {
            registered.completion.require_current(self)?;
            application.require_procedural_scene_owner(&registered.scene_owner, before)?;
            let actual_scene = registered
                .scene_owner
                .closed_constructor_fact(before, scene_ref)?;
            if super::bootstrap::fingerprint(before)? != registered.document_fingerprint
                || registered.contract["document_revision"].as_u64() != Some(before.revision)
                || registered.contract["expression_ref"] != before.expression_ref
                || registered.contract["scene_ref"] != scene_ref
                || registered.source["native_scene_constructor_fact"] != actual_scene
            {
                return Err("Library requires fresh no-write Source at the actual selected Document/Scene CAS".into());
            }
            crate::expression::procedural::bootstrap::preflight_source_message(&(
                &registered.source,
                registered.completion.source(),
                registered.completion.reply(),
                &registered.contract,
            ))?;
            read(
                &registered.source,
                registered.completion.source(),
                registered.completion.reply(),
                &registered.contract,
            )
        })();
        if let Some(owner) = self.active.as_mut() {
            owner.registered_consumers = Some(registered);
        }
        result
    }
    pub(crate) fn registered_receiving_scene(
        &self,
        expression_ref: &str,
    ) -> Result<String, String> {
        let registered = self
            .active
            .as_ref()
            .ok_or("Actual native Source owner absent")?
            .registered_consumers
            .as_ref()
            .ok_or("Actual registered Source consumers absent")?;
        if registered.contract["expression_ref"] != expression_ref {
            return Err("Native receiving qualification belongs to another Expression".into());
        }
        Ok(text(&registered.contract["scene_ref"])?.to_owned())
    }
    pub(super) fn retain_registered_consumers(
        &mut self,
        application: &Application,
        before: &Document,
        scene_owner: SceneOwner,
        completion: CompletedSourceIntake,
    ) -> Result<(), String> {
        completion.require_current(self)?;
        let registered =
            RegisteredConsumers::from_bootstrap(application, before, scene_owner, completion)?;
        self.active
            .as_mut()
            .ok_or("Actual native Source owner closed")?
            .registered_consumers = Some(registered);
        Ok(())
    }
    pub(super) fn invalidate_registered_consumers(&mut self) {
        if let Some(owner) = self.active.as_mut() {
            owner.registered_consumers = None;
        }
    }
    /// Only the original current private Source context assembles roles before
    /// native compilation. No preparation or definition fingerprint is edited.
    pub(crate) fn bind_registered_definition_consumers(
        &mut self,
        application: &Application,
        before: &Document,
        definition: &mut Value,
    ) -> Result<(), String> {
        let registered = self
            .active
            .as_mut()
            .ok_or("Actual native Source owner absent")?
            .registered_consumers
            .take()
            .ok_or("Fresh actual registered Source consumers absent")?;
        let result = (|| {
            registered.completion.require_same_owner(self)?;
            registered.require_definition(application, before, definition)?;
            let actual = &registered.contract["required_consumers"];
            if !definition["required_consumers"]
                .as_array()
                .is_some_and(Vec::is_empty)
                && definition["required_consumers"] != *actual
            {
                return Err(
                    "Caller roles differ from original registered native counterparts".into(),
                );
            }
            definition["required_consumers"] = actual.clone();
            Ok(())
        })();
        if let Some(owner) = self.active.as_mut() {
            owner.registered_consumers = Some(registered);
        }
        result
    }
    pub(crate) fn bind_registered_prepare_consumers(
        &mut self,
        application: &Application,
        before: &Document,
        request: &mut Value,
    ) -> Result<(), String> {
        crate::expression::procedural::bootstrap::preflight_source_message(request)?;
        let context = &request["native_context"];
        let mut definition = json!({"expression_ref":request["expression_ref"],
            "document_revision":request["document_revision"], "procedure":request["procedure"],
            "source_composition":context["source_composition"], "currentness":context["currentness"],
            "thread_plan":context["thread_plan"], "required_consumers":request["required_consumers"]});
        self.bind_registered_definition_consumers(application, before, &mut definition)?;
        request["required_consumers"] = definition["required_consumers"].take();
        Ok(())
    }
    pub(crate) fn check_registered_definition_consumers(
        &mut self,
        application: &Application,
        before: &Document,
        definition: &Value,
    ) -> Result<(), String> {
        let registered = self
            .active
            .as_mut()
            .ok_or("Actual native Source owner absent")?
            .registered_consumers
            .take()
            .ok_or("Actual registered Source consumers absent")?;
        let result = (|| {
            registered.completion.require_same_owner(self)?;
            registered.require_definition(application, before, definition)?;
            if definition["required_consumers"] != registered.contract["required_consumers"] {
                return Err(
                    "Compiled definition changed original native roles after preparation".into(),
                );
            }
            Ok(())
        })();
        if let Some(owner) = self.active.as_mut() {
            owner.registered_consumers = Some(registered);
        }
        result
    }
    pub(super) fn procedural_receiving_boundary(
        &mut self,
        application: &Application,
        before: &Document,
        scene_ref: &str,
        producer_ref: &str,
        completion: Option<&CompletedSourceIntake>,
    ) -> Result<ReceivingBoundary, String> {
        let registered = self
            .active
            .as_mut()
            .ok_or("Actual native Source owner absent")?
            .registered_consumers
            .take()
            .ok_or("Actual registered native receiving qualification absent")?;
        let result = (|| {
            registered.completion.require_same_owner(self)?;
            if let Some(completion) = completion {
                completion.require_current(self)?;
            }
            let work = application.procedural_receiving_work(before, producer_ref)?;
            let installed = if completion.is_some() {
                let procedure =
                    text(&work.original_preparation()["original_procedure"]["procedure_ref"])?;
                self.active
                    .as_ref()
                    .ok_or("Actual native owner closed")?
                    .procedural_definitions
                    .get(procedure)
            } else {
                None
            };
            registered.boundary(application, before, scene_ref, &work, completion, installed)
        })();
        if let Some(owner) = self.active.as_mut() {
            owner.registered_consumers = Some(registered);
        }
        result
    }
}

impl crate::Kernel {
    /// Original admitted preparation enters the SAME native receiving envelope.
    /// This returns normal Prepare for review; it never schedules or applies.
    pub(crate) fn native_registered_receiving_prepare(
        &mut self,
        expression_ref: &str,
        document_revision: u64,
        scene_ref: &str,
        producer_ref: &str,
    ) -> Result<Value, String> {
        let before = self
            .expressions
            .procedural_source_snapshot(expression_ref, document_revision)?;
        let boundary = self.native_expression.procedural_receiving_boundary(
            &self.expressions,
            &before,
            scene_ref,
            producer_ref,
            None,
        )?;
        let envelope =
            self.expressions
                .procedural_receiving_envelope(&before, producer_ref, &boundary)?;
        serde_json::to_value(crate::expression::procedural::Request::Prepare {
            envelope: Box::new(envelope),
        })
        .map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod configuration_tests {
    use super::*;

    #[test]
    fn borrowed_counterpart_wire_matches_existing_native_participants_and_boundary() {
        // Only native wire/configuration serialization, not registered authority.
        let requirements = vec![Requirement {
            owner: "scene".into(),
            instance_ref: "configuration:scene".into(),
            required_generation: 1,
            generation_domain: "native-document-scene-construction".into(),
        }];
        let targets = vec![crate::expression::procedural::Address {
            expression_ref: "expression:configuration".into(),
            scene_ref: Some("expression:configuration:scene:main".into()),
            entity_ref: None,
            component: crate::expression::procedural::Component::Scene,
            constituent_ref: None,
            parent_ref: None,
            property: None,
        }];
        let owned = vec![Participant {
            owner: requirements[0].owner.clone(),
            instance_ref: requirements[0].instance_ref.clone(),
            required_generation: requirements[0].required_generation,
            targets: targets.clone(),
        }];
        assert_eq!(
            serde_json::to_vec(&BorrowedParticipants {
                requirements: &requirements,
                targets: &targets
            })
            .unwrap(),
            serde_json::to_vec(&owned).unwrap()
        );
        assert_eq!(
            serde_json::to_vec(&BorrowedBoundary {
                kind: "owner_boundary",
                owner: "configuration:clock-owner",
                instance_ref: "configuration:clock-token",
                cursor: 64
            })
            .unwrap(),
            serde_json::to_vec(&Timing::OwnerBoundary {
                owner: "configuration:clock-owner".into(),
                instance_ref: "configuration:clock-token".into(),
                cursor: 64
            })
            .unwrap()
        );
    }

    #[test]
    fn configuration_anchor_allows_current_cursor_and_refuses_domain_epoch_owner_mapping_changes() {
        // A pure configuration function, never a private clock or Source grant.
        let original = json!({"owner_ref":"native:field-owner","domain":"native_field_samples",
            "epoch_ref":"epoch:original","time_mapping_ref":null,"requested_cursor":64});
        let mut current = original.clone();
        current["requested_cursor"] = json!(128);
        assert!(same_anchor(&original, &current));
        for key in ["owner_ref", "domain", "epoch_ref", "time_mapping_ref"] {
            let mut foreign = current.clone();
            foreign[key] = json!("foreign");
            assert!(!same_anchor(&original, &foreign), "accepted changed {key}");
        }
        let mut omitted = original.clone();
        omitted.as_object_mut().unwrap().remove("time_mapping_ref");
        assert!(!same_anchor(&omitted, &current));
        assert_eq!(original["requested_cursor"], 64);
    }

    #[test]
    fn configuration_roster_refuses_duplicate_instances_and_nonconstructor_generation_domains() {
        let rows = vec![
            Requirement {
                owner: "scene".into(),
                instance_ref: "configuration:scene".into(),
                required_generation: 1,
                generation_domain: "native-document-scene-construction".into(),
            },
            Requirement {
                owner: "native:clock".into(),
                instance_ref: "configuration:clock".into(),
                required_generation: 2,
                generation_domain: "native-field-clock-construction".into(),
            },
        ];
        assert_eq!(owners(&rows).unwrap().len(), 2);
        for domain in ["native_field_samples", "m2", "source", "window", ""] {
            let mut changed:Vec<Requirement> = serde_json::from_value(json!([
                {"owner":"scene","instance_ref":"configuration:scene","required_generation":1,"generation_domain":"native-document-scene-construction"},
                {"owner":"native:clock","instance_ref":"configuration:clock","required_generation":2,"generation_domain":domain}])).unwrap();
            assert!(owners(&changed).is_err());
            changed[1].generation_domain = "native-field-clock-construction".into();
            changed[1].instance_ref = changed[0].instance_ref.clone();
            assert!(owners(&changed).is_err());
        }
        assert_eq!(rows[1].instance_ref, "configuration:clock");
    }

    #[test]
    fn configuration_source_and_timing_owner_may_coincide_but_clock_token_stays_distinct() {
        // No native fact, lease, completion, roster registration or ACK is created.
        let mut requirement = Requirement {
            owner: "configuration:source-owner".into(),
            instance_ref: "configuration:clock-token".into(),
            required_generation: 1,
            generation_domain: "native-field-clock-construction".into(),
        };
        let source = json!("configuration:source-owner");
        assert!(field_clock_instance_distinct(&requirement, &source));
        requirement.instance_ref = requirement.owner.clone();
        assert!(!field_clock_instance_distinct(&requirement, &source));
        requirement.owner = "configuration:another-owner".into();
        assert!(!field_clock_instance_distinct(&requirement, &source));
        requirement.instance_ref = requirement.owner.clone();
        assert!(!field_clock_instance_distinct(&requirement, &source));
        assert!(!field_clock_instance_distinct(&requirement, &Value::Null));
    }

    fn verified_joined_inventory(capture: &Value, capture_path: &std::path::Path) {
        // SAME external trusted inventory contract as G Proof4; never a grant.
        let trusted = std::env::var("OI_STAGE_PASSAGE_SOURCE_MANIFEST")
            .expect("independent joined native source manifest required");
        let expected = std::env::var("OI_STAGE_PASSAGE_SOURCE_MANIFEST_SHA256")
            .expect("independently retained native manifest SHA required");
        assert_eq!(expected.len(), 64);
        assert!(expected
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c)));
        let trusted_bytes = std::fs::read(trusted).unwrap();
        assert_eq!(super::super::super::sha256_hex(&trusted_bytes), expected);
        let base = capture_path.parent().unwrap();
        let listed =
            std::fs::read(base.join(text(&capture["source_manifest_path"]).unwrap())).unwrap();
        assert_eq!(
            listed, trusted_bytes,
            "caller inventory differs from independently retained source bytes"
        );
        assert_eq!(capture["source_manifest_sha256"], expected);
        let manifest: Value = serde_json::from_slice(&trusted_bytes).unwrap();
        assert_eq!(manifest["running_revisions"], capture["running_revisions"]);
        assert_eq!(
            manifest["ql"]["inventory"]["schema"],
            "ql.m-current-inventory/v1"
        );
        for owner in ["ql", "oi"] {
            assert!(!text(&manifest["running_revisions"][owner])
                .unwrap()
                .is_empty());
        }
        let pins = capture["source_pins"]
            .as_array()
            .expect("complete joined exact Source pins required");
        assert!(!pins.is_empty());
        let mut seen = BTreeSet::new();
        for pin in pins {
            let owner = text(&pin["owner"]).unwrap();
            assert!(["ql", "oi"].contains(&owner));
            let file = text(&pin["repo_path"]).unwrap();
            assert!(seen.insert((owner.to_owned(), file.to_owned())));
            let bytes = std::fs::read(base.join(text(&pin["path"]).unwrap())).unwrap();
            assert_eq!(super::super::super::sha256_hex(&bytes), pin["sha256"]);
            let inventory = if owner == "ql" {
                &manifest["ql"]["inventory"]["sources"]
            } else {
                &manifest["oi"]["sources"]
            };
            assert_eq!(
                inventory[file], pin["sha256"],
                "source missing from independently pinned native inventory"
            );
        }
        for (owner, files) in [
            (
                "ql",
                &[
                    "crates/ql-mef/src/lib.rs",
                    "crates/ql-mef/src/continuous/host.rs",
                    "crates/ql-mef/src/continuous/performance_act_bridge.rs",
                    "crates/ql-mef/src/continuous/procedural_source_bootstrap.rs",
                    "crates/ql-mef/src/continuous/procedural_field_timing.rs",
                    "crates/ql-mef/src/continuous/performance_timing.rs",
                    "crates/ql-mef/src/procedural_consumers.rs",
                    "crates/ql-mef/src/procedural_timing.rs",
                    "crates/ql-mef/src/procedural_source.rs",
                    "crates/ql-mef/src/procedural_conduct.rs",
                    "crates/ql-mef/src/procedural_composition.rs",
                    "crates/ql-mef/src/procedural_manifestation.rs",
                    "crates/ql-mef/src/vak_scope_wire.rs",
                    "crates/ql-mef/src/vak_composition.rs",
                    "crates/ql-mef/src/m_tree.rs",
                    "crates/ql-cli/src/procedural_command.rs",
                ] as &[&str],
            ),
            (
                "oi",
                &[
                    "desktop/cradle/kernel/src/lib.rs",
                    "desktop/cradle/kernel/src/native_expression.rs",
                    "desktop/cradle/kernel/src/native_expression_procedural.rs",
                    "desktop/cradle/kernel/src/native_expression_procedural_bootstrap.rs",
                    "desktop/cradle/kernel/src/native_expression_procedural_lifecycle.rs",
                    "desktop/cradle/kernel/src/native_expression_procedural_receiver.rs",
                    "desktop/cradle/kernel/src/expression_procedural.rs",
                    "desktop/cradle/kernel/src/expression_procedural_receiver.rs",
                    "desktop/cradle/kernel/src/expression_procedural_budget.rs",
                    "desktop/cradle/kernel/src/expression_procedural_bootstrap.rs",
                    "desktop/cradle/kernel/src/expression_procedural_scene_reader.rs",
                    "desktop/cradle/kernel/src/native_expression_procedural_scene_source.rs",
                    "desktop/cradle/kernel/src/expression_procedural_scene_receiver.rs",
                ] as &[&str],
            ),
        ] {
            for file in files {
                assert!(
                    seen.contains(&(owner.to_owned(), (*file).to_owned())),
                    "missing joined Source {owner}:{file}"
                );
            }
        }
    }

    fn verify_original_native_worker(
        entry: &Value,
        compiled: &Value,
        prepared: &Value,
        revisions: &Value,
        base: &std::path::Path,
    ) {
        // Full actual Root worker/issuer/admission capture; no completion import.
        let capture = &entry["native_source_capture"];
        let source = &compiled["source"];
        let admission = &compiled["admission"];
        assert_eq!(capture["running_revisions"], *revisions);
        assert_eq!(source["schema"], "oi.native-expression-composed-source/v1");
        assert!(source["compiled_at_unix_ms"]
            .as_u64()
            .is_some_and(|n| n > 0));
        assert_eq!(
            prepared["native_edit"]["expression_ref"],
            capture["application_before_document"]["expression_ref"]
        );
        assert_eq!(source["ql_revision"], revisions["ql"]);
        assert_eq!(capture["selected_executable"], source["ql_executable"]);
        assert!(std::path::Path::new(text(&source["ql_executable"]).unwrap()).is_absolute());
        assert_eq!(capture["selected_selection"], source["ql_selection"]);
        assert_eq!(capture["application_admission"], *admission);
        assert_eq!(admission["prepared"], *prepared);
        assert_eq!(admission["source"], *source);
        let before = &capture["application_before_document"];
        let request = &capture["compile_request"];
        assert_eq!(
            request["schema"],
            "oi.expression-procedure-source-request/v1"
        );
        assert_eq!(request["command"], "prepare");
        assert_eq!(request["request"], source["original_request"]);
        assert_eq!(request["basis"]["expression_ref"], before["expression_ref"]);
        assert_eq!(request["basis"]["document_revision"], before["revision"]);
        assert_eq!(
            request["request"]["procedure"],
            prepared["original_procedure"]
        );
        assert_eq!(
            capture["worker_response"]["schema"],
            "oi.expression-procedure-source-response/v1"
        );
        assert_eq!(capture["worker_response"]["source"], *source);
        assert_eq!(
            compiled["native_result"]["schema"],
            "ql.scene-procedural-response/v1"
        );
        assert_eq!(compiled["native_result"]["operation"], "prepare");
        assert_eq!(
            capture["worker_response"]["native_result"],
            compiled["native_result"]
        );
        assert_eq!(capture["bootstrap_reply"], entry["source_response"]);
        let bootstrap = &capture["bootstrap_reply"]["source"];
        assert_eq!(
            request["request"]["native_context"],
            json!({"source_composition":bootstrap["source_composition"],
            "currentness":bootstrap["currentness"],"thread_plan":bootstrap["thread_plan"]})
        );
        assert_eq!(
            request["request"]["procedure"]["composition"],
            bootstrap["authored_cprime"]
        );
        assert_eq!(
            request["request"]["procedure"]["profile"],
            bootstrap["native_scene_source"]["source_basis"]
        );
        assert_eq!(
            request["request"]["procedure"]["principal_subject_ref"],
            bootstrap["native_scene_source"]["principal"]["subject_ref"]
        );
        assert_eq!(
            request["request"]["procedure"]["locus_ref"],
            bootstrap["native_scene_source"]["locus_ref"]
        );
        assert_eq!(
            request["request"]["procedure"]["registry_revision"],
            bootstrap["registry_revision"]
        );
        assert_eq!(
            capture["source_read_reply"]["schema"],
            "oi.expression-procedural/v1"
        );
        assert_eq!(
            capture["source_read_reply"]["expression_ref"],
            before["expression_ref"]
        );
        assert!(capture["source_read_reply"]["scene_sources"]
            .as_array()
            .unwrap()
            .iter()
            .any(|row| *row == bootstrap["native_scene_source"]));
        assert_eq!(
            capture["source_read_reply"]["document_revision"],
            before["revision"]
        );
        assert_eq!(
            capture["source_read_reply"]["current_readings"],
            request["request"]["current_readings"]
        );
        assert_eq!(
            capture["bootstrap_reply"]["original_intent"],
            capture["bootstrap_intent"]
        );
        let cprime = &prepared["native_cprime"];
        assert_eq!(cprime["schema"], "ql.procedural-cprime-preparation/v1");
        assert_eq!(
            cprime["procedure_ref"],
            request["request"]["procedure"]["procedure_ref"]
        );
        assert_eq!(
            cprime["procedure_revision"],
            request["request"]["procedure"]["revision"]
        );
        assert_eq!(
            cprime["definition"],
            request["request"]["procedure"]["composition"]
        );
        assert_eq!(
            cprime["thread_plan"],
            request["request"]["native_context"]["thread_plan"]
        );
        assert_eq!(
            prepared["source_revision"],
            request["request"]["procedure"]["registry_revision"]
        );
        assert_eq!(
            prepared["recipe_revision"],
            request["request"]["procedure"]["recipe"]["revision"]
        );
        let current = &cprime["currentness"];
        let expected = &request["request"]["native_context"]["currentness"]["expected"];
        let binding = &current["observation"]["binding"];
        assert_eq!(current["contract"], "ql.operative-scope-currentness/v1");
        assert_eq!(
            current["currentWholeRef"],
            request["request"]["native_context"]["currentness"]["currentWholeRef"]
        );
        assert_eq!(current["requestedBindingRef"], expected["bindingRef"]);
        assert_eq!(
            current["requestedBindingRevision"],
            expected["bindingRevision"]
        );
        assert_eq!(current["observation"]["state"], "current");
        assert_eq!(
            binding["subjectRef"],
            request["request"]["procedure"]["principal_subject_ref"]
        );
        assert_eq!(binding["profile"], expected["profile"]);
        for role in ["recipe", "profile"] {
            let basis = &request["request"]["procedure"][role];
            assert!(binding["sources"]
                .as_array()
                .unwrap()
                .iter()
                .any(|source| source["sourceRef"] == basis["source_ref"]
                    && source["revision"] == basis["revision"]));
        }
        let bytes =
            std::fs::read(base.join(text(&capture["producer_seal_bytes_path"]).unwrap())).unwrap();
        let seal: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(
            seal,
            json!({"prepared":prepared,"source":source,"expression_ref":before["expression_ref"],"document_revision":before["revision"]})
        );
        assert_eq!(
            admission["producer_ref"],
            format!(
                "procedure-source:{}",
                super::super::super::sha256_hex(&bytes)
            )
        );
        let document = &entry["s_prepare"]["document_receipt"]["document"];
        let operation = &entry["s_prepare"]["operation"];
        assert_eq!(document["revision"], operation["accepted_revision"]);
        let rows: Vec<_> = document["scenes"]
            .as_array()
            .unwrap()
            .iter()
            .flat_map(|scene| {
                scene["presentation"]["scene"]["procedural"]["operations"]
                    .as_array()
                    .into_iter()
                    .flatten()
            })
            .filter(|row| {
                row["envelope"]["operation_ref"] == operation["envelope"]["operation_ref"]
            })
            .collect();
        assert!(!rows.is_empty(), "actual S prepared journal required");
        for row in rows {
            assert_eq!(*row, *operation);
        }
    }

    #[test]
    #[ignore = "requires actual SAME private C/R paused+running FIELD capture; imported JSON never instantiates a private owner"]
    fn actual_source_to_receiving_capture_keeps_clock_instance_original_scope_and_prepared_roles() {
        let path = std::env::var("OI_NATIVE_REGISTERED_SOURCE_RECEIVING_CAPTURE")
            .expect("genuine native Root/QL receiving capture required");
        let path = std::path::PathBuf::from(path);
        let capture: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        verified_joined_inventory(&capture, &path);
        assert_eq!(capture["schema"], "oi.native-source-receiving-capture/v1");
        let entries = capture["entries"]
            .as_array()
            .expect("actual paused/running entries");
        assert_eq!(entries.len(), 2);
        let mut phases = BTreeSet::new();
        for entry in entries {
            assert!(phases.insert(text(&entry["phase"]).unwrap().to_owned()));
            let response = &entry["source_response"];
            assert_eq!(response["source_current"], true);
            assert_eq!(response["replayed"], false);
            assert_eq!(response["binding_adoption"]["state"], "unchanged");
            let source = &response["source"];
            let receipt = &response["native_receipt"];
            let contract = &source["consumer_contract"];
            let requirements: Vec<Requirement> =
                serde_json::from_value(contract["requirements"].clone()).unwrap();
            assert_eq!(requirements.len(), 2);
            let timing_owner = text(&source["timing"]["owner_ref"]).unwrap();
            let clock = requirements
                .iter()
                .find(|row| row.owner == timing_owner)
                .unwrap();
            assert_ne!(
                clock.instance_ref,
                source["native_position"]["instance_ref"]
            );
            assert_ne!(clock.instance_ref, timing_owner);
            validate_timing_requirement(
                clock,
                &source["timing"],
                &source["native_position"],
                &source["native_timing_consumer_fact"],
                field_receipt(receipt),
                receipt,
            )
            .unwrap();
            // These mutate configuration projections of an actual capture;
            // they never construct or import private native owner custody.
            for key in [
                "owner_ref",
                "domain",
                "epoch_ref",
                "time_mapping_ref",
                "requested_cursor",
            ] {
                let mut changed = source["timing"].clone();
                changed[key] = if key == "requested_cursor" {
                    json!(changed[key].as_u64().unwrap().checked_add(1).unwrap())
                } else {
                    json!("foreign-current-boundary")
                };
                assert!(
                    !same_anchor(&source["timing"], &changed)
                        || validate_timing_requirement(
                            clock,
                            &changed,
                            &source["native_position"],
                            &source["native_timing_consumer_fact"],
                            field_receipt(receipt),
                            receipt
                        )
                        .is_err(),
                    "accepted changed actual timing {key}"
                );
            }
            let compiled = &entry["compiled_response"];
            let prepared = &compiled["native_result"]["result"];
            let envelope = &compiled["prepare_request"]["envelope"];
            verify_original_native_worker(
                entry,
                compiled,
                prepared,
                &capture["running_revisions"],
                path.parent().unwrap(),
            );
            assert_eq!(compiled["receiving_state"], "prepared");
            assert_eq!(
                prepared["required_consumers"],
                contract["required_consumers"]
            );
            let participants = envelope["participants"].as_array().unwrap();
            assert_eq!(participants.len(), 2);
            let p = participants
                .iter()
                .find(|p| p["owner"] == timing_owner)
                .unwrap();
            assert_eq!(p["instance_ref"], clock.instance_ref);
            assert_eq!(p["required_generation"], clock.required_generation);
            assert_eq!(envelope["timing"]["instance_ref"], clock.instance_ref);
            assert_eq!(envelope["scope"], entry["original_resolved_scope"]);
            assert_eq!(envelope["changes"], prepared["native_edit"]["changes"]);
            assert_eq!(envelope["actor"], prepared["native_edit"]["actor"]);
            assert_eq!(
                envelope["producer_ref"],
                compiled["admission"]["producer_ref"]
            );
            assert_eq!(entry["s_prepare"]["operation"]["status"], "prepared");
            assert_eq!(entry["s_prepare"]["operation"]["envelope"], *envelope);
            for key in [
                "original_host_request",
                "original_host_reply",
                "original_compile_request",
                "original_compile_reply",
            ] {
                let record = &entry[key];
                let bytes =
                    std::fs::read(path.parent().unwrap().join(text(&record["path"]).unwrap()))
                        .unwrap();
                assert_eq!(super::super::super::sha256_hex(&bytes), record["sha256"]);
                let actual: Value = serde_json::from_slice(&bytes).unwrap();
                assert!(actual.is_object());
                match key {
                    "original_host_reply" => assert_eq!(actual, *receipt),
                    "original_host_request" => {
                        assert_eq!(actual["request_id"], receipt["request_id"]);
                        assert_eq!(actual["instance_ref"], receipt["instance_ref"]);
                        assert_eq!(actual["command"]["request"]["action"], "source_bootstrap");
                    }
                    "original_compile_reply" => {
                        assert_eq!(actual, compiled["native_result"]);
                        assert_eq!(record["sha256"], compiled["source"]["result_sha256"]);
                    }
                    _ => {
                        assert_eq!(actual, compiled["source"]["original_request"]);
                        assert_eq!(record["sha256"], compiled["source"]["request_sha256"]);
                        assert_eq!(actual["required_consumers"], prepared["required_consumers"]);
                    }
                }
            }
        }
        assert_eq!(
            phases,
            ["field-paused".to_owned(), "field-running".to_owned()]
                .into_iter()
                .collect()
        );
    }
}

#[cfg(test)]
mod source70_receiving_capture_tests {
    use super::*;

    fn raw(base: &std::path::Path, reference: &Value) -> Value {
        let bytes = std::fs::read(base.join(text(&reference["path"]).unwrap())).unwrap();
        assert!(!bytes.is_empty() && bytes.len() <= 64 * 1024 * 1024);
        assert_eq!(super::super::super::sha256_hex(&bytes), reference["sha256"]);
        serde_json::from_slice(&bytes).unwrap()
    }

    #[test]
    #[ignore = "requires genuine Source70 private owner/Root receiving execution and trusted joined inventory"]
    fn actual_source70_receiving_uses_distinct_management_lifetime_and_original_source_position() {
        let file = std::path::PathBuf::from(
            std::env::var("OI_NATIVE_SOURCE70_RECEIVING_CAPTURE").unwrap(),
        );
        let captured: Value = serde_json::from_slice(&std::fs::read(&file).unwrap()).unwrap();
        let base = file.parent().unwrap();
        assert_eq!(
            captured["schema"],
            "oi.native-source70-receiving-capture/v1"
        );
        let trusted =
            std::fs::read(std::env::var("OI_STAGE_PASSAGE_SOURCE_MANIFEST").unwrap()).unwrap();
        assert_eq!(
            super::super::super::sha256_hex(&trusted),
            std::env::var("OI_STAGE_PASSAGE_SOURCE_MANIFEST_SHA256").unwrap()
        );
        let inventory: Value = serde_json::from_slice(&trusted).unwrap();
        assert_eq!(
            inventory["running_revisions"],
            captured["running_revisions"]
        );
        assert_eq!(
            inventory["oi"]["sources"]
                ["desktop/cradle/kernel/src/native_expression_procedural_receiver.rs"],
            super::super::super::sha256_hex(include_bytes!(
                "native_expression_procedural_receiver.rs"
            ))
        );
        let execution_bytes =
            std::fs::read(std::env::var("OI_NATIVE_SOURCE70_RECEIVING_EXECUTION").unwrap())
                .unwrap();
        assert_eq!(
            super::super::super::sha256_hex(&execution_bytes),
            std::env::var("OI_NATIVE_SOURCE70_RECEIVING_EXECUTION_SHA256").unwrap()
        );
        let execution = raw(base, &captured["private_owner_execution"]);
        assert_eq!(
            execution,
            serde_json::from_slice::<Value>(&execution_bytes).unwrap()
        );
        assert_eq!(
            execution["schema"],
            "oi.actual-native-source70-receiving-execution/v1"
        );
        assert_eq!(
            execution["running_revisions"],
            captured["running_revisions"]
        );
        assert_eq!(execution["entries"], captured["entries"]);
        let entries = captured["entries"].as_array().unwrap();
        assert_eq!(entries.len(), 3);
        let mut phases = BTreeSet::new();
        for entry in entries {
            assert!(phases.insert(text(&entry["phase"]).unwrap()));
            let request = raw(base, &entry["original_native_owner_request"]);
            let reply = raw(base, &entry["original_native_owner_reply"]);
            assert_eq!(request["mode"], "source-bootstrap");
            assert_eq!(reply["schema"], "ql.native-act-owner-result/v1");
            assert_eq!(reply["status"], "ok");
            assert_eq!(reply["last_request_id"], request["request_id"]);
            let host = &reply["result"]["native_receipt"];
            assert_eq!(host["schema"], "ql.field-host-receipt/v1");
            assert_eq!(host["status"], "ok");
            assert_eq!(host["last_request_id"], request["request_id"]);
            let source = &host["procedural"];
            assert_eq!(*source, entry["source"]);
            let requirements: Vec<Requirement> =
                serde_json::from_value(source["consumer_contract"]["requirements"].clone())
                    .unwrap();
            let timing_owner = text(&source["timing"]["owner_ref"]).unwrap();
            let timing = requirements
                .iter()
                .find(|r| r.owner == timing_owner)
                .unwrap();
            let fact = current_timing_fact(timing, host).unwrap();
            validate_timing_requirement(
                timing,
                &source["timing"],
                &source["native_position"],
                &fact,
                field_receipt(host),
                host,
            )
            .unwrap();
            validate_performance_roster(&requirements, &source["timing"], host).unwrap();
            assert_ne!(
                timing.instance_ref,
                text(&source["native_position"]["instance_ref"]).unwrap()
            );
            assert_eq!(timing.generation_domain, "native-management-construction");
            let before = host.clone();
            for path in [
                "/native_timing_pulse/native_timing_owner/generation",
                "/native_timing_pulse/native_timing_owner/transport_epoch",
                "/native_timing_pulse/native_timing_owner/sample",
                "/native_timing_pulse/native_timing_owner/m3_source_generation",
                "/native_timing_pulse/payload/timing_fact/native_position/generation",
            ] {
                let mut wrong = host.clone();
                let value = wrong.pointer_mut(path).unwrap();
                let original = cursor(value).unwrap();
                *value = json!(original.checked_add(1).unwrap().to_string());
                let changed = current_timing_fact(timing, &wrong).unwrap();
                assert!(
                    validate_timing_requirement(
                        timing,
                        &source["timing"],
                        &source["native_position"],
                        &changed,
                        field_receipt(&wrong),
                        &wrong
                    )
                    .is_err(),
                    "{path}"
                );
            }
            let mut wrong = host.clone();
            wrong["native_timing_pulse"]["resident_consumers"]["required_consumers"]
                .as_array_mut()
                .unwrap()
                .push(fact.clone());
            assert!(validate_performance_roster(&requirements, &source["timing"], &wrong).is_err());
            assert_eq!(*host, before);
            let prepared = &entry["compiled_preparation"];
            let envelope = &entry["normal_prepare"]["envelope"];
            assert_eq!(
                prepared["required_consumers"],
                source["consumer_contract"]["required_consumers"]
            );
            assert_eq!(
                prepared["native_edit"]["expected_revision"],
                entry["before_document"]["revision"]
            );
            assert_eq!(envelope["scope"], entry["original_resolved_scope"]);
            assert_eq!(envelope["changes"], prepared["native_edit"]["changes"]);
            let participant = envelope["participants"]
                .as_array()
                .unwrap()
                .iter()
                .find(|r| r["owner"] == timing.owner)
                .unwrap();
            assert_eq!(participant["instance_ref"], timing.instance_ref);
            assert_eq!(
                participant["required_generation"],
                timing.required_generation
            );
            assert_eq!(envelope["timing"]["instance_ref"], timing.instance_ref);
            assert_eq!(entry["s_prepare"]["operation"]["status"], "prepared");
            assert_eq!(entry["s_prepare"]["operation"]["envelope"], *envelope);
            // This receipt is normal S Prepare. Queue/body/audio application
            // and withdrawal remain distinct actual owner operations.
        }
        assert_eq!(
            phases,
            BTreeSet::from(["prepared-held", "sounding", "restored"])
        );
    }
}
