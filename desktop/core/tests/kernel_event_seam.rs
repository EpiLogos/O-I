//! Kernel event seam + global focus model (02 §5, §7; 03 §B).
//!
//! These are the conditions later verticals build on: focus is kernel state,
//! exactly one focus relation exists kernel-wide, focus and World changes are
//! pushed as typed events only after the kernel state actually changed, and
//! events stay kernel→UI disclosure that grants the renderer nothing.

use oi_desktop_core::{
    BridgeCallClass, BridgeCaller, BridgePolicy, DesktopHost, GlobalFocus, KernelEvent,
    KernelEventEnvelope, ProjectRef, SemanticRef, ShellDestination, SubjectRef, WorldRef,
    KERNEL_EVENT_SCHEMA, KERNEL_EVENT_TOPIC, KERNEL_EVENT_VERSION,
};
use oi_cli::status::{NativeSurfaceState, SuiteCompositionDisclosure, SurfaceDisclosure};

fn surface(id: &str, state: NativeSurfaceState) -> SurfaceDisclosure {
    SurfaceDisclosure {
        id: id.into(),
        public_name: id.into(),
        function: "fixture".into(),
        repository: format!("https://example.invalid/{id}"),
        native_entry: id.into(),
        accepted_revision: format!("fixture-revision-{id}"),
        canonical_namespace: id.into(),
        compatibility_aliases: Vec::new(),
        version_command: vec![id.into(), "--version".into()],
        capability_command: vec![id.into(), "capabilities".into(), "--json".into()],
        verification_command: vec![id.into(), "verify".into(), "--json".into()],
        state,
        resolved: None,
        version: None,
        detail: None,
    }
}

fn disclosure() -> SuiteCompositionDisclosure {
    SuiteCompositionDisclosure {
        schema: "oi.desktop-composition-disclosure/v1".into(),
        personal_ground: None,
        surfaces: vec![surface("central", NativeSurfaceState::Registered)],
        warnings: Vec::new(),
    }
}

fn subject(ref_id: &str, kind: &str) -> SemanticRef {
    SemanticRef {
        ref_id: ref_id.into(),
        kind: kind.into(),
        native_owner: "central".into(),
        provenance: oi_desktop_core::RefProvenance {
            source: "world tree".into(),
            revision: Some("abc123".into()),
        },
    }
}

fn focus_of(event: &KernelEvent) -> GlobalFocus {
    let KernelEvent::FocusChanged { focus } = event else {
        panic!("expected FocusChanged, got {:?}", event.tag())
    };
    focus.clone()
}

#[test]
fn selecting_a_subject_mutates_kernel_focus_and_emits_one_focus_changed() {
    let mut host = DesktopHost::new(disclosure());
    assert!(!host.focus().is_focused(), "cold start is B0 No focus");

    let event = host
        .select(BridgeCaller::ShellUi, subject("central/file:src/project.rs", "file"))
        .unwrap();
    let focus = focus_of(event.as_ref().expect("a real change emits an event"));
    assert_eq!(
        focus.subject_ref().unwrap().ref_id,
        "central/file:src/project.rs"
    );
    assert_eq!(host.focus().subject_ref(), focus.subject_ref());
}

#[test]
fn exactly_one_focus_relation_exists_kernel_wide() {
    let mut host = DesktopHost::new(disclosure());
    host.select(BridgeCaller::ShellUi, subject("central/file:a.rs", "file"))
        .unwrap();
    host.select(BridgeCaller::ShellUi, subject("factory.run/184", "run"))
        .unwrap();

    let snapshot = host.snapshot(BridgeCaller::ShellUi).unwrap();
    assert_eq!(
        snapshot.focus.subject_ref().unwrap().ref_id,
        "factory.run/184",
        "the latest selection is the one current subject"
    );
    assert_eq!(
        snapshot.selection.as_ref().unwrap().ref_id,
        "factory.run/184",
        "the snapshot's selection is a projection of the same relation, not a second copy"
    );
}

#[test]
fn reselecting_the_current_subject_emits_nothing() {
    let mut host = DesktopHost::new(disclosure());
    let selected = subject("central/file:a.rs", "file");
    host.select(BridgeCaller::ShellUi, selected.clone()).unwrap();

    let event = host.select(BridgeCaller::ShellUi, selected).unwrap();
    assert!(
        event.is_none(),
        "no kernel state changed, so no event may be emitted"
    );
}

