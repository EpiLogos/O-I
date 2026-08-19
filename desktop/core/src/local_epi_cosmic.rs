//! Opaque O:I host binding for the Epi-owned Current Situated Matheme and
//! `epi.cosmic.123` parent product.
//!
//! O:I invokes the native one-shot producer, validates stable cross-product
//! identity/provenance laws, and hosts the returned JSON. It does not deserialize
//! or recompute Epi M, harmonic, astrological, quaternionic or QL semantics.

use serde_json::Value;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use crate::{
    host_native_contribution, ActionAvailability, CanonicalActionBinding,
    ContributionAvailability, HostRegion, HostedContribution, NativeContributionReading,
    RefProvenance, SemanticRef, EPI_NATIVE_OWNER,
};

pub const EPI_CURRENT_SITUATED_SCHEMA: &str = "epi.current-situated-matheme/v1";
pub const EPI_COSMIC_PARENT_SCHEMA: &str = "epi.cosmic.123/v1";
pub const EPI_COSMIC_PRODUCT_ID: &str = "epi.cosmic.123";
pub const EPI_PERSONAL_PRODUCT_ID: &str = "epi.personal.450";
pub const EPI_PERSONAL_PARENT_SCHEMA: &str = "epi.personal-450-application/v1";
pub const EPI_COSMIC_CONTRIBUTION_REF: &str = "epi.cosmic.123";
pub const EPI_CURRENT_SITUATED_ACTION_REF: &str = "epi.action.current-situated.read";
pub const EPI_COSMIC_CURRENT_ACTION_REF: &str = "epi.action.cosmic.current.read";
pub const EPI_COSMIC_OPEN_DEPTH_ACTION_REF: &str = "epi.action.cosmic.open-depth";
pub const EPI_PERSONAL_LIVING_SOURCE_COORDINATE: &str = "#4.4.4.4";
pub const EPI_PERSONAL_LIVING_M_COORDINATE_REF: &str = "epi:m-coordinate:M4-4-4-4'";

#[derive(Clone, Debug, PartialEq)]
pub struct EpiCurrentSituatedHostObservation {
    pub contribution: HostedContribution,
    pub reading: Value,
}

/// Native host for the same Epi one-shot provider that owns corrected C.
/// The vault root is passed only to Epi so Epi can resolve its own Personal
/// parent; O:I never reads the protected body while binding D.
pub struct LocalEpiCosmicHost {
    executable: PathBuf,
    vak_file: Option<PathBuf>,
    nara_context_file: Option<PathBuf>,
    nara_vault_root: Option<PathBuf>,
}

impl LocalEpiCosmicHost {
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

    pub fn current(&self, request: Value) -> Result<EpiCurrentSituatedHostObservation, String> {
        if self.nara_context_file.is_none() || self.nara_vault_root.is_none() {
            return Err(
                "epi.cosmic.123 requires the corrected-C protected Nara context + Epi vault binding; O:I does not mint a Personal subject/event"
                    .to_owned(),
            );
        }
        host_epi_current_situated(self.invoke(request)?)
    }

    fn invoke(&self, request: Value) -> Result<Value, String> {
        let mut command = Command::new(&self.executable);
        command.arg("--operation").arg("cosmic-current");
        if let Some(path) = self.vak_file.as_ref() {
            command.arg("--vak-file").arg(path);
        }
        if let Some(path) = self.nara_context_file.as_ref() {
            command.arg("--nara-context").arg(path);
        }
        if let Some(path) = self.nara_vault_root.as_ref() {
            command.arg("--vault-root").arg(path);
        }
        command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

        let mut child = command.spawn().map_err(|error| {
            format!("start Epi cosmic provider `{}`: {error}", self.executable.display())
        })?;
        let bytes = serde_json::to_vec(&request)
            .map_err(|error| format!("serialize Epi Current Situated request: {error}"))?;
        child
            .stdin
            .take()
            .ok_or_else(|| "Epi cosmic provider stdin was unavailable".to_owned())?
            .write_all(&bytes)
            .map_err(|error| format!("write Epi Current Situated request: {error}"))?;

        let output = child
            .wait_with_output()
            .map_err(|error| format!("wait for Epi cosmic provider: {error}"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            return Err(format!(
                "Epi cosmic provider exited with {}{}",
                output.status,
                if stderr.is_empty() { String::new() } else { format!(": {stderr}") }
            ));
        }
        serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("parse Epi cosmic provider JSON: {error}"))
    }
}

