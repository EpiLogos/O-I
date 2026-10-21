//! Lane W3 (T-COVERAGE §1.2): kernel routes to owner commands that already
//! exist, through the actual kernel dispatcher against fake owner executables
//! in temp dirs that record what they were asked (argv, stdin, the
//! environment they were given) — never the owners' real ground or the
//! machine's real register. Real READ answers captured from the installed
//! owners stand in as the fakes' answers where one was read
//! (tests/fixtures/owner-routes/).
//!
//! Each route is held to the lane's laws:
//!   - the owner's own command, spelled as the owner spells it, its answer
//!     carried verbatim after its check, its refusal in its own words, a
//!     missing owner an absence (`unavailable`);
//!   - a read is a prepared owner read (`owner-read`) that moves nothing and
//!     records no receipt; a write is a prepared owner write (`owner-write`)
//!     that moves the read model whatever the owner answered, and records an
//!     `owner_changed` receipt only where the owner says something moved;
//!   - the desktop is not an occupant: `OI_POSITION_REF` never reaches a
//!     child.
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::dispatch::dispatch;
use oi_cradle_kernel::{CentralClient, Kernel, KernelOp, KernelOpOutcome, KernelOpResult};
use serde_json::{json, Value};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, OnceLock};

/// Owner bindings are process-global environment: the tests here hold them
/// one at a time.
static ENV: Mutex<()> = Mutex::new(());

/// The kernel's opt-in trace, named before any op of this binary runs: a
/// write's `written` lines (owner_process.rs, read_cache.rs) are read back to
/// show that a write moved the read model and a read did not.
fn trace_file() -> &'static Path {
    static TRACE: OnceLock<PathBuf> = OnceLock::new();
    TRACE.get_or_init(|| {
        let path = std::env::temp_dir().join(format!("oi-w3-trace-{}.log", std::process::id()));
        let _ = fs::remove_file(&path);
        std::env::set_var("OI_KERNEL_TRACE_FILE", &path);
        path
    })
}

fn traced() -> String {
    fs::read_to_string(trace_file()).unwrap_or_default()
}

fn hold() -> MutexGuard<'static, ()> {
    let guard = ENV.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    trace_file();
    guard
}

