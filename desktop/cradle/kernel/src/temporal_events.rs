//! Read-only temporal-events projection — one queryable field over the
//! streams that already exist (`oi.temporal-events/v1`).
//!
//! Governing spec: `Control/agents/now/flows/hermes-gateway-re-20261007/
//! specs/TEMPORAL-EVENT-SPEC.md` (slice E1), as amended by the owner
//! correction of 2026-10-08: T's are **thought types** — the NOW thought
//! stream's twelve readings — and there is no T-coordinate system. The
//! timestamp of the day and the ledger are already in the NOW session; this
//! projection inherits time, it does not model it.
//!
//! Laws this read model keeps (the `procedure_history.rs` discipline,
//! read side):
//!
//! - Never a second store. Every event is read from the stream that already
//!   holds it; the projection materialises nothing and writes nothing.
//! - Time is inherited, never invented. An event's [`TemporalEvent::civil_instant`]
//!   is its source's own instant, normalised to RFC 3339 exactly once at the
//!   source seam; the source record itself remains the evidence. A source
//!   that records no instant (kernel variants without `observed_at`) yields
//!   an instant-less event: it is never assigned a fabricated time and never
//!   joins a civil-day answer.
//! - Civil days come from the standing policy, not from this module: the
//!   [`CivilField`] carries the timezone, day boundary and policy revision
//!   read from `central.time.policy` / `central.day.read`, and the derived
//!   [`TemporalEvent::day_ref`] is the same `central:day:<scope>:<date>`
//!   the day machinery registers.
//! - Exactly once. A stream's [`TemporalEvent::stream_position`] is the
//!   event's identity; the projection refuses a duplicate instead of
//!   silently merging or dropping.
//! - Ordering is a projection rule, not an ontology: instanted events order
//!   by (instant, stream, position); instant-less events order after all
//!   instanted events, by (stream, position).
//!
//! The thought stream joins the field as itself: a NOW thought fixture is a
//! [`EventKind::Thought`] event whose [`TemporalEvent::thought_type`] names
//! one of the twelve readings (`T0`–`T5`, `T0-prime`–`T5-prime`), T5
//! (Insight) the learning face of the axis.

use jiff::Span;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fmt;

/// Schema of the unified temporal read model's answer.
pub const TEMPORAL_EVENTS_SCHEMA: &str = "oi.temporal-events/v1";

/// What happened, at the coarseness the streams actually distinguish. The
/// set is the spec's own vocabulary plus the producer kinds the wired
/// streams demanded (`Now` — clearing lifecycle; `Kernel` — kernel state
/// changes; `Knowledge` — knowledge-plane history evidence); a new producer
/// extends this enum rather than minting a parallel field.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum EventKind {
    Run,
    Return,
    Curation,
    Generation,
    GatewayDelta,
    Thought,
    Now,
    Kernel,
    Knowledge,
}

/// One of the twelve working-thought readings of the NOW thought stream.
/// Machine spellings are the ground's own (`T0`–`T5`, `T0-prime`–`T5-prime`).
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum ThoughtType {
    #[serde(rename = "T0")]
    Question,
    #[serde(rename = "T1")]
    Trace,
    #[serde(rename = "T2")]
    Challenge,
    #[serde(rename = "T3")]
    Pattern,
    #[serde(rename = "T4")]
    Discovery,
    #[serde(rename = "T5")]
    Insight,
    #[serde(rename = "T0-prime")]
    Assumption,
    #[serde(rename = "T1-prime")]
    Lacuna,
    #[serde(rename = "T2-prime")]
    Affordance,
    #[serde(rename = "T3-prime")]
    Anomaly,
    #[serde(rename = "T4-prime")]
    Concealment,
    #[serde(rename = "T5-prime")]
    Integration,
}

