//! Routine requests are a closed set of native AIKit verbs. Proofs, grants,
//! scheduler reconciliation and execution remain with their native owners.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    List,
    Methods,
    History,
    Show { routine_ref: String },
    Disable { routine_ref: String },
    RunNow { routine_ref: String },
    Create {
        name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        description: Option<String>,
        method: String,
        proof_json: String,
        trigger_json: String,
        authority_json: String,
    },
    Enable { routine_ref: String, authority_json: String },
    Reprove { routine_ref: String, proof_json: String },
}

/// Payload ceiling for the owner-supplied JSON documents the create/enable/
/// reprove verbs carry (proof basis, trigger, authority). AIKit remains the
/// authority over their contents; the kernel only refuses what it cannot
/// honestly forward.
const PAYLOAD_MAX: usize = 65_536;

impl Request {
    pub fn mutation(&self) -> Option<(&'static str, &str)> {
        match self {
            Self::Disable { routine_ref } => Some(("disable", routine_ref)),
            Self::RunNow { routine_ref } => Some(("run-now", routine_ref)),
            // The create receipt names the stored ref (`routine/<slug>`), so
            // the logged operand is the requested name; validation below does
            // not demand an exact ref match for it.
            Self::Create { name, .. } => Some(("create", name)),
            Self::Enable { routine_ref, .. } => Some(("enable", routine_ref)),
            Self::Reprove { routine_ref, .. } => Some(("reprove", routine_ref)),
            _ => None,
        }
    }

    fn reference(reference: &str) -> Result<(), String> {
        if reference.trim().is_empty()
            || reference.len() > 4096
            || reference.chars().any(char::is_control)
        {
            return Err("A native Routine reference is required".into());
        }
        Ok(())
    }

    fn payload(field: &str, value: &str) -> Result<(), String> {
        if value.trim().is_empty() {
            return Err(format!("A {field} is required"));
        }
        if value.len() > PAYLOAD_MAX {
            return Err(format!("The {field} exceeds what the kernel will forward"));
        }
        Ok(())
    }

    fn args(&self) -> Result<Vec<&str>, String> {
        match self {
            Self::List => Ok(vec!["routine", "list"]),
            Self::Methods => Ok(vec!["method", "list"]),
            Self::History => Ok(vec!["routine", "invocations", "--with-outcomes"]),
            Self::Show { routine_ref }
            | Self::Disable { routine_ref }
            | Self::RunNow { routine_ref } => {
                Self::reference(routine_ref)?;
                let action = match self {
                    Self::Show { .. } => "show",
                    Self::Disable { .. } => "disable",
                    _ => "run-now",
                };
                Ok(vec!["routine", action, "--", routine_ref])
            }
            Self::Create {
                name,
                description,
                method,
                proof_json,
                trigger_json,
                authority_json,
            } => {
                Self::reference(name)?;
                Self::reference(method)?;
                Self::payload("proven basis", proof_json)?;
                Self::payload("trigger", trigger_json)?;
                Self::payload("authority", authority_json)?;
                let mut args = vec![
                    "routine",
                    "create",
                    "--name",
                    name.as_str(),
                    "--method",
                    method.as_str(),
                    "--proof-json",
                    proof_json.as_str(),
                    "--trigger-json",
                    trigger_json.as_str(),
                    "--authority-json",
                    authority_json.as_str(),
                ];
                if let Some(description) = description.as_deref().filter(|d| !d.trim().is_empty()) {
                    args.push("--description");
                    args.push(description);
                }
                Ok(args)
            }
            Self::Enable { routine_ref, authority_json } => {
                Self::reference(routine_ref)?;
                Self::payload("authority", authority_json)?;
                Ok(vec![
                    "routine",
                    "enable",
                    "--authority-json",
                    authority_json.as_str(),
                    "--",
                    routine_ref.as_str(),
                ])
            }
            Self::Reprove { routine_ref, proof_json } => {
                Self::reference(routine_ref)?;
                Self::payload("proven basis", proof_json)?;
                Ok(vec![
                    "routine",
                    "reprove",
                    "--proof-json",
                    proof_json.as_str(),
                    "--",
                    routine_ref.as_str(),
                ])
            }
        }
    }
}

pub fn call(cwd: &Path, request: &Request) -> Result<Value, String> {
    let data = crate::knowledge::run(cwd, &request.args()?).map_err(|error| match error {
        crate::knowledge::CallError::Unavailable { detail } => {
            format!("AIKit is unavailable: {detail}")
        }
        crate::knowledge::CallError::Refused { message } => message,
        crate::knowledge::CallError::Malformed { detail } => detail,
    })?;
    if let Some((action, subject)) = request.mutation() {
        validate_return(action, subject, &data)?;
    }
    Ok(data)
}

