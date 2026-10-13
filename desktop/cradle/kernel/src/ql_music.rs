//! The installed quaternal-logic's mode catalogue: `ql music modes --json`,
//! schema `ql.music-modes/v1` (QL-MEF PR #330). An owner read. The kernel names
//! the installed executable through the same discovery the field host uses, runs
//! it bounded with no input, confirms the schema, and passes the owner's document
//! through unmodified. The webview never runs ql. Each refusal names what is
//! missing: ql absent, an older ql without the subcommand, a reading that is not
//! JSON, or a reading that is not ql.music-modes/v1.
use crate::native_expression::InstalledQl;
use serde_json::Value;
use std::{
    io::Read,
    path::Path,
    process::{Command, Stdio},
    sync::mpsc,
    time::{Duration, Instant},
};

pub const SCHEMA: &str = "ql.music-modes/v1";
const SUBCOMMAND: [&str; 3] = ["music", "modes", "--json"];
const DEADLINE: Duration = Duration::from_secs(30);
const MAX_OUTPUT: u64 = 16 * 1024 * 1024;

/// The owner's catalogue document, verbatim, once confirmed as `ql.music-modes/v1`.
pub fn read_modes() -> Result<Value, String> {
    let executable = InstalledQl::discover()?
        .executable
        .map_err(|why| format!("ql-music.unavailable: {why}"))?;
    read_with(&executable, &[])
}

/// Run `<program> <leading…> music modes --json`, bounded, and return its catalogue.
/// `leading` lets a test stand a shell in for the installed product; production
/// passes nothing.
pub(crate) fn read_with(program: &Path, leading: &[&str]) -> Result<Value, String> {
    let mut child = Command::new(program)
        .args(leading)
        .args(SUBCOMMAND)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "ql-music.unavailable: quaternal-logic cannot run at {}: {e}",
                program.display()
            )
        })?;
    let stdout = reader(
        child
            .stdout
            .take()
            .ok_or("ql-music.unavailable: stdout unavailable")?,
    );
    let stderr = reader(
        child
            .stderr
            .take()
            .ok_or("ql-music.unavailable: stderr unavailable")?,
    );
    let deadline = Instant::now() + DEADLINE;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(10)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(
                    "ql-music.unavailable: `ql music modes --json` exceeded 30 seconds".into(),
                );
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("ql-music.unavailable: {e}"));
            }
        }
    };
    let out = stdout
        .recv_timeout(Duration::from_secs(2))
        .map_err(|e| e.to_string())??;
    let err = stderr
        .recv_timeout(Duration::from_secs(2))
        .map_err(|e| e.to_string())??;
    if !status.success() {
        let stderr_text = String::from_utf8_lossy(&err);
        let first = stderr_text
            .lines()
            .find(|line| !line.trim().is_empty())
            .unwrap_or("no message")
            .trim();
        let exit = status
            .code()
            .map_or_else(|| "signal".to_string(), |code| code.to_string());
        return Err(format!(
            "ql-music.unsupported: the installed quaternal-logic at {} has no `music modes --json` reading (exit {exit}): {first}",
            program.display()
        ));
    }
    let value: Value = serde_json::from_slice(&out)
        .map_err(|e| format!("ql-music.refused: `ql music modes --json` is not JSON: {e}"))?;
    if value["schema"] != SCHEMA {
        return Err(format!(
            "ql-music.refused: `ql music modes --json` is not a {SCHEMA} reading (schema {})",
            value["schema"]
        ));
    }
    Ok(value)
}

fn reader<R: Read + Send + 'static>(pipe: R) -> mpsc::Receiver<Result<Vec<u8>, String>> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let result = pipe
            .take(MAX_OUTPUT + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())
            .and_then(|_| {
                if bytes.len() as u64 > MAX_OUTPUT {
                    Err("ql-music.refused: output exceeds 16 MiB".into())
                } else {
                    Ok(bytes)
                }
            });
        let _ = tx.send(result);
    });
    rx
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::{KernelOp, KernelOpResult};
    use serde_json::json;

    /// A shell stands in for the installed product: the script sees the
    /// subcommand as positional arguments and ignores them.
    fn stand_in(script: &str) -> Result<Value, String> {
        read_with(Path::new("/bin/sh"), &["-c", script, "ql"])
    }

    #[test]
    fn the_owner_document_passes_through_unmodified() {
        let value = stand_in(
            r#"printf '%s' '{"schema":"ql.music-modes/v1","bases":[],"lens_cf":[{"key":"k"}]}'"#,
        )
        .expect("a conforming reading is served");
        assert_eq!(value["schema"], SCHEMA);
        assert_eq!(value["lens_cf"][0]["key"], "k");
    }

    #[test]
    fn an_older_ql_without_the_subcommand_is_named() {
        let err = stand_in(r#"echo "error: unrecognized subcommand 'music'" >&2; exit 2"#)
            .expect_err("an older ql is refused");
        assert!(err.starts_with("ql-music.unsupported:"), "{err}");
        assert!(err.contains("has no `music modes --json` reading"), "{err}");
        assert!(err.contains("(exit 2)"), "{err}");
        assert!(err.contains("unrecognized subcommand 'music'"), "{err}");
    }

    #[test]
    fn a_reading_that_is_not_the_schema_is_refused() {
        let err = stand_in(r#"printf '%s' '{"schema":"ql.music-modes/v2"}'"#)
            .expect_err("a wrong schema is refused");
        assert!(err.contains("is not a ql.music-modes/v1 reading"), "{err}");
        assert!(err.contains("ql.music-modes/v2"), "{err}");
    }

    #[test]
    fn a_non_json_reading_is_refused() {
        let err = stand_in("printf 'not json'").expect_err("non-JSON is refused");
        assert!(err.contains("is not JSON"), "{err}");
    }

    #[test]
    fn an_executable_that_cannot_run_is_named() {
        let err = read_with(Path::new("/nonexistent/quaternal-logic/ql"), &[])
            .expect_err("an absent executable is refused");
        assert!(err.starts_with("ql-music.unavailable:"), "{err}");
        assert!(
            err.contains("cannot run at /nonexistent/quaternal-logic/ql"),
            "{err}"
        );
    }

    #[test]
    fn the_op_and_its_result_carry_their_snake_case_names() {
        let op: KernelOp = serde_json::from_value(json!({"op": "music_modes_read"}))
            .expect("the op is registered");
        assert_eq!(op, KernelOp::MusicModesRead);
        let outcome = serde_json::to_value(KernelOpResult::MusicModesReading {
            document: json!({"schema": SCHEMA}),
        })
        .expect("the result serialises");
        assert_eq!(outcome["result"], "music_modes_reading");
        assert_eq!(outcome["document"]["schema"], SCHEMA);
    }
}
