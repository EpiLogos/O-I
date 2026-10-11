//! Native owner's current-machine relation and runtime qualifier, using actual
//! installed material. No fabricated app or substituted owner command.
#[path = "../src/runtime.rs"]
mod runtime;

#[test]
fn reads_actual_current_machine_binding_through_native_suite() {
    let executable = std::env::var_os("OI_TEST_SUITE_CLI")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| "/Users/admin/.local/bin/oi".into());
    let world = runtime::current_world(&executable).unwrap();
    let ground = world["personal_ground"].as_str().unwrap();
    let source = world["current_machine"]["central_source"].as_str().unwrap();
    let machine: serde_json::Value = serde_json::from_slice(
        &std::fs::read(std::path::Path::new(ground).join(source)).unwrap(),
    ).unwrap();
    let declared = machine["bindings"].as_array().unwrap().iter()
        .find(|binding| binding["kind"] == "workcell").unwrap();
    assert_eq!(world["current_machine"]["workcell_ref"], declared["reference"]);
}

#[test]
fn refuses_everyday_application_as_unqualified_candidate() {
    let app = std::path::Path::new("/Users/admin/Applications/O-I.app");
    let footprint = std::fs::read(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../desktop/install-footprint.json"),
    ).unwrap();
    assert!(runtime::qualify(app, &footprint).is_err());
}
