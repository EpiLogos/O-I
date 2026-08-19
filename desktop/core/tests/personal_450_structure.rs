use oi_desktop_core::{BridgeCallClass, BridgeCaller, BridgePolicy};

#[test]
fn sandboxed_contributions_cannot_cross_personal_or_central_privileged_boundaries() {
    for call in [
        BridgeCallClass::ObserveEpiPersonal,
        BridgeCallClass::WriteEpiNara,
        BridgeCallClass::DispatchEpiNaraAction,
        BridgeCallClass::DispatchEpiPersonalAction,
        BridgeCallClass::ObserveCentralNow,
        BridgeCallClass::InteractAgentSession,
        BridgeCallClass::ObserveKnowledge,
    ] {
        assert!(BridgePolicy.authorize(BridgeCaller::ShellUi, call).is_ok());
        assert!(
            BridgePolicy
                .authorize(BridgeCaller::SandboxedContribution, call)
                .is_err(),
            "sandboxed contribution unexpectedly gained {call:?}"
        );
    }
}

#[test]
fn personal_host_does_not_reintroduce_local_chat_graph_or_parallel_event_runtime() {
    let epi = include_str!("../src/local_epi.rs");
    let tauri = include_str!("../../src-tauri/src/personal.rs");
    assert!(!epi.contains("struct EpiiRuntime"));
    assert!(!epi.contains("struct PersonalEvent"));
    assert!(!tauri.contains("struct EpiiRuntime"));
    assert!(!tauri.contains("struct PersonalEvent"));
    assert!(epi.contains("personal-application"));
    assert!(tauri.contains("knowledge_read"));
    assert!(tauri.contains("return_personal_proposal"));
}
