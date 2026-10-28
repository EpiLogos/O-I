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
//! | [`factory_runs_read`] | Factory run receipts | `factory telemetry day` (`factory.telemetry-day/v1`) |
//! | [`day_opening`] | the opening of today's Day | `central.day.read` (root) |
//!
//! Owner readings follow the house law (`history.rs`, `central.rs`): an
//! envelope flagged `automatic_agent_or_model_invocation` is refused, never
//! degraded into a reading. A source's own time is inherited verbatim where
//! the source records one (`created_at`, the fixture's `utc`, an aikit
//! evidence `occurred_at`, a kernel `observed_at`, a Factory signal's
//! `updated_at_unix_ms`, a Day's `opened_at_unix_seconds`) and left absent
//! where it does not — the field never receives an invented time.
//!
//! Central's Day joins as its opening: the Day reading
//! (`central.day-reading/v1`) states the instant ensure-day opened the Day
//! (`opened_at_unix_seconds`, O-I #756), and that instant is the moment. A
//! Day that states none gives no moment (never a midnight, never the time it
//! was read).

use crate::events::KernelEventLog;
use crate::factory::OwnerRequest;
use crate::flow::{CentralClient, OwnerCallError};
use crate::temporal_events::{
    AbsenceReason, CivilField, EventKind, StreamAbsence, TemporalEvent, TemporalEventsAnswer,
    TemporalEventsError, TemporalQuery, TemporalStreamSource, Window,
};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
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

    /// Every named clearing's fixtures: Central's NOW batch in one call when
    /// the owner has it ([`read_thoughts_batch`]), else one read per clearing
    /// in order, stopping at the first that fails.
    pub fn read(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
        const STREAM: &str = "central-now-thoughts";
        if let Some(answer) = read_thoughts_batch(&self.client, &self.now_refs, self.limit) {
            return answer;
        }
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
            events.append(&mut thoughts_from_envelope(now_ref, &envelope)?);
        }
        Ok(events)
    }
}

/// One clearing's `central.now.thoughts.read` envelope — a single read's,
/// or one item of Central's NOW batch, which is exactly that envelope — as
/// thought events: an automatic or model-invoked reading is refused by name;
/// a refusal of the clearing (an envelope with no reading) adds no events,
/// as it always has; each fixture maps through [`thought_fixture_to_event`].
fn thoughts_from_envelope(
    now_ref: &str,
    envelope: &Value,
) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
    const STREAM: &str = "central-now-thoughts";
    if envelope.pointer("/data/automatic_agent_or_model_invocation") == Some(&Value::Bool(true)) {
        return Err(refused_reading(STREAM));
    }
    let directory = envelope
        .pointer("/data/directory")
        .and_then(Value::as_str)
        .unwrap_or_default();
    envelope
        .pointer("/data/fixtures")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
        .iter()
        .map(|fixture| thought_fixture_to_event(now_ref, directory, fixture))
        .collect()
}

/// Central's NOW batch (`central.now.thoughts.read-batch`, Central #273):
/// many clearings' thought streams in one owner call, each item exactly the
/// `central.now.thoughts.read` envelope for its ref, in request order.
const THOUGHTS_BATCH: &str = "central.now.thoughts.read-batch";
/// Central's own bound on one batch's refs.
const THOUGHTS_BATCH_MAX: usize = 4096;

/// The Central owner a thought read reaches, as far as the kernel can see it:
/// the client's own route (`retained_resource_epoch`: its executables, root
/// and route) and the executables the host names — the suite (`OI_BIN`, else
/// `oi`) and the pinned Central owner (`OI_CENTRAL_CTRL_BIN`) — each by path
/// and file identity. A replaced owner is another identity.
fn central_identity(client: &CentralClient) -> CentralIdentity {
    (
        client.retained_resource_epoch(),
        crate::knowledge::AikitIdentity::pinned(
            &std::env::var_os("OI_BIN").unwrap_or_else(|| "oi".into()),
            std::env::var_os("OI_CENTRAL_CTRL_BIN").filter(|value| !value.is_empty()),
        ),
    )
}

type CentralIdentity = (String, crate::knowledge::AikitIdentity);

/// The Central owners that refused the NOW batch as an unknown Action.
static WITHOUT_THOUGHTS_BATCH: std::sync::OnceLock<
    std::sync::Mutex<std::collections::HashSet<CentralIdentity>>,
> = std::sync::OnceLock::new();

fn without_thoughts_batch(
) -> std::sync::MutexGuard<'static, std::collections::HashSet<CentralIdentity>> {
    WITHOUT_THOUGHTS_BATCH
        .get_or_init(Default::default)
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Every clearing's thoughts through Central's NOW batch: the same events,
/// in the same order, with the same error precedence (the earliest failing
/// clearing) as one read per clearing. `None` when this Central owner has no
/// batch — its own refusal names the Action unknown — remembered for its
/// identity, so the caller reads one clearing at a time, as before.
fn read_thoughts_batch(
    client: &CentralClient,
    now_refs: &[String],
    limit: u64,
) -> Option<Result<Vec<TemporalEvent>, TemporalEventsError>> {
    const STREAM: &str = "central-now-thoughts";
    if now_refs.is_empty() {
        return Some(Ok(Vec::new()));
    }
    let identity = central_identity(client);
    if without_thoughts_batch().contains(&identity) {
        return None;
    }
    let invalid = |reason: &str| TemporalEventsError::InvalidRecord {
        stream: STREAM.to_string(),
        position: String::new(),
        reason: reason.to_string(),
    };
    let mut events = Vec::new();
    for refs in now_refs.chunks(THOUGHTS_BATCH_MAX) {
        let envelope = match client.run_envelope(
            THOUGHTS_BATCH,
            json!({
                "project": Value::Null,
                "now_refs": refs,
                "include_content": true,
                "limit": limit,
            }),
        ) {
            Ok(envelope) => envelope,
            Err(error) => return Some(Err(unavailable(STREAM, error))),
        };
        if envelope["ok"] != true {
            if envelope
                .pointer("/error/message")
                .and_then(Value::as_str)
                .is_some_and(|message| message.starts_with("Unknown Action"))
            {
                without_thoughts_batch().insert(identity);
                return None;
            }
            // A request, scope or register fault refuses the whole call, as
            // it would refuse every single read: a refused clearing adds no
            // events.
            continue;
        }
        if envelope_refused(&envelope) {
            return Some(Err(refused_reading(STREAM)));
        }
        let items = match envelope.pointer("/data/items").and_then(Value::as_array) {
            Some(items) if items.len() == refs.len() => items,
            _ => {
                return Some(Err(invalid(
                    "Central's NOW batch did not answer each clearing it was asked",
                )))
            }
        };
        for (now_ref, item) in refs.iter().zip(items) {
            if item["now_ref"].as_str() != Some(now_ref.as_str()) {
                return Some(Err(invalid(
                    "Central's NOW batch answered a clearing out of request order",
                )));
            }
            match thoughts_from_envelope(now_ref, &item["result"]) {
                Ok(mut part) => events.append(&mut part),
                Err(error) => return Some(Err(error)),
            }
        }
    }
    Some(Ok(events))
}

/// The register's thought stream for the assembled field: Central's NOW
/// batch when the owner has it, else the bounded per-clearing fan-out
/// ([`read_thoughts_chunk`]), earliest failing clearing first either way.
fn read_thoughts(
    client: &CentralClient,
    now_refs: &[String],
) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
    if let Some(answer) = read_thoughts_batch(client, now_refs, THOUGHT_LIMIT) {
        return answer;
    }
    let chunk = now_refs.len().div_ceil(THOUGHT_WORKERS).max(1);
    std::thread::scope(|scope| {
        let readers: Vec<_> = now_refs
            .chunks(chunk)
            .map(|part| {
                scope.spawn(crate::read_cache::carried(move || {
                    read_thoughts_chunk(client, part)
                }))
            })
            .collect();
        let mut events = Vec::new();
        for reader in readers {
            match reader.join().expect("thought reader") {
                Ok(mut part) => events.append(&mut part),
                Err((_, error)) => return Err(error),
            }
        }
        Ok(events)
    })
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
        without_notices(self.log.since(1))
            .iter()
            .map(kernel_receipt_to_event)
            .collect()
    }
}

