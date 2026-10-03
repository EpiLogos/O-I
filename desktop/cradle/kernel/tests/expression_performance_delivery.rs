//! Actual callback applications/journal/checkpoint, produced by the mandatory
//! native gate. Authored score operands do not substitute for these artifacts.
use oi_cradle_kernel::expression_performance::*;
use oi_cradle_kernel::expression_performance_delivery::{SelectedPerformance, Selection};
use oi_cradle_kernel::expression_performance_management::InputHistoryEntry;
use oi_cradle_kernel::expression_performance_recording::{
    prepare_recording, NativeRecordState, ParameterBinding, RecordAdmission,
};
use oi_cradle_kernel::expression_performance_source_asset::NativePerformanceSourceAsset;
use oi_cradle_kernel::{
    expression::Document, expression_act_store::ActStore, expression_world::Act,
    flow::CentralClient, Kernel, KernelOp, KernelOpResult,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

fn invoke(kernel: &mut Kernel, value: Value, world: bool) -> Value {
    let op = if world {
        KernelOp::ExpressionWorld {
            request: serde_json::from_value(value).unwrap(),
        }
    } else {
        KernelOp::Expression {
            request: serde_json::from_value(value).unwrap(),
        }
    };
    match kernel.apply(op).unwrap().result {
        KernelOpResult::Expression { data } | KernelOpResult::ExpressionWorld { data } => data,
        _ => panic!("real native Expression/Act reply required"),
    }
}
fn native_act(
    original: &Performance,
    operations: Vec<PerformanceOperation>,
    name: &str,
) -> (Act, Document, Kernel) {
    let home = std::path::PathBuf::from(
        std::env::var("OI_RETAINED_PERFORMANCE_TEST_HOME")
            .expect("actual normal fixture gate must supply unique native Act custody"),
    )
    .join(format!("delivery-{name}-{}", std::process::id()));
    assert!(!home.exists(), "retain prior actual native fixture custody");
    let mut kernel = Kernel::new(CentralClient::discover());
    kernel.attach_act_store(&home).unwrap();
    invoke(
        &mut kernel,
        json!({"operation":"create","expression_ref":"expression:native-delivery-current",
        "title":"Actual retained delivery","actor":"agent:native-delivery"}),
        false,
    );
    let inspect = |kernel: &mut Kernel| -> Document {
        serde_json::from_value(
            invoke(
                kernel,
                json!({"operation":"inspect",
            "expression_ref":"expression:native-delivery-current"}),
                false,
            )["document"]
                .clone(),
        )
        .unwrap()
    };
    let d = inspect(&mut kernel);
    invoke(
        &mut kernel,
        json!({"operation":"edit","expression_ref":d.expression_ref,
        "expected_revision":d.revision,"actor":"agent:native-delivery",
        "changes":[{"change":"scene_performance_set","scene_ref":d.scenes[0].scene_ref,"performance":original}]}),
        false,
    );
    let d = inspect(&mut kernel);
    let result = invoke(
        &mut kernel,
        json!({"operation":"act_retained_perform","act_ref":"act:native-delivery",
        "expression_ref":d.expression_ref,"expected_revision":d.revision,"expected_act_revision":null,
        "actor":"agent:native-delivery","summary":"Deliver complete native retained score and receipt custody",
        "changes":[{"change":"scene_performance_edit","scene_ref":d.scenes[0].scene_ref,"operations":operations}]}),
        true,
    );
    assert_eq!(result["state"], "act_running");
    let document = inspect(&mut kernel);
    let act = ActStore::at_home(&home)
        .read_retained("act:native-delivery")
        .unwrap()
        .unwrap();
    (act, document, kernel)
}
fn selection(act: &Act, document: &Document) -> Selection {
    Selection {
        expected_act_revision: act.revision,
        edition_position: 0,
        scene_ref: document.scenes[0].scene_ref.clone(),
        expected_expression_revision: document.revision,
        expected_scene_revision: document.scenes[0].revision,
        performance_digest: document.scenes[0]
            .performance
            .as_ref()
            .unwrap()
            .fingerprint()
            .unwrap(),
    }
}

#[test]
fn actual_native_act_delivery_preserves_encoded_original_bytes_decoded_applications_and_current_score(
) {
    use oi_cradle_kernel::expression_performance_assets::PerformancePart;
    let (original, cp, applications, journal) = actual();
    let state = NativeRecordState::from_checkpoint(&original.bases[0], &cp).unwrap();
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
    let (act, document, mut kernel) =
        native_act(&original, recorded.record_operations(), "applied");
    let request = selection(&act, &document);
    let selected = SelectedPerformance::from_act(&act, &request).unwrap();
    assert_eq!(selected.document(), &document);
    let payload = selected.native_payload().unwrap();
    let exact = serde_json::to_vec(selected.performance()).unwrap();
    assert_eq!(
        payload["canonical_performance_bytes"]
            .as_str()
            .unwrap()
            .as_bytes(),
        exact
    );
    assert_eq!(
        payload["selected_performance_sha256"],
        format!("sha256:{:x}", Sha256::digest(&exact))
    );
    assert_eq!(
        serde_json::from_slice::<Value>(&exact).unwrap(),
        payload["performance"]
    );
    if !selected.performance().native_recordings.is_empty() {
        let mut dropped = payload.clone();
        dropped["performance"]["native_recordings"]
            .as_array_mut()
            .unwrap()
            .remove(0);
        dropped["native_recording_parts"]
            .as_array_mut()
            .unwrap()
            .remove(0);
        for (index, witness) in dropped["native_recording_parts"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .enumerate()
        {
            witness["page_index"] = json!(index);
        }
        assert_eq!(
            dropped["canonical_performance_bytes"],
            payload["canonical_performance_bytes"]
        );
        assert_eq!(
            dropped["selected_performance_sha256"],
            payload["selected_performance_sha256"]
        );
        assert_ne!(dropped["performance"], serde_json::from_slice::<Value>(&exact).unwrap(), "retained complete bytes detect prefix omission independently of a copied fingerprint label");
    }
    for (index, checkpoint) in selected.performance().checkpoints.iter().enumerate() {
        let delivered = selected.native_checkpoint(index).unwrap();
        assert_eq!(
            delivered["checkpoint"],
            serde_json::to_value(checkpoint).unwrap()
        );
        assert_eq!(
            delivered["native_management_wire"],
            checkpoint.native_management_wire().unwrap()
        );
        let native = delivered["canonical_native_wire_bytes"].as_str().unwrap();
        assert_eq!(
            delivered["native_wire_sha256"],
            format!("sha256:{:x}", Sha256::digest(native.as_bytes()))
        );
        assert_eq!(
            serde_json::from_str::<Value>(native).unwrap(),
            delivered["native_management_wire"]
        );
        let part = delivered["canonical_part_bytes"].as_str().unwrap();
        let typed = oi_cradle_kernel::expression_performance_assets::PerformancePart::Checkpoint(
            Box::new(checkpoint.clone()),
        );
        assert_eq!(part.as_bytes(), serde_json::to_vec(&typed).unwrap());
        assert_eq!(
            delivered["reading"]["ref"],
            format!("sha256:{:x}", Sha256::digest(part.as_bytes()))
        );
    }
    assert!(selected
        .native_checkpoint(selected.performance().checkpoints.len())
        .is_err());
    assert_eq!(
        invoke(
            &mut kernel,
            json!({"operation":"act_retained_delivery",
        "act_ref":act.act_ref,"selection":request,"native_page":null}),
            true
        ),
        payload
    );
    assert_eq!(
        invoke(
            &mut kernel,
            json!({"operation":"act_retained_delivery",
        "act_ref":act.act_ref,"selection":request,"native_page":0}),
            true
        ),
        selected.native_page(0).unwrap()
    );

    assert_eq!(
        payload["performance"],
        serde_json::to_value(selected.performance()).unwrap()
    );
    assert_eq!(
        payload["original_episodes"][0]["original_episode"],
        Value::Null
    );
    assert_eq!(
        payload["original_episodes"][0]["identity"],
        serde_json::to_value(&original.bases[0].identity).unwrap()
    );
    let mut count = 0;
    for (index, page) in selected.performance().native_recordings.iter().enumerate() {
        let delivered = selected.native_page(index).unwrap();
        let original_part =
            serde_json::to_vec(&PerformancePart::NativeRecording(page.clone())).unwrap();
        let part_bytes = delivered["witness"]["canonical_part_bytes"]
            .as_str()
            .unwrap()
            .as_bytes();
        assert_eq!(part_bytes, original_part);
        assert_eq!(
            delivered["witness"]["reading"]["ref"],
            format!("sha256:{:x}", Sha256::digest(part_bytes))
        );
        let decoded = delivered["canonical_decoded_bytes"]
            .as_str()
            .unwrap()
            .as_bytes();
        assert_eq!(decoded, page.canonical_decoded_bytes().unwrap());
        assert_eq!(
            delivered["witness"]["decoded_length"],
            json!(decoded.len().to_string())
        );
        assert_eq!(
            delivered["witness"]["decoded_sha256"],
            format!("sha256:{:x}", Sha256::digest(decoded))
        );
        assert_eq!(
            delivered["decoded"],
            serde_json::from_slice::<Value>(decoded).unwrap()
        );
        assert_eq!(
            delivered["original_encoded_page"],
            serde_json::to_value(page).unwrap()
        );
        for receipt in delivered["decoded"]["value"]["receipts"]
            .as_array()
            .unwrap()
        {
            assert_eq!(receipt["application"], applications[count]);
            count += 1;
        }
        assert_eq!(
            payload["native_recording_parts"][index],
            delivered["witness"]
        );
    }
    assert_eq!(count, 4);
    assert_eq!(selected.performance().event_count(), 4);
    assert!(selected.native_page(count).is_err());
    for changed in [
        Selection {
            expected_act_revision: request.expected_act_revision + 1,
            ..request.clone()
        },
        Selection {
            expected_scene_revision: request.expected_scene_revision + 1,
            ..request.clone()
        },
        Selection {
            expected_expression_revision: request.expected_expression_revision + 1,
            ..request.clone()
        },
        Selection {
            edition_position: 1,
            ..request.clone()
        },
        Selection {
            performance_digest: format!("sha256:{}", "0".repeat(64)),
            ..request.clone()
        },
    ] {
        assert!(SelectedPerformance::from_act(&act, &changed).is_err());
    }
    // Full exact native companion reopens through the SAME Act codec before
    // another score/export consumer reads any selected edition.
    let bytes = oi_cradle_kernel::expression_performance_act::encode(&act).unwrap();
    let reopened =
        oi_cradle_kernel::expression_performance_act::decode_bytes(&bytes, 64 * 1024 * 1024)
            .unwrap();
    assert_eq!(
        SelectedPerformance::from_act(&reopened, &request)
            .unwrap()
            .native_payload()
            .unwrap(),
        payload
    );
    if let Some(directory) = std::env::var_os("OI_NATIVE_PERFORMANCE_DELIVERY_DIRECTORY") {
        let directory = std::path::PathBuf::from(directory).join("applied-native-act");
        assert!(!directory.exists());
        std::fs::create_dir_all(&directory).unwrap();
        selected
            .write_native_payload(
                &mut std::fs::File::create(directory.join("delivery.json")).unwrap(),
            )
            .unwrap();
        std::fs::write(directory.join("original.act.json"), bytes).unwrap();
        for index in 0..selected.performance().native_recordings.len() {
            std::fs::write(
                directory.join(format!("native-page-{index}.json")),
                serde_json::to_vec(&selected.native_page(index).unwrap()).unwrap(),
            )
            .unwrap();
        }
    }
}

#[test]
fn actual_pending_native_reservation_delivers_original_occurrence_without_a_played_future_receipt()
{
    use oi_cradle_kernel::expression_performance_reservation::reserve_checkpoint;
    let bindings = [ParameterBinding {
        native_parameter: 4,
        performance_parameter: 0,
    }];
    let (original, cp, applications, journal) = managed_order("release", false);
    let state = NativeRecordState::from_checkpoint(&original.bases[0], &cp).unwrap();
    let recorded = prepare_recording(
        &original,
        admission(&state, &bindings),
        &applications,
        &journal,
    )
    .unwrap();
    let future = TimedEvent(
        Counter(3),
        Counter(48000),
        0,
        0,
        EventAction::Parameter(0, scalar(0.2), None),
    );
    let authored = recorded
        .prospective()
        .edited(vec![PerformanceOperation::Record {
            events: vec![future],
        }])
        .unwrap();
    let reservations = reserve_checkpoint(&authored, &cp, &bindings).unwrap();
    assert_eq!(reservations.len(), 1);
    let mut operations = recorded.record_operations();
    operations.push(PerformanceOperation::Record {
        events: vec![reservations[0].original_occurrence.clone()],
    });
    operations.push(PerformanceOperation::ReserveNative { reservations });
    let (act, document, _) = native_act(&original, operations, "queued");
    let selected = SelectedPerformance::from_act(&act, &selection(&act, &document)).unwrap();
    let payload = selected.native_payload().unwrap();
    let reservation = &payload["performance"]["native_reservations"][0];
    assert_eq!(reservation["native_sequence"], "2");
    assert_eq!(reservation["recorded_sequence"], "3");
    assert_eq!(reservation["effective_sample"], "48000");
    assert_eq!(reservation["queue_receipt_cursor"], "256");
    assert_eq!(selected.performance().event_count(), 3);
    let page = selected.native_page(0).unwrap();
    let receipts = page["decoded"]["value"]["receipts"].as_array().unwrap();
    assert_eq!(receipts.len(), 2);
    assert_eq!(receipts[1]["application"]["requested_sample"], "0");
    assert_eq!(receipts[1]["application"]["admitted_sample"], "128");
    assert_eq!(receipts[1]["application"]["applied_sample"], "128");
    assert!(receipts.iter().all(|r| r["application"]["sequence"] != "2"));
}

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

fn source_prepared() -> (Performance, Value) {
    let actual = read(
        std::env::var("QL_RETAINED_SOURCE_PERFORMANCE_FIXTURE")
            .expect("actual native SourceForm binding fixture required"),
    );
    let original: PerformanceBasis = serde_json::from_value(actual["basis"].clone()).unwrap();
    let original = original.seal().unwrap();
    assert_eq!(original.context.kind, ContextKind::World);
    assert!(!original.context.private);
    assert_eq!(original.m4_episode, None);
    let asset =
        NativePerformanceSourceAsset::from_native(&original, actual["source_assets"].clone())
            .unwrap();
    asset.require_source_context(&original).unwrap();
    assert_eq!(
        actual["source_assets"]["source_context"]["availability"],
        "available"
    );
    let basis = original;
    let pitches = serde_json::from_value(actual["pitches"].clone()).unwrap();
    let rate = basis.prepared_body["request"]["sample_rate"]
        .as_u64()
        .unwrap() as u32;
    let p = Performance {
        schema: SOURCE_SCHEMA.into(),
        performance_ref: "performance:retained-source/current".into(),
        sample_rate: rate,
        duration_samples: Counter(900 * u64::from(rate)),
        ppq: 960,
        bases: vec![basis],
        pitches,
        layers: vec![Layer {
            layer_ref: "performance:source/1".into(),
            title: "Actual retained source".into(),
            enabled: true,
            solo: false,
        }],
        pages: vec![],
        parameters: vec![],
        routes: vec![],
        tempo: vec![TempoSegment {
            at_sample: Counter(0),
            at_tick: Counter(0),
            micros_per_quarter: 500_000,
        }],
        loop_range: None,
        position_sample: Counter(0),
        replay: ReplayPolicy {
            mode: ReplayMode::SeededFromStart,
            max_reconstruction_samples: Counter(u64::from(rate)),
            model_revision: "ql.performance-checkpoint/v1".into(),
            event_tolerance_samples: 0,
            physical_tolerance: scalar(1e-10),
            display_policy: "actual-native-source-form".into(),
        },
        checkpoints: vec![],
        native_sources: vec![asset],
        native_recordings: vec![],
        native_reservations: vec![],
        content_digest: String::new(),
    }
    .seal()
    .unwrap();
    (p, actual)
}
#[test]
fn actual_native_source_parts_keep_typed_byte_order_and_public_context_in_existing_act() {
    use oi_cradle_kernel::expression_performance_assets::PerformancePart;
    let (original, actual) = source_prepared();
    let (act, document, _) = native_act(
        &original,
        vec![PerformanceOperation::Seek { sample: Counter(0) }],
        "source",
    );
    let selected = SelectedPerformance::from_act(&act, &selection(&act, &document)).unwrap();
    selected
        .verify_native_sources(&[actual["source_assets"].clone()])
        .unwrap();
    let payload = selected.native_payload().unwrap();
    assert_eq!(
        payload["performance"]["native_sources"],
        serde_json::to_value(&original.native_sources).unwrap()
    );
    for (index, source) in selected.performance().native_sources.iter().enumerate() {
        let typed =
            serde_json::to_vec(&PerformancePart::NativeSource(Box::new(source.clone()))).unwrap();
        let delivered = &payload["native_source_parts"][index];
        assert_eq!(
            delivered["canonical_part_bytes"]
                .as_str()
                .unwrap()
                .as_bytes(),
            typed
        );
        assert_eq!(
            delivered["reading"],
            serde_json::to_value(source.reading().unwrap()).unwrap()
        );
        assert_eq!(
            delivered["reading"]["ref"],
            format!("sha256:{:x}", Sha256::digest(&typed))
        );
        let reconstructed: Value = serde_json::from_slice(&typed).unwrap();
        assert_eq!(
            reconstructed["value"]["native_bundle"],
            actual["source_assets"]
        );
    }
    let mut public = Vec::new();
    selected.write_public_payload(&mut public).unwrap();
    assert_eq!(serde_json::from_slice::<Value>(&public).unwrap(), payload);
    let mut changed = actual["source_assets"].clone();
    changed["configuration"]["transpose"] = json!(1);
    assert!(selected.verify_native_sources(&[changed]).is_err());
}

fn activated_performance(actual: Value) -> (Performance, Value) {
    let original: PerformanceBasis = serde_json::from_value(actual["basis"].clone()).unwrap();
    let original = original.seal().unwrap();
    let asset =
        NativePerformanceSourceAsset::from_native(&original, actual["source_assets"].clone())
            .unwrap();
    asset.require_source_context(&original).unwrap();
    assert_eq!(
        actual["source_assets"]["source_context"]["availability"],
        "available"
    );
    let basis = original;
    let pitches = serde_json::from_value(actual["pitches"].clone()).unwrap();
    let rate = basis.prepared_body["request"]["sample_rate"]
        .as_u64()
        .unwrap() as u32;
    let p = Performance {
        schema: SOURCE_SCHEMA.into(),
        performance_ref: "performance:retained-source/current".into(),
        sample_rate: rate,
        duration_samples: Counter(900 * u64::from(rate)),
        ppq: 960,
        bases: vec![basis],
        pitches,
        layers: vec![Layer {
            layer_ref: "performance:source/1".into(),
            title: "Actual retained source".into(),
            enabled: true,
            solo: false,
        }],
        pages: vec![],
        parameters: vec![],
        routes: vec![],
        tempo: vec![TempoSegment {
            at_sample: Counter(0),
            at_tick: Counter(0),
            micros_per_quarter: 500_000,
        }],
        loop_range: None,
        position_sample: Counter(0),
        replay: ReplayPolicy {
            mode: ReplayMode::SeededFromStart,
            max_reconstruction_samples: Counter(u64::from(rate)),
            model_revision: "ql.performance-checkpoint/v1".into(),
            event_tolerance_samples: 0,
            physical_tolerance: scalar(1e-10),
            display_policy: "actual-native-source-form".into(),
        },
        checkpoints: vec![],
        native_sources: vec![asset],
        native_recordings: vec![],
        native_reservations: vec![],
        content_digest: String::new(),
    }
    .seal()
    .unwrap();
    (p, actual)
}
#[test]
fn genuine_activated_world_personal_shared_delivery_preserves_original_episode_and_refuses_cross_context(
) {
    let directory=std::path::PathBuf::from(std::env::var("QL_CURRENT_RECEIVING_ARTIFACT_DIRECTORY")
        .expect("mandatory normal gate must execute R's actual final FieldHost/worker receiving artifact producer"));
    let bundles: Vec<_> = ["world", "personal", "shared"]
        .into_iter()
        .map(|kind| {
            (
                kind,
                read(directory.join(format!("{kind}.source-performance.json"))),
            )
        })
        .collect();
    for (kind, actual) in &bundles {
        let (performance, _) = activated_performance(actual.clone());
        assert_eq!(
            performance.bases[0].context.kind,
            match *kind {
                "world" => ContextKind::World,
                "personal" => ContextKind::Personal,
                _ => ContextKind::Shared,
            }
        );
        assert_eq!(
            actual["source_assets"]["current_receiving"]["source_inputs"],
            actual["source_assets"]["receiving_source_inputs"]
        );
        assert_eq!(
            actual["source_assets"]["current_receiving"]["source_payload_context"]["private"],
            json!(*kind != "world")
        );
        // Exercise the actual three producer payloads: the native constructor
        // tag remains literal data; executable-shaped/reserved keys still fail
        // at the receiving guard before any source witness is consulted.
        for path in [
            "/receiving_source_inputs",
            "/current_receiving/source_inputs",
        ] {
            for constructor in [
                Value::Null,
                json!("unknown-route"),
                json!({"call": "native-world"}),
            ] {
                let mut changed = actual["source_assets"].clone();
                changed.pointer_mut(path).unwrap()["constructor"] = constructor;
                assert!(
                    NativePerformanceSourceAsset::from_native(&performance.bases[0], changed)
                        .unwrap_err()
                        .contains("unsafe performance native reading key")
                );
            }
            for key in ["__proto__", "prototype", "unexpected_field"] {
                let mut changed = actual["source_assets"].clone();
                changed
                    .pointer_mut(path)
                    .unwrap()
                    .as_object_mut()
                    .unwrap()
                    .insert(key.into(), json!("native-world"));
                assert!(
                    NativePerformanceSourceAsset::from_native(&performance.bases[0], changed)
                        .unwrap_err()
                        .contains("unsafe performance native reading key")
                );
            }
            let mut changed = actual["source_assets"].clone();
            changed.pointer_mut(path).unwrap()["schema"] = json!("unqualified-inputs/v1");
            assert!(
                NativePerformanceSourceAsset::from_native(&performance.bases[0], changed)
                    .unwrap_err()
                    .contains("unsafe performance native reading key")
            );
        }
        let mut misplaced = actual["source_assets"].clone();
        misplaced["constructor"] = json!("native-world");
        assert!(
            NativePerformanceSourceAsset::from_native(&performance.bases[0], misplaced)
                .unwrap_err()
                .contains("unsafe performance native reading key")
        );
        let (act, document, _) = native_act(
            &performance,
            vec![PerformanceOperation::Seek { sample: Counter(0) }],
            kind,
        );
        let request = selection(&act, &document);
        let selected = SelectedPerformance::from_act(&act, &request).unwrap();
        selected
            .verify_native_sources(&[actual["source_assets"].clone()])
            .unwrap();
        let delivered = selected.native_payload().unwrap();
        if let Ok(output) = std::env::var("OI_NATIVE_PERFORMANCE_DELIVERY_DIRECTORY") {
            let directory =
                std::path::PathBuf::from(output).join(format!("actual-activated-{kind}"));
            assert!(
                !directory.exists(),
                "preserve previous native source delivery"
            );
            std::fs::create_dir_all(&directory).unwrap();
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(directory.join("delivery.json"))
                .unwrap();
            selected.write_native_payload(&mut file).unwrap();
            std::fs::write(
                directory.join("original.act.json"),
                oi_cradle_kernel::expression_performance_act::encode(&act).unwrap(),
            )
            .unwrap();
            std::fs::write(
                directory.join("source-performance.json"),
                serde_json::to_vec(actual).unwrap(),
            )
            .unwrap();
            for index in 0..selected.performance().native_recordings.len() {
                std::fs::write(
                    directory.join(format!("native-page-{index}.json")),
                    serde_json::to_vec(&selected.native_page(index).unwrap()).unwrap(),
                )
                .unwrap();
            }
        }
        assert_eq!(
            delivered["original_episodes"][0]["original_episode"],
            serde_json::to_value(&performance.bases[0].m4_episode).unwrap()
        );
        assert_eq!(
            delivered["performance"]["native_sources"][0]["native_bundle"],
            actual["source_assets"]
        );
        assert_eq!(selected.requires_private_disclosure(), *kind != "world");
        let mut public = Vec::new();
        if *kind == "world" {
            selected.write_public_payload(&mut public).unwrap();
            assert_eq!(performance.bases[0].m4_episode, None);
            assert_eq!(serde_json::from_slice::<Value>(&public).unwrap(), delivered);
        } else {
            assert!(selected.write_public_payload(&mut public).is_err());
            assert!(public.is_empty());
            assert!(performance.bases[0].m4_episode.is_some());
        }
        for (other_kind, other) in &bundles {
            if other_kind != kind {
                assert!(selected
                    .verify_native_sources(&[other["source_assets"].clone()])
                    .is_err());
            }
        }
        let bytes = oi_cradle_kernel::expression_performance_act::encode(&act).unwrap();
        let reopened =
            oi_cradle_kernel::expression_performance_act::decode_bytes(&bytes, 64 * 1024 * 1024)
                .unwrap();
        assert_eq!(
            SelectedPerformance::from_act(&reopened, &request)
                .unwrap()
                .native_payload()
                .unwrap(),
            delivered
        );
    }
}

#[test]
fn actual_closed_act_reader_rechecks_attached_store_before_and_after_and_refuses_external_successor(
) {
    use oi_cradle_kernel::expression_act_store::Written;
    let (original, cp, applications, journal) = actual();
    let state = NativeRecordState::from_checkpoint(&original.bases[0], &cp).unwrap();
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
    let name = "reader-external-store";
    let (act, document, mut kernel) = native_act(&original, recorded.record_operations(), name);
    let request = selection(&act, &document);
    let home =
        std::path::PathBuf::from(std::env::var("OI_RETAINED_PERFORMANCE_TEST_HOME").unwrap())
            .join(format!("delivery-{name}-{}", std::process::id()));
    let store = ActStore::at_home(&home);
    kernel
        .with_native_act_delivery(&act.act_ref, &request, |reader| {
            reader.compile_with(|native, pages| {
                assert_eq!(native["act_revision"], act.revision);
                assert_eq!(
                    pages.page(0)?["performance_digest"],
                    native["performance_digest"]
                );
                Ok(())
            })
        })
        .unwrap();
    let refused = kernel.with_native_act_delivery(&act.act_ref, &request, |reader| {
        reader.compile_with(|native, _| {
            let mut changed = store
                .read_retained(&act.act_ref)?
                .ok_or("actual stored Act absent")?;
            assert_eq!(changed.revision, act.revision);
            changed.summary =
                "Actual external native owner successor during score preparation".into();
            changed.revision += 1;
            assert!(matches!(
                store.write(&changed, Some(act.revision))?,
                Written::Written
            ));
            Ok(native["performance_digest"].clone())
        })
    });
    assert!(
        refused.unwrap_err().contains("changed during"),
        "cached native predecessor must not publish a result after durable successor"
    );
    assert!(
        kernel
            .with_native_act_delivery(&act.act_ref, &request, |_| Ok(()))
            .is_err(),
        "pre-guard must read actual store too"
    );
    let current = store.read_retained(&act.act_ref).unwrap().unwrap();
    let mut current_selection = request.clone();
    current_selection.expected_act_revision = current.revision;
    kernel
        .with_native_act_delivery(&act.act_ref, &current_selection, |reader| {
            reader.compile_with(|native, pages| {
                assert_eq!(native["act_revision"], current.revision);
                assert_eq!(pages.page(0)?["act_revision"], current.revision);
                Ok(())
            })
        })
        .unwrap();
}
