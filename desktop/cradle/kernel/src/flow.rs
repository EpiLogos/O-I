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
            Self::Unavailable { detail } => write!(formatter, "Central owner CLI unavailable: {detail}"),
            Self::Refused { message } => write!(formatter, "Central owner Action refused: {message}"),
            Self::Malformed { detail } => write!(formatter, "Central owner Action returned an unparseable answer: {detail}"),
        }
    }
}

impl std::error::Error for OwnerCallError {}

/// The stable request vocabulary the cradle kernel exposes for Central's
/// retained Flow and explicit source-return Actions. Inputs stay owner-shaped:
/// the kernel does not invent refs, revisions, actors, sessions or acceptance.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum Request {
    FlowInspect {
        project: String,
        flow_ref: String,
    },
    FlowList {
        project: String,
    },
    FlowRead {
        project: String,
        flow_ref: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        expected_revision: Option<String>,
    },
    FlowCreate {
        project: String,
        actor: String,
        actor_kind: String,
        #[serde(default)]
        local_stamp: Option<String>,
        #[serde(default)]
        path: Option<String>,
        #[serde(default)]
        title: Option<String>,
        #[serde(default)]
        agent_session_ref: Option<String>,
    },
    FlowAdopt {
        project: String,
        path: String,
        actor: String,
        actor_kind: String,
        #[serde(default)]
        title: Option<String>,
        #[serde(default)]
        agent_session_ref: Option<String>,
    },
    FlowWrite {
        project: String,
        flow_ref: String,
        expected_revision: String,
        content: String,
        actor: String,
        actor_kind: String,
        #[serde(default)]
        agent_session_ref: Option<String>,
    },
    FlowRename {
        project: String,
        flow_ref: String,
        expected_revision: String,
        new_path: String,
    },
    FlowLifecycle {
        project: String,
        flow_ref: String,
        expected_revision: String,
        lifecycle: String,
    },
    FlowHistory {
        project: String,
        flow_ref: String,
    },
    SourceReturn {
        project: String,
        source_ref: String,
        expected_revision: String,
        proposed_content: String,
        reason: String,
        #[serde(default)]
        evidence_refs: Vec<String>,
        agent_session_ref: String,
    },
    SourceReturns {
        project: String,
        #[serde(default)]
        limit: Option<u64>,
        #[serde(default)]
        before: Option<String>,
    },
    SourceReturnRead {
        project: String,
        return_ref: String,
    },
    SourceReturnAccept {
        project: String,
        return_ref: String,
        expected_revision: String,
        acceptance: String,
        accepted_by_ref: String,
    },
    SourceReturnReject {
        project: String,
        return_ref: String,
    },
}

impl Request {
    pub fn owner_action(&self) -> &'static str {
        match self {
            Self::FlowInspect { .. } => "projectcentral.flow.inspect",
            Self::FlowList { .. } => "projectcentral.flow.list",
            Self::FlowRead { .. } => "projectcentral.flow.read",
            Self::FlowCreate { .. } => "projectcentral.flow.create",
            Self::FlowAdopt { .. } => "projectcentral.flow.adopt",
            Self::FlowWrite { .. } => "projectcentral.flow.write",
            Self::FlowRename { .. } => "projectcentral.flow.rename",
            Self::FlowLifecycle { .. } => "projectcentral.flow.lifecycle",
            Self::FlowHistory { .. } => "projectcentral.flow.history",
            Self::SourceReturn { .. } => "projectcentral.source.return",
            Self::SourceReturns { .. } => "projectcentral.source.returns",
            Self::SourceReturnRead { .. } => "projectcentral.source.return_read",
            Self::SourceReturnAccept { .. } => "projectcentral.source.return_accept",
            Self::SourceReturnReject { .. } => "projectcentral.source.return_reject",
        }
    }
}