/// The receipts that are events of the kernel's own state. A notice that
/// files changed (`ReadingsChanged`) says "ask again", not that something
/// happened in the ground, and reading it would change the field it asks
/// about.
pub(crate) fn without_notices(
    receipts: Vec<crate::events::KernelEventReceipt>,
) -> Vec<crate::events::KernelEventReceipt> {
    receipts
        .into_iter()
        .filter(|receipt| receipt.envelope.event.tag() != "readings_changed")
        .collect()
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
/// AIKit's history reading (measured 1.6 s on the real ground, 15 Oct); the
/// bound is the Factory stream's, for an owner that never answers.
const HISTORY_READ_LIMIT: std::time::Duration = std::time::Duration::from_secs(30);

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
        // Bounded like every owner call (owner_process.rs).
        let output = crate::owner_process::output(
            Command::new(&self.executable)
                .arg("-C")
                .arg(&self.cwd)
                .arg("history")
                .arg("--json"),
            None,
            crate::owner_process::Bound::read("AIKit", "history", HISTORY_READ_LIMIT),
        )
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

// ---------------------------------------------------------------------------
// Central's Day — `central.day.read` (root register, today's Day)
// ---------------------------------------------------------------------------

/// Central's Day: the moment today's Day was opened.
const DAY_STREAM: &str = "central-day";

const DAY_READING_SCHEMA: &str = "central.day-reading/v1";

fn day_absence(reason: AbsenceReason, owner_words: String) -> StreamAbsence {
    StreamAbsence {
        stream: DAY_STREAM.into(),
        reason,
        owner_words,
        source_ref: None,
    }
}

/// Central's answer for today's Day (`central.day.read`, root register) as its opening: one moment at the instant the
/// reading says the Day was opened (`opened_at_unix_seconds`, which ensure-day records as it opens the Day), inherited
/// verbatim. A Day that states no opening is no moment — never its midnight, never the time it was read — and no absence:
/// "no moment" is an answer. Central's refusal (before the first Day: "no DayRef or current today pointer"), an absent
/// owner and a reading out of contract are named absences, and the field still answers.
pub(crate) fn day_opening(
    answer: Result<Value, OwnerCallError>,
) -> Result<Vec<TemporalEvent>, StreamAbsence> {
    let envelope = answer.map_err(|error| {
        let reason = match error {
            OwnerCallError::Unavailable { .. } => AbsenceReason::OwnerAbsent,
            OwnerCallError::Refused { .. } => AbsenceReason::Refused,
            OwnerCallError::Malformed { .. } => AbsenceReason::OwnerUnreadable,
        };
        day_absence(reason, error.to_string())
    })?;
    if envelope["ok"] != true {
        let words = envelope
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or_default();
        return Err(day_absence(AbsenceReason::Refused, words.to_owned()));
    }
    if envelope_refused(&envelope) {
        return Err(day_absence(
            AbsenceReason::Refused,
            "the owner answered with an automatic or model-invoked reading; refused".into(),
        ));
    }
    let unreadable = |reason: String| day_absence(AbsenceReason::OwnerUnreadable, reason);
    let day = &envelope["data"];
    if day["schema"] != DAY_READING_SCHEMA {
        return Err(unreadable(format!(
            "the Day reading is not `{DAY_READING_SCHEMA}`"
        )));
    }
    let day_ref = day["day_ref"]
        .as_str()
        .filter(|day_ref| !day_ref.is_empty())
        .ok_or_else(|| unreadable("the Day reading names no `day_ref`".into()))?;
    let opened = match day.get("opened_at_unix_seconds") {
        None | Some(Value::Null) => return Ok(Vec::new()),
        Some(opened) => opened
            .as_i64()
            .ok_or_else(|| unreadable("`opened_at_unix_seconds` is not an integer".into()))?,
    };
    let civil_instant = jiff::Timestamp::from_second(opened)
        .map(|instant| instant.to_string())
        .map_err(|error| {
            unreadable(format!(
                "`opened_at_unix_seconds` ({opened}) is not a valid instant: {error}"
            ))
        })?;
    let evidence_refs = [
        day.pointer("/source/ref"),
        day.pointer("/revision/revision"),
    ]
    .into_iter()
    .flatten()
    .filter_map(Value::as_str)
    .map(str::to_owned)
    .collect();
    let civil_date = day
        .pointer("/temporal/civil_date")
        .and_then(Value::as_str)
        .unwrap_or(day_ref);
    Ok(vec![TemporalEvent {
        stream: DAY_STREAM.into(),
        kind: EventKind::Day,
        thought_type: None,
        subject_ref: day_ref.to_owned(),
        civil_instant: Some(civil_instant),
        instant_unix_ms: None,
        day_ref: None,
        stream_position: format!("{day_ref}#opened"),
        evidence_refs,
        summary: format!("The Day {civil_date} opened."),
    }])
}

// ---------------------------------------------------------------------------
// Factory run receipts — `factory telemetry day` (factory.telemetry-day/v1)
// ---------------------------------------------------------------------------

const FACTORY_STREAM: &str = "factory-runs";

/// The longest the field waits for the Factory stream. The owner's telemetry
/// day read is bounded at the owner (the inhabitation read bound, shorter than
/// this), so this wait is the field's second guard: it holds even if the owner
/// process does not return.
const FACTORY_READ_BOUND: std::time::Duration = std::time::Duration::from_secs(30);

/// The civil days one Factory day read is asked for, in the owner's own
/// grammar: one Day, or a named Day range.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum FactoryDays {
    One(String),
    Range { from: String, through: String },
}

/// The civil date (`YYYY-MM-DD`) an instant falls on under the field's
/// policy — the same derivation the projection uses for `day_ref`.
fn civil_date_of_ms(field: &CivilField, millis: i64) -> Result<String, TemporalEventsError> {
    let instant = unix_millis_instant(FACTORY_STREAM, "window", millis)?;
    let day_ref = field.day_ref_for(&instant)?;
    Ok(day_ref.rsplit(':').next().unwrap_or_default().to_string())
}

/// The Factory days a query window names. A registered Day names its one
/// civil date; a Between window names the civil days its half-open span
/// touches; `All` names no span, so no Factory day is read for it (no span
/// is invented to stand in for it).
pub(crate) fn factory_days_for(
    window: &Window,
    field: &CivilField,
) -> Result<Option<FactoryDays>, TemporalEventsError> {
    match window {
        Window::All => Ok(None),
        Window::Day { day_ref } => {
            let date = day_ref.rsplit(':').next().unwrap_or_default();
            Ok(date
                .parse::<jiff::civil::Date>()
                .ok()
                .map(|_| FactoryDays::One(date.to_string())))
        }
        Window::Between {
            from_unix_ms,
            to_unix_ms,
        } => {
            if to_unix_ms <= from_unix_ms {
                return Ok(None);
            }
            let from = civil_date_of_ms(field, *from_unix_ms)?;
            // The window is half-open: its last instant sits one millisecond
            // before `to`.
            let through = civil_date_of_ms(field, to_unix_ms - 1)?;
            Ok(Some(if from == through {
                FactoryDays::One(from)
            } else {
                FactoryDays::Range { from, through }
            }))
        }
    }
}

/// Map one located Factory source's day reading into run moments: one per
/// signal that names a run (`run_ref`). The moment's instant is the signal's
/// `updated_at_unix_ms`, inherited verbatim. The day reading states no
/// creation or occurred-at instant for a run receipt, so the moment is placed
/// at the owner's last update to the signal: it moves when the owner updates
/// the signal again, and the Timeline names that placement. A signal that
/// states no `updated_at_unix_ms` is instant-less (it never joins a civil
/// window). A reading whose signal names no `signal_ref`, or names one twice,
/// is refused whole by the caller.
pub(crate) fn telemetry_day_to_events(
    source_ref: &str,
    reading: &Value,
) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
    let signals = reading
        .get("signals")
        .and_then(Value::as_array)
        .ok_or_else(|| TemporalEventsError::InvalidRecord {
            stream: FACTORY_STREAM.to_string(),
            position: source_ref.to_string(),
            reason: "the day reading carries no `signals` array".into(),
        })?;
    let mut seen = BTreeSet::new();
    let mut events = Vec::new();
    for signal in signals {
        let Some(run_ref) = signal
            .get("run_ref")
            .and_then(Value::as_str)
            .filter(|run| !run.is_empty())
        else {
            continue;
        };
        let signal_ref = require_str(FACTORY_STREAM, signal, "signal_ref", source_ref)?;
        let position = format!("{source_ref}#{signal_ref}");
        if !seen.insert(position.clone()) {
            return Err(TemporalEventsError::InvalidRecord {
                stream: FACTORY_STREAM.to_string(),
                position,
                reason: "the day reading names one signal twice".into(),
            });
        }
        let civil_instant = signal
            .get("updated_at_unix_ms")
            .and_then(Value::as_i64)
            .map(|millis| unix_millis_instant(FACTORY_STREAM, &position, millis))
            .transpose()?;
        let mut evidence = vec![signal_ref.to_string()];
        evidence.extend(
            signal
                .get("source_refs")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .take(7)
                .map(str::to_string),
        );
        events.push(TemporalEvent {
            stream: FACTORY_STREAM.into(),
            kind: EventKind::Run,
            thought_type: None,
            subject_ref: run_ref.to_string(),
            civil_instant,
            instant_unix_ms: None,
            day_ref: None,
            stream_position: position,
            evidence_refs: evidence,
            summary: signal
                .get("summary")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
        });
    }
    Ok(events)
}

/// The Factory stream's reading, and the named cause of its silence when it
/// contributed nothing.
pub(crate) struct FactoryReading {
    pub(crate) events: Vec<TemporalEvent>,
    /// Every named cause the stream holds: one per failing source, one per
    /// refused position, or the stream-wide cause when nothing was readable.
    pub(crate) absences: Vec<StreamAbsence>,
}

/// The named cause of one owner failure, by the kind the owner call reports:
/// an executable that is not there is `owner-absent`, a bound's stop is
/// `owner-timeout`, the owner's own refusal is `refused`, and any other
/// answer the field cannot read is `owner-unreadable`.
pub(crate) fn owner_failure_reason(error: &crate::material::Error) -> AbsenceReason {
    match error.kind.as_str() {
        "unavailable" => AbsenceReason::OwnerAbsent,
        "timeout" => AbsenceReason::OwnerTimeout,
        "owner-refused-or-failed" => AbsenceReason::Refused,
        _ => AbsenceReason::OwnerUnreadable,
    }
}

