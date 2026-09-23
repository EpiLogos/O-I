//! Thin transport to the O:I-owned SharedField client (Lane C step 5,
//! cell S→S0 · aperture mode). The hosted field is an owner read model
//! the kernel pulls through `shared-field/spacetimedb/field.sh`; the
//! kernel invents no store, no second index and no identity, and it never
//! reads the owner transport token — the hosting target and the token live
//! in the client's own environment (`OI_SHARED_FIELD_TARGET`,
//! `OI_STATE_HOME`), which the kernel passes through untouched.
//!
//! One request on stdin, one envelope on stdout, decoded exactly like
//! `knowledge.rs::decode_envelope`: `{ok:true,data}` is the owner reading;
//! `{ok:false,error:{kind,message}}` is the owner's own failure truth, and
//! the failure kinds the client speaks (`unbound` | `unavailable` |
//! `refused` | `malformed`) are carried as distinct states. An unbound
//! target is absence, never an error.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    ffi::OsString,
    io::Write,
    path::PathBuf,
    process::{Command, Stdio},
};

/// The owner operation name every hosted node, edge and input carries.
pub const OWNER_OPERATION: &str = "shared-field.projection";

/// Why the SharedField client did not serve — the client's own failure
/// kinds, verbatim, so the graph assembler and the kernel op can state the
/// truthful input state without re-parsing strings.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CallError {
    /// No hosting target is bound in the client's environment. Absence.
    Unbound { message: String },
    /// The client could not be launched or the hosted field did not
    /// answer. Absence, not an error.
    Unavailable { detail: String },
    /// The owner answered, and the answer was no — owner message verbatim.
    Refused { message: String },
    /// The owner answered something the envelope contract cannot parse.
    Malformed { detail: String },
}

impl CallError {
    /// The owner's own words for this failure, for an `Unavailable` input.
    pub fn detail(&self) -> String {
        match self {
            Self::Unbound { message } | Self::Refused { message } => message.clone(),
            Self::Unavailable { detail } | Self::Malformed { detail } => detail.clone(),
        }
    }
}

/// The client executable: `OI_SHARED_FIELD_CLIENT`, else the repository's
/// own doorway `<repo>/shared-field/spacetimedb/field.sh` where the
/// repository root is `OI_REPO_ROOT` or this crate's manifest directory
/// climbed three levels (`desktop/cradle/kernel` → the O:I repository).
pub fn client_executable() -> PathBuf {
    if let Some(explicit) = std::env::var_os("OI_SHARED_FIELD_CLIENT") {
        return PathBuf::from(explicit);
    }
    let repo = std::env::var_os("OI_REPO_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("..")
                .join("..")
        });
    repo.join("shared-field").join("spacetimedb").join("field.sh")
}

/// Send one request to the SharedField client and return the owner `data`.
pub fn call(request: &Value) -> Result<Value, CallError> {
    call_with_executable(request, &client_executable().into_os_string())
}

fn call_with_executable(request: &Value, executable: &OsString) -> Result<Value, CallError> {
    let mut child = Command::new(executable)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| CallError::Unavailable { detail: format!("SharedField client could not be launched ({}): {e}", executable.to_string_lossy()) })?;
    {
        let mut stdin = child.stdin.take().ok_or_else(|| CallError::Unavailable { detail: "SharedField client accepted no request on stdin".into() })?;
        stdin
            .write_all(request.to_string().as_bytes())
            .map_err(|e| CallError::Unavailable { detail: format!("SharedField client refused the request bytes: {e}") })?;
    }
    let output = child
        .wait_with_output()
        .map_err(|e| CallError::Unavailable { detail: format!("SharedField client did not complete: {e}") })?;
    decode_envelope(&output)
}

