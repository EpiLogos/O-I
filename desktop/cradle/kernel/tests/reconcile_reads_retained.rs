//! The reads a document save and a Flow read ask of Central retire nothing they did not change (O-I #756). Central classes
//! its reconciles of derived state `derived-reconciling` (`projectcentral.source.read`, `source.returns`, `source.return_read`,
//! `change.horizon`), and the kernel honours the class (action.rs `CentralClient::reads`): running one through `invoke_action`
//! withdraws no reading, so the trace (`OI_KERNEL_TRACE_FILE`) names no `written` for it. What a reconcile does change lies
//! under `.central`, and the change watch moves exactly the scope it lies in (watch.rs): the Project horizon it rewrites is
//! the sources' own cache and moves nothing; a Return's record it recovers moves its Project and no other scope. The save's
//! own `projectcentral.source.write`, and `source.transfer.resolve`, stay Central's writes and retire the read model.
//!
//! Against a fake Central that logs each action it is started for. Its own process: it names the trace file and starts the
//! process's change watch.
use oi_cradle_kernel::{dispatch, watch, CentralClient, Kernel, KernelOp};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// A little longer than the default floor of a moved reading (read_cache.rs `DEFAULT_FLOOR`).
const FLOOR: Duration = Duration::from_millis(2300);

const DOCUMENT: &str = "central:source:project:x:ProjectCentral/user/vision.html";
const FLOW: &str = "central:source:project:x:ProjectCentral/user/flows/morning.html";

