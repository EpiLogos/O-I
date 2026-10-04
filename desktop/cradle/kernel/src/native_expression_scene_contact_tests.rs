//! Real CurrentDocument source issuer -> normal Kernel contact/cut/render ->
//! native recorded page -> ordinary file and cold native Act store readback.
//! The fixture is the SAME actual World opener used by the original recording
//! gate. This child cannot mint a SceneOwner, channel, occurrence or lease.
use super::*;
use crate::expression_performance::{CheckpointBinding, EventAction};
use crate::native_expression::recording_channel::NativeSceneRecordingRequest;
use std::path::Path;

fn document(kernel: &mut crate::Kernel, reference: &str) -> Document {
    let outcome = kernel
        .apply(crate::KernelOp::Expression {
            request: ExpressionRequest::Inspect {
                expression_ref: reference.into(),
            },
        })
        .unwrap();
    let crate::KernelOpResult::Expression { data } = outcome.result else {
        panic!("actual native Document inspect changed result family")
    };
    serde_json::from_value(data["document"].clone()).unwrap()
}
fn scene<'a>(doc: &'a Document, scene_ref: &str) -> &'a crate::expression::Scene {
    doc.scenes
        .iter()
        .find(|s| s.scene_ref == scene_ref)
        .unwrap()
}
fn request(kernel: &crate::Kernel, doc: &Document, scene_ref: &str, lease: &str) -> Value {
    json!({"request_id":(kernel.native_expression.active.as_ref().unwrap().last_request_id+1).to_string(),
        "lease":lease,"expression_ref":doc.expression_ref,"document_revision":doc.revision,
        "scene_ref":scene_ref,"scene_revision":scene(doc,scene_ref).revision,
        "actor":"agent:current-instrument-proof","basis":0,"layer":0})
}
fn contact(kernel: &mut crate::Kernel, operation: &str, request: Value) -> Value {
    let request = serde_json::from_value(json!({"operation":operation,"request":request})).unwrap();
    let outcome = kernel
        .apply(crate::KernelOp::NativeExpression { request })
        .unwrap();
    let crate::KernelOpResult::NativeExpression { data } = outcome.result else {
        panic!("actual normal Contact dispatch changed result family")
    };
    assert_eq!(data["accepted"], true, "{data}");
    assert_eq!(data["currentness"], json!({"Ok":null}));
    data
}
fn cut(
    kernel: &mut crate::Kernel,
    doc: &Document,
    scene_ref: &str,
    lease: &str,
    reference: &str,
    directory: &Path,
) -> (Document, Value, CheckpointBinding) {
    let id = kernel
        .native_expression
        .active
        .as_ref()
        .unwrap()
        .last_request_id
        + 1;
    let mut outcome = kernel
        .apply(crate::KernelOp::NativePerformanceRecording {
            request: NativeSceneRecordingRequest::SaveCut {
                request_id: id.to_string(),
                lease: lease.into(),
                expression_ref: doc.expression_ref.clone(),
                document_revision: doc.revision,
                scene_ref: scene_ref.into(),
                scene_revision: scene(doc, scene_ref).revision,
                actor: "agent:current-instrument-proof".into(),
                basis: 0,
                layer: 0,
                checkpoint_ref: reference.into(),
            },
        })
        .unwrap();
    kernel.finish_native_recording_cut_return(&mut outcome, Ok(directory.to_path_buf()));
    let crate::KernelOpResult::NativeExpression { data } = outcome.result else {
        panic!("actual native SaveCut changed result family")
    };
    assert_eq!(data["accepted"], true, "{data}");
    assert_eq!(data["original_cut_files"]["available"], true);
    assert_eq!(
        data["native_reply"]["result"]["host_receipt"]["request_id"],
        id.to_string()
    );
    assert_eq!(
        data["original_cut_files"]["files"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    let after = document(kernel, &doc.expression_ref);
    let actual_cut = scene(&after, scene_ref)
        .performance
        .as_ref()
        .unwrap()
        .checkpoints
        .iter()
        .find(|c| c.checkpoint_ref == reference)
        .unwrap()
        .clone();
    actual_cut.validate().unwrap();
    let files = &data["original_cut_files"];
    let path = std::path::PathBuf::from(files["directory"].as_str().unwrap());
    let checkpoint_descriptor = files["files"]
        .as_array()
        .unwrap()
        .iter()
        .find(|f| f["descriptor"]["kind"] == "recording.cut_checkpoint")
        .unwrap();
    let original: Value = serde_json::from_slice(
        &std::fs::read(path.join(checkpoint_descriptor["file"].as_str().unwrap())).unwrap(),
    )
    .unwrap();
    assert_eq!(
        original["payload"]["checkpoint"],
        actual_cut.native_management_wire().unwrap()
    );
    assert!(kernel.native_recording_cut_reply().is_none());
    (after, data, actual_cut)
}

pub(crate) fn actual_recording_trial(
    kernel: &mut crate::Kernel,
    original_doc: &Document,
    scene_ref: &str,
    lease: &str,
    home: &Path,
    original_pid: u32,
    born: &CheckpointBinding,
) {
    let performance = scene(original_doc, scene_ref).performance.as_ref().unwrap();
    assert_eq!(performance.checkpoints[0], *born);
    assert_eq!(
        performance
            .checkpoints
            .last()
            .unwrap()
            .unscored_queued_inputs
            .len(),
        1
    );
    assert!(performance.pages.is_empty()); // Force2 is still really pending.
    let prepared = &performance.bases[0].prepared_body["request"];
    let weights = prepared["exciter"]["node_weights"].as_array().unwrap();
    let nodes = prepared["geometry"]["nodes"].as_array().unwrap();
    assert_eq!(nodes.len(), weights.len());
    assert_eq!(nodes.len(), 12);
    let mut anchor = [0.0; 3];
    for (node, weight) in nodes.iter().zip(weights) {
        for axis in 0..3 {
            anchor[axis] += node["rest_metres"][axis].as_f64().unwrap() * weight.as_f64().unwrap();
        }
    }
    let normal: [f64; 3] =
        std::array::from_fn(|i| prepared["exciter"]["axis"][i].as_f64().unwrap());
    let position: [f64; 3] = std::array::from_fn(|i| anchor[i] + normal[i] * 1e-6);
    let velocity: [f64; 3] = std::array::from_fn(|i| normal[i] * -0.01);
    let gravity: [f64; 3] = std::array::from_fn(|i| normal[i] * -9.81);
    // Numerical authored geometry at the genuine body-local distributed
    // exciter. Native P derives conduction, date, force and original programme.
    let definition = json!({"schema":"ql.authored-body-local-plane-contact/v1",
        "contact_ref":"contact:current-native/plane","particle_ref":"particle:current-native/one",
        "collider_ref":"collider:current-native/plane","policy_ref":"policy:current-native/gravity-contact",
        "policy_revision":"authored-1","standing":"architecture-model",
        "particle_position_metres":position,"particle_velocity_metres_per_second":velocity,
        "plane_position_metres":anchor,"outward_normal":normal,"gravity_metres_per_second_squared":gravity,
        "mass_kg":0.01,"restitution":0.1,"transfer_fraction":0.5,
        "minimum_impact_speed_metres_per_second":1e-8,"duration_samples":512});
    let mut authored = request(kernel, original_doc, scene_ref, lease);
    authored["declared_seed"] = json!("1");
    authored["definition"] = definition.clone();
    // A foreign lease or stale original Doc refuses BEFORE source authoring,
    // channel delivery, queue mutation or current-owner retirement.
    for field in ["lease", "document_revision"] {
        let mut wrong = authored.clone();
        wrong[field] = if field == "lease" {
            json!("native:another-owner")
        } else {
            json!(original_doc.revision + 1)
        };
        let operation = crate::KernelOp::NativeExpression {
            request: serde_json::from_value(
                json!({"operation":"contact_scene_edit","request":wrong}),
            )
            .unwrap(),
        };
        let before_id = kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .last_request_id;
        assert!(kernel.apply(operation).is_err());
        assert_eq!(
            kernel.native_expression.active.as_ref().unwrap().child.id(),
            original_pid
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
        assert_eq!(
            document(kernel, &original_doc.expression_ref),
            *original_doc
        );
        assert!(kernel.native_expression.contact_custody.is_none());
    }
    let edit = contact(kernel, "contact_scene_edit", authored);
    assert_eq!(edit["queue_committed"], true);
    assert_eq!(edit["application_committed"], false);
    let operations = edit["original_operations"].as_array().unwrap();
    assert_eq!(operations.len(), 2);
    assert_eq!(operations[0]["mode"], "contact-prepare");
    assert_eq!(operations[1]["mode"], "contact-apply");
    let first = operations[0]["request_id"]
        .as_str()
        .unwrap()
        .parse::<u64>()
        .unwrap();
    assert_eq!(operations[1]["request_id"], (first + 1).to_string());
    for op in operations {
        assert_eq!(
            op["native_reply"]["result"]["host_receipt"]["request_id"],
            op["request_id"]
        );
        assert_eq!(
            op["native_reply"]["result"]["host_receipt"]["last_request_id"],
            op["request_id"]
        );
    }
    let prepare = &operations[0]["native_reply"]["result"]["native_pulse"];
    let apply = &operations[1]["native_reply"]["result"]["native_pulse"];
    let source = &prepare["payload"]["prepared_contact"];
    assert_eq!(source, &apply["payload"]["contact_source"]);
    assert_eq!(source["original_native_request_id"], first.to_string());
    assert_eq!(source["authored_definition"], definition);
    assert_eq!(source["force_newtons"].as_array().unwrap().len(), 512);
    assert_eq!(source["native_boundary"]["native_trigger_sample"], "0");
    let impact = source["native_operands"]["impact_sample"]
        .as_str()
        .unwrap()
        .parse::<u64>()
        .unwrap();
    assert!((1..128).contains(&impact));
    let admission = &apply["payload"]["score_admission"];
    assert_eq!(admission["schema"], "ql.native-score-admission/v1");
    assert_eq!(admission["event"]["kind"], 7);
    assert_eq!(admission["event"]["sequence"], "2");
    assert_eq!(admission["input_ref"], definition["contact_ref"]);
    assert_eq!(prepare["applications"], json!([]));
    assert_eq!(apply["applications"], json!([]));
    assert_eq!(apply["last_input_ordinal"], "0");
    let queued = document(kernel, &original_doc.expression_ref);
    let queued_performance = scene(&queued, scene_ref).performance.as_ref().unwrap();
    assert_eq!(queued_performance.checkpoints[0], *born);
    assert!(queued_performance.pages.is_empty());
    assert!(queued_performance.native_recordings.is_empty());
    assert_eq!(queued_performance.bases, performance.bases);
    assert_eq!(queued_performance.contact_definitions.len(), 1);
    let current_sources: Vec<_> = queued_performance
        .native_sources
        .iter()
        .filter(|s| {
            s.native_contact_admission_history()
                .is_some_and(|h| h.len() == 1)
        })
        .collect();
    assert_eq!(current_sources.len(), 1);
    let original_asset = current_sources[0];
    let selected = &edit["current_source_selection"];
    assert_eq!(
        selected["schema"],
        "oi.native-current-performance-source-selection/v1"
    );
    assert_eq!(selected["expression_ref"], queued.expression_ref);
    assert_eq!(selected["document_revision"], queued.revision);
    assert_eq!(selected["scene_ref"], scene_ref);
    assert_eq!(
        selected["scene_revision"],
        scene(&queued, scene_ref).revision
    );
    let selected_source =
        &queued_performance.native_sources[selected["source_index"].as_u64().unwrap() as usize];
    assert_eq!(selected_source, original_asset);
    assert_eq!(selected["basis_index"], 0);
    assert_eq!(selected["basis_digest"], original_asset.basis_digest());
    assert_eq!(
        selected["source_reading"],
        serde_json::to_value(original_asset.reading().unwrap()).unwrap()
    );
    assert_eq!(
        selected["source_sample"],
        original_asset.native_bundle()["current_receiving"]["native_admission"]["operation"]["native_sample"]
    );
    let actual_sidecar = &original_asset.native_contact_admission_history().unwrap()[0];
    assert_eq!(actual_sidecar["native_admission"], *apply);
    assert_eq!(actual_sidecar["source"], *source);
    assert_eq!(
        original_asset.native_bundle()["contact_occurrence_history"],
        json!([source])
    );
    let (pending_doc, pending_return, pending) = cut(
        kernel,
        &queued,
        scene_ref,
        lease,
        "checkpoint:current-native/contact-pending",
        &home.join("contact-pending-originals"),
    );
    assert_eq!(pending.sample, Counter(0));
    assert_eq!(pending.audio["schema"], "ql.performance-checkpoint/v3");
    assert_eq!(pending.unscored_queued_inputs.len(), 2);
    assert_eq!(pending.unscored_queued_inputs[0].operation()["kind"], 5);
    assert_eq!(pending.unscored_queued_inputs[1].operation()["kind"], 7);
    let pending_contacts =
        crate::expression_performance_native_contact::checkpoint_contacts(&pending.audio)
            .unwrap()
            .unwrap();
    assert_eq!(pending_contacts.slots.len(), 1);
    assert_eq!(
        pending_contacts.slots[0].delivery.delivered_frames,
        Counter(0)
    );
    assert_eq!(pending_contacts.original_request_high_water, Counter(first));
    assert_eq!(
        pending_contacts.slots[0].occurrence.original_request_id,
        Counter(first)
    );
    let live_owner = kernel
        .expressions
        .procedural_scene_owner(&pending_doc, scene_ref)
        .unwrap();
    let closed_reader=crate::expression_procedural_scene_reader::NativeDocumentSceneReader::from_native_scene_owner(
        &kernel.expressions,&live_owner,pending_doc.clone(),scene_ref,scene(&pending_doc,scene_ref).revision,
    ).unwrap();
    let view = closed_reader.recording_render_view(0, &pending).unwrap();
    let manifest = view.native_manifest().unwrap();
    let selection = &manifest["native_render_selection"];
    assert_eq!(selection.as_object().unwrap().len(), 7);
    assert_eq!(
        selection["performance_digest"],
        scene(&pending_doc, scene_ref)
            .performance
            .as_ref()
            .unwrap()
            .content_digest
    );
    assert_eq!(selection["basis_digest"], pending.basis_digest);
    assert_eq!(selection["checkpoint_digest"], pending.content_digest);
    assert_eq!(
        selection["event_prefix_digest"],
        pending.event_prefix_digest
    );
    let mut foreign_cut = pending.clone();
    foreign_cut.checkpoint_ref = "checkpoint:another-native-owner/contact-pending".into();
    foreign_cut = foreign_cut.seal().unwrap();
    assert!(
        closed_reader
            .recording_render_view(0, &foreign_cut)
            .is_err()
    );
    let before_render_id = kernel
        .native_expression
        .active
        .as_ref()
        .unwrap()
        .last_request_id;
    let mut unavailable = request(kernel, &pending_doc, scene_ref, lease);
    unavailable["frames"] = json!(128);
    unavailable["checkpoint_ref"] = json!("checkpoint:not-retained");
    let operation = crate::KernelOp::NativeExpression {
        request: serde_json::from_value(
            json!({"operation":"contact_scene_activity","request":unavailable}),
        )
        .unwrap(),
    };
    assert!(kernel.apply(operation).is_err());
    assert_eq!(
        kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .last_request_id,
        before_render_id
    );
    assert_eq!(document(kernel, &pending_doc.expression_ref), pending_doc);
    assert!(kernel.native_expression.contact_custody.is_none());
    // The SAME current native C49 cut is selected internally, before the real
    // stopped SAME-P renderer. No PCM, cursor, source or digest enters the DTO.
    let mut activity = request(kernel, &pending_doc, scene_ref, lease);
    activity["frames"] = json!(128);
    activity["checkpoint_ref"] = json!(pending.checkpoint_ref);
    let rendered = contact(kernel, "contact_scene_activity", activity);
    assert_eq!(rendered["application_committed"], true);
    let ops = rendered["original_operations"].as_array().unwrap();
    assert_eq!(ops.len(), 1);
    let callback = &ops[0]["native_reply"]["result"]["native_pulse"];
    let original_request = &ops[0]["native_reply"]["result"]["original_worker_request"];
    assert_eq!(original_request["schema"], "ql.performance-control/v1");
    assert_eq!(original_request["operation"], "offline-render");
    assert_eq!(original_request["frames"], 128);
    let scope = &original_request["scope"];
    assert_eq!(scope.as_object().unwrap().len(), 12);
    assert_eq!(scope["schema"], "ql.native-offline-render-scope/v1");
    assert_eq!(scope["scene_ref"], scene_ref);
    for (key, selected) in [
        ("performance_digest", "performance_digest"),
        ("performance_revision", "performance_digest"),
        ("basis_seal", "basis_digest"),
        ("event_prefix_seal", "event_prefix_digest"),
        ("checkpoint_ref", "checkpoint_ref"),
    ] {
        assert_eq!(scope[key], selection[selected]);
    }
    assert_eq!(scope["expected_cursor"], pending.audio["cursor"]);
    assert_eq!(
        scope["expected_accepted_sequence"],
        pending.audio["accepted_sequence"]
    );
    assert_eq!(
        scope["expected_source"],
        pending.audio["determination"]["identity"]
    );
    assert_eq!(
        scope["expected_body_revision"],
        pending.audio["determination"]["body_revision"]
    );
    assert_eq!(
        original_request["expected_transport_epoch"],
        serde_json::to_value(pending.management.as_ref().unwrap().transport_epoch).unwrap()
    );
    assert_eq!(callback["operation"], "offline-render");
    assert_eq!(callback["reading"]["samples_elapsed"], "128");
    assert_eq!(callback["applications"].as_array().unwrap().len(), 2);
    let app = callback["applications"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["kind"] == 7)
        .unwrap();
    assert_eq!(app["schema"], "ql.performance-applied-event/v3");
    assert_eq!(app["sequence"], "2");
    assert_eq!(
        app["contact"]["occurrence"]["original_request_id"],
        first.to_string()
    );
    let played = document(kernel, &original_doc.expression_ref);
    let played_performance = scene(&played, scene_ref).performance.as_ref().unwrap();
    played_performance.validate().unwrap();
    let render_selection = &rendered["current_source_selection"];
    assert_eq!(render_selection["document_revision"], played.revision);
    assert_eq!(render_selection["source_index"], selected["source_index"]);
    assert_eq!(render_selection["basis_digest"], selected["basis_digest"]);
    let render_source = &played_performance.native_sources
        [render_selection["source_index"].as_u64().unwrap() as usize];
    assert_eq!(
        render_source.native_bundle(),
        &ops[0]["native_reply"]["result"]["source_artifact"]["source_assets"]
    );
    assert_eq!(
        render_source.native_contact_admission_history().unwrap(),
        std::slice::from_ref(actual_sidecar)
    );
    assert_eq!(played_performance.checkpoints[0], *born);
    let contact_events: Vec<_> = played_performance
        .events()
        .filter(|e| matches!(e.4, EventAction::Contact(_)))
        .collect();
    assert_eq!(contact_events.len(), 1);
    assert_eq!(contact_events[0].sample(), impact);
    assert!(!played_performance.native_recordings.is_empty());
    let canonical: Vec<_> = played_performance
        .native_recordings
        .iter()
        .map(|p| p.canonical_decoded_bytes().unwrap())
        .collect();
    let (active_doc, active_return, active) = cut(
        kernel,
        &played,
        scene_ref,
        lease,
        "checkpoint:current-native/contact-active",
        &home.join("contact-active-originals"),
    );
    assert_eq!(active.sample, Counter(128));
    assert!(active.unscored_queued_inputs.is_empty());
    assert_eq!(active.audio["schema"], "ql.performance-checkpoint/v3");
    let active_contacts =
        crate::expression_performance_native_contact::checkpoint_contacts(&active.audio)
            .unwrap()
            .unwrap();
    assert_eq!(active_contacts.slots.len(), 1);
    let delivery = &active_contacts.slots[0].delivery;
    assert_eq!(delivery.status, Counter(2));
    assert_eq!(delivery.delivered_frames, Counter(128 - impact));
    assert_eq!(delivery.planned_frames, Counter(512));
    assert_eq!(
        active_contacts.slots[0].force_newtons,
        pending_contacts.slots[0].force_newtons
    );
    assert_eq!(active_contacts.original_request_high_water, Counter(first));
    let performance = scene(&active_doc, scene_ref).performance.as_ref().unwrap();
    assert_eq!(performance.checkpoints[0], *born);
    assert_eq!(performance.bases, played_performance.bases);
    let file = crate::expression_file::encode(&active_doc).unwrap();
    let reopened = crate::expression_file::decode(&file).unwrap();
    assert_eq!(reopened, active_doc);
    let reopened_performance = scene(&reopened, scene_ref).performance.as_ref().unwrap();
    for (page, bytes) in reopened_performance
        .native_recordings
        .iter()
        .zip(&canonical)
    {
        assert_eq!(page.canonical_decoded_bytes().unwrap(), *bytes);
    }
    // Original v3 programme/handle/occurrence fields are guarded by the native
    // source and checkpoint law. These mutations exercise the actual recorded
    // originals; they do not construct another admitted source or native lease.
    for changed in ["force", "lineage", "handle"] {
        let mut audio = pending.audio.clone();
        match changed {
            "force" => {
                let force = audio["contacts"]["slots"][0]["force_newtons"][0]
                    .as_f64().expect("actual original contact force");
                audio["contacts"]["slots"][0]["force_newtons"][0] =
                    json!(if force == 0.0 { 1.0 } else { 0.0 });
            }
            "lineage" => {
                audio["contacts"]["constructor_lineage"] = json!("native:another-constructor");
            }
            _ => {
                audio["contacts"]["slots"][0]["handle"]["generation"] = json!("0");
            }
        }
        assert!(
            crate::expression_performance_native_contact::checkpoint_contacts(&audio).is_err(),
            "lost original {changed}"
        );
    }
    pending.validate().unwrap();
    active.validate().unwrap();
    // This is genuine persisted Act/Edition selection. Numerical Contact cold
    // readmission is a separate closed operation, never implied by file decode.
    let retained = kernel
        .expression_world(crate::expression_world::Request::ActRetainedPerform {
            act_ref: "act:current-scene/original-contact".into(),
            expression_ref: active_doc.expression_ref.clone(),
            expected_revision: active_doc.revision,
            expected_act_revision: None,
            summary: "Actual native queued, performed and active Contact programme".into(),
            actor: "agent:current-instrument-proof".into(),
            activity_ref: None,
            changes: vec![Change::ScenePerformanceSet {
                scene_ref: scene_ref.into(),
                performance: performance.clone(),
            }],
        })
        .unwrap();
    let crate::KernelOpResult::ExpressionWorld { data: retained } = retained.result else {
        panic!("Contact Act enrollment changed result family")
    };
    let revision = retained["act"]["revision"].as_u64().unwrap();
    assert_eq!(document(kernel, &active_doc.expression_ref), active_doc);
    let mut cold = crate::Kernel::new(crate::CentralClient::discover());
    cold.attach_act_store(home).unwrap();
    let selected = cold
        .expression_world(crate::expression_world::Request::ActRetainedEdition {
            act_ref: "act:current-scene/original-contact".into(),
            expected_act_revision: revision,
            position: 0,
        })
        .unwrap();
    let crate::KernelOpResult::ExpressionWorld { data: selected } = selected.result else {
        panic!("cold Contact Edition changed result family")
    };
    assert_eq!(
        selected["document"],
        serde_json::to_value(&active_doc).unwrap()
    );
    assert_eq!(
        kernel.native_expression.active.as_ref().unwrap().child.id(),
        original_pid
    );
    if let Ok(path) = std::env::var("QL_NATIVE_CONTACT_SCORE_ARTIFACT") {
        let artifact = json!({"schema":"oi.actual-native-contact-score-delivery/v1","performance":performance});
        std::fs::write(path, serde_json::to_vec(&artifact).unwrap()).unwrap();
    }
    if let Ok(path) = std::env::var("OI_NATIVE_CURRENT_SCENE_CONTACT_ARTIFACT_DIRECTORY") {
        let path = std::path::PathBuf::from(path);
        std::fs::create_dir_all(&path).unwrap();
        for (name, value) in [
            ("contact-original-prepare-apply.json", &edit),
            ("contact-pending-cut.json", &pending_return),
            ("contact-native-render.json", &rendered),
            ("contact-active-cut.json", &active_return),
        ] {
            std::fs::write(path.join(name), serde_json::to_vec(value).unwrap()).unwrap();
        }
        std::fs::write(path.join("contact-active.expression.json"), &file).unwrap();
        for (index, bytes) in canonical.iter().enumerate() {
            std::fs::write(
                path.join(format!("contact-native-page-{index}.canonical.json")),
                bytes,
            )
            .unwrap();
        }
    }
    super::super::super::scene_continuation::tests::source_acceptance::actual_closed_source_counterproof(
        &pending_doc, &active_doc, scene_ref, home, &pending, &active,
    );
    super::super::super::scene_continuation::tests::actual_pending_active_continuation_trial(
        kernel,
        &active_doc,
        scene_ref,
        lease,
        home,
        &pending,
        &active,
    );
}