/// The envelope law shared with the knowledge transport: an empty stdout
/// on failure is a launch/runtime fault (Unavailable); an unreadable
/// stdout is Malformed; `ok:false` carries the client's own error kind.
pub fn decode_envelope(output: &std::process::Output) -> Result<Value, CallError> {
    if !output.status.success() && output.stdout.iter().all(u8::is_ascii_whitespace) {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(CallError::Unavailable {
            detail: if detail.is_empty() {
                format!("SharedField client failed ({})", output.status)
            } else {
                format!("SharedField client failed ({}): {detail}", output.status)
            },
        });
    }
    let envelope: Value = serde_json::from_slice(&output.stdout).map_err(|e| CallError::Malformed {
        detail: format!("SharedField client returned an unreadable envelope ({e}): {}", String::from_utf8_lossy(&output.stderr).trim()),
    })?;
    if envelope["ok"] == true {
        return envelope.get("data").cloned().ok_or_else(|| CallError::Malformed { detail: "SharedField envelope is missing its reading".into() });
    }
    let message = envelope["error"]["message"].as_str().unwrap_or("SharedField client refused this request").to_owned();
    Err(match envelope["error"]["kind"].as_str() {
        Some("unbound") => CallError::Unbound { message },
        Some("unavailable") => CallError::Unavailable { detail: message },
        Some("malformed") => CallError::Malformed { detail: message },
        // `refused`, and any kind the contract does not name, is the
        // owner's answer carried verbatim.
        _ => CallError::Refused { message },
    })
}

/// The kernel-op reading: the owner data verbatim when it served; an
/// explicit `{state:"unavailable", detail}` reading when the target is
/// unbound or the field cannot be reached (absence is data, never an
/// `Err`); the owner's own refusal or a malformed envelope is the error
/// the caller surfaces in the owner's words.
pub fn reading(request: &Value) -> Result<Value, String> {
    match call(request) {
        Ok(data) => Ok(data),
        Err(CallError::Unbound { message }) => Ok(serde_json::json!({ "state": "unavailable", "owner_operation": OWNER_OPERATION, "detail": message })),
        Err(CallError::Unavailable { detail }) => Ok(serde_json::json!({ "state": "unavailable", "owner_operation": OWNER_OPERATION, "detail": detail })),
        Err(CallError::Refused { message }) => Err(message),
        Err(CallError::Malformed { detail }) => Err(detail),
    }
}

/// The owner A2A runner beside the floor (`shared-field/a2a-runner.mjs`):
/// the same repository-relative doorway discipline as `client_executable` —
/// `OI_A2A_RUNNER` overrides, else `OI_REPO_ROOT`, else this crate's
/// manifest directory climbed to the O:I repository root.
fn a2a_runner_path() -> PathBuf {
    if let Some(explicit) = std::env::var_os("OI_A2A_RUNNER") {
        return PathBuf::from(explicit);
    }
    let repo = std::env::var_os("OI_REPO_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("..")
                .join("..")
        });
    repo.join("shared-field").join("a2a-runner.mjs")
}

