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
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    ffi::OsString,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Command, Stdio},
    sync::{Arc, Mutex, OnceLock, mpsc, atomic::{AtomicBool, Ordering}},
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
}

impl CallError {
    /// The owner's own words for this failure, for an `Unavailable` input.
    pub fn detail(&self) -> String {
        match self {
            Self::Unbound { message } | Self::Refused { message } => message.clone(),
            Self::Unavailable { detail } | Self::Malformed { detail } => detail.clone(),
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
        return Err(CallError::Refused {message: "The native host owns the transport credential and presence connection".into()});
    }
    if matches!(request["kind"].as_str(), Some("observe" | "observe-stop")) {
        renew_presence();
        return observer_reading(request);
    }
    if request["kind"] == "enter" { return enter_presence(request); }
    if request["kind"] == "leave" { release_presence(request); }
    call_with_executable(request, &client_executable().into_os_string())
}

struct PresenceLease {
    last_poll: Mutex<Instant>,
    stopped: AtomicBool,
    reading: Mutex<Option<Result<Value, CallError>>>,
}
static PRESENCE: OnceLock<Mutex<HashMap<String, Arc<PresenceLease>>>> = OnceLock::new();

fn presence_key(request: &Value) -> Result<String, CallError> {
    let mut refs = Vec::new();
    for name in ["field_ref", "participant_ref"] {
        let value = request[name].as_str().filter(|v| !v.is_empty() && v.len() <= 512)
            .ok_or_else(|| CallError::Malformed {detail: format!("Presence requires {name}")})?;
        refs.push(value);
    }
    Ok(serde_json::json!(refs).to_string())
}

fn renew_presence() {
    if let Some(registry) = PRESENCE.get() {
        if let Ok(leases) = registry.lock() {
            for lease in leases.values() { if let Ok(mut last) = lease.last_poll.lock() { *last = Instant::now(); } }
        }
    }
}

fn release_presence(request: &Value) {
    if let (Ok(key), Some(registry)) = (presence_key(request), PRESENCE.get()) {
        if let Ok(mut leases) = registry.lock() {
            if let Some(lease) = leases.remove(&key) { lease.stopped.store(true, Ordering::Release); }
        }
    }
}

fn enter_presence(request: &Value) -> Result<Value, CallError> {
    let key = presence_key(request)?;
    let mut leases = PRESENCE.get_or_init(|| Mutex::new(HashMap::new())).lock()
        .map_err(|_| CallError::Unavailable {detail: "Presence registry unavailable".into()})?;
    leases.retain(|_, lease| !lease.stopped.load(Ordering::Acquire));
    if let Some(lease) = leases.get(&key) {
        if let Ok(mut last) = lease.last_poll.lock() { *last = Instant::now(); }
        drop(leases);
        // A retained process is not renewed authority. Re-enter through the
        // reducer: revocation/expiry is judged by its owner on every act.
        return call_with_executable(request, &client_executable().into_os_string());
    }
    if leases.len() >= 8 { return Err(CallError::Refused {message: "Native field presence budget reached".into()}); }
    let lease = Arc::new(PresenceLease {last_poll: Mutex::new(Instant::now()), stopped: AtomicBool::new(false), reading: Mutex::new(None)});
    leases.insert(key, Arc::clone(&lease));
    drop(leases);
    let owner_request = serde_json::json!({"kind":"enter", "field_ref":request["field_ref"], "participant_ref":request["participant_ref"], "state":request.get("state").cloned().unwrap_or_else(|| Value::String("entered".into())), "hold_presence":true});
    let (send, receive) = mpsc::channel();
    let worker_lease = Arc::clone(&lease);
    std::thread::spawn(move || {
        let outcome = (|| -> Result<(), CallError> {
            let mut child = Command::new(client_executable()).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::inherit()).spawn()
                .map_err(|e| CallError::Unavailable {detail: format!("Presence client launch failed: {e}")})?;
            let written = child.stdin.take().ok_or_else(|| CallError::Unavailable {detail: "Presence input unavailable".into()})?
                .write_all(owner_request.to_string().as_bytes());
            if let Err(e) = written { let _ = child.kill(); let _ = child.wait(); return Err(CallError::Unavailable {detail: e.to_string()}); }
            let stdout = child.stdout.take().ok_or_else(|| CallError::Unavailable {detail: "Presence output unavailable".into()})?;
            let (first_send, first_receive) = mpsc::channel();
            std::thread::spawn(move || {
                let mut line = String::new();
                let result = BufReader::new(stdout).read_line(&mut line).map(|_| line);
                let _ = first_send.send(result);
            });
            let initial = first_receive.recv_timeout(Duration::from_secs(25));
            let reading = match initial {
                Ok(Ok(line)) => decode_reply(line.as_bytes(), &[]),
                _ => Err(CallError::Unavailable {detail: "Presence admission timed out; held connection released".into()}),
            };
            if let Ok(mut cached) = worker_lease.reading.lock() { *cached = Some(reading.clone()); }
            let failed = reading.is_err(); let _ = send.send(reading);
            while !failed && !worker_lease.stopped.load(Ordering::Acquire)
                && worker_lease.last_poll.lock().map(|t| t.elapsed() < Duration::from_secs(120)).unwrap_or(false) {
                if child.try_wait().map(|s| s.is_some()).unwrap_or(true) { break; }
                std::thread::sleep(Duration::from_millis(250));
            }
            let _ = child.kill(); let _ = child.wait();
            Ok(())
        })();
        if let Err(error) = outcome { if let Ok(mut cached) = worker_lease.reading.lock() { *cached = Some(Err(error.clone())); } let _ = send.send(Err(error)); }
        worker_lease.stopped.store(true, Ordering::Release);
    });
    receive.recv_timeout(Duration::from_secs(27)).unwrap_or_else(|_| {
        lease.stopped.store(true, Ordering::Release);
        Err(CallError::Unavailable {detail: "Native presence did not answer; inspect before entering again".into()})
    })
}

