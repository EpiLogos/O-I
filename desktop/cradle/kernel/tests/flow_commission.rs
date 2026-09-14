//! The selection commission route over the ratified flow-instance carrier
//! (O-I #271) through the exact candidate O:I executable and pinned Central
//! executable. Isolated temp Central grounds only — the live ground never
//! moves.
//!
//! The adapter law under test: a selection made inside a flow instance
//! commissions work — the desktop composes the next instance through the
//! template's own append-entry contract and the op carries it verbatim with
//! the instance location and the expected revision; the commission lands as
//! an owner revision through Central's `central.files.write`
//! compare-and-swap. A stale expected revision is the owner's own structured
//! conflict with both revisions observed, never a silent overwrite. An
//! AgentSession binds as the write's actor. The kernel records nothing and
//! emits nothing — the commission is an owner write; the receipts live in
//! Central's file history.
use oi_cradle_kernel::commission::CommissionOutcome;
use oi_cradle_kernel::files::Location;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

/// Owner-executable environment is process-global; the commission tests own
/// it under one lock so each test still gets its own isolated grounds.
static ENV_LOCK: Mutex<()> = Mutex::new(());

/// The composed next instance, verbatim: the caller's composition (the
/// template's append-entry contract lives in `src/flow/instance.ts`; the
/// kernel composes nothing, so the test composes the bytes itself).
const COMPOSED_INSTANCE: &str =
    "<html><script type=\"application/json\" id=\"ql-doc\">{\"revision\":2}</script></html>\n";

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
    // Central's path-ref grammar carries the canonical root; the macOS temp
    // directory is reached through a symlink.
    fs::canonicalize(&root).unwrap()
}

struct Fixture {
    _env: MutexGuard<'static, ()>,
    root: PathBuf,
    instance: Location,
    revision0: String,
}

impl Fixture {
    /// One isolated Central ground with one flow instance at its initial
    /// revision, minted through the owner's own creation door, with exact
    /// bindings exported for every owner child process.
    fn new(tag: &str) -> Self {
        let env = ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let root = temporary_root(tag);
        std::env::set_var("OI_BIN", candidate("oi"));
        std::env::set_var("OI_CENTRAL_CTRL_BIN", candidate("ctrl"));

        let client = self::client(&root);
        client.run("central.init", json!({})).unwrap();
        let location = Location {
            schema: "central.path-ref/v1".into(),
            ref_id: format!(
                "central:path:{}:Control/user/flows/flow-2026-09-13-1200.html",
                root.display()
            ),
            root: root.to_string_lossy().into_owned(),
            path: "Control/user/flows/flow-2026-09-13-1200.html".into(),
        };
        let created = client
            .run(
                "central.files.write",
                json!({
                    "location": location,
                    "expected_revision": "",
                    "content": "<html><script type=\"application/json\" id=\"ql-doc\">{\"revision\":1}</script></html>\n",
                    "actor": "human:desktop",
                    "actor_kind": "human",
                }),
            )
            .unwrap();
        assert_eq!(created["outcome"], "created", "{created}");
        Self {
            _env: env,
            root,
            instance: location,
            revision0: created["revision"].as_str().unwrap().to_owned(),
        }
    }

    fn client(&self) -> CentralClient {
        self::client(&self.root)
    }

