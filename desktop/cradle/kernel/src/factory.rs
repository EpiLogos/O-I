//! Factory native bindings and exact local-grant actions through S.
//! Confirmation stays in Actuation; this consumer never manufactures a grant.
use crate::material::{invoke, Error};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::BTreeMap, path::{Path, PathBuf}};
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Binding {
    pub contract: String,
    pub binding_ref: String,
    pub project_ref: String,
    pub run_ref: String,
    pub availability: String,
    pub error: Option<String>,
    #[serde(flatten)]
    pub native_fields: BTreeMap<String, Value>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub contract: String,
    pub provider_contract: String,
    pub revision: u64,
    pub view: Value,
    #[serde(flatten)]
    pub native_fields: BTreeMap<String, Value>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Intent {
    pub action_ref: String,
    pub subject_ref: String,
    pub caller_ref: String,
    pub expected_revision: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Invocation {
    pub action_ref: String,
    pub subject_ref: String,
    pub caller_ref: String,
    pub expected_revision: u64,
    pub grant_ref: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct AuthorityRequest {
    pub contract: String,
    #[serde(rename = "ref")]
    pub ref_id: String,
    pub operation: Value,
    pub digest: String,
    #[serde(flatten)]
    pub native_fields: BTreeMap<String, Value>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ActionOutcome {
    pub contract: String,
    pub ok: bool,
    pub authority_consumption: Option<Value>,
    pub authority_outcome: Option<String>,
    pub mutation_outcome: Option<String>,
    pub native_result: Option<Value>,
    pub error: Option<String>,
    pub retry: Option<String>,
    #[serde(flatten)]
    pub native_fields: BTreeMap<String, Value>,
}
#[derive(Clone, Debug)]
pub struct Client {
    executable: PathBuf,
}
fn incompatible(message: impl ToString) -> Error {
    Error {
        kind: "incompatible".into(),
        message: message.to_string(),
        operation_may_have_run: true,
    }
}
impl Client {
    pub fn discover() -> Self {
        Self::with(
            std::env::var_os("OI_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| "oi".into()),
        )
    }
    pub fn with(executable: PathBuf) -> Self {
        Self { executable }
    }
    pub fn bindings(&self, project: Option<&str>) -> Result<Vec<Binding>, Error> {
        let mut args = vec![
            "factory".into(),
            "build".into(),
            "discover".into(),
            "--json".into(),
        ];
        if let Some(project) = project {
            args.extend(["--project".into(), project.into()]);
        }
        let rows: Vec<Binding> =
            serde_json::from_value(invoke(&self.executable, &args, None)?).map_err(incompatible)?;
        if rows.iter().any(|b| {
            b.contract != "factory.build-binding/v1"
                || !b.binding_ref.starts_with("factory-build-binding:")
                || project.is_some_and(|p| p != b.project_ref)
        }) {
            return Err(incompatible(
                "Factory returned incompatible/redirected binding",
            ));
        }
        Ok(rows)
    }
    /// One developmental read through the owner's own `factory development`
    /// family (queue cell 3). The state path is the caller's disclosure —
    /// the desktop never invents a Factory state — and the payload is
    /// carried verbatim after the read's contract schema is verified.
    /// `read`/`ref` are the owner's own CLI grammar, never re-keyed.
    pub fn development_read(
        &self,
        state_path: &Path,
        read: &str,
        subject: Option<&str>,
    ) -> Result<Value, Error> {
        if !matches!(
            read,
            "project" | "journey" | "run" | "workflow-units" | "workflow-unit" | "execution-telemetry" | "commission-read"
        ) {
            return Err(incompatible("Unsupported Factory development read"));
        }
        let mut args: Vec<std::ffi::OsString> = vec![
            "factory".into(),
            "development".into(),
            read.to_string().into(),
            state_path.as_os_str().to_string_lossy().into_owned().into(),
        ];
        if let Some(subject) = subject {
            args.push(subject.to_string().into());
        }
        args.push("--json".into());
        let data = invoke(&self.executable, &args, None)?;
        let schema = data
            .get("contract")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();
        if !schema.starts_with("factory.") || !schema.ends_with("-reading/v1") {
            return Err(incompatible("Unsupported Factory development reading"));
        }
        Ok(data)
    }
    pub fn snapshot(&self, binding: &str) -> Result<Snapshot, Error> {
        let args = [
            "factory",
            "build",
            "snapshot",
            "--binding",
            binding,
            "--json",
        ]
        .map(Into::into);
        let result: Snapshot =
            serde_json::from_value(invoke(&self.executable, &args, None)?).map_err(incompatible)?;
        if result.contract != "factory.build-view/v1"
            || result.provider_contract != "factory.build-view-provider/v1"
        {
            return Err(incompatible("Unsupported Factory snapshot"));
        }
        Ok(result)
    }
    pub fn intent(&self, binding: &str, request: &Intent) -> Result<AuthorityRequest, Error> {
        let result: AuthorityRequest =
            serde_json::from_value(self.action("intent", binding, request)?)
                .map_err(incompatible)?;
        if result.contract != "actuation.local-authority/v1"
            || !result.ref_id.starts_with("actuation:request:")
            || result.operation["provider_binding_ref"] != binding
            || result.operation["action_ref"] != request.action_ref
            || result.operation["subject_ref"] != request.subject_ref
            || result.operation["caller_ref"] != request.caller_ref
            || result.operation["expected_revision"] != request.expected_revision
        {
            return Err(incompatible("Authority request differs from exact intent"));
        }
        Ok(result)
    }
    pub fn invoke(&self, binding: &str, request: &Invocation) -> Result<ActionOutcome, Error> {
        let result: ActionOutcome =
            serde_json::from_value(self.action("invoke", binding, request)?)
                .map_err(incompatible)?;
        if result.contract != "factory.granted-action/v1" {
            return Err(incompatible(
                "Unsupported Factory action outcome; do not replay",
            ));
        }
        Ok(result)
    }
    fn action(&self, verb: &str, binding: &str, request: &impl Serialize) -> Result<Value, Error> {
        let args = [
            "factory",
            "action",
            verb,
            "--binding",
            binding,
            "-",
            "--json",
        ]
        .map(Into::into);
        invoke(
            &self.executable,
            &args,
            Some(serde_json::to_vec(request).map_err(incompatible)?),
        )
    }
}

/// The owner CLI's own argument grammar for one development read — built
/// here so the dispatch arm stays declarative. Never re-keyed.
pub fn development_read_args(
    state_path: &Path,
    read: &str,
    subject: Option<&str>,
    suite_route: bool,
) -> Vec<std::ffi::OsString> {
    let mut args: Vec<std::ffi::OsString> = Vec::new();
    if suite_route {
        // Through the suite executable the product namespace names the route.
        args.push("factory".into());
    }
    args.extend([
        "development".into(),
        read.to_string().into(),
        state_path.as_os_str().to_string_lossy().into_owned().into(),
    ]);
    if let Some(subject) = subject {
        args.push(subject.to_string().into());
    }
    args.push("--json".into());
    args
}