pub fn host_epi_current_situated(reading: Value) -> Result<EpiCurrentSituatedHostObservation, String> {
    expect_string(&reading, "/event/schema", EPI_CURRENT_SITUATED_SCHEMA)?;
    expect_string(&reading, "/event/nativeOwner", EPI_NATIVE_OWNER)?;
    expect_string(&reading, "/cosmic/schema", EPI_COSMIC_PARENT_SCHEMA)?;
    expect_string(&reading, "/cosmic/productId", EPI_COSMIC_PRODUCT_ID)?;
    expect_string(&reading, "/cosmic/nativeOwner", EPI_NATIVE_OWNER)?;
    expect_string(&reading, "/event/personal/productId", EPI_PERSONAL_PRODUCT_ID)?;
    expect_string(
        &reading,
        "/event/personal/personalParentApplicationSchema",
        EPI_PERSONAL_PARENT_SCHEMA,
    )?;
    expect_string(
        &reading,
        "/event/personal/livingSourceCoordinate",
        EPI_PERSONAL_LIVING_SOURCE_COORDINATE,
    )?;
    expect_string(
        &reading,
        "/event/personal/livingMCoordinateRef",
        EPI_PERSONAL_LIVING_M_COORDINATE_REF,
    )?;

    let event_ref = required_string(&reading, "/event/eventRef")?;
    expect_string(&reading, "/cosmic/eventRef", &event_ref)?;

    // Corrected C defines the Personal parent subject as the governed episode.
    let personal_subject = required_string(&reading, "/event/personal/subjectRef")?;
    let episode_ref = required_string(&reading, "/event/personal/episodeRef")?;
    if personal_subject != episode_ref {
        return Err("Current Situated Personal subject must remain corrected C's governed episode".to_owned());
    }
    expect_string(&reading, "/cosmic/subjectRef", &personal_subject)?;

    // The protected Nara identity is a distinct relation used by the operative
    // quaternionic identity proof. It must not be collapsed into the C subject.
    let nara_identity_ref = required_string(&reading, "/event/personal/naraIdentityRef")?;
    if nara_identity_ref == personal_subject {
        return Err("O:I refuses to collapse protected Nara identity into the corrected-C episode subject".to_owned());
    }
    required_string(&reading, "/event/personal/identityHash")?;
    require_quaternion(&reading, "/event/personal/qIdentity")?;
    require_quaternion(&reading, "/event/personal/qTransit")?;
    require_quaternion(&reading, "/event/personal/qActivity")?;
    require_quaternion(&reading, "/event/personal/qComposed")?;

    validate_personal_parent_binding(
        &reading,
        &event_ref,
        &personal_subject,
        &nara_identity_ref,
    )?;

    for (m, coordinate) in [
        ("m1", "ql:m-coordinate:pratibimba:M1"),
        ("m2", "ql:m-coordinate:pratibimba:M2"),
        ("m3", "ql:m-coordinate:pratibimba:M3"),
    ] {
        expect_string(&reading, &format!("/event/{m}/eventRef"), &event_ref)?;
        expect_string(&reading, &format!("/event/{m}/mCoordinateRef"), coordinate)?;
        expect_string(&reading, &format!("/event/{m}/boundaryGround/position"), ".0")?;
        expect_string(&reading, &format!("/event/{m}/boundaryReturn/position"), ".5")?;
    }

    let world_observation_ref = required_string(&reading, "/event/worldObservation/observationRef")?;
    expect_string(&reading, "/event/m2/data/worldObservationRef", &world_observation_ref)?;
    expect_string(&reading, "/event/m3/data/worldObservationRef", &world_observation_ref)?;

    validate_deep_surface(&reading, 0, "epi.deep.m1", "ql:m-coordinate:pratibimba:M1", &event_ref)?;
    validate_deep_surface(&reading, 1, "epi.deep.m2", "ql:m-coordinate:pratibimba:M2", &event_ref)?;
    validate_deep_surface(&reading, 2, "epi.deep.m3", "ql:m-coordinate:pratibimba:M3", &event_ref)?;
    let deep_count = reading
        .pointer("/cosmic/deepSurfaces")
        .and_then(Value::as_array)
        .map(Vec::len)
        .ok_or_else(|| "Epi Cosmic requires deepSurfaces array".to_owned())?;
    if deep_count != 3 {
        return Err(format!("Prompt D exposes exactly three Cosmic deep descriptors; observed {deep_count}"));
    }
    expect_bool(&reading, "/cosmic/provenance/deepCompletionClaimed", false)?;

    let world_class = required_string(&reading, "/event/worldObservation/observationClass")?;
    let m2_status = required_string(&reading, "/event/m2/status")?;
    if world_class != "live-provider" && m2_status != "degraded" {
        return Err("O:I refuses to upgrade fixture/derived M2 world state above degraded".to_owned());
    }

    let surface_ref = required_string(&reading, "/cosmic/surfaceRef")?;
    let source_revision = required_string(&reading, "/event/sourceRevisions/epiRuntime")?;
    let ql_map_revision = required_string(&reading, "/event/sourceRevisions/qlMapProvider")?;
    let world_provider_revision = required_string(&reading, "/event/sourceRevisions/worldProvider")?;
    let profile_ref = required_string(&reading, "/cosmic/profileRef")?;

    let contribution = NativeContributionReading {
        schema: "oi.desktop-host-reading/v1".to_owned(),
        contribution_ref: EPI_COSMIC_CONTRIBUTION_REF.to_owned(),
        native_owner: EPI_NATIVE_OWNER.to_owned(),
        target_contract: Some(EPI_COSMIC_PARENT_SCHEMA.to_owned()),
        availability: if m2_status == "degraded" {
            ContributionAvailability::Degraded
        } else {
            ContributionAvailability::Ready
        },
        provenance: RefProvenance {
            source: "EpiLogos/Epi-Logos-C-Experiments::epi.current-situated-matheme/v1".to_owned(),
            revision: Some(source_revision.clone()),
        },
        regions: vec![HostRegion::Canvas, HostRegion::Inspector, HostRegion::RootAgency, HostRegion::Status],
        read_model_ref: Some(SemanticRef {
            ref_id: surface_ref,
            kind: "epi-cosmic-123".to_owned(),
            native_owner: EPI_NATIVE_OWNER.to_owned(),
            provenance: RefProvenance {
                source: "EpiLogos/Epi-Logos-C-Experiments::epi.cosmic.123/v1".to_owned(),
                revision: Some(source_revision.clone()),
            },
        }),
        accepted_selection_kinds: vec![
            "epi-current-situated-event".to_owned(),
            "epi-cosmic-123".to_owned(),
            "epi-deep-surface".to_owned(),
            "epi-m-coordinate".to_owned(),
            "nara-episode".to_owned(),
        ],
        actions: [EPI_CURRENT_SITUATED_ACTION_REF, EPI_COSMIC_CURRENT_ACTION_REF, EPI_COSMIC_OPEN_DEPTH_ACTION_REF]
            .into_iter()
            .map(|action_ref| CanonicalActionBinding {
                action_ref: action_ref.to_owned(),
                native_owner: EPI_NATIVE_OWNER.to_owned(),
                availability: ActionAvailability::Available,
                required_capability_ref: None,
            })
            .collect(),
        detail: Some(format!(
            "Epi Current Situated {event_ref} · corrected-C subject/episode {personal_subject} · protected Nara identity {nara_identity_ref} · profile {profile_ref} · M2 {m2_status}/{world_class} · Epi {source_revision} · QL Map {ql_map_revision} · world provider {world_provider_revision}; deep M1/M2/M3 are stable open descriptors, not completed instruments"
        )),
    };

    Ok(EpiCurrentSituatedHostObservation {
        contribution: host_native_contribution(None, contribution)?,
        reading,
    })
}

