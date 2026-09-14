//! Integration proof for the receipt-owned Desktop install lifecycle
//! (`oi desktop install|remove|status`).
//!
//! The tests pack a synthetic bundle archive with `tar` (the same layout
//! the packaging pipeline emits: `oi-desktop-bundle/{BUNDLE.json,
//! footprint.json, app/}`) for the *host* target, then drive the compiled
//! `oi` binary against a sandboxed `OI_DATA_HOME` and `HOME`. They prove:
//! plan before mutation; checksum verification; receipt-owned install;
//! removal bounded by the receipt with ground untouched; and the clean
//! refusal when nothing is installed. The first real linux bundle build is
//! proved separately (CI job desktop-bundle), not faked here.

#![cfg(unix)]

use serde_json::Value;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use tempfile::TempDir;

const FOOTPRINT_PATH: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../desktop/install-footprint.json");

fn host_target() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        (os, arch) => panic!("desktop lifecycle tests have no bundle target for {os}/{arch}"),
    }
}

fn oi(data_home: &Path, home: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
    command.env("OI_DATA_HOME", data_home).env("HOME", home);
    command
}

fn output(command: &mut Command) -> Output {
    let output = command.output().expect("oi binary should run");
    output
}

fn assert_success(output: &Output) {
    assert!(
        output.status.success(),
        "expected success, got {:?}\nstdout:\n{}\nstderr:\n{}",
        output.status,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

fn assert_refusal(output: &Output, needle: &str) {
    assert!(
        !output.status.success(),
        "expected refusal, got success\nstdout:\n{}",
        String::from_utf8_lossy(&output.stdout)
    );
    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        combined.contains(needle),
        "expected refusal mentioning '{needle}', got:\n{combined}"
    );
}

fn write_executable(path: &Path, body: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, body).unwrap();
    let mut permissions = fs::metadata(path).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).unwrap();
}

/// The footprint the test bundle carries: the repository's real contract,
/// filtered to the host target so the bundle is installable on this machine.
fn test_footprint() -> String {
    let real: Value = serde_json::from_str(&fs::read_to_string(FOOTPRINT_PATH).unwrap()).unwrap();
    let target = host_target();
    let mut footprint = real.clone();
    let targets = footprint["targets"].as_object().unwrap().clone();
    let mut host_targets = serde_json::Map::new();
    if let Some(declared) = targets.get(target) {
        host_targets.insert(target.to_string(), declared.clone());
    } else {
        // macOS x86_64 has no declared target; mirror the arm64 macOS shape.
        let declared = targets
            .get("aarch64-apple-darwin")
            .expect("footprint must declare a darwin target");
        host_targets.insert(target.to_string(), declared.clone());
    }
    footprint["targets"] = Value::Object(host_targets);
    serde_json::to_string_pretty(&footprint).unwrap()
}

/// Pack a bundle for the host target and return (archive path, staging dir).
fn pack_bundle(data_home: &Path, home: &Path, version: &str) -> (PathBuf, TempDir) {
    let _ = home;
    let target = host_target();
    let stage = TempDir::new().unwrap();
    let bundle_root = stage.path().join("oi-desktop-bundle");
    let app_dir = bundle_root.join("app");
    fs::create_dir_all(&app_dir).unwrap();

    let (app_entry, app_kind) = if target.ends_with("darwin") {
        write_executable(
            &app_dir.join("O-I.app/Contents/MacOS/O-I"),
            "#!/bin/sh\necho oi-cradle\n",
        );
        ("app/O-I.app".to_string(), "app-bundle".to_string())
    } else {
        write_executable(&app_dir.join("oi-cradle.AppImage"), "#!/bin/sh\necho oi-cradle\n");
        ("app/oi-cradle.AppImage".to_string(), "single-executable".to_string())
    };
    fs::write(app_dir.join("icon.png"), b"png-bytes").unwrap();
    fs::write(bundle_root.join("footprint.json"), test_footprint()).unwrap();

    let name = format!("oi-cradle-{version}-{target}.tar.gz");
    let manifest = serde_json::json!({
        "schema": "oi.desktop-bundle/v1",
        "name": name,
        "version": version,
        "target": target,
        "app_id": "org.epilogos.oi.cradle",
        "source_revision": "0".repeat(40),
        "created_at": "2026-09-14T00:00:00Z",
        "app_entry": app_entry,
        "app_kind": app_kind,
    });
    fs::write(
        bundle_root.join("BUNDLE.json"),
        serde_json::to_string_pretty(&manifest).unwrap(),
    )
    .unwrap();

    let out_dir = data_home.join("bundles");
    fs::create_dir_all(&out_dir).unwrap();
    let archive = out_dir.join(&name);
    let status = Command::new("tar")
        .args(["-czf"])
        .arg(&archive)
        .arg("-C")
        .arg(stage.path())
        .arg("oi-desktop-bundle")
        .status()
        .expect("tar should run");
    assert!(status.success(), "tar packing failed");
    let digest = sha256_of(&archive);
    fs::write(
        PathBuf::from(format!("{}.sha256", archive.display())),
        format!("{digest}  {name}\n"),
    )
    .unwrap();
    (archive, stage)
}

