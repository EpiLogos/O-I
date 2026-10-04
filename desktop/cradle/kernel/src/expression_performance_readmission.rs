//! Receiving restitution data retained by the existing continuation page.
//! A stored value is evidence only. Native restore admission is minted by the
//! private Manager channel under the actual closed selected Act reader.
use crate::expression_performance::{CheckpointBinding, Performance};
use crate::expression_performance_management::{
    InputHistoryEntry, ManagementState, NativeNoteTarget,
};
use crate::expression_performance_reservation::NativeReservationContinuation;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const SCHEMA: &str = "oi.expression-native-receiving-readmission/v1";

/// Lossless retained numerical/source evidence. Deserialize is needed for the
/// existing Act/File codec; it never constructs the private live channel handle.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RetainedReceivingReadmission {
    schema: String,
    original_checkpoint: CheckpointBinding,
    original_checkpoint_wire: String,
    operative_checkpoint_wire: String,
    before_checkpoint_wire: String,
    after_checkpoint_wire: String,
    current_receiving: Value,
    current_source_packet: Value,
    actual_native_basis: Value,
    selection: Value,
    native_parent_qualification: Value,
    native_pulse: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    selected_source_projection: Option<Value>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    // These are complete actual Control replies emitted by the normal native
    // current-receiving producer. No synthetic checkpoint or grant is made.
    fn actual_pulse(context: &str) -> Value {
        let directory = PathBuf::from(
            std::env::var_os("QL_RETAINED_RECEIVING_READMISSION_DIRECTORY")
                .expect("mandatory actual native receiving readmission producer directory"),
        );
        let path = directory.join(context).join("native-stdout.json");
        let bytes = std::fs::read(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
        assert!(bytes.len() <= crate::expression_performance_delivery::MAX_DELIVERY_BYTES);
        let producer: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(producer["schema"], "ql.receiving-restore-native-receipt/v1");
        let control = &producer[context]["control"];
        assert_eq!(control["actual_control_exact_continuation"], true);
        assert_eq!(control["actual_control_other_context_refused"], true);
        assert_eq!(
            control["actual_control_caller_source_mutation_refused"],
            true
        );
        assert_eq!(control["actual_control_observer_custody_preserved"], true);
        let pulse = &control["readmission_reply"];
        assert_eq!(pulse["schema"], "ql.performance-worker-reply/v1");
        assert_eq!(pulse["operation"], "restore-current-receiving");
        assert_eq!(pulse["accepted"], true);
        let reply = &pulse["payload"]["receiving_readmission"];
        assert_eq!(reply["schema"], "ql.native-receiving-readmission/v1");
        pulse.clone()
    }
    fn actual(context: &str) -> (Value, Value) {
        let pulse = actual_pulse(context);
        let reply = &pulse["payload"]["receiving_readmission"];
        (
            wire(reply["original_checkpoint_wire"].as_str().unwrap()).unwrap(),
            wire(reply["operative_checkpoint_wire"].as_str().unwrap()).unwrap(),
        )
    }

    #[test]
    fn actual_three_context_unread_applications_replay_exact_native_feedback_and_refuse_loss() {
        use crate::expression_performance::Counter;
        use crate::expression_performance_reservation::{
            native_observer_stream, verify_restored_observer_feedback,
        };
        for context in ["world", "personal", "shared"] {
            let pulse = actual_pulse(context);
            let original_pulse = pulse.clone();
            let reply = &pulse["payload"]["receiving_readmission"];
            let operative = wire(reply["operative_checkpoint_wire"].as_str().unwrap()).unwrap();
            let after = wire(reply["after_checkpoint_wire"].as_str().unwrap()).unwrap();
            let epoch: Counter =
                serde_json::from_value(reply["transport_ack"]["epoch"].clone()).unwrap();
            let applications = pulse["applications"].as_array().unwrap();
            let history: Vec<InputHistoryEntry> =
                serde_json::from_value(pulse["input_history"].clone()).unwrap();
            assert!(
                !applications.is_empty(),
                "genuine unread native application required"
            );
            let admitted: Vec<InputHistoryEntry> =
                serde_json::from_value(operative["input_history"]["entries"].clone()).unwrap();
            assert!(!admitted.is_empty());
            assert!(
                history.len() > admitted.len(),
                "native pulse must create actual feedback, not only echo admissions"
            );
            assert_eq!(&history[..admitted.len()], admitted.as_slice());
            assert!(history[admitted.len()..].iter().any(|e| e.change == 2
                && e.native_sequence == admitted[0].native_sequence
                && e.target == admitted[0].target));
            assert_eq!(operative["inputs"][0]["press_applied"], false);
            assert_eq!(after["inputs"][0]["press_applied"], true);
            verify_restored_observer_feedback(&operative, &after, epoch, applications, &history)
                .unwrap();
            // The next recording page must start AFTER this genuine input
            // feedback, without performing the original audio attack twice.
            let saved_stream = native_observer_stream(&operative).unwrap();
            let next_stream = native_observer_stream(&after).unwrap();
            assert_eq!(saved_stream.0, Counter(1));
            assert_eq!(saved_stream.1, Counter(1));
            assert_eq!(next_stream.0, saved_stream.0);
            assert_eq!(next_stream.1, Counter(2));
            assert_eq!(history[0].ordinal, saved_stream.1);
            assert_eq!(history.last().unwrap().ordinal, next_stream.1);
            assert_eq!(applications.len(), 1);
            assert_eq!(applications[0]["applied_application_ordinal"], "1");
            assert_eq!(history[1].native_sequence, history[0].native_sequence);
            assert_eq!(history[1].target, history[0].target);
            assert_eq!(history[1].change, 2);
            assert_eq!(operative["input_history"]["last_ordinal"], "1");
            assert_eq!(pulse, original_pulse, "complete raw native pulse changed");

            let mut lost = history.clone();
            lost.pop();
            assert!(
                verify_restored_observer_feedback(&operative, &after, epoch, applications, &lost)
                    .is_err()
            );
            let mut wrong = history.clone();
            wrong.reverse();
            assert!(
                verify_restored_observer_feedback(&operative, &after, epoch, applications, &wrong)
                    .is_err()
            );
            let mut wrong = history.clone();
            wrong[admitted.len()].change = 0;
            assert!(
                verify_restored_observer_feedback(&operative, &after, epoch, applications, &wrong)
                    .is_err()
            );
            let mut wrong = history.clone();
            wrong[admitted.len()].native_sequence = Counter(999999);
            assert!(
                verify_restored_observer_feedback(&operative, &after, epoch, applications, &wrong)
                    .is_err()
            );
            let mut wrong = after.clone();
            wrong["inputs"][0]["press_applied"] = serde_json::json!(false);
            assert!(
                verify_restored_observer_feedback(
                    &operative,
                    &wrong,
                    epoch,
                    applications,
                    &history
                )
                .is_err()
            );
            let mut wrong = after.clone();
            wrong["inputs"][0]["target"]["source_coordinate"] = serde_json::json!("#1-0");
            assert!(
                verify_restored_observer_feedback(
                    &operative,
                    &wrong,
                    epoch,
                    applications,
                    &history
                )
                .is_err()
            );
            let mut wrong = after.clone();
            let phase = wrong["inputs"][0]["target"]["phase_cos"].as_f64().unwrap();
            wrong["inputs"][0]["target"]["phase_cos"] =
                serde_json::json!(f64::from_bits(phase.to_bits() + 1));
            assert!(
                verify_restored_observer_feedback(
                    &operative,
                    &wrong,
                    epoch,
                    applications,
                    &history
                )
                .is_err()
            );
            let mut wrong = after.clone();
            wrong["inputs"][0]["target"]["foreign_scalar"] = serde_json::json!(1.0);
            assert!(
                verify_restored_observer_feedback(
                    &operative,
                    &wrong,
                    epoch,
                    applications,
                    &history
                )
                .is_err()
            );
            let mut wrong = after.clone();
            let q = &mut wrong["native_pair"]["physical"]["state"]["displacement_modal_metres"][0];
            *q = serde_json::json!(q.as_f64().unwrap() + 1.0);
            assert!(
                verify_restored_observer_feedback(
                    &operative,
                    &wrong,
                    epoch,
                    applications,
                    &history
                )
                .is_err()
            );
            let mut wrong = after.clone();
            wrong["native_pair"]["audio"]["applications"]["foreign_field"] =
                serde_json::json!(true);
            assert!(
                verify_restored_observer_feedback(
                    &operative,
                    &wrong,
                    epoch,
                    applications,
                    &history
                )
                .is_err()
            );
            let mut wrong = after.clone();
            wrong["input_history"]["last_ordinal"] = serde_json::json!("999999");
            assert!(
                verify_restored_observer_feedback(
                    &operative,
                    &wrong,
                    epoch,
                    applications,
                    &history
                )
                .is_err()
            );
            let mut wrong = applications.clone();
            wrong[0]["requested_sample"] = serde_json::json!("999999");
            assert!(
                verify_restored_observer_feedback(&operative, &after, epoch, &wrong, &history)
                    .is_err()
            );
        }
    }

    #[test]
    fn actual_three_context_native_receiving_derivative_preserves_entire_original() {
        for context in ["world", "personal", "shared"] {
            let (original, operative) = actual(context);
            verify_receiving_derivative(&original, &operative).unwrap();
            assert_eq!(original["input_history"], operative["input_history"]);
            assert_eq!(original["inputs"], operative["inputs"]);
            assert_eq!(original["transport_epoch"], operative["transport_epoch"]);
            assert_eq!(
                original["native_pair"]["physical"],
                operative["native_pair"]["physical"]
            );
        }
    }

    #[test]
    fn actual_receiving_derivative_refuses_queue_phase_and_original_timing_loss() {
        let (original, operative) = actual("personal");
        for path in [
            "/native_pair/audio/cursor",
            "/native_pair/audio/accepted_sequence",
            "/native_pair/audio/route_programs/programs/0/sine",
            "/native_pair/audio/route_programs/programs/0/handle/source_hertz",
            "/input_history/last_ordinal",
            "/transport_epoch",
        ] {
            let mut bad = operative.clone();
            let slot = bad
                .pointer_mut(path)
                .unwrap_or_else(|| panic!("actual producer omitted {path}"));
            let previous = slot.clone();
            *slot = if previous.is_string() {
                Value::String(
                    decimal(&previous)
                        .unwrap()
                        .checked_add(1)
                        .unwrap()
                        .to_string(),
                )
            } else {
                serde_json::json!(previous.as_f64().unwrap() + 1.0)
            };
            assert_ne!(*slot, previous);
            assert!(
                verify_receiving_derivative(&original, &bad).is_err(),
                "accepted loss at {path}"
            );
        }
    }

    #[test]
    fn actual_three_context_native_journal_typed_read_preserves_every_original_entry() {
        for context in ["world", "personal", "shared"] {
            let pulse = actual_pulse(context);
            let original = pulse.clone();
            let entries: Vec<InputHistoryEntry> =
                serde_json::from_value(pulse["input_history"].clone()).unwrap();
            assert!(
                !entries.is_empty(),
                "actual {context} observer journal required"
            );
            assert!(same_input_history(&entries, &pulse["input_history"]).unwrap());
            for entry in &entries {
                let encoded = serde_json::to_value(entry).unwrap();
                let decoded: InputHistoryEntry = serde_json::from_value(encoded).unwrap();
                assert_eq!(decoded, *entry);
            }
            assert_eq!(pulse, original, "raw actual native pulse was rewritten");
            let mut bad = pulse["input_history"].clone();
            bad[0]["target"]["foreign_scalar"] = serde_json::json!(1.0);
            assert!(same_input_history(&entries, &bad).is_err());
            let mut bad = pulse["input_history"].clone();
            bad[0]["native_sequence"] = serde_json::json!("999999");
            assert!(!same_input_history(&entries, &bad).unwrap());
        }
    }

    #[test]
    fn genuine_native_management_c_serde_roundtrip_keeps_exact_known_note_bits() {
        for context in ["world", "personal", "shared"] {
            let (original, operative) = actual(context);
            let raw_original = original.clone();
            // This is the existing C ManagementState serializer, retaining the
            // exact native pair. Targets originate exclusively from real CPP.
            let state = management_shell(&original).unwrap();
            let mut typed = serde_json::to_value(&state).unwrap();
            typed["native_pair"] = original["native_pair"].clone();
            assert!(same_management_wire(&original, &typed).unwrap());
            verify_receiving_derivative(&typed, &operative).unwrap();
            assert_eq!(original, raw_original);
            let target = &typed["input_history"]["entries"][0]["target"];
            assert!(
                same_note_wire(&original["input_history"]["entries"][0]["target"], target).unwrap()
            );
            let value = target["phase_cos"].as_f64().unwrap();
            for key in ["phase_cos", "hertz", "fundamental_hz", "phase_sin"] {
                let mut bad = target.clone();
                let bits = bad[key].as_f64().unwrap().to_bits();
                bad[key] = serde_json::json!(f64::from_bits(bits + 1));
                assert!(
                    !same_note_wire(target, &bad).unwrap(),
                    "accepted next ULP {key}"
                );
                let mut bad = target.clone();
                bad[key] = serde_json::json!("numeric text");
                assert!(same_note_wire(target, &bad).is_err());
            }
            assert!(value.is_finite());
            for key in ["source_coordinate", "touch_ref", "tuning_ref"] {
                let mut bad = target.clone();
                bad[key] = serde_json::json!("different:actual-source");
                assert!(!same_note_wire(target, &bad).unwrap());
            }
            let mut bad = operative.clone();
            bad["inputs"][0]["target"]["phase_cos"] =
                serde_json::json!(f64::from_bits(value.to_bits() + 1));
            assert!(verify_receiving_derivative(&typed, &bad).is_err());
            let mut bad = target.clone();
            bad.as_object_mut().unwrap().remove("ratio_numerator");
            assert!(same_note_wire(target, &bad).is_err());
            let mut bad = target.clone();
            bad["identity"]["extra_generation"] = serde_json::json!("1");
            assert!(same_note_wire(target, &bad).is_err());
            let mut bad = operative.clone();
            bad["extra_management_field"] = serde_json::json!(true);
            assert!(same_management_wire(&operative, &bad).is_err());
            let mut bad = operative.clone();
            bad["native_pair"]["audio"]["sample_rate"] = serde_json::json!(44100);
            assert!(verify_receiving_derivative(&typed, &bad).is_err());
        }
    }

    #[test]
    fn genuine_c_emitted_wire_same_cpp_control_c_readback_preserves_original_targets() {
        let first_directory = PathBuf::from(
            std::env::var_os("QL_RETAINED_RECEIVING_ORIGINAL_DIRECTORY")
                .expect("mandatory original actual three-context native producer directory"),
        );
        for context in ["world", "personal", "shared"] {
            let first: Value = serde_json::from_slice(
                &std::fs::read(first_directory.join(context).join("native-stdout.json")).unwrap(),
            )
            .unwrap();
            assert_eq!(first["schema"], "ql.receiving-restore-native-receipt/v1");
            assert_eq!(
                first[context]["control"]["actual_control_c_emitted_original_verified"],
                false
            );
            let second = actual_pulse(context);
            let first_readmission =
                &first[context]["control"]["readmission_reply"]["payload"]["receiving_readmission"];
            let second_readmission = &second["payload"]["receiving_readmission"];
            let original = wire(
                first_readmission["original_checkpoint_wire"]
                    .as_str()
                    .unwrap(),
            )
            .unwrap();
            let state = management_shell(&original).unwrap();
            let mut canonical = serde_json::to_value(&state).unwrap();
            canonical["native_pair"] = original["native_pair"].clone();
            let expected_text = serde_json::to_string(&canonical).unwrap();
            assert_eq!(
                second_readmission["original_checkpoint_wire"],
                expected_text
            );
            assert_eq!(
                second_readmission["current_receiving"],
                first_readmission["current_receiving"]
            );
            assert_eq!(
                second_readmission["current_source_packet"],
                first_readmission["current_source_packet"]
            );
            assert_eq!(
                second_readmission["actual_native_basis"],
                first_readmission["actual_native_basis"]
            );
            let operative = wire(
                second_readmission["operative_checkpoint_wire"]
                    .as_str()
                    .unwrap(),
            )
            .unwrap();
            verify_receiving_derivative(&canonical, &operative).unwrap();
            let entries: Vec<InputHistoryEntry> =
                serde_json::from_value(second["input_history"].clone()).unwrap();
            assert!(!entries.is_empty());
            assert!(same_input_history(&entries, &second["input_history"]).unwrap());
            let second_directory = PathBuf::from(
                std::env::var_os("QL_RETAINED_RECEIVING_READMISSION_DIRECTORY").unwrap(),
            );
            let receipt: Value = serde_json::from_slice(
                &std::fs::read(second_directory.join(context).join("native-stdout.json")).unwrap(),
            )
            .unwrap();
            assert_eq!(
                receipt[context]["control"]["actual_control_c_emitted_original_verified"],
                true
            );
            // Actual second-pass source/native invocation remains distinguishable
            // from the preserved first pass; no fabricated target/pulse positive.
        }
    }

    #[test]
    fn actual_world_receiving_manifest_cannot_be_stripped_or_admitted_at_other_cursor() {
        let (original, operative) = actual("world");
        assert_eq!(
            operative["native_pair"]["audio"]["route_programs"]["manifest"]["route_count"],
            "0"
        );
        let mut bad = operative.clone();
        bad["native_pair"]["audio"]["has_route_programs"] = serde_json::json!(false);
        bad["native_pair"]["audio"]["route_programs"] = Value::Null;
        assert!(verify_receiving_derivative(&original, &bad).is_err());
        let mut bad = operative;
        let cursor = decimal(&bad["native_pair"]["audio"]["cursor"]).unwrap();
        bad["native_pair"]["audio"]["route_programs"]["manifest"]["admitted_cursor"] =
            serde_json::json!(cursor + 1);
        assert!(verify_receiving_derivative(&original, &bad).is_err());
    }
}

