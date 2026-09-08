//! Real retained-Flow and source-return owner contract through the exact
//! candidate O:I executable and pinned Central executable.
use oi_cradle_kernel::flow::{OwnerCallError, Request, Response};
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::json;
use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

fn candidate(name: &str) -> PathBuf {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let path = match name {
        "oi" => manifest.join("../../../cli/target/debug/oi"),
        "ctrl" => manifest.join("../../../../Central/target/debug/ctrl"),
        _ => unreachable!(),
    };
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
    let root = std::env::temp_dir().join(format!("oi-flow-return-{stamp}-{}", std::process::id()));
    fs::create_dir(&root).unwrap();
    root
}

#[test]
fn retained_flow_and_explicit_return_preserve_owner_identity_and_refusal() {
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

    let retained_path = root.join("Work/Editor/ProjectCentral/now/flows/retained.md");
    fs::create_dir_all(retained_path.parent().unwrap()).unwrap();
    fs::write(&retained_path, "retained source\n").unwrap();
    let adopted = client
        .flow_adopt(
            "Editor",
            "ProjectCentral/now/flows/retained.md",
            "human:test",
            "human",
            Some("Adopted Flow"),
            None,
        )
        .unwrap();
    assert_eq!(adopted.path, "ProjectCentral/now/flows/retained.md");
    assert_eq!(adopted.revisions[0].source_path, adopted.path);

    let created = client
        .flow_create(
            "Editor",
            "human:test",
            "human",
            Some("2026-09-08-1200"),
            None,
            Some("Owner Flow"),
            None,
        )
        .unwrap();
    let flow_ref = created.flow_ref.clone();
    let source_ref = created.source_ref.clone();
    let revision0 = created.current_revision.clone();
    assert_eq!(created.scope_ref, "project:editor-flow-return");
    assert_eq!(created.privacy, "inherits-source-authority");
    assert_eq!(created.revisions[0].actor, "human:test");
    assert_eq!(created.revisions[0].actor_kind, "human");

    let read = client
        .flow_read("Editor", &flow_ref, Some(&revision0))
        .unwrap();
    assert_eq!(read.flow.flow_ref, flow_ref);
    assert_eq!(read.flow.source_ref, source_ref);
    assert_eq!(read.content, "");
    assert!(!read.automatic_agent_or_model_invocation);

    let written = client
        .flow_write(
            "Editor",
            &flow_ref,
            &revision0,
            "first owner revision\n",
            "human:test",
            "human",
            None,
        )
        .unwrap();
    let revision1 = written.current_revision.clone();
    assert_ne!(revision1, revision0);
    let stale = client.flow_write(
        "Editor",
        &flow_ref,
        &revision0,
        "stale revision\n",
        "human:test",
        "human",
        None,
    );
    assert!(matches!(stale, Err(OwnerCallError::Refused { .. })));

    let dormant = client
        .flow_lifecycle("Editor", &flow_ref, &revision1, "dormant")
        .unwrap();
    assert_eq!(dormant.flow_ref, flow_ref);
    assert_eq!(dormant.lifecycle, "dormant");
    let renamed = client
        .flow_rename(
            "Editor",
            &flow_ref,
            &revision1,
            "ProjectCentral/now/flows/renamed.md",
        )
        .unwrap();
    assert_eq!(renamed.flow_ref, flow_ref);
    assert_eq!(
        renamed.source_ref,
        "central:source:project:editor-flow-return:ProjectCentral/now/flows/renamed.md"
    );

    let inspected = client.flow_inspect("Editor", &flow_ref).unwrap();
    assert_eq!(inspected.flow.flow_ref, flow_ref);
    assert_eq!(inspected.flow.source_ref, renamed.source_ref);
    assert_eq!(inspected.schema, "central.project-flow-inspection/v1");
    let history = client.flow_history("Editor", &flow_ref).unwrap();
    assert_eq!(history.flow_ref, flow_ref);
    assert_eq!(history.current_revision, revision1);
    assert_eq!(history.revisions.len(), 2);
    assert!(history.revisions.iter().any(|r| r.actor == "human:test"));
    let listed = client.flow_list("Editor").unwrap();
    assert!(listed.flows.iter().any(|flow| flow.flow_ref == flow_ref));

    let evidence = vec!["evidence:flow-return-test".to_owned()];
    let proposal = client
        .source_return(
            "Editor",
            &renamed.source_ref,
            &revision1,
            "returned owner revision\n",
            "explicit return contract",
            &evidence,
            "session:test",
        )
        .unwrap();
    let return_ref = proposal.proposal.return_ref.clone();
    assert_eq!(proposal.proposal.schema, "central.source-return/v1");
    assert_eq!(proposal.proposal.source_ref, renamed.source_ref);
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
    assert_eq!(receipt["owner_operation"], "projectcentral.flow.write");
    assert_eq!(receipt["flow"]["flow_ref"], flow_ref);
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

#[test]
fn kernel_apply_exposes_typed_owner_flow_return_seam() {
    let root = temporary_root();
    let client = CentralClient::with_suite_owner(
        candidate("oi"),
        candidate("ctrl"),
        Some(root.clone()),
        "KernelEditor".into(),
    );
    client.run("central.init", json!({})).unwrap();
    fs::create_dir(root.join("Work/KernelEditor")).unwrap();
    client
        .run(
            "projectcentral.init",
            json!({"project":"KernelEditor", "project_id":"kernel-flow-return"}),
        )
        .unwrap();

    let mut kernel = Kernel::new(client);
    let create = kernel
        .apply(KernelOp::Flow {
            request: Request::FlowCreate {
                project: "KernelEditor".into(),
                actor: "human:test".into(),
                actor_kind: "human".into(),
                local_stamp: Some("2026-09-08-1300".into()),
                path: Some("ProjectCentral/now/flows/kernel.md".into()),
                title: Some("Kernel Flow".into()),
                agent_session_ref: None,
            },
        })
        .unwrap();
    let KernelOpResult::Flow {
        response: Response::FlowCreated { reading },
    } = create.result
    else {
        panic!("typed FlowCreate response expected")
    };
    assert!(!reading.automatic_agent_or_model_invocation);
    let flow = reading.flow;
    let flow_ref = flow.flow_ref.clone();
    let source_ref = flow.source_ref.clone();
    let revision0 = flow.current_revision.clone();
    assert_eq!(flow.scope_ref, "project:kernel-flow-return");

    let read_wire = serde_json::to_value(KernelOp::Flow {
        request: Request::FlowRead {
            project: "KernelEditor".into(),
            flow_ref: flow_ref.clone(),
            expected_revision: Some(revision0.clone()),
        },
    })
    .unwrap();
    assert_eq!(read_wire["op"], "flow");
    assert_eq!(read_wire["request"]["action"], "flow_read");
    assert_eq!(read_wire["request"]["flow_ref"], flow_ref);
    assert_eq!(read_wire["request"]["expected_revision"], revision0);

    let read = kernel
        .apply(KernelOp::Flow {
            request: Request::FlowRead {
                project: "KernelEditor".into(),
                flow_ref: flow_ref.clone(),
                expected_revision: Some(revision0.clone()),
            },
        })
        .unwrap();
    let KernelOpResult::Flow {
        response: Response::FlowRead { reading },
    } = read.result
    else {
        panic!("typed FlowRead response expected")
    };
    assert_eq!(reading.flow.source_ref, source_ref);
    assert_eq!(reading.flow.current_revision, revision0);
    assert_eq!(reading.content, "");

    let write = kernel
        .apply(KernelOp::Flow {
            request: Request::FlowWrite {
                project: "KernelEditor".into(),
                flow_ref: flow_ref.clone(),
                expected_revision: reading.flow.current_revision.clone(),
                content: "kernel owner revision\n".into(),
                actor: "agent:kernel-test".into(),
                actor_kind: "agent".into(),
                agent_session_ref: Some("session:kernel-test".into()),
            },
        })
        .unwrap();
    let KernelOpResult::Flow {
        response: Response::FlowWritten { reading },
    } = write.result
    else {
        panic!("typed FlowWrite response expected")
    };
    let revision1 = reading.flow.current_revision.clone();
    assert_ne!(revision1, revision0);
    assert_eq!(reading.flow.revisions.last().unwrap().agent_session_ref.as_deref(), Some("session:kernel-test"));

    let conflict = kernel
        .apply(KernelOp::Flow {
            request: Request::FlowWrite {
                project: "KernelEditor".into(),
                flow_ref: flow_ref.clone(),
                expected_revision: revision0.clone(),
                content: "must not overwrite\n".into(),
                actor: "agent:kernel-test".into(),
                actor_kind: "agent".into(),
                agent_session_ref: Some("session:kernel-test".into()),
            },
        })
        .unwrap();
    let KernelOpResult::Flow {
        response: Response::Failure { action, error },
    } = conflict.result
    else {
        panic!("stale FlowWrite must remain a typed owner refusal")
    };
    assert_eq!(action, "projectcentral.flow.write");
    assert!(matches!(error, OwnerCallError::Refused { .. }));

    let proposal = kernel
        .apply(KernelOp::Flow {
            request: Request::SourceReturn {
                project: "KernelEditor".into(),
                source_ref: source_ref.clone(),
                expected_revision: revision1.clone(),
                proposed_content: "returned through kernel\n".into(),
                reason: "kernel return proof".into(),
                evidence_refs: vec!["evidence:kernel-flow".into()],
                agent_session_ref: "session:kernel-return".into(),
            },
        })
        .unwrap();
    let KernelOpResult::Flow {
        response: Response::SourceReturnCreated { reading },
    } = proposal.result
    else {
        panic!("typed SourceReturn response expected")
    };
    let return_ref = reading.proposal.return_ref.clone();
    assert!(reading.acceptance.available);
    assert_eq!(reading.proposal.source_ref, source_ref);
    assert_eq!(reading.proposal.basis_revision, revision1);
    assert_eq!(reading.proposal.agent_session_ref, "session:kernel-return");
    assert_eq!(reading.proposal.evidence_refs, vec!["evidence:kernel-flow"]);
    assert!(!reading.authored_source_mutated);

    let accepted = kernel
        .apply(KernelOp::Flow {
            request: Request::SourceReturnAccept {
                project: "KernelEditor".into(),
                return_ref,
                expected_revision: revision1,
                acceptance: "human-accepted".into(),
                accepted_by_ref: "human:test".into(),
            },
        })
        .unwrap();
    let KernelOpResult::Flow {
        response: Response::SourceReturnAccepted { mutation },
    } = accepted.result
    else {
        panic!("typed SourceReturnAccept response expected")
    };
    assert_eq!(mutation.outcome, "accepted");
    assert!(mutation.authored_source_mutated);
    let receipt = mutation.receipt.expect("native return receipt");
    assert_eq!(receipt["owner_operation"], "projectcentral.flow.write");
    assert_eq!(receipt["flow"]["flow_ref"], flow_ref);

    fs::remove_dir_all(root).unwrap();
}
