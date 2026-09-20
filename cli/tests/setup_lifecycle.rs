//! Controlled owner-protocol tests, not an installed suite/provider claim.
//! Production setup has no fixture switch. Native filesystem/CLI tests below
//! run the actual oi binary in a disposable HOME.
use oi_cli::setup::*;
use serde_json::{json, Value};
use std::collections::BTreeSet;
fn discovery() -> Discovery {
    Discovery {
        schema: SCHEMA.into(),
        basis: "world-revision-one".into(),
        data_root: "/owned/oi".into(),
        composition_path: "/owned/state/composition.json".into(),
        target: "controlled".into(),
        bound_ground: None,
        suggested_ground: "/owned/Central".into(),
        selected_ground: Some("/owned/Central".into()),
        ground: json!({"outcome":"new"}),
        products: oi_cli::current_world::PRODUCT_POSITIONS
            .iter()
            .map(|(_, id, title)| Product {
                id: (*id).into(),
                title: (*title).into(),
                purpose: "native test owner".into(),
                registered: false,
                present: false,
                managed: false,
                existing_executable: None,
                existing_digest: None,
                offer: Some(json!({"revision":"pinned","authority":"test-bound"})),
                unavailable_reason: None,
            })
            .collect(),
        desktop: json!({"state":"absent"}),
        choices: choices(),
        warnings: vec![],
        recognition: json!({"observed_at":1}),
    }
}
fn planned() -> Plan {
    plan(Selection::default(), discovery(), Ok(None), 1000).unwrap()
}
#[derive(Default)]
struct MemoryStore {
    snapshots: Vec<Journal>,
    fail_at: Option<usize>,
}
impl JournalStore for MemoryStore {
    fn save(&mut self, j: &Journal) -> Result<(), String> {
        if self.fail_at == Some(self.snapshots.len()) {
            return Err("durability failure".into());
        }
        self.snapshots.push(j.clone());
        Ok(())
    }
}
struct Owner {
    fresh: Plan,
    invocations: usize,
    reads: usize,
    fail_invocation: Option<usize>,
    unreadable: bool,
    applied: BTreeSet<usize>,
    drift_before: Option<usize>,
}
impl Owner {
    fn new(fresh: Plan) -> Self {
        Self {
            fresh,
            invocations: 0,
            reads: 0,
            fail_invocation: None,
            unreadable: false,
            applied: BTreeSet::new(),
            drift_before: None,
        }
    }
}
impl Runtime for Owner {
    fn refresh_plan(&mut self, _: &Plan) -> Result<Plan, String> {
        Ok(self.fresh.clone())
    }
    fn preflight(&mut self, _: &Step, _: &Plan) -> Result<(), String> {
        if self.drift_before == Some(self.invocations) {
            Err("external native edit before next operation".into())
        } else {
            Ok(())
        }
    }
    fn invoke(&mut self, step: &Step, plan: &Plan) -> Result<Value, String> {
        let index = plan.steps.iter().position(|s| s == step).unwrap();
        self.applied.insert(index);
        self.invocations += 1;
        if self.fail_invocation == Some(self.invocations) {
            Err("lost response after real owner effect".into())
        } else {
            Ok(json!({"native_receipt":index}))
        }
    }
    fn verify(&mut self, step: &Step, plan: &Plan, _: Option<&Value>) -> Result<Value, String> {
        self.reads += 1;
        let index = plan.steps.iter().position(|s| s == step).unwrap();
        if self.unreadable || !self.applied.contains(&index) {
            Err("owner unavailable".into())
        } else {
            Ok(json!({"actual_effect":index}))
        }
    }
}
#[test]
fn clean_operational_composition_is_not_maximal_suite() {
    let p = planned();
    assert!(p.blocked.is_empty());
    assert_eq!(p.steps.len(), 5);
    assert_eq!(
        p.steps[0].operation,
        Operation::InstallProduct {
            product: "central".into()
        }
    );
    assert_eq!(
        p.steps[2].operation,
        Operation::InstallProduct {
            product: "ai-kit".into()
        }
    );
    assert!(matches!(
        p.steps[3].operation,
        Operation::EstablishGround { .. }
    ));
    assert!(!p.steps.iter().any(|s|matches!(&s.operation,Operation::InstallProduct{product} if product=="software-factory"||product=="quaternal-logic")));
}
#[test]
fn hosted_reading_never_becomes_a_local_install() {
    let p = plan(
        Selection {
            composition: "5/0".into(),
            ..Default::default()
        },
        discovery(),
        Err("no Desktop asset".into()),
        1000,
    )
    .unwrap();
    assert!(p.steps.is_empty());
    assert!(p.blocked.is_empty());
    assert!(choices()
        .iter()
        .find(|c| c.hosted)
        .unwrap()
        .products
        .is_empty());
}
#[test]
fn hosted_entry_cannot_smuggle_local_teardown() {
    let p = plan(
        Selection {
            composition: "5/0".into(),
            desktop: DesktopChoice::Remove,
            ..Default::default()
        },
        discovery(),
        Ok(None),
        1000,
    )
    .unwrap();
    assert!(!p.blocked.is_empty());
    assert!(p.steps.is_empty());
}
#[test]
fn existing_ground_and_unselected_products_are_retained() {
    let mut d = discovery();
    d.bound_ground = Some("/owned/Central".into());
    d.ground = json!({"outcome":"recognized","access":{"readable":true,"searchable":true}});
    for p in &mut d.products {
        p.present = true;
        p.registered = true;
    }
    let p = plan(Selection::default(), d, Ok(None), 1000).unwrap();
    assert_eq!(p.steps.len(), 1);
    assert_eq!(p.steps[0].operation, Operation::RecordComposition);
}
#[test]
fn missing_optional_product_never_blocks_an_independent_selection() {
    let mut d = discovery();
    for p in &mut d.products {
        p.offer = None;
    }
    d.products[4].existing_executable = Some("/native/workcell".into());
    d.products[4].existing_digest = Some("digest".into());
    let p = plan(
        Selection {
            composition: "custom".into(),
            products: vec!["workcell".into()],
            ..Default::default()
        },
        d,
        Ok(None),
        1000,
    )
    .unwrap();
    assert!(p.blocked.is_empty());
    assert_eq!(p.steps.len(), 2);
    assert!(matches!(
        p.steps[0].operation,
        Operation::RegisterExisting { .. }
    ));
}
#[test]
fn absent_build_capability_is_explicitly_blocked() {
    let mut d = discovery();
    d.products[0].offer = None;
    let p = plan(Selection::default(), d, Ok(None), 1000).unwrap();
    assert!(!p.blocked.is_empty());
}
#[test]
fn desktop_removal_keeps_the_world_and_native_footprint_plan() {
    let native = json!({"resource":"receipt-owned-app","never_owned":["Central","Agents"]});
    let p = plan(
        Selection {
            composition: "custom".into(),
            desktop: DesktopChoice::Remove,
            ..Default::default()
        },
        discovery(),
        Ok(Some(native.clone())),
        1000,
    )
    .unwrap();
    assert!(p.blocked.is_empty());
    assert_eq!(p.steps[0].operation, Operation::RemoveDesktop);
    assert_eq!(p.steps[0].native_plan, Some(native));
    assert!(!p.steps.iter().any(|s| matches!(
        s.operation,
        Operation::RemoveProduct { .. } | Operation::EstablishGround { .. }
    )));
}
#[test]
fn foreign_installation_is_never_removed() {
    let p = plan(
        Selection {
            composition: "custom".into(),
            remove_products: vec!["workcell".into()],
            ..Default::default()
        },
        discovery(),
        Ok(None),
        1000,
    )
    .unwrap();
    assert!(p.blocked.iter().any(|b| b.contains("pre-existing")));
}
#[test]
fn exact_plan_approval_is_required() {
    let p = planned();
    let mut owner = Owner::new(p.clone());
    assert!(apply(&mut owner, &mut MemoryStore::default(), p, "wrong", 1001).is_err());
    assert_eq!(owner.invocations, 0);
}
#[test]
fn changed_effects_and_expired_plans_never_invoke() {
    let p = planned();
    let approval = p.review_token.clone();
    let mut tampered = p.clone();
    tampered.steps[0]
        .effects
        .push("additional authority".into());
    let mut owner = Owner::new(p.clone());
    assert!(apply(
        &mut owner,
        &mut MemoryStore::default(),
        tampered,
        &approval,
        1001
    )
    .is_err());
    assert!(apply(
        &mut owner,
        &mut MemoryStore::default(),
        p.clone(),
        &approval,
        p.expires_at_unix_ms
    )
    .is_err());
    assert_eq!(owner.invocations, 0);
}
#[test]
fn external_cli_drift_stops_before_mutation() {
    let p = planned();
    let mut fresh = p.clone();
    fresh.discovery.basis = "new-native-revision".into();
    fresh.seal().unwrap();
    let mut owner = Owner::new(fresh);
    assert!(apply(
        &mut owner,
        &mut MemoryStore::default(),
        p.clone(),
        &p.review_token,
        1001
    )
    .is_err());
    assert_eq!(owner.invocations, 0);
}
#[test]
fn observation_timestamps_are_not_false_staleness() {
    let p = planned();
    let mut fresh = p.clone();
    fresh.discovery.recognition["observed_at"] = json!(900);
    fresh.seal().unwrap();
    assert_eq!(p.review_token, fresh.review_token);
    let mut owner = Owner::new(fresh);
    assert!(apply(
        &mut owner,
        &mut MemoryStore::default(),
        p.clone(),
        &p.review_token,
        1001
    )
    .unwrap()
    .complete());
}
#[test]
fn caller_metadata_is_never_used_instead_of_fresh_native_evidence() {
    let p = planned();
    let mut caller = p.clone();
    caller.discovery.products[0].offer = Some(json!({"build":["evil"]}));
    let mut owner = Owner::new(p.clone());
    let journal = apply(
        &mut owner,
        &mut MemoryStore::default(),
        caller,
        &p.review_token,
        1001,
    )
    .unwrap();
    assert_eq!(
        journal.plan.discovery.products[0].offer,
        p.discovery.products[0].offer
    );
}
#[test]
fn journal_is_durable_before_each_write() {
    let p = planned();
    let mut owner = Owner::new(p.clone());
    let mut store = MemoryStore {
        snapshots: vec![],
        fail_at: Some(1),
    };
    assert!(apply(&mut owner, &mut store, p.clone(), &p.review_token, 1001).is_err());
    assert_eq!(owner.invocations, 0);
    assert!(store.snapshots[0]
        .records
        .iter()
        .all(|r| r.state == StepState::Pending));
}
#[test]
fn lost_reply_rechecks_without_repeating_an_unknown_write() {
    let p = planned();
    let mut owner = Owner::new(p.clone());
    owner.fail_invocation = Some(1);
    let mut store = MemoryStore::default();
    let journal = apply(&mut owner, &mut store, p.clone(), &p.review_token, 1001).unwrap();
    assert_eq!(journal.disposition(), "outcome_unknown");
    assert!(store
        .snapshots
        .iter()
        .any(|j| j.records[0].state == StepState::Running));
    let restored: Journal = serde_json::from_slice(&serde_json::to_vec(&journal).unwrap()).unwrap();
    let checked = recheck(&mut owner, &mut store, restored, 2000).unwrap();
    assert_eq!(owner.invocations, 1);
    assert_eq!(checked.records[0].state, StepState::Verified);
    assert!(checked.records[1..]
        .iter()
        .all(|r| r.state == StepState::Pending));
}
#[test]
fn partial_apply_preserves_completed_owner_effects() {
    let p = planned();
    let mut owner = Owner::new(p.clone());
    owner.fail_invocation = Some(2);
    let j = apply(
        &mut owner,
        &mut MemoryStore::default(),
        p.clone(),
        &p.review_token,
        1001,
    )
    .unwrap();
    assert_eq!(j.records[0].state, StepState::Verified);
    assert_eq!(j.records[1].state, StepState::Unknown);
    assert_eq!(owner.invocations, 2);
}
#[test]
fn inter_operation_preflight_refusal_is_not_an_unknown_write() {
    let p = planned();
    let mut owner = Owner::new(p.clone());
    owner.drift_before = Some(1);
    let j = apply(
        &mut owner,
        &mut MemoryStore::default(),
        p.clone(),
        &p.review_token,
        1001,
    )
    .unwrap();
    assert_eq!(j.records[0].state, StepState::Verified);
    assert_eq!(j.records[1].state, StepState::Refused);
    assert_eq!(owner.invocations, 1);
}
#[test]
fn readback_loss_does_not_replay_known_applied_effect() {
    let p = planned();
    let mut owner = Owner::new(p.clone());
    owner.unreadable = true;
    let mut store = MemoryStore::default();
    let j = apply(&mut owner, &mut store, p.clone(), &p.review_token, 1001).unwrap();
    assert_eq!(j.records[0].state, StepState::Applied);
    let j = recheck(&mut owner, &mut store, j, 1100).unwrap();
    assert_eq!(owner.invocations, 1);
    assert_eq!(j.records[0].state, StepState::Applied);
    owner.unreadable = false;
    assert_eq!(
        recheck(&mut owner, &mut store, j, 1200).unwrap().records[0].state,
        StepState::Verified
    );
}
#[test]
fn later_owner_drift_removes_previously_verified_standing() {
    let p = planned();
    let mut owner = Owner::new(p.clone());
    let mut store = MemoryStore::default();
    let j = apply(&mut owner, &mut store, p.clone(), &p.review_token, 1001).unwrap();
    assert!(j.complete());
    owner.unreadable = true;
    let j = recheck(&mut owner, &mut store, j, 1100).unwrap();
    assert!(!j.complete());
    assert_eq!(j.disposition(), "partially_applied");
    assert_eq!(owner.invocations, p.steps.len());
}
#[test]
fn ordinary_discovery_is_read_only_in_a_clean_home() {
    let home = tempfile::TempDir::new().unwrap();
    let output = std::process::Command::new(env!("CARGO_BIN_EXE_oi"))
        .args(["setup", "discover", "--json"])
        .env_clear()
        .env("HOME", home.path())
        .env("OI_HOME", home.path().join("config"))
        .env("OI_DATA_HOME", home.path().join("data"))
        .env("PATH", "")
        .current_dir(home.path())
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["schema"], SCHEMA);
    assert_eq!(value["discovery"]["products"].as_array().unwrap().len(), 6);
    assert!(!home.path().join("config").exists());
    assert!(!home.path().join("data").exists());
    assert!(!home.path().join("Central").exists());
}
#[test]
fn production_adoption_rejects_configuration_fixture_transport() {
    let home = tempfile::TempDir::new().unwrap();
    let output = std::process::Command::new(env!("CARGO_BIN_EXE_oi"))
        .args(["setup", "discover", "--json"])
        .env("HOME", home.path())
        .env("OI_CONFIG_SURFACE_FIXTURES", home.path())
        .output()
        .unwrap();
    assert!(!output.status.success());
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["error"]["code"], "setup_refused");
    assert_eq!(value["write_retried"], false);
}
