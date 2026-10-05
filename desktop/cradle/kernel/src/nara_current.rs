//! One protected current reading in the existing native Nara/Expression context.
//! The caller requests an epoch; QL produces the reading. The kernel commits it
//! only after comparing the captured source, document and adopted profile.
use crate::{flow::CentralClient, nara_dialogue, nara_identity};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
#[path = "nara_current_store.rs"]
mod retention;

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
    Restore {
        binding: nara_dialogue::Request,
    },
}
impl Request {
    pub fn binding(&self) -> &nara_dialogue::Request {
        match self {
            Self::Pin { binding, .. } | Self::Read { binding } | Self::Restore { binding } => {
                binding
            }
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
    pub project: String,
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
    owner: retention::Owner,
    activity_input: Option<Value>,
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
    pub(crate) fn retain(&self, project: &str) -> Result<(), String> {
        retention::Store::default().retain(project, self)
    }
    pub(crate) fn with_native_activity(
        &self,
        reading: Value,
        input: Value,
    ) -> Result<Self, String> {
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
        pin.activity_input = Some(input);
        pin.context["reading_ref"] = json!(format!("personal:nara-current:{digest}"));
        pin.context["reading_revision"] = json!(format!("sha256:{digest}"));
        Ok(pin)
    }
    pub(crate) fn run_native_m3(&self, input: &Value) -> Result<Value, String> {
        self.owner
            .execute(|path| nara_identity::run_ql_selected(path, "kernel", "m3", input))
    }
    pub(crate) fn recompose_native_activity(&self, input: &Value) -> Result<Value, String> {
        self.owner.execute(|path| {
            nara_identity::run_ql_selected(path, "nara", "personal-recompose", input)
        })
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
// This comparison admits the same saved numerical sky across native and JSON
// carriers. Only exact decimal values AND finite IEEE bits may agree despite
// alternate number spelling. Object keys, text, array order, signed zero and
// every numerical value remain determining. This does not rewrite stored sky
// tokens, change global Value equality, or relax protected checkpoint custody.
fn saved_sky_number_basis(number: &serde_json::Number) -> Option<(bool, String, i64, u64)> {
    let finite = number.as_f64()?;
    if !finite.is_finite() {
        return None;
    }
    let token = number.to_string();
    let negative = token.starts_with('-');
    let unsigned = token.strip_prefix('-').unwrap_or(&token);
    let (mantissa, exponent) = match unsigned.split_once(['e', 'E']) {
        Some((mantissa, exponent)) => (mantissa, exponent.parse::<i64>().ok()?),
        None => (unsigned, 0),
    };
    let (integer, fraction) = mantissa.split_once('.').unwrap_or((mantissa, ""));
    let digits = format!("{integer}{fraction}");
    if digits.is_empty() || !digits.bytes().all(|digit| digit.is_ascii_digit()) {
        return None;
    }
    let digits = digits.trim_start_matches('0');
    if digits.is_empty() {
        return Some((negative, "0".into(), 0, finite.to_bits()));
    }
    let significant = digits.trim_end_matches('0');
    let removed = i64::try_from(digits.len() - significant.len()).ok()?;
    let fraction_len = i64::try_from(fraction.len()).ok()?;
    let scale = exponent.checked_sub(fraction_len)?.checked_add(removed)?;
    Some((negative, significant.into(), scale, finite.to_bits()))
}
pub(crate) fn same_saved_sky(actual: &Value, expected: &Value) -> bool {
    match (actual, expected) {
        (Value::Number(actual), Value::Number(expected)) => {
            match (
                saved_sky_number_basis(actual),
                saved_sky_number_basis(expected),
            ) {
                (Some(actual), Some(expected)) => actual == expected,
                _ => false,
            }
        }
        (Value::Array(actual), Value::Array(expected)) => {
            actual.len() == expected.len()
                && actual
                    .iter()
                    .zip(expected)
                    .all(|(actual, expected)| same_saved_sky(actual, expected))
        }
        (Value::Object(actual), Value::Object(expected)) => {
            actual.len() == expected.len()
                && actual.iter().all(|(key, actual)| {
                    expected
                        .get(key)
                        .is_some_and(|expected| same_saved_sky(actual, expected))
                })
        }
        _ => actual == expected,
    }
}

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
        || !same_saved_sky(&record["world"]["sky"], snapshot)
    {
        return Err(
            "The retained occasion does not match this saved person, identity and native world"
                .into(),
        );
    }
    Ok(())
}

fn saved_record(document: &Value) -> Result<&Value, String> {
    let scenes = document["scenes"]
        .as_array()
        .ok_or("The saved native world has no Scenes")?;
    let mut records = scenes
        .iter()
        .filter_map(|scene| scene.pointer("/presentation/scene/epiWorld"))
        .filter(|r| r["schema"] == "oi.epi-world-material/v1");
    let record = records
        .next()
        .ok_or("No saved Epi world owns this personal current")?;
    if records.next().is_some() {
        return Err("Personal restoration requires one exact stored world".into());
    }
    Ok(record)
}
fn validate_saved_current_participants(
    document: &Value,
    binding: &nara_dialogue::Request,
    context: &Value,
) -> Result<(), String> {
    use std::collections::BTreeSet;
    let record = saved_record(document)?;
    let personal = &record["receiving"]["personal"];
    let expected = serde_json::json!({"ref":context["reading_ref"],"revision":context["reading_revision"],"availability":"available"});
    if personal["current"] != expected
        || personal["person"]["ref"] != binding.person_ref
        || personal["identity"]["ref"] != binding.source_ref
        || personal["identity"]["revision"] != binding.expected_revision
        || record["identity_source"]["revision"] != binding.expected_revision
        || personal["instance_ref"] != binding.expression_ref
    {
        return Err("Saved personal current restoration differs from its person, identity or exact reference".into());
    }
    let refs = personal["participant_entity_refs"]
        .as_array()
        .ok_or("The saved current has no participant bindings")?;
    let allowed: BTreeSet<String> = [
        "ql:m-coordinate:bimba:M4.4.4.4".to_owned(),
        "ql:m-coordinate:bimba:M2-5-0/1-0".to_owned(),
    ]
    .into_iter()
    .chain((1..=7).map(|i| format!("ql:m-coordinate:bimba:M2-5-0/1-{i}")))
    .chain((0..=5).map(|i| format!("ql:m-coordinate:bimba:M4.{i}")))
    .collect();
    if refs.len() != allowed.len() {
        return Err("The saved current lost a personal participant".into());
    }
    let mut seen = BTreeSet::new();
    let mut subjects = BTreeSet::new();
    for value in refs {
        let reference = value
            .as_str()
            .ok_or("The saved current participant has no native reference")?;
        let subject = &document["entities"][reference]["subject"];
        let canonical = subject["subject_ref"]
            .as_str()
            .ok_or("The saved current participant has no subject")?;
        if !seen.insert(reference)
            || !subjects.insert(canonical.to_owned())
            || !allowed.contains(canonical)
            || subject["native_owner"] != "ql-mef"
            || !subject["sources"].as_array().is_some_and(|s| {
                s.iter().any(|r| r == &personal["person"])
                    && s.iter().any(|r| r == &personal["identity"])
            })
            || !subject["readings"].as_array().is_some_and(|r| {
                r.iter()
                    .filter(|r| r["ref"] == context["reading_ref"])
                    .count()
                    == 1
                    && r.iter().any(|r| r == &expected)
            })
        {
            return Err(
                "A saved personal participant differs from the admitted current source".into(),
            );
        }
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
            Request::Restore { .. } => {
                let pin = retention::Store::default().restore(
                    &self.project,
                    &binding,
                    &self.profile,
                    &self.document,
                )?;
                let (source, identity) = nara_identity::read(&self.client, &binding.source_ref)?;
                if source.revision.revision != binding.expected_revision
                    || !nara_identity::same_input(&pin.reading["identity"]["profile"], &identity)
                {
                    return Err(
                        "The saved identity changed before its protected current was restored"
                            .into(),
                    );
                }
                Some(pin)
            }
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
                let owner = retention::Owner::capture()?;
                let value = owner.execute(|path| {
                    nara_identity::apply_selected_personal_current(
                        &self.client,
                        nara_identity::Request::PersonalCurrent {
                            source_ref: binding.source_ref.clone(),
                            expected_revision: binding.expected_revision.clone(),
                            sky_request,
                            sky_snapshot,
                            snapshot_purpose,
                        },
                        path,
                    )
                })?;
                if !owner.same_source(&retention::Owner::capture()?) {
                    return Err(
                        "The selected QL owner changed during personal current acquisition".into(),
                    );
                }
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
                    owner,
                    activity_input: None,
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
            project: self.project,
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
    // Conformance uses the four original actual9563 saved-sky operand pairs;
    // it is no native admission or fabricated numerical acceptance.
    #[test]
    fn saved_sky_comparison_retains_decimal_bits_and_complete_structure() {
        let number = |token: &str| serde_json::from_str::<Value>(token).unwrap();
        for (document, checkpoint) in [
            ("-1.9260705030710736e-06", "-1.9260705030710736e-6"),
            ("-3.285944299349127e-06", "-3.285944299349127e-6"),
            ("2.7483592226209487e-05", "0.000027483592226209487"),
            ("-3.647126460111755e-05", "-0.00003647126460111755"),
        ] {
            assert!(same_saved_sky(&number(document), &number(checkpoint)));
        }
        let original = number("-1.9260705030710736e-6");
        let changed = number("-1.92607050307107361e-6");
        assert_eq!(
            original.as_f64().unwrap().to_bits(),
            changed.as_f64().unwrap().to_bits()
        );
        assert!(
            !same_saved_sky(&original, &changed),
            "Equal IEEE bits cannot erase a changed exact decimal"
        );
        assert!(!same_saved_sky(&original, &number("-1.926070503071073e-6")));
        assert!(!same_saved_sky(&number("-0.0"), &number("0.0")));
        assert!(!same_saved_sky(
            &number("9007199254740992"),
            &number("9007199254740993")
        ));
        assert!(!same_saved_sky(&number("1e-400"), &number("1e-401")));
        assert!(!same_saved_sky(&json!([1, 2]), &json!([2, 1])));
        assert!(!same_saved_sky(
            &json!({"body":"Moon"}),
            &json!({"body":"Sun"})
        ));
        assert!(!same_saved_sky(
            &json!({"body":"Moon","revision":"r1"}),
            &json!({"body":"Moon"})
        ));
        assert!(!same_saved_sky(&json!({"angle":1}), &json!({"angle":"1"})));
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
