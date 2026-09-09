//! Thin AIKit Knowledge application transport. Ranking, discovery, relations,
//! provenance and successful-use learning remain entirely native-owned.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{path::Path, process::Command};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "kebab-case")]
pub enum Address { Wiki(String), Source(String), ProjectMap(String) }
impl Address {
    pub fn reference(&self) -> &str { match self { Self::Wiki(v) | Self::Source(v) | Self::ProjectMap(v) => v } }
}
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum Request {
    Search { query: String },
    /// Owner-side resolution rows (C2): every row is a ref carrying owner,
    /// provenance and its available canonical Actions. Records nothing.
    Resolve { query: String },
    Read { address: Address },
    Relations { address: Address },
    Explain { address: Address },
    History,
    Use { address: Address },
}

/// Why an `aikit` application call did not serve — the knowledge
/// transport's structured seam, so the Action dispatch adapter
/// (`action.rs`) can classify owner failures without re-parsing strings.
#[derive(Clone, Debug, PartialEq)]
pub enum CallError {
    /// The owner executable could not be launched. Absence, not an error.
    Unavailable { detail: String },
    /// The owner answered, and the answer was no — owner message verbatim.
    Refused { message: String },
    /// The owner answered something the contract cannot parse.
    Malformed { detail: String },
}

/// Run one `aikit` application subcommand through the pinned suite
/// executable and return the owner `data` payload. The envelope law below
/// is the thin transport's contract, shared by every knowledge operation
/// and by the Action dispatch adapter — the kernel invents nothing on top.
pub fn run(cwd: &Path, args: &[&str]) -> Result<Value, CallError> {
    let executable = std::env::var_os("OI_BIN").unwrap_or_else(|| "oi".into());
    let output = Command::new(executable)
        .arg("aikit")
        .arg("--json")
        .arg("-C")
        .arg(cwd)
        .args(args)
        .output()
        .map_err(|e| CallError::Unavailable { detail: e.to_string() })?;
    decode_envelope(&output)
}

fn decode_envelope(output: &std::process::Output) -> Result<Value, CallError> {
    if !output.status.success() && output.stdout.iter().all(u8::is_ascii_whitespace) {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if detail.is_empty() {
            CallError::Malformed { detail: format!("AIKit knowledge operation failed ({})", output.status) }
        } else {
            CallError::Malformed { detail: format!("AIKit knowledge operation failed ({}): {detail}", output.status) }
        });
    }
    let envelope: Value = serde_json::from_slice(&output.stdout).map_err(|e| CallError::Malformed {
        detail: format!("AIKit returned an unreadable response ({e}): {}", String::from_utf8_lossy(&output.stderr)),
    })?;
    if !output.status.success() || envelope["ok"] != true {
        return Err(CallError::Refused {
            message: envelope["error"]["message"].as_str().unwrap_or("AIKit refused this knowledge operation").to_owned(),
        });
    }
    envelope.get("data").cloned().ok_or_else(|| CallError::Malformed { detail: "AIKit response is missing its reading".into() })
}

pub fn call(cwd: &Path, request: &Request) -> Result<Value, String> {
    let mut args: Vec<String> = vec!["knowledge".into()];
    match request {
        Request::Search { query } => { args.extend(["search".into(), "--limit".into(), "50".into(), "--".into(), query.clone()]); }
        Request::Resolve { query } => { args.extend(["resolve".into(), "--limit".into(), "50".into(), "--".into(), query.clone()]); }
        Request::History => { args.push("history".into()); }
        Request::Read { address } | Request::Explain { address } | Request::Relations { address } | Request::Use { address } => {
            if address.reference().trim().is_empty() { return Err("Knowledge address is empty".into()); }
            args.push(match request { Request::Read {..} => "read", Request::Explain {..} => "explain", Request::Relations {..} => "relations", _ => "route" }.into());
            if matches!(request, Request::Relations {..}) { args.extend(["--depth".into(), "2".into(), "--max-nodes".into(), "96".into(), "--max-edges".into(), "192".into()]); }
            args.push("--".into());
            args.push(serde_json::to_string(address).map_err(|e| e.to_string())?);
        }
    }
    run(cwd, &args.iter().map(String::as_str).collect::<Vec<_>>()).map_err(|error| match error {
        CallError::Unavailable { detail } => format!("AIKit is unavailable: {detail}"),
        CallError::Refused { message } => message,
        CallError::Malformed { detail } => detail,
    })
}
