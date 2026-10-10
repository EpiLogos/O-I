//! Read-only stream adapters feeding the temporal-events field (spec slice
//! E2). Each adapter reads one existing stream where it already lives and
//! maps its records into `oi.temporal-events/v1` events — nothing else. The
//! producers keep producing; an adapter writes nothing, anywhere: the E2
//! verify gate is that the diff carries no write path.
//!
//! | Adapter | Stream read | Read through |
//! |---|---|---|
//! | [`CentralNowListSource`] | NOW clearing lifecycle | `central.now.list` (root) |
//! | [`CentralThoughtsSource`] | the thought stream (`T/`) | `central.now.thoughts.read` |
//! | [`WikiReturnsPlacementSource`] | wiki returns placement | `central.files.list` |
//! | [`KernelEventLogSource`] | kernel event log | the in-process log |
//! | [`AikitHistorySource`] | aikit history evidence | `aikit history --json` |
//!
//! Owner readings follow the house law (`history.rs`, `central.rs`): an
//! envelope flagged `automatic_agent_or_model_invocation` is refused, never
//! degraded into a reading. A source's own time is inherited verbatim where
//! the source records one (`created_at`, the fixture's `utc`, an aikit
//! evidence `occurred_at`, a kernel `observed_at`) and left absent where it
//! does not — the field never receives an invented time.

use crate::events::KernelEventLog;
use crate::flow::{CentralClient, OwnerCallError};
use crate::temporal_events::{
    CivilField, EventKind, TemporalEvent, TemporalEventsAnswer, TemporalEventsError, TemporalQuery,
    TemporalStreamSource,
};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::Command;

fn refused_reading(stream: &str) -> TemporalEventsError {
    TemporalEventsError::SourceUnavailable {
        stream: stream.to_string(),
        detail: "the owner answered with an automatic or model-invoked reading; refused".into(),
    }
}

fn unavailable(stream: &str, error: OwnerCallError) -> TemporalEventsError {
    TemporalEventsError::SourceUnavailable {
        stream: stream.to_string(),
        detail: error.to_string(),
    }
}

fn unix_seconds_instant(
    stream: &str,
    position: &str,
    seconds: i64,
) -> Result<String, TemporalEventsError> {
    jiff::Timestamp::from_second(seconds)
        .map(|instant| instant.to_string())
        .map_err(|error| TemporalEventsError::InvalidRecord {
            stream: stream.to_string(),
            position: position.to_string(),
            reason: format!(
                "`created_at_unix_seconds` ({seconds}) is not a valid instant: {error}"
            ),
        })
}

fn unix_millis_instant(
    stream: &str,
    position: &str,
    millis: i64,
) -> Result<String, TemporalEventsError> {
    jiff::Timestamp::from_millisecond(millis)
        .map(|instant| instant.to_string())
        .map_err(|error| TemporalEventsError::InvalidRecord {
            stream: stream.to_string(),
            position: position.to_string(),
            reason: format!("observed millis ({millis}) is not a valid instant: {error}"),
        })
}

fn require_str<'a>(
    stream: &str,
    value: &'a Value,
    key: &str,
    position: &str,
) -> Result<&'a str, TemporalEventsError> {
    value
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| TemporalEventsError::InvalidRecord {
            stream: stream.to_string(),
            position: position.to_string(),
            reason: format!("record carries no string `{key}`"),
        })
}

// ---------------------------------------------------------------------------
// NOW clearing lifecycle — `central.now.list` (root register)
// ---------------------------------------------------------------------------

/// One reading of the root NOW field's clearing records.
pub struct CentralNowListSource {
    client: CentralClient,
}

impl CentralNowListSource {
    pub fn new(client: CentralClient) -> Self {
        Self { client }
    }

    pub fn read(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        const STREAM: &str = "central-now";
        let envelope = self
            .client
            .run_envelope("central.now.list", json!({ "project": Value::Null }))
            .map_err(|error| unavailable(STREAM, error))?;
        if envelope.pointer("/data/automatic_agent_or_model_invocation") == Some(&Value::Bool(true))
        {
            return Err(refused_reading(STREAM));
        }
        let records = envelope
            .pointer("/data/records")
            .and_then(Value::as_array)
            .ok_or_else(|| TemporalEventsError::InvalidRecord {
                stream: STREAM.to_string(),
                position: String::new(),
                reason: "the field reading carries no `records` array".into(),
            })?;
        records.iter().map(now_record_to_event).collect()
    }
}

/// Map one clearing record as `central.now.list` returns it.
pub(crate) fn now_record_to_event(record: &Value) -> Result<TemporalEvent, TemporalEventsError> {
    const STREAM: &str = "central-now";
    let now_ref = require_str(STREAM, record, "now_ref", "<clearing>")?;
    let created = record
        .get("created_at_unix_seconds")
        .and_then(Value::as_i64)
        .ok_or_else(|| TemporalEventsError::InvalidRecord {
            stream: STREAM.to_string(),
            position: now_ref.to_string(),
            reason: "clearing record carries no integer `created_at_unix_seconds`".into(),
        })?;
    let mut evidence = Vec::new();
    if let Some(source_ref) = record.get("source_ref").and_then(Value::as_str) {
        evidence.push(source_ref.to_string());
    }
    if let Some(revision) = record
        .get("revision")
        .and_then(|revision| revision.get("revision"))
        .and_then(Value::as_str)
    {
        evidence.push(revision.to_string());
    }
    Ok(TemporalEvent {
        stream: STREAM.into(),
        kind: EventKind::Now,
        thought_type: None,
        subject_ref: now_ref.to_string(),
        civil_instant: Some(unix_seconds_instant(STREAM, now_ref, created)?),
        instant_unix_ms: None,
        day_ref: None,
        stream_position: now_ref.to_string(),
        evidence_refs: evidence,
        summary: record
            .get("purpose")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
    })
}

