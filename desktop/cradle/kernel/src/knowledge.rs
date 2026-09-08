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
    Read { address: Address },
    Relations { address: Address },
    Explain { address: Address },
    History,
    Use { address: Address },
}

pub fn call(cwd: &Path, request: &Request) -> Result<Value, String> {
    let executable = std::env::var_os("OI_BIN").unwrap_or_else(|| "oi".into());
    let mut command = Command::new(executable);
    command.arg("aikit").arg("--json").arg("-C").arg(cwd).arg("knowledge");
    match request {
        Request::Search { query } => { command.args(["search", "--limit", "50", "--", query]); }
        Request::History => { command.arg("history"); }
        Request::Read { address } | Request::Explain { address } | Request::Relations { address } | Request::Use { address } => {
            if address.reference().trim().is_empty() { return Err("Knowledge address is empty".into()); }
            command.arg(match request { Request::Read {..} => "read", Request::Explain {..} => "explain", Request::Relations {..} => "relations", _ => "route" });
            if matches!(request, Request::Relations {..}) { command.args(["--depth", "2", "--max-nodes", "96", "--max-edges", "192"]); }
            command.arg("--").arg(serde_json::to_string(address).map_err(|e| e.to_string())?);
        }
    }
    let output = command.output().map_err(|e| format!("AIKit is unavailable: {e}"))?;
    if !output.status.success() && output.stdout.iter().all(u8::is_ascii_whitespace) {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if detail.is_empty() {
            format!("AIKit knowledge operation failed ({})", output.status)
        } else {
            format!("AIKit knowledge operation failed ({}): {detail}", output.status)
        });
    }
    let envelope: Value = serde_json::from_slice(&output.stdout).map_err(|e| format!("AIKit returned an unreadable response ({e}): {}", String::from_utf8_lossy(&output.stderr)))?;
    if !output.status.success() || envelope["ok"] != true {
        return Err(envelope["error"]["message"].as_str().unwrap_or("AIKit refused this knowledge operation").to_owned());
    }
    envelope.get("data").cloned().ok_or_else(|| "AIKit response is missing its reading".into())
}
