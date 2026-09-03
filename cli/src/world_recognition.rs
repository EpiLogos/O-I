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
const EMBEDDED_HERDR_PACKAGE: &str =
    include_str!("../../packages/examples/herdr-recognition.json");

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
    pub extension_requests: Vec<RecognitionExtensionRequest>,
    #[serde(default)]
    pub provider_errors: Vec<String>,
}

pub fn scan_existing_source_apertures(target: &Path) -> Result<Vec<RecognizedSourceAperture>, String> {
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
    let bytes = fs::read(path)
        .map_err(|error| format!("cannot read recognition registry {}: {error}", path.display()))?;
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
    let input = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("cannot read package manifest {}: {error}", manifest_path.display()))?;
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

pub fn discover_world(target: &Path, registry_path: &Path) -> Result<WorldRecognitionAccount, String> {
    if !target.is_dir() {
        return Err(format!("recognition target is not a directory: {}", target.display()));
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
        detail: format!("{} recognised source/configuration apertures", sources.len()),
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
        extension_requests,
        provider_errors,
    })
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
    let result: RecognitionProviderResult = serde_json::from_slice(&output.stdout).map_err(|error| {
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
            return Err("recognition observation identity/kind/name/support must not be empty".to_owned());
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
            return Err(format!("duplicate extension request `{}`", request.request_ref));
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
    let verification: RecognitionVerificationResult =
        serde_json::from_slice(&output.stdout).map_err(|error| {
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
            _ => Err(format!("unknown built-in recognition artifact `{artifact}`")),
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

fn collect_json_paths(
    value: &Value,
    prefix: &str,
    depth: usize,
    paths: &mut BTreeSet<String>,
) {
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
        assert!(sources.iter().any(|source| source.path == "ProjectCentral/user"));
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
}
