//! Actual current Scene authoring from the SAME privately qualified owner.
//! No source/body/tuning/clock/receipt JSON is accepted by this operation.
use super::recording::NativeSceneRecordingCommit;
use super::recording_channel::NativeCurrentRecordingRefusal;
use crate::expression::{Change, Request};
use crate::expression_performance::*;
use crate::expression_performance_source_asset::NativePerformanceSourceAsset;
use crate::expression_procedural_scene_reader::{
    NativeDocumentSceneReader, NativeSceneSourceReader,
};
use serde::{Deserialize, Serialize};
#[cfg(test)]
use serde_json::json;
use serde_json::Value;

/// Explicit authored score/material choices. Native rate, source/body, return,
/// available pitches, original episode and parameter baselines come from the
/// actual source owner; they cannot be supplied or reconstructed by the caller.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct NativeSceneRecordingDefinition {
    pub declared_seed: Counter,
    pub performance_ref: String,
    pub layer_ref: String,
    pub title: String,
    pub duration_samples: Counter,
    pub ppq: u16,
    pub micros_per_quarter: u32,
    pub max_reconstruction_samples: Counter,
}
impl NativeSceneRecordingDefinition {
    fn validate(&self) -> Result<(), String> {
        for text in [&self.performance_ref, &self.layer_ref, &self.title] {
            crate::expression::text(text)?;
        }
        if self.duration_samples.0 == 0
            || self.ppq == 0
            || self.ppq > 32767
            || !(10000..=60000000).contains(&self.micros_per_quarter)
            || self.max_reconstruction_samples.0 == 0
            || self.max_reconstruction_samples > self.duration_samples
        {
            return Err(
                "authored retained score duration/tempo/reconstruction policy invalid".into(),
            );
        }
        Ok(())
    }
}
fn scalar(value: &Value) -> Result<Scalar, String> {
    Scalar::new(
        value
            .as_f64()
            .filter(|v| v.is_finite())
            .ok_or("actual native parameter baseline absent/nonfinite")?,
    )
}
/// Structural compiler called ONLY after the closed native owner source read.
/// Its Value argument is not exported as an admission or public source setter.
fn compile_definition(
    definition: &NativeSceneRecordingDefinition,
    source: &Value,
) -> Result<Performance, String> {
    definition.validate()?;
    if source["schema"] != "ql.retained-source-performance-fixture/v1"
        || source["native_basis"] != source["source_assets"]["native_basis"]
    {
        return Err("retained Scene definition lost the full actual source artifact".into());
    }
    let basis: PerformanceBasis =
        serde_json::from_value(source["basis"].clone()).map_err(|e| e.to_string())?;
    let basis = basis.seal()?;
    if basis.seed != definition.declared_seed {
        return Err("actual native Return lost the original declared authoring seed".into());
    }
    let native_source = NativePerformanceSourceAsset::from_native_artifact(&basis, source)?;
    native_source.require_source_context(&basis)?;
    if basis.prepared_body != source["native_preparation"]["physical_body"]
        || basis.audio_determination != source["native_preparation"]["determination"]
    {
        return Err(
            "actual native Return/preparation lost the same source body/determination".into(),
        );
    }
    let rate = u32::try_from(
        source["native_preparation"]["physical_body"]["request"]["sample_rate"]
            .as_u64()
            .ok_or("actual native body rate absent")?,
    )
    .map_err(|e| e.to_string())?;
    if source["native_reading"]["scope"]["instance_ref"] != basis.identity.instance_ref
        || source["native_reading"]["scope"]["event_ref"] != basis.identity.event_ref
        || source["native_reading"]["scope"]["subject_ref"] != basis.identity.subject_ref
        || source["native_reading"]["scope"]["body_revision"]
            != basis.audio_determination["body_revision"]
    {
        return Err("actual source definition and native current owner scope/body differ".into());
    }
    let pitches: Vec<Pitch> =
        serde_json::from_value(source["pitches"].clone()).map_err(|e| e.to_string())?;
    // Retain exactly the actual available source catalog. Five unavailable
    // sparse keys are not filled, and no note/voice is invented at authoring.
    if pitches.is_empty() {
        return Err("native source has no available retained pitch".into());
    }
    let parameters = source["native_reading"]["parameters"]
        .as_array()
        .ok_or("actual native parameter descriptor array absent")?;
    if parameters.len() != 7 {
        return Err("actual native parameter descriptor cardinality differs".into());
    }
    let mut targets = Vec::with_capacity(parameters.len());
    for (id, descriptor) in parameters.iter().enumerate() {
        let (field, unit) = crate::expression_performance_recording::parameter_field(
            u8::try_from(id).map_err(|e| e.to_string())?,
        )?;
        let target_ref = format!("ql:performance/parameter/{}", field.replace('_', "-"));
        if descriptor["native_owner"] != "ql.performance.Engine"
            || descriptor["action_ref"] != "ql:native-performance/parameter"
            || descriptor["target_ref"] != target_ref
            || descriptor["scope"] != "instrument"
            || descriptor["unit"] != unit
            || serde_json::from_value::<Counter>(descriptor["sample_rate"].clone())
                .map_err(|e| e.to_string())?
                .0
                != u64::from(rate)
        {
            return Err("actual native parameter target/owner/unit/rate is disconnected".into());
        }
        targets.push(ParameterTarget {
            native_owner: descriptor["native_owner"]
                .as_str()
                .ok_or("native parameter owner absent")?
                .into(),
            action_ref: descriptor["action_ref"]
                .as_str()
                .ok_or("native parameter action absent")?
                .into(),
            target_ref,
            unit: unit.into(),
            scope: Scope::Instrument,
            minimum: scalar(&descriptor["minimum"])?,
            maximum: scalar(&descriptor["maximum"])?,
            baseline: scalar(&descriptor["baseline"])?,
            smoothing_samples: serde_json::from_value(descriptor["smoothing_samples"].clone())
                .map_err(|e| e.to_string())?,
        });
    }
    Performance {
        schema: SOURCE_SCHEMA.into(),
        performance_ref: definition.performance_ref.clone(),
        sample_rate: rate,
        duration_samples: definition.duration_samples,
        ppq: definition.ppq,
        bases: vec![basis],
        pitches,
        layers: vec![Layer {
            layer_ref: definition.layer_ref.clone(),
            title: definition.title.clone(),
            enabled: true,
            solo: false,
        }],
        pages: vec![],
        parameters: targets,
        routes: vec![],
        tempo: vec![TempoSegment {
            at_sample: Counter(0),
            at_tick: Counter(0),
            micros_per_quarter: definition.micros_per_quarter,
        }],
        loop_range: None,
        position_sample: Counter(0),
        replay: ReplayPolicy {
            mode: ReplayMode::NativeCheckpoint,
            max_reconstruction_samples: definition.max_reconstruction_samples,
            model_revision: "ql.performance-audio/v1".into(),
            event_tolerance_samples: 0,
            physical_tolerance: Scalar::new(0.0)?,
            display_policy: "same-native-cursor".into(),
        },
        checkpoints: vec![],
        native_sources: vec![native_source],
        native_recordings: vec![],
        native_reservations: vec![],
        content_digest: String::new(),
    }
    .seal()
}
/// The original same-lease caller; no JSON/imported source capability.
pub struct CurrentSceneRecordingDefinitionIntent<'a> {
    pub lease: &'a str,
    pub expression_ref: &'a str,
    pub document_revision: u64,
    pub scene_ref: &'a str,
    pub scene_revision: u64,
    pub actor: &'a str,
    pub definition: NativeSceneRecordingDefinition,
}
impl crate::Kernel {
    pub fn prepare_current_native_scene_recording(
        &mut self,
        input: CurrentSceneRecordingDefinitionIntent<'_>,
    ) -> Result<NativeSceneRecordingCommit, NativeCurrentRecordingRefusal> {
        input.definition.validate()?;
        crate::expression::text(input.actor)?;
        let before = self
            .expressions
            .procedural_source_snapshot(input.expression_ref, input.document_revision)?;
        let scene = before
            .scenes
            .iter()
            .find(|s| s.scene_ref == input.scene_ref)
            .ok_or("native score definition Scene absent")?;
        if scene.revision != input.scene_revision || scene.performance.is_some() {
            return Err(
                "native score definition Scene stale/already has retained material; preserve it"
                    .into(),
            );
        }
        let owner = self
            .expressions
            .procedural_scene_owner(&before, input.scene_ref)?;
        let reader = NativeDocumentSceneReader::from_native_scene_owner(
            &self.expressions,
            &owner,
            before,
            input.scene_ref,
            input.scene_revision,
        )?;
        self.expressions
            .require_procedural_scene_owner(&owner, reader.document())?;
        let native = self
            .native_expression
            .read_native_scene_performance(
                input.lease,
                &NativeSceneSourceReader::CurrentDocument(&reader),
                input.definition.declared_seed.0,
            )
            .map_err(NativeCurrentRecordingRefusal::from_native_scene_source_refusal)?;
        // Keep the actual original native result even if any validation/CAS
        // after the source read refuses. No operation/reply is repeated.
        let prepared = (|| -> Result<Performance, String> {
            self.expressions
                .require_procedural_scene_owner(&owner, reader.document())?;
            if native["schema"] != "ql.native-act-owner-result/v1"
                || native["status"] != "ok"
                || native["available"] != true
                || native["result"]["selection"]["source_custody"] != "current-document"
                || native["result"]["selection"]["expression_ref"] != input.expression_ref
                || native["result"]["selection"]["scene_ref"] != input.scene_ref
            {
                return Err(
                    "native definition lost actual closed current Scene source selection".into(),
                );
            }
            let performance =
                compile_definition(&input.definition, &native["result"]["source_artifact"])?;
            if performance.bases[0].identity.instance_ref != native["instance_ref"] {
                return Err("actual definition Return belongs to another native owner".into());
            }
            Ok(performance)
        })();
        let performance = match prepared {
            Ok(p) => p,
            Err(reason) => {
                return Err(
                    NativeCurrentRecordingRefusal::from_acknowledged_native_source_refusal(
                        reason, native,
                    ),
                );
            }
        };
        let application = self
            .expressions
            .require_procedural_scene_owner(&owner, reader.document())
            .and_then(|()| {
                self.apply(crate::KernelOp::Expression {
                    request: Request::Edit {
                        expression_ref: input.expression_ref.into(),
                        expected_revision: input.document_revision,
                        actor: input.actor.into(),
                        changes: vec![Change::ScenePerformanceSet {
                            scene_ref: input.scene_ref.into(),
                            performance: performance.clone(),
                        }],
                    },
                })
            })
            .map(Some);
        let currentness = (|| -> Result<(), String> {
            application.as_ref().map_err(Clone::clone)?;
            let after = self.expressions.procedural_source_snapshot(
                input.expression_ref,
                input
                    .document_revision
                    .checked_add(1)
                    .ok_or("native definition Doc revision exhausted")?,
            )?;
            let scene = after
                .scenes
                .iter()
                .find(|s| s.scene_ref == input.scene_ref)
                .ok_or("native definition Scene disappeared")?;
            if scene.performance.as_ref() != Some(&performance) {
                return Err(
                    "ordinary Scene edit did not retain full source/Return/pitches/parameters"
                        .into(),
                );
            }
            let after_owner = self
                .expressions
                .procedural_scene_owner(&after, input.scene_ref)?;
            self.expressions
                .require_procedural_scene_owner(&after_owner, &after)?;
            if owner.instance_ref() != after_owner.instance_ref()
                || owner.construction_generation() != after_owner.construction_generation()
            {
                return Err("native definition edit replaced original Scene lifetime".into());
            }
            Ok(())
        })();
        Ok(NativeSceneRecordingCommit::from_native_definition(
            application,
            currentness,
            native,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn source() -> Value {
        let directory = std::path::PathBuf::from(
            std::env::var("QL_CURRENT_RECEIVING_ARTIFACT_DIRECTORY").expect(
                "normal gate must produce genuine activated FieldHost/worker source artifacts",
            ),
        );
        serde_json::from_slice(
            &std::fs::read(directory.join("world.source-performance.json")).unwrap(),
        )
        .unwrap()
    }
    fn authored(actual: &Value) -> NativeSceneRecordingDefinition {
        NativeSceneRecordingDefinition {
            declared_seed: serde_json::from_value(actual["basis"]["seed"].clone()).unwrap(),
            performance_ref: "performance:current-native/source".into(),
            layer_ref: "performance:current-native/history".into(),
            title: "Original native performance".into(),
            duration_samples: Counter(900 * 48000),
            ppq: 960,
            micros_per_quarter: 500000,
            max_reconstruction_samples: Counter(48000),
        }
    }
    #[test]
    fn genuine_activated_source_definition_keeps_actual_descriptors_and_file_bytes() {
        let actual = source();
        let performance = compile_definition(&authored(&actual), &actual).unwrap();
        let actual_basis: PerformanceBasis =
            serde_json::from_value(actual["basis"].clone()).unwrap();
        assert_eq!(performance.bases[0], actual_basis.seal().unwrap());
        assert_eq!(
            serde_json::to_value(&performance.pitches).unwrap(),
            actual["pitches"]
        );
        assert_eq!(performance.duration_samples, Counter(43_200_000));
        assert!(performance.pages.is_empty());
        assert!(performance.native_recordings.is_empty());
        assert!(performance.checkpoints.is_empty());
        assert_eq!(performance.parameters.len(), 7);
        for (target, descriptor) in performance
            .parameters
            .iter()
            .zip(actual["native_reading"]["parameters"].as_array().unwrap())
        {
            assert_eq!(
                target.maximum.value().to_bits(),
                descriptor["maximum"].as_f64().unwrap().to_bits()
            );
            assert_eq!(
                target.baseline.value().to_bits(),
                descriptor["baseline"].as_f64().unwrap().to_bits()
            );
            assert_eq!(
                serde_json::to_value(target.smoothing_samples).unwrap(),
                descriptor["smoothing_samples"]
            );
        }
        let bytes = serde_json::to_vec(&performance).unwrap();
        let reopened: Performance = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(performance, reopened.seal().unwrap());
        performance.native_sources[0]
            .verify_native_replay(&performance.bases[0], &actual["source_assets"])
            .unwrap();
    }
    #[test]
    fn actual_native_parameter_source_context_rate_and_seed_losses_refuse_definition() {
        let actual = source();
        let definition = authored(&actual);
        for field in ["parameters", "scope"] {
            let mut lost = actual.clone();
            lost["native_reading"]
                .as_object_mut()
                .unwrap()
                .remove(field);
            assert!(compile_definition(&definition, &lost).is_err());
        }
        let mut disconnected = actual.clone();
        disconnected["native_reading"]["parameters"][0]["target_ref"] =
            json!("ql:performance/parameter/master-linear");
        assert!(compile_definition(&definition, &disconnected).is_err());
        let mut wrong_rate = actual.clone();
        wrong_rate["native_reading"]["parameters"][0]["sample_rate"] = json!("44100");
        assert!(compile_definition(&definition, &wrong_rate).is_err());
        let mut missing_context = actual.clone();
        missing_context["source_assets"]
            .as_object_mut()
            .unwrap()
            .remove("source_context");
        assert!(compile_definition(&definition, &missing_context).is_err());
        let mut wrong_seed = definition;
        wrong_seed.declared_seed = Counter(wrong_seed.declared_seed.0 + 1);
        assert!(compile_definition(&wrong_seed, &actual).is_err());
    }

    /// Full private positive needs the native material owner's actual Document,
    /// original World constructor and qualified companions. No Scene is built
    /// around an imported source artifact. Normal native gate invokes explicitly.
    #[test]
    #[ignore = "requires actual native World Document and qualified host/worker"]
    fn actual_current_world_prepare_set_origin_and_cold_act_keep_the_source_owner() {
        current_native_instrument_trial(None);
    }

    #[test]
    #[ignore = "requires actual native World Document and qualified host/worker"]
    fn actual_current_native_write_then_eof_holds_recording_without_any_reply() {
        current_native_instrument_trial(Some(false));
    }

    #[test]
    #[ignore = "requires actual native World Document and qualified host/worker"]
    fn actual_native_calibration_ack_lost_after_queue_cannot_be_reissued() {
        current_native_instrument_trial(Some(true));
    }

    fn current_native_instrument_trial(lose_terminal: Option<bool>) {
        use super::super::recording_channel::{
            NativeRecordingCommand, NativeSceneRecordingRequest,
        };
        use crate::expression::Document;
        let read = |name: &str| -> Value {
            serde_json::from_slice(
                &std::fs::read(
                    std::env::var(name)
                        .unwrap_or_else(|_| panic!("native source gate must supply {name}")),
                )
                .unwrap(),
            )
            .unwrap()
        };
        let expression = |kernel: &mut crate::Kernel, request: Value| -> Value {
            match kernel
                .apply(crate::KernelOp::Expression {
                    request: serde_json::from_value(request).unwrap(),
                })
                .unwrap()
                .result
            {
                crate::KernelOpResult::Expression { data } => data,
                other => panic!("actual Expression operation returned {other:?}"),
            }
        };
        let document = |kernel: &mut crate::Kernel, reference: &str| -> Document {
            serde_json::from_value(
                expression(
                    kernel,
                    json!({"operation":"inspect","expression_ref":reference}),
                )["document"]
                    .clone(),
            )
            .unwrap()
        };
        let original = read("OI_NATIVE_WORLD_REPLAY_REQUEST");
        let actual: Document =
            serde_json::from_value(read("OI_NATIVE_WORLD_SCENE_DOCUMENT")).unwrap();
        actual.validate().unwrap();
        let scenes: Vec<_> = actual
            .scenes
            .iter()
            .filter(|s| {
                s.presentation
                    .as_ref()
                    .is_some_and(|p| p.scene["epiWorld"]["schema"] == "oi.epi-world-material/v1")
            })
            .collect();
        assert_eq!(scenes.len(), 1);
        let scene_ref = scenes[0].scene_ref.clone();
        let original_world =
            scenes[0].presentation.as_ref().unwrap().scene["epiWorld"]["world"].clone();
        let mut kernel = crate::Kernel::new(crate::CentralClient::discover());
        expression(
            &mut kernel,
            json!({"operation":"open","document":actual,"actor":"agent:current-instrument-proof"}),
        );
        let before_open = document(&mut kernel, &actual.expression_ref);
        let selected_scene = before_open
            .scenes
            .iter()
            .find(|s| s.scene_ref == scene_ref)
            .unwrap();
        let selection = super::super::selected_scene::Request {
            expression_ref: before_open.expression_ref.clone(),
            document_revision: before_open.revision,
            scene_ref: scene_ref.clone(),
            scene_revision: selected_scene.revision,
        };
        let open_op = crate::KernelOp::NativeExpression {
            request: super::super::Request::OpenSelectedScene {
                request: selection.clone(),
            },
        };
        let prepared_open = kernel
            .prepare_native_selected_scene_open(&open_op)
            .unwrap()
            .unwrap();
        let opened = kernel
            .finish_native_selected_scene_open(prepared_open.execute().unwrap())
            .unwrap();
        let crate::KernelOpResult::NativeExpression { data: opened } = opened.result else {
            panic!("actual selected World opening returned another result")
        };
        assert_eq!(opened["source_current"], true, "{opened}");
        // The genuine browser-saved portable World loses native negative zero.
        // Reuse the SAME existing native portable codec comparator, after the
        // actual issuer qualified its full original constructor/binding bytes.
        assert!(super::super::selected_scene::same_retained_portable_basis(
            &opened["source"]["world"]["basis"],
            &original_world["basis"]
        ));
        let saved_native_source =
            &scenes[0].presentation.as_ref().unwrap().scene["epiWorld"]["native_source"];
        assert_eq!(
            opened["source"]["constructor_request_bytes"],
            saved_native_source["constructor_request_bytes"]
        );
        assert_eq!(
            opened["source"]["request_sha256"],
            saved_native_source["request_sha256"]
        );
        assert_eq!(
            opened["source"]["binding_sha256"],
            saved_native_source["binding_sha256"]
        );
        assert_eq!(
            original["request"]["request"]["request"]["schema"],
            "ql.scene-world-request/v1"
        );
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let pid = kernel.native_expression.active.as_ref().unwrap().child.id();
        let identity = kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .identity
            .clone();
        // Retain through the actual selected opening/SceneOwner BEFORE preparing
        // the instrument. This is the same normal app source producer and CAS.
        let source_next = kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .last_request_id
            + 1;
        let source_position = kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .procedural_position
            .clone();
        let retained_source = kernel
            .apply(crate::KernelOp::NativeExpression {
                request: super::super::Request::RetainSelectedSceneSource {
                    request: super::super::selected_scene::source::Request {
                        selection,
                        lease: lease.clone(),
                        actor: "agent:current-instrument-proof".into(),
                        expected_request_id: source_next.to_string(),
                        expected_generation: source_position["generation"].as_str().unwrap().into(),
                        expected_samples_elapsed: source_position["samples_elapsed"]
                            .as_str()
                            .unwrap()
                            .into(),
                    },
                },
            })
            .unwrap();
        let crate::KernelOpResult::NativeExpression {
            data: retained_source,
        } = retained_source.result
        else {
            panic!("actual selected source retention returned another result")
        };
        assert_eq!(retained_source["source_current"], true, "{retained_source}");
        let source_document = document(&mut kernel, &actual.expression_ref);
        crate::expression_procedural_scene_reader::verify_actual_field_carrier_contract(
            &source_document,
        );
        let preparation_next = kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .last_request_id
            + 1;
        let preparation_position = kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .procedural_position
            .clone();
        let prepared=kernel.native_expression.apply(&crate::CentralClient::with("/nonexistent".into(),None,String::new()),
            super::super::Request::Exchange{lease:lease.clone(),request:json!({
                "schema":"ql.field-host-request/v1","instance_ref":identity["instance_ref"],"event_ref":identity["event_ref"],
                "subject_ref":identity["subject_ref"],"request_id":preparation_next.to_string(),"expected_generation":preparation_position["generation"],
                "expected_samples_elapsed":preparation_position["samples_elapsed"],
                "command":{"operation":"performance-prepare-current","preparation":{
                    "schema":"ql.current-source-performance-preparation/v1","policy_ref":"policy:current-scene/cf-degree-order",
                    "session_ref":"performance:current-scene/native-session","receipt_ref":"receipt:current-scene/preparation",
                    "projection_ref":"policy:current-scene/metric-consumer","relation":{"family":"A","pair_index":0,"degree":1,"expansion_side":null},
                    "source_face":1,"physical_face":1,"mechanical_policy":{"policy":"declared-instrument-default"},
                    "source_choice":"retained-current-condition-cf-degree-order","columns":12,"base_register":0,"transpose":0
                }}})}).unwrap();
        assert_eq!(prepared["status"], "ok", "{prepared}");
        assert_eq!(prepared["performance"]["accepted"], true, "{prepared}");
        let before = document(&mut kernel, &actual.expression_ref);
        let scene = before
            .scenes
            .iter()
            .find(|s| s.scene_ref == scene_ref)
            .unwrap();
        assert!(scene.performance.is_none());
        let next = kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .last_request_id
            + 1;
        let defined = kernel
            .apply_native_scene_recording_request(NativeSceneRecordingRequest::PrepareScene {
                request_id: next.to_string(),
                lease: lease.clone(),
                expression_ref: before.expression_ref.clone(),
                document_revision: before.revision,
                scene_ref: scene_ref.clone(),
                scene_revision: scene.revision,
                actor: "agent:current-instrument-proof".into(),
                definition: NativeSceneRecordingDefinition {
                    declared_seed: Counter(1),
                    performance_ref: "performance:current-scene/history".into(),
                    layer_ref: "performance:current-scene/history-layer".into(),
                    title: "Native current instrument".into(),
                    duration_samples: Counter(43_200_000),
                    ppq: 960,
                    micros_per_quarter: 500000,
                    max_reconstruction_samples: Counter(48000),
                },
            })
            .unwrap();
        let crate::KernelOpResult::NativeExpression { data: defined } = defined.result else {
            panic!("native definition result absent")
        };
        assert_eq!(defined["accepted"], true, "{defined}");
        assert_eq!(
            defined["native_reply"]["result"]["host_receipt"]["request_id"],
            next.to_string()
        );
        let no_origin = document(&mut kernel, &actual.expression_ref);
        let no_origin_scene = no_origin
            .scenes
            .iter()
            .find(|s| s.scene_ref == scene_ref)
            .unwrap();
        let before_command_id = kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .last_request_id;
        let before_begin = kernel
            .apply_native_scene_recording_request(NativeSceneRecordingRequest::Command {
                request_id: (before_command_id + 1).to_string(),
                lease: lease.clone(),
                expression_ref: no_origin.expression_ref.clone(),
                document_revision: no_origin.revision,
                scene_ref: scene_ref.clone(),
                scene_revision: no_origin_scene.revision,
                actor: "agent:current-instrument-proof".into(),
                basis: 0,
                layer: 0,
                command: NativeRecordingCommand::CalibrateCurrent {},
            })
            .unwrap();
        let crate::KernelOpResult::NativeExpression { data: before_begin } = before_begin.result
        else {
            panic!("command before Begin returned another operation")
        };
        assert_eq!(before_begin["accepted"], false);
        assert_eq!(before_begin["delivery_attempted"], false);
        assert!(before_begin["native_reply"].is_null());
        assert!(kernel.native_expression.recording_failure.is_none());
        assert_eq!(
            kernel.native_expression.active.as_ref().unwrap().child.id(),
            pid
        );
        assert_eq!(
            kernel
                .native_expression
                .active
                .as_ref()
                .unwrap()
                .last_request_id,
            before_command_id
        );
        assert_eq!(document(&mut kernel, &actual.expression_ref), no_origin);
        let before_origin = document(&mut kernel, &actual.expression_ref);
        let scene = before_origin
            .scenes
            .iter()
            .find(|s| s.scene_ref == scene_ref)
            .unwrap();
        let retained = scene.performance.as_ref().unwrap();
        assert_eq!(retained.bases[0].seed, Counter(1));
        assert!(retained.checkpoints.is_empty());
        assert!(retained.native_recordings.is_empty());
        let next = kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .last_request_id
            + 1;
        let origin = kernel
            .apply_native_scene_recording_request(NativeSceneRecordingRequest::Begin {
                request_id: next.to_string(),
                lease: lease.clone(),
                expression_ref: before_origin.expression_ref.clone(),
                document_revision: before_origin.revision,
                scene_ref: scene_ref.clone(),
                scene_revision: scene.revision,
                actor: "agent:current-instrument-proof".into(),
                basis: 0,
                checkpoint_ref: "checkpoint:current-scene/original-birth".into(),
            })
            .unwrap();
        let crate::KernelOpResult::NativeExpression { data: origin } = origin.result else {
            panic!("native original checkpoint result absent")
        };
        assert_eq!(origin["accepted"], true, "{origin}");
        assert_eq!(
            origin["native_reply"]["result"]["native_pulse"]["reading"]["accepted_sequence"],
            "0"
        );
        assert_eq!(
            origin["native_reply"]["result"]["native_pulse"]["reading"]
                ["last_applied_application_ordinal"],
            "0"
        );
        assert_eq!(
            origin["native_reply"]["result"]["native_pulse"]["last_input_ordinal"],
            "0"
        );
        assert_eq!(
            origin["native_reply"]["result"]["host_receipt"]["request_id"],
            next.to_string()
        );
        let after = document(&mut kernel, &actual.expression_ref);
        let scene = after
            .scenes
            .iter()
            .find(|s| s.scene_ref == scene_ref)
            .unwrap();
        let retained = scene.performance.as_ref().unwrap();
        assert_eq!(retained.checkpoints.len(), 1);
        assert_eq!(
            retained.bases,
            before_origin
                .scenes
                .iter()
                .find(|s| s.scene_ref == scene_ref)
                .unwrap()
                .performance
                .as_ref()
                .unwrap()
                .bases
        );
        assert_eq!(
            kernel.native_expression.active.as_ref().unwrap().child.id(),
            pid
        );
        let home = std::path::PathBuf::from(
            std::env::var_os("OI_RETAINED_PERFORMANCE_TEST_HOME")
                .expect("normal native gate supplies bounded fresh Act custody"),
        )
        .join(match lose_terminal {
            None => format!("native-current-instrument-{}", std::process::id()),
            Some(false) => format!("native-current-instrument-eof-{}", std::process::id()),
            Some(true) => format!("native-current-instrument-lost-ack-{}", std::process::id()),
        });
        assert!(!home.exists());
        kernel.attach_act_store(&home).unwrap();
        let recorded = kernel
            .expression_world(crate::expression_world::Request::ActRetainedPerform {
                act_ref: "act:current-scene/original-instrument".into(),
                expression_ref: after.expression_ref.clone(),
                expected_revision: after.revision,
                expected_act_revision: None,
                summary: "Actual source and stopped original retained".into(),
                actor: "agent:current-instrument-proof".into(),
                activity_ref: None,
                changes: vec![Change::SceneRename {
                    scene_ref: scene_ref.clone(),
                    title: "Actual instrument birth".into(),
                }],
            })
            .unwrap();
        let saved = document(&mut kernel, &actual.expression_ref);
        let mut cold = crate::Kernel::new(crate::CentralClient::discover());
        cold.attach_act_store(&home).unwrap();
        let crate::KernelOpResult::ExpressionWorld { data: recorded } = recorded.result else {
            panic!("native retained Act result absent")
        };
        let act_revision = recorded["act"]["revision"].as_u64().unwrap();
        let inspected = cold
            .expression_world(crate::expression_world::Request::ActRetainedInspect {
                act_ref: "act:current-scene/original-instrument".into(),
            })
            .unwrap();
        let crate::KernelOpResult::ExpressionWorld { data: inspected } = inspected.result else {
            panic!("cold native Act result absent")
        };
        assert_eq!(inspected["act"]["revision"], act_revision);
        let restored = cold
            .expression_world(crate::expression_world::Request::ActRetainedEdition {
                act_ref: "act:current-scene/original-instrument".into(),
                expected_act_revision: act_revision,
                position: 0,
            })
            .unwrap();
        let crate::KernelOpResult::ExpressionWorld { data: restored } = restored.result else {
            panic!("cold native selected Edition absent")
        };
        assert_eq!(restored["document"], serde_json::to_value(&saved).unwrap());
        let selected_scene = saved
            .scenes
            .iter()
            .find(|s| s.scene_ref == scene_ref)
            .unwrap();
        // Cold custody is the actual store's complete selected native Edition.
        // This verifies source retention; numerical cold activation remains in
        // the separately owned readmission operation, never a Value grant here.
        let store = crate::expression_act_store::ActStore::at_home(&home);
        let actual_act = store
            .read_retained("act:current-scene/original-instrument")
            .unwrap()
            .unwrap();
        let native_selection = crate::expression_performance_delivery::Selection {
            expected_act_revision: act_revision,
            edition_position: 0,
            scene_ref: scene_ref.clone(),
            expected_expression_revision: saved.revision,
            expected_scene_revision: selected_scene.revision,
            performance_digest: selected_scene
                .performance
                .as_ref()
                .unwrap()
                .fingerprint()
                .unwrap(),
        };
        let selected = crate::expression_performance_delivery::SelectedPerformance::from_act(
            &actual_act,
            &native_selection,
        )
        .unwrap();
        assert_eq!(selected.document(), &saved);
        selected
            .verify_native_sources(&[defined["native_reply"]["result"]["source_artifact"]
                ["source_assets"]
                .clone()])
            .unwrap();
        let delivery = selected.native_payload().unwrap();
        assert_eq!(
            delivery["performance"],
            serde_json::to_value(selected_scene.performance.as_ref().unwrap()).unwrap()
        );
        assert_eq!(
            delivery["performance"]["native_sources"][0]["native_bundle"],
            defined["native_reply"]["result"]["source_artifact"]["source_assets"]
        );
        let reread = store
            .read_retained("act:current-scene/original-instrument")
            .unwrap()
            .unwrap();
        assert_eq!(
            reread, actual_act,
            "independent cold same-store read changed the original Act"
        );
        assert!(
            crate::expression_performance_delivery::SelectedPerformance::from_act(
                &reread,
                &crate::expression_performance_delivery::Selection {
                    expected_act_revision: act_revision + 1,
                    ..native_selection
                }
            )
            .is_err()
        );
        assert_eq!(
            kernel.native_expression.active.as_ref().unwrap().child.id(),
            pid
        );
        if let Some(lose_terminal) = lose_terminal {
            let unchanged = document(&mut kernel, &actual.expression_ref);
            let selected = unchanged
                .scenes
                .iter()
                .find(|s| s.scene_ref == scene_ref)
                .unwrap();
            let old_id = kernel
                .native_expression
                .active
                .as_ref()
                .unwrap()
                .last_request_id;
            let position = kernel
                .native_expression
                .active
                .as_ref()
                .unwrap()
                .procedural_position
                .clone();
            let command = NativeSceneRecordingRequest::Command {
                request_id: (old_id + 1).to_string(),
                lease: lease.clone(),
                expression_ref: unchanged.expression_ref.clone(),
                document_revision: unchanged.revision,
                scene_ref: scene_ref.clone(),
                scene_revision: selected.revision,
                actor: "agent:current-instrument-proof".into(),
                basis: 0,
                layer: 0,
                command: NativeRecordingCommand::CalibrateCurrent {},
            };
            // A genuine wrong-lease preflight on the same current Document
            // never writes, changes a counter, holds, or retires its owner.
            let mut wrong = command.clone();
            if let NativeSceneRecordingRequest::Command { lease, .. } = &mut wrong {
                *lease = "native:wrong-current-owner".into();
            }
            let refused = kernel.apply_native_scene_recording_request(wrong).unwrap();
            let crate::KernelOpResult::NativeExpression { data: refused } = refused.result else {
                panic!("wrong-lease recording returned another operation")
            };
            assert_eq!(refused["accepted"], false);
            assert_eq!(refused["delivery_attempted"], false);
            assert!(refused["native_reply"].is_null());
            assert!(kernel.native_expression.recording_failure.is_none());
            assert_eq!(
                kernel.native_expression.active.as_ref().unwrap().child.id(),
                pid
            );
            assert_eq!(
                kernel
                    .native_expression
                    .active
                    .as_ref()
                    .unwrap()
                    .last_request_id,
                old_id
            );
            assert_eq!(document(&mut kernel, &actual.expression_ref), unchanged);
            // No channel is fabricated here: this is the live socket accepted
            // from the actual source-qualified QL process opened above.
            let original = {
                let channel = kernel
                    .native_expression
                    .active
                    .as_ref()
                    .unwrap()
                    .act_channel
                    .as_ref()
                    .unwrap();
                if lose_terminal {
                    Some(channel.lose_actual_terminal_reply())
                } else {
                    channel.lose_reply_after_actual_write();
                    None
                }
            };
            let result = kernel
                .apply_native_scene_recording_request(command.clone())
                .unwrap();
            let crate::KernelOpResult::NativeExpression { data: result } = result.result else {
                panic!("actual lost-reply operation returned another result")
            };
            assert_eq!(result["accepted"], false);
            assert_eq!(result["delivery_attempted"], true);
            if let Some(original) = original {
                let original = original.lock().unwrap();
                let raw = original.as_ref().expect("actual qualified child must have produced its original terminal reply before loss");
                assert_eq!(raw["schema"], "ql.native-act-owner-result/v1");
                assert_eq!(raw["request_id"], (old_id + 1).to_string());
                assert_eq!(raw["last_request_id"], (old_id + 1).to_string());
                assert_eq!(raw["result"]["accepted"], true, "{raw}");
                assert_eq!(
                    raw["result"]["host_receipt"]["request_id"],
                    (old_id + 1).to_string()
                );
                let admission = &raw["result"]["native_pulse"]["payload"]["score_admission"];
                assert_eq!(admission["schema"], "ql.native-score-admission/v1");
                assert_eq!(admission["queued"], true);
                assert!(admission["input_ref"].is_null());
                assert_eq!(admission["event"]["kind"], 5);
                assert_eq!(admission["event"]["sample"], "0");
                assert_eq!(admission["event"]["sequence"], "1");
                assert_eq!(raw["result"]["native_pulse"]["applications"], json!([]));
            } else {
                assert!(
                    result["native_reply"].is_null(),
                    "EOF arrived before any original frame could be captured"
                );
                assert_eq!(result["diagnostics"]["receipts"], json!([]));
            }
            assert!(
                kernel.native_expression.active.is_none(),
                "actual attempted-delivery owner must be retired, never reissued"
            );
            assert!(kernel.native_expression.recording_failure.is_some());
            assert_eq!(
                document(&mut kernel, &actual.expression_ref),
                unchanged,
                "no invented native acknowledgement or recording CAS"
            );
            assert!(kernel
                .apply_native_scene_recording_request(command)
                .is_err());
            assert!(kernel.native_expression.apply(&crate::CentralClient::with("/nonexistent".into(),None,String::new()),
                super::super::Request::Exchange { lease: lease.clone(), request: json!({
                    "schema":"ql.field-host-request/v1","instance_ref":identity["instance_ref"],"event_ref":identity["event_ref"],
                    "subject_ref":identity["subject_ref"],"request_id":(old_id+1).to_string(),
                    "expected_generation":position["generation"],"expected_samples_elapsed":position["samples_elapsed"],
                    "command":{"operation":"performance-exchange","command":{"operation":"calibrate-current"}}}) }).is_err(),
                "ordinary Exchange must not bypass unresolved recording delivery custody");
            assert!(kernel.native_expression.active.is_none());
            return;
        }
        let current = document(&mut kernel, &actual.expression_ref);
        let current_scene = current
            .scenes
            .iter()
            .find(|s| s.scene_ref == scene_ref)
            .unwrap();
        let inspect_id = kernel
            .native_expression
            .active
            .as_ref()
            .unwrap()
            .last_request_id
            + 1;
        let inspected = kernel
            .apply_native_scene_recording_request(NativeSceneRecordingRequest::Command {
                request_id: inspect_id.to_string(),
                lease: lease.clone(),
                expression_ref: current.expression_ref.clone(),
                document_revision: current.revision,
                scene_ref: scene_ref.clone(),
                scene_revision: current_scene.revision,
                actor: "agent:current-instrument-proof".into(),
                basis: 0,
                layer: 0,
                command: NativeRecordingCommand::Inspect {},
            })
            .unwrap();
        let crate::KernelOpResult::NativeExpression { data: inspected } = inspected.result else {
            panic!("actual captured command after Begin returned another result")
        };
        assert_eq!(inspected["accepted"], true, "{inspected}");
        assert_eq!(inspected["delivery_attempted"], true);
        assert_eq!(
            inspected["native_reply"]["result"]["host_receipt"]["request_id"],
            inspect_id.to_string()
        );
        let actual_pulse = &inspected["native_reply"]["result"]["native_pulse"];
        assert_eq!(actual_pulse["accepted"], true);
        assert_eq!(actual_pulse["applications"], json!([]));
        assert_eq!(actual_pulse["input_history"], json!([]));
        assert_eq!(actual_pulse["last_input_ordinal"], "0");
        assert_eq!(actual_pulse["reading"]["last_input_ordinal"], "0");
        assert_eq!(document(&mut kernel, &actual.expression_ref), current);
        assert_eq!(
            kernel
                .native_expression
                .active
                .as_ref()
                .unwrap()
                .last_request_id,
            inspect_id
        );
        // These are source/initial-origin and actual pulse custody operations;
        // the separate native callback corpus proves nonempty apps/journals.
        kernel
            .native_expression
            .apply(
                &crate::CentralClient::with("/nonexistent".into(), None, String::new()),
                super::super::Request::Close { lease },
            )
            .unwrap();
    }
}
