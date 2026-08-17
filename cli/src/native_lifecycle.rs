//! O:I package lifecycle coordination over product-owned native operations.
//!
//! This module is intentionally a lifecycle envelope, not a plugin runtime. The
//! target adapter below calls AIKit's own SessionSpace contribution registry and
//! readback API. O:I records the observed outcome only after the target has done
//! the work.

use aikit_core::{
    SessionSpaceContributionDefinition, SessionSpaceContributionRef,
    SessionSpaceContributionRegistry, SessionSpaceReadModel, SessionSpaceRef,
    SESSION_SPACE_CONTRIBUTION_VERSION,
};
use std::collections::BTreeMap;

use crate::package::{
    compatibility_report, record_lifecycle_receipt, NativeContract, NativeContractCatalog,
    NativeRegistrationOutcome, NativeRegistrationStatus, PackageContribution,
    PackageLifecycleAction, PackageLifecycleReceipt, PackageManifest,
};

pub const AIKIT_TARGET_PRODUCT: &str = "aikit";
pub const AIKIT_SESSION_SPACE_CONTRIBUTION_CONTRACT: &str = "aikit.session-space-contribution/v1";
pub const AIKIT_SESSION_SPACE_CONTRIBUTION_VERSION: &str = "1.0.0";

/// Narrow lifecycle operation required by `oi.package/v1`. This does not define
/// the native object's runtime ABI or semantics; each adapter delegates to the
/// owning product's public operation.
pub trait NativeContributionLifecycleTarget {
    fn target_product(&self) -> &str;
    fn target_contract(&self) -> &str;
    fn contract_version(&self) -> &str;

    fn register_and_verify(
        &mut self,
        contribution: &PackageContribution,
    ) -> Result<NativeRegistrationOutcome, String>;

    fn remove_and_verify(
        &mut self,
        contribution: &PackageContribution,
    ) -> Result<NativeRegistrationOutcome, String>;
}

/// Coordinate one package whose contributions belong to one native target.
/// Multi-product packages remain valid `oi.package/v1`; their coordinator can
/// compose multiple target adapters later without inventing a universal runtime.
pub fn install_register_with_target<T: NativeContributionLifecycleTarget>(
    manifest: &PackageManifest,
    target: &mut T,
) -> Result<PackageLifecycleReceipt, String> {
    ensure_target_owns_manifest_contributions(manifest, target)?;
    let catalog = target_catalog(target);
    let compatibility = compatibility_report(manifest, &catalog)?;
    if !compatibility.compatible {
        return Err(format!(
            "package `{}` is not compatible with observed native target {}/{}@{}",
            manifest.package_ref,
            target.target_product(),
            target.target_contract(),
            target.contract_version()
        ));
    }

    let mut outcomes = Vec::with_capacity(manifest.contributions.len());
    let mut registered = Vec::new();
    for contribution in &manifest.contributions {
        match target.register_and_verify(contribution) {
            Ok(outcome) if outcome.status == NativeRegistrationStatus::Registered => {
                registered.push(contribution);
                outcomes.push(outcome);
            }
            Ok(outcome) => {
                rollback_registered(target, &registered);
                return Err(format!(
                    "native target returned non-registered status for `{}`: {:?}",
                    contribution.contribution_ref, outcome.status
                ));
            }
            Err(error) => {
                rollback_registered(target, &registered);
                return Err(error);
            }
        }
    }

    record_lifecycle_receipt(manifest, PackageLifecycleAction::InstallRegister, outcomes)
}

pub fn remove_with_target<T: NativeContributionLifecycleTarget>(
    manifest: &PackageManifest,
    target: &mut T,
) -> Result<PackageLifecycleReceipt, String> {
    ensure_target_owns_manifest_contributions(manifest, target)?;
    let mut outcomes = Vec::with_capacity(manifest.contributions.len());
    for contribution in &manifest.contributions {
        let outcome = target.remove_and_verify(contribution)?;
        if outcome.status != NativeRegistrationStatus::Removed {
            return Err(format!(
                "native target returned non-removed status for `{}`: {:?}",
                contribution.contribution_ref, outcome.status
            ));
        }
        outcomes.push(outcome);
    }
    record_lifecycle_receipt(manifest, PackageLifecycleAction::Remove, outcomes)
}

fn rollback_registered<T: NativeContributionLifecycleTarget>(
    target: &mut T,
    registered: &[&PackageContribution],
) {
    for contribution in registered.iter().rev() {
        let _ = target.remove_and_verify(contribution);
    }
}

