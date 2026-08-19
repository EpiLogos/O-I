use oi_desktop_core::LocalCentralHost;
use serde_json::json;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn real_central_now_owner_keeps_agent_proposal_separate_from_human_ground() {
    let Some(executable) = env::var_os("CENTRAL_CTRL_BIN") else {
        eprintln!("CENTRAL_CTRL_BIN is not set; skipping real Central Personal-return acceptance");
        return;
    };
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = env::temp_dir().join(format!("oi-central-personal-{nonce}"));
    fs::create_dir_all(&root).unwrap();
    let host = LocalCentralHost::open(PathBuf::from(executable), "personal-ci").with_root(&root);

    let proposal = json!({
        "schema": "epi.personal-proposal/v1",
        "proposalRef": "epi:proposal:personal-ci",
        "sourceClass": "proposal",
        "adoptionState": "unreviewed",
        "sourceMutationPerformed": false,
        "subject": {
            "selectionRef": "epi:nara:selection:personal-ci",
            "episodeRef": "epi:nara:episode:2026-08-19",
            "coordinateRef": "epi:coordinate:m4:personal-ci"
        },
        "reviewRef": "epi:review:personal-ci",
        "groundRef": "epi:ground:personal-ci"
    });

    let returned = host
        .return_personal_proposal(&proposal)
        .expect("Central accepts the Agent proposal as a bounded NOW return");
    let handoff_id = returned
        .pointer("/handoff/id")
        .and_then(|value| value.as_str())
        .expect("Central return exposes a handoff id");
    assert_eq!(
        returned.pointer("/handoff/actor").and_then(|value| value.as_str()),
        Some("epi:agent:epii")
    );
    assert_eq!(
        returned.pointer("/handoff/status").and_then(|value| value.as_str()),
        Some("waiting")
    );

    let now = host.inspect_now().expect("Central NOW remains inspectable");
    let items = now
        .pointer("/active_items")
        .and_then(|value| value.as_array())
        .expect("Central NOW returns active Agent items");
    assert!(items.iter().any(|item| {
        item.pointer("/id").and_then(|value| value.as_str()) == Some(handoff_id)
            && item.pointer("/actor").and_then(|value| value.as_str()) == Some("epi:agent:epii")
    }));

    let resolved = host
        .reject_return(handoff_id, "epi:proposal:personal-ci")
        .expect("Central resolves the Agent return without adopting it");
    assert_eq!(
        resolved.pointer("/handoff/status").and_then(|value| value.as_str()),
        Some("resolved")
    );

    let now = host.inspect_now().expect("Central NOW remains inspectable after resolution");
    let active = now
        .pointer("/active_items")
        .and_then(|value| value.as_array())
        .expect("Central NOW keeps active_items typed");
    assert!(!active.iter().any(|item| {
        item.pointer("/id").and_then(|value| value.as_str()) == Some(handoff_id)
    }));

    let project_ground = root.join("Work/personal-ci/ProjectCentral/user");
    assert!(
        !project_ground.exists(),
        "resolving an Agent proposal must not create durable human project ground"
    );
}
