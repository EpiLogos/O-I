//! Real world-source and explicit-return owner contract through the exact
//! candidate O:I executable and pinned Central executable. The registry-era
//! Flow lifecycle half is retired (Central #177): retained sources are the
//! ordinary world sources they always were, and the explicit return applies
//! through `projectcentral.source.write`.
use oi_cradle_kernel::{CentralClient, OwnerCallError};
use serde_json::json;
use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

// Return tests can run in parallel threads of one process; the wall-clock
// stamp alone can collide within the clock tick, so each root also carries a
// process-unique sequence number.
static ROOT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn candidate(name: &str) -> PathBuf {
    let variable = match name {
        "oi" => "OI_BIN",
        "ctrl" => "OI_CENTRAL_CTRL_BIN",
        _ => unreachable!(),
    };
    let path = PathBuf::from(
        std::env::var_os(variable)
            .unwrap_or_else(|| panic!("{variable} must name the frozen candidate executable")),
    );
    assert!(
        path.is_absolute(),
        "{variable} must be an absolute executable path: {}",
        path.display()
    );
    assert!(
        path.is_file(),
        "missing exact candidate executable: {}",
        path.display()
    );
    path
}

fn temporary_root() -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "oi-flow-return-{}-{stamp}-{pid}",
        ROOT_SEQUENCE.fetch_add(1, Ordering::Relaxed),
        pid = std::process::id()
    ));
    fs::create_dir(&root).unwrap();
    root
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn world_source_and_explicit_return_preserve_owner_identity_and_refusal() {
    let root = temporary_root();
    let client = CentralClient::with_suite_owner(
        candidate("oi"),
        candidate("ctrl"),
        Some(root.clone()),
        "Editor".into(),
    );
    client.run("central.init", json!({})).unwrap();
    fs::create_dir(root.join("Work/Editor")).unwrap();
    client
        .run(
            "projectcentral.init",
            json!({"project":"Editor", "project_id":"editor-flow-return"}),
        )
        .unwrap();

    // A retained source is an ordinary participating world source: the
    // project's wiki space joins the horizon on its own.
    let retained_path = root.join("Work/Editor/ProjectCentral/agents/wiki/retained.md");
    fs::create_dir_all(retained_path.parent().unwrap()).unwrap();
    fs::write(&retained_path, "retained source\n").unwrap();
    let horizon = client
        .run(
            "projectcentral.change.horizon",
            json!({"project": "Editor"}),
        )
        .unwrap();
    let source_ref = horizon["sources"]
        .as_array()
        .unwrap()
        .iter()
        .find(|source| source["binding"]["path"] == "ProjectCentral/agents/wiki/retained.md")
        .expect("the retained source participates in the project horizon")["binding"]["ref"]
        .as_str()
        .unwrap()
        .to_owned();
    let revision0 = client
        .source_read(Some("Editor"), &source_ref)
        .unwrap()
        .revision
        .revision;

    // The owner CAS write: exact basis, then a stale refusal.
    let written = client
        .source_write(
            Some("Editor"),
            &source_ref,
            &revision0,
            "human revision one\n",
            "human:test",
            "human",
        )
        .unwrap();
    let revision1 = written.revision.revision.clone();
    assert_ne!(revision1, revision0);
    let stale = client.source_write(
        Some("Editor"),
        &source_ref,
        &revision0,
        "stale write\n",
        "human:test",
        "human",
    );
    assert!(matches!(stale, Err(OwnerCallError::Refused { .. })));

    let evidence = vec!["evidence:flow-return-test".to_owned()];
    let proposal = client
        .source_return(
            "Editor",
            &source_ref,
            &revision1,
            "returned owner revision\n",
            "explicit return contract",
            &evidence,
            "session:test",
        )
        .unwrap();
    let return_ref = proposal.proposal.return_ref.clone();
    assert_eq!(proposal.proposal.schema, "central.source-return/v1");
    assert_eq!(proposal.proposal.source_ref, source_ref);
    assert_eq!(proposal.proposal.basis_revision, revision1);
    assert_eq!(proposal.proposal.evidence_refs, evidence);
    assert!(!proposal.authored_source_mutated);
    assert!(proposal.basis_current);
    let current = client.source_return_read("Editor", &return_ref).unwrap();
    assert_eq!(current.proposal.return_ref, return_ref);
    assert!(current.acceptance.available);
    let entries = client.source_returns("Editor", Some(10), None).unwrap();
    assert!(entries
        .entries
        .iter()
        .any(|entry| entry.return_ref == return_ref));

    // A stale acceptance is a successful owner response with no mutation;
    // recovery is an explicit re-read and retry against the retained basis.
    let conflict = client
        .source_return_accept(
            "Editor",
            &return_ref,
            &revision0,
            "human-accepted",
            "human:test",
        )
        .unwrap();
    assert_eq!(conflict.outcome, "conflict");
    assert!(!conflict.authored_source_mutated);
    assert_eq!(conflict.current.unwrap().revision.revision, revision1);
    assert!(conflict.receipt.is_none());
    let accepted = client
        .source_return_accept(
            "Editor",
            &return_ref,
            &revision1,
            "human-accepted",
            "human:test",
        )
        .unwrap();
    assert_eq!(accepted.outcome, "accepted");
    assert!(accepted.authored_source_mutated);
    let receipt = accepted.receipt.expect("owner write receipt");
    assert_eq!(receipt["owner_operation"], "projectcentral.source.write");
    assert_eq!(receipt["source"]["source"]["ref"], source_ref);
    assert_eq!(accepted.proposal.agent_session_ref, "session:test");
    assert_eq!(accepted.proposal.status, "accepted");

    let second = client
        .source_return(
            "Editor",
            &accepted.proposal.source_ref,
            accepted.proposal.result_revision.as_deref().unwrap(),
            "rejected proposal\n",
            "reject contract",
            &[],
            "session:test-2",
        )
        .unwrap();
    let rejected = client
        .source_return_reject("Editor", &second.proposal.return_ref)
        .unwrap();
    assert_eq!(rejected.proposal.status, "rejected");
    assert!(!rejected.authored_source_mutated);
    assert!(!rejected.automatic_agent_or_model_invocation);

    fs::remove_dir_all(root).unwrap();
}