fn sha256_of(path: &Path) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(fs::read(path).unwrap());
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

struct Sandbox {
    _root: TempDir,
    data_home: PathBuf,
    home: PathBuf,
}

fn sandbox(_name: &str) -> Sandbox {
    let root = TempDir::new().unwrap();
    let data_home = root.path().join("data");
    let home = root.path().join("home");
    fs::create_dir_all(&data_home).unwrap();
    fs::create_dir_all(&home).unwrap();
    Sandbox {
        _root: root,
        data_home,
        home,
    }
}

impl Sandbox {
    fn installed_receipt(&self) -> PathBuf {
        self.data_home.join("receipts/installed-desktop.json")
    }

    fn removed_receipt(&self) -> PathBuf {
        self.data_home.join("receipts/removed-desktop.json")
    }

    /// The registration path this host's footprint declares, expanded.
    fn registration_path(&self) -> PathBuf {
        if host_target().ends_with("darwin") {
            self.home.join("Applications/O-I.app")
        } else {
            self.home
                .join(".local/share/applications/org.epilogos.oi.cradle.desktop")
        }
    }

    /// Establish Central ground markers that removal must never touch.
    fn seed_ground(&self) {
        for relative in [
            "Central/Control/user/day.md",
            "Central/Work/ProjectA/notes.md",
            "Central/.central/native-token",
        ] {
            let path = self.home.join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(&path, format!("authored: {relative}\n")).unwrap();
        }
    }

    fn assert_ground_untouched(&self) {
        for relative in [
            "Central/Control/user/day.md",
            "Central/Work/ProjectA/notes.md",
            "Central/.central/native-token",
        ] {
            let path = self.home.join(relative);
            assert!(
                path.is_file(),
                "Central ground file {} was removed",
                path.display()
            );
            assert_eq!(
                fs::read_to_string(&path).unwrap(),
                format!("authored: {relative}\n"),
                "Central ground file {} was modified",
                path.display()
            );
        }
    }
}

fn install(sandbox: &Sandbox, archive: &Path, extra: &[&str]) -> Output {
    let mut args = vec![
        "desktop".to_string(),
        "install".to_string(),
        "--bundle".to_string(),
        archive.display().to_string(),
    ];
    args.extend(extra.iter().map(|s| s.to_string()));
    output(oi(&sandbox.data_home, &sandbox.home).args(&args))
}

fn expected_executable(sandbox: &Sandbox) -> PathBuf {
    if host_target().ends_with("darwin") {
        sandbox
            .home
            .join("Applications/O-I.app/Contents/MacOS/O-I")
    } else {
        sandbox.data_home.join("bin/oi-cradle")
    }
}

#[test]
fn plan_recognizes_before_any_mutation() {
    let sandbox = sandbox("plan");
    let (archive, _stage) = pack_bundle(&sandbox.data_home, &sandbox.home, "0.1.0");
    sandbox.seed_ground();

    let out = install(&sandbox, &archive, &["--plan"]);
    assert_success(&out);

    // Recognition only: no receipt, no managed payload, no registrations.
    assert!(!sandbox.installed_receipt().exists(), "plan wrote an install receipt");
    assert!(
        !sandbox.data_home.join("products/desktop").exists(),
        "plan created managed payload state"
    );
    assert!(
        !sandbox.registration_path().exists(),
        "plan created a desktop registration"
    );
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(stdout.contains("Install plan"), "plan not printed:\n{stdout}");
    assert!(stdout.contains("0/1/2"), "plan does not disclose the default backing:\n{stdout}");
    assert!(
        stdout.contains("Never owned by this installer"),
        "plan does not disclose the never-owned boundary:\n{stdout}"
    );
}

