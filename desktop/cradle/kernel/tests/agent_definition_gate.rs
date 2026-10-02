//! Production Agent-definition bridge against explicitly built native owners.
//! readable-presentation-native runs every ignored test after its pinned Central
//! and AIKit builds. Missing owners fail that gate; no substitute replies exist.
//! The controlled human/source fixture stays in a disposable World. Preparation
//! does not run a model, perform a tool action or grant execution authority.
#![cfg(unix)]

use oi_cradle_kernel::{
    agency::Client,
    agent_definition::{self, Request},
    flow::CentralClient,
    native_process::{self, Limits},
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    os::unix::fs::{DirBuilderExt, PermissionsExt},
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicU32, Ordering},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

static RIG_SEQ: AtomicU32 = AtomicU32::new(0);
const REQUEST_ID: &str = "agent-definition-real-request-12345678";
const CHARACTER: &str =
    "central:Control/agents/expressive-material/character/reader.expression.json";

struct Rig {
    directory: PathBuf,
    root: PathBuf,
    home: PathBuf,
    central: PathBuf,
    human_central: PathBuf,
    aikit: PathBuf,
    log: PathBuf,
}

fn built_owner(variable: &str) -> PathBuf {
    let path = PathBuf::from(std::env::var_os(variable).unwrap_or_else(|| {
        panic!("{variable} is required: readable-presentation-native must build the actual owner")
    }));
    assert!(
        path.is_absolute(),
        "{variable} must name the exact built owner"
    );
    let metadata = fs::metadata(&path).expect("the explicitly built native owner exists");
    assert!(
        metadata.is_file(),
        "{variable} must name a native executable"
    );
    assert_ne!(metadata.permissions().mode() & 0o111, 0);
    fs::canonicalize(path).unwrap()
}

