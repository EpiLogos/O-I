use oi_desktop_core::{
    LocalEpiHost, EPI_COSMIC_OPEN_DEPTH_ACTION_REF, EPI_COSMIC_OPEN_DEPTH_CAPABILITY_REF,
};
use serde_json::Value;
use std::env;
use std::path::Path;
use std::process::Command;

#[test]
fn cosmic_host_binding_stays_native_and_does_not_add_runtime_ontology() {
    let source = include_str!("../src/local_epi.rs");
    assert!(source.contains(EPI_COSMIC_OPEN_DEPTH_ACTION_REF));
    assert!(source.contains(EPI_COSMIC_OPEN_DEPTH_CAPABILITY_REF));
    for forbidden in ["CosmicSession", "CosmicRuntime", "CosmicProviderRegistry", "CosmicStateStore"] {
        assert!(!source.contains(forbidden));
    }
}

#[test]
fn real_cosmic_provider_composes_m123_and_matches_nara_profile_when_cross_repo_fixture_is_supplied() {
    let (Some(binary), Some(context), Some(vault)) = (
        env::var_os("EPI_BRIDGE_BIN"),
        env::var_os("EPI_NARA_CONTEXT"),
        env::var_os("EPI_NARA_VAULT"),
    ) else {
        eprintln!("real Cosmic provider env not supplied; dedicated cross-repository workflow owns this proof");
        return;
    };

    let host = LocalEpiHost::open(&binary)
        .with_nara_context_file(&context)
        .with_nara_vault_root(&vault);
    let observation = host.observe().expect("host Epi provider");
    assert!(observation
        .contribution
        .contribution
        .actions
        .iter()
        .any(|binding| binding.action_ref == EPI_COSMIC_OPEN_DEPTH_ACTION_REF));

    let cosmic = host.cosmic_current().expect("read integrated Cosmic state");
    assert_eq!(cosmic["schema"], "epi.cosmic-current/v1");
    assert_eq!(cosmic["movement"]["coordinate"], "M1'");
    assert_eq!(cosmic["resonance"]["coordinate"], "M2'");
    assert_eq!(cosmic["symbolic"]["coordinate"], "M3'");
    assert_eq!(cosmic["deepWorkspaces"].as_array().unwrap().len(), 6);
    assert_eq!(cosmic["readiness"][2]["status"], "research");

    // Fixed timestamp is the acceptance proof for the source identity law. Both
    // operations independently enter the same one-shot bridge and therefore must
    // derive the same MathemeHarmonicProfile ref rather than share mutable state.
    let timestamp = "1725000000000";
    let cosmic_fixed = invoke_json(
        Path::new(&binary),
        "cosmic-current",
        timestamp,
        Path::new(&context),
        None,
    );
    let nara_fixed = invoke_json(
        Path::new(&binary),
        "nara-read",
        timestamp,
        Path::new(&context),
        Some(Path::new(&vault)),
    );

    assert_eq!(cosmic_fixed["profileRef"], nara_fixed["livedContext"]["profileRef"]);
    assert_eq!(cosmic_fixed["qlAddress"], nara_fixed["livedContext"]["qlAddress"]);
    assert_eq!(cosmic_fixed["coordinateRef"], nara_fixed["livedContext"]["coordinateRef"]);
    assert_eq!(cosmic_fixed["dayId"], nara_fixed["livedContext"]["dayId"]);
    assert_eq!(cosmic_fixed["nowPath"], nara_fixed["livedContext"]["nowPath"]);
}

fn invoke_json(
    binary: &Path,
    operation: &str,
    timestamp: &str,
    context: &Path,
    vault: Option<&Path>,
) -> Value {
    let mut command = Command::new(binary);
    command
        .arg("--operation")
        .arg(operation)
        .arg("--timestamp-ms")
        .arg(timestamp)
        .arg("--nara-context")
        .arg(context);
    if let Some(vault) = vault {
        command.arg("--vault-root").arg(vault);
    }
    let output = command.output().expect("run real Epi bridge");
    assert!(
        output.status.success(),
        "Epi bridge {operation} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).expect("parse real Epi bridge JSON")
}
