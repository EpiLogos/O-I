//! Factory's own developmental reads and the re-pinned build view, through
//! the owner's CLI. The desktop never manufactures a grant or a Factory
//! state; payloads are carried verbatim after their contract schemas are
//! verified.
use crate::material::{invoke, Error};
use serde_json::Value;
use std::path::{Path, PathBuf};
#[derive(Clone, Debug)]
pub struct Client {
    executable: PathBuf,
}
fn incompatible(message: impl ToString) -> Error {
    Error {
        kind: "incompatible".into(),
        message: message.to_string(),
        operation_may_have_run: true,
    }
}
impl Client {
    pub fn discover() -> Self {
        Self::with(
            std::env::var_os("OI_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| "oi".into()),
        )
    }
    pub fn with(executable: PathBuf) -> Self {
        Self { executable }
    }
    pub fn project_sources(&self) -> Result<Value, Error> {
        let data = invoke(
            &self.executable,
            &["factory-projects".into(), "--json".into()],
            None,
        )?;
        if data["contract"] != "oi.factory-project-sources/v1"
            || !data["sources"].is_array()
            || !data["errors"].is_array()
        {
            return Err(incompatible(
                "Unsupported Factory project locations reading",
            ));
        }
        Ok(data)
    }
    /// One developmental read through the owner's own `factory development`
    /// family (queue cell 3). The state path is the caller's disclosure —
    /// the desktop never invents a Factory state — and the payload is
    /// carried verbatim after the read's contract schema is verified.
    /// `read`/`ref` are the owner's own CLI grammar, never re-keyed.
    pub fn development_read(
        &self,
        state_path: &Path,
        read: &str,
        subject: Option<&str>,
    ) -> Result<Value, Error> {
        if !is_development_read(read) {
            return Err(incompatible("Unsupported Factory development read"));
        }
        let mut args: Vec<std::ffi::OsString> = vec![
            "factory".into(),
            "development".into(),
            read.to_string().into(),
            state_path.as_os_str().to_string_lossy().into_owned().into(),
        ];
        if let Some(subject) = subject {
            args.push(subject.to_string().into());
        }
        args.push("--json".into());
        let data = invoke(&self.executable, &args, None)?;
        let schema = data
            .get("contract")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();
        if !schema.starts_with("factory.") || !schema.ends_with("-reading/v1") {
            return Err(incompatible("Unsupported Factory development reading"));
        }
        Ok(data)
    }
    /// The re-pinned build view (queue cell B): the installed CLI reads it as
    /// `factory build snapshot <state> <project-ref> <run-ref> --json` — the
    /// old `--binding` grammar and `build discover` are gone from the owner.
    /// Refs and state path are the caller's disclosure, passed verbatim; the
    /// payload is carried only after its contract schemas are verified.
    /// `suite_route` follows the caller's executable: through the suite
    /// executable the product namespace names the route; a direct Factory
    /// binary must not hear the prefix again (the development arm's own law).
    pub fn build_snapshot(
        &self,
        state_path: &Path,
        project_ref: &str,
        run_ref: &str,
        suite_route: bool,
    ) -> Result<Value, Error> {
        let mut args: Vec<std::ffi::OsString> = Vec::new();
        if suite_route {
            args.push("factory".into());
        }
        args.extend([
            "build".into(),
            "snapshot".into(),
            state_path.as_os_str().to_string_lossy().into_owned().into(),
            project_ref.into(),
            run_ref.into(),
            "--json".into(),
        ]);
        let data = invoke(&self.executable, &args, None)?;
        // The owner CLI serialises this field camelCase (`providerContract`);
        // both spellings are accepted so the check never outruns the owner.
        let provider_contract = data
            .get("providerContract")
            .or_else(|| data.get("provider_contract"))
            .and_then(Value::as_str);
        if data.get("contract").and_then(Value::as_str) != Some("factory.build-view/v1")
            || provider_contract != Some("factory.build-view-provider/v1")
        {
            return Err(incompatible("Unsupported Factory build view"));
        }
        Ok(data)
    }
}

/// The `factory development <read>` verbs the desktop may issue — one list,
/// checked by every path that builds a development read (the dispatch arm,
/// the client and the inhabitation owner requests), so no path bypasses it.
/// `inhabitation` and `current-work` are the World-inhabitation reads
/// (WORLD-INHABITATION-V1 §3); they take typed flags and go through
/// [`OwnerRequest::Inhabitation`] / [`OwnerRequest::CurrentWork`].
pub const DEVELOPMENT_READS: &[&str] = &[
    "project",
    "journey",
    "run",
    "build",
    "workflow-units",
    "workflow-unit",
    "execution-telemetry",
    "commission-read",
    "inhabitation",
    "current-work",
];
/// Whether `read` is a development read the desktop may issue.
pub fn is_development_read(read: &str) -> bool {
    DEVELOPMENT_READS.contains(&read)
}

/// How long one bounded Factory read may take before the desktop stops waiting
/// and names it `timeout` (a read never hangs a panel or the temporal field).
/// The bound covers the inhabitation reads and the telemetry day read alike.
/// Tests shorten it with `OI_INHABITATION_READ_TIMEOUT_MS`.
pub fn inhabitation_read_timeout() -> std::time::Duration {
    std::env::var("OI_INHABITATION_READ_TIMEOUT_MS")
        .ok()
        .and_then(|ms| ms.parse::<u64>().ok())
        .map(std::time::Duration::from_millis)
        .unwrap_or(std::time::Duration::from_secs(20))
}

/// The owner CLI's own argument grammar for one development read — built
/// here so the dispatch arm stays declarative. Never re-keyed.
pub fn development_read_args(
    state_path: &Path,
    read: &str,
    subject: Option<&str>,
    suite_route: bool,
) -> Vec<std::ffi::OsString> {
    let mut args: Vec<std::ffi::OsString> = Vec::new();
    if suite_route {
        // Through the suite executable the product namespace names the route.
        args.push("factory".into());
    }
    args.extend([
        "development".into(),
        read.to_string().into(),
        state_path.as_os_str().to_string_lossy().into_owned().into(),
    ]);
    if let Some(subject) = subject {
        args.push(subject.to_string().into());
    }
    args.push("--json".into());
    args
}

// ---------------------------------------------------------------------------
// 11-FACTORY §2/§3: the owner reads and owner acts the Desk and the Run page
// need beyond the development family — discovery (`factory project locate`),
// the workflow inspection, telemetry, the attempt Return, the action
// projection, and the person's Recognition. One request family behind one
// KernelOp (`factory_owner`), so the dispatch arm stays a single line; every
// payload is the owner's own, carried verbatim after its contract is checked.
// ---------------------------------------------------------------------------

/// One owner request. The state path, refs and roots are the caller's (or
/// Central's) disclosure — never invented here.
#[derive(Clone, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum OwnerRequest {
    /// Discover the Factory sources in scope: `factory project locate <root>`
    /// for Central's root (`project: None, all: false`), one Work project, or
    /// the root and every Work project (`all: true`). Roots come from
    /// Central's own world reading, never from the caller.
    Locate {
        #[serde(default)]
        project: Option<String>,
        #[serde(default)]
        all: bool,
    },
    /// `factory workflow inspect <state> <run-ref> [--unit] [--attempt] [--limit] [--cursor]`.
    WorkflowInspect {
        state_path: PathBuf,
        run_ref: String,
        #[serde(default)]
        unit: Option<String>,
        #[serde(default)]
        attempt: Option<String>,
        #[serde(default)]
        limit: Option<u32>,
        #[serde(default)]
        cursor: Option<Value>,
    },
    /// `factory telemetry status <state>`.
    TelemetryStatus { state_path: PathBuf },
    /// `factory telemetry inspect <state> <telemetry-ref>`.
    TelemetryInspect {
        state_path: PathBuf,
        telemetry_ref: String,
    },
    /// `factory telemetry watch <state> [--resume <cursor>] --duration S
    /// --max-events N --interval I` — the owner's resumable bounded stream
    /// of execution correlations (JSONL), for the Factory Live producer loop.
    /// Bounded here too: the duration is clamped to [0, 4] seconds and the
    /// event count to [1, 500], so a follow can never hang the kernel arm.
    /// `run_ref` filters the correlation lines to one Run (the owner's watch
    /// is state-wide); the cursor line is always returned.
    TelemetryWatch {
        state_path: PathBuf,
        #[serde(default)]
        resume: Option<Value>,
        #[serde(default)]
        #[serde(deserialize_with = "crate::expression_file::optional_finite_number")]
        duration_secs: Option<f64>,
        #[serde(default)]
        max_events: Option<u32>,
        #[serde(default)]
        run_ref: Option<String>,
    },
    /// Owner-native current sensing projection. No collection is triggered.
    TelemetryField { state_path: PathBuf },
    /// Try AIKit's bounded hot projection for this exact ProjectWorld, then
    /// read the Factory owner when it is missing, stale or unavailable.
    TelemetryCurrent {
        state_path: PathBuf,
        project_world_ref: String,
    },
    /// One source-qualified signal and its original observation.
    TelemetrySignal {
        state_path: PathBuf,
        signal_ref: String,
    },
    /// Read-only human decisions; this does not accept an Action.
    TelemetryDigest { state_path: PathBuf },
    /// Bounded recurrence reading over Central civil Days.
    TelemetryLookback {
        state_path: PathBuf,
        #[serde(default)]
        day: Option<String>,
        #[serde(default)]
        from_day: Option<String>,
        #[serde(default)]
        through_day: Option<String>,
    },
    /// One Day or named Day range from Factory's owner-native history.
    TelemetryDay {
        state_path: PathBuf,
        #[serde(default)]
        day: Option<String>,
        #[serde(default)]
        from_day: Option<String>,
        #[serde(default)]
        through_day: Option<String>,
    },
    /// `factory attempt return <state> <run-ref> <attempt-ref>` — the readable Return.
    AttemptReturn {
        state_path: PathBuf,
        run_ref: String,
        attempt_ref: String,
    },
    /// `factory action list <state> <project-ref> <run-ref>`.
    ActionList {
        state_path: PathBuf,
        project_ref: String,
        run_ref: String,
    },
    /// `factory action invoke <state> <project-ref> <run-ref> -` with the
    /// owner's own `factory.action-projection/v1` request document.
    ActionInvoke {
        state_path: PathBuf,
        project_ref: String,
        run_ref: String,
        request: Value,
    },
    /// `factory development inhabitation <state> [--run R] [--position P]`
    /// → `factory.inhabitation-reading/v1` (WORLD-INHABITATION-V1 §3): per
    /// Run, the Positions in custody and the occupant relations Factory
    /// holds. A projection, not a registry; foreign refs carried verbatim.
    Inhabitation {
        state_path: PathBuf,
        #[serde(default)]
        run_ref: Option<String>,
        #[serde(default)]
        position_ref: Option<String>,
    },
    /// `factory development current-work <state> --position P` →
    /// `factory.current-work/v1`: none | one | ambiguous, derived by the owner
    /// over every in-progress custody — never a display page.
    CurrentWork {
        state_path: PathBuf,
        position_ref: String,
    },
    /// The person's Recognition of a returned subject, recorded through the
    /// owner's own developmental mutation (`factory development mutate`,
    /// `record-owner-recognition`). The owner's receipt is the result.
    Recognise {
        state_path: PathBuf,
        journey_ref: String,
        subject_ref: String,
        #[serde(default)]
        basis_refs: Vec<String>,
    },
    /// The person's commission of an accepted proposal: `factory development
    /// commission <state> -` with the caller's own
    /// `factory.commission-request/v1` document, carried verbatim; the desktop
    /// maps no authority. Factory validates it, derives the Journey/Run and
    /// replays an identical request as `already-applied`; its receipt names the
    /// commissioned project/journey/run.
    DevelopmentCommission {
        state_path: PathBuf,
        #[serde(default)]
        request: Value,
    },
    /// The close of a Run's own lifecycle after the person's Recognition
    /// (T-FACTORY-2b): the owner's lifecycle moves in their legal order, each
    /// receipt or refusal returned verbatim. `recognition_ref` names the
    /// Recognition the close follows; `next_unit` is the owner's own
    /// start-serial document, carried verbatim, which when present is the only
    /// move made (the owner refuses Finishing while a serial unit remains).
    RunClose {
        state_path: PathBuf,
        run_ref: String,
        recognition_ref: String,
        #[serde(default)]
        next_unit: Option<Value>,
        /// The host's native action authority grant ref for this close, in the
        /// form `central:native-action-authority#<principal_ref>`. Absent, the
        /// close is refused before any owner call: the desk never asserts a grant.
        #[serde(default)]
        authority_grant: Option<String>,
    },
    /// `factory attempt admission` → `factory.attempt-admission/v1`: the
    /// desktop caller Factory expects and the native action, scope and actor
    /// kind a grant must carry for the person to act on its attempts. A
    /// reading; it grants nothing.
    AttemptAdmission {},
    /// The person chooses an attempt: its retained Return is proposed to
    /// Central's receiving field, in the Central Flow the Run is associated
    /// with (`factory attempt receiving`). The caller, the capability and the
    /// native action come from Factory's own admission reading; the target
    /// Flow, the Central root and the state revision from its Run and attempt
    /// readings; the grant is resolved by the host against Central's native
    /// action authority contract with the host's own token, which reaches
    /// Factory's environment and never the request or the reply. Absent
    /// `authority_grant`, the host resolves the principal its token belongs to.
    AttemptReceiving {
        state_path: PathBuf,
        run_ref: String,
        attempt_ref: String,
        #[serde(default)]
        authority_grant: Option<String>,
    },
}

