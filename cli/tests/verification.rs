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

// --- Installed-suite verification scope (#268) ------------------------------
//
// `oi verify` / `oi doctor` answer "is what was requested installed and
// usable?", not "is the entire six-product suite installed?". A subset
// install is a kept promise; unselected products are absent by selection,
// never failures. `--all` keeps the strict whole-suite question.

#[cfg(unix)]
const DOCTOR_PRODUCTS: [(&str, &str); 6] = [
    ("central", "Central"),
    ("actuation", "Actuation"),
    ("ai-kit", "AIKit"),
    ("software-factory", "Software Factory"),
    ("workcell", "Workcell"),
    ("quaternal-logic", "Quaternal Logic"),
];

#[cfg(unix)]
fn run_doctor(temp: &TempDir, catalog: &Path, args: &[&str]) -> Output {
    Command::new(oi())
        .args(args)
        .env("OI_HOME", temp.path())
        .env("OI_DATA_HOME", temp.path().join("oi-data"))
        .env("OI_CATALOG", catalog)
        .output()
        .expect("oi should run")
}

/// A complete stand-in surface catalogue: real product ids (so the doctor's
/// per-product checks and the live surface disclosure line up), with entry
/// names and command routes unique to the fixture so nothing on the test
/// machine's PATH or command surface can interfere.
#[cfg(unix)]
fn write_doctor_catalog(temp: &TempDir) -> PathBuf {
    let surfaces: Vec<serde_json::Value> = DOCTOR_PRODUCTS
        .iter()
        .map(|(id, name)| {
            let revision = format!("fixture-revision-{id}");
            json!({
                "id": id,
                "public_name": name,
                "function": "deterministic fixture",
                "repository": format!("https://example.invalid/{id}"),
                "native": {
                    "kind": "cli",
                    "entry": format!("oi-doctor-fixture-{id}"),
                    "executable": format!("oi-doctor-fixture-{id}"),
                    "namespace": format!("fixture-{id}-namespace"),
                    "aliases": [],
                    "version_command": ["--version"],
                    "capability_command": ["capabilities", "--json"],
                    "verification_command": ["verify", "--json"],
                    "command_revision": revision,
                    "command_standing": "accepted-main",
                    "source_install": {
                        "build": ["cargo", "build", "--locked"],
                        "executable_path": "target/release/fixture"
                    }
                },
                "install": {
                    "kind": "fixture",
                    "note": "fixture only",
                    "revision": revision
                }
            })
        })
        .collect();
    let catalog = temp.path().join("doctor-catalog.json");
    fs::write(
        &catalog,
        serde_json::to_vec_pretty(&json!({
            "schema": 1,
            "verified_at": "2099-01-01",
            "surfaces": surfaces
        }))
        .unwrap(),
    )
    .unwrap();
    catalog
}

#[cfg(unix)]
fn write_doctor_composition(temp: &TempDir, registered: &[&str]) {
    let mut modules = serde_json::Map::new();
    for id in registered {
        let executable = temp.path().join(format!("fixture-{id}"));
        fake_native(&executable);
        modules.insert(
            (*id).to_string(),
            json!({
                "id": id,
                "public_name": id,
                "native_executable": executable,
                "docs": "fixture://docs"
            }),
        );
    }
    fs::write(
        temp.path().join("composition.json"),
        serde_json::to_vec_pretty(&json!({
            "schema": 1,
            "modules": modules
        }))
        .unwrap(),
    )
    .unwrap();
}

#[cfg(unix)]
fn write_installed_receipt(temp: &TempDir, manifest: &serde_json::Value, ids: &[&str]) {
    let mut products = serde_json::Map::new();
    for id in ids {
        let product = manifest["products"]
            .as_array()
            .unwrap()
            .iter()
            .find(|product| product["id"] == *id)
            .unwrap_or_else(|| panic!("manifest carries {id}"));
        let root = temp.path().join("oi-data/products").join(id);
        fs::create_dir_all(&root).unwrap();
        products.insert(
            (*id).to_string(),
            json!({
                "revision": product["revision"],
                "asset": "fixture.tar.gz",
                "sha256": "0",
                "installed_at_ms": 0,
                "attestation": "fixture",
                "attestation_locally_verified": false,
                "root": root,
                "executable": null
            }),
        );
    }
    let receipts = temp.path().join("oi-data/receipts");
    fs::create_dir_all(&receipts).unwrap();
    fs::write(
        receipts.join("installed-suite.json"),
        serde_json::to_vec_pretty(&json!({
            "schema": "oi.installed-suite/v1",
            "suite_version": manifest["suite_version"],
            "products": products
        }))
        .unwrap(),
    )
    .unwrap();
}

