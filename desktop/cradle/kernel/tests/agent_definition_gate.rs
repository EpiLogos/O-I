//! Controlled subprocess owners exercise the production Agent definition bridge.
//! No fixtures enter production; these checks do not assert live-provider use.
#![cfg(unix)]
#[path = "support/stub.rs"]
mod stub;
use oi_cradle_kernel::{
    agency::Client,
    agent_definition::{self, Request},
    flow::CentralClient,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicU32, Ordering};
use std::{
    fs,
    os::unix::fs::PermissionsExt,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
static RIG_SEQ: AtomicU32 = AtomicU32::new(0);
struct Rig {
    root: PathBuf,
    executable: PathBuf,
}
impl Rig {
    fn new() -> Self {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
            + 0x1000000 * RIG_SEQ.fetch_add(1, Ordering::Relaxed) as u128;
        let root = std::env::temp_dir().join(format!(
            "oi-agent-definition-{}-{stamp}",
            std::process::id()
        ));
        fs::create_dir(&root).unwrap();
        let executable = root.join("owner");
        let staged = root.join("owner-staged");
        fs::write(&staged, r#"#!/usr/bin/env python3
import json,pathlib,sys
root=pathlib.Path(__file__).parent
args=sys.argv[1:]
with (root/'calls').open('a') as f: f.write(json.dumps(args)+'\n')
if 'action' in args:
 op=args[-2];req=json.loads(args[-1])
 if op=='agent-profile.roster': value={'schema':'central.agent-profile-roster/v1','scope_ref':'control:root','profiles':[],'execution_authority_granted':False}
 elif op=='agent-profile.express': value={'profile':{'ref':'agent-profile:allocated'}}
 elif op in ('agent-profile.read','agent-profile.review','agent-profile.save') and (root/'profile.json').exists():
  profile=json.loads((root/'profile.json').read_text())
  if op=='agent-profile.save':
   if req.get('expected_revision')!=profile['revision']: print(json.dumps({'ok':False,'error':{'code':'invalid_input','message':'revision conflict'}})); sys.exit(1)
   (root/'profile.json').write_text(json.dumps(req['profile'])); value={'saved':True}
  elif op=='agent-profile.read': value={'profile':profile}
  else:
   accepted=(root/'accepted').exists() and (root/'accepted').read_text()==profile['revision']
   value={'schema':'central.agent-profile-review/v1','scope_ref':'control:root','profile':profile,'accepted':accepted,'execution_authority_granted':False,'content_digest':'sha256:'+profile['revision']}
 else: value={'operation':op,'input':req}
 print(json.dumps({'ok':True,'data':value}))
elif 'agent-session-scope' in args:
 print(json.dumps({'schema':'aikit.direct-agent-scope/v1','project_ref':'control:root'}))
elif 'discover' in args:
 value=[{'version':'aikit.session-space-application/v1','definition':{'id':'session-space/native','projects':['control:root']},'agent_sessions':{'agent-session/native':{}}}]
 if (root/'discovery.json').exists(): value=json.loads((root/'discovery.json').read_text())
 print(json.dumps(value))
else:
 value={'schema':'aikit.direct-agent-session/v1','request_id':'request-12345678','profile_ref':'agent-profile:allocated','agent_ref':'agent:native','agent_session':'agent-session/native','space':'session-space/native','project_ref':'control:root','prepared':True,'provider_started':False,'execution_authority_granted':False}
 if (root/'override.json').exists(): value.update(json.loads((root/'override.json').read_text()))
 print(json.dumps(value))
"#).unwrap();
        fs::set_permissions(&staged, fs::Permissions::from_mode(0o700)).unwrap();
        stub::settle_stub(&staged);
        fs::rename(&staged, &executable).unwrap();
        Self { root, executable }
    }
    fn call(&self, request: Request) -> Result<Value, String> {
        agent_definition::execute(
            &CentralClient::with(
                self.executable.clone(),
                Some(self.root.clone()),
                "MUST-NOT-FALLBACK".into(),
            ),
            &Client::with(self.executable.clone(), None),
            None,
            &self.root,
            &request,
        )
    }
    fn calls(&self) -> Vec<Value> {
        fs::read_to_string(self.root.join("calls"))
            .unwrap_or_default()
            .lines()
            .map(|l| serde_json::from_str(l).unwrap())
            .collect()
    }
    fn prepare() -> Request {
        Request::Prepare {
            request_id: "request-12345678".into(),
            profile_ref: "agent-profile:allocated".into(),
            expected_revision: "r1".into(),
            expected_content_digest: "sha256:source".into(),
            expected_acceptance_ref: "acceptance:source".into(),
        }
    }
}
impl Drop for Rig {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
#[test]
fn root_does_not_fallback_to_a_configured_child_and_no_acceptance_is_implied() {
    let rig = Rig::new();
    let value = rig
        .call(Request::Propose {
            name: "Reader".into(),
            purpose: "Keep my exact words.".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec![],
            expressive_character_ref: None,
            self_source_ref: None,
            logos_ref: None,
            skill_set_refs: vec![],
        })
        .unwrap();
    assert_eq!(value["operation"], "agent-profile.review");
    let calls = rig.calls();
    assert_eq!(calls.len(), 3);
    for call in &calls {
        let request: Value =
            serde_json::from_str(call.as_array().unwrap().last().unwrap().as_str().unwrap())
                .unwrap();
        assert!(request.get("project").is_none());
        assert_eq!(request["scope"], "root");
    }
    let request: Value = serde_json::from_str(
        calls[1]
            .as_array()
            .unwrap()
            .last()
            .unwrap()
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(request["ratified_world_refs"], json!(["control:root"]));
    assert_eq!(request["intent_expression"], "Keep my exact words.");
    assert!(!calls.iter().any(|c| c
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "agent-profile.accept")));
}
#[test]
fn the_expressive_character_ref_is_forwarded_to_the_profile_proposal() {
    let rig = Rig::new();
    let character = "central:Control/agents/expressive-material/character/reader.expression.json";
    rig.call(Request::Propose {
        name: "Reader".into(),
        purpose: "Keep my exact words.".into(),
        expected_scope_ref: "control:root".into(),
        skill_refs: vec![],
        skill_set_refs: vec![],
        expressive_character_ref: Some(character.into()),
        self_source_ref: None,
        logos_ref: None,
    })
    .unwrap();
    let calls = rig.calls();
    let express: Value = serde_json::from_str(
        calls[1]
            .as_array()
            .unwrap()
            .last()
            .unwrap()
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(express["expressive_character_ref"], character);
    // Absent stays absent: nothing is invented for an Agent without a character.
    let bare = Rig::new();
    bare.call(Request::Propose {
        name: "Reader".into(),
        purpose: "Keep my exact words.".into(),
        expected_scope_ref: "control:root".into(),
        skill_refs: vec![],
        skill_set_refs: vec![],
        expressive_character_ref: None,
        self_source_ref: None,
        logos_ref: None,
    })
    .unwrap();
    let calls = bare.calls();
    let express: Value = serde_json::from_str(
        calls[1]
            .as_array()
            .unwrap()
            .last()
            .unwrap()
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert!(express.get("expressive_character_ref").is_none());
    // A multi-line or padded ref is refused before any owner call.
    let refused = Rig::new();
    for bad in [" central:x", "central:x\ny"] {
        assert!(refused
            .call(Request::Propose {
                name: "Reader".into(),
                purpose: "Exact".into(),
                expected_scope_ref: "control:root".into(),
                skill_refs: vec![],
                skill_set_refs: vec![],
                expressive_character_ref: Some(bad.into()),
                self_source_ref: None,
                logos_ref: None,
            })
            .is_err());
    }
    assert!(refused.calls().is_empty());
    // The wire spelling the renderer sends deserializes.
    let wire: Request = serde_json::from_value(json!({"action":"propose","name":"R","purpose":"P",
        "expected_scope_ref":"control:root","expressive_character_ref":character}))
    .unwrap();
    assert!(matches!(
        wire,
        Request::Propose {
            expressive_character_ref: Some(_),
            ..
        }
    ));
}

/// The authored self-definition pins ride the proposal as exact-byte digests
/// resolved under the confirmed scope root, and the read-back must carry
/// exactly what was submitted.
#[test]
fn the_self_definition_pins_are_resolved_to_exact_bytes_and_forwarded_to_the_proposal() {
    let rig = Rig::new();
    let self_text = b"I am the reading colleague; my ground is held, not claimed.\n";
    let logos_text = b"You act from within a relation.\n";
    fs::create_dir_all(rig.root.join("Control/self/agents/colleague")).unwrap();
    fs::write(
        rig.root.join("Control/self/agents/colleague/self.md"),
        self_text,
    )
    .unwrap();
    fs::write(
        rig.root.join("Control/self/agents/colleague/logos.md"),
        logos_text,
    )
    .unwrap();
    let self_ref = "central:source:control:root:Control/self/agents/colleague/self.md";
    let logos_ref = "central:source:control:root:Control/self/agents/colleague/logos.md";
    let expected = json!({
        "source": {
            "reference": self_ref,
            "content_digest": format!("sha256:{:x}", Sha256::digest(self_text))
        },
        "relational_logos": {
            "reference": logos_ref,
            "content_digest": format!("sha256:{:x}", Sha256::digest(logos_text))
        }
    });
    // The read-back (the stub serves `profile.json` for `agent-profile.review`)
    // carries exactly the composed pins, so the echo check passes.
    fs::write(
        rig.root.join("profile.json"),
        json!({"schema":"central.agent-profile/v1","ref":"agent-profile:allocated","revision":"r1",
            "agent_ref":"agent:native","scope":"personal","world_ref":"control:root","name":"Colleague",
            "self_definition": expected})
            .to_string(),
    )
    .unwrap();
    let review = rig
        .call(Request::Propose {
            name: "Colleague".into(),
            purpose: "Keep my exact words.".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec![],
            skill_set_refs: vec![],
            expressive_character_ref: None,
            self_source_ref: Some(self_ref.into()),
            logos_ref: Some(logos_ref.into()),
        })
        .unwrap();
    let calls = rig.calls();
    let express: Value = serde_json::from_str(
        calls[1]
            .as_array()
            .unwrap()
            .last()
            .unwrap()
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        express["self_definition"], expected,
        "the exact bytes under the confirmed scope root are digested and pinned"
    );
    assert_eq!(
        review["profile"]["self_definition"], expected,
        "the read-back shows the profile carries the submitted pins"
    );
    // A changed byte is a different pin: the digest follows the exact file.
    fs::write(
        rig.root.join("Control/self/agents/colleague/self.md"),
        b"changed\n",
    )
    .unwrap();
    let changed = rig
        .call(Request::Propose {
            name: "Colleague".into(),
            purpose: "Keep my exact words.".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec![],
            skill_set_refs: vec![],
            expressive_character_ref: None,
            self_source_ref: Some(self_ref.into()),
            logos_ref: Some(logos_ref.into()),
        })
        .unwrap_err();
    assert!(
        changed.contains("self_definition_echo_mismatch"),
        "the read-back no longer matches the freshly digested pin: {changed}"
    );
    fs::write(
        rig.root.join("Control/self/agents/colleague/self.md"),
        self_text,
    )
    .unwrap();

    // A missing source refuses by name, before `agent-profile.express` runs.
    let missing = Rig::new();
    let error = missing
        .call(Request::Propose {
            name: "Colleague".into(),
            purpose: "Keep my exact words.".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec![],
            skill_set_refs: vec![],
            expressive_character_ref: None,
            self_source_ref: Some(self_ref.into()),
            logos_ref: Some(logos_ref.into()),
        })
        .unwrap_err();
    assert!(error.contains("self_source_unreadable"), "{error}");
    assert!(error.contains(self_ref), "{error}");
    assert!(!missing.calls().iter().any(|c| c
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "agent-profile.express")));
    // A ref from another world is not resolvable inside this confirmed scope.
    let foreign = Rig::new();
    fs::create_dir_all(foreign.root.join("Control/self/agents/colleague")).unwrap();
    fs::write(
        foreign.root.join("Control/self/agents/colleague/self.md"),
        self_text,
    )
    .unwrap();
    let error = foreign
        .call(Request::Propose {
            name: "Colleague".into(),
            purpose: "Keep my exact words.".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec![],
            skill_set_refs: vec![],
            expressive_character_ref: None,
            self_source_ref: Some("central:source:project:project:elsewhere:self.md".into()),
            logos_ref: Some(logos_ref.into()),
        })
        .unwrap_err();
    assert!(error.contains("self_source_unreadable"), "{error}");
    assert!(!foreign.calls().iter().any(|c| c
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "agent-profile.express")));

    // Exactly one pin is refused before any owner call.
    let half = Rig::new();
    let error = half
        .call(Request::Propose {
            name: "Colleague".into(),
            purpose: "Keep my exact words.".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec![],
            skill_set_refs: vec![],
            expressive_character_ref: None,
            self_source_ref: Some(self_ref.into()),
            logos_ref: None,
        })
        .unwrap_err();
    assert!(
        error.contains("self_definition_requires_both_refs"),
        "{error}"
    );
    assert!(half.calls().is_empty());

    // A padded or non-Central ref never reaches the owner.
    let malformed = Rig::new();
    for bad in [
        (" central:source:control:root:self.md", logos_ref),
        (self_ref, "Work/notes.md"),
    ] {
        let error = malformed
            .call(Request::Propose {
                name: "Colleague".into(),
                purpose: "Keep my exact words.".into(),
                expected_scope_ref: "control:root".into(),
                skill_refs: vec![],
                skill_set_refs: vec![],
                expressive_character_ref: None,
                self_source_ref: Some(bad.0.into()),
                logos_ref: Some(bad.1.into()),
            })
            .unwrap_err();
        assert!(
            !error.contains("self_definition_requires_both_refs"),
            "{error}"
        );
    }
    assert!(malformed.calls().is_empty());

    // A path that leaves the confirmed scope is not a source inside it.
    let escaping = Rig::new();
    let error = escaping
        .call(Request::Propose {
            name: "Colleague".into(),
            purpose: "Keep my exact words.".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec![],
            skill_set_refs: vec![],
            expressive_character_ref: None,
            self_source_ref: Some(
                "central:source:control:root:Control/self/../agents/colleague/self.md".into(),
            ),
            logos_ref: Some(logos_ref.into()),
        })
        .unwrap_err();
    assert!(error.contains("self_source_unreadable"), "{error}");
    assert!(!escaping.calls().iter().any(|c| c
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "agent-profile.express")));

    // No-self proposals stay byte-compatible: nothing is invented.
    let bare = Rig::new();
    bare.call(Request::Propose {
        name: "Reader".into(),
        purpose: "Keep my exact words.".into(),
        expected_scope_ref: "control:root".into(),
        skill_refs: vec![],
        skill_set_refs: vec![],
        expressive_character_ref: None,
        self_source_ref: None,
        logos_ref: None,
    })
    .unwrap();
    let calls = bare.calls();
    let express: Value = serde_json::from_str(
        calls[1]
            .as_array()
            .unwrap()
            .last()
            .unwrap()
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert!(express.get("self_definition").is_none());

    // The wire spelling the renderer sends deserializes, both pins on.
    let wire: Request = serde_json::from_value(json!({"action":"propose","name":"R","purpose":"P",
        "expected_scope_ref":"control:root","self_source_ref":self_ref,"logos_ref":logos_ref}))
    .unwrap();
    assert!(matches!(
        wire,
        Request::Propose {
            self_source_ref: Some(_),
            logos_ref: Some(_),
            ..
        }
    ));
}
#[test]
fn an_existing_agent_changes_its_character_through_central_cas_and_must_be_re_accepted() {
    let rig = Rig::new();
    let character = "central:Control/agents/expressive-material/character/reader.expression.json";
    fs::write(
        rig.root.join("profile.json"),
        json!({"schema":"central.agent-profile/v1","ref":"agent-profile:allocated","revision":"r3",
            "agent_ref":"agent:native","scope":"personal","world_ref":"control:root","name":"Reader"})
        .to_string(),
    )
    .unwrap();
    fs::write(rig.root.join("accepted"), "r3").unwrap();
    let set = |character: Option<&str>, expected: &str| {
        rig.call(Request::SetCharacter {
            profile_ref: "agent-profile:allocated".into(),
            expected_revision: expected.into(),
            expressive_character_ref: character.map(str::to_owned),
        })
    };
    let changed = set(Some(character), "r3").unwrap();
    assert_eq!(changed["profile"]["expressive_character_ref"], character);
    assert_eq!(changed["profile"]["revision"], "r4");
    assert_eq!(
        changed["profile"]["name"], "Reader",
        "the rest of the source is kept"
    );
    assert_eq!(changed["character_change"]["state"], "saved");
    assert_eq!(changed["character_change"]["re_acceptance_required"], true);
    let saves: Vec<Value> = rig
        .calls()
        .into_iter()
        .filter(|c| {
            c.as_array()
                .unwrap()
                .iter()
                .any(|v| v == "agent-profile.save")
        })
        .collect();
    assert_eq!(saves.len(), 1);
    let save: Value = serde_json::from_str(
        saves[0]
            .as_array()
            .unwrap()
            .last()
            .unwrap()
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        save["expected_revision"], "r3",
        "compare-and-swap on the read revision"
    );
    // A stale basis is refused before any write.
    let error = set(None, "r3").unwrap_err();
    assert!(error.contains("revision_conflict"), "{error}");
    // Setting the same ref is a no-op; clearing removes the field.
    assert_eq!(
        set(Some(character), "r4").unwrap()["character_change"]["state"],
        "unchanged"
    );
    let cleared = set(None, "r4").unwrap();
    assert!(cleared["profile"].get("expressive_character_ref").is_none());
    assert_eq!(cleared["profile"]["revision"], "r5");
    assert_eq!(cleared["character_change"]["re_acceptance_required"], false);
    // Wire spelling from the renderer.
    let wire: Request = serde_json::from_value(json!({"action":"set-character","profile_ref":"p",
        "expected_revision":"r1","expressive_character_ref":null}))
    .unwrap();
    assert!(matches!(
        wire,
        Request::SetCharacter {
            expressive_character_ref: None,
            ..
        }
    ));
    assert_eq!(agent_definition::next_revision("r9"), "r10");
    assert_eq!(agent_definition::next_revision("p"), "p-1");
}
#[test]
fn changed_scope_or_unreviewed_trim_is_refused_before_generation() {
    let rig = Rig::new();
    assert!(rig
        .call(Request::Propose {
            name: "Reader".into(),
            purpose: "Exact".into(),
            expected_scope_ref: "project:other".into(),
            skill_refs: vec![],
            expressive_character_ref: None,
            self_source_ref: None,
            logos_ref: None,
            skill_set_refs: vec![],
        })
        .is_err());
    assert_eq!(rig.calls().len(), 1);
    assert!(rig
        .call(Request::Propose {
            name: "Reader".into(),
            purpose: " Exact ".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec![],
            expressive_character_ref: None,
            self_source_ref: None,
            logos_ref: None,
            skill_set_refs: vec![],
        })
        .is_err());
    assert_eq!(rig.calls().len(), 1);
}
#[test]
fn acceptance_transports_only_the_reviewed_native_basis_not_authority() {
    let rig = Rig::new();
    let value = rig
        .call(Request::Accept {
            profile_ref: "agent-profile:allocated".into(),
            expected_revision: "r1".into(),
            expected_content_digest: "sha256:source".into(),
        })
        .unwrap();
    assert_eq!(value["operation"], "agent-profile.accept");
    assert_eq!(value["input"]["expected_revision"], "r1");
    assert!(value["input"].get("actor").is_none());
    assert!(value["input"].get("credential").is_none());
    for field in ["credential", "actor", "agent_ref", "executable"] {
        let mut request = json!({"action":"accept","profile_ref":"p","expected_revision":"r","expected_content_digest":"d"});
        request[field] = json!("forged");
        assert!(serde_json::from_value::<Request>(request).is_err());
    }
}
#[test]
fn prepared_session_must_be_attached_and_in_the_actual_native_scope() {
    let rig = Rig::new();
    rig.call(Rig::prepare()).unwrap();
    fs::write(
        rig.root.join("override.json"),
        r#"{"space":"session-space/foreign"}"#,
    )
    .unwrap();
    assert!(rig.call(Rig::prepare()).is_err());
    fs::write(
        rig.root.join("override.json"),
        r#"{"project_ref":"project:foreign"}"#,
    )
    .unwrap();
    assert!(rig.call(Rig::prepare()).is_err());
}
#[test]
fn discovery_without_the_native_version_is_not_an_attached_session() {
    let rig = Rig::new();
    let row = json!({
        "definition": {"id": "session-space/native", "projects": ["control:root"]},
        "agent_sessions": {"agent-session/native": {}}
    });
    for version in [
        None,
        Some(json!("aikit.session-space-application/v0")),
        Some(json!(1)),
    ] {
        let mut reading = row.clone();
        if let Some(version) = version {
            reading["version"] = version;
        }
        fs::write(
            rig.root.join("discovery.json"),
            json!([reading]).to_string(),
        )
        .unwrap();
        for request in [
            Rig::prepare(),
            Request::Find {
                request_id: "request-12345678".into(),
            },
        ] {
            assert_eq!(
                rig.call(request).unwrap_err(),
                "Unsupported native SessionSpace reading"
            );
        }
    }
}
#[test]
fn correlation_and_effect_flags_cannot_turn_a_bad_reply_into_success() {
    let rig = Rig::new();
    for patch in [
        json!({"request_id":"other"}),
        json!({"provider_started":true}),
        json!({"prepared":false}),
        json!({"execution_authority_granted":true}),
        json!({"agent_session":"foreign"}),
    ] {
        fs::write(rig.root.join("override.json"), patch.to_string()).unwrap();
        assert!(rig.call(Rig::prepare()).is_err());
    }
}
#[test]
fn readback_uses_the_original_request_and_cannot_invoke_an_arbitrary_cli() {
    let rig = Rig::new();
    rig.call(Request::Find {
        request_id: "request-12345678".into(),
    })
    .unwrap();
    let calls = rig.calls();
    assert!(calls[0]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "agent-session-find"));
    assert!(!calls.iter().any(|c| c
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "agent-session-prepare")));
    assert!(Client::with(rig.executable.clone(), None)
        .direct_agent(&rig.root, "credential-delete", None)
        .is_err());
    assert_eq!(rig.calls().len(), calls.len());
}

#[test]
fn skillset_readings_use_the_owner_set_surface_and_propose_carries_set_refs() {
    let rig = Rig::new();
    rig.call(Request::SkillSets).unwrap();
    rig.call(Request::SkillSet {
        name: "research-deep".into(),
    })
    .unwrap();
    let calls = rig.calls();
    assert!(calls[0]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "set" || v == "--json"));
    assert!(calls[0].as_array().unwrap().iter().any(|v| v == "list"));
    assert!(calls[1].as_array().unwrap().iter().any(|v| v == "show"));
    assert!(calls[1]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "research-deep"));
    // Set selection rides the reviewed proposal into Central's own input.
    let value = rig
        .call(Request::Propose {
            name: "Reader".into(),
            purpose: "Keep my exact words.".into(),
            expected_scope_ref: "control:root".into(),
            skill_refs: vec!["skill/one".into()],
            skill_set_refs: vec!["skill-set:research".into()],
            expressive_character_ref: None,
            self_source_ref: None,
            logos_ref: None,
        })
        .unwrap();
    assert_eq!(value["operation"], "agent-profile.review");
    let express = rig
        .calls()
        .iter()
        .find(|c| {
            c.as_array()
                .unwrap()
                .iter()
                .any(|v| v == "agent-profile.express")
        })
        .unwrap()
        .clone();
    let request: Value = serde_json::from_str(
        express
            .as_array()
            .unwrap()
            .last()
            .unwrap()
            .as_str()
            .unwrap(),
    )
    .unwrap();
    assert_eq!(request["skill_set_refs"], json!(["skill-set:research"]));
    assert_eq!(request["skill_refs"], json!(["skill/one"]));
    // Unknown ingress fields are refused at the door, never ignored.
    assert!(serde_json::from_value::<Request>(json!({
        "action": "skillset", "name": "x", "executable": "/bin/evil"
    }))
    .is_err());
}

