//! The agents census (docs/architecture/world-shell.md §9.2; O-I #1001, #1003): which agents a person can talk to on this machine.
//!
//! One list, made one way. Its rows are Actuation's detection (`actuation harness detect --json`, read through
//! `ActuationRead::HarnessDetect`): every harness the catalogue finds detected, with the executable its probe found. Each such
//! harness is started once (`<executable> --version`, bounded) and its row says whether it started and what it answered, or why
//! not. AIKit adds detail to a row (`aikit --json client status`: its config directory and whether it exists, its gaps) and never a row of its own: a harness AIKit names that Actuation does not detect is not an agent here.
//!
//! The World Model holds the census as its `agents` slice (world_model.rs); nothing else lists agents.
use crate::{KernelOp, KernelOpOutcome};
use serde_json::{json, Map, Value};
use std::path::Path;
use std::process::Stdio;
use std::time::{Duration, Instant};

/// The schema of the census reading.
pub const SCHEMA: &str = "oi.agents-census/v1";

/// How long one agent is given to answer `--version`. A harness that does not answer within it is listed as not starting, with
/// the limit as its reason.
pub const START_LIMIT: Duration = Duration::from_secs(20);

/// The census, read through `via` (the kernel's own dispatch): Actuation's detection, a start probe of each detected harness,
/// and AIKit's detail. An unreadable detection refuses the whole census in Actuation's words; AIKit's detail missing leaves each
/// row without it and says why.
pub fn read(via: &dyn Fn(KernelOp) -> Result<KernelOpOutcome, String>) -> Result<Value, String> {
    let detection = owner_route_data(via(op(
        json!({"op": "actuation_read", "request": {"kind": "harness-detect"}}),
    )?)?)?
    .map_err(|why| format!("Actuation's harness detection: {why}"))?;
    let aikit = via(op(json!({"op": "harness_status"}))?).and_then(data);
    let (clients, aikit_why) = match aikit {
        Ok(data) => (
            data["clients"].as_array().cloned().unwrap_or_default(),
            None,
        ),
        Err(why) => (Vec::new(), Some(why)),
    };
    Ok(census_of(&detection, &clients, aikit_why, probe))
}

