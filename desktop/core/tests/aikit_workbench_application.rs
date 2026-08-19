use aikit_core::{SessionSpaceMutation, SessionSpaceRef};
use aikit_store::{AikitHome, SessionSpaceApplicationStore};
use oi_desktop_core::{LocalAikitWorkbench, SessionSpaceFocusRequest};
use tempfile::TempDir;

#[test]
fn desktop_reads_and_focuses_the_same_canonical_session_space() {
    let temp = TempDir::new().unwrap();
    let home = AikitHome::at(temp.path());
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

    let desktop = LocalAikitWorkbench::at(temp.path());
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
    let reopened = LocalAikitWorkbench::at(temp.path())
        .read_session_space("session-space/personal-workbench")
        .unwrap();
    assert_eq!(reopened.state.id(), &space);
    assert_eq!(reopened.state.revision, 1);
    assert_eq!(reopened.history.len(), 2);
    assert_eq!(
        reopened.state.focus.as_ref().unwrap().target.to_string(),
        "wiki:node:lived-concern"
    );
}