#[test]
fn focus_change_reaches_every_consuming_surface_from_one_relation() {
    let mut host = DesktopHost::new(disclosure());
    let event = host
        .select(BridgeCaller::ShellUi, subject("agent-session:developer:1", "agent-session"))
        .unwrap();
    let focus = focus_of(event.as_ref().unwrap());

    // Any number of surfaces read the same kernel relation; none of them owns
    // a copy of selection state (04 §3 Focus).
    let canvas = focus.subject_ref().unwrap().clone();
    let knowledge = host.focus().subject_ref().unwrap().clone();
    let agency = snapshot_subject(&host);
    assert_eq!(canvas.ref_id, knowledge.ref_id);
    assert_eq!(canvas.ref_id, agency.ref_id);
}

fn snapshot_subject(host: &DesktopHost) -> SemanticRef {
    host.snapshot(BridgeCaller::ShellUi)
        .unwrap()
        .selection
        .expect("focused subject is disclosed")
}

#[test]
fn unauthorised_callers_still_cannot_select_and_emit_nothing() {
    let mut host = DesktopHost::new(disclosure());
    let denied = host
        .select(BridgeCaller::SandboxedContribution, subject("central/file:a.rs", "file"))
        .unwrap_err();
    assert!(matches!(
        denied,
        oi_desktop_core::SelectionError::Denied(_)
    ));
    assert!(!host.focus().is_focused(), "a denied selection changes nothing");

    for call in BridgeCallClass::ALL {
        assert!(BridgePolicy
            .authorize(BridgeCaller::SandboxedContribution, call)
            .is_err());
    }
}

#[test]
fn focus_changed_round_trips_over_the_event_seam() {
    let mut host = DesktopHost::new(disclosure());
    let event = host
        .select(BridgeCaller::ShellUi, subject("world:project:o-i", "project"))
        .unwrap()
        .unwrap();
    let envelope = KernelEventEnvelope::new(event);

    let serialized = serde_json::to_string(&envelope).unwrap();
    assert_eq!(envelope.schema, KERNEL_EVENT_SCHEMA);
    assert_eq!(envelope.version, KERNEL_EVENT_VERSION);

    let value: serde_json::Value = serde_json::from_str(&serialized).unwrap();
    assert_eq!(value["schema"], KERNEL_EVENT_SCHEMA);
    assert_eq!(value["event"], "focus_changed");
    assert_eq!(value["focus"]["subject"]["ref"], "world:project:o-i");

    let restored: KernelEventEnvelope = serde_json::from_str(&serialized).unwrap();
    assert_eq!(restored, envelope);
}

#[test]
fn the_kernel_types_the_whole_section7_relation() {
    let mut focus = GlobalFocus::unfocused();
    focus.bind_world(WorldRef::try_from(subject("world:personal", "world")).unwrap());
    focus.bind_project(ProjectRef::try_from(subject("world:project:o-i", "project")).unwrap());
    focus.focus_subject(subject("central/file:src/project.rs", "file")).unwrap();
    focus.bind_agency_encounter(
        oi_desktop_core::AgencyEncounterRef::try_from(subject("agent-session:developer:1", "agent-session"))
            .unwrap(),
    );
    focus.bind_journey(oi_desktop_core::JourneyRef::try_from(subject("factory.journey/12", "journey")).unwrap());

    let serialized = serde_json::to_value(&focus).unwrap();
    let restored: GlobalFocus = serde_json::from_value(serialized).unwrap();
    assert_eq!(restored, focus);
    assert!(restored.is_focused());
    assert_eq!(
        SubjectRef::try_from(subject("", "file")).is_err(),
        true,
        "a ref without an identifier never becomes the current subject"
    );
}

#[test]
fn the_event_seam_is_disclosure_not_a_new_bridge_call_class() {
    let classes = format!("{:?}", BridgeCallClass::ALL);
    assert!(!classes.contains("Event"));
    assert!(!classes.contains("Subscribe"));
    assert_eq!(KERNEL_EVENT_TOPIC, "oi:kernel-event");
}

#[test]
fn shell_destinations_are_unchanged_presentation_slots() {
    assert_eq!(ShellDestination::ALL.len(), 5);
}
