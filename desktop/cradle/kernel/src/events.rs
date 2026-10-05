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
use std::collections::VecDeque;
use std::sync::atomic::Ordering;

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
pub const KERNEL_EVENT_REPLAY_SCHEMA: &str = "oi.kernel-event-replay/v1";
pub const DEFAULT_EVENT_REPLAY_COUNT: usize = 1024;
pub const DEFAULT_EVENT_REPLAY_BYTES: usize = 4 * 1024 * 1024;
pub const MAX_EVENT_REPLAY_RECEIPT_BYTES: usize = 256 * 1024;
pub const MAX_EVENT_REPLAY_PAGE_COUNT: usize = 128;
pub const MAX_EVENT_REPLAY_PAGE_BYTES: usize = 512 * 1024;
const EVENT_REPLAY_PAGE_METADATA_RESERVE_BYTES: usize = 512;
static EVENT_LOG_FALLBACK_GENERATION: std::sync::atomic::AtomicU64 =
    std::sync::atomic::AtomicU64::new(0);

struct ByteCounter(usize);

impl std::io::Write for ByteCounter {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        self.0 = self.0.saturating_add(bytes.len());
        Ok(bytes.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

fn serialized_len<T: Serialize>(value: &T) -> Result<usize, serde_json::Error> {
    let mut counter = ByteCounter(0);
    serde_json::to_writer(&mut counter, value)?;
    Ok(counter.0)
}

fn new_event_log_generation() -> String {
    let mut random = [0u8; 16];
    if getrandom::fill(&mut random).is_ok() {
        return random.iter().map(|byte| format!("{byte:02x}")).collect();
    }

    // Entropy may be unavailable in constrained hosts. Preserve distinct log
    // generations within this process and make a process restart unlikely to
    // reuse one, without disclosing a source, owner, or session identifier.
    let instance = EVENT_LOG_FALLBACK_GENERATION.fetch_add(1, Ordering::Relaxed);
    let time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("fallback-{}-{time}-{instance}", std::process::id())
}

/// One typed kernel event (02 §5), for a state change U0.4's kernel
/// actually produces. Each variant names the exact refs that changed; the
/// changed reading itself is pulled through its own read model, so an event
/// is a disclosure trigger, never a second source of truth.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "event", rename_all = "snake_case")]
// The event payloads are the owner's own shapes and differ in size by
// nature; boxing one arm would change how every emitter constructs it.
#[allow(clippy::large_enum_variant)]
pub enum KernelEvent {
    DictationChanged {
        revision: u64,
        stt_url: String,
    },
    WorkingSurfaceDriving {
        agent_session: String,
        binding: String,
        client_id: String,
        driving: bool,
        observed_at_unix_ms: u64,
    },
    DecisionRecorded {
        receipt: serde_json::Value,
    },
    DecisionEpisodeChanged {
        episode: serde_json::Value,
    },
    /// An actual native action response; a returned failed/unreturned run is
    /// preserved verbatim and must not be represented as completion.
    RoutineActionReturned {
        action: String,
        routine_ref: String,
        data: serde_json::Value,
    },
    PresentationChanged {
        revision: u64,
        theme: crate::presentation::ThemeChoice,
    },
    NaraDecisionRecorded {
        decision: serde_json::Value,
    },
    ConfigurationChanged {
        operation: String,
        references: Vec<String>,
    },

    ExpressionChanged {
        expression_ref: String,
        revision: u64,
        actor: String,
        /// Caller-supplied Activity correlation. It is unverified here and
        /// never authenticates the caller or grants Action authority.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        activity_ref: Option<String>,
    },
    WorldChanged {
        summary: String,
    },
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
    /// A file write or restore through `central.files` changed what the
    /// owner holds at `path` — the disclosure a retained listing (the file
    /// tree's workspace-keyed cache) invalidates on. Emitted only when the
    /// owner recorded an actual change; an unchanged write mutates nothing
    /// and emits nothing, exactly as a source save does.
    FileChanged {
        path: String,
        summary: String,
    },
}

impl KernelEvent {
    /// The exact subject the event is about, for consumers that route by
    /// subject without matching every variant.
    pub fn subject(&self) -> Option<&SemanticRef> {
        match self {
            Self::WorkingSurfaceDriving { .. } | Self::RoutineActionReturned { .. } => None,
            Self::DictationChanged { .. }
            | Self::DecisionRecorded { .. }
            | Self::DecisionEpisodeChanged { .. }
            | Self::PresentationChanged { .. }
            | Self::NaraDecisionRecorded { .. }
            | Self::ConfigurationChanged { .. }
            | Self::WorldChanged { .. }
            | Self::ExpressionChanged { .. }
            | Self::FileChanged { .. } => None,
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
            Self::WorkingSurfaceDriving { .. } => "working_surface_driving",
            Self::RoutineActionReturned { .. } => "routine_action_returned",
            Self::DictationChanged { .. } => "dictation_changed",
            Self::DecisionRecorded { .. } => "decision_recorded",
            Self::DecisionEpisodeChanged { .. } => "decision_episode_changed",
            Self::PresentationChanged { .. } => "presentation_changed",
            Self::NaraDecisionRecorded { .. } => "nara_decision_recorded",
            Self::ConfigurationChanged { .. } => "configuration_changed",
            Self::WorldChanged { .. } => "world_changed",
            Self::ExpressionChanged { .. } => "expression_changed",
            Self::FocusChanged { .. } => "focus_changed",
            Self::SurfaceChanged { .. } => "surface_changed",
            Self::SourceOpened { .. } => "source_opened",
            Self::BufferDirty { .. } => "buffer_dirty",
            Self::SourceChanged { .. } => "source_changed",
            Self::SourceWriteConflict { .. } => "source_write_conflict",
            Self::FileChanged { .. } => "file_changed",
        }
    }

    /// Per-variant payload validation at the kernel's parse boundary (02
    /// §4) — ported law: deserialization alone would accept an event that
    /// names a degenerate ref; an event this kernel could not have produced
    /// is refused here.
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Self::WorkingSurfaceDriving {
                agent_session,
                binding,
                client_id,
                ..
            } => {
                non_empty("agent_session", agent_session)?;
                non_empty("binding", binding)?;
                non_empty("client_id", client_id)
            }
            Self::RoutineActionReturned {
                action,
                routine_ref,
                data,
            } => crate::routine::validate_return(action, routine_ref, data),
            Self::DictationChanged { revision, stt_url } => {
                if *revision == 0 {
                    return Err("Dictation revision must be positive".into());
                }
                non_empty("stt_url", stt_url)
            }
            Self::DecisionRecorded { receipt } => {
                if receipt["schema"] != crate::decision::RECEIPT_SCHEMA {
                    return Err("Invalid decision receipt schema".into());
                }
                non_empty(
                    "decision_ref",
                    receipt["decision_ref"].as_str().unwrap_or(""),
                )?;
                non_empty(
                    "authority_ref",
                    receipt["authority_ref"].as_str().unwrap_or(""),
                )
            }
            Self::DecisionEpisodeChanged { episode } => {
                non_empty("episode_ref", episode["episode_ref"].as_str().unwrap_or(""))
            }
            Self::PresentationChanged { revision, theme } => {
                if *revision == 0
                    || !["light", "dark", "system"].contains(&theme.appearance.as_str())
                {
                    Err("Invalid appearance event".into())
                } else {
                    Ok(())
                }
            }
            Self::NaraDecisionRecorded { decision } => {
                crate::presentation::validate_decision(decision)
            }
            Self::ConfigurationChanged {
                operation,
                references,
            } => {
                non_empty("configuration operation", operation)?;
                for reference in references {
                    non_empty("configuration reference", reference)?;
                }
                Ok(())
            }
            Self::ExpressionChanged {
                expression_ref,
                revision,
                actor,
                activity_ref,
            } => {
                non_empty("expression_ref", expression_ref)?;
                non_empty("actor", actor)?;
                if let Some(activity_ref) = activity_ref {
                    non_empty("activity_ref", activity_ref)?;
                }
                if *revision == 0 {
                    Err("Expression revision must be positive".into())
                } else {
                    Ok(())
                }
            }
            Self::WorldChanged { summary } => non_empty("WorldChanged.summary", summary),
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
                source, summary, ..
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
            Self::FileChanged { path, summary } => {
                non_empty("FileChanged.path", path)?;
                non_empty("FileChanged.summary", summary)
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
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
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
/// the envelope. `seq` starts at 1 and never repeats, even when retention
/// evicts a receipt or an oversized live receipt cannot be retained.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct KernelEventReceipt {
    pub seq: u64,
    #[serde(flatten)]
    pub envelope: KernelEventEnvelope,
}

/// Bounded replay result. A resync response carries no receipts: the consumer
/// must rebuild its presentation input from stable read models.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct KernelEventReplay {
    pub schema: String,
    pub generation: String,
    pub oldest_seq: Option<u64>,
    pub latest_seq: u64,
    pub next_seq: u64,
    pub resync_required: bool,
    pub has_more: bool,
    pub receipts: Vec<KernelEventReceipt>,
}

/// The ordered kernel event log. Sequence assignment is independent of
/// retention; this log describes only ephemeral kernel disclosure history.
#[derive(Clone, Debug)]
pub struct KernelEventLog {
    generation: String,
    entries: VecDeque<(KernelEventReceipt, usize)>,
    retained_bytes: usize,
    next_seq: u64,
    latest_gap_seq: Option<u64>,
    max_count: usize,
    max_bytes: usize,
}

impl KernelEventLog {
    pub fn new() -> Self {
        Self::with_limits(DEFAULT_EVENT_REPLAY_COUNT, DEFAULT_EVENT_REPLAY_BYTES)
    }

    fn with_limits(max_count: usize, max_bytes: usize) -> Self {
        Self {
            generation: new_event_log_generation(),
            entries: VecDeque::new(),
            retained_bytes: 0,
            next_seq: 1,
            latest_gap_seq: None,
            max_count,
            max_bytes,
        }
    }

    /// Record one state change, assigning the next seq. Returns the receipt
    /// the operation hands back and the host forwards on the topic.
    pub fn record(&mut self, event: KernelEvent) -> KernelEventReceipt {
        let seq = self.next_seq;
        self.next_seq = self.next_seq.saturating_add(1);
        let receipt = KernelEventReceipt {
            seq,
            envelope: KernelEventEnvelope::new(event),
        };
        let size = serialized_len(&receipt).unwrap_or(usize::MAX);
        if size > MAX_EVENT_REPLAY_RECEIPT_BYTES || size > self.max_bytes || self.max_count == 0 {
            self.latest_gap_seq = Some(seq);
            return receipt;
        }
        while self.entries.len() >= self.max_count
            || self.retained_bytes.saturating_add(size) > self.max_bytes
        {
            if let Some((_, removed_size)) = self.entries.pop_front() {
                self.retained_bytes = self.retained_bytes.saturating_sub(removed_size);
            } else {
                break;
            }
        }
        self.retained_bytes += size;
        self.entries.push_back((receipt.clone(), size));
        receipt
    }

    /// All receipts at or after `since_seq` (a cursor the renderer holds).
    pub fn since(&self, since_seq: u64) -> Vec<KernelEventReceipt> {
        // Kept only for in-process legacy readers. New replay consumers must
        // use `replay`, which reports gaps and generation changes explicitly.
        self.entries
            .iter()
            .filter(|(entry, _)| entry.seq >= since_seq.max(1))
            .map(|(entry, _)| entry.clone())
            .collect()
    }

    pub fn replay(
        &self,
        generation: Option<&str>,
        cursor: u64,
        requested_limit: usize,
    ) -> KernelEventReplay {
        let oldest_seq = self.entries.front().map(|(entry, _)| entry.seq);
        let latest_seq = self.next_seq.saturating_sub(1);
        let invalid_cursor = cursor == 0 || cursor > self.next_seq;
        let unqualified_continuation = generation.is_none() && cursor > 1;
        let cursor = cursor.max(1);
        let wrong_generation = generation.is_some_and(|value| value != self.generation);
        let expired = oldest_seq.is_some_and(|oldest| cursor < oldest);
        let crossed_gap = self.latest_gap_seq.is_some_and(|gap| cursor <= gap);
        let mut resync_required = invalid_cursor
            || unqualified_continuation
            || wrong_generation
            || expired
            || crossed_gap;
        let count_limit = requested_limit.clamp(1, MAX_EVENT_REPLAY_PAGE_COUNT);
        let mut receipts = Vec::new();
        let mut page_bytes = 0usize;
        let mut next_seq = cursor;
        if !resync_required {
            for (receipt, size) in self
                .entries
                .iter()
                .filter(|(receipt, _)| receipt.seq >= cursor)
            {
                if receipts.len() >= count_limit
                    || page_bytes
                        .saturating_add(*size)
                        .saturating_add(EVENT_REPLAY_PAGE_METADATA_RESERVE_BYTES)
                        > MAX_EVENT_REPLAY_PAGE_BYTES
                {
                    break;
                }
                // A missing sequence inside the page is a discontinuity.
                if receipt.seq != next_seq {
                    resync_required = true;
                    receipts.clear();
                    next_seq = cursor;
                    break;
                }
                page_bytes += *size;
                receipts.push(receipt.clone());
                next_seq = receipt.seq.saturating_add(1);
            }
        }
        if resync_required {
            receipts.clear();
            next_seq = latest_seq.saturating_add(1);
        }
        let has_more = !resync_required
            && self
                .entries
                .iter()
                .any(|(receipt, _)| receipt.seq == next_seq);
        KernelEventReplay {
            schema: KERNEL_EVENT_REPLAY_SCHEMA.to_owned(),
            generation: self.generation.clone(),
            oldest_seq,
            latest_seq,
            next_seq,
            resync_required,
            has_more,
            receipts,
        }
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Retained receipts stay strictly monotonic, though eviction and
    /// oversized events may leave gaps in the retained sequence.
    pub fn seq_is_ordered(&self) -> bool {
        self.entries
            .iter()
            .zip(self.entries.iter().skip(1))
            .all(|((left, _), (right, _))| left.seq < right.seq)
    }
}

impl Default for KernelEventLog {
    fn default() -> Self {
        Self::new()
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
        focus
            .focus_subject(reference(
                "central:source:project:project:o-i:x.md",
                "source",
            ))
            .unwrap();
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
        assert!(
            error.contains("version 0"),
            "refused for the version: {error}"
        );

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
        focus
            .focus_subject(reference(
                "central:source:project:project:o-i:x.md",
                "source",
            ))
            .unwrap();
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

    #[test]
    fn old_unbounded_vec_regression_is_bounded_by_count_and_sequences_keep_advancing() {
        // The former Vec retained every receipt. This deliberately records
        // beyond the configured count and verifies that replay exposes the
        // loss instead of pretending the history is complete.
        let mut log = KernelEventLog::with_limits(2, DEFAULT_EVENT_REPLAY_BYTES);
        let first = log.record(focus_changed());
        log.record(focus_changed());
        let third = log.record(focus_changed());
        assert_eq!((first.seq, third.seq), (1, 3));
        assert_eq!(log.len(), 2);
        let replay = log.replay(Some(&log.generation), 1, 128);
        assert!(replay.resync_required);
        assert!(replay.receipts.is_empty());
        assert_eq!(replay.oldest_seq, Some(2));
        let continued = log.record(focus_changed());
        assert_eq!(continued.seq, 4);
        assert!(log.seq_is_ordered());
    }

    #[test]
    fn byte_eviction_removes_oldest_receipts_without_resetting_sequence() {
        let sample = KernelEventReceipt {
            seq: 1,
            envelope: KernelEventEnvelope::new(focus_changed()),
        };
        let receipt_bytes = serde_json::to_vec(&sample).unwrap().len();
        let mut log = KernelEventLog::with_limits(10, receipt_bytes * 2);
        for _ in 0..3 {
            log.record(focus_changed());
        }
        assert_eq!(log.len(), 2);
        assert!(log.retained_bytes <= receipt_bytes * 2);
        let replay = log.replay(Some(&log.generation), 1, 128);
        assert!(replay.resync_required);
        assert_eq!(replay.oldest_seq, Some(2));
        assert_eq!(log.record(focus_changed()).seq, 4);
    }

    #[test]
    fn non_allocating_serialized_length_matches_a_bounded_encoded_sample() {
        let receipt = KernelEventReceipt {
            seq: 7,
            envelope: KernelEventEnvelope::new(focus_changed()),
        };
        let encoded = serde_json::to_vec(&receipt).unwrap();
        assert!(encoded.len() < 4096);
        assert_eq!(serialized_len(&receipt).unwrap(), encoded.len());
    }

    #[test]
    fn current_generation_bootstraps_an_empty_log_without_resync() {
        let log = KernelEventLog::new();
        let replay = log.replay(Some(&log.generation), 1, 128);
        assert_eq!(replay.schema, KERNEL_EVENT_REPLAY_SCHEMA);
        assert!(!replay.resync_required);
        assert!(!replay.has_more);
        assert_eq!(replay.oldest_seq, None);
        assert_eq!(replay.latest_seq, 0);
        assert_eq!(replay.next_seq, 1);
        assert!(replay.receipts.is_empty());
    }

    #[test]
    fn wrong_generation_and_expired_cursor_require_resync_without_receipts() {
        let mut log = KernelEventLog::with_limits(2, DEFAULT_EVENT_REPLAY_BYTES);
        for _ in 0..3 {
            log.record(focus_changed());
        }
        let wrong_generation = log.replay(Some("another-kernel"), 2, 128);
        assert!(wrong_generation.resync_required);
        assert!(wrong_generation.receipts.is_empty());
        assert_eq!(wrong_generation.next_seq, 4);

        let expired = log.replay(Some(&log.generation), 1, 128);
        assert!(expired.resync_required);
        assert!(expired.receipts.is_empty());
        assert_eq!(expired.next_seq, 4);
    }

    #[test]
    fn future_zero_and_generationless_continuations_require_current_read_models() {
        let mut log = KernelEventLog::new();
        log.record(focus_changed());
        for (generation, cursor) in [
            (Some(log.generation.as_str()), 0),
            (Some(log.generation.as_str()), 3),
            (Some(log.generation.as_str()), u64::MAX),
            (None, 2),
        ] {
            let replay = log.replay(generation, cursor, 128);
            assert!(replay.resync_required);
            assert!(replay.receipts.is_empty());
            assert_eq!(replay.next_seq, 2);
        }
        let bootstrap = log.replay(None, 1, 128);
        assert!(!bootstrap.resync_required);
        assert_eq!(bootstrap.receipts.len(), 1);
        let caught_up = log.replay(Some(&log.generation), 2, 128);
        assert!(!caught_up.resync_required);
        assert!(caught_up.receipts.is_empty());
    }

    #[test]
    fn oversized_live_receipt_is_returned_but_never_retained_and_marks_a_gap() {
        let mut log = KernelEventLog::new();
        let live = log.record(KernelEvent::WorldChanged {
            summary: "x".repeat(MAX_EVENT_REPLAY_RECEIPT_BYTES + 1),
        });
        assert_eq!(live.seq, 1);
        assert_eq!(log.len(), 0);
        let replay = log.replay(Some(&log.generation), 1, 128);
        assert!(replay.resync_required);
        assert!(replay.receipts.is_empty());
        assert_eq!(replay.latest_seq, 1);
        assert_eq!(replay.next_seq, 2);
    }

    #[test]
    fn replay_pages_obey_count_and_encoded_byte_limits() {
        let mut log = KernelEventLog::new();
        for _ in 0..140 {
            log.record(focus_changed());
        }
        let count_page = log.replay(Some(&log.generation), 1, usize::MAX);
        assert_eq!(count_page.receipts.len(), MAX_EVENT_REPLAY_PAGE_COUNT);
        assert_eq!(count_page.next_seq, 129);
        assert!(count_page.has_more);

        let mut byte_log = KernelEventLog::new();
        for _ in 0..32 {
            byte_log.record(KernelEvent::WorldChanged {
                summary: "x".repeat(24 * 1024),
            });
        }
        let byte_page = byte_log.replay(Some(&byte_log.generation), 1, 128);
        let encoded_size = byte_page
            .receipts
            .iter()
            .map(|receipt| serde_json::to_vec(receipt).unwrap().len())
            .sum::<usize>();
        assert!(byte_page.receipts.len() < 32);
        assert!(encoded_size <= MAX_EVENT_REPLAY_PAGE_BYTES);
        assert!(serde_json::to_vec(&byte_page).unwrap().len() <= MAX_EVENT_REPLAY_PAGE_BYTES);
        assert_eq!(
            byte_page.next_seq,
            byte_page.receipts.last().unwrap().seq + 1
        );
    }

    #[test]
    fn replay_page_continues_only_when_a_contiguous_retained_receipt_follows() {
        let mut log = KernelEventLog::new();
        for _ in 0..3 {
            log.record(focus_changed());
        }
        let first = log.replay(Some(&log.generation), 1, 2);
        assert_eq!(first.receipts.len(), 2);
        assert_eq!(first.next_seq, 3);
        assert!(first.has_more);

        let last = log.replay(Some(&first.generation), first.next_seq, 2);
        assert_eq!(last.receipts.len(), 1);
        assert_eq!(last.next_seq, 4);
        assert!(!last.has_more);
    }
}
