//! The two Agent Wiki projection ops through the actual kernel dispatcher.
//! A fake owner executable stands in for the installed `aikit`: it records
//! the exact argv it received and consumes stdin, so the test proves the
//! dispatcher builds the right command (`--json`, the root via `-C`, the
//! projection verb and every attribution flag), carries the replacement body
//! on stdin verbatim, and refuses an incompatible reading — the routing is
//! proven, not commented.
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;

fn write_fake(dir: &std::path::Path, args_file: &std::path::Path, stdin_file: &std::path::Path) -> PathBuf {
    let script = format!(
        "#!/bin/sh\nfor a in \"$@\"; do printf '%s\\n' \"$a\" >> \"{args}\"; done\ncat > \"{stdin}\"\n\
         sub=\"$6\"\nif [ \"${{FAKE_AIKIT_BAD:-0}}\" = \"1\" ]; then echo '{{\"unexpected\":true}}';\n\
         elif [ \"$sub\" = \"read\" ]; then echo '{{\"state\":\"read\",\"source_kind\":\"central\",\"governance_changed\":false,\"harness_loaded\":false,\"projection\":{{\"body\":\"# reading\",\"revision\":\"a773ace3\",\"source\":\"central:Control/agents/wiki/projections/collaboration.md\",\"feedback\":[]}}}}';\n\
         else echo '{{\"governance_changed\":false,\"harness_loaded\":false,\"projection\":{{\"body\":\"# corrected\",\"revision\":\"53e12f86\",\"source\":\"central:Control/agents/wiki/projections/collaboration.md\",\"feedback\":[{{\"reason\":\"r\"}}]}}}}'; fi\n",
        args = args_file.display(),
        stdin = stdin_file.display()
    );
    let path = dir.join("fake-aikit.sh");
    fs::write(&path, script).unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
    path
}

#[test]
fn wiki_projection_ops_dispatch_to_aikit_and_verify_the_contract() {
    let dir = std::env::temp_dir().join(format!("oi-wiki-projection-{}", std::process::id()));
    fs::create_dir_all(&dir).unwrap();
    let args_file = dir.join("argv.txt");
    let stdin_file = dir.join("stdin.txt");
    let fake = write_fake(&dir, &args_file, &stdin_file);
    let root = dir.join("Central");
    let read_args = || fs::read_to_string(&args_file).unwrap_or_default().lines().map(str::to_string).collect::<Vec<_>>();
    let reset = || { let _ = fs::remove_file(&args_file); };

    let prior = std::env::var_os("OI_AIKIT_BIN");
    std::env::set_var("OI_AIKIT_BIN", &fake);
    std::env::remove_var("FAKE_AIKIT_BAD");

    // The read carries the machine envelope flag, the root, and the file.
    reset();
    let read = Kernel::new(CentralClient::discover())
        .apply(KernelOp::WikiProjectionRead { root: root.clone(), path: "Control/agents/wiki/projections/collaboration.md".into() })
        .expect("projection read dispatches");
    match read.result {
        KernelOpResult::WikiProjectionReading { data } => {
            assert_eq!(data["state"], "read");
            assert_eq!(data["projection"]["revision"], "a773ace3");
        }
        other => panic!("unexpected result: {other:?}"),
    }
    let argv = read_args();
    assert_eq!(argv.first().map(String::as_str), Some("--json"), "reads speak the machine envelope");
    assert!(argv.contains(&"-C".to_string()) && argv.contains(&root.to_string_lossy().to_string()));
    assert!(argv.contains(&"projection".to_string()) && argv.contains(&"read".to_string()));

    // The update carries every attribution flag and the body on stdin.
    reset();
    let update = Kernel::new(CentralClient::discover())
        .apply(KernelOp::WikiProjectionUpdate {
            root: root.clone(),
            path: "Control/agents/wiki/projections/collaboration.md".into(),
            expected_revision: "a773ace3".into(),
            evidence: "session:test".into(),
            actor: "central:user".into(),
            reason: "scoped correction".into(),
            body: "# corrected body\n".into(),
        })
        .expect("projection update dispatches");
    match update.result {
        KernelOpResult::WikiProjectionStored { data } => {
            assert_eq!(data["projection"]["revision"], "53e12f86");
            assert_eq!(data["projection"]["feedback"].as_array().unwrap().len(), 1);
        }
        other => panic!("unexpected result: {other:?}"),
    }
    let argv = read_args();
    assert!(argv.contains(&"update".to_string()) && argv.contains(&"--expected-revision".to_string()));
    assert!(argv.contains(&"--evidence".to_string()) && argv.contains(&"--actor".to_string()));
    assert!(argv.contains(&"a773ace3".to_string()));
    assert_eq!(fs::read_to_string(&stdin_file).unwrap(), "# corrected body\n");

    // An incompatible payload is refused, never carried.
    reset();
    std::env::set_var("FAKE_AIKIT_BAD", "1");
    let bad = Kernel::new(CentralClient::discover())
        .apply(KernelOp::WikiProjectionRead { root: root.clone(), path: "Control/agents/wiki/projections/collaboration.md".into() });
    assert!(bad.is_err(), "an incompatible reading is refused");
    std::env::remove_var("FAKE_AIKIT_BAD");

    match prior {
        Some(value) => std::env::set_var("OI_AIKIT_BIN", value),
        None => std::env::remove_var("OI_AIKIT_BIN"),
    }
}
