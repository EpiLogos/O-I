//! Opaque O:I host binding for the Epi-owned Current Situated Matheme and
//! `epi.cosmic.123` parent product.
//!
//! This module deliberately does not deserialize Epi M/astrology/QL semantics
//! into O:I-owned structs. It invokes the native one-shot producer, validates
//! stable identity/ownership/product/deep-open invariants, and hosts the returned
//! JSON through O:I's existing native-contribution mechanism.

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

/// Native process host for the same Epi one-shot provider used by Nara/Personal.
///
/// It intentionally needs the existing protected Nara context but does not need
/// the Nara vault: D binds to the existing subject/episode and does not rebuild
/// Personal 4/5/0 or read protected journal text.
pub struct LocalEpiCosmicHost {
    executable: PathBuf,
    vak_file: Option<PathBuf>,
    nara_context_file: Option<PathBuf>,
}

impl LocalEpiCosmicHost {
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

    pub fn current(&self, request: Value) -> Result<EpiCurrentSituatedHostObservation, String> {
        if self.nara_context_file.is_none() {
            return Err(
                "epi.cosmic.123 requires the existing protected Nara context; O:I does not mint a Personal subject/event"
                    .to_owned(),
            );
        }
        let reading = self.invoke(request)?;
        host_epi_current_situated(reading)
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
        command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

        let mut child = command.spawn().map_err(|error| {
            format!(
                "start Epi cosmic provider `{}`: {error}",
                self.executable.display()
            )
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
                if stderr.is_empty() {
                    String::new()
                } else {
                    format!(": {stderr}")
                }
            ));
        }
        serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("parse Epi cosmic provider JSON: {error}"))
    }
}

