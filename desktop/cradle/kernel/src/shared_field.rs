//! Thin transport to the O:I-owned SharedField client (Lane C step 5,
//! cell S→S0 · aperture mode). The hosted field is an owner read model
//! the kernel reaches through `shared-field/spacetimedb/field.sh`; the
//! kernel invents no store, no second index and no identity, and it never
//! reads the owner transport token — the hosting target and the token live
//! in the client's own environment (`OI_SHARED_FIELD_TARGET`,
//! `OI_STATE_HOME`), which the kernel passes through untouched.
//!
//! One held client per identity for the life of the window (O-I #858): the
//! client runs `--held`, one request per line in and its envelope back by
//! id, and the field's own transactions come out of it unasked (the rows
//! each moved, by table and ref) to the native host's event channel
//! (`on_change`). The cursor is the transaction; every device reads the one
//! cache; no request starts a process.
//!
//! Each envelope is decoded exactly like `knowledge.rs::decode_envelope`:
//! `{ok:true,data}` is the owner reading; `{ok:false,error:{kind,message}}`
//! is the owner's own failure truth, and the failure kinds the client speaks
//! (`unbound` | `unavailable` | `refused` | `malformed`) are carried as
//! distinct states. An unbound target is absence, never an error.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    ffi::OsString,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::Stdio,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc, Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};

/// The owner operation name every hosted node, edge and input carries.
pub const OWNER_OPERATION: &str = "shared-field.projection";
/// The read scope a SharedField reading depends on: the window's held field,
/// retired by its own news (`shared_field_changed`), never by the ground's.
pub const READ_SCOPE: &str = "shared-field";

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

/// A request the client answers by reading the hosted field (or the
/// kernel-side observation lease) and changing nothing there: it may run
/// outside the kernel lock (owner_read.rs `PreparedRead`). Named one by one:
/// every other kind — a publish, a contribution, presence, a stage move, a
/// grant, a lease release, an observation's stop — touches no kernel state
/// and runs free of the lock (dispatch.rs, lane W3).
pub fn is_read(request: &Value) -> bool {
    matches!(
        request["kind"].as_str(),
        Some(
            "status"
                | "identity"
                | "receipt"
                | "observe"
                | "snapshot"
                | "worlds"
                | "read"
                | "stage"
                | "field-now"
                | "field-day"
                | "nara-presences"
        )
    )
}

/// Send one request to this window's held SharedField client and return the
/// owner `data`. No request starts a process: the one client for this
/// identity is held for the life of the window (`hold`), and every request,
/// observation and presence goes in on it (O-I #858).
pub fn call(request: &Value) -> Result<Value, CallError> {
    if request.get("token_label").is_some() || request.get("hold_presence").is_some() {
        return Err(CallError::Refused {
            message: "The native host owns the transport credential and presence connection".into(),
        });
    }
    held().call(request)
}

/// Stand this window's SharedField client up for its identity, once. The
/// native host calls it as the window opens, so the first request finds the
/// client already held.
pub fn hold() {
    let _ = held();
}

/// Hear every transaction a held client takes: the native host records it
/// as `KernelEvent::SharedFieldChanged` and sends it on its event channel.
/// The first listener is kept.
pub fn on_change(listener: impl Fn(&FieldChange) + Send + Sync + 'static) -> bool {
    CHANGES.set(Arc::new(listener)).is_ok()
}

/// The identity this window stands as on the field: the configured transport
/// label (`OI_SHARED_FIELD_TOKEN_LABEL`), else the owner's. The credential
/// itself stays in the client's own state home.
fn identity_label() -> String {
    std::env::var("OI_SHARED_FIELD_TOKEN_LABEL")
        .ok()
        .filter(|label| {
            !label.is_empty()
                && label.len() <= 64
                && label
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        })
        .unwrap_or_else(|| "owner".into())
}

type ChangeSink = Arc<dyn Fn(&FieldChange) + Send + Sync>;
static CHANGES: OnceLock<ChangeSink> = OnceLock::new();
/// The held clients, one per (client executable, identity label).
type HeldClients = HashMap<(OsString, String), Arc<HeldClient>>;
static HELD: OnceLock<Mutex<HeldClients>> = OnceLock::new();

/// The held client for this identity and client executable, started the
/// first time it is asked for and kept for the life of the process.
fn held() -> Arc<HeldClient> {
    let key = (client_executable().into_os_string(), identity_label());
    let mut clients = lock(HELD.get_or_init(Default::default));
    Arc::clone(clients.entry(key.clone()).or_insert_with(|| {
        let heard: ChangeSink = Arc::new(|change: &FieldChange| {
            if let Some(listener) = CHANGES.get() {
                listener(change);
            }
        });
        HeldClient::start(key.0, key.1, Timing::WINDOW, Some(heard))
    }))
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// One transaction a held client took: its cursor, the rows it moved — by
/// table, op and ref, never their content — and how many it did not name.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FieldChange {
    pub cursor: String,
    pub changes: Vec<crate::events::SharedFieldRowChange>,
    pub more: u64,
}

/// The bounds a held client keeps: one reply's wait, an observation's or a
/// presence's lease without a poll, how often lapsed leases are let go, and
/// the first wait before a client that ended is started again.
#[derive(Clone, Copy, Debug)]
pub struct Timing {
    pub reply: Duration,
    pub lease: Duration,
    pub sweep: Duration,
    pub restart: Duration,
}

impl Timing {
    /// A window's: a minute for one reply, two minutes' lease.
    pub const WINDOW: Timing = Timing {
        reply: CLIENT_CALL_LIMIT,
        lease: Duration::from_secs(120),
        sweep: Duration::from_secs(5),
        restart: Duration::from_secs(1),
    };
}

/// What an observation or a presence holds: its subject, the view lease it
/// keeps on the held client, and when it was last asked for.
struct Lease {
    subject: Value,
    view: String,
    last: Instant,
    /// The connection that held it went; nothing is replayed.
    gone: bool,
}

/// One identity's SharedField client, held for the life of the window: the
/// one process (`field.sh --held`, field.ts), its one connection and its
/// one cache, which every device reads. Requests go in by id and come back
/// by id; the field's own transactions come out unasked and move the
/// cursor. A client that ends is started again by this holder, never by a
/// request; while none stands, a request is unavailable with the reason.
pub struct HeldClient {
    executable: OsString,
    label: String,
    timing: Timing,
    /// The field's news, carried off the reader so a listener that waits
    /// (on the kernel lock, say) never holds a reply back.
    news: Mutex<Option<mpsc::Sender<FieldChange>>>,
    link: Mutex<Option<std::process::ChildStdin>>,
    down: Mutex<String>,
    /// A client that could not hold (no runtime, say) says why in one
    /// unnumbered envelope before it ends; that is the reason it is down.
    last_word: Mutex<Option<String>>,
    pending: Mutex<HashMap<u64, mpsc::Sender<Result<Value, CallError>>>>,
    next: AtomicU64,
    launches: AtomicU64,
    cursor: Mutex<String>,
    /// The client ended after the window had read the field: its next
    /// connection is news, as a returning service's is.
    stale: AtomicBool,
    readings: Mutex<HashMap<String, (String, Value)>>,
    observers: Mutex<HashMap<String, Lease>>,
    presence: Mutex<HashMap<String, Lease>>,
    views: AtomicU64,
}

