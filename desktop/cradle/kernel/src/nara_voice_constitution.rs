//! Translate the native AIKit local cascade reading into Actuation's wire.
//! Sources: AIKit encounter_speech::disclose / model_runtime::StagedModelRuntimeReadModel;
//! Actuation speech::validate_speech_constitution / admission::validate_model_relation.
//! The broker owns saved-person/context admission. The actual Actuation actor
//! must still admit this candidate: this module is not a second native validator.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;

fn text<'a>(v: &'a Value, field: &str) -> Result<&'a str, String> {
    v.as_str()
        .filter(|s| !s.trim().is_empty() && s.len() <= 4096 && !s.chars().any(char::is_control))
        .ok_or_else(|| format!("Native speech reading lacks bounded {field}"))
}
fn same(a: &Value, b: &Value, field: &str) -> Result<(), String> {
    if text(a, field)? != text(b, field)? {
        return Err(format!(
            "Native speech {field} does not match its admitted identity or material"
        ));
    }
    Ok(())
}
fn list<'a>(v: &'a Value, field: &str) -> Result<Vec<&'a str>, String> {
    let values = v
        .as_array()
        .ok_or_else(|| format!("Native speech {field} must be a list"))?;
    if values.len() > 128 {
        return Err(format!("Native speech {field} exceeds its bound"));
    }
    values.iter().map(|value| text(value, field)).collect()
}
fn access(reading: &Value, field: &str) -> Result<Vec<String>, String> {
    match reading["state"].as_str() {
        Some("available") => Ok(list(&reading["capabilities"], field)?
            .into_iter()
            .map(str::to_owned)
            .collect()),
        Some("unavailable") => {
            text(&reading["reason"], field)?;
            Ok(Vec::new())
        }
        _ => Err(format!("Native speech {field} availability is unknown")),
    }
}
fn support(value: &Value, field: &str) -> Result<(), String> {
    match value["state"].as_str() {
        Some("supported") => Ok(()),
        Some("degraded" | "unsupported" | "unknown") => {
            text(&value["reason"], field)?;
            Ok(())
        }
        _ => Err(format!(
            "Native speech {field} has no declared support state"
        )),
    }
}
fn local_endpoint(value: &Value) -> Result<(), String> {
    let url = url::Url::parse(text(value, "endpoint")?).map_err(|e| e.to_string())?;
    let host = url.host_str().unwrap_or("").trim_matches(['[', ']']);
    if url.scheme() != "http"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !host
            .parse::<std::net::IpAddr>()
            .is_ok_and(|v| v.is_loopback())
    {
        return Err(
            "Native local speech stage must disclose a credential-free loopback HTTP endpoint"
                .into(),
        );
    }
    Ok(())
}

fn configured_endpoint(config: &Value, path_key: &str) -> Result<String, String> {
    let host = text(&config["host"], "configured loopback host")?
        .parse::<std::net::IpAddr>()
        .map_err(|e| e.to_string())?;
    let port = config["port"]
        .as_u64()
        .filter(|v| *v > 0 && *v <= u16::MAX as u64)
        .ok_or("Native speech configuration lacks a valid port")?;
    let path = text(&config[path_key], "configured endpoint path")?;
    if !host.is_loopback() || !path.starts_with('/') {
        return Err("Native speech configuration is not a loopback HTTP route".into());
    }
    let host = match host {
        std::net::IpAddr::V4(v) => v.to_string(),
        std::net::IpAddr::V6(v) => format!("[{v}]"),
    };
    Ok(format!("http://{host}:{port}{path}"))
}

