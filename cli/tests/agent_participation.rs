//! AgentWorldParticipation + human card (ai-kit docs/PRAXIS-ARCHITECTURE.md
//! §6/§7) over an injected product runner. Fixture shapes are copied from
//! real native output on the development machine (2026-09-24):
//! `ctrl --json action run agent-profile.roster '{"scope":"root"}'`,
//! `agent-profile.read`, `central.position.list '{"project":"O-I"}'`,
//! `central.world.here`, `actuation occupancy list --json` and
//! `factory development custody list --json`. AIKit's
//! `aikit.agent-praxis-disclosure/v1` follows the §4 contract; the fake
//! derives it from the profile file it is handed, as AIKit does.

use oi_cli::agent_participation::{
    compose_participation, human_card, ParticipationRequest, Product, ProductRunner, RunFailure,
    CITIZENSHIP_DIMENSIONS,
};
use serde_json::{json, Value};
use std::cell::RefCell;
use std::path::Path;

const AGENT: &str = "agent/aletheia";

struct Fake {
    profile: RefCell<Value>,
    accepted: bool,
    aikit_available: bool,
    /// Every AIKit member a SkillSet resolves to; `internal` members are
    /// carried but never publicly disclosed.
    calls: RefCell<Vec<String>>,
}

impl Fake {
    fn new() -> Self {
        Fake {
            profile: RefCell::new(json!({
                "agent_ref": AGENT,
                "computer_access_intent_refs": [],
                "governance_refs": [],
                "intent_provenance": {
                    "authorship": "generated-proposal",
                    "intent_expression": "Keep the gate honest: check each QL claim before it lands.",
                    "origin_action": "agent-profile.express",
                    "recognition": "unrecognised",
                    "schema": "central.agent-profile-provenance/v1"
                },
                "knowledge_source_refs": [],
                "method_refs": ["method/ql/gate-review"],
                "name": "Aletheia",
                "placement_intent_refs": [],
                "provenance_refs": [],
                "purpose": "Lead the Aletheia team: gate QL, M and S claims before they land.",
                "ratified_world_refs": ["control:root"],
                "ref": "profile/aletheia",
                "revision": "r3",
                "role": "team-lead",
                "routine_refs": [],
                "schema": "central.agent-profile/v1",
                "scope": "personal",
                "skill_refs": ["skill/ql/aletheia-ql-gate"],
                "skill_set_refs": ["skill-set/aletheia-gates"],
                "source_profile_ref": null,
                "world_ref": "control:root"
            })),
            accepted: true,
            aikit_available: true,
            calls: RefCell::new(Vec::new()),
        }
    }

    fn roster(&self) -> Value {
        let profile = self.profile.borrow().clone();
        json!({"ok": true, "status": "success", "action": "agent-profile.roster", "data": {
            "execution_authority_granted": false,
            "schema": "central.agent-profile-roster/v1",
            "scope_ref": "control:root",
            "profiles": [
                {"acceptance": null, "accepted": false, "content_digest": "sha256:aa",
                 "execution_authority_granted": false,
                 "profile": {"agent_ref": "agent/anima", "ref": "profile/anima", "revision": "r1",
                    "schema": "central.agent-profile/v1", "world_ref": "control:root",
                    "ratified_world_refs": ["control:root"], "skill_set_refs": [], "skill_refs": [],
                    "method_refs": [], "scope": "personal", "role": "team-lead"},
                 "schema": "central.agent-profile-review/v1", "scope_ref": "control:root",
                 "source_path": "Control/agents/profiles/anima.json"},
                {"acceptance": if self.accepted { json!({
                    "acceptance_ref": "central:acceptance:aletheia-r3",
                    "accepted_at_unix_seconds": 1790200000u64, "agent_ref": AGENT,
                    "authority_ref": "central:source:control:root:Control/user/native-action-authority.json",
                    "authority_revision": "r9", "content_digest": "sha256:bb",
                    "principal_ref": "central:source:control:root:Control/user/identity",
                    "profile_ref": "profile/aletheia", "profile_revision": "r3",
                    "schema": "central.agent-profile-acceptance/v1", "scope_ref": "control:root"}) } else { Value::Null },
                 "accepted": self.accepted, "content_digest": "sha256:bb",
                 "execution_authority_granted": false, "profile": profile,
                 "schema": "central.agent-profile-review/v1", "scope_ref": "control:root",
                 "source_path": "Control/agents/profiles/aletheia.json"}
            ]
        }})
    }

