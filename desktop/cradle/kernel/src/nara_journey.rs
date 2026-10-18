//! A journey (manual §24.4, §22.4; T-WORLDS §6, W4): a concern carried over days or months, read with one tarot deck for its
//! whole life and the I Ching for how it changes. QL computes it — `nara.journey.open|apply|read` of the Epi-Logos agent's Nara
//! faculty (QL crates/ql-mef/src/nara/domain/oracle_journey.rs, `ql.nara-oracle-journey/v1`, reached through
//! `ql epi-agent invoke`) — and Central keeps it: a journey is a Flow page, and the state QL returns is saved into that page's
//! `meta.journey` through the page owner op's CAS (page.rs, its `journey` field), on the revision the page was read at. QL's
//! words: "Central must persist the returned state with a revision check."
//!
//! Chance is the kernel's, never the renderer's: the one shuffle at opening and each cast of the I Ching consume fresh OS
//! entropy minted here (`getrandom`). The bytes go to QL on its stdin and are never kept; the journey keeps a receipt naming
//! the method and provider and a SHA-256 commitment to them. Every act that rests on chance — the opening shuffle, a draw, a
//! cast — needs the person's consent to chance, each time. A journey is opened once: a page that holds one refuses a second
//! opening, so reopening never deals again; an act replayed under its request id reconciles to its first effect (QL) and
//! writes nothing.
use crate::files::{self, Location};
use crate::flow::CentralClient;
use crate::page;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::Path;

pub const JOURNEY_SCHEMA: &str = "ql.nara-oracle-journey/v1";
const RESULT_SCHEMA: &str = "ql.nara-journey-result/v1";
const READING_SCHEMA: &str = "ql.nara-oracle-journey-reading/v1";
/// Fresh bytes the one shuffle consumes. QL asks at least 512 (its operation inputs); the 78-card shuffle and its turned
/// portion take far fewer, and QL's cursor refuses rather than repeats when it runs out.
const SHUFFLE_BYTES: usize = 1024;
/// Fresh bytes one cast of the I Ching consumes (QL: at least 18 for coins; yarrow takes more).
const CAST_BYTES: usize = 512;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    /// Open a journey on a Flow page: its concern, its one deck (QL's `DeckDefinition`), the Day it opens on and who opens it.
    /// The deck is shuffled once, by chance, with the person's consent.
    Open {
        location: Location,
        expected_revision: String,
        subject_ref: String,
        concern: Value,
        deck: Value,
        day_ref: String,
        actor_ref: String,
        #[serde(default)]
        consent_to_chance: bool,
    },
    /// One attributed act on the open journey: QL's `JourneyAct` (a draw, an assignment, a link to an entry, a reading, a cast
    /// of the I Ching, a close …). A draw and a cast need the person's consent to chance.
    Apply {
        location: Location,
        expected_revision: String,
        act: Value,
        #[serde(default)]
        consent_to_chance: bool,
    },
    /// The journey as it reads now, or a period review (a window of unix milliseconds).
    Read {
        location: Location,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        window_unix_ms: Option<[u64; 2]>,
    },
}

