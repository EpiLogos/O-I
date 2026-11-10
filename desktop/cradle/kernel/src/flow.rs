//! Source read/write through Central's owner Actions — the CAS write core,
//! ported KEEP-RE-EARN from `desktop/core/src/{flow,world}.rs` into the
//! cradle kernel and re-pointed at Central's canonical source grammar
//! (U0.2, D12).
//!
//! Central owns source identity, revision, provenance and mutation. Every
//! source write goes through `projectcentral.source.write` with an
//! `expected_revision` compare-and-swap; the desktop never writes files
//! directly and never mints its own refs. A refusal is returned, never
//! retried around.
//!
//! The conflict heuristic is the ported one: **revisions are compared,
//! never conflict prose.** On a write error the kernel re-reads the source
//! and settles whether the failure was a revision move; the structured
//! `SourceWriteFailure` is built from the two observed revisions.
//!
//! Unavailable ≠ error: a `ctrl` executable that cannot be launched is an
//! honest `Unavailable` observation the caller degrades locally — never a
//! crash and never fabricated data.

use std::env;
use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

// ---------------------------------------------------------------------------
// The honest owner-Action adapter (ported pattern)
// ---------------------------------------------------------------------------

/// Why an owner Action call did not serve. Structured so the kernel can
/// tell an unavailable owner (honest absence, degraded locally) from an
/// owner that answered "no" (returned as it stands).
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum OwnerCallError {
    /// The owner executable could not be launched. Absence, not an error.
    Unavailable { detail: String },
    /// The owner answered, and the answer was no.
    Refused { message: String },
    /// The owner answered something the contract cannot parse.
    Malformed { detail: String },
}

impl OwnerCallError {
    pub fn detail(&self) -> String {
        match self {
            Self::Unavailable { detail } | Self::Malformed { detail } => detail.clone(),
            Self::Refused { message } => message.clone(),
        }
    }
}

impl std::fmt::Display for OwnerCallError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unavailable { detail } => {
                write!(formatter, "Central owner CLI unavailable: {detail}")
            }
            Self::Refused { message } => {
                write!(formatter, "Central owner Action refused: {message}")
            }
            Self::Malformed { detail } => write!(
                formatter,
                "Central owner Action returned an unparseable answer: {detail}"
            ),
        }
    }
}

impl std::error::Error for OwnerCallError {}

impl ReceivingRequest {
    /// The Central Action that serves the request (`CentralClient::receiving`).
    pub fn action(&self) -> &'static str {
        match self {
            Self::List { .. } => "central.receiving.list",
            Self::Read { .. } => "central.receiving.read",
            Self::Submit { .. } => "central.receiving.submit",
            Self::Document { .. } => "central.document.read",
            Self::Review { .. } => "central.receiving.review",
            Self::Include { .. } => "central.receiving.include",
            Self::Recover { .. } => "central.receiving.recover",
            Self::MutateField { .. } | Self::MutateMeta { .. } => "central.document.mutate",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum ReceivingRequest {
    List {
        #[serde(default)]
        after: Option<u64>,
        #[serde(default)]
        limit: Option<u64>,
        /// Only what still waits for the person; the page's `open_total`
        /// is then the owner's exact count.
        #[serde(default)]
        open: Option<bool>,
    },
    Read {
        return_ref: String,
    },
    /// An attributable external difference enters through Central's native
    /// proposal doorway. Central owns validation, authority and CAS arrival.
    ///
    /// Either a contribution (a document operation: `source_ref`,
    /// `document_id`, `expected_source_revision`, `proposal`) or a request the
    /// person decides (`request` with no document target). The optional
    /// fields are carried only when present; Central owns which shape is valid.
    Submit {
        producer_key: String,
        #[serde(default)]
        source_ref: Option<String>,
        #[serde(default)]
        document_id: Option<String>,
        #[serde(default)]
        expected_source_revision: Option<String>,
        occurred_at_unix_seconds: u64,
        #[serde(default)]
        task_ref: Option<String>,
        #[serde(default)]
        proposal: Option<Value>,
        #[serde(default)]
        request: Option<Value>,
        #[serde(default)]
        summary: Option<String>,
        #[serde(default)]
        evidence_refs: Option<Vec<String>>,
        #[serde(default)]
        declared_producer: Option<Value>,
        #[serde(default)]
        now_ref: Option<String>,
        #[serde(default)]
        reply_to: Option<String>,
    },
    /// The document's current native basis (the exact source revision the
    /// human would accept) — `central.document.read`.
    Document {
        source_ref: String,
        document_id: String,
    },
    Review {
        return_ref: String,
        expected_return_revision: String,
        disposition: String,
        /// Required for `accepted` contributions: the exact current source
        /// revision the human actually reviewed. Omitted otherwise.
        #[serde(default)]
        expected_source_revision: Option<String>,
        /// The person's words back to the producing NOW.
        #[serde(default)]
        note: Option<String>,
        /// A question's answer (`disposition: answered`).
        #[serde(default)]
        answer: Option<String>,
    },
    /// A contribution is included into its document at the reviewed basis; an
    /// accepted proposal is included with its proposed owner by recording
    /// that owner's realisation (e.g. the Factory Run its commission made).
    Include {
        return_ref: String,
        expected_return_revision: String,
        #[serde(default)]
        expected_source_revision: Option<String>,
        #[serde(default)]
        realisation_ref: Option<String>,
        #[serde(default)]
        realisation_owner_ref: Option<String>,
    },
    /// Resume an interrupted inclusion from its recorded native intent
    /// (`central.receiving.recover`); only the owner decides what may replay.
    Recover {
        return_ref: String,
        expected_return_revision: String,
    },
    /// One human authored-field edit (`central.document.mutate` `field.set`):
    /// the owner refuses non-human authors by its own law, CAS-checks
    /// `expected_revision`, and deduplicates on `request_id` — a replayed
    /// request returns its durable receipt, never a second application.
    MutateField {
        source_ref: String,
        document_id: String,
        expected_revision: String,
        request_id: String,
        field_id: String,
        value: Value,
    },
    /// One human edit of a page's own metadata (`central.document.mutate`
    /// `title.set` | `summary.set` | `lifecycle.set`): its title, its summary,
    /// or whether it stands open or closed. The owner refuses non-human
    /// authors, CAS-checks `expected_revision` and deduplicates on
    /// `request_id`, as for a field.
    MutateMeta {
        source_ref: String,
        document_id: String,
        expected_revision: String,
        request_id: String,
        key: MetaKey,
        value: String,
    },
}

/// A page's own metadata the owner takes from a person.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MetaKey {
    Title,
    Summary,
    Lifecycle,
}

impl MetaKey {
    /// The owner's own operation for this key.
    pub fn operation(self) -> &'static str {
        match self {
            MetaKey::Title => "title.set",
            MetaKey::Summary => "summary.set",
            MetaKey::Lifecycle => "lifecycle.set",
        }
    }
}

/// One NOW-relations reading (queue cell 1). `central.now.list` /
/// `central.now.read` are read-only; the payload is carried verbatim — the
/// owner owns identity, lifecycle and every relation ref.
#[derive(Clone, Debug, serde::Deserialize, Eq, PartialEq, serde::Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum NowRequest {
    List {
        #[serde(default)]
        participant_refs: Option<Vec<String>>,
    },
    Read {
        now_ref: String,
    },
}

/// The wall-clock bound on one Central Action. Central's slowest measured
/// readings take seconds (the World 0.8–2.8 s, a NOW thought listing 3 s; real
/// ground, 15 Oct); the bound is for an owner that never answers, not a pace.
const CENTRAL_ACTION_LIMIT: std::time::Duration = std::time::Duration::from_secs(120);

/// The way a request reached the kernel, as the native host alone knows it (O-I #747 round 895, DLW build ruling 2026-11-09, 0b.2 and
/// its addition; named for what it is in round 896, 0R-authority.4). No wire carries it: a request read from any wire (the ordinary
/// `kernel_op`, the frame's kernel-expression channel, the agents' socket, the walk bridge) stands as `Wire`, and only the host's own
/// press command makes it `PersonPress` (`crate::person_press`). That command is the shell window's own channel: the host takes it only
/// from a shell window (`main`, `surface-*`), and the shell's own code sends a person act by it. It is not proof that a person pressed:
/// the shell sends one person act with no press (`useFieldRecords`' `central.day.field.record`, pinned in the UI's
/// shell-window-channel-896 test, so a second cannot come unseen). The person's token follows it (`CentralClient::for_act`,
/// `for_person_act`), never `actor_kind`.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Channel {
    #[default]
    Wire,
    PersonPress,
}

/// Every process the kernel and the native host start begins here (O-I #747 round 896 1V, M1): without the person's token, whatever
/// the host's own environment holds, so no child inherits it. The rule alone hands it on, after this: a Central call made for the
/// person's press (`run_envelope_owner`, from `for_person`) and Factory's one act that takes it (factory.rs `owner_call_env`, from
/// the `env` the press gave). The kernel's tests pin that every spawn goes through here (`no_child_inherits_the_person_s_token`).
pub fn child(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut command = Command::new(program);
    command.env_remove("CENTRAL_NATIVE_TOKEN");
    command
}

/// The launch token, once the native host has taken it into the kernel's keeping (`hold_launch_token`): what it was handed at start,
/// by a descriptor or its environment, or nothing.
static LAUNCH_TOKEN: std::sync::OnceLock<Option<String>> = std::sync::OnceLock::new();

/// The variable that names, to a native host started by one that holds the launch token, the descriptor it reads the token from: a
/// number, never the token (O-I #747 round 896 1T.2). The host's own start again sets it (`start_again_without_its_token`), and so
/// does its start after a change of World (`start_host_again`).
pub const LAUNCH_TOKEN_DESCRIPTOR: &str = "OI_CRADLE_LAUNCH_TOKEN_FD";

/// The native host takes the token it was launched with into the kernel's keeping, and out of the environment its children inherit
/// (O-I #747 round 896 1T item 19, 1T.0 item 11, DLW build ruling 2026-11-09). The host calls this in `main`, before any plugin, thread
/// or child exists, so no process it starts inherits the token by its environment: not the opener plugin's `/usr/bin/open` and
/// `xdg-open`, not the webview's own helper processes on Windows and Linux. The rule still hands it on (`for_person`, through
/// `launch_token`). Once: a second call keeps the first hold.
///
/// Handed over by a descriptor (`LAUNCH_TOKEN_DESCRIPTOR`: the host started again, `start_again_without_its_token`, or after a change
/// of World, `start_host_again`), it is read from there, the descriptor closed and its variable gone; that start's initial environment
/// never held it, so `ps eww` by the same user shows no token (1T.2; review 956a finding 3). Else it is the environment's: a host that
/// could not start again (no exec, or Windows) still has it in its initial environment, the block the process was started with, which
/// removing a variable does not clear. And the limit, plainly: a process of the same user can read the host's memory and its files. The
/// token separates the person's own press from the shell's other sends; it is no boundary against code the same user runs.
pub fn hold_launch_token() {
    let handed = handed_token();
    let token = env::var("CENTRAL_NATIVE_TOKEN").ok();
    env::remove_var("CENTRAL_NATIVE_TOKEN");
    let _ = LAUNCH_TOKEN.set(handed.or(token));
}

/// The launch token: the one held, where the host took it into the kernel's keeping; else, in a process that holds none (the kernel's
/// other hosts), its environment's.
fn launch_token() -> Option<String> {
    match LAUNCH_TOKEN.get() {
        Some(held) => held.clone(),
        None => env::var("CENTRAL_NATIVE_TOKEN").ok(),
    }
}

/// The token a native host was handed by a descriptor (`LAUNCH_TOKEN_DESCRIPTOR`, 1T.2), read to its end and the descriptor closed,
/// the variable gone. Only an open pipe above the standard three is taken: a number that names anything else is left as it is.
fn handed_token() -> Option<String> {
    let named = env::var_os(LAUNCH_TOKEN_DESCRIPTOR)?;
    env::remove_var(LAUNCH_TOKEN_DESCRIPTOR);
    #[cfg(unix)]
    {
        use std::io::Read;
        use std::os::fd::FromRawFd;
        let fd: libc::c_int = named.to_str()?.parse().ok().filter(|fd| *fd > 2)?;
        // SAFETY: fstat only writes the zeroed record it is given; a descriptor that is not open answers -1.
        let mut stat: libc::stat = unsafe { std::mem::zeroed() };
        if unsafe { libc::fstat(fd, &mut stat) } != 0
            || (stat.st_mode & libc::S_IFMT) != libc::S_IFIFO
        {
            return None;
        }
        // SAFETY: an open pipe, handed to this process for this one read: owned, read and closed here, once (the variable is gone).
        let mut pipe = unsafe { std::fs::File::from_raw_fd(fd) };
        let mut token = String::new();
        pipe.read_to_string(&mut token).ok()?;
        Some(token).filter(|token| !token.trim().is_empty())
    }
    #[cfg(not(unix))]
    {
        let _ = named;
        None
    }
}