#[test]
fn install_writes_receipt_and_owned_resources() {
    let sandbox = sandbox("install");
    let (archive, _stage) = pack_bundle(&sandbox.data_home, &sandbox.home, "0.1.0");
    sandbox.seed_ground();

    let out = install(&sandbox, &archive, &["--json"]);
    assert_success(&out);
    let receipt: Value =
        serde_json::from_str(&fs::read_to_string(sandbox.installed_receipt()).unwrap()).unwrap();
    assert_eq!(receipt["schema"], "oi.installed-desktop/v1");
    assert_eq!(receipt["backing"]["requested"], "0/1/2");
    assert_eq!(
        receipt["backing"]["products"],
        serde_json::json!(["central", "actuation", "ai-kit"])
    );
    assert_eq!(receipt["bundle"]["sha256"], sha256_of(&archive));

    // Every owned resource exists on disk.
    for resource in receipt["owned_resources"].as_array().unwrap() {
        let path = PathBuf::from(resource["path"].as_str().unwrap());
        assert!(path.exists(), "owned resource {} missing after install", path.display());
    }
    // The declared encounter surface exists and is executable.
    let executable = expected_executable(&sandbox);
    assert!(executable.exists(), "executable {} missing", executable.display());
    let mode = fs::metadata(&executable).unwrap().permissions().mode();
    assert_eq!(mode & 0o111, 0o111, "executable {mode:o} not executable");

    sandbox.assert_ground_untouched();
}

#[test]
fn install_refuses_checksum_mismatch_without_mutating() {
    let sandbox = sandbox("checksum");
    let (archive, _stage) = pack_bundle(&sandbox.data_home, &sandbox.home, "0.1.0");
    let wrong = "f".repeat(64);

    let out = install(&sandbox, &archive, &["--sha256", &wrong]);
    assert_refusal(&out, "checksum mismatch");
    assert!(!sandbox.installed_receipt().exists());
}

#[test]
fn install_rejects_unknown_backing_and_records_selected_backing() {
    let sandbox = sandbox("backing");
    let (archive, _stage) = pack_bundle(&sandbox.data_home, &sandbox.home, "0.1.0");

    let out = install(&sandbox, &archive, &["--backing", "9/9"]);
    assert_refusal(&out, "unknown backing composition");
    assert!(!sandbox.installed_receipt().exists());

    let out = install(&sandbox, &archive, &["--backing", "0/1"]);
    assert_success(&out);
    let receipt: Value =
        serde_json::from_str(&fs::read_to_string(sandbox.installed_receipt()).unwrap()).unwrap();
    assert_eq!(receipt["backing"]["requested"], "0/1");
    assert_eq!(receipt["backing"]["label"], "Central + Actuation");
}

#[test]
fn install_refuses_foreign_file_without_authorization_then_replaces_and_explains() {
    let sandbox = sandbox("foreign");
    let (archive, _stage) = pack_bundle(&sandbox.data_home, &sandbox.home, "0.1.0");

    // A pre-existing file squatting on a registration path.
    let registration = sandbox.registration_path();
    fs::create_dir_all(registration.parent().unwrap()).unwrap();
    match host_target().ends_with("darwin") {
        true => fs::create_dir_all(registration.join("Contents/MacOS")).unwrap(),
        false => fs::write(&registration, "[Desktop Entry]\nName=Foreign\n").unwrap(),
    }

    let out = install(&sandbox, &archive, &["--plan"]);
    assert_success(&out);
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("replace-foreign"),
        "plan does not disclose the foreign registration:\n{stdout}"
    );

    let out = install(&sandbox, &archive, &[]);
    assert_refusal(&out, "--replace-foreign");
    assert!(!sandbox.installed_receipt().exists());

    let out = install(&sandbox, &archive, &["--replace-foreign"]);
    assert_success(&out);
    let receipt: Value =
        serde_json::from_str(&fs::read_to_string(sandbox.installed_receipt()).unwrap()).unwrap();
    let dispositions: Vec<&str> = receipt["owned_resources"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|r| r["path"] == registration.display().to_string())
        .filter_map(|r| r["disposition"].as_str())
        .collect();
    assert_eq!(dispositions, vec!["replaced-foreign"]);

    // Removal deletes what we replaced and explains the residual honestly.
    let out = output(
        oi(&sandbox.data_home, &sandbox.home)
            .args(["desktop", "remove", "--json"]),
    );
    assert_success(&out);
    assert!(!registration.exists(), "replaced registration survived removal");
    let removal: Value =
        serde_json::from_str(&fs::read_to_string(sandbox.removed_receipt()).unwrap()).unwrap();
    let residuals = removal["residuals"].as_array().unwrap();
    assert!(
        residuals.iter().any(|r| {
            r.as_str().unwrap().contains("pre-existing content was not preserved")
        }),
        "removal does not explain the replaced-foreign residual:\n{residuals:?}"
    );
}

