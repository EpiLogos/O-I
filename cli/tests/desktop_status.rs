use oi_cli::status::{disclosure_from_json, NativeSurfaceState};

const CATALOG: &str = r#"{
  "schema": 1,
  "surfaces": [
    {"id":"central","public_name":"Central","function":"ground","repository":"central","native":{"kind":"cli","entry":"ctrl","executable":"ctrl"}},
    {"id":"factory","public_name":"Factory","function":"build","repository":"factory","native":{"kind":"workbench","entry":"source","executable":null}}
  ]
}"#;

#[test]
fn disclosure_distinguishes_empty_installed_registered_and_broken_without_native_health_claims() {
    let empty = disclosure_from_json(CATALOG, None, |_| None, |_| false).unwrap();
    assert!(empty
        .surfaces
        .iter()
        .all(|surface| surface.state == NativeSurfaceState::Missing));

    let installed = disclosure_from_json(
        CATALOG,
        None,
        |candidate| (candidate == "ctrl").then(|| "/bin/ctrl".into()),
        |_| false,
    )
    .unwrap();
    assert_eq!(installed.surfaces[0].state, NativeSurfaceState::Installed);

    let registered = r#"{
      "schema":1,
      "personal_ground":"/Central",
      "modules":{
        "central":{"native_executable":"/bin/ctrl","version":"ctrl 1","root":null},
        "factory":{"native_executable":null,"version":null,"root":"/factory"}
      }
    }"#;
    let full = disclosure_from_json(
        CATALOG,
        Some(registered),
        |candidate| (candidate == "/bin/ctrl").then(|| candidate.into()),
        |root| root == "/factory",
    )
    .unwrap();
    assert!(full
        .surfaces
        .iter()
        .all(|surface| surface.state == NativeSurfaceState::Registered));

    let broken = disclosure_from_json(CATALOG, Some(registered), |_| None, |_| false).unwrap();
    assert!(broken
        .surfaces
        .iter()
        .all(|surface| surface.state == NativeSurfaceState::Broken));
}

/// A component product (suite manifest artifact kind "component") registers
/// with no native executable and a material root: present material reads
/// installed_component, damaged material stays broken, and a recorded
/// command that vanished stays broken (campaign finding 3, 2026-09-14).
#[test]
fn component_install_reads_installed_component_and_damage_stays_broken() {
    const COMPONENT_CATALOG: &str = r#"{
      "schema": 1,
      "surfaces": [
        {"id":"actuation","public_name":"Actuation","function":"agency","repository":"actuation","native":{"kind":"cli","entry":"actuation","executable":"actuation"}}
      ]
    }"#;
    let component = r#"{
      "schema":1,
      "modules":{
        "actuation":{"native_executable":null,"version":"actuation 0.1.0 (03e03ac)","root":"/managed/actuation/03e03ac"}
      }
    }"#;

    // Present component material: installed_component, resolved to the root.
    let installed = disclosure_from_json(
        COMPONENT_CATALOG,
        Some(component),
        // Nothing on PATH, exactly the component-only target case.
        |_| None,
        |root| root == "/managed/actuation/03e03ac",
    )
    .unwrap();
    let actuation = &installed.surfaces[0];
    assert_eq!(actuation.state, NativeSurfaceState::InstalledComponent);
    assert_eq!(
        actuation.resolved.as_deref(),
        Some("/managed/actuation/03e03ac")
    );
    let detail = actuation.detail.as_deref().unwrap_or_default();
    assert!(
        detail.contains("component material") && detail.contains("no native actuation command"),
        "the per-surface unavailability must be disclosed: {detail}"
    );

    // Damaged install: the recorded material root is gone — broken.
    let damaged =
        disclosure_from_json(COMPONENT_CATALOG, Some(component), |_| None, |_| false).unwrap();
    assert_eq!(damaged.surfaces[0].state, NativeSurfaceState::Broken);
    let detail = damaged.surfaces[0].detail.as_deref().unwrap_or_default();
    assert!(
        detail.contains("material root is missing"),
        "the damage must be named: {detail}"
    );

    // A recorded command that cannot be resolved is damage, whatever the
    // root says — the install promised an executable and it is gone.
    let with_command = r#"{
      "schema":1,
      "modules":{
        "actuation":{"native_executable":"/bin/actuation","root":"/managed/actuation/03e03ac"}
      }
    }"#;
    let broken =
        disclosure_from_json(COMPONENT_CATALOG, Some(with_command), |_| None, |_| true).unwrap();
    assert_eq!(broken.surfaces[0].state, NativeSurfaceState::Broken);
    assert_eq!(
        broken.surfaces[0].detail.as_deref(),
        Some("registered native executable cannot be resolved")
    );
}
