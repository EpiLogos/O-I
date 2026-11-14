//! The agents census (docs/architecture/world-shell.md §9.2; O-I #1001, #1003): which agents a person can talk to on this machine.
//!
//! One list, made one way. Its rows are Actuation's detection (`actuation harness detect --json`, read through
//! `ActuationRead::HarnessDetect`): every harness the catalogue finds detected, with the executable its probe found. Each such
//! harness is started once (`<executable> --version`, bounded) and its row says whether it started and what it answered, or why
//! not. AIKit adds detail to a row (`aikit --json client status`: its config directory and whether it exists, its gaps, and
//! whether a conversation opens with it) and never a row of its own: a harness AIKit names that Actuation does not detect is not
//! an agent here. An agent a person can talk to (`talks`) starts and is one AIKit opens a conversation with; one that starts but
//! that AIKit would refuse is listed with AIKit's words as its why.
//!
//! Each agent also says what it carries (world-shell.md §9.3: "Agents that start, with the skill set and the law each
//! carries"): the model AIKit asks for when a chat opens with it and the skill set it gets, from AIKit's client row, and the law
//! statements its floor carries, from Central's reading (`control.floor.read`) of the instruction files AIKit says it reads in a
//! project (`project_guidance`), with how far up from where it works it reads them, so how far the world's floor reaches it. Where
//! AIKit names a file the agent reads in every session (`guidance`) and Central keeps a block of the floor in it (the reading's
//! `homes`), the census carries that block as Central reads it, and when it stands and is current the floor reaches the agent
//! wherever it works.
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
    let floor = floor_reading(via, &detection, &clients);
    Ok(census_of(&detection, &clients, aikit_why, &floor, probe))
}

/// Central's reading of the floors the detected agents read (O-I #1003): the instruction files AIKit says they read in a project
/// (each client row's `project_guidance`), by file name at the world's root, read once for all; or why Central gave none.
fn floor_reading(
    via: &dyn Fn(KernelOp) -> Result<KernelOpOutcome, String>,
    detection: &Value,
    clients: &[Value],
) -> Result<Value, String> {
    let detected: Vec<&str> = detection["harnesses"]
        .as_array()
        .map(|rows| {
            rows.iter()
                .filter(|row| row["native_kind"] == "harness" && row["state"] == "detected")
                .filter_map(|row| row["slug"].as_str())
                .collect()
        })
        .unwrap_or_default();
    let mut files: Vec<String> = clients
        .iter()
        .filter(|client| detected.iter().any(|slug| client_names(client, slug)))
        .flat_map(floor_files)
        .collect();
    files.sort();
    files.dedup();
    if files.is_empty() {
        return Err("AIKit names no instruction file any agent on this machine reads".into());
    }
    let outcome = via(op(
        json!({"op": "central", "project": null, "request": {"kind": "floor", "files": files}}),
    )?)?;
    let value = serde_json::to_value(&outcome.result).map_err(|error| error.to_string())?;
    if value["result"] != "central_reading" {
        return Err(format!(
            "the kernel answered {}, not Central's floor reading",
            value["result"]
        ));
    }
    Ok(value["data"].clone())
}

/// The files an AIKit client row says its harness reads in the project it works in (`project_guidance.files`, in the order it
/// prefers them), the Markdown ones only: a floor is rendered only as Markdown.
fn floor_files(client: &Value) -> Vec<String> {
    names(&client["project_guidance"]["files"])
        .into_iter()
        .filter(|name| name.ends_with(".md"))
        .map(str::to_owned)
        .collect()
}

