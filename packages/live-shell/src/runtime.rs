//! Relocatable payload qualification. This proves bytes and containment only;
//! native readiness, authority and installed functional acceptance remain owners'.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

#[path = "native_contract.rs"]
mod native_contract;
#[allow(unused_imports)]
pub use native_contract::bind_change_epoch;
pub use native_contract::unique_json;

pub const PAYLOAD_SCHEMA: &str = "oi.live-shell-payload/v1";
pub const HOST_SCHEMA: &str = "oi.live-shell-native-host/v1";

/// Read the suite's existing CurrentWorld owner through an explicit executable.
/// Qualification supplies this path; product discovery never falls back to PATH.
pub fn current_world(suite_cli: &Path) -> Result<serde_json::Value, String> {
    if let Some(reading) = native_contract::recalled_world(suite_cli) {
        return Ok(reading);
    }
    let epoch = native_contract::epoch_now();
    let reading = current_world_unremembered(suite_cli)?;
    native_contract::remember_world(suite_cli, epoch, &reading);
    Ok(reading)
}

fn current_world_unremembered(suite_cli: &Path) -> Result<serde_json::Value, String> {
    #[cfg(unix)]
    {
        let started = std::time::Instant::now();
        let mut command = std::process::Command::new(suite_cli);
        // Without the person's token, whatever the host's environment holds (O-I #747 round 896 1V, M1; the desktop host includes
        // this source, and the kernel's flow.rs no_child_inherits_the_person_s_token reads it).
        command.env_remove("CENTRAL_NATIVE_TOKEN");
        command.args(["current-world", "--json"]);
        let (child, stdout, stderr) = spawn_current_world_read(&mut command)?;
        let output = finish_current_world_read(
            child,
            stdout,
            stderr,
            CURRENT_WORLD_DEADLINE.saturating_sub(started.elapsed()),
        )?;
        native_contract::current_world_output(output)
    }
    #[cfg(not(unix))]
    {
        let _ = suite_cli;
        Err("Native CurrentWorld bounded execution requires Unix".into())
    }
}

#[cfg(unix)]
const CURRENT_WORLD_DEADLINE: std::time::Duration = std::time::Duration::from_secs(30);
#[cfg(unix)]
const CURRENT_WORLD_STDOUT_BYTES: usize = 2 * 1024 * 1024;
#[cfg(unix)]
const CURRENT_WORLD_STDERR_BYTES: usize = 64 * 1024;

#[cfg(unix)]
fn spawn_current_world_read(
    command: &mut std::process::Command,
) -> Result<
    (
        std::process::Child,
        std::os::unix::net::UnixStream,
        std::os::unix::net::UnixStream,
    ),
    String,
> {
    use std::os::{fd::OwnedFd, unix::net::UnixStream};
    let (stdout, child_stdout) = UnixStream::pair().map_err(|e| e.to_string())?;
    let (stderr, child_stderr) = UnixStream::pair().map_err(|e| e.to_string())?;
    stdout.set_nonblocking(true).map_err(|e| e.to_string())?;
    stderr.set_nonblocking(true).map_err(|e| e.to_string())?;
    let child_stdout: OwnedFd = child_stdout.into();
    let child_stderr: OwnedFd = child_stderr.into();
    let child = command
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::from(child_stdout))
        .stderr(std::process::Stdio::from(child_stderr))
        .spawn()
        .map_err(|e| format!("Native CurrentWorld is unavailable: {e}"))?;
    // Command retains its configured Stdio descriptors. Close our copies so
    // completion does not wait for a parent-owned copy of the child's writer.
    command.stdout(std::process::Stdio::null());
    command.stderr(std::process::Stdio::null());
    Ok((child, stdout, stderr))
}

/// What a CurrentWorld read waited for (O-I #747 round 896 1T.0.1; review 956d finding 1): every wait between its reads, and those
/// that ran their time out with nothing ready. While output flows none runs out, as the read waits for its streams to be ready, never
/// a fixed time: one that slept 10 ms between reads read about a socket buffer a sleep, 8 KiB on macOS, so 2 MiB took between about 190
/// and 256 sleeps (191 on lane BA's Mac; a read takes more than 8 KiB once the pipe has filled).
#[cfg(unix)]
#[derive(Debug, Default)]
struct ReadWaits {
    waited: usize,
    ran_out: usize,
}

/// The child's exit, once both of its streams have closed: no descriptor answers it, so it is awaited this long first, and twice as long
/// each time after, to `CURRENT_WORLD_EXIT_WAIT_MAX` (1T.2 item 18: not about 660 wakes a second). No output is left to flow by then,
/// and a child that closed its streams has almost always exited.
#[cfg(unix)]
const CURRENT_WORLD_EXIT_WAIT: std::time::Duration = std::time::Duration::from_millis(1);
#[cfg(unix)]
const CURRENT_WORLD_EXIT_WAIT_MAX: std::time::Duration = std::time::Duration::from_millis(16);

#[cfg(unix)]
fn finish_current_world_read(
    child: std::process::Child,
    stdout: std::os::unix::net::UnixStream,
    stderr: std::os::unix::net::UnixStream,
    deadline: std::time::Duration,
) -> Result<std::process::Output, String> {
    finish_current_world_read_waiting(child, stdout, stderr, deadline, &mut ReadWaits::default())
}

