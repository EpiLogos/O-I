//! The U0.4 walk bridge — a **dev-only** channel (map §3 D10: "a typed,
//! dev-only channel in the cradle … invoke operations, read state,
//! capture receipts"). It fronts the very same kernel the Tauri host
//! fronts, over plain HTTP, so the walk can drive the web bundle with the
//! kernel invoked for real. It grants no renderer authority: it speaks
//! only the typed `KernelOp` seam, exactly like the Tauri commands, and it
//! exists only for walks and development — it is never shipped.
//!
//! Endpoints (CORS-open, loopback by default):
//!   POST /op        body = one KernelOp JSON   -> {"ok":true,"outcome":…}
//!                                                or {"ok":false,"error":…}
//!   GET  /event-replay?generation=G&cursor=N&limit=L  bounded replay page
//!   GET  /events                         legacy endpoint; explicitly retired
//!   GET  /state            the kernel snapshot
//!   GET  /material/<url-encoded location JSON>/<relative path>
//!                          dev-only mirror of the Tauri `oi-material://`
//!                          protocol (FND-04), same resolution rules
//!                          (`oi_cradle_kernel::files::resolve_material`):
//!                          raw bytes, real Content-Type, never JSON.
//!
//! Usage: cargo run --bin walk-bridge [--bind 127.0.0.1:4179]

use sha2::{Digest, Sha256};
use std::cell::Cell;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use oi_cradle_kernel::files::MaterialRouteError;
use oi_cradle_kernel::{events::KERNEL_EVENT_TOPIC, Kernel, KernelOp, KernelOpResult};