/// Typed owner readings carried by the kernel result. The response variants
/// intentionally retain the owner envelope's distinction between a Flow
/// record, a source-return reading, a mutation receipt and a refusal.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Response {
    FlowInspection { inspection: FlowInspection },
    FlowList { listing: FlowList },
    FlowRead { reading: FlowReading },
    FlowCreated { reading: FlowMutationReading },
    FlowAdopted { reading: FlowMutationReading },
    FlowWritten { reading: FlowMutationReading },
    FlowRenamed { reading: FlowMutationReading },
    FlowLifecycleChanged { reading: FlowMutationReading },
    FlowHistory { history: FlowHistory },
    SourceReturnCreated { reading: SourceReturnReading },
    SourceReturns { listing: SourceReturns },
    SourceReturnRead { reading: SourceReturnReading },
    SourceReturnAccepted { mutation: SourceReturnMutation },
    SourceReturnRejected { reading: SourceReturnReading },
    Failure {
        action: String,
        error: OwnerCallError,
    },
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
}

impl CentralClient {
    /// Discover the client from the cradle's environment. The default
    /// project query is the O-I ground the cradle opens over (`project:o-i`
    /// is Central's id; the owner Actions accept `o-i`).
    pub fn discover() -> Self {
        let executable = env::var_os("OI_BIN")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("oi"));
        let central_root = env::var_os("OI_CENTRAL_ROOT").map(PathBuf::from);
        let project_query =
            env::var("OI_CENTRAL_PROJECT_QUERY").unwrap_or_else(|_| "o-i".to_owned());
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
        }
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
    pub fn configured_project(&self) -> &str {
        &self.project_query
    }

    fn project_of(&self, project: Option<&str>) -> String {
        project.unwrap_or(&self.project_query).to_owned()
    }

    /// Run one owner Action, ported envelope law: `--json` global flag,
    /// optional `--root`, `action run <action> <input-json>`; `ok` must be
    /// true; the `data` payload is returned. Spawn failures are
    /// `Unavailable`; `ok:false` is `Refused` with the owner's message.
    pub fn run(&self, action: &str, mut input: Value) -> Result<Value, OwnerCallError> {
        if let Some(object) = input.as_object_mut() {
            object
                .entry("project".to_owned())
                .or_insert_with(|| Value::String(self.project_query.clone()));
        }
        let mut command = Command::new(&self.executable);
        if self.suite_route {
            command.arg("central");
            if let Some(owner) = &self.central_executable {
                command.env("OI_CENTRAL_CTRL_BIN", owner);
            }
        }
        command.arg("--json");
        if let Some(root) = &self.central_root {
            command.arg("--root").arg(root);
        }
        command
            .arg("action")
            .arg("run")
            .arg(action)
            .arg(serde_json::to_string(&input).map_err(|error| OwnerCallError::Malformed {
                detail: format!("encode {action} input: {error}"),
            })?);
        let output = command.output().map_err(|error| OwnerCallError::Unavailable {
            detail: format!("launch {} for {action}: {error}", self.executable.display()),
        })?;
        let stdout = String::from_utf8(output.stdout).map_err(|error| {
            OwnerCallError::Malformed {
                detail: format!("{action} returned non-UTF8 output: {error}"),
            }
        })?;
        let value: Value = serde_json::from_str(stdout.trim()).map_err(|error| {
            OwnerCallError::Malformed {
                detail: format!("{action} returned invalid structured output: {error}"),
            }
        })?;
        if value.get("ok").and_then(Value::as_bool) != Some(true) {
            return Err(OwnerCallError::Refused {
                message: value
                    .pointer("/error/message")
                    .and_then(Value::as_str)
                    .or_else(|| value.get("message").and_then(Value::as_str))
                    .unwrap_or("Central owner Action failed")
                    .to_owned(),
            });
        }
        if !output.status.success() {
            return Err(OwnerCallError::Malformed {
                detail: format!("{action} returned success JSON with process status {}", output.status),
            });
        }
        Ok(value.get("data").cloned().unwrap_or(Value::Null))
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
        let project = self.project_of(project);
        let data = self.run(
            "projectcentral.source.read",
            json!({ "project": project, "source_ref": source_ref }),
        )?;
        let reading: SourceReading = serde_json::from_value(data).map_err(|error| {
            OwnerCallError::Malformed {
                detail: format!("decode Central source reading: {error}"),
            }
        })?;
        if reading.schema != SOURCE_READING_SCHEMA {
            return Err(OwnerCallError::Malformed {
                detail: format!("unsupported Central source reading schema `{}`", reading.schema),
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
        let project = self.project_of(project);
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
        let receipt: SourceWriteReceipt = serde_json::from_value(
            data.get("receipt").cloned().unwrap_or_else(|| data.clone()),
        )
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

    /// Inspect one retained Flow without reading its body. Central remains
    /// the authority for capability availability and the last revision.
    pub fn flow_inspect(
        &self,
        project: &str,
        flow_ref: &str,
    ) -> Result<FlowInspection, OwnerCallError> {
        let data = self.run(
            "projectcentral.flow.inspect",
            json!({ "project": project, "flow_ref": flow_ref }),
        )?;
        let result: FlowInspection = decode_owner("projectcentral.flow.inspect", data)?;
        ensure_schema(
            "projectcentral.flow.inspect",
            &result.schema,
            FLOW_INSPECTION_SCHEMA,
        )?;
        Ok(result)
    }

    /// List retained Flows. The returned records, including source refs and
    /// revision provenance, are carried verbatim from Central.
    pub fn flow_list(&self, project: &str) -> Result<FlowList, OwnerCallError> {
        let data = self.run(
            "projectcentral.flow.list",
            json!({ "project": project }),
        )?;
        let result: FlowList = decode_owner("projectcentral.flow.list", data)?;
        ensure_schema("projectcentral.flow.list", &result.schema, FLOW_LIST_SCHEMA)?;
        Ok(result)
    }

    /// Read one Flow body by its stable FlowRef. An optional expected revision
    /// is forwarded to Central for its own read-time compare.
    pub fn flow_read(
        &self,
        project: &str,
        flow_ref: &str,
        expected_revision: Option<&str>,
    ) -> Result<FlowReading, OwnerCallError> {
        let mut input = json!({ "project": project, "flow_ref": flow_ref });
        if let Some(expected_revision) = expected_revision {
            input["expected_revision"] = Value::String(expected_revision.to_owned());
        }
        let data = self.run("projectcentral.flow.read", input)?;
        let result: FlowReading = decode_owner("projectcentral.flow.read", data)?;
        ensure_schema("projectcentral.flow.read", &result.schema, FLOW_READING_SCHEMA)?;
        Ok(result)
    }

    /// Create a blank retained Flow. Path, title and local stamp remain
    /// owner-defined optional inputs; the kernel does not derive placement.
    pub fn flow_create(
        &self,
        project: &str,
        actor: &str,
        actor_kind: &str,
        local_stamp: Option<&str>,
        path: Option<&str>,
        title: Option<&str>,
        agent_session_ref: Option<&str>,
    ) -> Result<FlowRecord, OwnerCallError> {
        self.flow_create_reading(
            project,
            actor,
            actor_kind,
            local_stamp,
            path,
            title,
            agent_session_ref,
        )
        .map(|reading| reading.flow)
    }

    /// Adopt a retained ordinary source as a Flow without moving it.
    pub fn flow_adopt(
        &self,
        project: &str,
        path: &str,
        actor: &str,
        actor_kind: &str,
        title: Option<&str>,
        agent_session_ref: Option<&str>,
    ) -> Result<FlowRecord, OwnerCallError> {
        self.flow_adopt_reading(project, path, actor, actor_kind, title, agent_session_ref)
            .map(|reading| reading.flow)
    }

    /// Write a Flow revision through Central's compare-and-swap and preserve
    /// the owner result. The kernel never writes the ordinary source itself.
    pub fn flow_write(
        &self,
        project: &str,
        flow_ref: &str,
        expected_revision: &str,
        content: &str,
        actor: &str,
        actor_kind: &str,
        agent_session_ref: Option<&str>,
    ) -> Result<FlowRecord, OwnerCallError> {
        self.flow_write_reading(
            project,
            flow_ref,
            expected_revision,
            content,
            actor,
            actor_kind,
            agent_session_ref,
        )
        .map(|reading| reading.flow)
    }

    /// Rename a retained Flow while preserving its stable FlowRef.
    pub fn flow_rename(
        &self,
        project: &str,
        flow_ref: &str,
        expected_revision: &str,
        new_path: &str,
    ) -> Result<FlowRecord, OwnerCallError> {
        self.flow_rename_reading(project, flow_ref, expected_revision, new_path)
            .map(|reading| reading.flow)
    }

    /// Change only the owner-held Flow lifecycle.
    pub fn flow_lifecycle(
        &self,
        project: &str,
        flow_ref: &str,
        expected_revision: &str,
        lifecycle: &str,
    ) -> Result<FlowRecord, OwnerCallError> {
        self.flow_lifecycle_reading(project, flow_ref, expected_revision, lifecycle)
            .map(|reading| reading.flow)
    }

    /// Read exact owner-stored Flow revision receipts.
    pub fn flow_history(
        &self,
        project: &str,
        flow_ref: &str,
    ) -> Result<FlowHistory, OwnerCallError> {
        let data = self.run(
            "projectcentral.flow.history",
            json!({ "project": project, "flow_ref": flow_ref }),
        )?;
        let result: FlowHistory = decode_owner("projectcentral.flow.history", data)?;
        Ok(result)
    }

    /// Store an explicit returned-work proposal. This never mutates the
    /// authored source; acceptance is a separate owner Action.
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
        let data = self.run(
            "projectcentral.source.returns",
            json!({ "project": project, "limit": limit, "before": before }),
        )?;
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
        let result: SourceReturnMutation = decode_owner("projectcentral.source.return_accept", data)?;
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
        let result: SourceReturnReading = decode_owner("projectcentral.source.return_reject", data)?;
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

    /// Apply one typed Flow/Return request. Owner failures are returned to the
    /// kernel so it can preserve them as a serializable refusal/availability
    /// result; no retry or local mutation is introduced here.
    pub fn apply_request(&self, request: Request) -> Result<Response, OwnerCallError> {
        match request {
            Request::FlowInspect { project, flow_ref } => self
                .flow_inspect(&project, &flow_ref)
                .map(|inspection| Response::FlowInspection { inspection }),
            Request::FlowList { project } => self
                .flow_list(&project)
                .map(|listing| Response::FlowList { listing }),
            Request::FlowRead {
                project,
                flow_ref,
                expected_revision,
            } => self
                .flow_read(&project, &flow_ref, expected_revision.as_deref())
                .map(|reading| Response::FlowRead { reading }),
            Request::FlowCreate {
                project,
                actor,
                actor_kind,
                local_stamp,
                path,
                title,
                agent_session_ref,
            } => self
                .flow_create_reading(
                    &project,
                    &actor,
                    &actor_kind,
                    local_stamp.as_deref(),
                    path.as_deref(),
                    title.as_deref(),
                    agent_session_ref.as_deref(),
                )
                .map(|reading| Response::FlowCreated { reading }),
            Request::FlowAdopt {
                project,
                path,
                actor,
                actor_kind,
                title,
                agent_session_ref,
            } => self
                .flow_adopt_reading(
                    &project,
                    &path,
                    &actor,
                    &actor_kind,
                    title.as_deref(),
                    agent_session_ref.as_deref(),
                )
                .map(|reading| Response::FlowAdopted { reading }),
            Request::FlowWrite {
                project,
                flow_ref,
                expected_revision,
                content,
                actor,
                actor_kind,
                agent_session_ref,
            } => self
                .flow_write_reading(
                    &project,
                    &flow_ref,
                    &expected_revision,
                    &content,
                    &actor,
                    &actor_kind,
                    agent_session_ref.as_deref(),
                )
                .map(|reading| Response::FlowWritten { reading }),
            Request::FlowRename {
                project,
                flow_ref,
                expected_revision,
                new_path,
            } => self
                .flow_rename_reading(&project, &flow_ref, &expected_revision, &new_path)
                .map(|reading| Response::FlowRenamed { reading }),
            Request::FlowLifecycle {
                project,
                flow_ref,
                expected_revision,
                lifecycle,
            } => self
                .flow_lifecycle_reading(&project, &flow_ref, &expected_revision, &lifecycle)
                .map(|reading| Response::FlowLifecycleChanged { reading }),
            Request::FlowHistory { project, flow_ref } => self
                .flow_history(&project, &flow_ref)
                .map(|history| Response::FlowHistory { history }),
            Request::SourceReturn {
                project,
                source_ref,
                expected_revision,
                proposed_content,
                reason,
                evidence_refs,
                agent_session_ref,
            } => self
                .source_return(
                    &project,
                    &source_ref,
                    &expected_revision,
                    &proposed_content,
                    &reason,
                    &evidence_refs,
                    &agent_session_ref,
                )
                .map(|reading| Response::SourceReturnCreated { reading }),
            Request::SourceReturns {
                project,
                limit,
                before,
            } => self
                .source_returns(&project, limit, before.as_deref())
                .map(|listing| Response::SourceReturns { listing }),
            Request::SourceReturnRead { project, return_ref } => self
                .source_return_read(&project, &return_ref)
                .map(|reading| Response::SourceReturnRead { reading }),
            Request::SourceReturnAccept {
                project,
                return_ref,
                expected_revision,
                acceptance,
                accepted_by_ref,
            } => self
                .source_return_accept(
                    &project,
                    &return_ref,
                    &expected_revision,
                    &acceptance,
                    &accepted_by_ref,
                )
                .map(|mutation| Response::SourceReturnAccepted { mutation }),
            Request::SourceReturnReject { project, return_ref } => self
                .source_return_reject(&project, &return_ref)
                .map(|reading| Response::SourceReturnRejected { reading }),
        }
    }

    fn flow_create_reading(
        &self,
        project: &str,
        actor: &str,
        actor_kind: &str,
        local_stamp: Option<&str>,
        path: Option<&str>,
        title: Option<&str>,
        agent_session_ref: Option<&str>,
    ) -> Result<FlowMutationReading, OwnerCallError> {
        let data = self.run(
            "projectcentral.flow.create",
            json!({
                "project": project,
                "actor": actor,
                "actor_kind": actor_kind,
                "local_stamp": local_stamp,
                "path": path,
                "title": title,
                "agent_session_ref": agent_session_ref,
            }),
        )?;
        decode_flow_reading("projectcentral.flow.create", data)
    }

    fn flow_adopt_reading(
        &self,
        project: &str,
        path: &str,
        actor: &str,
        actor_kind: &str,
        title: Option<&str>,
        agent_session_ref: Option<&str>,
    ) -> Result<FlowMutationReading, OwnerCallError> {
        let data = self.run(
            "projectcentral.flow.adopt",
            json!({
                "project": project,
                "path": path,
                "actor": actor,
                "actor_kind": actor_kind,
                "title": title,
                "agent_session_ref": agent_session_ref,
            }),
        )?;
        decode_flow_reading("projectcentral.flow.adopt", data)
    }

    pub(crate) fn flow_write_reading(
        &self,
        project: &str,
        flow_ref: &str,
        expected_revision: &str,
        content: &str,
        actor: &str,
        actor_kind: &str,
        agent_session_ref: Option<&str>,
    ) -> Result<FlowMutationReading, OwnerCallError> {
        let data = self.run(
            "projectcentral.flow.write",
            json!({
                "project": project,
                "flow_ref": flow_ref,
                "expected_revision": expected_revision,
                "content": content,
                "actor": actor,
                "actor_kind": actor_kind,
                "agent_session_ref": agent_session_ref,
            }),
        )?;
        decode_flow_reading("projectcentral.flow.write", data)
    }

    fn flow_rename_reading(
        &self,
        project: &str,
        flow_ref: &str,
        expected_revision: &str,
        new_path: &str,
    ) -> Result<FlowMutationReading, OwnerCallError> {
        let data = self.run(
            "projectcentral.flow.rename",
            json!({
                "project": project,
                "flow_ref": flow_ref,
                "expected_revision": expected_revision,
                "new_path": new_path,
            }),
        )?;
        decode_flow_reading("projectcentral.flow.rename", data)
    }

    fn flow_lifecycle_reading(
        &self,
        project: &str,
        flow_ref: &str,
        expected_revision: &str,
        lifecycle: &str,
    ) -> Result<FlowMutationReading, OwnerCallError> {
        let data = self.run(
            "projectcentral.flow.lifecycle",
            json!({
                "project": project,
                "flow_ref": flow_ref,
                "expected_revision": expected_revision,
                "lifecycle": lifecycle,
            }),
        )?;
        decode_flow_reading("projectcentral.flow.lifecycle", data)
    }
}

fn ensure_schema(action: &str, actual: &str, expected: &str) -> Result<(), OwnerCallError> {
    if actual == expected {
        Ok(())
    } else {
        Err(OwnerCallError::Malformed {
            detail: format!("{action} returned unsupported schema `{actual}` (expected `{expected}`)"),
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

fn decode_flow_reading(action: &str, data: Value) -> Result<FlowMutationReading, OwnerCallError> {
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

/// Central's retained Flow identity and owner-held revision provenance.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FlowRecord {
    pub flow_ref: String,
    pub source_ref: String,
    pub path: String,
    pub created_at_unix_seconds: u64,
    pub current_revision: String,
    pub lifecycle: String,
    #[serde(default)]
    pub title: Option<String>,
    pub scope_ref: String,
    pub privacy: String,
    #[serde(default)]
    pub revisions: Vec<FlowRevisionReceipt>,
}

/// The owner envelope returned by Flow mutations. Keeping the envelope here
/// prevents the kernel seam from dropping the owner's explicit no-background
/// disclosure while retaining the stable Flow record.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FlowMutationReading {
    pub flow: FlowRecord,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FlowRevisionReceipt {
    pub revision: String,
    #[serde(default)]
    pub parent_revision: Option<String>,
    pub actor: String,
    pub actor_kind: String,
    #[serde(default)]
    pub agent_session_ref: Option<String>,
    pub recorded_at_unix_seconds: u64,
    pub source_path: String,
    pub history_source: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FlowList {
    pub schema: String,
    pub project_id: String,
    pub flows: Vec<FlowRecord>,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FlowReading {
    pub schema: String,
    pub flow: FlowRecord,
    pub content: String,
    pub dirty_external_revision_reconciled: bool,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FlowCapability {
    pub available: bool,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FlowCapabilities {
    pub read: FlowCapability,
    pub write: FlowCapability,
    pub history: FlowCapability,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FlowInspection {
    pub schema: String,
    pub flow: FlowRecord,
    pub revision_observation: String,
    pub capabilities: FlowCapabilities,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FlowHistory {
    pub flow_ref: String,
    pub current_revision: String,
    pub revisions: Vec<FlowRevisionReceipt>,
    pub automatic_agent_or_model_invocation: bool,
}

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
    OwnerRefused {
        source_ref: String,
        message: String,
    },
    /// The owner executable is unavailable. Honest absence, not an error.
    Unavailable {
        source_ref: String,
        detail: String,
    },
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
}
