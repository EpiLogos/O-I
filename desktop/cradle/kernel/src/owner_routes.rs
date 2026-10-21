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
    /// `actuation authority list --json`: every governing authority in
    /// Actuation's own store, revoked ones included
    /// (`actuation.local-authority-listing/v1`). Reads the store; writes none.
    AuthorityList,
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

/// Actuation's governing-authority acts on its own authority store
/// (`~/.actuation/authority`, or `$ACTUATION_AUTHORITY_STORE`): an explicit
/// issue of one governing record, and its explicit revocation. Each appends
/// to that store, so each is a write. The desk names no store and no clock:
/// Actuation stamps its own time and keeps its own store.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum ActuationWrite {
    /// `actuation authority issue - --json`, the record
    /// (`actuation.local-authority/v1`) on stdin. Actuation refuses a source
    /// ref that already has state, and a record scoped to no world.
    AuthorityIssue { record: Value },
    /// `actuation authority revoke REF [--reason TEXT] --json`. Revocation is
    /// permanent; Actuation refuses an unknown or already revoked source.
    AuthorityRevoke {
        authority_source_ref: String,
        #[serde(default)]
        reason: Option<String>,
    },
}

/// Quaternal Logic's derivations over a supplied request: the M1 engine
/// (`ql kernel m1 <request.json>`, the request read from the kernel's stdin
/// as its file) and the integrated scene (`ql scene compose|world -`).
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum QlRead {
    KernelM1 {
        request: Value,
    },
    SceneCompose {
        request: Value,
    },
    SceneWorld {
        request: Value,
    },
    /// The M ledger QL compiles in (`ql kernel ledger [coordinate]`): the
    /// whole ledger (`ql.m-ledger/v1`), or one exact coordinate's view —
    /// its registry node, rows, relations and source records
    /// (`ql.m-ledger-view/v1`).
    KernelLedger {
        #[serde(default)]
        coordinate: Option<String>,
    },
    /// The ledger's coverage of one coordinate (`ql kernel coverage <M…>
    /// [--stratum] [--axis] [--require]`, `ql.m-coverage/v1`): structural
    /// coordinates, bindings, rows that block the required readiness.
    KernelCoverage {
        coordinate: String,
        #[serde(default)]
        stratum: Option<String>,
        #[serde(default)]
        axis: Option<String>,
        #[serde(default)]
        require: Option<String>,
    },
    /// One of QL's deterministic kernel operators on a canonical address
    /// (`ql kernel apply <operator> <qladdr:…>`): conjugate-address,
    /// complement-address, classify-four-plus-two.
    KernelApply {
        operator: String,
        address: String,
    },
    /// The Technē reading of a supplied target (`ql techne reading
    /// <target.json>`, `ql.techne/v1`), the target read from the kernel's
    /// stdin as its file.
    TechneReading {
        target: Value,
    },
    /// The MEF lens registry (`ql mef lenses`).
    MefLenses,
    /// The Context-Frame grammar's frames (`ql context-frame list`).
    ContextFrameList,
    /// The External Context Frame reading of a supplied sixfold mapping and
    /// structural probe (`ql context-frame read -`, QL-MEF#344;
    /// `ql.mef.context-frame-reading/1.0.0`), the request on stdin.
    /// Descriptive evidence only: QL answers `runtime_authority: false`.
    ContextFrameRead {
        request: Value,
    },
    /// The service provider's negotiated operations (`ql service
    /// capabilities`).
    ServiceCapabilities,
    /// One Vāk entry (`ql vak locate <vak-ref>`).
    VakLocate {
        vak_ref: String,
    },
    /// One Vāk entry's source-locked neighbourhood (`ql vak context
    /// <vak-ref> [depth]`, `ql.vak-context/v1`; QL bounds the depth).
    VakContext {
        vak_ref: String,
        #[serde(default)]
        depth: Option<u8>,
    },
}

/// What a QL reading must carry to be the one asked for.
enum QlCheck {
    Contract(&'static str),
    Fields(&'static [(&'static str, Kind)]),
    Echo(&'static str, String),
}

/// Workcell's cross-cell connection records and declared machines, read
/// only (`workcell connections list|show <label>`, `workcell machine list`).
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum WorkcellRead {
    ConnectionsList,
    ConnectionsShow {
        label: String,
    },
    MachineList,
    /// The zero-setup baseline's findings (`workcell doctor`): declared
    /// services, instances, the shell, a writable state root and workspace.
    Doctor,
    /// The material offers, capacity and health (`workcell discover`).
    Discover,
    /// A materialisation plan for a demand (`workcell plan <demand flags>`):
    /// its bindings, constraints, exposures, omissions and status. An
    /// unsatisfiable plan is Workcell's reading too, carried as it answered.
    Plan {
        #[serde(default)]
        demand: Box<WorkcellDemand>,
    },
    /// Live harness instances (`workcell instances list`).
    InstancesList,
    /// One instance's bounded resource usage (`workcell instances usage
    /// <instance_ref> [--pid N] [--interval-ms N] [--correlation-ref R]…`,
    /// `workcell.resource-usage/v1`).
    InstancesUsage {
        instance_ref: String,
        #[serde(default)]
        pid: Option<u32>,
        #[serde(default)]
        interval_ms: Option<u32>,
        #[serde(default)]
        correlation_refs: Vec<String>,
    },
    /// A prepared world's collected output channels (`workcell --receipt R
    /// collect`): what each logical output's material locator is. A read:
    /// Workcell's collect changes no state.
    Collect {
        receipt: PathBuf,
    },
}

