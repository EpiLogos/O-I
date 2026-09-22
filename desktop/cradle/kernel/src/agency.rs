//! Read canonical AIKit SessionSpace attachment intent. Terminal topology and
//! filesystem isolation are not evidence of an AgentSession or live encounter.
use serde_json::Value;
use std::{
    path::{Path, PathBuf},
    process::Command,
    sync::{atomic::{AtomicU8, Ordering}, Arc},
};

#[derive(Clone, Debug)]
pub struct Client {
    executable: PathBuf,
    home: Option<PathBuf>,
    suite_route: bool,
    /// The per-process verdict on whether the installed suite carries the
    /// `encounter-agency-mint` verb (0 unknown, 1 present, 2 absent). The
    /// absent-verb probe is never retried against a suite that already
    /// answered; clones share the one cell.
    mint_support: Arc<AtomicU8>,
}

impl Client {
    pub fn with(executable: PathBuf, home: Option<PathBuf>) -> Self {
        Self { executable, home, suite_route: false, mint_support: Arc::new(AtomicU8::new(0)) }
    }
    pub fn discover() -> Self {
        Self { executable: std::env::var_os("OI_BIN").map(PathBuf::from).unwrap_or_else(|| "oi".into()), home: None, suite_route: true, mint_support: Arc::new(AtomicU8::new(0)) }
    }
    /// Exact native Direct Agent verbs. Neither renderer-selected executables
    /// nor human credential values can enter this command seam.
    pub fn direct_agent(&self, cwd: &Path, operation: &str, argument: Option<(&str,&str)>) -> Result<Value,String> {
        match (operation, argument.map(|(flag,_)|flag)) {
            ("agent-session-scope", None) |
            ("agent-session-skills", None) |
            ("agent-session-read", Some("--agent-session")) |
            ("agent-session-prepare", Some("--request-json")) |
            ("agent-session-find", Some("--request-id")) => (),
            _ => return Err("Unsupported native Agent operation".into()),
        }
        let mut command = Command::new(&self.executable);
        if self.suite_route { command.arg("aikit"); }
        command.arg("session-space").arg("-C").arg(cwd).arg(operation);
        if let Some((flag,value))=argument { command.arg(flag).arg(value); }
        if let Some(home)=&self.home { command.env("AIKIT_HOME",home); }
        if let Some(root)=std::env::var_os("OI_CENTRAL_ROOT") { command.env("CENTRAL_ROOT",root); }
        let output=command.output().map_err(|e|format!("Native Agent owner unavailable: {e}"))?;
        if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned()); }
        if output.stdout.len()>1024*1024 { return Err("Native Agent response exceeds the bounded reading size".into()); }
        let mut value:Value=serde_json::from_slice(&output.stdout).map_err(|e|format!("Unreadable native Agent response: {e}"))?;
        if value.get("ok").and_then(Value::as_bool)==Some(false) { return Err(format!("Native Agent refusal: {}",value["error"])); }
        if value.get("ok").and_then(Value::as_bool)==Some(true) { value=value.get("data").cloned().ok_or("Native Agent response has no data")?; }
        Ok(value)
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
    // control:root is a register name, not a globally unique World identity.
    // Retained local test/other Worlds can share it. Their own context locator
    // keeps them out of this World's conversation list and action gate, while
    // the owner's canonical records and non-local placement remain intact.
    if project_ref == "control:root" {
        let here=std::fs::canonicalize(cwd).map_err(|e|format!("Cannot resolve current Central ground: {e}"))?;
        return Ok(Value::Array(rows.iter().filter(|row| {
            let locator=&row["project_contexts"][project_ref]["basis"]["project_binding"]["locator"];
            if locator["kind"].as_str()!=Some("local-directory") { return true; }
            locator["path"].as_str().is_some_and(|path|std::fs::canonicalize(path).is_ok_and(|root|root==here))
        }).cloned().collect()));
    }
    Ok(data.clone())
}

