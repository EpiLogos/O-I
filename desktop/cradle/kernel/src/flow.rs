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
//! On a valid native refusal the existing conflict heuristic compares
//! revisions, never conflict prose. Lost mutation receipts stay unknown;
//! current bytes cannot establish whether our original operation completed.
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
    Refused {
        message: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        native: Option<Value>,
    },
    /// The owner answered something the contract cannot parse.
    Malformed { detail: String },
    /// The launched operation may have acted; loss of its receipt is not refusal.
    OutcomeUnknown {
        detail: String,
        child_pid: Option<u32>,
        cleanup: Option<String>,
        native: Option<Value>,
    },
    /// A contracted read failed physically after launch. It is not owner absence.
    TransportFailed {
        detail: String,
        child_pid: Option<u32>,
        cleanup: Option<String>,
    },
}

/// Caller-owned classification of effects, never permission to perform them.
/// Generic native commands remain conservative; only a closed owner contract
/// permits ReadOnly. No command-name suffix is used to infer this distinction.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Effect {
    ReadOnly,
    MayMutate,
}
impl Effect {
    pub(crate) fn lost_response(
        self,
        detail: String,
        child_pid: Option<u32>,
        cleanup: Option<String>,
        native: Option<Value>,
    ) -> OwnerCallError {
        match self {
            Self::MayMutate => OwnerCallError::OutcomeUnknown {
                detail,
                child_pid,
                cleanup,
                native,
            },
            Self::ReadOnly => OwnerCallError::Malformed { detail },
        }
    }
    pub(crate) fn physical_failure(self, error: crate::native_process::Failure) -> OwnerCallError {
        if !error.launched {
            return if error.kind == crate::native_process::FailureKind::Launch {
                OwnerCallError::Unavailable {
                    detail: error.detail,
                }
            } else {
                OwnerCallError::Malformed {
                    detail: error.detail,
                }
            };
        }
        match self {
            Self::MayMutate => OwnerCallError::OutcomeUnknown {
                detail: error.detail,
                child_pid: error.child_pid,
                cleanup: error.cleanup,
                native: None,
            },
            Self::ReadOnly => OwnerCallError::TransportFailed {
                detail: error.detail,
                child_pid: error.child_pid,
                cleanup: error.cleanup,
            },
        }
    }
}

impl OwnerCallError {
    pub fn detail(&self) -> String {
        match self {
            Self::Unavailable { detail }
            | Self::Malformed { detail }
            | Self::OutcomeUnknown { detail, .. }
            | Self::TransportFailed { detail, .. } => detail.clone(),
            Self::Refused { message, .. } => message.clone(),
        }
    }
}

impl std::fmt::Display for OwnerCallError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unavailable { detail } => {
                write!(formatter, "Native owner CLI unavailable: {detail}")
            }
            Self::Refused { message, .. } => {
                write!(formatter, "Native owner Action refused: {message}")
            }
            Self::Malformed { detail } => write!(
                formatter,
                "Native owner Action returned an incompatible answer: {detail}"
            ),
            Self::OutcomeUnknown { detail, cleanup, .. } => write!(formatter, "Native owner outcome unknown: {detail}; {}; inspect the original native operation before any retry", cleanup.as_deref().unwrap_or("receipt unavailable")),
            Self::TransportFailed { detail, cleanup, .. } => write!(formatter, "Native owner read transport failed: {detail}; {}", cleanup.as_deref().unwrap_or("no cleanup observation")),
        }
    }
}

