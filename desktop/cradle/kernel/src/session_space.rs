use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{path::Path, process::Command};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum Request {
    Discover { project: String },
    ProjectContext,
    Create { id: String, #[serde(default)] label: Option<String> },
    Stage { #[serde(default)] space: Option<String>, intent: Value },
    Apply { preview: Value },
    Open { space: String },
    ResolveWorking { space: String, agent_session: String, #[serde(default)] surface: Option<String> },
}

#[derive(Clone, Debug)]
pub struct Client { executable: std::path::PathBuf }

impl Client {
    pub fn discover() -> Self {
        Self { executable: std::env::var_os("OI_BIN").map(Into::into).unwrap_or_else(|| "oi".into()) }
    }

    pub fn run(&self, cwd: &Path, request: &Request, project_ref: &str) -> Result<Value, String> {
        if let Request::ResolveWorking { space, agent_session, surface } = request {
            let state = self.run(cwd, &Request::Open { space: space.clone() }, project_ref)?;
            if state["version"] != "aikit.session-space-application/v1" || state["definition"]["id"].as_str() != Some(space) {
                return Err("AIKit returned a different SessionSpace".into());
            }
            if !state["definition"]["projects"].as_array().is_some_and(|refs| refs.iter().any(|value| value.as_str() == Some(project_ref))) {
                return Err("The working SessionSpace is not bound to this Central Project".into());
            }
            let bindings = state["working_surfaces"].as_object().ok_or("This SessionSpace has no persisted working Surface bindings")?;
            let matches: Vec<_> = bindings.values().filter(|value| value["agent_session"].as_str() == Some(agent_session)
                && surface.as_ref().is_none_or(|expected| value["surface"].as_str() == Some(expected))).collect();
            if matches.len() != 1 { return Err(format!("Expected one exact persisted working Surface, found {}", matches.len())); }
            let binding = matches[0];
            let binding_ref = binding["binding"].as_str().ok_or("AIKit binding has no canonical ref")?;
            let output = Command::new(&self.executable).arg("aikit-session-space").arg("-C").arg(cwd)
                .args(["working-surface", "observe", space, binding_ref]).output().map_err(|e| e.to_string())?;
            if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned()); }
            let evidence: Value = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;
            let reading = &evidence["reading"];
            if reading["schema"] != "aikit.session-space-working-surface/v1" || reading["space"].as_str() != Some(space)
                || reading["agent_session"].as_str() != Some(agent_session) || reading["binding"].as_str() != Some(binding_ref)
                || reading["surface"] != binding["surface"] {
                return Err("AIKit working Surface observation does not match the persisted binding".into());
            }
            return Ok(serde_json::json!({"binding": binding, "observation": evidence, "service_cwd": cwd}));
        }
        let mut command = Command::new(&self.executable);
        command.arg("aikit-session-space").arg("-C").arg(cwd);
        match request {
            Request::Discover { project } => { command.args(["discover", "--project", project]); }
            Request::ProjectContext => { command.arg("project-context"); }
            Request::Create { id, label } => { command.args(["create", id]); if let Some(label) = label { command.args(["--label", label]); } }
            Request::Stage { space, intent } => { command.arg("stage"); if let Some(space) = space { command.args(["--space", space]); } command.args(["--intent-json", &serde_json::to_string(intent).map_err(|e| e.to_string())?]); }
            Request::Apply { preview } => { command.args(["apply", "--preview-json", &serde_json::to_string(preview).map_err(|e| e.to_string())?]); }
            Request::Open { space } => { command.args(["open", space]); }
            Request::ResolveWorking { .. } => unreachable!("resolved above"),
        }
        let output = command.output().map_err(|e| format!("AIKit SessionSpace unavailable: {e}"))?;
        if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned()); }
        let data: Value = serde_json::from_slice(&output.stdout).map_err(|e| format!("AIKit SessionSpace returned unreadable JSON: {e}"))?;
        if matches!(request, Request::ProjectContext) && data["project"].as_str() != Some(project_ref) {
            return Err("AIKit ProjectContext resolved a different Central Project".into());
        }
        Ok(data)
    }
}
