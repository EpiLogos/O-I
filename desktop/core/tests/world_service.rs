//! WorldService Projection reading + live composition (Vertical 1, unit K2).
//!
//! Every test here drives the same coarse kernel operations the host exposes —
//! world tree read, composition read, subject open, subject save — and holds
//! them against the design's binding laws: selection ≠ readability (01 §2),
//! provider truth (02 §10), degradation that stays local, and Central owner
//! Actions as the only route to authored ground (02 §9.4).

use std::ffi::OsString;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use oi_cli::status::{NativeSurfaceState, SuiteCompositionDisclosure, SurfaceDisclosure};
use oi_desktop_core::{
    BridgeCaller, CompositionReading, ContributionAvailability, DesktopHost, HostedContribution,
    KernelEvent, NativeContributionReading, PresenceState, ProviderClass, SemanticRef,
    SourceTreatment, WorldSourceError, WIKI_PROFILE,
};

/// Env is process-global and unit tests of one binary share it; the host
/// captures what it needs at construction, so construction is what is
/// serialised.
static ENV: Mutex<()> = Mutex::new(());

const WORK_LIST_BODY: &str = r#"{"ok":true,"data":{"items":[{"name":"o-i","path":"/central/Work/o-i"},{"name":"actuation","path":"/central/Work/actuation"}]}}"#;

const GROUND_BODY: &str = r#"{"ok":true,"data":{"project_root":"/central/Work/o-i","projectcentral_ready":true,"project_id":"o-i","human_source":"ProjectCentral/user","status":"established","recognised_sources":[{"ref":"project:o-i:ProjectCentral%2Fuser","path":"ProjectCentral/user","exists":true,"provenance":"human-authored","standing":"authoritative","roles":["project-human-source-aperture"],"treatment":"projectcentral-user","agent_retrieval_allowed":true}],"native_candidates":[],"skipped_sources":[],"account_handoff":{"preferred_authored_aperture":"ProjectCentral/user","recognised_human_sources":[],"other_source_relations":[],"agent_wiki_source":"ProjectCentral/agents/wiki/wiki.json","agent_wiki_space_ref":"okf-wiki:project:o-i","source_relations":"ProjectCentral/relations/source-relations.json","account_is_source":false,"html_is_source":false,"projection_is_source":false},"return_policy":{"difference_automatically_mutates_human_source":false,"agent_wiki_may_be_maintained_independently":true,"human_source_return":"proposal"},"next_actions":[]}}"#;

const SOURCE_READ_BODY: &str = r#"{"ok":true,"data":{"schema":"central.project-world-source-reading/v1","world_ref":"project:o-i","source":{"ref":"project:o-i:ProjectCentral%2Fuser","path":"ProjectCentral/user","roles":["project-human-source-aperture"],"provenance":"human-authored","standing":"authoritative","treatment":"projectcentral-user","agent_retrieval_allowed":true},"revision":{"revision":"r7","byte_len":12},"content":"hello ground","content_encoding":"utf-8","automatic_agent_or_model_invocation":false}}"#;

const SOURCE_WRITE_CHANGED_BODY: &str = r#"{"ok":true,"data":{"schema":"central.project-world-source-write-receipt/v1","world_ref":"project:o-i","source":{"ref":"project:o-i:ProjectCentral%2Fuser","path":"ProjectCentral/user","roles":[],"provenance":"human-authored","standing":"authoritative","treatment":"projectcentral-user","agent_retrieval_allowed":true},"previous_revision":"r7","revision":{"revision":"r8","byte_len":5},"changed":true,"change_ref":"change:1","actor":"human:desktop","actor_kind":"human","agent_session_ref":null,"automatic_agent_or_model_invocation":false}}"#;

