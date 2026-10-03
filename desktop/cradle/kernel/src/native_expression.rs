//! One explicitly opened QL material owner behind the normal kernel seam.
//! No UI-supplied executable, model, numerical approximation, source write or
//! automatic restart. The native host validates domain inputs and acknowledgments.
use crate::{files, CentralClient};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Read, Write},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[path = "native_expression_procedural.rs"]
pub mod procedural;
#[path = "native_expression_selected_scene.rs"]
pub mod selected_scene;

const MAX_REQUEST: usize = 32 * 1024 * 1024;
const MAX_REPLY: usize = 64 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    RetainSelectedSceneSource {
        request: selected_scene::source::Request,
    },
    RecoverSelectedSceneSource {
        request: selected_scene::source::Request,
    },
    OpenSelectedScene {
        request: selected_scene::Request,
    },
    RecoverSelectedScene {
        request: selected_scene::Request,
    },
    AbandonSelectedScene {
        request: selected_scene::Request,
    },
    ProceduralCompile {
        request: procedural::CompileRequest,
    },
    ProceduralConduct {
        request: procedural::conduct::Request,
    },
    ProceduralSourceBootstrapRetry {
        request: procedural::bootstrap::RetryRequest,
    },
    Open {
        path: String,
        expected_revision: String,
    },
    Exchange {
        lease: String,
        request: Value,
    },
    Close {
        lease: String,
    },
    /// Ask QL to compose a K² binding from a bounded consumer request, then
    /// open it exactly as `Open` does. The request never names a program.
    Compose {
        request: Value,
    },
    PrepareWorld {
        request: Value,
    },
}

/// A rendering binding, not a new domain record. Native config goes unchanged
/// to QL. Correspondence and scale are explicit presentation choices.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Binding {
    schema: String,
    host: Value,
    presentation: Value,
}

#[derive(Debug, Default)]
pub struct Manager {
    active: Option<Owner>,
    sequence: u64,
    composed: u64,
    procedural_manual_completion: Option<procedural::manual::Completed>,
    selected_scene_opening: Option<selected_scene::SelectedOpening>,
}

#[derive(Debug)]
struct Owner {
    lease: String,
    // C30: registered by this actual Manager opening; distinct from source and
    // geometry generations. This is no new clock.
    native_field_epoch: String,
    child: Child,
    tx: Option<mpsc::SyncSender<Value>>,
    rx: mpsc::Receiver<Result<Value, String>>,
    reader: Option<thread::JoinHandle<()>>,
    stderr_reader: Option<thread::JoinHandle<()>>,
    stderr: Arc<Mutex<Vec<u8>>>,
    config_path: PathBuf,
    identity: Value,
    procedural_source: Value,
    procedural_position: Value,
    procedural_executable: PathBuf,
    procedural_worker: PathBuf,
    procedural_definitions: BTreeMap<String, Value>,
    procedural_checkpoints: BTreeMap<String, std::collections::BTreeSet<String>>,
    last_request_id: u64,
    stopped: bool,
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    act_channel: Option<native_act_channel::ActChannel>,
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    act_channel_unavailable: Option<String>,
}

fn nonempty(s: &str) -> bool {
    !s.is_empty() && s.len() <= 4096 && !s.contains('\0')
}
fn cursor(v: &Value) -> Result<u64, String> {
    let s = v
        .as_str()
        .ok_or("native cursor must be an exact decimal string")?;
    let n: u64 = s.parse().map_err(|_| "invalid native cursor")?;
    if n.to_string() != s {
        return Err("noncanonical native cursor".into());
    }
    Ok(n)
}
fn line(reader: &mut impl BufRead) -> Result<Value, String> {
    let mut bytes = Vec::new();
    loop {
        let available = reader.fill_buf().map_err(|e| e.to_string())?;
        if available.is_empty() {
            return Err("native host closed before acknowledgement".into());
        }
        let newline = available.iter().position(|b| *b == b'\n');
        let count = newline.map_or(available.len(), |i| i + 1);
        if bytes.len() + count > MAX_REPLY {
            return Err("native host reply exceeds 64 MiB".into());
        }
        bytes.extend_from_slice(&available[..count]);
        reader.consume(count);
        if newline.is_some() {
            return serde_json::from_slice(&bytes)
                .map_err(|e| format!("malformed native acknowledgement: {e}"));
        }
    }
}
fn presentation(value: &Value) -> Result<(), String> {
    let obj = value
        .as_object()
        .ok_or("presentation binding must be an object")?;
    if obj.len() != 3
        || !obj.contains_key("units_per_metre")
        || !obj.contains_key("slots_a")
        || !obj.contains_key("slots_b")
    {
        return Err("presentation requires exactly units_per_metre, slots_a, slots_b".into());
    }
    let scale = value["units_per_metre"]
        .as_f64()
        .ok_or("presentation scale required")?;
    if !scale.is_finite() || scale <= 0.0 || scale > 1_000_000.0 {
        return Err("presentation scale must be in (0, 1000000]".into());
    }
    let a = value["slots_a"]
        .as_array()
        .ok_or("explicit slots_a required")?;
    let b = value["slots_b"]
        .as_array()
        .ok_or("explicit slots_b required")?;
    if a.is_empty()
        || a.len() > 1_048_576
        || a.len() != b.len()
        || a.iter()
            .chain(b)
            .any(|v| v.as_u64().filter(|x| *x < 1_048_576).is_none())
    {
        return Err("invalid or incomplete presentation correspondence".into());
    }
    Ok(())
}

/// The host/worker pair. The operator override names both, absolutely, or
/// neither; otherwise the installed suite answers where QL's companions sit
/// (one content-addressed cut, so the pair cannot mix revisions).
fn native_executables() -> Result<(PathBuf, PathBuf), String> {
    let var = |key| std::env::var_os(key).filter(|value| !value.is_empty());
    match (var("OI_QL_FIELD_HOST_BIN"), var("OI_QL_FIELD_WORKER_BIN")) {
        (Some(host), Some(worker)) => {
            let (host, worker) = (PathBuf::from(host), PathBuf::from(worker));
            if !host.is_absolute() || !worker.is_absolute() {
                return Err("native executable bindings must be absolute installed paths".into());
            }
            Ok((host, worker))
        }
        (None, None) => {
            let mut pair = InstalledQl::discover()?.require(&["ql-field-host", "ql-field-worker"])?;
            let worker = pair.pop().expect("two companions required");
            let host = pair.pop().expect("two companions required");
            Ok((host, worker))
        }
        _ => Err("native-expression.unavailable: OI_QL_FIELD_HOST_BIN and OI_QL_FIELD_WORKER_BIN override together; set both or neither".into()),
    }
}

/// Where the installed suite says QL is: the product executable and every
/// companion its catalogue declares, each an absolute installed path or the
/// named reason it is not usable. Only installed configuration answers this;
/// a binding or the webview never does.
#[derive(Clone, Debug, PartialEq)]
pub struct InstalledQl {
    pub executable: Result<PathBuf, String>,
    pub companions: BTreeMap<String, Result<PathBuf, String>>,
    /// The suite's own revision reading, carried as provenance only.
    pub revision: Option<String>,
}

impl InstalledQl {
    /// Ask the installed suite (`$OI_BIN`, else `oi`), bounded.
    pub fn discover() -> Result<Self, String> {
        Self::parse(&installed_where()?)
    }

    /// Read an `oi.product-location/v1` reading. A primary is usable when it
    /// is absolute and the suite digested it; a companion when it is
    /// absolute and reported present.
    pub fn parse(reading: &[u8]) -> Result<Self, String> {
        let reading: Value = serde_json::from_slice(reading).map_err(|e| {
            format!(
                "native-expression.unavailable: `oi where quaternal-logic --json` is not JSON: {e}"
            )
        })?;
        if reading["schema"] != "oi.product-location/v1" {
            return Err("native-expression.unavailable: `oi where quaternal-logic --json` is not an oi.product-location/v1 reading".into());
        }
        let absolute = |name: &str, path: Option<&str>| match path.filter(|path| nonempty(path)) {
            None => Err(format!("{name} has no executable path")),
            Some(path) if !PathBuf::from(path).is_absolute() => {
                Err(format!("{name} path {path} is not absolute"))
            }
            Some(path) => Ok(PathBuf::from(path)),
        };
        let executable =
            absolute("quaternal-logic", reading["executable"].as_str()).and_then(|path| {
                if reading["sha256"].is_string() {
                    Ok(path)
                } else {
                    Err(format!(
                        "quaternal-logic is not installed at {}",
                        path.display()
                    ))
                }
            });
        let mut companions = BTreeMap::new();
        for (name, entry) in reading["companions"].as_object().into_iter().flatten() {
            let resolved = absolute(name, entry["executable"].as_str()).and_then(|path| {
                if entry["present"] == true {
                    Ok(path)
                } else {
                    Err(format!(
                        "{name} is not installed at {} (oi update --apply --rebuild quaternal-logic)",
                        path.display()
                    ))
                }
            });
            companions.insert(name.clone(), resolved);
        }
        Ok(Self {
            executable,
            companions,
            revision: reading["revision"]
                .as_str()
                .filter(|r| nonempty(r))
                .map(str::to_owned),
        })
    }

    /// The installed `ql` itself.
    pub fn executable(&self) -> Result<PathBuf, String> {
        self.executable
            .clone()
            .map_err(|why| format!("native-expression.unavailable: {why}"))
    }

    /// One named companion.
    pub fn companion(&self, name: &str) -> Result<PathBuf, String> {
        self.require(&[name]).map(|mut paths| paths.remove(0))
    }

    /// Every named companion in order, or one error naming each shortfall.
    pub fn require(&self, names: &[&str]) -> Result<Vec<PathBuf>, String> {
        let mut paths = Vec::with_capacity(names.len());
        let mut missing = Vec::new();
        for name in names {
            match self.companions.get(*name) {
                Some(Ok(path)) => paths.push(path.clone()),
                Some(Err(why)) => missing.push(why.clone()),
                None => missing.push(format!(
                    "installed quaternal-logic declares no {name} (update O:I and QL: oi update --apply quaternal-logic)"
                )),
            }
        }
        if missing.is_empty() {
            Ok(paths)
        } else {
            Err(format!(
                "native-expression.unavailable: {}",
                missing.join("; ")
            ))
        }
    }
}

const WHERE_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_WHERE: usize = 1024 * 1024;

/// `oi where quaternal-logic --json`, bounded: a suite that does not answer
/// within the budget is unavailable, never waited on.
fn installed_where() -> Result<Vec<u8>, String> {
    run_where(oi_executable().as_os_str(), WHERE_TIMEOUT)
}

/// The suite executable for kernel `oi` calls: `$OI_BIN`, else `oi` on PATH,
/// else the managed activation link `~/.local/bin/oi` (the O:I update flow's
/// activation directory). A Finder/Dock-launched app inherits launchd's
/// minimal PATH, which never holds the activation directory.
pub fn oi_executable() -> PathBuf {
    resolve_oi(
        std::env::var_os("OI_BIN"),
        std::env::var_os("PATH"),
        std::env::var_os("HOME"),
    )
}

fn resolve_oi(
    oi_bin: Option<std::ffi::OsString>,
    path: Option<std::ffi::OsString>,
    home: Option<std::ffi::OsString>,
) -> PathBuf {
    if let Some(bin) = oi_bin.filter(|v| !v.is_empty()) {
        return PathBuf::from(bin);
    }
    let runnable = |candidate: &std::path::Path| {
        fs::metadata(candidate).is_ok_and(|meta| {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                meta.is_file() && meta.permissions().mode() & 0o111 != 0
            }
            #[cfg(not(unix))]
            {
                meta.is_file()
            }
        })
    };
    let on_path = path
        .as_deref()
        .map(std::env::split_paths)
        .into_iter()
        .flatten()
        .any(|dir| dir.is_absolute() && runnable(&dir.join("oi")));
    if !on_path {
        if let Some(home) = home.filter(|h| !h.is_empty()).map(PathBuf::from) {
            let managed = home.join(".local/bin/oi");
            if home.is_absolute() && runnable(&managed) {
                return managed;
            }
        }
    }
    PathBuf::from("oi")
}

fn run_where(oi: &std::ffi::OsStr, timeout: Duration) -> Result<Vec<u8>, String> {
    let unavailable = |why: String| {
        format!(
            "native-expression.unavailable: `{} where quaternal-logic --json` {why}",
            PathBuf::from(oi).display()
        )
    };
    let ran = run_bounded(
        oi,
        &[
            "where".as_ref(),
            "quaternal-logic".as_ref(),
            "--json".as_ref(),
        ],
        timeout,
        MAX_WHERE,
    )
    .map_err(|e| unavailable(e.describe(timeout, MAX_WHERE)))?;
    if !ran.status.success() {
        return Err(unavailable(format!("exited {}", ran.status)));
    }
    Ok(ran.stdout)
}