/// The host's native action token. It never crosses the webview: the native
/// host reads it itself (`host_native_token`), and its Debug output is
/// redacted so nothing logged carries it.
#[derive(Clone, PartialEq, Eq)]
pub struct AuthorityToken(String);

impl AuthorityToken {
    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }

    #[cfg(test)]
    pub(crate) fn for_test(token: &str) -> Option<Self> {
        Some(Self(token.to_owned()))
    }
}

impl std::fmt::Debug for AuthorityToken {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("AuthorityToken(<redacted>)")
    }
}

impl OwnerRequest {
    /// Whether the arm must hand over Central's world reading (the roots).
    pub fn needs_world(&self) -> bool {
        matches!(self, OwnerRequest::Locate { .. })
    }
    /// A reading of the owner's state, which may run outside the kernel lock
    /// (owner_read.rs `PreparedRead`). Named one by one: a request not named
    /// here — an action, a recognition, a commission, a close, and any
    /// request added later — is a prepared write (owner_write.rs): its owner
    /// runs outside the lock and its finish records the Run's receipt.
    pub fn is_read(&self) -> bool {
        matches!(
            self,
            OwnerRequest::Locate { .. }
                | OwnerRequest::WorkflowInspect { .. }
                | OwnerRequest::TelemetryStatus { .. }
                | OwnerRequest::TelemetryInspect { .. }
                | OwnerRequest::TelemetryWatch { .. }
                | OwnerRequest::TelemetryField { .. }
                | OwnerRequest::TelemetryCurrent { .. }
                | OwnerRequest::TelemetrySignal { .. }
                | OwnerRequest::TelemetryDigest { .. }
                | OwnerRequest::TelemetryLookback { .. }
                | OwnerRequest::TelemetryDay { .. }
                | OwnerRequest::AttemptReturn { .. }
                | OwnerRequest::ActionList { .. }
                | OwnerRequest::Inhabitation { .. }
                | OwnerRequest::CurrentWork { .. }
                | OwnerRequest::AttemptAdmission { .. }
        )
    }
}

/// The owner executable and whether the suite route prefixes `factory` —
/// the same resolution every Factory arm uses.
pub fn owner_executable() -> (PathBuf, bool) {
    match std::env::var_os("OI_FACTORY_BIN").map(PathBuf::from) {
        Some(path) => (path, false),
        None => (
            std::env::var_os("OI_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| "oi".into()),
            true,
        ),
    }
}

/// One Factory owner call's wall-clock bound. Action invocations, commissions
/// and run closes may do real work before answering (no pace is measured);
/// the bound is for an owner that never answers, not a pace.
const OWNER_CALL_LIMIT: std::time::Duration = std::time::Duration::from_secs(300);

/// Run one owner command capturing BOTH streams: the workflow family writes
/// its refusal as a diagnostic document on stdout, so the refusal message is
/// the diagnostic's own words when present, else stderr.
fn owner_call(args: &[std::ffi::OsString], input: Option<&[u8]>) -> Result<Value, Error> {
    owner_call_env(args, input, &[])
}

/// The same, with environment variables the owner's own process is given: the
/// host's native action token, for the one act that reaches Central through
/// Factory (`AttemptReceiving`).
fn owner_call_env(
    args: &[std::ffi::OsString],
    input: Option<&[u8]>,
    env: &[(&str, String)],
) -> Result<Value, Error> {
    let (executable, suite_route) = owner_executable();
    let mut argv: Vec<std::ffi::OsString> = Vec::new();
    if suite_route {
        argv.push("factory".into());
    }
    argv.extend(args.iter().cloned());
    if input.is_none() && is_bounded_owner_read(args) {
        // The bounded reads (inhabitation, telemetry day): a stalled owner is
        // named `timeout`, never a hung panel or a stalled temporal field.
        return bounded_owner_read(&executable, &argv, args);
    }
    // Bounded like every owner call (owner_process.rs): a stuck owner is
    // stopped and named; a write stopped at its limit is uncertain.
    let operation = args
        .iter()
        .map(|arg| arg.to_string_lossy())
        .take_while(|arg| !arg.starts_with('-'))
        .take(2)
        .collect::<Vec<_>>()
        .join(" ");
    let output = crate::owner_process::output(
        std::process::Command::new(&executable)
            .args(&argv)
            .envs(env.iter().map(|(key, value)| (key, value))),
        input.map(<[u8]>::to_vec),
        crate::owner_process::Bound {
            owner: "Software Factory",
            operation: &operation,
            limit: OWNER_CALL_LIMIT,
            effect: crate::owner_process::Effect::Unclassified,
        },
    )
    .map_err(|failure| {
        let (kind, ran) = match failure.failed {
            crate::owner_process::Failed::Unavailable => ("unavailable", false),
            crate::owner_process::Failed::Stopped => ("timeout", true),
            crate::owner_process::Failed::Process => ("process-error", true),
        };
        Error {
            kind: kind.into(),
            message: failure.message,
            operation_may_have_run: ran,
        }
    })?;
    let parsed: Option<Value> = serde_json::from_slice(&output.stdout).ok();
    if !output.status.success() {
        let diagnostic = parsed
            .as_ref()
            .and_then(|value| value.get("error"))
            .and_then(|error| error.get("message"))
            .and_then(Value::as_str)
            .map(str::to_owned);
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(Error {
            kind: "owner-refused-or-failed".into(),
            message: diagnostic.unwrap_or(stderr),
            operation_may_have_run: input.is_some(),
        });
    }
    parsed.ok_or_else(|| incompatible("The owner answered without a JSON document"))
}

fn is_inhabitation_read(args: &[std::ffi::OsString]) -> bool {
    args.first().is_some_and(|verb| verb == "development")
        && args
            .get(1)
            .is_some_and(|read| read == "inhabitation" || read == "current-work")
}

/// `telemetry day <state> …` — the Factory day reading the temporal field joins.
fn is_telemetry_day_read(args: &[std::ffi::OsString]) -> bool {
    args.first().is_some_and(|verb| verb == "telemetry")
        && args.get(1).is_some_and(|read| read == "day")
}

/// The reads the owner bounds: a read-only Factory call with no input, which a
/// stalled owner must never hold open.
fn is_bounded_owner_read(args: &[std::ffi::OsString]) -> bool {
    is_inhabitation_read(args) || is_telemetry_day_read(args)
}

/// Run one bounded read at the inhabitation bound. `args` names the read as
/// the owner's grammar does (`development <read>` or `telemetry <read>`); the
/// stop is named with the same words either way.
fn bounded_owner_read(
    executable: &Path,
    argv: &[std::ffi::OsString],
    args: &[std::ffi::OsString],
) -> Result<Value, Error> {
    bounded_owner_read_with(executable, argv, args, inhabitation_read_timeout())
}

fn bounded_owner_read_with(
    executable: &Path,
    argv: &[std::ffi::OsString],
    args: &[std::ffi::OsString],
    timeout: std::time::Duration,
) -> Result<Value, Error> {
    crate::inhabitation::run_bounded(
        executable,
        argv,
        None,
        timeout,
        &format!(
            "factory {} {}",
            args[0].to_string_lossy(),
            args[1].to_string_lossy()
        ),
    )
}

/// The owner's grammar for the two inhabitation reads (the state path first,
/// as every `factory development` read takes it; typed flags after).
pub fn inhabitation_args(request: &OwnerRequest) -> Option<Vec<std::ffi::OsString>> {
    let (read, state_path, flags): (&str, &Path, Vec<(&str, &str)>) = match request {
        OwnerRequest::Inhabitation {
            state_path,
            run_ref,
            position_ref,
        } => {
            let mut flags = Vec::new();
            if let Some(run) = run_ref {
                flags.push(("--run", run.as_str()));
            }
            if let Some(position) = position_ref {
                flags.push(("--position", position.as_str()));
            }
            ("inhabitation", state_path, flags)
        }
        OwnerRequest::CurrentWork {
            state_path,
            position_ref,
        } => (
            "current-work",
            state_path,
            vec![("--position", position_ref.as_str())],
        ),
        _ => return None,
    };
    debug_assert!(is_development_read(read));
    let mut args: Vec<std::ffi::OsString> =
        vec!["development".into(), read.into(), path_arg(state_path)];
    for (flag, value) in flags {
        args.push(flag.into());
        args.push(value.into());
    }
    args.push("--json".into());
    Some(args)
}

/// A reading's contract id, whether the owner names it `schema` (the
/// inhabitation contract's spelling) or `contract` (Factory's existing one).
fn reading_contract(data: &Value) -> &str {
    data.get("schema")
        .or_else(|| data.get("contract"))
        .and_then(Value::as_str)
        .unwrap_or_default()
}

fn path_arg(path: &Path) -> std::ffi::OsString {
    path.as_os_str().to_string_lossy().into_owned().into()
}

fn expect_contract(data: Value, accepted: &[&str]) -> Result<Value, Error> {
    let contract = reading_contract(&data);
    if accepted.contains(&contract) {
        Ok(data)
    } else {
        Err(incompatible(format!(
            "Factory answered an unexpected contract ({contract})"
        )))
    }
}

fn telemetry_args(
    read: &str,
    state_path: &Path,
    signal_ref: Option<&str>,
    day: Option<&str>,
    from_day: Option<&str>,
    through_day: Option<&str>,
) -> Result<Vec<std::ffi::OsString>, Error> {
    if day.is_some() && (from_day.is_some() || through_day.is_some()) {
        return Err(incompatible("Choose one Day or a named Day range"));
    }
    if from_day.is_some() != through_day.is_some() {
        return Err(incompatible("A Day range needs both endpoints"));
    }
    let mut args: Vec<std::ffi::OsString> =
        vec!["telemetry".into(), read.into(), path_arg(state_path)];
    if let Some(reference) = signal_ref {
        args.push(reference.into());
    }
    if let Some(day) = day {
        args.extend(["--day".into(), day.into()]);
    }
    if let (Some(from), Some(through)) = (from_day, through_day) {
        args.extend([
            "--from-day".into(),
            from.into(),
            "--through-day".into(),
            through.into(),
        ]);
    }
    args.push("--json".into());
    Ok(args)
}

/// The owner's watch grammar with the kernel's bounds applied.
pub fn telemetry_watch_args(
    state_path: &Path,
    resume: Option<&Value>,
    duration_secs: Option<f64>,
    max_events: Option<u32>,
) -> Result<Vec<std::ffi::OsString>, Error> {
    let duration = duration_secs.unwrap_or(2.0);
    if !duration.is_finite() {
        return Err(incompatible(
            "The watch duration must be a finite number of seconds",
        ));
    }
    let duration = duration.clamp(0.0, WATCH_WINDOW_MAX_SECS);
    let max_events = max_events.unwrap_or(100).clamp(1, 500);
    let mut args: Vec<std::ffi::OsString> =
        vec!["telemetry".into(), "watch".into(), path_arg(state_path)];
    if let Some(cursor) = resume {
        if cursor
            .get("stateRevision")
            .and_then(Value::as_u64)
            .is_none()
        {
            return Err(incompatible(
                "A watch cursor must carry the owner's stateRevision",
            ));
        }
        args.extend(["--resume".into(), cursor.to_string().into()]);
    }
    // Poll within the bounded window: never the 2 s default when the window
    // itself is shorter.
    let interval = (duration / 4.0).clamp(0.05, 0.5);
    args.extend([
        "--duration".into(),
        format!("{duration}").into(),
        "--interval".into(),
        format!("{interval}").into(),
        "--max-events".into(),
        max_events.to_string().into(),
        "--json".into(),
    ]);
    Ok(args)
}

/// The longest watch window the kernel allows (the owner's --duration).
pub const WATCH_WINDOW_MAX_SECS: f64 = 4.0;

/// One bounded watch: the owner process is killed if it outlives its own
/// window by more than two seconds. Runs outside the kernel lock (it is a
/// prepared owner read, owner_read.rs).
pub fn telemetry_watch(
    state_path: &Path,
    resume: Option<&Value>,
    duration_secs: Option<f64>,
    max_events: Option<u32>,
    run_ref: Option<&str>,
) -> Result<Value, Error> {
    let args = telemetry_watch_args(state_path, resume, duration_secs, max_events)?;
    let (executable, suite_route) = owner_executable();
    let mut argv: Vec<std::ffi::OsString> = Vec::new();
    if suite_route {
        argv.push("factory".into());
    }
    argv.extend(args);
    let window = duration_secs
        .unwrap_or(2.0)
        .clamp(0.0, WATCH_WINDOW_MAX_SECS);
    let timeout = std::time::Duration::from_secs_f64(window + 2.0);
    let stdout = crate::inhabitation::run_bounded_raw(
        &executable,
        &argv,
        None,
        timeout,
        "factory telemetry watch",
        &[],
    )?;
    watch_reading(&String::from_utf8_lossy(&stdout), run_ref)
}

/// JSONL → one reading: the correlation lines (for `run_ref` when given) and
/// the owner's resume cursor. A stream without its cursor line is refused —
/// the follow could not resume honestly.
pub fn watch_reading(stdout: &str, run_ref: Option<&str>) -> Result<Value, Error> {
    let mut lines = Vec::new();
    let mut cursor = None;
    let mut emitted = None;
    for raw in stdout
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        let line: Value = serde_json::from_str(raw)
            .map_err(|e| incompatible(format!("The owner's watch line is not JSON: {e}")))?;
        match line.get("type").and_then(Value::as_str) {
            Some("cursor") => {
                cursor = line.get("cursor").cloned();
                emitted = line.get("emitted").cloned();
            }
            Some(_) => {
                if run_ref.is_none_or(|run| line.get("runRef").and_then(Value::as_str) == Some(run))
                {
                    lines.push(line);
                }
            }
            None => return Err(incompatible("The owner's watch line names no type")),
        }
    }
    let cursor =
        cursor.ok_or_else(|| incompatible("The owner's watch ended without its resume cursor"))?;
    Ok(serde_json::json!({
        "contract": "oi.factory-telemetry-watch/v1",
        "lines": lines,
        "cursor": cursor,
        "emitted": emitted.unwrap_or(Value::Null),
    }))
}