// Explicit controlled hosted proof only. Native business replies are sent
// unchanged; exact wire copies and bounded scalar timings go to a pre-created
// private directory, never to a public UI or a default installed host.
const DIAGNOSTIC_WIRE_LIMIT: usize = 64 * 1024 * 1024;
const DIAGNOSTIC_TOTAL_LIMIT: u64 = 256 * 1024 * 1024;
const DIAGNOSTIC_TRACE_LIMIT: u64 = 64;
struct RecoveryDiagnosticOutput {
    directory: std::fs::File,
    next_id: AtomicU64,
    traces: AtomicU64,
    bytes: AtomicU64,
}
impl RecoveryDiagnosticOutput {
    #[cfg(unix)]
    fn open(path: &std::path::Path) -> std::io::Result<Self> {
        use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
        if !path.is_absolute() {
            return Err(std::io::Error::other(
                "diagnostic directory must be absolute",
            ));
        }
        let directory = std::fs::OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
            .open(path)?;
        let meta = directory.metadata()?;
        if meta.uid() != unsafe { libc::geteuid() } || meta.mode() & 0o077 != 0 {
            return Err(std::io::Error::other(
                "diagnostic directory must be private and owned",
            ));
        }
        Ok(Self {
            directory,
            next_id: AtomicU64::new(1),
            traces: AtomicU64::new(0),
            bytes: AtomicU64::new(0),
        })
    }
    #[cfg(not(unix))]
    fn open(_: &std::path::Path) -> std::io::Result<Self> {
        Err(std::io::Error::other(
            "controlled diagnostic directory unavailable on this platform",
        ))
    }
    fn configured() -> Option<Arc<Self>> {
        let path = std::env::var_os("OI_RECOVERY_DIAGNOSTIC_DIR")?;
        match Self::open(std::path::Path::new(&path)) {
            Ok(output) => Some(Arc::new(output)),
            Err(_) => {
                eprintln!("[recovery-phase] diagnostic_directory_refused");
                None
            }
        }
    }
    fn reserve(&self, bytes: usize) -> std::io::Result<()> {
        if bytes > DIAGNOSTIC_WIRE_LIMIT {
            return Err(std::io::Error::other("diagnostic wire limit"));
        }
        self.bytes
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |old| {
                old.checked_add(bytes as u64)
                    .filter(|v| *v <= DIAGNOSTIC_TOTAL_LIMIT)
            })
            .map(|_| ())
            .map_err(|_| std::io::Error::other("diagnostic total limit"))
    }
    #[cfg(unix)]
    fn capture(&self, id: u64, side: &str, bytes: &[u8]) -> std::io::Result<String> {
        use std::os::unix::io::{AsRawFd, FromRawFd};
        self.reserve(bytes.len())?;
        if !matches!(side, "request" | "response") {
            return Err(std::io::Error::other("diagnostic side"));
        }
        let name = format!("trace-{id:06}-{side}.json");
        let c_name = std::ffi::CString::new(name.as_str()).map_err(std::io::Error::other)?;
        let fd = unsafe {
            libc::openat(
                self.directory.as_raw_fd(),
                c_name.as_ptr(),
                libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL | libc::O_NOFOLLOW | libc::O_CLOEXEC,
                0o600,
            )
        };
        if fd < 0 {
            return Err(std::io::Error::last_os_error());
        }
        let mut file = unsafe { std::fs::File::from_raw_fd(fd) };
        file.write_all(bytes)?;
        Ok(name)
    }
    #[cfg(not(unix))]
    fn capture(&self, _: u64, _: &str, _: &[u8]) -> std::io::Result<String> {
        Err(std::io::Error::other("diagnostic capture unavailable"))
    }
}
struct RecoveryDiagnostic {
    output: Arc<RecoveryDiagnosticOutput>,
    id: u64,
    started: Instant,
    active: Cell<bool>,
}
impl RecoveryDiagnostic {
    fn new(output: Arc<RecoveryDiagnosticOutput>) -> Self {
        let id = output.next_id.fetch_add(1, Ordering::Relaxed);
        Self {
            output,
            id,
            started: Instant::now(),
            active: Cell::new(false),
        }
    }
    fn activate(&self, raw: &[u8]) {
        if self
            .output
            .traces
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |old| {
                old.checked_add(1).filter(|v| *v <= DIAGNOSTIC_TRACE_LIMIT)
            })
            .is_err()
        {
            eprintln!("[recovery-phase] diagnostic_trace_limit");
            return;
        }
        self.active.set(true);
        self.phase("bridge_json_decode", self.started);
        self.capture("request", raw);
    }
    fn phase(&self, phase: &'static str, started: Instant) {
        if !self.active.get() {
            return;
        }
        let at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|v| v.as_micros())
            .unwrap_or(0);
        eprintln!(
            "[recovery-phase] {}",
            serde_json::json!({
                "schema":"oi.hosted-recovery-phase/v1", "trace_id":self.id, "phase":phase,
                "elapsed_us":started.elapsed().as_micros(), "ended_at_unix_us":at,
                "standing":"duration_only_not_acknowledgement"
            })
        );
    }
    fn capture(&self, side: &'static str, raw: &[u8]) {
        if !self.active.get() {
            return;
        }
        let started = Instant::now();
        let result = self.output.capture(self.id, side, raw);
        eprintln!(
            "[recovery-wire] {}",
            serde_json::json!({
                "schema":"oi.hosted-recovery-wire/v1", "trace_id":self.id, "side":side,
                "bytes":raw.len(), "sha256":(raw.len() <= DIAGNOSTIC_WIRE_LIMIT).then(||format!("{:x}",Sha256::digest(raw))),
                "artifact":result.as_ref().ok(), "captured":result.is_ok(),
                "ended_at_unix_us":std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|v|v.as_micros()).unwrap_or(0),
                "capture_elapsed_us":started.elapsed().as_micros(),
                "standing":"raw_controlled_wire_not_receiver_admission"
            })
        );
    }
}

