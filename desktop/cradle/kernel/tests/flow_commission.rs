//! W4-D Flow selection commission route (U4.1/U4.2 loop mode) through the
//! exact candidate O:I executable and pinned Central executable. Isolated
//! temp Central grounds only — the live ground never moves.
//!
//! The adapter law under test: a selection made inside a Flow commissions
//! work — the op carries the selection verbatim, the stable Central FlowRef
//! and the expected revision the selection was made against; the commission
//! lands as an owner revision through Central's `projectcentral.flow.write`
//! compare-and-swap. A stale expected revision is a structured conflict with
//! both revisions observed, never a silent overwrite. An AgentSession binds
//! without owning the Flow's identity. The kernel records nothing and emits
//! nothing — the commission is an owner write; the receipts live in Central's
//! Flow registry.
use oi_cradle_kernel::commission::CommissionOutcome;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

/// Owner-executable environment is process-global; the commission tests own
/// it under one lock so each test still gets its own isolated grounds.
static ENV_LOCK: Mutex<()> = Mutex::new(());

const SELECTION: &str = "line one commissions work\nline two rides verbatim\n";

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

fn temporary_root(tag: &str) -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "oi-flow-commission-{tag}-{stamp}-{pid}",
        pid = std::process::id()
    ));
    fs::create_dir(&root).unwrap();
    root
}

struct Fixture {
    _env: MutexGuard<'static, ()>,
    root: PathBuf,
    flow_ref: String,
    revision0: String,
}

impl Fixture {
    /// One isolated Central ground with one retained Flow at its initial
    /// revision, exact bindings exported for every owner child process.
    fn new(tag: &str) -> Self {
        let env = ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let root = temporary_root(tag);
        std::env::set_var("OI_BIN", candidate("oi"));
        std::env::set_var("OI_CENTRAL_CTRL_BIN", candidate("ctrl"));

        let client = self::client(&root);
        client.run("central.init", json!({})).unwrap();
        fs::create_dir(root.join("Work/W4DCommission")).unwrap();
        client
            .run(
                "projectcentral.init",
                json!({"project": "W4DCommission", "project_id": "w4d-commission"}),
            )
            .unwrap();
        let created = client
            .flow_create(
                Some("W4DCommission"),
                "human:w4d-test",
                "human",
                Some("2026-09-09-1200"),
                None,
                Some("W4D Commission Flow"),
                None,
            )
            .unwrap();
        assert!(created
            .flow_ref
            .starts_with("central:flow:project:w4d-commission:"));
        Self {
            _env: env,
            root,
            flow_ref: created.flow_ref,
            revision0: created.current_revision,
        }
    }

    fn client(&self) -> CentralClient {
        self::client(&self.root)
    }

    fn commission(
        &self,
        expected_revision: &str,
        selection: &str,
        agent_session_ref: Option<&str>,
    ) -> CommissionOutcome {
        let mut kernel = Kernel::new(self.client());
        let outcome = kernel
            .apply(KernelOp::FlowCommission {
                project: Some("W4DCommission".into()),
                flow_ref: self.flow_ref.clone(),
                expected_revision: expected_revision.into(),
                selection: selection.into(),
                agent_session_ref: agent_session_ref.map(str::to_owned),
            })
            .unwrap();
        assert!(
            outcome.receipts.is_empty(),
            "the commission is an owner write through the owner CAS: no kernel receipts"
        );
        let KernelOpResult::FlowCommissioned { outcome } = outcome.result else {
            panic!("typed FlowCommissioned result expected")
        };
        outcome
    }
}

fn client(root: &Path) -> CentralClient {
    CentralClient::with_suite_owner(
        candidate("oi"),
        candidate("ctrl"),
        Some(root.to_path_buf()),
        "W4DCommissionGround".into(),
    )
}

