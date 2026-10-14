//! The installed quaternal-logic's music readings, each an owner read: the mode
//! catalogue (`ql music modes --json`, schema `ql.music-modes/v1`, QL-MEF PR #330)
//! and the Jankó surface window (`ql music janko window --json`, schema
//! `ql.janko-surface/v1`). The kernel names
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
pub const JANKO_SCHEMA: &str = "ql.janko-surface/v1";
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

/// The owner's Jankó surface window, verbatim, once confirmed as `ql.janko-surface/v1`.
/// Each argument the caller leaves out is the owner's own default.
pub fn read_janko_window(
    lens: Option<u8>,
    first_column: Option<u16>,
    columns: Option<u16>,
) -> Result<Value, String> {
    if lens.is_some_and(|lens| lens > 11) {
        return Err("ql-music.refused: a Jankó lens is 0..=11".into());
    }
    if columns.is_some_and(|columns| columns == 0 || columns > 24) {
        return Err("ql-music.refused: a Jankó window is 1..=24 columns".into());
    }
    let executable = InstalledQl::discover()?
        .executable
        .map_err(|why| format!("ql-music.unavailable: {why}"))?;
    read_reading(
        &executable,
        &[],
        &janko_window_args(lens, first_column, columns),
        JANKO_SCHEMA,
    )
}

fn janko_window_args(
    lens: Option<u8>,
    first_column: Option<u16>,
    columns: Option<u16>,
) -> Vec<String> {
    let mut args: Vec<String> = ["music", "janko", "window"].map(String::from).to_vec();
    if let Some(columns) = columns {
        args.extend(["--columns".into(), columns.to_string()]);
    }
    if let Some(first) = first_column {
        args.extend(["--first-column".into(), first.to_string()]);
    }
    if let Some(lens) = lens {
        args.extend(["--lens".into(), lens.to_string()]);
    }
    args.push("--json".into());
    args
}

/// Run `<program> <leading…> music modes --json`, bounded, and return its catalogue.
/// `leading` lets a test stand a shell in for the installed product; production
/// passes nothing.
pub(crate) fn read_with(program: &Path, leading: &[&str]) -> Result<Value, String> {
    let subcommand: Vec<String> = SUBCOMMAND.map(String::from).to_vec();
    read_reading(program, leading, &subcommand, SCHEMA)
}

/// Run `<program> <leading…> <subcommand…>`, bounded with no input, and return the
/// owner's document once it is JSON of `schema`.
fn read_reading(
    program: &Path,
    leading: &[&str],
    subcommand: &[String],
    schema: &str,
) -> Result<Value, String> {
    let shown = format!("ql {}", subcommand.join(" "));
    let mut child = Command::new(program)
        .args(leading)
        .args(subcommand)
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
                // A reading over the cap stops being read, so the child blocks on its pipe until the deadline: name the cap, not the clock.
                if let Ok(Err(over)) = stdout.try_recv() {
                    return Err(over);
                }
                return Err(format!(
                    "ql-music.unavailable: `{shown}` exceeded 30 seconds"
                ));
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
        .map_err(|e| format!("ql-music.unavailable: `{shown}` output was not read: {e}"))??;
    let err = stderr
        .recv_timeout(Duration::from_secs(2))
        .map_err(|e| format!("ql-music.unavailable: `{shown}` errors were not read: {e}"))??;
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
            "ql-music.unsupported: the installed quaternal-logic at {} has no `{}` reading (exit {exit}): {first}",
            program.display(),
            subcommand.join(" ")
        ));
    }
    let value: Value = serde_json::from_slice(&out)
        .map_err(|e| format!("ql-music.refused: `{shown}` is not JSON: {e}"))?;
    if value["schema"] != schema {
        return Err(format!(
            "ql-music.refused: `{shown}` is not a {schema} reading (schema {})",
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
            .map_err(|e| format!("ql-music.unavailable: {e}"))
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
    fn the_janko_window_passes_the_owner_arguments_and_confirms_its_schema() {
        assert_eq!(
            janko_window_args(Some(3), Some(2), Some(14)),
            [
                "music",
                "janko",
                "window",
                "--columns",
                "14",
                "--first-column",
                "2",
                "--lens",
                "3",
                "--json"
            ]
        );
        assert_eq!(
            janko_window_args(None, None, None),
            ["music", "janko", "window", "--json"]
        );
        // The stand-in echoes its arguments into the document, so the call is seen whole.
        let value = read_reading(
            Path::new("/bin/sh"),
            &[
                "-c",
                r#"printf '{"schema":"ql.janko-surface/v1","args":"%s"}' "$*""#,
                "ql",
            ],
            &janko_window_args(Some(5), None, None),
            JANKO_SCHEMA,
        )
        .expect("a conforming window is served");
        assert_eq!(value["args"], "music janko window --lens 5 --json");
        let err = read_reading(
            Path::new("/bin/sh"),
            &[
                "-c",
                r#"printf '%s' '{"schema":"ql.music-modes/v1"}'"#,
                "ql",
            ],
            &janko_window_args(None, None, None),
            JANKO_SCHEMA,
        )
        .expect_err("another schema is refused");
        assert!(
            err.contains("`ql music janko window --json` is not a ql.janko-surface/v1 reading"),
            "{err}"
        );
        assert!(read_janko_window(None, None, Some(25))
            .unwrap_err()
            .contains("1..=24"));
        assert!(read_janko_window(Some(12), None, None)
            .unwrap_err()
            .contains("0..=11"));
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
        let op: KernelOp = serde_json::from_value(json!({"op": "janko_window_read", "lens": 4}))
            .expect("the window op is registered");
        assert_eq!(
            op,
            KernelOp::JankoWindowRead {
                lens: Some(4),
                first_column: None,
                columns: None
            }
        );
        let bare: KernelOp = serde_json::from_value(json!({"op": "janko_window_read"}))
            .expect("every window argument is optional");
        assert_eq!(
            bare,
            KernelOp::JankoWindowRead {
                lens: None,
                first_column: None,
                columns: None
            }
        );
        let outcome = serde_json::to_value(KernelOpResult::JankoWindowReading {
            document: json!({"schema": JANKO_SCHEMA}),
        })
        .expect("the window result serialises");
        assert_eq!(outcome["result"], "janko_window_reading");
    }
}
