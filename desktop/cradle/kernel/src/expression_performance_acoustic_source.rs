//! Complete original acoustic source epochs in the existing native asset.
//! These structural checks retain integrity; the closed current native source
//! reader and independent QL replay still establish admission and disclosure.
use crate::expression_performance::Counter;
use serde_json::Value;

const FIELDS: [&str; 22] = [
    "schema",
    "kind",
    "original_native_request_id",
    "native_sample",
    "performance_configuration",
    "native_current_input",
    "native_preparation",
    "immutable_original_input",
    "before_configuration",
    "after_configuration",
    "before_source_inputs",
    "after_source_inputs",
    "before_source_context",
    "after_source_context",
    "before_receiving_definition",
    "after_receiving_definition",
    "before_current_receiving",
    "after_current_receiving",
    "before_acoustic",
    "after_acoustic",
    "history_origin_sample",
    "policy",
];
fn count(value: &Value) -> Result<u64, String> {
    serde_json::from_value::<Counter>(value.clone())
        .map(|v| v.0)
        .map_err(|e| e.to_string())
}
fn exact(value: &Value, names: &[&str]) -> bool {
    value
        .as_object()
        .is_some_and(|v| v.len() == names.len() && names.iter().all(|n| v.contains_key(*n)))
}
fn records<'a>(bundle: &'a Value, name: &str) -> Result<&'a [Value], String> {
    match bundle.get(name) {
        None => Ok(&[]),
        Some(value) => value
            .as_array()
            .filter(|v| !v.is_empty() && v.len() < crate::expression_performance::MAX_BASES)
            .map(Vec::as_slice)
            .ok_or_else(|| format!("complete original {name} is absent/excessive")),
    }
}

/// Exact interleaved receiving relation used by the original physical history
/// validator. No before/after receiving field is waived for an acoustic edit.
pub(super) fn receiving_between<'a>(
    bundle: &'a Value,
    previous_request: u64,
    next_request: Option<u64>,
    previous: Option<&'a Value>,
) -> Result<Option<&'a Value>, String> {
    let mut current = previous;
    for record in records(bundle, "acoustic_transition_history")? {
        let request = count(&record["original_native_request_id"])?;
        if request > previous_request && next_request.is_none_or(|end| request < end) {
            if current.is_some_and(|old| record["before_current_receiving"] != *old) {
                return Err(
                    "interleaved acoustic operation lost its full original receiving source".into(),
                );
            }
            current = Some(&record["after_current_receiving"]);
        }
    }
    Ok(current)
}

pub(super) fn validate_history(
    bundle: &Value,
    applications: Option<&[Value]>,
    require_applied: bool,
) -> Result<(), String> {
    let acoustic = records(bundle, "acoustic_transition_history")?;
    if acoustic.is_empty() {
        if applications.is_some() {
            return Err("acoustic applications without original source epochs".into());
        }
        return Ok(());
    }
    if applications.is_some_and(|v| v.len() != acoustic.len())
        || (require_applied && applications.is_none())
    {
        return Err(
            "acoustic source is prepared but lacks complete actual native applications".into(),
        );
    }
    let mut previous_request = 0;
    let mut previous_sample = 0;
    for (index, record) in acoustic.iter().enumerate() {
        let request = count(&record["original_native_request_id"])?;
        let sample = count(&record["native_sample"])?;
        let birth = count(&record["history_origin_sample"])?;
        let install = record["kind"] == "install";
        if !exact(record, &FIELDS)
            || record["schema"] != "ql.native-acoustic-source-transition/v1"
            || !matches!(record["kind"].as_str(), Some("install" | "replace"))
            || request <= previous_request
            || sample < previous_sample
            || birth > sample
            || record["immutable_original_input"] != bundle["original_native_input"]
            || !record["native_preparation"].is_object()
            || !record["native_current_input"].is_object()
            || record["after_configuration"] != record["after_acoustic"]["configuration"]
            || record["after_acoustic"]["source_body"]
                != record["native_preparation"]["physical_body"]
            || record["after_acoustic"]["origin_sample"] != record["native_sample"]
            || record["after_acoustic"]["history_origin_sample"] != record["history_origin_sample"]
            || record["before_source_inputs"]["return_context"]
                != record["after_source_inputs"]["return_context"]
            || record["after_source_inputs"]["acoustic_receiving"] != record["after_configuration"]
            || record["before_current_receiving"]["source_inputs"] != record["before_source_inputs"]
            || record["after_current_receiving"]["source_inputs"] != record["after_source_inputs"]
            || record["after_current_receiving"]["source_context"] != record["after_source_context"]
            || record["after_current_receiving"]["receiving_definition"]
                != record["after_receiving_definition"]
            || record["after_current_receiving"]["native_admission"]["native_preparation"]
                != record["native_preparation"]
        {
            return Err("original acoustic source epoch fields/context/body/date differ".into());
        }
        let before = record["before_source_inputs"]
            .as_object()
            .ok_or("original receiving inputs absent")?;
        let after = record["after_source_inputs"]
            .as_object()
            .ok_or("acoustic receiving inputs absent")?;
        if before
            .iter()
            .any(|(key, value)| key != "acoustic_receiving" && after.get(key) != Some(value))
            || after
                .keys()
                .any(|key| key != "acoustic_receiving" && !before.contains_key(key))
        {
            return Err(
                "acoustic edit changed original World/profile/occasion/source inputs".into(),
            );
        }
        if install {
            if index != 0
                || !record["before_configuration"].is_null()
                || !record["before_acoustic"].is_null()
                || before.contains_key("acoustic_receiving")
                || birth != sample
                || record["policy"]
                    != "same retained physical body and original World/occasion, exact first native receiver birth"
            {
                return Err("initial receiver installation lost original absence/birth".into());
            }
        } else if record["before_configuration"] != record["before_acoustic"]["configuration"]
            || record["before_source_inputs"]["acoustic_receiving"]
                != record["before_configuration"]
            || record["before_acoustic"]["history_origin_sample"] != record["history_origin_sample"]
            || record["before_configuration"]["revision"]
                .as_u64()
                .zip(record["after_configuration"]["revision"].as_u64())
                .is_none_or(|(old, new)| new <= old)
            || record["policy"]
                != "same retained physical body and original World/occasion, exact dated emitter and receiver, full original native delay ring"
        {
            return Err("receiver replacement lost original segment/configuration/birth".into());
        }
        if let Some(applications) = applications {
            let original = &applications[index];
            let pulse = &original["native_application"];
            let reading = &pulse["reading"];
            let manifest = &reading["receiving_transport"]["manifest"];
            if !exact(original, &["source", "native_application"])
                || original["source"] != *record
                || pulse["accepted"] != true
                || pulse["operation"]
                    != if install {
                        "receiving-transport-install"
                    } else {
                        "receiving-transport-replace"
                    }
                || reading["samples_elapsed"] != record["native_sample"]
                || reading["physical"]["samples_elapsed"] != record["native_sample"]
                || reading["receiving_transport"]["samples_elapsed"] != record["native_sample"]
                || !matches!(
                    reading["device"]["state"].as_str(),
                    Some("closed" | "prepared")
                )
                || count(&reading["transport_epoch"])? == 0
                || manifest["origin_sample"] != record["native_sample"]
                || manifest["history_origin_sample"] != record["history_origin_sample"]
                || manifest["eigenbasis"] != reading["physical"]["eigenbasis_identity"]
            {
                return Err(
                    "acoustic source lost its original accepted same-owner native application"
                        .into(),
                );
            }
            count(&reading["accepted_sequence"])?;
            if !install {
                let ack = &pulse["payload"]["receiving_replacement"];
                if ack["schema"] != "ql.native-receiving-replacement/v1"
                    || ack["sample"] != record["native_sample"]
                    || ack["after_manifest"] != *manifest
                    || ack["before_manifest"]["eigenbasis"] != manifest["eigenbasis"]
                    || ack["transport_epoch"] != reading["transport_epoch"]
                    || ack["accepted_sequence"] != reading["accepted_sequence"]
                {
                    return Err(
                        "original acoustic replacement ACK detached from native source".into(),
                    );
                }
            }
        }
        previous_request = request;
        previous_sample = sample;
    }
    validate_interleaved_source(bundle, acoustic)
}