fn ensure_target_owns_manifest_contributions<T: NativeContributionLifecycleTarget>(
    manifest: &PackageManifest,
    target: &T,
) -> Result<(), String> {
    for contribution in &manifest.contributions {
        if contribution.target_product != target.target_product()
            || contribution.target_contract != target.target_contract()
        {
            return Err(format!(
                "contribution `{}` belongs to {}/{}, not observed target {}/{}",
                contribution.contribution_ref,
                contribution.target_product,
                contribution.target_contract,
                target.target_product(),
                target.target_contract()
            ));
        }
    }
    Ok(())
}

fn target_catalog<T: NativeContributionLifecycleTarget>(target: &T) -> NativeContractCatalog {
    NativeContractCatalog {
        schema: "oi.native-contract-catalog/v1".into(),
        contracts: vec![NativeContract {
            target_product: target.target_product().into(),
            target_contract: target.target_contract().into(),
            version: target.contract_version().into(),
            available: true,
        }],
    }
}

/// Target-specific adapter over AIKit's public native lifecycle. The registry and
/// SessionSpace read model remain AIKit-owned objects; O:I does not reproduce
/// their state or infer activation/authority from package presence.
#[derive(Default)]
pub struct AikitSessionSpaceLifecycleAdapter {
    registry: SessionSpaceContributionRegistry,
    observed_read_models: BTreeMap<String, SessionSpaceReadModel>,
}

impl AikitSessionSpaceLifecycleAdapter {
    pub fn observe_session_space(&mut self, read_model: SessionSpaceReadModel) {
        self.observed_read_models
            .insert(read_model.id.to_string(), read_model);
    }

    pub fn native_registry(&self) -> &SessionSpaceContributionRegistry {
        &self.registry
    }
}

impl NativeContributionLifecycleTarget for AikitSessionSpaceLifecycleAdapter {
    fn target_product(&self) -> &str {
        AIKIT_TARGET_PRODUCT
    }

    fn target_contract(&self) -> &str {
        AIKIT_SESSION_SPACE_CONTRIBUTION_CONTRACT
    }

    fn contract_version(&self) -> &str {
        AIKIT_SESSION_SPACE_CONTRIBUTION_VERSION
    }

    fn register_and_verify(
        &mut self,
        contribution: &PackageContribution,
    ) -> Result<NativeRegistrationOutcome, String> {
        let contribution_ref = SessionSpaceContributionRef::parse(&contribution.contribution_ref)
            .map_err(|error| error.to_string())?;
        let session_space =
            SessionSpaceRef::parse(&contribution.artifact).map_err(|error| error.to_string())?;
        let definition = SessionSpaceContributionDefinition::new(
            contribution_ref.clone(),
            session_space.clone(),
        )
        .with_provenance(format!(
            "registered through O:I package envelope; native contract {SESSION_SPACE_CONTRIBUTION_VERSION}"
        ));
        let registration = self
            .registry
            .register(definition)
            .map_err(|error| error.to_string())?;
        let readback = self.registry.read(&contribution_ref).ok_or_else(|| {
            format!(
                "AIKit registration `{}` disappeared before native readback",
                contribution.contribution_ref
            )
        })?;
        if readback.native_registration_ref != registration.native_registration_ref {
            return Err("AIKit native registration readback identity changed".into());
        }

        if let Some(read_model) = self.observed_read_models.get(&session_space.to_string()) {
            self.registry
                .verify_session_space_read_model(&contribution_ref, read_model)
                .map_err(|error| error.to_string())?;
        }

        Ok(NativeRegistrationOutcome {
            contribution_ref: contribution.contribution_ref.clone(),
            status: NativeRegistrationStatus::Registered,
            native_registration_ref: Some(registration.native_registration_ref.to_string()),
            verification_ref: Some(format!(
                "aikit-registration-readback/{}",
                contribution.contribution_ref
            )),
            detail: Some(format!(
                "AIKit native registration verified for SessionSpace {session_space}"
            )),
        })
    }

    fn remove_and_verify(
        &mut self,
        contribution: &PackageContribution,
    ) -> Result<NativeRegistrationOutcome, String> {
        let contribution_ref = SessionSpaceContributionRef::parse(&contribution.contribution_ref)
            .map_err(|error| error.to_string())?;
        let removal = self
            .registry
            .remove(&contribution_ref)
            .map_err(|error| error.to_string())?;
        if self.registry.read(&contribution_ref).is_some() {
            return Err(format!(
                "AIKit contribution `{}` still exists after removal",
                contribution.contribution_ref
            ));
        }
        Ok(NativeRegistrationOutcome {
            contribution_ref: contribution.contribution_ref.clone(),
            status: NativeRegistrationStatus::Removed,
            native_registration_ref: Some(removal.native_registration_ref.to_string()),
            verification_ref: Some(format!(
                "aikit-registration-absence/{}",
                contribution.contribution_ref
            )),
            detail: Some(format!(
                "AIKit native registration removed; SessionSpace {} remains independently owned",
                removal.session_space
            )),
        })
    }
}
