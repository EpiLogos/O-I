//! Kernel routes to owner commands that already exist (T-COVERAGE §1.2, the
//! DLW build's lane W3): AIKit's gateway writes, its capture inbox, trust,
//! Methods, set packages and wiki shapes; Actuation's readings and its
//! research comparison; Quaternal Logic's M1 engine and integrated scene;
//! Workcell's cross-cell connections and declared machines; and the seat
//! instrument's join and release.
//!
//! Each route runs the owner's OWN command with the owner's own spelling,
//! carries its answer verbatim after a check that it is the answer asked for,
//! and names a refusal in the owner's words. The kernel holds no authority
//! and invents nothing: no fallback, no default reading, no assembled state.
//!
//! - A read never travels as a write: the read routes are prepared owner
//!   reads (owner_read.rs) and move nothing; the write routes are prepared
//!   owner writes (owner_write.rs), which move the read model whatever the
//!   owner answered and record an `owner_changed` receipt where the owner's
//!   answer says something moved (`Written::moved`).
//! - Every owner process goes through the owner-process limiter
//!   (owner_process.rs `output`) with a wall-clock bound; a write stopped at
//!   its bound is named uncertain. A missing owner is `unavailable` — an
//!   absence, never an error dressed as a reading.
//! - The desktop is not an occupant: a Position travels only as the explicit
//!   field the person chose, never from the kernel's own environment
//!   (`OI_POSITION_REF` and `OI_OCCUPANT_GENERATION` are removed from every
//!   child, as inhabitation.rs does).
//! - A secret never crosses: no route carries a token or an authorization;
//!   Workcell's connect names a declared machine whose credential reference
//!   the owner resolves itself.
use crate::material::Error;
use crate::owner_process::{Bound, Effect, Failed};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/// AIKit's gateway writes (`aikit gateway send|delegate`). `project` is the
/// Central project NAME in scope: Central discloses its working directory and
/// canonical Project World, never the caller. `at` routes through the
/// gateway AIKit declares for that remote Workcell (`aikit gateway remote
/// list`), carried as the owner spells it.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum GatewayWrite {
    /// Address a Communique to a Position (`aikit gateway send --to P
    /// --body-file -`): the words go on stdin, never on the command line.
    Send {
        #[serde(default)]
        project: Option<String>,
        to: String,
        body: String,
        #[serde(default)]
        reply_to: Option<String>,
        #[serde(default)]
        from_position: Option<String>,
        #[serde(default)]
        instance: Option<String>,
        #[serde(default)]
        require_workcell: Option<String>,
        #[serde(default)]
        at: Option<String>,
    },
    /// Cross a Communique into obligation-bearing work (`aikit gateway
    /// delegate --communique C --work W --reason R`): Factory assigns custody
    /// to its recipient Position.
    Delegate {
        #[serde(default)]
        project: Option<String>,
        communique: String,
        work: String,
        reason: String,
        #[serde(default)]
        run: Option<String>,
        #[serde(default)]
        journey: Option<String>,
        #[serde(default)]
        workflow_unit: Option<String>,
        #[serde(default)]
        at: Option<String>,
    },
}

/// AIKit's team operation (`aikit gateway team --request-json J`): the
/// bounded native operation document, carried verbatim. Its `action` says
/// what it is: `read` reads a member's delegation; `prepare`, `delegate`,
/// `cancel` and `release` write (`is_read`).
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct GatewayTeam {
    #[serde(default)]
    pub project: Option<String>,
    pub request: Value,
}

impl GatewayTeam {
    /// A team `read`; every other action may change AIKit's journals.
    pub fn is_read(&self) -> bool {
        self.request.get("action").and_then(Value::as_str) == Some("read")
    }
}

/// Actuation's readings of a supplied record (`actuation <kind> - --json`,
/// the record on stdin) and its research comparison's pure assessments
/// (`actuation-research --json`, one operation on stdin). Each answers the
/// owner's reading of the document it was handed; none reads or writes a
/// store.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum ActuationRead {
    Agency {
        document: Value,
    },
    Realised {
        document: Value,
    },
    Stream {
        document: Value,
    },
    Activity {
        document: Value,
    },
    Usage {
        document: Value,
    },
    /// `comparison.held|assess|mask|review` over the supplied records or
    /// manifest (`input`, an object: the kernel names the operation).
    /// `comparison.run` executes model bodies and is not a reading.
    Comparison {
        operation: ComparisonRead,
        input: Value,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ComparisonRead {
    Held,
    Assess,
    Mask,
    Review,
}

/// Quaternal Logic's derivations over a supplied request: the M1 engine
/// (`ql kernel m1 <request.json>`, the request read from the kernel's stdin
/// as its file) and the integrated scene (`ql scene compose|world -`).
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum QlRead {
    KernelM1 { request: Value },
    SceneCompose { request: Value },
    SceneWorld { request: Value },
}

/// Workcell's cross-cell connection records and declared machines, read
/// only (`workcell connections list|show <label>`, `workcell machine list`).
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum WorkcellRead {
    ConnectionsList,
    ConnectionsShow { label: String },
    MachineList,
}

/// Workcell's connection writes: connect to a DECLARED machine (`workcell
/// connect --connection LABEL` — the endpoint and credential reference come
/// from the declaration; no endpoint or authorization ever travels from the
/// desk), and declare or remove a machine (`workcell machine add|remove`).
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum WorkcellWrite {
    Connect {
        connection: String,
    },
    MachineAdd {
        label: String,
        endpoint: String,
        #[serde(default)]
        credential_ref: Option<String>,
        #[serde(default)]
        allow: Vec<String>,
        #[serde(default)]
        note: Option<String>,
    },
    MachineRemove {
        label: String,
    },
}

/// The seat instrument's writes on this machine's workcell register (`seat
/// join|release WORKCELL PRODUCT --actor REF --json`). The actor is named by
/// the desk — claims are attributed, never assumed; the instrument admits
/// on that attribution and asks for no native token.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SeatWrite {
    Join {
        workcell: String,
        product: String,
        actor: String,
        #[serde(default)]
        branch: Option<String>,
        #[serde(default)]
        now: Option<String>,
        #[serde(default)]
        new_lane: bool,
        /// Every bounded edit zone, given to ONE `--region` flag (the
        /// instrument keeps only the last of repeated flags).
        #[serde(default)]
        regions: Vec<String>,
        #[serde(default)]
        recover_dirt_branch: Option<String>,
    },
    Release {
        workcell: String,
        product: String,
        actor: String,
        #[serde(default)]
        branch: Option<String>,
    },
}