/// The native host starts again without the launch token in its initial environment (O-I #747 round 896 1T.2; 1T.0 item 11, review
/// 956a finding 3): `ps eww` shows a process's initial environment to the same user, and removing a variable does not clear it. A host
/// launched with `CENTRAL_NATIVE_TOKEN` writes the token into a pipe and replaces itself by exec, its own executable and arguments, the
/// same process: the variable gone (`child`), the pipe's read end inherited and named by `LAUNCH_TOKEN_DESCRIPTOR`, which
/// `hold_launch_token` reads. The first thing the host's `main` does, before any thread or child exists. With no token in the
/// environment, or a start that was handed it by a pipe already, nothing happens (Ok). It returns an error only where the exec did not
/// happen, saying why: the host then goes on as before, the token still in its initial environment and held from there.
#[cfg(unix)]
pub fn start_again_without_its_token() -> Result<(), String> {
    use std::io::Write;
    use std::os::fd::AsRawFd;
    use std::os::unix::process::CommandExt;
    let token = env::var("CENTRAL_NATIVE_TOKEN").unwrap_or_default();
    // Started again already (the pipe named): never again, so that an exec which kept the token could not start again for good.
    if token.trim().is_empty() || env::var_os(LAUNCH_TOKEN_DESCRIPTOR).is_some() {
        return Ok(());
    }
    let executable =
        env::current_exe().map_err(|error| format!("its own executable is not known: {error}"))?;
    let (reader, mut writer) = std::io::pipe().map_err(|error| format!("no pipe: {error}"))?;
    writer
        .write_all(token.as_bytes())
        .map_err(|error| format!("the pipe took no token: {error}"))?;
    drop(writer);
    // The pipe is made close-on-exec: its read end alone is let through the exec, before any thread exists that could start a child.
    // SAFETY: F_SETFD on a descriptor this process owns.
    if unsafe { libc::fcntl(reader.as_raw_fd(), libc::F_SETFD, 0) } != 0 {
        return Err(format!(
            "the pipe cannot be inherited: {}",
            std::io::Error::last_os_error()
        ));
    }
    let error = child(executable)
        .args(env::args_os().skip(1))
        .env(LAUNCH_TOKEN_DESCRIPTOR, reader.as_raw_fd().to_string())
        .exec();
    Err(format!("the host could not start again: {error}"))
}

/// The native host starts itself again after a change of World (native_shell.rs `relaunch`; 1T.2): its own executable, never another
/// program, by the environment it is given, its input none. The launch token it holds goes as its own start again hands it, by a pipe
/// the new host alone inherits, named by `LAUNCH_TOKEN_DESCRIPTOR`, and never by the environment: a token in the one given is taken
/// out. Holding none, it hands none, and the new host reads the token file as this one did. On Windows, where there is no descriptor
/// to hand, the environment given goes as it is (the launch's own, token and all).
pub fn start_host_again(
    environment: impl IntoIterator<Item = (std::ffi::OsString, std::ffi::OsString)>,
) -> std::io::Result<std::process::Child> {
    let mut command = child(env::current_exe()?);
    command
        .env_clear()
        .envs(environment)
        .stdin(std::process::Stdio::null());
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::fd::AsRawFd;
        use std::os::unix::process::CommandExt;
        command
            .env_remove("CENTRAL_NATIVE_TOKEN")
            .env_remove(LAUNCH_TOKEN_DESCRIPTOR);
        let Some(token) = LAUNCH_TOKEN.get().cloned().flatten() else {
            return command.spawn();
        };
        let (reader, mut writer) = std::io::pipe()?;
        writer.write_all(token.as_bytes())?;
        drop(writer);
        let fd = reader.as_raw_fd();
        command.env(LAUNCH_TOKEN_DESCRIPTOR, fd.to_string());
        // The pipe is made close-on-exec, so no other child of this process inherits it; the new host's alone is let through.
        // SAFETY: between fork and exec only F_SETFD, which is async-signal-safe, on the pipe's read end.
        unsafe {
            command.pre_exec(move || {
                if libc::fcntl(fd, libc::F_SETFD, 0) == 0 {
                    Ok(())
                } else {
                    Err(std::io::Error::last_os_error())
                }
            });
        }
        let started = command.spawn();
        drop(reader);
        started
    }
    #[cfg(not(unix))]
    {
        command.spawn()
    }
}

/// The token the native host holds for Central's native actions: the launch token it holds (`hold_launch_token`), else
/// `~/.central/native-token` (owner-rotatable). Read in the native process, never supplied by the desk, and private to the rule:
/// `CentralClient::for_person` is its one caller, for what came by the shell window's channel (O-I #747 round 896 item 4). Here since
/// 1V, L1, so that the compiler, not only the token scan, holds that no other module reads it, by an alias, a function pointer or its
/// inner read.
fn host_native_token() -> Option<crate::factory::AuthorityToken> {
    host_native_token_from(launch_token(), env::var_os("HOME").map(PathBuf::from))
}

fn host_native_token_from(
    environment: Option<String>,
    home: Option<PathBuf>,
) -> Option<crate::factory::AuthorityToken> {
    let token = environment
        .filter(|token| !token.trim().is_empty())
        .or_else(|| std::fs::read_to_string(home?.join(".central/native-token")).ok())?;
    crate::factory::AuthorityToken::held(&token)
}

/// The kernel's words for a person act that came by a wire: it was not run, and no token went.
pub(crate) fn person_act_by_press(action: &str) -> String {
    format!(
        "{action} is the person's own act, and runs on their token only by their own press in the O:I desktop app: this request came another way, so nothing was run and no token went with it."
    )
}

/// Client for the Central owner Actions the kernel reads and writes
/// through `oi central`. OI_BIN selects the suite executable; the suite resolves
/// OI_CENTRAL_CTRL_BIN or the registered owner. Root/project context is preserved.
#[derive(Clone, Debug)]
pub struct CentralClient {
    executable: PathBuf,
    central_root: Option<PathBuf>,
    project_query: String,
    suite_route: bool,
    central_executable: Option<PathBuf>,
    /// The host's native action token, carried only by a client made for one of the person's acts (`for_person`): Central's
    /// authenticated actions read it from their environment. It is never set on the kernel's own client, but the acts that get it
    /// are chosen by the Action's name (action.rs PERSON_ACTS), not by who pressed: whatever invokes one of them by name acts with
    /// the person's authority. Some already answer with the person's private content: `central.document.mutate` returns the Day
    /// it changed. What `central.day.entry.part` adds is the salted part ref, the opaque name of one entry, and that ref is what
    /// reaches the shared field when the person shows the entry; so whatever names `entry.part` mints that ref as the person.
    /// Carrying the token on the shell's human-press channel instead is ruled work of its own (DLW build ruling 2026-11-09). Its
    /// Debug output is redacted.
    person: Option<crate::factory::AuthorityToken>,
}

impl CentralClient {
    /// Discover the client from the cradle's environment. The default
    /// project query is the O-I ground the cradle opens over (`project:o-i`
    /// is Central's id; the owner Actions accept `o-i`).
    pub fn discover() -> Self {
        Self::discover_in(|name| env::var_os(name))
    }

