//! Real ordinary native Act enrollment and attached durable store. Source data
//! originates in the mandatory native Return producer. This test verifies the
//! closed C aperture only; it cannot mint an E Source or native timing witness.
use crate::expression::Document;
use crate::expression_act_store::{ActStore, Written};
use crate::expression_performance::*;
use crate::expression_performance_delivery::Selection;
use crate::expression_world::Act;
use crate::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};

fn invoke(kernel: &mut Kernel, request: Value, world: bool) -> Value {
    let operation = if world {
        KernelOp::ExpressionWorld {
            request: serde_json::from_value(request).unwrap(),
        }
    } else {
        KernelOp::Expression {
            request: serde_json::from_value(request).unwrap(),
        }
    };
    match kernel.apply(operation).unwrap().result {
        KernelOpResult::Expression { data } | KernelOpResult::ExpressionWorld { data } => data,
        other => panic!("actual native Document/Act operation expected: {other:?}"),
    }
}
fn original_performance() -> Performance {
    let file = std::env::var("QL_RETAINED_PERFORMANCE_FIXTURE")
        .expect("mandatory actual native Return/basis/pitches producer");
    let bytes = std::fs::read(file).unwrap();
    assert!(bytes.len() <= 32 * 1024 * 1024);
    let original: Value = serde_json::from_slice(&bytes).unwrap();
    let basis = serde_json::from_value::<PerformanceBasis>(original["basis"].clone())
        .unwrap()
        .seal()
        .unwrap();
    Performance {
        schema: SCHEMA.into(),
        performance_ref: "performance:cold-source-aperture".into(),
        sample_rate: 48000,
        duration_samples: Counter(43200000),
        ppq: 960,
        bases: vec![basis],
        pitches: serde_json::from_value(original["pitches"].clone()).unwrap(),
        layers: vec![Layer {
            layer_ref: "layer:cold-source-aperture".into(),
            title: "Actual selected source".into(),
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
}
#[test]
fn actual_saved_act_aperture_preserves_original_result_on_external_store_refusal() {
    let root = std::path::PathBuf::from(
        std::env::var("OI_RETAINED_PERFORMANCE_TEST_HOME")
            .expect("normal native gate supplies bounded unique Act test custody"),
    );
    let home = root.join(format!("cold-source-aperture-{}", std::process::id()));
    assert!(
        !home.exists(),
        "do not overwrite prior original native test custody"
    );
    let mut kernel = Kernel::new(CentralClient::discover());
    kernel.attach_act_store(&home).unwrap();
    let created = invoke(
        &mut kernel,
        json!({"operation":"create",
        "expression_ref":"expression:cold-source-aperture", "title":"Actual cold source",
        "actor":"agent:cold-source-aperture"}),
        false,
    );
    let before: Document = serde_json::from_value(created["document"].clone()).unwrap();
    let performance = original_performance();
    let edited = invoke(
        &mut kernel,
        json!({"operation":"edit",
        "expression_ref":before.expression_ref,"expected_revision":before.revision,
        "actor":"agent:cold-source-aperture","changes":[{"change":"scene_performance_set",
        "scene_ref":before.scenes[0].scene_ref,"performance":performance}]}),
        false,
    );
    let document: Document = serde_json::from_value(edited["document"].clone()).unwrap();
    let enrollment = invoke(
        &mut kernel,
        json!({"operation":"act_retained_perform",
        "act_ref":"act:cold-source-aperture", "expression_ref":document.expression_ref,
        "expected_revision":document.revision,"expected_act_revision":null,
        "actor":"agent:cold-source-aperture","summary":"Original native source custody",
        "changes":[{"change":"scene_performance_set","scene_ref":document.scenes[0].scene_ref,
        "performance":document.scenes[0].performance}]}),
        true,
    );
    assert_eq!(enrollment["state"], "act_running");
    let store = ActStore::at_home(&home);
    let act = store
        .read_retained("act:cold-source-aperture")
        .unwrap()
        .unwrap();
    let selected_document = crate::expression_performance_act::selected_document(&act, 0).unwrap();
    let selection = Selection {
        expected_act_revision: act.revision,
        edition_position: 0,
        scene_ref: selected_document.scenes[0].scene_ref.clone(),
        expected_expression_revision: selected_document.revision,
        expected_scene_revision: selected_document.scenes[0].revision,
        performance_digest: selected_document.scenes[0]
            .performance
            .as_ref()
            .unwrap()
            .fingerprint()
            .unwrap(),
    };
    let exact_saved_act = crate::expression_performance_act::encode(&act).unwrap();
    let reopened_act: Act =
        crate::expression_performance_act::decode_bytes(&exact_saved_act, 64 * 1024 * 1024)
            .unwrap();
    assert_eq!(reopened_act, act);
    let mut cold = Kernel::new(CentralClient::discover());
    cold.attach_act_store(&home).unwrap();
    let accepted = cold
        .with_native_act_source_custody(&act.act_ref, &selection, |_, reader| {
            assert_eq!(reader.document(), &selected_document);
            assert_eq!(reader.scene(), &selected_document.scenes[0]);
            assert_eq!(
                reader.performance(),
                selected_document.scenes[0].performance.as_ref().unwrap()
            );
            reader.compile_with(|manifest, _| Ok(manifest.clone()))
        })
        .unwrap();
    accepted.currentness.unwrap();
    let complete_original_manifest = accepted.result.unwrap();
    assert_eq!(
        complete_original_manifest["performance"],
        serde_json::to_value(&performance).unwrap()
    );
    let stale = cold
        .with_native_act_source_custody(&act.act_ref, &selection, |_, reader| {
            reader.compile_with(|manifest, _| {
                let mut changed = store
                    .read_retained(&act.act_ref)?
                    .ok_or("actual stored Act absent")?;
                changed.summary = "Real external same-store owner successor".into();
                changed.revision += 1;
                if store.write(&changed, Some(act.revision))? != Written::Written {
                    return Err("actual external native Act CAS refused".into());
                }
                Ok(manifest.clone())
            })
        })
        .unwrap();
    assert_eq!(
        stale.result.unwrap(),
        complete_original_manifest,
        "post-source refusal must retain the exact original callback result"
    );
    assert!(stale.currentness.unwrap_err().contains("changed during"));
    let mut delivered = false;
    assert!(cold
        .with_native_act_source_custody(&act.act_ref, &selection, |_, _| {
            delivered = true;
            Ok(())
        })
        .is_err());
    assert!(
        !delivered,
        "stale actual Act selection must refuse before native delivery"
    );
    let changed = store.read_retained(&act.act_ref).unwrap().unwrap();
    let mut fresh = selection;
    fresh.expected_act_revision = changed.revision;
    let refused_consumer = cold
        .with_native_act_source_custody(&act.act_ref, &fresh, |_, _| {
            Err::<(), String>("original actual consumer refusal".into())
        })
        .unwrap();
    refused_consumer.currentness.unwrap();
    assert_eq!(
        refused_consumer.result.unwrap_err(),
        "original actual consumer refusal"
    );
    assert_eq!(
        crate::expression_performance_act::encode(&act).unwrap(),
        exact_saved_act
    );
}