impl HeldClient {
    /// Start the client for `label` and hold it. The first launch happens
    /// here, so the first request finds it standing (or the reason it is not).
    pub fn start(
        executable: OsString,
        label: String,
        timing: Timing,
        sink: Option<ChangeSink>,
    ) -> Arc<Self> {
        let news = sink.map(|sink| {
            let (send, receive) = mpsc::channel::<FieldChange>();
            std::thread::spawn(move || {
                for change in receive {
                    sink(&change);
                }
            });
            send
        });
        let held = Arc::new(Self {
            executable,
            label,
            timing,
            news: Mutex::new(news),
            link: Mutex::new(None),
            down: Mutex::new("The SharedField client is starting".into()),
            last_word: Mutex::new(None),
            pending: Mutex::new(HashMap::new()),
            next: AtomicU64::new(1),
            launches: AtomicU64::new(0),
            cursor: Mutex::new(String::new()),
            stale: AtomicBool::new(false),
            readings: Mutex::new(HashMap::new()),
            observers: Mutex::new(HashMap::new()),
            presence: Mutex::new(HashMap::new()),
            views: AtomicU64::new(1),
        });
        let first = held.launch();
        let supervisor = Arc::clone(&held);
        std::thread::spawn(move || supervisor.supervise(first));
        let sweeper = Arc::clone(&held);
        std::thread::spawn(move || loop {
            std::thread::sleep(sweeper.timing.sweep);
            sweeper.sweep();
        });
        held
    }

    /// How many times this holder has started its client.
    pub fn launches(&self) -> u64 {
        self.launches.load(Ordering::Acquire)
    }

    /// The transaction the held client last reported.
    pub fn cursor(&self) -> String {
        lock(&self.cursor).clone()
    }

    fn launch(&self) -> Option<(std::process::Child, std::process::ChildStdout)> {
        let mut command = crate::flow::child(&self.executable);
        // In its own folder, never its host's: a host's folder can be removed
        // while the client still loads, and a client left loading in a folder
        // that is gone neither ends nor reads its input again, so it would
        // outlive its host.
        if let Some(own) = std::path::Path::new(&self.executable)
            .parent()
            .filter(|dir| dir.is_absolute())
        {
            command.current_dir(own);
        }
        let spawned = command
            .arg("--held")
            .env("OI_SHARED_FIELD_TOKEN_LABEL", &self.label)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn();
        match spawned {
            Ok(mut child) => match (child.stdin.take(), child.stdout.take()) {
                (Some(stdin), Some(stdout)) => {
                    *lock(&self.link) = Some(stdin);
                    lock(&self.down).clear();
                    // Counted once it can be asked.
                    self.launches.fetch_add(1, Ordering::AcqRel);
                    Some((child, stdout))
                }
                _ => {
                    let _ = child.kill();
                    let _ = child.wait();
                    self.launches.fetch_add(1, Ordering::AcqRel);
                    *lock(&self.down) = "The SharedField client gave no pipes".into();
                    None
                }
            },
            Err(error) => {
                *lock(&self.down) = format!(
                    "SharedField client could not be launched ({}): {error}",
                    self.executable.to_string_lossy()
                );
                None
            }
        }
    }

    /// Read the client until it ends, then start it again after a wait that
    /// doubles to half a minute (and starts over after a long run).
    fn supervise(
        self: Arc<Self>,
        mut running: Option<(std::process::Child, std::process::ChildStdout)>,
    ) {
        let mut wait = self.timing.restart;
        loop {
            if let Some((mut child, stdout)) = running.take() {
                let began = Instant::now();
                for line in BufReader::new(stdout).lines() {
                    match line {
                        Ok(line) => self.route(&line),
                        Err(_) => break,
                    }
                }
                *lock(&self.link) = None;
                *lock(&self.down) = lock(&self.last_word).take().unwrap_or_else(|| {
                    "The SharedField client ended; it is being started again".into()
                });
                let _ = child.kill();
                let _ = child.wait();
                self.lost();
                if began.elapsed() > Duration::from_secs(30) {
                    wait = self.timing.restart;
                }
            }
            std::thread::sleep(wait);
            wait = (wait * 2).min(Duration::from_secs(30));
            running = self.launch();
        }
    }

    /// One line from the client: a reply to its waiting request, or the
    /// field's own news. Never asks the client anything (this is the only
    /// reader of its answers).
    fn route(&self, line: &str) {
        let Ok(message) = serde_json::from_str::<Value>(line) else {
            return;
        };
        if let Some(id) = message.get("id").and_then(Value::as_u64) {
            if let Some(reply) = lock(&self.pending).remove(&id) {
                let _ = reply.send(decode_value(&message));
            }
            return;
        }
        match message["event"].as_str() {
            Some("transaction") => {
                let Some(cursor) = message["cursor"].as_str() else {
                    return;
                };
                *lock(&self.cursor) = cursor.to_owned();
                // Only what the event channel can tell is named; the rest is
                // counted, so a reader knows to read the whole field again.
                let named = message["changes"].as_array().map_or(&[][..], Vec::as_slice);
                let changes: Vec<crate::events::SharedFieldRowChange> = named
                    .iter()
                    .filter_map(|change| serde_json::from_value(change.clone()).ok())
                    .filter(|change: &crate::events::SharedFieldRowChange| change.fault().is_none())
                    .take(crate::events::SHARED_FIELD_CHANGES_PER_EVENT)
                    .collect();
                let more = message["more"]
                    .as_u64()
                    .unwrap_or(0)
                    .saturating_add((named.len() - changes.len()) as u64);
                if let Some(news) = lock(&self.news).as_ref() {
                    let _ = news.send(FieldChange {
                        cursor: cursor.to_owned(),
                        changes,
                        more,
                    });
                }
            }
            None => {
                if let Some(said) = message["error"]["message"].as_str() {
                    *lock(&self.last_word) = Some(said.to_owned());
                }
            }
            Some("status") => {
                if let Some(cursor) = message["cursor"].as_str() {
                    let told = std::mem::replace(&mut *lock(&self.cursor), cursor.to_owned());
                    // The field came back (a returning service, a client
                    // started again), or a field came back into view after it
                    // was out of it (field-lib `backInView`): what moved
                    // meanwhile is not named, so the window is told to read
                    // the field again at this cursor. The first connection is
                    // no news: nothing was read before it.
                    let returned = message["state"] == "live"
                        && told != cursor
                        && (!told.is_empty() || self.stale.swap(false, Ordering::AcqRel));
                    if returned {
                        if let Some(news) = lock(&self.news).as_ref() {
                            let _ = news.send(FieldChange {
                                cursor: cursor.to_owned(),
                                changes: Vec::new(),
                                more: 0,
                            });
                        }
                    }
                }
                // A presence lives as long as the connection that entered
                // it: when the connection goes, so does the presence, and
                // nothing re-enters on its own.
                if message["state"] != "live" {
                    for lease in lock(&self.presence).values_mut() {
                        lease.gone = true;
                    }
                }
            }
            _ => {}
        }
    }

