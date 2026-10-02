//! Actual callback applications/journal/checkpoint, produced by the mandatory
//! native gate. Authored score operands do not substitute for these artifacts.
use oi_cradle_kernel::expression_performance::*;
use oi_cradle_kernel::expression_performance_management::InputHistoryEntry;
use oi_cradle_kernel::expression_performance_recording::{
    prepare_recording, NativeRecordState, ParameterBinding, RecordAdmission,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

fn read(path: impl AsRef<std::path::Path>) -> Value {
    let bytes = std::fs::read(path).unwrap();
    assert!(bytes.len() < 32 * 1024 * 1024);
    serde_json::from_slice(&bytes).unwrap()
}
fn scalar(value: f64) -> Scalar {
    Scalar::new(value).unwrap()
}
fn actual() -> (
    Performance,
    CheckpointBinding,
    Vec<Value>,
    Vec<InputHistoryEntry>,
) {
    let source = read(
        std::env::var("QL_RETAINED_PERFORMANCE_FIXTURE")
            .expect("actual native Rust source fixture required"),
    );
    let directory = std::path::PathBuf::from(
        std::env::var("QL_RETAINED_PERFORMANCE_MANAGEMENT_DIRECTORY")
            .expect("actual native management applications/input journal/checkpoint required"),
    );
    let basis = serde_json::from_value::<PerformanceBasis>(source["basis"].clone())
        .unwrap()
        .seal()
        .unwrap();
    assert!(!basis.context.private);
    assert!(basis.m4_episode.is_none());
    let wire = read(directory.join("baseline.current.management.json"));
    let sample =
        serde_json::from_value::<Counter>(wire["native_pair"]["audio"]["cursor"].clone()).unwrap();
    assert_eq!(sample, Counter(384));
    let prefix = format!(
        "sha256:{:x}",
        Sha256::digest(
            serde_json::to_vec(&wire["native_pair"]["audio"]["source_schedule"]).unwrap()
        )
    );
    let receipt = CheckpointReceipt {
        checkpoint_ref: "native:actual-baseline/current".into(),
        identity: basis.identity.clone(),
        sample,
        basis_digest: basis.content_digest.clone(),
        event_prefix_digest: prefix,
        queued_events: vec![],
        acknowledged_stopped: true,
    };
    let checkpoint = CheckpointBinding::from_native_management(receipt, wire).unwrap();
    let performance = Performance {
        schema: SCHEMA.into(),
        performance_ref: "performance:actual-native-recorded/current".into(),
        sample_rate: 48000,
        duration_samples: Counter(43200000),
        ppq: 960,
        bases: vec![basis],
        pitches: serde_json::from_value(source["pitches"].clone()).unwrap(),
        layers: vec![Layer {
            layer_ref: "layer:performed".into(),
            title: "Performed".into(),
            enabled: true,
            solo: false,
        }],
        pages: vec![],
        parameters: vec![ParameterTarget {
            native_owner: "ql.performance.Engine".into(),
            action_ref: "ql:native-performance/parameter".into(),
            target_ref: "ql:performance/parameter/master-linear".into(),
            unit: "linear".into(),
            scope: Scope::Instrument,
            minimum: scalar(0.0),
            maximum: scalar(1.0),
            baseline: scalar(1.0),
            smoothing_samples: Counter(128),
        }],
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
            physical_tolerance: scalar(0.0),
            display_policy: "same-native-cursor".into(),
        },
        checkpoints: vec![],
        native_sources: vec![],
        native_recordings: vec![],
        native_reservations: vec![],
        content_digest: String::new(),
    }
    .seal()
    .unwrap();
    let events = read(directory.join("baseline.applied-events.json"));
    assert_eq!(events["schema"], "ql.native-applied-event-artifact/v1");
    let applications = events["applications"].as_array().unwrap().clone();
    assert_eq!(applications.len(), 4);
    let journal = read(directory.join("baseline.input-journal.json"));
    assert_eq!(journal["schema"], "ql.native-input-journal-artifact/v1");
    (
        performance,
        checkpoint,
        applications,
        serde_json::from_value(journal["entries"].clone()).unwrap(),
    )
}
fn admission<'a>(
    state: &'a NativeRecordState,
    bindings: &'a [ParameterBinding],
) -> RecordAdmission<'a> {
    RecordAdmission {
        state,
        basis: 0,
        layer: 0,
        previous_applied_application_ordinal: Counter(0),
        expected_transport_epoch: Counter(1),
        previous_input_ordinal: Counter(0),
        parameter_bindings: bindings,
    }
}
#[test]
fn actual_applied_attack_expression_parameter_release_record_exact_native_samples_and_original_inputs(
) {
    let (performance, checkpoint, applications, journal) = actual();
    let state = NativeRecordState::from_checkpoint(&performance.bases[0], &checkpoint).unwrap();
    let bindings = [ParameterBinding {
        native_parameter: 4,
        performance_parameter: 0,
    }];
    let recorded = prepare_recording(
        &performance,
        admission(&state, &bindings),
        &applications,
        &journal,
    )
    .unwrap();
    let next = recorded.prospective();
    assert_eq!(
        next.events().map(TimedEvent::sample).collect::<Vec<_>>(),
        vec![37, 101, 149, 256]
    );
    assert_eq!(performance.event_count(), 0);
    assert_eq!(next.event_count(), 4);
    assert_eq!(recorded.applied_application_ordinal(), Counter(4));
    assert_eq!(recorded.transport_epoch(), Counter(1));
    assert_eq!(next.bases, performance.bases);
    let events: Vec<_> = next.events().collect();
    let target = recorded.receipts()[0].application.note.as_ref().unwrap();
    assert!(
        matches!(&events[0].4,EventAction::NoteOn(touch,member,_,velocity,sine,cosine)
        if *touch==target.touch && *member==target.member && *velocity==scalar(0.8)
        && *sine==target.phase_sin && *cosine==target.phase_cos)
    );
    assert!(
        matches!(&events[1].4,EventAction::Expression(touch,pressure,hertz)
        if *touch==target.touch && *pressure==scalar(0.63) && *hertz==target.hertz)
    );
    assert_eq!(recorded.receipts()[1].application.pitch_hz, scalar(0.0));
    assert!(matches!(&events[2].4,EventAction::Parameter(0,value,None) if *value==scalar(0.35)));
    assert!(matches!(&events[3].4,EventAction::NoteOff(touch) if *touch==target.touch));
    assert_eq!(recorded.input_journal(), journal);
    let original = recorded.receipts()[0].original_input.as_ref().unwrap();
    assert_ne!(original.input_ref, target.touch_ref);
    let bytes = serde_json::to_vec(recorded.receipts()).unwrap();
    let reopened: Value = serde_json::from_slice(&bytes).unwrap();
    for (i, app) in applications.iter().enumerate() {
        assert_eq!(reopened[i]["application"], *app);
    }
    recorded
        .verify_replay(
            &performance,
            admission(&state, &bindings),
            &applications,
            &journal,
        )
        .unwrap();
    assert_eq!(
        performance.edited(recorded.record_operations()).unwrap(),
        *next
    );
}
#[test]
fn actual_lost_or_refused_application_original_input_tuning_body_clock_or_native_cursor_refuses_atomically(
) {
    let (performance, checkpoint, applications, journal) = actual();
    let state = NativeRecordState::from_checkpoint(&performance.bases[0], &checkpoint).unwrap();
    let bindings = [ParameterBinding {
        native_parameter: 4,
        performance_parameter: 0,
    }];
    let before = performance.clone();
    for pointer in [
        "/identity",
        "/native_clock",
        "/physical_manifest",
        "/sequence",
        "/applied_application_ordinal",
        "/note",
    ] {
        let mut lost = applications.clone();
        *lost[0].pointer_mut(pointer).unwrap() = Value::Null;
        assert!(
            prepare_recording(&performance, admission(&state, &bindings), &lost, &journal).is_err(),
            "lost {pointer}"
        );
    }
    let mut missing = applications.clone();
    missing.pop();
    assert!(prepare_recording(
        &performance,
        admission(&state, &bindings),
        &missing,
        &journal
    )
    .is_err());
    let mut wrong_epoch = admission(&state, &bindings);
    wrong_epoch.expected_transport_epoch = Counter(2);
    assert!(prepare_recording(&performance, wrong_epoch, &applications, &journal).is_err());
    let mut refused = applications.clone();
    refused[0]["applied"] = json!(false);
    refused[0]["status"] = json!("refused");
    assert!(prepare_recording(
        &performance,
        admission(&state, &bindings),
        &refused,
        &journal
    )
    .is_err());
    let mut missing = applications.clone();
    missing.remove(1);
    assert!(prepare_recording(
        &performance,
        admission(&state, &bindings),
        &missing,
        &journal
    )
    .is_err());
    for (pointer, value) in [
        ("/note/hertz", json!(123.0)),
        ("/physical_manifest/source_generation", json!("999")),
        (
            "/physical_manifest/eigenbasis_identity",
            json!("foreign:eigenbasis"),
        ),
        ("/identity/subject", json!("foreign:subject")),
        ("/native_clock/epoch", json!("0")),
        ("/applied_sample", json!("999")),
        ("/committed_cursor", json!("999")),
    ] {
        let mut wrong = applications.clone();
        // A scored receipt already has an epoch of zero; corrupt its anchor
        // instead so the mutation necessarily changes the actual contract.
        if pointer == "/native_clock/epoch" {
            wrong[0]["native_clock"]["anchor_ordinal"] = json!("1");
        } else {
            *wrong[0].pointer_mut(pointer).unwrap() = value;
        }
        assert!(
            prepare_recording(&performance, admission(&state, &bindings), &wrong, &journal)
                .is_err(),
            "altered {pointer}"
        );
    }
    let no_applied: Vec<_> = journal.iter().filter(|e| e.change != 2).cloned().collect();
    assert!(prepare_recording(
        &performance,
        admission(&state, &bindings),
        &applications,
        &no_applied
    )
    .is_err());
    let mut relabeled = journal.clone();
    for entry in &mut relabeled {
        if entry.change == 2 && entry.native_sequence == Counter(1) {
            entry.target.touch_ref = "invented:touch".into();
        }
    }
    assert!(prepare_recording(
        &performance,
        admission(&state, &bindings),
        &applications,
        &relabeled
    )
    .is_err());
    let mut units = performance.clone();
    units.parameters[0].unit = "Hz".into();
    units = units.seal().unwrap();
    assert!(prepare_recording(
        &units,
        admission(&state, &bindings),
        &applications,
        &journal
    )
    .is_err());
    assert_eq!(performance, before);
}
#[test]
fn public_world_actual_source_refuses_protected_episode_and_shared_loss_of_private_custody() {
    let (performance, _, _, _) = actual();
    let basis = &performance.bases[0];
    let reading = basis.context.context.clone();
    for protected in [true, false] {
        let mut wrong = basis.clone();
        if protected {
            wrong.context.protected_state = Some(reading.clone());
        } else {
            wrong.context.source_occasion = Some(reading.clone());
            wrong.m4_episode = Some(json!({"occasion_ref":reading.r#ref}));
        }
        assert!(wrong.seal().is_err());
    }
    let mut shared = basis.clone();
    shared.context.kind = ContextKind::Shared;
    shared.context.consent = Some(reading.clone());
    shared.context.source_occasion = Some(reading);
    assert!(
        shared.seal().is_err(),
        "consent labels cannot replace protected/private original shared custody"
    );
}

fn managed_order(
    prefix: &str,
    continued: bool,
) -> (
    Performance,
    CheckpointBinding,
    Vec<Value>,
    Vec<InputHistoryEntry>,
) {
    let (performance, _, _, _) = actual();
    let directory = std::path::PathBuf::from(
        std::env::var("QL_RETAINED_PERFORMANCE_MANAGED_ORDER_DIRECTORY").expect(
            "normal gate must execute the real Management overtaking producer; no fallback",
        ),
    );
    let original_native = read(directory.join(format!("{prefix}.basis.json")));
    let original_return = read(std::env::var("QL_RETAINED_PERFORMANCE_FIXTURE").unwrap());
    assert_eq!(
        original_native, original_return["native_preparation"]["native_basis"],
        "C score and callback share the SAME actual native producer"
    );
    let suffix = if continued {
        "continued-checkpoint"
    } else {
        "checkpoint"
    };
    let wire = read(directory.join(format!("{prefix}.{suffix}.json")));
    let sample: Counter =
        serde_json::from_value(wire["native_pair"]["audio"]["cursor"].clone()).unwrap();
    assert_eq!(sample, Counter(if continued { 48128 } else { 256 }));
    assert_eq!(
        wire["native_pair"]["audio"]["schema"],
        "ql.performance-checkpoint/v2"
    );
    let history = read(directory.join(format!("{prefix}.history.json")));
    assert_eq!(
        history["schema"],
        "ql.performance-managed-application-history/v1"
    );
    let mut applications = history["applications"].as_array().unwrap().clone();
    assert_eq!(
        applications
            .iter()
            .map(|a| a["sequence"].as_str().unwrap())
            .collect::<Vec<_>>(),
        vec!["1", "3", "2"]
    );
    assert_eq!(
        applications
            .iter()
            .map(|a| a["applied_application_ordinal"].as_str().unwrap())
            .collect::<Vec<_>>(),
        vec!["1", "2", "3"]
    );
    let mut journal: Vec<InputHistoryEntry> =
        serde_json::from_value(history["input_history"].clone()).unwrap();
    if !continued {
        applications.truncate(2);
        let last: Counter =
            serde_json::from_value(wire["input_history"]["last_ordinal"].clone()).unwrap();
        journal.retain(|entry| entry.ordinal <= last);
    }
    let source_prefix = format!(
        "sha256:{:x}",
        Sha256::digest(
            serde_json::to_vec(&wire["native_pair"]["audio"]["source_schedule"]).unwrap()
        )
    );
    // This fixture has exactly one explicitly authored pending automation.
    // It reserves occurrence3 while C's prefix score still contains only the
    // two actual committed applications. A reservation is never played history.
    let queued_events = if continued {
        vec![]
    } else {
        vec![QueuedEventReceipt {
            native_sequence: Counter(2),
            recorded_sequence: Counter(3),
            effective_sample: Counter(48000),
        }]
    };
    let receipt = CheckpointReceipt {
        checkpoint_ref: format!("native:managed-order/{prefix}/{suffix}"),
        identity: performance.bases[0].identity.clone(),
        sample,
        basis_digest: performance.bases[0].content_digest.clone(),
        event_prefix_digest: source_prefix,
        queued_events,
        acknowledged_stopped: true,
    };
    let checkpoint = CheckpointBinding::from_native_management(receipt, wire).unwrap();
    (performance, checkpoint, applications, journal)
}

#[test]
fn actual_future_automation_and_critical_release_or_panic_preserve_both_ids_and_native_commit_order(
) {
    let bindings = [ParameterBinding {
        native_parameter: 4,
        performance_parameter: 0,
    }];
    for prefix in ["release", "panic"] {
        let (performance, prefix_checkpoint, apps, journal) = managed_order(prefix, false);
        let state =
            NativeRecordState::from_checkpoint(&performance.bases[0], &prefix_checkpoint).unwrap();
        let prefix_recording =
            prepare_recording(&performance, admission(&state, &bindings), &apps, &journal).unwrap();
        assert_eq!(prefix_recording.applied_application_ordinal(), Counter(2));
        assert_eq!(
            prefix_recording
                .prospective()
                .events()
                .map(TimedEvent::sample)
                .collect::<Vec<_>>(),
            vec![37, 128]
        );
        let release = &prefix_recording.receipts()[1].application;
        assert_eq!(release.sequence, Counter(3));
        assert_eq!(release.applied_application_ordinal, Counter(2));
        assert_eq!(release.admitted_sample, Counter(0));
        assert_eq!(release.applied_sample, Counter(128));
        assert!(release.late_admitted);
        assert!(prefix_recording
            .prospective()
            .events()
            .all(|e| !matches!(e.4, EventAction::Parameter(..))));
        assert_eq!(
            prefix_checkpoint.queued_events[0].native_sequence,
            Counter(2)
        );
        assert_eq!(
            prefix_checkpoint.queued_events[0].recorded_sequence,
            Counter(3)
        );
        assert!(prefix_recording
            .input_journal()
            .iter()
            .all(|e| e.input_ref == "native-score:original-pointer/42"));
        if prefix == "panic" {
            assert!(matches!(
                prefix_recording.prospective().events().nth(1).unwrap().4,
                EventAction::Panic
            ));
            assert!(prefix_recording
                .prospective()
                .events()
                .all(|e| !matches!(e.4, EventAction::NoteOff(_))));
        }
        let (performance, checkpoint, applications, journal) = managed_order(prefix, true);
        let state = NativeRecordState::from_checkpoint(&performance.bases[0], &checkpoint).unwrap();
        let recorded = prepare_recording(
            &performance,
            admission(&state, &bindings),
            &applications,
            &journal,
        )
        .unwrap();
        assert_eq!(recorded.applied_application_ordinal(), Counter(3));
        assert_eq!(
            recorded
                .prospective()
                .events()
                .map(TimedEvent::sample)
                .collect::<Vec<_>>(),
            vec![37, 128, 48000]
        );
        assert_eq!(
            recorded
                .receipts()
                .iter()
                .map(|r| r.application.sequence.0)
                .collect::<Vec<_>>(),
            vec![1, 3, 2]
        );
        assert!(
            matches!(recorded.prospective().events().nth(2).unwrap().4,EventAction::Parameter(0,value,None) if value==scalar(0.2))
        );
        for remove in 0..3 {
            let mut lost = applications.clone();
            lost.remove(remove);
            assert!(
                prepare_recording(&performance, admission(&state, &bindings), &lost, &journal)
                    .is_err()
            );
        }
        let mut reordered = applications.clone();
        reordered.swap(1, 2);
        assert!(prepare_recording(
            &performance,
            admission(&state, &bindings),
            &reordered,
            &journal
        )
        .is_err());
        let mut late = applications.clone();
        late[1]["late_admitted"] = json!(false);
        assert!(
            prepare_recording(&performance, admission(&state, &bindings), &late, &journal).is_err()
        );
        let mut gap = applications.clone();
        gap[2]["applied_application_ordinal"] = json!("4");
        assert!(
            prepare_recording(&performance, admission(&state, &bindings), &gap, &journal).is_err()
        );
        recorded
            .verify_replay(
                &performance,
                admission(&state, &bindings),
                &applications,
                &journal,
            )
            .unwrap();
    }
}

#[test]
fn actual_native_receipts_are_atomic_lossless_scene_parts_and_survive_authored_edits() {
    use oi_cradle_kernel::expression_performance_assets::*;
    let (performance, checkpoint, applications, journal) = actual();
    let state = NativeRecordState::from_checkpoint(&performance.bases[0], &checkpoint).unwrap();
    let bindings = [ParameterBinding {
        native_parameter: 4,
        performance_parameter: 0,
    }];
    let recorded = prepare_recording(
        &performance,
        admission(&state, &bindings),
        &applications,
        &journal,
    )
    .unwrap();
    let next = recorded.prospective();
    assert_eq!(next.schema, RECORDING_SCHEMA);
    assert_eq!(next.native_recordings.len(), 1);
    let page = serde_json::to_value(&next.native_recordings[0]).unwrap();
    let decoded_bytes = serde_json::from_value::<
        oi_cradle_kernel::expression_performance_codec::EncodedPage,
    >(page["encoded"].clone())
    .unwrap()
    .bytes()
    .unwrap();
    let batch_bytes = serde_json::to_vec(&next.native_recordings[0].batch().unwrap()).unwrap();
    let legacy_applied = [
        br#"{"kind":"applied","value":"#.as_slice(),
        batch_bytes.as_slice(),
        b"}",
    ]
    .concat();
    assert_eq!(
        decoded_bytes, legacy_applied,
        "boxing must preserve the existing real native recording bytes/hash"
    );
    let decoded: Value = serde_json::from_slice(&decoded_bytes).unwrap();
    assert_eq!(
        decoded["value"]["receipts"][0]["application"],
        applications[0]
    );
    assert_eq!(
        decoded["value"]["input_journal"],
        serde_json::to_value(&journal).unwrap()
    );
    let saved = PerformancePartCatalog::default().appended(next).unwrap();
    assert_eq!(saved.snapshot().schema, RECORDING_CATALOG_SCHEMA);
    let reopened = PerformancePartCatalog::read(saved.snapshot()).unwrap();
    assert_eq!(&reopened.restore(0).unwrap(), next);
    let original_event = next.events().nth(2).unwrap().clone();
    let mut replacement = original_event.clone();
    replacement.4 = EventAction::Parameter(0, scalar(0.6), None);
    let edited = next
        .edited(vec![PerformanceOperation::EditEvent {
            sequence: original_event.0,
            replacement,
        }])
        .unwrap();
    assert_eq!(edited.native_recordings, next.native_recordings);
    assert_ne!(edited.pages, next.pages);
    assert_eq!(
        recorded.receipts()[2].performed_event.as_ref(),
        Some(&original_event)
    );
    let mut corrupt = page;
    corrupt["encoded"]["decoded_bytes"] = json!(4 * 1024 * 1024 + 1);
    let corrupt: oi_cradle_kernel::expression_performance_recording::NativeRecordingPage =
        serde_json::from_value(corrupt).unwrap();
    assert!(corrupt.validate().is_err());
    assert!(next
        .edited(vec![PerformanceOperation::RecordNative {
            events: vec![],
            page: next.native_recordings[0].clone()
        }])
        .is_err());
    let mut lost = saved.snapshot();
    let count = lost.parts.len();
    lost.parts
        .retain(|p| !matches!(p.part, PerformancePart::NativeRecording(_)));
    assert_eq!(lost.parts.len(), count - 1);
    assert!(PerformancePartCatalog::read(lost).is_err());
    assert_eq!(&reopened.restore(0).unwrap(), next);
}

#[test]
fn full_actual_fifteen_minute_committed_workload_survives_native_act_file_and_180_editions() {
    use oi_cradle_kernel::expression_act_store::{ActStore, Written};
    use oi_cradle_kernel::expression_performance_storage::ActPerformanceCustody;
    use oi_cradle_kernel::{
        expression::Document, expression_file, Kernel, KernelOp, KernelOpResult,
    };
    let directory = std::path::PathBuf::from(
        std::env::var("QL_RETAINED_PERFORMANCE_WORKLOAD_DIRECTORY")
            .expect("normal native gate must execute the complete real 45k/24voice/15min producer"),
    );
    let manifest = read(directory.join("manifest.json"));
    assert_eq!(manifest["schema"], "ql.retained-native-workload/v1");
    assert_eq!(manifest["application_count"], "45000");
    assert_eq!(manifest["duration_samples"], "43200000");
    assert_eq!(manifest["voice_count"], "24");
    assert_eq!(manifest["editions"].as_array().unwrap().len(), 180);
    let (mut performance, _, _, _) = actual();
    performance.parameters = [
        ("force-newtons", "N", 0.0, 1.0),
        ("cutoff-hertz", "Hz", 10.0, 20000.0),
        ("master-linear", "linear", 0.0, 1.0),
    ]
    .iter()
    .map(|(field, unit, min, max)| ParameterTarget {
        native_owner: "ql.performance.Engine".into(),
        action_ref: "ql:native-performance/parameter".into(),
        target_ref: format!("ql:performance/parameter/{field}"),
        unit: (*unit).into(),
        scope: Scope::Instrument,
        minimum: scalar(*min),
        maximum: scalar(*max),
        baseline: scalar(*min),
        smoothing_samples: Counter(128),
    })
    .collect();
    performance.replay.max_reconstruction_samples = Counter(240000);
    performance = performance.seal().unwrap();
    let bindings = [
        ParameterBinding {
            native_parameter: 0,
            performance_parameter: 0,
        },
        ParameterBinding {
            native_parameter: 3,
            performance_parameter: 1,
        },
        ParameterBinding {
            native_parameter: 4,
            performance_parameter: 2,
        },
    ];
    fn invoke(kernel: &mut Kernel, value: Value, world: bool) -> Value {
        let operation = if world {
            KernelOp::ExpressionWorld {
                request: serde_json::from_value(value).unwrap(),
            }
        } else {
            KernelOp::Expression {
                request: serde_json::from_value(value).unwrap(),
            }
        };
        match kernel.apply(operation).unwrap().result {
            KernelOpResult::Expression { data } | KernelOpResult::ExpressionWorld { data } => data,
            _ => panic!("native Expression/Act result absent"),
        }
    }
    let home = std::path::PathBuf::from(
        std::env::var("OI_RETAINED_PERFORMANCE_TEST_HOME")
            .expect("normal native gate must supply unique bounded Act custody"),
    )
    .join(format!(
        "native-committed-fifteen-minute-act-{}",
        std::process::id()
    ));
    assert!(!home.exists(), "preserve original native test custody");
    let mut kernel = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    kernel.attach_act_store(&home).unwrap();
    invoke(
        &mut kernel,
        json!({"operation":"create","expression_ref":"expression:actual-native-recorded/current","title":"Actual retained physical performance","actor":"agent:retained-workload"}),
        false,
    );
    let mut document: Document = serde_json::from_value(invoke(&mut kernel,
        json!({"operation":"inspect","expression_ref":"expression:actual-native-recorded/current"}), false)["document"].clone()).unwrap();
    invoke(
        &mut kernel,
        json!({"operation":"edit","expression_ref":document.expression_ref,
        "expected_revision":document.revision,"actor":"agent:retained-workload",
        "changes":[{"change":"scene_performance_set","scene_ref":document.scenes[0].scene_ref,"performance":performance}]}),
        false,
    );
    document = serde_json::from_value(
        invoke(
            &mut kernel,
            json!({"operation":"inspect","expression_ref":document.expression_ref}),
            false,
        )["document"]
            .clone(),
    )
    .unwrap();
    let mut previous_application = Counter(0);
    let mut previous_input = Counter(0);
    let mut first = None;
    for (index, part) in manifest["editions"].as_array().unwrap().iter().enumerate() {
        let history = read(directory.join(part["history"].as_str().unwrap()));
        let apps = history["applications"].as_array().unwrap();
        assert_eq!(apps.len(), 250);
        let journal: Vec<InputHistoryEntry> =
            serde_json::from_value(history["input_history"].clone()).unwrap();
        let wire = read(directory.join(part["checkpoint"].as_str().unwrap()));
        let sample = Counter((index as u64 + 1) * 240000);
        assert_eq!(wire["native_pair"]["audio"]["cursor"], json!(sample));
        let receipt = CheckpointReceipt {
            checkpoint_ref: format!("native:retained-workload/{}", index + 1),
            identity: performance.bases[0].identity.clone(),
            sample,
            basis_digest: performance.bases[0].content_digest.clone(),
            event_prefix_digest: performance.prefix_digest(sample.0).unwrap(),
            queued_events: vec![],
            acknowledged_stopped: true,
        };
        let checkpoint = CheckpointBinding::from_native_management(receipt, wire.clone()).unwrap();
        let state = NativeRecordState::from_checkpoint(&performance.bases[0], &checkpoint).unwrap();
        let prepared = prepare_recording(
            &performance,
            RecordAdmission {
                state: &state,
                basis: 0,
                layer: 0,
                previous_applied_application_ordinal: previous_application,
                expected_transport_epoch: Counter(1),
                previous_input_ordinal: previous_input,
                parameter_bindings: &bindings,
            },
            apps,
            &journal,
        )
        .unwrap();
        assert_eq!(prepared.receipts().len(), 250);
        previous_application = prepared.applied_application_ordinal();
        previous_input = journal.last().map_or(previous_input, |e| e.ordinal);
        let mut operations = prepared.record_operations();
        let prospective = prepared.prospective();
        let receipt = CheckpointReceipt {
            checkpoint_ref: format!("native:retained-workload/{}", index + 1),
            identity: prospective.bases[0].identity.clone(),
            sample,
            basis_digest: prospective.bases[0].content_digest.clone(),
            event_prefix_digest: prospective.prefix_digest(sample.0).unwrap(),
            queued_events: vec![],
            acknowledged_stopped: true,
        };
        let checkpoint = CheckpointBinding::from_native_management(receipt, wire).unwrap();
        operations.push(PerformanceOperation::Checkpoint {
            checkpoint: Box::new(checkpoint),
        });
        performance = performance.edited(operations.clone()).unwrap();
        let expected_act_revision = if index == 0 {
            None
        } else {
            invoke(
                &mut kernel,
                json!({"operation":"act_interrupt",
                "act_ref":"act:actual-native-recorded-fifteen-minute","actor":"agent:retained-workload",
                "reason":"Retain next actual callback passage"}),
                true,
            );
            Some(
                invoke(
                    &mut kernel,
                    json!({"operation":"act_retained_inspect",
                "act_ref":"act:actual-native-recorded-fifteen-minute"}),
                    true,
                )["act"]["revision"]
                    .as_u64()
                    .unwrap(),
            )
        };
        let updated = invoke(
            &mut kernel,
            json!({"operation":"act_retained_perform",
            "act_ref":"act:actual-native-recorded-fifteen-minute","expression_ref":document.expression_ref,
            "expected_revision":document.revision,"expected_act_revision":expected_act_revision,
            "actor":"agent:retained-workload","summary":"Retain original callback applications and physical checkpoint",
            "changes":[{"change":"scene_performance_edit","scene_ref":document.scenes[0].scene_ref,"operations":operations}]}),
            true,
        );
        assert_eq!(updated["state"], "act_running");
        assert_eq!(
            updated["act"]["sequence"].as_array().unwrap().len(),
            index + 1
        );
        document = serde_json::from_value(
            invoke(
                &mut kernel,
                json!({"operation":"inspect","expression_ref":document.expression_ref}),
                false,
            )["document"]
                .clone(),
        )
        .unwrap();
        assert_eq!(document.scenes[0].performance.as_ref(), Some(&performance));
        if index == 0 {
            first = Some(document.clone());
        }
    }
    assert_eq!(performance.event_count(), 45000);
    assert_eq!(previous_application, Counter(45000));
    assert_eq!(performance.native_recordings.len(), 180);
    let store = ActStore::at_home(&home);
    let act = store
        .read_retained("act:actual-native-recorded-fifteen-minute")
        .unwrap()
        .unwrap();
    assert_eq!(act.sequence.len(), 180);
    let custody = act.performance_custody.as_ref().unwrap();
    assert_eq!(custody.editions().len(), 180);
    assert!(matches!(store.write(&act, Some(act.revision - 1)).unwrap(),
        Written::Conflict { current: Some(revision) } if revision == act.revision));
    eprintln!(
        "actual committed45k Act bytes={} selected document={} retained Editions={}",
        serde_json::to_vec(&act).unwrap().len(),
        serde_json::to_vec(&document).unwrap().len(),
        act.sequence.len()
    );
    let bytes = expression_file::encode(&document).unwrap();
    assert!(bytes.len() <= expression_file::FILE_BYTES);
    assert_eq!(expression_file::decode(&bytes).unwrap(), document);
    assert!(custody.encoded_bytes().unwrap() <= expression_file::FILE_BYTES);
    let reopened = ActPerformanceCustody::read(custody.snapshot()).unwrap();
    assert_eq!(reopened.restore(0).unwrap(), first.unwrap());
    assert_eq!(reopened.restore(179).unwrap(), document);
    drop(kernel); // crash/restart equivalent: reopen SAME real native store/file
    let mut restarted = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    restarted.attach_act_store(&home).unwrap();
    invoke(
        &mut restarted,
        json!({"operation":"open","document":expression_file::decode(&bytes).unwrap(),
        "actor":"agent:retained-workload"}),
        false,
    );
    let first_document = reopened.restore(0).unwrap();
    invoke(
        &mut restarted,
        json!({"operation":"act_seek","act_ref":"act:actual-native-recorded-fifteen-minute",
        "position":0,"actor":"agent:retained-workload"}),
        true,
    );
    let first_reading: Document = serde_json::from_value(
        invoke(
            &mut restarted,
            json!({"operation":"inspect","expression_ref":document.expression_ref}),
            false,
        )["document"]
            .clone(),
    )
    .unwrap();
    assert_eq!(
        first_reading.scenes[0].performance,
        first_document.scenes[0].performance
    );
    invoke(
        &mut restarted,
        json!({"operation":"act_seek","act_ref":"act:actual-native-recorded-fifteen-minute",
        "position":179,"actor":"agent:retained-workload"}),
        true,
    );
    let last_reading: Document = serde_json::from_value(
        invoke(
            &mut restarted,
            json!({"operation":"inspect","expression_ref":document.expression_ref}),
            false,
        )["document"]
            .clone(),
    )
    .unwrap();
    assert_eq!(
        last_reading.scenes[0].performance,
        document.scenes[0].performance
    );
    invoke(
        &mut restarted,
        json!({"operation":"act_interrupt","act_ref":"act:actual-native-recorded-fifteen-minute",
        "actor":"agent:retained-workload","reason":"Continue original committed performance"}),
        true,
    );
    let current_act = invoke(
        &mut restarted,
        json!({"operation":"act_retained_inspect",
        "act_ref":"act:actual-native-recorded-fifteen-minute"}),
        true,
    );
    let continued = invoke(
        &mut restarted,
        json!({"operation":"act_retained_perform",
        "act_ref":"act:actual-native-recorded-fifteen-minute","expression_ref":last_reading.expression_ref,
        "expected_revision":last_reading.revision,"expected_act_revision":current_act["act"]["revision"],
        "actor":"agent:retained-workload","summary":"Continue restored callback receipt history",
        "changes":[{"change":"scene_performance_edit","scene_ref":last_reading.scenes[0].scene_ref,
            "operations":[{"operation":"seek","sample":"43199000"}]}]}),
        true,
    );
    assert_eq!(continued["state"], "act_running");
    assert_eq!(continued["act"]["sequence"].as_array().unwrap().len(), 181);
    let continued_document: Document = serde_json::from_value(
        invoke(
            &mut restarted,
            json!({"operation":"inspect","expression_ref":document.expression_ref}),
            false,
        )["document"]
            .clone(),
    )
    .unwrap();
    let continued_performance = continued_document.scenes[0].performance.as_ref().unwrap();
    assert_eq!(
        continued_performance.native_recordings,
        performance.native_recordings
    );
    assert_eq!(continued_performance.event_count(), 45000);
    assert_eq!(continued_performance.position_sample, Counter(43199000));
    assert_eq!(
        expression_file::decode(&expression_file::encode(&continued_document).unwrap()).unwrap(),
        continued_document
    );
    let seek = performance.seek_preparation(Counter(43199000)).unwrap();
    assert_eq!(seek.from_sample, Counter(42960000));
    assert_eq!(seek.target_sample, Counter(43199000));
    assert!(seek.checkpoint.unwrap().management.is_some());
    let mut corrupt = custody.snapshot();
    let catalog = corrupt.performance_catalogs.values_mut().next().unwrap();
    let before = catalog.parts.len();
    catalog.parts.retain(|p| {
        !matches!(
            p.part,
            oi_cradle_kernel::expression_performance_assets::PerformancePart::NativeRecording(_)
        )
    });
    assert!(catalog.parts.len() < before);
    assert!(ActPerformanceCustody::read(corrupt).is_err());
    assert_eq!(reopened.restore(179).unwrap(), document);
    std::fs::remove_dir_all(home).unwrap();
}

#[test]
fn genuine_accepted_future_score_occurrence_reconciles_once_without_inventing_played_history() {
    use oi_cradle_kernel::expression_performance_reservation::{
        reserve_checkpoint, ReservationStanding,
    };
    let (performance, prefix_checkpoint, prefix_apps, prefix_journal) =
        managed_order("release", false);
    let bindings = [ParameterBinding {
        native_parameter: 4,
        performance_parameter: 0,
    }];
    let state =
        NativeRecordState::from_checkpoint(&performance.bases[0], &prefix_checkpoint).unwrap();
    let prefix = prepare_recording(
        &performance,
        admission(&state, &bindings),
        &prefix_apps,
        &prefix_journal,
    )
    .unwrap();
    assert_eq!(prefix.receipts().len(), 2);
    let authored_future = TimedEvent(
        Counter(3),
        Counter(48000),
        0,
        0,
        EventAction::Parameter(0, scalar(0.2), None),
    );
    let authored = prefix
        .prospective()
        .edited(vec![PerformanceOperation::Record {
            events: vec![authored_future.clone()],
        }])
        .unwrap();
    let reservations = reserve_checkpoint(&authored, &prefix_checkpoint, &bindings).unwrap();
    assert_eq!(reservations.len(), 1);
    assert_eq!(reservations[0].native_sequence, Counter(2));
    assert_eq!(reservations[0].recorded_sequence, Counter(3));
    assert_eq!(reservations[0].original_occurrence, authored_future);
    let queued = authored
        .edited(vec![PerformanceOperation::ReserveNative { reservations }])
        .unwrap();
    assert_eq!(queued.native_reservations.len(), 1);
    assert_eq!(queued.native_recordings.len(), 1);
    assert_eq!(queued.event_count(), 3); // third is authored/queued, not a played receipt
    let (_, after_checkpoint, full_apps, full_journal) = managed_order("release", true);
    let state = NativeRecordState::from_checkpoint(&queued.bases[0], &after_checkpoint).unwrap();
    let applications: Vec<_> = full_apps
        .into_iter()
        .filter(|a| a["applied_application_ordinal"] == "3")
        .collect();
    let previous_input = prefix_journal.last().map_or(Counter(0), |e| e.ordinal);
    let journal: Vec<_> = full_journal
        .into_iter()
        .filter(|e| e.ordinal > previous_input)
        .collect();
    let reconciled = prepare_recording(
        &queued,
        RecordAdmission {
            state: &state,
            basis: 0,
            layer: 0,
            previous_applied_application_ordinal: Counter(2),
            expected_transport_epoch: Counter(1),
            previous_input_ordinal: previous_input,
            parameter_bindings: &bindings,
        },
        &applications,
        &journal,
    )
    .unwrap();
    assert_eq!(reconciled.prospective().event_count(), 3);
    assert!(reconciled.prospective().native_reservations.is_empty());
    assert_eq!(reconciled.receipts()[0].recorded_sequence, Some(Counter(3)));
    let resolved = reconciled.receipts()[0].reservation.as_ref().unwrap();
    assert_eq!(resolved.standing, ReservationStanding::Executed);
    assert_eq!(resolved.reservation.original_occurrence, authored_future);
    assert_eq!(resolved.reservation.native_sequence, Counter(2));
    assert_eq!(resolved.application_ordinal, Counter(3));
    assert_eq!(resolved.applied_sample, Counter(48000));
    assert_eq!(reconciled.prospective().native_recordings.len(), 1);
    assert!(queued
        .edited(vec![PerformanceOperation::RemoveEvent {
            sequence: Counter(3)
        }])
        .is_err());
    let mut changed = queued.native_reservations[0].clone();
    changed.native_operation["value"] = json!(0.3);
    assert!(changed
        .reconcile(&reconciled.receipts()[0].application)
        .is_err());
    assert!(reconciled
        .prospective()
        .edited(reconciled.record_operations())
        .is_err());
    let restored =
        oi_cradle_kernel::expression_performance_assets::PerformancePartCatalog::default()
            .appended(reconciled.prospective())
            .unwrap()
            .restore(0)
            .unwrap();
    assert_eq!(&restored, reconciled.prospective());
}

#[test]
fn genuine_reserved_automation_retains_original_route_after_reconciliation_and_later_edit() {
    use oi_cradle_kernel::expression_performance_reservation::reserve_checkpoint;
    let (performance, checkpoint, apps, journal) = managed_order("release", false);
    let bindings = [ParameterBinding {
        native_parameter: 4,
        performance_parameter: 0,
    }];
    let state = NativeRecordState::from_checkpoint(&performance.bases[0], &checkpoint).unwrap();
    let prefix =
        prepare_recording(&performance, admission(&state, &bindings), &apps, &journal).unwrap();
    let route = ModulationRoute {
        route_ref: "ql:retained-test/actual-master-route".into(),
        source: performance.bases[0].sources[0].clone(),
        source_unit: "normalized".into(),
        destination: performance.parameters[0].clone(),
        transfer: Transfer::Replace,
        amount: scalar(1.0),
        delay_samples: Counter(1000),
        feedback: false,
        enabled: true,
    };
    let authored = prefix
        .prospective()
        .edited(vec![
            PerformanceOperation::RouteSet {
                route: route.clone(),
            },
            PerformanceOperation::Record {
                events: vec![TimedEvent(
                    Counter(3),
                    Counter(47000),
                    0,
                    0,
                    EventAction::Automation(0, scalar(0.2), None),
                )],
            },
        ])
        .unwrap();
    let reservations = reserve_checkpoint(&authored, &checkpoint, &bindings).unwrap();
    assert_eq!(reservations[0].source_route.as_ref(), Some(&route));
    let queued = authored
        .edited(vec![PerformanceOperation::ReserveNative { reservations }])
        .unwrap();
    let mut next_route = route.clone();
    next_route.delay_samples = Counter(500);
    assert!(queued
        .edited(vec![PerformanceOperation::RouteSet {
            route: next_route.clone()
        }])
        .is_err());
    let (_, after, full_apps, full_journal) = managed_order("release", true);
    let after_state = NativeRecordState::from_checkpoint(&queued.bases[0], &after).unwrap();
    let previous_input = journal.last().map_or(Counter(0), |e| e.ordinal);
    let applications: Vec<_> = full_apps
        .into_iter()
        .filter(|a| a["applied_application_ordinal"] == "3")
        .collect();
    let later_journal: Vec<_> = full_journal
        .into_iter()
        .filter(|e| e.ordinal > previous_input)
        .collect();
    let applied = prepare_recording(
        &queued,
        RecordAdmission {
            state: &after_state,
            basis: 0,
            layer: 0,
            previous_applied_application_ordinal: Counter(2),
            expected_transport_epoch: Counter(1),
            previous_input_ordinal: previous_input,
            parameter_bindings: &bindings,
        },
        &applications,
        &later_journal,
    )
    .unwrap();
    let edited = applied
        .prospective()
        .edited(vec![PerformanceOperation::RouteSet { route: next_route }])
        .unwrap();
    edited.validate().unwrap();
    let catalog =
        oi_cradle_kernel::expression_performance_assets::PerformancePartCatalog::default()
            .appended(&edited)
            .unwrap();
    assert_eq!(catalog.restore(0).unwrap(), edited);
}

#[test]
fn genuine_native_restore_cancellation_and_explicit_application_loss_preserve_evidence_without_played_events(
) {
    use oi_cradle_kernel::expression_performance_recording::NativeRecordingPage;
    use oi_cradle_kernel::expression_performance_reservation::*;
    let directory = std::path::PathBuf::from(
        std::env::var("QL_RETAINED_PERFORMANCE_RESERVATION_DIRECTORY")
            .expect("normal gate must execute actual native cancellation and queue-loss producer"),
    );
    let bindings = [ParameterBinding {
        native_parameter: 4,
        performance_parameter: 0,
    }];
    for kind in ["cancel", "lost"] {
        let (base, _, _, _) = actual();
        let occurrence = TimedEvent(
            Counter(42),
            Counter(1000),
            0,
            0,
            EventAction::Parameter(0, scalar(0.2), None),
        );
        let authored = base
            .edited(vec![PerformanceOperation::Record {
                events: vec![occurrence.clone()],
            }])
            .unwrap();
        let before_wire = read(directory.join(format!("{kind}.before.json")));
        let before_sample = serde_json::from_value::<Counter>(
            before_wire["native_pair"]["audio"]["cursor"].clone(),
        )
        .unwrap();
        let before_receipt = CheckpointReceipt {
            checkpoint_ref: format!("native:reservation/{kind}/before"),
            identity: authored.bases[0].identity.clone(),
            sample: before_sample,
            basis_digest: authored.bases[0].content_digest.clone(),
            event_prefix_digest: authored.prefix_digest(before_sample.0).unwrap(),
            queued_events: vec![QueuedEventReceipt {
                native_sequence: Counter(1),
                recorded_sequence: Counter(42),
                effective_sample: Counter(1000),
            }],
            acknowledged_stopped: true,
        };
        let before =
            CheckpointBinding::from_native_management(before_receipt, before_wire).unwrap();
        let reservations = reserve_checkpoint(&authored, &before, &bindings).unwrap();
        let queued = authored
            .edited(vec![PerformanceOperation::ReserveNative { reservations }])
            .unwrap();
        assert_eq!(queued.native_reservations.len(), 1);
        let after_wire = read(directory.join(format!("{kind}.after.json")));
        let after_sample =
            serde_json::from_value::<Counter>(after_wire["native_pair"]["audio"]["cursor"].clone())
                .unwrap();
        let after_receipt = CheckpointReceipt {
            checkpoint_ref: if kind == "cancel" {
                "native:reservation/initial".into()
            } else {
                "native:reservation/lost/after".into()
            },
            identity: authored.bases[0].identity.clone(),
            sample: after_sample,
            basis_digest: authored.bases[0].content_digest.clone(),
            event_prefix_digest: authored.prefix_digest(after_sample.0).unwrap(),
            queued_events: vec![],
            acknowledged_stopped: true,
        };
        let after = CheckpointBinding::from_native_management(after_receipt, after_wire).unwrap();
        let termination = if kind == "cancel" {
            let ack: NativeTransportAcknowledgement =
                serde_json::from_value(read(directory.join("cancel.ack.json"))).unwrap();
            assert_eq!(ack.previous_cursor, Counter(128));
            assert_eq!(ack.target_sample, Counter(0));
            NativeReservationTermination::cancelled(&queued, before, after, ack).unwrap()
        } else {
            assert_eq!(after.audio["applied_application_ordinal"], "257");
            assert_eq!(after.audio["recording"]["first_failed_sequence"], "1");
            assert_eq!(after.audio["recording"]["dropped_applications"], "1");
            NativeReservationTermination::lost(&queued, before, after).unwrap()
        };
        assert_eq!(termination.reservations[0].original_occurrence, occurrence);
        let page = NativeRecordingPage::from_termination(&queued, termination.clone()).unwrap();
        let wire = serde_json::to_value(&page).unwrap();
        let decoded = serde_json::from_value::<
            oi_cradle_kernel::expression_performance_codec::EncodedPage,
        >(wire["encoded"].clone())
        .unwrap()
        .bytes()
        .unwrap();
        let original_bytes = serde_json::to_vec(&termination).unwrap();
        let legacy_terminated = [
            br#"{"kind":"terminated","value":"#.as_slice(),
            original_bytes.as_slice(),
            b"}",
        ]
        .concat();
        assert_eq!(decoded, legacy_terminated,
            "real cancellation/loss must preserve original native checkpoint/input/occurrence bytes");
        let reopened: NativeRecordingPage = serde_json::from_value(wire).unwrap();
        assert_eq!(reopened.termination().unwrap(), Some(termination.clone()));
        let completed = queued
            .edited(vec![PerformanceOperation::RecordNative {
                events: vec![],
                page,
            }])
            .unwrap();
        assert!(completed.native_reservations.is_empty());
        assert_eq!(completed.event_count(), 0);
        assert_eq!(completed.native_recordings.len(), 1);
        let retained = completed.native_recordings[0]
            .termination()
            .unwrap()
            .unwrap();
        assert_eq!(retained, termination);
        let restored =
            oi_cradle_kernel::expression_performance_assets::PerformancePartCatalog::default()
                .appended(&completed)
                .unwrap()
                .restore(0)
                .unwrap();
        assert_eq!(restored, completed);
        let current = completed
            .bases
            .iter()
            .flat_map(|b| {
                b.sources
                    .iter()
                    .chain(&b.required_assets)
                    .chain([&b.context.context, &b.context.receiver])
                    .chain(b.context.source_occasion.iter())
                    .chain(b.context.protected_state.iter())
                    .chain(b.context.consent.iter())
            })
            .map(|r| (r.r#ref.clone(), r.clone()))
            .collect();
        let ready = completed.readiness(&current, false).unwrap();
        if kind == "lost" {
            assert!(!ready.ready);
            assert!(ready
                .issues
                .iter()
                .any(|r| r.kind == "native_applied_recording_loss"));
        }
        let mut wrong = termination.clone();
        wrong.after.identity.instance_ref = "expression:another-instance".into();
        assert!(NativeRecordingPage::from_termination(&queued, wrong).is_err());
        let mut wrong = termination.clone();
        wrong.reservations[0].recorded_sequence = Counter(43);
        assert!(NativeRecordingPage::from_termination(&queued, wrong).is_err());
        if let Some(ack) = termination.transport_ack.as_ref() {
            let mut wrong = termination.clone();
            wrong.transport_ack.as_mut().unwrap().epoch = ack.previous_epoch;
            assert!(NativeRecordingPage::from_termination(&queued, wrong).is_err());
        }
    }
}

#[test]
fn actual_native_receipt_codec_preserves_decimal_counters_binary64_and_refuses_corruption_before_expansion(
) {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use oi_cradle_kernel::expression_performance_codec::EncodedPage;
    let (_, checkpoint, applications, journal) = actual();
    let original = json!({"applications":applications,"original_input_journal":journal,"checkpoint":checkpoint});
    let encoded = EncodedPage::from_value(&original).unwrap();
    assert_eq!(encoded.read::<Value>().unwrap(), original);
    let original_bytes = serde_json::to_vec(&original).unwrap();
    assert_eq!(encoded.bytes().unwrap(), original_bytes);
    for failure in 0..4 {
        let mut wire = serde_json::to_value(&encoded).unwrap();
        match failure {
            0 => wire["decoded_bytes"] = json!(4 * 1024 * 1024 + 1),
            1 => wire["payload"] = json!(STANDARD.encode([1, 0, 0, 8, 0])),
            2 => wire["payload"] = json!(STANDARD.encode([0, 8, 0, b'{'])),
            _ => wire["decoded_sha256"] = json!(format!("sha256:{}", "0".repeat(64))),
        }
        let corrupt: EncodedPage = serde_json::from_value(wire).unwrap();
        assert!(corrupt.bytes().is_err());
    }
    assert_eq!(encoded.read::<Value>().unwrap(), original);
    let exact = json!({"maximum_native_cursor":"18446744073709551615","phase":0.12345678901234567,"velocity":-0.0,"empty":[]});
    assert_eq!(
        EncodedPage::from_value(&exact).unwrap().bytes().unwrap(),
        serde_json::to_vec(&exact).unwrap()
    );
}

#[test]
fn genuine_recorded_passage_professional_edits_use_native_act_restore_file_and_continue() {
    use oi_cradle_kernel::{
        expression::Document, expression_act_store::ActStore, expression_file, flow::CentralClient,
        Kernel, KernelOp, KernelOpResult,
    };
    fn invoke(kernel: &mut Kernel, value: Value, world: bool) -> Value {
        let operation = if world {
            KernelOp::ExpressionWorld {
                request: serde_json::from_value(value).unwrap(),
            }
        } else {
            KernelOp::Expression {
                request: serde_json::from_value(value).unwrap(),
            }
        };
        match kernel.apply(operation).unwrap().result {
            KernelOpResult::Expression { data } | KernelOpResult::ExpressionWorld { data } => data,
            _ => panic!("actual native Expression/Act result required"),
        }
    }
    fn document(kernel: &mut Kernel) -> Document {
        serde_json::from_value(invoke(kernel,
            json!({"operation":"inspect","expression_ref":"expression:professional-native/current"}),
            false)["document"].clone()).unwrap()
    }
    fn passage(
        kernel: &mut Kernel,
        operations: Vec<PerformanceOperation>,
        first: bool,
    ) -> Document {
        let d = document(kernel);
        let expected_act = if first {
            None
        } else {
            invoke(
                kernel,
                json!({"operation":"act_interrupt","act_ref":"act:professional-native",
                "actor":"agent:professional-native","reason":"Retain the next authored edition"}),
                true,
            );
            Some(
                invoke(
                    kernel,
                    json!({"operation":"act_retained_inspect","act_ref":"act:professional-native"}),
                    true,
                )["act"]["revision"]
                    .as_u64()
                    .unwrap(),
            )
        };
        let result = invoke(
            kernel,
            json!({"operation":"act_retained_perform",
            "act_ref":"act:professional-native","expression_ref":d.expression_ref,
            "expected_revision":d.revision,"expected_act_revision":expected_act,
            "actor":"agent:professional-native","summary":"Retain exact native performance material",
            "changes":[{"change":"scene_performance_edit","scene_ref":d.scenes[0].scene_ref,
                "operations":operations}]}),
            true,
        );
        assert_eq!(result["state"], "act_running");
        document(kernel)
    }
    let (original, actual_checkpoint, applications, journal) = actual();
    let state = NativeRecordState::from_checkpoint(&original.bases[0], &actual_checkpoint).unwrap();
    let bindings = [ParameterBinding {
        native_parameter: 4,
        performance_parameter: 0,
    }];
    let recorded = prepare_recording(
        &original,
        admission(&state, &bindings),
        &applications,
        &journal,
    )
    .unwrap();
    let original_receipts = recorded.prospective().native_recordings.clone();
    let mut cp_receipt = CheckpointReceipt {
        checkpoint_ref: "native:professional/actual-cursor384".into(),
        identity: original.bases[0].identity.clone(),
        sample: Counter(384),
        basis_digest: original.bases[0].content_digest.clone(),
        event_prefix_digest: recorded.prospective().prefix_digest(384).unwrap(),
        queued_events: vec![],
        acknowledged_stopped: true,
    };
    let checkpoint = CheckpointBinding::from_native_management(
        cp_receipt.clone(),
        actual_checkpoint.native_management_wire().unwrap(),
    )
    .unwrap();
    let home = std::path::PathBuf::from(
        std::env::var("OI_RETAINED_PERFORMANCE_TEST_HOME")
            .expect("mandatory native fixture gate must provide unique Act custody"),
    )
    .join(format!("professional-native-act-{}", std::process::id()));
    assert!(!home.exists(), "preserve previous native test custody");
    let mut kernel = Kernel::new(CentralClient::discover());
    kernel.attach_act_store(&home).unwrap();
    invoke(
        &mut kernel,
        json!({"operation":"create","expression_ref":"expression:professional-native/current",
        "title":"Professional retained native passage","actor":"agent:professional-native"}),
        false,
    );
    let d = document(&mut kernel);
    invoke(
        &mut kernel,
        json!({"operation":"edit","expression_ref":d.expression_ref,
        "expected_revision":d.revision,"actor":"agent:professional-native",
        "changes":[{"change":"scene_performance_set","scene_ref":d.scenes[0].scene_ref,"performance":original}]}),
        false,
    );
    let mut record_ops = recorded.record_operations();
    record_ops.push(PerformanceOperation::Checkpoint {
        checkpoint: Box::new(checkpoint),
    });
    let performed = passage(&mut kernel, record_ops, true);
    let performed_performance = performed.scenes[0].performance.as_ref().unwrap();
    assert_eq!(performed_performance.event_count(), 4);
    assert_eq!(performed_performance.native_recordings, original_receipts);
    assert_eq!(performed_performance.checkpoints[0].sample, Counter(384));

    let native_note = recorded.receipts()[0].application.note.as_ref().unwrap();
    let touch = Counter(native_note.touch.0.checked_add(1).unwrap());
    let member = Counter(native_note.member.0.checked_add(1).unwrap());
    let next_sequence = recorded
        .receipts()
        .iter()
        .filter_map(|r| r.recorded_sequence)
        .max()
        .unwrap()
        .0
        .checked_add(1)
        .unwrap();
    let note_on = TimedEvent(
        Counter(next_sequence),
        Counter(1000),
        0,
        0,
        EventAction::NoteOn(
            touch,
            member,
            0,
            scalar(0.6),
            native_note.phase_sin,
            native_note.phase_cos,
        ),
    );
    let release = TimedEvent(
        Counter(next_sequence + 1),
        Counter(1500),
        0,
        0,
        EventAction::NoteOff(touch),
    );
    let layer = Layer {
        layer_ref: "layer:professional-overdub".into(),
        title: "Authored overdub".into(),
        enabled: true,
        solo: false,
    };
    let overdub = passage(
        &mut kernel,
        vec![PerformanceOperation::Overdub {
            layer: layer.clone(),
            events: vec![note_on, release.clone()],
        }],
        false,
    );
    assert_eq!(
        overdub.scenes[0]
            .performance
            .as_ref()
            .unwrap()
            .event_count(),
        6
    );
    assert_eq!(
        overdub.scenes[0]
            .performance
            .as_ref()
            .unwrap()
            .native_recordings,
        original_receipts
    );
    let mut moved_release = release;
    moved_release.1 = Counter(1600);
    moved_release.2 = 1;
    let route = ModulationRoute {
        route_ref: "route:professional-master".into(),
        source: original.bases[0].sources[0].clone(),
        source_unit: "linear".into(),
        destination: original.parameters[0].clone(),
        transfer: Transfer::Replace,
        amount: scalar(1.0),
        delay_samples: Counter(64),
        feedback: false,
        enabled: true,
    };
    let edited = passage(
        &mut kernel,
        vec![
            PerformanceOperation::EditEvent {
                sequence: Counter(next_sequence + 1),
                replacement: moved_release,
            },
            PerformanceOperation::RouteSet {
                route: route.clone(),
            },
            PerformanceOperation::Automate {
                route_index: 0,
                events: vec![TimedEvent(
                    Counter(next_sequence + 2),
                    Counter(1200),
                    0,
                    0,
                    EventAction::Automation(0, scalar(0.23), None),
                )],
            },
            PerformanceOperation::Loop {
                range: Some(LoopRange {
                    from_sample: Counter(900),
                    to_sample: Counter(1700),
                }),
            },
            PerformanceOperation::Seek {
                sample: Counter(384),
            },
            PerformanceOperation::Tempo {
                segments: vec![TempoSegment {
                    at_sample: Counter(0),
                    at_tick: Counter(0),
                    micros_per_quarter: 600000,
                }],
            },
        ],
        false,
    );
    let edited_performance = edited.scenes[0].performance.as_ref().unwrap();
    assert_eq!(edited_performance.event_count(), 7);
    assert_eq!(edited_performance.native_recordings, original_receipts);
    assert_eq!(edited_performance.bases, original.bases);
    assert_eq!(edited_performance.pitches, original.pitches);
    assert_eq!(
        edited_performance.checkpoints[0]
            .native_management_wire()
            .unwrap(),
        actual_checkpoint.native_management_wire().unwrap()
    );
    assert_eq!(edited_performance.checkpoints[0].sample, Counter(384));
    assert_eq!(edited_performance.tick_at(48000).unwrap(), 1600);
    let readings = |p: &Performance| {
        let b = &p.bases[0];
        b.sources
            .iter()
            .chain(&b.required_assets)
            .chain([&b.context.context, &b.context.receiver])
            .chain(p.routes.iter().map(|r| &r.source))
            .map(|r| (r.r#ref.clone(), r.clone()))
            .collect()
    };
    let cursor = |p: &Performance| ReplayCursor {
        instance_ref: p.bases[0].identity.instance_ref.clone(),
        event_ref: p.bases[0].identity.event_ref.clone(),
        subject_ref: p.bases[0].identity.subject_ref.clone(),
        sample: Counter(1200),
        last_sequence: Counter(100),
        checkpoint_digest: None,
    };
    let plan =
        ReplayPlan::prepare(edited_performance, &readings(edited_performance), false).unwrap();
    let routed = plan
        .prepare_window(&cursor(edited_performance), 128)
        .unwrap();
    assert_eq!(routed.operations.len(), 1);
    assert_eq!(routed.operations[0].sample, Counter(1264));
    assert_eq!(
        routed.operations[0].recorded_sequence,
        Counter(next_sequence + 2)
    );
    assert!(
        matches!(&routed.operations[0].native,NativeOperation::Parameter { value,route_ref:Some(r),.. }
        if *value==scalar(0.23) && r==&route.route_ref)
    );
    let mut muted = layer.clone();
    muted.enabled = false;
    let muted_document = passage(
        &mut kernel,
        vec![
            PerformanceOperation::LayerSet {
                index: 1,
                layer: muted,
            },
            PerformanceOperation::RouteClear {
                route_ref: route.route_ref.clone(),
            },
        ],
        false,
    );
    let muted_performance = muted_document.scenes[0].performance.as_ref().unwrap();
    let mut whole_cursor = cursor(muted_performance);
    whole_cursor.sample = Counter(900);
    assert!(
        ReplayPlan::prepare(muted_performance, &readings(muted_performance), false)
            .unwrap()
            .prepare_window(&whole_cursor, 1000)
            .unwrap()
            .operations
            .is_empty()
    );
    assert_eq!(muted_performance.native_recordings, original_receipts);

    // Actual native Restore is the existing Application's undo/redo operation;
    // each change advances its CAS revision, while the exact older material and
    // original callback receipts are restored rather than relabelled as new play.
    let undo = invoke(
        &mut kernel,
        json!({"operation":"restore","expression_ref":edited.expression_ref,
        "expected_revision":muted_document.revision,"document":edited,"actor":"agent:professional-native"}),
        false,
    );
    let undo_document: Document = serde_json::from_value(undo["document"].clone()).unwrap();
    assert_eq!(
        undo_document.scenes[0].performance,
        edited.scenes[0].performance
    );
    assert!(undo_document.revision > muted_document.revision);
    let redo = invoke(
        &mut kernel,
        json!({"operation":"restore","expression_ref":edited.expression_ref,
        "expected_revision":undo_document.revision,"document":muted_document,"actor":"agent:professional-native"}),
        false,
    );
    let redo_document: Document = serde_json::from_value(redo["document"].clone()).unwrap();
    assert_eq!(
        redo_document.scenes[0].performance,
        muted_document.scenes[0].performance
    );
    let stale = invoke(
        &mut kernel,
        json!({"operation":"restore","expression_ref":edited.expression_ref,
        "expected_revision":undo_document.revision,"document":edited,"actor":"agent:stale"}),
        false,
    );
    assert_eq!(stale["state"], "revision_conflict");
    assert_eq!(document(&mut kernel), redo_document);

    // Changes before this genuine checkpoint require an actual owner rebuild.
    // Editing the past cannot silently carry forward old q/v or ringing voices.
    let before = serde_json::to_vec(&redo_document).unwrap();
    let parameter_sequence = recorded.receipts()[2].recorded_sequence.unwrap();
    let refused=kernel.apply(KernelOp::Expression { request:serde_json::from_value(json!({
        "operation":"edit","expression_ref":redo_document.expression_ref,"expected_revision":redo_document.revision,
        "actor":"agent:professional-native","changes":[{"change":"scene_performance_edit",
        "scene_ref":redo_document.scenes[0].scene_ref,"operations":[{"operation":"edit_event",
        "sequence":parameter_sequence,"replacement":TimedEvent(parameter_sequence,Counter(149),0,0,
            EventAction::Parameter(0,scalar(0.8),None))}]}]})).unwrap() });
    assert!(refused.is_err());
    assert_eq!(serde_json::to_vec(&document(&mut kernel)).unwrap(), before);

    let export = invoke(
        &mut kernel,
        json!({"operation":"export","expression_ref":redo_document.expression_ref,
        "expected_revision":redo_document.revision}),
        false,
    );
    assert_eq!(export["state"], "exported");
    assert_eq!(export["audience"], "local_private");
    assert_eq!(export["dynamic_checkpoint"], false);
    let exported: Document = serde_json::from_value(export["document"].clone()).unwrap();
    assert_eq!(exported, redo_document);
    let encoded = expression_file::encode(&exported).unwrap();
    let file = home.join("professional.expression.json");
    std::fs::write(&file, encoded.as_bytes()).unwrap();
    let disk = std::fs::read_to_string(&file).unwrap();
    assert_eq!(expression_file::decode(&disk).unwrap(), redo_document);
    let close = invoke(
        &mut kernel,
        json!({"operation":"close","expression_ref":redo_document.expression_ref,
        "actor":"agent:professional-native"}),
        false,
    );
    assert_eq!(close["state"], "dirty");
    assert_eq!(document(&mut kernel), redo_document);
    // No false Save acknowledgement: the local native file-codec/Act proof is
    // separate from the ordinary Central files save/close owner consumer.
    let store = ActStore::at_home(&home);
    let act = store
        .read_retained("act:professional-native")
        .unwrap()
        .unwrap();
    assert_eq!(act.sequence.len(), 4);
    for (index, expected) in [&performed, &overdub, &edited, &muted_document]
        .iter()
        .enumerate()
    {
        assert_eq!(
            act.performance_custody
                .as_ref()
                .unwrap()
                .restore(index)
                .unwrap(),
            **expected
        );
    }
    drop(kernel);
    let mut reopened = Kernel::new(CentralClient::discover());
    reopened.attach_act_store(&home).unwrap();
    invoke(
        &mut reopened,
        json!({"operation":"open","document":expression_file::decode(&disk).unwrap(),
        "actor":"agent:professional-native"}),
        false,
    );
    assert_eq!(document(&mut reopened), redo_document);
    let continued = passage(
        &mut reopened,
        vec![
            PerformanceOperation::LayerSet { index: 1, layer },
            PerformanceOperation::RouteSet { route },
            PerformanceOperation::Seek {
                sample: Counter(384),
            },
        ],
        false,
    );
    let continuation = continued.scenes[0].performance.as_ref().unwrap();
    assert_eq!(continuation.native_recordings, original_receipts);
    assert_eq!(continuation.event_count(), 7);
    assert_eq!(continuation.position_sample, Counter(384));
    assert_eq!(
        continuation
            .seek_preparation(Counter(384))
            .unwrap()
            .from_sample,
        Counter(384)
    );
    assert_eq!(
        continuation.checkpoints[0]
            .native_management_wire()
            .unwrap(),
        actual_checkpoint.native_management_wire().unwrap()
    );
    let actual_after = store
        .read_retained("act:professional-native")
        .unwrap()
        .unwrap();
    assert_eq!(actual_after.sequence.len(), 5);
    assert_eq!(
        actual_after
            .performance_custody
            .as_ref()
            .unwrap()
            .restore(4)
            .unwrap(),
        continued
    );
    // No new authored note/automation is an actual application yet.
    let batch = serde_json::to_value(continuation.native_recordings[0].batch().unwrap()).unwrap();
    assert_eq!(batch["receipts"].as_array().unwrap().len(), 4);
    assert_eq!(
        batch["receipts"][3]["application"]["applied_application_ordinal"],
        "4"
    );
    cp_receipt.event_prefix_digest = continuation.prefix_digest(384).unwrap();
    assert_eq!(
        cp_receipt.event_prefix_digest,
        continuation.checkpoints[0].event_prefix_digest
    );
    std::fs::remove_dir_all(home).unwrap();
}
