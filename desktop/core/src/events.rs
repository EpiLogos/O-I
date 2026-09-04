//! Typed kernel application events (02 §5) — the kernel as a constitution
//! that PUSHES.
//!
//! The key loop the desktop lives by: *native operation returns → kernel state
//! changes → typed events → the React projection re-renders reality.* Push,
//! not poll.
//!
//! Laws this seam keeps:
//!
//! - Events are kernel→renderer disclosure. They are not bridge calls, add no
//!   renderer capability and touch no BridgePolicy authority (02 §12).
//! - Events are honest: an operation emits only after its kernel state
//!   actually changed. Kernel operations therefore return the events they
//!   produced, and return none when nothing changed.
//! - Every event names exact refs, so an agent and a human read the same
//!   actuality from it (04 §4 agent-native parity).
//!
//! Not every event has a producer yet. The enum and the seam exist; producers
//! land with their verticals (02 §11).

use crate::focus::{FocusRefError, GlobalFocus, WorldRef};
use crate::shell::{SemanticRef, SuiteCondition};
use serde::{Deserialize, Serialize};

/// Schema of the event envelope the desktop host forwards to the renderer.
pub const KERNEL_EVENT_SCHEMA: &str = "oi.kernel-event/v1";

/// Version of the event contract. Bump when a payload's meaning changes, never
/// by adding a new variant.
pub const KERNEL_EVENT_VERSION: u32 = 1;

/// Topic the desktop host forwards kernel events on. The renderer subscribes
/// once to this topic and dispatches typed events to consumers.
pub const KERNEL_EVENT_TOPIC: &str = "oi:kernel-event";

/// One typed application event (02 §5). Each variant names the exact refs that
/// changed and says what was observed; the changed reading itself is pulled
/// through its own read model, so an event is a disclosure trigger, never a
/// second source of truth.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum KernelEvent {
    /// `open subject` moved the one global focus relation (02 §7, 03 §B).
    FocusChanged {
        focus: GlobalFocus,
    },
    /// A World's constitution changed: recognition, ground or machine relation.
    WorldChanged {
        world: WorldRef,
        summary: String,
    },
    /// Authored or observed source material changed under its owner's
    /// authority.
    SourceChanged {
        source: SemanticRef,
        summary: String,
    },
    /// Agency activity advanced for the referenced subject.
    ActivityUpdated {
        activity_ref: String,
        subject: SemanticRef,
        summary: String,
    },
    /// AgentSession identity, lifecycle or presence changed.
    SessionChanged {
        session: SemanticRef,
        summary: String,
    },
    /// Knowledge corpus or neighbourhood changed for the referenced subject.
    KnowledgeChanged {
        subject: SemanticRef,
        summary: String,
    },
    /// Something now requires the human, naming its exact subject (03 global
    /// invariant 4).
    AttentionRaised {
        attention_ref: String,
        subject: SemanticRef,
        summary: String,
    },
    /// An attention item was resolved.
    AttentionResolved {
        attention_ref: String,
        summary: String,
    },
    /// Factory Run state changed.
    RunChanged {
        run: SemanticRef,
        summary: String,
    },
    /// Factory Journey state changed.
    JourneyChanged {
        journey: SemanticRef,
        summary: String,
    },
    /// Workcell material situation changed.
    MaterialChanged {
        material: SemanticRef,
        summary: String,
    },
    /// Effective composition changed: what is present, degraded or absent.
    CompositionChanged {
        condition: SuiteCondition,
        summary: String,
    },
    /// SharedField projections, participants or contributions changed.
    SharedFieldChanged {
        field: SemanticRef,
        summary: String,
    },
}

impl KernelEvent {
    /// The exact subject the event is about, for consumers that route by
    /// subject without matching every variant.
    pub fn subject(&self) -> Option<&SemanticRef> {
        match self {
            Self::FocusChanged { focus } => focus.subject_ref(),
            Self::WorldChanged { world, .. } => Some(world.semantic_ref()),
            Self::SourceChanged { source, .. }
            | Self::ActivityUpdated { subject: source, .. }
            | Self::SessionChanged { session: source, .. }
            | Self::KnowledgeChanged { subject: source, .. }
            | Self::AttentionRaised { subject: source, .. }
            | Self::RunChanged { run: source, .. }
            | Self::JourneyChanged { journey: source, .. }
            | Self::MaterialChanged { material: source, .. }
            | Self::SharedFieldChanged { field: source, .. } => Some(source),
            Self::AttentionResolved { .. } | Self::CompositionChanged { .. } => None,
        }
    }

    /// The event tag exactly as it is tagged on the wire.
    pub fn tag(&self) -> &'static str {
        match self {
            Self::FocusChanged { .. } => "focus_changed",
            Self::WorldChanged { .. } => "world_changed",
            Self::SourceChanged { .. } => "source_changed",
            Self::ActivityUpdated { .. } => "activity_updated",
            Self::SessionChanged { .. } => "session_changed",
            Self::KnowledgeChanged { .. } => "knowledge_changed",
            Self::AttentionRaised { .. } => "attention_raised",
            Self::AttentionResolved { .. } => "attention_resolved",
            Self::RunChanged { .. } => "run_changed",
            Self::JourneyChanged { .. } => "journey_changed",
            Self::MaterialChanged { .. } => "material_changed",
            Self::CompositionChanged { .. } => "composition_changed",
            Self::SharedFieldChanged { .. } => "shared_field_changed",
        }
    }
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
}