/// One A2A HTTP+JSON v1 exchange through the owner floor. The request
/// (binding, presence, initiator, message) travels verbatim; the kernel
/// composes the operator-send authority — the person's send is the
/// exchange-authority act, so the grant is recorded as operator-asserted,
/// never minted by the renderer or invented here. Node runs the floor; the
/// renderer sees only the returned `oi.a2a-difference/v1` document.
pub fn a2a_exchange(request: &Value) -> Result<Value, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let runner = a2a_runner_path();
    if !runner.is_file() {
        return Err(format!(
            "the A2A owner floor is not present at {} — the desktop bundle carries the renderer contracts only; run against the repository checkout or set OI_A2A_RUNNER",
            runner.display()
        ));
    }
    let node = std::env::var_os("OI_NODE")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from("node"));

    let mut composed = request.clone();
    let operation_id = composed
        .get("message")
        .and_then(|m| m.get("exchange_operation_id").or_else(|| m.get("message_id")))
        .and_then(|v| v.as_str())
        .unwrap_or("a2a-exchange")
        .to_string();
    composed["authority"] = serde_json::json!({
        "allowed": true,
        "grant_ref": format!("exchange-grant:operator-send:{operation_id}"),
        "operation_id": operation_id,
        "basis": "operator send — the desktop's own exchange-authority decision",
    });

    let mut child = Command::new(&node)
        .arg(&runner)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("the A2A runner could not be launched via node ({}): {e}", node.display()))?;
    {
        let stdin = child.stdin.as_mut().ok_or_else(|| "the A2A runner accepted no request".to_string())?;
        stdin
            .write_all(composed.to_string().as_bytes())
            .map_err(|e| format!("the A2A runner refused the request bytes: {e}"))?;
    }
    let output = child
        .wait_with_output()
        .map_err(|e| format!("the A2A runner did not complete: {e}"))?;
    let parsed: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("the A2A runner's reply was not JSON: {e}"))?;
    if let Some(message) = parsed.get("a2aError").and_then(|v| v.as_str()) {
        return Err(format!("the A2A floor refused the exchange: {message}"));
    }
    if parsed.get("schema").and_then(|v| v.as_str()) != Some("oi.a2a-difference/v1") {
        return Err("the A2A runner returned something that is not an oi.a2a-difference/v1 document".to_string());
    }
    Ok(parsed)
}

#[cfg(test)]
mod a2a_tests {
    use super::*;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn a2a_exchange_composes_operator_send_authority_and_verifies_the_contract() {
        let dir = std::env::temp_dir().join(format!("oi-a2a-runner-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let stdin_file = dir.join("stdin.txt");
        let fake = dir.join("fake-node.sh");
        let runner = dir.join("shared-field").join("a2a-runner.mjs");
        std::fs::create_dir_all(runner.parent().unwrap()).unwrap();
        std::fs::write(&runner, "export {}").unwrap();
        let script = format!(
            "#!/bin/sh\nfor a in \"$@\"; do printf '%s\\n' \"$a\" >> \"{args}\"; done\ncat > \"{stdin}\"\necho '{{\"schema\":\"oi.a2a-difference/v1\",\"exchange_ref\":\"a2a-exchange:m1\",\"transport_result\":{{\"kind\":\"message\",\"ref\":\"t1\"}}}}'\n",
            args = dir.join("argv.txt").display(),
            stdin = stdin_file.display()
        );
        std::fs::write(&fake, script).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755)).unwrap();
            crate::test_stub::settle_stub(&fake);
        }

        let prior_node = std::env::var_os("OI_NODE");
        let prior_runner = std::env::var_os("OI_A2A_RUNNER");
        std::env::set_var("OI_NODE", &fake);
        std::env::set_var("OI_A2A_RUNNER", &runner);

