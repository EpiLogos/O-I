//! World inhabitation reads (WORLD-INHABITATION-V1 §3/§4) through the actual
//! kernel dispatcher, against fake owner executables that record their argv
//! and environment:
//!   - AIKit's `gateway who` / `whoami` / `refocus` follow the owner grammar,
//!     carry the reading verbatim after its schema check, and refuse another
//!     schema; the direct binary hears no `aikit` prefix, the suite route does;
//!   - the desktop never forwards an occupant identity from its own
//!     environment (`OI_POSITION_REF` / `OI_OCCUPANT_GENERATION`);
//!   - a missing owner, a refusal (three-part words), unparsable output and a
//!     stalled owner each come back as a named error — never a reading;
//!   - Factory's `development inhabitation|current-work` follow the owner
//!     grammar, and the development allowlist holds on the dispatch path.
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::factory::OwnerRequest;
use oi_cradle_kernel::inhabitation::Request;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpResult};
use serde_json::Value;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

fn write_script(dir: &Path, name: &str, body: &str) -> PathBuf {
    let path = dir.join(name);
    fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
    stub::settle_stub(&path);
    path
}

/// A fake AIKit: records argv and the occupant env it saw, then answers per
/// verb. `FAKE_MODE` switches the answer for the failure cases.
fn fake_aikit(dir: &Path) -> PathBuf {
    let argv = dir.join("aikit-argv.txt");
    let env = dir.join("aikit-env.txt");
    write_script(
        dir,
        "fake-aikit.sh",
        &format!(
            "for a in \"$@\"; do printf '%s\\n' \"$a\" >> \"{argv}\"; done\n\
             printf 'POS=%s GEN=%s\\n' \"${{OI_POSITION_REF:-unset}}\" \"${{OI_OCCUPANT_GENERATION:-unset}}\" >> \"{env}\"\n\
             if [ \"$1\" = \"aikit\" ]; then shift; fi\n\
             case \"${{FAKE_MODE:-ok}}\" in\n\
             refuse) echo '{{\"error\":{{\"code\":\"position.not_found\",\"fact\":\"No Position @x here.\",\"consequence\":\"Nothing was read.\",\"action\":\"Run aikit gateway who.\"}}}}'; exit 2 ;;\n\
             garbage) echo 'not json'; exit 0 ;;\n\
             wrong) echo '{{\"schema\":\"aikit.something-else/v1\"}}'; exit 0 ;;\n\
             stall) sleep 5; exit 0 ;;\n\
             esac\n\
             case \"$1 $2\" in\n\
             'gateway who') echo '{{\"schema\":\"aikit.population-reading/v1\",\"project_world_ref\":\"project:O-I\",\"positions\":[{{\"position_ref\":\"central:position:project:O-I:oi-root-agency\",\"handle\":\"@oi\",\"occupancy\":{{\"state\":\"vacant\"}},\"current_work\":{{\"outcome\":\"none\"}}}}],\"absences\":[]}}' ;;\n\
             whoami*) echo '{{\"schema\":\"aikit.inhabitation-reading/v1\",\"position\":{{\"state\":\"present\",\"ref\":\"central:position:project:O-I:oi-root-agency\"}}}}' ;;\n\
             refocus*) echo '{{\"schema\":\"aikit.refocus-reading/v1\",\"chain\":[]}}' ;;\n\
             *) echo \"error: unrecognized subcommand '$1'\" >&2; exit 2 ;;\n\
             esac",
            argv = argv.display(),
            env = env.display()
        ),
    )
}

