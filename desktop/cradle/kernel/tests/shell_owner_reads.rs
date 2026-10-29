//! Lane K1: three owner reads the shell's devices wait on, through the
//! actual kernel dispatcher against fake owner executables that record what
//! they were asked (the inhabitation_reads.rs form):
//!   - `seat_status_read` runs the seat instrument read only (`seat status
//!     --json`) and carries `central.workcell-status/v1` verbatim;
//!   - `source_returns_read` runs Central's `projectcentral.source.returns`
//!     for the named project, else the configured project query;
//!   - `gateway_remotes_read` runs AIKit's `gateway remote list --json`, the
//!     envelope's reading and its warnings carried, the suite route prefixed.
//!
//! Each is a prepared owner read (`owner-read`): while its owner answers, the
//! kernel lock is free — an ordered op is answered at once. A refusal comes
//! back in the owner's words, another schema is named, a missing owner is
//! unavailable — never a reading.
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::dispatch::dispatch;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpOutcome, KernelOpResult};
use serde_json::{json, Value};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

fn scratch(test: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("oi-k1-{}-{test}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

/// A fake owner: records each argv (one line, space-joined) to `argv.txt`
/// and the Central root it was handed (`CENTRAL_ROOT`) to `central-root.txt`,
/// waits while `gate` exists, then answers per `mode` (a file beside it, so
/// parallel tests never share an environment variable): `ok` cats
/// `answer.json`; `refuse` cats `refuse.json` to stdout and `refuse.txt` to
/// stderr, exit 2; `wrong` cats `wrong.json`; `garbage` prints no JSON.
fn fake_owner(dir: &Path, name: &str) -> PathBuf {
    let path = dir.join(name);
    let d = dir.display();
    fs::write(dir.join("mode"), "ok").unwrap();
    fs::write(
        &path,
        format!(
            "#!/bin/sh\n\
             printf '%s\\n' \"$*\" >> \"{d}/argv.txt\"\n\
             printf '%s' \"$CENTRAL_ROOT\" > \"{d}/central-root.txt\"\n\
             while [ -e \"{d}/gate\" ]; do sleep 0.02; done\n\
             case \"$(cat \"{d}/mode\")\" in\n\
             refuse) cat \"{d}/refuse.json\" 2>/dev/null; cat \"{d}/refuse.txt\" >&2 2>/dev/null; exit 2 ;;\n\
             wrong) cat \"{d}/wrong.json\" ;;\n\
             garbage) echo 'not json' ;;\n\
             *) cat \"{d}/answer.json\" ;;\n\
             esac\n"
        ),
    )
    .unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
    stub::settle_stub(&path);
    path
}

fn set(dir: &Path, file: &str, value: &Value) {
    fs::write(dir.join(file), serde_json::to_vec(value).unwrap()).unwrap();
}

fn mode(dir: &Path, mode: &str) {
    fs::write(dir.join("mode"), mode).unwrap();
}

fn asked(dir: &Path) -> Vec<String> {
    fs::read_to_string(dir.join("argv.txt"))
        .unwrap_or_default()
        .lines()
        .map(str::to_owned)
        .collect()
}

fn error_kind(error: &str) -> String {
    serde_json::from_str::<Value>(error)
        .ok()
        .and_then(|v| v["kind"].as_str().map(str::to_owned))
        .unwrap_or_default()
}

fn no_central(dir: &Path) -> Kernel {
    Kernel::new(CentralClient::with(
        dir.join("absent-central"),
        None,
        "o-i".into(),
    ))
}

/// The W3 law for one read: while its owner is held, the kernel lock is free
/// (an ordered op waits on nothing), and the read answers through the
/// prepared form, holding the lock only to prepare.
fn answers_outside_the_lock(
    dir: &Path,
    kernel: Kernel,
    op: KernelOp,
) -> Result<KernelOpOutcome, String> {
    let kernel = Arc::new(Mutex::new(kernel));
    let _ = fs::remove_file(dir.join("argv.txt"));
    fs::write(dir.join("gate"), "").unwrap();
    let reading = {
        let kernel = Arc::clone(&kernel);
        std::thread::spawn(move || dispatch(&kernel, op))
    };
    let deadline = Instant::now() + Duration::from_secs(20);
    while asked(dir).is_empty() {
        assert!(Instant::now() < deadline, "the owner was never asked");
        std::thread::sleep(Duration::from_millis(10));
    }
    let started = Instant::now();
    let (state, timing) = dispatch(&kernel, KernelOp::State);
    assert!(state.is_ok());
    assert_eq!(timing.form, "ordered");
    assert!(
        started.elapsed() < Duration::from_secs(1) && timing.lock_wait < Duration::from_secs(1),
        "an ordered op waited {:?} behind the owner read",
        timing.lock_wait
    );
    std::thread::sleep(Duration::from_millis(100));
    fs::remove_file(dir.join("gate")).unwrap();
    let (outcome, timing) = reading.join().unwrap();
    assert_eq!(timing.form, "owner-read");
    assert!(
        timing.lock_held < timing.owner,
        "held {:?}, owner {:?}",
        timing.lock_held,
        timing.owner
    );
    outcome
}

#[test]
fn seat_status_read_carries_the_seat_instruments_reading_read_only() {
    let dir = scratch("seat");
    let seat = fake_owner(&dir, "seat");
    std::env::set_var("OI_SEAT_BIN", &seat);
    // The instrument's own reading, 17 Oct 2026 (one workcell, two seats).
    let reading = json!({
        "schema": "central.workcell-status/v1",
        "recorded_at_unix_seconds": 1792230284,
        "workcells": [{
            "name": "env-1", "path": "/Users/admin/Central/worktrees/env-1",
            "disk_free_gb": 50.4, "min_free_gb": 20, "hard_free_gb": null,
            "last_tend": {"at_unix_seconds": 1792222684, "freed_mb": 0, "removed": []},
            "seats": [
                {"product": "o-i", "state": "claimed", "registered_branch": "dlw/phase1-semantics-20261013",
                 "registered_head": "cc69e19fa", "claimed_by": "claude-code:dlw-lead",
                 "now_ref": "workcellenv1oi-seat-claimed-branch-2026-10-13-2",
                 "zones": [{"actor": "claude-code:dlw-manual", "regions": ["packages/live-shell/ui/src/inhabitants/catalogue"], "since_unix_seconds": 1792078733}],
                 "admission": null, "live_branch": "dlw/build", "live_head": "bcdb99b98",
                 "tracked_changes": 6, "untracked": 7, "behind_main": 1, "ahead_main": 318},
                {"product": "point-cloud-demo", "state": "free", "registered_branch": null, "registered_head": null,
                 "claimed_by": null, "now_ref": null, "zones": [], "admission": null, "live_branch": "main",
                 "live_head": "1a2b3c4", "tracked_changes": 0, "untracked": 0, "behind_main": 0, "ahead_main": 0}
            ],
            "drift": ["o-i: register pose ('dlw/phase1-semantics-20261013', 'cc69e19fa') != live ('dlw/build', 'bcdb99b98')"]
        }]
    });
    set(&dir, "answer.json", &reading);

    let outcome =
        answers_outside_the_lock(&dir, no_central(&dir), KernelOp::SeatStatusRead).unwrap();
    assert!(outcome.receipts.is_empty(), "a read records nothing");
    let KernelOpResult::SeatStatusReading { data } = outcome.result else {
        panic!("not a seat status reading: {:?}", outcome.result)
    };
    assert_eq!(data, reading, "the instrument's reading, verbatim");
    assert_eq!(
        asked(&dir),
        ["status --json"],
        "read only: never join, release, tend or curate"
    );
    // The world's own register: the instrument is handed the Central root this process's owners read (and its watch watches,
    // `watch::Roots`), so in another world it reads that world's seats, never the computer's own user's (O-I #745, walk 739 gap 5).
    let world_root = oi_cradle_kernel::watch::Roots::resolve(None)
        .expect("a home")
        .central;
    assert_eq!(
        fs::read_to_string(dir.join("central-root.txt")).unwrap(),
        world_root.display().to_string(),
        "the seat instrument reads the world's own register"
    );
    // The wire shape the shell receives.
    let wire = serde_json::to_value(KernelOpResult::SeatStatusReading { data }).unwrap();
    assert_eq!(wire["result"], "seat_status_reading");
    assert_eq!(
        wire["data"]["workcells"][0]["seats"][0]["claimed_by"],
        "claude-code:dlw-lead"
    );

    let apply = || no_central(&dir).apply(KernelOp::SeatStatusRead);
    // The instrument's refusal, in its words (stderr, its usage help dropped).
    fs::write(
        dir.join("refuse.txt"),
        "seat: the register transaction is held by another instrument\n\nusage: seat ...",
    )
    .unwrap();
    mode(&dir, "refuse");
    let error = apply().expect_err("the instrument refused");
    assert_eq!(error_kind(&error), "owner-refused-or-failed");
    assert!(
        error.contains("seat: the register transaction is held by another instrument")
            && !error.contains("usage"),
        "{error}"
    );
    // Another document is named, never carried.
    set(
        &dir,
        "wrong.json",
        &json!({"schema": "central.workcell-register/v1"}),
    );
    mode(&dir, "wrong");
    let error = apply().expect_err("another schema");
    assert_eq!(error_kind(&error), "incompatible");
    assert!(error.contains("central.workcell-register/v1"), "{error}");
    mode(&dir, "garbage");
    assert_eq!(error_kind(&apply().unwrap_err()), "incompatible");
    // No instrument at all.
    std::env::set_var("OI_SEAT_BIN", dir.join("no-seat"));
    assert_eq!(error_kind(&apply().unwrap_err()), "unavailable");
    std::env::remove_var("OI_SEAT_BIN");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn source_returns_read_lists_centrals_returns_for_the_project_or_the_configured_one() {
    let dir = scratch("returns");
    let central = fake_owner(&dir, "ctrl");
    // Central's own listing (central.source-returns/v1; ctrl source_return.rs:311-315): a return ref is
    // `central:return:project:<project id>:<unix ns>-<pid>`, `before` a listing's `next_before` file name.
    let listing = json!({
        "schema": "central.source-returns/v1",
        "entries": [{"return_ref": "central:return:project:O-I:1792230000123456789-4242", "source_ref": "central:source:project:project:o-i:ProjectCentral/docs/1-vision/dlw/DLW.md",
                     "basis_revision": "sha256:aa", "status": "pending", "agent_session_ref": "agent-session/x",
                     "current_revision": "sha256:aa"}],
        "more": false, "next_before": null, "authored_source_mutated": false
    });
    set(
        &dir,
        "answer.json",
        &json!({"ok": true, "status": "success", "action": "projectcentral.source.returns", "data": listing}),
    );
    let kernel = || Kernel::new(CentralClient::with(central.clone(), None, "o-i".into()));

    let outcome = answers_outside_the_lock(
        &dir,
        kernel(),
        KernelOp::SourceReturnsRead {
            project: Some("Archetypal-Earth".into()),
            limit: Some(50),
            before: Some("return-1792239999000000000-1.json".into()),
        },
    )
    .unwrap();
    let KernelOpResult::SourceReturnsReading { data } = &outcome.result else {
        panic!("not a source returns reading: {:?}", outcome.result)
    };
    assert_eq!(serde_json::to_value(data).unwrap(), listing);
    assert_eq!(data.entries[0].status, "pending");
    let argv = asked(&dir);
    assert_eq!(argv.len(), 1);
    assert!(
        argv[0].starts_with("--json action run projectcentral.source.returns "),
        "{argv:?}"
    );
    let input: Value = serde_json::from_str(
        argv[0].trim_start_matches("--json action run projectcentral.source.returns "),
    )
    .unwrap();
    assert_eq!(
        input,
        json!({"project": "Archetypal-Earth", "limit": 50, "before": "return-1792239999000000000-1.json"}),
        "the owner's own pagination, passed through"
    );

    // No project: the configured project query (Central requires one).
    let _ = fs::remove_file(dir.join("argv.txt"));
    let op: KernelOp = serde_json::from_value(json!({"op": "source_returns_read"})).unwrap();
    kernel().apply(op).unwrap();
    let input: Value = serde_json::from_str(
        asked(&dir)[0].trim_start_matches("--json action run projectcentral.source.returns "),
    )
    .unwrap();
    assert_eq!(input["project"], "o-i");

    // Central's refusal, in its words (its real answer for an unknown project).
    set(
        &dir,
        "refuse.json",
        &json!({"ok": false, "status": "invalid_input", "action": "projectcentral.source.returns",
                "error": {"code": "invalid_input", "message": "No such file or directory (os error 2)"}}),
    );
    mode(&dir, "refuse");
    let error = kernel()
        .apply(KernelOp::SourceReturnsRead {
            project: Some("NoSuch".into()),
            limit: None,
            before: None,
        })
        .expect_err("Central refused");
    assert_eq!(
        error,
        "Central owner Action refused: No such file or directory (os error 2)"
    );
    // Another schema is named.
    set(
        &dir,
        "wrong.json",
        &json!({"ok": true, "status": "success", "data": {"schema": "central.source-returns/v9",
                "entries": [], "more": false, "authored_source_mutated": false}}),
    );
    mode(&dir, "wrong");
    let error = kernel()
        .apply(KernelOp::SourceReturnsRead {
            project: None,
            limit: None,
            before: None,
        })
        .unwrap_err();
    assert!(error.contains("central.source-returns/v9"), "{error}");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn gateway_remotes_read_carries_aikits_declared_remotes_and_warnings() {
    let dir = scratch("remotes");
    let aikit = fake_owner(&dir, "aikit");
    std::env::set_var("OI_AIKIT_BIN", &aikit);
    // AIKit's own answer, 17 Oct 2026.
    let reading = json!({"schema": "aikit.gateway-remotes/v1", "remotes": [{
        "token_location": "file:/Users/admin/.aikit/credentials/remote-workcell-omarchy.token",
        "websocket_bind": "100.92.62.101:7788", "websocket_path": "/", "workcell_ref": "workcell:omarchy"}]});
    set(
        &dir,
        "answer.json",
        &json!({"context": {"context_id": null, "project_root": null, "session_id": null},
                "data": reading, "ok": true, "schema": 1,
                "warnings": [{"message": "a declared remote was not asked"}]}),
    );

    let outcome =
        answers_outside_the_lock(&dir, no_central(&dir), KernelOp::GatewayRemotesRead).unwrap();
    let KernelOpResult::GatewayRemotesReading { data, warnings } = &outcome.result else {
        panic!("not a gateway remotes reading: {:?}", outcome.result)
    };
    assert_eq!(*data, reading, "the envelope's reading, verbatim");
    assert_eq!(
        warnings.len(),
        1,
        "the envelope's warnings travel beside it"
    );
    assert_eq!(asked(&dir), ["gateway remote list --json"]);
    let wire = serde_json::to_value(&outcome.result).unwrap();
    assert_eq!(wire["result"], "gateway_remotes_reading");

    let apply = || no_central(&dir).apply(KernelOp::GatewayRemotesRead);
    // The suite route prefixes the product namespace.
    std::env::remove_var("OI_AIKIT_BIN");
    std::env::set_var("OI_BIN", &aikit);
    let _ = fs::remove_file(dir.join("argv.txt"));
    apply().unwrap();
    assert_eq!(asked(&dir), ["aikit gateway remote list --json"]);
    std::env::remove_var("OI_BIN");
    std::env::set_var("OI_AIKIT_BIN", &aikit);
    // AIKit's refusal, in its words, whatever its exit.
    set(
        &dir,
        "refuse.json",
        &json!({"error": {"code": "cli.usage", "details": {}, "message": "this verb names no gateway carrier, so nothing was routed"}, "ok": false, "schema": 1}),
    );
    mode(&dir, "refuse");
    let error = apply().expect_err("AIKit refused");
    assert_eq!(error_kind(&error), "owner-refused-or-failed");
    assert!(
        error.contains("this verb names no gateway carrier, so nothing was routed"),
        "{error}"
    );
    set(
        &dir,
        "wrong.json",
        &json!({"ok": true, "schema": 1, "data": {"schema": "aikit.population-reading/v1"}, "warnings": []}),
    );
    mode(&dir, "wrong");
    let error = apply().unwrap_err();
    assert_eq!(error_kind(&error), "incompatible");
    assert!(error.contains("aikit.population-reading/v1"), "{error}");
    std::env::set_var("OI_AIKIT_BIN", dir.join("no-aikit"));
    assert_eq!(error_kind(&apply().unwrap_err()), "unavailable");
    std::env::remove_var("OI_AIKIT_BIN");
    let _ = fs::remove_dir_all(&dir);
}
