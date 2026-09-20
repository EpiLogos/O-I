//! Thin adoption adapter. The installed `oi setup` owns plans, authority checks,
//! journal durability, installation and readback. Nothing is retried here.
use serde_json::Value;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

pub struct Client {
    executable: PathBuf,
}
impl Client {
    pub fn discover() -> Self {
        Self {
            executable: std::env::var_os("OI_BIN")
                .map(PathBuf::from)
                .unwrap_or_else(|| "oi".into()),
        }
    }
    pub fn with(executable: PathBuf) -> Self {
        Self { executable }
    }
    pub fn request(&self, cwd: &Path, request: &Value) -> Result<Value, String> {
        let bytes = encode_request(request)?;
        let mut child = Command::new(&self.executable)
            .args(["setup", "--request-file", "-", "--json"])
            .current_dir(cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|_| {
                "The installed O:I setup command could not start. No request was sent.".to_owned()
            })?;
        let mut stdin = child
            .stdin
            .take()
            .ok_or("Native setup input was unavailable")?;
        if stdin.write_all(&bytes).is_err() {
            drop(stdin);
            // Do not re-send or call a second installer. The owner may already
            // have received enough input to begin; its journal decides recovery.
            let _ = child.wait();
            return Err("Native setup lost its input channel. Recheck its journal; do not replay the write.".into());
        }
        drop(stdin);
        let output = child.wait_with_output().map_err(|_| {
            "Native setup reply was lost. Recheck its journal; no write was retried.".to_owned()
        })?;
        decode_reply(output.status.code(), &output.stdout)
    }
}
fn encode_request(request: &Value) -> Result<Vec<u8>, String> {
    if !matches!(
        request.get("action").and_then(Value::as_str),
        Some("discover" | "plan" | "apply" | "status" | "recheck" | "prepare_desktop")
    ) {
        return Err("Unsupported native adoption operation".into());
    }
    let bytes = serde_json::to_vec(request).map_err(|e| e.to_string())?;
    if bytes.len() > 1024 * 1024 {
        return Err("Native adoption request exceeds 1 MiB".into());
    }
    Ok(bytes)
}
fn decode_reply(code: Option<i32>, bytes: &[u8]) -> Result<Value, String> {
    if bytes.len() > 4 * 1024 * 1024 {
        return Err(
            "Native adoption reply exceeded its bound. Recheck; no write was retried.".into(),
        );
    }
    let reply: Value = serde_json::from_slice(bytes).map_err(|_| "Native adoption returned an unreadable reply. Recheck its journal; do not replay the write.".to_owned())?;
    if reply["schema"] != "oi.setup/v1" {
        return Err("Installed O:I does not provide the supported adoption protocol".into());
    }
    // Exit 1 describes retained partial/unknown results; exit 2 a native refusal.
    // Neither becomes a success nor loses the owner's recovery document.
    if !matches!(code, Some(0 | 1 | 2)) {
        return Err(
            "Native setup ended without a conclusive status. Recheck; no write was retried.".into(),
        );
    }
    Ok(reply)
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn rejects_arbitrary_commands_and_unbounded_input() {
        assert!(encode_request(&json!({"action":"shell","command":"anything"})).is_err());
        assert!(encode_request(
            &json!({"action":"plan","selection":{"ground":"x".repeat(1024*1024)}})
        )
        .is_err());
        assert!(encode_request(&json!({"action":"status"})).is_ok());
    }
    #[test]
    fn retains_partial_and_refused_owner_documents_without_retry() {
        for (code, disposition) in [(0, "verified"), (1, "outcome_unknown"), (2, "not_applied")] {
            let value = json!({"schema":"oi.setup/v1","disposition":disposition});
            assert_eq!(
                decode_reply(Some(code), &serde_json::to_vec(&value).unwrap()).unwrap(),
                value
            );
        }
        assert!(decode_reply(None, b"{}").is_err());
        assert!(decode_reply(Some(0), b"not json").is_err());
    }
}
