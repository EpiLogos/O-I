//! One protected current reading in the existing native Nara/Expression context.
//! The caller requests an epoch; QL produces the reading. The kernel commits it
//! only after comparing the captured source, document and adopted profile.
use crate::{flow::CentralClient, nara_dialogue, nara_identity};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Pin {
        binding: nara_dialogue::Request,
        sky_request: Value,
    },
    Read {
        binding: nara_dialogue::Request,
    },
}
impl Request {
    pub fn binding(&self) -> &nara_dialogue::Request {
        match self {
            Self::Pin { binding, .. } | Self::Read { binding } => binding,
        }
    }
}

pub struct Prepared {
    client: CentralClient,
    project: String,
    request: Request,
    pub document: Value,
    pub profile: nara_dialogue::ProfileBasis,
    existing: Option<Pinned>,
}
pub struct Completed {
    pub binding: nara_dialogue::Request,
    pub document: Value,
    pub profile: nara_dialogue::ProfileBasis,
    pub agent_session_ref: String,
    pub candidate: Option<Pinned>,
    pub expected_current: Option<Value>,
    pub data: Value,
}

#[derive(Clone, Debug)]
pub struct Pinned {
    binding: nara_dialogue::Request,
    profile: nara_dialogue::ProfileBasis,
    context: Value,
    reading: Value,
}

impl Pinned {
    pub(crate) fn current(
        &self,
        binding: &nara_dialogue::Request,
        profile: &nara_dialogue::ProfileBasis,
    ) -> bool {
        let mut expected = self.binding.clone();
        expected.operation = binding.operation.clone();
        expected.role = binding.role.clone();
        expected == *binding && &self.profile == profile
    }
    pub(crate) fn context(&self) -> Value {
        self.context.clone()
    }
    pub(crate) fn reading(&self) -> Value {
        self.reading.clone()
    }
    pub(crate) fn with_native_activity(&self, reading: Value) -> Result<Self, String> {
        if reading["schema"] != "ql.nara-personal-current/v1"
            || reading["identity"] != self.reading["identity"]
            || reading["transit"] != self.reading["transit"]
            || reading["snapshot_ref"] != self.reading["snapshot_ref"]
            || reading["q_identity"] != self.reading["q_identity"]
        {
            return Err(
                "Activity recomposition changed the original identity or dated transit source"
                    .into(),
            );
        }
        let digest = format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&reading).map_err(|e| e.to_string())?)
        );
        let mut pin = self.clone();
        pin.reading = reading;
        pin.context["reading_ref"] = json!(format!("personal:nara-current:{digest}"));
        pin.context["reading_revision"] = json!(format!("sha256:{digest}"));
        Ok(pin)
    }
    pub(crate) fn expression_ref(&self) -> &str {
        &self.binding.expression_ref
    }
}

/// The explicitly invited inquiry receives the current event facts without
/// repeating the full private identity matrices and natal chart payload.
pub(crate) fn disclosed_reading(reading: &Value) -> Value {
    if reading.is_null() {
        return Value::Null;
    }
    json!({"schema":reading["schema"],"snapshot_ref":reading["snapshot_ref"],
        "input_revision":reading["input_revision"],"transit":reading["transit"],
        "q_identity":reading["q_identity"],"q_identity_transit":reading["q_identity_transit"],
        "q_activity":reading["q_activity"],"q_composed":reading["q_composed"],
        "activity_status":reading["activity_status"],"activity":reading["activity"],"resonance":reading["resonance"],
        "standing":reading["standing"],"private":true,"public_export":false})
}

impl Prepared {
    pub fn new(
        client: CentralClient,
        project: String,
        request: Request,
        document: Value,
        profile: nara_dialogue::ProfileBasis,
        existing: Option<Pinned>,
    ) -> Self {
        Self {
            client,
            project,
            request,
            document,
            profile,
            existing,
        }
    }
    pub fn execute(self) -> Result<Completed, String> {
        let binding = self.request.binding().clone();
        if binding.role != nara_dialogue::Role::Nara {
            return Err("Personal current belongs to the canonical Nara context".into());
        }
        // This performs actual saved identity and canonical profile validation;
        // a supplied context or quaternion is never an input to this operation.
        nara_dialogue::read_context(
            &self.client,
            &self.project,
            &binding,
            &self.document,
            &self.profile,
        )?;
        let session = nara_dialogue::Binding::new(&self.project, &binding)?.agent_session;
        let candidate = match self.request {
            Request::Read { .. } => None,
            Request::Pin { sky_request, .. } => {
                let value = nara_identity::apply(
                    &self.client,
                    nara_identity::Request::PersonalCurrent {
                        source_ref: binding.source_ref.clone(),
                        expected_revision: binding.expected_revision.clone(),
                        sky_request,
                    },
                )?;
                let reading = &value["personal_current"];
                let event = reading["snapshot_ref"]
                    .as_str()
                    .filter(|v| !v.is_empty())
                    .ok_or(
                        "An actual dated sky snapshot is required to pin the personal current",
                    )?;
                if reading["private"] != true
                    || reading["public_export"] != false
                    || reading["nara_ref"] != binding.nara_ref
                    || reading["person_ref"] != binding.person_ref
                {
                    return Err(
                        "The native personal current returned another protected identity basis"
                            .into(),
                    );
                }
                let digest = format!(
                    "{:x}",
                    Sha256::digest(serde_json::to_vec(reading).map_err(|e| e.to_string())?)
                );
                Some(Pinned {
                    binding: binding.clone(),
                    profile: self.profile.clone(),
                    reading: reading.clone(),
                    context: json!({"reading_ref":format!("personal:nara-current:{digest}"),
                        "reading_revision":format!("sha256:{digest}"),"event_ref":event,
                        "identity_source_ref":binding.source_ref,"identity_revision":binding.expected_revision}),
                })
            }
        };
        let active = candidate
            .as_ref()
            .or(self.existing.as_ref())
            .filter(|pin| pin.current(&binding, &self.profile));
        let data = json!({"schema":"oi.nara-personal-current-context/v1","nara_ref":binding.nara_ref,
            "expression_ref":binding.expression_ref,"expression_revision":self.document["revision"],
            "status":if active.is_some(){"available"}else{"absent"},
            "context":active.map(Pinned::context),"reading":active.map(Pinned::reading),
            "private":true,"public_export":false});
        Ok(Completed {
            binding,
            document: self.document,
            profile: self.profile,
            agent_session_ref: session,
            expected_current: self.existing.as_ref().map(Pinned::context),
            candidate,
            data,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_current_request_refuses_a_supplied_reading_or_quaternion() {
        let binding = json!({"operation":"context","source_ref":"central:source:controlled",
            "expected_revision":"r1","person_ref":"controlled:one","nara_ref":"controlled:nara:one",
            "expression_ref":"expression:one","role":"nara"});
        let read = json!({"operation":"read","binding":binding});
        assert!(serde_json::from_value::<Request>(read.clone()).is_ok());
        for extra in ["reading", "snapshot", "q_identity_transit"] {
            let mut supplied = read.clone();
            supplied[extra] = json!({"w":1,"x":0,"y":0,"z":0});
            assert!(serde_json::from_value::<Request>(supplied).is_err());
        }
        let mut supplied = read;
        supplied["binding"]["personal_current"] = json!({"reading_ref":"forged"});
        assert!(serde_json::from_value::<Request>(supplied).is_err());
    }
}