struct Observer {
    ref_request: Value,
    last_poll: Mutex<Instant>,
    reading: Mutex<Option<Result<Value, CallError>>>,
    stopped: AtomicBool,
}
static OBSERVERS: OnceLock<Mutex<HashMap<String, Arc<Observer>>>> = OnceLock::new();

/// The wait belongs outside the kernel's operation mutex. This worker holds
/// only an expiring read cache of owner-produced, credential-filtered rows;
/// it has no reducers, document store or identity authority. Clients explicitly
/// release their lease, and abandoned leases expire after two minutes.
fn observer_reading(request: &Value) -> Result<Value, CallError> {
    let id = request["observer_ref"].as_str().filter(|id| {
        !id.is_empty() && id.len() <= 96 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b"-:".contains(&b))
    }).ok_or_else(|| CallError::Malformed { detail: "Observation requires a bounded observer_ref".into() })?;
    let mut observers = OBSERVERS.get_or_init(|| Mutex::new(HashMap::new())).lock()
        .map_err(|_| CallError::Unavailable { detail: "Observation registry unavailable".into() })?;
    observers.retain(|_, observer| {
        let current = !observer.stopped.load(Ordering::Acquire) && observer.last_poll.lock().map(|t| t.elapsed() < Duration::from_secs(120)).unwrap_or(false);
        if !current { observer.stopped.store(true, Ordering::Release); }
        current
    });
    if request["kind"] == "observe-stop" {
        if let Some(observer) = observers.remove(id) { observer.stopped.store(true, Ordering::Release); }
        return Ok(serde_json::json!({"state":"released","observer_ref":id}));
    }
    let owner_request = serde_json::json!({"kind":"observe","ref":request.get("ref").cloned().unwrap_or(Value::Null)});
    if let Some(observer) = observers.get(id) {
        if observer.ref_request != owner_request {
            return Err(CallError::Refused { message: "An observation lease cannot change its subject".into() });
        }
        if let Ok(mut last) = observer.last_poll.lock() { *last = Instant::now(); }
        return observer.reading.lock().map(|reading| reading.clone().unwrap_or_else(|| Ok(serde_json::json!({"state":"observing"}))))
            .map_err(|_| CallError::Unavailable { detail: "Observation reading unavailable".into() })?;
    }
    if observers.len() >= 16 {
        return Err(CallError::Refused { message: "This window has reached its native observation budget".into() });
    }
    let observer = Arc::new(Observer {ref_request: owner_request, last_poll: Mutex::new(Instant::now()), reading: Mutex::new(None), stopped: AtomicBool::new(false)});
    observers.insert(id.into(), Arc::clone(&observer));
    let executable = client_executable().into_os_string();
    std::thread::spawn(move || {
        let mut cursor = Value::Null;
        while !observer.stopped.load(Ordering::Acquire) {
            if observer.last_poll.lock().map(|t| t.elapsed() >= Duration::from_secs(120)).unwrap_or(true) { break; }
            let mut next = observer.ref_request.clone();
            next["cursor"] = cursor;
            let reading = call_with_executable(&next, &executable);
            let failed = reading.is_err();
            cursor = reading.as_ref().ok().and_then(|r| r.get("cursor")).cloned().unwrap_or(Value::Null);
            if observer.stopped.load(Ordering::Acquire) { break; }
            if let Ok(mut cached) = observer.reading.lock() { *cached = Some(reading); }
            std::thread::sleep(Duration::from_millis(if failed { 2000 } else { 100 }));
        }
        observer.stopped.store(true, Ordering::Release);
    });
    Ok(serde_json::json!({"state":"observing"}))
}

