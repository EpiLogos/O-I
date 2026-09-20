//! Read canonical AIKit SessionSpace attachment intent. Terminal topology and
//! filesystem isolation are not evidence of an AgentSession or live encounter.
use serde_json::Value;
use std::{
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Clone, Debug)]
pub struct Client {
    executable: PathBuf,
    home: Option<PathBuf>,
    suite_route: bool,
}

impl Client {
    pub fn with(executable: PathBuf, home: Option<PathBuf>) -> Self {
        Self { executable, home, suite_route: false }
    }
    pub fn discover() -> Self {
        Self { executable: std::env::var_os("OI_BIN").map(PathBuf::from).unwrap_or_else(|| "oi".into()), home: None, suite_route: true }
    }
    pub fn read_project(&self, cwd: &Path, project_ref: &str) -> Result<Value, String> {
        read_project_with(&self.executable, self.home.as_deref(), cwd, project_ref, self.suite_route)
    }

    /// Read one session's task record through the owner's own
    /// `encounter-task-read` (`aikit.encounter-task/v1`). Read-only: the
    /// record is the owner's — identity, readiness, the allocated Central
    /// task — carried verbatim; absence (no task bound) surfaces the owner's
    /// own refusal, never a desktop-fabricated record.
    pub fn task_read(&self, cwd: &Path, agent_session: &str) -> Result<Value, String> {
        let mut command = Command::new(&self.executable);
        if self.suite_route { command.arg("aikit"); }
        command.arg("session-space");
        if let Some(home) = &self.home { command.env("AIKIT_HOME", home); }
        command.arg("-C").arg(cwd);
        command.args(["encounter-task-read", "--agent-session", agent_session]);
        let output = command.output()
            .map_err(|e| format!("AIKit SessionSpace is unavailable: {e}"))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
        }
        let mut data: Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("AIKit SessionSpace returned an unreadable task reading: {e}"))?;
        // Some owner revisions wrap the reply in an `ok`/`data` envelope; the
        // kernel's outcome carries the record itself.
        if data.get("ok").and_then(Value::as_bool) == Some(true) {
            data = data.get("data").cloned().unwrap_or(Value::Null);
        }
        // No task bound on this session is honest absence (`null`), not an
        // error — the renderer renders nothing rather than a fabricated
        // record.
        if data.is_null() {
            return Ok(data);
        }
        if !data.is_object() || data.get("schema").and_then(Value::as_str) != Some("aikit.encounter-task/v1") {
            return Err("Unsupported native encounter task reading".into());
        }
        Ok(data)
    }
}

pub fn executable() -> PathBuf {
    // The session-space verbs live in the main aikit binary (O-I #376 fold);
    // callers prepend the `session-space` subcommand to their native args.
    std::env::var_os("OI_AIKIT_BIN")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| "aikit".into())
}

fn read_project_with(
    executable: &Path,
    home: Option<&Path>,
    cwd: &Path,
    project_ref: &str,
    suite_route: bool,
) -> Result<Value, String> {
    let mut command = Command::new(executable);
    if suite_route { command.arg("aikit"); }
    command.arg("session-space");
    if let Some(home) = home {
        command.env("AIKIT_HOME", home);
    }
    let output = command
        .arg("-C")
        .arg(cwd)
        .args(["discover", "--project", project_ref])
        .output()
        .map_err(|e| format!("AIKit SessionSpace is unavailable: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
    }
    let data: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("AIKit SessionSpace returned an unreadable reading: {e}"))?;
    let rows = data
        .as_array()
        .ok_or("AIKit SessionSpace discovery is not an array")?;
    for row in rows {
        if row["version"] != "aikit.session-space-application/v1"
            || !row["definition"]["id"].is_string()
        {
            return Err("Unsupported native SessionSpace reading".into());
        }
        if !row["definition"]["projects"]
            .as_array()
            .is_some_and(|projects| projects.iter().any(|p| p.as_str() == Some(project_ref)))
        {
            return Err(
                "AIKit returned a SessionSpace outside the requested Project membership".into(),
            );
        }
    }
    Ok(data.clone())
}