const SOURCE_WRITE_UNCHANGED_BODY: &str = r#"{"ok":true,"data":{"schema":"central.project-world-source-write-receipt/v1","world_ref":"project:o-i","source":{"ref":"project:o-i:ProjectCentral%2Fuser","path":"ProjectCentral/user","roles":[],"provenance":"human-authored","standing":"authoritative","treatment":"projectcentral-user","agent_retrieval_allowed":true},"previous_revision":"r7","revision":{"revision":"r7","byte_len":5},"changed":false,"change_ref":null,"actor":"human:desktop","actor_kind":"human","agent_session_ref":null,"automatic_agent_or_model_invocation":false}}"#;

const SOURCE_WRITE_REFUSED_BODY: &str = r#"{"ok":false,"error":{"action":"projectcentral.source.write","status":"unavailable_capability","message":"source is authored human ground; agent-session writes propose rather than write"}}"#;

const WORLD_SOURCE_REF: &str = "project:o-i:ProjectCentral%2Fuser";

/// A fixture `ctrl` that answers the named owner Actions with JSON bodies. No
/// `--root` is passed, so `$4` is the action name.
fn fixture_ctrl(responses: &[(&str, &str)]) -> (std::path::PathBuf, std::path::PathBuf) {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = std::env::temp_dir().join(format!("oi-world-svc-{}-{nonce}", std::process::id()));
    fs::create_dir_all(&root).unwrap();
    let executable = root.join("ctrl-fixture");
    let staging = root.join("ctrl-fixture.staging");
    let mut script = String::from("#!/bin/sh\ncase \"$4\" in\n");
    for (index, (action, body)) in responses.iter().enumerate() {
        script.push_str(&format!(
            "  {action})\n    cat <<'BODY{index}'\n{body}\nBODY{index}\n    ;;\n"
        ));
    }
    script.push_str("  *) exit 7 ;;\nesac\n");
    fs::write(&staging, script).unwrap();
    let mut permissions = fs::metadata(&staging).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&staging, permissions).unwrap();
    fs::rename(&staging, &executable).unwrap();
    (root, executable)
}

fn with_env(vars: &[(&str, OsString)], build: impl FnOnce() -> DesktopHost) -> DesktopHost {
    let _guard = ENV.lock().unwrap();
    let previous = vars
        .iter()
        .map(|(key, _)| (*key, std::env::var_os(key)))
        .collect::<Vec<_>>();
    for (key, value) in vars {
        std::env::set_var(key, value);
    }
    let host = build();
    for (key, value) in previous {
        match value {
            Some(value) => std::env::set_var(key, value),
            None => std::env::remove_var(key),
        }
    }
    host
}

fn ground_dir(tag: &str) -> std::path::PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = std::env::temp_dir().join(format!("oi-world-ground-{tag}-{}-{nonce}", std::process::id()));
    fs::create_dir_all(root.join("oi-state")).unwrap();
    root
}

fn disclosure(states: &[NativeSurfaceState]) -> SuiteCompositionDisclosure {
    SuiteCompositionDisclosure {
        schema: "oi.desktop-composition-disclosure/v1".to_owned(),
        personal_ground: None,
        surfaces: states
            .iter()
            .enumerate()
            .map(|(index, state)| SurfaceDisclosure {
                id: ["central", "actuation"][index.min(1)].to_owned(),
                public_name: format!("surface{index}"),
                function: "fixture".to_owned(),
                repository: "https://example.invalid".to_owned(),
                native_entry: "entry".to_owned(),
                accepted_revision: String::new(),
                canonical_namespace: "namespace".to_owned(),
                compatibility_aliases: Vec::new(),
                version_command: Vec::new(),
                capability_command: Vec::new(),
                verification_command: Vec::new(),
                state: *state,
                resolved: None,
                version: None,
                detail: None,
            })
            .collect(),
        warnings: Vec::new(),
    }
}