#[test]
fn native_scope_and_skill_discovery_use_only_the_allowlisted_read_verbs() {
    let rig = Rig::new();
    rig.call(Request::Scope).unwrap();
    rig.call(Request::Skills).unwrap();
    let calls = rig.calls();
    assert!(calls[0]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "agent-session-scope"));
    assert!(calls[1]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "agent-session-skills"));
    assert!(!calls.iter().any(|args| args
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "action" || v == "agent-session-prepare")));
}
#[test]
fn partial_preparation_readback_is_not_complete_but_retains_the_original_native_identity() {
    let rig = Rig::new();
    fs::write(
        rig.root.join("override.json"),
        r#"{"prepared":false,"resume_preparation_allowed":true}"#,
    )
    .unwrap();
    assert!(rig.call(Rig::prepare()).is_err());
    let partial = rig
        .call(Request::Find {
            request_id: "request-12345678".into(),
        })
        .unwrap();
    assert_eq!(partial["prepared"], false);
    assert_eq!(partial["agent_session"], "agent-session/native");
    assert!(!rig.calls().iter().any(|args| args
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "encounter")));
    for patch in [
        json!({"prepared":false,"resume_preparation_allowed":false}),
        json!({"prepared":false,"resume_preparation_allowed":true,"project_ref":"project:foreign"}),
        json!({"prepared":false,"resume_preparation_allowed":true,"request_id":"another"}),
        json!({"prepared":false,"resume_preparation_allowed":true,"provider_started":true}),
    ] {
        fs::write(rig.root.join("override.json"), patch.to_string()).unwrap();
        assert!(rig
            .call(Request::Find {
                request_id: "request-12345678".into()
            })
            .is_err());
    }
}

/// The renderer's wire spellings deserialize (nativeAgent.ts sends
/// `{"action":"skillsets"}` and `{"action":"skillset","name":…}`); the
/// kebab-case defaults `skill-sets`/`skill-set` would refuse them.
#[test]
fn renderer_skillset_actions_reach_the_owner_requests() {
    use oi_cradle_kernel::agent_definition::Request;
    let list: Request = serde_json::from_str(r#"{"action":"skillsets"}"#).unwrap();
    assert_eq!(list, Request::SkillSets);
    let show: Request = serde_json::from_str(r#"{"action":"skillset","name":"anima"}"#).unwrap();
    assert_eq!(
        show,
        Request::SkillSet {
            name: "anima".into()
        }
    );
}
