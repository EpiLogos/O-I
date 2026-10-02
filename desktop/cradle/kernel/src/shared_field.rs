//! Thin transport to the O:I-owned SharedField client (Lane C step 5,
//! cell S→S0 · aperture mode). The hosted field is an owner read model
//! the kernel pulls through `shared-field/spacetimedb/field.sh`; the
//! kernel invents no store, no second index and no identity, and it never
//! reads the owner transport token — the hosting target and the token live
//! in the client's own environment (`OI_SHARED_FIELD_TARGET`,
//! `OI_STATE_HOME`), which the kernel passes through untouched.
//!
//! One request on stdin, one envelope on stdout, decoded exactly like
//! `knowledge.rs::decode_envelope`: `{ok:true,data}` is the owner reading;
//! `{ok:false,error:{kind,message}}` is the owner's own failure truth, and
//! the failure kinds the client speaks (`unbound` | `unavailable` |
//! `refused` | `malformed`) are carried as distinct states. An unbound
//! target is absence, never an error.
use crate::flow::{Effect, OwnerCallError};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    ffi::OsString,
    path::PathBuf,
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};

/// The owner operation name every hosted node, edge and input carries.
pub const OWNER_OPERATION: &str = "shared-field.projection";

/// Why the SharedField client did not serve — the client's own failure
/// kinds, verbatim, so the graph assembler and the kernel op can state the
/// truthful input state without re-parsing strings.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CallError {
    /// No hosting target is bound in the client's environment. Absence.
    Unbound { message: String },
    /// The client could not be launched or the hosted field did not
    /// answer. Absence, not an error.
    Unavailable { detail: String },
    /// The owner answered, and the answer was no — owner message verbatim.
    Refused { message: String },
    /// The owner answered something the envelope contract cannot parse.
    Malformed { detail: String },
    /// The suite physical transport keeps its own typed failure. In particular,
    /// a launched mutation without a receipt is never owner absence or refusal.
    Native { failure: OwnerCallError },
}

impl CallError {
    /// The owner's own words for this failure, for an `Unavailable` input.
    pub fn detail(&self) -> String {
        match self {
            Self::Unbound { message } | Self::Refused { message } => message.clone(),
            Self::Unavailable { detail } | Self::Malformed { detail } => detail.clone(),
            Self::Native { failure } => failure.to_string(),
        }
    }
}

/// Where an installed desktop carries its bundled SharedField client (the
/// app resource `shared-field/`, built by
/// `shared-field/spacetimedb/build-client.mjs`). The native shell names it
/// once at startup; the kernel never guesses an application layout.
static BUNDLED_CLIENT_HOME: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();

/// Record the bundled client directory the native shell found. Only a
/// directory carrying the launcher is accepted; the first binding wins.
pub fn bind_bundled_client_home(home: PathBuf) -> bool {
    home.join(BUNDLED_LAUNCHER).is_file() && BUNDLED_CLIENT_HOME.set(home).is_ok()
}

const BUNDLED_LAUNCHER: &str = "field-client.sh";

/// The client executable, in order: `OI_SHARED_FIELD_CLIENT`; the bundled
/// client an installed desktop carries; and, for a development build only,
/// the repository's own doorway `<repo>/shared-field/spacetimedb/field.sh`
/// (`OI_REPO_ROOT`, else this crate's manifest directory climbed to the
/// O:I repository). A release build never reaches into the checkout it was
/// compiled from.
pub fn client_executable() -> PathBuf {
    resolve_client(
        std::env::var_os("OI_SHARED_FIELD_CLIENT"),
        BUNDLED_CLIENT_HOME.get().map(PathBuf::as_path),
        development_repository(),
    )
}

fn resolve_client(
    explicit: Option<OsString>,
    bundled: Option<&std::path::Path>,
    development: Option<PathBuf>,
) -> PathBuf {
    if let Some(explicit) = explicit {
        return PathBuf::from(explicit);
    }
    if let Some(home) = bundled {
        return home.join(BUNDLED_LAUNCHER);
    }
    match development {
        Some(repo) => repo
            .join("shared-field")
            .join("spacetimedb")
            .join("field.sh"),
        None => PathBuf::from(NO_CLIENT),
    }
}

/// Launching this path fails with the reason in the Unavailable detail.
const NO_CLIENT: &str =
    "<no SharedField client: this installed desktop carries no bundled shared-field/ resource>";

/// The source checkout a development build may fall back to.
fn development_repository() -> Option<PathBuf> {
    if let Some(repo) = std::env::var_os("OI_REPO_ROOT") {
        return Some(PathBuf::from(repo));
    }
    if cfg!(debug_assertions) {
        return Some(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("..")
                .join(".."),
        );
    }
    None
}

/// Send one request to the SharedField client and return the owner `data`.
pub fn call(request: &Value) -> Result<Value, CallError> {
    if request.get("token_label").is_some() || request.get("hold_presence").is_some() {
        return Err(CallError::Refused {
            message: "The native host owns the transport credential and presence connection".into(),
        });
    }
    // Validate before a local lease is renewed, allocated or released. Other
    // requests are encoded once by the ordinary physical caller below.
    if matches!(
        request["kind"].as_str(),
        Some("observe" | "observe-stop" | "enter" | "leave")
    ) {
        encode_request(request)?;
    }
    if matches!(request["kind"].as_str(), Some("observe" | "observe-stop")) {
        renew_presence();
        return observer_reading(request);
    }
    if request["kind"] == "enter" {
        return enter_presence(request);
    }
    if request["kind"] == "leave" {
        release_presence(request);
    }
    call_with_executable(request, &client_executable().into_os_string())
}

struct PresenceLease {
    last_poll: Mutex<Instant>,
    stopped: AtomicBool,
    finished: AtomicBool,
    reading: Mutex<Option<Result<Value, CallError>>>,
}
static PRESENCE: OnceLock<Mutex<HashMap<String, Arc<PresenceLease>>>> = OnceLock::new();

fn presence_key(request: &Value) -> Result<String, CallError> {
    let mut refs = Vec::new();
    for name in ["field_ref", "participant_ref"] {
        let value = request[name]
            .as_str()
            .filter(|v| !v.is_empty() && v.len() <= 512)
            .ok_or_else(|| CallError::Malformed {
                detail: format!("Presence requires {name}"),
            })?;
        refs.push(value);
    }
    Ok(serde_json::json!(refs).to_string())
}

