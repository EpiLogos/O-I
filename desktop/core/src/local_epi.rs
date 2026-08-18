//! Narrow O:I presentation binding to the Epi-owned Pratibimba primitive bridge.
//!
//! O:I deliberately does not import or reproduce Epi's semantic structs. It
//! invokes the native producer, validates the stable provider/read-model seam,
//! and hosts the returned JSON plus stable refs through the existing contribution
//! model. Epi remains the computation and world-semantics owner.

use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;

use crate::{
    host_native_contribution, ContributionAvailability, HostRegion, HostedContribution,
    NativeContributionReading, RefProvenance, SemanticRef,
};

pub const EPI_PRIMITIVE_CONTRIBUTION_REF: &str = "epi.pratibimba.foundation";
pub const EPI_PRIMITIVE_SNAPSHOT_SCHEMA: &str = "epi.pratibimba-primitive-snapshot/v1";
pub const EPI_PRIMITIVE_PROVIDER_CONTRACT: &str = "epi.pratibimba-primitive-provider/v1";
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
}

impl LocalEpiHost {
    pub fn open(executable: impl Into<PathBuf>) -> Self {
        Self {
            executable: executable.into(),
            vak_file: None,
            nara_context_file: None,
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

    pub fn observe(&self) -> Result<EpiHostObservation, String> {
        let mut command = Command::new(&self.executable);
        if let Some(path) = self.vak_file.as_ref() {
            command.arg("--vak-file").arg(path);
        }
        if let Some(path) = self.nara_context_file.as_ref() {
            command.arg("--nara-context").arg(path);
        }
        let output = command.output().map_err(|error| {
            format!(
                "start Epi primitive provider `{}`: {error}",
                self.executable.display()
            )
        })?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            return Err(format!(
                "Epi primitive provider exited with {}{}",
                output.status,
                if stderr.is_empty() {
                    String::new()
                } else {
                    format!(": {stderr}")
                }
            ));
        }
        let snapshot: Value = serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("parse Epi primitive provider JSON: {error}"))?;
        host_epi_snapshot(snapshot)
    }
}

pub fn host_epi_snapshot(snapshot: Value) -> Result<EpiHostObservation, String> {
    expect_string(&snapshot, "/schema", EPI_PRIMITIVE_SNAPSHOT_SCHEMA)?;
    expect_string(
        &snapshot,
        "/providerContract",
        EPI_PRIMITIVE_PROVIDER_CONTRACT,
    )?;
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
    if !ql_address.starts_with("qladdr:")
        || !lens_ref.starts_with("mef:lens:")
        || !sublens_ref.starts_with("mef:sublens:")
    {
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
        regions: vec![
            HostRegion::Canvas,
            HostRegion::Inspector,
            HostRegion::RootAgency,
            HostRegion::Status,
        ],
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
            "epi-address".into(),
            "bimba-ref".into(),
            "ql-address".into(),
            "mef-lens".into(),
            "nara-day".into(),
            "nara-episode".into(),
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

fn expect_string(snapshot: &Value, pointer: &str, expected: &str) -> Result<(), String> {
    let observed = required_string(snapshot, pointer)?;
    if observed != expected {
        return Err(format!(
            "Epi primitive snapshot `{pointer}` was `{observed}`, expected `{expected}`"
        ));
    }
    Ok(())
}

fn required_string(snapshot: &Value, pointer: &str) -> Result<String, String> {
    snapshot
        .pointer(pointer)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("Epi primitive snapshot requires string `{pointer}`"))
}
