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
}

impl Request {
    pub fn mutation(&self) -> Option<(&'static str, &str)> {
        match self {
            Self::Disable { routine_ref } => Some(("disable", routine_ref)),
            Self::RunNow { routine_ref } => Some(("run-now", routine_ref)),
            _ => None,
        }
    }

    fn args(&self) -> Result<Vec<&str>, String> {
        match self {
            Self::List => Ok(vec!["routine", "list"]),
            Self::Methods => Ok(vec!["method", "list"]),
            Self::History => Ok(vec!["routine", "invocations", "--with-outcomes"]),
            Self::Show { routine_ref }
            | Self::Disable { routine_ref }
            | Self::RunNow { routine_ref } => {
                if routine_ref.trim().is_empty()
                    || routine_ref.len() > 4096
                    || routine_ref.chars().any(char::is_control)
                {
                    return Err("A native Routine reference is required".into());
                }
                let action = match self {
                    Self::Show { .. } => "show",
                    Self::Disable { .. } => "disable",
                    _ => "run-now",
                };
                Ok(vec!["routine", action, "--", routine_ref])
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
    if let Some((action, routine_ref)) = request.mutation() {
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
}
