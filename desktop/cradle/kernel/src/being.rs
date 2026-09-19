//! SF3 projected-Agent delivery through AIKit's existing native SessionSpace
//! encounter owner. Configuration names one candidate canonical AgentSession;
//! the owner re-admits its Agent, authority, source sharing and binding CAS
//! before any projected material reaches the resident provider.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    io::Read,
    path::PathBuf,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "operation", rename_all = "snake_case")]
pub enum Request {
    Standing {
        agent_ref: String,
        target_agency_ref: String,
        source_refs: Vec<Value>,
    },
    Invoke {
        agent_ref: String,
        target_agency_ref: String,
        subject_ref: String,
        #[serde(default)]
        source_refs: Vec<Value>,
        expression_ref: String,
        expression_revision: u64,
        composition: Value,
        instruction: String,
        invocation_ref: String,
        return_ref: String,
    },
}
#[derive(Clone, Debug, Deserialize)]
struct Controller {
    socket: String,
    sender: String,
    candidate_session: String,
    cwd: PathBuf,
}
fn controller() -> Result<Controller, String> {
    let raw=std::env::var("OI_SHARED_AGENT_CONTROLLER").map_err(|_|"No local AIKit SessionSpace encounter binding is configured (OI_SHARED_AGENT_CONTROLLER).".to_string())?;
    serde_json::from_str(&raw)
        .map_err(|error| format!("Unreadable OI_SHARED_AGENT_CONTROLLER: {error}"))
}
fn executable() -> PathBuf {
    // The session-space verbs live in the main aikit binary (O-I #376 fold);
    // invocations prepend the `session-space` subcommand.
    std::env::var_os("OI_AIKIT_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| "aikit".into())
}
fn clean(value: &str) -> bool {
    !value.trim().is_empty()
}
fn refs(values: &[Value]) -> Result<Vec<String>, String> {
    values
        .iter()
        .map(|value| {
            let reference = value
                .get("ref")
                .and_then(Value::as_str)
                .ok_or("Projected source reading has no ref")?;
            let revision = value
                .get("revision")
                .and_then(|value| {
                    value
                        .as_str()
                        .map(str::to_owned)
                        .or_else(|| value.as_u64().map(|number| number.to_string()))
                })
                .ok_or("Projected source reading has no revision")?;
            if !clean(reference) || !clean(&revision) {
                return Err("Projected source reading has an empty ref or revision".into());
            }
            Ok(reference.to_owned())
        })
        .collect()
}
fn owner(controller: &Controller, request: Value) -> Result<Value, String> {
    let mut child = Command::new(executable())
        .arg("session-space")
        .args(["-C"])
        .arg(&controller.cwd)
        .args([
            "encounter",
            "--request-json",
            &request.to_string(),
            "--socket",
            &controller.socket,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;
    let mut stdout_pipe = child.stdout.take().unwrap();
    let mut stderr_pipe = child.stderr.take().unwrap();
    let stdout_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = stdout_pipe.read_to_end(&mut bytes);
        bytes
    });
    let stderr_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = stderr_pipe.read_to_end(&mut bytes);
        bytes
    });
    let deadline = Instant::now() + Duration::from_secs(10);
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
            break status;
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Timed out awaiting the native AIKit encounter owner".into());
        }
        thread::sleep(Duration::from_millis(20));
    };
    let stdout_bytes = stdout_reader
        .join()
        .map_err(|_| "AIKit owner stdout reader failed")?;
    let stderr_bytes = stderr_reader
        .join()
        .map_err(|_| "AIKit owner stderr reader failed")?;
    let stdout = String::from_utf8_lossy(&stdout_bytes);
    let value = serde_json::from_str::<Value>(&stdout)
        .ok()
        .or_else(|| {
            stdout
                .lines()
                .filter_map(|line| serde_json::from_str::<Value>(line).ok())
                .next_back()
        })
        .ok_or_else(|| {
            format!(
                "AIKit encounter owner returned no JSON: {}",
                String::from_utf8_lossy(&stderr_bytes)
            )
        })?;
    if !status.success() || value.get("ok") == Some(&Value::Bool(false)) {
        Err(value
            .get("error")
            .map(Value::to_string)
            .unwrap_or_else(|| value.to_string()))
    } else {
        Ok(value.get("data").cloned().unwrap_or(value))
    }
}

