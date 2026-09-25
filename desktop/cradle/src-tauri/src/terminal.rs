//! Local PTY presentation. Only bundled shell views can address these processes.
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, VecDeque},
    io::{Read, Write},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Condvar, Mutex,
    },
};
use tauri::{AppHandle, Manager, Webview};
static LEASE: AtomicU64 = AtomicU64::new(1);
const LIMIT: usize = 1024 * 1024;
#[derive(Default)]
pub struct Terminals(Mutex<BTreeMap<String, Arc<Session>>>);
struct Session {
    gate: Mutex<()>,
    io: Mutex<Io>,
    output: Mutex<Output>,
    wake: Condvar,
}
struct Io {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    cwd: String,
}
struct Output {
    bytes: VecDeque<u8>,
    base: u64,
    end: u64,
    snapshot: String,
    checkpoint: u64,
    lease: u64,
    host: String,
    closed: bool,
    eof: bool,
    reaped: bool,
}
#[derive(Serialize)]
pub struct Attachment {
    lease: u64,
    seq: u64,
    snapshot: String,
    cwd: String,
}
#[derive(Serialize)]
pub struct Batch {
    seq: u64,
    bytes: Vec<u8>,
    eof: bool,
}
#[derive(Deserialize)]
pub struct Size {
    cols: u16,
    rows: u16,
}
fn size(s: Size) -> Result<PtySize, String> {
    if s.cols < 2 || s.rows < 1 || s.cols > 1000 || s.rows > 1000 {
        return Err("Invalid terminal size".into());
    }
    Ok(PtySize {
        cols: s.cols,
        rows: s.rows,
        pixel_width: 0,
        pixel_height: 0,
    })
}
fn trusted(view: &Webview) -> Result<(), String> {
    if view.label() == "main" || view.label().starts_with("surface-") {
        Ok(())
    } else {
        Err("Terminal access belongs to the bundled shell".into())
    }
}
fn session(app: &AppHandle, id: &str) -> Result<Arc<Session>, String> {
    app.state::<Terminals>()
        .0
        .lock()
        .map_err(|_| "Terminal state unavailable")?
        .get(id)
        .cloned()
        .ok_or("Terminal is closed".into())
}
fn reap_after_eof(row: &Arc<Session>) {
    if let Ok(mut out) = row.output.lock() {
        out.eof = true;
        row.wake.notify_all();
    }
    loop {
        if row.output.lock().map(|out| out.closed).unwrap_or(true) {
            return;
        }
        let exited = row
            .io
            .lock()
            .ok()
            .and_then(|mut io| io.child.try_wait().ok())
            .flatten()
            .is_some();
        if exited {
            if let Ok(mut out) = row.output.lock() {
                out.reaped = true;
                row.wake.notify_all();
            }
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(25));
    }
}
/// The largest command a trusted surface may run in its own PTY: the
/// declared login argv of one harness (for example `codex login`), never an
/// arbitrary script.
const MAX_COMMAND_LEN: usize = 16;
const MAX_TOKEN_LEN: usize = 256;

