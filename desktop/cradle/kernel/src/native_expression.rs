//! One explicitly opened QL material owner behind the normal kernel seam.
//! No UI-supplied executable, model, numerical approximation, source write or
//! automatic restart. The native host validates domain inputs and acknowledgments.
use crate::{files, CentralClient};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
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

const MAX_REQUEST: usize = 32 * 1024 * 1024;
const MAX_REPLY: usize = 64 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Open {
        path: String,
        expected_revision: String,
    },
    Exchange {
        lease: String,
        request: Value,
    },
    /// Observe the last acknowledged field without issuing a worker request.
    /// Every fence names the same live owner and exact acknowledged cursor.
    Observe {
        lease: String,
        instance_ref: String,
        event_ref: String,
        subject_ref: String,
        expected_generation: String,
        expected_samples_elapsed: String,
        #[serde(default)]
        expected_request_id: Option<String>,
    },
    Close {
        lease: String,
    },
    /// Ask QL to compose a K² binding from a bounded consumer request, then
    /// open it exactly as `Open` does. The request never names a program.
    Compose {
        request: Value,
    },
    /// Compose and return the atomic owner world without opening its native
    /// worker, audio device or retained GPU lease. The returned full sky can
    /// be reused by a later `Compose` so "now" is observed exactly once.
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
}

#[derive(Debug)]
struct Owner {
    lease: String,
    child: Child,
    tx: Option<mpsc::SyncSender<Value>>,
    rx: mpsc::Receiver<Result<Value, String>>,
    reader: Option<thread::JoinHandle<()>>,
    stderr_reader: Option<thread::JoinHandle<()>>,
    stderr: Arc<Mutex<Vec<u8>>>,
    config_path: PathBuf,
    identity: Value,
    last_request_id: u64,
    // One bounded field/ACK witness, never a trace or private source cache.
    observation: Result<Value, String>,
    stopped: bool,
}