fn fixture_hosted(owner: &str) -> HostedContribution {
    oi_desktop_core::host_native_contribution(
        None,
        NativeContributionReading {
            schema: "oi.desktop-host-reading/v1".to_owned(),
            contribution_ref: format!("{owner}.reading/root"),
            native_owner: owner.to_owned(),
            target_contract: Some(format!("{owner}.contract/v1")),
            availability: ContributionAvailability::Ready,
            provenance: oi_desktop_core::RefProvenance {
                source: "fixture".to_owned(),
                revision: None,
            },
            regions: Vec::new(),
            read_model_ref: Some(SemanticRef {
                ref_id: format!("{owner}.reading/root"),
                kind: "reading".to_owned(),
                native_owner: owner.to_owned(),
                provenance: oi_desktop_core::RefProvenance {
                    source: "fixture".to_owned(),
                    revision: None,
                },
            }),
            accepted_selection_kinds: Vec::new(),
            actions: Vec::new(),
            detail: None,
        },
    )
    .unwrap()
}

fn world_source_subject() -> SemanticRef {
    SemanticRef {
        ref_id: WORLD_SOURCE_REF.to_owned(),
        kind: "file".to_owned(),
        native_owner: "central".to_owned(),
        provenance: oi_desktop_core::RefProvenance {
            source: "world tree".to_owned(),
            revision: None,
        },
    }
}

#[test]
fn the_world_tree_reading_is_a_projection_with_distinct_selection_facts() {
    let ground = ground_dir("tree");
    let (fixture_root, executable) = fixture_ctrl(&[
        ("work.list", WORK_LIST_BODY),
        ("projectcentral.ground.inspect", GROUND_BODY),
    ]);
    let mut host = with_env(
        &[
            ("OI_HOME", ground.join("oi-state").into_os_string()),
            ("OI_CENTRAL_CTRL_BIN", executable.into_os_string()),
        ],
        || {
            let mut disclosure = disclosure(&[NativeSurfaceState::Registered]);
            disclosure.personal_ground = Some(ground.display().to_string());
            DesktopHost::new(disclosure)
        },
    );

    // A sandboxed contribution may not read the World either.
    assert!(host.world_tree(BridgeCaller::SandboxedContribution).is_err());

    let tree = host.world_tree(BridgeCaller::ShellUi).unwrap();
    let root = tree.root.as_ref().expect("recognition established a World");
    assert_eq!(root.world.ref_id(), "world:personal");
    assert!(root.access.exists, "the root is present");
    assert!(
        !root.access.selected && !root.access.projected && !root.access.public,
        "an unselected node is present as omitted, never as missing"
    );
    assert_eq!(
        root.children
            .iter()
            .map(|node| node.world.ref_id())
            .collect::<Vec<_>>(),
        vec!["world:project:o-i", "world:project:actuation"]
    );

    // Nothing is focused yet, so no project's ground has been asked for: the
    // nodes are present, unenriched, and nothing is fabricated for them.
    let unenriched = root.find("world:project:o-i").unwrap();
    assert!(unenriched.wiki.is_none() && unenriched.sources.is_empty());
    // Reading the tree is not a selection: the focus relation is untouched.
    assert!(host.focus().subject_ref().is_none());
    assert!(host.focus().project_ref().is_none());

    // Opening the project World binds the current Project relation (resolved
    // through this very Projection), and the next reading then carries that
    // project's owner-declared ground, treatment verbatim, and Wiki; the root
    // Wiki federates it. The project nobody addressed stays unenriched.
    open_project_world(&mut host);
    assert_eq!(host.focus().project_ref().unwrap().ref_id, "world:project:o-i");
    let tree = host.world_tree(BridgeCaller::ShellUi).unwrap();
    let root = tree.root.as_ref().unwrap();
    let project = root.find("world:project:o-i").unwrap();
    let wiki = project.wiki.as_ref().expect("Central disclosed the Wiki");
    assert_eq!(wiki.profile, WIKI_PROFILE);
    assert_eq!(wiki.wiki_ref.as_deref(), Some("okf-wiki:project:o-i"));
    assert_eq!(
        root.wiki.as_ref().unwrap().federates,
        vec!["world:project:o-i".to_owned()],
        "the root Wiki federates the project Wikis (01 §2)"
    );
    let source = &project.sources[0];
    assert_eq!(
        source.treatment,
        SourceTreatment::Owner("projectcentral-user".to_owned()),
        "the owner's declared treatment is preserved verbatim, never coerced into a desktop noun"
    );
    assert!(source.access.readable && source.access.retrievable);
    assert!(!source.access.selected, "disclosure is not selection");

    let other = root.find("world:project:actuation").unwrap();
    assert!(other.wiki.is_none() && other.sources.is_empty());

    // The reading survives the wire whole: an agent reads the same Projection.
    let value = serde_json::to_value(&tree).unwrap();
    assert_eq!(value["schema"], "oi.world-tree/v1");
    let restored: oi_desktop_core::WorldTreeReading = serde_json::from_value(value).unwrap();
    assert_eq!(restored, tree);

    fs::remove_dir_all(fixture_root).unwrap();
    fs::remove_dir_all(ground).unwrap();
}

