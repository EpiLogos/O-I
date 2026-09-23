//! World inhabitation reads (docs/contracts/WORLD-INHABITATION-V1.md §4): the
//! AIKit joined readings the Cradle's Agents / Run / Context apertures consume.
//!
//! - `aikit gateway who [--project-world W] --json` → `aikit.population-reading/v1`
//! - `aikit whoami [--position P] --full --json`   → `aikit.inhabitation-reading/v1`
//! - `aikit refocus [--position P] --json`         → `aikit.refocus-reading/v1`
//!
//! The desktop holds no topology of its own: every Position, occupancy and
//! work fact it shows is one of these owner documents, carried verbatim after
//! its schema is checked. A read that fails, stalls or answers another schema
//! is an `Error` the renderer names as an absence — never an empty roster and
//! never a guessed occupant.
//!
//! The desktop is not an occupant. It never forwards `OI_POSITION_REF` or
//! `OI_OCCUPANT_GENERATION` from its own environment (a Cradle launched from
//! inside an agent body would otherwise answer as that body); a Position is
//! named only by the explicit `--position` the person chose.
use crate::material::Error;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::ffi::OsString;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// One inhabitation read. `project` is the Central project NAME in scope; the
/// kernel resolves its canonical ProjectRef and working directory from
/// Central's own disclosure (never from the caller).
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Request {
    /// Who is here: every Position of the Project World with its occupancy
    /// and current-work outcome.
    Population {
        #[serde(default)]
        project: Option<String>,
    },
    /// The joined reading for one Position (facets with their states).
    Whoami {
        #[serde(default)]
        project: Option<String>,
        #[serde(default)]
        position: Option<String>,
    },
    /// The nested prepared-context basis for one Position.
    Refocus {
        #[serde(default)]
        project: Option<String>,
        #[serde(default)]
        position: Option<String>,
    },
}

impl Request {
    pub fn project(&self) -> Option<&str> {
        match self {
            Request::Population { project } | Request::Whoami { project, .. } | Request::Refocus { project, .. } => project.as_deref(),
        }
    }
    /// The schema the owner must answer with.
    pub fn schema(&self) -> &'static str {
        match self {
            Request::Population { .. } => "aikit.population-reading/v1",
            Request::Whoami { .. } => "aikit.inhabitation-reading/v1",
            Request::Refocus { .. } => "aikit.refocus-reading/v1",
        }
    }
    /// The owner command in plain words — the `source` an absence names.
    pub fn source(&self) -> &'static str {
        match self {
            Request::Population { .. } => "aikit gateway who",
            Request::Whoami { .. } => "aikit whoami",
            Request::Refocus { .. } => "aikit refocus",
        }
    }
}

/// The AIKit executable and whether the suite route prefixes `aikit`: the
/// same resolution the Factory arms use — `$OI_AIKIT_BIN` direct, else the
/// suite executable (`$OI_BIN`, else `oi`) with the product namespace.
pub fn aikit_executable() -> (PathBuf, bool) {
    match std::env::var_os("OI_AIKIT_BIN").map(PathBuf::from) {
        Some(path) => (path, false),
        None => (std::env::var_os("OI_BIN").map(PathBuf::from).unwrap_or_else(|| "oi".into()), true),
    }
}

/// The owner's argument grammar for one read. `project_world_ref` is the
/// canonical `project:<project_id>` Central disclosed for the scope.
pub fn aikit_args(request: &Request, project_world_ref: Option<&str>, suite_route: bool) -> Vec<OsString> {
    let mut args: Vec<OsString> = Vec::new();
    if suite_route {
        args.push("aikit".into());
    }
    match request {
        Request::Population { .. } => {
            args.extend(["gateway".into(), "who".into()]);
            if let Some(world) = project_world_ref {
                args.extend(["--project-world".into(), world.into()]);
            }
        }
        Request::Whoami { position, .. } => {
            args.push("whoami".into());
            if let Some(position) = position {
                args.extend(["--position".into(), position.into()]);
            }
            args.push("--full".into());
        }
        Request::Refocus { position, .. } => {
            args.push("refocus".into());
            if let Some(position) = position {
                args.extend(["--position".into(), position.into()]);
            }
        }
    }
    args.push("--json".into());
    args
}

