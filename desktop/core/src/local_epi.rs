//! Narrow O:I binding to Epi-owned Pratibimba application providers.
//!
//! Epi owns Personal semantics and protected persistence. O:I invokes the native
//! producer, validates stable contracts and hosts returned refs/readings. It does
//! not reproduce M semantics, implement a chat runtime, or expose protected body
//! content through the generic contribution catalog.

use serde_json::Value;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use crate::{
    host_native_contribution, ActionAvailability, CanonicalActionBinding,
    ContributionAvailability, HostRegion, HostedContribution, NativeContributionReading,
    RefProvenance, SemanticRef,
};

pub const EPI_PERSONAL_450_CONTRIBUTION_REF: &str = "epi.personal.450";
pub const EPI_PERSONAL_450_APPLICATION_SCHEMA: &str = "epi.personal-450-application/v1";
pub const EPI_NARA_DAILY_SCHEMA: &str = "epi.nara-daily-surface/v1";
pub const EPI_NARA_DAILY_PROVIDER_CONTRACT: &str = "epi.nara-daily-provider/v1";
pub const EPI_NARA_SELECTION_SCHEMA: &str = "epi.nara-selection/v1";
pub const EPI_NARA_SENDOFF_ACTION_REF: &str = "epi.action.nara.selection.sendoff";
pub const EPI_NARA_SENDOFF_CAPABILITY_REF: &str = "epi.capability.nara.selected-context";
pub const EPI_EPII_REVIEW_SCHEMA: &str = "epi.personal-epii-review/v1";
pub const EPI_EPII_REVIEW_ACTION_REF: &str = "epi.action.epii.review";
pub const EPI_EPII_REVIEW_CAPABILITY_REF: &str = "epi.capability.epii.personal-review";
pub const EPI_ANUTTARA_GROUND_SCHEMA: &str = "epi.personal-ground-orientation/v1";
pub const EPI_ANUTTARA_GROUND_ACTION_REF: &str = "epi.action.anuttara.ground";
pub const EPI_ANUTTARA_GROUND_CAPABILITY_REF: &str = "epi.capability.bimba.ground-read";
pub const EPI_PERSONAL_PROPOSAL_SCHEMA: &str = "epi.personal-proposal/v1";
pub const EPI_PERSONAL_PROPOSAL_ACTION_REF: &str = "epi.action.personal.proposal";
pub const EPI_PERSONAL_PROPOSAL_CAPABILITY_REF: &str = "epi.capability.personal.proposal";
pub const EPI_NATIVE_OWNER: &str = "epi";

#[derive(Clone, Debug, PartialEq)]
pub struct EpiPersonalHostObservation {
    pub contribution: HostedContribution,
    pub application: Value,
}

pub struct LocalEpiHost {
    executable: PathBuf,
    vak_file: Option<PathBuf>,
    nara_context_file: Option<PathBuf>,
    nara_vault_root: Option<PathBuf>,
}

impl LocalEpiHost {
    pub fn open(executable: impl Into<PathBuf>) -> Self {
        Self {
            executable: executable.into(),
            vak_file: None,
            nara_context_file: None,
            nara_vault_root: None,
        }
    }

    pub fn with_vak_file(mut self, path: impl Into<PathBuf>) -> Self {
        self.vak_file = Some(path.into());
        self
    }

    pub fn with_nara_context_file(mut self, path: impl Into<PathBuf>) -> Self {
        self.nara_context_file = Some(path.into());
        self
    }

    pub fn with_nara_vault_root(mut self, path: impl Into<PathBuf>) -> Self {
        self.nara_vault_root = Some(path.into());
        self
    }

    pub fn available(&self) -> bool {
        self.nara_context_file.is_some() && self.nara_vault_root.is_some()
    }