impl Request {
    /// Opening and acting save the journey into its page; reading writes nothing.
    pub fn is_write(&self) -> bool {
        !matches!(self, Request::Read { .. })
    }
    pub fn location(&self) -> &Location {
        match self {
            Request::Open { location, .. }
            | Request::Apply { location, .. }
            | Request::Read { location, .. } => location,
        }
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Fresh OS entropy for one act of chance: the bytes, hex-encoded for QL's stdin and never kept, and the receipt the journey
/// keeps (QL's `OracleEntropyReceipt`): the method, the provider, when, and a commitment to the bytes.
pub(crate) fn chance(
    bytes: usize,
    purpose: &str,
    at_unix_ms: u64,
) -> Result<(String, Value), String> {
    let mut raw = vec![0u8; bytes];
    getrandom::fill(&mut raw)
        .map_err(|error| format!("The system gave no entropy for the {purpose}: {error}"))?;
    let commitment = hex(&Sha256::digest(&raw));
    let receipt = json!({
        "entropy_ref": {"ref_id": format!("protected:oi-kernel-entropy:{purpose}:{}", &commitment[..16]),
            "revision": format!("sha256:{commitment}"), "owner_ref": "oi-kernel"},
        "method_ref": "os-entropy",
        "provider_ref": "provider:getrandom",
        "observed_at_unix_ms": at_unix_ms,
        "evidence_refs": [format!("evidence:oi-kernel-getrandom:{bytes}-bytes")],
    });
    Ok((hex(&raw), receipt))
}

/// The Flow page a journey is kept in, as its file owner holds it now.
struct Held {
    revision: String,
    island: Value,
}

fn held(client: &CentralClient, location: &Location) -> Result<Held, String> {
    let reading = files::read(client, location)?;
    let island = page::read_island(&reading.content)?;
    if page::form_of(&island) != "flow" {
        return Err("A journey is kept in a Flow page: this page is no Flow".into());
    }
    Ok(Held {
        revision: reading.revision,
        island,
    })
}

fn moved(holds: &str) -> String {
    format!("The journey's page moved since it was read (the owner holds {holds}): nothing was dealt or written. Read it again and act on that revision.")
}

/// QL's answer, admitted only when it carries this journey, for this person, with its reading.
fn admitted<'a>(result: &'a Value, journey_ref: &str, subject: &str) -> Result<&'a Value, String> {
    let journey = &result["journey"];
    if result["schema"] != RESULT_SCHEMA
        || journey["schema"] != JOURNEY_SCHEMA
        || journey["journey_ref"] != journey_ref
        || journey["subject_id"] != subject
        || result["reading"]["schema"] != READING_SCHEMA
    {
        return Err("QL returned another journey, or no reading of it".into());
    }
    Ok(journey)
}

fn answer(operation: &str, result: &Value, saved: &Value) -> Value {
    json!({"schema": "oi.nara-journey/v1", "operation": operation, "reading": result["reading"],
        "effect": result.get("effect").cloned().unwrap_or(Value::Null), "standing": result["standing"],
        "page": {"location": saved["location"], "before_revision": saved["before_revision"], "revision": saved["revision"],
            "outcome": saved["outcome"]},
        "receipt": saved["receipt"]})
}

/// Open the journey: refused without consent to chance, on a page that moved, or on a page that already holds its journey.
#[allow(clippy::too_many_arguments)]
fn open(
    client: &CentralClient,
    owner: Option<&Path>,
    location: &Location,
    expected_revision: &str,
    subject_ref: &str,
    concern: &Value,
    deck: &Value,
    day_ref: &str,
    actor_ref: &str,
    consent: bool,
) -> Result<Value, String> {
    if !consent {
        return Err(
            "Opening a journey shuffles its one deck by chance: it needs your consent to chance."
                .into(),
        );
    }
    let page = held(client, location)?;
    if page.revision != expected_revision {
        return Err(moved(&page.revision));
    }
    if !page.island["meta"]["journey"].is_null() {
        return Err("This page already holds its journey. A journey has one deck: reopening it never deals again.".into());
    }
    let document = page.island["meta"]["documentId"]
        .as_str()
        .filter(|id| !id.trim().is_empty())
        .ok_or("The Flow has no document identity to name its journey by")?;
    let journey_ref = format!("journey:{document}");
    let at = now_ms();
    let (bytes, receipt) = chance(SHUFFLE_BYTES, "shuffle", at)?;
    let input = json!({"open": {"journey_ref": journey_ref, "subject_id": subject_ref, "concern": concern, "deck": deck,
            "day_ref": day_ref, "actor_ref": actor_ref, "entropy": receipt, "consent": "granted", "opened_at_unix_ms": at},
        "entropy": {"hex": bytes}});
    let result = crate::nara_identity::run_ql_epi_agent(owner, "nara.journey.open", &input)?;
    let journey = admitted(&result, &journey_ref, subject_ref)?;
    let saved = page::mutate_field(client, location, expected_revision, "journey", journey)?;
    Ok(answer("open", &result, &saved))
}

