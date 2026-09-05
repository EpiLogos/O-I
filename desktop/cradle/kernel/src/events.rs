//! Typed kernel events and the ordered event seam — ported KEEP-RE-EARN
//! from `desktop/core/src/events.rs` (02 §5) into the cradle kernel.
//!
//! The loop the cradle lives by, unchanged: *native operation returns →
//! kernel state changes → typed events → the React projection re-renders
//! reality.* Push, not poll.
//!
//! Laws this seam keeps (same as the ported source):
//!
//! - Events are kernel→renderer disclosure. They add no renderer capability
//!   and touch no bridge authority (02 §12).
//! - Events are honest: an operation emits only after its kernel state
//!   actually changed. Kernel operations return the events they produced,
//!   and return none when nothing changed — so one state change is emitted
//!   exactly once.
//! - Every event names exact refs, so an agent and a human read the same
//!   actuality from it (04 §4 agent-native parity).
//!
//! The variant set here is the vocabulary U0.4 has producers for (map §5
//! U0.4: focus change, surface open/close, source open, buffer dirty, save
//! success, save conflict). The remaining 02 §5 vocabulary re-lands with
//! its verticals, exactly as the ported seam provided.

use crate::focus::{FocusRefError, GlobalFocus};
use crate::refs::SemanticRef;
use serde::{Deserialize, Serialize};

/// Schema of the event envelope the desktop host forwards to the renderer.
pub const KERNEL_EVENT_SCHEMA: &str = "oi.kernel-event/v1";

/// Version of the event contract. Bump when a payload's meaning changes,
/// never by adding a new variant.
pub const KERNEL_EVENT_VERSION: u32 = 1;

/// Topic the desktop host forwards kernel events on. The renderer
/// subscribes once to this topic and dispatches typed events to consumers.
/// One-way kernel→renderer disclosure: nothing is published back on it, and
/// kernel truth is pulled through the read models — events only trigger the
/// re-render.
pub const KERNEL_EVENT_TOPIC: &str = "oi:kernel-event";

/// One typed kernel event (02 §5), for a state change U0.4's kernel
/// actually produces. Each variant names the exact refs that changed; the
/// changed reading itself is pulled through its own read model, so an event
/// is a disclosure trigger, never a second source of truth.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum KernelEvent {
    /// The one global focus relation moved (02 §7, 03 §B).
    FocusChanged {
        focus: GlobalFocus,
    },
    /// A surface binding of the frame opened or closed. Surfaces are S's own
    /// application mechanic (law 12, D16) — presentation state, disclosed as
    /// such; the semantic ref rides along verbatim when the binding has one.
    SurfaceChanged {
        surface_id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        surface_ref: Option<SemanticRef>,
        summary: String,
    },
    /// A source was opened (or re-read) into the cradle's buffer layer from
    /// its owner's canonical reading.
    SourceOpened {
        source: SemanticRef,
        revision: String,
        summary: String,
    },
    /// The cradle-held buffer for a source crossed the clean/dirty line.
    /// Emitted exactly once per crossing — continued typing is not a state
    /// change and emits nothing.
    BufferDirty {
        source: SemanticRef,
        dirty: bool,
        summary: String,
    },
    /// A save through the owner's compare-and-swap recorded a change: the
    /// canonical revision advanced and the buffer synced clean to it.
    SourceChanged {
        source: SemanticRef,
        revision: String,
        summary: String,
    },
    /// A save was refused by the owner's compare-and-swap: the revision
    /// moved underneath the buffer. Both sides are preserved — the cradle's
    /// dirty buffer intact, the canonical content re-readable — and neither
    /// is overwritten silently.
    SourceWriteConflict {
        source: SemanticRef,
        expected_revision: String,
        current_revision: String,
        summary: String,
    },
}

