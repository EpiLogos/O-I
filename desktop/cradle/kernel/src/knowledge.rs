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
    run_with_executable(cwd, args, &executable)
}

/// Structured input goes on stdin, never shell-expanded argv or a temp source file.
pub fn run_input(cwd: &Path, args: &[&str], input: &Value) -> Result<Value, CallError> {
    use std::io::Write;
    use std::process::Stdio;
    let bytes = serde_json::to_vec(input).map_err(|e| CallError::Malformed {
        detail: e.to_string(),
    })?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err(CallError::Malformed {
            detail: "Native Action exceeds its 16 MiB input budget".into(),
        });
    }
    let executable = std::env::var_os("OI_BIN").unwrap_or_else(|| "oi".into());
    let mut child = Command::new(executable)
        .args(["aikit", "--json", "-C"])
        .arg(cwd)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| CallError::Unavailable {
            detail: e.to_string(),
        })?;
    let write = child
        .stdin
        .take()
        .ok_or_else(|| CallError::Malformed {
            detail: "Native Action stdin is absent".into(),
        })?
        .write_all(&bytes);
    if let Err(e) = write {
        let _ = child.kill();
        let _ = child.wait();
        return Err(CallError::Malformed {
            detail: e.to_string(),
        });
    }
    decode_envelope(&child.wait_with_output().map_err(|e| CallError::Malformed {
        detail: e.to_string(),
    })?)
}

fn run_with_executable(cwd: &Path, args: &[&str], executable: &OsStr) -> Result<Value, CallError> {
    let mut command = Command::new(executable);
    command.args(["aikit", "--json", "-C"]).arg(cwd).args(args);
    let output = bounded_output(command, std::time::Duration::from_secs(20))?;
    decode_envelope(&output)
}

