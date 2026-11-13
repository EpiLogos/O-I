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
/// opens it on its civil date, makes its page from the Day form, and closes an earlier Day still open at its turn, as the
/// person's adopted civil-time policy determines; asked again with nothing to turn, it writes nothing. The Day form is offered
/// only when Central asks for it (`ground_form::day_form`). Where Central does not turn the Day (a policy that keeps it from
/// turning by itself, or a Central without the turn), today's Day is read as it stands and a pointer left on an earlier civil
/// Day is refused with Central's words.
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

/// Central's turn of today's Day (`central.day.turn`): asked first with no form, and again with the Day form only where today's
/// Day stands without its page and Central asks for one (`wants-form`). Where the turn moved anything (a Day opened or closed, a
/// page made), every reading the kernel holds retires, once: the turn is Central's derived write, so nothing else retires them.
fn turn(client: &CentralClient, project: Option<&str>) -> Result<Value, String> {
    // A Central whose catalogue does not name the turn is not asked for it: an id the kernel cannot class would count as a write
    // and retire every reading on each read of the Day (action.rs `reads`).
    if client.mutation_class(TURN).is_none() {
        return Err(format!("Central's Action field names no {TURN}"));
    }
    let mut value = client
        .run(TURN, json!({"project":project}))
        .map_err(|e| e.to_string())?;
    if value["turn"]["document"]["state"] == "wants-form" {
        if let Some(form) = crate::ground_form::day_form(client) {
            value = client
                .run(TURN, json!({"project":project,"form":form}))
                .map_err(|e| e.to_string())?;
        }
    }
    let turned = &value["turn"];
    if turned["opened"] == true
        || turned["document"]["state"] == "made"
        || turned["closed"].as_array().is_some_and(|closed| !closed.is_empty())
    {
        crate::read_cache::written();
    }
    Ok(value)
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
/// Where a receipt's owner answer is kept whole; past it, only its plain fields are kept.
const RECEIPT_ANSWER_BYTES: usize = 12 * 1024;

/// What one act lays into the Day of the civil date it happened on (manual §18.2 "a write arrives with its receipt"; O-I #1005
/// for the gate's act 5, the whole of it O-I #1007): an Action that writes, a passage sent to an agent, a Factory act. Taken from
/// the op before it runs, laid once its owner answered; a refused act lays none, and an Action the kernel took as a reading lays
/// none. The receipt is Central's record of what the act did, never the person's writing, so it carries no one's credential.
pub(crate) struct Receipt {
    act: String,
    owner: String,
    input: Value,
    subject: Option<String>,
}

impl Receipt {
    /// What `op` lays when its owner answers, if it is an act that lays one.
    pub(crate) fn of(op: &crate::KernelOp) -> Option<Self> {
        match op {
            crate::KernelOp::InvokeAction { invocation, .. } => {
                let action = invocation.action.as_str();
                if matches!(action, TURN | RECEIPT_RECORD) || action.starts_with("action:decision.") {
                    return None;
                }
                let input = invocation.input.clone().unwrap_or(Value::Null);
                Some(Self {
                    act: action.to_owned(),
                    owner: owner_of(action).to_owned(),
                    subject: subject_of(&input)
                        .or_else(|| Some(invocation.target_ref.clone()).filter(|r| !r.is_empty())),
                    input,
                })
            }
            crate::KernelOp::Encounter {
                request: crate::agency::EncounterRequest::Prompt { agent_session, .. },
                ..
            } => Some(Self {
                act: "encounter.prompt".into(),
                owner: "AIKit".into(),
                input: Value::Null,
                subject: Some(agent_session.clone()),
            }),
            crate::KernelOp::FactoryOwner { request, .. } if !request.is_read() => {
                let input = serde_json::to_value(request).unwrap_or(Value::Null);
                Some(Self {
                    act: format!("factory.{}", input["kind"].as_str().unwrap_or("act")),
                    owner: "Factory".into(),
                    subject: subject_of(&input),
                    input,
                })
            }
            _ => None,
        }
    }

    /// Lay it into today's Day of the root register, once its owner answered. A Central whose catalogue names no receipt record is
    /// not asked; a receipt Central refuses is said on the host's log and leaves the act as it was.
    pub(crate) fn lay(self, client: &CentralClient, result: &Result<crate::KernelOpOutcome, String>) {
        let Ok(outcome) = result else {
            return;
        };
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
        let Some(subject) = self.subject.or_else(|| subject_of(&answer)) else {
            return;
        };
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
        let source = source_of(&self.input).or_else(|| source_of(&answer));
        let input = json!({"project": null, "receipt_id": receipt_id, "act": self.act, "owner": self.owner,
            "subject": subject, "source": source, "receipt": bounded(answer),
            "occurred_at_unix_seconds": at.as_secs()});
        match client.run(RECEIPT_RECORD, input) {
            Ok(_) => crate::world_model::Model::global().written(&[crate::world_model::Slice::Day]),
            Err(error) => eprintln!("the Day's receipt of {} was not laid: {error}", self.act),
        }
    }
}

/// The product an Action id belongs to, by its own spelling.
fn owner_of(action: &str) -> &str {
    match action.split(['.', ':', '/']).next().unwrap_or(action) {
        "central" | "projectcentral" | "control" | "personal" | "agent-profile" | "action" => "Central",
        "aikit" | "knowledge" => "AIKit",
        "factory" => "Factory",
        "workcell" | "seat" => "Workcell",
        "actuation" => "Actuation",
        "ql" | "nara" => "QL",
        other => other,
    }
}

/// What an act acted on, by the owner's own spelling: a file's path, else the first ref it names.
fn subject_of(value: &Value) -> Option<String> {
    const REFS: [&str; 17] = [
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