/// The read, its waits counted (`ReadWaits`). Between reads it waits for an open stream to be readable or closed, for what is left of
/// the deadline at most (`poll`). The child's exit closes the streams it alone holds, and that wakes the wait; a child whose own
/// children hold them open is read until they close or the deadline passes, as before. Once both have closed, the child's exit is
/// awaited a short time at a time, backing off (`CURRENT_WORLD_EXIT_WAIT`; counted: `the_exit_wait_backs_off`). That is the read's
/// one sleep: nothing else here waits a fixed time (a tripwire in source: `the_read_sleeps_only_for_the_exit`). A wait that answers
/// EAGAIN is waited again at once, with no back-off: macOS documents it as passing, and one that kept answering it would spin until
/// the deadline (1T.2b item 7; no test, as none is practical without a seam around the wait).
#[cfg(unix)]
fn finish_current_world_read_waiting(
    child: std::process::Child,
    mut stdout: std::os::unix::net::UnixStream,
    mut stderr: std::os::unix::net::UnixStream,
    deadline: std::time::Duration,
    waits: &mut ReadWaits,
) -> Result<std::process::Output, String> {
    use std::os::fd::AsRawFd;
    struct OwnedChild(std::process::Child);
    impl Drop for OwnedChild {
        fn drop(&mut self) {
            if self.0.try_wait().ok().flatten().is_none() {
                // Signal and reap this read's Child handle only. No PID scan,
                // process-group signal or detached blocking reader survives.
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }
    }
    fn drain(
        stream: &mut std::os::unix::net::UnixStream,
        bytes: &mut Vec<u8>,
        limit: usize,
        face: &str,
        started: std::time::Instant,
        deadline: std::time::Duration,
    ) -> Result<bool, String> {
        let mut buffer = [0u8; 8192];
        loop {
            if started.elapsed() >= deadline {
                return Err("Native CurrentWorld read timed out after its bounded deadline".into());
            }
            match stream.read(&mut buffer) {
                Ok(0) => return Ok(true),
                Ok(count) => {
                    if count > limit.saturating_sub(bytes.len()) {
                        return Err(format!(
                            "Native CurrentWorld {face} exceeds {limit}-byte limit"
                        ));
                    }
                    bytes.extend_from_slice(&buffer[..count]);
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => return Ok(false),
                Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(e) => return Err(format!("Native CurrentWorld {face} read failed: {e}")),
            }
        }
    }
    let mut child = OwnedChild(child);
    let started = std::time::Instant::now();
    let (mut stdout_bytes, mut stderr_bytes) = (Vec::new(), Vec::new());
    let (mut stdout_closed, mut stderr_closed) = (false, false);
    let mut status = None;
    let mut exit_wait = CURRENT_WORLD_EXIT_WAIT;
    loop {
        if started.elapsed() >= deadline {
            return Err("Native CurrentWorld read timed out after its bounded deadline".into());
        }
        if !stdout_closed {
            stdout_closed = drain(
                &mut stdout,
                &mut stdout_bytes,
                CURRENT_WORLD_STDOUT_BYTES,
                "stdout",
                started,
                deadline,
            )?;
        }
        if !stderr_closed {
            stderr_closed = drain(
                &mut stderr,
                &mut stderr_bytes,
                CURRENT_WORLD_STDERR_BYTES,
                "stderr",
                started,
                deadline,
            )?;
        }
        if status.is_none() {
            status = child
                .0
                .try_wait()
                .map_err(|e| format!("Native CurrentWorld wait failed: {e}"))?;
        }
        if let Some(status) = status {
            if stdout_closed && stderr_closed {
                return Ok(std::process::Output {
                    status,
                    stdout: stdout_bytes,
                    stderr: stderr_bytes,
                });
            }
        }
        let left = deadline.saturating_sub(started.elapsed());
        waits.waited += 1;
        let mut open: Vec<libc::pollfd> = [
            (stdout_closed, stdout.as_raw_fd()),
            (stderr_closed, stderr.as_raw_fd()),
        ]
        .into_iter()
        .filter(|(closed, _)| !closed)
        .map(|(_, fd)| libc::pollfd {
            fd,
            events: libc::POLLIN,
            revents: 0,
        })
        .collect();
        if open.is_empty() {
            std::thread::sleep(exit_wait.min(left));
            exit_wait = (exit_wait * 2).min(CURRENT_WORLD_EXIT_WAIT_MAX);
            waits.ran_out += 1;
            continue;
        }
        // Whole milliseconds, rounded up, so that a wait never ends before what is left of the deadline does.
        let timeout =
            libc::c_int::try_from(left.as_micros().div_ceil(1000)).unwrap_or(libc::c_int::MAX);
        // SAFETY: poll reads and writes only the records it is handed, as many as their count says.
        match unsafe { libc::poll(open.as_mut_ptr(), open.len() as libc::nfds_t, timeout) } {
            0 => waits.ran_out += 1,
            ready if ready > 0 => {}
            _ => {
                // Interrupted, or EAGAIN, which macOS documents as retryable for this call (1T.2 item 18): waited again, at once.
                let error = std::io::Error::last_os_error();
                if error.kind() != std::io::ErrorKind::Interrupted
                    && error.raw_os_error() != Some(libc::EAGAIN)
                {
                    return Err(format!("Native CurrentWorld wait failed: {error}"));
                }
            }
        }
    }
}

#[cfg(all(test, unix))]
mod current_world_process_tests {
    use super::*;

    /// 1T.2 item 17 (review 956d's re-check): the waits' count cannot see a sleep after a ready poll (one of 10 ms keeps `ran_out` at
    /// 0 and takes 2.4 to 2.8 s for 2 MiB), so the read's source is pinned: it sleeps once, for the child's exit after both streams
    /// close, and nowhere else.
    ///
    /// A tripwire, not a proof (1T.2b item 7; review 966 F7): it reads the function's text. It holds one call of a `sleep` under any
    /// spelling (`thread::sleep(`, an imported `sleep(`, `nanosleep(`) and one wait call, so a fixed wait written as a second, empty
    /// wait call is seen too. A wait by a means that is neither is not seen.
    #[test]
    fn the_read_sleeps_only_for_the_exit() {
        let source = include_str!("runtime.rs");
        let from = source
            .find("fn finish_current_world_read(")
            .expect("the read");
        let to = from
            + source[from..]
                .find("#[cfg(all(test, unix))]")
                .expect("its end");
        let read = &source[from..to];
        assert_eq!(
            read.matches("thread::sleep(").count(),
            1,
            "the read sleeps once"
        );
        assert_eq!(
            read.matches("sleep(").count(),
            1,
            "and by no other spelling of a sleep"
        );
        assert_eq!(
            read.matches("poll(").count(),
            1,
            "and it waits for its streams in one call, so no second one waits a fixed time"
        );
        let open = read.find("if open.is_empty() {").expect("the exit wait");
        let sleep = read.find("thread::sleep(").unwrap();
        let after = open + read[open..].find("continue;").expect("its end");
        assert!(
            open < sleep && sleep < after,
            "and that sleep is the exit wait, after both streams have closed"
        );
    }

    /// 1T.2b item 7 (DLW build ruling 2026-11-10; review 966 F8): the exit wait backs off (1T.2 item 18). Counted, not timed: a child
    /// closes both of its streams and exits 200 ms later. Waiting 1 ms each time, about 140 to 200 exit waits run out before it has
    /// exited; doubling to 16 ms, about 14. Load only lowers the count, since each wait then lasts longer. At most 40 run out.
    #[test]
    fn the_exit_wait_backs_off() {
        let mut command = std::process::Command::new("/bin/sh");
        command.args(["-c", "exec >&- 2>&-; /bin/sleep 0.2"]);
        let (child, stdout, stderr) = spawn_current_world_read(&mut command).unwrap();
        let mut waits = ReadWaits::default();
        let output = finish_current_world_read_waiting(
            child,
            stdout,
            stderr,
            CURRENT_WORLD_DEADLINE,
            &mut waits,
        )
        .unwrap();
        assert!(output.status.success(), "{output:?}");
        assert!(
            waits.ran_out >= 1,
            "the child's exit was waited for after its streams closed: {waits:?}"
        );
        assert!(
            waits.ran_out <= 40,
            "the exit wait backs off, so few waits run out in 200 ms: {waits:?}"
        );
    }

    fn absent(pid: u32) {
        let process = std::process::Command::new("/bin/ps")
            .args(["-p", &pid.to_string(), "-o", "stat="])
            .output()
            .unwrap();
        assert!(
            !process.status.success() || process.stdout.iter().all(u8::is_ascii_whitespace),
            "owned child {pid} was not reaped"
        );
    }

    #[test]
    #[ignore = "Requires an actual source-qualified copied release O:I CLI"]
    fn reads_actual_copied_release_current_world() {
        let path = std::env::var_os("LIVE_SHELL_ACCEPTANCE_OI_BIN")
            .expect("Provide actual copied release O:I");
        let reading = current_world(Path::new(&path)).unwrap();
        assert_eq!(reading["schema"], "oi.current-world/v2");
        assert!(reading["positions"].is_array());
    }

    #[test]
    fn actual_hung_child_deadline_kills_and_reaps_only_owned_child() {
        let mut command = std::process::Command::new("/bin/sleep");
        command.arg("60");
        let (child, stdout, stderr) = spawn_current_world_read(&mut command).unwrap();
        let pid = child.id();
        let started = std::time::Instant::now();
        let error =
            finish_current_world_read(child, stdout, stderr, std::time::Duration::from_millis(100))
                .unwrap_err();
        assert!(error.contains("timed out"), "{error}");
        assert!(started.elapsed() < std::time::Duration::from_secs(5));
        absent(pid);
    }

    #[test]
    fn actual_output_children_are_bounded_and_reaped() {
        for (script, face, limit) in [
            (
                "exec /usr/bin/yes native-output",
                "stdout",
                CURRENT_WORLD_STDOUT_BYTES,
            ),
            (
                "exec /usr/bin/yes native-output >&2",
                "stderr",
                CURRENT_WORLD_STDERR_BYTES,
            ),
        ] {
            let mut command = std::process::Command::new("/bin/sh");
            command.args(["-c", script]);
            let (child, stdout, stderr) = spawn_current_world_read(&mut command).unwrap();
            let pid = child.id();
            let error = finish_current_world_read(child, stdout, stderr, CURRENT_WORLD_DEADLINE)
                .unwrap_err();
            assert_eq!(
                error,
                format!("Native CurrentWorld {face} exceeds {limit}-byte limit")
            );
            absent(pid);
        }
    }

    /// O-I #747 round 896 1T.0.1 (review 956d finding 1): output that flows is read as it comes, never after a fixed wait. Counted,
    /// not timed: through macOS's 8 KiB socket buffers a read that slept 10 ms between reads ran out a wait for about each buffer, about
    /// 190 to 256 for 2 MiB (191 on lane BA's Mac, 78b11cea's loop), and on a loaded runner the deadline before the limit. And a child
    /// that writes nothing runs its wait out.
    #[test]
    fn flowing_output_is_read_as_it_comes_never_after_a_fixed_wait() {
        for (script, face, limit) in [
            (
                "exec /usr/bin/yes native-output",
                "stdout",
                CURRENT_WORLD_STDOUT_BYTES,
            ),
            (
                "exec /usr/bin/yes native-output >&2",
                "stderr",
                CURRENT_WORLD_STDERR_BYTES,
            ),
        ] {
            let mut command = std::process::Command::new("/bin/sh");
            command.args(["-c", script]);
            let (child, stdout, stderr) = spawn_current_world_read(&mut command).unwrap();
            let pid = child.id();
            let mut waits = ReadWaits::default();
            let error = finish_current_world_read_waiting(
                child,
                stdout,
                stderr,
                CURRENT_WORLD_DEADLINE,
                &mut waits,
            )
            .unwrap_err();
            assert_eq!(
                error,
                format!("Native CurrentWorld {face} exceeds {limit}-byte limit")
            );
            assert_eq!(
                waits.ran_out, 0,
                "no wait ran its time out while {limit} bytes of {face} flowed: {waits:?}"
            );
            absent(pid);
        }
        let mut command = std::process::Command::new("/bin/sleep");
        command.arg("60");
        let (child, stdout, stderr) = spawn_current_world_read(&mut command).unwrap();
        let mut waits = ReadWaits::default();
        let error = finish_current_world_read_waiting(
            child,
            stdout,
            stderr,
            std::time::Duration::from_millis(100),
            &mut waits,
        )
        .unwrap_err();
        assert!(error.contains("timed out"), "{error}");
        assert!(
            waits.ran_out >= 1,
            "a child that writes nothing runs its wait out: {waits:?}"
        );
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Payload {
    pub schema: String,
    pub source_revision: String,
    pub source_tree_sha256: String,
    pub source_dirty: bool,
    pub backing_id: String,
    pub product_ids: Vec<String>,
    pub products_root: String,
    pub footprint: FileRecord,
    pub catalogue: FileRecord,
    pub host: HostFiles,
    pub shell: AssetTree,
    pub expressions: AssetTree,
    pub notices: Vec<FileRecord>,
    pub products: Vec<Product>,
    pub node_runtime: NodeRuntime,
    #[serde(default)]
    pub provenance: Vec<FileRecord>,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NodeRuntime {
    pub executable: FileRecord,
    pub resources: Vec<FileRecord>,
    pub notices: Vec<FileRecord>,
    pub provenance: FileRecord,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostFiles {
    pub executable: CodeRecord,
    pub marker: FileRecord,
    pub suite_cli: SuiteCli,
    pub resources: Vec<FileRecord>,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CodeRecord {
    pub path: String,
    pub code_sha256: String,
    pub code_bytes: u64,
    pub build_sha256: String,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SuiteCli {
    pub executable: FileRecord,
    pub source_revision: String,
    pub source_tree_sha256: String,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct FileRecord {
    pub path: String,
    pub sha256: String,
    pub bytes: u64,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AssetTree {
    pub root: String,
    pub files: Vec<FileRecord>,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Product {
    pub id: String,
    pub source_revision: String,
    pub descriptor: FileRecord,
    pub executables: Vec<FileRecord>,
    pub notices: Vec<FileRecord>,
    #[serde(default)]
    pub resources: Vec<FileRecord>,
    #[serde(default)]
    pub runtime_env: BTreeMap<String, RuntimeBinding>,
    #[serde(default)]
    pub exports: Vec<OwnerExport>,
    #[serde(default)]
    pub provenance: Option<FileRecord>,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RuntimeBinding {
    pub kind: String,
    pub path: String,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OwnerExport {
    pub executable: FileRecord,
    pub receipt: FileRecord,
    pub source_input_sha256: String,
}
pub enum QualifiedRuntimeBinding {
    Executable(PathBuf),
    Cache(PathBuf),
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct HostMarker {
    source_dirty: bool,
    schema: String,
    source_revision: String,
    source_tree_sha256: String,
    executable_sha256: String,
    executable_code_sha256: String,
    executable_code_bytes: u64,
    shell_assets_sha256: String,
    expressions_assets_sha256: String,
    bootstrap: BTreeMap<String, String>,
    source_archive: HostSourceArchive,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct HostSourceArchive {
    archive: FileRecord,
    receipt: FileRecord,
}

/// Paths are entirely payload-relative. There is no PATH, checkout or managed
/// global resolution branch here, including for a product outside the profile.
pub struct QualifiedPayload {
    pub source_dirty: bool,
    pub product_ids: Vec<String>,
    pub shell_dist: PathBuf,
    pub expressions_dist: PathBuf,
    pub native_host: PathBuf,
    pub suite_cli: PathBuf,
    pub application_node: PathBuf,
    pub catalogue: PathBuf,
    pub product_executables: BTreeMap<String, Vec<PathBuf>>,
    pub product_runtime: BTreeMap<String, BTreeMap<String, QualifiedRuntimeBinding>>,
    pub source_revision: String,
    pub source_tree_sha256: String,
    pub backing_id: String,
}

fn asset_digest(assets: &AssetTree) -> Result<String, String> {
    let prefix = format!("{}/", assets.root);
    let mut records = Vec::new();
    for file in &assets.files {
        records.push(BTreeMap::from([
            (
                "path",
                serde_json::Value::from(
                    file.path
                        .strip_prefix(&prefix)
                        .ok_or("Foreign asset digest record")?,
                ),
            ),
            ("sha256", serde_json::Value::from(file.sha256.clone())),
            ("bytes", serde_json::Value::from(file.bytes)),
        ]));
    }
    records.sort_by(|a, b| a["path"].as_str().cmp(&b["path"].as_str()));
    Ok(format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&records).map_err(|e| e.to_string())?)
    ))
}

fn relative(raw: &str) -> Result<&Path, String> {
    let path = Path::new(raw);
    if raw.is_empty()
        || raw.contains('\\')
        || raw
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
        || path
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err(format!(
            "Payload path must be a contained relative path: {raw}"
        ));
    }
    Ok(path)
}
fn contained(root: &Path, raw: &str) -> Result<PathBuf, String> {
    let path = root
        .join(relative(raw)?)
        .canonicalize()
        .map_err(|e| format!("Missing payload path {raw}: {e}"))?;
    if !path.starts_with(root) {
        return Err(format!("Payload path escapes its root: {raw}"));
    }
    Ok(path)
}
fn hex(raw: &str, length: usize) -> bool {
    raw.len() == length
        && raw
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn qualify_file(root: &Path, file: &FileRecord) -> Result<PathBuf, String> {
    if !hex(&file.sha256, 64) {
        return Err(format!("Invalid payload digest for {}", file.path));
    }
    let path = contained(root, &file.path)?;
    let mut input = fs::File::open(&path).map_err(|e| e.to_string())?;
    let metadata = input.metadata().map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.len() != file.bytes {
        return Err(format!("Payload size/type mismatch: {}", file.path));
    }
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let count = input.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    if format!("{:x}", digest.finalize()) != file.sha256 {
        return Err(format!("Payload digest mismatch: {}", file.path));
    }
    Ok(path)
}
fn executable(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if fs::metadata(path)
            .map_err(|e| e.to_string())?
            .permissions()
            .mode()
            & 0o111
            == 0
        {
            return Err("Native payload binary is not executable".into());
        }
    }
    let mut header = [0u8; 4];
    fs::File::open(path)
        .map_err(|e| e.to_string())?
        .read_exact(&mut header)
        .map_err(|e| e.to_string())?;
    if ![
        [0xcf, 0xfa, 0xed, 0xfe],
        [0xce, 0xfa, 0xed, 0xfe],
        [0xfe, 0xed, 0xfa, 0xcf],
        [0xca, 0xfe, 0xba, 0xbe],
        [0xbe, 0xba, 0xfe, 0xca],
    ]
    .contains(&header)
    {
        return Err("Native payload executable is not Mach-O".into());
    }
    Ok(())
}
fn qualify_node(root: &Path, node: &NodeRuntime) -> Result<PathBuf, String> {
    let prefix = "Contents/Resources/live-shell/application-support/node-runtime/";
    if node.executable.path != format!("{prefix}bin/node")
        || node.provenance.path != format!("{prefix}provenance.json")
        || node.notices.is_empty()
        || node.resources.is_empty()
        || node.provenance.bytes > 16 * 1024 * 1024
    {
        return Err("Candidate requires its contained application Node support".into());
    }
    let owner_root = contained(root, prefix.trim_end_matches('/'))?;
    let mut expected = BTreeSet::new();
    for record in std::iter::once(&node.executable)
        .chain(node.resources.iter())
        .chain(node.notices.iter())
        .chain(std::iter::once(&node.provenance))
    {
        let path = qualify_file(root, record)?;
        if !record.path.starts_with(prefix)
            || !path.starts_with(&owner_root)
            || !expected.insert(path)
        {
            return Err("Duplicate or foreign application Node support file".into());
        }
    }
    fn inventory(directory: &Path, files: &mut BTreeSet<PathBuf>) -> Result<(), String> {
        for entry in fs::read_dir(directory).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            if kind.is_symlink() {
                return Err("Application Node support contains a symlink".into());
            }
            if kind.is_dir() {
                inventory(&entry.path(), files)?;
            } else if kind.is_file() {
                files.insert(entry.path());
            } else {
                return Err("Unsupported application Node support file type".into());
            }
        }
        Ok(())
    }
    let mut actual = BTreeSet::new();
    inventory(&owner_root, &mut actual)?;
    if actual != expected {
        return Err("Application Node support inventory differs".into());
    }
    let proof: serde_json::Value =
        unique_json(&fs::read(qualify_file(root, &node.provenance)?).map_err(|e| e.to_string())?)?;
    let input = &proof["input"];
    if proof["schema"] != "oi.live-shell-application-support-provenance/v1"
        || input["schema"] != "oi.live-shell-application-support-inputs/v1"
        || input["id"] != "node-runtime"
        || input["scope"] != "application-support"
        || input["runtime_env"]
            != serde_json::json!({"OI_NODE":{"kind":"executable","path":"bin/node"}})
        || input["provenance"]["official_origin"] != "https://nodejs.org/dist/"
    {
        return Err("Application Node support provenance differs".into());
    }
    let binary = qualify_file(root, &node.executable)?;
    executable(&binary)?;
    Ok(binary)
}

fn qualify_code(root: &Path, file: &CodeRecord) -> Result<PathBuf, String> {
    if !hex(&file.code_sha256, 64) || !hex(&file.build_sha256, 64) {
        return Err("Native code digest is malformed".into());
    }
    let path = contained(root, &file.path)?;
    if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 512 * 1024 * 1024 {
        return Err("Native host exceeds 512 MiB".into());
    }
    let mut data = fs::read(&path).map_err(|e| e.to_string())?;
    let u32_at = |data: &[u8], i: usize| -> Result<u32, String> {
        Ok(u32::from_le_bytes(
            data.get(i..i + 4)
                .ok_or("Truncated Mach-O")?
                .try_into()
                .map_err(|_| "Truncated Mach-O")?,
        ))
    };
    if data.len() < 32 || data[..4] != [0xcf, 0xfa, 0xed, 0xfe] || u32_at(&data, 4)? != 0x0100000c {
        return Err("Native host must be thin arm64 Mach-O".into());
    }
    let commands = u32_at(&data, 16)? as usize;
    let end = 32usize
        .checked_add(u32_at(&data, 20)? as usize)
        .ok_or("Malformed Mach-O size")?;
    if commands == 0 || commands > 4096 || end > data.len() {
        return Err("Malformed native Mach-O commands".into());
    }
    let mut offset = 32;
    let mut signature = None;
    let mut linkedit = false;
    for _ in 0..commands {
        if offset + 8 > end {
            return Err("Truncated native Mach-O command".into());
        }
        let kind = u32_at(&data, offset)?;
        let size = u32_at(&data, offset + 4)? as usize;
        if size < 8 || offset.checked_add(size).is_none_or(|v| v > end) {
            return Err("Malformed native Mach-O command size".into());
        }
        if kind == 0x1d {
            if size != 16 || signature.is_some() {
                return Err("Ambiguous native code signature".into());
            }
            signature = Some((
                u32_at(&data, offset + 8)? as usize,
                u32_at(&data, offset + 12)? as usize,
            ));
            data[offset + 8..offset + 16].fill(0);
        }
        if kind == 0x19
            && data
                .get(offset + 8..offset + 24)
                .is_some_and(|v| v == b"__LINKEDIT\0\0\0\0\0\0")
        {
            if size < 72 || linkedit {
                return Err("Ambiguous native linkedit segment".into());
            }
            linkedit = true;
            data[offset + 32..offset + 40].fill(0);
            data[offset + 48..offset + 56].fill(0);
        }
        offset += size;
    }
    let (code_bytes, signature_bytes) =
        signature.ok_or("Native host has no embedded linker signature")?;
    if offset != end
        || !linkedit
        || code_bytes < end
        || signature_bytes == 0
        || code_bytes.checked_add(signature_bytes) != Some(data.len())
        || code_bytes as u64 != file.code_bytes
        || format!("{:x}", Sha256::digest(&data[..code_bytes])) != file.code_sha256
    {
        return Err("Native canonical code byte/digest mismatch".into());
    }
    Ok(path)
}
fn tree(root: &Path, assets: &AssetTree) -> Result<PathBuf, String> {
    let directory = contained(root, &assets.root)?;
    if !directory.is_dir() || assets.files.is_empty() {
        return Err(format!("Missing asset tree {}", assets.root));
    }
    let mut expected = BTreeSet::new();
    for file in &assets.files {
        let path = qualify_file(root, file)?;
        if !path.starts_with(&directory) || !expected.insert(path) {
            return Err("Duplicate or foreign asset record".into());
        }
    }
    if !expected.contains(&directory.join("index.html")) {
        return Err("Asset tree has no qualified index.html".into());
    }
    fn visit(path: &Path, actual: &mut BTreeSet<PathBuf>) -> Result<(), String> {
        for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            if kind.is_symlink() {
                return Err("Asset trees cannot contain symlinks".into());
            }
            if kind.is_dir() {
                visit(&entry.path(), actual)?;
            } else if kind.is_file() {
                actual.insert(entry.path());
            } else {
                return Err("Asset trees contain an unsupported file type".into());
            }
        }
        Ok(())
    }
    let mut actual = BTreeSet::new();
    visit(&directory, &mut actual)?;
    if actual != expected {
        return Err(format!("Unmanifested or missing assets in {}", assets.root));
    }
    Ok(directory)
}

/// `footprint_json` is the bundle's native oi.desktop-footprint/v1 contract,
/// not a count-derived profile. Only its selected backing defines membership.
pub fn qualify(root: &Path, footprint_json: &[u8]) -> Result<QualifiedPayload, String> {
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    let manifest_path = root.join("Contents/Resources/SHELL-PAYLOAD.json");
    let size = fs::metadata(&manifest_path)
        .map_err(|e| e.to_string())?
        .len();
    if size > 16 * 1024 * 1024 {
        return Err("Shell payload manifest exceeds 16 MiB".into());
    }
    let payload: Payload = unique_json(&fs::read(manifest_path).map_err(|e| e.to_string())?)?;
    if payload.schema != PAYLOAD_SCHEMA
        || !hex(&payload.source_revision, 40)
        || !hex(&payload.source_tree_sha256, 64)
        || payload.backing_id.is_empty()
        || !payload
            .backing_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"/_-".contains(&b))
    {
        return Err("Shell payload requires exact source revision and source-tree digest".into());
    }
    let footprint: serde_json::Value = unique_json(footprint_json)?;
    let footprint_path = qualify_file(&root, &payload.footprint)?;
    if fs::read(&footprint_path).map_err(|e| e.to_string())? != footprint_json {
        return Err("Native footprint differs from payload".into());
    }
    let catalogue = qualify_file(&root, &payload.catalogue)?;
    let catalogue_document: serde_json::Value =
        unique_json(&fs::read(&catalogue).map_err(|e| e.to_string())?)?;
    if catalogue_document["schema"] != 1 {
        return Err("Native catalogue schema mismatch".into());
    }
    if footprint["schema"] != "oi.desktop-footprint/v1" {
        return Err("Unsupported native footprint".into());
    }
    let selected = footprint["backing"]["options"][&payload.backing_id]["products"]
        .as_array()
        .ok_or("Backing is not offered by the native footprint")?;
    let expected: BTreeSet<String> = selected
        .iter()
        .map(|v| {
            v.as_str()
                .map(str::to_owned)
                .ok_or("Invalid native backing product")
        })
        .collect::<Result<_, _>>()?;
    let supplied: BTreeSet<String> = payload.product_ids.iter().cloned().collect();
    let native_ids = BTreeSet::from([
        "central".to_owned(),
        "actuation".to_owned(),
        "ai-kit".to_owned(),
        "software-factory".to_owned(),
        "workcell".to_owned(),
        "quaternal-logic".to_owned(),
    ]);
    if expected.len() != selected.len()
        || expected != supplied
        || supplied.len() != payload.product_ids.len()
        || !expected.is_subset(&native_ids)
    {
        return Err("Payload products differ from native backing".into());
    }
    let native_host = qualify_code(&root, &payload.host.executable)?;
    for resource in &payload.host.resources {
        qualify_file(&root, resource)?;
    }
    if !hex(&payload.host.suite_cli.source_revision, 40)
        || !hex(&payload.host.suite_cli.source_tree_sha256, 64)
    {
        return Err("Suite CLI lacks independent source provenance".into());
    }
    let application_node = qualify_node(&root, &payload.node_runtime)?;
    let suite_cli = qualify_file(&root, &payload.host.suite_cli.executable)?;
    executable(&suite_cli)?;
    let marker_path = qualify_file(&root, &payload.host.marker)?;
    if payload.host.marker.bytes > 65536 {
        return Err("Native host marker exceeds 64 KiB".into());
    }
    let marker: HostMarker = unique_json(&fs::read(marker_path).map_err(|e| e.to_string())?)?;
    let bootstrap = BTreeMap::from([
        ("shell_entry".into(), "/app/index.html".into()),
        (
            "expressions_entry".into(),
            "/__application/expressions/index.html".into(),
        ),
        ("transport".into(), "tauri-kernel".into()),
        ("configuration".into(), "native-owner-discovery".into()),
        ("product_resolution".into(), "payload-only".into()),
    ]);
    if marker.schema != HOST_SCHEMA
        || marker.source_revision != payload.source_revision
        || marker.source_tree_sha256 != payload.source_tree_sha256
        || marker.source_dirty != payload.source_dirty
        || marker.executable_sha256 != payload.host.executable.build_sha256
        || marker.executable_code_sha256 != payload.host.executable.code_sha256
        || marker.executable_code_bytes != payload.host.executable.code_bytes
        || marker.shell_assets_sha256 != asset_digest(&payload.shell)?
        || marker.expressions_assets_sha256 != asset_digest(&payload.expressions)?
        || marker.bootstrap != bootstrap
    {
        return Err("Native host marker does not qualify this candidate bootstrap".into());
    }
    for (record, expected_path) in [
        (
            &marker.source_archive.archive,
            "Contents/Resources/live-shell-sources/sources.tar.gz",
        ),
        (
            &marker.source_archive.receipt,
            "Contents/Resources/live-shell-sources/receipt.json",
        ),
    ] {
        if record.path != expected_path
            || !payload.host.resources.iter().any(|resource| {
                resource.path == record.path
                    && resource.sha256 == record.sha256
                    && resource.bytes == record.bytes
            })
        {
            return Err(
                "Native source archive is not bound to the qualified host resources".into(),
            );
        }
    }
    if marker.source_archive.receipt.bytes > 65536 {
        return Err("Native source archive receipt exceeds 64 KiB".into());
    }
    let source_receipt: serde_json::Value = unique_json(
        &fs::read(contained(&root, &marker.source_archive.receipt.path)?)
            .map_err(|e| e.to_string())?,
    )?;
    if source_receipt["schema"] != "oi.build-source-archive/v1"
        || source_receipt["source_revision"] != marker.source_revision
        || source_receipt["source_dirty"] != marker.source_dirty
        || source_receipt["phase_tree_sha256"]["broad-staging"] != marker.source_tree_sha256
        || source_receipt["phase_tree_sha256"]["suite-normal-build"]
            != payload.host.suite_cli.source_tree_sha256
        || source_receipt["archive"]["sha256"] != marker.source_archive.archive.sha256
        || source_receipt["archive"]["size_bytes"] != marker.source_archive.archive.bytes
    {
        return Err("Native source archive receipt differs from the executing build basis".into());
    }
    let mut products = BTreeMap::new();
    let mut product_runtime = BTreeMap::new();
    let products_root = contained(&root, &payload.products_root)?;
    for product in &payload.products {
        if !expected.contains(&product.id)
            || products.contains_key(&product.id)
            || !hex(&product.source_revision, 40)
            || product.executables.is_empty()
        {
            return Err("Duplicate, excluded or unqualified native product".into());
        }
        let descriptor_path = qualify_file(&root, &product.descriptor)?;
        if product.descriptor.bytes > 16 * 1024 * 1024 {
            return Err("Native product descriptor exceeds 16 MiB".into());
        }
        let descriptor: serde_json::Value =
            unique_json(&fs::read(&descriptor_path).map_err(|e| e.to_string())?)?;
        if descriptor["schema"] != "oi.product-lifecycle/v1" || descriptor["id"] != product.id {
            return Err("Product descriptor identity mismatch".into());
        }
        let binaries = product
            .executables
            .iter()
            .map(|f| qualify_file(&root, f))
            .collect::<Result<Vec<_>, _>>()?;
        let names = binaries
            .iter()
            .map(|p| p.file_name().ok_or("Native binary has no filename"))
            .collect::<Result<BTreeSet<_>, _>>()?;
        if names.len() != binaries.len() {
            return Err("Duplicate native product executable".into());
        }
        let mut exports = BTreeSet::new();
        for export in &product.exports {
            let binary = qualify_file(&root, &export.executable)?;
            let receipt_path = qualify_file(&root, &export.receipt)?;
            if product.id != "quaternal-logic"
                || binary.file_name().is_none_or(|name| name != "ql-sky")
                || !binaries.contains(&binary)
                || !exports.insert(binary.clone())
                || !hex(&export.source_input_sha256, 64)
                || export.receipt.bytes > 16 * 1024 * 1024
                || !product.resources.iter().any(|r| {
                    r.path == export.receipt.path
                        && r.sha256 == export.receipt.sha256
                        && r.bytes == export.receipt.bytes
                })
            {
                return Err("Unqualified native owner executable export".into());
            }
            let receipt: serde_json::Value =
                unique_json(&fs::read(receipt_path).map_err(|e| e.to_string())?)?;
            if receipt["schema"] != "ql.sky-command-export/v1"
                || receipt.get("installed_uv_fallback") != Some(&serde_json::Value::Null)
                || receipt["artifact"]["kind"] != "shell-script"
                || receipt["artifact"]["interpreter"] != "/bin/sh"
                || receipt["artifact"]["sha256"] != export.executable.sha256
                || receipt["artifact"]["size_bytes"] != export.executable.bytes
                || receipt["source_input_sha256"] != export.source_input_sha256
                || !receipt["source_revision"]
                    .as_str()
                    .is_some_and(|s| hex(s, 40))
                || !fs::read(&binary)
                    .map_err(|e| e.to_string())?
                    .starts_with(b"#!/bin/sh\n")
            {
                return Err("Native QL sky export differs from its bundled owner receipt".into());
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if fs::metadata(&binary)
                    .map_err(|e| e.to_string())?
                    .permissions()
                    .mode()
                    & 0o111
                    == 0
                {
                    return Err("Native owner export is not executable".into());
                }
            }
        }
        for binary in &binaries {
            if !exports.contains(binary) {
                executable(binary)?;
            }
        }
        let native_surface = catalogue_document["surfaces"]
            .as_array()
            .and_then(|s| s.iter().find(|s| s["id"] == product.id))
            .ok_or("Native catalogue has no selected owner")?;
        if let Some(companions) =
            native_surface["native"]["source_install"]["companions"].as_array()
        {
            for companion in companions {
                let name = companion["executable"]
                    .as_str()
                    .ok_or("Malformed native companion")?;
                if !names.iter().any(|n| n.to_str() == Some(name)) {
                    return Err("Native owner-declared companion is absent".into());
                }
            }
        }
        let entry = descriptor["artifact"]["entry"]
            .as_str()
            .and_then(|p| Path::new(p).file_name())
            .ok_or("Product descriptor has no native entry")?;
        if !binaries.iter().any(|p| p.file_name() == Some(entry)) {
            return Err("Product native entry is absent".into());
        }
        let owner_root = products_root
            .join(&product.id)
            .canonicalize()
            .map_err(|e| e.to_string())?;
        if !descriptor_path.starts_with(&owner_root)
            || binaries.iter().any(|path| !path.starts_with(&owner_root))
            || product.notices.is_empty()
        {
            return Err(
                "Product files must retain their native owner directory and notices".into(),
            );
        }
        for notice in &product.notices {
            if !qualify_file(&root, notice)?.starts_with(&owner_root) {
                return Err("Foreign product notice".into());
            }
        }
        let mut resources = BTreeSet::new();
        for resource in &product.resources {
            let path = qualify_file(&root, resource)?;
            if !path.starts_with(&owner_root) || !resources.insert(path) {
                return Err("Duplicate or foreign native product resource".into());
            }
        }
        let mut runtime = BTreeMap::new();
        let allowed = BTreeSet::from(["QL_SKY_PYTHON", "QL_NARA_PYTHON", "QL_NARA_PROVIDER_CACHE"]);
        if product.id == "quaternal-logic" {
            if product
                .runtime_env
                .keys()
                .map(String::as_str)
                .collect::<BTreeSet<_>>()
                != allowed
                || exports.len() != 1
                || product.provenance.is_none()
            {
                return Err("QL payload requires its actual exported companion and explicit runtime bindings".into());
            }
        } else if !product.runtime_env.is_empty() || !product.exports.is_empty() {
            return Err("Runtime environment is not declared by this native owner".into());
        }
        for (name, value) in &product.runtime_env {
            let path = relative(&value.path)?;
            let qualified = if name == "QL_NARA_PROVIDER_CACHE" && value.kind == "cache" {
                QualifiedRuntimeBinding::Cache(path.to_path_buf())
            } else if name != "QL_NARA_PROVIDER_CACHE" && value.kind == "executable" {
                let path = owner_root
                    .join(path)
                    .canonicalize()
                    .map_err(|e| e.to_string())?;
                if !resources.contains(&path) {
                    return Err(
                        "Native runtime executable must be a declared owner resource".into(),
                    );
                }
                executable(&path)?;
                QualifiedRuntimeBinding::Executable(path)
            } else {
                return Err("Native runtime binding kind mismatch".into());
            };
            runtime.insert(name.clone(), qualified);
        }
        fn inventory(directory: &Path, files: &mut BTreeSet<PathBuf>) -> Result<(), String> {
            for entry in fs::read_dir(directory).map_err(|e| e.to_string())? {
                let entry = entry.map_err(|e| e.to_string())?;
                let kind = entry.file_type().map_err(|e| e.to_string())?;
                if kind.is_symlink() {
                    return Err("Native product payload cannot contain symlinks".into());
                }
                if kind.is_dir() {
                    inventory(&entry.path(), files)?;
                } else if kind.is_file() {
                    files.insert(entry.path());
                } else {
                    return Err("Unsupported native product payload type".into());
                }
            }
            Ok(())
        }
        let mut actual_files = BTreeSet::new();
        inventory(&owner_root, &mut actual_files)?;
        let mut expected_files = BTreeSet::from([descriptor_path]);
        expected_files.extend(binaries.iter().cloned());
        for notice in &product.notices {
            expected_files.insert(qualify_file(&root, notice)?);
        }
        for path in resources {
            if !expected_files.insert(path) {
                return Err("Native product resource replaces an owned payload file".into());
            }
        }
        if let Some(record) = &product.provenance {
            let path = qualify_file(&root, record)?;
            if !path.starts_with(&owner_root)
                || !expected_files.insert(path.clone())
                || record.bytes > 16 * 1024 * 1024
            {
                return Err("Native product provenance is not contained".into());
            }
            let provenance: serde_json::Value =
                unique_json(&fs::read(path).map_err(|e| e.to_string())?)?;
            if provenance["schema"] != "oi.live-shell-product-provenance/v1"
                || provenance["input"]["id"] != product.id
                || provenance["input"]["source_revision"] != product.source_revision
            {
                return Err("Native product provenance owner mismatch".into());
            }
        }
        if actual_files != expected_files {
            return Err("Unmanifested or missing native product files".into());
        }
        products.insert(product.id.clone(), binaries);
        product_runtime.insert(product.id.clone(), runtime);
    }
    if products.keys().cloned().collect::<BTreeSet<_>>() != expected {
        return Err("Native product payload is incomplete".into());
    }
    // The directory inventory itself must exclude products outside this profile.
    let on_disk: BTreeSet<String> = if products_root.is_dir() {
        fs::read_dir(products_root)
            .map_err(|e| e.to_string())?
            .map(|e| {
                e.map_err(|e| e.to_string()).and_then(|e| {
                    e.file_name()
                        .into_string()
                        .map_err(|_| "Non-UTF8 product directory".into())
                })
            })
            .collect::<Result<_, _>>()?
    } else {
        BTreeSet::new()
    };
    if on_disk != expected {
        return Err("On-disk native products differ from selected backing".into());
    }
    if payload.notices.is_empty() {
        return Err("Candidate third-party notices are absent".into());
    }
    for notice in &payload.notices {
        qualify_file(&root, notice)?;
    }
    let mut provenance = BTreeSet::new();
    for record in &payload.provenance {
        let path = qualify_file(&root, record)?;
        if !record
            .path
            .starts_with("Contents/Resources/live-shell/provenance/")
            || !provenance.insert(path)
        {
            return Err("Duplicate or foreign frozen suite provenance".into());
        }
    }
    Ok(QualifiedPayload {
        source_dirty: payload.source_dirty,
        product_ids: payload.product_ids,
        shell_dist: tree(&root, &payload.shell)?,
        expressions_dist: tree(&root, &payload.expressions)?,
        native_host,
        suite_cli,
        application_node,
        catalogue,
        product_executables: products,
        product_runtime,
        source_revision: payload.source_revision,
        source_tree_sha256: payload.source_tree_sha256,
        backing_id: payload.backing_id,
    })
}