// Read-only owner processes have a bounded lifetime and output. A stalled
// source must not strand the desktop or leave an indexing descendant behind.
fn bounded_output(
    mut command: Command,
    timeout: std::time::Duration,
) -> Result<std::process::Output, CallError> {
    use std::{
        io::Read,
        process::Stdio,
        sync::{
            atomic::{AtomicBool, Ordering},
            mpsc, Arc,
        },
        time::Instant,
    };
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| CallError::Unavailable {
            detail: e.to_string(),
        })?;
    let exceeded = Arc::new(AtomicBool::new(false));
    fn drain<R: Read + Send + 'static>(
        mut pipe: R,
        limit: usize,
        exceeded: Arc<AtomicBool>,
    ) -> mpsc::Receiver<Result<Vec<u8>, String>> {
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut bytes = Vec::new();
            let mut buf = [0u8; 8192];
            let result = loop {
                match pipe.read(&mut buf) {
                    Ok(0) => break Ok(bytes),
                    Ok(n) => {
                        let keep = n.min(limit.saturating_sub(bytes.len()));
                        bytes.extend_from_slice(&buf[..keep]);
                        if keep < n {
                            exceeded.store(true, Ordering::Relaxed);
                        }
                    }
                    Err(e) => break Err(e.to_string()),
                }
            };
            let _ = tx.send(result);
        });
        rx
    }
    let stdout = drain(
        child.stdout.take().expect("piped stdout"),
        8 * 1024 * 1024,
        exceeded.clone(),
    );
    let stderr = drain(
        child.stderr.take().expect("piped stderr"),
        64 * 1024,
        exceeded.clone(),
    );
    let started = Instant::now();
    let mut status = None;
    let mut out = None;
    let mut err = None;
    loop {
        if status.is_none() {
            status = child.try_wait().map_err(|e| CallError::Malformed {
                detail: e.to_string(),
            })?;
        }
        if out.is_none() {
            out = stdout.try_recv().ok();
        }
        if err.is_none() {
            err = stderr.try_recv().ok();
        }
        if exceeded.load(Ordering::Relaxed) || started.elapsed() >= timeout {
            #[cfg(unix)]
            {
                let _ = Command::new("/bin/kill")
                    .args(["-KILL", "--", &format!("-{}", child.id())])
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status();
            }
            let _ = child.kill();
            let _ = child.wait();
            return Err(CallError::Unavailable {
                detail: if exceeded.load(Ordering::Relaxed) {
                    "AIKit knowledge response exceeded its bounded output".into()
                } else {
                    format!(
                        "AIKit knowledge read did not return within {} seconds",
                        timeout.as_secs()
                    )
                },
            });
        }
        if let (Some(_), Some(_), Some(_)) = (&status, &out, &err) {
            return Ok(std::process::Output {
                status: status.take().unwrap(),
                stdout: out
                    .take()
                    .unwrap()
                    .map_err(|detail| CallError::Malformed { detail })?,
                stderr: err
                    .take()
                    .unwrap()
                    .map_err(|detail| CallError::Malformed { detail })?,
            });
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
}

fn decode_envelope(output: &std::process::Output) -> Result<Value, CallError> {
    if !output.status.success() && output.stdout.iter().all(u8::is_ascii_whitespace) {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if detail.is_empty() {
            CallError::Malformed {
                detail: format!("AIKit knowledge operation failed ({})", output.status),
            }
        } else {
            CallError::Malformed {
                detail: format!(
                    "AIKit knowledge operation failed ({}): {detail}",
                    output.status
                ),
            }
        });
    }
    let envelope: Value =
        serde_json::from_slice(&output.stdout).map_err(|e| CallError::Malformed {
            detail: format!(
                "AIKit returned an unreadable response ({e}): {}",
                String::from_utf8_lossy(&output.stderr)
            ),
        })?;
    if !output.status.success() || envelope["ok"] != true {
        return Err(CallError::Refused {
            message: envelope["error"]["message"]
                .as_str()
                .unwrap_or("AIKit refused this knowledge operation")
                .to_owned(),
        });
    }
    envelope
        .get("data")
        .cloned()
        .ok_or_else(|| CallError::Malformed {
            detail: "AIKit response is missing its reading".into(),
        })
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
    run(cwd, &args.iter().map(String::as_str).collect::<Vec<_>>()).map_err(|error| match error {
        CallError::Unavailable { detail } => format!("AIKit is unavailable: {detail}"),
        CallError::Refused { message } => message,
        CallError::Malformed { detail } => detail,
    })
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
        let mut command=Command::new("/bin/sh");command.args(["-c","sleep 30 & wait"]);
        let start=std::time::Instant::now();
        let error=bounded_output(command,std::time::Duration::from_millis(100)).unwrap_err();
        assert!(matches!(error,CallError::Unavailable{..}));
        assert!(start.elapsed()<std::time::Duration::from_secs(2));
    }
    #[cfg(unix)]
    #[test]
    fn native_read_bounds_a_real_process_output_stream() {
        let mut command=Command::new("/usr/bin/yes");command.arg("bounded read");
        let start=std::time::Instant::now();
        let error=bounded_output(command,std::time::Duration::from_secs(5)).unwrap_err();
        assert!(matches!(error,CallError::Unavailable{detail} if detail.contains("bounded output")));
        assert!(start.elapsed()<std::time::Duration::from_secs(5));
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

    #[cfg(unix)]
    #[test]
    fn actual_process_argv_preserves_queries_and_root_or_child_context() {
        use std::{
            fs,
            os::unix::fs::PermissionsExt,
            path::PathBuf,
            time::{SystemTime, UNIX_EPOCH},
        };
        struct Scratch(PathBuf);
        impl Drop for Scratch {
            fn drop(&mut self) {
                let _ = fs::remove_dir_all(&self.0);
            }
        }
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let scratch = Scratch(
            std::env::temp_dir().join(format!("oi search argv {} {nonce}", std::process::id())),
        );
        fs::create_dir_all(&scratch.0).unwrap();
        let executable = scratch.0.join("oi argv witness");
        // This transport witness observes argv; it never evaluates the query.
        fs::write(&executable, "#!/usr/bin/env python3\nimport json, sys\nprint(json.dumps({'ok': True, 'data': sys.argv[1:]}))\n").unwrap();
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o700)).unwrap();
        crate::test_stub::settle_stub(&executable);
        for cwd in [
            scratch.0.join("Central"),
            scratch.0.join("Central/Work/My Project"),
        ] {
            fs::create_dir_all(&cwd).unwrap();
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
                    let reading = run_with_executable(
                        &cwd,
                        &args.iter().map(String::as_str).collect::<Vec<_>>(),
                        executable.as_os_str(),
                    )
                    .unwrap();
                    let mut expected = vec![
                        "aikit".to_owned(),
                        "--json".to_owned(),
                        "-C".to_owned(),
                        cwd.to_str().unwrap().to_owned(),
                    ];
                    expected.extend(args);
                    assert_eq!(reading, serde_json::json!(expected), "{}", case.name);
                }
            }
        }
    }
}