#[test]
fn the_tree_degrades_locally_when_central_does_not_answer() {
    let ground = ground_dir("degrade");
    let host = with_env(
        &[
            ("OI_HOME", ground.join("oi-state").into_os_string()),
            (
                "OI_CENTRAL_CTRL_BIN",
                OsString::from("/nonexistent/oi-fixture-ctrl"),
            ),
        ],
        || {
            let mut disclosure = disclosure(&[NativeSurfaceState::Registered]);
            disclosure.personal_ground = Some(ground.display().to_string());
            DesktopHost::new(disclosure)
        },
    );
    let mut host = host;
    let tree = host.world_tree(BridgeCaller::ShellUi).unwrap();
    let root = tree.root.as_ref().expect("recognition still holds the root");
    assert!(
        root.children.is_empty(),
        "the project level is not fabricated when its seam cannot answer"
    );
    assert!(root.wiki.is_none(), "no Wiki is invented without an owner reading");
    assert!(
        tree.warnings
            .iter()
            .any(|warning| warning.contains("work.list unavailable")),
        "the unavailable seam is disclosed, locally: {:?}",
        tree.warnings
    );

    fs::remove_dir_all(ground).unwrap();
}

#[test]
fn opening_a_subject_selects_it_reads_it_and_never_projects_its_root() {
    let ground = ground_dir("open");
    let (_, executable) = fixture_ctrl(&[
        ("work.list", WORK_LIST_BODY),
        ("projectcentral.ground.inspect", GROUND_BODY),
        ("projectcentral.source.read", SOURCE_READ_BODY),
    ]);
    let mut host = with_env(
        &[
            ("OI_HOME", ground.join("oi-state").into_os_string()),
            ("OI_CENTRAL_CTRL_BIN", executable.into_os_string()),
        ],
        || {
            let mut disclosure = disclosure(&[NativeSurfaceState::Registered]);
            disclosure.personal_ground = Some(ground.display().to_string());
            DesktopHost::new(disclosure)
        },
    );

    // The project World node is opened first: it binds the current Project
    // relation resolved through the tree, and becomes the one focus.
    let opened = host
        .open_subject(
            BridgeCaller::ShellUi,
            SemanticRef {
                ref_id: "world:project:o-i".to_owned(),
                kind: "project".to_owned(),
                native_owner: "central".to_owned(),
                provenance: oi_desktop_core::RefProvenance {
                    source: "world tree".to_owned(),
                    revision: None,
                },
            },
        )
        .unwrap();
    assert_eq!(opened.focus_event.expect("the relation moved").tag(), "focus_changed");
    assert_eq!(
        host.focus().project_ref().unwrap().ref_id,
        "world:project:o-i",
        "the Project relation is kernel state, resolved through the Projection"
    );

    // Opening one source of that project selects that source — and nothing
    // else. The root is not projected, no other node is selected.
    let opened = host
        .open_subject(BridgeCaller::ShellUi, world_source_subject())
        .unwrap();
    assert_eq!(
        opened.focus_event.expect("the focus moved").tag(),
        "focus_changed"
    );
    let reading = opened.reading;
    assert_eq!(reading.provider.class, ProviderClass::LiveProvider);
    assert_eq!(reading.content.as_deref(), Some("hello ground"));
    assert_eq!(reading.revision.as_deref(), Some("r7"));
    assert!(reading.access.selected, "the kernel op that moves focus selects");
    assert!(reading.access.retrievable, "Central's own gate admits this source");
    assert!(!reading.access.projected && !reading.access.public);

    let tree = host.world_tree(BridgeCaller::ShellUi).unwrap();
    let root = tree.root.as_ref().unwrap();
    assert!(
        !root.access.selected && !root.access.projected,
        "selecting one file never selects or projects its root"
    );
    let other = root.find("world:project:actuation").unwrap();
    assert!(!other.access.selected, "no sibling is selected by contagion");

    // A subject of another owner is never interpreted. The kernel still holds
    // it as focus — a ref is a ref — and the reading honestly says unserved.
    let foreign = host
        .open_subject(
            BridgeCaller::ShellUi,
            SemanticRef {
                ref_id: "factory.run/184".to_owned(),
                kind: "run".to_owned(),
                native_owner: "software-factory".to_owned(),
                provenance: oi_desktop_core::RefProvenance {
                    source: "factory".to_owned(),
                    revision: None,
                },
            },
        )
        .unwrap();
    assert_eq!(foreign.reading.provider.class, ProviderClass::Unobserved);
    assert!(foreign.reading.content.is_none());
    assert_eq!(foreign.reading.subject.ref_id, "factory.run/184");

    // And a sandboxed contribution may open nothing at all.
    let denied = host.open_subject(BridgeCaller::SandboxedContribution, world_source_subject());
    assert!(denied.is_err(), "the bridge still gates who may ask");

    fs::remove_dir_all(ground).unwrap();
}