/// AIKit's reads: the capture inbox (`aikit inbox [--all]`) and a Wiki
/// file's shapes (`aikit wiki-shape validate|compress --file F`).
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum AikitRead {
    Inbox {
        #[serde(default)]
        project: Option<String>,
        #[serde(default)]
        all: bool,
    },
    WikiShapeValidate {
        file: PathBuf,
    },
    WikiShapeCompress {
        file: PathBuf,
        anchor_ref: String,
    },
}

/// AIKit's writes: a capture into the inbox (its body on stdin), a captured
/// candidate's promotion, a trust decision, a Method's run and proof, a set's
/// package export and a Wiki shape's declaration (its Frame on stdin).
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum AikitWrite {
    Capture {
        #[serde(default)]
        project: Option<String>,
        title: String,
        body: String,
        /// The owner's `--kind` (the request's own tag is `kind`).
        #[serde(default)]
        capture_kind: Option<String>,
        #[serde(default)]
        export: Vec<String>,
        #[serde(default)]
        scope: Option<String>,
        #[serde(default)]
        source_ref: Option<String>,
        #[serde(default)]
        by: Option<String>,
    },
    Promote {
        #[serde(default)]
        project: Option<String>,
        candidate: String,
        #[serde(default)]
        id: Option<String>,
    },
    TrustRecord {
        #[serde(default)]
        project: Option<String>,
        capability: String,
        #[serde(default)]
        source: Option<String>,
        #[serde(default)]
        note: Option<String>,
    },
    MethodRun {
        #[serde(default)]
        project: Option<String>,
        method: String,
        #[serde(default)]
        input: Option<Value>,
        #[serde(default)]
        confirm: bool,
    },
    MethodProve {
        #[serde(default)]
        project: Option<String>,
        method: String,
        proof: Value,
    },
    /// `aikit set package export SET --target T --out DIR`: `out` must be
    /// an absolute directory the desk names — the owner's default is
    /// relative to a working directory the kernel does not choose.
    SetPackageExport {
        #[serde(default)]
        project: Option<String>,
        set: String,
        target: String,
        out: PathBuf,
        #[serde(default)]
        native: bool,
        #[serde(default)]
        allow_partial: bool,
        #[serde(default)]
        with_codex_overlay: bool,
    },
    WikiShapeDeclare {
        file: PathBuf,
        frame_ref: String,
        frame: Value,
    },
}

impl GatewayWrite {
    pub fn project(&self) -> Option<&str> {
        match self {
            Self::Send { project, .. } | Self::Delegate { project, .. } => project.as_deref(),
        }
    }
}

impl AikitRead {
    pub fn project(&self) -> Option<&str> {
        match self {
            Self::Inbox { project, .. } => project.as_deref(),
            Self::WikiShapeValidate { .. } | Self::WikiShapeCompress { .. } => None,
        }
    }
}

impl AikitWrite {
    pub fn project(&self) -> Option<&str> {
        match self {
            Self::Capture { project, .. }
            | Self::Promote { project, .. }
            | Self::TrustRecord { project, .. }
            | Self::MethodRun { project, .. }
            | Self::MethodProve { project, .. }
            | Self::SetPackageExport { project, .. } => project.as_deref(),
            Self::WikiShapeDeclare { .. } => None,
        }
    }
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

/// One route's answer: the owner command in plain words, the owner's reading
/// (an AIKit envelope's `data`; every other owner's whole document), and an
/// AIKit envelope's warnings.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct Reading {
    pub route: String,
    pub data: Value,
    pub warnings: Vec<Value>,
}

impl From<Reading> for crate::KernelOpResult {
    fn from(reading: Reading) -> Self {
        crate::KernelOpResult::OwnerRouteReading {
            route: reading.route,
            data: reading.data,
            warnings: reading.warnings,
        }
    }
}

/// What a write's owner said moved, for its receipt (`owner_changed`).
#[derive(Clone, Debug, PartialEq)]
pub struct Moved {
    pub owner: &'static str,
    pub action: String,
    pub reference: String,
    pub revision: Option<String>,
}

/// A write's answer, and what moved when the owner says something did.
#[derive(Clone, Debug, PartialEq)]
pub struct Written {
    pub reading: Reading,
    pub moved: Option<Moved>,
}

/// A failure as the kernel's seam carries it: the `material::Error`
/// document, serialised.
fn wire(error: Error) -> String {
    serde_json::to_string(&error).unwrap_or(error.message)
}

// ---------------------------------------------------------------------------
// Owners and the one bounded call
// ---------------------------------------------------------------------------

/// One owner as the kernel finds it: its executable and the words that route
/// to it (the suite's product namespace, when the suite answers).
struct Owner {
    name: &'static str,
    executable: PathBuf,
    prefix: Vec<OsString>,
}

/// An owner the suite routes: `$<env>` directly, else the suite executable
/// (`$OI_BIN`, else `oi`) with the product namespace — the resolution every
/// Factory, Workcell and AIKit arm uses.
fn suite(name: &'static str, env: &str, namespace: &str) -> Owner {
    match std::env::var_os(env).filter(|value| !value.is_empty()) {
        Some(path) => Owner {
            name,
            executable: PathBuf::from(path),
            prefix: Vec::new(),
        },
        None => Owner {
            name,
            executable: std::env::var_os("OI_BIN")
                .filter(|value| !value.is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| "oi".into()),
            prefix: vec![namespace.into()],
        },
    }
}

fn aikit() -> Owner {
    let (executable, suite_route) = crate::inhabitation::aikit_executable();
    Owner {
        name: "AIKit",
        executable,
        prefix: if suite_route {
            vec!["aikit".into()]
        } else {
            Vec::new()
        },
    }
}