fn decimal(value: &Value) -> Result<u64, String> {
    let text = value
        .as_str()
        .ok_or("receiving checkpoint counter absent")?;
    let number: u64 = text
        .parse()
        .map_err(|_| "receiving checkpoint counter invalid")?;
    if number.to_string() != text {
        return Err("receiving checkpoint counter is noncanonical".into());
    }
    Ok(number)
}
fn wire(text: &str) -> Result<Value, String> {
    if text.len() > crate::expression_performance_delivery::MAX_DELIVERY_BYTES {
        return Err("receiving checkpoint text exceeds the existing delivery bound".into());
    }
    serde_json::from_str(text).map_err(|e| e.to_string())
}
// json-c and Serde may spell the SAME native binary64 differently. Only the
// four existing NativeNoteTarget scalars are compared through their exact bits.
// Strict existing types retain every field, source identity and original ID.
// The full original text and raw native pulse are never rewritten.
fn same_note_wire(expected: &Value, actual: &Value) -> Result<bool, String> {
    let left: NativeNoteTarget = serde_json::from_value(expected.clone())
        .map_err(|e| format!("original native note target: {e}"))?;
    let right: NativeNoteTarget = serde_json::from_value(actual.clone())
        .map_err(|e| format!("actual native note target: {e}"))?;
    if left != right {
        return Ok(false);
    }
    for key in ["fundamental_hz", "hertz", "phase_sin", "phase_cos"] {
        let number = |value: &Value| -> Result<f64, String> {
            value[key]
                .as_f64()
                .filter(|n| n.is_finite())
                .ok_or_else(|| format!("finite native note scalar absent: {key}"))
        };
        if number(expected)?.to_bits() != number(actual)?.to_bits() {
            return Ok(false);
        }
    }
    Ok(true)
}
fn management_shell(value: &Value) -> Result<ManagementState, String> {
    let mut shell = value
        .as_object()
        .ok_or("native management wrapper absent")?
        .clone();
    shell
        .remove("native_pair")
        .ok_or("native management pair absent")?;
    serde_json::from_value(Value::Object(shell)).map_err(|e| e.to_string())
}
pub(crate) fn same_management_wire(expected: &Value, actual: &Value) -> Result<bool, String> {
    // Whole wrapper, bindings and journal deny unknown/missing/type changes.
    // The paired numerical Value retains exact full original comparison below.
    management_shell(expected)?;
    management_shell(actual)?;
    let mut comparison = expected.clone();
    for path in ["/inputs", "/input_history/entries"] {
        let left = comparison
            .pointer_mut(path)
            .and_then(Value::as_array_mut)
            .ok_or("original native input targets absent")?;
        let right = actual
            .pointer(path)
            .and_then(Value::as_array)
            .ok_or("actual native input targets absent")?;
        if left.len() != right.len() {
            return Ok(false);
        }
        for (original, received) in left.iter_mut().zip(right) {
            if !same_note_wire(&original["target"], &received["target"])? {
                return Ok(false);
            }
            // A temporary comparison only; no retained original is changed.
            original["target"] = received["target"].clone();
        }
    }
    Ok(comparison == *actual)
}
fn same_input_history(expected: &[InputHistoryEntry], actual: &Value) -> Result<bool, String> {
    let raw = actual
        .as_array()
        .ok_or("actual input history array absent")?;
    if raw.len() != expected.len() || raw.len() > 320 {
        return Ok(false);
    }
    let entries: Vec<InputHistoryEntry> =
        serde_json::from_value(actual.clone()).map_err(|e| e.to_string())?;
    if entries != expected {
        return Ok(false);
    }
    for (original, received) in expected.iter().zip(raw) {
        let target = serde_json::to_value(&original.target).map_err(|e| e.to_string())?;
        if !same_note_wire(&target, &received["target"])? {
            return Ok(false);
        }
    }
    Ok(true)
}

