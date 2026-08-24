//! O:I desktop Flow composition over native Central + AIKit owner contracts.
//!
//! Central owns Flow source identity, revision, provenance and mutation. AIKit owns
//! situated standing context, AgentSession relation, praxis and deliberate
//! contemplation. O:I invokes those public seams and projects the result into the
//! existing workbench; it owns no Flow registry, file writer, revision scheme or
//! AgentSession identity.

use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

use aikit_core::{
    bind_flow_for_act, ContextResolution, FlowCapabilities, FlowLifecycle, FlowProvider,
    FlowReadOutcome, FlowSourceDescriptor, FlowStandingContext, FlowWriteRequest,
    FlowWriteResult, ResourceRef, SourceRef, SourceRevision,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const OI_FLOW_DESKTOP_VERSION: &str = "oi.desktop-flow/v1";
pub const CENTRAL_FLOW_PROVIDER_REF: &str = "provider:central-flow";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CentralFlowRevisionReceipt {
    pub revision: String,
    #[serde(default)]
    pub parent_revision: Option<String>,
    pub actor: String,
    pub actor_kind: String,
    #[serde(default)]
    pub agent_session_ref: Option<String>,
    pub recorded_at_unix_seconds: u64,
    pub source_path: String,
    pub history_source: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CentralFlowRecord {
    pub flow_ref: String,
    pub source_ref: String,
    pub path: String,
    pub created_at_unix_seconds: u64,
    pub current_revision: String,
    pub lifecycle: String,
    #[serde(default)]
    pub title: Option<String>,
    pub scope_ref: String,
    pub privacy: String,
    #[serde(default)]
    pub revisions: Vec<CentralFlowRevisionReceipt>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CentralFlowList {
    pub schema: String,
    pub project_id: String,
    #[serde(default)]
    pub flows: Vec<CentralFlowRecord>,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CentralFlowReading {
    pub schema: String,
    pub flow: CentralFlowRecord,
    pub content: String,
    pub dirty_external_revision_reconciled: bool,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FlowDesktopSnapshot {
    pub version: String,
    pub provider: String,
    pub project_id: String,
    pub flows: Vec<CentralFlowRecord>,
    pub source_role: String,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FlowDocumentReading {
    pub version: String,
    pub provider: String,
    pub flow: CentralFlowRecord,
    pub content: String,
    pub dirty_external_revision_reconciled: bool,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Debug, Clone)]
pub struct CentralFlowClient {
    executable: PathBuf,
    central_root: Option<PathBuf>,
    project_query: String,
    provider_ref: ResourceRef,
}

impl CentralFlowClient {
    pub fn discover(project_root: &Path, central_root: Option<&Path>) -> Result<Self, String> {
        let executable = env::var_os("OI_CENTRAL_CTRL_BIN")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("ctrl"));
        let project_query = env::var("OI_CENTRAL_PROJECT_QUERY").unwrap_or_else(|_| {
            project_root
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("project")
                .to_owned()
        });
        Self::with(executable, central_root.map(Path::to_path_buf), project_query)
    }

    fn with(
        executable: PathBuf,
        central_root: Option<PathBuf>,
        project_query: String,
    ) -> Result<Self, String> {
        Ok(Self {
            executable,
            central_root,
            project_query,
            provider_ref: ResourceRef::parse(CENTRAL_FLOW_PROVIDER_REF)
                .map_err(|error| error.to_string())?,
        })
    }

    fn run(&self, action: &str, mut input: Value) -> Result<Value, String> {
        if let Some(object) = input.as_object_mut() {
            object
                .entry("project".to_owned())
                .or_insert_with(|| Value::String(self.project_query.clone()));
        }
        let mut command = Command::new(&self.executable);
        command.arg("--json");
        if let Some(root) = &self.central_root {
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
                self.executable.display()
            )
        })?;
        let stdout = String::from_utf8(output.stdout)
            .map_err(|error| format!("Central Flow owner returned non-UTF8 output: {error}"))?;
        let value: Value = serde_json::from_str(stdout.trim()).map_err(|error| {
            format!("Central Flow owner returned invalid structured output for {action}: {error}")
        })?;
        if value.get("ok").and_then(Value::as_bool) != Some(true) {
            return Err(value
                .pointer("/error/message")
                .and_then(Value::as_str)
                .or_else(|| value.get("message").and_then(Value::as_str))
                .unwrap_or("Central Flow owner Action failed")
                .to_owned());
        }
        if !output.status.success() {
            return Err(format!(
                "Central Flow owner returned success JSON with process status {}",
                output.status
            ));
        }
        Ok(value.get("data").cloned().unwrap_or(Value::Null))
    }

    pub fn list(&self) -> Result<FlowDesktopSnapshot, String> {
        let data = self.run("projectcentral.flow.list", json!({}))?;
        let list: CentralFlowList = serde_json::from_value(data)
            .map_err(|error| format!("decode Central Flow list: {error}"))?;
        if list.automatic_agent_or_model_invocation {
            return Err("Central Flow list violated zero-background-Agent law".into());
        }
        Ok(FlowDesktopSnapshot {
            version: OI_FLOW_DESKTOP_VERSION.into(),
            provider: self.provider_ref.to_string(),
            project_id: list.project_id,
            flows: list.flows,
            source_role: "flow-source".into(),
            automatic_agent_or_model_invocation: false,
        })
    }

    pub fn create_blank(&self, actor: &str) -> Result<FlowDocumentReading, String> {
        let data = self.run(
            "projectcentral.flow.create",
            json!({"actor": actor, "actor_kind": "human"}),
        )?;
        if data
            .get("automatic_agent_or_model_invocation")
            .and_then(Value::as_bool)
            == Some(true)
        {
            return Err("Central Flow create violated zero-background-Agent law".into());
        }
        let flow: CentralFlowRecord = serde_json::from_value(
            data.get("flow")
                .cloned()
                .ok_or_else(|| "Central Flow create omitted flow record".to_owned())?,
        )
        .map_err(|error| format!("decode Central created Flow: {error}"))?;
        Ok(FlowDocumentReading {
            version: OI_FLOW_DESKTOP_VERSION.into(),
            provider: self.provider_ref.to_string(),
            flow,
            content: String::new(),
            dirty_external_revision_reconciled: false,
            automatic_agent_or_model_invocation: false,
        })
    }

    pub fn open(&self, flow_ref: &str) -> Result<FlowDocumentReading, String> {
        let reading = self.read_native(flow_ref)?;
        Ok(FlowDocumentReading {
            version: OI_FLOW_DESKTOP_VERSION.into(),
            provider: self.provider_ref.to_string(),
            flow: reading.flow,
            content: reading.content,
            dirty_external_revision_reconciled: reading.dirty_external_revision_reconciled,
            automatic_agent_or_model_invocation: false,
        })
    }

    pub fn save_human(
        &self,
        flow_ref: &str,
        expected_revision: &str,
        content: &str,
        actor: &str,
    ) -> Result<FlowDocumentReading, String> {
        let data = self.run(
            "projectcentral.flow.write",
            json!({
                "flow_ref": flow_ref,
                "expected_revision": expected_revision,
                "content": content,
                "actor": actor,
                "actor_kind": "human"
            }),
        );
        match data {
            Ok(data) => {
                let flow: CentralFlowRecord = serde_json::from_value(
                    data.get("flow")
                        .cloned()
                        .ok_or_else(|| "Central Flow write omitted flow record".to_owned())?,
                )
                .map_err(|error| format!("decode Central written Flow: {error}"))?;
                Ok(FlowDocumentReading {
                    version: OI_FLOW_DESKTOP_VERSION.into(),
                    provider: self.provider_ref.to_string(),
                    flow,
                    content: content.to_owned(),
                    dirty_external_revision_reconciled: false,
                    automatic_agent_or_model_invocation: false,
                })
            }
            Err(error) => {
                let current = self.open(flow_ref)?;
                if current.flow.current_revision != expected_revision {
                    Err(format!(
                        "flow-revision-conflict: expected {expected_revision}; current {}; human buffer preserved by O:I; re-read/reconcile explicitly",
                        current.flow.current_revision
                    ))
                } else {
                    Err(error)
                }
            }
        }
    }

    pub fn history(&self, flow_ref: &str) -> Result<Value, String> {
        self.run("projectcentral.flow.history", json!({"flow_ref": flow_ref}))
    }

    pub fn bind_for_act(
        &self,
        context: &ContextResolution,
        flow_ref: &str,
        agent_session: ResourceRef,
        agent: Option<ResourceRef>,
        agency: Option<ResourceRef>,
    ) -> Result<FlowStandingContext, String> {
        let flow_ref = ResourceRef::parse(flow_ref).map_err(|error| error.to_string())?;
        bind_flow_for_act(self, context, &flow_ref, agent_session, agent, agency)
            .map_err(|error| error.to_string())
    }

    fn read_native(&self, flow_ref: &str) -> Result<CentralFlowReading, String> {
        let data = self.run("projectcentral.flow.read", json!({"flow_ref": flow_ref}))?;
        let reading: CentralFlowReading = serde_json::from_value(data)
            .map_err(|error| format!("decode Central Flow reading: {error}"))?;
        if reading.automatic_agent_or_model_invocation {
            return Err("Central Flow read violated zero-background-Agent law".into());
        }
        Ok(reading)
    }

    fn descriptor(record: &CentralFlowRecord) -> Result<FlowSourceDescriptor, String> {
        let lifecycle = match record.lifecycle.as_str() {
            "active" => FlowLifecycle::Active,
            "dormant" => FlowLifecycle::Dormant,
            "closed" => FlowLifecycle::Closed,
            other => return Err(format!("unsupported Central Flow lifecycle `{other}`")),
        };
        Ok(FlowSourceDescriptor {
            flow_ref: ResourceRef::parse(&record.flow_ref).map_err(|error| error.to_string())?,
            source_ref: SourceRef::parse(&record.source_ref).map_err(|error| error.to_string())?,
            revision: SourceRevision::parse(&record.current_revision)
                .map_err(|error| error.to_string())?,
            provider: ResourceRef::parse(CENTRAL_FLOW_PROVIDER_REF)
                .map_err(|error| error.to_string())?,
            lifecycle,
            title: record.title.clone(),
            scope: Some(ResourceRef::parse(&record.scope_ref).map_err(|error| error.to_string())?),
            container_hint: Some(record.path.clone()),
            capabilities: FlowCapabilities {
                read: true,
                write: true,
                history: true,
            },
            provenance: vec![
                "Central projectcentral.flow native owner Action".into(),
                record.privacy.clone(),
            ],
        })
    }
}

impl FlowProvider for CentralFlowClient {
    fn provider_ref(&self) -> &ResourceRef {
        &self.provider_ref
    }

    fn inspect(&self, flow: &ResourceRef) -> aikit_core::Result<FlowSourceDescriptor> {
        let reading = self
            .read_native(flow.as_str())
            .map_err(|error| aikit_core::AikitError::new("oi.flow.central_read", error))?;
        Self::descriptor(&reading.flow)
            .map_err(|error| aikit_core::AikitError::new("oi.flow.central_descriptor", error))
    }

    fn read_exact(
        &self,
        flow: &ResourceRef,
        revision: &SourceRevision,
    ) -> aikit_core::Result<FlowReadOutcome> {
        let reading = self
            .read_native(flow.as_str())
            .map_err(|error| aikit_core::AikitError::new("oi.flow.central_read", error))?;
        let descriptor = Self::descriptor(&reading.flow)
            .map_err(|error| aikit_core::AikitError::new("oi.flow.central_descriptor", error))?;
        if &descriptor.revision != revision {
            return Err(aikit_core::AikitError::new(
                "oi.flow.revision_drift",
                format!(
                    "Central Flow advanced from requested revision `{}` to `{}` before exact read",
                    revision, descriptor.revision
                ),
            ));
        }
        Ok(FlowReadOutcome::Disclosed {
            flow: descriptor,
            body: reading.content,
        })
    }

    fn write(&mut self, request: &FlowWriteRequest) -> aikit_core::Result<FlowWriteResult> {
        let data = self.run(
            "projectcentral.flow.write",
            json!({
                "flow_ref": request.flow_ref.as_str(),
                "expected_revision": request.expected_revision.as_str(),
                "content": request.replacement,
                "actor": request.actor.as_str(),
                "actor_kind": "agent",
                "agent_session_ref": request.agent_session.as_ref().map(ResourceRef::as_str)
            }),
        );
        match data {
            Ok(data) => {
                let flow: CentralFlowRecord = serde_json::from_value(
                    data.get("flow").cloned().ok_or_else(|| {
                        aikit_core::AikitError::new(
                            "oi.flow.central_write_shape",
                            "Central Flow write omitted flow record",
                        )
                    })?,
                )
                .map_err(|error| {
                    aikit_core::AikitError::new(
                        "oi.flow.central_write_shape",
                        format!("decode Central Flow write: {error}"),
                    )
                })?;
                Ok(FlowWriteResult::Applied {
                    current: Self::descriptor(&flow).map_err(|error| {
                        aikit_core::AikitError::new("oi.flow.central_descriptor", error)
                    })?,
                })
            }
            Err(owner_error) => {
                let current = self
                    .read_native(request.flow_ref.as_str())
                    .map_err(|error| aikit_core::AikitError::new("oi.flow.central_read", error))?;
                let current = Self::descriptor(&current.flow).map_err(|error| {
                    aikit_core::AikitError::new("oi.flow.central_descriptor", error)
                })?;
                if current.revision != request.expected_revision {
                    Ok(FlowWriteResult::Conflict { current })
                } else {
                    Err(aikit_core::AikitError::new(
                        "oi.flow.central_write",
                        owner_error,
                    ))
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_flow_source_contains_no_direct_file_mutation_path() {
        let source = include_str!("flow.rs");
        assert!(!source.contains("fs::write"));
        assert!(!source.contains("OpenOptions"));
        assert!(source.contains("projectcentral.flow.create"));
        assert!(source.contains("projectcentral.flow.write"));
        assert!(source.contains("bind_flow_for_act"));
    }

    #[cfg(unix)]
    #[test]
    fn blank_create_and_human_write_use_exact_central_owner_actions() {
        use std::fs;
        use std::os::unix::fs::PermissionsExt;
        use std::time::{SystemTime, UNIX_EPOCH};

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = env::temp_dir().join(format!("oi-flow-owner-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let executable = root.join("ctrl-fixture");
        let log = root.join("calls.log");
        let script = format!(r#"#!/bin/sh
printf '%s\n' "$4" >> '{log}'
case "$4" in
  projectcentral.flow.create)
    printf '%s\n' '{{"ok":true,"data":{{"flow":{{"flow_ref":"central:flow:project:test:one","source_ref":"central:source:project:test:ProjectCentral%2Fnow%2Fflows%2Fone.md","path":"ProjectCentral/now/flows/one.md","created_at_unix_seconds":1,"current_revision":"r1","lifecycle":"active","title":null,"scope_ref":"project:test","privacy":"inherits-source-authority","revisions":[]}},"automatic_agent_or_model_invocation":false}}}}'
    ;;
  projectcentral.flow.write)
    printf '%s\n' '{{"ok":true,"data":{{"flow":{{"flow_ref":"central:flow:project:test:one","source_ref":"central:source:project:test:ProjectCentral%2Fnow%2Fflows%2Fone.md","path":"ProjectCentral/now/flows/one.md","created_at_unix_seconds":1,"current_revision":"r2","lifecycle":"active","title":null,"scope_ref":"project:test","privacy":"inherits-source-authority","revisions":[]}},"automatic_agent_or_model_invocation":false}}}}'
    ;;
  *) exit 7 ;;
esac
"#, log=log.display());
        fs::write(&executable, script).unwrap();
        let mut permissions = fs::metadata(&executable).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&executable, permissions).unwrap();

        let client = CentralFlowClient::with(executable, None, "test".into()).unwrap();
        let created = client.create_blank("human:desktop").unwrap();
        assert_eq!(created.flow.current_revision, "r1");
        assert_eq!(created.content, "");
        let saved = client
            .save_human(
                &created.flow.flow_ref,
                &created.flow.current_revision,
                "human revision",
                "human:desktop",
            )
            .unwrap();
        assert_eq!(saved.flow.current_revision, "r2");
        assert_eq!(saved.content, "human revision");
        let calls = fs::read_to_string(log).unwrap();
        assert_eq!(
            calls.lines().collect::<Vec<_>>(),
            vec!["projectcentral.flow.create", "projectcentral.flow.write"]
        );
        fs::remove_dir_all(root).unwrap();
    }
}
