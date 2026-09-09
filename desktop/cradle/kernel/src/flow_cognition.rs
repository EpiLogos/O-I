//! Wave-4 kernel cell W4-D — the W1.4 Contemplate dispatch binding and the
//! W1.5 changed-since-thought compose, kernel half.
//!
//! W1.4 (`action:contemplate-flow` at `oi.cradle.action-dispatch/v1`):
//! preflight-first, record-gated execution.
//!
//! - Preflight-first: a bare row dispatch obtains the AIKit owner's
//!   deterministic preflight record (`aikit flow preflight`) and surfaces it
//!   — the Flow ref, the owner change horizon and the host model runtime
//!   travel as caller-supplied owner seams, verbatim; the kernel fabricates
//!   no seam and no ref. Without seams the owner answers its explicit
//!   `unavailable` preflight and that answer rides verbatim.
//! - Structural impossibility preserved through the kernel, not just the
//!   owner: the adapter never runs the owner execution operation
//!   (`aikit flow contemplate`) unless the caller presents an explicit
//!   preflight record (`input.execute`, a JSON object) — never a boolean
//!   shorthand, never an auto-invocation. The owner then re-runs the
//!   deterministic preflight, validates the record and refuses drift before
//!   any executor could be called; the kernel adds no executor of its own
//!   and carries the typed `aikit.flow-cognition/v1` reading the owner
//!   produces (on the pinned CLI surface, with no host-executor aperture,
//!   the honest reading is the owner's explicit `unavailable` naming the
//!   absent executor — never faked into cognition).
//! - Owner refusals/unavailable pass through verbatim per adapter law; the
//!   dispatch records nothing and emits nothing (the owner-side familiarity
//!   law is provable only through the owner store, as in cell C2).
//!
//! W1.5 (`KernelOp::FlowChangedSince`): the kernel supplies the
//! `KnowledgeChangeHorizon` — adapted field-by-field from Central's own
//! `projectcentral.change.horizon` (`central.source-change-horizon/v1`),
//! refs carried verbatim — calls the AIKit owner's `flow changed-since` and
//! returns ONE typed reading with both sides explicit: the Central horizon
//! side and the AIKit owner side each name `available` / the owner's own
//! refusal / the owner's own unavailability. A side that could not be
//! queried is named, never faked empty: when the horizon side is missing
//! the owner is called without `--horizon` and returns its explicit
//! `unavailable` reading (owner law), not fabricated rows.
//!
//! Seam-file law: the pinned AIKit CLI reads `--horizon`/`--runtime`/
//! `--thought` as file paths, so caller-supplied seam JSON is materialised
//! into a unique per-call temporary directory that is removed before the
//! adapter returns. This is transient transport materialisation — nothing
//! durable is written, no owner state is touched, nothing is recorded.
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::action::ActionDispatch;
use crate::flow::{CentralClient, OwnerCallError};
use crate::knowledge;

/// The owner operation spellings this adapter binds (pinned AIKit CLI).
pub const AIKIT_FLOW_PREFLIGHT_OPERATION: &str = "aikit flow preflight";
pub const AIKIT_FLOW_CONTEMPLATE_OPERATION: &str = "aikit flow contemplate";
pub const AIKIT_FLOW_CHANGED_SINCE_OPERATION: &str = "aikit flow changed-since";

/// Central's source-change-horizon owner Action and schema.
pub const CENTRAL_HORIZON_ACTION: &str = "projectcentral.change.horizon";
pub const CENTRAL_HORIZON_SCHEMA: &str = "central.source-change-horizon/v1";

/// The AIKit owner receipt schema versions this adapter verifies before
/// carrying a payload (the owner's own version strings).
pub const FLOW_COGNITION_VERSION: &str = "aikit.flow-cognition/v1";
pub const FLOW_CHANGED_SINCE_VERSION: &str = "aikit.flow-changed-since/v1";

// ---------------------------------------------------------------------------
// Seam-file transport materialisation (per-call, removed before return)
// ---------------------------------------------------------------------------

/// One unique per-call seam directory. Every file written under it carries
/// caller-supplied owner JSON verbatim; the whole directory is removed when
/// the guard drops, so no seam outlives its single owner call.
struct SeamDir {
    path: PathBuf,
}