fn main() {
    let bind = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "127.0.0.1:4179".to_owned());
    let listener = TcpListener::bind(&bind).expect("bind the walk bridge");
    let bound = listener
        .local_addr()
        .expect("read the bound bridge address");
    let mut native_kernel = Kernel::discover();
    // The walk must carry the installed host's durable Act owner. An in-memory
    // walk cannot verify continuation or replay across a fresh body.
    native_kernel
        .attach_default_act_store()
        .expect("attach the native Act store");
    let kernel = Arc::new(Mutex::new(native_kernel));
    #[cfg(unix)]
    let _native_owner_server = oi_cradle_kernel::native_owner_transport::configured_offer()
        .expect("read native owner offer")
        .map(|(socket, owner)| {
            let shared = Arc::clone(&kernel);
            oi_cradle_kernel::expression_transport::serve_native_owner(&socket, move |request| {
                owner.apply(
                    &mut *shared
                        .lock()
                        .map_err(|_| "native kernel lock unavailable")?,
                    request,
                )
            })
            .expect("serve the explicitly offered native owner")
        });
    println!("oi-cradle walk bridge listening on http://{bound} (topic {KERNEL_EVENT_TOPIC})");
    let recovery_diagnostics = RecoveryDiagnosticOutput::configured();
    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        let kernel = Arc::clone(&kernel);
        let recovery_diagnostics = recovery_diagnostics.clone();
        std::thread::spawn(move || {
            let mut stream = stream;
            // Bytes read past this request's body (the next request arriving
            // in the same TCP segment) must survive to the next iteration —
            // discarding them wedged the connection forever.
            let mut leftover: Vec<u8> = Vec::new();
            loop {
                let Some(request) = read_request(&mut stream, &mut leftover) else {
                    eprintln!("[bridge] conn end ({})", std::process::id());
                    return;
                };
                eprintln!(
                    "[bridge] {} {} ({} bytes)",
                    request.method,
                    request.path,
                    request.body.len()
                );
                let diagnostic = recovery_diagnostics
                    .clone()
                    .filter(|_| {
                        request.method == "POST" && request.path.split('?').next() == Some("/op")
                    })
                    .map(RecoveryDiagnostic::new);
                let outcome = handle_with_diagnostic(&kernel, &request, diagnostic.as_ref());
                eprintln!("[bridge] -> answered {} {}", request.method, request.path);
                respond_with_diagnostic(&mut stream, outcome, diagnostic.as_ref());
                if !request.keep_alive {
                    return;
                }
            }
        });
    }
}

struct Request {
    method: String,
    path: String,
    body: Vec<u8>,
    keep_alive: bool,
}

fn read_request(stream: &mut TcpStream, leftover: &mut Vec<u8>) -> Option<Request> {
    let mut buffer = [0u8; 8192];
    let mut head = std::mem::take(leftover);
    // Read until the end of the headers.
    loop {
        if let Some(split) = find_head_end(&head) {
            let head_text = String::from_utf8_lossy(&head[..split]).to_string();
            let mut lines = head_text.split("\r\n");
            let request_line = lines.next()?.to_owned();

            let mut content_length = 0usize;
            // HTTP/1.1 keeps connections alive by default; only an explicit
            // `Connection: close` ends them (HTTP/1.0 keeps the old default).
            // Opting in on `Connection: keep-alive` alone left every browser
            // fetch — which never sends that header on 1.1 — on a connection
            // this loop closed after one response, and a request that landed
            // on a dying connection never came back.
            let mut keep_alive = !request_line.ends_with("HTTP/1.0");
            for header in lines {
                let Some((name, value)) = header.split_once(':') else {
                    continue;
                };
                let name = name.trim().to_ascii_lowercase();
                let value = value.trim();
                if name == "content-length" {
                    content_length = value.parse().unwrap_or(0);
                }
                if name == "connection" {
                    if value.eq_ignore_ascii_case("close") {
                        keep_alive = false;
                    } else if value.eq_ignore_ascii_case("keep-alive") {
                        keep_alive = true;
                    }
                }
            }
            let mut parts = request_line.split_whitespace();
            let method = parts.next().unwrap_or_default().to_owned();
            let path = parts.next().unwrap_or_default().to_owned();
            let mut body = head[split + 4..].to_vec();
            while body.len() < content_length {
                let read = stream.read(&mut buffer).ok()?;
                if read == 0 {
                    break;
                }
                body.extend_from_slice(&buffer[..read]);
            }
            // Whatever arrived beyond this request's body is the NEXT one —
            // keep it for the next iteration, never drop it on the floor.
            *leftover = body[content_length.min(body.len())..].to_vec();
            body.truncate(content_length);
            return Some(Request {
                method,
                path,
                body,
                keep_alive,
            });
        }
        let read = stream.read(&mut buffer).ok()?;
        if read == 0 {
            return None;
        }
        head.extend_from_slice(&buffer[..read]);
        if head.len() > 65536 {
            return None;
        }
    }
}

fn find_head_end(bytes: &[u8]) -> Option<usize> {
    bytes.windows(4).position(|window| window == b"\r\n\r\n")
}