    fn positions(project: &str) -> Value {
        let rows = match project {
            "O-I" => json!([
                {"record": {"eligible_agent_refs": [AGENT], "enclosing_world_ref": "project:O-I",
                    "handle": "@aletheia-5", "label": "Aletheia 5", "purpose": "Aletheia team lead",
                    "ref": "central:position:project:O-I:aletheia-5", "revision": "r2",
                    "role_ref": "role:team-lead", "schema": "central.world-position/v1", "slug": "aletheia-5"},
                 "source": {"path": "Work/O-I/ProjectCentral/relations/positions/aletheia-5.json",
                    "ref": "central:source:project:O-I:ProjectCentral/relations/positions/aletheia-5.json",
                    "revision": "central.content-fnv1a64/v1:600:0123456789abcdef"}},
                {"record": {"eligible_agent_refs": ["agent/anima"], "enclosing_world_ref": "project:O-I",
                    "handle": "@anima-4", "label": "Anima 4", "purpose": "Anima team lead",
                    "ref": "central:position:project:O-I:anima-4", "revision": "r2",
                    "schema": "central.world-position/v1", "slug": "anima-4"},
                 "source": {"path": "Work/O-I/ProjectCentral/relations/positions/anima-4.json",
                    "ref": "central:source:project:O-I:ProjectCentral/relations/positions/anima-4.json",
                    "revision": "central.content-fnv1a64/v1:600:fedcba9876543210"}}
            ]),
            "Factory" => json!([
                {"record": {"eligible_agent_refs": ["agent/oh-i"], "enclosing_world_ref": "project:Factory",
                    "handle": "@factory-sensing-guardian", "label": "Factory sensing guardian",
                    "purpose": "Carry bounded Factory defects.",
                    "ref": "central:position:project:Factory:factory-sensing-guardian", "revision": "r1",
                    "schema": "central.world-position/v1", "slug": "factory-sensing-guardian"},
                 "source": {"path": "Work/Factory/ProjectCentral/relations/positions/factory-sensing-guardian.json",
                    "ref": "central:source:project:Factory:ProjectCentral/relations/positions/factory-sensing-guardian.json",
                    "revision": "central.content-fnv1a64/v1:500:1111111111111111"}}
            ]),
            _ => json!([]),
        };
        let world = if project.is_empty() {
            "control:root".to_owned()
        } else {
            format!("project:{project}")
        };
        json!({"ok": true, "status": "success", "action": "central.position.list", "data": {
            "inherited": [], "invalid": [], "positions": rows,
            "schema": "central.position-listing/v1", "world_ref": world}})
    }

