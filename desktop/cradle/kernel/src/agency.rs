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
}

pub fn executable() -> PathBuf {
    std::env::var_os("OI_AIKIT_SESSION_SPACE_BIN")
        .map(std::path::PathBuf::from)
        .or_else(|| {
            std::env::var_os("OI_AIKIT_BIN")
                .map(|p| std::path::PathBuf::from(p).with_file_name("aikit-session-space"))
        })
        .unwrap_or_else(|| "aikit-session-space".into())
}

fn read_project_with(
    executable: &Path,
    home: Option<&Path>,
    cwd: &Path,
    project_ref: &str,
    suite_route: bool,
) -> Result<Value, String> {
    let mut command = Command::new(executable);
    if suite_route { command.arg("aikit-session-space"); }
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
    /// Read one addressed delivery's durable owner receipt.
    Delivery { agent_session:String, delivery_ref:String },
    /// Probe the resident owner dispatch service (never a provider effect).
    Health,
}
/// Field names are the owner wire contract (`crates/aikit-cli/src/encounter_agency.rs`
/// in the bound ai-kit revision); they are carried verbatim, never re-keyed.
#[derive(Clone, Debug, serde::Deserialize, PartialEq, serde::Serialize)]
pub struct AddressedPacket { pub text:String, pub source_refs:Vec<String>, pub audience:Vec<String> }
#[derive(Clone, Debug, serde::Deserialize, PartialEq, serde::Serialize)]
pub struct AddressedTurn { pub delivery_ref:String, pub sender:String, pub expected_binding_revision:String, pub packet:AddressedPacket }
#[derive(Clone, Debug, serde::Deserialize, PartialEq, serde::Serialize)]
#[serde(tag="outcome",rename_all="lowercase")]
pub enum PermissionDecision {Selected {option_id:String},Cancelled}
impl EncounterRequest {
    fn sessions(&self)->Vec<&str> {match self {
        Self::Start|Self::Providers|Self::Health=>Vec::new(),
        Self::Permission{agent_session,..}|Self::View{agent_session,..}|Self::Open{agent_session,..}|Self::Read{agent_session,..}|Self::Draft{agent_session,..}|Self::Prompt{agent_session,..}|Self::Cancel{agent_session,..}|Self::Status{agent_session}|Self::Send{agent_session,..}|Self::Delivery{agent_session,..}=>vec![agent_session],
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
        if self.suite_route {command.arg("aikit-session-space");}
        if let Some(home)=&self.home {command.env("AIKIT_HOME",home);}
        command.arg("-C").arg(cwd);
        if matches!(request,EncounterRequest::Start) {command.arg("encounter-start");}
        else {
            let mut body=serde_json::to_value(request).map_err(|error|error.to_string())?;
            if matches!(request,EncounterRequest::Open{..}) {body["cwd"]=serde_json::json!(cwd);}
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
}