impl TemporalStreamSource for CentralNowListSource {
    fn stream_name(&self) -> &str {
        "central-now"
    }
    fn events(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        self.read()
    }
}

// ---------------------------------------------------------------------------
// The thought stream — `central.now.thoughts.read`
// ---------------------------------------------------------------------------

/// The raw thought stream (`T/`) of the named clearings. Fixtures are read
/// with content so a fixture's own `utc` joins the field when it carries
/// one; a fixture that names none stays instant-less. Pre-law fixtures list
/// as nonconforming and are never hidden.
pub struct CentralThoughtsSource {
    client: CentralClient,
    now_refs: Vec<String>,
    limit: u64,
}

impl CentralThoughtsSource {
    pub fn new(client: CentralClient, now_refs: Vec<String>) -> Self {
        Self {
            client,
            now_refs,
            limit: 256,
        }
    }

    pub fn read(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        const STREAM: &str = "central-now-thoughts";
        let mut events = Vec::new();
        for now_ref in &self.now_refs {
            let envelope = self
                .client
                .run_envelope(
                    "central.now.thoughts.read",
                    json!({
                        "project": Value::Null,
                        "now_ref": now_ref,
                        "include_content": true,
                        "limit": self.limit,
                    }),
                )
                .map_err(|error| unavailable(STREAM, error))?;
            if envelope.pointer("/data/automatic_agent_or_model_invocation")
                == Some(&Value::Bool(true))
            {
                return Err(refused_reading(STREAM));
            }
            let directory = envelope
                .pointer("/data/directory")
                .and_then(Value::as_str)
                .unwrap_or_default();
            for fixture in envelope
                .pointer("/data/fixtures")
                .and_then(Value::as_array)
                .unwrap_or(&Vec::new())
            {
                events.push(thought_fixture_to_event(now_ref, directory, fixture)?);
            }
        }
        Ok(events)
    }
}

/// Map one thought fixture as `central.now.thoughts.read` returns it.
pub(crate) fn thought_fixture_to_event(
    now_ref: &str,
    directory: &str,
    fixture: &Value,
) -> Result<TemporalEvent, TemporalEventsError> {
    const STREAM: &str = "central-now-thoughts";
    let file = require_str(STREAM, fixture, "file", now_ref)?;
    let position = format!("{now_ref}#T/{file}");
    // A conforming fixture's content may carry its own `utc`; inherit it,
    // never invent one. A content that is not JSON simply carries no time.
    let civil_instant = fixture
        .get("content")
        .and_then(Value::as_str)
        .and_then(|content| serde_json::from_str::<Value>(content).ok())
        .and_then(|parsed| {
            parsed
                .get("utc")
                .and_then(Value::as_str)
                .map(str::to_string)
        });
    let conforming = fixture.get("conforming").and_then(Value::as_bool) == Some(true);
    let mut evidence = vec![format!("{directory}/{file}")];
    if let Some(revision) = fixture.get("revision").and_then(Value::as_str) {
        evidence.push(revision.to_string());
    }
    Ok(TemporalEvent {
        stream: STREAM.into(),
        kind: EventKind::Thought,
        thought_type: None,
        subject_ref: position.clone(),
        civil_instant,
        instant_unix_ms: None,
        day_ref: None,
        stream_position: position,
        evidence_refs: evidence,
        summary: if conforming {
            "raw thought fixture".into()
        } else {
            "pre-law thought fixture (nonconforming; listed, never hidden)".into()
        },
    })
}

impl TemporalStreamSource for CentralThoughtsSource {
    fn stream_name(&self) -> &str {
        "central-now-thoughts"
    }
    fn events(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        self.read()
    }
}

// ---------------------------------------------------------------------------
// Wiki returns placement — `central.files.list`
// ---------------------------------------------------------------------------

/// The wiki-returns placement: files a knowledge return could not yet be
/// included from. The directory listing carries no timestamps, so these
/// events are instant-less placements — evidence-ref'd, never dated.
pub struct WikiReturnsPlacementSource {
    client: CentralClient,
    path: String,
}

impl WikiReturnsPlacementSource {
    pub fn new(client: CentralClient) -> Self {
        Self {
            client,
            path: "Control/agents/wiki/returns".into(),
        }
    }

    pub fn read(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        const STREAM: &str = "wiki-returns";
        let envelope = self
            .client
            .run_envelope(
                "central.files.list",
                json!({ "path": self.path, "project": Value::Null }),
            )
            .map_err(|error| unavailable(STREAM, error))?;
        if envelope.pointer("/data/automatic_agent_or_model_invocation") == Some(&Value::Bool(true))
        {
            return Err(refused_reading(STREAM));
        }
        let entries = envelope
            .pointer("/data/entries")
            .and_then(Value::as_array)
            .ok_or_else(|| TemporalEventsError::InvalidRecord {
                stream: STREAM.to_string(),
                position: self.path.clone(),
                reason: "the directory reading carries no `entries` array".into(),
            })?;
        entries
            .iter()
            .filter(|entry| entry.get("kind").and_then(Value::as_str) == Some("file"))
            .map(|entry| {
                let path = require_str(STREAM, &entry["location"], "path", &self.path)?;
                let reference = require_str(STREAM, &entry["location"], "ref", path)?;
                Ok(TemporalEvent {
                    stream: STREAM.into(),
                    kind: EventKind::Return,
                    thought_type: None,
                    subject_ref: reference.to_string(),
                    civil_instant: None,
                    instant_unix_ms: None,
                    day_ref: None,
                    stream_position: path.to_string(),
                    evidence_refs: vec![reference.to_string()],
                    summary: require_str(STREAM, entry, "name", path)?.to_string(),
                })
            })
            .collect()
    }
}

impl TemporalStreamSource for WikiReturnsPlacementSource {
    fn stream_name(&self) -> &str {
        "wiki-returns"
    }
    fn events(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        self.read()
    }
}