#[cfg(unix)]
fn doctor_manifest(temp: &TempDir, catalog: &Path) -> serde_json::Value {
    let output = run_doctor(temp, catalog, &["manifest", "--json"]);
    assert!(output.status.success());
    serde_json::from_slice(&output.stdout).unwrap()
}

#[cfg(unix)]
fn doctor_check<'a>(report: &'a serde_json::Value, product: &str) -> &'a serde_json::Value {
    report["checks"]
        .as_array()
        .unwrap()
        .iter()
        .find(|check| check["product"] == product)
        .unwrap_or_else(|| panic!("report carries a {product} check"))
}

/// The requested install mode scopes verification: a subset install passes,
/// and products outside the mode are absent by selection — never failures.
#[cfg(unix)]
#[test]
fn requested_mode_with_subset_install_passes_unselected_products_disclosed() {
    let temp = TempDir::new().unwrap();
    let catalog = write_doctor_catalog(&temp);
    let manifest = doctor_manifest(&temp, &catalog);
    write_doctor_composition(&temp, &["central", "actuation"]);
    write_installed_receipt(&temp, &manifest, &["central", "actuation"]);

    // The mode statement is recorded through the production command.
    let set = run_doctor(&temp, &catalog, &["mode", "set", "0/1"]);
    assert!(
        set.status.success(),
        "{}",
        String::from_utf8_lossy(&set.stderr)
    );

    let verify = run_doctor(&temp, &catalog, &["verify", "--json"]);
    assert_eq!(verify.status.code(), Some(0));
    let report: serde_json::Value = serde_json::from_slice(&verify.stdout).unwrap();
    assert_eq!(report["schema"], "oi.suite-doctor/v1");
    assert_eq!(report["ok"], true);
    assert_eq!(report["scope"]["basis"], "requested-mode");
    assert_eq!(report["scope"]["install_mode"], "0/1");
    assert_eq!(
        report["scope"]["products"],
        json!(["central", "actuation"]),
        "the scope lists the mode's products in canonical order"
    );
    assert_eq!(report["scope"]["requested_mode"]["frame"], "0/1");
    assert!(report["scope"]["shortfall"].is_null());

    for (id, _) in DOCTOR_PRODUCTS {
        let check = doctor_check(&report, id);
        let selected = matches!(id, "central" | "actuation");
        assert_eq!(check["selected"], selected, "{id}");
        if selected {
            assert_eq!(check["ok"], true, "{id}");
            assert_eq!(check["scope_state"], "selected", "{id}");
        } else {
            assert_eq!(check["ok"], true, "{id} must not fail when unselected");
            assert_eq!(check["scope_state"], "absent-by-selection", "{id}");
            assert!(
                check["detail"]
                    .as_str()
                    .unwrap()
                    .starts_with("absent by selection"),
                "{id}: {}",
                check["detail"]
            );
        }
    }
    assert!(doctor_check(&report, "central")["detail"]
        .as_str()
        .unwrap()
        .contains("developer-path install"));

    let plain = run_doctor(&temp, &catalog, &["doctor"]);
    assert_eq!(plain.status.code(), Some(0));
    let text = String::from_utf8_lossy(&plain.stdout);
    assert!(text.contains("requested install mode 0/1"), "{text}");
    assert!(text.contains("PASS"), "{text}");
    assert!(text.contains("absent by selection"), "{text}");
}

