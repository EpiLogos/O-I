//! O:I-only compatibility fixtures for Actuation #58. These exercise the real
//! developer installer and dispatcher, not an Actuation implementation or cutover.
//! A script with a sibling payload and an actually compiled Rust entry use the
//! same native namespace. No provider, installed-machine or human proof is made.
#![cfg(unix)]

use serde_json::{json, Value};
use std::fs;
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::os::unix::process::ExitStatusExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use tempfile::TempDir;

#[derive(Clone, Copy, Debug)]
enum EntryKind {
    Script,
    Rust,
}

const KINDS: [EntryKind; 2] = [EntryKind::Script, EntryKind::Rust];

fn write(path: &Path, content: &str, executable: bool) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, content).unwrap();
    fs::set_permissions(
        path,
        fs::Permissions::from_mode(if executable { 0o755 } else { 0o644 }),
    )
    .unwrap();
}

fn checked(command: &mut Command) -> Output {
    let result = command.output().expect("native process starts");
    assert!(
        result.status.success(),
        "{command:?}\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
    result
}

fn git(root: &Path, args: &[&str]) -> Output {
    checked(
        Command::new("git")
            .args(["-c", "core.hooksPath=/dev/null", "-C"])
            .arg(root)
            .args(args),
    )
}

struct Fixture {
    temp: TempDir,
    config: PathBuf,
    source: PathBuf,
    entry: PathBuf,
    catalogue: Value,
    before: Vec<u8>,
}

impl Fixture {
    fn new(kind: EntryKind) -> Self {
        let temp = TempDir::new().unwrap();
        let config = temp.path().join("config");
        let ground = temp.path().join("ground");
        let source = ground.join("Work/Actuation");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(temp.path().join("home")).unwrap();
        write(
            &source.join(".gitignore"),
            "/material/\n/Cargo.lock\n",
            false,
        );
        write(&source.join("not-executable"), "not an entry\n", false);
        let (relative, build) = match kind {
            EntryKind::Script => {
                // The native script, not O:I, finds its sibling source payload.
                write(
                    &source.join("bin/actuation"),
                    "#!/bin/sh\n. \"${0%/*}/../payload/probe.sh\"\n",
                    true,
                );
                write(
                    &source.join("payload/probe.sh"),
                    "if [ \"${1:-}\" = '--version' ]; then echo 'fixture-entry 1'; exit 0; fi\nif [ \"${1:-}\" = '__signal__' ]; then kill -TERM $$; fi\nprintf 'arg:%s\\n' \"$@\"\n/bin/cat\nprintf 'native-stderr\\n' >&2\nexit 23\n",
                    false,
                );
                ("bin/actuation", json!([]))
            }
            EntryKind::Rust => {
                write(
                    &source.join("Cargo.toml"),
                    "[workspace]\n[package]\nname = \"oi-entry-fixture\"\nversion = \"0.0.0\"\nedition = \"2021\"\n[[bin]]\nname = \"declared-entry\"\npath = \"src/main.rs\"\n",
                    false,
                );
                write(
                    &source.join("src/main.rs"),
                    r#"use std::io::{self, Write};
fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("--version") {
        println!("fixture-entry 1");
        return;
    }
    if args.first().map(String::as_str) == Some("__signal__") {
        let _ = std::process::Command::new("/bin/kill")
            .args(["-TERM", &std::process::id().to_string()]).status();
        std::process::exit(99);
    }
    for arg in args { println!("arg:{arg}"); }
    io::copy(&mut io::stdin(), &mut io::stdout()).unwrap();
    io::stdout().flush().unwrap();
    eprintln!("native-stderr");
    std::process::exit(23);
}
"#,
                    false,
                );
                (
                    "material/release/declared-entry",
                    json!([
                        "cargo",
                        "build",
                        "--offline",
                        "--release",
                        "--target-dir",
                        "material",
                        "--bin",
                        "declared-entry"
                    ]),
                )
            }
        };
        git(&source, &["init", "--initial-branch=main"]);
        git(&source, &["config", "user.name", "O:I descriptor fixture"]);
        git(
            &source,
            &["config", "user.email", "fixture@example.invalid"],
        );
        git(&source, &["config", "commit.gpgsign", "false"]);
        git(&source, &["add", "."]);
        git(&source, &["commit", "-m", "controlled entry fixture"]);
        let origin = temp.path().join("origin.git");
        checked(
            Command::new("git")
                .args(["clone", "--bare"])
                .arg(&source)
                .arg(&origin),
        );
        git(
            &source,
            &["remote", "add", "origin", origin.to_str().unwrap()],
        );
        git(&source, &["fetch", "origin"]);
        git(
            &source,
            &["branch", "--set-upstream-to=origin/main", "main"],
        );
        let revision = String::from_utf8(git(&source, &["rev-parse", "HEAD"]).stdout)
            .unwrap()
            .trim()
            .to_owned();

        let mut catalogue: Value =
            serde_json::from_str(include_str!("../../surfaces.json")).unwrap();
        let surface = catalogue["surfaces"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|surface| surface["id"] == "actuation")
            .unwrap();
        // These are temporary fixture revisions, never changes to suite pins.
        surface["docs_ref"] = json!(revision);
        surface["install"]["ref"] = json!(revision);
        surface["install"]["revision"] = json!(revision);
        surface["native"]["command_revision"] = json!(revision);
        surface["native"]["source_install"] = json!({"build": build, "executable_path": relative});

        let existing = temp.path().join("existing/actuation");
        write(
            &existing,
            "#!/bin/sh\nprintf 'prior-installation\\n'\n",
            true,
        );
        let before = serde_json::to_vec_pretty(&json!({
            "schema": 1,
            "personal_ground": ground,
            "modules": {
                "actuation": {
                    "id": "actuation", "public_name": "Actuation",
                    "native_executable": existing, "version": "prior-version",
                    "docs": "prior-docs", "modality": "developer-source"
                }
            }
        }))
        .unwrap();
        fs::create_dir_all(&config).unwrap();
        fs::write(config.join("composition.json"), &before).unwrap();
        let fixture = Self {
            temp,
            config,
            entry: source.join(relative),
            source,
            catalogue,
            before,
        };
        fixture.publish_catalogue();
        fixture
    }

    fn source_spec(&mut self) -> &mut Value {
        &mut self.catalogue["surfaces"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|surface| surface["id"] == "actuation")
            .unwrap()["native"]["source_install"]
    }

    fn publish_catalogue(&self) {
        fs::write(
            self.config.join("catalogue.json"),
            serde_json::to_vec_pretty(&self.catalogue).unwrap(),
        )
        .unwrap();
    }

    fn oi(&self) -> Command {
        let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
        // The installer may invoke Cargo. Preserve its toolchain locations while
        // confining all O:I state and HOME to this disposable fixture.
        let host_home = PathBuf::from(std::env::var_os("HOME").unwrap());
        command
            .env("OI_HOME", &self.config)
            .env("OI_DATA_HOME", self.temp.path().join("data"))
            .env("HOME", self.temp.path().join("home"))
            .env(
                "RUSTUP_HOME",
                std::env::var_os("RUSTUP_HOME")
                    .unwrap_or_else(|| host_home.join(".rustup").into_os_string()),
            )
            .env(
                "CARGO_HOME",
                std::env::var_os("CARGO_HOME")
                    .unwrap_or_else(|| host_home.join(".cargo").into_os_string()),
            )
            .env_remove("OI_CATALOG")
            .env_remove("OI_ACTUATION_BIN")
            .env_remove("CARGO_TARGET_DIR")
            .env_remove("GIT_DIR")
            .env_remove("GIT_WORK_TREE")
            .env_remove("GIT_INDEX_FILE");
        command
    }

    fn install(&self) -> Output {
        self.oi()
            .args(["dev", "install", "actuation"])
            .output()
            .unwrap()
    }

    fn assert_prior_installation_preserved(&self) {
        assert_eq!(
            fs::read(self.config.join("composition.json")).unwrap(),
            self.before
        );
        let previous = checked(&mut Command::new(
            self.temp.path().join("existing/actuation"),
        ));
        assert_eq!(previous.stdout, b"prior-installation\n");
    }
}