/// Every response body is built through `serde_json` (never `format!`
/// string interpolation) so an owner error message containing a quote,
/// newline or other control character can never produce invalid JSON —
/// the F-01 finding ("Bad control character in string literal") this
/// bridge previously produced on a real owner error.
enum BridgeResponse {
    Json {
        status: u16,
        body: serde_json::Value,
    },
    Binary {
        status: u16,
        content_type: String,
        body: Vec<u8>,
    },
    Empty {
        status: u16,
    },
}
fn json_ok(fields: serde_json::Value) -> BridgeResponse {
    let mut body = serde_json::json!({"ok": true});
    if let (Some(target), Some(extra)) = (body.as_object_mut(), fields.as_object()) {
        target.extend(extra.clone());
    }
    BridgeResponse::Json { status: 200, body }
}
fn json_error(status: u16, message: impl Into<String>) -> BridgeResponse {
    BridgeResponse::Json {
        status,
        body: serde_json::json!({"ok": false, "error": message.into()}),
    }
}

#[cfg(test)]
fn handle(kernel: &Mutex<Kernel>, request: &Request) -> BridgeResponse {
    handle_with_diagnostic(kernel, request, None)
}
fn handle_with_diagnostic(
    kernel: &Mutex<Kernel>,
    request: &Request,
    diagnostic: Option<&RecoveryDiagnostic>,
) -> BridgeResponse {
    let path = request.path.split('?').next().unwrap_or("");
    match (request.method.as_str(), path) {
        ("OPTIONS", _) => BridgeResponse::Empty { status: 204 },
        ("GET", "/state") => {
            let kernel = kernel.lock().expect("kernel mutex");
            match serde_json::to_value(kernel.snapshot()) {
                Ok(snapshot) => json_ok(serde_json::json!({"snapshot": snapshot})),
                Err(error) => json_error(500, error.to_string()),
            }
        }
        ("GET", "/events") => json_error(
            410,
            "unbounded event replay is retired; use /event-replay with generation and cursor",
        ),
        ("GET", "/event-replay") => {
            let (generation, cursor, limit) = match event_replay_parameters(&request.path) {
                Ok(parameters) => parameters,
                Err(error) => return json_error(400, error),
            };
            let kernel = kernel.lock().expect("kernel mutex");
            let replay = kernel
                .event_log()
                .replay(generation.as_deref(), cursor, limit);
            match serde_json::to_value(replay) {
                Ok(replay) => json_ok(serde_json::json!({"replay": replay})),
                Err(error) => json_error(500, error.to_string()),
            }
        }
        ("POST", "/op") => {
            let op: KernelOp =
                match oi_cradle_kernel::expression_file::read_native_json(&request.body) {
                    Ok(op) => op,
                    Err(error) => return json_error(400, format!("unreadable op: {error}")),
                };
            if matches!(&op, KernelOp::ExpressionRecovery { .. }) {
                if let Some(trace) = diagnostic {
                    trace.activate(&request.body);
                }
            }
            let execute = || -> Result<oi_cradle_kernel::KernelOpOutcome, String> {
                if let KernelOp::ExpressionRecovery { request } = op {
                    if let Some(trace) = diagnostic.filter(|trace| trace.active.get()) {
                        let started = Instant::now();
                        let result = oi_cradle_kernel::expression_recovery::with_diagnostic_trace(
                            trace.id,
                            || oi_cradle_kernel::expression_recovery::execute(request),
                        );
                        trace.phase("bridge_owner_execution", started);
                        return result;
                    }
                    return oi_cradle_kernel::expression_recovery::execute(request);
                }
                if let KernelOp::NaraCoordinate { request } = op {
                    return oi_cradle_kernel::nara_coordinate::execute(request);
                }
                let epii = kernel
                    .lock()
                    .expect("kernel mutex")
                    .prepare_nara_epii(&op)?;
                if let Some(prepared) = epii {
                    let completed = prepared.execute()?;
                    return kernel
                        .lock()
                        .expect("kernel mutex")
                        .finish_nara_epii(completed);
                }
                let act = kernel
                    .lock()
                    .expect("kernel mutex")
                    .prepare_nara_expressive_act(&op)?;
                if let Some(prepared) = act {
                    let completed = prepared.execute()?;
                    return kernel
                        .lock()
                        .expect("kernel mutex")
                        .finish_nara_expressive_act(completed);
                }
                let presence = kernel
                    .lock()
                    .expect("kernel mutex")
                    .prepare_nara_presence(&op)?;
                if let Some(prepared) = presence {
                    let completed = prepared.execute()?;
                    return kernel
                        .lock()
                        .expect("kernel mutex")
                        .finish_nara_presence(completed);
                }
                let m3 = kernel
                    .lock()
                    .expect("kernel mutex")
                    .prepare_m3_reception(&op)?;
                if let Some(prepared) = m3 {
                    let completed = prepared.execute()?;
                    return kernel
                        .lock()
                        .expect("kernel mutex")
                        .finish_m3_reception(completed);
                }
                let current = kernel
                    .lock()
                    .expect("kernel mutex")
                    .prepare_nara_current(&op)?;
                if let Some(prepared) = current {
                    let completed = prepared.execute()?;
                    return kernel
                        .lock()
                        .expect("kernel mutex")
                        .finish_nara_current(completed);
                }
                let voice = kernel
                    .lock()
                    .expect("kernel mutex")
                    .prepare_nara_voice(&op)?;
                if let Some(prepared) = voice {
                    return prepared.execute();
                }
                let dialogue = kernel
                    .lock()
                    .expect("kernel mutex")
                    .prepare_nara_dialogue(&op)?;
                if let Some(prepared) = dialogue {
                    return prepared.execute();
                }
                let identity = kernel
                    .lock()
                    .expect("kernel mutex")
                    .prepare_nara_identity(&op);
                if let Some(prepared) = identity {
                    return prepared.execute();
                }
                let read = kernel.lock().expect("kernel mutex").prepare_owner_read(&op);
                if let Some(read) = read {
                    return read.execute();
                }
                let dictation = kernel
                    .lock()
                    .expect("kernel mutex")
                    .prepare_dictation(&op)?;
                if let Some(read) = dictation {
                    return read.execute();
                }
                let knowledge = kernel
                    .lock()
                    .expect("kernel mutex")
                    .prepare_knowledge(&op)?;
                if let Some(read) = knowledge {
                    let completed = read.execute()?;
                    return kernel
                        .lock()
                        .expect("kernel mutex")
                        .finish_knowledge(completed);
                }
                let working = match &op {
                    KernelOp::WorkingSurfaceRead {
                        project,
                        agent_session,
                        binding,
                    } => Some(
                        kernel
                            .lock()
                            .expect("kernel mutex")
                            .prepare_working_surface_read(
                                project,
                                agent_session.clone(),
                                binding.clone(),
                                false,
                            )?,
                    ),
                    KernelOp::WorkingSurfaceAttachment {
                        project,
                        agent_session,
                        binding,
                    } => Some(
                        kernel
                            .lock()
                            .expect("kernel mutex")
                            .prepare_working_surface_read(
                                project,
                                agent_session.clone(),
                                Some(binding.clone()),
                                true,
                            )?,
                    ),
                    _ => None,
                };
                if let Some(read) = working {
                    return Ok(oi_cradle_kernel::KernelOpOutcome {
                        receipts: vec![],
                        result: KernelOpResult::WorkingSurfaceReading {
                            document: read.execute()?,
                        },
                    });
                }
                let prepared = kernel.lock().expect("kernel mutex").prepare_decision(&op)?;
                if let Some(decision) = prepared {
                    let receipt = decision.execute()?;
                    return kernel
                        .lock()
                        .expect("kernel mutex")
                        .finish_decision(receipt, matches!(&op, KernelOp::InvokeAction { .. }));
                }
                kernel.lock().expect("kernel mutex").apply(op)
            };
            let result = execute();
            let serialization_started = diagnostic
                .filter(|trace| trace.active.get())
                .map(|_| Instant::now());
            let response = match result {
                Ok(outcome) => match serde_json::to_value(&outcome) {
                    Ok(outcome) => json_ok(serde_json::json!({"outcome": outcome})),
                    Err(error) => json_error(500, error.to_string()),
                },
                Err(error) => json_error(200, error),
            };
            if let (Some(trace), Some(started)) = (diagnostic, serialization_started) {
                trace.phase("bridge_outcome_serialization", started);
            }
            response
        }
        _ if request.method == "GET" && path.starts_with("/material/") => {
            material(kernel, &path["/material/".len()..])
        }
        _ => json_error(404, "unknown walk-bridge endpoint"),
    }
}

