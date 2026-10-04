//! Actual native source/Manager artifacts are mandatory. These tests exercise
//! the data compiler and ordinary native recording/page owner; they do not
//! manufacture the private OS/image-qualified channel or Scene authority.
use super::*;
use crate::expression_performance::*;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::path::PathBuf;

fn read(path: impl AsRef<std::path::Path>) -> Value {
    let bytes = std::fs::read(path).expect("mandatory actual native producer artifact");
    assert!(bytes.len() <= 32 * 1024 * 1024);
    serde_json::from_slice(&bytes).unwrap()
}
fn artifacts() -> PathBuf {
    PathBuf::from(
        std::env::var("QL_RETAINED_PERFORMANCE_MANAGED_ORDER_DIRECTORY")
            .expect("mandatory same-source native journal-tail producer directory"),
    )
}
fn checkpoint(basis: &PerformanceBasis, name: &str) -> CheckpointBinding {
    let wire = read(artifacts().join(name));
    let sample = counter(&wire["native_pair"]["audio"]["cursor"]).unwrap();
    CheckpointBinding::from_native_management(
        CheckpointReceipt {
            checkpoint_ref: format!("native:journal-tail/{name}"),
            identity: basis.identity.clone(),
            sample,
            basis_digest: basis.content_digest.clone(),
            // This test Performance has an empty authored event prefix at
            // construction. Retain the independent native source schedule in
            // `wire` rather than using it as an authored score fingerprint.
            event_prefix_digest: crate::expression_file::digest(
                &serde_json::to_vec(&Vec::<TimedEvent>::new()).unwrap(),
            ),
            queued_events: vec![],
            acknowledged_stopped: true,
        },
        wire,
    )
    .unwrap()
}
fn original() -> (Performance, CheckpointBinding, Value, Value) {
    let source = read(
        std::env::var("QL_RETAINED_PERFORMANCE_FIXTURE")
            .expect("mandatory original native Return/basis/pitches producer"),
    );
    let basis = serde_json::from_value::<PerformanceBasis>(source["basis"].clone())
        .unwrap()
        .seal()
        .unwrap();
    let origin = checkpoint(&basis, "journal-tail.origin-checkpoint.json");
    let after = checkpoint(&basis, "journal-tail.checkpoint.json");
    assert_eq!(origin.sample, Counter(0));
    assert_eq!(
        counter(&origin.audio["applied_application_ordinal"]).unwrap(),
        Counter(0)
    );
    assert_eq!(
        origin
            .management
            .as_ref()
            .unwrap()
            .input_history
            .last_ordinal,
        Counter(0)
    );
    assert_eq!(after.sample, Counter(256));
    assert_eq!(
        counter(&after.audio["applied_application_ordinal"]).unwrap(),
        Counter(2)
    );
    assert_eq!(
        after
            .management
            .as_ref()
            .unwrap()
            .input_history
            .last_ordinal,
        Counter(4)
    );
    let p = Performance {
        schema: SCHEMA.into(),
        performance_ref: "performance:native-recording-uptake".into(),
        sample_rate: 48000,
        duration_samples: Counter(43200000),
        ppq: 960,
        bases: vec![basis],
        pitches: serde_json::from_value(source["pitches"].clone()).unwrap(),
        layers: vec![Layer {
            layer_ref: "layer:native-recording".into(),
            title: "Performed".into(),
            enabled: true,
            solo: false,
        }],
        pages: vec![],
        parameters: vec![],
        routes: vec![],
        tempo: vec![TempoSegment {
            at_sample: Counter(0),
            at_tick: Counter(0),
            micros_per_quarter: 500000,
        }],
        loop_range: None,
        position_sample: Counter(0),
        replay: ReplayPolicy {
            mode: ReplayMode::NativeCheckpoint,
            max_reconstruction_samples: Counter(48000),
            model_revision: "ql.performance-audio/v1".into(),
            event_tolerance_samples: 0,
            physical_tolerance: Scalar::new(0.0).unwrap(),
            display_policy: "same-native-cursor".into(),
        },
        checkpoints: vec![],
        native_sources: vec![],
        native_recordings: vec![],
        native_reservations: vec![],
        contact_definitions: vec![],
        content_digest: String::new(),
    }
    .seal()
    .unwrap()
    .edited(vec![PerformanceOperation::Checkpoint {
        checkpoint: Box::new(origin),
    }])
    .unwrap();
    (
        p,
        after,
        read(artifacts().join("journal-tail.complete.json")),
        read(artifacts().join("journal-tail.empty.json")),
    )
}
fn intent() -> RecordingIntent {
    RecordingIntent {
        actor: "human:native-journal-recording".into(),
        basis: 0,
        layer: 0,
    }
}
fn compile(
    p: &Performance,
    after: &CheckpointBinding,
    batch: &Value,
) -> Result<Option<Box<PreparedRecording>>, String> {
    let state = NativeRecordState::from_checkpoint(&p.bases[0], after)?;
    compile_original_batch(
        p,
        &intent(),
        OriginalNativeBatch {
            state: &state,
            epoch: after
                .management
                .as_ref()
                .ok_or("native management absent")?
                .transport_epoch,
            cursor: after.sample,
            applied_high_water: counter(&after.audio["applied_application_ordinal"])?,
            input_high_water: &batch["last_input_ordinal"],
            applications: batch["applications"]
                .as_array()
                .ok_or("actual applications absent")?,
            input_journal: &batch["input_history"],
        },
    )
}
#[test]
fn actual_complete_pulse_records_original_attack_release_then_empty_is_observation() {
    let (p, after, complete, empty) = original();
    let recorded = compile(&p, &after, &complete).unwrap().unwrap();
    assert_eq!(recorded.receipts().len(), 2);
    assert_eq!(recorded.input_journal().len(), 4);
    assert_eq!(recorded.applied_application_ordinal(), Counter(2));
    assert_eq!(
        recorded.receipts()[0].application.requested_sample,
        Some(Counter(37))
    );
    assert_eq!(
        recorded.receipts()[1].application.requested_sample,
        Some(Counter(128))
    );
    for receipt in recorded.receipts() {
        assert_eq!(
            receipt.original_input.as_ref().unwrap().input_ref,
            "native-score:journal-tail/original-input"
        );
        assert!(receipt.performed_event.is_some());
    }
    let next = p.edited(recorded.record_operations()).unwrap();
    assert_eq!(&next, recorded.prospective());
    let reopened: Performance =
        serde_json::from_slice(&serde_json::to_vec(&next).unwrap()).unwrap();
    reopened.validate().unwrap();
    assert_eq!(reopened, next);
    assert_eq!(reopened.bases, p.bases);
    assert_eq!(reopened.native_recordings.len(), 1);
    assert_eq!(
        reopened.native_recordings[0]
            .batch()
            .unwrap()
            .entries()
            .len(),
        2
    );
    assert_eq!(
        reopened.native_recordings[0]
            .recording_stream_after()
            .unwrap(),
        (
            Counter(1),
            Counter(2),
            Counter(4),
            Counter(256),
            p.bases[0].content_digest.clone()
        )
    );
    assert!(compile(&reopened, &after, &empty).unwrap().is_none());
}
#[test]
fn actual_native_tail_detects_missing_final_first_middle_or_all_journal_rows() {
    let (p, after, complete, _) = original();
    assert_eq!(complete["last_input_ordinal"], "4");
    for index in [0, 1, 3] {
        let mut lost = complete.clone();
        lost["input_history"].as_array_mut().unwrap().remove(index);
        assert!(compile(&p, &after, &lost).is_err(), "lost row {index}");
    }
    let mut lost = complete.clone();
    lost["input_history"] = json!([]);
    assert!(compile(&p, &after, &lost).is_err());
    let mut missing = complete.clone();
    missing
        .as_object_mut()
        .unwrap()
        .remove("last_input_ordinal");
    assert!(compile(&p, &after, &missing).is_err());
    let mut typed = complete.clone();
    typed["last_input_ordinal"] = json!(4);
    assert!(compile(&p, &after, &typed).is_err());
    let mut extra = complete.clone();
    extra["input_history"][0]["invented_custody"] = json!(true);
    assert!(compile(&p, &after, &extra).is_err());
}
#[test]
fn actual_committed_high_water_detects_lost_application_and_origin_cannot_be_guessed() {
    let (p, after, complete, empty) = original();
    let mut lost = complete.clone();
    lost["applications"].as_array_mut().unwrap().pop();
    assert!(compile(&p, &after, &lost).is_err());
    assert!(compile(&p, &after, &empty).is_err());
    let mut no_origin = p.clone();
    no_origin.checkpoints.clear();
    let no_origin = no_origin.seal().unwrap();
    match compile(&no_origin, &after, &complete) {
        Err(reason) => assert!(reason.contains("origin/prefix"), "{reason}"),
        Ok(_) => panic!("recording fabricated an absent native prefix"),
    }
}
#[test]
fn actual_empty_native_pulse_cannot_hide_a_new_journal_total_or_change_epoch() {
    let (p, after, complete, empty) = original();
    let recorded = compile(&p, &after, &complete).unwrap().unwrap();
    let next = p.edited(recorded.record_operations()).unwrap();
    let mut unseen = empty.clone();
    unseen["last_input_ordinal"] = json!("5");
    assert!(compile(&next, &after, &unseen).is_err());
    let state = NativeRecordState::from_checkpoint(&next.bases[0], &after).unwrap();
    assert!(compile_original_batch(
        &next,
        &intent(),
        OriginalNativeBatch {
            state: &state,
            epoch: Counter(2),
            cursor: after.sample,
            applied_high_water: Counter(2),
            input_high_water: &empty["last_input_ordinal"],
            applications: &[],
            input_journal: &empty["input_history"]
        }
    )
    .is_err());
}
#[test]
fn actual_scene_constructor_and_file_hash_use_identical_typed_document_bytes() {
    let mut app = Application::default();
    let client = crate::CentralClient::discover();
    let (_created, _) = app
        .apply(
            &client,
            Request::Create {
                expression_ref: "expression:native-recording-hash".into(),
                title: "Native recording".into(),
                actor: "human:native-recording".into(),
            },
        )
        .unwrap();
    let before = app
        .procedural_source_snapshot("expression:native-recording-hash", 1)
        .unwrap();
    let scene_ref = &before.scenes[0].scene_ref;
    let owner = app.procedural_scene_owner(&before, scene_ref).unwrap();
    app.require_procedural_scene_owner(&owner, &before).unwrap();
    let fact = owner.closed_constructor_fact(&before, scene_ref).unwrap();
    let bytes = serde_json::to_vec(&before).unwrap();
    let original_hash =
        crate::native_expression::procedural::bootstrap::fingerprint(&before).unwrap();
    assert_eq!(original_hash, format!("{:x}", Sha256::digest(&bytes)));
    assert_eq!(fact["document_sha256"], original_hash);
    assert_eq!(
        crate::expression_file::digest(&bytes),
        format!("sha256:{original_hash}")
    );
    let (_changed, _) = app
        .apply(
            &client,
            Request::Edit {
                expression_ref: before.expression_ref.clone(),
                expected_revision: before.revision,
                actor: "human:native-recording".into(),
                changes: vec![Change::Rename {
                    title: "Actual edited document".into(),
                }],
            },
        )
        .unwrap();
    let after = app
        .procedural_source_snapshot(&before.expression_ref, before.revision + 1)
        .unwrap();
    assert!(app.require_procedural_scene_owner(&owner, &before).is_err());
    assert!(owner.closed_constructor_fact(&after, scene_ref).is_err());
    let fresh = app.procedural_scene_owner(&after, scene_ref).unwrap();
    assert_eq!(fresh.instance_ref(), owner.instance_ref());
    assert_eq!(
        fresh.construction_generation(),
        owner.construction_generation()
    );
    app.require_procedural_scene_owner(&fresh, &after).unwrap();
}