    fn commission(
        &self,
        expected_revision: &str,
        content: &str,
        agent_session_ref: Option<&str>,
    ) -> CommissionOutcome {
        let mut kernel = Kernel::new(self.client());
        let outcome = kernel
            .apply(KernelOp::InstanceCommission {
                location: self.instance.clone(),
                expected_revision: expected_revision.into(),
                content: content.into(),
                agent_session_ref: agent_session_ref.map(str::to_owned),
            })
            .unwrap();
        assert!(
            outcome.receipts.is_empty(),
            "the commission is an owner write through the owner CAS: no kernel receipts"
        );
        let KernelOpResult::InstanceCommissioned { outcome } = outcome.result else {
            panic!("typed InstanceCommissioned result expected")
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
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn commission_lands_as_owner_revision_carrying_the_composition_verbatim() {
    let fixture = Fixture::new("commission-verbatim");

    let outcome = fixture.commission(&fixture.revision0.clone(), COMPOSED_INSTANCE, None);
    let CommissionOutcome::Commissioned {
        path,
        previous_revision,
        revision,
        agent_session_ref,
    } = &outcome
    else {
        panic!("a fresh commission must land as an owner revision, got {outcome:?}")
    };
    assert_eq!(path, &fixture.instance.path);
    assert_eq!(previous_revision, &fixture.revision0);
    assert_ne!(
        revision, &fixture.revision0,
        "the owner CAS minted the next revision"
    );
    assert_eq!(agent_session_ref, &None);

    // The composed instance is the write content, carried verbatim: the
    // owner's own read proves it — the kernel composed nothing.
    let read = fixture
        .client()
        .run(
            "central.files.read",
            json!({"location": fixture.instance}),
        )
        .unwrap();
    assert_eq!(read["content"], COMPOSED_INSTANCE);
    assert_eq!(read["revision"], *revision);

    // A further commission against the new revision keeps the loop going.
    let next_instance = "<html><script type=\"application/json\" id=\"ql-doc\">{\"revision\":3}</script></html>\n";
    let follow_up = fixture.commission(revision, next_instance, None);
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
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn stale_expected_revision_is_the_owner_structured_conflict() {
    let fixture = Fixture::new("commission-conflict");

    // Move the instance underneath the commission.
    let moved = fixture
        .client()
        .run(
            "central.files.write",
            json!({
                "location": fixture.instance,
                "expected_revision": fixture.revision0,
                "content": "<html><script type=\"application/json\" id=\"ql-doc\">{\"revision\":9,\"external\":true}</script></html>\n",
                "actor": "human:desktop",
                "actor_kind": "human",
            }),
        )
        .unwrap();
    assert_eq!(moved["outcome"], "written");

    let outcome = fixture.commission(&fixture.revision0.clone(), COMPOSED_INSTANCE, None);
    let CommissionOutcome::Conflict {
        path,
        expected,
        current,
    } = &outcome
    else {
        panic!("a stale commission must be the owner's structured conflict, got {outcome:?}")
    };
    assert_eq!(path, &fixture.instance.path);
    assert_eq!(expected, &fixture.revision0);
    assert_ne!(current, expected, "both revisions observed, verbatim");

    // The owner preserved the concurrent bytes; nothing was overwritten.
    let read = fixture
        .client()
        .run(
            "central.files.read",
            json!({"location": fixture.instance}),
        )
        .unwrap();
    assert!(read["content"]
        .as_str()
        .unwrap()
        .contains("\"external\":true"));

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn agent_session_binds_as_the_write_actor() {
    let fixture = Fixture::new("commission-session");

    let outcome = fixture.commission(
        &fixture.revision0.clone(),
        COMPOSED_INSTANCE,
        Some("session:w4d-commission-1"),
    );
    let CommissionOutcome::Commissioned {
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

    // Central's attribution law recorded the session on the owner revision;
    // the file history is the receipt (the retired registry kept none).
    let history = fixture
        .client()
        .run(
            "central.files.history",
            json!({"location": fixture.instance, "limit": 1}),
        )
        .unwrap();
    assert_eq!(history["schema"], "central.file-history/v1");
    assert_eq!(
        history["entries"][0]["actor"],
        "session:w4d-commission-1",
        "{history}"
    );
    assert_eq!(history["entries"][0]["actor_kind"], "agent");
    assert_eq!(history["entries"][0]["revision"], *revision);

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN frozen native candidates"]
fn commission_requires_expected_revision_and_content() {
    let fixture = Fixture::new("commission-input");

    let mut kernel = Kernel::new(fixture.client());
    for op in [
        KernelOp::InstanceCommission {
            location: fixture.instance.clone(),
            expected_revision: String::new(),
            content: COMPOSED_INSTANCE.into(),
            agent_session_ref: None,
        },
        KernelOp::InstanceCommission {
            location: fixture.instance.clone(),
            expected_revision: fixture.revision0.clone(),
            content: String::new(),
            agent_session_ref: None,
        },
    ] {
        let error = kernel.apply(op).unwrap_err();
        assert!(
            error.to_string().contains("requires"),
            "the input law refuses before any owner call: {error}"
        );
    }

    let _ = fs::remove_dir_all(&fixture.root);
}
