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