/// Presentation actions carry canonical identity only. The kernel supplies cwd
/// from Central and this client verifies native project membership before use.
#[derive(Clone, Debug, serde::Deserialize, PartialEq, serde::Serialize)]
#[serde(tag="action", rename_all="kebab-case")]
pub enum EncounterRequest {
    /// Scope is stamped from Central below, never supplied by the renderer.
    Context { agent_session:Option<String>, request:Value },
    PromptContext { agent_session:String, draft_revision:u64, context:Value },
    Start,
    Providers,
    ModelRead { agent_session:String },
    ModelSelect { agent_session:String, provider_model_id:String, #[serde(default,skip_serializing_if="Option::is_none")] provider_reasoning_effort:Option<String>, expected_native_session_id:String },
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
        Self::Context{agent_session,..}=>agent_session.iter().map(String::as_str).collect(),
        Self::PromptContext{agent_session,..}=>vec![agent_session],
        Self::Permission{agent_session,..}|Self::View{agent_session,..}|Self::Open{agent_session,..}|Self::Read{agent_session,..}|Self::Draft{agent_session,..}|Self::Prompt{agent_session,..}|Self::Cancel{agent_session,..}|Self::Status{agent_session}|Self::ModelRead{agent_session}|Self::ModelSelect{agent_session,..}|Self::Send{agent_session,..}|Self::Delivery{agent_session,..}|Self::Reconnect{agent_session,..}=>vec![agent_session],
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
                attached && match request {EncounterRequest::Open{space:requested,..}|EncounterRequest::Reconnect{space:requested,..}=>space["definition"]["id"].as_str()==Some(requested),_=>true}
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
            if let EncounterRequest::Context{agent_session,request:operation}=request {
                body=serde_json::json!({"action":"context","request":{"scope":{"project":project_ref,"agent_session":agent_session},"request":operation}});
            }
            if let EncounterRequest::PromptContext{agent_session,context,..}=request {
                if context["scope"]["project"].as_str()!=Some(project_ref)||context["scope"]["agent_session"].as_str()!=Some(agent_session){return Err("Prepared context does not belong to this native Project and AgentSession".into());}
            }
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
        if let EncounterRequest::Context{agent_session,..}=request {
            let data=&response["data"];
            if data["scope"]["project"].as_str()!=Some(project_ref)||data["scope"]["agent_session"].as_str()!=agent_session.as_deref(){return Err("Native prepared-context response changed Project or session".into());}
        }
        Ok(response["data"].clone())
    }

    /// Create one native conversation, mint its own current Agency, and open
    /// the explicitly selected (or held/default) native harness. No model turn
    /// is sent here. The face can prepare this way to configure a model first.
    pub fn provision(&self,cwd:&Path,project_ref:&str,provider_override:Option<&str>)->Result<Value,String> {
        let rows=self.encounter(cwd,project_ref,&EncounterRequest::Providers)?;
        let configured=rows.as_array().map(Vec::as_slice).unwrap_or_default();
        let (provider,provider_default)=if let Some(selected)=provider_override {
            if !configured.iter().any(|row|row["id"].as_str()==Some(selected)) {
                return Err("The selected native harness is no longer configured; refresh its choices".into());
            }
            (selected.to_owned(),"explicit-choice")
        } else {
            default_provider_choice(configured,crate::chat_defaults::held_provider().as_deref())
                .ok_or("No native encounter harness is configured")?
        };
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

        // A refusal of this session's mint is not authority to borrow another
        // Agent's historical source. Preserve that refusal and native state.
        let agency_data=self.mint_agency(cwd,&agent_session)?;
        let agent_ref=agency_data["agent_ref"].as_str().ok_or("Native mint returned no Agent identity")?;

        // The ordinary open — and the ordinary gate: discover runs again and
        // must now see the new space carrying this Project and this session.
        let opened=self.encounter(cwd,project_ref,&EncounterRequest::Open{
            space:space.clone(),agent_session:agent_session.clone(),provider:provider.clone()});
        // Once a real conversation and Agency exist, return their identities
        // even if the final provider open fails. The ordinary disconnected
        // session owns reconnect; retrying must not create another conversation.
        let (open,connection)=match opened {
            Ok(value)=>(value,serde_json::json!({"state":"resident"})),
            Err(refusal)=>(Value::Null,serde_json::json!({"state":"prepared","refusal":refusal})),
        };
        Ok(serde_json::json!({
            "project":project,
            "space":space,
            "agent_session":agent_session,
            "agent_ref":agent_ref,
            "agency":"minted-per-project",
            "agency_source":agency_data["agency_source"],
            "agency_admission":agency_data["agency_admission"],
            "provider":provider,
            "provider_default":provider_default,
            "open":open,
            "connection":connection,
        }))
    }

