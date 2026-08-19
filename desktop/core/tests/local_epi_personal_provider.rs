use oi_desktop_core::{
    LocalEpiHost, EPI_ANUTTARA_GROUND_ACTION_REF, EPI_EPII_REVIEW_ACTION_REF,
    EPI_NARA_SENDOFF_ACTION_REF, EPI_PERSONAL_450_CONTRIBUTION_REF,
    EPI_PERSONAL_PROPOSAL_ACTION_REF,
};
use serde_json::json;
use std::env;
use std::path::PathBuf;

#[test]
fn real_epi_personal_provider_preserves_parent_and_bounded_child_identity() {
    let Some(executable) = env::var_os("EPI_BRIDGE_BIN") else {
        eprintln!("EPI_BRIDGE_BIN is not set; skipping real Epi provider acceptance");
        return;
    };
    let context = env::var_os("EPI_NARA_CONTEXT")
        .map(PathBuf::from)
        .expect("EPI_NARA_CONTEXT must accompany EPI_BRIDGE_BIN");
    let vault = env::var_os("EPI_NARA_VAULT")
        .map(PathBuf::from)
        .expect("EPI_NARA_VAULT must accompany EPI_BRIDGE_BIN");

    let epi = LocalEpiHost::open(PathBuf::from(executable))
        .with_nara_context_file(context)
        .with_nara_vault_root(vault);

    let written = epi
        .nara_write("alpha βeta personal return")
        .expect("real Epi Nara write succeeds");
    let episode_ref = written["episodeRef"].as_str().unwrap().to_owned();
    let revision = written["episodeRevision"].as_u64().unwrap();

    let observation = epi.observe_personal().expect("Personal parent observes");
    assert_eq!(
        observation.contribution.contribution.contribution_ref,
        EPI_PERSONAL_450_CONTRIBUTION_REF
    );
    assert_eq!(observation.application["subject"]["subjectRef"], episode_ref);
    assert_eq!(observation.application["subject"]["episodeRevision"], revision);
    assert_eq!(
        observation.application["subject"]["protectedBodyDisclosed"],
        false
    );
    assert_eq!(
        observation.application["eventBinding"]["parallelPersonalEventState"],
        false
    );
    assert_eq!(
        observation.application["eventBinding"]["bindableToEventRef"],
        true
    );
    assert!(observation.application["eventBinding"].get("eventRef").is_none());

    let actions = &observation.contribution.contribution.actions;
    for action_ref in [
        EPI_NARA_SENDOFF_ACTION_REF,
        EPI_EPII_REVIEW_ACTION_REF,
        EPI_ANUTTARA_GROUND_ACTION_REF,
        EPI_PERSONAL_PROPOSAL_ACTION_REF,
    ] {
        assert!(actions.iter().any(|action| action.action_ref == action_ref));
    }

    // UTF-8 byte range for `βeta`: alpha=5 + space=1, β=2 bytes, eta=3.
    let selection_request = json!({
        "episodeRef": episode_ref,
        "revision": revision,
        "startByte": 6,
        "endByte": 11
    });
    let selection = epi
        .nara_selection(selection_request.clone())
        .expect("exact governed selection resolves");
    assert_eq!(selection["episodeRef"], observation.application["subject"]["subjectRef"]);
    assert_eq!(selection["episodeRevision"], revision);
    assert_eq!(selection["selectedText"], "βeta");

    let review = epi
        .epii_review(json!({"selection": selection_request.clone(), "mode": "review"}))
        .expect("Epii bounded review returns");
    assert_eq!(review["subject"]["episodeRef"], observation.application["subject"]["subjectRef"]);
    assert_eq!(review["subject"]["selectionRef"], selection["selectionRef"]);

    let ground = epi
        .personal_ground(json!({"selection": selection_request.clone(), "reviewRef": review["reviewRef"]}))
        .expect("Anuttara bounded source orientation returns");
    assert_eq!(ground["subject"]["selectionRef"], selection["selectionRef"]);
    assert_eq!(ground["bimba"]["providerIdentityIsSemanticIdentity"], false);

    let proposal = epi
        .personal_proposal(json!({
            "selection": selection_request,
            "reviewRef": review["reviewRef"],
            "groundRef": ground["groundRef"],
            "proposedContent": "βeta"
        }))
        .expect("bounded Personal proposal returns");
    assert_eq!(proposal["subject"]["selectionRef"], selection["selectionRef"]);
    assert_eq!(proposal["sourceClass"], "proposal");
    assert_eq!(proposal["adoptionState"], "unreviewed");
    assert_eq!(proposal["sourceMutationPerformed"], false);
}
