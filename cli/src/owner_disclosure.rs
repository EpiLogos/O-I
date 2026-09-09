//! Read-only owner disclosure through S's existing, source-declared commands.
//! A successful capability read proves that read, not runtime readiness, an
//! active configuration, or a mountable Surface. Preserve each owner's grammar.
use crate::{product_command, status};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct OperationReading {
    pub command: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reading: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct OwnerReading {
    pub product_id: String,
    /// Source-declared CLI contract, including revision/install provenance.
    /// This is not a registered runtime Surface contribution.
    pub command_contract: Value,
    /// Registration/installation discovery. Not asserted to identify a process
    /// already running, nor to supersede explicit per-command owner overrides.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub discovery: Option<Value>,
    pub capabilities: OperationReading,
    /// AIKit's cwd-scoped resolved capability view. Native `active` here means
    /// selected capabilities, not a running agent's active material.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effective_context: Option<OperationReading>,
    pub obligations: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Reading {
    pub schema: String,
    pub suite_executable: PathBuf,
    pub cwd: PathBuf,
    /// The exact independent source discovery reading, including warnings.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub discovery: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub discovery_error: Option<String>,
    pub owners: Vec<OwnerReading>,
}

/// Explicit S binary prevents a freshly built caller silently using stale PATH
/// routing. No install, verification, provider start or configuration write runs.
pub fn read(suite_executable: &Path, cwd: &Path) -> Result<Reading, String> {
    let catalogue = product_command::product_command_catalogue()?;
    let (discovery, discovery_error) = match status::live_disclosure() {
        Ok(value) => (
            Some(serde_json::to_value(value).map_err(|e| e.to_string())?),
            None,
        ),
        Err(error) => (None, Some(error)),
    };
    let mut owners = Vec::with_capacity(catalogue.products.len());
    for product in catalogue.products {
        let mut command = vec![product.namespace.clone()];
        command.extend(product.capability_command.clone());
        let capabilities = invoke(suite_executable, cwd, command);
        let effective_context = (product.id == "ai-kit").then(|| {
            invoke(
                suite_executable,
                cwd,
                vec![
                    product.namespace.clone(),
                    "status".into(),
                    "--all".into(),
                    "--json".into(),
                ],
            )
        });
        let owner_discovery = discovery
            .as_ref()
            .and_then(|v| v["surfaces"].as_array())
            .and_then(|rows| {
                rows.iter()
                    .find(|row| row["id"].as_str() == Some(&product.id))
            })
            .cloned();
        owners.push(OwnerReading {
            product_id: product.id.clone(),
            command_contract: serde_json::to_value(&product).map_err(|e|e.to_string())?,
            discovery: owner_discovery, capabilities, effective_context,
            obligations: vec![
                "Per-operation readiness and compatibility must be read from the relevant native owner; capability-command success is not readiness.".into(),
                "Authored/effective/active configuration axes require situated owner refs and separate native reads; no aggregate configuration contract is disclosed here.".into(),
                "Mountable Action/Surface contributions require native identity, body, containment, invocation and availability contracts; these capability readings are not mount descriptors.".into(),
            ],
        });
    }
    Ok(Reading {
        schema: "oi.owner-disclosure/v1".into(),
        suite_executable: suite_executable.into(),
        cwd: cwd.into(),
        discovery,
        discovery_error,
        owners,
    })
}

fn invoke(suite: &Path, cwd: &Path, command: Vec<String>) -> OperationReading {
    let mut result = OperationReading {
        command,
        exit_code: None,
        reading: None,
        error: None,
    };
    match Command::new(suite)
        .current_dir(cwd)
        .args(&result.command)
        .output()
    {
        Err(error) => result.error = Some(format!("S owner read unavailable: {error}")),
        Ok(output) => {
            result.exit_code = output.status.code();
            match serde_json::from_slice::<Value>(&output.stdout) {
                Ok(value) => {
                    // Retain refusal envelopes too; absence/error is native data.
                    if value.get("ok").and_then(Value::as_bool) == Some(false) {
                        result.error = Some(
                            "Native owner refused the disclosure; see its retained reading".into(),
                        );
                    }
                    result.reading = Some(value);
                }
                Err(error) => {
                    result.error = Some(format!("Native disclosure is not JSON: {error}"))
                }
            }
            if !output.status.success() {
                result.error = Some(format!(
                    "S owner read failed ({}): {}",
                    output.status,
                    String::from_utf8_lossy(&output.stderr).trim()
                ));
            }
        }
    }
    result
}
