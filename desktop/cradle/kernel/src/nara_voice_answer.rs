//! Select speech text from the native completed turn, never renderer-supplied
//! answer text. Native chunk boundaries, user turns and terminal receipts stay
//! authoritative, as in the existing Nara Return route.
use crate::agency::{Client, EncounterRequest};
use serde_json::{json, Value};
use std::path::Path;
struct Run {
    ids: Vec<u64>,
    kind: String,
    text: String,
}
fn runs(blocks: &[Value]) -> Result<Vec<Run>, String> {
    let mut result: Vec<Run> = Vec::new();
    let mut previous = None;
    for block in blocks {
        let id = block["id"]
            .as_u64()
            .ok_or("Native transcript block has no identity")?;
        if previous.is_some_and(|p| p >= id) {
            return Err("Native transcript order is ambiguous".into());
        }
        previous = Some(id);
        let kind = block["kind"]
            .as_str()
            .ok_or("Native transcript block has no kind")?;
        let text = block["text"]
            .as_str()
            .ok_or("Native transcript block has no text")?;
        if matches!(kind, "user" | "assistant") && result.last().is_some_and(|r| r.kind == kind) {
            let last = result.last_mut().unwrap();
            last.ids.push(id);
            last.text.push_str(text);
        } else {
            result.push(Run {
                ids: vec![id],
                kind: kind.into(),
                text: text.into(),
            });
        }
    }
    Ok(result)
}
fn boundary(kind: &str) -> bool {
    matches!(kind, "user" | "completed" | "cancelled" | "error")
}
pub(crate) fn read_completed(
    client: &Client,
    cwd: &Path,
    project: &str,
    session: &str,
    block: u64,
) -> Result<Value, String> {
    let mut before = None;
    let mut blocks = Vec::new();
    let mut bytes = 0usize;
    for _ in 0..32 {
        let page = client.encounter(
            cwd,
            project,
            &EncounterRequest::View {
                agent_session: session.into(),
                before,
            },
        )?;
        if page["schema"] != "aikit.encounter-view/v1"
            || page["agent_session"] != session
            || page["connection"]["state"] != "Resident"
            || !page["connection"]["error"].is_null()
        {
            return Err(
                "The native conversation must be connected and idle before reviewing an answer"
                    .into(),
            );
        }
        let rows = page["blocks"]
            .as_array()
            .ok_or("Native transcript blocks unavailable")?;
        bytes = bytes.saturating_add(serde_json::to_vec(rows).map_err(|e| e.to_string())?.len());
        if bytes > 2 * 1024 * 1024 {
            return Err("Native answer exceeds bounded native history".into());
        }
        let next = rows.first().and_then(|v| v["id"].as_u64());
        let more = page["more"] == true;
        let mut joined = rows.clone();
        joined.extend(blocks);
        blocks = joined;
        let runs = runs(&blocks)?;
        if let Some(index) = runs
            .iter()
            .position(|r| r.kind == "assistant" && r.ids.contains(&block))
        {
            if let Some(prior) = (0..index).rev().find(|i| boundary(&runs[*i].kind)) {
                if runs[prior].kind != "user" {
                    return Err("This answer is not attached to its original user turn".into());
                }
                if prior == 0 && more { // user text may begin on an earlier page
                } else {
                    let terminal = runs[index + 1..].iter().find(|r| boundary(&r.kind));
                    if !terminal.is_some_and(|r| r.kind == "completed") {
                        return Err("The selected answer's own native turn did not complete".into());
                    }
                    let input: Value = serde_json::from_str(&runs[prior].text)
                        .map_err(|_| "The answer has no complete native identity context")?;
                    let answer = &runs[index];
                    if answer.text.trim().is_empty() {
                        return Err("The native answer contains no text".into());
                    }
                    return Ok(json!({"schema":"oi.native-completed-turn/v1",
                        "agent_session_ref":session,"answer_block_ids":answer.ids,
                        "question_block_ids":runs[prior].ids,"text":answer.text,
                        "input":input,"standing":"native-completed-turn"}));
                }
            }
        }
        if !more || next.is_none() || before.is_some_and(|b| next.is_some_and(|n| n >= b)) {
            break;
        }
        before = next;
    }
    Err("The complete answer, original question and completion were not found within bounded native history".into())
}

/// Speech uses the same native completed-turn reconstruction as reviewed Epii
/// returns, with the additional current-context and source admission below.
pub(crate) fn read(
    client: &Client,
    cwd: &Path,
    project: &str,
    session: &str,
    block: u64,
    context: &Value,
) -> Result<Value, String> {
    let turn = read_completed(client, cwd, project, session, block)?;
    let input = &turn["input"];
    if input["schema"] != "oi.nara-dialogue-input/v1" || input["role"] != "nara" {
        return Err("This is not a native Nara answer".into());
    }
    for key in [
        "nara_ref",
        "subject_ref",
        "agent_session_ref",
        "profile_ref",
        "profile_revision",
        "expression_ref",
        "expression_revision",
        "scene_ref",
        "pointed_ref",
        "hovered_ref",
        "pinned_refs",
        "occasion",
        "active_m_focus",
        "m4_branch",
        "coordinate_ref",
        "bimba",
        "shared_field",
        "shared_reading",
        "disclosed",
        "available_action_refs",
        "expressive_act",
        "c_prime",
    ] {
        if input["context"][key] != context[key] {
            return Err(format!(
                "The answer's {key} differs from the current native voice context"
            ));
        }
    }
    let identity = &input["identity"]["source"];
    let disclosed = context["disclosed"].as_array().is_some_and(|rows| {
        rows.iter().any(|row| {
            row["ref_id"] == identity["source_ref"]
                && row["revision"] == identity["revision"]
                && row["disclosure"] == "personal-consent"
        })
    });
    let profile = &input["expression"]["profile"];
    let profile_matches = if profile.is_object() {
        profile["ref"] == context["profile_ref"]
            && profile["revision"] == context["profile_revision"]
    } else {
        identity["source_ref"] == context["profile_ref"]
            && identity["revision"] == context["profile_revision"]
    };
    if input["context"]["agent_session_ref"] != session || !disclosed || !profile_matches {
        return Err("Native answer source binding is inconsistent".into());
    }
    Ok(
        json!({"schema":"oi.nara-voice-answer/v1","agent_session_ref":session,
        "answer_block_ids":turn["answer_block_ids"],"question_block_ids":turn["question_block_ids"],
        "text":turn["text"],"context":input["context"],"standing":"native-completed-turn"}),
    )
}