/// Exec delegates preserve the owner's argv, stdin, stdout, stderr and exit.
/// Only call recording and the child's private roots are added. No response,
/// profile, SessionSpace, acceptance or prepared identity is manufactured.
fn delegate(path: &Path, config: Value) {
    // A JSON string literal is also a Python string literal here. The JSON
    // document is decoded rather than interpolating filesystem paths as code.
    let encoded = serde_json::to_string(&config.to_string()).unwrap();
    let script = format!(
        r#"#!/usr/bin/env python3
import json,os,sys
config=json.loads({encoded})
args=sys.argv[1:]
for name in ('CENTRAL_NATIVE_TOKEN','AIKIT_CONTEXT_ID','AIKIT_ISOLATION','CENTRAL_PROJECT'):
    os.environ.pop(name,None)
os.environ['CENTRAL_ROOT']=config['root']
os.environ['OI_CENTRAL_ROOT']=config['root']
os.environ['CENTRAL_CTRL_BIN']=config['ctrl']
os.environ['AIKIT_HOME']=config['home']
if config.get('human_token') and len(args)>=3 and args[-3:-1]==['run','agent-profile.accept']:
    os.environ['CENTRAL_NATIVE_TOKEN']=config['human_token']
fd=os.open(config['log'],os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
try:
    os.write(fd,json.dumps({{'owner':config['owner'],'argv':args}}).encode()+bytes([10]))
finally:
    os.close(fd)
os.execv(config['executable'],[config['executable']]+args)
"#
    );
    let staged = path.with_extension("staged");
    fs::write(&staged, script).unwrap();
    fs::set_permissions(&staged, fs::Permissions::from_mode(0o700)).unwrap();
    // The copy's writer belongs to this finite child. Parallel forks cannot
    // inherit a parent write descriptor and pin the executable with ETXTBSY.
    let mut command = Command::new("/bin/cp");
    command.arg(&staged).arg(path);
    let output = native_process::run(
        command,
        None,
        Limits {
            timeout: Duration::from_secs(5),
            stdout_bytes: 4096,
            stderr_bytes: 4096,
        },
    )
    .expect("install a transparent native-owner delegate");
    assert!(output.status.success(), "delegate copy failed: {output:?}");
    fs::remove_file(staged).unwrap();
}

impl Rig {
    fn new() -> Self {
        // No personal installed owner is discovered as an implicit fallback.
        let ctrl = built_owner("OI_CENTRAL_CTRL_BIN");
        let aikit = built_owner("OI_AIKIT_BIN");
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
        let sequence = RIG_SEQ.fetch_add(1, Ordering::Relaxed);
        let directory = std::env::temp_dir().join(format!(
            "oi-agent-definition-real-{}-{}-{sequence}",
            std::process::id(),
            stamp.as_nanos()
        ));
        fs::DirBuilder::new()
            .mode(0o700)
            .create(&directory)
            .unwrap();
        // Own cleanup before any native initialization or authored fixture can
        // fail. All subsequent paths are inside this one private directory.
        let rig = Self {
            root: directory.join("World"),
            home: directory.join("AIKitHome"),
            central: directory.join("central-owner"),
            human_central: directory.join("controlled-human-central-owner"),
            aikit: directory.join("aikit-owner"),
            log: directory.join("native-calls.jsonl"),
            directory,
        };
        fs::create_dir(&rig.root).unwrap();
        fs::create_dir(&rig.home).unwrap();
        let token = format!(
            "agent-profile-human-controlled-test-not-a-live-secret-{}-{sequence}",
            stamp.as_nanos()
        );
        for (path, owner, executable, human_token) in [
            (&rig.central, "central", &ctrl, None),
            (
                &rig.human_central,
                "controlled-human-central",
                &ctrl,
                Some(&token),
            ),
            (&rig.aikit, "aikit", &aikit, None),
        ] {
            delegate(
                path,
                json!({
                    "owner":owner,"executable":executable,"ctrl":ctrl,
                    "root":rig.root,"home":rig.home,"log":rig.log,"human_token":human_token
                }),
            );
        }
        rig.owner("central.init", json!({"project":null}));
        rig.owner(
            "central.world-relations.save",
            json!({"scope":"root","project":null,"record":{
                "schema":"central.world-relations/v1","ref":"control:root","revision":"w1"
            }}),
        );

        // This is the real native acceptance test's authored authority shape,
        // with a finite future expiry for actual CLI time. It grants only
        // exact-source acceptance to a controlled human, not Agency or tools.
        // The token reaches only the accepting child; ordinary owners clear it.
        fs::write(
            rig.root.join("Control/user/agent-authority.json"),
            serde_json::to_vec_pretty(&json!({
                "schema":"central.native-action-authority/v1","scope_ref":"control:root",
                "grants":[{
                    "principal_ref":"human:controlled-test","actor_kind":"human",
                    "token_sha256":format!("{:x}",Sha256::digest(token.as_bytes())),
                    "scope_refs":["control:root"],"actions":["agent-profile.accept"],
                    "expires_at_unix_seconds":stamp.as_secs()+3600
                }]
            }))
            .unwrap(),
        )
        .unwrap();
        fs::create_dir_all(rig.root.join("Control/relations")).unwrap();
        fs::write(
            rig.root.join("Control/relations/source-relations.json"),
            serde_json::to_vec_pretty(&json!({
                "schema":"central.control.ground-relations/v1","project_id":"control:root",
                "relations":[{
                    "ref":"central:source:control:root:Control/user/agent-authority.json",
                    "path":"Control/user/agent-authority.json","roles":["native-action-authority"],
                    "provenance":"human-adopted","standing":"architecture-contract",
                    "treatment":"projectcentral-user",
                    "recognition":"controlled-test-only-not-personal-adoption",
                    "recorded_at_unix_seconds":stamp.as_secs()
                }]
            }))
            .unwrap(),
        )
        .unwrap();
        rig.clear_calls();
        rig
    }

    fn central_client(&self, human: bool) -> CentralClient {
        CentralClient::with(
            if human {
                self.human_central.clone()
            } else {
                self.central.clone()
            },
            Some(self.root.clone()),
            "MUST-NOT-FALLBACK".into(),
        )
    }

    fn agency(&self) -> Client {
        Client::with(self.aikit.clone(), Some(self.home.clone()))
    }

    fn call(&self, request: Request) -> Result<Value, String> {
        self.call_at(&request, &self.root, false)
    }

    fn call_at(&self, request: &Request, cwd: &Path, human: bool) -> Result<Value, String> {
        agent_definition::execute(
            &self.central_client(human),
            &self.agency(),
            None,
            cwd,
            request,
        )
    }

    fn owner(&self, action: &str, input: Value) -> Value {
        self.central_client(false).run(action, input).unwrap()
    }

    fn calls(&self) -> Vec<Value> {
        fs::read_to_string(&self.log)
            .unwrap_or_default()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }

    fn clear_calls(&self) {
        fs::write(&self.log, "").unwrap();
    }

    fn inputs(&self, action: &str) -> Vec<Value> {
        self.calls()
            .into_iter()
            .filter(|call| has_arg(call, action))
            .map(|call| serde_json::from_str(last_arg(&call)).unwrap())
            .collect()
    }

    fn propose(&self) -> Value {
        self.call(proposal(None)).unwrap()
    }

    fn review(&self, profile_ref: &str) -> Value {
        self.call(Request::Review {
            profile_ref: profile_ref.into(),
        })
        .unwrap()
    }

    fn accept_request(review: &Value) -> Request {
        Request::Accept {
            profile_ref: text(&review["profile"], "ref").into(),
            expected_revision: text(&review["profile"], "revision").into(),
            expected_content_digest: text(review, "content_digest").into(),
        }
    }

    fn accept(&self, review: &Value) -> Value {
        let accepted = self
            .call_at(&Self::accept_request(review), &self.root, true)
            .unwrap();
        assert_eq!(accepted["accepted"], true);
        assert_eq!(accepted["execution_authority_granted"], false);
        assert_eq!(
            accepted["acceptance"]["principal_ref"],
            "human:controlled-test"
        );
        assert_eq!(
            accepted["acceptance"]["profile_ref"],
            review["profile"]["ref"]
        );
        assert_eq!(
            accepted["acceptance"]["profile_revision"],
            review["profile"]["revision"]
        );
        assert_eq!(
            accepted["acceptance"]["content_digest"],
            review["content_digest"]
        );
        accepted
    }

    fn prepare_request(accepted: &Value) -> Request {
        assert_eq!(accepted["accepted"], true);
        Request::Prepare {
            request_id: REQUEST_ID.into(),
            profile_ref: text(&accepted["profile"], "ref").into(),
            expected_revision: text(&accepted["profile"], "revision").into(),
            expected_content_digest: text(accepted, "content_digest").into(),
            expected_acceptance_ref: text(&accepted["acceptance"], "acceptance_ref").into(),
        }
    }

    fn prepared(&self) -> (Value, Value) {
        let accepted = self.accept(&self.propose());
        let prepared = self.call(Self::prepare_request(&accepted)).unwrap();
        assert_prepared(&prepared, &accepted);
        (accepted, prepared)
    }

    /// Native fixture operations retain the physical deadline/output budget.
    /// Stage/apply use unchanged native previews, never authored state files.
    fn aikit_cli(&self, args: &[&str]) -> Value {
        let mut command = Command::new(&self.aikit);
        command.args(args).current_dir(&self.root);
        let output = native_process::run(
            command,
            None,
            Limits {
                timeout: Duration::from_secs(120),
                stdout_bytes: 1024 * 1024,
                stderr_bytes: 64 * 1024,
            },
        )
        .expect("finite native AIKit operation");
        assert!(
            output.status.success(),
            "native AIKit {args:?} failed: stdout={} stderr={}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        let value: Value = serde_json::from_slice(&output.stdout).unwrap();
        if value.get("ok").is_some() {
            assert_eq!(value["ok"], true, "native AIKit {args:?}: {value}");
            value
                .get("data")
                .expect("native AIKit envelope data")
                .clone()
        } else {
            value
        }
    }

    fn repertoire(&self, trusted: bool) -> Value {
        let capsule = self.home.join("registries/personal/capsules/skill/one");
        fs::create_dir_all(capsule.join("payload")).unwrap();
        fs::write(
            capsule.join("manifest.toml"),
            "schema = 1\nid = \"skill/one\"\nkind = \"skill\"\nname = \"one\"\ndescription = \"Read explicitly selected source material.\"\n\n[skill]\nroot = \"payload\"\n",
        )
        .unwrap();
        fs::write(
            capsule.join("payload/SKILL.md"),
            "---\nname: one\ndescription: Read explicitly selected source material.\n---\n\n# One\nRead the selected source and return an attributed comparison.\n",
        )
        .unwrap();
        fs::create_dir_all(self.root.join(".aikit")).unwrap();
        fs::write(
            self.root.join(".aikit/profile.toml"),
            "schema = 1\nenable = [\"skill/one\"]\n",
        )
        .unwrap();
        let created = self.aikit_cli(&["--json", "set", "create", "research-deep", "skill/one"]);
        assert_eq!(created["members"], 1);
        if trusted {
            let trust = self.aikit_cli(&[
                "--json",
                "trust",
                "record",
                "skill/one",
                "--source",
                "personal",
                "--note",
                "controlled private test source review; no execution grant",
            ]);
            assert_eq!(trust["state"], "trusted");
            assert_eq!(trust["capability"], "skill/one");
            assert!(!text(&trust, "revision").is_empty());
        }
        created
    }

    fn detach(&self, prepared: &Value) {
        let intent = json!({
            "operation":"detach-agent-session","agent_session":prepared["agent_session"]
        })
        .to_string();
        let preview = self.aikit_cli(&[
            "session-space",
            "-C",
            self.root.to_str().unwrap(),
            "stage",
            "--space",
            text(prepared, "space"),
            "--intent-json",
            &intent,
        ]);
        let preview_json = preview.to_string();
        self.aikit_cli(&[
            "session-space",
            "-C",
            self.root.to_str().unwrap(),
            "apply",
            "--preview-json",
            &preview_json,
        ]);
    }
}

impl Drop for Rig {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}

fn text<'a>(value: &'a Value, key: &str) -> &'a str {
    value[key]
        .as_str()
        .unwrap_or_else(|| panic!("native reading has no {key}: {value}"))
}

