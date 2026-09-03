#[cfg(unix)]
mod unix {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::os::unix::process::ExitStatusExt;
    use std::path::Path;
    use std::process::{Command, Output};
    use tempfile::TempDir;

    fn fake_executable(dir: &Path, name: &str, exit: i32) {
        let path = dir.join(name);
        fs::write(
            &path,
            format!(
                "#!/bin/sh\nif [ \"${{1:-}}\" = '__signal__' ]; then\n  kill -TERM $$\nfi\nprintf 'native:{name}:%s:%s\\n' \"${{1:-}}\" \"${{2:-}}\"\nexit {exit}\n"
            ),
        )
        .expect("write fake native executable");
        let mut permissions = fs::metadata(&path).expect("metadata").permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions).expect("chmod fake native executable");
    }

    fn run_oi(home: &TempDir, bin: &TempDir, selector: &str) -> Output {
        Command::new(env!("CARGO_BIN_EXE_oi"))
            .args([selector, "probe", "--json"])
            .env("OI_HOME", home.path())
            .env("PATH", bin.path())
            .output()
            .expect("run O:I CLI")
    }

    #[test]
    fn all_six_canonical_namespaces_preserve_native_argv_stdout_and_exit() {
        let home = TempDir::new().expect("home");
        let bin = TempDir::new().expect("bin");
        let cases = [
            ("central", "ctrl", 11),
            ("actuation", "actuation", 12),
            ("aikit", "aikit", 13),
            ("factory", "factory", 14),
            ("workcell", "workcell", 15),
            ("ql", "ql", 16),
        ];

        for (_, executable, exit) in cases {
            fake_executable(bin.path(), executable, exit);
        }

        for (namespace, executable, exit) in cases {
            let output = run_oi(&home, &bin, namespace);
            assert_eq!(output.status.code(), Some(exit), "{namespace}");
            assert_eq!(
                String::from_utf8_lossy(&output.stdout),
                format!("native:{executable}:probe:--json\n"),
                "{namespace}"
            );
            assert!(output.stderr.is_empty(), "{namespace}");
        }
    }

    #[test]
    fn compatibility_aliases_are_identical_to_canonical_routes() {
        let home = TempDir::new().expect("home");
        let bin = TempDir::new().expect("bin");
        fake_executable(bin.path(), "ctrl", 0);
        fake_executable(bin.path(), "aikit", 0);

        for (canonical, compatibility) in [("central", "ctrl"), ("aikit", "kit")] {
            let canonical_output = run_oi(&home, &bin, canonical);
            let compatibility_output = run_oi(&home, &bin, compatibility);
            assert!(canonical_output.status.success(), "{canonical}");
            assert!(compatibility_output.status.success(), "{compatibility}");
            assert_eq!(canonical_output.stdout, compatibility_output.stdout);
            assert_eq!(canonical_output.stderr, compatibility_output.stderr);
        }
    }

    #[test]
    fn unix_passthrough_preserves_native_signal_termination() {
        let home = TempDir::new().expect("home");
        let bin = TempDir::new().expect("bin");
        fake_executable(bin.path(), "ctrl", 0);

        let direct = Command::new(bin.path().join("ctrl"))
            .arg("__signal__")
            .output()
            .expect("run native command directly");
        let through_oi = Command::new(env!("CARGO_BIN_EXE_oi"))
            .args(["central", "__signal__"])
            .env("OI_HOME", home.path())
            .env("PATH", bin.path())
            .output()
            .expect("run native command through O:I");

        assert_eq!(direct.status.signal(), Some(15));
        assert_eq!(through_oi.status.signal(), direct.status.signal());
        assert_eq!(through_oi.stdout, direct.stdout);
        assert_eq!(through_oi.stderr, direct.stderr);
    }
}
