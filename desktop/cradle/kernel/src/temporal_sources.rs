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
//!
//! Owner readings follow the house law (`history.rs`, `central.rs`): an
//! envelope flagged `automatic_agent_or_model_invocation` is refused, never
//! degraded into a reading. A source's own time is inherited verbatim where
//! the source records one (`created_at`, the fixture's `utc`, an aikit
//! evidence `occurred_at`, a kernel `observed_at`, a Factory signal's
//! `updated_at_unix_ms`) and left absent where it does not — the field never
//! receives an invented time.
//!
//! Not joined: a Central day-open moment. The Day reading
//! (`central.day-reading/v1`) states a civil date and a document state but
//! no opened-at instant, so no moment is emitted for it (never a midnight).

use crate::events::KernelEventLog;
use crate::factory::OwnerRequest;
use crate::flow::{CentralClient, OwnerCallError};
use crate::temporal_events::{
    AbsenceReason, CivilField, EventKind, StreamAbsence, TemporalEvent, TemporalEventsAnswer,
    TemporalEventsError, TemporalQuery, TemporalStreamSource, Window,
};
use serde_json::{json, Value};
use std::collections::BTreeSet;
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
/// own `updated_at_unix_ms`, inherited verbatim; a signal that states none is
/// instant-less (it never joins a civil window). A reading whose signal names
/// no `signal_ref`, or names one twice, is refused whole by the caller.
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
    pub(crate) absence: Option<StreamAbsence>,
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
/// The silence is named, not swallowed. The stream records one absence only
/// when it contributed no moment: a located, readable Factory source that
/// holds no run in the window is "no moment" and names nothing; an owner
/// that could not be read, or a root that is not a Factory source, names its
/// cause (the first in read order; a failure outranks a root with no Factory
/// state).
pub(crate) fn factory_runs_read(
    client: &CentralClient,
    window: &Window,
    field: &CivilField,
) -> FactoryReading {
    let silent = |reason: AbsenceReason, owner_words: String| FactoryReading {
        events: Vec::new(),
        absence: Some(StreamAbsence {
            stream: FACTORY_STREAM.into(),
            reason,
            owner_words,
        }),
    };
    let days = match factory_days_for(window, field) {
        Ok(Some(days)) => days,
        // No Factory day is named: nothing was asked of the owner, so nothing
        // is absent.
        Ok(None) | Err(_) => {
            return FactoryReading {
                events: Vec::new(),
                absence: None,
            }
        }
    };
    let world = match crate::world::read_world(client) {
        Ok(world) => world,
        Err(words) => return silent(AbsenceReason::OwnerUnreadable, words),
    };
    let located = match crate::factory::owner(
        OwnerRequest::Locate {
            project: None,
            all: true,
        },
        Some(&world),
    ) {
        Ok(located) => located,
        Err(error) => return silent(owner_failure_reason(&error), error.message),
    };

    let mut events = Vec::new();
    // Named causes in read order: failures, then roots with no Factory state.
    let mut failures: Vec<(AbsenceReason, String)> = Vec::new();
    let mut absent_roots: Vec<(AbsenceReason, String)> = Vec::new();
    // Set once any located source answers its day reading, whatever it holds.
    let mut readable = false;
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
                absent_roots.push((AbsenceReason::OwnerAbsent, row_words));
                continue;
            }
            Some("refused") => {
                failures.push((AbsenceReason::Refused, row_words));
                continue;
            }
            _ => {
                failures.push((
                    AbsenceReason::OwnerUnreadable,
                    "the owner's locate row names no known state".into(),
                ));
                continue;
            }
        }
        let (Some(state), Some(source_ref)) = (
            row.pointer("/location/statePath").and_then(Value::as_str),
            row.pointer("/location/projectRef").and_then(Value::as_str),
        ) else {
            failures.push((
                AbsenceReason::OwnerUnreadable,
                "the located answer names no state path".into(),
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
                failures.push((owner_failure_reason(&error), error.message));
                continue;
            }
        };
        match telemetry_day_to_events(source_ref, &reading) {
            Ok(mut moments) => {
                readable = true;
                events.append(&mut moments);
            }
            Err(error) => failures.push((AbsenceReason::OwnerUnreadable, error.to_string())),
        }
    }

    if !events.is_empty() {
        return FactoryReading {
            events,
            absence: None,
        };
    }
    // A readable source with no run in the window is the owner's own "no
    // moment": only a root that is not a Factory source is then no cause.
    let named = if readable {
        failures.into_iter().next()
    } else {
        failures.into_iter().chain(absent_roots).next()
    };
    FactoryReading {
        events,
        absence: named.map(|(reason, owner_words)| StreamAbsence {
            stream: FACTORY_STREAM.into(),
            reason,
            owner_words,
        }),
    }
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
        absence: Some(StreamAbsence {
            stream: FACTORY_STREAM.into(),
            reason,
            owner_words,
        }),
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
///   bounded at [`THOUGHT_WORKERS`]; the Factory run stream follows the
///   civil field (its window needs the policy) and is non-fatal;
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
            // The Factory run stream needs the civil field for its window. It
            // runs detached from the scope, so an owner that stalls past the
            // bound cannot hold the field; its thread ends with its owner call.
            let factory = {
                let window = query.window.clone();
                let field = field.clone();
                let client = owner.clone();
                let (sender, receiver) = std::sync::mpsc::channel();
                std::thread::spawn(move || {
                    let _ = sender.send(factory_runs_read(&client, &window, &field));
                });
                receiver
            };
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
            // Bounded: a Factory answer later than the bound is a named absence
            // for this stream, never a stalled field. The owner bounds its own
            // reads; this wait is the second guard.
            let FactoryReading {
                events: factory_events,
                absence: factory_absence,
            } = awaited_factory(factory.recv_timeout(FACTORY_READ_BOUND));

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
            let mut answer = project(
                &[
                    &now_stream,
                    &thoughts_stream,
                    &wiki_stream,
                    &kernel_stream,
                    &aikit_stream,
                    &factory_stream,
                ],
                &field,
                &observed,
                query,
            )?;
            // Every stream that swallowed its failure names it here; the five
            // others fail the whole reading by name and never reach this list.
            answer.absences = factory_absence.into_iter().collect();
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
                    r#"if [ "$1" = "project" ]; then echo "$*" >> {log}; if [ -s {locate} ]; then cat {locate}; exit 0; fi; echo "No such file or directory" >&2; exit 1; fi"#,
                    log = factory_calls.display(),
                    locate = factory_locate.display()
                );
                let _ = writeln!(
                    body,
                    r#"if [ "$1" = "telemetry" ]; then echo "$*" >> {}; cat {}; exit 0; fi"#,
                    factory_calls.display(),
                    factory_day.display()
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

    #[test]
    fn a_factory_day_reading_joins_its_run_moments_through_the_owner_reads() {
        let _env = owner_env();
        let owner = FakeOwner::new(
            "factory-day",
            r#"{"ok":true,"data":{"records":[]}}"#,
            THOUGHTS_REPLY,
        );
        std::fs::write(owner.directory.join("factory-locate.json"), LOCATED).unwrap();
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
        assert_eq!(
            owner.factory_calls(),
            vec![format!(
                "project locate {} --json",
                owner.directory.display()
            )],
            "an absent source is located once and never read for days"
        );
        // The silence is named, in the owner's own words.
        assert_eq!(
            answer.absences,
            vec![StreamAbsence {
                stream: FACTORY_STREAM.into(),
                reason: AbsenceReason::OwnerAbsent,
                owner_words: "No such file or directory".into(),
            }]
        );
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
            }]
        );
    }

    #[test]
    fn a_factory_day_the_field_cannot_read_names_owner_unreadable() {
        let _env = owner_env();
        let owner = FakeOwner::new("factory-unreadable", &nowlist(&["ref-a"]), THOUGHTS_REPLY);
        std::fs::write(owner.directory.join("factory-locate.json"), LOCATED).unwrap();
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

    #[test]
    fn a_factory_answer_later_than_the_field_bound_is_a_named_timeout() {
        // The field's own wait: an answer that arrives is read as it stands.
        let (sender, receiver) = std::sync::mpsc::channel();
        sender
            .send(FactoryReading {
                events: Vec::new(),
                absence: None,
            })
            .unwrap();
        let answered = awaited_factory(receiver.recv_timeout(FACTORY_READ_BOUND));
        assert!(answered.absence.is_none());

        // No answer inside the bound: a named owner timeout, in the field's words.
        let (_held, silent) = std::sync::mpsc::channel::<FactoryReading>();
        let late = awaited_factory(silent.recv_timeout(std::time::Duration::from_millis(1)));
        let absence = late.absence.expect("a late answer is named");
        assert_eq!(absence.stream, FACTORY_STREAM);
        assert_eq!(absence.reason, AbsenceReason::OwnerTimeout);
        assert!(absence.owner_words.contains("did not answer within 30 s"));

        // A reader that ended without an answer is unreadable, not a timeout.
        let (dropped, ended) = std::sync::mpsc::channel::<FactoryReading>();
        drop(dropped);
        let lost = awaited_factory(ended.recv_timeout(std::time::Duration::from_millis(1)));
        assert_eq!(
            lost.absence.map(|absence| absence.reason),
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
