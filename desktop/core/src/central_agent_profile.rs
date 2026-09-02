//! Native Central AgentProfile Action client for the O:I desktop host.
//!
//! This adapter preserves Central as the source owner. It invokes the canonical
//! `ctrl --json action run agent-profile.*` surface and returns the owner payload
//! unchanged. It never reads `Control/agents/profiles` or
//! `ProjectCentral/agents/profiles` directly and it never derives AIKit effective
//! Profile/ContextResolution state from Central source.

use serde_json::{json, Value};
use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

pub const CENTRAL_AGENT_PROFILE_SCHEMA: &str = "central.agent-profile/v1";

#[derive(Debug, Clone)]
pub struct CentralAgentProfileClient {
    executable: PathBuf,
    central_root: Option<PathBuf>,
}

impl CentralAgentProfileClient {
    pub fn discover() -> Self {
        Self {
            executable: env::var_os("OI_CENTRAL_CTRL_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("ctrl")),
            central_root: env::var_os("OI_CENTRAL_ROOT").map(PathBuf::from),
        }
    }

    pub fn list(&self, scope: &str, project: Option<&str>) -> Result<Value, String> {
        let data = self.run_action("agent-profile.list", scope_input(scope, project))?;
        if data
            .get("source_payloads_disclosed")
            .and_then(Value::as_bool)
            != Some(false)
        {
            return Err(
                "Central agent-profile.list did not preserve source-payload non-disclosure"
                    .into(),
            );
        }
        Ok(data)
    }

    pub fn read(
        &self,
        scope: &str,
        project: Option<&str>,
        profile_ref: &str,
    ) -> Result<Value, String> {
        let mut input = scope_input(scope, project);
        input["profile_ref"] = Value::String(required(profile_ref, "profile_ref")?);
        let data = self.run_action("agent-profile.read", input)?;
        validate_reading_schema(&data)?;
        Ok(data)
    }

    pub fn save(
        &self,
        scope: &str,
        project: Option<&str>,
        profile: Value,
        expected_revision: Option<&str>,
    ) -> Result<Value, String> {
        let schema = profile
            .get("schema")
            .and_then(Value::as_str)
            .ok_or_else(|| "AgentProfile source must disclose schema".to_owned())?;
        if schema != CENTRAL_AGENT_PROFILE_SCHEMA {
            return Err(format!(
                "unsupported AgentProfile source schema `{schema}`; expected `{CENTRAL_AGENT_PROFILE_SCHEMA}`"
            ));
        }
        let mut input = scope_input(scope, project);
        input["profile"] = profile;
        if let Some(revision) = expected_revision {
            input["expected_revision"] = Value::String(required(revision, "expected_revision")?);
        }
        self.run_action("agent-profile.save", input)
    }

    pub fn remove(
        &self,
        scope: &str,
        project: Option<&str>,
        profile_ref: &str,
        expected_revision: &str,
    ) -> Result<Value, String> {
        let mut input = scope_input(scope, project);
        input["profile_ref"] = Value::String(required(profile_ref, "profile_ref")?);
        input["expected_revision"] =
            Value::String(required(expected_revision, "expected_revision")?);
        let data = self.run_action("agent-profile.remove", input)?;
        if data
            .get("agent_identity_deleted")
            .and_then(Value::as_bool)
            != Some(false)
            || data
                .get("runtime_state_deleted")
                .and_then(Value::as_bool)
                != Some(false)
        {
            return Err(
                "Central agent-profile.remove did not preserve Agent/runtime identity boundary"
                    .into(),
            );
        }
        Ok(data)
    }

    fn run_action(&self, action: &str, input: Value) -> Result<Value, String> {
        run_central_action_with(
            &self.executable,
            self.central_root.as_deref(),
            action,
            input,
        )
    }
}

fn scope_input(scope: &str, project: Option<&str>) -> Value {
    let mut input = json!({ "scope": scope });
    if let Some(project) = project {
        input["project"] = Value::String(project.to_owned());
    }
    input
}

fn required(value: &str, field: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        Err(format!("{field} must be non-empty"))
    } else {
        Ok(value.to_owned())
    }
}

fn validate_reading_schema(data: &Value) -> Result<(), String> {
    let schema = data
        .pointer("/profile/schema")
        .and_then(Value::as_str)
        .ok_or_else(|| "Central AgentProfile reading does not disclose profile.schema".to_owned())?;
    if schema != CENTRAL_AGENT_PROFILE_SCHEMA {
        return Err(format!(
            "unsupported Central AgentProfile reading schema `{schema}`; expected `{CENTRAL_AGENT_PROFILE_SCHEMA}`"
        ));
    }
    Ok(())
}

