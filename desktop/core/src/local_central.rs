//! Narrow O:I binding to Central's canonical Action surface for the Personal return.
//!
//! Central owns NOW/DAY and durable human source authority. O:I invokes `ctrl`
//! through `action run`; it does not reproduce Central's filesystem semantics or
//! treat a returned Epi proposal as human-authored source.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::{Command, Stdio};

pub const CENTRAL_NOW_INSPECT_ACTION_REF: &str = "projectcentral.now.inspect";
pub const CENTRAL_NOW_RETURN_ACTION_REF: &str = "projectcentral.now.return";
pub const CENTRAL_NOW_UPDATE_ACTION_REF: &str = "projectcentral.now.update";
pub const CENTRAL_NOW_PROMOTE_ACTION_REF: &str = "projectcentral.now.promote";

pub struct LocalCentralHost {
    executable: PathBuf,
    root: Option<PathBuf>,
    project: String,
}

impl LocalCentralHost {
    pub fn open(executable: impl Into<PathBuf>, project: impl Into<String>) -> Self {
        Self {
            executable: executable.into(),
            root: None,
            project: project.into(),
        }
    }

    pub fn with_root(mut self, root: impl Into<PathBuf>) -> Self {
        self.root = Some(root.into());
        self
    }

    pub fn inspect_now(&self) -> Result<Value, String> {
        self.invoke(CENTRAL_NOW_INSPECT_ACTION_REF, json!({}))
    }

    /// Return an Epi Personal proposal into Central NOW without copying the
    /// protected selected text or proposal body into Central. Central receives
    /// refs, lineage, status and a non-sensitive description only.
    pub fn return_personal_proposal(&self, proposal: &Value) -> Result<Value, String> {
        expect_string(proposal, "/schema", "epi.personal-proposal/v1")?;
        expect_string(proposal, "/sourceClass", "proposal")?;
        expect_bool(proposal, "/sourceMutationPerformed", false)?;
        let proposal_ref = required_string(proposal, "/proposalRef")?;
        let selection_ref = required_string(proposal, "/subject/selectionRef")?;
        let episode_ref = required_string(proposal, "/subject/episodeRef")?;
        let coordinate_ref = required_string(proposal, "/subject/coordinateRef")?;
        let review_ref = optional_string(proposal, "/reviewRef");
        let ground_ref = optional_string(proposal, "/groundRef");

        let mut evidence_refs = Vec::new();
        if let Some(reference) = review_ref {
            evidence_refs.push(reference);
        }
        if let Some(reference) = ground_ref {
            evidence_refs.push(reference);
        }

        self.invoke(
            CENTRAL_NOW_RETURN_ACTION_REF,
            json!({
                "actor": "epi:agent:epii",
                "kind": "handoff",
                "subject": selection_ref,
                "result": format!("Personal return candidate {proposal_ref} awaits human review in the protected Epi/Nara world; no durable source mutation has occurred."),
                "status": "waiting",
                "focus_ref": selection_ref,
                "source_refs": [episode_ref, coordinate_ref],
                "evidence_refs": evidence_refs,
                "preserve_refs": [proposal_ref]
            }),
        )
    }

    pub fn reject_return(&self, handoff_id: &str, proposal_ref: &str) -> Result<Value, String> {
        if handoff_id.trim().is_empty() || proposal_ref.trim().is_empty() {
            return Err("Central rejection requires a handoff id and proposal ref".into());
        }
        self.invoke(
            CENTRAL_NOW_UPDATE_ACTION_REF,
            json!({
                "id": handoff_id,
                "status": "resolved",
                "preserve_refs": [proposal_ref]
            }),
        )
    }

    /// This is deliberately not a proposal-adoption helper. The source must
    /// already be a human-owned `ProjectCentral/now/user/**` source and Central
    /// independently enforces `acceptance=human-accepted` before durable copy.
    pub fn promote_human_source(&self, source: &str, destination: &str) -> Result<Value, String> {
        if source.trim().is_empty() || destination.trim().is_empty() {
            return Err("Central human recognition requires source and destination".into());
        }
        self.invoke(
            CENTRAL_NOW_PROMOTE_ACTION_REF,
            json!({
                "source": source,
                "target": "human-ground",
                "destination": destination,
                "acceptance": "human-accepted"
            }),
        )
    }

    fn invoke(&self, action_ref: &str, input: Value) -> Result<Value, String> {
        let mut input = input;
        let object = input
            .as_object_mut()
            .ok_or_else(|| "Central Action input must be an object".to_owned())?;
        object.insert("project".into(), Value::String(self.project.clone()));

        let mut command = Command::new(&self.executable);
        command.arg("--json");
        if let Some(root) = self.root.as_ref() {
            command.arg("--root").arg(root);
        }
        command
            .arg("action")
            .arg("run")
            .arg(action_ref)
            .arg(
                serde_json::to_string(&input)
                    .map_err(|error| format!("serialize Central Action input: {error}"))?,
            )
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let output = command.spawn()
            .map_err(|error| format!("start Central ctrl `{}`: {error}", self.executable.display()))?
            .wait_with_output()
            .map_err(|error| format!("wait for Central ctrl: {error}"))?;
        let envelope: Value = serde_json::from_slice(&output.stdout).map_err(|error| {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            format!("parse Central ActionResult JSON: {error}{}", if stderr.is_empty() { String::new() } else { format!("; {stderr}") })
        })?;
        if !envelope.pointer("/ok").and_then(Value::as_bool).unwrap_or(false) {
            let status = envelope.pointer("/status").and_then(Value::as_str).unwrap_or("unknown");
            let message = envelope
                .pointer("/error/message")
                .and_then(Value::as_str)
                .unwrap_or("Central Action failed");
            return Err(format!("Central `{action_ref}` {status}: {message}"));
        }
        if !output.status.success() {
            return Err(format!("Central `{action_ref}` exited {} despite an ok ActionResult", output.status));
        }
        envelope
            .get("data")
            .cloned()
            .ok_or_else(|| format!("Central `{action_ref}` success requires data"))
    }
}

fn required_string(value: &Value, pointer: &str) -> Result<String, String> {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| format!("Personal proposal requires string `{pointer}`"))
}

fn optional_string(value: &Value, pointer: &str) -> Option<String> {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn expect_string(value: &Value, pointer: &str, expected: &str) -> Result<(), String> {
    let observed = required_string(value, pointer)?;
    if observed != expected {
        return Err(format!("Personal proposal `{pointer}` was `{observed}`, expected `{expected}`"));
    }
    Ok(())
}

fn expect_bool(value: &Value, pointer: &str, expected: bool) -> Result<(), String> {
    let observed = value
        .pointer(pointer)
        .and_then(Value::as_bool)
        .ok_or_else(|| format!("Personal proposal requires bool `{pointer}`"))?;
    if observed != expected {
        return Err(format!("Personal proposal `{pointer}` was `{observed}`, expected `{expected}`"));
    }
    Ok(())
}
