use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use aikit_adapters::{
    discover_local_sources, LocalSourceDiscovery, LocalSourceDiscoveryLimits,
    ProjectCentralFilesystemBinding,
};
use aikit_core::{
    project_reflection, ContextSourceIndex, ContextSourceReadOutcome, ContextSourceReadRequest,
    HorizonRequest, ProjectCentralAccountContext, ProjectCentralOrientation,
    ProjectCentralSourceDescriptor, ProjectMap, ProjectReflectionReadModel, ProviderRef,
    ResourceRef, RetrievalTarget, PROJECTCENTRAL_FILESYSTEM_PROVIDER, PROJECT_MAP_VERSION,
};
use serde::Serialize;
use serde_json::{json, Value};

pub const PROJECT_FIELD_VERSION: &str = "oi.desktop-project-field/v1";

#[derive(Debug, Clone, Serialize)]
pub struct NativeOwnerReading {
    pub owner: String,
    pub action: String,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl NativeOwnerReading {
    fn unavailable(owner: &str, action: &str, error: impl Into<String>) -> Self {
        Self {
            owner: owner.into(),
            action: action.into(),
            available: false,
            data: None,
            error: Some(error.into()),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectMapStatus {
    pub owner: String,
    pub version: String,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectFieldSnapshot {
    pub version: String,
    pub project: String,
    pub orientation: ProjectCentralOrientation,
    pub account: ProjectCentralAccountContext,
    pub sources: Vec<ProjectCentralSourceDescriptor>,
    pub source_horizon: Vec<aikit_core::ContextSourceHit>,
    pub local_sources: LocalSourceDiscovery,
    pub central_actions: Vec<String>,
    pub projects: NativeOwnerReading,
    pub ground: NativeOwnerReading,
    pub now_day: NativeOwnerReading,
    pub project_map: ProjectMapStatus,
    pub disclosure_law: Vec<String>,
}

#[derive(Debug, Clone)]
struct CentralOwnerCli {
    executable: PathBuf,
    root: Option<PathBuf>,
    project_query: String,
}

impl CentralOwnerCli {
    fn discover(project_root: &Path) -> Self {
        let executable = env::var_os("OI_CENTRAL_CTRL_BIN")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("ctrl"));
        let root = env::var_os("OI_CENTRAL_ROOT").map(PathBuf::from);
        let project_query = env::var("OI_CENTRAL_PROJECT_QUERY").unwrap_or_else(|_| {
            project_root
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("project")
                .to_owned()
        });
        Self {
            executable,
            root,
            project_query,
        }
    }

    fn run(&self, action: &str, input: Value) -> Result<Value, String> {
        let mut command = Command::new(&self.executable);
        command.arg("--json");
        if let Some(root) = &self.root {
            command.arg("--root").arg(root);
        }
        command
            .arg("action")
            .arg("run")
            .arg(action)
            .arg(serde_json::to_string(&input).map_err(|error| error.to_string())?);
        let output = command.output().map_err(|error| {
            format!(
                "launch Central owner CLI {}: {error}",
                self.executable.display()
            )
        })?;
        let stdout = String::from_utf8(output.stdout)
            .map_err(|error| format!("Central owner CLI returned non-UTF8 output: {error}"))?;
        let value: Value = serde_json::from_str(stdout.trim()).map_err(|error| {
            format!("Central owner CLI returned invalid structured output for {action}: {error}")
        })?;
        if value.get("ok").and_then(Value::as_bool) == Some(true) {
            Ok(value.get("data").cloned().unwrap_or(Value::Null))
        } else {
            let message = value
                .pointer("/error/message")
                .and_then(Value::as_str)
                .unwrap_or("Central owner Action failed");
            Err(message.to_owned())
        }
    }

    fn action_ids(&self) -> Vec<String> {
        let Ok(data) = self.run("action.list", json!({})) else {
            return Vec::new();
        };
        data.get("actions")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|entry| entry.get("id").and_then(Value::as_str).map(str::to_owned))
            .collect()
    }

    fn reading(&self, supported: &[String], action: &str, input: Value) -> NativeOwnerReading {
        if !supported.iter().any(|candidate| candidate == action) {
            return NativeOwnerReading::unavailable(
                "central",
                action,
                "native Central owner Action is not present in the configured ctrl build",
            );
        }
        match self.run(action, input) {
            Ok(data) => NativeOwnerReading {
                owner: "central".into(),
                action: action.into(),
                available: true,
                data: Some(data),
                error: None,
            },
            Err(error) => NativeOwnerReading::unavailable("central", action, error),
        }
    }

    fn project_input(&self) -> Value {
        json!({ "project": self.project_query })
    }
}

pub struct LocalProjectField {
    binding: ProjectCentralFilesystemBinding,
    source_index: ContextSourceIndex,
    source_provider: aikit_adapters::ProjectCentralFileProvider,
    local_sources: LocalSourceDiscovery,
    central: CentralOwnerCli,
    project_map: Option<ProjectMap>,
    project_map_source: Option<PathBuf>,
    project_map_error: Option<String>,
}

impl LocalProjectField {
    pub fn discover(
        project_root: impl AsRef<Path>,
        central_root: Option<&Path>,
        project_map_source: Option<&Path>,
    ) -> Result<Self, String> {
        let project_root = project_root.as_ref();
        let binding = ProjectCentralFilesystemBinding::inspect(project_root, central_root)
            .map_err(|error| error.to_string())?;
        let mut source_index = ContextSourceIndex::default();
        for entry in binding
            .semantic
            .context_sources()
            .map_err(|error| error.to_string())?
        {
            source_index.insert(entry);
        }
        let source_provider = binding.file_provider().map_err(|error| error.to_string())?;
        let local_sources = discover_local_sources(
            binding.semantic.project.clone(),
            project_root,
            &[],
            LocalSourceDiscoveryLimits::default(),
        )
        .map_err(|error| error.to_string())?;
        let configured_map = project_map_source
            .map(Path::to_path_buf)
            .or_else(|| env::var_os("OI_AIKIT_PROJECT_MAP").map(PathBuf::from));
        let (project_map, project_map_error) = match configured_map.as_deref() {
            Some(path) => match load_project_map(path) {
                Ok(map) => (Some(map), None),
                Err(error) => (None, Some(error)),
            },
            None => (None, None),
        };
        Ok(Self {
            central: CentralOwnerCli::discover(project_root),
            binding,
            source_index,
            source_provider,
            local_sources,
            project_map,
            project_map_source: configured_map,
            project_map_error,
        })
    }

    pub fn snapshot(&self) -> Result<ProjectFieldSnapshot, String> {
        let orientation = self
            .binding
            .semantic
            .orientation()
            .map_err(|error| error.to_string())?;
        let account = self
            .binding
            .semantic
            .account_context()
            .map_err(|error| error.to_string())?;
        let source_horizon = self
            .source_index
            .horizon(&HorizonRequest::human(Some(self.binding.semantic.project.clone())));
        let central_actions = self.central.action_ids();
        let projects = self.central.reading(&central_actions, "work.list", json!({}));
        let ground = self.central.reading(
            &central_actions,
            "projectcentral.ground.inspect",
            self.central.project_input(),
        );
        let now_day = self.central.reading(
            &central_actions,
            "projectcentral.now.inspect",
            self.central.project_input(),
        );
        Ok(ProjectFieldSnapshot {
            version: PROJECT_FIELD_VERSION.into(),
            project: self.binding.semantic.project.to_string(),
            orientation,
            account,
            sources: self.binding.semantic.sources.clone(),
            source_horizon,
            local_sources: self.local_sources.clone(),
            central_actions,
            projects,
            ground,
            now_day,
            project_map: ProjectMapStatus {
                owner: "ai-kit".into(),
                version: PROJECT_MAP_VERSION.into(),
                available: self.project_map.is_some(),
                source: self
                    .project_map_source
                    .as_ref()
                    .map(|path| path.display().to_string()),
                error: self.project_map_error.clone(),
            },
            disclosure_law: vec![
                "known-to-exist != retrieved".into(),
                "selected != retrieved".into(),
                "retrieved != disclosed-into-agent-context".into(),
                "O:I semantic selection never mutates AIKit ContextResolution".into(),
            ],
        })
    }

    pub fn contains_source(&self, raw_resource: &str) -> bool {
        ResourceRef::parse(raw_resource)
            .ok()
            .and_then(|resource| self.source_index.get(&resource))
            .is_some()
    }

    pub fn search_sources(&self, query: &str) -> Vec<aikit_core::ContextSourceHit> {
        self.source_index.search(
            &HorizonRequest::human(Some(self.binding.semantic.project.clone())),
            query,
        )
    }

    pub fn read_source(&mut self, raw_resource: &str) -> Result<ContextSourceReadOutcome, String> {
        let resource = ResourceRef::parse(raw_resource).map_err(|error| error.to_string())?;
        let provider = ProviderRef::parse(PROJECTCENTRAL_FILESYSTEM_PROVIDER)
            .map_err(|error| error.to_string())?;
        Ok(self.source_index.retrieve(
            &ContextSourceReadRequest {
                resource,
                provider,
                target: RetrievalTarget::Human,
            },
            &mut self.source_provider,
        ))
    }

    pub fn explain_source(&self, raw_resource: &str) -> Result<Value, String> {
        let resource = ResourceRef::parse(raw_resource).map_err(|error| error.to_string())?;
        let explanation = self
            .source_index
            .explain(&resource)
            .ok_or_else(|| format!("ContextSource {raw_resource} is not indexed"))?;
        serde_json::to_value(explanation).map_err(|error| error.to_string())
    }

    pub fn reflection(&self, raw_resource: &str) -> Result<ProjectReflectionReadModel, String> {
        let map = self
            .project_map
            .as_ref()
            .ok_or_else(|| "no AIKit ProjectMap snapshot is configured".to_owned())?;
        let resource = ResourceRef::parse(raw_resource).map_err(|error| error.to_string())?;
        Ok(project_reflection(map, &resource, 4, 96))
    }
}

fn load_project_map(path: &Path) -> Result<ProjectMap, String> {
    let input = fs::read_to_string(path)
        .map_err(|error| format!("read AIKit ProjectMap {}: {error}", path.display()))?;
    let value: Value = serde_json::from_str(&input)
        .map_err(|error| format!("invalid AIKit ProjectMap JSON: {error}"))?;
    let map_value = value.get("map").cloned().unwrap_or(value);
    serde_json::from_value(map_value)
        .map_err(|error| format!("AIKit ProjectMap does not match {PROJECT_MAP_VERSION}: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_field_keeps_read_authority_bounded() {
        let source = include_str!("project_field.rs");
        let forbidden = ["fn invoke_", "central_action"].concat();
        assert!(source.contains("projectcentral.ground.inspect"));
        assert!(source.contains("projectcentral.now.inspect"));
        assert!(source.contains("RetrievalTarget::Human"));
        assert!(!source.contains(&forbidden));
    }
}
