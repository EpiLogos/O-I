//! Actual native Form/M4 producer corpus through the existing C source, part,
//! file and Act owners. These tests confer no current Scene/clock/lease grant.
use oi_cradle_kernel::expression_performance::*;
use oi_cradle_kernel::expression_performance_assets::PerformancePartCatalog;
use oi_cradle_kernel::expression_performance_source_asset::NativePerformanceSourceAsset;
use oi_cradle_kernel::expression_performance_storage::ActPerformanceCustody;
use oi_cradle_kernel::{Kernel, expression::Document, expression_file};
use serde_json::{Value, json};

fn corpus() -> Value {
    let path = std::env::var("QL_NATIVE_PHYSICAL_SOURCE_REPLAY_ARTIFACT")
        .expect("genuine native Form/M4 worker producer corpus required; no fallback");
    let bytes = std::fs::read(path).unwrap();
    let actual: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(
        actual["schema"],
        "ql.actual-native-physical-source-replay-component/v1"
    );
    let frames = actual["frames"].as_array().unwrap();
    assert_eq!(frames.len(), 3);
    assert_eq!(
        frames
            .iter()
            .map(|f| f["source_sample"].as_str().unwrap())
            .collect::<Vec<_>>(),
        ["0", "512", "1024"]
    );
    assert_eq!(
        actual["native_physical_source_history"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    actual
}
fn sources(
    actual: &Value,
) -> (
    Vec<PerformanceBasis>,
    Vec<NativePerformanceSourceAsset>,
    Vec<Pitch>,
) {
    let mut bases = Vec::new();
    let mut assets = Vec::new();
    let mut pitches = Vec::new();
    for (index, frame) in actual["frames"].as_array().unwrap().iter().enumerate() {
        let basis: PerformanceBasis = serde_json::from_value(frame["basis"].clone()).unwrap();
        let basis = basis.seal().unwrap();
        let history: Vec<Value> =
            serde_json::from_value(frame["native_physical_source_history"].clone()).unwrap();
        assert_eq!(history.len(), index);
        assert_eq!(
            history,
            actual["native_physical_source_history"].as_array().unwrap()[..index]
        );
        let asset = NativePerformanceSourceAsset::from_native_with_physical_history(
            &basis,
            frame["source_assets"].clone(),
            if history.is_empty() {
                None
            } else {
                Some(history)
            },
        )
        .unwrap();
        asset.require_source_context(&basis).unwrap();
        asset
            .verify_native_replay(&basis, &frame["source_assets"])
            .unwrap();
        let mut native_pitches: Vec<Pitch> =
            serde_json::from_value(frame["pitches"].clone()).unwrap();
        for pitch in &mut native_pitches {
            pitch.basis = u16::try_from(index).unwrap();
        }
        pitches.extend(native_pitches);
        bases.push(basis);
        assets.push(asset);
    }
    (bases, assets, pitches)
}
fn performance(actual: &Value) -> Performance {
    let (bases, native_sources, pitches) = sources(actual);
    let rate = u32::try_from(
        bases[0].prepared_body["request"]["sample_rate"]
            .as_u64()
            .unwrap(),
    )
    .unwrap();
    Performance {
        schema: SOURCE_SCHEMA.into(),
        performance_ref: "performance:physical-history/current".into(),
        sample_rate: rate,
        duration_samples: Counter(u64::from(rate)),
        ppq: 960,
        bases,
        pitches,
        native_sources,
        native_recordings: vec![],
        native_reservations: vec![],
        layers: vec![Layer {
            layer_ref: "performance:physical-history/layer".into(),
            title: "Actual original physical source history".into(),
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
            model_revision: "ql.performance-checkpoint/v2".into(),
            event_tolerance_samples: 0,
            physical_tolerance: Scalar::new(1e-10).unwrap(),
            display_policy: "original-native-body-lineage".into(),
        },
        checkpoints: vec![],
        content_digest: String::new(),
    }
    .seal()
    .unwrap()
}
fn expression(kernel: &mut Kernel, request: Value) -> Value {
    match kernel
        .apply(oi_cradle_kernel::KernelOp::Expression {
            request: serde_json::from_value(request).unwrap(),
        })
        .unwrap()
        .result
    {
        oi_cradle_kernel::KernelOpResult::Expression { data } => data,
        _ => panic!("actual native Expression response missing"),
    }
}
#[test]
#[ignore = "requires the genuine native Form/M4 worker corpus from the normal fixture gate"]
fn actual_form_source_applications_preserve_all_bodies_through_parts_file_and_act() {
    let actual = corpus();
    let p = performance(&actual);
    let catalog = PerformancePartCatalog::default().appended(&p).unwrap();
    let encoded = serde_json::to_vec(&catalog.snapshot()).unwrap();
    let reopened = PerformancePartCatalog::read(serde_json::from_slice(&encoded).unwrap()).unwrap();
    assert_eq!(reopened.restore(0).unwrap(), p);
    let mut kernel = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    expression(
        &mut kernel,
        json!({"operation":"create","expression_ref":"expression:physical-history",
        "title":"Native original physical source custody","actor":"agent:physical-source-proof"}),
    );
    let before: Document = serde_json::from_value(
        expression(
            &mut kernel,
            json!({"operation":"inspect",
        "expression_ref":"expression:physical-history"}),
        )["document"]
            .clone(),
    )
    .unwrap();
    expression(
        &mut kernel,
        json!({"operation":"edit","expression_ref":before.expression_ref,
        "expected_revision":before.revision,"actor":"agent:physical-source-proof",
        "changes":[{"change":"scene_performance_set","scene_ref":before.scenes[0].scene_ref,"performance":p}]}),
    );
    let document: Document = serde_json::from_value(
        expression(
            &mut kernel,
            json!({"operation":"inspect",
        "expression_ref":"expression:physical-history"}),
        )["document"]
            .clone(),
    )
    .unwrap();
    let wire = expression_file::encode(&document).unwrap();
    let decoded = expression_file::decode(&wire).unwrap();
    assert_eq!(decoded, document);
    assert_eq!(expression_file::encode(&decoded).unwrap(), wire);
    let retained = ActPerformanceCustody::default().appended(&decoded).unwrap();
    let saved = serde_json::to_vec(&retained.snapshot()).unwrap();
    let cold = ActPerformanceCustody::read(serde_json::from_slice(&saved).unwrap()).unwrap();
    assert_eq!(cold.restore(0).unwrap(), document);
    let restored = cold.restore(0).unwrap().scenes[0]
        .performance
        .clone()
        .unwrap();
    for (index, asset) in restored.native_sources.iter().enumerate() {
        assert_eq!(
            asset.native_bundle(),
            &actual["frames"][index]["source_assets"]
        );
        if index == 0 {
            assert!(asset.native_physical_source_history().is_none());
        } else {
            assert_eq!(
                asset.native_physical_source_history().unwrap(),
                &actual["native_physical_source_history"].as_array().unwrap()[..index]
            );
        }
    }
}
#[test]
#[ignore = "requires the genuine native Form/M4 worker corpus from the normal fixture gate"]
fn actual_physical_history_loss_reorder_context_and_prepared_only_never_qualify_as_applied() {
    let actual = corpus();
    let (bases, assets, _) = sources(&actual);
    let frame = &actual["frames"][2];
    let basis = &bases[2];
    let original = &frame["source_assets"];
    let history: Vec<Value> =
        serde_json::from_value(frame["native_physical_source_history"].clone()).unwrap();
    let prospective = NativePerformanceSourceAsset::from_native(basis, original.clone()).unwrap();
    assert!(prospective.requires_private_disclosure());
    assert!(prospective.require_source_context(basis).is_err());
    assert!(!assets[2].requires_private_disclosure());
    for path in [
        "/source/native_m3_receipt",
        "/native_application/payload/physical_transition/original_native_request_id",
        "/native_application/payload/physical_transition/after_native_preparation",
        "/native_application/reading/physical/eigenbasis_identity",
        "/native_application/reading/transport_epoch",
    ] {
        let mut changed = history.clone();
        *changed[0].pointer_mut(path).unwrap() = Value::Null;
        assert!(
            NativePerformanceSourceAsset::from_native_with_physical_history(
                basis,
                original.clone(),
                Some(changed)
            )
            .is_err(),
            "{path}"
        );
    }
    let mut lost = history.clone();
    lost.remove(0);
    assert!(
        NativePerformanceSourceAsset::from_native_with_physical_history(
            basis,
            original.clone(),
            Some(lost)
        )
        .is_err()
    );
    let mut reordered = history.clone();
    reordered.swap(0, 1);
    assert!(
        NativePerformanceSourceAsset::from_native_with_physical_history(
            basis,
            original.clone(),
            Some(reordered)
        )
        .is_err()
    );
    for path in [
        "/operative_native_input",
        "/physical_transition_history/1/before_configuration",
        "/acoustic_receiving/current_receiving/source_payload_context/native_admission_sha256",
        "/receiving_source_inputs/return_context/context",
    ] {
        let mut changed = original.clone();
        *changed.pointer_mut(path).unwrap() = Value::Null;
        let result = NativePerformanceSourceAsset::from_native_with_physical_history(
            basis,
            changed,
            Some(history.clone()),
        );
        assert!(
            result.is_err() || result.unwrap().require_source_context(basis).is_err(),
            "{path}"
        );
    }
    // Original no-transition source remains byte-compatible and has no new field.
    let original_asset = serde_json::to_vec(&assets[0]).unwrap();
    assert!(
        serde_json::from_slice::<Value>(&original_asset)
            .unwrap()
            .get("native_physical_source_history")
            .is_none()
    );
    assert_eq!(
        serde_json::to_vec(
            &serde_json::from_slice::<NativePerformanceSourceAsset>(&original_asset).unwrap()
        )
        .unwrap(),
        original_asset
    );
}
