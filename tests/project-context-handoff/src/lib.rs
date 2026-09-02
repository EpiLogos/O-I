#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use aikit_core::context::ContextDescriptor;
    use aikit_core::context_resolution::{
        ContextResolution, ProjectionIntent, RetrievalPlan, ScopeResolution,
        CONTEXT_RESOLUTION_VERSION,
    };
    use aikit_core::policy::ManagedPolicy;
    use aikit_core::project::{
        ProjectBinding, ProjectBindingLocator, ProjectConstituentRef, ProjectRef,
    };
    use aikit_core::resolve::{resolution_hash, ResolvedView};
    use aikit_core::scope::ScopeKind;
    use aikit_core::session_space_application::ContextResolutionEvidence;
    use epilogos_factory::core::run::RunRef;
    use epilogos_factory::project_development::{
        BoundedIntentCondition, BoundedIntentReturn, BoundedIntentReturnState,
        IntentCriterionEvaluation, IntentCriterionState, ProjectDevelopmentError,
        ProjectDevelopmentLedger,
    };

    #[test]
    fn exact_owner_p3_p4_p5_context_run_return_handoff() -> Result<(), Box<dyn std::error::Error>> {
        // P4 remains AIKit-owned. Build one real ContextResolution through the
        // public owner contracts, then derive its content-addressed evidence ref.
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
        let resolution = ContextResolution {
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
            context_sources: vec![],
            model_candidates: vec![],
            harness_candidates: vec![],
            execution_offers: vec![],
            projection: ProjectionIntent {
                targets: vec![],
                active_capabilities: vec![],
            },
            retrieval: RetrievalPlan {
                context_sources: vec![],
            },
            warnings: vec![],
        };
        let context_evidence = ContextResolutionEvidence::from_resolution(&resolution)?;
        let context_resolution_ref = context_evidence.reference.to_string();
        assert!(context_resolution_ref.starts_with("context-resolution/"));
        assert_eq!(context_evidence.project().as_str(), "project:witness");

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

        // P5 returns evidence against exactly the P3 source and P4 resolution
        // which conditioned the Run.
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
        assert_eq!(
            ledger
                .intent_return
                .as_ref()
                .expect("accepted return")
                .context_resolution_ref,
            context_resolution_ref
        );

        // Changing the AIKit P4 identity on return is not a harmless string edit:
        // Factory rejects the return rather than allowing context drift.
        let changed_context_ref = format!("{context_resolution_ref}-changed");
        let mismatch = ledger
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
            .expect_err("P5 return must retain the exact P4 identity");
        assert!(matches!(
            mismatch,
            ProjectDevelopmentError::ContextResolutionMismatch { actual, .. }
                if actual == changed_context_ref
        ));

        Ok(())
    }
}