impl From<KernelEvent> for KernelEventEnvelope {
    fn from(event: KernelEvent) -> Self {
        Self::new(event)
    }
}

/// Why a ref could not serve an event payload.
impl From<FocusRefError> for String {
    fn from(error: FocusRefError) -> Self {
        error.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reference(ref_id: &str, kind: &str) -> SemanticRef {
        SemanticRef {
            ref_id: ref_id.to_owned(),
            kind: kind.to_owned(),
            native_owner: "central".to_owned(),
            provenance: crate::RefProvenance {
                source: "test".to_owned(),
                revision: None,
            },
        }
    }

    fn focus_changed() -> KernelEvent {
        let mut focus = GlobalFocus::unfocused();
        focus.focus_subject(reference("central/file:src/project.rs", "file")).unwrap();
        KernelEvent::FocusChanged { focus }
    }

    #[test]
    fn every_section5_event_exists_and_is_typed() {
        let events = vec![
            focus_changed(),
            KernelEvent::WorldChanged {
                world: WorldRef::try_from(reference("world:personal", "world")).unwrap(),
                summary: "World recognition re-observed.".into(),
            },
            KernelEvent::SourceChanged {
                source: reference("central/file:src/project.rs", "file"),
                summary: "Source saved through the owner's authority gate.".into(),
            },
            KernelEvent::ActivityUpdated {
                activity_ref: "activity:agent-session:1".into(),
                subject: reference("agent-session:developer:1", "agent-session"),
                summary: "Agent is responding.".into(),
            },
            KernelEvent::SessionChanged {
                session: reference("agent-session:developer:1", "agent-session"),
                summary: "AgentSession opened.".into(),
            },
            KernelEvent::KnowledgeChanged {
                subject: reference("knowledge:o-i:project", "knowledge_node"),
                summary: "Neighbourhood re-read.".into(),
            },
            KernelEvent::AttentionRaised {
                attention_ref: "attention:1".into(),
                subject: reference("factory.candidate/9", "candidate"),
                summary: "Recognition requested.".into(),
            },
            KernelEvent::AttentionResolved {
                attention_ref: "attention:1".into(),
                summary: "Recognised by the human.".into(),
            },
            KernelEvent::RunChanged {
                run: reference("factory.run/184", "run"),
                summary: "Run state advanced.".into(),
            },
            KernelEvent::JourneyChanged {
                journey: reference("factory.journey/12", "journey"),
                summary: "Journey plan revised.".into(),
            },
            KernelEvent::MaterialChanged {
                material: reference("workcell.body/machine-1", "material_body"),
                summary: "Placement changed.".into(),
            },
            KernelEvent::CompositionChanged {
                condition: SuiteCondition::Partial,
                summary: "One provider degraded.".into(),
            },
            KernelEvent::SharedFieldChanged {
                field: reference("shared-field/o-i", "shared_field"),
                summary: "A contribution was admitted.".into(),
            },
        ];
        assert_eq!(events.len(), 13);

        for event in &events {
            let envelope = KernelEventEnvelope::new(event.clone());
            assert_eq!(envelope.schema, KERNEL_EVENT_SCHEMA);
            assert_eq!(envelope.version, KERNEL_EVENT_VERSION);
            assert_eq!(envelope.event.tag(), event.tag());
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
            "central/file:src/project.rs"
        );
    }

    #[test]
    fn unknown_events_fail_closed_instead_of_degrading_into_another_variant() {
        let raw = r#"{"schema":"oi.kernel-event/v1","version":1,"event":"teleport_subject"}"#;
        assert!(serde_json::from_str::<KernelEventEnvelope>(raw).is_err());

        let stale = r#"{"schema":"oi.kernel-event/v1","version":0,"event":"focus_changed"}"#;
        assert!(serde_json::from_str::<KernelEventEnvelope>(stale).is_err());
    }

    #[test]
    fn focus_changed_carries_the_whole_relation_not_a_copy_of_selection() {
        let mut focus = GlobalFocus::unfocused();
        focus.focus_subject(reference("central/file:src/project.rs", "file")).unwrap();
        focus.bind_project(
            crate::focus::ProjectRef::try_from(reference("world:project:o-i", "project")).unwrap(),
        );
        let event = KernelEvent::FocusChanged { focus };
        assert_eq!(event.tag(), "focus_changed");
        assert_eq!(event.subject().unwrap().ref_id, "central/file:src/project.rs");

        let KernelEvent::FocusChanged { focus } = event else {
            unreachable!()
        };
        assert_eq!(focus.subject_ref().unwrap().ref_id, "central/file:src/project.rs");
    }
}
