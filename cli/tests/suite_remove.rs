//! Per-product suite removal (the remove leg of the lifecycle planner,
//! #268): only receipt-owned managed resources are removed, authored ground
//! and other products are retained, every run writes a removal receipt that
//! explains residuals, and a requested install mode is disclosed — never
//! rewritten. The managed post-install state is fabricated offline (marker
//! trees, receipt entries, managed registrations) exactly as the recorded
//! installer writes it; the removal itself always runs through the
//! production command.

use serde_json::{json, Value};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use tempfile::TempDir;

fn oi(home: &Path, path: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
    command
        .env("OI_HOME", home)
        .env("OI_DATA_HOME", home.join("oi-data"))
        .env("HOME", home)
        .env("PATH", path);
    command
}

fn output(command: &mut Command) -> Output {
    command.output().expect("command runs")
}

fn text(bytes: &[u8]) -> String {
    String::from_utf8(bytes.to_vec()).unwrap()
}

fn executable(path: &PathBuf) {
    let mut permissions = fs::metadata(path).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).unwrap();
}

/// Fabricate the managed state the recorded installer creates for one
/// product: a marker-carrying product tree, a cached archive, an optional
/// bin command and the installed-suite receipt entry. Deterministic and
/// offline.
fn fabricate_managed_install(home: &Path, id: &str, revision: &str, command: Option<&str>) {
    let data = home.join("oi-data");
    let product_root = data.join("products").join(id).join(revision);
    fs::create_dir_all(product_root.join("payload")).unwrap();
    fs::write(product_root.join(".oi-install.json"), "{}").unwrap();
    fs::write(product_root.join("payload").join("managed.txt"), "managed").unwrap();
    let cache_dir = data.join("cache").join(id).join(revision);
    fs::create_dir_all(&cache_dir).unwrap();
    fs::write(cache_dir.join("archive.tar.gz"), "archive").unwrap();
    let command_field = match command {
        Some(name) => {
            let path = data.join("bin").join(name);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(&path, "#!/bin/sh\n").unwrap();
            executable(&path);
            json!(path.display().to_string())
        }
        None => json!(null),
    };
    let receipt_path = data.join("receipts/installed-suite.json");
    fs::create_dir_all(receipt_path.parent().unwrap()).unwrap();
    let mut receipt = if receipt_path.exists() {
        serde_json::from_slice::<Value>(&fs::read(&receipt_path).unwrap()).unwrap()
    } else {
        json!({"schema": "oi.installed-suite/v1", "suite_version": "test", "products": {}})
    };
    receipt["products"][id] = json!({
        "revision": revision,
        "asset": "archive.tar.gz",
        "sha256": "0".repeat(64),
        "installed_at_ms": 0,
        "attestation": "attestation",
        "attestation_locally_verified": false,
        "root": product_root.join("payload").display().to_string(),
        "executable": command_field,
    });
    fs::write(&receipt_path, serde_json::to_vec_pretty(&receipt).unwrap()).unwrap();
}

/// Record a managed composition registration pointing inside the managed
/// root, as the recorded installer would.
fn register_managed_composition(home: &Path, id: &str, location: &Path) {
    let path = home.join("composition.json");
    let mut composition = if path.exists() {
        serde_json::from_slice::<Value>(&fs::read(&path).unwrap()).unwrap()
    } else {
        json!({"schema": 1, "modules": {}})
    };
    composition["modules"][id] = json!({
        "id": id,
        "public_name": id,
        "native_executable": location.display().to_string(),
        "docs": "docs",
        "modality": "fresh-ground",
        "install_source": "recorded-release-artifact",
    });
    fs::write(&path, serde_json::to_vec_pretty(&composition).unwrap()).unwrap();
}

fn first_removal_receipt(home: &Path) -> Value {
    let dir = home.join("oi-data/receipts/removals");
    let recorded = fs::read_dir(&dir)
        .expect("removal receipts directory exists")
        .next()
        .expect("a removal receipt was written")
        .unwrap()
        .path();
    serde_json::from_slice(&fs::read(&recorded).unwrap()).unwrap()
}