fn substitute(original: &mut Value, actual: &Value, key: &str) -> Result<(), String> {
    let value = actual
        .get(key)
        .ok_or("native receiving derivative field absent")?;
    decimal(value)?;
    let slot = original
        .get_mut(key)
        .ok_or("original receiving derivative field absent")?;
    decimal(slot)?;
    *slot = value.clone();
    Ok(())
}

/// Complete wire comparison with only the native numerical token's declared
/// derivative fields substituted. World route_count=0 still requires its
/// actual prepared manifest. No arbitrary field, phase, force or queue differs.
pub(crate) fn verify_receiving_derivative(
    original: &Value,
    operative: &Value,
) -> Result<(), String> {
    let mut expected = original.clone();
    let audio = expected
        .pointer_mut("/native_pair/audio")
        .ok_or("original receiving audio checkpoint absent")?;
    let actual_audio = operative
        .pointer("/native_pair/audio")
        .ok_or("operative receiving audio checkpoint absent")?;
    if audio["has_route_programs"] != true || actual_audio["has_route_programs"] != true {
        return Err("receiving readmission cannot promote a bare legacy scalar checkpoint".into());
    }
    let cursor = decimal(&audio["cursor"])?;
    let routes = audio
        .get_mut("route_programs")
        .ok_or("original native routes absent")?;
    let actual_routes = actual_audio
        .get("route_programs")
        .ok_or("operative native routes absent")?;
    let manifest = routes
        .get_mut("manifest")
        .ok_or("original native route manifest absent")?;
    let actual_manifest = actual_routes
        .get("manifest")
        .ok_or("operative native route manifest absent")?;
    if decimal(&actual_manifest["admitted_cursor"])? != cursor {
        return Err("fresh receiving manifest was not admitted at the actual saved cursor".into());
    }
    substitute(manifest, actual_manifest, "admitted_cursor")?;
    substitute(manifest, actual_manifest, "source_basis_seal")?;
    let count = decimal(&manifest["route_count"])?;
    if count > 9 {
        return Err("native receiving route bound exceeded".into());
    }
    let expected_handles = manifest
        .get_mut("programs")
        .and_then(Value::as_array_mut)
        .ok_or("original native route handles absent")?;
    let actual_handles = actual_manifest["programs"]
        .as_array()
        .ok_or("operative native route handles absent")?;
    if expected_handles.len() != count as usize || actual_handles.len() != expected_handles.len() {
        return Err("receiving readmission changed the exact route cohort".into());
    }
    for (expected_handle, actual_handle) in expected_handles.iter_mut().zip(actual_handles) {
        for key in ["preparation_seal", "program_seal"] {
            substitute(expected_handle, actual_handle, key)?;
        }
    }
    let programs = routes
        .get_mut("programs")
        .and_then(Value::as_array_mut)
        .ok_or("original ongoing native route programs absent")?;
    let actual_programs = actual_routes["programs"]
        .as_array()
        .ok_or("operative ongoing native route programs absent")?;
    if programs.len() != count as usize || actual_programs.len() != programs.len() {
        return Err("receiving readmission changed ongoing route programs".into());
    }
    for (program, actual_program) in programs.iter_mut().zip(actual_programs) {
        let handle = program
            .get_mut("handle")
            .ok_or("original program handle absent")?;
        for key in ["preparation_seal", "program_seal"] {
            substitute(handle, &actual_program["handle"], key)?;
        }
    }
    if !same_management_wire(&expected, operative)? {
        return Err("receiving readmission changed nonderivative original checkpoint state".into());
    }
    Ok(())
}