/// Dev-only mirror of the Tauri `oi-material://` protocol: identical
/// grammar (`<url-encoded location JSON>/<relative path>`) and identical
/// resolution (`oi_cradle_kernel::files::resolve_material`), so a walk
/// exercises the same traversal law the shipped protocol enforces.
fn event_replay_parameters(path: &str) -> Result<(Option<String>, u64, usize), String> {
    let mut parameters = std::collections::HashMap::new();
    if let Some((_, query)) = path.split_once('?') {
        for part in query.split('&') {
            let (key, value) = part
                .split_once('=')
                .ok_or("invalid event replay query field")?;
            if !matches!(key, "generation" | "cursor" | "limit") || value.is_empty() {
                return Err("unknown or empty event replay query field".to_owned());
            }
            if parameters.insert(key, value).is_some() {
                return Err("duplicate event replay query field".to_owned());
            }
        }
    }
    let generation = parameters
        .get("generation")
        .map(|value| (*value).to_owned());
    if generation.as_ref().is_some_and(|value| {
        value.len() > 128
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    }) {
        return Err("invalid event replay generation".to_owned());
    }
    let cursor = match parameters.get("cursor") {
        Some(value) if value.bytes().all(|byte| byte.is_ascii_digit()) => value
            .parse::<u64>()
            .map_err(|_| "invalid event replay cursor")?,
        Some(_) => return Err("invalid event replay cursor".to_owned()),
        None => 1,
    };
    let limit = match parameters.get("limit") {
        Some(value) if value.bytes().all(|byte| byte.is_ascii_digit()) => value
            .parse::<usize>()
            .map_err(|_| "invalid event replay limit")?,
        Some(_) => return Err("invalid event replay limit".to_owned()),
        None => 128,
    };
    if cursor == 0 || limit == 0 {
        return Err("event replay cursor and limit must be positive".to_owned());
    }
    Ok((generation, cursor, limit))
}

