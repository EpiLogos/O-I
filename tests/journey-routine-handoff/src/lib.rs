#[cfg(test)]
mod tests {
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use aikit_core::method::{Method, METHOD_VERSION};
    use aikit_core::resource::{
        prove_method, MethodProofInput, ResourceRef, Routine, RoutineAuthority, RoutineExplanation,
        RoutineState, RoutineTrigger, SourceRef, SourceRevision, METHOD_PROOF_VERSION,
        ROUTINE_VERSION,
    };
    use central_ctrl::{
        AgentProfile, AgentProfileScope, AgentProfileStore, WorldGraph, WorldRecord, WorldRef,
        AGENT_PROFILE_SCHEMA,
    };
    use epilogos_factory::build::{FactoryBuildSelection, FactoryBuildState};
    use epilogos_factory::core::run::{Project, ProjectRef, Run, RunRef};
    use epilogos_factory::journey::{Journey, JourneyCommission, JourneyReturn};
    use epilogos_factory::journey_build::developmental_build_snapshot;
    use epilogos_factory::journey_commission::{
        JourneyAccountableSubject, JourneyCommissionState,
    };
    use epilogos_factory::journey_praxis::{
        JourneyAgentProfileSelection, JourneyMethodProofCorrelation, JourneyPraxisContext,
        JourneyPraxisReturn, JourneyRoutineObservation, AIKIT_METHOD_PROOF_SCHEMA,
        AIKIT_METHOD_SCHEMA, AIKIT_ROUTINE_SCHEMA, CENTRAL_AGENT_PROFILE_SCHEMA,
    };

    fn resource(value: &str) -> ResourceRef {
        ResourceRef::parse(value).unwrap()
    }

    fn source(value: &str) -> SourceRef {
        SourceRef::parse(value).unwrap()
    }

    fn source_revision(value: &str) -> SourceRevision {
        SourceRevision::parse(value).unwrap()
    }