fn renew_presence() {
    if let Some(registry) = PRESENCE.get() {
        if let Ok(leases) = registry.lock() {
            for lease in leases.values() {
                if let Ok(mut last) = lease.last_poll.lock() {
                    *last = Instant::now();
                }
            }
        }
    }
}

fn release_presence(request: &Value) {
    if let (Ok(key), Some(registry)) = (presence_key(request), PRESENCE.get()) {
        if let Ok(mut leases) = registry.lock() {
            if let Some(lease) = leases.get(&key) {
                lease.stopped.store(true, Ordering::Release);
            }
        }
    }
}

fn enter_presence(request: &Value) -> Result<Value, CallError> {
    let key = presence_key(request)?;
    let mut leases = PRESENCE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| CallError::Unavailable {
            detail: "Presence registry unavailable".into(),
        })?;
    // A retiring connection owns its slot until its group cleanup has finished.
    leases.retain(|_, lease| !lease.finished.load(Ordering::Acquire));
    if let Some(lease) = leases.get(&key) {
        if lease.stopped.load(Ordering::Acquire) {
            return Err(CallError::Unavailable {
                detail: "The previous presence connection is still releasing its native body"
                    .into(),
            });
        }
        if let Ok(mut last) = lease.last_poll.lock() {
            *last = Instant::now();
        }
        drop(leases);
        // A retained process is not renewed authority. Re-enter through the
        // reducer: revocation/expiry is judged by its owner on every act.
        return call_with_executable(request, &client_executable().into_os_string());
    }
    if leases.len() >= 8 {
        return Err(CallError::Refused {
            message: "Native field presence budget reached".into(),
        });
    }
    let lease = Arc::new(PresenceLease {
        last_poll: Mutex::new(Instant::now()),
        stopped: AtomicBool::new(false),
        finished: AtomicBool::new(false),
        reading: Mutex::new(None),
    });
    leases.insert(key, Arc::clone(&lease));
    drop(leases);
    let owner_request = serde_json::json!({"kind":"enter", "field_ref":request["field_ref"], "participant_ref":request["participant_ref"], "state":request.get("state").cloned().unwrap_or_else(|| Value::String("entered".into())), "hold_presence":true});
    let (send, receive) = mpsc::channel();
    let worker_lease = Arc::clone(&lease);
    std::thread::spawn(move || {
        struct Finished(Arc<PresenceLease>);
        impl Drop for Finished {
            fn drop(&mut self) {
                self.0.stopped.store(true, Ordering::Release);
                self.0.finished.store(true, Ordering::Release);
            }
        }
        let _finished = Finished(Arc::clone(&worker_lease));
        presence_connection(
            &owner_request,
            &client_executable().into_os_string(),
            &worker_lease,
            &send,
            Duration::from_secs(25),
        );
    });
    receive.recv_timeout(Duration::from_secs(27)).unwrap_or_else(|_| {
        lease.stopped.store(true, Ordering::Release);
        Err(CallError::Native { failure: OwnerCallError::OutcomeUnknown {
            detail: "Presence completion was not observed; native connection release requested. Inspect the original field before entering again".into(),
            child_pid: None, cleanup: None, native: None,
        } })
    })
}

/// One worker owns input, the first actual envelope and the held connection.
/// A received completion does not mint current presence: subscription rows
/// remain the material owner. Later connection loss never undoes that receipt.
fn presence_connection(
    request: &Value,
    executable: &OsString,
    lease: &PresenceLease,
    send: &mpsc::Sender<Result<Value, CallError>>,
    startup_timeout: Duration,
) {
    let input = match encode_request(request) {
        Ok(input) => input,
        Err(error) => {
            let _ = send.send(Err(error));
            return;
        }
    };
    let admitted = AtomicBool::new(false);
    let startup_deadline = Instant::now() + startup_timeout;
    let deadline = || {
        if admitted.load(Ordering::Acquire) {
            lease
                .last_poll
                .lock()
                .map(|last| *last + Duration::from_secs(120))
                .unwrap_or_else(|_| Instant::now())
        } else {
            startup_deadline
        }
    };
    let cancelled = || lease.stopped.load(Ordering::Acquire);
    let mut first: Option<Result<Value, CallError>> = None;
    let mut frame_end = 0;
    let mut observe = |stdout: &[u8], stderr: &[u8]| {
        if first.is_some() {
            // This doorway emits one JSON frame, then only keeps its socket.
            // Extra material is a connection fault, never a second admission.
            return stdout[frame_end..]
                .iter()
                .any(|byte| !byte.is_ascii_whitespace());
        }
        let Some(end) = stdout.iter().position(|byte| *byte == b'\n') else {
            return false;
        };
        frame_end = end + 1;
        let reading = if stdout[frame_end..]
            .iter()
            .any(|byte| !byte.is_ascii_whitespace())
        {
            Err(CallError::Native {
                failure: OwnerCallError::OutcomeUnknown {
                    detail: "Presence returned multiple frames instead of one admission receipt"
                        .into(),
                    child_pid: None,
                    cleanup: None,
                    native: None,
                },
            })
        } else {
            decode_reply(&stdout[..end], stderr)
        };
        let failed = reading.is_err();
        if !failed {
            if let Ok(mut last) = lease.last_poll.lock() {
                *last = Instant::now();
            }
            admitted.store(true, Ordering::Release);
        }
        if let Ok(mut cached) = lease.reading.lock() {
            *cached = Some(reading.clone());
        }
        let abandoned = send.send(reading.clone()).is_err();
        first = Some(reading);
        failed || abandoned
    };
    let result = crate::native_process::run_observed(
        Command::new(executable),
        Some(&input),
        crate::native_process::Limits {
            timeout: startup_timeout,
            stdout_bytes: 64 * 1024,
            stderr_bytes: MAX_DIAGNOSTIC_BYTES,
        },
        Some(&cancelled),
        Some(&deadline),
        &mut observe,
    );
    drop(observe);
    if first.is_none() {
        let reading = match result {
            Ok(output) => decode_owner_output(&output, Effect::MayMutate),
            Err(error) => Err(physical_failure(Effect::MayMutate, error)),
        };
        if let Ok(mut cached) = lease.reading.lock() {
            *cached = Some(reading.clone());
        }
        let _ = send.send(reading);
    } else if first.as_ref().is_some_and(|reading| reading.is_ok()) {
        if let Err(error) = result {
            // The first result has already returned. Preserve connection cleanup
            // separately; a completed reducer is not reclassified as uncompleted.
            if let Ok(mut cached) = lease.reading.lock() {
                *cached = Some(Err(physical_failure(Effect::ReadOnly, error)));
            }
        }
    }
}

