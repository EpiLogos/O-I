//! Typed encounter read model — the wave-3 kernel adapter composing the
//! W3-A AIKit session-lifecycle events with the W3-B Actuation
//! request-correlation read model, joined ON THE STABLE IDENTITIES.
//!
//! Join law (four-side invariant): an AIKit lifecycle event, the Actuation
//! correlation, this kernel encounter and the future UI decision must all be
//! able to agree on the same request identity (`PermissionRequestId`,
//! `prq_…`) and the same activity identity (`SessionActivityId`, `act_…`).
//! Both travel through this adapter verbatim — they are never re-derived,
//! normalised, or re-keyed. The identity format is owned by AIKit
//! (aikit-core `prefixed_id!` law); Actuation's contract explicitly never
//! normalises the upstream-issued `request_ref`; this adapter holds the same
//! law.
//!
//! Adapter law:
//!
//! - Pull read, receipts empty: the kernel records nothing, caches nothing,
//!   indexes nothing. The reading is assembled per call from the two owner
//!   surfaces; every owner payload is carried verbatim.
//! - Honest degradation: owner loss is `Unavailable` with the owner's own
//!   detail; an owner answering "no" is `Refused` with the owner message
//!   verbatim; nothing is fabricated and no side's absence is claimed when
//!   that side was never queried.
//! - The grant-record seam is never silently adjudicated. W3-A records a
//!   grant as a typed `permission-granted` lifecycle event on the stable
//!   `PermissionRequestId`; W3-B records the stream disposition from
//!   `metadata.permission_outcome` on `permission`/`refusal` stream events
//!   referencing the same identity verbatim. Where the two owner views
//!   disagree, or one side lacks the record, the reading names BOTH owner
//!   views explicitly — the kernel invents no canonical winner.
//!
//! Owner bindings (never PATH):
//!
//! - AIKit lifecycle history: `OI_AIKIT_BIN` (existing kernel precedent,
//!   `agency.rs`). `AIKIT_HOME` is inherited by the owner child, the same
//!   owner binding law the AIKit CLI itself honours.
//! - Actuation correlation: `OI_ACTUATION_BIN`, an explicit named binding
//!   for the Actuation CLI entry (`bin/actuation`, shebang-runnable —
//!   equivalent to the documented `node bin/actuation correlate`
//!   invocation). The suite exposes no `oi` owner route to the
//!   `actuation correlate` operation (`oi` recognises Actuation only for
//!   world-recognition contract listing / dev gating, and the factory arm
//!   routes only `actuation.local-authority/v1` bindings), so an unbound
//!   adapter reports the Actuation input unavailable and says why.
//! - The Actuation stream corpus is read from the owner stream store at
//!   `ACTUATION_STREAM_STORE` (owner env law, `streamStoreRoot` in
//!   actuation-stream-store.mjs), folded exactly as the owner's
//!   `foldStreamFile` law prescribes: line 1 is the header, every following
//!   line is exactly one committed event, the cursor is recomputed from the
//!   event lines, and the folded document is validated by the owner
//!   correlate contract itself. A store root that does not exist means the
//!   stream side was never queryable — it is omitted, never faked empty.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;

pub const ENCOUNTER_SCHEMA: &str = "oi.cradle.encounter/v1";

pub const OWNER_AIKIT: &str = "ai-kit";
pub const OWNER_ACTUATION: &str = "actuation";
pub const AIKIT_LIFECYCLE_OPERATION: &str = "aikit session lifecycle history";
pub const ACTUATION_CORRELATE_OPERATION: &str = "actuation correlate";

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/// A proposed UI disposition for one permission request identity. The
/// adapter only CLASSIFIES a proposal against the pulled owner state — it
/// records nothing; every recorded disposition stays owner-side.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "answer", rename_all = "kebab-case")]
pub enum ReplyAnswer {
    Grant,
    Refuse { reason: String },
}

impl ReplyAnswer {
    pub fn spelling(&self) -> &'static str {
        match self {
            Self::Grant => "grant",
            Self::Refuse { .. } => "refuse",
        }
    }
}

// ---------------------------------------------------------------------------
// Failure taxonomy — every terminal state is explicit
// ---------------------------------------------------------------------------