#[derive(Debug)]
struct Ran {
    status: std::process::ExitStatus,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

#[derive(Debug)]
enum RunError {
    Start(std::io::Error),
    Timeout,
    HeldOpen,
    Overflow,
    Io(String),
}
impl RunError {
    fn describe(&self, timeout: Duration, limit: usize) -> String {
        match self {
            Self::Start(e) => format!("cannot start: {e}"),
            Self::Timeout => format!("did not answer within {}ms", timeout.as_millis()),
            Self::HeldOpen => "held its output open".into(),
            Self::Overflow => format!("output exceeds {limit} bytes"),
            Self::Io(e) => format!("output unreadable: {e}"),
        }
    }
}

const MAX_DIAGNOSTIC: usize = 64 * 1024;

/// One argument-vector child in its own process group, bounded in time and
/// output. Timeout or overflow kills the whole group: companions such as
/// `ql-sky` provision through `uv`, whose descendants would outlive a parent kill.
fn run_bounded(
    program: &std::ffi::OsStr,
    args: &[&std::ffi::OsStr],
    timeout: Duration,
    max_stdout: usize,
) -> Result<Ran, RunError> {
    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command.spawn().map_err(RunError::Start)?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let (out_tx, out_rx) = mpsc::channel();
    let limit = max_stdout as u64 + 1;
    thread::spawn(move || {
        let mut bytes = Vec::new();
        let read = match stdout {
            Some(mut pipe) => (&mut pipe)
                .take(limit)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string()),
            None => Err("no stdout".into()),
        };
        let _ = out_tx.send(read.map(|_| bytes));
    });
    let (err_tx, err_rx) = mpsc::channel();
    thread::spawn(move || {
        let mut kept = Vec::new();
        if let Some(mut pipe) = stderr {
            let mut chunk = [0; 4096];
            while let Ok(n) = pipe.read(&mut chunk) {
                if n == 0 {
                    break;
                }
                let room = MAX_DIAGNOSTIC.saturating_sub(kept.len()).min(n);
                kept.extend_from_slice(&chunk[..room]);
            }
        }
        let _ = err_tx.send(kept);
    });
    let kill = |child: &mut Child| {
        #[cfg(unix)]
        if let Ok(pid) = i32::try_from(child.id()) {
            if pid > 0 {
                // This group was created for this call alone.
                unsafe {
                    libc::kill(-pid, libc::SIGKILL);
                }
            }
        }
        let _ = child.kill();
        let _ = child.wait();
    };
    let deadline = std::time::Instant::now() + timeout;
    let (mut exited, mut output) = (false, None);
    loop {
        if output.is_none() {
            match out_rx.try_recv() {
                Ok(Ok(bytes)) if bytes.len() > max_stdout => {
                    kill(&mut child);
                    return Err(RunError::Overflow);
                }
                Ok(Ok(bytes)) => output = Some(bytes),
                Ok(Err(e)) => {
                    kill(&mut child);
                    return Err(RunError::Io(e));
                }
                Err(mpsc::TryRecvError::Empty) => {}
                Err(mpsc::TryRecvError::Disconnected) => {
                    kill(&mut child);
                    return Err(RunError::Io("stdout reader lost".into()));
                }
            }
        }
        if !exited {
            match crate::native_process::child_exited_without_reaping(&child) {
                Ok(done) => exited = done,
                Err(e) => {
                    kill(&mut child);
                    return Err(RunError::Io(e.to_string()));
                }
            }
        }
        if exited && output.is_some() {
            // Stop the owned group before the first reap, including descendants
            // that inherited stderr after the leader finished its command.
            #[cfg(unix)]
            unsafe {
                libc::kill(-(child.id() as libc::pid_t), libc::SIGKILL);
            }
            let status = child
                .wait()
                .map_err(|error| RunError::Io(error.to_string()))?;
            let stdout = output.take().unwrap_or_default();
            let stderr = err_rx
                .recv_timeout(Duration::from_millis(200))
                .unwrap_or_default();
            return Ok(Ran {
                status,
                stdout,
                stderr,
            });
        }
        if std::time::Instant::now() >= deadline {
            let held = exited;
            kill(&mut child);
            return Err(if held {
                RunError::HeldOpen
            } else {
                RunError::Timeout
            });
        }
        thread::sleep(Duration::from_millis(10));
    }
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
#[path = "native_expression_act_channel.rs"]
mod native_act_channel;
#[path = "native_expression_procedural_scene_source.rs"]
pub(crate) mod native_scene_source;

impl Owner {
    fn process_exited(&self) -> Result<bool, String> {
        crate::native_process::child_exited_without_reaping(&self.child)
            .map_err(|error| error.to_string())
    }

    fn stop(&mut self) {
        if self.stopped {
            return;
        }
        self.stopped = true;
        self.tx.take();
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        self.act_channel.take();
        // QL's worker inherits the dedicated process group. Killing only its
        // parent can leave inherited pipes open and block the reader joins.
        // This group was created by this manager; no foreign service is named.
        #[cfg(unix)]
        {
            unsafe extern "C" {
                fn kill(pid: i32, signal: i32) -> i32;
            }
            if let Ok(pid) = i32::try_from(self.child.id()) {
                if pid > 0 {
                    unsafe {
                        kill(-pid, 9);
                    }
                }
            }
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(handle) = self.reader.take() {
            let _ = handle.join();
        }
        if let Some(handle) = self.stderr_reader.take() {
            let _ = handle.join();
        }
        let _ = fs::remove_file(&self.config_path);
    }
    fn diagnostic(&self) -> String {
        String::from_utf8_lossy(&self.stderr.lock().unwrap_or_else(|e| e.into_inner())).into_owned()
    }
    fn receive(&self) -> Result<Value, String> {
        self.rx.recv_timeout(TIMEOUT).map_err(|_| {
            "native acknowledgement timed out; state unknown; explicit close/reopen required"
                .to_string()
        })?
    }
}
impl Drop for Owner {
    fn drop(&mut self) {
        self.stop();
    }
}

impl Manager {
    pub fn apply(&mut self, client: &CentralClient, request: Request) -> Result<Value, String> {
        match request {
            Request::RetainSelectedSceneSource { .. }
            | Request::RecoverSelectedSceneSource { .. }
            | Request::OpenSelectedScene { .. }
            | Request::RecoverSelectedScene { .. }
            | Request::AbandonSelectedScene { .. } => Err(
                "Selected-Scene opening/recovery requires its actual native Kernel Document owner"
                    .into(),
            ),
            Request::ProceduralCompile { request } => procedural::Prepared::new(request)?
                .execute()
                .map(|completed| completed.response),
            Request::ProceduralConduct { .. } => {
                Err("Procedural conduct requires the current native Kernel source intake".into())
            }
            Request::ProceduralSourceBootstrapRetry { .. } => Err(
                "Bootstrap retry requires its same live native Kernel Document transaction".into(),
            ),
            Request::Open {
                path,
                expected_revision,
            } => {
                self.busy()?;
                if !nonempty(&path) || !nonempty(&expected_revision) {
                    return Err("explicit source path and revision required".into());
                }
                // Native Central names its root with the empty relative path.
                // Keep every binding address relative; do not reinterpret an
                // absolute address as a binding in the selected World.
                if !std::path::Path::new(&path)
                    .components()
                    .all(|part| matches!(part, std::path::Component::Normal(_)))
                {
                    return Err("binding source requires a relative Central path".into());
                }
                let (parent, name) = path.rsplit_once('/').unwrap_or(("", &path));
                let dir = files::list(client, parent)?;
                let entry = dir
                    .entries
                    .iter()
                    .find(|e| e.name == name && e.retrieval_allowed)
                    .ok_or("binding source unavailable or withheld by Central")?;
                let reading = files::read(client, &entry.location)?;
                if reading.revision != expected_revision {
                    return Err("native-expression.source_stale: reread before opening".into());
                }
                self.open(
                    &reading.content,
                    json!({"location":reading.location,"revision":reading.revision}),
                )
            }
            Request::Exchange { lease, request } => {
                let owner = self
                    .active
                    .as_mut()
                    .ok_or("native-expression.unavailable: no active owner")?;
                if lease != owner.lease {
                    return Err("native-expression.foreign_lease".into());
                }
                if request["schema"] != "ql.field-host-request/v1" || !exchange_admits(&request) {
                    return Err("unsupported native host request".into());
                }
                for key in ["instance_ref", "event_ref", "subject_ref"] {
                    if request[key] != owner.identity[key] {
                        return Err(format!("native-expression.foreign_{key}"));
                    }
                }
                let id = cursor(&request["request_id"])?;
                if Some(id) != owner.last_request_id.checked_add(1) {
                    return Err("native-expression.stale_request".into());
                }
                if serde_json::to_vec(&request)
                    .map_err(|e| e.to_string())?
                    .len()
                    > MAX_REQUEST
                {
                    return Err("native request exceeds 32 MiB".into());
                }
                let reply = owner
                    .tx
                    .as_ref()
                    .ok_or("native transport closed")?
                    .send(request)
                    .map_err(|_| "native pipe closed".to_string())
                    .and_then(|_| owner.receive());
                match reply {
                    Ok(reply)
                        if reply["schema"] == "ql.field-host-receipt/v1"
                            && reply["instance_ref"] == owner.identity["instance_ref"]
                            && cursor(&reply["request_id"]).ok() == Some(id)
                            && cursor(&reply["last_request_id"]).ok() == Some(id)
                            && reply["available"] == true
                            && cursor(&reply["field"]["generation"]).is_ok()
                            && cursor(&reply["field"]["samples_elapsed"]).is_ok()
                            && ["ok", "refused"]
                                .contains(&reply["status"].as_str().unwrap_or("")) =>
                    {
                        owner.last_request_id = id;
                        owner.procedural_position = json!({"generation":reply["field"]["generation"],"samples_elapsed":reply["field"]["samples_elapsed"]});
                        Ok(reply)
                    }
                    result => {
                        let reason = result
                            .err()
                            .unwrap_or_else(|| "native acknowledgement standing unknown".into());
                        let diagnostics = owner.diagnostic();
                        self.active.take(); // Drop closes the pipe/child; NEVER replay a write.
                        Err(format!(
                            "native-expression.unknown: {reason}; {diagnostics}"
                        ))
                    }
                }
            }
            Request::Compose { request } => {
                let prepared = self.prepare_compose(&request)?;
                let composed = prepared.execute()?;
                self.finish_compose(composed)
            }
            Request::PrepareWorld { request } => {
                let prepared = self.prepare_world(&request)?;
                let composed = prepared.execute()?;
                self.finish_compose(composed)
            }
            Request::Close { lease } => {
                if let Some(owner) = &self.active {
                    if lease != owner.lease {
                        return Err("native-expression.foreign_lease".into());
                    }
                }
                self.active.take();
                let data =
                    json!({"schema":"oi.native-expression-closed/v1","lease":lease,"closed":true});
                self.retain_selected_scene_closure(&lease, &data);
                Ok(data)
            }
        }
    }

    fn open(&mut self, content: &str, source: Value) -> Result<Value, String> {
        self.open_prepared(content, source, None)
    }