fn fake_factory(dir: &Path) -> PathBuf {
    let argv = dir.join("factory-argv.txt");
    write_script(
        dir,
        "fake-factory.sh",
        &format!(
            "for a in \"$@\"; do printf '%s\\n' \"$a\" >> \"{argv}\"; done\n\
             if [ \"$1\" = \"factory\" ]; then shift; fi\n\
             case \"$1 $2\" in\n\
             'development inhabitation') echo '{{\"schema\":\"factory.inhabitation-reading/v1\",\"runs\":[]}}' ;;\n\
             'development current-work') echo '{{\"schema\":\"factory.current-work/v1\",\"position_ref\":\"p\",\"outcome\":\"ambiguous\",\"candidates\":[{{}},{{}}],\"considered\":2,\"basis\":\"two in-progress custodies name different runs\"}}' ;;\n\
             *) echo '{{}}'; exit 3 ;;\n\
             esac",
            argv = argv.display()
        ),
    )
}

fn lines(path: &Path) -> Vec<String> {
    fs::read_to_string(path).unwrap_or_default().lines().map(str::to_string).collect()
}

fn reading(result: Result<oi_cradle_kernel::KernelOpOutcome, String>) -> Value {
    match result.expect("the read dispatches").result {
        KernelOpResult::InhabitationReading { data } => data,
        KernelOpResult::FactoryDevelopmentReading { data } => data,
        other => panic!("unexpected result: {other:?}"),
    }
}

fn error_kind(error: &str) -> String {
    serde_json::from_str::<Value>(error).ok().and_then(|v| v["kind"].as_str().map(str::to_owned)).unwrap_or_default()
}