    pub fn observe_personal(&self) -> Result<EpiPersonalHostObservation, String> {
        self.require_personal()?;
        let application = self.invoke("personal-application", None)?;
        validate_personal_application(&application)?;
        let source_revision = required_string(&application, "/provenance/epiSourceRevision")?;
        let subject_ref = required_string(&application, "/subject/subjectRef")?;
        let revision = application
            .pointer("/subject/episodeRevision")
            .and_then(Value::as_u64)
            .ok_or_else(|| "Personal application requires subject.episodeRevision".to_owned())?;

        let contribution = NativeContributionReading {
            schema: "oi.desktop-host-reading/v1".into(),
            contribution_ref: EPI_PERSONAL_450_CONTRIBUTION_REF.into(),
            native_owner: EPI_NATIVE_OWNER.into(),
            target_contract: Some(EPI_PERSONAL_450_APPLICATION_SCHEMA.into()),
            availability: ContributionAvailability::Ready,
            provenance: RefProvenance {
                source: "EpiLogos/Epi-Logos-C-Experiments::epi-pratibimba-bridge".into(),
                revision: Some(source_revision.clone()),
            },
            regions: vec![
                HostRegion::Canvas,
                HostRegion::Navigator,
                HostRegion::Inspector,
                HostRegion::RootAgency,
                HostRegion::Command,
                HostRegion::Status,
            ],
            read_model_ref: Some(SemanticRef {
                ref_id: subject_ref.clone(),
                kind: "nara-episode".into(),
                native_owner: EPI_NATIVE_OWNER.into(),
                provenance: RefProvenance {
                    source: "epi.personal.450 current governed subject".into(),
                    revision: Some(format!("{source_revision}:episode-r{revision}")),
                },
            }),
            accepted_selection_kinds: vec![
                "nara-episode".into(),
                "nara-selection".into(),
                "bimba-ref".into(),
                "epi-address".into(),
            ],
            actions: vec![
                action(EPI_NARA_SENDOFF_ACTION_REF, EPI_NARA_SENDOFF_CAPABILITY_REF),
                action(EPI_EPII_REVIEW_ACTION_REF, EPI_EPII_REVIEW_CAPABILITY_REF),
                action(ANUTTARA_GROUND_ACTION_REF, EPI_ANUTTARA_GROUND_CAPABILITY_REF),
                action(EPI_PERSONAL_PROPOSAL_ACTION_REF, EPI_PERSONAL_PROPOSAL_CAPABILITY_REF),
            ],
            detail: Some(format!(
                "native epi.personal.450 · one protected subject {subject_ref} · journal/DAY-NOW + Epii AgentSession requirement + Bimba Knowledge refs + governed proposal return · deep M0/M4/M5 descriptors exposed without deep renderers"
            )),
        };
        Ok(EpiPersonalHostObservation {
            contribution: host_native_contribution(None, contribution)?,
            application,
        })
    }

    pub fn nara_daily(&self) -> Result<Value, String> {
        self.require_personal()?;
        let value = self.invoke("nara-read", None)?;
        validate_nara_daily(&value)?;
        Ok(value)
    }

    pub fn nara_write(&self, body: &str) -> Result<Value, String> {
        self.require_personal()?;
        let value = self.invoke("nara-write", Some(serde_json::json!({"body": body})))?;
        validate_nara_daily(&value)?;
        Ok(value)
    }

    pub fn nara_selection(&self, request: Value) -> Result<Value, String> {
        self.require_personal()?;
        let value = self.invoke("nara-select", Some(request))?;
        expect_string(&value, "/schema", EPI_NARA_SELECTION_SCHEMA)?;
        expect_string(&value, "/actionRef", EPI_NARA_SENDOFF_ACTION_REF)?;
        expect_string(&value, "/capabilityRef", EPI_NARA_SENDOFF_CAPABILITY_REF)?;
        expect_string(&value, "/privacyClass", "protected-local-selected-disclosure")?;
        validate_selection(&value)?;
        Ok(value)
    }

    pub fn epii_review(&self, request: Value) -> Result<Value, String> {
        self.require_personal()?;
        let value = self.invoke("epii-review", Some(request))?;
        expect_string(&value, "/schema", EPI_EPII_REVIEW_SCHEMA)?;
        expect_string(&value, "/actionRef", EPI_EPII_REVIEW_ACTION_REF)?;
        expect_string(&value, "/agent/canonicalAgentRef", "epi:agent:epii")?;
        validate_subject_at(&value, "/subject")?;
        Ok(value)
    }

