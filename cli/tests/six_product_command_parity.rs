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

    fn run_oi_args(home: &TempDir, bin: &TempDir, args: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_oi"))
            .args(args)
            .env("OI_HOME", home.path())
            .env("PATH", bin.path())
            .output()
            .expect("run O:I CLI")
    }

    #[test]
    fn whole_world_heads_delegate_to_native_owners_with_exact_argv_stdout_and_exit() {
        let home = TempDir::new().expect("home");
        let bin = TempDir::new().expect("bin");
        for (name, exit) in [("aikit", 17), ("factory", 18)] {
            fake_executable(bin.path(), name, exit);
        }

        // `search`, `explain` and `ui` are inert delegation to the installed
        // AIKit owner: the verb is prepended, argv and exit stay native.
        for (args, first, second) in [
            (vec!["search", "probe", "--json"], "search", "probe"),
            (vec!["explain", "probe"], "explain", "probe"),
            (vec!["ui"], "ui", ""),
        ] {
            let output = run_oi_args(&home, &bin, &args);
            assert_eq!(output.status.code(), Some(17), "{args:?}");
            assert_eq!(
                String::from_utf8_lossy(&output.stdout),
                format!("native:aikit:{first}:{second}\n"),
                "{args:?}"
            );
            let stderr = String::from_utf8_lossy(&output.stderr);
            if args[0] == "ui" {
                // `ui` reads the World and NOW field supplies from the Central
                // owner before delegating; without an owner the supply gap is
                // named on stderr and the delegation itself stays native
                // (argv, stdout and exit are asserted above). Only named
                // supply notes may appear on stderr.
                assert!(
                    stderr
                        .lines()
                        .all(|line| line.starts_with("oi ui:")),
                    "{args:?}: unexpected stderr {stderr:?}"
                );
            } else {
                assert!(stderr.is_empty(), "{args:?}");
            }
        }

        // `work direct` is the same folded handler as `oi aikit-session-space`.
        let output = run_oi_args(&home, &bin, &["work", "direct", "probe", "--json"]);
        assert_eq!(output.status.code(), Some(17));
        assert_eq!(
            String::from_utf8_lossy(&output.stdout),
            "native:aikit:session-space:probe\n"
        );

        // `work factory` is transparent native passthrough.
        let output = run_oi_args(&home, &bin, &["work", "factory", "probe", "--json"]);
        assert_eq!(output.status.code(), Some(18));
        assert_eq!(
            String::from_utf8_lossy(&output.stdout),
            "native:factory:probe:--json\n"
        );
    }

    #[test]
    fn ui_supplies_the_composed_world_through_the_env_boundary() {
        let home = TempDir::new().expect("home");
        let bin = TempDir::new().expect("bin");
        fs::write(
            bin.path().join("aikit"),
            "#!/bin/sh\nprintf 'supply:%.220s\\n' \"${OI_COMPOSED_WORLD:-UNSET}\"\nprintf 'native:aikit:%s:%s\\n' \"$1\" \"${2:-}\"\nexit 17\n",
        )
        .expect("write fake aikit");
        let mut permissions = fs::metadata(bin.path().join("aikit"))
            .expect("metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(bin.path().join("aikit"), permissions).expect("chmod fake aikit");

        let output = run_oi_args(&home, &bin, &["ui"]);
        assert_eq!(output.status.code(), Some(17), "native exit is preserved");
        let text = String::from_utf8_lossy(&output.stdout);
        assert!(
            text.contains("\nnative:aikit:ui:\n") || text.ends_with("native:aikit:ui:\n"),
            "the ui verb is still delegated: {text}"
        );
        assert!(
            text.contains("supply:{\"current_world\":{"),
            "the composed World supply rides the established env boundary: {text}"
        );
    }

    #[test]
    fn world_head_reenters_the_preserved_routes_and_composes_one_orientation() {
        let home = TempDir::new().expect("home");
        let bin = TempDir::new().expect("bin");

        for preserved in [
            vec!["status", "--json"],
            vec!["current-world", "--json"],
            vec!["mode", "list"],
        ] {
            let old = run_oi_args(&home, &bin, &preserved);
            let mut through_world = vec!["world"];
            through_world.extend_from_slice(&preserved);
            let new = run_oi_args(&home, &bin, &through_world);
            assert_eq!(old.status.code(), new.status.code(), "{preserved:?}");
            assert_eq!(old.stdout, new.stdout, "{preserved:?}");
            assert_eq!(old.stderr, new.stderr, "{preserved:?}");
        }

        let output = run_oi_args(&home, &bin, &["world", "--json"]);
        assert!(output.status.success());
        let value: serde_json::Value =
            serde_json::from_slice(&output.stdout).expect("orientation parses");
        assert_eq!(value["schema"], "oi.world-orientation/v1");
        assert!(
            value["current_world"].is_object(),
            "the joined world reading is present"
        );
        assert!(
            value["next_actions"]
                .as_array()
                .is_some_and(|rows| !rows.is_empty()),
            "orientation names useful next actions"
        );

        let unknown = run_oi_args(&home, &bin, &["world", "astral"]);
        assert_eq!(unknown.status.code(), Some(2));
    }

    #[test]
    fn act_head_requires_exact_subject_and_input_and_invokes_the_native_owner_once() {
        let home = TempDir::new().expect("home");
        let bin = TempDir::new().expect("bin");
        fs::write(
            bin.path().join("ctrl"),
            "#!/bin/sh\nif [ \"$1\" = \"actions\" ]; then\n  printf '%s\\n' '{\"ok\":true,\"data\":{\"actions\":[{\"id\":\"central.doctor\",\"title\":\"Doctor\",\"inputs\":[]}]}}'\n  exit 0\nfi\nprintf 'argv:%s|%s|%s|%s\\n' \"$1\" \"$2\" \"$3\" \"$4\"\nexit 14\n",
        )
        .expect("write fake ctrl");
        let mut permissions = fs::metadata(bin.path().join("ctrl"))
            .expect("metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(bin.path().join("ctrl"), permissions).expect("chmod fake ctrl");

        let invoked = run_oi_args(
            &home,
            &bin,
            &[
                "act",
                "invoke",
                "central.doctor",
                "--input",
                "{\"scope\":\"root\"}",
            ],
        );
        assert_eq!(invoked.status.code(), Some(14), "native exit is preserved");
        assert_eq!(
            String::from_utf8_lossy(&invoked.stdout),
            "argv:action|run|central.doctor|{\"scope\":\"root\"}\n"
        );

        let missing_input = run_oi_args(&home, &bin, &["act", "invoke", "central.doctor"]);
        assert_eq!(missing_input.status.code(), Some(2));
        assert!(String::from_utf8_lossy(&missing_input.stderr).contains("requires the exact input"));

        let described = run_oi_args(
            &home,
            &bin,
            &["act", "describe", "central.doctor", "--json"],
        );
        assert!(described.status.success());
        let value: serde_json::Value =
            serde_json::from_slice(&described.stdout).expect("descriptor parses");
        assert_eq!(value["id"], "central.doctor");

        let unknown = run_oi_args(&home, &bin, &["act", "describe", "no.such.action"]);
        assert_eq!(unknown.status.code(), Some(2));
    }

    #[test]
    fn act_invoke_accepts_the_documented_structured_flag_and_bare_act_lists_the_field() {
        let home = TempDir::new().expect("home");
        let bin = TempDir::new().expect("bin");
        fs::write(
            bin.path().join("ctrl"),
            "#!/bin/sh\nif [ \"$1\" = \"actions\" ]; then\n  printf '%s\\n' '{\"ok\":true,\"data\":{\"actions\":[{\"id\":\"central.doctor\",\"title\":\"Doctor\",\"mutation_class\":\"read\",\"inputs\":[]},{\"id\":\"central.now.return\",\"title\":\"Record a NOW return\",\"mutation_class\":\"write\",\"inputs\":[]}]}}'\n  exit 0\nfi\nprintf 'argv:%s|%s|%s|%s|%s\\n' \"$1\" \"$2\" \"$3\" \"$4\" \"$5\"\nexit 14\n",
        )
        .expect("write fake ctrl");
        let mut permissions = fs::metadata(bin.path().join("ctrl"))
            .expect("metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(bin.path().join("ctrl"), permissions).expect("chmod fake ctrl");

        // The documented `--json` invocation is accepted and forwarded to the
        // owner as the structured flag, not mistaken for a second positional.
        let structured = run_oi_args(
            &home,
            &bin,
            &["act", "invoke", "central.doctor", "--input", "{}", "--json"],
        );
        assert_eq!(
            structured.status.code(),
            Some(14),
            "native exit is preserved"
        );
        assert_eq!(
            String::from_utf8_lossy(&structured.stdout),
            "argv:action|run|central.doctor|{}|--json\n"
        );

        // Bare `oi act` is the read-only field listing, not bare help.
        let listed = run_oi_args(&home, &bin, &["act"]);
        assert!(listed.status.success());
        let text = String::from_utf8_lossy(&listed.stdout);
        assert!(
            text.starts_with("Unified Action doorway (2 Central actions"),
            "{text}"
        );
        // An absent optional owner is a NAMED degradation, never a silent
        // collapse: the doorway still lists Central and says why AIKit is
        // not listed.
        assert!(text.contains("AIKit (ai-kit): unavailable"), "{text}");
        assert!(text.contains("central.doctor"), "{text}");
        assert!(text.contains("central.now.return"), "{text}");

        let listed_json = run_oi_args(&home, &bin, &["act", "--json"]);
        assert!(listed_json.status.success());
        let value: serde_json::Value =
            serde_json::from_slice(&listed_json.stdout).expect("field listing parses");
        assert_eq!(value["schema"], "oi.action-field/v2");
        assert_eq!(value["actions"].as_array().map(Vec::len), Some(2));
        let fields = value["fields"].as_array().expect("owner fields");
        assert_eq!(fields[0]["owner"], "central");
        assert_eq!(fields[0]["count"], 2);
        assert_eq!(fields[1]["owner"], "ai-kit");
        let aikit_field = &fields[1];
        assert!(
            aikit_field["unavailable"].as_str().is_some(),
            "the absent owner's condition is named, not collapsed: {}",
            aikit_field
        );
    }

    #[test]
    fn act_invoke_large_input_reaches_the_owner_through_native_stdin_intact() {
        let home = TempDir::new().expect("home");
        let bin = TempDir::new().expect("bin");
        fs::write(
            bin.path().join("ctrl"),
            "#!/bin/sh\nif [ \"$1\" = \"actions\" ]; then\n  printf '%s\\n' '{\"ok\":true,\"data\":{\"actions\":[{\"id\":\"central.doctor\",\"title\":\"Doctor\",\"mutation_class\":\"read\",\"inputs\":[]}]}}'\n  exit 0\nfi\n/bin/cat > \"$0.payload\"\nprintf 'argv:%s|%s|%s|%s\\n' \"$1\" \"$2\" \"$3\" \"$4\"\nexit 14\n",
        )
        .expect("write fake ctrl");
        let mut permissions = fs::metadata(bin.path().join("ctrl"))
            .expect("metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(bin.path().join("ctrl"), permissions).expect("chmod fake ctrl");

        // One stable key holding well past the 64 KiB argv threshold: the
        // wrapper re-encodes compact JSON, so the canonical form is exact.
        let note = "a".repeat(80_000);
        let input_file = home.path().join("large-input.json");
        fs::write(&input_file, format!("{{\"note\":\"{note}\"}}")).expect("write input file");

        let invoked = run_oi_args(
            &home,
            &bin,
            &[
                "act",
                "invoke",
                "central.doctor",
                "--input",
                &format!("@{}", input_file.to_str().expect("utf-8")),
            ],
        );
        assert_eq!(
            invoked.status.code(),
            Some(14),
            "native exit is preserved; stdout: {} stderr: {}",
            String::from_utf8_lossy(&invoked.stdout),
            String::from_utf8_lossy(&invoked.stderr)
        );
        // The explicit `-` input argument is what tells Central to read the
        // payload on stdin; without it Central parses the invocation as `{}`.
        assert_eq!(
            String::from_utf8_lossy(&invoked.stdout),
            "argv:action|run|central.doctor|-\n"
        );

        let delivered = fs::read(bin.path().join("ctrl.payload"))
            .expect("fake ctrl captured the stdin payload");
        let expected = format!("{{\"note\":\"{note}\"}}");
        assert_eq!(
            String::from_utf8(delivered).expect("payload utf-8"),
            expected,
            "the exact submitted input reached the owner"
        );
    }

    #[test]
    fn agent_roster_routes_the_exact_native_central_action() {
        let home = TempDir::new().expect("home");
        let bin = TempDir::new().expect("bin");
        fake_executable(bin.path(), "ctrl", 0);

        let root = run_oi_args(&home, &bin, &["agent", "roster", "--json"]);
        assert_eq!(
            String::from_utf8_lossy(&root.stdout),
            "native:ctrl:action:run\n",
            "argv[1..2] stay the native `action run` doorway"
        );

        // The fake prints only the first two args; assert the whole argv
        // through a dedicated multi-arg fake for the roster payload.
        fs::write(
            bin.path().join("ctrl"),
            "#!/bin/sh\nprintf 'argv:%s|%s|%s|%s|%s\\n' \"$1\" \"$2\" \"$3\" \"$4\" \"$5\"\nexit 9\n",
        )
        .expect("write argv-printing ctrl");
        let mut permissions = fs::metadata(bin.path().join("ctrl"))
            .expect("metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(bin.path().join("ctrl"), permissions)
            .expect("chmod argv-printing ctrl");

        let root = run_oi_args(&home, &bin, &["agent", "roster", "--json"]);
        assert_eq!(root.status.code(), Some(9), "native exit is preserved");
        assert_eq!(
            String::from_utf8_lossy(&root.stdout),
            "argv:action|run|agent-profile.roster|{\"scope\":\"root\"}|--json\n"
        );

        let project = run_oi_args(&home, &bin, &["agent", "roster", "--project", "garden"]);
        assert_eq!(
            String::from_utf8_lossy(&project.stdout),
            "argv:action|run|agent-profile.roster|{\"project\":\"garden\",\"scope\":\"project\"}|\n"
        );
    }
}