/// AIKit's `--json` envelope (`{ok, schema, context, data, warnings}`) →
/// the reading and the envelope's warnings. `ok: false` is the owner's
/// refusal, in its own words, whatever the exit status. A document without
/// the envelope is the reading itself (no warnings).
pub fn unwrap_envelope(document: Value, source: &str) -> Result<(Value, Vec<Value>), Error> {
    let enveloped = document.get("ok").is_some_and(Value::is_boolean) && document.get("data").is_some();
    if !enveloped {
        return Ok((document, Vec::new()));
    }
    if document.get("ok") != Some(&Value::Bool(true)) {
        let stdout = serde_json::to_vec(&document).unwrap_or_default();
        return Err(Error { kind: "owner-refused-or-failed".into(), message: refusal_words(&stdout, b""), operation_may_have_run: false });
    }
    let warnings = document.get("warnings").and_then(Value::as_array).cloned().unwrap_or_default();
    let data = document.get("data").cloned().unwrap_or(Value::Null);
    if data.is_null() {
        return Err(Error { kind: "incompatible".into(), message: format!("{source} answered ok without a reading"), operation_may_have_run: false });
    }
    Ok((data, warnings))
}

/// Serve one read. `ground` is the working directory and canonical Project
/// World ref Central disclosed for the scope (`None` when Central's world
/// could not be read for a root-scope read: AIKit then resolves its own).
/// Returns the reading (the envelope's `data`, verbatim) and its warnings.
pub fn read(request: &Request, ground: Option<(&Path, Option<&str>)>) -> Result<(Value, Vec<Value>), Error> {
    let (executable, suite_route) = aikit_executable();
    let args = aikit_args(request, ground.and_then(|(_, world)| world), suite_route);
    let document = run_bounded(&executable, &args, ground.map(|(cwd, _)| cwd), crate::factory::inhabitation_read_timeout(), request.source())?;
    let (data, warnings) = unwrap_envelope(document, request.source())?;
    let schema = data.get("schema").or_else(|| data.get("contract")).and_then(Value::as_str).unwrap_or_default();
    if schema != request.schema() {
        return Err(Error {
            kind: "incompatible".into(),
            message: format!("{} answered an unexpected reading ({schema}) where {} was asked for", request.source(), request.schema()),
            operation_may_have_run: false,
        });
    }
    Ok((data, warnings))
}

/// Drain a stream keeping at most 8 MiB, so a producer never blocks on a full
/// pipe and the desktop never accumulates unbounded output.
fn drain(mut reader: impl Read) -> (Vec<u8>, bool) {
    let mut kept = Vec::new();
    let mut chunk = [0u8; 8192];
    let mut exceeded = false;
    while let Ok(n) = reader.read(&mut chunk) {
        if n == 0 {
            break;
        }
        let room = (8 * 1024 * 1024usize).saturating_sub(kept.len());
        kept.extend_from_slice(&chunk[..n.min(room)]);
        exceeded |= n > room;
    }
    (kept, exceeded)
}

/// The owner's refusal in its own words: the three-part `{fact, consequence,
/// action}` refusal (WORLD-INHABITATION-V1, OpenRig's convention) when the
/// owner wrote one on stdout, else its `error.message`, else stderr.
fn refusal_words(stdout: &[u8], stderr: &[u8]) -> String {
    if let Ok(value) = serde_json::from_slice::<Value>(stdout) {
        let refusal = value.get("error").filter(|e| e.is_object()).unwrap_or(&value);
        let parts: Vec<&str> = ["fact", "consequence", "action"].iter().filter_map(|key| refusal.get(*key).and_then(Value::as_str)).collect();
        if !parts.is_empty() {
            return parts.join(" ");
        }
        if let Some(message) = refusal.get("message").and_then(Value::as_str) {
            return message.to_owned();
        }
    }
    // The refusal paragraph only: a CLI parser appends its usage help after
    // a blank line, which is not the owner's answer to this read.
    let stderr = String::from_utf8_lossy(stderr);
    let words = stderr.trim().split("\n\n").next().unwrap_or_default().trim().to_owned();
    if words.is_empty() {
        "the owner refused without words".into()
    } else {
        words
    }
}