fn actuation() -> Owner {
    suite("Actuation", "OI_ACTUATION_BIN", "actuation")
}

/// The research harness the suite does not route (`oi actuation-research`
/// is not a command): `$OI_ACTUATION_RESEARCH_BIN`, else
/// `actuation-research` on PATH, else `~/.local/bin/actuation-research` (a
/// Finder launch's PATH never holds it).
fn actuation_research() -> Owner {
    Owner {
        name: "Actuation research",
        executable: installed("OI_ACTUATION_RESEARCH_BIN", "actuation-research"),
        prefix: Vec::new(),
    }
}

fn ql() -> Owner {
    suite("Quaternal Logic", "OI_QL_BIN", "ql")
}

fn workcell() -> Owner {
    suite("Workcell", "OI_WORKCELL_BIN", "workcell")
}

fn seat() -> Owner {
    Owner {
        name: "the seat instrument",
        executable: crate::owner_read::seat_executable(),
        prefix: Vec::new(),
    }
}

/// An installed tool outside the suite's routes: `$<env>`, else `<program>`
/// on PATH, else `~/.local/bin/<program>`, else the bare name (which then
/// cannot start: an absence).
fn installed(env: &str, program: &str) -> PathBuf {
    if let Some(bin) = std::env::var_os(env).filter(|bin| !bin.is_empty()) {
        return PathBuf::from(bin);
    }
    let runnable = |candidate: &Path| {
        use std::os::unix::fs::PermissionsExt;
        std::fs::metadata(candidate)
            .is_ok_and(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
    };
    std::env::var_os("PATH")
        .iter()
        .flat_map(std::env::split_paths)
        .map(|dir| dir.join(program))
        .find(|candidate| candidate.is_absolute() && runnable(candidate))
        .or_else(|| {
            std::env::var_os("HOME")
                .map(|home| PathBuf::from(home).join(".local/bin").join(program))
                .filter(|managed| managed.is_absolute() && runnable(managed))
        })
        .unwrap_or_else(|| PathBuf::from(program))
}

/// One bounded owner call.
struct Call<'a> {
    owner: Owner,
    /// The owner command in plain words (`aikit gateway send`): the route an
    /// answer names, and the operation a bound's refusal names.
    route: String,
    args: Vec<OsString>,
    input: Option<Vec<u8>>,
    cwd: Option<&'a Path>,
    limit: Duration,
    effect: Effect,
}

impl Call<'_> {
    fn new(owner: Owner, route: &str, args: Vec<OsString>, limit: Duration) -> Self {
        Call {
            owner,
            route: route.to_owned(),
            args,
            input: None,
            cwd: None,
            limit,
            effect: Effect::Read,
        }
    }
}

fn words(args: &[&str]) -> Vec<OsString> {
    args.iter().map(OsString::from).collect()
}

fn push_flag(args: &mut Vec<OsString>, flag: &str, value: Option<&str>) {
    if let Some(value) = value {
        args.push(flag.into());
        args.push(value.into());
    }
}

fn refused(message: String, ran: bool) -> Error {
    Error {
        kind: "owner-refused-or-failed".into(),
        message,
        operation_may_have_run: ran,
    }
}

fn incompatible(message: String) -> Error {
    Error {
        kind: "incompatible".into(),
        message,
        operation_may_have_run: false,
    }
}

/// Run one owner command through the owner-process limiter within its bound,
/// and return the owner's JSON document. A non-zero exit, or a document that
/// says `ok: false` whatever the exit, is the owner's refusal in its own
/// words.
fn run(call: Call<'_>) -> Result<Value, Error> {
    let mut command = Command::new(&call.owner.executable);
    command
        .args(&call.owner.prefix)
        .args(&call.args)
        .env_remove("OI_POSITION_REF")
        .env_remove("OI_OCCUPANT_GENERATION");
    if let Some(cwd) = call.cwd {
        command.current_dir(cwd);
    }
    let writes = call.effect != Effect::Read;
    let output = crate::owner_process::output(
        &mut command,
        call.input,
        Bound {
            owner: call.owner.name,
            operation: &call.route,
            limit: call.limit,
            effect: call.effect,
        },
    )
    .map_err(|failure| {
        let (kind, ran) = match failure.failed {
            Failed::Unavailable => ("unavailable", false),
            Failed::Stopped => ("timeout", writes),
            Failed::Process => ("process-error", writes),
        };
        Error {
            kind: kind.into(),
            message: failure.message,
            operation_may_have_run: ran,
        }
    })?;
    if !output.status.success() {
        return Err(refused(
            crate::inhabitation::refusal_words(&output.stdout, &output.stderr),
            false,
        ));
    }
    let document: Value = serde_json::from_slice(&output.stdout).map_err(|error| {
        incompatible(format!(
            "{} answered without a JSON document: {error}",
            call.route
        ))
    })?;
    if document.get("ok") == Some(&Value::Bool(false)) {
        let stdout = serde_json::to_vec(&document).unwrap_or_default();
        return Err(refused(
            crate::inhabitation::refusal_words(&stdout, b""),
            false,
        ));
    }
    Ok(document)
}

/// An answer that is not the one asked for, named.
fn unexpected(route: &str, wanted: &str, data: &Value) -> Error {
    let answered = data
        .get("schema")
        .or_else(|| data.get("contract"))
        .and_then(Value::as_str)
        .map(str::to_owned)
        .unwrap_or_else(|| {
            let keys: Vec<&str> = data
                .as_object()
                .map(|object| object.keys().map(String::as_str).collect())
                .unwrap_or_default();
            format!("a document with {}", keys.join(", "))
        });
    incompatible(format!(
        "{route} answered an unexpected reading ({answered}) where {wanted} was asked for"
    ))
}

/// The reading carries `schema` = `wanted`.
fn schema(route: &str, data: Value, wanted: &str) -> Result<Value, Error> {
    if data.get("schema").and_then(Value::as_str) == Some(wanted) {
        Ok(data)
    } else {
        Err(unexpected(route, wanted, &data))
    }
}

