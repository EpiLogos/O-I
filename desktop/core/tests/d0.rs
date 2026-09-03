use oi_cli::status::{NativeSurfaceState, SuiteCompositionDisclosure, SurfaceDisclosure};
use oi_desktop_core::{
    BridgeCallClass, BridgeCaller, BridgePolicy, DesktopHost, SemanticRef, ShellDestination,
    SuiteCondition,
};

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

fn disclosure(states: &[NativeSurfaceState]) -> SuiteCompositionDisclosure {
    SuiteCompositionDisclosure {
        schema: "oi.desktop-composition-disclosure/v1".into(),
        personal_ground: None,
        surfaces: states
            .iter()
            .enumerate()
            .map(|(index, state)| surface(&format!("p{index}"), *state))
            .collect(),
        warnings: Vec::new(),
    }
}

#[test]
fn shell_has_stable_home_personal_build_explore_system_slots() {
    assert_eq!(
        ShellDestination::ALL,
        [
            ShellDestination::Home,
            ShellDestination::Personal,
            ShellDestination::Build,
            ShellDestination::Explore,
            ShellDestination::System,
        ]
    );
}

#[test]
fn suite_states_are_truthful_and_non_boolean() {
    let empty = DesktopHost::new(disclosure(&[
        NativeSurfaceState::Missing,
        NativeSurfaceState::Missing,
    ]));
    assert_eq!(
        empty
            .snapshot(BridgeCaller::ShellUi)
            .unwrap()
            .suite_condition,
        SuiteCondition::Empty
    );

    let partial = DesktopHost::new(disclosure(&[
        NativeSurfaceState::Registered,
        NativeSurfaceState::Missing,
    ]));
    assert_eq!(
        partial
            .snapshot(BridgeCaller::ShellUi)
            .unwrap()
            .suite_condition,
        SuiteCondition::Partial
    );

    let broken = DesktopHost::new(disclosure(&[
        NativeSurfaceState::Registered,
        NativeSurfaceState::Broken,
    ]));
    assert_eq!(
        broken
            .snapshot(BridgeCaller::ShellUi)
            .unwrap()
            .suite_condition,
        SuiteCondition::Broken
    );

    let full = DesktopHost::new(disclosure(&[
        NativeSurfaceState::Registered,
        NativeSurfaceState::Registered,
    ]));
    assert_eq!(
        full.snapshot(BridgeCaller::ShellUi)
            .unwrap()
            .suite_condition,
        SuiteCondition::Full
    );
}

#[test]
fn selected_ref_is_shared_by_canvas_and_agent_region_without_context_copy() {
    let mut host = DesktopHost::new(disclosure(&[NativeSurfaceState::Registered]));
    let subject = SemanticRef {
        ref_id: "factory.run/184".into(),
        kind: "run".into(),
        native_owner: "software-factory".into(),
        provenance: oi_desktop_core::RefProvenance {
            source: "factory".into(),
            revision: Some("abc123".into()),
        },
    };
    host.select(BridgeCaller::ShellUi, subject.clone()).unwrap();
    let snapshot = host.snapshot(BridgeCaller::ShellUi).unwrap();
    assert_eq!(snapshot.selection, Some(subject));
}

#[test]
fn rendered_contribution_code_has_no_ambient_native_bridge_authority() {
    let policy = BridgePolicy;
    for call in BridgeCallClass::ALL {
        assert!(policy
            .authorize(BridgeCaller::SandboxedContribution, call)
            .is_err());
    }
}

#[test]
fn bridge_surface_contains_no_generic_shell_or_filesystem_escape_hatch() {
    let classes = format!("{:?}", BridgeCallClass::ALL);
    assert!(!classes.to_ascii_lowercase().contains("shell"));
    assert!(!classes.to_ascii_lowercase().contains("filesystem"));
    assert!(!classes.to_ascii_lowercase().contains("process"));

    let source = include_str!("../src/bridge.rs");
    assert!(!source.contains("Command::new"));
    assert!(!source.contains("std::fs"));
}
#[test]
fn shell_snapshot_carries_world_recognition_when_ground_is_set() {
    use std::time::{SystemTime, UNIX_EPOCH};

    let root = std::env::temp_dir().join(format!(
        "oi-desktop-world-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();

    let previous = std::env::var_os("OI_HOME");
    std::env::set_var("OI_HOME", root.join("oi-state"));
    let result = (|| {
        let mut disclosure = disclosure(&[NativeSurfaceState::Registered]);
        disclosure.personal_ground = Some(root.display().to_string());
        let host = DesktopHost::new(disclosure);
        let snapshot = host.snapshot(BridgeCaller::ShellUi).unwrap();
        let account = snapshot.world_recognition.expect("world recognition account");
        assert_eq!(account.schema, "oi.world-recognition-account/v1");
        assert_eq!(account.target, root.display().to_string());
    })();
    match previous {
        Some(value) => std::env::set_var("OI_HOME", value),
        None => std::env::remove_var("OI_HOME"),
    }
    std::fs::remove_dir_all(&root).unwrap();
    result
}