impl SeamDir {
    fn new(tag: &str) -> Result<Self, String> {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let path = std::env::temp_dir().join(format!(
            "oi-flow-cognition-{tag}-{}-{nanos}",
            std::process::id()
        ));
        std::fs::create_dir(&path)
            .map_err(|error| format!("materialise the {tag} seam directory: {error}"))?;
        Ok(Self { path })
    }

    fn write(&self, name: &str, value: &Value) -> Result<PathBuf, String> {
        let path = self.path.join(name);
        serde_json::to_writer(
            std::fs::File::create(&path)
                .map_err(|error| format!("materialise the {name} seam file: {error}"))?,
            value,
        )
        .map_err(|error| format!("encode the {name} seam file: {error}"))?;
        Ok(path)
    }
}

impl Drop for SeamDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}

// ---------------------------------------------------------------------------
// W1.4 — the Contemplate dispatch binding
// ---------------------------------------------------------------------------

/// Dispatch one `action:contemplate-flow` invocation. `input` is the
/// caller-supplied owner basis, verbatim: optional `horizon` and `runtime`
/// seam objects and the optional `execute` preflight record. Every terminal
/// state is explicit and owner-worded; the kernel records nothing.
pub fn dispatch_contemplate(cwd: &Path, flow_ref: &str, input: Option<&Value>) -> ActionDispatch {
    let basis = match input {
        None => ContemplateBasis::default(),
        Some(Value::Object(_)) => match ContemplateBasis::parse(input) {
            Ok(basis) => basis,
            Err(detail) => return ActionDispatch::MalformedRef { detail },
        },
        Some(other) => {
            return ActionDispatch::MalformedRef {
                detail: format!(
                    "Contemplate Flow input must be a JSON object naming the owner seams, got {other}"
                ),
            };
        }
    };
    let seam_error = |error: String| ActionDispatch::OwnerUnavailable {
        owner_operation: basis.owner_operation().to_owned(),
        detail: error,
    };
    let seams = match basis.seams() {
        Ok(seams) => seams,
        Err(error) => return seam_error(error),
    };
    let mut args: Vec<String> = vec!["flow".into(), basis.subcommand().into(), flow_ref.into()];
    if let Some(horizon) = &seams.horizon {
        args.extend(["--horizon".into(), horizon.display().to_string()]);
    }
    if let Some(runtime) = &seams.runtime {
        args.extend(["--runtime".into(), runtime.display().to_string()]);
    }
    let owner_operation = basis.owner_operation().to_owned();
    let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
    match knowledge::run(cwd, &borrowed) {
        Ok(data) => match verify_cognition_payload(&data, basis.executed()) {
            Ok(()) => ActionDispatch::Invoked {
                owner_operation,
                data,
            },
            Err(detail) => ActionDispatch::OwnerRefused {
                owner_operation,
                message: detail,
            },
        },
        Err(knowledge::CallError::Refused { message }) => ActionDispatch::OwnerRefused {
            owner_operation,
            message,
        },
        Err(knowledge::CallError::Unavailable { detail }) => ActionDispatch::OwnerUnavailable {
            owner_operation,
            detail,
        },
        Err(knowledge::CallError::Malformed { detail }) => ActionDispatch::OwnerRefused {
            owner_operation,
            message: detail,
        },
    }
}

/// The caller-supplied owner basis for one Contemplate dispatch. Every
/// field travels verbatim; the kernel invents no seam content.
#[derive(Default)]
struct ContemplateBasis {
    horizon: Option<Value>,
    runtime: Option<Value>,
    /// The explicit preflight record gating execution. Present => the
    /// dispatch runs the owner execution operation; absent => preflight
    /// only. Structural impossibility: anything that is not a JSON object
    /// (a boolean shorthand, a string) refuses before any owner call.
    execute: Option<Value>,
}