/// One act: a draw or a cast only with consent to chance (a cast's entropy minted here), QL's state after it saved into the
/// page on the revision read, or nothing written when QL reconciled a replay.
fn apply(
    client: &CentralClient,
    owner: Option<&Path>,
    location: &Location,
    expected_revision: &str,
    act: &Value,
    consent: bool,
) -> Result<Value, String> {
    let page = held(client, location)?;
    if page.revision != expected_revision {
        return Err(moved(&page.revision));
    }
    let journey = &page.island["meta"]["journey"];
    if !journey.is_object() {
        return Err("This page holds no journey yet: open it first, with its deck.".into());
    }
    let mut act = act.clone();
    let mut entropy = Value::Null;
    match act["request"]["op"].as_str().unwrap_or_default() {
        "draw" if !consent => {
            return Err(
                "A draw deals from the deck by chance: it needs your consent to chance, each time."
                    .into(),
            )
        }
        "cast-iching" => {
            if !consent {
                return Err(
                    "A cast of the I Ching is chance: it needs your consent to chance, each time."
                        .into(),
                );
            }
            if !act["request"]["cast"].is_object() {
                return Err("A cast of the I Ching names how it is cast".into());
            }
            let (bytes, receipt) = chance(CAST_BYTES, "cast", now_ms())?;
            act["request"]["cast"]["entropy"] = receipt;
            act["request"]["cast"]["consent"] = json!("granted");
            entropy = json!({"hex": bytes});
        }
        _ => {}
    }
    let journey_ref = journey["journey_ref"].as_str().unwrap_or_default();
    let subject = journey["subject_id"].as_str().unwrap_or_default();
    let result = crate::nara_identity::run_ql_epi_agent(
        owner,
        "nara.journey.apply",
        &json!({"journey": journey, "act": act, "entropy": entropy}),
    )?;
    let next = admitted(&result, journey_ref, subject)?;
    if result["effect"]["replayed"] == true || next == journey {
        return Ok(
            json!({"schema": "oi.nara-journey/v1", "operation": "apply", "reading": result["reading"],
            "effect": result["effect"], "standing": result["standing"],
            "page": {"location": location, "before_revision": page.revision, "revision": page.revision, "outcome": "unchanged"},
            "receipt": Value::Null}),
        );
    }
    let saved = page::mutate_field(client, location, expected_revision, "journey", next)?;
    Ok(answer("apply", &result, &saved))
}

fn read(
    client: &CentralClient,
    owner: Option<&Path>,
    location: &Location,
    window: Option<[u64; 2]>,
) -> Result<Value, String> {
    let page = held(client, location)?;
    let journey = &page.island["meta"]["journey"];
    if !journey.is_object() {
        return Err("This page holds no journey yet: open it first, with its deck.".into());
    }
    let reading = crate::nara_identity::run_ql_epi_agent(
        owner,
        "nara.journey.read",
        &json!({"journey": journey, "window_unix_ms": window}),
    )?;
    if reading["schema"] != READING_SCHEMA || reading["journey_ref"] != journey["journey_ref"] {
        return Err("QL read another journey, or answered no reading".into());
    }
    Ok(
        json!({"schema": "oi.nara-journey/v1", "operation": "read", "reading": reading,
        "page": {"location": location, "revision": page.revision}}),
    )
}

/// The op, on the installed QL.
pub fn execute(client: &CentralClient, request: &Request) -> Result<Value, String> {
    execute_with(client, None, request)
}