/// Presentation actions carry canonical identity only. The kernel supplies cwd
/// from Central and this client verifies native project membership before use.
#[derive(Clone, Debug, serde::Deserialize, PartialEq, serde::Serialize)]
#[serde(tag="action", rename_all="kebab-case")]
pub enum EncounterRequest {
    Start,
    Providers,
    Open { space:String, agent_session:String, provider:String },
    Read { agent_session:String, after:u64, limit:usize },
    View {agent_session:String,before:Option<u64>},
    Draft { agent_session:String, basis:u64, text:String },
    Prompt { agent_session:String, draft_revision:u64 },
    Cancel { agent_session:String, reason:Option<String> },
    Status { agent_session:String },
    Permission {agent_session:String,request_id:String,decision:PermissionDecision},
    /// Explicit addressed machine turn. The payload, sender, audience and
    /// participation basis are owner-validated at commit; a refusal carries the
    /// owner's own code verbatim. The human draft buffer is never touched.
    Send { agent_session:String, turn:AddressedTurn },
    /// Addressed group dispatch: one delivery identity, explicit per-recipient
    /// participation bases. The owner admits the whole group (privacy
    /// admission) before the first transport effect and every recipient gets
    /// an independent durable result; the fanout is never atomic.
    SendGroup { delivery_ref:String, sender:String, packet:AddressedPacket, recipients:Vec<GroupRecipient> },
    /// Read one addressed delivery's durable owner receipt.
    Delivery { agent_session:String, delivery_ref:String },
    /// Resume the actually recorded native session identity. The owner refuses
    /// contradictory provider/space/cwd/command bases; a plain open with a
    /// recorded binding is refused first (`encounter.resume_required`).
    Reconnect { space:String, agent_session:String, provider:String },
    /// Probe the resident owner dispatch service (never a provider effect).
    Health,
}
/// Field names are the owner wire contract (`crates/aikit-cli/src/encounter_agency.rs`
/// in the bound ai-kit revision); they are carried verbatim, never re-keyed.
#[derive(Clone, Debug, serde::Deserialize, PartialEq, serde::Serialize)]
pub struct AddressedPacket { pub text:String, pub source_refs:Vec<String>, pub audience:Vec<String> }
/// `expected_task` is the owner's `EncounterTaskBasis`, validated by the owner
/// against the stored task and the session's agency binding before any
/// transport. The kernel never interprets or composes it — an opaque value
/// carried verbatim; a fabricated basis is the owner's refusal to answer.
#[derive(Clone, Debug, serde::Deserialize, PartialEq, serde::Serialize)]
pub struct AddressedTurn { pub delivery_ref:String, pub sender:String, pub expected_binding_revision:String, #[serde(default, skip_serializing_if="Option::is_none")] pub expected_task:Option<Value>, pub packet:AddressedPacket }
/// One explicit group recipient; field names are the owner wire contract
/// (`encounter_agency.rs` in the bound ai-kit revision), carried verbatim.
#[derive(Clone, Debug, serde::Deserialize, PartialEq, serde::Serialize)]
pub struct GroupRecipient { pub agent_session:String, pub expected_binding_revision:String, #[serde(default, skip_serializing_if="Option::is_none")] pub expected_task:Option<Value> }
#[derive(Clone, Debug, serde::Deserialize, PartialEq, serde::Serialize)]
#[serde(tag="outcome",rename_all="lowercase")]
pub enum PermissionDecision {Selected {option_id:String},Cancelled}
impl EncounterRequest {
    fn sessions(&self)->Vec<&str> {match self {
        Self::Start|Self::Providers|Self::Health=>Vec::new(),
        Self::Permission{agent_session,..}|Self::View{agent_session,..}|Self::Open{agent_session,..}|Self::Read{agent_session,..}|Self::Draft{agent_session,..}|Self::Prompt{agent_session,..}|Self::Cancel{agent_session,..}|Self::Status{agent_session}|Self::Send{agent_session,..}|Self::Delivery{agent_session,..}|Self::Reconnect{agent_session,..}=>vec![agent_session],
        // The attachment gate covers every named participant of a group: a
        // session outside this Project's SessionSpaces is refused here, before
        // the owner sees the turn.
        Self::SendGroup{recipients,..}=>recipients.iter().map(|recipient|recipient.agent_session.as_str()).collect(),
    }}
}
impl Client {
    pub fn encounter(&self,cwd:&Path,project_ref:&str,request:&EncounterRequest)->Result<Value,String> {
        let sessions=request.sessions();
        if !sessions.is_empty() {
            let spaces=self.read_project(cwd,project_ref)?;
            let authorized=sessions.iter().all(|session|spaces.as_array().is_some_and(|rows|rows.iter().any(|space| {
                let attached=space["agent_sessions"].as_object().is_some_and(|sessions|sessions.contains_key(*session));
                attached && match request {EncounterRequest::Open{space:requested,..}=>space["definition"]["id"].as_str()==Some(requested),_=>true}
            })));
            if !authorized{return Err("Encounter is not attached to this native Project's SessionSpaces".into());}
        }
        let mut command=Command::new(&self.executable);
        if self.suite_route {command.arg("aikit");}
        command.arg("session-space");
        if let Some(home)=&self.home {command.env("AIKIT_HOME",home);}
        command.arg("-C").arg(cwd);
        if matches!(request,EncounterRequest::Start) {command.arg("encounter-start");}
        else {
            let mut body=serde_json::to_value(request).map_err(|error|error.to_string())?;
            if matches!(request,EncounterRequest::Open{..}|EncounterRequest::Reconnect{..}) {body["cwd"]=serde_json::json!(cwd);}
            command.args(["encounter","--request-json"]).arg(body.to_string());
        }
        let output=command.output().map_err(|error|format!("AIKit encounter owner unavailable: {error}"))?;
        if !output.status.success(){return Err(String::from_utf8_lossy(&output.stderr).trim().into());}
        let response:Value=serde_json::from_slice(&output.stdout).map_err(|error|format!("Unreadable AIKit encounter response: {error}"))?;
        if response["ok"]!=true{
            // The owner's own code travels with its message: addressed-dispatch
            // refusals (`encounter.disclosure_denied`, `encounter.binding_changed`,
            // …) are distinct facts, not one grey failure.
            let message=response["error"]["message"].as_str().unwrap_or("Native encounter operation failed");
            return match response["error"]["code"].as_str() {
                Some(code)=>Err(format!("{message} [{code}]")),
                None=>Err(message.into()),
            };
        }
        Ok(response["data"].clone())
    }

