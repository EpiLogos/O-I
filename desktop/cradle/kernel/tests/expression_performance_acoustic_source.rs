//! Genuine R5 producer data through the existing C part/file/Act law.
//! This is retained integrity, not a current Scene/source/clock permission.
use oi_cradle_kernel::expression_performance::*;
use oi_cradle_kernel::expression_performance_assets::PerformancePartCatalog;
use oi_cradle_kernel::expression_performance_source_asset::NativePerformanceSourceAsset;
use oi_cradle_kernel::expression_performance_storage::ActPerformanceCustody;
use oi_cradle_kernel::{Kernel, expression::Document, expression_file};
use serde_json::{Value, json};

fn original() -> Value {
    let path = std::env::var("QL_NATIVE_ACOUSTIC_SOURCE_REPLAY_ARTIFACT")
        .expect("actual complete normal R5 native source corpus required; no fallback");
    let data: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    assert_eq!(
        data["schema"],
        "ql.actual-native-acoustic-source-replay-component/v1"
    );
    assert_eq!(data["frames"].as_array().unwrap().len(), 6);
    assert_eq!(
        data["native_physical_source_history"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(
        data["native_acoustic_source_history"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
    data
}
fn history(frame: &Value, name: &str) -> Option<Vec<Value>> {
    let rows: Vec<Value> = serde_json::from_value(frame[name].clone()).unwrap();
    if rows.is_empty() { None } else { Some(rows) }
}
fn performance(actual: &Value) -> Performance {
    let mut bases = Vec::<PerformanceBasis>::new();
    let mut pitches = Vec::<Pitch>::new();
    let mut assets = Vec::new();
    let mut mapping = Vec::new();
    for frame in actual["frames"].as_array().unwrap() {
        let basis = serde_json::from_value::<PerformanceBasis>(frame["basis"].clone())
            .unwrap()
            .seal()
            .unwrap();
        let index = if let Some(index) = bases.iter().position(|old| old == &basis) {
            index
        } else {
            let index = bases.len();
            let mut source_pitches: Vec<Pitch> =
                serde_json::from_value(frame["pitches"].clone()).unwrap();
            for pitch in &mut source_pitches {
                pitch.basis = u16::try_from(index).unwrap();
            }
            pitches.extend(source_pitches);
            bases.push(basis.clone());
            index
        };
        let asset = NativePerformanceSourceAsset::from_native_with_source_histories(
            &basis,
            frame["source_assets"].clone(),
            history(frame, "native_physical_source_history"),
            history(frame, "native_acoustic_source_history"),
        )
        .unwrap();
        asset.require_source_context(&basis).unwrap();
        asset
            .verify_native_replay(&basis, &frame["source_assets"])
            .unwrap();
        mapping.push(index);
        assets.push(asset);
    }
    assert_eq!(mapping, [0, 1, 1, 1, 2, 2]);
    assert_eq!(bases.len(), 3);
    assert_eq!(assets.len(), 6);
    let rate = u32::try_from(
        bases[0].prepared_body["request"]["sample_rate"]
            .as_u64()
            .unwrap(),
    )
    .unwrap();
    Performance {
        schema: SOURCE_SCHEMA.into(),
        performance_ref: "performance:mixed-source/history".into(),
        sample_rate: rate,
        duration_samples: Counter(u64::from(rate)),
        ppq: 960,
        bases,
        pitches,
        native_sources: assets,
        native_recordings: vec![],
        native_reservations: vec![],
        layers: vec![Layer {
            layer_ref: "performance:mixed-source/layer".into(),
            title: "Actual original mixed source epochs".into(),
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
            mode: ReplayMode::SeededFromStart,
            max_reconstruction_samples: Counter(u64::from(rate)),
            model_revision: "ql.performance-checkpoint/v2".into(),
            event_tolerance_samples: 0,
            physical_tolerance: Scalar::new(1e-10).unwrap(),
            display_policy: "original-native-source-epochs".into(),
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
        other => panic!("actual ordinary Expression reply absent: {other:?}"),
    }
}
#[test]
#[ignore = "requires actual R5 native producer and complete original receiving/physical fixture gate"]
fn actual_mixed_source_epochs_keep_three_bases_six_sources_and_all_parts_file_act() {
    let actual = original();
    let p = performance(&actual);
    let sources = actual["frames"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["source_assets"].clone())
        .collect::<Vec<_>>();
    p.verify_native_source_epoch_replay(&sources).unwrap();
    // The original per-musical-basis API cannot silently mean full epochs.
    assert!(p.verify_native_source_replay(&sources).is_err());
    let catalog = PerformancePartCatalog::default().appended(&p).unwrap();
    let wire = serde_json::to_vec(&catalog.snapshot()).unwrap();
    let cold = PerformancePartCatalog::read(serde_json::from_slice(&wire).unwrap()).unwrap();
    assert_eq!(cold.restore(0).unwrap(), p);
    let mut kernel = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    expression(
        &mut kernel,
        json!({"operation":"create","expression_ref":"expression:mixed-source-history","title":"Original native mixed source epochs","actor":"agent:mixed-source-proof"}),
    );
    let before: Document = serde_json::from_value(
        expression(
            &mut kernel,
            json!({"operation":"inspect","expression_ref":"expression:mixed-source-history"}),
        )["document"]
            .clone(),
    )
    .unwrap();
    expression(
        &mut kernel,
        json!({"operation":"edit","expression_ref":before.expression_ref,"expected_revision":before.revision,"actor":"agent:mixed-source-proof","changes":[{"change":"scene_performance_set","scene_ref":before.scenes[0].scene_ref,"performance":p}]}),
    );
    let document: Document = serde_json::from_value(
        expression(
            &mut kernel,
            json!({"operation":"inspect","expression_ref":"expression:mixed-source-history"}),
        )["document"]
            .clone(),
    )
    .unwrap();
    let encoded = expression_file::encode(&document).unwrap();
    let decoded = expression_file::decode(&encoded).unwrap();
    assert_eq!(decoded, document);
    let custody = ActPerformanceCustody::default().appended(&decoded).unwrap();
    let cold = ActPerformanceCustody::read(
        serde_json::from_slice(&serde_json::to_vec(&custody.snapshot()).unwrap()).unwrap(),
    )
    .unwrap();
    assert_eq!(cold.restore(0).unwrap(), document);
    let retained = cold.restore(0).unwrap().scenes[0]
        .performance
        .clone()
        .unwrap();
    for (index, asset) in retained.native_sources.iter().enumerate() {
        assert_eq!(
            asset.native_bundle(),
            &actual["frames"][index]["source_assets"]
        );
        assert_eq!(
            asset.native_physical_source_history().unwrap_or(&[]),
            actual["frames"][index]["native_physical_source_history"]
                .as_array()
                .unwrap()
        );
        assert_eq!(
            asset.native_acoustic_source_history().unwrap_or(&[]),
            actual["frames"][index]["native_acoustic_source_history"]
                .as_array()
                .unwrap()
        );
    }
    let unchanged = serde_json::to_vec(&retained.native_sources[0]).unwrap();
    let value: Value = serde_json::from_slice(&unchanged).unwrap();
    assert!(value.get("native_acoustic_source_history").is_none());
    assert!(value.get("native_physical_source_history").is_none());
    assert_eq!(
        serde_json::to_vec(
            &serde_json::from_slice::<NativePerformanceSourceAsset>(&unchanged).unwrap()
        )
        .unwrap(),
        unchanged
    );
}
#[test]
#[ignore = "requires actual complete R5 native producer corpus; no reconstructed ACK"]
fn actual_mixed_source_missing_reordered_cross_epoch_context_and_ack_never_qualify() {
    let actual = original();
    let p = performance(&actual);
    let frame = &actual["frames"][5];
    let bundle = &frame["source_assets"];
    let basis = &p.bases[2];
    let physical = history(frame, "native_physical_source_history").unwrap();
    let acoustic = history(frame, "native_acoustic_source_history").unwrap();
    for path in [
        "/source/before_current_receiving",
        "/source/history_origin_sample",
        "/source/immutable_original_input",
        "/native_application/payload/receiving_replacement/after_manifest",
        "/native_application/reading/physical/eigenbasis_identity",
        "/native_application/reading/transport_epoch",
    ] {
        let mut changed = acoustic.clone();
        *changed[1].pointer_mut(path).unwrap() = Value::Null;
        assert!(
            NativePerformanceSourceAsset::from_native_with_source_histories(
                basis,
                bundle.clone(),
                Some(physical.clone()),
                Some(changed)
            )
            .is_err(),
            "{path}"
        );
    }
    let mut lost = acoustic.clone();
    lost.remove(0);
    assert!(
        NativePerformanceSourceAsset::from_native_with_source_histories(
            basis,
            bundle.clone(),
            Some(physical.clone()),
            Some(lost)
        )
        .is_err()
    );
    let mut reordered = acoustic.clone();
    reordered.swap(1, 2);
    assert!(
        NativePerformanceSourceAsset::from_native_with_source_histories(
            basis,
            bundle.clone(),
            Some(physical.clone()),
            Some(reordered)
        )
        .is_err()
    );
    let prospective = NativePerformanceSourceAsset::from_native(basis, bundle.clone()).unwrap();
    assert!(prospective.requires_private_disclosure());
    assert!(prospective.require_source_context(basis).is_err());
    let prepared = NativePerformanceSourceAsset::from_native_with_source_histories(
        basis,
        bundle.clone(),
        Some(physical.clone()),
        None,
    )
    .unwrap();
    assert!(prepared.requires_private_disclosure());
    assert!(prepared.require_source_context(basis).is_err());
    let earlier = &actual["frames"][4];
    assert_eq!(earlier["basis"], frame["basis"]);
    assert!(
        NativePerformanceSourceAsset::from_native_with_source_histories(
            basis,
            bundle.clone(),
            history(earlier, "native_physical_source_history"),
            history(earlier, "native_acoustic_source_history")
        )
        .is_err()
    );
    for path in [
        "/acoustic_transition_history/2/before_acoustic",
        "/receiving_source_inputs/return_context/context",
        "/acoustic_receiving/current_receiving/source_payload_context/source_inputs_sha256",
    ] {
        let mut changed = bundle.clone();
        *changed.pointer_mut(path).unwrap() = Value::Null;
        let result = NativePerformanceSourceAsset::from_native_with_source_histories(
            basis,
            changed,
            Some(physical.clone()),
            Some(acoustic.clone()),
        );
        assert!(
            result.is_err() || result.unwrap().require_source_context(basis).is_err(),
            "{path}"
        );
    }
    let exact = NativePerformanceSourceAsset::from_native_with_source_histories(
        basis,
        bundle.clone(),
        Some(physical),
        Some(acoustic),
    )
    .unwrap();
    assert_eq!(exact, p.native_sources[5]);
    exact.require_source_context(basis).unwrap();
}

#[test]
#[ignore = "requires actual complete R5 corpus; no rebuilt source or ACK"]
fn actual_equal_count_repeated_basis_cannot_replay_the_first_epoch_twice() {
    use oi_cradle_kernel::expression_performance_delivery::{SelectedPerformance, Selection};
    use oi_cradle_kernel::expression_act_store::ActStore;
    let actual = original();
    let original = performance(&actual);
    let mut repeated = original.clone();
    repeated.bases = vec![original.bases[2].clone(), original.bases[2].clone()];
    repeated.pitches = original.pitches.iter().filter(|pitch| pitch.basis == 2).cloned().map(|mut pitch| { pitch.basis = 0; pitch }).collect();
    repeated.native_sources = original.native_sources[4..6].to_vec();
    repeated = repeated.seal().unwrap();
    let complete = vec![actual["frames"][4]["source_assets"].clone(), actual["frames"][5]["source_assets"].clone()];
    let omitted = vec![complete[0].clone(), complete[0].clone()];
    assert_eq!(repeated.bases.len(), repeated.native_sources.len());
    assert_eq!(repeated.bases[0], repeated.bases[1]);
    assert_ne!(complete[0], complete[1]);
    assert!(repeated.verify_native_source_replay(&omitted).is_err());
    repeated.verify_native_source_epoch_replay(&complete).unwrap();
    assert!(repeated.verify_native_source_epoch_replay(&omitted).is_err());
    let mut kernel = Kernel::new(oi_cradle_kernel::flow::CentralClient::discover());
    expression(&mut kernel,json!({"operation":"create","expression_ref":"expression:equal-count-source-epochs","title":"Original native epochs","actor":"agent:source-epochs"}));
    let before:Document=serde_json::from_value(expression(&mut kernel,json!({"operation":"inspect","expression_ref":"expression:equal-count-source-epochs"}))["document"].clone()).unwrap();
    expression(&mut kernel,json!({"operation":"edit","expression_ref":before.expression_ref,"expected_revision":before.revision,"actor":"agent:source-epochs","changes":[{"change":"scene_performance_set","scene_ref":before.scenes[0].scene_ref,"performance":repeated}]}));
    let document:Document=serde_json::from_value(expression(&mut kernel,json!({"operation":"inspect","expression_ref":"expression:equal-count-source-epochs"}))["document"].clone()).unwrap();
    let performance=document.scenes[0].performance.as_ref().unwrap();
    let home=std::path::PathBuf::from(std::env::var("OI_RETAINED_PERFORMANCE_TEST_HOME").expect("normal native same-store fixture home required")).join(format!("equal-count-source-epochs-{}",std::process::id()));
    assert!(!home.exists(),"preserve previous genuine test custody");
    kernel.attach_act_store(&home).unwrap();
    let request=json!({"operation":"act_retained_perform","act_ref":"act:equal-count-source-epochs","expression_ref":document.expression_ref,"expected_revision":document.revision,"expected_act_revision":null,"actor":"agent:source-epochs","summary":"Retain exact genuine equal-count epochs","changes":[{"change":"scene_performance_set","scene_ref":document.scenes[0].scene_ref,"performance":performance}]});
    let outcome=kernel.apply(oi_cradle_kernel::KernelOp::ExpressionWorld{request:serde_json::from_value(request).unwrap()}).unwrap();
    match outcome.result { oi_cradle_kernel::KernelOpResult::ExpressionWorld{data}=>assert_eq!(data["state"],"act_running"),other=>panic!("actual native Act receipt absent:{other:?}") };
    let act=ActStore::at_home(&home).read_retained("act:equal-count-source-epochs").unwrap().unwrap();
    let selected=SelectedPerformance::from_act(&act,&Selection{expected_act_revision:act.revision,edition_position:0,scene_ref:document.scenes[0].scene_ref.clone(),expected_expression_revision:document.revision,expected_scene_revision:document.scenes[0].revision,performance_digest:performance.content_digest.clone()}).unwrap();
    selected.verify_native_sources(&complete).unwrap();
    assert!(selected.verify_native_sources(&omitted).is_err());
}