/// The op, on a selected QL executable (`None`: the installed suite).
pub(crate) fn execute_with(
    client: &CentralClient,
    owner: Option<&Path>,
    request: &Request,
) -> Result<Value, String> {
    match request {
        Request::Open {
            location,
            expected_revision,
            subject_ref,
            concern,
            deck,
            day_ref,
            actor_ref,
            consent_to_chance,
        } => open(
            client,
            owner,
            location,
            expected_revision,
            subject_ref,
            concern,
            deck,
            day_ref,
            actor_ref,
            *consent_to_chance,
        ),
        Request::Apply {
            location,
            expected_revision,
            act,
            consent_to_chance,
        } => apply(
            client,
            owner,
            location,
            expected_revision,
            act,
            *consent_to_chance,
        ),
        Request::Read {
            location,
            window_unix_ms,
        } => read(client, owner, location, *window_unix_ms),
    }
}

/// A stand-in for Central's file owner and for QL's Epi-Logos agent, in one python script: Central's `central.files.read`
/// and `central.files.write` with the owner's CAS over real files, and `epi-agent invoke` answering the journey operations
/// as QL's contract shapes them (and recording what it was asked, so a test can see the entropy QL received).
#[cfg(all(test, unix))]
pub(crate) mod stub {
    pub(crate) const SCRIPT: &str = r#"#!/usr/bin/env python3
import json, sys, os, hashlib
home = os.environ["NARA_STUB_HOME"]
def log(line):
    with open(os.path.join(home, "log"), "a") as f: f.write(line + "\n")
def rev(text): return "r-" + hashlib.sha256(text.encode()).hexdigest()[:12]
def loc(path): return {"schema": "central.path-ref/v1", "ref": "ref:" + path, "root": "R", "path": path}
def file_of(path): return os.path.join(home, path.replace("/", "_"))
if sys.argv[1] in ("epi-agent", "nara"):
    request = json.loads(sys.stdin.read())
    if sys.argv[1] == "nara":
        log("ql nara " + sys.argv[2])
        profile = request
        print(json.dumps(json.load(open(os.path.join(home, "identity-reading.json"))) | {"profile": profile, "person_ref": profile["person_ref"]}))
        sys.exit(0)
    op = request["operation"]; given = request["input"]
    log("ql " + op)
    json.dump(given, open(os.path.join(home, "asked-" + op + ".json"), "w"))
    if os.path.exists(os.path.join(home, "refuse")):
        sys.stderr.write("ql: " + open(os.path.join(home, "refuse")).read()); sys.exit(2)
    def journey_of(j, revision): return {"schema": "ql.nara-oracle-journey/v1", "journey_ref": j["journey_ref"], "subject_id": j["subject_id"], "revision": revision, "operations": j.get("operations", [])}
    def reading_of(j): return {"schema": "ql.nara-oracle-journey-reading/v1", "journey_ref": j["journey_ref"], "journey_revision": j["revision"], "spreads": []}
    if op == "nara.journey.open":
        j = journey_of(given["open"], 1)
        result = {"schema": "ql.nara-journey-result/v1", "journey": j, "reading": reading_of(j), "standing": "QL computes"}
    elif op == "nara.journey.apply":
        before = given["journey"]; act = given["act"]
        replay = any(o == act["request_id"] for o in before.get("operations", []))
        j = before if replay else journey_of(before, before["revision"] + 1) | {"operations": before.get("operations", []) + [act["request_id"]]}
        result = {"schema": "ql.nara-journey-result/v1", "journey": j, "reading": reading_of(j), "standing": "QL computes",
            "effect": {"request_id": act["request_id"], "op": act["request"]["op"], "replayed": replay, "effect_refs": [], "journey_revision": j["revision"]}}
    elif op == "nara.journey.read":
        result = reading_of(given["journey"])
    elif op == "nara.lived-context.compose":
        keys = []
        for e in given["entries"]:
            address = "".join("/" + p for p in (e["document_id"], e["entry_id"], e["contribution_id"]) if p)
            keys.append(e["source_ref"] + address + "@" + e["revision"])
        result = {"schema": "ql.nara-lived-context/v1", "context_revision": "sha256:stub", "subject_ref": given["subject_ref"],
            "concern": given["concern"], "occasion": None, "passages": [{"key": k} for k in keys], "journey": None, "disclosed": [],
            "attribution": {"human": 0, "agent": 0, "operational": 0}, "candidates": len(keys) + len(given["documents"]), "omitted": [],
            "composed_at_unix_ms": given["composed_at_unix_ms"]}
    elif op == "nara.elemental-map":
        result = {"schema": "ql.nara-elemental-reading/v1", "source": given["source"], "consent": given["consent"],
            "contributions": {k: given.get(k) for k in ("fire", "water", "earth", "air")}, "unknown_elements": []}
    print(json.dumps({"schema": "ql.epi-logos-agent-invocation-result/v1", "position": request["position"], "operation": op,
        "result": result, "canonical_mutation": False}))
    sys.exit(0)
action = sys.argv[4]
payload = json.loads(sys.argv[5]) if len(sys.argv) > 5 else {}
log(action)
def ok(data): print(json.dumps({"ok": True, "data": data}))
if action == "central.files.read":
    path = payload["location"]["path"]; text = open(file_of(path)).read()
    ok({"schema": "central.file-reading/v1", "location": loc(path), "revision": rev(text), "byte_len": len(text), "content_encoding": "utf-8",
        "content": text, "project": None, "source": None, "automatic_agent_or_model_invocation": False})
elif action == "central.files.write":
    path = payload["location"]["path"]; text = open(file_of(path)).read()
    if payload["expected_revision"] != rev(text):
        ok({"schema": "central.file-mutation/v1", "outcome": "conflict", "location": payload["location"]}); sys.exit(0)
    open(file_of(path), "w").write(payload["content"])
    ok({"schema": "central.file-mutation/v1", "outcome": "written", "revision": rev(payload["content"]), "location": payload["location"]})
elif action == "central.day.read":
    ok(json.load(open(os.path.join(home, "day.json"))))
elif action == "central.time.policy":
    ok({"civil_date": "2026-10-18"})
elif action == "projectcentral.source.read":
    source_ref = payload["source_ref"]; path = source_ref.split(":", 4)[4]; text = open(file_of(path)).read()
    ok({"schema": "central.project-world-source-reading/v1", "world_ref": "control:root",
        "source": {"ref": source_ref, "path": path, "roles": [], "provenance": "human-authored", "standing": "authored-human-position",
            "treatment": "source", "agent_retrieval_allowed": True},
        "revision": {"revision": "s-" + rev(text), "byte_len": len(text)}, "content": text, "content_encoding": "utf-8",
        "automatic_agent_or_model_invocation": False})
else:
    print(json.dumps({"ok": False, "error": {"message": "the stand-in has no " + action}}))
"#;