    /// Provision ONE fresh chat conversation for a project and open it, so a
    /// first Send in the desktop's new-chat state just works. This replays the
    /// exact owner CLI sequence proven live for the Factory chat, in order:
    ///
    ///   1. `project-context` — the canonical Project + ContextResolution
    ///      binding; the `project` string is used VERBATIM from this evidence
    ///      (it is the ProjectRef grammar's own spelling, e.g. `Factory`,
    ///      never a desktop-derived `project:Factory`).
    ///   2. `create` → `apply` — a new SessionSpace, one per conversation.
    ///   3. `stage bind-project-context` → `apply` — the whole
    ///      `project-context` output is the binding, verbatim.
    ///   4. `stage attach-agent-session` → `apply` — a freshly minted
    ///      `agent-session/<id>`.
    ///   5. `encounter-agency-configure` — the session's native Agency
    ///      binding. No per-project agency mint exists in the suite (checked:
    ///      `aikit factory` and `actuation` expose no such verb), so the
    ///      binding is composed by reusing the owner's most recently ADMITTED
    ///      agency source: identity fields, agency source (path + digest) and
    ///      `actuation_bin` are copied verbatim from a stored binding whose
    ///      source file still exists; the revision label is new and the
    ///      configure runs the real `actuation agency actualise` admission.
    ///      This is a disclosed limitation, not a mint.
    ///   6. `encounter open` — through the ordinary `encounter` gate, which
    ///      re-verifies the new space's Project membership before opening the
    ///      provider.
    ///
    /// The existing attachment gate stays intact for every other action;
    /// provision is the one path allowed to CREATE the attachment it needs.
    pub fn provision(&self,cwd:&Path,project_ref:&str)->Result<Value,String> {
        let context=self.session_space(cwd,&["project-context"])?;
        let binding:Value=serde_json::from_str(&context)
            .map_err(|error|format!("Unreadable AIKit project-context reading: {error}"))?;
        let project=binding["project"].as_str().filter(|p|!p.trim().is_empty())
            .ok_or("AIKit project-context disclosed no Project")?.to_owned();
        let (space,agent_session)=mint_chat_refs(&project);
        let label=format!("{project} chat (desktop-provisioned)");

        // Create the space, then stage+apply the context binding and the
        // session attachment against it. Stage requires the space to exist
        // (apply create first); previews travel by temp file because the
        // context evidence is owner-sized.
        let preview=self.session_space(cwd,&["create",&space,"--label",&label])?;
        self.apply_preview(cwd,&preview)?;
        let intent=serde_json::json!({"operation":"bind-project-context","binding":binding});
        let staged=self.stage_intent(cwd,&space,&intent)?;
        self.apply_preview(cwd,&staged)?;
        let intent=serde_json::json!({"operation":"attach-agent-session","attachment":{
            "agent_session":agent_session,"purpose":"Desktop chat conversation","provenance":[]}});
        let staged=self.stage_intent(cwd,&space,&intent)?;
        self.apply_preview(cwd,&staged)?;

        // The session's native Agency binding, reused from the owner's latest
        // admitted agency (see the doc comment: disclosed reuse, not a mint).
        let stamp=chat_stamp();
        let reference=find_reference_binding(&agencies_state_dir())?;
        let binding=compose_chat_binding(reference,&format!("rev/desktop-chat-{stamp}"));
        let binding_json=serde_json::to_string(&binding).map_err(|error|format!("Agency binding is not serialisable: {error}"))?;
        with_temp_json(&binding_json,|path|{
            self.session_space(cwd,&[
                "encounter-agency-configure",
                "--agent-session",&agent_session,
                "--binding-json",&format!("@{path}"),
            ])
        })?;

        // Provider choice for a new chat: a stable configured provider — the
        // one literally named `pi` when present, else the owner's first row.
        // The composer's own connect UI can switch the conversation later.
        let rows=self.encounter(cwd,project_ref,&EncounterRequest::Providers)?;
        let provider=default_provider(rows.as_array().map(Vec::as_slice).unwrap_or_default())
            .ok_or("No ACP provider is configured; connect one in System → Sources, then send again")?;

        // The ordinary open — and the ordinary gate: discover runs again and
        // must now see the new space carrying this Project and this session.
        let opened=self.encounter(cwd,project_ref,&EncounterRequest::Open{
            space:space.clone(),agent_session:agent_session.clone(),provider:provider.clone()})?;
        Ok(serde_json::json!({
            "project":project,
            "space":space,
            "agent_session":agent_session,
            "provider":provider,
            "open":opened,
        }))
    }