#[test]
fn genuine_native_origin_is_retained_once_and_backfill_or_pending_input_refuses() {
    let (retained, after, _, _) = original();
    let mut empty = retained.clone();
    empty.checkpoints.clear();
    let empty = empty.seal().unwrap();
    let origin_wire = read(artifacts().join("journal-tail.origin-checkpoint.json"));
    let accepted =
        compile_origin_wire(&empty, 0, "native:recording/original-origin", &origin_wire).unwrap();
    assert_eq!(accepted.sample, Counter(0));
    assert_eq!(
        accepted.event_prefix_digest,
        empty.prefix_digest(0).unwrap()
    );
    assert_eq!(accepted.native_management_wire().unwrap(), origin_wire);
    let started = empty
        .clone()
        .edited(vec![PerformanceOperation::Checkpoint {
            checkpoint: Box::new(accepted.clone()),
        }])
        .unwrap();
    let reopened: Performance =
        serde_json::from_slice(&serde_json::to_vec(&started).unwrap()).unwrap();
    reopened.validate().unwrap();
    assert_eq!(reopened.checkpoints[0], accepted);
    assert!(compile_origin_wire(
        &started,
        0,
        "native:recording/overwritten-origin",
        &origin_wire
    )
    .is_err());
    assert!(compile_origin_wire(
        &empty,
        0,
        "native:recording/backfilled-origin",
        &after.native_management_wire().unwrap()
    )
    .is_err());
    for (path, value) in [
        ("/native_pair/audio/accepted_sequence", json!("1")),
        ("/native_pair/audio/applied_application_ordinal", json!("1")),
        ("/input_history/last_ordinal", json!("1")),
        ("/native_pair/audio/cursor", json!("1")),
    ] {
        let mut lost = origin_wire.clone();
        *lost.pointer_mut(path).unwrap() = value;
        assert!(
            compile_origin_wire(&empty, 0, "native:recording/mutated-origin", &lost).is_err(),
            "{path}"
        );
    }
}