    fn open_prepared(
        &mut self,
        content: &str,
        source: Value,
        world_opening: Option<&NativeWorldOpening>,
    ) -> Result<Value, String> {
        if content.len() > MAX_REQUEST {
            return Err("binding source exceeds 32 MiB".into());
        }
        let binding: Binding =
            serde_json::from_str(content).map_err(|e| format!("invalid binding document: {e}"))?;
        if binding.schema != "oi.native-expression-binding/v1" {
            return Err("unsupported native-expression binding".into());
        }
        presentation(&binding.presentation)?;
        if !binding.host.is_object()
            || !nonempty(binding.host["instance_ref"].as_str().unwrap_or(""))
        {
            return Err("native host config required".into());
        }
        // Only installed/operator configuration chooses executable paths. The
        // binding and webview cannot supply shell strings, flags or programs.
        let (host, worker) = native_executables()?;
        let next_sequence = self
            .sequence
            .checked_add(1)
            .ok_or("native lease sequence exhausted")?;
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos();
        let lease = format!(
            "native-expression-{}-{stamp}-{}",
            std::process::id(),
            next_sequence
        );
        // The private native composition handle qualifies its original input
        // before any process/configuration effect. Opened files do not acquire it.
        let host_config = match world_opening {
            Some(opening) => opening.configuration(&source, &binding.host, &lease)?,
            None => binding.host.clone(),
        };
        self.sequence = next_sequence;
        let config_path = std::env::temp_dir().join(format!("{lease}.json"));
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&config_path).map_err(|e| e.to_string())?;
        if let Err(e) = serde_json::to_writer(&mut file, &host_config)
            .and_then(|_| file.flush().map_err(serde_json::Error::io))
        {
            let _ = fs::remove_file(&config_path);
            return Err(e.to_string());
        }
        drop(file);
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        let (pending_act, act_channel_unavailable) =
            match native_act_channel::PendingActChannel::prepare(&host, &config_path) {
                Ok(Some(pending)) => (Some(pending), None),
                Ok(None) => (None, Some("native parent image cut is absent".into())),
                Err(reason) => (None, Some(reason)),
            };
        // Image qualification gates selected-Act authority. Original ordinary
        // opening/control keeps its existing provider contract even when that
        // additional capability is unavailable; it never receives an Act lease.
        let mut command = Command::new(&host);
        command
            .arg(&worker)
            .arg(&config_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        if let Some(pending) = &pending_act {
            command.arg("--native-act-channel").arg(pending.path());
        }
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        let child = command.spawn();
        let mut child = match child {
            Ok(child) => child,
            Err(e) => {
                let _ = fs::remove_file(&config_path);
                return Err(format!("native-expression.unavailable: {e}"));
            }
        };
        let mut input = child.stdin.take().ok_or("native stdin absent")?;
        let mut output = BufReader::new(child.stdout.take().ok_or("native stdout absent")?);
        let mut stderr_pipe = child.stderr.take().ok_or("native stderr absent")?;
        let (tx, requests) = mpsc::sync_channel::<Value>(1);
        let (replies, rx) = mpsc::sync_channel(1);
        let reader = thread::spawn(move || {
            if replies.send(line(&mut output)).is_err() {
                return;
            }
            for request in requests {
                let result = serde_json::to_writer(&mut input, &request)
                    .map_err(|e| e.to_string())
                    .and_then(|_| {
                        input
                            .write_all(b"\n")
                            .and_then(|_| input.flush())
                            .map_err(|e| e.to_string())
                    })
                    .and_then(|_| line(&mut output));
                let failed = result.is_err();
                if replies.send(result).is_err() || failed {
                    break;
                }
            }
        });
        let stderr = Arc::new(Mutex::new(Vec::new()));
        let stderr_copy = stderr.clone();
        let stderr_reader = thread::spawn(move || {
            let mut chunk = [0; 4096];
            while let Ok(n) = stderr_pipe.read(&mut chunk) {
                if n == 0 {
                    break;
                }
                let mut bytes = stderr_copy.lock().unwrap_or_else(|e| e.into_inner());
                bytes.extend_from_slice(&chunk[..n]);
                let excess = bytes.len().saturating_sub(65536);
                bytes.drain(..excess);
            }
        });
        let mut owner = Owner {
            lease: lease.clone(),
            native_field_epoch: format!(
                "native-field-open-{}-{stamp}-{}",
                std::process::id(),
                self.sequence
            ),
            child,
            tx: Some(tx),
            rx,
            reader: Some(reader),
            stderr_reader: Some(stderr_reader),
            stderr,
            config_path,
            identity: Value::Null,
            procedural_source: source.clone(),
            procedural_position: Value::Null,
            procedural_executable: host,
            procedural_worker: worker,
            procedural_definitions: BTreeMap::new(),
            procedural_checkpoints: BTreeMap::new(),
            last_request_id: 0,
            stopped: false,
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            act_channel: None,
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            act_channel_unavailable,
        };
        let receipt = owner.receive()?;
        let _ = fs::remove_file(&owner.config_path); // native host already consumed it
        if receipt["schema"] != "ql.field-host-receipt/v1"
            || receipt["status"] != "ready"
            || receipt["available"] != true
            || receipt["instance_ref"] != binding.host["instance_ref"]
        {
            return Err(format!(
                "native-expression.open_refused: {}; {}",
                receipt,
                owner.diagnostic()
            ));
        }
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        if let Some(pending) = pending_act {
            owner.act_channel = Some(pending.accept(owner.child.id())?);
        }
        owner.last_request_id = cursor(&receipt["last_request_id"])?;
        for key in ["generation", "samples_elapsed"] {
            cursor(&receipt["field"][key])?;
        }
        owner.procedural_position = json!({"generation":receipt["field"]["generation"],"samples_elapsed":receipt["field"]["samples_elapsed"]});
        owner.identity = json!({"instance_ref":receipt["instance_ref"],"event_ref":receipt["field"]["event_ref"],"subject_ref":receipt["field"]["subject_ref"]});
        if ["instance_ref", "event_ref", "subject_ref"]
            .iter()
            .any(|k| !nonempty(owner.identity[k].as_str().unwrap_or("")))
        {
            return Err("native owner omitted its identity".into());
        }
        self.active = Some(owner);
        Ok(
            json!({"schema":"oi.native-expression-open/v1","lease":lease,"source":source,"native_host_configuration":host_config,"presentation":binding.presentation,"receipt":receipt,"checkpoint":"same-live-GPU-only; no process or native rewind"}),
        )
    }
}

/// Host operations a webview may relay. The K² determinant operations are
/// the host's own; a supplied (non-K²) owner refuses them natively.
const EXCHANGE_OPERATIONS: [&str; 12] = [
    "read",
    "inspect",
    "advance",
    "set-axis",
    "replace",
    "m1-advance",
    "replace-event",
    "influence",
    "set-damping",
    "performance-prepare",
    "performance-prepare-current",
    "performance-exchange",
];

fn exchange_admits(request: &Value) -> bool {
    EXCHANGE_OPERATIONS.contains(&request["command"]["operation"].as_str().unwrap_or(""))
}

const MAX_PARTICLES: u64 = 1_048_576;
const MAX_SKY: usize = 1024 * 1024;
const SKY_TIMEOUT: Duration = Duration::from_secs(120);
const BINDING_TIMEOUT: Duration = Duration::from_secs(30);
const WORLD_BINDING_TIMEOUT: Duration = Duration::from_secs(120);
const SKY_MAX_AGE_SECONDS: u64 = 3600;

#[derive(Clone, Debug, PartialEq)]
enum Sky {
    None,
    Now,
    Epoch(String),
    Snapshot(Value),
}

/// The consumer may retain an explicitly declared D30 material policy.
/// Geometry, field construction and executables remain native owners' authority.
#[derive(Clone, Debug, PartialEq)]
struct ComposeRequest {
    texture: [u32; 2],
    units_per_metre: f64,
    sky: Sky,
    event: Option<Value>,
    world: Option<Value>,
    snapshot_purpose: crate::nara_identity::SnapshotPurpose,
}

/// The same four-field Scene material contract used by the QL constructor.
/// This validates a caller policy; QL validates it again before native admission.
pub(crate) fn validate_scene_material(value: &Value) -> Result<(), String> {
    let m = value
        .as_object()
        .ok_or("Scene material must be an object")?;
    if m.len() != 4
        || m.keys().any(|key| {
            ![
                "damping_per_second",
                "strike_metres",
                "audio_gain_per_metre",
                "strike_on_event",
            ]
            .contains(&key.as_str())
        })
    {
        return Err("Scene material requires exactly its four declared fields".into());
    }
    let number = |key: &str| {
        m.get(key)
            .and_then(Value::as_f64)
            .filter(|v| v.is_finite())
            .ok_or_else(|| format!("Scene material {key} must be finite"))
    };
    let damping = number("damping_per_second")?;
    let strike = number("strike_metres")?;
    let gain = number("audio_gain_per_metre")?;
    if !(0.0..=1e6).contains(&damping)
        || strike <= 0.0
        || strike > 1.0
        || gain.abs() > 1e6
        || m["strike_on_event"].as_bool().is_none()
    {
        return Err("Scene material is outside the native Scene policy contract".into());
    }
    Ok(())
}

fn compose_request(value: &Value) -> Result<ComposeRequest, String> {
    let fail = |why: &str| format!("native-expression.invalid_compose: {why}");
    let obj = value
        .as_object()
        .ok_or_else(|| fail("request must be an object"))?;
    if let Some(key) = obj.keys().find(|k| {
        ![
            "texture",
            "units_per_metre",
            "sky",
            "sky_snapshot",
            "snapshot_purpose",
            "event",
            "world",
        ]
        .contains(&k.as_str())
    }) {
        return Err(fail(&format!("unknown key {key}")));
    }
    let dims: Vec<u64> = obj
        .get("texture")
        .and_then(Value::as_array)
        .filter(|t| t.len() == 2)
        .and_then(|t| {
            t.iter()
                .map(|d| d.as_u64().filter(|d| (1..=MAX_PARTICLES).contains(d)))
                .collect()
        })
        .ok_or_else(|| fail("texture must be [width, height] of positive integers"))?;
    if dims[0] * dims[1] > MAX_PARTICLES {
        return Err(fail("texture must hold at most 1048576 particles"));
    }
    let units_per_metre = obj
        .get("units_per_metre")
        .and_then(Value::as_f64)
        .filter(|u| u.is_finite() && *u > 0.0 && *u <= 1_000_000.0)
        .ok_or_else(|| fail("units_per_metre must be in (0, 1000000]"))?;
    let sky = match (obj.get("sky"), obj.get("sky_snapshot")) {
        (Some(_), Some(_)) | (None, None) => {
            return Err(fail("exactly one sky selector or sky_snapshot is required"))
        }
        (None, Some(snapshot @ Value::Object(_))) => {
            if snapshot["schema"] != "ql.sky-snapshot/v1"
                || !snapshot["snapshot_ref"].as_str().is_some_and(nonempty)
                || serde_json::to_vec(snapshot)
                    .map_err(|error| fail(&error.to_string()))?
                    .len()
                    > MAX_SKY
            {
                return Err(fail(
                    "sky_snapshot must be one bounded ql.sky-snapshot/v1 owner reading",
                ));
            }
            Sky::Snapshot(snapshot.clone())
        }
        (None, Some(_)) => {
            return Err(fail(
                "sky_snapshot must be one bounded ql.sky-snapshot/v1 owner reading",
            ))
        }
        (Some(Value::String(s)), None) if s == "none" => Sky::None,
        (Some(Value::String(s)), None) if s == "now" => Sky::Now,
        (Some(Value::Object(o)), None) if o.len() == 1 && o.contains_key("epoch") => {
            let epoch = o["epoch"]
                .as_str()
                .filter(|e| rfc3339_whole_second(e).is_some())
                .ok_or_else(|| fail("sky epoch must be RFC 3339 whole seconds with Z or ±HH:MM"))?;
            Sky::Epoch(epoch.to_owned())
        }
        _ => return Err(fail("sky must be \"none\", \"now\" or {\"epoch\": \"…\"}")),
    };
    let event = match obj.get("event") {
        None => None,
        Some(event @ Value::Object(_)) => Some(event.clone()),
        Some(_) => return Err(fail("event must be an object")),
    };
    let snapshot_purpose = obj
        .get("snapshot_purpose")
        .map(|value| serde_json::from_value::<crate::nara_identity::SnapshotPurpose>(value.clone()))
        .transpose()
        .map_err(|_| fail("snapshot_purpose must be requested or retained-occasion"))?
        .unwrap_or_default();
    if snapshot_purpose == crate::nara_identity::SnapshotPurpose::RetainedOccasion
        && !matches!(sky, Sky::Snapshot(_))
    {
        return Err(fail(
            "a retained occasion requires an existing native sky snapshot",
        ));
    }
    let world = match obj.get("world") {
        None => None,
        Some(Value::Object(world)) => {
            if let Some(key) = world.keys().find(|key| {
                !["instance_ref", "subject_ref", "start", "material"].contains(&key.as_str())
            }) {
                return Err(fail(&format!("unknown world key {key}")));
            }
            let reference = |key: &str| {
                world
                    .get(key)
                    .and_then(Value::as_str)
                    .filter(|value| nonempty(value) && value.contains(':'))
                    .ok_or_else(|| fail(&format!("world {key} must be a qualified stable ref")))
            };
            reference("instance_ref")?;
            reference("subject_ref")?;
            if world.get("start").is_some_and(|start| !start.is_object()) {
                return Err(fail("world start must be an owner recipe object"));
            }
            if let Some(material) = world.get("material") {
                validate_scene_material(material).map_err(|why| fail(&why))?;
            }
            Some(Value::Object(world.clone()))
        }
        Some(_) => return Err(fail("world must be an object")),
    };
    if world.is_some() && event.is_some() {
        return Err(fail(
            "world admission and legacy event compose are mutually exclusive",
        ));
    }
    if snapshot_purpose == crate::nara_identity::SnapshotPurpose::RetainedOccasion
        && world.is_none()
    {
        return Err(fail("retained-occasion playback requires the qualified world contract; legacy scene binding admits requested snapshots"));
    }
    if world.is_some() && sky == Sky::None {
        return Err(fail(
            "world admission requires one full validated sky snapshot",
        ));
    }
    Ok(ComposeRequest {
        texture: [dims[0] as u32, dims[1] as u32],
        units_per_metre,
        sky,
        event,
        world,
        snapshot_purpose,
    })
}

/// Days since 1970-01-01 of a proleptic Gregorian date (Hinnant).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * (m + if m > 2 { -3 } else { 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn civil_from_days(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (yoe + era * 400 + i64::from(m <= 2), m, d)
}

/// `YYYY-MM-DDTHH:MM:SS` then `Z` or `±HH:MM`, a real calendar instant, no
/// fraction: ql-sky's own epoch law. Returns the instant in Unix seconds.
fn rfc3339_whole_second(text: &str) -> Option<i64> {
    let b = text.as_bytes();
    if !(b.len() == 20 || b.len() == 25) {
        return None;
    }
    let num = |range: std::ops::Range<usize>| -> Option<i64> {
        let digits = b.get(range)?;
        digits
            .iter()
            .all(u8::is_ascii_digit)
            .then(|| digits.iter().fold(0, |n, d| n * 10 + i64::from(d - b'0')))
    };
    if b[4] != b'-' || b[7] != b'-' || b[10] != b'T' || b[13] != b':' || b[16] != b':' {
        return None;
    }
    let (year, month, day) = (num(0..4)?, num(5..7)?, num(8..10)?);
    let (hour, minute, second) = (num(11..13)?, num(14..16)?, num(17..19)?);
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let month_days = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    if !(1..=12).contains(&month)
        || day < 1
        || day > month_days[month as usize - 1]
        || hour > 23
        || minute > 59
        || second > 59
    {
        return None;
    }
    let offset = match (b.len(), b[19]) {
        (20, b'Z') => 0,
        (25, sign @ (b'+' | b'-')) if b[22] == b':' => {
            let (oh, om) = (num(20..22)?, num(23..25)?);
            if oh > 23 || om > 59 {
                return None;
            }
            let minutes = oh * 60 + om;
            if sign == b'+' {
                minutes
            } else {
                -minutes
            }
        }
        _ => return None,
    };
    Some(
        days_from_civil(year, month, day) * 86_400 + hour * 3600 + minute * 60 + second
            - offset * 60,
    )
}

fn utc_whole_second(unix_seconds: i64) -> String {
    let (y, m, d) = civil_from_days(unix_seconds.div_euclid(86_400));
    let s = unix_seconds.rem_euclid(86_400);
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        s / 3600,
        s % 3600 / 60,
        s % 60
    )
}