struct Observer {
    ref_request: Value,
    last_poll: Mutex<Instant>,
    reading: Mutex<Option<Result<Value, CallError>>>,
    stopped: AtomicBool,
    finished: AtomicBool,
}
static OBSERVERS: OnceLock<Mutex<HashMap<String, Arc<Observer>>>> = OnceLock::new();

/// The wait belongs outside the kernel's operation mutex. This worker holds
/// only an expiring read cache of owner-produced, credential-filtered rows;
/// it has no reducers, document store or identity authority. Clients explicitly
/// release their lease, and abandoned leases expire after two minutes.
fn observer_reading(request: &Value) -> Result<Value, CallError> {
    let id = request["observer_ref"]
        .as_str()
        .filter(|id| {
            !id.is_empty()
                && id.len() <= 96
                && id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"-:".contains(&b))
        })
        .ok_or_else(|| CallError::Malformed {
            detail: "Observation requires a bounded observer_ref".into(),
        })?;
    let mut observers = OBSERVERS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| CallError::Unavailable {
            detail: "Observation registry unavailable".into(),
        })?;
    observers.retain(|_, observer| {
        let current = !observer.stopped.load(Ordering::Acquire)
            && observer
                .last_poll
                .lock()
                .map(|t| t.elapsed() < Duration::from_secs(120))
                .unwrap_or(false);
        if !current {
            observer.stopped.store(true, Ordering::Release);
        }
        // Retirement still occupies its slot until the owned client and
        // worker have actually finished. Navigation cannot evade the budget.
        !observer.finished.load(Ordering::Acquire)
    });
    if request["kind"] == "observe-stop" {
        if let Some(observer) = observers.get(id) {
            observer.stopped.store(true, Ordering::Release);
        }
        return Ok(serde_json::json!({"state":"released","observer_ref":id}));
    }
    let owner_request = serde_json::json!({"kind":"observe","ref":request.get("ref").cloned().unwrap_or(Value::Null)});
    if let Some(observer) = observers.get(id) {
        if observer.stopped.load(Ordering::Acquire) {
            return Err(CallError::Unavailable {
                detail: "The observation is releasing its native client".into(),
            });
        }
        if observer.ref_request != owner_request {
            return Err(CallError::Refused {
                message: "An observation lease cannot change its subject".into(),
            });
        }
        if let Ok(mut last) = observer.last_poll.lock() {
            *last = Instant::now();
        }
        return observer
            .reading
            .lock()
            .map(|reading| {
                reading
                    .clone()
                    .unwrap_or_else(|| Ok(serde_json::json!({"state":"observing"})))
            })
            .map_err(|_| CallError::Unavailable {
                detail: "Observation reading unavailable".into(),
            })?;
    }
    if observers.len() >= 16 {
        return Err(CallError::Refused {
            message: "This window has reached its native observation budget".into(),
        });
    }
    let observer = Arc::new(Observer {
        ref_request: owner_request,
        last_poll: Mutex::new(Instant::now()),
        reading: Mutex::new(None),
        stopped: AtomicBool::new(false),
        finished: AtomicBool::new(false),
    });
    observers.insert(id.into(), Arc::clone(&observer));
    let executable = client_executable().into_os_string();
    std::thread::spawn(move || {
        struct Finished(Arc<Observer>);
        impl Drop for Finished {
            fn drop(&mut self) {
                self.0.stopped.store(true, Ordering::Release);
                if let Ok(mut reading) = self.0.reading.lock() {
                    *reading = None;
                }
                self.0.finished.store(true, Ordering::Release);
            }
        }
        let _finished = Finished(Arc::clone(&observer));
        let mut cursor = Value::Null;
        while !observer.stopped.load(Ordering::Acquire) {
            if observer
                .last_poll
                .lock()
                .map(|t| t.elapsed() >= Duration::from_secs(120))
                .unwrap_or(true)
            {
                break;
            }
            let mut next = observer.ref_request.clone();
            next["cursor"] = cursor;
            let reading = observation_call(&next, &executable, || {
                observer.stopped.load(Ordering::Acquire)
                    || observer
                        .last_poll
                        .lock()
                        .map(|t| t.elapsed() >= Duration::from_secs(120))
                        .unwrap_or(true)
            });
            let failed = reading.is_err();
            cursor = reading
                .as_ref()
                .ok()
                .and_then(|r| r.get("cursor"))
                .cloned()
                .unwrap_or(Value::Null);
            if observer.stopped.load(Ordering::Acquire) {
                break;
            }
            if let Ok(mut cached) = observer.reading.lock() {
                *cached = Some(reading);
            }
            for _ in 0..if failed { 100 } else { 5 } {
                if observer.stopped.load(Ordering::Acquire) {
                    break;
                }
                std::thread::sleep(Duration::from_millis(20));
            }
        }
        observer.stopped.store(true, Ordering::Release);
    });
    Ok(serde_json::json!({"state":"observing"}))
}

/// Read-only observations have the same process-group lifetime as native
/// knowledge reads. Cancellation reaps the whole owned group, including a
/// development tsx child. The buffers are capped; none is a durable source.
fn observation_call(
    request: &Value,
    executable: &OsString,
    cancelled: impl Fn() -> bool,
) -> Result<Value, CallError> {
    let command = Command::new(executable);
    let input = encode_request(request)?;
    let output = observation_output(command, &input, Duration::from_secs(65), cancelled)?;
    decode_owner_output(&output, Effect::ReadOnly)
}

const MAX_READING_BYTES: usize = 32 * 1024 * 1024;
const MAX_DIAGNOSTIC_BYTES: usize = 64 * 1024;
const MAX_REQUEST_BYTES: usize = 16 * 1024 * 1024;

/// Serialize within the caller's physical input budget before dispatch. A
/// rejected request has no native effect and is never an uncertain outcome.
fn encode_request(request: &Value) -> Result<Vec<u8>, CallError> {
    struct Input(Vec<u8>);
    impl std::io::Write for Input {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            if bytes.len() > MAX_REQUEST_BYTES.saturating_sub(self.0.len()) {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "SharedField input exceeds the 16 MiB native request budget",
                ));
            }
            self.0.extend_from_slice(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let mut input = Input(Vec::new());
    serde_json::to_writer(&mut input, request).map_err(|error| CallError::Malformed {
        detail: format!("SharedField request was not dispatched: {error}"),
    })?;
    Ok(input.0)
}