/// The reading carries every named field as the given JSON kind.
fn fields(route: &str, data: Value, wanted: &[(&str, Kind)]) -> Result<Value, Error> {
    let carried = wanted.iter().all(|(field, kind)| {
        data.get(*field).is_some_and(|value| match kind {
            Kind::Text => value.as_str().is_some_and(|text| !text.is_empty()),
            Kind::Flag => value.is_boolean(),
            Kind::List => value.is_array(),
        })
    });
    if carried {
        Ok(data)
    } else {
        let named: Vec<&str> = wanted.iter().map(|(field, _)| *field).collect();
        Err(unexpected(route, &named.join(", "), &data))
    }
}

#[derive(Clone, Copy)]
enum Kind {
    Text,
    Flag,
    List,
}

/// AIKit's `--json` envelope → its reading and warnings, the refusal named.
fn envelope(route: &str, document: Value) -> Result<(Value, Vec<Value>), Error> {
    crate::inhabitation::unwrap_envelope(document, route)
}

fn reading(route: String, data: Value, warnings: Vec<Value>) -> Reading {
    Reading {
        route,
        data,
        warnings,
    }
}

/// The first non-empty text the owner's answer names under one of `keys`
/// (each a JSON pointer).
fn named(data: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| data.pointer(key).and_then(Value::as_str))
        .filter(|text| !text.trim().is_empty())
        .map(str::to_owned)
}

fn object_bytes(value: &Value) -> Result<Vec<u8>, Error> {
    serde_json::to_vec(value).map_err(|error| incompatible(error.to_string()))
}

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/// Owner readings of a supplied document (Actuation, QL's M1, Workcell's
/// records, AIKit's inbox): each answers from what it is handed or its own
/// small state. The bound is for an owner that never answers, not a pace.
const READ_LIMIT: Duration = Duration::from_secs(30);
/// QL's scene may compute its dated sky before composing (measured in tens
/// of seconds when provisioning, native_expression.rs).
const SCENE_LIMIT: Duration = Duration::from_secs(120);
/// AIKit's gateway may relay a Communique to another Workcell's gateway, and
/// a team preparation attaches an AgentSession; Workcell's connect reaches
/// the remote cell.
const GATEWAY_WRITE_LIMIT: Duration = Duration::from_secs(60);
const OWNER_WRITE_LIMIT: Duration = Duration::from_secs(60);
/// A Method's run executes its support; a package export renders a tree and
/// may run the target's own validator.
const LONG_WRITE_LIMIT: Duration = Duration::from_secs(300);
/// The seat instrument cuts a branch, may tend caches below the soft floor,
/// and records a NOW return; its own children are bounded at 120 s each.
const SEAT_LIMIT: Duration = Duration::from_secs(300);

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/// Actuation's reading schemas, as `actuation contract list` names them.
fn actuation_schema(request: &ActuationRead) -> (&'static str, &'static str) {
    match request {
        ActuationRead::Agency { .. } => ("agency", "actuation.agency/v1"),
        ActuationRead::Realised { .. } => ("realised", "actuation.realised/v1"),
        ActuationRead::Stream { .. } => ("stream", "actuation.stream/v1"),
        ActuationRead::Activity { .. } => ("activity", "actuation.activity/v1"),
        ActuationRead::Usage { .. } => ("usage", "actuation.model-usage/v1"),
        ActuationRead::Comparison { .. } => ("comparison", ""),
    }
}

pub fn actuation_read(request: &ActuationRead) -> Result<Reading, String> {
    actuation_answer(request).map_err(wire)
}

fn actuation_answer(request: &ActuationRead) -> Result<Reading, Error> {
    if let ActuationRead::Comparison { operation, input } = request {
        let spelled = match operation {
            ComparisonRead::Held => "comparison.held",
            ComparisonRead::Assess => "comparison.assess",
            ComparisonRead::Mask => "comparison.mask",
            ComparisonRead::Review => "comparison.review",
        };
        let mut body = input.clone();
        let Some(object) = body.as_object_mut() else {
            return Err(incompatible(format!(
                "actuation-research {spelled} takes an object of its fields"
            )));
        };
        if object
            .get("operation")
            .is_some_and(|given| given.as_str() != Some(spelled))
        {
            return Err(incompatible(format!(
                "actuation-research {spelled} was handed another operation"
            )));
        }
        object.insert("operation".into(), spelled.into());
        let route = format!("actuation-research {spelled}");
        let mut call = Call::new(actuation_research(), &route, words(&["--json"]), READ_LIMIT);
        call.input = Some(object_bytes(&body)?);
        let data = run(call)?;
        // The harness answers a refusal with its own error document.
        if data.get("schema").and_then(Value::as_str) == Some("actuation.research-error/v1") {
            let stdout = object_bytes(&data)?;
            return Err(refused(
                crate::inhabitation::refusal_words(&stdout, b""),
                false,
            ));
        }
        let data = match operation {
            ComparisonRead::Held => fields(
                &route,
                data,
                &[("valid", Kind::Flag), ("mismatches", Kind::List)],
            )?,
            ComparisonRead::Assess => fields(
                &route,
                data,
                &[("valid", Kind::Flag), ("reasons", Kind::List)],
            )?,
            ComparisonRead::Mask => schema(&route, data, "ql-series1-mask-map/0.1")?,
            ComparisonRead::Review => fields(&route, data, &[("text", Kind::Text)])?,
        };
        return Ok(reading(route, data, Vec::new()));
    }
    let (verb, wanted) = actuation_schema(request);
    let document = match request {
        ActuationRead::Agency { document }
        | ActuationRead::Realised { document }
        | ActuationRead::Stream { document }
        | ActuationRead::Activity { document }
        | ActuationRead::Usage { document } => document,
        ActuationRead::Comparison { .. } => unreachable!("answered above"),
    };
    let route = format!("actuation {verb}");
    let mut call = Call::new(
        actuation(),
        &route,
        words(&[verb, "-", "--json"]),
        READ_LIMIT,
    );
    call.input = Some(object_bytes(document)?);
    let data = schema(&route, run(call)?, wanted)?;
    Ok(reading(route, data, Vec::new()))
}