/// Availability of one named owner input, stated explicitly. `NotQueried`
/// marks a side never pulled (a malformed identity refuses before any owner
/// call); `Unavailable` carries the owner's own failure detail verbatim.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum EncounterInput {
    NotQueried {
        owner_operation: String,
    },
    Available {
        owner_operation: String,
    },
    Unavailable {
        owner_operation: String,
        detail: String,
    },
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct EncounterInputs {
    pub aikit_lifecycle: EncounterInput,
    pub actuation_correlation: EncounterInput,
}

/// The AIKit-side permission lifecycle for this verbatim request identity,
/// derived from the owner's own history events (derived, never a second
/// truth — the same law as W3-A's read model).
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum LifecyclePermission {
    /// No lifecycle event carries this request identity.
    NoRecord,
    /// `permission-requested` recorded, no later disposition.
    Pending {
        event_id: String,
        activity: String,
        recorded_at_unix_ms: u64,
    },
    Granted {
        event_id: String,
        recorded_at_unix_ms: u64,
    },
    Refused {
        event_id: String,
        reason: Option<String>,
        recorded_at_unix_ms: u64,
    },
    /// The session itself was cancelled; the open request is terminated
    /// with it. Cancellation is terminal by W3-A's recording law.
    Cancelled {
        event_id: String,
        reason: Option<String>,
        recorded_at_unix_ms: u64,
    },
}

impl LifecyclePermission {
    /// The disposition spelling used across the grant-record seam.
    fn disposition(&self) -> Option<&'static str> {
        match self {
            Self::Granted { .. } => Some("granted"),
            Self::Refused { .. } => Some("refused"),
            Self::Pending { .. } => Some("pending"),
            Self::Cancelled { .. } => Some("cancelled"),
            Self::NoRecord => None,
        }
    }

    fn evidence(&self) -> Vec<String> {
        match self {
            Self::Granted { event_id, .. }
            | Self::Refused { event_id, .. }
            | Self::Cancelled { event_id, .. } => vec![event_id.clone()],
            Self::Pending { event_id, .. } => vec![event_id.clone()],
            Self::NoRecord => Vec::new(),
        }
    }

    fn recorded_at_unix_ms(&self) -> Option<u64> {
        match self {
            Self::Granted {
                recorded_at_unix_ms,
                ..
            }
            | Self::Refused {
                recorded_at_unix_ms,
                ..
            }
            | Self::Cancelled {
                recorded_at_unix_ms,
                ..
            }
            | Self::Pending {
                recorded_at_unix_ms,
                ..
            } => Some(*recorded_at_unix_ms),
            Self::NoRecord => None,
        }
    }
}

/// What the lifecycle history records for this session and request identity.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct LifecycleView {
    /// `running` | `ended` | `cancelled` | `unknown` (history unavailable).
    pub session_state: String,
    pub permission: LifecyclePermission,
    /// Every lifecycle event carrying this request identity, owner-verbatim.
    #[serde(default)]
    pub events: Vec<Value>,
}

/// The Actuation-side correlation read model, carried owner-verbatim.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ActuationView {
    /// The owner read model's own state (`correlated`, `unknown-identity`,
    /// `no-recorded-activity`, `correlation-unavailable`), verbatim.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    /// The full `actuation.request-correlation/v1` read model, verbatim.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub read_model: Option<Value>,
}

// ---------------------------------------------------------------------------
// The grant-record seam
// ---------------------------------------------------------------------------

/// What ONE owner view records for this verbatim identity. `NotQueried`
/// marks a side that could not be pulled; `NoRecord` marks a side that was
/// pulled and holds nothing. Evidence strings are owner event ids/refs,
/// verbatim.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum OwnerPermissionRecord {
    Granted { evidence: Vec<String> },
    Refused { evidence: Vec<String> },
    Pending { evidence: Vec<String> },
    NoRecord,
    NotQueried { detail: String },
}

impl OwnerPermissionRecord {
    fn disposition(&self) -> Option<&'static str> {
        match self {
            Self::Granted { .. } => Some("granted"),
            Self::Refused { .. } => Some("refused"),
            Self::Pending { .. } => Some("pending"),
            Self::NoRecord | Self::NotQueried { .. } => None,
        }
    }

    fn evidence(&self) -> Vec<String> {
        match self {
            Self::Granted { evidence }
            | Self::Refused { evidence }
            | Self::Pending { evidence } => evidence.clone(),
            Self::NoRecord | Self::NotQueried { .. } => Vec::new(),
        }
    }
}