fn delivery_events(
    controller: &Controller,
    target: &Value,
    delivery: &Value,
) -> Result<Value, String> {
    let delivery_ref = delivery
        .get("delivery_ref")
        .and_then(Value::as_str)
        .ok_or("Native delivery receipt has no delivery_ref")?;
    let terminal = delivery
        .get("terminal_cursor")
        .and_then(Value::as_u64)
        .ok_or("Returned native delivery has no terminal_cursor")?;
    let mut cursor = delivery
        .get("first_cursor")
        .and_then(Value::as_u64)
        .ok_or("Native delivery receipt has no first_cursor")?;
    let mut matched = Vec::new();
    let mut response_text = String::new();
    while cursor < terminal {
        let reading = owner(
            controller,
            json!({"action":"read","agent_session":target["agent_session"],"after":cursor,"limit":128}),
        )?;
        let rows = reading
            .get("events")
            .and_then(Value::as_array)
            .ok_or("Native encounter read has no events")?;
        if rows.is_empty() {
            return Err("Native encounter read ended before the delivery terminal cursor".into());
        }
        for row in rows {
            let row_cursor = row
                .get("cursor")
                .and_then(Value::as_u64)
                .ok_or("Native encounter event has no cursor")?;
            if row_cursor > terminal {
                break;
            }
            let event_ref = row
                .pointer("/event/delivery_ref")
                .and_then(Value::as_str)
                .ok_or("Native delivery event has no delivery_ref")?;
            if event_ref != delivery_ref {
                return Err("Native encounter read crossed into a different delivery".into());
            }
            if row
                .pointer("/event/event/Signal/kind/kind")
                .and_then(Value::as_str)
                == Some("agent-message-chunk")
            {
                if let Some(text) = row
                    .pointer("/event/event/Signal/kind/text")
                    .and_then(Value::as_str)
                {
                    response_text.push_str(text);
                }
            }
            matched.push(row.clone());
            cursor = row_cursor;
        }
        if rows
            .iter()
            .all(|row| row.get("cursor").and_then(Value::as_u64).unwrap_or(0) <= cursor)
            && cursor < terminal
            && reading.get("more") != Some(&Value::Bool(true))
        {
            return Err("Native encounter read did not recover the complete delivery".into());
        }
    }
    if cursor != terminal {
        return Err("Native encounter events do not end at their delivery terminal cursor".into());
    }
    if response_text.trim().is_empty() {
        return Err("Native returned delivery has no attributable Agent response text".into());
    }
    Ok(
        json!({"agent_session":target["agent_session"],"delivery_ref":delivery_ref,"first_cursor":delivery["first_cursor"],"terminal_cursor":terminal,"events":matched,"response_text":response_text}),
    )
}
fn standing(
    controller: &Controller,
    agent_ref: &str,
    source_refs: &[Value],
) -> Result<Value, String> {
    let sources = refs(source_refs)?;
    let value = owner(
        controller,
        json!({"action":"addressable-participants","request":{"sender":controller.sender,"source_refs":sources,"candidate_sessions":[controller.candidate_session]}}),
    )?;
    let matches = value
        .get("participants")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|row| {
            row.get("agent_ref").and_then(Value::as_str) == Some(agent_ref)
                && row.get("agent_session").and_then(Value::as_str)
                    == Some(controller.candidate_session.as_str())
        })
        .cloned()
        .collect::<Vec<_>>();
    if matches.len() != 1 {
        return Err(format!("AIKit encounter owner found {} exact addressable sessions for projected Agent {agent_ref}",matches.len()));
    }
    Ok(matches[0].clone())
}