#[test]
fn a_world_source_write_goes_through_central_and_emits_source_changed_only_on_change() {
    let ground = ground_dir("write");
    let (fixture_root, executable) = fixture_ctrl(&[
        ("work.list", WORK_LIST_BODY),
        ("projectcentral.ground.inspect", GROUND_BODY),
        ("projectcentral.source.read", SOURCE_READ_BODY),
        ("projectcentral.source.write", SOURCE_WRITE_CHANGED_BODY),
    ]);
    let mut host = with_env(
        &[
            ("OI_HOME", ground.join("oi-state").into_os_string()),
            ("OI_CENTRAL_CTRL_BIN", executable.into_os_string()),
        ],
        || {
            let mut disclosure = disclosure(&[NativeSurfaceState::Registered]);
            disclosure.personal_ground = Some(ground.display().to_string());
            DesktopHost::new(disclosure)
        },
    );
    host.open_subject(
        BridgeCaller::ShellUi,
        SemanticRef {
            ref_id: "world:project:o-i".to_owned(),
            kind: "project".to_owned(),
            native_owner: "central".to_owned(),
            provenance: oi_desktop_core::RefProvenance {
                source: "world tree".to_owned(),
                revision: None,
            },
        },
    )
    .unwrap();

    let outcome = host
        .save_subject(
            BridgeCaller::ShellUi,
            WORLD_SOURCE_REF,
            "r7",
            "the person's next words",
            "human:desktop",
        )
        .expect("Central accepted the write");
    assert!(outcome.changed);
    let KernelEvent::SourceChanged { source, summary } =
        outcome.event.expect("a recorded change emits the event") else {
        panic!("expected SourceChanged");
    };
    assert_eq!(source.ref_id, WORLD_SOURCE_REF);
    assert_eq!(source.provenance.revision.as_deref(), Some("r8"));
    assert!(summary.contains("Central"), "the event names the owner seam: {summary}");

    // A sandboxed contribution may write nothing.
    let denied = host.save_subject(
        BridgeCaller::SandboxedContribution,
        WORLD_SOURCE_REF,
        "r8",
        "nope",
        "human:desktop",
    );
    assert!(matches!(denied, Err(WorldSourceError::Denied(_))));

    fs::remove_dir_all(fixture_root).unwrap();
    fs::remove_dir_all(ground).unwrap();
}

