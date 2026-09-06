//! Intake of actual bounded ACP/material evidence through native Factory APIs.
//! It never launches a model, fabricates Method/ContextResolution identity, or
//! upgrades a local technical return into human Recognition.
use aikit_core::{
    method::Method, praxis::PraxisResolution, session_space_application::ContextResolutionEvidence,
};
use epilogos_factory::artifact_evidence::{
    ArtifactEvidenceError, ArtifactLimits, ArtifactSnapshot,
};
use epilogos_factory::build::FactoryBuildSelection;
use epilogos_factory::build::{
    CandidateRecord, EvidenceRecord, ExecutionRecord, FactoryBuildState,
};
use epilogos_factory::build_provider::FactoryBuildFileProvider;
use epilogos_factory::core::identity::{Ref, Revision};
use epilogos_factory::core::run::{Project, ProjectRef, Run, RunRef};
use epilogos_factory::journey::{Journey, JourneyCommission, JourneyRef, JourneyReturn};
use epilogos_factory::journey_praxis::{
    JourneyAgentProfileSelection, JourneyPraxisContext, JourneyPraxisReturn,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    error::Error,
    fs,
    io::{Read, Write},
    path::Path,
    process::Command,
};
use ulid::Ulid;
type Result<T> = std::result::Result<T, Box<dyn Error>>;

fn read(path: &Path) -> Result<Vec<u8>> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.is_file() || metadata.len() > 8 * 1024 * 1024 {
        return Err(format!("not a bounded regular evidence file: {}", path.display()).into());
    }
    let mut bytes = Vec::new();
    fs::File::open(path)?
        .take(8 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("evidence exceeds 8 MiB".into());
    }
    Ok(bytes)
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn reference(kind: &str) -> Result<Ref> {
    Ok(Ref::new(kind, Ulid::new())?)
}
fn text<'a>(value: &'a Value, key: &str) -> Result<&'a str> {
    value[key]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("missing evidence field {key}").into())
}
fn write_new(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    Ok(())
}
fn write_json(path: &Path, value: &Value) -> Result<()> {
    write_new(path, &serde_json::to_vec_pretty(value)?)
}