/// Exact historical source epoch projection. This validates retained data;
/// it cannot construct a Scene, lease, native owner or clock admission.
pub(crate) fn qualify_retained_source_projection(
    performance: &Performance,
    checkpoint: &CheckpointBinding,
    projection: &Value,
    scene_ref: &str,
) -> Result<(), String> {
    let fields = [
        "schema",
        "expression_ref",
        "scene_ref",
        "checkpoint_ref",
        "source_index",
        "basis_index",
        "basis_digest",
        "identity",
        "source_reading",
        "source_sample",
    ];
    let object = projection
        .as_object()
        .ok_or("retained native source epoch projection absent")?;
    if object.len() != fields.len()
        || fields.iter().any(|key| !object.contains_key(*key))
        || projection["schema"] != "ql.native-retained-performance-source-selection/v1"
        || projection["scene_ref"] != scene_ref
    {
        return Err("retained native source projection full field set/Scene differs".into());
    }
    crate::expression::text(
        projection["expression_ref"]
            .as_str()
            .ok_or("retained source Expression ref absent")?,
    )?;
    let index = |field: &str| -> Result<usize, String> {
        usize::try_from(
            projection[field]
                .as_u64()
                .ok_or_else(|| format!("restored source selection {field} absent"))?,
        )
        .map_err(|e| e.to_string())
    };
    let source_index = index("source_index")?;
    let basis_index = index("basis_index")?;
    let source = performance
        .native_sources
        .get(source_index)
        .ok_or("restored source epoch index is outside the original selected Act")?;
    let basis = performance
        .bases
        .get(basis_index)
        .ok_or("restored source basis index is outside the original selected Act")?;
    source.validate_basis(basis)?;
    let receiving = &checkpoint.audio["receiving"];
    let has_receiving = match checkpoint.audio.get("has_receiving") {
        Some(Value::Bool(value)) => *value,
        None if checkpoint.audio.get("receiving").is_none() => false,
        _ => return Err("selected checkpoint receiving pair differs".into()),
    };
    let legacy_v1 = receiving["schema"] == "ql.performance-receiving-checkpoint/v1"
        && source
            .native_bundle()
            .get("acoustic_transition_history")
            .is_none()
        && performance
            .native_sources
            .iter()
            .filter(|asset| asset.basis_digest() == source.basis_digest())
            .count()
            == 1;
    if !legacy_v1 {
        if has_receiving {
            // Musical identity is unchanged by M4. Match the WHOLE last actual
            // native receiving manifest in this source's ordered application
            // corpus to the exact saved checkpoint, including equal dates.
            let mut last: Option<(u64, &Value)> = None;
            for rows in [
                source.native_physical_source_history(),
                source.native_acoustic_source_history(),
            ]
            .into_iter()
            .flatten()
            {
                for row in rows {
                    let ordinal = decimal(&row["source"]["original_native_request_id"])?;
                    if last.is_none_or(|(old, _)| ordinal > old) {
                        last = Some((
                            ordinal,
                            &row["native_application"]["reading"]["receiving_transport"]["manifest"],
                        ));
                    }
                }
            }
            if source.native_bundle().get("acoustic_receiving").is_none()
                || !last.is_some_and(|(_, manifest)| {
                    manifest.is_object()
                        && manifest == receiving.get("manifest").unwrap_or(&Value::Null)
                })
            {
                return Err("restored source epoch differs from the original saved native receiving manifest/order".into());
            }
        } else if source.native_bundle().get("acoustic_receiving").is_some() {
            return Err("restored source epoch invents a receiver absent from the original saved checkpoint".into());
        }
    }
    let contact =
        crate::expression_performance_native_contact::checkpoint_contacts(&checkpoint.audio)?;
    let rows = source.native_contact_admission_history().unwrap_or(&[]);
    match contact {
        None if rows.is_empty()
            && source
                .native_bundle()
                .get("contact_occurrence_history")
                .is_none() => {}
        Some(ref state) => {
            let mut lineage = None;
            let mut last = 0u64;
            for row in rows {
                let occurrence = &row["source"]["occurrence"];
                let id = decimal(&occurrence["original_request_id"])?;
                let actual = occurrence["constructor_lineage"]
                    .as_str()
                    .ok_or("original Contact constructor lineage absent")?;
                if id <= last || lineage.is_some_and(|old| old != actual) {
                    return Err("selected Contact occurrence prefix order/lineage differs".into());
                }
                lineage = Some(actual);
                last = id;
            }
            if state.constructor_lineage
                != lineage.ok_or("saved Contact has no original admission prefix")?
                || state.original_request_high_water != crate::expression_performance::Counter(last)
            {
                return Err(
                    "saved Contact cut is not the exact original source/admission prefix".into(),
                );
            }
        }
        _ => return Err("saved Contact checkpoint and whole source epoch differ".into()),
    }
    let reading = serde_json::to_value(source.reading()?).map_err(|e| e.to_string())?;
    let sample = &source.native_bundle()["current_receiving"]["native_admission"]["operation"]["native_sample"];
    decimal(sample)?;
    if projection["checkpoint_ref"] != checkpoint.checkpoint_ref
        || projection["basis_digest"] != checkpoint.basis_digest
        || projection["identity"]
            != serde_json::to_value(&basis.identity).map_err(|e| e.to_string())?
        || projection["source_reading"] != reading
        || projection["source_sample"] != *sample
        || checkpoint.basis_digest != source.basis_digest()
        || checkpoint.identity != basis.identity
    {
        return Err(
            "retained native source epoch differs from complete source/basis/checkpoint".into(),
        );
    }
    Ok(())
}

