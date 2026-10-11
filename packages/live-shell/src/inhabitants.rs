//! Operator-selected retained native identities. Configuration carries no
//! document bodies; the portable boundary reads and opens through owners.
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::io::Read;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    Expressions,
    Techne,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Basis {
    storage_revision: u64,
    document_revision: u64,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ConfiguredWork {
    scope: Scope,
    checkpoint_id: String,
    expression_ref: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    expected_basis: Option<Basis>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Configuration {
    schema: String,
    works: Vec<ConfiguredWork>,
}

pub fn configured_works() -> Result<Vec<ConfiguredWork>, String> {
    let path = match std::env::var("LIVE_SHELL_SAVED_WORK_CONFIG") {
        Ok(path) if !path.trim().is_empty() => path,
        Ok(_) => return Err("LIVE_SHELL_SAVED_WORK_CONFIG is empty".into()),
        Err(std::env::VarError::NotPresent) => return Ok(Vec::new()),
        Err(error) => return Err(error.to_string()),
    };
    let file = std::fs::File::open(&path)
        .map_err(|error| format!("Cannot open saved-work configuration {path}: {error}"))?;
    let mut bytes = Vec::new();
    file.take(64 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Cannot read saved-work configuration {path}: {error}"))?;
    if bytes.len() > 64 * 1024 {
        return Err("Saved-work identity configuration exceeds 64 KiB".into());
    }
    let config: Configuration = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Invalid saved-work configuration: {error}"))?;
    if config.schema != "techne.shell.saved-work-config/v1"
        || config.works.is_empty()
        || config.works.len() > 64
    {
        return Err(
            "Saved-work configuration requires its native schema and one to 64 identities".into(),
        );
    }
    let mut refs = BTreeSet::new();
    for work in &config.works {
        if !work
            .expression_ref
            .strip_prefix("expression:")
            .is_some_and(|id| {
                !id.is_empty()
                    && id.len() <= 128
                    && id
                        .bytes()
                        .all(|byte| byte.is_ascii_alphanumeric() || b"_.-".contains(&byte))
            })
            || work.checkpoint_id != work.expression_ref
            || !refs.insert(&work.expression_ref)
        {
            return Err(
                "Choose one exact canonical checkpoint id and Expression ref per work".into(),
            );
        }
        if let Some(basis) = &work.expected_basis {
            if [basis.storage_revision, basis.document_revision]
                .iter()
                .any(|revision| *revision == 0 || *revision > 9_007_199_254_740_991)
            {
                return Err("Captured work bases require positive safe native revisions".into());
            }
        }
    }
    Ok(config.works)
}
