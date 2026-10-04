//! Genuine saved-Scene counterproof through ordinary CAS, actual ActStore and
//! the existing private Manager/Root continuation. No imported native owner.
use super::{continued, document, enroll, scene};
use crate::expression::{Change, Document, Request as ExpressionRequest};
use crate::expression_performance::{CheckpointBinding, Performance};
use crate::native_expression::recording_channel::NativeSceneRecordingRequest;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

fn opened(original: &Document, scene_ref: &str, home: &Path) -> (crate::Kernel, String) {
    let mut kernel = crate::Kernel::new(crate::CentralClient::discover());
    kernel.attach_act_store(home).unwrap();
    let outcome = kernel
        .apply(crate::KernelOp::Expression {
            request: ExpressionRequest::Open {
                document: Box::new(original.clone()),
                actor: "agent:current-instrument-proof".into(),
            },
        })
        .unwrap();
    assert!(matches!(
        outcome.result,
        crate::KernelOpResult::Expression { .. }
    ));
    assert_eq!(document(&mut kernel, &original.expression_ref), *original);
    let input = crate::native_expression::selected_scene::Request {
        expression_ref: original.expression_ref.clone(),
        document_revision: original.revision,
        scene_ref: scene_ref.into(),
        scene_revision: scene(original, scene_ref).revision,
    };
    let operation = crate::KernelOp::NativeExpression {
        request: crate::native_expression::Request::OpenSelectedScene { request: input },
    };
    let prepared = kernel
        .prepare_native_selected_scene_open(&operation)
        .unwrap()
        .unwrap();
    let outcome = kernel
        .finish_native_selected_scene_open(prepared.execute().unwrap())
        .unwrap();
    let crate::KernelOpResult::NativeExpression { data } = outcome.result else {
        panic!("genuine selected current World opener absent")
    };
    assert_eq!(data["source_current"], true, "{data}");
    assert_eq!(document(&mut kernel, &original.expression_ref), *original);
    assert!(kernel.native_expression.recording_failure.is_none());
    (kernel, data["lease"].as_str().unwrap().to_owned())
}
fn close(kernel: &mut crate::Kernel, lease: String) {
    kernel
        .native_expression
        .apply(
            &crate::CentralClient::with("/nonexistent".into(), None, String::new()),
            crate::native_expression::Request::Close { lease },
        )
        .unwrap();
}
fn scale_forces(value: &mut Value, count: &mut usize) {
    match value {
        Value::Object(object) => {
            for (key, value) in object {
                if key == "force_newtons" {
                    match value {
                        Value::Array(cells) => {
                            assert_eq!(cells.len(), 512);
                            for cell in cells {
                                let original = cell.as_f64().expect("original finite force");
                                *cell = json!(original * 0.5);
                            }
                            *count += 1;
                        }
                        Value::Number(number) => {
                            let original = number.as_f64().unwrap();
                            assert!(original.is_finite());
                            *value = json!(original * 0.5);
                            *count += 1;
                        }
                        _ => panic!("actual native force field changed shape"),
                    }
                } else {
                    scale_forces(value, count);
                }
            }
        }
        Value::Array(values) => {
            for value in values {
                scale_forces(value, count);
            }
        }
        _ => {}
    }
}
fn change_constructor(value: &mut Value, count: &mut usize) {
    match value {
        Value::Object(object) => {
            if object.get("schema").and_then(Value::as_str)
                == Some("oi.native-document-scene-constructor/v1")
            {
                let digest = object.get_mut("initial_document_sha256").unwrap();
                let original = digest.as_str().unwrap();
                assert_eq!(original.len(), 64);
                let first = if original.starts_with('0') { "1" } else { "0" };
                *digest = json!(format!("{first}{}", &original[1..]));
                *count += 1;
            } else {
                for value in object.values_mut() {
                    change_constructor(value, count);
                }
            }
        }
        Value::Array(values) => {
            for value in values {
                change_constructor(value, count);
            }
        }
        _ => {}
    }
}
fn change_before_context(value: &mut Value, count: &mut usize) {
    match value {
        Value::Object(object) => {
            if let Some(before) = object.get_mut("before_source_assets") {
                let context = &before["receiving_source_inputs"]["return_context"];
                assert_eq!(context["kind"], "world");
                let original = context["receiver"]["revision"].as_str().unwrap().to_owned();
                let changed = format!("{original}:counterproof");
                replace_receiver_revision(before, &original, &changed, count);
            } else {
                for value in object.values_mut() {
                    change_before_context(value, count);
                }
            }
        }
        Value::Array(values) => {
            for value in values {
                change_before_context(value, count);
            }
        }
        _ => {}
    }
}
fn replace_receiver_revision(value: &mut Value, original: &str, changed: &str, count: &mut usize) {
    match value {
        Value::Object(object) => {
            if let Some(receiver) = object.get_mut("receiver").and_then(Value::as_object_mut) {
                if receiver.get("revision").and_then(Value::as_str) == Some(original) {
                    receiver.insert("revision".into(), json!(changed));
                    *count += 1;
                }
            }
            for value in object.values_mut() {
                replace_receiver_revision(value, original, changed, count);
            }
        }
        Value::Array(values) => {
            for value in values {
                replace_receiver_revision(value, original, changed, count);
            }
        }
        _ => {}
    }
}
fn changed_performance(original: &Performance, kind: &str) -> Performance {
    let mut wire = serde_json::to_value(original).unwrap();
    let mut count = 0;
    match kind {
        "force" => {
            assert!(
                original.pages.is_empty() && original.native_recordings.is_empty(),
                "force negative uses the actual pending programme, not forged callback pages"
            );
            scale_forces(&mut wire, &mut count);
        }
        "constructor" => change_constructor(&mut wire["native_sources"], &mut count),
        "before-context" => change_before_context(&mut wire["native_sources"], &mut count),
        "source-role" => {
            for asset in wire["native_sources"].as_array_mut().unwrap() {
                let role = &mut asset["native_bundle"]["consumer_roles"]["physical"];
                let original = role.as_str().unwrap().to_owned();
                *role = json!(format!("{original}:counterproof"));
                count += 1;
            }
        }
        _ => panic!("unowned source counterproof branch"),
    }
    assert!(count > 0, "actual original source branch missing: {kind}");
    // Native CP/programme copies are altered together for this negative. Their
    // internal typed custody remains valid; only genuine replay can qualify
    // the actual original gravity/current source/Scene constructor.
    let mut changed: Performance = serde_json::from_value(wire).unwrap();
    if kind == "force" {
        for checkpoint in &mut changed.checkpoints {
            *checkpoint = checkpoint.clone().seal().unwrap();
        }
    }
    let changed = changed
        .seal()
        .expect("negative must pass ordinary complete C structural custody");
    changed.validate().unwrap();
    assert_ne!(&changed, original);
    assert_eq!(changed.bases, original.bases);
    assert_eq!(changed.pitches, original.pitches);
    assert_eq!(changed.contact_definitions, original.contact_definitions);
    assert_eq!(changed.pages, original.pages);
    changed
}
fn keep(name: &str, value: &Value) {
    if let Some(directory) = std::env::var_os("OI_NATIVE_CURRENT_SCENE_CONTACT_ARTIFACT_DIRECTORY")
    {
        let directory = PathBuf::from(directory);
        std::fs::create_dir_all(&directory).unwrap();
        std::fs::write(directory.join(name), serde_json::to_vec(value).unwrap()).unwrap();
    }
}
fn genuine_refusal(
    original: &Document,
    scene_ref: &str,
    home: &Path,
    cut: &CheckpointBinding,
    kind: &str,
) {
    let (mut kernel, lease) = opened(original, scene_ref, home);
    let pid = kernel.native_expression.active.as_ref().unwrap().child.id();
    let before_id = kernel
        .native_expression
        .active
        .as_ref()
        .unwrap()
        .last_request_id;
    let original_performance = scene(original, scene_ref).performance.as_ref().unwrap();
    let changed = changed_performance(original_performance, kind);
    let outcome = kernel
        .apply(crate::KernelOp::Expression {
            request: ExpressionRequest::Edit {
                expression_ref: original.expression_ref.clone(),
                expected_revision: original.revision,
                actor: "agent:current-instrument-proof".into(),
                changes: vec![Change::ScenePerformanceSet {
                    scene_ref: scene_ref.into(),
                    performance: changed.clone(),
                }],
            },
        })
        .unwrap();
    assert!(matches!(
        outcome.result,
        crate::KernelOpResult::Expression { .. }
    ));
    let saved = document(&mut kernel, &original.expression_ref);
    assert_eq!(saved.revision, original.revision + 1);
    assert_eq!(
        scene(&saved, scene_ref).revision,
        scene(original, scene_ref).revision + 1
    );
    assert_eq!(
        scene(&saved, scene_ref).presentation,
        scene(original, scene_ref).presentation
    );
    assert_eq!(
        scene(&saved, scene_ref).performance.as_ref().unwrap(),
        &changed
    );
    assert_eq!(
        kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .last_request_id,
        before_id
    );
    let file = crate::expression_file::encode(&saved).unwrap();
    assert_eq!(crate::expression_file::decode(&file).unwrap(), saved);
    let act_ref = format!("act:current-scene/contact-counterproof-{kind}");
    let selection = enroll(&mut kernel, &saved, scene_ref, &act_ref);
    let checkpoint_index = changed
        .checkpoints
        .iter()
        .position(|cp| cp.checkpoint_ref == cut.checkpoint_ref)
        .unwrap();
    let request_id = kernel
        .native_expression
        .active
        .as_ref()
        .unwrap()
        .last_request_id
        + 1;
    let request = NativeSceneRecordingRequest::ContinueAct {
        request_id: request_id.to_string(),
        lease: lease.clone(),
        expression_ref: saved.expression_ref.clone(),
        document_revision: saved.revision,
        scene_ref: scene_ref.into(),
        scene_revision: scene(&saved, scene_ref).revision,
        actor: "agent:current-instrument-proof".into(),
        act_ref,
        selection,
        checkpoint_index,
        transaction_ref: format!("transaction:current-native/contact-counterproof-{kind}"),
    };
    let request_wire = serde_json::to_value(&request).unwrap();
    let outcome = kernel
        .apply(crate::KernelOp::NativePerformanceRecording {
            request: request.clone(),
        })
        .unwrap();
    let crate::KernelOpResult::NativeExpression { data: refused } = outcome.result else {
        panic!("actual full native Continue refusal absent")
    };
    assert_eq!(refused["accepted"], false, "{kind}: {refused}");
    assert_eq!(
        refused["delivery_attempted"], true,
        "must reach the genuine private native owner"
    );
    assert_eq!(
        refused["native_reply"]["schema"],
        "ql.native-act-owner-result/v1"
    );
    assert_eq!(
        refused["native_reply"]["request_id"],
        request_id.to_string()
    );
    assert_ne!(refused["native_reply"]["result"]["readmitted"], true);
    assert!(kernel.native_expression.recording_failure.is_some());
    assert_eq!(
        kernel.native_recording_failure_reply(),
        Some(&refused["native_reply"])
    );
    assert_eq!(document(&mut kernel, &saved.expression_ref), saved);
    assert_eq!(
        kernel.native_expression.active.as_ref().unwrap().child.id(),
        pid
    );
    let actual_id = kernel
        .native_expression
        .active
        .as_ref()
        .unwrap()
        .last_request_id;
    // Retain full actual originals, including any partial diagnostics, before
    // closing this exact held owner. Unknown/failed operations are not retried.
    let diagnostics = refused["diagnostics"]["receipts"].as_array().unwrap();
    for receipt in diagnostics {
        let ordinal = receipt["descriptor"]["receipt_ordinal"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap();
        let mut bytes = Vec::new();
        kernel
            .write_native_recording_failure_diagnostic(ordinal, &mut bytes)
            .unwrap();
        if let Some(directory) =
            std::env::var_os("OI_NATIVE_CURRENT_SCENE_CONTACT_ARTIFACT_DIRECTORY")
        {
            std::fs::write(
                PathBuf::from(directory).join(format!(
                    "contact-counterproof-{kind}-original-{ordinal}.json"
                )),
                bytes,
            )
            .unwrap();
        }
    }
    let duplicate = kernel.apply(crate::KernelOp::NativePerformanceRecording { request });
    if let Ok(outcome) = duplicate {
        let crate::KernelOpResult::NativeExpression { data } = outcome.result else {
            panic!("held replay changed family")
        };
        assert_eq!(data["accepted"], false);
        assert_eq!(data["delivery_attempted"], false);
    }
    assert_eq!(
        kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .last_request_id,
        actual_id
    );
    assert_eq!(document(&mut kernel, &saved.expression_ref), saved);
    assert_eq!(
        kernel.native_recording_failure_reply(),
        Some(&refused["native_reply"])
    );
    keep(
        &format!("contact-counterproof-{kind}.json"),
        &json!({"original_document":original,"changed_saved_document":saved,
            "original_authored_request":request_wire,"original_native_result":refused}),
    );
    close(&mut kernel, lease);
}
fn genuine_original_replay(
    original: &Document,
    scene_ref: &str,
    home: &Path,
    cut: &CheckpointBinding,
    label: &str,
) {
    let (mut kernel, lease) = opened(original, scene_ref, home);
    let act = format!("act:current-scene/contact-original-replay-{label}");
    let selected = enroll(&mut kernel, original, scene_ref, &act);
    let (after, result) = continued(
        &mut kernel,
        original,
        scene_ref,
        &lease,
        &act,
        selected,
        cut,
        label,
    );
    keep(
        &format!("contact-original-replay-{label}.json"),
        &json!({"document":after,"original_result":result}),
    );
    close(&mut kernel, lease);
}
pub(crate) fn actual_closed_source_counterproof(
    pending_document: &Document,
    active_document: &Document,
    scene_ref: &str,
    home: &Path,
    pending: &CheckpointBinding,
    active: &CheckpointBinding,
) {
    for kind in ["force", "constructor", "before-context", "source-role"] {
        genuine_refusal(pending_document, scene_ref, home, pending, kind);
        // Both positives replay all original performed pages from the active
        // saved Edition with independent genuine native owners after EACH loss.
        for (cut_name, cut) in [("pending", pending), ("active", active)] {
            genuine_original_replay(
                active_document,
                scene_ref,
                home,
                cut,
                &format!("after-{kind}-{cut_name}"),
            );
        }
    }
}