#[test]
fn remove_one_product_from_a_subset_removes_only_its_managed_files() {
    let home = TempDir::new().unwrap();
    let ground = home.path().join("Central");
    fs::create_dir_all(ground.join("Control")).unwrap();
    fs::write(ground.join("Control/authored.md"), "authored").unwrap();
    fabricate_managed_install(home.path(), "central", "central-revision", Some("ctrl"));
    fabricate_managed_install(home.path(), "software-factory", "factory-revision", None);
    register_managed_composition(
        home.path(),
        "central",
        &home.path().join("oi-data/bin/ctrl"),
    );
    register_managed_composition(
        home.path(),
        "software-factory",
        &home
            .path()
            .join("oi-data/products/software-factory/factory-revision/payload"),
    );

    let removal = output(oi(home.path(), home.path()).args(["remove", "software-factory"]));
    assert!(removal.status.success(), "{}", text(&removal.stderr));
    let stdout = text(&removal.stdout);
    assert!(stdout.contains("Removal plan"), "{stdout}");
    assert!(stdout.contains("Removed software-factory"), "{stdout}");
    assert!(stdout.contains("personal ground"), "{stdout}");
    assert!(stdout.contains("Removal receipt:"), "{stdout}");

    // Owned resources are gone; the rest of the world is exactly where it was.
    let data = home.path().join("oi-data");
    assert!(!data.join("products/software-factory").exists());
    assert!(!data.join("cache/software-factory").exists());
    assert!(data.join("products/central").is_dir());
    assert!(data.join("cache/central").is_dir());
    assert!(data.join("bin/ctrl").is_file());
    assert!(ground.join("Control/authored.md").is_file());

    let receipt: Value =
        serde_json::from_slice(&fs::read(data.join("receipts/installed-suite.json")).unwrap())
            .unwrap();
    assert!(receipt["products"].get("software-factory").is_none());
    assert!(receipt["products"].get("central").is_some());

    let composition: Value =
        serde_json::from_slice(&fs::read(home.path().join("composition.json")).unwrap()).unwrap();
    assert!(composition["modules"].get("software-factory").is_none());
    assert!(composition["modules"].get("central").is_some());

    let recorded = first_removal_receipt(home.path());
    assert_eq!(recorded["schema"], "oi.suite-removal/v1");
    assert!(recorded["products"].get("software-factory").is_some());
    assert!(recorded["products"]["software-factory"]["residuals"]
        .as_array()
        .unwrap()
        .is_empty());
}

#[test]
fn unknown_and_never_installed_products_refuse_cleanly() {
    let home = TempDir::new().unwrap();
    fabricate_managed_install(home.path(), "central", "central-revision", Some("ctrl"));

    let unknown = output(oi(home.path(), home.path()).args(["remove", "no-such-product"]));
    assert_eq!(unknown.status.code(), Some(2));
    let stderr = text(&unknown.stderr);
    assert!(
        stderr.contains("unknown product 'no-such-product'"),
        "{stderr}"
    );
    assert!(
        stderr.contains("software-factory"),
        "the recorded product ids are named: {stderr}"
    );

    let not_installed = output(oi(home.path(), home.path()).args(["remove", "software-factory"]));
    assert_eq!(not_installed.status.code(), Some(2));
    assert!(
        text(&not_installed.stderr).contains("not installed on this machine"),
        "{}",
        text(&not_installed.stderr)
    );

    // A refusal mutates nothing.
    assert!(!home.path().join("oi-data/receipts/removals").exists());
    let receipt: Value = serde_json::from_slice(
        &fs::read(home.path().join("oi-data/receipts/installed-suite.json")).unwrap(),
    )
    .unwrap();
    assert!(
        receipt["products"].get("central").is_some(),
        "the refused request changed no receipt"
    );
}

