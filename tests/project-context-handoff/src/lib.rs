#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use aikit_core::context::ContextDescriptor;
    use aikit_core::context_resolution::{
        Availability, ContextResolution, ProjectionIntent, ResolvedResource, RetrievalPlan,
        ScopeResolution, CONTEXT_RESOLUTION_VERSION,
    };
    use aikit_core::policy::ManagedPolicy;
    use aikit_core::project::{
        ProjectBinding, ProjectBindingLocator, ProjectConstituentRef, ProjectRef,
    };
    use aikit_core::resolve::{resolution_hash, ResolvedView};
    use aikit_core::resource::{
        Eligibility, ResourceDescriptor, ResourceKind, ResourceRecord, ResourceRef, ResourceSource,
        SourceAuthority, SourceRef, SourceRevision, SourceState,
    };
    use aikit_core::scope::ScopeKind;
    use aikit_core::session_space_application::ContextResolutionEvidence;
    use aikit_core::{
        attach_context_activations, ContextActivationEvidenceBasis, ContextActivationMode,
        ContextActivationReceipt, TargetId,
    };
    use epilogos_factory::core::run::RunRef;
    use epilogos_factory::project_development::{
        BoundedIntentCondition, BoundedIntentReturn, BoundedIntentReturnState,
        IntentCriterionEvaluation, IntentCriterionState, ProjectDevelopmentError,
        ProjectDevelopmentLedger,
    };
    use epilogos_factory::project_development_store::{
        FileProjectDevelopmentStore, ProjectDevelopmentStore,
    };

    #[test]
    fn exact_owner_p3_p4_p5_context_run_return_handoff() -> Result<(), Box<dyn std::error::Error>> {
        // P4 remains AIKit-owned. Build one real ContextResolution through the
        // public owner contracts, then make operative activation evidence part of
        // its content-addressed evidence basis.
        let context = ContextDescriptor::for_project("/tmp/oi-project-context-witness");
        let policy = ManagedPolicy::default();
        let active = BTreeMap::new();
        let skill_usage_overlays = BTreeMap::new();
        let hash = resolution_hash(&context, &policy, &active, &skill_usage_overlays);
        let deterministic = ResolvedView {
            context,
            policy,
            active,
            declared: BTreeMap::new(),
            unavailable: BTreeMap::new(),
            selection_log: vec![],
            catalog_index: BTreeMap::new(),
            skill_usage_overlays,
            warnings: vec![],
            hash,
            catalog_revision: "catalog:witness@1".into(),
            properties: BTreeMap::new(),
        };
        let project_binding = ProjectBinding::new(
            ProjectRef::parse("project:witness")?,
            ProjectConstituentRef::parse("source:working-tree")?,
            ProjectBindingLocator::LocalDirectory {
                path: "/tmp/oi-project-context-witness".into(),
            },
        );

        let context_source_ref = ResourceRef::parse("context-source:project:intent")?;
        let mut source_descriptor = ResourceDescriptor::new(
            context_source_ref.clone(),
            ResourceKind::ContextSource,
            "intent/feature.md",
            "Human-authored Project Intent source admitted to operative context",
        );
        source_descriptor
            .annotations
            .insert("source-role".into(), "intent".into());
        source_descriptor
            .annotations
            .insert("provenance".into(), "human-authored".into());
        source_descriptor.sources.push(ResourceSource {
            source: SourceRef::parse("source:central:project-intent")?,
            authority: Some(SourceAuthority::Authored),
            revision: Some(SourceRevision::parse("rev:1")?),
            locator: None,
            state: SourceState::Available,
        });
        let mut source_record = ResourceRecord::new(source_descriptor);
        source_record.eligibility = Eligibility::Eligible;

        let mut resolution = ContextResolution {
            version: CONTEXT_RESOLUTION_VERSION.into(),
            project_binding,
            deterministic,
            profiles: vec![],
            scopes: vec![ScopeResolution {
                kind: ScopeKind::Project,
                depth: 0,
                origin: "central:project-context".into(),
            }],
            agent: None,
            agency: None,
            host: None,
            capabilities: vec![],
            actions: vec![],
            context_sources: vec![ResolvedResource {
                resource: source_record,
                availability: Availability::Available,
            }],
            model_candidates: vec![],
            harness_candidates: vec![],
            execution_offers: vec![],
            projection: ProjectionIntent {
                targets: vec![],
                active_capabilities: vec![],
            },
            retrieval: RetrievalPlan {
                context_sources: vec![context_source_ref.clone()],
            },
            context_activations: vec![],
            warnings: vec![],
        };

        let pre_activation_evidence = ContextResolutionEvidence::from_resolution(&resolution)?;
        let activation = ContextActivationReceipt::new(
            context_source_ref,
            TargetId::new("guidance"),
            ContextActivationMode::Retrieved,
            ContextActivationEvidenceBasis::Observed,
            "context-source-provider",
            "current Project",
            "aikit-context-resolution",
            true,
            true,
            vec!["evidence:w11-context-retrieval".into()],
        )?;
        attach_context_activations(&mut resolution, [activation.clone()])?;
        let context_evidence = ContextResolutionEvidence::from_resolution(&resolution)?;
        let context_resolution_ref = context_evidence.reference.to_string();

        assert!(context_resolution_ref.starts_with("context-resolution/"));
        assert_eq!(context_evidence.project().as_str(), "project:witness");
        assert_ne!(pre_activation_evidence.reference, context_evidence.reference);
        assert_eq!(context_evidence.basis.context_activations, vec![activation]);
        assert!(context_evidence.basis.context_activations[0].materially_active);

        // P3 remains the native source's bounded determination. Factory records
        // its source ref and the AIKit P4 ref without parsing or replacing either.
        let run_ref: RunRef = "run:01ARZ3NDEKTSV4RRFFQ69G5FAV".parse()?;
        let intent_source_ref = "central:source/project-context/intent-feature".to_string();
        let success_condition_ref = "intent:success/portable-context-return".to_string();
        let mut ledger = ProjectDevelopmentLedger::new(run_ref.clone());
        ledger.set_intent(BoundedIntentCondition {
            run_ref: run_ref.clone(),
            condition_ref: "factory:condition/bounded-intent".into(),
            intent_source_ref: intent_source_ref.clone(),
            focus_ref: Some("project:witness".into()),
            success_condition_refs: vec![success_condition_ref.clone()],
            constraint_refs: vec!["intent:constraint/source-authority-preserved".into()],
            context_resolution_ref: context_resolution_ref.clone(),
        })?;

        // P5 returns evidence against exactly the P3 source and activation-bearing
        // P4 resolution which conditioned the Run.
        ledger.set_intent_return(BoundedIntentReturn {
            run_ref: run_ref.clone(),
            return_ref: "factory:return/bounded-intent".into(),
            intent_source_ref: intent_source_ref.clone(),
            context_resolution_ref: context_resolution_ref.clone(),
            artifact_refs: vec!["artifact:witness".into()],
            claim_refs: vec!["claim:witness".into()],
            evidence_refs: vec!["evidence:witness".into()],
            criterion_evaluations: vec![IntentCriterionEvaluation {
                criterion_ref: success_condition_ref,
                state: IntentCriterionState::Satisfied,
                evidence_refs: vec!["evidence:witness".into()],
            }],
        })?;
        assert_eq!(
            ledger.intent_return_state(),
            Some(BoundedIntentReturnState::Satisfied)
        );

        // The accepted Factory owner boundary must preserve the P3→P4→P5
        // relation across process/session restart rather than only in memory.
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
        let store_root = std::env::temp_dir().join(format!(
            "oi-project-context-handoff-{}-{nonce}",
            std::process::id()
        ));
        let first_process = FileProjectDevelopmentStore::new(&store_root);
        first_process.save(&ledger)?;
        drop(first_process);

        let reloaded_process = FileProjectDevelopmentStore::new(&store_root);
        let mut reloaded = reloaded_process
            .load(&run_ref)?
            .expect("persisted Run-scoped developmental state must exist");
        assert_eq!(reloaded, ledger);
        assert_eq!(
            reloaded
                .intent_return
                .as_ref()
                .expect("accepted return")
                .context_resolution_ref,
            context_resolution_ref
        );

        // Changing P4 identity after reload remains a real semantic mismatch:
        // Factory rejects it rather than allowing restart to erase context lineage.
        let changed_context_ref = format!("{context_resolution_ref}-changed");
        let mismatch = reloaded
            .set_intent_return(BoundedIntentReturn {
                run_ref,
                return_ref: "factory:return/context-mismatch".into(),
                intent_source_ref,
                context_resolution_ref: changed_context_ref.clone(),
                artifact_refs: vec![],
                claim_refs: vec![],
                evidence_refs: vec![],
                criterion_evaluations: vec![],
            })
            .expect_err("P5 return must retain the exact P4 identity after reload");
        assert!(matches!(
            mismatch,
            ProjectDevelopmentError::ContextResolutionMismatch { actual, .. }
                if actual == changed_context_ref
        ));

        fs::remove_dir_all(store_root)?;
        Ok(())
    }
}
