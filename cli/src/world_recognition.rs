use crate::package::{parse_manifest, PackageContribution};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

pub const WORLD_RECOGNITION_CONTRACT: &str = "oi.world-recognition/v1";
pub const WORLD_RECOGNITION_CONTRACT_VERSION: &str = "1.0.0";
pub const WORLD_RECOGNITION_RESULT_SCHEMA: &str = "oi.world-recognition-result/v1";
pub const WORLD_RECOGNITION_ACCOUNT_SCHEMA: &str = "oi.world-recognition-account/v1";
pub const WORLD_RECOGNITION_REGISTRY_SCHEMA: &str = "oi.world-recognition-registry/v1";
pub const WORLD_RECOGNITION_VERIFICATION_SCHEMA: &str = "oi.world-recognition-verification/v1";

const HERDR_UPSTREAM_REVISION: &str = "facf0aafca011d147e798ad37e83799bdd29b75e";
const HERDR_AIKIT_PROVIDER_CONTRACT: &str = "aikit.herdr-working-environment/v1";
const EMBEDDED_HERDR_PACKAGE: &str = include_str!("../../packages/examples/herdr-recognition.json");

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct RecognizedSourceAperture {
    pub path: String,
    pub class: String,
    pub owner: String,
    pub standing: String,
    pub treatment: String,
    pub evidence: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct NativeSystemObservation {
    pub system_ref: String,
    pub kind: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locator: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_revision: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct NativeRelationObservation {
    pub relation: String,
    pub from_ref: String,
    pub to_ref: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct OwnerParticipationBinding {
    pub owner: String,
    pub contract: String,
    pub state: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub canonical_ref: Option<String>,
    #[serde(default)]
    pub provenance: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct RecognitionEvidence {
    pub kind: String,
    pub source: String,
    pub detail: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct RecognitionObservation {
    pub observation_ref: String,
    pub native_system: NativeSystemObservation,
    pub support: String,
    #[serde(default)]
    pub faculties: Vec<String>,
    #[serde(default)]
    pub relations: Vec<NativeRelationObservation>,
    #[serde(default)]
    pub facts: BTreeMap<String, Value>,
    #[serde(default)]
    pub owner_bindings: Vec<OwnerParticipationBinding>,
    #[serde(default)]
    pub evidence: Vec<RecognitionEvidence>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct OwnerParticipation {
    pub owner: String,
    pub native_system: NativeSystemObservation,
    pub contract: String,
    pub state: String,
    #[serde(default)]
    pub readiness: BTreeMap<String, Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub canonical_ref: Option<String>,
    #[serde(default)]
    pub provenance: Vec<String>,
    #[serde(default)]
    pub faculties: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct OwnerContract {
    pub owner: String,
    pub contract: String,
    pub field: String,
    #[serde(default)]
    pub provenance: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct OwnerCapacity {
    pub owner: String,
    pub capacity_ref: String,
    #[serde(default)]
    pub ports: Vec<String>,
    pub state: String,
    #[serde(default)]
    pub facts: BTreeMap<String, Value>,
    #[serde(default)]
    pub provenance: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct RecognitionExtensionRequest {
    pub request_ref: String,
    pub native_system_ref: String,
    pub owner: String,
    pub reason: String,
    pub sdk: String,
    pub authoring_skill: String,
    pub conformance: String,
    pub package_target: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct RecognitionProviderResult {
    pub schema: String,
    pub provider_ref: String,
    #[serde(default)]
    pub observations: Vec<RecognitionObservation>,
    #[serde(default)]
    pub extension_requests: Vec<RecognitionExtensionRequest>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct RecognitionVerificationResult {
    pub schema: String,
    pub ok: bool,
    #[serde(default)]
    pub evidence: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct RecognitionRegistration {
    pub package_ref: String,
    pub package_version: String,
    pub source_revision: String,
    pub contribution_ref: String,
    pub manifest_path: String,
    pub artifact: String,
    pub verification_operation: String,
    #[serde(default)]
    pub embedded: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct RecognitionRegistry {
    pub schema: String,
    #[serde(default)]
    pub registrations: Vec<RecognitionRegistration>,
}

impl Default for RecognitionRegistry {
    fn default() -> Self {
        Self {
            schema: WORLD_RECOGNITION_REGISTRY_SCHEMA.to_owned(),
            registrations: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct RecognitionProviderExecution {
    pub provider_ref: String,
    pub package_ref: String,
    pub status: String,
    pub detail: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct WorldRecognitionAccount {
    pub schema: String,
    pub target: String,
    pub sources: Vec<RecognizedSourceAperture>,
    pub providers: Vec<RecognitionProviderExecution>,
    pub observations: Vec<RecognitionObservation>,
    #[serde(default)]
    pub owner_participations: Vec<OwnerParticipation>,
    #[serde(default)]
    pub owner_contracts: Vec<OwnerContract>,
    #[serde(default)]
    pub owner_capacities: Vec<OwnerCapacity>,
    pub extension_requests: Vec<RecognitionExtensionRequest>,
    #[serde(default)]
    pub provider_errors: Vec<String>,
}

pub fn scan_existing_source_apertures(
    target: &Path,
) -> Result<Vec<RecognizedSourceAperture>, String> {
    let mut sources = Vec::new();
    for (relative, class, owner, standing, treatment) in [
        (
            "ProjectCentral/user",
            "authored-project-ground",
            "Central",
            "authoritative-when-projectcentral-conformant",
            "retain-in-place",
        ),
        (
            "ProjectCentral/agents/governance",
            "human-authored-agent-governance",
            "Central",
            "authoritative-when-projectcentral-conformant",
            "retain-in-place",
        ),
        (
            "ProjectCentral/skills",
            "project-praxis-source",
            "Central",
            "authoritative-when-projectcentral-conformant",
            "retain-in-place",
        ),
        (
            "ProjectCentral/methods",
            "project-method-source",
            "Central",
            "authoritative-when-projectcentral-conformant",
            "retain-in-place",
        ),
        (
            "skills",
            "native-praxis-candidate",
            "project/native-source",
            "candidate-location-does-not-prove-authorship",
            "retain-in-place-and-offer-to-aikit-discovery",
        ),
        (
            ".claude/skills",
            "native-praxis-candidate",
            "target/native-source",
            "candidate-location-does-not-prove-authorship",
            "retain-in-place-and-offer-to-aikit-discovery",
        ),
        (
            ".agents/skills",
            "native-praxis-candidate",
            "target/native-source",
            "candidate-location-does-not-prove-authorship",
            "retain-in-place-and-offer-to-aikit-discovery",
        ),
        (
            ".hermes/skills",
            "native-praxis-candidate",
            "target/native-source",
            "candidate-location-does-not-prove-authorship",
            "retain-in-place-and-offer-to-aikit-discovery",
        ),
        (
            "AGENTS.md",
            "project-instruction-candidate",
            "project/native-source",
            "inspect-before-classifying-as-governance-or-praxis",
            "retain-in-place",
        ),
        (
            "CLAUDE.md",
            "project-instruction-candidate",
            "project/native-source",
            "inspect-before-classifying-as-governance-or-praxis",
            "retain-in-place",
        ),
        (
            ".aikit",
            "aikit-project-binding",
            "AIKit",
            "derived-or-native-state-requires-aikit-explanation",
            "do-not-reclassify-as-source",
        ),
    ] {
        let path = target.join(relative);
        if path.exists() {
            let metadata = fs::metadata(&path)
                .map_err(|error| format!("cannot inspect {}: {error}", path.display()))?;
            sources.push(RecognizedSourceAperture {
                path: relative.to_owned(),
                class: class.to_owned(),
                owner: owner.to_owned(),
                standing: standing.to_owned(),
                treatment: treatment.to_owned(),
                evidence: if metadata.is_dir() {
                    "directory-present".to_owned()
                } else {
                    format!("file-present:{}-bytes", metadata.len())
                },
            });
        }
    }
    Ok(sources)
}

pub fn load_registry(path: &Path) -> Result<RecognitionRegistry, String> {
    if !path.exists() {
        return Ok(RecognitionRegistry::default());
    }
    let bytes = fs::read(path).map_err(|error| {
        format!(
            "cannot read recognition registry {}: {error}",
            path.display()
        )
    })?;
    let registry: RecognitionRegistry = serde_json::from_slice(&bytes)
        .map_err(|error| format!("invalid recognition registry {}: {error}", path.display()))?;
    if registry.schema != WORLD_RECOGNITION_REGISTRY_SCHEMA {
        return Err(format!(
            "unsupported recognition registry schema `{}` in {}",
            registry.schema,
            path.display()
        ));
    }
    Ok(registry)
}

pub fn save_registry(path: &Path, registry: &RecognitionRegistry) -> Result<(), String> {
    if registry.schema != WORLD_RECOGNITION_REGISTRY_SCHEMA {
        return Err("cannot save unsupported recognition registry schema".to_owned());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "recognition registry path has no parent".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    let temporary = parent.join("world-recognition-registry.json.tmp");
    let bytes = serde_json::to_vec_pretty(registry).map_err(|error| error.to_string())?;
    fs::write(&temporary, bytes)
        .map_err(|error| format!("cannot write {}: {error}", temporary.display()))?;
    fs::rename(&temporary, path)
        .map_err(|error| format!("cannot replace {}: {error}", path.display()))?;
    Ok(())
}

pub fn effective_registrations(path: &Path) -> Result<Vec<RecognitionRegistration>, String> {
    let mut registrations = embedded_registrations()?;
    let local = load_registry(path)?;
    for registration in local.registrations {
        if let Some(index) = registrations
            .iter()
            .position(|existing| existing.contribution_ref == registration.contribution_ref)
        {
            registrations[index] = registration;
        } else {
            registrations.push(registration);
        }
    }
    registrations.sort_by(|left, right| left.contribution_ref.cmp(&right.contribution_ref));
    Ok(registrations)
}

pub fn register_recognition_package(
    manifest_path: &Path,
    registry_path: &Path,
) -> Result<Vec<RecognitionRegistration>, String> {
    let manifest_path = absolute_path(manifest_path)?;
    let input = fs::read_to_string(&manifest_path).map_err(|error| {
        format!(
            "cannot read package manifest {}: {error}",
            manifest_path.display()
        )
    })?;
    let manifest = parse_manifest(&input)?;
    let recognition_contributions: Vec<&PackageContribution> = manifest
        .contributions
        .iter()
        .filter(|contribution| {
            contribution.target_product == "oi"
                && contribution.target_contract == WORLD_RECOGNITION_CONTRACT
        })
        .collect();
    if recognition_contributions.is_empty() {
        return Err(format!(
            "package {} has no O:I `{WORLD_RECOGNITION_CONTRACT}` contribution",
            manifest.package_ref
        ));
    }

    let mut prepared = Vec::new();
    for contribution in recognition_contributions {
        if !version_at_least(
            WORLD_RECOGNITION_CONTRACT_VERSION,
            &contribution.minimum_contract_version,
        )? {
            return Err(format!(
                "recognition contribution {} requires {}, O:I exposes {}",
                contribution.contribution_ref,
                contribution.minimum_contract_version,
                WORLD_RECOGNITION_CONTRACT_VERSION
            ));
        }
        let artifact = resolve_artifact(&manifest_path, &contribution.artifact)?;
        verify_artifact(&artifact)?;
        prepared.push(RecognitionRegistration {
            package_ref: manifest.package_ref.clone(),
            package_version: manifest.version.clone(),
            source_revision: manifest.source.revision.clone(),
            contribution_ref: contribution.contribution_ref.clone(),
            manifest_path: manifest_path.display().to_string(),
            artifact,
            verification_operation: contribution.native_verification.operation.clone(),
            embedded: false,
        });
    }

    let mut registry = load_registry(registry_path)?;
    for registration in &prepared {
        if let Some(index) = registry
            .registrations
            .iter()
            .position(|existing| existing.contribution_ref == registration.contribution_ref)
        {
            registry.registrations[index] = registration.clone();
        } else {
            registry.registrations.push(registration.clone());
        }
    }
    registry
        .registrations
        .sort_by(|left, right| left.contribution_ref.cmp(&right.contribution_ref));
    save_registry(registry_path, &registry)?;
    Ok(prepared)
}

pub fn unregister_recognition_contribution(
    contribution_ref: &str,
    registry_path: &Path,
) -> Result<bool, String> {
    if embedded_registrations()?
        .iter()
        .any(|registration| registration.contribution_ref == contribution_ref)
    {
        return Err(format!(
            "{contribution_ref} is an embedded first-party recognition contribution"
        ));
    }
    let mut registry = load_registry(registry_path)?;
    let before = registry.registrations.len();
    registry
        .registrations
        .retain(|registration| registration.contribution_ref != contribution_ref);
    if registry.registrations.len() == before {
        return Ok(false);
    }
    save_registry(registry_path, &registry)?;
    Ok(true)
}

pub fn discover_world(
    target: &Path,
    registry_path: &Path,
) -> Result<WorldRecognitionAccount, String> {
    if !target.is_dir() {
        return Err(format!(
            "recognition target is not a directory: {}",
            target.display()
        ));
    }
    let target = absolute_path(target)?;
    let sources = scan_existing_source_apertures(&target)?;
    let mut providers = vec![RecognitionProviderExecution {
        provider_ref: "oi:builtin/source-apertures".to_owned(),
        package_ref: "oi:core".to_owned(),
        status: if sources.is_empty() {
            "not_present".to_owned()
        } else {
            "observed".to_owned()
        },
        detail: format!(
            "{} recognised source/configuration apertures",
            sources.len()
        ),
    }];
    let mut observations = Vec::new();
    let mut extension_requests = Vec::new();
    let mut provider_errors = Vec::new();

    for registration in effective_registrations(registry_path)? {
        match execute_registration(&registration, &target) {
            Ok(Some(result)) => {
                if result.provider_ref != registration.contribution_ref {
                    let message = format!(
                        "recognition provider {} returned provider_ref {}",
                        registration.contribution_ref, result.provider_ref
                    );
                    providers.push(RecognitionProviderExecution {
                        provider_ref: registration.contribution_ref.clone(),
                        package_ref: registration.package_ref.clone(),
                        status: "invalid_result".to_owned(),
                        detail: message.clone(),
                    });
                    provider_errors.push(message);
                    continue;
                }
                let observation_count = result.observations.len();
                let extension_count = result.extension_requests.len();
                observations.extend(result.observations);
                extension_requests.extend(result.extension_requests);
                providers.push(RecognitionProviderExecution {
                    provider_ref: registration.contribution_ref.clone(),
                    package_ref: registration.package_ref.clone(),
                    status: if observation_count == 0 && extension_count == 0 {
                        "not_present".to_owned()
                    } else {
                        "observed".to_owned()
                    },
                    detail: format!(
                        "{observation_count} observations; {extension_count} extension requests"
                    ),
                });
            }
            Ok(None) => providers.push(RecognitionProviderExecution {
                provider_ref: registration.contribution_ref.clone(),
                package_ref: registration.package_ref.clone(),
                status: "not_present".to_owned(),
                detail: "target technology not present in this World".to_owned(),
            }),
            Err(error) => {
                providers.push(RecognitionProviderExecution {
                    provider_ref: registration.contribution_ref.clone(),
                    package_ref: registration.package_ref.clone(),
                    status: "degraded".to_owned(),
                    detail: error.clone(),
                });
                provider_errors.push(format!("{}: {error}", registration.contribution_ref));
            }
        }
    }

    observations.sort_by(|left, right| left.observation_ref.cmp(&right.observation_ref));
    extension_requests.sort_by(|left, right| left.request_ref.cmp(&right.request_ref));

    Ok(WorldRecognitionAccount {
        schema: WORLD_RECOGNITION_ACCOUNT_SCHEMA.to_owned(),
        target: target.display().to_string(),
        sources,
        providers,
        observations,
        owner_participations: Vec::new(),
        owner_contracts: Vec::new(),
        owner_capacities: Vec::new(),
        extension_requests,
        provider_errors,
    })
}

/// Layer machine-global native-tool observation, native-owner participation
/// reconciliation, owner semantic-contract disclosure and the extension frontier
/// over a target-scoped World account. Kept separate from [`discover_world`] so
/// registry/recogniser tests stay isolated from the live machine.
fn enrich_world_account(account: &mut WorldRecognitionAccount) {
    let tool_observations = recognize_installed_native_tools();
    let tool_count = tool_observations.len();
    account.observations.extend(tool_observations);
    account.providers.push(RecognitionProviderExecution {
        provider_ref: "oi:builtin/native-tool-observation".to_owned(),
        package_ref: "oi:core".to_owned(),
        status: if tool_count == 0 {
            "not_present".to_owned()
        } else {
            "observed".to_owned()
        },
        detail: format!("{tool_count} installed native tools observed"),
    });

    account
        .observations
        .sort_by(|left, right| left.observation_ref.cmp(&right.observation_ref));
    account
        .extension_requests
        .sort_by(|left, right| left.request_ref.cmp(&right.request_ref));

    let (owner_participations, participation_errors) = query_owner_participations();
    reconcile_owner_participations(&mut account.observations, &owner_participations);
    account.providers.push(RecognitionProviderExecution {
        provider_ref: "oi:builtin/owner-participation-reconciliation".to_owned(),
        package_ref: "oi:core".to_owned(),
        status: if owner_participations.is_empty() {
            "not_present".to_owned()
        } else {
            "observed".to_owned()
        },
        detail: format!(
            "{} native-owner participations reconciled",
            owner_participations.len()
        ),
    });
    account.provider_errors.extend(participation_errors);
    let mut owner_participations = owner_participations;
    owner_participations.sort_by(|left, right| {
        (&left.owner, &left.native_system.name).cmp(&(&right.owner, &right.native_system.name))
    });
    account.owner_participations = owner_participations;

    let (owner_contracts, contract_errors) = query_owner_contracts();
    account.providers.push(RecognitionProviderExecution {
        provider_ref: "oi:builtin/owner-contract-reconciliation".to_owned(),
        package_ref: "oi:core".to_owned(),
        status: if owner_contracts.is_empty() {
            "not_present".to_owned()
        } else {
            "observed".to_owned()
        },
        detail: format!(
            "{} native-owner contracts disclosed",
            owner_contracts.len()
        ),
    });
    account.provider_errors.extend(contract_errors);
    account.owner_contracts = owner_contracts;

    let (owner_capacities, capacity_errors) = query_owner_capacities();
    account.providers.push(RecognitionProviderExecution {
        provider_ref: "oi:builtin/owner-capacity-reconciliation".to_owned(),
        package_ref: "oi:core".to_owned(),
        status: if owner_capacities.is_empty() {
            "not_present".to_owned()
        } else {
            "observed".to_owned()
        },
        detail: format!(
            "{} native-owner capacities disclosed",
            owner_capacities.len()
        ),
    });
    account.provider_errors.extend(capacity_errors);
    account.owner_capacities = owner_capacities;

    let mut frontier = compose_extension_frontier(&account.observations);
    account.extension_requests.append(&mut frontier);
    account
        .extension_requests
        .sort_by(|left, right| left.request_ref.cmp(&right.request_ref));
    account
        .extension_requests
        .dedup_by(|left, right| left.request_ref == right.request_ref);
}

pub fn state_dir() -> Result<PathBuf, String> {
    if let Some(home) = env::var_os("OI_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home));
    }
    if let Some(xdg) = env::var_os("XDG_CONFIG_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(xdg).join("oi"));
    }
    if let Some(home) = env::var_os("HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(home).join(".config").join("oi"));
    }
    Err("cannot locate O:I state: set OI_HOME or HOME".to_owned())
}

pub fn default_registry_path() -> Result<PathBuf, String> {
    Ok(state_dir()?.join("world-recognition-registry.json"))
}

pub fn discover_ground(target: &Path) -> Result<WorldRecognitionAccount, String> {
    let mut account = discover_world(target, &default_registry_path()?)?;
    enrich_world_account(&mut account);
    Ok(account)
}

fn query_owner_participations() -> (Vec<OwnerParticipation>, Vec<String>) {
    let mut participations = Vec::new();
    let mut errors = Vec::new();
    let Some(aikit) = owner_executable("ai-kit", "aikit") else {
        return (participations, errors);
    };
    let aikit = aikit.display().to_string();

    match run_json_envelope(&aikit, &["mux", "detect", "--json"]) {
        Ok(Some(data)) => participations.extend(aikit_mux_participations(&data)),
        Ok(None) => {}
        Err(error) => errors.push(format!("AIKit mux registry: {error}")),
    }
    match run_json_envelope(&aikit, &["client", "status", "--json"]) {
        Ok(Some(data)) => participations.extend(aikit_client_participations(&data)),
        Ok(None) => {}
        Err(error) => errors.push(format!("AIKit client registry: {error}")),
    }
    (participations, errors)
}

fn run_json_envelope(executable: &str, args: &[&str]) -> Result<Option<Value>, String> {
    let output = Command::new(executable)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("failed to start {executable}: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "{executable} {} exited {}: {}",
            args.join(" "),
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let value: Value = serde_json::from_slice(&output.stdout).map_err(|error| {
        format!(
            "{executable} {} returned invalid JSON: {error}",
            args.join(" ")
        )
    })?;
    if value.get("ok").and_then(Value::as_bool) != Some(true) {
        return Ok(None);
    }
    Ok(value.get("data").cloned())
}

fn run_json_plain(executable: &str, args: &[&str]) -> Result<Option<Value>, String> {
    let output = Command::new(executable)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("failed to start {executable}: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "{executable} {} exited {}: {}",
            args.join(" "),
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let value: Value = serde_json::from_slice(&output.stdout).map_err(|error| {
        format!(
            "{executable} {} returned invalid JSON: {error}",
            args.join(" ")
        )
    })?;
    Ok(Some(value))
}

fn registered_owner_executable(owner_key: &str) -> Option<PathBuf> {
    let composition = state_dir().ok()?.join("composition.json");
    let text = fs::read_to_string(composition).ok()?;
    let value: Value = serde_json::from_str(&text).ok()?;
    let path = value
        .pointer(&format!("/modules/{owner_key}/native_executable"))?
        .as_str()?;
    let path = PathBuf::from(path);
    is_executable(&path).then_some(path)
}

fn owner_executable(owner_key: &str, path_name: &str) -> Option<PathBuf> {
    resolve_executable(path_name).or_else(|| registered_owner_executable(owner_key))
}

fn query_owner_contracts() -> (Vec<OwnerContract>, Vec<String>) {
    let mut contracts = Vec::new();
    let mut errors = Vec::new();
    let Some(actuation) = owner_executable("actuation", "actuation") else {
        return (contracts, errors);
    };
    let actuation = actuation.display().to_string();
    match run_json_plain(&actuation, &["contract", "list", "--json"]) {
        Ok(Some(data)) => contracts.extend(actuation_contracts(&data)),
        Ok(None) => {}
        Err(error) => errors.push(format!("Actuation contract registry: {error}")),
    }
    (contracts, errors)
}

fn actuation_contracts(data: &Value) -> Vec<OwnerContract> {
    let mut out = Vec::new();
    let Some(object) = data.as_object() else {
        return out;
    };
    for (field, contract) in object {
        let Some(contract) = contract.as_str() else {
            continue;
        };
        if !contract.starts_with("actuation.") {
            continue;
        }
        out.push(OwnerContract {
            owner: "Actuation".to_owned(),
            contract: contract.to_owned(),
            field: field.replace('_', "-"),
            provenance: vec!["actuation contract list".to_owned()],
        });
    }
    out.sort_by(|left, right| left.field.cmp(&right.field));
    out
}

fn query_owner_capacities() -> (Vec<OwnerCapacity>, Vec<String>) {
    let mut capacities = Vec::new();
    let mut errors = Vec::new();
    let Some(workcell) = owner_executable("workcell", "workcell") else {
        return (capacities, errors);
    };
    let workcell = workcell.display().to_string();
    match run_json_plain(&workcell, &["providers", "--json"]) {
        Ok(Some(data)) => capacities.extend(workcell_capacities(&data)),
        Ok(None) => {}
        Err(error) => errors.push(format!("Workcell provider registry: {error}")),
    }
    (capacities, errors)
}

fn workcell_capacities(data: &Value) -> Vec<OwnerCapacity> {
    let mut out = Vec::new();
    let Some(providers) = data.get("providers").and_then(Value::as_array) else {
        return out;
    };
    for entry in providers {
        let Some(capacity_ref) = entry.get("provider_ref").and_then(Value::as_str) else {
            continue;
        };
        let health: Vec<String> = entry
            .get("health")
            .and_then(Value::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_default();
        let mut ports: Vec<String> = entry
            .get("ports")
            .and_then(Value::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_default();
        ports.sort();
        ports.dedup();
        let offers = entry.get("offers").and_then(Value::as_array).map(Vec::len);
        let state = if health.iter().any(|entry| entry != "healthy") {
            "degraded".to_owned()
        } else if health.is_empty() {
            "unknown".to_owned()
        } else {
            "healthy".to_owned()
        };

        let mut facts = BTreeMap::new();
        if let Some(offers) = offers {
            facts.insert("offers_count".to_owned(), json!(offers));
        }
        if !health.is_empty() {
            facts.insert("health".to_owned(), json!(health));
        }

        out.push(OwnerCapacity {
            owner: "Workcell".to_owned(),
            capacity_ref: capacity_ref.to_owned(),
            ports,
            state,
            facts,
            provenance: vec!["workcell providers".to_owned()],
        });
    }
    out.sort_by(|left, right| left.capacity_ref.cmp(&right.capacity_ref));
    out
}

fn aikit_mux_participations(data: &Value) -> Vec<OwnerParticipation> {
    let active = data.get("active").and_then(Value::as_str).map(str::to_owned);
    let active_stack: Vec<String> = data
        .get("active_stack")
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default();
    let mut out = Vec::new();
    let Some(detected) = data.get("detected").and_then(Value::as_array) else {
        return out;
    };
    for entry in detected {
        let Some(mux) = entry.get("mux").and_then(Value::as_str) else {
            continue;
        };
        if mux == "plain" {
            continue;
        }
        let installed = entry
            .get("installed")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let running = entry
            .get("server_running")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let inside = entry
            .get("inside")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let version = entry.get("version").and_then(Value::as_str).map(str::to_owned);
        let binary = entry.get("binary").and_then(Value::as_str).map(str::to_owned);
        let remote_tmux = entry.get("remote_tmux").and_then(Value::as_bool);
        let detail = entry.get("detail").and_then(Value::as_str).map(str::to_owned);

        let state = if !installed {
            "not-installed".to_owned()
        } else if active.as_deref() == Some(mux) && running {
            "active".to_owned()
        } else if running {
            "installed-running".to_owned()
        } else {
            "installed-not-running".to_owned()
        };

        let mut readiness = BTreeMap::new();
        readiness.insert("installed".to_owned(), json!(installed));
        readiness.insert("server_running".to_owned(), json!(running));
        readiness.insert("inside".to_owned(), json!(inside));
        if let Some(remote) = remote_tmux {
            readiness.insert("remote_tmux".to_owned(), json!(remote));
        }
        if let Some(active) = active.as_ref() {
            readiness.insert("active".to_owned(), json!(active));
        }
        if !active_stack.is_empty() {
            readiness.insert("active_stack".to_owned(), json!(active_stack));
        }
        if let Some(detail) = detail {
            readiness.insert("detail".to_owned(), json!(detail));
        }

        out.push(OwnerParticipation {
            owner: "AIKit".to_owned(),
            native_system: NativeSystemObservation {
                system_ref: format!("native:{mux}:local"),
                kind: "working-environment".to_owned(),
                name: mux.to_owned(),
                version,
                locator: binary,
                source_revision: None,
            },
            contract: "aikit.working-environment-provider/v1".to_owned(),
            state,
            readiness,
            canonical_ref: None,
            provenance: vec![
                format!("AIKit crates/aikit-adapters/src/mux/{mux}.rs"),
                "aikit mux detect".to_owned(),
            ],
            faculties: vec![
                "session".to_owned(),
                "pane".to_owned(),
                "surface".to_owned(),
            ],
        });
    }
    out
}

fn aikit_client_participations(data: &Value) -> Vec<OwnerParticipation> {
    let mut out = Vec::new();
    let Some(clients) = data.get("clients").and_then(Value::as_array) else {
        return out;
    };
    for entry in clients {
        let Some(client) = entry.get("client").and_then(Value::as_str) else {
            continue;
        };
        // AIKit's broker is its own disclosure surface, not an external harness.
        if client == "broker" {
            continue;
        }
        let installed = entry
            .get("installed")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let error = entry.get("error").and_then(Value::as_str).map(str::to_owned);
        let effect = entry.get("effect").and_then(Value::as_str).map(str::to_owned);
        let items = entry.get("items").and_then(Value::as_u64);
        let config_dir = entry
            .get("config_dir")
            .and_then(Value::as_str)
            .map(str::to_owned);

        let unprojected = error
            .as_deref()
            .map(|error| error.contains("not yet projected"))
            .unwrap_or(false)
            || effect
                .as_deref()
                .map(|effect| effect.contains("not yet projected"))
                .unwrap_or(false);
        let state = if !installed {
            "not-installed".to_owned()
        } else if unprojected {
            "installed-unprojected".to_owned()
        } else if error.is_some() {
            "degraded".to_owned()
        } else {
            "installed".to_owned()
        };

        let mut readiness = BTreeMap::new();
        readiness.insert("installed".to_owned(), json!(installed));
        if let Some(items) = items {
            readiness.insert("items".to_owned(), json!(items));
        }
        if let Some(effect) = effect {
            readiness.insert("effect".to_owned(), json!(effect));
        }
        if let Some(config_dir) = config_dir {
            readiness.insert("config_dir".to_owned(), json!(config_dir));
        }
        if let Some(error) = error {
            readiness.insert("error".to_owned(), json!(error));
        }

        out.push(OwnerParticipation {
            owner: "AIKit".to_owned(),
            native_system: NativeSystemObservation {
                system_ref: format!("native:{client}:local"),
                kind: "harness".to_owned(),
                name: client.to_owned(),
                version: None,
                locator: None,
                source_revision: None,
            },
            contract: "aikit.client-adapter/v1".to_owned(),
            state,
            readiness,
            canonical_ref: None,
            provenance: vec![
                format!("AIKit crates/aikit-adapters/src/clients/{client}.rs"),
                "aikit client status (operative capability projection)".to_owned(),
            ],
            faculties: vec!["skill-projection".to_owned()],
        });
    }
    out
}

fn reconcile_owner_participations(
    observations: &mut [RecognitionObservation],
    participations: &[OwnerParticipation],
) {
    for participation in participations {
        for observation in observations.iter_mut() {
            if !native_system_matches(&observation.native_system, &participation.native_system) {
                continue;
            }
            if observation.owner_bindings.iter().any(|binding| {
                binding.owner == participation.owner && binding.contract == participation.contract
            }) {
                continue;
            }
            observation.owner_bindings.push(OwnerParticipationBinding {
                owner: participation.owner.clone(),
                contract: participation.contract.clone(),
                state: participation.state.clone(),
                canonical_ref: participation.canonical_ref.clone(),
                provenance: participation.provenance.clone(),
            });
        }
    }
}

fn native_system_matches(left: &NativeSystemObservation, right: &NativeSystemObservation) -> bool {
    left.name.eq_ignore_ascii_case(&right.name) || left.system_ref == right.system_ref
}

/// One entry in the built-in native-tool registry.
///
/// The registry itself is data, not code: `native_tools.json` ships the curated
/// floor and this struct + [`recognize_installed_native_tools`] are the generic
/// observation engine. Adding a tool edits JSON, not Rust. Anything richer or
/// newer registers through the public `oi.world-recognition/v1` package path
/// (as cmux and Herdr already do) — no source change at all. Version is always
/// read from the live machine; nothing here asserts a fixed revision.
#[derive(Debug, Clone, Deserialize)]
struct NativeToolEntry {
    name: String,
    /// Native taxonomy: harness, agent, model-provider, material-executor,
    /// working-environment, collaboration-client.
    kind: String,
    /// Version probe arguments. Empty means the tool exposes no version flag;
    /// presence is still recorded and the probe gap is a fact, not an error.
    #[serde(default)]
    version_args: Vec<String>,
    /// When set, observe machine-global service state from this home-relative
    /// directory instead of probing a PATH binary (e.g. a daemon).
    #[serde(default)]
    service_dir: Option<String>,
}

const NATIVE_TOOL_REGISTRY_JSON: &str = include_str!("native_tools.json");

fn native_tool_registry() -> Vec<NativeToolEntry> {
    serde_json::from_str(NATIVE_TOOL_REGISTRY_JSON).unwrap_or_default()
}

/// Observe installed harnesses, agents, model providers, material executors and
/// collaboration clients without claiming any owner participation. Presence,
/// version and degraded state are whole-level O:I facts; which native owner can
/// do something with them is composed separately by owner-participation
/// reconciliation. Versions are read live — never asserted — so a tool upgrade
/// is an observation, not a failure.
fn recognize_installed_native_tools() -> Vec<RecognitionObservation> {
    let mut observations = Vec::new();
    for entry in native_tool_registry() {
        if let Some(service_dir) = entry.service_dir.as_deref() {
            if let Some(observation) = recognize_service_tool(&entry, service_dir) {
                observations.push(observation);
            }
            continue;
        }
        let Some(locator) = resolve_executable(&entry.name) else {
            continue;
        };
        observations.push(recognize_binary_tool(&entry, &locator));
    }
    observations
}

fn recognize_binary_tool(
    entry: &NativeToolEntry,
    locator: &std::path::Path,
) -> RecognitionObservation {
    let mut facts = BTreeMap::new();
    let (version, degraded, detail, source_revision, evidence) =
        if entry.version_args.is_empty() {
            facts.insert("version_flag".to_owned(), json!("none"));
            (
                None,
                false,
                None,
                None,
                vec![RecognitionEvidence {
                    kind: "native-presence".to_owned(),
                    source: locator.display().to_string(),
                    detail: format!("{} installed; exposes no version flag", entry.name),
                }],
            )
        } else {
            let output = Command::new(locator)
                .args(&entry.version_args)
                .stdin(Stdio::null())
                .output();
            match output {
                Ok(output) => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let (version, degraded, detail) =
                        classify_probe(output.status.success(), &stdout, &stderr);
                    let source_revision =
                        version.as_deref().and_then(parse_upstream_revision);
                    (
                        version,
                        degraded,
                        detail,
                        source_revision,
                        vec![RecognitionEvidence {
                            kind: "native-command".to_owned(),
                            source: locator.display().to_string(),
                            detail: format!(
                                "{} {}",
                                entry.name,
                                entry.version_args.join(" ")
                            ),
                        }],
                    )
                }
                Err(error) => (
                    None,
                    true,
                    Some(format!("failed to probe: {error}")),
                    None,
                    vec![RecognitionEvidence {
                        kind: "native-command".to_owned(),
                        source: locator.display().to_string(),
                        detail: format!("probe failed: {error}"),
                    }],
                ),
            }
        };

    facts.insert("degraded".to_owned(), json!(degraded));
    if let Some(detail) = detail {
        facts.insert("detail".to_owned(), json!(detail));
    }

    RecognitionObservation {
        observation_ref: format!("observation:{}:local", entry.name),
        native_system: NativeSystemObservation {
            system_ref: format!("native:{}:local", entry.name),
            kind: entry.kind.to_owned(),
            name: entry.name.to_owned(),
            version,
            locator: Some(locator.display().to_string()),
            source_revision,
        },
        support: "observed".to_owned(),
        faculties: Vec::new(),
        relations: Vec::new(),
        facts,
        owner_bindings: Vec::new(),
        evidence,
    }
}

/// Observe a home-relative service/daemon from its own machine-global state
/// files rather than a PATH binary. Never invents a locator or a version.
fn recognize_service_tool(
    entry: &NativeToolEntry,
    service_dir: &str,
) -> Option<RecognitionObservation> {
    let home = std::env::var_os("HOME")?;
    let root = std::path::PathBuf::from(home).join(service_dir);
    if !root.is_dir() {
        return None;
    }

    let mut facts = BTreeMap::new();
    let mut version = None;
    let mut running = false;
    let mut evidence = Vec::new();

    if let Ok(daemon) = std::fs::read_to_string(root.join("local-exec-daemon.json")) {
        if let Ok(value) = serde_json::from_str::<Value>(&daemon) {
            running = value.get("pid").and_then(Value::as_i64).is_some();
            if let Some(pid) = value.get("pid").and_then(Value::as_i64) {
                facts.insert("pid".to_owned(), json!(pid));
            }
            if let Some(generation) = value.get("generation").and_then(Value::as_i64) {
                facts.insert("generation".to_owned(), json!(generation));
            }
            evidence.push(RecognitionEvidence {
                kind: "service-state".to_owned(),
                source: root.join("local-exec-daemon.json").display().to_string(),
                detail: "daemon state read live".to_owned(),
            });
        }
    }
    if let Ok(settings) = std::fs::read_to_string(root.join("settings.json")) {
        if let Ok(value) = serde_json::from_str::<Value>(&settings) {
            if let Some(schema) = value.get("version").and_then(Value::as_i64) {
                version = Some(format!("settings schema {schema}"));
            }
            evidence.push(RecognitionEvidence {
                kind: "service-settings".to_owned(),
                source: root.join("settings.json").display().to_string(),
                detail: "settings read live".to_owned(),
            });
        }
    }

    facts.insert("running".to_owned(), json!(running));
    facts.insert("degraded".to_owned(), json!(false));
    if evidence.is_empty() {
        facts.insert(
            "detail".to_owned(),
            json!("service directory present; no readable state files"),
        );
        evidence.push(RecognitionEvidence {
            kind: "service-presence".to_owned(),
            source: root.display().to_string(),
            detail: "service directory present".to_owned(),
        });
    }

    Some(RecognitionObservation {
        observation_ref: format!("observation:{}:local", entry.name),
        native_system: NativeSystemObservation {
            system_ref: format!("native:{}:local", entry.name),
            kind: entry.kind.to_owned(),
            name: entry.name.to_owned(),
            version,
            locator: Some(root.display().to_string()),
            source_revision: None,
        },
        support: "observed".to_owned(),
        faculties: Vec::new(),
        relations: Vec::new(),
        facts,
        owner_bindings: Vec::new(),
        evidence,
    })
}

/// Recover an upstream source revision from a version banner that carries one
/// (e.g. Hermes: `Hermes Agent v0.20.5 · upstream 6607f706 · local ab0d9841`).
fn parse_upstream_revision(version: &str) -> Option<String> {
    let marker = "upstream ";
    let index = version.find(marker)?;
    let rest = &version[index + marker.len()..];
    let token = rest.split_whitespace().next()?;
    let token = token.trim_end_matches(',').trim_end_matches('·');
    if token.chars().all(|c| c.is_ascii_hexdigit()) && !token.is_empty() {
        Some(token.to_owned())
    } else {
        None
    }
}

fn classify_probe(
    status_success: bool,
    stdout: &str,
    stderr: &str,
) -> (Option<String>, bool, Option<String>) {
    // A multi-line banner (Hermes, some SDKs) still yields one clean version
    // line; the rest is noise for the version field, not lost evidence.
    let version = stdout
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_owned);
    if status_success {
        (version, false, None)
    } else {
        let detail = if stderr.trim().is_empty() {
            "probe exited non-zero without stderr".to_owned()
        } else {
            stderr.trim().to_owned()
        };
        (version, true, Some(detail))
    }
}

const EXTENSION_OWNERS: &[(&str, &str, &str, &str)] = &[
    // (native kind, owner, sdk, authoring domain)
    (
        "harness",
        "Actuation",
        "actuation.model-bearing/v1",
        "model-bearing",
    ),
    (
        "agent",
        "Actuation",
        "actuation.model-bearing/v1",
        "model-bearing",
    ),
    (
        "model-provider",
        "Actuation",
        "actuation.model-bearing/v1",
        "model-bearing",
    ),
    (
        "material-executor",
        "Workcell",
        "workcell.provider-sdk/v1",
        "provider",
    ),
];

/// Emit the extension path for recognised systems that no installed owner
/// currently participates in. Degraded systems are a repair concern, not a
/// missing-support concern, and are excluded. The routing follows native
/// ownership: model/harness/agent-instance goes to Actuation, material
/// execution to Workcell.
fn compose_extension_frontier(
    observations: &[RecognitionObservation],
) -> Vec<RecognitionExtensionRequest> {
    let mut requests = Vec::new();
    for observation in observations {
        if !observation.owner_bindings.is_empty() {
            continue;
        }
        if observation
            .facts
            .get("degraded")
            .and_then(Value::as_bool)
            == Some(true)
        {
            continue;
        }
        let Some((kind, owner, sdk, domain)) = EXTENSION_OWNERS
            .iter()
            .find(|(kind, _, _, _)| *kind == observation.native_system.kind)
        else {
            continue;
        };
        let name = observation.native_system.name.as_str();
        requests.push(RecognitionExtensionRequest {
            request_ref: format!("extension:{name}:{owner}"),
            native_system_ref: observation.native_system.system_ref.clone(),
            owner: (*owner).to_owned(),
            reason: format!(
                "{kind} present with no installed owner participation",
            ),
            sdk: (*sdk).to_owned(),
            authoring_skill: format!("{owner} {domain} authoring Skill"),
            conformance: format!("{sdk} conformance"),
            package_target: "oi.package/v1".to_owned(),
        });
    }
    requests
}

fn embedded_registrations() -> Result<Vec<RecognitionRegistration>, String> {
    let manifest = parse_manifest(EMBEDDED_HERDR_PACKAGE)?;
    manifest
        .contributions
        .iter()
        .filter(|contribution| {
            contribution.target_product == "oi"
                && contribution.target_contract == WORLD_RECOGNITION_CONTRACT
        })
        .map(|contribution| {
            Ok(RecognitionRegistration {
                package_ref: manifest.package_ref.clone(),
                package_version: manifest.version.clone(),
                source_revision: manifest.source.revision.clone(),
                contribution_ref: contribution.contribution_ref.clone(),
                manifest_path: "embedded:packages/examples/herdr-recognition.json".to_owned(),
                artifact: contribution.artifact.clone(),
                verification_operation: contribution.native_verification.operation.clone(),
                embedded: true,
            })
        })
        .collect()
}

fn execute_registration(
    registration: &RecognitionRegistration,
    target: &Path,
) -> Result<Option<RecognitionProviderResult>, String> {
    if registration.artifact == "builtin:herdr" {
        return recognize_herdr(&registration.contribution_ref, target);
    }
    let output = Command::new(&registration.artifact)
        .args(["discover", "--target"])
        .arg(target)
        .arg("--json")
        .stdin(Stdio::null())
        .output()
        .map_err(|error| {
            format!(
                "failed to start recognition artifact {}: {error}",
                registration.artifact
            )
        })?;
    if !output.status.success() {
        return Err(format!(
            "recognition artifact {} exited {}: {}",
            registration.artifact,
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let result: RecognitionProviderResult =
        serde_json::from_slice(&output.stdout).map_err(|error| {
            format!(
                "recognition artifact {} returned invalid JSON: {error}",
                registration.artifact
            )
        })?;
    validate_provider_result(&result)?;
    Ok(Some(result))
}

fn validate_provider_result(result: &RecognitionProviderResult) -> Result<(), String> {
    if result.schema != WORLD_RECOGNITION_RESULT_SCHEMA {
        return Err(format!(
            "unsupported recognition result schema `{}`; expected `{WORLD_RECOGNITION_RESULT_SCHEMA}`",
            result.schema
        ));
    }
    if result.provider_ref.trim().is_empty() {
        return Err("recognition provider_ref must not be empty".to_owned());
    }
    let mut observation_refs = BTreeSet::new();
    for observation in &result.observations {
        if observation.observation_ref.trim().is_empty()
            || observation.native_system.system_ref.trim().is_empty()
            || observation.native_system.kind.trim().is_empty()
            || observation.native_system.name.trim().is_empty()
            || observation.support.trim().is_empty()
        {
            return Err(
                "recognition observation identity/kind/name/support must not be empty".to_owned(),
            );
        }
        if !observation_refs.insert(observation.observation_ref.as_str()) {
            return Err(format!(
                "duplicate observation_ref `{}`",
                observation.observation_ref
            ));
        }
    }
    let mut extension_refs = BTreeSet::new();
    for request in &result.extension_requests {
        if request.request_ref.trim().is_empty()
            || request.native_system_ref.trim().is_empty()
            || request.owner.trim().is_empty()
            || request.sdk.trim().is_empty()
            || request.authoring_skill.trim().is_empty()
            || request.conformance.trim().is_empty()
            || request.package_target.trim().is_empty()
        {
            return Err("recognition extension request fields must not be empty".to_owned());
        }
        if !extension_refs.insert(request.request_ref.as_str()) {
            return Err(format!(
                "duplicate extension request `{}`",
                request.request_ref
            ));
        }
    }
    Ok(())
}

fn verify_artifact(artifact: &str) -> Result<(), String> {
    if artifact == "builtin:herdr" {
        return Ok(());
    }
    let output = Command::new(artifact)
        .args(["verify", "--json"])
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("failed to verify recognition artifact {artifact}: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "recognition artifact verification failed for {artifact}: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let verification: RecognitionVerificationResult = serde_json::from_slice(&output.stdout)
        .map_err(|error| {
            format!("recognition artifact {artifact} returned invalid verification JSON: {error}")
        })?;
    if verification.schema != WORLD_RECOGNITION_VERIFICATION_SCHEMA || !verification.ok {
        return Err(format!(
            "recognition artifact {artifact} did not return a successful `{WORLD_RECOGNITION_VERIFICATION_SCHEMA}` receipt"
        ));
    }
    Ok(())
}

fn resolve_artifact(manifest_path: &Path, artifact: &str) -> Result<String, String> {
    if artifact.starts_with("builtin:") {
        return match artifact {
            "builtin:herdr" => Ok(artifact.to_owned()),
            _ => Err(format!(
                "unknown built-in recognition artifact `{artifact}`"
            )),
        };
    }
    let path = Path::new(artifact);
    let resolved = if path.is_absolute() {
        path.to_path_buf()
    } else {
        manifest_path
            .parent()
            .ok_or_else(|| "package manifest path has no parent".to_owned())?
            .join(path)
    };
    let resolved = absolute_path(&resolved)?;
    if !is_executable(&resolved) {
        return Err(format!(
            "recognition artifact is not executable: {}",
            resolved.display()
        ));
    }
    Ok(resolved.display().to_string())
}

fn recognize_herdr(
    provider_ref: &str,
    _target: &Path,
) -> Result<Option<RecognitionProviderResult>, String> {
    let Some(executable) = resolve_executable("herdr") else {
        return Ok(None);
    };
    let snapshot_output = Command::new(&executable)
        .args(["api", "snapshot"])
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("failed to inspect Herdr snapshot: {error}"))?;
    if !snapshot_output.status.success() {
        return Err(format!(
            "Herdr API snapshot failed: {}",
            String::from_utf8_lossy(&snapshot_output.stderr).trim()
        ));
    }
    let snapshot_envelope: Value = serde_json::from_slice(&snapshot_output.stdout)
        .map_err(|error| format!("Herdr API snapshot returned invalid JSON: {error}"))?;
    let snapshot = snapshot_envelope
        .pointer("/result/snapshot")
        .ok_or_else(|| "Herdr API snapshot has no /result/snapshot".to_owned())?;

    let schema_output = Command::new(&executable)
        .args(["api", "schema", "--json"])
        .stdin(Stdio::null())
        .output();
    let schema_value = schema_output
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| serde_json::from_slice::<Value>(&output.stdout).ok());

    let version = snapshot
        .get("version")
        .and_then(Value::as_str)
        .map(str::to_owned);
    let mut faculties = BTreeSet::new();
    for faculty in [
        "server",
        "api",
        "workspace",
        "tab",
        "pane",
        "layout",
        "worktree",
        "process",
        "agent",
        "integration",
        "automation",
        "event",
        "plugin",
        "persistence",
        "remote",
    ] {
        faculties.insert(faculty.to_owned());
    }
    collect_json_paths(snapshot, "snapshot", 0, &mut faculties);
    if let Some(schema) = schema_value.as_ref() {
        collect_json_paths(schema, "schema", 0, &mut faculties);
    }

    let mut facts = BTreeMap::new();
    if let Some(protocol) = snapshot.get("protocol").and_then(Value::as_u64) {
        facts.insert("protocol".to_owned(), json!(protocol));
    }
    for collection in [
        "workspaces",
        "tabs",
        "panes",
        "layouts",
        "worktrees",
        "processes",
        "agents",
        "integrations",
        "plugins",
    ] {
        if let Some(values) = snapshot.get(collection).and_then(Value::as_array) {
            facts.insert(format!("{collection}_count"), json!(values.len()));
        }
    }
    facts.insert(
        "upstream_revision".to_owned(),
        json!(HERDR_UPSTREAM_REVISION),
    );

    let relations = herdr_native_relations(snapshot);
    let observation = RecognitionObservation {
        observation_ref: "observation:herdr:local".to_owned(),
        native_system: NativeSystemObservation {
            system_ref: "native:herdr:local".to_owned(),
            kind: "working-environment".to_owned(),
            name: "Herdr".to_owned(),
            version,
            locator: Some(executable.display().to_string()),
            source_revision: Some(HERDR_UPSTREAM_REVISION.to_owned()),
        },
        support: "supported".to_owned(),
        faculties: faculties.into_iter().collect(),
        relations,
        facts,
        owner_bindings: vec![OwnerParticipationBinding {
            owner: "AIKit".to_owned(),
            contract: HERDR_AIKIT_PROVIDER_CONTRACT.to_owned(),
            state: "accepted-working-environment-provider".to_owned(),
            canonical_ref: None,
            provenance: vec![
                "AIKit crates/aikit-adapters/src/herdr.rs".to_owned(),
                format!("herdrdev/herdr@{HERDR_UPSTREAM_REVISION}"),
            ],
        }],
        evidence: vec![
            RecognitionEvidence {
                kind: "native-command".to_owned(),
                source: executable.display().to_string(),
                detail: "herdr api snapshot".to_owned(),
            },
            RecognitionEvidence {
                kind: "native-command".to_owned(),
                source: executable.display().to_string(),
                detail: "herdr api schema --json when supported".to_owned(),
            },
        ],
    };
    Ok(Some(RecognitionProviderResult {
        schema: WORLD_RECOGNITION_RESULT_SCHEMA.to_owned(),
        provider_ref: provider_ref.to_owned(),
        observations: vec![observation],
        extension_requests: Vec::new(),
    }))
}

fn herdr_native_relations(snapshot: &Value) -> Vec<NativeRelationObservation> {
    let mut relations = Vec::new();
    if let Some(tabs) = snapshot.get("tabs").and_then(Value::as_array) {
        for tab in tabs {
            if let (Some(tab_id), Some(workspace_id)) = (
                tab.get("tab_id").and_then(Value::as_str),
                tab.get("workspace_id").and_then(Value::as_str),
            ) {
                relations.push(NativeRelationObservation {
                    relation: "workspace_contains_tab".to_owned(),
                    from_ref: format!("herdr:workspace:{workspace_id}"),
                    to_ref: format!("herdr:tab:{tab_id}"),
                    evidence: Some("Herdr native snapshot".to_owned()),
                });
            }
        }
    }
    if let Some(panes) = snapshot.get("panes").and_then(Value::as_array) {
        for pane in panes {
            if let (Some(pane_id), Some(tab_id)) = (
                pane.get("pane_id").and_then(Value::as_str),
                pane.get("tab_id").and_then(Value::as_str),
            ) {
                relations.push(NativeRelationObservation {
                    relation: "tab_contains_pane".to_owned(),
                    from_ref: format!("herdr:tab:{tab_id}"),
                    to_ref: format!("herdr:pane:{pane_id}"),
                    evidence: Some("Herdr native snapshot".to_owned()),
                });
            }
        }
    }
    if let Some(agents) = snapshot.get("agents").and_then(Value::as_array) {
        for agent in agents {
            let pane_id = agent.get("pane_id").and_then(Value::as_str);
            let agent_id = agent
                .get("terminal_id")
                .and_then(Value::as_str)
                .or_else(|| agent.get("name").and_then(Value::as_str));
            if let (Some(agent_id), Some(pane_id)) = (agent_id, pane_id) {
                relations.push(NativeRelationObservation {
                    relation: "agent_observed_in_pane".to_owned(),
                    from_ref: format!("herdr:agent:{agent_id}"),
                    to_ref: format!("herdr:pane:{pane_id}"),
                    evidence: Some("Herdr native snapshot".to_owned()),
                });
            }
        }
    }
    relations
}

fn collect_json_paths(value: &Value, prefix: &str, depth: usize, paths: &mut BTreeSet<String>) {
    if depth >= 4 || paths.len() >= 256 {
        return;
    }
    match value {
        Value::Object(map) => {
            for (key, child) in map {
                if paths.len() >= 256 {
                    break;
                }
                let path = format!("{prefix}.{key}");
                paths.insert(path.clone());
                collect_json_paths(child, &path, depth + 1, paths);
            }
        }
        Value::Array(values) => {
            if let Some(first) = values.first() {
                collect_json_paths(first, &format!("{prefix}[]"), depth + 1, paths);
            }
        }
        _ => {}
    }
}

fn absolute_path(path: &Path) -> Result<PathBuf, String> {
    if path.is_absolute() {
        Ok(path.to_path_buf())
    } else {
        env::current_dir()
            .map(|cwd| cwd.join(path))
            .map_err(|error| format!("cannot resolve current directory: {error}"))
    }
}

fn resolve_executable(candidate: &str) -> Option<PathBuf> {
    let path = Path::new(candidate);
    if path.components().count() > 1 || path.is_absolute() {
        return is_executable(path).then(|| path.to_path_buf());
    }
    env::var_os("PATH").and_then(|paths| {
        env::split_paths(&paths)
            .map(|directory| directory.join(candidate))
            .find(|path| is_executable(path))
    })
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

fn version_at_least(observed: &str, required: &str) -> Result<bool, String> {
    fn parse(value: &str) -> Result<Vec<u64>, String> {
        value
            .split('.')
            .map(|part| {
                part.parse::<u64>()
                    .map_err(|_| format!("invalid numeric version `{value}`"))
            })
            .collect()
    }
    let mut observed = parse(observed)?;
    let mut required = parse(required)?;
    let width = observed.len().max(required.len());
    observed.resize(width, 0);
    required.resize(width, 0);
    Ok(observed >= required)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn fixture(name: &str) -> PathBuf {
        let root = env::temp_dir().join(format!(
            "oi-world-recognition-{name}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn source_aperture_scan_is_a_provider_over_existing_native_world() {
        let root = fixture("sources");
        fs::create_dir_all(root.join("ProjectCentral/user")).unwrap();
        fs::create_dir_all(root.join(".claude/skills/demo")).unwrap();
        let sources = scan_existing_source_apertures(&root).unwrap();
        assert!(sources
            .iter()
            .any(|source| source.path == "ProjectCentral/user"));
        assert!(sources.iter().any(|source| source.path == ".claude/skills"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn embedded_herdr_package_is_a_real_oi_recognition_contribution() {
        let registrations = embedded_registrations().unwrap();
        assert_eq!(registrations.len(), 1);
        assert_eq!(
            registrations[0].contribution_ref,
            "contribution:herdr/world-recognition"
        );
        assert_eq!(registrations[0].artifact, "builtin:herdr");
        assert!(registrations[0].embedded);
    }

    #[cfg(unix)]
    #[test]
    fn registering_conformant_adapter_changes_the_next_world_reading() {
        use std::os::unix::fs::PermissionsExt;

        let root = fixture("adapter");
        let registry = root.join("registry.json");
        let target = root.join("world");
        fs::create_dir_all(&target).unwrap();
        let before = discover_world(&target, &registry).unwrap();
        assert!(!before
            .observations
            .iter()
            .any(|observation| observation.native_system.name == "FixtureTool"));

        let recognizer = root.join("recognizer.sh");
        fs::write(
            &recognizer,
            r#"#!/bin/sh
if [ "$1" = "verify" ]; then
  printf '%s\n' '{"schema":"oi.world-recognition-verification/v1","ok":true,"evidence":["fixture-self-test"]}'
  exit 0
fi
printf '%s\n' '{"schema":"oi.world-recognition-result/v1","provider_ref":"contribution:fixture/world-recognition","observations":[{"observation_ref":"observation:fixture:local","native_system":{"system_ref":"native:fixture:local","kind":"tool","name":"FixtureTool","version":"1.0.0"},"support":"supported","faculties":["demo"],"relations":[],"facts":{},"owner_bindings":[],"evidence":[{"kind":"fixture","source":"recognizer.sh","detail":"deterministic"}]}],"extension_requests":[]}'
"#,
        )
        .unwrap();
        let mut permissions = fs::metadata(&recognizer).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&recognizer, permissions).unwrap();
        let manifest = root.join("package.json");
        fs::write(
            &manifest,
            r#"{
  "schema":"oi.package/v1",
  "package_ref":"package:fixture/recognition",
  "version":"1.0.0",
  "source":{"kind":"fixture","locator":"local","revision":"r1"},
  "contributions":[{
    "contribution_ref":"contribution:fixture/world-recognition",
    "target_product":"oi",
    "target_contract":"oi.world-recognition/v1",
    "minimum_contract_version":"1.0.0",
    "artifact":"recognizer.sh",
    "permissions":[],"effects":[],
    "native_verification":{"operation":"recognizer.sh verify --json","evidence_format":"oi.world-recognition-verification/v1"}
  }]
}"#,
        )
        .unwrap();

        register_recognition_package(&manifest, &registry).unwrap();
        let after = discover_world(&target, &registry).unwrap();
        assert!(after
            .observations
            .iter()
            .any(|observation| observation.native_system.name == "FixtureTool"));
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn unsupported_target_can_return_owner_sdk_extension_path() {
        use std::os::unix::fs::PermissionsExt;

        let root = fixture("extension");
        let registry = root.join("registry.json");
        let target = root.join("world");
        fs::create_dir_all(&target).unwrap();
        let recognizer = root.join("recognizer.sh");
        fs::write(
            &recognizer,
            r#"#!/bin/sh
if [ "$1" = "verify" ]; then
  printf '%s\n' '{"schema":"oi.world-recognition-verification/v1","ok":true}'
  exit 0
fi
printf '%s\n' '{"schema":"oi.world-recognition-result/v1","provider_ref":"contribution:unknown/world-recognition","observations":[{"observation_ref":"observation:unknown:local","native_system":{"system_ref":"native:unknown:local","kind":"harness","name":"UnknownHarness","version":"0.1.0"},"support":"extension_required","faculties":["prompt","tool"],"relations":[],"facts":{},"owner_bindings":[],"evidence":[]}],"extension_requests":[{"request_ref":"extension:unknown:aikit","native_system_ref":"native:unknown:local","owner":"AIKit","reason":"harness adapter absent","sdk":"aikit.harness-adapter/v1","authoring_skill":"AIKit harness adapter authoring Skill","conformance":"aikit harness adapter conformance","package_target":"oi.package/v1"}]}'
"#,
        )
        .unwrap();
        let mut permissions = fs::metadata(&recognizer).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&recognizer, permissions).unwrap();
        let manifest = root.join("package.json");
        fs::write(
            &manifest,
            r#"{
  "schema":"oi.package/v1",
  "package_ref":"package:unknown/recognition",
  "version":"1.0.0",
  "source":{"kind":"fixture","locator":"local","revision":"r1"},
  "contributions":[{
    "contribution_ref":"contribution:unknown/world-recognition",
    "target_product":"oi",
    "target_contract":"oi.world-recognition/v1",
    "minimum_contract_version":"1.0.0",
    "artifact":"recognizer.sh",
    "native_verification":{"operation":"recognizer.sh verify --json"}
  }]
}"#,
        )
        .unwrap();
        register_recognition_package(&manifest, &registry).unwrap();
        let account = discover_world(&target, &registry).unwrap();
        assert_eq!(account.extension_requests.len(), 1);
        let request = &account.extension_requests[0];
        assert_eq!(request.owner, "AIKit");
        assert_eq!(request.sdk, "aikit.harness-adapter/v1");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn herdr_snapshot_relations_keep_native_ids_native() {
        let snapshot: Value = serde_json::from_str(
            r#"{
              "version":"0.9.0","protocol":7,
              "workspaces":[{"workspace_id":"w1"}],
              "tabs":[{"tab_id":"t1","workspace_id":"w1"}],
              "panes":[{"pane_id":"p1","tab_id":"t1"}],
              "agents":[{"terminal_id":"a1","pane_id":"p1"}],
              "plugins":[{"name":"fixture"}]
            }"#,
        )
        .unwrap();
        let relations = herdr_native_relations(&snapshot);
        assert!(relations.iter().any(|relation| {
            relation.from_ref == "herdr:workspace:w1" && relation.to_ref == "herdr:tab:t1"
        }));
        assert!(relations.iter().any(|relation| {
            relation.from_ref == "herdr:agent:a1" && relation.to_ref == "herdr:pane:p1"
        }));
    }

    #[test]
    fn aikit_mux_detect_discloses_tmux_and_cmux_as_owner_participations() {
        let data: Value = serde_json::from_str(
            r#"{
              "active": "plain",
              "active_stack": ["plain"],
              "declared": null,
              "detected": [
                {"binary":"/opt/homebrew/bin/tmux","installed":true,"mux":"tmux","server_running":true,"version":"3.6a","inside":false},
                {"binary":"/Applications/cmux.app/Contents/Resources/bin/cmux","installed":true,"mux":"cmux","server_running":false,"version":"cmux 0.64.22 (102) [ddd4a01bc]","inside":false},
                {"binary":null,"installed":true,"mux":"plain","server_running":true,"inside":true}
              ]
            }"#,
        )
        .unwrap();
        let participations = aikit_mux_participations(&data);
        assert_eq!(participations.len(), 2);
        let tmux = participations
            .iter()
            .find(|participation| participation.native_system.name == "tmux")
            .unwrap();
        assert_eq!(tmux.contract, "aikit.working-environment-provider/v1");
        assert_eq!(tmux.state, "installed-running");
        assert_eq!(tmux.owner, "AIKit");
        let cmux = participations
            .iter()
            .find(|participation| participation.native_system.name == "cmux")
            .unwrap();
        assert_eq!(cmux.state, "installed-not-running");
        assert_eq!(
            cmux.readiness.get("server_running"),
            Some(&serde_json::json!(false))
        );
    }

    #[test]
    fn aikit_client_status_discloses_harness_participations_without_broker() {
        let data: Value = serde_json::from_str(
            r#"{
              "clients": [
                {"client":"claude","config_dir":"/Users/admin/.claude","effect":"restart Claude","error":null,"installed":true,"items":2,"notes":[]},
                {"client":"codex","config_dir":"/Users/admin/.codex","effect":"next session only","error":null,"installed":true,"items":2,"notes":[]},
                {"client":"opencode","config_dir":"/Users/admin/.config/opencode","effect":null,"error":"opencode's skill surface is not yet projected by AIKit","installed":true,"items":null,"notes":[]},
                {"client":"broker","config_dir":"/Users/admin/.aikit","effect":"live","error":null,"installed":true,"items":2,"notes":[]}
              ]
            }"#,
        )
        .unwrap();
        let participations = aikit_client_participations(&data);
        assert_eq!(participations.len(), 3);
        assert!(participations
            .iter()
            .all(|participation| participation.native_system.name != "broker"));
        let claude = participations
            .iter()
            .find(|participation| participation.native_system.name == "claude")
            .unwrap();
        assert_eq!(claude.contract, "aikit.client-adapter/v1");
        assert_eq!(claude.state, "installed");
        let opencode = participations
            .iter()
            .find(|participation| participation.native_system.name == "opencode")
            .unwrap();
        assert_eq!(opencode.state, "installed-unprojected");
    }

    #[test]
    fn reconciliation_attaches_owner_binding_to_matching_observation_without_duplication() {
        let participation = OwnerParticipation {
            owner: "AIKit".to_owned(),
            native_system: NativeSystemObservation {
                system_ref: "native:cmux:local".to_owned(),
                kind: "working-environment".to_owned(),
                name: "cmux".to_owned(),
                version: Some("0.64.22".to_owned()),
                locator: None,
                source_revision: None,
            },
            contract: "aikit.working-environment-provider/v1".to_owned(),
            state: "installed-not-running".to_owned(),
            readiness: BTreeMap::new(),
            canonical_ref: None,
            provenance: vec!["aikit mux detect".to_owned()],
            faculties: vec!["session".to_owned()],
        };
        let observation = RecognitionObservation {
            observation_ref: "observation:cmux:local".to_owned(),
            native_system: NativeSystemObservation {
                system_ref: "native:cmux:local".to_owned(),
                kind: "working-environment".to_owned(),
                name: "cmux".to_owned(),
                version: None,
                locator: None,
                source_revision: None,
            },
            support: "supported".to_owned(),
            faculties: Vec::new(),
            relations: Vec::new(),
            facts: BTreeMap::new(),
            owner_bindings: Vec::new(),
            evidence: Vec::new(),
        };
        let mut observations = vec![observation];
        reconcile_owner_participations(&mut observations, &[participation.clone()]);
        reconcile_owner_participations(&mut observations, &[participation]);
        let observation = &observations[0];
        assert_eq!(observation.owner_bindings.len(), 1);
        assert_eq!(observation.owner_bindings[0].contract, "aikit.working-environment-provider/v1");
        assert_eq!(observation.owner_bindings[0].state, "installed-not-running");
    }

    #[test]
    fn native_system_match_is_case_insensitive_on_name() {
        let left = NativeSystemObservation {
            system_ref: "native:herdr:local".to_owned(),
            kind: "working-environment".to_owned(),
            name: "Herdr".to_owned(),
            version: None,
            locator: None,
            source_revision: None,
        };
        let right = NativeSystemObservation {
            system_ref: "native:herdr:local".to_owned(),
            kind: "working-environment".to_owned(),
            name: "herdr".to_owned(),
            version: None,
            locator: None,
            source_revision: None,
        };
        assert!(native_system_matches(&left, &right));
    }

    #[test]
    fn classify_probe_success_captures_version_without_degradation() {
        let (version, degraded, detail) = classify_probe(true, "claude 2.1.238 (Claude Code)\n", "");
        assert_eq!(version.as_deref(), Some("claude 2.1.238 (Claude Code)"));
        assert!(!degraded);
        assert!(detail.is_none());
    }

    #[test]
    fn classify_probe_failure_is_degraded_with_stderr_detail() {
        let (version, degraded, detail) = classify_probe(
            false,
            "",
            "dyld: Library not loaded: /opt/homebrew/opt/simdjson/lib/libsimdjson.29.dylib",
        );
        assert_eq!(version, None);
        assert!(degraded);
        assert!(detail.unwrap().contains("simdjson"));
    }

    #[test]
    fn classify_probe_failure_without_stderr_is_still_degraded() {
        let (version, degraded, detail) = classify_probe(false, "", "");
        assert_eq!(version, None);
        assert!(degraded);
        assert!(detail.unwrap().contains("non-zero"));
    }

    #[test]
    fn native_tool_registry_uses_lowercase_names_for_owner_join() {
        let registry = native_tool_registry();
        for entry in &registry {
            assert_eq!(entry.name, entry.name.to_lowercase());
            assert!(!entry.kind.is_empty());
        }
        assert!(registry.iter().any(|entry| entry.name == "claude" && !entry.version_args.is_empty()));
        assert!(registry.iter().any(|entry| entry.name == "codex"));
        assert!(registry.iter().any(|entry| entry.name == "hermes"));
        assert!(registry.iter().any(|entry| entry.name == "buzz" && entry.version_args.is_empty()));
        assert!(registry.iter().any(|entry| entry.name == "grok" && entry.service_dir.as_deref() == Some(".grokbot")));
    }

    #[test]
    fn upstream_revision_is_parsed_from_version_banner_without_overclaiming() {
        assert_eq!(
            parse_upstream_revision(
                "Hermes Agent v0.20.5 (2026.8.19) · upstream 6607f706 · local ab0d9841 (+1 carried commit)"
            ),
            Some("6607f706".to_owned())
        );
        assert_eq!(parse_upstream_revision("claude 2.1.238"), None);
        assert_eq!(parse_upstream_revision("some text upstream not-a-hex"), None);
    }

    #[test]
    fn actuation_contract_list_discloses_model_bearing_field_ownership() {
        let data: Value = serde_json::from_str(
            r#"{
              "agency":"actuation.agency/v1",
              "realised":"actuation.realised/v1",
              "stream":"actuation.stream/v1",
              "activity":"actuation.activity/v1",
              "model_bearing":"actuation.model-bearing/v1"
            }"#,
        )
        .unwrap();
        let contracts = actuation_contracts(&data);
        assert_eq!(contracts.len(), 5);
        let model = contracts
            .iter()
            .find(|contract| contract.field == "model-bearing")
            .unwrap();
        assert_eq!(model.contract, "actuation.model-bearing/v1");
        assert_eq!(model.owner, "Actuation");
        assert!(contracts
            .iter()
            .all(|contract| contract.contract.starts_with("actuation.")));
    }

    #[test]
    fn extension_frontier_routes_harness_and_model_to_actuation_and_material_to_workcell() {
        let observed = |name: &str, kind: &str| RecognitionObservation {
            observation_ref: format!("observation:{name}:local"),
            native_system: NativeSystemObservation {
                system_ref: format!("native:{name}:local"),
                kind: kind.to_owned(),
                name: name.to_owned(),
                version: None,
                locator: None,
                source_revision: None,
            },
            support: "observed".to_owned(),
            faculties: Vec::new(),
            relations: Vec::new(),
            facts: BTreeMap::new(),
            owner_bindings: Vec::new(),
            evidence: Vec::new(),
        };
        let mut degraded = observed("broken", "harness");
        degraded.facts.insert("degraded".to_owned(), json!(true));

        let requests = compose_extension_frontier(&[
            observed("pi", "harness"),
            observed("ollama", "model-provider"),
            observed("docker", "material-executor"),
            degraded,
        ]);
        assert_eq!(requests.len(), 3);
        let pi = requests
            .iter()
            .find(|request| request.native_system_ref == "native:pi:local")
            .unwrap();
        assert_eq!(pi.owner, "Actuation");
        assert_eq!(pi.sdk, "actuation.model-bearing/v1");
        let docker = requests
            .iter()
            .find(|request| request.native_system_ref == "native:docker:local")
            .unwrap();
        assert_eq!(docker.owner, "Workcell");
        assert_eq!(docker.sdk, "workcell.provider-sdk/v1");
        assert!(!requests
            .iter()
            .any(|request| request.native_system_ref == "native:broken:local"));
    }

    #[test]
    fn workcell_provider_inventory_discloses_material_capacities() {
        let data: Value = serde_json::from_str(
            r#"{
              "ok": true,
              "providers": [
                {"health":["healthy"],"offers":["offer:host-process"],"ports":["execution"],"provider_ref":"provider:collapsed-local-host-process"},
                {"health":["healthy","healthy"],"offers":["offer:a","offer:b"],"ports":["artifact-storage","artifact-storage"],"provider_ref":"provider:collapsed-local-artifacts"},
                {"health":["degraded"],"offers":["offer:ws"],"ports":["workspace"],"provider_ref":"provider:collapsed-local-workspace"}
              ]
            }"#,
        )
        .unwrap();
        let capacities = workcell_capacities(&data);
        assert_eq!(capacities.len(), 3);
        let execution = capacities
            .iter()
            .find(|capacity| capacity.capacity_ref == "provider:collapsed-local-host-process")
            .unwrap();
        assert_eq!(execution.state, "healthy");
        assert_eq!(execution.ports, vec!["execution".to_owned()]);
        assert_eq!(execution.owner, "Workcell");
        let workspace = capacities
            .iter()
            .find(|capacity| capacity.capacity_ref == "provider:collapsed-local-workspace")
            .unwrap();
        assert_eq!(workspace.state, "degraded");
        let artifacts = capacities
            .iter()
            .find(|capacity| capacity.capacity_ref == "provider:collapsed-local-artifacts")
            .unwrap();
        assert_eq!(artifacts.ports, vec!["artifact-storage".to_owned()]);
        assert_eq!(artifacts.facts.get("offers_count"), Some(&serde_json::json!(2)));
    }
}
