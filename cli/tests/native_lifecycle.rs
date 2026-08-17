use aikit_core::{SessionSpaceDefinition, SessionSpaceRef, SessionSpaceRuntime};
use oi_cli::native_lifecycle::{
    install_register_with_target, remove_with_target, AikitSessionSpaceLifecycleAdapter,
    AIKIT_SESSION_SPACE_CONTRIBUTION_CONTRACT,
};
use oi_cli::package::{
    NativeRegistrationStatus, NativeVerificationDeclaration, PackageContribution, PackageManifest,
    PackageSource,
};

fn manifest(minimum_version: &str) -> PackageManifest {
    PackageManifest {
        schema: "oi.package/v1".into(),
        package_ref: "package/oi-session-space-proof".into(),
        version: "1.0.0".into(),
        source: PackageSource {
            kind: "git".into(),
            locator: "EpiLogos/ai-kit".into(),
            revision: "8ec1f923b8cc59b7e18e7b6c1afa0974ca6f1208".into(),
        },
        compatibility: Vec::new(),
        permissions: Vec::new(),
        effects: Vec::new(),
        contributions: vec![PackageContribution {
            contribution_ref: "session-space-contribution/oi-proof".into(),
            target_product: "aikit".into(),
            target_contract: AIKIT_SESSION_SPACE_CONTRIBUTION_CONTRACT.into(),
            minimum_contract_version: minimum_version.into(),
            artifact: "session-space/oi-proof".into(),
            permissions: Vec::new(),
            effects: Vec::new(),
            native_verification: NativeVerificationDeclaration {
                operation: "AIKit native registration readback".into(),
                evidence_format: Some("aikit.session-space-contribution-registry/v1".into()),
            },
        }],
    }
}

#[test]
fn package_lifecycle_calls_real_aikit_registration_and_preserves_space_identity() {
    let space = SessionSpaceRef::parse("session-space/oi-proof").unwrap();
    let runtime = SessionSpaceRuntime::open(SessionSpaceDefinition::new(space.clone())).unwrap();
    let original_read_model = runtime.read_model();

    let mut target = AikitSessionSpaceLifecycleAdapter::default();
    target.observe_session_space(original_read_model.clone());
    let manifest = manifest("1.0.0");

    let install = install_register_with_target(&manifest, &mut target).unwrap();
    assert_eq!(install.schema, "oi.package-receipt/v1");
    assert_eq!(
        install.native_outcomes[0].status,
        NativeRegistrationStatus::Registered
    );
    let native_registration_ref = install.native_outcomes[0]
        .native_registration_ref
        .as_deref()
        .unwrap();
    assert_ne!(native_registration_ref, manifest.package_ref);
    assert_ne!(
        native_registration_ref,
        manifest.contributions[0].contribution_ref
    );
    assert!(target
        .native_registry()
        .read(
            &aikit_core::SessionSpaceContributionRef::parse(
                &manifest.contributions[0].contribution_ref
            )
            .unwrap()
        )
        .is_some());

    let removal = remove_with_target(&manifest, &mut target).unwrap();
    assert_eq!(
        removal.native_outcomes[0].status,
        NativeRegistrationStatus::Removed
    );
    assert!(target
        .native_registry()
        .read(
            &aikit_core::SessionSpaceContributionRef::parse(
                &manifest.contributions[0].contribution_ref
            )
            .unwrap()
        )
        .is_none());

    // O:I removed the package/native registration relation only. The independently
    // owned AIKit SessionSpace is still the same live semantic object.
    let after = runtime.read_model();
    assert_eq!(after.id, original_read_model.id);
    assert_eq!(after.lifecycle, original_read_model.lifecycle);
    assert_eq!(after.revision, original_read_model.revision);
}

#[test]
fn incompatible_native_contract_fails_before_registration() {
    let mut target = AikitSessionSpaceLifecycleAdapter::default();
    let error = install_register_with_target(&manifest("2.0.0"), &mut target).unwrap_err();
    assert!(error.contains("not compatible"));
    assert!(target.native_registry().read_model().registrations.is_empty());
}
