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
    read_central_change_horizon_with(&executable, &project, central_root)
}

fn read_central_change_horizon_with(
    executable: &Path,
    project: &str,
    central_root: Option<&Path>,
) -> Result<CentralSourceHorizon, String> {
    let mut command = Command::new(executable);
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
    if !output.status.success() {
        return Err(format!(
            "Central projectcentral.change.horizon returned success JSON with process status {}",
            output.status
        ));
    }
    let data = result.get("data").cloned().unwrap_or(Value::Null);
    parse_central_horizon(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn launches_real_process_with_central_action_contract_and_consumes_owner_json() {
        use std::fs;
        use std::os::unix::fs::PermissionsExt;
        use std::time::{SystemTime, UNIX_EPOCH};

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = env::temp_dir().join(format!("oi-central-contract-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let executable = root.join("ctrl-fixture");
        let argv_log = root.join("argv.log");
        let script = format!(
            r#"#!/bin/sh
printf '%s\n' "$@" > '{}'
printf '%s\n' '{{"ok":true,"data":{{"schema":"central.source-change-horizon/v1","world_ref":"project:test","cursor":0,"sources":[],"changes":[],"provider":"central.filesystem-reconcile/v1","source_payloads_exposed":false,"automatic_agent_or_model_invocation":false}}}}'
"#,
            argv_log.display()
        );
        fs::write(&executable, script).unwrap();
        let mut permissions = fs::metadata(&executable).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&executable, permissions).unwrap();

        let central_root = root.join("Central");
        let horizon = read_central_change_horizon_with(
            &executable,
            "test",
            Some(&central_root),
        )
        .unwrap();
        assert_eq!(horizon.world_ref, "project:test");
        assert_eq!(horizon.provider, "central.filesystem-reconcile/v1");
        assert!(!horizon.source_payloads_exposed);
        assert!(!horizon.automatic_agent_or_model_invocation);

        let argv = fs::read_to_string(&argv_log).unwrap();
        let args = argv.lines().collect::<Vec<_>>();
        assert_eq!(
            args,
            vec![
                "--json",
                "--root",
                central_root.to_str().unwrap(),
                "action",
                "run",
                "projectcentral.change.horizon",
                "{\"project\":\"test\"}",
            ]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn process_failure_cannot_be_promoted_by_a_success_shaped_payload() {
        use std::fs;
        use std::os::unix::fs::PermissionsExt;
        use std::time::{SystemTime, UNIX_EPOCH};

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = env::temp_dir().join(format!("oi-central-status-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let executable = root.join("ctrl-fixture");
        fs::write(
            &executable,
            r#"#!/bin/sh
printf '%s\n' '{"ok":true,"data":{"schema":"central.source-change-horizon/v1","world_ref":"project:test","cursor":0,"sources":[],"changes":[],"provider":"central.filesystem-reconcile/v1","source_payloads_exposed":false,"automatic_agent_or_model_invocation":false}}'
exit 7
"#,
        )
        .unwrap();
        let mut permissions = fs::metadata(&executable).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&executable, permissions).unwrap();

        let error = read_central_change_horizon_with(&executable, "test", None).unwrap_err();
        assert!(error.contains("process status"));

        fs::remove_dir_all(root).unwrap();
    }
}