fn validate_personal_parent_binding(
    reading: &Value,
    event_ref: &str,
    subject_ref: &str,
    nara_identity_ref: &str,
) -> Result<(), String> {
    expect_string(reading, "/event/personalParentBinding/productId", EPI_PERSONAL_PRODUCT_ID)?;
    expect_string(reading, "/event/personalParentBinding/applicationSchema", EPI_PERSONAL_PARENT_SCHEMA)?;
    expect_string(reading, "/event/personalParentBinding/subjectRef", subject_ref)?;
    expect_string(reading, "/event/personalParentBinding/episodeRef", subject_ref)?;
    expect_string(reading, "/event/personalParentBinding/naraIdentityRef", nara_identity_ref)?;
    expect_string(reading, "/event/personalParentBinding/boundEventRef", event_ref)?;
    if reading.pointer("/event/personalParentBinding/sourceEventRefBeforeBinding") != Some(&Value::Null) {
        return Err("corrected C must be unbound before D supplies eventRef".to_owned());
    }
    expect_bool(reading, "/event/personalParentBinding/bindableToEventRef", true)?;
    expect_bool(reading, "/event/personalParentBinding/parallelPersonalEventState", false)?;
    expect_string(reading, "/cosmic/provenance/correctedCPersonalBinding/eventRef", event_ref)?;
    expect_string(reading, "/cosmic/provenance/correctedCPersonalBinding/subjectRef", subject_ref)?;
    Ok(())
}