    /// Run one `session-space` verb and return its stdout (the folded CLI
    /// prints plain JSON and reports refusals on stderr with a failed exit).
    fn session_space(&self,cwd:&Path,args:&[&str])->Result<String,String> {
        let mut command=Command::new(&self.executable);
        if self.suite_route {command.arg("aikit");}
        command.arg("session-space");
        if let Some(home)=&self.home {command.env("AIKIT_HOME",home);}
        command.arg("-C").arg(cwd);
        command.args(args);
        let output=command.output().map_err(|error|format!("AIKit SessionSpace is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
    }
    /// Apply exactly a previously staged preview (by temp file; previews are
    /// owner-sized and argv is not).
    fn apply_preview(&self,cwd:&Path,preview:&str)->Result<(),String> {
        with_temp_json(preview,|path|{
            self.session_space(cwd,&["apply","--preview-json",&format!("@{path}")])
        }).map(|_|())
    }
    /// Stage one typed mutation against a space (by temp file) and return the
    /// preview to apply.
    fn stage_intent(&self,cwd:&Path,space:&str,intent:&Value)->Result<String,String> {
        let intent=serde_json::to_string(intent).map_err(|error|format!("SessionSpace intent is not serialisable: {error}"))?;
        with_temp_json(&intent,|path|{
            self.session_space(cwd,&["stage","--space",space,"--intent-json",&format!("@{path}")])
        })
    }
}

/// The provider default for a new chat: the row literally named `pi` when
/// present, else the first configured row. `None` = nothing is configured.
pub fn default_provider(rows:&[Value])->Option<String> {
    let ids:Vec<&str>=rows.iter().filter_map(|row|row["id"].as_str()).collect();
    if ids.is_empty() {return None;}
    Some(if ids.contains(&"pi") {"pi".to_owned()} else {ids[0].to_owned()})
}

/// A readable, unique-per-call slug: the project's own name, lowercased and
/// folded, bounded — so `Factory` mints `factory-chat-…` refs a person can
/// recognise in the owner's own state.
fn chat_slug(project:&str)->String {
    let folded:String=project.chars()
        .map(|c|if c.is_ascii_alphanumeric() {c.to_ascii_lowercase()} else {'-'})
        .collect();
    let trimmed=folded.trim_matches('-');
    if trimmed.is_empty() {"chat".to_owned()} else {trimmed.chars().take(24).collect()}
}
/// Millisecond-stamped unique suffix for minted refs.
fn chat_stamp()->String {
    let now=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
        .map(|d|d.as_nanos()).unwrap_or(0);
    format!("{}-{:04x}",now/1_000_000_000,(now%0x1_0000) as u16)
}
/// Mint the fresh conversation's two refs (one SessionSpace, one AgentSession
/// — the 1:1 shape of every proven chat provisioning).
fn mint_chat_refs(project:&str)->(String,String) {
    let stamp=chat_stamp();
    let slug=chat_slug(project);
    (format!("session-space/{slug}-chat-{stamp}"),format!("agent-session/{slug}-chat-{stamp}"))
}

/// The owner's encounter-agency state directory, resolved by the owner's own
/// home law (`AIKIT_HOME`, else `~/.aikit`) — the same precedence
/// `aikit-store/src/home.rs` encodes.
fn agencies_state_dir()->std::path::PathBuf {
    let root=std::env::var_os("AIKIT_HOME").map(std::path::PathBuf::from)
        .or_else(||std::env::var_os("HOME").map(|home|std::path::PathBuf::from(home).join(".aikit")))
        .unwrap_or_default();
    root.join("state").join("encounter-agencies")
}

/// The reference binding a new chat reuses: the owner's most recently ADMITTED
/// agency — `active`, at least one permitted sender, and an agency source file
/// that still exists on disk. Read-only reuse of the source; nothing here
/// edits another session's binding.
fn find_reference_binding(dir:&std::path::Path)->Result<Value,String> {
    let entries=std::fs::read_dir(dir).map_err(|error|
        format!("No admitted Agency binding is available to reuse ({}: {error}); configure one with `aikit session-space encounter-agency-configure` first",dir.display()))?;
    let mut candidates:Vec<(std::time::SystemTime,std::path::PathBuf,Value)>=Vec::new();
    for entry in entries.flatten() {
        let path=entry.path();
        if path.extension().and_then(|e|e.to_str())!=Some("json") {continue;}
        let Ok(bytes)=std::fs::read(&path) else {continue};
        let Ok(binding)=serde_json::from_slice::<Value>(&bytes) else {continue};
        let senders=binding["allowed_senders"].as_array().map(Vec::len).unwrap_or(0);
        let source_path=binding["agency_source"]["path"].as_str().map(std::path::PathBuf::from);
        let source_live=source_path.is_some_and(|p|p.is_file());
        if binding["active"]==true && senders>0 && source_live {
            let modified=entry.metadata().and_then(|m|m.modified()).unwrap_or(std::time::UNIX_EPOCH);
            candidates.push((modified,path,binding));
        }
    }
    candidates.sort_by_key(|(modified,_,_)|*modified);
    candidates.pop().map(|(_,_,binding)|binding)
        .ok_or_else(||"No admitted Agency binding is available to reuse: every stored binding is inactive, sender-less, or its agency source file is gone".to_owned())
}

/// Compose the NEW session's binding by copying the admitted identity
/// verbatim and minting only the revision label — the CAS law
/// (`encounter_agency.rs::configure_agency`) requires a new session's binding
/// revision to differ from any current one, and there is no current one.
fn compose_chat_binding(reference:Value,revision:&str)->Value {
    let mut binding=reference.clone();
    if let Some(object)=binding.as_object_mut() {
        object.insert("revision".into(),serde_json::Value::String(revision.to_owned()));
        object.insert("active".into(),serde_json::Value::Bool(true));
    }
    binding
}

/// Write JSON to one temp file for the `@file` CLI grammar, cleaned up after
/// the call (the file holds no secrets — owner-staged previews and bindings).
fn with_temp_json<T>(json:&str,run:impl FnOnce(&str)->Result<T,String>)->Result<T,String> {
    let stamp=chat_stamp().replace('-',"");
    let path=std::env::temp_dir().join(format!("oi-cradle-provision-{stamp}.json"));
    let write=||->Result<(),String> {
        std::fs::write(&path,json).map_err(|error|format!("Could not stage owner JSON at {}: {error}",path.display()))
    };
    let outcome=write().and_then(|()|run(&path.to_string_lossy()));
    let _=std::fs::remove_file(&path);
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn draft_text_reaches_the_owner_verbatim() {
        // The /model law: slash-commands are the harness's own surface; the
        // kernel's draft request is a verbatim carrier and must never grow a
        // command interpreter.
        let request=EncounterRequest::Draft{agent_session:"agent-session/x".into(),basis:3,text:"/model".into()};
        let body=serde_json::to_value(&request).unwrap();
        assert_eq!(body["action"],serde_json::json!("draft"));
        assert_eq!(body["text"],serde_json::json!("/model"));
    }

    #[test]
    fn provider_default_prefers_pi_then_first_row() {
        let row=|id:&str|serde_json::json!({"id":id,"label":id});
        assert_eq!(default_provider(&[]),None,"no configured provider is an honest None");
        assert_eq!(default_provider(&[row("claude-code"),row("pi")]).as_deref(),Some("pi"));
        assert_eq!(default_provider(&[row("claude-code"),row("codex")]).as_deref(),Some("claude-code"));
        assert_eq!(default_provider(&[row("pi")]).as_deref(),Some("pi"));
        assert_eq!(default_provider(&[serde_json::json!({"label":"no id"})]),None,"rows without ids never answer");
    }

    #[test]
    fn chat_refs_are_readable_unique_and_prefixed() {
        let (space,session)=mint_chat_refs("Factory");
        assert!(space.starts_with("session-space/factory-chat-"),"{space}");
        assert!(session.starts_with("agent-session/factory-chat-"),"{session}");
        assert!(space.trim().chars().all(|c|c.is_ascii_alphanumeric()||c=='-'||c=='/'),"{space}");
        let (space2,_)=mint_chat_refs("Factory");
        assert_ne!(space,space2,"two provisions never mint the same space ref");
        let (odd,_)=mint_chat_refs("///");
        assert!(odd.starts_with("session-space/chat-"),"an unfoldable project falls back to `chat`");
        let (long,_)=mint_chat_refs("This Is An Extremely Long Project Name Indeed");
        assert!(long.len()<"session-space/".len()+24+"-chat-".len()+24,"{} is bounded",long);
    }

    #[test]
    fn reference_binding_picks_the_newest_admitted_and_refuses_stale_sources() {
        let dir=std::env::temp_dir().join(format!("oi-agency-test-{}",std::process::id()));
        let _=std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let source=dir.join("agency-request.json");
        std::fs::write(&source,"{}").unwrap();
        let write_binding=|name:&str,body:Value| {
            let path=dir.join(format!("{name}.json"));
            std::fs::write(&path,serde_json::to_vec(&body).unwrap()).unwrap();
            path
        };
        let live=|revision:&str|serde_json::json!({
            "revision":revision,"active":true,
            "agent_ref":"agent:x","agency_ref":"agency:x","world_ref":"project:x","world_binding_ref":"binding:x",
            "agency_source":{"source_ref":"source/x","revision":"source/1","path":source,"content_digest":"blake3:aa"},
            "actuation_bin":"/Users/admin/.local/bin/actuation",
            "allowed_senders":["human:owner"],"allowed_packet_sources":[],"context":null
        });
        let older=write_binding("older",live("rev/older"));
        let newer=write_binding("newer",live("rev/newer"));
        let stale=write_binding("stale",serde_json::json!({
            "revision":"rev/stale","active":true,
            "agent_ref":"agent:y","agency_ref":"agency:y","world_ref":"project:y","world_binding_ref":"binding:y",
            "agency_source":{"source_ref":"source/y","revision":"source/1","path":"/nonexistent/agency.json","content_digest":"blake3:bb"},
            "actuation_bin":"/Users/admin/.local/bin/actuation",
            "allowed_senders":["human:owner"],"allowed_packet_sources":[],"context":null
        }));
        let withdrawn=write_binding("withdrawn",serde_json::json!({
            "revision":"rev/wd","active":false,
            "agent_ref":"agent:z","agency_ref":"agency:z","world_ref":"project:z","world_binding_ref":"binding:z",
            "agency_source":{"source_ref":"source/z","revision":"source/1","path":source,"content_digest":"blake3:cc"},
            "actuation_bin":"/Users/admin/.local/bin/actuation",
            "allowed_senders":["human:owner"],"allowed_packet_sources":[],"context":null
        }));
        // Distinct mtimes: older predates newer; the stale pair is oldest.
        let base=std::time::SystemTime::now()-std::time::Duration::from_secs(60);
        for (index,path) in [stale.clone(),withdrawn.clone(),older.clone(),newer.clone()].into_iter().enumerate() {
            std::fs::File::options().write(true).open(&path).unwrap()
                .set_modified(base+std::time::Duration::from_secs(index as u64)).unwrap();
        }
        let picked=find_reference_binding(&dir).unwrap();
        assert_eq!(picked["revision"],serde_json::json!("rev/newer"),"the newest admitted binding is the reference");
        // Composing mints a new revision label and keeps every identity field.
        let composed=compose_chat_binding(picked.clone(),"rev/desktop-chat-1");
        assert_eq!(composed["revision"],serde_json::json!("rev/desktop-chat-1"));
        assert_eq!(composed["agent_ref"],picked["agent_ref"]);
        assert_eq!(composed["agency_source"],picked["agency_source"]);
        assert_eq!(composed["allowed_senders"],picked["allowed_senders"]);
        assert_eq!(composed["active"],serde_json::json!(true));
        let _=std::fs::remove_dir_all(&dir);
    }
}
