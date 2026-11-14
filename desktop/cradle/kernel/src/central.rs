//! Central owns root/project, civil time, source, document and Return semantics.
//! This finite desktop adapter joins owner results; it never traverses files,
//! invents a SourceRef, starts an Agent, or rewrites temporal identity.
use crate::{files, flow::CentralClient};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Request {
    Inspect,
    SourceLocation {
        source_ref: String,
    },
    OpenDay {
        #[serde(default)]
        day_ref: Option<String>,
    },
    /// One authored root agent-set (`central.agent-set.read`), verbatim: who
    /// carries commissioned work is Central's record, never a desktop constant.
    AgentSet {
        agent_set_ref: String,
    },
    /// The floors the agents read at the root world (O-I #1003): Central's reading of the instruction files named
    /// (`control.floor.read`), each rendered by Central, written by another hand or absent, with the law statements it carries.
    Floor {
        files: Vec<String>,
    },
}

fn reading(client: &CentralClient, project: Option<&str>, action: &str, schema: &str) -> Value {
    match client.run_envelope(action, json!({"project":project})) {
        Ok(envelope) if envelope["ok"] == true => {
            if envelope["data"]["schema"] != schema
                || envelope["data"]["automatic_agent_or_model_invocation"] == true
            {
                return json!({"state":"failed","action":action,"error":{"message":"Unsupported or redirected native reading"},"native":envelope});
            }
            json!({"state":"ready","action":action,"data":envelope["data"]})
        }
        Ok(envelope) => {
            let state = match envelope["error"]["code"].as_str() {
                Some("policy_or_source_denied" | "placement_rejected") => "denied",
                Some("source_or_scope_unavailable") => "unavailable",
                Some("stale_basis_or_identity_conflict") => "stale",
                _ => "failed",
            };
            json!({"state":state,"action":action,"error":envelope["error"],"native_status":envelope["status"]})
        }
        Err(error) => {
            json!({"state":if matches!(error,crate::OwnerCallError::Unavailable{..}){"unavailable"}else{"failed"},"action":action,"error":{"message":error.to_string()}})
        }
    }
}

/// The Day of the root or a project register. An exact `day_ref` is read as it stands. Today's Day is Central's to turn
/// (`central.day.turn`, O-I #1005; manual §18.2 "The Day opens by itself and the close runs by itself"): Central's civil clock
/// opens it on its civil date, makes its page from the Day form the person saved in the Day's settings (`day_form`, at the revision
/// they read it; Setup's Ground Accept saves it from `ground_form::day_form`), and closes an earlier Day still open at its turn where
/// the person's Close lets it and its carry can be filed, as the person's adopted civil-time policy determines; asked again with
/// nothing to turn, it writes nothing. Where Central does not turn the Day (a policy that keeps it from turning by itself, or a
/// Central without the turn), today's Day is read as it stands and a pointer left on an earlier civil Day is refused with Central's
/// words.
pub fn day(
    client: &CentralClient,
    project: Option<&str>,
    day_ref: Option<&str>,
) -> Result<Value, String> {
    if let Some(reference) = day_ref {
        let value = client
            .run(
                "central.day.read",
                json!({"project":project,"day_ref":day_ref}),
            )
            .map_err(|e| e.to_string())?;
        day_reading(&value)?;
        if value["day_ref"] != reference {
            return Err("Native Day reader redirected the requested historical Day".into());
        }
        return Ok(value);
    }
    let not_turned = match turn(client, project) {
        Ok(value) => {
            day_reading(&value)?;
            return Ok(value);
        }
        Err(why) => why,
    };
    let value = client
        .run("central.day.read", json!({"project":project}))
        .map_err(|e| e.to_string())?;
    day_reading(&value)?;
    let time = client
        .run("central.time.policy", json!({"project":project}))
        .map_err(|e| e.to_string())?;
    if value["temporal"]["civil_date"] != time["civil_date"] {
        return Err(format!(
            "The native today pointer is stale: Central did not turn the Day ({not_turned})"
        ));
    }
    Ok(value)
}

/// Central's turn of the Day by its civil clock (Central's continuous_work/day_turn.rs).
const TURN: &str = "central.day.turn";

/// Central's Day reading as the kernel takes it: its schema, invoking no agent or model.
fn day_reading(value: &Value) -> Result<(), String> {
    if value["schema"] != "central.day-reading/v1"
        || value["automatic_agent_or_model_invocation"] != false
    {
        return Err("Unsupported native Day reading".into());
    }
    Ok(())
}