pub fn ql_read(request: &QlRead) -> Result<Reading, String> {
    ql_answer(request).map_err(wire)
}

fn ql_answer(request: &QlRead) -> Result<Reading, Error> {
    // `ql kernel m1` reads its request from a file it is named; the kernel
    // names its own stdin, so the request never lands on disk.
    let (route, args, document, wanted, limit) = match request {
        QlRead::KernelM1 { request } => (
            "ql kernel m1",
            words(&["kernel", "m1", "/dev/stdin", "--json"]),
            request,
            "ql.m1.engine/v1",
            READ_LIMIT,
        ),
        QlRead::SceneCompose { request } => (
            "ql scene compose",
            words(&["scene", "compose", "-", "--json"]),
            request,
            "ql.scene/v1",
            SCENE_LIMIT,
        ),
        QlRead::SceneWorld { request } => (
            "ql scene world",
            words(&["scene", "world", "-", "--json"]),
            request,
            "ql.scene-world/v1",
            SCENE_LIMIT,
        ),
    };
    let mut call = Call::new(ql(), route, args, limit);
    call.input = Some(object_bytes(document)?);
    let data = schema(route, run(call)?, wanted)?;
    Ok(reading(route.into(), data, Vec::new()))
}

pub fn workcell_read(request: &WorkcellRead) -> Result<Reading, String> {
    workcell_answer(request).map_err(wire)
}

fn workcell_answer(request: &WorkcellRead) -> Result<Reading, Error> {
    let (route, args) = match request {
        WorkcellRead::ConnectionsList => (
            "workcell connections list",
            words(&["connections", "list", "--json"]),
        ),
        WorkcellRead::ConnectionsShow { label } => {
            let mut args = words(&["connections", "show"]);
            args.push(label.into());
            args.push("--json".into());
            ("workcell connections show", args)
        }
        WorkcellRead::MachineList => (
            "workcell machine list",
            words(&["machine", "list", "--json"]),
        ),
    };
    let data = run(Call::new(workcell(), route, args, READ_LIMIT))?;
    let data = match request {
        WorkcellRead::ConnectionsList => fields(route, data, &[("connections", Kind::List)])?,
        WorkcellRead::ConnectionsShow { .. } => {
            if data.pointer("/connection/version").and_then(Value::as_str)
                != Some("workcell.connection/v1")
            {
                return Err(unexpected(route, "workcell.connection/v1", &data));
            }
            data
        }
        WorkcellRead::MachineList => fields(route, data, &[("machines", Kind::List)])?,
    };
    Ok(reading(route.into(), data, Vec::new()))
}

/// The AIKit reading's words: the owner command and its argv.
pub(crate) fn aikit_read_args(request: &AikitRead) -> (&'static str, Vec<OsString>) {
    match request {
        AikitRead::Inbox { all, .. } => {
            let mut args = words(&["inbox"]);
            if *all {
                args.push("--all".into());
            }
            args.push("--json".into());
            ("aikit inbox", args)
        }
        AikitRead::WikiShapeValidate { file } => {
            let mut args = words(&["wiki-shape", "validate", "--file"]);
            args.push(file.into());
            args.push("--json".into());
            ("aikit wiki-shape validate", args)
        }
        AikitRead::WikiShapeCompress { file, anchor_ref } => {
            let mut args = words(&["wiki-shape", "compress", "--file"]);
            args.push(file.into());
            args.push(anchor_ref.into());
            args.push("--json".into());
            ("aikit wiki-shape compress", args)
        }
    }
}

/// One AIKit reading, run from `cwd` (Central's disclosed ground for the
/// scope, else AIKit resolves its own).
pub fn aikit_read(request: &AikitRead, cwd: Option<&Path>) -> Result<Reading, String> {
    aikit_read_answer(request, cwd).map_err(wire)
}

fn aikit_read_answer(request: &AikitRead, cwd: Option<&Path>) -> Result<Reading, Error> {
    let (route, args) = aikit_read_args(request);
    let mut call = Call::new(aikit(), route, args, READ_LIMIT);
    call.cwd = cwd;
    let (data, warnings) = envelope(route, run(call)?)?;
    let data = match request {
        AikitRead::Inbox { .. } => fields(route, data, &[("items", Kind::List)])?,
        AikitRead::WikiShapeValidate { .. } => {
            if data.get("command").and_then(Value::as_str) != Some("wiki-shape.validate") {
                return Err(unexpected(route, "wiki-shape.validate", &data));
            }
            data
        }
        // The 6+6′ compression's own record (AIKit's `compress_six_plus_six_prime`).
        AikitRead::WikiShapeCompress { .. } => data,
    };
    if !data.is_object() {
        return Err(unexpected(route, "a reading", &data));
    }
    Ok(reading(route.into(), data, warnings))
}

/// AIKit's team operation, read or written: the whole operation document as
/// AIKit's `--request-json`.
fn team_call<'a>(team: &GatewayTeam, cwd: Option<&'a Path>) -> Result<Call<'a>, Error> {
    if !team.request.is_object() {
        return Err(incompatible(
            "aikit gateway team takes one operation document".into(),
        ));
    }
    let mut args = words(&["gateway", "team", "--request-json"]);
    args.push(
        serde_json::to_string(&team.request)
            .map_err(|error| incompatible(error.to_string()))?
            .into(),
    );
    args.push("--json".into());
    let mut call = Call::new(aikit(), "aikit gateway team", args, GATEWAY_WRITE_LIMIT);
    call.cwd = cwd;
    if !team.is_read() {
        call.effect = Effect::Write;
    }
    Ok(call)
}

fn team_answer(call: Call<'_>) -> Result<Reading, Error> {
    let route = call.route.clone();
    let (data, warnings) = envelope(&route, run(call)?)?;
    let data = schema(&route, data, "aikit.team-operation/v1")?;
    Ok(reading(route, data, warnings))
}