/// The seam itself: W3-A's typed lifecycle grant/refusal events correlated
/// with W3-B's stream-recorded disposition, BY THE VERBATIM IDENTITY. The
/// kernel never adjudicates — disagreement and absence name both owner
/// views.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum GrantRecord {
    /// Both owner views record the same disposition for the identity.
    Agreed {
        disposition: String,
        aikit_evidence: Vec<String>,
        actuation_evidence: Vec<String>,
    },
    /// W3-A's lifecycle records a disposition; Actuation's queried streams
    /// hold no record of this identity at all.
    AbsentInActuation { aikit: OwnerPermissionRecord },
    /// Actuation's streams record a disposition; W3-A's lifecycle history
    /// holds no event for this identity.
    AbsentInAikit { actuation: OwnerPermissionRecord },
    /// Both sides record, and the records do not agree. Both owner views
    /// are named in full; no canonical winner is invented.
    Disagreement {
        aikit: OwnerPermissionRecord,
        actuation: OwnerPermissionRecord,
    },
    /// A side could not be queried; no adjudication is made.
    Undetermined { detail: String },
}

// ---------------------------------------------------------------------------
// Disposition — the terminal classification of this encounter read
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum EncounterDisposition {
    /// The join is complete; every queried side agrees on the identities.
    Correlated,
    /// No queried owner side references this identity.
    UnknownIdentity,
    /// The request identity (or session) is structurally unusable; refused
    /// before any owner call.
    MalformedIdentity { detail: String },
    /// The session was cancelled — terminal by W3-A's law; nothing answers
    /// after it. The cancel reason is carried verbatim.
    Cancelled { reason: Option<String> },
    /// An owner could not serve (spawn loss or an unreadable answer); the
    /// owner's own detail, verbatim.
    Unavailable {
        owner: String,
        owner_operation: String,
        detail: String,
    },
    /// An owner answered, and the answer was no — the owner message,
    /// verbatim.
    Refused {
        owner: String,
        owner_operation: String,
        message: String,
    },
    /// A proposed reply arrived after a later disposition was already
    /// recorded; the reply is stale and must not be applied.
    StaleReply {
        answer: String,
        recorded_disposition: String,
        recorded_by: String,
        recorded_at_unix_ms: Option<u64>,
    },
}

// ---------------------------------------------------------------------------
// The typed encounter reading
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct EncounterReading {
    pub schema: String,
    /// The AIKit session whose lifecycle history was queried.
    pub session: String,
    /// The upstream-issued request identity, verbatim — the join column.
    pub request_ref: String,
    /// The activity identity of the permission-requested event, verbatim —
    /// the second join column every side quotes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub activity_ref: Option<String>,
    pub inputs: EncounterInputs,
    pub lifecycle: LifecycleView,
    pub actuation: ActuationView,
    /// The grant-record seam, reconciled explicitly.
    pub grant_record: GrantRecord,
    pub disposition: EncounterDisposition,
}

// ---------------------------------------------------------------------------
// Owner transports (thin; envelope law per knowledge.rs precedent)
// ---------------------------------------------------------------------------

#[derive(Debug)]
enum OwnerCallError {
    /// The owner could not serve: spawn loss or an unreadable answer.
    /// Absence, not refusal — the detail is the owner/IO message verbatim.
    Unavailable { detail: String },
    /// The owner answered, and the answer was no — message verbatim.
    Refused { message: String },
}