impl ThoughtType {
    /// The ground's machine spelling for the reading.
    pub fn machine_spelling(&self) -> &'static str {
        match self {
            ThoughtType::Question => "T0",
            ThoughtType::Trace => "T1",
            ThoughtType::Challenge => "T2",
            ThoughtType::Pattern => "T3",
            ThoughtType::Discovery => "T4",
            ThoughtType::Insight => "T5",
            ThoughtType::Assumption => "T0-prime",
            ThoughtType::Lacuna => "T1-prime",
            ThoughtType::Affordance => "T2-prime",
            ThoughtType::Anomaly => "T3-prime",
            ThoughtType::Concealment => "T4-prime",
            ThoughtType::Integration => "T5-prime",
        }
    }

    /// The reading in the plain language the ta-onta return gives it.
    pub fn reading(&self) -> &'static str {
        match self {
            ThoughtType::Question => "Question",
            ThoughtType::Trace => "Trace",
            ThoughtType::Challenge => "Challenge",
            ThoughtType::Pattern => "Pattern",
            ThoughtType::Discovery => "Discovery",
            ThoughtType::Insight => "Insight",
            ThoughtType::Assumption => "Assumption",
            ThoughtType::Lacuna => "Lacuna",
            ThoughtType::Affordance => "Affordance",
            ThoughtType::Anomaly => "Anomaly",
            ThoughtType::Concealment => "Concealment",
            ThoughtType::Integration => "Integration",
        }
    }
}

/// One temporal event as inherited from one existing stream.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct TemporalEvent {
    /// The stream that already holds this record (its identity in the field).
    pub stream: String,
    pub kind: EventKind,
    /// The thought reading the source names, when the source is a thought
    /// fixture. Absent for every other stream.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thought_type: Option<ThoughtType>,
    /// What the event is about, as a ref the source itself carries.
    pub subject_ref: String,
    /// The event's instant in RFC 3339 — the source's own time, normalised
    /// once at the source seam (a unix-seconds record is converted there, and
    /// the source record stays in the evidence). Never invented: absent when
    /// the source records no instant.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub civil_instant: Option<String>,
    /// Parsed from `civil_instant` when it parses; the projection's
    /// millisecond normal form for ordering and windows.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instant_unix_ms: Option<i64>,
    /// The civil day the instant falls on under the field's policy — the same
    /// `central:day:<scope>:<date>` the day machinery registers. Derived only
    /// from a parsed instant; never present without one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub day_ref: Option<String>,
    /// The event's anchor within its own stream (seq, cursor, path, index).
    /// Unique per stream; the exactly-once identity.
    pub stream_position: String,
    /// Refs that let a reader return to the source record itself.
    #[serde(default)]
    pub evidence_refs: Vec<String>,
    pub summary: String,
}

impl TemporalEvent {
    /// The event's ordering key. Instanted events sort before instant-less
    /// ones; the tie-breakers are stream name then within-stream position.
    fn order_key(&self) -> (u8, i64, &str, &str) {
        match self.instant_unix_ms {
            Some(instant) => (0, instant, self.stream.as_str(), self.stream_position.as_str()),
            None => (1, 0, self.stream.as_str(), self.stream_position.as_str()),
        }
    }
}

/// The standing civil-time field, inherited from the day machinery — the
/// projection reads it, never re-derives it. Built from `central.time.policy`
/// and the day reading (`central.civil-time-policy/v1`).
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct CivilField {
    /// IANA timezone of the civil days (e.g. `Europe/London`).
    pub timezone: String,
    /// Minutes after local midnight at which a civil day begins (0 = 00:00).
    pub day_boundary_minutes: i64,
    /// The day registry's scope (e.g. `control:root`), as the policy states it.
    pub day_scope: String,
    /// The policy revision in force, carried verbatim and echoed in answers.
    pub policy_revision: String,
}

impl CivilField {
    pub fn new(
        timezone: String,
        day_boundary_minutes: i64,
        day_scope: String,
        policy_revision: String,
    ) -> Result<Self, TemporalEventsError> {
        if !(0..24 * 60).contains(&day_boundary_minutes) {
            return Err(TemporalEventsError::CivilTime {
                reason: format!(
                    "day boundary must be within one civil day, got {day_boundary_minutes} minutes"
                ),
            });
        }
        Ok(Self {
            timezone,
            day_boundary_minutes,
            day_scope,
            policy_revision,
        })
    }

