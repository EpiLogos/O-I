use oi_desktop_core::{
    host_epi_snapshot, HostRegion, LocalEpiHost, EPI_NATIVE_OWNER, EPI_PRIMITIVE_CONTRIBUTION_REF,
    EPI_PRIMITIVE_PROVIDER_CONTRACT,
};
use serde_json::json;
use std::env;

fn representative_snapshot() -> serde_json::Value {
    json!({
        "schema": "epi.pratibimba-primitive-snapshot/v1",
        "providerContract": "epi.pratibimba-primitive-provider/v1",
        "nativeOwner": "epi",
        "sourceRevision": "1111111111111111111111111111111111111111",
        "status": "implemented",
        "currentAddress": {
            "canonicalRef": "epi:bimba:#-4/M4'",
            "bimbaRef": "#-4",
            "domainRef": "M4'"
        },
        "kernel": {
            "parity": true,
            "harmonicProfile": { "tick12": 4 }
        },
        "ql": {
            "qlAddress": "qladdr:sixfold@1/direct/P4/d0",
            "lensRef": "mef:lens:L4@1",
            "sublensRef": "mef:sublens:L4.4@1",
            "providerRevision": "d0e012b9a2080b75b9583d5fcc672775cce3a7ca"
        },
        "vak": { "currentState": { "status": "provider-unavailable" } },
        "time": { "dayNow": { "status": "provider-unavailable" } }
    })
}

#[test]
fn epi_snapshot_hosts_through_existing_native_contribution_contract() {
    let observation = host_epi_snapshot(representative_snapshot()).expect("host Epi snapshot");
    let contribution = &observation.contribution.contribution;
    assert_eq!(contribution.contribution_ref, EPI_PRIMITIVE_CONTRIBUTION_REF);
    assert_eq!(contribution.native_owner, EPI_NATIVE_OWNER);
    assert_eq!(
        contribution.target_contract.as_deref(),
        Some(EPI_PRIMITIVE_PROVIDER_CONTRACT)
    );
    assert!(contribution.regions.contains(&HostRegion::Canvas));
    assert!(contribution.regions.contains(&HostRegion::Inspector));
    assert!(contribution.regions.contains(&HostRegion::RootAgency));
    assert_eq!(
        contribution.read_model_ref.as_ref().map(|reference| reference.ref_id.as_str()),
        Some("epi:bimba:#-4/M4'")
    );
}

#[test]
fn host_rejects_loss_of_real_kernel_or_canonical_ref_identity() {
    let mut no_parity = representative_snapshot();
    no_parity["kernel"]["parity"] = json!(false);
    assert!(host_epi_snapshot(no_parity).is_err());

    let mut fake_ql = representative_snapshot();
    fake_ql["ql"]["qlAddress"] = json!("renderer-local-position-4");
    assert!(host_epi_snapshot(fake_ql).is_err());
}

#[test]
fn adapter_does_not_create_a_second_epi_runtime_ontology() {
    let source = include_str!("../src/local_epi.rs");
    for forbidden in [
        "EpiSession",
        "EpiPlugin",
        "EpiDesktopAction",
        "EpiProcess",
        "EpiHarness",
    ] {
        assert!(
            !source.contains(forbidden),
            "O:I adapter must not introduce {forbidden}"
        );
    }
}

#[test]
fn real_epi_bridge_process_hosts_when_acceptance_binary_is_supplied() {
    let Some(binary) = env::var_os("EPI_BRIDGE_BIN") else {
        eprintln!("EPI_BRIDGE_BIN not supplied; cross-repository acceptance is exercised by the dedicated workflow");
        return;
    };
    let observation = LocalEpiHost::open(binary)
        .observe()
        .expect("real Epi provider process must host");
    assert_eq!(
        observation.snapshot.pointer("/kernel/parity").and_then(|value| value.as_bool()),
        Some(true)
    );
    assert_eq!(
        observation
            .snapshot
            .pointer("/kernel/epiLib/operation")
            .and_then(|value| value.as_str()),
        Some("epi-lib::kernel_tick_from_epogdoon via epi_kernel_tick_wire")
    );
    assert_eq!(
        observation
            .contribution
            .contribution
            .read_model_ref
            .as_ref()
            .map(|reference| reference.ref_id.as_str()),
        Some("epi:bimba:#-4/M4'")
    );
    assert!(observation
        .contribution
        .contribution
        .regions
        .contains(&HostRegion::RootAgency));
}