fn scratch(test: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("oi-w3-{}-{test}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

/// One environment variable, restored when the test ends.
struct Bound(&'static str, Option<std::ffi::OsString>);

impl Bound {
    fn set(key: &'static str, value: impl AsRef<std::ffi::OsStr>) -> Self {
        let original = std::env::var_os(key);
        std::env::set_var(key, value);
        Self(key, original)
    }
    fn clear(key: &'static str) -> Self {
        let original = std::env::var_os(key);
        std::env::remove_var(key);
        Self(key, original)
    }
}

impl Drop for Bound {
    fn drop(&mut self) {
        match &self.1 {
            Some(value) => std::env::set_var(self.0, value),
            None => std::env::remove_var(self.0),
        }
    }
}

/// A fake owner: records each argv (one line), its stdin and the
/// environment it was given, then answers per `mode`: `ok` cats
/// `answer.json`; `refuse` cats `refuse.json` to stdout and `refuse.txt` to
/// stderr and exits `refuse.exit` (else 2); `raw` cats `answer.txt`.
struct Fake {
    dir: PathBuf,
    bin: PathBuf,
}

impl Fake {
    fn new(dir: &Path, name: &str) -> Self {
        let bin = dir.join(name);
        let d = dir.display();
        fs::write(dir.join("mode"), "ok").unwrap();
        fs::write(
            &bin,
            format!(
                "#!/bin/sh\n\
                 printf '%s\\n' \"$*\" >> \"{d}/argv.txt\"\n\
                 cat > \"{d}/stdin.txt\"\n\
                 printf 'position=%s\\nbinary=%s\\nroot=%s\\n' \"$OI_POSITION_REF\" \"$FACTORY_NATIVE_CENTRAL_BINARY\" \"$FACTORY_NATIVE_CENTRAL_ROOT\" > \"{d}/env.txt\"\n\
                 case \"$(cat \"{d}/mode\")\" in\n\
                 refuse) cat \"{d}/refuse.json\" 2>/dev/null; cat \"{d}/refuse.txt\" >&2 2>/dev/null; exit \"$(cat \"{d}/refuse.exit\" 2>/dev/null || echo 2)\" ;;\n\
                 raw) cat \"{d}/answer.txt\" ;;\n\
                 *) cat \"{d}/answer.json\" ;;\n\
                 esac\n"
            ),
        )
        .unwrap();
        fs::set_permissions(&bin, fs::Permissions::from_mode(0o755)).unwrap();
        stub::settle_stub(&bin);
        Self {
            dir: dir.to_owned(),
            bin,
        }
    }
    fn answer(&self, value: &Value) {
        fs::write(self.dir.join("mode"), "ok").unwrap();
        fs::write(
            self.dir.join("answer.json"),
            serde_json::to_vec(value).unwrap(),
        )
        .unwrap();
    }
    fn refuse(&self, stdout: Option<&Value>, stderr: &str, exit: u8) {
        fs::write(self.dir.join("mode"), "refuse").unwrap();
        match stdout {
            Some(value) => fs::write(
                self.dir.join("refuse.json"),
                serde_json::to_vec(value).unwrap(),
            )
            .unwrap(),
            None => {
                let _ = fs::remove_file(self.dir.join("refuse.json"));
            }
        }
        fs::write(self.dir.join("refuse.txt"), stderr).unwrap();
        fs::write(self.dir.join("refuse.exit"), exit.to_string()).unwrap();
    }
    fn asked(&self) -> Vec<String> {
        fs::read_to_string(self.dir.join("argv.txt"))
            .unwrap_or_default()
            .lines()
            .map(str::to_owned)
            .collect()
    }
    fn forget(&self) {
        let _ = fs::remove_file(self.dir.join("argv.txt"));
        let _ = fs::remove_file(self.dir.join("stdin.txt"));
    }
    fn stdin(&self) -> String {
        fs::read_to_string(self.dir.join("stdin.txt")).unwrap_or_default()
    }
    fn env(&self) -> String {
        fs::read_to_string(self.dir.join("env.txt")).unwrap_or_default()
    }
}

/// A Central that discloses one World (`central.world`) whose root is `dir`
/// and one project, O-I, at `Work/O-I`; and that project's canonical ref.
fn fake_central(dir: &Path) -> PathBuf {
    fs::create_dir_all(dir.join("Work/O-I")).unwrap();
    let bin = dir.join("ctrl");
    fs::write(
        &bin,
        format!(
            "#!/bin/sh\n\
             case \"$4\" in\n\
             central.world) echo '{{\"ok\":true,\"data\":{{\"schema\":\"central.world-map/v1\",\"root\":\"{root}\",\"work\":{{\"projects\":[{{\"name\":\"O-I\",\"path\":\"Work/O-I\"}}]}}}}}}' ;;\n\
             projectcentral.inspect) echo '{{\"ok\":true,\"data\":{{\"manifest\":{{\"project_id\":\"o-i\"}}}}}}' ;;\n\
             *) echo '{{\"ok\":false,\"error\":{{\"message\":\"not faked\"}}}}'; exit 1 ;;\n\
             esac\n",
            root = dir.display()
        ),
    )
    .unwrap();
    fs::set_permissions(&bin, fs::Permissions::from_mode(0o755)).unwrap();
    stub::settle_stub(&bin);
    bin
}

fn kernel(central: &Path) -> Kernel {
    Kernel::new(CentralClient::with(central.to_owned(), None, "O-I".into()))
}

fn no_central(dir: &Path) -> Kernel {
    kernel(&dir.join("absent-central"))
}

fn op(value: Value) -> KernelOp {
    serde_json::from_value(value).unwrap()
}

/// One op through the hosts' dispatcher: its outcome and the form that
/// served it.
fn dispatched(kernel: Kernel, op: KernelOp) -> (Result<KernelOpOutcome, String>, &'static str) {
    let kernel = Mutex::new(kernel);
    let (outcome, timing) = dispatch(&kernel, op);
    (outcome, timing.form)
}

fn reading(outcome: &KernelOpOutcome) -> (String, Value, Vec<Value>) {
    let KernelOpResult::OwnerRouteReading {
        route,
        data,
        warnings,
    } = &outcome.result
    else {
        panic!("not an owner route reading: {:?}", outcome.result)
    };
    (route.clone(), data.clone(), warnings.clone())
}

fn receipts(outcome: &KernelOpOutcome) -> Value {
    serde_json::to_value(&outcome.receipts).unwrap()
}

fn kind(error: &str) -> String {
    serde_json::from_str::<Value>(error)
        .ok()
        .and_then(|value| value["kind"].as_str().map(str::to_owned))
        .unwrap_or_default()
}

fn fixture(name: &str) -> Value {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/owner-routes")
        .join(name);
    serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
}

fn envelope(data: Value) -> Value {
    json!({"ok": true, "schema": 1, "context": {"context_id": null, "project_root": null, "session_id": null},
           "data": data, "warnings": []})
}

#[test]
fn gateway_send_is_a_write_that_names_the_communique_it_kept() {
    let _held = hold();
    let dir = scratch("send");
    let aikit = Fake::new(&dir, "aikit");
    let _bin = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    let _position = Bound::set("OI_POSITION_REF", "central:position:project:O-I:inherited");
    // AIKit's receipt for a position route (gateway_contact.rs accept_and_relay).
    let receipt = json!({"recipient": {"position_ref": "central:position:project:O-I:anima"},
        "sender": {"from_position_ref": "central:position:project:O-I:person"}, "route": "position",
        "local_workcell": {"ref": "workcell:mac", "basis": "declared"}, "delivery": null, "remotes": [],
        "communique": {"schema": "aikit.communique/v1", "communique_ref": "aikit:communique:01k8w3send",
                       "state": "pending"},
        "replayed": false, "accepted_by": "gateway:mac", "forward": null});
    aikit.answer(&envelope(receipt.clone()));
    let send = |project: Option<&str>| {
        op(
            json!({"op": "gateway_write", "request": {"kind": "send", "project": project,
            "to": "@anima", "body": "The take on track 3 stands.",
            "from_position": "central:position:project:O-I:person"}}),
        )
    };

    let (outcome, form) = dispatched(no_central(&dir), send(None));
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "aikit gateway send");
    assert_eq!(data, receipt, "AIKit's receipt, verbatim");
    assert_eq!(
        aikit.asked(),
        ["gateway send --to @anima --body-file - --from-position central:position:project:O-I:person --json"],
        "the owner's own spelling; the words travel on stdin, never in argv"
    );
    assert_eq!(aikit.stdin(), "The take on track 3 stands.");
    assert!(
        aikit.env().contains("position=\n"),
        "the desktop is not an occupant: {}",
        aikit.env()
    );
    let receipt_wire = receipts(&outcome);
    assert_eq!(receipt_wire[0]["event"], "owner_changed");
    assert_eq!(receipt_wire[0]["owner"], "ai-kit");
    assert_eq!(receipt_wire[0]["action"], "aikit gateway send");
    assert_eq!(receipt_wire[0]["ref"], "aikit:communique:01k8w3send");
    assert!(
        traced().contains("written AIKit aikit gateway send"),
        "a write moves the read model"
    );

    // A named project: Central's working directory and canonical World.
    let central = fake_central(&dir);
    aikit.forget();
    let (outcome, _) = dispatched(kernel(&central), send(Some("O-I")));
    outcome.unwrap();
    assert!(
        aikit.asked()[0].contains("--project-world project:o-i"),
        "{:?}",
        aikit.asked()
    );

    // A replay AIKit already accepted moved nothing: no receipt.
    let mut replayed = receipt.clone();
    replayed["replayed"] = json!(true);
    aikit.answer(&envelope(replayed));
    let (outcome, _) = dispatched(no_central(&dir), send(None));
    assert!(
        outcome.unwrap().receipts.is_empty(),
        "a replay records nothing"
    );

    // AIKit's refusal, in its three-part words, whatever its exit.
    aikit.refuse(
        Some(&json!({"ok": false, "schema": 1, "error": {"code": "gateway.empty_body",
            "fact": "The Communique body is empty.", "consequence": "Nothing was sent; no Communique was recorded.",
            "action": "Pass the words with --body TEXT or --body-file PATH."}})),
        "",
        1,
    );
    let (outcome, _) = dispatched(no_central(&dir), send(None));
    let error = outcome.unwrap_err();
    assert_eq!(kind(&error), "owner-refused-or-failed");
    assert!(
        error.contains(
            "The Communique body is empty. Nothing was sent; no Communique was recorded."
        ),
        "{error}"
    );
    // Another answer is named, never carried.
    aikit.answer(&envelope(json!({"addressed": "nobody"})));
    let (outcome, _) = dispatched(no_central(&dir), send(None));
    let error = outcome.unwrap_err();
    assert_eq!(kind(&error), "incompatible");
    assert!(error.contains("aikit.communique/v1"), "{error}");
    // No AIKit at all: an absence.
    let _gone = Bound::set("OI_AIKIT_BIN", dir.join("no-aikit"));
    let (outcome, _) = dispatched(no_central(&dir), send(None));
    assert_eq!(kind(&outcome.unwrap_err()), "unavailable");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn gateway_delegate_and_team_writes_name_what_moved_and_a_team_read_moves_nothing() {
    let _held = hold();
    let dir = scratch("delegate");
    let aikit = Fake::new(&dir, "aikit");
    let _bin = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    aikit.answer(&envelope(json!({
        "communique": {"schema": "aikit.communique/v1", "communique_ref": "aikit:communique:01k8w3c", "state": "escalated"},
        "replayed": false, "custody_ref": "factory:custody:01k8w3", "factory_receipt": {"result": "applied"}})));
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "gateway_write", "request": {"kind": "delegate",
            "communique": "aikit:communique:01k8w3c", "work": "work:take-3", "reason": "it needs a person",
            "run": "run:7"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(
        aikit.asked(),
        ["gateway delegate --communique aikit:communique:01k8w3c --work work:take-3 --run run:7 --reason it needs a person --json"]
    );
    assert_eq!(receipts(&outcome)[0]["ref"], "factory:custody:01k8w3");

    // A team read: a prepared read, no receipt, the read model unmoved.
    aikit.forget();
    let team = json!({"schema": "aikit.team-operation/v1", "action": "read", "member_ref": "agent/lilt",
                      "agent_session": "agent-session/w3", "result": {"state": "running"}});
    aikit.answer(&envelope(team.clone()));
    let read =
        json!({"action": "read", "member_ref": "agent/lilt", "agent_session": "agent-session/w3"});
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(json!({"op": "gateway_team", "request": read})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read", "a team read never travels as a write");
    assert!(outcome.receipts.is_empty());
    assert_eq!(reading(&outcome).1, team);
    assert_eq!(
        aikit.asked(),
        [format!(
            "gateway team --request-json {} --json",
            serde_json::to_string(&read).unwrap()
        )]
    );
    assert!(!traced().contains("written AIKit aikit gateway team"));

    // A team delegation writes, and names its delivery.
    let delegated = json!({"schema": "aikit.team-operation/v1", "action": "delegate", "member_ref": "agent/lilt",
        "parent_ref": "agent/kite", "agent_session": "agent-session/w3", "delivery_ref": "delivery:01k8w3", "result": {}});
    aikit.answer(&envelope(delegated));
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "gateway_team", "request": {"action": "delegate", "member_ref": "agent/lilt",
            "agent_session": "agent-session/w3", "task": "x"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    let wire = receipts(&outcome);
    assert_eq!(wire[0]["action"], "aikit gateway team delegate");
    assert_eq!(wire[0]["ref"], "delivery:01k8w3");
    assert!(traced().contains("written AIKit aikit gateway team"));
    // AIKit's refusal for a desk that occupies nothing, in its words.
    aikit.refuse(
        Some(
            &json!({"ok": false, "schema": 1, "error": {"code": "inhabit.team_operation_refused",
            "message": "Team operations require the actual current occupying parent"}}),
        ),
        "",
        1,
    );
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "gateway_team", "request": {"action": "prepare", "member_ref": "agent/lilt"}}),
        ),
    );
    assert!(outcome
        .unwrap_err()
        .contains("Team operations require the actual current occupying parent"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn actuation_reads_carry_actuations_reading_of_the_record_verbatim() {
    let _held = hold();
    let dir = scratch("actuation");
    let actuation = Fake::new(&dir, "actuation");
    let _bin = Bound::set("OI_ACTUATION_BIN", &actuation.bin);
    // Actuation 0.2.1's own answer (fixtures/owner-routes, REAL).
    let usage = fixture("actuation-usage-2026-10-21.json");
    actuation.answer(&usage["answer"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_read", "request": {"kind": "usage", "document": usage["input"]}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty(), "a read records nothing");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "actuation usage");
    assert_eq!(data, usage["answer"], "Actuation's reading, verbatim");
    assert_eq!(actuation.asked(), ["usage - --json"]);
    assert_eq!(
        serde_json::from_str::<Value>(&actuation.stdin()).unwrap(),
        usage["input"],
        "the record goes on stdin, as handed"
    );
    assert!(
        !traced().contains("written Actuation"),
        "a read moves nothing"
    );

    let agency = fixture("actuation-agency-2026-10-21.json");
    actuation.answer(&agency["answer"]);
    actuation.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_read", "request": {"kind": "agency", "document": agency["input"]}}),
        ),
    );
    assert_eq!(
        reading(&outcome.unwrap()).1["schema"],
        "actuation.agency/v1"
    );
    assert_eq!(actuation.asked(), ["agency - --json"]);
    // The usage answer handed back for an agency reading is named.
    actuation.answer(&usage["answer"]);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_read", "request": {"kind": "agency", "document": agency["input"]}}),
        ),
    );
    let error = outcome.unwrap_err();
    assert_eq!(kind(&error), "incompatible");
    assert!(error.contains("actuation.model-usage/v1"), "{error}");
    // Actuation's own refusal words (REAL).
    actuation.refuse(None, usage["refusal_stderr"].as_str().unwrap(), 2);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_read", "request": {"kind": "usage", "document": {"schema": "actuation.model-usage/v1"}}}),
        ),
    );
    let error = outcome.unwrap_err();
    assert_eq!(kind(&error), "owner-refused-or-failed");
    assert!(
        error.contains("actuation: missing field `usage_ref`"),
        "{error}"
    );
    // The suite route prefixes the product namespace.
    let _suite = Bound::set("OI_BIN", &actuation.bin);
    let _direct = Bound::clear("OI_ACTUATION_BIN");
    actuation.answer(&usage["answer"]);
    actuation.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_read", "request": {"kind": "usage", "document": usage["input"]}}),
        ),
    );
    outcome.unwrap();
    assert_eq!(actuation.asked(), ["actuation usage - --json"]);
    let _gone = Bound::set("OI_BIN", dir.join("no-oi"));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_read", "request": {"kind": "usage", "document": usage["input"]}}),
        ),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "unavailable");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn the_research_comparisons_assessments_are_reads_of_the_supplied_manifest() {
    let _held = hold();
    let dir = scratch("research");
    let research = Fake::new(&dir, "actuation-research");
    let _bin = Bound::set("OI_ACTUATION_RESEARCH_BIN", &research.bin);
    // The harness's own answer for a manifest without records (REAL shape:
    // `{"operation":"comparison.assess","manifest":{}}`, 21 Oct 2026).
    let assessed =
        json!({"valid": false, "reasons": ["comparison records required"], "records": []});
    research.answer(&assessed);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_read", "request": {"kind": "comparison", "operation": "assess",
            "input": {"manifest": {}}}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "actuation-research comparison.assess");
    assert_eq!(data, assessed);
    assert_eq!(research.asked(), ["--json"]);
    assert_eq!(
        serde_json::from_str::<Value>(&research.stdin()).unwrap(),
        json!({"operation": "comparison.assess", "manifest": {}}),
        "the kernel names the operation; the fields are the desk's"
    );
    // The harness's refusal document (REAL words), exit 1.
    research.refuse(
        Some(&json!({"schema": "actuation.research-error/v1", "error": "comparison records required"})),
        "",
        1,
    );
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_read", "request": {"kind": "comparison", "operation": "mask",
            "input": {"manifest": {}}}}),
        ),
    );
    let error = outcome.unwrap_err();
    assert!(error.contains("comparison records required"), "{error}");
    // Another operation smuggled into the fields is refused before any call.
    research.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_read", "request": {"kind": "comparison", "operation": "held",
            "input": {"operation": "comparison.run", "records": []}}}),
        ),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    assert!(
        research.asked().is_empty(),
        "comparison.run is never asked as a reading"
    );
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn ql_reads_carry_the_m1_engine_and_the_scene_verbatim() {
    let _held = hold();
    let dir = scratch("ql");
    let ql = Fake::new(&dir, "ql");
    let _bin = Bound::set("OI_QL_BIN", &ql.bin);
    // The installed QL's own M1 answer (REAL).
    let m1 = fixture("ql-kernel-m1-2026-10-21.json");
    ql.answer(&m1["answer"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(json!({"op": "ql_read", "request": {"kind": "kernel-m1", "request": m1["input"]}})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert_eq!(reading(&outcome).1, m1["answer"]);
    assert_eq!(
        ql.asked(),
        ["kernel m1 /dev/stdin --json"],
        "`ql kernel m1` takes a file: the kernel names its own stdin"
    );
    assert_eq!(
        serde_json::from_str::<Value>(&ql.stdin()).unwrap(),
        m1["input"]
    );
    // QL's refusal (REAL words).
    ql.refuse(None, m1["refusal_stderr"].as_str().unwrap(), 2);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "ql_read", "request": {"kind": "kernel-m1", "request": {}}})),
    );
    assert!(outcome
        .unwrap_err()
        .contains("ql: missing field `schema` at line 1 column 2"));
    // The scene: its own schema, else named.
    ql.answer(
        &json!({"schema": "ql.scene/v1", "tick12": 7, "sky_admission": {"purpose": "current"}}),
    );
    ql.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "ql_read", "request": {"kind": "scene-compose",
            "request": {"schema": "ql.scene-request/v1", "tick12": 7, "cycle": 1, "sky_snapshot": {}}}})),
    );
    assert_eq!(reading(&outcome.unwrap()).0, "ql scene compose");
    assert_eq!(ql.asked(), ["scene compose - --json"]);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "ql_read", "request": {"kind": "scene-world", "request": {}}})),
    );
    let error = outcome.unwrap_err();
    assert!(
        error.contains("ql.scene/v1") && error.contains("ql.scene-world/v1"),
        "{error}"
    );
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn workcell_reads_and_writes_on_its_connections_and_machines() {
    let _held = hold();
    let dir = scratch("workcell");
    let workcell = Fake::new(&dir, "workcell");
    let _bin = Bound::set("OI_WORKCELL_BIN", &workcell.bin);
    // Workcell's own answers (REAL, read only).
    let real = fixture("workcell-connections-2026-10-21.json");
    for (request, answer, argv) in [
        (
            json!({"kind": "connections-list"}),
            &real["list"],
            "connections list --json",
        ),
        (
            json!({"kind": "connections-show", "label": "omarchy"}),
            &real["show"],
            "connections show omarchy --json",
        ),
        (
            json!({"kind": "machine-list"}),
            &real["machines"],
            "machine list --json",
        ),
    ] {
        workcell.answer(answer);
        workcell.forget();
        let (outcome, form) = dispatched(
            no_central(&dir),
            op(json!({"op": "workcell_read", "request": request})),
        );
        let outcome = outcome.unwrap();
        assert_eq!(form, "owner-read");
        assert_eq!(&reading(&outcome).1, answer);
        assert_eq!(workcell.asked(), [argv]);
    }
    // Workcell's refusal (REAL), exit 5.
    workcell.refuse(Some(&real["show_refusal"]), "", 5);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "workcell_read", "request": {"kind": "connections-show", "label": "nosuch"}}),
        ),
    );
    assert!(outcome
        .unwrap_err()
        .contains("not found: no connection record named `nosuch`"));

    // Connect names a declared machine; no endpoint or token travels.
    workcell.answer(&json!({"ok": true, "connection": {"label": "omarchy", "endpoint": "100.92.62.101:7777",
        "state": "connected", "protocol": "workcell.control/v1", "remote_workcell_ref": "workcell:omarchy",
        "granted_operations": ["status"], "expires_at_unix_ms": null, "advertised_ports": [],
        "advertised_offers": [], "credential_ref": "keychain://workcell-connection/omarchy"},
        "compatibility": {}, "notes": []}));
    workcell.forget();
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "workcell_write", "request": {"kind": "connect", "connection": "omarchy"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(workcell.asked(), ["connect --connection omarchy --json"]);
    let wire = receipts(&outcome);
    assert_eq!(wire[0]["owner"], "workcell");
    assert_eq!(wire[0]["ref"], "omarchy");
    assert!(traced().contains("written Workcell workcell connect"));
    // A removal the owner says removed nothing earns no receipt.
    workcell.answer(&json!({"ok": true, "label": "omarchy", "removed": false}));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "workcell_write", "request": {"kind": "machine-remove", "label": "omarchy"}}),
        ),
    );
    assert!(outcome.unwrap().receipts.is_empty());
    // Another machine's record is named, never carried.
    workcell.answer(&json!({"ok": true, "label": "other", "endpoint": "h:1", "registry": "/r"}));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "workcell_write", "request": {"kind": "machine-add", "label": "omarchy",
            "endpoint": "100.92.62.101:7777", "allow": ["status", "inspect"]}}),
        ),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    assert_eq!(
        workcell.asked().last().unwrap(),
        "machine add --label omarchy --endpoint 100.92.62.101:7777 --allow status --allow inspect --json"
    );
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn seat_join_and_release_write_the_register_through_the_instrument_with_the_desks_actor() {
    let _held = hold();
    let dir = scratch("seat");
    let seat = Fake::new(&dir, "seat");
    let _bin = Bound::set("OI_SEAT_BIN", &seat.bin);
    // The instrument's result (seat json_success): a new lane joined.
    let joined = json!({"schema": "central.workcell-seat-result/v1", "ok": true, "command": "join",
        "outcome": "joined", "workcell": "env-1", "product": "o-i", "actor": "person:frank",
        "path": "/w/env-1/o-i", "seat": {"state": "claimed"}, "return_id": "h-01", "register_written": true});
    seat.answer(&joined);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "seat_write", "request": {"kind": "join", "workcell": "env-1", "product": "o-i",
            "actor": "person:frank", "new_lane": true, "regions": ["packages/a", "packages/b"]}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(reading(&outcome).1, joined);
    assert_eq!(
        seat.asked(),
        ["join env-1 o-i --actor person:frank --new-lane --region packages/a packages/b --json"],
        "every region in one flag: the instrument keeps only the last of repeated flags"
    );
    let wire = receipts(&outcome);
    assert_eq!(wire[0]["owner"], "seat");
    assert_eq!(wire[0]["action"], "seat join");
    assert_eq!(wire[0]["ref"], "workcell:env-1/o-i");
    // Attaching to the standing lane as the same actor writes nothing.
    let mut attached = joined.clone();
    attached["outcome"] = json!("already-attached");
    attached["register_written"] = json!(false);
    seat.answer(&attached);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "seat_write", "request": {"kind": "join", "workcell": "env-1", "product": "o-i",
            "actor": "person:frank"}}),
        ),
    );
    assert!(outcome.unwrap().receipts.is_empty());
    // A release's refusal, in the instrument's words.
    seat.refuse(
        None,
        "seat: env-1/o-i is dirty: commit or recover before release",
        1,
    );
    seat.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "seat_write", "request": {"kind": "release", "workcell": "env-1", "product": "o-i",
            "actor": "person:frank"}}),
        ),
    );
    let error = outcome.unwrap_err();
    assert!(error.contains("seat: env-1/o-i is dirty"), "{error}");
    assert_eq!(
        seat.asked(),
        ["release env-1 o-i --actor person:frank --json"]
    );
    assert!(traced().contains("written the seat instrument seat release"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn aikit_reads_and_writes_carry_the_envelopes_reading() {
    let _held = hold();
    let dir = scratch("aikit");
    let aikit = Fake::new(&dir, "aikit");
    let _bin = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    // The inbox's shape (aikit inbox --json, 21 Oct 2026: {count, items}).
    let inbox = json!({"count": 1, "items": [{"title": "a script", "evidence": [], "created": "2026-10-21T09:03:53Z"}]});
    aikit.answer(&envelope(inbox.clone()));
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(json!({"op": "aikit_read", "request": {"kind": "inbox", "all": true}})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert_eq!(reading(&outcome).1, inbox);
    assert_eq!(aikit.asked(), ["inbox --all --json"]);
    // wiki-shape validate's own answer shape (REAL: Control's root wiki).
    let validated = json!({"command": "wiki-shape.validate", "errors": [], "file": "/w/wiki.json", "frames": [], "valid": true});
    aikit.answer(&envelope(validated.clone()));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_read", "request": {"kind": "wiki-shape-validate", "file": "/w/wiki.json"}}),
        ),
    );
    assert_eq!(reading(&outcome.unwrap()).1, validated);

    // A capture: its body on stdin, the candidate AIKit made named.
    aikit.forget();
    aikit.answer(&envelope(
        json!({"candidate": "cnd_01K8W3", "kind": "script", "state": "pending",
        "quarantined": false, "findings": [], "duplicate_of": null, "similar": []}),
    ));
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_write", "request": {"kind": "capture", "title": "tidy seats",
            "body": "seat tend --apply", "capture_kind": "script", "by": "human"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(
        aikit.asked(),
        ["capture tidy seats --kind script --by human --json"]
    );
    assert_eq!(aikit.stdin(), "seat tend --apply");
    assert_eq!(receipts(&outcome)[0]["ref"], "cnd_01K8W3");
    // A trust decision for a capsule no registry holds records nothing.
    aikit.answer(&envelope(
        json!({"capability": "skill/nosuch", "state": "unseen",
        "reason": "not present in any registry"}),
    ));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_write", "request": {"kind": "trust-record", "capability": "skill/nosuch",
            "note": "read it"}}),
        ),
    );
    assert!(outcome.unwrap().receipts.is_empty());
    assert_eq!(
        aikit.asked().last().unwrap(),
        "trust record skill/nosuch --note read it --json"
    );
    // A package export needs the absolute directory it writes.
    aikit.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_write", "request": {"kind": "set-package-export", "set": ".",
            "target": "claude", "out": "relative/out"}}),
        ),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    assert!(aikit.asked().is_empty());
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn factory_unit_decisions_and_custody_through_the_factory_owner() {
    let _held = hold();
    let dir = scratch("factory");
    let factory = Fake::new(&dir, "factory");
    let central = fake_central(&dir);
    let _bin = Bound::set("OI_FACTORY_BIN", &factory.bin);
    let _ctrl = Bound::set("OI_CENTRAL_CTRL_BIN", &central);
    let state = dir.join("state.json");
    // A decision read: a prepared read, the host's Central endpoint given.
    let decision = json!({"contract": "factory.attempt-unit-decision-reading/v1", "runRef": "run:7",
        "humanRequestRef": "request:9", "nativeRequest": {}, "centralResponse": {}, "decisionResponse": null,
        "unresolved": "pending"});
    factory.answer(&decision);
    let (outcome, form) = dispatched(
        kernel(&central),
        op(
            json!({"op": "factory_owner", "request": {"kind": "attempt-decision-read",
            "state_path": state, "run_ref": "run:7", "human_request_ref": "request:9",
            "receiving_ref": "return-1.json"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty());
    assert_eq!(
        factory.asked(),
        [format!(
            "attempt decision read {} run:7 request:9 return-1.json --json",
            state.display()
        )]
    );
    assert!(
        factory
            .env()
            .contains(&format!("binary={}\n", central.display()))
            && factory.env().contains(&format!("root={}\n", dir.display())),
        "Factory reaches Central through the host's own binding: {}",
        factory.env()
    );
    // A submission writes, and names the Run.
    factory.forget();
    let (outcome, form) = dispatched(
        kernel(&central),
        op(
            json!({"op": "factory_owner", "request": {"kind": "attempt-decision-submit",
            "state_path": state, "request": {"contract": "factory.attempt-action/v1", "runRef": "run:7"}}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(
        factory.asked(),
        [format!(
            "attempt decision submit {} - --json",
            state.display()
        )]
    );
    assert_eq!(
        serde_json::from_str::<Value>(&factory.stdin()).unwrap()["runRef"],
        "run:7"
    );
    let wire = receipts(&outcome);
    assert_eq!(wire[0]["event"], "factory_run_changed");
    assert_eq!(wire[0]["action"], "attempt decision submit");
    assert_eq!(wire[0]["ref"], "run:7");
    // Without the host's Central binding Factory names what it lacks.
    let _unbound = Bound::clear("OI_CENTRAL_CTRL_BIN");
    factory.refuse(
        None,
        "factory: host-configured FACTORY_NATIVE_CENTRAL_BINARY is unavailable",
        2,
    );
    let (outcome, _) = dispatched(
        kernel(&central),
        op(
            json!({"op": "factory_owner", "request": {"kind": "attempt-decision-read",
            "state_path": state, "run_ref": "run:7", "human_request_ref": "request:9",
            "receiving_ref": "return-1.json"}}),
        ),
    );
    assert!(outcome
        .unwrap_err()
        .contains("host-configured FACTORY_NATIVE_CENTRAL_BINARY is unavailable"));
    assert!(factory.env().contains("binary=\n"), "nothing guessed");

    // Custody: assigned, then replayed (already applied: no receipt).
    let custody = |result: &str| {
        json!({"schema": "factory.work-custody-receipt/v1", "result": result,
               "custody": {"schema": "factory.work-custody/v1", "custody_ref": "factory:custody:01k8w3",
                           "position_ref": "central:position:project:O-I:anima", "work_ref": "work:take-3",
                           "state": "in-progress", "revision": 1}})
    };
    factory.answer(&custody("applied"));
    factory.forget();
    let assign = op(
        json!({"op": "factory_owner", "request": {"kind": "custody-assign",
        "state_path": state, "position_ref": "central:position:project:O-I:anima", "work_ref": "work:take-3",
        "reason": "the take needs a mix", "run_ref": "run:7"}}),
    );
    let (outcome, form) = dispatched(kernel(&central), assign.clone());
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(
        factory.asked(),
        [format!("development custody assign {} --position central:position:project:O-I:anima --work work:take-3 --reason the take needs a mix --run run:7 --json", state.display())]
    );
    assert_eq!(receipts(&outcome)[0]["ref"], "factory:custody:01k8w3");
    factory.answer(&custody("already-applied"));
    let (outcome, _) = dispatched(kernel(&central), assign);
    assert!(
        outcome.unwrap().receipts.is_empty(),
        "a replay moved nothing"
    );
    factory.forget();
    factory.answer(&custody("applied"));
    let (outcome, _) = dispatched(
        kernel(&central),
        op(
            json!({"op": "factory_owner", "request": {"kind": "custody-update", "state_path": state,
            "custody_ref": "factory:custody:01k8w3", "state": "handed-off", "reason": "Kite takes it",
            "to_position": "central:position:project:O-I:kite", "expected_revision": 1}}),
        ),
    );
    outcome.unwrap();
    assert_eq!(
        factory.asked(),
        [format!("development custody update {} --custody factory:custody:01k8w3 --state handed-off --reason Kite takes it --to-position central:position:project:O-I:kite --expected-revision 1 --json", state.display())]
    );
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn the_encounter_join_no_longer_asks_actuation_for_a_correlation_it_does_not_have() {
    let _held = hold();
    let dir = scratch("encounter");
    let actuation = Fake::new(&dir, "actuation");
    let _actuation = Bound::set("OI_ACTUATION_BIN", &actuation.bin);
    let aikit_dir = dir.join("aikit");
    fs::create_dir_all(&aikit_dir).unwrap();
    let aikit = Fake::new(&aikit_dir, "aikit");
    let _aikit = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    aikit.answer(&json!({"ok": true, "data": {"events": []}}));
    let reading =
        oi_cradle_kernel::encounter::assemble(&dir, "agent-session/w3", "prq_01K8W3", None);
    assert!(
        actuation.asked().is_empty(),
        "Actuation 0.2.1 has no correlate"
    );
    let wire = serde_json::to_value(&reading).unwrap();
    assert_eq!(
        wire["inputs"]["actuation_correlation"]["state"],
        "unavailable"
    );
    assert_eq!(
        wire["inputs"]["actuation_correlation"]["detail"],
        oi_cradle_kernel::encounter::ACTUATION_CORRELATE_ABSENT
    );
    assert_eq!(wire["inputs"]["aikit_lifecycle"]["state"], "available");
    // The disposition rests on the side that was queried.
    assert_ne!(wire["disposition"]["state"], "unavailable", "{wire}");
    let _ = fs::remove_dir_all(&dir);
}