    /// The civil day an instant belongs to, under the policy.
    pub fn day_ref_for(&self, instant: &str) -> Result<String, TemporalEventsError> {
        let parsed = instant
            .parse::<jiff::Timestamp>()
            .map_err(|error| TemporalEventsError::CivilTime {
                reason: format!("`{instant}` is not an RFC 3339 instant: {error}"),
            })?;
        let local = parsed
            .in_tz(&self.timezone)
            .map_err(|error| TemporalEventsError::CivilTime {
                reason: format!("unknown timezone `{}`: {error}", self.timezone),
            })?
            .datetime();
        let day_start_side = local
            .checked_sub(Span::new().minutes(self.day_boundary_minutes))
            .map_err(|error| TemporalEventsError::CivilTime {
                reason: format!("civil-day arithmetic failed for `{instant}`: {error}"),
            })?;
        Ok(format!(
            "central:day:{}:{}",
            self.day_scope,
            day_start_side.date()
        ))
    }
}

/// Where in the field the question looks. A [`Window::Day`] answer contains
/// exactly the events whose derived day ref equals the queried one — the
/// civil boundary is honored because the day ref was derived through the
/// policy, not by string-prefixing a UTC date.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "window", rename_all = "kebab-case")]
pub enum Window {
    #[default]
    All,
    /// One registered civil day, by its day ref.
    Day { day_ref: String },
    /// Instants in `[from, to)`; instant-less events have no civil position
    /// and are never answered by a civil window.
    Between {
        from_unix_ms: i64,
        to_unix_ms: i64,
    },
}

/// The one question the field answers, with its optional axes.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
pub struct TemporalQuery {
    pub window: Window,
    pub kind: Option<EventKind>,
    pub thought_type: Option<ThoughtType>,
    pub stream: Option<String>,
    /// "What happened to this run/return/…": the event's subject, or any
    /// evidence ref it carries, equals this ref.
    pub subject: Option<String>,
}

/// A stream the projection reads from where the stream already lives.
/// Read-only by law: an implementation that writes anything is outside this
/// trait, whatever its signature.
pub trait TemporalStreamSource {
    fn stream_name(&self) -> &str;
    fn events(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError>;
}

/// The versioned answer: ordered, evidence-ref'd, and honest about the field
/// it was read under.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct TemporalEventsAnswer {
    pub schema: String,
    pub window: Window,
    /// When the reading was taken — the caller's own instant, verbatim.
    pub observed_civil_instant: String,
    /// The civil field the reading stands under (echoed, not re-derived).
    pub field: CivilField,
    pub events: Vec<TemporalEvent>,
}

/// Why a projection refused.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TemporalEventsError {
    /// A stream handed over a record that violates the field's own identity
    /// rules (wrong stream name on the record, unparsable instant).
    InvalidRecord {
        stream: String,
        position: String,
        reason: String,
    },
    /// Two records claimed one stream position; the exactly-once law refuses
    /// rather than merges.
    DuplicatePosition { stream: String, position: String },
    /// The standing civil field could not answer (bad policy, unknown zone).
    CivilTime { reason: String },
    /// A stream's own reading failed before any record was mapped (its
    /// owner operation was unavailable or refused).
    SourceUnavailable { stream: String, detail: String },
}

impl fmt::Display for TemporalEventsError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TemporalEventsError::InvalidRecord {
                stream,
                position,
                reason,
            } => write!(
                formatter,
                "invalid temporal record in stream `{}` at `{}`: {reason}",
                stream, position
            ),
            TemporalEventsError::DuplicatePosition { stream, position } => write!(
                formatter,
                "stream `{}` claimed position `{}` twice; the field answers each event exactly once",
                stream, position
            ),
            TemporalEventsError::CivilTime { reason } => {
                write!(formatter, "civil time refused: {reason}")
            }
            TemporalEventsError::SourceUnavailable { stream, detail } => {
                write!(formatter, "stream `{}` is unreadable: {detail}", stream)
            }
        }
    }
}

impl std::error::Error for TemporalEventsError {}