/// A material demand in Workcell's own flag spelling (`workcell plan`): each
/// field one flag, repeated per value. No other flag travels.
#[derive(Clone, Debug, Default, PartialEq, Deserialize, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct WorkcellDemand {
    pub demand_ref: Option<String>,
    pub require: Vec<String>,
    pub prefer: Vec<String>,
    pub optional: Vec<String>,
    pub workspace: Option<String>,
    pub workspace_ref: Option<String>,
    pub revision: Option<String>,
    pub project_runtime: Option<String>,
    pub connect: Vec<String>,
    pub prefer_connect: Vec<String>,
    pub optional_connect: Vec<String>,
    pub expose: Vec<String>,
    pub prefer_expose: Vec<String>,
    pub optional_expose: Vec<String>,
    pub output: Vec<String>,
    pub prefer_output: Vec<String>,
    pub optional_output: Vec<String>,
    pub resource: Vec<String>,
    pub subject: Vec<String>,
    pub persistence: Option<String>,
    pub isolation: Option<String>,
    pub retention: Option<String>,
    pub extension: Vec<String>,
}

impl WorkcellDemand {
    fn args(&self) -> Vec<OsString> {
        let mut args = Vec::new();
        let one = |args: &mut Vec<OsString>, flag: &str, value: &Option<String>| {
            push_flag(args, flag, value.as_deref())
        };
        let many = |args: &mut Vec<OsString>, flag: &str, values: &[String]| {
            for value in values {
                args.push(flag.into());
                args.push(value.into());
            }
        };
        one(&mut args, "--demand-ref", &self.demand_ref);
        many(&mut args, "--require", &self.require);
        many(&mut args, "--prefer", &self.prefer);
        many(&mut args, "--optional", &self.optional);
        one(&mut args, "--workspace", &self.workspace);
        one(&mut args, "--workspace-ref", &self.workspace_ref);
        one(&mut args, "--revision", &self.revision);
        one(&mut args, "--project-runtime", &self.project_runtime);
        many(&mut args, "--connect", &self.connect);
        many(&mut args, "--prefer-connect", &self.prefer_connect);
        many(&mut args, "--optional-connect", &self.optional_connect);
        many(&mut args, "--expose", &self.expose);
        many(&mut args, "--prefer-expose", &self.prefer_expose);
        many(&mut args, "--optional-expose", &self.optional_expose);
        many(&mut args, "--output", &self.output);
        many(&mut args, "--prefer-output", &self.prefer_output);
        many(&mut args, "--optional-output", &self.optional_output);
        many(&mut args, "--resource", &self.resource);
        many(&mut args, "--subject", &self.subject);
        one(&mut args, "--persistence", &self.persistence);
        one(&mut args, "--isolation", &self.isolation);
        one(&mut args, "--retention", &self.retention);
        many(&mut args, "--extension", &self.extension);
        args
    }
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
    /// Mark a connection disconnected; its record is kept (`workcell
    /// connections disconnect <label>`).
    Disconnect {
        label: String,
    },
    /// A prepared world recovered from its receipt, a new receipt written
    /// (`workcell --receipt R recover`).
    Recover {
        receipt: PathBuf,
    },
    /// A prepared world released or preserved (`workcell --receipt R
    /// release`).
    Release {
        receipt: PathBuf,
    },
    /// A world's desired material state reconciled (`workcell --receipt R
    /// reconcile --desired logical-ref=state …`).
    Reconcile {
        receipt: PathBuf,
        desired: Vec<String>,
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

/// AIKit's reads: the capture inbox (`aikit inbox [--all]`), a Wiki file's
/// shapes (`aikit wiki-shape validate|compress --file F`), and one Stream's
/// frames from the running gateway's journal (`aikit gateway replay --stream
/// S`): what passed between a surface and its harness, in sequence — the
/// Frames monitor's reading — beside the gateway's ecology (`aikit gateway
/// ecology`), which names each session's harness and Streams.
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
    GatewayEcology {
        #[serde(default)]
        at: Option<String>,
    },
    /// The star prompt-commands the active composition arms (`aikit work
    /// continuity commands`).
    ContinuityCommands {
        #[serde(default)]
        project: Option<String>,
    },
    /// The context-pressure brackets in effect and this session's reading
    /// (`aikit work continuity pressure`).
    ContinuityPressure {
        #[serde(default)]
        project: Option<String>,
    },
    /// Whether a close-out left the objects it claims (`aikit work
    /// continuity closeout verify [--project P] [--since N] [--run R]`): each
    /// clause read back from its carrier. An unverified close-out is AIKit's
    /// reading too.
    CloseoutVerify {
        #[serde(default)]
        project: Option<String>,
        #[serde(default)]
        since: Option<u64>,
        #[serde(default)]
        run: Option<String>,
    },
    /// One skill source's source, candidate, active and rollback state
    /// (`aikit source show <id>`).
    SourceShow {
        id: String,
    },
    /// The skill trees on this machine, which version runs where (`aikit
    /// collate [--all]`).
    Collate {
        #[serde(default)]
        all: bool,
    },
    /// Adopting a foreign skill root, as a plan only (`aikit adopt <root>
    /// [--namespace N]`, without `--yes`): its diff.
    AdoptPlan {
        root: PathBuf,
        #[serde(default)]
        namespace: Option<String>,
    },
    /// The Procedures with an undo record (`aikit procedure list`), and one
    /// planned Procedure's before/after diff (`aikit procedure diff <id>`).
    ProcedureList,
    ProcedureDiff {
        procedure: String,
    },
    /// Open hook bypass tokens (`aikit bypass list`), never a token.
    BypassList,
    /// Catalogued capabilities never used (`aikit unused`).
    Unused,
    /// Why a capability or Resource has its effective evidence (`aikit
    /// explain [resource]`).
    Explain {
        #[serde(default)]
        resource: Option<String>,
    },
    /// Evidence-bearing History (`aikit history [resource]`, or one of its
    /// views: `recent`, `stats`, `failures`, `bypasses`).
    History {
        #[serde(default)]
        resource: Option<String>,
        #[serde(default)]
        view: Option<HistoryView>,
    },
    /// The knowledge frame over addresses (`aikit knowledge frame <address>…
    /// [--query Q]`).
    KnowledgeFrame {
        addresses: Vec<String>,
        #[serde(default)]
        query: Option<String>,
    },
    GatewayReplay {
        stream: String,
        #[serde(default)]
        after: u64,
        /// AIKit's own bound, 1 to 4096 (its default 256 when absent).
        #[serde(default)]
        limit: Option<u32>,
        /// Another Workcell's declared gateway (`aikit gateway remote list`).
        #[serde(default)]
        at: Option<String>,
    },
}

/// A grouped view of AIKit's History.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum HistoryView {
    Recent,
    Stats,
    Failures,
    Bypasses,
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
    /// Adopt a foreign skill root through a reversible Procedure (`aikit
    /// adopt <root> [--namespace N] --yes`). Never into Control's ground: no
    /// `--control-ground` or `--projection` travels.
    Adopt {
        root: PathBuf,
        #[serde(default)]
        namespace: Option<String>,
    },
    /// Undo a committed Procedure (`aikit procedure undo <id>`).
    ProcedureUndo {
        procedure: String,
    },
    /// Revoke an open hook bypass token (`aikit bypass revoke <id>`). Issuing
    /// one is not routed: it mints a secret.
    BypassRevoke {
        id: String,
    },
    /// A skill source's candidate snapshot made (`aikit source sync <id>`),
    /// promoted (`aikit source promote <id> [--trust | --trust-skill C…]`)
    /// or rolled back (`aikit source rollback <id>`).
    SourceSync {
        id: String,
    },
    SourcePromote {
        id: String,
        #[serde(default)]
        trust: bool,
        #[serde(default)]
        trust_skills: Vec<String>,
    },
    SourceRollback {
        id: String,
    },
    /// Forget what the knowledge route learned for a destination, a route, a
    /// project or everything (`aikit knowledge forget destination|route|
    /// project <resource>` / `all`).
    KnowledgeForget {
        scope: ForgetScope,
        #[serde(default)]
        resource: Option<String>,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ForgetScope {
    Destination,
    Route,
    Project,
    All,
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
            Self::Inbox { project, .. }
            | Self::ContinuityCommands { project }
            | Self::ContinuityPressure { project }
            | Self::CloseoutVerify { project, .. } => project.as_deref(),
            Self::WikiShapeValidate { .. }
            | Self::WikiShapeCompress { .. }
            | Self::GatewayEcology { .. }
            | Self::GatewayReplay { .. }
            | Self::SourceShow { .. }
            | Self::Collate { .. }
            | Self::AdoptPlan { .. }
            | Self::ProcedureList
            | Self::ProcedureDiff { .. }
            | Self::BypassList
            | Self::Unused
            | Self::Explain { .. }
            | Self::History { .. }
            | Self::KnowledgeFrame { .. } => None,
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
            Self::WikiShapeDeclare { .. }
            | Self::Adopt { .. }
            | Self::ProcedureUndo { .. }
            | Self::BypassRevoke { .. }
            | Self::SourceSync { .. }
            | Self::SourcePromote { .. }
            | Self::SourceRollback { .. }
            | Self::KnowledgeForget { .. } => None,
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
    let route = call.route.clone();
    let output = spawn(call)?;
    if !output.status.success() {
        return Err(refused(
            crate::inhabitation::refusal_words(&output.stdout, &output.stderr),
            false,
        ));
    }
    let document: Value = serde_json::from_slice(&output.stdout).map_err(|error| {
        incompatible(format!("{route} answered without a JSON document: {error}"))
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

/// The owner process itself, through the limiter within its bound: its exit,
/// stdout and stderr, for the routes whose owner answers a reading together
/// with a non-zero exit (Workcell's unsatisfiable plan).
fn spawn(call: Call<'_>) -> Result<std::process::Output, Error> {
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
    crate::owner_process::output(
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
    })
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
            Kind::Record => value.is_object(),
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
    Record,
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
        ActuationRead::AuthorityList => ("authority list", "actuation.local-authority-listing/v1"),
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
    if let ActuationRead::AuthorityList = request {
        let route = "actuation authority list";
        let call = Call::new(
            actuation(),
            route,
            words(&["authority", "list", "--json"]),
            READ_LIMIT,
        );
        let data = schema(route, run(call)?, wanted)?;
        let data = fields(
            route,
            data,
            &[("authorities", Kind::List), ("invalid", Kind::List)],
        )?;
        return Ok(reading(route.into(), data, Vec::new()));
    }
    let document = match request {
        ActuationRead::Agency { document }
        | ActuationRead::Realised { document }
        | ActuationRead::Stream { document }
        | ActuationRead::Activity { document }
        | ActuationRead::Usage { document } => document,
        ActuationRead::Comparison { .. } | ActuationRead::AuthorityList => {
            unreachable!("answered above")
        }
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

pub fn actuation_write(request: &ActuationWrite) -> Result<Written, String> {
    actuation_written(request).map_err(wire)
}

const LOCAL_AUTHORITY: &str = "actuation.local-authority/v1";

fn actuation_written(request: &ActuationWrite) -> Result<Written, Error> {
    let (route, args, input, wanted, flag) = match request {
        ActuationWrite::AuthorityIssue { record } => {
            let Some(source) = record.get("authority_source_ref").and_then(Value::as_str) else {
                return Err(incompatible(
                    "actuation authority issue takes one governing record naming its authority_source_ref".into(),
                ));
            };
            (
                "actuation authority issue",
                words(&["authority", "issue", "-", "--json"]),
                Some(object_bytes(record)?),
                source.to_owned(),
                "issued",
            )
        }
        ActuationWrite::AuthorityRevoke {
            authority_source_ref,
            reason,
        } => {
            let mut args = words(&["authority", "revoke"]);
            args.push(authority_source_ref.into());
            push_flag(&mut args, "--reason", reason.as_deref());
            args.push("--json".into());
            (
                "actuation authority revoke",
                args,
                None,
                authority_source_ref.clone(),
                "revoked",
            )
        }
    };
    let mut call = Call::new(actuation(), route, args, OWNER_WRITE_LIMIT);
    call.effect = Effect::Write;
    call.input = input;
    let data = schema(route, run(call)?, LOCAL_AUTHORITY)?;
    if data.get("authority_source_ref").and_then(Value::as_str) != Some(wanted.as_str())
        || data.get(flag) != Some(&Value::Bool(true))
    {
        return Err(unexpected(
            route,
            &format!("{flag} true for {wanted}"),
            &data,
        ));
    }
    Ok(Written {
        reading: reading(route.into(), data, Vec::new()),
        moved: Some(Moved {
            owner: "actuation",
            action: route.into(),
            reference: wanted,
            revision: None,
        }),
    })
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
            Some(request),
            "ql.m1.engine/v1",
            READ_LIMIT,
        ),
        QlRead::SceneCompose { request } => (
            "ql scene compose",
            words(&["scene", "compose", "-", "--json"]),
            Some(request),
            "ql.scene/v1",
            SCENE_LIMIT,
        ),
        QlRead::SceneWorld { request } => (
            "ql scene world",
            words(&["scene", "world", "-", "--json"]),
            Some(request),
            "ql.scene-world/v1",
            SCENE_LIMIT,
        ),
        QlRead::KernelLedger { coordinate } => {
            let mut args = words(&["kernel", "ledger"]);
            if let Some(coordinate) = coordinate {
                args.push(coordinate.into());
            }
            args.push("--json".into());
            let wanted = if coordinate.is_some() {
                "ql.m-ledger-view/v1"
            } else {
                "ql.m-ledger/v1"
            };
            ("ql kernel ledger", args, None, wanted, READ_LIMIT)
        }
        QlRead::KernelCoverage {
            coordinate,
            stratum,
            axis,
            require,
        } => {
            let mut args = words(&["kernel", "coverage"]);
            args.push(coordinate.into());
            push_flag(&mut args, "--stratum", stratum.as_deref());
            push_flag(&mut args, "--axis", axis.as_deref());
            push_flag(&mut args, "--require", require.as_deref());
            args.push("--json".into());
            (
                "ql kernel coverage",
                args,
                None,
                "ql.m-coverage/v1",
                READ_LIMIT,
            )
        }
        other => return ql_registry_answer(other),
    };
    let mut call = Call::new(ql(), route, args, limit);
    call.input = document.map(object_bytes).transpose()?;
    let data = schema(route, run(call)?, wanted)?;
    Ok(reading(route.into(), data, Vec::new()))
}

/// QL's registry, Vāk, Technē and operator reads: none carries a `schema`
/// field, so each is checked by what QL's own reply names (its `contract`,
/// the fields its view declares, or the ref it echoes).
fn ql_registry_answer(request: &QlRead) -> Result<Reading, Error> {
    const LENSES: &[(&str, Kind)] = &[("registryVersion", Kind::Text), ("lenses", Kind::List)];
    const FRAMES: &[(&str, Kind)] = &[("grammarVersion", Kind::Text), ("frames", Kind::List)];
    const SERVICE: &[(&str, Kind)] = &[("providerState", Kind::Text), ("operations", Kind::List)];
    let (route, args, document, check) = match request {
        QlRead::KernelApply { operator, address } => {
            let mut args = words(&["kernel", "apply"]);
            args.push(operator.into());
            args.push(address.into());
            args.push("--json".into());
            (
                "ql kernel apply",
                args,
                None,
                QlCheck::Echo("operation", operator.clone()),
            )
        }
        QlRead::TechneReading { target } => (
            "ql techne reading",
            words(&["techne", "reading", "/dev/stdin", "--json"]),
            Some(target),
            QlCheck::Contract("ql.techne/v1"),
        ),
        QlRead::MefLenses => (
            "ql mef lenses",
            words(&["mef", "lenses", "--json"]),
            None,
            QlCheck::Fields(LENSES),
        ),
        QlRead::ContextFrameList => (
            "ql context-frame list",
            words(&["context-frame", "list", "--json"]),
            None,
            QlCheck::Fields(FRAMES),
        ),
        QlRead::ContextFrameRead { request } => (
            "ql context-frame read",
            words(&["context-frame", "read", "-", "--json"]),
            Some(request),
            QlCheck::Contract("ql.mef.context-frame-reading/1.0.0"),
        ),
        QlRead::ServiceCapabilities => (
            "ql service capabilities",
            words(&["service", "capabilities", "--json"]),
            None,
            QlCheck::Fields(SERVICE),
        ),
        QlRead::VakLocate { vak_ref } => {
            let mut args = words(&["vak", "locate"]);
            args.push(vak_ref.into());
            args.push("--json".into());
            (
                "ql vak locate",
                args,
                None,
                QlCheck::Echo("vakRef", vak_ref.clone()),
            )
        }
        QlRead::VakContext { vak_ref, depth } => {
            let mut args = words(&["vak", "context"]);
            args.push(vak_ref.into());
            if let Some(depth) = depth {
                args.push(depth.to_string().into());
            }
            args.push("--json".into());
            (
                "ql vak context",
                args,
                None,
                QlCheck::Contract("ql.vak-context/v1"),
            )
        }
        _ => unreachable!("the M-engine, scene and ledger reads are answered by ql_answer"),
    };
    let mut call = Call::new(ql(), route, args, READ_LIMIT);
    call.input = document.map(object_bytes).transpose()?;
    let data = run(call)?;
    let data = match check {
        QlCheck::Contract(wanted) => {
            if data.get("contract").and_then(Value::as_str) != Some(wanted) {
                return Err(unexpected(route, wanted, &data));
            }
            data
        }
        QlCheck::Fields(wanted) => fields(route, data, wanted)?,
        QlCheck::Echo(field, asked) => {
            if data.get(field).and_then(Value::as_str) != Some(asked.as_str()) {
                return Err(unexpected(route, &format!("{field} {asked}"), &data));
            }
            data
        }
    };
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
        WorkcellRead::Doctor => {
            return workcell_findings(
                Call::new(
                    workcell(),
                    "workcell doctor",
                    words(&["doctor", "--json"]),
                    READ_LIMIT,
                ),
                &["state_root_writable", "instances"],
            )
        }
        WorkcellRead::Discover => ("workcell discover", words(&["discover", "--json"])),
        WorkcellRead::Plan { demand } => {
            let mut args = words(&["plan"]);
            args.extend(demand.args());
            args.push("--json".into());
            return workcell_findings(
                Call::new(workcell(), "workcell plan", args, READ_LIMIT),
                &["plan_ref", "status"],
            );
        }
        WorkcellRead::InstancesList => (
            "workcell instances list",
            words(&["instances", "list", "--json"]),
        ),
        WorkcellRead::InstancesUsage {
            instance_ref,
            pid,
            interval_ms,
            correlation_refs,
        } => {
            let mut args = words(&["instances", "usage"]);
            args.push(instance_ref.into());
            push_flag(
                &mut args,
                "--pid",
                pid.map(|pid| pid.to_string()).as_deref(),
            );
            push_flag(
                &mut args,
                "--interval-ms",
                interval_ms.map(|ms| ms.to_string()).as_deref(),
            );
            for reference in correlation_refs {
                args.push("--correlation-ref".into());
                args.push(reference.into());
            }
            args.push("--json".into());
            ("workcell instances usage", args)
        }
        WorkcellRead::Collect { receipt } => {
            let mut args = words(&["--receipt"]);
            args.push(receipt.into());
            args.extend(words(&["collect", "--json"]));
            ("workcell collect", args)
        }
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
        WorkcellRead::Discover => fields(route, data, &[("offers", Kind::List)])?,
        WorkcellRead::InstancesList => fields(route, data, &[("instances", Kind::List)])?,
        WorkcellRead::InstancesUsage { .. } => schema(route, data, "workcell.resource-usage/v1")?,
        WorkcellRead::Collect { .. } => fields(
            route,
            data,
            &[("world_ref", Kind::Text), ("outputs", Kind::List)],
        )?,
        WorkcellRead::Plan { .. } | WorkcellRead::Doctor => {
            unreachable!("answered by workcell_findings")
        }
    };
    Ok(reading(route.into(), data, Vec::new()))
}

/// Workcell's plan and doctor: a satisfiable plan or a clean baseline exits
/// 0; an unsatisfiable plan (its omissions named) or a failing baseline
/// prints the same reading with `ok: false` and exits non-zero with its own
/// error on stderr. Either is Workcell's reading; a document without the
/// reading's fields is its refusal.
fn workcell_findings(call: Call<'_>, required: &[&str]) -> Result<Reading, Error> {
    let route = call.route.clone();
    let output = spawn(call)?;
    let found = serde_json::from_slice::<Value>(&output.stdout)
        .ok()
        .filter(|found| {
            required
                .iter()
                .all(|field| found.get(*field).is_some_and(|v| !v.is_null()))
        });
    match found {
        Some(found) => Ok(reading(route, found, Vec::new())),
        None if !output.status.success() => Err(refused(
            crate::inhabitation::refusal_words(&output.stdout, &output.stderr),
            false,
        )),
        None => Err(unexpected(
            &route,
            &required.join(", "),
            &serde_json::from_slice(&output.stdout).unwrap_or(Value::Null),
        )),
    }
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
        AikitRead::ContinuityCommands { .. } => (
            "aikit work continuity commands",
            words(&["work", "continuity", "commands", "--json"]),
        ),
        AikitRead::ContinuityPressure { .. } => (
            "aikit work continuity pressure",
            words(&["work", "continuity", "pressure", "--json"]),
        ),
        AikitRead::CloseoutVerify {
            project,
            since,
            run,
        } => {
            let mut args = words(&["work", "continuity", "closeout", "verify"]);
            push_flag(&mut args, "--project", project.as_deref());
            push_flag(
                &mut args,
                "--since",
                since.map(|since| since.to_string()).as_deref(),
            );
            push_flag(&mut args, "--run", run.as_deref());
            args.push("--json".into());
            ("aikit work continuity closeout verify", args)
        }
        AikitRead::SourceShow { id } => {
            let mut args = words(&["source", "show"]);
            args.push(id.into());
            args.push("--json".into());
            ("aikit source show", args)
        }
        AikitRead::Collate { all } => {
            let mut args = words(&["collate"]);
            if *all {
                args.push("--all".into());
            }
            args.push("--json".into());
            ("aikit collate", args)
        }
        AikitRead::AdoptPlan { root, namespace } => {
            let mut args = words(&["adopt"]);
            args.push(root.into());
            push_flag(&mut args, "--namespace", namespace.as_deref());
            args.push("--json".into());
            ("aikit adopt", args)
        }
        AikitRead::ProcedureList => (
            "aikit procedure list",
            words(&["procedure", "list", "--json"]),
        ),
        AikitRead::ProcedureDiff { procedure } => {
            let mut args = words(&["procedure", "diff"]);
            args.push(procedure.into());
            args.push("--json".into());
            ("aikit procedure diff", args)
        }
        AikitRead::BypassList => ("aikit bypass list", words(&["bypass", "list", "--json"])),
        AikitRead::Unused => ("aikit unused", words(&["unused", "--json"])),
        AikitRead::Explain { resource } => {
            let mut args = words(&["explain"]);
            if let Some(resource) = resource {
                args.push(resource.into());
            }
            args.push("--json".into());
            ("aikit explain", args)
        }
        AikitRead::History { resource, view } => {
            let mut args = words(&["history"]);
            if let Some(resource) = resource {
                args.push(resource.into());
            }
            if let Some(view) = view {
                args.push(
                    match view {
                        HistoryView::Recent => "recent",
                        HistoryView::Stats => "stats",
                        HistoryView::Failures => "failures",
                        HistoryView::Bypasses => "bypasses",
                    }
                    .into(),
                );
            }
            args.push("--json".into());
            ("aikit history", args)
        }
        AikitRead::KnowledgeFrame { addresses, query } => {
            let mut args = words(&["knowledge", "frame"]);
            args.extend(addresses.iter().map(OsString::from));
            push_flag(&mut args, "--query", query.as_deref());
            args.push("--json".into());
            ("aikit knowledge frame", args)
        }
        AikitRead::GatewayEcology { at } => {
            let mut args = words(&["gateway", "ecology"]);
            push_flag(&mut args, "--at", at.as_deref());
            args.push("--json".into());
            ("aikit gateway ecology", args)
        }
        AikitRead::GatewayReplay {
            stream,
            after,
            limit,
            at,
        } => {
            let mut args = words(&["gateway", "replay", "--stream"]);
            args.push(stream.into());
            if *after > 0 {
                args.push("--after".into());
                args.push(after.to_string().into());
            }
            if let Some(limit) = limit {
                args.push("--limit".into());
                args.push(limit.to_string().into());
            }
            push_flag(&mut args, "--at", at.as_deref());
            args.push("--json".into());
            ("aikit gateway replay", args)
        }
    }
}

/// One AIKit reading, run from `cwd` (Central's disclosed ground for the
/// scope, else AIKit resolves its own).
pub fn aikit_read(request: &AikitRead, cwd: Option<&Path>) -> Result<Reading, String> {
    aikit_read_answer(request, cwd).map_err(wire)
}

fn aikit_read_answer(request: &AikitRead, cwd: Option<&Path>) -> Result<Reading, Error> {
    if let AikitRead::KnowledgeFrame { addresses, .. } = request {
        if addresses.is_empty() {
            return Err(incompatible(
                "aikit knowledge frame takes at least one address".into(),
            ));
        }
    }
    let (route, args) = aikit_read_args(request);
    let mut call = Call::new(aikit(), route, args, READ_LIMIT);
    call.cwd = cwd;
    let (data, warnings) = envelope(route, aikit_document(call)?)?;
    const COMMANDS: &[(&str, Kind)] = &[("packs", Kind::List), ("armed", Kind::List)];
    const PRESSURE: &[(&str, Kind)] = &[("brackets", Kind::Record)];
    const CLOSEOUT: &[(&str, Kind)] = &[("clauses", Kind::List), ("verified", Kind::Flag)];
    let data = match request {
        AikitRead::ContinuityCommands { .. } => fields(route, data, COMMANDS)?,
        AikitRead::ContinuityPressure { .. } => fields(route, data, PRESSURE)?,
        AikitRead::CloseoutVerify { .. } => fields(route, data, CLOSEOUT)?,
        AikitRead::Collate { .. } => fields(route, data, &[("clusters", Kind::List)])?,
        AikitRead::ProcedureList => fields(route, data, &[("procedures", Kind::List)])?,
        AikitRead::BypassList => fields(route, data, &[("bypasses", Kind::List)])?,
        AikitRead::Unused => fields(route, data, &[("unused", Kind::List)])?,
        AikitRead::History { view, .. } => match view {
            None => schema(route, data, "aikit.explain-history/v1")?,
            Some(HistoryView::Recent) => fields(route, data, &[("events", Kind::List)])?,
            Some(HistoryView::Stats) => fields(route, data, &[("by_kind", Kind::List)])?,
            Some(HistoryView::Failures) => fields(route, data, &[("failures", Kind::List)])?,
            Some(HistoryView::Bypasses) => fields(route, data, &[("bypasses", Kind::List)])?,
        },
        // Each answered as AIKit's own record for what was asked; no field of
        // theirs is fixed enough to name here.
        AikitRead::SourceShow { .. }
        | AikitRead::AdoptPlan { .. }
        | AikitRead::ProcedureDiff { .. }
        | AikitRead::Explain { .. }
        | AikitRead::KnowledgeFrame { .. } => data,
        AikitRead::Inbox { .. } => fields(route, data, &[("items", Kind::List)])?,
        AikitRead::WikiShapeValidate { .. } => {
            if data.get("command").and_then(Value::as_str) != Some("wiki-shape.validate") {
                return Err(unexpected(route, "wiki-shape.validate", &data));
            }
            data
        }
        // The 6+6′ compression's own record (AIKit's `compress_six_plus_six_prime`).
        AikitRead::WikiShapeCompress { .. } => data,
        AikitRead::GatewayEcology { .. } => {
            if data.get("type").and_then(Value::as_str) != Some("ecology")
                || !data
                    .pointer("/ecology/agencies")
                    .is_some_and(Value::is_array)
            {
                return Err(unexpected(route, "the gateway's ecology", &data));
            }
            data
        }
        // The gateway's replay of the Stream asked for (`GatewayReplay`).
        AikitRead::GatewayReplay { stream, .. } => {
            if data.get("type").and_then(Value::as_str) != Some("replay")
                || data.pointer("/replay/stream_ref").and_then(Value::as_str) != Some(stream)
                || !data.pointer("/replay/events").is_some_and(Value::is_array)
            {
                return Err(unexpected(route, &format!("the replay of {stream}"), &data));
            }
            data
        }
    };
    if !data.is_object() {
        return Err(unexpected(route, "a reading", &data));
    }
    Ok(reading(route.into(), data, warnings))
}

/// AIKit's `--json` document, with its exit read as AIKit means it: an
/// envelope that says `ok: true` is a reading whatever the exit (a close-out
/// that is not verified exits 1 with its verdict), and anything else beside a
/// non-zero exit is AIKit's refusal in its words.
fn aikit_document(call: Call<'_>) -> Result<Value, Error> {
    let route = call.route.clone();
    let output = spawn(call)?;
    let document = serde_json::from_slice::<Value>(&output.stdout).ok();
    match document {
        Some(document) if document.get("ok") == Some(&Value::Bool(true)) => Ok(document),
        _ if !output.status.success() => Err(refused(
            crate::inhabitation::refusal_words(&output.stdout, &output.stderr),
            false,
        )),
        Some(document) => {
            if document.get("ok") == Some(&Value::Bool(false)) {
                let stdout = serde_json::to_vec(&document).unwrap_or_default();
                return Err(refused(
                    crate::inhabitation::refusal_words(&stdout, b""),
                    false,
                ));
            }
            Ok(document)
        }
        None => Err(incompatible(format!(
            "{route} answered without a JSON document"
        ))),
    }
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
        other => return workcell_world_written(other),
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

/// Workcell's writes on a prepared world (recover, release, reconcile) and a
/// connection's disconnect: each moves Workcell's own state, so each is a
/// write; the receipt is recorded where Workcell's answer says something
/// changed.
fn workcell_world_written(request: &WorkcellWrite) -> Result<Written, Error> {
    let with_receipt = |receipt: &PathBuf, verb: &[&str]| {
        let mut args = words(&["--receipt"]);
        args.push(receipt.into());
        args.extend(words(verb));
        args
    };
    let (route, mut args) = match request {
        WorkcellWrite::Disconnect { label } => {
            let mut args = words(&["connections", "disconnect"]);
            args.push(label.into());
            ("workcell connections disconnect", args)
        }
        WorkcellWrite::Recover { receipt } => {
            ("workcell recover", with_receipt(receipt, &["recover"]))
        }
        WorkcellWrite::Release { receipt } => {
            ("workcell release", with_receipt(receipt, &["release"]))
        }
        WorkcellWrite::Reconcile { receipt, desired } => {
            if desired.is_empty() {
                return Err(incompatible(
                    "workcell reconcile needs at least one logical-ref=state".into(),
                ));
            }
            let mut args = with_receipt(receipt, &["reconcile"]);
            for state in desired {
                args.push("--desired".into());
                args.push(state.into());
            }
            ("workcell reconcile", args)
        }
        _ => unreachable!("answered by workcell_written"),
    };
    args.push("--json".into());
    let mut call = Call::new(workcell(), route, args, OWNER_WRITE_LIMIT);
    call.effect = Effect::Write;
    let data = run(call)?;
    let (data, reference) = match request {
        WorkcellWrite::Disconnect { label } => {
            let data = fields(
                route,
                data,
                &[("label", Kind::Text), ("changed", Kind::Flag)],
            )?;
            let changed = data.get("changed") == Some(&Value::Bool(true));
            (data, changed.then(|| label.clone()))
        }
        WorkcellWrite::Recover { .. } => {
            let data = fields(
                route,
                data,
                &[("receipt", Kind::Text), ("world", Kind::Record)],
            )?;
            let reference = named(&data, &["/world/world_ref", "/receipt"]);
            (data, reference)
        }
        WorkcellWrite::Release { .. } => {
            let data = fields(
                route,
                data,
                &[("world_ref", Kind::Text), ("changed", Kind::Flag)],
            )?;
            let changed = data.get("changed") == Some(&Value::Bool(true));
            let reference = changed.then(|| named(&data, &["/world_ref"])).flatten();
            (data, reference)
        }
        WorkcellWrite::Reconcile { receipt, .. } => {
            let data = fields(route, data, &[("deltas", Kind::List)])?;
            let moved = data["deltas"]
                .as_array()
                .is_some_and(|deltas| !deltas.is_empty());
            (data, moved.then(|| receipt.display().to_string()))
        }
        _ => unreachable!(),
    };
    Ok(Written {
        moved: reference.map(|reference| Moved {
            owner: "workcell",
            action: route.into(),
            reference,
            revision: None,
        }),
        reading: reading(route.into(), data, Vec::new()),
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
        AikitWrite::Adopt { root, namespace } => {
            let mut args = words(&["adopt"]);
            args.push(root.into());
            push_flag(&mut args, "--namespace", namespace.as_deref());
            args.push("--yes".into());
            ("aikit adopt", args)
        }
        AikitWrite::ProcedureUndo { procedure } => {
            let mut args = words(&["procedure", "undo"]);
            args.push(procedure.into());
            ("aikit procedure undo", args)
        }
        AikitWrite::BypassRevoke { id } => {
            let mut args = words(&["bypass", "revoke"]);
            args.push(id.into());
            ("aikit bypass revoke", args)
        }
        AikitWrite::SourceSync { id } => {
            let mut args = words(&["source", "sync"]);
            args.push(id.into());
            limit = LONG_WRITE_LIMIT;
            ("aikit source sync", args)
        }
        AikitWrite::SourcePromote {
            id,
            trust,
            trust_skills,
        } => {
            let mut args = words(&["source", "promote"]);
            args.push(id.into());
            if *trust {
                args.push("--trust".into());
            }
            for capsule in trust_skills {
                args.push("--trust-skill".into());
                args.push(capsule.into());
            }
            ("aikit source promote", args)
        }
        AikitWrite::SourceRollback { id } => {
            let mut args = words(&["source", "rollback"]);
            args.push(id.into());
            ("aikit source rollback", args)
        }
        AikitWrite::KnowledgeForget { scope, resource } => {
            let mut args = words(&["knowledge", "forget"]);
            let (verb, needs) = match scope {
                ForgetScope::Destination => ("destination", true),
                ForgetScope::Route => ("route", true),
                ForgetScope::Project => ("project", true),
                ForgetScope::All => ("all", false),
            };
            args.push(verb.into());
            match (needs, resource) {
                (true, Some(resource)) => args.push(resource.into()),
                (false, None) => {}
                (true, None) => {
                    return Err(incompatible(format!(
                        "aikit knowledge forget {verb} names the resource it forgets"
                    )))
                }
                (false, Some(_)) => {
                    return Err(incompatible(
                        "aikit knowledge forget all names no resource".into(),
                    ))
                }
            }
            ("aikit knowledge forget", args)
        }
    };
    args.push("--json".into());
    let mut call = Call::new(aikit(), route, args, limit);
    call.input = input;
    call.cwd = cwd;
    call.effect = Effect::Write;
    let (data, warnings) = envelope(route, aikit_document(call)?)?;
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
        AikitWrite::KnowledgeForget { resource, .. } => {
            let data = fields(
                route,
                data,
                &[("forgot", Kind::Record), ("preserved", Kind::List)],
            )?;
            let reference = resource.clone().or_else(|| Some("all".into()));
            (data, reference)
        }
        // AIKit's own record for each; it names nothing fixed enough to check
        // beyond the envelope, and what moved is the thing asked of it.
        AikitWrite::Adopt { root, .. } => {
            let reference = named(&data, &["/procedure", "/procedure_ref", "/id"])
                .or_else(|| Some(root.display().to_string()));
            (data, reference)
        }
        AikitWrite::ProcedureUndo { procedure } => (data, Some(procedure.clone())),
        AikitWrite::BypassRevoke { id }
        | AikitWrite::SourceSync { id }
        | AikitWrite::SourcePromote { id, .. }
        | AikitWrite::SourceRollback { id } => {
            let unchanged = data.get("changed") == Some(&Value::Bool(false));
            (data, (!unchanged).then(|| id.clone()))
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