/// The strings of a JSON array; none where it is not one.
fn names(value: &Value) -> Vec<&str> {
    value
        .as_array()
        .map(|items| items.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default()
}

/// The law an agent carries (O-I #1003): the floor Central renders among the files AIKit says it reads in a project, as Central
/// reads it, with how far that floor reaches it (`reach`, said only of a floor that stands); or, where AIKit names no such file,
/// why: the files it names are not Markdown, or AIKit does not say what it reads in a project (its profile is silent, or AIKit
/// predates `project_guidance`), and then no floor is claimed for it either way.
fn law_of(slug: &str, aikit: &Value, floor: &Result<Value, String>) -> Value {
    let files = floor_files(aikit);
    let Some(first) = files.first() else {
        let in_project = names(&aikit["project_guidance"]["files"]);
        let named = names(&aikit["guidance"]);
        return if !in_project.is_empty() {
            json!({"why": format!(
                "AIKit names {} as what {slug} reads in a project, and Central renders a floor only as Markdown files, so no floor reaches it",
                in_project.join(", ")
            )})
        } else if !named.is_empty() {
            json!({"why": format!(
                "AIKit names {} for {slug} and does not say what it reads in a project, so Central cannot tell whether the world's floor reaches it",
                named.join(", ")
            )})
        } else {
            json!({"why": format!(
                "AIKit names no instruction file {slug} reads, so Central cannot tell whether the world's floor reaches it"
            )})
        };
    };
    let reading = match floor {
        Err(why) => {
            return json!({"file": first, "why": format!("Central did not read the floor: {why}")})
        }
        Ok(reading) => reading,
    };
    let rows = reading["floors"].as_array().cloned().unwrap_or_default();
    let row_of = |file: &str| rows.iter().find(|row| row["file"] == file).cloned();
    // The first file it reads that Central holds a floor in; else the first it reads, as Central reads it (absent).
    let chosen = files
        .iter()
        .find_map(|file| {
            row_of(file).filter(|row| row["state"] == "rendered" || row["state"] == "foreign")
        })
        .or_else(|| row_of(first));
    let Some(mut law) = chosen else {
        return json!({"file": first, "why": format!("Central's floor reading names no {first}")});
    };
    // How far a floor reaches the agent is said only of one that stands; an absent floor reaches no one, and says why.
    let stands = law["state"] == "rendered" || law["state"] == "foreign";
    if stands {
        let file = law["file"].as_str().unwrap_or(first).to_owned();
        if let Some(reach) = reach_of(slug, aikit, &file) {
            law["reach"] = reach;
        }
    }
    // The block of the floor Central keeps in a file the agent reads in every session: as Central reads it, and when it stands
    // and is the floor Central renders now, the floor reaches the agent wherever it works.
    if let Some(home) = home_of(aikit, reading) {
        if stands && home["state"] == "rendered" && home["current"] == true {
            let file = home["file"].as_str().unwrap_or_default();
            law["reach"] = json!({"scope": "home", "file": file, "why": format!(
                "{slug} reads {file} in every session wherever it works, and Central keeps the world's floor there, so this floor reaches it in every project of the world"
            )});
        }
        law["home"] = home;
    }
    law
}

/// Central's reading of the block of the floor it keeps in a file AIKit says the agent reads in every session (its `guidance`;
/// `control.floor.read`'s `homes`), if Central keeps one in such a file.
fn home_of(aikit: &Value, reading: &Value) -> Option<Value> {
    let named = names(&aikit["guidance"]);
    reading["homes"]
        .as_array()?
        .iter()
        .find(|home| {
            home["file"]
                .as_str()
                .is_some_and(|file| named.contains(&file))
        })
        .cloned()
}

/// How far the world's floor reaches an agent (`{scope, why}`), from where AIKit says it looks for its instruction files in a
/// project: `ancestors` reaches it in every project under the world's root; `repository` and `workdir` only at the root. (A
/// block Central keeps in a file the agent reads in every session reaches it everywhere: scope `home`, in `law_of`.)
fn reach_of(slug: &str, aikit: &Value, file: &str) -> Option<Value> {
    let scope = aikit["project_guidance"]["reach"].as_str()?;
    let why = match scope {
        "ancestors" => format!(
            "{slug} reads {file} where it works and in every folder above, so this floor reaches it in every project of the world"
        ),
        "repository" => format!(
            "{slug} reads {file} from its repository's root down to where it works, so this floor reaches it only when it works at the world's root, not in a project's repository"
        ),
        "workdir" => format!(
            "{slug} reads {file} only in the folder it works in, so this floor reaches it only when it works at the world's root"
        ),
        other => format!("AIKit says {slug} looks for {file} in a way Central does not know ({other})"),
    };
    Some(json!({"scope": scope, "why": why}))
}

/// AIKit's reason for one part of a client row it could not read, in AIKit's words: its `carries_reason` joins one sentence per
/// part ("AIKit could not read its model defaults: …; AIKit could not read the Skill Sets …"), found here by what the part names.
fn aikit_reason(client: &Value, part: &str) -> Option<String> {
    const OPENS: &str = "AIKit could not read";
    let reason = client["carries_reason"].as_str()?;
    reason
        .split(&format!("; {OPENS}"))
        .enumerate()
        .map(|(at, piece)| {
            if at == 0 {
                piece.to_owned()
            } else {
                format!("{OPENS}{piece}")
            }
        })
        .find(|piece| piece.contains(part))
}

/// What an agent carries (O-I #1003): its model and the skill set it gets, from AIKit's client row, and the law its floor carries,
/// from Central's floor reading. Each part says why where its owner does not answer.
fn carries_of(
    slug: &str,
    aikit: &Value,
    unavailable: Option<&str>,
    floor: &Result<Value, String>,
) -> Value {
    let silent = unavailable
        .map(|why| format!("AIKit could not be read: {why}"))
        .or_else(|| {
            aikit
                .is_null()
                .then(|| format!("AIKit names no client for {slug}"))
        });
    let model = match (&silent, aikit.get("model_default")) {
        (Some(why), _) => json!({"why": why}),
        (None, Some(Value::Object(default))) => {
            let mut model = Map::new();
            for key in ["model_id", "model_name", "native_provider"] {
                if let Some(value) = default.get(key).filter(|value| !value.is_null()) {
                    model.insert(key.into(), value.clone());
                }
            }
            Value::Object(model)
        }
        // A null default is AIKit holding none, unless AIKit could not read its defaults: then a new chat does not open either.
        (None, Some(Value::Null)) => match aikit_reason(aikit, "model defaults") {
            Some(why) => json!({"why": why}),
            None => json!({"own": true, "why": format!(
                "AIKit holds no model default for {slug}: a new chat opens with its own model"
            )}),
        },
        (None, _) => json!({"why": aikit_reason(aikit, "model defaults")
            .unwrap_or_else(|| format!("AIKit's client status names no model default for {slug}"))}),
    };
    let skills = match (&silent, aikit.get("skill_sets")) {
        (Some(why), _) => json!({"why": why}),
        (None, Some(Value::Array(sets))) => {
            json!({"sets": sets, "skills": aikit.get("skills").cloned().unwrap_or_else(|| json!([]))})
        }
        (None, _) => json!({"why": aikit_reason(aikit, "Skill Sets")
            .unwrap_or_else(|| format!("AIKit's client status names no Skill Sets for {slug}"))}),
    };
    let law = match &silent {
        Some(why) => json!({"why": why}),
        None => law_of(slug, aikit, floor),
    };
    json!({"model": model, "skills": skills, "law": law})
}

/// The census from Actuation's detection, AIKit's client rows and Central's floor reading, each detected harness started through
/// `start`. Pure but for `start`; the probes run side by side.
pub fn census_of(
    detection: &Value,
    clients: &[Value],
    aikit_why: Option<String>,
    floor: &Result<Value, String>,
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
        if started.is_some() {
            let carries = carries_of(&slug, &entry["aikit"], aikit_why.as_deref(), floor);
            entry.insert("carries".into(), carries);
        }
        match started {
            Some(Started::Answered { words, seconds }) => {
                entry.insert("starts".into(), true.into());
                entry.insert("version".into(), words.into());
                entry.insert("start_seconds".into(), seconds.into());
                let refused = talk_refusal(&slug, &entry["aikit"], aikit_why.as_deref());
                entry.insert("talks".into(), refused.is_none().into());
                if let Some(why) = refused {
                    entry.insert("why".into(), why.into());
                }
                agents.push(Value::Object(entry));
            }
            Some(Started::Refused { why }) => {
                entry.insert("starts".into(), false.into());
                entry.insert("talks".into(), false.into());
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
                entry.insert("talks".into(), false.into());
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

/// The agents a person can talk to: the census rows that started and that AIKit opens a conversation with (`talks`).
pub fn talking(census: &Value) -> Vec<&Value> {
    census["agents"]
        .as_array()
        .map(|rows| rows.iter().filter(|row| row["talks"] == true).collect())
        .unwrap_or_default()
}

/// Why a person cannot talk to an agent that starts, in AIKit's words, or `None` when they can. AIKit opens every conversation,
/// and its client status says whether one opens with each harness (`conversation`, decided as an open decides it, before anything
/// launches): an agent it would refuse is listed, starting, with AIKit's refusal as its why.
fn talk_refusal(slug: &str, aikit: &Value, unavailable: Option<&str>) -> Option<String> {
    if let Some(why) = unavailable {
        return Some(format!(
            "AIKit, which opens every conversation, could not be read: {why}"
        ));
    }
    match aikit.get("conversation") {
        Some(conversation) if conversation["opens"] == true => None,
        Some(conversation) => Some(
            conversation["why"]
                .as_str()
                .map_or_else(|| format!("AIKit opens no conversation with {slug}"), str::to_owned),
        ),
        None if aikit.is_null() => Some(format!(
            "AIKit names no client for {slug}, so it opens no conversation with it"
        )),
        None => Some(format!(
            "AIKit does not say whether a conversation opens with {slug} (its client status names no `conversation`)"
        )),
    }
}

/// The agent a conversation opens with (O-I #1003): the one named, when the census lists it as an agent a person can talk to;
/// with none named, the census's first such agent. Nothing else chooses. With no census held (a kernel whose World Model has not
/// started), a named agent is left to its owner, which refuses one it cannot open, and an unnamed one is refused in words.
pub fn agent_for(census: Option<&Value>, named: Option<&str>) -> Result<String, String> {
    let named = named.map(str::trim).filter(|slug| !slug.is_empty());
    let Some(census) = census else {
        return named.map(str::to_owned).ok_or_else(|| {
            "No agent is named, and the census of the agents on this machine has not been read yet".to_owned()
        });
    };
    let Some(slug) = named else {
        return talking(census)
            .first()
            .and_then(|row| row["slug"].as_str())
            .map(str::to_owned)
            .ok_or_else(|| {
                "No agent on this machine can be talked to: the census lists none that starts and that AIKit opens a conversation with"
                    .to_owned()
            });
    };
    let row_of = |list: &str| {
        census[list]
            .as_array()
            .and_then(|rows| rows.iter().find(|row| row["slug"] == slug))
    };
    match row_of("agents").or_else(|| row_of("not_agents")) {
        Some(row) if row["talks"] == true => Ok(slug.to_owned()),
        Some(row) => Err(format!(
            "{slug} is not an agent you can talk to on this machine: {}",
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

    fn no_floor() -> Result<Value, String> {
        Err("Central has no Action control.floor.read".into())
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
            json!({"client": "claude", "harness": "claude-code", "config_dir_present": true,
                   "conversation": {"opens": true, "protocol": "acp"}}),
            json!({"client": "only-aikit"}),
        ];
        let census = census_of(&detection(), &clients, None, &no_floor(), fake);
        let starting: Vec<_> = talking(&census)
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
    fn an_agent_that_starts_is_one_to_talk_to_only_where_aikit_opens_a_conversation() {
        let clients = [
            json!({"client": "claude", "harness": "claude-code", "conversation": {"opens": true, "protocol": "acp"}}),
            json!({"client": "codex", "harness": "codex",
                   "conversation": {"opens": false, "why": "AIKit opens no conversation with codex: no face"}}),
        ];
        let answers = |program: &Path| Started::Answered {
            words: format!("{} 1.0", program.display()),
            seconds: 0.1,
        };
        let census = census_of(&detection(), &clients, None, &no_floor(), answers);
        let slugs = |rows: Vec<&Value>| -> Vec<String> {
            rows.iter()
                .map(|row| row["slug"].as_str().unwrap().to_owned())
                .collect()
        };
        assert_eq!(slugs(talking(&census)), ["claude-code"]);
        let codex = &census["agents"][1];
        assert_eq!(
            (&codex["slug"], &codex["starts"], &codex["talks"]),
            (&json!("codex"), &json!(true), &json!(false)),
            "the row stays, starting, and says it is no agent to talk to: {codex}"
        );
        assert_eq!(
            codex["why"],
            "AIKit opens no conversation with codex: no face"
        );
        assert_eq!(agent_for(Some(&census), None).unwrap(), "claude-code");
        let refused = agent_for(Some(&census), Some("codex")).unwrap_err();
        assert!(
            refused.contains("AIKit opens no conversation with codex"),
            "{refused}"
        );
        // A client row that does not say is no conversation either, and says so.
        let silent = census_of(
            &detection(),
            &[json!({"client": "claude", "harness": "claude-code"})],
            None,
            &no_floor(),
            answers,
        );
        assert_eq!(silent["agents"][0]["talks"], false);
        assert!(silent["agents"][0]["why"]
            .as_str()
            .unwrap()
            .contains("does not say"));
    }

    #[test]
    fn an_agent_carries_its_model_its_skill_set_and_the_law_its_floor_carries() {
        let clients = [
            json!({"client": "claude", "harness": "claude-code", "conversation": {"opens": true, "protocol": "acp"},
                   "model_default": {"model_id": "claude-opus-5-5", "model_name": null}, "skill_sets": ["foundation"],
                   "skills": ["wayfinder"], "guidance": ["~/.claude/CLAUDE.md"],
                   "project_guidance": {"files": ["CLAUDE.md"], "reach": "ancestors"}}),
            json!({"client": "codex", "harness": "codex", "conversation": {"opens": true, "protocol": "acp"},
                   "model_default": null, "skill_sets": [], "skills": [], "guidance": ["~/.codex/AGENTS.md"],
                   "project_guidance": {"files": ["AGENTS.md"], "reach": "repository"}}),
        ];
        let floor = Ok(
            json!({"schema": "central.floor-reading/v1", "root": "/w/Central", "floors": [
                {"file": "CLAUDE.md", "state": "rendered", "statements": [
                    {"file": "communicate-and-engage/smallest-sufficient.md", "topic": "Smallest sufficient", "standing": "durable"}]},
                {"file": "AGENTS.md", "state": "rendered", "statements": []}
            ]}),
        );
        let answers = |program: &Path| Started::Answered {
            words: format!("{} 1.0", program.display()),
            seconds: 0.1,
        };
        let census = census_of(&detection(), &clients, None, &floor, answers);
        let claude = &census["agents"][0]["carries"];
        assert_eq!(claude["model"], json!({"model_id": "claude-opus-5-5"}));
        assert_eq!(
            claude["skills"],
            json!({"sets": ["foundation"], "skills": ["wayfinder"]})
        );
        assert_eq!(claude["law"]["file"], "CLAUDE.md");
        assert_eq!(
            claude["law"]["statements"][0]["topic"],
            "Smallest sufficient"
        );
        // It reads CLAUDE.md in every folder above where it works: the world's floor reaches it in every project.
        assert_eq!(claude["law"]["reach"]["scope"], "ancestors");
        let codex = &census["agents"][1]["carries"];
        assert_eq!(codex["model"]["own"], true, "no default: its own model");
        assert_eq!(codex["law"]["state"], "rendered");
        // It looks no higher than its repository's root: the world's floor reaches it only at the world's root.
        assert_eq!(codex["law"]["reach"]["scope"], "repository");
        assert!(codex["law"]["reach"]["why"]
            .as_str()
            .unwrap()
            .contains("only when it works at the world's root"));
        // An absent floor reaches no one: it says Central's why, and no reach beside it.
        let absent = Ok(
            json!({"schema": "central.floor-reading/v1", "root": "/w/Central", "floors": [
            {"file": "AGENTS.md", "state": "absent", "statements": [], "why": "no AGENTS.md at the Central root"}]}),
        );
        let gone = census_of(&detection(), &clients, None, &absent, answers);
        let law = &gone["agents"][1]["carries"]["law"];
        assert_eq!(law["state"], "absent");
        assert!(law.get("reach").is_none(), "{law}");
        assert_eq!(law["why"], "no AGENTS.md at the Central root");
        // Central unread: each floor says why, in Central's words; the model and skill set stand.
        let unread = census_of(&detection(), &clients, None, &no_floor(), answers);
        let law = &unread["agents"][0]["carries"]["law"];
        assert_eq!(law["file"], "CLAUDE.md");
        assert!(law["why"]
            .as_str()
            .unwrap()
            .contains("Central has no Action control.floor.read"));
        assert_eq!(
            unread["agents"][0]["carries"]["model"]["model_id"],
            "claude-opus-5-5"
        );
        // A detected harness that is not an agent carries nothing.
        assert!(census["not_agents"][0].get("carries").is_none());
    }

    #[test]
    fn a_floor_central_keeps_where_the_agent_reads_in_every_session_reaches_it_in_every_project() {
        let clients = [
            json!({"client": "codex", "harness": "codex", "conversation": {"opens": true, "protocol": "acp"},
            "model_default": null, "skill_sets": [], "skills": [], "guidance": ["~/.codex/AGENTS.md"],
            "project_guidance": {"files": ["AGENTS.md"], "reach": "repository"}}),
        ];
        let reading = |home: Value| {
            Ok(
                json!({"schema": "central.floor-reading/v1", "root": "/w/Central",
                "floors": [{"file": "AGENTS.md", "state": "rendered", "statements": []}], "homes": [home]}),
            )
        };
        let answers = |program: &Path| Started::Answered {
            words: format!("{} 1.0", program.display()),
            seconds: 0.1,
        };
        let law_with = |home: Value| {
            let census = census_of(&detection(), &clients, None, &reading(home), answers);
            let codex = census["agents"]
                .as_array()
                .and_then(|rows| rows.iter().find(|row| row["slug"] == "codex"));
            codex.map_or(Value::Null, |row| row["carries"]["law"].clone())
        };
        // Central's block stands in ~/.codex/AGENTS.md and is the floor it renders now: codex carries it wherever it works.
        let current = json!({"file": "~/.codex/AGENTS.md", "state": "rendered", "current": true,
            "renderer": "central control.floor.render"});
        let law = law_with(current.clone());
        assert_eq!(law["reach"]["scope"], "home");
        assert_eq!(law["reach"]["file"], "~/.codex/AGENTS.md");
        assert!(law["reach"]["why"]
            .as_str()
            .unwrap()
            .contains("in every project of the world"));
        assert_eq!(law["home"], current);
        // A block that is not the floor Central renders now, or none: the reach is the project's, and the block says why.
        for home in [
            json!({"file": "~/.codex/AGENTS.md", "state": "rendered", "current": false,
                "renderer": "central-session-strap/render-context.py", "why": "control.floor.render writes it again"}),
            json!({"file": "~/.codex/AGENTS.md", "state": "absent", "current": false,
                "why": "no Codex folder (~/.codex) at this home"}),
        ] {
            let law = law_with(home.clone());
            assert_eq!(law["reach"]["scope"], "repository", "{law}");
            assert_eq!(law["home"], home);
        }
        // A home file AIKit does not name for the agent is not its own: nothing is carried of it.
        let other =
            law_with(json!({"file": "~/.other/AGENTS.md", "state": "rendered", "current": true}));
        assert_eq!(other["reach"]["scope"], "repository");
        assert!(other.get("home").is_none(), "{other}");
    }

    #[test]
    fn a_part_aikit_could_not_read_says_aikits_why_and_a_floor_that_is_not_markdown_is_named() {
        // AIKit lays `model_default: null` both when it holds no default and when it could not read its defaults; only the
        // second carries a reason, and then no chat opens with "its own model" (AIKit's open reads the same file).
        let clients = [
            json!({"client": "claude", "harness": "claude-code", "conversation": {"opens": true, "protocol": "acp"},
                   "model_default": null, "skill_sets": null, "skills": [], "guidance": ["~/.claude/CLAUDE.md"],
                   "carries_reason": "AIKit could not read its model defaults: Unrecognised model defaults schema; \
                                      AIKit could not read the Skill Sets this context selects: no such set"}),
            json!({"client": "codex", "harness": "codex", "conversation": {"opens": true, "protocol": "acp"},
                   "model_default": null, "skill_sets": [], "skills": [], "guidance": [],
                   "project_guidance": {"files": [".goosehints"], "reach": "repository"}}),
        ];
        let answers = |program: &Path| Started::Answered {
            words: format!("{} 1.0", program.display()),
            seconds: 0.1,
        };
        let census = census_of(&detection(), &clients, None, &no_floor(), answers);
        let claude = &census["agents"][0]["carries"];
        assert!(
            claude["model"].get("own").is_none(),
            "an unread default is no own model"
        );
        assert_eq!(
            claude["model"]["why"],
            "AIKit could not read its model defaults: Unrecognised model defaults schema"
        );
        assert_eq!(
            claude["skills"]["why"],
            "AIKit could not read the Skill Sets this context selects: no such set"
        );
        let codex = &census["agents"][1]["carries"];
        assert_eq!(codex["model"]["own"], true, "no reason: AIKit holds none");
        // A guidance file that is not Markdown (goose's `.goosehints`) is named in the why, not called absent.
        let law = codex["law"]["why"].as_str().unwrap();
        assert!(
            law.contains(".goosehints") && law.contains("Markdown"),
            "{law}"
        );
    }

    #[test]
    fn the_floor_an_agent_reads_is_the_first_of_its_files_central_holds_and_a_silent_profile_claims_none(
    ) {
        let answers = |program: &Path| Started::Answered {
            words: format!("{} 1.0", program.display()),
            seconds: 0.1,
        };
        let floor = Ok(
            json!({"schema": "central.floor-reading/v1", "root": "/w/Central", "floors": [
                {"file": "AGENTS.md", "state": "absent", "statements": []},
                {"file": "CLAUDE.md", "state": "rendered", "statements": [
                    {"file": "craft/plain-words.md", "topic": "Plain words", "standing": "durable"}]}
            ]}),
        );
        let row = |client: &str, harness: &str, guidance: Value, project: Value| {
            json!({"client": client, "harness": harness, "conversation": {"opens": true, "protocol": "acp"},
                   "model_default": null, "skill_sets": [], "skills": [], "guidance": guidance, "project_guidance": project})
        };
        let law = |clients: &[Value], at: usize| {
            census_of(&detection(), clients, None, &floor, answers)["agents"][at]["carries"]["law"]
                .clone()
        };
        // Of AGENTS.md and CLAUDE.md, the one Central holds a floor in is the law it carries.
        let both = law(
            &[row(
                "claude",
                "claude-code",
                json!([]),
                json!({"files": ["AGENTS.md", "CLAUDE.md"], "reach": "ancestors"}),
            )],
            0,
        );
        assert_eq!(both["file"], "CLAUDE.md");
        assert_eq!(both["statements"][0]["topic"], "Plain words");
        assert_eq!(both["reach"]["scope"], "ancestors");
        // A profile silent about projects claims no floor either way, nor that none reaches it: a home file names nothing a
        // project holds, and AIKit not saying is not AIKit saying "nothing".
        let home = law(
            &[row(
                "claude",
                "claude-code",
                json!(["~/.openclaw/workspace/AGENTS.md"]),
                Value::Null,
            )],
            0,
        );
        assert!(home.get("file").is_none(), "{home}");
        assert_eq!(
            home["why"],
            "AIKit names ~/.openclaw/workspace/AGENTS.md for claude-code and does not say what it reads in a project, so Central \
             cannot tell whether the world's floor reaches it"
        );
        // So is an AIKit that predates `project_guidance`: no key at all, and no floor guessed from a home file's name.
        let older = law(
            &[
                json!({"client": "claude", "harness": "claude-code", "conversation": {"opens": true, "protocol": "acp"},
                     "model_default": null, "skill_sets": [], "skills": [], "guidance": ["~/.claude/CLAUDE.md"]}),
            ],
            0,
        );
        assert!(older.get("file").is_none(), "{older}");
        assert!(
            older["why"]
                .as_str()
                .unwrap()
                .contains("does not say what it reads in a project"),
            "{older}"
        );
        let unplaced = law(
            &[row(
                "claude",
                "claude-code",
                json!(["CLAUDE.md"]),
                Value::Null,
            )],
            0,
        );
        assert!(unplaced.get("file").is_none(), "{unplaced}");
        assert!(
            unplaced["why"]
                .as_str()
                .unwrap()
                .contains("does not say what it reads in a project"),
            "{unplaced}"
        );
        let none = law(&[row("claude", "claude-code", json!([]), Value::Null)], 0);
        assert_eq!(
            none["why"],
            "AIKit names no instruction file claude-code reads, so Central cannot tell whether the world's floor reaches it"
        );
    }

    #[test]
    fn aikit_unavailable_leaves_the_rows_and_says_why() {
        let census = census_of(
            &detection(),
            &[],
            Some("AIKit client status is unavailable".into()),
            &no_floor(),
            fake,
        );
        assert!(
            talking(&census).is_empty(),
            "AIKit opens every conversation: unread, none opens"
        );
        assert_eq!(census["agents"][0]["starts"], true);
        assert!(census["agents"][0]["why"]
            .as_str()
            .unwrap()
            .contains("AIKit client status is unavailable"));
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