    /// [`discover`](Self::discover) over the given environment. A host that names its Central owner (`OI_CENTRAL_CTRL_BIN`, a
    /// file) is asked directly: the suite's `oi central` only resolves that same executable and `exec`s into it with the same
    /// arguments, so going through it costs a second process start (the `oi` binary, its composition read) on every read for the
    /// same answer — the way the AIKit calls already go (`OI_AIKIT_BIN`). Without one, the suite route stands: resolution never
    /// guesses a binary the host did not name.
    fn discover_in(var: impl Fn(&str) -> Option<std::ffi::OsString>) -> Self {
        let central_root = var("OI_CENTRAL_ROOT").map(PathBuf::from);
        let project_query = var("OI_CENTRAL_PROJECT_QUERY")
            .and_then(|query| query.into_string().ok())
            .unwrap_or_else(|| "o-i".to_owned());
        if let Some(owner) = var("OI_CENTRAL_CTRL_BIN")
            .map(PathBuf::from)
            .filter(|path| path.is_file())
        {
            return Self::with(owner, central_root, project_query);
        }
        let executable = var("OI_BIN")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("oi"));
        let mut client = Self::with(executable, central_root, project_query);
        client.suite_route = true;
        client
    }

    /// Explicit owner-level configuration for embedding and native parity tests.
    pub fn with(executable: PathBuf, central_root: Option<PathBuf>, project_query: String) -> Self {
        Self {
            executable,
            central_root,
            project_query,
            suite_route: false,
            central_executable: None,
            person: None,
        }
    }

    /// The same client, carrying the host's native action token: the token the native host holds (`CENTRAL_NATIVE_TOKEN`, else
    /// `~/.central/native-token`), read here in the native process and never supplied by the desk. Without one, the owner refuses the
    /// act in its own words. Private to the rule (O-I #747 round 896, 0R-authority.1): only `by_channel`, `for_act`, `for_person_act`
    /// and `factory_person` (round 896 item 4, through `for_person_act`) attach it, each by the channel the request came by, and the
    /// kernel's tests pin that no other code names it.
    fn for_person(&self) -> Self {
        // Under test the host's token is never read: a test that needs the person's authority gives its own (with_person_token).
        let person = if cfg!(test) {
            self.person.clone()
        } else {
            host_native_token()
        };
        Self {
            person,
            ..self.clone()
        }
    }

    /// The same client carrying no one's token, whatever it was made with: the run of an Action that is not the person's own press
    /// (O-I #747 round 895, DLW build ruling 2026-11-09, 0b.2: the token follows the press channel, never a client that happens to hold it).
    pub(crate) fn without_person(&self) -> Self {
        Self {
            person: None,
            ..self.clone()
        }
    }

    /// The one rule the person's token follows (0b.2): it goes with what came by the person's own press, and with nothing that came
    /// by a wire.
    pub(crate) fn by_channel(&self, channel: Channel) -> Self {
        match channel {
            Channel::PersonPress => self.for_person(),
            Channel::Wire => self.without_person(),
        }
    }

    /// The client an Action runs on, by that rule, for every person act (`action::PERSON_ACTS`; the addition to 0b.2, which
    /// owner_write.rs's `invoke_action` and expression.rs's Invoke and Trigger keep alike): a person act that came by the person's
    /// press runs on their token, and one that came by a wire is refused in words, so its owner is never asked. Any other Action runs
    /// on no one's token, however it came.
    pub(crate) fn for_act(&self, action: &str, channel: Channel) -> Result<Self, String> {
        if !crate::action::person_act(action) {
            return Ok(self.without_person());
        }
        self.for_person_act(action, channel)
    }

    /// The client one of the person's own acts runs on, by the same rule, where the act is not an Action but an op of the kernel's
    /// (O-I #747 round 896, 0R-authority.1, item 0.2): Receiving's acts on a document (owner_write.rs `receiving_person_act`), a Day
    /// ensured, made or closed (`central_write`), and a page's Launch, Stop and Delete. By the shell window's channel it runs on the
    /// person's token; by a wire it is refused in words before its owner is asked, so no token goes. `act` names it in those words.
    pub(crate) fn for_person_act(&self, act: &str, channel: Channel) -> Result<Self, String> {
        match channel {
            Channel::PersonPress => Ok(self.for_person()),
            Channel::Wire => Err(person_act_by_press(act)),
        }
    }

    /// The person's token for one of Factory's acts that presents their authority (`factory::OwnerRequest::person_act`, O-I #747
    /// round 896 item 4), by the same rule: by the shell window's channel the host's token, which Factory hands to its owner and
    /// checks against the human grant; by a wire the act is refused in words before Factory is asked, so no token goes. Factory
    /// never reads the host's token itself: this is the one door it is given it by.
    pub(crate) fn factory_person(
        &self,
        act: &str,
        channel: Channel,
    ) -> Result<Option<crate::factory::AuthorityToken>, String> {
        self.for_person_act(act, channel)
            .map(|client| client.person)
    }

    /// A client carrying the given token (tests stand in for the host's).
    #[cfg(test)]
    pub(crate) fn with_person_token(&self, token: &str) -> Self {
        let mut client = self.clone();
        client.person = crate::factory::AuthorityToken::for_test(token);
        client
    }

    /// Explicit suite-level configuration for parity tests and embedded
    /// hosts. The executable is the exact O:I command; its `central` route
    /// forwards to the registered Central owner.
    pub fn with_suite(
        executable: PathBuf,
        central_root: Option<PathBuf>,
        project_query: String,
    ) -> Self {
        let mut client = Self::with(executable, central_root, project_query);
        client.suite_route = true;
        client
    }

    /// Explicit suite-level configuration with a pinned Central owner. This
    /// keeps consumer tests and embedded hosts off PATH and does not replace
    /// any installed or running bridge executable.
    pub fn with_suite_owner(
        executable: PathBuf,
        central_executable: PathBuf,
        central_root: Option<PathBuf>,
        project_query: String,
    ) -> Self {
        let mut client = Self::with_suite(executable, central_root, project_query);
        client.central_executable = Some(central_executable);
        client
    }

    /// The project query this host configured — the co-reference fallback
    /// when a caller holds no project of its own.
    /// Resource identity includes the native owner route and configured World;
    /// renderer transport URLs and presentation refs cannot choose this epoch.
    pub(crate) fn retained_resource_epoch(&self) -> String {
        use sha2::{Digest, Sha256};
        format!(
            "central-owner:{:x}",
            Sha256::digest(self.owner_identity().as_bytes())
        )
    }

    /// Which owner this client asks: the route, the executables and the root.
    pub(crate) fn owner_identity(&self) -> String {
        format!(
            "{:?}|{:?}|{:?}|{}",
            self.executable, self.central_executable, self.central_root, self.suite_route
        )
    }

    pub fn configured_project(&self) -> &str {
        &self.project_query
    }

    /// The host's explicit owner root, without launching a World disclosure.
    /// Pure capability schemas may use this context; owner data and mutations
    /// retain their existing native World qualification.
    pub(crate) fn configured_root(&self) -> Option<&std::path::Path> {
        self.central_root.as_deref()
    }

    /// Run one owner Action, ported envelope law: `--json` global flag,
    /// optional `--root`, `action run <action> <input-json>`; `ok` must be
    /// true; the `data` payload is returned. Spawn failures are
    /// `Unavailable`; `ok:false` is `Refused` with the owner's message.
    /// Preserve native failure status/code for Central-facing readers. Existing
    /// callers still use `run`, which returns the same refusal as before.
    ///
    /// A reading goes through the read model (read_cache.rs): a retained
    /// answer whose sources did not change is returned without a process,
    /// and identical asks in flight share one. Any action that is not a
    /// reading moves every retained reading once it has run. The person's
    /// own press never reads from or into the model.
    pub fn run_envelope(&self, action: &str, input: Value) -> Result<Value, OwnerCallError> {
        let input = self.with_project(input);
        if self.person.is_some() {
            let answer = self.run_envelope_owner(action, input);
            if !self.reads(action) {
                crate::read_cache::written();
            }
            return answer;
        }
        let model = crate::read_cache::ReadModel::global();
        match crate::read_cache::central_dep(model.watch(), &self.owner_identity(), action, &input)
        {
            Some((key, dep)) => model.read_if(
                &key,
                &dep,
                |envelope: &Value| envelope["ok"] == true,
                || self.run_envelope_owner(action, input),
            ),
            None => {
                let answer = self.run_envelope_owner(action, input);
                if !self.reads(action) {
                    crate::read_cache::written();
                }
                answer
            }
        }
    }

    fn with_project(&self, mut input: Value) -> Value {
        if let Some(object) = input.as_object_mut() {
            // An absent project takes the configured co-reference; an explicit
            // null names the Central root register and is carried as absence,
            // never back-filled into a project the caller did not choose.
            match object.get("project") {
                Some(Value::Null) => {
                    object.remove("project");
                }
                None => {
                    object.insert(
                        "project".to_owned(),
                        Value::String(self.project_query.clone()),
                    );
                }
                Some(_) => {}
            }
        }
        input
    }

    /// Central's own Action catalogue (`action.list`: every id with its `mutation_class`), asked without the person's
    /// authority and outside the read model: action.rs `CentralClient::reads` keeps it.
    pub(crate) fn action_list(&self) -> Result<Value, OwnerCallError> {
        Self {
            person: None,
            ..self.clone()
        }
        .run_envelope_owner("action.list", serde_json::json!({}))
    }

    fn run_envelope_owner(&self, action: &str, input: Value) -> Result<Value, OwnerCallError> {
        let mut command = child(&self.executable);
        if self.suite_route {
            command.arg("central");
            if let Some(owner) = &self.central_executable {
                command.env("OI_CENTRAL_CTRL_BIN", owner);
            }
        }
        // Only the person's own press carries the person's authority: any other call goes without it, even when the host's
        // environment holds it (as every child does: `child`).
        match &self.person {
            Some(token) => command.env("CENTRAL_NATIVE_TOKEN", token.as_str()),
            None => command.env_remove("CENTRAL_NATIVE_TOKEN"),
        };
        command.arg("--json");
        if let Some(root) = &self.central_root {
            command.arg("--root").arg(root);
        }
        let encoded = serde_json::to_vec(&input).map_err(|error| OwnerCallError::Malformed {
            detail: format!("encode {action} input: {error}"),
        })?;
        if encoded.len() > 16 * 1024 * 1024 {
            return Err(OwnerCallError::Malformed {
                detail: "Central action input exceeds 16 MiB".into(),
            });
        }
        command.args(["action", "run", action]);
        // Original forms and large native edits exceed OS argv limits. The
        // explicit native stdin transport retains the same owner validation.
        let input = if encoded.len() > 64 * 1024 {
            command.arg("-");
            Some(encoded)
        } else {
            command.arg(String::from_utf8(encoded).expect("JSON is UTF-8"));
            None
        };
        // Every Action is bounded (owner_process.rs): a Central that never
        // answers is stopped at the limit and named, never waited on forever.
        let output = crate::owner_process::output(
            &mut command,
            input,
            crate::owner_process::Bound {
                owner: "Central",
                operation: action,
                limit: CENTRAL_ACTION_LIMIT,
                effect: crate::owner_process::Effect::Unclassified,
            },
        )
        .map_err(|detail| OwnerCallError::Unavailable {
            detail: format!("{detail} ({})", self.executable.display()),
        })?;
        let stdout =
            String::from_utf8(output.stdout).map_err(|error| OwnerCallError::Malformed {
                detail: format!("{action} returned non-UTF8 output: {error}"),
            })?;
        let value: Value =
            serde_json::from_str(stdout.trim()).map_err(|error| OwnerCallError::Malformed {
                detail: format!("{action} returned invalid structured output: {error}"),
            })?;
        if !value.is_object() || value.get("ok").and_then(Value::as_bool).is_none() {
            return Err(OwnerCallError::Malformed {
                detail: format!("{action} returned no native ActionResult"),
            });
        }
        if !output.status.success() && value["ok"] == true {
            return Err(OwnerCallError::Malformed {
                detail: format!(
                    "{action} returned success JSON with process status {}",
                    output.status
                ),
            });
        }
        Ok(value)
    }

    pub fn run(&self, action: &str, input: Value) -> Result<Value, OwnerCallError> {
        let value = self.run_envelope(action, input)?;
        if value["ok"] != true {
            return Err(OwnerCallError::Refused {
                message: value
                    .pointer("/error/message")
                    .and_then(Value::as_str)
                    .or_else(|| value.get("message").and_then(Value::as_str))
                    .unwrap_or("Central owner Action failed")
                    .to_owned(),
            });
        }
        value
            .get("data")
            .cloned()
            .ok_or_else(|| OwnerCallError::Malformed {
                detail: format!("{action} returned success without native data"),
            })
    }

    /// The Central owner executable itself, when the host names one
    /// (`OI_CENTRAL_CTRL_BIN`): the same envelope law through one process
    /// per Action instead of two (the suite wrapper's only work is
    /// resolving and re-spawning the owner, which dominates the cost of
    /// cheap read Actions). Absent the override this returns `None` and
    /// the configured suite route stands — resolution never guesses a
    /// binary the host did not name.
    pub fn owner_direct_from_env(&self) -> Option<CentralClient> {
        let owner = std::env::var_os("OI_CENTRAL_CTRL_BIN")
            .map(PathBuf::from)
            .filter(|path| path.is_file())?;
        Some(Self::with(
            owner,
            self.central_root.clone(),
            self.project_query.clone(),
        ))
    }

    // -----------------------------------------------------------------------
    // Continuous-work receiving (Wave 6E) — the owner's own revision checks
    // -----------------------------------------------------------------------

    /// List/read pending Returns, read a native document's current basis, or
    /// perform one human review/include. Every input is owner-validated; the
    /// response payload is carried verbatim. `None` project omits the input
    /// entirely — Central resolves the ROOT register's receiving field.
    pub fn receiving(
        &self,
        project: Option<&str>,
        request: &ReceivingRequest,
    ) -> Result<Value, OwnerCallError> {
        let mut input = serde_json::Map::new();
        // None names the ROOT register: an explicit null is the run-level
        // convention that carries as absence — omitting the key would let
        // the configured project co-reference back-fill and silently query
        // the wrong register's field.
        input.insert(
            "project".to_owned(),
            project.map(|p| json!(p)).unwrap_or(Value::Null),
        );
        let action: &str = match request {
            ReceivingRequest::List { after, limit, open } => {
                if let Some(after) = after {
                    input.insert("after".to_owned(), json!(after));
                }
                if let Some(limit) = limit {
                    input.insert("limit".to_owned(), json!(limit));
                }
                if let Some(open) = open {
                    input.insert("open".to_owned(), json!(open));
                }
                "central.receiving.list"
            }
            ReceivingRequest::Read { return_ref } => {
                input.insert("return_ref".to_owned(), json!(return_ref));
                "central.receiving.read"
            }
            ReceivingRequest::Submit {
                producer_key,
                source_ref,
                document_id,
                expected_source_revision,
                occurred_at_unix_seconds,
                task_ref,
                proposal,
                request,
                summary,
                evidence_refs,
                declared_producer,
                now_ref,
                reply_to,
            } => {
                input.insert("producer_key".to_owned(), json!(producer_key));
                input.insert(
                    "occurred_at_unix_seconds".to_owned(),
                    json!(occurred_at_unix_seconds),
                );
                for (key, value) in [
                    ("source_ref", source_ref.as_ref().map(|v| json!(v))),
                    ("document_id", document_id.as_ref().map(|v| json!(v))),
                    (
                        "expected_source_revision",
                        expected_source_revision.as_ref().map(|v| json!(v)),
                    ),
                    ("task_ref", task_ref.as_ref().map(|v| json!(v))),
                    ("proposal", proposal.clone()),
                    ("request", request.clone()),
                    ("summary", summary.as_ref().map(|v| json!(v))),
                    ("evidence_refs", evidence_refs.as_ref().map(|v| json!(v))),
                    ("declared_producer", declared_producer.clone()),
                    ("now_ref", now_ref.as_ref().map(|v| json!(v))),
                    ("reply_to", reply_to.as_ref().map(|v| json!(v))),
                ] {
                    if let Some(value) = value {
                        input.insert(key.to_owned(), value);
                    }
                }
                "central.receiving.submit"
            }
            ReceivingRequest::Document {
                source_ref,
                document_id,
            } => {
                input.insert("source_ref".to_owned(), json!(source_ref));
                input.insert("document_id".to_owned(), json!(document_id));
                "central.document.read"
            }
            ReceivingRequest::Review {
                return_ref,
                expected_return_revision,
                disposition,
                expected_source_revision,
                note,
                answer,
            } => {
                input.insert("return_ref".to_owned(), json!(return_ref));
                input.insert(
                    "expected_return_revision".to_owned(),
                    json!(expected_return_revision),
                );
                input.insert("disposition".to_owned(), json!(disposition));
                // An accepted contribution requires the exact reviewed source
                // revision; every other decision carries no source basis.
                for (key, value) in [
                    ("expected_source_revision", expected_source_revision),
                    ("note", note),
                    ("answer", answer),
                ] {
                    if let Some(value) = value {
                        input.insert(key.to_owned(), json!(value));
                    }
                }
                "central.receiving.review"
            }
            ReceivingRequest::Include {
                return_ref,
                expected_return_revision,
                expected_source_revision,
                realisation_ref,
                realisation_owner_ref,
            } => {
                input.insert("return_ref".to_owned(), json!(return_ref));
                input.insert(
                    "expected_return_revision".to_owned(),
                    json!(expected_return_revision),
                );
                for (key, value) in [
                    ("expected_source_revision", expected_source_revision),
                    ("realisation_ref", realisation_ref),
                    ("realisation_owner_ref", realisation_owner_ref),
                ] {
                    if let Some(value) = value {
                        input.insert(key.to_owned(), json!(value));
                    }
                }
                "central.receiving.include"
            }
            ReceivingRequest::Recover {
                return_ref,
                expected_return_revision,
            } => {
                input.insert("return_ref".to_owned(), json!(return_ref));
                input.insert(
                    "expected_return_revision".to_owned(),
                    json!(expected_return_revision),
                );
                "central.receiving.recover"
            }
            ReceivingRequest::MutateField {
                source_ref,
                document_id,
                expected_revision,
                request_id,
                field_id,
                value,
            } => {
                input.insert("source_ref".to_owned(), json!(source_ref));
                input.insert("document_id".to_owned(), json!(document_id));
                input.insert("expected_revision".to_owned(), json!(expected_revision));
                input.insert("request_id".to_owned(), json!(request_id));
                input.insert("operation".to_owned(), json!("field.set"));
                input.insert("field_id".to_owned(), json!(field_id));
                input.insert("value".to_owned(), value.clone());
                "central.document.mutate"
            }
            ReceivingRequest::MutateMeta {
                source_ref,
                document_id,
                expected_revision,
                request_id,
                key,
                value,
            } => {
                input.insert("source_ref".to_owned(), json!(source_ref));
                input.insert("document_id".to_owned(), json!(document_id));
                input.insert("expected_revision".to_owned(), json!(expected_revision));
                input.insert("request_id".to_owned(), json!(request_id));
                input.insert("operation".to_owned(), json!(key.operation()));
                input.insert("value".to_owned(), json!(value));
                "central.document.mutate"
            }
        };
        self.run(action, Value::Object(input))
    }

    // -----------------------------------------------------------------------
    // NOW relations (queue cell 1) — read-only identity/lifecycle/relations
    // -----------------------------------------------------------------------

    /// List allocated NOWs (optionally by participant) or read one exact NOW.
    /// `None` project names the ROOT register with an explicit null — the same
    /// run-level convention as `receiving`: omitting the key would let the
    /// configured project co-reference silently query the wrong register.
    pub fn now(
        &self,
        project: Option<&str>,
        request: &NowRequest,
    ) -> Result<Value, OwnerCallError> {
        let mut input = serde_json::Map::new();
        input.insert(
            "project".to_owned(),
            project.map(|p| json!(p)).unwrap_or(Value::Null),
        );
        let action: &str = match request {
            NowRequest::List { participant_refs } => {
                if let Some(refs) = participant_refs {
                    input.insert("participant_refs".to_owned(), json!(refs));
                }
                "central.now.list"
            }
            NowRequest::Read { now_ref } => {
                input.insert("now_ref".to_owned(), json!(now_ref));
                "central.now.read"
            }
        };
        self.run(action, Value::Object(input))
    }

    // -----------------------------------------------------------------------
    // Source read / write — Central's canonical grammar (U0.2, D12)
    // -----------------------------------------------------------------------

    /// Read one source through `projectcentral.source.read`. The source
    /// ref arrives in Central's canonical grammar
    /// (`central:source:project:{project_id}:{escaped-path}`) and is
    /// passed through verbatim; Central owns the retrieval gate and its
    /// refusal is returned as it stands.
    pub fn source_read(
        &self,
        project: Option<&str>,
        source_ref: &str,
    ) -> Result<SourceReading, OwnerCallError> {
        let data = self.run(
            "projectcentral.source.read",
            json!({ "project": project, "source_ref": source_ref }),
        )?;
        let reading: SourceReading =
            serde_json::from_value(data).map_err(|error| OwnerCallError::Malformed {
                detail: format!("decode Central source reading: {error}"),
            })?;
        if reading.source.source_ref != source_ref
            || (project.is_none() && reading.world_ref != "control:root")
        {
            return Err(OwnerCallError::Malformed {
                detail: "Central redirected the requested source/scope".into(),
            });
        }
        if reading.schema != SOURCE_READING_SCHEMA {
            return Err(OwnerCallError::Malformed {
                detail: format!(
                    "unsupported Central source reading schema `{}`",
                    reading.schema
                ),
            });
        }
        if reading.automatic_agent_or_model_invocation {
            return Err(OwnerCallError::Malformed {
                detail: "Central source read violated zero-background-Agent law".to_owned(),
            });
        }
        Ok(reading)
    }

    /// Write one source through `projectcentral.source.write`: Central's
    /// compare-and-swap, Central's attribution, Central's refusal
    /// semantics. The desktop adds no bypass. The receipt is unwrapped from
    /// the `data.receipt` envelope the owner serves (a flat receipt still
    /// decodes) — the ported behaviour.
    pub fn source_write(
        &self,
        project: Option<&str>,
        source_ref: &str,
        expected_revision: &str,
        content: &str,
        actor: &str,
        actor_kind: &str,
    ) -> Result<SourceWriteReceipt, OwnerCallError> {
        let data = self.run(
            "projectcentral.source.write",
            json!({
                "project": project,
                "source_ref": source_ref,
                "expected_revision": expected_revision,
                "content": content,
                "actor": actor,
                "actor_kind": actor_kind,
            }),
        )?;
        let receipt: SourceWriteReceipt =
            serde_json::from_value(data.get("receipt").cloned().unwrap_or_else(|| data.clone()))
                .map_err(|error| OwnerCallError::Malformed {
                    detail: format!("decode Central source write receipt: {error}"),
                })?;
        if receipt.schema != SOURCE_WRITE_RECEIPT_SCHEMA {
            return Err(OwnerCallError::Malformed {
                detail: format!(
                    "unsupported Central source write receipt schema `{}`",
                    receipt.schema
                ),
            });
        }
        if receipt.automatic_agent_or_model_invocation {
            return Err(OwnerCallError::Malformed {
                detail: "Central source write violated zero-background-Agent law".to_owned(),
            });
        }
        Ok(receipt)
    }

    /// Re-read one source to settle what the owner holds now. Same ported
    /// heuristic as every save path: revisions are compared, never conflict
    /// prose.
    pub fn current_reading(
        &self,
        project: Option<&str>,
        source_ref: &str,
    ) -> Result<SourceReading, OwnerCallError> {
        self.source_read(project, source_ref)
    }

    // -----------------------------------------------------------------------
    // Retained Flow and explicit source-return owner Actions
    // -----------------------------------------------------------------------

    #[allow(clippy::too_many_arguments)]
    pub fn source_return(
        &self,
        project: &str,
        source_ref: &str,
        expected_revision: &str,
        proposed_content: &str,
        reason: &str,
        evidence_refs: &[String],
        agent_session_ref: &str,
    ) -> Result<SourceReturnReading, OwnerCallError> {
        let data = self.run(
            "projectcentral.source.return",
            json!({
                "project": project,
                "source_ref": source_ref,
                "expected_revision": expected_revision,
                "proposed_content": proposed_content,
                "reason": reason,
                "evidence_refs": evidence_refs,
                "agent_session_ref": agent_session_ref,
            }),
        )?;
        let result: SourceReturnReading = decode_owner("projectcentral.source.return", data)?;
        ensure_schema(
            "projectcentral.source.return",
            &result.schema,
            FLOW_RETURN_READING_SCHEMA,
        )?;
        ensure_schema(
            "projectcentral.source.return",
            &result.proposal.schema,
            FLOW_RETURN_SCHEMA,
        )?;
        Ok(result)
    }

    /// List returned-work proposals through Central's source-return owner.
    pub fn source_returns(
        &self,
        project: &str,
        limit: Option<u64>,
        before: Option<&str>,
    ) -> Result<SourceReturns, OwnerCallError> {
        // Central takes `limit` and `before` only when given: a null is
        // refused ("limit must be an integer").
        let mut input = json!({ "project": project });
        if let Some(limit) = limit {
            input["limit"] = json!(limit);
        }
        if let Some(before) = before {
            input["before"] = json!(before);
        }
        let data = self.run("projectcentral.source.returns", input)?;
        let result: SourceReturns = decode_owner("projectcentral.source.returns", data)?;
        ensure_schema(
            "projectcentral.source.returns",
            &result.schema,
            FLOW_RETURNS_SCHEMA,
        )?;
        Ok(result)
    }

    /// Re-read one proposal and its current source basis.
    pub fn source_return_read(
        &self,
        project: &str,
        return_ref: &str,
    ) -> Result<SourceReturnReading, OwnerCallError> {
        let data = self.run(
            "projectcentral.source.return_read",
            json!({ "project": project, "return_ref": return_ref }),
        )?;
        let result: SourceReturnReading = decode_owner("projectcentral.source.return_read", data)?;
        ensure_schema(
            "projectcentral.source.return_read",
            &result.schema,
            FLOW_RETURN_READING_SCHEMA,
        )?;
        ensure_schema(
            "projectcentral.source.return_read",
            &result.proposal.schema,
            FLOW_RETURN_SCHEMA,
        )?;
        Ok(result)
    }

    /// Explicitly accept a proposal. Central decides whether the basis still
    /// matches and which native owner write receipt resulted.
    pub fn source_return_accept(
        &self,
        project: &str,
        return_ref: &str,
        expected_revision: &str,
        acceptance: &str,
        accepted_by_ref: &str,
    ) -> Result<SourceReturnMutation, OwnerCallError> {
        let data = self.run(
            "projectcentral.source.return_accept",
            json!({
                "project": project,
                "return_ref": return_ref,
                "expected_revision": expected_revision,
                "acceptance": acceptance,
                "accepted_by_ref": accepted_by_ref,
            }),
        )?;
        let result: SourceReturnMutation =
            decode_owner("projectcentral.source.return_accept", data)?;
        ensure_schema(
            "projectcentral.source.return_accept",
            &result.proposal.schema,
            FLOW_RETURN_SCHEMA,
        )?;
        Ok(result)
    }

    /// Reject a proposal without touching its source.
    pub fn source_return_reject(
        &self,
        project: &str,
        return_ref: &str,
    ) -> Result<SourceReturnReading, OwnerCallError> {
        let data = self.run(
            "projectcentral.source.return_reject",
            json!({ "project": project, "return_ref": return_ref }),
        )?;
        let result: SourceReturnReading =
            decode_owner("projectcentral.source.return_reject", data)?;
        ensure_schema(
            "projectcentral.source.return_reject",
            &result.schema,
            FLOW_RETURN_READING_SCHEMA,
        )?;
        ensure_schema(
            "projectcentral.source.return_reject",
            &result.proposal.schema,
            FLOW_RETURN_SCHEMA,
        )?;
        Ok(result)
    }
}

