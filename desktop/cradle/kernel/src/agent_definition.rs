//! Desktop consumer of Central Agent definitions and AIKit Direct sessions.
//! Identity, acceptance, source bytes and SessionSpace are never renderer-owned.
//! The kernel supplies the disclosed scope; ingress cannot name an executable,
//! credential, Agent id, authority principal or provider launch command.
use crate::{agency, flow::CentralClient};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag="action", rename_all="kebab-case", deny_unknown_fields)]
pub enum Request {
    Roster,
    Propose { name: String, purpose: String, #[serde(default)] skill_refs: Vec<String> },
    Review { profile_ref: String },
    Accept { profile_ref: String, expected_revision: String, expected_content_digest: String },
    Prepare { request_id: String, profile_ref: String, expected_revision: String, expected_content_digest: String, expected_acceptance_ref: String },
    Find { request_id: String },
}
fn exact(value: &str, max: usize, field: &str) -> Result<(), String> {
    if value.is_empty() || value.trim()!=value || value.len()>max || value.chars().any(|c| c=='\0' || (c.is_control() && c!='\n' && c!='\t')) {
        Err(format!("{field} must be nonempty, bounded and already trimmed; the composer never rewrites it"))
    } else { Ok(()) }
}
fn scoped(project: Option<&str>) -> Value {
    // Explicit null prevents CentralClient's configured child fallback.
    json!({"scope":if project.is_some(){"project"}else{"root"},"project":project})
}
fn owner(client: &CentralClient, action: &str, input: Value) -> Result<Value,String> {
    client.run(action,input).map_err(|e|e.to_string())
}
/// Production handler. `project` and `cwd` were resolved from the current
/// Central World disclosure by the caller, not from request JSON.
pub fn execute(client: &CentralClient, aikit: &agency::Client, project: Option<&str>, cwd: &Path, request: &Request) -> Result<Value,String> {
    let mut input=scoped(project);
    match request {
        Request::Roster => owner(client,"agent-profile.roster",input),
        Request::Propose{name,purpose,skill_refs} => {
            exact(name,256,"Agent name")?;exact(purpose,16_384,"Human purpose")?;
            if name.chars().any(char::is_control) { return Err("Agent name cannot contain control characters".into()); }
            if skill_refs.len()>64 { return Err("At most 64 explicitly selected native Skill references are allowed".into()); }
            let mut unique=std::collections::BTreeSet::new();
            for reference in skill_refs { exact(reference,1024,"Skill reference")?;if !unique.insert(reference) { return Err("Repeated Skill reference".into()); } }
            // Read the exact World at this native scope. A missing or refused
            // source horizon cannot be widened into a fabricated universal World.
            let horizon=owner(client,"projectcentral.change.horizon",json!({"project":project}))?;
            let world=horizon["world_ref"].as_str().filter(|s|!s.is_empty()).ok_or("Central did not disclose the selected World identity")?;
            input["world_ref"]=json!(world);input["ratified_world_refs"]=json!([world]);
            input["name"]=json!(name);input["intent_expression"]=json!(purpose);
            input["purpose"]=json!(purpose);input["skill_refs"]=json!(skill_refs);
            let proposal=owner(client,"agent-profile.express",input)?;
            let reference=proposal["profile"]["ref"].as_str().ok_or("Central expression returned no native profile reference; read the roster before another proposal")?;
            let mut read=scoped(project);read["profile_ref"]=json!(reference);
            // A generation acknowledgement is not acceptance. Read the actual
            // persisted bytes through the native review before showing review.
            owner(client,"agent-profile.review",read)
        },
        Request::Review{profile_ref} => {
            exact(profile_ref,1024,"Profile reference")?;input["profile_ref"]=json!(profile_ref);
            owner(client,"agent-profile.review",input)
        },
        Request::Accept{profile_ref,expected_revision,expected_content_digest} => {
            exact(profile_ref,1024,"Profile reference")?;exact(expected_revision,1024,"Revision")?;exact(expected_content_digest,128,"Content digest")?;
            input["profile_ref"]=json!(profile_ref);input["expected_revision"]=json!(expected_revision);input["expected_content_digest"]=json!(expected_content_digest);
            // The protected native credential channel is inherited by Central,
            // never supplied in renderer input. Central authenticates HUMAN
            // authority for this exact action/scope and compares reviewed bytes.
            owner(client,"agent-profile.accept",input)
        },
        Request::Prepare{request_id,profile_ref,expected_revision,expected_content_digest,expected_acceptance_ref} => {
            for (name,value,max) in [("Request correlation",request_id,128),("Profile reference",profile_ref,1024),("Revision",expected_revision,1024),("Content digest",expected_content_digest,128),("Acceptance reference",expected_acceptance_ref,1024)] { exact(value,max,name)?; }
            let value=json!({"request_id":request_id,"profile_ref":profile_ref,"expected_revision":expected_revision,"expected_content_digest":expected_content_digest,"expected_acceptance_ref":expected_acceptance_ref});
            let prepared=aikit.direct_agent(cwd,"agent-session-prepare","--request-json",&value.to_string())?;
            validate_prepared(&prepared,Some(profile_ref))?;
            Ok(prepared)
        },
        Request::Find{request_id} => {
            exact(request_id,128,"Original request correlation")?;
            let prepared=aikit.direct_agent(cwd,"agent-session-find","--request-id",request_id)?;
            if !prepared.is_null() { validate_prepared(&prepared,None)?; }
            Ok(prepared)
        },
    }
}
pub fn validate_prepared(value: &Value, profile: Option<&str>) -> Result<(),String> {
    if value["schema"]!="aikit.direct-agent-session/v1" || value["prepared"]!=true
        || value["provider_started"]!=false || value["execution_authority_granted"]!=false
        || !value["agent_session"].as_str().is_some_and(|s|s.starts_with("agent-session/"))
        || !value["space"].as_str().is_some_and(|s|s.starts_with("session-space/"))
        || !value["agent_ref"].is_string()
        || profile.is_some_and(|p|value["profile_ref"].as_str()!=Some(p)) {
        return Err("AIKit did not return a fully prepared native AgentSession; inspect the original request without retrying creation".into());
    }
    Ok(())
}