impl Owner {
    fn retain_acknowledgement(&mut self, reply: &Value, request: Option<Value>) {
        // Observation failure must not turn a real accepted operation into
        // unknown standing. Its next passive read reports the exact failure.
        self.observation = (|| {
            let (bytes, digest) = crate::expression_act_storage::fingerprint(reply, MAX_REPLY)?;
            let at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_millis();
            let envelope = reply
                .as_object()
                .ok_or("native acknowledgement is not an object")?
                .iter()
                .filter(|(key, _)| {
                    [
                        "schema",
                        "status",
                        "available",
                        "standing",
                        "instance_ref",
                        "request_id",
                        "last_request_id",
                        "error",
                        "field",
                    ]
                    .contains(&key.as_str())
                })
                .map(|(key, value)| (key.clone(), value.clone()))
                .collect::<serde_json::Map<_, _>>();
            Ok(json!({
                "acknowledgement":envelope,
                "acknowledged_at_unix_ms":at,
                "acknowledgement_sha256":digest,
                "acknowledgement_serialized_byte_len":bytes,
                "request":request,
                "fingerprint_basis":"complete parsed native packet serialized as JSON; excludes transport newline",
                "inspect_sources_retained":false
            }))
        })();
    }
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
    let (mut status, mut output) = (None, None);
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
        if status.is_none() {
            match child.try_wait() {
                Ok(done) => status = done,
                Err(e) => {
                    kill(&mut child);
                    return Err(RunError::Io(e.to_string()));
                }
            }
        }
        if let (Some(status), true) = (status, output.is_some()) {
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
            let held = status.is_some();
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

impl Owner {
    fn stop(&mut self) {
        if self.stopped {
            return;
        }
        self.stopped = true;
        self.tx.take();
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
            Request::Open {
                path,
                expected_revision,
            } => {
                self.busy()?;
                if !nonempty(&path) || !nonempty(&expected_revision) {
                    return Err("explicit source path and revision required".into());
                }
                // Native Central's root is the empty relative path. Never
                // reinterpret an absolute source as a binding in this World.
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
                let request_bytes = serde_json::to_vec(&request).map_err(|e| e.to_string())?;
                if request_bytes.len() > MAX_REQUEST {
                    return Err("native request exceeds 32 MiB".into());
                }
                let request_observation = json!({
                    "operation":request["command"]["operation"],
                    "request_id":request["request_id"],
                    "sha256":format!("sha256:{:x}", Sha256::digest(&request_bytes)),
                    "serialized_byte_len":request_bytes.len()
                });
                drop(request_bytes);
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
                            && ["ok", "refused"]
                                .contains(&reply["status"].as_str().unwrap_or("")) =>
                    {
                        owner.last_request_id = id;
                        owner.retain_acknowledgement(&reply, Some(request_observation));
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
            Request::Observe {
                lease,
                instance_ref,
                event_ref,
                subject_ref,
                expected_generation,
                expected_samples_elapsed,
                expected_request_id,
            } => {
                let owner = self
                    .active
                    .as_mut()
                    .ok_or("native-expression.unavailable: no active owner")?;
                if lease != owner.lease {
                    return Err("native-expression.foreign_lease".into());
                }
                for (key, value) in [
                    ("instance_ref", instance_ref),
                    ("event_ref", event_ref),
                    ("subject_ref", subject_ref),
                ] {
                    if owner.identity[key].as_str() != Some(value.as_str()) {
                        return Err(format!("native-expression.foreign_{key}"));
                    }
                }
                if let Some(expected_request_id) = expected_request_id {
                    if cursor(&Value::String(expected_request_id))? != owner.last_request_id {
                        return Err("native-expression.stale_observation".into());
                    }
                }
                let field = &owner.observation.as_ref().map_err(|reason| {
                    format!("native-expression.observation_unavailable: {reason}")
                })?["acknowledgement"]["field"];
                if cursor(&Value::String(expected_generation))? != cursor(&field["generation"])?
                    || cursor(&Value::String(expected_samples_elapsed))?
                        != cursor(&field["samples_elapsed"])?
                {
                    return Err("native-expression.stale_observation".into());
                }
                if owner.child.try_wait().map_err(|e| e.to_string())?.is_some() {
                    self.active.take();
                    return Err("native-expression.unavailable: observed host has exited".into());
                }
                let observed_at = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map_err(|e| e.to_string())?
                    .as_millis();
                let retained = owner.observation.as_ref().map_err(|reason| {
                    format!("native-expression.observation_unavailable: {reason}")
                })?;
                let observation = json!({
                    "schema":"oi.native-expression-observation/v1",
                    "standing":"last-acknowledged field; no fresh native read",
                    "lease":owner.lease,
                    "identity":owner.identity,
                    "last_request_id":owner.last_request_id.to_string(),
                    "kernel_process_id":std::process::id(),
                    "native_host_process_id":owner.child.id(),
                    "host_has_not_exited":true,
                    "observed_at_unix_ms":observed_at,
                    "retained":retained
                });
                crate::expression_act_storage::measure(&observation, MAX_REPLY).map_err(
                    |reason| format!("native-expression.observation_unavailable: {reason}"),
                )?;
                Ok(observation)
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
                Ok(json!({"schema":"oi.native-expression-closed/v1","lease":lease,"closed":true}))
            }
        }
    }

    fn open(&mut self, content: &str, source: Value) -> Result<Value, String> {
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
        self.sequence = self
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
            self.sequence
        );
        let config_path = std::env::temp_dir().join(format!("{lease}.json"));
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&config_path).map_err(|e| e.to_string())?;
        if let Err(e) = serde_json::to_writer(&mut file, &binding.host)
            .and_then(|_| file.flush().map_err(serde_json::Error::io))
        {
            let _ = fs::remove_file(&config_path);
            return Err(e.to_string());
        }
        drop(file);
        let mut command = Command::new(host);
        command
            .arg(worker)
            .arg(&config_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
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
            child,
            tx: Some(tx),
            rx,
            reader: Some(reader),
            stderr_reader: Some(stderr_reader),
            stderr,
            config_path,
            identity: Value::Null,
            last_request_id: 0,
            observation: Err("native acknowledgement not yet received".into()),
            stopped: false,
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
        owner.last_request_id = cursor(&receipt["last_request_id"])?;
        owner.identity = json!({"instance_ref":receipt["instance_ref"],"event_ref":receipt["field"]["event_ref"],"subject_ref":receipt["field"]["subject_ref"]});
        if ["instance_ref", "event_ref", "subject_ref"]
            .iter()
            .any(|k| !nonempty(owner.identity[k].as_str().unwrap_or("")))
        {
            return Err("native owner omitted its identity".into());
        }
        owner.retain_acknowledgement(&receipt, None);
        self.active = Some(owner);
        Ok(
            json!({"schema":"oi.native-expression-open/v1","lease":lease,"source":source,"presentation":binding.presentation,"receipt":receipt,"checkpoint":"same-live-GPU-only; no process or native rewind"}),
        )
    }
}

/// Host operations a webview may relay. The K² determinant operations are
/// the host's own; a supplied (non-K²) owner refuses them natively.
const EXCHANGE_OPERATIONS: [&str; 9] = [
    "read",
    "inspect",
    "advance",
    "set-axis",
    "replace",
    "m1-advance",
    "replace-event",
    "set-damping",
    "influence",
];

fn exchange_admits(request: &Value) -> bool {
    EXCHANGE_OPERATIONS.contains(&request["command"]["operation"].as_str().unwrap_or(""))
}

const MAX_PARTICLES: u64 = 1_048_576;
const MAX_SKY: usize = 1024 * 1024;
const SKY_TIMEOUT: Duration = Duration::from_secs(120);
const BINDING_TIMEOUT: Duration = Duration::from_secs(30);
// Whole-world construction additionally resolves complete admitted Bimba
// material and native registers. It is a bounded cold construction operation,
// separate from realtime field exchanges and the legacy binding compiler.
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
        Sky::None => return None,
        Sky::Snapshot(_) => return None,
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
                // Failure-only source diagnostics; admission above is exact.
                let failed = [
                    ("basis_object", !basis.is_object()),
                    ("sky", world["sky"] != owner_request["sky"]),
                    ("world_event", world["event_ref"] != event_ref),
                    ("world_snapshot", world["snapshot_ref"] != event_ref),
                    ("world_subject", world["subject_ref"] != subject_ref),
                    ("world_instance", world["instance_ref"] != instance_ref),
                    (
                        "binding_instance",
                        world["binding"]["host"]["instance_ref"] != instance_ref,
                    ),
                    ("event_input", world["event"] != basis["input"]),
                    ("binding_basis", world["binding"]["native_basis"] != *basis),
                    ("binding_scene", world["binding"]["scene"] != world["scene"]),
                    (
                        "binding_readback",
                        world["binding"]["native_readback"] != world["native_readback"],
                    ),
                    (
                        "input_m1_event",
                        basis["input"]["m1"]["event_ref"] != event_ref,
                    ),
                    (
                        "input_m2_event",
                        basis["input"]["m2"]["stamp"]["identity"]["event_ref"] != event_ref,
                    ),
                    (
                        "input_m3_event",
                        basis["input"]["m3"]["stamp"]["identity"]["event_ref"] != event_ref,
                    ),
                    (
                        "input_m3_subject",
                        basis["input"]["m3"]["subject_ref"] != subject_ref,
                    ),
                    (
                        "basis_m1_event",
                        basis["m1"]["config"]["event_ref"] != event_ref,
                    ),
                    (
                        "basis_m2_event",
                        basis["m2"]["identity"]["event_ref"] != event_ref,
                    ),
                    (
                        "basis_m3_event",
                        basis["m3"]["identity"]["event_ref"] != event_ref,
                    ),
                    (
                        "basis_m3_subject",
                        basis["m3"]["subject_ref"] != subject_ref,
                    ),
                    ("scene_event", world["scene"]["event_ref"] != event_ref),
                    (
                        "scene_snapshot",
                        world["scene"]["snapshot_ref"] != event_ref,
                    ),
                    (
                        "scene_subject",
                        world["scene"]["subject_ref"] != subject_ref,
                    ),
                ]
                .into_iter()
                .filter_map(|(name, failed)| failed.then_some(name))
                .collect::<Vec<_>>();
                return Err(refused(scene_world_basis_diagnostic(
                    &failed,
                    &owner_request["sky"],
                    &world["sky"],
                )));
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
            "request_sha256":request_sha256,"composed_at_unix_ms":now_ms as u64});
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
        })
    }
}