fn scratch() -> PathBuf {
    let dir = std::env::temp_dir().join(format!("oi-reconcile-retained-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    fs::canonicalize(&dir).unwrap()
}

/// A fake Central: one line per start in `argv.txt`; Central's catalogue rows for the actions here, as Central classes
/// them; each reconcile writes what Central's own writes under `.central`.
fn fake_central(dir: &Path, root: &Path) -> PathBuf {
    let script = dir.join("ctrl.py");
    fs::write(
        &script,
        r#"import json, os, sys
log, root = sys.argv[1], sys.argv[2]
args = sys.argv[3:]
i = args.index("action")
action = args[i + 2]
given = json.loads(args[i + 3]) if len(args) > i + 3 else {}
with open(log, "a") as handle:
    handle.write(action + "\n")
def ok(data):
    print(json.dumps({"ok": True, "status": "success", "action": action, "data": data}))
def write(path, text):
    path = os.path.join(root, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as handle:
        handle.write(text)
if action == "action.list":
    ok({"actions": [{"id": "central.now.list", "mutation_class": "read-only"},
                    {"id": "projectcentral.change.horizon", "mutation_class": "derived-reconciling"},
                    {"id": "projectcentral.source.read", "mutation_class": "derived-reconciling"},
                    {"id": "projectcentral.source.return_read", "mutation_class": "derived-reconciling"},
                    {"id": "projectcentral.source.returns", "mutation_class": "derived-reconciling"},
                    {"id": "projectcentral.source.transfer.resolve", "mutation_class": "locally-mutating"},
                    {"id": "projectcentral.source.write", "mutation_class": "locally-mutating"}]})
elif action == "central.world":
    ok({"schema": "central.world-map/v1", "root": root, "work": {"projects": [{"name": "X", "path": "Work/X"}]}})
elif action == "central.now.list":
    ok({"schema": "central.now-listing/v1", "records": []})
elif action in ("projectcentral.source.read", "projectcentral.source.returns", "projectcentral.change.horizon"):
    # The reconcile rewrites the Project's horizon: the sources' own cache, which the watch holds as noise.
    write("Work/X/.central/source-change-horizon.json", json.dumps({"reconciled_by": action, "input": given}))
    ok({"schema": "central.project-world-source-reading/v1", "source": {"ref": given.get("source_ref")},
        "revision": {"revision": "rev-1"}, "content": "unchanged", "authored_source_mutated": False,
        "automatic_agent_or_model_invocation": False})
elif action == "projectcentral.source.return_read":
    # A Return left `applying`, recovered against its unmoved source: its record under `.central` moves.
    write("Work/X/.central/source-returns/return-1.json", json.dumps({"status": "pending"}))
    ok({"proposal": {"return_ref": given.get("return_ref"), "status": "pending"}, "authored_source_mutated": False})
elif action == "projectcentral.source.write":
    write("Work/X/ProjectCentral/user/vision.html", given.get("content", ""))
    ok({"receipt": {"schema": "central.world-source-write-receipt/v1", "changed": True}})
else:
    ok({})
"#,
    )
    .unwrap();
    let executable = dir.join("ctrl");
    fs::write(
        &executable,
        format!(
            "#!/bin/sh\nexec python3 {} {} {} \"$@\"\n",
            script.display(),
            dir.join("argv.txt").display(),
            root.display()
        ),
    )
    .unwrap();
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&executable, fs::Permissions::from_mode(0o755)).unwrap();
    // A script just written can be refused as busy until its writer closes.
    std::thread::sleep(Duration::from_millis(50));
    executable
}

fn starts(dir: &Path, action: &str) -> usize {
    fs::read_to_string(dir.join("argv.txt"))
        .unwrap_or_default()
        .lines()
        .filter(|line| *line == action)
        .count()
}

fn wait_for(what: &str, mut done: impl FnMut() -> bool) {
    let deadline = Instant::now() + Duration::from_secs(15);
    while Instant::now() < deadline {
        if done() {
            return;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    panic!("timed out waiting for {what}");
}

/// The trace's lines from `mark` (a line count) on.
fn traced_since(trace: &Path, mark: usize) -> Vec<String> {
    fs::read_to_string(trace)
        .unwrap_or_default()
        .lines()
        .skip(mark)
        .map(str::to_owned)
        .collect()
}

fn retired(lines: &[String]) -> Vec<&String> {
    lines
        .iter()
        .filter(|line| line.starts_with("[read] ") && line.ends_with(" written"))
        .collect()
}

#[test]
fn a_save_and_a_flow_read_retire_nothing_they_did_not_change() {
    let dir = scratch();
    let root = dir.join("central");
    let aikit = dir.join("aikit");
    for sub in [
        "Control/agents",
        "Work/X/ProjectCentral/user/flows",
        "Work/X/.central/source-returns",
        "Work/Y/ProjectCentral",
    ] {
        fs::create_dir_all(root.join(sub)).unwrap();
    }
    fs::create_dir_all(&aikit).unwrap();
    let trace = dir.join("trace.log");
    std::env::set_var("OI_KERNEL_TRACE_FILE", &trace);
    std::env::set_var("AIKIT_HOME", &aikit);
    let announced = Arc::new(Mutex::new(Vec::<(Vec<String>, u64)>::new()));
    let seen = Arc::clone(&announced);
    watch::start_global(Some(&root), move |scopes, epoch| {
        seen.lock().unwrap().push((scopes, epoch));
    })
    .expect("the change watch starts");
    // Let the watcher settle past what the setup itself wrote.
    std::thread::sleep(Duration::from_millis(1500));

    let owner = fake_central(&dir, &root);
    let client = CentralClient::with(owner, Some(root.clone()), "x".into());
    let kernel = Mutex::new(Kernel::new(client.clone()));
    let now_root = || client.run("central.now.list", json!({"project": null}));
    let now_x = || client.run("central.now.list", json!({"project": "X"}));
    let invoke = |action: &str, target: &str, input: Value| {
        let op: KernelOp = serde_json::from_value(json!({"op": "invoke_action",
            "invocation": {"action": action, "target_ref": target, "input": input}}))
        .unwrap();
        let (outcome, _) = dispatch::dispatch(&kernel, op);
        let outcome = serde_json::to_value(outcome.unwrap()).unwrap();
        assert_eq!(
            outcome["result"], "action_dispatched",
            "{action}: {outcome}"
        );
        assert_eq!(
            outcome["dispatch"]["state"], "invoked",
            "{action}: {outcome}"
        );
    };
    let read = |source_ref: &str| {
        invoke(
            "projectcentral.source.read",
            source_ref,
            json!({"project": "X", "source_ref": source_ref}),
        )
    };
    let lines = || {
        fs::read_to_string(&trace)
            .unwrap_or_default()
            .lines()
            .count()
    };

    // Readings kept from before: the root's and Project X's.
    assert!(now_root().is_ok());
    assert!(now_x().is_ok());
    assert_eq!(starts(&dir, "central.now.list"), 2);

    // A document save's compare-and-swap read and a Flow read, then the reconciles beside them.
    let mark = lines();
    read(DOCUMENT);
    read(FLOW);
    invoke(
        "projectcentral.change.horizon",
        "central:project:x",
        json!({"project": "X"}),
    );
    invoke(
        "projectcentral.source.returns",
        "central:project:x",
        json!({"project": "X"}),
    );
    let since = traced_since(&trace, mark);
    assert!(
        retired(&since).is_empty(),
        "a reconcile of derived state retires nothing:\n{}",
        since.join("\n")
    );
    // Every reading kept from before still stands, and the same read again is served from what was kept.
    assert!(now_root().is_ok());
    assert!(now_x().is_ok());
    assert_eq!(starts(&dir, "central.now.list"), 2, "nothing was withdrawn");
    read(DOCUMENT);
    assert_eq!(
        starts(&dir, "projectcentral.source.read"),
        2,
        "the document's reading was kept"
    );
    let since = traced_since(&trace, mark);
    assert!(
        since.iter().any(|line| line.starts_with("[read] ")
            && line.contains("central:projectcentral.source.read:")
            && line.ends_with(" hit")),
        "{}",
        since.join("\n")
    );
    // Its own cache write (the Project horizon) moved no scope: a reading of Project X is still kept past the floor.
    std::thread::sleep(FLOOR);
    assert!(now_x().is_ok());
    assert_eq!(
        starts(&dir, "central.now.list"),
        2,
        "the horizon moved nothing"
    );

    // What a reconcile does change moves only its scope: a Return's record recovered under Project X's `.central`.
    announced.lock().unwrap().clear();
    invoke(
        "projectcentral.source.return_read",
        "central:return:project:x:1",
        json!({"project": "X", "return_ref": "central:return:project:x:1"}),
    );
    // Linux watches only Control, each ProjectCentral, the git refs and worktrees (watch.rs:21): a record under `Work/X/.central`
    // is not announced there, and X's reading stands on its time-to-live. Where the whole root is watched (FSEvents), the
    // recovered record moves Project X alone and X's reading is read again.
    if cfg!(target_os = "linux") {
        std::thread::sleep(FLOOR);
        assert!(now_root().is_ok());
        assert_eq!(
            starts(&dir, "central.now.list"),
            2,
            "the root's reading stands"
        );
    } else {
        wait_for("the recovered record to be announced", || {
            announced
                .lock()
                .unwrap()
                .iter()
                .any(|(scopes, _)| scopes.iter().any(|scope| scope == "project:X"))
        });
        assert!(
            announced.lock().unwrap().iter().all(|(scopes, _)| scopes
                .iter()
                .all(|scope| scope == "project:X" || scope == "work")),
            "only Project X moved (and `work`, which counts every project): {:?}",
            announced.lock().unwrap()
        );
        std::thread::sleep(FLOOR);
        assert!(now_root().is_ok());
        assert_eq!(
            starts(&dir, "central.now.list"),
            2,
            "the root's reading stands"
        );
        assert!(now_x().is_ok());
        assert_eq!(
            starts(&dir, "central.now.list"),
            3,
            "Project X's reading is read again"
        );
    }
    let since = traced_since(&trace, mark);
    assert!(
        retired(&since).is_empty(),
        "the kernel withdrew nothing itself:\n{}",
        since.join("\n")
    );

    // The save's own write is Central's write: it retires the read model, and so does a transfer's resolution.
    for (action, input) in [
        (
            "projectcentral.source.write",
            json!({"project": "X", "source_ref": DOCUMENT, "expected_revision": "rev-1",
                   "content": "saved", "actor": "oi-desktop-user", "actor_kind": "human"}),
        ),
        (
            "projectcentral.source.transfer.resolve",
            json!({"project": "X", "source_ref": DOCUMENT, "disposition": "keep-local",
                   "actor": "oi-desktop-user", "actor_kind": "human"}),
        ),
    ] {
        assert!(now_root().is_ok());
        let held = starts(&dir, "central.now.list");
        let mark = lines();
        invoke(action, DOCUMENT, input);
        let since = traced_since(&trace, mark);
        assert!(
            retired(&since)
                .iter()
                .any(|line| line.contains("owner_write.rs")),
            "{action} retires the read model:\n{}",
            since.join("\n")
        );
        assert!(now_root().is_ok());
        assert_eq!(
            starts(&dir, "central.now.list"),
            held + 1,
            "{action}: the root's reading is read again"
        );
    }
    let _ = fs::remove_dir_all(&dir);
}
