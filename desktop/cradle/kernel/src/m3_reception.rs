//! Subject-bound reception of QL's existing transactional M3 producer.
//! Optional activity uses an explicitly selected source policy; no closure or rendering law is inferred.
use crate::{flow::CentralClient, nara_current, nara_dialogue, nara_identity};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub enum ActivityPolicy {
    #[serde(rename = "historical-personal-frame-sprite-v1")]
    HistoricalPersonalFrameSprite,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Selections {
    pub clock_steps: u64,
    pub address: u8,
    pub pose: u8,
    pub aperture: u8,
    pub matrix_axis: u8,
    pub rna: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Operation {
    SelectForm {
        address: u8,
    },
    ChangeLine {
        line: u8,
    },
    ApplyMatrix {
        family: u8,
    },
    SetPose {
        pose: u8,
    },
    SetAperture {
        aperture: u8,
    },
    ReciprocalAperture,
    AdvanceClock {
        steps: u64,
    },
    Transcribe {
        rna: bool,
    },
    CastCreases {
        angles_deg10: [i32; 3],
        velocities_deg10: [i32; 3],
    },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Open {
        binding: nara_dialogue::Request,
        selections: Selections,
        activity_policy: Option<ActivityPolicy>,
    },
    Read {
        binding: nara_dialogue::Request,
    },
    SelectActivityPolicy {
        binding: nara_dialogue::Request,
        expected_generation: u64,
        expected_revision: String,
        activity_policy: ActivityPolicy,
    },
    Apply {
        binding: nara_dialogue::Request,
        expected_generation: u64,
        operations: Vec<Operation>,
    },
}
impl Request {
    pub fn binding(&self) -> &nara_dialogue::Request {
        match self {
            Self::Open { binding, .. }
            | Self::Read { binding }
            | Self::Apply { binding, .. }
            | Self::SelectActivityPolicy { binding, .. } => binding,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Resident {
    binding: nara_dialogue::Request,
    document: Value,
    profile: nara_dialogue::ProfileBasis,
    current_context: Value,
    input: Value,
    reading: Value,
    revision: String,
}
impl Resident {
    pub(crate) fn revision(&self) -> &str {
        &self.revision
    }
    pub(crate) fn expression_ref(&self) -> &str {
        &self.binding.expression_ref
    }
    fn matches(
        &self,
        binding: &nara_dialogue::Request,
        document: &Value,
        profile: &nara_dialogue::ProfileBasis,
        current: &Value,
    ) -> bool {
        let mut stored = self.binding.clone();
        stored.operation = binding.operation.clone();
        stored == *binding
            && document_basis(&self.document) == document_basis(document)
            && self.profile == *profile
            && self.current_context == *current
    }
}
// Selection and its revision are reversible presentation. Every structural field
// remains in the comparison; commit still compares the captured full document.
fn document_basis(document: &Value) -> Value {
    let mut basis = document.clone();
    if let Some(object) = basis.as_object_mut() {
        object.remove("selection");
        object.remove("revision");
    }
    basis
}

pub struct Prepared {
    client: CentralClient,
    project: String,
    request: Request,
    document: Value,
    profile: nara_dialogue::ProfileBasis,
    current: Option<nara_current::Pinned>,
    existing: Option<Resident>,
}
pub struct Completed {
    pub binding: nara_dialogue::Request,
    pub document: Value,
    pub profile: nara_dialogue::ProfileBasis,
    pub current_context: Value,
    pub expected_revision: Option<String>,
    pub candidate: Option<Resident>,
    pub current_candidate: Option<nara_current::Pinned>,
    pub agent_session_ref: String,
    pub data: Value,
}
fn now() -> Result<u64, String> {
    let n = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    u64::try_from(n).map_err(|e| e.to_string())
}
impl Prepared {
    pub fn new(
        client: CentralClient,
        project: String,
        request: Request,
        document: Value,
        profile: nara_dialogue::ProfileBasis,
        current: Option<nara_current::Pinned>,
        existing: Option<Resident>,
    ) -> Self {
        Self {
            client,
            project,
            request,
            document,
            profile,
            current,
            existing,
        }
    }
    pub fn execute(self) -> Result<Completed, String> {
        let binding = self.request.binding().clone();
        if binding.role != nara_dialogue::Role::Nara {
            return Err("M3 personal reception requires the canonical Nara".into());
        }
        let context = nara_dialogue::read_context(
            &self.client,
            &self.project,
            &binding,
            &self.document,
            &self.profile,
        )?;
        let session = nara_dialogue::Binding::new(&self.project, &binding)?.agent_session;
        let pin = self
            .current
            .as_ref()
            .filter(|p| p.current(&binding, &self.profile));
        let current = pin.map(|p| p.context()).unwrap_or(Value::Null);
        let active = self
            .existing
            .as_ref()
            .filter(|r| r.matches(&binding, &self.document, &self.profile, &current));
        let expected_revision = self.existing.as_ref().map(|r| r.revision.clone());
        let mut candidate = None;
        let mut current_candidate = None;
        if !matches!(self.request, Request::Read { .. }) {
            let event = current["event_ref"]
                .as_str()
                .filter(|v| !v.is_empty())
                .ok_or("Pin the actual personal current event before opening M3")?;
            let timestamp = now()?;
            let input = match &self.request {
                Request::Open {
                    selections,
                    activity_policy,
                    ..
                } => {
                    if active.is_some() {
                        return Err("This native M3 event is already open; operate or read its current generation".into());
                    }
                    let mut request =
                        serde_json::to_value(selections).map_err(|e| e.to_string())?;
                    // The M3 contract validates the NATIVE M registry (the same
                    // one the accepted M1-M3 producers retain); the pinned sky's
                    // source binding carries exactly that revision, QL-checked
                    // against its catalogue at pin time. The dialogue world's
                    // registry revision is the coordinate profile registry and
                    // stays only in the coordinate base role below.
                    let registry = pin
                        .and_then(|p| {
                            p.reading()["transit"]["sky"]["source_binding"]["registry_revision"]
                                .as_str()
                                .map(str::to_string)
                        })
                        .filter(|v| !v.is_empty())
                        .ok_or(
                            "The pinned personal current carries no native M registry revision",
                        )?;
                    let coordinate_revision = context["world"]["registry_revision"]
                        .as_str()
                        .ok_or("Native M3 coordinate registry revision unavailable")?;
                    request["schema"] = json!("ql.m3-state-request/v1");
                    request["registry_revision"] = json!(registry);
                    request["stamp"] = json!({"identity":{"event_ref":event,"profile_generation":0},"source_ref":current["reading_ref"],"contract_ref":"ql.nara-personal-current/v1"});
                    request["subject_ref"] = json!(binding.person_ref);
                    request["occurrence_unix_ms"] = json!(timestamp);
                    request["receipt_unix_ms"] = json!(timestamp);
                    request["bases"] = json!([
                        {"role":"identity-source","reference":binding.source_ref,"revision":binding.expected_revision},
                        {"role":"personal-current","reference":current["reading_ref"],"revision":current["reading_revision"]},
                        {"role":"coordinate","reference":context["context"]["coordinate_ref"],"revision":coordinate_revision},
                        {"role":"expression-profile","reference":context["context"]["profile_ref"],"revision":context["context"]["profile_revision"]}]);
                    request["m2_basis"] = Value::Null;
                    json!({"request":request,"commands":[],"activity_policy":activity_policy})
                }
                Request::Apply {
                    expected_generation,
                    operations,
                    ..
                } => {
                    let resident=active.ok_or("No current M3 state exists for this identity, Expression, profile and event")?;
                    if resident.reading["state"]["identity"]["profile_generation"].as_u64()
                        != Some(*expected_generation)
                    {
                        return Err("Stale native M3 generation".into());
                    }
                    if operations.is_empty() || operations.len() > 64 {
                        return Err("M3 batch must contain 1..64 operations".into());
                    }
                    let mut input = resident.input.clone();
                    let commands = input["commands"]
                        .as_array_mut()
                        .ok_or("Invalid resident M3 command history")?;
                    if commands.len() >= 256 {
                        return Err("Native M3 event reached its 256 command bound".into());
                    }
                    commands.push(json!({"schema":"ql.m3-command/v1","event_ref":event,"subject_ref":binding.person_ref,
                        "expected_generation":expected_generation,"actor_ref":session,"cause_ref":context["context"]["context_ref"],
                        "occurrence_unix_ms":timestamp,"receipt_unix_ms":timestamp,"operations":operations}));
                    input
                }
                Request::SelectActivityPolicy {
                    expected_generation,
                    expected_revision,
                    activity_policy,
                    ..
                } => {
                    let resident = active.ok_or("No current M3 event is open")?;
                    if resident.reading["state"]["identity"]["profile_generation"]
                        != *expected_generation
                        || resident.revision != *expected_revision
                    {
                        return Err("Stale native M3 policy selection basis".into());
                    }
                    if !resident.input["activity_policy"].is_null() {
                        return Err("This M3 activity policy is already selected; its history cannot be reset by selecting again".into());
                    }
                    let mut input = resident.input.clone();
                    input["activity_policy"] = json!(activity_policy);
                    input["activity_start_generation"] = json!(expected_generation);
                    input
                }
                Request::Read { .. } => unreachable!(),
            };
            let reading = nara_identity::run_ql_m3(&input)?;
            if reading["state"]["schema"] != "ql.m3-state/v1"
                || reading["state"]["subject_ref"] != binding.person_ref
                || reading["state"]["identity"]["event_ref"] != event
            {
                return Err("QL M3 returned another subject or event".into());
            }
            if reading["activity"]["status"] == "available" {
                let prior = pin.ok_or("Protected personal current disappeared")?;
                let recomposed = nara_identity::run_ql_nara(
                    "personal-recompose",
                    &json!({
                    "schema":"ql.nara-personal-recompose-request/v1","current":prior.reading(),"m3_input":input}),
                )?;
                current_candidate = Some(prior.with_native_activity(recomposed)?);
            }
            let revision = format!(
                "sha256:{:x}",
                Sha256::digest(serde_json::to_vec(&input).map_err(|e| e.to_string())?)
            );
            candidate = Some(Resident {
                binding: binding.clone(),
                document: self.document.clone(),
                profile: self.profile.clone(),
                current_context: current_candidate
                    .as_ref()
                    .map(|p| p.context())
                    .unwrap_or_else(|| current.clone()),
                input,
                reading,
                revision,
            });
        }
        let visible = candidate.as_ref().or(active);
        let data = json!({"schema":"oi.m3-reception-context/v1","status":if visible.is_some(){"available"}else{"absent"},
            "nara_ref":binding.nara_ref,"person_ref":binding.person_ref,"expression_ref":binding.expression_ref,
            "expression_revision":self.document["revision"],"identity_source_ref":binding.source_ref,"identity_revision":binding.expected_revision,
            "profile_ref":context["context"]["profile_ref"],"profile_revision":context["context"]["profile_revision"],
            "coordinate_ref":context["context"]["coordinate_ref"],"event_ref":current["event_ref"],
            "revision":visible.map(|r|&r.revision),"state":visible.map(|r|&r.reading["state"]),"receipts":visible.map(|r|&r.reading["receipts"]),
            "activity_policy":visible.map(|r|&r.input["activity_policy"]),"activity":visible.map(|r|&r.reading["activity"]),
            "personal_current":current_candidate.as_ref().or(pin).map(|p|json!({"context":p.context(),"reading":p.reading()})),
            "private":true,"public_export":false,"activity_admitted":visible.is_some_and(|r|r.reading["activity"]["status"]=="available")});
        Ok(Completed {
            binding,
            document: self.document,
            profile: self.profile,
            current_context: current,
            expected_revision,
            candidate,
            current_candidate,
            agent_session_ref: session,
            data,
        })
    }
}