// Failure diagnostics only: never consulted by sky/world admission. Bounded
// classes and redacted public-schema paths contain no source scalar values.
const SKY_DIAGNOSTIC_UNITS: usize = 4096;
const SKY_DIAGNOSTIC_SAMPLES: usize = 4;
const SKY_DIAGNOSTIC_PATH: usize = 80;
const SKY_DIAGNOSTIC_TOKEN: usize = 256;
const SKY_DIAGNOSTIC_ERROR: usize = 2048;

#[derive(Serialize)]
struct SkyDifferenceSample {
    path: String,
    class: &'static str,
    exact_decimal_equal: Option<bool>,
    finite_binary64_equal: Option<bool>,
}
#[derive(Serialize)]
struct SkyDifferenceAccount {
    budget_units: usize,
    value_pairs_examined: usize,
    differences: usize,
    classes: BTreeMap<&'static str, usize>,
    paths_omitted: usize,
    walk_complete: bool,
    numeric_classification_complete: bool,
    samples: Vec<SkyDifferenceSample>,
}
impl SkyDifferenceAccount {
    fn new() -> Self {
        Self {
            budget_units: 0,
            value_pairs_examined: 0,
            differences: 0,
            classes: [
                "type_changed",
                "member_missing",
                "array_item_missing",
                "text_changed",
                "other_scalar_changed",
                "number_spelling_only",
                "number_decimal_changed_same_binary64",
                "number_binary64_changed",
                "number_nonfinite_or_unrepresented",
                "number_unclassified",
            ]
            .into_iter()
            .map(|name| (name, 0))
            .collect(),
            paths_omitted: 0,
            walk_complete: true,
            numeric_classification_complete: true,
            samples: Vec::new(),
        }
    }
    fn unit(&mut self) -> bool {
        if self.budget_units == SKY_DIAGNOSTIC_UNITS {
            self.walk_complete = false;
            false
        } else {
            self.budget_units += 1;
            true
        }
    }
    fn note(&mut self, path: &str, class: &'static str, decimal: Option<bool>, bits: Option<bool>) {
        self.differences += 1;
        *self
            .classes
            .get_mut(class)
            .expect("declared diagnostic class") += 1;
        if self.samples.len() < SKY_DIAGNOSTIC_SAMPLES {
            self.samples.push(SkyDifferenceSample {
                path: path.into(),
                class,
                exact_decimal_equal: decimal,
                finite_binary64_equal: bits,
            });
        } else {
            self.paths_omitted += 1;
        }
    }
    fn walk(&mut self, requested: &Value, returned: &Value, path: &str, depth: usize) {
        if depth > 127 || !self.unit() {
            self.walk_complete = false;
            return;
        }
        self.value_pairs_examined += 1;
        match (requested, returned) {
            (Value::Object(a), Value::Object(b)) => {
                for (key, value) in a {
                    if self.budget_units == SKY_DIAGNOSTIC_UNITS {
                        self.walk_complete = false;
                        return;
                    }
                    let next = sky_diagnostic_path(path, SkyDiagnosticComponent::Member(key));
                    if let Some(other) = b.get(key) {
                        self.walk(value, other, &next, depth + 1);
                    } else if self.unit() {
                        self.note(&next, "member_missing", None, None);
                    }
                }
                for key in b.keys() {
                    if !self.unit() {
                        return;
                    }
                    if !a.contains_key(key) {
                        self.note(
                            &sky_diagnostic_path(path, SkyDiagnosticComponent::Member(key)),
                            "member_missing",
                            None,
                            None,
                        );
                    }
                }
            }
            (Value::Array(a), Value::Array(b)) => {
                for (index, (value, other)) in a.iter().zip(b).enumerate() {
                    if self.budget_units == SKY_DIAGNOSTIC_UNITS {
                        self.walk_complete = false;
                        return;
                    }
                    self.walk(
                        value,
                        other,
                        &sky_diagnostic_path(path, SkyDiagnosticComponent::Index(index)),
                        depth + 1,
                    );
                }
                for index in a.len().min(b.len())..a.len().max(b.len()) {
                    if !self.unit() {
                        return;
                    }
                    self.note(
                        &sky_diagnostic_path(path, SkyDiagnosticComponent::Index(index)),
                        "array_item_missing",
                        None,
                        None,
                    );
                }
            }
            (Value::Number(a), Value::Number(b)) => {
                // Borrow the original admitted tokens; no whole Number clone.
                if a.as_str() == b.as_str() {
                    return;
                }
                if a.as_str().len() > SKY_DIAGNOSTIC_TOKEN
                    || b.as_str().len() > SKY_DIAGNOSTIC_TOKEN
                {
                    self.numeric_classification_complete = false;
                    self.note(path, "number_unclassified", None, None);
                    return;
                }
                let Some((a_bits, b_bits)) = a
                    .as_f64()
                    .filter(|n| n.is_finite())
                    .zip(b.as_f64().filter(|n| n.is_finite()))
                else {
                    self.numeric_classification_complete = false;
                    self.note(path, "number_nonfinite_or_unrepresented", None, None);
                    return;
                };
                let bits = a_bits.to_bits() == b_bits.to_bits();
                let Some((a_decimal, b_decimal)) =
                    sky_diagnostic_decimal(a.as_str()).zip(sky_diagnostic_decimal(b.as_str()))
                else {
                    self.numeric_classification_complete = false;
                    self.note(path, "number_unclassified", None, Some(bits));
                    return;
                };
                let decimal = a_decimal == b_decimal;
                let class = if decimal && bits {
                    "number_spelling_only"
                } else if bits {
                    "number_decimal_changed_same_binary64"
                } else {
                    "number_binary64_changed"
                };
                self.note(path, class, Some(decimal), Some(bits));
            }
            (Value::String(a), Value::String(b)) => {
                if a != b {
                    self.note(path, "text_changed", None, None);
                }
            }
            (Value::Bool(a), Value::Bool(b)) => {
                if a != b {
                    self.note(path, "other_scalar_changed", None, None);
                }
            }
            (Value::Null, Value::Null) => {}
            _ => self.note(path, "type_changed", None, None),
        }
    }
}
enum SkyDiagnosticComponent<'a> {
    Member(&'a str),
    Index(usize),
}
fn sky_diagnostic_path(path: &str, part: SkyDiagnosticComponent<'_>) -> String {
    // Only array iteration supplies an ordinal. Arbitrary object keys never
    // enter formatting, and every request subtree is redacted at any depth.
    let private = path.ends_with(".request")
        || path.contains(".request.")
        || path.contains(".request[")
        || path.contains(".*");
    let mut next = match part {
        SkyDiagnosticComponent::Index(index) if !private => format!("{path}[{index}]"),
        SkyDiagnosticComponent::Member(key)
            if !private
                && matches!(
                    key,
                    "schema"
                        | "bodies"
                        | "snapshot_ref"
                        | "epoch_utc"
                        | "epoch_unix_ms"
                        | "receipt_utc"
                        | "receipt_unix_ms"
                        | "provider"
                        | "source_binding"
                        | "request"
                        | "body"
                        | "longitude_degrees"
                        | "latitude_degrees"
                        | "distance_au"
                        | "speed_degrees_per_day"
                        | "latitude_speed_degrees_per_day"
                        | "radial_speed_au_per_day"
                        | "retrograde"
                        | "adapter_sha256"
                ) =>
        {
            format!("{path}.{key}")
        }
        _ => format!("{path}.*"),
    };
    // Paths contain only bounded generated ASCII components; no source key
    // is copied before this bound. Parent paths were bounded by the same step.
    if next.len() > SKY_DIAGNOSTIC_PATH {
        next.truncate(SKY_DIAGNOSTIC_PATH - 3);
        next.push_str("...");
    }
    next
}
fn sky_diagnostic_decimal(token: &str) -> Option<(bool, String, i64)> {
    let negative = token.starts_with('-');
    let unsigned = token.strip_prefix('-').unwrap_or(token);
    let (mantissa, exponent) = match unsigned.split_once(|c| c == 'e' || c == 'E') {
        Some((m, e)) => (m, e.parse::<i64>().ok()?),
        None => (unsigned, 0),
    };
    let (integer, fraction) = mantissa.split_once('.').unwrap_or((mantissa, ""));
    let digits = format!("{integer}{fraction}");
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let digits = digits.trim_start_matches('0');
    if digits.is_empty() {
        return Some((negative, "0".into(), 0));
    }
    let significant = digits.trim_end_matches('0');
    let removed = i64::try_from(digits.len() - significant.len()).ok()?;
    let fraction = i64::try_from(fraction.len()).ok()?;
    Some((
        negative,
        significant.into(),
        exponent.checked_sub(fraction)?.checked_add(removed)?,
    ))
}
fn scene_world_basis_diagnostic(failed: &[&str], requested: &Value, returned: &Value) -> String {
    let describe =
        |value: &Value| match crate::expression_act_storage::fingerprint(value, MAX_REPLY) {
            Ok((bytes, sha256)) => format!("{sha256}/{bytes}"),
            Err(_) => "fingerprint-unavailable-under-original-cap".into(),
        };
    let requested_hash = describe(requested);
    let returned_hash = describe(returned);
    let mut account = SkyDifferenceAccount::new();
    account.walk(requested, returned, "$", 0);
    loop {
        let encoded = serde_json::to_string(&account)
            .unwrap_or_else(|_| "diagnostic-serialization-unavailable".into());
        let message = format!("ql scene world did not preserve one sky/event/subject basis; failed_joins={}; sky_fingerprint_basis=canonical-parsed-structured-json; requested_sky={requested_hash}; returned_sky={returned_hash}; sky_differences={encoded}", failed.join(","));
        if message.len() + "native-expression.compose_refused: ".len() <= SKY_DIAGNOSTIC_ERROR {
            return message;
        }
        if account.samples.pop().is_some() {
            account.paths_omitted += 1;
        } else {
            return format!("ql scene world did not preserve one sky/event/subject basis; failed_joins={}; requested_sky={requested_hash}; returned_sky={returned_hash}; sky_differences=diagnostic-cap-unavailable", failed.join(","));
        }
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
                let worker = composed_worker_binding(&composed.content, &composed.source)?;
                self.open(&worker, composed.source)
            }
            ComposeFinish::ReturnWorld => {
                let binding: Value = serde_json::from_str(&composed.content).map_err(|error| {
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
print(json.dumps({'schema':'ql.field-host-receipt/v1','status':'ready','available':True,'instance_ref':'test:instance','last_request_id':'0','field':{'event_ref':'test:event','subject_ref':'test:subject'}}),flush=True)
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
        let world = compose_request(&json!({"texture":[64,32],"units_per_metre":120,
            "sky":{"epoch":"2026-09-30T11:44:49Z"},
            "world":{"instance_ref":"expression:native:one","subject_ref":"identity:person:one","start":{"kind":"retained"}}})).unwrap();
        assert_eq!(
            world.world,
            Some(
                json!({"instance_ref":"expression:native:one","subject_ref":"identity:person:one","start":{"kind":"retained"}})
            )
        );
        assert_eq!(world.event, None);
        let snapshot = json!({"schema":"ql.sky-snapshot/v1","snapshot_ref":"sha256:reused","receipt_unix_ms":7,"bodies":[]});
        let reused = compose_request(
            &json!({"texture":[1,1],"units_per_metre":120,"sky_snapshot":snapshot,
            "world":{"instance_ref":"expression:one","subject_ref":"identity:one"}}),
        )
        .unwrap();
        assert!(matches!(reused.sky, Sky::Snapshot(_)));
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
            (missing_sky, "exactly one"),
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
            (
                with(
                    "sky_snapshot",
                    json!({"schema":"ql.sky-snapshot/v1","snapshot_ref":"sha256:x"}),
                ),
                "exactly one",
            ),
            (
                with(
                    "world",
                    json!({"instance_ref":"relative","subject_ref":"identity:one"}),
                ),
                "instance_ref",
            ),
            (
                with("world", json!({"instance_ref":"expression:one"})),
                "subject_ref",
            ),
            (
                with(
                    "world",
                    json!({"instance_ref":"expression:one","subject_ref":"identity:one","extra":true}),
                ),
                "unknown world key",
            ),
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
        assert!(serde_json::from_value::<Request>(json!({"operation":"prepare_world","request":{"texture":[1,1],"units_per_metre":120,"sky_snapshot":{"schema":"ql.sky-snapshot/v1","snapshot_ref":"sha256:x"},"world":{"instance_ref":"expression:one","subject_ref":"identity:one"}}})).is_ok());
    }

    #[test]
    fn declared_world_material_has_exact_native_fields_and_bounds() {
        let material = json!({"damping_per_second":2.0,"strike_metres":0.001,"audio_gain_per_metre":100.0,"strike_on_event":true});
        assert!(validate_scene_material(&material).is_ok());
        for (key, value) in [
            ("damping_per_second", json!(-1)),
            ("damping_per_second", json!(1_000_001)),
            ("strike_metres", json!(0)),
            ("audio_gain_per_metre", json!(1_000_001)),
            ("strike_on_event", json!(1)),
        ] {
            let mut bad = material.clone();
            bad[key] = value;
            assert!(validate_scene_material(&bad).is_err());
        }
        let mut foreign = material.clone();
        foreign["source_numerical_law"] = json!(true);
        assert!(validate_scene_material(&foreign).is_err());
        let mut absent = material.clone();
        absent.as_object_mut().unwrap().remove("strike_on_event");
        assert!(validate_scene_material(&absent).is_err());
        let request = json!({"texture":[1,1],"units_per_metre":120,
            "sky_snapshot":{"schema":"ql.sky-snapshot/v1","snapshot_ref":"sha256:controlled"},
            "world":{"instance_ref":"expression:controlled","subject_ref":"identity:controlled","material":material}});
        assert_eq!(
            compose_request(&request).unwrap().world.unwrap()["material"],
            request["world"]["material"]
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
base={'schema':'ql.field-host-receipt/v1','available':True,'instance_ref':'test:instance','field':{'event_ref':'test:event','subject_ref':'test:subject'}}
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
        let ql_world = script(
            "ql-world",
            r#"printf '%s\n' "$@" > "$OI_WORLD_LOG"; cat "$3" > "$OI_WORLD_LOG.request"; echo '{"schema":"ql.scene-world/v1","sky":{"schema":"ql.sky-snapshot/v1","snapshot_ref":"sha256:s"},"basis":{"event_ref":"sha256:s","subject_ref":"identity:person:one"},"scene":{"schema":"ql.scene/v1"},"native_readback":{"schema":"ql.native-readback/v1"},"binding":{"schema":"oi.native-expression-binding/v1","host":{"instance_ref":"expression:native:one"},"presentation":{"units_per_metre":120,"slots_a":[0],"slots_b":[0]}}}'"#,
        );
        let prepared =
            |manager: &mut Manager, request: Value| manager.prepare_compose(&request).unwrap();
        let mut manager = Manager::default();
        {
            let world_log = dir.join("world-args");
            let _env = EnvGuard::set(&[
                ("OI_QL_BIN", Some(ql_world.as_os_str())),
                ("OI_QL_SKY_BIN", Some(sky_ok.as_os_str())),
                ("OI_WORLD_LOG", Some(world_log.as_os_str())),
            ]);
            // This former positive producer invented flat basis refs which
            // the real CoupledBasis never supplies. Retain it as a malformed
            // transport response; actual world admission is exercised by the
            // native production replay against the real QL executable.
            let error = prepared(&mut manager,json!({"texture":[1,1],"units_per_metre":120,
                "sky":{"epoch":"2026-09-30T11:44:49Z"},"world":{"instance_ref":"expression:native:one","subject_ref":"identity:person:one"}})).execute().unwrap_err();
            assert!(error.contains("did not preserve one sky/event/subject basis"));
            let argv = fs::read_to_string(&world_log).unwrap();
            let argv: Vec<&str> = argv.lines().collect();
            assert_eq!(&argv[..2], ["scene", "world"]);
            let sent: Value = serde_json::from_slice(
                &fs::read(format!("{}.request", world_log.display())).unwrap(),
            )
            .unwrap();
            assert_eq!(sent["schema"], "ql.scene-world-request/v1");
            assert_eq!(sent["event_ref"], "sha256:s");
            assert_eq!(sent["sky"]["snapshot_ref"], "sha256:s");
            assert_eq!(sent["instance_ref"], "expression:native:one");
            assert_eq!(sent["subject_ref"], "identity:person:one");
            let snapshot = json!({"schema":"ql.sky-snapshot/v1","snapshot_ref":"sha256:s","receipt_unix_ms":5,"bodies":[]});
            let error=manager.prepare_world(&json!({"texture":[1,1],"units_per_metre":120,"sky_snapshot":snapshot,
                "world":{"instance_ref":"expression:native:one","subject_ref":"identity:person:one"}})).unwrap().execute().unwrap_err();
            assert!(error.contains("did not preserve one sky/event/subject basis"));
            assert!(
                manager.busy().is_ok(),
                "quiet preparation must not open a native worker"
            );
        }
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
        let content = composed.content.clone();
        let source = composed.source.clone();
        let prepared = manager.finish_compose(composed).unwrap();
        assert_eq!(prepared["binding"], source["world"]["binding"]);
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
                })
                .unwrap_err();
            assert!(error.contains("compose_refused"), "{error}");
            assert!(manager.active.is_none());
            assert_eq!(manager.sequence, 0);
        }
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
            })
            .unwrap();
        assert_eq!(opened["source"], source);
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
    #[test]
    #[ignore = "requires real QL scene binding/sky/host/worker companions"]
    fn actual_legacy_sky_and_unlocated_bindings_open_without_losing_source() {
        let client = CentralClient::with("/nonexistent".into(), None, String::new());
        let mut kernel = crate::Kernel::new(client);
        let mut legacy_openings = Vec::new();
        for sky in ["none", "now"] {
            let legacy_request = json!({"texture":[8,8],"units_per_metre":120,"sky":sky});
            // This is the ordinary frame request and Tauri's split kernel
            // operation, not a direct call to the private binding parser.
            let op: crate::KernelOp = serde_json::from_value(json!({
                "op":"native_expression", "request":{
                    "operation":"compose", "request":legacy_request}
            }))
            .unwrap();
            let legacy = kernel
                .prepare_native_compose(&op)
                .unwrap()
                .unwrap()
                .execute()
                .unwrap();
            let legacy_full: Value = serde_json::from_str(&legacy.content).unwrap();
            assert_eq!(legacy_full.as_object().unwrap().len(), 6);
            assert_eq!(legacy.source["binding"], legacy_full);
            assert_eq!(legacy.source["world"], Value::Null);
            let projected: Value = serde_json::from_str(
                &composed_worker_binding(&legacy.content, &legacy.source).unwrap(),
            )
            .unwrap();
            assert_eq!(projected.as_object().unwrap().len(), 3);
            for key in ["schema", "host", "presentation"] {
                assert_eq!(projected[key], legacy_full[key]);
            }
            // `none` skips a new acquisition. The authored default can retain a
            // dated sky; its actual qualified receipt determines scene presence.
            let has_retained_sky = legacy_full["host"]["basis"]["source_receipts"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r["schema"] == "ql.sky-snapshot/v1");
            assert_eq!(legacy_full["scene"].is_null(), !has_retained_sky);
            assert_eq!(legacy.source["sky"].is_null(), sky == "none");
            if sky == "now" {
                let acquired = &legacy.source["sky"];
                assert_eq!(acquired["schema"], "ql.sky-snapshot/v1");
                for input in [
                    &legacy_full["host"]["basis"],
                    &legacy_full["native_basis"]["input"],
                ] {
                    let admitted: Vec<&Value> = input["source_receipts"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .filter(|receipt| receipt["schema"] == "ql.sky-snapshot/v1")
                        .collect();
                    assert_eq!(admitted, vec![acquired]);
                }
                assert_eq!(
                    legacy_full["scene"]["snapshot_ref"],
                    acquired["snapshot_ref"]
                );
            }
            let mut mutants = Vec::new();
            let mut unknown = legacy_full.clone();
            unknown["unknown"] = json!(true);
            mutants.push(unknown);
            let mut missing_basis = legacy_full.clone();
            missing_basis
                .as_object_mut()
                .unwrap()
                .remove("native_basis");
            mutants.push(missing_basis);
            for key in ["native_basis", "native_readback", "host"] {
                let mut changed = legacy_full.clone();
                changed[key]["foreign_revision"] = json!("foreign:source");
                mutants.push(changed);
            }
            for mutant in mutants {
                let sequence = kernel.native_expression.sequence;
                let error = kernel
                    .finish_native_compose(ComposedBinding {
                        content: mutant.to_string(),
                        source: legacy.source.clone(),
                        finish: ComposeFinish::Open,
                    })
                    .unwrap_err();
                assert!(error.contains("compose_refused"), "{error}");
                assert!(kernel.native_expression.active.is_none());
                assert_eq!(kernel.native_expression.sequence, sequence);
            }
            if sky == "now" {
                let mut missing = legacy_full.clone();
                missing["scene"] = Value::Null;
                let mut forged = legacy.source.clone();
                forged["binding"] = missing.clone();
                assert!(composed_worker_binding(&missing.to_string(), &forged).is_err());
            }
            let legacy_source = legacy.source.clone();
            let legacy_opened = match kernel.finish_native_compose(legacy).unwrap().result {
                crate::KernelOpResult::NativeExpression { data } => data,
                other => panic!("ordinary compose returned {other:?}"),
            };
            assert_eq!(legacy_opened["source"], legacy_source);
            assert_eq!(legacy_opened["receipt"]["status"], "ready");
            assert_eq!(legacy_opened["receipt"]["available"], true);
            assert_eq!(legacy_opened["presentation"], legacy_full["presentation"]);
            let lease = legacy_opened["lease"].as_str().unwrap().to_owned();
            let opening = &legacy_opened["receipt"];
            let inspect = json!({"schema":"ql.field-host-request/v1",
                "instance_ref":opening["instance_ref"],
                "event_ref":opening["field"]["event_ref"],
                "subject_ref":opening["field"]["subject_ref"],
                "request_id":(opening["last_request_id"].as_str().unwrap()
                    .parse::<u64>().unwrap()+1).to_string(),
                "expected_generation":opening["field"]["generation"],
                "expected_samples_elapsed":opening["field"]["samples_elapsed"],
                "command":{"operation":"inspect"}});
            let inspected = match kernel
                .apply(crate::KernelOp::NativeExpression {
                    request: Request::Exchange {
                        lease: lease.clone(),
                        request: inspect,
                    },
                })
                .unwrap()
                .result
            {
                crate::KernelOpResult::NativeExpression { data } => data,
                other => panic!("ordinary inspect returned {other:?}"),
            };
            assert_eq!(inspected["status"], "ok");
            assert_eq!(inspected["available"], true);
            assert_eq!(inspected["field"], opening["field"]);
            assert_eq!(
                inspected["sources"]["original"],
                legacy_full["native_basis"]
            );
            assert_eq!(inspected["sources"]["current"], legacy_full["native_basis"]);
            let receiving = &inspected["influence"]["native_readback"];
            assert!(receiving.is_object(), "{inspected}");
            for (key, value) in legacy_full["native_readback"].as_object().unwrap() {
                // The worker discloses coordinate/double-cover details beside
                // the same admitted ClockInput. These are native derivations.
                if key != "continuous_clock_native" {
                    assert_eq!(receiving[key], *value, "{sky}: {key}");
                }
            }
            assert_eq!(
                receiving["continuous_clock_native"],
                inspected["field"]["clock"]
            );
            let closed = kernel
                .apply(crate::KernelOp::NativeExpression {
                    request: Request::Close { lease },
                })
                .unwrap();
            assert!(kernel.native_expression.active.is_none());
            legacy_openings.push(json!({"request":op,"projected":projected,
                "opened":legacy_opened,"inspected":inspected,"closed":closed}));
        }
        assert_eq!(legacy_openings.len(), 2);
        if let Ok(output) = std::env::var("OI_NATIVE_LEGACY_REPLAY_OUTPUT") {
            fs::write(
                output,
                serde_json::to_vec_pretty(&json!({
                    "schema":"oi.native-expression-ordinary-compose-acceptance/v1",
                    "standing":"real native owner; no rendered or installed UI claim",
                    "openings":legacy_openings
                }))
                .unwrap(),
            )
            .unwrap();
        }
    }
}
