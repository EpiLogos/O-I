use oi_cli::package::{
    compatibility_report, parse_manifest, record_lifecycle_receipt, CompatibilityStatus,
    NativeContract, NativeContractCatalog, NativeRegistrationOutcome, NativeRegistrationStatus,
    PackageLifecycleAction,
};

const IDE: &str = include_str!("../../packages/examples/ide-environment.json");
const MODEL: &str = include_str!("../../packages/examples/model-environment.json");

fn contract(product: &str, contract: &str, version: &str) -> NativeContract {
    NativeContract {
        target_product: product.into(),
        target_contract: contract.into(),
        version: version.into(),
        available: true,
    }
}

#[test]
fn one_package_carries_multiple_native_contribution_kinds_without_identity_collapse() {
    let manifest = parse_manifest(IDE).unwrap();
    assert_eq!(manifest.contributions.len(), 2);
    assert!(manifest
        .contributions
        .iter()
        .all(|contribution| contribution.contribution_ref != manifest.package_ref));
    assert_eq!(
        manifest.contributions[0].target_contract,
        "aikit.sessionspace-provider/v1"
    );
    assert_eq!(
        manifest.contributions[1].target_contract,
        "aikit.connection-adapter/acp/v1"
    );
}

#[test]
fn missing_or_old_native_contract_is_reported_without_oi_inventing_health() {
    let manifest = parse_manifest(MODEL).unwrap();
    let catalog = NativeContractCatalog {
        schema: "oi.native-contract-catalog/v1".into(),
        contracts: vec![
            contract("aikit", "aikit.model-contract-provider/v1", "1.0.0"),
            contract("workcell", "workcell.provider-sdk/v1", "0.9.0"),
        ],
    };

    let report = compatibility_report(&manifest, &catalog).unwrap();
    assert!(!report.compatible);
    assert_eq!(report.contributions[0].status, CompatibilityStatus::Compatible);
    assert_eq!(report.contributions[1].status, CompatibilityStatus::Incompatible);

    let unavailable = NativeContractCatalog {
        schema: "oi.native-contract-catalog/v1".into(),
        contracts: vec![contract(
            "aikit",
            "aikit.model-contract-provider/v1",
            "1.0.0",
        )],
    };
    let report = compatibility_report(&manifest, &unavailable).unwrap();
    assert_eq!(report.contributions[1].status, CompatibilityStatus::Unavailable);
}

#[test]
fn cross_product_model_package_keeps_aikit_and_workcell_contracts_independent() {
    let manifest = parse_manifest(MODEL).unwrap();
    let catalog = NativeContractCatalog {
        schema: "oi.native-contract-catalog/v1".into(),
        contracts: vec![
            contract("aikit", "aikit.model-contract-provider/v1", "1.2.0"),
            contract("workcell", "workcell.provider-sdk/v1", "1.0.0"),
        ],
    };
    let report = compatibility_report(&manifest, &catalog).unwrap();
    assert!(report.compatible);
    assert_eq!(report.contributions[0].target_product, "aikit");
    assert_eq!(report.contributions[1].target_product, "workcell");
}

#[test]
fn lifecycle_receipt_requires_one_native_outcome_per_contribution() {
    let manifest = parse_manifest(IDE).unwrap();
    let outcomes = manifest
        .contributions
        .iter()
        .map(|contribution| NativeRegistrationOutcome {
            contribution_ref: contribution.contribution_ref.clone(),
            status: NativeRegistrationStatus::Registered,
            native_registration_ref: Some(format!("native:{}", contribution.contribution_ref)),
            verification_ref: Some(format!("evidence:{}", contribution.contribution_ref)),
            detail: None,
        })
        .collect();
    let receipt = record_lifecycle_receipt(
        &manifest,
        PackageLifecycleAction::InstallRegister,
        outcomes,
    )
    .unwrap();
    assert_eq!(receipt.native_outcomes.len(), manifest.contributions.len());

    let incomplete = vec![NativeRegistrationOutcome {
        contribution_ref: manifest.contributions[0].contribution_ref.clone(),
        status: NativeRegistrationStatus::Removed,
        native_registration_ref: None,
        verification_ref: None,
        detail: None,
    }];
    assert!(record_lifecycle_receipt(&manifest, PackageLifecycleAction::Remove, incomplete).is_err());
}

#[test]
fn package_disclosures_are_whole_envelope_facts_not_native_policy_replacements() {
    let manifest = parse_manifest(MODEL).unwrap();
    assert!(manifest.permissions.contains(&"network_egress".into()));
    assert!(manifest.effects.contains(&"binary_process_installation".into()));
    assert!(manifest
        .contributions
        .iter()
        .all(|contribution| !contribution.native_verification.operation.is_empty()));
}