#[test]
fn inhabitation_reads_follow_the_owner_grammar_and_degrade_honestly() {
    let dir = std::env::temp_dir().join(format!("oi-inhabitation-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let aikit = fake_aikit(&dir);
    let factory = fake_factory(&dir);
    std::env::set_var("OI_AIKIT_BIN", &aikit);
    std::env::set_var("OI_FACTORY_BIN", &factory);
    std::env::set_var("OI_INHABITATION_READ_TIMEOUT_MS", "600");
    // The kernel process itself stands inside an agent body's environment.
    std::env::set_var("OI_POSITION_REF", "central:position:project:O-I:leaked");
    std::env::set_var("OI_OCCUPANT_GENERATION", "actuation:generation:leaked");
    // No Central is reachable here: a root-scope read then carries no ground
    // and AIKit resolves its own (the read is not blocked on Central).
    let no_central = dir.join("absent-central");
    let kernel = || Kernel::new(CentralClient::with(no_central.clone(), None, "o-i".into()));
    let apply = |request: Request| kernel().apply(KernelOp::InhabitationRead { request });
    let reset = || { for name in ["aikit-argv.txt", "aikit-env.txt", "factory-argv.txt"] { let _ = fs::remove_file(dir.join(name)); } };

    // Population: the owner's grammar and document, verbatim.
    reset();
    let data = reading(apply(Request::Population { project: None }));
    assert_eq!(data["schema"], "aikit.population-reading/v1");
    assert_eq!(data["positions"][0]["handle"], "@oi");
    let argv = lines(&dir.join("aikit-argv.txt"));
    assert_eq!(&argv[..2], &["gateway".to_string(), "who".into()], "a direct AIKit binary hears no suite prefix: {argv:?}");
    assert_eq!(argv.last().map(String::as_str), Some("--json"));
    let env = lines(&dir.join("aikit-env.txt"));
    assert_eq!(env, ["POS=unset GEN=unset"], "the desktop never forwards an occupant identity it happens to stand in");

    // whoami names the Position explicitly and asks for the full reading.
    reset();
    let data = reading(apply(Request::Whoami { project: None, position: Some("central:position:project:O-I:oi-root-agency".into()) }));
    assert_eq!(data["position"]["state"], "present");
    assert_eq!(lines(&dir.join("aikit-argv.txt")), ["whoami", "--position", "central:position:project:O-I:oi-root-agency", "--full", "--json"]);

    // Refocus.
    reset();
    let data = reading(apply(Request::Refocus { project: None, position: Some("p".into()) }));
    assert_eq!(data["schema"], "aikit.refocus-reading/v1");
    assert_eq!(lines(&dir.join("aikit-argv.txt")), ["refocus", "--position", "p", "--json"]);

    // The suite route prefixes the product namespace.
    std::env::remove_var("OI_AIKIT_BIN");
    std::env::set_var("OI_BIN", &aikit);
    reset();
    reading(apply(Request::Population { project: None }));
    assert_eq!(&lines(&dir.join("aikit-argv.txt"))[..3], &["aikit".to_string(), "gateway".into(), "who".into()]);
    std::env::remove_var("OI_BIN");
    std::env::set_var("OI_AIKIT_BIN", &aikit);

    // Failures are named, never a reading.
    std::env::set_var("FAKE_MODE", "refuse");
    let error = apply(Request::Whoami { project: None, position: Some("@x".into()) }).expect_err("the owner refused");
    assert!(error.contains("No Position @x here. Nothing was read. Run aikit gateway who."), "{error}");
    assert_eq!(error_kind(&error), "owner-refused-or-failed");
    std::env::set_var("FAKE_MODE", "wrong");
    let error = apply(Request::Population { project: None }).expect_err("another schema is refused");
    assert_eq!(error_kind(&error), "incompatible");
    assert!(error.contains("aikit.something-else/v1"), "{error}");
    std::env::set_var("FAKE_MODE", "garbage");
    assert_eq!(error_kind(&apply(Request::Refocus { project: None, position: None }).expect_err("garbage is refused")), "incompatible");
    std::env::set_var("FAKE_MODE", "stall");
    let started = std::time::Instant::now();
    let error = apply(Request::Population { project: None }).expect_err("a stalled owner is not waited on forever");
    assert_eq!(error_kind(&error), "timeout", "{error}");
    assert!(started.elapsed() < std::time::Duration::from_secs(4), "the deadline held: {:?}", started.elapsed());
    std::env::remove_var("FAKE_MODE");
    std::env::set_var("OI_AIKIT_BIN", dir.join("no-such-aikit"));
    let error = apply(Request::Population { project: None }).expect_err("an absent owner is unavailable");
    assert_eq!(error_kind(&error), "unavailable", "{error}");
    std::env::set_var("OI_AIKIT_BIN", &aikit);

    // Factory: the inhabitation reads in the owner's development grammar.
    let state = dir.join("state.json");
    let owner = |request: OwnerRequest| kernel().apply(KernelOp::FactoryOwner { request });
    reset();
    let data = reading(owner(OwnerRequest::Inhabitation { state_path: state.clone(), run_ref: Some("run:1".into()), position_ref: None }));
    assert_eq!(data["schema"], "factory.inhabitation-reading/v1");
    assert_eq!(lines(&dir.join("factory-argv.txt")), ["development", "inhabitation", &state.to_string_lossy(), "--run", "run:1", "--json"]);
    reset();
    let data = reading(owner(OwnerRequest::CurrentWork { state_path: state.clone(), position_ref: "p".into() }));
    assert_eq!(data["outcome"], "ambiguous", "an ambiguous outcome is carried, never collapsed to one");
    assert_eq!(lines(&dir.join("factory-argv.txt")), ["development", "current-work", &state.to_string_lossy(), "--position", "p", "--json"]);

    // The development allowlist holds on the dispatch path too.
    reset();
    let refused = kernel().apply(KernelOp::FactoryDevelopmentRead { project: None, state_path: state.clone(), read: "mutate".into(), subject: None });
    assert!(refused.expect_err("an unlisted verb is refused").contains("Unsupported Factory development read"));
    assert!(lines(&dir.join("factory-argv.txt")).is_empty(), "nothing was spawned for a refused verb");

    for name in ["OI_AIKIT_BIN", "OI_FACTORY_BIN", "OI_INHABITATION_READ_TIMEOUT_MS", "OI_POSITION_REF", "OI_OCCUPANT_GENERATION"] {
        std::env::remove_var(name);
    }
    let _ = fs::remove_dir_all(&dir);
}
