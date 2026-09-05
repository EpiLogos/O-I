//! World reading core — ported KEEP-RE-EARN from `desktop/core/src/world.rs`
//! (reading/projection core ONLY; the tree/UI coupling stays behind), and
//! reduced to what U0.4's seam needs: listing a project's participating
//! sources from the owner's own disclosures.
//!
//! Sources are listed from `projectcentral.change.horizon` (the reconciled
//! view, carrying live revisions) with `projectcentral.ground.inspect` as
//! the degraded fallback (recognised ground sources, revisions absent).
//! Every degradation is local: an unavailable seam empties exactly the
//! level it would have served and records the reason — an honest
//! `unavailable` listing, never an error and never fabricated rows.
//!
//! Refs are carried verbatim in Central's canonical grammar (U0.2, D12):
//! `central:source:project:{project_id}:{escaped-path}`. The kernel mints
//! nothing.

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::flow::{CentralClient, OwnerCallError, SourceBinding};

/// Schema of the participating-sources listing.
pub const SOURCE_LISTING_SCHEMA: &str = "oi.source-listing/v1";

pub const HORIZON_SCHEMA: &str = "central.source-change-horizon/v1";

// ---------------------------------------------------------------------------
// Owner contracts, decoded exactly as served
// ---------------------------------------------------------------------------

/// One source of the change horizon: its binding plus the reconciled
/// revision.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct HorizonSource {
    pub binding: SourceBinding,
    pub revision: RevisionSlot,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RevisionSlot {
    pub revision: String,
    pub byte_len: u64,
}

/// The change horizon reading (`central.source-change-horizon/v1`), the
/// fields the listing consumes.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ChangeHorizon {
    pub schema: String,
    pub world_ref: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sources: Vec<HorizonSource>,
    pub automatic_agent_or_model_invocation: bool,
}

/// The ground inspection reading, the fields the listing consumes.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct GroundInspection {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recognised_sources: Vec<SourceBinding>,
}

// ---------------------------------------------------------------------------
// The listing — one row per participating source, owner spellings verbatim
// ---------------------------------------------------------------------------

/// One participating source exactly as its owner disclosed it.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ListedSource {
    /// Central's canonical ref, verbatim.
    #[serde(rename = "ref")]
    pub source_ref: String,
    pub path: String,
    pub treatment: String,
    #[serde(default)]
    pub agent_retrieval_allowed: bool,
    /// The reconciled revision, when the horizon served this listing.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
}

/// What served the listing, and therefore what it may claim (02 §10).
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ListingAvailability {
    /// The owner's change horizon answered live.
    Horizon,
    /// The horizon was unavailable; the ground inspection served the
    /// listing without revisions. Local degradation, disclosed.
    GroundOnly { reason: String },
    /// No seam served the listing. Absence is an observation, not an error.
    Unavailable { reason: String },
}

/// A project's participating sources at their honest availability.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceListing {
    pub schema: String,
    pub project: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sources: Vec<ListedSource>,
    pub availability: ListingAvailability,
}

/// List the participating sources of one project through the owner's own
/// disclosures: horizon primary, ground fallback, honest unavailable floor.
pub fn participating_sources(
    client: &CentralClient,
    project: Option<&str>,
) -> SourceListing {
    let project = project
        .map(str::to_owned)
        .unwrap_or_else(|| client.configured_project().to_owned());
    match client.run("projectcentral.change.horizon", json!({ "project": project })) {
        Ok(data) => match serde_json::from_value::<ChangeHorizon>(data) {
            Ok(horizon) => {
                if horizon.schema != HORIZON_SCHEMA {
                    return degraded_ground(
                        client,
                        &project,
                        format!("horizon schema `{}` is not {HORIZON_SCHEMA}", horizon.schema),
                    );
                }
                if horizon.automatic_agent_or_model_invocation {
                    return degraded_ground(
                        client,
                        &project,
                        "horizon violated zero-background-Agent law".to_owned(),
                    );
                }
                SourceListing {
                    schema: SOURCE_LISTING_SCHEMA.to_owned(),
                    sources: horizon
                        .sources
                        .iter()
                        .map(|source| ListedSource {
                            source_ref: source.binding.source_ref.clone(),
                            path: source.binding.path.clone(),
                            treatment: source.binding.treatment.clone(),
                            agent_retrieval_allowed: source.binding.agent_retrieval_allowed,
                            revision: Some(source.revision.revision.clone()),
                        })
                        .collect(),
                    project,
                    availability: ListingAvailability::Horizon,
                }
            }
            Err(error) => degraded_ground(
                client,
                &project,
                format!("horizon answer did not decode: {error}"),
            ),
        },
        Err(error) => degraded_ground(client, &project, error.to_string()),
    }
}

fn degraded_ground(client: &CentralClient, project: &str, reason: String) -> SourceListing {
    match client
        .run("projectcentral.ground.inspect", json!({ "project": project }))
        .and_then(|data| {
            serde_json::from_value::<GroundInspection>(data).map_err(|error| {
                OwnerCallError::Malformed {
                    detail: format!("ground inspection did not decode: {error}"),
                }
            })
        }) {
        Ok(inspection) => SourceListing {
            schema: SOURCE_LISTING_SCHEMA.to_owned(),
            sources: inspection
                .recognised_sources
                .iter()
                .map(|binding| ListedSource {
                    source_ref: binding.source_ref.clone(),
                    path: binding.path.clone(),
                    treatment: binding.treatment.clone(),
                    agent_retrieval_allowed: binding.agent_retrieval_allowed,
                    revision: None,
                })
                .collect(),
            project: project.to_owned(),
            availability: ListingAvailability::GroundOnly { reason },
        },
        Err(error) => SourceListing {
            schema: SOURCE_LISTING_SCHEMA.to_owned(),
            sources: Vec::new(),
            project: project.to_owned(),
            availability: ListingAvailability::Unavailable {
                reason: format!("horizon: {reason}; ground: {error}"),
            },
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_reading_core_lists_from_owner_disclosures_and_writes_no_files() {
        let source = include_str!("world.rs")
            .split("\n#[cfg(test)]")
            .next()
            .unwrap();
        assert!(source.contains("projectcentral.change.horizon"));
        assert!(source.contains("projectcentral.ground.inspect"));
        assert!(!source.contains("fs::write"));
        assert!(!source.contains("OpenOptions"));
    }

    #[test]
    fn a_listing_row_carries_the_owner_ref_verbatim() {
        let row = serde_json::from_value::<ListedSource>(serde_json::json!({
            "ref": "central:source:project:project:o-i:ProjectCentral/user/learnings/README.md",
            "path": "ProjectCentral/user/learnings/README.md",
            "treatment": "projectcentral-user",
            "agent_retrieval_allowed": true,
            "revision": "central.content-fnv1a64/v1:2389:h"
        }))
        .unwrap();
        assert_eq!(
            row.source_ref,
            "central:source:project:project:o-i:ProjectCentral/user/learnings/README.md"
        );
    }
}