/// Central's turn of today's Day (`central.day.turn`), asked with the project alone: Central makes today's page only from the Day form
/// the person saved in the Day's settings, and refuses a form offered with the turn (Central #362), so none is offered. Central
/// classes the turn locally-mutating (it writes the person's Day), yet it is asked at every read of today's Day and writes only when the
/// Day turns; so the kernel retires its readings from the turn's own answer: where it moved anything (a Day opened or closed, a page
/// made), every reading the kernel holds retires, once, and where nothing turned, none does (`CentralClient::run_retired_by_its_answer`).
fn turn(client: &CentralClient, project: Option<&str>) -> Result<Value, String> {
    // A Central whose catalogue does not name the turn is not asked for it: today's Day is read as it stands, and a today pointer
    // left on an earlier civil Day is refused naming the missing turn (`day`).
    if client.mutation_class(TURN).is_none() {
        return Err(format!("Central's Action field names no {TURN}"));
    }
    let value = client
        .run_retired_by_its_answer(TURN, json!({"project":project}))
        .map_err(|e| e.to_string())?;
    if turned(&value) {
        crate::read_cache::written();
    }
    Ok(value)
}

/// Whether one answer of the turn moved anything: a Day opened or closed, or a page made.
fn turned(value: &Value) -> bool {
    let turn = &value["turn"];
    turn["opened"] == true
        || turn["document"]["state"] == "made"
        || turn["closed"]
            .as_array()
            .is_some_and(|closed| !closed.is_empty())
}

pub fn day_document(day: &Value) -> Result<&Value, String> {
    let doc = &day["document"];
    if day["document_state"] != "ready" || doc["schema"] != "central.document-reading/v1" {
        return Err("Current Day has no native document yet: Central makes it at the Day's turn from the Day form; its temporal artifact is not a Daily Die".into());
    }
    if doc["source"]["ref"] != day["source"]["ref"]
        || doc["revision"] != day["revision"]
        || doc["document"]["kind"] != "day"
        || doc["document"]["day_ref"] != day["day_ref"]
    {
        return Err("Native Day/document identity or revision does not match".into());
    }
    Ok(doc)
}

pub fn source_location(
    client: &CentralClient,
    project: Option<&str>,
    reference: &str,
) -> Result<files::Location, String> {
    let source = client
        .source_read(project, reference)
        .map_err(|e| e.to_string())?;
    let path = if let Some(project) = project {
        let world = client
            .run("central.world", json!({"project":null}))
            .map_err(|e| e.to_string())?;
        let path = world["work"]["projects"]
            .as_array()
            .and_then(|rows| rows.iter().find(|p| p["name"] == project))
            .and_then(|p| p["path"].as_str())
            .ok_or("Project is outside native Central ground")?;
        format!("{path}/{}", source.source.path)
    } else {
        source.source.path
    };
    // Resolve the exact returned source path through its owner's directory.
    // This is not a search for a filename that might be today's document.
    let directory = files::list(client, &files::parent_path(&path))?;
    let entry = directory
        .entries
        .into_iter()
        .find(|entry| entry.location.path == path && entry.kind == "file")
        .ok_or("Native source location is missing from its owner's directory")?;
    if !entry.retrieval_allowed {
        return Err("Native source location is denied".into());
    }
    Ok(entry.location)
}

pub fn operate(
    client: &CentralClient,
    project: Option<&str>,
    request: &Request,
) -> Result<Value, String> {
    if project.is_some_and(|p| p.trim().is_empty()) {
        return Err("An empty Project is not root scope".into());
    }
    match request {
        Request::Inspect => {
            let time = reading(
                client,
                project,
                "central.time.policy",
                "central.civil-time-reading/v1",
            );
            let mut day = reading(
                client,
                project,
                "central.day.read",
                "central.day-reading/v1",
            );
            if day["state"] == "ready"
                && time["state"] == "ready"
                && day["data"]["temporal"]["civil_date"] != time["data"]["civil_date"]
            {
                day["state"] = json!("stale");
                day["error"] = json!({"message":"The native today pointer belongs to an earlier civil Day; its writing is retained"});
            }
            Ok(
                json!({"schema":"oi.central-ground/v1","project":project,"time":time,"day":day,
                "now":reading(client,project,"central.now.list","central.now-listing/v1"),
                "sources":reading(client,project,"projectcentral.change.horizon","central.source-change-horizon/v1"),
                "placement":reading(client,project,"central.work.policy","central.effective-placement-policy/v1")}),
            )
        }
        Request::SourceLocation { source_ref } => Ok(
            json!({"schema":"oi.central-source-location/v1","project":project,"source_ref":source_ref,"location":source_location(client,project,source_ref)?}),
        ),
        Request::OpenDay { day_ref } => {
            let value = day(client, project, day_ref.as_deref())?;
            let doc = day_document(&value)?;
            let reference = doc["source"]["ref"]
                .as_str()
                .ok_or("Day document has no source ref")?;
            let location = source_location(client, project, reference)?;
            Ok(
                json!({"schema":"oi.central-day-open/v1","project":project,"day":value,"location":location}),
            )
        }
        Request::AgentSet { agent_set_ref } => client
            .run(
                "central.agent-set.read",
                json!({"scope":"root","ref":agent_set_ref}),
            )
            .map_err(|e| e.to_string()),
        Request::Floor { files } => {
            let value = client
                .run("control.floor.read", json!({"files": files}))
                .map_err(|e| e.to_string())?;
            if value["schema"] != "central.floor-reading/v1" {
                return Err("Central answered control.floor.read in a form the kernel does not read (central.floor-reading/v1 expected)".into());
            }
            Ok(value)
        }
    }
}

