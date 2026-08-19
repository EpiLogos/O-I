use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use aikit_core::session_space_application::SessionSpaceMutation;
use aikit_core::{
    SessionSpaceLifecycle, SessionSpaceReadModel, SessionSpaceRef, SESSION_SPACE_VERSION,
};
use aikit_store::{AikitHome, SessionSpaceApplicationStore};
use oi_desktop_core::{LocalAikitWorkbench, SessionSpaceFocusRequest};

#[test]
fn desktop_reads_and_focuses_the_same_canonical_session_space() {
    let root = std::env::temp_dir().join(format!(
        "oi-aikit-workbench-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&root).unwrap();

    let home = AikitHome::at(&root);
    let store = SessionSpaceApplicationStore::new(home.clone());
    let space = SessionSpaceRef::parse("session-space/personal-workbench").unwrap();

    let create = store
        .stage(
            None,
            SessionSpaceMutation::Create {
                id: space.clone(),
                label: Some("Personal workbench".into()),
            },
        )
        .unwrap();
    let created = store.apply(&create).unwrap();
    assert_eq!(created.sequence, 0);

    let desktop = LocalAikitWorkbench::at(&root);
    let listed = desktop.list_session_spaces().unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id(), &space);

    let before = desktop
        .read_session_space("session-space/personal-workbench")
        .unwrap();
    assert_eq!(before.state.revision, 0);
    assert_eq!(before.history.len(), 1);
    assert!(before.runtime.is_none());

    let runtime = SessionSpaceReadModel {
        version: SESSION_SPACE_VERSION.into(),
        id: space.clone(),
        lifecycle: SessionSpaceLifecycle::Open,
        revision: 7,
        projects: Vec::new(),
        agent_sessions: Vec::new(),
        components: Vec::new(),
        surfaces: Vec::new(),
        connections: Vec::new(),
        provenance: vec!["target-owned runtime observation".into()],
    };
    let reconciled = desktop
        .read_session_space_with_runtime("session-space/personal-workbench", Some(&runtime))
        .unwrap();
    assert_eq!(reconciled.runtime.as_ref().unwrap().revision, 7);
    assert!(reconciled.explanation.reconstruction.is_some());
    assert_eq!(reconciled.state.id(), &space);

    // A provider observation for another canonical SessionSpace is unrelated
    // evidence. It is ignored rather than substituted or allowed to block access
    // to the requested canonical application state.
    let wrong_runtime = SessionSpaceReadModel {
        id: SessionSpaceRef::parse("session-space/not-the-same-space").unwrap(),
        ..runtime.clone()
    };
    let unrelated = desktop
        .read_session_space_with_runtime(
            "session-space/personal-workbench",
            Some(&wrong_runtime),
        )
        .unwrap();
    assert_eq!(unrelated.state.id(), &space);
    assert!(unrelated.runtime.is_none());
    assert!(unrelated.explanation.reconstruction.is_none());

    let receipt = desktop
        .focus_session_space(&SessionSpaceFocusRequest {
            session_space_ref: space.to_string(),
            target_ref: "wiki:node:lived-concern".into(),
            region: Some("knowledge".into()),
        })
        .unwrap();
    assert_eq!(receipt.sequence, 1);
    assert_eq!(receipt.after.revision, 1);

    // Re-open through a fresh desktop binding: no O:I-local SessionSpace state is
    // needed to preserve identity, focus or History.
    let reopened = LocalAikitWorkbench::at(&root)
        .read_session_space("session-space/personal-workbench")
        .unwrap();
    assert_eq!(reopened.state.id(), &space);
    assert_eq!(reopened.state.revision, 1);
    assert_eq!(reopened.history.len(), 2);
    assert_eq!(
        reopened.state.focus.as_ref().unwrap().target.to_string(),
        "wiki:node:lived-concern"
    );

    fs::remove_dir_all(root).unwrap();
}
