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
                 printf 'position=%s\\nbinary=%s\\nroot=%s\\nsandbox_key=%s\\n' \"$OI_POSITION_REF\" \"$FACTORY_NATIVE_CENTRAL_BINARY\" \"$FACTORY_NATIVE_CENTRAL_ROOT\" \"$OPEN_SANDBOX_API_KEY\" > \"{d}/env.txt\"\n\
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
    // The trace is the process's; Actuation's authority writes elsewhere in
    // this suite land in it too, so only this test's lines are read.
    let before = traced().len();
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
        !traced()[before..].contains("written Actuation"),
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
    // How much the holder decides alone (Factory#288), carried as spelled;
    // the record answers with it (FAKE, in the merged Factory's shape).
    let mut decided = custody("applied");
    decided["custody"]["autonomy"] = json!("auto");
    decided["custody"]["review_gate"] = json!("diffs");
    decided["custody"]["escalate_to"] = json!("central:person:frank");
    factory.answer(&decided);
    factory.forget();
    let (outcome, _) = dispatched(
        kernel(&central),
        op(
            json!({"op": "factory_owner", "request": {"kind": "custody-assign",
        "state_path": state, "position_ref": "central:position:project:O-I:anima", "work_ref": "work:take-4",
        "reason": "Kite mixes alone", "autonomy": "auto", "review_gate": "diffs",
        "escalate_to": "central:person:frank"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(
        factory.asked(),
        [format!("development custody assign {} --position central:position:project:O-I:anima --work work:take-4 --reason Kite mixes alone --autonomy auto --review-gate diffs --escalate-to central:person:frank --json", state.display())]
    );
    assert_eq!(receipts(&outcome)[0]["ref"], "factory:custody:01k8w3");
    // Factory's own refusal of a value it does not admit, in its words.
    factory.refuse(
        Some(
            &json!({"schema": "factory.refusal/v1", "code": "factory.custody.usage",
            "fact": "--autonomy sometimes is not an autonomy; use suggest, review or auto",
            "consequence": "The command did not run; nothing was read or persisted.",
            "action": "run: factory development custody assign …"}),
        ),
        "",
        2,
    );
    let (outcome, _) = dispatched(
        kernel(&central),
        op(
            json!({"op": "factory_owner", "request": {"kind": "custody-assign",
        "state_path": state, "position_ref": "central:position:project:O-I:anima", "work_ref": "work:take-4",
        "reason": "r", "autonomy": "sometimes"}}),
        ),
    );
    assert!(outcome.unwrap_err().contains("suggest, review or auto"));
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

#[test]
fn the_frames_monitor_reads_a_streams_frames_from_aikits_gateway_journal() {
    let _held = hold();
    let dir = scratch("replay");
    let aikit = Fake::new(&dir, "aikit");
    let _bin = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    // `aikit gateway replay --json`'s answer: the gateway's GatewayResponse::Replay.
    let replay = json!({"type": "replay", "replay": {
        "stream_ref": "actuation-stream/replay", "after_sequence": 1, "returned_through": 2,
        "stream_last_sequence": 3, "has_more": true,
        "events": [{"sequence": 2, "event": {"kind": "human-message", "content": "frame 2"}}]}});
    aikit.answer(&envelope(replay.clone()));
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_read", "request": {"kind": "gateway-replay",
            "stream": "actuation-stream/replay", "after": 1, "limit": 1}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty());
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "aikit gateway replay");
    assert_eq!(data, replay, "the gateway's replay, verbatim");
    assert_eq!(
        aikit.asked(),
        ["gateway replay --stream actuation-stream/replay --after 1 --limit 1 --json"]
    );
    // Another Stream's replay is named, never carried.
    let mut other = replay.clone();
    other["replay"]["stream_ref"] = json!("actuation-stream/other");
    aikit.answer(&envelope(other));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_read", "request": {"kind": "gateway-replay",
            "stream": "actuation-stream/replay"}}),
        ),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    // The gateway's refusal, in its words; no gateway, honestly.
    aikit.refuse(
        Some(
            &json!({"ok": false, "schema": 1, "error": {"code": "agency_gateway.unknown_stream",
            "message": "gateway has no journal for Stream actuation-stream/none"}}),
        ),
        "",
        1,
    );
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_read", "request": {"kind": "gateway-replay",
            "stream": "actuation-stream/none"}}),
        ),
    );
    assert!(outcome
        .unwrap_err()
        .contains("gateway has no journal for Stream actuation-stream/none"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn the_gateways_ecology_names_the_streams_a_replay_reads() {
    let _held = hold();
    let dir = scratch("ecology");
    let aikit = Fake::new(&dir, "aikit");
    let _bin = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    // `aikit gateway ecology --json` (gateway_runtime.rs GatewayEcology).
    let ecology = json!({"type": "ecology", "ecology": {"version": "aikit.agency-gateway-ecology/v1",
        "gateway_ref": "agency-gateway/local", "authority": "presence-does-not-imply-authority",
        "agencies": [{"agency_ref": "agency/replay", "sessions": [{"agent_session_ref": "agent-session/replay",
            "agency_ref": "agency/replay", "actuation_refs": [], "harness_ref": "harness/hermes",
            "streams": [{"stream_ref": "actuation-stream/replay", "last_sequence": 3, "event_count": 3}],
            "surfaces": [], "invocation_modes": []}]}]}});
    aikit.answer(&envelope(ecology.clone()));
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_read", "request": {"kind": "gateway-ecology", "at": "workcell:omarchy"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert_eq!(reading(&outcome).1, ecology);
    assert_eq!(
        aikit.asked(),
        ["gateway ecology --at workcell:omarchy --json"]
    );
    aikit.answer(&envelope(json!({"type": "snapshot", "snapshot": {}})));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "aikit_read", "request": {"kind": "gateway-ecology"}})),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn ql_reads_its_compiled_m_ledger_and_its_coverage() {
    let _held = hold();
    let dir = scratch("ledger");
    let ql = Fake::new(&dir, "ql");
    let _bin = Bound::set("OI_QL_BIN", &ql.bin);
    // The installed QL's own view of one generation cell (REAL).
    let ledger = fixture("ql-kernel-ledger-2026-10-21.json");
    ql.answer(&ledger["answer"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "ql_read", "request": {"kind": "kernel-ledger", "coordinate": "M3-3-2-0-1"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty());
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "ql kernel ledger");
    assert_eq!(data, ledger["answer"], "QL's view, verbatim");
    assert_eq!(ql.asked(), ["kernel ledger M3-3-2-0-1 --json"]);
    assert_eq!(ql.stdin(), "", "a ledger read takes no input");
    // The whole ledger is another schema: a view answered for it is named.
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "ql_read", "request": {"kind": "kernel-ledger"}})),
    );
    let error = outcome.unwrap_err();
    assert!(
        error.contains("ql.m-ledger-view/v1") && error.contains("ql.m-ledger/v1"),
        "{error}"
    );
    // QL's refusal (REAL words).
    ql.refuse(None, ledger["refusal_stderr"].as_str().unwrap(), 2);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "ql_read", "request": {"kind": "kernel-ledger", "coordinate": "NOPE"}})),
    );
    assert!(outcome
        .unwrap_err()
        .contains("ql: unknown exact M coordinate: NOPE"));
    // Coverage: the owner's flags in its spelling (the reading's head as QL answered it, 21 Oct 2026).
    ql.answer(
        &json!({"schema": "ql.m-coverage/v1", "scope": "#3-3-2", "stratum": "rust",
        "axis": "operational", "required_readiness": "verified", "structural_coordinates": 196,
        "rows": [], "blocking_rows": [], "findings": []}),
    );
    ql.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "ql_read", "request": {"kind": "kernel-coverage", "coordinate": "M3-3-2",
            "require": "verified"}}),
        ),
    );
    assert_eq!(reading(&outcome.unwrap()).1["structural_coordinates"], 196);
    assert_eq!(
        ql.asked(),
        ["kernel coverage M3-3-2 --require verified --json"]
    );
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn ql_registry_vak_techne_and_operator_reads_carry_qls_answers() {
    let _held = hold();
    let dir = scratch("ql-registry");
    let ql = Fake::new(&dir, "ql");
    let _bin = Bound::set("OI_QL_BIN", &ql.bin);
    // The installed QL's own answers (REAL).
    let real = fixture("ql-registry-reads-2026-10-21.json");
    for (request, key, argv) in [
        (
            json!({"kind": "mef-lenses"}),
            "mef_lenses",
            "mef lenses --json",
        ),
        (
            json!({"kind": "context-frame-list"}),
            "context_frame_list",
            "context-frame list --json",
        ),
        (
            json!({"kind": "service-capabilities"}),
            "service_capabilities",
            "service capabilities --json",
        ),
        (
            json!({"kind": "kernel-apply", "operator": "conjugate-address",
                   "address": "qladdr:sixfold@1/direct/P5/d0"}),
            "kernel_apply",
            "kernel apply conjugate-address qladdr:sixfold@1/direct/P5/d0 --json",
        ),
        (
            json!({"kind": "vak-locate", "vak_ref": "M0"}),
            "vak_locate",
            "vak locate M0 --json",
        ),
        (
            json!({"kind": "techne-reading", "target": real["techne_reading"]["input"]}),
            "techne_reading",
            "techne reading /dev/stdin --json",
        ),
    ] {
        ql.answer(&real[key]["answer"]);
        ql.forget();
        let (outcome, form) = dispatched(
            no_central(&dir),
            op(json!({"op": "ql_read", "request": request})),
        );
        let outcome = outcome.unwrap_or_else(|error| panic!("{key}: {error}"));
        assert_eq!(form, "owner-read", "{key}");
        assert_eq!(reading(&outcome).1, real[key]["answer"], "{key}: verbatim");
        assert_eq!(ql.asked(), [argv], "{key}");
    }
    assert_eq!(
        serde_json::from_str::<Value>(&ql.stdin()).unwrap(),
        real["techne_reading"]["input"],
        "the target goes on stdin"
    );
    // Another entry's answer is named: the asked ref is not echoed.
    ql.answer(&real["vak_locate"]["answer"]);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "ql_read", "request": {"kind": "vak-locate", "vak_ref": "M1"}})),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    // An operator answer for another operator is named too.
    ql.answer(&real["kernel_apply"]["answer"]);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "ql_read", "request": {"kind": "kernel-apply",
            "operator": "complement-address", "address": "qladdr:sixfold@1/direct/P5/d0"}})),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    // QL's refusal (REAL words).
    ql.refuse(
        None,
        real["vak_locate"]["refusal_stderr"].as_str().unwrap(),
        2,
    );
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "ql_read", "request": {"kind": "vak-context", "vak_ref": "NOPE", "depth": 1}}),
        ),
    );
    assert!(outcome.unwrap_err().contains("ql: invalid Vāk ref `NOPE`"));
    assert_eq!(ql.asked().last().unwrap(), "vak context NOPE 1 --json");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn prompt_pads_read_the_bank_and_a_write_presents_the_persons_grant() {
    let _held = hold();
    let dir = scratch("pads");
    let factory = Fake::new(&dir, "factory");
    let _bin = Bound::set("OI_FACTORY_BIN", &factory.bin);
    let state = dir.join("Work/Demo/.factory/development-state.json");
    fs::create_dir_all(state.parent().unwrap()).unwrap();
    // Factory's own readings of an empty bank (REAL).
    let real = fixture("factory-pads-2026-10-21.json");
    factory.answer(&real["pads"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "factory_owner", "request": {"kind": "pads-read", "state_path": state,
            "project_ref": "project:point-cloud-demo"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty());
    let KernelOpResult::FactoryDevelopmentReading { data } = &outcome.result else {
        panic!("{:?}", outcome.result)
    };
    assert_eq!(*data, real["pads"], "Factory's bank, verbatim");
    assert_eq!(
        factory.asked(),
        [format!(
            "development pads {} project:point-cloud-demo --json",
            state.display()
        )]
    );
    factory.answer(&real["due"]);
    factory.forget();
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "factory_owner", "request": {"kind": "pads-due", "state_path": state,
            "project_ref": "project:point-cloud-demo", "now_unix_ms": 1792585987681_i64,
            "since_unix_ms": 1792499587681_i64}}),
        ),
    );
    assert_eq!(form, "owner-read");
    outcome.unwrap();
    assert_eq!(
        factory.asked(),
        [format!("development pads-due {} project:point-cloud-demo --now 1792585987681 --since 1792499587681 --json", state.display())]
    );

    // A write: the person's grant the host's token holds, from a stand-in
    // contract above the state — never the machine's Control.
    let token = "w3-test-token-0123456789abcdef0123456789abcdef";
    let digest = {
        use sha2::{Digest, Sha256};
        Sha256::digest(token.as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    };
    fs::create_dir_all(dir.join("Control/user")).unwrap();
    fs::write(
        dir.join("Control/user/native-action-authority.json"),
        serde_json::to_vec(&json!({"schema": "central.native-action-authority/v1", "scope_ref": "control:root",
            "grants": [{"principal_ref": "central:source:control:root:Control/user/identity", "actor_kind": "human",
                "token_sha256": digest, "scope_refs": ["control:root"], "actions": [],
                "expires_at_unix_seconds": 4102444800_u64}]}))
        .unwrap(),
    )
    .unwrap();
    let _root = Bound::clear("OI_CENTRAL_ROOT");
    let _token = Bound::set("CENTRAL_NATIVE_TOKEN", token);
    let write = op(
        json!({"op": "factory_owner", "request": {"kind": "pads-write", "state_path": state,
        "project_ref": "project:demo", "index": 3, "expected_revision": "absent",
        "pad": {"prompt": "Tidy the seats"}}}),
    );
    factory.answer(&json!({"schema": "factory.prompt-pads-write/v1", "project_ref": "project:demo",
        "index": 3, "previous_revision": "absent", "revision": "blake3:aa", "changed": true,
        "written_by": "oi:desk-prompt-pads", "authority_ref": "central:native-action-authority#central:source:control:root:Control/user/identity",
        "pad": {"prompt": "Tidy the seats"}, "automatic_agent_or_model_invocation": false}));
    factory.forget();
    let (outcome, form) = dispatched(no_central(&dir), write.clone());
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    let sent: Value = serde_json::from_str(&factory.stdin()).unwrap();
    assert_eq!(
        sent["authority"]["authorityRef"],
        "central:native-action-authority#central:source:control:root:Control/user/identity",
        "the grant the host's token holds"
    );
    assert_eq!(sent["caller"]["projectionKind"], "desktop-human");
    assert_eq!(sent["pad"]["prompt"], "Tidy the seats");
    assert!(
        !factory.stdin().contains(token),
        "the token never travels in the request"
    );
    let wire = receipts(&outcome);
    assert_eq!(wire[0]["event"], "factory_run_changed");
    assert_eq!(wire[0]["action"], "development pads-write");
    assert_eq!(wire[0]["ref"], "project:demo#pads");
    assert_eq!(wire[0]["revision"], "blake3:aa");
    // Without the person's token the write is refused before Factory is asked.
    let _gone = Bound::set(
        "CENTRAL_NATIVE_TOKEN",
        "another-token-0123456789abcdef0123456789",
    );
    factory.forget();
    let (outcome, _) = dispatched(no_central(&dir), write);
    assert!(outcome.unwrap_err().contains("no one human grant"));
    assert!(factory.asked().is_empty(), "Factory was not asked");
    // Factory's own refusal document (REAL words), and a begin recorded.
    let _token = Bound::set("CENTRAL_NATIVE_TOKEN", token);
    factory.refuse(Some(&real["write_refusal"]), "", 2);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "factory_owner", "request": {"kind": "pads-write", "state_path": state,
            "project_ref": "project:demo", "index": 3, "expected_revision": "absent", "pad": null}}),
        ),
    );
    assert!(outcome
        .unwrap_err()
        .contains("A pad is written by a person at the desktop: the request names no caller Nothing was written."));
    factory.answer(&json!({"schema": "factory.prompt-pads-run/v1", "project_ref": "project:demo", "index": 3,
        "created": true, "run_ref": "factory:pad-run:demo:3:1", "run": {}, "revision": "blake3:bb"}));
    factory.forget();
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "factory_owner", "request": {"kind": "pads-run", "state_path": state,
            "request": {"project_ref": "project:demo", "index": 3, "trigger": "press"}}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(
        factory.asked(),
        [format!("development pads-run {} - --json", state.display())]
    );
    assert_eq!(receipts(&outcome)[0]["ref"], "factory:pad-run:demo:3:1");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn workcell_material_reads_and_world_writes_through_its_own_cli() {
    let _held = hold();
    let dir = scratch("workcell-material");
    let workcell = Fake::new(&dir, "workcell");
    let _bin = Bound::set("OI_WORKCELL_BIN", &workcell.bin);
    // Workcell's own answers (REAL, read only).
    let real = fixture("workcell-material-2026-10-21.json");
    for (request, key, argv) in [
        (
            json!({"kind": "doctor"}),
            "doctor",
            "doctor --json".to_owned(),
        ),
        (
            json!({"kind": "discover"}),
            "discover",
            "discover --json".to_owned(),
        ),
        (json!({"kind": "plan"}), "plan", "plan --json".to_owned()),
        (
            json!({"kind": "instances-usage", "instance_ref": "instance:claude-code:3d93", "pid": 68061,
                   "interval_ms": 0}),
            "usage",
            "instances usage instance:claude-code:3d93 --pid 68061 --interval-ms 0 --json"
                .to_owned(),
        ),
    ] {
        workcell.answer(&real[key]);
        workcell.forget();
        let (outcome, form) = dispatched(
            no_central(&dir),
            op(json!({"op": "workcell_read", "request": request})),
        );
        let outcome = outcome.unwrap_or_else(|error| panic!("{key}: {error}"));
        assert_eq!(form, "owner-read", "{key}");
        assert_eq!(reading(&outcome).1, real[key], "{key}: verbatim");
        assert_eq!(workcell.asked(), [argv], "{key}");
    }
    // An unsatisfiable plan is Workcell's reading too (REAL: the plan on
    // stdout, its error on stderr, exit 3); the demand in Workcell's flags.
    workcell.refuse(
        Some(&real["plan_unsatisfiable"]["stdout"]),
        real["plan_unsatisfiable"]["stderr"].as_str().unwrap(),
        3,
    );
    workcell.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "workcell_read", "request": {"kind": "plan",
            "demand": {"require": ["workspace"], "resource": ["cpu=2"]}}})),
    );
    let (_, plan, _) = reading(&outcome.unwrap());
    assert_eq!(plan["status"], "unsatisfiable");
    assert_eq!(
        workcell.asked(),
        ["plan --require workspace --resource cpu=2 --json"]
    );
    // A collect is a read of the world's receipt; Workcell's refusal in its words.
    workcell.refuse(
        Some(&json!({"error": {"kind": "invalid-demand",
            "message": "invalid demand: this command requires `--receipt <material-world.json>`"}, "ok": false})),
        "",
        2,
    );
    workcell.forget();
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "workcell_read", "request": {"kind": "collect", "receipt": "/w/world.json"}}),
        ),
    );
    assert_eq!(form, "owner-read");
    assert!(outcome.unwrap_err().contains("requires `--receipt"));
    assert_eq!(workcell.asked(), ["--receipt /w/world.json collect --json"]);

    // Writes on a world and a connection: Workcell's own answers' shapes
    // (workcell-cli main.rs), FAKE — never the machine.
    workcell.answer(
        &json!({"ok": true, "world_ref": "world:w3", "disposition": "released", "changed": true}),
    );
    workcell.forget();
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "workcell_write", "request": {"kind": "release", "receipt": "/w/world.json"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(workcell.asked(), ["--receipt /w/world.json release --json"]);
    assert_eq!(receipts(&outcome)[0]["ref"], "world:w3");
    workcell.answer(&json!({"ok": true, "deltas": []}));
    workcell.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "workcell_write", "request": {"kind": "reconcile", "receipt": "/w/world.json",
            "desired": ["service:a=running", "service:b=stopped"]}}),
        ),
    );
    assert!(outcome.unwrap().receipts.is_empty(), "no delta, no receipt");
    assert_eq!(
        workcell.asked(),
        ["--receipt /w/world.json reconcile --desired service:a=running --desired service:b=stopped --json"]
    );
    workcell
        .answer(&json!({"ok": true, "label": "omarchy", "state": "disconnected", "changed": true}));
    workcell.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "workcell_write", "request": {"kind": "disconnect", "label": "omarchy"}})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(workcell.asked(), ["connections disconnect omarchy --json"]);
    assert_eq!(
        receipts(&outcome)[0]["action"],
        "workcell connections disconnect"
    );
    assert!(traced().contains("written Workcell workcell connections disconnect"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn aikit_continuity_history_skillset_and_knowledge_routes() {
    let _held = hold();
    let dir = scratch("aikit-d");
    let aikit = Fake::new(&dir, "aikit");
    let _bin = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    // AIKit's own answers (REAL).
    let real = fixture("aikit-continuity-history-2026-10-21.json");
    for (request, key, argv) in [
        (
            json!({"kind": "continuity-commands"}),
            "commands",
            "work continuity commands --json",
        ),
        (
            json!({"kind": "continuity-pressure"}),
            "pressure",
            "work continuity pressure --json",
        ),
        (
            json!({"kind": "bypass-list"}),
            "bypass_list",
            "bypass list --json",
        ),
        (
            json!({"kind": "history", "view": "failures"}),
            "history_failures",
            "history failures --json",
        ),
    ] {
        aikit.answer(&real[key]);
        aikit.forget();
        let (outcome, form) = dispatched(
            no_central(&dir),
            op(json!({"op": "aikit_read", "request": request})),
        );
        let outcome = outcome.unwrap_or_else(|error| panic!("{key}: {error}"));
        assert_eq!(form, "owner-read", "{key}");
        assert_eq!(
            reading(&outcome).1,
            real[key]["data"],
            "{key}: the envelope's reading"
        );
        assert_eq!(aikit.asked(), [argv], "{key}");
    }
    // A close-out that is not verified exits 1 with its verdict: a reading (REAL).
    aikit.refuse(Some(&real["closeout"]), "", 1);
    aikit.forget();
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_read", "request": {"kind": "closeout-verify", "since": 1792540800_u64,
            "run": "factory-run/r1"}}),
        ),
    );
    assert_eq!(form, "owner-read");
    let (_, verdict, _) = reading(&outcome.unwrap());
    assert_eq!(verdict, real["closeout"]["data"]);
    assert_eq!(
        aikit.asked(),
        ["work continuity closeout verify --since 1792540800 --run factory-run/r1 --json"]
    );
    // AIKit's refusal for a directory with no world, in its words (REAL).
    aikit.refuse(
        Some(&json!({"error": {"code": "cli.usage", "details": {},
            "message": "no Central world for this working directory; close-out verification reads a project's NOW field"},
            "ok": false, "schema": 1})),
        "",
        2,
    );
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "aikit_read", "request": {"kind": "closeout-verify"}})),
    );
    assert!(outcome
        .unwrap_err()
        .contains("no Central world for this working directory"));
    // The whole History is its own schema; a view's answer for it is named.
    aikit.answer(&real["history_failures"]);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "aikit_read", "request": {"kind": "history", "resource": "skill/x"}})),
    );
    let error = outcome.unwrap_err();
    assert!(error.contains("aikit.explain-history/v1"), "{error}");
    // Writes, FAKE: a forget of one route, an undo, a promote with trust.
    aikit.answer(&envelope(json!({"forgot": {"route": "knowledge-route/a"},
        "preserved": ["canonical-resource-identity", "provider-truth", "knowledge-operation-history"]})));
    aikit.forget();
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_write", "request": {"kind": "knowledge-forget", "scope": "route",
            "resource": "knowledge-route/a"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(
        aikit.asked(),
        ["knowledge forget route knowledge-route/a --json"]
    );
    assert_eq!(receipts(&outcome)[0]["ref"], "knowledge-route/a");
    aikit.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "aikit_write", "request": {"kind": "knowledge-forget", "scope": "route"}})),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    assert!(
        aikit.asked().is_empty(),
        "nothing asked without the resource"
    );
    aikit.answer(&envelope(
        json!({"procedure": "procedure/adopt-1", "undone": true}),
    ));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_write", "request": {"kind": "procedure-undo", "procedure": "procedure/adopt-1"}}),
        ),
    );
    assert_eq!(receipts(&outcome.unwrap())[0]["ref"], "procedure/adopt-1");
    aikit.answer(&envelope(
        json!({"source": "central-skills", "promoted": true}),
    ));
    aikit.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_write", "request": {"kind": "source-promote", "id": "central-skills",
            "trust_skills": ["skill/central/a", "skill/central/b"]}}),
        ),
    );
    outcome.unwrap();
    assert_eq!(
        aikit.asked(),
        ["source promote central-skills --trust-skill skill/central/a --trust-skill skill/central/b --json"]
    );
    // Adoption as a plan is a read; with `yes` it is the write, never into Control.
    aikit.answer(&envelope(json!({"plan": {"moves": []}})));
    aikit.forget();
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_read", "request": {"kind": "adopt-plan", "root": "/h/.claude/skills",
            "namespace": "claude"}}),
        ),
    );
    assert_eq!(form, "owner-read");
    outcome.unwrap();
    assert_eq!(
        aikit.asked(),
        ["adopt /h/.claude/skills --namespace claude --json"]
    );
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn actuation_authority_issue_and_revoke_write_actuations_own_store() {
    let _held = hold();
    let dir = scratch("actuation-authority");
    let actuation = Fake::new(&dir, "actuation");
    let _bin = Bound::set("OI_ACTUATION_BIN", &actuation.bin);
    // Actuation 0.2.1's own answers against a scratch store (REAL), replayed
    // by a fake: no write reaches the owner's authority store.
    let real = fixture("actuation-authority-2026-10-21.json");
    actuation.answer(&real["issue"]["stdout"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_write", "request": {"kind": "authority-issue",
            "record": real["record"]}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(
        actuation.asked(),
        ["authority issue - --json"],
        "no store, no clock from the desk"
    );
    assert_eq!(
        serde_json::from_str::<Value>(&actuation.stdin()).unwrap(),
        real["record"],
        "the record goes on stdin, as handed"
    );
    assert_eq!(reading(&outcome).1, real["issue"]["stdout"]);
    let wire = receipts(&outcome);
    assert_eq!(wire[0]["owner"], "actuation");
    assert_eq!(wire[0]["ref"], "authority-source:desk-probe");
    assert!(traced().contains("written Actuation actuation authority issue"));
    // A second issue of the same source: Actuation's refusal, in its words.
    actuation.refuse(None, real["issue_again"]["stderr"].as_str().unwrap(), 2);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_write", "request": {"kind": "authority-issue",
            "record": real["record"]}}),
        ),
    );
    let error = outcome.unwrap_err();
    assert!(error.contains("already exists"), "{error}");
    // A record naming no source asks nothing.
    actuation.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_write", "request": {"kind": "authority-issue",
            "record": {"schema": "actuation.local-authority/v1"}}}),
        ),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    assert!(actuation.asked().is_empty());
    // Revocation with the person's reason.
    actuation.answer(&real["revoke"]["stdout"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_write", "request": {"kind": "authority-revoke",
            "authority_source_ref": "authority-source:desk-probe", "reason": "probe withdrawn"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(
        actuation.asked(),
        ["authority revoke authority-source:desk-probe --reason probe withdrawn --json"]
    );
    assert_eq!(receipts(&outcome)[0]["ref"], "authority-source:desk-probe");
    // An answer for another source is not this revocation.
    actuation.answer(&real["revoke"]["stdout"]);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_write", "request": {"kind": "authority-revoke",
            "authority_source_ref": "authority-source:other"}}),
        ),
    );
    assert!(outcome
        .unwrap_err()
        .contains("revoked true for authority-source:other"));
    // Unknown and already-revoked sources: Actuation's words.
    for key in ["revoke_unknown", "revoke_again"] {
        actuation.refuse(None, real[key]["stderr"].as_str().unwrap(), 2);
        let (outcome, _) = dispatched(
            no_central(&dir),
            op(
                json!({"op": "actuation_write", "request": {"kind": "authority-revoke",
                "authority_source_ref": "authority-source:none"}}),
            ),
        );
        let error = outcome.unwrap_err();
        let words = real[key]["stderr"].as_str().unwrap().trim();
        let words = words.strip_prefix("actuation: ").unwrap_or(words);
        assert!(error.contains(words), "{key}: {error}");
    }
    // The grants as Actuation lists them (Actuation#141's own answer, REAL):
    // a read, nothing recorded, nothing written.
    actuation.answer(&real["list"]["stdout"]);
    actuation.forget();
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(json!({"op": "actuation_read", "request": {"kind": "authority-list"}})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty());
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "actuation authority list");
    assert_eq!(
        data, real["list"]["stdout"],
        "Actuation's listing, verbatim"
    );
    assert_eq!(
        data["authorities"][0]["revoked"]["reason"],
        "probe withdrawn"
    );
    assert_eq!(actuation.asked(), ["authority list --json"]);
    // An Actuation without the listing (0.2.1, REAL): its words, no fallback.
    actuation.refuse(
        None,
        real["list_installed_0_2_1"]["stderr"].as_str().unwrap(),
        2,
    );
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "actuation_read", "request": {"kind": "authority-list"}})),
    );
    let error = outcome.unwrap_err();
    assert!(error.contains("unknown command authority"), "{error}");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn ql_reads_an_external_structures_context_frame_through_its_own_cli() {
    let _held = hold();
    let dir = scratch("ql-cf-read");
    let ql = Fake::new(&dir, "ql");
    let _bin = Bound::set("OI_QL_BIN", &ql.bin);
    // QL-MEF#344's own answers (REAL), replayed.
    let real = fixture("ql-context-frame-read-2026-10-21.json");
    ql.answer(&real["exact"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "ql_read", "request": {"kind": "context-frame-read",
            "request": real["request"]}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty());
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "ql context-frame read");
    assert_eq!(data, real["exact"], "QL's reading, verbatim");
    assert_eq!(data["status"]["frame"]["code"], "CF5");
    assert_eq!(data["runtime_authority"], false);
    assert_eq!(ql.asked(), ["context-frame read - --json"]);
    assert_eq!(
        serde_json::from_str::<Value>(&ql.stdin()).unwrap(),
        real["request"],
        "the request goes on stdin, as handed"
    );
    // An ambiguous reading is QL's answer too, never narrowed here.
    ql.answer(&real["ambiguous"]);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "ql_read", "request": {"kind": "context-frame-read",
            "request": real["request"]}}),
        ),
    );
    assert_eq!(reading(&outcome.unwrap()).1["status"]["kind"], "ambiguous");
    // QL's refusal of a malformed request, and an installed QL without the
    // command: each in QL's words.
    for key in ["refusal_missing_field", "installed_refusal"] {
        ql.refuse(None, real[key].as_str().unwrap(), 2);
        let (outcome, _) = dispatched(
            no_central(&dir),
            op(
                json!({"op": "ql_read", "request": {"kind": "context-frame-read",
                "request": {"target_ref": "t"}}}),
            ),
        );
        let error = outcome.unwrap_err();
        let words = real[key].as_str().unwrap().trim();
        let words = words.strip_prefix("ql: ").unwrap_or(words);
        assert!(error.contains(words), "{key}: {error}");
    }
    // Another document is not this reading.
    ql.answer(&json!({"grammarVersion": "1.0.0", "frames": []}));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "ql_read", "request": {"kind": "context-frame-read",
            "request": real["request"]}}),
        ),
    );
    assert!(outcome
        .unwrap_err()
        .contains("ql.mef.context-frame-reading/1.0.0"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn aikit_history_views_skillset_reads_and_source_writes_carry_aikits_words() {
    let _held = hold();
    let dir = scratch("aikit-d2");
    let aikit = Fake::new(&dir, "aikit");
    let _bin = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    // AIKit's own answers (REAL; collate and unused trimmed, as named in the fixture).
    let real = fixture("aikit-continuity-history-2026-10-21.json");
    for (request, key, argv) in [
        (
            json!({"kind": "history", "view": "recent"}),
            "history_recent",
            "history recent --json",
        ),
        (
            json!({"kind": "history", "view": "stats"}),
            "history_stats",
            "history stats --json",
        ),
        (
            json!({"kind": "history", "view": "bypasses"}),
            "history_bypasses",
            "history bypasses --json",
        ),
        (
            json!({"kind": "procedure-list"}),
            "procedure_list",
            "procedure list --json",
        ),
        (
            json!({"kind": "collate", "all": true}),
            "collate_trimmed",
            "collate --all --json",
        ),
        (json!({"kind": "unused"}), "unused_trimmed", "unused --json"),
    ] {
        aikit.answer(&real[key]);
        aikit.forget();
        let (outcome, form) = dispatched(
            no_central(&dir),
            op(json!({"op": "aikit_read", "request": request})),
        );
        let outcome = outcome.unwrap_or_else(|error| panic!("{key}: {error}"));
        assert_eq!(form, "owner-read", "{key}");
        assert!(outcome.receipts.is_empty(), "{key}: a read records nothing");
        assert_eq!(reading(&outcome).1, real[key]["data"], "{key}");
        assert_eq!(aikit.asked(), [argv], "{key}");
    }
    // Readings AIKit shapes per resource (FAKE): carried as answered.
    for (request, argv) in [
        (
            json!({"kind": "source-show", "id": "central-skills"}),
            "source show central-skills --json",
        ),
        (
            json!({"kind": "explain", "resource": "skill/central/orient"}),
            "explain skill/central/orient --json",
        ),
        (
            json!({"kind": "procedure-diff", "procedure": "procedure/adopt-1"}),
            "procedure diff procedure/adopt-1 --json",
        ),
        (
            json!({"kind": "knowledge-frame", "addresses": ["wiki:a", "wiki:b"], "query": "seat"}),
            "knowledge frame wiki:a wiki:b --query seat --json",
        ),
        (
            json!({"kind": "history", "resource": "skill/central/orient", "view": "recent"}),
            "history skill/central/orient recent --json",
        ),
    ] {
        let answered = json!({"asked": argv});
        aikit.answer(&envelope(if argv.starts_with("history") {
            json!({"count": 0, "events": []})
        } else {
            answered.clone()
        }));
        aikit.forget();
        let (outcome, _) = dispatched(
            no_central(&dir),
            op(json!({"op": "aikit_read", "request": request})),
        );
        outcome.unwrap_or_else(|error| panic!("{argv}: {error}"));
        assert_eq!(aikit.asked(), [argv]);
    }
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "aikit_read", "request": {"kind": "knowledge-frame", "addresses": []}})),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    // Writes (FAKE): each moves AIKit's state and records a receipt, except
    // where AIKit says nothing changed.
    for (request, argv, reference) in [
        (
            json!({"kind": "bypass-revoke", "id": "bypass-7"}),
            "bypass revoke bypass-7 --json",
            Some("bypass-7"),
        ),
        (
            json!({"kind": "source-sync", "id": "central-skills"}),
            "source sync central-skills --json",
            Some("central-skills"),
        ),
        (
            json!({"kind": "source-rollback", "id": "central-skills"}),
            "source rollback central-skills --json",
            Some("central-skills"),
        ),
        (
            json!({"kind": "adopt", "root": "/h/.claude/skills", "namespace": "claude"}),
            "adopt /h/.claude/skills --namespace claude --yes --json",
            None,
        ),
    ] {
        aikit.answer(&envelope(json!({"done": true})));
        aikit.forget();
        let (outcome, form) = dispatched(
            no_central(&dir),
            op(json!({"op": "aikit_write", "request": request})),
        );
        let outcome = outcome.unwrap_or_else(|error| panic!("{argv}: {error}"));
        assert_eq!(form, "owner-write", "{argv}");
        assert_eq!(aikit.asked(), [argv]);
        let wire = receipts(&outcome);
        assert_eq!(wire[0]["owner"], "ai-kit", "{argv}");
        if let Some(reference) = reference {
            assert_eq!(wire[0]["ref"], reference, "{argv}");
        }
    }
    // AIKit saying nothing changed records no receipt.
    aikit.answer(&envelope(
        json!({"source": "central-skills", "changed": false}),
    ));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_write", "request": {"kind": "source-sync", "id": "central-skills"}}),
        ),
    );
    assert!(outcome.unwrap().receipts.is_empty());
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn workcell_lists_its_instances_and_recovers_a_prepared_world() {
    let _held = hold();
    let dir = scratch("workcell-instances");
    let workcell = Fake::new(&dir, "workcell");
    let _bin = Bound::set("OI_WORKCELL_BIN", &workcell.bin);
    let real = fixture("workcell-material-2026-10-21.json");
    workcell.answer(&real["instances"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(json!({"op": "workcell_read", "request": {"kind": "instances-list"}})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert_eq!(
        reading(&outcome).1,
        real["instances"],
        "Workcell's listing (REAL), verbatim"
    );
    assert_eq!(workcell.asked(), ["instances list --json"]);
    // Recover on a prepared world (FAKE: never the machine's real world).
    workcell.answer(&json!({"receipt": "/w/world.json",
        "world": {"world_ref": "world:demo", "state": "recovered"}}));
    workcell.forget();
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "workcell_write", "request": {"kind": "recover", "receipt": "/w/world.json"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(workcell.asked(), ["--receipt /w/world.json recover --json"]);
    let wire = receipts(&outcome);
    assert_eq!(wire[0]["owner"], "workcell");
    assert_eq!(wire[0]["ref"], "world:demo");
    // An answer without the recovered world is not this recovery.
    workcell.answer(&json!({"receipt": "/w/world.json"}));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "workcell_write", "request": {"kind": "recover", "receipt": "/w/world.json"}}),
        ),
    );
    assert!(outcome.is_err());
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn actuation_lists_a_sessions_streams_and_replays_one_from_its_store() {
    let _held = hold();
    let dir = scratch("actuation-streams");
    let actuation = Fake::new(&dir, "actuation");
    let _bin = Bound::set("OI_ACTUATION_BIN", &actuation.bin);
    // This machine's store as Actuation read it (REAL), replayed.
    let real = fixture("actuation-streams-2026-10-21.json");
    let session = real["list"]["streams"][0]["agent_session_ref"]
        .as_str()
        .unwrap()
        .to_owned();
    let stream = real["list"]["streams"][0]["stream_ref"]
        .as_str()
        .unwrap()
        .to_owned();
    actuation.answer(&real["list"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(json!({"op": "actuation_read", "request": {"kind": "stream-list", "session": session}})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty());
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "actuation stream list");
    assert_eq!(data, real["list"], "Actuation's listing, verbatim");
    assert_eq!(
        actuation.asked(),
        [format!("stream list --session {session} --json")]
    );
    actuation.answer(&real["replay"]);
    actuation.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_read", "request": {"kind": "stream-replay",
            "stream_ref": stream, "after": 2, "limit": 50}}),
        ),
    );
    let (route, data, _) = reading(&outcome.unwrap());
    assert_eq!(route, "actuation stream replay");
    assert_eq!(data, real["replay"]);
    assert_eq!(
        actuation.asked(),
        [format!(
            "stream replay {stream} --after 2 --limit 50 --json"
        )]
    );
    // A page of another stream is not this one.
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "actuation_read", "request": {"kind": "stream-replay",
            "stream_ref": "actuation:stream:other"}}),
        ),
    );
    assert!(outcome
        .unwrap_err()
        .contains("the page of actuation:stream:other"));
    // Actuation's own words for an unknown stream, and for 0.2.1 without the listing (REAL).
    for (key, request) in [
        (
            "replay_missing",
            json!({"kind": "stream-replay", "stream_ref": "actuation:stream:none"}),
        ),
        ("list_installed_0_2_1", json!({"kind": "stream-list"})),
    ] {
        actuation.refuse(None, real[key].as_str().unwrap(), 2);
        let (outcome, _) = dispatched(
            no_central(&dir),
            op(json!({"op": "actuation_read", "request": request})),
        );
        let error = outcome.unwrap_err();
        let words = real[key].as_str().unwrap().trim();
        let words = words.strip_prefix("actuation: ").unwrap_or(words);
        assert!(error.contains(words), "{key}: {error}");
    }
    assert!(
        !traced().contains("written Actuation actuation stream"),
        "a store read moves nothing"
    );
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn aikit_verifies_a_reflection_law_handed_on_stdin() {
    let _held = hold();
    let dir = scratch("aikit-reflection");
    let aikit = Fake::new(&dir, "aikit");
    let _bin = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    // ai-kit#541's own verdict (REAL), replayed.
    let real = fixture("aikit-impact-reflection-2026-10-21.json");
    aikit.answer(&envelope(real["verdict"].clone()));
    let law = json!({"id": "law/impact-subject", "unique_implementation": true,
        "mappings": [{"coordinate": "subject", "semantic": "wiki:node:staged/impact-subject",
            "implementation": "code:symbol:impact::subject", "relation": "implemented-by"}],
        "constitutive_relations": []});
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(json!({"op": "aikit_read", "request": {"kind": "reflection-verify", "law": law}})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty());
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "aikit knowledge reflection verify");
    assert_eq!(data, real["verdict"], "AIKit's verdict, verbatim");
    assert_eq!(data["verification"]["passed"], false);
    assert_eq!(aikit.asked(), ["knowledge reflection verify - --json"]);
    assert_eq!(serde_json::from_str::<Value>(&aikit.stdin()).unwrap(), law);
    // Not a law: refused before AIKit is asked.
    aikit.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "aikit_read", "request": {"kind": "reflection-verify", "law": "law/x"}})),
    );
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    assert!(aikit.asked().is_empty());
    // Another document is not a verdict.
    aikit.answer(&envelope(json!({"law": "law/x", "verification": {}})));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_read", "request": {"kind": "reflection-verify", "law": {"id": "law/x"}}}),
        ),
    );
    assert!(outcome.unwrap_err().contains("aikit.reflection-verdict/v1"));
    let _ = fs::remove_dir_all(&dir);
}