fn project_stage(stage: &Value, conditions: &mut Vec<Value>) -> Result<Value, String> {
    let component = text(&stage["component"], "stage component")?;
    let relation = &stage["relation"];
    let surface = &relation["model_surface"];
    let modality = &surface["modality"];
    if modality["schema"] != "aikit.model-modality/v1" {
        return Err(format!("Stage {component} has no native modality contract"));
    }
    same(
        &modality["provider"],
        &relation["engine"]["provider"],
        "stage provider",
    )?;
    for key in ["input_modalities", "output_modalities"] {
        if list(&modality[key], key)?.is_empty() {
            return Err(format!("Stage {component} declares no {key}"));
        }
    }
    let credential = &modality["credential"];
    match credential["condition"].as_str() {
        Some("not-required") => {}
        Some("satisfied") => {
            text(&credential["binding_ref"], "credential presence binding")?;
        }
        _ => {
            return Err(format!(
                "Stage {component} has no satisfied native credential condition"
            ))
        }
    }
    match modality["availability"]["state"].as_str() {
        Some("available") => {}
        Some("degraded") => conditions.push(json!({"condition":"degraded",
            "reason":format!("{component}: {}", text(&modality["availability"]["reason"], "availability reason")?)})),
        _ => return Err(format!("Stage {component} is unavailable or its availability is unknown")),
    }
    let stage_access = &surface["access"];
    if stage_access["inference"]["state"] != "available" {
        return Err(format!(
            "Stage {component} has no available inference route"
        ));
    }
    let inference = access(&stage_access["inference"], "inference access")?;
    let control = access(&stage_access["material_control"], "material control access")?;
    // Native AIKit local speech discloses no interior access. Do not flatten a
    // newly available interior capability into an invented Actuation depth.
    if stage_access["interior"]["state"] != "unavailable" {
        return Err(
            "Local speech interior access requires an explicit native depth mapping".into(),
        );
    }
    text(
        &stage_access["interior"]["reason"],
        "interior unavailability",
    )?;
    let material = &relation["materialisation"];
    let placement = match text(&material["placement"], "material placement")? {
        "unknown" => "opaque",
        "local" => "local",
        "remote" => "remote",
        "hybrid" => "distributed",
        _ => return Err("Unrecognised native material placement".into()),
    };
    // When AIKit supplies no dedicated Surface ContractRef, the declared
    // modality schema is the actual contract identity available, not a made-up
    // provider-specific contract. Preserve that distinction in scalar facts.
    let contract = surface["contract"]
        .as_str()
        .unwrap_or("aikit.model-modality/v1");
    text(&json!(contract), "surface contract")?;
    let model_relation = json!({"schema":"actuation.instantiation/v1",
        "model_ref":text(&relation["model"]["model"], "model reference")?,
        "variant_ref":text(&relation["model"]["variant"], "model variant")?,
        "engine":{"implementation_ref":text(&relation["engine"]["engine"], "engine reference")?,
            "provider_ref":text(&relation["engine"]["provider"], "provider reference")?,
            "facts":{"form":text(&relation["engine"]["form"], "engine form")?, "revision":relation["engine"]["revision"]}},
        "material":{"binding_ref":text(&material["binding_ref"], "material binding")?,"placement":placement,
            "facts":{"observed_placement":material["placement"],"endpoint":material["endpoint"],
                "lifetime_owner":text(&material["lifetime_owner"], "material lifetime owner")?}},
        "inference_surface":{"contract_ref":contract,
            "facts":{"protocol":text(&surface["protocol"], "surface protocol")?,
                "dedicated_contract_ref_declared":surface["contract"].is_string()}}});
    Ok(
        json!({"component_ref":component,"model_relation":model_relation,
        "access_profile":{"schema":"actuation.instantiation/v1","inference":{"allowed":inference},
            "control":{"allowed":control},"interior":{"depth":"opaque"}},
        "modality":{"schema":modality["schema"],"input_modalities":modality["input_modalities"],
            "output_modalities":modality["output_modalities"],"transforms":modality["transforms"],
            "interaction":modality["interaction"],"degraded_interaction":modality["degraded_interaction"],
            "transport":modality["transport"],"connection":modality["connection"],
            "availability":modality["availability"],"provider_native_surface":modality["provider_native_surface"],
            "provider_revision":modality["provider_revision"],
            "credential_facts":{"condition":credential["condition"],"hint":credential["hint"],"binding_ref":credential["binding_ref"]},
            "provenance":list(&modality["provenance"], "stage provenance")?}}),
    )
}

