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
    /// Read-only: a set is a request over installed capabilities. Wire name
    /// `skillsets`, the renderer's spelling (kebab-case would be `skill-sets`).
    #[serde(rename = "skillsets")]
    SkillSets,
    /// `aikit set show <name>` — the owner's reply: members, nested sets and
    /// the members that would not project here, with the resolver's reason.
    #[serde(rename = "skillset")]
    SkillSet {
        name: String,
    },
    Session {
        agent_session: String,
    },
    Propose {
        name: String,
        purpose: String,
        expected_scope_ref: String,
        #[serde(default)]
        skill_refs: Vec<String>,
        /// Central file ref to a reusable `kind:"character"` Expression
        /// material document; forwarded as the profile's
        /// `expressive_character_ref`. The material itself never travels here.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        expressive_character_ref: Option<String>,
        #[serde(default)]
        skill_set_refs: Vec<String>,
        /// The authored self definition: two exact Central source pins
        /// (particular self + shared Relational Logos), carried verbatim into
        /// the express input. The wire object is Central's snake_case shape
        /// (`source` / `relational_logos`, each `{reference, content_digest}`);
        /// only shape and pin grammar are checked here, never the prose.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        self_definition: Option<Value>,
    },
    Review {
        profile_ref: String,
    },
    /// Set (or clear, with `None`) an existing Agent's expressive character
    /// through Central's own compare-and-swap save. The profile advances one
    /// revision, so a prior acceptance no longer matches the source: the
    /// reading discloses `re_acceptance_required`.
    SetCharacter {
        profile_ref: String,
        expected_revision: String,
        #[serde(default)]
        expressive_character_ref: Option<String>,
    },
    /// Replace (or remove, with `None`) an existing Agent's authored self
    /// definition through Central's compare-and-swap save — the same CAS
    /// discipline as `SetCharacter`: the profile advances one revision, so
    /// a prior acceptance needs the human's acceptance again.
    SetSelf {
        profile_ref: String,
        expected_revision: String,
        #[serde(default)]
        self_definition: Option<Value>,
    },
    /// Resolve one `central:source:` reference to the exact source bytes
    /// and their sha256 digest, for pinning. Resolution goes through
    /// Central's own source read (`projectcentral.source.read`): Central
    /// owns the retrieval gate, symlinks, traversal and redirections;
    /// nothing is resolved from the filesystem here.
    SelfSourceRead {
        reference: String,
    },
    /// Save pasted prose as a NEW root self-description source through
    /// Central's own human creation door (`central.self.source.create`:
    /// declared human attribution, atomic no-overwrite admission,
    /// `Control/self` aperture only), then read the created source back so
    /// the pin carries the exact resolved bytes and digest — never a
    /// hand-typed digest.
    SelfSourceCreate {
        name: String,
        content: String,
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
fn character_ref(value: &str) -> Result<(), String> {
    exact(value, 1024, "Expressive character reference")?;
    if value.contains('\n') || value.contains('\t') {
        return Err("Expressive character reference must be a single-line ref".into());
    }
    Ok(())
}
/// A Central source reference in the pinned-self grammar: single-line,
/// bounded, and explicitly a `central:source:` reference. Resolution,
/// traversal and symlink law stay Central's; this only keeps obvious
/// non-references from reaching the owner.
fn source_reference(value: &str) -> Result<(), String> {
    exact(value, 1024, "Self source reference")?;
    if !value.starts_with("central:source:") {
        return Err("Self source references must be `central:source:` references".into());
    }
    if value
        .split('/')
        .any(|member| member == ".." || member == ".")
    {
        return Err("Self source references cannot carry traversal members".into());
    }
    Ok(())
}
fn is_sha256_digest(value: &str) -> bool {
    match value.strip_prefix("sha256:") {
        Some(hex) => {
            hex.len() == 64
                && hex
                    .bytes()
                    .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
        }
        None => false,
    }
}
/// One pin of the self definition (`source` or `relational_logos`): the
/// exact wire members only, with the reference and digest grammar checked.
fn source_pin(value: &Value, field: &str) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or_else(|| format!("Self definition {field} pin must be an object"))?;
    for (key, value) in object {
        match key.as_str() {
            "reference" => {
                let reference = value
                    .as_str()
                    .ok_or_else(|| format!("Self definition {field} reference must be a string"))?;
                source_reference(reference)?;
            }
            "content_digest" => {
                let digest = value.as_str().ok_or_else(|| {
                    format!("Self definition {field} content digest must be a string")
                })?;
                exact(digest, 71, "Self source content digest")?;
                if !is_sha256_digest(digest) {
                    return Err(
                        "Self source digests must be `sha256:` plus 64 lowercase hex digits".into(),
                    );
                }
            }
            other => {
                return Err(format!(
                    "Self definition {field} pin carries an unknown member `{other}`"
                ))
            }
        }
    }
    Ok(())
}
/// The authored self definition wire object: at most the two named pins,
/// each carrying only reference/digest members. The value is forwarded
/// byte-faithfully; this checks its grammar without rewriting it.
fn validate_self_definition(value: &Value) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or("Self definition must be an object with `source` and `relational_logos` pins")?;
    for (key, value) in object {
        match key.as_str() {
            "source" | "relational_logos" => source_pin(value, key)?,
            other => {
                return Err(format!(
                    "Self definition carries an unknown member `{other}`"
                ))
            }
        }
    }
    Ok(())
}
/// sha256 of the exact source bytes, in the pinned digest grammar.
fn source_digest(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    format!("sha256:{:x}", Sha256::digest(bytes))
}
/// The bounded preview boundary: at most `limit` bytes, never inside a
/// UTF-8 character.
fn preview_boundary(text: &str, limit: usize) -> usize {
    let mut end = limit.min(text.len());
    while end < text.len() && !text.is_char_boundary(end) {
        end -= 1;
    }
    end
}
/// One self source reading through Central's own source owner: the exact
/// bytes, their digest for pinning, and a bounded preview of the text.
fn self_source_reading(
    client: &CentralClient,
    project: Option<&str>,
    reference: &str,
) -> Result<Value, String> {
    let reading = client
        .source_read(project, reference)
        .map_err(|error| error.to_string())?;
    if !reading.source.exists {
        return Err(
            "Central holds no such self source; the reference resolves to an absent file".into(),
        );
    }
    if reading.source.source_ref != reference {
        return Err("Central redirected the requested self source reference".into());
    }
    if reading.content_encoding != "utf-8" {
        return Err(
            "Self sources resolve as exact UTF-8 bytes; the owner returned another encoding".into(),
        );
    }
    let bytes = reading.content.as_bytes();
    let end = preview_boundary(&reading.content, SELF_SOURCE_PREVIEW_BYTES);
    Ok(json!({
        "reference": reference,
        "content_digest": source_digest(bytes),
        "size_bytes": bytes.len(),
        "text": &reading.content[..end],
        "truncated": end < reading.content.len(),
    }))
}
/// The maximum preview bytes of a pinned self source shown to the author.
const SELF_SOURCE_PREVIEW_BYTES: usize = 20_000;
/// The next authored revision: the trailing number advances (`r3` → `r4`),
/// otherwise a counter is appended (`p` → `p-1`).
pub fn next_revision(revision: &str) -> String {
    let digits = revision.len()
        - revision
            .trim_end_matches(|c: char| c.is_ascii_digit())
            .len();
    if digits > 0 {
        let (head, tail) = revision.split_at(revision.len() - digits);
        if let Ok(n) = tail.parse::<u64>() {
            return format!("{head}{}", n + 1);
        }
    }
    format!("{revision}-1")
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
        // AIKit's registry readings: kept while its home, the root and the
        // project did not change.
        Request::Scope => {
            crate::read_cache::aikit_read(&aikit.identity(), "agent-session-scope", cwd, || {
                aikit.direct_agent(cwd, "agent-session-scope", None)
            })
        }
        Request::Skills => {
            crate::read_cache::aikit_read(&aikit.identity(), "agent-session-skills", cwd, || {
                aikit.direct_agent(cwd, "agent-session-skills", None)
            })
        }
        Request::SkillSets => {
            crate::read_cache::aikit_read(&aikit.identity(), "set-list", cwd, || {
                aikit.set_list(cwd)
            })
        }
        Request::SkillSet { name } => {
            exact(name, 256, "SkillSet name")?;
            crate::read_cache::aikit_read(
                &aikit.identity(),
                &format!("set-show:{name}"),
                cwd,
                || aikit.set_show(cwd, name),
            )
        }
        Request::Session { agent_session } => {
            exact(agent_session, 1024, "AgentSession reference")?;
            let session = aikit.direct_agent(
                cwd,
                "agent-session-read",
                Some(("--agent-session", agent_session)),
            )?;
            if session.is_null() {
                return Ok(json!({"session":null,"profile":null}));
            }
            if session["schema"] != "aikit.direct-agent-session/v1"
                || session["agent_session"].as_str() != Some(agent_session)
            {
                return Err("Native Agent session identity mismatch".into());
            }
            for field in [
                "agent_ref",
                "profile_ref",
                "profile_revision",
                "space",
                "project_ref",
                "acceptance_ref",
            ] {
                exact(
                    session[field]
                        .as_str()
                        .ok_or_else(|| format!("Native session omitted {field}"))?,
                    2048,
                    field,
                )?;
            }
            if session["provider_started"] != false
                || session["execution_authority_granted"] != false
            {
                return Err("Native session reading has incompatible authority standing".into());
            }
            let scope = aikit.direct_agent(cwd, "agent-session-scope", None)?;
            if scope["schema"] != "aikit.direct-agent-scope/v1"
                || scope["execution_authority_granted"] != false
                || session["project_ref"] != scope["project_ref"]
            {
                return Err("Agent session belongs to another native scope".into());
            }
            let mut profile_input = scoped(project);
            profile_input["profile_ref"] = session["profile_ref"].clone();
            let profile = match owner(client, "agent-profile.review", profile_input) {
                Ok(profile) => profile,
                Err(reason) => {
                    return Ok(
                        json!({"session":session,"profile":null,"source_state":"unavailable","reason":reason}),
                    )
                }
            };
            let scope_ref = if project.is_some() {
                format!("project:{}", session["project_ref"].as_str().unwrap())
            } else {
                "control:root".into()
            };
            if profile["schema"] != "central.agent-profile-review/v1"
                || profile["execution_authority_granted"] != false
                || profile["scope_ref"].as_str() != Some(scope_ref.as_str())
                || profile["profile"]["ref"] != session["profile_ref"]
            {
                return Ok(
                    json!({"session":session,"profile":null,"source_state":"unavailable","reason":"Current source review has incompatible identity or standing"}),
                );
            }
            let accepted = profile["accepted"] == true;
            let acceptance = &profile["acceptance"];
            let current = accepted
                && profile["profile"]["revision"] == session["profile_revision"]
                && profile["profile"]["agent_ref"] == session["agent_ref"]
                && acceptance["schema"] == "central.agent-profile-acceptance/v1"
                && acceptance["scope_ref"].as_str() == Some(scope_ref.as_str())
                && acceptance["acceptance_ref"] == session["acceptance_ref"]
                && acceptance["profile_ref"] == session["profile_ref"]
                && acceptance["profile_revision"] == session["profile_revision"]
                && acceptance["agent_ref"] == session["agent_ref"]
                && acceptance["content_digest"] == profile["content_digest"];
            Ok(
                json!({"session":session,"profile":if current {profile["profile"].clone()} else {Value::Null},
                "source_state":if current {"current"} else if accepted {"changed"} else {"revoked"}}),
            )
        }
        Request::Propose {
            name,
            purpose,
            expected_scope_ref,
            skill_refs,
            expressive_character_ref,
            skill_set_refs,
            self_definition,
        } => {
            exact(name, 256, "Agent name")?;
            if let Some(character) = expressive_character_ref {
                character_ref(character)?;
            }
            if let Some(definition) = self_definition {
                validate_self_definition(definition)?;
            }
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
            if let Some(character) = expressive_character_ref {
                input["expressive_character_ref"] = json!(character);
            }
            if let Some(definition) = self_definition {
                // Verbatim: the exact wire object the renderer submitted is
                // what Central's express input carries.
                input["self_definition"] = definition.clone();
            }
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
        Request::SetCharacter {
            profile_ref,
            expected_revision,
            expressive_character_ref,
        } => {
            exact(profile_ref, 1024, "Profile reference")?;
            exact(expected_revision, 1024, "Revision")?;
            if let Some(character) = expressive_character_ref {
                character_ref(character)?;
            }
            let mut review_input = scoped(project);
            review_input["profile_ref"] = json!(profile_ref);
            let before = owner(client, "agent-profile.review", review_input.clone())?;
            let mut read = scoped(project);
            read["profile_ref"] = json!(profile_ref);
            let reading = owner(client, "agent-profile.read", read)?;
            let mut profile = reading["profile"].clone();
            if profile["ref"].as_str() != Some(profile_ref.as_str()) {
                return Err("Central read a different Agent definition".into());
            }
            let current = profile["revision"].as_str().unwrap_or_default().to_owned();
            if current != *expected_revision {
                return Err(format!(
                    "revision_conflict: the Agent definition is at revision {current}, not {expected_revision}; re-read it before changing its character"
                ));
            }
            if profile
                .get("expressive_character_ref")
                .and_then(Value::as_str)
                == expressive_character_ref.as_deref()
            {
                let mut unchanged = before;
                unchanged["character_change"] =
                    json!({"state":"unchanged","revision":current,"re_acceptance_required":false});
                return Ok(unchanged);
            }
            let object = profile
                .as_object_mut()
                .ok_or("Central returned no Agent definition object")?;
            match expressive_character_ref {
                Some(character) => {
                    object.insert("expressive_character_ref".into(), json!(character));
                }
                None => {
                    object.remove("expressive_character_ref");
                }
            }
            let revision = next_revision(&current);
            object.insert("revision".into(), json!(revision));
            let mut save = scoped(project);
            save["profile"] = profile;
            save["expected_revision"] = json!(expected_revision);
            owner(client, "agent-profile.save", save)?;
            let mut after = owner(client, "agent-profile.review", review_input)?;
            let was_accepted = before["accepted"] == true;
            after["character_change"] = json!({
                "state": "saved",
                "previous_revision": current,
                "revision": revision,
                // Acceptance is bound to the exact revision and digest it
                // reviewed; a changed source needs the human's acceptance again.
                "re_acceptance_required": was_accepted && after["accepted"] != true,
            });
            Ok(after)
        }
        Request::SetSelf {
            profile_ref,
            expected_revision,
            self_definition,
        } => {
            exact(profile_ref, 1024, "Profile reference")?;
            exact(expected_revision, 1024, "Revision")?;
            if let Some(definition) = self_definition {
                validate_self_definition(definition)?;
            }
            let mut review_input = scoped(project);
            review_input["profile_ref"] = json!(profile_ref);
            let before = owner(client, "agent-profile.review", review_input.clone())?;
            let mut read = scoped(project);
            read["profile_ref"] = json!(profile_ref);
            let reading = owner(client, "agent-profile.read", read)?;
            let mut profile = reading["profile"].clone();
            if profile["ref"].as_str() != Some(profile_ref.as_str()) {
                return Err("Central read a different Agent definition".into());
            }
            let current = profile["revision"].as_str().unwrap_or_default().to_owned();
            if current != *expected_revision {
                return Err(format!(
                    "revision_conflict: the Agent definition is at revision {current}, not {expected_revision}; re-read it before changing its self definition"
                ));
            }
            if profile.get("self_definition") == self_definition.as_ref() {
                let mut unchanged = before;
                unchanged["self_change"] =
                    json!({"state":"unchanged","revision":current,"re_acceptance_required":false});
                return Ok(unchanged);
            }
            let object = profile
                .as_object_mut()
                .ok_or("Central returned no Agent definition object")?;
            match self_definition {
                Some(definition) => {
                    object.insert("self_definition".into(), definition.clone());
                }
                None => {
                    object.remove("self_definition");
                }
            }
            let revision = next_revision(&current);
            object.insert("revision".into(), json!(revision));
            let mut save = scoped(project);
            save["profile"] = profile;
            save["expected_revision"] = json!(expected_revision);
            owner(client, "agent-profile.save", save)?;
            let mut after = owner(client, "agent-profile.review", review_input)?;
            let was_accepted = before["accepted"] == true;
            after["self_change"] = json!({
                "state": "saved",
                "previous_revision": current,
                "revision": revision,
                // Acceptance is bound to the exact revision and digest it
                // reviewed; a changed source needs the human's acceptance again.
                "re_acceptance_required": was_accepted && after["accepted"] != true,
            });
            Ok(after)
        }
        Request::SelfSourceRead { reference } => {
            source_reference(reference)?;
            self_source_reading(client, project, reference)
        }
        Request::SelfSourceCreate { name, content } => {
            exact(name, 256, "Self source file name")?;
            exact(content, 1_048_576, "Self source text")?;
            if name.starts_with('/')
                || name.contains('\\')
                || name.chars().any(char::is_control)
                || name
                    .split('/')
                    .any(|member| member.is_empty() || member == "." || member == "..")
            {
                return Err("Self source file names must be relative members under the Control/self aperture".into());
            }
            // The person's own pasted prose, saved once through Central's
            // declared human door. Central enforces atomic no-overwrite
            // admission, the Control/self aperture, and refuses any caller
            // its authority law does not admit; the desktop adds no bypass.
            owner(
                client,
                "central.self.source.create",
                json!({
                    "project": Value::Null,
                    "path": name,
                    "content": content,
                    "provenance": "human-authored",
                    "standing": "authored-human-position",
                    "actor_kind": "human",
                    "acceptance": "human-accepted",
                }),
            )?;
            // The created reference follows Central's own source grammar;
            // the read-back through Central's owner is the verification —
            // it returns the exact resolved bytes and the digest to pin,
            // and refuses loudly if the reference does not resolve.
            let relative = format!("Control/self/{name}");
            let escaped = relative
                .replace('%', "%25")
                .replace(':', "%3A")
                .replace(' ', "%20");
            let reference = format!("central:source:control:root:{escaped}");
            let mut reading = self_source_reading(client, None, &reference)?;
            reading["path"] = json!(relative);
            Ok(reading)
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