/// Shape checks for a carried command: bounded count and length, non-empty
/// tokens without control characters, and a program named first. Authority
/// is not the boundary here — the caller is the bundled shell, which already
/// holds the user's full authority through the ordinary shell session; these
/// checks only keep a malformed handover from spawning something senseless.
fn validated_command(command: &[String]) -> Result<(), String> {
    if command.is_empty() || command.len() > MAX_COMMAND_LEN {
        return Err("A terminal command is one program and its arguments".into());
    }
    if command[0].is_empty() || command[0].starts_with('-') {
        return Err("A terminal command names its program first".into());
    }
    for token in command {
        if token.is_empty() || token.len() > MAX_TOKEN_LEN || token.chars().any(char::is_control) {
            return Err("A terminal command token is short, plain text".into());
        }
    }
    Ok(())
}
fn start(
    cwd: String,
    dimensions: PtySize,
    command: Option<Vec<String>>,
) -> Result<Arc<Session>, String> {
    let cwd = std::fs::canonicalize(cwd).map_err(|e| e.to_string())?;
    if !cwd.is_dir() {
        return Err("Terminal directory is not a folder".into());
    }
    let pair = native_pty_system()
        .openpty(dimensions)
        .map_err(|e| e.to_string())?;
    // The ordinary terminal is the user's login shell. A carried command —
    // today a harness's own declared login argv, handed over from the
    // Settings auth-login affordance — runs in the same real PTY instead:
    // the child owns this terminal exactly as it would in front of the
    // person, so browser-flow and TUI logins behave as their harness built
    // them.
    // An explicitly carried command is validated as given — including the
    // empty one, which is malformed, never a silent fall back to the shell.
    if let Some(argv) = &command {
        validated_command(argv)?;
    }
    let carried = command;
    let mut command_builder = match &carried {
        Some(argv) => {
            let (program, args) = argv.split_first().expect("checked non-empty above");
            let mut builder = CommandBuilder::new(program);
            builder.args(args);
            builder
        }
        None => {
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
            let mut builder = CommandBuilder::new(shell);
            builder.arg("-l");
            builder
        }
    };
    command_builder.cwd(&cwd);
    command_builder.env("TERM", "xterm-256color");
    command_builder.env("COLORTERM", "truecolor");
    let child = pair
        .slave
        .spawn_command(command_builder)
        .map_err(|e| e.to_string())?;
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let row = Arc::new(Session {
        gate: Mutex::new(()),
        io: Mutex::new(Io {
            master: pair.master,
            writer,
            child,
            cwd: cwd.to_string_lossy().into(),
        }),
        output: Mutex::new(Output {
            bytes: VecDeque::new(),
            base: 0,
            end: 0,
            snapshot: String::new(),
            checkpoint: 0,
            lease: 0,
            host: String::new(),
            closed: false,
            eof: false,
            reaped: false,
        }),
        wake: Condvar::new(),
    });
    let receive = row.clone();
    std::thread::spawn(move || {
        let mut buffer = [0u8; 16384];
        loop {
            let amount = match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(n) => n,
            };
            let Ok(mut out) = receive.output.lock() else {
                return;
            };
            while out.bytes.len() + amount > LIMIT && !out.closed {
                out = match receive.wake.wait(out) {
                    Ok(v) => v,
                    Err(_) => return,
                };
            }
            if out.closed {
                return;
            }
            out.bytes.extend(&buffer[..amount]);
            out.end += amount as u64;
        }
        drop(reader);
        reap_after_eof(&receive);
    });
    Ok(row)
}
fn attach_session(
    row: &Arc<Session>,
    host: &str,
    dimensions: PtySize,
) -> Result<Attachment, String> {
    let _gate = row.gate.lock().map_err(|_| "Terminal unavailable")?;
    let cwd = {
        let io = row.io.lock().map_err(|_| "Terminal unavailable")?;
        io.master.resize(dimensions).map_err(|e| e.to_string())?;
        io.cwd.clone()
    };
    let mut out = row.output.lock().map_err(|_| "Terminal unavailable")?;
    if out.closed {
        return Err("Terminal is closed".into());
    }
    out.lease = LEASE.fetch_add(1, Ordering::Relaxed);
    out.host = host.into();
    Ok(Attachment {
        lease: out.lease,
        seq: out.checkpoint,
        snapshot: out.snapshot.clone(),
        cwd,
    })
}
fn validate_lease(out: &Output, host: &str, lease: u64) -> Result<(), String> {
    if out.host != host || out.lease != lease {
        Err("Terminal moved to another view".into())
    } else {
        Ok(())
    }
}
fn poll_session(row: &Arc<Session>, host: &str, lease: u64, seq: u64) -> Result<Batch, String> {
    let _gate = row.gate.lock().map_err(|_| "Terminal unavailable")?;
    let out = row.output.lock().map_err(|_| "Terminal unavailable")?;
    validate_lease(&out, host, lease)?;
    if seq < out.base || seq > out.end {
        return Err("Terminal cursor is stale; reattach".into());
    }
    let bytes = out
        .bytes
        .iter()
        .skip((seq - out.base) as usize)
        .take(65536)
        .copied()
        .collect::<Vec<_>>();
    let next = seq + bytes.len() as u64;
    Ok(Batch {
        seq: next,
        bytes,
        eof: out.eof && next == out.end,
    })
}
fn input_session(row: &Arc<Session>, host: &str, lease: u64, data: &str) -> Result<(), String> {
    let _gate = row.gate.lock().map_err(|_| "Terminal unavailable")?;
    {
        let out = row.output.lock().map_err(|_| "Terminal unavailable")?;
        validate_lease(&out, host, lease)?;
        if out.closed {
            return Err("Terminal is closed".into());
        }
    }
    let mut io = row.io.lock().map_err(|_| "Terminal unavailable")?;
    io.writer
        .write_all(data.as_bytes())
        .and_then(|_| io.writer.flush())
        .map_err(|e| e.to_string())
}
fn resize_session(
    row: &Arc<Session>,
    host: &str,
    lease: u64,
    dimensions: PtySize,
) -> Result<(), String> {
    let _gate = row.gate.lock().map_err(|_| "Terminal unavailable")?;
    {
        let out = row.output.lock().map_err(|_| "Terminal unavailable")?;
        validate_lease(&out, host, lease)?;
        if out.closed {
            return Err("Terminal is closed".into());
        }
    }
    row.io
        .lock()
        .map_err(|_| "Terminal unavailable")?
        .master
        .resize(dimensions)
        .map_err(|e| e.to_string())
}
fn checkpoint_session(
    row: &Arc<Session>,
    host: &str,
    lease: u64,
    seq: u64,
    snapshot: String,
) -> Result<(), String> {
    let _gate = row.gate.lock().map_err(|_| "Terminal unavailable")?;
    let mut out = row.output.lock().map_err(|_| "Terminal unavailable")?;
    validate_lease(&out, host, lease)?;
    if seq < out.checkpoint || seq > out.end {
        return Err("Invalid terminal checkpoint".into());
    }
    let consumed = (seq - out.base) as usize;
    out.bytes.drain(..consumed);
    out.base = seq;
    out.checkpoint = seq;
    out.snapshot = snapshot;
    row.wake.notify_all();
    Ok(())
}
fn close_session(row: &Arc<Session>) -> Result<(), String> {
    let _gate = row.gate.lock().map_err(|_| "Terminal unavailable")?;
    {
        let mut out = row.output.lock().map_err(|_| "Terminal unavailable")?;
        out.closed = true;
        row.wake.notify_all();
    }
    let mut io = row.io.lock().map_err(|_| "Terminal unavailable")?;
    if io.child.try_wait().map_err(|e| e.to_string())?.is_none() {
        let kill = io.child.kill();
        let waited = io.child.wait();
        if let Err(wait_error) = waited {
            return Err(kill.err().unwrap_or(wait_error).to_string());
        }
    }
    if let Ok(mut out) = row.output.lock() {
        out.eof = true;
        out.reaped = true;
    }
    Ok(())
}
#[tauri::command]
/// A command to run instead of the login shell, only when this surface's
/// first attach creates its session (Settings auth login: the harness's
/// declared login argv). A reattach to a live session ignores it.
pub async fn terminal_attach(
    app: AppHandle,
    webview: Webview,
    id: String,
    cwd: Option<String>,
    command: Option<Vec<String>>,
    dimensions: Size,
) -> Result<Attachment, String> {
    trusted(&webview)?;
    let dimensions = size(dimensions)?;
    if let Some(argv) = &command {
        validated_command(argv)?;
    }
    if !app
        .state::<crate::KernelHost>()
        .0
        .lock()
        .map_err(|_| "Kernel unavailable")?
        .snapshot()
        .surfaces
        .get(&id)
        .is_some_and(|s| s.kind == "terminal")
    {
        return Err("Open the terminal surface first".into());
    }
    let row = {
        let state = app.state::<Terminals>();
        let mut rows = state.0.lock().map_err(|_| "Terminal state unavailable")?;
        if let Some(row) = rows.get(&id) {
            row.clone()
        } else {
            let cwd = cwd
                .or_else(|| std::env::var("OI_CENTRAL_ROOT").ok())
                .or_else(|| std::env::var("HOME").ok())
                .ok_or("Choose a terminal directory")?;
            let row = start(cwd, dimensions, command)?;
            rows.insert(id, row.clone());
            row
        }
    };
    attach_session(&row, webview.label(), dimensions)
}
#[tauri::command]
pub async fn terminal_poll(
    app: AppHandle,
    webview: Webview,
    id: String,
    lease: u64,
    seq: u64,
) -> Result<Batch, String> {
    trusted(&webview)?;
    poll_session(&session(&app, &id)?, webview.label(), lease, seq)
}
#[tauri::command]
pub async fn terminal_input(
    app: AppHandle,
    webview: Webview,
    id: String,
    lease: u64,
    data: String,
) -> Result<(), String> {
    trusted(&webview)?;
    if data.len() > 1024 * 1024 {
        return Err("Terminal paste is too large".into());
    }
    input_session(&session(&app, &id)?, webview.label(), lease, &data)
}
#[tauri::command]
pub async fn terminal_resize(
    app: AppHandle,
    webview: Webview,
    id: String,
    lease: u64,
    dimensions: Size,
) -> Result<(), String> {
    trusted(&webview)?;
    resize_session(
        &session(&app, &id)?,
        webview.label(),
        lease,
        size(dimensions)?,
    )
}
#[tauri::command]
pub async fn terminal_checkpoint(
    app: AppHandle,
    webview: Webview,
    id: String,
    lease: u64,
    seq: u64,
    snapshot: String,
) -> Result<(), String> {
    trusted(&webview)?;
    if snapshot.len() > 8 * 1024 * 1024 {
        return Err("Terminal screen snapshot is too large".into());
    }
    checkpoint_session(&session(&app, &id)?, webview.label(), lease, seq, snapshot)
}
#[tauri::command]
pub async fn terminal_reconcile(
    app: AppHandle,
    webview: Webview,
    live: Vec<String>,
) -> Result<(), String> {
    trusted(&webview)?;
    if webview.label() != "main" {
        return Err("Terminal lifecycle belongs to the workspace".into());
    }
    let state = app.state::<Terminals>();
    let mut rows = state.0.lock().map_err(|_| "Terminal unavailable")?;
    let dead = rows
        .keys()
        .filter(|id| !live.contains(id))
        .cloned()
        .collect::<Vec<_>>();
    let closing = dead
        .into_iter()
        .filter_map(|id| rows.remove(&id).map(|row| (id, row)))
        .collect::<Vec<_>>();
    drop(rows);
    let mut failed = Vec::new();
    for (id, row) in closing {
        if let Err(error) = close_session(&row) {
            failed.push((id, row, error));
        }
    }
    if failed.is_empty() {
        return Ok(());
    }
    let message = failed
        .iter()
        .map(|(id, _, error)| format!("{id}: {error}"))
        .collect::<Vec<_>>()
        .join("; ");
    let mut rows = state.0.lock().map_err(|_| "Terminal unavailable")?;
    for (id, row, _) in failed {
        rows.insert(id, row);
    }
    Err(message)
}