// ---- receipts ------------------------------------------------------------------

/// Central's record of one act laid into the Day (`central.day.receipt.record`, Central's continuous_work/day_turn.rs).
const RECEIPT_RECORD: &str = "central.day.receipt.record";
/// Central's filing of what a session yielded at its end, as a proposal that waits on today's face 2 (`central.day.session.yield`,
/// Central's continuous_work/day_turn.rs `session_yield`, EpiLogos/Central#364).
const SESSION_YIELD: &str = "central.day.session.yield";
/// The Actions that end a session: Factory's End session, and the End of a session AIKit opened for a conversation.
const SESSION_ENDS: [&str; 2] = ["factory.session.end", "aikit.session.end"];
/// Where a receipt's owner answer is kept whole; past it, only its plain fields are kept.
const RECEIPT_ANSWER_BYTES: usize = 12 * 1024;
/// How many receipts wait at most for the person's credential (`Receipt::lay`); past it the oldest is dropped, and said.
const RECEIPTS_HELD: usize = 256;

/// What one act lays into the Day of the civil date it happened on (manual §18.2 "a write arrives with its receipt"; O-I #1005
/// for the gate's act 5, the whole of it O-I #1007): an Action that writes, a passage sent to an agent, a Factory act. Taken from
/// the op before it runs, laid once its owner answered; a refused act lays none, and an Action the kernel took as a reading lays
/// none. Each names its act, the product that did it, what it moved (its subject), where it stands (its source: the owner's own
/// ref for it, else the World it was made in) and, where it names one, the session it was made in. Central lays a receipt only on
/// a credential that grants it (Central #362), so it goes as the act came (flow.rs `Channel`): an act of the person's own press
/// lays its receipt on their credential, and one that came by a wire carries no one's, so its receipt is not asked for (an
/// agent's own acts would lay theirs on the agent's credential, which no wire carries yet: Central#361).
pub(crate) struct Receipt {
    act: String,
    owner: String,
    input: Value,
    subject: Option<String>,
    session: Option<String>,
    /// The World the act was made in, as Central spells it (`project:<id>`, else your world's root register, `control:root`).
    world: String,
    channel: crate::flow::Channel,
}

impl Receipt {
    /// What `op` lays when its owner answers, if it is an act that lays one.
    pub(crate) fn of(op: &crate::KernelOp) -> Option<Self> {
        match op {
            crate::KernelOp::InvokeAction {
                project,
                invocation,
                channel,
            } => {
                let action = invocation.action.as_str();
                // The Day's own records (its turn, a receipt, a session's yield) are no acts laid into it.
                if matches!(action, TURN | RECEIPT_RECORD | SESSION_YIELD)
                    || action.starts_with("action:decision.")
                {
                    return None;
                }
                let input = invocation.input.clone().unwrap_or(Value::Null);
                Some(Self {
                    act: action.to_owned(),
                    owner: owner_of(action).to_owned(),
                    subject: subject_of(&input)
                        .or_else(|| Some(invocation.target_ref.clone()).filter(|r| !r.is_empty())),
                    session: session_of(&input),
                    world: world_of(&input, project.as_deref()),
                    input,
                    channel: *channel,
                })
            }
            // A passage sent to an agent, with or without the context it carries: made in the session it went to.
            crate::KernelOp::Encounter {
                project,
                request:
                    crate::agency::EncounterRequest::Prompt { agent_session, .. }
                    | crate::agency::EncounterRequest::PromptContext { agent_session, .. },
                channel,
            } => Some(Self {
                act: "encounter.prompt".into(),
                owner: "AIKit".into(),
                input: Value::Null,
                subject: Some(agent_session.clone()),
                session: Some(agent_session.clone()),
                world: world_of(&Value::Null, Some(project)),
                channel: *channel,
            }),
            crate::KernelOp::FactoryOwner {
                request, channel, ..
            } if !request.is_read() => {
                let input = serde_json::to_value(request).unwrap_or(Value::Null);
                Some(Self {
                    act: format!("factory.{}", input["kind"].as_str().unwrap_or("act")),
                    owner: "Factory".into(),
                    subject: subject_of(&input),
                    session: session_of(&input),
                    world: world_of(&input, None),
                    input,
                    channel: *channel,
                })
            }
            _ => None,
        }
    }

