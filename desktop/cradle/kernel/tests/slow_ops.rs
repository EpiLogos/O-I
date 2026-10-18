//! Lane K1: the kernel's always-on slow-op record (slow_ops.rs, the form of
//! OpenRig's slow-op recorder). An op of 250 ms or more appends one JSON line
//! to `slow-ops.jsonl`, a faster one none; the file rotates at its limit
//! keeping three; a line that cannot be written only counts as lost. The
//! hosts record through the same call they trace with (dispatch.rs
//! `trace_op`, the native host's `kernel_op` and material route), into the
//! kernel's own state home (`$OI_HOME/desktop`), and `protocol_read`
//! discloses the record. Its own process, so the environment is this file's.
use oi_cradle_kernel::dispatch::{self, Timing};
use oi_cradle_kernel::slow_ops::{Recorder, FILE_NAME, KEEP, ROTATE_BYTES, THRESHOLD};
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::Value;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

fn scratch(test: &str) -> PathBuf {
    let directory =
        std::env::temp_dir().join(format!("oi-cradle-slow-ops-{}-{test}", std::process::id()));
    let _ = std::fs::remove_dir_all(&directory);
    std::fs::create_dir_all(&directory).unwrap();
    directory
}

fn timing() -> Timing {
    Timing {
        lock_wait: Duration::from_micros(1_500),
        lock_held: Duration::from_millis(2),
        owner: Duration::from_millis(300),
        form: "owner-read",
    }
}

fn lines(path: &Path) -> Vec<Value> {
    std::fs::read_to_string(path)
        .unwrap_or_default()
        .lines()
        .map(|line| serde_json::from_str(line).expect("each line is one JSON record"))
        .collect()
}

#[test]
fn the_record_keeps_openrigs_limits() {
    assert_eq!(THRESHOLD, Duration::from_millis(250));
    assert_eq!(ROTATE_BYTES, 1024 * 1024);
    assert_eq!(KEEP, 3);
    assert_eq!(FILE_NAME, "slow-ops.jsonl");
}

#[test]
fn a_slow_op_writes_one_line_and_a_fast_op_none() {
    let directory = scratch("one-line");
    let path = directory.join("state").join(FILE_NAME);
    let record = Recorder::at(path.clone());
    let fast = record.record(
        "bridge",
        "state",
        true,
        Duration::from_millis(249),
        &timing(),
    );
    assert!(!fast, "249 ms is not slow");
    assert!(!path.exists(), "a fast op writes nothing");
    let slow = record.record(
        "bridge",
        "seat_status_read",
        false,
        Duration::from_millis(250),
        &timing(),
    );
    assert!(slow, "250 ms is slow (inclusive)");
    let written = lines(&path);
    assert_eq!(written.len(), 1, "one line per slow op");
    let line = &written[0];
    assert!(line["unix_ms"].as_u64().is_some_and(|ms| ms > 0), "{line}");
    assert_eq!(line["op"], "seat_status_read");
    assert_eq!(line["ok"], false);
    assert_eq!(line["total_ms"], 250.0);
    assert_eq!(line["lock_wait_ms"], 1.5);
    assert_eq!(line["lock_held_ms"], 2.0);
    assert_eq!(line["owner_ms"], 300.0);
    assert_eq!(line["form"], "owner-read");
    assert_eq!(line["host"], "bridge");
    assert_eq!(
        line.as_object().unwrap().len(),
        9,
        "exactly the nine fields: {line}"
    );
    let mode = |path: &Path| std::fs::metadata(path).unwrap().permissions().mode() & 0o777;
    assert_eq!(mode(&path), 0o600, "the record is the person's own");
    assert_eq!(mode(path.parent().unwrap()), 0o700);
    assert_eq!(record.lost_writes(), 0);
    let _ = std::fs::remove_dir_all(&directory);
}