    pub(crate) struct Stub {
        pub(crate) home: std::path::PathBuf,
        pub(crate) owner: std::path::PathBuf,
        pub(crate) client: crate::flow::CentralClient,
    }

    impl Stub {
        pub(crate) fn new(test: &str) -> Self {
            use std::os::unix::fs::PermissionsExt;
            let home = std::env::temp_dir().join(format!("oi-nara-{}-{test}", std::process::id()));
            let _ = std::fs::remove_dir_all(&home);
            std::fs::create_dir_all(&home).unwrap();
            let script = home.join("owner.py");
            let wrapper = home.join("owner.sh");
            std::fs::write(&script, SCRIPT).unwrap();
            std::fs::write(
                &wrapper,
                format!(
                    "#!/bin/sh\nNARA_STUB_HOME={} exec python3 {} \"$@\"\n",
                    home.display(),
                    script.display()
                ),
            )
            .unwrap();
            std::fs::set_permissions(&wrapper, std::fs::Permissions::from_mode(0o755)).unwrap();
            crate::test_stub::settle_stub(&wrapper);
            let client = crate::flow::CentralClient::with(wrapper.clone(), None, "test".into());
            Stub {
                home,
                owner: wrapper,
                client,
            }
        }
        pub(crate) fn put(&self, path: &str, text: &str) -> crate::files::Location {
            std::fs::write(self.home.join(path.replace('/', "_")), text).unwrap();
            crate::files::Location {
                schema: "central.path-ref/v1".into(),
                ref_id: format!("ref:{path}"),
                root: "R".into(),
                path: path.into(),
            }
        }
        pub(crate) fn island(&self, path: &str) -> serde_json::Value {
            crate::page::read_island(
                &std::fs::read_to_string(self.home.join(path.replace('/', "_"))).unwrap(),
            )
            .unwrap()
        }
        pub(crate) fn asked(&self, operation: &str) -> serde_json::Value {
            serde_json::from_str(
                &std::fs::read_to_string(self.home.join(format!("asked-{operation}.json")))
                    .unwrap(),
            )
            .unwrap()
        }
        pub(crate) fn log(&self) -> String {
            std::fs::read_to_string(self.home.join("log")).unwrap_or_default()
        }
        pub(crate) fn revision(&self, location: &crate::files::Location) -> String {
            crate::files::read(&self.client, location).unwrap().revision
        }
    }