/// A product the requested mode names but the machine lacks fails the run,
/// and the shortfall names the product in plain language.
#[cfg(unix)]
#[test]
fn product_missing_from_requested_mode_fails_with_a_named_shortfall() {
    let temp = TempDir::new().unwrap();
    let catalog = write_doctor_catalog(&temp);
    let manifest = doctor_manifest(&temp, &catalog);
    write_doctor_composition(&temp, &["central", "actuation"]);
    write_installed_receipt(&temp, &manifest, &["central", "actuation"]);

    let set = run_doctor(&temp, &catalog, &["mode", "set", "0/1/2"]);
    assert!(
        set.status.success(),
        "{}",
        String::from_utf8_lossy(&set.stderr)
    );

    let doctor = run_doctor(&temp, &catalog, &["doctor", "--json"]);
    assert_eq!(doctor.status.code(), Some(3));
    let report: serde_json::Value = serde_json::from_slice(&doctor.stdout).unwrap();
    assert_eq!(report["ok"], false);
    assert_eq!(report["scope"]["basis"], "requested-mode");
    assert_eq!(report["scope"]["install_mode"], "0/1/2");

    let ai_kit = doctor_check(&report, "ai-kit");
    assert_eq!(ai_kit["ok"], false, "the mode requires AIKit");
    assert_eq!(ai_kit["selected"], true);
    assert_eq!(ai_kit["detail"], "not installed");

    let shortfall = report["scope"]["shortfall"].as_str().unwrap();
    assert!(shortfall.contains("AIKit"), "{shortfall}");
    assert!(shortfall.contains("not fully realised"), "{shortfall}");

    // Unselected products still do not fail: the shortfall is exactly the
    // requested mode's missing product, nothing else.
    let ql = doctor_check(&report, "quaternal-logic");
    assert_eq!(ql["ok"], true);
    assert_eq!(ql["scope_state"], "absent-by-selection");
}

/// With no mode recorded, verification scopes to the installation receipt:
/// the installed subset passes and absent unselected products are disclosed.
#[cfg(unix)]
#[test]
fn installed_subset_without_a_recorded_mode_passes() {
    let temp = TempDir::new().unwrap();
    let catalog = write_doctor_catalog(&temp);
    let manifest = doctor_manifest(&temp, &catalog);
    write_doctor_composition(&temp, &["central", "actuation"]);
    write_installed_receipt(&temp, &manifest, &["central", "actuation"]);

    let verify = run_doctor(&temp, &catalog, &["verify", "--json"]);
    assert_eq!(verify.status.code(), Some(0));
    let report: serde_json::Value = serde_json::from_slice(&verify.stdout).unwrap();
    assert_eq!(report["ok"], true);
    assert_eq!(report["scope"]["basis"], "receipt");
    assert_eq!(report["scope"]["products"], json!(["central", "actuation"]));
    assert!(
        report["scope"]["install_mode"].is_null(),
        "no mode is recorded, so none is claimed"
    );
    let ql = doctor_check(&report, "quaternal-logic");
    assert_eq!(ql["ok"], true);
    assert_eq!(ql["scope_state"], "absent-by-selection");
}

/// `--all` keeps the strict whole-suite question: the same subset install
/// that passes scoped now fails on every uninstalled product.
#[cfg(unix)]
#[test]
fn all_flag_verifies_the_whole_suite_strictly() {
    let temp = TempDir::new().unwrap();
    let catalog = write_doctor_catalog(&temp);
    let manifest = doctor_manifest(&temp, &catalog);
    write_doctor_composition(&temp, &["central", "actuation"]);
    write_installed_receipt(&temp, &manifest, &["central", "actuation"]);

    for args in [
        vec!["verify", "--all", "--json"],
        vec!["doctor", "--all", "--json"],
    ] {
        let output = run_doctor(&temp, &catalog, &args);
        assert_eq!(output.status.code(), Some(3), "{args:?}");
        let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(report["ok"], false, "{args:?}");
        assert_eq!(report["scope"]["basis"], "all", "{args:?}");
        for (id, _) in DOCTOR_PRODUCTS {
            let check = doctor_check(&report, id);
            assert_eq!(check["selected"], true, "{id}");
            if matches!(id, "central" | "actuation") {
                assert_eq!(check["ok"], true, "{id}");
            } else {
                assert_eq!(check["ok"], false, "{id}");
                assert_eq!(check["detail"], "not installed", "{id}");
            }
        }
    }
}
