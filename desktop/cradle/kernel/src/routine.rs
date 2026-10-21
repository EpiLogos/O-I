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
    Show {
        routine_ref: String,
    },
    Disable {
        routine_ref: String,
    },
    RunNow {
        routine_ref: String,
    },
    /// `aikit routine create --name N --method M --proof-json P
    /// --trigger-json T --authority-json A [--description D]
    /// [--agent-profile R] [--context-scope S]…`: AIKit stores it in Draft;
    /// nothing fires until it is enabled. The documents are AIKit's own
    /// (ProvenMethodBasis, trigger, RoutineAuthority), carried as handed.
    Create {
        name: String,
        method: String,
        proof: Value,
        trigger: Value,
        authority: Value,
        #[serde(default)]
        description: Option<String>,
        #[serde(default)]
        agent_profile: Option<String>,
        #[serde(default)]
        context_scopes: Vec<String>,
    },
    /// `aikit routine enable --authority-json A REF`: arms the Routine with a
    /// fresh authority receipt; AIKit requires unattended authority for a
    /// schedule or event trigger.
    Enable {
        routine_ref: String,
        authority: Value,
    },
    /// `aikit routine reprove --proof-json P REF`: a new proof after a
    /// Method change; the Routine returns to Disabled.
    Reprove {
        routine_ref: String,
        proof: Value,
    },
}

fn reference(value: &str, what: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
        Err(format!("A native Routine {what} is required"))
    } else {
        Ok(())
    }
}

fn document(value: &Value, what: &str) -> Result<String, String> {
    if !value.is_object() {
        return Err(format!("AIKit's Routine {what} is one JSON object"));
    }
    serde_json::to_string(value).map_err(|error| error.to_string())
}

impl Request {
    /// The action a write names (it emits RoutineActionReturned with the
    /// Routine AIKit answers for); reads name none.
    pub fn mutation(&self) -> Option<&'static str> {
        match self {
            Self::Disable { .. } => Some("disable"),
            Self::RunNow { .. } => Some("run-now"),
            Self::Create { .. } => Some("create"),
            Self::Enable { .. } => Some("enable"),
            Self::Reprove { .. } => Some("reprove"),
            Self::List | Self::Methods | Self::History | Self::Show { .. } => None,
        }
    }

    /// The Routine the request names, where it names one before AIKit answers.
    pub fn routine_ref(&self) -> Option<&str> {
        match self {
            Self::Show { routine_ref }
            | Self::Disable { routine_ref }
            | Self::RunNow { routine_ref }
            | Self::Enable { routine_ref, .. }
            | Self::Reprove { routine_ref, .. } => Some(routine_ref),
            Self::List | Self::Methods | Self::History | Self::Create { .. } => None,
        }
    }

    fn args(&self) -> Result<Vec<String>, String> {
        let words = |items: &[&str]| {
            items
                .iter()
                .map(|item| item.to_string())
                .collect::<Vec<_>>()
        };
        match self {
            Self::List => Ok(words(&["routine", "list"])),
            Self::Methods => Ok(words(&["method", "list"])),
            Self::History => Ok(words(&["routine", "invocations", "--with-outcomes"])),
            Self::Show { routine_ref }
            | Self::Disable { routine_ref }
            | Self::RunNow { routine_ref } => {
                reference(routine_ref, "reference")?;
                let action = match self {
                    Self::Show { .. } => "show",
                    Self::Disable { .. } => "disable",
                    _ => "run-now",
                };
                Ok(words(&["routine", action, "--", routine_ref]))
            }
            Self::Create {
                name,
                method,
                proof,
                trigger,
                authority,
                description,
                agent_profile,
                context_scopes,
            } => {
                reference(name, "name")?;
                reference(method, "Method")?;
                let mut args = words(&["routine", "create", "--name", name, "--method", method]);
                args.extend(["--proof-json".into(), document(proof, "proof")?]);
                args.extend(["--trigger-json".into(), document(trigger, "trigger")?]);
                args.extend(["--authority-json".into(), document(authority, "authority")?]);
                if let Some(description) = description {
                    args.extend(["--description".into(), description.clone()]);
                }
                if let Some(profile) = agent_profile {
                    reference(profile, "agent profile")?;
                    args.extend(["--agent-profile".into(), profile.clone()]);
                }
                for scope in context_scopes {
                    reference(scope, "context scope")?;
                    args.extend(["--context-scope".into(), scope.clone()]);
                }
                Ok(args)
            }
            Self::Enable {
                routine_ref,
                authority,
            } => {
                reference(routine_ref, "reference")?;
                let mut args = words(&["routine", "enable", "--authority-json"]);
                args.push(document(authority, "authority")?);
                args.extend(["--".into(), routine_ref.clone()]);
                Ok(args)
            }
            Self::Reprove { routine_ref, proof } => {
                reference(routine_ref, "reference")?;
                let mut args = words(&["routine", "reprove", "--proof-json"]);
                args.push(document(proof, "proof")?);
                args.extend(["--".into(), routine_ref.clone()]);
                Ok(args)
            }
        }
    }
}