fn aikit_executable() -> PathBuf {
    std::env::var_os("OI_AIKIT_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| "aikit".into())
}

fn actuation_executable() -> Option<PathBuf> {
    std::env::var_os("OI_ACTUATION_BIN").map(PathBuf::from)
}

/// Decode the AIKit CLI envelope (`{ok, data, error}`): the same thin
/// transport contract as `knowledge::run`.
fn decode_aikit_envelope(output: &std::process::Output) -> Result<Value, OwnerCallError> {
    if !output.status.success() && output.stdout.iter().all(u8::is_ascii_whitespace) {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(OwnerCallError::Unavailable {
            detail: if detail.is_empty() {
                format!("AIKit lifecycle operation failed ({})", output.status)
            } else {
                format!(
                    "AIKit lifecycle operation failed ({}): {detail}",
                    output.status
                )
            },
        });
    }
    let envelope: Value =
        serde_json::from_slice(&output.stdout).map_err(|error| OwnerCallError::Unavailable {
            detail: format!(
                "AIKit returned an unreadable response ({error}): {}",
                String::from_utf8_lossy(&output.stderr)
            ),
        })?;
    if !output.status.success() || envelope["ok"] != true {
        return Err(OwnerCallError::Refused {
            message: envelope["error"]["message"]
                .as_str()
                .unwrap_or("AIKit refused this lifecycle operation")
                .to_owned(),
        });
    }
    envelope
        .get("data")
        .cloned()
        .ok_or_else(|| OwnerCallError::Unavailable {
            detail: "AIKit response is missing its reading".into(),
        })
}

/// Pull one session's durable lifecycle history through the pinned W3-A
/// owner operation. Read-only: records nothing.
fn aikit_lifecycle_history(cwd: &Path, session: &str) -> Result<Value, OwnerCallError> {
    let output = Command::new(aikit_executable())
        .arg("-C")
        .arg(cwd)
        .args(["session", "lifecycle", "history"])
        .arg(session)
        .arg("--json")
        .output()
        .map_err(|error| OwnerCallError::Unavailable {
            detail: format!("AIKit lifecycle owner unavailable: {error}"),
        })?;
    decode_aikit_envelope(&output)
}

/// Correlate the Actuation-side view of one verbatim request identity
/// through the pinned W3-B owner operation (`actuation correlate - --json`,
/// corpus on stdin, read model on stdout — the owner contract carries no
/// envelope). Read-only: the module records nothing.
fn actuation_correlate(cwd: &Path, corpus: &Value) -> Result<Value, OwnerCallError> {
    let executable = actuation_executable().ok_or_else(|| OwnerCallError::Unavailable {
        detail: "OI_ACTUATION_BIN is not bound and the suite exposes no oi owner route to the Actuation correlate operation".into(),
    })?;
    let corpus_text =
        serde_json::to_string(corpus).map_err(|error| OwnerCallError::Unavailable {
            detail: format!("actuation corpus is not serialisable: {error}"),
        })?;
    let mut child = Command::new(&executable)
        .arg("correlate")
        .arg("-")
        .arg("--json")
        .current_dir(cwd)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|error| OwnerCallError::Unavailable {
            detail: format!("Actuation correlate owner unavailable: {error}"),
        })?;
    use std::io::Write as _;
    let mut stdin = child.stdin.take().expect("piped stdin");
    let write_result = stdin
        .write_all(corpus_text.as_bytes())
        .and_then(|()| stdin.flush());
    drop(stdin);
    write_result.map_err(|error| OwnerCallError::Unavailable {
        detail: format!("Actuation correlate corpus could not be delivered: {error}"),
    })?;
    let output = child
        .wait_with_output()
        .map_err(|error| OwnerCallError::Unavailable {
            detail: format!("Actuation correlate owner unavailable: {error}"),
        })?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(OwnerCallError::Refused {
            message: if message.is_empty() {
                format!(
                    "Actuation correlate refused this corpus ({})",
                    output.status
                )
            } else {
                message
            },
        });
    }
    serde_json::from_slice(&output.stdout).map_err(|error| OwnerCallError::Unavailable {
        detail: format!(
            "Actuation correlate returned an unreadable read model ({error}): {}",
            String::from_utf8_lossy(&output.stderr)
        ),
    })
}

// ---------------------------------------------------------------------------
// Actuation stream store — the owner's own fold law, nothing invented
// ---------------------------------------------------------------------------

/// Fold one durable stream journal exactly as the owner's `foldStreamFile`
/// law prescribes: line 1 is the header, every following line is exactly one
/// committed event, the cursor is derived state recomputed from the event
/// lines, and a torn or invalid tail refuses the fold rather than being
/// silently dropped. The owner correlate contract validates the result.
fn fold_stream_file(raw: &str) -> Result<Value, String> {
    let mut lines: Vec<&str> = raw.split('\n').collect();
    if lines.last().is_some_and(|line| line.is_empty()) {
        lines.pop();
    }
    let header_line = lines
        .first()
        .ok_or("durable ActuationStream file is empty; refusing to fold")?;
    let mut stream: Value = serde_json::from_str(header_line)
        .map_err(|error| format!("durable ActuationStream header is not valid JSON ({error})"))?;
    let mut events = Vec::new();
    for (index, line) in lines.iter().enumerate().skip(1) {
        let event: Value = serde_json::from_str(line).map_err(|error| {
            format!("durable ActuationStream has a torn or invalid event line at position {} ({error}); the tail is not silently dropped", index + 1)
        })?;
        events.push(event);
    }
    let last = events.len() as u64;
    stream["events"] = Value::Array(events);
    stream["cursor"] = json!({ "last_sequence": last, "next_sequence": last + 1 });
    Ok(stream)
}

