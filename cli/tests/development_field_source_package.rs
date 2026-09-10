//! Portable packaging D: shell fixture payloads are not native owner C/P/M/H.
#![cfg(unix)]
use serde_json::{json, Value};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

fn run(root: &Path, args: &[&str]) -> Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
    let mut paths = vec![root.join("poison")];
    paths.extend(std::env::split_paths(&std::env::var_os("PATH").unwrap()));
    command
        .current_dir(root)
        .env("OI_HOME", root.join("config"))
        .env("OI_DATA_HOME", root.join("data"))
        .env("PATH", std::env::join_paths(paths).unwrap())
        .args(args);
    for name in [
        "OI_CENTRAL_CTRL_BIN",
        "OI_ACTUATION_BIN",
        "OI_AIKIT_BIN",
        "OI_AIKIT_SESSION_SPACE_BIN",
        "OI_FACTORY_BIN",
        "OI_WORKCELL_BIN",
        "OI_QL_BIN",
    ] {
        command.env_remove(name);
    }
    command.output().unwrap()
}
fn success(output: Output) -> Output {
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    output
}
fn value(root: &Path, args: &[&str]) -> Value {
    serde_json::from_slice(&success(run(root, args)).stdout).unwrap()
}
fn save(path: &Path, value: &Value) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, serde_json::to_vec_pretty(value).unwrap()).unwrap();
}
fn executable(path: &Path, body: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, body).unwrap();
    fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
}
fn git(root: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .env("GIT_AUTHOR_NAME", "Deterministic fixture")
        .env("GIT_AUTHOR_EMAIL", "fixture@example.invalid")
        .env("GIT_COMMITTER_NAME", "Deterministic fixture")
        .env("GIT_COMMITTER_EMAIL", "fixture@example.invalid")
        .env("GIT_AUTHOR_DATE", "2026-09-10T00:00:00Z")
        .env("GIT_COMMITTER_DATE", "2026-09-10T00:00:00Z")
        .output()
        .unwrap();
    String::from_utf8(success(output).stdout)
        .unwrap()
        .trim()
        .into()
}
fn admit(root: &Path, source: &Path, catalogue: &mut Value, composition: &mut Value) {
    let revision = git(source, &["rev-parse", "HEAD"]);
    for surface in catalogue["surfaces"].as_array_mut().unwrap() {
        if surface["id"] == "actuation" {
            surface["native"]["command_revision"] = revision.clone().into();
            surface["install"]["ref"] = revision.clone().into();
            surface["install"]["revision"] = revision.clone().into();
        }
    }
    composition["modules"]["actuation"]["version"] = revision.into();
    composition["modules"]["actuation"]["native_executable"] =
        source.join("bin/actuation").display().to_string().into();
    save(&root.join("config/composition.json"), composition);
    save(&root.join("catalogue.json"), catalogue);
    success(run(root, &["catalogue", "adopt", "catalogue.json"]));
}