/// Project the field: read every attached stream, inherit each event's time,
/// refuse duplicates, answer the query ordered with evidence refs.
pub fn project(
    sources: &[&dyn TemporalStreamSource],
    field: &CivilField,
    observed_civil_instant: &str,
    query: &TemporalQuery,
) -> Result<TemporalEventsAnswer, TemporalEventsError> {
    let mut seen = BTreeSet::new();
    let mut events = Vec::new();
    for source in sources {
        for mut event in source.events()? {
            // The record must confess the stream it came from — the same
            // identity check a procedure history runs against its directory.
            if event.stream != source.stream_name() {
                return Err(TemporalEventsError::InvalidRecord {
                    stream: event.stream.clone(),
                    position: event.stream_position.clone(),
                    reason: format!(
                        "record names stream `{}` but was read from `{}`",
                        event.stream,
                        source.stream_name()
                    ),
                });
            }
            if let Some(instant) = &event.civil_instant {
                let parsed = instant
                    .parse::<jiff::Timestamp>()
                    .map_err(|error| TemporalEventsError::InvalidRecord {
                        stream: event.stream.clone(),
                        position: event.stream_position.clone(),
                        reason: format!("`{instant}` is not an RFC 3339 instant: {error}"),
                    })?;
                event.instant_unix_ms = Some(parsed.as_millisecond());
                event.day_ref = Some(field.day_ref_for(instant)?);
            }
            let identity = (event.stream.clone(), event.stream_position.clone());
            if !seen.insert(identity) {
                return Err(TemporalEventsError::DuplicatePosition {
                    stream: event.stream.clone(),
                    position: event.stream_position.clone(),
                });
            }
            events.push(event);
        }
    }

    let wanted: Vec<TemporalEvent> = events
        .into_iter()
        .filter(|event| query.matches(event))
        .collect();

    let mut ordered = wanted;
    ordered.sort_by(|left, right| left.order_key().cmp(&right.order_key()));

    Ok(TemporalEventsAnswer {
        schema: TEMPORAL_EVENTS_SCHEMA.into(),
        window: query.window.clone(),
        observed_civil_instant: observed_civil_instant.into(),
        field: field.clone(),
        events: ordered,
    })
}

