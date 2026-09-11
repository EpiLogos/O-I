use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use tempfile::TempDir;

const PRODUCTS: [(&str, &str, &str); 6] = [
    (
        "central",
        "ctrl",
        "5b61b82835f4efbf57ab896b8efff72f9f8f3906",
    ),
    (
        "actuation",
        "actuation",
        "ecac9ddd5009d03e6d38043341672b0409090c8d",
    ),
    (
        "ai-kit",
        "aikit",
        "95e35ac6569a85239a4689aeb440929f5d07888b",
    ),
    (
        "software-factory",
        "factory",
        "885f3c29726dc6cb9397eca246abdfb1c65eff86",
    ),
    (
        "workcell",
        "workcell",
        "fa47a29fa49a6636675d21309b00c269ac824abb",
    ),
    (
        "quaternal-logic",
        "ql",
        "44ed3cd0e7a8bc25508a4e18ad3bb4c730013913",
    ),
];

fn oi(config: &Path, data: &Path, path: &Path) -> Command {
    let host_path = std::env::var_os("PATH").unwrap_or_default();
    let fixture_path = std::env::join_paths(
        std::iter::once(path.to_path_buf()).chain(std::env::split_paths(&host_path)),
    )
    .expect("fixture PATH must be representable");
    let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
    command
        .env("OI_HOME", config)
        .env("OI_DATA_HOME", data)
        .env("PATH", fixture_path);
    command
}

fn output(command: &mut Command) -> Output {
    command.output().expect("oi command runs")
}

fn stdout(result: &Output) -> String {
    String::from_utf8(result.stdout.clone()).unwrap()
}

fn stderr(result: &Output) -> String {
    String::from_utf8(result.stderr.clone()).unwrap()
}

#[cfg(unix)]
fn fake_executable(dir: &Path, executable: &str, label: &str) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let path = dir.join(executable);
    fs::write(
        &path,
        format!(
            "#!/bin/sh\nif [ \"${{1:-}}\" = \"--version\" ]; then echo '{executable} 1.0.0'; exit 0; fi\necho \"{label}:$*\"\n"
        ),
    )
    .unwrap();
    let mut permissions = fs::metadata(&path).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&path, permissions).unwrap();
    path
}

#[cfg(unix)]
fn write_source_composition(config: &Path, bin: &Path, central_label: &str) {
    fs::create_dir_all(config).unwrap();
    fs::create_dir_all(bin).unwrap();
    let mut modules = serde_json::Map::new();
    for (id, executable, revision) in PRODUCTS {
        let label = if id == "central" { central_label } else { id };
        let path = fake_executable(bin, executable, label);
        modules.insert(
            id.to_owned(),
            json!({
                "id": id,
                "public_name": id,
                "native_executable": path,
                "version": revision,
                "docs": "",
                "modality": "developer-source",
                "install_source": "test-source"
            }),
        );
    }
    fs::write(
        config.join("composition.json"),
        serde_json::to_vec_pretty(&json!({"schema":1,"modules":modules})).unwrap(),
    )
    .unwrap();
}