/// The Factory run stream. Read only where the window names days: the owner
/// locates each Central root's Factory source (`factory project locate`,
/// through Central's world reading), then asks each located source for its
/// day reading. Factory is a named absence for this stream, never an error
/// for the field: no world reading, no located source, a refused or
/// unreadable answer, or a malformed reading contributes no moments from
/// that point, and the rest of the field answers as it would without
/// Factory.
///
/// Located sources are merged by position (`source_ref#signal_ref`): the same
/// Factory state reached from two roots is one moment, and two sources that
/// give one position different content keep neither (see
/// [`merge_factory_moments`]). The field never fails for this stream.
///
/// The silence is named, not swallowed. Each failing source names its own
/// cause, with its `source_ref` where the owner stated one, even when other
/// sources contributed moments. A located, readable source that holds no run
/// in the window is "no moment" and names nothing; a root that is not a
/// Factory source names its cause only when no source is readable and nothing
/// else failed.
pub(crate) fn factory_runs_read(
    client: &CentralClient,
    window: &Window,
    field: &CivilField,
) -> FactoryReading {
    let silent = |reason: AbsenceReason, owner_words: String| FactoryReading {
        events: Vec::new(),
        absences: vec![factory_absence(reason, owner_words, None)],
    };
    let days = match factory_days_for(window, field) {
        Ok(Some(days)) => days,
        // No Factory day is named: nothing was asked of the owner, so nothing
        // is absent.
        Ok(None) | Err(_) => {
            return FactoryReading {
                events: Vec::new(),
                absences: Vec::new(),
            }
        }
    };
    let world = match crate::world::read_world(client) {
        Ok(world) => world,
        Err(words) => return silent(AbsenceReason::OwnerUnreadable, words),
    };
    let located = match locate_remembering(&world) {
        Ok(located) => located,
        Err(error) => return silent(owner_failure_reason(&error), error.message),
    };

    // The moments of each located source that answered its day reading,
    // whatever it holds, with that source's ref.
    let mut readings: Vec<(String, Vec<TemporalEvent>)> = Vec::new();
    // Each failing source, in read order, named with its own cause.
    let mut failures: Vec<StreamAbsence> = Vec::new();
    // Roots that are not a Factory source; named only when nothing else is.
    let mut absent_roots: Vec<StreamAbsence> = Vec::new();
    for row in located
        .get("locations")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let row_words = row
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        match row.get("state").and_then(Value::as_str) {
            Some("located") => {}
            Some("absent") => {
                absent_roots.push(factory_absence(AbsenceReason::OwnerAbsent, row_words, None));
                continue;
            }
            Some("refused") => {
                failures.push(factory_absence(AbsenceReason::Refused, row_words, None));
                continue;
            }
            _ => {
                failures.push(factory_absence(
                    AbsenceReason::OwnerUnreadable,
                    "the owner's locate row names no known state".into(),
                    None,
                ));
                continue;
            }
        }
        let (Some(state), Some(source_ref)) = (
            row.pointer("/location/statePath").and_then(Value::as_str),
            row.pointer("/location/projectRef").and_then(Value::as_str),
        ) else {
            failures.push(factory_absence(
                AbsenceReason::OwnerUnreadable,
                "the located answer names no state path".into(),
                None,
            ));
            continue;
        };
        let (day, from_day, through_day) = match &days {
            FactoryDays::One(day) => (Some(day.clone()), None, None),
            FactoryDays::Range { from, through } => {
                (None, Some(from.clone()), Some(through.clone()))
            }
        };
        let reading = match crate::factory::owner(
            OwnerRequest::TelemetryDay {
                state_path: PathBuf::from(state),
                day,
                from_day,
                through_day,
            },
            None,
        ) {
            Ok(reading) => reading,
            Err(error) => {
                // A located source whose day reading fails is located again
                // on the next read: its remembered location may be stale.
                if let Some(root) = row.get("root").and_then(Value::as_str) {
                    forget_location(root);
                }
                failures.push(factory_absence(
                    owner_failure_reason(&error),
                    error.message,
                    Some(source_ref.to_string()),
                ));
                continue;
            }
        };
        match telemetry_day_to_events(source_ref, &reading) {
            Ok(moments) => readings.push((source_ref.to_string(), moments)),
            Err(error) => failures.push(factory_absence(
                AbsenceReason::OwnerUnreadable,
                error.to_string(),
                Some(source_ref.to_string()),
            )),
        }
    }

    let readable = !readings.is_empty();
    let (events, refusals) = merge_factory_moments(readings);
    let mut absences = refusals;
    absences.extend(failures);
    if !readable && absences.is_empty() {
        absences.extend(absent_roots.into_iter().next());
    }
    FactoryReading { events, absences }
}

/// Factory's own locate answers, remembered per root for the World epoch
/// (lane W3). Each temporal read used to ask `factory project locate` of the
/// root and every Work project (17 processes against the real ground, 13 of
/// them refused the same way every time: no `.factory` there). A root's
/// answer is kept for the World that named it — the Central root and its Work
/// projects, by name and path — and the Factory executable that gave it, and
/// served while what the answer stood on still stands:
///
/// - `absent` while the root still has no `.factory` directory (the premise
///   the row was classified on, factory.rs `locate_row`);
/// - `located` while the state file it names is still there; a day reading
///   that fails forgets it (`forget_location`), so the next read locates
///   that root again;
/// - `refused` while the root's `.factory` directory is still there.
///
/// A new World (a project added, moved or renamed), a new Factory executable
/// or a ground bind (`forget_factory_locations`) asks again. Nothing here is
/// the kernel's own answer: each row is the owner's, verbatim.
type LocateKey = (crate::knowledge::AikitIdentity, String);
static FACTORY_LOCATIONS: std::sync::OnceLock<
    std::sync::Mutex<std::collections::HashMap<LocateKey, (String, Value)>>,
> = std::sync::OnceLock::new();

fn factory_locations(
) -> std::sync::MutexGuard<'static, std::collections::HashMap<LocateKey, (String, Value)>> {
    FACTORY_LOCATIONS
        .get_or_init(Default::default)
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// The Factory executable a locate reaches, by path and file identity.
fn factory_identity() -> crate::knowledge::AikitIdentity {
    let (executable, _) = crate::factory::owner_executable();
    crate::knowledge::AikitIdentity::pinned(executable.as_os_str(), None)
}

/// The World epoch a locate answer belongs to: the roots the World names.
fn world_epoch(roots: &[(Option<String>, PathBuf)]) -> String {
    use sha2::{Digest, Sha256};
    let mut digest = Sha256::new();
    for (project, root) in roots {
        digest.update(project.as_deref().unwrap_or("").as_bytes());
        digest.update([0]);
        digest.update(root.as_os_str().as_encoded_bytes());
        digest.update([0]);
    }
    format!("{:x}", digest.finalize())
}

/// A remembered row still stands on what it was answered on.
fn still_stands(row: &Value, root: &std::path::Path) -> bool {
    match row.get("state").and_then(Value::as_str) {
        Some("absent") => !root.join(".factory").exists(),
        Some("refused") => root.join(".factory").exists(),
        Some("located") => row
            .pointer("/location/statePath")
            .and_then(Value::as_str)
            .is_some_and(|state| std::path::Path::new(state).exists()),
        _ => false,
    }
}

/// Factory source discovery over every root the World names, asking the
/// owner only for the roots whose answer this World epoch does not already
/// hold. The answer is the discovery `factory::owner` gives
/// (`oi.factory-source-discovery/v1`, one row per root in World order).
pub(crate) fn locate_remembering(world: &Value) -> Result<Value, crate::material::Error> {
    let roots = crate::factory::locate_roots(world, None, true)?;
    let epoch = world_epoch(&roots);
    let identity = factory_identity();
    let key = |root: &std::path::Path| (identity.clone(), root.to_string_lossy().into_owned());
    let mut rows: Vec<Option<Value>> = {
        let held = factory_locations();
        roots
            .iter()
            .map(|(_, root)| {
                held.get(&key(root))
                    .filter(|(at, row)| *at == epoch && still_stands(row, root))
                    .map(|(_, row)| row.clone())
            })
            .collect()
    };
    let asked: Vec<(Option<String>, PathBuf)> = roots
        .iter()
        .zip(&rows)
        .filter(|(_, held)| held.is_none())
        .map(|(root, _)| root.clone())
        .collect();
    let mut answered = crate::factory::locate_each(asked.clone()).into_iter();
    {
        let mut held = factory_locations();
        for ((_, root), row) in roots.iter().zip(rows.iter_mut()) {
            if row.is_some() {
                continue;
            }
            let answer = answered
                .next()
                .unwrap_or_else(|| json!({"state": "refused", "error": "locate worker failed"}));
            held.insert(key(root), (epoch.clone(), answer.clone()));
            *row = Some(answer);
        }
    }
    Ok(json!({
        "contract": "oi.factory-source-discovery/v1",
        "locations": rows.into_iter().flatten().collect::<Vec<_>>(),
    }))
}

/// Forget one root's remembered locate answer.
fn forget_location(root: &str) {
    factory_locations().retain(|(_, at), _| at != root);
}

/// Forget every remembered locate answer: a ground bind re-based every root.
pub(crate) fn forget_factory_locations() {
    factory_locations().clear();
}

/// One named absence for the Factory stream, with the source it names when the
/// owner stated one.
fn factory_absence(
    reason: AbsenceReason,
    owner_words: String,
    source_ref: Option<String>,
) -> StreamAbsence {
    StreamAbsence {
        stream: FACTORY_STREAM.into(),
        reason,
        owner_words,
        source_ref,
    }
}

/// Merge the Factory moments of every readable located source into one moment
/// per position. The same position with the same content, from two sources, is
/// one moment: the same Factory state reached from two roots. The same position
/// with different content keeps neither: the position is refused by name (the
/// owner's two readings disagree on it), and every other moment still answers.
pub(crate) fn merge_factory_moments(
    readings: Vec<(String, Vec<TemporalEvent>)>,
) -> (Vec<TemporalEvent>, Vec<StreamAbsence>) {
    let mut kept: BTreeMap<String, TemporalEvent> = BTreeMap::new();
    // Refused positions, each with the source that gave the disagreeing reading.
    let mut refused: BTreeMap<String, String> = BTreeMap::new();
    for (source_ref, moments) in readings {
        for moment in moments {
            let position = moment.stream_position.clone();
            if refused.contains_key(&position) {
                continue;
            }
            match kept.get(&position) {
                None => {
                    kept.insert(position, moment);
                }
                Some(held) if *held == moment => {}
                Some(_) => {
                    kept.remove(&position);
                    refused.insert(position, source_ref.clone());
                }
            }
        }
    }
    let absences = refused
        .into_iter()
        .map(|(position, source_ref)| {
            factory_absence(
                AbsenceReason::Refused,
                format!("the owner's two readings disagree on {position}"),
                Some(source_ref),
            )
        })
        .collect();
    (kept.into_values().collect(), absences)
}

