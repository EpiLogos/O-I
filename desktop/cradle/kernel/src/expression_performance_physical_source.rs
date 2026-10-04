//! Retained integrity of original/operative source lineage in the SAME C asset.
//! Native preparation and actual application qualification stay in QL's private
//! owner replay; these checks cannot mint a current source, body or clock.
use crate::expression_performance::Counter;
use serde_json::Value;

fn exact(value: &Value, names: &[&str]) -> bool {
    value
        .as_object()
        .is_some_and(|o| o.len() == names.len() && names.iter().all(|n| o.contains_key(*n)))
}
fn count(value: &Value) -> Result<u64, String> {
    serde_json::from_value::<Counter>(value.clone())
        .map(|v| v.0)
        .map_err(|e| e.to_string())
}
fn projection(original: &Value, projection: &Value, input: Option<&Value>) -> Result<(), String> {
    if projection["schema"] != "ql.retained-physical-consumer-projection/v1"
        || projection["original_native_input"] != *original
        || projection["policy"] != "excitation pitches do not retune physical eigenmodes"
    {
        return Err("native original/projection source relation lost".into());
    }
    for key in [
        "frequency_bindings",
        "condition_frequency_bindings",
        "sky_frequency_bindings",
    ] {
        let optional = key != "frequency_bindings";
        let original_entries = match original.get(key) {
            Some(Value::Array(entries)) => entries.as_slice(),
            None if optional => &[],
            _ => return Err("native original bindings have no typed array contract".into()),
        };
        if projection["legacy_mode_frequency_bindings"][key]
            .as_array()
            .map(Vec::as_slice)
            != Some(original_entries)
        {
            return Err("native source lost original retired bindings".into());
        }
        if let Some(input) = input {
            if !match input.get(key) {
                Some(Value::Array(a)) => a.is_empty(),
                None if optional => true,
                _ => false,
            } {
                return Err("native physical projection remapped body modes".into());
            }
        }
    }
    if let Some(input) = input {
        for key in ["schema", "m1", "m3", "m3_commands", "harmonic_source"] {
            if input[key] != original[key] {
                return Err(format!(
                    "physical projection changed operative source: {key}"
                ));
            }
        }
        let receipts = input["source_receipts"]
            .as_array()
            .ok_or("projected source receipts absent")?;
        let originals = original["source_receipts"]
            .as_array()
            .ok_or("original source receipts absent")?;
        if !receipts.starts_with(originals) || !receipts.contains(projection) {
            return Err("physical projection lost original receipts/occasion".into());
        }
    }
    Ok(())
}
pub(super) fn validate_bundle_projection(bundle: &Value) -> Result<(), String> {
    let original = &bundle["original_native_input"];
    let has_history = bundle.get("physical_transition_history").is_some();
    projection(
        original,
        &bundle["physical_consumer_projection"],
        if has_history {
            None
        } else {
            Some(&bundle["native_basis"]["input"])
        },
    )?;
    if has_history {
        let operative = &bundle["operative_native_input"];
        if !operative.is_object() || !bundle["operative_physical_consumer_projection"].is_object() {
            return Err("physical source lost explicit operative descendant".into());
        }
        projection(
            operative,
            &bundle["operative_physical_consumer_projection"],
            Some(&bundle["native_basis"]["input"]),
        )?;
        if bundle["operative_physical_consumer_projection"]["projection_ref"]
            != bundle["configuration"]["projection_ref"]
        {
            return Err("operative physical projection has another policy reference".into());
        }
    } else if bundle.get("operative_native_input").is_some()
        || bundle
            .get("operative_physical_consumer_projection")
            .is_some()
        || bundle["physical_consumer_projection"]["projection_ref"]
            != bundle["configuration"]["projection_ref"]
    {
        return Err("operative source without complete original lineage".into());
    }
    Ok(())
}
const RECORD_FIELDS: [&str; 21] = [
    "schema",
    "edit_schema",
    "original_native_request_id",
    "native_sample",
    "kind",
    "authored_edit",
    "before_current_input",
    "after_current_input",
    "native_m3_receipt",
    "before_m3",
    "after_m3",
    "before_configuration",
    "after_configuration",
    "before_native_preparation",
    "after_native_preparation",
    "before_current_receiving",
    "after_current_receiving",
    "prepared_physical_transition",
    "before_acoustic",
    "after_acoustic",
    "policy",
];
pub(super) fn validate_history(
    bundle: &Value,
    applications: Option<&[Value]>,
    require_applied: bool,
) -> Result<(), String> {
    let Some(history) = bundle.get("physical_transition_history") else {
        if applications.is_some() {
            return Err("physical applications without their original source lineage".into());
        }
        return Ok(());
    };
    let history = history
        .as_array()
        .filter(|h| !h.is_empty() && h.len() < crate::expression_performance::MAX_BASES)
        .ok_or("original physical source history absent/excessive")?;
    if applications.is_some_and(|a| a.len() != history.len())
        || (require_applied && applications.is_none())
    {
        return Err(
            "physical source is prepared but lacks complete actual native applications".into(),
        );
    }
    let mut previous_input = &bundle["original_native_input"];
    let mut previous_config: Option<&Value> = None;
    let mut previous_receiving: Option<&Value> = None;
    let mut previous_request = 0;
    let mut previous_sample = 0;
    let mut previous_native: Option<&Value> = None;
    let mut previous_eigenbasis: Option<&Value> = None;
    for (index, record) in history.iter().enumerate() {
        if !exact(record, &RECORD_FIELDS)
            || record["schema"] != "ql.native-physical-source-transition/v1"
            || record["edit_schema"] != "ql.native-physical-edit/v1"
            || record["before_current_input"] != *previous_input
            || !matches!(record["kind"].as_str(), Some("form" | "material"))
            || !record["authored_edit"].is_object()
            || !record["prepared_physical_transition"].is_object()
            || record["policy"]
                != "same retained physical body, exact corresponding-node mass projection, original native cursor and complete source lineage"
            || previous_config.is_some_and(|p| record["before_configuration"] != *p)
            || super::acoustic_source::receiving_between(
                bundle,
                previous_request,
                Some(count(&record["original_native_request_id"])?),
                previous_receiving,
            )?
            .is_some_and(|p| record["before_current_receiving"] != *p)
            || previous_native.is_some_and(|p| record["before_native_preparation"] != *p)
        {
            return Err("original physical source lineage lost/changed/reordered".into());
        }
        let authored = &record["authored_edit"];
        let valid_edit = match authored["kind"].as_str() {
            Some("form") => {
                exact(
                    authored,
                    &[
                        "kind",
                        "actor_ref",
                        "cause_ref",
                        "occurrence_unix_ms",
                        "receipt_unix_ms",
                        "operations",
                    ],
                ) && record["kind"] == "form"
                    && record["native_m3_receipt"].is_object()
            }
            Some("metric-form") => {
                exact(authored, &["kind", "cause_ref", "recipe"])
                    && record["kind"] == "form"
                    && record["native_m3_receipt"].is_null()
            }
            Some("material") => {
                exact(authored, &["kind", "cause_ref", "material"])
                    && record["kind"] == "material"
                    && record["native_m3_receipt"].is_null()
            }
            _ => false,
        };
        if !valid_edit {
            return Err("physical lineage lost its exact original authored operation".into());
        }
        let request = count(&record["original_native_request_id"])?;
        let sample = count(&record["native_sample"])?;
        if request <= previous_request || sample < previous_sample {
            return Err("original physical source request/time regressed".into());
        }
        let before = &record["before_current_input"];
        let after = &record["after_current_input"];
        let before_object = before.as_object().ok_or("original physical input absent")?;
        let after_object = after.as_object().ok_or("operative physical input absent")?;
        if before_object.len() != after_object.len()
            || before_object.iter().any(|(key, value)| {
                !["m3", "m3_commands", "source_receipts"].contains(&key.as_str())
                    && after_object.get(key) != Some(value)
            })
        {
            return Err("physical edit changed original M1/M2/event/subject/source".into());
        }
        for key in ["m3_commands", "source_receipts"] {
            let original = before[key]
                .as_array()
                .ok_or("original physical command/receipt array absent")?;
            if !after[key]
                .as_array()
                .is_some_and(|a| a.starts_with(original))
            {
                return Err("physical edit lost original command/receipt prefix".into());
            }
        }
        if record["before_configuration"]["controls"]["sample_rate"]
            != record["after_configuration"]["controls"]["sample_rate"]
        {
            return Err("physical body edit changed the native clock rate".into());
        }
        if let Some(applications) = applications {
            let entry = &applications[index];
            if !exact(entry, &["source", "native_application"]) || entry["source"] != *record {
                return Err(
                    "physical application detached from full original source record".into(),
                );
            }
            let pulse = &entry["native_application"];
            let ack = &pulse["payload"]["physical_transition"];
            if pulse["accepted"] != true
                || pulse["operation"] != "source-body-transition"
                || pulse["reading"]["samples_elapsed"] != record["native_sample"]
                || !matches!(
                    pulse["reading"]["device"]["state"].as_str(),
                    Some("closed" | "prepared")
                )
                || ack["schema"] != "ql.native-physical-source-application/v1"
                || ack["original_native_request_id"] != record["original_native_request_id"]
                || ack["native_sample"] != record["native_sample"]
                || ack["kind"] != record["kind"]
                || ack["policy"] != "project-corresponding-nodes"
                || ack["before_native_preparation"] != record["before_native_preparation"]
                || ack["after_native_preparation"] != record["after_native_preparation"]
                || count(&ack["before_body_revision"])?
                    != record["before_configuration"]["controls"]["body_revision"]
                        .as_u64()
                        .ok_or("original body revision absent")?
                || count(&ack["after_body_revision"])?
                    != record["after_configuration"]["controls"]["body_revision"]
                        .as_u64()
                        .ok_or("operative body revision absent")?
                || ack["after_body_revision"] != pulse["reading"]["scope"]["body_revision"]
                || ack["after_eigenbasis_identity"]
                    != pulse["reading"]["physical"]["eigenbasis_identity"]
                || ack["transport_epoch"] != pulse["reading"]["transport_epoch"]
                || ack["accepted_sequence"] != pulse["reading"]["accepted_sequence"]
                || count(&ack["transport_epoch"])? == 0
                || previous_eigenbasis.is_some_and(|p| ack["before_eigenbasis_identity"] != *p)
            {
                return Err("physical source lacks its actual same-owner body application".into());
            }
            for field in [
                "before_energy_joules",
                "after_energy_joules",
                "external_work_joules",
            ] {
                if ack[field].as_f64().is_none_or(|v| !v.is_finite()) {
                    return Err("actual physical application energy/work absent/nonfinite".into());
                }
            }
            previous_eigenbasis = Some(&ack["after_eigenbasis_identity"]);
        }
        previous_request = request;
        previous_sample = sample;
        previous_input = after;
        previous_config = Some(&record["after_configuration"]);
        previous_receiving = Some(&record["after_current_receiving"]);
        previous_native = Some(&record["after_native_preparation"]);
    }
    if previous_input != &bundle["operative_native_input"]
        || previous_config != Some(&bundle["configuration"])
        || super::acoustic_source::receiving_between(
            bundle,
            previous_request,
            None,
            previous_receiving,
        )? != Some(&bundle["current_receiving"])
    {
        return Err("operative current source differs from full original physical history".into());
    }
    Ok(())
}