    /// Ask the owner to mint this session's per-project Agency binding
    /// (`aikit session-space encounter-agency-mint --agent-session <id>
    /// --project-cwd <dir>`). Success carries the owner's own data (the
    /// minted `agent_ref` among it); any failure is the owner's own stderr.
    /// A stderr naming an unknown subcommand is the suite saying the verb
    /// does not exist in this installed cut — that verdict is cached for
    /// this process so later provisions retain that refusal without re-probing.
    fn mint_agency(&self,cwd:&Path,agent_session:&str)->Result<Value,String> {
        if self.mint_support.load(Ordering::Relaxed)==2 {
            return Err("the installed suite has no encounter-agency-mint verb (cached)".into());
        }
        let mut command=Command::new(&self.executable);
        if self.suite_route {command.arg("aikit");}
        command.arg("session-space");
        if let Some(home)=&self.home {command.env("AIKIT_HOME",home);}
        command.args(["encounter-agency-mint","--agent-session",agent_session,"--project-cwd"]).arg(cwd);
        let output=command.output().map_err(|error|format!("AIKit SessionSpace is unavailable: {error}"))?;
        if !output.status.success() {
            let stderr=String::from_utf8_lossy(&output.stderr).trim().to_owned();
            if mint_verb_absent(&stderr) {self.mint_support.store(2,Ordering::Relaxed);}
            return Err(stderr);
        }
        self.mint_support.store(1,Ordering::Relaxed);
        let mut data:Value=serde_json::from_slice(&output.stdout)
            .map_err(|error|format!("Unreadable AIKit agency mint response: {error}"))?;
        if data.get("ok").and_then(Value::as_bool)==Some(true) {
            data=data.get("data").cloned().unwrap_or(Value::Null);
        }
        Ok(data)
    }