// ---------------------------------------------------------------------------
// Kernel event log — the in-process ordered seam
// ---------------------------------------------------------------------------

/// The kernel's own event log. A receipt's position is its sequence within
/// the log's generation; the log's bounded retention is the generation's
/// concern, reported by `replay`, never papered over here. A variant that
/// carries `observed_at_unix_ms` inherits it as the event's instant; every
/// other variant stays instant-less — a kernel state change discloses when
/// it changed, or it does not claim a time.
pub struct KernelEventLogSource<'a> {
    log: &'a KernelEventLog,
}

impl<'a> KernelEventLogSource<'a> {
    pub fn new(log: &'a KernelEventLog) -> Self {
        Self { log }
    }

    pub fn read(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        self.log
            .since(1)
            .iter()
            .map(kernel_receipt_to_event)
            .collect()
    }
}

/// Map one kernel receipt into a temporal event. Shared by the borrowed
/// source above and the prepared read path, which carries a snapshot of
/// the same receipts — the mapping, and therefore the event identity, is
/// one and the same.
pub(crate) fn kernel_receipt_to_event(
    receipt: &crate::events::KernelEventReceipt,
) -> Result<TemporalEvent, TemporalEventsError> {
    const STREAM: &str = "kernel-event-log";
    let event = serde_json::to_value(&receipt.envelope.event).unwrap_or_else(|_| json!({}));
    let name = event
        .get("event")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    let civil_instant = event
        .get("observed_at_unix_ms")
        .and_then(Value::as_u64)
        .map(i64::try_from)
        .transpose()
        .map_err(|_| TemporalEventsError::InvalidRecord {
            stream: STREAM.to_string(),
            position: format!("seq-{}", receipt.seq),
            reason: "`observed_at_unix_ms` overflows an instant".into(),
        })?
        .map(|millis| unix_millis_instant(STREAM, &format!("seq-{}", receipt.seq), millis))
        .transpose()?;
    // A payload names its own ref when it has one; the variant name is the
    // subject otherwise.
    let subject_key = ["expression_ref", "routine_ref", "agent_session"]
        .iter()
        .find_map(|key| event.get(*key).and_then(Value::as_str));
    let subject_ref = subject_key
        .map(str::to_string)
        .unwrap_or_else(|| format!("oi:kernel-event:{name}"));
    Ok(TemporalEvent {
        stream: STREAM.into(),
        kind: EventKind::Kernel,
        thought_type: None,
        subject_ref,
        civil_instant,
        instant_unix_ms: None,
        day_ref: None,
        stream_position: format!("seq-{}", receipt.seq),
        evidence_refs: vec!["oi:kernel-event".into()],
        summary: name,
    })
}

impl TemporalStreamSource for KernelEventLogSource<'_> {
    fn stream_name(&self) -> &str {
        "kernel-event-log"
    }
    fn events(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        self.read()
    }
}

// ---------------------------------------------------------------------------
// Aikit history evidence — `aikit history --json`
// ---------------------------------------------------------------------------

/// The aikit history reading, pulled through the same owner seam
/// `encounter.rs` uses (`OI_AIKIT_BIN`, `-C <cwd>`, `{ok, data, error}`
/// envelope). Evidence kinds map onto the field's vocabulary: `generation`
/// stays a generation, `procedure` is a run of a plan, `familiarity` is
/// curation material, `session-space` is NOW/session material, and the
/// knowledge-plane kinds (routes, frames, sources, compositions) are
/// `Knowledge`.
pub struct AikitHistorySource {
    executable: PathBuf,
    cwd: PathBuf,
}