    fn routine_state(state: RoutineState) -> &'static str {
        match state {
            RoutineState::Draft => "draft",
            RoutineState::Enabled => "enabled",
            RoutineState::Disabled => "disabled",
            RoutineState::StaleProof => "stale-proof",
        }
    }

    fn routine_observation(
        routine: &Routine,
        explanation: &RoutineExplanation,
    ) -> JourneyRoutineObservation {
        JourneyRoutineObservation {
            contract: ROUTINE_VERSION.into(),
            routine_ref: explanation.routine.to_string(),
            method_ref: explanation.method.to_string(),
            method_revision: explanation.method_revision.to_string(),
            proof_ref: explanation.proof_ref.to_string(),
            routine_state: routine_state(explanation.state).into(),
            agent_profile_ref: explanation
                .agent_profile_ref
                .as_ref()
                .map(ToString::to_string),
            activity_refs: routine
                .proof
                .activity_refs
                .iter()
                .map(ToString::to_string)
                .collect(),
            evidence_refs: routine
                .proof
                .evidence_refs
                .iter()
                .map(ToString::to_string)
                .collect(),
            return_refs: routine
                .proof
                .return_refs
                .iter()
                .map(ToString::to_string)
                .collect(),
        }
    }

    #[test]
    fn exact_owner_agent_profile_method_proof_routine_journey_build_handoff(
    ) -> Result<(), Box<dyn std::error::Error>> {
        assert_eq!(AGENT_PROFILE_SCHEMA, CENTRAL_AGENT_PROFILE_SCHEMA);
        assert_eq!(METHOD_VERSION, AIKIT_METHOD_SCHEMA);
        assert_eq!(METHOD_PROOF_VERSION, AIKIT_METHOD_PROOF_SCHEMA);
        assert_eq!(ROUTINE_VERSION, AIKIT_ROUTINE_SCHEMA);

        // Central owns the saved AgentProfile source relation. Prove an actual
        // source save -> read before any downstream consumer sees the profile ref.
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
        let central_root = std::env::temp_dir().join(format!(
            "oi97-w12-central-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&central_root)?;

        let personal_world = WorldRef::new("world:personal")?;
        let mut worlds = WorldGraph::default();
        worlds.insert(WorldRecord::new(
            personal_world.clone(),
            "world-rev-1",
            None,
        ))?;

        let mut authored_profile = AgentProfile::new(
            "agent-profile:researcher",
            "profile-rev-1",
            "agent:researcher",
            AgentProfileScope::Personal,
            personal_world,
        )?;
        authored_profile.method_refs = vec!["method:verified-research".into()];
        authored_profile.routine_refs = vec!["routine:daily-research".into()];
        authored_profile.purpose = Some("Carry verified research returns through time.".into());
        authored_profile.validate_against(&worlds)?;

        let profile_store = AgentProfileStore::personal(&central_root);
        let write = profile_store.save(&authored_profile, None)?;
        assert!(write.created);
        let profile_reading = profile_store.read(&authored_profile.profile_ref)?;
        assert_eq!(
            profile_reading.profile.routine_refs,
            vec!["routine:daily-research".to_string()]
        );
        let profile_handoff = profile_reading.profile.handoff();
        assert_eq!(profile_handoff.semantic_identity_owner, "Actuation");
        assert_eq!(profile_handoff.operational_resolution_owner, "AIKit");
        assert_eq!(profile_handoff.materialisation_owner, "Workcell");
        assert!(!profile_handoff.source_profile_is_agent_identity);
        assert!(!profile_handoff.source_profile_is_effective_profile);
        assert!(!profile_handoff.source_profile_is_material_binding);

        // Factory owns the developmental Run/Journey returned reality.
        let project_ref: ProjectRef = "project:01ARZ3NDEKTSV4RRFFQ69G5FAE".parse()?;
        let run_ref: RunRef = "run:01ARZ3NDEKTSV4RRFFQ69G5FAA".parse()?;
        let project = Project::new(project_ref.clone());
        let run = Run::new(
            run_ref.clone(),
            project_ref.clone(),
            "Return one verified research Method",
            "factory",
        )?;
        let build_state = FactoryBuildState::new(project, run)?;
        let selection = FactoryBuildSelection {
            project_ref: project_ref.clone(),
            run_ref: run_ref.clone(),
        };

        let mut journey = Journey::new(
            "journey:01ARZ3NDEKTSV4RRFFQ69G5FAD".parse()?,
            project_ref,
            JourneyCommission {
                purpose: "Carry verified research as a developmental responsibility.".into(),
                commission_ref: Some("commission:w12-exact-main".into()),
                why_refs: vec!["source:oi97-w12".into()],
            },
            "Verify the Method and admit only proven repetition.",
            "2026-09-02T20:00:00Z",
        )?;
        journey.add_run(
            run_ref.clone(),
            vec!["basis:exact-owner-main".into()],
            vec!["agent-session:w12-first".into()],
        )?;
        journey.correlate_activity("activity:research:1")?;
        journey.record_return(JourneyReturn {
            return_ref: "return:research:1".into(),
            run_refs: vec![run_ref.clone()],
            basis_refs: vec!["method:verified-research".into()],
            evidence_refs: vec!["evidence:research:1".into()],
            recognition_ref: None,
            summary: "Verified research return.".into(),
        })?;

        let commission = JourneyCommissionState::commission(
            &journey,
            "commission:w12-exact-main",
            "human:owner",
            JourneyAccountableSubject::Agent {
                agent_ref: profile_handoff.agent_ref.clone(),
            },
            "Return verified research repeatedly while this Journey remains responsible.",
            vec!["closure:verified-research-return".into()],
        )?;

        // AIKit owns Method proof and Routine semantics. Build the proof from the
        // exact Factory-returned refs, then enable the Routine with current authority.
        let method = Method {
            id: resource("method:verified-research"),
            source: source("source:project-method"),
            revision: Some(source_revision("method-rev-1")),
            name: "Verified research return".into(),
            description: String::new(),
            focus: vec![],
            project_domain: vec![],
            skills: vec![],
            actions: vec![resource("action:research")],
            capabilities: vec![],
            context_sources: vec![],
            verification: vec![resource("verification:research")],
            expected_resolve: None,
            expected_return_forms: vec!["evidence-bearing-return".into()],
        };
        let proof = prove_method(
            &method,
            MethodProofInput {
                proof_ref: resource("proof:research:v1"),
                context_resolution_ref: resource("context-resolution:abc123"),
                activity_refs: vec![resource("activity:research:1")],
                return_refs: vec![resource("return:research:1")],
                evidence_refs: vec![resource("evidence:research:1")],
                verification_refs: vec![resource("verification:research:1")],
                invocation_succeeded: true,
                verification_passed: true,
            },
        )?;
        assert!(proof.matches_method(&method));

        let mut routine = Routine::new(
            resource("routine:daily-research"),
            source("source:control:routines"),
            Some(source_revision("routine-rev-1")),
            "Daily research",
            "",
            &method,
            proof.clone(),
            RoutineTrigger::Schedule {
                schedule_ref: "schedule:daily".into(),
            },
            RoutineAuthority {
                authority_ref: resource("authority:routine:research"),
                action_refs: vec![resource("action:research")],
                granted: true,
                unattended: true,
            },
            Some(resource(&profile_handoff.profile_ref)),
            vec![resource("world:personal")],
        )?;
        routine.enable(&method)?;
        let explanation = routine.explain();
        assert_eq!(
            explanation
                .agent_profile_ref
                .as_ref()
                .map(ToString::to_string),
            Some(profile_handoff.profile_ref.clone())
        );
        assert!(profile_reading
            .profile
            .routine_refs
            .contains(&explanation.routine.to_string()));

        // Factory consumes only owner-native refs/readings. It requires the Routine
        // proof to have already returned through this Journey before correlation.
        let mut praxis = JourneyPraxisContext::new(&journey);
        praxis.select_agent_profile(
            &journey,
            JourneyAgentProfileSelection {
                contract: AGENT_PROFILE_SCHEMA.into(),
                profile_ref: profile_handoff.profile_ref.clone(),
                profile_revision: profile_handoff.revision.clone(),
                agent_ref: profile_handoff.agent_ref.clone(),
                source_world_ref: profile_handoff.source_world.to_string(),
            },
        )?;
        praxis.record_praxis_return(
            &journey,
            JourneyPraxisReturn {
                run_ref: run_ref.clone(),
                method_contract: METHOD_VERSION.into(),
                method_ref: proof.method.to_string(),
                method_revision: proof.method_revision.to_string(),
                context_resolution_ref: proof.context_resolution_ref.to_string(),
                body_condition_refs: vec!["harness-composition:research".into()],
                activity_refs: proof
                    .activity_refs
                    .iter()
                    .map(ToString::to_string)
                    .collect(),
                evidence_refs: proof
                    .evidence_refs
                    .iter()
                    .map(ToString::to_string)
                    .collect(),
                return_refs: proof
                    .return_refs
                    .iter()
                    .map(ToString::to_string)
                    .collect(),
                proof: Some(JourneyMethodProofCorrelation {
                    contract: METHOD_PROOF_VERSION.into(),
                    proof_ref: proof.proof_ref.to_string(),
                    verification_refs: proof
                        .verification_refs
                        .iter()
                        .map(ToString::to_string)
                        .collect(),
                }),
            },
        )?;
        praxis.observe_routine(&journey, routine_observation(&routine, &explanation))?;

        let snapshot = developmental_build_snapshot(
            &build_state,
            &selection,
            &journey,
            &commission,
            &praxis,
        )?;
        assert_eq!(snapshot.build.view.run.run_ref, run_ref.to_string());
        assert_eq!(snapshot.commission.journey_ref, journey.journey_ref);
        assert_eq!(snapshot.praxis.journey_ref, journey.journey_ref);
        assert_eq!(
            snapshot.praxis.agent_profiles[0].profile_ref,
            profile_handoff.profile_ref
        );
        assert_eq!(
            snapshot.praxis.praxis_returns[0].method_ref,
            method.id.to_string()
        );
        assert_eq!(
            snapshot.praxis.routines[0].routine_ref,
            routine.id.to_string()
        );
        assert!(snapshot.praxis.revalidation_required_routine_refs.is_empty());

        // Method drift is detected by AIKit, not Factory. Factory merely consumes
        // the returned stale-proof state and exposes revalidation pressure.
        let mut changed_method = method.clone();
        changed_method.revision = Some(source_revision("method-rev-2"));
        let drift = routine
            .enable(&changed_method)
            .expect_err("changed Method revision must stale the accepted proof");
        assert_eq!(drift.code(), "routine.proof_stale");
        let stale = routine.explain();
        assert_eq!(stale.state, RoutineState::StaleProof);
        praxis.observe_routine(&journey, routine_observation(&routine, &stale))?;
        let stale_snapshot = developmental_build_snapshot(
            &build_state,
            &selection,
            &journey,
            &commission,
            &praxis,
        )?;
        assert_eq!(
            stale_snapshot.praxis.revalidation_required_routine_refs,
            vec![routine.id.to_string()]
        );

        fs::remove_dir_all(central_root)?;
        Ok(())
    }
}