    /// Lay it into today's Day of the root register, once its owner answered, on the credential its channel carries
    /// (`CentralClient::by_channel`). An act that came by a wire lays none, and a Central whose catalogue names no receipt record is
    /// not asked; a receipt Central refuses is said on the host's log and leaves the act as it was. An act of the person's press
    /// made before their credential exists (Setup's first acts, the time policy and the ground's placement adopted before the
    /// Ground Accept keeps their grant) waits here with its true instant, and is laid, in the order it came, ahead of the first act
    /// that carries the credential: Central lays an act of today or of the Day that just ended at its own instant. An act that ends
    /// a session (`SESSION_ENDS`) then files what the session yielded, through Central's own filing (`central.day.session.yield`).
    pub(crate) fn lay(
        self,
        client: &CentralClient,
        result: &Result<crate::KernelOpOutcome, String>,
    ) {
        let Ok(outcome) = result else {
            return;
        };
        if self.channel != crate::flow::Channel::PersonPress {
            return;
        }
        let answer = match &outcome.result {
            crate::KernelOpResult::ActionDispatched {
                dispatch: crate::action::ActionDispatch::Invoked { data, .. },
                reads_only: false,
            } => data.clone(),
            crate::KernelOpResult::ActionDispatched { .. } => return,
            other => serde_json::to_value(other).unwrap_or(Value::Null),
        };
        if client.mutation_class(RECEIPT_RECORD).is_none() {
            return;
        }
        // What it moved, as its owner answered (the attempt a task's run made, the session a seat opened), else as it was asked.
        let Some(subject) = subject_of(&answer).or(self.subject) else {
            return;
        };
        let session = session_of(&answer).or(self.session);
        static LAID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default();
        let receipt_id = format!(
            "kernel:{}:{}:{}",
            std::process::id(),
            at.as_nanos(),
            LAID.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        );
        let source = source_of(&self.input)
            .or_else(|| source_of(&answer))
            .unwrap_or(self.world);
        let mut input = json!({"project": null, "receipt_id": receipt_id, "act": self.act, "owner": self.owner,
            "subject": subject, "source": source, "receipt": bounded(answer),
            "occurred_at_unix_seconds": at.as_secs()});
        if let Some(session) = &session {
            input["session"] = json!(session);
        }
        let on = client.by_channel(self.channel);
        let held = held_for(client);
        let mut waiting = held.lock().unwrap_or_else(|e| e.into_inner());
        if on.person_token().is_none() {
            if waiting.len() >= RECEIPTS_HELD {
                let dropped = waiting.remove(0);
                eprintln!(
                    "the Day's receipt of {} was dropped: {RECEIPTS_HELD} receipts wait for the person's credential",
                    dropped["act"]
                );
            }
            waiting.push(input);
            return;
        }
        let mut laid = false;
        for receipt in waiting.drain(..).chain(std::iter::once(input)) {
            match on.run(RECEIPT_RECORD, receipt.clone()) {
                Ok(_) => laid = true,
                Err(error) => eprintln!(
                    "the Day's receipt of {} was not laid: {error}",
                    receipt["act"]
                ),
            }
        }
        drop(waiting);
        if let Some(session) = session.filter(|_| SESSION_ENDS.contains(&self.act.as_str())) {
            if client.mutation_class(SESSION_YIELD).is_some() {
                match on.run(SESSION_YIELD, json!({"project": null, "session": session})) {
                    Ok(_) => laid = true,
                    Err(error) => {
                        eprintln!("what the session {session} yielded was not filed: {error}")
                    }
                }
            }
        }
        if laid {
            crate::world_model::Model::global().written(&[crate::world_model::Slice::Day]);
        }
    }
}

/// The receipts that wait for the person's credential (`Receipt::lay`), kept in this process for the Central `client` names (its
/// executable, root and project, never its credential): they are laid in that Central's Day once the credential comes.
fn held_for(client: &CentralClient) -> std::sync::Arc<std::sync::Mutex<Vec<Value>>> {
    type Held = std::collections::BTreeMap<String, std::sync::Arc<std::sync::Mutex<Vec<Value>>>>;
    static HELD: std::sync::Mutex<Held> = std::sync::Mutex::new(Held::new());
    HELD.lock()
        .unwrap_or_else(|e| e.into_inner())
        .entry(format!("{:?}", client.without_person()))
        .or_default()
        .clone()
}

/// The World an act was made in, as Central spells it: the project it names (`project:<id>`, a project's id being its Work
/// member's name), else the World its Run's Factory state stands in (factory.rs `run_scope`: a Factory act names the state it
/// moves), else your world's root register (`control:root`).
fn world_of(input: &Value, project: Option<&str>) -> String {
    let named = input["project"]
        .as_str()
        .or(project)
        .map(str::trim)
        .filter(|project| !project.is_empty());
    if let Some(project) = named {
        return if project.contains(':') {
            project.to_owned()
        } else {
            format!("project:{project}")
        };
    }
    input["state"]
        .as_str()
        .map(std::path::Path::new)
        .filter(|state| state.is_absolute())
        .and_then(|state| {
            let contract = crate::factory::authority_contract_for(state)?;
            crate::factory::run_scope(state, &contract).ok()
        })
        .unwrap_or_else(|| "control:root".to_owned())
}