/// Run one read-only owner command with a deadline. Spawn failure and
/// timeout are `unavailable`/`timeout` (the owner could not answer); a
/// non-zero exit is the owner's refusal in its own words; unparsable output
/// is `incompatible`. Reads never mutate, so `operation_may_have_run` is false.
pub(crate) fn run_bounded(executable: &Path, args: &[OsString], cwd: Option<&Path>, timeout: Duration, source: &str) -> Result<Value, Error> {
    let fail = |kind: &str, message: String| Error { kind: kind.into(), message, operation_may_have_run: false };
    let mut command = Command::new(executable);
    command
        .args(args)
        .env_remove("OI_POSITION_REF")
        .env_remove("OI_OCCUPANT_GENERATION")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }
    let mut child = command.spawn().map_err(|e| fail("unavailable", format!("{source} could not start ({}): {e}", executable.display())))?;
    let stdout = child.stdout.take().expect("stdout is piped");
    let stderr = child.stderr.take().expect("stderr is piped");
    let out = std::thread::spawn(move || drain(stdout));
    let err = std::thread::spawn(move || drain(stderr));
    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(fail("timeout", format!("{source} did not answer within {} ms", timeout.as_millis())));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            Err(e) => return Err(fail("process-error", format!("{source}: {e}"))),
        }
    };
    let (stdout, out_exceeded) = out.join().unwrap_or_default();
    let (stderr, err_exceeded) = err.join().unwrap_or_default();
    if out_exceeded || err_exceeded {
        return Err(fail("resource-limit", format!("{source} answered more than 8 MiB")));
    }
    if !status.success() {
        return Err(fail("owner-refused-or-failed", refusal_words(&stdout, &stderr)));
    }
    serde_json::from_slice(&stdout).map_err(|e| fail("incompatible", format!("{source} answered without a JSON document: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn words(args: Vec<OsString>) -> Vec<String> {
        args.into_iter().map(|a| a.to_string_lossy().into_owned()).collect()
    }

    #[test]
    fn the_owner_grammar_for_each_read() {
        let population = Request::Population { project: Some("O-I".into()) };
        assert_eq!(words(aikit_args(&population, Some("project:O-I"), false)), ["gateway", "who", "--project-world", "project:O-I", "--json"]);
        assert_eq!(words(aikit_args(&population, None, true)), ["aikit", "gateway", "who", "--json"]);
        let whoami = Request::Whoami { project: None, position: Some("central:position:project:O-I:factory-guardian".into()) };
        assert_eq!(words(aikit_args(&whoami, Some("project:O-I"), false)), ["whoami", "--position", "central:position:project:O-I:factory-guardian", "--full", "--json"]);
        let refocus = Request::Refocus { project: None, position: None };
        assert_eq!(words(aikit_args(&refocus, None, true)), ["aikit", "refocus", "--json"]);
        assert_eq!(population.schema(), "aikit.population-reading/v1");
        assert_eq!(whoami.schema(), "aikit.inhabitation-reading/v1");
        assert_eq!(refocus.schema(), "aikit.refocus-reading/v1");
    }

    #[test]
    fn refusals_are_the_owners_three_part_words() {
        let stdout = br#"{"error":{"code":"position.not_found","fact":"No Position @x in project:O-I.","consequence":"Nothing was read.","action":"Run aikit gateway who."}}"#;
        assert_eq!(refusal_words(stdout, b""), "No Position @x in project:O-I. Nothing was read. Run aikit gateway who.");
        assert_eq!(refusal_words(b"", b"error: unrecognized subcommand 'whoami'\n"), "error: unrecognized subcommand 'whoami'");
        assert_eq!(
            refusal_words(b"", b"error: unrecognized subcommand 'who'\n\nUsage: aikit gateway [OPTIONS] <COMMAND>\n\nFor more information, try '--help'.\n"),
            "error: unrecognized subcommand 'who'",
            "the parser's usage trailer is not the refusal"
        );
        assert_eq!(refusal_words(br#"{"error":{"message":"refused"}}"#, b""), "refused");
    }

    #[test]
    fn the_aikit_envelope_is_unwrapped_and_its_refusal_named() {
        let ok = serde_json::json!({"ok": true, "schema": 1, "context": {}, "data": {"schema": "aikit.population-reading/v1", "positions": []}, "warnings": [{"code": "w", "message": "stale"}]});
        let (data, warnings) = unwrap_envelope(ok, "aikit gateway who").unwrap();
        assert_eq!(data["schema"], "aikit.population-reading/v1");
        assert_eq!(warnings.len(), 1);
        let refused = serde_json::json!({"ok": false, "schema": 1, "data": null, "error": {"code": "x", "fact": "No World here.", "consequence": "Nothing was read.", "action": "Run ctrl central.world."}});
        let error = unwrap_envelope(refused, "aikit whoami").unwrap_err();
        assert_eq!(error.kind, "owner-refused-or-failed");
        assert_eq!(error.message, "No World here. Nothing was read. Run ctrl central.world.");
        let bare = serde_json::json!({"schema": "aikit.refocus-reading/v1"});
        assert_eq!(unwrap_envelope(bare.clone(), "aikit refocus").unwrap(), (bare, Vec::new()), "a bare reading passes as itself");
        assert_eq!(unwrap_envelope(serde_json::json!({"ok": true, "data": null}), "aikit refocus").unwrap_err().kind, "incompatible");
    }

    #[test]
    fn requests_deserialise_from_the_desktop_wire() {
        let request: Request = serde_json::from_value(serde_json::json!({"kind": "population", "project": "O-I"})).unwrap();
        assert_eq!(request.project(), Some("O-I"));
        let request: Request = serde_json::from_value(serde_json::json!({"kind": "whoami", "position": "p"})).unwrap();
        assert!(matches!(request, Request::Whoami { position: Some(_), project: None }));
        let request: Request = serde_json::from_value(serde_json::json!({"kind": "refocus"})).unwrap();
        assert_eq!(request.source(), "aikit refocus");
    }
}
