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
#[derive(Clone, Debug, Eq, PartialEq)]
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

/// Client for the Central owner Actions the kernel reads and writes
/// through `oi central`. OI_BIN selects the suite executable; the suite resolves
/// OI_CENTRAL_CTRL_BIN or the registered owner. Root/project context is preserved.
#[derive(Clone, Debug)]
pub struct CentralClient {
    executable: PathBuf,
    central_root: Option<PathBuf>,
    project_query: String,
    suite_route: bool,
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
        }
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
