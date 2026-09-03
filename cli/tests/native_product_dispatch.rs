#[cfg(unix)]
mod unix {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::path::Path;
    use std::process::{Command, Output};
    use tempfile::TempDir;

    fn fake_executable(dir: &Path, name: &str, exit: i32) {
        let path = dir.join(name);
        fs::write(
            &path,
            format!("#!/bin/sh\nprintf '%s\\n' \"$@\"\nexit {exit}\n"),
        )
        .expect("write fake executable");
        let mut permissions = fs::metadata(&path).expect("metadata").permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions).expect("chmod fake executable");
    }

    fn run_oi(temp: &TempDir, selector: &str, args: &[&str]) -> Output {
        let mut command = Command::new(env!("CARGO_BIN_EXE_oi"));
        command.arg(selector).args(args);
        command.env("OI_HOME", temp.path().join("oi-home"));
        command.env(
            "PATH",
            format!(
                "{}:{}",
                temp.path().display(),
                std::env::var("PATH").unwrap_or_default()
            ),
        );
        command.output().expect("run O:I CLI")
    }

    #[test]
    fn canonical_namespace_preserves_native_argv_and_exit_status() {
        let temp = TempDir::new().expect("tempdir");
        fake_executable(temp.path(), "ctrl", 17);

        let output = run_oi(&temp, "central", &["probe", "--json"]);
        assert_eq!(output.status.code(), Some(17));
        assert_eq!(String::from_utf8_lossy(&output.stdout), "probe\n--json\n");
    }

    #[test]
    fn compatibility_alias_reaches_the_same_native_executable() {
        let temp = TempDir::new().expect("tempdir");
        fake_executable(temp.path(), "ctrl", 0);

        let canonical = run_oi(&temp, "central", &["same", "receipt"]);
        let compatibility = run_oi(&temp, "ctrl", &["same", "receipt"]);
        assert!(canonical.status.success());
        assert!(compatibility.status.success());
        assert_eq!(canonical.stdout, compatibility.stdout);
        assert_eq!(
            String::from_utf8_lossy(&canonical.stdout),
            "same\nreceipt\n"
        );
    }

    #[test]
    fn aikit_compatibility_alias_preserves_owner_arguments() {
        let temp = TempDir::new().expect("tempdir");
        fake_executable(temp.path(), "aikit", 0);

        let output = run_oi(&temp, "kit", &["doctor", "--json"]);
        assert!(output.status.success());
        assert_eq!(String::from_utf8_lossy(&output.stdout), "doctor\n--json\n");
    }
}