impl std::error::Error for OwnerCallError {}

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
    /// Resource identity includes the native owner route and configured World;
    /// renderer transport URLs and presentation refs cannot choose this epoch.
    pub(crate) fn retained_resource_epoch(&self) -> String {
        use sha2::{Digest, Sha256};
        let basis = format!(
            "{:?}|{:?}|{:?}|{}",
            self.executable, self.central_executable, self.central_root, self.suite_route
        );
        format!("central-owner:{:x}", Sha256::digest(basis.as_bytes()))
    }

    pub fn configured_project(&self) -> &str {
        &self.project_query
    }

    /// Run one owner Action, ported envelope law: `--json` global flag,
    /// optional `--root`, `action run <action> <input-json>`. Generic calls
    /// conservatively may mutate; closed read callers use run_envelope_read.
    /// Native status/code/details and explicit uncertainty survive decoding.
    pub fn run_envelope(&self, action: &str, input: Value) -> Result<Value, OwnerCallError> {
        self.run_envelope_effect(action, input, Effect::MayMutate)
    }

    pub fn run_envelope_read(&self, action: &str, input: Value) -> Result<Value, OwnerCallError> {
        self.run_envelope_effect(action, input, Effect::ReadOnly)
    }

    fn run_envelope_effect(
        &self,
        action: &str,
        mut input: Value,
        effect: Effect,
    ) -> Result<Value, OwnerCallError> {
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
        let stdin = if encoded.len() > 64 * 1024 {
            command.arg("-");
            Some(encoded.as_slice())
        } else {
            command.arg(String::from_utf8(encoded.clone()).expect("JSON is UTF-8"));
            None
        };
        let output = crate::native_process::run(
            command,
            stdin,
            crate::native_process::Limits {
                timeout: std::time::Duration::from_secs(if effect == Effect::ReadOnly {
                    20
                } else {
                    300
                }),
                stdout_bytes: 32 * 1024 * 1024,
                stderr_bytes: 64 * 1024,
            },
        )
        .map_err(|error| effect.physical_failure(error))?;
        let lost =
            |detail: String| effect.lost_response(format!("{action}: {detail}"), None, None, None);
        let value: Value = serde_json::from_slice(&output.stdout).map_err(|error| {
            lost(format!(
                "invalid structured output ({error}; status {}): {}",
                output.status,
                String::from_utf8_lossy(&output.stderr)
            ))
        })?;
        let lost = |detail: String| {
            effect.lost_response(
                format!("{action}: {detail}"),
                None,
                None,
                Some(value.clone()),
            )
        };
        if !value.is_object()
            || value["ok"].as_bool().is_none()
            || !matches!(
                value["status"].as_str(),
                Some(
                    "success"
                        | "cancelled"
                        | "invalid_input"
                        | "invalid_central_structure"
                        | "unavailable_capability"
                        | "connector_failure"
                        | "partial_completion"
                        | "verification_failure"
                        | "internal_failure"
                )
            )
        {
            return Err(lost("no native ActionResult".into()));
        }
        if value["ok"] == true {
            if !output.status.success() || value["status"] != "success" {
                return Err(lost(format!(
                    "contradictory native success/status {}",
                    output.status
                )));
            }
            if value.get("data").is_none() {
                return Err(lost("success without native data".into()));
            }
        } else {
            if value["status"] == "success"
                || !value["error"]["message"].is_string()
                || !value["error"]["code"].is_string()
            {
                return Err(lost("incompatible native failure".into()));
            }
            // This explicit marker belongs to the native publication owner;
            // it outranks the observer's expected effect classification.
            if value["error"]["code"] == "central.publication_uncertain" {
                return Err(OwnerCallError::OutcomeUnknown {
                    detail: value["error"]["message"].as_str().unwrap().into(),
                    child_pid: None,
                    cleanup: None,
                    native: Some(value),
                });
            }
            // Central's current native IO envelope has no effect marker.
            // Its generic internal/partial failures do not prove a mutation
            // absent. Keep the complete native code/details, never mine prose.
            if effect == Effect::MayMutate
                && (value["status"] == "internal_failure"
                    || value["status"] == "partial_completion"
                    || value["status"] == "connector_failure")
            {
                return Err(OwnerCallError::OutcomeUnknown {
                    detail: value["error"]["message"].as_str().unwrap().into(),
                    child_pid: None,
                    cleanup: None,
                    native: Some(value),
                });
            }
        }
        Ok(value)
    }

    pub fn run(&self, action: &str, input: Value) -> Result<Value, OwnerCallError> {
        self.run_effect(action, input, Effect::MayMutate)
    }

    pub fn run_read(&self, action: &str, input: Value) -> Result<Value, OwnerCallError> {
        self.run_effect(action, input, Effect::ReadOnly)
    }

    fn run_effect(
        &self,
        action: &str,
        input: Value,
        effect: Effect,
    ) -> Result<Value, OwnerCallError> {
        let value = self.run_envelope_effect(action, input, effect)?;
        if value["ok"] != true {
            return Err(OwnerCallError::Refused {
                message: value["error"]["message"].as_str().unwrap().into(),
                native: Some(value),
            });
        }
        Ok(value["data"].clone())
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
        };
        let effect = if matches!(
            request,
            ReceivingRequest::List { .. } | ReceivingRequest::Read { .. }
        ) {
            Effect::ReadOnly
        } else {
            Effect::MayMutate
        };
        self.run_effect(action, Value::Object(input), effect)
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
        self.run_read(action, Value::Object(input))
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
        let envelope = self.run_envelope(
            "projectcentral.source.read",
            json!({ "project": project, "source_ref": source_ref }),
        )?;
        // The native LocallyMutating descriptor permits derived horizon
        // reconciliation. This grants no authored-source write authority.
        decode_mutation_owner(
            "projectcentral.source.read",
            envelope,
            |reading: &SourceReading| {
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
                Ok(())
            },
        )
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
                .map_err(|error| OwnerCallError::OutcomeUnknown {
                    detail: format!("decode Central source write receipt: {error}"),
                    child_pid: None,
                    cleanup: None,
                    native: Some(data.clone()),
                })?;
        if receipt.schema != SOURCE_WRITE_RECEIPT_SCHEMA {
            return Err(OwnerCallError::OutcomeUnknown {
                detail: format!(
                    "unsupported Central source write receipt schema `{}`",
                    receipt.schema
                ),
                child_pid: None,
                cleanup: None,
                native: Some(data.clone()),
            });
        }
        if receipt.automatic_agent_or_model_invocation {
            return Err(OwnerCallError::OutcomeUnknown {
                detail: "Central source write violated zero-background-Agent law".to_owned(),
                child_pid: None,
                cleanup: None,
                native: Some(data.clone()),
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
        let envelope = self.run_envelope(
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
        decode_mutation_owner(
            "projectcentral.source.return",
            envelope,
            |result: &SourceReturnReading| {
                ensure_schema(
                    "projectcentral.source.return",
                    &result.schema,
                    FLOW_RETURN_READING_SCHEMA,
                )?;
                ensure_schema(
                    "projectcentral.source.return",
                    &result.proposal.schema,
                    FLOW_RETURN_SCHEMA,
                )
            },
        )
    }

    /// List returned-work proposals through Central's source-return owner.
    pub fn source_returns(
        &self,
        project: &str,
        limit: Option<u64>,
        before: Option<&str>,
    ) -> Result<SourceReturns, OwnerCallError> {
        let envelope = self.run_envelope(
            "projectcentral.source.returns",
            json!({ "project": project, "limit": limit, "before": before }),
        )?;
        // The native descriptor is LocallyMutating: owner-side recovery and
        // retained horizon reconciliation may occur during this listing.
        decode_mutation_owner(
            "projectcentral.source.returns",
            envelope,
            |result: &SourceReturns| {
                ensure_schema(
                    "projectcentral.source.returns",
                    &result.schema,
                    FLOW_RETURNS_SCHEMA,
                )
            },
        )
    }

    /// Re-read one proposal and its current source basis.
    pub fn source_return_read(
        &self,
        project: &str,
        return_ref: &str,
    ) -> Result<SourceReturnReading, OwnerCallError> {
        let envelope = self.run_envelope(
            "projectcentral.source.return_read",
            json!({ "project": project, "return_ref": return_ref }),
        )?;
        // A later owner call can reconcile an interrupted applying proposal;
        // the source-return contract does not promise a physically pure read.
        decode_mutation_owner(
            "projectcentral.source.return_read",
            envelope,
            |result: &SourceReturnReading| {
                ensure_schema(
                    "projectcentral.source.return_read",
                    &result.schema,
                    FLOW_RETURN_READING_SCHEMA,
                )?;
                ensure_schema(
                    "projectcentral.source.return_read",
                    &result.proposal.schema,
                    FLOW_RETURN_SCHEMA,
                )
            },
        )
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
        let envelope = self.run_envelope(
            "projectcentral.source.return_accept",
            json!({
                "project": project,
                "return_ref": return_ref,
                "expected_revision": expected_revision,
                "acceptance": acceptance,
                "accepted_by_ref": accepted_by_ref,
            }),
        )?;
        decode_mutation_owner(
            "projectcentral.source.return_accept",
            envelope,
            |result: &SourceReturnMutation| {
                ensure_schema(
                    "projectcentral.source.return_accept",
                    &result.proposal.schema,
                    FLOW_RETURN_SCHEMA,
                )
            },
        )
    }

    /// Reject a proposal without touching its source.
    pub fn source_return_reject(
        &self,
        project: &str,
        return_ref: &str,
    ) -> Result<SourceReturnReading, OwnerCallError> {
        let envelope = self.run_envelope(
            "projectcentral.source.return_reject",
            json!({ "project": project, "return_ref": return_ref }),
        )?;
        decode_mutation_owner(
            "projectcentral.source.return_reject",
            envelope,
            |result: &SourceReturnReading| {
                ensure_schema(
                    "projectcentral.source.return_reject",
                    &result.schema,
                    FLOW_RETURN_READING_SCHEMA,
                )?;
                ensure_schema(
                    "projectcentral.source.return_reject",
                    &result.proposal.schema,
                    FLOW_RETURN_SCHEMA,
                )
            },
        )
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

/// A successful mutation envelope may already represent a retained effect.
/// Keep its exact receipt when decoding or validation cannot establish the
/// typed result; incompatible observation does not make that effect absent.
fn decode_mutation_owner<T: for<'de> Deserialize<'de>>(
    action: &str,
    envelope: Value,
    validate: impl FnOnce(&T) -> Result<(), OwnerCallError>,
) -> Result<T, OwnerCallError> {
    // run_envelope already checked the native failure contract and explicit
    // uncertainty. Preserve a genuine refusal without interpreting its prose.
    if envelope["ok"] != true {
        return Err(OwnerCallError::Refused {
            message: envelope["error"]["message"].as_str().unwrap().into(),
            native: Some(envelope),
        });
    }
    let result = decode_owner(action, envelope["data"].clone()).and_then(|result| {
        validate(&result)?;
        Ok(result)
    });
    result.map_err(|error| {
        Effect::MayMutate.lost_response(error.detail(), None, None, Some(envelope))
    })
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
        native: Option<Value>,
    },
    /// The launched source write has no reliable native receipt. The proposal
    /// stays dirty; a later current reading cannot prove this caller's success.
    OutcomeUnknown {
        source_ref: String,
        detail: String,
        child_pid: Option<u32>,
        cleanup: Option<String>,
        native: Option<Value>,
    },
    Failed {
        source_ref: String,
        detail: String,
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
            Self::OutcomeUnknown { .. } => "outcome-unknown",
            Self::Failed { .. } => "failed",
        }
    }

    pub fn source_ref(&self) -> &str {
        match self {
            Self::RevisionConflict { source_ref, .. }
            | Self::OwnerRefused { source_ref, .. }
            | Self::Unavailable { source_ref, .. }
            | Self::OutcomeUnknown { source_ref, .. }
            | Self::Failed { source_ref, .. } => source_ref,
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
            Self::OwnerRefused { source_ref, message, .. } => {
                write!(formatter, "owner refused the write for {source_ref}: {message}")
            }
            Self::OutcomeUnknown { source_ref, detail, .. } => write!(formatter, "source write outcome unknown for {source_ref}: {detail}; proposal stays dirty; inspect the native source and original operation before retry"),
            Self::Failed { source_ref, detail } => write!(formatter, "source write failed for {source_ref}: {detail}"),
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
