//! Real QL C/Rust/C++ owner through the production manager. Only Central's file
//! disclosure is controlled; the domain engine and process lifetime are real.
#![cfg(unix)]
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::{
    native_expression::{Manager, Request},
    CentralClient,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::os::unix::fs::PermissionsExt;
use std::{
    fs,
    path::{Path, PathBuf},
    time::{Instant, SystemTime, UNIX_EPOCH},
};

struct Scratch(PathBuf);
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn packet(last: &Value, command: Value) -> Value {
    json!({"schema":"ql.field-host-request/v1", "instance_ref":last["instance_ref"],
        "event_ref":last["field"]["event_ref"], "subject_ref":last["field"]["subject_ref"],
        "request_id":(last["last_request_id"].as_str().unwrap().parse::<u64>().unwrap()+1).to_string(),
        "expected_generation":last["field"]["generation"],
        "expected_samples_elapsed":last["field"]["samples_elapsed"],"command":command})
}
fn exchange(
    manager: &mut Manager,
    client: &CentralClient,
    lease: &str,
    last: &mut Value,
    command: Value,
) -> Value {
    let result = manager
        .apply(
            client,
            Request::Exchange {
                lease: lease.into(),
                request: packet(last, command),
            },
        )
        .unwrap();
    *last = result.clone();
    result
}
fn state(reply: &Value) -> Value {
    let mut value = reply["field"].clone();
    value["audio"] = json!([]);
    value
}

// QL's original.input is a typed CoupledInput, not the original JSON token
// stream. Its opaque source_receipts are parsed by the native QL owner and may
// serialize an equivalent finite decimal spelling. Retain full receipt shape,
// exact decimal value AND IEEE bits here; raw input bytes remain separately
// attributed by input_sha256. This does not change global Value equality or
// reinterpret any product source, body, permission or field input.
fn receipt_number_basis(number: &serde_json::Number) -> Option<(bool, String, i64, u64)> {
    let finite = number.as_f64()?;
    if !finite.is_finite() {
        return None;
    }
    let token = number.to_string();
    let negative = token.starts_with('-');
    let unsigned = token.strip_prefix('-').unwrap_or(&token);
    let (mantissa, exponent) = match unsigned.split_once(|ch| ch == 'e' || ch == 'E') {
        Some((mantissa, exponent)) => (mantissa, exponent.parse::<i64>().ok()?),
        None => (unsigned, 0),
    };
    let (integer, fraction) = mantissa.split_once('.').unwrap_or((mantissa, ""));
    let digits = format!("{integer}{fraction}");
    if digits.is_empty() || !digits.bytes().all(|digit| digit.is_ascii_digit()) {
        return None;
    }
    let digits = digits.trim_start_matches('0');
    if digits.is_empty() {
        return Some((negative, "0".into(), 0, finite.to_bits()));
    }
    let significant = digits.trim_end_matches('0');
    let removed = i64::try_from(digits.len() - significant.len()).ok()?;
    let fraction_len = i64::try_from(fraction.len()).ok()?;
    let scale = exponent.checked_sub(fraction_len)?.checked_add(removed)?;
    Some((negative, significant.into(), scale, finite.to_bits()))
}
fn same_typed_source_receipt(actual: &Value, expected: &Value) -> bool {
    match (actual, expected) {
        (Value::Number(actual), Value::Number(expected)) => {
            match (receipt_number_basis(actual), receipt_number_basis(expected)) {
                (Some(actual), Some(expected)) => actual == expected,
                _ => false,
            }
        }
        (Value::Array(actual), Value::Array(expected)) => {
            actual.len() == expected.len()
                && actual.iter().zip(expected).all(|(actual, expected)| {
                    same_typed_source_receipt(actual, expected)
                })
        }
        (Value::Object(actual), Value::Object(expected)) => {
            actual.len() == expected.len()
                && actual.iter().all(|(key, actual)| {
                    expected.get(key).is_some_and(|expected| {
                        same_typed_source_receipt(actual, expected)
                    })
                })
        }
        _ => actual == expected,
    }
}
fn same_original_input_basis(actual: &Value, expected: &Value) -> bool {
    let (Some(actual), Some(expected)) = (actual.as_object(), expected.as_object()) else {
        return false;
    };
    actual.len() == expected.len()
        && actual.iter().all(|(key, actual)| {
            expected.get(key).is_some_and(|expected| {
                if key == "source_receipts" {
                    same_typed_source_receipt(actual, expected)
                } else {
                    actual == expected
                }
            })
        })
}

// Comparator conformance only, using the three original 3f1 native Inspect
// operand pairs. This test supplies no native input or numerical acceptance.
#[test]
fn typed_receipt_comparison_keeps_exact_value_bits_shape_and_raw_basis() {
    let value = |token: &str| serde_json::from_str::<Value>(token).unwrap();
    for (actual, original) in [
        ("-0.000011802825996413943", "-1.1802825996413943e-05"),
        ("0.000026595910808642593", "2.6595910808642593e-05"),
        ("0.000011881545124631414", "1.1881545124631414e-05"),
    ] {
        assert!(same_typed_source_receipt(&value(actual), &value(original)));
    }
    let original = value("0.000011881545124631414");
    let changed = value("0.0000118815451246314141");
    assert_eq!(original.as_f64().unwrap().to_bits(), changed.as_f64().unwrap().to_bits());
    assert!(!same_typed_source_receipt(&original, &changed), "same IEEE bits must not hide a changed decimal value");
    assert!(!same_typed_source_receipt(&value("-0.0"), &value("0.0")), "signed zero must retain its bits");
    assert!(!same_typed_source_receipt(&value("1.0"), &value("1.0000000000000002")), "changed finite IEEE value must refuse");
    assert!(!same_typed_source_receipt(&json!([1, 2]), &json!([2, 1])), "receipt array order must stay exact");
    assert!(!same_typed_source_receipt(&json!({"body":"Moon"}), &json!({"body":"Sun"})), "receipt text must stay exact");
    assert!(!same_typed_source_receipt(&json!({"body":"Moon"}), &json!({"body":"Moon", "extra":null})), "receipt members must stay exact");
    let actual = value(r#"{"m1":{"drive":1e-5},"source_receipts":[{"rate":1e-5}]}"#);
    let receipts_only = value(r#"{"m1":{"drive":1e-5},"source_receipts":[{"rate":0.00001}]}"#);
    let non_receipt = value(r#"{"m1":{"drive":0.00001},"source_receipts":[{"rate":0.00001}]}"#);
    assert!(same_original_input_basis(&actual, &receipts_only));
    assert!(!same_original_input_basis(&actual, &non_receipt), "outside opaque typed receipts Number tokens remain exact");
}

#[test]
#[ignore = "requires explicitly built OI_QL_FIELD_HOST_BIN, OI_QL_FIELD_WORKER_BIN and NATIVE_EXPRESSION_INPUT"]
fn real_native_owner_admission_effects_refusals_restart_and_release() {
    for name in ["OI_QL_FIELD_HOST_BIN", "OI_QL_FIELD_WORKER_BIN"] {
        let path = PathBuf::from(std::env::var_os(name).expect(name));
        assert!(
            path.is_absolute() && path.is_file(),
            "{name} must select an actual built native executable"
        );
    }
    let input_path = PathBuf::from(
        std::env::var_os("NATIVE_EXPRESSION_INPUT").expect("explicit native input required"),
    );
    // Attribute the exact consumed bytes, rather than a later preflight read.
    let input_bytes = fs::read(&input_path).unwrap();
    let input_sha256 = format!("{:x}", Sha256::digest(&input_bytes));
    let input: Value = serde_json::from_slice(&input_bytes).unwrap();
    let scratch = Scratch(std::env::temp_dir().join(format!(
            "oi-native-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        )));
    fs::create_dir(&scratch.0).unwrap();
    let config = json!({"schema":"oi.native-expression-binding/v1",
      "host":{"instance_ref":"controlled:oi-native-test", "basis":input["basis"], "field":input["field"]},
      "presentation":{"units_per_metre":400,"slots_a":[0,0,0,0],"slots_b":[0,0,0,0]}});
    fs::write(
        scratch.0.join("binding.json"),
        serde_json::to_vec(&config).unwrap(),
    )
    .unwrap();
    let script = scratch.0.join("central-test-fixture.py");
    fs::write(&script,r#"#!/usr/bin/env python3
import json,pathlib,sys
root=pathlib.Path(__file__).parent
content=(root/'binding.json').read_text()
def location(path):return {'schema':'central.path-ref/v1','ref':'controlled:path:'+path,'root':'controlled:central-root','path':path}
action=sys.argv[-2]
if action=='central.files.list':
 data={'schema':'central.directory-reading/v1','location':location('.'),'entries':[{'name':'binding.json','location':location('binding.json'),'kind':'file','byte_len':len(content.encode()),'retrieval_allowed':True}],'automatic_agent_or_model_invocation':False}
elif action=='central.files.read':
 data={'schema':'central.file-reading/v1','location':location('binding.json'),'revision':'controlled:r1','byte_len':len(content.encode()),'content_encoding':'utf-8','content':content,'project':None,'source':None,'automatic_agent_or_model_invocation':False}
else:raise RuntimeError('Unexpected Central action '+action)
print(json.dumps({'ok':True,'data':data}))
"#).unwrap();
    fs::set_permissions(&script, fs::Permissions::from_mode(0o700)).unwrap();
    stub::settle_stub(&script);
    let client = CentralClient::with(script, Some(scratch.0.clone()), String::new());
    let mut manager = Manager::default();
    let open = || Request::Open {
        path: "binding.json".into(),
        expected_revision: "controlled:r1".into(),
    };
    assert!(manager
        .apply(
            &client,
            Request::Open {
                path: "binding.json".into(),
                expected_revision: "stale".into()
            }
        )
        .unwrap_err()
        .contains("source_stale"));
    let start = Instant::now();
    let opened = manager.apply(&client, open()).unwrap();
    let open_ms = start.elapsed().as_secs_f64() * 1000.;
    let lease = opened["lease"].as_str().unwrap().to_string();
    let mut last = opened["receipt"].clone();
    let original = state(&last);
    assert!(manager
        .apply(&client, open())
        .unwrap_err()
        .contains("owner_busy"));
    assert_eq!(opened["source"]["revision"], "controlled:r1");
    let inspected = exchange(
        &mut manager,
        &client,
        &lease,
        &mut last,
        json!({"operation":"inspect"}),
    );
    assert_eq!(state(&inspected), original);
    assert!(
        same_original_input_basis(&inspected["sources"]["original"]["input"], &input["basis"]),
        "complete native original input differs from its independently consumed basis: actual={:?}, expected={:?}",
        inspected["sources"]["original"]["input"], input["basis"]
    );
    for domain in ["m1", "m2", "m3"] {
        assert!(
            inspected["sources"]["current"][domain].is_object(),
            "complete {domain} output missing"
        );
    }
    let mut timings = Vec::new();
    for _ in 0..24 {
        let t = Instant::now();
        let r = exchange(
            &mut manager,
            &client,
            &lease,
            &mut last,
            json!({"operation":"read"}),
        );
        timings.push(t.elapsed().as_secs_f64() * 1000.);
        assert_eq!(state(&r), original);
    }
    let advanced = exchange(
        &mut manager,
        &client,
        &lease,
        &mut last,
        json!({"operation":"advance","frames":512,"muted":false}),
    );
    assert_eq!(advanced["status"], "ok");
    assert_eq!(advanced["field"]["audio"].as_array().unwrap().len(), 512);
    assert!(advanced["field"]["audio"]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v.as_f64().unwrap().abs() > 1e-7));
    assert_ne!(advanced["field"]["targets"], original["targets"]);
    let held = state(&advanced);
    for command in [
        json!({"operation":"advance","frames":8193,"muted":false}),
        json!({"operation":"set-axis","axis":2,"phase":{"turns":"0","half_degrees":10}}),
    ] {
        let refused = exchange(&mut manager, &client, &lease, &mut last, command);
        assert_eq!(refused["status"], "refused");
        assert_eq!(state(&refused), held);
        assert!(!refused["error"].is_null());
    }
    let changed = exchange(
        &mut manager,
        &client,
        &lease,
        &mut last,
        json!({"operation":"set-axis","axis":1,"phase":{"turns":"-2","half_degrees":37}}),
    );
    assert_eq!(changed["status"], "ok");
    assert_eq!(changed["field"]["clock"]["lensing"]["half_degrees"], 37);
    assert_eq!(
        changed["field"]["amplitudes_metres"],
        held["amplitudes_metres"]
    );
    assert_eq!(changed["field"]["samples_elapsed"], held["samples_elapsed"]);
    // Native producer recomputes M1, M2 and M3. Only that native output is used.
    let mut replacement = input["basis"].clone();
    replacement["m1"]["row12"] = json!((replacement["m1"]["row12"].as_u64().unwrap() + 1) % 12);
    replacement["m3"]["rna"] = json!(!replacement["m3"]["rna"].as_bool().unwrap());
    // Accepted native replacement requires a strictly newer M2 producer stamp;
    // changing M1/M3 while replaying the initial M2 generation is a refusal.
    // Keep that original negative case; then issue an explicitly new basis.
    let stale_replace = exchange(
        &mut manager,
        &client,
        &lease,
        &mut last,
        json!({"operation":"replace","basis":replacement}),
    );
    assert_eq!(stale_replace["status"], "refused");
    assert_eq!(state(&stale_replace), state(&changed));
    let next_generation = input["basis"]["m2"]["stamp"]["identity"]["profile_generation"]
        .as_u64()
        .unwrap()
        + 1;
    for component in ["resonator", "vimarsha", "m1_excitation"] {
        if !replacement["m2"][component].is_null() {
            replacement["m2"][component]["stamp"]["identity"]["profile_generation"] =
                json!(next_generation);
        }
    }
    replacement["m2"]["stamp"]["identity"]["profile_generation"] = json!(next_generation);
    replacement["m3"]["stamp"]["identity"]["profile_generation"] = json!(next_generation);
    replacement["m3"]["m2_basis"] = replacement["m2"]["stamp"].clone();
    let replaced = exchange(
        &mut manager,
        &client,
        &lease,
        &mut last,
        json!({"operation":"replace","basis":replacement}),
    );
    assert_eq!(replaced["status"], "ok", "{}", replaced["error"]);
    let new_sources = exchange(
        &mut manager,
        &client,
        &lease,
        &mut last,
        json!({"operation":"inspect"}),
    );
    assert_eq!(
        new_sources["sources"]["original"],
        inspected["sources"]["original"]
    );
    assert_ne!(
        new_sources["sources"]["current"]["m1"],
        inspected["sources"]["current"]["m1"]
    );
    assert_ne!(
        new_sources["sources"]["current"]["m3"]["transcription"]["rna"],
        inspected["sources"]["current"]["m3"]["transcription"]["rna"]
    );
    let rejected = manager
        .apply(
            &client,
            Request::Exchange {
                lease: "foreign".into(),
                request: packet(&last, json!({"operation":"read"})),
            },
        )
        .unwrap_err();
    assert!(rejected.contains("foreign_lease"));
    let before_close = state(&last);
    let start = Instant::now();
    manager
        .apply(
            &client,
            Request::Close {
                lease: lease.clone(),
            },
        )
        .unwrap();
    let close_ms = start.elapsed().as_secs_f64() * 1000.;
    assert!(manager
        .apply(
            &client,
            Request::Exchange {
                lease: lease.clone(),
                request: packet(&last, json!({"operation":"read"}))
            }
        )
        .unwrap_err()
        .contains("unavailable"));
    assert!(!std::env::temp_dir().join(format!("{lease}.json")).exists());
    let restarted = manager.apply(&client, open()).unwrap();
    assert_ne!(restarted["lease"], lease);
    assert_eq!(state(&restarted["receipt"]), original);
    assert_ne!(before_close["samples_elapsed"], original["samples_elapsed"]);
    manager
        .apply(
            &client,
            Request::Close {
                lease: restarted["lease"].as_str().unwrap().into(),
            },
        )
        .unwrap();
    timings.sort_by(f64::total_cmp);
    assert_eq!(
        format!("{:x}", Sha256::digest(fs::read(&input_path).unwrap())),
        input_sha256,
        "consumed native input changed during manager acceptance"
    );
    let report = json!({"schema":"oi.native-expression-native-acceptance/v1","pass":true,
        "standing":"real QL C/Rust/C++ through production process manager; controlled Central disclosure and captured sky/geometry inputs; not live ephemeris or measured acoustics",
        "input":input_path,"input_sha256":input_sha256,"platform":std::env::consts::OS,"open_ms":open_ms,"close_ms":close_ms,"read_samples":timings.len(),"read_p50_ms":timings[12],"read_p95_ms":timings[22],
        "same_source_original_preserved":true,"native_pcm_nonzero":true,"native_targets_changed":true,"native_m1_replace_effect":true,"native_m3_transcription_effect":true,"one_owner":true,"refusals_unchanged":true,"restart_not_rewind":true});
    println!("{report}");
    if let Some(path) = std::env::var_os("NATIVE_EXPRESSION_NATIVE_RECEIPT") {
        let path = Path::new(&path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, serde_json::to_vec_pretty(&report).unwrap()).unwrap();
    }
}