pub(super) fn validate_acoustic_payload(bundle: &Value, private: bool) -> Result<(), String> {
    let inputs = &bundle["receiving_source_inputs"];
    let config = inputs.get("acoustic_receiving");
    let retained = bundle.get("acoustic_receiving");
    if config.is_none() && retained.is_none() {
        return Ok(());
    }
    let config = config.ok_or("native receiver source configuration absent")?;
    let retained = retained.ok_or("native receiver original source segment absent")?;
    const CONFIG: [&str; 18] = [
        "schema",
        "source_ref",
        "source_motion_ref",
        "receiver_motion_ref",
        "policy_ref",
        "policy_revision",
        "standing",
        "revision",
        "source_translation_metres",
        "receiver_position_metres",
        "receiver_forward",
        "source_velocity_metres_per_second",
        "receiver_velocity_metres_per_second",
        "speed_metres_per_second",
        "minimum_distance_metres",
        "directivity",
        "propagation_delay",
        "span_samples",
    ];
    let packet = &retained["packet"];
    if !exact(config, &CONFIG)
        || !exact(retained, &["schema", "packet", "current_receiving"])
        || retained["schema"] != "ql.current-native-acoustic-receiving/v1"
        || packet["schema"] != "ql.native-acoustic-receiving-preparation/v1"
        || packet["configuration"] != *config
        || packet["context"] != inputs["return_context"]
        || packet["source_body"]
            != bundle["current_receiving"]["native_admission"]["native_preparation"]["physical_body"]
        || !retained["current_receiving"].is_object()
        || retained["current_receiving"]["source_inputs"] != *inputs
        || retained["current_receiving"]["source_context"] != bundle["source_context"]
        || retained["current_receiving"]["receiving_definition"] != bundle["receiving_definition"]
        || retained["current_receiving"]["native_admission"]["native_basis"]
            != bundle["native_basis"]
        || retained["current_receiving"]["native_admission"]["native_preparation"]
            != bundle["current_receiving"]["native_admission"]["native_preparation"]
        || retained["current_receiving"]["native_admission"]["operation"]["native_sample"]
            != packet["origin_sample"]
    {
        return Err("native acoustic configuration/source/body/context custody differs".into());
    }
    super::validate_receiving_snapshot(
        &retained["current_receiving"],
        inputs,
        &bundle["source_context"],
        &bundle["receiving_definition"],
        &bundle["native_basis"],
        private,
    )?;
    let origin = count(&packet["origin_sample"])?;
    let birth = count(&packet["history_origin_sample"])?;
    let end = count(&packet["end_sample"])?;
    let span = config["span_samples"]
        .as_u64()
        .ok_or("native acoustic span absent")?;
    if birth > origin || origin.checked_add(span) != Some(end) {
        return Err("native acoustic segment lost original birth/duration".into());
    }
    Ok(())
}
