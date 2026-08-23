#[cfg(unix)]
mod unix {
    use std::collections::{BTreeMap, BTreeSet};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use aikit_core::model_runtime::{
        AccessFieldReading, InferenceEngineForm, InferenceEngineReading, MaterialResourceReading,
        ModelAccessReading, ModelMaterialisationReading, ModelRuntimeReadModel,
        ModelRuntimeRelation, ModelSurfaceReading, ModelVariantReading, PlacementObservation,
        RuntimeChangeApplication,
    };
    use aikit_core::{
        bounded_contemplate_preflight, wiki_living_dependencies, BoundedContemplateExecutor,
        ContemplateRequest, KnowledgeChangeHorizon, KnowledgeChangeKind,
        KnowledgeObservedSource, KnowledgeSourceChange, ProjectRef, ProviderRef, ResourceRef,
        RetractionMode, SemanticRevision, SourceRef, SourceRevision, WikiNode, WikiObject,
        WikiProvenanceRef, DEFAULT_CONTEMPLATE_OBJECT_BUDGET,
        DEFAULT_CONTEMPLATE_RELATION_DEPTH,
    };
    use oi_desktop_core::{
        AcpLivingContemplateExecutor, AgentSurfaceOpenRequest, AikitAgentSurface,
    };

    fn resource(value: &str) -> ResourceRef {
        ResourceRef::parse(value).unwrap()
    }

    fn source(value: &str) -> SourceRef {
        SourceRef::parse(value).unwrap()
    }

    fn revision(value: &str) -> SourceRevision {
        SourceRevision::parse(value).unwrap()
    }

    fn runtime() -> ModelRuntimeReadModel {
        ModelRuntimeReadModel {
            version: "aikit.model-runtime/v1".into(),
            project: Some(resource("project:test")),
            agent: Some(resource("agent:test")),
            agency: Some(resource("agency:test")),
            harness: resource("harness:test"),
            agent_session: Some("agent-session/living-test".into()),
            harness_composition_fingerprint: "living-test".into(),
            relation: ModelRuntimeRelation {
                model: ModelVariantReading {
                    model: resource("model:test"),
                    variant: "default".into(),
                },
                engine: InferenceEngineReading {
                    engine: resource("engine:test"),
                    provider: ProviderRef::parse("provider:test").unwrap(),
                    form: InferenceEngineForm::External,
                    revision: None,
                    provider_native: BTreeMap::new(),
                },
                materialisation: ModelMaterialisationReading {
                    binding_ref: "binding:test".into(),
                    workcell_ref: None,
                    placement: PlacementObservation::Local,
                    endpoint: None,
                    provider_native: BTreeMap::new(),
                    resources: MaterialResourceReading::default(),
                    lifetime_owner: "test".into(),
                    retraction: RetractionMode::Live,
                },
                model_surface: ModelSurfaceReading {
                    contract: None,
                    protocol: "acp".into(),
                    capabilities: BTreeSet::new(),
                    access: ModelAccessReading {
                        inference: AccessFieldReading::available(["text"]),
                        material_control: AccessFieldReading::unavailable("not required"),
                        interior: AccessFieldReading::unavailable("not required"),
                    },
                },
                change_application: RuntimeChangeApplication::Live,
            },
            components: vec![],
            contracts: vec![],
            surfaces: vec![],
            unavailable: vec![],
        }
    }

    fn preflight() -> aikit_core::BoundedContemplatePreflight {
        let src = source("central:source:project:test:README.md");
        let object = WikiObject::Node(WikiNode {
            profile: "okf-wiki/v1".into(),
            ref_id: resource("wiki:node:purpose"),
            revision: 1,
            provenance: vec![WikiProvenanceRef {
                source_ref: src.clone(),
                source_revision: Some(SemanticRevision::Text("r1".into())),
                producer_ref: None,
                generation_ref: None,
                extensions: BTreeMap::new(),
            }],
            node_type: "purpose".into(),
            title: Some("Purpose".into()),
            space_refs: vec![],
            source_refs: vec![src.clone()],
            local_space_ref: None,
            extensions: BTreeMap::new(),
        });
        let objects = vec![object];
        let (dependencies, resource_dependencies) = wiki_living_dependencies(&objects).unwrap();
        let horizon = KnowledgeChangeHorizon {
            provider: "central.filesystem-reconcile/v1".into(),
            cursor: 3,
            sources: vec![KnowledgeObservedSource {
                source: src.clone(),
                revision: Some(revision("r2")),
                available: true,
            }],
            changes: vec![KnowledgeSourceChange {
                cursor: 3,
                world_ref: "project:test".into(),
                source: src,
                roles: vec!["purpose".into()],
                provenance: "human-authored".into(),
                standing: "authored-human-position".into(),
                before_revision: Some(revision("r1")),
                after_revision: Some(revision("r2")),
                kind: KnowledgeChangeKind::Modified,
                agent_retrieval_allowed: false,
            }],
        };
        let runtime = runtime();
        bounded_contemplate_preflight(
            &ContemplateRequest {
                project: ProjectRef::parse("project:test").unwrap(),
                focus: vec![resource("wiki:node:purpose")],
                horizon: &horizon,
                dependencies: &dependencies,
                current_wiki_objects: &objects,
                runtime: &runtime,
                method: None,
                ql: None,
            },
            &resource_dependencies,
            DEFAULT_CONTEMPLATE_OBJECT_BUDGET,
            DEFAULT_CONTEMPLATE_RELATION_DEPTH,
        )
        .unwrap()
    }