impl RetainedReceivingReadmission {
    /// This constructor is crate-private and called only by the native Manager
    /// after consuming its non-Deserialize qualified socket reply carrier.
    pub(crate) fn from_native_channel(
        original_checkpoint: CheckpointBinding,
        selected_wire: &str,
        readmission: &Value,
        selection: Value,
        native_parent_qualification: Value,
        native_pulse: Value,
        selected_source_projection: Option<Value>,
    ) -> Result<Self, String> {
        if readmission["schema"] != "ql.native-receiving-readmission/v1"
            || readmission["original_checkpoint_wire"].as_str() != Some(selected_wire)
        {
            return Err(
                "native readmission lost the exact selected original checkpoint text".into(),
            );
        }
        let text = |key: &str| -> Result<String, String> {
            readmission[key]
                .as_str()
                .map(str::to_owned)
                .ok_or_else(|| format!("native readmission {key} text absent"))
        };
        let out = Self {
            schema: SCHEMA.into(),
            original_checkpoint,
            original_checkpoint_wire: text("original_checkpoint_wire")?,
            operative_checkpoint_wire: text("operative_checkpoint_wire")?,
            before_checkpoint_wire: text("before_checkpoint_wire")?,
            after_checkpoint_wire: text("after_checkpoint_wire")?,
            current_receiving: readmission["current_receiving"].clone(),
            current_source_packet: readmission["current_source_packet"].clone(),
            actual_native_basis: readmission["actual_native_basis"].clone(),
            selection,
            native_parent_qualification,
            native_pulse,
            selected_source_projection,
        };
        // This first comparison precedes the operative-to-after strict proof.
        verify_receiving_derivative(
            &wire(&out.original_checkpoint_wire)?,
            &wire(&out.operative_checkpoint_wire)?,
        )?;
        Ok(out)
    }

