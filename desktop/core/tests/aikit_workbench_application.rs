use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use aikit_core::{SessionSpaceMutation, SessionSpaceRef};
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
