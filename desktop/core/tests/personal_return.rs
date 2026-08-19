use oi_desktop_core::{
    BridgeCallClass, BridgeCaller, BridgePolicy, LocalCentralHost, LocalEpiHost,
    EPI_ANUTTARA_GROUND_ACTION_REF, EPI_EPII_REVIEW_ACTION_REF,
    EPI_PERSONAL_PROPOSAL_ACTION_REF,
};
use serde_json::json;
use std::env;

#[test]
fn sandboxed_contributions_cannot_enter_personal_dispatch() {
    let denied = BridgePolicy.authorize(
        BridgeCaller::SandboxedContribution,
        BridgeCallClass::DispatchEpiPersonalAction,
    );
    assert!(denied.is_err());
}

#[test]
fn personal_action_catalog_remains_epi_owned_and_is_not_a_generic_runtime() {
    let source = include_str!("../src/local_epi.rs");
    for action in [
        EPI_EPII_REVIEW_ACTION_REF,
        EPI_ANUTTARA_GROUND_ACTION_REF,
        EPI_PERSONAL_PROPOSAL_ACTION_REF,
    ] {
        assert!(source.contains(action));
    }
    for forbidden in ["EpiiRuntime", "EpiSession", "EpiHarness", "BimbaNeo4jRef"] {
        assert!(!source.contains(forbidden));
    }
}

#[cfg(unix)]
#[test]
fn central_now_receives_only_proposal_refs_and_can_reject_or_promote_only_explicit_human_source() {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::time::{SystemTime, UNIX_EPOCH};

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = env::temp_dir().join(format!("oi-central-personal-{nonce}"));
    fs::create_dir_all(&root).unwrap();
    let log = root.join("args.log");
    let script = root.join("ctrl-fixture.sh");
    let script_body = format!(
        r#"#!/bin/sh
printf '%s\n' "$@" > "{}"
action="$4"
case "$action" in
  projectcentral.now.inspect)
    printf '%s\n' '{{"ok":true,"status":"success","action":"projectcentral.now.inspect","data":{{"exists":true,"boundaries":["NOW is not canon"]}}}}'
    ;;
  projectcentral.now.return)
    printf '%s\n' '{{"ok":true,"status":"success","action":"projectcentral.now.return","data":{{"source":"ProjectCentral/now/agents/handoff-test.json","handoff":{{"id":"handoff-test","status":"waiting"}}}}}}'
    ;;
  projectcentral.now.update)
    printf '%s\n' '{{"ok":true,"status":"success","action":"projectcentral.now.update","data":{{"source":"ProjectCentral/now/agents/handoff-test.json","handoff":{{"id":"handoff-test","status":"resolved"}}}}}}'
    ;;
  projectcentral.now.promote)
    printf '%s\n' '{{"ok":true,"status":"success","action":"projectcentral.now.promote","data":{{"source":"ProjectCentral/now/user/accepted.md","target":"human-ground","destination":"ProjectCentral/user/accepted.md","sourcePreserved":true}}}}'
    ;;
  *)
    printf '%s\n' '{{"ok":false,"status":"invalid_input","error":{{"message":"unexpected action"}}}}'
    exit 2
    ;;
esac
"#,
        log.display()
    );
    fs::write(&script, script_body).unwrap();
    let mut permissions = fs::metadata(&script).unwrap().permissions();
    permissions.set_mode(0o700);
    fs::set_permissions(&script, permissions).unwrap();

    let central = LocalCentralHost::open(&script, "test-project");
    let inspection = central.inspect_now().expect("inspect NOW");
    assert_eq!(inspection["exists"], true);

    let proposal = json!({
        "schema": "epi.personal-proposal/v1",
        "proposalRef": "epi:personal:proposal:selection-test",
        "sourceClass": "proposal",
        "sourceMutationPerformed": false,
        "reviewRef": "epi:epii:review:selection-test",
        "groundRef": "epi:anuttara:ground:selection-test",
        "proposedContent": "PRIVATE PROPOSAL BODY MUST NOT ENTER CENTRAL ARGV",
        "subject": {
            "selectionRef": "epi:nara:selection:test:r1:0-7",
            "episodeRef": "epi:nara:episode:test",
            "coordinateRef": "epi:bimba:#-4/M4'"
        }
    });
    let returned = central
        .return_personal_proposal(&proposal)
        .expect("return proposal to NOW");
    assert_eq!(returned["handoff"]["status"], "waiting");
    let args = fs::read_to_string(&log).unwrap();
    assert!(args.contains("projectcentral.now.return"));
    assert!(args.contains("epi:personal:proposal:selection-test"));
    assert!(!args.contains("PRIVATE PROPOSAL BODY"));

    let rejected = central
        .reject_return("handoff-test", "epi:personal:proposal:selection-test")
        .expect("reject proposal");
    assert_eq!(rejected["handoff"]["status"], "resolved");

    let promoted = central
        .promote_human_source("ProjectCentral/now/user/accepted.md", "accepted.md")
        .expect("explicit human source recognition");
    assert_eq!(promoted["target"], "human-ground");
    let args = fs::read_to_string(&log).unwrap();
    assert!(args.contains("projectcentral.now.promote"));
    assert!(args.contains("human-accepted"));
    assert!(args.contains("ProjectCentral/now/user/accepted.md"));
}

#[test]
fn real_epi_personal_provider_round_trip_when_cross_repo_fixture_is_supplied() {
    let (Some(binary), Some(context), Some(vault)) = (
        env::var_os("EPI_BRIDGE_BIN"),
        env::var_os("EPI_NARA_CONTEXT"),
        env::var_os("EPI_NARA_VAULT"),
    ) else {
        eprintln!("real Personal provider env not supplied; dedicated cross-repository workflow owns this proof");
        return;
    };

    let host = LocalEpiHost::open(binary)
        .with_nara_context_file(context)
        .with_nara_vault_root(vault);
    let observation = host.observe().expect("host Personal Epi provider");
    for action in [
        EPI_EPII_REVIEW_ACTION_REF,
        EPI_ANUTTARA_GROUND_ACTION_REF,
        EPI_PERSONAL_PROPOSAL_ACTION_REF,
    ] {
        assert!(observation
            .contribution
            .contribution
            .actions
            .iter()
            .any(|binding| binding.action_ref == action));
    }
}
