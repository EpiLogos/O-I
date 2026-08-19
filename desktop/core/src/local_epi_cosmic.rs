use serde_json::Value;

use crate::{
    host_native_contribution, ActionAvailability, CanonicalActionBinding,
    ContributionAvailability, HostRegion, HostedContribution, NativeContributionReading,
    RefProvenance, SemanticRef, EPI_COSMIC_CONTRIBUTION_REF,
    EPI_COSMIC_CURRENT_PROVIDER_CONTRACT, EPI_COSMIC_OPEN_DEPTH_ACTION_REF,
    EPI_COSMIC_OPEN_DEPTH_CAPABILITY_REF, EPI_NATIVE_OWNER,
};

#[derive(Clone, Debug, PartialEq)]
pub struct EpiCosmicHostObservation {
    pub contribution: HostedContribution,
    pub reading: Value,
}

pub fn host_epi_cosmic(reading: Value) -> Result<EpiCosmicHostObservation, String> {
    let cosmic_ref = required_string(&reading, "/cosmicRef")?;
    let profile_ref = required_string(&reading, "/profileRef")?;
    let ql_address = required_string(&reading, "/qlAddress")?;
    let source_revision = required_string(&reading, "/provenance/sourceRevision")?;
    let ql_revision = required_string(&reading, "/provenance/qlUse/providerRevision")?;

    let contribution = NativeContributionReading {
        schema: "oi.desktop-host-reading/v1".into(),
        contribution_ref: EPI_COSMIC_CONTRIBUTION_REF.into(),
        native_owner: EPI_NATIVE_OWNER.into(),
        target_contract: Some(EPI_COSMIC_CURRENT_PROVIDER_CONTRACT.into()),
        availability: ContributionAvailability::Ready,
        provenance: RefProvenance {
            source: "EpiLogos/Epi-Logos-C-Experiments::epi.cosmic-current/v1".into(),
            revision: Some(source_revision.clone()),
        },
        regions: vec![
            HostRegion::Canvas,
            HostRegion::Inspector,
            HostRegion::RootAgency,
            HostRegion::Status,
        ],
        read_model_ref: Some(SemanticRef {
            ref_id: cosmic_ref.clone(),
            kind: "epi-cosmic-current".into(),
            native_owner: EPI_NATIVE_OWNER.into(),
            provenance: RefProvenance {
                source: "EpiLogos/Epi-Logos-C-Experiments::epi.cosmic-current/v1".into(),
                revision: Some(source_revision.clone()),
            },
        }),
        accepted_selection_kinds: vec![
            "epi-cosmic-current".into(),
            "epi-deep-workspace".into(),
            "epi-address".into(),
            "ql-address".into(),
            "mef-lens".into(),
        ],
        actions: vec![CanonicalActionBinding {
            action_ref: EPI_COSMIC_OPEN_DEPTH_ACTION_REF.into(),
            native_owner: EPI_NATIVE_OWNER.into(),
            availability: ActionAvailability::Available,
            required_capability_ref: Some(EPI_COSMIC_OPEN_DEPTH_CAPABILITY_REF.into()),
        }],
        detail: Some(format!(
            "one Epi-owned Cosmic current · {cosmic_ref} · profile {profile_ref} · {ql_address} · Epi {source_revision} · QL {ql_revision}; M1/M2/M3 readiness remains inside the source reading"
        )),
    };

    Ok(EpiCosmicHostObservation {
        contribution: host_native_contribution(None, contribution)?,
        reading,
    })
}

fn required_string(value: &Value, pointer: &str) -> Result<String, String> {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("Epi Cosmic reading requires string `{pointer}`"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn cosmic_host_projection_keeps_epi_as_owner_and_root_agency_can_inspect_ref() {
        let reading = json!({
            "cosmicRef": "epi:cosmic:current:abc:12",
            "profileRef": "epi:matheme-harmonic-profile:abc:12",
            "qlAddress": "qladdr:v1:p0:direct:s0",
            "provenance": {
                "sourceRevision": "abc",
                "qlUse": { "providerRevision": "0123456789012345678901234567890123456789" }
            }
        });
        let observation = host_epi_cosmic(reading.clone()).unwrap();
        assert_eq!(observation.reading, reading);
        assert_eq!(observation.contribution.contribution.native_owner, "epi");
        assert_eq!(
            observation.contribution.contribution.read_model_ref.as_ref().unwrap().ref_id,
            "epi:cosmic:current:abc:12"
        );
        assert!(observation
            .contribution
            .contribution
            .regions
            .contains(&HostRegion::RootAgency));
    }
}