#[test]
fn status_discloses_installed_state_honestly() {
    let sandbox = sandbox("status");
    let (archive, _stage) = pack_bundle(&sandbox.data_home, &sandbox.home, "0.1.0");

    let out = output(
        oi(&sandbox.data_home, &sandbox.home)
            .args(["desktop", "status", "--json"]),
    );
    assert_success(&out);
    let status: Value = serde_json::from_str(&String::from_utf8_lossy(&out.stdout)).unwrap();
    assert_eq!(status["state"], "not-installed");

    let out = install(&sandbox, &archive, &[]);
    assert_success(&out);

    let out = output(
        oi(&sandbox.data_home, &sandbox.home)
            .args(["desktop", "status", "--json"]),
    );
    assert_success(&out);
    let status: Value = serde_json::from_str(&String::from_utf8_lossy(&out.stdout)).unwrap();
    assert_eq!(status["state"], "installed");
    assert_eq!(status["receipt"]["bundle"], archive.file_name().unwrap().to_str().unwrap());
    let resources = status["resources"].as_array().unwrap();
    assert!(
        resources.iter().all(|r| r["state"] == "present"),
        "a freshly installed resource is not present:\n{resources:?}"
    );

    // Losing a managed resource degrades the state — no pretending.
    let payload = PathBuf::from(status["receipt"]["payload_root"].as_str().unwrap());
    fs::remove_dir_all(&payload).unwrap();
    let out = output(
        oi(&sandbox.data_home, &sandbox.home)
            .args(["desktop", "status", "--json"]),
    );
    assert_success(&out);
    let status: Value = serde_json::from_str(&String::from_utf8_lossy(&out.stdout)).unwrap();
    assert_eq!(status["state"], "degraded");
}

#[test]
fn remove_deletes_only_owned_resources_and_leaves_ground_intact() {
    let sandbox = sandbox("remove");
    let (archive, _stage) = pack_bundle(&sandbox.data_home, &sandbox.home, "0.1.0");
    sandbox.seed_ground();

    assert_success(&install(&sandbox, &archive, &[]));
    let receipt: Value =
        serde_json::from_str(&fs::read_to_string(sandbox.installed_receipt()).unwrap()).unwrap();
    let owned: Vec<PathBuf> = receipt["owned_resources"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| PathBuf::from(r["path"].as_str().unwrap()))
        .collect();
    assert!(!owned.is_empty());

    let out = output(
        oi(&sandbox.data_home, &sandbox.home)
            .args(["desktop", "remove", "--json"]),
    );
    assert_success(&out);

    for path in &owned {
        assert!(!path.exists(), "owned resource {} survived removal", path.display());
    }
    assert!(!sandbox.installed_receipt().exists(), "install receipt not retired");
    sandbox.assert_ground_untouched();

    let removal: Value =
        serde_json::from_str(&fs::read_to_string(sandbox.removed_receipt()).unwrap()).unwrap();
    assert_eq!(removal["schema"], "oi.removed-desktop/v1");
    assert_eq!(removal["ground_untouched"], true);
    assert_eq!(
        removal["removed"].as_array().unwrap().len(),
        owned.len(),
        "removal receipt does not account for every owned resource"
    );

    // Removing again is a clean refusal — nothing is installed.
    let out = output(
        oi(&sandbox.data_home, &sandbox.home)
            .args(["desktop", "remove"]),
    );
    assert_refusal(&out, "no installed Desktop is recorded");
}

#[test]
fn remove_of_never_installed_is_a_clean_refusal() {
    let sandbox = sandbox("never-installed");
    let out = output(
        oi(&sandbox.data_home, &sandbox.home)
            .args(["desktop", "remove"]),
    );
    assert_refusal(&out, "nothing to remove");
    assert!(!sandbox.removed_receipt().exists(), "refusal wrote a removal receipt");
    assert!(!sandbox.installed_receipt().exists());
}

#[test]
fn recorded_route_fails_honestly_until_a_bundle_is_recorded() {
    let sandbox = sandbox("recorded");
    let out = output(
        oi(&sandbox.data_home, &sandbox.home)
            .args(["desktop", "install", "--recorded"]),
    );
    assert_refusal(&out, "records no desktop bundle asset");
    assert!(!sandbox.installed_receipt().exists());
}
