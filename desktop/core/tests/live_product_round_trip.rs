use aikit_core::resource::ResourceRef;
use aikit_core::{
    SessionSpaceAgentSession, SessionSpaceAuthorityState, SessionSpaceConnection,
    SessionSpaceConnectionState, SessionSpaceDefinition, SessionSpaceRef, SessionSpaceRuntime,
};
use epilogos_factory::build::{
    CandidateRecord, ExecutionRecord, FactoryBuildSelection, FactoryBuildState,
    REQUEST_MORE_EVIDENCE_ACTION_REF, REQUEST_MORE_EVIDENCE_CAPABILITY_REF,
};
use epilogos_factory::core::run::{Project, ProjectRef, Run, RunRef};
use oi_desktop_core::{
    correlate_session_spaces, dispatch_factory_action, observe_factory_build, ActionAuthorityGrant,
    ContributionAvailability, SessionSpaceCorrelationState, SurfaceActionEmission,
};
use std::str::FromStr;

const PROJECT: &str = "project:01ARZ3NDEKTSV4RRFFQ69G5FBA";
const RUN: &str = "run:01ARZ3NDEKTSV4RRFFQ69G5FBB";
const CANDIDATE: &str = "candidate:01ARZ3NDEKTSV4RRFFQ69G5FBC";
const EXECUTION: &str = "execution:01ARZ3NDEKTSV4RRFFQ69G5FBD";
const SPACE: &str = "session-space/oi-factory-round-trip";

fn factory_state() -> (FactoryBuildState, FactoryBuildSelection) {
    let project_ref = ProjectRef::from_str(PROJECT).unwrap();
    let run_ref = RunRef::from_str(RUN).unwrap();
    let project = Project::new(project_ref.clone());
    let run = Run::new(
        run_ref.clone(),
        project_ref.clone(),
        "O:I observes and acts on live Factory state",
        "factory-owner",
    )
    .unwrap();
    let mut state = FactoryBuildState::new(project, run).unwrap();
    state
        .insert_candidate(CandidateRecord {
            run_ref: run_ref.clone(),
            candidate_ref: CANDIDATE.into(),
            revision: 1,
            label: "Hosted Candidate".into(),
            status: "ready".into(),
            producing_execution_refs: vec![EXECUTION.into()],
            claim_refs: Vec::new(),
            evidence_refs: Vec::new(),
            artifact_refs: Vec::new(),
            preview_ref: Some("surface/factory-build".into()),
            tradeoffs: Vec::new(),
        })
        .unwrap();
    state
        .insert_execution(ExecutionRecord {
            run_ref: run_ref.clone(),
            execution_ref: EXECUTION.into(),
            status: "running".into(),
            agency_ref: Some("agency/mahamaya-build".into()),
            agent_ref: Some("agent/mahamaya".into()),
            harness_ref: Some("harness/deepseek".into()),
            harness_composition_ref: Some("harness-composition/live".into()),
            agent_session_ref: Some("agent-session/live".into()),
            session_space_ref: Some(SPACE.into()),
            surface_refs: vec!["surface/factory-build".into()],
            workcell_binding_refs: Vec::new(),
            native_trajectory_ref: Some("trajectory/native-live".into()),
        })
        .unwrap();
    (
        state,
        FactoryBuildSelection {
            project_ref,
            run_ref,
        },
    )
}

#[test]
fn factory_is_ready_only_after_a_real_factory_snapshot_is_observed() {
    let (state, selection) = factory_state();
    let ready = observe_factory_build(&state, &selection);
    assert_eq!(
        ready.contribution.contribution.availability,
        ContributionAvailability::Ready
    );
    let snapshot = ready.snapshot.unwrap();
    assert_eq!(snapshot.view.project.project_ref, PROJECT);
    assert_eq!(snapshot.view.run.run_ref, RUN);
    assert_eq!(
        snapshot.view.executions[0].session_space_ref.as_deref(),
        Some(SPACE)
    );

    let wrong = FactoryBuildSelection {
        project_ref: ProjectRef::from_str("project:01ARZ3NDEKTSV4RRFFQ69G5FBE").unwrap(),
        run_ref: selection.run_ref,
    };
    let degraded = observe_factory_build(&state, &wrong);
    assert_eq!(
        degraded.contribution.contribution.availability,
        ContributionAvailability::Degraded
    );
    assert!(degraded.snapshot.is_none());
}

