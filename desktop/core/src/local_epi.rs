//! Narrow O:I presentation binding to the Epi-owned Pratibimba providers.
//!
//! O:I deliberately does not import or reproduce Epi's semantic structs. It
//! invokes the native producer, validates stable provider/read-model seams, and
//! hosts returned JSON plus stable refs. Epi remains computation, persistence and
//! world-semantics owner.

use serde_json::Value;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use crate::{
    host_native_contribution, ActionAvailability, CanonicalActionBinding,
    ContributionAvailability, HostRegion, HostedContribution, NativeContributionReading,
    RefProvenance, SemanticRef,
};

pub const EPI_PRIMITIVE_CONTRIBUTION_REF: &str = "epi.pratibimba.foundation";
pub const EPI_PRIMITIVE_SNAPSHOT_SCHEMA: &str = "epi.pratibimba-primitive-snapshot/v1";
pub const EPI_PRIMITIVE_PROVIDER_CONTRACT: &str = "epi.pratibimba-primitive-provider/v1";
pub const EPI_NARA_DAILY_SCHEMA: &str = "epi.nara-daily-surface/v1";
pub const EPI_NARA_DAILY_PROVIDER_CONTRACT: &str = "epi.nara-daily-provider/v1";
pub const EPI_NARA_SELECTION_SCHEMA: &str = "epi.nara-selection/v1";
pub const EPI_NARA_SENDOFF_ACTION_REF: &str = "epi.action.nara.selection.sendoff";
pub const EPI_NARA_SENDOFF_CAPABILITY_REF: &str = "epi.capability.nara.selected-context";
pub const EPI_NATIVE_OWNER: &str = "epi";

#[derive(Clone, Debug, PartialEq)]
pub struct EpiHostObservation {
    pub contribution: HostedContribution,
    pub snapshot: Value,
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

    pub fn nara_available(&self) -> bool {
        self.nara_context_file.is_some() && self.nara_vault_root.is_some()
    }

    pub fn observe(&self) -> Result<EpiHostObservation, String> {
        let snapshot = self.invoke("snapshot", None)?;
        let mut observation = host_epi_snapshot(snapshot)?;
        if self.nara_available() {
            observation.contribution.contribution.actions.push(CanonicalActionBinding {
                action_ref: EPI_NARA_SENDOFF_ACTION_REF.into(),
                native_owner: EPI_NATIVE_OWNER.into(),
                availability: ActionAvailability::Available,
                required_capability_ref: Some(EPI_NARA_SENDOFF_CAPABILITY_REF.into()),
            });
            observation
                .contribution
                .contribution
                .accepted_selection_kinds
                .push("nara-selection".into());
            observation.contribution.contribution.detail = observation
                .contribution
                .contribution
                .detail
                .take()
                .map(|detail| format!("{detail} · protected Nara daily provider ready"));
        }
        Ok(observation)
    }

    pub fn nara_daily(&self) -> Result<Value, String> {
        self.require_nara()?;
        let value = self.invoke("nara-read", None)?;
        validate_nara_daily(&value)?;
        Ok(value)
    }

    pub fn nara_write(&self, body: &str) -> Result<Value, String> {
        self.require_nara()?;
        let value = self.invoke("nara-write", Some(serde_json::json!({"body": body})))?;
        validate_nara_daily(&value)?;
        Ok(value)
    }

    pub fn nara_selection(&self, request: Value) -> Result<Value, String> {
        self.require_nara()?;
        let value = self.invoke("nara-select", Some(request))?;
        expect_string(&value, "/schema", EPI_NARA_SELECTION_SCHEMA)?;
        expect_string(&value, "/actionRef", EPI_NARA_SENDOFF_ACTION_REF)?;
        expect_string(&value, "/capabilityRef", EPI_NARA_SENDOFF_CAPABILITY_REF)?;
        expect_string(&value, "/privacyClass", "protected-local-selected-disclosure")?;
        required_string(&value, "/episodeRef")?;
        required_string(&value, "/selectionRef")?;
        required_string(&value, "/profileRef")?;
        Ok(value)
    }

