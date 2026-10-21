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
 elif op=='projectcentral.source.read':
  ref=req.get('source_ref','')
  member=ref.split('Control/self/',1)[-1] if 'Control/self/' in ref else ''
  f=root/'self-sources'/member if member else None
  if not f or not f.exists():
   print(json.dumps({'ok':False,'error':{'code':'source_or_scope_unavailable','message':'self source is absent'}})); sys.exit(1)
  sref=ref
  if (root/'redirect.json').exists(): sref='central:source:control:root:redirected.md'
  value={'schema':'central.project-world-source-reading/v1','world_ref':'control:root','source':{'ref':sref,'path':'Control/self/'+member,'exists':True,'provenance':'human-authored','standing':'authored-human-position','agent_retrieval_allowed':True},'revision':{'revision':'central.content-fnv1a64/v1:1:0000000000000000','byte_len':f.stat().st_size},'content':f.read_text(),'content_encoding':'utf-8','automatic_agent_or_model_invocation':False}
 elif op=='central.self.source.create':
  d=root/'self-sources'; d.mkdir(exist_ok=True)
  f=d/req.get('path','x'); f.parent.mkdir(parents=True, exist_ok=True); f.write_text(req.get('content',''))
  value={'schema':'oi.development-field/v1','scope_ref':'control:root','self_aperture':{}}
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
        self.logged()
            .into_iter()
            .filter(|args| !Self::catalogue(args))
            .collect()
    }
    /// The kernel's own read of Central's Action catalogue (`action.list`),
    /// which classifies a write by Central's mutation_class: kernel
    /// infrastructure, not one of the bridge's calls.
    fn catalogue_reads(&self) -> usize {
        self.logged()
            .iter()
            .filter(|args| Self::catalogue(args))
            .count()
    }
    fn catalogue(args: &Value) -> bool {
        args.as_array()
            .is_some_and(|args| args.iter().any(|arg| arg == "action.list"))
    }
    fn logged(&self) -> Vec<Value> {
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
            skill_set_refs: vec![],
            self_definition: None,
        })
        .unwrap();
    assert_eq!(value["operation"], "agent-profile.review");
    let calls = rig.calls();
    assert_eq!(calls.len(), 3);
    assert!(
        rig.catalogue_reads() <= 1,
        "the catalogue is read once per owner"
    );
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
        self_definition: None,
        expressive_character_ref: Some(character.into()),
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
        self_definition: None,
        expressive_character_ref: None,
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
                self_definition: None,
                expressive_character_ref: Some(bad.into()),
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
            skill_set_refs: vec![],
            self_definition: None,
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
            skill_set_refs: vec![],
            self_definition: None,
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
            self_definition: None,
            expressive_character_ref: None,
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

// --- authored self definition (particular self + shared Relational Logos) --