pub fn retain_factory_return(live: &Path, workcell_path: &Path, output: &Path) -> Result<Value> {
    let acceptance_bytes = read(&live.join("acceptance.json"))?;
    let acceptance: Value = serde_json::from_slice(&acceptance_bytes)?;
    if acceptance["result"] != "passed" || acceptance["model_tools"] != "disabled" {
        return Err("requires a passed bounded tool-less ACP owner receipt".into());
    }
    let events_bytes = read(&live.join("events.json"))?;
    let events: Value = serde_json::from_slice(&events_bytes)?;
    let context_bytes = read(&live.join("required-context.json"))?;
    let context: Value = serde_json::from_slice(&context_bytes)?;
    let delivered = read(&live.join("delivered-context.txt"))?;
    let delivered_text = std::str::from_utf8(&delivered)?;
    if hash(&delivered) != text(&acceptance, "delivered_context_sha256")? {
        return Err("delivered context differs from ACP acceptance receipt".into());
    }
    let canonical_session = text(&acceptance, "canonical_session")?;
    let native_session = text(&acceptance, "native_session")?;
    let mut model_text = String::new();
    let mut ended = 0;
    let mut delivered_seen = false;
    let mut checked_sources = false;
    let mut previous = None;
    for row in events
        .as_array()
        .ok_or("events must be retained native rows")?
    {
        let cursor = row["cursor"].as_u64().ok_or("event cursor missing")?;
        if previous.is_some_and(|last| cursor <= last) {
            return Err("native event cursor order changed".into());
        }
        previous = Some(cursor);
        let event = &row["event"];
        if event["kind"] == "context-admission-checked"
            && event["phase"] == "before-prompt"
            && event["sources"] == context["sources"]
        {
            checked_sources = true;
        }
        if event["kind"] == "user-message" && event["text"].as_str() == Some(delivered_text) {
            delivered_seen = true;
        }
        let host = &event["event"];
        if let Some(signal) = host.get("Signal") {
            if signal["native_session_id"].as_str() != Some(native_session) {
                return Err("event changed native session identity".into());
            }
            if signal["kind"]["kind"] == "agent-message-chunk" {
                model_text.push_str(
                    signal["kind"]["text"]
                        .as_str()
                        .ok_or("missing native text chunk")?,
                );
            }
        }
        if let Some(turn) = host.get("TurnEnded") {
            if turn["agent_session"].as_str() != Some(canonical_session)
                || turn["binding"]["native_session_id"].as_str() != Some(native_session)
                || turn["stop"].get("Completed").is_none()
            {
                return Err("native turn did not complete on the selected binding".into());
            }
            ended += 1;
        }
    }
    if ended != 1 || !delivered_seen || !checked_sources {
        return Err("requires one completed actual turn with observed exact context delivery and source preflight".into());
    }
    let candidate_path = Path::new(text(&acceptance, "candidate_json")?);
    let candidate_bytes = read(candidate_path)?;
    let candidate: Value = serde_json::from_slice(&candidate_bytes)?;
    if serde_json::from_str::<Value>(model_text.trim())? != candidate {
        return Err("candidate differs from actual native model output".into());
    }
    let workcell_bytes = read(workcell_path)?;
    let workcell: Value = serde_json::from_slice(&workcell_bytes)?;
    if workcell["schema"] != "oi.bounded-acp-material-proof/v1"
        || workcell["ok"] != true
        || workcell["artifact_evidence"]["applied"] != true
        || workcell["process_output"]["success"] != "true"
    {
        return Err("requires successful actual Workcell material receipt".into());
    }
    if workcell["candidate_json_sha256"].as_str() != Some(hash(&candidate_bytes).as_str()) {
        return Err("Workcell executed a different candidate".into());
    }
    let root = Path::new(text(&acceptance, "fixture_root")?).canonicalize()?;
    let artifact = root.join("pricing.py");
    if Path::new(text(&workcell["artifact_evidence"], "path")?).canonicalize()?
        != artifact.canonicalize()?
    {
        return Err("Workcell artifact path differs from ACP commission".into());
    }
    let actual = read(&artifact)?;
    if workcell["artifact_after_sha256"].as_str() != Some(hash(&actual).as_str()) {
        return Err("actual written artifact changed since Workcell verification".into());
    }
    // Recover actual owner-selected source bytes and validate their pinned digest.
    let mut source_files = Vec::new();
    for pin in context["sources"]
        .as_array()
        .ok_or("required context sources missing")?
    {
        let path = Path::new(text(pin, "path")?);
        let bytes = read(path)?;
        if format!("blake3:{}", blake3::hash(&bytes).to_hex()) != text(pin, "content_digest")? {
            return Err(format!(
                "required source changed before Factory return: {}",
                path.display()
            )
            .into());
        }
        source_files.push((path.to_path_buf(), bytes, pin.clone()));
    }
    if source_files.is_empty() {
        return Err("no selected sources to retain".into());
    }
    // Optional only for the historical first circuit. A new acceptance naming
    // native praxis must carry its exact admitted source and owner receipts.
    let native_praxis = if let Some(method_path) = acceptance["native_method_resolution"].as_str() {
        if text(&acceptance, "required_context_sha256")? != hash(&context_bytes)
            || text(&workcell["effect_context"], "manifest_sha256")? != hash(&context_bytes)
        {
            return Err("material effect context differs from admitted ACP basis".into());
        }
        let path = Path::new(method_path).canonicalize()?;
        if path != live.join("method-resolution.json").canonicalize()?
            || !source_files
                .iter()
                .any(|(p, _, _)| p.canonicalize().ok().as_ref() == Some(&path))
        {
            return Err("native Method receipt was not pinned for this ACP encounter".into());
        }
        let receipt: Value = serde_json::from_slice(&read(&path)?)?;
        let method: Method = serde_json::from_value(receipt["method"].clone())?;
        method.validate()?;
        let praxis: PraxisResolution = serde_json::from_value(receipt["praxis"].clone())?;
        let context: ContextResolutionEvidence =
            serde_json::from_value(receipt["context_resolution"].clone())?;
        let context_value = serde_json::to_value(&context)?;
        let context_project_path = Path::new(text(&context_value["basis"]["project_binding"]["locator"], "path")?).canonicalize()?;
        if context_project_path != root {
            return Err("native Method context belongs to another Project directory".into());
        }
        let basis_digest = blake3::hash(&serde_json::to_vec(&context.basis)?)
            .to_hex()
            .to_string();
        if context.reference.to_string() != format!("context-resolution/{}", &basis_digest[..16])
            || praxis.version != aikit_core::praxis::PRAXIS_RESOLUTION_VERSION
            || praxis.methods.len() != 1
            || !praxis.warnings.is_empty()
            || praxis.methods[0].method != method.id
            || !praxis.methods[0].resolution.is_complete()
        {
            return Err("native typed Method/ContextResolution evidence is inconsistent".into());
        }
        let source = Path::new(text(&receipt["source_read"], "path")?).canonicalize()?;
        let source_bytes = read(&source)?;
        let observed_revision = format!("blake3:{}", blake3::hash(&source_bytes));
        let mut declared: Method = serde_json::from_slice(&source_bytes)?;
        declared.revision = method.revision.clone();
        if declared != method
            || method.revision.as_ref().map(|r| r.as_str()) != Some(observed_revision.as_str())
            || !source_files
                .iter()
                .any(|(p, _, _)| p.canonicalize().ok().as_ref() == Some(&source))
        {
            return Err("typed Method no longer matches the selected source bytes".into());
        }
        let expected_members: Vec<&str> = acceptance["members"]
            .as_array()
            .ok_or("missing members")?
            .iter()
            .map(|v| v.as_str().ok_or("invalid member"))
            .collect::<std::result::Result<_, _>>()?;
        if method
            .skills
            .iter()
            .map(|m| m.skill.as_str())
            .collect::<Vec<_>>()
            != expected_members
            || receipt["skill_states"].as_array().is_none_or(|states| {
                states.len() != expected_members.len() || states.iter().any(|s| s["active"] != true)
            })
        {
            return Err("native Method did not resolve the selected active Skills".into());
        }
        let composition_path = live.join("composition.json").canonicalize()?;
        let composition: Value = serde_json::from_slice(&read(&composition_path)?)?;
        let body = &composition["composed_inputs"];
        let profile = &body["authored_basis"]["profile_source"];
        if !source_files
            .iter()
            .any(|(p, _, _)| p.canonicalize().ok().as_ref() == Some(&composition_path))
            || body["selected_harness"] != "harness/pi"
            || body["selected_model"] != acceptance["composition_setup"]["selected_model_ref"]
            || profile["method_refs"]
                .as_array()
                .is_none_or(|refs| !refs.iter().any(|r| r.as_str() == Some(method.id.as_str())))
        {
            return Err(
                "authored intention and selected body do not join the native Method".into(),
            );
        }
        Some((method, context, composition))
    } else {
        None
    };
    fs::create_dir(output)?;
    fs::create_dir(output.join("sources"))?;
    let mut sources = Vec::new();
    for (role, path, bytes) in [
        (
            "acp-owner-acceptance",
            live.join("acceptance.json"),
            acceptance_bytes,
        ),
        ("native-acp-events", live.join("events.json"), events_bytes),
        (
            "required-context-pins",
            live.join("required-context.json"),
            context_bytes,
        ),
        (
            "delivered-context",
            live.join("delivered-context.txt"),
            delivered,
        ),
        (
            "actual-model-candidate",
            candidate_path.to_owned(),
            candidate_bytes,
        ),
        (
            "workcell-material-receipt",
            workcell_path.to_owned(),
            workcell_bytes,
        ),
    ] {
        let retained = output.join("sources").join(role);
        write_new(&retained, &bytes)?;
        sources.push(json!({"role":role,"original_path":path,"retained_path":retained,"sha256":hash(&bytes),"source_ref":format!("sha256:{}",hash(&bytes))}));
    }
    for (index, (path, bytes, pin)) in source_files.into_iter().enumerate() {
        let retained = output.join("sources").join(format!("selected-{index}"));
        write_new(&retained, &bytes)?;
        sources.push(json!({"role":"selected-source","original_path":path,"retained_path":retained,"sha256":hash(&bytes),"native_pin":pin,"source_ref":format!("sha256:{}",hash(&bytes))}));
    }
    let project_ref: ProjectRef = reference("project")?.to_string().parse()?;
    let run_ref: RunRef = reference("run")?.to_string().parse()?;
    let candidate_ref = reference("candidate")?;
    let execution_ref = reference("execution")?.to_string();
    let evidence_ref = reference("evidence")?.to_string();
    let return_ref = reference("return")?.to_string();
    let mut state = FactoryBuildState::new(
        Project::new(project_ref.clone()),
        Run::new(
            run_ref.clone(),
            project_ref.clone(),
            "Retain actual ACP proposal and bounded material result",
            "factory-bounded-acp-intake",
        )?,
    )?;
    state.insert_candidate(CandidateRecord {
        run_ref: run_ref.clone(),
        candidate_ref: candidate_ref.to_string(),
        revision: 1,
        label: "Actual pricing.py replacement".into(),
        status: "unrecognised".into(),
        producing_execution_refs: vec![execution_ref.clone()],
        claim_refs: vec![],
        evidence_refs: vec![],
        artifact_refs: vec![artifact.display().to_string()],
        preview_ref: None,
        tradeoffs: vec![],
    })?;
    state.insert_execution(ExecutionRecord {
        run_ref: run_ref.clone(),
        execution_ref: execution_ref.clone(),
        status: "bounded-material-effect-observed".into(),
        agency_ref: None,
        agent_ref: None,
        harness_ref: None,
        harness_composition_ref: None,
        agent_session_ref: Some(canonical_session.into()),
        session_space_ref: None,
        surface_refs: vec![],
        workcell_binding_refs: vec![text(&workcell, "material_ref")?.into()],
        native_trajectory_ref: Some(format!(
            "sha256:{}",
            hash(&read(&live.join("events.json"))?)
        )),
    })?;
    let snapshot = ArtifactSnapshot::capture(
        candidate_ref.clone(),
        Revision::INITIAL,
        &root,
        &["pricing.py".into()],
        ArtifactLimits::default(),
    )?;
    let record = |id: String| EvidenceRecord {
        run_ref: run_ref.clone(),
        evidence_ref: id,
        label: "Current declared pricing.py artifact after actual native material execution".into(),
        assessment: None,
        native_ref: None,
        producing_execution_ref: Some(execution_ref.clone()),
    };
    state.insert_artifact_evidence(
        record(evidence_ref.clone()),
        &snapshot,
        snapshot.subject_state(),
    )?;
    let historical = serde_json::to_value(&state)?;
    write_json(
        &output.join("artifact-manifest.json"),
        &serde_json::to_value(snapshot.manifest())?,
    )?;
    // Negative proof works on a real byte-for-byte copy, never destroys accepted work.
    let copy = tempfile::tempdir()?;
    fs::copy(&artifact, copy.path().join("pricing.py"))?;
    let copy_snapshot = ArtifactSnapshot::capture(
        candidate_ref,
        Revision::INITIAL,
        copy.path(),
        &["pricing.py".into()],
        ArtifactLimits::default(),
    )?;
    if copy_snapshot.subject_state() != snapshot.subject_state() {
        return Err("verification copy differs from actual accepted artifact".into());
    }
    let mut changed = actual.clone();
    changed.extend_from_slice(b"\n# stale verification copy\n");
    fs::write(copy.path().join("pricing.py"), changed)?;
    let stale = state.insert_artifact_evidence(
        record(reference("evidence")?.to_string()),
        &copy_snapshot,
        copy_snapshot.subject_state(),
    );
    if !matches!(stale, Err(ArtifactEvidenceError::StaleArtifacts))
        || serde_json::to_value(&state)? != historical
    {
        return Err("stale artifact admission mutated or passed native Factory state".into());
    }
    if read(&artifact)? != actual {
        return Err("accepted artifact changed during return retention".into());
    }
    let date = Command::new("date")
        .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
        .output()?;
    if !date.status.success() {
        return Err("cannot obtain actual return time".into());
    }
    let basis: Vec<String> = sources
        .iter()
        .map(|v| text(v, "source_ref").map(str::to_owned))
        .collect::<Result<_>>()?;
    let mut journey = Journey::new(
        JourneyRef::new(reference("journey")?)?,
        project_ref.clone(),
        JourneyCommission {
            purpose:
                "Receive the actual bounded ACP/material circuit without conferring Recognition"
                    .into(),
            commission_ref: None,
            why_refs: basis.clone(),
        },
        if native_praxis.is_some() {
            "Await human Recognition"
        } else {
            "Await human Recognition and typed praxis binding"
        },
        String::from_utf8(date.stdout)?.trim(),
    )?;
    journey.add_run(
        run_ref.clone(),
        basis.clone(),
        vec![canonical_session.into()],
    )?;
    journey.correlate_material_context(text(&workcell, "material_ref")?)?;
    journey.record_return(JourneyReturn {return_ref:return_ref.clone(),run_refs:vec![run_ref.clone()],basis_refs:basis,evidence_refs:vec![evidence_ref.clone()],recognition_ref:None,summary:"Actual Pi proposal matched native ACP events, fixed helper applied it through a finite Workcell grant, and Factory admitted current pricing.py evidence. Stale-copy evidence was refused with history retained.".into()})?;
    let praxis_status = if let Some((method, context, composition)) = &native_praxis {
        let body = &composition["composed_inputs"];
        let profile = &body["authored_basis"]["profile_source"];
        let activity_ref = format!("sha256:{}", hash(&read(&live.join("events.json"))?));
        journey.correlate_activity(&activity_ref)?;
        let mut correlation = JourneyPraxisContext::new(&journey);
        correlation.select_agent_profile(
            &journey,
            JourneyAgentProfileSelection {
                contract: "central.agent-profile/v1".into(),
                profile_ref: text(profile, "ref")?.into(),
                profile_revision: text(profile, "revision")?.into(),
                agent_ref: text(profile, "agent_ref")?.into(),
                source_world_ref: text(profile, "world_ref")?.into(),
            },
        )?;
        correlation.record_praxis_return(
            &journey,
            JourneyPraxisReturn {
                run_ref: run_ref.clone(),
                method_contract: aikit_core::method::METHOD_VERSION.into(),
                method_ref: method.id.to_string(),
                method_revision: method
                    .revision
                    .as_ref()
                    .ok_or("missing Method revision")?
                    .to_string(),
                context_resolution_ref: context.reference.to_string(),
                body_condition_refs: vec![
                    text(body, "selected_harness")?.into(),
                    text(body, "selected_model")?.into(),
                    text(&workcell, "material_ref")?.into(),
                ],
                activity_refs: vec![activity_ref],
                evidence_refs: vec![evidence_ref.clone()],
                return_refs: vec![return_ref.clone()],
                proof: None,
            },
        )?;
        write_json(
            &output.join("journey-praxis.json"),
            &serde_json::to_value(&correlation)?,
        )?;
        "native-source-Method-ContextResolution-correlated-no-MethodProof-issued"
    } else {
        "unbound-no-native-Method-or-ContextResolution-issued"
    };
    journey.validate()?;
    let selection = FactoryBuildSelection {
        project_ref: project_ref.clone(),
        run_ref: run_ref.clone(),
    };
    let provider_path = output.join("factory-state.json");
    FactoryBuildFileProvider::create(&provider_path, selection.clone(), state)?;
    let reopened = FactoryBuildFileProvider::open(&provider_path, selection)?;
    let view = reopened.snapshot()?;
    if !view.view.evidence.iter().any(|r| {
        r.evidence_ref == evidence_ref
            && r.native_ref.as_deref() == Some(&snapshot.subject_state().state_ref)
    }) {
        return Err("native provider did not retain admitted artifact evidence".into());
    }
    write_json(
        &output.join("journey.json"),
        &serde_json::to_value(&journey)?,
    )?;
    write_json(&output.join("sources.json"), &json!(sources))?;
    let receipt = json!({"schema":"oi.bounded-acp-factory-return/v1","ok":true,"project_ref":project_ref,"run_ref":run_ref,"candidate_ref":snapshot.subject_state().subject_ref,"return_ref":return_ref,"evidence_ref":evidence_ref,"subject_state":snapshot.subject_state(),"canonical_session":canonical_session,"native_session":native_session,"source_snapshot":acceptance["snapshot"],"selected_members":acceptance["members"],"material_ref":workcell["material_ref"],"native_provider_reopened":true,"stale_copy_rejected":true,"historical_evidence_unchanged":true,"human_recognition":null,"praxis":praxis_status,"scope":"Actual pricing.py bytes and retained ACP/context/material evidence; not whole-Run closure, model fitness or human Recognition.","sources_manifest":output.join("sources.json"),"factory_state":provider_path,"journey":output.join("journey.json")});
    write_json(&output.join("receipt.json"), &receipt)?;
    Ok(receipt)
}