fn physical_failure(effect: Effect, error: crate::native_process::Failure) -> CallError {
    match effect.physical_failure(error) {
        OwnerCallError::Unavailable { detail } => CallError::Unavailable { detail },
        failure => CallError::Native { failure },
    }
}

fn observation_output(
    command: Command,
    input: &[u8],
    timeout: Duration,
    cancelled: impl Fn() -> bool,
) -> Result<std::process::Output, CallError> {
    crate::native_process::run_cancellable(
        command,
        Some(input),
        crate::native_process::Limits {
            timeout,
            stdout_bytes: MAX_READING_BYTES,
            stderr_bytes: MAX_DIAGNOSTIC_BYTES,
        },
        Some(&cancelled),
    )
    .map_err(|error| physical_failure(Effect::ReadOnly, error))
}

/// Only these owner-contracted operations are reads. Unknown operations remain
/// mutation-bearing for receipt-loss classification, never for authorisation.
fn request_effect(request: &Value) -> Effect {
    if matches!(
        request["kind"].as_str(),
        Some(
            "status"
                | "identity"
                | "receipt"
                | "snapshot"
                | "observe"
                | "read"
                | "stage"
                | "field-now"
                | "field-day"
                | "preview_nara"
        )
    ) {
        Effect::ReadOnly
    } else {
        Effect::MayMutate
    }
}

fn call_with_executable(request: &Value, executable: &OsString) -> Result<Value, CallError> {
    let effect = request_effect(request);
    call_with_deadline(
        request,
        executable,
        Duration::from_secs(if effect == Effect::ReadOnly { 65 } else { 300 }),
    )
}

fn call_with_deadline(
    request: &Value,
    executable: &OsString,
    timeout: Duration,
) -> Result<Value, CallError> {
    let effect = request_effect(request);
    let input = encode_request(request)?;
    let output = crate::native_process::run(
        Command::new(executable),
        Some(&input),
        crate::native_process::Limits {
            timeout,
            stdout_bytes: MAX_READING_BYTES,
            stderr_bytes: MAX_DIAGNOSTIC_BYTES,
        },
    )
    .map_err(|error| physical_failure(effect, error))?;
    decode_owner_output(&output, effect)
}

/// Decode the real owner response in its caller-owned effect context. Once a
/// mutation has launched, a missing/invalid receipt cannot establish refusal.
fn decode_owner_output(output: &std::process::Output, effect: Effect) -> Result<Value, CallError> {
    decode_native_reply(&output.stdout, &output.stderr, effect, Some(&output.status))
}

fn decode_native_reply(
    stdout: &[u8],
    stderr: &[u8],
    effect: Effect,
    status: Option<&std::process::ExitStatus>,
) -> Result<Value, CallError> {
    let lost = |detail: String, native: Option<Value>| CallError::Native {
        failure: effect.lost_response(detail, None, None, native),
    };
    let envelope: Value = serde_json::from_slice(stdout).map_err(|error| {
        lost(
            format!(
                "SharedField returned an unreadable envelope ({error}; {}): {}",
                status
                    .map(ToString::to_string)
                    .unwrap_or_else(|| "held native connection".into()),
                String::from_utf8_lossy(stderr).trim()
            ),
            None,
        )
    })?;
    let Some(ok) = envelope["ok"].as_bool() else {
        return Err(lost(
            "SharedField returned no supported native envelope".into(),
            Some(envelope),
        ));
    };
    if ok {
        if let Some(status) = status.filter(|status| !status.success()) {
            return Err(lost(
                format!("SharedField returned success JSON with process status {status}"),
                Some(envelope),
            ));
        }
        return envelope.get("data").cloned().ok_or_else(|| {
            lost(
                "SharedField envelope is missing its reading".into(),
                Some(envelope.clone()),
            )
        });
    }
    let Some(message) = envelope["error"]["message"].as_str().map(str::to_owned) else {
        return Err(lost(
            "SharedField failure has no native error message".into(),
            Some(envelope),
        ));
    };
    Err(match envelope["error"]["kind"].as_str() {
        Some("unbound") => CallError::Unbound { message },
        Some("unavailable") => CallError::Unavailable { detail: message },
        Some("malformed") => CallError::Malformed { detail: message },
        Some("refused") => CallError::Refused { message },
        Some("outcome_unknown") => CallError::Native {
            failure: OwnerCallError::OutcomeUnknown {
                detail: message,
                child_pid: None,
                cleanup: None,
                native: Some(envelope),
            },
        },
        _ => lost(
            "SharedField returned an unsupported failure kind".into(),
            Some(envelope),
        ),
    })
}

/// A completed read uses the same contextual decoder as ordinary owner calls;
/// launched reply loss is distinct from an executable that could not launch.
pub fn decode_envelope(output: &std::process::Output) -> Result<Value, CallError> {
    decode_owner_output(output, Effect::ReadOnly)
}

/// The held producer is deliberately alive when its one native frame arrives.
/// Its response still carries the same mutation receipt-loss distinction.
fn decode_reply(stdout: &[u8], stderr: &[u8]) -> Result<Value, CallError> {
    decode_native_reply(stdout, stderr, Effect::MayMutate, None)
}

/// The kernel-op reading: the owner data verbatim when it served; an
/// explicit `{state:"unavailable", detail}` reading when the target is
/// unbound or the field cannot be reached (absence is data, never an
/// `Err`); the owner's own refusal or a malformed envelope is the error
/// the caller surfaces in the owner's words.
pub fn reading(request: &Value) -> Result<Value, String> {
    if matches!(
        request["kind"].as_str(),
        Some("preview_nara" | "publish_nara")
    ) {
        return Err(
            "Native Nara presence requires the saved identity and Expression admission route"
                .into(),
        );
    }
    match call(request) {
        Ok(data) => Ok(data),
        Err(CallError::Unbound { message }) => Ok(
            serde_json::json!({ "state": "unavailable", "owner_operation": OWNER_OPERATION, "detail": message }),
        ),
        Err(CallError::Unavailable { detail }) => Ok(
            serde_json::json!({ "state": "unavailable", "owner_operation": OWNER_OPERATION, "detail": detail }),
        ),
        Err(CallError::Refused { message }) => Err(message),
        Err(CallError::Malformed { detail }) => Err(detail),
        Err(CallError::Native { failure }) => Ok(crate::knowledge::failure_reading(
            &format!(
                "{OWNER_OPERATION}:{}",
                request["kind"].as_str().unwrap_or("unknown")
            ),
            failure,
        )),
    }
}

