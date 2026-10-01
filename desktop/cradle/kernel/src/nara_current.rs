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
        #[serde(default, skip_serializing_if = "Option::is_none")]
        sky_request: Option<Value>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        sky_snapshot: Option<Value>,
        #[serde(default)]
        snapshot_purpose: nara_identity::SnapshotPurpose,
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
        "standing":reading["standing"],"sky_admission":reading["sky_admission"],"private":true,"public_export":false})
}

/// Retained personal reception belongs to the actually open stored world,
/// rather than an arbitrary same-labelled snapshot supplied by the browser.
fn validate_saved_occasion(
    document: &Value,
    binding: &nara_dialogue::Request,
    snapshot: &Value,
) -> Result<(), String> {
    let records = document["scenes"]
        .as_array()
        .ok_or("The saved native world has no Scenes")?;
    let matching = records
        .iter()
        .filter_map(|scene| scene.pointer("/presentation/scene/epiWorld"))
        .filter(|record| record["schema"] == "oi.epi-world-material/v1")
        .collect::<Vec<_>>();
    if matching.len() != 1 {
        return Err(
            "Retained personal reception requires one exact stored Epi world occasion".into(),
        );
    }
    let record = matching[0];
    let locus = record["receiving"]["personal"]["locus_entity_ref"]
        .as_str()
        .ok_or("The stored Personal Pratibimba has no native body")?;
    let participates = |entity: &Value| {
        entity["subject"]["sources"]
            .as_array()
            .is_some_and(|sources| {
                sources
                    .iter()
                    .any(|source| source["ref"] == binding.person_ref)
                    && sources
                        .iter()
                        .any(|source| source["ref"] == binding.source_ref)
            })
    };
    let centres = record["receiving"]["personal"]["centre_entity_refs"]
        .as_array()
        .ok_or("The stored personal body has no seven-centre relations")?;
    if document["entities"][locus]["subject"]["subject_ref"] != "ql:m-coordinate:bimba:M4.4.4.4"
        || !participates(&document["entities"][locus])
        || centres.len() != 7
        || centres.iter().enumerate().any(|(index, reference)| {
            let Some(reference) = reference.as_str() else {
                return true;
            };
            let entity = &document["entities"][reference];
            entity["subject"]["subject_ref"]
                != format!("ql:m-coordinate:bimba:M2-5-0/1-{}", index + 1)
                || !participates(entity)
        })
    {
        return Err("The retained personal locus or canonical seven-centre participants lost their actual subjects".into());
    }
    // read_context above independently fences the CURRENT identity revision;
    // this stored world may still carry its earlier revision during an
    // explicitly requested same-person identity correction.
    if document["expression_ref"] != binding.expression_ref
        || record["world"]["instance_ref"] != binding.expression_ref
        || record["receiving"]["expression_ref"] != binding.expression_ref
        || record["person_ref"] != binding.person_ref
        || record["nara_ref"] != binding.nara_ref
        || record["world"]["subject_ref"] != binding.person_ref
        || record["identity_source"]["source_ref"] != binding.source_ref
        || record["receiving"]["personal"]["canonical_locus"] != "ql:m-coordinate:bimba:M4.4.4.4"
        || record["world"]["event_ref"] != snapshot["snapshot_ref"]
        || record["world"]["snapshot_ref"] != snapshot["snapshot_ref"]
        || record["world"]["sky"] != *snapshot
    {
        return Err(
            "The retained occasion does not match this saved person, identity and native world"
                .into(),
        );
    }
    Ok(())
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
            Request::Pin {
                sky_request,
                sky_snapshot,
                snapshot_purpose,
                ..
            } => {
                if snapshot_purpose == nara_identity::SnapshotPurpose::RetainedOccasion {
                    validate_saved_occasion(
                        &self.document,
                        &binding,
                        sky_snapshot.as_ref().ok_or(
                            "A retained occasion requires an existing native sky snapshot",
                        )?,
                    )?;
                }
                let value = nara_identity::apply(
                    &self.client,
                    nara_identity::Request::PersonalCurrent {
                        source_ref: binding.source_ref.clone(),
                        expected_revision: binding.expected_revision.clone(),
                        sky_request,
                        sky_snapshot,
                        snapshot_purpose,
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
    #[ignore = "supply OI_RETAINED_WORLD_NATIVE_DOCUMENT with an actual retained native owner document"]
    fn actual_retained_world_refuses_lost_or_foreign_subjects() {
        let path = std::env::var("OI_RETAINED_WORLD_NATIVE_DOCUMENT")
            .expect("actual native document path");
        let original: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
        let record = original["scenes"]
            .as_array()
            .unwrap()
            .iter()
            .find_map(|s| s.pointer("/presentation/scene/epiWorld"))
            .unwrap();
        let binding: nara_dialogue::Request = serde_json::from_value(json!({
            "operation":"context","role":"nara","expression_ref":original["expression_ref"],
            "source_ref":record["identity_source"]["source_ref"],"expected_revision":record["identity_source"]["revision"],
            "person_ref":record["person_ref"],"nara_ref":record["nara_ref"]
        })).unwrap();
        let snapshot = record["world"]["sky"].clone();
        validate_saved_occasion(&original, &binding, &snapshot).unwrap();
        let locus = record["receiving"]["personal"]["locus_entity_ref"]
            .as_str()
            .unwrap();
        let centre = record["receiving"]["personal"]["centre_entity_refs"][0]
            .as_str()
            .unwrap();
        let mut wrong = original.clone();
        wrong["entities"][locus]["subject"]["subject_ref"] =
            json!("ql:m-coordinate:bimba:M4.4.4.3");
        assert!(validate_saved_occasion(&wrong, &binding, &snapshot)
            .unwrap_err()
            .contains("actual subjects"));
        let mut wrong = original.clone();
        wrong["entities"].as_object_mut().unwrap().remove(centre);
        assert!(validate_saved_occasion(&wrong, &binding, &snapshot)
            .unwrap_err()
            .contains("actual subjects"));
        let mut wrong = original.clone();
        wrong["entities"][centre]["subject"]["sources"]
            .as_array_mut()
            .unwrap()
            .retain(|source| source["ref"] != binding.person_ref);
        assert!(validate_saved_occasion(&wrong, &binding, &snapshot)
            .unwrap_err()
            .contains("actual subjects"));
        let mut foreign = binding.clone();
        foreign.person_ref = "person:controlled-world-b".into();
        assert!(validate_saved_occasion(&original, &foreign, &snapshot).is_err());
        let mut altered = snapshot.clone();
        altered["bodies"][0]["longitude_degrees"] = json!(0);
        assert!(validate_saved_occasion(&original, &binding, &altered)
            .unwrap_err()
            .contains("does not match"));
        let mut foreign = binding.clone();
        foreign.expression_ref = "expression:foreign-retained-world".into();
        assert!(validate_saved_occasion(&original, &foreign, &snapshot).is_err());
        assert_eq!(
            original["entities"][locus]["subject"]["subject_ref"],
            "ql:m-coordinate:bimba:M4.4.4.4"
        );
    }
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