/// The census from Actuation's detection and AIKit's client rows, each detected harness started through `start`. Pure but for
/// `start`; the probes run side by side.
pub fn census_of(
    detection: &Value,
    clients: &[Value],
    aikit_why: Option<String>,
    start: fn(&Path) -> Started,
) -> Value {
    let rows = detection["harnesses"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let candidates: Vec<(Value, Option<String>)> = rows
        .into_iter()
        .map(|row| {
            let executable = executable_of(&row);
            (row, executable)
        })
        .collect();
    let started: Vec<Option<Started>> = std::thread::scope(|scope| {
        let probes: Vec<_> = candidates
            .iter()
            .map(|(row, executable)| {
                let wanted = row["native_kind"] == "harness" && row["state"] == "detected";
                let executable = executable.clone().filter(|_| wanted);
                scope.spawn(move || executable.map(|program| start(Path::new(&program))))
            })
            .collect();
        probes
            .into_iter()
            .map(|probe| probe.join().unwrap_or(None))
            .collect()
    });
    let mut agents = Vec::new();
    let mut not_agents = Vec::new();
    for ((row, executable), started) in candidates.into_iter().zip(started) {
        let slug = row["slug"].as_str().unwrap_or_default().to_owned();
        let detail = clients
            .iter()
            .find(|client| client_names(client, &slug))
            .cloned();
        let mut entry = Map::new();
        entry.insert("slug".into(), slug.clone().into());
        entry.insert("harness_ref".into(), row["harness_ref"].clone());
        entry.insert("native_kind".into(), row["native_kind"].clone());
        entry.insert("state".into(), row["state"].clone());
        entry.insert(
            "executable".into(),
            executable.clone().map_or(Value::Null, Value::from),
        );
        entry.insert("aikit".into(), detail.unwrap_or(Value::Null));
        match started {
            Some(Started::Answered { words, seconds }) => {
                entry.insert("starts".into(), true.into());
                entry.insert("version".into(), words.into());
                entry.insert("start_seconds".into(), seconds.into());
                agents.push(Value::Object(entry));
            }
            Some(Started::Refused { why }) => {
                entry.insert("starts".into(), false.into());
                entry.insert("why".into(), why.into());
                agents.push(Value::Object(entry));
            }
            None => {
                let why = if row["native_kind"] != "harness" {
                    format!(
                        "Actuation lists {slug} as a {}, not an agent harness",
                        row["native_kind"].as_str().unwrap_or("non-harness")
                    )
                } else if row["state"] != "detected" {
                    format!(
                        "Actuation does not detect {slug} on this machine ({})",
                        row["state"].as_str().unwrap_or("absent")
                    )
                } else {
                    format!("Actuation detects {slug} but found no executable to start")
                };
                entry.insert("starts".into(), false.into());
                entry.insert("why".into(), why.into());
                not_agents.push(Value::Object(entry));
            }
        }
    }
    json!({
        "schema": SCHEMA,
        "detection_ref": detection["detection_ref"],
        "observed_at": detection["observed_at"],
        "agents": agents,
        "not_agents": not_agents,
        "aikit_detail": aikit_why.map_or(json!({"state": "read"}), |why| json!({"state": "unavailable", "why": why})),
    })
}

/// The agents a person can talk to: the census rows that started.
pub fn starting(census: &Value) -> Vec<&Value> {
    census["agents"]
        .as_array()
        .map(|rows| rows.iter().filter(|row| row["starts"] == true).collect())
        .unwrap_or_default()
}

/// The agent a conversation opens with (O-I #1003): the one named, when the census lists it as an agent that starts; with none
/// named, the census's first agent that starts. Nothing else chooses. With no census held (a kernel whose World Model has not
/// started), a named agent is left to its owner, which refuses one it cannot open, and an unnamed one is refused in words.
pub fn agent_for(census: Option<&Value>, named: Option<&str>) -> Result<String, String> {
    let named = named.map(str::trim).filter(|slug| !slug.is_empty());
    let Some(census) = census else {
        return named.map(str::to_owned).ok_or_else(|| {
            "No agent is named, and the census of the agents on this machine has not been read yet".to_owned()
        });
    };
    let Some(slug) = named else {
        return starting(census)
            .first()
            .and_then(|row| row["slug"].as_str())
            .map(str::to_owned)
            .ok_or_else(|| {
                "No agent on this machine starts: the census lists none that answered".to_owned()
            });
    };
    let row_of = |list: &str| {
        census[list]
            .as_array()
            .and_then(|rows| rows.iter().find(|row| row["slug"] == slug))
    };
    match row_of("agents").or_else(|| row_of("not_agents")) {
        Some(row) if row["starts"] == true => Ok(slug.to_owned()),
        Some(row) => Err(format!(
            "{slug} does not start on this machine: {}",
            row["why"].as_str().unwrap_or("it did not answer its start")
        )),
        None => Err(format!(
            "{slug} is not an agent Actuation detects on this machine"
        )),
    }
}

/// What starting one agent answered.
#[derive(Clone, Debug, PartialEq)]
pub enum Started {
    /// It ran and answered `--version` successfully: its first line, and how long it took.
    Answered { words: String, seconds: f64 },
    /// It could not be started, failed, or did not answer within `START_LIMIT`: why, in words.
    Refused { why: String },
}

/// Start one agent: `<program> --version`, bounded by `START_LIMIT`, in its own process group so a stop reaches what it started.
/// No input, no environment of the kernel's own.
pub fn probe(program: &Path) -> Started {
    let started = Instant::now();
    let mut command = crate::flow::child(program);
    command.arg("--version").stdin(Stdio::null());
    match crate::owner_process::output(
        &mut command,
        None,
        crate::owner_process::Bound::read("the agent", "--version", START_LIMIT),
    ) {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let words = stdout
                .lines()
                .chain(stderr.lines())
                .map(str::trim)
                .find(|line| !line.is_empty())
                .unwrap_or("")
                .to_owned();
            Started::Answered {
                words,
                seconds: (started.elapsed().as_secs_f64() * 10.0).round() / 10.0,
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let said = stderr
                .lines()
                .map(str::trim)
                .find(|line| !line.is_empty())
                .unwrap_or("");
            Started::Refused {
                why: format!(
                    "{} --version exited {}{}",
                    program.display(),
                    output.status,
                    if said.is_empty() {
                        String::new()
                    } else {
                        format!(": {said}")
                    }
                ),
            }
        }
        Err(failure) => Started::Refused {
            why: failure.message.replace(
                "the agent --version",
                &format!("{} --version", program.display()),
            ),
        },
    }
}

/// The executable Actuation's probe found for a row, when it found one by its absolute path.
fn executable_of(row: &Value) -> Option<String> {
    row["probes"].as_array()?.iter().find_map(|probe| {
        let detail = probe["detail"].as_str()?;
        (probe["kind"] == "executable" && probe["result"] == "pass" && detail.starts_with('/'))
            .then(|| detail.to_owned())
    })
}

/// Whether an AIKit client row is the harness `slug`: AIKit names the Actuation harness each client drives (`harness`), and a row
/// that names none is matched by its own client name.
fn client_names(client: &Value, slug: &str) -> bool {
    match client["harness"].as_str() {
        Some(harness) => harness == slug,
        None => client["client"].as_str() == Some(slug),
    }
}

fn op(value: Value) -> Result<KernelOp, String> {
    serde_json::from_value(value)
        .map_err(|error| format!("the census asked an op the kernel does not take: {error}"))
}

/// The `data` of an owner reading.
fn data(outcome: KernelOpOutcome) -> Result<Value, String> {
    let value = serde_json::to_value(&outcome.result).map_err(|error| error.to_string())?;
    Ok(value.get("data").cloned().unwrap_or(Value::Null))
}

fn owner_route_data(outcome: KernelOpOutcome) -> Result<Result<Value, String>, String> {
    let value = serde_json::to_value(&outcome.result).map_err(|error| error.to_string())?;
    if value["result"] != "owner_route_reading" {
        return Ok(Err(format!(
            "the kernel answered {}, not Actuation's reading",
            value["result"]
        )));
    }
    Ok(Ok(value["data"].clone()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn detection() -> Value {
        json!({"schema": "actuation.harness-detection/v1", "detection_ref": "d1", "observed_at": "now", "harnesses": [
            {"slug": "claude-code", "harness_ref": "harness/claude-code", "native_kind": "harness", "state": "detected",
             "probes": [{"kind": "executable", "result": "pass", "spec": "claude", "detail": "/bin/claude"}]},
            {"slug": "zcode", "harness_ref": "harness/zcode", "native_kind": "harness", "state": "detected",
             "probes": [{"kind": "config-dir", "result": "pass", "detail": "~/.zcode"}]},
            {"slug": "ollama", "harness_ref": "harness/ollama", "native_kind": "model-provider", "state": "detected",
             "probes": [{"kind": "executable", "result": "pass", "detail": "/bin/ollama"}]},
            {"slug": "codex", "harness_ref": "harness/codex", "native_kind": "harness", "state": "detected",
             "probes": [{"kind": "executable", "result": "pass", "detail": "/bin/codex"}]},
            {"slug": "aider", "harness_ref": "harness/aider", "native_kind": "harness", "state": "absent", "probes": []}
        ]})
    }

    fn fake(program: &Path) -> Started {
        if program.ends_with("claude") {
            Started::Answered {
                words: "2.1.0 (Claude Code)".into(),
                seconds: 0.4,
            }
        } else {
            Started::Refused {
                why: format!("{} --version exited 1", program.display()),
            }
        }
    }

    #[test]
    fn a_row_is_an_agent_only_when_actuation_detects_its_harness_and_it_starts() {
        let clients = [
            json!({"client": "claude", "harness": "claude-code", "config_dir_present": true}),
            json!({"client": "only-aikit"}),
        ];
        let census = census_of(&detection(), &clients, None, fake);
        let starting: Vec<_> = starting(&census)
            .iter()
            .map(|row| row["slug"].as_str().unwrap().to_owned())
            .collect();
        assert_eq!(starting, ["claude-code"]);
        let agents: Vec<_> = census["agents"]
            .as_array()
            .unwrap()
            .iter()
            .map(|row| row["slug"].as_str().unwrap())
            .collect();
        assert_eq!(
            agents,
            ["claude-code", "codex"],
            "a detected harness that fails to start is listed with why"
        );
        assert_eq!(census["agents"][1]["why"], "/bin/codex --version exited 1");
        assert_eq!(
            census["agents"][0]["aikit"]["config_dir_present"], true,
            "AIKit adds detail to the row it names"
        );
        let others: Vec<_> = census["not_agents"]
            .as_array()
            .unwrap()
            .iter()
            .map(|row| row["slug"].as_str().unwrap())
            .collect();
        assert_eq!(others, ["zcode", "ollama", "aider"]);
        assert!(
            !census.to_string().contains("only-aikit"),
            "AIKit never adds a row"
        );
        assert_eq!(census["aikit_detail"]["state"], "read");
    }

    #[test]
    fn aikit_unavailable_leaves_the_rows_and_says_why() {
        let census = census_of(
            &detection(),
            &[],
            Some("AIKit client status is unavailable".into()),
            fake,
        );
        assert_eq!(starting(&census).len(), 1);
        assert_eq!(
            census["aikit_detail"],
            json!({"state": "unavailable", "why": "AIKit client status is unavailable"})
        );
    }

    #[test]
    fn a_real_program_that_answers_starts_and_one_that_fails_does_not() {
        assert!(matches!(
            probe(Path::new("/bin/echo")),
            Started::Answered { .. }
        ));
        match probe(Path::new("/usr/bin/false")) {
            Started::Refused { why } => {
                assert!(why.contains("/usr/bin/false --version exited"), "{why}")
            }
            other => panic!("{other:?}"),
        }
        match probe(Path::new("/nonexistent/agent")) {
            Started::Refused { why } => assert!(!why.is_empty()),
            other => panic!("{other:?}"),
        }
    }
}