    fn occupancy() -> Value {
        json!({
            "schema": "actuation.position-occupancy-listing/v1",
            "store": "/Users/admin/.actuation/occupancy",
            "positions": [
                {"position_ref": "central:position:project:O-I:aletheia-5", "state": "occupied",
                 "current": {"schema": "actuation.position-tenure/v1",
                    "position_ref": "central:position:project:O-I:aletheia-5",
                    "generation_ref": "actuation:generation:aaaaaaaa-0000-0000-0000-000000000001",
                    "generation_ordinal": 1, "kind": "initial", "agent_ref": AGENT,
                    "agency_ref": "agency:aletheia:project-O-I", "workcell_ref": "workcell:mac",
                    "gateway_address": "http://127.0.0.1:7777/a2a",
                    "began_at_unix_ms": 1790250771844u64, "reason": "Lead the gate"},
                 "presence": {"generation_ref": "actuation:generation:aaaaaaaa-0000-0000-0000-000000000001",
                    "presence": "active", "attention": "reviewing S claims", "at_unix_ms": 1790250800000u64},
                 "generation_count": 1},
                {"position_ref": "central:position:project:O-I:anima-4", "state": "occupied",
                 "current": {"schema": "actuation.position-tenure/v1",
                    "position_ref": "central:position:project:O-I:anima-4",
                    "generation_ref": "actuation:generation:bbbbbbbb-0000-0000-0000-000000000002",
                    "generation_ordinal": 2, "kind": "handover", "agent_ref": "agent/anima",
                    "agency_ref": "agency:anima:project-O-I",
                    "began_at_unix_ms": 1790250000000u64, "reason": "Lead Anima"},
                 "generation_count": 2},
                {"position_ref": "central:position:project:Factory:factory-sensing-guardian", "state": "occupied",
                 "current": {"schema": "actuation.position-tenure/v1",
                    "position_ref": "central:position:project:Factory:factory-sensing-guardian",
                    "generation_ref": "actuation:generation:ce03411b-c971-49a3-a908-84c3514487c4",
                    "generation_ordinal": 1, "kind": "initial", "agent_ref": "agent/oh-i",
                    "agency_ref": "agency:factory-sensing:project-Factory:child-now",
                    "began_at_unix_ms": 1790250771844u64, "reason": "Carry the Factory child NOW repair"},
                 "generation_count": 1},
                {"position_ref": "central:position:project:O-I:aikit-guardian", "state": "vacant", "generation_count": 1}
            ],
            "invalid": []
        })
    }

    fn here(project: &str) -> Value {
        json!({"ok": true, "status": "success", "action": "central.world.here", "data": {
            "schema": "central.world-here/v1",
            "local_world": {"ref": "control:root", "root": "/tmp/central-fixture"},
            "project_world": {"name": project, "path": format!("Work/{project}"), "ref": format!("project:{project}"), "state": "present"},
            "workcells": [{"ref": "workcell:mac", "role": "current"}]
        }})
    }

    fn custody(position: &str) -> Value {
        let rows = if position == "central:position:project:O-I:aletheia-5" {
            json!([{"schema": "factory.work-custody/v1",
                "custody_ref": "factory:custody:01a0d2e7-2666-7226-a8d0-4eb04ca2c2be",
                "position_ref": position, "work_ref": "factory:signal:017d55dd",
                "run_ref": "run:01M39EE9ER8HCKE05XJKWAYKYK", "journey_ref": "journey:01M39EE9ER130RMKG2BE5MAYS3",
                "state": "in-progress", "assigned_at_unix_ms": 1790244759142u64,
                "reason": "Verified source-qualified defect", "revision": 1,
                "updated_at_unix_ms": 1790244759142u64, "transitions": []}])
        } else {
            json!([])
        };
        json!({"schema": "factory.work-custody-listing/v1", "project_ref": "project:000000000074QF145PBHN82HYT",
            "filter": {"position_ref": position, "run_ref": null, "state": null},
            "count": rows.as_array().unwrap().len(), "custody": rows})
    }

