//! Read-only M′ projection of S's existing composition operations.
//! Installation is discovery, not runtime readiness. This client never probes
//! product processes, installs products, resolves configuration, or mounts a
//! contribution from a capability catalogue.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

/// Milliseconds since epoch as this process's clock observes it — a plain
/// freshness stamp for a read model, never a substitute for owner-carried
/// revision/provenance.
fn observed_at_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

const PRODUCTS: [&str; 6] = [
    "central",
    "actuation",
    "ai-kit",
    "software-factory",
    "workcell",
    "quaternal-logic",
];

#[derive(Clone, Debug)]
pub struct Client {
    executable: PathBuf,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct NativeReading {
    pub command: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Availability {
    Missing,
    Discovered,
    Unavailable,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Position {
    pub product_id: String,
    pub availability: Availability,
    /// Exact source fact; registered/installed must never be labelled ready.
    pub native_state: String,
    /// Whole owner row, including identity, revisions, location and future fields.
    pub current_world: Value,
    /// A separately observed status row; not asserted atomic with CurrentWorld.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Reading {
    pub schema: String,
    pub suite_executable: PathBuf,
    pub current_world: NativeReading,
    pub status: NativeReading,
    pub positions: Vec<Position>,
    /// Missing native aggregate operations, not empty successful readings.
    pub integration_obligations: Vec<String>,
    /// When this process observed the reading (BOOT-06/12 freshness). Not
    /// an owner-carried revision — a plain "observed" stamp for the UI.
    pub observed_at_unix_ms: u64,
}

impl Client {
    pub fn discover() -> Self {
        Self::with(
            std::env::var_os("OI_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| "oi".into()),
        )
    }
    /// Explicit S executable for a verified candidate; never a product bypass.
    pub fn with(executable: PathBuf) -> Self {
        Self { executable }
    }
    pub fn read(&self, cwd: &Path) -> Reading {self.read_with_owners(cwd,false)}
    pub fn read_with_owners(&self, cwd:&Path, owners:bool)->Reading {
        let current_world = self.invoke(
            cwd,
            "current-world",
            "oi.current-world/v1",
            "positions",
            "product_id",owners,
        );
        let status = self.invoke(cwd, "status", "oi.suite-status/v1", "surfaces", "id",false);
        let positions = current_world
            .data
            .as_ref()
            .and_then(|v| v["positions"].as_array())
            .map(|rows| {
                rows.iter()
                    .map(|row| {
                        let product_id = row["product_id"].as_str().expect("validated identity");
                        let native_state = row["state"].as_str().expect("validated state");
                        let status_row = status
                            .data
                            .as_ref()
                            .and_then(|v| v["surfaces"].as_array())
                            .and_then(|rows| {
                                rows.iter().find(|v| v["id"].as_str() == Some(product_id))
                            })
                            .cloned();
                        Position {
                            product_id: product_id.into(),
                            availability: match native_state {
                                "missing" => Availability::Missing,
                                "broken" => Availability::Unavailable,
                                _ => Availability::Discovered,
                            },
                            native_state: native_state.into(),
                            current_world: row.clone(),
                            status: status_row,
                        }
                    })
                    .collect()
            })
            .unwrap_or_default();
        Reading {
            schema: "oi.desktop-composition-reading/v1".into(), suite_executable: self.executable.clone(),
            current_world, status, positions,
            observed_at_unix_ms: observed_at_unix_ms(),
            integration_obligations: vec![
                "Native per-operation readiness/compatibility disclosure; installation is not ready, incompatible or degraded runtime evidence.".into(),
                "Native authored/effective/active configuration readings with owner refs; installation versions are not these axes.".into(),
                "Native Action/Surface contribution descriptors and containment/availability contract; a capability catalogue is not a mountable contribution.".into(),
            ],
        }
    }
    fn invoke(
        &self,
        cwd: &Path,
        operation: &str,
        schema: &str,
        rows: &str,
        id: &str, owners:bool,
    ) -> NativeReading {
        let mut command:Vec<String> = vec![operation.into()];
        if owners {command.push("--owners".into());}
        command.push("--json".into());
        let result = (|| {
            let output = Command::new(&self.executable)
                .current_dir(cwd)
                .args(&command)
                .output()
                .map_err(|e| format!("S composition command unavailable: {e}"))?;
            if !output.status.success() {
                return Err(format!(
                    "S {operation} failed ({}): {}",
                    output.status,
                    String::from_utf8_lossy(&output.stderr).trim()
                ));
            }
            let data: Value = serde_json::from_slice(&output.stdout)
                .map_err(|e| format!("S {operation} returned unreadable JSON: {e}"))?;
            validate(&data, schema, rows, id)?;
            Ok(data)
        })();
        match result {
            Ok(data) => NativeReading {
                command,
                data: Some(data),
                error: None,
            },
            Err(error) => NativeReading {
                command,
                data: None,
                error: Some(error),
            },
        }
    }
}

fn validate(data: &Value, schema: &str, rows: &str, id: &str) -> Result<(), String> {
    if data["schema"].as_str() != Some(schema) {
        return Err(format!(
            "Unsupported S composition schema; expected {schema}"
        ));
    }
    let rows = data[rows]
        .as_array()
        .ok_or("S composition has no owner rows")?;
    let mut seen = BTreeSet::new();
    for row in rows {
        let product = row[id]
            .as_str()
            .ok_or("S composition owner identity missing")?;
        if !PRODUCTS.contains(&product) || !seen.insert(product) {
            return Err("S composition contains unknown or duplicate owner identity".into());
        }
        if !matches!(
            row["state"].as_str(),
            Some("missing" | "installed" | "registered" | "broken")
        ) {
            return Err(format!("Unsupported S availability state for {product}"));
        }
    }
    if seen.len() != PRODUCTS.len() {
        return Err("S composition does not disclose all six owners".into());
    }
    Ok(())
}