/// A team `read` (the write actions are `gateway_team_write`).
pub fn gateway_team_read(team: &GatewayTeam, cwd: Option<&Path>) -> Result<Reading, String> {
    if !team.is_read() {
        return Err(wire(incompatible(
            "A team action that writes is not a reading".into(),
        )));
    }
    team_call(team, cwd).and_then(team_answer).map_err(wire)
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/// Where an AIKit write runs and the canonical Project World it names.
pub struct Ground<'a> {
    pub cwd: Option<&'a Path>,
    pub project_world: Option<&'a str>,
}

pub fn gateway_write(request: &GatewayWrite, ground: Ground<'_>) -> Result<Written, String> {
    gateway_written(request, ground).map_err(wire)
}

fn gateway_written(request: &GatewayWrite, ground: Ground<'_>) -> Result<Written, Error> {
    let (route, mut args, input) = match request {
        GatewayWrite::Send {
            to,
            body,
            reply_to,
            from_position,
            instance,
            require_workcell,
            at,
            ..
        } => {
            let mut args = words(&["gateway", "send", "--to"]);
            args.push(to.into());
            args.extend(words(&["--body-file", "-"]));
            push_flag(&mut args, "--reply-to", reply_to.as_deref());
            push_flag(&mut args, "--from-position", from_position.as_deref());
            push_flag(&mut args, "--project-world", ground.project_world);
            push_flag(&mut args, "--instance", instance.as_deref());
            push_flag(&mut args, "--require-workcell", require_workcell.as_deref());
            push_flag(&mut args, "--at", at.as_deref());
            ("aikit gateway send", args, Some(body.as_bytes().to_vec()))
        }
        GatewayWrite::Delegate {
            communique,
            work,
            reason,
            run,
            journey,
            workflow_unit,
            at,
            ..
        } => {
            let mut args = words(&["gateway", "delegate", "--communique"]);
            args.push(communique.into());
            args.push("--work".into());
            args.push(work.into());
            push_flag(&mut args, "--run", run.as_deref());
            push_flag(&mut args, "--journey", journey.as_deref());
            push_flag(&mut args, "--workflow-unit", workflow_unit.as_deref());
            args.push("--reason".into());
            args.push(reason.into());
            push_flag(&mut args, "--at", at.as_deref());
            ("aikit gateway delegate", args, None)
        }
    };
    args.push("--json".into());
    let mut call = Call::new(aikit(), route, args, GATEWAY_WRITE_LIMIT);
    call.input = input;
    call.cwd = ground.cwd;
    call.effect = Effect::Write;
    let (data, warnings) = envelope(route, run(call)?)?;
    let communique_kept =
        data.pointer("/communique/schema").and_then(Value::as_str) == Some("aikit.communique/v1");
    let moved = match request {
        GatewayWrite::Send { .. } => {
            // A Position's Communique, or a request in the person's Inbox
            // (an address to the owner, who occupies no Position).
            let to_owner = data.get("addressed").and_then(Value::as_str) == Some("owner");
            if !communique_kept && !(to_owner && named(&data, &["/return_ref"]).is_some()) {
                return Err(unexpected(route, "aikit.communique/v1", &data));
            }
            named(&data, &["/communique/communique_ref", "/return_ref"])
        }
        GatewayWrite::Delegate { communique, .. } => {
            if !communique_kept || named(&data, &["/custody_ref"]).is_none() {
                return Err(unexpected(
                    route,
                    "aikit.communique/v1 with its custody_ref",
                    &data,
                ));
            }
            named(&data, &["/custody_ref"]).or(Some(communique.clone()))
        }
    }
    // An identical request AIKit already accepted is replayed: nothing moved.
    .filter(|_| data.get("replayed") != Some(&Value::Bool(true)))
    .map(|reference| Moved {
        owner: "ai-kit",
        action: route.into(),
        reference,
        revision: None,
    });
    Ok(Written {
        reading: reading(route.into(), data, warnings),
        moved,
    })
}

/// A team action that writes (`prepare`, `delegate`, `cancel`, `release`).
pub fn gateway_team_write(team: &GatewayTeam, cwd: Option<&Path>) -> Result<Written, String> {
    if team.is_read() {
        return Err(wire(incompatible(
            "A team read is a reading, not a write".into(),
        )));
    }
    let action = team
        .request
        .get("action")
        .and_then(Value::as_str)
        .unwrap_or("team")
        .to_owned();
    let answered = team_call(team, cwd).and_then(team_answer).map_err(wire)?;
    let reference = named(
        &answered.data,
        &["/delivery_ref", "/agent_session", "/member_ref"],
    )
    .or_else(|| named(&team.request, &["/member_ref"]));
    Ok(Written {
        moved: reference.map(|reference| Moved {
            owner: "ai-kit",
            action: format!("aikit gateway team {action}"),
            reference,
            revision: None,
        }),
        reading: answered,
    })
}

pub fn workcell_write(request: &WorkcellWrite) -> Result<Written, String> {
    workcell_written(request).map_err(wire)
}

fn workcell_written(request: &WorkcellWrite) -> Result<Written, Error> {
    let (route, mut args, label) = match request {
        WorkcellWrite::Connect { connection } => {
            let mut args = words(&["connect", "--connection"]);
            args.push(connection.into());
            ("workcell connect", args, connection)
        }
        WorkcellWrite::MachineAdd {
            label,
            endpoint,
            credential_ref,
            allow,
            note,
        } => {
            let mut args = words(&["machine", "add", "--label"]);
            args.push(label.into());
            args.push("--endpoint".into());
            args.push(endpoint.into());
            push_flag(&mut args, "--credential-ref", credential_ref.as_deref());
            for operation in allow {
                args.push("--allow".into());
                args.push(operation.into());
            }
            push_flag(&mut args, "--note", note.as_deref());
            ("workcell machine add", args, label)
        }
        WorkcellWrite::MachineRemove { label } => {
            let mut args = words(&["machine", "remove", "--label"]);
            args.push(label.into());
            ("workcell machine remove", args, label)
        }
    };
    args.push("--json".into());
    let limit = if matches!(request, WorkcellWrite::Connect { .. }) {
        GATEWAY_WRITE_LIMIT
    } else {
        OWNER_WRITE_LIMIT
    };
    let mut call = Call::new(workcell(), route, args, limit);
    call.effect = Effect::Write;
    let data = run(call)?;
    let answered = match request {
        WorkcellWrite::Connect { .. } => data.pointer("/connection/label"),
        _ => data.get("label"),
    }
    .and_then(Value::as_str);
    if answered != Some(label.as_str()) {
        return Err(unexpected(route, &format!("the record of {label}"), &data));
    }
    let moved = (data.get("removed") != Some(&Value::Bool(false))).then(|| Moved {
        owner: "workcell",
        action: route.into(),
        reference: label.clone(),
        revision: None,
    });
    Ok(Written {
        reading: reading(route.into(), data, Vec::new()),
        moved,
    })
}