pub fn apply(request: Request) -> Value {
    let (agent_ref, target_agency_ref, source_refs) = match &request {
        Request::Standing {
            agent_ref,
            target_agency_ref,
            source_refs,
        }
        | Request::Invoke {
            agent_ref,
            target_agency_ref,
            source_refs,
            ..
        } => (
            agent_ref.clone(),
            target_agency_ref.clone(),
            source_refs.clone(),
        ),
    };
    if !clean(&agent_ref) || !clean(&target_agency_ref) {
        return json!({"state":"refused","detail":"Projected Agent identity and agency are required."});
    }
    let controller = match controller() {
        Ok(value) => value,
        Err(detail) => return json!({"state":"unavailable","detail":detail}),
    };
    let target = match standing(&controller, &agent_ref, &source_refs) {
        Ok(value) => value,
        Err(detail) => {
            return json!({"state":"unavailable","owner_operation":"aikit encounter addressable-participants","detail":detail})
        }
    };
    let Request::Invoke {
        subject_ref,
        expression_ref,
        expression_revision,
        composition,
        instruction,
        invocation_ref,
        return_ref,
        ..
    } = request
    else {
        return json!({"state":"available","owner_operation":"aikit encounter addressable-participants","target":target,"projected_agency_ref":target_agency_ref});
    };
    if instruction.trim().is_empty() {
        return json!({"state":"refused","detail":"Invocation instruction is empty."});
    }
    if composition.get("schema").and_then(Value::as_str) != Some("oi.expression-composition/v1")
        || composition.get("expression_ref").and_then(Value::as_str)
            != Some(expression_ref.as_str())
        || composition.get("revision").and_then(Value::as_u64) != Some(expression_revision)
    {
        return json!({"state":"refused","detail":"The admitted Expression composition does not match its projected ref and revision."});
    }
    let sources = match refs(&source_refs) {
        Ok(value) => value,
        Err(detail) => return json!({"state":"refused","detail":detail}),
    };
    let packet = json!({"schema":"oi.shared-field.agent-invocation/v1","subject_ref":subject_ref,"projected_agency_ref":target_agency_ref,"expression":{"ref":expression_ref,"revision":expression_revision,"composition":composition},"source_readings":source_refs,"instruction":instruction});
    let delivery_ref = format!(
        "delivery/shared-field-{}",
        invocation_ref.replace(
            |c: char| !c.is_ascii_alphanumeric() && c != '-' && c != '_',
            "-"
        )
    );
    let sent = owner(
        &controller,
        json!({"action":"send","agent_session":target["agent_session"],"turn":{"delivery_ref":delivery_ref,"sender":controller.sender,"expected_binding_revision":target["expected_binding_revision"],"packet":{"text":packet.to_string(),"source_refs":sources,"audience":[agent_ref]}}}),
    );
    let sent = match sent {
        Ok(value) => value,
        Err(detail) => {
            return json!({"state":"refused","owner_operation":"aikit encounter send","detail":detail})
        }
    };
    let deadline = Instant::now() + Duration::from_secs(120);
    let mut poll_delay = Duration::from_millis(250);
    let delivery = loop {
        match owner(
            &controller,
            json!({"action":"delivery","agent_session":target["agent_session"],"delivery_ref":delivery_ref}),
        ) {
            Ok(value) => {
                if matches!(
                    value.get("phase").and_then(Value::as_str),
                    Some("returned" | "failed" | "cancelled" | "uncertain")
                ) {
                    break value;
                }
            }
            Err(detail) => {
                return json!({"state":"unavailable","owner_operation":"aikit encounter delivery","detail":detail})
            }
        }
        if Instant::now() >= deadline {
            return json!({"state":"unavailable","owner_operation":"aikit encounter delivery","detail":"Timed out awaiting an attributable native provider Return","delivery":sent});
        }
        thread::sleep(poll_delay);
        poll_delay = (poll_delay * 2).min(Duration::from_secs(2));
    };
    if delivery.get("phase").and_then(Value::as_str) != Some("returned") {
        return json!({"state":"refused","owner_operation":"aikit encounter delivery","detail":"The native provider did not return a completed turn","delivery":delivery});
    }
    let events = match delivery_events(&controller, &target, &delivery) {
        Ok(value) => value,
        Err(detail) => {
            return json!({"state":"unavailable","owner_operation":"aikit encounter read","detail":detail,"delivery":delivery})
        }
    };
    json!({"state":"invoked","owner_operation":"aikit encounter send/delivery/read","invocation_ref":invocation_ref,"return_ref":return_ref,"target":target,"projected_agency_ref":target_agency_ref,"delivery":delivery,"events":events})
}