/// A Central that discloses the O-I World and answers its change horizon
/// (`central.source-change-horizon/v1`, FAKE in Central's shape).
fn horizon_central(dir: &Path) -> PathBuf {
    fs::create_dir_all(dir.join("Work/O-I")).unwrap();
    let horizon = json!({"ok": true, "data": {
        "schema": "central.source-change-horizon/v1", "provider": "central", "cursor": 4,
        "automatic_agent_or_model_invocation": false,
        "sources": [{"binding": {"ref": "source:file:impact-note"}, "revision": {"revision": "r2"}}],
        "changes": [{"cursor": 4, "world_ref": "world/test", "source_ref": "source:file:impact-note",
            "source_roles": [], "provenance": "owner seam observation (test fixture)",
            "standing": "observed", "before_revision": "r1", "after_revision": "r2",
            "kind": "modified", "agent_retrieval_allowed": true}]}});
    let bin = dir.join("ctrl");
    fs::write(
        &bin,
        format!(
            "#!/bin/sh\n\
             printf '%s\\n' \"$4\" >> \"{d}/central-asked.txt\"\n\
             case \"$4\" in\n\
             central.world) echo '{{\"ok\":true,\"data\":{{\"schema\":\"central.world-map/v1\",\"root\":\"{d}\",\"work\":{{\"projects\":[{{\"name\":\"O-I\",\"path\":\"Work/O-I\"}}]}}}}}}' ;;\n\
             projectcentral.change.horizon) [ -f \"{d}/no-horizon\" ] && {{ echo '{{\"ok\":false,\"error\":{{\"message\":\"horizon unavailable here\"}}}}'; exit 1; }}; cat <<'JSON'\n{horizon}\nJSON\n;;\n\
             *) echo '{{\"ok\":false,\"error\":{{\"message\":\"not faked\"}}}}'; exit 1 ;;\n\
             esac\n",
            d = dir.display(),
            horizon = horizon
        ),
    )
    .unwrap();
    fs::set_permissions(&bin, fs::Permissions::from_mode(0o755)).unwrap();
    stub::settle_stub(&bin);
    bin
}