impl AikitHistorySource {
    /// Discover the aikit executable the way the encounter seam does.
    pub fn discover(cwd: PathBuf) -> Self {
        Self {
            executable: std::env::var_os("OI_AIKIT_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("aikit")),
            cwd,
        }
    }

    pub fn read(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        const STREAM: &str = "aikit-history";
        let output = Command::new(&self.executable)
            .arg("-C")
            .arg(&self.cwd)
            .arg("history")
            .arg("--json")
            .output()
            .map_err(|error| TemporalEventsError::SourceUnavailable {
                stream: STREAM.to_string(),
                detail: format!("aikit history owner unavailable: {error}"),
            })?;
        if !output.status.success() {
            return Err(TemporalEventsError::SourceUnavailable {
                stream: STREAM.to_string(),
                detail: format!(
                    "aikit history failed ({}): {}",
                    output.status,
                    String::from_utf8_lossy(&output.stderr).trim()
                ),
            });
        }
        let envelope: Value = serde_json::from_slice(&output.stdout).map_err(|error| {
            TemporalEventsError::SourceUnavailable {
                stream: STREAM.to_string(),
                detail: format!("aikit history returned an unreadable response: {error}"),
            }
        })?;
        if envelope["ok"] != true {
            return Err(TemporalEventsError::SourceUnavailable {
                stream: STREAM.to_string(),
                detail: envelope["error"]["message"]
                    .as_str()
                    .unwrap_or("aikit refused this history reading")
                    .to_string(),
            });
        }
        let entries = envelope["data"]["entries"].as_array().ok_or_else(|| {
            TemporalEventsError::InvalidRecord {
                stream: STREAM.to_string(),
                position: String::new(),
                reason: "the history reading carries no `entries` array".into(),
            }
        })?;
        entries.iter().map(history_entry_to_event).collect()
    }
}

/// Map one aikit history evidence entry.
pub(crate) fn history_entry_to_event(entry: &Value) -> Result<TemporalEvent, TemporalEventsError> {
    const STREAM: &str = "aikit-history";
    let id = require_str(STREAM, entry, "id", "<evidence>")?;
    let kind = require_str(STREAM, entry, "kind", id)?;
    let civil_instant = entry
        .get("occurred_at_unix_ms")
        .and_then(Value::as_i64)
        .map(|millis| unix_millis_instant(STREAM, id, millis))
        .transpose()?;
    let evidence: Vec<String> = entry["canonical_refs"]
        .as_array()
        .map(|refs| {
            refs.iter()
                .filter_map(Value::as_str)
                .take(8)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    Ok(TemporalEvent {
        stream: STREAM.into(),
        kind: history_kind_to_event_kind(kind),
        thought_type: None,
        subject_ref: require_str(STREAM, entry, "subject", id)?.to_string(),
        civil_instant,
        instant_unix_ms: None,
        day_ref: None,
        stream_position: id.to_string(),
        evidence_refs: evidence,
        summary: entry
            .get("summary")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
    })
}

fn history_kind_to_event_kind(kind: &str) -> EventKind {
    match kind {
        "generation" => EventKind::Generation,
        "procedure" => EventKind::Run,
        "familiarity" => EventKind::Curation,
        "session-space" => EventKind::Now,
        _ => EventKind::Knowledge,
    }
}

impl TemporalStreamSource for AikitHistorySource {
    fn stream_name(&self) -> &str {
        "aikit-history"
    }
    fn events(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        self.read()
    }
}

fn load_civil_field(client: &CentralClient) -> Result<CivilField, TemporalEventsError> {
    let envelope = client
        .run_envelope("central.time.policy", json!({ "project": Value::Null }))
        .map_err(|error| TemporalEventsError::CivilTime {
            reason: format!("central.time.policy unavailable: {error}"),
        })?;
    // run_envelope returns the whole ActionResult envelope; the reading
    // itself lives under `data` (flow.rs run_envelope contract).
    if envelope.pointer("/data/automatic_agent_or_model_invocation") == Some(&Value::Bool(true)) {
        return Err(TemporalEventsError::CivilTime {
            reason: "central.time.policy refused an automatic reading".into(),
        });
    }
    let policy = envelope
        .pointer("/data/policy")
        .ok_or_else(|| TemporalEventsError::CivilTime {
            reason: "central.time.policy carries no policy object".into(),
        })?
        .clone();
    let revision = envelope
        .pointer("/data/revision")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    CivilField::new(
        policy
            .get("timezone")
            .and_then(Value::as_str)
            .unwrap_or("UTC")
            .to_string(),
        policy
            .get("day_boundary_minutes")
            .and_then(Value::as_i64)
            .unwrap_or(0),
        envelope
            .pointer("/data/scope_ref")
            .and_then(Value::as_str)
            .or_else(|| policy.get("scope_ref").and_then(Value::as_str))
            .unwrap_or("control:root")
            .to_string(),
        revision,
    )
}

/// Retained for direct callers. `read_field` now shares one
/// `central.now.list` reading between the clearing refs and the clearing
/// events, so this standalone spawn has no in-crate caller.
#[allow(dead_code)]
fn list_now_refs(client: &CentralClient) -> Result<Vec<String>, TemporalEventsError> {
    const STREAM: &str = "central-now";
    let envelope = client
        .run_envelope("central.now.list", json!({ "project": Value::Null }))
        .map_err(|error| TemporalEventsError::SourceUnavailable {
            stream: STREAM.to_string(),
            detail: error.to_string(),
        })?;
    if envelope.pointer("/data/automatic_agent_or_model_invocation") == Some(&Value::Bool(true)) {
        return Err(refused_reading(STREAM));
    }
    let empty: Vec<Value> = Vec::new();
    let records = envelope
        .pointer("/data/records")
        .and_then(Value::as_array)
        .unwrap_or(&empty);
    Ok(records
        .iter()
        .filter_map(|record| {
            record
                .get("now_ref")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .collect())
}

/// Bounded fan-out for the thought stream. The Central owner serialises
/// Action calls behind its register lock (measured 2026-10-09: ~71 ms per
/// `central.now.thoughts.read` held regardless of client concurrency), so
/// workers past the first few only keep the client side gap-free; eight
/// measured fastest against the live ground.
const THOUGHT_WORKERS: usize = 8;

/// The thought stream's per-clearing fixture bound, as
/// `CentralThoughtsSource` carries it.
const THOUGHT_LIMIT: u64 = 256;

/// The cached-answer horizon. The same law as every other agency read
/// (`read_cache::HORIZON_TTL`): a retained answer echoes the instant it
/// was observed — never a fresher one — and expiry is never a claim that
/// a source stayed unchanged.
const TEMPORAL_CACHE_PREFIX: &str = "temporal-events:";

/// A stream adapter over events already read. The parallel assembly hands
/// the projection complete streams; every projection law (stream-name
/// confession, exactly-once, ordering, day derivation, refusals) is the
/// projection's own and runs unchanged.
struct Collected {
    name: &'static str,
    events: Vec<TemporalEvent>,
}

impl TemporalStreamSource for Collected {
    fn stream_name(&self) -> &str {
        self.name
    }
    fn events(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        Ok(self.events.clone())
    }
}

/// Read one clearing's thought fixtures — the same envelope law and the
/// same mapper as [`CentralThoughtsSource::read`], over one chunk of the
/// register's refs. Errors carry the failing ref's index within the chunk
/// so the caller can report the earliest failure in register order, the
/// answer the sequential reader would have given.
fn read_thoughts_chunk(
    client: &CentralClient,
    now_refs: &[String],
) -> Result<Vec<TemporalEvent>, (usize, TemporalEventsError)> {
    const STREAM: &str = "central-now-thoughts";
    let mut events = Vec::new();
    for (index, now_ref) in now_refs.iter().enumerate() {
        let envelope = client
            .run_envelope(
                "central.now.thoughts.read",
                json!({
                    "project": Value::Null,
                    "now_ref": now_ref,
                    "include_content": true,
                    "limit": THOUGHT_LIMIT,
                }),
            )
            .map_err(|error| (index, unavailable(STREAM, error)))?;
        if envelope.pointer("/data/automatic_agent_or_model_invocation") == Some(&Value::Bool(true))
        {
            return Err((index, refused_reading(STREAM)));
        }
        let directory = envelope
            .pointer("/data/directory")
            .and_then(Value::as_str)
            .unwrap_or_default();
        for fixture in envelope
            .pointer("/data/fixtures")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
        {
            let mapped = thought_fixture_to_event(now_ref, directory, fixture)
                .map_err(|error| (index, error))?;
            events.push(mapped);
        }
    }
    Ok(events)
}

/// Read the temporal-events field through every wired stream adapter.
///
/// Cost law (profiled 2026-10-09 against the live ground, 109 registered
/// clearings): the projection's own work is microseconds; the read's cost
/// lived in ~114 serial owner-process spawns — each `oi central` launch
/// ~0.5 s through the suite wrapper — for a ~55 s answer. This reader
/// changes how the same sources are read, never what they answer:
///
/// - ONE `central.now.list` reading serves both the clearing refs and the
///   clearing events (they read the same register);
/// - the independent owners (civil field, wiki placement, kernel log,
///   aikit history) run beside the per-clearing thought fan-out, which is
///   bounded at [`THOUGHT_WORKERS`];
/// - the Central owner executable is named directly when the host
///   provides it (`OI_CENTRAL_CTRL_BIN`), one process per Action instead
///   of two;
/// - the assembled answer is retained for the agency read horizon (2 s),
///   keyed by the exact query.
///
/// Event identity is untouched: the same sources, the same mappers, the
/// same [`project`] (refusals, exactly-once, ordering, day derivation),
/// and error precedence identical to the sequential reader's.
pub fn read_field(
    client: &CentralClient,
    cache: &std::sync::Mutex<crate::read_cache::OwnerReadCache>,
    log_receipts: &[crate::events::KernelEventReceipt],
    cwd: PathBuf,
    query: &TemporalQuery,
) -> Result<TemporalEventsAnswer, TemporalEventsError> {
    use crate::temporal_events::project;

    let cache_key = format!(
        "{TEMPORAL_CACHE_PREFIX}{}",
        serde_json::to_string(query).map_err(|error| TemporalEventsError::CivilTime {
            reason: format!("temporal query serialisation failed: {error}"),
        })?
    );
    if let Some(cached) = cache
        .lock()
        .expect("temporal read cache lock")
        .get(&cache_key, crate::read_cache::HORIZON_TTL)
    {
        return serde_json::from_value(cached).map_err(|error| TemporalEventsError::CivilTime {
            reason: format!("retained temporal answer unreadable: {error}"),
        });
    }

    let owner = client
        .owner_direct_from_env()
        .unwrap_or_else(|| client.clone());
    let observed = jiff::Timestamp::now().to_string();

    std::thread::scope(
        |scope| -> Result<TemporalEventsAnswer, TemporalEventsError> {
            // Independent owners first: the civil field, the register listing,
            // the wiki placement and the aikit history read beside each other.
            let policy = scope.spawn(|| load_civil_field(&owner));
            let now_list = scope.spawn(|| {
                owner.run_envelope("central.now.list", json!({ "project": Value::Null }))
            });
            let wiki = scope.spawn(|| WikiReturnsPlacementSource::new(owner.clone()).read());
            let aikit = scope.spawn(|| AikitHistorySource::discover(cwd.clone()).read());

            // The register reading arrives first: the thought fan-out reads
            // from it. One reading serves the refs and the clearing events —
            // the sequential reader spawned the same Action twice.
            const NOW_STREAM: &str = "central-now";
            let now_envelope = now_list.join().expect("now.list reader").map_err(|error| {
                TemporalEventsError::SourceUnavailable {
                    stream: NOW_STREAM.to_string(),
                    detail: error.to_string(),
                }
            });
            let now_records = match &now_envelope {
                Ok(envelope) if envelope_refused(envelope) => Err(refused_reading(NOW_STREAM)),
                Ok(envelope) => envelope
                    .pointer("/data/records")
                    .and_then(Value::as_array)
                    .ok_or_else(|| TemporalEventsError::InvalidRecord {
                        stream: NOW_STREAM.to_string(),
                        position: String::new(),
                        reason: "the field reading carries no `records` array".into(),
                    })
                    .map(|records| records.to_vec()),
                Err(error) => Err(error.clone()),
            };

            let thoughts = now_records
                .as_ref()
                .map(|records| {
                    let now_refs: Vec<String> = records
                        .iter()
                        .filter_map(|record| {
                            record
                                .get("now_ref")
                                .and_then(Value::as_str)
                                .map(str::to_string)
                        })
                        .collect();
                    let chunk = now_refs.len().div_ceil(THOUGHT_WORKERS).max(1);
                    now_refs
                        .chunks(chunk)
                        .map(|part| {
                            let client = owner.clone();
                            let part = part.to_vec();
                            scope.spawn(move || read_thoughts_chunk(&client, &part))
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            // Sequential error precedence: civil field, register reading,
            // clearing events, thoughts (earliest failing ref), wiki
            // placement, kernel log, aikit history.
            let field = policy.join().expect("civil field reader")?;
            let now_records = now_records?;
            let now_events: Result<Vec<TemporalEvent>, TemporalEventsError> =
                now_records.iter().map(now_record_to_event).collect();
            let now_events = now_events?;
            let mut thought_events = Vec::new();
            for handle in thoughts {
                match handle.join().expect("thought reader") {
                    Ok(mut part) => thought_events.append(&mut part),
                    Err((_, error)) => return Err(error),
                }
            }
            let wiki_events = wiki.join().expect("wiki reader")?;
            let kernel_events: Result<Vec<TemporalEvent>, TemporalEventsError> =
                log_receipts.iter().map(kernel_receipt_to_event).collect();
            let kernel_events = kernel_events?;
            let aikit_events = aikit.join().expect("aikit reader")?;

            let now_stream = Collected {
                name: "central-now",
                events: now_events,
            };
            let thoughts_stream = Collected {
                name: "central-now-thoughts",
                events: thought_events,
            };
            let wiki_stream = Collected {
                name: "wiki-returns",
                events: wiki_events,
            };
            let kernel_stream = Collected {
                name: "kernel-event-log",
                events: kernel_events,
            };
            let aikit_stream = Collected {
                name: "aikit-history",
                events: aikit_events,
            };
            let answer = project(
                &[
                    &now_stream,
                    &thoughts_stream,
                    &wiki_stream,
                    &kernel_stream,
                    &aikit_stream,
                ],
                &field,
                &observed,
                query,
            )?;
            cache.lock().expect("temporal read cache lock").put(
                cache_key,
                serde_json::to_value(&answer).map_err(|error| TemporalEventsError::CivilTime {
                    reason: format!("temporal answer serialisation failed: {error}"),
                })?,
            );
            Ok(answer)
        },
    )
}

/// The envelope's automatic-reading refusal flag — one check, shared by
/// every reader of one envelope.
fn envelope_refused(envelope: &Value) -> bool {
    envelope.pointer("/data/automatic_agent_or_model_invocation") == Some(&Value::Bool(true))
}

#[cfg(test)]
mod read_field_tests {
    //! The assembled field against a scripted owner executable: the call
    /// counting proves the spawn economics (one register reading, bounded
    /// fan-out), and the answers prove the event identity the projection
    /// guarantees is unchanged by reading the streams in parallel.
    use super::*;
    use std::fmt::Write as _;
    use std::os::unix::fs::PermissionsExt;
    use std::sync::Mutex;

    struct FakeOwner {
        directory: PathBuf,
    }

    impl FakeOwner {
        /// A script standing in for the Central owner binary: it logs each
        /// Action it was asked to run and answers from canned readings.
        /// Paths are baked in (no process-global env), so parallel tests
        /// never share state.
        fn new(name: &str, nowlist: &str, thoughts_reply: &str) -> Self {
            let directory = std::env::temp_dir()
                .join(format!("oi-temporal-fake-{}-{name}", std::process::id()));
            std::fs::create_dir_all(&directory).unwrap();
            let calls = directory.join("calls.log");
            fn write_file(
                directory: &std::path::Path,
                file: &str,
                body: impl AsRef<[u8]>,
            ) -> PathBuf {
                let path = directory.join(file);
                std::fs::write(&path, body).unwrap();
                path
            }
            let policy = write_file(
                &directory,
                "policy.json",
                r#"{"ok":true,"status":"success","action":"central.time.policy","data":{"policy":{"timezone":"Europe/London","day_boundary_minutes":0,"scope_ref":"control:root"},"revision":"rev-1","scope_ref":"control:root"}}"#,
            );
            let nowlist = write_file(&directory, "nowlist.json", nowlist);
            let thoughts = write_file(&directory, "thoughts.json", thoughts_reply);
            let refused = write_file(
                &directory,
                "refused.json",
                r#"{"ok":true,"data":{"automatic_agent_or_model_invocation":true}}"#,
            );
            let files = write_file(
                &directory,
                "files.json",
                r#"{"ok":true,"data":{"entries":[{"kind":"file","name":"return.md","location":{"path":"Control/agents/wiki/returns/return.md","ref":"central:path:return-md"}}]}}"#,
            );
            let aikit = write_file(
                &directory,
                "aikit.json",
                r#"{"ok":true,"data":{"entries":[{"id":"ev-1","kind":"generation","subject":"factory/run-01","summary":"a retained report","occurred_at_unix_ms":1791428384933}]}}"#,
            );
            let script = write_file(&directory, "owner.sh", {
                let mut body = String::from("#!/bin/bash\n");
                // aikit shape: `-C <cwd> history --json`
                let _ = writeln!(
                    body,
                    r#"if [ "$1" = "-C" ]; then cat {}; exit 0; fi"#,
                    aikit.display()
                );
                let _ = writeln!(body, r#"echo "$4" >> {}"#, calls.display());
                let _ = writeln!(body, r#"case "$4" in"#);
                let _ = writeln!(
                    body,
                    r#"  central.time.policy) cat {} ;;"#,
                    policy.display()
                );
                let _ = writeln!(body, r#"  central.now.list) cat {} ;;"#, nowlist.display());
                let _ = writeln!(
                    body,
                    r#"  central.now.thoughts.read) sleep 0.03; case "$5" in *unavailable-ref*) cat {};; *) cat {};; esac ;;"#,
                    refused.display(),
                    thoughts.display()
                );
                let _ = writeln!(body, r#"  central.files.list) cat {} ;;"#, files.display());
                let _ = writeln!(body, r#"  *) printf '{{"ok":false}}' ;;"#);
                let _ = writeln!(body, "esac");
                body
            });
            std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap();
            Self { directory }
        }

        fn client(&self) -> CentralClient {
            // The aikit history source discovers its binary from the
            // environment; the fake stands in for it the same way. Every
            // fake answers the history branch identically, so parallel
            // tests that re-pin the variable cannot observe a difference.
            std::env::set_var("OI_AIKIT_BIN", self.directory.join("owner.sh"));
            CentralClient::with(
                self.directory.join("owner.sh"),
                None,
                "test-project".to_owned(),
            )
        }

        fn calls(&self) -> Vec<String> {
            std::fs::read_to_string(self.directory.join("calls.log"))
                .unwrap_or_default()
                .lines()
                .map(str::to_owned)
                .collect()
        }
    }

    impl Drop for FakeOwner {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.directory);
        }
    }

    fn nowlist(refs: &[&str]) -> String {
        let records: Vec<String> = refs
            .iter()
            .enumerate()
            .map(|(index, reference)| {
                format!(
                    r#"{{"now_ref":"{reference}","created_at_unix_seconds":{},"purpose":"clearing {index}"}}"#,
                    1791460800 + index as i64 * 3600
                )
            })
            .collect();
        format!(
            r#"{{"ok":true,"data":{{"records":[{}]}}}}"#,
            records.join(",")
        )
    }

    const THOUGHTS_REPLY: &str = r#"{"ok":true,"data":{"directory":"dir/T","fixtures":[{"file":"a.json","conforming":true,"content":"{\"utc\": \"2026-10-08T09:00:00+01:00\"}"}]}}"#;

    fn receipts() -> Vec<crate::events::KernelEventReceipt> {
        let mut log = crate::events::KernelEventLog::new();
        log.record(crate::events::KernelEvent::WorkingSurfaceDriving {
            agent_session: "sess-1".into(),
            binding: "keyboard".into(),
            client_id: "client-1".into(),
            driving: true,
            observed_at_unix_ms: 1791460592000,
        });
        log.record(crate::events::KernelEvent::WorldChanged {
            summary: "the world moved".into(),
        });
        log.since(1)
    }

    fn window_all() -> TemporalQuery {
        TemporalQuery {
            window: crate::temporal_events::Window::All,
            ..Default::default()
        }
    }

    #[test]
    fn one_register_reading_serves_refs_and_events_and_every_ref_is_answered() {
        let owner = FakeOwner::new(
            "dedupe",
            &nowlist(&["ref-a", "ref-b", "ref-c", "ref-d"]),
            THOUGHTS_REPLY,
        );
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &receipts(),
            owner.directory.clone(),
            &window_all(),
        )
        .unwrap();

        let mut counts: Vec<(String, usize)> = owner
            .calls()
            .iter()
            .map(|call| (call.clone(), 1))
            .fold(Vec::new(), |mut acc, (call, n)| {
                match acc.iter_mut().find(|(seen, _)| *seen == call) {
                    Some((_, count)) => *count += n,
                    None => acc.push((call, n)),
                }
                acc
            });
        counts.sort();
        assert_eq!(
            counts,
            vec![
                ("central.files.list".to_owned(), 1),
                ("central.now.list".to_owned(), 1),
                ("central.now.thoughts.read".to_owned(), 4),
                ("central.time.policy".to_owned(), 1),
            ],
            "the register reading is shared, and every clearing is asked once"
        );

        // Every stream joined the field: 4 clearings + 4 thoughts + 1 wiki
        // placement + 2 kernel receipts + 1 aikit entry.
        let by_stream = |name: &str| {
            answer
                .events
                .iter()
                .filter(|event| event.stream == name)
                .count()
        };
        assert_eq!(by_stream("central-now"), 4);
        assert_eq!(by_stream("central-now-thoughts"), 4);
        assert_eq!(by_stream("wiki-returns"), 1);
        assert_eq!(by_stream("kernel-event-log"), 2);
        assert_eq!(by_stream("aikit-history"), 1);
        // Thought identity is the clearing's own ref even though the
        // fixture replies were read in parallel.
        for reference in ["ref-a", "ref-b", "ref-c", "ref-d"] {
            assert!(answer
                .events
                .iter()
                .any(|event| event.stream_position == format!("{reference}#T/a.json")));
        }
    }

    #[test]
    fn a_retained_answer_serves_the_horizon_and_a_new_query_rereads() {
        let owner = FakeOwner::new("cache", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let client = owner.client();
        let first =
            read_field(&client, &cache, &[], owner.directory.clone(), &window_all()).unwrap();
        let calls_after_first = owner.calls().len();
        let second =
            read_field(&client, &cache, &[], owner.directory.clone(), &window_all()).unwrap();
        assert_eq!(first, second, "a retained answer is the identical document");
        assert_eq!(
            owner.calls().len(),
            calls_after_first,
            "a query inside the horizon spawns nothing"
        );
        let narrowed = TemporalQuery {
            subject: Some("ref-a".to_owned()),
            ..window_all()
        };
        read_field(&client, &cache, &[], owner.directory.clone(), &narrowed).unwrap();
        assert!(
            owner.calls().len() > calls_after_first,
            "a different query is a different observation"
        );
    }

    #[test]
    fn a_refused_thought_reading_fails_the_read_by_name() {
        let owner = FakeOwner::new(
            "refusal",
            &nowlist(&["ok-ref", "unavailable-ref"]),
            THOUGHTS_REPLY,
        );
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let error = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &window_all(),
        )
        .unwrap_err();
        match error {
            TemporalEventsError::SourceUnavailable { stream, .. } => {
                assert_eq!(stream, "central-now-thoughts");
            }
            other => panic!("expected a source refusal, got {other}"),
        }
    }

    #[test]
    fn a_missing_register_reading_is_refused_like_the_source_refuses_it() {
        let owner = FakeOwner::new("no-records", r#"{"ok":true,"data":{}}"#, THOUGHTS_REPLY);
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let error = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &window_all(),
        )
        .unwrap_err();
        assert!(matches!(
            error,
            TemporalEventsError::InvalidRecord { ref stream, .. } if stream == "central-now"
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::KernelEvent;

    fn field() -> crate::temporal_events::CivilField {
        crate::temporal_events::CivilField::new(
            "Europe/London".into(),
            0,
            "control:root".into(),
            "central.content-fnv1a64/v1:741:69da4a44ad65b27f".into(),
        )
        .unwrap()
    }

    #[test]
    fn a_clearing_record_inherits_its_created_instant() {
        let record: Value = serde_json::from_str(
            r#"{
                "now_ref": "central:now:control:root:015179906b520721df793e96188199bc72906d7b2011048c7be07830f625a4f8",
                "created_at_unix_seconds": 1791322833,
                "lifecycle": "active",
                "purpose": "Harness wiring",
                "source_ref": "central:source:control:root:Control/agents/now/clearings/015179906b/now.json",
                "revision": {"revision": "central.content-fnv1a64/v1:941:496fc2ca4c0e8270"}
            }"#,
        )
        .unwrap();
        let event = now_record_to_event(&record).unwrap();
        assert_eq!(event.kind, EventKind::Now);
        assert_eq!(event.civil_instant.as_deref(), Some("2026-10-06T21:40:33Z"));
        assert_eq!(
            event.day_ref, None,
            "day derivation is the projection's act"
        );
        assert_eq!(event.evidence_refs.len(), 2);

        // Through the projection the day arrives, derived from the policy.
        let source = crate::temporal_events::project(
            &[&CentralNowListFixture(event)],
            &field(),
            "2026-10-08T13:00:00+01:00",
            &crate::temporal_events::TemporalQuery {
                window: crate::temporal_events::Window::Day {
                    day_ref: "central:day:control:root:2026-10-06".into(),
                },
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(source.events.len(), 1);
        assert_eq!(
            source.events[0].day_ref.as_deref(),
            Some("central:day:control:root:2026-10-06")
        );
    }

    struct CentralNowListFixture(TemporalEvent);
    impl TemporalStreamSource for CentralNowListFixture {
        fn stream_name(&self) -> &str {
            "central-now"
        }
        fn events(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
            Ok(vec![self.0.clone()])
        }
    }

    #[test]
    fn a_thought_fixture_inherits_its_utc_and_a_pre_law_one_carries_no_time() {
        let conforming: Value = serde_json::from_str(
            r#"{
                "file": "a-fixture.json",
                "conforming": true,
                "revision": "central.content-fnv1a64/v1:100:aaaa",
                "content": "{\"utc\": \"2026-10-08T08:15:00+01:00\", \"note\": \"raw\"}"
            }"#,
        )
        .unwrap();
        let event =
            thought_fixture_to_event("central:now:control:root:abc", "dir/T", &conforming).unwrap();
        assert_eq!(event.kind, EventKind::Thought);
        assert_eq!(
            event.civil_instant.as_deref(),
            Some("2026-10-08T08:15:00+01:00")
        );
        assert_eq!(
            event.stream_position,
            "central:now:control:root:abc#T/a-fixture.json"
        );

        let pre_law: Value = serde_json::from_str(
            r#"{ "file": "older-note.md", "conforming": false, "revision": "central.content-fnv1a64/v1:1:bbbb" }"#,
        )
        .unwrap();
        let event =
            thought_fixture_to_event("central:now:control:root:abc", "dir/T", &pre_law).unwrap();
        assert!(event.civil_instant.is_none());
        assert!(event.summary.contains("nonconforming"));
    }

    #[test]
    fn a_wiki_return_placement_is_instant_less_but_evidence_ref_d() {
        let listing: Value = serde_json::from_str(
            r#"{
                "automatic_agent_or_model_invocation": false,
                "entries": [
                    {"kind": "file", "name": "ta-onta-and-the-thought-stream-2026-09-16.md",
                     "location": {"path": "Control/agents/wiki/returns/ta-onta-and-the-thought-stream-2026-09-16.md",
                                  "ref": "central:path:/Users/admin/Central:Control/agents/wiki/returns/ta-onta-and-the-thought-stream-2026-09-16.md"}}
                ]
            }"#,
        )
        .unwrap();
        let entries = listing["entries"].as_array().unwrap();
        let path = entries[0]["location"]["path"].as_str().unwrap();
        let reference = entries[0]["location"]["ref"].as_str().unwrap();
        let event = TemporalEvent {
            stream: "wiki-returns".into(),
            kind: EventKind::Return,
            thought_type: None,
            subject_ref: reference.to_string(),
            civil_instant: None,
            instant_unix_ms: None,
            day_ref: None,
            stream_position: path.to_string(),
            evidence_refs: vec![reference.to_string()],
            summary: entries[0]["name"].as_str().unwrap().to_string(),
        };
        assert!(event.civil_instant.is_none());
        assert_eq!(event.kind, EventKind::Return);
        assert!(event.evidence_refs[0].starts_with("central:path:"));
    }

    #[test]
    fn kernel_receipts_inherit_observed_at_only_where_the_variant_carries_it() {
        let mut log = KernelEventLog::new();
        log.record(KernelEvent::WorkingSurfaceDriving {
            agent_session: "sess-1".into(),
            binding: "keyboard".into(),
            client_id: "client-1".into(),
            driving: true,
            observed_at_unix_ms: 1791460592000,
        });
        log.record(KernelEvent::WorldChanged {
            summary: "the world moved".into(),
        });

        let source = KernelEventLogSource::new(&log);
        assert_eq!(source.stream_name(), "kernel-event-log");
        let events = source.read().unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(
            events[0].civil_instant.as_deref(),
            Some("2026-10-08T11:56:32Z")
        );
        assert_eq!(events[0].subject_ref, "sess-1");
        assert_eq!(events[1].civil_instant, None);
        assert_eq!(events[1].summary, "world_changed");
        assert_eq!(events[1].stream_position, "seq-2");
    }

    #[test]
    fn aikit_history_kinds_map_onto_the_field_vocabulary() {
        let entry: Value = serde_json::from_str(
            r#"{
                "id": "ev-1",
                "kind": "generation",
                "subject": "factory/run-01",
                "summary": "a retained report",
                "occurred_at_unix_ms": 1791428384933,
                "canonical_refs": ["factory.run-thought-consumption/v1:abc"]
            }"#,
        )
        .unwrap();
        let event = history_entry_to_event(&entry).unwrap();
        assert_eq!(event.kind, EventKind::Generation);
        assert_eq!(
            event.civil_instant.as_deref(),
            Some("2026-10-08T02:59:44.933Z")
        );
        assert_eq!(history_kind_to_event_kind("procedure"), EventKind::Run);
        assert_eq!(
            history_kind_to_event_kind("familiarity"),
            EventKind::Curation
        );
        assert_eq!(history_kind_to_event_kind("session-space"), EventKind::Now);
        assert_eq!(
            history_kind_to_event_kind("knowledge-route"),
            EventKind::Knowledge
        );
    }
}
