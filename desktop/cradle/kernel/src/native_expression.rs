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
    Close {
        lease: String,
    },
    /// Ask QL to compose a K² binding from a bounded consumer request, then
    /// open it exactly as `Open` does. The request never names a program.
    Compose {
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
    stopped: bool,
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
                let (parent, name) = path.rsplit_once('/').unwrap_or((".", &path));
                let dir = files::list(client, if parent.is_empty() { "/" } else { parent })?;
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
                            && ["ok", "refused"]
                                .contains(&reply["status"].as_str().unwrap_or("")) =>
                    {
                        owner.last_request_id = id;
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
        self.active = Some(owner);
        Ok(
            json!({"schema":"oi.native-expression-open/v1","lease":lease,"source":source,"presentation":binding.presentation,"receipt":receipt,"checkpoint":"same-live-GPU-only; no process or native rewind"}),
        )
    }
}

/// Host operations a webview may relay. The K² determinant operations are
/// the host's own; a supplied (non-K²) owner refuses them natively.
const EXCHANGE_OPERATIONS: [&str; 8] = [
    "read",
    "inspect",
    "advance",
    "set-axis",
    "replace",
    "m1-advance",
    "replace-event",
    "influence",
];

fn exchange_admits(request: &Value) -> bool {
    EXCHANGE_OPERATIONS.contains(&request["command"]["operation"].as_str().unwrap_or(""))
}

const MAX_PARTICLES: u64 = 1_048_576;
const MAX_SKY: usize = 1024 * 1024;
const SKY_TIMEOUT: Duration = Duration::from_secs(120);
const BINDING_TIMEOUT: Duration = Duration::from_secs(30);
const SKY_MAX_AGE_SECONDS: u64 = 3600;

#[derive(Clone, Debug, PartialEq)]
enum Sky {
    None,
    Now,
    Epoch(String),
}

/// The consumer's whole say in a composed binding. Geometry, material, field
/// and every executable remain QL's or the installed suite's.
#[derive(Clone, Debug, PartialEq)]
struct ComposeRequest {
    texture: [u32; 2],
    units_per_metre: f64,
    sky: Sky,
    event: Option<Value>,
}

fn compose_request(value: &Value) -> Result<ComposeRequest, String> {
    let fail = |why: &str| format!("native-expression.invalid_compose: {why}");
    let obj = value
        .as_object()
        .ok_or_else(|| fail("request must be an object"))?;
    if let Some(key) = obj
        .keys()
        .find(|k| !["texture", "units_per_metre", "sky", "event"].contains(&k.as_str()))
    {
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
    let sky = match obj.get("sky") {
        Some(Value::String(s)) if s == "none" => Sky::None,
        Some(Value::String(s)) if s == "now" => Sky::Now,
        Some(Value::Object(o)) if o.len() == 1 && o.contains_key("epoch") => {
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
    Ok(ComposeRequest {
        texture: [dims[0] as u32, dims[1] as u32],
        units_per_metre,
        sky,
        event,
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
}

/// A QL-composed binding document and its honest provenance.
#[derive(Debug)]
pub struct ComposedBinding {
    content: String,
    source: Value,
}

impl PreparedCompose {
    pub fn execute(self) -> Result<ComposedBinding, String> {
        let executables = compose_executables(self.request.sky != Sky::None)?;
        let now_ms = unix_ms()?;
        let mut sky_provenance = Value::Null;
        let mut snapshot = None;
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
        let mut binding_request = json!({"schema":"ql.k2-binding-request/v1",
            "instance_ref":format!("oi:native-expression/{}", self.token),
            "texture":[width, height],"units_per_metre":self.request.units_per_metre});
        if let Some(event) = self.request.event {
            binding_request["event"] = event; // QL's CoupledInput; passed untouched
        }
        if let Some(snapshot) = snapshot {
            binding_request["sky"] = snapshot;
        }
        let bytes = serde_json::to_vec(&binding_request).map_err(|e| e.to_string())?;
        if bytes.len() > MAX_REQUEST {
            return Err("native-expression.invalid_compose: request exceeds 32 MiB".into());
        }
        let request_sha256 = sha256_hex(&bytes);
        let file = PrivateFile::create(&format!("{}-k2.json", self.token), &bytes)?;
        let refused = |why: String| format!("native-expression.compose_refused: {why}");
        let ran = run_bounded(
            executables.ql.as_os_str(),
            &[
                "kernel".as_ref(),
                "k2-binding".as_ref(),
                file.0.as_os_str(),
                "--json".as_ref(),
            ],
            BINDING_TIMEOUT,
            MAX_REQUEST,
        )
        .map_err(|e| {
            format!(
                "native-expression.unavailable: `{} kernel k2-binding` {}",
                executables.ql.display(),
                e.describe(BINDING_TIMEOUT, MAX_REQUEST)
            )
        })?;
        drop(file);
        if !ran.status.success() {
            return Err(refused(format!(
                "ql kernel k2-binding exited {}: {}",
                ran.status,
                diagnostic_text(&ran.stderr)
            )));
        }
        let content = String::from_utf8(ran.stdout)
            .map_err(|_| refused("ql kernel k2-binding output is not UTF-8".into()))?;
        let source = json!({"schema":"oi.native-expression-composed-source/v1",
            "ql_executable":executables.ql,"ql_selection":executables.selection,
            "ql_revision":executables.revision,"sky":sky_provenance,
            "request_sha256":request_sha256,"composed_at_unix_ms":now_ms as u64});
        Ok(ComposedBinding { content, source })
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
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
        })
    }

    /// The same open path as `Open`, over QL's composed document.
    pub fn finish_compose(&mut self, composed: ComposedBinding) -> Result<Value, String> {
        self.busy()?;
        self.open(&composed.content, composed.source)
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
            (missing_sky, "sky must be"),
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
    fn exchange_admits_k2_determinant_operations_only_by_name() {
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
                error.starts_with("native-expression.compose_refused: ql kernel k2-binding exited"),
                "{error}"
            );
            assert!(error.contains("no event"), "{error}");
            let argv = fs::read_to_string(&log).unwrap();
            let argv: Vec<&str> = argv.lines().collect();
            assert_eq!(&argv[..2], ["kernel", "k2-binding"]);
            assert_eq!(argv[3], "--json");
            assert!(
                !std::path::Path::new(argv[2]).exists(),
                "request file must be removed"
            );
            let sent: Value =
                serde_json::from_slice(&fs::read(format!("{}.request", log.display())).unwrap())
                    .unwrap();
            assert_eq!(sent["schema"], "ql.k2-binding-request/v1");
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
}