fn last_arg(call: &Value) -> &str {
    call["argv"]
        .as_array()
        .unwrap()
        .last()
        .unwrap()
        .as_str()
        .unwrap()
}

fn has_arg(call: &Value, expected: &str) -> bool {
    call["argv"]
        .as_array()
        .unwrap()
        .iter()
        .any(|arg| arg == expected)
}

fn proposal(character: Option<&str>) -> Request {
    Request::Propose {
        name: "Reader".into(),
        purpose: "Keep my exact words.".into(),
        expected_scope_ref: "control:root".into(),
        skill_refs: vec![],
        skill_set_refs: vec![],
        expressive_character_ref: character.map(str::to_owned),
    }
}

fn assert_prepared(prepared: &Value, accepted: &Value) {
    assert_eq!(prepared["schema"], "aikit.direct-agent-session/v1");
    assert_eq!(prepared["request_id"], REQUEST_ID);
    assert_eq!(prepared["profile_ref"], accepted["profile"]["ref"]);
    assert_eq!(
        prepared["profile_revision"],
        accepted["profile"]["revision"]
    );
    assert_eq!(prepared["agent_ref"], accepted["profile"]["agent_ref"]);
    assert_eq!(
        prepared["acceptance_ref"],
        accepted["acceptance"]["acceptance_ref"]
    );
    assert_eq!(prepared["project_ref"], "control:root");
    assert_eq!(prepared["prepared"], true);
    assert_eq!(prepared["provider_started"], false);
    assert_eq!(prepared["execution_authority_granted"], false);
    agent_definition::validate_prepared(
        prepared,
        Some(text(&accepted["profile"], "ref")),
        REQUEST_ID,
    )
    .unwrap();
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn root_does_not_fallback_to_a_configured_child_and_no_acceptance_is_implied() {
    let rig = Rig::new();
    let review = rig.propose();
    assert_eq!(review["schema"], "central.agent-profile-review/v1");
    assert_eq!(review["scope_ref"], "control:root");
    assert_eq!(review["profile"]["name"], "Reader");
    assert_eq!(review["profile"]["purpose"], "Keep my exact words.");
    assert_eq!(
        review["profile"]["intent_provenance"]["intent_expression"],
        "Keep my exact words."
    );
    assert_eq!(
        review["profile"]["intent_provenance"]["recognition"],
        "unrecognised"
    );
    assert_eq!(review["accepted"], false);
    assert!(review["acceptance"].is_null());
    assert_eq!(review["execution_authority_granted"], false);
    let calls = rig.calls();
    assert_eq!(calls.len(), 3);
    for call in &calls {
        assert_eq!(call["owner"], "central");
        let input: Value = serde_json::from_str(last_arg(call)).unwrap();
        assert!(input.get("project").is_none());
        assert_eq!(input["scope"], "root");
    }
    let express = rig.inputs("agent-profile.express");
    assert_eq!(express[0]["ratified_world_refs"], json!(["control:root"]));
    assert_eq!(express[0]["intent_expression"], "Keep my exact words.");
    assert!(!calls
        .iter()
        .any(|call| has_arg(call, "agent-profile.accept")));
    assert_eq!(
        rig.review(text(&review["profile"], "ref"))["profile"],
        review["profile"]
    );
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn the_expressive_character_ref_is_forwarded_to_the_profile_proposal() {
    let rig = Rig::new();
    let review = rig.call(proposal(Some(CHARACTER))).unwrap();
    assert_eq!(
        rig.inputs("agent-profile.express")[0]["expressive_character_ref"],
        CHARACTER
    );
    assert_eq!(review["profile"]["expressive_character_ref"], CHARACTER);
    assert_eq!(
        rig.review(text(&review["profile"], "ref"))["profile"]["expressive_character_ref"],
        CHARACTER
    );
    let bare = Rig::new();
    let review = bare.propose();
    assert!(bare.inputs("agent-profile.express")[0]
        .get("expressive_character_ref")
        .is_none());
    assert!(review["profile"].get("expressive_character_ref").is_none());
    rig.clear_calls();
    for bad in [" central:x", "central:x\ny"] {
        assert!(rig.call(proposal(Some(bad))).is_err());
    }
    assert!(
        rig.calls().is_empty(),
        "invalid character never reaches an owner"
    );
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn an_existing_agent_changes_its_character_through_central_cas_and_must_be_re_accepted() {
    let rig = Rig::new();
    let accepted = rig.accept(&rig.propose());
    let profile_ref = text(&accepted["profile"], "ref");
    let original_revision = text(&accepted["profile"], "revision");
    let set = |character: Option<&str>, expected: &str| {
        rig.call(Request::SetCharacter {
            profile_ref: profile_ref.into(),
            expected_revision: expected.into(),
            expressive_character_ref: character.map(str::to_owned),
        })
    };
    rig.clear_calls();
    let changed = set(Some(CHARACTER), original_revision).unwrap();
    let changed_revision = agent_definition::next_revision(original_revision);
    assert_eq!(changed["profile"]["revision"], changed_revision);
    assert_eq!(changed["profile"]["expressive_character_ref"], CHARACTER);
    let mut expected_profile = accepted["profile"].clone();
    expected_profile["revision"] = json!(changed_revision);
    expected_profile["expressive_character_ref"] = json!(CHARACTER);
    assert_eq!(
        changed["profile"], expected_profile,
        "only character and revision change"
    );
    assert_eq!(changed["accepted"], false);
    assert_eq!(changed["character_change"]["state"], "saved");
    assert_eq!(changed["character_change"]["re_acceptance_required"], true);
    assert_eq!(rig.inputs("agent-profile.save").len(), 1);
    assert_eq!(
        rig.inputs("agent-profile.save")[0]["expected_revision"],
        original_revision
    );
    assert_eq!(rig.review(profile_ref)["profile"], changed["profile"]);
    let error = set(None, original_revision).unwrap_err();
    assert!(error.contains("revision_conflict"), "{error}");
    assert_eq!(
        rig.inputs("agent-profile.save").len(),
        1,
        "stale basis never writes"
    );
    assert_eq!(
        set(Some(CHARACTER), &changed_revision).unwrap()["character_change"]["state"],
        "unchanged"
    );
    assert_eq!(rig.inputs("agent-profile.save").len(), 1);
    let cleared = set(None, &changed_revision).unwrap();
    assert!(cleared["profile"].get("expressive_character_ref").is_none());
    assert_eq!(
        cleared["profile"]["revision"],
        agent_definition::next_revision(&changed_revision)
    );
    assert_eq!(cleared["character_change"]["re_acceptance_required"], false);
    assert_eq!(rig.review(profile_ref)["profile"], cleared["profile"]);
    let reaccepted = rig.accept(&cleared);
    assert_ne!(
        reaccepted["acceptance"]["acceptance_ref"],
        accepted["acceptance"]["acceptance_ref"]
    );
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn changed_scope_or_unreviewed_trim_is_refused_before_generation() {
    let rig = Rig::new();
    let mut changed = proposal(None);
    if let Request::Propose {
        expected_scope_ref, ..
    } = &mut changed
    {
        *expected_scope_ref = "project:other".into();
    }
    assert!(rig.call(changed).is_err());
    assert_eq!(rig.calls().len(), 1);
    assert!(has_arg(&rig.calls()[0], "agent-profile.roster"));
    let mut padded = proposal(None);
    if let Request::Propose { purpose, .. } = &mut padded {
        *purpose = " Exact ".into();
    }
    assert!(rig.call(padded).is_err());
    assert_eq!(rig.calls().len(), 1);
    assert_eq!(rig.call(Request::Roster).unwrap()["profiles"], json!([]));
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn acceptance_transports_only_the_reviewed_native_basis_not_authority() {
    let rig = Rig::new();
    let review = rig.propose();
    let profile_ref = text(&review["profile"], "ref");
    let source_path = rig.root.join(text(&review, "source_path"));
    let source_bytes = fs::read(&source_path).unwrap();
    assert!(
        rig.call(Rig::accept_request(&review)).is_err(),
        "no inherited credential may accept"
    );
    assert_eq!(rig.review(profile_ref)["accepted"], false);
    let mut stale = Rig::accept_request(&review);
    if let Request::Accept {
        expected_content_digest,
        ..
    } = &mut stale
    {
        *expected_content_digest = format!("sha256:{}", "0".repeat(64));
    }
    assert!(rig.call_at(&stale, &rig.root, true).is_err());
    assert_eq!(rig.review(profile_ref)["accepted"], false);
    let accepted = rig.accept(&review);
    assert_eq!(accepted["profile"], review["profile"]);
    assert_eq!(fs::read(&source_path).unwrap(), source_bytes);
    assert_eq!(
        accepted["profile"]["intent_provenance"]["recognition"],
        "unrecognised"
    );
    assert_eq!(accepted["acceptance"]["scope_ref"], "control:root");
    let again = rig.accept(&review);
    assert_eq!(
        again["acceptance"], accepted["acceptance"],
        "native acceptance is idempotent"
    );
    assert_eq!(
        rig.review(profile_ref)["acceptance"],
        accepted["acceptance"]
    );
    for input in rig.inputs("agent-profile.accept") {
        assert_eq!(input["profile_ref"], review["profile"]["ref"]);
        assert_eq!(input["expected_revision"], review["profile"]["revision"]);
        for forbidden in ["actor", "credential", "token", "agent_ref", "executable"] {
            assert!(input.get(forbidden).is_none());
        }
    }
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn prepared_session_must_be_attached_and_in_the_actual_native_scope() {
    let rig = Rig::new();
    let (accepted, prepared) = rig.prepared();
    let scope = rig.call(Request::Scope).unwrap();
    assert_eq!(scope["schema"], "aikit.direct-agent-scope/v1");
    assert_eq!(scope["project_ref"], prepared["project_ref"]);
    assert_eq!(scope["world_readiness"]["ready"], true);
    let rows = rig
        .agency()
        .read_project(&rig.root, text(&prepared, "project_ref"))
        .unwrap();
    assert!(rows.as_array().unwrap().iter().any(|row| {
        row["definition"]["id"] == prepared["space"]
            && row["agent_sessions"]
                .get(text(&prepared, "agent_session"))
                .is_some()
    }));
    let session = rig
        .call(Request::Session {
            agent_session: text(&prepared, "agent_session").into(),
        })
        .unwrap();
    assert_eq!(session["source_state"], "current");
    assert_eq!(session["profile"], accepted["profile"]);
    // A real neighbouring directory is not the exact bound World/Project root.
    assert!(rig
        .call_at(
            &Rig::prepare_request(&accepted),
            &rig.root.join("Control"),
            false
        )
        .is_err());
    assert_eq!(
        rig.call(Request::Find {
            request_id: REQUEST_ID.into()
        })
        .unwrap(),
        prepared
    );
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn native_discovery_and_detachment_read_back_actual_attachment() {
    let rig = Rig::new();
    let (_, prepared) = rig.prepared();
    let rows = rig
        .agency()
        .read_project(&rig.root, "control:root")
        .unwrap();
    assert_eq!(rows.as_array().unwrap().len(), 1);
    assert_eq!(rows[0]["version"], "aikit.session-space-application/v1");
    assert_eq!(rows[0]["definition"]["id"], prepared["space"]);
    assert!(rows[0]["agent_sessions"]
        .get(text(&prepared, "agent_session"))
        .is_some());
    rig.detach(&prepared);
    let rows = rig
        .agency()
        .read_project(&rig.root, "control:root")
        .unwrap();
    assert!(rows[0]["agent_sessions"]
        .get(text(&prepared, "agent_session"))
        .is_none());
    let partial = rig
        .call(Request::Find {
            request_id: REQUEST_ID.into(),
        })
        .unwrap();
    assert_eq!(partial["prepared"], false);
    assert!(agent_definition::validate_prepared(
        &partial,
        Some(text(&prepared, "profile_ref")),
        REQUEST_ID
    )
    .is_err());
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn correlation_and_ingress_effect_flags_cannot_override_native_preparation() {
    let rig = Rig::new();
    let (accepted, prepared) = rig.prepared();
    let mut conflicting = Rig::prepare_request(&accepted);
    if let Request::Prepare {
        expected_revision, ..
    } = &mut conflicting
    {
        *expected_revision =
            agent_definition::next_revision(text(&accepted["profile"], "revision"));
    }
    assert!(
        rig.call(conflicting).is_err(),
        "a bound correlation cannot be replaced"
    );
    let found = rig
        .call(Request::Find {
            request_id: REQUEST_ID.into(),
        })
        .unwrap();
    assert_eq!(found, prepared);
    assert!(agent_definition::validate_prepared(
        &found,
        Some("agent-profile:another-source"),
        REQUEST_ID
    )
    .is_err());
    assert!(
        agent_definition::validate_prepared(&found, None, "different-request-correlation").is_err()
    );
    for field in [
        "prepared",
        "provider_started",
        "execution_authority_granted",
        "agent_session",
        "executable",
    ] {
        let mut ingress = serde_json::to_value(Rig::prepare_request(&accepted)).unwrap();
        ingress[field] = json!(true);
        assert!(serde_json::from_value::<Request>(ingress).is_err());
    }
    assert_eq!(found["provider_started"], false);
    assert_eq!(found["execution_authority_granted"], false);
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn readback_uses_the_original_request_and_cannot_invoke_an_arbitrary_cli() {
    let rig = Rig::new();
    assert!(rig
        .call(Request::Find {
            request_id: REQUEST_ID.into()
        })
        .unwrap()
        .is_null());
    let (_, prepared) = rig.prepared();
    rig.clear_calls();
    // A new consumer reads persisted owner state by the original correlation.
    let found = rig
        .call(Request::Find {
            request_id: REQUEST_ID.into(),
        })
        .unwrap();
    assert_eq!(found, prepared);
    let calls = rig.calls();
    assert!(has_arg(&calls[0], "agent-session-find"));
    assert_eq!(last_arg(&calls[0]), REQUEST_ID);
    assert!(!calls
        .iter()
        .any(|call| has_arg(call, "agent-session-prepare")));
    assert!(rig
        .agency()
        .direct_agent(&rig.root, "credential-delete", None)
        .is_err());
    assert_eq!(
        rig.calls(),
        calls,
        "an unallowlisted operation never launches"
    );
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn skillset_readings_use_the_owner_set_surface_and_propose_carries_set_refs() {
    let rig = Rig::new();
    let created = rig.repertoire(true);
    rig.clear_calls();
    let sets = rig.call(Request::SkillSets).unwrap();
    let set = rig
        .call(Request::SkillSet {
            name: "research-deep".into(),
        })
        .unwrap();
    assert_eq!(sets["count"], 1);
    assert_eq!(sets["sets"][0]["name"], created["name"]);
    assert_eq!(set["name"], created["name"]);
    assert_eq!(set["members"], 1);
    assert_eq!(set["projected"], json!(["skill/one"]));
    assert_eq!(set["withheld"], json!([]));
    assert_eq!(set["complete"], true);
    let calls = rig.calls();
    assert_eq!(calls.len(), 2);
    assert!(has_arg(&calls[0], "set") && has_arg(&calls[0], "list"));
    assert!(
        has_arg(&calls[1], "set")
            && has_arg(&calls[1], "show")
            && has_arg(&calls[1], "research-deep")
    );
    let review = rig
        .call(Request::Propose {
            name: "Reader".into(),
            purpose: "Keep my exact words.".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec!["skill/one".into()],
            skill_set_refs: vec!["research-deep".into()],
            expressive_character_ref: None,
        })
        .unwrap();
    assert_eq!(
        rig.inputs("agent-profile.express")[0]["skill_set_refs"],
        json!(["research-deep"])
    );
    assert_eq!(
        review["profile"]["skill_set_refs"],
        json!(["research-deep"])
    );
    assert_eq!(review["profile"]["skill_refs"], json!(["skill/one"]));
    let accepted = rig.accept(&review);
    let prepared = rig.call(Rig::prepare_request(&accepted)).unwrap();
    assert_prepared(&prepared, &accepted);
    assert_eq!(
        prepared["skill_sources"].as_array().unwrap().len(),
        1,
        "individual and set request deduplicate the native source"
    );
    assert_eq!(prepared["skill_sources"][0]["reference"], "skill/one");
    assert!(!text(&prepared["skill_sources"][0], "content_digest").is_empty());
    assert_eq!(prepared["withheld_members"], json!([]));
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn native_scope_and_skill_discovery_use_only_the_allowlisted_read_verbs() {
    let rig = Rig::new();
    rig.repertoire(false);
    rig.clear_calls();
    let scope = rig.call(Request::Scope).unwrap();
    let skills = rig.call(Request::Skills).unwrap();
    assert_eq!(scope["schema"], "aikit.direct-agent-scope/v1");
    assert_eq!(scope["project_ref"], "control:root");
    assert_eq!(scope["execution_authority_granted"], false);
    assert_eq!(scope["provider_started"], false);
    assert_eq!(skills["schema"], "aikit.direct-agent-skills/v1");
    assert_eq!(skills["activation_performed"], false);
    assert_eq!(skills["rows"].as_array().unwrap().len(), 1);
    assert_eq!(skills["rows"][0]["ref"], "skill/one");
    assert_eq!(
        skills["rows"][0]["eligible"], false,
        "unreviewed native source remains withheld"
    );
    assert!(!text(&skills["rows"][0], "reason_code").is_empty());
    let calls = rig.calls();
    assert_eq!(calls.len(), 2);
    assert!(has_arg(&calls[0], "agent-session-scope"));
    assert!(has_arg(&calls[1], "agent-session-skills"));
    assert!(!calls
        .iter()
        .any(|call| has_arg(call, "action") || has_arg(call, "agent-session-prepare")));
}

#[test]
#[ignore = "Requires built Central and AIKit; readable-presentation-native executes this real-owner gate"]
fn partial_preparation_readback_is_not_complete_but_retains_the_original_native_identity() {
    let rig = Rig::new();
    let (accepted, prepared) = rig.prepared();
    rig.detach(&prepared);
    rig.clear_calls();
    let partial = rig
        .call(Request::Find {
            request_id: REQUEST_ID.into(),
        })
        .unwrap();
    assert_eq!(partial["prepared"], false);
    assert_eq!(partial["resume_preparation_allowed"], true);
    for field in [
        "request_id",
        "agent_ref",
        "agent_session",
        "space",
        "profile_ref",
        "profile_revision",
        "acceptance_ref",
        "project_ref",
    ] {
        assert_eq!(
            partial[field], prepared[field],
            "native partial retains {field}"
        );
    }
    assert_eq!(partial["provider_started"], false);
    assert_eq!(partial["execution_authority_granted"], false);
    assert!(agent_definition::validate_prepared(
        &partial,
        Some(text(&accepted["profile"], "ref")),
        REQUEST_ID
    )
    .is_err());
    assert!(!rig
        .calls()
        .iter()
        .any(|call| has_arg(call, "agent-session-prepare") || has_arg(call, "encounter")));
    // Explicit continuation completes the same binding. Find never reattaches
    // or invents a replacement session.
    let resumed = rig.call(Rig::prepare_request(&accepted)).unwrap();
    assert_eq!(resumed, prepared);
    assert_eq!(
        rig.call(Request::Find {
            request_id: REQUEST_ID.into()
        })
        .unwrap(),
        prepared
    );
    let rows = rig
        .agency()
        .read_project(&rig.root, "control:root")
        .unwrap();
    assert_eq!(rows.as_array().unwrap().len(), 1);
    assert_eq!(rows[0]["agent_sessions"].as_object().unwrap().len(), 1);
    assert!(rows[0]["agent_sessions"]
        .get(text(&prepared, "agent_session"))
        .is_some());
}

#[test]
fn renderer_skillset_actions_reach_the_owner_requests() {
    let list: Request = serde_json::from_str(r#"{"action":"skillsets"}"#).unwrap();
    assert_eq!(list, Request::SkillSets);
    let show: Request = serde_json::from_str(r#"{"action":"skillset","name":"anima"}"#).unwrap();
    assert_eq!(
        show,
        Request::SkillSet {
            name: "anima".into()
        }
    );
    assert!(serde_json::from_value::<Request>(json!({
        "action":"skillset","name":"x","executable":"/bin/evil"
    }))
    .is_err());
}

#[test]
fn character_and_acceptance_ingress_cannot_supply_authority() {
    let wire: Request = serde_json::from_value(json!({
        "action":"propose","name":"R","purpose":"P",
        "expected_scope_ref":"control:root","expressive_character_ref":CHARACTER
    }))
    .unwrap();
    assert!(matches!(
        wire,
        Request::Propose {
            expressive_character_ref: Some(_),
            ..
        }
    ));
    let clear: Request = serde_json::from_value(json!({
        "action":"set-character","profile_ref":"p","expected_revision":"r1",
        "expressive_character_ref":null
    }))
    .unwrap();
    assert!(matches!(
        clear,
        Request::SetCharacter {
            expressive_character_ref: None,
            ..
        }
    ));
    assert_eq!(agent_definition::next_revision("r9"), "r10");
    assert_eq!(agent_definition::next_revision("p"), "p-1");
    for field in ["credential", "actor", "agent_ref", "executable"] {
        let mut request = json!({
            "action":"accept","profile_ref":"p","expected_revision":"r","expected_content_digest":"d"
        });
        request[field] = json!("forged");
        assert!(serde_json::from_value::<Request>(request).is_err());
    }
}