/// The seat instrument's schema for a join or release.
pub const SEAT_RESULT_SCHEMA: &str = "central.workcell-seat-result/v1";

pub fn seat_write(request: &SeatWrite) -> Result<Written, String> {
    seat_written(request).map_err(wire)
}

fn seat_written(request: &SeatWrite) -> Result<Written, Error> {
    let (route, mut args, workcell, product) = match request {
        SeatWrite::Join {
            workcell,
            product,
            actor,
            branch,
            now,
            new_lane,
            regions,
            recover_dirt_branch,
        } => {
            let mut args = words(&["join"]);
            args.push(workcell.into());
            args.push(product.into());
            args.push("--actor".into());
            args.push(actor.into());
            push_flag(&mut args, "--branch", branch.as_deref());
            push_flag(&mut args, "--now", now.as_deref());
            if *new_lane {
                args.push("--new-lane".into());
            }
            if !regions.is_empty() {
                args.push("--region".into());
                args.extend(regions.iter().map(OsString::from));
            }
            push_flag(
                &mut args,
                "--recover-dirt-branch",
                recover_dirt_branch.as_deref(),
            );
            ("seat join", args, workcell, product)
        }
        SeatWrite::Release {
            workcell,
            product,
            actor,
            branch,
        } => {
            let mut args = words(&["release"]);
            args.push(workcell.into());
            args.push(product.into());
            args.push("--actor".into());
            args.push(actor.into());
            push_flag(&mut args, "--branch", branch.as_deref());
            ("seat release", args, workcell, product)
        }
    };
    args.push("--json".into());
    let mut call = Call::new(seat(), route, args, SEAT_LIMIT);
    call.effect = Effect::Write;
    let data = schema(route, run(call)?, SEAT_RESULT_SCHEMA)?;
    // The instrument says whether it wrote the register (an attach to the
    // standing lane as the same actor writes nothing).
    let moved = (data.get("register_written") == Some(&Value::Bool(true))).then(|| Moved {
        owner: "seat",
        action: route.into(),
        reference: format!("workcell:{workcell}/{product}"),
        revision: None,
    });
    Ok(Written {
        reading: reading(route.into(), data, Vec::new()),
        moved,
    })
}

pub fn aikit_write(request: &AikitWrite, cwd: Option<&Path>) -> Result<Written, String> {
    aikit_written(request, cwd).map_err(wire)
}