#[test]
fn a_write_that_changes_nothing_emits_nothing() {
    let ground = ground_dir("unchanged");
    let (fixture_root, unchanged_ctrl) = fixture_ctrl(&[
        ("work.list", WORK_LIST_BODY),
        ("projectcentral.ground.inspect", GROUND_BODY),
        ("projectcentral.source.read", SOURCE_READ_BODY),
        ("projectcentral.source.write", SOURCE_WRITE_UNCHANGED_BODY),
    ]);
    let mut host = with_env(
        &[
            ("OI_HOME", ground.join("oi-state").into_os_string()),
            ("OI_CENTRAL_CTRL_BIN", unchanged_ctrl.into_os_string()),
        ],
        || {
            let mut disclosure = disclosure(&[NativeSurfaceState::Registered]);
            disclosure.personal_ground = Some(ground.display().to_string());
            DesktopHost::new(disclosure)
        },
    );
    open_project_world(&mut host);

    let outcome = host
        .save_subject(BridgeCaller::ShellUi, WORLD_SOURCE_REF, "r7", "the same words", "human:desktop")
        .expect("Central accepted the write");
    assert!(!outcome.changed);
    assert!(
        outcome.event.is_none(),
        "no kernel state changed, so no event is emitted"
    );

    fs::remove_dir_all(fixture_root).unwrap();
    fs::remove_dir_all(ground).unwrap();
}

#[test]
fn a_conflict_is_settled_by_revision_and_an_owner_refusal_is_returned_as_it_stands() {
    // Central refuses the write because the source moved; the kernel settles
    // it by re-reading the revision, never by parsing conflict prose.
    let ground = ground_dir("conflict");
    let moved = SOURCE_READ_BODY.replace("\"revision\":\"r7\"", "\"revision\":\"r9\"");
    let refused_write = r#"{"ok":false,"error":{"action":"projectcentral.source.write","status":"invalid_input","message":"World source revision conflict: expected r7, current r9"}}"#;
    let (fixture_root, conflict_ctrl) = fixture_ctrl(&[
        ("work.list", WORK_LIST_BODY),
        ("projectcentral.ground.inspect", GROUND_BODY),
        ("projectcentral.source.read", moved.as_str()),
        ("projectcentral.source.write", refused_write),
    ]);
    let mut host = with_env(
        &[
            ("OI_HOME", ground.join("oi-state").into_os_string()),
            ("OI_CENTRAL_CTRL_BIN", conflict_ctrl.into_os_string()),
        ],
        || {
            let mut disclosure = disclosure(&[NativeSurfaceState::Registered]);
            disclosure.personal_ground = Some(ground.display().to_string());
            DesktopHost::new(disclosure)
        },
    );
    open_project_world(&mut host);
    let error = host
        .save_subject(BridgeCaller::ShellUi, WORLD_SOURCE_REF, "r7", "next", "human:desktop")
        .unwrap_err();
    let WorldSourceError::Conflict {
        expected_revision,
        current_revision,
        ..
    } = error
    else {
        panic!("expected a revision conflict, got {error}");
    };
    assert_eq!(expected_revision, "r7");
    assert_eq!(current_revision, "r9");
    fs::remove_dir_all(fixture_root).unwrap();
    fs::remove_dir_all(ground).unwrap();

    // A refusal that is not a conflict comes back as the owner stated it.
    let ground = ground_dir("refusal");
    let (fixture_root, refused_ctrl) = fixture_ctrl(&[
        ("work.list", WORK_LIST_BODY),
        ("projectcentral.ground.inspect", GROUND_BODY),
        ("projectcentral.source.read", SOURCE_READ_BODY),
        ("projectcentral.source.write", SOURCE_WRITE_REFUSED_BODY),
    ]);
    let mut host = with_env(
        &[
            ("OI_HOME", ground.join("oi-state").into_os_string()),
            ("OI_CENTRAL_CTRL_BIN", refused_ctrl.into_os_string()),
        ],
        || {
            let mut disclosure = disclosure(&[NativeSurfaceState::Registered]);
            disclosure.personal_ground = Some(ground.display().to_string());
            DesktopHost::new(disclosure)
        },
    );
    open_project_world(&mut host);
    let error = host
        .save_subject(BridgeCaller::ShellUi, WORLD_SOURCE_REF, "r7", "next", "human:desktop")
        .unwrap_err();
    let WorldSourceError::Owner(message) = error else {
        panic!("expected the owner refusal, got {error}");
    };
    assert!(message.contains("authored human ground"));
    fs::remove_dir_all(fixture_root).unwrap();
    fs::remove_dir_all(ground).unwrap();
}

