//! Typed encounter join through the exact candidate O:I executable, pinned
//! Central executable and pinned W3-A AIKit executable (real session-lifecycle
//! operations against an isolated AIKIT_HOME). Isolated fixtures only — the
//! live ground and user stores never move.
//!
//! The join is AIKit's side alone: Actuation 0.2.1 has no request-correlation
//! operation (`actuation correlate` was removed with its JavaScript layer), so
//! the Actuation side is named unavailable with that reason on every reading,
//! never queried and never faked; the grant-record seam stays undetermined;
//! and every disposition rests on the side that was queried.
use oi_cradle_kernel::encounter::{
    EncounterDisposition, EncounterInput, GrantRecord, LifecyclePermission, ReplyAnswer,
    ACTUATION_CORRELATE_ABSENT, ACTUATION_CORRELATE_OPERATION, ENCOUNTER_SCHEMA,
};
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

/// Owner-executable environment is process-global; the encounter tests own
/// it under one lock so each test still gets its own isolated grounds.
static ENV_LOCK: Mutex<()> = Mutex::new(());

fn candidate(name: &str) -> PathBuf {
    let variable = match name {
        "oi" => "OI_BIN",
        "ctrl" => "OI_CENTRAL_CTRL_BIN",
        "aikit" => "OI_AIKIT_BIN",
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
    let root =
        std::env::temp_dir().join(format!("oi-encounter-{tag}-{stamp}-{}", std::process::id()));
    fs::create_dir(&root).unwrap();
    root
}

/// One environment variable restored on drop, so a failed assertion cannot
/// leak a bogus owner binding into the next serialized test.
struct EnvGuard {
    key: &'static str,
    original: Option<std::ffi::OsString>,
}

impl EnvGuard {
    fn set(key: &'static str, value: &Path) -> Self {
        let original = std::env::var_os(key);
        std::env::set_var(key, value);
        Self { key, original }
    }
}

impl Drop for EnvGuard {
    fn drop(&mut self) {
        match &self.original {
            Some(value) => std::env::set_var(self.key, value),
            None => std::env::remove_var(self.key),
        }
    }
}

struct Fixture {
    _env: MutexGuard<'static, ()>,
    root: PathBuf,
    aikit_home: PathBuf,
}

impl Fixture {
    /// One isolated Central ground + AIKIT_HOME, exact bindings exported for
    /// every owner child process.
    fn new(tag: &str) -> Self {
        let env = ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let root = temporary_root(tag);
        let aikit_home = root.join("aikit-home");
        fs::create_dir_all(&aikit_home).unwrap();
        std::env::set_var("OI_BIN", candidate("oi"));
        std::env::set_var("OI_CENTRAL_CTRL_BIN", candidate("ctrl"));
        std::env::set_var("OI_AIKIT_BIN", candidate("aikit"));
        std::env::set_var("AIKIT_HOME", &aikit_home);

        let client = CentralClient::with_suite_owner(
            candidate("oi"),
            candidate("ctrl"),
            Some(root.clone()),
            "EncounterGround".into(),
        );
        client.run("central.init", json!({})).unwrap();
        fs::create_dir(root.join("Work/EncProj")).unwrap();
        client
            .run(
                "projectcentral.init",
                json!({ "project": "EncProj", "project_id": "enc-proj" }),
            )
            .unwrap();
        Self {
            _env: env,
            root,
            aikit_home,
        }
    }

    fn client(&self) -> CentralClient {
        CentralClient::with_suite_owner(
            candidate("oi"),
            candidate("ctrl"),
            Some(self.root.clone()),
            "EncounterGround".into(),
        )
    }

    /// One W3-A owner operation against the isolated AIKIT_HOME; returns the
    /// owner `data` payload (envelope `ok` asserted).
    fn aikit(&self, args: &[&str]) -> Value {
        let output = Command::new(candidate("aikit"))
            .arg("-C")
            .arg(&self.root)
            .args(args)
            .arg("--json")
            .env("AIKIT_HOME", &self.aikit_home)
            .output()
            .unwrap_or_else(|error| panic!("aikit spawn failed: {error}"));
        assert!(
            output.status.success(),
            "aikit {args:?} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        let envelope: Value = serde_json::from_slice(&output.stdout)
            .unwrap_or_else(|error| panic!("aikit {args:?} returned unreadable JSON: {error}"));
        assert_eq!(
            envelope["ok"], true,
            "aikit {args:?} refused: {}",
            envelope["error"]
        );
        envelope["data"].clone()
    }

    /// Seed the canonical permission lifecycle: start → permission request
    /// (identities minted by the owner, captured verbatim) → optional grant.
    /// Returns (session, request_ref, activity, grant_event_id).
    fn seed_permission_lifecycle(
        &self,
        tag: &str,
        grant: bool,
    ) -> (String, String, String, Option<String>) {
        let session = format!("ses_w3d_{tag}");
        self.aikit(&["session", "lifecycle", "start", &session]);
        let request = self.aikit(&[
            "session",
            "lifecycle",
            "permission",
            "request",
            &session,
            "--tool",
            "encounter.test.tool",
        ]);
        let request_ref = request["permission_request"].as_str().unwrap().to_owned();
        let activity = request["activity"].as_str().unwrap().to_owned();
        let grant_event_id = if grant {
            let granted = self.aikit(&[
                "session",
                "lifecycle",
                "permission",
                "grant",
                &session,
                "--request",
                &request_ref,
            ]);
            Some(granted["event_id"].as_str().unwrap().to_owned())
        } else {
            None
        };
        (session, request_ref, activity, grant_event_id)
    }

    fn join(
        &self,
        session: &str,
        request_ref: &str,
        reply: Option<ReplyAnswer>,
    ) -> oi_cradle_kernel::encounter::EncounterReading {
        let mut kernel = Kernel::new(self.client());
        let outcome = kernel
            .apply(KernelOp::EncounterJoin {
                session: session.into(),
                request_ref: request_ref.into(),
                reply,
            })
            .unwrap();
        assert!(
            outcome.receipts.is_empty(),
            "encounter join is a pull read; it emits nothing"
        );
        let KernelOpResult::EncounterJoined { reading } = outcome.result else {
            panic!("typed EncounterJoined result expected")
        };
        reading
    }
}

/// The Actuation side as every reading names it: not read, with the reason,
/// and nothing of Actuation's carried.
fn assert_actuation_side_unread(reading: &oi_cradle_kernel::encounter::EncounterReading) {
    match &reading.inputs.actuation_correlation {
        EncounterInput::Unavailable {
            owner_operation,
            detail,
        } => {
            assert_eq!(owner_operation, ACTUATION_CORRELATE_OPERATION);
            assert_eq!(detail, ACTUATION_CORRELATE_ABSENT);
        }
        other => panic!("the Actuation side must be named unread, got {other:?}"),
    }
    assert!(reading.actuation.state.is_none() && reading.actuation.read_model.is_none());
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn joined_read_carries_request_and_activity_identities_verbatim() {
    let fixture = Fixture::new("ident");
    let (session, request_ref, activity, _grant_event_id) =
        fixture.seed_permission_lifecycle("ident", true);

    let reading = fixture.join(&session, &request_ref, None);

    // The join column, verbatim, and the owner schema stamped.
    assert_eq!(reading.schema, ENCOUNTER_SCHEMA);
    assert_eq!(reading.session, session);
    assert_eq!(reading.request_ref, request_ref);
    assert_eq!(reading.activity_ref.as_deref(), Some(activity.as_str()));

    // The W3-A lifecycle view: every event carries the verbatim identity,
    // and the permission triple sits on one stable activity id.
    assert!(matches!(
        reading.inputs.aikit_lifecycle,
        EncounterInput::Available { .. }
    ));
    assert!(matches!(
        reading.lifecycle.permission,
        LifecyclePermission::Granted { .. }
    ));
    assert_eq!(reading.lifecycle.events.len(), 2);
    for event in &reading.lifecycle.events {
        assert_eq!(
            event["permission_request"].as_str(),
            Some(request_ref.as_str())
        );
        assert_eq!(event["activity"].as_str(), Some(activity.as_str()));
    }
    assert_actuation_side_unread(&reading);
    // The queried side references the identity: the join is correlated.
    assert_eq!(reading.disposition, EncounterDisposition::Correlated);

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn the_grant_record_stays_undetermined_while_one_owner_view_is_unread() {
    let fixture = Fixture::new("seam");
    // A grant AIKit recorded, and a request still pending: neither is
    // adjudicated against an Actuation view that was never read, and no
    // agreement, disagreement or absence is claimed for it.
    for (tag, grant) in [("seamgrant", true), ("seampending", false)] {
        let (session, request_ref, _activity, _grant) =
            fixture.seed_permission_lifecycle(tag, grant);
        let reading = fixture.join(&session, &request_ref, None);
        match &reading.grant_record {
            GrantRecord::Undetermined { detail } => {
                assert_eq!(detail, "actuation correlation input unavailable")
            }
            other => panic!("the seam must stay undetermined, got {other:?}"),
        }
        assert_actuation_side_unread(&reading);
        assert_eq!(reading.disposition, EncounterDisposition::Correlated);
    }

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn provider_loss_is_an_explicit_unavailable_state_with_owner_detail() {
    let fixture = Fixture::new("loss");
    let (session, request_ref, _activity, _grant) = fixture.seed_permission_lifecycle("loss", true);
    let bogus = fixture.root.join("no-such-owner");

    // An Actuation binding changes nothing: no Actuation process is asked.
    {
        let _guard = EnvGuard::set("OI_ACTUATION_BIN", &bogus);
        let reading = fixture.join(&session, &request_ref, None);
        assert_actuation_side_unread(&reading);
        assert_eq!(reading.disposition, EncounterDisposition::Correlated);
    }

    // AIKit owner loss: absence cannot be claimed for the unqueried
    // lifecycle side, and the loss names its owner.
    {
        let _guard = EnvGuard::set("OI_AIKIT_BIN", &bogus);
        let reading = fixture.join(&session, &request_ref, None);
        match &reading.inputs.aikit_lifecycle {
            EncounterInput::Unavailable {
                owner_operation,
                detail,
            } => {
                assert_eq!(owner_operation, "aikit session lifecycle history");
                assert!(!detail.is_empty(), "owner detail carried verbatim");
            }
            other => panic!("aikit loss must be an explicit unavailable input, got {other:?}"),
        }
        match &reading.disposition {
            EncounterDisposition::Unavailable { owner, .. } => assert_eq!(owner, "ai-kit"),
            other => panic!("aikit loss must be explicit, got {other:?}"),
        }
        assert!(matches!(
            reading.grant_record,
            GrantRecord::Undetermined { .. }
        ));
    }

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn cancellation_is_terminal_and_supersedes_every_later_answer() {
    let fixture = Fixture::new("cancel");
    let (session, request_ref, _activity, _grant) =
        fixture.seed_permission_lifecycle("cancel", false);
    fixture.aikit(&[
        "session",
        "lifecycle",
        "cancel",
        &session,
        "--reason",
        "operator withdrew",
    ]);

    let reading = fixture.join(&session, &request_ref, None);
    assert_eq!(reading.lifecycle.session_state, "cancelled");
    match &reading.disposition {
        EncounterDisposition::Cancelled { reason } => {
            assert_eq!(
                reason.as_deref(),
                Some("operator withdrew"),
                "cancel reason verbatim"
            )
        }
        other => panic!("cancellation must be the terminal state, got {other:?}"),
    }

    // A proposed reply after cancellation is still Cancelled — terminal
    // outranks the stale-reply diagnosis.
    let reading = fixture.join(&session, &request_ref, Some(ReplyAnswer::Grant));
    assert!(matches!(
        reading.disposition,
        EncounterDisposition::Cancelled { .. }
    ));

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn stale_reply_is_explicit_when_the_lifecycle_already_recorded_a_disposition() {
    let fixture = Fixture::new("stale");

    // (a) The lifecycle already recorded the grant: a grant reply is stale,
    // recorded by the ai-kit owner view.
    let (session_a, request_a, _activity, _grant) =
        fixture.seed_permission_lifecycle("stalea", true);
    let reading = fixture.join(&session_a, &request_a, Some(ReplyAnswer::Grant));
    match &reading.disposition {
        EncounterDisposition::StaleReply {
            answer,
            recorded_disposition,
            recorded_by,
            recorded_at_unix_ms,
        } => {
            assert_eq!(answer, "grant");
            assert_eq!(recorded_disposition, "granted");
            assert_eq!(recorded_by, "ai-kit");
            assert!(recorded_at_unix_ms.is_some());
        }
        other => panic!("stale reply must be explicit, got {other:?}"),
    }

    // (b) The lifecycle shows the request pending: no owner view that was
    // read records a disposition, so a reply is not stale — the unread
    // Actuation side is never taken to hold one.
    let (session_b, request_b, _activity, _grant) =
        fixture.seed_permission_lifecycle("staleb", false);
    let reading = fixture.join(
        &session_b,
        &request_b,
        Some(ReplyAnswer::Refuse {
            reason: "no longer needed".into(),
        }),
    );
    assert_eq!(reading.disposition, EncounterDisposition::Correlated);

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn unknown_identity_is_explicit_when_the_queried_side_does_not_reference_it() {
    let fixture = Fixture::new("unknown");
    let (session, _request, _activity, _grant) =
        fixture.seed_permission_lifecycle("unknown", false);

    let reading = fixture.join(&session, "prq_w3d_never_recorded", None);
    assert_eq!(reading.lifecycle.permission, LifecyclePermission::NoRecord);
    assert_actuation_side_unread(&reading);
    assert_eq!(reading.disposition, EncounterDisposition::UnknownIdentity);

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn malformed_identity_refuses_before_any_owner_call() {
    let fixture = Fixture::new("malformed");
    let (session, _request, _activity, _grant) =
        fixture.seed_permission_lifecycle("malformed", false);

    let reading = fixture.join(&session, "prq_not a valid id", None);
    match &reading.disposition {
        EncounterDisposition::MalformedIdentity { detail } => {
            assert!(
                detail.contains("whitespace"),
                "detail names the defect: {detail}"
            )
        }
        other => panic!("malformed identity must be explicit, got {other:?}"),
    }
    // No owner side was queried — and none is named unavailable either: the
    // refusal comes before either side is considered.
    assert!(matches!(
        reading.inputs.aikit_lifecycle,
        EncounterInput::NotQueried { .. }
    ));
    assert!(matches!(
        reading.inputs.actuation_correlation,
        EncounterInput::NotQueried { .. }
    ));

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn owner_refusal_carries_the_owner_message_verbatim() {
    let fixture = Fixture::new("refused");
    fixture.seed_permission_lifecycle("refused", false);

    // The owner itself, asked directly, for the exact message.
    let output = Command::new(candidate("aikit"))
        .arg("-C")
        .arg(&fixture.root)
        .args([
            "session",
            "lifecycle",
            "history",
            "ses_w3d_never_started",
            "--json",
        ])
        .env("AIKIT_HOME", &fixture.aikit_home)
        .output()
        .unwrap();
    let envelope: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_ne!(envelope["ok"], true, "the owner refuses an unknown session");
    let owner_message = envelope["error"]["message"].as_str().unwrap().to_owned();
    assert!(!owner_message.is_empty());

    let reading = fixture.join("ses_w3d_never_started", "prq_w3d_whatever", None);
    match &reading.disposition {
        EncounterDisposition::Refused {
            owner,
            owner_operation,
            message,
        } => {
            assert_eq!(owner, "ai-kit");
            assert_eq!(owner_operation, "aikit session lifecycle history");
            assert_eq!(message, &owner_message, "owner message carried verbatim");
        }
        other => panic!("owner refusal must be explicit, got {other:?}"),
    }

    let _ = fs::remove_dir_all(&fixture.root);
}

#[test]
#[ignore = "requires actual OI_BIN/OI_CENTRAL_CTRL_BIN/OI_AIKIT_BIN frozen native candidates"]
fn reading_wire_shape_is_stable_and_carries_no_persistence_surface() {
    let fixture = Fixture::new("wire");
    let (session, request_ref, _activity, _grant) =
        fixture.seed_permission_lifecycle("wire", false);

    let op = serde_json::to_value(KernelOp::EncounterJoin {
        session: session.clone(),
        request_ref: request_ref.clone(),
        reply: Some(ReplyAnswer::Refuse {
            reason: "because".into(),
        }),
    })
    .unwrap();
    assert_eq!(op["op"], "encounter_join");
    assert_eq!(op["session"], session);
    assert_eq!(op["request_ref"], request_ref);
    assert_eq!(op["reply"]["answer"], "refuse");
    assert_eq!(op["reply"]["reason"], "because");

    let reading = fixture.join(&session, &request_ref, None);
    let serialized = serde_json::to_value(&reading).unwrap();
    assert_eq!(serialized["schema"], ENCOUNTER_SCHEMA);
    assert_eq!(serialized["disposition"]["state"], "correlated");
    // Named inputs are always both present on the wire.
    for name in ["aikit_lifecycle", "actuation_correlation"] {
        assert!(
            serialized["inputs"].get(name).is_some(),
            "input `{name}` is named on the wire"
        );
    }
    assert_eq!(
        serialized["inputs"]["actuation_correlation"]["state"],
        "unavailable"
    );
    // No persistence/cache surface exists on the reading.
    for forbidden in ["cache", "index", "rank", "persisted", "revision_log"] {
        assert!(
            serialized.get(forbidden).is_none(),
            "encounter reading carries no `{forbidden}`"
        );
    }

    let _ = fs::remove_dir_all(&fixture.root);
}