/// The suite executable the knowledge calls go through (`OI_BIN`): it keeps
/// its argv and the horizon file it was handed, then answers.
fn knowledge_suite(dir: &Path) -> PathBuf {
    let bin = dir.join("oi");
    let d = dir.display();
    fs::write(
        &bin,
        format!(
            "#!/bin/sh\n\
             printf '%s\\n' \"$*\" >> \"{d}/oi-argv.txt\"\n\
             previous=''\n\
             for arg in \"$@\"; do [ \"$previous\" = '--horizon' ] && cp \"$arg\" \"{d}/horizon-sent.json\"; previous=\"$arg\"; done\n\
             cat \"{d}/oi-answer.json\"\n"
        ),
    )
    .unwrap();
    fs::set_permissions(&bin, fs::Permissions::from_mode(0o755)).unwrap();
    stub::settle_stub(&bin);
    bin
}

#[test]
fn knowledge_impact_composes_centrals_horizon_with_aikits_closure() {
    let _held = hold();
    let dir = scratch("knowledge-impact");
    let real = fixture("aikit-impact-reflection-2026-10-21.json");
    let central = horizon_central(&dir);
    let suite = knowledge_suite(&dir);
    let _bin = Bound::set("OI_BIN", &suite);
    fs::write(
        dir.join("oi-answer.json"),
        serde_json::to_vec(&envelope(real["impact"].clone())).unwrap(),
    )
    .unwrap();
    let (outcome, form) = dispatched(
        kernel(&central),
        op(json!({"op": "knowledge_impact", "project": "O-I",
            "readings": ["wiki:node:staged/impact-subject"], "max_depth": 4})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty(), "a read records nothing");
    let wire = serde_json::to_value(&outcome.result).unwrap();
    assert_eq!(wire["result"], "knowledge_impact");
    let reading = &wire["reading"];
    assert_eq!(
        reading["readings"],
        json!(["wiki:node:staged/impact-subject"])
    );
    assert_eq!(reading["horizon"]["state"], "available");
    assert_eq!(reading["aikit"]["state"], "invoked");
    assert_eq!(
        reading["aikit"]["receipt"], real["impact"],
        "AIKit's reading, verbatim"
    );
    let argv = fs::read_to_string(dir.join("oi-argv.txt")).unwrap();
    assert!(argv.contains("aikit --json -C"), "{argv}");
    assert!(
        argv.trim_end()
            .ends_with("--max-depth 4 -- wiki:node:staged/impact-subject"),
        "{argv}"
    );
    assert!(argv.contains("knowledge impact --horizon "), "{argv}");
    // The horizon AIKit was handed is Central's, adapted field by field.
    let sent: Value =
        serde_json::from_slice(&fs::read(dir.join("horizon-sent.json")).unwrap()).unwrap();
    assert_eq!(sent["cursor"], 4);
    assert_eq!(sent["sources"][0]["source"], "source:file:impact-note");
    assert_eq!(sent["changes"][0]["source"], "source:file:impact-note");
    assert_eq!(sent["changes"][0]["after_revision"], "r2");
    let asked = fs::read_to_string(dir.join("central-asked.txt")).unwrap();
    assert!(asked.contains("projectcentral.change.horizon"), "{asked}");

    // No horizon from Central: AIKit is not asked, and each side says why.
    fs::write(dir.join("no-horizon"), "").unwrap();
    let _ = fs::remove_file(dir.join("oi-argv.txt"));
    let (outcome, _) = dispatched(
        kernel(&central),
        op(json!({"op": "knowledge_impact", "project": "O-I"})),
    );
    let wire = serde_json::to_value(&outcome.unwrap().result).unwrap();
    assert_eq!(wire["reading"]["horizon"]["state"], "owner_refused");
    assert!(wire["reading"]["horizon"]["message"]
        .as_str()
        .unwrap()
        .contains("horizon unavailable here"));
    assert_eq!(wire["reading"]["aikit"]["state"], "not_asked");
    assert!(!dir.join("oi-argv.txt").exists(), "AIKit was not asked");

    // An AIKit without the leaf: its own words (REAL).
    let _ = fs::remove_file(dir.join("no-horizon"));
    fs::write(
        &suite,
        format!(
            "#!/bin/sh\nprintf '%s' {words:?} >&2\nexit 2\n",
            words = real["installed_refusal"].as_str().unwrap()
        ),
    )
    .unwrap();
    stub::settle_stub(&suite);
    let (outcome, _) = dispatched(
        kernel(&central),
        op(json!({"op": "knowledge_impact", "project": "O-I"})),
    );
    let wire = serde_json::to_value(&outcome.unwrap().result).unwrap();
    assert_eq!(wire["reading"]["aikit"]["state"], "owner_refused", "{wire}");
    assert!(wire["reading"]["aikit"]["message"]
        .as_str()
        .unwrap()
        .contains("unrecognized subcommand 'impact'"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn workcell_probes_its_connections_reachability_and_round_trip() {
    let _held = hold();
    let dir = scratch("workcell-probe");
    let workcell = Fake::new(&dir, "workcell");
    let _bin = Bound::set("OI_WORKCELL_BIN", &workcell.bin);
    // Workcell#117's own answers over two scratch cells (REAL), replayed.
    let real = fixture("workcell-connections-probe-2026-10-21.json");
    for (key, request, argv) in [
        (
            "reachable",
            json!({"kind": "connections-probe"}),
            "connections probe --json",
        ),
        (
            "unreachable",
            json!({"kind": "connections-probe", "label": "laptop", "timeout_ms": 500}),
            "connections probe laptop --timeout-ms 500 --json",
        ),
    ] {
        workcell.answer(&real[key]);
        workcell.forget();
        let (outcome, form) = dispatched(
            no_central(&dir),
            op(json!({"op": "workcell_read", "request": request})),
        );
        let outcome = outcome.unwrap_or_else(|error| panic!("{key}: {error}"));
        assert_eq!(form, "owner-read", "{key}");
        assert!(
            outcome.receipts.is_empty(),
            "{key}: a probe records nothing"
        );
        let (route, data, _) = reading(&outcome);
        assert_eq!(route, "workcell connections probe");
        assert_eq!(data, real[key], "{key}: Workcell's probe, verbatim");
        assert_eq!(workcell.asked(), [argv], "{key}");
    }
    assert!(real["reachable"]["probes"][0]["rtt_ms"].is_number());
    assert!(real["unreachable"]["probes"][0].get("rtt_ms").is_none());
    // A Workcell without the probe: its own words (REAL).
    workcell.refuse(Some(&real["installed_refusal"]), "", 2);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "workcell_read", "request": {"kind": "connections-probe"}})),
    );
    assert!(outcome
        .unwrap_err()
        .contains("unknown connections subcommand `probe`"));
    assert!(!traced().contains("written Workcell workcell connections probe"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn aikit_applies_only_the_reviewed_digest_and_ql_plans_the_living_wiki() {
    let _held = hold();
    let dir = scratch("digest-and-aperture");
    let aikit = Fake::new(&dir, "aikit");
    let _aikit = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    // Adoption bound to the reviewed plan's digest, and one exact Procedure (FAKE).
    aikit.answer(&envelope(
        json!({"procedure": "procedure/adopt-9", "applied": true}),
    ));
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_write", "request": {"kind": "adopt", "root": "/h/.claude/skills",
            "namespace": "claude", "expect_digest": "sha256:ab12"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(
        aikit.asked(),
        ["adopt /h/.claude/skills --namespace claude --expect-digest sha256:ab12 --yes --json"]
    );
    assert_eq!(receipts(&outcome)[0]["ref"], "procedure/adopt-9");
    aikit.forget();
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_write", "request": {"kind": "procedure-run",
            "procedure": "procedure/adopt-9", "expect_digest": "sha256:ab12"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    assert_eq!(
        aikit.asked(),
        ["procedure run procedure/adopt-9 --expect-digest sha256:ab12 --json"]
    );
    assert_eq!(receipts(&outcome)[0]["owner"], "ai-kit");
    assert_eq!(receipts(&outcome)[0]["ref"], "procedure/adopt-9");
    // A digest is required: an op without one is not an op at all.
    assert!(
        serde_json::from_value::<KernelOp>(json!({"op": "aikit_write",
        "request": {"kind": "procedure-run", "procedure": "procedure/adopt-9"}}))
        .is_err()
    );
    // AIKit's refusal of a drifted plan, in its words.
    aikit.refuse(
        Some(
            &json!({"ok": false, "schema": 1, "error": {"code": "procedure.digest_mismatch",
            "message": "the Procedure changed since it was reviewed", "details": {}}}),
        ),
        "",
        1,
    );
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_write", "request": {"kind": "procedure-run",
            "procedure": "procedure/adopt-9", "expect_digest": "sha256:old"}}),
        ),
    );
    assert!(outcome
        .unwrap_err()
        .contains("the Procedure changed since it was reviewed"));

    // QL's living-wiki refraction plan (QL-MEF#346; FAKE in its shape).
    fs::create_dir_all(dir.join("ql")).unwrap();
    let ql = Fake::new(&dir.join("ql"), "ql");
    let _ql = Bound::set("OI_QL_BIN", &ql.bin);
    let plan = json!({"profile": "ql-mef/living-wiki-refraction/v1", "mode": "explain",
        "positions": [0, 3], "steps": []});
    ql.answer(&plan);
    let request = json!({"mode": "explain", "relevance": {"relevant_positions": [0, 3],
        "requires_context": true, "full_context_frame": false, "position_budget": 2}});
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(json!({"op": "ql_read", "request": {"kind": "wiki-living-plan", "request": request}})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "ql wiki living-plan");
    assert_eq!(data, plan, "QL's plan, verbatim");
    assert_eq!(ql.asked(), ["wiki living-plan - --json"]);
    assert_eq!(serde_json::from_str::<Value>(&ql.stdin()).unwrap(), request);
    ql.answer(&json!({"profile": "ql-mef/other/v1"}));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "ql_read", "request": {"kind": "wiki-living-plan", "request": request}})),
    );
    assert!(outcome
        .unwrap_err()
        .contains("ql-mef/living-wiki-refraction/v1"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn aikit_lists_its_registered_sources() {
    let _held = hold();
    let dir = scratch("aikit-sources");
    let aikit = Fake::new(&dir, "aikit");
    let _bin = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    // ai-kit#542's own listing of this machine's home (REAL, trimmed), replayed.
    let real = fixture("aikit-source-list-2026-10-21.json");
    aikit.answer(&real["list"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(json!({"op": "aikit_read", "request": {"kind": "source-list"}})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty());
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "aikit source list");
    assert_eq!(data, real["list"]["data"], "AIKit's listing, verbatim");
    assert_eq!(aikit.asked(), ["source list --json"]);
    // An AIKit without the leaf: its own words (REAL).
    aikit.refuse(None, real["installed_refusal"].as_str().unwrap(), 2);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "aikit_read", "request": {"kind": "source-list"}})),
    );
    assert!(outcome
        .unwrap_err()
        .contains("unrecognized subcommand 'list'"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn routines_are_created_enabled_and_reproven_through_aikits_own_verbs() {
    let _held = hold();
    let dir = scratch("routine-authoring");
    let central = horizon_central(&dir);
    let suite = knowledge_suite(&dir);
    let _bin = Bound::set("OI_BIN", &suite);
    let proof = json!({"proof_ref": "proof/nightly-1", "method": "method/nightly",
        "method_revision": "r3", "verification_passed": true});
    let authority = json!({"authority_ref": "authority/desk", "revision": "1",
        "action_refs": ["action/run"], "granted": true, "unattended": false});
    let answer = |value: Value| {
        fs::write(
            dir.join("oi-answer.json"),
            serde_json::to_vec(&envelope(value)).unwrap(),
        )
        .unwrap();
        let _ = fs::remove_file(dir.join("oi-argv.txt"));
    };
    let argv = || fs::read_to_string(dir.join("oi-argv.txt")).unwrap_or_default();
    // Create (FAKE: AIKit's create answer, in AIKit's shape): Draft, nothing armed.
    answer(json!({"routine": "routine/nightly", "state": "draft",
        "note": "created in Draft; enable it with `aikit routine enable` and a fresh authority receipt"}));
    let (outcome, form) = dispatched(
        kernel(&central),
        op(
            json!({"op": "routine", "project": "O-I", "request": {"action": "create",
            "name": "nightly", "method": "method/nightly", "proof": proof, "trigger": {"kind": "manual"},
            "authority": authority, "description": "the nightly close",
            "agent_profile": "agent-profile:kite", "context_scopes": ["scope/o-i"]}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    let asked = argv();
    for part in [
        "routine create --name nightly --method method/nightly --proof-json ",
        "--trigger-json {\"kind\":\"manual\"} --authority-json ",
        "--description the nightly close --agent-profile agent-profile:kite --context-scope scope/o-i",
    ] {
        assert!(asked.contains(part), "{part} in {asked}");
    }
    let wire = serde_json::to_value(&outcome).unwrap();
    assert!(
        wire.to_string().contains("routine/nightly"),
        "the Routine AIKit answered for is carried: {wire}"
    );
    // Enable with a fresh authority receipt (FAKE), then reprove (FAKE).
    answer(json!({"routine": "routine/nightly", "state": "enabled",
        "note": "enabled and bound to the gateway dispatcher; it will fire when the gateway runs"}));
    let (outcome, _) = dispatched(
        kernel(&central),
        op(
            json!({"op": "routine", "project": "O-I", "request": {"action": "enable",
            "routine_ref": "routine/nightly", "authority": authority}}),
        ),
    );
    outcome.unwrap();
    assert!(
        argv().contains("routine enable --authority-json {"),
        "{}",
        argv()
    );
    assert!(
        argv().trim_end().ends_with("-- routine/nightly"),
        "{}",
        argv()
    );
    answer(
        json!({"routine": "routine/nightly", "state": "disabled", "method_revision": "r4",
        "note": "reproven; explicitly enable again — reproof never silently resumes automation"}),
    );
    let (outcome, _) = dispatched(
        kernel(&central),
        op(
            json!({"op": "routine", "project": "O-I", "request": {"action": "reprove",
            "routine_ref": "routine/nightly", "proof": proof}}),
        ),
    );
    outcome.unwrap();
    assert!(
        argv().contains("routine reprove --proof-json {"),
        "{}",
        argv()
    );
    // An answer that is not the asked state is no receipt: an enable AIKit
    // left in Draft, and a create answering another state.
    answer(json!({"routine": "routine/nightly", "state": "draft"}));
    let (outcome, _) = dispatched(
        kernel(&central),
        op(
            json!({"op": "routine", "project": "O-I", "request": {"action": "enable",
            "routine_ref": "routine/nightly", "authority": authority}}),
        ),
    );
    assert!(outcome
        .unwrap_err()
        .contains("did not return the requested Routine action receipt"));
    // AIKit's refusal in its words (FAKE in its envelope).
    fs::write(
        dir.join("oi-answer.json"),
        serde_json::to_vec(&json!({"ok": false, "schema": 1, "error": {"code": "routine.already_exists",
            "message": "a Routine named routine/nightly is already stored; rename this one or delete the existing Routine first",
            "details": {}}}))
        .unwrap(),
    )
    .unwrap();
    let (outcome, _) = dispatched(
        kernel(&central),
        op(
            json!({"op": "routine", "project": "O-I", "request": {"action": "create",
            "name": "nightly", "method": "method/nightly", "proof": proof, "trigger": {"kind": "manual"},
            "authority": authority}}),
        ),
    );
    assert!(outcome.unwrap_err().contains("already stored"));
    // Not a document: refused before AIKit is asked.
    let _ = fs::remove_file(dir.join("oi-argv.txt"));
    let (outcome, _) = dispatched(
        kernel(&central),
        op(
            json!({"op": "routine", "project": "O-I", "request": {"action": "reprove",
            "routine_ref": "routine/nightly", "proof": "proof/nightly-1"}}),
        ),
    );
    assert!(outcome.unwrap_err().contains("one JSON object"));
    assert!(!dir.join("oi-argv.txt").exists());
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn workcell_lists_its_machines_with_the_operations_a_machine_may_be_granted() {
    let _held = hold();
    let dir = scratch("workcell-machines");
    let workcell = Fake::new(&dir, "workcell");
    let _bin = Bound::set("OI_WORKCELL_BIN", &workcell.bin);
    // Workcell#118's own listing of this machine's declarations (REAL).
    let real = fixture("workcell-machine-list-2026-10-21.json");
    workcell.answer(&real["list"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(json!({"op": "workcell_read", "request": {"kind": "machine-list"}})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "workcell machine list");
    assert_eq!(data, real["list"], "Workcell's listing, verbatim");
    assert_eq!(data["control_operations"].as_array().unwrap().len(), 14);
    assert_eq!(workcell.asked(), ["machine list --json"]);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn workcell_lists_the_world_receipts_it_keeps_with_their_refs_and_subjects() {
    let _held = hold();
    let dir = scratch("workcell-worlds");
    let workcell = Fake::new(&dir, "workcell");
    let _bin = Bound::set("OI_WORKCELL_BIN", &workcell.bin);
    // Workcell#120's own listing over a scratch cell (REAL): one prepared
    // world and one torn receipt it could not decode.
    let real = fixture("workcell-worlds-2026-10-21.json");
    let request = json!({"op": "workcell_read", "request": {"kind": "worlds"}});
    workcell.answer(&real["answer"]);
    let (outcome, form) = dispatched(no_central(&dir), op(request.clone()));
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "workcell worlds");
    assert_eq!(data, real["answer"], "Workcell's listing, verbatim");
    assert_eq!(data["worlds"][0]["demand_ref"], "demand:dlw-capture");
    assert_eq!(
        data["worlds"][0]["subjects"]["run"],
        "opaque:factory-run-capture"
    );
    assert_eq!(data["unreadable"].as_array().unwrap().len(), 1);
    // Workcell#122's join, carried as it answered: the run-ledger slugs
    // whose record names the world (the slug `run-show` takes), not its
    // opaque subject.
    assert_eq!(data["worlds"][0]["runs"], json!(["dlw-capture"]));
    assert_eq!(data["run_ledger"], json!({"read": true, "runs": 1}));
    assert_eq!(receipts(&outcome), json!([]), "a read earns no receipt");
    assert_eq!(workcell.asked(), ["worlds --json"]);

    // An empty cell is a reading too: no worlds, nothing unreadable.
    workcell.answer(&real["empty"]);
    let (outcome, _) = dispatched(no_central(&dir), op(request.clone()));
    let (_, data, _) = reading(&outcome.unwrap());
    assert_eq!(data["worlds"], json!([]));

    // A Workcell without the listing refuses in its own words (REAL, the
    // installed binary before #120), exit 2.
    let refusal = &real["installed_refusal"];
    workcell.refuse(None, refusal["stderr"].as_str().unwrap(), 2);
    let (outcome, _) = dispatched(no_central(&dir), op(request.clone()));
    assert!(outcome
        .unwrap_err()
        .contains("unknown command `worlds`; run `workcell help`"));

    // A document in another schema is not the listing.
    let mut foreign = real["answer"].clone();
    foreign["schema"] = json!("workcell.world-receipts/v0");
    workcell.answer(&foreign);
    let (outcome, _) = dispatched(no_central(&dir), op(request));
    assert!(outcome.unwrap_err().contains("workcell.world-receipts/v1"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn workcell_shows_a_run_with_the_demand_it_was_started_with() {
    let _held = hold();
    let dir = scratch("workcell-run-show");
    let workcell = Fake::new(&dir, "workcell");
    let _bin = Bound::set("OI_WORKCELL_BIN", &workcell.bin);
    // Workcell#121's own answers over a scratch cell (REAL).
    let real = fixture("workcell-run-show-2026-10-21.json");
    let show =
        |run: &str| op(json!({"op": "workcell_read", "request": {"kind": "run-show", "run": run}}));

    // A run started since #121: its demand body, checked against its digest.
    workcell.answer(&real["kept"]);
    let (outcome, form) = dispatched(no_central(&dir), show("dlw-capture"));
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "workcell run show");
    assert_eq!(data, real["kept"], "Workcell's answer, verbatim");
    assert_eq!(data["demand"]["standing"], "kept");
    assert_eq!(data["demand"]["digest"], data["run"]["demand_digest"]);
    assert_eq!(data["demand"]["body"]["demand_ref"], "demand:dlw-capture");
    assert_eq!(receipts(&outcome), json!([]), "a read earns no receipt");
    assert_eq!(workcell.asked(), ["run show --run dlw-capture --json"]);

    // A run recorded before Workcell kept bodies: said so, no body made up.
    workcell.answer(&real["not_kept"]);
    let (outcome, _) = dispatched(no_central(&dir), show("legacy-capture"));
    let (_, data, _) = reading(&outcome.unwrap());
    assert_eq!(data["demand"]["standing"], "not-kept");
    assert!(data["demand"].get("body").is_none());

    // The kept body plans as Workcell's own `--demand-json PATH`.
    let path = real["kept"]["demand"]["path"].as_str().unwrap();
    let material = fixture("workcell-material-2026-10-21.json");
    workcell.answer(&material["plan"]);
    workcell.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "workcell_read", "request": {"kind": "plan", "demand": {"demand_json": path}}}),
        ),
    );
    outcome.unwrap();
    assert_eq!(
        workcell.asked(),
        [format!("plan --demand-json {path} --json")]
    );

    // An installed Workcell before #121 answers without the demand: not
    // this reading, refused by name.
    workcell.answer(&real["installed_show"]);
    let (outcome, _) = dispatched(no_central(&dir), show("legacy-capture"));
    assert!(outcome.unwrap_err().contains("run, demand"));

    // An unknown run is Workcell's refusal in its own words (REAL, exit 5).
    let refusal = &real["not_found"];
    workcell.refuse(None, refusal["stderr"].as_str().unwrap(), 5);
    let (outcome, _) = dispatched(no_central(&dir), show("nosuch"));
    assert!(outcome
        .unwrap_err()
        .contains("run `nosuch` is not in this ledger"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn factory_lists_the_custody_it_holds_before_an_assignment() {
    let _held = hold();
    let dir = scratch("custody-list");
    let factory = Fake::new(&dir, "factory");
    let central = fake_central(&dir);
    let _bin = Bound::set("OI_FACTORY_BIN", &factory.bin);
    let _ctrl = Bound::set("OI_CENTRAL_CTRL_BIN", &central);
    let state = dir.join("state.json");
    // Factory's own listing of a real project's state (REAL), replayed.
    let real = fixture("factory-custody-list-2026-10-21.json");
    factory.answer(&real["list"]);
    let (outcome, form) = dispatched(
        kernel(&central),
        op(
            json!({"op": "factory_owner", "request": {"kind": "custody-list", "state_path": state,
            "position_ref": "central:position:project:O-I:anima", "run_ref": "run:7",
            "state": "in-progress"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty(), "a listing records nothing");
    assert_eq!(
        factory.asked(),
        [format!("development custody list {} --position central:position:project:O-I:anima --run run:7 --state in-progress --json", state.display())]
    );
    let wire = serde_json::to_value(&outcome.result).unwrap();
    assert!(
        wire.to_string().contains("factory.work-custody-listing/v1"),
        "{wire}"
    );
    // An unknown state: Factory's refusal in its words (REAL).
    factory.refuse(Some(&real["refused"]), "", 2);
    let (outcome, _) = dispatched(
        kernel(&central),
        op(
            json!({"op": "factory_owner", "request": {"kind": "custody-list", "state_path": state,
            "state": "nonsense"}}),
        ),
    );
    let error = outcome.unwrap_err();
    assert!(error.contains("is not a custody state"), "{error}");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn a_returns_entry_carries_its_comment_count_where_central_gives_one() {
    let entry = |extra: Value| {
        let mut value = json!({"return_ref": "return:1", "source_ref": "central:source:x",
            "basis_revision": "r1", "status": "pending", "agent_session_ref": "session:1",
            "current_revision": "r1"});
        value
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        serde_json::from_value::<oi_cradle_kernel::flow::SourceReturnEntry>(value).unwrap()
    };
    assert_eq!(entry(json!({"comments": 2})).comments, Some(2));
    assert_eq!(
        entry(json!({})).comments,
        None,
        "an older Central gives none"
    );
}

#[test]
fn aikit_reads_the_last_turns_blocks_and_a_flows_kept_thoughts() {
    let _held = hold();
    let dir = scratch("turn-thoughts");
    let aikit = Fake::new(&dir, "aikit");
    let _bin = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    let real = fixture("aikit-turn-thoughts-2026-10-21.json");
    // Nothing kept yet on this machine (REAL), replayed.
    aikit.answer(&real["turn"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(json!({"op": "aikit_read", "request": {"kind": "continuity-turn"}})),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "aikit work continuity turn");
    assert_eq!(data, real["turn"]["data"]);
    assert!(data["turn"].is_null());
    assert_eq!(aikit.asked(), ["work continuity turn --json"]);
    // A kept turn (FAKE, in ai-kit#543's shape), for one session.
    let kept = json!({"scope": "session-1", "turn": {"version": "aikit.turn-bound/v1", "scope": "session-1",
        "events": {"UserPromptSubmit": {"recorded_at_unix_ms": 1, "blocks": [], "withheld_lines": 4,
            "withheld_blocks": 1}}},
        "blocks": [{"event": "UserPromptSubmit", "title": "domain/alpha", "standing": 1, "kept": 0,
            "withheld": 4, "suppressed": false}],
        "withheld_lines": 4, "withheld_blocks": 1, "notices": []});
    aikit.answer(&envelope(kept.clone()));
    aikit.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_read", "request": {"kind": "continuity-turn", "session": "session-1"}}),
        ),
    );
    assert_eq!(reading(&outcome.unwrap()).1, kept);
    assert_eq!(
        aikit.asked(),
        ["work continuity turn --session session-1 --json"]
    );
    // A Flow's kept thoughts (REAL: none yet), and AIKit without the leaf (REAL).
    aikit.answer(&real["thoughts"]);
    aikit.forget();
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_read", "request": {"kind": "flow-thoughts",
            "flow_ref": "wiki:node:staged/test-flow", "limit": 5}}),
        ),
    );
    let (route, data, _) = reading(&outcome.unwrap());
    assert_eq!(route, "aikit flow thoughts");
    assert_eq!(data, real["thoughts"]["data"]);
    assert_eq!(
        aikit.asked(),
        ["flow thoughts wiki:node:staged/test-flow --limit 5 --json"]
    );
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "aikit_read", "request": {"kind": "flow-thoughts",
            "flow_ref": "wiki:node:other"}}),
        ),
    );
    assert!(outcome
        .unwrap_err()
        .contains("aikit.flow-thoughts/v1 for wiki:node:other"));
    for key in ["turn_installed_refusal", "thoughts_installed_refusal"] {
        aikit.refuse(None, real[key].as_str().unwrap(), 2);
        let request = if key.starts_with("turn") {
            json!({"kind": "continuity-turn"})
        } else {
            json!({"kind": "flow-thoughts", "flow_ref": "wiki:node:staged/test-flow"})
        };
        let (outcome, _) = dispatched(
            no_central(&dir),
            op(json!({"op": "aikit_read", "request": request})),
        );
        assert!(
            outcome.unwrap_err().contains("unrecognized subcommand"),
            "{key}"
        );
    }
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn workcell_places_a_demand_across_this_cell_and_its_connections() {
    let _held = hold();
    let dir = scratch("workcell-placement");
    let workcell = Fake::new(&dir, "workcell");
    let _bin = Bound::set("OI_WORKCELL_BIN", &workcell.bin);
    // Workcell#119's own evaluation over two loopback cells (REAL), replayed.
    let real = fixture("workcell-placement-2026-10-21.json");
    workcell.answer(&real["placement"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "workcell_read", "request": {"kind": "placement",
            "demand": {"demand_ref": "demand:placement", "require": ["shell"]},
            "connections": ["laptop"], "max_locality_cost": 1, "prefer_locality": true,
            "previous": "workcell:laptop"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    assert!(outcome.receipts.is_empty(), "nothing is prepared");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "workcell placement");
    assert_eq!(data, real["placement"], "Workcell's evaluation, verbatim");
    assert_eq!(
        workcell.asked(),
        ["placement --demand-ref demand:placement --require shell --connection laptop --max-locality-cost 1 --prefer-locality --previous workcell:laptop --json"]
    );
    // Without the credential the remote is a diagnostic, not a guess (REAL).
    workcell.answer(&real["unauthorised"]);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "workcell_read", "request": {"kind": "placement"}})),
    );
    let (_, data, _) = reading(&outcome.unwrap());
    assert!(!data["diagnostics"].as_array().unwrap().is_empty());
    // A Workcell without the command: its words (REAL).
    workcell.refuse(Some(&real["installed_refusal"]), "", 2);
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(json!({"op": "workcell_read", "request": {"kind": "placement"}})),
    );
    assert!(outcome.unwrap_err().contains("unknown command `placement`"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn ql_refracts_a_wiki_target_through_the_lenses_named() {
    let _held = hold();
    let dir = scratch("ql-wiki-refract");
    let ql = Fake::new(&dir, "ql");
    let _bin = Bound::set("OI_QL_BIN", &ql.bin);
    // QL main's own refraction of its own fixture request (REAL), replayed.
    let real = fixture("ql-wiki-refract-2026-10-21.json");
    ql.answer(&real["response"]);
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "ql_read", "request": {"kind": "wiki-refract", "request": real["request"]}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "ql wiki refract");
    assert_eq!(data, real["response"], "QL's refraction, verbatim");
    assert_eq!(ql.asked(), ["wiki refract - --json"]);
    assert_eq!(
        serde_json::from_str::<Value>(&ql.stdin()).unwrap(),
        real["request"]
    );
    // QL's refusals, in its words (REAL), and another document refused.
    for key in ["refused_foreign_contract", "installed_refusal"] {
        ql.refuse(None, real[key].as_str().unwrap(), 2);
        let (outcome, _) = dispatched(
            no_central(&dir),
            op(
                json!({"op": "ql_read", "request": {"kind": "wiki-refract", "request": real["request"]}}),
            ),
        );
        let error = outcome.unwrap_err();
        let words = real[key].as_str().unwrap().trim();
        assert!(
            error.contains(words.strip_prefix("ql: ").unwrap_or(words)),
            "{key}: {error}"
        );
    }
    ql.answer(&json!({"contract": "ql-mef/living-wiki-refraction/v1"}));
    let (outcome, _) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "ql_read", "request": {"kind": "wiki-refract", "request": real["request"]}}),
        ),
    );
    assert!(outcome.unwrap_err().contains("ql-mef/wiki-refraction/v1"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn workcell_reads_a_named_sandbox_server_and_releases_its_orphans_without_its_key() {
    let _held = hold();
    let dir = scratch("workcell-sandboxes");
    let workcell = Fake::new(&dir, "workcell");
    let _bin = Bound::set("OI_WORKCELL_BIN", &workcell.bin);
    // The kernel's own environment holds a key; the desk names the server, so
    // the key must never reach the child.
    let _key = Bound::set("OPEN_SANDBOX_API_KEY", "test-only-marker-not-a-secret");
    // Workcell's own reading of a fixture lifecycle server (REAL, read only).
    let real = fixture("workcell-sandboxes-2026-10-22.json");
    let server = "http://127.0.0.1:18931";
    let read = |server: &str| {
        op(json!({"op": "workcell_read", "request": {"kind": "sandboxes", "server": server}}))
    };

    workcell.answer(&real["read"]);
    let (outcome, form) = dispatched(no_central(&dir), read(server));
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-read");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "workcell sandboxes reconcile");
    assert_eq!(data, real["read"], "Workcell's report, verbatim");
    let leases: Vec<&str> = data["sandboxes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|row| row["lease"].as_str().unwrap())
        .collect();
    assert_eq!(leases, ["live", "expired-orphan", "unknown"]);
    assert_eq!(receipts(&outcome), json!([]), "a read earns no receipt");
    assert_eq!(
        workcell.asked(),
        [format!("sandboxes reconcile --server {server} --json")],
        "only the server travels: no --api-key-env, --release or --include-snapshots"
    );
    assert!(
        workcell.env().contains("sandbox_key=\n"),
        "the key is withheld from a server the desk names: {}",
        workcell.env()
    );

    // No server named: refused before Workcell is asked.
    workcell.forget();
    let (outcome, _) = dispatched(no_central(&dir), read("  "));
    assert_eq!(kind(&outcome.unwrap_err()), "incompatible");
    assert!(workcell.asked().is_empty());

    // An unreachable server: Workcell's refusal, its message out of its
    // stderr document (REAL, exit 4).
    let refused = &real["unreachable"];
    workcell.refuse(None, refused["stderr"].as_str().unwrap(), 4);
    let (outcome, _) = dispatched(no_central(&dir), read("http://127.0.0.1:9"));
    let error = outcome.unwrap_err();
    assert_eq!(kind(&error), "owner-refused-or-failed");
    assert!(
        error.contains("connect OpenSandbox HTTP endpoint 127.0.0.1:9: Connection refused")
            && !error.contains(r#"\"ok\":false"#),
        "{error}"
    );

    // Release orphans: a write; the receipt names the server when Workcell
    // released something (the report's shape, FAKE: no server was released).
    let mut released = real["read"].clone();
    released["release_orphans"] = json!(true);
    released["released_sandboxes"] = json!(["sbx-orphan"]);
    workcell.answer(&released);
    workcell.forget();
    let release = op(
        json!({"op": "workcell_write", "request": {"kind": "release-orphans", "server": server}}),
    );
    let (outcome, form) = dispatched(no_central(&dir), release.clone());
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "workcell sandboxes reconcile --release-orphans");
    assert_eq!(data["released_sandboxes"], json!(["sbx-orphan"]));
    assert_eq!(
        workcell.asked(),
        [format!(
            "sandboxes reconcile --server {server} --release-orphans --json"
        )]
    );
    assert!(workcell.env().contains("sandbox_key=\n"));
    let receipt_wire = receipts(&outcome);
    assert_eq!(receipt_wire[0]["event"], "owner_changed");
    assert_eq!(receipt_wire[0]["owner"], "workcell");
    assert_eq!(receipt_wire[0]["ref"], server);

    // Nothing released: no receipt.
    workcell.answer(&real["read"]);
    let (outcome, _) = dispatched(no_central(&dir), release);
    assert!(outcome.unwrap().receipts.is_empty());
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn aikit_issues_a_hook_bypass_and_names_the_id_it_lists() {
    let _held = hold();
    let dir = scratch("aikit-bypass-issue");
    let aikit = Fake::new(&dir, "aikit");
    let _bin = Bound::set("OI_AIKIT_BIN", &aikit.bin);
    // The installed AIKit's own answers in an isolated home (REAL).
    let real = fixture("aikit-bypass-issue-2026-10-22.json");
    let issue = |scope: &str| {
        op(
            json!({"op": "aikit_write", "request": {"kind": "bypass-issue", "scope": scope,
            "reason": "fixture capture"}}),
        )
    };

    aikit.answer(&real["issued"]);
    let (outcome, form) = dispatched(no_central(&dir), issue("next-event"));
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write");
    let (route, data, _) = reading(&outcome);
    assert_eq!(route, "aikit bypass issue");
    assert_eq!(data, real["issued"]["data"], "AIKit's record, verbatim");
    assert_eq!(
        aikit.asked(),
        ["bypass issue --scope next-event --reason fixture capture --json"]
    );
    let receipt_wire = receipts(&outcome);
    assert_eq!(receipt_wire[0]["owner"], "ai-kit");
    assert_eq!(receipt_wire[0]["action"], "aikit bypass issue");
    assert_eq!(receipt_wire[0]["ref"], real["issued"]["data"]["bypass_id"]);

    // A scope AIKit does not take, and no reason: its refusals, its words.
    aikit.refuse(Some(&real["scope_refused"]), "", 2);
    let (outcome, _) = dispatched(no_central(&dir), issue("1h"));
    assert!(outcome
        .unwrap_err()
        .contains("`1h` is not a bypass scope; use `next-event` or `session`"));
    aikit.refuse(Some(&real["reason_refused"]), "", 2);
    let (outcome, _) = dispatched(no_central(&dir), issue("session"));
    assert!(outcome
        .unwrap_err()
        .contains("a bypass must carry a reason; pass --reason"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn a_units_retry_is_a_factory_write_refused_while_factory_admits_no_desktop_retry() {
    let _held = hold();
    let dir = scratch("factory-retry");
    let factory = Fake::new(&dir, "factory");
    let _bin = Bound::set("OI_FACTORY_BIN", &factory.bin);
    // The installed Factory's admission reading (REAL, `factory attempt
    // admission --json`, 22 Oct 2026): it admits attempt-receiving only.
    factory.answer(&json!({
        "contract": "factory.attempt-admission/v1", "nativeOwner": "factory",
        "capabilityRef": "capability/factory/operate-attempt",
        "desktopCaller": {"callerRef": "oi:desktop", "lineage": ["oi:desktop"], "projectionKind": "desktop-human"},
        "actions": [{"actionRef": "attempt-receiving", "actorKind": "human",
            "command": "factory attempt receiving <state> <request-json|->",
            "contract": "factory.attempt-receiving-action/v1", "nativeAction": "central.receiving.submit",
            "scopeRef": "project:Factory"}],
        "standing": "A reading of what Factory expects of a desktop caller. It grants nothing: the grant is the owner's, in the contract named here."
    }));
    let (outcome, form) = dispatched(
        no_central(&dir),
        op(
            json!({"op": "factory_owner", "request": {"kind": "attempt-retry",
            "state_path": dir.join("state").display().to_string(), "run_ref": "run:one",
            "workflow_unit_ref": "unit:inspect-source"}}),
        ),
    );
    let outcome = outcome.unwrap();
    assert_eq!(form, "owner-write", "a retry is the person's write");
    let KernelOpResult::FactoryDevelopmentReading { data } = &outcome.result else {
        panic!("not Factory's document: {:?}", outcome.result)
    };
    assert_eq!(data["contract"], "oi.factory-attempt-retry/v1");
    assert_eq!(data["status"], "refused");
    assert_eq!(data["refusal"]["step"], "admission");
    assert!(
        data["refusal"]["message"]
            .as_str()
            .unwrap()
            .contains("names no attempt-retry action, only attempt-receiving"),
        "{data}"
    );
    assert_eq!(
        factory.asked(),
        ["attempt admission --json"],
        "nothing is read or acted on past the admission"
    );
    assert!(outcome.receipts.is_empty(), "a refusal moves nothing");
    let _ = fs::remove_dir_all(&dir);
}