impl KernelEvent {
    /// The exact subject the event is about, for consumers that route by
    /// subject without matching every variant.
    pub fn subject(&self) -> Option<&SemanticRef> {
        match self {
            Self::FocusChanged { focus } => focus.subject_ref(),
            Self::SurfaceChanged { surface_ref, .. } => surface_ref.as_ref(),
            Self::SourceOpened { source, .. }
            | Self::BufferDirty { source, .. }
            | Self::SourceChanged { source, .. }
            | Self::SourceWriteConflict { source, .. } => Some(source),
        }
    }

    /// The event tag exactly as it is tagged on the wire.
    pub fn tag(&self) -> &'static str {
        match self {
            Self::FocusChanged { .. } => "focus_changed",
            Self::SurfaceChanged { .. } => "surface_changed",
            Self::SourceOpened { .. } => "source_opened",
            Self::BufferDirty { .. } => "buffer_dirty",
            Self::SourceChanged { .. } => "source_changed",
            Self::SourceWriteConflict { .. } => "source_write_conflict",
        }
    }

    /// Per-variant payload validation at the kernel's parse boundary (02
    /// §4) — ported law: deserialization alone would accept an event that
    /// names a degenerate ref; an event this kernel could not have produced
    /// is refused here.
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Self::FocusChanged { focus } => {
                let relation = |name: &str| format!("FocusChanged.focus.{name}");
                if let Some(world) = focus.world.as_ref() {
                    whole_ref(&relation("world"), world.semantic_ref())?;
                }
                if let Some(project) = focus.project.as_ref() {
                    whole_ref(&relation("project"), project.semantic_ref())?;
                }
                if let Some(subject) = focus.subject.as_ref() {
                    whole_ref(&relation("subject"), subject.semantic_ref())?;
                }
                if let Some(journey) = focus.journey.as_ref() {
                    whole_ref(&relation("journey"), journey.semantic_ref())?;
                }
                if let Some(encounter) = focus.agency_encounter.as_ref() {
                    whole_ref(&relation("agency_encounter"), encounter.semantic_ref())?;
                }
                Ok(())
            }
            Self::SurfaceChanged {
                surface_id,
                surface_ref,
                summary,
            } => {
                non_empty("SurfaceChanged.surface_id", surface_id)?;
                if let Some(reference) = surface_ref.as_ref() {
                    whole_ref("SurfaceChanged.surface_ref", reference)?;
                }
                non_empty("SurfaceChanged.summary", summary)
            }
            Self::SourceOpened {
                source,
                revision,
                summary,
            } => {
                whole_ref("SourceOpened.source", source)?;
                non_empty("SourceOpened.revision", revision)?;
                non_empty("SourceOpened.summary", summary)
            }
            Self::BufferDirty {
                source,
                summary,
                ..
            } => {
                whole_ref("BufferDirty.source", source)?;
                non_empty("BufferDirty.summary", summary)
            }
            Self::SourceChanged {
                source,
                revision,
                summary,
            } => {
                whole_ref("SourceChanged.source", source)?;
                non_empty("SourceChanged.revision", revision)?;
                non_empty("SourceChanged.summary", summary)
            }
            Self::SourceWriteConflict {
                source,
                expected_revision,
                current_revision,
                summary,
            } => {
                whole_ref("SourceWriteConflict.source", source)?;
                non_empty("SourceWriteConflict.expected_revision", expected_revision)?;
                non_empty("SourceWriteConflict.current_revision", current_revision)?;
                non_empty("SourceWriteConflict.summary", summary)
            }
        }
    }
}

/// A ref the kernel may name in an event: an identifier, a kind and a
/// native owner, attributed — the same whole-ref law the focus constructors
/// enforce, applied where the wire meets the kernel.
fn whole_ref(at: &str, reference: &SemanticRef) -> Result<(), String> {
    for (part, value) in [
        ("ref", &reference.ref_id),
        ("kind", &reference.kind),
        ("native_owner", &reference.native_owner),
    ] {
        if value.trim().is_empty() {
            return Err(format!("{at} carries a {part} that is not a name"));
        }
    }
    if reference.provenance.source.trim().is_empty() {
        return Err(format!("{at} carries no provenance"));
    }
    Ok(())
}