/// Load the Actuation stream corpus from the owner stream store
/// (`ACTUATION_STREAM_STORE`, owner env law). A store root that does not
/// exist means the stream side was never queryable: `None`, never an empty
/// fabrication. Store files are read-only here; the owner correlate
/// contract validates every folded document.
fn load_actuation_streams() -> Option<Result<Vec<Value>, String>> {
    let root = std::env::var_os("ACTUATION_STREAM_STORE")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".actuation/streams"))
        })?;
    if !root.is_dir() {
        return None;
    }
    let mut streams = Vec::new();
    let entries = match std::fs::read_dir(&root) {
        Ok(entries) => entries,
        Err(error) => {
            return Some(Err(format!(
                "Actuation stream store is not readable: {error}"
            )))
        }
    };
    let mut files: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .collect();
    files.sort();
    for path in files {
        if path.extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
            continue;
        }
        let raw = std::fs::read_to_string(&path).map_err(|error| {
            format!(
                "Actuation stream journal {} is not readable: {error}",
                path.display()
            )
        });
        match raw {
            Err(detail) => return Some(Err(detail)),
            Ok(raw) => match fold_stream_file(&raw) {
                Err(detail) => return Some(Err(detail)),
                Ok(stream) => streams.push(stream),
            },
        }
    }
    Some(Ok(streams))
}

// ---------------------------------------------------------------------------
// Assembly — the join
// ---------------------------------------------------------------------------

fn malformed_identity(kind: &str, value: &str) -> Option<EncounterDisposition> {
    if value.trim().is_empty() {
        return Some(EncounterDisposition::MalformedIdentity {
            detail: format!("{kind} is empty"),
        });
    }
    if value.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Some(EncounterDisposition::MalformedIdentity {
            detail: format!("{kind} `{value}` contains whitespace or control characters"),
        });
    }
    None
}

/// Derive the lifecycle view from the owner's history events. Derived,
/// never a second truth: every field is computed from the owner events and
/// the owner events are carried verbatim.
fn derive_lifecycle_view(history: Option<&Value>, request_ref: &str) -> LifecycleView {
    let events: Vec<Value> = history
        .and_then(|data| data["events"].as_array().cloned())
        .unwrap_or_default();
    let session_state = if events.iter().any(|event| event["kind"] == "cancelled") {
        "cancelled"
    } else if events.iter().any(|event| event["kind"] == "session-ended") {
        "ended"
    } else if history.is_some() {
        "running"
    } else {
        "unknown"
    };
    let mut referencing: Vec<&Value> = events
        .iter()
        .filter(|event| event["permission_request"].as_str() == Some(request_ref))
        .collect();
    referencing.sort_by_key(|event| event["recorded_at_unix_ms"].as_u64().unwrap_or(0));

    let cancel = events.iter().find(|event| event["kind"] == "cancelled");
    let permission = match referencing
        .last()
        .map(|event| (event["kind"].as_str(), *event))
    {
        None => LifecyclePermission::NoRecord,
        Some((Some("permission-granted"), _)) => {
            let event = referencing
                .iter()
                .rev()
                .find(|e| e["kind"] == "permission-granted")
                .expect("granted");
            LifecyclePermission::Granted {
                event_id: event["event_id"].as_str().unwrap_or_default().to_owned(),
                recorded_at_unix_ms: event["recorded_at_unix_ms"].as_u64().unwrap_or(0),
            }
        }
        Some((Some("permission-refused"), _)) => {
            let event = referencing
                .iter()
                .rev()
                .find(|e| e["kind"] == "permission-refused")
                .expect("refused");
            LifecyclePermission::Refused {
                event_id: event["event_id"].as_str().unwrap_or_default().to_owned(),
                reason: event["reason"].as_str().map(str::to_owned),
                recorded_at_unix_ms: event["recorded_at_unix_ms"].as_u64().unwrap_or(0),
            }
        }
        _ => {
            // Latest referencing event is the request itself (or a
            // superseded duplicate): the request is open — unless the
            // session's own cancellation already terminated it.
            let requested = referencing.first().expect("request event");
            match cancel {
                Some(cancel_event) => LifecyclePermission::Cancelled {
                    event_id: cancel_event["event_id"]
                        .as_str()
                        .unwrap_or_default()
                        .to_owned(),
                    reason: cancel_event["reason"].as_str().map(str::to_owned),
                    recorded_at_unix_ms: cancel_event["recorded_at_unix_ms"].as_u64().unwrap_or(0),
                },
                None => LifecyclePermission::Pending {
                    event_id: requested["event_id"]
                        .as_str()
                        .unwrap_or_default()
                        .to_owned(),
                    activity: requested["activity"]
                        .as_str()
                        .unwrap_or_default()
                        .to_owned(),
                    recorded_at_unix_ms: requested["recorded_at_unix_ms"].as_u64().unwrap_or(0),
                },
            }
        }
    };
    LifecycleView {
        session_state: session_state.to_owned(),
        permission,
        events: referencing.into_iter().cloned().collect(),
    }
}