fn ensure_schema(action: &str, actual: &str, expected: &str) -> Result<(), OwnerCallError> {
    if actual == expected {
        Ok(())
    } else {
        Err(OwnerCallError::Malformed {
            detail: format!(
                "{action} returned unsupported schema `{actual}` (expected `{expected}`)"
            ),
        })
    }
}

fn ensure_no_background(action: &str, data: &Value) -> Result<(), OwnerCallError> {
    if data
        .get("automatic_agent_or_model_invocation")
        .and_then(Value::as_bool)
        == Some(true)
    {
        return Err(OwnerCallError::Malformed {
            detail: format!("{action} violated zero-background-Agent law"),
        });
    }
    Ok(())
}

fn decode_value<T: for<'de> Deserialize<'de>>(
    action: &str,
    data: Value,
) -> Result<T, OwnerCallError> {
    serde_json::from_value(data).map_err(|error| OwnerCallError::Malformed {
        detail: format!("decode {action} owner result: {error}"),
    })
}

fn decode_owner<T: for<'de> Deserialize<'de>>(
    action: &str,
    data: Value,
) -> Result<T, OwnerCallError> {
    ensure_no_background(action, &data)?;
    decode_value(action, data)
}

// ---------------------------------------------------------------------------
// Owner contracts (decoded exactly as the owner serves them)
// ---------------------------------------------------------------------------

pub const SOURCE_READING_SCHEMA: &str = "central.project-world-source-reading/v1";
pub const SOURCE_WRITE_RECEIPT_SCHEMA: &str = "central.project-world-source-write-receipt/v1";

/// A source reading, exactly as `projectcentral.source.read` returned it.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceReading {
    pub schema: String,
    pub world_ref: String,
    pub source: SourceBinding,
    pub revision: SourceRevision,
    pub content: String,
    pub content_encoding: String,
    pub automatic_agent_or_model_invocation: bool,
}

/// The source binding the owner's reading carries, verbatim.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceBinding {
    #[serde(rename = "ref")]
    pub source_ref: String,
    pub path: String,
    #[serde(default)]
    pub exists: bool,
    #[serde(default)]
    pub provenance: String,
    #[serde(default)]
    pub standing: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub roles: Vec<String>,
    #[serde(default)]
    pub treatment: String,
    /// Central's retrieval gate, preserved verbatim: an excluded source is
    /// neither read nor written through the owner Action.
    #[serde(default)]
    pub agent_retrieval_allowed: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceRevision {
    pub revision: String,
    pub byte_len: u64,
}

/// A write receipt, exactly as `projectcentral.source.write` returned it.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceWriteReceipt {
    pub schema: String,
    pub world_ref: String,
    pub source: SourceBinding,
    pub previous_revision: String,
    pub revision: SourceRevision,
    pub changed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub change_ref: Option<String>,
    pub actor: String,
    pub actor_kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_session_ref: Option<String>,
    pub automatic_agent_or_model_invocation: bool,
}

pub const FLOW_INSPECTION_SCHEMA: &str = "central.project-flow-inspection/v1";
pub const FLOW_LIST_SCHEMA: &str = "central.project-flow-list/v1";
pub const FLOW_READING_SCHEMA: &str = "central.project-flow-reading/v1";
pub const FLOW_RETURN_SCHEMA: &str = "central.source-return/v1";
pub const FLOW_RETURN_READING_SCHEMA: &str = "central.source-return-reading/v1";
pub const FLOW_RETURNS_SCHEMA: &str = "central.source-returns/v1";

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceReturnProposal {
    pub schema: String,
    pub return_ref: String,
    pub source_ref: String,
    pub basis_revision: String,
    pub basis_content: String,
    pub proposed_content: String,
    pub reason: String,
    pub evidence_refs: Vec<String>,
    pub agent_session_ref: String,
    pub status: String,
    #[serde(default)]
    pub accepted_by_ref: Option<String>,
    #[serde(default)]
    pub result_revision: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceReturnAcceptance {
    pub available: bool,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceReturnMutation {
    pub outcome: String,
    pub proposal: SourceReturnProposal,
    #[serde(default)]
    pub current: Option<SourceReading>,
    #[serde(default)]
    pub receipt: Option<Value>,
    pub authored_source_mutated: bool,
    #[serde(default)]
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceReturnReading {
    pub schema: String,
    pub proposal: SourceReturnProposal,
    pub current: SourceReading,
    pub basis_current: bool,
    pub acceptance: SourceReturnAcceptance,
    pub authored_source_mutated: bool,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceReturnEntry {
    pub return_ref: String,
    pub source_ref: String,
    pub basis_revision: String,
    pub status: String,
    pub agent_session_ref: String,
    pub current_revision: String,
    /// The reviewers' comments on this Return (Central#290); absent from an
    /// older Central, and then carried absent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comments: Option<u64>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceReturns {
    pub schema: String,
    pub entries: Vec<SourceReturnEntry>,
    pub more: bool,
    #[serde(default)]
    pub next_before: Option<String>,
    pub authored_source_mutated: bool,
}

// ---------------------------------------------------------------------------
// Structured conflict — SourceWriteFailure (map §5 U0.4, U1.3 grammar)
// ---------------------------------------------------------------------------

/// Why a save did not land, structured so the surface can act on the
/// *kind* of failure without mining prose. A revision conflict carries
/// BOTH observed revisions — the buffer's expected base and the canonical
/// current — and the kernel's state keeps both sides (buffer content kept
/// dirty; canonical content re-readable). Never data loss, never a silent
/// overwrite.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SourceWriteFailure {
    /// Central's compare-and-swap refused the write: the revision moved.
    RevisionConflict {
        source_ref: String,
        expected: String,
        current: String,
    },
    /// The owner refused or could not serve for a reason that is not a
    /// revision move. Returned as it stands; never retried around.
    OwnerRefused { source_ref: String, message: String },
    /// The owner executable is unavailable. Honest absence, not an error.
    Unavailable { source_ref: String, detail: String },
}

impl SourceWriteFailure {
    pub fn kind(&self) -> &'static str {
        match self {
            Self::RevisionConflict { .. } => "revision-conflict",
            Self::OwnerRefused { .. } => "owner-refused",
            Self::Unavailable { .. } => "unavailable",
        }
    }

    pub fn source_ref(&self) -> &str {
        match self {
            Self::RevisionConflict { source_ref, .. }
            | Self::OwnerRefused { source_ref, .. }
            | Self::Unavailable { source_ref, .. } => source_ref,
        }
    }
}

impl std::fmt::Display for SourceWriteFailure {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::RevisionConflict {
                source_ref,
                expected,
                current,
            } => write!(
                formatter,
                "source-revision-conflict: {source_ref} moved from expected {expected} to {current}; \
                 both sides preserved — the buffer stays dirty, the canonical reading is re-readable; \
                 re-read and reconcile explicitly"
            ),
            Self::OwnerRefused { source_ref, message } => {
                write!(formatter, "owner refused the write for {source_ref}: {message}")
            }
            Self::Unavailable { source_ref, detail } => {
                write!(formatter, "owner unavailable for {source_ref}: {detail}")
            }
        }
    }
}