    pub fn original_checkpoint(&self) -> &CheckpointBinding {
        &self.original_checkpoint
    }
    pub fn original_checkpoint_wire(&self) -> &str {
        &self.original_checkpoint_wire
    }
    pub fn operative_checkpoint_wire(&self) -> &str {
        &self.operative_checkpoint_wire
    }
    pub fn native_pulse(&self) -> &Value {
        &self.native_pulse
    }
    pub(crate) fn before_wire(&self) -> Result<Value, String> {
        wire(&self.before_checkpoint_wire)
    }
    pub(crate) fn operative_wire(&self) -> Result<Value, String> {
        wire(&self.operative_checkpoint_wire)
    }
    pub(crate) fn after_wire(&self) -> Result<Value, String> {
        wire(&self.after_checkpoint_wire)
    }

    /// Read-back validation, not native admission. Exact originals, source,
    /// privacy, pulse and strict continuation remain in the same Act page.
    pub fn validate(
        &self,
        performance: &Performance,
        continuation: &NativeReservationContinuation,
    ) -> Result<(), String> {
        if self.schema != SCHEMA
            || self.selection["schema"] != "ql.native-act-source-lease-evidence/v1"
            || self.native_parent_qualification["schema"]
                != "oi.native-parent-channel-qualification/v1"
            || self.native_parent_qualification["qualified"] != true
            || self.native_pulse["schema"] != "ql.performance-worker-reply/v1"
        {
            return Err("retained receiving evidence schema/actual pulse lost".into());
        }
        self.original_checkpoint.validate()?;
        let original = wire(&self.original_checkpoint_wire)?;
        let operative = self.operative_wire()?;
        let before = self.before_wire()?;
        let after = self.after_wire()?;
        if !same_management_wire(
            &original,
            &self.original_checkpoint.native_management_wire()?,
        )? || !same_management_wire(&operative, &continuation.saved.native_management_wire()?)?
            || !same_management_wire(&before, &continuation.before.native_management_wire()?)?
            || !same_management_wire(&after, &continuation.after.native_management_wire()?)?
            || self.original_checkpoint.identity != continuation.saved.identity
            || self.original_checkpoint.sample != continuation.saved.sample
            || self.original_checkpoint.basis_digest != continuation.saved.basis_digest
            || self.original_checkpoint.event_prefix_digest
                != continuation.saved.event_prefix_digest
            || self.original_checkpoint.queued_events != continuation.saved.queued_events
            || self.original_checkpoint.unscored_queued_inputs
                != continuation.saved.unscored_queued_inputs
        {
            return Err(
                "receiving restitution dropped or replaced original stopped checkpoint custody"
                    .into(),
            );
        }
        verify_receiving_derivative(&original, &operative)?;
        let native = &self.native_pulse;
        if native["applications"]
            != serde_json::to_value(&continuation.restored_applications)
                .map_err(|e| e.to_string())?
            || !same_input_history(
                &continuation.restored_input_history,
                &native["input_history"],
            )?
            || native["payload"]["receiving_readmission"]["transport_ack"]
                != serde_json::to_value(&continuation.transport_ack).map_err(|e| e.to_string())?
            || decimal(&native["reading"]["samples_elapsed"])? != continuation.after.sample.0
        {
            return Err(
                "receiving continuation lost actual returned observer pulse/cursor/ACK".into(),
            );
        }
        let sources = &performance.native_sources;
        let source = if let Some(projection) = &self.selected_source_projection {
            let index = usize::try_from(
                projection["source_index"]
                    .as_u64()
                    .ok_or("readmission exact source epoch absent")?,
            )
            .map_err(|e| e.to_string())?;
            let source = sources
                .get(index)
                .ok_or("readmission source epoch outside original corpus")?;
            qualify_retained_source_projection(
                performance,
                &self.original_checkpoint,
                projection,
                self.selection["scene_ref"]
                    .as_str()
                    .ok_or("original selected Scene ref absent")?,
            )?;
            source
        } else {
            if sources.len() != 1 {
                return Err("legacy readmission has no unique complete source epoch".into());
            }
            &sources[0]
        };
        let bundle = source.native_bundle();
        if self.actual_native_basis != bundle["native_basis"]
            || self.current_receiving["schema"] != "ql.current-performance-receiving/v1"
            || self.current_receiving["source_inputs"] != bundle["receiving_source_inputs"]
            || self.current_receiving["source_context"] != bundle["source_context"]
            || self.current_receiving["receiving_definition"] != bundle["receiving_definition"]
            || !self.current_source_packet.is_object()
            || self.current_receiving["native_admission"]["native_basis"]
                != self.actual_native_basis
        {
            return Err(
                "receiving continuation changed original source/occasion/context/grant custody"
                    .into(),
            );
        }
        crate::expression_performance::safe(&self.current_receiving, 0)?;
        crate::expression_performance::safe(&self.native_pulse, 0)?;
        Ok(())
    }
}