impl TemporalQuery {
    fn matches(&self, event: &TemporalEvent) -> bool {
        let window = match &self.window {
            Window::All => true,
            Window::Day { day_ref } => event.day_ref.as_deref() == Some(day_ref.as_str()),
            Window::Between {
                from_unix_ms,
                to_unix_ms,
            } => match event.instant_unix_ms {
                Some(instant) => instant >= *from_unix_ms && instant < *to_unix_ms,
                None => false,
            },
        };
        let kind = self.kind.is_none_or(|wanted| wanted == event.kind);
        let thought = self
            .thought_type
            .is_none_or(|wanted| event.thought_type == Some(wanted));
        let stream = self
            .stream
            .as_deref()
            .is_none_or(|wanted| wanted == event.stream);
        let subject = self.subject.as_deref().is_none_or(|wanted| {
            event.subject_ref == wanted || event.evidence_refs.iter().any(|ref_| ref_ == wanted)
        });
        window && kind && thought && stream && subject
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn field() -> CivilField {
        CivilField::new(
            "Europe/London".into(),
            0,
            "control:root".into(),
            "central.content-fnv1a64/v1:741:69da4a44ad65b27f".into(),
        )
        .unwrap()
    }

    /// A fixture stream: the stand-in for every real adapter (E2 wires the
    /// live ones; the law the fixtures obey is the law they must).
    struct Fixture {
        name: String,
        events: Vec<TemporalEvent>,
    }

    impl Fixture {
        fn new(name: &str, events: Vec<TemporalEvent>) -> Self {
            Self {
                name: name.into(),
                events,
            }
        }
    }

    impl TemporalStreamSource for Fixture {
        fn stream_name(&self) -> &str {
            &self.name
        }
        fn events(&self) -> Result<Vec<TemporalEvent>, TemporalEventsError> {
            Ok(self.events.clone())
        }
    }

    fn event(
        stream: &str,
        kind: EventKind,
        position: &str,
        instant: Option<&str>,
        summary: &str,
    ) -> TemporalEvent {
        TemporalEvent {
            stream: stream.into(),
            kind,
            thought_type: None,
            subject_ref: format!("{stream}:{position}"),
            civil_instant: instant.map(str::to_string),
            instant_unix_ms: None,
            day_ref: None,
            stream_position: position.into(),
            evidence_refs: vec![format!("fixture:{stream}/{position}")],
            summary: summary.into(),
        }
    }

    fn thought(stream: &str, position: &str, instant: &str, reading: ThoughtType) -> TemporalEvent {
        let mut event = event(stream, EventKind::Thought, position, Some(instant), "a fixture thought");
        event.thought_type = Some(reading);
        event
    }

    #[test]
    fn every_constituent_event_appears_exactly_once_ordered_with_its_evidence() {
        // Handed over shuffled; the field answers ordered.
        let fixture = Fixture::new(
            "usage-events",
            vec![
                event("usage-events", EventKind::Run, "seq-3", Some("2026-10-08T12:56:32+01:00"), "third"),
                event("usage-events", EventKind::Run, "seq-1", Some("2026-10-08T09:00:00+01:00"), "first"),
                event("usage-events", EventKind::Run, "seq-2", Some("2026-10-08T10:30:00+01:00"), "second"),
            ],
        );
        let answer = project(
            &[&fixture],
            &field(),
            "2026-10-08T13:00:00+01:00",
            &TemporalQuery {
                window: Window::All,
                ..TemporalQuery::default()
            },
        )
        .unwrap();

        assert_eq!(answer.schema, "oi.temporal-events/v1");
        let summaries: Vec<&str> = answer.events.iter().map(|e| e.summary.as_str()).collect();
        assert_eq!(summaries, vec!["first", "second", "third"]);
        for (index, item) in answer.events.iter().enumerate() {
            assert_eq!(
                item.evidence_refs,
                vec![format!("fixture:usage-events/seq-{}", index + 1)]
            );
        }
        // Every constituent exactly once.
        assert_eq!(answer.events.len(), 3);
    }

    #[test]
    fn a_duplicated_stream_position_is_refused_not_merged() {
        let first = Fixture::new(
            "now-clearing",
            vec![event("now-clearing", EventKind::Return, "returns[1]", Some("2026-10-08T09:00:00+01:00"), "one")],
        );
        let second = Fixture::new(
            "now-clearing",
            vec![event("now-clearing", EventKind::Return, "returns[1]", Some("2026-10-08T10:00:00+01:00"), "two")],
        );
        let error = project(
            &[&first, &second],
            &field(),
            "2026-10-08T13:00:00+01:00",
            &TemporalQuery {
                window: Window::All,
                ..TemporalQuery::default()
            },
        )
        .unwrap_err();
        assert_eq!(
            error,
            TemporalEventsError::DuplicatePosition {
                stream: "now-clearing".into(),
                position: "returns[1]".into(),
            }
        );
    }

    #[test]
    fn a_day_query_returns_exactly_that_civil_day() {
        // 2026-10-07/08 are British Summer Time (UTC+1): 23:00Z on the 7th is
        // already 00:00 on the 8th civilly, and 23:30Z on the 8th is already
        // the 9th. The boundary is the policy's, honored to the minute.
        let seventh_late_utc = Fixture::new(
            "generation-history",
            vec![event(
                "generation-history",
                EventKind::Generation,
                "gen-1",
                Some("2026-10-07T23:00:00Z"),
                "midnight-boundary",
            )],
        );
        let eighth = Fixture::new(
            "usage-events",
            vec![event(
                "usage-events",
                EventKind::Run,
                "seq-1",
                Some("2026-10-08T12:56:32+01:00"),
                "midday",
            )],
        );
        let eighth_late_utc = Fixture::new(
            "wiki-returns",
            vec![event(
                "wiki-returns",
                EventKind::Return,
                "returns/ta-onta",
                Some("2026-10-08T23:30:00Z"),
                "next-day-already",
            )],
        );

        let answer = project(
            &[&seventh_late_utc, &eighth, &eighth_late_utc],
            &field(),
            "2026-10-09T09:00:00+01:00",
            &TemporalQuery {
                window: Window::Day {
                    day_ref: "central:day:control:root:2026-10-08".into(),
                },
                ..TemporalQuery::default()
            },
        )
        .unwrap();

        let summaries: Vec<&str> = answer.events.iter().map(|e| e.summary.as_str()).collect();
        assert_eq!(summaries, vec!["midnight-boundary", "midday"]);
        assert!(answer.events.iter().all(|e| e.day_ref.as_deref() == Some("central:day:control:root:2026-10-08")));
    }

    #[test]
    fn an_event_without_a_recorded_instant_never_receives_one() {
        // Kernel variants without `observed_at`: position, not time.
        let kernel = Fixture::new(
            "kernel-event-log",
            vec![
                event("kernel-event-log", EventKind::Run, "gen-a/seq-1", None, "state change, no instant"),
                event("kernel-event-log", EventKind::Run, "gen-a/seq-2", None, "later state change, still no instant"),
            ],
        );
        let timed = Fixture::new(
            "usage-events",
            vec![event(
                "usage-events",
                EventKind::Run,
                "seq-1",
                Some("2026-10-08T09:00:00+01:00"),
                "timed",
            )],
        );

        // A civil-day answer does not claim them.
        let day = project(
            &[&kernel, &timed],
            &field(),
            "2026-10-08T13:00:00+01:00",
            &TemporalQuery {
                window: Window::Day {
                    day_ref: "central:day:control:root:2026-10-08".into(),
                },
                ..TemporalQuery::default()
            },
        )
        .unwrap();
        assert_eq!(day.events.len(), 1);
        assert_eq!(day.events[0].summary, "timed");

        // The whole field still discloses them, after the instanted events,
        // in stream-position order, with no invented time.
        let all = project(
            &[&kernel, &timed],
            &field(),
            "2026-10-08T13:00:00+01:00",
            &TemporalQuery {
                window: Window::All,
                ..TemporalQuery::default()
            },
        )
        .unwrap();
        let summaries: Vec<&str> = all.events.iter().map(|e| e.summary.as_str()).collect();
        assert_eq!(
            summaries,
            vec!["timed", "state change, no instant", "later state change, still no instant"]
        );
        for event in &all.events {
            if event.stream == "kernel-event-log" {
                assert!(event.civil_instant.is_none());
                assert!(event.instant_unix_ms.is_none());
                assert!(event.day_ref.is_none());
            }
        }
    }

    #[test]
    fn the_thought_stream_joins_the_field_under_its_twelve_readings() {
        let thoughts = Fixture::new(
            "now-thought-stream",
            vec![
                thought(
                    "now-thought-stream",
                    "T/insight-fixture",
                    "2026-10-08T08:15:00+01:00",
                    ThoughtType::Insight,
                ),
                thought(
                    "now-thought-stream",
                    "T-prime/lacuna-fixture",
                    "2026-10-08T08:45:00+01:00",
                    ThoughtType::Lacuna,
                ),
            ],
        );

        // T5 — Insight — is the learning face the owner named.
        let insights = project(
            &[&thoughts],
            &field(),
            "2026-10-08T13:00:00+01:00",
            &TemporalQuery {
                window: Window::All,
                thought_type: Some(ThoughtType::Insight),
                ..TemporalQuery::default()
            },
        )
        .unwrap();
        assert_eq!(insights.events.len(), 1);
        assert_eq!(insights.events[0].thought_type, Some(ThoughtType::Insight));
        assert_eq!(insights.events[0].kind, EventKind::Thought);

        // The machine spellings are the ground's own.
        assert_eq!(
            serde_json::to_value(ThoughtType::Insight).unwrap(),
            serde_json::json!("T5")
        );
        assert_eq!(
            serde_json::to_value(ThoughtType::Lacuna).unwrap(),
            serde_json::json!("T1-prime")
        );
    }

    #[test]
    fn a_run_is_answered_by_its_subject_ref() {
        let runs = Fixture::new(
            "usage-events",
            vec![
                event("usage-events", EventKind::Run, "seq-1", Some("2026-10-08T09:00:00+01:00"), "the run asked about"),
                event("usage-events", EventKind::Run, "seq-2", Some("2026-10-08T09:05:00+01:00"), "another run"),
            ],
        );
        let answer = project(
            &[&runs],
            &field(),
            "2026-10-08T13:00:00+01:00",
            &TemporalQuery {
                window: Window::All,
                subject: Some("usage-events:seq-1".into()),
                ..TemporalQuery::default()
            },
        )
        .unwrap();
        assert_eq!(answer.events.len(), 1);
        assert_eq!(answer.events[0].summary, "the run asked about");
    }

    #[test]
    fn an_unparsable_instant_is_refused_not_silently_dropped() {
        let broken = Fixture::new(
            "usage-events",
            vec![event("usage-events", EventKind::Run, "seq-1", Some("the day before yesterday"), "nonsense")],
        );
        let error = project(
            &[&broken],
            &field(),
            "2026-10-08T13:00:00+01:00",
            &TemporalQuery {
                window: Window::All,
                ..TemporalQuery::default()
            },
        )
        .unwrap_err();
        assert!(matches!(error, TemporalEventsError::InvalidRecord { .. }));
    }
}