fn validate_deep_surface(
    reading: &Value,
    index: usize,
    product_id: &str,
    coordinate_ref: &str,
    event_ref: &str,
) -> Result<(), String> {
    let base = format!("/cosmic/deepSurfaces/{index}");
    expect_string(reading, &format!("{base}/productId"), product_id)?;
    expect_string(reading, &format!("{base}/eventRef"), event_ref)?;
    expect_string(reading, &format!("{base}/mCoordinateRef"), coordinate_ref)?;
    expect_string(reading, &format!("{base}/openActionRef"), EPI_COSMIC_OPEN_DEPTH_ACTION_REF)?;
    required_string(reading, &format!("{base}/surfaceRef"))?;
    required_string(reading, &format!("{base}/boundaryGroundRef"))?;
    required_string(reading, &format!("{base}/boundaryReturnRef"))?;
    expect_bool(reading, &format!("{base}/completionClaimed"), false)?;
    Ok(())
}

fn require_quaternion(value: &Value, pointer: &str) -> Result<(), String> {
    let values = value
        .pointer(pointer)
        .and_then(Value::as_array)
        .ok_or_else(|| format!("Epi Current Situated reading requires quaternion `{pointer}`"))?;
    if values.len() != 4 || !values.iter().all(Value::is_number) {
        return Err(format!("`{pointer}` must contain exactly four numeric components"));
    }
    Ok(())
}

fn required_string(value: &Value, pointer: &str) -> Result<String, String> {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("Epi Current Situated reading requires string `{pointer}`"))
}

fn expect_string(value: &Value, pointer: &str, expected: &str) -> Result<(), String> {
    let observed = required_string(value, pointer)?;
    if observed == expected {
        Ok(())
    } else {
        Err(format!("Epi Current Situated `{pointer}` expected `{expected}`, got `{observed}`"))
    }
}

fn expect_bool(value: &Value, pointer: &str, expected: bool) -> Result<(), String> {
    let observed = value
        .pointer(pointer)
        .and_then(Value::as_bool)
        .ok_or_else(|| format!("Epi Current Situated reading requires bool `{pointer}`"))?;
    if observed == expected {
        Ok(())
    } else {
        Err(format!("Epi Current Situated `{pointer}` expected `{expected}`, got `{observed}`"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn refuses_profile_only_event_or_parallel_personal_state() {
        let event = "epi:event:test";
        let mut value = json!({
            "event": {
                "schema": EPI_CURRENT_SITUATED_SCHEMA,
                "eventRef": event,
                "nativeOwner": "epi",
                "personal": {
                    "productId": EPI_PERSONAL_PRODUCT_ID,
                    "subjectRef": "epi:episode:test",
                    "episodeRef": "epi:episode:test",
                    "naraIdentityRef": "epi:nara:identity:test",
                    "personalParentApplicationSchema": EPI_PERSONAL_PARENT_SCHEMA,
                    "livingSourceCoordinate": EPI_PERSONAL_LIVING_SOURCE_COORDINATE,
                    "livingMCoordinateRef": EPI_PERSONAL_LIVING_M_COORDINATE_REF,
                    "identityHash": "hash",
                    "qIdentity": [1,0,0,0], "qTransit": [0,1,0,0], "qActivity": [0,0,1,0], "qComposed": [0,0,0,1]
                },
                "personalParentBinding": {
                    "productId": EPI_PERSONAL_PRODUCT_ID,
                    "applicationSchema": EPI_PERSONAL_PARENT_SCHEMA,
                    "subjectRef": "epi:episode:test",
                    "episodeRef": "epi:episode:test",
                    "naraIdentityRef": "epi:nara:identity:test",
                    "sourceEventRefBeforeBinding": null,
                    "boundEventRef": event,
                    "bindableToEventRef": true,
                    "parallelPersonalEventState": true
                }
            },
            "cosmic": { "schema": EPI_COSMIC_PARENT_SCHEMA, "productId": EPI_COSMIC_PRODUCT_ID, "nativeOwner": "epi", "eventRef": event, "subjectRef": "epi:episode:test" }
        });
        let error = host_epi_current_situated(value.take()).unwrap_err();
        assert!(error.contains("expected `false`") || error.contains("requires string"));
    }
}