fn material(kernel: &Mutex<Kernel>, rest: &str) -> BridgeResponse {
    let mut segments = rest.split('/').filter(|segment| !segment.is_empty());
    let Some(encoded_location) = segments.next() else {
        return json_error(404, "No material location in the request");
    };
    let Some(location) =
        percent_decode(encoded_location).and_then(|json| serde_json::from_str(&json).ok())
    else {
        return json_error(
            404,
            "Material location is not a valid Central path reference",
        );
    };
    let mut relative = Vec::new();
    for raw in segments {
        match percent_decode(raw) {
            Some(segment) => relative.push(segment),
            None => return json_error(403, "Material path segment is not validly encoded"),
        }
    }
    let mut kernel = kernel.lock().expect("kernel mutex");
    let target = match oi_cradle_kernel::files::resolve_material(&mut kernel, &location, &relative)
    {
        Ok(resolved) => resolved,
        Err(MaterialRouteError::Forbidden(message)) => return json_error(403, message),
        Err(MaterialRouteError::NotFound(message)) => return json_error(404, message),
    };
    match kernel.apply(KernelOp::FileBytes {
        location: target.clone(),
    }) {
        Ok(outcome) => match outcome.result {
            KernelOpResult::FileBytes {
                mime_hint,
                content_base64,
                ..
            } => match base64_decode(&content_base64) {
                Some(body) => BridgeResponse::Binary {
                    status: 200,
                    content_type: content_type_for(mime_hint.as_deref(), &target.path),
                    body,
                },
                None => json_error(404, "Central returned an unreadable material encoding"),
            },
            _ => json_error(404, "Central returned an unsupported material reading"),
        },
        Err(message) => json_error(404, message),
    }
}

fn percent_decode(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' => {
                let byte = u8::from_str_radix(input.get(index + 1..index + 3)?, 16).ok()?;
                out.push(byte);
                index += 3;
            }
            b'+' => {
                out.push(b' ');
                index += 1;
            }
            byte => {
                out.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8(out).ok()
}

