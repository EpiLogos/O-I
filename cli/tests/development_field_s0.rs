use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use tempfile::TempDir;

const PRODUCTS: [(&str, &str, &str); 6] = [
    (
        "central",
        "ctrl",
        "39efa03ea8607bdd8a79b0e317457c2ccc3ead4c",
    ),
    (
        "actuation",
        "actuation",
        "67e6b296b85bd3eb1554802fd55a476c474aa566",
    ),
    (
        "ai-kit",
        "aikit",
        "856f454778e5a44e8055751bb59ed933caf210ce",
    ),
    (
        "software-factory",
        "factory",
        "a335048b0a5b907adc5d09f0dcbda05b98f79a05",
    ),
    (
        "workcell",
        "workcell",
        "e4e40a91fe7ed1776e634cad768f1049c39fd34e",
    ),
    (
        "quaternal-logic",
        "ql",
        "d88216301a8f76918073d46f5de064a68f7c1480",
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

    fs::remove_file(bin.path().join("workcell")).unwrap();
    let rejected = output(oi(config.path(), data.path(), bin.path()).args(["suite", "update"]));
    assert!(!rejected.status.success());
    let after_reject =
        output(oi(config.path(), data.path(), bin.path()).args(["suite", "status", "--json"]));
    let after_reject_json: Value = serde_json::from_slice(&after_reject.stdout).unwrap();
    assert_eq!(after_reject_json["active"]["receipt_ref"], first_receipt);
    let still_first = output(oi(config.path(), data.path(), bin.path()).args(["central", "probe"]));
    assert_eq!(stdout(&still_first).trim(), "central-v1:probe");

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
    assert_ne!(second_status_json["active"]["receipt_ref"], first_receipt);
    assert_ne!(second_status_json["active"]["products"], first_products);
    let second_dispatch =
        output(oi(config.path(), data.path(), bin.path()).args(["central", "probe"]));
    assert_eq!(stdout(&second_dispatch).trim(), "central-v2:probe");

    let rollback =
        output(oi(config.path(), data.path(), bin.path()).args(["suite", "rollback", "--json"]));
    assert!(rollback.status.success(), "{}", stderr(&rollback));
    let rollback_json: Value = serde_json::from_slice(&rollback.stdout).unwrap();
    assert_eq!(rollback_json["outcome"], "rolled-back");
    let restored =
        output(oi(config.path(), data.path(), bin.path()).args(["suite", "status", "--json"]));
    let restored_json: Value = serde_json::from_slice(&restored.stdout).unwrap();
    assert_eq!(restored_json["active"]["receipt_ref"], first_receipt);
    assert_eq!(restored_json["active"]["products"], first_products);
    let restored_dispatch =
        output(oi(config.path(), data.path(), bin.path()).args(["central", "probe"]));
    assert_eq!(stdout(&restored_dispatch).trim(), "central-v1:probe");
}
