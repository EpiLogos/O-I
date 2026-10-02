//! Thin adoption adapter. The installed `oi setup` owns plans, authority checks,
//! journal durability, installation and readback. Nothing is retried here.
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;

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
        let mut command = Command::new(&self.executable);
        command
            .args(["setup", "--request-file", "-", "--json"])
            .current_dir(cwd);
        let action = request["action"].as_str().unwrap_or_default();
        let effect = if matches!(action, "discover" | "status") {
            crate::flow::Effect::ReadOnly
        } else {
            crate::flow::Effect::MayMutate
        };
        // Download/install work has a longer explicit budget than disclosure
        // and planning. Neither a lost reply nor cleanup may trigger replay:
        // the native setup journal remains the recovery authority.
        let timeout = if matches!(action, "apply" | "prepare_desktop") {
            std::time::Duration::from_secs(20 * 60)
        } else {
            std::time::Duration::from_secs(30)
        };
        let output = crate::native_process::run(
            command,
            Some(&bytes),
            crate::native_process::Limits {
                timeout,
                stdout_bytes: 4 * 1024 * 1024,
                stderr_bytes: 64 * 1024,
            },
        )
        .map_err(|failure| {
            format!(
                "Native O:I setup: {}. Recheck its native journal; no request was replayed.",
                effect.physical_failure(failure)
            )
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
    if !matches!(code, Some(0..=2)) {
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
