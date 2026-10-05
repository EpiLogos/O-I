//! On-demand TA0 disclosure over existing native owners. A successful read is
//! not an authority grant, provider invocation, human Recognition or Day event.
use crate::{agency, nara_dialogue};
use serde_json::{json, Value};
use std::{
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

fn reading(aspect: &str, owner: &str, status: &str, basis: Value, reason: Option<&str>) -> Value {
    json!({"aspect":aspect,"owner":owner,"status":status,"basis":basis,"reason":reason})
}
fn missing(aspect: &str, owner: &str, reason: &str) -> Value {
    reading(aspect, owner, "not-observed", Value::Null, Some(reason))
}
fn native_result(aspect: &str, result: Result<Value, String>) -> Value {
    match result {
        Ok(value) => reading(aspect, "aikit", "observed", value, None),
        Err(error) => reading(aspect, "aikit", "unavailable", Value::Null, Some(&error)),
    }
}

pub(crate) fn read(
    agency: &agency::Client,
    cwd: &Path,
    project: &str,
    request: &nara_dialogue::Request,
    context: &Value,
    document: &Value,
) -> Result<Value, String> {
    let canonical = nara_dialogue::Binding::new(project, request)?;
    if context["context"]["agent_session_ref"] != canonical.agent_session
        || context["context"]["subject_ref"] != request.person_ref
        || context["context"]["expression_ref"] != document["expression_ref"]
    {
        return Err("Runtime disclosure has a different native context basis".into());
    }
    // Read the exact persisted relation. No provision/open/start operation is
    // used merely to make readiness appear available.
    let attachment = (|| {
        let states = agency.read_project(cwd, project)?;
        let state = states
            .as_array()
            .ok_or("AIKit returned no SessionSpace inventory")?
            .iter()
            .find(|state| state["definition"]["id"] == canonical.space);
        let Some(state) = state else {
            return Ok(None);
        };
        canonical.validate_state(state, project)?;
        if state["agent_sessions"][&canonical.agent_session] != canonical.attachment() {
            return Ok(None);
        }
        Ok::<_, String>(Some(
            json!({"session_space_ref":canonical.space,"agent_session_ref":canonical.agent_session,
            "attachment":state["agent_sessions"][&canonical.agent_session],"standing":"persisted attachment; live provider not implied"}),
        ))
    })();
    let attached = matches!(&attachment, Ok(Some(_)));
    let session = match attachment {
        Ok(Some(value)) => reading("session", "aikit", "observed", value, None),
        Ok(None) => missing(
            "session",
            "aikit",
            "This exact Nara/Expression relation has no persisted native AgentSession attachment",
        ),
        Err(error) => reading("session", "aikit", "unavailable", Value::Null, Some(&error)),
    };
    let (provider, speech) = if attached {
        let provider = match agency.recorded_encounter_binding(
            cwd,
            project,
            &canonical.agent_session,
        ) {
            Ok(Some(value)) => reading(
                "provider",
                "aikit",
                "observed",
                json!({
                "agent_session_ref":canonical.agent_session,"provider":value["provider"],
                "native_session_id":value["native_session_id"],"standing":"last journal-observed binding; current liveness not inferred"}),
                None,
            ),
            Ok(None) => missing(
                "provider",
                "aikit",
                "No native provider binding is recorded for this AgentSession",
            ),
            Err(error) => reading(
                "provider",
                "aikit",
                "unavailable",
                Value::Null,
                Some(&error),
            ),
        };
        let speech = native_result("speech", agency.local_speech_read(cwd, &canonical.agent_session).map(|value| json!({
            "schema":value["schema"],"agent_session_ref":value["agent_session_ref"],
            "configuration_revision":value["configuration_revision"],"acting_body":value["acting_body"],
            "runtime":value["runtime"],"probes":value["probes"],"conditions":value["conditions"],
            "standing":"native owner disclosure; no capture, inference or playback requested"})));
        (provider, speech)
    } else {
        (
            missing(
                "provider",
                "aikit",
                "An exact native session attachment is required",
            ),
            missing(
                "speech",
                "aikit",
                "An exact native session attachment is required",
            ),
        )
    };
    let c = &context["context"];
    let source = reading(
        "source",
        "central/ql-mef",
        "observed",
        json!({"identity_source":context["identity_source"],
        "world":context["world"],"property_sources":context["coordinate_binding"]["property_sources"]}),
        None,
    );
    let profile = reading(
        "profile",
        "expression",
        "observed",
        json!({"profile":context["profile"],
        "lineage":context["containing_coordinate_binding"]["inherited_profiles"],"authored_variant_refs":context["containing_coordinate_binding"]["authored_variant_refs"],
        "variant_standing":"only variants resolved by the current source producer; empty is not a complete source census"}),
        None,
    );
    let occasion = if c["occasion"].is_null() {
        missing(
            "occasion",
            "central",
            "No Central Day/NOW occasion is admitted in this context",
        )
    } else {
        reading(
            "occasion",
            "central",
            "observed",
            c["occasion"].clone(),
            None,
        )
    };
    let current = if c["personal_current"].is_null() {
        missing(
            "personal-current",
            "ql-mef",
            "No current reading is pinned to this exact Nara/Expression basis",
        )
    } else {
        reading(
            "personal-current",
            "ql-mef",
            "observed",
            c["personal_current"].clone(),
            None,
        )
    };
    let actions = reading(
        "actions",
        "expression/native-action-owners",
        "disclosed",
        json!({
        "action_refs":c["available_action_refs"],"permitted_action_refs":Value::Null,"invoked_action_refs":Value::Null,
        "standing":"source-disclosed candidates; authority is checked by the owning action at invocation"}),
        None,
    );
    let capabilities = reading(
        "expression-capabilities",
        "expression",
        "observed",
        crate::expression::capabilities(),
        None,
    );
    let attention = reading(
        "attention",
        "expression",
        "observed",
        json!({"expression_ref":c["expression_ref"],
        "expression_revision":c["expression_revision"],"scene_ref":c["scene_ref"],"selection":document["selection"],
        "nara_ref":c["nara_ref"],"person_ref":c["subject_ref"],"disclosed":c["disclosed"]}),
        None,
    );
    let act = if c["expressive_act"].is_null() {
        missing(
            "expressive-act",
            "expression",
            "No admitted act receipt is present in this context",
        )
    } else {
        reading(
            "expressive-act",
            "expression",
            "observed",
            c["expressive_act"].clone(),
            None,
        )
    };
    let material = missing(
        "renderer",
        "oi-host",
        "Native context does not observe renderer mounting or physical output; use the actual host/effect receipt",
    );
    let mut organs = Vec::new();
    let faculties = context["coordinate_binding"]["ta_onta_faculties"]
        .as_array()
        .ok_or("Native coordinate has no faculty source")?;
    if faculties.len() != 6 {
        return Err("Native coordinate must retain all six existing faculties".into());
    }
    for faculty in faculties {
        let readings = match faculty["id"].as_str() {
            Some("S0′") => vec![
                source.clone(),
                profile.clone(),
                session.clone(),
                material.clone(),
            ],
            Some("S1′") => vec![profile.clone(), capabilities.clone()],
            Some("S2′") => vec![
                session.clone(),
                provider.clone(),
                speech.clone(),
                actions.clone(),
                capabilities.clone(),
            ],
            Some("S3′") => vec![
                source.clone(),
                occasion.clone(),
                current.clone(),
                provider.clone(),
                act.clone(),
            ],
            Some("S4′") => vec![
                attention.clone(),
                session.clone(),
                speech.clone(),
                actions.clone(),
            ],
            Some("S5′") => vec![
                act.clone(),
                missing(
                    "returned-praxis",
                    "aikit/factory/central",
                    "This context does not contain an accepted Method proof, Factory Return or human Recognition receipt",
                ),
            ],
            _ => return Err("Unknown native Ta-Onta faculty identity".into()),
        };
        organs.push(json!({"id":faculty["id"],"label":faculty["label"],"capability_refs":faculty["capability_refs"],
            "native_owners":faculty["native_owners"],"source_standing":faculty["standing"],"readings":readings}));
    }
    Ok(
        json!({"schema":"oi.nara-runtime-readiness/v1","context_ref":c["context_ref"],
        "expression_ref":c["expression_ref"],"expression_revision":c["expression_revision"],
        "observed_at_unix_ms":SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_millis(),
        "faculties":organs,"authority_granted":false,"provider_started":false,
        "standing":"bounded native owner observations; available, selected, disclosed, permitted and invoked remain distinct"}),
    )
}