pub fn validate_return(action: &str, subject: &str, data: &Value) -> Result<(), String> {
    // The create receipt names the stored ref, which is derived from the
    // requested name by AIKit — demand the shape, not the operand.
    let named = match action {
        "create" => data["routine"]
            .as_str()
            .is_some_and(|value| value.starts_with("routine/") && value.len() > "routine/".len()),
        _ => data["routine"].as_str() == Some(subject),
    };
    if !named {
        return Err("AIKit's Routine response names a different Routine".into());
    }
    match action {
        "disable" if data["state"] == "disabled" => Ok(()),
        "run-now"
            if data["invocation_ref"]
                .as_str()
                .is_some_and(|value| !value.is_empty())
                && data["admission"] == "applied" =>
        {
            Ok(())
        }
        "create" if data["state"] == "draft" => Ok(()),
        "enable" if data["state"] == "enabled" => Ok(()),
        "reprove" if data["state"] == "disabled" && data["method_revision"].is_string() => Ok(()),
        _ => Err("AIKit did not return the requested Routine action receipt".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reference_is_one_literal_native_operand() {
        assert_eq!(
            Request::Show {
                routine_ref: "routine/my routine".into()
            }
            .args()
            .unwrap(),
            ["routine", "show", "--", "routine/my routine"]
        );
        assert!(Request::RunNow {
            routine_ref: "\n".into()
        }
        .args()
        .is_err());
    }
    #[test]
    fn a_failed_run_is_still_an_actual_return_but_never_a_completion_claim() {
        let receipt = serde_json::json!({"routine":"routine/a", "invocation_ref":"invocation/a", "admission":"applied", "outcome":{"status":"failed"}});
        assert!(validate_return("run-now", "routine/a", &receipt).is_ok());
        assert!(validate_return("run-now", "routine/b", &receipt).is_err());
        assert!(validate_return("disable", "routine/a", &receipt).is_err());
    }
    #[test]
    fn create_carries_the_owner_documents_and_a_optional_description() {
        let request = Request::Create {
            name: "daily demo".into(),
            description: Some("does the daily thing".into()),
            method: "skill/aikit/demo".into(),
            proof_json: r#"{"proof_ref":"proof/a"}"#.into(),
            trigger_json: r#"{"kind":"manual"}"#.into(),
            authority_json: r#"{"authority_ref":"authority/a","action_refs":["act/a"],"granted":true,"unattended":false}"#.into(),
        };
        assert_eq!(
            request.args().unwrap(),
            [
                "routine",
                "create",
                "--name",
                "daily demo",
                "--method",
                "skill/aikit/demo",
                "--proof-json",
                r#"{"proof_ref":"proof/a"}"#,
                "--trigger-json",
                r#"{"kind":"manual"}"#,
                "--authority-json",
                r#"{"authority_ref":"authority/a","action_refs":["act/a"],"granted":true,"unattended":false}"#,
                "--description",
                "does the daily thing",
            ]
        );
        assert_eq!(request.mutation(), Some(("create", "daily demo")));
    }
    #[test]
    fn create_refuses_unforwardable_operands() {
        let base = |name: &str, proof: &str| Request::Create {
            name: name.into(),
            description: None,
            method: "skill/aikit/demo".into(),
            proof_json: proof.into(),
            trigger_json: r#"{"kind":"manual"}"#.into(),
            authority_json: r#"{"authority_ref":"authority/a","action_refs":["act/a"],"granted":true,"unattended":false}"#.into(),
        };
        assert!(base("", r#"{"a":1}"#).args().is_err());
        assert!(base("x", "  \n").args().is_err());
        let oversized = Request::Create {
            name: "big".into(),
            description: None,
            method: "skill/aikit/demo".into(),
            proof_json: " ".repeat(PAYLOAD_MAX + 1),
            trigger_json: r#"{"kind":"manual"}"#.into(),
            authority_json: r#"{"authority_ref":"authority/a","action_refs":["act/a"],"granted":true,"unattended":false}"#.into(),
        };
        assert!(oversized.args().is_err());
    }
    #[test]
    fn enable_and_reprove_pass_documents_before_the_reference() {
        let enable = Request::Enable {
            routine_ref: "routine/demo".into(),
            authority_json: r#"{"authority_ref":"authority/b","action_refs":["act/b"],"granted":true,"unattended":true}"#.into(),
        };
        assert_eq!(
            enable.args().unwrap(),
            [
                "routine",
                "enable",
                "--authority-json",
                r#"{"authority_ref":"authority/b","action_refs":["act/b"],"granted":true,"unattended":true}"#,
                "--",
                "routine/demo",
            ]
        );
        assert_eq!(enable.mutation(), Some(("enable", "routine/demo")));
        let reprove = Request::Reprove {
            routine_ref: "routine/demo".into(),
            proof_json: r#"{"proof_ref":"proof/c"}"#.into(),
        };
        assert_eq!(
            reprove.args().unwrap(),
            ["routine", "reprove", "--proof-json", r#"{"proof_ref":"proof/c"}"#, "--", "routine/demo"]
        );
    }
    #[test]
    fn lifecycle_receipts_are_validated_against_their_own_action() {
        let create = serde_json::json!({"routine":"routine/daily-demo","state":"draft","note":"created in Draft"});
        assert!(validate_return("create", "daily demo", &create).is_ok());
        assert!(validate_return("create", "daily demo", &serde_json::json!({"routine":"daily-demo","state":"draft"})).is_err());
        assert!(validate_return("create", "daily demo", &serde_json::json!({"routine":"routine/x","state":"enabled"})).is_err());
        let enable = serde_json::json!({"routine":"routine/demo","state":"enabled","note":"enabled"});
        assert!(validate_return("enable", "routine/demo", &enable).is_ok());
        assert!(validate_return("enable", "routine/demo", &serde_json::json!({"routine":"routine/demo","state":"disabled"})).is_err());
        let reprove = serde_json::json!({"routine":"routine/demo","state":"disabled","method_revision":"rev/2","note":"reproven"});
        assert!(validate_return("reprove", "routine/demo", &reprove).is_ok());
        assert!(validate_return("reprove", "routine/demo", &serde_json::json!({"routine":"routine/demo","state":"disabled"})).is_err());
    }
}