#[test]
fn actual_native_first_page_cannot_skip_the_retained_origin_even_with_a_fresh_digest() {
    let (p, after, complete, _) = original();
    require_retained_recording_prefix(&p, &intent()).unwrap();
    let recorded = compile(&p, &after, &complete).unwrap().unwrap();
    let intact = p.edited(recorded.record_operations()).unwrap();
    require_retained_recording_prefix(&intact, &intent()).unwrap();
    let page = &intact.native_recordings[0];
    assert_eq!(page.recording_stream_before().unwrap().1, Counter(0));
    assert_eq!(page.recording_stream_before().unwrap().2, Counter(0));
    let original_page_bytes = page.canonical_decoded_bytes().unwrap();
    let mut shortened: Value = serde_json::from_slice(&original_page_bytes).unwrap();
    shortened["value"]["receipts"]
        .as_array_mut()
        .unwrap()
        .remove(0);
    shortened["value"]["input_journal"]
        .as_array_mut()
        .unwrap()
        .drain(..2);
    shortened["value"]["previous_applied_application_ordinal"] = json!("1");
    shortened["value"]["previous_input_ordinal"] = json!("2");
    let mut page_wire = serde_json::to_value(page).unwrap();
    page_wire["encoded"] = serde_json::to_value(
        crate::expression_performance_codec::EncodedPage::from_value(&shortened).unwrap(),
    )
    .unwrap();
    let mut suffix = intact.clone();
    suffix.native_recordings[0] = serde_json::from_value(page_wire).unwrap();
    // The existing native page codec verifies this coherent suffix. The
    // complete original recording eligibility must additionally refuse it.
    suffix.native_recordings[0].validate().unwrap();
    let suffix = suffix.seal().unwrap();
    assert_ne!(suffix.content_digest, intact.content_digest);
    let reason = require_retained_recording_prefix(&suffix, &intent()).unwrap_err();
    assert!(
        reason.contains("original application/input prefix"),
        "{reason}"
    );
    assert!(compile(
        &suffix,
        &after,
        &read(artifacts().join("journal-tail.empty.json"))
    )
    .is_err());
    assert_eq!(page.canonical_decoded_bytes().unwrap(), original_page_bytes);
    assert_eq!(complete["applications"].as_array().unwrap().len(), 2);
    assert_eq!(complete["input_history"].as_array().unwrap().len(), 4);
}