#[cfg(test)]
#[path = "terminal_tests.rs"]
mod tests;

/// A native owner's attachment client, separate from persistent shell tabs.
/// Dropping/releasing this client never asks the provider to kill its pane.
pub(crate) struct BoundClient {row: Arc<Session>, host:String, lease:u64}
impl BoundClient {
    pub(crate) fn start(cwd:String, command:Vec<String>, host:String, dimensions:Size) -> Result<Self,String> {
        let dimensions=size(dimensions)?;
        let row=start(cwd,dimensions,Some(command))?;
        match attach_session(&row,&host,dimensions) {
            Ok(attachment)=>Ok(Self {row,host,lease:attachment.lease}),
            Err(reason)=>{let _=close_session(&row);Err(reason)}
        }
    }
    pub(crate) fn poll(&self, seq:u64)->Result<Batch,String> {
        let batch=poll_session(&self.row,&self.host,self.lease,seq)?;
        checkpoint_session(&self.row,&self.host,self.lease,batch.seq,String::new())?;
        Ok(batch)
    }
    pub(crate) fn input(&self,data:&str)->Result<(),String> {
        if data.len()>64*1024 {return Err("Input exceeds the bounded terminal paste size".into());}
        input_session(&self.row,&self.host,self.lease,data)
    }
    pub(crate) fn resize(&self,dimensions:Size)->Result<(),String> {resize_session(&self.row,&self.host,self.lease,size(dimensions)?)}
    pub(crate) fn release(&self)->Result<(),String> {close_session(&self.row)}
}
impl Drop for BoundClient {fn drop(&mut self) {let _=close_session(&self.row);}}

