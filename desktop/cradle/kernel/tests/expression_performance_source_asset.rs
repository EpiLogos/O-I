//! Mandatory actual retained native producer fixture. This exercises the
//! existing Document/file/Act owners; no reconstructed source bundle is used.
//! Recording here is an authored edit, not a fabricated callback application.
use oi_cradle_kernel::expression_performance::*;
use oi_cradle_kernel::expression_performance_assets::*;
use oi_cradle_kernel::expression_performance_source_asset::NativePerformanceSourceAsset;
use oi_cradle_kernel::expression_performance_storage::ActPerformanceCustody;
use oi_cradle_kernel::{expression::Document, expression_file, Kernel};
use serde_json::{json, Value};

fn fixture() -> Value {
    let path=std::env::var("QL_RETAINED_SOURCE_PERFORMANCE_FIXTURE")
        .expect("normal native gate must generate the actual retained SourceForm/Return fixture; no fallback");
    let value: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    assert_eq!(value["schema"], "ql.retained-source-performance-fixture/v1");
    assert_eq!(
        value["source_assets"]["schema"],
        "ql.retained-performance-source-assets/v1"
    );
    value
}
fn scalar(v: f64) -> Scalar {
    Scalar::new(v).unwrap()
}
fn prepared() -> (Performance, Value) {
    let actual = fixture();
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
fn request(kernel: &mut Kernel, surface: &str, value: Value) -> Value {
    assert_eq!(surface, "expression");
    let reply = kernel
        .apply(oi_cradle_kernel::KernelOp::Expression {
            request: serde_json::from_value(value).unwrap(),
        })
        .unwrap();
    match reply.result {
        oi_cradle_kernel::KernelOpResult::Expression { data } => data,
        _ => panic!("native Expression result absent"),
    }
}
fn create(kernel: &mut Kernel) -> Document {
    request(
        kernel,
        "expression",
        json!({"operation":"create","expression_ref":"expression:retained-source/current",
        "title":"Retained original native source","actor":"agent:source-asset-proof"}),
    );
    document(kernel)
}
fn document(kernel: &mut Kernel) -> Document {
    let result = request(
        kernel,
        "expression",
        json!({"operation":"inspect","expression_ref":"expression:retained-source/current"}),
    );
    serde_json::from_value(result["document"].clone()).unwrap()
}
fn edit(kernel: &mut Kernel, performance: &Performance) -> Document {
    let current = document(kernel);
    request(
        kernel,
        "expression",
        json!({"operation":"edit","expression_ref":current.expression_ref,
        "expected_revision":current.revision,"actor":"agent:source-asset-proof",
        "changes":[{"change":"scene_performance_set","scene_ref":current.scenes[0].scene_ref,"performance":performance}]}),
    );
    document(kernel)
}

#[test]
fn full_original_native_source_recipe_keys_and_projection_survive_same_file_owner() {
    let (p, actual) = prepared();
    let source = &p.native_sources[0];
    source
        .verify_native_replay(&p.bases[0], &actual["source_assets"])
        .unwrap();
    let mut current: std::collections::BTreeMap<String, oi_cradle_kernel::expression::ReadingRef> =
        p.bases[0]
            .sources
            .iter()
            .chain(&p.bases[0].required_assets)
            .chain([&p.bases[0].context.receiver, &p.bases[0].context.context])
            .map(|r| (r.r#ref.clone(), r.clone()))
            .collect();
    let context_refs: Vec<oi_cradle_kernel::expression::ReadingRef> = serde_json::from_value(
        actual["source_assets"]["source_context"]["currentness_refs"].clone(),
    )
    .unwrap();
    for reading in &context_refs {
        current.insert(reading.r#ref.clone(), reading.clone());
    }
    assert!(p.readiness(&current, false).unwrap().ready);
    assert!(p.readiness(&current, true).unwrap().ready);
    let owner = context_refs.last().unwrap();
    assert!(current.remove(&owner.r#ref).is_some());
    let lost = p.readiness(&current, true).unwrap();
    assert!(!lost.ready);
    assert!(lost
        .issues
        .iter()
        .any(|i| i.reference == owner.r#ref && i.kind == "missing_native_reading"));
    let mut unavailable = owner.clone();
    unavailable.availability = oi_cradle_kernel::expression::Availability::Unavailable;
    current.insert(owner.r#ref.clone(), unavailable);
    let lost = p.readiness(&current, true).unwrap();
    assert!(!lost.ready);
    assert!(lost
        .issues
        .iter()
        .any(|i| i.reference == owner.r#ref && i.kind == "native_reading_unavailable"));
    let mut kernel = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    let old = create(&mut kernel);
    let old_bytes = expression_file::encode(&old).unwrap();
    assert_eq!(
        expression_file::encode(&expression_file::decode(&old_bytes).unwrap()).unwrap(),
        old_bytes
    );
    let stored = edit(&mut kernel, &p);
    let bytes = expression_file::encode(&stored).unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&bytes).unwrap()["schema"],
        oi_cradle_kernel::expression_performance_storage::SOURCE_STORAGE_SCHEMA
    );
    let reopened = expression_file::decode(&bytes).unwrap();
    assert_eq!(reopened, stored);
    let restored = reopened.scenes[0].performance.as_ref().unwrap();
    assert_eq!(
        restored.native_sources[0].native_bundle(),
        &actual["source_assets"]
    );
    assert_eq!(
        restored.native_sources[0].native_bundle()["configuration"]["recipe"],
        actual["source_assets"]["source_form_recipe"]
    );
    assert_eq!(
        restored.native_sources[0].native_bundle()["original_native_input"],
        actual["source_assets"]["original_native_input"]
    );
    assert_eq!(expression_file::encode(&reopened).unwrap(), bytes);
    // Old performance v1 shape and hash remain available with no new assets.
    let mut legacy = p.clone();
    legacy.schema = SCHEMA.into();
    legacy.native_sources.clear();
    legacy.bases[0]
        .required_assets
        .retain(|r| r.revision != oi_cradle_kernel::expression_performance_source_asset::SCHEMA);
    legacy.bases[0] = legacy.bases[0].clone().seal().unwrap();
    legacy = legacy.seal().unwrap();
    assert!(serde_json::to_value(&legacy)
        .unwrap()
        .get("native_sources")
        .is_none());
    let catalog = PerformancePartCatalog::default().appended(&legacy).unwrap();
    assert_eq!(catalog.snapshot().schema, CATALOG_SCHEMA);
    assert_eq!(
        PerformancePartCatalog::read(catalog.snapshot())
            .unwrap()
            .restore(0)
            .unwrap(),
        legacy
    );
}

#[test]
fn source_loss_drift_wrong_instance_and_version_downgrade_refuse_lossless_replay() {
    let (p, actual) = prepared();
    let mut drift = actual["source_assets"].clone();
    drift["configuration"]["controls"]["material"]["damping_alpha_per_second"] = json!(0.9);
    assert!(p.native_sources[0]
        .verify_native_replay(&p.bases[0], &drift)
        .is_err());
    let mut lost = actual["source_assets"].clone();
    lost["physical_consumer_projection"]["legacy_mode_frequency_bindings"]
        .as_object_mut()
        .unwrap()
        .remove("sky_frequency_bindings");
    assert!(NativePerformanceSourceAsset::from_native(&p.bases[0], lost).is_err());
    let mut recipe = actual["source_assets"].clone();
    recipe["source_form_recipe"]["frame_side_metres"] = json!(0.4);
    assert!(NativePerformanceSourceAsset::from_native(&p.bases[0], recipe).is_err());
    let mut unrelated = p.bases[0].clone();
    unrelated.identity.instance_ref = "expression:other".into();
    assert!(p.native_sources[0].validate_basis(&unrelated).is_err());
    let catalog = PerformancePartCatalog::default().appended(&p).unwrap();
    let mut missing = catalog.snapshot();
    let count = missing.parts.len();
    missing
        .parts
        .retain(|p| !matches!(p.part, PerformancePart::NativeSource(_)));
    assert_eq!(missing.parts.len(), count - 1);
    assert!(PerformancePartCatalog::read(missing).is_err());
    let mut downgraded = catalog.snapshot();
    downgraded.schema = CATALOG_SCHEMA.into();
    assert!(PerformancePartCatalog::read(downgraded).is_err());
    let mut omitted = p.clone();
    omitted.native_sources.clear();
    omitted.schema = SCHEMA.into();
    let omitted = omitted.seal().unwrap();
    assert!(omitted
        .verify_native_source_replay(&[actual["source_assets"].clone()])
        .is_err());
    let mut kernel = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    create(&mut kernel);
    let native = edit(&mut kernel, &p);
    let bytes = expression_file::encode(&native).unwrap();
    let mut downgraded: Value = serde_json::from_str(&bytes).unwrap();
    downgraded["schema"] = json!(oi_cradle_kernel::expression_performance_storage::STORAGE_SCHEMA);
    assert!(expression_file::decode(&serde_json::to_string(&downgraded).unwrap()).is_err());
}

fn source_work() -> (Performance, Value) {
    let (mut full, actual) = prepared();
    let sin = scalar(
        full.bases[0].audio_determination["notes"][0]["phase_sin"]
            .as_f64()
            .unwrap(),
    );
    let cos = scalar(
        full.bases[0].audio_determination["notes"][0]["phase_cos"]
            .as_f64()
            .unwrap(),
    );
    let mut events = Vec::new();
    // 45k authored native operands: 24 independent simultaneous touches, exact
    // current native carrier phase, no fabricated application receipts.
    for group in 0..625u64 {
        let at = group * 900 * u64::from(full.sample_rate) / 625;
        for voice in 0..24u64 {
            let touch = group * 24 + voice + 1;
            events.push(TimedEvent(
                Counter(touch * 3 - 2),
                Counter(at),
                0,
                0,
                EventAction::NoteOn(Counter(touch), Counter(touch), 0, scalar(0.4), sin, cos),
            ));
            events.push(TimedEvent(
                Counter(touch * 3 - 1),
                Counter(at + 200),
                0,
                0,
                EventAction::Expression(Counter(touch), scalar(0.7), full.pitches[0].hertz),
            ));
            events.push(TimedEvent(
                Counter(touch * 3),
                Counter(at + 400),
                0,
                0,
                EventAction::NoteOff(Counter(touch)),
            ));
        }
    }
    events.sort_by_key(|e| (e.sample(), e.sequence()));
    full.pages = events
        .chunks(RETAINED_PAGE_EVENTS)
        .map(|e| EventPage { events: e.to_vec() })
        .collect();
    full = full.seal().unwrap();
    assert_eq!(full.event_count(), 45_000);
    (full, actual)
}
#[test]
fn actual_fifteen_minute_editions_share_one_complete_source_asset_without_source_discard() {
    let (full, actual) = source_work();
    let events: Vec<_> = full.events().cloned().collect();
    let mut kernel = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    create(&mut kernel);
    let native = edit(&mut kernel, &full);
    let mut custody = ActPerformanceCustody::default();
    let mut first = None;
    for block in 1..=180u64 {
        let mut edition = native.clone();
        edition.revision = block + 1;
        edition.scenes[0].revision = block + 1;
        let p = edition.scenes[0].performance.as_mut().unwrap();
        let selected: Vec<_> = events
            .iter()
            .filter(|e| e.sample() < block * 5 * u64::from(full.sample_rate))
            .cloned()
            .collect();
        p.pages = selected
            .chunks(RETAINED_PAGE_EVENTS)
            .map(|e| EventPage { events: e.to_vec() })
            .collect();
        *p = p.clone().seal().unwrap();
        if block == 1 {
            first = Some(edition.clone());
        }
        custody = custody.appended(&edition).unwrap();
    }
    assert_eq!(custody.editions().len(), 180);
    assert!(custody.encoded_bytes().unwrap() <= expression_file::FILE_BYTES);
    let stored = custody.snapshot();
    assert_eq!(
        stored.schema,
        oi_cradle_kernel::expression_performance_storage::SOURCE_ACT_CUSTODY_SCHEMA
    );
    let sources: usize = stored
        .performance_catalogs
        .values()
        .map(|c| {
            c.parts
                .iter()
                .filter(|p| matches!(p.part, PerformancePart::NativeSource(_)))
                .count()
        })
        .sum();
    assert_eq!(sources, 1);
    let reopened = ActPerformanceCustody::read(stored).unwrap();
    assert_eq!(reopened.restore(0).unwrap(), first.unwrap());
    let last = reopened.restore(179).unwrap();
    assert_eq!(last.scenes[0].performance.as_ref().unwrap(), &full);
    last.scenes[0].performance.as_ref().unwrap().native_sources[0]
        .verify_native_replay(&full.bases[0], &actual["source_assets"])
        .unwrap();
}

#[test]
fn rehashed_omitted_native_defaults_and_alias_amplification_refuse_before_expansion() {
    let (performance, _) = prepared();
    let mut kernel = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    create(&mut kernel);
    let native = edit(&mut kernel, &performance);
    let encoded = expression_file::encode(&native).unwrap();
    let mut file: Value = serde_json::from_str(&encoded).unwrap();
    assert!(file["document"]["scenes"][0]
        .as_object_mut()
        .unwrap()
        .remove("body")
        .is_some());
    // Native Option default would reconstruct exactly the original hash. Raw
    // bytes still have to be canonical before admission and size prediction.
    assert!(
        expression_file::decode(&serde_json::to_string(&file).unwrap())
            .unwrap_err()
            .contains("canonical")
    );
    let custody = ActPerformanceCustody::default().appended(&native).unwrap();
    let mut stored = custody.snapshot();
    let old_ref = stored.documents[0].scenes[0].scene_part.clone();
    let literal = stored
        .literals
        .iter_mut()
        .find(|l| l.r#ref == old_ref)
        .unwrap();
    assert!(literal
        .value
        .as_object_mut()
        .unwrap()
        .remove("body")
        .is_some());
    literal.r#ref = expression_file::digest(&serde_json::to_vec(&literal.value).unwrap());
    stored.documents[0].scenes[0].scene_part = literal.r#ref.clone();
    assert!(ActPerformanceCustody::read(stored)
        .unwrap_err()
        .contains("canonical"));
    // An honestly rehashed repeated Scene alias must be counted once per
    // selected Document occurrence, irrespective of dictionary deduplication.
    let (full, _) = source_work();
    let large = edit(&mut kernel, &full);
    let custody = ActPerformanceCustody::default().appended(&large).unwrap();
    let mut amplified = custody.snapshot();
    amplified.documents[0].scenes = vec![amplified.documents[0].scenes[0].clone(); 64];
    // Claiming a small expansion never licenses aliases; restore measures
    // canonical fields and every Scene/performance occurrence before cloning.
    let result = ActPerformanceCustody::read(amplified).and_then(|c| c.restore(0));
    assert!(result.is_err());
    assert_eq!(expression_file::decode(&encoded).unwrap(), native);
}

#[test]
fn genuine_valid_distinct_protected_native_occasions_cannot_cross_context_or_world() {
    let path = std::env::var("QL_RETAINED_PERFORMANCE_CONTEXT_FIXTURE")
        .expect("normal gate must produce genuine native protected context variants");
    let contexts: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    assert_eq!(
        contexts["schema"],
        "ql.retained-performance-context-fixture/v1"
    );
    let bases: Vec<PerformanceBasis> = contexts["variants"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| {
            serde_json::from_value::<PerformanceBasis>(v["basis"].clone())
                .unwrap()
                .seal()
                .unwrap()
        })
        .collect();
    assert_eq!(bases.len(), 3);
    for basis in &bases {
        basis.validate().unwrap();
        assert!(basis.context.private);
    }
    assert_ne!(bases[0].m4_episode, bases[1].m4_episode);
    assert_ne!(bases[0].context.context, bases[1].context.context);
    assert_ne!(
        bases[0].context.protected_state,
        bases[1].context.protected_state
    );
    assert_eq!(bases[2].context.kind, ContextKind::Shared);
    let asset =
        NativePerformanceSourceAsset::from_native(&bases[0], contexts["source_assets"].clone())
            .unwrap();
    assert!(asset.validate_basis(&bases[1]).is_err());
    assert!(asset.validate_basis(&bases[2]).is_err());
    let (mut personal_performance, _) = prepared();
    personal_performance.bases[0] = bases[0].clone();
    personal_performance.native_sources = vec![asset.clone()];
    personal_performance = personal_performance.seal().unwrap();
    let other = &bases[1];
    let current = other
        .sources
        .iter()
        .chain(&other.required_assets)
        .chain([&other.context.context, &other.context.receiver])
        .chain(other.context.source_occasion.iter())
        .chain(other.context.protected_state.iter())
        .chain(other.context.consent.iter())
        .map(|r| (r.r#ref.clone(), r.clone()))
        .collect();
    let readiness = personal_performance.readiness(&current, true).unwrap();
    assert!(!readiness.ready);
    assert!(readiness.issues.iter().any(|i| i.reference
        == bases[0].context.protected_state.as_ref().unwrap().r#ref
        && i.kind == "missing_native_reading"));
    assert!(readiness.issues.iter().any(
        |i| i.reference == bases[0].context.context.r#ref && i.kind == "missing_native_reading"
    ));

    let (world, _) = prepared();
    let episode = bases[0].m4_episode.as_ref().unwrap();
    // Actual valid native episode, not a malformed context or instance-only edit.
    let mut leak = contexts["source_assets"].clone();
    leak["original_native_input"]["source_receipts"]
        .as_array_mut()
        .unwrap()
        .push(episode.clone());
    let original = leak["original_native_input"].clone();
    leak["physical_consumer_projection"]["original_native_input"] = original.clone();
    let projection = leak["physical_consumer_projection"].clone();
    let old_original = contexts["source_assets"]["original_native_input"]["source_receipts"]
        .as_array()
        .unwrap();
    let mut receipts = original["source_receipts"].as_array().unwrap().clone();
    for extra in contexts["source_assets"]["native_basis"]["input"]["source_receipts"]
        .as_array()
        .unwrap()
        .iter()
        .skip(old_original.len())
    {
        if extra["schema"] == "ql.retained-physical-consumer-projection/v1" {
            receipts.push(projection.clone());
        } else {
            receipts.push(extra.clone());
        }
    }
    leak["native_basis"]["input"]["source_receipts"] = json!(receipts);
    assert!(
        NativePerformanceSourceAsset::from_native(&world.bases[0], leak.clone())
            .unwrap_err()
            .contains("protected occasion")
    );
    // The SAME valid native original occasion may be privately retained. A
    // different valid protected occasion is not authorized by identical M1-M3.
    let personal = NativePerformanceSourceAsset::from_native(&bases[0], leak.clone()).unwrap();
    assert!(personal.require_source_context(&bases[0]).is_err()); // unknown original source classification
    assert!(NativePerformanceSourceAsset::from_native(&bases[1], leak)
        .unwrap_err()
        .contains("protected occasion"));
    world.native_sources[0]
        .require_source_context(&world.bases[0])
        .unwrap();
    // This OTHER actual native owner output never admitted a SourceContext
    // witness. Keep its complete original bytes; a World Return label cannot
    // turn that unknown original into a public/played source.
    let unknown_bundle = &contexts["source_assets"];
    assert_ne!(
        unknown_bundle["source_context"]["availability"],
        "available"
    );
    let unknown =
        NativePerformanceSourceAsset::from_native(&world.bases[0], unknown_bundle.clone()).unwrap();
    assert!(unknown.requires_private_disclosure());
    assert!(unknown
        .require_source_context(&world.bases[0])
        .unwrap_err()
        .contains("classification unavailable"));
    assert!(unknown
        .verify_native_replay(&world.bases[0], unknown_bundle)
        .is_err());
    let mut unknown_work = world.clone();
    unknown_work.native_sources = vec![unknown];
    unknown_work = unknown_work.seal().unwrap();
    let catalog = PerformancePartCatalog::default()
        .appended(&unknown_work)
        .unwrap();
    assert!(catalog.requires_private_disclosure());
    let retained = PerformancePartCatalog::read(catalog.snapshot())
        .unwrap()
        .restore(0)
        .unwrap();
    assert_eq!(retained, unknown_work);
    assert_eq!(retained.native_sources[0].native_bundle(), unknown_bundle);
    let readiness = retained
        .readiness(&std::collections::BTreeMap::new(), true)
        .unwrap();
    assert!(!readiness.ready);
    assert!(readiness
        .issues
        .iter()
        .any(|i| i.kind == "native_source_context_unavailable"));
}
