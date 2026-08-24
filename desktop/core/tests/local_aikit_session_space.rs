use aikit_adapters::SessionSpaceFileObservationProvider;
use aikit_core::{
    SessionSpaceDefinition, SessionSpaceLifecycle, SessionSpaceRef, SessionSpaceRuntime,
};
use oi_desktop_core::{ContributionAvailability, LocalAikitSessionSpaceHost};
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn owner_published_session_space_replaces_degraded_fallback_without_inferred_authority() {
    let space = SessionSpaceRef::parse("session-space/oi-live-observation").unwrap();
    let mut runtime =
        SessionSpaceRuntime::open(SessionSpaceDefinition::new(space.clone())).unwrap();
    let path = unique_observation_path();
    let publisher = SessionSpaceFileObservationProvider::publish(&path, &runtime).unwrap();

    let host = LocalAikitSessionSpaceHost::open(&path).unwrap();
    let ready = host.observe().unwrap();
    assert_eq!(ready.read_model.id, space);
    assert_eq!(ready.read_model.lifecycle, SessionSpaceLifecycle::Open);
    assert_eq!(
        ready.contribution.contribution.contribution_ref,
        "aikit.session-space/read-model"
    );
    assert_eq!(
        ready.contribution.contribution.availability,
        ContributionAvailability::Ready
    );
    assert!(ready.contribution.contribution.actions.is_empty());
    assert!(ready
        .read_model
        .connections
        .iter()
        .all(|connection| !connection.authority.capability_granted
            && !connection.authority.action_authorised));

    runtime.close().unwrap();
    publisher.republish(&runtime).unwrap();
    let degraded = host.observe().unwrap();
    assert!(degraded.read_model.revision > ready.read_model.revision);
    assert_eq!(degraded.read_model.lifecycle, SessionSpaceLifecycle::Closed);
    assert_eq!(
        degraded.contribution.contribution.availability,
        ContributionAvailability::Degraded
    );
    assert!(degraded.contribution.contribution.actions.is_empty());

    fs::remove_file(path).unwrap();
}

fn unique_observation_path() -> std::path::PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "oi-aikit-session-space-observation-{}-{nonce}.json",
        std::process::id()
    ))
}