    /// The installed harnesses' real status through the suite route
    /// (`aikit --json client status`): which harnesses are detected, which
    /// have AIKit installed on them, their config dirs and gaps. A
    /// machine-level read — no project disclosure is consulted and none is
    /// needed; the payload is the owner's own `data`, verified to carry
    /// the `clients` rows.
    pub fn harness_status(&self)->Result<Value,String> {
        let mut command=Command::new(&self.executable);
        if self.suite_route {command.arg("aikit");}
        if let Some(home)=&self.home {command.env("AIKIT_HOME",home);}
        command.args(["--json","client","status"]);
        let output=command.output().map_err(|error|format!("AIKit client status is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
        }
        let mut data:Value=serde_json::from_slice(&output.stdout)
            .map_err(|error|format!("AIKit client status returned unreadable JSON: {error}"))?;
        if data.get("ok").and_then(Value::as_bool)==Some(true) {
            data=data.get("data").cloned().unwrap_or(Value::Null);
        }
        if !data.get("clients").is_some_and(Value::is_array) {
            return Err("AIKit client status carried no clients reading".into());
        }
        Ok(data)
    }

    /// The resolved model catalogue through the suite route
    /// (`aikit model-catalogue show --json`): first-party seed, provider
    /// sources and owner entries as the owner resolved them. Machine-level
    /// read; the payload is the owner's own `data` verbatim.
    pub fn model_catalogue(&self)->Result<Value,String> {
        let mut command=Command::new(&self.executable);
        if self.suite_route {command.arg("aikit");}
        if let Some(home)=&self.home {command.env("AIKIT_HOME",home);}
        command.args(["model-catalogue","show","--json"]);
        let output=command.output().map_err(|error|format!("AIKit model catalogue is unavailable: {error}"))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
        }
        let mut data:Value=serde_json::from_slice(&output.stdout)
            .map_err(|error|format!("AIKit model catalogue returned unreadable JSON: {error}"))?;
        if data.get("ok").and_then(Value::as_bool)==Some(true) {
            data=data.get("data").cloned().unwrap_or(Value::Null);
        }
        if !data.get("entries").is_some_and(Value::is_array) {
            return Err("AIKit model catalogue carried no entries reading".into());
        }
        Ok(data)
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

/// The provider default for a new chat, with the rule that chose it, in
/// precedence order: the owner's held choice (when it names a configured
/// row), the row literally named `pi`, else the first configured row.
/// `None` = nothing is configured. A held choice that no longer names a
/// configured row falls through honestly — it is never invented back.
pub fn default_provider_choice(rows:&[Value],owner_choice:Option<&str>)->Option<(String,&'static str)> {
    let ids:Vec<&str>=rows.iter().filter_map(|row|row["id"].as_str()).collect();
    if ids.is_empty() {return None;}
    if let Some(choice)=owner_choice.map(str::trim).filter(|choice|!choice.is_empty()&&ids.contains(choice)) {
        return Some((choice.to_owned(),"owner-choice"));
    }
    if ids.contains(&"pi") {return Some(("pi".to_owned(),"pi-row"));}
    Some((ids[0].to_owned(),"first-configured"))
}

/// The provider default alone (the choice without its rule).
pub fn default_provider(rows:&[Value],owner_choice:Option<&str>)->Option<String> {
    default_provider_choice(rows,owner_choice).map(|(provider,_)|provider)
}

/// Whether a mint refusal is really the suite saying the verb does not
/// exist in this installed cut (clap's own spelling), not a refusal of
/// this one session.
fn mint_verb_absent(stderr:&str)->bool {
    stderr.contains("unrecognized subcommand")
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
        // The kernel transports draft text verbatim; presentation shortcuts belong to the face. The
        // kernel's draft request is a verbatim carrier and must never grow a
        // command interpreter.
        let request=EncounterRequest::Draft{agent_session:"agent-session/x".into(),basis:3,text:"/model".into()};
        let body=serde_json::to_value(&request).unwrap();
        assert_eq!(body["action"],serde_json::json!("draft"));
        assert_eq!(body["text"],serde_json::json!("/model"));
    }

    #[test]
    fn provider_default_prefers_owner_choice_then_pi_then_first_row() {
        let row=|id:&str|serde_json::json!({"id":id,"label":id});
        let rows=&[row("claude-code"),row("pi")];
        // No configured provider is an honest None, whatever was held.
        assert_eq!(default_provider(&[],Some("pi")),None);
        assert_eq!(default_provider(&[],None),None);
        // The owner's held choice wins when it names a configured row.
        assert_eq!(default_provider_choice(rows,Some("claude-code")),Some(("claude-code".into(),"owner-choice")));
        assert_eq!(default_provider_choice(rows,Some(" pi ")),Some(("pi".into(),"owner-choice")),"a padded choice is trimmed, not dropped");
        // Without a held choice: the `pi` row, else the first configured.
        assert_eq!(default_provider_choice(rows,None),Some(("pi".into(),"pi-row")));
        assert_eq!(default_provider_choice(&[row("claude-code"),row("codex")],None),Some(("claude-code".into(),"first-configured")));
        // A held choice that no longer names a configured row falls through —
        // never invented back into the list.
        assert_eq!(default_provider_choice(rows,Some("withdrawn-provider")),Some(("pi".into(),"pi-row")));
        assert_eq!(default_provider_choice(&[row("codex")],Some("withdrawn")),Some(("codex".into(),"first-configured")));
        // Blank held choices are absence, and rows without ids never answer.
        assert_eq!(default_provider_choice(rows,Some("  ")).map(|(p,_)|p),Some("pi".to_owned()));
        assert_eq!(default_provider(&[serde_json::json!({"label":"no id"})],None),None);
    }

    #[test]
    fn a_missing_mint_verb_is_recognised_and_cached_per_process() {
        assert!(mint_verb_absent("error: unrecognized subcommand 'encounter-agency-mint'"));
        assert!(mint_verb_absent("oi-aikit \n error: unrecognized subcommand"));
        // A refusal from a present verb is not absence and cannot
        // authorize borrowing another session's binding.
        assert!(!mint_verb_absent("encounter.agency refuses: no admitted source"));
        assert!(!mint_verb_absent(""));
        let client=Client::with("definitely-not-a-binary".into(),None);
        assert_eq!(client.mint_support.load(Ordering::Relaxed),0,"a fresh client has no verdict");
    }

    /// The mint success shape (`{"ok":true,"data":{...}}`) and the absent-verb
    /// verdict cache, against stub executables (configuration.rs's pattern).
    #[test]
    fn mint_agency_parses_success_and_caches_the_absent_verb() {
        let dir=std::env::temp_dir().join(format!("oi-mint-test-{}",std::process::id()));
        let _=std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let script=|name:&str,body:&str| {
            let path=dir.join(name);
            std::fs::write(&path,format!("#!/bin/sh\n{body}\n")).unwrap();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&path,std::fs::Permissions::from_mode(0o755)).unwrap();
            }
            path
        };
        let ok=script("mint-ok","echo '{\"ok\":true,\"data\":{\"configured\":true,\"standing\":\"minted-per-project-agency\",\"agent_ref\":\"agent/oh-i\"}}'");
        let absent=script("mint-absent","echo \"error: unrecognized subcommand 'encounter-agency-mint'\" >&2\nexit 2");

        let success=Client::with(ok,None).mint_agency(std::path::Path::new("/tmp"),"agent-session/x").unwrap();
        assert_eq!(success["standing"],serde_json::json!("minted-per-project-agency"));
        assert_eq!(success["agent_ref"],serde_json::json!("agent/oh-i"));

        // The absent verb is refused once, the verdict is cached, and the
        // next call refuses WITHOUT running the executable again.
        let absent_client=Client::with(absent.clone(),None);
        let error=absent_client.mint_agency(std::path::Path::new("/tmp"),"agent-session/x").unwrap_err();
        assert!(mint_verb_absent(&error),"{error}");
        assert_eq!(absent_client.mint_support.load(Ordering::Relaxed),2);
        // Rewrite the stub to succeed: the cached verdict still refuses first.
        std::fs::write(&absent,"#!/bin/sh\necho '{\"ok\":true}'\n").unwrap();
        assert!(absent_client.mint_agency(std::path::Path::new("/tmp"),"agent-session/x").is_err());
        let _=std::fs::remove_dir_all(&dir);
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

}
