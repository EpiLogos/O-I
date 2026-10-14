use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use tempfile::TempDir;

fn products() -> Vec<(String, String, String)> {
    let catalogue: Value = serde_json::from_str(include_str!("../../surfaces.json")).unwrap();
    catalogue["surfaces"]
        .as_array()
        .unwrap()
        .iter()
        .map(|product| {
            (
                product["id"].as_str().unwrap().to_owned(),
                product["native"]["executable"].as_str().unwrap().to_owned(),
                product["native"]["command_revision"]
                    .as_str()
                    .unwrap()
                    .to_owned(),
            )
        })
        .collect()
}

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
    for (id, executable, revision) in products() {
        let label = if id == "central" {
            central_label
        } else {
            id.as_str()
        };
        let path = fake_executable(bin, &executable, label);
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
    for (id, _, _) in products() {
        let before = first_products[&id]["root"].as_str().unwrap();
        let after = second_status_json["active"]["products"][&id]["root"]
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
    assert_eq!(location_json["revision"], products()[0].2);
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

/// `oi where` discloses a product's companions beside the resolved primary:
/// a managed `bin/<exe>` link reaches its content-addressed generation, and
/// the siblings there are the same cut's. An explicit override resolves the
/// same way relative to the override.
#[cfg(unix)]
#[test]
fn where_discloses_companions_beside_the_resolved_executable() {
    let config = TempDir::new().unwrap();
    let data = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    write_source_composition(config.path(), bin.path(), "central");
    let generation = data.path().join("products/quaternal-logic/abc/bin");
    fake_executable(
        &{
            fs::create_dir_all(&generation).unwrap();
            generation.clone()
        },
        "ql",
        "ql",
    );
    fake_executable(&generation, "ql-field-host", "host");
    fake_executable(&generation, "ql-field-worker", "worker");
    fs::create_dir_all(data.path().join("bin")).unwrap();
    std::os::unix::fs::symlink(
        "../products/quaternal-logic/abc/bin/ql",
        data.path().join("bin/ql"),
    )
    .unwrap();
    let composition_path = config.path().join("composition.json");
    let mut composition: Value =
        serde_json::from_slice(&fs::read(&composition_path).unwrap()).unwrap();
    composition["modules"]["quaternal-logic"]["native_executable"] =
        json!(data.path().join("bin/ql"));
    fs::write(
        &composition_path,
        serde_json::to_vec_pretty(&composition).unwrap(),
    )
    .unwrap();

    let location = output(
        oi(config.path(), data.path(), bin.path())
            .env_remove("OI_QL_BIN")
            .args(["where", "quaternal-logic", "--json"]),
    );
    assert!(location.status.success(), "{}", stderr(&location));
    let reading: Value = serde_json::from_slice(&location.stdout).unwrap();
    assert_eq!(reading["schema"], "oi.product-location/v1");
    assert_eq!(reading["authority"], "legacy-fallback-no-active-receipt");
    let generation = fs::canonicalize(&generation).unwrap();
    let companions = reading["companions"].as_object().unwrap();
    assert_eq!(companions.len(), 4);
    for (name, present) in [
        ("ql-field-host", true),
        ("ql-field-worker", true),
        ("ql-focused-host", false),
        ("ql-sky", false),
    ] {
        let companion = &companions[name];
        assert_eq!(
            companion["executable"],
            json!(generation.join(name)),
            "{name}"
        );
        assert_eq!(companion["present"], present, "{name}");
        assert_eq!(companion["sha256"].is_string(), present, "{name}");
    }

    // An explicit override resolves its companions beside the override.
    let other = TempDir::new().unwrap();
    let override_ql = fake_executable(other.path(), "ql", "override");
    fake_executable(other.path(), "ql-focused-host", "focused");
    let overridden = output(
        oi(config.path(), data.path(), bin.path())
            .env("OI_QL_BIN", &override_ql)
            .args(["where", "ql", "--json"]),
    );
    assert!(overridden.status.success(), "{}", stderr(&overridden));
    let reading: Value = serde_json::from_slice(&overridden.stdout).unwrap();
    assert_eq!(reading["authority"], "explicit-source-override");
    let root = fs::canonicalize(other.path()).unwrap();
    assert_eq!(reading["companions"]["ql-focused-host"]["present"], true);
    assert_eq!(
        reading["companions"]["ql-focused-host"]["executable"],
        json!(root.join("ql-focused-host"))
    );
    assert_eq!(reading["companions"]["ql-field-host"]["present"], false);

    // A product that declares no companions reads an empty object.
    let central = output(
        oi(config.path(), data.path(), bin.path())
            .env_remove("OI_CENTRAL_CTRL_BIN")
            .args(["where", "central", "--json"]),
    );
    let reading: Value = serde_json::from_slice(&central.stdout).unwrap();
    assert_eq!(reading["companions"], json!({}));
}

/// A managed update and the active suite receipt name one install. A product
/// the managed flow installed while a source suite pinned an older cut is
/// first disclosed as shadowed by `oi where` and `oi update --check`; an
/// apply supersedes only that product's suite entry, companions included, so
/// `oi where` and dispatch resolve the managed cut; `oi suite rollback`
/// restores the replaced receipt.
#[cfg(unix)]
#[test]
fn managed_update_supersedes_the_active_suite_entry_it_installed() {
    use sha2::Digest;
    use std::os::unix::fs::{symlink, PermissionsExt};

    let config = TempDir::new().unwrap();
    let data = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    let home = TempDir::new().unwrap();
    let ground = TempDir::new().unwrap();
    write_source_composition(config.path(), bin.path(), "central");
    let mut composition: Value =
        serde_json::from_slice(&fs::read(config.path().join("composition.json")).unwrap()).unwrap();
    composition["personal_ground"] = json!(ground.path());
    fs::write(
        config.path().join("composition.json"),
        serde_json::to_vec_pretty(&composition).unwrap(),
    )
    .unwrap();
    let run = |args: &[&str]| {
        output(
            oi(config.path(), data.path(), bin.path())
                .env("HOME", home.path())
                .args(args),
        )
    };

    assert!(run(&["suite", "channel", "source"]).status.success());
    let activated = run(&["suite", "update", "--json"]);
    assert!(activated.status.success(), "{}", stderr(&activated));
    let suite: Value = serde_json::from_slice(&activated.stdout).unwrap();
    let first_receipt = suite["active"]["receipt_ref"].as_str().unwrap().to_owned();
    let first_products = suite["active"]["products"].clone();

    // The QL checkout's committed cut, already installed by the managed flow
    // with its companions — after the suite was activated.
    let checkout = ground.path().join("Work/Quaternal-Logic");
    fs::create_dir_all(&checkout).unwrap();
    let git = |args: &[&str]| {
        let result = Command::new("git")
            .arg("-C")
            .arg(&checkout)
            .args(args)
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
        String::from_utf8(result.stdout).unwrap().trim().to_owned()
    };
    git(&["init", "--quiet"]);
    fs::write(checkout.join("README"), "ql\n").unwrap();
    git(&["add", "."]);
    git(&[
        "-c",
        "user.email=t@example.invalid",
        "-c",
        "user.name=T",
        "commit",
        "--quiet",
        "-m",
        "cut",
    ]);
    let revision = git(&["rev-parse", "HEAD"]);
    let tree = git(&["rev-parse", "HEAD^{tree}"]);

    let staging = TempDir::new().unwrap();
    let primary = fake_executable(staging.path(), "ql", "ql-managed");
    let sha256 = format!("{:x}", sha2::Sha256::digest(fs::read(&primary).unwrap()));
    let generation = data
        .path()
        .join("products/quaternal-logic")
        .join(&sha256)
        .join("bin");
    fs::create_dir_all(&generation).unwrap();
    fs::copy(&primary, generation.join("ql")).unwrap();
    let mut companions = serde_json::Map::new();
    for name in [
        "ql-field-host",
        "ql-field-worker",
        "ql-focused-host",
        "ql-sky",
    ] {
        let path = generation.join(name);
        fs::write(&path, format!("#!/bin/sh\necho {name}\n")).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        companions.insert(
            name.into(),
            json!(format!(
                "{:x}",
                sha2::Sha256::digest(fs::read(&path).unwrap())
            )),
        );
    }
    fs::set_permissions(generation.join("ql"), fs::Permissions::from_mode(0o755)).unwrap();
    fs::create_dir_all(data.path().join("bin")).unwrap();
    symlink(generation.join("ql"), data.path().join("bin/ql")).unwrap();
    let activation = home.path().join(".local/bin");
    fs::create_dir_all(&activation).unwrap();
    symlink(data.path().join("bin/ql"), activation.join("ql")).unwrap();
    let receipt = json!({
        "schema": "oi.managed-update/v1",
        "channel": "source",
        "modality": "developer-source",
        "updated_at_unix_seconds": 1,
        "products": {"quaternal-logic": {
            "exe": "ql", "revision": revision, "tree": tree, "branch": "main",
            "channel": "source", "source_dirty": false,
            "source_path": checkout, "sha256": sha256,
            "managed": generation.join("ql"), "bin": data.path().join("bin/ql"),
            "activation": activation.join("ql"), "provenance": "built",
            "build_command": [], "gate": "", "installed_at_unix_seconds": 1,
            "companions": companions,
        }},
    });
    fs::create_dir_all(data.path().join("receipts/updates")).unwrap();
    fs::write(
        data.path().join("receipts/updates/active.json"),
        serde_json::to_vec_pretty(&receipt).unwrap(),
    )
    .unwrap();

    // Shadowed: the suite still resolves its own ql, without companions,
    // and both readings say so with the remedy.
    let shadowed = run(&["where", "quaternal-logic", "--json"]);
    assert!(shadowed.status.success(), "{}", stderr(&shadowed));
    let shadowed: Value = serde_json::from_slice(&shadowed.stdout).unwrap();
    assert_eq!(shadowed["receipt_ref"], first_receipt);
    assert_eq!(shadowed["companions"]["ql-field-host"]["present"], false);
    assert_eq!(
        shadowed["shadowed_managed_update"]["revision"],
        json!(revision)
    );
    assert_eq!(
        shadowed["shadowed_managed_update"]["remedy"],
        "oi update --apply quaternal-logic"
    );
    let check = run(&["update", "--check", "--json", "quaternal-logic"]);
    let check: Value = serde_json::from_slice(&check.stdout).unwrap();
    assert_eq!(check["products"][0]["action"], "skip");
    assert_eq!(check["suite_shadowed"][0]["product"], "quaternal-logic");

    // The apply finds QL current and brings the suite receipt to it.
    let applied = run(&["update", "--apply", "quaternal-logic"]);
    assert!(
        applied.status.success(),
        "{}{}",
        stdout(&applied),
        stderr(&applied)
    );
    assert!(
        stdout(&applied).contains(&format!("Active suite receipt {first_receipt} superseded")),
        "{}",
        stdout(&applied)
    );

    let located = run(&["where", "quaternal-logic", "--json"]);
    assert!(located.status.success(), "{}", stderr(&located));
    let located: Value = serde_json::from_slice(&located.stdout).unwrap();
    assert_eq!(located["authority"], "active-suite-receipt");
    assert_ne!(located["receipt_ref"], first_receipt);
    assert_eq!(located["revision"], json!(revision));
    assert_eq!(located["sha256"], json!(sha256));
    assert!(located["shadowed_managed_update"].is_null());
    for name in [
        "ql-field-host",
        "ql-field-worker",
        "ql-focused-host",
        "ql-sky",
    ] {
        assert_eq!(located["companions"][name]["present"], true, "{name}");
    }
    let dispatched = run(&["ql", "probe"]);
    assert_eq!(
        stdout(&dispatched).trim(),
        "ql-managed:probe",
        "{}",
        stderr(&dispatched)
    );

    // Nothing else moved; the successor's lineage names the replaced receipt.
    let status = run(&["suite", "status", "--json"]);
    let status: Value = serde_json::from_slice(&status.stdout).unwrap();
    assert_eq!(status["active_ok"], true);
    assert_eq!(status["active"]["previous_receipt_ref"], first_receipt);
    for (id, _, _) in products() {
        if id != "quaternal-logic" {
            assert_eq!(
                status["active"]["products"][&id], first_products[&id],
                "{id} is reused"
            );
        }
    }

    // Converged: a second apply supersedes nothing.
    let again = run(&["update", "--apply", "quaternal-logic"]);
    assert!(again.status.success(), "{}", stderr(&again));
    assert!(!stdout(&again).contains("superseded"), "{}", stdout(&again));

    let rolled = run(&["suite", "rollback", "--json"]);
    assert!(rolled.status.success(), "{}", stderr(&rolled));
    let rolled: Value = serde_json::from_slice(&rolled.stdout).unwrap();
    assert_eq!(rolled["active"]["receipt_ref"], first_receipt);
    assert_eq!(
        stdout(&run(&["ql", "probe"])).trim(),
        "quaternal-logic:probe"
    );
}
