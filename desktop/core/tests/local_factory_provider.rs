use epilogos_factory::build::{
    CandidateRecord, FactoryBuildSelection, FactoryBuildState, REQUEST_MORE_EVIDENCE_ACTION_REF,
    REQUEST_MORE_EVIDENCE_CAPABILITY_REF,
};
use epilogos_factory::build_provider::FactoryBuildFileProvider;
use epilogos_factory::core::run::{Project, ProjectRef, Run, RunRef};
use oi_desktop_core::{
    ActionAuthorityGrant, ContributionAvailability, LocalFactoryHost, SurfaceActionEmission,
};
use std::fs;
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};

const PROJECT: &str = "project:01ARZ3NDEKTSV4RRFFQ69G5FDA";
const RUN: &str = "run:01ARZ3NDEKTSV4RRFFQ69G5FDB";
const CANDIDATE: &str = "candidate:01ARZ3NDEKTSV4RRFFQ69G5FDC";

#[test]
fn local_host_observes_factory_owned_file_provider_and_persists_authorised_action() {
    let project_ref = ProjectRef::from_str(PROJECT).unwrap();
    let run_ref = RunRef::from_str(RUN).unwrap();
    let project = Project::new(project_ref.clone());
    let run = Run::new(
        run_ref.clone(),
        project_ref.clone(),
        "O:I local host provider proof",
        "factory-owned-provider",
    )
    .unwrap();
    let mut state = FactoryBuildState::new(project, run).unwrap();
    state
        .insert_candidate(CandidateRecord {
            run_ref: run_ref.clone(),
            candidate_ref: CANDIDATE.into(),
            revision: 1,
            label: "Local provider Candidate".into(),
            status: "ready".into(),
            producing_execution_refs: Vec::new(),
            claim_refs: Vec::new(),
            evidence_refs: Vec::new(),
            artifact_refs: Vec::new(),
            preview_ref: None,
            tradeoffs: Vec::new(),
        })
        .unwrap();
    let selection = FactoryBuildSelection {
        project_ref,
        run_ref: run_ref.clone(),
    };
    let path = unique_state_path();
    FactoryBuildFileProvider::create(&path, selection.clone(), state).unwrap();

    let mut host = LocalFactoryHost::open(&path, selection.clone()).unwrap();
    let observed = host.observe().unwrap();
    assert_eq!(
        observed.contribution.contribution.availability,
        ContributionAvailability::Ready
    );
    assert_eq!(
        observed.contribution.contribution.contribution_ref,
        "factory.surface/build"
    );
    let before = observed.snapshot.unwrap();
    assert!(before.view.human_requests.is_empty());

    let emission = SurfaceActionEmission {
        action_ref: REQUEST_MORE_EVIDENCE_ACTION_REF.into(),
        subject_ref: CANDIDATE.into(),
    };
    let absent_capability = ActionAuthorityGrant {
        authority_ref: "authority/local-host".into(),
        action_ref: REQUEST_MORE_EVIDENCE_ACTION_REF.into(),
        native_owner: "factory".into(),
        capability_ref: None,
        capability_grant_ref: None,
    };
    assert!(host.dispatch(&emission, &absent_capability).is_err());
    assert_eq!(
        host.observe().unwrap().snapshot.unwrap().revision,
        before.revision
    );

    let grant = ActionAuthorityGrant {
        capability_ref: Some(REQUEST_MORE_EVIDENCE_CAPABILITY_REF.into()),
        capability_grant_ref: Some("capability-grant/local-factory-evidence".into()),
        ..absent_capability
    };
    let round_trip = host.dispatch(&emission, &grant).unwrap();
    assert!(round_trip.after.revision > round_trip.before.revision);
    assert_eq!(round_trip.after.view.human_requests.len(), 1);

    drop(host);
    let reopened = FactoryBuildFileProvider::open(&path, selection).unwrap();
    let persisted = reopened.snapshot().unwrap();
    assert_eq!(persisted.revision, round_trip.after.revision);
    assert_eq!(persisted.view.human_requests.len(), 1);

    fs::remove_file(path).unwrap();
}

fn unique_state_path() -> std::path::PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "oi-local-factory-provider-{}-{nonce}.json",
        std::process::id()
    ))
}