    pub fn personal_ground(&self, request: Value) -> Result<Value, String> {
        self.require_personal()?;
        let value = self.invoke("personal-ground", Some(request))?;
        expect_string(&value, "/schema", EPI_ANUTTARA_GROUND_SCHEMA)?;
        expect_string(&value, "/actionRef", EPI_ANUTTARA_GROUND_ACTION_REF)?;
        expect_string(&value, "/agent/canonicalAgentRef", "epi:agent:anuttara")?;
        expect_bool(&value, "/bimba/providerIdentityIsSemanticIdentity", false)?;
        validate_subject_at(&value, "/subject")?;
        Ok(value)
    }

    pub fn personal_proposal(&self, request: Value) -> Result<Value, String> {
        self.require_personal()?;
        let value = self.invoke("personal-proposal", Some(request))?;
        expect_string(&value, "/schema", EPI_PERSONAL_PROPOSAL_SCHEMA)?;
        expect_string(&value, "/actionRef", EPI_PERSONAL_PROPOSAL_ACTION_REF)?;
        expect_string(&value, "/sourceClass", "proposal")?;
        expect_string(&value, "/adoptionState", "unreviewed")?;
        expect_bool(&value, "/sourceMutationPerformed", false)?;
        expect_bool(
            &value,
            "/centralReturn/requiresHumanAcceptanceForDurableGround",
            true,
        )?;
        validate_subject_at(&value, "/subject")?;
        Ok(value)
    }

    fn require_personal(&self) -> Result<(), String> {
        if !self.available() {
            return Err(
                "Epi Personal provider requires OI_EPI_NARA_CONTEXT_FILE and OI_EPI_NARA_VAULT_ROOT"
                    .into(),
            );
        }
        Ok(())
    }

    fn invoke(&self, operation: &str, request: Option<Value>) -> Result<Value, String> {
        let mut command = Command::new(&self.executable);
        command.arg("--operation").arg(operation);
        if let Some(path) = self.vak_file.as_ref() {
            command.arg("--vak-file").arg(path);
        }
        if let Some(path) = self.nara_context_file.as_ref() {
            command.arg("--nara-context").arg(path);
        }
        if operation != "snapshot" {
            let vault = self
                .nara_vault_root
                .as_ref()
                .ok_or_else(|| "Epi Personal operation has no protected vault root".to_owned())?;
            command.arg("--vault-root").arg(vault);
        }
        if request.is_some() {
            command.stdin(Stdio::piped());
        }
        command.stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut child = command.spawn().map_err(|error| {
            format!("start Epi provider `{}`: {error}", self.executable.display())
        })?;
        if let Some(request) = request {
            let bytes = serde_json::to_vec(&request)
                .map_err(|error| format!("serialize private Epi request: {error}"))?;
            child
                .stdin
                .take()
                .ok_or_else(|| "Epi provider stdin unavailable".to_owned())?
                .write_all(&bytes)
                .map_err(|error| format!("write private Epi request: {error}"))?;
        }
        let output = child
            .wait_with_output()
            .map_err(|error| format!("wait for Epi provider: {error}"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            return Err(format!(
                "Epi provider `{operation}` exited with {}{}",
                output.status,
                if stderr.is_empty() { String::new() } else { format!(": {stderr}") }
            ));
        }
        serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("parse Epi provider `{operation}` JSON: {error}"))
    }
}

fn action(action_ref: &str, capability_ref: &str) -> CanonicalActionBinding {
    CanonicalActionBinding {
        action_ref: action_ref.into(),
        native_owner: EPI_NATIVE_OWNER.into(),
        availability: ActionAvailability::Available,
        required_capability_ref: Some(capability_ref.into()),
    }
}