    /// The client ended: what waited is unavailable, and what it held (its
    /// presences, its observations' views, its cursor) went with it.
    fn lost(&self) {
        let detail = lock(&self.down).clone();
        for (_, reply) in lock(&self.pending).drain() {
            let _ = reply.send(Err(CallError::Unavailable {
                detail: detail.clone(),
            }));
        }
        for lease in lock(&self.presence).values_mut() {
            lease.gone = true;
        }
        lock(&self.observers).clear();
        lock(&self.readings).clear();
        if !std::mem::take(&mut *lock(&self.cursor)).is_empty() {
            self.stale.store(true, Ordering::Release);
        }
    }

    /// Answer one request in the owner's words.
    pub fn call(&self, request: &Value) -> Result<Value, CallError> {
        match request["kind"].as_str() {
            Some("observe" | "observe-stop") => {
                self.renew_presence();
                self.observe(request)
            }
            Some("enter") => self.enter(request),
            Some("leave") => self.leave(request),
            _ => self.request(request),
        }
    }

    /// Put one request to the client and wait for its own reply.
    fn request(&self, request: &Value) -> Result<Value, CallError> {
        let id = self.next.fetch_add(1, Ordering::AcqRel);
        let (reply, answer) = mpsc::channel();
        lock(&self.pending).insert(id, reply);
        let line = format!("{{\"id\":{id},\"request\":{request}}}\n");
        let written = match lock(&self.link).as_mut() {
            Some(stdin) => stdin
                .write_all(line.as_bytes())
                .and_then(|()| stdin.flush())
                .map_err(|error| format!("The SharedField client could not be asked: {error}")),
            None => Err(lock(&self.down).clone()),
        };
        if let Err(detail) = written {
            lock(&self.pending).remove(&id);
            return Err(CallError::Unavailable { detail });
        }
        answer.recv_timeout(self.timing.reply).unwrap_or_else(|_| {
            lock(&self.pending).remove(&id);
            Err(CallError::Unavailable {
                detail: format!(
                    "The SharedField client did not answer {} within {} s",
                    request["kind"].as_str().unwrap_or("a request"),
                    self.timing.reply.as_secs()
                ),
            })
        })
    }

    /// An observation reads the one cache: while the cursor has not moved,
    /// every observer of a subject is answered from the reading already
    /// taken, and the client is not asked again.
    fn observe(&self, request: &Value) -> Result<Value, CallError> {
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
        self.sweep();
        if request["kind"] == "observe-stop" {
            let released = lock(&self.observers).remove(id);
            if let Some(lease) = released {
                let _ = self
                    .request(&serde_json::json!({"kind":"view","lease":lease.view,"scope":null}));
            }
            return Ok(serde_json::json!({"state":"released","observer_ref":id}));
        }
        let subject = serde_json::json!({"kind":"observe","ref":request.get("ref").cloned().unwrap_or(Value::Null)});
        let fresh = {
            let mut observers = lock(&self.observers);
            let held = observers.len();
            match observers.get_mut(id) {
                Some(lease) if lease.subject != subject => {
                    return Err(CallError::Refused {
                        message: "An observation lease cannot change its subject".into(),
                    })
                }
                Some(lease) => {
                    lease.last = Instant::now();
                    None
                }
                None if held >= 16 => {
                    return Err(CallError::Refused {
                        message: "This window has reached its native observation budget".into(),
                    })
                }
                None => {
                    let view = format!("observe:{}", self.views.fetch_add(1, Ordering::AcqRel));
                    observers.insert(
                        id.into(),
                        Lease {
                            subject: subject.clone(),
                            view: view.clone(),
                            last: Instant::now(),
                            gone: false,
                        },
                    );
                    Some(view)
                }
            }
        };
        if let Some(view) = fresh {
            // An observer has the whole field in view (Explore draws it all).
            let _ = self.request(&serde_json::json!({"kind":"view","lease":view,"scope":"whole"}));
        }
        let key = subject["ref"].to_string();
        let now = self.cursor();
        if !now.is_empty() {
            if let Some((at, reading)) = lock(&self.readings).get(&key) {
                if *at == now {
                    return Ok(reading.clone());
                }
            }
        }
        let reading = self.request(&subject)?;
        if let Some(at) = reading["cursor"].as_str() {
            lock(&self.readings).insert(key, (at.to_owned(), reading.clone()));
        }
        Ok(reading)
    }

    /// Enter a field on the held connection. The presence lasts while the
    /// connection does and while the window keeps asking (its lease); an
    /// entry goes through the reducer every time, judged by its owner.
    fn enter(&self, request: &Value) -> Result<Value, CallError> {
        let key = presence_key(request)?;
        self.sweep();
        let (view, fresh) = {
            let mut presence = lock(&self.presence);
            let held = presence.len();
            match presence.get_mut(&key) {
                Some(lease) => {
                    lease.last = Instant::now();
                    (lease.view.clone(), false)
                }
                None if held >= 8 => {
                    return Err(CallError::Refused {
                        message: "Native field presence budget reached".into(),
                    })
                }
                None => {
                    let view = format!("presence:{}", self.views.fetch_add(1, Ordering::AcqRel));
                    presence.insert(
                        key.clone(),
                        Lease {
                            subject: serde_json::json!({"field_ref":request["field_ref"],"participant_ref":request["participant_ref"]}),
                            view: view.clone(),
                            last: Instant::now(),
                            gone: false,
                        },
                    );
                    (view, true)
                }
            }
        };
        let entered = self.request(&serde_json::json!({"kind":"enter","field_ref":request["field_ref"],"participant_ref":request["participant_ref"],"state":request.get("state").cloned().unwrap_or_else(|| Value::String("entered".into()))}));
        match &entered {
            // The field it stands in stays in view while it stands there.
            Ok(_) => {
                let _ = self.request(
                    &serde_json::json!({"kind":"view","lease":view,"scope":[request["field_ref"]]}),
                );
            }
            Err(_) if fresh => {
                lock(&self.presence).remove(&key);
            }
            Err(_) => {}
        }
        entered
    }

    fn leave(&self, request: &Value) -> Result<Value, CallError> {
        let released = presence_key(request)
            .ok()
            .and_then(|key| lock(&self.presence).remove(&key));
        let left = self.request(request);
        if let Some(lease) = released {
            let _ =
                self.request(&serde_json::json!({"kind":"view","lease":lease.view,"scope":null}));
        }
        left
    }

    fn renew_presence(&self) {
        for lease in lock(&self.presence).values_mut() {
            lease.last = Instant::now();
        }
    }

    /// Let lapsed leases go: an observation nobody asked for within its
    /// lease, a presence the window stopped keeping (left through the
    /// reducer) or one whose connection went (nothing to leave).
    fn sweep(&self) {
        let lease = self.timing.lease;
        let lapsed = |held: &Lease| held.gone || held.last.elapsed() >= lease;
        let mut released: Vec<(String, Option<Value>)> = Vec::new();
        lock(&self.observers).retain(|_, held| {
            let keep = !lapsed(held);
            if !keep {
                released.push((held.view.clone(), None));
            }
            keep
        });
        lock(&self.presence).retain(|_, held| {
            let keep = !lapsed(held);
            if !keep {
                released.push((
                    held.view.clone(),
                    (!held.gone).then(|| held.subject.clone()),
                ));
            }
            keep
        });
        let observed: std::collections::HashSet<String> = lock(&self.observers)
            .values()
            .map(|held| held.subject["ref"].to_string())
            .collect();
        lock(&self.readings).retain(|subject, _| observed.contains(subject));
        for (view, presence) in released {
            if let Some(presence) = presence {
                let _ = self.request(&serde_json::json!({"kind":"leave","field_ref":presence["field_ref"],"participant_ref":presence["participant_ref"]}));
            }
            let _ = self.request(&serde_json::json!({"kind":"view","lease":view,"scope":null}));
        }
    }
}

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

