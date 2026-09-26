//! Desktop consumer of Central's accepted Agent sources and native Direct sessions.
//! Input never includes a credential, executable, Agent id or granted authority.
use crate::{agency, flow::CentralClient};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "action", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Request {
    Roster,
    Scope,
    Skills,
    /// `aikit set list` — the SkillSet repertoire a creator selects first.
    /// Read-only: a set is a request over installed capabilities.
    SkillSets,
    /// `aikit set show <name>` — the owner's reply: members, nested sets and
    /// the members that would not project here, with the resolver's reason.
    SkillSet { name: String },
    Session { agent_session: String },
    Propose {
        name: String,
        purpose: String,
        expected_scope_ref: String,
        #[serde(default)]
        skill_refs: Vec<String>,
        #[serde(default)]
        skill_set_refs: Vec<String>,
    },
    Review {
        profile_ref: String,
    },
    Accept {
        profile_ref: String,
        expected_revision: String,
        expected_content_digest: String,
    },
    Prepare {
        request_id: String,
        profile_ref: String,
        expected_revision: String,
        expected_content_digest: String,
        expected_acceptance_ref: String,
    },
    Find {
        request_id: String,
    },
}
fn exact(value: &str, max: usize, field: &str) -> Result<(), String> {
    if value.is_empty()
        || value.trim() != value
        || value.len() > max
        || value
            .chars()
            .any(|c| c == '\0' || (c.is_control() && c != '\n' && c != '\t'))
    {
        Err(format!(
            "{field} must be nonempty, bounded and already trimmed; the composer never rewrites it"
        ))
    } else {
        Ok(())
    }
}
fn scoped(project: Option<&str>) -> Value {
    // Explicit null suppresses the CentralClient configured-child fallback.
    json!({"scope":if project.is_some(){"project"}else{"root"},"project":project})
}
fn owner(client: &CentralClient, action: &str, input: Value) -> Result<Value, String> {
    client.run(action, input).map_err(|e| e.to_string())
}
/// `project`/`cwd` come from the kernel's current Central disclosure, not ingress.
pub fn execute(
    client: &CentralClient,
    aikit: &agency::Client,
    project: Option<&str>,
    cwd: &Path,
    request: &Request,
) -> Result<Value, String> {
    let mut input = scoped(project);
    match request {
        Request::Roster => owner(client, "agent-profile.roster", input),
        Request::Scope => aikit.direct_agent(cwd, "agent-session-scope", None),
        Request::Skills => aikit.direct_agent(cwd, "agent-session-skills", None),
        Request::SkillSets => aikit.set_list(cwd),
        Request::SkillSet { name } => {
            exact(name, 256, "SkillSet name")?;
            aikit.set_show(cwd, name)
        }
        Request::Session {agent_session} => {
            exact(agent_session, 1024, "AgentSession reference")?;
            let session = aikit.direct_agent(cwd, "agent-session-read", Some(("--agent-session", agent_session)))?;
            if session.is_null() { return Ok(json!({"session":null,"profile":null})); }
            if session["schema"] != "aikit.direct-agent-session/v1" || session["agent_session"].as_str() != Some(agent_session) {
                return Err("Native Agent session identity mismatch".into());
            }
            for field in ["agent_ref", "profile_ref", "profile_revision", "space", "project_ref", "acceptance_ref"] {
                exact(session[field].as_str().ok_or_else(|| format!("Native session omitted {field}"))?, 2048, field)?;
            }
            if session["provider_started"] != false || session["execution_authority_granted"] != false {
                return Err("Native session reading has incompatible authority standing".into());
            }
            let scope = aikit.direct_agent(cwd, "agent-session-scope", None)?;
            if scope["schema"] != "aikit.direct-agent-scope/v1" || scope["execution_authority_granted"] != false
                || session["project_ref"] != scope["project_ref"] { return Err("Agent session belongs to another native scope".into()); }
            let mut profile_input = scoped(project);
            profile_input["profile_ref"] = session["profile_ref"].clone();
            let profile = match owner(client, "agent-profile.review", profile_input) {
                Ok(profile) => profile,
                Err(reason) => return Ok(json!({"session":session,"profile":null,"source_state":"unavailable","reason":reason})),
            };
            let scope_ref = if project.is_some() { format!("project:{}",session["project_ref"].as_str().unwrap()) } else { "control:root".into() };
            if profile["schema"] != "central.agent-profile-review/v1" || profile["execution_authority_granted"] != false
                || profile["scope_ref"].as_str() != Some(scope_ref.as_str()) || profile["profile"]["ref"] != session["profile_ref"] {
                return Ok(json!({"session":session,"profile":null,"source_state":"unavailable","reason":"Current source review has incompatible identity or standing"}));
            }
            let accepted = profile["accepted"] == true;
            let acceptance = &profile["acceptance"];
            let current = accepted && profile["profile"]["revision"] == session["profile_revision"]
                && profile["profile"]["agent_ref"] == session["agent_ref"]
                && acceptance["schema"] == "central.agent-profile-acceptance/v1"
                && acceptance["scope_ref"].as_str() == Some(scope_ref.as_str())
                && acceptance["acceptance_ref"] == session["acceptance_ref"]
                && acceptance["profile_ref"] == session["profile_ref"]
                && acceptance["profile_revision"] == session["profile_revision"]
                && acceptance["agent_ref"] == session["agent_ref"]
                && acceptance["content_digest"] == profile["content_digest"];
            Ok(json!({"session":session,"profile":if current {profile["profile"].clone()} else {Value::Null},
                "source_state":if current {"current"} else if accepted {"changed"} else {"revoked"}}))
        }
        Request::Propose {
            name,
            purpose,
            expected_scope_ref,
            skill_refs,
            skill_set_refs,
        } => {
            exact(name, 256, "Agent name")?;
            exact(purpose, 16_384, "Human purpose")?;
            exact(
                expected_scope_ref,
                1024,
                "Explicitly confirmed native scope",
            )?;
            if name.chars().any(char::is_control) {
                return Err("Agent name cannot contain control characters".into());
            }
            if skill_refs.len() > 64 {
                return Err(
                    "At most 64 explicitly selected native Skill references are allowed".into(),
                );
            }
            if skill_set_refs.len() > 64 {
                return Err(
                    "At most 64 explicitly selected native SkillSet references are allowed".into(),
                );
            }
            let mut unique = std::collections::BTreeSet::new();
            for reference in skill_refs {
                exact(reference, 1024, "Skill reference")?;
                if !unique.insert(reference) {
                    return Err("Repeated Skill reference".into());
                }
            }
            let mut unique_sets = std::collections::BTreeSet::new();
            for reference in skill_set_refs {
                exact(reference, 1024, "SkillSet reference")?;
                if !unique_sets.insert(reference) {
                    return Err("Repeated SkillSet reference".into());
                }
            }
            let roster = owner(client, "agent-profile.roster", scoped(project))?;
            if roster["schema"] != "central.agent-profile-roster/v1"
                || roster["scope_ref"].as_str() != Some(expected_scope_ref.as_str())
            {
                return Err("Central's native scope changed. Review and explicitly confirm the current scope before proposing.".into());
            }
            // The person explicitly confirmed this observed scope. Existence
            // alone is not ratification; acceptance of the resulting source is
            // still a DIFFERENT authenticated human act after native review.
            input["world_ref"] = json!(expected_scope_ref);
            input["ratified_world_refs"] = json!([expected_scope_ref]);
            input["name"] = json!(name);
            input["intent_expression"] = json!(purpose);
            input["purpose"] = json!(purpose);
            input["skill_refs"] = json!(skill_refs);
            input["skill_set_refs"] = json!(skill_set_refs);
            let proposal = owner(client, "agent-profile.express", input)?;
            let reference = proposal["profile"]["ref"].as_str().ok_or("Native proposal returned no profile reference; read the roster before proposing again")?;
            let mut read = scoped(project);
            read["profile_ref"] = json!(reference);
            owner(client, "agent-profile.review", read)
        }
        Request::Review { profile_ref } => {
            exact(profile_ref, 1024, "Profile reference")?;
            input["profile_ref"] = json!(profile_ref);
            owner(client, "agent-profile.review", input)
        }
        Request::Accept {
            profile_ref,
            expected_revision,
            expected_content_digest,
        } => {
            exact(profile_ref, 1024, "Profile reference")?;
            exact(expected_revision, 1024, "Revision")?;
            exact(expected_content_digest, 128, "Content digest")?;
            input["profile_ref"] = json!(profile_ref);
            input["expected_revision"] = json!(expected_revision);
            input["expected_content_digest"] = json!(expected_content_digest);
            // Central authenticates the protected native credential channel.
            // No renderer actor flag/credential becomes acceptance authority.
            owner(client, "agent-profile.accept", input)
        }
        Request::Prepare {
            request_id,
            profile_ref,
            expected_revision,
            expected_content_digest,
            expected_acceptance_ref,
        } => {
            for (name, value, max) in [
                ("Request correlation", request_id, 128),
                ("Profile reference", profile_ref, 1024),
                ("Revision", expected_revision, 1024),
                ("Content digest", expected_content_digest, 128),
                ("Acceptance reference", expected_acceptance_ref, 1024),
            ] {
                exact(value, max, name)?;
            }
            let value = json!({"request_id":request_id,"profile_ref":profile_ref,"expected_revision":expected_revision,"expected_content_digest":expected_content_digest,"expected_acceptance_ref":expected_acceptance_ref});
            let prepared = aikit.direct_agent(
                cwd,
                "agent-session-prepare",
                Some(("--request-json", &value.to_string())),
            )?;
            validate_prepared(&prepared, Some(profile_ref), request_id)?;
            verify_attachment(aikit, cwd, &prepared)?;
            Ok(prepared)
        }
        Request::Find { request_id } => {
            exact(request_id, 128, "Original request correlation")?;
            let prepared = aikit.direct_agent(
                cwd,
                "agent-session-find",
                Some(("--request-id", request_id)),
            )?;
            if !prepared.is_null() {
                validate_preparation(&prepared, None, request_id, true)?;
                if prepared["prepared"] == true {
                    verify_attachment(aikit, cwd, &prepared)?;
                } else {
                    verify_scope(aikit, cwd, &prepared)?;
                }
            }
            Ok(prepared)
        }
    }
}
pub fn validate_prepared(
    value: &Value,
    profile: Option<&str>,
    request_id: &str,
) -> Result<(), String> {
    validate_preparation(value, profile, request_id, false)
}
fn validate_preparation(
    value: &Value,
    profile: Option<&str>,
    request_id: &str,
    allow_partial: bool,
) -> Result<(), String> {
    let legitimate_partial =
        allow_partial && value["prepared"] == false && value["resume_preparation_allowed"] == true;
    if value["schema"] != "aikit.direct-agent-session/v1"
        || (value["prepared"] != true && !legitimate_partial)
        || value["provider_started"] != false
        || value["execution_authority_granted"] != false
        || value["request_id"].as_str() != Some(request_id)
        || !value["agent_session"]
            .as_str()
            .is_some_and(|s| s.starts_with("agent-session/"))
        || !value["space"]
            .as_str()
            .is_some_and(|s| s.starts_with("session-space/"))
        || !value["project_ref"].as_str().is_some_and(|s| !s.is_empty())
        || !value["agent_ref"].as_str().is_some_and(|s| !s.is_empty())
        || profile.is_some_and(|p| value["profile_ref"].as_str() != Some(p))
    {
        return Err("AIKit did not return a fully prepared native AgentSession; inspect the original request without creating a replacement".into());
    }
    Ok(())
}
fn verify_scope(aikit: &agency::Client, cwd: &Path, prepared: &Value) -> Result<(), String> {
    let scope = aikit.direct_agent(cwd, "agent-session-scope", None)?;
    if scope["schema"] != "aikit.direct-agent-scope/v1"
        || scope["project_ref"] != prepared["project_ref"]
    {
        return Err("Prepared session belongs to another native Project binding".into());
    }
    Ok(())
}
fn verify_attachment(aikit: &agency::Client, cwd: &Path, prepared: &Value) -> Result<(), String> {
    verify_scope(aikit, cwd, prepared)?;
    let rows = aikit.read_project(
        cwd,
        prepared["project_ref"]
            .as_str()
            .ok_or("Missing Project reference")?,
    )?;
    let session = prepared["agent_session"]
        .as_str()
        .ok_or("Missing session reference")?;
    if !rows.as_array().is_some_and(|rows| {
        rows.iter().any(|r| {
            r["definition"]["id"] == prepared["space"] && r["agent_sessions"].get(session).is_some()
        })
    }) {
        return Err(
            "The prepared AgentSession is not attached to the exact native SessionSpace".into(),
        );
    }
    Ok(())
}