    /// AIKit resolves SkillSets from the profile file it is handed.
    fn disclose(profile_file: &Path) -> Value {
        let read: Value = serde_json::from_slice(&std::fs::read(profile_file).unwrap()).unwrap();
        let profile = &read["profile"];
        let mut sets = Vec::new();
        let mut praxis = Vec::new();
        for set in profile["skill_set_refs"].as_array().unwrap() {
            let set = set.as_str().unwrap();
            let members: Vec<(&str, &str, &str)> = match set {
                "skill-set/aletheia-gates" => vec![
                    ("skill/ql/aletheia-ql-gate", "QL gate", "skill"),
                    (
                        "skill/ql/aletheia-internal-ledger",
                        "Internal ledger",
                        "skill",
                    ),
                    ("method/ql/gate-review", "Gate review", "method"),
                ],
                "skill-set/aletheia-orientation" => vec![(
                    "methodology/ql/sixfold",
                    "Sixfold orientation",
                    "methodology",
                )],
                _ => vec![],
            };
            sets.push(
                json!({"ref": set, "resolved": true, "origin": "aikit", "description": "",
                "revision": "rev-1", "members": members.iter().map(|m| m.0).collect::<Vec<_>>(),
                "children": [], "withheld": []}),
            );
            for (id, name, form) in members {
                praxis.push(
                    json!({"id": id, "name": name, "form": form, "position": 1, "payload": "",
                    "revision": "rev-1", "via": [format!("set:{set}")],
                    "involvement": {"carried": true, "catalogued": true, "available": true,
                        "selected": false, "projected": null, "loaded": null, "invoked": null,
                        "relied_upon": null, "succeeded": null, "verified": null},
                    "withheld_reason": null}),
                );
            }
        }
        json!({"schema": "aikit.agent-praxis-disclosure/v1",
            "agent": {"agent_ref": profile["agent_ref"], "profile_ref": profile["ref"],
                "profile_revision": profile["revision"], "name": profile["name"]},
            "expression": {}, "repertoire": {"authored_skill_sets": sets,
                "effective_skill_sets": profile["skill_set_refs"], "direct_skill_refs": profile["skill_refs"],
                "method_refs": profile["method_refs"], "unresolved": []},
            "praxis": praxis,
            "world": {"world_ref": profile["world_ref"], "ratified_world_refs": profile["ratified_world_refs"], "scope": "personal"},
            "operative": {"context_id": null, "selected": [], "loaded": [], "invoked": [], "evidence_refs": []},
            "return": {"destinations": ["central:now:control:root"], "activity_refs": [], "source_rewritten": false},
            "answers": {}})
    }
}

impl ProductRunner for Fake {
    fn run(
        &self,
        product: Product,
        args: &[String],
        cwd: Option<&Path>,
    ) -> Result<Value, RunFailure> {
        self.calls
            .borrow_mut()
            .push(format!("{:?} {}", product, args.join(" ")));
        match product {
            Product::Central => {
                let action = args[3].as_str();
                let input: Value = serde_json::from_str(&args[4]).unwrap();
                match action {
                    "agent-profile.roster" => {
                        if input["scope"] == "root" {
                            Ok(self.roster())
                        } else {
                            Ok(
                                json!({"ok": true, "data": {"profiles": [], "schema": "central.agent-profile-roster/v1"}}),
                            )
                        }
                    }
                    "agent-profile.read" => {
                        Ok(json!({"ok": true, "status": "success", "action": action,
                        "data": {"profile": self.profile.borrow().clone(), "source_path": "Control/agents/profiles/aletheia.json"}}))
                    }
                    "central.position.list" => {
                        Ok(Fake::positions(input["project"].as_str().unwrap_or("")))
                    }
                    "central.world.here" => Ok(Fake::here(input["project"].as_str().unwrap())),
                    other => panic!("unexpected Central action {other}"),
                }
            }
            Product::AiKit => {
                if !self.aikit_available {
                    return Err(RunFailure {
                        command: format!("aikit {}", args.join(" ")),
                        kind: "unsupported",
                        detail: "error: unrecognized subcommand 'praxis'".into(),
                    });
                }
                assert_eq!(
                    &args[..4],
                    ["--json", "praxis", "disclose", "--profile-json"]
                );
                Ok(Fake::disclose(Path::new(&args[4])))
            }
            Product::Actuation => {
                assert_eq!(args, ["occupancy", "list", "--json"]);
                Ok(Fake::occupancy())
            }
            Product::Factory => {
                // Factory reads run inside the World's Project tree, which
                // Central's world.here disclosed.
                let project = args[4].split(':').nth(3).unwrap();
                let expected = format!("/tmp/central-fixture/Work/{project}");
                assert_eq!(cwd, Some(Path::new(&expected)));
                Ok(Fake::custody(&args[4]))
            }
            Product::Workcell => panic!("Workcell is read through tenure.workcell_ref"),
        }
    }
}