/// The owner A2A runner beside the floor (`shared-field/a2a-runner.mjs`):
/// `OI_A2A_RUNNER` overrides; an installed desktop runs the bundled
/// `a2a-runner.mjs` beside its SharedField client; a development build
/// falls back to the repository's own file. A release build with neither a
/// bundle nor `OI_REPO_ROOT` has no runner — never a path relative to
/// wherever the application happened to be launched.
fn a2a_runner_path() -> Option<PathBuf> {
    resolve_a2a_runner(
        std::env::var_os("OI_A2A_RUNNER"),
        BUNDLED_CLIENT_HOME.get().map(PathBuf::as_path),
        development_repository(),
    )
}

fn resolve_a2a_runner(
    explicit: Option<OsString>,
    bundled: Option<&std::path::Path>,
    development: Option<PathBuf>,
) -> Option<PathBuf> {
    if let Some(explicit) = explicit {
        return Some(PathBuf::from(explicit));
    }
    if let Some(home) = bundled {
        return Some(home.join("a2a-runner.mjs"));
    }
    development.map(|repo| repo.join("shared-field").join("a2a-runner.mjs"))
}

/// Why an exchange cannot run when no runner resolves.
const NO_A2A_RUNNER: &str = "the A2A owner floor is unavailable: this installed desktop carries no bundled shared-field/ resource and names no OI_A2A_RUNNER";

/// One A2A HTTP+JSON v1 exchange through the owner floor. The request
/// (binding, presence, initiator, message) travels verbatim; the kernel
/// composes the operator-send authority — the person's send is the
/// exchange-authority act, so the grant is recorded as operator-asserted,
/// never minted by the renderer or invented here. Node runs the floor; the
/// renderer sees only the returned `oi.a2a-difference/v1` document.
pub fn a2a_exchange(request: &Value) -> Result<Value, String> {
    // This entry also serves direct kernel dispatch, which bypasses call().
    // Admit the original bytes before cloning or formatting caller identities.
    if let Err(error) = encode_request(request) {
        return Ok(crate::knowledge::failure_reading(
            "a2a.exchange",
            OwnerCallError::Malformed {
                detail: error.detail(),
            },
        ));
    }
    let runner = a2a_runner_path().ok_or_else(|| NO_A2A_RUNNER.to_string())?;
    if !runner.is_file() {
        return Err(format!(
            "the A2A owner floor is not present at {} — the desktop bundle carries the renderer contracts only; run against the repository checkout or set OI_A2A_RUNNER",
            runner.display()
        ));
    }
    let node = std::env::var_os("OI_NODE")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from("node"));

    let mut composed = request.clone();
    let operation_id = composed
        .get("message")
        .and_then(|m| {
            m.get("exchange_operation_id")
                .or_else(|| m.get("message_id"))
        })
        .and_then(|v| v.as_str())
        .unwrap_or("a2a-exchange")
        .to_string();
    composed["authority"] = serde_json::json!({
        "allowed": true,
        "grant_ref": format!("exchange-grant:operator-send:{operation_id}"),
        "operation_id": operation_id,
        "basis": "operator send — the desktop's own exchange-authority decision",
    });

    // The bundled runner shares the launcher's node resolution: an installed
    // application's PATH rarely names a node runtime.
    let bundled_launcher = BUNDLED_CLIENT_HOME
        .get()
        .filter(|home| {
            std::env::var_os("OI_NODE").is_none() && runner == home.join("a2a-runner.mjs")
        })
        .map(|home| home.join(BUNDLED_LAUNCHER));
    let command = match &bundled_launcher {
        Some(launcher) => {
            let mut command = Command::new(launcher);
            command.env("OI_SHARED_FIELD_ENTRY", "a2a-runner.mjs");
            command
        }
        None => {
            let mut command = Command::new(&node);
            command.arg(&runner);
            command
        }
    };
    // Correlation must not echo an unrestricted input identifier on refusal.
    // A completed native difference retains its own actual exchange identity.
    let failure = |error: OwnerCallError| crate::knowledge::failure_reading("a2a.exchange", error);
    let input = match encode_request(&composed) {
        Ok(input) => input,
        Err(error) => {
            return Ok(failure(OwnerCallError::Malformed {
                detail: error.detail(),
            }))
        }
    };
    let output = match crate::native_process::run(
        command,
        Some(&input),
        crate::native_process::Limits {
            timeout: Duration::from_secs(300),
            stdout_bytes: MAX_READING_BYTES,
            stderr_bytes: MAX_DIAGNOSTIC_BYTES,
        },
    ) {
        Ok(output) => output,
        Err(error) => return Ok(failure(Effect::MayMutate.physical_failure(error))),
    };
    let parsed: Value = match serde_json::from_slice(&output.stdout) {
        Ok(parsed) => parsed,
        Err(error) => {
            return Ok(failure(Effect::MayMutate.lost_response(
                format!(
                    "The A2A runner's reply was unreadable ({error}; status {}): {}",
                    output.status,
                    String::from_utf8_lossy(&output.stderr).trim()
                ),
                None,
                None,
                None,
            )))
        }
    };
    if let Some(message) = parsed.get("a2aError").and_then(|value| value.as_str()) {
        return Ok(failure(
            if parsed["kind"] == "refused" && parsed["delivery_attempted"] == false {
                OwnerCallError::Refused {
                    message: message.into(),
                    native: Some(parsed),
                }
            } else {
                // A legacy/corrupt runner cannot establish that no message sent.
                Effect::MayMutate.lost_response(message.into(), None, None, Some(parsed))
            },
        ));
    }
    if !output.status.success() || parsed["schema"] != "oi.a2a-difference/v1" {
        return Ok(failure(Effect::MayMutate.lost_response(
            format!(
                "The A2A runner returned no valid completed difference (status {})",
                output.status
            ),
            None,
            None,
            Some(parsed),
        )));
    }
    Ok(parsed)
}

