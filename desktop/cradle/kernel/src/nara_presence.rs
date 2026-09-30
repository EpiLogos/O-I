//! Private native Nara/Expression basis -> consented, coordinate-only presence.
//! SharedField remains the publication and consent lifecycle owner. This module
//! retains no profile, projection, consent registry or alternate Expression.
use crate::{agency, flow::CentralClient, nara_dialogue, nara_identity};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::BTreeSet,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Operation {
    Prepare,
    Publish,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Publication {
    pub field_ref: String,
    pub world_ref: String,
    pub projection_ref: String,
    pub presentation_ref: String,
    pub projection_revision: u64,
    pub publisher_identity_ref: String,
    pub publisher_participant_ref: String,
    pub target_ref: String,
    pub target_identity_ref: String,
    pub consent_ref: String,
    pub granted_at: String,
    pub granted_at_unix_ms: u64,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub operation: Operation,
    pub binding: nara_dialogue::Request,
    pub expected_expression_revision: u64,
    pub publication: Publication,
}
pub struct Prepared {
    client: CentralClient,
    agency: agency::Client,
    cwd: PathBuf,
    project: String,
    request: Request,
    document: Value,
    profile: nara_dialogue::ProfileBasis,
}
pub struct Completed {
    pub request: Request,
    pub document: Value,
    pub profile: nara_dialogue::ProfileBasis,
    pub safe_document: Value,
    pub consent_reading: Value,
}
fn text(value: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
        Err("Presence requires bounded, nonempty references".into())
    } else {
        Ok(())
    }
}
impl Prepared {
    pub fn new(
        client: CentralClient,
        agency: agency::Client,
        cwd: PathBuf,
        project: String,
        request: Request,
        document: Value,
        profile: nara_dialogue::ProfileBasis,
    ) -> Self {
        Self {
            client,
            agency,
            cwd,
            project,
            request,
            document,
            profile,
        }
    }
    pub fn execute(self) -> Result<Completed, String> {
        let r = &self.request;
        let p = &r.publication;
        if r.binding.role != nara_dialogue::Role::Nara
            || self.document["revision"].as_u64() != Some(r.expected_expression_revision)
        {
            return Err("Presence requires the current native Nara and Expression revision".into());
        }
        for value in [
            &p.field_ref,
            &p.world_ref,
            &p.projection_ref,
            &p.presentation_ref,
            &p.publisher_identity_ref,
            &p.publisher_participant_ref,
            &p.target_ref,
            &p.target_identity_ref,
            &p.consent_ref,
            &p.granted_at,
        ] {
            text(value)?
        }
        if p.projection_revision == 0
            || !p.publisher_participant_ref.starts_with("participant:")
            || !p.target_ref.starts_with("participant:")
            || p.publisher_participant_ref == p.target_ref
        {
            return Err("Presence requires distinct, explicitly named participants".into());
        }
        nara_dialogue::read_context(
            &self.client,
            &self.project,
            &r.binding,
            &self.document,
            &self.profile,
        )?;
        let mut lookup = r.binding.clone();
        lookup.operation = nara_dialogue::Operation::Lookup;
        let bound =
            nara_dialogue::resolve(&self.client, &self.agency, &self.cwd, &self.project, lookup)?;
        if bound["provisioning"].is_null() {
            return Err("Resolve this native Nara before sharing its presence".into());
        }
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis() as u64;
        let consent_reading = nara_identity::run_ql_nara(
            "presence-consent",
            &json!({
            "schema":"ql.nara-presence-consent-request/v1",
            "consent":{"consent_ref":{"ref_id":p.consent_ref,"revision":p.granted_at,"owner_ref":p.publisher_participant_ref},
                "participant_subjects":[p.publisher_participant_ref,p.target_ref],
                "allowed_expression_refs":[r.binding.expression_ref],"allowed_target_refs":[p.target_ref],
                "granted_at_unix_ms":p.granted_at_unix_ms,"expires_at_unix_ms":null},
            "subject_ref":p.publisher_participant_ref,"expression_ref":r.binding.expression_ref,
            "target_ref":p.target_ref,"at_unix_ms":now}),
        )?;
        if consent_reading["permitted"] != true {
            return Err("Native shared-presence consent does not permit this publication".into());
        }
        let safe_document = safe_document(&self.document)?;
        Ok(Completed {
            request: self.request,
            document: self.document,
            profile: self.profile,
            safe_document,
            consent_reading,
        })
    }
}

