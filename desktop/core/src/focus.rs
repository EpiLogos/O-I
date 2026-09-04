//! The one global focus relation (02 §7) — kernel-owned semantic state.
//!
//! The whole application shares one notion of *what we are currently talking
//! about*: a stable subject plus its surrounding relations (current World,
//! Project, Journey, Agency encounter). Exactly one current focus relation
//! exists kernel-wide (03 §B); focus change propagates as an event every
//! surface may consume, and no component copies selection state (02 §5, §7).
//!
//! Refs stay opaque: the kernel never re-owns another product's nouns and
//! never infers a relation from a ref's kind string (02 §9.3). Resolving the
//! surrounding relations from a World reading is the owning service's act
//! (WorldService, 02 §3); this module only holds the relation honestly.

use crate::shell::SemanticRef;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Schema of the focus relation carried by `KernelEvent::FocusChanged` and the
/// shell snapshot.
pub const GLOBAL_FOCUS_SCHEMA: &str = "oi.global-focus/v1";

/// A ref cannot serve as the requested focus relation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FocusRefError {
    pub relation: &'static str,
    pub ref_id: String,
    pub kind: String,
    pub reason: &'static str,
}

impl fmt::Display for FocusRefError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "ref `{}` (kind `{}`) cannot serve as the {} focus relation: {}",
            self.ref_id, self.kind, self.relation, self.reason
        )
    }
}

impl std::error::Error for FocusRefError {}

macro_rules! focus_relation {
    ($(#[$meta:meta])* $name:ident, $relation:literal) => {
        $(#[$meta])*
        #[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
        #[serde(transparent)]
        pub struct $name(SemanticRef);

        impl $name {
            /// Stable ref identifier of this relation.
            pub fn ref_id(&self) -> &str {
                &self.0.ref_id
            }

            /// Owner-declared kind of the referenced subject.
            pub fn kind(&self) -> &str {
                &self.0.kind
            }

            /// The exact opaque semantic ref this relation names.
            pub fn semantic_ref(&self) -> &SemanticRef {
                &self.0
            }
        }

        impl TryFrom<SemanticRef> for $name {
            type Error = FocusRefError;

            fn try_from(reference: SemanticRef) -> Result<Self, Self::Error> {
                if reference.ref_id.trim().is_empty() {
                    return Err(FocusRefError {
                        relation: $relation,
                        ref_id: reference.ref_id,
                        kind: reference.kind,
                        reason: "ref identifier is empty",
                    });
                }
                if reference.kind.trim().is_empty() {
                    return Err(FocusRefError {
                        relation: $relation,
                        ref_id: reference.ref_id,
                        kind: reference.kind,
                        reason: "ref kind is empty",
                    });
                }
                Ok(Self(reference))
            }
        }
    };
}

focus_relation! {
    /// The current World relation (02 §7). Opaque: the desktop never re-owns
    /// Central's WorldRef.
    WorldRef, "current world"
}

focus_relation! {
    /// The current Project relation (02 §7).
    ProjectRef, "current project"
}

focus_relation! {
    /// The one current subject (02 §7): file, knowledge node, agent, run,
    /// contribution — whatever the whole application is talking about.
    SubjectRef, "current subject"
}

focus_relation! {
    /// The current structured development relation (02 §7).
    JourneyRef, "current journey"
}

focus_relation! {
    /// The current Agency encounter relation (02 §7). Today's encounter
    /// identity is the canonical AIKit AgentSession (03 §B4).
    AgencyEncounterRef, "current agency encounter"
}

/// The one global focus relation (02 §7): current World, Project, subject,
/// Journey and Agency encounter. Absent relations are absent — an observation,
/// never fabricated (02 §10); the empty relation is state `B0 No focus`
/// (03 §B).
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(default)]
pub struct GlobalFocus {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub world: Option<WorldRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<ProjectRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<SubjectRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub journey: Option<JourneyRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agency_encounter: Option<AgencyEncounterRef>,
}

impl GlobalFocus {
    /// `B0 No focus` (03 §B): nothing is selected.
    pub fn unfocused() -> Self {
        Self::default()
    }

    pub fn is_focused(&self) -> bool {
        self.subject.is_some()
    }

    /// The one current subject exactly as the kernel holds it.
    pub fn subject_ref(&self) -> Option<&SemanticRef> {
        self.subject.as_ref().map(SubjectRef::semantic_ref)
    }

    /// Make `subject` the one current focus. Replaces whatever subject was
    /// current — the invariant is exactly one current focus relation
    /// kernel-wide (03 §B), never an accumulation.
    pub fn focus_subject(&mut self, subject: SemanticRef) -> Result<(), FocusRefError> {
        self.subject = Some(SubjectRef::try_from(subject)?);
        Ok(())
    }

    /// Return to `B0 No focus`.
    pub fn clear_subject(&mut self) {
        self.subject = None;
    }

    /// Bind the current World relation. Called by the kernel service that
    /// resolves Worlds, never inferred from a selected ref's kind.
    pub fn bind_world(&mut self, world: WorldRef) {
        self.world = Some(world);
    }

    /// Bind the current Project relation.
    pub fn bind_project(&mut self, project: ProjectRef) {
        self.project = Some(project);
    }

    /// Bind the current Journey relation.
    pub fn bind_journey(&mut self, journey: JourneyRef) {
        self.journey = Some(journey);
    }

    /// Bind the current Agency encounter relation.
    pub fn bind_agency_encounter(&mut self, encounter: AgencyEncounterRef) {
        self.agency_encounter = Some(encounter);
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

    #[test]
    fn empty_relation_is_b0_no_focus() {
        let focus = GlobalFocus::unfocused();
        assert!(!focus.is_focused());
        assert!(focus.subject_ref().is_none());
        assert_eq!(
            serde_json::to_value(&focus).unwrap(),
            serde_json::json!({})
        );
    }

    #[test]
    fn exactly_one_subject_is_held_never_an_accumulation() {
        let mut focus = GlobalFocus::unfocused();
        focus.focus_subject(reference("central/file:a.rs", "file")).unwrap();
        focus.focus_subject(reference("factory.run/184", "run")).unwrap();
        assert_eq!(focus.subject_ref().unwrap().ref_id, "factory.run/184");
    }

    #[test]
    fn a_ref_without_an_identifier_is_not_a_subject() {
        let mut focus = GlobalFocus::unfocused();
        let error = focus.focus_subject(reference("", "file")).unwrap_err();
        assert_eq!(error.relation, "current subject");
        assert!(focus.subject_ref().is_none());
    }

    #[test]
    fn relation_slots_accept_only_whole_refs_and_round_trip() {
        let world = WorldRef::try_from(reference("world:personal", "world")).unwrap();
        let mut focus = GlobalFocus::unfocused();
        focus.bind_world(world);
        assert_eq!(focus.world.as_ref().unwrap().ref_id(), "world:personal");

        let serialized = serde_json::to_value(&focus).unwrap();
        let restored: GlobalFocus = serde_json::from_value(serialized).unwrap();
        assert_eq!(restored, focus);
    }

    #[test]
    fn clearing_returns_to_b0() {
        let mut focus = GlobalFocus::unfocused();
        focus.focus_subject(reference("central/file:a.rs", "file")).unwrap();
        focus.clear_subject();
        assert!(!focus.is_focused());
    }
}