fn native_sensing_field(state_path: &Path) -> Result<Value, Error> {
    let mut args = telemetry_args("field", state_path, None, None, None, None)?;
    // A Project policy is source, never authority. Pass the canonical JSON
    // carrier when this Factory state is inside a recognised Central root.
    if let Some(root) = state_path.parent().and_then(Path::parent) {
        let project = root.join("ProjectCentral/user/factory-policy.json");
        let control = root.join("Control/user/factory-policy.json");
        if let Some(policy) = [project, control].into_iter().find(|path| path.is_file()) {
            args.splice(
                args.len() - 1..args.len() - 1,
                ["--policy".into(), path_arg(&policy)],
            );
        }
    }
    expect_contract(owner_call(&args, None)?, &["factory.telemetry-field/v1"])
}

// Bind a hot read to the Factory state the caller actually selected. This is
// the owner's persisted source, not a World scan or a second field projection.
// Older states without a sensing scope fall through to the native read below.
fn state_sensing_world(state_path: &Path) -> Result<Option<String>, Error> {
    let bytes = std::fs::read(state_path).map_err(|error| {
        incompatible(format!(
            "Factory state unavailable for sensing scope: {error}"
        ))
    })?;
    let state: Value = serde_json::from_slice(&bytes).map_err(|error| {
        incompatible(format!(
            "Factory state unreadable for sensing scope: {error}"
        ))
    })?;
    if state["schema"] != "factory.developmental-local-provider/v1" {
        return Ok(None);
    }
    Ok(state["state"]["sensing"]["project_world_ref"]
        .as_str()
        .map(str::to_owned))
}

fn current_sensing_field(state_path: &Path, project_world_ref: &str) -> Result<Value, Error> {
    if project_world_ref != "control:root" && !project_world_ref.starts_with("project:") {
        return Err(incompatible(
            "A ProjectWorld ref is required for the current sensing read",
        ));
    }
    let bound_world = state_sensing_world(state_path)?;
    if bound_world
        .as_deref()
        .is_some_and(|world| world != project_world_ref)
    {
        return Err(incompatible(
            "Factory state belongs to another ProjectWorld",
        ));
    }
    let config = std::env::var_os("OI_REDIS_NOW_CONFIG_FILE")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".aikit/redis-now.json"))
        });
    let mut hot_absence = "AIKit Redis NOW config is not installed".to_owned();
    if let Some(config) = config.filter(|path| path.is_file()) {
        let (executable, suite_route) = crate::inhabitation::aikit_executable();
        let mut args: Vec<std::ffi::OsString> = Vec::new();
        if suite_route {
            args.push("aikit".into());
        }
        args.extend([
            "now-context".into(),
            "factory-sensing".into(),
            "--config-file".into(),
            path_arg(&config),
            "--project-world-ref".into(),
            project_world_ref.into(),
            "--json".into(),
        ]);
        let hot = crate::inhabitation::run_bounded(
            &executable,
            &args,
            None,
            std::time::Duration::from_secs(5),
            "aikit now-context factory-sensing",
        )
        .and_then(|document| {
            crate::inhabitation::unwrap_envelope(document, "aikit now-context factory-sensing")
                .map(|(data, _)| data)
        });
        match hot {
            Ok(data)
                if data["schema"] == "aikit.factory-sensing-reading/v1"
                    && data["project_world_ref"] == project_world_ref =>
            {
                if data["available"] == true {
                    let projection = &data["projection"];
                    let field = &projection["field"];
                    let now_ms = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|t| t.as_millis() as u64)
                        .unwrap_or(0);
                    let published = projection["published_at_unix_ms"].as_u64().unwrap_or(0);
                    let observed = field["observed_at_unix_ms"].as_u64().unwrap_or(0);
                    if projection["schema"] == "aikit.factory-sensing-projection/v1"
                        && projection["project_world_ref"] == project_world_ref
                        && field["schema"] == "factory.telemetry-field/v1"
                        && field["project_world_ref"] == project_world_ref
                        && projection["source_revision"] == field["source_revision"]
                        && published <= now_ms.saturating_add(30_000)
                        && observed <= published.saturating_add(30_000)
                        // The saved field Routine runs every five minutes.
                        // One minute of scheduling grace still caps both the
                        // publication and the owner's actual observation age.
                        && now_ms.saturating_sub(published) <= 360_000
                        && now_ms.saturating_sub(observed) <= 360_000
                        && bound_world.as_deref() == Some(project_world_ref)
                    {
                        return Ok(
                            serde_json::json!({"schema":"oi.factory-sensing-current/v1","basis":"aikit-hot","field":field,"published_at_unix_ms":published,"projection_version":projection["version"]}),
                        );
                    }
                    hot_absence = "AIKit hot Factory field was stale or incompatible".into();
                } else {
                    hot_absence = "AIKit has no hot Factory field for this ProjectWorld".into();
                }
            }
            Ok(_) => hot_absence = "AIKit returned an incompatible hot Factory reading".into(),
            Err(error) => hot_absence = error.message,
        }
    }
    let field = native_sensing_field(state_path)?;
    if field["project_world_ref"] != project_world_ref {
        return Err(incompatible(
            "Factory fallback belongs to another ProjectWorld",
        ));
    }
    Ok(
        serde_json::json!({"schema":"oi.factory-sensing-current/v1","basis":"factory-native","field":field,"hot_absence":hot_absence}),
    )
}

/// RFC 3339 UTC for "now", without a date crate (civil-from-days).
pub(crate) fn now_rfc3339() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + if month <= 2 { 1 } else { 0 };
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        rem / 3_600,
        (rem % 3_600) / 60,
        rem % 60
    )
}