fn non_empty(at: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{at} carries no observation"));
    }
    Ok(())
}

/// The envelope the desktop host forwards over the renderer event seam:
/// contract identity and version first, the typed event beside it.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct KernelEventEnvelope {
    pub schema: String,
    pub version: u32,
    #[serde(flatten)]
    pub event: KernelEvent,
}

impl KernelEventEnvelope {
    pub fn new(event: KernelEvent) -> Self {
        Self {
            schema: KERNEL_EVENT_SCHEMA.to_owned(),
            version: KERNEL_EVENT_VERSION,
            event,
        }
    }

    /// The kernel's parse boundary (02 §4) — ported verbatim law: contract
    /// identity and version are checked on the raw envelope *before* the
    /// typed payload is decoded, then the payload is validated per variant.
    /// A stale or foreign envelope is refused for the reason it is refused;
    /// a degenerate payload is not degraded into a variant that lies about
    /// what changed.
    pub fn parse(raw: &str) -> Result<Self, String> {
        let value: serde_json::Value = serde_json::from_str(raw)
            .map_err(|error| format!("malformed kernel event envelope: {error}"))?;
        let schema = value
            .get("schema")
            .and_then(serde_json::Value::as_str)
            .ok_or("kernel event envelope carries no schema")?;
        if schema != KERNEL_EVENT_SCHEMA {
            return Err(format!(
                "unsupported kernel event schema `{schema}`; this kernel speaks {KERNEL_EVENT_SCHEMA}"
            ));
        }
        let version = value
            .get("version")
            .and_then(serde_json::Value::as_u64)
            .ok_or("kernel event envelope carries no version")?;
        if version != u64::from(KERNEL_EVENT_VERSION) {
            return Err(format!(
                "unsupported kernel event version {version}; this kernel speaks version {KERNEL_EVENT_VERSION}"
            ));
        }
        let envelope: Self = serde_json::from_value(value)
            .map_err(|error| format!("malformed kernel event payload: {error}"))?;
        envelope.event.validate()?;
        Ok(envelope)
    }
}

impl From<KernelEvent> for KernelEventEnvelope {
    fn from(event: KernelEvent) -> Self {
        Self::new(event)
    }
}

/// Why a ref could not serve an event payload (ported bridge).
impl From<FocusRefError> for String {
    fn from(error: FocusRefError) -> Self {
        error.to_string()
    }
}

// ---------------------------------------------------------------------------
// EventOrder — the ordered, observable log (map §5 U0.4)
// ---------------------------------------------------------------------------

/// One event as observed on the seam: a monotonic sequence number beside
/// the envelope. `seq` starts at 1, never repeats, and never gaps — the
/// order the kernel changed state is the order the log carries.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct KernelEventReceipt {
    pub seq: u64,
    #[serde(flatten)]
    pub envelope: KernelEventEnvelope,
}

/// The ordered kernel event log. Every kernel state change is recorded
/// exactly once; `record` is the single assignment point for `seq`, so no
/// emission path can duplicate or reorder.
#[derive(Clone, Debug, Default)]
pub struct KernelEventLog {
    entries: Vec<KernelEventReceipt>,
}

impl KernelEventLog {
    pub fn new() -> Self {
        Self::default()
    }

    /// Record one state change, assigning the next seq. Returns the receipt
    /// the operation hands back and the host forwards on the topic.
    pub fn record(&mut self, event: KernelEvent) -> KernelEventReceipt {
        let seq = self.entries.len() as u64 + 1;
        let receipt = KernelEventReceipt {
            seq,
            envelope: KernelEventEnvelope::new(event),
        };
        self.entries.push(receipt.clone());
        receipt
    }