#[cfg(test)]
mod bound_client_tests {
    use super::*;
    use std::{process::Command,time::{Duration,Instant,SystemTime,UNIX_EPOCH}};
    #[test]
    #[ignore = "requires real tmux and PTYs; run in native host gate"]
    fn releasing_one_bound_client_preserves_other_client_and_provider_pane() {
        let socket=format!("oi-bound-client-{}-{}",std::process::id(),SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos());
        struct Server(String);
        impl Drop for Server {fn drop(&mut self){let _=Command::new("tmux").args(["-L",&self.0,"kill-server"]).output();}}
        let _server=Server(socket.clone());
        let tmux=|args:&[&str]| {
            let output=Command::new("tmux").args(["-L",&socket,"-f","/dev/null"]).args(args).output().expect("real tmux is required");
            assert!(output.status.success(),"tmux {args:?}: {}",String::from_utf8_lossy(&output.stderr));
            String::from_utf8_lossy(&output.stdout).into_owned()
        };
        tmux(&["new-session","-d","-s","bound-client","/bin/sh"]);
        let native=tmux(&["display-message","-p","-t","bound-client","#{pane_id}"]).trim().to_owned();
        let attach=|| BoundClient::start(std::env::current_dir().unwrap().display().to_string(),
            vec!["tmux".into(),"-L".into(),socket.clone(),"attach-session".into(),"-t".into(),"bound-client".into()],
            "controlled-native-view".into(),Size{cols:80,rows:24}).unwrap();
        let first=attach();let second=attach();
        let wait_clients=|count:usize| {
            let deadline=Instant::now()+Duration::from_secs(5);
            loop {if tmux(&["list-clients","-t","bound-client","-F","#{client_pid}"]).lines().count()==count {break;}
                assert!(Instant::now()<deadline,"expected {count} real attachment clients");std::thread::sleep(Duration::from_millis(20));}
        };
        wait_clients(2);first.release().unwrap();wait_clients(1);
        second.input("printf 'OI_BOUND_CLIENT_ALIVE\\n'\r").unwrap();
        let deadline=Instant::now()+Duration::from_secs(5);
        loop {let output=tmux(&["capture-pane","-p","-t",&native]);
            if output.lines().any(|line|line.trim()=="OI_BOUND_CLIENT_ALIVE") {break;}
            assert!(Instant::now()<deadline,"remaining client must reach the same pane");std::thread::sleep(Duration::from_millis(20));}
        second.release().unwrap();wait_clients(0);
        assert_eq!(tmux(&["display-message","-p","-t","bound-client","#{pane_id}"]).trim(),native);
        assert_eq!(tmux(&["display-message","-p","-t",&native,"#{pane_dead}"]).trim(),"0");
    }
}
