use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

pub const PACKAGE_SCHEMA: &str = "oi.package/v1";
pub const PACKAGE_RECEIPT_SCHEMA: &str = "oi.package-receipt/v1";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct PackageManifest {
    pub schema: String,
    pub package_ref: String,
    pub version: String,
    pub source: PackageSource,
    #[serde(default)]
    pub compatibility: Vec<SuiteRequirement>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub effects: Vec<String>,
    pub contributions: Vec<PackageContribution>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct PackageSource {
    pub kind: String,
    pub locator: String,
    pub revision: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SuiteRequirement {
    pub product: String,
    pub minimum_version: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct PackageContribution {
    pub contribution_ref: String,
    pub target_product: String,
    pub target_contract: String,
    pub minimum_contract_version: String,
    pub artifact: String,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub effects: Vec<String>,
    pub native_verification: NativeVerificationDeclaration,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct NativeVerificationDeclaration {
    pub operation: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence_format: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct NativeContractCatalog {
    pub schema: String,
    pub contracts: Vec<NativeContract>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct NativeContract {
    pub target_product: String,
    pub target_contract: String,
    pub version: String,
    pub available: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct PackageCompatibilityReport {
    pub package_ref: String,
    pub package_version: String,
    pub compatible: bool,
    pub contributions: Vec<ContributionCompatibility>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct ContributionCompatibility {
    pub contribution_ref: String,
    pub target_product: String,
    pub target_contract: String,
    pub required_version: String,
    pub observed_version: Option<String>,
    pub status: CompatibilityStatus,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CompatibilityStatus {
    Compatible,
    Unavailable,
    Incompatible,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct NativeRegistrationOutcome {
    pub contribution_ref: String,
    pub status: NativeRegistrationStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_registration_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeRegistrationStatus {
    Registered,
    Removed,
    Unavailable,
    Failed,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct PackageLifecycleReceipt {
    pub schema: &'static str,
    pub action: PackageLifecycleAction,
    pub package_ref: String,
    pub package_version: String,
    pub source_revision: String,
    pub native_outcomes: Vec<NativeRegistrationOutcome>,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PackageLifecycleAction {
    InstallRegister,
    Remove,
}

pub fn parse_manifest(input: &str) -> Result<PackageManifest, String> {
    let manifest: PackageManifest = serde_json::from_str(input)
        .map_err(|error| format!("package manifest is not valid JSON: {error}"))?;
    validate_manifest(&manifest)?;
    Ok(manifest)
}

pub fn validate_manifest(manifest: &PackageManifest) -> Result<(), String> {
    if manifest.schema != PACKAGE_SCHEMA {
        return Err(format!(
            "unsupported package schema `{}`; expected `{PACKAGE_SCHEMA}`",
            manifest.schema
        ));
    }
    nonempty("package_ref", &manifest.package_ref)?;
    validate_numeric_version("package version", &manifest.version)?;
    nonempty("source.kind", &manifest.source.kind)?;
    nonempty("source.locator", &manifest.source.locator)?;
    nonempty("source.revision", &manifest.source.revision)?;

    let mut suite_products = BTreeSet::new();
    for requirement in &manifest.compatibility {
        nonempty("compatibility.product", &requirement.product)?;
        validate_numeric_version("compatibility.minimum_version", &requirement.minimum_version)?;
        if !suite_products.insert(requirement.product.as_str()) {
            return Err(format!(
                "duplicate suite compatibility requirement for `{}`",
                requirement.product
            ));
        }
    }

    validate_disclosures("package permissions", &manifest.permissions)?;
    validate_disclosures("package effects", &manifest.effects)?;

    if manifest.contributions.is_empty() {
        return Err("package must declare at least one native contribution".into());
    }

    let mut contribution_refs = BTreeSet::new();
    for contribution in &manifest.contributions {
        nonempty("contribution_ref", &contribution.contribution_ref)?;
        if contribution.contribution_ref == manifest.package_ref {
            return Err(format!(
                "contribution `{}` must retain identity distinct from package identity",
                contribution.contribution_ref
            ));
        }
        if !contribution_refs.insert(contribution.contribution_ref.as_str()) {
            return Err(format!(
                "duplicate contribution_ref `{}`",
                contribution.contribution_ref
            ));
        }
        nonempty("target_product", &contribution.target_product)?;
        nonempty("target_contract", &contribution.target_contract)?;
        validate_numeric_version(
            "minimum_contract_version",
            &contribution.minimum_contract_version,
        )?;
        nonempty("artifact", &contribution.artifact)?;
        nonempty(
            "native_verification.operation",
            &contribution.native_verification.operation,
        )?;
        validate_disclosures("contribution permissions", &contribution.permissions)?;
        validate_disclosures("contribution effects", &contribution.effects)?;
    }

    Ok(())
}

pub fn compatibility_report(
    manifest: &PackageManifest,
    catalog: &NativeContractCatalog,
) -> Result<PackageCompatibilityReport, String> {
    validate_manifest(manifest)?;
    if catalog.schema != "oi.native-contract-catalog/v1" {
        return Err(format!(
            "unsupported native contract catalog schema `{}`",
            catalog.schema
        ));
    }

    let mut index: BTreeMap<(&str, &str), &NativeContract> = BTreeMap::new();
    for contract in &catalog.contracts {
        nonempty("native contract target_product", &contract.target_product)?;
        nonempty("native contract target_contract", &contract.target_contract)?;
        validate_numeric_version("native contract version", &contract.version)?;
        let key = (
            contract.target_product.as_str(),
            contract.target_contract.as_str(),
        );
        if index.insert(key, contract).is_some() {
            return Err(format!(
                "duplicate native contract `{}/{}`",
                contract.target_product, contract.target_contract
            ));
        }
    }

    let mut compatible = true;
    let contributions = manifest
        .contributions
        .iter()
        .map(|contribution| {
            let observed = index.get(&(
                contribution.target_product.as_str(),
                contribution.target_contract.as_str(),
            ));
            let (observed_version, status) = match observed {
                None => (None, CompatibilityStatus::Unavailable),
                Some(contract) if !contract.available => {
                    (Some(contract.version.clone()), CompatibilityStatus::Unavailable)
                }
                Some(contract)
                    if version_at_least(
                        &contract.version,
                        &contribution.minimum_contract_version,
                    )
                    .unwrap_or(false) =>
                {
                    (Some(contract.version.clone()), CompatibilityStatus::Compatible)
                }
                Some(contract) => (
                    Some(contract.version.clone()),
                    CompatibilityStatus::Incompatible,
                ),
            };
            if status != CompatibilityStatus::Compatible {
                compatible = false;
            }
            ContributionCompatibility {
                contribution_ref: contribution.contribution_ref.clone(),
                target_product: contribution.target_product.clone(),
                target_contract: contribution.target_contract.clone(),
                required_version: contribution.minimum_contract_version.clone(),
                observed_version,
                status,
            }
        })
        .collect();

    Ok(PackageCompatibilityReport {
        package_ref: manifest.package_ref.clone(),
        package_version: manifest.version.clone(),
        compatible,
        contributions,
    })
}

/// Record O:I's lifecycle envelope only after native products have returned one
/// explicit outcome per package contribution. O:I does not manufacture native
/// registration identity or infer target health.
pub fn record_lifecycle_receipt(
    manifest: &PackageManifest,
    action: PackageLifecycleAction,
    native_outcomes: Vec<NativeRegistrationOutcome>,
) -> Result<PackageLifecycleReceipt, String> {
    validate_manifest(manifest)?;
    let expected: BTreeSet<&str> = manifest
        .contributions
        .iter()
        .map(|contribution| contribution.contribution_ref.as_str())
        .collect();
    let observed: BTreeSet<&str> = native_outcomes
        .iter()
        .map(|outcome| outcome.contribution_ref.as_str())
        .collect();
    if observed.len() != native_outcomes.len() {
        return Err("native lifecycle outcomes contain duplicate contribution refs".into());
    }
    if expected != observed {
        return Err("native lifecycle outcomes must account for every package contribution exactly once".into());
    }

    for outcome in &native_outcomes {
        nonempty("native outcome contribution_ref", &outcome.contribution_ref)?;
        match (action, outcome.status) {
            (PackageLifecycleAction::InstallRegister, NativeRegistrationStatus::Removed) => {
                return Err(format!(
                    "install/register receipt cannot mark `{}` removed",
                    outcome.contribution_ref
                ));
            }
            (PackageLifecycleAction::Remove, NativeRegistrationStatus::Registered) => {
                return Err(format!(
                    "remove receipt cannot mark `{}` registered",
                    outcome.contribution_ref
                ));
            }
            _ => {}
        }
    }

    Ok(PackageLifecycleReceipt {
        schema: PACKAGE_RECEIPT_SCHEMA,
        action,
        package_ref: manifest.package_ref.clone(),
        package_version: manifest.version.clone(),
        source_revision: manifest.source.revision.clone(),
        native_outcomes,
    })
}

fn validate_disclosures(label: &str, values: &[String]) -> Result<(), String> {
    let mut seen = BTreeSet::new();
    for value in values {
        nonempty(label, value)?;
        if !seen.insert(value.as_str()) {
            return Err(format!("duplicate {label} value `{value}`"));
        }
    }
    Ok(())
}

fn nonempty(label: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{label} must not be empty"))
    } else {
        Ok(())
    }
}

fn validate_numeric_version(label: &str, value: &str) -> Result<(), String> {
    parse_numeric_version(value)
        .map(|_| ())
        .map_err(|error| format!("{label} `{value}` is invalid: {error}"))
}

fn parse_numeric_version(value: &str) -> Result<Vec<u64>, &'static str> {
    if value.trim().is_empty() {
        return Err("version must not be empty");
    }
    value
        .split('.')
        .map(|part| {
            if part.is_empty() || !part.bytes().all(|byte| byte.is_ascii_digit()) {
                return Err("only dot-separated numeric versions are supported by package v1");
            }
            part.parse::<u64>().map_err(|_| "version component overflow")
        })
        .collect()
}

fn version_at_least(observed: &str, required: &str) -> Result<bool, &'static str> {
    let mut observed = parse_numeric_version(observed)?;
    let mut required = parse_numeric_version(required)?;
    let width = observed.len().max(required.len());
    observed.resize(width, 0);
    required.resize(width, 0);
    Ok(observed >= required)
}