fn participation(fake: &Fake, world: Option<&str>) -> Value {
    let scratch = tempfile::tempdir().unwrap();
    compose_participation(
        fake,
        &ParticipationRequest {
            agent_ref: AGENT,
            world_ref: world,
            scratch_dir: scratch.path(),
        },
    )
    .unwrap()
}

fn state(p: &Value, dim: &str) -> String {
    p["citizenship"][dim]["state"].as_str().unwrap().to_owned()
}

#[test]
fn participation_composes_profile_occupied_position_and_tenure_presence() {
    let fake = Fake::new();
    let p = participation(&fake, Some("project:O-I"));
    assert_eq!(p["schema"], "oi.agent-world-participation/v1");
    assert_eq!(p["agent_ref"], AGENT);
    assert_eq!(p["world_ref"], "project:O-I");
    assert_eq!(p["profile"]["ref"], "profile/aletheia");
    assert_eq!(p["profile"]["revision"], "r3");
    assert_eq!(
        p["roles"]["occupied"][0]["position_ref"],
        "central:position:project:O-I:aletheia-5"
    );
    assert_eq!(
        p["roles"]["eligible"][0]["source_ref"],
        "central:source:project:O-I:ProjectCentral/relations/positions/aletheia-5.json"
    );
    assert_eq!(p["availability"]["presence"][0]["presence"], "active");
    assert_eq!(
        p["material_presence"]["workcell_refs"],
        json!(["workcell:mac"])
    );
    assert_eq!(p["interaction_surfaces"][0]["kind"], "gateway");
    assert_eq!(
        p["relations"]["co_occupants"][0]["agent_ref"],
        "agent/anima"
    );
    assert_eq!(p["recognition"]["accepted"], true);
    assert_eq!(p["contribution"]["custody"][0]["state"], "in-progress");

    // Every dimension is present, carries a state from the closed set, a
    // basis and a one-line reading; there is no scalar anywhere.
    for dim in CITIZENSHIP_DIMENSIONS {
        let d = &p["citizenship"][dim];
        assert!(
            ["established", "partial", "absent", "unavailable"]
                .contains(&d["state"].as_str().unwrap()),
            "{dim}"
        );
        assert!(d["basis"].is_array(), "{dim}");
        assert!(!d["reading"].as_str().unwrap().is_empty(), "{dim}");
    }
    assert_eq!(p["citizenship"].as_object().unwrap().len(), 11);
    assert!(p.get("citizenship_score").is_none());
    assert_eq!(state(&p, "role"), "established");
    assert_eq!(state(&p, "residence"), "partial"); // O-I inherits the ratified control:root
    assert_eq!(state(&p, "repertoire"), "established");
    assert_eq!(state(&p, "authority"), "partial"); // Agency bound; grants unreadable
    assert_eq!(state(&p, "relation"), "established");
    assert_eq!(state(&p, "contribution"), "partial");
    assert_eq!(state(&p, "recognition"), "established");
    assert_eq!(state(&p, "continuity"), "partial");
    assert_eq!(
        p["citizenship"]["recognition"]["basis"],
        json!(["central:acceptance:aletheia-r3"])
    );

    // O:I composes: every owner read is retained as evidence.
    let owners: Vec<&str> = p["evidence"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["owner"].as_str().unwrap())
        .collect();
    for owner in ["central", "aikit", "actuation", "factory"] {
        assert!(owners.contains(&owner), "{owner} missing from {owners:?}");
    }
}

#[test]
fn one_agent_in_two_worlds_has_two_readings_and_one_identity() {
    let fake = Fake::new();
    let oi = participation(&fake, Some("project:O-I"));
    let factory = participation(&fake, Some("project:Factory"));
    assert_eq!(oi["agent_ref"], factory["agent_ref"]);
    assert_eq!(oi["profile"], factory["profile"]);
    assert_ne!(oi["world_ref"], factory["world_ref"]);
    assert_ne!(oi["citizenship"], factory["citizenship"]);
    assert_eq!(state(&oi, "role"), "established");
    assert_eq!(state(&factory, "role"), "absent");
    assert_eq!(state(&factory, "relation"), "partial"); // agent/oh-i occupies beside it
    assert_eq!(factory["roles"]["occupied"], json!([]));
    // The home World is a third, distinct reading of the same identity.
    let home = participation(&fake, None);
    assert_eq!(home["world_ref"], "control:root");
    assert_eq!(state(&home, "residence"), "established");
    assert_eq!(home["agent_ref"], AGENT);
}

