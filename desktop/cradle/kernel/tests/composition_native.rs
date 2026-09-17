//! Actual installed/candidate S commands; no mock executables or fixture states.
#[path = "../src/composition.rs"]
mod composition;

#[test]
#[ignore = "requires explicit OI_BIN pointing to an actual built S executable"]
fn actual_suite_composition_preserves_native_evidence() {
    let executable = std::env::var_os("OI_BIN").expect("set OI_BIN to the real suite candidate");
    let cwd = std::env::current_dir().unwrap();
    let reading = composition::Client::discover().read(&cwd);
    assert_eq!(
        reading.suite_executable,
        std::path::PathBuf::from(executable)
    );
    assert!(
        reading.current_world.error.is_none(),
        "{:?}",
        reading.current_world.error
    );
    assert!(reading.status.error.is_none(), "{:?}", reading.status.error);
    assert_eq!(reading.positions.len(), 6);
    for position in &reading.positions {
        let original = reading.current_world.data.as_ref().unwrap()["positions"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["product_id"] == position.product_id)
            .unwrap();
        assert_eq!(&position.current_world, original);
        assert_eq!(position.native_state, original["state"].as_str().unwrap());
        assert_eq!(position.status.as_ref().unwrap()["id"], position.product_id);
        if matches!(position.native_state.as_str(), "installed" | "registered") {
            assert_eq!(position.availability, composition::Availability::Discovered);
        }
    }
    // Serializable projection retains the complete underlying source documents.
    let roundtrip: composition::Reading =
        serde_json::from_value(serde_json::to_value(&reading).unwrap()).unwrap();
    assert_eq!(roundtrip, reading);
}
