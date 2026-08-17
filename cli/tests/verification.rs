use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use tempfile::TempDir;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

fn oi() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_oi"))
}

fn run(temp: &TempDir, catalog: &Path, args: &[&str]) -> Output {
    Command::new(oi())
        .args(args)
        .env("OI_HOME", temp.path())
        .env("OI_TEST_SURFACE_CATALOG", catalog)
        .output()
        .expect("oi should run")
}

#[cfg(unix)]
fn fake_native(path: &Path) {
    fs::write(
        path,
        r#"#!/bin/sh
if [ "${1:-}" = "--version" ]; then
  printf '%s\n' 'fake 1.0.0'
  exit 0
fi
printf '%s\n' '{"status":"success","evidence":"native"}'
"#,
    )
    .unwrap();
    let mut permissions = fs::metadata(path).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).unwrap();
}

fn write_fixture_catalog(temp: &TempDir) -> PathBuf {
    let catalog = temp.path().join("surfaces.json");
    fs::write(
        &catalog,
        serde_json::to_vec_pretty(&json!({
            "schema": 1,
            "verified_at": "fixture",
            "surfaces": [
                {
                    "id": "fake",
                    "public_name": "Fake Native",
                    "function": "deterministic fixture",
                    "repository": "https://example.invalid/fake",
                    "docs_ref": "main",
                    "docs_path": "README.md",
                    "skill_paths": [],
                    "native": {
                        "kind": "cli",
                        "entry": "fake",
                        "executable": "fake",
                        "alias": "fake"
                    },
                    "install": {
                        "kind": "fixture",
                        "note": "fixture only"
                    },
                    "verification": {
                        "status": "supported",
                        "operation": {
                            "id": "fake.self-check",
                            "runner": "native-executable",
                            "args": ["self-check", "--json"],
                            "evidence": "fixture-json"
                        },
                        "outstanding_requirements": []
                    },
                    "compatibility": "fixture compatibility"
                },
                {
                    "id": "physical",
                    "public_name": "Physical Native",
                    "function": "physical fixture",
                    "repository": "https://example.invalid/physical",
                    "docs_ref": "main",
                    "docs_path": "README.md",
                    "skill_paths": [],
                    "native": {
                        "kind": "cli",
                        "entry": "physical",
                        "executable": "physical",
                        "alias": null
                    },
                    "install": {
                        "kind": "fixture",
                        "note": "fixture only"
                    },
                    "verification": {
                        "status": "physical-gated",
                        "operation": null,
                        "outstanding_requirements": [
                            {
                                "kind": "physical",
                                "id": "fixture-machine",
                                "description": "requires the fixture machine"
                            }
                        ],
                        "note": "physical fixture is intentionally gated"
                    },
                    "compatibility": "fixture compatibility"
                }
            ]
        }))
        .unwrap(),
    )
    .unwrap();
    catalog
}

#[cfg(unix)]
#[test]
fn snapshot_and_receipt_preserve_native_result_and_physical_gate() {
    let temp = TempDir::new().unwrap();
    let catalog = write_fixture_catalog(&temp);
    let fake = temp.path().join("fake");
    let physical = temp.path().join("physical");
    fake_native(&fake);
    fake_native(&physical);

    fs::write(
        temp.path().join("composition.json"),
        serde_json::to_vec_pretty(&json!({
            "schema": 1,
            "modules": {
                "fake": {
                    "id": "fake",
                    "public_name": "Fake Native",
                    "native_executable": fake,
                    "alias": "fake",
                    "version": "fake 1.0.0",
                    "docs": "fixture://fake"
                },
                "physical": {
                    "id": "physical",
                    "public_name": "Physical Native",
                    "native_executable": physical,
                    "version": "fake 1.0.0",
                    "docs": "fixture://physical"
                }
            }
        }))
        .unwrap(),
    )
    .unwrap();

    let snapshot = temp.path().join("suite.json");
    let snapshot_output = run(
        &temp,
        &catalog,
        &[
            "snapshot",
            "--output",
            snapshot.to_str().unwrap(),
            "--accepted-mainline",
            "fake=fake 1.0.0",
            "--accept-compatibility",
            "fake=native-contract-v1",
        ],
    );
    assert!(
        snapshot_output.status.success(),
        "{}",
        String::from_utf8_lossy(&snapshot_output.stderr)
    );

    let receipt = temp.path().join("receipt.json");
    let verify = run(
        &temp,
        &catalog,
        &[
            "verify",
            "--snapshot",
            snapshot.to_str().unwrap(),
            "--receipt",
            receipt.to_str().unwrap(),
            "--json",
        ],
    );
    assert_eq!(verify.status.code(), Some(3));
    let report: serde_json::Value = serde_json::from_slice(&verify.stdout).unwrap();
    assert_eq!(report["kind"], "oi.composition-receipt/v1");
    assert_eq!(report["result"], "incomplete");

    let fake_result = report["surfaces"]
        .as_array()
        .unwrap()
        .iter()
        .find(|surface| surface["id"] == "fake")
        .unwrap();
    assert_eq!(fake_result["status"], "passed");
    assert_eq!(fake_result["verification_operation"], "fake.self-check");
    assert_eq!(fake_result["evidence"]["exit_code"], 0);
    assert_eq!(
        fake_result["accepted_compatibility"][0],
        "native-contract-v1"
    );

    let physical_result = report["surfaces"]
        .as_array()
        .unwrap()
        .iter()
        .find(|surface| surface["id"] == "physical")
        .unwrap();
    assert_eq!(physical_result["status"], "skipped_physical_gated");
    assert_eq!(report["outstanding_requirements"][0]["kind"], "physical");

    let stored: serde_json::Value = serde_json::from_slice(&fs::read(receipt).unwrap()).unwrap();
    assert_eq!(stored["result"], report["result"]);
}

#[cfg(unix)]
#[test]
fn snapshot_revision_mismatch_is_incompatible_not_failed_native_health() {
    let temp = TempDir::new().unwrap();
    let catalog = write_fixture_catalog(&temp);
    let fake = temp.path().join("fake");
    fake_native(&fake);

    fs::write(
        temp.path().join("composition.json"),
        serde_json::to_vec_pretty(&json!({
            "schema": 1,
            "modules": {
                "fake": {
                    "id": "fake",
                    "public_name": "Fake Native",
                    "native_executable": fake,
                    "alias": "fake",
                    "version": "fake 1.0.0",
                    "docs": "fixture://fake"
                }
            }
        }))
        .unwrap(),
    )
    .unwrap();

    let snapshot = temp.path().join("mismatch.json");
    let created = run(
        &temp,
        &catalog,
        &[
            "snapshot",
            "--output",
            snapshot.to_str().unwrap(),
            "--select",
            "fake=fake 2.0.0",
        ],
    );
    assert!(created.status.success());

    let verify = run(
        &temp,
        &catalog,
        &["verify", "--snapshot", snapshot.to_str().unwrap(), "--json"],
    );
    assert_eq!(verify.status.code(), Some(1));
    let report: serde_json::Value = serde_json::from_slice(&verify.stdout).unwrap();
    let fake_result = report["surfaces"]
        .as_array()
        .unwrap()
        .iter()
        .find(|surface| surface["id"] == "fake")
        .unwrap();
    assert_eq!(fake_result["status"], "incompatible");
    assert!(fake_result["evidence"].is_null());
}
