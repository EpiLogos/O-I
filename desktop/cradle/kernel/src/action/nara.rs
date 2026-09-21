//! Private UI transport for QL's existing Nara personal operations. This label
//! is a routing adapter, not a new canonical Action or a grant to a model.
//! QL validates consent, domain meaning, target and revision. Central owns the
//! sources. No payload is stored in the kernel or exposed in diagnostic logs.
use super::{ActionDispatch, ActionInvocation};
use serde_json::Value;
use std::{
    ffi::OsString,
    io::{Read, Write},
    path::Path,
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};
const OP: &str = "ql nara --request-file - --json";
const INPUT_LIMIT: usize = 64 * 1024;
const OUTPUT_LIMIT: u64 = 4 * 1024 * 1024;
fn refused(message: &str) -> ActionDispatch {
    ActionDispatch::OwnerRefused {
        owner_operation: OP.into(),
        message: message.into(),
    }
}
fn uncertain() -> ActionDispatch {
    ActionDispatch::OwnerUnavailable { owner_operation: OP.into(), detail: "Native personal outcome is unconfirmed. Retain and recover the same request identity; do not create another cast or operation. Private process output is not included in diagnostics.".into() }
}
fn request(invocation: &ActionInvocation) -> Result<Vec<u8>, &'static str> {
    let value = invocation
        .input
        .as_ref()
        .filter(|v| v.is_object())
        .ok_or("A native Nara request object is required")?;
    let operation = value["operation"]
        .as_str()
        .ok_or("A native personal operation is required")?;
    if !["capabilities", "list", "read", "identity_material", "create", "apply"].contains(&operation) {
        return Err("Unsupported native personal operation");
    }
    if ["read", "identity_material", "apply"].contains(&operation) {
        if value["target"]["record_ref"].as_str() != Some(invocation.target_ref.as_str()) {
            return Err("Native request target does not match the selected personal record");
        }
    } else if invocation.target_ref != "ql:nara-personal" {
        return Err("Native personal collection target mismatch");
    }
    if operation != "capabilities"
        && (value["consent"]["actor_kind"] != "human"
            || value["consent"]["personal_data"] != true
            || value["consent"]["actor_ref"]
                .as_str()
                .is_none_or(|s| s.trim().is_empty()))
    {
        return Err(
            "Explicit local human personal-data consent is required; a model request cannot opt in",
        );
    }
    let bytes = serde_json::to_vec(value).map_err(|_| "Invalid native personal request")?;
    if bytes.len() > INPUT_LIMIT {
        return Err("Private request exceeds this adapter's 64 KiB bound; select a smaller native operation");
    }
    Ok(bytes)
}
pub(super) fn invoke(cwd: &Path, invocation: &ActionInvocation) -> ActionDispatch {
    let bytes = match request(invocation) {
        Ok(bytes) => bytes,
        Err(reason) => return refused(reason),
    };
    let executable = std::env::var_os("OI_BIN").unwrap_or_else(|| OsString::from("oi"));
    run(Path::new(&executable), cwd, bytes, Duration::from_secs(30))
}
fn run(executable: &Path, cwd: &Path, bytes: Vec<u8>, deadline: Duration) -> ActionDispatch {
    let mut child = match Command::new(executable).args(["ql", "nara", "--request-file", "-", "--json"])
        .current_dir(cwd).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn() {
        Ok(child) => child, Err(_) => return ActionDispatch::OwnerUnavailable { owner_operation: OP.into(), detail: "The installed O:I → QL personal command could not be started; no personal request was sent.".into() },
    };
    let mut input = child.stdin.take().expect("piped stdin");
    let output = child.stdout.take().expect("piped stdout");
    let (tx, rx) = mpsc::channel();
    let input_tx = tx.clone();
    thread::spawn(move || {
        let result = input.write_all(&bytes).map(|_| Vec::new());
        drop(input);
        let _ = input_tx.send((false, result));
    });
    thread::spawn(move || {
        let mut data = Vec::new();
        let result = output
            .take(OUTPUT_LIMIT + 1)
            .read_to_end(&mut data)
            .map(|_| data);
        let _ = tx.send((true, result));
    });
    let start = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if start.elapsed() < deadline => thread::sleep(Duration::from_millis(5)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return uncertain();
            }
        }
    };
    if !status.success() {
        return uncertain();
    }
    let mut payload = None;
    for _ in 0..2 {
        let remaining = deadline.saturating_sub(start.elapsed());
        match rx.recv_timeout(remaining) {
            Ok((is_output, Ok(bytes))) if bytes.len() as u64 <= OUTPUT_LIMIT => {
                if is_output {
                    payload = Some(bytes);
                }
            }
            _ => return uncertain(),
        }
    }
    let Some(value) = payload.and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok()) else {
        return uncertain();
    };
    if value["schema"] != "ql.nara-personal-operations/v1"
        || !value["ok"].is_boolean()
        || value["private"] != true
    {
        return uncertain();
    }
    // Keep the actual native refusal/receipt intact. Exit zero is not success.
    ActionDispatch::Invoked {
        owner_operation: OP.into(),
        data: value,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn invocation(input: Value) -> ActionInvocation {
        ActionInvocation {
            action: "ql.nara.personal".into(),
            target_ref: "ql:nara-personal".into(),
            input: Some(input),
        }
    }
    #[test]
    fn consent_and_exact_target_precede_process_creation() {
        assert!(request(&invocation(json!({"operation":"capabilities"}))).is_ok());
        assert!(request(&invocation(json!({"operation":"list"}))).is_err());
        assert!(request(&invocation(json!({"operation":"list","consent":{"actor_ref":"human","actor_kind":"agent","personal_data":true}}))).is_err());
        let mut call = invocation(
            json!({"operation":"read","target":{"record_ref":"A"},"consent":{"actor_ref":"human","actor_kind":"human","personal_data":true}}),
        );
        call.target_ref = "B".into();
        assert!(request(&call).is_err());
        call.target_ref = "A".into();
        assert!(request(&call).is_ok());
        assert!(request(&invocation(json!({"operation":"export"}))).is_err());
    }
    #[test]
    fn resource_refusal_does_not_echo_private_payload() {
        let value = json!({"operation":"list","consent":{"actor_ref":"human","actor_kind":"human","personal_data":true},"private_text":"x".repeat(INPUT_LIMIT)});
        let result = request(&invocation(value)).unwrap_err();
        assert!(result.contains("64 KiB"));
        assert!(result.len() < 160);
    }
    #[cfg(unix)]
    #[test]
    fn real_process_receives_private_stdin_never_argv_and_refusal_is_not_success() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!(
            "nara-transport-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&dir).unwrap();
        let script = dir.join("owner");
        std::fs::write(&script,"#!/bin/sh\nprintf '%s\\n' \"$@\" > argv\ncat > input\nprintf '%s' '{\"schema\":\"ql.nara-personal-operations/v1\",\"private\":true,\"ok\":false,\"error\":{\"code\":\"nara_refused\",\"reason\":\"revision conflict\"}}'\n").unwrap();
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700)).unwrap();
        let payload = b"{\"private\":\"not-in-argv\"}".to_vec();
        let result = run(&script, &dir, payload.clone(), Duration::from_secs(2));
        let ActionDispatch::Invoked { data, .. } = result else {
            panic!("actual owner reply was lost")
        };
        assert_eq!(data["ok"], false);
        assert_eq!(std::fs::read(dir.join("input")).unwrap(), payload);
        assert_eq!(
            std::fs::read_to_string(dir.join("argv")).unwrap(),
            "ql\nnara\n--request-file\n-\n--json\n"
        );
        std::fs::remove_dir_all(dir).unwrap();
    }
}