/// One SharedField client call's bound: the client reaches the hosted field
/// over the network; the bound is for a client that never answers.
const CLIENT_CALL_LIMIT: Duration = Duration::from_secs(60);
/// One A2A exchange's bound: the runner waits for the other agent's reply.
const A2A_EXCHANGE_LIMIT: Duration = Duration::from_secs(300);

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
    let envelope: Value = serde_json::from_slice(stdout).map_err(|e| CallError::Malformed {
        detail: format!(
            "SharedField client returned an unreadable envelope ({e}): {}",
            String::from_utf8_lossy(stderr).trim()
        ),
    })?;
    decode_value(&envelope)
}

/// One envelope, held client or one-shot: `ok:true` is the owner's data;
/// `ok:false` carries the client's own error kind.
fn decode_value(envelope: &Value) -> Result<Value, CallError> {
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
        Some("preview_nara" | "publish_nara" | "withdraw_nara")
    ) {
        return Err(
            "Native Nara presence goes through the kernel's nara_presence: the saved identity and Expression admission route, and the person's withdrawal"
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
            let mut command = crate::flow::child(launcher);
            command.env("OI_SHARED_FIELD_ENTRY", "a2a-runner.mjs");
            command
        }
        None => {
            let mut command = crate::flow::child(&node);
            command.arg(&runner);
            command
        }
    };
    let output = crate::owner_process::output(
        &mut command,
        Some(composed.to_string().into_bytes()),
        crate::owner_process::Bound::write("the A2A runner", "exchange", A2A_EXCHANGE_LIMIT),
    )
    .map_err(|failure| match failure.failed {
        crate::owner_process::Failed::Unavailable => format!(
            "the A2A runner could not be launched via node ({}): {failure}",
            node.display()
        ),
        _ => failure.message,
    })?;
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
    // REPLACED (#858, lane BB): the client is held, not launched per request.
    // A held client that cannot be launched answers every request
    // Unavailable with the launch's reason.
    fn a_missing_client_is_unavailable_with_its_reason() {
        let held = HeldClient::start(
            OsString::from(NO_CLIENT),
            "owner".into(),
            Timing::WINDOW,
            None,
        );
        let error = held
            .call(&serde_json::json!({"kind":"status"}))
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
    // REPLACED (#858, lane BB): absence through the held client.
    fn a_missing_client_executable_is_absence_not_a_panic() {
        let held = HeldClient::start(
            OsString::from("/nonexistent/oi-shared-field-client"),
            "owner".into(),
            Timing::WINDOW,
            None,
        );
        let error = held
            .call(&serde_json::json!({"kind":"status"}))
            .unwrap_err();
        assert!(matches!(error, CallError::Unavailable { .. }));
        assert_eq!(held.launches(), 0, "nothing was started");
    }
}

/// The held client (O-I #858) over a fake that speaks its line protocol.
#[cfg(all(test, unix))]
mod held_tests {
    use super::*;
    use crate::events::SharedFieldRowChange;
    use serde_json::json;
    use std::os::unix::fs::PermissionsExt;
    use std::path::Path;

    /// A fake held client (field.ts `--held`'s protocol) over files in its
    /// directory: each launch is logged with its arguments, each request
    /// kept; `snapshot.json` answers snapshot and observe at the cursor in
    /// `cursor`; `fake-tx` stands for a transaction the field sends (moving
    /// the row named in `moved`), `fake-exit` for the client ending. Not a
    /// SharedField — a transport fixture.
    const FAKE: &str = r#"#!/usr/bin/env bash
d="@DIR@"
printf 'launch %s\n' "$*" >> "$d/launches"
pwd -P > "$d/cwd"
printf '{"event":"status","state":"live","cursor":"%s"}\n' "$(cat "$d/cursor")"
while IFS= read -r line; do
  id="${line#\{\"id\":}"; id="${id%%,*}"
  request="${line#*\"request\":}"; request="${request%\}}"
  printf '%s\n' "$request" >> "$d/asked.jsonl"
  case "$request" in
    *'"kind":"fake-exit"'*) exit 0 ;;
    *'"kind":"fake-tx"'*)
      printf 'tx:1:%s' "$id" > "$d/cursor"
      printf '{"event":"transaction","cursor":"tx:1:%s","changes":[{"table":"projection","op":"insert","ref":"%s"}],"more":0}\n' "$id" "$(cat "$d/moved")"
      printf '{"id":%s,"ok":true,"data":{}}\n' "$id" ;;
    *'"kind":"observe"'*) printf '{"id":%s,"ok":true,"data":{"schema":"oi.shared-field.observation/v1","cursor":"%s","snapshot":%s}}\n' "$id" "$(cat "$d/cursor")" "$(cat "$d/snapshot.json")" ;;
    *'"kind":"snapshot"'*) printf '{"id":%s,"ok":true,"data":%s}\n' "$id" "$(cat "$d/snapshot.json")" ;;
    *) printf '{"id":%s,"ok":true,"data":{"echo":%s}}\n' "$id" "$request" ;;
  esac