#[test]
fn unavailable_aikit_marks_repertoire_and_reach_unavailable_naming_the_command() {
    let mut fake = Fake::new();
    fake.aikit_available = false;
    let p = participation(&fake, Some("project:O-I"));
    for dim in ["repertoire", "reach", "reliability"] {
        let d = &p["citizenship"][dim];
        assert_eq!(d["state"], "unavailable", "{dim}");
        let command = d["command"].as_str().unwrap();
        assert!(
            command.starts_with("aikit --json praxis disclose --profile-json "),
            "{command}"
        );
        assert!(d["reading"]
            .as_str()
            .unwrap()
            .contains("aikit --json praxis disclose"));
    }
    assert_eq!(p["repertoire"]["state"], "unavailable");
    // Other owners still answer; one missing owner does not blank the reading.
    assert_eq!(state(&p, "role"), "established");
    let card = human_card(&p);
    assert_eq!(card["what_i_can_do"]["state"], "unavailable");
    assert_eq!(card["what_i_can_do"]["standing"], "authored-unresolved");
    assert_eq!(
        card["citizenship"]["dimensions"]["repertoire"]["state"],
        "unavailable"
    );
}

#[test]
fn changing_skill_set_refs_changes_what_i_carry_without_a_second_state_file() {
    let fake = Fake::new();
    let scratch = tempfile::tempdir().unwrap();
    let before = human_card(
        &compose_participation(
            &fake,
            &ParticipationRequest {
                agent_ref: AGENT,
                world_ref: Some("project:O-I"),
                scratch_dir: scratch.path(),
            },
        )
        .unwrap(),
    );
    assert_eq!(
        before["what_i_carry"]["refs"],
        json!(["skill-set/aletheia-gates@rev-1"])
    );
    assert!(before["how_i_orient"].is_null());

    // The only change is Central's profile — the single identity source.
    fake.profile.borrow_mut()["skill_set_refs"] =
        json!(["skill-set/aletheia-gates", "skill-set/aletheia-orientation"]);
    let after = human_card(
        &compose_participation(
            &fake,
            &ParticipationRequest {
                agent_ref: AGENT,
                world_ref: Some("project:O-I"),
                scratch_dir: scratch.path(),
            },
        )
        .unwrap(),
    );
    assert_eq!(
        after["what_i_carry"]["refs"],
        json!([
            "skill-set/aletheia-gates@rev-1",
            "skill-set/aletheia-orientation@rev-1"
        ])
    );
    assert_eq!(
        after["how_i_orient"]["refs"],
        json!(["methodology/ql/sixfold"])
    );
    assert_eq!(after["identity"], before["identity"]);
    // Nothing was left behind: no card or participation file is kept.
    assert_eq!(std::fs::read_dir(scratch.path()).unwrap().count(), 0);
}

#[test]
fn public_section_never_carries_internal_members_absent_from_public_disclosure() {
    // No public disclosure source: internal repertoire is not public.
    let fake = Fake::new();
    let p = participation(&fake, Some("project:O-I"));
    assert_eq!(p["public_capabilities"], json!([]));
    assert_eq!(p["disclosure"]["public_basis"], "none-declared");
    let card = human_card(&p);
    assert_eq!(card["public"]["capabilities"], json!([]));
    assert!(!card["public"]
        .to_string()
        .contains("aletheia-internal-ledger"));
    // The internal member is still visible as internal repertoire.
    assert!(card["what_i_can_do"]["refs"]
        .to_string()
        .contains("aletheia-internal-ledger"));

    // With an explicit public disclosure, only the declared, carried member
    // reaches the public section.
    fake.profile.borrow_mut()["public_skill_refs"] =
        json!(["skill/ql/aletheia-ql-gate", "skill/ql/not-carried"]);
    let p = participation(&fake, Some("project:O-I"));
    assert_eq!(p["disclosure"]["public_basis"], "profile-declared");
    let ids: Vec<&str> = p["public_capabilities"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["id"].as_str().unwrap())
        .collect();
    assert_eq!(ids, ["skill/ql/aletheia-ql-gate"]);
    let card = human_card(&p);
    let public = card["public"].to_string();
    assert!(public.contains("aletheia-ql-gate"));
    assert!(!public.contains("aletheia-internal-ledger"));
    assert!(!public.contains("not-carried"));
}