/// The session an act was made in, where it names one: the session a Factory act names, or the agent session a passage went to.
fn session_of(value: &Value) -> Option<String> {
    ["session", "agent_session"]
        .iter()
        .find_map(|key| value[*key].as_str())
        .filter(|session| !session.trim().is_empty())
        .map(str::to_owned)
}

/// The product an Action id belongs to, by its own spelling.
fn owner_of(action: &str) -> &str {
    match action.split(['.', ':', '/']).next().unwrap_or(action) {
        "central" | "projectcentral" | "control" | "personal" | "agent-profile" | "action" => {
            "Central"
        }
        "aikit" | "knowledge" => "AIKit",
        "factory" => "Factory",
        "workcell" | "seat" => "Workcell",
        "actuation" => "Actuation",
        "ql" | "nara" => "QL",
        other => other,
    }
}

/// What an act acted on, by the owner's own spelling: a file's path, else the first ref it names (a task's attempt before its Run,
/// a Run before the session it runs on).
fn subject_of(value: &Value) -> Option<String> {
    const REFS: [&str; 19] = [
        "path",
        "source_ref",
        "document_id",
        "day_ref",
        "now_ref",
        "return_ref",
        "attempt_ref",
        "attemptRef",
        "task_ref",
        "taskRef",
        "run_ref",
        "runRef",
        "journey_ref",
        "journeyRef",
        "agent_session",
        "statement",
        "ref",
        "unit_ref",
        "session",
    ];
    value
        .pointer("/location/path")
        .and_then(Value::as_str)
        .or_else(|| REFS.iter().find_map(|key| value[*key].as_str()))
        .filter(|text| !text.trim().is_empty())
        .map(str::to_owned)
}

/// Where an act's effect stands, where the owner names it: a file's or a source's ref.
fn source_of(value: &Value) -> Option<String> {
    ["/location/ref", "/source_ref", "/source/ref"]
        .iter()
        .find_map(|pointer| value.pointer(pointer).and_then(Value::as_str))
        .map(str::to_owned)
}

