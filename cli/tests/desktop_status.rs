use oi_cli::status::{disclosure_from_json, NativeSurfaceState};

const CATALOG: &str = r#"{
  "schema": 1,
  "surfaces": [
    {
      "id":"central",
      "public_name":"Central",
      "function":"ground",
      "repository":"central",
      "native":{
        "kind":"cli",
        "entry":"ctrl",
        "executable":"ctrl",
        "canonical_namespace":"central",
        "compatibility_aliases":["ctrl"],
        "structured_output":{"supported":true,"format":"json"}
      },
      "install":{"revision":"central-accepted"},
      "verification":{"operation":{"args":["doctor","--json"]}}
    },
    {
      "id":"factory",
      "public_name":"Factory",
      "function":"build",
      "repository":"factory",
      "native":{
        "kind":"workbench",
        "entry":"source",
        "executable":null,
        "canonical_namespace":"factory",
        "compatibility_aliases":[],
        "structured_output":{"supported":true,"format":"json"}
      },
      "install":{"revision":"factory-accepted"},
      "verification":{"operation":{"args":["verify","--json"]}}
    }
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
    assert_eq!(installed.surfaces[0].canonical_namespace, "central");
    assert_eq!(installed.surfaces[0].accepted_revision, "central-accepted");

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