fn validate_interleaved_source(bundle: &Value, acoustic: &[Value]) -> Result<(), String> {
    let physical = records(bundle, "physical_transition_history")?;
    let mut ordered = physical
        .iter()
        .map(|r| (r, false))
        .chain(acoustic.iter().map(|r| (r, true)))
        .map(|(r, a)| Ok((count(&r["original_native_request_id"])?, r, a)))
        .collect::<Result<Vec<_>, String>>()?;
    ordered.sort_by_key(|(request, _, _)| *request);
    if ordered.len() >= crate::expression_performance::MAX_BASES {
        return Err("complete native source epoch bound exceeded".into());
    }
    let (_, first, is_acoustic) = ordered.first().ok_or("original source epoch absent")?;
    let mut input = if *is_acoustic {
        &first["native_current_input"]
    } else {
        &first["before_current_input"]
    };
    let mut configuration = if *is_acoustic {
        &first["performance_configuration"]
    } else {
        &first["before_configuration"]
    };
    let mut receiving = &first["before_current_receiving"];
    let mut packet = &first["before_acoustic"];
    let mut request = 0;
    let mut sample = 0;
    if *input != bundle["original_native_input"] {
        return Err("mixed source did not start at original native constructor".into());
    }
    for (next, record, is_acoustic) in ordered {
        let at = count(&record["native_sample"])?;
        if next <= request
            || at < sample
            || record["before_current_receiving"] != *receiving
            || record["before_acoustic"] != *packet
        {
            return Err(
                "mixed source history lost original chronological receiving/body relation".into(),
            );
        }
        if is_acoustic {
            if record["native_current_input"] != *input
                || record["performance_configuration"] != *configuration
                || record["before_source_inputs"] != receiving["source_inputs"]
                || record["before_source_context"] != receiving["source_context"]
                || record["before_receiving_definition"] != receiving["receiving_definition"]
            {
                return Err(
                    "acoustic source borrowed another original physical/context epoch".into(),
                );
            }
        } else {
            if record["before_current_input"] != *input
                || record["before_configuration"] != *configuration
            {
                return Err("physical edit borrowed another acoustic/source epoch".into());
            }
            input = &record["after_current_input"];
            configuration = &record["after_configuration"];
        }
        receiving = &record["after_current_receiving"];
        packet = &record["after_acoustic"];
        request = next;
        sample = at;
    }
    let operative = bundle
        .get("operative_native_input")
        .unwrap_or(&bundle["original_native_input"]);
    if input != operative
        || configuration != &bundle["configuration"]
        || receiving != &bundle["current_receiving"]
        || receiving["source_inputs"] != bundle["receiving_source_inputs"]
        || receiving["source_context"] != bundle["source_context"]
        || receiving["receiving_definition"] != bundle["receiving_definition"]
        || packet != &bundle["acoustic_receiving"]["packet"]
    {
        return Err("current native source differs from complete mixed original epochs".into());
    }
    Ok(())
}