/// A stable, unique ref suffix for one person-originated act.
fn act_suffix() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!(
        "{nanos:x}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}

/// The roots discovery reads: Central's own root and its Work projects, from
/// the world reading (`root`, `work.projects[].{name,path}`).
pub(crate) fn locate_roots(
    world: &Value,
    project: Option<&str>,
    all: bool,
) -> Result<Vec<(Option<String>, PathBuf)>, Error> {
    let root = world["root"]
        .as_str()
        .ok_or_else(|| incompatible("Central root location unavailable"))?;
    let root = PathBuf::from(root);
    let projects = world["work"]["projects"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let project_root = |row: &Value| -> Option<(Option<String>, PathBuf)> {
        Some((
            Some(row["name"].as_str()?.to_owned()),
            root.join(row["path"].as_str()?),
        ))
    };
    if all {
        let mut out = vec![(None, root.clone())];
        out.extend(projects.iter().filter_map(project_root));
        return Ok(out);
    }
    match project {
        None => Ok(vec![(None, root)]),
        Some(name) => projects
            .iter()
            .find(|row| row["name"].as_str() == Some(name))
            .and_then(project_root)
            .map(|entry| vec![entry])
            .ok_or_else(|| incompatible("Project is outside Central's disclosed ground")),
    }
}

/// One discovery row per root, each root located concurrently; each answer
/// stands on its own — an absent source (no Factory state set up there) is
/// not a refusal, and one refusal never hides the others.
pub(crate) fn locate_each(roots: Vec<(Option<String>, PathBuf)>) -> Vec<Value> {
    let handles: Vec<_> = roots
        .into_iter()
        .map(|(project, root)| std::thread::spawn(move || locate_row(project, &root)))
        .collect();
    handles
        .into_iter()
        .map(|handle| {
            handle.join().unwrap_or_else(
                |_| serde_json::json!({"state": "refused", "error": "locate worker failed"}),
            )
        })
        .collect()
}

/// `factory project locate <root>`, as one discovery row: `located` with the
/// owner's location, `absent` (no `.factory` there, and the owner says so),
/// or `refused` in the owner's words.
fn locate_row(project: Option<String>, root: &Path) -> Value {
    let args: Vec<std::ffi::OsString> = vec![
        "project".into(),
        "locate".into(),
        path_arg(root),
        "--json".into(),
    ];
    let answer = owner_call(&args, None)
        .and_then(|data| expect_contract(data, &["factory.project-location/v1"]));
    let mut row = serde_json::json!({"project": project, "root": root.to_string_lossy()});
    match answer {
        Ok(location) => {
            row["state"] = "located".into();
            row["location"] = location;
        }
        Err(error) => {
            // A root with no `.factory` directory is simply not a Factory
            // source; one that has it but cannot be located is a refusal the
            // Desk must name (never an empty board).
            let absent = !root.join(".factory").exists()
                && error.message.contains("No such file or directory");
            row["state"] = if absent { "absent" } else { "refused" }.into();
            row["error"] = error.message.into();
        }
    }
    row
}

/// Serve one owner request. `world` is Central's world reading when the
/// request needs roots (see [`OwnerRequest::needs_world`]).
pub fn owner(request: OwnerRequest, world: Option<&Value>) -> Result<Value, Error> {
    match request {
        OwnerRequest::Locate { project, all } => {
            let world = world.ok_or_else(|| {
                incompatible("Central's world reading is required to locate Factory sources")
            })?;
            let roots = locate_roots(world, project.as_deref(), all)?;
            // One locate per root, concurrently; each answer stands on its
            // own — an absent source (no Factory state set up there) is not a
            // refusal, and one refusal never hides the others.
            Ok(serde_json::json!({
                "contract": "oi.factory-source-discovery/v1",
                "locations": locate_each(roots),
            }))
        }
        OwnerRequest::WorkflowInspect {
            state_path,
            run_ref,
            unit,
            attempt,
            limit,
            cursor,
        } => {
            let mut args: Vec<std::ffi::OsString> = vec![
                "workflow".into(),
                "inspect".into(),
                path_arg(&state_path),
                run_ref.into(),
            ];
            if let Some(unit) = unit {
                args.extend(["--unit".into(), unit.into()]);
            }
            if let Some(attempt) = attempt {
                args.extend(["--attempt".into(), attempt.into()]);
            }
            if let Some(limit) = limit {
                args.extend(["--limit".into(), limit.to_string().into()]);
            }
            if let Some(cursor) = cursor {
                args.extend(["--cursor".into(), cursor.to_string().into()]);
            }
            args.push("--json".into());
            expect_contract(
                owner_call(&args, None)?,
                &["factory.workflow-inspection/v1"],
            )
        }
        OwnerRequest::TelemetryStatus { state_path } => {
            let args: Vec<std::ffi::OsString> = vec![
                "telemetry".into(),
                "status".into(),
                path_arg(&state_path),
                "--json".into(),
            ];
            expect_contract(owner_call(&args, None)?, &["factory.telemetry-status/v1"])
        }
        OwnerRequest::TelemetryInspect {
            state_path,
            telemetry_ref,
        } => {
            let args: Vec<std::ffi::OsString> = vec![
                "telemetry".into(),
                "inspect".into(),
                path_arg(&state_path),
                telemetry_ref.into(),
                "--json".into(),
            ];
            let data = owner_call(&args, None)?;
            let contract = data
                .get("contract")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if contract.starts_with("factory.telemetry") {
                Ok(data)
            } else {
                Err(incompatible(
                    "Factory answered an unexpected telemetry contract",
                ))
            }
        }
        OwnerRequest::TelemetryWatch {
            state_path,
            resume,
            duration_secs,
            max_events,
            run_ref,
        } => telemetry_watch(
            &state_path,
            resume.as_ref(),
            duration_secs,
            max_events,
            run_ref.as_deref(),
        ),
        OwnerRequest::TelemetryField { state_path } => native_sensing_field(&state_path),
        OwnerRequest::TelemetryCurrent {
            state_path,
            project_world_ref,
        } => current_sensing_field(&state_path, &project_world_ref),
        OwnerRequest::TelemetrySignal {
            state_path,
            signal_ref,
        } => expect_contract(
            owner_call(
                &telemetry_args("signal", &state_path, Some(&signal_ref), None, None, None)?,
                None,
            )?,
            &["factory.signal-reading/v1"],
        ),
        OwnerRequest::TelemetryDigest { state_path } => expect_contract(
            owner_call(
                &telemetry_args("digest", &state_path, None, None, None, None)?,
                None,
            )?,
            &["factory.telemetry-digest/v1"],
        ),
        OwnerRequest::TelemetryLookback {
            state_path,
            day,
            from_day,
            through_day,
        } => expect_contract(
            owner_call(
                &telemetry_args(
                    "lookback",
                    &state_path,
                    None,
                    day.as_deref(),
                    from_day.as_deref(),
                    through_day.as_deref(),
                )?,
                None,
            )?,
            &["factory.telemetry-lookback/v1"],
        ),
        OwnerRequest::TelemetryDay {
            state_path,
            day,
            from_day,
            through_day,
        } => expect_contract(
            owner_call(
                &telemetry_args(
                    "day",
                    &state_path,
                    None,
                    day.as_deref(),
                    from_day.as_deref(),
                    through_day.as_deref(),
                )?,
                None,
            )?,
            &["factory.telemetry-day/v1"],
        ),
        OwnerRequest::AttemptReturn {
            state_path,
            run_ref,
            attempt_ref,
        } => {
            let args: Vec<std::ffi::OsString> = vec![
                "attempt".into(),
                "return".into(),
                path_arg(&state_path),
                run_ref.into(),
                attempt_ref.into(),
                "--json".into(),
            ];
            let data = owner_call(&args, None)?;
            let contract = data
                .get("contract")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if contract.starts_with("factory.attempt") {
                Ok(data)
            } else {
                Err(incompatible(
                    "Factory answered an unexpected attempt Return contract",
                ))
            }
        }
        OwnerRequest::ActionList {
            state_path,
            project_ref,
            run_ref,
        } => {
            let args: Vec<std::ffi::OsString> = vec![
                "action".into(),
                "list".into(),
                path_arg(&state_path),
                project_ref.into(),
                run_ref.into(),
                "--json".into(),
            ];
            owner_call(&args, None)
        }
        OwnerRequest::ActionInvoke {
            state_path,
            project_ref,
            run_ref,
            request,
        } => {
            let args: Vec<std::ffi::OsString> = vec![
                "action".into(),
                "invoke".into(),
                path_arg(&state_path),
                project_ref.into(),
                run_ref.into(),
                "-".into(),
                "--json".into(),
            ];
            let body = serde_json::to_vec(&request).map_err(|e| incompatible(e.to_string()))?;
            owner_call(&args, Some(&body))
        }
        OwnerRequest::Inhabitation { .. } | OwnerRequest::CurrentWork { .. } => {
            let expected = if matches!(request, OwnerRequest::Inhabitation { .. }) {
                "factory.inhabitation-reading/v1"
            } else {
                "factory.current-work/v1"
            };
            let args =
                inhabitation_args(&request).expect("an inhabitation request builds its grammar");
            let data = owner_call(&args, None)?;
            let contract = reading_contract(&data);
            if contract == expected {
                Ok(data)
            } else {
                Err(incompatible(format!("Factory answered an unexpected reading ({contract}) where {expected} was asked for")))
            }
        }
        OwnerRequest::Recognise {
            state_path,
            journey_ref,
            subject_ref,
            basis_refs,
        } => {
            let suffix = act_suffix();
            let recognition_ref = format!("recognition:desk-{suffix}");
            let mut basis = vec![recognition_ref.clone()];
            basis.extend(
                basis_refs
                    .into_iter()
                    .filter(|entry| entry != &recognition_ref),
            );
            let request = serde_json::json!({
                "contract": "factory.developmental-mutation-request/v1",
                "mutationRef": format!("mutation:desk-recognise-{suffix}"),
                "occurrenceRef": format!("occurrence:desk-recognise-{suffix}"),
                "source": {"owner": "central", "reference": recognition_ref, "revision": "1", "standing": "owner-native-observation"},
                "observedAt": now_rfc3339(),
                "mutation": {
                    "kind": "record-owner-recognition",
                    "journeyRef": journey_ref,
                    // JourneyRecognitionLink carries no serde rename: its fields
                    // are snake_case inside the camelCase mutation envelope.
                    "recognition": {"recognition_ref": recognition_ref, "subject_ref": subject_ref, "basis_refs": basis},
                },
            });
            let body = serde_json::to_vec(&request).map_err(|e| incompatible(e.to_string()))?;
            let args: Vec<std::ffi::OsString> = vec![
                "development".into(),
                "mutate".into(),
                path_arg(&state_path),
                "-".into(),
                "--json".into(),
            ];
            expect_contract(
                owner_call(&args, Some(&body))?,
                &["factory.developmental-mutation-receipt/v1"],
            )
        }
        OwnerRequest::DevelopmentCommission {
            state_path,
            request,
        } => {
            if request["contract"] != "factory.commission-request/v1" {
                return Err(incompatible(
                    "A commission carries a factory.commission-request/v1 document",
                ));
            }
            let body = serde_json::to_vec(&request).map_err(|e| incompatible(e.to_string()))?;
            let args: Vec<std::ffi::OsString> = vec![
                "development".into(),
                "commission".into(),
                path_arg(&state_path),
                "-".into(),
                "--json".into(),
            ];
            expect_contract(
                owner_call(&args, Some(&body))?,
                &["factory.commission-receipt/v1"],
            )
        }
        OwnerRequest::AttemptAdmission {} => expect_contract(
            owner_call(
                &["attempt".into(), "admission".into(), "--json".into()],
                None,
            )?,
            &[receiving::ADMISSION_CONTRACT],
        ),
        OwnerRequest::AttemptReceiving {
            state_path,
            run_ref,
            attempt_ref,
            authority_grant,
        } => {
            let token = host_native_token();
            let contract = authority_contract_for(&state_path);
            let environment: Vec<(&str, String)> = token
                .iter()
                .map(|token| ("CENTRAL_NATIVE_TOKEN", token.as_str().to_owned()))
                .collect();
            let mut read =
                |args: &[std::ffi::OsString], input: Option<&[u8]>| owner_call(args, input);
            let mut receive = |args: &[std::ffi::OsString], input: Option<&[u8]>| {
                owner_call_env(args, input, &environment)
            };
            Ok(receiving::attempt_receiving(
                &mut read,
                &mut receive,
                &state_path,
                &run_ref,
                &attempt_ref,
                receiving::ReceivingAuthority {
                    grant: authority_grant,
                    token,
                    contract: contract.as_deref(),
                    now_unix_seconds: now_unix_seconds(),
                    central_binary: std::env::var_os("OI_CENTRAL_CTRL_BIN").map(PathBuf::from),
                },
            ))
        }
        OwnerRequest::RunClose {
            state_path,
            run_ref,
            recognition_ref,
            next_unit,
            authority_grant,
        } => {
            let mut call =
                |args: &[std::ffi::OsString], input: Option<&[u8]>| owner_call(args, input);
            let contract = authority_contract_for(&state_path);
            let authority = CloseAuthority {
                grant: authority_grant,
                token: host_native_token(),
                contract: contract.as_deref(),
                now_unix_seconds: now_unix_seconds(),
            };
            Ok(run_close(
                &mut call,
                &state_path,
                &run_ref,
                &recognition_ref,
                next_unit,
                authority,
            ))
        }
    }
}

// ---------------------------------------------------------------------------
// T-FACTORY-2b: the Run's own lifecycle close. The owner's lifecycle moves
// (TransitionRun, attempt_runtime.rs) are reached through the owner's attempt
// action path, `factory attempt action <state> -`. The driver sequences them in
// the owner's legal order, each with a deterministic command id and projection
// (an exact replay is the owner's AlreadyApplied, never a second transition),
// stops at the first refusal, and returns every owner receipt or refusal
// verbatim. The owner decides; this driver only sequences and reads.
// ---------------------------------------------------------------------------

pub const RUN_CLOSE_CONTRACT: &str = "oi.factory-run-close/v1";
const ATTEMPT_ACTION_CONTRACT: &str = "factory.attempt-action/v1";
const ATTEMPT_CAPABILITY_REF: &str = "capability/factory/operate-attempt";
const DESK_CALLER_REF: &str = "oi:desk-run-close";
/// The refusal the desk shows when no native action authority grants the close.
const NO_GRANT_REFUSAL: &str = "No native action authority grants the Factory Run close to this desk; the close waits for that grant (Control/user/native-action-authority.json).";
/// Bounds the lifecycle walk: the longest legal path is three moves.
const CLOSE_MAX_STEPS: usize = 4;

/// One owner call behind a seam: the owner CLI in production, a scripted owner
/// in the tests.
pub type OwnerCall<'a> =
    dyn FnMut(&[std::ffi::OsString], Option<&[u8]>) -> Result<Value, Error> + 'a;

/// The owner's write authority over one Run (its `RunMutationAuthority`): the
/// owner and epoch a TransitionRun must name.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RunWriteAuthority {
    pub owner: String,
    pub epoch: u64,
}

/// The lifecycle moves still required on the way to Finished, in the owner's
/// legal order (core/run/model.rs legal_lifecycle_transition): Seeded → Active →
/// Finishing → Finished; Finishing is entered only from Active.
pub fn finish_path(lifecycle: &str) -> Result<&'static [&'static str], String> {
    match lifecycle {
        "seeded" => Ok(&["active", "finishing", "finished"]),
        "active" => Ok(&["finishing", "finished"]),
        "finishing" => Ok(&["finished"]),
        "finished" | "archived" => Ok(&[]),
        other => Err(format!(
            "The Run is {other}; it can be closed only from seeded, active or finishing."
        )),
    }
}

/// The owner's TransitionRun document for the attempt action path. Every ref is
/// derived from the Run, the target and the revisions read, so an exact replay
/// is the same document and the owner answers it from its stored receipt.
pub fn transition_request(
    run_ref: &str,
    target: &str,
    attempt_revision: u64,
    run_revision: u64,
    authority: &RunWriteAuthority,
    closure: Option<Value>,
    grant: &str,
) -> Value {
    let command_id = format!("command:run-close:{run_ref}:{target}:r{run_revision}");
    let mut operation = serde_json::json!({
        "operation": "transition-run",
        "command": {"commandId": command_id, "expectedRevision": run_revision, "lifecycle": target},
        "authority": {"runRef": run_ref, "owner": authority.owner, "epoch": authority.epoch},
    });
    if let Some(closure) = closure {
        operation["closure"] = closure;
    }
    // The grant is the host's native action authority ref, never asserted by
    // this desk: capabilityGranted / actionAuthorised are true only on the
    // path where `grant` was supplied (run_close refuses otherwise).
    serde_json::json!({
        "contract": ATTEMPT_ACTION_CONTRACT,
        "projectionRef": format!("projection:run-close:{run_ref}:{target}:r{run_revision}"),
        "caller": {"callerRef": DESK_CALLER_REF, "projectionKind": "desktop-human", "lineage": [DESK_CALLER_REF]},
        "runRef": run_ref,
        "expectedRevision": attempt_revision,
        "authority": {
            "authorityRef": grant,
            "nativeOwner": "factory",
            "capabilityRef": ATTEMPT_CAPABILITY_REF,
            "capabilityGranted": true,
            "actionAuthorised": true,
        },
        "operation": operation,
    })
}

/// The owner's Run write authority, when the Run reading names it.
fn write_authority(run: &Value) -> Option<RunWriteAuthority> {
    let authority = run.get("writeAuthority")?;
    Some(RunWriteAuthority {
        owner: authority["owner"].as_str()?.to_owned(),
        epoch: authority["epoch"].as_u64()?,
    })
}

