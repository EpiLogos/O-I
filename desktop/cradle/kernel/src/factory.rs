//! Factory's own developmental reads and the re-pinned build view, through
//! the owner's CLI. The desktop never manufactures a grant or a Factory
//! state; payloads are carried verbatim after their contract schemas are
//! verified.
use crate::material::{invoke, Error};
use serde_json::Value;
use std::path::{Path, PathBuf};
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
            "central-project-link-read" | "project" | "journey" | "run" | "build" | "workflow-units" | "workflow-unit" | "execution-telemetry" | "commission-read"
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
        if read == "build" {
            // The owner CLI serialises this field camelCase (`providerContract`);
            // both spellings are accepted so the check never outruns the owner.
            let provider_contract = data.get("providerContract").or_else(|| data.get("provider_contract")).and_then(Value::as_str);
            if schema != "factory.build-view/v1" || provider_contract != Some("factory.build-view-provider/v1") {
                return Err(incompatible("Unsupported Factory developmental Build view"));
            }
        } else if !schema.starts_with("factory.") || !schema.ends_with("-reading/v1") {
            return Err(incompatible("Unsupported Factory development reading"));
        }
        Ok(data)
    }
    /// The re-pinned build view (queue cell B): the installed CLI reads it as
    /// `factory build snapshot <state> <project-ref> <run-ref> --json` — the
    /// old `--binding` grammar and `build discover` are gone from the owner.
    /// Refs and state path are the caller's disclosure, passed verbatim; the
    /// payload is carried only after its contract schemas are verified.
    pub fn build_snapshot(
        &self,
        state_path: &Path,
        project_ref: &str,
        run_ref: &str,
    ) -> Result<Value, Error> {
        let args = [
            "factory".into(),
            "build".into(),
            "snapshot".into(),
            state_path.as_os_str().to_string_lossy().into_owned().into(),
            project_ref.into(),
            run_ref.into(),
            "--json".into(),
        ];
        let data = invoke(&self.executable, &args, None)?;
        // The owner CLI serialises this field camelCase (`providerContract`);
        // both spellings are accepted so the check never outruns the owner.
        let provider_contract = data
            .get("providerContract")
            .or_else(|| data.get("provider_contract"))
            .and_then(Value::as_str);
        if data.get("contract").and_then(Value::as_str) != Some("factory.build-view/v1")
            || provider_contract != Some("factory.build-view-provider/v1")
        {
            return Err(incompatible("Unsupported Factory build view"));
        }
        Ok(data)
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