fn call_with_executable(request: &Value, executable: &OsString) -> Result<Value, CallError> {
    let mut child = Command::new(executable)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| CallError::Unavailable {
            detail: format!(
                "SharedField client could not be launched ({}): {e}",
                executable.to_string_lossy()
            ),
        })?;
    {
        let mut stdin = child.stdin.take().ok_or_else(|| CallError::Unavailable {
            detail: "SharedField client accepted no request on stdin".into(),
        })?;
        stdin
            .write_all(request.to_string().as_bytes())
            .map_err(|e| CallError::Unavailable {
                detail: format!("SharedField client refused the request bytes: {e}"),
            })?;
    }
    let output = child
        .wait_with_output()
        .map_err(|e| CallError::Unavailable {
            detail: format!("SharedField client did not complete: {e}"),
        })?;
    decode_envelope(&output)
}

/// The envelope law shared with the knowledge transport: an empty stdout
/// on failure is a launch/runtime fault (Unavailable); an unreadable
/// stdout is Malformed; `ok:false` carries the client's own error kind.
pub fn decode_envelope(output: &std::process::Output) -> Result<Value, CallError> {
    if !output.status.success() && output.stdout.iter().all(u8::is_ascii_whitespace) {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(CallError::Unavailable {
            detail: if detail.is_empty() {
                format!("SharedField client failed ({})", output.status)
            } else {
                format!("SharedField client failed ({}): {detail}", output.status)
            },
        });
    }
    decode_reply(&output.stdout, &output.stderr)
}

fn decode_reply(stdout: &[u8], stderr: &[u8]) -> Result<Value, CallError> {
    let envelope: Value =
        serde_json::from_slice(stdout).map_err(|e| CallError::Malformed {
            detail: format!(
                "SharedField client returned an unreadable envelope ({e}): {}",
                String::from_utf8_lossy(stderr).trim()
            ),
        })?;
    if envelope["ok"] == true {
        return envelope
            .get("data")
            .cloned()
            .ok_or_else(|| CallError::Malformed {
                detail: "SharedField envelope is missing its reading".into(),
            });
    }
    let message = envelope["error"]["message"]
        .as_str()
        .unwrap_or("SharedField client refused this request")
        .to_owned();
    Err(match envelope["error"]["kind"].as_str() {
        Some("unbound") => CallError::Unbound { message },
        Some("unavailable") => CallError::Unavailable { detail: message },
        Some("malformed") => CallError::Malformed { detail: message },
        // `refused`, and any kind the contract does not name, is the
        // owner's answer carried verbatim.
        _ => CallError::Refused { message },
    })
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
    use std::io::Write;
    use std::process::{Command, Stdio};

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
    let mut command = match &bundled_launcher {
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
    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "the A2A runner could not be launched via node ({}): {e}",
                node.display()
            )
        })?;
    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| "the A2A runner accepted no request".to_string())?;
        stdin
            .write_all(composed.to_string().as_bytes())
            .map_err(|e| format!("the A2A runner refused the request bytes: {e}"))?;
    }
    let output = child
        .wait_with_output()
        .map_err(|e| format!("the A2A runner did not complete: {e}"))?;
    let parsed: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("the A2A runner's reply was not JSON: {e}"))?;
    if let Some(message) = parsed.get("a2aError").and_then(|v| v.as_str()) {
        return Err(format!("the A2A floor refused the exchange: {message}"));
    }
    if parsed.get("schema").and_then(|v| v.as_str()) != Some("oi.a2a-difference/v1") {
        return Err(
            "the A2A runner returned something that is not an oi.a2a-difference/v1 document"
                .to_string(),
        );
    }
    Ok(parsed)
}

#[cfg(test)]
mod a2a_tests {
    use super::*;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

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

        // A reply that is not a difference document is refused, never carried.
        std::fs::write(
            &fake,
            "#!/bin/sh\ncat > /dev/null\necho '{\"unexpected\":true}'\n",
        )
        .unwrap();
        std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755)).unwrap();
        crate::test_stub::settle_stub(&fake);
        assert!(
            a2a_exchange(&request).is_err(),
            "a non-contract reply is refused"
        );

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
        assert_eq!(
            unknown_kind,
            CallError::Refused {
                message: "carried verbatim".into()
            }
        );
    }

    #[test]
    fn empty_stdout_on_failure_is_unavailable_and_unreadable_stdout_is_malformed() {
        let launch_fault = decode_envelope(&output(127, "", "tsx: not found")).unwrap_err();
        assert!(
            matches!(launch_fault, CallError::Unavailable { ref detail } if detail.contains("tsx: not found"))
        );
        let unreadable = decode_envelope(&output(0, "not json", "")).unwrap_err();
        assert!(matches!(unreadable, CallError::Malformed { .. }));
        let missing_data = decode_envelope(&output(0, r#"{"ok":true}"#, "")).unwrap_err();
        assert!(matches!(missing_data, CallError::Malformed { .. }));
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
}