#[cfg(unix)]
#[test]
fn source_suite_activation_is_atomic_incremental_dispatch_authority_and_rollback_restores_prior_whole(
) {
    let config = TempDir::new().unwrap();
    let data = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    write_source_composition(config.path(), bin.path(), "central-v1");

    let selected =
        output(oi(config.path(), data.path(), bin.path()).args(["suite", "channel", "source"]));
    assert!(selected.status.success(), "{}", stderr(&selected));

    let first =
        output(oi(config.path(), data.path(), bin.path()).args(["suite", "update", "--json"]));
    assert!(first.status.success(), "{}", stderr(&first));
    let first_json: Value = serde_json::from_slice(&first.stdout).unwrap();
    assert_eq!(first_json["outcome"], "activated");
    assert_eq!(first_json["acquired"].as_array().unwrap().len(), 6);
    assert!(first_json["reused"].as_array().unwrap().is_empty());

    let status =
        output(oi(config.path(), data.path(), bin.path()).args(["suite", "status", "--json"]));
    assert!(status.status.success(), "{}", stderr(&status));
    let status_json: Value = serde_json::from_slice(&status.stdout).unwrap();
    assert_eq!(status_json["active_ok"], true);
    assert_eq!(status_json["available_candidate"]["state"], "ready");
    assert_eq!(
        status_json["active"]["products"].as_object().unwrap().len(),
        6
    );
    let first_receipt = status_json["active"]["receipt_ref"]
        .as_str()
        .unwrap()
        .to_owned();
    let first_products = status_json["active"]["products"].clone();

    let first_dispatch =
        output(oi(config.path(), data.path(), bin.path()).args(["central", "probe"]));
    assert!(
        first_dispatch.status.success(),
        "{}",
        stderr(&first_dispatch)
    );
    assert_eq!(stdout(&first_dispatch).trim(), "central-v1:probe");

    // A broken next source composition must not alter the active receipt.
    fs::remove_file(bin.path().join("workcell")).unwrap();
    let rejected = output(oi(config.path(), data.path(), bin.path()).args(["suite", "update"]));
    assert!(!rejected.status.success());
    let after_reject =
        output(oi(config.path(), data.path(), bin.path()).args(["suite", "status", "--json"]));
    let after_reject_json: Value = serde_json::from_slice(&after_reject.stdout).unwrap();
    assert_eq!(after_reject_json["active"]["receipt_ref"], first_receipt);
    let still_first = output(oi(config.path(), data.path(), bin.path()).args(["central", "probe"]));
    assert_eq!(stdout(&still_first).trim(), "central-v1:probe");

    // Restore the sixfold but change only Central. Five immutable artifact roots
    // must be reused; only Central is acquired into the new receipt root.
    fake_executable(bin.path(), "workcell", "workcell");
    fake_executable(bin.path(), "ctrl", "central-v2");
    let second =
        output(oi(config.path(), data.path(), bin.path()).args(["suite", "update", "--json"]));
    assert!(second.status.success(), "{}", stderr(&second));
    let second_json: Value = serde_json::from_slice(&second.stdout).unwrap();
    assert_eq!(second_json["outcome"], "activated");
    assert_eq!(second_json["acquired"], json!(["central"]));
    assert_eq!(second_json["reused"].as_array().unwrap().len(), 5);

    let second_status =
        output(oi(config.path(), data.path(), bin.path()).args(["suite", "status", "--json"]));
    let second_status_json: Value = serde_json::from_slice(&second_status.stdout).unwrap();
    assert_eq!(
        second_status_json["active"]["previous_receipt_ref"],
        first_receipt
    );
    for (id, _, _) in PRODUCTS {
        let before = first_products[id]["root"].as_str().unwrap();
        let after = second_status_json["active"]["products"][id]["root"]
            .as_str()
            .unwrap();
        if id == "central" {
            assert_ne!(after, before, "changed product must acquire a new root");
        } else {
            assert_eq!(after, before, "unchanged product {id} must reuse its root");
        }
    }
    assert!(
        !data.path().join("receipts/previous-suite.json").exists(),
        "rollback authority comes from immutable receipt lineage, not a second mutable pointer"
    );

    let second_dispatch =
        output(oi(config.path(), data.path(), bin.path()).args(["central", "probe"]));
    assert_eq!(stdout(&second_dispatch).trim(), "central-v2:probe");

    let location =
        output(oi(config.path(), data.path(), bin.path()).args(["where", "central", "--json"]));
    let location_json: Value = serde_json::from_slice(&location.stdout).unwrap();
    assert_eq!(location_json["authority"], "active-suite-receipt");
    assert_eq!(location_json["modality"], "managed-suite");
    assert_eq!(location_json["revision"], PRODUCTS[0].2);
    assert_eq!(location_json["revision_standing"], "receipt-exact");
    assert!(location_json["sha256"].as_str().is_some());
    assert!(location_json["executable"]
        .as_str()
        .unwrap()
        .contains("/suites/"));

    let rollback =
        output(oi(config.path(), data.path(), bin.path()).args(["suite", "rollback", "--json"]));
    assert!(rollback.status.success(), "{}", stderr(&rollback));
    let rollback_json: Value = serde_json::from_slice(&rollback.stdout).unwrap();
    assert_eq!(rollback_json["operation"], "rollback");
    assert_eq!(rollback_json["active"]["receipt_ref"], first_receipt);
    let restored = output(oi(config.path(), data.path(), bin.path()).args(["central", "probe"]));
    assert_eq!(stdout(&restored).trim(), "central-v1:probe");

    let checked =
        output(oi(config.path(), data.path(), bin.path()).args(["suite", "check", "--json"]));
    assert!(checked.status.success(), "{}", stderr(&checked));
    let checked_json: Value = serde_json::from_slice(&checked.stdout).unwrap();
    assert_eq!(checked_json["ok"], true);
    assert_eq!(checked_json["active_checks"].as_array().unwrap().len(), 6);
}