impl ContemplateBasis {
    fn parse(input: Option<&Value>) -> Result<Self, String> {
        let Some(object) = input.and_then(Value::as_object) else {
            return Ok(Self::default());
        };
        let seam = |field: &str| {
            match object.get(field) {
            None | Some(Value::Null) => Ok(None),
            Some(value @ Value::Object(_)) => Ok(Some(value.clone())),
            Some(other) => Err(format!(
                "the Contemplate Flow `{field}` seam must be a JSON object carried verbatim, got {other}"
            )),
        }
        };
        let execute = match object.get("execute") {
            None | Some(Value::Null) => None,
            Some(value @ Value::Object(_)) => Some(value.clone()),
            Some(other) => {
                return Err(format!(
                    "structural impossibility preserved through the kernel: a Contemplate Flow execution requires the explicit validated preflight record as a JSON object; `{other}` cannot execute and no shorthand is honoured"
                ));
            }
        };
        Ok(Self {
            horizon: seam("horizon")?,
            runtime: seam("runtime")?,
            execute,
        })
    }

    fn executed(&self) -> bool {
        self.execute.is_some()
    }

    fn subcommand(&self) -> &'static str {
        if self.executed() {
            "contemplate"
        } else {
            "preflight"
        }
    }

    fn owner_operation(&self) -> &'static str {
        if self.executed() {
            AIKIT_FLOW_CONTEMPLATE_OPERATION
        } else {
            AIKIT_FLOW_PREFLIGHT_OPERATION
        }
    }

    /// Materialise the seam files this basis needs. Absent seams stay
    /// absent — the owner answers its explicit `unavailable` for a missing
    /// basis, and that answer is owner truth, not a kernel fabrication.
    fn seams(&self) -> Result<Seams, String> {
        let dir = SeamDir::new("contemplate")?;
        let horizon = self
            .horizon
            .as_ref()
            .map(|value| dir.write("horizon.json", value))
            .transpose()?;
        let runtime = self
            .runtime
            .as_ref()
            .map(|value| dir.write("runtime.json", value))
            .transpose()?;
        Ok(Seams {
            _dir: dir,
            horizon,
            runtime,
        })
    }
}

struct Seams {
    _dir: SeamDir,
    horizon: Option<PathBuf>,
    runtime: Option<PathBuf>,
}

/// Verify the owner payload is the typed reading this binding carries —
/// the owner's own version string plus its explicit state field. An owner
/// answer outside the contract is carried as the owner's own malformed
/// detail, never reclassified into a reading.
fn verify_cognition_payload(data: &Value, executed: bool) -> Result<(), String> {
    if data.get("version").and_then(Value::as_str) != Some(FLOW_COGNITION_VERSION) {
        return Err(format!(
            "AIKit returned an unsupported Flow cognition payload (version {:?}, expected {FLOW_COGNITION_VERSION})",
            data.get("version")
        ));
    }
    let state_field = if executed {
        data.pointer("/cognition/state")
    } else {
        data.get("state")
    };
    if state_field.and_then(Value::as_str).is_none() {
        return Err("AIKit returned a Flow cognition payload with no explicit state".to_owned());
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// W1.5 — the changed-since-thought compose
// ---------------------------------------------------------------------------

/// The Central side of one changed-since compose: the horizon the kernel
/// supplied, or the owner's own failure, stated explicitly.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum HorizonSupply {
    /// Central's `central.source-change-horizon/v1`, adapted field-by-field
    /// to the provider-neutral `KnowledgeChangeHorizon` the AIKit owner
    /// consumes; every source ref and revision rides verbatim.
    Available {
        owner_operation: String,
        provider: String,
        cursor: u64,
        /// The adapted horizon exactly as it was supplied to the owner.
        adapted: Value,
    },
    /// Central answered, and the answer was no — or was unparseable; the
    /// owner's own words are carried (adapter-law Malformed handling).
    OwnerRefused {
        owner_operation: String,
        message: String,
    },
    /// The Central owner executable could not be launched. Absence, not an
    /// error — and never a faked empty horizon.
    OwnerUnavailable {
        owner_operation: String,
        detail: String,
    },
}

/// The AIKit side of one changed-since compose: the typed owner receipt, or
/// the owner's own failure, stated explicitly.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum AikitChangedSince {
    /// The owner receipt (`aikit.flow-changed-since/v1`) carried verbatim:
    /// changed sources, affected knowledge and unresolved rows, each with
    /// provenance, and the owner's explicit available/empty/unavailable
    /// state — never faked empty by the kernel.
    Invoked {
        owner_operation: String,
        receipt: Value,
    },
    OwnerRefused {
        owner_operation: String,
        message: String,
    },
    OwnerUnavailable {
        owner_operation: String,
        detail: String,
    },
}