fn aikit_written(request: &AikitWrite, cwd: Option<&Path>) -> Result<Written, Error> {
    let mut input = None;
    let mut limit = OWNER_WRITE_LIMIT;
    let (route, mut args) = match request {
        AikitWrite::Capture {
            title,
            body,
            capture_kind,
            export,
            scope,
            source_ref,
            by,
            ..
        } => {
            // Without --body the owner reads the body from stdin.
            let mut args = words(&["capture"]);
            args.push(title.into());
            push_flag(&mut args, "--kind", capture_kind.as_deref());
            for name in export {
                args.push("--export".into());
                args.push(name.into());
            }
            push_flag(&mut args, "--scope", scope.as_deref());
            push_flag(&mut args, "--source-ref", source_ref.as_deref());
            push_flag(&mut args, "--by", by.as_deref());
            input = Some(body.as_bytes().to_vec());
            ("aikit capture", args)
        }
        AikitWrite::Promote { candidate, id, .. } => {
            let mut args = words(&["promote"]);
            args.push(candidate.into());
            push_flag(&mut args, "--id", id.as_deref());
            ("aikit promote", args)
        }
        AikitWrite::TrustRecord {
            capability,
            source,
            note,
            ..
        } => {
            let mut args = words(&["trust", "record"]);
            args.push(capability.into());
            push_flag(&mut args, "--source", source.as_deref());
            push_flag(&mut args, "--note", note.as_deref());
            ("aikit trust record", args)
        }
        AikitWrite::MethodRun {
            method,
            input: given,
            confirm,
            ..
        } => {
            let mut args = words(&["praxis", "method", "run"]);
            args.push(method.into());
            if let Some(given) = given {
                args.push("--input".into());
                args.push(
                    serde_json::to_string(given)
                        .map_err(|error| incompatible(error.to_string()))?
                        .into(),
                );
            }
            if *confirm {
                args.push("--confirm".into());
            }
            limit = LONG_WRITE_LIMIT;
            ("aikit praxis method run", args)
        }
        AikitWrite::MethodProve { method, proof, .. } => {
            let mut args = words(&["praxis", "method", "prove", "--method"]);
            args.push(method.into());
            args.push("--proof-json".into());
            args.push(
                serde_json::to_string(proof)
                    .map_err(|error| incompatible(error.to_string()))?
                    .into(),
            );
            ("aikit praxis method prove", args)
        }
        AikitWrite::SetPackageExport {
            set,
            target,
            out,
            native,
            allow_partial,
            with_codex_overlay,
            ..
        } => {
            if !out.is_absolute() {
                return Err(incompatible(
                    "aikit set package export needs the absolute directory it writes".into(),
                ));
            }
            let mut args = words(&["set", "package", "export"]);
            args.push(set.into());
            args.push("--target".into());
            args.push(target.into());
            args.push("--out".into());
            args.push(out.into());
            if *native {
                args.push("--native".into());
            }
            if *allow_partial {
                args.push("--allow-partial".into());
            }
            if *with_codex_overlay {
                args.push("--with-codex-overlay".into());
            }
            limit = LONG_WRITE_LIMIT;
            ("aikit set package export", args)
        }
        AikitWrite::WikiShapeDeclare {
            file,
            frame_ref,
            frame,
        } => {
            let mut args = words(&["wiki-shape", "declare", "--file"]);
            args.push(file.into());
            args.push(frame_ref.into());
            input = Some(object_bytes(frame)?);
            ("aikit wiki-shape declare", args)
        }
    };
    args.push("--json".into());
    let mut call = Call::new(aikit(), route, args, limit);
    call.input = input;
    call.cwd = cwd;
    call.effect = Effect::Write;
    let (data, warnings) = envelope(route, run(call)?)?;
    let (data, moved) = match request {
        AikitWrite::Capture { .. } => {
            let data = fields(route, data, &[("candidate", Kind::Text)])?;
            let reference = named(&data, &["/candidate"]);
            (data, reference)
        }
        AikitWrite::Promote { .. } => {
            let data = fields(route, data, &[("id", Kind::Text)])?;
            let reference = named(&data, &["/id"]);
            (data, reference)
        }
        AikitWrite::TrustRecord { .. } => {
            let data = fields(route, data, &[("capability", Kind::Text)])?;
            // A capsule no registry holds is answered `unseen`: nothing recorded.
            let reference = (data.get("state").and_then(Value::as_str) != Some("unseen"))
                .then(|| named(&data, &["/capability"]))
                .flatten();
            (data, reference)
        }
        AikitWrite::MethodRun { method, .. } => {
            let data = schema(route, data, "aikit.method-execution/v1")?;
            let reference =
                named(&data, &["/execution_ref", "/receipt_ref"]).or(Some(method.clone()));
            (data, reference)
        }
        AikitWrite::MethodProve { .. } => {
            let data = fields(
                route,
                data,
                &[("method", Kind::Text), ("proof_ref", Kind::Text)],
            )?;
            let reference = named(&data, &["/proof_ref"]);
            (data, reference)
        }
        AikitWrite::SetPackageExport { out, .. } => {
            let data = schema(route, data, "aikit.skillset-package-receipt/v1")?;
            let reference = named(&data, &["/out_dir"]).or_else(|| Some(out.display().to_string()));
            (data, reference)
        }
        AikitWrite::WikiShapeDeclare { frame_ref, .. } => {
            if data.get("command").and_then(Value::as_str) != Some("wiki-shape.declare") {
                return Err(unexpected(route, "wiki-shape.declare", &data));
            }
            let unchanged = data.get("changed") == Some(&Value::Bool(false));
            (data, (!unchanged).then(|| frame_ref.clone()))
        }
    };
    Ok(Written {
        moved: moved.map(|reference| Moved {
            owner: "ai-kit",
            action: route.into(),
            reference,
            revision: named(&data, &["/revision"]),
        }),
        reading: reading(route.into(), data, warnings),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spelled(args: &[OsString]) -> Vec<String> {
        args.iter()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn requests_deserialise_from_the_desk_wire() {
        let send: GatewayWrite = serde_json::from_value(serde_json::json!({
            "kind": "send", "project": "O-I", "to": "@anima", "body": "hello"}))
        .unwrap();
        assert_eq!(send.project(), Some("O-I"));
        let team: GatewayTeam = serde_json::from_value(serde_json::json!({
            "request": {"action": "read", "member_ref": "agent/x"}}))
        .unwrap();
        assert!(team.is_read());
        let team: GatewayTeam = serde_json::from_value(serde_json::json!({
            "request": {"action": "delegate"}}))
        .unwrap();
        assert!(!team.is_read(), "every action but read writes");
        let read: ActuationRead = serde_json::from_value(serde_json::json!({
            "kind": "comparison", "operation": "assess", "input": {"manifest": {}}}))
        .unwrap();
        assert!(matches!(
            read,
            ActuationRead::Comparison {
                operation: ComparisonRead::Assess,
                ..
            }
        ));
        let ql: QlRead =
            serde_json::from_value(serde_json::json!({"kind": "kernel-m1", "request": {}}))
                .unwrap();
        assert!(matches!(ql, QlRead::KernelM1 { .. }));
        let join: SeatWrite = serde_json::from_value(serde_json::json!({
            "kind": "join", "workcell": "env-1", "product": "o-i", "actor": "person:frank",
            "regions": ["a", "b"]}))
        .unwrap();
        assert!(matches!(
            join,
            SeatWrite::Join {
                new_lane: false,
                ..
            }
        ));
        let write: AikitWrite = serde_json::from_value(serde_json::json!({
            "kind": "capture", "title": "t", "body": "b", "capture_kind": "script"}))
        .unwrap();
        assert!(matches!(
            write,
            AikitWrite::Capture {
                capture_kind: Some(_),
                ..
            }
        ));
    }

    #[test]
    fn the_aikit_reading_grammar() {
        let (route, args) = aikit_read_args(&AikitRead::Inbox {
            project: None,
            all: true,
        });
        assert_eq!(route, "aikit inbox");
        assert_eq!(spelled(&args), ["inbox", "--all", "--json"]);
        let (_, args) = aikit_read_args(&AikitRead::WikiShapeCompress {
            file: "/w/wiki.json".into(),
            anchor_ref: "wiki:node:a".into(),
        });
        assert_eq!(
            spelled(&args),
            [
                "wiki-shape",
                "compress",
                "--file",
                "/w/wiki.json",
                "wiki:node:a",
                "--json"
            ]
        );
    }

    #[test]
    fn a_checked_answer_names_what_it_was_not() {
        let error = schema(
            "ql kernel m1",
            serde_json::json!({"schema": "ql.m3-state/v1"}),
            "ql.m1.engine/v1",
        )
        .unwrap_err();
        assert_eq!(error.kind, "incompatible");
        assert!(
            error.message.contains("ql.m3-state/v1"),
            "{}",
            error.message
        );
        let error = fields(
            "workcell machine list",
            serde_json::json!({"connections": []}),
            &[("machines", Kind::List)],
        )
        .unwrap_err();
        assert!(
            error.message.contains("a document with connections")
                && error.message.contains("machines"),
            "{}",
            error.message
        );
    }
}