fn validate_personal_application(value: &Value) -> Result<(), String> {
    expect_string(value, "/schema", EPI_PERSONAL_450_APPLICATION_SCHEMA)?;
    expect_string(value, "/productId", EPI_PERSONAL_450_CONTRIBUTION_REF)?;
    expect_string(value, "/nativeOwner", EPI_NATIVE_OWNER)?;
    required_string(value, "/subject/subjectRef")?;
    required_string(value, "/subject/episodeRef")?;
    expect_bool(value, "/subject/protectedBodyDisclosed", false)?;
    expect_bool(value, "/authority/selectionIsAgentContextDisclosure", false)?;
    expect_bool(value, "/authority/proposalIsAdoptedHumanSource", false)?;
    expect_string(value, "/authority/canonicalEpiiAgentRef", "epi:agent:epii")?;
    expect_bool(value, "/eventBinding/bindableToEventRef", true)?;
    expect_bool(value, "/eventBinding/parallelPersonalEventState", false)?;
    if value.pointer("/eventBinding/eventRef").is_some() {
        return Err("Prompt C Personal application must not mint an eventRef before D binds it".into());
    }
    let subject = required_string(value, "/subject/subjectRef")?;
    let event_subject = required_string(value, "/eventBinding/subjectRef")?;
    if subject != event_subject {
        return Err("Personal application event binding drifted from its governed subject".into());
    }
    let deep = value
        .pointer("/deepOpen")
        .and_then(Value::as_array)
        .ok_or_else(|| "Personal application requires deepOpen descriptors".to_owned())?;
    for product in ["epi.deep.m0", "epi.deep.m4", "epi.deep.m5"] {
        let descriptor = deep
            .iter()
            .find(|entry| entry.pointer("/productId").and_then(Value::as_str) == Some(product))
            .ok_or_else(|| format!("Personal application is missing deep-open descriptor `{product}`"))?;
        expect_bool(descriptor, "/preservesSubjectIdentity", true)?;
        let deep_subject = required_string(descriptor, "/subjectRef")?;
        if deep_subject != subject {
            return Err(format!("deep-open `{product}` drifted from Personal subject"));
        }
    }
    Ok(())
}

fn validate_nara_daily(value: &Value) -> Result<(), String> {
    expect_string(value, "/schema", EPI_NARA_DAILY_SCHEMA)?;
    expect_string(value, "/providerContract", EPI_NARA_DAILY_PROVIDER_CONTRACT)?;
    expect_string(value, "/nativeOwner", EPI_NATIVE_OWNER)?;
    expect_string(value, "/privacyClass", "protected-local-body")?;
    required_string(value, "/episodeRef")?;
    required_string(value, "/livedContext/qlAddress")?;
    required_string(value, "/livedContext/coordinateRef")?;
    required_string(value, "/livedContext/profileRef")?;
    Ok(())
}

fn validate_selection(value: &Value) -> Result<(), String> {
    for pointer in [
        "/episodeRef",
        "/selectionRef",
        "/qlAddress",
        "/coordinateRef",
        "/profileRef",
    ] {
        required_string(value, pointer)?;
    }
    Ok(())
}

fn validate_subject_at(value: &Value, prefix: &str) -> Result<(), String> {
    for suffix in [
        "episodeRef",
        "selectionRef",
        "qlAddress",
        "coordinateRef",
        "profileRef",
    ] {
        required_string(value, &format!("{prefix}/{suffix}"))?;
    }
    Ok(())
}

fn expect_string(value: &Value, pointer: &str, expected: &str) -> Result<(), String> {
    let observed = required_string(value, pointer)?;
    if observed != expected {
        return Err(format!("Epi provider `{pointer}` was `{observed}`, expected `{expected}`"));
    }
    Ok(())
}

fn expect_bool(value: &Value, pointer: &str, expected: bool) -> Result<(), String> {
    let observed = value
        .pointer(pointer)
        .and_then(Value::as_bool)
        .ok_or_else(|| format!("Epi provider requires bool `{pointer}`"))?;
    if observed != expected {
        return Err(format!("Epi provider `{pointer}` was `{observed}`, expected `{expected}`"));
    }
    Ok(())
}

pub(crate) fn required_string(value: &Value, pointer: &str) -> Result<String, String> {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("Epi provider requires string `{pointer}`"))
}