/// ONE typed changed-since-thought reading: both owner sides explicit.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ChangedSinceReading {
    /// The thought's FlowRef, verbatim from the supplied thought record.
    pub flow_ref: String,
    /// The thought's deterministic invocation ref, verbatim.
    pub thought_ref: String,
    pub horizon: HorizonSupply,
    pub aikit: AikitChangedSince,
}

/// Compose the W1.5 changed-since read. `thought` is the owner-held
/// `FlowThoughtRecord` JSON, carried verbatim into the owner call. The
/// kernel supplies the horizon from Central's own seam and classifies each
/// side's outcome; it records nothing and emits nothing.
pub fn changed_since(
    client: &CentralClient,
    project: &str,
    cwd: &Path,
    thought: &Value,
) -> Result<ChangedSinceReading, String> {
    let (flow_ref, thought_ref) = thought_identity(thought)?;
    let horizon = central_horizon(client, project);
    let aikit = aikit_changed_since(cwd, thought, &horizon);
    Ok(ChangedSinceReading {
        flow_ref,
        thought_ref,
        horizon,
        aikit,
    })
}

fn thought_identity(thought: &Value) -> Result<(String, String), String> {
    let object = thought.as_object().ok_or(
        "the thought record must be the owner-shaped JSON object (aikit.flow-cognition/v1)",
    )?;
    let flow_ref = object
        .get("flow_ref")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or("the thought record names no FlowRef")?
        .to_owned();
    let thought_ref = object
        .get("invocation_ref")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or("the thought record names no invocation_ref")?
        .to_owned();
    Ok((flow_ref, thought_ref))
}

fn central_horizon(client: &CentralClient, project: &str) -> HorizonSupply {
    let owner_operation = CENTRAL_HORIZON_ACTION.to_owned();
    match client.run(CENTRAL_HORIZON_ACTION, json!({ "project": project })) {
        Ok(value) => match adapt_central_horizon(&value) {
            Ok(adapted) => HorizonSupply::Available {
                provider: value
                    .get("provider")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
                    .to_owned(),
                cursor: value.get("cursor").and_then(Value::as_u64).unwrap_or(0),
                adapted,
                owner_operation,
            },
            Err(message) => HorizonSupply::OwnerRefused {
                owner_operation,
                message,
            },
        },
        Err(OwnerCallError::Unavailable { detail }) => HorizonSupply::OwnerUnavailable {
            owner_operation,
            detail,
        },
        Err(OwnerCallError::Refused { message }) => HorizonSupply::OwnerRefused {
            owner_operation,
            message,
        },
        Err(OwnerCallError::Malformed { detail }) => HorizonSupply::OwnerRefused {
            owner_operation,
            message: detail,
        },
    }
}