impl std::error::Error for SourceWriteFailure {}

/// The actor every cradle save attributes: a human act at the desktop,
/// honestly labelled (the ported `save_human` attribution).
pub const CRADLE_ACTOR: &str = "human:desktop";
pub const CRADLE_ACTOR_KIND: &str = "human";

#[cfg(test)]
mod tests {
    use super::*;

    /// O-I #747 round 896, 0R-authority.1: only the rule's code attaches the person's token. `for_person` is private to this module (so
    /// no other module can call it, which the compiler holds), and here only the rule calls it: `by_channel` and `for_person_act`, each
    /// by the channel the request came by. The token is set on a client nowhere else but `for_person` itself (and the tests' own
    /// stand-in, `with_person_token`); every other `person:` here clears it. No other source of the kernel names the token's door in its
    /// own code, by any spelling (`names_the_token`, round 896 1R-authority.9), and none calls the host's read (`host_native_token`)
    /// but `for_person` (round 896 item 4). The host's read is this module's, private to the rule (1V, L1), so no other module can
    /// name it at all. Two sources are named, each for its reason: factory.rs hands its owner the token the rule gave it for a person
    /// act (`CENTRAL_NATIVE_TOKEN`) and names the token's two places in its refusal words: Factory's grant-gated acts are given the
    /// person's token by `factory_person`, by the press channel alone (1R-authority.4, F4); and ground_authority.rs makes the host's key
    /// at Adopt (`.central/native-token`), from which only the key's digest leaves.
    #[test]
    fn only_the_rule_s_code_attaches_the_person_s_token() {
        let source = include_str!("flow.rs");
        let code = &source[..source.find("#[cfg(test)]\nmod tests {").unwrap()];
        let body = |name: &str| {
            let start = code
                .find(&format!("fn {name}("))
                .unwrap_or_else(|| panic!("fn {name}"));
            let end = code[start..].find("\n    }\n").unwrap() + start;
            &code[start..end]
        };
        let calls: Vec<usize> = code
            .match_indices(".for_person()")
            .map(|(at, _)| at)
            .collect();
        assert_eq!(
            calls.len(),
            2,
            "two calls of the token's door, both the rule's"
        );
        assert!(body("by_channel").contains("Channel::PersonPress => self.for_person()"));
        assert!(body("for_person_act").contains("Channel::PersonPress => Ok(self.for_person())"));
        assert!(
            code.contains("\n    fn for_person(&self) -> Self {"),
            "the token's door is private to this module"
        );
        let set: Vec<&str> = code
            .match_indices("person: ")
            .map(|(at, _)| code[at..].lines().next().unwrap())
            .collect();
        assert_eq!(
            set,
            [
                "person: Option<crate::factory::AuthorityToken>,",
                "person: None,",
                "person: None,",
                "person: None,"
            ],
            "the field, and three clearings: only for_person sets it (by shorthand, from the host's token)"
        );
        // Here, by every spelling (1R-authority.9): the door by path is never named, the host's token is read in the door alone, and its
        // environment name only where the owner's process is given the client's token or has it taken away.
        let own = production(code);
        assert!(
            !own.split_whitespace()
                .collect::<String>()
                .contains("::for_person"),
            "the door is never named by path"
        );
        // The host's read is this module's own and private (1V, L1): defined here, read through its inner read, called by the door alone.
        assert_eq!(
            own.matches("host_native_token()").count(),
            2,
            "its definition and the door's one call"
        );
        assert_eq!(
            own.matches("host_native_token_from(").count(),
            2,
            "its inner read and that read's one call"
        );
        assert!(
            own.contains("\nfn host_native_token() -> ")
                && own.contains("\nfn host_native_token_from("),
            "the host's read is private to the rule"
        );
        assert!(body("for_person").contains("host_native_token()"));
        let environment: Vec<&str> = own
            .lines()
            .filter(|line| line.contains("CENTRAL_NATIVE_TOKEN"))
            .map(str::trim)
            .collect();
        // Taken away from every child; taken into the kernel's keeping, and out of the environment the host's children inherit, at the
        // host's start (1T item 19, 1T.0 item 11); read from the environment only where no host holds it; read by the host's start again,
        // which hands it to itself by a pipe, and taken out of the environment its start after a change of World is given (1T.2); handed
        // to an owner, or taken away, by the rule's door.
        assert_eq!(
            environment,
            [
                "command.env_remove(\"CENTRAL_NATIVE_TOKEN\");",
                "let token = env::var(\"CENTRAL_NATIVE_TOKEN\").ok();",
                "env::remove_var(\"CENTRAL_NATIVE_TOKEN\");",
                "None => env::var(\"CENTRAL_NATIVE_TOKEN\").ok(),",
                "let token = env::var(\"CENTRAL_NATIVE_TOKEN\").unwrap_or_default();",
                ".env_remove(\"CENTRAL_NATIVE_TOKEN\")",
                "Some(token) => command.env(\"CENTRAL_NATIVE_TOKEN\", token.as_str()),",
                "None => command.env_remove(\"CENTRAL_NATIVE_TOKEN\"),"
            ]
        );
        assert_eq!(
            own.matches("launch_token()").count(),
            3,
            "the hold, the read, and the host's read's one call of it"
        );
        assert!(own.contains("host_native_token_from(launch_token(), "));
        // The token is made from a string in the host's read alone (1T.0 item 12): its constructor is crate-visible, and no other
        // source names it (the scan below).
        assert_eq!(
            own.matches("AuthorityToken::held(").count(),
            1,
            "the token made in the host's read alone"
        );
        assert_eq!(
            own.matches("native-token").count(),
            1,
            "the host's token file, in its read alone"
        );
        let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
        let mut stack = vec![src];
        let mut named = Vec::new();
        while let Some(folder) = stack.pop() {
            for entry in std::fs::read_dir(&folder).unwrap() {
                let path = entry.unwrap().path();
                if path.is_dir() {
                    stack.push(path);
                } else if path.extension().is_some_and(|ext| ext == "rs")
                    && !path.ends_with("src/flow.rs")
                {
                    let text = std::fs::read_to_string(&path).unwrap();
                    let said = names_the_token(&text);
                    // The host's read is called by `for_person` alone (round 896 item 4): a source may define it, never call it.
                    let code: String = production(&text).split_whitespace().collect();
                    if code.matches("host_native_token(").count()
                        > code.matches("fnhost_native_token(").count()
                    {
                        named.push(format!("{} calls host_native_token", path.display()));
                    }
                    // Named, each for its reason (above): Factory's owner's token and its words, and Adopt's key.
                    let allowed: &[&str] = if path.ends_with("src/factory.rs") {
                        &["CENTRAL_NATIVE_TOKEN", "native-token"]
                    } else if path.ends_with("src/ground_authority.rs") {
                        &["native-token"]
                    } else {
                        &[]
                    };
                    for spelling in said.into_iter().filter(|said| !allowed.contains(said)) {
                        named.push(format!("{} names {spelling}", path.display()));
                    }
                }
            }
        }
        named.sort();
        assert_eq!(
            named,
            Vec::<String>::new(),
            "no other source names the token's door"
        );
    }

    /// O-I #747 round 896 1V, M1 (DLW build ruling 2026-11-09; the authority review's M1): no child of the kernel or of the native host
    /// inherits the person's token. Every process starts at `child`, which takes the variable away, or is one of those named here: the
    /// host's terminal, whose builder takes it away itself; the host's reading of the current World (a source it shares with the
    /// live-shell crate, which does not link the kernel), which takes it away itself. The host starting itself again, at its start
    /// and after a change of World, starts at `child` too, and hands itself the token by a pipe (1T.2). Read from each source's own code
    /// (`production`): the kernel's, the host's, and every file the host includes by `#[path]`; a file included only under
    /// `#[cfg(test)]` is a test's. No source names `Command` by an alias (`use … as`, a `type` alias) or spawns by another crate's
    /// `Command`, names a constructor as a function value or by a qualified path, or brings in code by `include!`; a spawn under a `cfg`
    /// that holds in production is read as production (`production`, 1T item 9; 1W item 3).
    #[test]
    fn no_child_inherits_the_person_s_token() {
        let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let repository = manifest.join("../../..").canonicalize().unwrap();
        // (source, how its code reads from the spawn on): the one door every other spawn goes through, and those named above.
        let named = [
            (
                "desktop/cradle/kernel/src/flow.rs",
                "Command::new(program);command.env_remove(\"CENTRAL_NATIVE_TOKEN\");command}",
            ),
            (
                "desktop/cradle/src-tauri/src/terminal.rs",
                "CommandBuilder::new(program);",
            ),
            (
                "desktop/cradle/src-tauri/src/terminal.rs",
                "CommandBuilder::new(shell);",
            ),
            (
                "packages/live-shell/src/runtime.rs",
                "Command::new(suite_cli);command.env_remove(\"CENTRAL_NATIVE_TOKEN\");",
            ),
        ];
        let mut files = Vec::new();
        let mut tests = std::collections::BTreeSet::new();
        let mut stack = vec![manifest.join("src"), manifest.join("../src-tauri/src")];
        while let Some(folder) = stack.pop() {
            for entry in std::fs::read_dir(&folder).unwrap() {
                let path = entry.unwrap().path();
                if path.is_dir() {
                    stack.push(path);
                } else if path.extension().is_some_and(|ext| ext == "rs") {
                    files.push(path.canonicalize().unwrap());
                }
            }
        }
        // A module file named by `#[path]`: a test's when its declaration stands under `#[cfg(test)]`, else read with the rest.
        let mut at = 0;
        while at < files.len() {
            let text = std::fs::read_to_string(&files[at]).unwrap();
            let lines: Vec<&str> = text.lines().map(str::trim).collect();
            for (n, line) in lines.iter().enumerate() {
                if let Some(target) = line
                    .strip_prefix("#[path = \"")
                    .and_then(|rest| rest.strip_suffix("\"]"))
                {
                    let file = files[at]
                        .parent()
                        .unwrap()
                        .join(target)
                        .canonicalize()
                        .unwrap();
                    if n > 0 && lines[n - 1] == "#[cfg(test)]" {
                        tests.insert(file);
                    } else if !files.contains(&file) {
                        files.push(file);
                    }
                }
            }
            at += 1;
        }
        let mut found = Vec::new();
        let mut aliases = Vec::new();
        for path in files.iter().filter(|path| !tests.contains(*path)) {
            let name = path
                .strip_prefix(&repository)
                .unwrap()
                .display()
                .to_string();
            let (code, spawns, named_otherwise) =
                spawns_in(&std::fs::read_to_string(path).unwrap());
            for other in named_otherwise {
                aliases.push(format!("{name} names {other}"));
            }
            for at in spawns {
                let door = named
                    .iter()
                    .position(|(file, reads)| *file == name && code[at..].starts_with(reads));
                found.push((
                    name.clone(),
                    door,
                    code[at..].chars().take(72).collect::<String>(),
                ));
            }
            if name == "desktop/cradle/src-tauri/src/terminal.rs" {
                assert!(
                    code.contains("command_builder.env_remove(\"CENTRAL_NATIVE_TOKEN\");letchild=pair.slave.spawn_command(command_builder)"),
                    "the terminal's builder takes the person's token away, last before it starts"
                );
            }
        }
        let unnamed: Vec<String> = found
            .iter()
            .filter(|(_, door, _)| door.is_none())
            .map(|(name, _, code)| format!("{name}: {code}"))
            .collect();
        assert_eq!(
            unnamed,
            Vec::<String>::new(),
            "a spawn that does not start at flow::child"
        );
        let mut doors: Vec<usize> = found.iter().filter_map(|(_, door, _)| *door).collect();
        doors.sort();
        assert_eq!(doors, [0, 1, 2, 3], "each named door, once");
        assert_eq!(aliases, Vec::<String>::new(), "a spawn by another name");
        assert!(tests.len() >= 2, "the test-only files are known: {tests:?}");
    }