    #[test]
    fn explicit_contemplate_crosses_one_real_acp_process_turn_and_ai_kit_validates_return() {
        let return_json = r#"{"version":"aikit.contemplate-return/v1","wiki_upserts":[],"integrative_readings":[],"candidates":["candidate:relation"],"tensions":["still-open"],"human_source_proposals":[{"source":"central:source:project:test:README.md","reason":"review wording","evidence":[]}]}"#;
        let (mut surface, prompt_log, root) = open_fixture_surface(return_json);
        let before = preflight();

        let mut executor = AcpLivingContemplateExecutor::new(&mut surface);
        let generated = executor.execute(&before).unwrap();
        assert_eq!(generated.candidates, vec!["candidate:relation"]);
        assert_eq!(generated.human_source_proposals.len(), 1);

        let sent = fs::read_to_string(&prompt_log).unwrap();
        assert!(sent.contains("aikit.contemplate-field/v1"));
        assert!(sent.contains("central:source:project:test:README.md"));
        assert!(sent.contains("aikit.contemplate-return/v1"));
        assert!(sent.contains("\"agent_retrieval_allowed\":false"));
        assert!(!sent.contains("SECRET_SOURCE_PAYLOAD"));

        surface.close().unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn free_chat_prose_from_real_acp_process_cannot_be_promoted_to_knowledge() {
        let (mut surface, _prompt_log, root) =
            open_fixture_surface("Here is what I think the project means.");
        let before = preflight();
        let mut executor = AcpLivingContemplateExecutor::new(&mut surface);
        let error = executor.execute(&before).unwrap_err();
        assert!(error.code().contains("knowledge.living_contemplate_return"));
        surface.close().unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    fn open_fixture_surface(response_text: &str) -> (AikitAgentSurface, std::path::PathBuf, std::path::PathBuf) {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "oi-living-contemplate-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        let prompt_log = root.join("prompt.txt");
        let script = format!(
            r#"
import json, sys
session_id = 'provider-living-1'
response = {response:?}
prompt_log = {prompt_log:?}
for line in sys.stdin:
    msg = json.loads(line)
    method = msg.get('method')
    rid = msg.get('id')
    if method == 'initialize':
        print(json.dumps({{'jsonrpc':'2.0','id':rid,'result':{{'protocolVersion':1,'agentCapabilities':{{}}}}}}), flush=True)
    elif method == 'session/new':
        print(json.dumps({{'jsonrpc':'2.0','id':rid,'result':{{'sessionId':session_id}}}}), flush=True)
    elif method == 'session/prompt':
        text = msg['params']['prompt'][0]['text']
        with open(prompt_log, 'w', encoding='utf-8') as handle:
            handle.write(text)
        split = max(1, len(response) // 2)
        for chunk in (response[:split], response[split:]):
            if chunk:
                print(json.dumps({{'jsonrpc':'2.0','method':'session/update','params':{{'sessionId':session_id,'update':{{'sessionUpdate':'agent_message_chunk','content':{{'type':'text','text':chunk}}}}}}}}), flush=True)
        print(json.dumps({{'jsonrpc':'2.0','id':rid,'result':{{'stopReason':'end_turn'}}}}), flush=True)
    elif method == 'session/cancel':
        pass
"#,
            response = response_text,
            prompt_log = prompt_log.display().to_string(),
        );
        let argv = vec!["python3".into(), "-u".into(), "-c".into(), script];
        let cwd = std::env::current_dir().unwrap().display().to_string();
        let (surface, opened) = AikitAgentSurface::open(AgentSurfaceOpenRequest {
            connection_ref: "connection/oi-living-test/acp".into(),
            agent_session_ref: "agent-session/living-test".into(),
            argv,
            cwd,
            mode: None,
            native_session_id: None,
            provenance: vec!["O:I Living Contemplate ACP process fixture".into()],
        })
        .unwrap();
        assert_eq!(
            opened.binding.agent_session.as_ref().unwrap().to_string(),
            "agent-session/living-test"
        );
        (surface, prompt_log, root)
    }
}