fn exchange(command: &mut Command) -> Output {
    let mut child = command
        .args(["probe", "two words", "--native-option", "\u{03bb}"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(b"native-stdin\n")
        .unwrap();
    child.wait_with_output().unwrap()
}

#[test]
fn descriptor_installs_and_routes_script_and_compiled_rust_with_native_process_parity() {
    for kind in KINDS {
        let fixture = Fixture::new(kind);
        if matches!(kind, EntryKind::Rust) {
            assert!(!fixture.entry.exists(), "Rust entry must actually be built");
        }
        let installed = fixture.install();
        assert!(
            installed.status.success(),
            "{kind:?}: {}",
            String::from_utf8_lossy(&installed.stderr)
        );
        let state: Value =
            serde_json::from_slice(&fs::read(fixture.config.join("composition.json")).unwrap())
                .unwrap();
        let registration = &state["modules"]["actuation"];
        assert_eq!(registration["native_executable"], json!(fixture.entry));
        assert_eq!(registration["root"], json!(fixture.source));
        assert_eq!(registration["modality"], "developer-source");
        assert_eq!(registration["install_source"], "developer-source-build");
        assert_eq!(
            checked(&mut Command::new(
                fixture.temp.path().join("existing/actuation")
            ))
            .stdout,
            b"prior-installation\n"
        );

        // Neither PATH shadowing nor an assumed Node launcher may intercept a
        // registered owner entry. Script payload lookup remains owner-native.
        let poison = fixture.temp.path().join("poison");
        for name in ["actuation", "node"] {
            write(
                &poison.join(name),
                "#!/bin/sh\necho PATH-shadow >&2\nexit 97\n",
                true,
            );
        }
        let direct = exchange(&mut Command::new(&fixture.entry));
        let routed = exchange(fixture.oi().env("PATH", &poison).arg("actuation"));
        assert_eq!(direct.status.code(), Some(23));
        assert_eq!(routed.status.code(), direct.status.code(), "{kind:?}");
        assert_eq!(
            direct.stdout,
            "arg:probe\narg:two words\narg:--native-option\narg:\u{03bb}\nnative-stdin\n"
                .as_bytes()
        );
        assert_eq!(routed.stdout, direct.stdout, "{kind:?}");
        assert_eq!(routed.stderr, b"native-stderr\n", "{kind:?}");
        assert_eq!(routed.stderr, direct.stderr);

        let direct_signal = Command::new(&fixture.entry)
            .arg("__signal__")
            .output()
            .unwrap();
        let routed_signal = fixture
            .oi()
            .env("PATH", &poison)
            .args(["actuation", "__signal__"])
            .output()
            .unwrap();
        assert_eq!(direct_signal.status.signal(), Some(15));
        assert_eq!(routed_signal.status.signal(), direct_signal.status.signal());

        let before_repeat = fs::read(fixture.config.join("composition.json")).unwrap();
        assert!(
            fixture.install().status.success(),
            "repeat install: {kind:?}"
        );
        assert_eq!(
            fs::read(fixture.config.join("composition.json")).unwrap(),
            before_repeat
        );
    }
}

#[test]
fn missing_or_non_executable_declared_entries_preserve_the_prior_installation() {
    for kind in KINDS {
        for relative in ["missing/declared-entry", "not-executable"] {
            let mut fixture = Fixture::new(kind);
            fixture.source_spec()["executable_path"] = json!(relative);
            fixture.publish_catalogue();
            let rejected = fixture.install();
            assert!(!rejected.status.success(), "{kind:?}: {relative}");
            assert!(String::from_utf8_lossy(&rejected.stderr).contains("absent or not executable"));
            fixture.assert_prior_installation_preserved();
        }
    }
}

#[test]
fn failed_declared_build_is_not_hidden_by_an_existing_script_entry() {
    let mut fixture = Fixture::new(EntryKind::Script);
    fixture.source_spec()["build"] = json!(["/bin/sh", "-c", "exit 37"]);
    fixture.publish_catalogue();
    assert!(fixture.entry.is_file());
    let rejected = fixture.install();
    assert!(!rejected.status.success());
    assert!(String::from_utf8_lossy(&rejected.stderr).contains("37"));
    fixture.assert_prior_installation_preserved();
}

#[test]
fn broken_registered_entry_does_not_fall_back_to_path() {
    for kind in KINDS {
        let fixture = Fixture::new(kind);
        assert!(fixture.install().status.success());
        fs::remove_file(&fixture.entry).unwrap();
        let poison = fixture.temp.path().join("poison");
        write(
            &poison.join("actuation"),
            "#!/bin/sh\necho WRONG-fallback\n",
            true,
        );
        let result = fixture
            .oi()
            .env("PATH", poison)
            .args(["actuation", "--version"])
            .output()
            .unwrap();
        assert!(!result.status.success());
        assert!(!String::from_utf8_lossy(&result.stdout).contains("WRONG-fallback"));
        assert!(String::from_utf8_lossy(&result.stderr).contains("cannot exec"));
    }
}

#[test]
fn invalid_descriptor_does_not_fall_back_to_embedded_install_assumptions() {
    let mut fixture = Fixture::new(EntryKind::Script);
    fixture.source_spec()["executable_path"] = Value::Null;
    fixture.publish_catalogue();
    let rejected = fixture.install();
    assert!(!rejected.status.success());
    assert!(
        String::from_utf8_lossy(&rejected.stderr).contains("native.source_install.executable_path")
    );
    fixture.assert_prior_installation_preserved();
}
