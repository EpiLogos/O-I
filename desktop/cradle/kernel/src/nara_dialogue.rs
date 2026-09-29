//! Durable dialogue relation lives in AIKit's SessionSpace attachment intent.
//! Central retains identity; Expression retains the selected body document.
use crate::{agency, flow::CentralClient};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
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
    Context,
    Readiness,
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
#[derive(Clone, Debug, PartialEq)]
pub struct ProfileBasis {
    pub(crate) profile: Value,
    pub(crate) lineage: Vec<crate::expression_profile::ExpressionProfile>,
}

/// Captured only by the kernel from its native contextual state. No request
/// deserializes this type, and no renderer can supply these readings.
#[derive(Clone, Debug, Default, PartialEq)]
pub(crate) struct ContextState {
    pub expressive_act: Value,
    pub personal_current: Value,
    pub personal_current_reading: Value,
}

pub struct Prepared {
    client: CentralClient,
    agency: agency::Client,
    cwd: std::path::PathBuf,
    project: String,
    request: Request,
    document: Value,
    profile: Option<ProfileBasis>,
    context_state: ContextState,
}
impl Prepared {
    pub fn new(
        client: CentralClient,
        agency: agency::Client,
        cwd: std::path::PathBuf,
        project: String,
        request: Request,
        document: Value,
        profile: Option<ProfileBasis>,
    ) -> Self {
        Self {
            client,
            agency,
            cwd,
            project,
            request,
            document,
            profile,
            context_state: ContextState::default(),
        }
    }
    pub(crate) fn with_context_state(mut self, state: ContextState) -> Self {
        self.context_state = state;
        self
    }
    pub fn execute(self) -> Result<crate::KernelOpOutcome, String> {
        if matches!(self.request.operation, Operation::Context | Operation::Readiness) {
            let mut data = read_context_with_state(&self.client, &self.project, &self.request, &self.document,
                self.profile.as_ref().ok_or("Select an adopted native Expression profile before resolving a coordinate dialogue")?, &self.context_state)?;
            if self.request.operation == Operation::Readiness {
                data["runtime_readiness"] = crate::nara_world_readiness::read(&self.agency, &self.cwd, &self.project,
                    &self.request, &data, &self.document)?;
            }
            return Ok(crate::KernelOpOutcome {
                receipts: Vec::new(),
                result: crate::KernelOpResult::NaraDialogue { data },
            });
        }
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

/// Resolve domain context from the native document and its actual adopted
/// presentation profile. The caller never supplies a registry or a context.
pub(crate) fn read_context(
    client: &CentralClient,
    project: &str,
    request: &Request,
    document: &Value,
    profile_basis: &ProfileBasis,
) -> Result<Value, String> {
    read_context_with_state(
        client,
        project,
        request,
        document,
        profile_basis,
        &ContextState::default(),
    )
}

pub(crate) fn read_context_with_state(
    client: &CentralClient,
    project: &str,
    request: &Request,
    document: &Value,
    profile_basis: &ProfileBasis,
    state: &ContextState,
) -> Result<Value, String> {
    let profile = &profile_basis.profile;
    let (source, identity) = crate::nara_identity::read(client, &request.source_ref)?;
    if source.revision.revision != request.expected_revision
        || identity["person_ref"] != request.person_ref
        || identity["nara_ref"] != request.nara_ref
        || document["expression_ref"] != request.expression_ref
    {
        return Err("Native coordinate context has a changed identity or Expression basis".into());
    }
    let selection = &document["selection"];
    let entity = selection["entity_ref"]
        .as_str()
        .map(|r| &document["entities"][r]);
    let scene = document["scenes"].as_array().and_then(|scenes| {
        scenes
            .iter()
            .find(|scene| scene["scene_ref"] == selection["scene_ref"])
    });
    let subject = entity
        .map(|entity| &entity["subject"])
        .filter(|s| !s.is_null())
        .or_else(|| scene.map(|s| &s["body"]).filter(|s| !s.is_null()));
    let adoption = document["profiles"]
        .as_array()
        .and_then(|rows| {
            rows.iter()
                .find(|row| row["profile_ref"] == profile["profile_ref"])
        })
        .ok_or("The resolved profile is not adopted by this Expression")?;
    let source_basis = &adoption["source_basis"];
    let (coordinate, owner) = if source_basis.is_object() {
        if source_basis["availability"] != "available" {
            return Err("The adopted coordinate source basis is not current and available".into());
        }
        let coordinate = source_basis["ref"]
            .as_str()
            .ok_or("The adopted profile has no source coordinate")?;
        if !coordinate.starts_with("ql:m-coordinate:") {
            return Err("This profile's source basis is not a native QL coordinate".into());
        }
        (coordinate, "ql-mef")
    } else {
        let subject = subject.ok_or("Select a source-bound coordinate or adopt a coordinate profile before asking a coordinate inquiry")?;
        (
            subject["subject_ref"]
                .as_str()
                .ok_or("The selected native subject has no coordinate reference")?,
            subject["native_owner"]
                .as_str()
                .ok_or("The selected coordinate has no native owner")?,
        )
    };
    if !matches!(owner, "ql" | "ql-mef" | "QL-MEF") {
        return Err("The selected coordinate is not owned by the QL resolver".into());
    }
    let profile_ref = profile["profile_ref"]
        .as_str()
        .ok_or("Native Expression profile has no reference")?;
    let revision = profile["revision"]
        .as_u64()
        .ok_or("Native Expression profile has no revision")?;
    let accepted = profile["accepted_native_owners"]
        .as_array()
        .ok_or("Native profile owner admission is unavailable")?;
    if !accepted.is_empty()
        && !accepted
            .iter()
            .any(|value| matches!(value.as_str(), Some("ql" | "ql-mef" | "QL-MEF")))
    {
        return Err(
            "The adopted Expression profile does not admit the selected native owner".into(),
        );
    }
    let canonical = Binding::new(project, request)?;
    let relation = selection["relation_ref"]
        .as_str()
        .map(|r| &document["relations"][r]);
    let pointed = relation
        .map(|r| &r["relation"]["ref"])
        .filter(|r| r.is_string())
        .cloned()
        .unwrap_or_else(|| {
            subject
                .map(|s| s["subject_ref"].clone())
                .unwrap_or(Value::Null)
        });
    let mut context_request = request.clone();
    context_request.operation = Operation::Context;
    let basis = serde_json::to_vec(&(
        &context_request,
        document,
        profile,
        &profile_basis.lineage,
        &state.expressive_act,
        &state.personal_current,
    ))
    .map_err(|e| e.to_string())?;
    let context_ref = format!("oi:nara-context:{:x}", Sha256::digest(basis));
    let actions: std::collections::BTreeSet<String> = document["entities"]
        .as_object()
        .into_iter()
        .flat_map(|entities| entities.values())
        .flat_map(|entity| {
            entity["subject"]["actions"]
                .as_array()
                .into_iter()
                .flatten()
        })
        .filter_map(|action| action["action_ref"].as_str().map(str::to_owned))
        .collect();
    let mut disclosed = vec![
        json!({"ref_id":request.source_ref,"revision":request.expected_revision,"standing":"reported",
        "disclosure":"personal-consent","disclosed_via_ref":context_ref}),
    ];
    if state.personal_current.is_object() {
        disclosed.push(json!({"ref_id":state.personal_current["reading_ref"],"revision":state.personal_current["reading_revision"],
            "standing":"derived","disclosure":"personal-consent","disclosed_via_ref":context_ref}));
    }
    let context = json!({"schema":"ql.nara-dialogue-context/v1","context_ref":context_ref,
        "nara_ref":request.nara_ref,"subject_ref":request.person_ref,"agent_session_ref":canonical.agent_session,
        "m4_branch":null,"coordinate_ref":coordinate,"bimba":null,
        "expression_ref":request.expression_ref,"expression_revision":document["revision"].as_u64().ok_or("Native Expression revision is unavailable")?.to_string(),
        "profile_ref":profile_ref,"profile_revision":revision.to_string(),"scene_ref":selection["scene_ref"],
        "active_m_focus":"m0","pointed_ref":pointed,"hovered_ref":null,"pinned_refs":[],"occasion":null,
        "disclosed":disclosed,"personal_current":state.personal_current,
        "available_action_refs":actions,"c_prime":null,"shared_field":null,"expressive_act":state.expressive_act});
    let resolved = crate::nara_identity::run_ql_nara(
        "context",
        &json!({"schema":"ql.nara-dialogue-context-request/v1",
        "coordinate_ref":coordinate,"context":context}),
    )?;
    if resolved["schema"] != "ql.nara-dialogue-context-result/v1"
        || resolved["context"]["context_ref"] != context_ref
        || resolved["context"]["expression_ref"] != request.expression_ref
        || resolved["context"]["profile_ref"] != profile_ref
    {
        return Err("QL returned a context outside the native Expression basis".into());
    }
    if source_basis.is_object()
        && (source_basis["revision"] != resolved["world"]["registry_revision"]
            || profile["profile_ref"] != resolved["coordinate_binding"]["resolved_profile_ref"]
            || profile["revision"] != resolved["coordinate_binding"]["profile_revision"])
    {
        return Err("The adopted coordinate or profile changed at its source; explicitly review its current revision".into());
    }
    let projection = crate::nara_coordinate::project(resolved["coordinate_binding"].clone())?;
    let expected: Vec<crate::expression_profile::ExpressionProfile> =
        serde_json::from_value(projection["profiles"].clone())
            .map_err(|e| format!("Native coordinate profile projection is invalid: {e}"))?;
    if expected.len() != profile_basis.lineage.len()
        || expected
            .iter()
            .any(|native| !profile_basis.lineage.iter().any(|stored| stored == native))
        || expected
            .last()
            .and_then(|native| serde_json::to_value(native).ok())
            .as_ref()
            != Some(profile)
    {
        return Err("The stored coordinate profile or its inherited content differs from its native source projection".into());
    }
    Ok(
        json!({"schema":"oi.nara-coordinate-context/v1","binding":request,"context":resolved["context"],
        "world":resolved["world"],"coordinate_binding":resolved["coordinate_binding"],"expression_revision":document["revision"],
        "identity_source":{"source_ref":request.source_ref,"revision":request.expected_revision},
        "profile":profile,"personal_current_reading":state.personal_current_reading}),
    )
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