/// Adapt Central's `central.source-change-horizon/v1` to the
/// provider-neutral `KnowledgeChangeHorizon` the AIKit owner consumes
/// (`aikit-core/src/knowledge_living.rs`). Field-by-field, refs verbatim:
/// `source_ref -> source`, `source_roles -> roles`, revisions pass through
/// as the opaque strings both owners treat them as. Fields the consumer
/// schema has no aperture for (`source_path`, `observed_at`, `provider` per
/// row, `actor`, `change_ref`) are owner-side provenance the adapter does
/// not invent equivalents for.
fn adapt_central_horizon(value: &Value) -> Result<Value, String> {
    if value.get("schema").and_then(Value::as_str) != Some(CENTRAL_HORIZON_SCHEMA) {
        return Err(format!(
            "Central returned an unsupported change horizon schema {:?} (expected {CENTRAL_HORIZON_SCHEMA})",
            value.get("schema")
        ));
    }
    if value
        .get("automatic_agent_or_model_invocation")
        .and_then(Value::as_bool)
        .unwrap_or(true)
    {
        return Err("Central change horizon violated the zero-background-Agent law".to_owned());
    }
    let sources = value
        .get("sources")
        .and_then(Value::as_array)
        .ok_or("Central change horizon carries no observed-source list")?;
    let mut adapted_sources = Vec::with_capacity(sources.len());
    for observed in sources {
        let source_ref = observed
            .pointer("/binding/ref")
            .and_then(Value::as_str)
            .ok_or("a Central observed source carries no source ref")?;
        let revision = observed
            .pointer("/revision/revision")
            .cloned()
            .unwrap_or(Value::Null);
        adapted_sources.push(json!({
            "source": source_ref,
            "revision": revision,
            // Presence in Central's observed set is the availability fact.
            "available": true,
        }));
    }
    let changes = value
        .get("changes")
        .and_then(Value::as_array)
        .ok_or("Central change horizon carries no change list")?;
    let mut adapted_changes = Vec::with_capacity(changes.len());
    for change in changes {
        let source_ref = change
            .get("source_ref")
            .and_then(Value::as_str)
            .ok_or("a Central change row carries no source ref")?;
        let cursor = change
            .get("cursor")
            .and_then(Value::as_u64)
            .ok_or("a Central change row carries no cursor")?;
        adapted_changes.push(json!({
            "cursor": cursor,
            "world_ref": change.get("world_ref").cloned().unwrap_or(Value::Null),
            "source": source_ref,
            "roles": change.get("source_roles").cloned().unwrap_or_else(|| json!([])),
            "provenance": change.get("provenance").cloned().unwrap_or(Value::Null),
            "standing": change.get("standing").cloned().unwrap_or(Value::Null),
            "before_revision": change.get("before_revision").cloned().unwrap_or(Value::Null),
            "after_revision": change.get("after_revision").cloned().unwrap_or(Value::Null),
            "kind": change.get("kind").cloned().unwrap_or(Value::Null),
            "agent_retrieval_allowed": change.get("agent_retrieval_allowed").and_then(Value::as_bool).unwrap_or(false),
        }));
    }
    Ok(json!({
        "provider": value.get("provider").cloned().unwrap_or(Value::Null),
        "cursor": value.get("cursor").and_then(Value::as_u64).unwrap_or(0),
        "sources": adapted_sources,
        "changes": adapted_changes,
    }))
}

fn aikit_changed_since(cwd: &Path, thought: &Value, horizon: &HorizonSupply) -> AikitChangedSince {
    let owner_operation = AIKIT_FLOW_CHANGED_SINCE_OPERATION.to_owned();
    let seams = match SeamDir::new("changed-since") {
        Ok(seams) => seams,
        Err(detail) => {
            return AikitChangedSince::OwnerUnavailable {
                owner_operation,
                detail,
            }
        }
    };
    let thought_path = match seams.write("thought.json", thought) {
        Ok(path) => path,
        Err(detail) => {
            return AikitChangedSince::OwnerUnavailable {
                owner_operation,
                detail,
            }
        }
    };
    let mut args: Vec<String> = vec![
        "flow".into(),
        "changed-since".into(),
        "--thought".into(),
        thought_path.display().to_string(),
    ];
    // The kernel supplies the horizon it composed from Central's seam; when
    // that side is unavailable the owner is still asked — without
    // `--horizon` the owner returns its explicit `unavailable` reading
    // rather than fabricated rows (owner law), and both sides name why.
    if let HorizonSupply::Available { adapted, .. } = horizon {
        match seams.write("horizon.json", adapted) {
            Ok(path) => args.extend(["--horizon".into(), path.display().to_string()]),
            Err(detail) => {
                return AikitChangedSince::OwnerUnavailable {
                    owner_operation,
                    detail,
                };
            }
        }
    }
    let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
    match knowledge::run(cwd, &borrowed) {
        Ok(receipt) => {
            if receipt.get("version").and_then(Value::as_str) != Some(FLOW_CHANGED_SINCE_VERSION)
                || receipt
                    .pointer("/reading/state")
                    .and_then(Value::as_str)
                    .is_none()
            {
                return AikitChangedSince::OwnerRefused {
                    owner_operation,
                    message: format!(
                        "AIKit returned an unsupported changed-since receipt (version {:?})",
                        receipt.get("version")
                    ),
                };
            }
            AikitChangedSince::Invoked {
                owner_operation,
                receipt,
            }
        }
        Err(knowledge::CallError::Refused { message }) => AikitChangedSince::OwnerRefused {
            owner_operation,
            message,
        },
        Err(knowledge::CallError::Unavailable { detail }) => AikitChangedSince::OwnerUnavailable {
            owner_operation,
            detail,
        },
        Err(knowledge::CallError::Malformed { detail }) => AikitChangedSince::OwnerRefused {
            owner_operation,
            message: detail,
        },
    }
}