fn pinned_definition() -> Value {
    json!({
        "source": {
            "reference": "central:source:control:root:Control/self/agents/kite/self.md",
            "content_digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        },
        "relational_logos": {
            "reference": "central:source:control:root:Control/self/agents/relational-logos.md",
            "content_digest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }
    })
}
fn propose_with(definition: Option<Value>) -> Request {
    Request::Propose {
        name: "Kite".into(),
        purpose: "Keep my exact words.".into(),
        expected_scope_ref: "control:root".into(),
        skill_refs: vec![],
        skill_set_refs: vec![],
        expressive_character_ref: None,
        self_definition: definition,
    }
}
#[test]
fn the_authored_self_definition_is_forwarded_verbatim_to_the_profile_proposal() {
    let rig = Rig::new();
    let definition = pinned_definition();
    let value = rig.call(propose_with(Some(definition.clone()))).unwrap();
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
    assert_eq!(
        request["self_definition"], definition,
        "the exact wire object the renderer submitted is what the express input carries"
    );
    // Absent stays absent: nothing is invented for an Agent without a self.
    let bare = Rig::new();
    bare.call(propose_with(None)).unwrap();
    let express = bare
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
    assert!(request.get("self_definition").is_none());
    // Pin grammar is checked before any owner call: references must be
    // `central:source:` refs and digests must be `sha256:` + 64 lowercase hex.
    let refused = Rig::new();
    for bad in [
        json!({"source": {"reference": "https://elsewhere/self.md", "content_digest": format!("sha256:{}", "a".repeat(64))}}),
        json!({"source": {"reference": "central:source:control:root:Control/self/x.md", "content_digest": "sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}}),
        json!({"source": {"reference": "central:source:control:root:Control/self/x.md", "content_digest": "sha256:short"}}),
        json!({"source": {"reference": "central:source:control:root:Control/self/../secrets.md", "content_digest": format!("sha256:{}", "a".repeat(64))}}),
        json!({"source": {"reference": "central:source:control:root:Control/self/x.md", "content_digest": format!("sha256:{}", "a".repeat(64)), "actor": "forged"}}),
        json!({"unknown_member": {}}),
    ] {
        assert!(
            refused.call(propose_with(Some(bad))).is_err(),
            "a malformed pin set must be refused"
        );
    }
    assert!(
        refused.calls().is_empty(),
        "refusals happen before any owner call"
    );
    // The wire spelling the renderer sends deserializes.
    let wire: Request = serde_json::from_value(json!({
        "action": "propose", "name": "K", "purpose": "P", "expected_scope_ref": "control:root",
        "self_definition": pinned_definition()
    }))
    .unwrap();
    assert!(matches!(
        wire,
        Request::Propose {
            self_definition: Some(_),
            ..
        }
    ));
}
#[test]
fn an_existing_agent_changes_its_self_definition_through_central_cas_and_must_be_re_accepted() {
    let rig = Rig::new();
    let definition = pinned_definition();
    fs::write(
        rig.root.join("profile.json"),
        json!({"schema":"central.agent-profile/v1","ref":"agent-profile:allocated","revision":"r3",
            "agent_ref":"agent:native","scope":"personal","world_ref":"control:root","name":"Reader"})
            .to_string(),
    )
    .unwrap();
    fs::write(rig.root.join("accepted"), "r3").unwrap();
    let set = |definition: Option<Value>, expected: &str| {
        rig.call(Request::SetSelf {
            profile_ref: "agent-profile:allocated".into(),
            expected_revision: expected.into(),
            self_definition: definition,
        })
    };
    let changed = set(Some(definition.clone()), "r3").unwrap();
    assert_eq!(changed["profile"]["self_definition"], definition);
    assert_eq!(changed["profile"]["revision"], "r4");
    assert_eq!(
        changed["profile"]["name"], "Reader",
        "the rest of the source is kept"
    );
    assert_eq!(changed["self_change"]["state"], "saved");
    assert_eq!(changed["self_change"]["re_acceptance_required"], true);
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
    let error = set(Some(definition.clone()), "r3").unwrap_err();
    assert!(error.contains("revision_conflict"), "{error}");
    // Setting the same pins is a no-op; clearing removes the field.
    assert_eq!(
        set(Some(definition.clone()), "r4").unwrap()["self_change"]["state"],
        "unchanged"
    );
    let cleared = set(None, "r4").unwrap();
    assert!(cleared["profile"].get("self_definition").is_none());
    assert_eq!(cleared["profile"]["revision"], "r5");
    assert_eq!(cleared["self_change"]["re_acceptance_required"], false);
    // A malformed pin set is refused before any owner call.
    let refused = Rig::new();
    assert!(refused
        .call(Request::SetSelf {
            profile_ref: "p".into(),
            expected_revision: "r1".into(),
            self_definition: Some(json!({"source": {"reference": "ftp:x"}})),
        })
        .is_err());
    assert!(refused.calls().is_empty());
    // Wire spelling from the renderer.
    let wire: Request = serde_json::from_value(
        json!({"action":"set-self","profile_ref":"p","expected_revision":"r1","self_definition":null}),
    )
    .unwrap();
    assert!(matches!(
        wire,
        Request::SetSelf {
            self_definition: None,
            ..
        }
    ));
}
#[test]
fn self_source_read_pins_the_exact_resolved_bytes_and_refuses_non_references() {
    use sha2::{Digest, Sha256};
    let rig = Rig::new();
    fs::create_dir(rig.root.join("self-sources")).unwrap();
    let content = "I am Kite, an authored self, 30 September 2026.\n";
    fs::write(rig.root.join("self-sources/fixture.md"), content).unwrap();
    let reference = "central:source:control:root:Control/self/fixture.md";
    let value = rig
        .call(Request::SelfSourceRead {
            reference: reference.into(),
        })
        .unwrap();
    assert_eq!(value["reference"], reference);
    assert_eq!(
        value["content_digest"],
        format!("sha256:{:x}", Sha256::digest(content.as_bytes()))
    );
    assert_eq!(value["size_bytes"], content.len());
    assert_eq!(value["text"], content);
    assert_eq!(value["truncated"], false);
    // A long source is previewed within the bound, digest over the exact bytes.
    let long = "a".repeat(25_000);
    fs::write(rig.root.join("self-sources/long.md"), &long).unwrap();
    let value = rig
        .call(Request::SelfSourceRead {
            reference: "central:source:control:root:Control/self/long.md".into(),
        })
        .unwrap();
    assert_eq!(value["size_bytes"], 25_000);
    assert_eq!(value["text"].as_str().unwrap().len(), 20_000);
    assert_eq!(value["truncated"], true);
    // Absent sources and redirected readings are refused as they stand.
    assert!(rig
        .call(Request::SelfSourceRead {
            reference: "central:source:control:root:Control/self/absent.md".into()
        })
        .is_err());
    fs::write(rig.root.join("redirect.json"), "{}").unwrap();
    assert!(rig
        .call(Request::SelfSourceRead {
            reference: reference.into()
        })
        .is_err());
    fs::remove_file(rig.root.join("redirect.json")).unwrap();
    // Non-references and traversal members are refused before any owner call.
    let refused = Rig::new();
    for bad in [
        "central:Control/self/fixture.md",
        "https://elsewhere/self.md",
        "central:source:control:root:Control/self/../secrets.md",
        "central:source:control:root:Control/self/./fixture.md",
        "central:source:control:root:Control/self/ ",
    ] {
        assert!(
            refused
                .call(Request::SelfSourceRead {
                    reference: bad.into()
                })
                .is_err(),
            "{bad} must be refused"
        );
    }
    assert!(
        refused.calls().is_empty(),
        "refusals happen before any owner call"
    );
}
#[test]
fn pasted_self_prose_is_created_through_the_native_human_door_and_pinned_from_resolved_bytes() {
    use sha2::{Digest, Sha256};
    let rig = Rig::new();
    let content = "Written here, once, by the person.";
    let value = rig
        .call(Request::SelfSourceCreate {
            name: "agents/kite/self.md".into(),
            content: content.into(),
        })
        .unwrap();
    let reference = "central:source:control:root:Control/self/agents/kite/self.md";
    assert_eq!(value["reference"], reference);
    assert_eq!(value["path"], "Control/self/agents/kite/self.md");
    assert_eq!(
        value["content_digest"],
        format!("sha256:{:x}", Sha256::digest(content.as_bytes())),
        "the pin comes from the resolved bytes, never hand-typed"
    );
    let create = rig
        .calls()
        .iter()
        .find(|c| {
            c.as_array()
                .unwrap()
                .iter()
                .any(|v| v == "central.self.source.create")
        })
        .unwrap()
        .clone();
    let request: Value =
        serde_json::from_str(create.as_array().unwrap().last().unwrap().as_str().unwrap()).unwrap();
    assert_eq!(request["path"], "agents/kite/self.md");
    assert_eq!(request["content"], content);
    assert_eq!(request["provenance"], "human-authored");
    assert_eq!(request["standing"], "authored-human-position");
    assert_eq!(request["actor_kind"], "human");
    assert_eq!(request["acceptance"], "human-accepted");
    assert!(request.get("actor").is_none());
    assert!(request.get("agent_session_ref").is_none());
    // Traversal-shaped or padded names are refused before any owner call.
    let refused = Rig::new();
    for bad in [
        "/etc/passwd",
        "../x.md",
        "agents/../../x.md",
        "agents//self.md",
        " x.md",
        "x.md\ny",
        "x.md\0",
    ] {
        assert!(
            refused
                .call(Request::SelfSourceCreate {
                    name: bad.into(),
                    content: "t".into(),
                })
                .is_err(),
            "{bad} must be refused"
        );
    }
    assert!(
        refused.calls().is_empty(),
        "refusals happen before any owner call"
    );
}