/// The field's own wait on the Factory stream, as its reading arrives. A
/// stream that answers later than the bound is named as the owner's timeout,
/// and a stream whose reader ended without an answer as unreadable. The
/// words are the field's own: no owner answered them.
pub(crate) fn awaited_factory(
    received: Result<FactoryReading, std::sync::mpsc::RecvTimeoutError>,
) -> FactoryReading {
    let named = |reason: AbsenceReason, owner_words: String| FactoryReading {
        events: Vec::new(),
        absences: vec![factory_absence(reason, owner_words, None)],
    };
    match received {
        Ok(reading) => reading,
        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => named(
            AbsenceReason::OwnerTimeout,
            format!(
                "the Factory owner did not answer within {} s; the field stopped waiting",
                FACTORY_READ_BOUND.as_secs()
            ),
        ),
        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => named(
            AbsenceReason::OwnerUnreadable,
            "the Factory read ended without an answer".into(),
        ),
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

/// The cached-answer key. A retained answer echoes the instant it was
/// observed - never a fresher one - and, because the field also reads the
/// kernel's own event log (which no file change announces), it is held for
/// `read_cache::HORIZON_TTL` at most even while the watch validates the rest;
/// that bound is stricter than the minute its relative windows move at. The
/// owner readings it is made of go through the read model.
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
        events.append(
            &mut thoughts_from_envelope(now_ref, &envelope).map_err(|error| (index, error))?,
        );
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
///   aikit history, today's Day) run beside the thought stream, which is
///   ONE call to Central's NOW batch (`central.now.thoughts.read-batch`) —
///   or, for a Central without it, the per-clearing fan-out bounded at
///   [`THOUGHT_WORKERS`]; the Factory run stream follows the civil field
///   (its window needs the policy) and is non-fatal, and so is the Day's;
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
    // The answer is retained under a ticket taken before its owners are
    // asked: a write the kernel carried meanwhile (a NOW, Day, receiving or
    // Factory receipt, `retire_answers`) withdraws it, so the answer read
    // across the write is given to its caller and never retained.
    let ticket = {
        let mut held = cache.lock().expect("temporal read cache lock");
        if let Some(cached) = held.get(&cache_key, crate::read_cache::HORIZON_TTL) {
            return serde_json::from_value(cached).map_err(|error| {
                TemporalEventsError::CivilTime {
                    reason: format!("retained temporal answer unreadable: {error}"),
                }
            });
        }
        held.begin(cache_key.clone())
    };

    let owner = client
        .owner_direct_from_env()
        .unwrap_or_else(|| client.clone());
    let observed = jiff::Timestamp::now().to_string();

    std::thread::scope(
        |scope| -> Result<TemporalEventsAnswer, TemporalEventsError> {
            // Independent owners first: the civil field, the register listing,
            // the wiki placement and the aikit history read beside each other.
            let policy = scope.spawn(crate::read_cache::carried(|| load_civil_field(&owner)));
            let now_list = scope.spawn(crate::read_cache::carried(|| {
                owner.run_envelope("central.now.list", json!({ "project": Value::Null }))
            }));
            let wiki = scope.spawn(crate::read_cache::carried(|| {
                WikiReturnsPlacementSource::new(owner.clone()).read()
            }));
            let aikit = scope.spawn(crate::read_cache::carried(|| {
                AikitHistorySource::discover(cwd.clone()).read()
            }));
            // Today's Day, for the instant it was opened.
            let day = scope.spawn(crate::read_cache::carried(|| {
                day_opening(
                    owner.run_envelope("central.day.read", json!({ "project": Value::Null })),
                )
            }));

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

            let thoughts = now_records.as_ref().ok().map(|records| {
                let now_refs: Vec<String> = records
                    .iter()
                    .filter_map(|record| {
                        record
                            .get("now_ref")
                            .and_then(Value::as_str)
                            .map(str::to_string)
                    })
                    .collect();
                let client = owner.clone();
                scope.spawn(crate::read_cache::carried(move || {
                    read_thoughts(&client, &now_refs)
                }))
            });

            // Sequential error precedence: civil field, register reading,
            // clearing events, thoughts (earliest failing ref), wiki
            // placement, kernel log, aikit history.
            let field = policy.join().expect("civil field reader")?;
            // The Factory run stream needs the civil field for its window. It
            // runs detached from the scope, so an owner that stalls past the
            // bound cannot hold the field; its thread ends with its owner call.
            let factory = {
                let window = query.window.clone();
                let field = field.clone();
                let client = owner.clone();
                let (sender, receiver) = std::sync::mpsc::channel();
                std::thread::spawn(crate::read_cache::carried(move || {
                    let _ = sender.send(factory_runs_read(&client, &window, &field));
                }));
                receiver
            };
            let now_records = now_records?;
            let now_events: Result<Vec<TemporalEvent>, TemporalEventsError> =
                now_records.iter().map(now_record_to_event).collect();
            let now_events = now_events?;
            let thought_events = match thoughts {
                Some(reader) => reader.join().expect("thought reader")?,
                None => Vec::new(),
            };
            let wiki_events = wiki.join().expect("wiki reader")?;
            let kernel_events: Result<Vec<TemporalEvent>, TemporalEventsError> =
                log_receipts.iter().map(kernel_receipt_to_event).collect();
            let kernel_events = kernel_events?;
            let aikit_events = aikit.join().expect("aikit reader")?;
            // Bounded: a Factory answer later than the bound is a named absence
            // for this stream, never a stalled field. The owner bounds its own
            // reads; this wait is the second guard.
            let FactoryReading {
                events: factory_events,
                absences: factory_absences,
            } = awaited_factory(factory.recv_timeout(FACTORY_READ_BOUND));
            let (day_events, day_absences) = match day.join().expect("day reader") {
                Ok(events) => (events, Vec::new()),
                Err(absence) => (Vec::new(), vec![absence]),
            };

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
            let factory_stream = Collected {
                name: FACTORY_STREAM,
                events: factory_events,
            };
            let day_stream = Collected {
                name: DAY_STREAM,
                events: day_events,
            };
            let mut answer = project(
                &[
                    &now_stream,
                    &thoughts_stream,
                    &wiki_stream,
                    &kernel_stream,
                    &aikit_stream,
                    &factory_stream,
                    &day_stream,
                ],
                &field,
                &observed,
                query,
            )?;
            // Every stream that swallowed its failure names it here (Factory's,
            // the Day's); the five others fail the whole reading by name and
            // never reach this list.
            answer.absences = factory_absences.into_iter().chain(day_absences).collect();
            let retained =
                serde_json::to_value(&answer).map_err(|error| TemporalEventsError::CivilTime {
                    reason: format!("temporal answer serialisation failed: {error}"),
                })?;
            let mut held = cache.lock().expect("temporal read cache lock");
            if held.finish(&cache_key, ticket) {
                held.put(cache_key, retained);
            }
            Ok(answer)
        },
    )
}

/// Retire the temporal field's retained answers and every read in flight
/// (their tickets): a write the kernel carried moved a ground the field reads
/// (owner_write.rs). The Factory locate memo is the World epoch's and stays.
pub(crate) fn retire_answers(cache: &std::sync::Mutex<crate::read_cache::OwnerReadCache>) {
    cache
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .invalidate_prefix(TEMPORAL_CACHE_PREFIX);
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
            const REFUSED: &str =
                r#"{"ok":true,"data":{"automatic_agent_or_model_invocation":true}}"#;
            const DENIED: &str = r#"{"ok":false,"status":"forbidden","action":"central.now.thoughts.read","error":{"code":"forbidden","message":"outside the agent aperture"}}"#;
            let refused = write_file(&directory, "refused.json", REFUSED);
            let denied = write_file(&directory, "denied.json", DENIED);
            // Central's NOW batch over the register's own refs: each item is
            // exactly the envelope the single read answers for that ref.
            let items: Vec<Value> = std::fs::read_to_string(&nowlist)
                .ok()
                .and_then(|text| serde_json::from_str::<Value>(&text).ok())
                .and_then(|list| list.pointer("/data/records").cloned())
                .and_then(|records| records.as_array().cloned())
                .unwrap_or_default()
                .iter()
                .filter_map(|record| record["now_ref"].as_str().map(str::to_owned))
                .map(|now_ref| {
                    let result = if now_ref.contains("unavailable-ref") {
                        REFUSED
                    } else if now_ref.contains("denied-ref") {
                        DENIED
                    } else {
                        thoughts_reply
                    };
                    json!({"now_ref": now_ref, "result": serde_json::from_str::<Value>(result).unwrap()})
                })
                .collect();
            let refusals = items
                .iter()
                .filter(|item| item["result"]["ok"] != true)
                .count();
            let batch = write_file(
                &directory,
                "batch.json",
                json!({"ok": true, "status": "success", "action": "central.now.thoughts.read-batch", "data": {
                    "schema": "central.thoughts-batch-reading/v1", "scope_ref": "control:root",
                    "requested": items.len(), "answered": items.len() - refusals, "refused": refusals,
                    "items": items, "automatic_agent_or_model_invocation": false}})
                .to_string(),
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
            // Today's Day, as `central.day.read` answers it once ensure-day opened it; a test that wants another Day
            // reading writes its own.
            let day = write_file(&directory, "day.json", DAY_OPENED);
            // The Factory owner: an empty locate file answers `absent` (the
            // owner's own "No such file" refusal); a located reading is written
            // by the test that wants one. Factory calls log to their own file,
            // so the register counts stay the Central owner's alone.
            let factory_calls = directory.join("factory-calls.log");
            let factory_locate = write_file(&directory, "factory-locate.json", "");
            let factory_day = write_file(
                &directory,
                "factory-day.json",
                r#"{"schema":"factory.telemetry-day/v1","signals":[]}"#,
            );
            // A second root (`Work/b`, a project in the world reading) and its
            // own state (`state-b.json`), for tests that read two sources.
            let factory_locate_b = write_file(&directory, "factory-locate-b.json", "");
            let factory_day_b = write_file(
                &directory,
                "factory-day-b.json",
                r#"{"schema":"factory.telemetry-day/v1","signals":[]}"#,
            );
            let world = write_file(
                &directory,
                "world.json",
                format!(
                    r#"{{"ok":true,"data":{{"schema":"central.world-map/v1","root":"{}","work":{{"projects":[]}}}}}}"#,
                    directory.display()
                ),
            );
            let script = write_file(&directory, "owner.sh", {
                let mut body = String::from("#!/bin/bash\n");
                // aikit shape: `-C <cwd> history --json`
                let _ = writeln!(
                    body,
                    r#"if [ "$1" = "-C" ]; then cat {}; exit 0; fi"#,
                    aikit.display()
                );
                // factory shape (OI_FACTORY_BIN, no suite prefix):
                // `project locate <root> --json` and `telemetry day <state> ... --json`
                let _ = writeln!(
                    body,
                    r#"if [ "$1" = "project" ]; then echo "$*" >> {log}; case "$3" in *Work/b) cat {locate_b}; exit 0;; esac; if [ -s {locate} ]; then cat {locate}; exit 0; fi; echo "No such file or directory" >&2; exit 1; fi"#,
                    log = factory_calls.display(),
                    locate = factory_locate.display(),
                    locate_b = factory_locate_b.display()
                );
                let _ = writeln!(
                    body,
                    r#"if [ "$1" = "telemetry" ]; then echo "$*" >> {log}; case "$3" in *state-b.json) cat {day_b};; *) cat {day};; esac; exit 0; fi"#,
                    log = factory_calls.display(),
                    day_b = factory_day_b.display(),
                    day = factory_day.display()
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
                    r#"  central.now.thoughts.read) sleep 0.03; case "$5" in *unavailable-ref*) cat {};; *denied-ref*) cat {};; *) cat {};; esac ;;"#,
                    refused.display(),
                    denied.display(),
                    thoughts.display()
                );
                let _ = writeln!(
                    body,
                    r#"  central.now.thoughts.read-batch) sleep 0.03; cat {} ;;"#,
                    batch.display()
                );
                let _ = writeln!(body, r#"  central.files.list) cat {} ;;"#, files.display());
                let _ = writeln!(body, r#"  central.day.read) cat {} ;;"#, day.display());
                let _ = writeln!(body, r#"  central.world) cat {} ;;"#, world.display());
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
            std::env::set_var("OI_FACTORY_BIN", self.directory.join("owner.sh"));
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

        fn factory_calls(&self) -> Vec<String> {
            std::fs::read_to_string(self.directory.join("factory-calls.log"))
                .unwrap_or_default()
                .lines()
                .map(str::to_owned)
                .collect()
        }
    }

    /// The owner executables are named through process-global variables
    /// (`OI_AIKIT_BIN`, `OI_FACTORY_BIN`). Each read test holds this lock for
    /// its whole run, so one test's fake is never removed under another's read.
    static OWNER_ENV: Mutex<()> = Mutex::new(());

    fn owner_env() -> std::sync::MutexGuard<'static, ()> {
        OWNER_ENV
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// One located Factory source, as `factory project locate` answers it.
    const LOCATED: &str = r#"{"contract":"factory.project-location/v1","projectRef":"project:fixture","statePath":"/fixture/state.json"}"#;

    /// A Factory day reading with one run-bearing signal inside the span, one
    /// signal naming no run, and one run-bearing signal that states no instant.
    const DAY_READING: &str = r#"{"schema":"factory.telemetry-day/v1","signals":[
        {"signal_ref":"signal:S1","summary":"run A receipt","source_refs":["github:fixture#1"],"run_ref":"run:A","updated_at_unix_ms":1791460592000},
        {"signal_ref":"signal:S2","summary":"no run here","source_refs":[],"run_ref":null,"updated_at_unix_ms":1791460600000},
        {"signal_ref":"signal:S3","summary":"run B, no instant","source_refs":[],"run_ref":"run:B"}
    ]}"#;

    /// The span 2026-10-08 05:00Z to 2026-10-09 05:00Z (Europe/London days
    /// 2026-10-08 and 2026-10-09 are the two it touches).
    fn span_window() -> TemporalQuery {
        TemporalQuery {
            window: Window::Between {
                from_unix_ms: "2026-10-08T05:00:00Z"
                    .parse::<jiff::Timestamp>()
                    .unwrap()
                    .as_millisecond(),
                to_unix_ms: "2026-10-09T05:00:00Z"
                    .parse::<jiff::Timestamp>()
                    .unwrap()
                    .as_millisecond(),
            },
            ..Default::default()
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

    /// Today's Day as `central.day.read` answers it (the installed `ctrl`'s shape, 28 Oct 2026, its content left out),
    /// opened at 2026-10-08T07:30:00Z by ensure-day.
    const DAY_OPENED: &str = r#"{"ok":true,"status":"success","action":"central.day.read","data":{"schema":"central.day-reading/v1",
        "day_ref":"central:day:control:root:2026-10-08",
        "source":{"ref":"central:source:control:root:Control/user/day/2026-10-08/day.md","path":"Control/user/day/2026-10-08/day.md"},
        "revision":{"byte_len":0,"revision":"central.content-fnv1a64/v1:0:cbf29ce484222325"},
        "temporal":{"schema":"central.human-day/v1","day_ref":"central:day:control:root:2026-10-08","civil_date":"2026-10-08","created_at_unix_seconds":1791444600,"lifecycle":"open"},
        "opened_at_unix_seconds":1791444600,"document_state":"uninitialised","document":null,"automatic_agent_or_model_invocation":false}}"#;

    /// The same Day from a Central whose reading states no opening instant (one before O-I #756, or a relation that
    /// records none).
    const DAY_UNSTATED: &str = r#"{"ok":true,"status":"success","action":"central.day.read","data":{"schema":"central.day-reading/v1",
        "day_ref":"central:day:control:root:2026-10-08",
        "source":{"ref":"central:source:control:root:Control/user/day/2026-10-08/day.md","path":"Control/user/day/2026-10-08/day.md"},
        "revision":{"byte_len":0,"revision":"central.content-fnv1a64/v1:0:cbf29ce484222325"},
        "temporal":{"schema":"central.human-day/v1","day_ref":"central:day:control:root:2026-10-08","civil_date":"2026-10-08","lifecycle":"open"},
        "document_state":"uninitialised","document":null,"automatic_agent_or_model_invocation":false}}"#;

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
        let _env = owner_env();
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
                ("central.day.read".to_owned(), 1),
                ("central.files.list".to_owned(), 1),
                ("central.now.list".to_owned(), 1),
                ("central.now.thoughts.read-batch".to_owned(), 1),
                ("central.time.policy".to_owned(), 1),
            ],
            "the register reading is shared, and every clearing is asked in one batch"
        );

        // Every stream joined the field: 4 clearings + 4 thoughts + 1 wiki
        // placement + 2 kernel receipts + 1 aikit entry + the Day's opening.
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
        assert_eq!(by_stream("central-day"), 1);
        // Thought identity is the clearing's own ref even though the
        // fixture replies were read in parallel.
        for reference in ["ref-a", "ref-b", "ref-c", "ref-d"] {
            assert!(answer
                .events
                .iter()
                .any(|event| event.stream_position == format!("{reference}#T/a.json")));
        }
    }

    /// A Central without the NOW batch refuses it as an unknown Action: the
    /// thought stream is read one clearing at a time, as before, with the
    /// same events — a clearing the owner refuses adds none either way — and
    /// the absence is remembered for that owner: the next read asks no batch.
    #[test]
    fn an_owner_without_the_batch_is_read_one_clearing_at_a_time_with_the_same_events() {
        let _env = owner_env();
        let refs = ["ref-a", "denied-ref", "ref-c"];
        let thoughts = |answer: &TemporalEventsAnswer| -> Vec<TemporalEvent> {
            answer
                .events
                .iter()
                .filter(|event| event.stream == "central-now-thoughts")
                .cloned()
                .collect()
        };
        let batched = FakeOwner::new("with-batch", &nowlist(&refs), THOUGHTS_REPLY);
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let with_batch = read_field(
            &batched.client(),
            &cache,
            &[],
            batched.directory.clone(),
            &window_all(),
        )
        .unwrap();
        assert_eq!(
            batched
                .calls()
                .iter()
                .filter(|call| call.starts_with("central.now.thoughts"))
                .collect::<Vec<_>>(),
            vec!["central.now.thoughts.read-batch"]
        );

        let single = FakeOwner::new("without-batch", &nowlist(&refs), THOUGHTS_REPLY);
        std::fs::write(
            single.directory.join("batch.json"),
            r#"{"ok":false,"status":"invalid_input","action":"central.now.thoughts.read-batch","error":{"code":"invalid_input","message":"Unknown Action: central.now.thoughts.read-batch"}}"#,
        )
        .unwrap();
        let client = single.client();
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let one_by_one = read_field(
            &client,
            &cache,
            &[],
            single.directory.clone(),
            &window_all(),
        )
        .unwrap();
        assert_eq!(thoughts(&one_by_one), thoughts(&with_batch));
        assert_eq!(
            thoughts(&with_batch).len(),
            2,
            "the denied clearing adds none"
        );
        let asked = |name: &str| single.calls().iter().filter(|call| *call == name).count();
        assert_eq!(asked("central.now.thoughts.read-batch"), 1);
        assert_eq!(asked("central.now.thoughts.read"), 3);

        let narrowed = TemporalQuery {
            subject: Some("ref-a".to_owned()),
            ..window_all()
        };
        read_field(&client, &cache, &[], single.directory.clone(), &narrowed).unwrap();
        assert_eq!(
            asked("central.now.thoughts.read-batch"),
            1,
            "the owner's absence is remembered"
        );
        assert_eq!(asked("central.now.thoughts.read"), 6);
    }

    #[test]
    fn a_retained_answer_serves_the_horizon_and_a_new_query_rereads() {
        let _env = owner_env();
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
        let _env = owner_env();
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
        let _env = owner_env();
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

    fn day_moments(answer: &TemporalEventsAnswer) -> Vec<&TemporalEvent> {
        answer
            .events
            .iter()
            .filter(|event| event.stream == DAY_STREAM)
            .collect()
    }

    /// Central's Day joins the field at the instant it was opened (`central.day-reading/v1`
    /// `opened_at_unix_seconds`, O-I #756): one `day` moment on its own stream, on the civil day the policy places it.
    #[test]
    fn a_day_joins_the_field_at_the_instant_it_was_opened() {
        let _env = owner_env();
        let owner = FakeOwner::new("day-opened", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &span_window(),
        )
        .unwrap();
        let moments = day_moments(&answer);
        assert_eq!(moments.len(), 1, "{:?}", answer.events);
        let opened = moments[0];
        assert_eq!(opened.kind, EventKind::Day);
        assert_eq!(opened.subject_ref, "central:day:control:root:2026-10-08");
        assert_eq!(
            opened.civil_instant.as_deref(),
            Some("2026-10-08T07:30:00Z")
        );
        assert_eq!(opened.instant_unix_ms, Some(1_791_444_600_000));
        assert_eq!(
            opened.day_ref.as_deref(),
            Some("central:day:control:root:2026-10-08")
        );
        assert_eq!(
            opened.stream_position,
            "central:day:control:root:2026-10-08#opened"
        );
        assert_eq!(
            opened.evidence_refs,
            vec![
                "central:source:control:root:Control/user/day/2026-10-08/day.md".to_string(),
                "central.content-fnv1a64/v1:0:cbf29ce484222325".to_string(),
            ]
        );
        assert_eq!(opened.summary, "The Day 2026-10-08 opened.");
        assert!(
            answer
                .absences
                .iter()
                .all(|absence| absence.stream != DAY_STREAM),
            "{:?}",
            answer.absences
        );
        assert_eq!(
            owner
                .calls()
                .iter()
                .filter(|call| *call == "central.day.read")
                .count(),
            1
        );
    }

    /// A Day that states no opening instant is no moment and no absence: the field never invents one — not midnight,
    /// not the moment it was read.
    #[test]
    fn a_day_that_states_no_opening_is_no_moment() {
        let _env = owner_env();
        for (name, reading) in [
            ("day-unstated", DAY_UNSTATED.to_owned()),
            (
                "day-null",
                DAY_OPENED.replace(
                    r#""opened_at_unix_seconds":1791444600"#,
                    r#""opened_at_unix_seconds":null"#,
                ),
            ),
        ] {
            let owner = FakeOwner::new(name, &nowlist(&["ref-a"]), THOUGHTS_REPLY);
            std::fs::write(owner.directory.join("day.json"), reading).unwrap();
            let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
            let answer = read_field(
                &owner.client(),
                &cache,
                &[],
                owner.directory.clone(),
                &window_all(),
            )
            .unwrap();
            assert!(
                day_moments(&answer).is_empty(),
                "{name}: {:?}",
                answer.events
            );
            assert!(answer.absences.is_empty(), "{name}: {:?}", answer.absences);
            assert_eq!(
                answer
                    .events
                    .iter()
                    .filter(|event| event.stream == "central-now")
                    .count(),
                1,
                "{name}: the rest of the field answers"
            );
        }
    }

    /// Before the first Day is opened Central answers no ("no DayRef or current today pointer"): a named absence in the
    /// owner's own words, and the rest of the field still answers.
    #[test]
    fn a_refused_day_reading_is_a_named_absence_and_the_field_still_answers() {
        let _env = owner_env();
        let owner = FakeOwner::new("day-refused", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        std::fs::write(
            owner.directory.join("day.json"),
            r#"{"ok":false,"status":"unavailable_capability","action":"central.day.read","error":{"code":"source_or_scope_unavailable","message":"no DayRef or current today pointer"}}"#,
        )
        .unwrap();
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &window_all(),
        )
        .unwrap();
        assert!(day_moments(&answer).is_empty());
        assert_eq!(
            answer.absences,
            vec![StreamAbsence {
                stream: DAY_STREAM.into(),
                reason: AbsenceReason::Refused,
                owner_words: "no DayRef or current today pointer".into(),
                source_ref: None,
            }]
        );
        assert_eq!(
            answer
                .events
                .iter()
                .filter(|event| event.stream == "central-now")
                .count(),
            1
        );
    }

    /// A Day reading the field cannot read as its contract states, or one flagged automatic, is named, never a moment.
    #[test]
    fn a_day_reading_out_of_contract_is_named_never_a_moment() {
        let opened: Value = serde_json::from_str(DAY_OPENED).unwrap();
        let mapped = |envelope: Value| day_opening(Ok(envelope));
        assert_eq!(mapped(opened.clone()).unwrap().len(), 1);
        let mut automatic = opened.clone();
        automatic["data"]["automatic_agent_or_model_invocation"] = json!(true);
        assert_eq!(
            mapped(automatic).unwrap_err().reason,
            AbsenceReason::Refused
        );
        for (pointer, value) in [
            ("/data/schema", json!("central.day-reading/v0")),
            (
                "/data/opened_at_unix_seconds",
                json!("2026-10-08T07:30:00Z"),
            ),
            ("/data/day_ref", json!(null)),
        ] {
            let mut broken = opened.clone();
            *broken.pointer_mut(pointer).unwrap() = value;
            assert_eq!(
                mapped(broken).unwrap_err().reason,
                AbsenceReason::OwnerUnreadable,
                "{pointer}"
            );
        }
        assert_eq!(
            day_opening(Err(OwnerCallError::Unavailable {
                detail: "no ctrl".into()
            }))
            .unwrap_err()
            .reason,
            AbsenceReason::OwnerAbsent
        );
    }

    #[test]
    fn a_factory_day_reading_joins_its_run_moments_through_the_owner_reads() {
        let _env = owner_env();
        let owner = FakeOwner::new(
            "factory-day",
            r#"{"ok":true,"data":{"records":[]}}"#,
            THOUGHTS_REPLY,
        );
        std::fs::write(owner.directory.join("factory-locate.json"), LOCATED).unwrap();
        std::fs::create_dir_all(owner.directory.join(".factory")).unwrap();
        std::fs::write(owner.directory.join("factory-day.json"), DAY_READING).unwrap();
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &span_window(),
        )
        .unwrap();

        // S1 is the one run-bearing signal inside the span; S2 names no run;
        // S3 names a run but states no instant, so no civil window answers it.
        let moments: Vec<&TemporalEvent> = answer
            .events
            .iter()
            .filter(|event| event.stream == FACTORY_STREAM)
            .collect();
        assert_eq!(moments.len(), 1);
        assert_eq!(moments[0].subject_ref, "run:A");
        assert_eq!(moments[0].kind, EventKind::Run);
        assert_eq!(
            moments[0].civil_instant.as_deref(),
            Some("2026-10-08T11:56:32Z")
        );
        assert_eq!(
            moments[0].day_ref.as_deref(),
            Some("central:day:control:root:2026-10-08")
        );
        assert_eq!(moments[0].stream_position, "project:fixture#signal:S1");
        assert_eq!(
            moments[0].evidence_refs,
            vec!["signal:S1".to_string(), "github:fixture#1".to_string()]
        );

        // The span touches two civil days: one ranged read, located source only.
        assert_eq!(
            owner.factory_calls(),
            vec![
                format!("project locate {} --json", owner.directory.display()),
                "telemetry day /fixture/state.json --from-day 2026-10-08 --through-day 2026-10-09 --json"
                    .to_string(),
            ]
        );
    }

    #[test]
    fn the_factory_stream_asks_nothing_of_the_owner_for_a_window_without_days() {
        let _env = owner_env();
        let owner = FakeOwner::new("factory-all", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        std::fs::write(owner.directory.join("factory-locate.json"), LOCATED).unwrap();
        std::fs::create_dir_all(owner.directory.join(".factory")).unwrap();
        std::fs::write(owner.directory.join("factory-day.json"), DAY_READING).unwrap();
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &window_all(),
        )
        .unwrap();
        assert!(owner.factory_calls().is_empty());
        assert!(answer
            .events
            .iter()
            .all(|event| event.stream != FACTORY_STREAM));
    }

    #[test]
    fn an_absent_factory_owner_is_a_named_absence_and_the_field_still_answers() {
        let _env = owner_env();
        // The locate file stays empty: the owner names the root `absent`.
        let owner = FakeOwner::new("factory-absent", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &span_window(),
        )
        .unwrap();
        assert!(answer
            .events
            .iter()
            .all(|event| event.stream != FACTORY_STREAM));
        assert!(
            answer
                .events
                .iter()
                .any(|event| event.stream == "central-now"),
            "the other streams still join the field"
        );
        assert!(
            owner.factory_calls().is_empty(),
            "a root with no .factory is not asked: Factory locates only through it"
        );
        // The silence is named.
        assert_eq!(
            answer.absences,
            vec![StreamAbsence {
                stream: FACTORY_STREAM.into(),
                reason: AbsenceReason::OwnerAbsent,
                owner_words: format!("no .factory under {}", owner.directory.display()),
                source_ref: None,
            }]
        );
    }

    /// Lane W3: Factory's locate answers are remembered for the World epoch.
    /// A later read (its answer not retained — a write retired it) asks no
    /// locate while the root still stands as answered; a root that gains a
    /// Factory state is asked again; a ground bind forgets every answer.
    #[test]
    fn factory_locations_are_remembered_for_the_world_epoch() {
        let _env = owner_env();
        let owner = FakeOwner::new("factory-memo", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let read = || {
            retire_answers(&cache);
            read_field(
                &owner.client(),
                &cache,
                &[],
                owner.directory.clone(),
                &span_window(),
            )
            .unwrap()
        };
        let locate = format!("project locate {} --json", owner.directory.display());
        let located = |owner: &FakeOwner| {
            owner
                .factory_calls()
                .iter()
                .filter(|call| **call == locate)
                .count()
        };
        let first = read();
        assert_eq!(located(&owner), 0, "a root with no .factory is not asked");
        let second = read();
        assert_eq!(located(&owner), 0, "nor asked again");
        assert_eq!(
            first.absences, second.absences,
            "the remembered answer is the owner's own"
        );
        // The premise moved: the root has a `.factory` now.
        std::fs::create_dir_all(owner.directory.join(".factory")).unwrap();
        read();
        assert_eq!(
            located(&owner),
            1,
            "a root that gained a Factory state is asked"
        );
        read();
        assert_eq!(
            located(&owner),
            1,
            "its refusal is remembered while it stands"
        );
        forget_factory_locations();
        read();
        assert_eq!(located(&owner), 2, "a ground bind forgets every location");
    }

    #[test]
    fn a_refused_factory_locate_names_the_refusal_in_the_owners_words() {
        let _env = owner_env();
        let owner = FakeOwner::new("factory-refused", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        // A Factory state directory that the locate cannot read is a refusal,
        // not an absent source.
        std::fs::create_dir_all(owner.directory.join(".factory")).unwrap();
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &span_window(),
        )
        .unwrap();
        assert_eq!(
            answer.absences,
            vec![StreamAbsence {
                stream: FACTORY_STREAM.into(),
                reason: AbsenceReason::Refused,
                owner_words: "No such file or directory".into(),
                source_ref: None,
            }]
        );
    }

    #[test]
    fn a_factory_day_the_field_cannot_read_names_owner_unreadable() {
        let _env = owner_env();
        let owner = FakeOwner::new("factory-unreadable", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        std::fs::write(owner.directory.join("factory-locate.json"), LOCATED).unwrap();
        std::fs::create_dir_all(owner.directory.join(".factory")).unwrap();
        // A run-bearing signal that names no signal_ref is a reading the field
        // refuses whole.
        std::fs::write(
            owner.directory.join("factory-day.json"),
            r#"{"schema":"factory.telemetry-day/v1","signals":[{"run_ref":"run:A"}]}"#,
        )
        .unwrap();
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &span_window(),
        )
        .unwrap();
        assert_eq!(answer.absences.len(), 1, "{:?}", answer.absences);
        assert_eq!(answer.absences[0].stream, FACTORY_STREAM);
        assert_eq!(answer.absences[0].reason, AbsenceReason::OwnerUnreadable);
        assert!(
            answer.absences[0].owner_words.contains("signal_ref"),
            "{:?}",
            answer.absences
        );
    }

    #[test]
    fn a_readable_factory_source_with_no_run_in_the_window_is_no_moment_not_an_absence() {
        let _env = owner_env();
        let owner = FakeOwner::new("factory-quiet", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        // Located, and its day reading holds no signal: the owner is readable
        // and simply has no moment here.
        std::fs::write(owner.directory.join("factory-locate.json"), LOCATED).unwrap();
        std::fs::create_dir_all(owner.directory.join(".factory")).unwrap();
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &span_window(),
        )
        .unwrap();
        assert!(answer.absences.is_empty(), "{:?}", answer.absences);
        assert!(
            serde_json::to_value(&answer)
                .unwrap()
                .get("absences")
                .is_none(),
            "no absence keeps the answer's old shape"
        );
    }

    #[test]
    fn owner_failures_name_their_reason_by_the_kind_the_owner_call_reports() {
        let failure = |kind: &str| crate::material::Error {
            kind: kind.into(),
            message: "the owner's words".into(),
            operation_may_have_run: false,
        };
        assert_eq!(
            owner_failure_reason(&failure("unavailable")),
            AbsenceReason::OwnerAbsent
        );
        assert_eq!(
            owner_failure_reason(&failure("timeout")),
            AbsenceReason::OwnerTimeout
        );
        assert_eq!(
            owner_failure_reason(&failure("owner-refused-or-failed")),
            AbsenceReason::Refused
        );
        assert_eq!(
            owner_failure_reason(&failure("incompatible")),
            AbsenceReason::OwnerUnreadable
        );
        assert_eq!(
            owner_failure_reason(&failure("process-error")),
            AbsenceReason::OwnerUnreadable
        );
    }

    /// The world reading with a second root: `Work/b` beside Central's own root.
    fn with_a_second_root(owner: &FakeOwner) {
        std::fs::write(
            owner.directory.join("world.json"),
            format!(
                r#"{{"ok":true,"data":{{"schema":"central.world-map/v1","root":"{}","work":{{"projects":[{{"name":"b","path":"Work/b"}}]}}}}}}"#,
                owner.directory.display()
            ),
        )
        .unwrap();
        // Factory locates a source only through its `.factory` directory.
        std::fs::create_dir_all(owner.directory.join("Work/b/.factory")).unwrap();
    }

    /// A second located source: the same project, a second state file.
    const LOCATED_B: &str = r#"{"contract":"factory.project-location/v1","projectRef":"project:fixture","statePath":"/fixture/state-b.json"}"#;
    /// A second located source in another project, with its own state file.
    const LOCATED_OTHER_PROJECT: &str = r#"{"contract":"factory.project-location/v1","projectRef":"project:other","statePath":"/fixture/state-b.json"}"#;
    /// The second state's reading of the same position, revised in content.
    const DAY_READING_REVISED: &str = r#"{"schema":"factory.telemetry-day/v1","signals":[
        {"signal_ref":"signal:S1","summary":"run A receipt, revised","source_refs":["github:fixture#1"],"run_ref":"run:A","updated_at_unix_ms":1791460592000}
    ]}"#;
    /// A second state's reading that is malformed: a run signal with no `signal_ref`.
    const DAY_READING_MALFORMED: &str = r#"{"schema":"factory.telemetry-day/v1","signals":[{"run_ref":"run:A","updated_at_unix_ms":1791460592000}]}"#;

    fn factory_moments(answer: &TemporalEventsAnswer) -> Vec<&TemporalEvent> {
        answer
            .events
            .iter()
            .filter(|event| event.stream == FACTORY_STREAM)
            .collect()
    }

    #[test]
    fn the_same_factory_state_reached_from_two_roots_is_one_moment() {
        let _env = owner_env();
        let owner = FakeOwner::new("factory-two-roots", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        with_a_second_root(&owner);
        std::fs::write(owner.directory.join("factory-locate.json"), LOCATED).unwrap();
        std::fs::create_dir_all(owner.directory.join(".factory")).unwrap();
        std::fs::write(owner.directory.join("factory-locate-b.json"), LOCATED).unwrap();
        std::fs::write(owner.directory.join("factory-day.json"), DAY_READING).unwrap();
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &span_window(),
        )
        .expect("one state reached from two roots does not fail the field");

        let moments = factory_moments(&answer);
        assert_eq!(moments.len(), 1, "{moments:?}");
        assert_eq!(moments[0].stream_position, "project:fixture#signal:S1");
        assert!(answer.absences.is_empty(), "{:?}", answer.absences);
        assert_eq!(
            owner
                .factory_calls()
                .iter()
                .filter(|call| call.starts_with("telemetry day"))
                .count(),
            2,
            "each located source is read once"
        );
    }

    #[test]
    fn two_readings_that_disagree_on_a_position_refuse_it_by_name_and_the_field_still_answers() {
        let _env = owner_env();
        let owner = FakeOwner::new("factory-disagree", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        with_a_second_root(&owner);
        std::fs::write(owner.directory.join("factory-locate.json"), LOCATED).unwrap();
        std::fs::create_dir_all(owner.directory.join(".factory")).unwrap();
        std::fs::write(owner.directory.join("factory-locate-b.json"), LOCATED_B).unwrap();
        std::fs::write(owner.directory.join("factory-day.json"), DAY_READING).unwrap();
        std::fs::write(
            owner.directory.join("factory-day-b.json"),
            DAY_READING_REVISED,
        )
        .unwrap();
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &span_window(),
        )
        .expect("a disputed position refuses one moment, never the field");

        assert!(
            factory_moments(&answer).is_empty(),
            "the disputed position is kept neither: {:?}",
            answer.events
        );
        assert_eq!(
            answer.absences,
            vec![StreamAbsence {
                stream: FACTORY_STREAM.into(),
                reason: AbsenceReason::Refused,
                owner_words: "the owner's two readings disagree on project:fixture#signal:S1"
                    .into(),
                source_ref: Some("project:fixture".into()),
            }]
        );
        assert!(
            answer
                .events
                .iter()
                .any(|event| event.stream == "central-now"),
            "the other streams still answer"
        );
    }

    #[test]
    fn a_failing_source_is_named_by_its_source_ref_even_when_another_source_contributed_moments() {
        let _env = owner_env();
        let owner = FakeOwner::new("factory-partial", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        with_a_second_root(&owner);
        std::fs::write(owner.directory.join("factory-locate.json"), LOCATED).unwrap();
        std::fs::create_dir_all(owner.directory.join(".factory")).unwrap();
        std::fs::write(
            owner.directory.join("factory-locate-b.json"),
            LOCATED_OTHER_PROJECT,
        )
        .unwrap();
        std::fs::write(owner.directory.join("factory-day.json"), DAY_READING).unwrap();
        std::fs::write(
            owner.directory.join("factory-day-b.json"),
            DAY_READING_MALFORMED,
        )
        .unwrap();
        let cache = Mutex::new(crate::read_cache::OwnerReadCache::default());
        let answer = read_field(
            &owner.client(),
            &cache,
            &[],
            owner.directory.clone(),
            &span_window(),
        )
        .expect("a failing source never fails the field");

        let positions: Vec<&str> = factory_moments(&answer)
            .iter()
            .map(|event| event.stream_position.as_str())
            .collect();
        assert_eq!(positions, vec!["project:fixture#signal:S1"]);
        assert_eq!(answer.absences.len(), 1, "{:?}", answer.absences);
        assert_eq!(answer.absences[0].reason, AbsenceReason::OwnerUnreadable);
        assert_eq!(
            answer.absences[0].source_ref.as_deref(),
            Some("project:other"),
            "the absence names the source that failed"
        );
        assert!(answer.absences[0].owner_words.contains("signal_ref"));
    }

    #[test]
    fn merging_factory_moments_keeps_one_identical_moment_and_refuses_a_disputed_position() {
        let moment = |position: &str, summary: &str| TemporalEvent {
            stream: FACTORY_STREAM.into(),
            kind: EventKind::Run,
            thought_type: None,
            subject_ref: "run:A".into(),
            civil_instant: None,
            instant_unix_ms: None,
            day_ref: None,
            stream_position: position.into(),
            evidence_refs: Vec::new(),
            summary: summary.into(),
        };
        let (events, absences) = merge_factory_moments(vec![
            (
                "project:a".into(),
                vec![
                    moment("project:a#signal:S1", "same"),
                    moment("project:a#signal:S2", "left"),
                ],
            ),
            (
                "project:a".into(),
                vec![moment("project:a#signal:S1", "same")],
            ),
            (
                "project:a".into(),
                vec![moment("project:a#signal:S2", "right")],
            ),
        ]);
        assert_eq!(events.len(), 1, "{events:?}");
        assert_eq!(events[0].stream_position, "project:a#signal:S1");
        assert_eq!(
            absences,
            vec![StreamAbsence {
                stream: FACTORY_STREAM.into(),
                reason: AbsenceReason::Refused,
                owner_words: "the owner's two readings disagree on project:a#signal:S2".into(),
                source_ref: Some("project:a".into()),
            }]
        );
    }

    #[test]
    fn a_factory_window_at_the_london_day_edges_names_the_london_civil_days_not_utc() {
        let field = CivilField::new(
            "Europe/London".into(),
            0,
            "control:root".into(),
            "rev-1".into(),
        )
        .unwrap();
        // October 2026 is British Summer Time (UTC+1): 23:30 local on the 14th is 22:30Z,
        // and 00:30 local on the 15th is 23:30Z on the 14th. A UTC reader would name the 14th there.
        let between = |from: &str, to: &str| Window::Between {
            from_unix_ms: from.parse::<jiff::Timestamp>().unwrap().as_millisecond(),
            to_unix_ms: to.parse::<jiff::Timestamp>().unwrap().as_millisecond(),
        };
        let one = |day: &str| Some(FactoryDays::One(day.into()));
        assert_eq!(
            factory_days_for(
                &between("2026-10-14T22:30:00Z", "2026-10-14T22:45:00Z"),
                &field
            )
            .unwrap(),
            one("2026-10-14"),
            "23:30 to 23:45 local is the 14th"
        );
        assert_eq!(
            factory_days_for(
                &between("2026-10-14T23:30:00Z", "2026-10-15T00:00:00Z"),
                &field
            )
            .unwrap(),
            one("2026-10-15"),
            "00:30 to 01:00 local is the 15th"
        );
        assert_eq!(
            factory_days_for(
                &between("2026-10-14T22:30:00Z", "2026-10-14T23:00:00Z"),
                &field
            )
            .unwrap(),
            one("2026-10-14"),
            "23:30 to local midnight, the half-open end excluded, is the 14th"
        );
        assert_eq!(
            factory_days_for(
                &between("2026-10-14T22:30:00Z", "2026-10-14T23:30:00Z"),
                &field
            )
            .unwrap(),
            Some(FactoryDays::Range {
                from: "2026-10-14".into(),
                through: "2026-10-15".into(),
            }),
            "23:30 on the 14th to 00:30 on the 15th names both local days"
        );
    }

    #[test]
    fn a_factory_answer_later_than_the_field_bound_is_a_named_timeout() {
        // The field's own wait: an answer that arrives is read as it stands.
        let (sender, receiver) = std::sync::mpsc::channel();
        sender
            .send(FactoryReading {
                events: Vec::new(),
                absences: Vec::new(),
            })
            .unwrap();
        let answered = awaited_factory(receiver.recv_timeout(FACTORY_READ_BOUND));
        assert!(answered.absences.is_empty());

        // No answer inside the bound: a named owner timeout, in the field's words.
        let (_held, silent) = std::sync::mpsc::channel::<FactoryReading>();
        let late = awaited_factory(silent.recv_timeout(std::time::Duration::from_millis(1)));
        let absence = late
            .absences
            .into_iter()
            .next()
            .expect("a late answer is named");
        assert_eq!(absence.stream, FACTORY_STREAM);
        assert_eq!(absence.reason, AbsenceReason::OwnerTimeout);
        assert!(absence.owner_words.contains("did not answer within 30 s"));

        // A reader that ended without an answer is unreadable, not a timeout.
        let (dropped, ended) = std::sync::mpsc::channel::<FactoryReading>();
        drop(dropped);
        let lost = awaited_factory(ended.recv_timeout(std::time::Duration::from_millis(1)));
        assert_eq!(
            lost.absences.first().map(|absence| absence.reason),
            Some(AbsenceReason::OwnerUnreadable)
        );
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

    fn instant(text: &str) -> i64 {
        text.parse::<jiff::Timestamp>().unwrap().as_millisecond()
    }

    #[test]
    fn a_factory_window_names_the_civil_days_its_span_touches() {
        let field = field();
        assert_eq!(factory_days_for(&Window::All, &field).unwrap(), None);
        assert_eq!(
            factory_days_for(
                &Window::Day {
                    day_ref: "central:day:control:root:2026-10-08".into(),
                },
                &field
            )
            .unwrap(),
            Some(FactoryDays::One("2026-10-08".into()))
        );
        assert_eq!(
            factory_days_for(
                &Window::Day {
                    day_ref: "central:day:control:root:tomorrow".into(),
                },
                &field
            )
            .unwrap(),
            None,
            "a day ref that names no civil date names no Factory day"
        );
        let between = |from: &str, to: &str| Window::Between {
            from_unix_ms: instant(from),
            to_unix_ms: instant(to),
        };
        assert_eq!(
            factory_days_for(
                &between("2026-10-08T08:00:00Z", "2026-10-08T20:00:00Z"),
                &field
            )
            .unwrap(),
            Some(FactoryDays::One("2026-10-08".into()))
        );
        assert_eq!(
            factory_days_for(
                &between("2026-10-08T05:00:00Z", "2026-10-09T05:00:00Z"),
                &field
            )
            .unwrap(),
            Some(FactoryDays::Range {
                from: "2026-10-08".into(),
                through: "2026-10-09".into(),
            })
        );
        assert_eq!(
            factory_days_for(
                &between("2026-10-08T05:00:00Z", "2026-10-08T05:00:00Z"),
                &field
            )
            .unwrap(),
            None,
            "an empty span names no day"
        );
    }

    #[test]
    fn a_factory_span_follows_the_civil_day_boundary_not_utc() {
        // Day boundary at 06:00 local: 04:59Z (05:59 BST) is still the 7th.
        let field = crate::temporal_events::CivilField::new(
            "Europe/London".into(),
            360,
            "control:root".into(),
            "rev".into(),
        )
        .unwrap();
        assert_eq!(
            factory_days_for(
                &Window::Between {
                    from_unix_ms: instant("2026-10-08T04:59:00Z"),
                    to_unix_ms: instant("2026-10-08T05:01:00Z"),
                },
                &field
            )
            .unwrap(),
            Some(FactoryDays::Range {
                from: "2026-10-07".into(),
                through: "2026-10-08".into(),
            })
        );
    }

    #[test]
    fn a_factory_day_reading_yields_one_moment_per_run_bearing_signal() {
        let reading: Value = serde_json::from_str(
            r#"{"schema":"factory.telemetry-day/v1","signals":[
                {"signal_ref":"signal:S1","summary":"run A","source_refs":[],"run_ref":"run:A","updated_at_unix_ms":1791460592000},
                {"signal_ref":"signal:S2","summary":"no run","source_refs":[],"run_ref":null,"updated_at_unix_ms":1791460600000},
                {"signal_ref":"signal:S3","summary":"run B","source_refs":[],"run_ref":"run:B"}
            ]}"#,
        )
        .unwrap();
        let events = telemetry_day_to_events("project:fixture", &reading).unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].subject_ref, "run:A");
        assert_eq!(
            events[0].civil_instant.as_deref(),
            Some("2026-10-08T11:56:32Z")
        );
        assert_eq!(events[1].subject_ref, "run:B");
        assert_eq!(
            events[1].civil_instant, None,
            "no stated instant, none invented"
        );
        assert!(events.iter().all(|event| event.stream == FACTORY_STREAM));

        let twice: Value = serde_json::from_str(
            r#"{"signals":[
                {"signal_ref":"signal:S1","run_ref":"run:A"},
                {"signal_ref":"signal:S1","run_ref":"run:A"}
            ]}"#,
        )
        .unwrap();
        assert!(matches!(
            telemetry_day_to_events("project:fixture", &twice),
            Err(TemporalEventsError::InvalidRecord { .. })
        ));
        assert!(telemetry_day_to_events("project:fixture", &json!({})).is_err());
    }
}