    /// A Flow page: the island as `ql-flow.html` carries it, inside a page.
    pub(crate) fn flow_page(island: serde_json::Value) -> String {
        format!(
            r#"<!doctype html><title>f</title><script type="application/json" id="ql-doc">{}</script><p>body</p>"#,
            serde_json::to_string(&island).unwrap()
        )
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::stub::{flow_page, Stub};
    use super::*;

    const PAGE: &str = "Control/user/flows/journey.html";

    fn flow() -> Value {
        json!({"meta": {"documentId": "doc-1", "title": "What the move asks", "revision": 2, "view": "flow"}, "entries": [], "notes": []})
    }
    fn opening(at: &Location, revision: &str, consent: bool) -> Request {
        Request::Open {
            location: at.clone(),
            expected_revision: revision.into(),
            subject_ref: "person:frank".into(),
            concern: json!({"concern_ref": "concern:move", "title": "What the move asks", "basis_sources": []}),
            deck: json!({"deck_ref": "deck:thoth", "system": "tarot-thoth", "register": "thoth", "extra_cards": [], "source_refs": []}),
            day_ref: "central:day:control:root:2026-10-18".into(),
            actor_ref: "person:frank".into(),
            consent_to_chance: consent,
        }
    }

    #[test]
    fn opening_shuffles_once_by_the_kernel_s_chance_and_saves_the_journey_into_its_page() {
        let stub = Stub::new("journey-open");
        let at = stub.put(PAGE, &flow_page(flow()));
        let revision = stub.revision(&at);
        let refused = execute_with(
            &stub.client,
            Some(&stub.owner),
            &opening(&at, &revision, false),
        );
        assert!(refused.unwrap_err().contains("consent to chance"));
        assert!(
            !stub.log().contains("ql "),
            "no chance was asked without consent"
        );
        let opened = execute_with(
            &stub.client,
            Some(&stub.owner),
            &opening(&at, &revision, true),
        )
        .unwrap();
        assert_eq!(opened["schema"], "oi.nara-journey/v1");
        assert_eq!(opened["page"]["outcome"], "written");
        assert_eq!(opened["page"]["before_revision"], json!(revision));
        assert_ne!(
            opened["page"]["revision"],
            json!(revision),
            "the receipt names the page's new revision"
        );
        let asked = stub.asked("nara.journey.open");
        let entropy = asked["entropy"]["hex"].as_str().unwrap();
        assert_eq!(entropy.len(), SHUFFLE_BYTES * 2, "fresh entropy reached QL");
        let receipt = &asked["open"]["entropy"];
        assert_eq!(receipt["provider_ref"], "provider:getrandom");
        assert!(
            !receipt.to_string().contains(entropy),
            "the receipt never carries the bytes"
        );
        assert_eq!(asked["open"]["consent"], "granted");
        assert_eq!(
            asked["open"]["journey_ref"], "journey:doc-1",
            "the journey is named by its page"
        );
        let island = stub.island(PAGE);
        assert_eq!(island["meta"]["journey"]["journey_ref"], "journey:doc-1");
        assert_eq!(
            island["meta"]["revision"],
            json!(3),
            "the page's counter moved by one"
        );
        // Reopening never deals again.
        let now = stub.revision(&at);
        let again = execute_with(&stub.client, Some(&stub.owner), &opening(&at, &now, true));
        assert!(again.unwrap_err().contains("never deals again"));
        // A stale revision deals nothing.
        let stale = Stub::new("journey-open-stale");
        let there = stale.put(PAGE, &flow_page(flow()));
        let moved = execute_with(
            &stale.client,
            Some(&stale.owner),
            &opening(&there, "r-old", true),
        );
        assert!(moved.unwrap_err().contains("moved since it was read"));
        assert!(!stale.log().contains("ql "), "nothing was shuffled");
    }

    #[test]
    fn an_act_is_saved_on_the_revision_read_a_replay_writes_nothing_and_chance_needs_consent() {
        let stub = Stub::new("journey-apply");
        let at = stub.put(PAGE, &flow_page(flow()));
        let first = stub.revision(&at);
        execute_with(&stub.client, Some(&stub.owner), &opening(&at, &first, true)).unwrap();
        let revision = stub.revision(&at);
        let draw = json!({"request_id": "draw-1", "actor_ref": "person:frank", "at_unix_ms": 5, "day_ref": "central:day:control:root:2026-10-18",
            "request": {"op": "draw", "spread": {"kind": "sphere"}, "day_ref": "central:day:control:root:2026-10-18", "basis_sources": []}});
        let act = |act: &Value, revision: &str, consent: bool| Request::Apply {
            location: at.clone(),
            expected_revision: revision.into(),
            act: act.clone(),
            consent_to_chance: consent,
        };
        assert!(execute_with(
            &stub.client,
            Some(&stub.owner),
            &act(&draw, &revision, false)
        )
        .unwrap_err()
        .contains("consent to chance, each time"));
        let drawn = execute_with(
            &stub.client,
            Some(&stub.owner),
            &act(&draw, &revision, true),
        )
        .unwrap();
        assert_eq!(drawn["page"]["outcome"], "written");
        assert_eq!(drawn["effect"]["replayed"], false);
        assert_eq!(stub.island(PAGE)["meta"]["journey"]["revision"], json!(2));
        let now = stub.revision(&at);
        let replay =
            execute_with(&stub.client, Some(&stub.owner), &act(&draw, &now, true)).unwrap();
        assert_eq!(
            replay["page"]["outcome"], "unchanged",
            "a replay deals nothing and writes nothing"
        );
        assert_eq!(stub.revision(&at), now);
        // A cast takes the kernel's own entropy, with its receipt; the renderer's is never used.
        let cast = json!({"request_id": "cast-1", "actor_ref": "person:frank", "at_unix_ms": 6, "day_ref": null,
            "request": {"op": "cast-iching", "cast": {"coins": true, "entropy": "the renderer's", "consent": "withheld"},
                "day_ref": "central:day:control:root:2026-10-18", "basis_sources": [], "related_placement_refs": []}});
        execute_with(&stub.client, Some(&stub.owner), &act(&cast, &now, true)).unwrap();
        let asked = stub.asked("nara.journey.apply");
        assert_eq!(
            asked["entropy"]["hex"].as_str().unwrap().len(),
            CAST_BYTES * 2
        );
        assert_eq!(asked["act"]["request"]["cast"]["consent"], "granted");
        assert_eq!(
            asked["act"]["request"]["cast"]["entropy"]["provider_ref"],
            "provider:getrandom"
        );
        // A stale page is refused before QL is asked.
        let stale = act(&draw, &now, true);
        assert!(execute_with(&stub.client, Some(&stub.owner), &stale)
            .unwrap_err()
            .contains("moved since it was read"));
    }

    #[test]
    fn reading_a_journey_writes_nothing_and_a_refusal_comes_back_in_qls_words() {
        let stub = Stub::new("journey-read");
        let at = stub.put(PAGE, &flow_page(flow()));
        assert!(execute_with(
            &stub.client,
            Some(&stub.owner),
            &Request::Read {
                location: at.clone(),
                window_unix_ms: None
            }
        )
        .unwrap_err()
        .contains("holds no journey yet"));
        let first = stub.revision(&at);
        execute_with(&stub.client, Some(&stub.owner), &opening(&at, &first, true)).unwrap();
        let revision = stub.revision(&at);
        let read = execute_with(
            &stub.client,
            Some(&stub.owner),
            &Request::Read {
                location: at.clone(),
                window_unix_ms: None,
            },
        )
        .unwrap();
        assert_eq!(read["reading"]["journey_ref"], "journey:doc-1");
        assert_eq!(read["page"]["revision"], json!(revision));
        assert_eq!(stub.revision(&at), revision, "a read writes nothing");
        std::fs::write(stub.home.join("refuse"), "unknown variant `move`").unwrap();
        let moved = json!({"request_id": "move-1", "actor_ref": "person:frank", "at_unix_ms": 7, "request": {"op": "move"}});
        let refused = execute_with(
            &stub.client,
            Some(&stub.owner),
            &Request::Apply {
                location: at,
                expected_revision: revision,
                act: moved,
                consent_to_chance: false,
            },
        )
        .unwrap_err();
        assert!(refused.contains("unknown variant `move`"), "{refused}");
    }

    /// Through the host's dispatch: a reading is a prepared owner read, an opening a prepared owner write, each run outside the
    /// kernel lock; the lived context and the elemental map are owner reads. Each is refused here before QL is asked.
    #[test]
    fn the_practice_ops_run_outside_the_kernel_lock_in_their_forms() {
        let stub = Stub::new("journey-dispatch");
        let at = stub.put(PAGE, &flow_page(flow()));
        let kernel = std::sync::Mutex::new(crate::Kernel::new(stub.client.clone()));
        let (read, timing) = crate::dispatch::dispatch(
            &kernel,
            crate::KernelOp::NaraJourney {
                request: Request::Read {
                    location: at.clone(),
                    window_unix_ms: None,
                },
            },
        );
        assert!(read.unwrap_err().contains("holds no journey yet"));
        assert_eq!(timing.form, "owner-read");
        let (opened, timing) = crate::dispatch::dispatch(
            &kernel,
            crate::KernelOp::NaraJourney {
                request: opening(&at, "r-any", false),
            },
        );
        assert!(opened.unwrap_err().contains("consent to chance"));
        assert_eq!(timing.form, "owner-write");
        let lived: crate::KernelOp = serde_json::from_value(json!({"op": "nara_lived_context", "request": {"operation": "compose",
            "subject_ref": "person:frank", "concern": {"concern_ref": "c", "title": "t"}, "disclosed_via_ref": "consent:x"}}))
        .unwrap();
        let (composed, timing) = crate::dispatch::dispatch(&kernel, lived);
        assert!(composed.unwrap_err().contains("pages, or the Day"));
        assert_eq!(timing.form, "owner-read");
        let elemental: crate::KernelOp = serde_json::from_value(json!({"op": "nara_elemental", "request": {"operation": "map",
            "source_ref": "central:source:control:root:Control/self/nara/identities/none.json", "expected_revision": "s"}}))
        .unwrap();
        let (_, timing) = crate::dispatch::dispatch(&kernel, elemental);
        assert_eq!(timing.form, "owner-read");
        assert!(!stub.log().contains("ql "), "QL was asked nothing");
    }

    #[test]
    fn the_request_reads_as_the_wire_spells_it() {
        let request: Request = serde_json::from_value(json!({"operation": "read",
            "location": {"schema": "central.path-ref/v1", "ref": "ref:a", "root": "R", "path": "a.html"}}))
        .unwrap();
        assert!(!request.is_write());
        assert!(serde_json::from_value::<Request>(json!({"operation": "read", "entropy": "x",
            "location": {"schema": "central.path-ref/v1", "ref": "ref:a", "root": "R", "path": "a.html"}}))
        .is_err(), "the renderer cannot hand chance in");
    }
}