        let request = serde_json::json!({
            "binding": {"binding_ref": "a2a-binding:desktop:peer"},
            "presence": {"availability": "online"},
            "initiator_participant_ref": "participant:desktop-operator",
            "message": {"message_id": "a2a-m1", "text": "hello"},
        });
        let reading = a2a_exchange(&request).expect("the exchange dispatches");
        assert_eq!(reading["schema"], "oi.a2a-difference/v1");
        assert_eq!(reading["transport_result"]["ref"], "t1");
        let argv = std::fs::read_to_string(dir.join("argv.txt")).unwrap();
        assert_eq!(argv.trim(), runner.to_string_lossy().to_string(), "the runner path is the sole argument");
        let sent: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&stdin_file).unwrap()).unwrap();
        assert_eq!(sent["authority"]["allowed"], serde_json::json!(true));
        assert_eq!(sent["authority"]["grant_ref"], serde_json::json!("exchange-grant:operator-send:a2a-m1"));
        assert_eq!(sent["message"]["message_id"], serde_json::json!("a2a-m1"), "the message travels verbatim");

        // A reply that is not a difference document is refused, never carried.
        std::fs::write(&fake, "#!/bin/sh\ncat > /dev/null\necho '{\"unexpected\":true}'\n").unwrap();
        std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755)).unwrap();
        crate::test_stub::settle_stub(&fake);
        assert!(a2a_exchange(&request).is_err(), "a non-contract reply is refused");

        match prior_node {
            Some(value) => std::env::set_var("OI_NODE", value),
            None => std::env::remove_var("OI_NODE"),
        }
        match prior_runner {
            Some(value) => std::env::set_var("OI_A2A_RUNNER", value),
            None => std::env::remove_var("OI_A2A_RUNNER"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::process::ExitStatusExt;
    use std::process::{ExitStatus, Output};

    fn output(code: i32, stdout: &str, stderr: &str) -> Output {
        Output { status: ExitStatus::from_raw(code << 8), stdout: stdout.as_bytes().to_vec(), stderr: stderr.as_bytes().to_vec() }
    }

    #[test]
    fn ok_envelope_yields_the_owner_data_verbatim() {
        let data = decode_envelope(&output(0, r#"{"ok":true,"data":{"schema":"oi.shared-field.status/v1","bound":false,"reason":"no target"}}"#, "")).unwrap();
        assert_eq!(data["schema"], "oi.shared-field.status/v1");
        assert_eq!(data["bound"], false);
    }

    #[test]
    fn unbound_envelope_is_absence_not_refusal() {
        let error = decode_envelope(&output(1, r#"{"ok":false,"error":{"kind":"unbound","message":"no SharedField target bound: set OI_SHARED_FIELD_TARGET"}}"#, "")).unwrap_err();
        assert_eq!(error, CallError::Unbound { message: "no SharedField target bound: set OI_SHARED_FIELD_TARGET".into() });
        assert_eq!(error.detail(), "no SharedField target bound: set OI_SHARED_FIELD_TARGET");
    }

    #[test]
    fn every_client_failure_kind_is_carried_distinctly() {
        let unavailable = decode_envelope(&output(1, r#"{"ok":false,"error":{"kind":"unavailable","message":"SharedField db at ws://x is unavailable: timeout"}}"#, "")).unwrap_err();
        assert!(matches!(unavailable, CallError::Unavailable { ref detail } if detail.contains("timeout")));
        let refused = decode_envelope(&output(1, r#"{"ok":false,"error":{"kind":"refused","message":"the owner said no"}}"#, "")).unwrap_err();
        assert_eq!(refused, CallError::Refused { message: "the owner said no".into() });
        let malformed = decode_envelope(&output(1, r#"{"ok":false,"error":{"kind":"malformed","message":"read requires a string `ref`"}}"#, "")).unwrap_err();
        assert_eq!(malformed, CallError::Malformed { detail: "read requires a string `ref`".into() });
        let unknown_kind = decode_envelope(&output(1, r#"{"ok":false,"error":{"kind":"surprise","message":"carried verbatim"}}"#, "")).unwrap_err();
        assert_eq!(unknown_kind, CallError::Refused { message: "carried verbatim".into() });
    }

    #[test]
    fn empty_stdout_on_failure_is_unavailable_and_unreadable_stdout_is_malformed() {
        let launch_fault = decode_envelope(&output(127, "", "tsx: not found")).unwrap_err();
        assert!(matches!(launch_fault, CallError::Unavailable { ref detail } if detail.contains("tsx: not found")));
        let unreadable = decode_envelope(&output(0, "not json", "")).unwrap_err();
        assert!(matches!(unreadable, CallError::Malformed { .. }));
        let missing_data = decode_envelope(&output(0, r#"{"ok":true}"#, "")).unwrap_err();
        assert!(matches!(missing_data, CallError::Malformed { .. }));
    }

    #[test]
    fn a_missing_client_executable_is_absence_not_a_panic() {
        let error = call_with_executable(&serde_json::json!({"kind":"status"}), &OsString::from("/nonexistent/oi-shared-field-client")).unwrap_err();
        assert!(matches!(error, CallError::Unavailable { .. }));
    }
}
