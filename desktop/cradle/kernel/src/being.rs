//! SF3 projected-Agent invocation adapter. Configuration names an existing
//! controller locus; Actuation's gateway remains the authority and durable
//! Activity/Return owner. This module keeps no session or chat state.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{path::PathBuf, process::Command};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "operation", rename_all = "snake_case")]
pub enum Request {
    Standing {
        agent_ref: String,
        target_agency_ref: String,
    },
    Invoke {
        agent_ref: String,
        target_agency_ref: String,
        subject_ref: String,
        #[serde(default)]
        source_refs: Vec<String>,
        expression_ref: String,
        expression_revision: u64,
        composition: Value,
        instruction: String,
        invocation_ref: String,
        return_ref: String,
    },
}
#[derive(Clone, Debug, Deserialize)]
struct Controller {
    socket: String,
    subject: String,
    stream: String,
    actuation: String,
    agency: String,
    session: String,
    agent_ref: String,
    #[serde(default = "mode")]
    mode: String,
}
fn mode() -> String {
    "delegation".into()
}

fn controller() -> Result<Controller, String> {
    let raw=std::env::var("OI_SHARED_AGENT_CONTROLLER").map_err(|_|"No local Actuation Gateway controller binding is configured (OI_SHARED_AGENT_CONTROLLER).".to_string())?;
    serde_json::from_str(&raw)
        .map_err(|error| format!("Unreadable OI_SHARED_AGENT_CONTROLLER: {error}"))
}
fn executable() -> PathBuf {
    std::env::var_os("OI_ACTUATION_GATEWAY_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| "actuation-gateway".into())
}
fn clean(value: &str, name: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{name} must be non-empty"))
    } else {
        Ok(())
    }
}

pub fn apply(request: Request) -> Value {
    let (
        agent_ref,
        target_agency_ref,
        subject_ref,
        source_refs,
        expression_ref,
        expression_revision,
        composition,
        instruction,
        invocation_ref,
        return_ref,
    ) = match request {
        Request::Standing {
            agent_ref,
            target_agency_ref,
        } => {
            if clean(&agent_ref, "agent_ref").is_err()
                || clean(&target_agency_ref, "target_agency_ref").is_err()
            {
                return json!({"state":"refused","detail":"Projected Agent identity and agency are required."});
            }
            let controller = match controller() {
                Ok(value) => value,
                Err(detail) => return json!({"state":"unavailable","detail":detail}),
            };
            return json!({"state":"available","owner_operation":"actuation-gateway invoke","controller":{"agent_ref":controller.agent_ref,"agency_ref":controller.agency,"agent_session_ref":controller.session},"target":{"agent_ref":agent_ref,"agency_ref":target_agency_ref},"mode":controller.mode});
        }
        Request::Invoke {
            agent_ref,
            target_agency_ref,
            subject_ref,
            source_refs,
            expression_ref,
            expression_revision,
            composition,
            instruction,
            invocation_ref,
            return_ref,
        } => (
            agent_ref,
            target_agency_ref,
            subject_ref,
            source_refs,
            expression_ref,
            expression_revision,
            composition,
            instruction,
            invocation_ref,
            return_ref,
        ),
    };
    if clean(&agent_ref, "agent_ref").is_err()
        || clean(&target_agency_ref, "target_agency_ref").is_err()
    {
        return json!({"state":"refused","detail":"Projected Agent identity and agency are required."});
    }
    let controller = match controller() {
        Ok(value) => value,
        Err(detail) => return json!({"state":"unavailable","detail":detail}),
    };
    if instruction.trim().is_empty() {
        return json!({"state":"refused","detail":"Invocation instruction is empty."});
    }
    // The payload is the complete disclosure: exact projected subject, exact
    // Expression revision and explicitly listed source refs. No local/private
    // Expression read or personal Agent context is consulted here.
    if composition.get("expression_ref").and_then(Value::as_str) != Some(expression_ref.as_str())
        || composition.get("revision").and_then(Value::as_u64) != Some(expression_revision)
    {
        return json!({"state":"refused","detail":"The disclosed Expression composition does not match its projected ref and revision."});
    }
    let payload=json!({"schema":"oi.shared-field.agent-invocation/v1","target":{"agent_ref":agent_ref,"agency_ref":target_agency_ref},"subject_ref":subject_ref,"expression":{"ref":expression_ref,"revision":expression_revision,"composition":composition},"source_refs":source_refs,"instruction":instruction}).to_string();
    let output = Command::new(executable())
        .args([
            "invoke",
            "--socket",
            &controller.socket,
            "--subject",
            &controller.subject,
            "--stream",
            &controller.stream,
            "--actuation",
            &controller.actuation,
            "--agency",
            &controller.agency,
            "--session",
            &controller.session,
            "--agent-ref",
            &controller.agent_ref,
            "--target-agency",
            &target_agency_ref,
            "--mode",
            &controller.mode,
            "--payload",
            &payload,
            "--invocation-ref",
            &invocation_ref,
            "--return-ref",
            &return_ref,
        ])
        .output();
    let output = match output {
        Ok(value) => value,
        Err(error) => {
            return json!({"state":"unavailable","owner_operation":"actuation-gateway invoke","detail":error.to_string()})
        }
    };
    let rows = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .collect::<Vec<_>>();
    let receipt = rows.last().cloned().unwrap_or(Value::Null);
    if output.status.success() {
        let returned_agent = receipt
            .pointer("/reply/return_event/actor/agent_ref")
            .and_then(Value::as_str);
        let returned_agency = receipt
            .pointer("/reply/return_event/actor/agency_ref")
            .and_then(Value::as_str);
        if returned_agent != Some(agent_ref.as_str())
            || returned_agency != Some(target_agency_ref.as_str())
        {
            json!({"state":"identity_mismatch","owner_operation":"actuation-gateway invoke","detail":"The native Return did not match the projected Agent and Agency.","expected":{"agent_ref":agent_ref,"agency_ref":target_agency_ref},"observed":{"agent_ref":returned_agent,"agency_ref":returned_agency},"receipt":receipt})
        } else {
            json!({"state":"invoked","owner_operation":"actuation-gateway invoke","invocation_ref":invocation_ref,"return_ref":return_ref,"receipt":receipt})
        }
    } else if output.status.code() == Some(3) {
        json!({"state":"refused","owner_operation":"actuation-gateway invoke","invocation_ref":invocation_ref,"receipt":receipt})
    } else {
        json!({"state":"unavailable","owner_operation":"actuation-gateway invoke","detail":String::from_utf8_lossy(&output.stderr).trim(),"receipt":receipt})
    }
}