#[cfg(test)]
mod a2a_tests {
    use super::*;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    #[cfg(unix)]
    #[test]
    fn oversized_operation_id_is_bounded_before_actual_native_launch() {
        const CHILD: &str = "OI_A2A_INPUT_BOUNDARY_CHILD";
        if std::env::var_os(CHILD).is_some() {
            let request = serde_json::json!({
                "message": {"exchange_operation_id": "x".repeat(MAX_REQUEST_BYTES)},
            });
            let reading = a2a_exchange(&request).unwrap();
            assert_eq!(reading["schema"], "oi.native-call-failure/v1");
            assert_eq!(reading["failure"]["kind"], "malformed");
            assert!(
                reading.to_string().len() < 4096,
                "Refusal must remain bounded"
            );
            assert!(reading.to_string().contains("16 MiB native request budget"));
            return;
        }
        let directory = std::env::temp_dir().join(format!(
            "oi-a2a-input-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir(&directory).unwrap();
        let executable = directory.join("native-effect.sh");
        let marker = directory.join("native-effect.sh.effect");
        let runner = directory.join("a2a-runner.mjs");
        // The actual executable would create an OS effect if launched. It
        // supplies no fabricated response; admission must prevent its launch.
        std::fs::write(
            &executable,
            "#!/bin/sh\nprintf native-effect > \"${0}.effect\"\n",
        )
        .unwrap();
        std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o700)).unwrap();
        std::fs::write(&runner, "").unwrap();
        // Isolate native configuration from the concurrently running suite.
        let output = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "shared_field::a2a_tests::oversized_operation_id_is_bounded_before_actual_native_launch", "--nocapture"])
            .env(CHILD, "1")
            .env("OI_NODE", &executable)
            .env("OI_A2A_RUNNER", &runner)
            .output().unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stdout)
        );
        assert!(
            !marker.exists(),
            "Oversized A2A input reached actual native dispatch"
        );
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn a2a_exchange_composes_operator_send_authority_and_verifies_the_contract() {
        let dir = std::env::temp_dir().join(format!("oi-a2a-runner-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let stdin_file = dir.join("stdin.txt");
        let fake = dir.join("fake-node.sh");
        let runner = dir.join("shared-field").join("a2a-runner.mjs");
        std::fs::create_dir_all(runner.parent().unwrap()).unwrap();
        std::fs::write(&runner, "export {}").unwrap();
        let script = format!(
            "#!/bin/sh\nfor a in \"$@\"; do printf '%s\\n' \"$a\" >> \"{args}\"; done\ncat > \"{stdin}\"\necho '{{\"schema\":\"oi.a2a-difference/v1\",\"exchange_ref\":\"a2a-exchange:m1\",\"transport_result\":{{\"kind\":\"message\",\"ref\":\"t1\"}}}}'\n",
            args = dir.join("argv.txt").display(),
            stdin = stdin_file.display()
        );
        std::fs::write(&fake, script).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755)).unwrap();
            crate::test_stub::settle_stub(&fake);
        }

        let prior_node = std::env::var_os("OI_NODE");
        let prior_runner = std::env::var_os("OI_A2A_RUNNER");
        std::env::set_var("OI_NODE", &fake);
        std::env::set_var("OI_A2A_RUNNER", &runner);

        let request = serde_json::json!({
            "binding": {"binding_ref": "a2a-binding:desktop:peer"},
            "presence": {"availability": "online"},
            "initiator_participant_ref": "participant:desktop-operator",
            "message": {"message_id": "a2a-m1", "text": "hello"},
        });
        let reading = a2a_exchange(&request).expect("the exchange dispatches");
        assert_eq!(reading["schema"], "oi.a2a-difference/v1");
        assert_eq!(reading["transport_result"]["ref"], "t1");
        let argv = std::fs::read_to_string(dir.join("argv.txt")).unwrap();
        assert_eq!(
            argv.trim(),
            runner.to_string_lossy().to_string(),
            "the runner path is the sole argument"
        );
        let sent: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&stdin_file).unwrap()).unwrap();
        assert_eq!(sent["authority"]["allowed"], serde_json::json!(true));
        assert_eq!(
            sent["authority"]["grant_ref"],
            serde_json::json!("exchange-grant:operator-send:a2a-m1")
        );
        assert_eq!(
            sent["message"]["message_id"],
            serde_json::json!("a2a-m1"),
            "the message travels verbatim"
        );

        // Invalid reply material cannot establish that the launched send did
        // no work. It remains typed uncertainty, never a successful difference.
        std::fs::write(
            &fake,
            "#!/bin/sh\ncat > /dev/null\necho '{\"unexpected\":true}'\n",
        )
        .unwrap();
        std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755)).unwrap();
        crate::test_stub::settle_stub(&fake);
        let invalid = a2a_exchange(&request).unwrap();
        assert_eq!(invalid["schema"], "oi.native-call-failure/v1");
        assert_eq!(invalid["failure"]["kind"], "outcome_unknown");
        assert_eq!(invalid["failure"]["native"]["unexpected"], true);

        match prior_node {
            Some(value) => std::env::set_var("OI_NODE", value),
            None => std::env::remove_var("OI_NODE"),
        }
        match prior_runner {
            Some(value) => std::env::set_var("OI_A2A_RUNNER", value),
            None => std::env::remove_var("OI_A2A_RUNNER"),
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn an_installed_client_wins_over_the_checkout_and_a_release_has_no_checkout() {
        let home = std::path::Path::new("/Applications/O-I.app/Contents/Resources/shared-field");
        let repo = PathBuf::from("/src/o-i");
        assert_eq!(
            resolve_client(None, Some(home), Some(repo.clone())),
            home.join("field-client.sh")
        );
        assert_eq!(
            resolve_client(Some("/x/field".into()), Some(home), Some(repo.clone())),
            PathBuf::from("/x/field")
        );
        assert_eq!(
            resolve_client(None, None, Some(repo)),
            PathBuf::from("/src/o-i/shared-field/spacetimedb/field.sh")
        );
        assert_eq!(resolve_client(None, None, None), PathBuf::from(NO_CLIENT));
    }

    #[test]
    fn a_release_without_bundle_or_repository_has_no_a2a_runner_never_a_relative_one() {
        let home = std::path::Path::new("/Applications/O-I.app/Contents/Resources/shared-field");
        let repo = PathBuf::from("/src/o-i");
        assert_eq!(resolve_a2a_runner(None, None, None), None);
        assert_eq!(
            resolve_a2a_runner(None, None, Some(repo.clone())),
            Some(PathBuf::from("/src/o-i/shared-field/a2a-runner.mjs"))
        );
        assert_eq!(
            resolve_a2a_runner(None, Some(home), Some(repo.clone())),
            Some(home.join("a2a-runner.mjs"))
        );
        assert_eq!(
            resolve_a2a_runner(Some("/x/runner.mjs".into()), Some(home), Some(repo)),
            Some(PathBuf::from("/x/runner.mjs"))
        );
        assert!(NO_A2A_RUNNER.contains("unavailable"));
    }

    #[test]
    fn a_resource_directory_without_the_launcher_is_not_bound() {
        let empty = std::env::temp_dir().join(format!("oi-sf-empty-{}", std::process::id()));
        std::fs::create_dir_all(&empty).unwrap();
        assert!(!bind_bundled_client_home(empty.clone()));
        let _ = std::fs::remove_dir_all(empty);
    }

    #[test]
    fn a_missing_client_is_unavailable_with_its_reason() {
        let error = call_with_executable(
            &serde_json::json!({"kind":"status"}),
            &OsString::from(NO_CLIENT),
        )
        .unwrap_err();
        match error {
            CallError::Unavailable { detail } => assert!(
                detail.contains("carries no bundled shared-field/"),
                "{detail}"
            ),
            other => panic!("expected Unavailable, got {other:?}"),
        }
    }

    use super::*;
    use std::os::unix::process::ExitStatusExt;
    use std::process::{ExitStatus, Output};

    fn output(code: i32, stdout: &str, stderr: &str) -> Output {
        Output {
            status: ExitStatus::from_raw(code << 8),
            stdout: stdout.as_bytes().to_vec(),
            stderr: stderr.as_bytes().to_vec(),
        }
    }

    #[test]
    fn ok_envelope_yields_the_owner_data_verbatim() {
        let data = decode_envelope(&output(0, r#"{"ok":true,"data":{"schema":"oi.shared-field.status/v1","bound":false,"reason":"no target"}}"#, "")).unwrap();
        assert_eq!(data["schema"], "oi.shared-field.status/v1");
        assert_eq!(data["bound"], false);
    }

    #[test]
    fn unbound_envelope_is_absence_not_refusal() {
        let error = decode_envelope(&output(1, r#"{"ok":false,"error":{"kind":"unbound","message":"no SharedField target bound: set OI_SHARED_FIELD_TARGET"}}"#, "")).unwrap_err();
        assert_eq!(
            error,
            CallError::Unbound {
                message: "no SharedField target bound: set OI_SHARED_FIELD_TARGET".into()
            }
        );
        assert_eq!(
            error.detail(),
            "no SharedField target bound: set OI_SHARED_FIELD_TARGET"
        );
    }

    #[test]
    fn every_client_failure_kind_is_carried_distinctly() {
        let unavailable = decode_envelope(&output(1, r#"{"ok":false,"error":{"kind":"unavailable","message":"SharedField db at ws://x is unavailable: timeout"}}"#, "")).unwrap_err();
        assert!(
            matches!(unavailable, CallError::Unavailable { ref detail } if detail.contains("timeout"))
        );
        let refused = decode_envelope(&output(
            1,
            r#"{"ok":false,"error":{"kind":"refused","message":"the owner said no"}}"#,
            "",
        ))
        .unwrap_err();
        assert_eq!(
            refused,
            CallError::Refused {
                message: "the owner said no".into()
            }
        );
        let malformed = decode_envelope(&output(
            1,
            r#"{"ok":false,"error":{"kind":"malformed","message":"read requires a string `ref`"}}"#,
            "",
        ))
        .unwrap_err();
        assert_eq!(
            malformed,
            CallError::Malformed {
                detail: "read requires a string `ref`".into()
            }
        );
        let unknown_kind = decode_envelope(&output(
            1,
            r#"{"ok":false,"error":{"kind":"surprise","message":"carried verbatim"}}"#,
            "",
        ))
        .unwrap_err();
        assert!(
            matches!(unknown_kind, CallError::Native {failure: OwnerCallError::Malformed {detail}} if detail.contains("unsupported failure kind"))
        );
    }

    #[test]
    fn launched_empty_or_unreadable_stdout_is_failed_reading_not_owner_absence() {
        let launch_fault = decode_envelope(&output(127, "", "tsx: not found")).unwrap_err();
        assert!(
            matches!(launch_fault, CallError::Native {failure: OwnerCallError::Malformed {detail}} if detail.contains("tsx: not found"))
        );
        let unreadable = decode_envelope(&output(0, "not json", "")).unwrap_err();
        assert!(matches!(
            unreadable,
            CallError::Native {
                failure: OwnerCallError::Malformed { .. }
            }
        ));
        let missing_data = decode_envelope(&output(0, r#"{"ok":true}"#, "")).unwrap_err();
        assert!(matches!(
            missing_data,
            CallError::Native {
                failure: OwnerCallError::Malformed { .. }
            }
        ));
    }

    #[test]
    fn a_missing_client_executable_is_absence_not_a_panic() {
        let error = call_with_executable(
            &serde_json::json!({"kind":"status"}),
            &OsString::from("/nonexistent/oi-shared-field-client"),
        )
        .unwrap_err();
        assert!(matches!(error, CallError::Unavailable { .. }));
    }

    #[cfg(unix)]
    #[test]
    fn oversized_native_request_does_not_launch_or_perform_an_effect() {
        use std::os::unix::fs::PermissionsExt;
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory =
            std::env::temp_dir().join(format!("oi-shared-input-{}-{nonce}", std::process::id()));
        std::fs::create_dir(&directory).unwrap();
        let executable = directory.join("native-effect.sh");
        let marker = directory.join("native-effect.sh.effect");
        // A real OS write would witness dispatch. No owner reply is fabricated.
        std::fs::write(
            &executable,
            "#!/bin/sh\nprintf native-effect > \"${0}.effect\"\n",
        )
        .unwrap();
        std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o700)).unwrap();
        let request =
            serde_json::json!({"kind":"publish","material":"x".repeat(MAX_REQUEST_BYTES)});
        let error = call_with_deadline(
            &request,
            &executable.into_os_string(),
            Duration::from_secs(1),
        )
        .unwrap_err();
        assert!(
            matches!(error, CallError::Malformed {detail} if detail.contains("16 MiB native request budget"))
        );
        assert!(
            !marker.exists(),
            "Input admission must precede actual native dispatch"
        );
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn observation_transport_carries_actual_pipe_bytes_without_reinterpreting_them() {
        let bytes = b"native process bytes\n";
        let output = observation_output(
            Command::new("/bin/cat"),
            bytes,
            Duration::from_secs(2),
            || false,
        )
        .unwrap();
        assert!(output.status.success());
        assert_eq!(output.stdout, bytes);
        assert!(output.stderr.is_empty());
    }

    #[test]
    fn observation_release_and_deadline_reap_real_waiting_processes() {
        for release in [true, false] {
            let stopped = Arc::new(AtomicBool::new(false));
            let stop = Arc::clone(&stopped);
            let signal = std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(100));
                if release {
                    stop.store(true, Ordering::Release);
                }
            });
            let mut command = Command::new("/bin/sleep");
            command.arg("30");
            let started = Instant::now();
            let result = observation_output(command, b"", Duration::from_millis(250), || {
                stopped.load(Ordering::Acquire)
            });
            signal.join().unwrap();
            assert!(started.elapsed() < Duration::from_secs(2));
            assert!(
                matches!(result, Err(CallError::Native {failure: OwnerCallError::TransportFailed {detail, child_pid: Some(_), cleanup: Some(_)} }) if detail.contains(if release {"cancelled"} else {"deadline"}))
            );
        }
    }

    #[test]
    fn observation_transport_refuses_and_reaps_actual_unbounded_output() {
        let result = observation_output(
            Command::new("/usr/bin/yes"),
            b"",
            Duration::from_secs(3),
            || false,
        );
        assert!(
            matches!(result, Err(CallError::Native {failure: OwnerCallError::TransportFailed {detail, child_pid: Some(_), cleanup: Some(_)} }) if detail.contains("bounded output"))
        );
    }

    #[test]
    fn observation_deadline_bounds_delivery_to_a_real_nonreading_process() {
        let mut command = Command::new("/bin/sleep");
        command.arg("30");
        let input = vec![b'x'; 4 * 1024 * 1024];
        let started = Instant::now();
        let result = observation_output(command, &input, Duration::from_millis(150), || false);
        assert!(started.elapsed() < Duration::from_secs(2));
        assert!(
            matches!(result, Err(CallError::Native {failure: OwnerCallError::TransportFailed {detail, child_pid: Some(_), cleanup: Some(_)} }) if detail.contains("deadline"))
        );
    }

    #[test]
    fn observation_deadline_bounds_real_inherited_pipes_after_parent_exit() {
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "/bin/sleep 30 & exit 0"]);
        let started = Instant::now();
        let result = observation_output(command, b"", Duration::from_millis(150), || false);
        assert!(started.elapsed() < Duration::from_secs(2));
        assert!(
            matches!(result, Err(CallError::Native {failure: OwnerCallError::TransportFailed {detail, child_pid: Some(_), cleanup: Some(_)} }) if detail.contains("deadline"))
        );
    }

    #[test]
    fn ordinary_mutation_receipt_loss_preserves_real_effect_and_uncertainty() {
        use std::os::unix::fs::PermissionsExt;
        let directory = std::env::temp_dir().join(format!(
            "oi-shared-call-effect-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir(&directory).unwrap();
        let marker = directory.join("effect");
        let executable = directory.join("owner");
        // The native OS producer writes before waiting. The marker proves an
        // effect occurred; the call must not infer refusal from a lost reply.
        std::fs::write(&executable, "#!/bin/sh\ncat >/dev/null\nprintf applied > \"$(dirname \"$0\")/effect\"\nexec /bin/sleep 30\n").unwrap();
        std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o700)).unwrap();
        let result = call_with_deadline(
            &serde_json::json!({"kind":"stage-open"}),
            &executable.clone().into_os_string(),
            Duration::from_millis(250),
        );
        assert_eq!(std::fs::read_to_string(&marker).unwrap(), "applied");
        assert!(matches!(
            result,
            Err(CallError::Native {
                failure: OwnerCallError::OutcomeUnknown {
                    child_pid: Some(_),
                    cleanup: Some(_),
                    ..
                }
            })
        ));
        let read = call_with_deadline(
            &serde_json::json!({"kind":"snapshot"}),
            &executable.into_os_string(),
            Duration::from_millis(250),
        );
        assert!(matches!(
            read,
            Err(CallError::Native {
                failure: OwnerCallError::TransportFailed {
                    child_pid: Some(_),
                    cleanup: Some(_),
                    ..
                }
            })
        ));
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn ordinary_decode_distinguishes_actual_success_refusal_and_lost_mutation_receipt() {
        assert_eq!(
            decode_owner_output(
                &output(0, r#"{"ok":true,"data":{"revision":7}}"#, ""),
                Effect::MayMutate
            )
            .unwrap(),
            serde_json::json!({"revision":7})
        );
        assert!(matches!(
            decode_owner_output(
                &output(
                    1,
                    r#"{"ok":false,"error":{"kind":"refused","message":"authority refused"}}"#,
                    ""
                ),
                Effect::MayMutate
            ),
            Err(CallError::Refused { .. })
        ));
        for reply in [
            output(0, "", ""),
            output(0, "not JSON", ""),
            output(1, r#"{"ok":true,"data":{}}"#, ""),
            output(0, r#"{"ok":true}"#, ""),
        ] {
            assert!(matches!(
                decode_owner_output(&reply, Effect::MayMutate),
                Err(CallError::Native {
                    failure: OwnerCallError::OutcomeUnknown { .. }
                })
            ));
            assert!(matches!(
                decode_owner_output(&reply, Effect::ReadOnly),
                Err(CallError::Native {
                    failure: OwnerCallError::Malformed { .. }
                })
            ));
        }
        let native = output(
            1,
            r#"{"ok":false,"error":{"kind":"outcome_unknown","message":"confirmation lost","completion_observation":{"completed_reducers":1}}}"#,
            "",
        );
        assert!(
            matches!(decode_owner_output(&native, Effect::MayMutate), Err(CallError::Native {failure: OwnerCallError::OutcomeUnknown {native: Some(value), ..}}) if value["error"]["completion_observation"]["completed_reducers"]==1)
        );
    }
}