#[test]
fn the_file_rotates_at_its_limit_keeping_three() {
    let directory = scratch("rotation");
    let path = directory.join(FILE_NAME);
    let limit = 512;
    let record = Recorder::with_limit(path.clone(), limit);
    for index in 0..40 {
        assert!(record.record(
            "native",
            &format!("op_{index}"),
            true,
            Duration::from_millis(300),
            &timing(),
        ));
    }
    let numbered = |index: usize| PathBuf::from(format!("{}.{index}", path.display()));
    let kept = [path.clone(), numbered(1), numbered(2), numbered(3)];
    for file in &kept {
        let size = std::fs::metadata(file)
            .unwrap_or_else(|_| panic!("{} is kept", file.display()))
            .len();
        assert!(
            size <= limit,
            "{} holds {size} bytes past its {limit}",
            file.display()
        );
    }
    assert!(!numbered(4).exists(), "only three rotated files are kept");
    // The newest op is in the live file, the files are in order, and no line
    // was split across a rotation.
    let live = lines(&path);
    assert_eq!(live.last().unwrap()["op"], "op_39");
    let ops: Vec<String> = kept
        .iter()
        .rev()
        .flat_map(|file| lines(file))
        .map(|line| line["op"].as_str().unwrap().to_owned())
        .collect();
    let numbers: Vec<usize> = ops
        .iter()
        .map(|op| op.trim_start_matches("op_").parse().unwrap())
        .collect();
    assert!(
        numbers.windows(2).all(|pair| pair[1] == pair[0] + 1),
        "{ops:?}"
    );
    assert_eq!(*numbers.last().unwrap(), 39);
    assert!(
        numbers[0] > 0,
        "the oldest lines were dropped with the oldest file"
    );
    assert_eq!(record.lost_writes(), 0);
    let _ = std::fs::remove_dir_all(&directory);
}

#[test]
fn an_unwritable_directory_only_increments_the_counter() {
    let directory = scratch("unwritable");
    // A directory the record may not write into…
    let closed = directory.join("closed");
    std::fs::create_dir_all(&closed).unwrap();
    std::fs::set_permissions(&closed, std::fs::Permissions::from_mode(0o500)).unwrap();
    let record = Recorder::at(closed.join(FILE_NAME));
    let slow = || record.record("native", "graph", true, Duration::from_secs(46), &timing());
    assert!(!slow(), "the line was not written");
    assert!(!slow());
    assert_eq!(record.lost_writes(), 2, "each lost line is counted");
    assert!(!closed.join(FILE_NAME).exists());
    // …and a state home whose directory is a file.
    let file = directory.join("not-a-directory");
    std::fs::write(&file, "").unwrap();
    let record = Recorder::at(file.join("desktop").join(FILE_NAME));
    assert!(!record.record("native", "graph", true, Duration::from_secs(1), &timing()));
    assert_eq!(record.lost_writes(), 1);
    // A fast op is never a lost write.
    assert!(!record.record("native", "state", true, Duration::from_millis(1), &timing()));
    assert_eq!(record.lost_writes(), 1);
    std::fs::set_permissions(&closed, std::fs::Permissions::from_mode(0o700)).unwrap();
    let _ = std::fs::remove_dir_all(&directory);
}

/// The host's own calls (main.rs `kernel_op`, material_protocol.rs): the op's
/// wire name, the one dispatch, then `trace_op` — without the trace variable,
/// a slow op still lands in `$OI_HOME/desktop/slow-ops.jsonl`, and
/// `protocol_read` names that file, its limits and its lost writes.
#[test]
fn the_host_records_into_the_kernels_state_home_and_protocol_read_discloses_it() {
    let home = scratch("host");
    std::env::set_var("OI_HOME", &home);
    std::env::remove_var("OI_KERNEL_TRACE_FILE");
    let kernel = Mutex::new(Kernel::new(CentralClient::with(
        home.join("no-owner"),
        None,
        "test".into(),
    )));
    let op = KernelOp::State;
    let name = dispatch::op_name(&op);
    let (result, timing) = dispatch::dispatch(&kernel, op);
    // A real dispatch of `state` is fast: traced, never recorded.
    dispatch::trace_op(
        "native",
        &name,
        result.is_ok(),
        Duration::from_millis(3),
        &timing,
    );
    let file = home.join("desktop").join(FILE_NAME);
    assert!(!file.exists(), "a fast op writes no slow-op line");
    // The same call for an op that took 12 s (agency_read's 15 Oct average).
    dispatch::trace_op(
        "native",
        "agency_read",
        true,
        Duration::from_secs(12),
        &timing,
    );
    let written = lines(&file);
    assert_eq!(written.len(), 1, "{written:?}");
    assert_eq!(written[0]["op"], "agency_read");
    assert_eq!(written[0]["host"], "native");
    assert_eq!(written[0]["form"], "ordered");
    assert_eq!(written[0]["total_ms"], 12_000.0);

    let outcome = kernel
        .lock()
        .unwrap()
        .apply(KernelOp::ProtocolRead)
        .unwrap();
    let KernelOpResult::Protocol { document } = outcome.result else {
        panic!("protocol_read answers with the protocol document");
    };
    assert_eq!(
        document.slow_ops.file.as_deref(),
        Some(file.display().to_string().as_str())
    );
    assert_eq!(document.slow_ops.threshold_ms, 250);
    assert_eq!(document.slow_ops.rotate_bytes, 1024 * 1024);
    assert_eq!(document.slow_ops.keep, 3);
    assert_eq!(document.slow_ops.lost_writes, 0);
    let _ = std::fs::remove_dir_all(&home);
}