/// The existing SF5 neutral cue layout is presentation only. Its numeric
/// positions do not encode natal values, personal receiver state or dynamics.
fn safe_document(document: &Value) -> Result<Value, String> {
    let scene_ref = document["selection"]["scene_ref"]
        .as_str()
        .ok_or("Select the canonical body scene")?;
    let scene = document["scenes"]
        .as_array()
        .and_then(|rows| rows.iter().find(|s| s["scene_ref"] == scene_ref))
        .ok_or("Selected scene is absent")?;
    let refs = scene["entity_refs"]
        .as_array()
        .ok_or("Body scene has no entities")?;
    if refs.len() != 8 {
        return Err(
            "Presence requires the seven canonical centres and distinct Earth anchor".into(),
        );
    }
    let mut seen = BTreeSet::new();
    let mut entities = serde_json::Map::new();
    for reference in refs {
        let key = reference.as_str().ok_or("Invalid body entity reference")?;
        let entity = &document["entities"][key];
        let subject = entity["subject"]["subject_ref"]
            .as_str()
            .ok_or("A body entity has no native subject")?;
        let index = subject
            .strip_prefix("ql:m-coordinate:bimba:M2-5-0/1-")
            .and_then(|s| s.parse::<u8>().ok())
            .filter(|i| *i <= 7)
            .ok_or("A body entity is not a canonical centre or Earth anchor")?;
        if !seen.insert(index) {
            return Err("Canonical body subjects must be unique".into());
        }
        let coordinate = nara_identity::run_ql_nara(
            "coordinate",
            &json!({"coordinate_ref":subject,"face":"bimba"}),
        )?;
        let native = crate::nara_coordinate::project(coordinate)?;
        let expected = &native["subject_binding"];
        if entity["subject"]["native_owner"] != expected["native_owner"]
            || entity["subject"]["subject_ref"] != expected["subject_ref"]
            || entity["subject"]["sources"] != expected["sources"]
        {
            return Err("Body source binding differs from the current native coordinate".into());
        }
        let earth = index == 0;
        let ordinal = if earth { 7 } else { index - 1 };
        entities.insert(key.into(),json!({"entity_ref":key,"revision":entity["revision"],
            "title":if earth {"EarthBody".to_owned()}else{format!("Centre {index}")},
            "subject":{"subject_ref":subject,"native_owner":"ql-mef","presentation_role":"thing","sources":[],"readings":[],"actions":[]},
            "parameters":{"glyph":{"value":if earth{"⊕".into()}else{index.to_string()},"automation":null},
                "x":{"value":0,"automation":null},"y":{"value":if earth{-376}else{-264+i32::from(ordinal)*88},"automation":null},
                "scale":{"value":1,"automation":null}}}));
    }
    Ok(
        json!({"schema":"oi.expression/v1","expression_ref":document["expression_ref"],"revision":document["revision"],
        "title":"Nara · safe cues","scenes":[{"scene_ref":scene_ref,"revision":scene["revision"],"title":"Seven centres and EarthBody","entity_refs":refs}],
        "entities":entities,"relations":{},"selection":{"scene_ref":scene_ref,"entity_ref":document["selection"]["entity_ref"]},
        "provenance":[],"representations":[],"refinements":[]}),
    )
}

impl Completed {
    pub fn transport_request(&self) -> Value {
        let p = &self.request.publication;
        json!({"kind":if self.request.operation==Operation::Publish{"publish_nara"}else{"preview_nara"},
            "consent_granted_at_unix_ms":p.granted_at_unix_ms,
            "input":{"document":self.safe_document,"selection":{"disclose_sources":"none"},
                "field_ref":p.field_ref,"world_ref":p.world_ref,"projection_ref":p.projection_ref,
                "presentation_ref":p.presentation_ref,"projection_revision":p.projection_revision,
                "publisher":{"identity_ref":p.publisher_identity_ref,"participant_ref":p.publisher_participant_ref},
                "audience":{"visibility":"restricted","refs":[p.target_ref]},
                "consent":{"consent_ref":p.consent_ref,"participant_ref":p.publisher_participant_ref,
                    "expression_ref":self.request.binding.expression_ref,"target_ref":p.target_ref,
                    "target_identity_ref":p.target_identity_ref,"granted_at":p.granted_at,"source_refs":[]}}})
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn frame_cannot_supply_document_or_private_reading() {
        let binding = json!({"operation":"context","source_ref":"source:one","expected_revision":"1",
            "person_ref":"person:one","nara_ref":"nara:one","expression_ref":"expression:one","role":"nara"});
        let mut input = json!({"operation":"prepare","binding":binding,"expected_expression_revision":1,
            "publication":{"field_ref":"field:one","world_ref":"world:one","projection_ref":"projection:one",
                "presentation_ref":"presentation:one","projection_revision":1,"publisher_identity_ref":"human:one",
                "publisher_participant_ref":"participant:one","target_ref":"participant:two","target_identity_ref":"human:two",
                "consent_ref":"consent:one","granted_at":"2026-09-28T12:00:00Z","granted_at_unix_ms":1}});
        assert!(serde_json::from_value::<Request>(input.clone()).is_ok());
        for key in ["document", "reading", "quaternion", "consent_reading"] {
            input[key] = json!({});
            assert!(serde_json::from_value::<Request>(input.clone()).is_err());
            input.as_object_mut().unwrap().remove(key);
        }
    }
}
