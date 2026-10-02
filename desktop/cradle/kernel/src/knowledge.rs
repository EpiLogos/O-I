//! Thin AIKit Knowledge application transport. Ranking, discovery, relations,
//! provenance and successful-use learning remain entirely native-owned.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{ffi::OsStr, path::Path, process::Command};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "kebab-case")]
pub enum Address {
    Wiki(String),
    Source(String),
    ProjectMap(String),
}
impl Address {
    pub fn reference(&self) -> &str {
        match self {
            Self::Wiki(v) | Self::Source(v) | Self::ProjectMap(v) => v,
        }
    }
}
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum Request {
    Status,
    Search {
        query: String,
    },
    /// Owner-side resolution rows (C2): every row is a ref carrying owner,
    /// provenance and its available canonical Actions. Records nothing.
    Resolve {
        query: String,
    },
    Read {
        address: Address,
    },
    Relations {
        address: Address,
    },
    Explain {
        address: Address,
    },
    History,
    Use {
        address: Address,
    },
}

/// The products share a transport outcome shape, not semantic authority.
/// AIKit still owns its envelope and closed request effect classification.
pub use crate::flow::{Effect, OwnerCallError as CallError};

pub fn run(cwd: &Path, args: &[&str]) -> Result<Value, CallError> {
    run_effect(cwd, args, Effect::MayMutate)
}

pub fn run_effect(cwd: &Path, args: &[&str], effect: Effect) -> Result<Value, CallError> {
    let executable = std::env::var_os("OI_BIN").unwrap_or_else(|| "oi".into());
    run_with_executable(cwd, args, &executable, effect, None)
}

/// Structured input goes on stdin, never shell-expanded argv or a temp source file.
/// One physical deadline includes its write, output, process exit and EOF.
pub fn run_input(cwd: &Path, args: &[&str], input: &Value) -> Result<Value, CallError> {
    let bytes = serde_json::to_vec(input).map_err(|e| CallError::Malformed {
        detail: e.to_string(),
    })?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err(CallError::Malformed {
            detail: "Native Action exceeds its 16 MiB input budget".into(),
        });
    }
    let executable = std::env::var_os("OI_BIN").unwrap_or_else(|| "oi".into());
    run_with_executable(cwd, args, &executable, Effect::MayMutate, Some(&bytes))
}

fn run_with_executable(
    cwd: &Path,
    args: &[&str],
    executable: &OsStr,
    effect: Effect,
    input: Option<&[u8]>,
) -> Result<Value, CallError> {
    let command = owner_command(cwd, args, executable);
    // Reads retain the existing 20s budget. An explicitly invoked operation
    // may wait up to five minutes for its native receipt; timeout is unknown,
    // never proof that native work was cancelled or did not take effect.
    let timeout = std::time::Duration::from_secs(if effect == Effect::ReadOnly { 20 } else { 300 });
    let output = bounded_output(command, input, timeout, effect)?;
    decode_envelope(&output, effect)
}

fn owner_command(cwd: &Path, args: &[&str], executable: &OsStr) -> Command {
    let mut command = Command::new(executable);
    command.args(["aikit", "--json", "-C"]).arg(cwd).args(args);
    command
}

fn bounded_output(
    command: Command,
    input: Option<&[u8]>,
    timeout: std::time::Duration,
    effect: Effect,
) -> Result<std::process::Output, CallError> {
    crate::native_process::run(
        command,
        input,
        crate::native_process::Limits {
            timeout,
            stdout_bytes: 8 * 1024 * 1024,
            stderr_bytes: 64 * 1024,
        },
    )
    .map_err(|error| effect.physical_failure(error))
}

