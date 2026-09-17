//! Read the owner's durable, source-scoped change records. No desktop journal.
use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::flow::{CentralClient, OwnerCallError};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct SourceChange {
    pub change_ref: String,
    pub source_ref: String,
    pub cursor: u64,
    pub before_revision: Option<String>,
    pub after_revision: Option<String>,
    pub kind: String,
    pub observed_at_unix_seconds: u64,
    pub actor: Option<String>,
    pub actor_kind: Option<String>,
    pub agent_session_ref: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct SourceHistory {
    pub source_ref: String,
    pub world_ref: String,
    pub provider: String,
    pub cursor: u64,
    pub changes: Vec<SourceChange>,
}

#[derive(Deserialize)]
struct Horizon {
    schema: String,
    world_ref: String,
    provider: String,
    cursor: u64,
    changes: Vec<SourceChange>,
    automatic_agent_or_model_invocation: bool,
}

pub fn read(client: &CentralClient, project: &str, source_ref: &str) -> Result<SourceHistory, OwnerCallError> {
    // Recheck the owner's current retrieval gate, even for a held buffer.
    client.source_read(Some(project), source_ref)?;
    let value = client.run("projectcentral.change.horizon", json!({"project": project}))?;
    let horizon: Horizon = serde_json::from_value(value).map_err(|error| OwnerCallError::Malformed {
        detail: format!("decode Central source history: {error}"),
    })?;
    if horizon.schema != "central.source-change-horizon/v1" || horizon.automatic_agent_or_model_invocation {
        return Err(OwnerCallError::Malformed { detail: "unsupported Central change horizon".into() });
    }
    let mut changes: Vec<_> = horizon.changes.into_iter().filter(|c| c.source_ref == source_ref).collect();
    changes.sort_by_key(|c| std::cmp::Reverse(c.cursor));
    Ok(SourceHistory { source_ref: source_ref.into(), world_ref: horizon.world_ref,
        provider: horizon.provider, cursor: horizon.cursor, changes })
}