#[test]
fn native_source_payload_is_immutable_incremental_and_verified_beyond_its_launcher() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    let mut catalogue: Value =
        serde_json::from_str(include_str!("../../surfaces.json")).unwrap();
    let mut composition = json!({"schema":1,"modules":{}});
    fs::create_dir_all(root.join("poison")).unwrap();
    for surface in catalogue["surfaces"].as_array().unwrap() {
        let id = surface["id"].as_str().unwrap();
        let bin = surface["native"]["executable"].as_str().unwrap();
        let path = root.join("bin").join(bin);
        executable(&path, "#!/bin/sh\necho fixture-only\n");
        executable(&root.join("poison").join(bin), "#!/bin/sh\nexit 91\n");
        composition["modules"][id] = json!({"id":id,"public_name":id,
            "native_executable":path,"version":surface["native"]["command_revision"],
            "docs":"","modality":"developer-source","install_source":"deterministic-fixture"});
    }
    executable(
        &root.join("poison/aikit-session-space"),
        "#!/bin/sh\necho stale-companion\n",
    );
    let source = root.join("source");
    fs::create_dir_all(source.join("cli")).unwrap();
    save(
        &source.join(".oi/product.json"),
        &json!({"id":"actuation","artifact":{"entry":"bin/actuation"}}),
    );
    executable(
        &source.join("bin/actuation"),
        "#!/bin/sh\n. \"$(dirname \"$0\")/../cli/value.sh\"\nprintf '%s\\n' \"$MESSAGE\"\n",
    );
    fs::write(source.join("cli/value.sh"), "MESSAGE=first\n").unwrap();
    git(&source, &["init", "-q"]);
    git(&source, &["add", "."]);
    git(&source, &["commit", "-qm", "first fixture payload"]);
    let first_revision = git(&source, &["rev-parse", "HEAD"]);
    admit(root, &source, &mut catalogue, &mut composition);
    success(run(root, &["suite", "channel", "source"]));
    let first = value(root, &["suite", "update", "--json"]);
    assert_eq!(first["acquired"].as_array().unwrap().len(), 6);
    let first_active = first["active"].clone();
    let first_package = PathBuf::from(first_active["products"]["actuation"]["root"].as_str().unwrap());
    assert_eq!(git(&first_package, &["rev-parse", "HEAD"]), first_revision);
    assert!(git(&first_package, &["remote"]).is_empty());
    assert_eq!(
        String::from_utf8(success(run(root, &["actuation", "probe"])).stdout)
            .unwrap()
            .trim(),
        "first"
    );
    assert_eq!(value(root, &["suite", "check", "--json"])["ok"], true);
    let unchanged = value(root, &["suite", "update", "--json"]);
    assert_eq!(unchanged["outcome"], "already-current");
    assert_eq!(unchanged["active"], first_active);

    // Changing developer source does not mutate the independent active package.
    fs::write(source.join("cli/value.sh"), "MESSAGE=second\n").unwrap();
    success(run(root, &["suite", "check", "--json"]));
    assert!(!run(root, &["suite", "update"]).status.success());
    assert_eq!(value(root, &["suite", "status", "--json"])["active"], first_active);
    git(&source, &["add", "."]);
    git(&source, &["commit", "-qm", "second fixture payload"]);
    admit(root, &source, &mut catalogue, &mut composition);
    let second = value(root, &["suite", "update", "--json"]);
    assert_eq!(second["acquired"], json!(["actuation"]));
    assert_eq!(second["reused"].as_array().unwrap().len(), 5);
    assert_ne!(
        first_active["products"]["actuation"]["artifact"],
        second["active"]["products"]["actuation"]["artifact"]
    );
    assert_eq!(
        first_active["products"]["actuation"]["sha256"],
        second["active"]["products"]["actuation"]["sha256"],
        "the launcher is unchanged; its package identity must still change"
    );
    assert_eq!(
        value(root, &["suite", "rollback", "--json"])["active"],
        first_active
    );
    let current = value(root, &["suite", "update", "--json"]);
    let active_root = PathBuf::from(current["active"]["products"]["actuation"]["root"].as_str().unwrap());
    fs::write(active_root.join("cli/value.sh"), "MESSAGE=unreceipted\n").unwrap();
    for args in [
        vec!["suite", "check", "--json"],
        vec!["verify", "--json"],
        vec!["where", "actuation", "--json"],
        vec!["actuation", "probe"],
        vec!["aikit-session-space", "project-context"],
    ] {
        assert!(!run(root, &args).status.success(), "{args:?}");
    }
    let repaired = value(root, &["suite", "repair", "--json"]);
    assert_eq!(repaired["acquired"], json!(["actuation"]));
    assert_eq!(repaired["reused"].as_array().unwrap().len(), 5);
    success(run(root, &["verify", "--json"]));
    let repaired_root = PathBuf::from(repaired["active"]["products"]["actuation"]["root"].as_str().unwrap());
    fs::write(repaired_root.join("unrecorded.js"), "// not admitted\n").unwrap();
    assert!(!run(root, &["suite", "check"]).status.success());
}
