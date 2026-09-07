use std::fs;
use std::path::Path;
use std::process::Command;
use tempfile::TempDir;

fn oi(home: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
    command.env("OI_HOME", home);
    command
}

fn embedded_catalogue() -> String {
    fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../surfaces.json")).unwrap()
}

#[test]
fn catalogue_defaults_to_the_embedded_snapshot_and_discloses_it() {
    let home = TempDir::new().unwrap();
    let output = oi(home.path())
        .args(["catalogue", "show", "--json"])
        .output()
        .unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(
        stdout.contains("\"origin\":\"embedded\""),
        "stdout: {stdout}"
    );
}

#[test]
fn catalogue_adopt_moves_identity_claims_to_the_runtime_file() {
    let home = TempDir::new().unwrap();
    let source = home.path().join("surfaces.json");
    fs::write(&source, embedded_catalogue()).unwrap();

    let adopt = oi(home.path())
        .args(["catalogue", "adopt"])
        .arg(&source)
        .output()
        .unwrap();
    assert!(
        adopt.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&adopt.stderr)
    );

    let state = home.path().join("catalogue.json");
    assert!(
        state.exists(),
        "adopted catalogue must land in the state dir"
    );

    let show = oi(home.path())
        .args(["catalogue", "show", "--json"])
        .output()
        .unwrap();
    let stdout = String::from_utf8(show.stdout).unwrap();
    assert!(
        stdout.contains("\"origin\":\"runtime\""),
        "stdout: {stdout}"
    );
    assert!(
        stdout.contains(state.display().to_string().trim_start_matches('/')),
        "stdout: {stdout}"
    );

    let products = oi(home.path()).args(["products"]).output().unwrap();
    assert!(products.status.success());
    assert!(String::from_utf8(products.stdout)
        .unwrap()
        .contains("accepted-main"));
}

#[test]
fn catalogue_adopt_refuses_invalid_catalogues_without_writing_state() {
    let home = TempDir::new().unwrap();
    let source = home.path().join("bad.json");
    fs::write(&source, "{ not json").unwrap();

    let adopt = oi(home.path())
        .args(["catalogue", "adopt"])
        .arg(&source)
        .output()
        .unwrap();
    assert!(!adopt.status.success());
    assert!(!home.path().join("catalogue.json").exists());
}

#[test]
fn an_invalid_runtime_catalogue_fails_loud_rather_than_falling_back() {
    let home = TempDir::new().unwrap();
    let bad = home.path().join("bad.json");
    fs::write(&bad, "{ not json").unwrap();

    let output = oi(home.path())
        .env("OI_CATALOG", &bad)
        .args(["products"])
        .output()
        .unwrap();
    assert!(
        !output.status.success(),
        "an unreadable runtime catalogue must fail, not fall back"
    );
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert!(stderr.contains("invalid JSON"), "stderr: {stderr}");
}
