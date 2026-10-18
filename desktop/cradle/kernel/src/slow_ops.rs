//! The kernel's always-on record of its slow ops (lane K1), the form of
//! OpenRig's slow-op recorder (openrig/packages/daemon/src/domain/
//! slow-op-recorder.ts:6-10 the limits, :104-130 the rotating append,
//! :186-190 the counted lost write, :278-281 the inclusive threshold): every
//! op a host dispatches that takes 250 ms or more appends one JSON line —
//! `unix_ms, op, ok, total_ms, lock_wait_ms, lock_held_ms, owner_ms, form,
//! host` — to `slow-ops.jsonl` in the kernel's own state directory
//! (`$OI_HOME/desktop`, else `~/.oi/desktop`, where the act store, the
//! dictation and the retained readings already live; never Central's
//! ground). Past 1 MiB the file rotates, keeping three (`.1` the newest,
//! `.3` the oldest). A line that cannot be written is counted, never hidden:
//! `protocol_read` discloses the count (protocol.rs `SlowOpsContract`).
//!
//! The hosts record through `record` after each dispatch (dispatch.rs
//! `trace_op` for the native host, walk-bridge.rs for the dev bridge),
//! outside the kernel lock. The env-named trace (`OI_KERNEL_TRACE_FILE`) is
//! a separate, opt-in channel and stays as it was.
use crate::dispatch::Timing;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

/// An op this long or longer is recorded (OpenRig's
/// `SLOW_OPERATION_THRESHOLD_MS`, inclusive).
pub const THRESHOLD: Duration = Duration::from_millis(250);
/// The file rotates before a line would take it past this size.
pub const ROTATE_BYTES: u64 = 1024 * 1024;
/// How many rotated files are kept beside the live one.
pub const KEEP: usize = 3;
/// The record's file name in the kernel's state directory.
pub const FILE_NAME: &str = "slow-ops.jsonl";

/// One slow-op record: its file, its rotation limit, and its lost writes.
#[derive(Debug)]
pub struct Recorder {
    path: Option<PathBuf>,
    rotate_bytes: u64,
    lost: AtomicU64,
    // Appends and rotations from this process's threads take turns, so a
    // rotation never renames a file another thread is appending to.
    writing: Mutex<()>,
}

impl Recorder {
    /// A record at `path`, rotating at [`ROTATE_BYTES`].
    pub fn at(path: PathBuf) -> Self {
        Self::with_limit(path, ROTATE_BYTES)
    }

    /// A record at `path` rotating at `rotate_bytes` (tests use a small one).
    pub fn with_limit(path: PathBuf, rotate_bytes: u64) -> Self {
        Self {
            path: Some(path),
            rotate_bytes,
            lost: AtomicU64::new(0),
            writing: Mutex::new(()),
        }
    }

    /// The record under the process's state home: `$OI_HOME/desktop`, else
    /// `~/.oi/desktop`. Without either every slow op is a lost write.
    pub fn discover() -> Self {
        let home = std::env::var_os("OI_HOME")
            .filter(|home| !home.is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var_os("HOME")
                    .filter(|home| !home.is_empty())
                    .map(|home| PathBuf::from(home).join(".oi"))
            });
        Self {
            path: home.map(|home| home.join("desktop").join(FILE_NAME)),
            rotate_bytes: ROTATE_BYTES,
            lost: AtomicU64::new(0),
            writing: Mutex::new(()),
        }
    }

    pub fn path(&self) -> Option<&Path> {
        self.path.as_deref()
    }

    /// Slow ops whose line could not be written since this record opened.
    pub fn lost_writes(&self) -> u64 {
        self.lost.load(Ordering::Relaxed)
    }

    /// Record one dispatched op if it took [`THRESHOLD`] or longer. Returns
    /// whether a line was written; a line that could not be written is
    /// counted in [`Recorder::lost_writes`] and never fails the op.
    pub fn record(&self, host: &str, op: &str, ok: bool, total: Duration, timing: &Timing) -> bool {
        if total < THRESHOLD {
            return false;
        }
        let mut line = serde_json::json!({
            "unix_ms": unix_ms(),
            "op": op,
            "ok": ok,
            "total_ms": millis(total),
            "lock_wait_ms": millis(timing.lock_wait),
            "lock_held_ms": millis(timing.lock_held),
            "owner_ms": millis(timing.owner),
            "form": timing.form,
            "host": host,
        })
        .to_string();
        line.push('\n');
        match self.append(&line) {
            Ok(()) => true,
            Err(_) => {
                self.lost.fetch_add(1, Ordering::Relaxed);
                false
            }
        }
    }

    fn append(&self, line: &str) -> std::io::Result<()> {
        use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
        let path = self.path.as_deref().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "no state home (OI_HOME or HOME)",
            )
        })?;
        let _turn = self
            .writing
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(directory) = path.parent() {
            std::fs::DirBuilder::new()
                .recursive(true)
                .mode(0o700)
                .create(directory)?;
        }
        let size = std::fs::metadata(path).map(|meta| meta.len()).unwrap_or(0);
        if size > 0 && size + line.len() as u64 > self.rotate_bytes {
            rotate(path)?;
        }
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .mode(0o600)
            .open(path)?
            .write_all(line.as_bytes())
    }
}

/// `slow-ops.jsonl.2` → `.3`, `.1` → `.2`, the live file → `.1`; the oldest
/// is replaced (OpenRig's `rotate`, slow-op-recorder.ts:104-113).
fn rotate(path: &Path) -> std::io::Result<()> {
    let numbered = |index: usize| {
        let mut name = path.as_os_str().to_owned();
        name.push(format!(".{index}"));
        PathBuf::from(name)
    };
    for index in (1..=KEEP).rev() {
        let source = if index == 1 {
            path.to_path_buf()
        } else {
            numbered(index - 1)
        };
        if std::fs::symlink_metadata(&source).is_ok() {
            std::fs::rename(&source, numbered(index))?;
        }
    }
    Ok(())
}

/// The process's one record (`Recorder::discover`, opened at the first slow
/// op or the first disclosure).
pub fn global() -> &'static Recorder {
    static RECORD: OnceLock<Recorder> = OnceLock::new();
    RECORD.get_or_init(Recorder::discover)
}

/// Record one dispatched op in the process's record (see [`Recorder::record`]).
pub fn record(host: &str, op: &str, ok: bool, total: Duration, timing: &Timing) -> bool {
    global().record(host, op, ok, total, timing)
}

fn unix_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or(0)
}

/// Milliseconds to a tenth, as the trace writes them.
fn millis(duration: Duration) -> f64 {
    (duration.as_secs_f64() * 10_000.0).round() / 10.0
}
