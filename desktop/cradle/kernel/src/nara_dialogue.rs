//! Durable dialogue relation lives in AIKit's SessionSpace attachment intent.
//! Central retains identity; Expression retains the selected body document.
use crate::{agency, flow::CentralClient};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::Path;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Nara,
    Epii,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Operation {
    Lookup,
    Resolve,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub operation: Operation,
    pub source_ref: String,
    pub expected_revision: String,
    pub person_ref: String,
    pub nara_ref: String,
    pub expression_ref: String,
    pub role: Role,
}

/// Hosts capture the open Expression/project under their mutex, then perform
/// native source reads and provider admission without blocking the UI kernel.
pub struct Prepared {
    client: CentralClient,
    agency: agency::Client,
    cwd: std::path::PathBuf,
    project: String,
    request: Request,
}
impl Prepared {
    pub fn new(
        client: CentralClient,
        agency: agency::Client,
        cwd: std::path::PathBuf,
        project: String,
        request: Request,
    ) -> Self {
        Self {
            client,
            agency,
            cwd,
            project,
            request,
        }
    }
    pub fn execute(self) -> Result<crate::KernelOpOutcome, String> {
        let data = resolve(
            &self.client,
            &self.agency,
            &self.cwd,
            &self.project,
            self.request,
        )?;
        Ok(crate::KernelOpOutcome {
            receipts: Vec::new(),
            result: crate::KernelOpResult::NaraDialogue { data },
        })
    }
}

pub(crate) struct Binding {
    pub space: String,
    pub agent_session: String,
    pub(crate) expected_agent_ref: String,
    role: Role,
    provenance: Vec<String>,
}
impl Binding {
    pub(crate) fn new(project: &str, request: &Request) -> Result<Self, String> {
        let provenance = vec![
            "oi.nara-dialogue-attachment/v2-explicit-agent".into(),
            project.into(),
            request.person_ref.clone(),
            request.nara_ref.clone(),
            request.source_ref.clone(),
            request.expression_ref.clone(),
        ];
        let bytes = serde_json::to_vec(&(&request.role, &provenance)).map_err(|e| e.to_string())?;
        let digest = format!("{:x}", Sha256::digest(bytes));
        Ok(Self {
            space: format!("session-space/nara-{digest}"),
            agent_session: format!("agent-session/nara-{digest}"),
            expected_agent_ref: match request.role {
                Role::Nara => request.nara_ref.clone(),
                Role::Epii => format!(
                    "agent/epii-{:x}",
                    Sha256::digest(request.nara_ref.as_bytes())
                ),
            },
            role: request.role.clone(),
            provenance,
        })
    }
    pub(crate) fn label(&self) -> String {
        format!(
            "{} · {}",
            match self.role {
                Role::Nara => "Nara dialogue",
                Role::Epii => "Epii identity inquiry",
            },
            self.space
        )
    }
    pub(crate) fn attachment(&self) -> Value {
        json!({"agent_session":self.agent_session,"purpose":match self.role {Role::Nara => "Nara personal Expression dialogue",Role::Epii => "Epii inquiry through personal Expression"},"provenance":self.provenance})
    }
    /// A reserved identity can resume an interrupted create/bind/attach, but
    /// cannot absorb another session, project, or purpose under the same ref.
    pub(crate) fn validate_state(&self, state: &Value, project: &str) -> Result<(), String> {
        if state["version"] != "aikit.session-space-application/v1"
            || state["definition"]["id"] != self.space
            || state["label"] != self.label()
        {
            return Err(
                "Stored Nara SessionSpace has a different native identity or purpose".into(),
            );
        }
        let projects = state["definition"]["projects"]
            .as_array()
            .ok_or("Stored SessionSpace has no project membership reading")?;
        if projects.iter().any(|p| p.as_str() != Some(project)) {
            return Err("Stored Nara SessionSpace belongs to another project".into());
        }
        let sessions = state["agent_sessions"]
            .as_object()
            .ok_or("Stored SessionSpace has no attachment reading")?;
        if sessions
            .iter()
            .any(|(key, value)| key != &self.agent_session || *value != self.attachment())
        {
            return Err(
                "Stored Nara AgentSession attachment differs from the saved identity relation"
                    .into(),
            );
        }
        Ok(())
    }
}