/// The Actuation-side permission record for the seam, from the owner read
/// model's `permission` side (stream-recorded disposition, verbatim refs).
fn actuation_permission_record(read_model: Option<&Value>) -> OwnerPermissionRecord {
    let Some(permission) = read_model.map(|model| &model["permission"]) else {
        return OwnerPermissionRecord::NotQueried {
            detail: "actuation correlation input unavailable".into(),
        };
    };
    if permission["available"] != true {
        return OwnerPermissionRecord::NotQueried {
            detail: permission["unavailable_reason"]
                .as_str()
                .unwrap_or("actuation permission side was not queried")
                .to_owned(),
        };
    }
    let evidence: Vec<String> = permission["event_refs"]
        .as_array()
        .map(|refs| {
            refs.iter()
                .filter_map(|r| r.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    match permission["outcome"].as_str() {
        Some("granted") => OwnerPermissionRecord::Granted { evidence },
        Some("refused") => OwnerPermissionRecord::Refused { evidence },
        // The owner spells a still-open stream disposition `pending`; its
        // `none` means the queried streams hold nothing for the identity.
        Some("pending") => OwnerPermissionRecord::Pending { evidence },
        _ => OwnerPermissionRecord::NoRecord,
    }
}

/// Reconcile the grant-record seam BY THE VERBATIM IDENTITY. Never silently
/// adjudicated: agreement, absence and disagreement all name the owner
/// views explicitly.
fn reconcile_grant_record(
    lifecycle: &LifecycleView,
    aikit_queried: bool,
    actuation_read_model: Option<&Value>,
) -> GrantRecord {
    let aikit = if !aikit_queried {
        OwnerPermissionRecord::NotQueried {
            detail: "aikit lifecycle input unavailable".into(),
        }
    } else {
        match lifecycle.permission.disposition() {
            Some("granted") => OwnerPermissionRecord::Granted {
                evidence: lifecycle.permission.evidence(),
            },
            Some("refused") => OwnerPermissionRecord::Refused {
                evidence: lifecycle.permission.evidence(),
            },
            Some("pending") => OwnerPermissionRecord::Pending {
                evidence: lifecycle.permission.evidence(),
            },
            // A request terminated by session cancellation records no
            // disposition of its own; the cancellation is terminal and the
            // lifecycle holds no grant/refusal to reconcile.
            _ => OwnerPermissionRecord::NoRecord,
        }
    };
    let actuation = actuation_permission_record(actuation_read_model);

    let aikit_state = aikit.disposition();
    let actuation_state = actuation.disposition();
    match (aikit, actuation) {
        (OwnerPermissionRecord::NotQueried { detail }, _)
        | (_, OwnerPermissionRecord::NotQueried { detail }) => GrantRecord::Undetermined { detail },
        (aikit, actuation) => match (aikit_state, actuation_state) {
            (Some(disposition), Some(other)) if disposition == other => GrantRecord::Agreed {
                disposition: disposition.to_owned(),
                aikit_evidence: aikit.evidence(),
                actuation_evidence: actuation.evidence(),
            },
            (Some(_), None) => GrantRecord::AbsentInActuation { aikit },
            (None, Some(_)) => GrantRecord::AbsentInAikit { actuation },
            (None, None) => GrantRecord::Undetermined {
                detail: "no owner view records a disposition for this identity".into(),
            },
            (Some(_), Some(_)) => GrantRecord::Disagreement { aikit, actuation },
        },
    }
}

/// Assemble the typed encounter reading: one pull over both owner surfaces,
/// joined on the verbatim identities. No kernel state is touched; receipts
/// stay empty.
pub fn assemble(
    cwd: &Path,
    session: &str,
    request_ref: &str,
    reply: Option<&ReplyAnswer>,
) -> EncounterReading {
    let mut reading = EncounterReading {
        schema: ENCOUNTER_SCHEMA.into(),
        session: session.to_owned(),
        request_ref: request_ref.to_owned(),
        activity_ref: None,
        inputs: EncounterInputs {
            aikit_lifecycle: EncounterInput::NotQueried {
                owner_operation: AIKIT_LIFECYCLE_OPERATION.into(),
            },
            actuation_correlation: EncounterInput::NotQueried {
                owner_operation: ACTUATION_CORRELATE_OPERATION.into(),
            },
        },
        lifecycle: derive_lifecycle_view(None, request_ref),
        actuation: ActuationView {
            state: None,
            read_model: None,
        },
        grant_record: GrantRecord::Undetermined {
            detail: "owner inputs not queried yet".into(),
        },
        disposition: EncounterDisposition::UnknownIdentity,
    };

    // The identity grammar is owned upstream; a structurally unusable
    // identity refuses before any owner call.
    if let Some(disposition) = malformed_identity("request_ref", request_ref) {
        reading.disposition = disposition;
        return reading;
    }
    if let Some(disposition) = malformed_identity("session", session) {
        reading.disposition = disposition;
        return reading;
    }

    // Side 1: the W3-A durable lifecycle history (read-only owner pull).
    let history = match aikit_lifecycle_history(cwd, session) {
        Ok(data) => {
            reading.inputs.aikit_lifecycle = EncounterInput::Available {
                owner_operation: AIKIT_LIFECYCLE_OPERATION.into(),
            };
            Some(data)
        }
        Err(OwnerCallError::Unavailable { detail }) => {
            reading.inputs.aikit_lifecycle = EncounterInput::Unavailable {
                owner_operation: AIKIT_LIFECYCLE_OPERATION.into(),
                detail: detail.clone(),
            };
            reading.disposition = EncounterDisposition::Unavailable {
                owner: OWNER_AIKIT.into(),
                owner_operation: AIKIT_LIFECYCLE_OPERATION.into(),
                detail,
            };
            None
        }
        Err(OwnerCallError::Refused { message }) => {
            reading.inputs.aikit_lifecycle = EncounterInput::Unavailable {
                owner_operation: AIKIT_LIFECYCLE_OPERATION.into(),
                detail: message.clone(),
            };
            reading.disposition = EncounterDisposition::Refused {
                owner: OWNER_AIKIT.into(),
                owner_operation: AIKIT_LIFECYCLE_OPERATION.into(),
                message,
            };
            None
        }
    };

    reading.lifecycle = derive_lifecycle_view(history.as_ref(), request_ref);
    reading.activity_ref = reading
        .lifecycle
        .events
        .first()
        .and_then(|event| event["activity"].as_str().map(str::to_owned));

    // Side 2: the W3-B correlation read model. The corpus carries only what
    // the kernel truthfully holds: the streams folded from the owner store
    // (or the streams side omitted when the store was never queryable).
    // Authority/activity corpus sides the kernel holds no owner source for
    // are omitted — the owner contract reports them `available: false`,
    // never faked empty.
    let mut corpus = json!({ "request_ref": request_ref });
    let streams = load_actuation_streams();
    if let Some(Ok(streams)) = &streams {
        corpus["streams"] = Value::Array(streams.clone());
    }
    let actuation_read_model = match streams {
        Some(Err(detail)) => {
            reading.inputs.actuation_correlation = EncounterInput::Unavailable {
                owner_operation: ACTUATION_CORRELATE_OPERATION.into(),
                detail: detail.clone(),
            };
            reading.disposition = EncounterDisposition::Unavailable {
                owner: OWNER_ACTUATION.into(),
                owner_operation: ACTUATION_CORRELATE_OPERATION.into(),
                detail,
            };
            None
        }
        _ => match actuation_correlate(cwd, &corpus) {
            Ok(model) => {
                reading.inputs.actuation_correlation = EncounterInput::Available {
                    owner_operation: ACTUATION_CORRELATE_OPERATION.into(),
                };
                reading.actuation.state = model["state"].as_str().map(str::to_owned);
                reading.actuation.read_model = Some(model.clone());
                Some(model)
            }
            Err(OwnerCallError::Unavailable { detail }) => {
                reading.inputs.actuation_correlation = EncounterInput::Unavailable {
                    owner_operation: ACTUATION_CORRELATE_OPERATION.into(),
                    detail: detail.clone(),
                };
                reading.disposition = EncounterDisposition::Unavailable {
                    owner: OWNER_ACTUATION.into(),
                    owner_operation: ACTUATION_CORRELATE_OPERATION.into(),
                    detail,
                };
                None
            }
            Err(OwnerCallError::Refused { message }) => {
                reading.inputs.actuation_correlation = EncounterInput::Unavailable {
                    owner_operation: ACTUATION_CORRELATE_OPERATION.into(),
                    detail: message.clone(),
                };
                reading.disposition = EncounterDisposition::Refused {
                    owner: OWNER_ACTUATION.into(),
                    owner_operation: ACTUATION_CORRELATE_OPERATION.into(),
                    message,
                };
                None
            }
        },
    };

    // The grant-record seam: both owner views, correlated by identity,
    // never adjudicated.
    reading.grant_record = reconcile_grant_record(
        &reading.lifecycle,
        history.is_some(),
        actuation_read_model.as_ref(),
    );

    // Terminal classification. Order is law: owner loss outranks everything
    // (absence cannot be claimed for a side that never answered);
    // cancellation is terminal per W3-A; a stale reply is diagnosed only
    // against a live, uncancelled request.
    let owner_failure = matches!(
        reading.disposition,
        EncounterDisposition::Unavailable { .. } | EncounterDisposition::Refused { .. }
    );
    if owner_failure {
        return reading;
    }
    if reading.lifecycle.session_state == "cancelled" {
        let reason = match &reading.lifecycle.permission {
            LifecyclePermission::Cancelled { reason, .. } => reason.clone(),
            _ => None,
        };
        reading.disposition = EncounterDisposition::Cancelled { reason };
        return reading;
    }
    if let Some(answer) = reply {
        let recorded = match &reading.lifecycle.permission {
            LifecyclePermission::Granted { .. } => Some((
                "granted".to_owned(),
                OWNER_AIKIT.to_owned(),
                reading.lifecycle.permission.recorded_at_unix_ms(),
            )),
            LifecyclePermission::Refused { .. } => Some((
                "refused".to_owned(),
                OWNER_AIKIT.to_owned(),
                reading.lifecycle.permission.recorded_at_unix_ms(),
            )),
            _ => actuation_read_model.as_ref().and_then(|model| {
                let outcome = model["permission"]["outcome"].as_str()?;
                matches!(outcome, "granted" | "refused")
                    .then(|| (outcome.to_owned(), OWNER_ACTUATION.to_owned(), None::<u64>))
            }),
        };
        if let Some((recorded_disposition, recorded_by, recorded_at_unix_ms)) = recorded {
            reading.disposition = EncounterDisposition::StaleReply {
                answer: answer.spelling().to_owned(),
                recorded_disposition,
                recorded_by,
                recorded_at_unix_ms,
            };
            return reading;
        }
    }
    // Referenced means some QUERIED owner side holds the identity: lifecycle
    // events carrying it, or the Actuation permission side's verbatim
    // referencing event refs. (`correlation-unavailable` from the owner can
    // still be a referenced identity — the join target was simply not
    // queryable; absence is never claimed for an unqueried side.)
    let referenced = !reading.lifecycle.events.is_empty()
        || actuation_read_model.as_ref().is_some_and(|model| {
            model["permission"]["available"] == true
                && model["permission"]["event_refs"]
                    .as_array()
                    .is_some_and(|refs| !refs.is_empty())
        });
    reading.disposition = if referenced {
        EncounterDisposition::Correlated
    } else {
        EncounterDisposition::UnknownIdentity
    };
    reading
}