/// The `ql.sky-request/v1` this kernel asks for. "now" floors to the whole
/// second so ql-sky's current mode (epoch ≤ now, within budget) holds.
fn sky_request(sky: &Sky, now_unix_seconds: i64) -> Option<Value> {
    let (mode, epoch) = match sky {
        Sky::None | Sky::Snapshot(_) => return None,
        Sky::Now => ("current", utc_whole_second(now_unix_seconds)),
        Sky::Epoch(epoch) => ("historical", epoch.clone()),
    };
    Some(
        json!({"schema":"ql.sky-request/v1","epoch":epoch,"timezone":"UTC","mode":mode,
        "perspective":"Apparent Geocentric","zodiac":"Tropical","ayanamsha":null,"observer":null,
        "max_age_seconds":SKY_MAX_AGE_SECONDS,"backend_policy":"allow-moshier"}),
    )
}

/// ql-sky reports `ql.sky-error/v1` on stderr; anything else is shown bounded.
fn sky_error(stderr: &[u8]) -> String {
    if let Ok(error) = serde_json::from_slice::<Value>(stderr) {
        if error["schema"] == "ql.sky-error/v1" {
            if let Some(why) = error["error"].as_str() {
                return why.to_owned();
            }
        }
    }
    diagnostic_text(stderr)
}

fn diagnostic_text(bytes: &[u8]) -> String {
    let text = String::from_utf8_lossy(bytes);
    let text = text.trim();
    if text.is_empty() {
        "no diagnostic".into()
    } else {
        text.chars().take(2048).collect()
    }
}

fn unix_ms() -> Result<u128, String> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis())
}

/// A 0600 request file this kernel alone wrote; removed on every path.
struct PrivateFile(PathBuf);
impl PrivateFile {
    fn create(name: &str, bytes: &[u8]) -> Result<Self, String> {
        let path = std::env::temp_dir().join(name);
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut handle = options.open(&path).map_err(|e| e.to_string())?;
        let file = Self(path);
        handle
            .write_all(bytes)
            .and_then(|_| handle.flush())
            .map_err(|e| e.to_string())?;
        Ok(file)
    }
}
impl Drop for PrivateFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

struct ComposeExecutables {
    ql: PathBuf,
    sky: Option<PathBuf>,
    selection: &'static str,
    revision: Option<String>,
}

/// `ql` and `ql-sky`: the operator override names both, absolutely, or
/// neither; otherwise the installed suite answers (one cut, so the sky's
/// registry revision is the one `ql` checks against).
fn compose_executables(needs_sky: bool) -> Result<ComposeExecutables, String> {
    let var = |key| std::env::var_os(key).filter(|value| !value.is_empty());
    match (var("OI_QL_BIN"), var("OI_QL_SKY_BIN")) {
        (Some(ql), Some(sky)) => {
            let (ql, sky) = (PathBuf::from(ql), PathBuf::from(sky));
            if !ql.is_absolute() || !sky.is_absolute() {
                return Err("native executable bindings must be absolute installed paths".into());
            }
            Ok(ComposeExecutables {
                ql,
                sky: needs_sky.then_some(sky),
                selection: "operator-override",
                revision: None,
            })
        }
        (None, None) => {
            let installed = InstalledQl::discover()?;
            Ok(ComposeExecutables {
                ql: installed.executable()?,
                sky: if needs_sky {
                    Some(installed.companion("ql-sky")?)
                } else {
                    None
                },
                selection: "installed",
                revision: installed.revision,
            })
        }
        _ => Err("native-expression.unavailable: OI_QL_BIN and OI_QL_SKY_BIN override together; set both or neither".into()),
    }
}

/// A validated compose request with its kernel-minted instance. Executing it
/// touches no manager state, so a host may run it outside the kernel lock.
#[derive(Debug)]
pub struct PreparedCompose {
    request: ComposeRequest,
    token: String,
    finish: ComposeFinish,
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum ComposeFinish {
    Open,
    ReturnWorld,
}

/// A QL-composed binding document and its honest provenance.
#[derive(Debug)]
pub struct ComposedBinding {
    content: String,
    source: Value,
    finish: ComposeFinish,
    world_opening: Option<NativeWorldOpening>,
}

/// Produced only by the actual QL composition below. Serialized World/source
/// evidence, files and browser requests cannot deserialize this owner handle.
#[derive(Debug, Clone)]
struct NativeWorldOpening {
    constructor_request: Value,
    constructor_request_bytes: String,
    snapshot_purpose: crate::nara_identity::SnapshotPurpose,
}
impl ComposedBinding {
    /// The entire native composition, retained for the document source owner.
    /// These read-only observations cannot reconstruct the private opening.
    pub(crate) fn source(&self) -> &Value {
        &self.source
    }