    /// What the spawn scan reads in a source (`no_child_inherits_the_person_s_token`): its own code (`production`, whitespace taken
    /// out), the place of each spawn in it, and every other name a spawn could go by. A spawn is a builder's constructor named at all:
    /// called, named as a function value (`.map(Command::new)`, `let f = Command::new;`) or by a qualified path (`<Command>::new(`) (1W
    /// item 3). The other names: an alias by `use … as`, a `type` alias of either builder (`type Cmd = std::process::Command;`, read
    /// as `=<path>Command;`), another crate's `Command`, and code brought in by `include!`, which the scan would not read.
    fn spawns_in(source: &str) -> (String, Vec<usize>, Vec<String>) {
        let code: String = production(source).split_whitespace().collect();
        let mut other = Vec::new();
        for alias in ["Commandas", "tokio::process", "async_process", "include!("] {
            if code.contains(alias) {
                other.push(alias.to_owned());
            }
        }
        for builder in ["Command;", "CommandBuilder;"] {
            for (at, _) in code.match_indices(builder) {
                let before = code[..at]
                    .trim_end_matches(|c: char| c.is_alphanumeric() || c == '_' || c == ':');
                if before.ends_with('=') {
                    other.push(format!("{builder} by a type alias"));
                }
            }
        }
        let mut spawns: Vec<usize> = [
            "Command::new",
            "CommandBuilder::new",
            "Command>::new",
            "CommandBuilder>::new",
        ]
        .iter()
        .flat_map(|spawn| code.match_indices(spawn).map(|(at, _)| at))
        .collect();
        spawns.sort();
        (code, spawns, other)
    }

    /// The spawn scan's reading, each way a spawn can be written (1W item 3: the 1V review's L-2): each found, and none found in a
    /// comment, under a test's `cfg`, or where `Command` is only a type.
    #[test]
    fn the_spawn_scan_catches_every_spelling() {
        let spawn = |source: &str| {
            let (_, spawns, other) = spawns_in(source);
            (spawns.len(), other)
        };
        for source in [
            "fn a() { let _ = std::process::Command::new(\"x\").status(); }",
            "fn a() { let _ = [\"x\"].map(std::process::Command::new); }",
            "fn a() { let f = std::process::Command::new; }",
            "fn a() { let _ = <std::process::Command>::new(\"x\"); }",
            "fn a() { let _ = portable_pty::CommandBuilder::new(\"x\"); }",
            "#[cfg(not(test))]\nfn a() { let _ = std::process::Command::new(\"x\").status(); }",
            "#[cfg(any(test, unix))]\nfn a() { let _ = std::process::Command::new(\"x\").status(); }",
            "#[cfg(not(attest))]\nfn a() { let _ = std::process::Command::new(\"x\").status(); }",
        ] {
            assert_eq!(spawn(source), (1, Vec::<String>::new()), "{source}");
        }
        for (source, other) in [
            (
                "type Cmd = std::process::Command;\nfn a() { let _ = Cmd::new(\"x\"); }",
                "Command; by a type alias",
            ),
            ("pub(crate) type Cmd = Command;", "Command; by a type alias"),
            (
                "type Pty = portable_pty::CommandBuilder;",
                "CommandBuilder; by a type alias",
            ),
            ("use std::process::Command as Cmd;", "Commandas"),
            ("use std::process::{Command as Cmd, Stdio};", "Commandas"),
            (
                "fn a() { let _ = tokio::process::Command::default(); }",
                "tokio::process",
            ),
            ("include!(\"spawn.rs\");", "include!("),
        ] {
            assert!(
                spawn(source).1.contains(&other.to_owned()),
                "the scan misses {other} in: {source}"
            );
        }
        for source in [
            "#[cfg(test)]\nfn a() { let _ = std::process::Command::new(\"x\").status(); }",
            "#[cfg(all(test, unix))]\nfn a() { let _ = std::process::Command::new(\"x\").status(); }",
            "// std::process::Command::new(x), named in a comment\nfn a() {}",
            "use std::process::Command;\nfn a(command: &mut Command) -> Command { child(\"x\") }",
            "fn a() { let c: Command; }",
        ] {
            assert_eq!(spawn(source), (0, Vec::<String>::new()), "{source}");
        }
    }

    /// A source's own code, as the token scan reads it (round 896, 1R-authority.9, F9): its comments blanked, and every item under a
    /// `cfg` that holds only under test blanked (its braces matched with comments, strings and char literals masked), so a comment or a
    /// test's fake never counts, and a string in the code itself does. A `cfg` is a test's only when it is bare `test` or `all(..)`
    /// with `test` among its own terms (`test_only`, 1T item 9 and 1V L1): `any(test, unix)` builds in production, and so does a
    /// predicate that spells "test" only inside another word (`not(attest)`).
    fn production(text: &str) -> String {
        let chars: Vec<char> = text.chars().collect();
        let n = chars.len();
        let blank = |c: char| if c == '\n' { '\n' } else { ' ' };
        let ident = |c: char| c.is_alphanumeric() || c == '_';
        // `kept`: comments blanked. `shape`: comments, string and char bodies blanked, for matching braces.
        let (mut kept, mut shape) = (chars.clone(), chars.clone());
        let mut i = 0;
        while i < n {
            let c = chars[i];
            let next = chars.get(i + 1).copied();
            if c == '/' && next == Some('/') {
                while i < n && chars[i] != '\n' {
                    (kept[i], shape[i]) = (' ', ' ');
                    i += 1;
                }
            } else if c == '/' && next == Some('*') {
                let mut depth = 0;
                while i < n {
                    let opening = chars[i] == '/' && chars.get(i + 1) == Some(&'*');
                    let closing = chars[i] == '*' && chars.get(i + 1) == Some(&'/');
                    if opening {
                        depth += 1;
                    } else if closing {
                        depth -= 1;
                    }
                    let step = if opening || closing { 2 } else { 1 };
                    for k in i..(i + step).min(n) {
                        (kept[k], shape[k]) = (blank(chars[k]), blank(chars[k]));
                    }
                    i += step;
                    if closing && depth == 0 {
                        break;
                    }
                }
            } else if c == '"'
                || (c == 'r'
                    && (i == 0
                        || !ident(chars[i - 1])
                        || (chars[i - 1] == 'b' && (i < 2 || !ident(chars[i - 2]))))
                    && matches!(next, Some('"') | Some('#')))
            {
                let hashes = if c == '"' {
                    0
                } else {
                    let mut j = i + 1;
                    while j < n && chars[j] == '#' {
                        j += 1;
                    }
                    if j >= n || chars[j] != '"' {
                        i += 1;
                        continue;
                    }
                    j - i - 1
                };
                let mut j = i + 1 + hashes + usize::from(c != '"');
                while j < n {
                    if c == '"' && chars[j] == '\\' {
                        shape[j] = ' ';
                        j += 1;
                    } else if chars[j] == '"'
                        && (0..hashes).all(|k| chars.get(j + 1 + k) == Some(&'#'))
                    {
                        break;
                    }
                    if j < n {
                        shape[j] = blank(chars[j]);
                    }
                    j += 1;
                }
                i = j + 1 + hashes;
            } else if c == '\'' {
                if next == Some('\\') {
                    let mut j = i + 3;
                    while j < n && chars[j] != '\'' {
                        j += 1;
                    }
                    for slot in shape.iter_mut().take(j.min(n)).skip(i + 1) {
                        *slot = ' ';
                    }
                    i = j + 1;
                } else if chars.get(i + 2) == Some(&'\'') {
                    shape[i + 1] = ' ';
                    i += 3;
                } else {
                    i += 1;
                }
            } else {
                i += 1;
            }
        }
        let shaped: String = shape.iter().collect();
        let mut from = 0;
        while let Some(at) = shaped[from..].find("#[cfg(").map(|at| at + from) {
            let close = shaped[at..].find(']').map_or(shaped.len(), |end| end + at);
            let predicate: String = shaped[at + "#[cfg(".len()..close]
                .chars()
                .filter(|c| !c.is_whitespace())
                .collect();
            from = close.min(shaped.len());
            if !test_only(predicate.strip_suffix(')').unwrap_or(&predicate)) {
                continue;
            }
            let body = shaped[close..].find(['{', ';']).map(|end| end + close);
            let end = match body {
                Some(open) if shaped[open..].starts_with('{') => {
                    let mut depth = 0usize;
                    let mut end = shaped.len();
                    for (offset, character) in shaped[open..].char_indices() {
                        match character {
                            '{' => depth += 1,
                            '}' => {
                                depth -= 1;
                                if depth == 0 {
                                    end = open + offset + 1;
                                    break;
                                }
                            }
                            _ => {}
                        }
                    }
                    end
                }
                Some(semicolon) => semicolon + 1,
                None => shaped.len(),
            };
            // `shaped` and `kept` hold the same characters at the same places; blank by character index.
            let (start, stop) = (shaped[..at].chars().count(), shaped[..end].chars().count());
            for slot in kept.iter_mut().take(stop).skip(start) {
                *slot = blank(*slot);
            }
            from = end;
        }
        kept.into_iter().collect()
    }

    /// A `cfg` predicate (whitespace taken out) that holds only under test: bare `test`, or `all(..)` with `test` (or a predicate
    /// that holds only under test) among its own terms (1T item 9, 1V L1).
    fn test_only(predicate: &str) -> bool {
        if predicate == "test" {
            return true;
        }
        let Some(inner) = predicate
            .strip_prefix("all(")
            .and_then(|rest| rest.strip_suffix(')'))
        else {
            return false;
        };
        let (mut depth, mut term, mut terms) = (0usize, String::new(), Vec::new());
        for c in inner.chars() {
            match c {
                '(' => depth += 1,
                ')' => depth = depth.saturating_sub(1),
                ',' if depth == 0 => {
                    terms.push(std::mem::take(&mut term));
                    continue;
                }
                _ => {}
            }
            term.push(c);
        }
        terms.push(term);
        terms.iter().any(|term| test_only(term))
    }