pub fn resolve(
    client: &CentralClient,
    agency: &agency::Client,
    cwd: &Path,
    project: &str,
    request: Request,
) -> Result<Value, String> {
    let (source, profile) = crate::nara_identity::read(client, &request.source_ref)?;
    if source.revision.revision != request.expected_revision
        || profile["person_ref"] != request.person_ref
        || profile["nara_ref"] != request.nara_ref
    {
        return Err("Saved identity changed or belongs to another person. Reopen and select its current revision.".into());
    }
    let binding = Binding::new(project, &request)?;
    if request.operation == Operation::Lookup {
        let states = agency.read_project(cwd, project)?;
        let state = states
            .as_array()
            .and_then(|rows| rows.iter().find(|s| s["definition"]["id"] == binding.space));
        let Some(state) = state else {
            return Ok(
                json!({"schema":"oi.nara-dialogue-binding/v1","binding":request,"provisioning":null}),
            );
        };
        binding.validate_state(state, project)?;
        if state["agent_sessions"][&binding.agent_session] != binding.attachment() {
            return Ok(
                json!({"schema":"oi.nara-dialogue-binding/v1","binding":request,"provisioning":null}),
            );
        }
        // The journal owner may be stopped after application restart. Starting
        // that owner does not start a model or reopen a provider session.
        agency.encounter(cwd, project, &agency::EncounterRequest::Start)?;
        // Reading a saved identity never starts a provider. Native journal
        // records reveal the last observed provider for explicit reconnect.
        let recorded = agency.recorded_encounter_binding(cwd, project, &binding.agent_session)?;
        let Some(recorded) = recorded else {
            return Ok(
                json!({"schema":"oi.nara-dialogue-binding/v1","binding":request,"provisioning":null}),
            );
        };
        let view = agency.encounter(
            cwd,
            project,
            &agency::EncounterRequest::View {
                agent_session: binding.agent_session.clone(),
                before: None,
            },
        )?;
        let resume_required = view["connection"]["resident"] == false;
        return Ok(
            json!({"schema":"oi.nara-dialogue-binding/v1","binding":request,"provisioning":{
            "project":project,"space":binding.space,"agent_session":binding.agent_session,
            "provider":recorded["provider"],"resume_required":resume_required,
            "continuation":"recorded-agent-session","open":null}}),
        );
    }
    agency.encounter(cwd, project, &agency::EncounterRequest::Start)?;
    let provisioned = agency.provision_named(
        cwd,
        project,
        Some(agency::EPI_PRIME_QL_BODY_REF),
        Some(&binding),
    )?;
    // The native owner, not successful CLI exit, proves the retained attachment.
    let states = agency.read_project(cwd, project)?;
    let state = states
        .as_array()
        .and_then(|rows| rows.iter().find(|s| s["definition"]["id"] == binding.space))
        .ok_or("AIKit did not retain the Nara SessionSpace")?;
    binding.validate_state(state, project)?;
    if state["agent_sessions"][&binding.agent_session] != binding.attachment() {
        return Err("AIKit did not retain the exact Nara AgentSession attachment".into());
    }
    Ok(json!({"schema":"oi.nara-dialogue-binding/v1","binding":request,"provisioning":provisioned}))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> Request {
        Request {
            operation: Operation::Resolve,
            source_ref: "central:source:control:root:Control/self/nara/identities/controlled.json"
                .into(),
            expected_revision: "revision-one".into(),
            person_ref: "controlled:person:one".into(),
            nara_ref: "controlled:nara:one".into(),
            expression_ref: "expression:controlled-native-document".into(),
            role: Role::Nara,
        }
    }

    #[test]
    fn corrected_source_continues_same_person_but_roles_and_other_people_do_not_merge() {
        let original = request();
        let first = Binding::new("Central", &original).unwrap();
        let mut corrected = original.clone();
        corrected.expected_revision = "revision-two".into();
        corrected.operation = Operation::Lookup;
        let reopened = Binding::new("Central", &corrected).unwrap();
        assert_eq!(first.expected_agent_ref, original.nara_ref);
        assert_eq!(first.expected_agent_ref, reopened.expected_agent_ref);
        assert_eq!(first.space, reopened.space);
        assert_eq!(first.agent_session, reopened.agent_session);
        let mut other = original.clone();
        other.person_ref = "controlled:person:two".into();
        assert_ne!(
            first.agent_session,
            Binding::new("Central", &other).unwrap().agent_session
        );
        other = original.clone();
        other.role = Role::Epii;
        assert_ne!(
            first.expected_agent_ref,
            Binding::new("Central", &other).unwrap().expected_agent_ref
        );
        assert_ne!(
            first.agent_session,
            Binding::new("Central", &other).unwrap().agent_session
        );
        other = original.clone();
        other.expression_ref = "expression:another-native-document".into();
        assert_ne!(
            first.agent_session,
            Binding::new("Central", &other).unwrap().agent_session
        );
        assert_ne!(
            first.space,
            Binding::new("Another Project", &original).unwrap().space
        );
    }

    #[test]
    fn interrupted_reservation_can_resume_but_other_attached_identity_is_refused() {
        let binding = Binding::new("Central", &request()).unwrap();
        let mut state = json!({"version":"aikit.session-space-application/v1","definition":{"id":binding.space,"projects":[]},"label":binding.label(),"agent_sessions":{}});
        binding.validate_state(&state, "Central").unwrap();
        state["definition"]["projects"] = json!(["Central"]);
        state["agent_sessions"][&binding.agent_session] = binding.attachment();
        binding.validate_state(&state, "Central").unwrap();
        state["agent_sessions"][&binding.agent_session]["provenance"] = json!(["another-person"]);
        assert!(binding.validate_state(&state, "Central").is_err());
        state["agent_sessions"][&binding.agent_session] = binding.attachment();
        state["definition"]["projects"] = json!(["Another Project"]);
        assert!(binding.validate_state(&state, "Central").is_err());
    }
}
