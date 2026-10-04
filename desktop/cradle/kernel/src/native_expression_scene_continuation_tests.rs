//! Extends the genuine current-Scene Contact driver. No fixture mints a lease.
use super::super::recording_channel::NativeSceneRecordingRequest;
use crate::expression::{Change, Document, Request as ExpressionRequest};
use crate::expression_performance::CheckpointBinding;
use crate::expression_performance_delivery::Selection;
use serde_json::{Value, json};
use std::path::Path;
// Mutate an actually produced operand, never a manufactured positive receipt.
fn change_first_native_number(value: &mut Value, mode: &str) -> bool {
    match value {
        Value::Number(number) => {
            if number.is_f64() {
                let n = number.as_f64().expect("native finite float");
                if mode == "zero_sign" && n == 0.0 {
                    *value = json!(-n);
                    return true;
                }
                if mode == "float_to_integer" && n >= 0.0 && n.fract() == 0.0 && n < u64::MAX as f64
                {
                    *value = json!(n as u64);
                    return true;
                }
            } else if mode == "integer_to_float" {
                if let Some(n) = number.as_u64().filter(|n| *n < (1u64 << 53)) {
                    *value = json!(n as f64);
                    return true;
                }
            }
            false
        }
        Value::Object(object) => object
            .values_mut()
            .any(|v| change_first_native_number(v, mode)),
        Value::Array(array) => array
            .iter_mut()
            .any(|v| change_first_native_number(v, mode)),
        _ => false,
    }
}
fn require_original_native_number_kinds(
    original: &crate::expression_performance_source_readoption::RetainedNativeSourceReadoption,
    proof: &crate::expression_performance_reservation::NativeReservationContinuation,
    performance: &crate::expression_performance::Performance,
) {
    original.validate(performance, proof).unwrap();
    for mode in ["zero_sign", "float_to_integer", "integer_to_float"] {
        let mut changed = serde_json::to_value(original).unwrap();
        assert!(
            change_first_native_number(&mut changed["before_source"]["native_preparation"], mode),
            "genuine native preparation lacks detecting operand for {mode}"
        );
        let changed: crate::expression_performance_source_readoption::RetainedNativeSourceReadoption =
            serde_json::from_value(changed).unwrap();
        assert!(changed.validate(performance, proof).is_err(), "{mode}");
        original.validate(performance, proof).unwrap();
    }
}