/// The closure basis for Finished: the attempt whose Return is linked to a
/// Central receiving receipt. Reviewer attempts are not derived here; the owner
/// refuses a closure that needs them, and that refusal is returned verbatim.
fn finished_closure(attempt: &Value) -> Option<Value> {
    let record = attempt["attempts"]
        .as_array()?
        .iter()
        .rev()
        .find(|record| {
            record["readableReturn"]["receivingRef"]
                .as_str()
                .is_some_and(|receiving| !receiving.trim().is_empty())
        })?;
    Some(serde_json::json!({
        "finalAttemptRef": record["attemptRef"].as_str()?,
        "reviewerAttemptRefs": [],
        "receivingRef": record["readableReturn"]["receivingRef"].as_str()?,
    }))
}

/// The owner's receipt names the revision it moved from. A receipt whose
/// previous revision is not the one this step read is an earlier application
/// that the owner answered from its stored receipt.
fn step_status(receipt: &Value, read_revision: u64) -> &'static str {
    if receipt["previousRevision"].as_u64() == Some(read_revision) {
        "applied"
    } else {
        "already-applied"
    }
}

fn refusal(source: &str, step: Option<&str>, message: impl ToString) -> Value {
    serde_json::json!({"source": source, "step": step, "message": message.to_string()})
}

fn read_owner(
    call: &mut OwnerCall<'_>,
    verb: [&str; 2],
    state_path: &Path,
    run_ref: &str,
) -> Result<Value, Error> {
    let args: Vec<std::ffi::OsString> = verb
        .iter()
        .map(|word| std::ffi::OsString::from(*word))
        .chain([
            path_arg(state_path),
            std::ffi::OsString::from(run_ref),
            std::ffi::OsString::from("--json"),
        ])
        .collect();
    call(&args, None)
}

/// The Run's reading and the attempt reading, read together: the owner's
/// lifecycle and revision, and the attempts' Return links.
fn read_state(
    call: &mut OwnerCall<'_>,
    state_path: &Path,
    run_ref: &str,
) -> Result<(Value, Value), Error> {
    let run = read_owner(call, ["development", "run"], state_path, run_ref)?;
    let attempt = read_owner(call, ["attempt", "read"], state_path, run_ref)?;
    Ok((run, attempt))
}

/// One attempt action through the owner, with the document carried verbatim.
fn action_call(call: &mut OwnerCall<'_>, state_path: &Path, body: &Value) -> Result<Value, Error> {
    let bytes = serde_json::to_vec(body).map_err(|e| incompatible(e.to_string()))?;
    let args: Vec<std::ffi::OsString> = vec![
        "attempt".into(),
        "action".into(),
        path_arg(state_path),
        "-".into(),
        "--json".into(),
    ];
    let receipt = call(&args, Some(&bytes))?;
    if receipt["contract"] != ATTEMPT_ACTION_CONTRACT {
        return Err(incompatible(
            "Factory answered an unexpected attempt action receipt",
        ));
    }
    Ok(receipt)
}

/// The Central contract that names the native action grants.
const AUTHORITY_CONTRACT_REL: &str = "Control/user/native-action-authority.json";
const AUTHORITY_CONTRACT_SCHEMA: &str = "central.native-action-authority/v1";
/// The grant ref the host passes: `central:native-action-authority#<principal_ref>`.
const AUTHORITY_GRANT_PREFIX: &str = "central:native-action-authority#";
/// What a grant must list for this close, and the scope it must cover.
const RUN_CLOSE_ACTION: &str = "factory.run.close";
const RUN_CLOSE_SCOPE: &str = "project:Factory";

/// What a grant must carry for one native action: the action it lists, the
/// scope it covers and, when the act is a particular kind of actor's, that
/// kind.
pub(crate) struct Wanted<'a> {
    pub action: &'a str,
    pub scope: &'a str,
    pub actor_kind: Option<&'a str>,
}

const RUN_CLOSE: Wanted<'static> = Wanted {
    action: RUN_CLOSE_ACTION,
    scope: RUN_CLOSE_SCOPE,
    actor_kind: None,
};

#[path = "factory_receiving.rs"]
mod receiving;

/// The host's native action authority for one close: the grant ref and token
/// it holds, the contract the grant resolves against, and the reading clock.
pub struct CloseAuthority<'a> {
    pub grant: Option<String>,
    pub token: Option<AuthorityToken>,
    /// `None` when no Central contract is found above the Factory state.
    pub contract: Option<&'a Path>,
    pub now_unix_seconds: u64,
}

/// The authority contract for a Factory state: the host's `OI_CENTRAL_ROOT`
/// when set, else the nearest ancestor of the state that carries
/// `Control/user/native-action-authority.json` (a project state sits under
/// `Work/<Name>/.factory/`, so the Central root is above it).
pub fn authority_contract_for(state_path: &Path) -> Option<PathBuf> {
    authority_under(
        state_path,
        std::env::var_os("OI_CENTRAL_ROOT").map(PathBuf::from),
    )
}

fn authority_under(state_path: &Path, central_root: Option<PathBuf>) -> Option<PathBuf> {
    if let Some(root) = central_root {
        return Some(root.join(AUTHORITY_CONTRACT_REL));
    }
    state_path
        .ancestors()
        .map(|dir| dir.join(AUTHORITY_CONTRACT_REL))
        .find(|path| path.is_file())
}

/// The token the native host holds for Central's native actions: the host's
/// `CENTRAL_NATIVE_TOKEN`, else `~/.central/native-token` (owner-rotatable).
/// Read here, in the native process — never supplied by the desk.
pub(crate) fn host_native_token() -> Option<AuthorityToken> {
    host_native_token_from(
        std::env::var("CENTRAL_NATIVE_TOKEN").ok(),
        std::env::var_os("HOME").map(PathBuf::from),
    )
}

fn host_native_token_from(env: Option<String>, home: Option<PathBuf>) -> Option<AuthorityToken> {
    let token = env
        .filter(|token| !token.trim().is_empty())
        .or_else(|| std::fs::read_to_string(home?.join(".central/native-token")).ok())?;
    let token = token.trim();
    (!token.is_empty()).then(|| AuthorityToken(token.to_owned()))
}

pub(crate) fn now_unix_seconds() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}