    /// All receipts at or after `since_seq` (a cursor the renderer holds).
    pub fn since(&self, since_seq: u64) -> &[KernelEventReceipt] {
        let start = self
            .entries
            .partition_point(|entry| entry.seq < since_seq.max(1));
        &self.entries[start..]
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// The log's ordering law, checkable by tests and walks: seqs are
    /// strictly monotonic from 1 with no gaps.
    pub fn seq_is_ordered(&self) -> bool {
        self.entries
            .iter()
            .enumerate()
            .all(|(index, entry)| entry.seq == index as u64 + 1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::focus::SubjectRef;
    use crate::refs::{source_semantic_ref, RefProvenance};

    fn reference(ref_id: &str, kind: &str) -> SemanticRef {
        SemanticRef {
            ref_id: ref_id.to_owned(),
            kind: kind.to_owned(),
            native_owner: "central".to_owned(),
            provenance: RefProvenance {
                source: "test".to_owned(),
                revision: None,
            },
        }
    }

    fn focus_changed() -> KernelEvent {
        let mut focus = GlobalFocus::unfocused();
        focus.focus_subject(reference("central:source:project:project:o-i:x.md", "source")).unwrap();
        KernelEvent::FocusChanged { focus }
    }

    #[test]
    fn every_event_variant_exists_and_is_typed() {
        let source = source_semantic_ref(
            "central:source:project:project:o-i:ProjectCentral/user/learnings/README.md",
            None,
        )
        .unwrap();
        let events = vec![
            focus_changed(),
            KernelEvent::SurfaceChanged {
                surface_id: "s1".into(),
                surface_ref: Some(source.clone()),
                summary: "Surface opened.".into(),
            },
            KernelEvent::SourceOpened {
                source: source.clone(),
                revision: "central.content-fnv1a64/v1:2389:h".into(),
                summary: "Opened from the owner's reading.".into(),
            },
            KernelEvent::BufferDirty {
                source: source.clone(),
                dirty: true,
                summary: "The buffer crossed the clean/dirty line.".into(),
            },
            KernelEvent::SourceChanged {
                source: source.clone(),
                revision: "central.content-fnv1a64/v1:2427:h2".into(),
                summary: "Saved through the owner's CAS.".into(),
            },
            KernelEvent::SourceWriteConflict {
                source,
                expected_revision: "central.content-fnv1a64/v1:2389:h".into(),
                current_revision: "central.content-fnv1a64/v1:2404:h3".into(),
                summary: "Revision moved; both sides preserved.".into(),
            },
        ];
        assert_eq!(events.len(), 6);
        for event in &events {
            let envelope = KernelEventEnvelope::new(event.clone());
            assert_eq!(envelope.schema, KERNEL_EVENT_SCHEMA);
            assert_eq!(envelope.version, KERNEL_EVENT_VERSION);
            assert_eq!(envelope.event.tag(), event.tag());
            assert!(KernelEventEnvelope::parse(&serde_json::to_string(&envelope).unwrap()).is_ok());
        }
    }

    #[test]
    fn events_round_trip_over_the_wire_with_schema_and_version() {
        let envelope = KernelEventEnvelope::new(focus_changed());
        let serialized = serde_json::to_string(&envelope).unwrap();
        let restored: KernelEventEnvelope = serde_json::from_str(&serialized).unwrap();
        assert_eq!(restored, envelope);

        let value: serde_json::Value = serde_json::from_str(&serialized).unwrap();
        assert_eq!(value["schema"], KERNEL_EVENT_SCHEMA);
        assert_eq!(value["version"], 1);
        assert_eq!(value["event"], "focus_changed");
        assert_eq!(
            value["focus"]["subject"]["ref"],
            "central:source:project:project:o-i:x.md"
        );
    }

    #[test]
    fn unknown_events_fail_closed_instead_of_degrading_into_another_variant() {
        let raw = r#"{"schema":"oi.kernel-event/v1","version":1,"event":"teleport_subject"}"#;
        assert!(serde_json::from_str::<KernelEventEnvelope>(raw).is_err());
    }

    /// Ported (old events.rs parse-boundary pins): foreign and stale
    /// envelopes are refused by reason, then the payload per variant.
    #[test]
    fn the_kernel_parse_boundary_refuses_foreign_and_stale_envelopes_by_reason() {
        let foreign = r#"{"schema":"other.kernel-event/v9","version":1,"event":"focus_changed"}"#;
        let error = KernelEventEnvelope::parse(foreign).unwrap_err();
        assert!(error.contains("schema"), "refused for the schema: {error}");

        let stale = r#"{"schema":"oi.kernel-event/v1","version":0,"event":"focus_changed"}"#;
        let error = KernelEventEnvelope::parse(stale).unwrap_err();
        assert!(error.contains("version 0"), "refused for the version: {error}");

        let unversioned = r#"{"schema":"oi.kernel-event/v1","event":"focus_changed"}"#;
        let error = KernelEventEnvelope::parse(unversioned).unwrap_err();
        assert!(error.contains("no version"), "{error}");
    }

    #[test]
    fn the_kernel_parse_boundary_refuses_a_payload_the_kernel_could_not_produce() {
        let degenerate = r#"{"schema":"oi.kernel-event/v1","version":1,"event":"source_changed","source":{"ref":"","kind":"source","native_owner":"central","provenance":{"source":"test"}},"revision":"r1","summary":"saved"}"#;
        let error = KernelEventEnvelope::parse(degenerate).unwrap_err();
        assert!(error.contains("SourceChanged.source"), "{error}");

        let unattributed = r#"{"schema":"oi.kernel-event/v1","version":1,"event":"source_changed","source":{"ref":"central:source:project:project:o-i:a.md","kind":"source","native_owner":"central","provenance":{"source":"  "}},"revision":"r1","summary":"saved"}"#;
        let error = KernelEventEnvelope::parse(unattributed).unwrap_err();
        assert!(error.contains("provenance"), "{error}");

        let observationless = r#"{"schema":"oi.kernel-event/v1","version":1,"event":"buffer_dirty","source":{"ref":"central:source:project:project:o-i:a.md","kind":"source","native_owner":"central","provenance":{"source":"test"}},"dirty":true,"summary":"  "}"#;
        let error = KernelEventEnvelope::parse(observationless).unwrap_err();
        assert!(error.contains("BufferDirty.summary"), "{error}");
    }

    #[test]
    fn focus_changed_carries_the_whole_relation_not_a_copy_of_selection() {
        let mut focus = GlobalFocus::unfocused();
        focus.focus_subject(reference("central:source:project:project:o-i:x.md", "source")).unwrap();
        let event = KernelEvent::FocusChanged { focus };
        assert_eq!(event.tag(), "focus_changed");
        assert_eq!(
            event.subject().unwrap().ref_id,
            "central:source:project:project:o-i:x.md"
        );
        // the relation round-trips as the SubjectRef the focus holds
        let KernelEvent::FocusChanged { focus } = event else {
            unreachable!()
        };
        let held: SubjectRef = focus.subject.clone().unwrap();
        assert_eq!(
            held.semantic_ref().ref_id,
            "central:source:project:project:o-i:x.md"
        );
    }

    #[test]
    fn the_log_orders_seqs_monotonically_from_one_with_no_gaps() {
        let mut log = KernelEventLog::new();
        assert!(log.is_empty());
        let mut last = 0;
        for index in 0..5 {
            let receipt = log.record(focus_changed());
            assert_eq!(receipt.seq, last + 1);
            assert_eq!(receipt.seq as usize, index + 1);
            assert_eq!(receipt.envelope.event.tag(), "focus_changed");
            last = receipt.seq;
        }
        assert_eq!(log.since(0).len(), 5);
        assert_eq!(log.since(4).len(), 2);
        assert_eq!(log.since(6).len(), 0);
        assert!(log.seq_is_ordered());
    }
}