    pub(crate) fn binding_content(&self) -> &str {
        &self.content
    }
}

impl NativeWorldOpening {
    fn configuration(&self, source: &Value, host: &Value, lease: &str) -> Result<Value, String> {
        let refuse = |why: &str| format!("native-expression.compose_refused: {why}");
        let request = &self.constructor_request;
        let world = &source["world"];
        if source["constructor_request"] != *request
            || source["constructor_request_bytes"] != self.constructor_request_bytes
            || serde_json::from_str::<Value>(&self.constructor_request_bytes)
                .map_err(|e| e.to_string())?
                != *request
            || source["request_sha256"] != sha256_hex(self.constructor_request_bytes.as_bytes())
            || request["schema"] != "ql.scene-world-request/v1"
            || request["instance_ref"] != host["instance_ref"]
            || request["instance_ref"] != world["instance_ref"]
            || request["event_ref"] != world["event_ref"]
            || request["subject_ref"] != world["subject_ref"]
            || request["sky"] != world["sky"]
        {
            return Err(refuse("original native World constructor changed"));
        }
        if self.snapshot_purpose == crate::nara_identity::SnapshotPurpose::RetainedOccasion {
            crate::nara_identity::validate_retained_admission(
                &world["sky_admission"],
                &request["sky"],
            )?;
        }
        // snapshot_purpose is the CLI admission operation, not a WorldRequest
        // constituent. Its exact bytes and native receipt remain in source.
        // QL's private source factory independently classifies the COMPLETE sky;
        // removing this CLI selector grants no public/private source standing.
        let mut domain_request = request.clone();
        domain_request
            .as_object_mut()
            .ok_or_else(|| refuse("World constructor is not an object"))?
            .remove("snapshot_purpose");
        let context_ref = host["instance_ref"]
            .as_str()
            .filter(|v| nonempty(v))
            .ok_or_else(|| refuse("World owner instance absent"))?;
        let receiving_context = json!({"kind":"world","private":false,
            "context":{"reference":context_ref,"revision":lease},
            "receiver":{"reference":lease,"revision":source["ql_executable_sha256"]},
            "source_occasion":null,"protected_state":null,"consent":null,"required_assets":[]});
        Ok(json!({"schema":"ql.field-host-world-config/v1",
            "instance_ref":host["instance_ref"],"world_request":domain_request,
            "receiving_context":receiving_context}))
    }
}

impl PreparedCompose {
    pub fn execute(self) -> Result<ComposedBinding, String> {
        let executables =
            compose_executables(matches!(self.request.sky, Sky::Now | Sky::Epoch(_)))?;
        let executable_sha256 = sha256_hex(&fs::read(&executables.ql).map_err(|error| {
            format!("native-expression.unavailable: qualify QL executable: {error}")
        })?);
        let now_ms = unix_ms()?;
        let mut sky_provenance = Value::Null;
        let mut snapshot = match &self.request.sky {
            Sky::Snapshot(snapshot) => Some(snapshot.clone()),
            _ => None,
        };
        if let Some(request) = sky_request(&self.request.sky, (now_ms / 1000) as i64) {
            let unavailable =
                |why: String| format!("native-expression.unavailable: dated sky: {why}");
            let program = executables
                .sky
                .as_ref()
                .ok_or_else(|| unavailable("no ql-sky executable".into()))?;
            let bytes = serde_json::to_vec(&request).map_err(|e| e.to_string())?;
            let file = PrivateFile::create(&format!("{}-sky.json", self.token), &bytes)?;
            let ran = run_bounded(
                program.as_os_str(),
                &[file.0.as_os_str()],
                SKY_TIMEOUT,
                MAX_SKY,
            )
            .map_err(|e| unavailable(e.describe(SKY_TIMEOUT, MAX_SKY)))?;
            if !ran.status.success() {
                return Err(unavailable(sky_error(&ran.stderr)));
            }
            let reading: Value = serde_json::from_slice(&ran.stdout)
                .map_err(|e| unavailable(format!("ql-sky output is not JSON: {e}")))?;
            if reading["schema"] != "ql.sky-snapshot/v1" {
                return Err(unavailable(
                    "ql-sky did not answer a ql.sky-snapshot/v1".into(),
                ));
            }
            sky_provenance = json!({"mode":request["mode"],"epoch":request["epoch"],
                "snapshot_ref":reading["snapshot_ref"],"receipt_unix_ms":reading["receipt_unix_ms"]});
            snapshot = Some(reading);
        }
        let [width, height] = self.request.texture;
        let world_requested = self.request.world.is_some();
        let owner_request = if let Some(world) = self.request.world {
            let sky = snapshot.clone().ok_or("native-expression.invalid_compose: world admission requires one full validated sky snapshot")?;
            let event_ref = sky["snapshot_ref"]
                .as_str()
                .filter(|value| nonempty(value))
                .ok_or(
                    "native-expression.compose_refused: ql-sky snapshot has no stable snapshot_ref",
                )?;
            let mut request = json!({"schema":"ql.scene-world-request/v1",
                "instance_ref":world["instance_ref"],"event_ref":event_ref,"subject_ref":world["subject_ref"],
                "sky":sky,"texture":[width,height],"units_per_metre":self.request.units_per_metre});
            if self.request.snapshot_purpose
                == crate::nara_identity::SnapshotPurpose::RetainedOccasion
            {
                request["snapshot_purpose"] = json!(self.request.snapshot_purpose);
            }
            if let Some(start) = world.get("start") {
                request["start"] = start.clone();
            }
            if let Some(material) = world.get("material") {
                request["material"] = material.clone();
            }
            request
        } else {
            let mut request = json!({"schema":"ql.scene-binding-request/v1",
                "instance_ref":format!("oi:native-expression/{}", self.token),
                "texture":[width, height],"units_per_metre":self.request.units_per_metre});
            if self.request.snapshot_purpose
                == crate::nara_identity::SnapshotPurpose::RetainedOccasion
            {
                request["snapshot_purpose"] = json!(self.request.snapshot_purpose);
            }
            if let Some(event) = self.request.event {
                request["event"] = event; // QL's CoupledInput; passed untouched
            }
            if let Some(snapshot) = snapshot.clone() {
                request["sky"] = snapshot;
            }
            request
        };
        let bytes = serde_json::to_vec(&owner_request).map_err(|e| e.to_string())?;
        if bytes.len() > MAX_REQUEST {
            return Err("native-expression.invalid_compose: request exceeds 32 MiB".into());
        }
        let request_sha256 = sha256_hex(&bytes);
        let constructor_request_bytes =
            String::from_utf8(bytes.clone()).map_err(|e| e.to_string())?;
        let file = PrivateFile::create(&format!("{}-scene.json", self.token), &bytes)?;
        let refused = |why: String| format!("native-expression.compose_refused: {why}");
        let output_limit = if world_requested {
            MAX_REPLY
        } else {
            MAX_REQUEST
        };
        let construction_timeout = if world_requested {
            WORLD_BINDING_TIMEOUT
        } else {
            BINDING_TIMEOUT
        };
        let ran = run_bounded(
            executables.ql.as_os_str(),
            &[
                "scene".as_ref(),
                if world_requested {
                    "world".as_ref()
                } else {
                    "binding".as_ref()
                },
                file.0.as_os_str(),
                "--json".as_ref(),
            ],
            construction_timeout,
            output_limit,
        )
        .map_err(|e| {
            format!(
                "native-expression.unavailable: `{} scene {}` {}",
                executables.ql.display(),
                if world_requested { "world" } else { "binding" },
                e.describe(construction_timeout, output_limit)
            )
        })?;
        drop(file);
        if sha256_hex(&fs::read(&executables.ql).map_err(|error| {
            format!("native-expression.unavailable: recheck QL executable: {error}")
        })?) != executable_sha256
        {
            return Err(refused("QL executable changed during composition".into()));
        }
        if !ran.status.success() {
            return Err(refused(format!(
                "ql scene {} exited {}: {}",
                if world_requested { "world" } else { "binding" },
                ran.status,
                diagnostic_text(&ran.stderr)
            )));
        }
        let (content, world, disclosed_sky) = if world_requested {
            let world: Value = serde_json::from_slice(&ran.stdout)
                .map_err(|error| refused(format!("ql scene world output is not JSON: {error}")))?;
            if world["schema"] != "ql.scene-world/v1" || !world["binding"].is_object() {
                return Err(refused(
                    "ql scene world did not answer a ql.scene-world/v1 with a binding".into(),
                ));
            }
            if self.request.snapshot_purpose
                == crate::nara_identity::SnapshotPurpose::RetainedOccasion
            {
                crate::nara_identity::validate_retained_admission(
                    &world["sky_admission"],
                    snapshot.as_ref().unwrap(),
                )?;
            }
            let event_ref = owner_request["event_ref"].clone();
            let subject_ref = owner_request["subject_ref"].clone();
            let instance_ref = owner_request["instance_ref"].clone();
            let basis = &world["basis"];
            if !basis.is_object()
                || world["sky"] != owner_request["sky"]
                || world["event_ref"] != event_ref
                || world["snapshot_ref"] != event_ref
                || world["subject_ref"] != subject_ref
                || world["instance_ref"] != instance_ref
                || world["binding"]["host"]["instance_ref"] != instance_ref
                || world["event"] != basis["input"]
                || world["binding"]["native_basis"] != *basis
                || world["binding"]["scene"] != world["scene"]
                || world["binding"]["native_readback"] != world["native_readback"]
                || basis["input"]["m1"]["event_ref"] != event_ref
                || basis["input"]["m2"]["stamp"]["identity"]["event_ref"] != event_ref
                || basis["input"]["m3"]["stamp"]["identity"]["event_ref"] != event_ref
                || basis["input"]["m3"]["subject_ref"] != subject_ref
                || basis["m1"]["config"]["event_ref"] != event_ref
                || basis["m2"]["identity"]["event_ref"] != event_ref
                || basis["m3"]["identity"]["event_ref"] != event_ref
                || basis["m3"]["subject_ref"] != subject_ref
                || world["scene"]["event_ref"] != event_ref
                || world["scene"]["snapshot_ref"] != event_ref
                || world["scene"]["subject_ref"] != subject_ref
            {
                return Err(refused(
                    "ql scene world did not preserve one sky/event/subject basis".into(),
                ));
            }
            let content = serde_json::to_string(&world["binding"])
                .map_err(|error| refused(error.to_string()))?;
            let sky = world["sky"].clone();
            (content, world, sky)
        } else {
            let content = String::from_utf8(ran.stdout)
                .map_err(|_| refused("ql scene binding output is not UTF-8".into()))?;
            (content, Value::Null, snapshot.unwrap_or(sky_provenance))
        };
        let mut source = json!({"schema":"oi.native-expression-composed-source/v1",
            "ql_executable":executables.ql,"ql_selection":executables.selection,
            "ql_revision":executables.revision,"ql_executable_sha256":executable_sha256,"sky":disclosed_sky,"world":world,
            "request_sha256":request_sha256,"constructor_request":owner_request,
            "constructor_request_bytes":constructor_request_bytes,
            "binding_sha256":sha256_hex(content.as_bytes()),"composed_at_unix_ms":now_ms as u64});
        if !world_requested {
            // The legacy scene compiler also returns qualified six-field
            // material. Retain it whole rather than discard its source basis.
            source["binding"] = serde_json::from_str(&content)
                .map_err(|error| refused(format!("ql scene binding is not JSON: {error}")))?;
        }
        Ok(ComposedBinding {
            content,
            source,
            finish: self.finish,
            world_opening: world_requested.then_some(NativeWorldOpening {
                constructor_request: owner_request,
                constructor_request_bytes,
                snapshot_purpose: self.request.snapshot_purpose,
            }),
        })
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

/// Keep the qualified composition in its source carrier. The worker consumes
/// the older closed rendering binding, not the complete source-bearing world.
/// Projection happens only after exact admission; direct `Open` stays strict.
fn composed_worker_binding(content: &str, source: &Value) -> Result<String, String> {
    let refuse = |why: &str| format!("native-expression.compose_refused: {why}");
    if content.len() > MAX_REQUEST {
        return Err(refuse("binding source exceeds 32 MiB"));
    }
    let binding: Value = serde_json::from_str(content)
        .map_err(|error| refuse(&format!("composed binding is not JSON: {error}")))?;
    let fields = binding
        .as_object()
        .ok_or_else(|| refuse("composed binding must be an object"))?;
    let world = &source["world"];
    if !world.is_object() && fields.len() == 3 {
        // A legacy three-field QL result is subject to exactly the authored
        // binding parser too; this is not an unknown-field escape hatch.
        serde_json::from_str::<Binding>(content)
            .map_err(|error| refuse(&format!("invalid closed binding: {error}")))?;
        return Ok(content.to_owned());
    }
    const QUALIFIED_FIELDS: [&str; 6] = [
        "schema",
        "host",
        "presentation",
        "scene",
        "native_readback",
        "native_basis",
    ];
    if fields.len() != QUALIFIED_FIELDS.len()
        || QUALIFIED_FIELDS
            .iter()
            .any(|key| !fields.contains_key(*key))
        || binding["schema"] != "oi.native-expression-binding/v1"
        || !binding["native_basis"].is_object()
        || !binding["native_readback"].is_object()
    {
        return Err(refuse(
            "qualified binding requires exactly its six source fields",
        ));
    }
    let has_source_sky = binding["host"]["basis"]["source_receipts"]
        .as_array()
        .is_some_and(|receipts| {
            receipts
                .iter()
                .any(|receipt| receipt["schema"] == "ql.sky-snapshot/v1")
        });
    let lawful_unlocated_scene = !world.is_object()
        && binding["scene"].is_null()
        && source["sky"].is_null()
        && !has_source_sky;
    if !binding["scene"].is_object() && !lawful_unlocated_scene {
        return Err(refuse(
            "qualified sky composition requires its source scene",
        ));
    }
    if source["schema"] != "oi.native-expression-composed-source/v1" {
        return Err(refuse("qualified binding has no composed source"));
    }
    if source["binding_sha256"] != sha256_hex(content.as_bytes()) {
        return Err(refuse(
            "qualified binding differs from its exact native bytes",
        ));
    }
    if world.is_object() {
        if world["schema"] != "ql.scene-world/v1"
            || binding != world["binding"]
            || binding["native_basis"] != world["basis"]
            || binding["scene"] != world["scene"]
            || binding["native_readback"] != world["native_readback"]
            || binding["host"]["instance_ref"] != world["instance_ref"]
        {
            return Err(refuse("qualified binding differs from its admitted world"));
        }
    } else if binding != source["binding"] {
        return Err(refuse("qualified binding differs from its retained source"));
    }
    // host.basis is the original QL seed. QL completion attaches the admitted
    // sky frequencies/resonator; requiring equality with completed native_basis
    // would falsely reject the owner computation. Pass the seed unchanged.
    serde_json::to_string(&json!({"schema":binding["schema"],
        "host":binding["host"],"presentation":binding["presentation"]}))
    .map_err(|error| refuse(&error.to_string()))
}

impl Manager {
    fn busy(&self) -> Result<(), String> {
        if self.active.is_some() {
            return Err(
                "native-expression.owner_busy: another surface owns the material/audio driver"
                    .into(),
            );
        }
        Ok(())
    }

    pub fn prepare_compose(&mut self, request: &Value) -> Result<PreparedCompose, String> {
        self.busy()?;
        let request = compose_request(request)?;
        self.composed = self
            .composed
            .checked_add(1)
            .ok_or("native compose sequence exhausted")?;
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos();
        Ok(PreparedCompose {
            request,
            token: format!(
                "native-compose-{}-{stamp}-{}",
                std::process::id(),
                self.composed
            ),
            finish: ComposeFinish::Open,
        })
    }

    pub fn prepare_world(&mut self, request: &Value) -> Result<PreparedCompose, String> {
        let mut prepared = self.prepare_compose(request)?;
        if prepared.request.world.is_none() {
            return Err(
                "native-expression.invalid_compose: prepare_world requires world refs".into(),
            );
        }
        prepared.finish = ComposeFinish::ReturnWorld;
        Ok(prepared)
    }

    /// The same open path as `Open`, over QL's composed document.
    pub fn finish_compose(&mut self, composed: ComposedBinding) -> Result<Value, String> {
        self.busy()?;
        match composed.finish {
            ComposeFinish::Open => {
                let worker =
                    composed_worker_binding(composed.binding_content(), composed.source())?;
                self.open_prepared(&worker, composed.source, composed.world_opening.as_ref())
            }
            ComposeFinish::ReturnWorld => {
                let binding: Value =
                    serde_json::from_str(composed.binding_content()).map_err(|error| {
                        format!(
                        "native-expression.compose_refused: prepared binding is not JSON: {error}"
                    )
                    })?;
                Ok(
                    json!({"schema":"oi.native-expression-prepared-world/v1","source":composed.source,"binding":binding}),
                )
            }
        }
    }
}

impl crate::Kernel {
    pub fn prepare_native_procedural_compile(
        &mut self,
        op: &crate::KernelOp,
    ) -> Result<Option<procedural::Prepared>, String> {
        let crate::KernelOp::NativeExpression {
            request: Request::ProceduralCompile { request },
        } = op
        else {
            return Ok(None);
        };
        let prepared = procedural::Prepared::new(request.clone())?;
        let prepared = if let Some(basis) = prepared.basis() {
            let before = self
                .expressions
                .procedural_source_snapshot(&basis.expression_ref, basis.document_revision)?;
            prepared.bind(before)?
        } else {
            prepared
        };
        Ok(Some(prepared))
    }
    pub fn finish_native_procedural_compile(
        &mut self,
        completed: procedural::Completed,
    ) -> Result<crate::KernelOpOutcome, String> {
        let procedural::Completed {
            mut response,
            before,
            command,
        } = completed;
        let prepared = match command {
            procedural::Command::Prepare => Some(response["native_result"]["result"].clone()),
            procedural::Command::Regenerate => response["native_result"]["result"]
                .get("prepared")
                .filter(|v| !v.is_null())
                .cloned(),
            _ => None,
        };
        if let Some(prepared) = prepared {
            let before = before
                .as_ref()
                .ok_or("Native compilation has no original captured Expression basis")?;
            let admission = self.expressions.admit_procedural_source(
                before,
                prepared,
                response["source"].clone(),
            )?;
            response["admission"] = admission;
        }
        Ok(crate::KernelOpOutcome {
            receipts: Vec::new(),
            result: crate::KernelOpResult::NativeExpression { data: response },
        })
    }

    /// Composing may provision the dated sky for tens of seconds on a first
    /// run; hosts run `execute` outside the kernel lock and finish under it.
    pub fn prepare_native_compose(
        &mut self,
        op: &crate::KernelOp,
    ) -> Result<Option<PreparedCompose>, String> {
        match op {
            crate::KernelOp::NativeExpression {
                request: Request::Compose { request },
            } => self.native_expression.prepare_compose(request).map(Some),
            crate::KernelOp::NativeExpression {
                request: Request::PrepareWorld { request },
            } => self.native_expression.prepare_world(request).map(Some),
            _ => Ok(None),
        }
    }

    pub fn finish_native_compose(
        &mut self,
        composed: ComposedBinding,
    ) -> Result<crate::KernelOpOutcome, String> {
        let data = self.native_expression.finish_compose(composed)?;
        Ok(crate::KernelOpOutcome {
            receipts: Vec::new(),
            result: crate::KernelOpResult::NativeExpression { data },
        })
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn native_source_numbers_preserve_binary64_across_every_json_boundary() {
        // Captured real-source values which the default fast parser rounded by
        // one ULP. Native basis readback must not rewrite retained evidence.
        let values = [
            12.743725967790677_f64,
            -0.000011802825996413943_f64,
            0.9747255095605911_f64,
            0.19773633068574678_f64,
            -0.013338354703560323_f64,
        ];
        for expected in values {
            let mut value = serde_json::json!({"source": expected, "ref": "Pṛthivī"});
            for _ in 0..5 {
                let mut bytes = serde_json::to_vec(&value).unwrap();
                bytes.push(b'\n');
                value = super::line(&mut std::io::Cursor::new(bytes)).unwrap();
                assert_eq!(
                    value["source"].as_f64().unwrap().to_bits(),
                    expected.to_bits()
                );
                assert_eq!(value["ref"], "Pṛthivī");
            }
        }
    }

    use super::*;

    /// Real owned OS child; no native World, Source, channel or ACK is fabricated.
    #[cfg(unix)]
    pub(super) fn owned_process_for_test(body: &str) -> Owner {
        use std::os::unix::process::CommandExt;
        let child = Command::new("/bin/sh")
            .args(["-c", body])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .process_group(0)
            .spawn()
            .unwrap();
        Owner {
            lease: format!("physical-process:{}", child.id()),
            native_field_epoch: String::new(),
            child,
            tx: None,
            rx: mpsc::channel().1,
            reader: None,
            stderr_reader: None,
            stderr: Arc::new(Mutex::new(Vec::new())),
            config_path: PathBuf::new(),
            identity: Value::Null,
            procedural_source: Value::Null,
            procedural_position: Value::Null,
            procedural_executable: PathBuf::new(),
            procedural_worker: PathBuf::new(),
            procedural_definitions: BTreeMap::new(),
            procedural_checkpoints: BTreeMap::new(),
            last_request_id: 0,
            stopped: false,
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            act_channel: None,
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            act_channel_unavailable: None,
        }
    }

    #[cfg(unix)]
    #[test]
    fn actual_owner_exit_observation_retains_custody_until_group_cleanup() {
        let mut owner = owned_process_for_test("exit 7");
        let foreign = owned_process_for_test("exec sleep 60");
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        while !owner.process_exited().unwrap() {
            assert!(
                std::time::Instant::now() < deadline,
                "actual child did not exit"
            );
            thread::sleep(Duration::from_millis(1));
        }
        // A reaping observer makes the second WNOWAIT return ECHILD.
        assert!(owner.process_exited().unwrap());
        assert!(!foreign.process_exited().unwrap());
        let pid = owner.child.id();
        owner.stop();
        assert!(owner.stopped);
        assert_eq!(owner.child.wait().unwrap().code(), Some(7));
        assert!(!foreign.process_exited().unwrap());
        let mut info: libc::siginfo_t = unsafe { std::mem::zeroed() };
        assert_eq!(
            unsafe {
                libc::waitid(
                    libc::P_PID,
                    pid as libc::id_t,
                    &mut info,
                    libc::WEXITED | libc::WNOHANG | libc::WNOWAIT,
                )
            },
            -1
        );
        assert_eq!(
            std::io::Error::last_os_error().raw_os_error(),
            Some(libc::ECHILD)
        );
        // Repeated stop does not send another signal after releasing custody.
        owner.stop();
        assert!(!foreign.process_exited().unwrap());
    }

    #[cfg(unix)]
    #[test]
    fn actual_exited_setup_leader_keeps_owned_pipe_group_until_timeout_cleanup() {
        let error = run_bounded(
            "/bin/sh".as_ref(),
            &["-c".as_ref(), "sleep 30 & exit 7".as_ref()],
            Duration::from_millis(100),
            1024,
        )
        .unwrap_err();
        assert!(matches!(error, RunError::HeldOpen), "{error:?}");
    }

    #[test]
    fn source_correspondence_is_not_inferred() {
        assert!(
            presentation(&json!({"units_per_metre":400,"slots_a":[0,1],"slots_b":[1,0]})).is_ok()
        );
        for value in [
            json!({"units_per_metre":0,"slots_a":[0],"slots_b":[0]}),
            json!({"units_per_metre":400,"slots_a":[0],"slots_b":[]}),
            json!({"units_per_metre":1,"slots_a":[-1],"slots_b":[0]}),
            json!({"units_per_metre":1,"slots_a":[0],"slots_b":[0],"execute":"fake"}),
        ] {
            assert!(presentation(&value).is_err());
        }
    }
    #[test]
    fn exact_cursor_and_complete_reply() {
        for bad in [
            json!(0),
            json!("01"),
            json!("-1"),
            json!("18446744073709551616"),
        ] {
            assert!(cursor(&bad).is_err());
        }
        assert_eq!(cursor(&json!("18446744073709551615")).unwrap(), u64::MAX);
        assert!(line(&mut BufReader::new(&b"{}"[..])).is_err());
        assert_eq!(
            line(&mut BufReader::new(&b"{\"available\":false}\n"[..])).unwrap()["available"],
            false
        );
    }
    #[cfg(unix)]
    #[test]
    fn release_reaps_the_owned_pipe_holding_process_group() {
        use std::os::unix::fs::PermissionsExt;
        let dir =
            std::env::temp_dir().join(format!("native-process-group-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let script = dir.join("host.py");
        fs::write(&script, r#"#!/usr/bin/env python3
import json,subprocess,sys,time
subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)'])
print(json.dumps({'schema':'ql.field-host-receipt/v1','status':'ready','available':True,'instance_ref':'test:instance','last_request_id':'0','field':{'event_ref':'test:event','subject_ref':'test:subject','generation':'0','samples_elapsed':'0'}}),flush=True)
for line in sys.stdin: time.sleep(60)
"#).unwrap();
        fs::set_permissions(&script, fs::Permissions::from_mode(0o700)).unwrap();
        crate::test_stub::settle_stub(&script);
        let env = EnvGuard::set(&[
            ("OI_QL_FIELD_HOST_BIN", Some(script.as_os_str())),
            ("OI_QL_FIELD_WORKER_BIN", Some(script.as_os_str())),
        ]);
        let mut manager = Manager::default();
        let result = manager.open(&json!({"schema":"oi.native-expression-binding/v1","host":{"instance_ref":"test:instance"},"presentation":{"units_per_metre":1,"slots_a":[0],"slots_b":[0]}}).to_string(), Value::Null);
        drop(env);
        result.unwrap();
        let started = std::time::Instant::now();
        drop(manager);
        assert!(
            started.elapsed() < Duration::from_secs(3),
            "owned descendant kept native pipes alive"
        );
        fs::remove_dir_all(dir).unwrap();
    }
    fn where_reading(companions: Value) -> Vec<u8> {
        serde_json::to_vec(&json!({"schema":"oi.product-location/v1","product":"quaternal-logic",
            "executable":"/oi/products/quaternal-logic/abc/bin/ql","sha256":"q","companions":companions})).unwrap()
    }
    #[test]
    fn installed_ql_resolves_the_executable_and_every_present_companion() {
        let installed = InstalledQl::parse(&where_reading(json!({
            "ql-field-host":{"executable":"/oi/products/quaternal-logic/abc/bin/ql-field-host","present":true,"sha256":"a"},
            "ql-focused-host":{"executable":"/oi/products/quaternal-logic/abc/bin/ql-focused-host","present":false,"sha256":null},
            "ql-field-worker":{"executable":"/oi/products/quaternal-logic/abc/bin/ql-field-worker","present":true,"sha256":"b"},
            "ql-sky":{"executable":"/oi/products/quaternal-logic/abc/bin/ql-sky","present":true,"sha256":"c"}
        }))).unwrap();
        let bin = PathBuf::from("/oi/products/quaternal-logic/abc/bin");
        assert_eq!(installed.executable().unwrap(), bin.join("ql"));
        assert_eq!(
            installed
                .require(&["ql-field-host", "ql-field-worker"])
                .unwrap(),
            vec![bin.join("ql-field-host"), bin.join("ql-field-worker")]
        );
        assert_eq!(installed.companion("ql-sky").unwrap(), bin.join("ql-sky"));
        assert_eq!(installed.companions.len(), 4);
        assert!(installed.companions["ql-focused-host"].is_err());
    }
    #[test]
    fn installed_ql_names_exactly_what_is_missing() {
        let installed = InstalledQl::parse(&where_reading(json!({
            "ql-field-host":{"executable":"/oi/bin/ql-field-host","present":true,"sha256":"a"},
            "ql-field-worker":{"executable":"/oi/bin/ql-field-worker","present":false,"sha256":null},
            "ql-sky":{"executable":"bin/ql-sky","present":true,"sha256":"c"},
            "ql-focused-host":{"present":true}
        }))).unwrap();
        let absent = installed
            .require(&["ql-field-host", "ql-field-worker"])
            .unwrap_err();
        assert!(
            absent.starts_with("native-expression.unavailable: "),
            "{absent}"
        );
        assert!(
            absent.contains("ql-field-worker is not installed at /oi/bin/ql-field-worker"),
            "{absent}"
        );
        assert!(!absent.contains("ql-field-host"), "{absent}");
        let relative = installed.companion("ql-sky").unwrap_err();
        assert!(
            relative.contains("ql-sky path bin/ql-sky is not absolute"),
            "{relative}"
        );
        let pathless = installed.companion("ql-focused-host").unwrap_err();
        assert!(
            pathless.contains("ql-focused-host has no executable path"),
            "{pathless}"
        );

        // A suite that predates companions declares none: each asked-for name is named.
        let legacy = InstalledQl::parse(
            br#"{"schema":"oi.product-location/v1","executable":"/x/ql","sha256":"q"}"#,
        )
        .unwrap();
        assert_eq!(legacy.executable().unwrap(), PathBuf::from("/x/ql"));
        let undeclared = legacy
            .require(&["ql-field-host", "ql-field-worker"])
            .unwrap_err();
        assert!(
            undeclared.contains("declares no ql-field-host")
                && undeclared.contains("declares no ql-field-worker"),
            "{undeclared}"
        );

        // The primary needs an absolute, digested install.
        let unfound = InstalledQl::parse(
            br#"{"schema":"oi.product-location/v1","executable":"ql","sha256":null}"#,
        )
        .unwrap();
        assert!(unfound
            .executable()
            .unwrap_err()
            .contains("quaternal-logic path ql is not absolute"));
        let undigested = InstalledQl::parse(
            br#"{"schema":"oi.product-location/v1","executable":"/x/ql","sha256":null}"#,
        )
        .unwrap();
        assert!(undigested
            .executable()
            .unwrap_err()
            .contains("quaternal-logic is not installed at /x/ql"));

        let malformed = InstalledQl::parse(b"not json").unwrap_err();
        assert!(
            malformed.starts_with("native-expression.unavailable: ")
                && malformed.contains("not JSON"),
            "{malformed}"
        );
        let foreign = InstalledQl::parse(br#"{"schema":"other/v1"}"#).unwrap_err();
        assert!(foreign.contains("oi.product-location/v1"), "{foreign}");
    }
    #[cfg(unix)]
    #[test]
    fn the_where_query_is_bounded_and_its_failures_are_unavailable() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("native-where-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let script = |name: &str, body: &str| {
            let path = dir.join(name);
            fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
            fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
            crate::test_stub::settle_stub(&path);
            path
        };
        let answers = script(
            "answers",
            r#"[ "$*" = "where quaternal-logic --json" ] && echo '{"schema":"oi.product-location/v1"}'"#,
        );
        assert_eq!(
            run_where(answers.as_os_str(), Duration::from_secs(10)).unwrap(),
            b"{\"schema\":\"oi.product-location/v1\"}\n"
        );
        let fails = script("fails", "exit 3");
        let error = run_where(fails.as_os_str(), Duration::from_secs(10)).unwrap_err();
        assert!(
            error.starts_with("native-expression.unavailable: ") && error.contains("exited"),
            "{error}"
        );
        let hangs = script("hangs", "exec sleep 30");
        let started = std::time::Instant::now();
        let error = run_where(hangs.as_os_str(), Duration::from_millis(300)).unwrap_err();
        assert!(error.contains("did not answer within 300ms"), "{error}");
        assert!(started.elapsed() < Duration::from_secs(5));
        let error = run_where(dir.join("absent").as_os_str(), Duration::from_secs(1)).unwrap_err();
        assert!(error.contains("cannot start"), "{error}");
        fs::remove_dir_all(dir).unwrap();
    }
    fn valid() -> Value {
        json!({"texture":[256,256],"units_per_metre":400,"sky":"none"})
    }
    #[test]
    fn compose_request_is_bounded_and_closed() {
        let ok = compose_request(&valid()).unwrap();
        assert_eq!(ok.texture, [256, 256]);
        assert_eq!(ok.units_per_metre, 400.0);
        assert_eq!(ok.sky, Sky::None);
        assert_eq!(ok.event, None);
        let full = compose_request(&json!({"texture":[1024,1024],"units_per_metre":0.5,
            "sky":{"epoch":"2026-09-27T12:00:00+05:30"},"event":{"m1":{}}}))
        .unwrap();
        assert_eq!(full.sky, Sky::Epoch("2026-09-27T12:00:00+05:30".into()));
        assert_eq!(full.event, Some(json!({"m1":{}})));
        assert_eq!(
            compose_request(&json!({"texture":[1,1],"units_per_metre":1e6,"sky":"now"}))
                .unwrap()
                .sky,
            Sky::Now
        );
        let with = |key: &str, value: Value| {
            let mut v = valid();
            v[key] = value;
            v
        };
        let mut missing_sky = valid();
        missing_sky.as_object_mut().unwrap().remove("sky");
        for (bad, why) in [
            (json!([]), "request must be an object"),
            (
                with("executable", json!("/bin/sh")),
                "unknown key executable",
            ),
            (with("geometry", json!({})), "unknown key geometry"),
            (with("texture", json!([0, 4])), "texture"),
            (with("texture", json!([4])), "texture"),
            (with("texture", json!([4, 4, 4])), "texture"),
            (with("texture", json!([-1, 4])), "texture"),
            (with("texture", json!([2.5, 4])), "texture"),
            (with("texture", json!(["4", 4])), "texture"),
            (with("texture", json!([1025, 1024])), "at most 1048576"),
            (with("texture", json!([1_048_577, 1])), "texture"),
            (with("units_per_metre", json!(0)), "units_per_metre"),
            (with("units_per_metre", json!(-1)), "units_per_metre"),
            (with("units_per_metre", json!(1_000_001)), "units_per_metre"),
            (with("units_per_metre", json!("400")), "units_per_metre"),
            (
                missing_sky,
                "exactly one sky selector or sky_snapshot is required",
            ),
            (
                with("sky_snapshot", json!({})),
                "exactly one sky selector or sky_snapshot is required",
            ),
            (with("sky", json!("later")), "sky must be"),
            (with("sky", json!(null)), "sky must be"),
            (
                with(
                    "sky",
                    json!({"epoch":"2026-09-27T12:00:00Z","mode":"current"}),
                ),
                "sky must be",
            ),
            (
                with("sky", json!({"when":"2026-09-27T12:00:00Z"})),
                "sky must be",
            ),
            (
                with("sky", json!({"epoch":"2026-09-27T12:00:00.5Z"})),
                "RFC 3339",
            ),
            (
                with("sky", json!({"epoch":"2026-09-27T12:00:00"})),
                "RFC 3339",
            ),
            (
                with("sky", json!({"epoch":"2026-02-30T12:00:00Z"})),
                "RFC 3339",
            ),
            (with("sky", json!({"epoch":1_790_510_400})), "RFC 3339"),
            (with("event", json!(null)), "event must be an object"),
            (with("event", json!("default")), "event must be an object"),
        ] {
            let error = compose_request(&bad).unwrap_err();
            assert!(
                error.starts_with("native-expression.invalid_compose: ") && error.contains(why),
                "{bad} -> {error}"
            );
        }
        assert!(serde_json::from_value::<Request>(
            json!({"operation":"compose","request":valid(),"executable":"/bin/sh"})
        )
        .is_err());
        assert_eq!(
            serde_json::from_value::<Request>(json!({"operation":"compose","request":valid()}))
                .unwrap(),
            Request::Compose { request: valid() }
        );
    }
    #[test]
    fn epochs_are_whole_second_calendar_instants() {
        assert_eq!(rfc3339_whole_second("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(
            rfc3339_whole_second("2026-09-27T12:00:00Z"),
            Some(1_790_510_400)
        );
        assert_eq!(
            rfc3339_whole_second("2026-09-27T17:30:00+05:30"),
            Some(1_790_510_400)
        );
        assert_eq!(
            rfc3339_whole_second("2026-09-27T07:00:00-05:00"),
            Some(1_790_510_400)
        );
        assert_eq!(
            rfc3339_whole_second("2024-02-29T00:00:00Z"),
            Some(1_709_164_800)
        );
        for bad in [
            "2023-02-29T00:00:00Z",
            "2026-13-01T00:00:00Z",
            "2026-09-27T24:00:00Z",
            "2026-09-27T12:60:00Z",
            "2026-09-27T12:00:60Z",
            "2026-09-27 12:00:00Z",
            "2026-09-27t12:00:00z",
            "2026-09-27T12:00:00.000Z",
            "2026-09-27T12:00:00+0530",
            "2026-09-27T12:00:00+24:00",
            "+026-09-27T12:00:00Z",
            "2026-09-27T12:00:00Ż",
            "",
        ] {
            assert_eq!(rfc3339_whole_second(bad), None, "{bad}");
        }
        for t in [0, 951_782_400, 1_709_164_800, 1_790_510_400, 4_102_444_799] {
            assert_eq!(rfc3339_whole_second(&utc_whole_second(t)), Some(t));
        }
        assert_eq!(utc_whole_second(1_790_510_401), "2026-09-27T12:00:01Z");
    }
    #[test]
    fn sky_request_is_built_by_the_kernel() {
        assert_eq!(sky_request(&Sky::None, 1_790_510_400), None);
        let now = sky_request(&Sky::Now, 1_790_510_400).unwrap();
        assert_eq!(
            now,
            json!({"schema":"ql.sky-request/v1","epoch":"2026-09-27T12:00:00Z","timezone":"UTC",
                "mode":"current","perspective":"Apparent Geocentric","zodiac":"Tropical",
                "ayanamsha":null,"observer":null,"max_age_seconds":3600,"backend_policy":"allow-moshier"})
        );
        let dated = sky_request(&Sky::Epoch("1999-01-01T00:00:00+01:00".into()), 0).unwrap();
        assert_eq!(dated["mode"], "historical");
        assert_eq!(dated["epoch"], "1999-01-01T00:00:00+01:00");
        assert_eq!(
            sky_error(br#"{"schema": "ql.sky-error/v1", "error": "invalid request fields", "snapshot": null}"#),
            "invalid request fields"
        );
        assert_eq!(sky_error(b"  uv: cannot fetch\n"), "uv: cannot fetch");
        assert_eq!(sky_error(b""), "no diagnostic");
    }
    #[test]
    fn exchange_admits_scene_determinant_operations_only_by_name() {
        for op in EXCHANGE_OPERATIONS {
            assert!(
                exchange_admits(&json!({"command":{"operation":op}})),
                "{op}"
            );
        }
        for op in ["m1-advance", "replace-event", "influence"] {
            assert!(exchange_admits(&json!({"command":{"operation":op}})));
        }
        for op in ["shutdown", "restart", "compose", "open", "", "M1-advance"] {
            assert!(
                !exchange_admits(&json!({"command":{"operation":op}})),
                "{op}"
            );
        }
        assert!(!exchange_admits(&json!({"command":"read"})));
    }
    #[test]
    fn exchange_admission_keeps_identity_and_sequence_for_new_operations() {
        // A live stub owner: its receipts echo the request id. The new K²
        // operations pass the same lease/identity/sequence gates as read.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let dir =
                std::env::temp_dir().join(format!("native-admission-test-{}", std::process::id()));
            fs::create_dir_all(&dir).unwrap();
            let script = dir.join("host.py");
            fs::write(&script, r#"#!/usr/bin/env python3
import json,sys
base={'schema':'ql.field-host-receipt/v1','available':True,'instance_ref':'test:instance','field':{'event_ref':'test:event','subject_ref':'test:subject','generation':'0','samples_elapsed':'0'}}
print(json.dumps(dict(base,status='ready',last_request_id='0')),flush=True)
for line in sys.stdin:
  r=json.loads(line)
  print(json.dumps(dict(base,status='ok',request_id=r['request_id'],last_request_id=r['request_id'],op=r['command']['operation'])),flush=True)
"#).unwrap();
            fs::set_permissions(&script, fs::Permissions::from_mode(0o700)).unwrap();
            crate::test_stub::settle_stub(&script);
            let _env = EnvGuard::set(&[
                ("OI_QL_FIELD_HOST_BIN", Some(script.as_os_str())),
                ("OI_QL_FIELD_WORKER_BIN", Some(script.as_os_str())),
            ]);
            let mut manager = Manager::default();
            let opened = manager.open(&json!({"schema":"oi.native-expression-binding/v1","host":{"instance_ref":"test:instance"},"presentation":{"units_per_metre":1,"slots_a":[0],"slots_b":[0]}}).to_string(), Value::Null).unwrap();
            let lease = opened["lease"].as_str().unwrap().to_owned();
            let client = CentralClient::with("/nonexistent".into(), None, String::new());
            let packet = |id: &str, command: Value, subject: &str| {
                json!({"schema":"ql.field-host-request/v1",
                "instance_ref":"test:instance","event_ref":"test:event","subject_ref":subject,
                "request_id":id,"command":command})
            };
            let mut exchange = |id: &str, command: Value, subject: &str| {
                manager.apply(
                    &client,
                    Request::Exchange {
                        lease: lease.clone(),
                        request: packet(id, command, subject),
                    },
                )
            };
            let reply = exchange(
                "1",
                json!({"operation":"m1-advance","ticks":1}),
                "test:subject",
            )
            .unwrap();
            assert_eq!(reply["op"], "m1-advance");
            assert!(
                exchange("1", json!({"operation":"influence"}), "test:subject")
                    .unwrap_err()
                    .contains("stale_request")
            );
            assert!(exchange("2", json!({"operation":"influence"}), "foreign")
                .unwrap_err()
                .contains("foreign_subject_ref"));
            assert_eq!(
                exchange("2", json!({"operation":"influence"}), "test:subject").unwrap()["op"],
                "influence"
            );
            assert_eq!(
                exchange(
                    "3",
                    json!({"operation":"replace-event","event":{},"strike":true}),
                    "test:subject"
                )
                .unwrap()["op"],
                "replace-event"
            );
            assert!(
                exchange("4", json!({"operation":"shutdown"}), "test:subject")
                    .unwrap_err()
                    .contains("unsupported")
            );
            drop(manager);
            fs::remove_dir_all(dir).unwrap();
        }
    }

    /// Serialises environment mutation across this module's tests.
    static ENV_LOCK: Mutex<()> = Mutex::new(());
    struct EnvGuard {
        saved: Vec<(&'static str, Option<std::ffi::OsString>)>,
        _lock: std::sync::MutexGuard<'static, ()>,
    }
    impl EnvGuard {
        fn set(pairs: &[(&'static str, Option<&std::ffi::OsStr>)]) -> Self {
            let lock = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
            let saved = pairs
                .iter()
                .map(|(key, value)| {
                    let old = std::env::var_os(key);
                    match value {
                        Some(v) => std::env::set_var(key, v),
                        None => std::env::remove_var(key),
                    }
                    (*key, old)
                })
                .collect();
            Self { saved, _lock: lock }
        }
    }
    impl Drop for EnvGuard {
        fn drop(&mut self) {
            for (key, old) in self.saved.drain(..) {
                match old {
                    Some(v) => std::env::set_var(key, v),
                    None => std::env::remove_var(key),
                }
            }
        }
    }

    #[cfg(unix)]
    #[test]
    fn compose_runs_kernel_built_requests_through_argument_vectors() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("native-compose-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let script = |name: &str, body: &str| {
            let path = dir.join(name);
            fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
            fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
            crate::test_stub::settle_stub(&path);
            path
        };
        let log = dir.join("args");
        // The stub `ql` records its argv and request, then fails so no owner opens.
        let ql = script(
            "ql",
            &format!(
                r#"printf '%s\n' "$@" > '{log}'; cat "$3" > '{log}.request'; echo 'no event' >&2; exit 1"#,
                log = log.display()
            ),
        );
        let sky_ok = script(
            "sky-ok",
            r#"cp "$1" "$1.seen" 2>/dev/null; echo '{"schema":"ql.sky-snapshot/v1","snapshot_ref":"sha256:s","receipt_unix_ms":5,"bodies":[]}'"#,
        );
        let sky_err = script(
            "sky-err",
            r#"echo '{"schema": "ql.sky-error/v1", "error": "epoch is in the future", "snapshot": null}' >&2; exit 2"#,
        );
        let prepared =
            |manager: &mut Manager, request: Value| manager.prepare_compose(&request).unwrap();
        let mut manager = Manager::default();
        {
            let _env = EnvGuard::set(&[
                ("OI_QL_BIN", Some(ql.as_os_str())),
                ("OI_QL_SKY_BIN", Some(sky_ok.as_os_str())),
            ]);
            let error = prepared(
                &mut manager,
                json!({"texture":[2,3],"units_per_metre":400,
                "sky":{"epoch":"2026-09-27T12:00:00Z"},"event":{"m1":{"row12":3}}}),
            )
            .execute()
            .unwrap_err();
            assert!(
                error.starts_with("native-expression.compose_refused: ql scene binding exited"),
                "{error}"
            );
            assert!(error.contains("no event"), "{error}");
            let argv = fs::read_to_string(&log).unwrap();
            let argv: Vec<&str> = argv.lines().collect();
            assert_eq!(&argv[..2], ["scene", "binding"]);
            assert_eq!(argv[3], "--json");
            assert!(
                !std::path::Path::new(argv[2]).exists(),
                "request file must be removed"
            );
            let sent: Value =
                serde_json::from_slice(&fs::read(format!("{}.request", log.display())).unwrap())
                    .unwrap();
            assert_eq!(sent["schema"], "ql.scene-binding-request/v1");
            assert_eq!(sent["texture"], json!([2, 3]));
            assert_eq!(sent["units_per_metre"], 400.0);
            assert_eq!(sent["event"], json!({"m1":{"row12":3}}));
            assert_eq!(sent["sky"]["snapshot_ref"], "sha256:s");
            assert!(sent["instance_ref"]
                .as_str()
                .unwrap()
                .starts_with("oi:native-expression/native-compose-"));
            assert_eq!(sent.as_object().unwrap().len(), 6);
        }
        {
            let _env = EnvGuard::set(&[
                ("OI_QL_BIN", Some(ql.as_os_str())),
                ("OI_QL_SKY_BIN", Some(sky_err.as_os_str())),
            ]);
            let error = prepared(
                &mut manager,
                json!({"texture":[1,1],"units_per_metre":1,"sky":"now"}),
            )
            .execute()
            .unwrap_err();
            assert_eq!(
                error,
                "native-expression.unavailable: dated sky: epoch is in the future"
            );
            // No sky: ql-sky is never run, and the sky key is absent.
            let error = prepared(
                &mut manager,
                json!({"texture":[1,1],"units_per_metre":1,"sky":"none"}),
            )
            .execute()
            .unwrap_err();
            assert!(error.contains("compose_refused"), "{error}");
            let sent: Value =
                serde_json::from_slice(&fs::read(format!("{}.request", log.display())).unwrap())
                    .unwrap();
            assert!(
                sent.get("sky").is_none() && sent.get("event").is_none(),
                "{sent}"
            );
        }
        {
            let _env =
                EnvGuard::set(&[("OI_QL_BIN", Some(ql.as_os_str())), ("OI_QL_SKY_BIN", None)]);
            let error = prepared(
                &mut manager,
                json!({"texture":[1,1],"units_per_metre":1,"sky":"none"}),
            )
            .execute()
            .unwrap_err();
            assert!(error.contains("override together"), "{error}");
        }
        {
            let _env = EnvGuard::set(&[
                ("OI_QL_BIN", Some("relative/ql".as_ref())),
                ("OI_QL_SKY_BIN", Some(sky_ok.as_os_str())),
            ]);
            let error = prepared(
                &mut manager,
                json!({"texture":[1,1],"units_per_metre":1,"sky":"none"}),
            )
            .execute()
            .unwrap_err();
            assert!(error.contains("absolute"), "{error}");
        }
        fs::remove_dir_all(dir).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn bounded_runs_kill_the_whole_group_and_cap_output() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("native-bounded-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let script = |name: &str, body: &str| {
            let path = dir.join(name);
            fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
            fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
            crate::test_stub::settle_stub(&path);
            path
        };
        // A descendant holding stdout past the parent's kill (uv-like).
        let hangs = script("hangs", "sleep 30 & sleep 30");
        let started = std::time::Instant::now();
        let error =
            run_bounded(hangs.as_os_str(), &[], Duration::from_millis(300), 10).unwrap_err();
        assert!(matches!(error, RunError::Timeout), "{error:?}");
        assert!(started.elapsed() < Duration::from_secs(5));
        let floods = script("floods", "head -c 100000 /dev/zero");
        assert!(matches!(
            run_bounded(floods.as_os_str(), &[], Duration::from_secs(10), 1000).unwrap_err(),
            RunError::Overflow
        ));
        let speaks = script("speaks", "echo out; echo err >&2; exit 4");
        let ran = run_bounded(speaks.as_os_str(), &[], Duration::from_secs(10), 1000).unwrap();
        assert_eq!(
            (ran.stdout.as_slice(), ran.stderr.as_slice()),
            (&b"out\n"[..], &b"err\n"[..])
        );
        assert_eq!(ran.status.code(), Some(4));
        fs::remove_dir_all(dir).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn oi_resolves_override_then_path_then_managed_activation() {
        use std::ffi::OsString;
        use std::os::unix::fs::PermissionsExt;
        let root = std::env::temp_dir().join(format!("native-oi-resolve-{}", std::process::id()));
        let home = root.join("home");
        let managed = home.join(".local/bin");
        let path_dir = root.join("path");
        fs::create_dir_all(&managed).unwrap();
        fs::create_dir_all(&path_dir).unwrap();
        let exe = |p: PathBuf| {
            fs::write(&p, "#!/bin/sh\n").unwrap();
            fs::set_permissions(&p, fs::Permissions::from_mode(0o755)).unwrap();
        };
        exe(managed.join("oi"));
        let launchd = OsString::from("/usr/bin:/bin:/usr/sbin:/sbin");
        let h = Some(home.clone().into_os_string());
        // Explicit override always wins.
        assert_eq!(
            resolve_oi(Some("/x/oi".into()), Some(launchd.clone()), h.clone()),
            PathBuf::from("/x/oi")
        );
        // Finder/Dock PATH: the managed activation link.
        assert_eq!(
            resolve_oi(None, Some(launchd.clone()), h.clone()),
            managed.join("oi")
        );
        assert_eq!(
            resolve_oi(Some("".into()), None, h.clone()),
            managed.join("oi")
        );
        // A shell PATH that holds `oi` keeps the bare name.
        exe(path_dir.join("oi"));
        let shell = std::env::join_paths([path_dir.clone(), "/usr/bin".into()]).unwrap();
        assert_eq!(
            resolve_oi(None, Some(shell), h.clone()),
            PathBuf::from("oi")
        );
        // No managed link, no HOME, or a non-executable file: the bare name,
        // whose spawn failure names it.
        assert_eq!(
            resolve_oi(None, Some(launchd.clone()), None),
            PathBuf::from("oi")
        );
        fs::set_permissions(managed.join("oi"), fs::Permissions::from_mode(0o644)).unwrap();
        assert_eq!(resolve_oi(None, Some(launchd), h), PathBuf::from("oi"));
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn requests_cannot_choose_programs() {
        assert!(serde_json::from_value::<Request>(json!({"operation":"open","path":"binding.json","expected_revision":"r1","executable":"/bin/sh"})).is_err());
        assert!(
            serde_json::from_value::<Request>(json!({"operation":"restart","lease":"x"})).is_err()
        );
    }
    /// Run explicitly against retained production input and real installed or
    /// operator-qualified QL companions; this cannot pass with a fixture CLI.
    #[test]
    #[ignore = "requires an actual retained native compose request and real QL companions"]
    fn actual_qualified_world_opens_the_native_worker_without_losing_source() {
        let input = std::env::var("OI_NATIVE_WORLD_REPLAY_REQUEST")
            .expect("set OI_NATIVE_WORLD_REPLAY_REQUEST to the retained production request");
        let packet: Value = serde_json::from_slice(&fs::read(input).unwrap()).unwrap();
        let request = &packet["request"]["request"]["request"];
        assert!(request["world"].is_object());
        let mut manager = Manager::default();
        let composed = manager.prepare_world(request).unwrap().execute().unwrap();
        let content = composed.binding_content().to_owned();
        let source = composed.source().clone();
        let opening = composed.world_opening.as_ref().unwrap().clone();
        let prepared = manager.finish_compose(composed).unwrap();
        assert_eq!(prepared["binding"], source["world"]["binding"]);
        assert_eq!(source["constructor_request"], opening.constructor_request);
        assert_eq!(source["binding_sha256"], sha256_hex(content.as_bytes()));
        assert_eq!(
            source["constructor_request_bytes"],
            opening.constructor_request_bytes
        );
        assert_eq!(
            source["request_sha256"],
            sha256_hex(opening.constructor_request_bytes.as_bytes())
        );
        assert_eq!(
            serde_json::from_str::<Value>(&opening.constructor_request_bytes).unwrap(),
            opening.constructor_request
        );
        assert_eq!(prepared["binding"].as_object().unwrap().len(), 6);
        assert!(manager.active.is_none());
        let full: Value = serde_json::from_str(&content).unwrap();
        let projected: Value =
            serde_json::from_str(&composed_worker_binding(&content, &source).unwrap()).unwrap();
        assert_eq!(projected.as_object().unwrap().len(), 3);
        for key in ["schema", "host", "presentation"] {
            assert_eq!(projected[key], full[key]);
        }
        let mut mutants = Vec::new();
        for key in ["native_basis", "scene", "native_readback", "host"] {
            let mut changed = full.clone();
            changed[key]["foreign_revision"] = json!("foreign:source");
            mutants.push(changed);
        }
        let mut unknown = full.clone();
        unknown["unknown"] = json!(true);
        mutants.push(unknown);
        let mut missing = full.clone();
        missing.as_object_mut().unwrap().remove("native_basis");
        mutants.push(missing);
        let mut instance = full.clone();
        instance["host"]["instance_ref"] = json!("foreign:instance");
        mutants.push(instance);
        for mutant in mutants {
            let error = manager
                .finish_compose(ComposedBinding {
                    content: mutant.to_string(),
                    source: source.clone(),
                    finish: ComposeFinish::Open,
                    world_opening: Some(opening.clone()),
                })
                .unwrap_err();
            assert!(error.contains("compose_refused"), "{error}");
            assert!(manager.active.is_none());
            assert_eq!(manager.sequence, 0);
        }
        let mut missing_constructor = source.clone();
        missing_constructor
            .as_object_mut()
            .unwrap()
            .remove("constructor_request");
        assert!(opening
            .configuration(&missing_constructor, &full["host"], "native-test-only")
            .is_err());
        let mut missing_constructor_bytes = source.clone();
        missing_constructor_bytes
            .as_object_mut()
            .unwrap()
            .remove("constructor_request_bytes");
        assert!(opening
            .configuration(
                &missing_constructor_bytes,
                &full["host"],
                "native-test-only"
            )
            .is_err());
        let mut changed_constructor_bytes = source.clone();
        changed_constructor_bytes["constructor_request_bytes"] =
            json!(format!("{} ", opening.constructor_request_bytes));
        assert!(opening
            .configuration(
                &changed_constructor_bytes,
                &full["host"],
                "native-test-only"
            )
            .is_err());
        let mut changed_binding_receipt = source.clone();
        changed_binding_receipt["binding_sha256"] = json!("0".repeat(64));
        assert!(composed_worker_binding(&content, &changed_binding_receipt).is_err());
        for key in ["basis", "scene", "native_readback", "instance_ref"] {
            let mut changed = source.clone();
            changed["world"][key] = json!("foreign:source");
            assert!(composed_worker_binding(&content, &changed).is_err());
        }
        assert!(manager
            .open(&content, source.clone())
            .unwrap_err()
            .contains("unknown field"));
        assert_eq!(manager.sequence, 0);
        let opened = manager
            .finish_compose(ComposedBinding {
                content,
                source: source.clone(),
                finish: ComposeFinish::Open,
                world_opening: Some(opening),
            })
            .unwrap();
        assert_eq!(opened["source"], source);
        assert_eq!(
            opened["native_host_configuration"]["schema"],
            "ql.field-host-world-config/v1"
        );
        let mut domain_request = source["constructor_request"].clone();
        domain_request
            .as_object_mut()
            .unwrap()
            .remove("snapshot_purpose");
        assert_eq!(
            opened["native_host_configuration"]["world_request"],
            domain_request
        );
        assert_eq!(
            opened["receipt"]["instance_ref"],
            request["world"]["instance_ref"]
        );
        assert_eq!(opened["receipt"]["status"], "ready");
        assert_eq!(opened["receipt"]["available"], true);
        let owner = manager.active.as_ref().unwrap();
        assert_eq!(owner.identity["event_ref"], source["world"]["event_ref"]);
        assert_eq!(
            owner.identity["subject_ref"],
            source["world"]["subject_ref"]
        );
        let read = json!({"schema":"ql.field-host-request/v1",
            "instance_ref":owner.identity["instance_ref"],
            "event_ref":owner.identity["event_ref"],
            "subject_ref":owner.identity["subject_ref"],
            "request_id":(owner.last_request_id + 1).to_string(),
            "expected_generation":opened["receipt"]["field"]["generation"],
            "expected_samples_elapsed":opened["receipt"]["field"]["samples_elapsed"],
            "command":{"operation":"read"}});
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let client = CentralClient::with("/nonexistent".into(), None, String::new());
        let received = manager
            .apply(
                &client,
                Request::Exchange {
                    lease: lease.clone(),
                    request: read,
                },
            )
            .unwrap();
        assert_eq!(received["available"], true);
        assert_eq!(received["status"], "ok");
        manager.apply(&client, Request::Close { lease }).unwrap();
        assert!(manager.active.is_none());
        let mut unsupported = request.clone();
        unsupported.as_object_mut().unwrap().remove("world");
        assert!(manager
            .prepare_compose(&unsupported)
            .unwrap_err()
            .contains("qualified world contract"));
        if let Ok(output) = std::env::var("OI_NATIVE_WORLD_REPLAY_OUTPUT") {
            fs::write(
                output,
                serde_json::to_vec_pretty(
                    &json!({"prepared":prepared,"opened":opened,"received":received}),
                )
                .unwrap(),
            )
            .unwrap();
        }
    }
    /// Actual public World constructor -> same existing native host/worker
    /// lease -> source-form/sparse preparation. It does not assert device sound.
    #[test]
    #[ignore = "requires actual World source, native configuration and qualified QL host/worker"]
    fn actual_world_performance_activation_keeps_native_source_and_lease() {
        let path =
            std::env::var("OI_NATIVE_WORLD_REPLAY_REQUEST").expect("actual World replay request");
        let packet: Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
        let requested = &packet["request"]["request"]["request"];
        assert!(requested["world"].is_object());
        let config_path = std::env::var("OI_NATIVE_PERFORMANCE_CONFIG")
            .expect("actual retained native performance configuration");
        let retained: Value = serde_json::from_slice(&fs::read(config_path).unwrap()).unwrap();
        let mut config = if retained["schema"] == "ql.retained-source-performance-config/v1" {
            retained
        } else {
            retained["source_assets"]["configuration"].clone()
        };
        assert_eq!(config["schema"], "ql.retained-source-performance-config/v1");
        assert!(config["sparse_condition"].is_object());
        let mut manager = Manager::default();
        let mut composed = manager.prepare_world(requested).unwrap().execute().unwrap();
        let source = composed.source.clone();
        let opening = composed.world_opening.as_ref().unwrap();
        assert_eq!(opening.constructor_request, source["constructor_request"]);
        config["controls"]["expected_m3_generation"] =
            source["world"]["basis"]["m3"]["identity"]["profile_generation"].clone();
        assert!(config["controls"]["expected_m3_generation"].is_u64());
        composed.finish = ComposeFinish::Open;
        let opened = manager.finish_compose(composed).unwrap();
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let owner_pid = manager.active.as_ref().unwrap().child.id();
        let command = json!({"operation":"performance-prepare","config":config});
        let request = json!({"schema":"ql.field-host-request/v1",
            "instance_ref":opened["receipt"]["instance_ref"],
            "event_ref":opened["receipt"]["field"]["event_ref"],
            "subject_ref":opened["receipt"]["field"]["subject_ref"],
            "request_id":"1", "expected_generation":opened["receipt"]["field"]["generation"],
            "expected_samples_elapsed":opened["receipt"]["field"]["samples_elapsed"], "command":command});
        // Public World needs no identity source read; this client cannot supply
        // a private profile, source witness, device timestamp or fake host.
        let client = CentralClient::with("/nonexistent".into(), None, String::new());
        let prepared = manager
            .apply(
                &client,
                Request::Exchange {
                    lease: lease.clone(),
                    request,
                },
            )
            .unwrap();
        assert_eq!(prepared["status"], "ok", "{prepared}");
        assert_eq!(prepared["performance"]["accepted"], true, "{prepared}");
        let reading = &prepared["performance"]["reading"];
        assert_eq!(
            reading["physical"]["node_ids"].as_array().unwrap().len(),
            12
        );
        assert_eq!(reading["keys"].as_array().unwrap().len(), 36);
        assert_eq!(
            reading["keys"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|key| key["available"] == true)
                .count(),
            21
        );
        assert_eq!(reading["samples_elapsed"], "0");
        assert_eq!(reading["physical"]["samples_elapsed"], "0");
        assert_eq!(
            reading["consumer_roles"]["personal_nine_force_routes"]["available"],
            false
        );
        let owner = manager.active.as_ref().unwrap();
        assert_eq!(owner.lease, lease);
        assert_eq!(owner.child.id(), owner_pid);
        let inspect = json!({"schema":"ql.field-host-request/v1",
            "instance_ref":owner.identity["instance_ref"],"event_ref":owner.identity["event_ref"],"subject_ref":owner.identity["subject_ref"],
            "request_id":"2","expected_generation":prepared["field"]["generation"],
            "expected_samples_elapsed":prepared["field"]["samples_elapsed"],"command":{"operation":"inspect"}});
        let inspected = manager
            .apply(
                &client,
                Request::Exchange {
                    lease: lease.clone(),
                    request: inspect,
                },
            )
            .unwrap();
        let assets = &inspected["performance_sources"];
        assert_eq!(assets["source_context"]["available"], true, "{assets}");
        assert_eq!(assets["source_context"]["context"]["kind"], "world");
        assert_eq!(
            assets["current_receiving"]["source_inputs"],
            assets["receiving_source_inputs"]
        );
        assert_eq!(
            assets["receiving_source_inputs"]["world_request"]["sky"],
            source["world"]["sky"]
        );
        assert_eq!(
            assets["current_receiving"]["source_payload_context"]["private"],
            false
        );
        assert!(assets["receiving_source_inputs"]["identity_profile"].is_null());
        assert!(assets["receiving_source_inputs"]["original_occasion"].is_null());
        assert_eq!(manager.active.as_ref().unwrap().child.id(), owner_pid);
        manager.apply(&client, Request::Close { lease }).unwrap();
        assert!(manager.active.is_none());
    }
}