#[test]
fn factory_session_space_ref_correlates_only_with_actual_aikit_read_model() {
    let (state, selection) = factory_state();
    let snapshot = observe_factory_build(&state, &selection).snapshot.unwrap();

    let missing = correlate_session_spaces(&snapshot, &[]);
    assert_eq!(missing[0].state, SessionSpaceCorrelationState::Missing);
    assert!(!missing[0].capability_granted);
    assert!(!missing[0].action_authorised);

    let space = SessionSpaceRef::parse(SPACE).unwrap();
    let mut runtime = SessionSpaceRuntime::open(SessionSpaceDefinition::new(space)).unwrap();
    let observed = runtime.read_model();
    let matched = correlate_session_spaces(&snapshot, &[observed]);
    assert_eq!(matched[0].state, SessionSpaceCorrelationState::Matched);
    assert!(!matched[0].capability_available);
    assert!(!matched[0].capability_granted);
    assert!(!matched[0].action_authorised);

    // Use AIKit's actual provider-health observation path rather than editing a
    // read model or treating Factory execution state as SessionSpace health.
    let provider = ResourceRef::parse("provider/deepseek-live").unwrap();
    let agent_session = ResourceRef::parse("agent-session/live").unwrap();
    let lease = runtime
        .bind_agent_session(SessionSpaceAgentSession {
            agent_session: agent_session.clone(),
            harness: ResourceRef::parse("harness/deepseek").unwrap(),
            native_session_id: Some("native-deepseek-session".into()),
            provider: Some(provider.clone()),
            provenance: vec!["O:I SessionSpace correlation conformance".into()],
        })
        .unwrap();
    runtime
        .observe_connection(
            &lease,
            SessionSpaceConnection {
                connection: ResourceRef::parse("connection/deepseek-live").unwrap(),
                provider: provider.clone(),
                protocol: "acp".into(),
                agent_session,
                component: None,
                surface: None,
                state: SessionSpaceConnectionState::Connected,
                native_session_id: Some("native-deepseek-session".into()),
                authority: SessionSpaceAuthorityState::default(),
                reason: None,
                provenance: vec!["provider-observed connection".into()],
            },
        )
        .unwrap();
    runtime
        .observe_provider_unavailable(&provider, "provider disappeared")
        .unwrap();
    let degraded = correlate_session_spaces(&snapshot, &[runtime.read_model()]);
    assert_eq!(
        degraded[0].state,
        SessionSpaceCorrelationState::ProviderDegraded
    );
    assert!(!degraded[0].capability_available);
    assert!(!degraded[0].capability_granted);
    assert!(!degraded[0].action_authorised);
}

#[test]
fn explicit_oi_authority_reaches_factory_and_new_product_revision_returns_to_host() {
    let (mut state, selection) = factory_state();
    let emission = SurfaceActionEmission {
        action_ref: REQUEST_MORE_EVIDENCE_ACTION_REF.into(),
        subject_ref: CANDIDATE.into(),
    };

    // Merely seeing the Action in a READY contribution supplies no dispatch grant.
    let observed = observe_factory_build(&state, &selection);
    assert_eq!(
        observed.contribution.contribution.actions[0].action_ref,
        REQUEST_MORE_EVIDENCE_ACTION_REF
    );

    let no_capability = ActionAuthorityGrant {
        authority_ref: "authority/oi-user".into(),
        action_ref: REQUEST_MORE_EVIDENCE_ACTION_REF.into(),
        native_owner: "factory".into(),
        capability_ref: None,
        capability_grant_ref: None,
    };
    assert!(dispatch_factory_action(&mut state, &selection, &emission, &no_capability).is_err());

    let wrong_owner = ActionAuthorityGrant {
        native_owner: "oi".into(),
        capability_ref: Some(REQUEST_MORE_EVIDENCE_CAPABILITY_REF.into()),
        capability_grant_ref: Some("capability-grant/factory-evidence".into()),
        ..no_capability.clone()
    };
    assert!(dispatch_factory_action(&mut state, &selection, &emission, &wrong_owner).is_err());

    let wrong_capability = ActionAuthorityGrant {
        capability_ref: Some("capability/factory/other".into()),
        capability_grant_ref: Some("capability-grant/other".into()),
        ..no_capability.clone()
    };
    assert!(
        dispatch_factory_action(&mut state, &selection, &emission, &wrong_capability).is_err()
    );

    let grant = ActionAuthorityGrant {
        capability_ref: Some(REQUEST_MORE_EVIDENCE_CAPABILITY_REF.into()),
        capability_grant_ref: Some("capability-grant/factory-evidence".into()),
        ..no_capability
    };
    let round_trip = dispatch_factory_action(&mut state, &selection, &emission, &grant).unwrap();
    assert!(round_trip.after.revision > round_trip.before.revision);
    assert_eq!(round_trip.after.view.human_requests.len(), 1);
    assert!(round_trip.after.view.human_requests[0]
        .question
        .contains(CANDIDATE));

    let observed_after = observe_factory_build(&state, &selection);
    assert_eq!(
        observed_after.snapshot.unwrap().revision,
        round_trip.after.revision
    );
}