/// The result is admitted by `actuation nara serve` before the broker exposes
/// a live voice session. A renderer-supplied reading is never a valid caller.
pub fn from_reading(reading: &Value, context: &Value, resolved_at: &str) -> Result<Value, String> {
    if reading["schema"] != "aikit.local-speech-reading/v1"
        || context["schema"] != "ql.nara-dialogue-context/v1"
    {
        return Err("Expected native local speech reading and QL dialogue context".into());
    }
    if reading["configuration"]["schema"] != "aikit.local-speech-config/v1"
        || !reading["inference_observed"].is_boolean()
    {
        return Err("Native speech configuration or inference observation is missing".into());
    }
    for key in [
        "subject_ref",
        "context_ref",
        "profile_ref",
        "profile_revision",
        "expression_ref",
        "expression_revision",
    ] {
        text(&context[key], key)?;
    }
    same(&reading["agent_ref"], &context["nara_ref"], "Nara AgentRef")?;
    same(
        &reading["agent_session_ref"],
        &context["agent_session_ref"],
        "AgentSession",
    )?;
    let runtime = &reading["runtime"];
    let composition = &reading["composition"];
    if runtime["version"] != "aikit.model-stage-runtime/v1"
        || composition["version"] != "aikit.harness-composition/v2"
    {
        return Err("Native staged runtime/composition versions are missing".into());
    }
    for (outer, runtime_key, composition_key) in [
        ("agent_ref", "agent", "agent"),
        ("agency_ref", "agency", "agency"),
        ("world_ref", "project", "project"),
        ("agent_session_ref", "agent_session", "session"),
    ] {
        same(&reading[outer], &runtime[runtime_key], outer)?;
        same(&reading[outer], &composition[composition_key], outer)?;
    }
    same(&runtime["harness"], &composition["harness"], "harness")?;
    same(
        &runtime["harness_composition_fingerprint"],
        &composition["fingerprint"],
        "composition fingerprint",
    )?;
    same(
        &reading["configuration_revision"],
        &composition["target_revision"],
        "configuration revision",
    )?;
    if !composition["model"].is_null()
        || !matches!(
            composition["state"].as_str(),
            Some("resolved" | "observed-active")
        )
    {
        return Err("Native cascade is not a resolved multi-model composition".into());
    }
    if !composition["absences"]
        .as_array()
        .is_some_and(Vec::is_empty)
    {
        return Err("Native speech composition still has unresolved absences".into());
    }
    let body = &reading["acting_body"];
    if body["body_ref"] != "agent-body/epi-prime-ql" {
        return Err("Speech requires the admitted Prime–QL body".into());
    }
    text(&body["body_revision"], "acting body revision")?;
    text(&reading["world_binding_ref"], "world binding")?;
    text(&reading["native_session_id"], "native text session")?;
    let stages = runtime["stages"]
        .as_array()
        .filter(|v| v.len() == 3)
        .ok_or("Native local speech requires its three ordered stages")?;
    let bindings = composition["component_bindings"]
        .as_array()
        .ok_or("Missing native component bindings")?;
    let mut conditions = Vec::new();
    let mut projected = Vec::new();
    let mut source_refs = BTreeSet::new();
    for (stage, name) in stages.iter().zip(["stt", "text", "tts"]) {
        let component = format!("component/local-speech-{name}");
        if stage["component"] != component
            || bindings
                .iter()
                .filter(|b| b["component"] == component)
                .count()
                != 1
        {
            return Err(
                "Native speech stage order or composition membership differs from the local route"
                    .into(),
            );
        }
        let relation = &stage["relation"];
        if name == "text" {
            same(
                &relation["materialisation"]["binding_ref"],
                &reading["native_session_id"],
                "text material session",
            )?;
            same(
                &relation["materialisation"]["lifetime_owner"],
                &reading["agent_session_ref"],
                "text material lifetime",
            )?;
            same(
                &relation["engine"]["revision"],
                &body["body_revision"],
                "text body revision",
            )?;
            if relation["model_surface"]["protocol"] != "prime-rpc"
                || relation["model_surface"]["modality"]["transport"] != "cli"
            {
                return Err(
                    "Native text stage does not disclose the admitted Prime RPC route".into(),
                );
            }
        } else {
            let config = &reading["configuration"][name];
            for (actual, configured) in [
                (&relation["engine"]["provider"], &config["provider_ref"]),
                (&relation["engine"]["engine"], &config["engine_ref"]),
                (&relation["engine"]["revision"], &config["engine_revision"]),
                (&relation["model"]["model"], &config["model_ref"]),
                (&relation["model"]["variant"], &config["model_id"]),
            ] {
                same(actual, configured, "configured speech stage material")?;
            }
            local_endpoint(&relation["materialisation"]["endpoint"])?;
            local_endpoint(&reading["probes"][name]["endpoint"])?;
            same(
                &relation["materialisation"]["endpoint"],
                &json!(configured_endpoint(config, "path")?),
                "configured inference endpoint",
            )?;
            same(
                &reading["probes"][name]["endpoint"],
                &json!(configured_endpoint(config, "health_path")?),
                "configured health endpoint",
            )?;
            text(
                &reading["probes"][name]["response_digest"],
                "health response digest",
            )?;
            text(
                &reading["probes"][name]["standing"],
                "health probe standing",
            )?;
            source_refs
                .insert(text(&config["source_ref"], "stage configuration source")?.to_owned());
        }
        let mut stage_projection = project_stage(stage, &mut conditions)?;
        if name != "text" {
            let config = &reading["configuration"][name];
            stage_projection["configuration"] = json!({"source_ref":config["source_ref"],
                "revision":reading["configuration_revision"],"declared_voice":config["voice"]});
            let probe = &reading["probes"][name];
            stage_projection["health_probe"] = json!({"endpoint":probe["endpoint"],
                "response_digest":probe["response_digest"],"standing":probe["standing"]});
        }
        for source in list(
            &stage_projection["modality"]["provenance"],
            "stage provenance",
        )? {
            source_refs.insert(source.to_owned());
        }
        projected.push(stage_projection);
    }
    for condition in list(&reading["conditions"], "reading conditions")? {
        conditions.push(json!({"condition":"degraded","reason":condition}));
    }
    let composed = &runtime["composed_modality"];
    if composed["complete"] != true || composed["speech_capable"] != true {
        return Err("Native composition has not declared a complete speech route".into());
    }
    for key in ["input_modalities", "output_modalities"] {
        let modalities = list(&composed[key], key)?;
        if modalities.is_empty() || modalities.iter().any(|m| !matches!(*m, "audio" | "speech")) {
            return Err(format!("Unexpected local speech {key}"));
        }
    }
    let interaction = composed["interaction"]
        .as_object()
        .ok_or("Native composed interaction support is missing")?;
    for (name, state) in interaction {
        support(state, name)?;
    }
    for name in [
        "full-duplex-realtime",
        "barge-in",
        "streaming-input",
        "streaming-output",
        "vad-turn-detection",
    ] {
        if interaction
            .get(name)
            .is_some_and(|s| matches!(s["state"].as_str(), Some("supported" | "degraded")))
        {
            return Err(format!("Local turn-based speech cannot claim {name}"));
        }
    }
    if composed["interaction"]["request-response"]["state"] != "supported" {
        return Err("Native local speech does not support request-response".into());
    }
    text(&json!(resolved_at), "resolution timestamp")?;
    let digest = format!(
        "{:x}",
        Sha256::digest(
            serde_json::to_vec(&(reading, context, resolved_at)).map_err(|e| e.to_string())?
        )
    );
    let reading_ref = format!(
        "aikit:local-speech-reading:sha256:{:x}",
        Sha256::digest(serde_json::to_vec(reading).map_err(|e| e.to_string())?)
    );
    source_refs.insert(reading_ref.clone());
    let text_stage = &projected[1];
    let text_relation = &stages[1]["relation"];
    Ok(
        json!({"schema":"actuation.speech-constitution/v1","constitution_ref":format!("nara-speech-constitution:sha256:{digest}"),
        "agent_ref":reading["agent_ref"],"agency_ref":reading["agency_ref"],"world_binding_ref":reading["world_binding_ref"],
        "agent_session_ref":reading["agent_session_ref"],"body_ref":body["body_ref"],"body_revision":body["body_revision"],
        "harness_composition_ref":format!("aikit:harness-composition:{}",text(&composition["fingerprint"], "composition fingerprint")?),
        "model_relation":text_stage["model_relation"],"access_profile":text_stage["access_profile"],
        "input_modalities":composed["input_modalities"],"output_modalities":composed["output_modalities"],
        "interaction":composed["interaction"],"transport":text_relation["model_surface"]["modality"]["transport"],
        "connection":text_relation["model_surface"]["modality"]["connection"],
        "interruption":{"state":"unsupported","reason":"This native reading declares no evidenced manual cancellation contract; browser playback and provider cancellation remain separate broker effects"},
        "provider_binding":{"provider_ref":text_relation["engine"]["provider"],"provider_session_ref":reading["native_session_id"],
            "material_binding_ref":text_relation["materialisation"]["binding_ref"],
            "facts":{"binding_scope":"native-text-stage; all cascade providers are retained in provenance.stage_relations",
                "configuration_revision":reading["configuration_revision"],"inference_observed":reading["inference_observed"]}},
        "conditions":conditions,"provenance":{"source_refs":source_refs,"native_reading_ref":reading_ref,
            "runtime_version":runtime["version"],"composition_fingerprint":composition["fingerprint"],
            "composed_basis":composed["basis"],"stage_relations":projected,"runtime_unavailability":runtime["unavailable"],
            "context_ref":context["context_ref"],"profile_ref":context["profile_ref"],"profile_revision":context["profile_revision"],
            "expression_ref":context["expression_ref"],"expression_revision":context["expression_revision"]},
        "resolved_at":resolved_at}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_generic_project_agent_cannot_be_relabelled_as_the_saved_nara() {
        // Exact mismatch observed in the controlled native integration. This
        // is a refusal regression, not a synthetic successful constitution.
        let reading = json!({"schema":"aikit.local-speech-reading/v1",
            "configuration":{"schema":"aikit.local-speech-config/v1"},"inference_observed":false,
            "agent_ref":"agent/control-root-chat","agent_session_ref":"agent-session/native"});
        let context = json!({"schema":"ql.nara-dialogue-context/v1","subject_ref":"controlled:person",
            "context_ref":"controlled:context","profile_ref":"controlled:profile","profile_revision":"revision:1",
            "expression_ref":"controlled:expression","expression_revision":"1",
            "nara_ref":"controlled:nara:native-replay:one","agent_session_ref":"agent-session/native"});
        assert!(from_reading(&reading, &context, "2026-09-27T19:00:00Z")
            .unwrap_err()
            .contains("Nara AgentRef"));
        assert_eq!(reading["agent_ref"], "agent/control-root-chat");
        assert_eq!(context["nara_ref"], "controlled:nara:native-replay:one");
    }

    #[test]
    fn local_route_pins_refuse_credentials_remote_hosts_and_query_material() {
        for endpoint in [
            "https://127.0.0.1:9000/inference",
            "http://example.org/inference",
            "http://user:password@127.0.0.1/inference",
            "http://127.0.0.1/inference?token=unknown",
            "http://127.0.0.1/inference#other",
            "http://0.0.0.0/inference",
        ] {
            assert!(local_endpoint(&json!(endpoint)).is_err(), "{endpoint}");
        }
        let config = json!({"host":"::1","port":9000,"path":"/inference","health_path":"/health"});
        let actual = configured_endpoint(&config, "path").unwrap();
        assert_eq!(actual, "http://[::1]:9000/inference");
        local_endpoint(&json!(actual)).unwrap();
        assert!(same(
            &json!(actual),
            &json!("http://[::1]:9001/inference"),
            "configured endpoint"
        )
        .is_err());
    }

    #[test]
    fn non_available_access_and_named_support_do_not_become_implicit_grants() {
        assert!(access(&json!({"state":"unknown"}), "inference").is_err());
        assert_eq!(
            access(
                &json!({"state":"unavailable","reason":"owner supplies no control"}),
                "control"
            )
            .unwrap(),
            Vec::<String>::new()
        );
        assert!(support(&json!({"state":"supported"}), "request-response").is_ok());
        assert!(support(&json!({"state":"degraded"}), "barge-in").is_err());
        assert!(support(
            &json!({"state":"unknown","reason":"not observed"}),
            "barge-in"
        )
        .is_ok());
    }
}