pub(crate) fn decode_envelope(
    output: &std::process::Output,
    effect: Effect,
) -> Result<Value, CallError> {
    let lost = |detail: String| effect.lost_response(detail, None, None, None);
    let envelope: Value = serde_json::from_slice(&output.stdout).map_err(|e| {
        lost(format!(
            "AIKit returned an unreadable response ({e}; status {}): {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        ))
    })?;
    let lost = |detail: String| effect.lost_response(detail, None, None, Some(envelope.clone()));
    if envelope["schema"] != 1 || envelope["ok"].as_bool().is_none() {
        return Err(lost(format!(
            "AIKit returned no supported native envelope (status {})",
            output.status
        )));
    }
    if envelope["ok"] == true {
        if !output.status.success() {
            return Err(lost(format!(
                "AIKit returned success JSON with process status {}",
                output.status
            )));
        }
        return envelope
            .get("data")
            .cloned()
            .ok_or_else(|| lost("AIKit response is missing its reading".into()));
    }
    let error = &envelope["error"];
    let Some(message) = error["message"].as_str() else {
        return Err(lost("AIKit failure has no native error message".into()));
    };
    let Some(code) = error["code"].as_str() else {
        return Err(lost("AIKit failure has no stable native error code".into()));
    };
    // Actual AIKit publication owners publish string-valued `published` in
    // AikitError.details. Preserve the whole failure and original operation.
    // No diagnostic prose is used as an effect test.
    if error
        .pointer("/details/published")
        .is_some_and(|v| v == "true" || v == true)
        || code == "knowledge.wiki_publication_uncertain"
    {
        return Err(CallError::OutcomeUnknown {
            detail: message.into(),
            child_pid: None,
            cleanup: None,
            native: Some(envelope),
        });
    }
    Err(CallError::Refused {
        message: message.into(),
        native: Some(envelope),
    })
}

/// Native failure disclosure carries the original invocation; this is an
/// adapter result, never a native success receipt or a replacement identity.
pub(crate) fn failure_reading(operation: &str, error: CallError) -> Value {
    serde_json::json!({"schema":"oi.native-call-failure/v1","owner_operation":operation,"failure":error})
}

/// Transport only: the owner parser decides what every query means. Keeping
/// construction separate makes the literal-operand contract executable.
fn request_args(request: &Request) -> Result<Vec<String>, String> {
    let mut args: Vec<String> = vec!["knowledge".into()];
    match request {
        Request::Status => args.push("status".into()),
        Request::Search { query } => {
            args.extend([
                "search".into(),
                "--limit".into(),
                "50".into(),
                "--".into(),
                query.clone(),
            ]);
        }
        Request::Resolve { query } => {
            args.extend([
                "resolve".into(),
                "--limit".into(),
                "50".into(),
                "--".into(),
                query.clone(),
            ]);
        }
        Request::History => {
            args.push("history".into());
        }
        Request::Read { address }
        | Request::Explain { address }
        | Request::Relations { address }
        | Request::Use { address } => {
            if address.reference().trim().is_empty() {
                return Err("Knowledge address is empty".into());
            }
            args.push(
                match request {
                    Request::Read { .. } => "read",
                    Request::Explain { .. } => "explain",
                    Request::Relations { .. } => "relations",
                    _ => "route",
                }
                .into(),
            );
            if matches!(request, Request::Relations { .. }) {
                args.extend([
                    "--depth".into(),
                    "2".into(),
                    "--max-nodes".into(),
                    "96".into(),
                    "--max-edges".into(),
                    "192".into(),
                ]);
            }
            args.push("--".into());
            args.push(serde_json::to_string(address).map_err(|e| e.to_string())?);
        }
    }
    Ok(args)
}

pub fn call(cwd: &Path, request: &Request) -> Result<Value, String> {
    let args = request_args(request)?;
    let effect = if matches!(request, Request::Use { .. }) {
        Effect::MayMutate
    } else {
        Effect::ReadOnly
    };
    run_effect(
        cwd,
        &args.iter().map(String::as_str).collect::<Vec<_>>(),
        effect,
    )
    .or_else(|error| Ok(failure_reading(&format!("aikit {}", args.join(" ")), error)))
}

pub fn not_fresh(value: &bool) -> bool {
    !value
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn native_read_deadline_stops_a_waiting_process_group() {
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "sleep 30 & wait"]);
        let start = std::time::Instant::now();
        let error = bounded_output(
            command,
            None,
            std::time::Duration::from_millis(100),
            Effect::ReadOnly,
        )
        .unwrap_err();
        assert!(matches!(error, CallError::TransportFailed { .. }));
        assert!(start.elapsed() < std::time::Duration::from_secs(2));
    }
    #[cfg(unix)]
    #[test]
    fn native_read_bounds_a_real_process_output_stream() {
        let mut command = Command::new("/usr/bin/yes");
        command.arg("bounded read");
        let start = std::time::Instant::now();
        let error = bounded_output(
            command,
            None,
            std::time::Duration::from_secs(5),
            Effect::ReadOnly,
        )
        .unwrap_err();
        assert!(
            matches!(error,CallError::TransportFailed{detail, ..} if detail.contains("bounded output"))
        );
        assert!(start.elapsed() < std::time::Duration::from_secs(5));
    }

    #[derive(Deserialize)]
    struct QueryCase {
        name: String,
        query: String,
    }

    fn cases() -> Vec<QueryCase> {
        serde_json::from_str(include_str!("../../tests/search-queries.json")).unwrap()
    }

    #[test]
    fn full_query_is_one_literal_operand_after_the_option_terminator() {
        for case in cases() {
            for (action, request) in [
                (
                    "search",
                    Request::Search {
                        query: case.query.clone(),
                    },
                ),
                (
                    "resolve",
                    Request::Resolve {
                        query: case.query.clone(),
                    },
                ),
            ] {
                let args = request_args(&request).unwrap();
                assert_eq!(
                    args,
                    ["knowledge", action, "--limit", "50", "--", &case.query],
                    "{}",
                    case.name
                );
                let roundtrip: Request =
                    serde_json::from_str(&serde_json::to_string(&request).unwrap()).unwrap();
                assert_eq!(roundtrip, request, "{}", case.name);
            }
        }
    }

    #[test]
    fn production_command_keeps_queries_literal_and_carries_the_selected_context() {
        for cwd in [Path::new("/Central"), Path::new("/Central/Work/My Project")] {
            for case in cases() {
                for request in [
                    Request::Search {
                        query: case.query.clone(),
                    },
                    Request::Resolve {
                        query: case.query.clone(),
                    },
                ] {
                    let args = request_args(&request).unwrap();
                    let command = owner_command(
                        cwd,
                        &args.iter().map(String::as_str).collect::<Vec<_>>(),
                        OsStr::new("oi"),
                    );
                    let mut expected = vec![
                        "aikit".to_owned(),
                        "--json".to_owned(),
                        "-C".to_owned(),
                        cwd.to_str().unwrap().to_owned(),
                    ];
                    expected.extend(args);
                    assert_eq!(command.get_program(), OsStr::new("oi"));
                    assert_eq!(
                        command.get_args().collect::<Vec<_>>(),
                        expected.iter().map(OsStr::new).collect::<Vec<_>>(),
                        "{}",
                        case.name
                    );
                }
            }
        }
    }

    #[cfg(unix)]
    #[test]
    fn actual_material_effect_before_receipt_loss_is_unknown() {
        let path = std::env::temp_dir().join(format!(
            "oi-effect-before-receipt-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut command = Command::new("/bin/sh");
        command.args([
            "-c",
            "printf 'retained material effect' > \"$1\"; exec sleep 30",
            "effect",
        ]);
        command.arg(&path);
        let error = bounded_output(
            command,
            None,
            std::time::Duration::from_millis(250),
            Effect::MayMutate,
        )
        .unwrap_err();
        let retained = std::fs::read_to_string(&path).unwrap();
        std::fs::remove_file(path).unwrap();
        assert_eq!(retained, "retained material effect");
        assert!(matches!(
            error,
            CallError::OutcomeUnknown {
                child_pid: Some(_),
                cleanup: Some(_),
                ..
            }
        ));
    }

    #[cfg(unix)]
    #[test]
    fn actual_nonzero_exit_without_native_receipt_is_not_refusal() {
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "exit 7"]);
        let output = bounded_output(
            command,
            None,
            std::time::Duration::from_secs(1),
            Effect::MayMutate,
        )
        .unwrap();
        assert_eq!(output.status.code(), Some(7));
        assert!(matches!(
            decode_envelope(&output, Effect::MayMutate),
            Err(CallError::OutcomeUnknown { .. })
        ));
        assert!(matches!(
            decode_envelope(&output, Effect::ReadOnly),
            Err(CallError::Malformed { .. })
        ));
    }
}
