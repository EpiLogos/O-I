//! Uses the complete output of the actual QL/K/B/A/P producer example.
//! No mocked sound/body/graph or authored-label snapshot is supplied here.
//! Fixture generation and kernel compilation require parent finite admission.
use oi_cradle_kernel::expression::{Availability, ReadingRef};
use oi_cradle_kernel::expression_performance::*;
use serde_json::{json, Value};
use sha2::Digest;
use std::collections::BTreeMap;
fn scalar(v: f64) -> Scalar {
    Scalar::new(v).unwrap()
}
fn native_fixture() -> Value {
    let path = std::env::var("QL_RETAINED_PERFORMANCE_FIXTURE")
        .expect("generate actual native retained-performance-fixture first; no synthetic fallback");
    let bytes = std::fs::read(path).unwrap();
    let value: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(value["schema"], "ql.retained-performance-fixture/v1");
    assert_eq!(
        value["producer_contract"],
        "ql.musical-performance-return/v1"
    );
    value
}
fn basis() -> PerformanceBasis {
    serde_json::from_value::<PerformanceBasis>(native_fixture()["basis"].clone())
        .unwrap()
        .seal()
        .unwrap()
}
fn target() -> ParameterTarget {
    ParameterTarget {
        native_owner: "ql.performance-audio/v1".into(),
        action_ref: "epi.audio.performance.parameter".into(),
        target_ref: "cutoff_hertz".into(),
        unit: "Hz".into(),
        scope: Scope::Instrument,
        minimum: scalar(20.0),
        maximum: scalar(20_000.0),
        baseline: scalar(1000.0),
        smoothing_samples: Counter(128),
    }
}
fn route() -> ModulationRoute {
    ModulationRoute {
        route_ref: "performance:modulation/1".into(),
        source: ReadingRef {
            r#ref: "reference:recorded-filter-gesture".into(),
            revision: "1".into(),
            availability: Availability::Available,
        },
        source_unit: "Hz".into(),
        destination: target(),
        transfer: Transfer::Replace,
        amount: scalar(1.0),
        delay_samples: Counter(10),
        feedback: false,
        enabled: true,
    }
}
fn empty() -> Performance {
    let b = basis();
    let pitches: Vec<Pitch> = serde_json::from_value(native_fixture()["pitches"].clone()).unwrap();
    Performance {
        schema: SCHEMA.into(),
        performance_ref: "performance:retained/current".into(),
        sample_rate: 48_000,
        duration_samples: Counter(900 * 48_000),
        ppq: 960,
        bases: vec![b],
        pitches,
        layers: vec![Layer {
            layer_ref: "performance:layer/1".into(),
            title: "First passage".into(),
            enabled: true,
            solo: false,
        }],
        pages: vec![],
        parameters: vec![target()],
        routes: vec![route()],
        tempo: vec![TempoSegment {
            at_sample: Counter(0),
            at_tick: Counter(0),
            micros_per_quarter: 500_000,
        }],
        loop_range: None,
        position_sample: Counter(0),
        replay: ReplayPolicy {
            mode: ReplayMode::SeededFromStart,
            max_reconstruction_samples: Counter(48_000),
            model_revision: "ql.performance-checkpoint/v1".into(),
            event_tolerance_samples: 0,
            physical_tolerance: scalar(1e-10),
            display_policy: "exact-source-form-native-receiving".into(),
        },
        checkpoints: vec![],
        native_sources: vec![],
        native_recordings: vec![],
        native_reservations: vec![],
        content_digest: String::new(),
    }
    .seal()
    .unwrap()
}
fn phases() -> (Scalar, Scalar) {
    let f = native_fixture();
    (
        scalar(f["native_notes"][0]["phase_sin"].as_f64().unwrap()),
        scalar(f["native_notes"][0]["phase_cos"].as_f64().unwrap()),
    )
}
fn note(seq: u64, sample: u64, touch: u64, pitch: u16) -> TimedEvent {
    let (sin, cos) = phases();
    TimedEvent(
        Counter(seq),
        Counter(sample),
        0,
        0,
        EventAction::NoteOn(Counter(touch), Counter(touch), pitch, scalar(0.8), sin, cos),
    )
}
fn off(seq: u64, sample: u64, touch: u64) -> TimedEvent {
    TimedEvent(
        Counter(seq),
        Counter(sample),
        0,
        0,
        EventAction::NoteOff(Counter(touch)),
    )
}
fn current(p: &Performance) -> BTreeMap<String, ReadingRef> {
    let b = &p.bases[0];
    b.sources
        .iter()
        .chain(&b.required_assets)
        .chain([&b.context.receiver, &b.context.context])
        .chain(b.context.source_occasion.iter())
        .chain(b.context.protected_state.iter())
        .chain(b.context.consent.iter())
        .map(|r| (r.r#ref.clone(), r.clone()))
        .collect()
}
fn cursor(p: &Performance, sample: u64, seq: u64) -> ReplayCursor {
    let i = &p.bases[0].identity;
    ReplayCursor {
        instance_ref: i.instance_ref.clone(),
        event_ref: i.event_ref.clone(),
        subject_ref: i.subject_ref.clone(),
        sample: Counter(sample),
        last_sequence: Counter(seq),
        checkpoint_digest: None,
    }
}
#[test]
fn native_basis_digest_keeps_original_eighteen_field_tuple_bytes_and_complete_tail() {
    use sha2::{Digest, Sha256};
    let b = basis();
    // Use serde's existing tuple encoding for each original prefix/tail, then
    // join only their array delimiters. This independently specifies the old
    // ordered 18-field wire without the new production Serialize implementation.
    let mut original = serde_json::to_vec(&(
        &b.schema,
        &b.identity,
        &b.sources,
        &b.m1_coordinate,
        b.m1_prime,
        &b.m1,
        &b.m2_plan,
        &b.audio_determination,
        &b.m3_score,
        &b.m3_replay,
        &b.m4_episode,
        &b.prepared_body,
        &b.tuning,
        &b.force_state,
        &b.form_state,
        &b.context,
    ))
    .unwrap();
    let tail = serde_json::to_vec(&(b.seed, &b.required_assets)).unwrap();
    assert_eq!(original.pop(), Some(b']'));
    assert_eq!(tail.first(), Some(&b'['));
    original.push(b',');
    original.extend_from_slice(&tail[1..]);
    let fields: Value = serde_json::from_slice(&original).unwrap();
    assert_eq!(fields.as_array().unwrap().len(), 18);
    assert_eq!(fields[16], serde_json::to_value(b.seed).unwrap());
    assert_eq!(
        fields[17],
        serde_json::to_value(&b.required_assets).unwrap()
    );
    assert_eq!(
        b.content_digest,
        format!("sha256:{:x}", Sha256::digest(&original))
    );
    let reopened: PerformanceBasis =
        serde_json::from_slice(&serde_json::to_vec(&b).unwrap()).unwrap();
    reopened.validate().unwrap();
    assert_eq!(reopened.content_digest, b.content_digest);
    let mut lost_seed = reopened.clone();
    lost_seed.seed.0 += 1;
    assert!(lost_seed.validate().is_err());
    let mut lost_asset = reopened;
    lost_asset.required_assets.push(ReadingRef {
        r#ref: "asset:digest-regression/required".into(),
        revision: "1".into(),
        availability: Availability::Available,
    });
    assert!(lost_asset.validate().is_err());
}
#[test]
fn actual_prime_source_and_distinct_native_generations_survive_serialization() {
    let p = empty();
    let wire = serde_json::to_vec(&p).unwrap();
    let reopened: Performance = serde_json::from_slice(&wire).unwrap();
    reopened.validate().unwrap();
    assert_eq!(p, reopened);
    assert_eq!(p.bases[0].identity.m1_revision, Counter(11));
    assert_ne!(
        p.bases[0].identity.m2_generation,
        p.bases[0].identity.m3_generation
    );
    assert_eq!(p.bases[0].m1_coordinate, "#1-3");
    assert!(p.bases[0].m1_prime);
    assert_eq!(p.bases[0].form_state, p.bases[0].m3_score["form"]);
    assert_eq!(
        p.bases[0].audio_determination["nodal_quartet"]
            .as_array()
            .unwrap()
            .len(),
        4
    );
    assert_eq!(
        p.bases[0].audio_determination["audio_octet_hz"]
            .as_array()
            .unwrap()
            .len(),
        8
    );
}
#[test]
fn record_overdub_edit_layer_route_automate_loop_seek_are_atomic_native_material() {
    let original = empty();
    let recorded = original
        .edited(vec![PerformanceOperation::Record {
            events: vec![note(1, 0, 1, 0), off(2, 200, 1)],
        }])
        .unwrap();
    assert_eq!(original.event_count(), 0);
    assert_eq!(recorded.event_count(), 2);
    let overdub = recorded
        .edited(vec![PerformanceOperation::Overdub {
            layer: Layer {
                layer_ref: "performance:layer/2".into(),
                title: "Second passage".into(),
                enabled: true,
                solo: false,
            },
            events: vec![note(3, 20, 2, 1), off(4, 220, 2)],
        }])
        .unwrap();
    assert_eq!(
        overdub
            .events()
            .find(|e| e.sequence() == 3)
            .unwrap()
            .layer(),
        1
    );
    let edited = overdub
        .edited(vec![
            PerformanceOperation::EditEvent {
                sequence: Counter(2),
                replacement: off(2, 210, 1),
            },
            PerformanceOperation::Automate {
                route_index: 0,
                events: vec![TimedEvent(
                    Counter(5),
                    Counter(40),
                    0,
                    0,
                    EventAction::Automation(0, scalar(1500.0), None),
                )],
            },
            PerformanceOperation::Loop {
                range: Some(LoopRange {
                    from_sample: Counter(0),
                    to_sample: Counter(240),
                }),
            },
            PerformanceOperation::Seek {
                sample: Counter(90),
            },
        ])
        .unwrap();
    assert_eq!(edited.position_sample, Counter(90));
    assert_eq!(edited.event_count(), 5);
    let plan = ReplayPlan::prepare(&edited, &current(&edited), false).unwrap();
    let window = plan.prepare_window(&cursor(&edited, 45, 19), 10).unwrap();
    assert_eq!(window.operations.len(), 1);
    assert_eq!(window.operations[0].sample, Counter(50));
    assert_eq!(window.operations[0].recorded_sequence, Counter(5));
    assert_eq!(window.operations[0].sequence, Counter(20));
    match &window.operations[0].native {
        NativeOperation::Parameter {
            value, route_ref, ..
        } => {
            assert_eq!(*value, scalar(1500.0));
            assert_eq!(route_ref.as_deref(), Some("performance:modulation/1"));
        }
        _ => panic!("real native parameter operation required"),
    }
    let cleared = edited
        .edited(vec![PerformanceOperation::RouteClear {
            route_ref: "performance:modulation/1".into(),
        }])
        .unwrap();
    assert_eq!(cleared.event_count(), edited.event_count());
    assert!(ReplayPlan::prepare(&cleared, &current(&cleared), false)
        .unwrap()
        .prepare_window(&cursor(&cleared, 45, 19), 10)
        .unwrap()
        .operations
        .is_empty());
    let before = serde_json::to_vec(&edited).unwrap();
    assert!(edited
        .edited(vec![PerformanceOperation::RemoveEvent {
            sequence: Counter(1)
        }])
        .is_err());
    assert_eq!(serde_json::to_vec(&edited).unwrap(), before);
}
#[test]
fn dropped_tuning_body_force_form_context_score_or_automation_rejects_lossy_replay() {
    let p = empty()
        .edited(vec![
            PerformanceOperation::Record {
                events: vec![note(1, 0, 1, 0), off(2, 200, 1)],
            },
            PerformanceOperation::Automate {
                route_index: 0,
                events: vec![TimedEvent(
                    Counter(3),
                    Counter(40),
                    0,
                    0,
                    EventAction::Automation(0, scalar(1700.0), None),
                )],
            },
        ])
        .unwrap();
    let wire = serde_json::to_value(&p).unwrap();
    for key in [
        "tuning",
        "prepared_body",
        "force_state",
        "form_state",
        "context",
        "m3_score",
        "m3_replay",
        "audio_determination",
    ] {
        let mut broken = wire.clone();
        broken["bases"][0].as_object_mut().unwrap().remove(key);
        assert!(
            serde_json::from_value::<Performance>(broken).is_err(),
            "lost {key} must be visible"
        );
    }
    let mut broken = wire.clone();
    broken["pages"][0]["events"]
        .as_array_mut()
        .unwrap()
        .retain(|e| e[0] != "3");
    let parsed: Performance = serde_json::from_value(broken).unwrap();
    assert!(parsed.validate().is_err());
    let mut broken = p.clone();
    broken.bases[0].tuning["available"] = Value::Bool(false);
    broken.bases[0] = broken.bases[0].clone().seal().unwrap();
    broken = broken.seal().unwrap();
    let readiness = broken.readiness(&current(&broken), false).unwrap();
    assert!(!readiness.ready);
    assert!(readiness
        .issues
        .iter()
        .any(|i| i.kind == "authentic_pitch_material_unavailable"));
    assert!(ReplayPlan::prepare(&broken, &current(&broken), false).is_err());
}
#[test]
fn drift_missing_assets_receiver_revision_and_cross_instance_are_detected_before_queue() {
    let p = empty()
        .edited(vec![PerformanceOperation::Record {
            events: vec![note(1, 0, 1, 0), off(2, 200, 1)],
        }])
        .unwrap();
    let mut readings = current(&p);
    let source = p.bases[0].sources[0].r#ref.clone();
    readings.get_mut(&source).unwrap().revision = "new-source".into();
    assert!(!p.readiness(&readings, false).unwrap().ready);
    assert!(p.readiness(&readings, true).unwrap().ready);
    readings.remove(&p.bases[0].context.receiver.r#ref);
    assert!(!p.readiness(&readings, true).unwrap().ready);
    let mut other = cursor(&p, 0, 0);
    other.instance_ref = "expression:another-instance".into();
    assert!(ReplayPlan::prepare(&p, &current(&p), false)
        .unwrap()
        .prepare_window(&other, 100)
        .is_err());
    let mut assets = p.clone();
    assets.bases[0].required_assets.push(ReadingRef {
        r#ref: "asset:missing-recording".into(),
        revision: "1".into(),
        availability: Availability::Available,
    });
    assets.bases[0] = assets.bases[0].clone().seal().unwrap();
    assets = assets.seal().unwrap();
    assert!(!assets.readiness(&current(&p), true).unwrap().ready);
}
#[test]
fn original_source_replay_never_exempts_overlapping_live_receiver_context_or_asset_roles() {
    let p = empty();
    let receiver = p.bases[0].context.receiver.clone();
    let context = p.bases[0].context.context.clone();
    let asset = ReadingRef {
        r#ref: "reference:actual-source-required-asset".into(),
        revision: "1".into(),
        availability: Availability::Available,
    };
    for required in [receiver, context, asset] {
        let mut attempted = p.clone();
        if required.r#ref == "reference:actual-source-required-asset" {
            attempted.bases[0].required_assets.push(required.clone());
        }
        attempted.bases[0].sources.push(required.clone());
        attempted.bases[0] = attempted.bases[0].clone().seal().unwrap();
        attempted = attempted.seal().unwrap();
        let mut available = current(&attempted);
        available.remove(&required.r#ref);
        let readiness = attempted.readiness(&available, true).unwrap();
        assert!(!readiness.ready);
        assert!(readiness
            .issues
            .iter()
            .any(|i| i.reference == required.r#ref && i.kind == "missing_native_reading"));
    }
}
#[test]
fn native_cursor_bounds_queue_capacity_and_seek_policy_cannot_silently_drop_or_restart() {
    let p = empty()
        .edited(vec![PerformanceOperation::Record {
            events: vec![note(1, 10, 1, 0), off(2, 200, 1)],
        }])
        .unwrap();
    let plan = ReplayPlan::prepare(&p, &current(&p), false).unwrap();
    let later = plan.prepare_window(&cursor(&p, 20, 0), 100).unwrap();
    assert!(later.operations.is_empty());
    assert!(plan.prepare_window(&cursor(&p, 0, 0), 96_001).is_err());
    assert!(plan.prepare_window(&cursor(&p, 0, u64::MAX), 100).is_err());
    assert!(p.seek_preparation(Counter(48_001)).is_err());
    let mut checkpointed = p.clone();
    checkpointed.replay.mode = ReplayMode::NativeCheckpoint;
    checkpointed = checkpointed.seal().unwrap();
    assert!(checkpointed.seek_preparation(Counter(1)).is_err());
    let seek = p.seek_preparation(Counter(100)).unwrap();
    assert!(seek.restore_owner_state_before_audio);
    assert_eq!(seek.event_ids, vec![Counter(1)]);
}
#[test]
fn fifteen_minutes_twenty_four_voices_full_force_automation_and_body_round_trip_exactly() {
    let p = fifteen_minute_work();
    assert_eq!(p.duration_samples, Counter(43_200_000));
    assert_eq!(p.event_count(), 45_000);
    let bytes = serde_json::to_vec(&p).unwrap();
    // Native Document/File owners enforce the actual surrounding budgets.
    // Report full measured material; never shorten the commissioned workload.
    eprintln!(
        "complete 15min/24voice performance bytes={} events={}",
        bytes.len(),
        p.event_count()
    );
    let reopened: Performance = serde_json::from_slice(&bytes).unwrap();
    reopened.validate().unwrap();
    assert_eq!(reopened, p);
    let plan = ReplayPlan::prepare(&reopened, &current(&reopened), true).unwrap();
    assert_eq!(
        plan.prepare_window(&cursor(&reopened, 899 * 48_000, 900_000), 512)
            .unwrap()
            .operations
            .len(),
        26
    );
    assert_eq!(p.tick_at(48_000).unwrap(), 1920);
    assert_eq!(
        p.bases[0].m3_score["clock"],
        p.bases[0].prepared_body["clock"]
    );
}
#[test]
fn canonical_full_u64_transport_and_finite_equality_refuse_rounded_or_noncanonical_data() {
    assert_eq!(
        serde_json::to_string(&Counter(u64::MAX)).unwrap(),
        "\"18446744073709551615\""
    );
    assert_eq!(
        serde_json::from_str::<Counter>("\"18446744073709551615\"").unwrap(),
        Counter(u64::MAX)
    );
    for v in [
        "18446744073709551615",
        "\"01\"",
        "\"+1\"",
        "\"18446744073709551616\"",
    ] {
        assert!(serde_json::from_str::<Counter>(v).is_err());
    }
    assert!(Scalar::new(f64::NAN).is_err());
    assert!(Scalar::new(f64::INFINITY).is_err());
    assert_eq!(scalar(-0.0), scalar(0.0));
}

fn kernel_expression(k: &mut oi_cradle_kernel::Kernel, input: Value) -> Result<Value, String> {
    let outcome = k.apply(oi_cradle_kernel::KernelOp::Expression {
        request: serde_json::from_value(input).map_err(|e| e.to_string())?,
    })?;
    match outcome.result {
        oi_cradle_kernel::KernelOpResult::Expression { data } => Ok(data),
        _ => Err("native Expression result absent".into()),
    }
}
fn kernel_world(k: &mut oi_cradle_kernel::Kernel, input: Value) -> Result<Value, String> {
    let outcome = k.apply(oi_cradle_kernel::KernelOp::ExpressionWorld {
        request: serde_json::from_value(input).map_err(|e| e.to_string())?,
    })?;
    match outcome.result {
        oi_cradle_kernel::KernelOpResult::ExpressionWorld { data } => Ok(data),
        _ => Err("native Act result absent".into()),
    }
}
fn document(k: &mut oi_cradle_kernel::Kernel) -> Value {
    kernel_expression(
        k,
        serde_json::json!({"operation":"inspect","expression_ref":"expression:retained-current"}),
    )
    .unwrap()["document"]
        .clone()
}
#[test]
fn actual_scene_act_file_edition_restart_seek_and_continue_preserve_the_complete_performance() {
    use oi_cradle_kernel::{expression::Document, expression_file, Kernel};
    let p = empty()
        .edited(vec![PerformanceOperation::Record {
            events: vec![note(1, 0, 1, 0), off(2, 200, 1)],
        }])
        .unwrap();
    let home = std::path::PathBuf::from(
        std::env::var("OI_RETAINED_PERFORMANCE_TEST_HOME")
            .expect("supply admitted native Act test custody; no system scratch fallback"),
    )
    .join(format!("native-performance-act-{}", std::process::id()));
    assert!(
        !home.exists(),
        "unique native test custody required; preserve prior evidence"
    );
    let mut k = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    k.attach_act_store(&home).unwrap();
    kernel_expression(&mut k,json!({"operation":"create","expression_ref":"expression:retained-current","title":"Retained native musical work","actor":"agent:retained-performance-test"})).unwrap();
    let old = document(&mut k);
    assert!(old["scenes"][0].get("performance").is_none());
    let legacy: Document = serde_json::from_value(old.clone()).unwrap();
    assert_eq!(
        expression_file::decode(&expression_file::encode(&legacy).unwrap()).unwrap(),
        legacy
    );
    let admitted=kernel_world(&mut k,json!({"operation":"act_perform","act_ref":"act:retained-performance","expression_ref":"expression:retained-current","expected_revision":1,
        "actor":"agent:retained-performance-test","summary":"Record native source-qualified work","activity_ref":"agent-session/direct:retained-performance",
        "changes":[{"change":"scene_performance_set","scene_ref":"expression:retained-current:scene:main","performance":p}]})).unwrap();
    assert_eq!(admitted["act"]["sequence"][0]["kind"], "edition");
    let initial = document(&mut k);
    let revision = initial["revision"].as_u64().unwrap();
    kernel_world(
        &mut k,
        json!({"operation":"act_interrupt","act_ref":"act:retained-performance",
        "actor":"agent:retained-performance-test","reason":"Commit next retained passage"}),
    )
    .unwrap();
    let edit = PerformanceOperation::Record {
        events: vec![note(3, 240, 2, 1), off(4, 400, 2)],
    };
    kernel_world(&mut k,json!({"operation":"act_perform","act_ref":"act:retained-performance","expression_ref":"expression:retained-current","expected_revision":revision,
        "actor":"agent:retained-performance-test","summary":"Continue native performance","changes":[{"change":"scene_performance_edit","scene_ref":"expression:retained-current:scene:main","operations":[edit]}]})).unwrap();
    let continued = document(&mut k);
    assert_eq!(
        continued["scenes"][0]["performance"]["pages"][0]["events"]
            .as_array()
            .unwrap()
            .len(),
        4
    );
    let before = document(&mut k);
    assert_eq!(kernel_expression(&mut k,json!({"operation":"edit","expression_ref":"expression:retained-current","expected_revision":revision,"actor":"agent:retained-performance-test",
        "changes":[{"change":"scene_performance_clear","scene_ref":"expression:retained-current:scene:main"}]})).unwrap()["state"], "revision_conflict");
    assert_eq!(
        document(&mut k),
        before,
        "stale CAS cannot alter retained physical material"
    );
    assert_eq!(kernel_expression(&mut k,json!({"operation":"close","expression_ref":"expression:retained-current","actor":"agent:retained-performance-test"})).unwrap()["state"],"dirty","dirty close must preserve work");
    let document_typed: Document = serde_json::from_value(continued.clone()).unwrap();
    let encoded = expression_file::encode(&document_typed).unwrap();
    let reopened = expression_file::decode(&encoded).unwrap();
    assert_eq!(reopened, document_typed);
    let mut altered: Value = serde_json::from_str(&encoded).unwrap();
    let header = altered["performance_parts"][0]["parts"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|p| p["part"]["kind"] == "header")
        .unwrap();
    header["part"]["value"]["routes"] = json!([]);
    assert!(expression_file::decode(&serde_json::to_string(&altered).unwrap()).is_err());
    drop(k);
    let mut fresh = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    fresh.attach_act_store(&home).unwrap();
    kernel_expression(
        &mut fresh,
        json!({"operation":"open","document":reopened,"actor":"agent:retained-performance-test"}),
    )
    .unwrap();
    kernel_world(&mut fresh,json!({"operation":"act_seek","act_ref":"act:retained-performance","actor":"agent:retained-performance-test","position":0})).unwrap();
    assert_eq!(
        document(&mut fresh)["scenes"][0]["performance"],
        initial["scenes"][0]["performance"]
    );
    kernel_world(&mut fresh,json!({"operation":"act_seek","act_ref":"act:retained-performance","actor":"agent:retained-performance-test","position":1})).unwrap();
    assert_eq!(
        document(&mut fresh)["scenes"][0]["performance"],
        continued["scenes"][0]["performance"]
    );
    // Complete expected output remains available to the admitted test runner.
    std::fs::remove_dir_all(home).unwrap();
}

fn fifteen_minute_work() -> Performance {
    let mut p = empty();
    let native = native_fixture();
    let sine = scalar(native["native_notes"][0]["phase_sin"].as_f64().unwrap());
    let cosine = scalar(native["native_notes"][0]["phase_cos"].as_f64().unwrap());
    let mut events = Vec::with_capacity(45_000);
    let mut seq = 0u64;
    for second in 0..900u64 {
        for voice in 0..24u64 {
            seq += 1;
            let touch = second * 24 + voice + 1;
            events.push(TimedEvent(
                Counter(seq),
                Counter(second * 48_000),
                0,
                0,
                EventAction::NoteOn(
                    Counter(touch),
                    Counter(voice + 1),
                    (voice % 12) as u16,
                    scalar(0.8),
                    sine,
                    cosine,
                ),
            ));
            seq += 1;
            events.push(off(seq, second * 48_000 + 36_000, touch));
        }
        seq += 1;
        events.push(TimedEvent(
            Counter(seq),
            Counter(second * 48_000 + 1),
            0,
            0,
            EventAction::Automation(0, scalar(1000.0 + (second % 20) as f64 * 100.0), None),
        ));
        seq += 1;
        events.push(TimedEvent(
            Counter(seq),
            Counter(second * 48_000 + 2),
            0,
            0,
            EventAction::Force(
                p.bases[0].prepared_body["request"]["preparation_ref"]
                    .as_str()
                    .unwrap()
                    .into(),
                [scalar(0.1), scalar(0.0), scalar(0.0)],
                ReadingRef {
                    r#ref: "reference:performer-force".into(),
                    revision: "1".into(),
                    availability: Availability::Available,
                },
            ),
        ));
    }
    events.sort_by_key(|e| (e.sample(), e.sequence()));
    p.pages = events
        .chunks(RETAINED_PAGE_EVENTS)
        .map(|e| EventPage { events: e.to_vec() })
        .collect();
    p = p.seal().unwrap();
    p
}

fn assert_native_catalog_projection(
    catalog: &oi_cradle_kernel::expression_performance_assets::PerformancePartCatalog,
    original: &Performance,
    index: usize,
) {
    use oi_cradle_kernel::expression_performance_assets::*;
    let stored = catalog.snapshot();
    let manifest = &stored.manifests[index];
    // Independent legacy byte oracle for every actual admitted enum part and
    // the complete native Performance at both ends of the original history.
    for part in &stored.parts {
        let literal = serde_json::to_vec(&part.part).unwrap();
        assert_eq!(
            part.r#ref,
            format!("sha256:{:x}", sha2::Sha256::digest(&literal))
        );
    }
    let literal = serde_json::to_vec(original).unwrap();
    assert_eq!(manifest.expanded_bytes as usize, literal.len());
    assert_eq!(
        manifest.expanded_performance_sha256,
        format!("sha256:{:x}", sha2::Sha256::digest(&literal))
    );
    let mut expected = serde_json::to_value(original).unwrap();
    let mut header = serde_json::Map::new();
    for key in [
        "schema",
        "performance_ref",
        "sample_rate",
        "ppq",
        "pitches",
        "layers",
        "parameters",
        "routes",
        "tempo",
        "replay",
    ] {
        header.insert(
            key.into(),
            expected.as_object_mut().unwrap().remove(key).unwrap(),
        );
    }
    let actual = stored
        .parts
        .iter()
        .find(|p| p.r#ref == manifest.header_ref)
        .unwrap();
    let PerformancePart::Header(actual) = &actual.part else {
        panic!("native header missing")
    };
    assert_eq!(serde_json::to_value(actual).unwrap(), Value::Object(header));
    for key in [
        "bases",
        "pages",
        "checkpoints",
        "native_sources",
        "native_recordings",
    ] {
        if let Some(array) = expected.get(key).and_then(Value::as_array) {
            if array.is_empty() {
                assert!(manifest.performance[key].as_array().unwrap().is_empty());
            } else {
                let reference: IndexReference =
                    serde_json::from_value(manifest.performance[key].clone()).unwrap();
                assert_eq!(reference.items as usize, array.len());
            }
            expected[key] = manifest.performance[key].clone();
        } else {
            assert!(manifest.performance.get(key).is_none());
        }
    }
    assert_eq!(
        manifest.performance, expected,
        "full native header/edition fields and optional omission remain exact"
    );
}

#[test]
fn actual_fifteen_minute_asset_history_shares_pages_preserves_undo_and_detects_missing_corrupt_parts(
) {
    use oi_cradle_kernel::expression_performance_assets::*;
    let full = fifteen_minute_work();
    let all: Vec<_> = full.events().cloned().collect();
    let mut catalog = PerformancePartCatalog::default();
    let mut first = None;
    for block in 1..=180u64 {
        let mut recorded = full.clone();
        let events: Vec<_> = all
            .iter()
            .filter(|e| e.sample() < block * 5 * 48_000)
            .cloned()
            .collect();
        recorded.pages = events
            .chunks(RETAINED_PAGE_EVENTS)
            .map(|e| EventPage { events: e.to_vec() })
            .collect();
        recorded = recorded.seal().unwrap();
        if first.is_none() {
            first = Some(recorded.clone());
        }
        catalog = catalog.appended(&recorded).unwrap();
    }
    assert_native_catalog_projection(&catalog, first.as_ref().unwrap(), 0);
    assert_native_catalog_projection(&catalog, &full, 179);
    // A coherently rehashed leaf/root size cannot replace actual decoded weight.
    // This uses the same actual native first edition; no fabricated owner data.
    let single = PerformancePartCatalog::default()
        .appended(first.as_ref().unwrap())
        .unwrap();
    let mut wrong_weight = single.snapshot();
    // This actual work has exactly one admitted basis (its first edition has
    // two event pages, so a page-root leaf would be a false setup assumption).
    assert_eq!(first.as_ref().unwrap().bases.len(), 1);
    let root: IndexReference =
        serde_json::from_value(wrong_weight.manifests[0].performance["bases"].clone()).unwrap();
    let leaf = wrong_weight
        .parts
        .iter_mut()
        .find(|p| p.r#ref == root.r#ref)
        .unwrap();
    let PartIndex::Leaf { expanded_bytes, .. } = (match &mut leaf.part {
        PerformancePart::Index(v) => v,
        _ => panic!("native leaf missing"),
    }) else {
        panic!("actual single basis is a leaf")
    };
    *expanded_bytes += 1;
    let new_ref = format!(
        "sha256:{:x}",
        sha2::Sha256::digest(serde_json::to_vec(&leaf.part).unwrap())
    );
    leaf.r#ref = new_ref.clone();
    wrong_weight.manifests[0].performance["bases"]["ref"] = Value::from(new_ref);
    wrong_weight.manifests[0].performance["bases"]["expanded_bytes"] =
        Value::from(root.expanded_bytes + 1);
    wrong_weight.manifests[0].expanded_bytes += 1;
    assert!(PerformancePartCatalog::read(wrong_weight)
        .unwrap_err()
        .contains("native performance leaf kind/weight differs"));
    assert_eq!(catalog.manifests().len(), 180);
    assert_eq!(catalog.restore(0).unwrap(), first.unwrap());
    assert_eq!(catalog.restore(179).unwrap(), full);
    let bytes = catalog.encoded_bytes().unwrap();
    eprintln!(
        "full 15min 180 immutable editions unique parts={} encoded bytes={bytes}",
        catalog.unique_parts()
    );
    assert!(bytes <= MAX_ENCODED_BYTES);
    assert!(catalog.unique_parts() < MAX_PARTS);
    let stored = catalog.snapshot();
    let reopened = PerformancePartCatalog::read(stored.clone()).unwrap();
    assert_eq!(reopened.restore(179).unwrap(), full);
    let mut missing = stored.clone();
    missing.parts.pop();
    assert!(PerformancePartCatalog::read(missing).is_err());
    let mut duplicate = stored.clone();
    duplicate.parts.push(duplicate.parts[0].clone());
    assert!(PerformancePartCatalog::read(duplicate).is_err());
    let mut corrupted = stored.clone();
    let part = corrupted
        .parts
        .iter_mut()
        .find(|p| {
            matches!(
                p.part,
                PerformancePart::EventPage(_) | PerformancePart::EncodedEventPage(_)
            )
        })
        .unwrap();
    match &mut part.part {
        PerformancePart::EventPage(p) => {
            p.events.remove(0);
        }
        PerformancePart::EncodedEventPage(p) => {
            let mut page = p.read::<EventPage>().unwrap();
            page.events.remove(0);
            *p = oi_cradle_kernel::expression_performance_codec::EncodedPage::from_value(&page)
                .unwrap();
        }
        _ => unreachable!(),
    }
    assert!(PerformancePartCatalog::read(corrupted).is_err());
    let mut privacy = stored;
    privacy.manifests[179].private_context = true;
    assert!(PerformancePartCatalog::read(privacy).is_err());
}
#[test]
fn actual_file_and_indexed_document_editions_preserve_full_material_without_expanding_history() {
    use oi_cradle_kernel::{
        expression::Document, expression_file, expression_performance_storage::*, Kernel,
    };
    let full = fifteen_minute_work();
    let mut k = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    kernel_expression(&mut k,json!({"operation":"create","expression_ref":"expression:retained-current","title":"Full musical work","actor":"agent:retained-performance-test"})).unwrap();
    kernel_expression(&mut k,json!({"operation":"edit","expression_ref":"expression:retained-current","expected_revision":1,"actor":"agent:retained-performance-test",
        "changes":[{"change":"scene_performance_set","scene_ref":"expression:retained-current:scene:main","performance":full}]})).unwrap();
    let native: Document = serde_json::from_value(document(&mut k)).unwrap();
    let encoded = expression_file::encode(&native).unwrap();
    assert!(encoded.len() <= expression_file::FILE_BYTES);
    assert_eq!(expression_file::decode(&encoded).unwrap(), native);
    assert_eq!(
        serde_json::from_str::<Value>(&encoded).unwrap()["schema"],
        STORAGE_SCHEMA
    );
    let mut stored: Value = serde_json::from_str(&encoded).unwrap();
    stored["performance_parts"][0]["parts"]
        .as_array_mut()
        .unwrap()
        .pop();
    assert!(expression_file::decode(&serde_json::to_string(&stored).unwrap()).is_err());
    let all: Vec<_> = full.events().cloned().collect();
    let mut custody = ActPerformanceCustody::default();
    let mut first = None;
    let mut last_expected = None;
    for block in 1..=180u64 {
        let mut edition = native.clone();
        edition.revision = block + 1;
        edition.scenes[0].revision = block + 1;
        let p = edition.scenes[0].performance.as_mut().unwrap();
        let events: Vec<_> = all
            .iter()
            .filter(|e| e.sample() < block * 5 * 48_000)
            .cloned()
            .collect();
        p.pages = events
            .chunks(RETAINED_PAGE_EVENTS)
            .map(|e| EventPage { events: e.to_vec() })
            .collect();
        *p = p.clone().seal().unwrap();
        if first.is_none() {
            first = Some(edition.clone());
        }
        if block == 180 {
            last_expected = Some(edition.clone());
        }
        let append_started = std::time::Instant::now();
        custody = custody.appended(&edition).unwrap();
        if block == 1 || block % 30 == 0 {
            eprintln!("native-history-progress path=document_append block={block}/180 events={} elapsed_ms={}",
                edition.scenes[0].performance.as_ref().unwrap().event_count(), append_started.elapsed().as_millis());
        }
    }
    eprintln!(
        "full native 15min Document history {} editions bytes={}",
        custody.editions().len(),
        custody.encoded_bytes().unwrap()
    );
    let reopened = ActPerformanceCustody::read(custody.snapshot()).unwrap();
    assert_eq!(reopened.restore(0).unwrap(), first.unwrap());
    let last = reopened.restore(179).unwrap();
    assert_eq!(last.scenes[0].performance.as_ref().unwrap(), &full);
    // The complete expected native edition was captured before append, not
    // reconstructed from its metadata dictionary or restore result.
    let expected = last_expected.unwrap();
    assert_eq!(last, expected);
    let public = serde_json::to_value(&expected).unwrap();
    let snapshot = custody.snapshot();
    let selected = &snapshot.documents[179];
    let expected_keys: Vec<_> = public
        .as_object()
        .unwrap()
        .keys()
        .filter(|key| key.as_str() != "scenes")
        .cloned()
        .collect();
    assert_eq!(
        selected.fields.keys().cloned().collect::<Vec<_>>(),
        expected_keys
    );
    for (key, reference) in &selected.fields {
        let literal = snapshot
            .literals
            .iter()
            .find(|literal| &literal.r#ref == reference)
            .unwrap();
        assert_eq!(
            &literal.value, &public[key],
            "complete native Document field {key}"
        );
    }
    for (scene, original) in selected
        .scenes
        .iter()
        .zip(public["scenes"].as_array().unwrap())
    {
        let fields: serde_json::Map<String, Value> = original
            .as_object()
            .unwrap()
            .iter()
            .filter(|(key, _)| !["revision", "performance"].contains(&key.as_str()))
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect();
        let literal = snapshot
            .literals
            .iter()
            .find(|literal| literal.r#ref == scene.scene_part)
            .unwrap();
        assert_eq!(literal.value, Value::Object(fields));
        assert_eq!(scene.revision, original["revision"].as_u64().unwrap());
        assert!(scene.performance_catalog.is_some() && scene.performance_manifest.is_some());
    }
    let mut missing = custody.snapshot();
    missing.performance_catalogs.clear();
    assert!(ActPerformanceCustody::read(missing).is_err());
    // These are complete actual native editions above, including all 180
    // blocks and revision digit-width transitions, not a fabricated dictionary.
    // Reusing one literal under another role must still type that second role.
    let mut wrong_role = custody.snapshot();
    let string_ref = wrong_role.documents[179].fields["expression_ref"].clone();
    wrong_role.documents[179]
        .fields
        .insert("revision".into(), string_ref);
    let error = ActPerformanceCustody::read(wrong_role).unwrap_err();
    assert!(error.contains("expected u64"), "{error}");

    // A correctly rehashed foreign dictionary cannot omit native Scene defaults.
    // All editions deliberately share this altered metadata reference, so the
    // first failed qualification must prevent any within-call reuse of it.
    let mut omitted = custody.snapshot();
    let old_ref = omitted.documents[0].scenes[0].scene_part.clone();
    let literal = omitted
        .literals
        .iter_mut()
        .find(|l| l.r#ref == old_ref)
        .unwrap();
    assert!(literal
        .value
        .as_object_mut()
        .unwrap()
        .remove("triggers")
        .is_some());
    use sha2::{Digest, Sha256};
    let changed_ref = format!(
        "sha256:{:x}",
        Sha256::digest(serde_json::to_vec(&literal.value).unwrap())
    );
    literal.r#ref = changed_ref.clone();
    for edition in &mut omitted.documents {
        for scene in &mut edition.scenes {
            if scene.scene_part == old_ref {
                scene.scene_part = changed_ref.clone();
            }
        }
    }
    let error = ActPerformanceCustody::read(omitted).unwrap_err();
    assert!(
        error.contains("omitted canonical nested defaults"),
        "{error}"
    );

    // Revision is separately retained: sharing metadata cannot share its old
    // serialized revision weight or waive the complete expanded size fence.
    let mut wrong_revision_weight = custody.snapshot();
    wrong_revision_weight.documents[179].scenes[0].revision = u64::MAX;
    let error = ActPerformanceCustody::read(wrong_revision_weight).unwrap_err();
    assert!(error.contains("weight differs before cloning"), "{error}");
    let mut wrong_expanded = custody.snapshot();
    wrong_expanded.documents[179].expanded_bytes += 1;
    let error = ActPerformanceCustody::read(wrong_expanded).unwrap_err();
    assert!(error.contains("weight differs before cloning"), "{error}");

    // Qualification never survives this call. A subsequent cold read must still
    // discover changed literal bytes even after a complete successful restore.
    let mut changed = custody.snapshot();
    let title_ref = changed.documents[179].fields["title"].clone();
    changed
        .literals
        .iter_mut()
        .find(|l| l.r#ref == title_ref)
        .unwrap()
        .value = json!("Changed after qualification");
    let error = ActPerformanceCustody::read(changed).unwrap_err();
    assert!(error.contains("literal digest differs"), "{error}");
}

#[test]
fn actual_fifteen_minute_act_cas_crash_reopen_undo_redo_and_continue_retains_45000_events() {
    use oi_cradle_kernel::{
        expression::Document, expression_act_store::ActStore, expression_file, Kernel,
    };
    let full = fifteen_minute_work();
    let all: Vec<_> = full.events().cloned().collect();
    let home = std::path::PathBuf::from(
        std::env::var("OI_RETAINED_PERFORMANCE_TEST_HOME")
            .expect("supply admitted native Act custody; no external or temporary store"),
    )
    .join(format!("native-fifteen-minute-act-{}", std::process::id()));
    assert!(!home.exists(), "preserve prior native evidence");
    let mut kernel = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    kernel.attach_act_store(&home).unwrap();
    kernel_expression(&mut kernel,json!({"operation":"create","expression_ref":"expression:retained-current",
        "title":"Complete fifteen-minute physical musical act","actor":"agent:retained-performance-test"})).unwrap();
    let mut first = None;
    let mut last_act = None;
    for block in 1..=180u64 {
        let mut recorded = full.clone();
        let events: Vec<_> = all
            .iter()
            .filter(|e| e.sample() < block * 5 * 48_000)
            .cloned()
            .collect();
        recorded.pages = events
            .chunks(RETAINED_PAGE_EVENTS)
            .map(|e| EventPage { events: e.to_vec() })
            .collect();
        recorded = recorded.seal().unwrap();
        let block_started = std::time::Instant::now();
        if block == 1 || block % 30 == 0 {
            eprintln!(
                "native-history-progress path=act_perform phase=before block={block}/180 events={}",
                recorded.event_count()
            );
        }
        if block > 1 {
            kernel_world(
                &mut kernel,
                json!({"operation":"act_interrupt","act_ref":"act:fifteen-minute-native",
                "actor":"agent:retained-performance-test","reason":"Retain next five seconds"}),
            )
            .unwrap();
        }
        let expected_act_revision = if block == 1 {
            None
        } else {
            Some(kernel_world(&mut kernel,json!({"operation":"act_retained_inspect","act_ref":"act:fifteen-minute-native"})).unwrap()["act"]["revision"].as_u64().unwrap())
        };
        let revision = document(&mut kernel)["revision"].as_u64().unwrap();
        let result = kernel_world(&mut kernel,json!({"operation":"act_retained_perform","act_ref":"act:fifteen-minute-native",
            "expression_ref":"expression:retained-current","expected_revision":revision,"expected_act_revision":expected_act_revision,
            "summary":"Retain complete physical performance","actor":"agent:retained-performance-test",
            "changes":[{"change":"scene_performance_set","scene_ref":"expression:retained-current:scene:main","performance":recorded}]})).unwrap();
        assert_eq!(result["state"], "act_running");
        assert_eq!(
            result["act"]["sequence"].as_array().unwrap().len(),
            block as usize
        );
        assert!(result["act"]["sequence"]
            .as_array()
            .unwrap()
            .iter()
            .all(|p| p.get("edition").is_none()
                && p["performance_edition"]["schema"]
                    == oi_cradle_kernel::expression_performance_act::EDITION_SCHEMA));
        if first.is_none() {
            first = Some(document(&mut kernel)["scenes"][0]["performance"].clone());
        }
        last_act = Some(result["act"].clone());
        if block == 1 || block % 30 == 0 {
            eprintln!("native-history-progress path=act_perform phase=after block={block}/180 elapsed_ms={}", block_started.elapsed().as_millis());
        }
    }
    let retained = document(&mut kernel);
    let selected: Document = serde_json::from_value(retained.clone()).unwrap();
    assert_eq!(selected.scenes[0].performance.as_ref().unwrap(), &full);
    let encoded = expression_file::encode(&selected).unwrap();
    let store = ActStore::at_home(&home);
    let act = store
        .read_retained("act:fifteen-minute-native")
        .unwrap()
        .unwrap();
    assert_eq!(act.sequence.len(), 180);
    assert_eq!(serde_json::to_value(&act).unwrap(), last_act.unwrap());
    eprintln!(
        "actual fifteen-minute Act record metadata+shared material bytes={} editions={}",
        serde_json::to_vec(&act).unwrap().len(),
        act.sequence.len()
    );
    // An independent stale store writer cannot overwrite the committed successor.
    assert!(matches!(store.write(&act,Some(act.revision-1)).unwrap(),
        oi_cradle_kernel::expression_act_store::Written::Conflict{current:Some(revision)} if revision==act.revision));
    // Restart with the real file codec and exact same native Act store.
    drop(kernel);
    let mut restarted = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    restarted.attach_act_store(&home).unwrap();
    kernel_expression(
        &mut restarted,
        json!({"operation":"open","document":expression_file::decode(&encoded).unwrap(),
        "actor":"agent:retained-performance-test"}),
    )
    .unwrap();
    kernel_world(
        &mut restarted,
        json!({"operation":"act_seek","act_ref":"act:fifteen-minute-native",
        "position":0,"actor":"agent:retained-performance-test"}),
    )
    .unwrap();
    assert_eq!(
        document(&mut restarted)["scenes"][0]["performance"],
        first.unwrap()
    );
    kernel_world(
        &mut restarted,
        json!({"operation":"act_seek","act_ref":"act:fifteen-minute-native",
        "position":179,"actor":"agent:retained-performance-test"}),
    )
    .unwrap();
    assert_eq!(
        document(&mut restarted)["scenes"][0]["performance"],
        retained["scenes"][0]["performance"]
    );
    kernel_world(
        &mut restarted,
        json!({"operation":"act_interrupt","act_ref":"act:fifteen-minute-native",
        "actor":"agent:retained-performance-test","reason":"Continue reopened native work"}),
    )
    .unwrap();
    let expected_act_revision = kernel_world(
        &mut restarted,
        json!({"operation":"act_retained_inspect","act_ref":"act:fifteen-minute-native"}),
    )
    .unwrap()["act"]["revision"]
        .as_u64()
        .unwrap();
    let revision = document(&mut restarted)["revision"].as_u64().unwrap();
    let result=kernel_world(&mut restarted,json!({"operation":"act_retained_perform","act_ref":"act:fifteen-minute-native",
        "expression_ref":"expression:retained-current","expected_revision":revision,"expected_act_revision":expected_act_revision,"summary":"Continue complete work",
        "actor":"agent:retained-performance-test","changes":[{"change":"scene_performance_edit",
            "scene_ref":"expression:retained-current:scene:main","operations":[{"operation":"seek","sample":"43199999"}]}]})).unwrap();
    assert_eq!(result["act"]["sequence"].as_array().unwrap().len(), 181);
    let continued: Document = serde_json::from_value(document(&mut restarted)).unwrap();
    assert_eq!(
        continued.scenes[0]
            .performance
            .as_ref()
            .unwrap()
            .event_count(),
        45_000
    );
    assert_eq!(
        continued.scenes[0]
            .performance
            .as_ref()
            .unwrap()
            .position_sample
            .0,
        43_199_999
    );
    // Lossless selected material remains exportable through the same file codec.
    assert_eq!(
        expression_file::decode(&expression_file::encode(&continued).unwrap()).unwrap(),
        continued
    );
    std::fs::remove_dir_all(home).unwrap();
}

#[test]
fn legacy_complete_editions_remain_v1_and_explicit_migration_restitutes_exact_documents() {
    use oi_cradle_kernel::{expression_act_store::ActStore, expression_performance_act, Kernel};
    let home = std::path::PathBuf::from(
        std::env::var("OI_RETAINED_PERFORMANCE_TEST_HOME")
            .expect("normal gate must allocate unique native Act custody"),
    )
    .join(format!(
        "retained-material-migration-{}",
        std::process::id()
    ));
    assert!(!home.exists());
    let mut kernel = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    kernel.attach_act_store(&home).unwrap();
    kernel_expression(&mut kernel,json!({"operation":"create","expression_ref":"expression:retained-current","title":"Legacy complete Editions","actor":"agent:retained-performance-test"})).unwrap();
    let p = empty();
    let result=kernel_world(&mut kernel,json!({"operation":"act_perform","act_ref":"act:explicit-migration","expression_ref":"expression:retained-current","expected_revision":1,"summary":"Exact legacy document","actor":"agent:retained-performance-test","changes":[{"change":"scene_performance_set","scene_ref":"expression:retained-current:scene:main","performance":p}]})).unwrap();
    let original = document(&mut kernel);
    assert_eq!(result["act"]["sequence"][0]["edition"], original);
    assert!(result["act"].get("material_contract").is_none());
    assert!(result["act"].get("performance_custody").is_none());
    let store = ActStore::at_home(&home);
    let legacy = store.read("act:explicit-migration").unwrap().unwrap();
    assert_eq!(serde_json::to_value(&legacy).unwrap(), result["act"]);
    let held=kernel_world(&mut kernel,json!({"operation":"act_interrupt","act_ref":"act:explicit-migration","actor":"agent:retained-performance-test"})).unwrap();
    let revision = held["act"]["revision"].as_u64().unwrap();
    let stale=kernel_world(&mut kernel,json!({"operation":"act_retained_enable","act_ref":"act:explicit-migration","expected_act_revision":revision-1})).unwrap();
    assert_eq!(stale["state"], "act_revision_conflict");
    assert_eq!(document(&mut kernel), original);
    let migrated=kernel_world(&mut kernel,json!({"operation":"act_retained_enable","act_ref":"act:explicit-migration","expected_act_revision":revision})).unwrap();
    assert_eq!(migrated["state"], "act_retained_enabled");
    assert_eq!(
        migrated["act"]["material_contract"],
        expression_performance_act::MATERIAL_SCHEMA
    );
    assert!(migrated["act"]["sequence"][0].get("edition").is_none());
    assert!(store.read("act:explicit-migration").is_err());
    let retained = store
        .read_retained("act:explicit-migration")
        .unwrap()
        .unwrap();
    let restituted=kernel_world(&mut kernel,json!({"operation":"act_retained_edition","act_ref":"act:explicit-migration","expected_act_revision":retained.revision,"position":0})).unwrap();
    assert_eq!(restituted["document"], original);
    assert_eq!(document(&mut kernel), original);
    assert!(kernel_world(
        &mut kernel,
        json!({"operation":"act_inspect","act_ref":"act:explicit-migration"})
    )
    .is_err());
    assert!(kernel_world(&mut kernel,json!({"operation":"act_perform","act_ref":"act:explicit-migration","expression_ref":"expression:retained-current","expected_revision":original["revision"],"summary":"Must use retained transaction","actor":"agent:retained-performance-test","changes":[{"change":"rename","title":"Refuse legacy shortcut"}]})).is_err());
    assert_eq!(document(&mut kernel), original);
    // Same native store reload and exact selected Document restitution survive
    // restart; no migration writes to the selected Expression or source.
    drop(kernel);
    let mut reopened = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    reopened.attach_act_store(&home).unwrap();
    let index = kernel_world(
        &mut reopened,
        json!({"operation":"act_retained_inspect","act_ref":"act:explicit-migration"}),
    )
    .unwrap();
    assert_eq!(index["act"], migrated["act"]);
    let selected=kernel_world(&mut reopened,json!({"operation":"act_retained_edition","act_ref":"act:explicit-migration","expected_act_revision":retained.revision,"position":0})).unwrap();
    assert_eq!(selected["document"], original);
    std::fs::remove_dir_all(home).unwrap();
}

#[test]
fn legacy_full_history_budget_refuses_without_auto_handles_or_expression_mutation() {
    let full = fifteen_minute_work();
    let mut kernel =
        oi_cradle_kernel::Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    kernel_expression(&mut kernel,json!({"operation":"create","expression_ref":"expression:retained-current","title":"Legacy history bound","actor":"agent:retained-performance-test"})).unwrap();
    let mut refused = false;
    for attempt in 0..8 {
        if attempt > 0 {
            kernel_world(&mut kernel,json!({"operation":"act_interrupt","act_ref":"act:legacy-expanded","actor":"agent:retained-performance-test"})).unwrap();
        }
        let before = document(&mut kernel);
        let result = kernel_world(
            &mut kernel,
            json!({"operation":"act_perform","act_ref":"act:legacy-expanded","expression_ref":"expression:retained-current","expected_revision":before["revision"],"summary":"Legacy complete history","actor":"agent:retained-performance-test","changes":[{"change":"scene_performance_set","scene_ref":"expression:retained-current:scene:main","performance":full}]}),
        );
        match result {
            Ok(value) => {
                assert!(value["act"].get("material_contract").is_none());
                assert!(value["act"].get("performance_custody").is_none());
                assert!(value["act"]["sequence"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .all(|p| p.get("edition").is_some() && p.get("performance_edition").is_none()));
            }
            Err(error) => {
                assert!(error.contains("budget"), "{error}");
                assert_eq!(document(&mut kernel), before);
                let index = kernel_world(
                    &mut kernel,
                    json!({"operation":"act_inspect","act_ref":"act:legacy-expanded"}),
                )
                .unwrap();
                assert_eq!(index["act"]["sequence"].as_array().unwrap().len(), attempt);
                refused = true;
                break;
            }
        }
    }
    assert!(
        refused,
        "complete legacy history must reach its unchanged 8 MiB expanded Act bound"
    );
}