/// Open the project World node, so the current Project relation is bound the
/// way the design binds it: through the Projection, then through focus.
fn open_project_world(host: &mut DesktopHost) {
    host.open_subject(
        BridgeCaller::ShellUi,
        SemanticRef {
            ref_id: "world:project:o-i".to_owned(),
            kind: "project".to_owned(),
            native_owner: "central".to_owned(),
            provenance: oi_desktop_core::RefProvenance {
                source: "world tree".to_owned(),
                revision: None,
            },
        },
    )
    .unwrap();
}

#[test]
fn the_composition_reading_reports_presence_degradation_and_absence_as_observed() {
    let ground = ground_dir("composition");
    let host = with_env(
        &[("OI_HOME", ground.join("oi-state").into_os_string())],
        || {
            let mut disclosure = disclosure(&[NativeSurfaceState::Registered, NativeSurfaceState::Missing]);
            disclosure.personal_ground = Some(ground.display().to_string());
            disclosure.surfaces[0].capability_command = vec!["capabilities".to_owned()];
            DesktopHost::new(disclosure)
        },
    );
    let hosted = vec![fixture_hosted("factory")];
    let reading: CompositionReading = host
        .composition_reading(BridgeCaller::ShellUi, &hosted)
        .unwrap();

    let owner = |name: &str| {
        reading
            .constituents
            .iter()
            .find(|constituent| constituent.native_owner == name)
            .unwrap()
            .clone()
    };

    // Recognition answered live for this owner, so it may claim live.
    let central = owner("central");
    assert_eq!(central.provider_class, ProviderClass::Recognition);
    assert_eq!(central.state, PresenceState::Present);
    assert!(
        !central.capabilities.is_empty(),
        "the capability descriptors behind the presence are disclosed"
    );

    // A missing registration is an observed absence, never an error.
    assert_eq!(owner("actuation").state, PresenceState::Absent);

    // The fixture discloses an owner nothing observed: Degraded, named as a
    // fixture, never a presence source.
    let factory = owner("factory");
    assert_eq!(factory.state, PresenceState::Degraded);
    assert_eq!(factory.provider_class, ProviderClass::Fixture);
    assert!(!factory.provider_class.claims_live());
    assert!(
        reading
            .warnings
            .iter()
            .any(|warning| warning.contains("factory.reading/root")),
        "the fixture fallback is disclosed: {:?}",
        reading.warnings
    );

    assert!(
        host.composition_reading(BridgeCaller::SandboxedContribution, &hosted)
            .is_err(),
        "a sandboxed contribution may not read the composition either"
    );

    fs::remove_dir_all(ground).unwrap();
}