done
"#;

    /// Short leases and quick restarts, so a test sees them lapse; a reply
    /// still has the headroom of every wait a test is owed.
    const QUICK: Timing = Timing {
        reply: HEARD,
        lease: Duration::from_millis(1500),
        sweep: Duration::from_millis(50),
        restart: Duration::from_millis(100),
    };

    fn snapshot(entries: Value) -> Value {
        json!({"schema":"oi.shared-field.snapshot/v1","target":{"uri":"ws://fake.invalid:3000","database":"fake"},
            "fields":[],"participants":[],"projections":[],"relations":[],"entries":entries,
            "counts":{"entries":entries.as_array().map_or(0, Vec::len)}})
    }

    fn fake(name: &str, entries: Value, moved: &str) -> (PathBuf, OsString) {
        let dir = std::env::temp_dir().join(format!("oi-sf-held-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("cursor"), "tx:1:0").unwrap();
        std::fs::write(dir.join("moved"), moved).unwrap();
        std::fs::write(dir.join("snapshot.json"), snapshot(entries).to_string()).unwrap();
        let bin = dir.join("field-client");
        std::fs::write(&bin, FAKE.replace("@DIR@", &dir.display().to_string())).unwrap();
        std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755)).unwrap();
        crate::test_stub::settle_stub(&bin);
        (dir, bin.into_os_string())
    }

    fn asked(dir: &Path) -> Vec<Value> {
        std::fs::read_to_string(dir.join("asked.jsonl"))
            .unwrap_or_default()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }

    fn asked_kind(dir: &Path, kind: &str) -> Vec<Value> {
        asked(dir)
            .into_iter()
            .filter(|request| request["kind"] == kind)
            .collect()
    }

    fn launches(dir: &Path) -> Vec<String> {
        std::fs::read_to_string(dir.join("launches"))
            .unwrap_or_default()
            .lines()
            .map(str::to_owned)
            .collect()
    }

    /// How long a test waits on an event it is owed before it fails: headroom
    /// for a machine running every suite at once, never a measure of speed.
    const HEARD: Duration = Duration::from_secs(30);

    fn eventually(what: &str, mut done: impl FnMut() -> bool) {
        let began = Instant::now();
        while !done() {
            assert!(began.elapsed() < HEARD, "timed out waiting for {what}");
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    fn listener() -> (ChangeSink, mpsc::Receiver<FieldChange>) {
        let (send, heard) = mpsc::channel();
        let send = Mutex::new(send);
        let sink: ChangeSink = Arc::new(move |change: &FieldChange| {
            let _ = lock(&send).send(change.clone());
        });
        (sink, heard)
    }

    #[test]
    fn the_worlds_read_alone_are_a_read_like_the_snapshot_and_their_acts_are_not() {
        // The World reads the worlds alone (O-I #858), outside the kernel lock as the snapshot is.
        assert!(is_read(&json!({"kind":"worlds"})));
        assert!(is_read(&json!({"kind":"snapshot"})));
        for act in ["world-put", "star-light", "clearing-open"] {
            assert!(!is_read(&json!({ "kind": act })), "{act} writes");
        }
    }

    #[test]
    fn one_client_answers_every_request_and_no_request_starts_a_process() {
        let (dir, bin) = fake("one", json!([]), "projection:one");
        let held = HeldClient::start(bin, "owner".into(), Timing::WINDOW, None);
        assert_eq!(
            held.call(&json!({"kind":"status"})).unwrap()["echo"]["kind"],
            "status"
        );
        assert_eq!(
            held.call(&json!({"kind":"snapshot"})).unwrap()["schema"],
            "oi.shared-field.snapshot/v1"
        );
        for _ in 0..3 {
            let reading = held
                .call(&json!({"kind":"observe","observer_ref":"explore:one"}))
                .unwrap();
            assert_eq!(
                reading["cursor"], "tx:1:0",
                "an observation answers at once, at the held cursor"
            );
        }
        held.call(
            &json!({"kind":"enter","field_ref":"oi:field:one","participant_ref":"participant:one"}),
        )
        .unwrap();
        held.call(
            &json!({"kind":"leave","field_ref":"oi:field:one","participant_ref":"participant:one"}),
        )
        .unwrap();
        held.call(&json!({"kind":"observe-stop","observer_ref":"explore:one"}))
            .unwrap();
        // Many callers at once, each answered by its own id.
        std::thread::scope(|scope| {
            let callers: Vec<_> = (0..8)
                .map(|n| {
                    let held = &held;
                    scope.spawn(move || {
                        (
                            n,
                            held.call(&json!({"kind":"read","ref":format!("ref:{n}")}))
                                .unwrap(),
                        )
                    })
                })
                .collect();
            for caller in callers {
                let (n, answer) = caller.join().unwrap();
                assert_eq!(answer["echo"]["ref"], format!("ref:{n}"));
            }
        });
        assert_eq!(held.launches(), 1, "one client for the window's life");
        assert_eq!(launches(&dir), vec!["launch --held".to_owned()]);
        assert_eq!(
            asked_kind(&dir, "observe").len(),
            1,
            "three polls at one cursor read one cache"
        );
        assert!(
            asked(&dir)
                .iter()
                .all(|request| request.get("hold_presence").is_none()),
            "the held connection is the presence; no process holds it"
        );
    }

    #[test]
    fn a_transaction_comes_out_as_its_rows_and_moves_the_cursor_for_every_device() {
        let (dir, bin) = fake("tx", json!([]), "projection:key:1");
        let (sink, heard) = listener();
        let held = HeldClient::start(bin, "owner".into(), Timing::WINDOW, Some(sink));
        held.call(&json!({"kind":"observe","observer_ref":"explore:first"}))
            .unwrap();
        held.call(&json!({"kind":"observe","observer_ref":"explore:second"}))
            .unwrap();
        assert_eq!(
            asked_kind(&dir, "observe").len(),
            1,
            "a second device reads the same cache"
        );
        held.call(&json!({"kind":"fake-tx"})).unwrap();
        let change = heard.recv_timeout(HEARD).expect("the transaction came out");
        assert_eq!(
            change.cursor,
            held.cursor(),
            "the cursor is the transaction"
        );
        assert_eq!(
            change.changes,
            vec![SharedFieldRowChange {
                table: "projection".into(),
                op: "insert".into(),
                reference: "projection:key:1".into()
            }],
            "the rows it moved, by view, op and ref"
        );
        crate::events::KernelEvent::SharedFieldChanged {
            cursor: change.cursor.clone(),
            changes: change.changes.clone(),
            more: change.more,
        }
        .validate()
        .expect("what the host records is a kernel event");
        for observer in ["explore:first", "explore:second"] {
            let reading = held
                .call(&json!({"kind":"observe","observer_ref":observer}))
                .unwrap();
            assert_eq!(reading["cursor"], change.cursor.as_str());
        }
        assert_eq!(
            asked_kind(&dir, "observe").len(),
            2,
            "the moved cursor is read once, for both"
        );
    }

    #[test]
    fn a_row_the_event_channel_cannot_tell_is_counted_not_named() {
        let (_, bin) = fake("untold", json!([]), "projection:one");
        let (sink, heard) = listener();
        let held = HeldClient::start(bin, "owner".into(), Timing::WINDOW, Some(sink));
        held.route(r#"{"event":"transaction","cursor":"tx:1:9","changes":[{"table":"projection","op":"insert","ref":"projection:ok"},{"table":"backing_table","op":"insert","ref":"x"},{"table":"projection","op":"truncate","ref":"y"},{"table":"projection","op":"delete","ref":""}],"more":2}"#);
        let change = heard.recv_timeout(HEARD).unwrap();
        assert_eq!(change.changes.len(), 1);
        assert_eq!(change.changes[0].reference, "projection:ok");
        assert_eq!(
            change.more, 5,
            "two the client did not name and three it could not"
        );
        let event = crate::events::KernelEvent::SharedFieldChanged {
            cursor: change.cursor,
            changes: change.changes,
            more: change.more,
        };
        event.validate().unwrap();
        let untold = crate::events::KernelEvent::SharedFieldChanged {
            cursor: "tx:1:9".into(),
            changes: vec![SharedFieldRowChange {
                table: "backing_table".into(),
                op: "insert".into(),
                reference: "x".into(),
            }],
            more: 0,
        };
        assert!(
            untold.validate().is_err(),
            "a view the field does not serve is never an event"
        );
    }

    #[test]
    fn a_world_its_clearings_and_its_gatherings_are_named_on_the_event_channel() {
        let (_, bin) = fake("worlds", json!([]), "projection:one");
        let (sink, heard) = listener();
        let held = HeldClient::start(bin, "owner".into(), Timing::WINDOW, Some(sink));
        held.route(r#"{"event":"transaction","cursor":"tx:1:4","changes":[{"table":"world","op":"update","ref":"world:a"},{"table":"my_world","op":"update","ref":"world:a"},{"table":"world_clearing","op":"insert","ref":"[\"world:a\",\"page:p\",\"\"]"},{"table":"world_gathering","op":"insert","ref":"[\"star:s\",\"world:a\"]"}],"more":0}"#);
        let change = heard.recv_timeout(HEARD).unwrap();
        assert_eq!(
            change
                .changes
                .iter()
                .map(|c| c.table.as_str())
                .collect::<Vec<_>>(),
            ["world", "my_world", "world_clearing", "world_gathering"],
            "the worlds' views are the field's own: each row is named, none only counted"
        );
        assert_eq!(change.more, 0);
        crate::events::KernelEvent::SharedFieldChanged {
            cursor: change.cursor,
            changes: change.changes,
            more: change.more,
        }
        .validate()
        .unwrap();
    }

    #[test]
    fn a_field_back_from_a_lost_service_tells_the_window_to_read_again() {
        let (_, bin) = fake("back", json!([]), "projection:one");
        let (sink, heard) = listener();
        let held = HeldClient::start(bin, "owner".into(), Timing::WINDOW, Some(sink));
        eventually("the first live status", || held.cursor() == "tx:1:0");
        assert!(
            heard.recv_timeout(Duration::from_millis(300)).is_err(),
            "the first connection is no news: nothing was read before it"
        );
        held.route(r#"{"event":"status","state":"degraded","cursor":"tx:1:0","detail":"The SharedField connection ended"}"#);
        held.route(r#"{"event":"status","state":"connecting","cursor":"tx:1:0"}"#);
        assert!(
            heard.recv_timeout(Duration::from_millis(300)).is_err(),
            "losing the service moves nothing: the world stays as it was"
        );
        held.route(r#"{"event":"status","state":"live","cursor":"tx:2:0"}"#);
        let back = heard
            .recv_timeout(HEARD)
            .expect("the window is told to read again when the field returns");
        assert_eq!(back.cursor, "tx:2:0");
        assert!(
            back.changes.is_empty() && back.more == 0,
            "it names nothing: read the field again, whole"
        );
        crate::events::KernelEvent::SharedFieldChanged {
            cursor: back.cursor,
            changes: back.changes,
            more: back.more,
        }
        .validate()
        .unwrap();
        held.route(r#"{"event":"status","state":"live","cursor":"tx:2:0"}"#);
        assert!(
            heard.recv_timeout(Duration::from_millis(300)).is_err(),
            "a status at the cursor already told says nothing more"
        );
        // The whole field back in view after a narrower one moved unseen.
        held.route(r#"{"event":"status","state":"live","cursor":"tx:2:1"}"#);
        assert_eq!(heard.recv_timeout(HEARD).unwrap().cursor, "tx:2:1");
        // One field back in view after its glance lapsed: what is held of it
        // (a FieldNow read while it was in view) is read again.
        held.route(r#"{"event":"status","state":"live","cursor":"tx:2:2"}"#);
        assert_eq!(heard.recv_timeout(HEARD).unwrap().cursor, "tx:2:2");
    }

    #[test]
    fn a_client_started_again_tells_the_window_to_read_again() {
        let (_, bin) = fake("again", json!([]), "projection:one");
        let (sink, heard) = listener();
        let held = HeldClient::start(bin, "owner".into(), QUICK, Some(sink));
        eventually("the first live status", || held.cursor() == "tx:1:0");
        let _ = held.call(&json!({"kind":"fake-exit"}));
        let again = heard
            .recv_timeout(HEARD)
            .expect("the client's next start tells the window to read again");
        assert!(again.changes.is_empty());
        assert_eq!(held.launches(), 2);
    }

    #[test]
    fn the_client_stands_in_its_own_folder_whatever_folder_its_host_stands_in() {
        // A host's working folder can be removed while its client still loads
        // (a test's ground, a temporary folder), and a client left loading in
        // a folder that is gone neither ends nor reads its input again: it
        // outlives its host. Its own folder stands as long as it does.
        let (dir, bin) = fake("cwd", json!([]), "projection:one");
        let held = HeldClient::start(bin, "owner".into(), QUICK, None);
        eventually("the client to stand", || held.cursor() == "tx:1:0");
        let stood = std::fs::read_to_string(dir.join("cwd")).unwrap();
        assert_eq!(
            Path::new(stood.trim()),
            dir.canonicalize().unwrap(),
            "the client is started in its own folder, not its host's"
        );
    }

    #[test]
    fn an_observation_keeps_its_subject_and_budget_and_lets_its_view_go() {
        let (dir, bin) = fake("observe", json!([]), "projection:one");
        let held = HeldClient::start(bin, "owner".into(), Timing::WINDOW, None);
        held.call(&json!({"kind":"observe","observer_ref":"explore:lease"}))
            .unwrap();
        let views = asked_kind(&dir, "view");
        assert_eq!(views.len(), 1);
        assert_eq!(
            views[0]["scope"], "whole",
            "an observer has the whole field in view"
        );
        let lease = views[0]["lease"].clone();
        assert!(matches!(
            held.call(
                &json!({"kind":"observe","observer_ref":"explore:lease","ref":"world:other"})
            ),
            Err(CallError::Refused { .. })
        ));
        assert!(matches!(
            held.call(&json!({"kind":"observe","observer_ref":"bad ref!"})),
            Err(CallError::Malformed { .. })
        ));
        for n in 1..16 {
            held.call(&json!({"kind":"observe","observer_ref":format!("explore:{n}")}))
                .unwrap();
        }
        assert!(matches!(
            held.call(&json!({"kind":"observe","observer_ref":"explore:over"})),
            Err(CallError::Refused { .. })
        ));
        let released = held
            .call(&json!({"kind":"observe-stop","observer_ref":"explore:lease"}))
            .unwrap();
        assert_eq!(released["state"], "released");
        assert!(
            asked_kind(&dir, "view")
                .iter()
                .any(|view| view["lease"] == lease && view["scope"].is_null()),
            "a stopped observation lets its view go"
        );
    }

    /// A lease no busy machine outlasts: what is judged by count (the budget,
    /// the reducer's passage) never waits on the clock.
    const KEPT: Timing = Timing {
        lease: Duration::from_secs(600),
        ..QUICK
    };

    #[test]
    fn presence_stands_on_the_held_connection_within_its_budget() {
        let (dir, bin) = fake("presence", json!([]), "projection:one");
        let held = HeldClient::start(bin, "owner".into(), KEPT, None);
        eventually("the client to stand", || held.cursor() == "tx:1:0");
        let enter =
            json!({"kind":"enter","field_ref":"oi:field:here","participant_ref":"participant:me"});
        held.call(&enter).unwrap();
        held.call(&enter).unwrap();
        assert_eq!(
            asked_kind(&dir, "enter").len(),
            2,
            "every entry goes through the reducer"
        );
        let view = asked_kind(&dir, "view")
            .into_iter()
            .next()
            .expect("a presence keeps its field in view");
        assert_eq!(view["scope"], json!(["oi:field:here"]));
        for n in 1..8 {
            held.call(&json!({"kind":"enter","field_ref":format!("oi:field:{n}"),"participant_ref":"participant:me"})).unwrap();
        }
        assert!(matches!(
            held.call(&json!({"kind":"enter","field_ref":"oi:field:over","participant_ref":"participant:me"})),
            Err(CallError::Refused { .. })
        ));
        assert!(
            asked_kind(&dir, "leave").is_empty(),
            "a kept presence is never left"
        );
        assert_eq!(held.launches(), 1);
    }

    #[test]
    fn a_presence_nobody_keeps_is_left_through_the_reducer_and_its_view_let_go() {
        let (dir, bin) = fake("lapse", json!([]), "projection:one");
        let held = HeldClient::start(bin, "owner".into(), QUICK, None);
        // A start on a busy machine is not counted against the first lease.
        eventually("the client to stand", || held.cursor() == "tx:1:0");
        let fields: Vec<String> = (0..3).map(|n| format!("oi:field:{n}")).collect();
        for field in &fields {
            held.call(
                &json!({"kind":"enter","field_ref":field,"participant_ref":"participant:me"}),
            )
            .unwrap();
        }
        // Nobody asks for the fields any more: each presence lapses and is
        // left once, whenever the sweep finds it; the order is what is judged.
        eventually(
            "the lapsed presences to be left and their views let go",
            || {
                asked_kind(&dir, "leave").len() == fields.len()
                    && asked_kind(&dir, "view")
                        .iter()
                        .filter(|view| view["scope"].is_null())
                        .count()
                        == fields.len()
            },
        );
        let asked = asked(&dir);
        let at = |kind: &str, field: &str| {
            asked
                .iter()
                .position(|request| request["kind"] == kind && request["field_ref"] == field)
        };
        for field in &fields {
            let entered = at("enter", field).expect("entered");
            let left = at("leave", field).expect("each lapsed presence is left");
            assert!(entered < left, "{field} is left after it was entered");
        }
        let views: Vec<&Value> = asked
            .iter()
            .filter(|request| request["kind"] == "view")
            .collect();
        for kept in views.iter().filter(|view| !view["scope"].is_null()) {
            assert_eq!(
                views
                    .iter()
                    .filter(|view| view["lease"] == kept["lease"] && view["scope"].is_null())
                    .count(),
                1,
                "each presence's view is let go once"
            );
        }
        assert_eq!(held.launches(), 1);
    }

    #[test]
    fn a_client_that_ends_fails_what_waits_and_is_started_again_by_its_holder_alone() {
        let (dir, bin) = fake("ends", json!([]), "projection:one");
        let held = HeldClient::start(bin, "owner".into(), QUICK, None);
        assert!(matches!(
            held.call(&json!({"kind":"fake-exit"})),
            Err(CallError::Unavailable { .. })
        ));
        eventually("the holder to start the client again", || {
            held.launches() == 2
        });
        for _ in 0..5 {
            held.call(&json!({"kind":"status"})).unwrap();
        }
        assert_eq!(held.launches(), 2, "requests start nothing");
        assert_eq!(launches(&dir).len(), 2);
    }

    #[test]
    fn a_client_that_cannot_hold_says_why_and_that_is_the_reason_it_is_down() {
        let dir = std::env::temp_dir().join(format!("oi-sf-held-word-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let bin = dir.join("field-client");
        std::fs::write(
            &bin,
            "#!/bin/sh\nprintf '%s\\n' '{\"ok\":false,\"error\":{\"kind\":\"unavailable\",\"message\":\"the SharedField client needs a node runtime\"}}'\nexit 1\n",
        )
        .unwrap();
        std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755)).unwrap();
        crate::test_stub::settle_stub(&bin);
        let held = HeldClient::start(bin.into_os_string(), "owner".into(), Timing::WINDOW, None);
        eventually("the client's own reason", || {
            matches!(held.call(&json!({"kind":"status"})),
                Err(CallError::Unavailable { detail }) if detail.contains("needs a node runtime"))
        });
    }

    /// The no-leaks law at the held client (O-I #858): each identity's client
    /// is its own — its own cache, cursor and news. A private mark another
    /// identity's client takes reaches none of them (the graph the kernel
    /// folds is asked in tests/shared_field_held.rs).
    #[test]
    fn another_identitys_private_mark_reaches_neither_this_identitys_cache_nor_its_news() {
        const MARK: &str = "PRIVATE-MARK-858";
        let unshown = json!({"ref":format!("world:a/page:unshown-{MARK}"),"kind":"page","world_ref":"world:a","label":format!("unshown {MARK}"),"aliases":[]});
        let shown = json!({"ref":"world:b/page:shown","kind":"page","world_ref":"world:b","label":"shown","aliases":[]});
        let (_, a_bin) = fake(
            "leak-a",
            json!([unshown, shown.clone()]),
            &format!("world:a/page:unshown-{MARK}"),
        );
        let (b_dir, b_bin) = fake("leak-b", json!([shown]), "world:b/page:shown");
        let (a_sink, a_heard) = listener();
        let (b_sink, b_heard) = listener();
        let a = HeldClient::start(a_bin, "leak-a".into(), Timing::WINDOW, Some(a_sink));
        let b = HeldClient::start(b_bin, "leak-b".into(), Timing::WINDOW, Some(b_sink));
        let observe = json!({"kind":"observe","observer_ref":"explore:same"});
        // A reads its own mark and takes a transaction naming it.
        assert!(
            a.call(&observe).unwrap().to_string().contains(MARK),
            "the mark was planted"
        );
        a.call(&json!({"kind":"fake-tx"})).unwrap();
        assert!(a_heard.recv_timeout(HEARD).unwrap().changes[0]
            .reference
            .contains(MARK));
        // B, on the same subject, at its own cursor.
        let observed = b.call(&observe).unwrap();
        let snapshot = b.call(&json!({"kind":"snapshot"})).unwrap();
        for payload in [observed.to_string(), snapshot.to_string()] {
            assert!(
                !payload.contains(MARK),
                "B received A's private mark: {payload}"
            );
        }
        assert_eq!(
            snapshot["counts"]["entries"], 1,
            "B counts only what it is shown"
        );
        assert_ne!(
            b.cursor(),
            a.cursor(),
            "A's transaction moved A's cursor alone"
        );
        std::thread::sleep(Duration::from_millis(200));
        assert!(
            b_heard.try_recv().is_err(),
            "B heard nothing of A's transaction"
        );
        assert_eq!(
            asked_kind(&b_dir, "observe").len(),
            1,
            "B's reading is B's own client's"
        );
    }
}

#[cfg(test)]
mod tx14_walk {
    use super::*;
    use serde_json::json;
    use std::process::Command;

    /// TX14 (docs/experience/STORIES.md): "If the field's service is lost, my
    /// own work and its open moments stay as they are, and reconnecting brings
    /// what I have shown back up to date." Walked on the window's own held
    /// client (the real SharedField client, `client_executable`) against a
    /// local SpacetimeDB the walk stops and starts again on the same data: the
    /// client's target in SPACETIMEDB_URI and SPACETIMEDB_DATABASE, its
    /// credentials under OI_STATE_HOME, and the two acts as shell commands,
    /// OI_TX14_STOP and OI_TX14_START. Never in CI, never on a shared field.
    #[test]
    #[ignore = "TX14 walk: a local SpacetimeDB it stops and starts (SPACETIMEDB_URI, SPACETIMEDB_DATABASE, OI_STATE_HOME, OI_TX14_STOP, OI_TX14_START)"]
    fn the_field_lost_and_found_again_keeps_my_world_and_brings_it_up_to_date() {
        let env = |name: &str| {
            std::env::var(name).unwrap_or_else(|_| panic!("the TX14 walk needs {name}"))
        };
        let uri = env("SPACETIMEDB_URI");
        assert!(
            uri.starts_with("ws://127.0.0.1:") || uri.starts_with("ws://localhost:"),
            "the TX14 walk stops and starts a local SpacetimeDB only, not {uri}"
        );
        let (_, _, stop, start) = (
            env("SPACETIMEDB_DATABASE"),
            env("OI_STATE_HOME"),
            env("OI_TX14_STOP"),
            env("OI_TX14_START"),
        );
        let shell = |command: &str| {
            let done = Command::new("/bin/sh").arg("-c").arg(command).status();
            assert!(done.is_ok_and(|status| status.success()), "{command}");
        };
        let until = |what: &str, done: &mut dyn FnMut() -> bool| {
            let began = Instant::now();
            while !done() {
                assert!(
                    began.elapsed() < Duration::from_secs(90),
                    "timed out waiting for {what}"
                );
                std::thread::sleep(Duration::from_millis(100));
            }
            eprintln!("tx14: {what} after {:?}", began.elapsed());
        };
        let run = std::process::id();
        let body = |seed: u64| {
            json!({"body_ref":format!("body:tx14:{run}:{seed}"),"seed":seed,"generator":{"id":"fbm-sphere","version":2},
                "landmass":{"sea_level":0.5,"continents":1.7,"relief":0.55,"coast":"smooth"},
                "climate":{"warmth":0.58,"moisture":0.6,"ice_caps":0.3},"sky":{"atmosphere":0.6,"clouds":0.35,"axial_tilt_deg":18}})
        };
        let (send, heard) = mpsc::channel();
        let send = Mutex::new(send);
        let sink: ChangeSink = Arc::new(move |change: &FieldChange| {
            let _ = lock(&send).send(change.clone());
        });
        let me = HeldClient::start(
            client_executable().into_os_string(),
            "tx14-me".into(),
            Timing::WINDOW,
            Some(sink),
        );
        // The client's own standing on the field: `status` is answered by the
        // client whatever its connection, with what it holds.
        let held = |client: &HeldClient| {
            client
                .call(&json!({"kind":"status"}))
                .map(|status| status["held"].clone())
                .unwrap_or(Value::Null)
        };
        until("my held field to stand", &mut || {
            held(&me)["state"] == "live"
        });
        let mine = format!("world:tx14:{run}:mine");
        me.call(&json!({"kind":"world-put","world_ref":mine,"body":body(1234),"linked":true}))
            .unwrap();
        me.call(&json!({"kind":"clearing-open","world_ref":mine,"part_ref":"page:tx14-reading","audience":"public",
            "shown":{"kind":"page","label":"A reading shown before the service went"}}))
        .unwrap();
        let observe = json!({"kind":"observe","observer_ref":"tx14:explore"});
        let clearings = |reading: &Value| -> Vec<String> {
            reading["snapshot"]["clearings"]
                .as_array()
                .into_iter()
                .flatten()
                .map(|c| {
                    format!(
                        "{}/{}",
                        c["world_ref"].as_str().unwrap_or(""),
                        c["part_ref"].as_str().unwrap_or("")
                    )
                })
                .collect()
        };
        let worlds = |reading: &Value| -> Vec<String> {
            reading["snapshot"]["worlds"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|w| w["world_ref"].as_str().map(str::to_owned))
                .collect()
        };
        let before = me.call(&observe).unwrap();
        let shown = format!("{mine}/page:tx14-reading");
        assert!(worlds(&before).contains(&mine) && clearings(&before).contains(&shown));
        // My own acts' news may still be on its way: let it settle first.
        while heard.recv_timeout(Duration::from_millis(500)).is_ok() {}

        // The service goes.
        shell(&stop);
        let mut lost = Value::Null;
        until("the client to know the service is lost", &mut || {
            lost = held(&me);
            lost["state"] != "live"
        });
        eprintln!("tx14: while lost the client stands {lost}");
        let kept = me.call(&observe).unwrap();
        assert_eq!(
            kept, before,
            "my world and what it shows stay as they are while the service is lost"
        );
        let refused = me.call(&json!({"kind":"clearing-open","world_ref":mine,"part_ref":"page:tx14-while-lost","audience":"public",
            "shown":{"kind":"page","label":"Shown while the service was lost"}}));
        let Err(CallError::Unavailable { detail }) = refused else {
            panic!("a showing while the service is lost is refused, not queued: {refused:?}")
        };
        eprintln!("tx14: a showing while lost is refused: {detail}");
        let why = detail.rsplit(':').next().unwrap_or("").trim();
        assert!(
            why.len() > 3 && !why.contains('`'),
            "the refusal reaches the person in words, saying why: {detail:?}"
        );
        let moved = heard.try_recv();
        assert!(
            moved.is_err(),
            "losing the service moves nothing in the window: {moved:?}"
        );

        // The service comes back on the same data; another identity shows a
        // page as soon as it can, before or after my client is back.
        shell(&start);
        let other = HeldClient::start(
            client_executable().into_os_string(),
            "tx14-other".into(),
            Timing::WINDOW,
            None,
        );
        until("the other identity's field to stand", &mut || {
            held(&other)["state"] == "live"
        });
        let theirs = format!("world:tx14:{run}:theirs");
        other
            .call(&json!({"kind":"world-put","world_ref":theirs,"body":body(98765),"linked":true}))
            .unwrap();
        other.call(&json!({"kind":"clearing-open","world_ref":theirs,"part_ref":"page:tx14-meanwhile","audience":"public",
            "shown":{"kind":"page","label":"Shown while you were away"}}))
        .unwrap();
        let mut news = Vec::new();
        until("the window to be told to read the field again", &mut || {
            while let Ok(change) = heard.try_recv() {
                news.push(change);
            }
            news.iter()
                .any(|change| change.changes.is_empty() && change.more == 0)
        });
        let after = me.call(&observe).unwrap();
        assert_ne!(
            after["cursor"], before["cursor"],
            "the field is read at a new cursor"
        );
        let meanwhile = format!("{theirs}/page:tx14-meanwhile");
        until("what was shown meanwhile to reach my window", &mut || {
            clearings(&me.call(&observe).unwrap()).contains(&meanwhile)
        });
        let after = me.call(&observe).unwrap();
        assert!(
            worlds(&after).contains(&mine),
            "my world is back up to date"
        );
        assert!(
            clearings(&after).contains(&shown),
            "what I had shown is shown again"
        );
        assert!(worlds(&after).contains(&theirs));
        assert!(
            !clearings(&after).contains(&format!("{mine}/page:tx14-while-lost")),
            "nothing reconnecting replays an act"
        );
        eprintln!(
            "tx14: {} news after the service returned ({} naming rows); read again at {}",
            news.len(),
            news.iter()
                .filter(|change| !change.changes.is_empty())
                .count(),
            after["cursor"]
        );
    }
}