pub fn call(cwd: &Path, request: &Request) -> Result<Value, String> {
    let args = request.args()?;
    let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
    let data = crate::knowledge::run(cwd, &borrowed).map_err(|error| match error {
        crate::knowledge::CallError::Unavailable { detail } => {
            format!("AIKit is unavailable: {detail}")
        }
        crate::knowledge::CallError::Refused { message } => message,
        crate::knowledge::CallError::Malformed { detail } => detail,
    })?;
    if let Some(action) = request.mutation() {
        let routine_ref = match request.routine_ref() {
            Some(routine_ref) => routine_ref,
            None => data["routine"]
                .as_str()
                .ok_or("AIKit's Routine response names no Routine")?,
        };
        validate_return(action, routine_ref, &data)?;
    }
    Ok(data)
}

pub fn validate_return(action: &str, routine_ref: &str, data: &Value) -> Result<(), String> {
    if data["routine"].as_str() != Some(routine_ref) {
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
        // A new Routine sits in Draft; a reproven one returns to Disabled.
        "create" if data["state"] == "draft" => Ok(()),
        "enable" if data["state"] == "enabled" => Ok(()),
        "reprove" if data["state"] == "disabled" => Ok(()),
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
    fn authoring_receipts_name_the_state_each_verb_leaves() {
        let at = |state: &str| serde_json::json!({"routine": "routine/a", "state": state});
        assert!(validate_return("create", "routine/a", &at("draft")).is_ok());
        assert!(validate_return("create", "routine/a", &at("enabled")).is_err());
        assert!(validate_return("enable", "routine/a", &at("enabled")).is_ok());
        assert!(validate_return("enable", "routine/a", &at("draft")).is_err());
        assert!(validate_return("reprove", "routine/a", &at("disabled")).is_ok());
        assert!(validate_return("reprove", "routine/b", &at("disabled")).is_err());
        let create = Request::Create {
            name: "nightly".into(),
            method: "method/n".into(),
            proof: serde_json::json!({}),
            trigger: serde_json::json!("manual"),
            authority: serde_json::json!({}),
            description: None,
            agent_profile: None,
            context_scopes: vec![],
        };
        assert!(create.args().is_err(), "a trigger is one JSON object");
    }
    #[test]
    fn a_failed_run_is_still_an_actual_return_but_never_a_completion_claim() {
        let receipt = serde_json::json!({"routine":"routine/a", "invocation_ref":"invocation/a", "admission":"applied", "outcome":{"status":"failed"}});
        assert!(validate_return("run-now", "routine/a", &receipt).is_ok());
        assert!(validate_return("run-now", "routine/b", &receipt).is_err());
        assert!(validate_return("disable", "routine/a", &receipt).is_err());
    }
}
