use super::*;
use std::{
    process::Command,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

#[cfg(unix)]
struct Paused(u32);
#[cfg(unix)]
impl Drop for Paused {
    fn drop(&mut self) {
        let _ = Command::new("/bin/kill")
            .args(["-CONT", &self.0.to_string()])
            .status();
    }
}

/// No response stand-in: observes and briefly pauses this test's actual AIKit
/// child, then exercises the same prepare/execute/finish path as the native host.
#[cfg(unix)]
#[test]
#[ignore = "requires frozen actual OI/AIKit/Central candidates and OI_KNOWLEDGE_PROOF_DIR; isolated desktop/AIKit writes only"]
fn native_pending_relations_allow_theme_and_read_admission_rejects_stale_completions() {
    let base = PathBuf::from(
        std::env::var_os("OI_KNOWLEDGE_PROOF_DIR")
            .expect("explicit clearing-owned proof directory"),
    );
    assert!(base.is_absolute());
    assert!(base.is_dir());
    let proof = base.join(format!(
        "knowledge-concurrency-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir(&proof).unwrap();
    // Never rewrite the caller's installed desktop settings or owner cache.
    std::env::set_var("OI_HOME", proof.join("oi"));
    std::env::set_var("AIKIT_HOME", proof.join("aikit"));
    assert!(PathBuf::from(std::env::var_os("OI_BIN").expect("native OI candidate")).is_file());
    assert!(
        PathBuf::from(std::env::var_os("OI_AIKIT_BIN").expect("native AIKit candidate")).is_file()
    );
    let kernel = Arc::new(Mutex::new(Kernel::discover()));
    let address = knowledge::Address::Wiki("central:wiki:root".into());
    let relations = KernelOp::Knowledge {
        project: None,
        request: knowledge::Request::Relations {
            address: address.clone(),
        },
        fresh: true,
    };
    let prepared = kernel
        .lock()
        .unwrap()
        .prepare_knowledge(&relations)
        .unwrap()
        .unwrap();
    let worker = std::thread::spawn(move || prepared.execute());
    let started = Instant::now();
    let pid = loop {
        assert!(
            started.elapsed() < Duration::from_secs(12),
            "actual knowledge child was not observable"
        );
        let output = Command::new("/bin/ps")
            .args(["-axo", "pid=,ppid=,command="])
            .output()
            .unwrap();
        let found = String::from_utf8_lossy(&output.stdout)
            .lines()
            .find_map(|line| {
                let mut fields = line.split_whitespace();
                let pid: u32 = fields.next()?.parse().ok()?;
                let ppid: u32 = fields.next()?.parse().ok()?;
                (ppid == std::process::id()
                    && line.contains("knowledge relations")
                    && line.contains("central:wiki:root"))
                .then_some(pid)
            });
        if let Some(pid) = found {
            break pid;
        }
        assert!(
            !worker.is_finished(),
            "native read completed before pending-owner concurrency was observed"
        );
        std::thread::sleep(Duration::from_millis(10));
    };
    assert!(Command::new("/bin/kill")
        .args(["-STOP", &pid.to_string()])
        .status()
        .unwrap()
        .success());
    let paused = Paused(pid);
    let start_theme = Instant::now();
    let theme = kernel
        .lock()
        .unwrap()
        .apply(KernelOp::ThemeApply {
            appearance: "dark".into(),
            id: None,
        })
        .unwrap();
    assert!(
        start_theme.elapsed() < Duration::from_secs(1),
        "theme waited for knowledge owner"
    );
    assert!(!theme.receipts.is_empty());
    assert!(!worker.is_finished());
    drop(paused);
    let done = worker.join().unwrap().expect("real native relations");
    assert_eq!(
        done.request,
        knowledge::Request::Relations {
            address: address.clone()
        }
    );
    assert_eq!(done.data["query"]["focus"], address.reference());
    let result = kernel.lock().unwrap().finish_knowledge(done).unwrap();
    let KernelOpResult::Knowledge { data } = result.result else {
        panic!("wrong result");
    };
    assert_eq!(data["query"]["focus"], address.reference());
    assert!(
        kernel.lock().unwrap().knowledge_refs.is_empty(),
        "relations must not admit a read subject"
    );

    let actual_world = crate::world::read_world(&kernel.lock().unwrap().client).unwrap();
    let read = KernelOp::Knowledge {
        project: None,
        request: knowledge::Request::Read {
            address: address.clone(),
        },
        fresh: true,
    };
    let old = kernel
        .lock()
        .unwrap()
        .prepare_knowledge(&read)
        .unwrap()
        .unwrap()
        .execute()
        .unwrap();
    assert_eq!(old.data["resource"], address.reference());
    let newer = kernel
        .lock()
        .unwrap()
        .prepare_knowledge(&read)
        .unwrap()
        .unwrap()
        .execute()
        .unwrap();
    let mut kernel = kernel.lock().unwrap();
    kernel.finish_knowledge(newer).unwrap();
    assert!(kernel
        .finish_knowledge(old)
        .unwrap_err()
        .contains("superseded"));
    assert_eq!(kernel.knowledge_refs.len(), 1);
    assert_eq!(
        kernel.knowledge_refs[address.reference()].ref_id,
        address.reference()
    );

    // Retained native bytes keep their original cache age after delivery.
    kernel.reads.put("world".into(), actual_world);
    let cached_read = KernelOp::Knowledge {
        project: None,
        request: knowledge::Request::Read {
            address: address.clone(),
        },
        fresh: false,
    };
    let held = kernel.prepare_knowledge(&cached_read).unwrap().unwrap();
    assert!(held.held.is_some(), "native read must already be retained");
    let cached = held.execute().unwrap();
    let cache_key = cached.key.clone();
    std::thread::sleep(Duration::from_millis(40));
    kernel.finish_knowledge(cached).unwrap();
    assert!(
        kernel
            .reads
            .get(&cache_key, Duration::from_millis(20))
            .is_none(),
        "cache delivery must not reset its age"
    );

    // The native answer may not repopulate cache or admission after the same
    // invalidation used by successful source writes, even if its identity matches.
    let pending = kernel.prepare_knowledge(&read).unwrap().unwrap();
    kernel.reads.invalidate_prefix("knowledge:");
    let admitted_before = kernel.knowledge_refs.len();
    let completed = pending.execute().unwrap();
    assert!(kernel
        .finish_knowledge(completed)
        .unwrap_err()
        .contains("invalidated"));
    assert!(kernel
        .reads
        .get(&cache_key, read_cache::KNOWLEDGE_TTL)
        .is_none());
    assert_eq!(kernel.knowledge_refs.len(), admitted_before);
    println!("native relations kept exact subject; theme changed while PID{pid} paused; older native read could not replace admission; proof={}", proof.display());
}

/// Two registers' knowledge reads prepared in one burst while the kernel
/// holds no World reading read Central's World once between them, and a
/// register prepared just after takes that reading at preparation. A World
/// change the owner reports — a fresh World read (lib.rs `world_map`), a
/// ground change — withdraws it: the next burst reads the World again.
#[cfg(unix)]
#[test]
fn registers_prepared_in_one_burst_share_one_world_reading() {
    let owner = crate::tests::FakeOwner::spawn_counter("knowledge-world-burst");
    let mut kernel = owner.kernel();
    let relations = |space: &str| KernelOp::Knowledge {
        project: None,
        request: knowledge::Request::Relations {
            address: knowledge::Address::Wiki(space.into()),
        },
        fresh: false,
    };
    let burst: Vec<Prepared> = ["central:wiki:root", "central:wiki:o-i"]
        .into_iter()
        .map(|space| {
            kernel
                .prepare_knowledge(&relations(space))
                .unwrap()
                .unwrap()
        })
        .collect();
    let worlds: Vec<Value> = std::thread::scope(|scope| {
        let readers: Vec<_> = burst
            .iter()
            .map(|prepared| scope.spawn(move || prepared.world()))
            .collect();
        readers
            .into_iter()
            .map(|reader| reader.join().unwrap().unwrap())
            .collect()
    });
    assert_eq!(owner.spawns("central.world"), 1);
    assert_eq!(worlds[0], worlds[1]);
    let late = kernel
        .prepare_knowledge(&relations("central:wiki:face-rig"))
        .unwrap()
        .unwrap();
    assert!(
        late.world.is_some(),
        "a reading just read serves preparation"
    );
    late.world().unwrap();
    assert_eq!(owner.spawns("central.world"), 1);
    // A fresh World read withdraws the reading the burst shared.
    kernel.reads.invalidate("world");
    let next = kernel
        .prepare_knowledge(&relations("central:wiki:root"))
        .unwrap()
        .unwrap();
    next.world().unwrap();
    assert_eq!(owner.spawns("central.world"), 2);
    // So does a ground change.
    kernel.reads.clear();
    let next = kernel
        .prepare_knowledge(&relations("central:wiki:root"))
        .unwrap()
        .unwrap();
    next.world().unwrap();
    assert_eq!(owner.spawns("central.world"), 3);
}

/// N+1 knowledge requests at once against a bound of N: at most N owner
/// calls are in flight, the last waits for a slot, and every request is
/// answered by its own owner call.
#[cfg(unix)]
#[test]
fn concurrent_owner_calls_hold_to_the_readers_bound() {
    use std::sync::atomic::{AtomicUsize, Ordering};
    const N: usize = 2;
    let owner = crate::tests::FakeOwner::spawn_counter("knowledge-readers-bound");
    let client = owner.kernel().client.clone();
    let readers = Readers::new(N);
    let (in_flight, most) = (AtomicUsize::new(0), AtomicUsize::new(0));
    let together = std::sync::Barrier::new(N + 1);
    std::thread::scope(|scope| {
        let requests: Vec<_> = (0..=N)
            .map(|_| {
                scope.spawn(|| {
                    together.wait();
                    readers.run(|| {
                        let now = in_flight.fetch_add(1, Ordering::SeqCst) + 1;
                        most.fetch_max(now, Ordering::SeqCst);
                        std::thread::sleep(Duration::from_millis(100));
                        let answer = crate::world::read_world(&client);
                        in_flight.fetch_sub(1, Ordering::SeqCst);
                        answer
                    })
                })
            })
            .collect();
        for request in requests {
            assert!(request.join().unwrap().is_ok());
        }
    });
    assert_eq!(
        most.load(Ordering::SeqCst),
        N,
        "at most N owner calls in flight"
    );
    assert_eq!(owner.spawns("central.world"), N + 1);
}

/// An AIKit stand-in reached the way the kernel reaches it
/// (`<suite> aikit --json -C <cwd> knowledge …`): every process logs itself;
/// a wiki address ending `:missing` is refused exactly as AIKit refuses an
/// unindexed object, in the single read's envelope and in a batch item's.
/// `with_batch: false` answers `relations-batch` as AIKit's parser answers a
/// verb it does not have.
#[cfg(unix)]
struct FakeAikit {
    dir: PathBuf,
    executable: PathBuf,
    log: PathBuf,
}

#[cfg(unix)]
impl FakeAikit {
    fn new(test: &str, with_batch: bool) -> Self {
        let dir = std::env::temp_dir().join(format!(
            "oi-cradle-{}-{test}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let fake = Self {
            executable: dir.join("oi"),
            log: dir.join("processes.log"),
            dir,
        };
        fake.write(with_batch);
        fake
    }
    fn write(&self, with_batch: bool) {
        use std::os::unix::fs::PermissionsExt;
        let script = format!(
            r#"#!/usr/bin/env python3
import json, sys, time
LOG, WITH_BATCH = {log:?}, {with_batch}
args = sys.argv[1:]
cwd = args[args.index("-C") + 1]
def answer(cwd, address):
    value = json.loads(address)["value"]
    if value.endswith(":missing"):
        return {{"ok": False, "error": {{"code": "knowledge.wiki_object_missing", "message": "Wiki object or relation endpoint " + value + " is not indexed", "details": {{}}}}}}
    return {{"ok": True, "context": {{"project_root": cwd}}, "data": {{"query": {{"focus": value, "depth": 2, "max_nodes": 96, "max_edges": 192}}, "cwd": cwd, "edges": []}}, "warnings": []}}
if args[-1] == "relations-batch":
    if not WITH_BATCH:
        open(LOG, "a").write("batch-refused\n")
        sys.stderr.write("error: unrecognized subcommand 'relations-batch'\n\n  tip: a similar subcommand exists: 'relations'\n")
        sys.exit(2)
    request = json.load(sys.stdin)
    assert request["schema"] == "aikit.knowledge-relations-batch/v1"
    open(LOG, "a").write("batch %d %s\n" % (len(request["items"]), cwd))
    time.sleep(0.1)
    answers = [answer(item["cwd"], item["address"]) for item in request["items"]]
    print(json.dumps({{"schema": 1, "ok": True, "context": {{}}, "data": {{"schema": "aikit.knowledge-relations-batch/v1", "answers": answers}}, "warnings": []}}))
else:
    open(LOG, "a").write("single\n")
    envelope = answer(cwd, args[-1])
    print(json.dumps(envelope))
    sys.exit(0 if envelope["ok"] else 1)
"#,
            log = self.log.display().to_string(),
            with_batch = if with_batch { "True" } else { "False" },
        );
        std::fs::write(&self.executable, script).unwrap();
        std::fs::set_permissions(&self.executable, std::fs::Permissions::from_mode(0o755)).unwrap();
        crate::test_stub::settle_stub(&self.executable);
    }
    /// Its identity with no AIKit pin: this test's, whatever another test
    /// sets in the process environment.
    fn identity(&self) -> knowledge::AikitIdentity {
        knowledge::AikitIdentity::pinned(self.executable.as_os_str(), None)
    }
    fn processes(&self) -> Vec<String> {
        std::fs::read_to_string(&self.log)
            .unwrap_or_default()
            .lines()
            .map(str::to_owned)
            .collect()
    }
}

#[cfg(unix)]
impl Drop for FakeAikit {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

#[cfg(unix)]
fn relations_item(cwd: &std::path::Path, space: &str) -> knowledge::RelationsItem {
    knowledge::RelationsItem {
        cwd: cwd.to_path_buf(),
        address: knowledge::Address::Wiki(space.into()),
    }
}

/// Relations reads of one Central root arriving within the window go to
/// AIKit as ONE batch process (an identical read shares its item; another
/// root is its own batch), and each read is answered with exactly what its
/// single read answers — its reading, or its own refusal in the same words.
#[cfg(unix)]
#[test]
fn relations_reads_in_one_window_are_one_batch_and_each_gets_its_single_answer() {
    let aikit = FakeAikit::new("relations-batch", true);
    let relations = Relations::new(Duration::from_millis(400));
    let readers = Readers::new(5);
    let root = aikit.dir.join("Central");
    let other_root = aikit.dir.join("Other");
    let project = root.join("Work/O-I");
    let reads: Vec<(PathBuf, PathBuf, &str)> = vec![
        (root.clone(), root.clone(), "central:wiki:root"),
        (root.clone(), project.clone(), "central:wiki:project:O-I"),
        (root.clone(), project.clone(), "central:wiki:project:O-I"),
        (
            root.clone(),
            root.clone(),
            "central:wiki:project:gone:missing",
        ),
        (root.clone(), root.clone(), "central:wiki:project:ai-kit"),
        (other_root.clone(), other_root.clone(), "central:wiki:root"),
    ];
    let together = std::sync::Barrier::new(reads.len());
    let answers: Vec<Result<Value, String>> = std::thread::scope(|scope| {
        let handles: Vec<_> = reads
            .iter()
            .map(|(root, cwd, space)| {
                let (relations, readers, together, aikit) =
                    (&relations, &readers, &together, &aikit);
                scope.spawn(move || {
                    together.wait();
                    match relations.read(
                        readers,
                        aikit.executable.as_os_str(),
                        aikit.identity(),
                        root,
                        relations_item(cwd, space),
                    ) {
                        Gathered::Answer(answer) => answer.map_err(knowledge::describe),
                        Gathered::Single => panic!("an AIKit with the batch never reads alone"),
                    }
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    let mut processes = aikit.processes();
    processes.sort();
    assert_eq!(
        processes,
        vec![
            format!("batch 1 {}", other_root.display()),
            format!("batch 4 {}", root.display()),
        ],
        "one process per root; the duplicate read shared its item"
    );
    for ((_, cwd, space), answer) in reads.iter().zip(&answers) {
        let single = knowledge::call_with(
            aikit.executable.as_os_str(),
            cwd,
            &knowledge::Request::Relations {
                address: knowledge::Address::Wiki((*space).into()),
            },
        );
        assert_eq!(answer, &single, "{space} answers as its single read");
    }
    assert!(answers[3]
        .as_ref()
        .unwrap_err()
        .contains("central:wiki:project:gone:missing is not indexed"));
    assert_eq!(
        answers[1].as_ref().unwrap()["cwd"],
        project.display().to_string()
    );
}

/// An AIKit without the batch is asked once: its own refusal of the verb
/// sends the gathering's reads to single reads, and its identity is
/// remembered — the next read is single without asking. A replaced AIKit
/// is another identity, asked again.
#[cfg(unix)]
#[test]
fn an_aikit_without_the_batch_is_asked_once_per_identity_and_reads_alone() {
    let aikit = FakeAikit::new("relations-batch-absent", false);
    let relations = Relations::new(Duration::from_millis(50));
    let readers = Readers::new(5);
    let root = aikit.dir.join("Central");
    let read = |space: &str| {
        relations.read(
            &readers,
            aikit.executable.as_os_str(),
            aikit.identity(),
            &root,
            relations_item(&root, space),
        )
    };
    assert!(matches!(read("central:wiki:root"), Gathered::Single));
    assert_eq!(aikit.processes(), vec!["batch-refused"]);
    assert!(matches!(read("central:wiki:project:O-I"), Gathered::Single));
    assert_eq!(
        aikit.processes(),
        vec!["batch-refused"],
        "the absence is remembered for this AIKit"
    );
    // The same path, rewritten with the batch: a new identity, asked again.
    aikit.write(true);
    assert!(matches!(read("central:wiki:root"), Gathered::Answer(Ok(_))));
    assert_eq!(
        aikit.processes(),
        vec![
            "batch-refused".to_owned(),
            format!("batch 1 {}", root.display())
        ]
    );
}