fn run_central_action_with(
    executable: &Path,
    central_root: Option<&Path>,
    action: &str,
    input: Value,
) -> Result<Value, String> {
    let mut command = Command::new(executable);
    command.arg("--json");
    if let Some(root) = central_root {
        command.arg("--root").arg(root);
    }
    command
        .arg("action")
        .arg("run")
        .arg(action)
        .arg(serde_json::to_string(&input).map_err(|error| error.to_string())?);

    let output = command.output().map_err(|error| {
        format!(
            "launch Central owner CLI {} for {action}: {error}",
            executable.display()
        )
    })?;
    let stdout = String::from_utf8(output.stdout)
        .map_err(|error| format!("Central owner CLI returned non-UTF8 output: {error}"))?;
    let result: Value = serde_json::from_str(stdout.trim()).map_err(|error| {
        format!("Central owner CLI returned invalid structured {action} output: {error}")
    })?;
    if result.get("ok").and_then(Value::as_bool) != Some(true) {
        return Err(result
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("Central AgentProfile Action failed")
            .to_owned());
    }
    if !output.status.success() {
        return Err(format!(
            "Central {action} returned success JSON with process status {}",
            output.status
        ));
    }
    Ok(result.get("data").cloned().unwrap_or(Value::Null))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    fn fixture() -> (PathBuf, PathBuf, PathBuf) {
        use std::fs;
        use std::os::unix::fs::PermissionsExt;
        use std::time::{SystemTime, UNIX_EPOCH};

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = env::temp_dir().join(format!(
            "oi-agent-profile-contract-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        let executable = root.join("ctrl-fixture");
        let argv_log = root.join("argv.log");
        let script = format!(
            r#"#!/bin/sh
printf '%s\n' "$@" > '{}'
action="$5"
if [ "$action" = "agent-profile.list" ]; then
  printf '%s\n' '{{"ok":true,"data":{{"scope":"personal","profiles":[],"source_payloads_disclosed":false}}}}'
elif [ "$action" = "agent-profile.read" ]; then
  printf '%s\n' '{{"ok":true,"data":{{"profile":{{"schema":"central.agent-profile/v1","ref":"agent-profile:guardian","revision":"p1","agent_ref":"agent:guardian","scope":"personal","world_ref":"world:personal","ratified_world_refs":["world:personal"]}},"source_path":"Control/agents/profiles/profile-x.json"}}}}'
elif [ "$action" = "agent-profile.remove" ]; then
  printf '%s\n' '{{"ok":true,"data":{{"removed":{{"profile":{{"schema":"central.agent-profile/v1"}}}},"agent_identity_deleted":false,"runtime_state_deleted":false}}}}'
else
  printf '%s\n' '{{"ok":true,"data":{{"profile_ref":"agent-profile:guardian","revision":"p1","created":true}}}}'
fi
"#,
            argv_log.display()
        );
        fs::write(&executable, script).unwrap();
        let mut permissions = fs::metadata(&executable).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&executable, permissions).unwrap();
        (root, executable, argv_log)
    }

    #[cfg(unix)]
    #[test]
    fn invokes_canonical_central_profile_actions_without_reading_profile_files() {
        use std::fs;

        let (root, executable, argv_log) = fixture();
        let client = CentralAgentProfileClient {
            executable,
            central_root: Some(root.join("Central")),
        };
        let listed = client.list("personal", None).unwrap();
        assert_eq!(listed["source_payloads_disclosed"], false);
        let argv = fs::read_to_string(&argv_log).unwrap();
        assert!(argv.contains("agent-profile.list"));
        assert!(argv.contains("{\"scope\":\"personal\"}"));

        let reading = client
            .read("personal", None, "agent-profile:guardian")
            .unwrap();
        assert_eq!(reading["profile"]["agent_ref"], "agent:guardian");

        let saved = client
            .save(
                "personal",
                None,
                json!({
                    "schema": CENTRAL_AGENT_PROFILE_SCHEMA,
                    "ref": "agent-profile:guardian",
                    "revision": "p1",
                    "agent_ref": "agent:guardian",
                    "scope": "personal",
                    "world_ref": "world:personal",
                    "ratified_world_refs": ["world:personal"]
                }),
                None,
            )
            .unwrap();
        assert_eq!(saved["created"], true);

        let removed = client
            .remove(
                "personal",
                None,
                "agent-profile:guardian",
                "p1",
            )
            .unwrap();
        assert_eq!(removed["agent_identity_deleted"], false);
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn process_failure_cannot_be_promoted_by_success_shaped_payload() {
        use std::fs;
        use std::os::unix::fs::PermissionsExt;

        let (root, executable, _) = fixture();
        fs::write(
            &executable,
            "#!/bin/sh\nprintf '%s\\n' '{\"ok\":true,\"data\":{}}'\nexit 7\n",
        )
        .unwrap();
        let mut permissions = fs::metadata(&executable).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&executable, permissions).unwrap();
        let error = run_central_action_with(
            &executable,
            Some(&root.join("Central")),
            "agent-profile.list",
            json!({"scope":"personal"}),
        )
        .unwrap_err();
        assert!(error.contains("process status"));
        fs::remove_dir_all(root).unwrap();
    }
}