#[test]
fn a_repeated_removal_names_the_previous_removal_receipt() {
    let home = TempDir::new().unwrap();
    fabricate_managed_install(
        home.path(),
        "workcell",
        "workcell-revision",
        Some("workcell"),
    );
    register_managed_composition(
        home.path(),
        "workcell",
        &home.path().join("oi-data/bin/workcell"),
    );

    let first = output(oi(home.path(), home.path()).args(["remove", "workcell"]));
    assert!(first.status.success(), "{}", text(&first.stderr));

    let again = output(oi(home.path(), home.path()).args(["remove", "workcell"]));
    assert_eq!(again.status.code(), Some(2));
    let stderr = text(&again.stderr);
    assert!(stderr.contains("not installed on this machine"), "{stderr}");
    assert!(stderr.contains("previous removal"), "{stderr}");
}

#[test]
fn a_requested_mode_is_disclosed_not_rewritten() {
    let home = TempDir::new().unwrap();
    fabricate_managed_install(home.path(), "software-factory", "factory-revision", None);
    register_managed_composition(
        home.path(),
        "software-factory",
        &home
            .path()
            .join("oi-data/products/software-factory/factory-revision/payload"),
    );
    let composition_path = home.path().join("composition.json");
    let mut composition: Value =
        serde_json::from_slice(&fs::read(&composition_path).unwrap()).unwrap();
    composition["requested_mode"] =
        json!({"frame": "0/1/2/3", "set_at_unix_seconds": 1, "set_by": "oi mode set"});
    fs::write(
        &composition_path,
        serde_json::to_vec_pretty(&composition).unwrap(),
    )
    .unwrap();

    // `uninstall` is the alias of the same operation.
    let removal = output(oi(home.path(), home.path()).args(["uninstall", "software-factory"]));
    assert!(removal.status.success(), "{}", text(&removal.stderr));
    let stdout = text(&removal.stdout);
    assert!(stdout.contains("0/1/2/3"), "{stdout}");
    assert!(stdout.contains("left unchanged"), "{stdout}");

    let after: Value = serde_json::from_slice(&fs::read(&composition_path).unwrap()).unwrap();
    assert_eq!(
        after["requested_mode"]["frame"], "0/1/2/3",
        "the request is the person's own statement; removal discloses the shortfall, never rewrites it"
    );
}

#[test]
fn an_interrupted_install_removes_to_an_explained_state() {
    let home = TempDir::new().unwrap();
    // The receipt entry exists, but the run died before anything was
    // promoted into place: no managed files exist.
    let data = home.path().join("oi-data");
    fs::create_dir_all(data.join("receipts")).unwrap();
    fs::write(
        data.join("receipts/installed-suite.json"),
        serde_json::to_vec_pretty(&json!({
            "schema": "oi.installed-suite/v1",
            "suite_version": "test",
            "products": {
                "workcell": {
                    "revision": "workcell-revision",
                    "asset": "archive.tar.gz",
                    "sha256": "0".repeat(64),
                    "installed_at_ms": 0,
                    "attestation": "attestation",
                    "attestation_locally_verified": false,
                    "root": data.join("products/workcell/workcell-revision/payload").display().to_string(),
                    "executable": data.join("bin/workcell").display().to_string(),
                }
            }
        }))
        .unwrap(),
    )
    .unwrap();
    register_managed_composition(home.path(), "workcell", &data.join("bin/workcell"));

    let removal = output(oi(home.path(), home.path()).args(["remove", "workcell"]));
    assert!(removal.status.success(), "{}", text(&removal.stderr));
    assert!(
        text(&removal.stdout).contains("already absent"),
        "{}",
        text(&removal.stdout)
    );

    let recorded = first_removal_receipt(home.path());
    let outcome = &recorded["products"]["workcell"];
    assert!(
        outcome["already_absent"]
            .as_array()
            .is_some_and(|entries| !entries.is_empty()),
        "{}",
        serde_json::to_string_pretty(&recorded).unwrap()
    );
    assert!(outcome["residuals"].as_array().unwrap().is_empty());
}