#[test]
fn human_card_carries_every_field_with_refs() {
    let fake = Fake::new();
    let card = human_card(&participation(&fake, Some("project:O-I")));
    assert_eq!(card["schema"], "oi.human-agent-card/v1");
    assert_eq!(card["identity"]["name"], "Aletheia");
    assert_eq!(card["identity"]["agent_ref"], AGENT);
    assert_eq!(card["identity"]["profile_ref"], "profile/aletheia");
    assert_eq!(card["identity"]["revision"], "r3");
    for field in [
        "identity",
        "why_im_here",
        "what_i_can_do",
        "how_i_work",
        "what_i_carry",
        "where_i_participate",
        "citizenship",
        "currently",
    ] {
        assert!(card[field]["refs"].is_array(), "{field} has no refs");
    }
    assert_eq!(card["how_i_work"]["refs"], json!(["method/ql/gate-review"]));
    assert!(card["citizenship"]["summary"]
        .as_str()
        .unwrap()
        .contains("in project:O-I"));
    assert_eq!(
        card["citizenship"]["dimensions"].as_object().unwrap().len(),
        11
    );
    assert!(card["currently"]["text"]
        .as_str()
        .unwrap()
        .starts_with("active"));
}

#[test]
fn unknown_agent_is_a_three_part_refusal_not_an_invented_identity() {
    let fake = Fake::new();
    let scratch = tempfile::tempdir().unwrap();
    let refusal = compose_participation(
        &fake,
        &ParticipationRequest {
            agent_ref: "agent/nobody",
            world_ref: None,
            scratch_dir: scratch.path(),
        },
    )
    .unwrap_err();
    assert_eq!(refusal.code, "participation.agent_not_found");
    assert!(refusal.action.contains("agent-profile.roster"));
}

#[test]
fn participation_carries_the_exact_fields_aikit_a2a_builder_reads() {
    let fake = Fake::new();
    fake.profile.borrow_mut()["public_skill_refs"] = json!(["skill/ql/aletheia-ql-gate"]);
    let p = participation(&fake, Some("project:O-I"));
    assert_eq!(
        p["participation_ref"],
        "oi:participation:agent/aletheia@project:O-I#profile/aletheia@r3"
    );
    assert_eq!(p["profile"]["name"], "Aletheia");
    assert_eq!(p["expression"]["name"], "Aletheia");
    assert!(p["expression"]["purpose"].is_string());
    let cap = &p["public_capabilities"][0];
    for field in ["id", "name", "description"] {
        assert!(!cap[field].as_str().unwrap().is_empty(), "{field}");
    }
    assert!(cap["tags"].is_array());
    let d = &p["disclosure"];
    assert_eq!(d["extended_card_served"], false);
    for field in [
        "provider",
        "documentation_url",
        "icon_url",
        "security_schemes",
    ] {
        assert!(d.get(field).is_some(), "{field}");
    }
    assert_eq!(d["security_requirements"], json!([]));
    let args = oi_cli::agent_participation::a2a_card_args(
        Path::new("/tmp/p.json"),
        "https://example.test/a2a",
    );
    assert_eq!(
        args,
        [
            "--json",
            "a2a",
            "card",
            "--participation-json",
            "/tmp/p.json",
            "--interface-url",
            "https://example.test/a2a"
        ]
    );
}