/// Dependency-free base64 decode (mirrors `src-tauri/src/material_protocol.rs`).
fn base64_decode(input: &str) -> Option<Vec<u8>> {
    fn value(byte: u8) -> Option<u8> {
        match byte {
            b'A'..=b'Z' => Some(byte - b'A'),
            b'a'..=b'z' => Some(byte - b'a' + 26),
            b'0'..=b'9' => Some(byte - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }
    let mut out = Vec::new();
    let mut buffer = 0u32;
    let mut bits = 0u32;
    for byte in input.bytes() {
        if byte == b'=' || byte.is_ascii_whitespace() {
            continue;
        }
        let value = value(byte)?;
        buffer = (buffer << 6) | value as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buffer >> bits) as u8);
        }
    }
    Some(out)
}

fn content_type_for(mime_hint: Option<&str>, path: &str) -> String {
    oi_cradle_kernel::files::material_content_type(mime_hint, path)
}

fn respond_with_diagnostic(
    stream: &mut TcpStream,
    response: BridgeResponse,
    diagnostic: Option<&RecoveryDiagnostic>,
) {
    let serialization_started = diagnostic
        .filter(|trace| trace.active.get())
        .map(|_| Instant::now());
    let (status, content_type, body): (u16, String, Vec<u8>) = match response {
        BridgeResponse::Json { status, body } => (
            status,
            "application/json".into(),
            body.to_string().into_bytes(),
        ),
        BridgeResponse::Binary {
            status,
            content_type,
            body,
        } => (status, content_type, body),
        BridgeResponse::Empty { status } => (status, "text/plain".into(), Vec::new()),
    };
    if let (Some(trace), Some(started)) = (diagnostic, serialization_started) {
        trace.phase("bridge_http_serialization", started);
        trace.capture("response", &body);
    }
    let reason = match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        410 => "Gone",
        _ => "Internal Server Error",
    };
    let headers = format!(
        "HTTP/1.1 {status} {reason}\r\nAccess-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
         Access-Control-Allow-Headers: content-type\r\n\
         Content-Type: {content_type}\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: keep-alive\r\n\r\n",
        body.len()
    );
    let socket_started = diagnostic
        .filter(|trace| trace.active.get())
        .map(|_| Instant::now());
    let _ = stream.write_all(headers.as_bytes());
    let _ = stream.write_all(&body);
    let _ = stream.flush();
    if let (Some(trace), Some(started)) = (diagnostic, socket_started) {
        trace.phase("bridge_socket_write", started);
    }
}

#[cfg(test)]
mod replay_query_tests {
    use super::event_replay_parameters;

    #[test]
    fn bootstrap_and_exact_generation_cursor_are_distinct() {
        assert_eq!(
            event_replay_parameters("/event-replay").unwrap(),
            (None, 1, 128)
        );
        assert_eq!(
            event_replay_parameters("/event-replay?generation=abc123&cursor=19&limit=12").unwrap(),
            (Some("abc123".to_owned()), 19, 12)
        );
    }

    #[test]
    fn malformed_duplicate_unknown_empty_and_overflow_fields_refuse() {
        for query in [
            "cursor",
            "cursor=0",
            "cursor=-1",
            "cursor=+1",
            "cursor=one",
            "cursor=18446744073709551616",
            "limit=0",
            "limit=one",
            "limit=184467440737095516160",
            "cursor=1&cursor=2",
            "generation=abc&generation=def",
            "generation=",
            "generation=abc%20def",
            "unknown=1",
            "cursor=1&",
            "",
        ] {
            assert!(
                event_replay_parameters(&format!("/event-replay?{query}")).is_err(),
                "{query}"
            );
        }
    }
}

