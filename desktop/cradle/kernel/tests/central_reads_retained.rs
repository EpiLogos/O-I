//! Central readings are retained while the change watch sees no change in
//! what they depend on (read_cache.rs `ReadModel`, flow.rs `run_envelope`),
//! against a fake Central owner that counts the processes it is started as:
//!   - a second ask of the same reading starts no process;
//!   - a change under `Control/` ends a root reading; one under another
//!     project does not;
//!   - an owner action that is not a reading moves every reading;
//!   - concurrent identical asks share one process;
//!   - the trace carries one `[read]` line per ask: miss, hit, joined.
//!
//! This is its own process: it starts the process's change watch.
use oi_cradle_kernel::watch;
use oi_cradle_kernel::CentralClient;
use serde_json::json;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// A little longer than the default floor of a moved reading.
const FLOOR: Duration = Duration::from_millis(2300);

fn scratch() -> PathBuf {
    let dir = std::env::temp_dir().join(format!("oi-reads-retained-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    fs::canonicalize(&dir).unwrap()
}

/// A fake Central: one line per start in `argv.txt`, an envelope per action.
fn fake_central(dir: &Path) -> PathBuf {
    let path = dir.join("ctrl");
    let d = dir.display();
    fs::write(
        &path,
        format!(
            "#!/bin/sh\n\
             printf '%s\\n' \"$*\" >> \"{d}/argv.txt\"\n\
             sleep 0.2\n\
             action=''\n\
             for a in \"$@\"; do if [ \"$prev\" = run ]; then action=\"$a\"; fi; prev=\"$a\"; done\n\
             printf '{{\"ok\":true,\"status\":\"success\",\"action\":\"%s\",\"data\":{{\"schema\":\"central.now-listing/v1\",\"records\":[]}}}}' \"$action\"\n"
        ),
    )
    .unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
    // A script just written can be refused as busy until its writer closes.
    std::thread::sleep(Duration::from_millis(50));
    path
}

fn starts(dir: &Path, action: &str) -> usize {
    fs::read_to_string(dir.join("argv.txt"))
        .unwrap_or_default()
        .lines()
        .filter(|line| line.contains(&format!("run {action} ")))
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

#[test]
fn central_readings_are_retained_until_their_sources_change() {
    let dir = scratch();
    let root = dir.join("central");
    let aikit = dir.join("aikit");
    // Project changes are written under ProjectCentral, which every platform
    // watches (Linux watches no working tree).
    for sub in [
        "Control/agents",
        "Work/X/ProjectCentral",
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

    let owner = fake_central(&dir);
    let client = CentralClient::with(owner, Some(root.clone()), "x".into());
    let now_root = || client.run("central.now.list", json!({"project": null}));
    let now_x = || client.run("central.now.list", json!({"project": "x"}));

    // A second ask of the same reading starts no process.
    assert!(now_root().is_ok());
    assert!(now_root().is_ok());
    assert_eq!(starts(&dir, "central.now.list"), 1);

    // A change under another project leaves a root reading standing.
    fs::write(root.join("Work/Y/ProjectCentral/a.json"), "1").unwrap();
    wait_for("the project change to be announced", || {
        announced
            .lock()
            .unwrap()
            .iter()
            .any(|(scopes, _)| scopes.iter().any(|scope| scope == "project:Y"))
    });
    assert!(now_root().is_ok());
    assert_eq!(
        starts(&dir, "central.now.list"),
        1,
        "Work/Y is not the root's"
    );

    // A change under Control ends it.
    fs::write(root.join("Control/agents/n.json"), "{}").unwrap();
    wait_for("the root change to be announced", || {
        announced
            .lock()
            .unwrap()
            .iter()
            .any(|(scopes, _)| scopes.iter().any(|scope| scope == "root"))
    });
    // Once its floor has ended the moved reading is read again.
    std::thread::sleep(FLOOR);
    assert!(now_root().is_ok());
    assert_eq!(starts(&dir, "central.now.list"), 2);

    // Build output is noise: nothing moves.
    let before = watch::Watch::global().epoch();
    fs::create_dir_all(root.join("Work/X/target/debug")).unwrap();
    fs::write(root.join("Work/X/target/debug/out.o"), "1").unwrap();
    std::thread::sleep(Duration::from_millis(1500));
    assert_eq!(watch::Watch::global().epoch(), before);

    // A project reading depends on that project and the root.
    assert!(now_x().is_ok());
    assert!(now_x().is_ok());
    assert_eq!(starts(&dir, "central.now.list"), 3);
    fs::write(root.join("Work/X/ProjectCentral/m.json"), "1").unwrap();
    wait_for("the X change to be announced", || {
        announced
            .lock()
            .unwrap()
            .iter()
            .any(|(scopes, _)| scopes.iter().any(|scope| scope == "project:X"))
    });
    std::thread::sleep(FLOOR);
    assert!(now_x().is_ok());
    assert_eq!(starts(&dir, "central.now.list"), 4);

    // An action that is not a reading moves every reading.
    assert!(now_root().is_ok());
    let held = starts(&dir, "central.now.list");
    assert!(client
        .run("central.files.write", json!({"project": null}))
        .is_ok());
    assert!(now_root().is_ok());
    assert_eq!(starts(&dir, "central.now.list"), held + 1);

    // Concurrent identical asks share one process.
    let settled = starts(&dir, "central.time.policy");
    std::thread::scope(|scope| {
        for _ in 0..6 {
            scope.spawn(|| {
                client
                    .run("central.time.policy", json!({"project": null}))
                    .unwrap()
            });
        }
    });
    assert_eq!(starts(&dir, "central.time.policy"), settled + 1);

    // The trace says how each ask was answered.
    let traced = fs::read_to_string(&trace).unwrap_or_default();
    let reads: Vec<&str> = traced
        .lines()
        .filter(|l| l.starts_with("[read] "))
        .collect();
    let count = |how: &str| {
        reads
            .iter()
            .filter(|l| l.ends_with(&format!(" {how}")))
            .count()
    };
    assert!(count("miss") >= 5, "{reads:?}");
    assert!(count("hit") >= 3, "{reads:?}");
    assert!(count("joined") + count("hit") >= 5, "{reads:?}");
    let line = reads
        .iter()
        .find(|l| l.contains("central.now.list"))
        .unwrap();
    let mut parts = line.split(' ');
    assert_eq!(parts.next(), Some("[read]"));
    assert!(parts.next().unwrap().parse::<u128>().is_ok(), "{line}");
}
