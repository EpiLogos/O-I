//! Native Central Source Change Horizon client for the desktop host.
//!
//! This is an owner Action adapter only. It never reads `.central` files, watches
//! the filesystem, or derives source truth locally. Correctness remains Central's
//! `projectcentral.change.horizon` reconciliation contract.

use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::{json, Value};

use crate::{parse_central_horizon, CentralSourceHorizon};

pub fn read_central_change_horizon(
    project_root: &Path,
    central_root: Option<&Path>,
) -> Result<CentralSourceHorizon, String> {
    let executable = env::var_os("OI_CENTRAL_CTRL_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("ctrl"));
    let project = env::var("OI_CENTRAL_PROJECT_QUERY").unwrap_or_else(|_| {
        project_root
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("project")
            .to_owned()
    });
    let mut command = Command::new(&executable);
    command.arg("--json");
    if let Some(root) = central_root {
        command.arg("--root").arg(root);
    }
    command
        .arg("action")
        .arg("run")
        .arg("projectcentral.change.horizon")
        .arg(
            serde_json::to_string(&json!({ "project": project }))
                .map_err(|error| error.to_string())?,
        );
    let output = command.output().map_err(|error| {
        format!(
            "launch Central owner CLI {} for Source Change Horizon: {error}",
            executable.display()
        )
    })?;
    let stdout = String::from_utf8(output.stdout)
        .map_err(|error| format!("Central owner CLI returned non-UTF8 output: {error}"))?;
    let result: Value = serde_json::from_str(stdout.trim()).map_err(|error| {
        format!("Central owner CLI returned invalid structured change horizon output: {error}")
    })?;
    if result.get("ok").and_then(Value::as_bool) != Some(true) {
        return Err(result
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("Central projectcentral.change.horizon failed")
            .to_owned());
    }
    let data = result.get("data").cloned().unwrap_or(Value::Null);
    parse_central_horizon(data)
}

#[cfg(test)]
mod tests {
    #[test]
    fn client_never_reads_central_derived_state_directly() {
        let source = include_str!("central_change.rs");
        assert!(source.contains("projectcentral.change.horizon"));
        assert!(!source.contains("source-change-horizon.json"));
        assert!(!source.contains("notify::"));
        assert!(!source.contains("RecommendedWatcher"));
    }
}