#[test]
fn the_suite_spelling_reaches_the_same_remover_and_the_development_field_keeps_its_own_semantics() {
    let home = TempDir::new().unwrap();
    fabricate_managed_install(home.path(), "software-factory", "factory-revision", None);
    register_managed_composition(
        home.path(),
        "software-factory",
        &home
            .path()
            .join("oi-data/products/software-factory/factory-revision/payload"),
    );

    // The spelling the acceptance campaign reached for — including the
    // public-name form of the product id.
    let removal =
        output(oi(home.path(), home.path()).args(["suite", "remove", "Software Factory"]));
    assert!(removal.status.success(), "{}", text(&removal.stderr));
    assert!(
        text(&removal.stdout).contains("Removed software-factory"),
        "{}",
        text(&removal.stdout)
    );
    assert!(!home
        .path()
        .join("oi-data/products/software-factory")
        .exists());

    // Truly unknown suite words still refuse with this surface's own message.
    let unknown = output(oi(home.path(), home.path()).args(["suite", "transmogrify"]));
    assert_eq!(unknown.status.code(), Some(2));
    assert!(
        text(&unknown.stderr).contains("unknown suite command 'transmogrify'"),
        "{}",
        text(&unknown.stderr)
    );
}

#[test]
fn descent_from_the_developmental_core_leaves_the_operational_core_and_the_ground() {
    let home = TempDir::new().unwrap();
    let ground = home.path().join("Central");
    fs::create_dir_all(ground.join("Control")).unwrap();
    fs::write(ground.join("Control/authored.md"), "authored").unwrap();
    // The 0/1/2/3 developmental core, fabricated as managed installs.
    fabricate_managed_install(home.path(), "central", "central-revision", Some("ctrl"));
    fabricate_managed_install(
        home.path(),
        "actuation",
        "actuation-revision",
        Some("actuation"),
    );
    fabricate_managed_install(home.path(), "ai-kit", "aikit-revision", Some("aikit"));
    fabricate_managed_install(
        home.path(),
        "software-factory",
        "factory-revision",
        Some("factory"),
    );
    register_managed_composition(
        home.path(),
        "central",
        &home.path().join("oi-data/bin/ctrl"),
    );
    register_managed_composition(
        home.path(),
        "actuation",
        &home.path().join("oi-data/bin/actuation"),
    );
    register_managed_composition(
        home.path(),
        "ai-kit",
        &home.path().join("oi-data/bin/aikit"),
    );
    register_managed_composition(
        home.path(),
        "software-factory",
        &home.path().join("oi-data/bin/factory"),
    );

    let before = output(oi(home.path(), home.path()).args(["current-world", "--json"]));
    assert!(before.status.success(), "{}", text(&before.stderr));
    let before: Value = serde_json::from_slice(&before.stdout).unwrap();
    assert_eq!(
        before["context_frame"]["present_positions"],
        json!([0, 1, 2, 3])
    );

    let removal = output(oi(home.path(), home.path()).args(["remove", "software-factory"]));
    assert!(removal.status.success(), "{}", text(&removal.stderr));

    // Removing the product yields the 0/1/2 world: no reconstruction, no
    // ground loss — the descent the campaign could not express.
    let world = output(oi(home.path(), home.path()).args(["current-world", "--json"]));
    assert!(world.status.success(), "{}", text(&world.stderr));
    let world: Value = serde_json::from_slice(&world.stdout).unwrap();
    assert_eq!(
        world["context_frame"]["present_positions"],
        json!([0, 1, 2])
    );
    assert_eq!(world["context_frame"]["install_mode"], "0/1/2");
    assert_eq!(world["context_frame"]["install_mode_basis"], "effective");
    assert!(ground.join("Control/authored.md").is_file());
    assert!(home.path().join("oi-data/bin/ctrl").is_file());
    assert!(home.path().join("oi-data/products/actuation").is_dir());
}