fn document(k: &mut crate::Kernel, r: &str) -> Document {
    let o = k
        .apply(crate::KernelOp::Expression {
            request: ExpressionRequest::Inspect {
                expression_ref: r.into(),
            },
        })
        .unwrap();
    let crate::KernelOpResult::Expression { data } = o.result else {
        panic!("native Document result absent")
    };
    serde_json::from_value(data["document"].clone()).unwrap()
}
fn scene<'a>(d: &'a Document, r: &str) -> &'a crate::expression::Scene {
    d.scenes.iter().find(|s| s.scene_ref == r).unwrap()
}
fn enroll(k: &mut crate::Kernel, d: &Document, s: &str, a: &str) -> Selection {
    let p = scene(d, s).performance.as_ref().unwrap();
    let o = k
        .expression_world(crate::expression_world::Request::ActRetainedPerform {
            act_ref: a.into(),
            expression_ref: d.expression_ref.clone(),
            expected_revision: d.revision,
            expected_act_revision: None,
            summary: "Actual Contact checkpoint and original full source".into(),
            actor: "agent:current-instrument-proof".into(),
            activity_ref: None,
            changes: vec![Change::ScenePerformanceSet {
                scene_ref: s.into(),
                performance: p.clone(),
            }],
        })
        .unwrap();
    let crate::KernelOpResult::ExpressionWorld { data } = o.result else {
        panic!("native Act absent")
    };
    assert_eq!(data["state"], "act_running");
    assert_eq!(document(k, &d.expression_ref), *d);
    let o = k
        .expression_world(crate::expression_world::Request::ActInterrupt {
            act_ref: a.into(),
            actor: "agent:current-instrument-proof".into(),
            reason: Some("Hold exact native saved edition".into()),
        })
        .unwrap();
    let crate::KernelOpResult::ExpressionWorld { data } = o.result else {
        panic!("native Act hold absent")
    };
    assert_eq!(data["state"], "act_held");
    Selection {
        expected_act_revision: data["act"]["revision"].as_u64().unwrap(),
        edition_position: 0,
        scene_ref: s.into(),
        expected_expression_revision: d.revision,
        expected_scene_revision: scene(d, s).revision,
        performance_digest: p.fingerprint().unwrap(),
    }
}
fn continued(
    k: &mut crate::Kernel,
    d: &Document,
    s: &str,
    l: &str,
    a: &str,
    selected: Selection,
    cut: &CheckpointBinding,
    label: &str,
) -> (Document, Value) {
    let p = scene(d, s).performance.as_ref().unwrap();
    let index = p.checkpoints.iter().position(|c| c == cut).unwrap();
    let id = k.native_expression.active.as_ref().unwrap().last_request_id + 1;
    let pid = k.native_expression.active.as_ref().unwrap().child.id();
    let original_bytes: Vec<_> = p
        .native_recordings
        .iter()
        .map(|page| page.canonical_decoded_bytes().unwrap())
        .collect();
    let intent = NativeSceneRecordingRequest::ContinueAct {
        request_id: id.to_string(),
        lease: l.into(),
        expression_ref: d.expression_ref.clone(),
        document_revision: d.revision,
        scene_ref: s.into(),
        scene_revision: scene(d, s).revision,
        actor: "agent:current-instrument-proof".into(),
        act_ref: a.into(),
        selection: selected.clone(),
        checkpoint_index: index,
        transaction_ref: format!("transaction:current-native/contact-{label}"),
    };
    let o = k
        .expression_world(crate::expression_world::Request::ActRetainedDelivery {
            act_ref: a.into(),
            selection: selected.clone(),
            native_page: None,
        })
        .unwrap();
    let crate::KernelOpResult::ExpressionWorld { data: manifest } = o.result else {
        panic!("full native manifest absent")
    };
    let mut shortened = manifest.clone();
    shortened["performance"]["checkpoints"]
        .as_array_mut()
        .unwrap()
        .remove(0);
    let canonical = serde_json::to_string(&shortened["performance"]).unwrap();
    shortened["selected_performance_sha256"] =
        json!(crate::expression_file::digest(canonical.as_bytes()));
    shortened["canonical_performance_bytes"] = json!(canonical);
    k.with_native_act_delivery(a, &selected, |reader| {
        reader.require_exact_manifest(&manifest)?;
        assert!(reader.require_exact_manifest(&shortened).is_err());
        Ok(())
    })
    .unwrap();
    let mut stale = serde_json::to_value(&intent).unwrap();
    stale["document_revision"] = json!(d.revision + 1);
    let o = k
        .apply(crate::KernelOp::NativePerformanceRecording {
            request: serde_json::from_value(stale).unwrap(),
        })
        .unwrap();
    let crate::KernelOpResult::NativeExpression { data: stale } = o.result else {
        panic!("stale native Continue absent")
    };
    assert_eq!(stale["accepted"], false);
    assert_eq!(stale["delivery_attempted"], false);
    assert!(stale["native_reply"].is_null());
    assert_eq!(
        k.native_expression.active.as_ref().unwrap().last_request_id,
        id - 1
    );
    assert_eq!(document(k, &d.expression_ref), *d);
    assert!(k.native_expression.recording_failure.is_none());
    let mut o = k
        .apply(crate::KernelOp::NativePerformanceRecording { request: intent })
        .unwrap();
    k.finish_native_recording_cut_return(
        &mut o,
        Ok(std::env::var_os("OI_RETAINED_PERFORMANCE_TEST_HOME")
            .map(std::path::PathBuf::from)
            .expect("native continuation return home")
            .join("contact-continuation-originals")),
    );
    let crate::KernelOpResult::NativeExpression { data } = o.result else {
        panic!("normal native Continue absent")
    };
    assert_eq!(data["accepted"], true, "{data}");
    assert_eq!(data["currentness"], json!({"Ok":null}));
    assert_eq!(
        data["native_reply"]["result"]["host_receipt"]["request_id"],
        id.to_string()
    );
    assert_eq!(
        data["native_reply"]["result"]["host_receipt"]["last_request_id"],
        id.to_string()
    );
    assert_eq!(k.native_expression.active.as_ref().unwrap().child.id(), pid);
    let after = document(k, &d.expression_ref);
    let restored = scene(&after, s).performance.as_ref().unwrap();
    restored.validate().unwrap();
    assert_eq!(restored.checkpoints, p.checkpoints);
    assert_eq!(restored.bases, p.bases);
    assert_eq!(restored.native_sources, p.native_sources);
    assert_eq!(restored.pages, p.pages);
    for (page, bytes) in restored.native_recordings.iter().zip(original_bytes) {
        assert_eq!(page.canonical_decoded_bytes().unwrap(), bytes);
    }
    let proof = restored
        .native_recordings
        .last()
        .unwrap()
        .continuation()
        .unwrap()
        .unwrap();
    proof.validate(restored).unwrap();
    let historical = proof
        .receiving_readmission()
        .map_or(&proof.saved, |r| r.original_checkpoint());
    assert_eq!(historical.audio, cut.audio);
    assert_eq!(historical.physical, cut.physical);
    assert_eq!(proof.saved.sample, cut.sample);
    assert_eq!(
        proof.saved.unscored_queued_inputs,
        cut.unscored_queued_inputs
    );
    assert_eq!(
        proof.after.unscored_queued_inputs,
        cut.unscored_queued_inputs
    );
    assert_eq!(proof.after.sample, cut.sample);
    assert_eq!(
        proof.transport_ack.epoch.0,
        proof.transport_ack.previous_epoch.0 + 1
    );
    assert_eq!(proof.transport_ack.target_sample, cut.sample);
    assert!(proof.restored_applications.is_empty());
    assert!(proof.restored_input_history.is_empty());
    assert_eq!(
        proof.post_observer_stream().unwrap(),
        crate::expression_performance_reservation::native_observer_stream(
            &proof.after.native_management_wire().unwrap()
        )
        .unwrap()
    );
    let contacts =
        crate::expression_performance_native_contact::checkpoint_contacts(&proof.after.audio)
            .unwrap();
    assert_eq!(
        contacts,
        crate::expression_performance_native_contact::checkpoint_contacts(&cut.audio).unwrap()
    );
    if contacts.is_some() {
        for loss in ["force", "highwater"] {
            let mut changed = proof.clone();
            if loss == "force" {
                let original_force = changed.after.audio["contacts"]["slots"][0]["force_newtons"]
                    [0]
                .as_f64()
                .expect("actual native contact force");
                changed.after.audio["contacts"]["slots"][0]["force_newtons"][0] =
                    json!(if original_force == 0.0 { 1.0 } else { 0.0 });
            } else {
                changed.after.audio["contacts"]["original_request_high_water"] = json!("0")
            }
            assert!(changed.validate(restored).is_err(), "{loss}");
        }
    }
    proof.validate(restored).unwrap();
    let mut duplicate_ack = restored.clone();
    duplicate_ack
        .native_recordings
        .push(restored.native_recordings.last().unwrap().clone());
    assert!(
        duplicate_ack.seal().is_err(),
        "same genuine ACK cannot be replayed as another page"
    );
    assert_eq!(
        crate::expression_file::decode(&crate::expression_file::encode(&after).unwrap()).unwrap(),
        after
    );
    let evidence = &data["native_reply"]["result"]["native_contact_checkpoint_evidence"];
    if contacts.is_some() {
        assert_eq!(
            evidence["schema"], "ql.native-scene-contact-checkpoint-evidence/v1",
            "{data}"
        );
        assert!(evidence["original_request"].is_object());
        assert!(evidence["original_reply"].is_object());
        assert_eq!(evidence["original_reply"]["accepted"], true);
    } else {
        assert!(evidence.is_null());
    }
    if let Some(original) = proof.source_readoption() {
        require_original_native_number_kinds(original, &proof, restored);
        let files = &data["original_continuation_files"];
        assert_eq!(files["available"], true);
        assert_eq!(files["files"].as_array().unwrap().len(), 2);
        let file = &files["files"][0];
        assert_eq!(file["descriptor"]["kind"], "before_restoration_receipt");
        let receipt: Value = serde_json::from_slice(
            &std::fs::read(
                std::path::PathBuf::from(files["directory"].as_str().unwrap())
                    .join(file["file"].as_str().unwrap()),
            )
            .unwrap(),
        )
        .unwrap();
        assert_eq!(&receipt, original.original_before_restoration_receipt());
        assert_eq!(receipt["reading"], original.before_source()["reading"]);
        let request_file = &files["files"][1];
        assert_eq!(
            request_file["descriptor"]["kind"],
            "source_readoption_original_request"
        );
        assert_eq!(request_file["descriptor"]["original_index"], "1");
        let request: Value = serde_json::from_slice(
            &std::fs::read(
                std::path::PathBuf::from(files["directory"].as_str().unwrap())
                    .join(request_file["file"].as_str().unwrap()),
            )
            .unwrap(),
        )
        .unwrap();
        super::super::act_readmission::qualify_original_source_request(
            &request,
            original.before_source(),
            &data["native_reply"]["result"]["native_source_readoption"],
            &serde_json::to_string(&cut.native_management_wire().unwrap()).unwrap(),
            &cut.checkpoint_ref,
            &format!("transaction:current-native/contact-{label}"),
        )
        .unwrap();
        for mode in ["zero_sign", "float_to_integer", "integer_to_float"] {
            let mut changed = request.clone();
            assert!(
                change_first_native_number(&mut changed["before_source_packet"], mode),
                "actual original request lacks detecting {mode} operand"
            );
            assert!(
                super::super::act_readmission::qualify_original_source_request(
                    &changed,
                    original.before_source(),
                    &data["native_reply"]["result"]["native_source_readoption"],
                    &serde_json::to_string(&cut.native_management_wire().unwrap()).unwrap(),
                    &cut.checkpoint_ref,
                    &format!("transaction:current-native/contact-{label}"),
                )
                .is_err(),
                "{mode}"
            );
            super::super::act_readmission::qualify_original_source_request(
                &request,
                original.before_source(),
                &data["native_reply"]["result"]["native_source_readoption"],
                &serde_json::to_string(&cut.native_management_wire().unwrap()).unwrap(),
                &cut.checkpoint_ref,
                &format!("transaction:current-native/contact-{label}"),
            )
            .unwrap();
        }
        // These negatives use the actually transmitted request from the native
        // PrivateFile, and recheck the full unchanged original after each loss.
        for field in [
            "original_checkpoint_wire",
            "before_source_packet",
            "before_native_basis",
            "current_source_packet",
            "actual_native_basis",
            "current_receiving",
            "session_ref",
            "transport_epoch",
        ] {
            let mut changed = request.clone();
            changed[field] = json!(null);
            assert!(
                super::super::act_readmission::qualify_original_source_request(
                    &changed,
                    original.before_source(),
                    &data["native_reply"]["result"]["native_source_readoption"],
                    &serde_json::to_string(&cut.native_management_wire().unwrap()).unwrap(),
                    &cut.checkpoint_ref,
                    &format!("transaction:current-native/contact-{label}"),
                )
                .is_err(),
                "{field}"
            );
            super::super::act_readmission::qualify_original_source_request(
                &request,
                original.before_source(),
                &data["native_reply"]["result"]["native_source_readoption"],
                &serde_json::to_string(&cut.native_management_wire().unwrap()).unwrap(),
                &cut.checkpoint_ref,
                &format!("transaction:current-native/contact-{label}"),
            )
            .unwrap();
        }
        assert_eq!(
            data["native_reply"]["result"]["native_source_readoption_before_source"],
            *original.before_source()
        );
        assert!(k.native_recording_cut_reply().is_none());
    }
    crate::expression_performance_readmission::qualify_retained_source_projection(
        restored,
        cut,
        &data["native_reply"]["result"]["retained_source_selection"],
        s,
    )
    .unwrap();
    (after, data)
}
pub(crate) fn actual_pending_active_continuation_trial(
    k: &mut crate::Kernel,
    d: &Document,
    s: &str,
    l: &str,
    home: &Path,
    pending: &CheckpointBinding,
    active: &CheckpointBinding,
) {
    let selection = enroll(k, d, s, "act:current-scene/contact-warm-active");
    let (warm_active_doc, warm_active) = continued(
        k,
        d,
        s,
        l,
        "act:current-scene/contact-warm-active",
        selection,
        active,
        "warm-active",
    );
    let selection = enroll(
        k,
        &warm_active_doc,
        s,
        "act:current-scene/contact-warm-pending",
    );
    let (warm_pending_doc, warm_pending) = continued(
        k,
        &warm_active_doc,
        s,
        l,
        "act:current-scene/contact-warm-pending",
        selection,
        pending,
        "warm-pending",
    );
    assert_eq!(
        scene(&warm_pending_doc, s)
            .performance
            .as_ref()
            .unwrap()
            .checkpoints,
        scene(d, s).performance.as_ref().unwrap().checkpoints
    );
    let before_contact = scene(d, s)
        .performance
        .as_ref()
        .unwrap()
        .checkpoints
        .iter()
        .find(|c| {
            c.audio["schema"] == "ql.performance-checkpoint/v2"
                && c.unscored_queued_inputs.len() == 1
                && c.unscored_queued_inputs[0].operation()["kind"] == 5
        })
        .unwrap();
    let selection = enroll(
        k,
        &warm_pending_doc,
        s,
        "act:current-scene/contact-warm-original-prefix",
    );
    let (_, warm_prefix) = continued(
        k,
        &warm_pending_doc,
        s,
        l,
        "act:current-scene/contact-warm-original-prefix",
        selection,
        before_contact,
        "warm-original-prefix",
    );
    assert!(
        warm_prefix["native_reply"]["result"]["native_source_readoption"].is_object(),
        "{warm_prefix}"
    );
    assert_eq!(
        warm_prefix["original_continuation_files"]["available"],
        true
    );
    let mut trials = Vec::new();
    for (label, cut) in [("pending", pending), ("active", active)] {
        let mut cold = crate::Kernel::new(crate::CentralClient::discover());
        cold.attach_act_store(home).unwrap();
        let o = cold
            .apply(crate::KernelOp::Expression {
                request: ExpressionRequest::Open {
                    document: Box::new(d.clone()),
                    actor: "agent:current-instrument-proof".into(),
                },
            })
            .unwrap();
        assert!(matches!(o.result, crate::KernelOpResult::Expression { .. }));
        let before = document(&mut cold, &d.expression_ref);
        assert_eq!(before, *d);
        let selected = super::super::selected_scene::Request {
            expression_ref: before.expression_ref.clone(),
            document_revision: before.revision,
            scene_ref: s.into(),
            scene_revision: scene(&before, s).revision,
        };
        let op = crate::KernelOp::NativeExpression {
            request: super::super::Request::OpenSelectedScene { request: selected },
        };
        let prepared = cold
            .prepare_native_selected_scene_open(&op)
            .unwrap()
            .unwrap();
        let opened = cold
            .finish_native_selected_scene_open(prepared.execute().unwrap())
            .unwrap();
        let crate::KernelOpResult::NativeExpression { data: opened } = opened.result else {
            panic!("cold selected World opener absent")
        };
        assert_eq!(opened["source_current"], true, "{opened}");
        assert_eq!(document(&mut cold, &before.expression_ref), before);
        assert_eq!(
            opened["source"]["constructor_request_bytes"],
            scene(&before, s).presentation.as_ref().unwrap().scene["epiWorld"]["native_source"]["constructor_request_bytes"]
        );
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let act = format!("act:current-scene/contact-cold-{label}");
        let selection = enroll(&mut cold, &before, s, &act);
        let (after, result) = continued(
            &mut cold,
            &before,
            s,
            &lease,
            &act,
            selection,
            cut,
            &format!("cold-{label}"),
        );
        let evidence = &result["native_reply"]["result"]["native_contact_checkpoint_evidence"];
        trials.push(json!({"cut":label,"original_request":evidence["original_request"],"original_reply":evidence["original_reply"]}));
        if let Ok(dir) = std::env::var("OI_NATIVE_CURRENT_SCENE_CONTACT_ARTIFACT_DIRECTORY") {
            let dir = std::path::PathBuf::from(dir);
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(
                dir.join(format!("contact-cold-{label}-result.json")),
                serde_json::to_vec(&result).unwrap(),
            )
            .unwrap();
            std::fs::write(
                dir.join(format!("contact-cold-{label}.expression.json")),
                crate::expression_file::encode(&after).unwrap(),
            )
            .unwrap();
        }
        cold.native_expression
            .apply(
                &crate::CentralClient::with("/nonexistent".into(), None, String::new()),
                super::super::Request::Close { lease },
            )
            .unwrap();
    }
    if let Ok(path) = std::env::var("QL_NATIVE_CONTACT_REPLAY_ARTIFACT") {
        std::fs::write(
            path,
            serde_json::to_vec(
                &json!({"schema":"ql.actual-native-contact-cold-replay/v1","trials":trials}),
            )
            .unwrap(),
        )
        .unwrap();
    }
    if let Ok(dir) = std::env::var("OI_NATIVE_CURRENT_SCENE_CONTACT_ARTIFACT_DIRECTORY") {
        std::fs::write(std::path::PathBuf::from(dir).join("contact-warm-continuation-results.json"),
            serde_json::to_vec(&json!([{"cut":"active","result":warm_active},{"cut":"pending","result":warm_pending},{"cut":"before-contact","result":warm_prefix}])).unwrap()).unwrap();
    }
}

#[path = "native_expression_scene_contact_source_acceptance.rs"]
pub(crate) mod source_acceptance;