    /// The token scan's reading of one source: each spelling of the token's door its own code names (round 896, 1R-authority.9, F9):
    /// `for_person` called as a method, called or named by path (UFCS), the host's read `host_native_token`, the token's constructor
    /// `AuthorityToken::held` (1T.0 item 12: crate-visible, so any module could make a token from a string), the token's environment
    /// name `CENTRAL_NATIVE_TOKEN` and its file `native-token`, each also as the source builds it from its literals (`built_spellings`).
    /// A literal is read with its escapes (`"…\x54OKEN"`, `unescape`), and a bound name filling a `format!` by position (`"{}"`,
    /// `"{0}"`, `&p`) or a bound array joined (`let parts = [..]; parts.join("_")`) builds its text too (1T.2, review 956d finding 4).
    /// It is a tripwire for naming the token by accident, not a barrier (review 956a findings 4 and 5). It reads one source's text, and
    /// cannot see:
    /// - a name built from what that source does not write as a literal: read from a file, the environment or an argument, a constant
    ///   of another module, or a literal bound in one function and used in another under the same name (each source's bindings are one
    ///   table, `bound_literals`);
    /// - a name bound twice: the table keeps its last binding, so a use of the first, before a later `let` binds the name again, is
    ///   read with the later literal (review 956d finding 4);
    /// - an array whose type names its length (`const P: [&str; 2] = [..]`: the scan reads a source's statements between `;`), and a
    ///   `String` built from a literal (`String::from`, `.to_string()`, `+`), which is bound to no literal;
    /// - a name built by code rather than by `concat!`, `format!`, `.join(..)` or `.concat()`: `push_str`, `replace`,
    ///   `to_uppercase`, bytes or chars made into a string, an iterator collected, another macro;
    /// - a door reached through an alias (`use … as`, a `type` alias, a function pointer handed in) or a re-export;
    /// - a token handed on without a name: a child given an environment copied whole, `libc::system`, a file the token was written to.
    fn names_the_token(text: &str) -> Vec<&'static str> {
        let own = production(text);
        let code: String = own.split_whitespace().collect();
        let mut said = Vec::new();
        let door = code.match_indices("for_person").any(|(at, word)| {
            let after = code[at + word.len()..].chars().next();
            let before = &code[..at];
            !after.is_some_and(|c| c.is_alphanumeric() || c == '_')
                && (before.ends_with('.') || before.ends_with("::"))
        });
        if door {
            said.push("for_person");
        }
        if code.contains("AuthorityToken::held") || code.contains("AuthorityToken>::held") {
            said.push("AuthorityToken::held");
        }
        let bound = bound_literals(&own);
        let mut built = built_spellings(&code, &bound, &bound_arrays(&own, &bound));
        built.extend(escaped_literals(&code));
        for spelling in ["host_native_token", "CENTRAL_NATIVE_TOKEN", "native-token"] {
            if code.contains(spelling) || built.iter().any(|text| text.contains(spelling)) {
                said.push(spelling);
            }
        }
        said
    }

    /// The string literal each `let`, `const` or `static` of a source's code binds a name to (1T.0 item 12, review 956a finding 4), so
    /// that a name built from it (`let p = "CENTRAL_NATIVE"; format!("{p}_TOKEN")`, `[p, "TOKEN"].join("_")`) reads as built. A name
    /// bound twice keeps its last; a binding to anything but one literal is not read.
    fn bound_literals(code: &str) -> std::collections::BTreeMap<String, String> {
        let mut bound = std::collections::BTreeMap::new();
        for (name, value) in bindings(code) {
            let literal = value
                .strip_prefix('"')
                .and_then(|value| value.strip_suffix('"'));
            if let Some(literal) = literal.filter(|literal| !literal.contains('"')) {
                bound.insert(name, unescape(literal));
            }
        }
        bound
    }

    /// The array of literals or bound names each `let`, `const` or `static` binds a name to (`let parts = ["CENTRAL_NATIVE", p]`),
    /// each part as its text (1T.2, review 956d finding 4), so that the array joined later builds its text (`built_spellings`).
    fn bound_arrays(
        code: &str,
        bound: &std::collections::BTreeMap<String, String>,
    ) -> std::collections::BTreeMap<String, Vec<String>> {
        let mut arrays = std::collections::BTreeMap::new();
        for (name, value) in bindings(code) {
            let Some(inner) = value
                .trim_start_matches('&')
                .strip_prefix('[')
                .and_then(|value| value.strip_suffix(']'))
            else {
                continue;
            };
            let parts = inner
                .split(',')
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .map(|part| {
                    part.strip_prefix('"')
                        .and_then(|part| part.strip_suffix('"'))
                        .map(unescape)
                        .or_else(|| bound.get(part.trim_start_matches('&')).cloned())
                        .unwrap_or_default()
                })
                .collect();
            arrays.insert(name, parts);
        }
        arrays
    }

    /// Each `let`, `const` or `static` of a source's code with the name it binds and the text it binds it to, trimmed, in order.
    fn bindings(code: &str) -> Vec<(String, String)> {
        let mut found = Vec::new();
        for statement in code.split(';') {
            let Some((at, keyword)) = ["let ", "const ", "static "]
                .iter()
                .filter_map(|keyword| statement.rfind(keyword).map(|at| (at, *keyword)))
                .filter(|(at, _)| {
                    !statement[..*at].ends_with(|c: char| c.is_alphanumeric() || c == '_')
                })
                .max_by_key(|(at, _)| *at)
            else {
                continue;
            };
            let rest = statement[at + keyword.len()..].trim_start();
            let rest = rest.strip_prefix("mut ").unwrap_or(rest).trim_start();
            let name: String = rest
                .chars()
                .take_while(|c| c.is_alphanumeric() || *c == '_')
                .collect();
            let Some((_, value)) = rest[name.len()..].split_once('=') else {
                continue;
            };
            if !name.is_empty() {
                found.push((name, value.trim().to_owned()));
            }
        }
        found
    }

    /// A string literal's text with its escapes read as the compiler reads them (`\x54` and `\u{54}` are `T`), so that an escaped
    /// spelling reads as the one it is (1T.2, review 956d finding 4).
    fn unescape(text: &str) -> String {
        let mut read = String::new();
        let mut chars = text.chars();
        while let Some(c) = chars.next() {
            if c != '\\' {
                read.push(c);
                continue;
            }
            match chars.next() {
                Some('n') => read.push('\n'),
                Some('t') => read.push('\t'),
                Some('r') => read.push('\r'),
                Some('0') => read.push('\0'),
                Some('x') => {
                    let hex: String = chars.by_ref().take(2).collect();
                    read.extend(u8::from_str_radix(&hex, 16).ok().map(char::from));
                }
                Some('u') => {
                    let hex: String = chars.by_ref().skip(1).take_while(|c| *c != '}').collect();
                    read.extend(u32::from_str_radix(&hex, 16).ok().and_then(char::from_u32));
                }
                Some(other) => read.push(other),
                None => {}
            }
        }
        read
    }

    /// Every string literal of a source's code (whitespace taken out) that holds an escape, its escapes read (`unescape`; 1T.2).
    fn escaped_literals(code: &str) -> Vec<String> {
        let mut found = Vec::new();
        let (mut text, mut quoted, mut escaped, mut any) = (String::new(), false, false, false);
        let mut rest = code;
        while let Some(c) = rest.chars().next() {
            // A quote as a char literal opens no string.
            if !quoted {
                if let Some(after) = rest
                    .strip_prefix("'\"'")
                    .or_else(|| rest.strip_prefix("'\\\"'"))
                {
                    rest = after;
                    continue;
                }
            }
            rest = &rest[c.len_utf8()..];
            if !quoted {
                quoted = c == '"';
            } else if escaped {
                text.push(c);
                escaped = false;
            } else if c == '\\' {
                text.push(c);
                (escaped, any) = (true, true);
            } else if c == '"' {
                if any {
                    found.push(unescape(&text));
                }
                text.clear();
                (quoted, any) = (false, false);
            } else {
                text.push(c);
            }
        }
        found
    }

    /// A `format!` argument that names a bound literal (`p`, `&p`, `x = p`): that literal (1T.2, review 956d finding 4).
    fn bound_argument(
        term: &str,
        bound: &std::collections::BTreeMap<String, String>,
    ) -> Option<String> {
        let term = term.trim_start_matches('(');
        let term = term.split_once('=').map_or(term, |(_, value)| value);
        bound.get(term.trim_start_matches('&')).cloned()
    }

    /// The text each `concat!` and `format!` in a source's code (whitespace taken out) builds from its string literals (1T item 9, 1V
    /// L1): `concat!` joins them, `format!` fills each `{..}` of its first with the ones after it, so `concat!("CENTRAL_NATIVE", "_TOKEN")`
    /// and `format!("{}-token", "native")` spell the token's name as surely as the name itself. A `{name}` takes the literal the source
    /// binds that name to (`bound`), as an inline argument does, and an array of literals or bound names joined (`.join("_")`) or
    /// concatenated (`.concat()`) builds its text too (1T.0 item 12, review 956a finding 4).
    fn built_spellings(
        code: &str,
        bound: &std::collections::BTreeMap<String, String>,
        arrays: &std::collections::BTreeMap<String, Vec<String>>,
    ) -> Vec<String> {
        let mut built = Vec::new();
        for (at, name) in code
            .match_indices("concat!(")
            .chain(code.match_indices("format!("))
        {
            let mut literals: Vec<String> = Vec::new();
            let (mut depth, mut text, mut quoted, mut escaped, mut term) =
                (0usize, String::new(), false, false, String::new());
            for c in code[at + name.len() - 1..].chars() {
                if quoted {
                    if escaped {
                        text.push(c);
                        escaped = false;
                    } else if c == '\\' {
                        text.push(c);
                        escaped = true;
                    } else if c == '"' {
                        literals.push(unescape(&std::mem::take(&mut text)));
                        quoted = false;
                    } else {
                        text.push(c);
                    }
                    continue;
                }
                // Each argument outside its literals: a bound name in it fills its place as its literal does (`bound_argument`).
                match c {
                    '"' => quoted = true,
                    '(' => depth += 1,
                    ')' => {
                        depth -= 1;
                        if depth == 0 {
                            literals.extend(bound_argument(&term, bound));
                            break;
                        }
                    }
                    ',' if depth == 1 => {
                        literals.extend(bound_argument(&std::mem::take(&mut term), bound));
                        continue;
                    }
                    _ => {}
                }
                if depth == 1 {
                    term.push(c);
                }
            }
            if name.starts_with("concat") {
                built.push(literals.concat());
            } else if let Some((first, rest)) = literals.split_first() {
                let mut filled = String::new();
                let (mut pieces, mut args) = (first.split('{'), rest.iter());
                filled.push_str(pieces.next().unwrap_or_default());
                for piece in pieces {
                    let (spec, after) = piece.split_once('}').unwrap_or(("", piece));
                    let name = spec.split(':').next().unwrap_or_default();
                    let named = !name.is_empty() && !name.chars().all(|c| c.is_ascii_digit());
                    match named.then(|| bound.get(name)).flatten() {
                        Some(value) => filled.push_str(value),
                        None => filled.push_str(args.next().map_or("", String::as_str)),
                    }
                    filled.push_str(after);
                }
                built.push(filled);
            }
        }
        for (at, call) in code
            .match_indices("].join(\"")
            .chain(code.match_indices("].concat()"))
        {
            let separator = if call.starts_with("].join") {
                match code[at + call.len()..].split_once('"') {
                    Some((separator, _)) => separator,
                    None => continue,
                }
            } else {
                ""
            };
            let Some(open) = code[..at].rfind('[') else {
                continue;
            };
            let parts: Vec<String> = code[open + 1..at]
                .split(',')
                .filter(|part| !part.is_empty())
                .map(|part| {
                    part.strip_prefix('"')
                        .and_then(|part| part.strip_suffix('"'))
                        .map(unescape)
                        .or_else(|| bound.get(part.trim_start_matches('&')).cloned())
                        .unwrap_or_default()
                })
                .collect();
            built.push(parts.join(separator));
        }
        // A bound array joined or concatenated by its name (1T.2).
        for (name, parts) in arrays {
            for (at, call) in code
                .match_indices(&format!("{name}.join(\""))
                .chain(code.match_indices(&format!("{name}.concat()")))
            {
                if code[..at].ends_with(|c: char| c.is_alphanumeric() || c == '_') {
                    continue;
                }
                let separator = if call.ends_with("join(\"") {
                    match code[at + call.len()..].split_once('"') {
                        Some((separator, _)) => unescape(separator),
                        None => continue,
                    }
                } else {
                    String::new()
                };
                built.push(parts.join(&separator));
            }
        }
        built
    }

    /// O-I #747 round 896, 1R-authority.9 (F9): the scan catches every spelling of the token's door in a source's own code: the method
    /// call, its UFCS spelling and the path to it, the host's read, the token's environment name and its file; a comment or a test's
    /// fake that names them is not code, and counts for nothing.
    #[test]
    fn the_token_scan_catches_every_spelling() {
        for (source, spelling) in [
            ("fn a(c: &CentralClient) { c.for_person(); }", "for_person"),
            (
                "fn a(c: &CentralClient) { CentralClient::for_person(c); }",
                "for_person",
            ),
            (
                "fn a(c: &CentralClient) { Self :: for_person (c); }",
                "for_person",
            ),
            (
                "fn a() { let door = CentralClient::for_person; }",
                "for_person",
            ),
            (
                "fn a() { crate::factory::host_native_token(); }",
                "host_native_token",
            ),
            (
                "fn a() { std::env::var(\"CENTRAL_NATIVE_TOKEN\").ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
            (
                "fn a() { std::fs::read_to_string(home.join(\".central/native-token\")).ok(); }",
                "native-token",
            ),
            ("const KEY: &str = r#\"x/native-token\"#;", "native-token"),
            // The evasions the reviews found (1S review K1a, K1d, K1e; 1V review S-a, S-g, S-h), each caught (1T item 9, 1V L1).
            ("const KEY: &str = concat!(\"native\", \"-token\");", "native-token"),
            ("fn a() { std::env::var(concat!(\"CENTRAL_NATIVE\", \"_TOKEN\")).ok(); }", "CENTRAL_NATIVE_TOKEN"),
            ("fn a() -> String { format!(\"{}-token\", \"native\") }", "native-token"),
            ("fn a() -> String { format!(\"{}_{x}\", \"CENTRAL_NATIVE\", x = \"TOKEN\") }", "CENTRAL_NATIVE_TOKEN"),
            (
                "#[cfg(any(test, unix))]\nfn a() { crate::factory::host_native_token(); }",
                "host_native_token",
            ),
            (
                "#[cfg(not(attest))]\nfn a() { crate::factory::host_native_token(); }",
                "host_native_token",
            ),
            (
                "#[cfg(any(feature = \"k8\", test))]\nfn a() { std::env::var(\"CENTRAL_NATIVE_TOKEN\").ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
            // The shapes the host review built (1T.0 item 12, review 956a findings 4 and 5), each caught.
            (
                "fn a() { let p = \"CENTRAL_NATIVE\"; std::env::var(format!(\"{p}_TOKEN\")).ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
            (
                "fn a() { std::env::var([\"CENTRAL_NATIVE\", \"TOKEN\"].join(\"_\")).ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
            (
                "const P: &str = \"CENTRAL_NATIVE\";\nfn a() { std::env::var([P, \"_TOKEN\"].concat()).ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
            (
                "fn a(home: &Path) { let n = \"native\"; home.join(format!(\".central/{n}-token\")); }",
                "native-token",
            ),
            (
                "fn a() { crate::factory::AuthorityToken::held(\"x\"); }",
                "AuthorityToken::held",
            ),
            (
                "use crate::factory::AuthorityToken;\nfn a() { AuthorityToken :: held (\"x\"); }",
                "AuthorityToken::held",
            ),
            // The shapes the second host review built (1T.2, review 956d finding 4), each caught.
            (
                "fn a() { let p = \"CENTRAL_NATIVE\"; std::env::var(format!(\"{}_TOKEN\", p)).ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
            (
                "fn a() { let p = \"CENTRAL_NATIVE\"; std::env::var(format!(\"{0}_TOKEN\", &p)).ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
            (
                "fn a() { let s = \"TOKEN\"; std::env::var(format!(\"CENTRAL_NATIVE_{x}\", x = s)).ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
            (
                "fn a() { std::env::var(\"CENTRAL_NATIVE_\\x54OKEN\").ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
            (
                "fn a() { std::env::var(\"CENTRAL_NATIVE_\\u{54}OKEN\").ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
            (
                "fn a() { let parts = [\"CENTRAL_NATIVE\", \"TOKEN\"]; std::env::var(parts.join(\"_\")).ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
            (
                "static PARTS: &[&str] = &[\"native\", \"-token\"];\nfn a() -> String { PARTS.concat() }",
                "native-token",
            ),
            // A quote as a char literal opens no string: the escaped literal after it is still read.
            (
                "fn a() { let q = '\"'; std::env::var(\"CENTRAL_NATIVE_\\x54OKEN\").ok(); }",
                "CENTRAL_NATIVE_TOKEN",
            ),
        ] {
            assert!(
                names_the_token(source).contains(&spelling),
                "the scan misses {spelling} in: {source}"
            );
        }
        for source in [
            "// c.for_person() and CENTRAL_NATIVE_TOKEN in a comment\nfn a() {}",
            "/// the host's `native-token` file, named in a doc comment\nfn a() {}",
            "/* CentralClient::for_person(c) */ fn a() {}",
            "fn a() {}\n#[cfg(test)]\nmod tests {\n    const FAKE: &str = r#\"os.environ.get('CENTRAL_NATIVE_TOKEN') {\"#;\n    fn b() { let _ = '{'; }\n}\n",
            "#[cfg(all(test, unix))]\nfn fake() { std::env::var(\"CENTRAL_NATIVE_TOKEN\").ok(); }\nfn a() {}",
            "#[cfg(all(unix, test))]\nfn fake() { std::env::var(\"CENTRAL_NATIVE_TOKEN\").ok(); }\nfn a() {}",
            "#[cfg(all(test, any(unix, windows)))]\nfn fake() { std::env::var(\"CENTRAL_NATIVE_TOKEN\").ok(); }\nfn a() {}",
            "fn a() { c.for_person_act(\"x\", channel); }",
            // Bound names fill only their own place: this builds CENTRAL_TOKEN, which names nothing.
            "fn a() { let p = \"CENTRAL\"; std::env::var(format!(\"{p}_TOKEN\")).ok(); }",
            "fn a() { std::env::var([\"CENTRAL\", \"TOKEN\"].join(\"_\")).ok(); }",
            "fn a() { let p = \"CENTRAL\"; std::env::var(format!(\"{}_TOKEN\", p)).ok(); }",
            "fn a() { let parts = [\"CENTRAL\", \"TOKEN\"]; std::env::var(parts.join(\"_\")).ok(); }",
            "fn a() { std::env::var(\"CENTRAL_\\x54OKEN\").ok(); }",
        ] {
            assert_eq!(
                names_the_token(source),
                Vec::<&str>::new(),
                "not code that names the door: {source}"
            );
        }
        assert_eq!(
            names_the_token(
                "#[cfg(test)]\nmod tests {\n    fn b() { let _ = '}'; }\n}\nfn a() { CentralClient::for_person(c); }"
            ),
            ["for_person"],
            "code after a test module is still read"
        );
    }

    /// The host's own read of its token, moved here with the read from factory.rs (1V, L1): its environment wins, else its token file,
    /// trimmed; a blank environment value, an absent file or an empty one is no token.
    #[test]
    fn the_host_reads_its_own_token() {
        let base = std::env::temp_dir().join(format!("flow-host-token-{}", std::process::id()));
        std::fs::create_dir_all(base.join(".central")).unwrap();
        std::fs::write(base.join(".central/native-token"), "file-token\n").unwrap();
        let read = |environment: Option<&str>, home: Option<PathBuf>| {
            host_native_token_from(environment.map(str::to_owned), home)
                .map(|token| token.as_str().to_owned())
        };
        assert_eq!(
            read(Some("env-token"), Some(base.clone())).as_deref(),
            Some("env-token"),
            "the host's environment wins"
        );
        assert_eq!(
            read(None, Some(base.clone())).as_deref(),
            Some("file-token"),
            "else the owner's token file, trimmed"
        );
        assert_eq!(
            read(Some("  "), Some(base.clone())).as_deref(),
            Some("file-token"),
            "a blank environment value is no token"
        );
        assert_eq!(read(None, Some(base.join("absent"))), None);
        assert_eq!(read(None, None), None);
        std::fs::write(base.join(".central/native-token"), "\n").unwrap();
        assert_eq!(
            read(None, Some(base.clone())),
            None,
            "an empty file is no token"
        );
        let _ = std::fs::remove_dir_all(&base);
    }

    /// The environment of a host, as `discover_in` reads it.
    fn environment(
        pairs: &[(&str, &std::path::Path)],
    ) -> impl Fn(&str) -> Option<std::ffi::OsString> {
        let pairs: Vec<(String, std::ffi::OsString)> = pairs
            .iter()
            .map(|(name, value)| ((*name).to_owned(), value.as_os_str().to_owned()))
            .collect();
        move |name| {
            pairs
                .iter()
                .find(|(held, _)| held == name)
                .map(|(_, value)| value.clone())
        }
    }

    #[cfg(unix)]
    #[test]
    fn source_returns_name_a_limit_and_a_cursor_only_when_given() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("central-returns-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let ctrl = dir.join("ctrl");
        // Refuses a null limit or cursor, as Central does.
        std::fs::write(
            &ctrl,
            r#"#!/bin/sh
for last; do :; done
case "$last" in
  *'"limit":null'*|*'"before":null'*)
    echo '{"ok":false,"status":"invalid_input","error":{"code":"invalid_input","message":"limit must be an integer"}}' ;;
  *)
    echo '{"ok":true,"data":{"schema":"central.source-returns/v1","entries":[],"more":false,"authored_source_mutated":false}}' ;;
esac
"#,
        )
        .unwrap();
        std::fs::set_permissions(&ctrl, std::fs::Permissions::from_mode(0o755)).unwrap();
        crate::test_stub::settle_stub(&ctrl);
        let client = CentralClient::with(ctrl, None, "test".into());
        assert!(client
            .source_returns("O-I", None, None)
            .unwrap()
            .entries
            .is_empty());
        assert!(client.source_returns("O-I", Some(10), Some("r-1")).is_ok());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_host_that_names_its_central_owner_asks_it_directly_and_otherwise_the_suite_route_stands() {
        let dir = std::env::temp_dir().join(format!("central-client-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let ctrl = dir.join("ctrl");
        std::fs::write(&ctrl, "").unwrap();
        let oi = std::path::Path::new("/suite/oi");
        let ground = std::path::Path::new("/ground");

        let direct = CentralClient::discover_in(environment(&[
            ("OI_BIN", oi),
            ("OI_CENTRAL_CTRL_BIN", &ctrl),
            ("OI_CENTRAL_ROOT", ground),
        ]));
        assert_eq!(direct.executable, ctrl);
        assert!(
            !direct.suite_route,
            "no `oi central` in front of a named owner"
        );
        assert_eq!(direct.central_root.as_deref(), Some(ground));
        assert_eq!(direct.project_query, "o-i");

        // Naming nothing, or something that is not a file, leaves the suite route.
        for named in [
            environment(&[("OI_BIN", oi)]),
            environment(&[("OI_BIN", oi), ("OI_CENTRAL_CTRL_BIN", &dir.join("absent"))]),
            environment(&[("OI_BIN", oi), ("OI_CENTRAL_CTRL_BIN", &dir)]),
        ] {
            let suite = CentralClient::discover_in(named);
            assert_eq!(suite.executable, oi);
            assert!(suite.suite_route);
        }
        // No suite named either: `oi` on the path, as before.
        let bare = CentralClient::discover_in(environment(&[]));
        assert_eq!(bare.executable, PathBuf::from("oi"));
        assert!(bare.suite_route);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_write_core_targets_the_owner_actions_and_writes_no_files_itself() {
        let source = include_str!("flow.rs")
            .split("\n#[cfg(test)]")
            .next()
            .unwrap();
        assert!(!source.contains("fs::write"));
        assert!(!source.contains("OpenOptions"));
        assert!(!source.contains("File::create"));
        assert!(source.contains("projectcentral.source.read"));
        assert!(source.contains("projectcentral.source.write"));
        assert!(source.contains("expected_revision"));
    }

    #[test]
    fn a_conflict_failure_is_structured_with_both_revisions() {
        let failure = SourceWriteFailure::RevisionConflict {
            source_ref: "central:source:project:project:o-i:a.md".into(),
            expected: "central.content-fnv1a64/v1:2389:e".into(),
            current: "central.content-fnv1a64/v1:2404:c".into(),
        };
        assert_eq!(failure.kind(), "revision-conflict");
        let wire = serde_json::to_value(&failure).unwrap();
        assert_eq!(wire["kind"], "revision-conflict");
        assert_eq!(
            wire["source_ref"],
            "central:source:project:project:o-i:a.md"
        );
        assert_eq!(wire["expected"], "central.content-fnv1a64/v1:2389:e");
        assert_eq!(wire["current"], "central.content-fnv1a64/v1:2404:c");
        assert!(failure.to_string().contains("both sides preserved"));
    }

    #[test]
    fn receiving_wire_keeps_every_native_variant_externally_tagged() {
        let values = [
            serde_json::json!({"List":{"after":0,"limit":10}}),
            serde_json::json!({"Read":{"return_ref":"return:1"}}),
            serde_json::json!({"Submit":{"producer_key":"p","source_ref":"source:1","document_id":"doc:1","expected_source_revision":"r1","occurred_at_unix_seconds":1,"proposal":{}}}),
            serde_json::json!({"Document":{"source_ref":"source:1","document_id":"doc:1"}}),
            serde_json::json!({"Review":{"return_ref":"return:1","expected_return_revision":"r1","disposition":"rejected"}}),
            serde_json::json!({"Include":{"return_ref":"return:1","expected_return_revision":"r1","expected_source_revision":"s1"}}),
            serde_json::json!({"Recover":{"return_ref":"return:1","expected_return_revision":"r1"}}),
            serde_json::json!({"MutateField":{"source_ref":"source:1","document_id":"doc:1","expected_revision":"r1","request_id":"request:1","field_id":"field:1","value":"value"}}),
            serde_json::json!({"MutateMeta":{"source_ref":"source:1","document_id":"doc:1","expected_revision":"r1","request_id":"request:1","key":"title","value":"Monday"}}),
        ];
        for value in values {
            serde_json::from_value::<ReceivingRequest>(value)
                .expect("desktop wire must deserialize as the native owner request");
        }
        assert!(serde_json::from_value::<ReceivingRequest>(
            serde_json::json!({"kind":"document","source_ref":"source:1","document_id":"doc:1"})
        )
        .is_err());
    }

    #[test]
    fn a_pages_own_metadata_goes_to_the_owners_own_operation() {
        assert_eq!(MetaKey::Title.operation(), "title.set");
        assert_eq!(MetaKey::Summary.operation(), "summary.set");
        assert_eq!(MetaKey::Lifecycle.operation(), "lifecycle.set");
        let request: ReceivingRequest = serde_json::from_value(serde_json::json!({"MutateMeta":{
            "source_ref":"source:1","document_id":"doc:1","expected_revision":"r1","request_id":"request:1","key":"lifecycle","value":"closed"}}))
        .unwrap();
        assert_eq!(request.action(), "central.document.mutate");
        assert!(serde_json::from_value::<ReceivingRequest>(serde_json::json!({"MutateMeta":{
            "source_ref":"source:1","document_id":"doc:1","expected_revision":"r1","request_id":"request:1","key":"author","value":"x"}}))
        .is_err(), "a key the owner does not take is refused at the wire");
    }

    #[test]
    fn owner_requests_carry_decisions_and_realisations_without_a_document_basis() {
        let decided: ReceivingRequest = serde_json::from_value(serde_json::json!({"Review":{
            "return_ref":"return:1","expected_return_revision":"r1","disposition":"answered","answer":"Omarchy now"}}))
        .unwrap();
        let realised: ReceivingRequest = serde_json::from_value(serde_json::json!({"Include":{
            "return_ref":"return:1","expected_return_revision":"r2","realisation_ref":"run:01","realisation_owner_ref":"factory"}}))
        .unwrap();
        let open: ReceivingRequest =
            serde_json::from_value(serde_json::json!({"List":{"limit":20,"open":true}})).unwrap();
        assert_eq!(
            decided,
            ReceivingRequest::Review {
                return_ref: "return:1".into(),
                expected_return_revision: "r1".into(),
                disposition: "answered".into(),
                expected_source_revision: None,
                note: None,
                answer: Some("Omarchy now".into()),
            }
        );
        assert!(
            matches!(realised, ReceivingRequest::Include { expected_source_revision: None, realisation_ref: Some(ref r), .. } if r == "run:01")
        );
        assert!(matches!(
            open,
            ReceivingRequest::List {
                open: Some(true),
                ..
            }
        ));
        let asked: ReceivingRequest = serde_json::from_value(serde_json::json!({"Submit":{
            "producer_key":"epii:proposal","occurred_at_unix_seconds":1,
            "request":{"kind":"proposal","subject":"Verify","proposed_owner_ref":"factory"},
            "evidence_refs":["central:path:/w:T/e.json"],
            "declared_producer":{"ref":"agent-session/epii","actor_kind":"agent","attribution":"claimed"}}}))
        .unwrap();
        assert!(matches!(
            asked,
            ReceivingRequest::Submit {
                source_ref: None,
                proposal: None,
                request: Some(_),
                ..
            }
        ));
    }
}