#[test]
fn actual_native_cancelled_and_lost_epochs_cannot_be_reused_or_terminated_twice() {
    use crate::expression_performance_recording::NativeRecordingPage;
    use crate::expression_performance_reservation::{
        reserve_checkpoint, NativeReservationTermination, NativeTransportAcknowledgement,
    };
    let directory = PathBuf::from(
        std::env::var("QL_RETAINED_PERFORMANCE_RESERVATION_DIRECTORY")
            .expect("mandatory same-source native cancellation and queue-loss producer"),
    );
    let (base, journal_after, complete, _) = original();
    let original_recorded = compile(&base, &journal_after, &complete).unwrap().unwrap();
    let original_applied_page = original_recorded.prospective().native_recordings[0].clone();
    let original_applied_bytes = original_applied_page.canonical_decoded_bytes().unwrap();
    for kind in ["cancel", "lost"] {
        let mut parameter_base = base.clone();
        parameter_base.checkpoints.clear();
        parameter_base.parameters.push(ParameterTarget {
            native_owner: "ql.performance.Engine".into(),
            action_ref: "ql:native-performance/parameter".into(),
            target_ref: "ql:performance/parameter/master-linear".into(),
            unit: "linear".into(),
            scope: Scope::Instrument,
            minimum: Scalar::new(0.0).unwrap(),
            maximum: Scalar::new(1.0).unwrap(),
            baseline: Scalar::new(1.0).unwrap(),
            smoothing_samples: Counter(128),
        });
        let authored = parameter_base
            .seal()
            .unwrap()
            .edited(vec![PerformanceOperation::Record {
                events: vec![TimedEvent(
                    Counter(42),
                    Counter(1000),
                    0,
                    0,
                    EventAction::Parameter(0, Scalar::new(0.2).unwrap(), None),
                )],
            }])
            .unwrap();
        let make_checkpoint = |name: &str, queued_events: Vec<QueuedEventReceipt>| {
            let wire = read(directory.join(format!("{kind}.{name}.json")));
            let sample = counter(&wire["native_pair"]["audio"]["cursor"]).unwrap();
            CheckpointBinding::from_native_management(
                CheckpointReceipt {
                    checkpoint_ref: if name == "after" && kind == "cancel" {
                        "native:reservation/initial".into()
                    } else {
                        format!("native:reservation/{kind}/{name}")
                    },
                    identity: authored.bases[0].identity.clone(),
                    sample,
                    basis_digest: authored.bases[0].content_digest.clone(),
                    event_prefix_digest: authored.prefix_digest(sample.0).unwrap(),
                    queued_events,
                    acknowledged_stopped: true,
                },
                wire,
            )
            .unwrap()
        };
        let origin = make_checkpoint("origin", vec![]);
        assert_eq!(origin.sample, Counter(0));
        assert_eq!(
            counter(&origin.audio["applied_application_ordinal"]).unwrap(),
            Counter(0)
        );
        assert_eq!(
            origin
                .management
                .as_ref()
                .unwrap()
                .input_history
                .last_ordinal,
            Counter(0)
        );
        let before = make_checkpoint(
            "before",
            vec![QueuedEventReceipt {
                native_sequence: Counter(1),
                recorded_sequence: Counter(42),
                effective_sample: Counter(1000),
            }],
        );
        assert_eq!(
            counter(&before.audio["applied_application_ordinal"]).unwrap(),
            Counter(0)
        );
        assert_eq!(
            before
                .management
                .as_ref()
                .unwrap()
                .input_history
                .last_ordinal,
            Counter(0)
        );
        let after = make_checkpoint("after", vec![]);
        let reservations = reserve_checkpoint(
            &authored,
            &before,
            &[ParameterBinding {
                native_parameter: 4,
                performance_parameter: 0,
            }],
        )
        .unwrap();
        let queued = authored
            .edited(vec![
                PerformanceOperation::Checkpoint {
                    checkpoint: Box::new(origin),
                },
                PerformanceOperation::ReserveNative { reservations },
            ])
            .unwrap();
        let termination = if kind == "cancel" {
            let ack: NativeTransportAcknowledgement =
                serde_json::from_value(read(directory.join("cancel.ack.json"))).unwrap();
            assert_eq!(ack.previous_epoch, Counter(1));
            assert_eq!(ack.epoch, Counter(2));
            NativeReservationTermination::cancelled(&queued, before, after, ack).unwrap()
        } else {
            assert_eq!(after.audio["applied_application_ordinal"], "257");
            assert_eq!(after.audio["recording"]["dropped_applications"], "1");
            NativeReservationTermination::lost(&queued, before, after).unwrap()
        };
        let page = NativeRecordingPage::from_termination(&queued, termination.clone()).unwrap();
        let original_terminal_bytes = page.canonical_decoded_bytes().unwrap();
        let completed = queued
            .edited(vec![PerformanceOperation::RecordNative {
                events: vec![],
                page: page.clone(),
            }])
            .unwrap();
        require_original_recording_streams(&completed).unwrap();
        assert_eq!(
            completed.native_recordings[0].termination().unwrap(),
            Some(termination.clone())
        );
        let (_, _, _, cursor, _) = page.recording_stream_after().unwrap();
        // A terminal Lost checkpoint remains readable, but cannot authorize a
        // new command or recording page in its original transport epoch.
        assert!(previous_stream(&completed, 0, Counter(1), cursor)
            .unwrap_err()
            .contains("terminated transport epoch"));
        if kind == "cancel" {
            assert_eq!(
                previous_stream(&completed, 0, Counter(2), cursor).unwrap(),
                (Counter(0), Counter(0))
            );
            assert_eq!(completed.checkpoints.len(), 1);
            assert_eq!(
                completed.checkpoints[0]
                    .management
                    .as_ref()
                    .unwrap()
                    .transport_epoch,
                Counter(1)
            );
            require_retained_recording_prefix(&completed, &intent()).unwrap();
        } else {
            let reason = require_retained_recording_prefix(&completed, &intent()).unwrap_err();
            assert!(reason.contains("terminated transport epoch"), "{reason}");
        }
        let mut continued_old_epoch = completed.clone();
        continued_old_epoch
            .native_recordings
            .push(original_applied_page.clone());
        let reason = require_original_recording_streams(&continued_old_epoch).unwrap_err();
        assert!(
            reason.contains("reused a terminated transport epoch"),
            "{kind}: {reason}"
        );
        let mut terminated_twice = completed.clone();
        terminated_twice.native_recordings.push(page.clone());
        let reason = require_original_recording_streams(&terminated_twice).unwrap_err();
        assert!(
            reason.contains("reused a terminated transport epoch"),
            "{kind}: {reason}"
        );
        assert_eq!(
            page.canonical_decoded_bytes().unwrap(),
            original_terminal_bytes
        );
        let reopened = crate::expression_performance_assets::PerformancePartCatalog::default()
            .appended(&completed)
            .unwrap()
            .restore(0)
            .unwrap();
        assert_eq!(reopened, completed);
        require_original_recording_streams(&reopened).unwrap();
    }
    assert_eq!(
        original_applied_page.canonical_decoded_bytes().unwrap(),
        original_applied_bytes
    );
    assert_eq!(complete["applications"].as_array().unwrap().len(), 2);
    assert_eq!(complete["input_history"].as_array().unwrap().len(), 4);
}
#[test]
fn actual_queued_input_save_cut_preserves_native_queue_without_a_performed_note() {
    let (p, _, _, _) = original();
    let wire = read(artifacts().join("release.original-queued-checkpoint.json"));
    let basis = &p.bases[0];
    let receipt = CheckpointReceipt {
        checkpoint_ref: "native:save-cut/pending-live-origin".into(),
        identity: basis.identity.clone(),
        sample: counter(&wire["native_pair"]["audio"]["cursor"]).unwrap(),
        basis_digest: basis.content_digest.clone(),
        event_prefix_digest: p.prefix_digest(0).unwrap(),
        queued_events: vec![],
        acknowledged_stopped: true,
    };
    assert!(CheckpointBinding::from_native_management(receipt.clone(), wire.clone()).is_err());
    let captured =
        CheckpointBinding::from_native_management_capturing_pending(receipt, wire.clone()).unwrap();
    assert_eq!(captured.schema, PENDING_CHECKPOINT_SCHEMA);
    assert_eq!(captured.unscored_queued_inputs.len(), 1);
    assert_eq!(
        captured.unscored_queued_inputs[0].native_sequence(),
        Counter(1)
    );
    assert!(captured.unscored_queued_inputs[0].input().is_some());
    assert_eq!(captured.native_pair_wire().unwrap(), wire["native_pair"]);
    let saved = p
        .clone()
        .edited(vec![PerformanceOperation::Checkpoint {
            checkpoint: Box::new(captured.clone()),
        }])
        .unwrap();
    assert!(saved.pages.is_empty());
    assert!(saved.native_recordings.is_empty());
    assert_eq!(
        saved.checkpoints[0], p.checkpoints[0],
        "original born checkpoint was overwritten"
    );
    let reopened: Performance =
        serde_json::from_slice(&serde_json::to_vec(&saved).unwrap()).unwrap();
    reopened.validate().unwrap();
    assert_eq!(reopened, saved);
    assert_eq!(reopened.checkpoints[1], captured);
    for mutation in ["drop", "input", "sample", "operation"] {
        let mut changed = captured.clone();
        match mutation {
            "drop" => changed.unscored_queued_inputs.clear(),
            "input" => {
                let mut value = serde_json::to_value(&changed).unwrap();
                value["unscored_queued_inputs"][0]["input"]["input_ref"] =
                    json!("native-score:other-pointer/42");
                changed = serde_json::from_value(value).unwrap();
            }
            "sample" => {
                let mut value = serde_json::to_value(&changed).unwrap();
                value["unscored_queued_inputs"][0]["effective_sample"] = json!("1");
                changed = serde_json::from_value(value).unwrap();
            }
            _ => {
                let mut value = serde_json::to_value(&changed).unwrap();
                value["unscored_queued_inputs"][0]["operation"]["note"]["touch_ref"] =
                    json!("native:other-touch");
                changed = serde_json::from_value(value).unwrap();
            }
        }
        assert!(changed.seal().is_err(), "{mutation}");
    }
}
#[test]
fn genuine_origin_v1_retains_its_exact_digest_and_bytes_under_pending_successor() {
    let (p, _, _, _) = original();
    let original = &p.checkpoints[0];
    assert_eq!(original.schema, CHECKPOINT_SCHEMA);
    assert!(original.unscored_queued_inputs.is_empty());
    let wire = original.native_management_wire().unwrap();
    let regenerated = CheckpointBinding::from_native_management_capturing_pending(
        CheckpointReceipt {
            checkpoint_ref: original.checkpoint_ref.clone(),
            identity: original.identity.clone(),
            sample: original.sample,
            basis_digest: original.basis_digest.clone(),
            event_prefix_digest: original.event_prefix_digest.clone(),
            queued_events: original.queued_events.clone(),
            acknowledged_stopped: true,
        },
        wire,
    )
    .unwrap();
    assert_eq!(regenerated, *original);
    assert_eq!(
        serde_json::to_vec(&regenerated).unwrap(),
        serde_json::to_vec(original).unwrap()
    );
}