/// The owner's answer as a receipt keeps it: whole while it is small, else its plain fields.
fn bounded(answer: Value) -> Value {
    if serde_json::to_string(&answer).map_or(0, |text| text.len()) <= RECEIPT_ANSWER_BYTES {
        return answer;
    }
    let mut kept = serde_json::Map::new();
    if let Some(fields) = answer.as_object() {
        for (key, value) in fields {
            let plain = match value {
                Value::String(text) => text.len() <= 512,
                Value::Number(_) | Value::Bool(_) | Value::Null => true,
                _ => false,
            };
            if plain {
                kept.insert(key.clone(), value.clone());
            }
        }
    }
    kept.insert("truncated".into(), json!(true));
    Value::Object(kept)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::flow::Channel;

    /// Central as receipts reach it: its catalogue names the receipt record, and each receipt laid is written down with the credential
    /// it came with (`none` for none).
    fn central_laying_receipts(tag: &str) -> (CentralClient, std::path::PathBuf) {
        let dir =
            std::env::temp_dir().join(format!("oi-kernel-receipts-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("list.json"),
            r#"{"ok":true,"data":{"actions":[{"id":"central.day.receipt.record","mutation_class":"locally-mutating"}]}}"#,
        )
        .unwrap();
        let path = dir.join("central-fake");
        std::fs::write(
            &path,
            format!(
                "#!/bin/sh\ncase \"$4\" in\n  action.list) cat '{d}/list.json' ;;\n  central.day.receipt.record) printf '%s\\n' \"${{CENTRAL_NATIVE_TOKEN:-none}}\" >> '{d}/laid'; echo '{{\"ok\":true,\"data\":{{\"recorded\":true}}}}' ;;\n  *) echo '{{\"ok\":false,\"error\":{{\"message\":\"unexpected action\"}}}}' ;;\nesac\n",
                d = dir.display()
            ),
        )
        .unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        // The host's credential, as the person's press would carry it (under test, the client's own: flow.rs `for_person`).
        let client =
            CentralClient::with(path, None, "o-i".to_owned()).with_person_token("person-token");
        (client, dir)
    }

    /// A page saved, as the shell's `act` invokes Central's file write.
    fn saved(channel: Channel) -> crate::KernelOp {
        crate::KernelOp::InvokeAction {
            project: None,
            invocation: crate::action::ActionInvocation {
                action: "central.files.write".into(),
                target_ref: "central.files.write".into(),
                input: Some(json!({"location": {"path": "Control/user/flows/page.html"}})),
            },
            channel,
        }
    }

    fn answered() -> Result<crate::KernelOpOutcome, String> {
        Ok(crate::KernelOpOutcome {
            receipts: Vec::new(),
            read_scopes: None,
            result: crate::KernelOpResult::ActionDispatched {
                dispatch: crate::action::ActionDispatch::Invoked {
                    owner_operation: "central.files.write".into(),
                    data: json!({"revision": "r2"}),
                },
                reads_only: false,
            },
        })
    }

    /// Central lays a receipt only on a credential that grants it (Central #362; O-I #1005). An act that came by the person's own press
    /// lays its receipt on their credential; one that came by a wire carries no one's, so its receipt is not asked for.
    #[test]
    fn a_receipt_is_laid_on_the_persons_credential_only_for_an_act_of_their_press() {
        let (client, dir) = central_laying_receipts("press");
        Receipt::of(&saved(Channel::PersonPress))
            .expect("a write lays a receipt")
            .lay(&client, &answered());
        Receipt::of(&saved(Channel::Wire))
            .expect("a write lays a receipt")
            .lay(&client, &answered());
        let laid = std::fs::read_to_string(dir.join("laid")).unwrap_or_default();
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(
            laid.lines().collect::<Vec<_>>(),
            ["person-token"],
            "the press's receipt on the person's credential, and none asked for the wire's"
        );
    }

    /// A passage the person sends to an agent comes by the shell window's channel as the host's press command takes it (`person_press`,
    /// O-I #1005), so its receipt is laid on their credential; the same passage read from a wire lays none, and an encounter's reads
    /// and drafts are not the person's press.
    #[test]
    fn a_passage_the_person_sends_lays_its_receipt_on_their_credential() {
        let (client, dir) = central_laying_receipts("passage");
        let encounter = |request: Value| -> crate::KernelOp {
            serde_json::from_value(json!({"op": "encounter", "project": "", "request": request}))
                .unwrap()
        };
        let prompt =
            json!({"action": "prompt", "agent_session": "agent-session/x", "draft_revision": 2});
        let with_context = json!({"action": "prompt-context", "agent_session": "agent-session/x", "draft_revision": 3,
            "context": {"packet": "the selected words"}});
        let sent = |op: crate::KernelOp| {
            Receipt::of(&op)
                .expect("a passage sent lays a receipt")
                .lay(
                    &client,
                    &Ok(crate::KernelOpOutcome {
                        receipts: Vec::new(),
                        read_scopes: None,
                        result: crate::KernelOpResult::EncounterReading {
                            data: json!({"agent_session": "agent-session/x"}),
                        },
                    }),
                )
        };
        sent(
            crate::person_press(encounter(prompt.clone())).expect("the press takes a passage sent"),
        );
        sent(
            crate::person_press(encounter(with_context))
                .expect("the press takes a passage sent with its context"),
        );
        sent(encounter(prompt));
        for read in [
            json!({"action": "view", "agent_session": "agent-session/x", "before": null}),
            json!({"action": "draft", "agent_session": "agent-session/x", "basis": 1, "text": "words"}),
        ] {
            assert!(
                crate::person_press(encounter(read.clone())).is_err(),
                "{read}"
            );
        }
        let laid = std::fs::read_to_string(dir.join("laid")).unwrap_or_default();
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(
            laid.lines().collect::<Vec<_>>(),
            ["person-token", "person-token"]
        );
    }

    /// Central as the Day's records reach it (O-I #1007): its catalogue names the receipt record and a session's yield, and each
    /// call is written down whole, with the credential it came with: (action, credential, input).
    fn central_recording(tag: &str) -> (CentralClient, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(format!(
            "oi-kernel-day-records-{tag}-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("list.json"),
            r#"{"ok":true,"data":{"actions":[{"id":"central.day.receipt.record","mutation_class":"locally-mutating"},{"id":"central.day.session.yield","mutation_class":"locally-mutating"}]}}"#,
        )
        .unwrap();
        let path = dir.join("central-fake");
        std::fs::write(
            &path,
            format!(
                "#!/bin/sh\ncase \"$4\" in\n  action.list) cat '{d}/list.json' ;;\n  *) printf '%s\\t%s\\t%s\\n' \"$4\" \"${{CENTRAL_NATIVE_TOKEN:-none}}\" \"$5\" >> '{d}/calls'; echo '{{\"ok\":true,\"data\":{{\"recorded\":true}}}}' ;;\nesac\n",
                d = dir.display()
            ),
        )
        .unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        (CentralClient::with(path, None, "o-i".to_owned()), dir)
    }

    /// The calls Central was asked, in order: (action, credential, input).
    fn calls(dir: &std::path::Path) -> Vec<(String, String, Value)> {
        std::fs::read_to_string(dir.join("calls"))
            .unwrap_or_default()
            .lines()
            .map(|line| {
                let mut parts = line.splitn(3, '\t');
                let (action, token, input) = (parts.next(), parts.next(), parts.next());
                (
                    action.unwrap_or_default().to_owned(),
                    token.unwrap_or_default().to_owned(),
                    serde_json::from_str(input.unwrap_or("null")).unwrap_or(Value::Null),
                )
            })
            .collect()
    }

    /// One Action as the shell's `act` invokes it by the person's press, and its owner's answer.
    fn pressed(action: &str, input: Value) -> crate::KernelOp {
        crate::KernelOp::InvokeAction {
            project: None,
            invocation: crate::action::ActionInvocation {
                action: action.into(),
                target_ref: action.into(),
                input: Some(input),
            },
            channel: Channel::PersonPress,
        }
    }

    fn answering(data: Value) -> Result<crate::KernelOpOutcome, String> {
        Ok(crate::KernelOpOutcome {
            receipts: Vec::new(),
            read_scopes: None,
            result: crate::KernelOpResult::ActionDispatched {
                dispatch: crate::action::ActionDispatch::Invoked {
                    owner_operation: "owner".into(),
                    data,
                },
                reads_only: false,
            },
        })
    }

    /// Each receipt names its act, the product that did it, what it moved as its owner answered (the session a seat opened, the
    /// attempt a task's run made), where it stands (the owner's own ref for it, else the World it was made in: the project it
    /// names, the project its Run's Factory state stands in, else the root) and the session it was made in (O-I #1007).
    #[test]
    fn each_receipt_names_its_act_subject_source_and_session() {
        let (client, dir) = central_recording("names");
        let client = client.with_person_token("person-token");
        // A World with a project, as Central keeps one: its manifest, and the authority contract at the World's root.
        let world = dir.join("world");
        std::fs::create_dir_all(world.join("Control/user")).unwrap();
        std::fs::write(
            world.join("Control/user/native-action-authority.json"),
            "{}",
        )
        .unwrap();
        std::fs::create_dir_all(world.join("Work/atelier/ProjectCentral")).unwrap();
        std::fs::write(
            world.join("Work/atelier/ProjectCentral/project.json"),
            r#"{"project_id":"atelier"}"#,
        )
        .unwrap();
        let state = world.join("Work/atelier/.factory/state");
        let lay = |op: crate::KernelOp, answer: Value| {
            Receipt::of(&op)
                .expect("the act lays a receipt")
                .lay(&client, &answering(answer))
        };
        lay(
            pressed(
                "factory.session.start",
                json!({"world": world, "project": "atelier", "agent": "claude-code"}),
            ),
            json!({"contract": "factory.session/v1", "state": "open", "session": "agent-session/seat",
                "track": "session-space/seat:agent-session/seat", "project": "atelier"}),
        );
        lay(
            pressed(
                "factory.task.run",
                json!({"state": state, "run_ref": "run:1", "session": "agent-session/seat"}),
            ),
            json!({"state": "running", "run_ref": "run:1", "unit_ref": "unit:1", "attempt_ref": "attempt:1",
                "task_ref": "task:1", "session": "agent-session/seat"}),
        );
        lay(
            pressed(
                "central.files.write",
                json!({"project": null, "location": {"path": "Control/user/flows/page.html", "ref": "central:source:control:root:Control/user/flows/page.html"}}),
            ),
            json!({"revision": "r2"}),
        );
        lay(
            pressed("central.time.policy.adopt", json!({"actor_kind": "human"})),
            json!({"adopted": true, "source_ref": "central:source:control:root:Control/config/time.json"}),
        );
        let laid = calls(&dir);
        let _ = std::fs::remove_dir_all(&dir);
        let entries: Vec<(&str, &str, &str, &Value)> = laid
            .iter()
            .map(|(action, token, input)| {
                assert_eq!(action, RECEIPT_RECORD);
                assert_eq!(token, "person-token");
                (
                    input["act"].as_str().unwrap_or_default(),
                    input["subject"].as_str().unwrap_or_default(),
                    input["source"].as_str().unwrap_or_default(),
                    &input["session"],
                )
            })
            .collect();
        assert_eq!(
            entries,
            [
                (
                    "factory.session.start",
                    "agent-session/seat",
                    "project:atelier",
                    &json!("agent-session/seat")
                ),
                (
                    "factory.task.run",
                    "attempt:1",
                    "project:atelier",
                    &json!("agent-session/seat")
                ),
                (
                    "central.files.write",
                    "Control/user/flows/page.html",
                    "central:source:control:root:Control/user/flows/page.html",
                    &Value::Null
                ),
                (
                    "central.time.policy.adopt",
                    "central:source:control:root:Control/config/time.json",
                    "central:source:control:root:Control/config/time.json",
                    &Value::Null
                ),
            ]
        );
        assert_eq!(laid[0].2["owner"], "Factory");
        assert_eq!(laid[3].2["owner"], "Central");
    }

    /// An act of the person's press made before their credential exists (Setup's time policy and placement, adopted before the
    /// Ground Accept keeps their grant) waits, and is laid with its own instant ahead of the first act that carries the credential
    /// (O-I #1007): Central refuses a receipt on no credential, so none is asked for meanwhile.
    #[test]
    fn a_receipt_made_before_the_persons_credential_waits_and_is_laid_at_its_own_instant() {
        let (client, dir) = central_recording("held");
        let lay = |client: &CentralClient, action: &str| {
            Receipt::of(&pressed(
                action,
                json!({"location": {"path": format!("Control/user/{action}.json")}}),
            ))
            .expect("the act lays a receipt")
            .lay(client, &answering(json!({})))
        };
        lay(&client, "central.time.policy.adopt");
        lay(&client, "central.ground.placement.adopt");
        assert!(
            calls(&dir).is_empty(),
            "no receipt is asked for on no credential"
        );
        std::thread::sleep(std::time::Duration::from_millis(1100));
        let client = client.with_person_token("person-token");
        lay(&client, "central.day.settings.write");
        let laid = calls(&dir);
        let _ = std::fs::remove_dir_all(&dir);
        let acts: Vec<(&str, &str)> = laid
            .iter()
            .map(|(_, token, input)| (input["act"].as_str().unwrap_or_default(), token.as_str()))
            .collect();
        assert_eq!(
            acts,
            [
                ("central.time.policy.adopt", "person-token"),
                ("central.ground.placement.adopt", "person-token"),
                ("central.day.settings.write", "person-token"),
            ]
        );
        let at = |n: usize| laid[n].2["occurred_at_unix_seconds"].as_u64().unwrap();
        assert!(
            at(0) <= at(1) && at(1) < at(2),
            "each laid at the instant it was made: {} {} {}",
            at(0),
            at(1),
            at(2)
        );
    }

    /// A session's end files what it yielded (manual §18.2, R36; O-I #1007): after the end's own receipt, Central's filing of the
    /// session's yield, on the same credential, for the session the end names, whether Factory ended it or AIKit's End did. No
    /// other act files a yield, and an end that came by a wire files none.
    #[test]
    fn a_sessions_end_files_what_it_yielded() {
        let (client, dir) = central_recording("yield");
        let client = client.with_person_token("person-token");
        let lay = |op: crate::KernelOp, answer: Value| {
            Receipt::of(&op)
                .expect("the act lays a receipt")
                .lay(&client, &answering(answer))
        };
        lay(
            pressed(
                "factory.task.write",
                json!({"project": "atelier", "session": "agent-session/seat", "instruction": "words"}),
            ),
            json!({"state": "written", "run_ref": "run:1", "session": "agent-session/seat"}),
        );
        lay(
            pressed(
                "factory.session.end",
                json!({"project": "atelier", "session": "agent-session/seat"}),
            ),
            json!({"state": "ended", "session": "agent-session/seat"}),
        );
        lay(
            pressed(
                "aikit.session.end",
                json!({"agent_session": "agent-session/chat"}),
            ),
            json!({"schema": "aikit.encounter-end/v1", "agent_session": "agent-session/chat",
                "session_ref": "aikit:session:claude:agent-session/chat", "ended": true}),
        );
        let mut by_wire = pressed(
            "aikit.session.end",
            json!({"agent_session": "agent-session/other"}),
        );
        if let crate::KernelOp::InvokeAction { channel, .. } = &mut by_wire {
            *channel = Channel::Wire;
        }
        lay(
            by_wire,
            json!({"agent_session": "agent-session/other", "ended": true}),
        );
        let laid = calls(&dir);
        let _ = std::fs::remove_dir_all(&dir);
        let asked: Vec<(&str, &str)> = laid
            .iter()
            .map(|(action, _, input)| {
                (
                    action.as_str(),
                    input["act"]
                        .as_str()
                        .or_else(|| input["session"].as_str())
                        .unwrap_or_default(),
                )
            })
            .collect();
        assert_eq!(
            asked,
            [
                (RECEIPT_RECORD, "factory.task.write"),
                (RECEIPT_RECORD, "factory.session.end"),
                (SESSION_YIELD, "agent-session/seat"),
                (RECEIPT_RECORD, "aikit.session.end"),
                (SESSION_YIELD, "agent-session/chat"),
            ]
        );
        assert!(laid.iter().all(|(_, token, _)| token == "person-token"));
        assert_eq!(laid[0].2["subject"], "run:1");
        assert_eq!(laid[0].2["session"], "agent-session/seat");
        assert_eq!(laid[3].2["subject"], "agent-session/chat");
        assert_eq!(laid[3].2["session"], "agent-session/chat");
        assert_eq!(laid[2].2["session"], "agent-session/seat");
        assert!(
            laid[2].2["project"].is_null(),
            "filed in your world's root register"
        );
    }
}