#[test]
fn commission_lands_as_owner_revision_carrying_the_selection_verbatim() {
    let fixture = Fixture::new("commission-verbatim");

    let outcome = fixture.commission(&fixture.revision0.clone(), SELECTION, None);
    let CommissionOutcome::Commissioned {
        flow,
        previous_revision,
        revision,
        agent_session_ref,
    } = &outcome
    else {
        panic!("a fresh commission must land as an owner revision, got {outcome:?}")
    };
    assert_eq!(previous_revision, &fixture.revision0);
    assert_ne!(
        revision, &fixture.revision0,
        "the owner CAS minted the next revision"
    );
    assert_eq!(flow.flow_ref, fixture.flow_ref);
    assert_eq!(agent_session_ref, &None);

    // The selection is the write content, carried verbatim: the owner's own
    // read proves it — the kernel composed nothing and wrapped no prose.
    let read = fixture
        .client()
        .flow_read(Some("W4DCommission"), &fixture.flow_ref, Some(revision))
        .unwrap();
    assert_eq!(read.content, SELECTION);
    assert_eq!(read.flow.current_revision, *revision);

    // A further commission against the new revision keeps the loop going.
    let follow_up = fixture.commission(revision, "a second selection\n", None);
    let CommissionOutcome::Commissioned {
        previous_revision,
        revision: revision2,
        ..
    } = follow_up
    else {
        panic!("the follow-up commission must land, got {follow_up:?}")
    };
    assert_eq!(previous_revision, *revision);
    assert_ne!(revision2, *revision);

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn agent_session_binds_without_owning_the_flow_identity() {
    let fixture = Fixture::new("commission-session");

    let outcome = fixture.commission(
        &fixture.revision0.clone(),
        "session-bound selection\n",
        Some("session:w4d-commission-1"),
    );
    let CommissionOutcome::Commissioned {
        flow,
        revision,
        agent_session_ref,
        ..
    } = &outcome
    else {
        panic!("a session-bound commission must land as an owner revision, got {outcome:?}")
    };
    assert_eq!(
        agent_session_ref,
        &Some("session:w4d-commission-1".to_owned())
    );

    // The Flow's identity — FlowRef, source ref, scope, lifecycle — is the
    // owner's and is untouched by the binding.
    let inspected = fixture
        .client()
        .flow_inspect(Some("W4DCommission"), &fixture.flow_ref)
        .unwrap();
    assert_eq!(inspected.flow.flow_ref, flow.flow_ref);
    assert_eq!(inspected.flow.source_ref, flow.source_ref);
    assert_eq!(inspected.flow.scope_ref, "project:w4d-commission");
    assert_eq!(inspected.flow.lifecycle, "active");

    // Central's attribution law: the write declares the session as the actor
    // (`agent`) — the owner revision receipt records it verbatim.
    let history = fixture
        .client()
        .flow_history(Some("W4DCommission"), &fixture.flow_ref)
        .unwrap();
    let last = history.revisions.last().unwrap();
    assert_eq!(last.actor, "session:w4d-commission-1");
    assert_eq!(last.actor_kind, "agent");
    assert_eq!(history.current_revision, *revision);

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn stale_expected_revision_is_a_structured_conflict_never_a_silent_overwrite() {
    let fixture = Fixture::new("commission-conflict");

    // Land one commission so the owner revision moves.
    let first = fixture.commission(&fixture.revision0.clone(), "first selection\n", None);
    let CommissionOutcome::Commissioned {
        revision: revision1,
        ..
    } = &first
    else {
        panic!("the first commission must land, got {first:?}")
    };

    // The same selection made against the stale base refuses: the owner CAS
    // names both revisions and the kernel classifies the move structurally —
    // the selection is returned unapplied.
    let conflict = fixture.commission(&fixture.revision0.clone(), "conflicting selection\n", None);
    let CommissionOutcome::Conflict {
        flow_ref,
        expected,
        current,
    } = &conflict
    else {
        panic!("a stale expected revision must be a structured conflict, got {conflict:?}")
    };
    assert_eq!(flow_ref, &fixture.flow_ref);
    assert_eq!(expected, &fixture.revision0);
    assert_eq!(current, revision1);

    // The owner layer is untouched by the refused commission.
    let read = fixture
        .client()
        .flow_read(Some("W4DCommission"), &fixture.flow_ref, None)
        .unwrap();
    assert_eq!(read.flow.current_revision, *revision1);
    assert_eq!(read.content, "first selection\n");

    // A commission against an unknown-but-well-formed revision is still a
    // structured conflict only when the owner record moved; otherwise the
    // owner's own refusal rides verbatim.
    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn owner_refusal_and_unavailable_pass_through_verbatim() {
    let fixture = Fixture::new("commission-owner-failures");

    // A grammar-valid FlowRef the owner does not hold: the write refuses and
    // the re-read finds no moved revision — the owner's own words ride.
    let mut kernel = Kernel::new(fixture.client());
    let unknown_ref = "central:flow:project:w4d-commission:9999999999999999999";
    let outcome = kernel
        .apply(KernelOp::FlowCommission {
            project: Some("W4DCommission".into()),
            flow_ref: unknown_ref.into(),
            expected_revision: fixture.revision0.clone(),
            selection: "a selection\n".into(),
            agent_session_ref: None,
        })
        .unwrap();
    let KernelOpResult::FlowCommissioned { outcome } = outcome.result else {
        panic!("typed FlowCommissioned result expected")
    };
    let CommissionOutcome::OwnerRefused { flow_ref, message } = &outcome else {
        panic!("an unknown Flow must carry the owner's refusal, got {outcome:?}")
    };
    assert_eq!(flow_ref, unknown_ref);
    assert!(
        !message.is_empty(),
        "the owner refusal carries the owner's own message verbatim"
    );

    // A FlowRef outside Central's canonical grammar is a structural error —
    // the kernel mints no FlowRef.
    let error = kernel
        .apply(KernelOp::FlowCommission {
            project: Some("W4DCommission".into()),
            flow_ref: "not-a-central-flow-ref".into(),
            expected_revision: fixture.revision0.clone(),
            selection: "a selection\n".into(),
            agent_session_ref: None,
        })
        .unwrap_err();
    assert!(
        error.contains("canonical Flow grammar"),
        "the structural error names the grammar law: {error}"
    );

    // An empty selection is equally structural.
    let error = kernel
        .apply(KernelOp::FlowCommission {
            project: Some("W4DCommission".into()),
            flow_ref: fixture.flow_ref.clone(),
            expected_revision: fixture.revision0.clone(),
            selection: String::new(),
            agent_session_ref: None,
        })
        .unwrap_err();
    assert!(
        error.contains("selection text"),
        "the structural error names the verbatim-selection law: {error}"
    );

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
fn owner_unavailable_is_explicit_absence_not_an_error() {
    let fixture = Fixture::new("commission-unavailable");

    // The owner executable could not be launched: honest absence, named —
    // never a fabricated commission, never a faked conflict.
    let bogus = fixture.root.join("no-such-suite-executable");
    let client = CentralClient::with_suite_owner(
        bogus,
        candidate("ctrl"),
        Some(fixture.root.clone()),
        "W4DCommissionGround".into(),
    );
    let mut kernel = Kernel::new(client);
    let outcome = kernel
        .apply(KernelOp::FlowCommission {
            project: Some("W4DCommission".into()),
            flow_ref: fixture.flow_ref.clone(),
            expected_revision: fixture.revision0.clone(),
            selection: "a selection\n".into(),
            agent_session_ref: None,
        })
        .unwrap();
    let KernelOpResult::FlowCommissioned { outcome } = outcome.result else {
        panic!("typed FlowCommissioned result expected")
    };
    let CommissionOutcome::OwnerUnavailable { flow_ref, detail } = &outcome else {
        panic!("an absent owner must be explicit unavailability, got {outcome:?}")
    };
    assert_eq!(flow_ref, &fixture.flow_ref);
    assert!(
        !detail.is_empty(),
        "the owner unavailability carries the launch detail verbatim"
    );

    let _ = fs::remove_dir_all(&fixture.root);
}
