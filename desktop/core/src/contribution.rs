use crate::{RefProvenance, SemanticRef};
use oi_cli::package::{validate_manifest, PackageManifest};
use serde::{Deserialize, Serialize};

/// O:I-owned presentation adapter envelope. This is a read model over a
/// product-native contribution/Surface contract, not a plugin or Component
/// ontology and not an activation mechanism.
const HOST_READING_SCHEMA: &str = "oi.desktop-host-reading/v1";

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContributionAvailability {
    Ready,
    Degraded,
    PendingNativeAdapter,
    Unavailable,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HostRegion {
    Canvas,
    Navigator,
    Inspector,
    RootAgency,
    DeepDrawer,
    Command,
    Status,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionAvailability {
    Available,
    Unavailable,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct CanonicalActionBinding {
    pub action_ref: String,
    pub native_owner: String,
    pub availability: ActionAvailability,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required_capability_ref: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct NativeContributionReading {
    pub schema: String,
    pub contribution_ref: String,
    pub native_owner: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_contract: Option<String>,
    pub availability: ContributionAvailability,
    pub provenance: RefProvenance,
    #[serde(default)]
    pub regions: Vec<HostRegion>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub read_model_ref: Option<SemanticRef>,
    #[serde(default)]
    pub accepted_selection_kinds: Vec<String>,
    #[serde(default)]
    pub actions: Vec<CanonicalActionBinding>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct PackageEnvelopeRef {
    pub package_ref: String,
    pub source_revision: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct HostedContribution {
    pub contribution: NativeContributionReading,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub package: Option<PackageEnvelopeRef>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SelectionProjection {
    pub subject: SemanticRef,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ActionAuthorityGrant {
    pub authority_ref: String,
    pub action_ref: String,
    pub native_owner: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capability_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capability_grant_ref: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct NativeActionInvocation {
    pub action_ref: String,
    pub native_owner: String,
    pub authority_ref: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capability_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capability_grant_ref: Option<String>,
}

pub fn host_native_contribution(
    package: Option<&PackageManifest>,
    contribution: NativeContributionReading,
) -> Result<HostedContribution, String> {
    validate_reading(&contribution)?;

    let package = match package {
        None => None,
        Some(manifest) => {
            validate_manifest(manifest)?;
            if manifest.package_ref == contribution.contribution_ref {
                return Err("package identity must remain distinct from contribution identity".into());
            }
            let declared = manifest
                .contributions
                .iter()
                .find(|candidate| candidate.contribution_ref == contribution.contribution_ref)
                .ok_or_else(|| {
                    format!(
                        "package `{}` does not declare contribution `{}`",
                        manifest.package_ref, contribution.contribution_ref
                    )
                })?;
            let native_contract = contribution.target_contract.as_deref().ok_or_else(|| {
                "packaged contribution requires an observed native target contract".to_owned()
            })?;
            if declared.target_contract != native_contract {
                return Err(format!(
                    "package target contract `{}` does not match native reading `{native_contract}`",
                    declared.target_contract
                ));
            }
            Some(PackageEnvelopeRef {
                package_ref: manifest.package_ref.clone(),
                source_revision: manifest.source.revision.clone(),
            })
        }
    };

    for action in &contribution.actions {
        if action.action_ref == contribution.contribution_ref
            || package
                .as_ref()
                .is_some_and(|envelope| action.action_ref == envelope.package_ref)
        {
            return Err("Action identity must remain distinct from package/contribution identity".into());
        }
    }

    Ok(HostedContribution {
        contribution,
        package,
    })
}

pub fn selection_for(
    contribution: &NativeContributionReading,
    subject: &SemanticRef,
) -> Option<SelectionProjection> {
    contribution
        .accepted_selection_kinds
        .iter()
        .any(|kind| kind == &subject.kind)
        .then(|| SelectionProjection {
            subject: subject.clone(),
        })
}

pub fn authorize_action(
    binding: &CanonicalActionBinding,
    grant: &ActionAuthorityGrant,
) -> Result<NativeActionInvocation, String> {
    if binding.availability != ActionAvailability::Available {
        return Err(format!("Action `{}` is unavailable", binding.action_ref));
    }
    if binding.action_ref != grant.action_ref || binding.native_owner != grant.native_owner {
        return Err("Action authority grant does not match the canonical Action binding".into());
    }
    if let Some(required_capability_ref) = binding.required_capability_ref.as_deref() {
        if grant.capability_ref.as_deref() != Some(required_capability_ref) {
            return Err(format!(
                "Action requires Capability `{required_capability_ref}`"
            ));
        }
        if grant.capability_grant_ref.is_none() {
            return Err("Action requires an explicit Capability grant".into());
        }
    }
    if grant.authority_ref.trim().is_empty() {
        return Err("Action authority grant requires a non-empty authority_ref".into());
    }
    Ok(NativeActionInvocation {
        action_ref: binding.action_ref.clone(),
        native_owner: binding.native_owner.clone(),
        authority_ref: grant.authority_ref.clone(),
        capability_ref: grant.capability_ref.clone(),
        capability_grant_ref: grant.capability_grant_ref.clone(),
    })
}

fn validate_reading(contribution: &NativeContributionReading) -> Result<(), String> {
    if contribution.schema != HOST_READING_SCHEMA {
        return Err(format!(
            "unsupported desktop host-reading schema `{}`",
            contribution.schema
        ));
    }
    if contribution.contribution_ref.trim().is_empty() || contribution.native_owner.trim().is_empty() {
        return Err("host reading requires stable native contribution_ref and native_owner".into());
    }
    if contribution.availability == ContributionAvailability::Ready {
        if contribution.target_contract.as_deref().is_none_or(str::is_empty) {
            return Err("ready host reading requires an observed native target contract".into());
        }
        if contribution.read_model_ref.is_none() && contribution.actions.is_empty() {
            return Err("ready host reading must expose a Reading and/or canonical Action binding".into());
        }
    }
    for action in &contribution.actions {
        if action.action_ref.trim().is_empty() || action.native_owner.trim().is_empty() {
            return Err("canonical Action binding requires stable identity and native owner".into());
        }
    }
    Ok(())
}
