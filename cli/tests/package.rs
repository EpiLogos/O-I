//! `oi package validate` against the written-before-the-loader specimen in
//! `docs/proposals/oi-package-v1/specimen/`: a valid package passes with its
//! inventory counted and its trust state disclosed; a missing hashed file, a
//! drifting byte, and a missing declared entry each refuse with the file
//! named. These are the exact negatives the proposal promised the specimen
//! would make honest.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tempfile::TempDir;

const SPECIMEN: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../docs/proposals/oi-package-v1/specimen"
);

fn oi(home: &Path, path: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
    command.env("OI_HOME", home).current_dir(path);
    command
}

fn copy_specimen(label: &str) -> (TempDir, PathBuf) {
    let temp = TempDir::new().unwrap();
    let destination = temp.path().join(format!("specimen-{label}"));
    copy_dir(Path::new(SPECIMEN), &destination);
    (temp, destination)
}

fn copy_dir(source: &Path, destination: &Path) {
    fs::create_dir_all(destination).unwrap();
    for entry in fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        let target = destination.join(entry.file_name());
        if entry.path().is_dir() {
            copy_dir(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), &target).unwrap();
        }
    }
}

#[test]
fn the_specimen_package_validates_with_its_inventory_counted() {
    let temp = TempDir::new().unwrap();
    let output = oi(temp.path(), temp.path())
        .arg("package")
        .arg("validate")
        .arg(SPECIMEN)
        .arg("")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "the complete specimen must validate: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("\"valid\": true"), "{stdout}");
    assert!(stdout.contains("com.example.workbench"), "{stdout}");
    // Six hashed package files (the manifest excepts itself) plus the source
    // contribution's own per-file inventory, each entry disclosed.
    assert!(stdout.contains("native-source-contribution"), "{stdout}");
    assert!(stdout.contains("configuration-contribution"), "{stdout}");
    assert!(
        stdout.contains("\"reviewed\": false"),
        "trust is disclosed: {stdout}"
    );
}

#[test]
fn a_missing_hashed_file_is_refused_with_the_file_named() {
    let temp = TempDir::new().unwrap();
    let (_temp, package) = copy_specimen("missing");
    fs::remove_file(package.join("contributions/workbench-ui/src/workbench.css")).unwrap();

    let output = oi(temp.path(), temp.path())
        .arg("package")
        .arg("validate")
        .arg(&package)
        .output()
        .unwrap();
    assert!(
        !output.status.success(),
        "a hole in the inventory must refuse"
    );
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("workbench.css") && stderr.contains("absent"),
        "the refusal names the missing file: {stderr}"
    );
}

#[test]
fn a_drifted_byte_is_refused_with_the_digest_named() {
    let temp = TempDir::new().unwrap();
    let (_temp, package) = copy_specimen("drift");
    let panel = package.join("contributions/workbench-ui/src/WorkbenchPanel.tsx");
    let original = fs::read_to_string(&panel).unwrap();
    fs::write(&panel, original.replace("null", "null; /* drifted */")).unwrap();

    let output = oi(temp.path(), temp.path())
        .arg("package")
        .arg("validate")
        .arg(&package)
        .output()
        .unwrap();
    assert!(!output.status.success(), "a drifting byte must refuse");
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("hashes to") && stderr.contains("declares"),
        "the refusal names both digests: {stderr}"
    );
}

#[test]
fn a_declared_entry_missing_from_disk_is_refused_before_any_host_sees_it() {
    // The proposal's original specimen shipped exactly this negative: a
    // contribution whose declared entry file is absent. The loader must
    // refuse it regardless of a clean whole-package inventory.
    let temp = TempDir::new().unwrap();
    let (_temp, package) = copy_specimen("absent-entry");
    fs::remove_file(package.join("contributions/workbench-ui/src/index.ts")).unwrap();
    // Repair the whole-package inventory for the removed file so ONLY the
    // entry law can fire: recompute oi.package.json without that line is not
    // enough (its own hashes would drift), so rebuild the manifest field by
    // removing the inventory entry and its hash.
    let manifest_path = package.join("oi.package.json");
    let manifest: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&manifest_path).unwrap()).unwrap();
    let mut files = manifest["files_sha256"].as_object().unwrap().clone();
    files.remove("contributions/workbench-ui/src/index.ts");
    let mut fixed = manifest.clone();
    fixed["files_sha256"] = serde_json::Value::Object(files);
    fs::write(
        &manifest_path,
        serde_json::to_string_pretty(&fixed).unwrap(),
    )
    .unwrap();

    let output = oi(temp.path(), temp.path())
        .arg("package")
        .arg("validate")
        .arg(&package)
        .output()
        .unwrap();
    assert!(
        !output.status.success(),
        "a missing declared entry must refuse even with a clean package inventory"
    );
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("index.ts") && stderr.contains("absent"),
        "the refusal names the entry: {stderr}"
    );
}