pub fn host_epi_current_situated(
    reading: Value,
) -> Result<EpiCurrentSituatedHostObservation, String> {
    expect_string(&reading, "/event/schema", EPI_CURRENT_SITUATED_SCHEMA)?;
    expect_string(&reading, "/event/nativeOwner", EPI_NATIVE_OWNER)?;
    expect_string(&reading, "/cosmic/schema", EPI_COSMIC_PARENT_SCHEMA)?;
    expect_string(&reading, "/cosmic/productId", EPI_COSMIC_PRODUCT_ID)?;
    expect_string(&reading, "/cosmic/nativeOwner", EPI_NATIVE_OWNER)?;
    expect_string(
        &reading,
        "/event/personal/productId",
        EPI_PERSONAL_PRODUCT_ID,
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
    let cosmic_event_ref = required_string(&reading, "/cosmic/eventRef")?;
    if event_ref != cosmic_event_ref {
        return Err("Epi Cosmic and Current Situated Matheme must share eventRef".to_owned());
    }

    let subject_ref = required_string(&reading, "/event/personal/subjectRef")?;
    let cosmic_subject_ref = required_string(&reading, "/cosmic/subjectRef")?;
    if subject_ref != cosmic_subject_ref {
        return Err("Epi Cosmic and Personal projection must share subjectRef".to_owned());
    }
    let episode_ref = required_string(&reading, "/event/personal/episodeRef")?;
    required_string(&reading, "/event/personal/identityHash")?;
    require_quaternion(&reading, "/event/personal/qIdentity")?;
    require_quaternion(&reading, "/event/personal/qTransit")?;
    require_quaternion(&reading, "/event/personal/qActivity")?;
    require_quaternion(&reading, "/event/personal/qComposed")?;

    for (m, coordinate) in [
        ("m1", "ql:m-coordinate:pratibimba:M1"),
        ("m2", "ql:m-coordinate:pratibimba:M2"),
        ("m3", "ql:m-coordinate:pratibimba:M3"),
    ] {
        expect_string(&reading, &format!("/event/{m}/eventRef"), &event_ref)?;
        expect_string(
            &reading,
            &format!("/event/{m}/mCoordinateRef"),
            coordinate,
        )?;
        required_string(&reading, &format!("/event/{m}/boundaryGround/position"))?;
        required_string(&reading, &format!("/event/{m}/boundaryReturn/position"))?;
    }

    let world_observation_ref = required_string(&reading, "/event/worldObservation/observationRef")?;
    let m2_world_ref = required_string(&reading, "/event/m2/data/worldObservationRef")?;
    let m3_world_ref = required_string(&reading, "/event/m3/data/worldObservationRef")?;
    if world_observation_ref != m2_world_ref || world_observation_ref != m3_world_ref {
        return Err(
            "M2 and M3 must consume the same Current Situated world observation".to_owned(),
        );
    }

    validate_deep_surface(
        &reading,
        0,
        "epi.deep.m1",
        "ql:m-coordinate:pratibimba:M1",
        &event_ref,
    )?;
    validate_deep_surface(
        &reading,
        1,
        "epi.deep.m2",
        "ql:m-coordinate:pratibimba:M2",
        &event_ref,
    )?;
    validate_deep_surface(
        &reading,
        2,
        "epi.deep.m3",
        "ql:m-coordinate:pratibimba:M3",
        &event_ref,
    )?;
    let deep_count = reading
        .pointer("/cosmic/deepSurfaces")
        .and_then(Value::as_array)
        .map(Vec::len)
        .ok_or_else(|| "Epi Cosmic requires deepSurfaces array".to_owned())?;
    if deep_count != 3 {
        return Err(format!(
            "Prompt D exposes exactly three Cosmic deep descriptors; observed {deep_count}"
        ));
    }

    let surface_ref = required_string(&reading, "/cosmic/surfaceRef")?;
    let profile_ref = required_string(&reading, "/cosmic/profileRef")?;
    let m2_status = required_string(&reading, "/event/m2/status")?;
    let world_class = required_string(&reading, "/event/worldObservation/observationClass")?;
    if world_class != "live-provider" && m2_status != "degraded" {
        return Err(
            "O:I refuses to upgrade fixture/derived M2 world state above degraded".to_owned(),
        );
    }
    expect_bool(&reading, "/cosmic/provenance/deepCompletionClaimed", false)?;

    let source_revision = required_string(&reading, "/event/sourceRevisions/epiRuntime")?;
    let ql_map_revision = required_string(&reading, "/event/sourceRevisions/qlMapProvider")?;
    let world_provider_revision = required_string(&reading, "/event/sourceRevisions/worldProvider")?;

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
            source: "EpiLogos/Epi-Logos-C-Experiments::epi.current-situated-matheme/v1"
                .to_owned(),
            revision: Some(source_revision.clone()),
        },
        regions: vec![
            HostRegion::Canvas,
            HostRegion::Inspector,
            HostRegion::RootAgency,
            HostRegion::Status,
        ],
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
        ],
        actions: [
            EPI_CURRENT_SITUATED_ACTION_REF,
            EPI_COSMIC_CURRENT_ACTION_REF,
            EPI_COSMIC_OPEN_DEPTH_ACTION_REF,
        ]
        .into_iter()
        .map(|action_ref| CanonicalActionBinding {
            action_ref: action_ref.to_owned(),
            native_owner: EPI_NATIVE_OWNER.to_owned(),
            availability: ActionAvailability::Available,
            required_capability_ref: None,
        })
        .collect(),
        detail: Some(format!(
            "Epi Current Situated Matheme {event_ref} · subject {subject_ref} · episode {episode_ref} · profile {profile_ref} · M2 {m2_status}/{world_class} · Epi {source_revision} · QL Map {ql_map_revision} · world provider {world_provider_revision}; deep M1/M2/M3 are stable open descriptors, not completed instruments"
        )),
    };

    Ok(EpiCurrentSituatedHostObservation {
        contribution: host_native_contribution(None, contribution)?,
        reading,
    })
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
    expect_string(
        reading,
        &format!("{base}/mCoordinateRef"),
        coordinate_ref,
    )?;
    expect_string(
        reading,
        &format!("{base}/openActionRef"),
        EPI_COSMIC_OPEN_DEPTH_ACTION_REF,
    )?;
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
        Err(format!(
            "Epi Current Situated `{pointer}` expected `{expected}`, got `{observed}`"
        ))
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
        Err(format!(
            "Epi Current Situated `{pointer}` expected `{expected}`, got `{observed}`"
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn reading(world_class: &str, m2_status: &str) -> Value {
        let event_ref = "epi:event:current-situated:v1:test";
        json!({
            "event": {
                "schema": EPI_CURRENT_SITUATED_SCHEMA,
                "eventRef": event_ref,
                "nativeOwner": "epi",
                "profileRef": "epi:matheme-harmonic-profile:test:1",
                "worldObservation": {
                    "observationRef": "provider:world:test",
                    "observationClass": world_class
                },
                "personal": {
                    "productId": "epi.personal.450",
                    "eventRef": event_ref,
                    "subjectRef": "epi:subject:test",
                    "episodeRef": "epi:episode:test",
                    "livingSourceCoordinate": "#4.4.4.4",
                    "livingMCoordinateRef": "epi:m-coordinate:M4-4-4-4'",
                    "identityHash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                    "qIdentity": [1.0, 0.0, 0.0, 0.0],
                    "qTransit": [0.0, 1.0, 0.0, 0.0],
                    "qActivity": [0.0, 0.0, 1.0, 0.0],
                    "qComposed": [0.0, 0.0, 0.0, 1.0]
                },
                "m1": {
                    "eventRef": event_ref,
                    "mCoordinateRef": "ql:m-coordinate:pratibimba:M1",
                    "boundaryGround": {"position": ".0"},
                    "boundaryReturn": {"position": ".5"}
                },
                "m2": {
                    "eventRef": event_ref,
                    "mCoordinateRef": "ql:m-coordinate:pratibimba:M2",
                    "status": m2_status,
                    "boundaryGround": {"position": ".0"},
                    "boundaryReturn": {"position": ".5"},
                    "data": {"worldObservationRef": "provider:world:test"}
                },
                "m3": {
                    "eventRef": event_ref,
                    "mCoordinateRef": "ql:m-coordinate:pratibimba:M3",
                    "boundaryGround": {"position": ".0"},
                    "boundaryReturn": {"position": ".5"},
                    "data": {"worldObservationRef": "provider:world:test"}
                },
                "sourceRevisions": {
                    "epiRuntime": "epi-rev",
                    "qlMapProvider": "ql-rev",
                    "worldProvider": "world-rev"
                }
            },
            "cosmic": {
                "schema": EPI_COSMIC_PARENT_SCHEMA,
                "productId": EPI_COSMIC_PRODUCT_ID,
                "surfaceRef": "epi:surface:cosmic.123:test",
                "nativeOwner": "epi",
                "eventRef": event_ref,
                "subjectRef": "epi:subject:test",
                "profileRef": "epi:matheme-harmonic-profile:test:1",
                "deepSurfaces": [
                    {
                        "eventRef": event_ref,
                        "mCoordinateRef": "ql:m-coordinate:pratibimba:M1",
                        "productId": "epi.deep.m1",
                        "surfaceRef": "epi:surface:epi.deep.m1:test",
                        "openActionRef": EPI_COSMIC_OPEN_DEPTH_ACTION_REF,
                        "boundaryGroundRef": "m1:.0",
                        "boundaryReturnRef": "m1:.5",
                        "completionClaimed": false
                    },
                    {
                        "eventRef": event_ref,
                        "mCoordinateRef": "ql:m-coordinate:pratibimba:M2",
                        "productId": "epi.deep.m2",
                        "surfaceRef": "epi:surface:epi.deep.m2:test",
                        "openActionRef": EPI_COSMIC_OPEN_DEPTH_ACTION_REF,
                        "boundaryGroundRef": "m2:.0",
                        "boundaryReturnRef": "m2:.5",
                        "completionClaimed": false
                    },
                    {
                        "eventRef": event_ref,
                        "mCoordinateRef": "ql:m-coordinate:pratibimba:M3",
                        "productId": "epi.deep.m3",
                        "surfaceRef": "epi:surface:epi.deep.m3:test",
                        "openActionRef": EPI_COSMIC_OPEN_DEPTH_ACTION_REF,
                        "boundaryGroundRef": "m3:.0",
                        "boundaryReturnRef": "m3:.5",
                        "completionClaimed": false
                    }
                ],
                "provenance": {"deepCompletionClaimed": false}
            }
        })
    }

    #[test]
    fn hosts_same_event_cosmic_and_personal_without_recomputing_semantics() {
        let observation = host_epi_current_situated(reading("fixture", "degraded")).unwrap();
        assert_eq!(
            observation.contribution.contribution.native_owner,
            EPI_NATIVE_OWNER
        );
        assert_eq!(
            observation
                .contribution
                .contribution
                .read_model_ref
                .as_ref()
                .unwrap()
                .ref_id,
            "epi:surface:cosmic.123:test"
        );
        assert_eq!(
            observation.contribution.contribution.availability,
            ContributionAvailability::Degraded
        );
        assert_eq!(observation.contribution.contribution.actions.len(), 3);
    }

    #[test]
    fn refuses_profile_only_or_event_drift() {
        let mut value = reading("fixture", "degraded");
        value["cosmic"]["eventRef"] = json!("epi:event:different");
        let error = host_epi_current_situated(value).unwrap_err();
        assert!(error.contains("share eventRef"));
    }

    #[test]
    fn refuses_to_upgrade_fixture_world_state() {
        let error = host_epi_current_situated(reading("fixture", "implemented")).unwrap_err();
        assert!(error.contains("refuses to upgrade"));
    }

    #[test]
    fn refuses_fake_deep_completion() {
        let mut value = reading("fixture", "degraded");
        value["cosmic"]["deepSurfaces"][1]["completionClaimed"] = json!(true);
        let error = host_epi_current_situated(value).unwrap_err();
        assert!(error.contains("expected `false`"));
    }
}