/// The lowercase hex sha256 of a token, as the contract records it.
pub(crate) fn token_sha256(token: &str) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(token.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Whether the host's grant authorises this close, resolved against the
/// contract document. Returns the refusal reason, or `None` when the grant
/// exists, its token matches, it lists the close, covers the Factory scope and
/// has not expired. The token is compared, never echoed.
pub(crate) fn grant_refusal(
    contract: &Value,
    grant: &str,
    token: Option<&AuthorityToken>,
    now_unix_seconds: u64,
    wanted: &Wanted<'_>,
) -> Option<String> {
    if contract["schema"] != AUTHORITY_CONTRACT_SCHEMA {
        return Some(format!(
            "The native action authority contract is not {AUTHORITY_CONTRACT_SCHEMA}; the close cannot resolve its grant."
        ));
    }
    let principal = grant
        .strip_prefix(AUTHORITY_GRANT_PREFIX)
        .filter(|principal| !principal.trim().is_empty());
    let entry = principal.and_then(|principal| {
        contract["grants"]
            .as_array()?
            .iter()
            .find(|entry| entry["principal_ref"].as_str() == Some(principal))
    });
    let Some(entry) = entry else {
        return Some(format!(
            "unknown grant: no native action authority grant in the contract names {grant}."
        ));
    };
    let presented = token.map(|token| token_sha256(token.as_str()));
    let matches = matches!((presented.as_deref(), entry["token_sha256"].as_str()),
        (Some(presented), Some(recorded)) if presented.eq_ignore_ascii_case(recorded));
    if !matches {
        return Some(
            "token mismatch: the token the close carries does not match the grant's token_sha256."
                .into(),
        );
    }
    if let Some(kind) = wanted.actor_kind {
        if entry["actor_kind"].as_str() != Some(kind) {
            return Some(format!(
                "actor not granted: the grant is not a {kind} principal's."
            ));
        }
    }
    let lists_action = entry["actions"]
        .as_array()
        .is_some_and(|actions| actions.iter().any(|action| action == wanted.action));
    if !lists_action {
        return Some(format!(
            "action not granted: the grant does not list {}.",
            wanted.action
        ));
    }
    let covers_scope = entry["scope_refs"]
        .as_array()
        .is_some_and(|scopes| scopes.iter().any(|scope| scope == wanted.scope));
    if !covers_scope {
        return Some(format!(
            "scope not granted: the grant does not cover {}.",
            wanted.scope
        ));
    }
    match entry["expires_at_unix_seconds"].as_u64() {
        Some(expires) if now_unix_seconds < expires => None,
        Some(expires) => Some(format!(
            "expired: the grant expired at {expires} unix seconds."
        )),
        None => Some("expired: the grant names no expiry, so it cannot authorise a close.".into()),
    }
}

/// The grant gate for a close: the contract is read and the grant resolved
/// against it. A contract that cannot be read refuses the same way.
fn close_grant_refusal(authority: &CloseAuthority<'_>, grant: &str) -> Option<String> {
    match read_authority_contract(authority.contract) {
        Ok(contract) => grant_refusal(
            &contract,
            grant,
            authority.token.as_ref(),
            authority.now_unix_seconds,
            &RUN_CLOSE,
        ),
        Err(reason) => Some(reason),
    }
}

/// The native action authority contract, read from where the host's lookup
/// found it; the refusal names why it could not be.
pub(crate) fn read_authority_contract(path: Option<&Path>) -> Result<Value, String> {
    let Some(path) = path else {
        return Err(
            "The native action authority contract is not found above this Factory state, so the grant cannot be resolved."
                .into(),
        );
    };
    std::fs::read(path)
        .map_err(|error| error.to_string())
        .and_then(|bytes| serde_json::from_slice(&bytes).map_err(|error| error.to_string()))
        .map_err(|error| format!("The native action authority contract cannot be read: {error}."))
}

/// The grant ref of the one principal of the given kind whose token is the
/// host's: the host presents the grant it holds, resolved from its own
/// token, rather than a ref the desk names. None when no principal, or more
/// than one, holds it.
pub(crate) fn grant_held_by(
    contract: &Value,
    token: &AuthorityToken,
    actor_kind: &str,
) -> Option<String> {
    let presented = token_sha256(token.as_str());
    let mut held = contract["grants"].as_array()?.iter().filter(|entry| {
        entry["actor_kind"].as_str() == Some(actor_kind)
            && entry["token_sha256"]
                .as_str()
                .is_some_and(|recorded| recorded.eq_ignore_ascii_case(&presented))
    });
    let first = held.next()?;
    if held.next().is_some() {
        return None;
    }
    Some(format!(
        "{AUTHORITY_GRANT_PREFIX}{}",
        first["principal_ref"].as_str()?
    ))
}

/// Close a Run's own lifecycle after the person's Recognition. Returns the
/// close document: `finished` (moves made to Finished), `already-finished` (no
/// move needed), `next-unit-started`, or `refused` with the owner's (or the
/// driver's own, named as such) refusal verbatim. A refusal leaves the Run where
/// the owner says it is.
pub fn run_close(
    call: &mut OwnerCall<'_>,
    state_path: &Path,
    run_ref: &str,
    recognition_ref: &str,
    next_unit: Option<Value>,
    authority: CloseAuthority<'_>,
) -> Value {
    let envelope = |status: &str, lifecycle: Value, steps: Vec<Value>, refusal: Value| {
        serde_json::json!({
            "contract": RUN_CLOSE_CONTRACT,
            "runRef": run_ref,
            "recognitionRef": recognition_ref,
            "status": status,
            "lifecycle": lifecycle,
            "steps": steps,
            "refusal": refusal,
        })
    };
    if run_ref.trim().is_empty() || recognition_ref.trim().is_empty() {
        return envelope(
            "refused",
            Value::Null,
            vec![],
            refusal(
                "driver",
                None,
                "A close names the exact Run and the Recognition it follows.",
            ),
        );
    }
    // The grant gate comes before any owner call: no grant, no move. A grant
    // must resolve against Central's contract (exists, token, action, scope,
    // expiry); anything else refuses with the reason named.
    let grant = match authority
        .grant
        .clone()
        .filter(|grant| !grant.trim().is_empty())
    {
        Some(grant) => grant,
        None => {
            return envelope(
                "refused",
                Value::Null,
                vec![],
                refusal("driver", None, NO_GRANT_REFUSAL),
            )
        }
    };
    if let Some(reason) = close_grant_refusal(&authority, &grant) {
        return envelope(
            "refused",
            Value::Null,
            vec![],
            refusal("driver", None, reason),
        );
    }
    let mut steps: Vec<Value> = Vec::new();

    if let Some(unit) = next_unit {
        if unit["runRef"] != run_ref {
            return envelope(
                "refused",
                Value::Null,
                steps,
                refusal(
                    "driver",
                    None,
                    "The next serial unit names another Run than this close.",
                ),
            );
        }
        if unit["authority"]["authorityRef"] != grant.as_str() {
            return envelope(
                "refused",
                Value::Null,
                steps,
                refusal(
                    "driver",
                    None,
                    "The next serial unit names another authority grant than this close.",
                ),
            );
        }
        if unit["contract"] != ATTEMPT_ACTION_CONTRACT
            || unit["operation"]["operation"] != "start-serial"
        {
            return envelope(
                "refused",
                Value::Null,
                steps,
                refusal(
                    "driver",
                    None,
                    "A next serial unit is the owner's start-serial document; no other move is carried here.",
                ),
            );
        }
        let (run, attempt) = match read_state(call, state_path, run_ref) {
            Ok(pair) => pair,
            Err(error) => {
                return envelope(
                    "refused",
                    Value::Null,
                    steps,
                    refusal("owner", None, error.message),
                )
            }
        };
        let lifecycle = run["lifecycle"].clone();
        let read_revision = attempt["revision"].as_u64().unwrap_or_default();
        return match action_call(call, state_path, &unit) {
            Ok(receipt) => {
                steps.push(serde_json::json!({
                    "target": "start-serial",
                    "status": step_status(&receipt, read_revision),
                    "receipt": receipt,
                }));
                envelope("next-unit-started", lifecycle, steps, Value::Null)
            }
            Err(error) => envelope(
                "refused",
                lifecycle,
                steps,
                refusal("owner", Some("start-serial"), error.message),
            ),
        };
    }

    for _ in 0..CLOSE_MAX_STEPS {
        let (run, attempt) = match read_state(call, state_path, run_ref) {
            Ok(pair) => pair,
            Err(error) => {
                return envelope(
                    "refused",
                    Value::Null,
                    steps,
                    refusal("owner", None, error.message),
                )
            }
        };
        let lifecycle = run["lifecycle"].as_str().unwrap_or_default().to_owned();
        let path = match finish_path(&lifecycle) {
            Ok(path) => path,
            Err(message) => {
                return envelope(
                    "refused",
                    Value::String(lifecycle),
                    steps,
                    refusal("driver", None, message),
                )
            }
        };
        let Some(target) = path.first().copied() else {
            break;
        };
        // Owner change required (recorded here; factory/src is under another
        // agent's zone claim and is not edited): factory.run-reading/v1
        // (FactoryRunReading, developmental_read.rs run_reading) must carry
        // writeAuthority {runRef, owner, epoch} from the Run's write_authority
        // (core/run/model.rs, Run::write_authority). The TransitionRun authority
        // is addressed from that field and from nothing else.
        let Some(authority) = write_authority(&run) else {
            return envelope(
                "refused",
                Value::String(lifecycle),
                steps,
                refusal(
                    "driver",
                    Some(target),
                    "Factory's Run reading names no write authority (owner, epoch), so the owner's transition cannot be addressed.",
                ),
            );
        };
        let (Some(run_revision), Some(attempt_revision)) =
            (run["revision"].as_u64(), attempt["revision"].as_u64())
        else {
            return envelope(
                "refused",
                Value::String(lifecycle),
                steps,
                refusal(
                    "driver",
                    Some(target),
                    "Factory's readings carry no revision.",
                ),
            );
        };
        let closure = if target == "finished" {
            match finished_closure(&attempt) {
                Some(closure) => Some(closure),
                None => {
                    return envelope(
                        "refused",
                        Value::String(lifecycle),
                        steps,
                        refusal(
                            "driver",
                            Some(target),
                            "The Run's final Return has no receiving linked. Submit the Return to Central receiving, then close the Run.",
                        ),
                    )
                }
            }
        } else {
            None
        };
        let body = transition_request(
            run_ref,
            target,
            attempt_revision,
            run_revision,
            &authority,
            closure,
            &grant,
        );
        match action_call(call, state_path, &body) {
            Ok(receipt) => steps.push(serde_json::json!({
                "target": target,
                "status": step_status(&receipt, attempt_revision),
                "commandId": body["operation"]["command"]["commandId"],
                "receipt": receipt,
            })),
            Err(error) => {
                return envelope(
                    "refused",
                    Value::String(lifecycle),
                    steps,
                    refusal("owner", Some(target), error.message),
                )
            }
        }
    }

    // Finished only when the owner's own reading says so: a walk that ran out
    // of steps, or a final reading that fails, is not a finished Run.
    let lifecycle = match read_state(call, state_path, run_ref) {
        Ok((run, _)) => run["lifecycle"].as_str().map(str::to_owned),
        Err(error) => {
            return envelope(
                "refused",
                Value::Null,
                steps,
                refusal(
                    "driver",
                    None,
                    format!("Factory's final reading of the Run failed, so the close cannot confirm where it stands: {}", error.message),
                ),
            )
        }
    };
    match lifecycle.as_deref() {
        Some(lifecycle @ ("finished" | "archived")) => {
            let status = if steps.is_empty() {
                "already-finished"
            } else {
                "finished"
            };
            envelope(status, Value::String(lifecycle.to_owned()), steps, Value::Null)
        }
        Some(lifecycle) => {
            let message = format!(
                "The Run is {lifecycle} after {} owner move(s); the close needs it finished or archived, so the close stops here.",
                steps.len()
            );
            envelope(
                "refused",
                Value::String(lifecycle.to_owned()),
                steps,
                refusal("driver", None, message),
            )
        }
        None => envelope(
            "refused",
            Value::Null,
            steps,
            refusal(
                "driver",
                None,
                "Factory's final reading names no lifecycle, so the close cannot confirm where the Run stands.",
            ),
        ),
    }
}

#[cfg(test)]
mod owner_tests {
    use super::*;

    fn telemetry_day_args() -> Vec<std::ffi::OsString> {
        vec![
            "telemetry".into(),
            "day".into(),
            "/fixture/state.json".into(),
            "--day".into(),
            "2026-10-08".into(),
            "--json".into(),
        ]
    }

    #[test]
    fn the_telemetry_day_read_is_bounded_like_the_inhabitation_reads() {
        assert!(is_bounded_owner_read(&telemetry_day_args()));
        assert!(is_bounded_owner_read(&[
            "development".into(),
            "inhabitation".into(),
        ]));
        // Other telemetry reads keep their own (unchanged) call.
        assert!(!is_bounded_owner_read(&[
            "telemetry".into(),
            "status".into(),
        ]));

        // A stalled owner is named `timeout` at the bound, and the call
        // returns: `/bin/sleep` stands in for an owner that never answers.
        let started = std::time::Instant::now();
        let error = bounded_owner_read_with(
            Path::new("/bin/sleep"),
            &["30".into()],
            &telemetry_day_args(),
            std::time::Duration::from_millis(300),
        )
        .unwrap_err();
        assert_eq!(error.kind, "timeout", "{error:?}");
        assert!(
            error
                .message
                .contains("factory telemetry day did not answer within 300 ms"),
            "{error:?}"
        );
        assert!(!error.operation_may_have_run);
        assert!(started.elapsed() < std::time::Duration::from_secs(10));
    }

    #[test]
    fn a_commission_carries_only_a_factory_commission_request() {
        let wire: OwnerRequest = serde_json::from_value(serde_json::json!({
            "kind":"development-commission","state_path":"/ground/.factory/development-state.json",
            "request":{"contract":"factory.developmental-mutation-request/v1"}}))
        .unwrap();
        let error = owner(wire, None).unwrap_err();
        assert!(
            format!("{error:?}").contains("factory.commission-request/v1"),
            "{error:?}"
        );
    }

    #[test]
    fn rfc3339_is_well_formed() {
        let stamp = now_rfc3339();
        assert_eq!(stamp.len(), 20, "{stamp}");
        assert!(stamp.ends_with('Z') && stamp.as_bytes()[10] == b'T');
        assert!(stamp.starts_with("20"));
    }

    #[test]
    fn locate_roots_follow_centrals_world_reading() {
        let world = serde_json::json!({"root": "/ground", "work": {"projects": [{"name": "A", "path": "Work/A"}, {"name": "B", "path": "Work/B"}]}});
        let all = locate_roots(&world, None, true).unwrap();
        assert_eq!(all.len(), 3);
        assert_eq!(all[0], (None, PathBuf::from("/ground")));
        assert_eq!(all[2], (Some("B".into()), PathBuf::from("/ground/Work/B")));
        assert_eq!(
            locate_roots(&world, Some("A"), false).unwrap(),
            vec![(Some("A".into()), PathBuf::from("/ground/Work/A"))]
        );
        assert_eq!(
            locate_roots(&world, None, false).unwrap(),
            vec![(None, PathBuf::from("/ground"))]
        );
        assert!(
            locate_roots(&world, Some("Z"), false).is_err(),
            "a project outside the ground is refused"
        );
    }

    #[test]
    fn inhabitation_reads_follow_the_owner_grammar_and_the_allowlist() {
        let request = OwnerRequest::Inhabitation {
            state_path: "/s.json".into(),
            run_ref: Some("run:1".into()),
            position_ref: None,
        };
        let args: Vec<String> = inhabitation_args(&request)
            .unwrap()
            .into_iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert_eq!(
            args,
            [
                "development",
                "inhabitation",
                "/s.json",
                "--run",
                "run:1",
                "--json"
            ]
        );
        let request = OwnerRequest::CurrentWork {
            state_path: "/s.json".into(),
            position_ref: "central:position:project:O-I:oi-root-agency".into(),
        };
        let args: Vec<String> = inhabitation_args(&request)
            .unwrap()
            .into_iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert_eq!(
            args,
            [
                "development",
                "current-work",
                "/s.json",
                "--position",
                "central:position:project:O-I:oi-root-agency",
                "--json"
            ]
        );
        assert!(inhabitation_args(&OwnerRequest::TelemetryStatus {
            state_path: "/s.json".into()
        })
        .is_none());
        assert!(
            is_development_read("inhabitation")
                && is_development_read("current-work")
                && is_development_read("run")
        );
        assert!(
            !is_development_read("mutate") && !is_development_read("custody"),
            "a mutation or an unlisted verb is never a read"
        );
        let wire: OwnerRequest = serde_json::from_value(serde_json::json!({"kind": "current-work", "state_path": "/s.json", "position_ref": "p"})).unwrap();
        assert!(matches!(wire, OwnerRequest::CurrentWork { .. }));
        assert_eq!(
            reading_contract(&serde_json::json!({"schema": "factory.current-work/v1"})),
            "factory.current-work/v1"
        );
        assert_eq!(
            reading_contract(&serde_json::json!({"contract": "factory.inhabitation-reading/v1"})),
            "factory.inhabitation-reading/v1"
        );
    }

    #[test]
    fn telemetry_watch_is_bounded_and_resumable() {
        let args = telemetry_watch_args(
            Path::new("/s.json"),
            Some(&serde_json::json!({"stateRevision": 21})),
            Some(60.0),
            Some(9000),
        )
        .unwrap();
        let words: Vec<String> = args
            .iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert_eq!(&words[..3], &["telemetry", "watch", "/s.json"]);
        assert_eq!(
            words[words.iter().position(|w| w == "--resume").unwrap() + 1],
            r#"{"stateRevision":21}"#
        );
        assert_eq!(
            words[words.iter().position(|w| w == "--duration").unwrap() + 1],
            "4"
        );
        assert_eq!(
            words[words.iter().position(|w| w == "--max-events").unwrap() + 1],
            "500"
        );
        assert_eq!(words.last().unwrap(), "--json");
        assert!(
            telemetry_watch_args(
                Path::new("/s.json"),
                Some(&serde_json::json!({"revision": 1})),
                None,
                None
            )
            .is_err(),
            "a cursor without the owner's key is refused"
        );
        assert!(telemetry_watch_args(Path::new("/s.json"), None, Some(f64::NAN), None).is_err());
        let wire: OwnerRequest = serde_json::from_value(serde_json::json!({"kind": "telemetry-watch", "state_path": "/s.json", "duration_secs": 1.5, "run_ref": "run:A"})).unwrap();
        assert!(matches!(wire, OwnerRequest::TelemetryWatch { .. }));
    }

    #[test]
    fn watch_reading_filters_to_the_run_and_carries_the_cursor() {
        // The owner's real output (factory telemetry watch on the specimen ground).
        let stdout = concat!(
            r#"{"childNowRef":null,"correlationRef":"execution-correlation:CR01","runRef":"run:A","stateRevision":21,"telemetryRef":"telemetry:TM01","type":"execution-correlation"}"#,
            "\n",
            r#"{"childNowRef":null,"correlationRef":"execution-correlation:CR02","runRef":"run:B","stateRevision":21,"telemetryRef":"telemetry:TM02","type":"execution-correlation"}"#,
            "\n",
            r#"{"cursor":{"stateRevision":21},"emitted":2,"resumeWith":"--resume","type":"cursor"}"#,
        );
        let reading = watch_reading(stdout, Some("run:A")).unwrap();
        assert_eq!(reading["contract"], "oi.factory-telemetry-watch/v1");
        assert_eq!(reading["lines"].as_array().unwrap().len(), 1);
        assert_eq!(reading["cursor"]["stateRevision"], 21);
        assert_eq!(
            watch_reading(stdout, None).unwrap()["lines"]
                .as_array()
                .unwrap()
                .len(),
            2
        );
        assert!(
            watch_reading(r#"{"type":"execution-correlation"}"#, None).is_err(),
            "no cursor line → no honest resume"
        );
    }

    /// The curated Factory Expressions starter material (FX-C4) is ordinary
    /// native Expression material: each document deserialises and passes the
    /// kernel's own document and Scene-material validation, `reuse` block
    /// included.
    #[test]
    fn curated_factory_expression_material_is_valid_native_material() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../material/factory-expressions");
        let mut files = Vec::new();
        for kind in ["character", "scene", "gesture", "expression"] {
            for entry in std::fs::read_dir(root.join(kind)).expect("material directory") {
                let path = entry.unwrap().path();
                if path.to_string_lossy().ends_with(".expression.json") {
                    files.push(path);
                }
            }
        }
        assert!(
            files.len() >= 12,
            "curated material present ({})",
            files.len()
        );
        for path in files {
            let value: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
            assert_eq!(
                value["reuse"]["schema"],
                "oi.expression-reuse/v1",
                "{}",
                path.display()
            );
            let document: crate::expression::Document =
                serde_json::from_value(value).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
            assert!(
                document.reuse.is_some(),
                "{}: the reuse block survives",
                path.display()
            );
            document
                .validate()
                .unwrap_or_else(|e| panic!("{}: {e}", path.display()));
        }
    }

    #[test]
    fn owner_requests_deserialise_from_the_desktop_wire() {
        let request: OwnerRequest = serde_json::from_value(serde_json::json!({"kind": "workflow-inspect", "state_path": "/s.json", "run_ref": "run:1"})).unwrap();
        assert!(matches!(request, OwnerRequest::WorkflowInspect { .. }));
        let request: OwnerRequest =
            serde_json::from_value(serde_json::json!({"kind": "locate", "all": true})).unwrap();
        assert!(request.needs_world());
        let request: OwnerRequest = serde_json::from_value(serde_json::json!({"kind": "development-commission", "state_path": "/s.json", "request": {"contract": "factory.commission/v1"}})).unwrap();
        assert!(matches!(
            request,
            OwnerRequest::DevelopmentCommission { .. }
        ));
    }
}

/// T-FACTORY-2b: the close driver over a scripted owner. The fake reads the
/// same shapes the owner's readings carry, applies TransitionRun / start-serial
/// in the owner's legal order with its revision rules, and answers an exact
/// replay from its stored receipt (the owner's AlreadyApplied).
#[cfg(test)]
mod run_close_tests {
    use super::*;
    use std::collections::BTreeMap;

    struct Fake {
        lifecycle: String,
        run_rev: u64,
        state_rev: u64,
        receiving: bool,
        authority: bool,
        refuse: Option<(String, String)>,
        /// Accepts every transition and moves nothing: the walk runs out of steps.
        stuck: bool,
        /// The Run reading fails once the owner has taken this many moves.
        fail_run_reads_after_moves: Option<usize>,
        applied: BTreeMap<String, Value>,
        actions: Vec<Value>,
        calls: usize,
    }

    impl Fake {
        fn new(lifecycle: &str) -> Self {
            Self {
                lifecycle: lifecycle.into(),
                run_rev: 7,
                state_rev: 40,
                receiving: true,
                authority: true,
                refuse: None,
                stuck: false,
                fail_run_reads_after_moves: None,
                applied: BTreeMap::new(),
                actions: Vec::new(),
                calls: 0,
            }
        }

        fn call(
            &mut self,
            args: &[std::ffi::OsString],
            input: Option<&[u8]>,
        ) -> Result<Value, Error> {
            self.calls += 1;
            let words: Vec<String> = args
                .iter()
                .map(|a| a.to_string_lossy().into_owned())
                .collect();
            match (words[0].as_str(), words[1].as_str()) {
                ("development", "run")
                    if self
                        .fail_run_reads_after_moves
                        .is_some_and(|moves| self.actions.len() >= moves) =>
                {
                    Err(incompatible("Factory's Run reading is unavailable"))
                }
                ("development", "run") => Ok(serde_json::json!({
                    "lifecycle": self.lifecycle,
                    "revision": self.run_rev,
                    "writeAuthority": if self.authority {
                        serde_json::json!({"owner": "factory", "epoch": 1})
                    } else {
                        Value::Null
                    },
                })),
                ("attempt", "read") => Ok(serde_json::json!({
                    "revision": self.state_rev,
                    "attempts": [{
                        "attemptRef": "attempt:A1",
                        "readableReturn": {"receivingRef": if self.receiving { Value::from("receiving:R1") } else { Value::Null }},
                    }],
                })),
                ("attempt", "action") => {
                    let body: Value = serde_json::from_slice(input.unwrap()).unwrap();
                    self.act(body)
                }
                _ => Err(incompatible(format!("unscripted call {words:?}"))),
            }
        }

        fn act(&mut self, body: Value) -> Result<Value, Error> {
            self.actions.push(body.clone());
            let command_id = body["operation"]["command"]["commandId"]
                .as_str()
                .unwrap_or_default()
                .to_owned();
            if let Some(stored) = self.applied.get(&command_id) {
                return Ok(stored.clone());
            }
            let refused = |message: &str| Error {
                kind: "owner-refused-or-failed".into(),
                message: message.into(),
                operation_may_have_run: true,
            };
            if body["expectedRevision"].as_u64() != Some(self.state_rev) {
                return Err(refused("RevisionConflict: the attempt state moved"));
            }
            if body["operation"]["operation"] == "start-serial" {
                let previous = self.state_rev;
                self.state_rev += 1;
                return Ok(
                    serde_json::json!({"contract": ATTEMPT_ACTION_CONTRACT, "previousRevision": previous, "nextRevision": self.state_rev, "operation": "start-serial"}),
                );
            }
            let target = body["operation"]["command"]["lifecycle"]
                .as_str()
                .unwrap_or_default()
                .to_owned();
            if let Some((at, message)) = &self.refuse {
                if at == &target {
                    return Err(refused(message));
                }
            }
            if target == "finished" && !self.receiving {
                return Err(refused("Finished requires live native receiving admission; a public receiving label or observation is not proof"));
            }
            if self.stuck {
                let previous = self.state_rev;
                let receipt = serde_json::json!({
                    "contract": ATTEMPT_ACTION_CONTRACT,
                    "runRef": body["runRef"],
                    "previousRevision": previous,
                    "nextRevision": previous + 1,
                    "operation": "transition-run",
                    "attemptRefs": [],
                    "standing": "scripted owner that moves nothing",
                });
                self.applied.insert(command_id, receipt.clone());
                return Ok(receipt);
            }
            let legal = matches!(
                (self.lifecycle.as_str(), target.as_str()),
                ("seeded", "active") | ("active", "finishing") | ("finishing", "finished")
            );
            if !legal {
                return Err(refused(&format!(
                    "InvalidLifecycleTransition: {} -> {target}",
                    self.lifecycle
                )));
            }
            let previous = self.state_rev;
            self.lifecycle = target.clone();
            self.run_rev += 1;
            self.state_rev += 1;
            let receipt = serde_json::json!({
                "contract": ATTEMPT_ACTION_CONTRACT,
                "runRef": body["runRef"],
                "previousRevision": previous,
                "nextRevision": self.state_rev,
                "operation": "transition-run",
                "attemptRefs": [],
                "standing": "scripted owner",
            });
            self.applied.insert(command_id, receipt.clone());
            Ok(receipt)
        }
    }

    const PRINCIPAL: &str = "central:source:control:root:Control/user/identity";
    const GRANT: &str =
        "central:native-action-authority#central:source:control:root:Control/user/identity";
    const TOKEN: &str = "test-factory-close-token";
    /// A fixed clock: the fixture grant expires after it, never before.
    const NOW: u64 = 1_800_000_000;

    /// A temporary Central contract, removed when the test ends.
    struct TempContract {
        dir: PathBuf,
        path: PathBuf,
    }

    impl TempContract {
        fn new(document: &Value) -> Self {
            static NEXT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
            let index = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            let dir = std::env::temp_dir()
                .join(format!("factory-run-close-{}-{index}", std::process::id()));
            let path = dir.join(AUTHORITY_CONTRACT_REL);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, serde_json::to_vec(document).unwrap()).unwrap();
            Self { dir, path }
        }
    }

    impl Drop for TempContract {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }

    /// The contract the grant is written into: one grant for the close.
    fn grant_document(actions: &[&str], scopes: &[&str], expires: u64) -> Value {
        serde_json::json!({
            "schema": AUTHORITY_CONTRACT_SCHEMA,
            "scope_ref": "control:root",
            "grants": [{
                "principal_ref": PRINCIPAL,
                "actor_kind": "human",
                "token_sha256": token_sha256(TOKEN),
                "scope_refs": scopes,
                "actions": actions,
                "expires_at_unix_seconds": expires,
            }],
        })
    }

    fn valid_document() -> Value {
        grant_document(
            &[RUN_CLOSE_ACTION],
            &["control:root", RUN_CLOSE_SCOPE],
            NOW + 1000,
        )
    }

    fn close_with(
        fake: &mut Fake,
        next: Option<Value>,
        grant: Option<String>,
        token: Option<&str>,
        contract: Option<&Path>,
    ) -> Value {
        run_close(
            &mut |args: &[std::ffi::OsString], input: Option<&[u8]>| fake.call(args, input),
            Path::new("/s.json"),
            "run:A",
            "recognition:R1",
            next,
            CloseAuthority {
                grant,
                token: token.map(|token| AuthorityToken(token.into())),
                contract,
                now_unix_seconds: NOW,
            },
        )
    }

    fn close(fake: &mut Fake, next: Option<Value>) -> Value {
        let contract = TempContract::new(&valid_document());
        close_with(
            fake,
            next,
            Some(GRANT.into()),
            Some(TOKEN),
            Some(&contract.path),
        )
    }

    fn targets(close: &Value) -> Vec<String> {
        close["steps"]
            .as_array()
            .unwrap()
            .iter()
            .map(|step| {
                format!(
                    "{}:{}",
                    step["target"].as_str().unwrap(),
                    step["status"].as_str().unwrap()
                )
            })
            .collect()
    }

    #[test]
    fn an_active_run_finishes_once_through_finishing() {
        let mut fake = Fake::new("active");
        let result = close(&mut fake, None);
        assert_eq!(result["status"], "finished", "{result}");
        assert_eq!(targets(&result), ["finishing:applied", "finished:applied"]);
        assert_eq!(result["lifecycle"], "finished");
        assert_eq!(fake.actions.len(), 2);
        let finished = &fake.actions[1];
        assert_eq!(
            finished["operation"]["closure"]["receivingRef"],
            "receiving:R1"
        );
        assert_eq!(
            finished["operation"]["closure"]["finalAttemptRef"],
            "attempt:A1"
        );
        assert_eq!(finished["operation"]["command"]["expectedRevision"], 8);
        assert_eq!(
            finished["operation"]["command"]["commandId"],
            "command:run-close:run:A:finished:r8"
        );
        assert_eq!(
            finished["authority"]["capabilityRef"],
            ATTEMPT_CAPABILITY_REF
        );
    }

    #[test]
    fn a_seeded_run_walks_active_first_because_the_owner_requires_it() {
        let mut fake = Fake::new("seeded");
        let result = close(&mut fake, None);
        assert_eq!(result["status"], "finished", "{result}");
        assert_eq!(
            targets(&result),
            ["active:applied", "finishing:applied", "finished:applied"]
        );
    }

    #[test]
    fn an_owner_refusal_is_verbatim_and_leaves_the_run_where_the_owner_says() {
        let mut fake = Fake::new("active");
        let message = "Finished requires exact native review and receiving closure basis";
        fake.refuse = Some(("finished".into(), message.into()));
        let result = close(&mut fake, None);
        assert_eq!(result["status"], "refused");
        assert_eq!(result["refusal"]["source"], "owner");
        assert_eq!(result["refusal"]["step"], "finished");
        assert_eq!(result["refusal"]["message"], message);
        assert_eq!(result["lifecycle"], "finishing");
        assert_eq!(fake.lifecycle, "finishing");
        assert_eq!(fake.actions.len(), 2, "no move after the refusal");
    }

    #[test]
    fn a_missing_receiving_is_the_drivers_own_refusal_and_no_finish_is_sent() {
        let mut fake = Fake::new("finishing");
        fake.receiving = false;
        let result = close(&mut fake, None);
        assert_eq!(result["status"], "refused");
        assert_eq!(result["refusal"]["source"], "driver");
        assert_eq!(
            fake.actions.len(),
            0,
            "a finish without a receiving is never sent"
        );
        assert_eq!(fake.lifecycle, "finishing");
    }

    #[test]
    fn a_repeat_close_is_no_second_transition() {
        let mut fake = Fake::new("active");
        close(&mut fake, None);
        let before = fake.actions.len();
        let again = close(&mut fake, None);
        assert_eq!(again["status"], "already-finished", "{again}");
        assert!(again["steps"].as_array().unwrap().is_empty());
        assert_eq!(fake.actions.len(), before, "no owner move on a repeat");
    }

    #[test]
    fn an_exact_replay_is_the_owners_already_applied_with_its_receipt() {
        let mut fake = Fake::new("finishing");
        let first = close(&mut fake, None);
        assert_eq!(targets(&first), ["finished:applied"]);
        let body = fake.actions[0].clone();
        let stored = fake
            .call(
                &[
                    std::ffi::OsString::from("attempt"),
                    std::ffi::OsString::from("action"),
                ],
                Some(&serde_json::to_vec(&body).unwrap()),
            )
            .unwrap();
        assert_eq!(
            stored["previousRevision"], 40,
            "the stored receipt, not a new move"
        );
        assert_eq!(fake.state_rev, 41, "the replay moved nothing");
        assert_eq!(step_status(&stored, 41), "already-applied");
        assert_eq!(step_status(&stored, 40), "applied");
    }

    #[test]
    fn a_run_without_a_write_authority_is_refused_before_any_move() {
        let mut fake = Fake::new("active");
        fake.authority = false;
        let result = close(&mut fake, None);
        assert_eq!(result["status"], "refused");
        assert_eq!(result["refusal"]["source"], "driver");
        assert!(fake.actions.is_empty());
    }

    #[test]
    fn a_next_serial_unit_is_carried_verbatim_and_never_finishes_the_run() {
        let mut fake = Fake::new("active");
        let unit = serde_json::json!({
            "contract": ATTEMPT_ACTION_CONTRACT,
            "runRef": "run:A",
            "expectedRevision": 40,
            "authority": {"authorityRef": GRANT},
            "operation": {"operation": "start-serial", "attemptRef": "attempt:A2"},
        });
        let result = close(&mut fake, Some(unit.clone()));
        assert_eq!(result["status"], "next-unit-started", "{result}");
        assert_eq!(fake.actions, vec![unit]);
        assert_eq!(fake.lifecycle, "active");
    }

    #[test]
    fn the_request_carries_only_the_host_grant_and_is_deterministic() {
        let authority = RunWriteAuthority {
            owner: "factory".into(),
            epoch: 1,
        };
        let a = transition_request("run:A", "finishing", 40, 7, &authority, None, GRANT);
        let b = transition_request("run:A", "finishing", 40, 7, &authority, None, GRANT);
        assert_eq!(a, b, "the same move is the same document");
        assert_eq!(
            a["operation"]["command"]["commandId"],
            "command:run-close:run:A:finishing:r7"
        );
        assert_eq!(
            a["operation"]["authority"],
            serde_json::json!({"runRef": "run:A", "owner": "factory", "epoch": 1})
        );
        assert_eq!(
            a["authority"]["authorityRef"], GRANT,
            "the authority names the host's grant"
        );
        assert_eq!(a["authority"]["capabilityGranted"], true);
        assert_eq!(a["authority"]["actionAuthorised"], true);
        assert!(a["operation"].get("closure").is_none());
    }

    #[test]
    fn no_grant_is_refused_before_any_owner_call() {
        let mut fake = Fake::new("active");
        for grant in [None, Some("  ".to_owned())] {
            let result = close_with(&mut fake, None, grant, Some(TOKEN), None);
            assert_eq!(result["status"], "refused", "{result}");
            assert_eq!(result["refusal"]["source"], "driver");
            assert_eq!(
                result["refusal"]["message"],
                "No native action authority grants the Factory Run close to this desk; the close waits for that grant (Control/user/native-action-authority.json)."
            );
        }
        assert_eq!(fake.calls, 0, "no owner call without a grant");
        assert!(fake.actions.is_empty());
        assert_eq!(fake.lifecycle, "active");
    }

    #[test]
    fn the_walk_names_each_legal_path_and_refuses_the_rest() {
        assert_eq!(
            finish_path("seeded").unwrap(),
            ["active", "finishing", "finished"]
        );
        assert_eq!(finish_path("active").unwrap(), ["finishing", "finished"]);
        assert_eq!(finish_path("finishing").unwrap(), ["finished"]);
        assert!(finish_path("finished").unwrap().is_empty());
        assert!(finish_path("aborted").is_err());
        assert!(finish_path("waiting_human").is_err());
    }

    #[test]
    fn a_grant_resolves_against_the_contract_and_each_refusal_is_named() {
        let cases: [(&str, &str, Option<&str>, Value, &str); 7] = [
            (
                "a grant the contract does not name",
                "central:native-action-authority#central:source:other",
                Some(TOKEN),
                valid_document(),
                "unknown grant:",
            ),
            (
                "a grant ref with no principal",
                "central:native-action-authority#",
                Some(TOKEN),
                valid_document(),
                "unknown grant:",
            ),
            (
                "a close that carries no token",
                GRANT,
                None,
                valid_document(),
                "token mismatch:",
            ),
            (
                "a token that is not the grant's",
                GRANT,
                Some("some-other-token"),
                valid_document(),
                "token mismatch:",
            ),
            (
                "a grant that does not list factory.run.close",
                GRANT,
                Some(TOKEN),
                grant_document(
                    &["central.day.ensure"],
                    &["control:root", RUN_CLOSE_SCOPE],
                    NOW + 1000,
                ),
                "action not granted:",
            ),
            (
                "a grant that does not cover project:Factory",
                GRANT,
                Some(TOKEN),
                grant_document(&[RUN_CLOSE_ACTION], &["control:root"], NOW + 1000),
                "scope not granted:",
            ),
            (
                "a grant that has expired",
                GRANT,
                Some(TOKEN),
                grant_document(&[RUN_CLOSE_ACTION], &[RUN_CLOSE_SCOPE], NOW),
                "expired:",
            ),
        ];
        for (name, grant, token, document, reason) in cases {
            let contract = TempContract::new(&document);
            let mut fake = Fake::new("active");
            let result = close_with(
                &mut fake,
                None,
                Some(grant.into()),
                token,
                Some(&contract.path),
            );
            assert_eq!(result["status"], "refused", "{name}: {result}");
            assert_eq!(result["refusal"]["source"], "driver", "{name}");
            let message = result["refusal"]["message"].as_str().unwrap();
            assert!(message.starts_with(reason), "{name}: {message}");
            assert_eq!(
                fake.calls, 0,
                "{name}: no owner call before the grant resolves"
            );
            assert_eq!(fake.lifecycle, "active", "{name}");
            if let Some(token) = token {
                assert!(
                    !result.to_string().contains(token),
                    "{name}: the token is never echoed"
                );
            }
        }
    }

    #[test]
    fn a_grant_whose_contract_is_missing_or_unreadable_is_refused_before_any_move() {
        let base =
            std::env::temp_dir().join(format!("factory-run-close-missing-{}", std::process::id()));
        let missing = base.join("Control/user/native-action-authority.json");
        let mut fake = Fake::new("active");
        let result = close_with(
            &mut fake,
            None,
            Some(GRANT.into()),
            Some(TOKEN),
            Some(&missing),
        );
        assert_eq!(result["refusal"]["source"], "driver");
        assert!(result["refusal"]["message"]
            .as_str()
            .unwrap()
            .starts_with("The native action authority contract cannot be read"));
        let none = close_with(&mut fake, None, Some(GRANT.into()), Some(TOKEN), None);
        assert!(none["refusal"]["message"]
            .as_str()
            .unwrap()
            .starts_with("The native action authority contract is not found"));
        assert_eq!(fake.calls, 0);
        assert!(fake.actions.is_empty());
    }

    #[test]
    fn a_valid_grant_passes_and_the_token_is_never_recorded_or_logged() {
        let mut fake = Fake::new("active");
        let result = close(&mut fake, None);
        assert_eq!(result["status"], "finished", "{result}");
        assert!(!result.to_string().contains(TOKEN), "{result}");
        assert_eq!(fake.actions.len(), 2);
        assert_eq!(fake.actions[0]["authority"]["authorityRef"], GRANT);
        let wire = AuthorityToken(TOKEN.into());
        assert!(
            !format!("{wire:?}").contains(TOKEN),
            "the token's Debug is redacted"
        );
    }

    #[test]
    fn the_host_reads_its_own_token_and_the_desk_cannot_supply_one() {
        let base =
            std::env::temp_dir().join(format!("factory-run-close-token-{}", std::process::id()));
        std::fs::create_dir_all(base.join(".central")).unwrap();
        std::fs::write(base.join(".central/native-token"), "file-token\n").unwrap();
        let read = |env: Option<&str>, home: Option<PathBuf>| {
            host_native_token_from(env.map(str::to_owned), home).map(|token| token.0)
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
        let request: OwnerRequest = serde_json::from_value(serde_json::json!({
            "kind": "run-close", "state_path": "/s.json", "run_ref": "run:A",
            "recognition_ref": "recognition:R1", "authority_grant": GRANT, "authority_token": TOKEN
        }))
        .unwrap();
        assert!(
            !format!("{request:?}").contains(TOKEN),
            "a token on the wire is not read into the request"
        );
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn the_authority_contract_is_the_nearest_central_root_above_the_state() {
        let base =
            std::env::temp_dir().join(format!("factory-run-close-root-{}", std::process::id()));
        let contract = base.join("Central").join(AUTHORITY_CONTRACT_REL);
        std::fs::create_dir_all(contract.parent().unwrap()).unwrap();
        std::fs::write(&contract, "{}").unwrap();
        let state = base.join("Central/Work/O-I/.factory/development-state.json");
        assert_eq!(authority_under(&state, None), Some(contract));
        let pinned = base.join("Pinned");
        assert_eq!(
            authority_under(&state, Some(pinned.clone())),
            Some(pinned.join(AUTHORITY_CONTRACT_REL)),
            "the host's Central root wins"
        );
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn a_next_unit_for_another_run_is_refused_before_any_move() {
        let mut fake = Fake::new("active");
        let unit = serde_json::json!({
            "contract": ATTEMPT_ACTION_CONTRACT,
            "runRef": "run:B",
            "expectedRevision": 40,
            "authority": {"authorityRef": GRANT},
            "operation": {"operation": "start-serial", "attemptRef": "attempt:B2"},
        });
        let result = close(&mut fake, Some(unit));
        assert_eq!(result["status"], "refused", "{result}");
        assert_eq!(result["refusal"]["source"], "driver");
        assert!(fake.actions.is_empty(), "another Run's unit is never sent");
        assert_eq!(fake.lifecycle, "active");
    }

    #[test]
    fn a_walk_that_runs_out_of_steps_is_refused_not_finished() {
        let mut fake = Fake::new("active");
        fake.stuck = true;
        let result = close(&mut fake, None);
        assert_eq!(result["status"], "refused", "{result}");
        assert_eq!(result["refusal"]["source"], "driver");
        assert_eq!(result["lifecycle"], "active");
        assert_eq!(result["steps"].as_array().unwrap().len(), CLOSE_MAX_STEPS);
        assert!(
            result["refusal"]["message"]
                .as_str()
                .unwrap()
                .contains("The Run is active"),
            "{result}"
        );
    }

    #[test]
    fn a_final_reading_that_fails_is_refused_not_finished() {
        let mut fake = Fake::new("active");
        fake.stuck = true;
        fake.fail_run_reads_after_moves = Some(CLOSE_MAX_STEPS);
        let result = close(&mut fake, None);
        assert_eq!(result["status"], "refused", "{result}");
        assert_eq!(result["refusal"]["source"], "driver");
        assert_eq!(result["lifecycle"], Value::Null);
    }

    #[test]
    fn the_desk_wire_names_a_run_close() {
        let wire: OwnerRequest = serde_json::from_value(serde_json::json!({
            "kind": "run-close", "state_path": "/s.json", "run_ref": "run:A", "recognition_ref": "recognition:R1",
        }))
        .unwrap();
        assert!(matches!(
            wire,
            OwnerRequest::RunClose {
                next_unit: None,
                ..
            }
        ));
    }
}