    fn require_nara(&self) -> Result<(), String> {
        if !self.nara_available() {
            return Err(
                "Nara daily provider requires OI_EPI_NARA_CONTEXT_FILE and OI_EPI_NARA_VAULT_ROOT"
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
                .ok_or_else(|| "Nara operation has no configured protected vault root".to_owned())?;
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
                .map_err(|error| format!("serialize private Epi operation request: {error}"))?;
            child
                .stdin
                .take()
                .ok_or_else(|| "Epi provider stdin was unavailable".to_owned())?
                .write_all(&bytes)
                .map_err(|error| format!("write private Epi operation request: {error}"))?;
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

pub fn host_epi_snapshot(snapshot: Value) -> Result<EpiHostObservation, String> {
    expect_string(&snapshot, "/schema", EPI_PRIMITIVE_SNAPSHOT_SCHEMA)?;
    expect_string(&snapshot, "/providerContract", EPI_PRIMITIVE_PROVIDER_CONTRACT)?;
    expect_string(&snapshot, "/nativeOwner", EPI_NATIVE_OWNER)?;

    let source_revision = required_string(&snapshot, "/sourceRevision")?;
    let status = required_string(&snapshot, "/status")?;
    let parity = snapshot
        .pointer("/kernel/parity")
        .and_then(Value::as_bool)
        .ok_or_else(|| "Epi primitive snapshot requires boolean kernel.parity".to_owned())?;
    if !parity {
        return Err("Epi primitive snapshot failed epi-lib/portal-core parity".into());
    }

    let canonical_ref = required_string(&snapshot, "/currentAddress/canonicalRef")?;
    let bimba_ref = required_string(&snapshot, "/currentAddress/bimbaRef")?;
    let domain_ref = required_string(&snapshot, "/currentAddress/domainRef")?;
    let ql_address = required_string(&snapshot, "/ql/qlAddress")?;
    let lens_ref = required_string(&snapshot, "/ql/lensRef")?;
    let sublens_ref = required_string(&snapshot, "/ql/sublensRef")?;
    let tick12 = snapshot
        .pointer("/kernel/harmonicProfile/tick12")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Epi primitive snapshot requires kernel.harmonicProfile.tick12".to_owned())?;
    let vak_status = required_string(&snapshot, "/vak/currentState/status")?;
    let day_now_status = required_string(&snapshot, "/time/dayNow/status")?;
    let ql_provider_revision = required_string(&snapshot, "/ql/providerRevision")?;

    if !canonical_ref.starts_with("epi:bimba:") || bimba_ref.trim().is_empty() {
        return Err("Epi primitive snapshot requires a stable Bimba-addressable current ref".into());
    }
    if !ql_address.starts_with("qladdr:") || !lens_ref.starts_with("mef:lens:") || !sublens_ref.starts_with("mef:sublens:") {
        return Err("Epi primitive snapshot did not preserve canonical QL/MEF ref identity".into());
    }
    if ql_provider_revision.len() != 40 || !ql_provider_revision.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Epi primitive snapshot requires an exact QL provider revision".into());
    }

    let availability = match status.as_str() {
        "implemented" => ContributionAvailability::Ready,
        "partial" | "degraded" => ContributionAvailability::Degraded,
        "provider-unavailable" | "stub" | "research" => ContributionAvailability::Unavailable,
        other => return Err(format!("unsupported Epi primitive status `{other}`")),
    };

    let contribution = NativeContributionReading {
        schema: "oi.desktop-host-reading/v1".into(),
        contribution_ref: EPI_PRIMITIVE_CONTRIBUTION_REF.into(),
        native_owner: EPI_NATIVE_OWNER.into(),
        target_contract: Some(EPI_PRIMITIVE_PROVIDER_CONTRACT.into()),
        availability,
        provenance: RefProvenance {
            source: "EpiLogos/Epi-Logos-C-Experiments::epi-pratibimba-bridge".into(),
            revision: Some(source_revision.clone()),
        },
        regions: vec![HostRegion::Canvas, HostRegion::Inspector, HostRegion::RootAgency, HostRegion::Status],
        read_model_ref: Some(SemanticRef {
            ref_id: canonical_ref.clone(),
            kind: "epi-address".into(),
            native_owner: EPI_NATIVE_OWNER.into(),
            provenance: RefProvenance {
                source: "EpiLogos/Epi-Logos-C-Experiments::epi-pratibimba-bridge".into(),
                revision: Some(source_revision.clone()),
            },
        }),
        accepted_selection_kinds: vec![
            "epi-address".into(), "bimba-ref".into(), "ql-address".into(), "mef-lens".into(),
            "nara-day".into(), "nara-episode".into(),
        ],
        actions: Vec::new(),
        detail: Some(format!(
            "real Epi foundation · {canonical_ref} ({domain_ref}) · tick12 {tick12} · {ql_address} · {lens_ref} / {sublens_ref} · VĀK {vak_status} · DAY/NOW {day_now_status} · epi-lib parity true · Epi {source_revision} · QL {ql_provider_revision}"
        )),
    };

    Ok(EpiHostObservation {
        contribution: host_native_contribution(None, contribution)?,
        snapshot,
    })
}

fn validate_nara_daily(value: &Value) -> Result<(), String> {
    expect_string(value, "/schema", EPI_NARA_DAILY_SCHEMA)?;
    expect_string(value, "/providerContract", EPI_NARA_DAILY_PROVIDER_CONTRACT)?;
    expect_string(value, "/nativeOwner", EPI_NATIVE_OWNER)?;
    expect_string(value, "/privacyClass", "protected-local-body")?;
    required_string(value, "/episodeRef")?;
    required_string(value, "/dayRef")?;
    required_string(value, "/livedContext/qlAddress")?;
    required_string(value, "/livedContext/coordinateRef")?;
    required_string(value, "/livedContext/profileRef")?;
    Ok(())
}

fn expect_string(snapshot: &Value, pointer: &str, expected: &str) -> Result<(), String> {
    let observed = required_string(snapshot, pointer)?;
    if observed != expected {
        return Err(format!("Epi provider `{pointer}` was `{observed}`, expected `{expected}`"));
    }
    Ok(())
}

pub(crate) fn required_string(snapshot: &Value, pointer: &str) -> Result<String, String> {
    snapshot
        .pointer(pointer)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("Epi provider requires string `{pointer}`"))
}