#[cfg(test)]
mod native_op_json_tests {
    use super::*;
    use serde_json::Value;
    fn post(kernel: &Mutex<Kernel>, raw: &[u8]) -> (u16, Value) {
        match handle(
            kernel,
            &Request {
                method: "POST".into(),
                path: "/op".into(),
                body: raw.into(),
                keep_alive: false,
            },
        ) {
            BridgeResponse::Json { status, body } => (status, body),
            _ => panic!("native operation must produce JSON"),
        }
    }
    #[test]
    fn genuine_http_operation_handler_refuses_bad_raw_before_native_mutation() {
        let kernel = Mutex::new(Kernel::discover());
        let (_, created) = post(&kernel, br#"{"op":"expression","request":{"operation":"create","expression_ref":"expression:http-number","title":"Raw numerical custody","actor":"human:controlled"}}"#);
        assert_eq!(created["ok"], true, "{created}");
        let read = br#"{"op":"expression","request":{"operation":"inspect","expression_ref":"expression:http-number"}}"#;
        let before = post(&kernel, read).1;
        assert!(
            before["outcome"]["data"]["document"].is_object(),
            "{before}"
        );
        for value in [
            "1e400",
            r#"{"$serde_json::private::Number":"10"}"#,
            r#"{"$serde_json::private::RawValue":"10"}"#,
            r#"{"\u0024serde_json::private::Number":"10"}"#,
        ] {
            let raw = format!(
                r#"{{"op":"expression","request":{{"operation":"edit","expression_ref":"expression:http-number","expected_revision":1,"actor":"human:controlled","changes":[{{"change":"composition_set","presentation":{{"invalid_transport_probe":{value}}}}}]}}}}"#
            );
            let (status, refused) = post(&kernel, raw.as_bytes());
            assert_eq!(status, 400, "{refused}");
            assert_eq!(refused["ok"], false);
            assert_eq!(post(&kernel, read).1, before);
        }
        let duplicate = br#"{"op":"expression","op":"presentation_read","request":{"operation":"inspect","expression_ref":"expression:http-number"}}"#;
        assert_eq!(post(&kernel, duplicate).0, 400);
        assert_eq!(post(&kernel, &[b'{', 0xff, b'}']).0, 400);
        assert_eq!(post(&kernel, read).1, before);
    }
}

#[cfg(all(test, unix))]
mod recovery_diagnostic_tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;
    struct Directory(std::path::PathBuf);
    impl Directory {
        fn new() -> Self {
            static NEXT: AtomicU64 = AtomicU64::new(1);
            let path = std::env::temp_dir().join(format!(
                "oi-recovery-diagnostic-{}-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            std::fs::create_dir(&path).unwrap();
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).unwrap();
            Self(path)
        }
    }
    impl Drop for Directory {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    // Byte custody primitives only: this does not fabricate or admit a native
    // checkpoint. The original hosted replay supplies the real Store request.
    #[test]
    fn exact_wire_bytes_and_existing_file_refusal() {
        let directory = Directory::new();
        let output = RecoveryDiagnosticOutput::open(&directory.0).unwrap();
        let raw = "{\"n\":-0.0,\"text\":\"Ājñā\"}\n".as_bytes();
        let name = output.capture(7, "request", raw).unwrap();
        assert_eq!(std::fs::read(directory.0.join(&name)).unwrap(), raw);
        assert!(output.capture(7, "request", b"different").is_err());
        assert_eq!(std::fs::read(directory.0.join(name)).unwrap(), raw);
    }
    #[test]
    fn directory_binding_refuses_symlinks_and_public_modes() {
        let directory = Directory::new();
        let alias = directory.0.join("alias");
        std::os::unix::fs::symlink(&directory.0, &alias).unwrap();
        assert!(RecoveryDiagnosticOutput::open(&alias).is_err());
        std::fs::set_permissions(&directory.0, std::fs::Permissions::from_mode(0o755)).unwrap();
        assert!(RecoveryDiagnosticOutput::open(&directory.0).is_err());
    }
    #[test]
    fn diagnostic_limits_refuse_without_large_allocation() {
        let directory = Directory::new();
        let output = RecoveryDiagnosticOutput::open(&directory.0).unwrap();
        assert!(output.reserve(DIAGNOSTIC_WIRE_LIMIT + 1).is_err());
        assert_eq!(output.bytes.load(Ordering::Relaxed), 0);
        output
            .bytes
            .store(DIAGNOSTIC_TOTAL_LIMIT, Ordering::Relaxed);
        assert!(output.reserve(1).is_err());
        assert_eq!(output.bytes.load(Ordering::Relaxed), DIAGNOSTIC_TOTAL_LIMIT);
        output
            .traces
            .store(DIAGNOSTIC_TRACE_LIMIT, Ordering::Relaxed);
        let trace = RecoveryDiagnostic::new(Arc::new(output));
        trace.activate(b"not an admitted native request");
        assert!(!trace.active.get());
        assert_eq!(std::fs::read_dir(&directory.0).unwrap().count(), 0);
    }
}
